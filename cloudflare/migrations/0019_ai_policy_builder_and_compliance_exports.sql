-- 0019_ai_policy_builder_and_compliance_exports.sql
-- Canonical AI policy-builder sessions and compliance export jobs.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ai_policy_builder_sessions (
  id                        TEXT PRIMARY KEY,
  tenant_id                 TEXT NOT NULL,
  folder_id                 TEXT,
  title                     TEXT NOT NULL,
  owner_user_id             TEXT,
  owner_name                TEXT,
  status                    TEXT NOT NULL DEFAULT 'Draft',
  selected_profile_ids_json TEXT NOT NULL DEFAULT '[]',
  queue_json                TEXT NOT NULL DEFAULT '[]',
  last_saved_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_policy_builder_sessions_tenant_updated
  ON ai_policy_builder_sessions (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_policy_builder_requirements (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  session_id        TEXT NOT NULL,
  folder_id         TEXT,
  source_control_id TEXT NOT NULL,
  source_name       TEXT NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  family            TEXT,
  status            TEXT NOT NULL DEFAULT 'Not Implemented',
  assignee_name     TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES ai_policy_builder_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
  UNIQUE (session_id, source_control_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_policy_builder_requirements_tenant_folder
  ON ai_policy_builder_requirements (tenant_id, folder_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_compliance_export_jobs (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  folder_id         TEXT,
  option_id         TEXT NOT NULL,
  family            TEXT NOT NULL,
  format            TEXT NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  source_record     TEXT NOT NULL DEFAULT 'primary-security-plan',
  file_name         TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'Running',
  readiness_json    TEXT NOT NULL DEFAULT '[]',
  artifact_key      TEXT,
  report_export_id  TEXT,
  queue_depth       INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
  FOREIGN KEY (report_export_id) REFERENCES report_exports(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_compliance_export_jobs_tenant_created
  ON ai_compliance_export_jobs (tenant_id, created_at DESC);
