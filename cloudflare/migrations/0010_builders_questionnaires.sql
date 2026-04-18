-- 0010_builders_questionnaires.sql
-- Canonical Regovise builder persistence for questionnaire authoring and visual rules.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS questionnaire_templates (
  id                   TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL,
  name                 TEXT NOT NULL,
  description          TEXT,
  status               TEXT NOT NULL DEFAULT 'draft',
  scoring_mode         TEXT NOT NULL DEFAULT 'weighted',
  audience             TEXT,
  version              INTEGER NOT NULL DEFAULT 1,
  questions_json       TEXT NOT NULL,
  metadata_json        TEXT,
  created_by_user_id   TEXT,
  updated_by_user_id   TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_questionnaire_templates_tenant_updated
  ON questionnaire_templates (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS questionnaire_rule_sets (
  id                         TEXT PRIMARY KEY,
  tenant_id                  TEXT NOT NULL,
  questionnaire_template_id  TEXT NOT NULL,
  name                       TEXT NOT NULL,
  engine_version             TEXT NOT NULL DEFAULT '1.0',
  rules_json                 TEXT NOT NULL,
  diagnostics_json           TEXT,
  created_by_user_id         TEXT,
  updated_by_user_id         TEXT,
  created_at                 TEXT NOT NULL,
  updated_at                 TEXT NOT NULL,
  FOREIGN KEY (questionnaire_template_id) REFERENCES questionnaire_templates(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_questionnaire_rule_sets_template
  ON questionnaire_rule_sets (tenant_id, questionnaire_template_id);

CREATE TABLE IF NOT EXISTS questionnaire_rule_test_runs (
  id                         TEXT PRIMARY KEY,
  tenant_id                  TEXT NOT NULL,
  questionnaire_template_id  TEXT NOT NULL,
  questionnaire_rule_set_id  TEXT NOT NULL,
  scenario_name              TEXT NOT NULL,
  input_json                 TEXT NOT NULL,
  execution_log_json         TEXT NOT NULL,
  result_json                TEXT NOT NULL,
  status                     TEXT NOT NULL DEFAULT 'completed',
  created_by_user_id         TEXT,
  created_at                 TEXT NOT NULL,
  FOREIGN KEY (questionnaire_template_id) REFERENCES questionnaire_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (questionnaire_rule_set_id) REFERENCES questionnaire_rule_sets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_questionnaire_rule_test_runs_template
  ON questionnaire_rule_test_runs (tenant_id, questionnaire_template_id, created_at DESC);
