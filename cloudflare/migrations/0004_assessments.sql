-- 0004_assessments.sql
-- Perimeters, risk assessments, and compliance assessments.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS perimeters (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  folder_id     TEXT NOT NULL,
  ref_id        TEXT,
  name          TEXT NOT NULL,
  description   TEXT,
  lc_status     TEXT NOT NULL DEFAULT 'in_design',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, folder_id, name),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_perimeters_tenant_folder
  ON perimeters (tenant_id, folder_id);

CREATE TABLE IF NOT EXISTS risk_assessments (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  folder_id        TEXT NOT NULL,
  perimeter_id     TEXT,
  risk_register_id TEXT,
  ref_id           TEXT,
  name             TEXT NOT NULL,
  version          TEXT NOT NULL DEFAULT '1.0',
  status           TEXT NOT NULL DEFAULT 'planned',
  observation      TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  FOREIGN KEY (perimeter_id) REFERENCES perimeters(id) ON DELETE SET NULL,
  FOREIGN KEY (risk_register_id) REFERENCES risk_registers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_tenant_perimeter
  ON risk_assessments (tenant_id, perimeter_id);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_register
  ON risk_assessments (risk_register_id);

CREATE TABLE IF NOT EXISTS compliance_assessments (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  folder_id         TEXT NOT NULL,
  perimeter_id      TEXT,
  framework_id      TEXT NOT NULL,
  ref_id            TEXT,
  name              TEXT NOT NULL,
  version           TEXT NOT NULL DEFAULT '1.0',
  status            TEXT NOT NULL DEFAULT 'planned',
  observation       TEXT,
  controls_total    INTEGER NOT NULL DEFAULT 0,
  controls_assessed INTEGER NOT NULL DEFAULT 0,
  progress_percent  INTEGER NOT NULL DEFAULT 0,
  maturity_score    REAL,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  FOREIGN KEY (perimeter_id) REFERENCES perimeters(id) ON DELETE SET NULL,
  FOREIGN KEY (framework_id) REFERENCES frameworks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_compliance_assessments_tenant_perimeter
  ON compliance_assessments (tenant_id, perimeter_id);

CREATE INDEX IF NOT EXISTS idx_compliance_assessments_framework
  ON compliance_assessments (framework_id);
