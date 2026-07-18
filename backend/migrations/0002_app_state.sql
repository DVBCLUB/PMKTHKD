PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_state_snapshots (
  shop_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  state_json TEXT NOT NULL,
  checksum TEXT,
  device_id TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_app_state_updated ON app_state_snapshots(updated_at DESC);

CREATE TABLE IF NOT EXISTS app_state_history (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  label TEXT,
  state_json TEXT NOT NULL,
  checksum TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_app_state_history_shop_created
  ON app_state_history(shop_id, created_at DESC);
