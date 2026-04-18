-- 0002_conmon_evidence.sql
-- D1 schema for Continuous Monitoring (ConMon) and Evidence Automation primitives.

PRAGMA foreign_keys = ON;

-- ConMon: profiles, activity configs, executions, metrics

CREATE TABLE IF NOT EXISTS conmon_profiles (
  id             TEXT PRIMARY KEY,            -- uuid
  tenant_id      TEXT NOT NULL,
  name           TEXT NOT NULL,
  description    TEXT,
  profile_type   TEXT NOT NULL,               -- e.g. fedramp_conmon, iso_internal
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conmon_activity_configs (
  id             TEXT PRIMARY KEY,            -- uuid
  tenant_id      TEXT NOT NULL,
  profile_id     TEXT NOT NULL,
  name           TEXT NOT NULL,
  description    TEXT,
  cadence        TEXT NOT NULL,               -- daily, weekly, monthly, event_driven, etc.
  theme          TEXT,                        -- reporting, alerts_triage, change_governance, vuln_mgmt, etc.
  control_ref    TEXT,                        -- e.g. FedRAMP control id(s)
  config_json    TEXT NOT NULL,               -- connector / query / filter details
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES conmon_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conmon_executions (
  id             TEXT PRIMARY KEY,            -- uuid
  tenant_id      TEXT NOT NULL,
  profile_id     TEXT NOT NULL,
  activity_id    TEXT NOT NULL,
  started_at     TEXT NOT NULL,
  finished_at    TEXT,
  status         TEXT NOT NULL,               -- pending, running, success, failed, partial
  status_detail  TEXT,
  metrics_json   TEXT,                        -- summary metrics payload
  raw_stats_json TEXT,                        -- connector/raw stats if needed
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES conmon_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (activity_id) REFERENCES conmon_activity_configs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conmon_metrics (
  id             TEXT PRIMARY KEY,            -- uuid
  tenant_id      TEXT NOT NULL,
  profile_id     TEXT NOT NULL,
  execution_id   TEXT NOT NULL,
  metric_key     TEXT NOT NULL,               -- e.g. open_findings, ksis_met, alerts_triaged
  metric_value   REAL NOT NULL,
  recorded_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES conmon_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (execution_id) REFERENCES conmon_executions(id) ON DELETE CASCADE
);

-- Evidence Automation: sources, jobs, artifacts

CREATE TABLE IF NOT EXISTS evidence_sources (
  id             TEXT PRIMARY KEY,            -- uuid
  tenant_id      TEXT NOT NULL,
  name           TEXT NOT NULL,
  provider       TEXT NOT NULL,               -- wiz, snyk, github, custom_http, etc.
  config_json    TEXT NOT NULL,               -- credentials, queries, scopes (encrypted externally)
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evidence_jobs (
  id             TEXT PRIMARY KEY,            -- uuid
  tenant_id      TEXT NOT NULL,
  source_id      TEXT NOT NULL,
  scheduled_for  TEXT NOT NULL,
  started_at     TEXT,
  finished_at    TEXT,
  status         TEXT NOT NULL DEFAULT 'pending', -- pending, running, success, failed
  status_detail  TEXT,
  last_cursor    TEXT,                        -- pagination / bookmark for provider
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES evidence_sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evidence_artifacts (
  id             TEXT PRIMARY KEY,            -- uuid
  tenant_id      TEXT NOT NULL,
  job_id         TEXT NOT NULL,
  object_key     TEXT NOT NULL,               -- R2 key: tenant/category/uuid
  content_type   TEXT,
  size_bytes     INTEGER,
  checksum       TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES evidence_jobs(id) ON DELETE CASCADE
);

