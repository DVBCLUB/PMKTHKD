export type UserRole = 'owner' | 'manager' | 'accountant' | 'cashier' | 'viewer';
export type PrincipalType = 'user' | 'integration';

export interface Env {
  DB: D1Database;
  APP_ENV: string;
  ALLOWED_ORIGINS: string;
  SESSION_TTL_DAYS: string;
  BOOTSTRAP_TOKEN: string;
}

export interface UserRow {
  id: string;
  shop_id: string;
  email: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  role: UserRole;
  is_active: number;
  failed_login_count: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  token_hash: string;
  user_id: string;
  expires_at: string;
  created_at: string;
  last_seen_at: string;
}

export interface AuthPrincipal {
  type: PrincipalType;
  actorId: string;
  shopId: string;
  role?: UserRole;
  scopes: string[];
  email?: string;
  displayName?: string;
  tokenHash?: string;
}

export interface ProductRow {
  id: string;
  shop_id: string;
  sku: string;
  barcode: string | null;
  name: string;
  unit: string;
  sale_price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  shopee_stock: number;
  tiktok_stock: number;
  is_active: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItemInput {
  sku: string;
  name: string;
  quantity: number;
  price: number;
}

export interface ImportOrderInput {
  platform: 'shopee' | 'tiktok' | 'pos' | 'manual';
  orderSn: string;
  customerName?: string;
  phone?: string;
  address?: string;
  items: OrderItemInput[];
  totalAmount: number;
  carrier?: string;
  trackingNumber?: string;
  createdAt?: string;
  idempotencyKey?: string;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
