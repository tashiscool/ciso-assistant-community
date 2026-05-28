-- 0038_questionnaire_runtime.sql
-- Tenant-facing questionnaire assignment, response, review, and reporting runtime.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS questionnaire_instances (
  id                         TEXT PRIMARY KEY,
  tenant_id                  TEXT NOT NULL,
  questionnaire_template_id  TEXT NOT NULL,
  title                      TEXT NOT NULL,
  assignment_type            TEXT NOT NULL,
  assignee_user_id           TEXT,
  assignee_email             TEXT,
  reviewer_user_id           TEXT,
  parent_module              TEXT,
  parent_record_id           TEXT,
  status                     TEXT NOT NULL DEFAULT 'Open',
  due_date                   TEXT,
  access_code                TEXT NOT NULL,
  share_token                TEXT NOT NULL UNIQUE,
  login_required             INTEGER NOT NULL DEFAULT 0,
  answers_json               TEXT NOT NULL DEFAULT '{}',
  uploads_json               TEXT NOT NULL DEFAULT '{}',
  header_values_json         TEXT NOT NULL DEFAULT '{}',
  feedback_json              TEXT NOT NULL DEFAULT '{}',
  collaboration_json         TEXT NOT NULL DEFAULT '[]',
  recurrence_json            TEXT,
  score                      REAL NOT NULL DEFAULT 0,
  max_score                  REAL NOT NULL DEFAULT 0,
  grade                      TEXT,
  percent_complete           REAL NOT NULL DEFAULT 0,
  passing_status             TEXT NOT NULL DEFAULT 'Pending',
  submitted_at               TEXT,
  reviewed_at                TEXT,
  created_by_user_id         TEXT,
  updated_by_user_id         TEXT,
  archived                   INTEGER NOT NULL DEFAULT 0,
  created_at                 TEXT NOT NULL,
  updated_at                 TEXT NOT NULL,
  FOREIGN KEY (questionnaire_template_id) REFERENCES questionnaire_templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_questionnaire_instances_template_updated
  ON questionnaire_instances (tenant_id, questionnaire_template_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_questionnaire_instances_status_due
  ON questionnaire_instances (tenant_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_questionnaire_instances_share_token
  ON questionnaire_instances (share_token);

CREATE TABLE IF NOT EXISTS questionnaire_recurring_assignments (
  id                         TEXT PRIMARY KEY,
  tenant_id                  TEXT NOT NULL,
  questionnaire_template_id  TEXT NOT NULL,
  title                      TEXT NOT NULL,
  recipient_user_id          TEXT,
  recipient_email            TEXT,
  reviewer_user_id           TEXT,
  recurrence_type            TEXT NOT NULL,
  start_date                 TEXT NOT NULL,
  end_date                   TEXT,
  last_sent_at               TEXT,
  next_send_at               TEXT,
  status                     TEXT NOT NULL DEFAULT 'Active',
  created_by_user_id         TEXT,
  updated_by_user_id         TEXT,
  created_at                 TEXT NOT NULL,
  updated_at                 TEXT NOT NULL,
  FOREIGN KEY (questionnaire_template_id) REFERENCES questionnaire_templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_questionnaire_recurring_template
  ON questionnaire_recurring_assignments (tenant_id, questionnaire_template_id, status);

CREATE TABLE IF NOT EXISTS questionnaire_history_entries (
  id                         TEXT PRIMARY KEY,
  tenant_id                  TEXT NOT NULL,
  questionnaire_instance_id  TEXT NOT NULL,
  discriminator              TEXT NOT NULL,
  json_data                  TEXT NOT NULL,
  created_by_user_id         TEXT,
  created_at                 TEXT NOT NULL,
  FOREIGN KEY (questionnaire_instance_id) REFERENCES questionnaire_instances(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_questionnaire_history_instance
  ON questionnaire_history_entries (tenant_id, questionnaire_instance_id, created_at DESC);

CREATE TABLE IF NOT EXISTS questionnaire_response_properties (
  id                         TEXT PRIMARY KEY,
  tenant_id                  TEXT NOT NULL,
  questionnaire_instance_id  TEXT NOT NULL,
  questionnaire_template_id  TEXT NOT NULL,
  key                        TEXT NOT NULL,
  label                      TEXT NOT NULL,
  value                      TEXT,
  secondary_id               TEXT,
  secondary_module           TEXT,
  created_at                 TEXT NOT NULL,
  updated_at                 TEXT NOT NULL,
  FOREIGN KEY (questionnaire_instance_id) REFERENCES questionnaire_instances(id) ON DELETE CASCADE,
  FOREIGN KEY (questionnaire_template_id) REFERENCES questionnaire_templates(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_questionnaire_response_properties_unique
  ON questionnaire_response_properties (tenant_id, questionnaire_instance_id, key);

CREATE INDEX IF NOT EXISTS idx_questionnaire_response_properties_template
  ON questionnaire_response_properties (tenant_id, questionnaire_template_id, key);
