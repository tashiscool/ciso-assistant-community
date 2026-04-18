-- 0006_catalog_action_plans.sql
-- Library catalog records plus applied-control action plan state.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS libraries (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL,
  framework_id       TEXT,
  name               TEXT NOT NULL,
  description        TEXT,
  provider           TEXT NOT NULL,
  packager           TEXT NOT NULL,
  version            TEXT,
  publication_date   TEXT,
  copyright          TEXT,
  dependencies_json  TEXT NOT NULL DEFAULT '[]',
  risk_matrices_json TEXT NOT NULL DEFAULT '[]',
  threats_json       TEXT NOT NULL DEFAULT '[]',
  has_update         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, name),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (framework_id) REFERENCES frameworks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_libraries_tenant_framework
  ON libraries (tenant_id, framework_id);

CREATE TABLE IF NOT EXISTS applied_controls (
  id                        TEXT PRIMARY KEY,
  tenant_id                 TEXT NOT NULL,
  compliance_assessment_id  TEXT NOT NULL,
  requirement_assessment_id TEXT,
  folder_id                 TEXT NOT NULL,
  ref_id                    TEXT,
  name                      TEXT NOT NULL,
  description               TEXT,
  status                    TEXT NOT NULL DEFAULT 'to_do',
  priority                  TEXT,
  category                  TEXT,
  csf_function              TEXT,
  owner_name                TEXT,
  eta                       TEXT,
  expiry_date               TEXT,
  control_impact            INTEGER,
  effort                    TEXT,
  annual_cost               REAL,
  notes                     TEXT,
  is_generated              INTEGER NOT NULL DEFAULT 1,
  created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (requirement_assessment_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (compliance_assessment_id) REFERENCES compliance_assessments(id) ON DELETE CASCADE,
  FOREIGN KEY (requirement_assessment_id) REFERENCES compliance_requirement_assessments(id) ON DELETE SET NULL,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_applied_controls_tenant_assessment
  ON applied_controls (tenant_id, compliance_assessment_id);

CREATE INDEX IF NOT EXISTS idx_applied_controls_tenant_status
  ON applied_controls (tenant_id, status);
