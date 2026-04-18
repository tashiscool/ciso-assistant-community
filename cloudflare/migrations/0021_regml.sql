CREATE TABLE IF NOT EXISTS regml_settings (
  tenant_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  terms_accepted INTEGER NOT NULL DEFAULT 0,
  deployment_mode TEXT NOT NULL DEFAULT 'SaaS',
  backend_available INTEGER NOT NULL DEFAULT 1,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS regml_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  prompt_mode TEXT NOT NULL DEFAULT 'Build',
  source_set TEXT NOT NULL,
  credits_quota INTEGER NOT NULL DEFAULT 120,
  credits_remaining INTEGER NOT NULL DEFAULT 120,
  low_credit_banner_dismissed INTEGER NOT NULL DEFAULT 0,
  selected_attempt_id TEXT,
  streaming INTEGER NOT NULL DEFAULT 0,
  queue_depth INTEGER NOT NULL DEFAULT 0,
  last_heartbeat TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, mode)
);

CREATE TABLE IF NOT EXISTS regml_attempts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  version_label TEXT NOT NULL,
  title TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  before_items_json TEXT NOT NULL,
  after_items_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  coverage INTEGER NOT NULL,
  confidence INTEGER NOT NULL,
  nodes_changed INTEGER NOT NULL,
  credits_cost INTEGER NOT NULL,
  issues INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  applied_at TEXT,
  FOREIGN KEY (session_id) REFERENCES regml_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_regml_attempts_tenant_mode_created
  ON regml_attempts (tenant_id, mode, created_at DESC);

CREATE TABLE IF NOT EXISTS regml_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  role TEXT NOT NULL,
  message_type TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES regml_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_regml_messages_tenant_mode_created
  ON regml_messages (tenant_id, mode, created_at ASC);
