-- Donation status is intentionally absent from service eligibility and scheduling.
CREATE TABLE IF NOT EXISTS service_cases (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  request_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('submitted','in_progress','prepared','approved','handed_off','resolved','cancelled','failed')),
  version INTEGER NOT NULL DEFAULT 1,
  prepared_artifact_id TEXT,
  approved_artifact_id TEXT,
  handoff_artifact_id TEXT,
  assigned_to TEXT,
  follow_up_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(app_id, tenant_id, owner_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS service_cases_owner ON service_cases(app_id, tenant_id, owner_id, created_at);
CREATE INDEX IF NOT EXISTS service_cases_followup ON service_cases(app_id, status, follow_up_at);

CREATE TABLE IF NOT EXISTS service_case_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES service_cases(id),
  version INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  artifact_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(case_id, version)
);
CREATE TABLE IF NOT EXISTS service_artifacts (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES service_cases(id),
  kind TEXT NOT NULL CHECK(kind IN ('intake_receipt','prepared_work','handoff_receipt')),
  object_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS service_costs (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES service_cases(id),
  category TEXT NOT NULL CHECK(category IN ('compute','review','support','provider','infrastructure')),
  amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0),
  currency TEXT NOT NULL CHECK(length(currency) = 3),
  source_reference TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(case_id, source_reference)
);
CREATE TABLE IF NOT EXISTS service_outbox (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES service_cases(id),
  app_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('intake','follow_up')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','completed','dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL,
  published_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS service_outbox_recovery ON service_outbox(app_id, status, available_at);

CREATE TABLE IF NOT EXISTS service_donations (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  donor_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
  currency TEXT NOT NULL CHECK(currency = 'usd'),
  status TEXT NOT NULL CHECK(status IN ('pending','succeeded','expired')),
  checkout_id TEXT UNIQUE,
  checkout_url TEXT,
  payment_reference TEXT UNIQUE,
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  UNIQUE(app_id, tenant_id, donor_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS service_donation_events (
  provider_event_id TEXT PRIMARY KEY,
  donation_id TEXT NOT NULL REFERENCES service_donations(id),
  event_type TEXT NOT NULL,
  received_at TEXT NOT NULL
);
