PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS local_login_codes (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  user_id             TEXT NOT NULL,
  email_normalized    TEXT NOT NULL,
  purpose             TEXT NOT NULL DEFAULT 'sign_in',
  code_hash           TEXT NOT NULL,
  requested_at        TEXT NOT NULL,
  expires_at          TEXT NOT NULL,
  consumed_at         TEXT,
  attempts            INTEGER NOT NULL DEFAULT 0,
  last_attempt_at     TEXT,
  delivery_status     TEXT,
  delivery_provider   TEXT,
  delivery_request_id TEXT,
  ip_address          TEXT,
  user_agent          TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_local_login_codes_lookup
  ON local_login_codes (tenant_id, email_normalized, purpose, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_local_login_codes_expiry
  ON local_login_codes (expires_at);
