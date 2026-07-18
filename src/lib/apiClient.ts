export interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class PmkApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  tokenStorageKey?: string;
}

const importMetaEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;

export class PmkApiClient {
  private readonly baseUrl: string;
  private readonly tokenStorageKey: string;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl || importMetaEnv?.VITE_API_URL || '').replace(/\/$/, '');
    this.tokenStorageKey = options.tokenStorageKey || 'pmk_session_token';
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenStorageKey);
  }

  setToken(token: string | null): void {
    if (token) localStorage.setItem(this.tokenStorageKey, token);
    else localStorage.removeItem(this.tokenStorageKey);
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });

    const payload = await response.json() as ApiEnvelope<T> | ApiFailure;
    if (!response.ok || !payload.success) {
      const failure = payload as ApiFailure;
      if (response.status === 401) this.setToken(null);
      throw new PmkApiError(
        response.status,
        failure.error?.code || 'REQUEST_FAILED',
        failure.error?.message || 'Không thể kết nối máy chủ.',
        failure.error?.details,
      );
    }

    return payload.data;
  }

  async login(email: string, password: string): Promise<{
    user: { id: string; shopId: string; email: string; displayName: string; role: string };
    token: string;
    expiresAt: string;
  }> {
    const result = await this.request<{
      user: { id: string; shopId: string; email: string; displayName: string; role: string };
      token: string;
      expiresAt: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(result.token);
    return result;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  health(): Promise<{ status: string; time: string; service: string }> {
    return this.request('/api/health');
  }

  me(): Promise<Record<string, unknown>> {
    return this.request('/api/me');
  }

  dashboard(): Promise<Record<string, unknown>> {
    return this.request('/api/dashboard');
  }

  products(params: { page?: number; limit?: number; search?: string } = {}): Promise<unknown[]> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    return this.request(`/api/products${query.size ? `?${query}` : ''}`);
  }

  createProduct(product: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request('/api/products', { method: 'POST', body: JSON.stringify(product) });
  }

  adjustInventory(adjustment: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request('/api/inventory/adjust', { method: 'POST', body: JSON.stringify(adjustment) });
  }

  importOrder(order: Record<string, unknown>, idempotencyKey?: string): Promise<Record<string, unknown>> {
    const headers = new Headers();
    if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
    return this.request('/api/orders/import', {
      method: 'POST',
      headers,
      body: JSON.stringify(order),
    });
  }

  backup(): Promise<Record<string, unknown>> {
    return this.request('/api/backup');
  }
}

export const pmkApi = new PmkApiClient();
