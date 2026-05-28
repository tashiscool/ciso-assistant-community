-- 0036_shared_modules_runtime.sql
-- Tenant-facing shared module records and manual-assessment runtime extensions.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS module_records (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL,
  module_key         TEXT NOT NULL,
  folder_id          TEXT NOT NULL,
  title              TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'planned',
  owner_user_id      TEXT,
  assignee_user_id   TEXT,
  start_on           TEXT,
  finish_on          TEXT,
  due_on             TEXT,
  review_on          TEXT,
  expires_on         TEXT,
  data_json          TEXT NOT NULL DEFAULT '{}',
  links_json         TEXT NOT NULL DEFAULT '[]',
  activity_json      TEXT NOT NULL DEFAULT '[]',
  archived           INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_module_records_tenant_module
  ON module_records (tenant_id, module_key, archived, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_module_records_tenant_folder
  ON module_records (tenant_id, folder_id, module_key);

CREATE INDEX IF NOT EXISTS idx_module_records_tenant_status
  ON module_records (tenant_id, module_key, status);

ALTER TABLE compliance_assessments ADD COLUMN assessment_kind TEXT NOT NULL DEFAULT 'compliance';
ALTER TABLE compliance_assessments ADD COLUMN lead_assessor_user_id TEXT;
ALTER TABLE compliance_assessments ADD COLUMN instructions TEXT;
ALTER TABLE compliance_assessments ADD COLUMN planned_start_on TEXT;
ALTER TABLE compliance_assessments ADD COLUMN planned_finish_on TEXT;
ALTER TABLE compliance_assessments ADD COLUMN process_info TEXT;
ALTER TABLE compliance_assessments ADD COLUMN assignment_principal_type TEXT;
ALTER TABLE compliance_assessments ADD COLUMN assignment_principal_id TEXT;
ALTER TABLE compliance_assessments ADD COLUMN recurrence_json TEXT;
ALTER TABLE compliance_assessments ADD COLUMN source_security_plan_id TEXT;
ALTER TABLE compliance_assessments ADD COLUMN recurrence_source_assessment_id TEXT;

ALTER TABLE compliance_requirement_assessments ADD COLUMN in_scope INTEGER NOT NULL DEFAULT 1;
ALTER TABLE compliance_requirement_assessments ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE compliance_requirement_assessments ADD COLUMN evidence_note TEXT;
ALTER TABLE compliance_requirement_assessments ADD COLUMN gaps_differences TEXT;
ALTER TABLE compliance_requirement_assessments ADD COLUMN likelihood REAL;
ALTER TABLE compliance_requirement_assessments ADD COLUMN impact REAL;
ALTER TABLE compliance_requirement_assessments ADD COLUMN auto_generate_follow_up INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_compliance_requirement_assessments_scope
  ON compliance_requirement_assessments (compliance_assessment_id, in_scope, sort_order);
