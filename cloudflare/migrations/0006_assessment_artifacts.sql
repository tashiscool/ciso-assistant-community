PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Domain event source tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS assessment_artifact_packages (
  tenant_id              TEXT    NOT NULL,
  package_id             TEXT    NOT NULL,
  name                   TEXT    NOT NULL DEFAULT '',
  description            TEXT    NOT NULL DEFAULT '',
  status                 TEXT    NOT NULL DEFAULT 'draft',       -- draft, active, archived
  package_type           TEXT    NOT NULL DEFAULT 'fedramp',
  system_name            TEXT    NOT NULL DEFAULT '',
  platform_tags_json     TEXT    NOT NULL DEFAULT '[]',
  stats_json             TEXT    NOT NULL DEFAULT '{}',
  collection_playbooks_json TEXT NOT NULL DEFAULT '[]',
  quality_report_json    TEXT    NOT NULL DEFAULT '{}',
  indexes_json           TEXT    NOT NULL DEFAULT '{}',
  source_file            TEXT    NOT NULL DEFAULT '',
  template_key           TEXT    NOT NULL DEFAULT '',
  created_at             TEXT    NOT NULL,
  updated_at             TEXT    NOT NULL,
  PRIMARY KEY (tenant_id, package_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_artifact_packages_status
  ON assessment_artifact_packages (tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS assessment_artifact_items (
  tenant_id              TEXT    NOT NULL,
  item_id                TEXT    NOT NULL,
  package_id             TEXT    NOT NULL,
  request_id             TEXT    NOT NULL DEFAULT '',
  source_line            INTEGER NOT NULL DEFAULT 0,
  category               TEXT    NOT NULL DEFAULT '',
  artifact_request       TEXT    NOT NULL DEFAULT '',
  controls_json          TEXT    NOT NULL DEFAULT '[]',
  control_families_json  TEXT    NOT NULL DEFAULT '[]',
  control_domains_json   TEXT    NOT NULL DEFAULT '[]',
  workstreams_json       TEXT    NOT NULL DEFAULT '[]',
  primary_artifact_type  TEXT    NOT NULL DEFAULT 'generic_evidence',
  artifact_types_json    TEXT    NOT NULL DEFAULT '[]',
  collection_channel     TEXT    NOT NULL DEFAULT 'manual_collection',
  platform_tags_json     TEXT    NOT NULL DEFAULT '[]',
  time_scopes_json       TEXT    NOT NULL DEFAULT '[]',
  periodicity            TEXT    NOT NULL DEFAULT 'on_demand',
  commands_json          TEXT    NOT NULL DEFAULT '[]',
  config_paths_json      TEXT    NOT NULL DEFAULT '[]',
  bundle_hint_json       TEXT    NOT NULL DEFAULT '{}',
  created_at             TEXT    NOT NULL,
  updated_at             TEXT    NOT NULL,
  PRIMARY KEY (tenant_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_artifact_items_package
  ON assessment_artifact_items (tenant_id, package_id);

CREATE TABLE IF NOT EXISTS assessment_artifact_schedules (
  tenant_id              TEXT    NOT NULL,
  schedule_id            TEXT    NOT NULL,
  package_id             TEXT    NOT NULL,
  name                   TEXT    NOT NULL DEFAULT '',
  description            TEXT    NOT NULL DEFAULT '',
  frequency              TEXT    NOT NULL DEFAULT 'monthly',
  status                 TEXT    NOT NULL DEFAULT 'active',
  cron_expression        TEXT    NOT NULL DEFAULT '',
  control_families_json  TEXT    NOT NULL DEFAULT '[]',
  controls_json          TEXT    NOT NULL DEFAULT '[]',
  evidence_types_json    TEXT    NOT NULL DEFAULT '[]',
  platform_tags_json     TEXT    NOT NULL DEFAULT '[]',
  collection_actions_json TEXT   NOT NULL DEFAULT '[]',
  items_count            INTEGER NOT NULL DEFAULT 0,
  created_at             TEXT    NOT NULL,
  updated_at             TEXT    NOT NULL,
  PRIMARY KEY (tenant_id, schedule_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_artifact_schedules_package
  ON assessment_artifact_schedules (tenant_id, package_id);

CREATE INDEX IF NOT EXISTS idx_assessment_artifact_schedules_frequency
  ON assessment_artifact_schedules (tenant_id, frequency, updated_at DESC);

-- ---------------------------------------------------------------------------
-- Read model projection table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rm_assessment_artifact_summary (
  tenant_id                   TEXT    NOT NULL,
  package_id                  TEXT    NOT NULL,
  name                        TEXT    NOT NULL DEFAULT '',
  status                      TEXT    NOT NULL DEFAULT 'draft',
  package_type                TEXT    NOT NULL DEFAULT 'fedramp',
  system_name                 TEXT    NOT NULL DEFAULT '',
  total_items                 INTEGER NOT NULL DEFAULT 0,
  schedule_count              INTEGER NOT NULL DEFAULT 0,
  platform_tags_json          TEXT    NOT NULL DEFAULT '[]',
  quality_gate                TEXT    NOT NULL DEFAULT 'pass',
  periodicity_breakdown_json  TEXT    NOT NULL DEFAULT '{}',
  updated_at                  TEXT    NOT NULL,
  PRIMARY KEY (tenant_id, package_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_assessment_artifact_summary_status
  ON rm_assessment_artifact_summary (tenant_id, status, updated_at DESC);
