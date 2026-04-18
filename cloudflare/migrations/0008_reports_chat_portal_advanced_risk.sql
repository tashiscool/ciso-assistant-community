-- 0008_reports_chat_portal_advanced_risk.sql
-- Reports, chat/import pipelines, portal assignments, and advanced risk baselines.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS report_exports (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL,
  folder_id          TEXT,
  created_by_user_id TEXT,
  report_id          TEXT NOT NULL,
  name               TEXT NOT NULL,
  format             TEXT NOT NULL DEFAULT 'csv',
  status             TEXT NOT NULL DEFAULT 'generated',
  filter_json        TEXT NOT NULL DEFAULT '{}',
  summary_json       TEXT NOT NULL DEFAULT '{}',
  content_json       TEXT NOT NULL DEFAULT '{}',
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_report_exports_tenant_report
  ON report_exports (tenant_id, report_id, created_at DESC);

CREATE TABLE IF NOT EXISTS import_jobs (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL,
  folder_id          TEXT NOT NULL,
  created_by_user_id TEXT,
  name               TEXT NOT NULL,
  source_type        TEXT NOT NULL,
  target_kind        TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'completed',
  row_count          INTEGER NOT NULL DEFAULT 0,
  imported_count     INTEGER NOT NULL DEFAULT 0,
  error_count        INTEGER NOT NULL DEFAULT 0,
  steps_json         TEXT NOT NULL DEFAULT '[]',
  summary_json       TEXT NOT NULL DEFAULT '{}',
  created_objects_json TEXT NOT NULL DEFAULT '[]',
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_tenant_folder
  ON import_jobs (tenant_id, folder_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL,
  folder_id          TEXT NOT NULL,
  owner_user_id      TEXT,
  title              TEXT NOT NULL DEFAULT '',
  workflow           TEXT NOT NULL DEFAULT 'general',
  status             TEXT NOT NULL DEFAULT 'active',
  messages_json      TEXT NOT NULL DEFAULT '[]',
  citations_json     TEXT NOT NULL DEFAULT '[]',
  workflow_state_json TEXT NOT NULL DEFAULT '{}',
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_tenant_owner
  ON chat_sessions (tenant_id, owner_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS portal_assignments (
  id                   TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL,
  folder_id            TEXT NOT NULL,
  compliance_assessment_id TEXT,
  entity_id            TEXT,
  ref_id               TEXT,
  name                 TEXT NOT NULL,
  framework_name       TEXT,
  actor_name           TEXT,
  actor_email          TEXT,
  status               TEXT NOT NULL DEFAULT 'in_progress',
  due_date             TEXT,
  submitted_at         TEXT,
  observation          TEXT,
  requirements_json    TEXT NOT NULL DEFAULT '[]',
  events_json          TEXT NOT NULL DEFAULT '[]',
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  FOREIGN KEY (compliance_assessment_id) REFERENCES compliance_assessments(id) ON DELETE SET NULL,
  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_portal_assignments_tenant_folder
  ON portal_assignments (tenant_id, folder_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ebios_studies (
  id                     TEXT PRIMARY KEY,
  tenant_id              TEXT NOT NULL,
  folder_id              TEXT NOT NULL,
  perimeter_id           TEXT,
  reference_entity_id    TEXT,
  ref_id                 TEXT,
  name                   TEXT NOT NULL,
  description            TEXT,
  version                TEXT NOT NULL DEFAULT '1.0',
  status                 TEXT NOT NULL DEFAULT 'planned',
  quotation_method       TEXT NOT NULL DEFAULT 'express',
  risk_matrix_name       TEXT,
  observation            TEXT,
  workshop_status_json   TEXT NOT NULL DEFAULT '[]',
  feared_events_json     TEXT NOT NULL DEFAULT '[]',
  stakeholders_json      TEXT NOT NULL DEFAULT '[]',
  strategic_scenarios_json TEXT NOT NULL DEFAULT '[]',
  operational_scenarios_json TEXT NOT NULL DEFAULT '[]',
  created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  FOREIGN KEY (perimeter_id) REFERENCES perimeters(id) ON DELETE SET NULL,
  FOREIGN KEY (reference_entity_id) REFERENCES entities(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ebios_studies_tenant_folder
  ON ebios_studies (tenant_id, folder_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS quantitative_studies (
  id                   TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL,
  folder_id            TEXT NOT NULL,
  risk_register_id     TEXT,
  ref_id               TEXT,
  name                 TEXT NOT NULL,
  description          TEXT,
  version              TEXT NOT NULL DEFAULT '1.0',
  status               TEXT NOT NULL DEFAULT 'planned',
  distribution_model   TEXT NOT NULL DEFAULT 'lognormal_ci90',
  currency             TEXT NOT NULL DEFAULT 'USD',
  loss_threshold       REAL,
  observation          TEXT,
  risk_tolerance_json  TEXT NOT NULL DEFAULT '{}',
  portfolio_json       TEXT NOT NULL DEFAULT '{}',
  scenarios_json       TEXT NOT NULL DEFAULT '[]',
  action_plan_json     TEXT NOT NULL DEFAULT '[]',
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  FOREIGN KEY (risk_register_id) REFERENCES risk_registers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quantitative_studies_tenant_folder
  ON quantitative_studies (tenant_id, folder_id, updated_at DESC);
