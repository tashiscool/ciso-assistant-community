PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS local_password_credentials (
  user_id              TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL,
  password_hash        TEXT NOT NULL,
  password_salt        TEXT NOT NULL,
  hash_method          TEXT NOT NULL DEFAULT 'pbkdf2_sha256',
  hash_iterations      INTEGER NOT NULL DEFAULT 100000,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  updated_by_user_id   TEXT,
  reset_required       INTEGER NOT NULL DEFAULT 0,
  failed_attempts      INTEGER NOT NULL DEFAULT 0,
  last_failed_at       TEXT,
  locked_until         TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_local_password_credentials_tenant
  ON local_password_credentials (tenant_id, updated_at DESC);
