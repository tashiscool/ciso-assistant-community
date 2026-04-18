-- 0011_integrations_connectors.sql
-- Canonical Regovise connector and automation-manager persistence.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS integration_connectors (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  name                TEXT NOT NULL,
  provider            TEXT NOT NULL,
  category            TEXT NOT NULL,
  auth_mode           TEXT NOT NULL,
  base_url            TEXT,
  status              TEXT NOT NULL DEFAULT 'configured',
  is_enabled          INTEGER NOT NULL DEFAULT 1,
  config_json         TEXT NOT NULL,
  capabilities_json   TEXT NOT NULL,
  last_test_json      TEXT,
  last_sync_json      TEXT,
  last_error          TEXT,
  created_by_user_id  TEXT,
  updated_by_user_id  TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_integration_connectors_tenant_provider
  ON integration_connectors (tenant_id, provider, updated_at DESC);

CREATE TABLE IF NOT EXISTS integration_connector_runs (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL,
  connector_id          TEXT NOT NULL,
  action_type           TEXT NOT NULL,
  status                TEXT NOT NULL,
  summary_json          TEXT NOT NULL,
  started_at            TEXT NOT NULL,
  finished_at           TEXT,
  triggered_by_user_id  TEXT,
  FOREIGN KEY (connector_id) REFERENCES integration_connectors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_integration_connector_runs_connector
  ON integration_connector_runs (tenant_id, connector_id, started_at DESC);
