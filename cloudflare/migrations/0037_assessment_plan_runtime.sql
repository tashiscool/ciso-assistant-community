-- 0037_assessment_plan_runtime.sql
-- Persist linked assessment plans and line-of-inquiry execution state for manual assessments.

PRAGMA foreign_keys = ON;

ALTER TABLE compliance_assessments ADD COLUMN assessment_plan_template_id TEXT;

CREATE INDEX IF NOT EXISTS idx_compliance_assessments_assessment_plan
  ON compliance_assessments (tenant_id, assessment_plan_template_id);

CREATE TABLE IF NOT EXISTS compliance_assessment_plan_items (
  id                           TEXT PRIMARY KEY,
  tenant_id                    TEXT NOT NULL,
  compliance_assessment_id     TEXT NOT NULL,
  assessment_plan_template_id  TEXT NOT NULL,
  template_question_id         TEXT,
  line_ref                     TEXT NOT NULL,
  line_section                 TEXT,
  line_prompt                  TEXT NOT NULL,
  requirement_ref              TEXT,
  evidence_hint                TEXT,
  sort_order                   INTEGER NOT NULL DEFAULT 0,
  result                       TEXT NOT NULL DEFAULT 'not_assessed',
  observation                  TEXT,
  evidence_note                TEXT,
  gaps_differences             TEXT,
  likelihood                   REAL,
  impact                       REAL,
  auto_generate_follow_up      INTEGER NOT NULL DEFAULT 1,
  generated_follow_up_id       TEXT,
  created_at                   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at                   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, compliance_assessment_id, template_question_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (compliance_assessment_id) REFERENCES compliance_assessments(id) ON DELETE CASCADE,
  FOREIGN KEY (assessment_plan_template_id) REFERENCES questionnaire_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (generated_follow_up_id) REFERENCES applied_controls(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_compliance_assessment_plan_items_assessment
  ON compliance_assessment_plan_items (compliance_assessment_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_compliance_assessment_plan_items_tenant_result
  ON compliance_assessment_plan_items (tenant_id, result);

ALTER TABLE applied_controls ADD COLUMN assessment_plan_item_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_applied_controls_plan_item
  ON applied_controls (assessment_plan_item_id)
  WHERE assessment_plan_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_applied_controls_tenant_plan_item
  ON applied_controls (tenant_id, assessment_plan_item_id);
