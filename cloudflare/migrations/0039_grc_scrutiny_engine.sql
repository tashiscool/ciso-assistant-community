-- 0039_grc_scrutiny_engine.sql
-- First-class assessor scrutiny workflow: controls -> questions -> evidence requests -> sufficiency review.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS grc_scrutiny_patterns (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL,
  source             TEXT NOT NULL,
  source_ref         TEXT,
  control_ref        TEXT NOT NULL,
  scf_control_id     TEXT,
  question_prompt    TEXT NOT NULL,
  evidence_type      TEXT NOT NULL DEFAULT 'Other',
  evidence_hint      TEXT,
  priority           INTEGER NOT NULL DEFAULT 0,
  metadata_json      TEXT NOT NULL DEFAULT '{}',
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_grc_scrutiny_patterns_unique
  ON grc_scrutiny_patterns (tenant_id, source, source_ref, control_ref, question_prompt);

CREATE INDEX IF NOT EXISTS idx_grc_scrutiny_patterns_control
  ON grc_scrutiny_patterns (tenant_id, control_ref, source, priority DESC);

CREATE TABLE IF NOT EXISTS grc_scrutiny_runs (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL,
  folder_id          TEXT,
  title              TEXT NOT NULL,
  mode               TEXT NOT NULL DEFAULT 'draft',
  status             TEXT NOT NULL DEFAULT 'draft',
  scope_json         TEXT NOT NULL DEFAULT '{}',
  source_summary_json TEXT NOT NULL DEFAULT '{}',
  metrics_json       TEXT NOT NULL DEFAULT '{}',
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_grc_scrutiny_runs_tenant_updated
  ON grc_scrutiny_runs (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_grc_scrutiny_runs_folder
  ON grc_scrutiny_runs (tenant_id, folder_id, status);

CREATE TABLE IF NOT EXISTS grc_scrutiny_items (
  id                   TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL,
  run_id               TEXT NOT NULL,
  pattern_id           TEXT,
  control_ref          TEXT NOT NULL,
  question_prompt      TEXT NOT NULL,
  evidence_type        TEXT NOT NULL DEFAULT 'Other',
  evidence_request     TEXT NOT NULL,
  evidence_hint        TEXT,
  sufficiency_state    TEXT NOT NULL DEFAULT 'draft',
  owner_user_id        TEXT,
  data_call_record_id  TEXT,
  evidence_record_ids_json TEXT NOT NULL DEFAULT '[]',
  coverage_json        TEXT NOT NULL DEFAULT '{}',
  reviewer_challenge   INTEGER NOT NULL DEFAULT 0,
  missing_feed         INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (run_id) REFERENCES grc_scrutiny_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (pattern_id) REFERENCES grc_scrutiny_patterns(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_grc_scrutiny_items_run
  ON grc_scrutiny_items (tenant_id, run_id, sufficiency_state);

CREATE INDEX IF NOT EXISTS idx_grc_scrutiny_items_control
  ON grc_scrutiny_items (tenant_id, control_ref, sufficiency_state);

CREATE TABLE IF NOT EXISTS grc_scrutiny_comment_events (
  id                       TEXT PRIMARY KEY,
  tenant_id                TEXT NOT NULL,
  run_id                   TEXT NOT NULL,
  item_id                  TEXT NOT NULL,
  event_type               TEXT NOT NULL,
  author                   TEXT NOT NULL,
  body                     TEXT NOT NULL,
  source                   TEXT NOT NULL DEFAULT 'manual',
  related_evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  previous_state           TEXT,
  next_state               TEXT,
  classifier_json          TEXT NOT NULL DEFAULT '{}',
  created_by_user_id       TEXT,
  created_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (run_id) REFERENCES grc_scrutiny_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES grc_scrutiny_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_grc_scrutiny_comment_events_item
  ON grc_scrutiny_comment_events (tenant_id, item_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_grc_scrutiny_comment_events_run
  ON grc_scrutiny_comment_events (tenant_id, run_id, created_at ASC);

CREATE TABLE IF NOT EXISTS grc_scrutiny_materialized_links (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  run_id         TEXT NOT NULL,
  item_id        TEXT NOT NULL,
  target_module  TEXT NOT NULL,
  target_id      TEXT NOT NULL,
  relation_type  TEXT NOT NULL DEFAULT 'materialized_record',
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (run_id) REFERENCES grc_scrutiny_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES grc_scrutiny_items(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_grc_scrutiny_materialized_links_unique
  ON grc_scrutiny_materialized_links (tenant_id, item_id, target_module, target_id, relation_type);

UPDATE setup_modules_features
SET feature_flags_json =
  CASE
    WHEN instr(feature_flags_json, '"grc_scrutiny_engine"') > 0 THEN feature_flags_json
    WHEN json_valid(feature_flags_json) AND json_array_length(feature_flags_json) = 0 THEN '["grc_scrutiny_engine"]'
    WHEN json_valid(feature_flags_json) THEN substr(feature_flags_json, 1, length(feature_flags_json) - 1) || ',"grc_scrutiny_engine"]'
    ELSE '["grc_scrutiny_engine"]'
  END,
  updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
WHERE tenant_id IN (SELECT id FROM tenants WHERE slug = 'fedhr');
