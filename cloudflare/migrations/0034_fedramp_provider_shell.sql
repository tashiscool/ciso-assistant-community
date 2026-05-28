CREATE TABLE IF NOT EXISTS trust_center_offerings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  fedramp_id TEXT,
  marketplace_url TEXT,
  service_model TEXT,
  deployment_model TEXT,
  business_category TEXT,
  uei TEXT,
  contact_email TEXT,
  support_email TEXT,
  trust_center_url TEXT,
  access_guidance TEXT,
  availability_status TEXT NOT NULL DEFAULT 'operational',
  recent_disruption_summary TEXT,
  next_oar_due_on TEXT,
  next_quarterly_review_on TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trust_center_services (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL REFERENCES trust_center_offerings(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  service_slug TEXT NOT NULL,
  description TEXT,
  security_objectives_json TEXT NOT NULL DEFAULT '[]',
  customer_responsibilities_json TEXT NOT NULL DEFAULT '[]',
  secure_configuration_summary TEXT,
  in_scope INTEGER NOT NULL DEFAULT 1,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(offering_id, service_slug)
);

CREATE TABLE IF NOT EXISTS artifact_versions (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL REFERENCES trust_center_offerings(id) ON DELETE CASCADE,
  service_id TEXT REFERENCES trust_center_services(id) ON DELETE SET NULL,
  tenant_id TEXT NOT NULL,
  artifact_kind TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'necessary-parties',
  title TEXT NOT NULL,
  version_label TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'published',
  is_public INTEGER NOT NULL DEFAULT 0,
  is_machine_readable INTEGER NOT NULL DEFAULT 1,
  object_key TEXT,
  content_type TEXT NOT NULL DEFAULT 'application/json; charset=utf-8',
  sha256 TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  published_at TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trust_center_access_grants (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL REFERENCES trust_center_offerings(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  agency_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT NOT NULL,
  grant_type TEXT NOT NULL DEFAULT 'agency',
  status TEXT NOT NULL DEFAULT 'active',
  token_hash TEXT NOT NULL,
  token_hint TEXT,
  issued_at TEXT NOT NULL,
  expires_at TEXT,
  last_accessed_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trust_center_access_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  grant_id TEXT REFERENCES trust_center_access_grants(id) ON DELETE SET NULL,
  artifact_version_id TEXT REFERENCES artifact_versions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  actor_email TEXT,
  actor_name TEXT,
  request_path TEXT,
  user_agent TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agency_contacts (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL REFERENCES trust_center_offerings(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  agency_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'security-reviewer',
  incident_email TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fedramp_messages (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL REFERENCES trust_center_offerings(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  message_type TEXT NOT NULL,
  criticality TEXT NOT NULL DEFAULT 'general',
  subject TEXT NOT NULL,
  body_markdown TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  required_actions_json TEXT NOT NULL DEFAULT '[]',
  due_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fedramp_message_deliveries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  message_id TEXT NOT NULL REFERENCES fedramp_messages(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES agency_contacts(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  recipient_email TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'queued',
  escalation_due_at TEXT,
  acknowledged_at TEXT,
  acknowledged_by TEXT,
  delivery_log_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incident_notifications (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL REFERENCES trust_center_offerings(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  message_id TEXT REFERENCES fedramp_messages(id) ON DELETE SET NULL,
  incident_title TEXT NOT NULL,
  incident_state TEXT NOT NULL DEFAULT 'identified',
  reported_to_fedramp_at TEXT,
  reported_to_cisa_at TEXT,
  agency_notified_at TEXT,
  final_report_due_at TEXT,
  update_cadence_hours INTEGER NOT NULL DEFAULT 24,
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vulnerability_evaluations (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL REFERENCES trust_center_offerings(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  source_control_id TEXT,
  title TEXT NOT NULL,
  detection_source TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  evaluated_at TEXT NOT NULL,
  internet_reachable INTEGER NOT NULL DEFAULT 0,
  likely_exploitable INTEGER NOT NULL DEFAULT 0,
  adverse_impact TEXT NOT NULL DEFAULT 'N2',
  accepted_vulnerability INTEGER NOT NULL DEFAULT 0,
  accepted_reason TEXT,
  overdue INTEGER NOT NULL DEFAULT 0,
  current_status TEXT NOT NULL DEFAULT 'open',
  next_target_date TEXT,
  remediation_summary TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, source_type, source_record_id)
);

CREATE TABLE IF NOT EXISTS vdr_reports (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL REFERENCES trust_center_offerings(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  report_month TEXT NOT NULL,
  title TEXT NOT NULL,
  report_markdown TEXT NOT NULL DEFAULT '',
  report_json TEXT NOT NULL DEFAULT '{}',
  artifact_version_id TEXT REFERENCES artifact_versions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'published',
  published_at TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, report_month)
);

CREATE TABLE IF NOT EXISTS oar_cycles (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL REFERENCES trust_center_offerings(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  cycle_label TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  next_report_due_on TEXT NOT NULL,
  target_review_on TEXT,
  feedback_channel TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  report_markdown TEXT NOT NULL DEFAULT '',
  feedback_addendum_markdown TEXT NOT NULL DEFAULT '',
  summary_json TEXT NOT NULL DEFAULT '{}',
  artifact_version_id TEXT REFERENCES artifact_versions(id) ON DELETE SET NULL,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quarterly_reviews (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL REFERENCES trust_center_offerings(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  oar_cycle_id TEXT REFERENCES oar_cycles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  registration_url TEXT,
  calendar_ics TEXT,
  recording_url TEXT,
  transcript_url TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  oar_cycle_id TEXT REFERENCES oar_cycles(id) ON DELETE CASCADE,
  quarterly_review_id TEXT REFERENCES quarterly_reviews(id) ON DELETE SET NULL,
  submitted_by TEXT,
  submitted_email TEXT,
  question TEXT NOT NULL,
  response TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  is_anonymized INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS significant_changes (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL REFERENCES trust_center_offerings(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  change_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  description TEXT NOT NULL,
  reason TEXT,
  customer_impact TEXT,
  plan_timeline TEXT,
  impact_analysis TEXT,
  approver_name TEXT,
  approver_title TEXT,
  planned_start_on TEXT,
  finished_on TEXT,
  verified_on TEXT,
  verification_summary TEXT,
  poam_refs_json TEXT NOT NULL DEFAULT '[]',
  artifact_version_id TEXT REFERENCES artifact_versions(id) ON DELETE SET NULL,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS significant_change_notices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  significant_change_id TEXT NOT NULL REFERENCES significant_changes(id) ON DELETE CASCADE,
  notice_kind TEXT NOT NULL,
  due_on TEXT,
  sent_at TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS secure_config_guides (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL REFERENCES trust_center_offerings(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  guide_markdown TEXT NOT NULL DEFAULT '',
  machine_json TEXT NOT NULL DEFAULT '{}',
  access_instructions TEXT,
  current_settings_json TEXT NOT NULL DEFAULT '{}',
  artifact_version_id TEXT REFERENCES artifact_versions(id) ON DELETE SET NULL,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS secure_default_releases (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  guide_id TEXT NOT NULL REFERENCES secure_config_guides(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL,
  defaults_json TEXT NOT NULL DEFAULT '{}',
  release_notes TEXT,
  released_at TEXT NOT NULL,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scope_documents (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL REFERENCES trust_center_offerings(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  narrative_markdown TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  artifact_version_id TEXT REFERENCES artifact_versions(id) ON DELETE SET NULL,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resource_flows (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  scope_document_id TEXT NOT NULL REFERENCES scope_documents(id) ON DELETE CASCADE,
  resource_name TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  security_objectives_json TEXT NOT NULL DEFAULT '[]',
  handles_federal_data INTEGER NOT NULL DEFAULT 0,
  metadata_in_scope INTEGER NOT NULL DEFAULT 1,
  flow_summary TEXT,
  upstream_resources_json TEXT NOT NULL DEFAULT '[]',
  downstream_resources_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS third_party_resources (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  scope_document_id TEXT NOT NULL REFERENCES scope_documents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT,
  usage_summary TEXT,
  justification TEXT,
  mitigations_json TEXT NOT NULL DEFAULT '[]',
  compensating_controls_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crypto_module_inventory (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL REFERENCES trust_center_offerings(id) ON DELETE CASCADE,
  service_id TEXT REFERENCES trust_center_services(id) ON DELETE SET NULL,
  tenant_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  module_name TEXT NOT NULL,
  module_version TEXT,
  cmvp_certificate TEXT,
  validation_status TEXT NOT NULL DEFAULT 'documented',
  update_stream TEXT,
  protects_federal_data INTEGER NOT NULL DEFAULT 1,
  tenant_default_enabled INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  artifact_version_id TEXT REFERENCES artifact_versions(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trust_center_offerings_tenant
  ON trust_center_offerings (tenant_id);

CREATE INDEX IF NOT EXISTS idx_trust_center_services_offering
  ON trust_center_services (offering_id, in_scope, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_artifact_versions_offering
  ON artifact_versions (offering_id, artifact_kind, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_artifact_versions_tenant
  ON artifact_versions (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_trust_center_access_grants_offering
  ON trust_center_access_grants (offering_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_trust_center_access_events_grant
  ON trust_center_access_events (grant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trust_center_access_events_artifact
  ON trust_center_access_events (artifact_version_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agency_contacts_offering
  ON agency_contacts (offering_id, agency_name, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_fedramp_messages_offering
  ON fedramp_messages (offering_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fedramp_message_deliveries_message
  ON fedramp_message_deliveries (message_id, delivery_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_incident_notifications_offering
  ON incident_notifications (offering_id, incident_state, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_vulnerability_evaluations_offering
  ON vulnerability_evaluations (offering_id, current_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_vdr_reports_offering
  ON vdr_reports (offering_id, report_month DESC);

CREATE INDEX IF NOT EXISTS idx_oar_cycles_offering
  ON oar_cycles (offering_id, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_quarterly_reviews_offering
  ON quarterly_reviews (offering_id, scheduled_for DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_items_oar
  ON feedback_items (oar_cycle_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_significant_changes_offering
  ON significant_changes (offering_id, change_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_significant_change_notices_change
  ON significant_change_notices (significant_change_id, notice_kind, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_secure_config_guides_offering
  ON secure_config_guides (offering_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_secure_default_releases_guide
  ON secure_default_releases (guide_id, released_at DESC);

CREATE INDEX IF NOT EXISTS idx_scope_documents_offering
  ON scope_documents (offering_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_resource_flows_scope
  ON resource_flows (scope_document_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_third_party_resources_scope
  ON third_party_resources (scope_document_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_crypto_module_inventory_offering
  ON crypto_module_inventory (offering_id, service_name, updated_at DESC);
