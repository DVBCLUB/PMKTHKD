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
  baseUrlStorageKey?: string;
}

export interface PmkUser {
  id: string;
  shopId: string;
  email: string;
  displayName: string;
  role: 'owner' | 'manager' | 'accountant' | 'cashier' | 'viewer';
}

export interface AppStateEnvelope<TState = unknown> {
  version: number;
  updatedAt: string | null;
  checksum: string | null;
  deviceId?: string | null;
  state: TState | null;
}

const importMetaEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/$/, '');
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export class PmkApiClient {
  private readonly configuredBaseUrl: string;
  private readonly tokenStorageKey: string;
  private readonly baseUrlStorageKey: string;

  constructor(options: ApiClientOptions = {}) {
    this.configuredBaseUrl = normalizeBaseUrl(options.baseUrl || importMetaEnv?.VITE_API_URL || '');
    this.tokenStorageKey = options.tokenStorageKey || 'pmk_session_token';
    this.baseUrlStorageKey = options.baseUrlStorageKey || 'pmk_api_url';
  }

  getBaseUrl(): string {
    return normalizeBaseUrl(localStorage.getItem(this.baseUrlStorageKey) || '') || this.configuredBaseUrl;
  }

  setBaseUrl(value: string): string {
    const normalized = normalizeBaseUrl(value);
    if (!normalized) throw new Error('Địa chỉ backend không hợp lệ.');
    localStorage.setItem(this.baseUrlStorageKey, normalized);
    return normalized;
  }

  hasBaseUrl(): boolean {
    return Boolean(this.getBaseUrl());
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenStorageKey);
  }

  setToken(token: string | null): void {
    if (token) localStorage.setItem(this.tokenStorageKey, token);
    else localStorage.removeItem(this.tokenStorageKey);
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      throw new PmkApiError(0, 'API_NOT_CONFIGURED', 'Chưa cấu hình địa chỉ Cloudflare Worker.');
    }

    const token = this.getToken();
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers,
        credentials: 'include',
      });
    } catch (error) {
      throw new PmkApiError(0, 'NETWORK_ERROR', 'Không thể kết nối backend. Hãy kiểm tra Internet và địa chỉ Worker.', error);
    }

    const text = await response.text();
    let payload: ApiEnvelope<T> | ApiFailure;
    try {
      payload = text ? JSON.parse(text) as ApiEnvelope<T> | ApiFailure : ({ success: true, data: undefined } as ApiEnvelope<T>);
    } catch {
      throw new PmkApiError(response.status, 'INVALID_SERVER_RESPONSE', 'Backend trả về dữ liệu không hợp lệ.');
    }

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

  health(): Promise<{ status: string; time: string; service: string; environment?: string }> {
    return this.request('/api/health');
  }

  async bootstrap(input: {
    shopName: string;
    displayName: string;
    email: string;
    password: string;
    bootstrapToken: string;
  }): Promise<{ shop: { id: string; name: string }; user: Omit<PmkUser, 'shopId'> & { shopId?: string }; token: string; expiresAt: string }> {
    const result = await this.request<{ shop: { id: string; name: string }; user: Omit<PmkUser, 'shopId'> & { shopId?: string }; token: string; expiresAt: string }>(
      '/api/auth/bootstrap',
      {
        method: 'POST',
        headers: { 'X-Bootstrap-Token': input.bootstrapToken },
        body: JSON.stringify({
          shopName: input.shopName,
          displayName: input.displayName,
          email: input.email,
          password: input.password,
        }),
      },
    );
    this.setToken(result.token);
    return result;
  }

  async login(email: string, password: string): Promise<{ user: PmkUser; token: string; expiresAt: string }> {
    const result = await this.request<{ user: PmkUser; token: string; expiresAt: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(result.token);
    return result;
  }

  async logout(): Promise<void> {
    try {
      if (this.getToken()) await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  me(): Promise<{
    principal: {
      type: 'user';
      actorId: string;
      shopId: string;
      role: PmkUser['role'];
      email: string;
      displayName: string;
    };
    shop: { id: string; name: string; timezone: string; currency: string };
  }> {
    return this.request('/api/me');
  }

  appState<TState = unknown>(): Promise<AppStateEnvelope<TState>> {
    return this.request('/api/app-state');
  }

  saveAppState<TState>(payload: {
    baseVersion: number;
    state: TState;
    deviceId: string;
    force?: boolean;
  }): Promise<AppStateEnvelope<TState> & { updatedAt: string; checksum: string }> {
    return this.request('/api/app-state', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  createCheckpoint(label?: string): Promise<{ id: string; version: number; createdAt: string }> {
    return this.request('/api/app-state/checkpoint', {
      method: 'POST',
      body: JSON.stringify({ label: label || '' }),
    });
  }

  appStateHistory(limit = 20): Promise<Array<{
    id: string;
    version: number;
    label: string | null;
    checksum: string | null;
    createdAt: string;
  }>> {
    return this.request(`/api/app-state/history?limit=${Math.max(1, Math.min(50, limit))}`);
  }

  restoreAppState<TState = unknown>(historyId: string): Promise<AppStateEnvelope<TState> & { updatedAt: string }> {
    return this.request(`/api/app-state/history/${encodeURIComponent(historyId)}/restore`, { method: 'POST' });
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
