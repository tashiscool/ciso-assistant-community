PRAGMA foreign_keys = ON;

-- ===========================================================================
-- Migration 0011: Full Domain Tables
-- ===========================================================================
-- Creates all remaining domain tables for the GRC platform.
-- Every table uses composite PK (tenant_id, id) unless noted otherwise.
-- TEXT for most fields, INTEGER for counts, JSON stored as TEXT with
-- DEFAULT '[]' or '{}'. All tables carry created_at / updated_at TEXT NOT NULL.
-- ===========================================================================


-- ===========================================================================
-- 1. CORE GRC (prefix: grc_)
-- ===========================================================================

-- ---- Folders ----
CREATE TABLE IF NOT EXISTS grc_folders (
  tenant_id     TEXT NOT NULL,
  id            TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  parent_id     TEXT,
  content_type  TEXT NOT NULL DEFAULT '',
  icon_name     TEXT NOT NULL DEFAULT '',
  "order"       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_folders_parent
  ON grc_folders (tenant_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_grc_folders_content_type
  ON grc_folders (tenant_id, content_type);

-- ---- Frameworks ----
CREATE TABLE IF NOT EXISTS grc_frameworks (
  tenant_id                          TEXT NOT NULL,
  id                                 TEXT NOT NULL,
  ref_id                             TEXT NOT NULL DEFAULT '',
  name                               TEXT NOT NULL DEFAULT '',
  description                        TEXT NOT NULL DEFAULT '',
  urn                                TEXT,
  provider                           TEXT NOT NULL DEFAULT '',
  locale                             TEXT NOT NULL DEFAULT 'en',
  default_locale                     INTEGER NOT NULL DEFAULT 1,
  min_score                          INTEGER NOT NULL DEFAULT 0,
  max_score                          INTEGER NOT NULL DEFAULT 100,
  scores_definition_json             TEXT NOT NULL DEFAULT '{}',
  implementation_groups_definition_json TEXT NOT NULL DEFAULT '{}',
  created_at                         TEXT NOT NULL,
  updated_at                         TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_frameworks_status
  ON grc_frameworks (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_grc_frameworks_urn
  ON grc_frameworks (tenant_id, urn);

-- ---- Requirement Nodes ----
CREATE TABLE IF NOT EXISTS grc_requirement_nodes (
  tenant_id                TEXT NOT NULL,
  id                       TEXT NOT NULL,
  framework_id             TEXT NOT NULL,
  ref_id                   TEXT NOT NULL DEFAULT '',
  name                     TEXT NOT NULL DEFAULT '',
  description              TEXT NOT NULL DEFAULT '',
  parent_urn               TEXT,
  urn                      TEXT,
  level                    INTEGER NOT NULL DEFAULT 0,
  "order"                  INTEGER NOT NULL DEFAULT 0,
  assessable               INTEGER NOT NULL DEFAULT 0,
  implementation_groups_json TEXT NOT NULL DEFAULT '[]',
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_requirement_nodes_framework
  ON grc_requirement_nodes (tenant_id, framework_id);

CREATE INDEX IF NOT EXISTS idx_grc_requirement_nodes_urn
  ON grc_requirement_nodes (tenant_id, urn);

CREATE INDEX IF NOT EXISTS idx_grc_requirement_nodes_parent
  ON grc_requirement_nodes (tenant_id, parent_urn);

-- ---- Reference Controls ----
CREATE TABLE IF NOT EXISTS grc_reference_controls (
  tenant_id     TEXT NOT NULL,
  id            TEXT NOT NULL,
  ref_id        TEXT NOT NULL DEFAULT '',
  name          TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  urn           TEXT,
  provider      TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT '',
  csf_function  TEXT NOT NULL DEFAULT '',
  annotation    TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_reference_controls_urn
  ON grc_reference_controls (tenant_id, urn);

CREATE INDEX IF NOT EXISTS idx_grc_reference_controls_category
  ON grc_reference_controls (tenant_id, category);

-- ---- Applied Controls ----
CREATE TABLE IF NOT EXISTS grc_applied_controls (
  tenant_id            TEXT NOT NULL,
  id                   TEXT NOT NULL,
  ref_id               TEXT NOT NULL DEFAULT '',
  name                 TEXT NOT NULL DEFAULT '',
  description          TEXT NOT NULL DEFAULT '',
  category             TEXT NOT NULL DEFAULT '',
  csf_function         TEXT NOT NULL DEFAULT '',
  status               TEXT NOT NULL DEFAULT '',
  priority             TEXT NOT NULL DEFAULT '',
  effort               TEXT NOT NULL DEFAULT '',
  cost                 TEXT NOT NULL DEFAULT '',
  eta                  TEXT,
  expiry_date          TEXT,
  link                 TEXT NOT NULL DEFAULT '',
  reference_control_id TEXT,
  folder_id            TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_applied_controls_status
  ON grc_applied_controls (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_grc_applied_controls_folder
  ON grc_applied_controls (tenant_id, folder_id);

-- ---- Policies ----
CREATE TABLE IF NOT EXISTS grc_policies (
  tenant_id            TEXT NOT NULL,
  id                   TEXT NOT NULL,
  ref_id               TEXT NOT NULL DEFAULT '',
  name                 TEXT NOT NULL DEFAULT '',
  description          TEXT NOT NULL DEFAULT '',
  status               TEXT NOT NULL DEFAULT '',
  priority             TEXT NOT NULL DEFAULT '',
  effort               TEXT NOT NULL DEFAULT '',
  eta                  TEXT,
  expiry_date          TEXT,
  link                 TEXT NOT NULL DEFAULT '',
  reference_control_id TEXT,
  folder_id            TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_policies_status
  ON grc_policies (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_grc_policies_folder
  ON grc_policies (tenant_id, folder_id);

-- ---- Risk Matrices ----
CREATE TABLE IF NOT EXISTS grc_risk_matrices (
  tenant_id       TEXT NOT NULL,
  id              TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  urn             TEXT,
  provider        TEXT NOT NULL DEFAULT '',
  json_definition TEXT NOT NULL DEFAULT '{}',
  is_enabled      INTEGER NOT NULL DEFAULT 1,
  folder_id       TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_risk_matrices_folder
  ON grc_risk_matrices (tenant_id, folder_id);

-- ---- Threats ----
CREATE TABLE IF NOT EXISTS grc_threats (
  tenant_id   TEXT NOT NULL,
  id          TEXT NOT NULL,
  ref_id      TEXT NOT NULL DEFAULT '',
  name        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  urn         TEXT,
  provider    TEXT NOT NULL DEFAULT '',
  annotation  TEXT NOT NULL DEFAULT '',
  folder_id   TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_threats_folder
  ON grc_threats (tenant_id, folder_id);

CREATE INDEX IF NOT EXISTS idx_grc_threats_urn
  ON grc_threats (tenant_id, urn);

-- ---- Vulnerabilities ----
CREATE TABLE IF NOT EXISTS grc_vulnerabilities (
  tenant_id   TEXT NOT NULL,
  id          TEXT NOT NULL,
  ref_id      TEXT NOT NULL DEFAULT '',
  name        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  urn         TEXT,
  severity    TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT '',
  folder_id   TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_vulnerabilities_status
  ON grc_vulnerabilities (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_grc_vulnerabilities_folder
  ON grc_vulnerabilities (tenant_id, folder_id);

-- ---- Risk Assessments ----
CREATE TABLE IF NOT EXISTS grc_risk_assessments (
  tenant_id      TEXT NOT NULL,
  id             TEXT NOT NULL,
  name           TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL DEFAULT '',
  version        TEXT NOT NULL DEFAULT '1.0',
  status         TEXT NOT NULL DEFAULT '',
  risk_matrix_id TEXT,
  eta            TEXT,
  due_date       TEXT,
  folder_id      TEXT,
  project_id     TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_risk_assessments_status
  ON grc_risk_assessments (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_grc_risk_assessments_folder
  ON grc_risk_assessments (tenant_id, folder_id);

-- ---- Risk Scenarios ----
CREATE TABLE IF NOT EXISTS grc_risk_scenarios (
  tenant_id             TEXT NOT NULL,
  id                    TEXT NOT NULL,
  ref_id                TEXT NOT NULL DEFAULT '',
  name                  TEXT NOT NULL DEFAULT '',
  description           TEXT NOT NULL DEFAULT '',
  existing_controls     TEXT NOT NULL DEFAULT '',
  current_level         INTEGER,
  residual_level        INTEGER,
  current_proba         INTEGER NOT NULL DEFAULT -1,
  residual_proba        INTEGER NOT NULL DEFAULT -1,
  current_impact        INTEGER NOT NULL DEFAULT -1,
  residual_impact       INTEGER NOT NULL DEFAULT -1,
  treatment             TEXT NOT NULL DEFAULT '',
  strength_of_knowledge TEXT NOT NULL DEFAULT '',
  justification         TEXT NOT NULL DEFAULT '',
  risk_assessment_id    TEXT,
  folder_id             TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_risk_scenarios_assessment
  ON grc_risk_scenarios (tenant_id, risk_assessment_id);

CREATE INDEX IF NOT EXISTS idx_grc_risk_scenarios_folder
  ON grc_risk_scenarios (tenant_id, folder_id);

-- ---- Risk Acceptances ----
CREATE TABLE IF NOT EXISTS grc_risk_acceptances (
  tenant_id    TEXT NOT NULL,
  id           TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  state        TEXT NOT NULL DEFAULT '',
  justification TEXT NOT NULL DEFAULT '',
  approver_id  TEXT,
  expiry_date  TEXT,
  accepted_at  TEXT,
  rejected_at  TEXT,
  revoked_at   TEXT,
  folder_id    TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_risk_acceptances_state
  ON grc_risk_acceptances (tenant_id, state);

CREATE INDEX IF NOT EXISTS idx_grc_risk_acceptances_folder
  ON grc_risk_acceptances (tenant_id, folder_id);

-- ---- Evidences ----
CREATE TABLE IF NOT EXISTS grc_evidences (
  tenant_id   TEXT NOT NULL,
  id          TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  link        TEXT NOT NULL DEFAULT '',
  attachment  TEXT NOT NULL DEFAULT '',
  folder_id   TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_evidences_folder
  ON grc_evidences (tenant_id, folder_id);

-- ---- Compliance Assessments ----
CREATE TABLE IF NOT EXISTS grc_compliance_assessments (
  tenant_id    TEXT NOT NULL,
  id           TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  version      TEXT NOT NULL DEFAULT '1.0',
  status       TEXT NOT NULL DEFAULT '',
  eta          TEXT,
  due_date     TEXT,
  framework_id TEXT,
  project_id   TEXT,
  folder_id    TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_compliance_assessments_status
  ON grc_compliance_assessments (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_grc_compliance_assessments_folder
  ON grc_compliance_assessments (tenant_id, folder_id);

CREATE INDEX IF NOT EXISTS idx_grc_compliance_assessments_framework
  ON grc_compliance_assessments (tenant_id, framework_id);

-- ---- Requirement Assessments ----
CREATE TABLE IF NOT EXISTS grc_requirement_assessments (
  tenant_id                TEXT NOT NULL,
  id                       TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT '',
  score                    INTEGER,
  result                   TEXT NOT NULL DEFAULT '',
  observation              TEXT NOT NULL DEFAULT '',
  compliance_assessment_id TEXT,
  requirement_id           TEXT,
  folder_id                TEXT,
  mapping_inference_json   TEXT NOT NULL DEFAULT '{}',
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_requirement_assessments_compliance
  ON grc_requirement_assessments (tenant_id, compliance_assessment_id);

CREATE INDEX IF NOT EXISTS idx_grc_requirement_assessments_status
  ON grc_requirement_assessments (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_grc_requirement_assessments_folder
  ON grc_requirement_assessments (tenant_id, folder_id);

-- ---- Findings ----
CREATE TABLE IF NOT EXISTS grc_findings (
  tenant_id        TEXT NOT NULL,
  id               TEXT NOT NULL,
  ref_id           TEXT NOT NULL DEFAULT '',
  name             TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  severity         TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT '',
  finding_type     TEXT NOT NULL DEFAULT '',
  source_type      TEXT NOT NULL DEFAULT '',
  risk_rating      TEXT NOT NULL DEFAULT '',
  recommendation   TEXT NOT NULL DEFAULT '',
  remediation_plan TEXT NOT NULL DEFAULT '',
  target_date      TEXT,
  closed_date      TEXT,
  owner_id         TEXT,
  folder_id        TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_findings_status
  ON grc_findings (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_grc_findings_severity
  ON grc_findings (tenant_id, severity);

CREATE INDEX IF NOT EXISTS idx_grc_findings_folder
  ON grc_findings (tenant_id, folder_id);

-- ---- Filtering Labels ----
CREATE TABLE IF NOT EXISTS grc_filtering_labels (
  tenant_id  TEXT NOT NULL,
  id         TEXT NOT NULL,
  label      TEXT NOT NULL DEFAULT '',
  folder_id  TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_filtering_labels_folder
  ON grc_filtering_labels (tenant_id, folder_id);

-- ---- Campaigns ----
CREATE TABLE IF NOT EXISTS grc_campaigns (
  tenant_id   TEXT NOT NULL,
  id          TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT '',
  start_date  TEXT,
  end_date    TEXT,
  folder_id   TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_campaigns_status
  ON grc_campaigns (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_grc_campaigns_folder
  ON grc_campaigns (tenant_id, folder_id);

-- ---- Requirement Mapping Sets ----
CREATE TABLE IF NOT EXISTS grc_requirement_mapping_sets (
  tenant_id             TEXT NOT NULL,
  id                    TEXT NOT NULL,
  ref_id                TEXT NOT NULL DEFAULT '',
  name                  TEXT NOT NULL DEFAULT '',
  description           TEXT NOT NULL DEFAULT '',
  source_framework_id   TEXT,
  target_framework_id   TEXT,
  folder_id             TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_requirement_mapping_sets_folder
  ON grc_requirement_mapping_sets (tenant_id, folder_id);

-- ---- Assets ----
CREATE TABLE IF NOT EXISTS grc_assets (
  tenant_id         TEXT NOT NULL,
  id                TEXT NOT NULL,
  name              TEXT NOT NULL DEFAULT '',
  description       TEXT NOT NULL DEFAULT '',
  type              TEXT NOT NULL DEFAULT '',
  business_value    TEXT NOT NULL DEFAULT '',
  sensitivity       TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL DEFAULT '',
  parent_assets_json TEXT NOT NULL DEFAULT '[]',
  folder_id         TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_grc_assets_folder
  ON grc_assets (tenant_id, folder_id);

CREATE INDEX IF NOT EXISTS idx_grc_assets_type
  ON grc_assets (tenant_id, type);


-- ===========================================================================
-- 2. TPRM (prefix: tprm_)
-- ===========================================================================

-- ---- Entities ----
CREATE TABLE IF NOT EXISTS tprm_entities (
  tenant_id                TEXT NOT NULL,
  id                       TEXT NOT NULL,
  name                     TEXT NOT NULL DEFAULT '',
  description              TEXT NOT NULL DEFAULT '',
  mission                  TEXT NOT NULL DEFAULT '',
  reference_link           TEXT NOT NULL DEFAULT '',
  business_contact_info_json TEXT NOT NULL DEFAULT '{}',
  owned_folders_json       TEXT NOT NULL DEFAULT '[]',
  folder_id                TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_tprm_entities_folder
  ON tprm_entities (tenant_id, folder_id);

-- ---- Entity Assessments ----
CREATE TABLE IF NOT EXISTS tprm_entity_assessments (
  tenant_id   TEXT NOT NULL,
  id          TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  project_id  TEXT,
  entity_id   TEXT,
  status      TEXT NOT NULL DEFAULT '',
  eta         TEXT,
  due_date    TEXT,
  conclusion  TEXT NOT NULL DEFAULT '',
  folder_id   TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_tprm_entity_assessments_status
  ON tprm_entity_assessments (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_tprm_entity_assessments_entity
  ON tprm_entity_assessments (tenant_id, entity_id);

CREATE INDEX IF NOT EXISTS idx_tprm_entity_assessments_folder
  ON tprm_entity_assessments (tenant_id, folder_id);

-- ---- Solutions ----
CREATE TABLE IF NOT EXISTS tprm_solutions (
  tenant_id          TEXT NOT NULL,
  id                 TEXT NOT NULL,
  name               TEXT NOT NULL DEFAULT '',
  description        TEXT NOT NULL DEFAULT '',
  provider_entity_id TEXT,
  ref_id             TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL DEFAULT '',
  folder_id          TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_tprm_solutions_status
  ON tprm_solutions (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_tprm_solutions_folder
  ON tprm_solutions (tenant_id, folder_id);

-- ---- Representatives ----
CREATE TABLE IF NOT EXISTS tprm_representatives (
  tenant_id   TEXT NOT NULL,
  id          TEXT NOT NULL,
  email       TEXT NOT NULL DEFAULT '',
  first_name  TEXT NOT NULL DEFAULT '',
  last_name   TEXT NOT NULL DEFAULT '',
  phone       TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  entity_id   TEXT,
  folder_id   TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_tprm_representatives_entity
  ON tprm_representatives (tenant_id, entity_id);

CREATE INDEX IF NOT EXISTS idx_tprm_representatives_folder
  ON tprm_representatives (tenant_id, folder_id);

-- ---- Contracts ----
CREATE TABLE IF NOT EXISTS tprm_contracts (
  tenant_id     TEXT NOT NULL,
  id            TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  contract_type TEXT NOT NULL DEFAULT '',
  start_date    TEXT,
  end_date      TEXT,
  entity_id     TEXT,
  folder_id     TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_tprm_contracts_entity
  ON tprm_contracts (tenant_id, entity_id);

CREATE INDEX IF NOT EXISTS idx_tprm_contracts_folder
  ON tprm_contracts (tenant_id, folder_id);


-- ===========================================================================
-- 3. EBIOS RM (prefix: ebios_)
-- ===========================================================================

-- ---- Studies ----
CREATE TABLE IF NOT EXISTS ebios_studies (
  tenant_id      TEXT NOT NULL,
  id             TEXT NOT NULL,
  name           TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT '',
  version        TEXT NOT NULL DEFAULT '1.0',
  ref_id         TEXT NOT NULL DEFAULT '',
  risk_matrix_id TEXT,
  folder_id      TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_ebios_studies_status
  ON ebios_studies (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_ebios_studies_folder
  ON ebios_studies (tenant_id, folder_id);

-- ---- Feared Events ----
CREATE TABLE IF NOT EXISTS ebios_feared_events (
  tenant_id     TEXT NOT NULL,
  id            TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  ref_id        TEXT NOT NULL DEFAULT '',
  gravity       INTEGER NOT NULL DEFAULT -1,
  is_selected   INTEGER NOT NULL DEFAULT 0,
  justification TEXT NOT NULL DEFAULT '',
  study_id      TEXT,
  folder_id     TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_ebios_feared_events_study
  ON ebios_feared_events (tenant_id, study_id);

CREATE INDEX IF NOT EXISTS idx_ebios_feared_events_folder
  ON ebios_feared_events (tenant_id, folder_id);

-- ---- RO/TO (Risk Origin / Target Objective) ----
CREATE TABLE IF NOT EXISTS ebios_ro_to (
  tenant_id        TEXT NOT NULL,
  id               TEXT NOT NULL,
  name             TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  ref_id           TEXT NOT NULL DEFAULT '',
  risk_origin      TEXT NOT NULL DEFAULT '',
  target_objective TEXT NOT NULL DEFAULT '',
  motivation       INTEGER NOT NULL DEFAULT 0,
  resources        INTEGER NOT NULL DEFAULT 0,
  pertinence       INTEGER NOT NULL DEFAULT 0,
  activity         TEXT NOT NULL DEFAULT '',
  is_selected      INTEGER NOT NULL DEFAULT 0,
  justification    TEXT NOT NULL DEFAULT '',
  study_id         TEXT,
  folder_id        TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_ebios_ro_to_study
  ON ebios_ro_to (tenant_id, study_id);

CREATE INDEX IF NOT EXISTS idx_ebios_ro_to_folder
  ON ebios_ro_to (tenant_id, folder_id);

-- ---- Stakeholders ----
CREATE TABLE IF NOT EXISTS ebios_stakeholders (
  tenant_id             TEXT NOT NULL,
  id                    TEXT NOT NULL,
  name                  TEXT NOT NULL DEFAULT '',
  description           TEXT NOT NULL DEFAULT '',
  ref_id                TEXT NOT NULL DEFAULT '',
  category              TEXT NOT NULL DEFAULT '',
  current_criticality   INTEGER NOT NULL DEFAULT 0,
  residual_criticality  INTEGER NOT NULL DEFAULT 0,
  is_selected           INTEGER NOT NULL DEFAULT 0,
  justification         TEXT NOT NULL DEFAULT '',
  entity_id             TEXT,
  study_id              TEXT,
  folder_id             TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_ebios_stakeholders_study
  ON ebios_stakeholders (tenant_id, study_id);

CREATE INDEX IF NOT EXISTS idx_ebios_stakeholders_folder
  ON ebios_stakeholders (tenant_id, folder_id);

-- ---- Attack Paths ----
CREATE TABLE IF NOT EXISTS ebios_attack_paths (
  tenant_id   TEXT NOT NULL,
  id          TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  ref_id      TEXT NOT NULL DEFAULT '',
  study_id    TEXT,
  folder_id   TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_ebios_attack_paths_study
  ON ebios_attack_paths (tenant_id, study_id);

CREATE INDEX IF NOT EXISTS idx_ebios_attack_paths_folder
  ON ebios_attack_paths (tenant_id, folder_id);

-- ---- Operational Scenarios ----
CREATE TABLE IF NOT EXISTS ebios_operational_scenarios (
  tenant_id   TEXT NOT NULL,
  id          TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  ref_id      TEXT NOT NULL DEFAULT '',
  likelihood  INTEGER NOT NULL DEFAULT -1,
  is_selected INTEGER NOT NULL DEFAULT 0,
  study_id    TEXT,
  folder_id   TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_ebios_operational_scenarios_study
  ON ebios_operational_scenarios (tenant_id, study_id);

CREATE INDEX IF NOT EXISTS idx_ebios_operational_scenarios_folder
  ON ebios_operational_scenarios (tenant_id, folder_id);

-- ---- Strategic Scenarios ----
CREATE TABLE IF NOT EXISTS ebios_strategic_scenarios (
  tenant_id   TEXT NOT NULL,
  id          TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  ref_id      TEXT NOT NULL DEFAULT '',
  gravity     INTEGER NOT NULL DEFAULT -1,
  likelihood  INTEGER NOT NULL DEFAULT -1,
  study_id    TEXT,
  folder_id   TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_ebios_strategic_scenarios_study
  ON ebios_strategic_scenarios (tenant_id, study_id);

CREATE INDEX IF NOT EXISTS idx_ebios_strategic_scenarios_folder
  ON ebios_strategic_scenarios (tenant_id, folder_id);


-- ===========================================================================
-- 4. GDPR / PRIVACY (prefix: privacy_)
-- ===========================================================================

-- ---- Purposes ----
CREATE TABLE IF NOT EXISTS privacy_purposes (
  tenant_id        TEXT NOT NULL,
  id               TEXT NOT NULL,
  name             TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  legal_basis      TEXT NOT NULL DEFAULT '',
  retention_period TEXT NOT NULL DEFAULT '',
  folder_id        TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_privacy_purposes_folder
  ON privacy_purposes (tenant_id, folder_id);

-- ---- Personal Data ----
CREATE TABLE IF NOT EXISTS privacy_personal_data (
  tenant_id      TEXT NOT NULL,
  id             TEXT NOT NULL,
  name           TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL DEFAULT '',
  data_category  TEXT NOT NULL DEFAULT '',
  sensitivity    TEXT NOT NULL DEFAULT '',
  folder_id      TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_privacy_personal_data_folder
  ON privacy_personal_data (tenant_id, folder_id);

-- ---- Data Subjects ----
CREATE TABLE IF NOT EXISTS privacy_data_subjects (
  tenant_id      TEXT NOT NULL,
  id             TEXT NOT NULL,
  name           TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL DEFAULT '',
  category       TEXT NOT NULL DEFAULT '',
  count_estimate INTEGER NOT NULL DEFAULT 0,
  folder_id      TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_privacy_data_subjects_folder
  ON privacy_data_subjects (tenant_id, folder_id);

-- ---- Data Recipients ----
CREATE TABLE IF NOT EXISTS privacy_data_recipients (
  tenant_id          TEXT NOT NULL,
  id                 TEXT NOT NULL,
  name               TEXT NOT NULL DEFAULT '',
  description        TEXT NOT NULL DEFAULT '',
  role               TEXT NOT NULL DEFAULT '',
  country            TEXT NOT NULL DEFAULT '',
  adequacy_decision  TEXT NOT NULL DEFAULT '',
  folder_id          TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_privacy_data_recipients_folder
  ON privacy_data_recipients (tenant_id, folder_id);

-- ---- Data Transfers ----
CREATE TABLE IF NOT EXISTS privacy_data_transfers (
  tenant_id            TEXT NOT NULL,
  id                   TEXT NOT NULL,
  name                 TEXT NOT NULL DEFAULT '',
  description          TEXT NOT NULL DEFAULT '',
  destination_country  TEXT NOT NULL DEFAULT '',
  transfer_mechanism   TEXT NOT NULL DEFAULT '',
  safeguards           TEXT NOT NULL DEFAULT '',
  folder_id            TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_privacy_data_transfers_folder
  ON privacy_data_transfers (tenant_id, folder_id);

-- ---- Processings ----
CREATE TABLE IF NOT EXISTS privacy_processings (
  tenant_id         TEXT NOT NULL,
  id                TEXT NOT NULL,
  name              TEXT NOT NULL DEFAULT '',
  description       TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT '',
  legal_basis       TEXT NOT NULL DEFAULT '',
  purpose_ids_json  TEXT NOT NULL DEFAULT '[]',
  data_ids_json     TEXT NOT NULL DEFAULT '[]',
  subject_ids_json  TEXT NOT NULL DEFAULT '[]',
  folder_id         TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_privacy_processings_status
  ON privacy_processings (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_privacy_processings_folder
  ON privacy_processings (tenant_id, folder_id);

-- ---- Right Requests ----
CREATE TABLE IF NOT EXISTS privacy_right_requests (
  tenant_id    TEXT NOT NULL,
  id           TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  request_type TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT '',
  subject_id   TEXT,
  received_at  TEXT,
  due_date     TEXT,
  completed_at TEXT,
  folder_id    TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_privacy_right_requests_status
  ON privacy_right_requests (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_privacy_right_requests_folder
  ON privacy_right_requests (tenant_id, folder_id);

-- ---- Data Breaches ----
CREATE TABLE IF NOT EXISTS privacy_data_breaches (
  tenant_id      TEXT NOT NULL,
  id             TEXT NOT NULL,
  name           TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL DEFAULT '',
  severity       TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT '',
  detected_at    TEXT,
  reported_at    TEXT,
  resolved_at    TEXT,
  affected_count INTEGER NOT NULL DEFAULT 0,
  folder_id      TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_privacy_data_breaches_status
  ON privacy_data_breaches (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_privacy_data_breaches_severity
  ON privacy_data_breaches (tenant_id, severity);

CREATE INDEX IF NOT EXISTS idx_privacy_data_breaches_folder
  ON privacy_data_breaches (tenant_id, folder_id);

-- ---- Data Assets ----
CREATE TABLE IF NOT EXISTS privacy_data_assets (
  tenant_id       TEXT NOT NULL,
  id              TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  asset_type      TEXT NOT NULL DEFAULT '',
  classification  TEXT NOT NULL DEFAULT '',
  owner_id        TEXT,
  folder_id       TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_privacy_data_assets_folder
  ON privacy_data_assets (tenant_id, folder_id);

-- ---- Data Flows ----
CREATE TABLE IF NOT EXISTS privacy_data_flows (
  tenant_id       TEXT NOT NULL,
  id              TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  source_id       TEXT,
  destination_id  TEXT,
  data_types_json TEXT NOT NULL DEFAULT '[]',
  folder_id       TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_privacy_data_flows_folder
  ON privacy_data_flows (tenant_id, folder_id);

-- ---- Consent Records ----
CREATE TABLE IF NOT EXISTS privacy_consent_records (
  tenant_id   TEXT NOT NULL,
  id          TEXT NOT NULL,
  subject_id  TEXT,
  purpose_id  TEXT,
  status      TEXT NOT NULL DEFAULT '',
  granted_at  TEXT,
  revoked_at  TEXT,
  folder_id   TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_privacy_consent_records_status
  ON privacy_consent_records (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_privacy_consent_records_folder
  ON privacy_consent_records (tenant_id, folder_id);


-- ===========================================================================
-- 5. BUSINESS CONTINUITY (prefix: bc_)
-- ===========================================================================

-- ---- Plans ----
CREATE TABLE IF NOT EXISTS bc_plans (
  tenant_id      TEXT NOT NULL,
  id             TEXT NOT NULL,
  name           TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT '',
  scope          TEXT NOT NULL DEFAULT '',
  rto_hours      INTEGER,
  rpo_hours      INTEGER,
  last_tested    TEXT,
  next_test_date TEXT,
  folder_id      TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_bc_plans_status
  ON bc_plans (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_bc_plans_folder
  ON bc_plans (tenant_id, folder_id);

-- ---- Audits ----
CREATE TABLE IF NOT EXISTS bc_audits (
  tenant_id     TEXT NOT NULL,
  id            TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT '',
  plan_id       TEXT,
  audit_date    TEXT,
  findings_json TEXT NOT NULL DEFAULT '[]',
  folder_id     TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_bc_audits_status
  ON bc_audits (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_bc_audits_plan
  ON bc_audits (tenant_id, plan_id);

CREATE INDEX IF NOT EXISTS idx_bc_audits_folder
  ON bc_audits (tenant_id, folder_id);

-- ---- Tasks ----
CREATE TABLE IF NOT EXISTS bc_tasks (
  tenant_id    TEXT NOT NULL,
  id           TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT '',
  plan_id      TEXT,
  assignee_id  TEXT,
  priority     TEXT NOT NULL DEFAULT '',
  due_date     TEXT,
  folder_id    TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_bc_tasks_status
  ON bc_tasks (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_bc_tasks_plan
  ON bc_tasks (tenant_id, plan_id);

CREATE INDEX IF NOT EXISTS idx_bc_tasks_folder
  ON bc_tasks (tenant_id, folder_id);


-- ===========================================================================
-- 6. CRQ (prefix: crq_)
-- ===========================================================================

-- ---- Studies ----
CREATE TABLE IF NOT EXISTS crq_studies (
  tenant_id          TEXT NOT NULL,
  id                 TEXT NOT NULL,
  name               TEXT NOT NULL DEFAULT '',
  description        TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL DEFAULT '',
  methodology        TEXT NOT NULL DEFAULT '',
  risk_assessment_id TEXT,
  folder_id          TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_crq_studies_status
  ON crq_studies (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_crq_studies_folder
  ON crq_studies (tenant_id, folder_id);

-- ---- Scenarios ----
CREATE TABLE IF NOT EXISTS crq_scenarios (
  tenant_id                TEXT NOT NULL,
  id                       TEXT NOT NULL,
  name                     TEXT NOT NULL DEFAULT '',
  description              TEXT NOT NULL DEFAULT '',
  study_id                 TEXT,
  probability              REAL,
  single_loss_expectancy   REAL,
  annual_rate              REAL,
  annualized_loss          REAL,
  confidence_level         REAL,
  folder_id                TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_crq_scenarios_study
  ON crq_scenarios (tenant_id, study_id);

CREATE INDEX IF NOT EXISTS idx_crq_scenarios_folder
  ON crq_scenarios (tenant_id, folder_id);

-- ---- Hypotheses ----
CREATE TABLE IF NOT EXISTS crq_hypotheses (
  tenant_id       TEXT NOT NULL,
  id              TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  scenario_id     TEXT,
  hypothesis_type TEXT NOT NULL DEFAULT '',
  min_value       REAL,
  max_value       REAL,
  most_likely     REAL,
  distribution    TEXT NOT NULL DEFAULT '',
  folder_id       TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_crq_hypotheses_scenario
  ON crq_hypotheses (tenant_id, scenario_id);

CREATE INDEX IF NOT EXISTS idx_crq_hypotheses_folder
  ON crq_hypotheses (tenant_id, folder_id);


-- ===========================================================================
-- 7. RMF OPERATIONS (prefix: rmf_)
-- ===========================================================================

-- ---- System Groups ----
CREATE TABLE IF NOT EXISTS rmf_system_groups (
  tenant_id               TEXT NOT NULL,
  id                      TEXT NOT NULL,
  name                    TEXT NOT NULL DEFAULT '',
  description             TEXT NOT NULL DEFAULT '',
  status                  TEXT NOT NULL DEFAULT '',
  impact_level            TEXT NOT NULL DEFAULT '',
  authorization_boundary  TEXT NOT NULL DEFAULT '',
  folder_id               TEXT,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_rmf_system_groups_status
  ON rmf_system_groups (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_rmf_system_groups_folder
  ON rmf_system_groups (tenant_id, folder_id);

-- ---- Change Requests ----
CREATE TABLE IF NOT EXISTS rmf_change_requests (
  tenant_id        TEXT NOT NULL,
  id               TEXT NOT NULL,
  name             TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT '',
  change_type      TEXT NOT NULL DEFAULT '',
  risk_level       TEXT NOT NULL DEFAULT '',
  impact_analysis  TEXT NOT NULL DEFAULT '',
  system_group_id  TEXT,
  requested_by     TEXT,
  approved_by      TEXT,
  folder_id        TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_rmf_change_requests_status
  ON rmf_change_requests (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_rmf_change_requests_system_group
  ON rmf_change_requests (tenant_id, system_group_id);

CREATE INDEX IF NOT EXISTS idx_rmf_change_requests_folder
  ON rmf_change_requests (tenant_id, folder_id);

-- ---- Checklists ----
CREATE TABLE IF NOT EXISTS rmf_checklists (
  tenant_id       TEXT NOT NULL,
  id              TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  template_id     TEXT,
  system_group_id TEXT,
  status          TEXT NOT NULL DEFAULT '',
  score           REAL,
  folder_id       TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_rmf_checklists_status
  ON rmf_checklists (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_rmf_checklists_system_group
  ON rmf_checklists (tenant_id, system_group_id);

CREATE INDEX IF NOT EXISTS idx_rmf_checklists_folder
  ON rmf_checklists (tenant_id, folder_id);

-- ---- Checklist Scores ----
CREATE TABLE IF NOT EXISTS rmf_checklist_scores (
  tenant_id         TEXT NOT NULL,
  id                TEXT NOT NULL,
  checklist_id      TEXT,
  control_id        TEXT,
  score             REAL,
  notes             TEXT NOT NULL DEFAULT '',
  evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  folder_id         TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_rmf_checklist_scores_checklist
  ON rmf_checklist_scores (tenant_id, checklist_id);

CREATE INDEX IF NOT EXISTS idx_rmf_checklist_scores_folder
  ON rmf_checklist_scores (tenant_id, folder_id);

-- ---- Templates ----
CREATE TABLE IF NOT EXISTS rmf_templates (
  tenant_id     TEXT NOT NULL,
  id            TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  template_type TEXT NOT NULL DEFAULT '',
  content_json  TEXT NOT NULL DEFAULT '{}',
  folder_id     TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_rmf_templates_folder
  ON rmf_templates (tenant_id, folder_id);

-- ---- Artifacts ----
CREATE TABLE IF NOT EXISTS rmf_artifacts (
  tenant_id       TEXT NOT NULL,
  id              TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  artifact_type   TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT '',
  system_group_id TEXT,
  r2_key          TEXT NOT NULL DEFAULT '',
  folder_id       TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_rmf_artifacts_status
  ON rmf_artifacts (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_rmf_artifacts_system_group
  ON rmf_artifacts (tenant_id, system_group_id);

CREATE INDEX IF NOT EXISTS idx_rmf_artifacts_folder
  ON rmf_artifacts (tenant_id, folder_id);

-- ---- Vulnerability Findings ----
CREATE TABLE IF NOT EXISTS rmf_vulnerability_findings (
  tenant_id       TEXT NOT NULL,
  id              TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  severity        TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT '',
  cve_id          TEXT NOT NULL DEFAULT '',
  cvss_score      REAL,
  system_group_id TEXT,
  scanner_source  TEXT NOT NULL DEFAULT '',
  folder_id       TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_rmf_vulnerability_findings_status
  ON rmf_vulnerability_findings (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_rmf_vulnerability_findings_severity
  ON rmf_vulnerability_findings (tenant_id, severity);

CREATE INDEX IF NOT EXISTS idx_rmf_vulnerability_findings_system_group
  ON rmf_vulnerability_findings (tenant_id, system_group_id);

CREATE INDEX IF NOT EXISTS idx_rmf_vulnerability_findings_folder
  ON rmf_vulnerability_findings (tenant_id, folder_id);

-- ---- Nessus Scans ----
CREATE TABLE IF NOT EXISTS rmf_nessus_scans (
  tenant_id       TEXT NOT NULL,
  id              TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT '',
  scan_type       TEXT NOT NULL DEFAULT '',
  system_group_id TEXT,
  results_json    TEXT NOT NULL DEFAULT '{}',
  imported_at     TEXT,
  folder_id       TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_rmf_nessus_scans_status
  ON rmf_nessus_scans (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_rmf_nessus_scans_system_group
  ON rmf_nessus_scans (tenant_id, system_group_id);

CREATE INDEX IF NOT EXISTS idx_rmf_nessus_scans_folder
  ON rmf_nessus_scans (tenant_id, folder_id);


-- ===========================================================================
-- 8. SECURITY OPERATIONS (prefix: secops_)
-- ===========================================================================

-- ---- Incidents ----
CREATE TABLE IF NOT EXISTS secops_incidents (
  tenant_id          TEXT NOT NULL,
  id                 TEXT NOT NULL,
  name               TEXT NOT NULL DEFAULT '',
  description        TEXT NOT NULL DEFAULT '',
  severity           TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL DEFAULT '',
  incident_type      TEXT NOT NULL DEFAULT '',
  detected_at        TEXT,
  contained_at       TEXT,
  resolved_at        TEXT,
  impact_description TEXT NOT NULL DEFAULT '',
  folder_id          TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_secops_incidents_status
  ON secops_incidents (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_secops_incidents_severity
  ON secops_incidents (tenant_id, severity);

CREATE INDEX IF NOT EXISTS idx_secops_incidents_folder
  ON secops_incidents (tenant_id, folder_id);

-- ---- Awareness Programs ----
CREATE TABLE IF NOT EXISTS secops_awareness_programs (
  tenant_id    TEXT NOT NULL,
  id           TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT '',
  program_type TEXT NOT NULL DEFAULT '',
  start_date   TEXT,
  end_date     TEXT,
  folder_id    TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_secops_awareness_programs_status
  ON secops_awareness_programs (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_secops_awareness_programs_folder
  ON secops_awareness_programs (tenant_id, folder_id);

-- ---- Awareness Campaigns ----
CREATE TABLE IF NOT EXISTS secops_awareness_campaigns (
  tenant_id            TEXT NOT NULL,
  id                   TEXT NOT NULL,
  name                 TEXT NOT NULL DEFAULT '',
  description          TEXT NOT NULL DEFAULT '',
  status               TEXT NOT NULL DEFAULT '',
  program_id           TEXT,
  campaign_type        TEXT NOT NULL DEFAULT '',
  target_audience_json TEXT NOT NULL DEFAULT '[]',
  start_date           TEXT,
  end_date             TEXT,
  folder_id            TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_secops_awareness_campaigns_status
  ON secops_awareness_campaigns (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_secops_awareness_campaigns_program
  ON secops_awareness_campaigns (tenant_id, program_id);

CREATE INDEX IF NOT EXISTS idx_secops_awareness_campaigns_folder
  ON secops_awareness_campaigns (tenant_id, folder_id);

-- ---- Awareness Completions ----
CREATE TABLE IF NOT EXISTS secops_awareness_completions (
  tenant_id    TEXT NOT NULL,
  id           TEXT NOT NULL,
  campaign_id  TEXT,
  user_id      TEXT,
  status       TEXT NOT NULL DEFAULT '',
  completed_at TEXT,
  score        REAL,
  folder_id    TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_secops_awareness_completions_status
  ON secops_awareness_completions (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_secops_awareness_completions_campaign
  ON secops_awareness_completions (tenant_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_secops_awareness_completions_folder
  ON secops_awareness_completions (tenant_id, folder_id);


-- ===========================================================================
-- 9. METROLOGY (prefix: metrology_)
-- ===========================================================================

-- ---- Definitions ----
CREATE TABLE IF NOT EXISTS metrology_definitions (
  tenant_id          TEXT NOT NULL,
  id                 TEXT NOT NULL,
  name               TEXT NOT NULL DEFAULT '',
  description        TEXT NOT NULL DEFAULT '',
  metric_type        TEXT NOT NULL DEFAULT '',
  unit               TEXT NOT NULL DEFAULT '',
  category           TEXT NOT NULL DEFAULT '',
  calculation_method TEXT NOT NULL DEFAULT '',
  thresholds_json    TEXT NOT NULL DEFAULT '{}',
  folder_id          TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_metrology_definitions_category
  ON metrology_definitions (tenant_id, category);

CREATE INDEX IF NOT EXISTS idx_metrology_definitions_folder
  ON metrology_definitions (tenant_id, folder_id);

-- ---- Instances ----
CREATE TABLE IF NOT EXISTS metrology_instances (
  tenant_id     TEXT NOT NULL,
  id            TEXT NOT NULL,
  definition_id TEXT,
  target_type   TEXT NOT NULL DEFAULT '',
  target_id     TEXT NOT NULL DEFAULT '',
  value         REAL,
  status        TEXT NOT NULL DEFAULT '',
  measured_at   TEXT,
  folder_id     TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_metrology_instances_definition
  ON metrology_instances (tenant_id, definition_id);

CREATE INDEX IF NOT EXISTS idx_metrology_instances_status
  ON metrology_instances (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_metrology_instances_folder
  ON metrology_instances (tenant_id, folder_id);

-- ---- Dashboards ----
CREATE TABLE IF NOT EXISTS metrology_dashboards (
  tenant_id   TEXT NOT NULL,
  id          TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  layout_json TEXT NOT NULL DEFAULT '{}',
  folder_id   TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_metrology_dashboards_folder
  ON metrology_dashboards (tenant_id, folder_id);

-- ---- Widgets ----
CREATE TABLE IF NOT EXISTS metrology_widgets (
  tenant_id    TEXT NOT NULL,
  id           TEXT NOT NULL,
  dashboard_id TEXT,
  name         TEXT NOT NULL DEFAULT '',
  widget_type  TEXT NOT NULL DEFAULT '',
  config_json  TEXT NOT NULL DEFAULT '{}',
  position_json TEXT NOT NULL DEFAULT '{}',
  folder_id    TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_metrology_widgets_dashboard
  ON metrology_widgets (tenant_id, dashboard_id);

CREATE INDEX IF NOT EXISTS idx_metrology_widgets_folder
  ON metrology_widgets (tenant_id, folder_id);


-- ===========================================================================
-- 10. WORKFLOWS (prefix: wf_)
-- ===========================================================================

-- ---- Templates ----
CREATE TABLE IF NOT EXISTS wf_templates (
  tenant_id    TEXT NOT NULL,
  id           TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT '',
  trigger_type TEXT NOT NULL DEFAULT '',
  steps_json   TEXT NOT NULL DEFAULT '[]',
  folder_id    TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_wf_templates_status
  ON wf_templates (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_wf_templates_folder
  ON wf_templates (tenant_id, folder_id);

-- ---- Executions ----
CREATE TABLE IF NOT EXISTS wf_executions (
  tenant_id    TEXT NOT NULL,
  id           TEXT NOT NULL,
  template_id  TEXT,
  status       TEXT NOT NULL DEFAULT '',
  started_at   TEXT,
  completed_at TEXT,
  current_step TEXT NOT NULL DEFAULT '',
  context_json TEXT NOT NULL DEFAULT '{}',
  folder_id    TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_wf_executions_status
  ON wf_executions (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_wf_executions_template
  ON wf_executions (tenant_id, template_id);

CREATE INDEX IF NOT EXISTS idx_wf_executions_folder
  ON wf_executions (tenant_id, folder_id);

-- ---- Schedules ----
CREATE TABLE IF NOT EXISTS wf_schedules (
  tenant_id       TEXT NOT NULL,
  id              TEXT NOT NULL,
  template_id     TEXT,
  name            TEXT NOT NULL DEFAULT '',
  cron_expression TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT '',
  next_run        TEXT,
  last_run        TEXT,
  folder_id       TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_wf_schedules_status
  ON wf_schedules (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_wf_schedules_template
  ON wf_schedules (tenant_id, template_id);

CREATE INDEX IF NOT EXISTS idx_wf_schedules_folder
  ON wf_schedules (tenant_id, folder_id);

-- ---- Assessment Tasks ----
CREATE TABLE IF NOT EXISTS wf_assessment_tasks (
  tenant_id    TEXT NOT NULL,
  id           TEXT NOT NULL,
  execution_id TEXT,
  name         TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT '',
  assignee_id  TEXT,
  due_date     TEXT,
  folder_id    TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_wf_assessment_tasks_status
  ON wf_assessment_tasks (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_wf_assessment_tasks_execution
  ON wf_assessment_tasks (tenant_id, execution_id);

CREATE INDEX IF NOT EXISTS idx_wf_assessment_tasks_folder
  ON wf_assessment_tasks (tenant_id, folder_id);


-- ===========================================================================
-- 11. COMPLIANCE CONTEXT (prefix: compliance_)
-- ===========================================================================

-- ---- Online Assessments ----
CREATE TABLE IF NOT EXISTS compliance_online_assessments (
  tenant_id    TEXT NOT NULL,
  id           TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  framework_id TEXT,
  status       TEXT NOT NULL DEFAULT '',
  score        REAL,
  folder_id    TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_online_assessments_status
  ON compliance_online_assessments (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_compliance_online_assessments_folder
  ON compliance_online_assessments (tenant_id, folder_id);

-- ---- Assessment Runs ----
CREATE TABLE IF NOT EXISTS compliance_assessment_runs (
  tenant_id     TEXT NOT NULL,
  id            TEXT NOT NULL,
  assessment_id TEXT,
  status        TEXT NOT NULL DEFAULT '',
  started_at    TEXT,
  completed_at  TEXT,
  score         REAL,
  folder_id     TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_assessment_runs_status
  ON compliance_assessment_runs (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_compliance_assessment_runs_assessment
  ON compliance_assessment_runs (tenant_id, assessment_id);

CREATE INDEX IF NOT EXISTS idx_compliance_assessment_runs_folder
  ON compliance_assessment_runs (tenant_id, folder_id);

-- ---- Audit Records ----
CREATE TABLE IF NOT EXISTS compliance_audit_records (
  tenant_id    TEXT NOT NULL,
  id           TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  audit_type   TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT '',
  auditor      TEXT NOT NULL DEFAULT '',
  scheduled_at TEXT,
  completed_at TEXT,
  folder_id    TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_records_status
  ON compliance_audit_records (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_records_folder
  ON compliance_audit_records (tenant_id, folder_id);

-- ---- Compliance Findings ----
CREATE TABLE IF NOT EXISTS compliance_findings (
  tenant_id        TEXT NOT NULL,
  id               TEXT NOT NULL,
  name             TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  severity         TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT '',
  finding_type     TEXT NOT NULL DEFAULT '',
  audit_id         TEXT,
  remediation_plan TEXT NOT NULL DEFAULT '',
  due_date         TEXT,
  folder_id        TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_findings_status
  ON compliance_findings (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_compliance_findings_severity
  ON compliance_findings (tenant_id, severity);

CREATE INDEX IF NOT EXISTS idx_compliance_findings_audit
  ON compliance_findings (tenant_id, audit_id);

CREATE INDEX IF NOT EXISTS idx_compliance_findings_folder
  ON compliance_findings (tenant_id, folder_id);

-- ---- Compliance Exceptions ----
CREATE TABLE IF NOT EXISTS compliance_exceptions (
  tenant_id     TEXT NOT NULL,
  id            TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT '',
  justification TEXT NOT NULL DEFAULT '',
  risk_accepted INTEGER NOT NULL DEFAULT 0,
  approver_id   TEXT,
  expiry_date   TEXT,
  folder_id     TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_exceptions_status
  ON compliance_exceptions (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_compliance_exceptions_folder
  ON compliance_exceptions (tenant_id, folder_id);


-- ===========================================================================
-- 12. ASSET SERVICE (prefix: asset_)
-- ===========================================================================

-- ---- Items ----
CREATE TABLE IF NOT EXISTS asset_items (
  tenant_id       TEXT NOT NULL,
  id              TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  asset_type      TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT '',
  classification  TEXT NOT NULL DEFAULT '',
  owner_id        TEXT,
  location        TEXT NOT NULL DEFAULT '',
  tags_json       TEXT NOT NULL DEFAULT '[]',
  folder_id       TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_asset_items_status
  ON asset_items (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_asset_items_type
  ON asset_items (tenant_id, asset_type);

CREATE INDEX IF NOT EXISTS idx_asset_items_folder
  ON asset_items (tenant_id, folder_id);

-- ---- Processes ----
CREATE TABLE IF NOT EXISTS asset_processes (
  tenant_id    TEXT NOT NULL,
  id           TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  process_type TEXT NOT NULL DEFAULT '',
  owner_id     TEXT,
  criticality  TEXT NOT NULL DEFAULT '',
  assets_json  TEXT NOT NULL DEFAULT '[]',
  folder_id    TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_asset_processes_folder
  ON asset_processes (tenant_id, folder_id);

-- ---- Services ----
CREATE TABLE IF NOT EXISTS asset_services (
  tenant_id    TEXT NOT NULL,
  id           TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  service_type TEXT NOT NULL DEFAULT '',
  provider_id  TEXT,
  status       TEXT NOT NULL DEFAULT '',
  sla_json     TEXT NOT NULL DEFAULT '{}',
  folder_id    TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_asset_services_status
  ON asset_services (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_asset_services_folder
  ON asset_services (tenant_id, folder_id);

-- ---- Service Contracts ----
CREATE TABLE IF NOT EXISTS asset_service_contracts (
  tenant_id     TEXT NOT NULL,
  id            TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  service_id    TEXT,
  contract_type TEXT NOT NULL DEFAULT '',
  start_date    TEXT,
  end_date      TEXT,
  value         TEXT NOT NULL DEFAULT '',
  folder_id     TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_asset_service_contracts_service
  ON asset_service_contracts (tenant_id, service_id);

CREATE INDEX IF NOT EXISTS idx_asset_service_contracts_folder
  ON asset_service_contracts (tenant_id, folder_id);


-- ===========================================================================
-- 13. RESILIENCE (prefix: resilience_)
-- ===========================================================================

-- ---- Business Impact Analyses ----
CREATE TABLE IF NOT EXISTS resilience_bia (
  tenant_id         TEXT NOT NULL,
  id                TEXT NOT NULL,
  name              TEXT NOT NULL DEFAULT '',
  description       TEXT NOT NULL DEFAULT '',
  process_id        TEXT,
  rto_hours         INTEGER,
  rpo_hours         INTEGER,
  mtpd_hours        INTEGER,
  impact_scores_json TEXT NOT NULL DEFAULT '{}',
  folder_id         TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_resilience_bia_folder
  ON resilience_bia (tenant_id, folder_id);

-- ---- Asset Assessments ----
CREATE TABLE IF NOT EXISTS resilience_asset_assessments (
  tenant_id         TEXT NOT NULL,
  id                TEXT NOT NULL,
  name              TEXT NOT NULL DEFAULT '',
  description       TEXT NOT NULL DEFAULT '',
  asset_id          TEXT,
  bia_id            TEXT,
  criticality       TEXT NOT NULL DEFAULT '',
  recovery_priority TEXT NOT NULL DEFAULT '',
  dependencies_json TEXT NOT NULL DEFAULT '[]',
  folder_id         TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_resilience_asset_assessments_bia
  ON resilience_asset_assessments (tenant_id, bia_id);

CREATE INDEX IF NOT EXISTS idx_resilience_asset_assessments_folder
  ON resilience_asset_assessments (tenant_id, folder_id);

-- ---- Escalation Thresholds ----
CREATE TABLE IF NOT EXISTS resilience_escalation_thresholds (
  tenant_id          TEXT NOT NULL,
  id                 TEXT NOT NULL,
  name               TEXT NOT NULL DEFAULT '',
  description        TEXT NOT NULL DEFAULT '',
  metric_id          TEXT,
  warning_threshold  REAL,
  critical_threshold REAL,
  action_plan        TEXT NOT NULL DEFAULT '',
  folder_id          TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_resilience_escalation_thresholds_folder
  ON resilience_escalation_thresholds (tenant_id, folder_id);


-- ===========================================================================
-- 14. CONTROL LIBRARY (prefix: ctllib_)
-- ===========================================================================

-- ---- Controls ----
CREATE TABLE IF NOT EXISTS ctllib_controls (
  tenant_id    TEXT NOT NULL,
  id           TEXT NOT NULL,
  ref_id       TEXT NOT NULL DEFAULT '',
  name         TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT '',
  csf_function TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT '',
  library_id   TEXT,
  folder_id    TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_ctllib_controls_status
  ON ctllib_controls (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_ctllib_controls_library
  ON ctllib_controls (tenant_id, library_id);

CREATE INDEX IF NOT EXISTS idx_ctllib_controls_folder
  ON ctllib_controls (tenant_id, folder_id);

-- ---- Implementations ----
CREATE TABLE IF NOT EXISTS ctllib_implementations (
  tenant_id     TEXT NOT NULL,
  id            TEXT NOT NULL,
  control_id    TEXT,
  name          TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT '',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  folder_id     TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_ctllib_implementations_status
  ON ctllib_implementations (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_ctllib_implementations_control
  ON ctllib_implementations (tenant_id, control_id);

CREATE INDEX IF NOT EXISTS idx_ctllib_implementations_folder
  ON ctllib_implementations (tenant_id, folder_id);

-- ---- Policies ----
CREATE TABLE IF NOT EXISTS ctllib_policies (
  tenant_id      TEXT NOT NULL,
  id             TEXT NOT NULL,
  name           TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT '',
  policy_type    TEXT NOT NULL DEFAULT '',
  version        TEXT NOT NULL DEFAULT '',
  effective_date TEXT,
  folder_id      TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_ctllib_policies_status
  ON ctllib_policies (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_ctllib_policies_folder
  ON ctllib_policies (tenant_id, folder_id);

-- ---- Policy Acknowledgements ----
CREATE TABLE IF NOT EXISTS ctllib_policy_acks (
  tenant_id       TEXT NOT NULL,
  id              TEXT NOT NULL,
  policy_id       TEXT,
  user_id         TEXT,
  acknowledged_at TEXT,
  folder_id       TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_ctllib_policy_acks_policy
  ON ctllib_policy_acks (tenant_id, policy_id);

CREATE INDEX IF NOT EXISTS idx_ctllib_policy_acks_folder
  ON ctllib_policy_acks (tenant_id, folder_id);

-- ---- Evidence Items ----
CREATE TABLE IF NOT EXISTS ctllib_evidence_items (
  tenant_id     TEXT NOT NULL,
  id            TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  evidence_type TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT '',
  r2_key        TEXT NOT NULL DEFAULT '',
  folder_id     TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_ctllib_evidence_items_status
  ON ctllib_evidence_items (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_ctllib_evidence_items_folder
  ON ctllib_evidence_items (tenant_id, folder_id);


-- ===========================================================================
-- 15. GOVERNANCE (prefix: gov_)
-- ===========================================================================

-- ---- Control Originations ----
CREATE TABLE IF NOT EXISTS gov_control_originations (
  tenant_id                 TEXT NOT NULL,
  id                        TEXT NOT NULL,
  name                      TEXT NOT NULL DEFAULT '',
  description               TEXT NOT NULL DEFAULT '',
  applied_control_id        TEXT,
  compliance_assessment_id  TEXT,
  origination_type          TEXT NOT NULL DEFAULT '',
  implementation_status     TEXT NOT NULL DEFAULT '',
  responsibility_percentage REAL,
  responsible_role          TEXT NOT NULL DEFAULT '',
  folder_id                 TEXT,
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_gov_control_originations_folder
  ON gov_control_originations (tenant_id, folder_id);

-- ---- Responsibility Matrices ----
CREATE TABLE IF NOT EXISTS gov_responsibility_matrices (
  tenant_id                TEXT NOT NULL,
  id                       TEXT NOT NULL,
  name                     TEXT NOT NULL DEFAULT '',
  description              TEXT NOT NULL DEFAULT '',
  compliance_assessment_id TEXT,
  provider_name            TEXT NOT NULL DEFAULT '',
  customer_name            TEXT NOT NULL DEFAULT '',
  status                   TEXT NOT NULL DEFAULT '',
  folder_id                TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_gov_responsibility_matrices_status
  ON gov_responsibility_matrices (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_gov_responsibility_matrices_folder
  ON gov_responsibility_matrices (tenant_id, folder_id);

-- ---- Responsibility Assignments ----
CREATE TABLE IF NOT EXISTS gov_responsibility_assignments (
  tenant_id            TEXT NOT NULL,
  id                   TEXT NOT NULL,
  name                 TEXT NOT NULL DEFAULT '',
  description          TEXT NOT NULL DEFAULT '',
  matrix_id            TEXT,
  reference_control_id TEXT,
  responsible_party    TEXT NOT NULL DEFAULT '',
  provider_percentage  REAL,
  customer_percentage  REAL,
  folder_id            TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_gov_responsibility_assignments_matrix
  ON gov_responsibility_assignments (tenant_id, matrix_id);

CREATE INDEX IF NOT EXISTS idx_gov_responsibility_assignments_folder
  ON gov_responsibility_assignments (tenant_id, folder_id);

-- ---- Assessment Plans ----
CREATE TABLE IF NOT EXISTS gov_assessment_plans (
  tenant_id                TEXT NOT NULL,
  id                       TEXT NOT NULL,
  name                     TEXT NOT NULL DEFAULT '',
  description              TEXT NOT NULL DEFAULT '',
  compliance_assessment_id TEXT,
  status                   TEXT NOT NULL DEFAULT '',
  assessment_type          TEXT NOT NULL DEFAULT '',
  planned_start            TEXT,
  planned_end              TEXT,
  actual_start             TEXT,
  actual_end               TEXT,
  folder_id                TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_gov_assessment_plans_status
  ON gov_assessment_plans (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_gov_assessment_plans_folder
  ON gov_assessment_plans (tenant_id, folder_id);

-- ---- Attestations ----
CREATE TABLE IF NOT EXISTS gov_attestations (
  tenant_id        TEXT NOT NULL,
  id               TEXT NOT NULL,
  title            TEXT NOT NULL DEFAULT '',
  attestation_type TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT '',
  authority_level  TEXT NOT NULL DEFAULT '',
  statement        TEXT NOT NULL DEFAULT '',
  attester_id      TEXT,
  attested_at      TEXT,
  expires_at       TEXT,
  folder_id        TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_gov_attestations_status
  ON gov_attestations (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_gov_attestations_folder
  ON gov_attestations (tenant_id, folder_id);

-- ---- Authorization Timelines ----
CREATE TABLE IF NOT EXISTS gov_authorization_timelines (
  tenant_id                TEXT NOT NULL,
  id                       TEXT NOT NULL,
  name                     TEXT NOT NULL DEFAULT '',
  description              TEXT NOT NULL DEFAULT '',
  compliance_assessment_id TEXT,
  authorization_type       TEXT NOT NULL DEFAULT '',
  status                   TEXT NOT NULL DEFAULT '',
  impact_level             TEXT NOT NULL DEFAULT '',
  authorization_date       TEXT,
  authorization_expiry     TEXT,
  folder_id                TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_gov_authorization_timelines_status
  ON gov_authorization_timelines (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_gov_authorization_timelines_folder
  ON gov_authorization_timelines (tenant_id, folder_id);


-- ===========================================================================
-- 16. ORGANIZATION (prefix: org_)
-- ===========================================================================

-- ---- Organization Units ----
CREATE TABLE IF NOT EXISTS org_units (
  tenant_id   TEXT NOT NULL,
  id          TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  parent_id   TEXT,
  unit_type   TEXT NOT NULL DEFAULT '',
  folder_id   TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_org_units_parent
  ON org_units (tenant_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_org_units_folder
  ON org_units (tenant_id, folder_id);


-- ===========================================================================
-- 17. SETTINGS (prefix: settings_)
-- ===========================================================================

-- ---- Global Settings (singleton per tenant per key) ----
CREATE TABLE IF NOT EXISTS settings_global (
  tenant_id  TEXT NOT NULL,
  id         TEXT NOT NULL,
  key        TEXT NOT NULL DEFAULT '',
  value_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, key)
);

-- ---- Feature Flags ----
CREATE TABLE IF NOT EXISTS settings_feature_flags (
  tenant_id   TEXT NOT NULL,
  id          TEXT NOT NULL,
  flag_name   TEXT NOT NULL DEFAULT '',
  enabled     INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, flag_name)
);


-- ===========================================================================
-- 18. IAM (prefix: iam_)
-- ===========================================================================

-- ---- Users ----
CREATE TABLE IF NOT EXISTS iam_users (
  tenant_id    TEXT NOT NULL,
  id           TEXT NOT NULL,
  email        TEXT NOT NULL DEFAULT '',
  first_name   TEXT NOT NULL DEFAULT '',
  last_name    TEXT NOT NULL DEFAULT '',
  is_active    INTEGER NOT NULL DEFAULT 1,
  is_superuser INTEGER NOT NULL DEFAULT 0,
  date_joined  TEXT,
  last_login   TEXT,
  folder_id    TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_iam_users_email
  ON iam_users (tenant_id, email);

CREATE INDEX IF NOT EXISTS idx_iam_users_active
  ON iam_users (tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_iam_users_folder
  ON iam_users (tenant_id, folder_id);

-- ---- User Groups ----
CREATE TABLE IF NOT EXISTS iam_user_groups (
  tenant_id        TEXT NOT NULL,
  id               TEXT NOT NULL,
  name             TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  permissions_json TEXT NOT NULL DEFAULT '[]',
  folder_id        TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_iam_user_groups_folder
  ON iam_user_groups (tenant_id, folder_id);

-- ---- Role Assignments ----
CREATE TABLE IF NOT EXISTS iam_role_assignments (
  tenant_id  TEXT NOT NULL,
  id         TEXT NOT NULL,
  user_id    TEXT,
  group_id   TEXT,
  role       TEXT NOT NULL DEFAULT '',
  folder_id  TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_iam_role_assignments_user
  ON iam_role_assignments (tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_iam_role_assignments_group
  ON iam_role_assignments (tenant_id, group_id);

CREATE INDEX IF NOT EXISTS idx_iam_role_assignments_folder
  ON iam_role_assignments (tenant_id, folder_id);


-- ===========================================================================
-- 19. VENDOR PORTAL (prefix: vp_)
-- ===========================================================================

-- ---- Questionnaire Responses ----
CREATE TABLE IF NOT EXISTS vp_questionnaire_responses (
  tenant_id                TEXT NOT NULL,
  id                       TEXT NOT NULL,
  token                    TEXT NOT NULL DEFAULT '',
  entity_id                TEXT,
  questionnaire_data_json  TEXT NOT NULL DEFAULT '{}',
  status                   TEXT NOT NULL DEFAULT '',
  submitted_at             TEXT,
  folder_id                TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_vp_questionnaire_responses_status
  ON vp_questionnaire_responses (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_vp_questionnaire_responses_entity
  ON vp_questionnaire_responses (tenant_id, entity_id);

CREATE INDEX IF NOT EXISTS idx_vp_questionnaire_responses_folder
  ON vp_questionnaire_responses (tenant_id, folder_id);

-- ---- Evidence Submissions ----
CREATE TABLE IF NOT EXISTS vp_evidence_submissions (
  tenant_id     TEXT NOT NULL,
  id            TEXT NOT NULL,
  token         TEXT NOT NULL DEFAULT '',
  entity_id     TEXT,
  evidence_type TEXT NOT NULL DEFAULT '',
  r2_key        TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT '',
  submitted_at  TEXT,
  folder_id     TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_vp_evidence_submissions_status
  ON vp_evidence_submissions (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_vp_evidence_submissions_entity
  ON vp_evidence_submissions (tenant_id, entity_id);

CREATE INDEX IF NOT EXISTS idx_vp_evidence_submissions_folder
  ON vp_evidence_submissions (tenant_id, folder_id);


-- ===========================================================================
-- 20. READ MODEL PROJECTIONS (prefix: rm_)
-- ===========================================================================

-- ---- GRC Overview ----
CREATE TABLE IF NOT EXISTS rm_grc_overview (
  tenant_id   TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT '',
  ref_id      TEXT NOT NULL DEFAULT '',
  parent_id   TEXT,
  folder_id   TEXT,
  score       REAL,
  extra_json  TEXT NOT NULL DEFAULT '{}',
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_grc_overview_status
  ON rm_grc_overview (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rm_grc_overview_type_updated
  ON rm_grc_overview (tenant_id, entity_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rm_grc_overview_folder
  ON rm_grc_overview (tenant_id, folder_id);

-- ---- TPRM Overview ----
CREATE TABLE IF NOT EXISTS rm_tprm_overview (
  tenant_id        TEXT NOT NULL,
  entity_id        TEXT NOT NULL,
  name             TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT '',
  assessment_count INTEGER NOT NULL DEFAULT 0,
  risk_level       TEXT NOT NULL DEFAULT '',
  folder_id        TEXT,
  updated_at       TEXT NOT NULL,
  PRIMARY KEY (tenant_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_tprm_overview_status
  ON rm_tprm_overview (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rm_tprm_overview_folder
  ON rm_tprm_overview (tenant_id, folder_id);

-- ---- EBIOS Study Summary ----
CREATE TABLE IF NOT EXISTS rm_ebios_study_summary (
  tenant_id            TEXT NOT NULL,
  study_id             TEXT NOT NULL,
  name                 TEXT NOT NULL DEFAULT '',
  status               TEXT NOT NULL DEFAULT '',
  feared_events_count  INTEGER NOT NULL DEFAULT 0,
  stakeholders_count   INTEGER NOT NULL DEFAULT 0,
  scenarios_count      INTEGER NOT NULL DEFAULT 0,
  folder_id            TEXT,
  updated_at           TEXT NOT NULL,
  PRIMARY KEY (tenant_id, study_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_ebios_study_summary_status
  ON rm_ebios_study_summary (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rm_ebios_study_summary_folder
  ON rm_ebios_study_summary (tenant_id, folder_id);

-- ---- Privacy Overview ----
CREATE TABLE IF NOT EXISTS rm_privacy_overview (
  tenant_id   TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT '',
  extra_json  TEXT NOT NULL DEFAULT '{}',
  folder_id   TEXT,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_privacy_overview_type_updated
  ON rm_privacy_overview (tenant_id, entity_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rm_privacy_overview_folder
  ON rm_privacy_overview (tenant_id, folder_id);

-- ---- BC Plan Status ----
CREATE TABLE IF NOT EXISTS rm_bc_plan_status (
  tenant_id       TEXT NOT NULL,
  plan_id         TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT '',
  task_count      INTEGER NOT NULL DEFAULT 0,
  completed_tasks INTEGER NOT NULL DEFAULT 0,
  last_tested     TEXT,
  folder_id       TEXT,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (tenant_id, plan_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_bc_plan_status_status
  ON rm_bc_plan_status (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rm_bc_plan_status_folder
  ON rm_bc_plan_status (tenant_id, folder_id);

-- ---- CRQ Portfolio ----
CREATE TABLE IF NOT EXISTS rm_crq_portfolio (
  tenant_id      TEXT NOT NULL,
  study_id       TEXT NOT NULL,
  name           TEXT NOT NULL DEFAULT '',
  total_ale      REAL,
  scenario_count INTEGER NOT NULL DEFAULT 0,
  folder_id      TEXT,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (tenant_id, study_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_crq_portfolio_folder
  ON rm_crq_portfolio (tenant_id, folder_id);

-- ---- RMF Dashboard ----
CREATE TABLE IF NOT EXISTS rm_rmf_dashboard (
  tenant_id            TEXT NOT NULL,
  system_group_id      TEXT NOT NULL,
  name                 TEXT NOT NULL DEFAULT '',
  status               TEXT NOT NULL DEFAULT '',
  impact_level         TEXT NOT NULL DEFAULT '',
  change_request_count INTEGER NOT NULL DEFAULT 0,
  vulnerability_count  INTEGER NOT NULL DEFAULT 0,
  folder_id            TEXT,
  updated_at           TEXT NOT NULL,
  PRIMARY KEY (tenant_id, system_group_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_rmf_dashboard_status
  ON rm_rmf_dashboard (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rm_rmf_dashboard_folder
  ON rm_rmf_dashboard (tenant_id, folder_id);

-- ---- SecOps Dashboard ----
CREATE TABLE IF NOT EXISTS rm_secops_dashboard (
  tenant_id   TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  metric_key  TEXT NOT NULL,
  value       REAL,
  period      TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, metric_type, metric_key)
);

CREATE INDEX IF NOT EXISTS idx_rm_secops_dashboard_type
  ON rm_secops_dashboard (tenant_id, metric_type, updated_at DESC);

-- ---- Metrology Current ----
CREATE TABLE IF NOT EXISTS rm_metrology_current (
  tenant_id     TEXT NOT NULL,
  definition_id TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  current_value REAL,
  status        TEXT NOT NULL DEFAULT '',
  trend         TEXT NOT NULL DEFAULT '',
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, definition_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_metrology_current_status
  ON rm_metrology_current (tenant_id, status, updated_at DESC);

-- ---- Compliance Overview ----
CREATE TABLE IF NOT EXISTS rm_compliance_overview (
  tenant_id         TEXT NOT NULL,
  assessment_id     TEXT NOT NULL,
  name              TEXT NOT NULL DEFAULT '',
  framework_name    TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT '',
  score             REAL,
  requirement_count INTEGER NOT NULL DEFAULT 0,
  compliant_count   INTEGER NOT NULL DEFAULT 0,
  folder_id         TEXT,
  updated_at        TEXT NOT NULL,
  PRIMARY KEY (tenant_id, assessment_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_compliance_overview_status
  ON rm_compliance_overview (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rm_compliance_overview_folder
  ON rm_compliance_overview (tenant_id, folder_id);

-- ---- Asset Inventory ----
CREATE TABLE IF NOT EXISTS rm_asset_inventory (
  tenant_id       TEXT NOT NULL,
  asset_id        TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  asset_type      TEXT NOT NULL DEFAULT '',
  classification  TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT '',
  owner_name      TEXT NOT NULL DEFAULT '',
  folder_id       TEXT,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (tenant_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_asset_inventory_status
  ON rm_asset_inventory (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rm_asset_inventory_type
  ON rm_asset_inventory (tenant_id, asset_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rm_asset_inventory_folder
  ON rm_asset_inventory (tenant_id, folder_id);

-- ---- Resilience Status ----
CREATE TABLE IF NOT EXISTS rm_resilience_status (
  tenant_id         TEXT NOT NULL,
  bia_id            TEXT NOT NULL,
  name              TEXT NOT NULL DEFAULT '',
  process_name      TEXT NOT NULL DEFAULT '',
  rto_hours         INTEGER,
  rpo_hours         INTEGER,
  recovery_priority TEXT NOT NULL DEFAULT '',
  folder_id         TEXT,
  updated_at        TEXT NOT NULL,
  PRIMARY KEY (tenant_id, bia_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_resilience_status_folder
  ON rm_resilience_status (tenant_id, folder_id);

-- ---- Workflow Overview ----
CREATE TABLE IF NOT EXISTS rm_workflow_overview (
  tenant_id     TEXT NOT NULL,
  execution_id  TEXT NOT NULL,
  template_name TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT '',
  current_step  TEXT NOT NULL DEFAULT '',
  started_at    TEXT,
  folder_id     TEXT,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, execution_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_workflow_overview_status
  ON rm_workflow_overview (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rm_workflow_overview_folder
  ON rm_workflow_overview (tenant_id, folder_id);

-- ---- Control Library Index ----
CREATE TABLE IF NOT EXISTS rm_control_library_index (
  tenant_id            TEXT NOT NULL,
  control_id           TEXT NOT NULL,
  ref_id               TEXT NOT NULL DEFAULT '',
  name                 TEXT NOT NULL DEFAULT '',
  category             TEXT NOT NULL DEFAULT '',
  status               TEXT NOT NULL DEFAULT '',
  implementation_count INTEGER NOT NULL DEFAULT 0,
  folder_id            TEXT,
  updated_at           TEXT NOT NULL,
  PRIMARY KEY (tenant_id, control_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_control_library_index_status
  ON rm_control_library_index (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rm_control_library_index_category
  ON rm_control_library_index (tenant_id, category, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rm_control_library_index_folder
  ON rm_control_library_index (tenant_id, folder_id);

-- ---- Governance Overview ----
CREATE TABLE IF NOT EXISTS rm_governance_overview (
  tenant_id   TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT '',
  extra_json  TEXT NOT NULL DEFAULT '{}',
  folder_id   TEXT,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_governance_overview_type_updated
  ON rm_governance_overview (tenant_id, entity_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rm_governance_overview_folder
  ON rm_governance_overview (tenant_id, folder_id);

-- ---- Org Structure ----
CREATE TABLE IF NOT EXISTS rm_org_structure (
  tenant_id  TEXT NOT NULL,
  unit_id    TEXT NOT NULL,
  name       TEXT NOT NULL DEFAULT '',
  parent_id  TEXT,
  unit_type  TEXT NOT NULL DEFAULT '',
  user_count INTEGER NOT NULL DEFAULT 0,
  folder_id  TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_org_structure_parent
  ON rm_org_structure (tenant_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_rm_org_structure_folder
  ON rm_org_structure (tenant_id, folder_id);

-- ---- IAM User Directory ----
CREATE TABLE IF NOT EXISTS rm_iam_user_directory (
  tenant_id   TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  email       TEXT NOT NULL DEFAULT '',
  name        TEXT NOT NULL DEFAULT '',
  is_active   INTEGER NOT NULL DEFAULT 1,
  groups_json TEXT NOT NULL DEFAULT '[]',
  last_login  TEXT,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_iam_user_directory_active
  ON rm_iam_user_directory (tenant_id, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rm_iam_user_directory_email
  ON rm_iam_user_directory (tenant_id, email);

-- ---- Settings Current ----
CREATE TABLE IF NOT EXISTS rm_settings_current (
  tenant_id   TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  value_json  TEXT NOT NULL DEFAULT '{}',
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, setting_key)
);

-- ---- Vendor Portal Status ----
CREATE TABLE IF NOT EXISTS rm_vendor_portal_status (
  tenant_id            TEXT NOT NULL,
  entity_id            TEXT NOT NULL,
  entity_name          TEXT NOT NULL DEFAULT '',
  questionnaire_status TEXT NOT NULL DEFAULT '',
  evidence_count       INTEGER NOT NULL DEFAULT 0,
  last_activity        TEXT,
  updated_at           TEXT NOT NULL,
  PRIMARY KEY (tenant_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_vendor_portal_status_questionnaire
  ON rm_vendor_portal_status (tenant_id, questionnaire_status, updated_at DESC);
