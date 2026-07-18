PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  currency TEXT NOT NULL DEFAULT 'VND',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shop_settings (
  shop_id TEXT PRIMARY KEY,
  low_stock_notifications INTEGER NOT NULL DEFAULT 1 CHECK (low_stock_notifications IN (0, 1)),
  negative_stock_policy TEXT NOT NULL DEFAULT 'clamp_zero' CHECK (negative_stock_policy IN ('clamp_zero', 'allow')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'accountant', 'cashier', 'viewer')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (email),
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_shop_role ON users(shop_id, role, is_active);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  user_agent TEXT,
  ip_hash TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS integration_tokens (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL,
  expires_at TEXT,
  last_used_at TEXT,
  revoked_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_integration_tokens_shop ON integration_tokens(shop_id, revoked_at);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  sku TEXT NOT NULL COLLATE NOCASE,
  barcode TEXT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'cái',
  sale_price INTEGER NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
  cost_price INTEGER NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  stock REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  shopee_stock REAL NOT NULL DEFAULT 0,
  tiktok_stock REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (shop_id, sku),
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_shop_name ON products(shop_id, name);
CREATE INDEX IF NOT EXISTS idx_products_shop_barcode ON products(shop_id, barcode);
CREATE INDEX IF NOT EXISTS idx_products_shop_updated ON products(shop_id, updated_at);

CREATE TABLE IF NOT EXISTS partners (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  partner_type TEXT NOT NULL CHECK (partner_type IN ('supplier', 'customer')),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  debt_amount INTEGER NOT NULL DEFAULT 0,
  debt_limit INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_partners_shop_type ON partners(shop_id, partner_type, is_active);
CREATE INDEX IF NOT EXISTS idx_partners_shop_updated ON partners(shop_id, updated_at);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('shopee', 'tiktok', 'pos', 'manual')),
  order_sn TEXT NOT NULL,
  customer_name TEXT,
  phone TEXT,
  address TEXT,
  total_amount INTEGER NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'packing', 'shipping', 'completed', 'cancelled')),
  source TEXT NOT NULL DEFAULT 'api',
  carrier TEXT,
  tracking_number TEXT,
  idempotency_key TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (shop_id, platform, order_sn),
  UNIQUE (shop_id, idempotency_key),
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_shop_created ON orders(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_shop_status ON orders(shop_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_shop_updated ON orders(shop_id, updated_at);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  line_total INTEGER NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  order_id TEXT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'purchase', 'return', 'adjustment', 'transfer_in', 'transfer_out', 'opening')),
  quantity_delta REAL NOT NULL,
  quantity_before REAL NOT NULL,
  quantity_after REAL NOT NULL,
  unit_cost INTEGER,
  reference TEXT,
  note TEXT,
  created_by_type TEXT NOT NULL CHECK (created_by_type IN ('user', 'integration', 'system')),
  created_by_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_shop_created ON inventory_movements(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_product_created ON inventory_movements(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS cash_transactions (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'cash',
  description TEXT,
  partner_id TEXT,
  order_id TEXT,
  receipt_reference TEXT,
  is_estimated INTEGER NOT NULL DEFAULT 0 CHECK (is_estimated IN (0, 1)),
  occurred_at TEXT NOT NULL,
  created_by_type TEXT NOT NULL CHECK (created_by_type IN ('user', 'integration', 'system')),
  created_by_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cash_shop_occurred ON cash_transactions(shop_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_shop_updated ON cash_transactions(shop_id, updated_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'integration', 'system')),
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_shop_created ON audit_logs(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(shop_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS sync_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
  changed_at TEXT NOT NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sync_shop_id ON sync_events(shop_id, id);
