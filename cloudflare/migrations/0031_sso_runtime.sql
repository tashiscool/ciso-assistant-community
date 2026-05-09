PRAGMA foreign_keys = ON;

ALTER TABLE setup_sso_configs ADD COLUMN auth_protocol TEXT NOT NULL DEFAULT 'oidc';
ALTER TABLE setup_sso_configs ADD COLUMN roles_claim TEXT NOT NULL DEFAULT 'roles';
ALTER TABLE setup_sso_configs ADD COLUMN email_claim TEXT NOT NULL DEFAULT 'email';
ALTER TABLE setup_sso_configs ADD COLUMN given_name_claim TEXT NOT NULL DEFAULT 'given_name';
ALTER TABLE setup_sso_configs ADD COLUMN family_name_claim TEXT NOT NULL DEFAULT 'family_name';
ALTER TABLE setup_sso_configs ADD COLUMN username_claim TEXT NOT NULL DEFAULT 'preferred_username';
ALTER TABLE setup_sso_configs ADD COLUMN button_label TEXT;
ALTER TABLE setup_sso_configs ADD COLUMN allow_local_fallback INTEGER NOT NULL DEFAULT 1;
ALTER TABLE setup_sso_configs ADD COLUMN jit_provisioning_enabled INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users ADD COLUMN auth_provider TEXT;
ALTER TABLE users ADD COLUMN auth_subject TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_auth_subject
  ON users (tenant_id, auth_provider, auth_subject)
  WHERE auth_provider IS NOT NULL AND auth_subject IS NOT NULL;

CREATE TABLE IF NOT EXISTS sso_auth_transactions (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  tenant_slug     TEXT NOT NULL,
  provider_type   TEXT NOT NULL,
  auth_protocol   TEXT NOT NULL,
  next_path       TEXT NOT NULL DEFAULT '/',
  redirect_uri    TEXT NOT NULL,
  code_verifier   TEXT NOT NULL,
  nonce           TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at      TEXT NOT NULL,
  consumed_at     TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sso_auth_transactions_tenant
  ON sso_auth_transactions (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sso_auth_transactions_expiry
  ON sso_auth_transactions (expires_at);
