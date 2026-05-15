CREATE TABLE IF NOT EXISTS grc_job_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  source_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  request_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT NOT NULL DEFAULT '{}',
  diagnostics_json TEXT NOT NULL DEFAULT '[]',
  artifact_key TEXT,
  created_by_user_id TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grc_ingest_payloads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  created_by_user_id TEXT,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grc_metric_catalog (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  source_kind TEXT NOT NULL DEFAULT 'import',
  dimensions_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, metric_key)
);

CREATE TABLE IF NOT EXISTS grc_metric_points (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  metric_id TEXT NOT NULL REFERENCES grc_metric_catalog(id) ON DELETE CASCADE,
  measured_at TEXT NOT NULL,
  numeric_value REAL NOT NULL,
  dimensions_json TEXT NOT NULL DEFAULT '{}',
  source_ref TEXT,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grc_exception_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  severity TEXT,
  owner_name TEXT,
  due_date TEXT,
  raw_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, source_type, source_ref)
);

CREATE TABLE IF NOT EXISTS grc_evidence_packages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  assessment_id TEXT REFERENCES grc_gap_assessments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  artifact_key TEXT,
  manifest_json TEXT NOT NULL DEFAULT '{}',
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grc_report_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  report_kind TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  ai_provider TEXT,
  source_scope_json TEXT NOT NULL DEFAULT '{}',
  artifact_key TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}',
  content_markdown TEXT NOT NULL DEFAULT '',
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_grc_job_runs_tenant
  ON grc_job_runs (tenant_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_grc_job_runs_status
  ON grc_job_runs (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_grc_ingest_payloads_tenant
  ON grc_ingest_payloads (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_grc_metric_catalog_tenant
  ON grc_metric_catalog (tenant_id, metric_key);

CREATE INDEX IF NOT EXISTS idx_grc_metric_points_metric
  ON grc_metric_points (tenant_id, metric_id, measured_at DESC);

CREATE INDEX IF NOT EXISTS idx_grc_exception_snapshots_tenant
  ON grc_exception_snapshots (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_grc_evidence_packages_tenant
  ON grc_evidence_packages (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_grc_report_snapshots_tenant
  ON grc_report_snapshots (tenant_id, created_at DESC);
