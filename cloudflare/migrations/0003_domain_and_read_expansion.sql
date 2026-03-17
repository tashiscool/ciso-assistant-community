PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS r2_artifacts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  object_type TEXT NOT NULL,
  bucket TEXT NOT NULL,
  object_key TEXT NOT NULL,
  object_group TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  checksum TEXT,
  retention_class TEXT NOT NULL DEFAULT 'short',
  status TEXT NOT NULL DEFAULT 'issued',
  pinned INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, object_key)
);

CREATE INDEX IF NOT EXISTS idx_r2_artifacts_tenant_type
  ON r2_artifacts (tenant_id, object_type, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_r2_artifacts_expiry
  ON r2_artifacts (expires_at, pinned, updated_at);

CREATE TABLE IF NOT EXISTS job_artifacts (
  job_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (job_id, artifact_id),
  FOREIGN KEY(job_id) REFERENCES jobs(id),
  FOREIGN KEY(artifact_id) REFERENCES r2_artifacts(id)
);

CREATE TABLE IF NOT EXISTS connector_instances (
  tenant_id TEXT NOT NULL,
  connector_instance_id TEXT NOT NULL,
  connector_type TEXT NOT NULL,
  status TEXT NOT NULL,
  last_sync_at TEXT,
  last_error TEXT,
  config_json TEXT NOT NULL DEFAULT '{}',
  metrics_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, connector_instance_id)
);

CREATE INDEX IF NOT EXISTS idx_connector_instances_status
  ON connector_instances (tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS lightning_assessments (
  tenant_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  status TEXT NOT NULL,
  score REAL,
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, assessment_id)
);

CREATE INDEX IF NOT EXISTS idx_lightning_assessments_status
  ON lightning_assessments (tenant_id, framework_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS version_history_snapshots (
  tenant_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  version_label TEXT NOT NULL,
  snapshot_ref TEXT NOT NULL,
  created_by_command_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, snapshot_id)
);

CREATE INDEX IF NOT EXISTS idx_version_history_resource
  ON version_history_snapshots (tenant_id, resource_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS security_graph_ingest_jobs (
  tenant_id TEXT NOT NULL,
  ingest_job_id TEXT NOT NULL,
  status TEXT NOT NULL,
  graph_ref TEXT,
  node_count INTEGER NOT NULL DEFAULT 0,
  edge_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, ingest_job_id)
);

CREATE INDEX IF NOT EXISTS idx_security_graph_ingest_jobs_status
  ON security_graph_ingest_jobs (tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS evidence_automation_runs (
  tenant_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  status TEXT NOT NULL,
  artifact_ref TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, run_id)
);

CREATE INDEX IF NOT EXISTS idx_evidence_automation_runs_status
  ON evidence_automation_runs (tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS workflow_executions (
  tenant_id TEXT NOT NULL,
  execution_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_step TEXT,
  last_error TEXT,
  context_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, execution_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_status
  ON workflow_executions (tenant_id, workflow_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS oscal_jobs (
  tenant_id TEXT NOT NULL,
  oscal_job_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  source_ref TEXT,
  output_ref TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, oscal_job_id)
);

CREATE INDEX IF NOT EXISTS idx_oscal_jobs_status
  ON oscal_jobs (tenant_id, job_type, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS conmon_activity (
  tenant_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  status TEXT NOT NULL,
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, activity_id)
);

CREATE INDEX IF NOT EXISTS idx_conmon_activity_status
  ON conmon_activity (tenant_id, activity_type, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS poam_items (
  tenant_id TEXT NOT NULL,
  poam_item_id TEXT NOT NULL,
  status TEXT NOT NULL,
  due_at TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, poam_item_id)
);

CREATE INDEX IF NOT EXISTS idx_poam_items_status
  ON poam_items (tenant_id, status, due_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_assistant_jobs (
  tenant_id TEXT NOT NULL,
  ai_job_id TEXT NOT NULL,
  status TEXT NOT NULL,
  model_name TEXT,
  prompt_ref TEXT,
  result_ref TEXT,
  error TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, ai_job_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_assistant_jobs_status
  ON ai_assistant_jobs (tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS vendor_scoring_jobs (
  tenant_id TEXT NOT NULL,
  scoring_id TEXT NOT NULL,
  vendor_id TEXT NOT NULL,
  status TEXT NOT NULL,
  score REAL,
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, scoring_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_scoring_jobs_status
  ON vendor_scoring_jobs (tenant_id, vendor_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS vendor_questionnaires (
  tenant_id TEXT NOT NULL,
  questionnaire_id TEXT NOT NULL,
  status TEXT NOT NULL,
  response_ref TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, questionnaire_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_questionnaires_status
  ON vendor_questionnaires (tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS library_index_jobs (
  tenant_id TEXT NOT NULL,
  library_job_id TEXT NOT NULL,
  library_id TEXT NOT NULL,
  status TEXT NOT NULL,
  source_ref TEXT,
  item_count INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, library_job_id)
);

CREATE INDEX IF NOT EXISTS idx_library_index_jobs_status
  ON library_index_jobs (tenant_id, library_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS fedramp_automation_jobs (
  tenant_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  framework TEXT NOT NULL,
  status TEXT NOT NULL,
  result_ref TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, run_id)
);

CREATE INDEX IF NOT EXISTS idx_fedramp_automation_jobs_status
  ON fedramp_automation_jobs (tenant_id, framework, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS crq_compute_jobs (
  tenant_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  status TEXT NOT NULL,
  result_ref TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, run_id)
);

CREATE INDEX IF NOT EXISTS idx_crq_compute_jobs_status
  ON crq_compute_jobs (tenant_id, model_name, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS mapping_jobs (
  tenant_id TEXT NOT NULL,
  mapping_job_id TEXT NOT NULL,
  source_framework TEXT NOT NULL,
  target_framework TEXT NOT NULL,
  status TEXT NOT NULL,
  result_ref TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, mapping_job_id)
);

CREATE INDEX IF NOT EXISTS idx_mapping_jobs_status
  ON mapping_jobs (tenant_id, source_framework, target_framework, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS scanner_ingest_jobs (
  tenant_id TEXT NOT NULL,
  ingest_job_id TEXT NOT NULL,
  ingest_type TEXT NOT NULL,
  status TEXT NOT NULL,
  source_ref TEXT,
  finding_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, ingest_job_id)
);

CREATE INDEX IF NOT EXISTS idx_scanner_ingest_jobs_status
  ON scanner_ingest_jobs (tenant_id, ingest_type, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS integration_sync_jobs (
  tenant_id TEXT NOT NULL,
  sync_job_id TEXT NOT NULL,
  integration_type TEXT NOT NULL,
  status TEXT NOT NULL,
  last_synced_at TEXT,
  last_error TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, sync_job_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_jobs_status
  ON integration_sync_jobs (tenant_id, integration_type, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS translation_jobs (
  tenant_id TEXT NOT NULL,
  translation_job_id TEXT NOT NULL,
  source_format TEXT NOT NULL,
  target_format TEXT NOT NULL,
  status TEXT NOT NULL,
  source_ref TEXT,
  output_ref TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, translation_job_id)
);

CREATE INDEX IF NOT EXISTS idx_translation_jobs_status
  ON translation_jobs (tenant_id, source_format, target_format, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS legacy_domain_state (
  tenant_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  command_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'updated',
  state_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, domain, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_legacy_domain_state_status
  ON legacy_domain_state (tenant_id, domain, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS rm_lightning_assessment_summary (
  tenant_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  status TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  score REAL,
  summary_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, assessment_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_lightning_assessment_summary_status
  ON rm_lightning_assessment_summary (tenant_id, framework_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS rm_version_history_latest (
  tenant_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  snapshot_ref TEXT,
  version_label TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_version_history_latest_snapshot
  ON rm_version_history_latest (tenant_id, snapshot_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS rm_evidence_automation_status (
  tenant_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  status TEXT NOT NULL,
  last_collected_at TEXT,
  artifact_ref TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, run_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_evidence_automation_status
  ON rm_evidence_automation_status (tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS rm_workflow_execution_status (
  tenant_id TEXT NOT NULL,
  execution_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_step TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, execution_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_workflow_execution_status
  ON rm_workflow_execution_status (tenant_id, workflow_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS rm_oscal_job_status (
  tenant_id TEXT NOT NULL,
  oscal_job_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  source_ref TEXT,
  output_ref TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, oscal_job_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_oscal_job_status
  ON rm_oscal_job_status (tenant_id, job_type, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS rm_ai_assistant_status (
  tenant_id TEXT NOT NULL,
  ai_job_id TEXT NOT NULL,
  status TEXT NOT NULL,
  model_name TEXT,
  result_ref TEXT,
  error TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, ai_job_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_ai_assistant_status
  ON rm_ai_assistant_status (tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS rm_vendor_scoring_summary (
  tenant_id TEXT NOT NULL,
  scoring_id TEXT NOT NULL,
  vendor_id TEXT NOT NULL,
  status TEXT NOT NULL,
  score REAL,
  summary_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, scoring_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_vendor_scoring_summary
  ON rm_vendor_scoring_summary (tenant_id, vendor_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS rm_framework_library_index (
  tenant_id TEXT NOT NULL,
  library_id TEXT NOT NULL,
  status TEXT NOT NULL,
  index_ref TEXT,
  item_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, library_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_framework_library_index
  ON rm_framework_library_index (tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS rm_fedramp_automation_status (
  tenant_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  status TEXT NOT NULL,
  framework TEXT NOT NULL,
  result_ref TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, run_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_fedramp_automation_status
  ON rm_fedramp_automation_status (tenant_id, framework, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS rm_crq_summary (
  tenant_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  status TEXT NOT NULL,
  model_name TEXT NOT NULL,
  loss_exposure REAL,
  result_ref TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, run_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_crq_summary
  ON rm_crq_summary (tenant_id, model_name, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS rm_mapping_summary (
  tenant_id TEXT NOT NULL,
  mapping_job_id TEXT NOT NULL,
  status TEXT NOT NULL,
  source_framework TEXT,
  target_framework TEXT,
  result_ref TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, mapping_job_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_mapping_summary
  ON rm_mapping_summary (tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS rm_scanner_finding_summary (
  tenant_id TEXT NOT NULL,
  ingest_job_id TEXT NOT NULL,
  ingest_type TEXT NOT NULL,
  status TEXT NOT NULL,
  finding_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  source_ref TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, ingest_job_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_scanner_finding_summary
  ON rm_scanner_finding_summary (tenant_id, ingest_type, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS rm_integration_sync_status (
  tenant_id TEXT NOT NULL,
  sync_job_id TEXT NOT NULL,
  integration_type TEXT NOT NULL,
  status TEXT NOT NULL,
  last_synced_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, sync_job_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_integration_sync_status
  ON rm_integration_sync_status (tenant_id, integration_type, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS rm_translation_status (
  tenant_id TEXT NOT NULL,
  translation_job_id TEXT NOT NULL,
  status TEXT NOT NULL,
  source_format TEXT NOT NULL,
  target_format TEXT NOT NULL,
  output_ref TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, translation_job_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_translation_status
  ON rm_translation_status (tenant_id, source_format, target_format, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS rm_legacy_domain_overview (
  tenant_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  status TEXT NOT NULL,
  summary_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, domain, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_legacy_domain_overview
  ON rm_legacy_domain_overview (tenant_id, domain, status, updated_at DESC);
