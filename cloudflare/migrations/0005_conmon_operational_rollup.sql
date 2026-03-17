PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rm_conmon_operational_rollup (
  tenant_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  rollup_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_conmon_operational_rollup_status
  ON rm_conmon_operational_rollup (tenant_id, status, updated_at DESC);
