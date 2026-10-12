CREATE TABLE IF NOT EXISTS queue_dead_letters (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  original_queue TEXT NOT NULL,
  dead_letter_queue TEXT NOT NULL,
  message_type TEXT NOT NULL,
  message_id TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  payload_r2_key TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'replaying', 'replayed', 'replay_failed')),
  replay_count INTEGER NOT NULL DEFAULT 0,
  last_replay_error TEXT,
  captured_at TEXT NOT NULL,
  replayed_at TEXT,
  replayed_by_user_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_queue_dead_letters_tenant_status_captured
  ON queue_dead_letters (tenant_id, status, captured_at DESC);

CREATE TABLE IF NOT EXISTS queue_dead_letter_events (
  id TEXT PRIMARY KEY,
  dead_letter_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('captured', 'replay_started', 'replayed', 'replay_failed')),
  actor_user_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (dead_letter_id) REFERENCES queue_dead_letters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_queue_dead_letter_events_dead_letter_created
  ON queue_dead_letter_events (dead_letter_id, created_at ASC);
