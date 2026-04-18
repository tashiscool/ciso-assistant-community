-- 0017_setup_admin.sql
-- Canonical setup/admin surfaces for Regovise: tags, service accounts, and security posture.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS setup_tags (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  title               TEXT NOT NULL,
  tag_type            TEXT NOT NULL,
  oscal_required      INTEGER NOT NULL DEFAULT 0,
  usage_count         INTEGER NOT NULL DEFAULT 0,
  created_by_user_id  TEXT,
  updated_by_user_id  TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, title),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_setup_tags_tenant_updated
  ON setup_tags (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS setup_service_accounts (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  token_prefix        TEXT NOT NULL,
  purpose             TEXT NOT NULL,
  role_name           TEXT NOT NULL,
  runtime             TEXT NOT NULL,
  scopes_json         TEXT NOT NULL DEFAULT '[]',
  expires_at          TEXT NOT NULL,
  last_used_at        TEXT,
  last_rotated_at     TEXT NOT NULL,
  created_by_user_id  TEXT,
  updated_by_user_id  TEXT,
  is_active           INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_setup_service_accounts_tenant_updated
  ON setup_service_accounts (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS setup_security_controls (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  control_key         TEXT NOT NULL,
  title               TEXT NOT NULL,
  category            TEXT NOT NULL,
  status              TEXT NOT NULL,
  owner_name          TEXT,
  description         TEXT NOT NULL,
  detail_json         TEXT NOT NULL DEFAULT '{}',
  created_by_user_id  TEXT,
  updated_by_user_id  TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, control_key),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_setup_security_controls_tenant_updated
  ON setup_security_controls (tenant_id, updated_at DESC);
