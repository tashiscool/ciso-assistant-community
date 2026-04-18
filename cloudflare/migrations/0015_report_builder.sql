-- 0015_report_builder.sql
-- Canonical Regovise Report Builder persistence.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS report_builder_reports (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  title               TEXT NOT NULL,
  chart_type          TEXT NOT NULL,
  module_name         TEXT NOT NULL,
  owner               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'Draft',
  source              TEXT NOT NULL DEFAULT 'Report Builder',
  description         TEXT,
  config_json         TEXT NOT NULL,
  created_by_user_id  TEXT,
  updated_by_user_id  TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_report_builder_reports_tenant_updated
  ON report_builder_reports (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS report_builder_subscriptions (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  report_id        TEXT NOT NULL,
  recipient_email  TEXT NOT NULL,
  recipient_type   TEXT NOT NULL,
  start_date       TEXT NOT NULL,
  recurrence_type  TEXT NOT NULL,
  last_sent_at     TEXT,
  created_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_report_builder_subscriptions_report
  ON report_builder_subscriptions (report_id, created_at DESC);
