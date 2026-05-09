-- 0030_assurance_foundation.sql
-- Observable Security Agent parity foundation: richer parent run metadata plus assurance/agent child tables.

PRAGMA foreign_keys = ON;

ALTER TABLE evidence_jobs ADD COLUMN folder_id TEXT;
ALTER TABLE evidence_jobs ADD COLUMN run_family TEXT NOT NULL DEFAULT 'evidence_collection';
ALTER TABLE evidence_jobs ADD COLUMN input_mode TEXT NOT NULL DEFAULT 'live';
ALTER TABLE evidence_jobs ADD COLUMN bundle_kind TEXT NOT NULL DEFAULT 'assessment';
ALTER TABLE evidence_jobs ADD COLUMN manifest_key TEXT;
ALTER TABLE evidence_jobs ADD COLUMN normalization_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE evidence_jobs ADD COLUMN coverage_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE evidence_jobs ADD COLUMN error_summary_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE evidence_jobs ADD COLUMN source_schema_version TEXT NOT NULL DEFAULT 'v1';
ALTER TABLE evidence_jobs ADD COLUMN adapter_hints_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE conmon_executions ADD COLUMN folder_id TEXT;
ALTER TABLE conmon_executions ADD COLUMN run_family TEXT NOT NULL DEFAULT 'conmon_execution';
ALTER TABLE conmon_executions ADD COLUMN input_mode TEXT NOT NULL DEFAULT 'live';
ALTER TABLE conmon_executions ADD COLUMN manifest_key TEXT;
ALTER TABLE conmon_executions ADD COLUMN normalization_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE conmon_executions ADD COLUMN coverage_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE conmon_executions ADD COLUMN error_summary_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE conmon_executions ADD COLUMN source_schema_version TEXT NOT NULL DEFAULT 'v1';

ALTER TABLE import_jobs ADD COLUMN run_family TEXT NOT NULL DEFAULT 'import';
ALTER TABLE import_jobs ADD COLUMN input_mode TEXT NOT NULL DEFAULT 'live';
ALTER TABLE import_jobs ADD COLUMN manifest_key TEXT;
ALTER TABLE import_jobs ADD COLUMN normalization_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE import_jobs ADD COLUMN coverage_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE import_jobs ADD COLUMN error_summary_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE import_jobs ADD COLUMN source_schema_version TEXT NOT NULL DEFAULT 'v1';

ALTER TABLE ai_compliance_export_jobs ADD COLUMN run_family TEXT NOT NULL DEFAULT 'compliance_export';
ALTER TABLE ai_compliance_export_jobs ADD COLUMN manifest_key TEXT;
ALTER TABLE ai_compliance_export_jobs ADD COLUMN coverage_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE ai_compliance_export_jobs ADD COLUMN error_summary_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE ai_compliance_export_jobs ADD COLUMN source_schema_version TEXT NOT NULL DEFAULT 'v1';

ALTER TABLE integration_connector_runs ADD COLUMN folder_id TEXT;
ALTER TABLE integration_connector_runs ADD COLUMN run_family TEXT NOT NULL DEFAULT 'connector_run';
ALTER TABLE integration_connector_runs ADD COLUMN input_mode TEXT NOT NULL DEFAULT 'live';
ALTER TABLE integration_connector_runs ADD COLUMN manifest_key TEXT;
ALTER TABLE integration_connector_runs ADD COLUMN normalization_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE integration_connector_runs ADD COLUMN coverage_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE integration_connector_runs ADD COLUMN error_summary_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE integration_connector_runs ADD COLUMN source_schema_version TEXT NOT NULL DEFAULT 'v1';

ALTER TABLE evidence_artifacts ADD COLUMN artifact_family TEXT NOT NULL DEFAULT 'raw';
ALTER TABLE evidence_artifacts ADD COLUMN manifest_group TEXT;

CREATE INDEX IF NOT EXISTS idx_evidence_jobs_tenant_family
  ON evidence_jobs (tenant_id, run_family, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conmon_executions_tenant_family
  ON conmon_executions (tenant_id, run_family, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_jobs_tenant_family
  ON import_jobs (tenant_id, run_family, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_compliance_export_jobs_tenant_family
  ON ai_compliance_export_jobs (tenant_id, run_family, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_connector_runs_tenant_family
  ON integration_connector_runs (tenant_id, run_family, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_artifacts_job_family
  ON evidence_artifacts (job_id, artifact_family, created_at DESC);

CREATE TABLE IF NOT EXISTS assurance_bundle_assets (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  folder_id         TEXT,
  evidence_job_id   TEXT NOT NULL,
  asset_key         TEXT NOT NULL,
  asset_origin      TEXT NOT NULL,
  asset_type        TEXT,
  name              TEXT NOT NULL,
  environment       TEXT,
  owner_name        TEXT,
  account_id        TEXT,
  region            TEXT,
  in_boundary       INTEGER NOT NULL DEFAULT 0,
  is_public         INTEGER NOT NULL DEFAULT 0,
  attributes_json   TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (evidence_job_id) REFERENCES evidence_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assurance_bundle_assets_job
  ON assurance_bundle_assets (evidence_job_id, asset_origin, asset_key);

CREATE TABLE IF NOT EXISTS assurance_bundle_events (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  folder_id         TEXT,
  evidence_job_id   TEXT NOT NULL,
  event_id          TEXT NOT NULL,
  asset_key         TEXT,
  semantic_type     TEXT NOT NULL,
  severity          TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open',
  central_event_ref TEXT,
  attributes_json   TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (evidence_job_id) REFERENCES evidence_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assurance_bundle_events_job
  ON assurance_bundle_events (evidence_job_id, semantic_type, severity);

CREATE TABLE IF NOT EXISTS assurance_bundle_findings (
  id                      TEXT PRIMARY KEY,
  tenant_id               TEXT NOT NULL,
  folder_id               TEXT,
  evidence_job_id         TEXT NOT NULL,
  finding_id              TEXT NOT NULL,
  asset_key               TEXT,
  severity                TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'open',
  title                   TEXT NOT NULL,
  cve_ids_json            TEXT NOT NULL DEFAULT '[]',
  linked_ticket_ids_json  TEXT NOT NULL DEFAULT '[]',
  exploitation_review_json TEXT NOT NULL DEFAULT '{}',
  attributes_json         TEXT NOT NULL DEFAULT '{}',
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (evidence_job_id) REFERENCES evidence_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assurance_bundle_findings_job
  ON assurance_bundle_findings (evidence_job_id, severity, status);

CREATE TABLE IF NOT EXISTS assurance_bundle_scanner_targets (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  folder_id         TEXT,
  evidence_job_id   TEXT NOT NULL,
  target_id         TEXT NOT NULL,
  asset_key         TEXT,
  scanner_name      TEXT NOT NULL,
  hostname          TEXT,
  ip_address        TEXT,
  credentialed      INTEGER NOT NULL DEFAULT 0,
  last_scan_time    TEXT,
  attributes_json   TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (evidence_job_id) REFERENCES evidence_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assurance_bundle_scanner_targets_job
  ON assurance_bundle_scanner_targets (evidence_job_id, scanner_name, asset_key);

CREATE TABLE IF NOT EXISTS assurance_bundle_log_sources (
  id                      TEXT PRIMARY KEY,
  tenant_id               TEXT NOT NULL,
  folder_id               TEXT,
  evidence_job_id         TEXT NOT NULL,
  source_id               TEXT NOT NULL,
  asset_key               TEXT,
  source_type             TEXT,
  local_source            TEXT,
  central_destination     TEXT,
  status                  TEXT NOT NULL DEFAULT 'missing',
  sample_local_event_ref  TEXT,
  sample_central_event_ref TEXT,
  last_seen               TEXT,
  attributes_json         TEXT NOT NULL DEFAULT '{}',
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (evidence_job_id) REFERENCES evidence_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assurance_bundle_log_sources_job
  ON assurance_bundle_log_sources (evidence_job_id, status, asset_key);

CREATE TABLE IF NOT EXISTS assurance_bundle_alert_rules (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  folder_id         TEXT,
  evidence_job_id   TEXT NOT NULL,
  rule_id           TEXT NOT NULL,
  name              TEXT NOT NULL,
  enabled           INTEGER NOT NULL DEFAULT 1,
  semantic_types_json TEXT NOT NULL DEFAULT '[]',
  recipients_json   TEXT NOT NULL DEFAULT '[]',
  last_fired        TEXT,
  attributes_json   TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (evidence_job_id) REFERENCES evidence_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assurance_bundle_alert_rules_job
  ON assurance_bundle_alert_rules (evidence_job_id, enabled);

CREATE TABLE IF NOT EXISTS assurance_bundle_tickets (
  id                        TEXT PRIMARY KEY,
  tenant_id                 TEXT NOT NULL,
  folder_id                 TEXT,
  evidence_job_id           TEXT NOT NULL,
  ticket_id                 TEXT NOT NULL,
  title                     TEXT NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'open',
  linked_asset_keys_json    TEXT NOT NULL DEFAULT '[]',
  linked_event_ids_json     TEXT NOT NULL DEFAULT '[]',
  linked_finding_ids_json   TEXT NOT NULL DEFAULT '[]',
  has_security_impact_analysis INTEGER NOT NULL DEFAULT 0,
  has_testing_evidence      INTEGER NOT NULL DEFAULT 0,
  has_approval              INTEGER NOT NULL DEFAULT 0,
  has_deployment_evidence   INTEGER NOT NULL DEFAULT 0,
  has_verification_evidence INTEGER NOT NULL DEFAULT 0,
  attributes_json           TEXT NOT NULL DEFAULT '{}',
  created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (evidence_job_id) REFERENCES evidence_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assurance_bundle_tickets_job
  ON assurance_bundle_tickets (evidence_job_id, status);

CREATE TABLE IF NOT EXISTS assurance_eval_results (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  folder_id         TEXT,
  evidence_job_id   TEXT NOT NULL,
  eval_code         TEXT NOT NULL,
  title             TEXT NOT NULL,
  status            TEXT NOT NULL,
  severity          TEXT NOT NULL,
  summary           TEXT NOT NULL,
  rationale         TEXT NOT NULL,
  metrics_json      TEXT NOT NULL DEFAULT '{}',
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (evidence_job_id) REFERENCES evidence_jobs(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assurance_eval_results_job_code
  ON assurance_eval_results (evidence_job_id, eval_code);

CREATE TABLE IF NOT EXISTS assurance_evidence_gaps (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  folder_id           TEXT,
  evidence_job_id     TEXT NOT NULL,
  eval_result_id      TEXT,
  gap_type            TEXT NOT NULL,
  severity            TEXT NOT NULL,
  title               TEXT NOT NULL,
  detail              TEXT NOT NULL,
  affected_object_type TEXT,
  affected_object_id  TEXT,
  control_refs_json   TEXT NOT NULL DEFAULT '[]',
  ksi_refs_json       TEXT NOT NULL DEFAULT '[]',
  recommended_artifact TEXT,
  poam_required       INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (evidence_job_id) REFERENCES evidence_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (eval_result_id) REFERENCES assurance_eval_results(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_assurance_evidence_gaps_job
  ON assurance_evidence_gaps (evidence_job_id, severity, gap_type);

CREATE TABLE IF NOT EXISTS assurance_poam_items (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  folder_id           TEXT,
  evidence_job_id     TEXT NOT NULL,
  source_gap_id       TEXT,
  identifier          TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'open',
  severity            TEXT NOT NULL,
  weakness_name       TEXT NOT NULL,
  weakness_description TEXT NOT NULL,
  planned_remediation TEXT NOT NULL,
  milestone_due_date  TEXT,
  source_eval_code    TEXT,
  control_refs_json   TEXT NOT NULL DEFAULT '[]',
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (evidence_job_id) REFERENCES evidence_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (source_gap_id) REFERENCES assurance_evidence_gaps(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_assurance_poam_items_job
  ON assurance_poam_items (evidence_job_id, status, severity);

CREATE TABLE IF NOT EXISTS assurance_graph_nodes (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  folder_id         TEXT,
  evidence_job_id   TEXT NOT NULL,
  node_key          TEXT NOT NULL,
  node_type         TEXT NOT NULL,
  label             TEXT NOT NULL,
  attributes_json   TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (evidence_job_id) REFERENCES evidence_jobs(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assurance_graph_nodes_job_key
  ON assurance_graph_nodes (evidence_job_id, node_key);

CREATE TABLE IF NOT EXISTS assurance_graph_edges (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  folder_id         TEXT,
  evidence_job_id   TEXT NOT NULL,
  edge_type         TEXT NOT NULL,
  from_node_key     TEXT NOT NULL,
  to_node_key       TEXT NOT NULL,
  attributes_json   TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (evidence_job_id) REFERENCES evidence_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assurance_graph_edges_job
  ON assurance_graph_edges (evidence_job_id, from_node_key, to_node_key);

CREATE TABLE IF NOT EXISTS assurance_reconciliation_runs (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  folder_id         TEXT,
  evidence_job_id   TEXT NOT NULL,
  package_job_id    TEXT NOT NULL,
  status            TEXT NOT NULL,
  summary_json      TEXT NOT NULL DEFAULT '{}',
  diff_json         TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (evidence_job_id) REFERENCES evidence_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (package_job_id) REFERENCES ai_compliance_export_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assurance_reconciliation_runs_job
  ON assurance_reconciliation_runs (package_job_id, created_at DESC);

CREATE TABLE IF NOT EXISTS assurance_review_recommendations (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  folder_id         TEXT,
  evidence_job_id   TEXT,
  target_type       TEXT NOT NULL,
  target_id         TEXT NOT NULL,
  title             TEXT NOT NULL,
  summary           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  recommendation_json TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (evidence_job_id) REFERENCES evidence_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assurance_review_recommendations_job
  ON assurance_review_recommendations (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS assurance_review_decisions (
  id                     TEXT PRIMARY KEY,
  tenant_id              TEXT NOT NULL,
  recommendation_id      TEXT NOT NULL,
  evidence_job_id        TEXT,
  decision               TEXT NOT NULL,
  justification          TEXT NOT NULL,
  evidence_refs_json     TEXT NOT NULL DEFAULT '[]',
  finding_refs_json      TEXT NOT NULL DEFAULT '[]',
  control_refs_json      TEXT NOT NULL DEFAULT '[]',
  decided_by_user_id     TEXT,
  created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (recommendation_id) REFERENCES assurance_review_recommendations(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_job_id) REFERENCES evidence_jobs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_assurance_review_decisions_recommendation
  ON assurance_review_decisions (recommendation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS assurance_tracker_row_diagnostics (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  folder_id         TEXT,
  import_job_id     TEXT NOT NULL,
  row_index         INTEGER NOT NULL,
  row_key           TEXT,
  row_status        TEXT NOT NULL,
  category          TEXT,
  owner_name        TEXT,
  gap_type          TEXT,
  severity          TEXT,
  detail            TEXT NOT NULL,
  control_refs_json TEXT NOT NULL DEFAULT '[]',
  recommendation_json TEXT NOT NULL DEFAULT '{}',
  raw_row_json      TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assurance_tracker_row_diagnostics_job
  ON assurance_tracker_row_diagnostics (import_job_id, row_index ASC);

CREATE TABLE IF NOT EXISTS assurance_agent_runs (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  folder_id         TEXT,
  evidence_job_id   TEXT,
  import_job_id     TEXT,
  status            TEXT NOT NULL,
  workflow_name     TEXT NOT NULL,
  requested_writebacks INTEGER NOT NULL DEFAULT 0,
  trace_key         TEXT,
  summary_key       TEXT,
  summary_json      TEXT NOT NULL DEFAULT '{}',
  created_by_user_id TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (evidence_job_id) REFERENCES evidence_jobs(id) ON DELETE SET NULL,
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_assurance_agent_runs_tenant_created
  ON assurance_agent_runs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS assurance_agent_steps (
  id                TEXT PRIMARY KEY,
  agent_run_id      TEXT NOT NULL,
  step_order        INTEGER NOT NULL,
  action_category   TEXT NOT NULL,
  action_id         TEXT NOT NULL,
  status            TEXT NOT NULL,
  input_json        TEXT NOT NULL DEFAULT '{}',
  output_json       TEXT NOT NULL DEFAULT '{}',
  started_at        TEXT NOT NULL,
  finished_at       TEXT,
  FOREIGN KEY (agent_run_id) REFERENCES assurance_agent_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assurance_agent_steps_run_order
  ON assurance_agent_steps (agent_run_id, step_order ASC);

CREATE TABLE IF NOT EXISTS assurance_agent_policy_decisions (
  id                TEXT PRIMARY KEY,
  agent_run_id      TEXT NOT NULL,
  agent_step_id     TEXT,
  action_id         TEXT NOT NULL,
  allowed           INTEGER NOT NULL DEFAULT 0,
  category          TEXT NOT NULL,
  reason            TEXT NOT NULL,
  decision_json     TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (agent_run_id) REFERENCES assurance_agent_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_step_id) REFERENCES assurance_agent_steps(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_assurance_agent_policy_decisions_run
  ON assurance_agent_policy_decisions (agent_run_id, created_at ASC);

CREATE TABLE IF NOT EXISTS assurance_writeback_approvals (
  id                   TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL,
  folder_id            TEXT,
  agent_run_id         TEXT NOT NULL,
  connector_id         TEXT,
  request_type         TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending',
  payload_json         TEXT NOT NULL DEFAULT '{}',
  evidence_refs_json   TEXT NOT NULL DEFAULT '[]',
  requested_by_user_id TEXT,
  reviewed_by_user_id  TEXT,
  justification        TEXT,
  integration_run_id   TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (agent_run_id) REFERENCES assurance_agent_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (connector_id) REFERENCES integration_connectors(id) ON DELETE SET NULL,
  FOREIGN KEY (integration_run_id) REFERENCES integration_connector_runs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_assurance_writeback_approvals_run
  ON assurance_writeback_approvals (agent_run_id, status, created_at DESC);
