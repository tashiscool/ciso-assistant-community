PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rm_connector_health (
  tenant_id TEXT NOT NULL,
  connector_instance_id TEXT NOT NULL,
  status TEXT NOT NULL,
  last_sync_at TEXT,
  last_error TEXT,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, connector_instance_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_connector_health_status
  ON rm_connector_health (tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS rm_conmon_dashboard (
  tenant_id TEXT NOT NULL,
  dashboard_key TEXT NOT NULL,
  counters_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, dashboard_key)
);

CREATE TABLE IF NOT EXISTS rm_poam_status (
  tenant_id TEXT NOT NULL,
  poam_item_id TEXT NOT NULL,
  status TEXT NOT NULL,
  summary_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, poam_item_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_poam_status
  ON rm_poam_status (tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS rm_security_graph_nodes (
  tenant_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  label TEXT NOT NULL,
  attributes_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, node_id)
);

CREATE TABLE IF NOT EXISTS rm_security_graph_edges (
  tenant_id TEXT NOT NULL,
  edge_id TEXT NOT NULL,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  edge_type TEXT NOT NULL,
  attributes_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, edge_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_security_graph_edges_source
  ON rm_security_graph_edges (tenant_id, source_node_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rm_security_graph_edges_target
  ON rm_security_graph_edges (tenant_id, target_node_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS rm_risk_register_overview (
  tenant_id TEXT NOT NULL,
  risk_type TEXT NOT NULL,
  overview_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, risk_type)
);

CREATE TABLE IF NOT EXISTS rm_compliance_posture (
  tenant_id TEXT NOT NULL,
  framework_id TEXT NOT NULL,
  posture_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, framework_id)
);

CREATE TABLE IF NOT EXISTS rm_vendor_questionnaire_status (
  tenant_id TEXT NOT NULL,
  questionnaire_id TEXT NOT NULL,
  status TEXT NOT NULL,
  summary_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, questionnaire_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_vendor_questionnaire_status
  ON rm_vendor_questionnaire_status (tenant_id, status, updated_at DESC);
