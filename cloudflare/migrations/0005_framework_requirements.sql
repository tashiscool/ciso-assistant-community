-- 0005_framework_requirements.sql
-- Framework control assessments used by compliance assessment detail workflows.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS compliance_requirement_assessments (
  id                       TEXT PRIMARY KEY,
  tenant_id                TEXT NOT NULL,
  compliance_assessment_id TEXT NOT NULL,
  control_id               TEXT NOT NULL,
  result                   TEXT NOT NULL DEFAULT 'not_assessed',
  observation              TEXT,
  evidence_status          TEXT NOT NULL DEFAULT 'missing',
  implementation_score     REAL,
  documentation_score      REAL,
  created_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (compliance_assessment_id, control_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (compliance_assessment_id) REFERENCES compliance_assessments(id) ON DELETE CASCADE,
  FOREIGN KEY (control_id) REFERENCES controls(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_compliance_requirement_assessments_assessment
  ON compliance_requirement_assessments (compliance_assessment_id);

CREATE INDEX IF NOT EXISTS idx_compliance_requirement_assessments_tenant
  ON compliance_requirement_assessments (tenant_id, result);
