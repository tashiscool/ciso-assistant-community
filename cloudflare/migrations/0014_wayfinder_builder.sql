-- 0014_wayfinder_builder.sql
-- Canonical Regovise Wayfinder Builder persistence.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS wayfinder_templates (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  title               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'Draft',
  owner               TEXT NOT NULL,
  creator             TEXT NOT NULL,
  description         TEXT,
  stages_json         TEXT NOT NULL,
  created_by_user_id  TEXT,
  updated_by_user_id  TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wayfinder_templates_tenant_updated
  ON wayfinder_templates (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_wayfinder_templates_tenant_status
  ON wayfinder_templates (tenant_id, status);
