-- 0016_dashboard_builder.sql
-- Canonical Regovise Dashboard Builder persistence.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS dashboard_builder_dashboards (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  title               TEXT NOT NULL,
  access_level        TEXT NOT NULL,
  group_assignments   TEXT NOT NULL,
  favorite            INTEGER NOT NULL DEFAULT 0,
  published           INTEGER NOT NULL DEFAULT 0,
  items_json          TEXT NOT NULL,
  layout_json         TEXT NOT NULL,
  created_by_user_id  TEXT,
  updated_by_user_id  TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dashboard_builder_dashboards_tenant_updated
  ON dashboard_builder_dashboards (tenant_id, updated_at DESC);
