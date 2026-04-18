PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS setup_modules_features (
  tenant_id           TEXT PRIMARY KEY,
  enabled_modules_json TEXT NOT NULL DEFAULT '[]',
  feature_flags_json   TEXT NOT NULL DEFAULT '[]',
  regml_enabled        INTEGER NOT NULL DEFAULT 1,
  regml_terms_accepted INTEGER NOT NULL DEFAULT 0,
  status_note          TEXT,
  created_by_user_id   TEXT,
  updated_by_user_id   TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS setup_sso_configs (
  tenant_id            TEXT PRIMARY KEY,
  provider_type        TEXT NOT NULL DEFAULT 'Google Workspace',
  domain_hint          TEXT,
  client_id            TEXT,
  callback_url         TEXT,
  metadata_url         TEXT,
  group_sync_enabled   INTEGER NOT NULL DEFAULT 1,
  login_enforced       INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'Review',
  created_by_user_id   TEXT,
  updated_by_user_id   TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS setup_mfa_policies (
  tenant_id                    TEXT PRIMARY KEY,
  enforcement                  TEXT NOT NULL DEFAULT 'Optional',
  methods_json                 TEXT NOT NULL DEFAULT '{}',
  exempt_service_accounts_json TEXT NOT NULL DEFAULT '[]',
  grace_period_days            INTEGER NOT NULL DEFAULT 14,
  target_coverage              INTEGER NOT NULL DEFAULT 80,
  status                       TEXT NOT NULL DEFAULT 'Planned',
  created_by_user_id           TEXT,
  updated_by_user_id           TEXT,
  created_at                   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at                   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
