-- 0020_response_automation_and_evidence_mapping.sql
-- Canonical response automation and evidence mapping runtime state.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS response_automation_jobs (
  id                           TEXT PRIMARY KEY,
  tenant_id                    TEXT NOT NULL,
  folder_id                    TEXT,
  title                        TEXT NOT NULL,
  source_document              TEXT NOT NULL,
  source_ids_json              TEXT NOT NULL DEFAULT '[]',
  export_format                TEXT NOT NULL DEFAULT 'xlsx',
  status                       TEXT NOT NULL DEFAULT 'In Progress',
  export_report_id             TEXT,
  created_by_user_id           TEXT,
  created_at                   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at                   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
  FOREIGN KEY (export_report_id) REFERENCES report_exports(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_response_automation_jobs_tenant_created
  ON response_automation_jobs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS response_automation_items (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL,
  job_id             TEXT NOT NULL,
  question           TEXT NOT NULL,
  answer             TEXT NOT NULL DEFAULT '',
  confidence         INTEGER NOT NULL DEFAULT 0,
  citations_json     TEXT NOT NULL DEFAULT '[]',
  retrieval_score    INTEGER NOT NULL DEFAULT 0,
  accepted           INTEGER NOT NULL DEFAULT 0,
  review_state       TEXT NOT NULL DEFAULT 'Needs Review',
  source_ids_json    TEXT NOT NULL DEFAULT '[]',
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES response_automation_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_response_automation_items_job_order
  ON response_automation_items (job_id, sort_order ASC);

CREATE TABLE IF NOT EXISTS evidence_record_mappings (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL,
  artifact_id        TEXT NOT NULL,
  mapped_type        TEXT NOT NULL,
  mapped_id          TEXT NOT NULL,
  mapped_title       TEXT NOT NULL,
  parent_label       TEXT,
  lineage            TEXT,
  created_by_user_id TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES evidence_artifacts(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (artifact_id, mapped_type, mapped_id)
);

CREATE INDEX IF NOT EXISTS idx_evidence_record_mappings_artifact
  ON evidence_record_mappings (artifact_id, created_at DESC);

CREATE TABLE IF NOT EXISTS evidence_mapping_recommendation_runs (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL,
  artifact_id        TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'Finished',
  threshold          INTEGER NOT NULL DEFAULT 50,
  recommendations_json TEXT NOT NULL DEFAULT '[]',
  created_by_user_id TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES evidence_artifacts(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_evidence_mapping_runs_artifact
  ON evidence_mapping_recommendation_runs (artifact_id, created_at DESC);
