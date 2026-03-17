PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS commands (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL,
  command_type TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  job_id TEXT NOT NULL,
  result_ref TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, command_type, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_commands_tenant_status
  ON commands (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_commands_job
  ON commands (job_id);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  result_ref TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_status
  ON jobs (tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS command_outbox (
  id TEXT PRIMARY KEY,
  command_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_payload_json TEXT NOT NULL,
  dispatch_status TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(command_id) REFERENCES commands(id)
);

CREATE INDEX IF NOT EXISTS idx_command_outbox_status
  ON command_outbox (dispatch_status, next_attempt_at, updated_at);

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_version INTEGER NOT NULL DEFAULT 1,
  tenant_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_domain_events_tenant_type
  ON domain_events (tenant_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate
  ON domain_events (aggregate_id, aggregate_version);

CREATE TABLE IF NOT EXISTS projection_checkpoints (
  projector_name TEXT PRIMARY KEY,
  last_event_id TEXT,
  last_occurred_at TEXT,
  updated_at TEXT NOT NULL
);
