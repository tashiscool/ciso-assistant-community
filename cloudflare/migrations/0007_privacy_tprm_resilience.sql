-- 0007_privacy_tprm_resilience.sql
-- Third-party, privacy, and resilience migration baseline.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS entities (
  id                        TEXT PRIMARY KEY,
  tenant_id                 TEXT NOT NULL,
  folder_id                 TEXT NOT NULL,
  parent_entity_id          TEXT,
  ref_id                    TEXT,
  name                      TEXT NOT NULL,
  description               TEXT,
  relationship              TEXT,
  country                   TEXT,
  currency                  TEXT,
  is_active                 INTEGER NOT NULL DEFAULT 1,
  default_dependency        INTEGER NOT NULL DEFAULT 0,
  default_penetration       INTEGER NOT NULL DEFAULT 0,
  default_maturity          INTEGER NOT NULL DEFAULT 1,
  default_trust             INTEGER NOT NULL DEFAULT 1,
  mission                   TEXT,
  reference_link            TEXT,
  dora_entity_type          TEXT,
  dora_entity_hierarchy     TEXT,
  dora_provider_person_type TEXT,
  created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, name),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_entity_id) REFERENCES entities(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_entities_tenant_folder
  ON entities (tenant_id, folder_id);

CREATE TABLE IF NOT EXISTS solutions (
  id                               TEXT PRIMARY KEY,
  tenant_id                        TEXT NOT NULL,
  folder_id                        TEXT NOT NULL,
  provider_entity_id               TEXT NOT NULL,
  recipient_entity_name            TEXT,
  ref_id                           TEXT,
  name                             TEXT NOT NULL,
  description                      TEXT,
  is_active                        INTEGER NOT NULL DEFAULT 1,
  criticality                      INTEGER NOT NULL DEFAULT 0,
  reference_link                   TEXT,
  dora_ict_service_type            TEXT,
  storage_of_data                  INTEGER NOT NULL DEFAULT 0,
  data_location_storage            TEXT,
  data_location_processing         TEXT,
  dora_data_sensitiveness          TEXT,
  dora_reliance_level              TEXT,
  dora_substitutability            TEXT,
  dora_non_substitutability_reason TEXT,
  dora_has_exit_plan               TEXT,
  dora_reintegration_possibility   TEXT,
  dora_discontinuing_impact        TEXT,
  dora_alternative_providers       TEXT,
  asset_refs_json                  TEXT NOT NULL DEFAULT '[]',
  created_at                       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at                       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_solutions_tenant_provider
  ON solutions (tenant_id, provider_entity_id);

CREATE TABLE IF NOT EXISTS contracts (
  id                           TEXT PRIMARY KEY,
  tenant_id                    TEXT NOT NULL,
  folder_id                    TEXT NOT NULL,
  provider_entity_id           TEXT NOT NULL,
  beneficiary_entity_id        TEXT,
  ref_id                       TEXT,
  name                         TEXT NOT NULL,
  description                  TEXT,
  status                       TEXT NOT NULL DEFAULT 'draft',
  start_date                   TEXT,
  end_date                     TEXT,
  currency                     TEXT,
  annual_expense               REAL,
  is_intragroup                INTEGER NOT NULL DEFAULT 0,
  dora_contractual_arrangement TEXT,
  governing_law_country        TEXT,
  notice_period_entity         INTEGER,
  notice_period_provider       INTEGER,
  dora_exclude                 INTEGER NOT NULL DEFAULT 0,
  solutions_json               TEXT NOT NULL DEFAULT '[]',
  created_at                   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at                   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_entity_id) REFERENCES entities(id) ON DELETE CASCADE,
  FOREIGN KEY (beneficiary_entity_id) REFERENCES entities(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_contracts_tenant_provider
  ON contracts (tenant_id, provider_entity_id);

CREATE TABLE IF NOT EXISTS entity_assessments (
  id                        TEXT PRIMARY KEY,
  tenant_id                 TEXT NOT NULL,
  folder_id                 TEXT NOT NULL,
  entity_id                 TEXT NOT NULL,
  perimeter_id              TEXT,
  compliance_assessment_id  TEXT,
  ref_id                    TEXT,
  name                      TEXT NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'planned',
  criticality               REAL NOT NULL DEFAULT 0,
  dependency                INTEGER NOT NULL DEFAULT 0,
  penetration               INTEGER NOT NULL DEFAULT 0,
  maturity                  INTEGER NOT NULL DEFAULT 1,
  trust                     INTEGER NOT NULL DEFAULT 1,
  conclusion                TEXT,
  next_review_on            TEXT,
  notes                     TEXT,
  created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
  FOREIGN KEY (perimeter_id) REFERENCES perimeters(id) ON DELETE SET NULL,
  FOREIGN KEY (compliance_assessment_id) REFERENCES compliance_assessments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_entity_assessments_tenant_entity
  ON entity_assessments (tenant_id, entity_id);

CREATE TABLE IF NOT EXISTS processings (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL,
  folder_id             TEXT NOT NULL,
  ref_id                TEXT,
  name                  TEXT NOT NULL,
  description           TEXT,
  status                TEXT NOT NULL DEFAULT 'privacy_draft',
  information_channel   TEXT,
  usage_channel         TEXT,
  dpia_required         INTEGER NOT NULL DEFAULT 0,
  dpia_reference        TEXT,
  has_sensitive_personal_data INTEGER NOT NULL DEFAULT 0,
  perimeters_json       TEXT NOT NULL DEFAULT '[]',
  purposes_json         TEXT NOT NULL DEFAULT '[]',
  personal_data_json    TEXT NOT NULL DEFAULT '[]',
  data_subjects_json    TEXT NOT NULL DEFAULT '[]',
  data_recipients_json  TEXT NOT NULL DEFAULT '[]',
  data_contractors_json TEXT NOT NULL DEFAULT '[]',
  data_transfers_json   TEXT NOT NULL DEFAULT '[]',
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_processings_tenant_folder
  ON processings (tenant_id, folder_id);

CREATE TABLE IF NOT EXISTS right_requests (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  folder_id         TEXT NOT NULL,
  ref_id            TEXT,
  name              TEXT NOT NULL,
  requested_on      TEXT NOT NULL,
  due_date          TEXT,
  request_type      TEXT NOT NULL DEFAULT 'other',
  status            TEXT NOT NULL DEFAULT 'new',
  observation       TEXT,
  processings_json  TEXT NOT NULL DEFAULT '[]',
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_right_requests_tenant_folder
  ON right_requests (tenant_id, folder_id);

CREATE TABLE IF NOT EXISTS data_breaches (
  id                           TEXT PRIMARY KEY,
  tenant_id                    TEXT NOT NULL,
  folder_id                    TEXT NOT NULL,
  ref_id                       TEXT,
  name                         TEXT NOT NULL,
  discovered_on                TEXT NOT NULL,
  breach_type                  TEXT NOT NULL DEFAULT 'privacy_other',
  risk_level                   TEXT NOT NULL DEFAULT 'privacy_risk',
  status                       TEXT NOT NULL DEFAULT 'privacy_discovered',
  affected_subjects_count      INTEGER NOT NULL DEFAULT 0,
  affected_personal_data_count INTEGER NOT NULL DEFAULT 0,
  affected_processings_json    TEXT NOT NULL DEFAULT '[]',
  authority_notified_on        TEXT,
  subjects_notified_on         TEXT,
  potential_consequences       TEXT,
  observation                  TEXT,
  created_at                   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at                   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_data_breaches_tenant_folder
  ON data_breaches (tenant_id, folder_id);

CREATE TABLE IF NOT EXISTS business_impact_analyses (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL,
  folder_id             TEXT NOT NULL,
  perimeter_id          TEXT,
  ref_id                TEXT,
  name                  TEXT NOT NULL,
  description           TEXT,
  version               TEXT NOT NULL DEFAULT '1.0',
  status                TEXT NOT NULL DEFAULT 'planned',
  observation           TEXT,
  risk_matrix_name      TEXT,
  risk_matrix_json      TEXT NOT NULL DEFAULT '{}',
  asset_assessments_json TEXT NOT NULL DEFAULT '[]',
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  FOREIGN KEY (perimeter_id) REFERENCES perimeters(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bia_tenant_folder
  ON business_impact_analyses (tenant_id, folder_id);
