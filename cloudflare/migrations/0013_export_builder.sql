-- 0013_export_builder.sql
-- Canonical Regovise Export Builder persistence.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS export_builder_exports (
  id                     TEXT PRIMARY KEY,
  tenant_id              TEXT NOT NULL,
  title                  TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'Inactive',
  module                 TEXT NOT NULL,
  export_group           TEXT NOT NULL,
  export_type            TEXT NOT NULL,
  description            TEXT,
  template_file_name     TEXT,
  template_analysis_json TEXT NOT NULL,
  mappings_json          TEXT NOT NULL,
  filter_rows_json       TEXT NOT NULL,
  filter_expression      TEXT,
  sub_templates_json     TEXT NOT NULL,
  source_template_id     TEXT,
  source_kind            TEXT NOT NULL DEFAULT 'custom',
  created_by_user_id     TEXT,
  updated_by_user_id     TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_export_builder_exports_tenant_updated
  ON export_builder_exports (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_export_builder_exports_tenant_status
  ON export_builder_exports (tenant_id, status);

CREATE TABLE IF NOT EXISTS export_builder_test_runs (
  id                  TEXT PRIMARY KEY,
  export_id           TEXT NOT NULL,
  tenant_id           TEXT NOT NULL,
  scenario_name       TEXT NOT NULL,
  status              TEXT NOT NULL,
  result_json         TEXT NOT NULL,
  created_by_user_id  TEXT,
  created_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_export_builder_test_runs_export_created
  ON export_builder_test_runs (export_id, created_at DESC);
