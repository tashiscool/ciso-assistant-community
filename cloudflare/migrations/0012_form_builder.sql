-- 0012_form_builder.sql
-- Canonical Regovise Form Builder persistence.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS form_builder_modules (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  module_key          TEXT NOT NULL,
  module_name         TEXT NOT NULL,
  plural_name         TEXT NOT NULL,
  tab_sort            TEXT NOT NULL DEFAULT 'manual',
  status              TEXT NOT NULL DEFAULT 'draft',
  description         TEXT,
  sections_json       TEXT NOT NULL,
  rules_json          TEXT NOT NULL,
  created_by_user_id  TEXT,
  updated_by_user_id  TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_form_builder_modules_tenant_key
  ON form_builder_modules (tenant_id, module_key);

CREATE INDEX IF NOT EXISTS idx_form_builder_modules_tenant_updated
  ON form_builder_modules (tenant_id, updated_at DESC);
