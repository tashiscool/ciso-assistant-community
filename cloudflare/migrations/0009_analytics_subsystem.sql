PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS analytics_event_dedupe (
  tenant_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  domain TEXT NOT NULL,
  model_key TEXT,
  aggregate_id TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  event_time TEXT NOT NULL,
  ingest_time TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  raw_object_key TEXT,
  projected_at TEXT,
  processed_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_dedupe_tenant_time
  ON analytics_event_dedupe (tenant_id, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_event_dedupe_processed
  ON analytics_event_dedupe (processed_at DESC);

CREATE TABLE IF NOT EXISTS analytics_raw_shards (
  tenant_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  shard_key TEXT NOT NULL,
  bucket_hour_start TEXT NOT NULL,
  event_count INTEGER NOT NULL,
  first_event_time TEXT NOT NULL,
  last_event_time TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  flush_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, object_key)
);

CREATE INDEX IF NOT EXISTS idx_analytics_raw_shards_shard
  ON analytics_raw_shards (tenant_id, shard_key, bucket_hour_start DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_raw_shards_hour
  ON analytics_raw_shards (tenant_id, bucket_hour_start DESC);

CREATE TABLE IF NOT EXISTS analytics_rollup_1m_event_volume (
  tenant_id TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  event_type TEXT NOT NULL,
  total_events INTEGER NOT NULL DEFAULT 0,
  last_event_time TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, bucket_start, event_type)
);

CREATE INDEX IF NOT EXISTS idx_analytics_rollup_1m_bucket
  ON analytics_rollup_1m_event_volume (tenant_id, bucket_start DESC);

CREATE TABLE IF NOT EXISTS analytics_rollup_1h_event_volume (
  tenant_id TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  event_type TEXT NOT NULL,
  total_events INTEGER NOT NULL DEFAULT 0,
  last_event_time TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, bucket_start, event_type)
);

CREATE INDEX IF NOT EXISTS idx_analytics_rollup_1h_bucket
  ON analytics_rollup_1h_event_volume (tenant_id, bucket_start DESC);

CREATE TABLE IF NOT EXISTS analytics_rollup_1d_event_volume (
  tenant_id TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  event_type TEXT NOT NULL,
  total_events INTEGER NOT NULL DEFAULT 0,
  last_event_time TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, bucket_start, event_type)
);

CREATE INDEX IF NOT EXISTS idx_analytics_rollup_1d_bucket
  ON analytics_rollup_1d_event_volume (tenant_id, bucket_start DESC);

CREATE TABLE IF NOT EXISTS analytics_rollup_1d_domain_activity (
  tenant_id TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  domain TEXT NOT NULL,
  total_events INTEGER NOT NULL DEFAULT 0,
  last_event_time TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, bucket_start, domain)
);

CREATE INDEX IF NOT EXISTS idx_analytics_rollup_domain_bucket
  ON analytics_rollup_1d_domain_activity (tenant_id, bucket_start DESC, total_events DESC);

CREATE TABLE IF NOT EXISTS analytics_rollup_1d_source_health (
  tenant_id TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  source TEXT NOT NULL,
  total_events INTEGER NOT NULL DEFAULT 0,
  error_events INTEGER NOT NULL DEFAULT 0,
  last_event_time TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, bucket_start, source)
);

CREATE INDEX IF NOT EXISTS idx_analytics_rollup_source_bucket
  ON analytics_rollup_1d_source_health (tenant_id, bucket_start DESC, total_events DESC);

CREATE TABLE IF NOT EXISTS analytics_rollup_1d_model_activity (
  tenant_id TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  model_key TEXT NOT NULL,
  total_events INTEGER NOT NULL DEFAULT 0,
  last_event_time TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, bucket_start, model_key)
);

CREATE INDEX IF NOT EXISTS idx_analytics_rollup_model_bucket
  ON analytics_rollup_1d_model_activity (tenant_id, bucket_start DESC, total_events DESC);

CREATE TABLE IF NOT EXISTS analytics_checkpoints (
  checkpoint_key TEXT PRIMARY KEY,
  tenant_id TEXT,
  last_event_id TEXT,
  last_event_time TEXT,
  last_ingest_time TEXT,
  last_raw_object_key TEXT,
  stats_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_checkpoints_tenant
  ON analytics_checkpoints (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS analytics_rebuild_runs (
  rebuild_id TEXT PRIMARY KEY,
  tenant_id TEXT,
  status TEXT NOT NULL,
  source_prefix TEXT NOT NULL,
  cursor TEXT,
  replayed_events INTEGER NOT NULL DEFAULT 0,
  requested_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  error TEXT,
  notes_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_analytics_rebuild_runs_status
  ON analytics_rebuild_runs (status, requested_at DESC);
