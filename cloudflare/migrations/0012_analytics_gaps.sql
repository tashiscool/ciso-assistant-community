PRAGMA foreign_keys = ON;

-- ============================================================================
-- Gap A: Hourly rollup tables for domain, source, and model activity.
-- The minute and daily event-volume rollups already existed, but per-domain,
-- per-source, and per-model rollups were only at 1d grain.  Adding 1h grain
-- lets dashboards show intra-day trends without scanning raw events.
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_rollup_1h_domain_activity (
  tenant_id TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  domain TEXT NOT NULL,
  total_events INTEGER NOT NULL DEFAULT 0,
  last_event_time TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, bucket_start, domain)
);

CREATE INDEX IF NOT EXISTS idx_analytics_rollup_1h_domain_bucket
  ON analytics_rollup_1h_domain_activity (tenant_id, bucket_start DESC, total_events DESC);

CREATE TABLE IF NOT EXISTS analytics_rollup_1h_source_health (
  tenant_id TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  source TEXT NOT NULL,
  total_events INTEGER NOT NULL DEFAULT 0,
  error_events INTEGER NOT NULL DEFAULT 0,
  last_event_time TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, bucket_start, source)
);

CREATE INDEX IF NOT EXISTS idx_analytics_rollup_1h_source_bucket
  ON analytics_rollup_1h_source_health (tenant_id, bucket_start DESC, total_events DESC);

CREATE TABLE IF NOT EXISTS analytics_rollup_1h_model_activity (
  tenant_id TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  model_key TEXT NOT NULL,
  total_events INTEGER NOT NULL DEFAULT 0,
  last_event_time TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, bucket_start, model_key)
);

CREATE INDEX IF NOT EXISTS idx_analytics_rollup_1h_model_bucket
  ON analytics_rollup_1h_model_activity (tenant_id, bucket_start DESC, total_events DESC);

-- ============================================================================
-- Gap E: Dead letter queue tracking table.
-- All workers produce to dead-letter-q, but nothing consumed or tracked them.
-- This table persists DLQ entries for inspection, retry, and metrics.
-- ============================================================================

CREATE TABLE IF NOT EXISTS dead_letter_entries (
  id TEXT PRIMARY KEY,
  source_queue TEXT NOT NULL,
  tenant_id TEXT,
  event_type TEXT,
  error TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'pending',
  first_failed_at TEXT NOT NULL,
  last_failed_at TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_entries_status
  ON dead_letter_entries (status, source_queue, last_failed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dead_letter_entries_queue
  ON dead_letter_entries (source_queue, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dead_letter_entries_tenant
  ON dead_letter_entries (tenant_id, status, created_at DESC);
