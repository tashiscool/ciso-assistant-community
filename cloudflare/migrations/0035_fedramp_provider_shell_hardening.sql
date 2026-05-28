ALTER TABLE artifact_versions ADD COLUMN publication_state TEXT NOT NULL DEFAULT 'published';
ALTER TABLE artifact_versions ADD COLUMN generation_source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE artifact_versions ADD COLUMN superseded_by_artifact_id TEXT;

ALTER TABLE vdr_reports ADD COLUMN publication_state TEXT NOT NULL DEFAULT 'working';
ALTER TABLE vdr_reports ADD COLUMN generation_source TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE oar_cycles ADD COLUMN publication_state TEXT NOT NULL DEFAULT 'working';
ALTER TABLE oar_cycles ADD COLUMN generation_source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE oar_cycles ADD COLUMN source_package_job_id TEXT;

ALTER TABLE quarterly_reviews ADD COLUMN publication_state TEXT NOT NULL DEFAULT 'working';
ALTER TABLE quarterly_reviews ADD COLUMN generation_source TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE fedramp_message_deliveries ADD COLUMN confirmed_at TEXT;
ALTER TABLE fedramp_message_deliveries ADD COLUMN confirmed_by TEXT;
ALTER TABLE fedramp_message_deliveries ADD COLUMN confirmation_method TEXT;

ALTER TABLE incident_notifications ADD COLUMN fedramp_report_status TEXT NOT NULL DEFAULT 'queued';
ALTER TABLE incident_notifications ADD COLUMN cisa_report_status TEXT NOT NULL DEFAULT 'not_required';
ALTER TABLE incident_notifications ADD COLUMN agency_report_status TEXT NOT NULL DEFAULT 'queued';
ALTER TABLE crypto_module_inventory ADD COLUMN validation_provenance TEXT;

UPDATE artifact_versions
SET publication_state = CASE
      WHEN is_public = 1 THEN 'published'
      ELSE 'published'
    END,
    generation_source = COALESCE(generation_source, 'manual')
WHERE publication_state IS NULL OR generation_source IS NULL;

UPDATE vdr_reports
SET publication_state = CASE
      WHEN status = 'published' THEN 'published'
      ELSE 'working'
    END,
    generation_source = COALESCE(generation_source, 'manual')
WHERE publication_state IS NULL OR generation_source IS NULL;

UPDATE oar_cycles
SET publication_state = CASE
      WHEN status = 'published' THEN 'published'
      ELSE 'working'
    END,
    generation_source = COALESCE(generation_source, 'manual')
WHERE publication_state IS NULL OR generation_source IS NULL;

UPDATE quarterly_reviews
SET publication_state = CASE
      WHEN status IN ('published', 'completed') THEN 'published'
      ELSE 'working'
    END,
    generation_source = COALESCE(generation_source, 'manual')
WHERE publication_state IS NULL OR generation_source IS NULL;

UPDATE fedramp_messages
SET status = CASE
      WHEN status = 'sent' THEN 'queued'
      ELSE status
    END;

UPDATE fedramp_message_deliveries
SET delivery_status = CASE
      WHEN delivery_status = 'sent' THEN 'queued'
      ELSE delivery_status
    END,
    confirmed_at = CASE
      WHEN delivery_status = 'acknowledged' THEN acknowledged_at
      ELSE confirmed_at
    END,
    confirmed_by = CASE
      WHEN delivery_status = 'acknowledged' THEN acknowledged_by
      ELSE confirmed_by
    END,
    confirmation_method = CASE
      WHEN delivery_status = 'acknowledged' THEN COALESCE(confirmation_method, 'manual_acknowledgement')
      ELSE confirmation_method
    END;

UPDATE incident_notifications
SET fedramp_report_status = CASE
      WHEN reported_to_fedramp_at IS NOT NULL THEN 'confirmed'
      ELSE 'queued'
    END,
    cisa_report_status = CASE
      WHEN reported_to_cisa_at IS NOT NULL THEN 'confirmed'
      ELSE 'not_required'
    END,
    agency_report_status = CASE
      WHEN agency_notified_at IS NOT NULL THEN 'confirmed'
      ELSE 'queued'
    END;

CREATE INDEX IF NOT EXISTS idx_artifact_versions_publication
  ON artifact_versions (tenant_id, artifact_kind, publication_state, COALESCE(published_at, updated_at) DESC);

CREATE INDEX IF NOT EXISTS idx_vdr_reports_publication
  ON vdr_reports (tenant_id, report_month DESC, publication_state);

CREATE INDEX IF NOT EXISTS idx_oar_cycles_publication
  ON oar_cycles (tenant_id, cycle_label, publication_state, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_quarterly_reviews_publication
  ON quarterly_reviews (tenant_id, oar_cycle_id, publication_state, scheduled_for DESC);
