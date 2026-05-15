CREATE TABLE IF NOT EXISTS grc_import_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_kind TEXT NOT NULL,
  source_repo TEXT NOT NULL,
  source_revision TEXT NOT NULL,
  artifact_key TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}',
  imported_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grc_frameworks (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  framework_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'framework',
  version TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  scf_framework_id TEXT,
  source_repo TEXT NOT NULL,
  source_path TEXT NOT NULL,
  source_revision TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grc_content_documents (
  id TEXT PRIMARY KEY,
  framework_id TEXT REFERENCES grc_frameworks(id) ON DELETE CASCADE,
  workspace_slug TEXT,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  doc_kind TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'product',
  tags_json TEXT NOT NULL DEFAULT '[]',
  source_repo TEXT NOT NULL,
  source_path TEXT NOT NULL,
  source_revision TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(framework_id, slug),
  UNIQUE(workspace_slug, slug)
);

CREATE TABLE IF NOT EXISTS grc_content_revisions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES grc_content_documents(id) ON DELETE CASCADE,
  body_markdown TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  source_repo TEXT NOT NULL,
  source_path TEXT NOT NULL,
  source_revision TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grc_scf_versions (
  id TEXT PRIMARY KEY,
  scf_version TEXT NOT NULL UNIQUE,
  source_url TEXT NOT NULL,
  summary_json TEXT NOT NULL DEFAULT '{}',
  content_hash TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grc_scf_controls (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES grc_scf_versions(id) ON DELETE CASCADE,
  control_id TEXT NOT NULL,
  family_code TEXT,
  family_name TEXT,
  title TEXT NOT NULL,
  description TEXT,
  evidence_requests_json TEXT NOT NULL DEFAULT '[]',
  profiles_json TEXT NOT NULL DEFAULT '[]',
  raw_json TEXT NOT NULL DEFAULT '{}',
  imported_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(version_id, control_id)
);

CREATE TABLE IF NOT EXISTS grc_scf_crosswalks (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES grc_scf_versions(id) ON DELETE CASCADE,
  framework_id TEXT NOT NULL,
  framework_name TEXT NOT NULL,
  framework_control_id TEXT NOT NULL,
  scf_control_id TEXT NOT NULL,
  raw_json TEXT NOT NULL DEFAULT '{}',
  imported_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(version_id, framework_id, framework_control_id, scf_control_id)
);

CREATE TABLE IF NOT EXISTS grc_connector_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_version TEXT NOT NULL,
  upstream_run_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  scope_json TEXT NOT NULL DEFAULT '{}',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by_user_id TEXT,
  collected_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, source, upstream_run_id)
);

CREATE TABLE IF NOT EXISTS grc_findings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  connector_run_id TEXT NOT NULL REFERENCES grc_connector_runs(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_version TEXT NOT NULL,
  upstream_run_id TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  resource_arn TEXT,
  region TEXT,
  account_id TEXT,
  raw_payload_json TEXT NOT NULL DEFAULT '{}',
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  status_summary TEXT NOT NULL DEFAULT 'unknown',
  severity_summary TEXT NOT NULL DEFAULT 'info',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grc_finding_evaluations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  finding_id TEXT NOT NULL REFERENCES grc_findings(id) ON DELETE CASCADE,
  control_framework TEXT NOT NULL,
  control_id TEXT NOT NULL,
  status TEXT NOT NULL,
  severity TEXT,
  title TEXT,
  message TEXT,
  remediation_summary TEXT,
  remediation_ref TEXT,
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  scf_control_ids_json TEXT NOT NULL DEFAULT '[]',
  raw_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grc_gap_assessments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  source_scopes_json TEXT NOT NULL DEFAULT '[]',
  frameworks_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ready',
  findings_count INTEGER NOT NULL DEFAULT 0,
  gap_count INTEGER NOT NULL DEFAULT 0,
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grc_gap_assessment_rows (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES grc_gap_assessments(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  scf_control_id TEXT NOT NULL,
  source_framework TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  mapped_targets_json TEXT NOT NULL DEFAULT '[]',
  related_finding_ids_json TEXT NOT NULL DEFAULT '[]',
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  remediation_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grc_report_bundles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL REFERENCES grc_gap_assessments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  report_family TEXT NOT NULL DEFAULT 'gap-assessment',
  artifact_key TEXT,
  ai_provider TEXT,
  narrative_summary TEXT,
  manifest_json TEXT NOT NULL DEFAULT '{}',
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grc_ai_provider_settings (
  tenant_id TEXT PRIMARY KEY,
  default_provider TEXT NOT NULL DEFAULT 'cloudflare-workers-ai',
  openai_enabled INTEGER NOT NULL DEFAULT 0,
  openai_model TEXT,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_grc_frameworks_category ON grc_frameworks(category);
CREATE INDEX IF NOT EXISTS idx_grc_content_documents_framework ON grc_content_documents(framework_id, doc_kind);
CREATE INDEX IF NOT EXISTS idx_grc_scf_crosswalks_framework ON grc_scf_crosswalks(version_id, framework_id, framework_control_id);
CREATE INDEX IF NOT EXISTS idx_grc_scf_crosswalks_scf ON grc_scf_crosswalks(version_id, scf_control_id);
CREATE INDEX IF NOT EXISTS idx_grc_connector_runs_tenant ON grc_connector_runs(tenant_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_grc_findings_tenant ON grc_findings(tenant_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_grc_findings_resource ON grc_findings(tenant_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_grc_finding_evaluations_finding ON grc_finding_evaluations(finding_id);
CREATE INDEX IF NOT EXISTS idx_grc_gap_assessments_tenant ON grc_gap_assessments(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grc_report_bundles_tenant ON grc_report_bundles(tenant_id, created_at DESC);
