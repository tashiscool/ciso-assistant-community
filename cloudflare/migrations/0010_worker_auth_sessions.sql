PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS worker_access_sessions (
  tenant_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  session_token TEXT NOT NULL,
  user_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  root_folder_id TEXT,
  is_superuser INTEGER NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0,
  preferences_json TEXT NOT NULL DEFAULT '{}',
  permissions_json TEXT NOT NULL DEFAULT '[]',
  accessible_domains_json TEXT NOT NULL DEFAULT '[]',
  domain_permissions_json TEXT NOT NULL DEFAULT '{}',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, access_token),
  UNIQUE (tenant_id, session_token)
);

CREATE INDEX IF NOT EXISTS idx_worker_access_sessions_active
  ON worker_access_sessions (tenant_id, revoked_at, expires_at, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_worker_access_sessions_user
  ON worker_access_sessions (tenant_id, user_id, revoked_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS worker_vendor_portal_tokens (
  tenant_id TEXT NOT NULL,
  token TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  questionnaire_id TEXT,
  entity_assessment_id TEXT,
  vendor_email TEXT,
  vendor_name TEXT,
  questionnaire_snapshot_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TEXT NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 0,
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, token)
);

CREATE INDEX IF NOT EXISTS idx_worker_vendor_portal_tokens_status
  ON worker_vendor_portal_tokens (tenant_id, status, expires_at, updated_at DESC);
