CREATE TABLE IF NOT EXISTS setup_email_configs (
  tenant_id TEXT PRIMARY KEY,
  support_email TEXT,
  delivery_mode TEXT NOT NULL DEFAULT 'Disabled',
  status TEXT NOT NULL DEFAULT 'Review',
  status_note TEXT,
  last_verified_at TEXT,
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
