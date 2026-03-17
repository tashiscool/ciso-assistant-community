# Cloudflare Feature-Family Field Parity Checklist

Generated from Worker parity registry on 2026-03-05.

Total feature families: 19  
Total command types: 23  
Total expected fields (dedicated families): 272

## Feature Matrix

| Feature family | Command type | Model key | Expected fields | Registry source |
|---|---|---|---:|---|
| ai_assistant | ai.assistant.run.requested | ai_assistant.jobs.AssistantJob | 8 | custom |
| ai_vendor_scoring | ai.vendor-scoring.requested | tprm.models.EntityAssessment | 8 | python |
| assessments | lightning-assessment.upsert | core.bounded_contexts.assessment_engine.models.LightningAssessment | 18 | python |
| conmon | conmon.profile.refresh.requested | continuous_monitoring.models.ConMonProfile | 6 | python |
| connectors | connectors.sync.requested | connectors.models.ConnectorInstance | 13 | python |
| crq | crq.compute.requested | crq.models.QuantitativeRiskStudy | 9 | python |
| evidence_automation | evidence.collection.requested | evidence_automation.models.EvidenceCollectionRun | 6 | python |
| fedramp | fedramp.automation.run.requested | core.bounded_contexts.rmf_operations.aggregates.cloud_service_offering.CloudServiceOffering | 28 | python |
| integrations | jira.sync.requested | integrations.models.SyncMapping | 8 | python |
| integrations | servicenow.sync.requested | integrations.models.SyncMapping | 8 | python |
| libraries | library.index.refresh.requested | core.models.StoredLibrary | 5 | python |
| mapping | mapping.compute.requested | core.models_mit.library.RequirementMappingSet | 2 | python |
| oscal | oscal.export.requested | oscal_integration.jobs.OscalExportJob | 7 | custom |
| oscal | oscal.import.requested | oscal_integration.jobs.OscalImportJob | 7 | custom |
| poam | poam.item.upsert | poam.models.poam_item.POAMItem | 39 | python |
| scanners | sarif.import.requested | core.bounded_contexts.rmf_operations.aggregates.vulnerability_finding.VulnerabilityFinding | 13 | python |
| scanners | scanner.sync.requested | core.bounded_contexts.rmf_operations.aggregates.vulnerability_finding.VulnerabilityFinding | 13 | python |
| scanners | scap.import.requested | core.bounded_contexts.rmf_operations.aggregates.vulnerability_finding.VulnerabilityFinding | 13 | python |
| security_graph | security-graph.ingest.requested | security_graph.jobs.SecurityGraphIngestJob | 7 | custom |
| translation | ocsf.oscal.translate.requested | integrations.ocsf.jobs.TranslationJob | 7 | custom |
| vendor_questionnaires | vendor.questionnaire.upsert | questionnaires.models.questionnaire.Questionnaire | 20 | python |
| version_history | version-history.snapshot.requested | core.bounded_contexts.version_history.models.VersionHistory | 15 | python |
| workflows | workflow.execution.requested | core.bounded_contexts.workflow_engine.models.WorkflowExecution | 12 | python |

## Field-Level Checklist

### ai_assistant

- `ai.assistant.run.requested` -> `ai_assistant.jobs.AssistantJob` (8 fields, source: custom)
- Fields: `ai_job_id`, `status`, `model_name`, `prompt`, `context`, `temperature`, `max_tokens`, `metadata`

### ai_vendor_scoring

- `ai.vendor-scoring.requested` -> `tprm.models.EntityAssessment` (8 fields, source: python)
- Fields: `criticality`, `penetration`, `dependency`, `maturity`, `trust`, `representatives`, `solutions`, `conclusion`

### assessments

- `lightning-assessment.upsert` -> `core.bounded_contexts.assessment_engine.models.LightningAssessment` (18 fields, source: python)
- Fields: `id`, `name`, `description`, `status`, `scope`, `scoring_method`, `total_controls`, `tested_controls`, `passed_controls`, `failed_controls`, `not_applicable`, `started_at`, `completed_at`, `target_completion`, `assessors`, `created_at`, `updated_at`, `results_summary`

### conmon

- `conmon.profile.refresh.requested` -> `continuous_monitoring.models.ConMonProfile` (6 fields, source: python)
- Fields: `profile_type`, `status`, `implementation_groups`, `notification_lead_days`, `notification_enabled`, `assigned_actors`

### connectors

- `connectors.sync.requested` -> `connectors.models.ConnectorInstance` (13 fields, source: python)
- Fields: `id`, `connector_type`, `name`, `description`, `is_active`, `config`, `sync_interval_minutes`, `last_sync_at`, `next_sync_at`, `status`, `last_error`, `created_at`, `updated_at`

### crq

- `crq.compute.requested` -> `crq.models.QuantitativeRiskStudy` (9 fields, source: python)
- Fields: `ref_id`, `status`, `reviewers`, `authors`, `observation`, `risk_tolerance`, `loss_threshold`, `distribution_model`, `portfolio_simulation`

### evidence_automation

- `evidence.collection.requested` -> `evidence_automation.models.EvidenceCollectionRun` (6 fields, source: python)
- Fields: `status`, `started_at`, `completed_at`, `items_collected`, `error_message`, `run_log`

### fedramp

- `fedramp.automation.run.requested` -> `core.bounded_contexts.rmf_operations.aggregates.cloud_service_offering.CloudServiceOffering` (28 fields, source: python)
- Fields: `name`, `description`, `service_model`, `deployment_model`, `authorization_status`, `impact_level`, `authorization_date`, `authorization_expiration`, `last_assessment_date`, `next_assessment_date`, `fedramp_package_id`, `marketplace_listing_url`, `authorization_boundary`, `data_centers`, `leveraged_services`, `sponsoring_agencies`, `initial_sponsor`, `third_party_assessment_org`, `last_3pao_assessment_date`, `total_ksi_count`, `compliant_ksi_count`, `ksi_compliance_percentage`, `persistent_validation_coverage`, `compliance_assessment_ids`, `system_group_id`, `perimeter_id`, `tags`, `metadata`

### integrations

- `jira.sync.requested` -> `integrations.models.SyncMapping` (8 fields, source: python)
- Fields: `local_object_id`, `remote_id`, `remote_data`, `sync_status`, `last_synced_at`, `last_sync_direction`, `version`, `error_message`
- `servicenow.sync.requested` -> `integrations.models.SyncMapping` (8 fields, source: python)
- Fields: `local_object_id`, `remote_id`, `remote_data`, `sync_status`, `last_synced_at`, `last_sync_direction`, `version`, `error_message`

### libraries

- `library.index.refresh.requested` -> `core.models.StoredLibrary` (5 fields, source: python)
- Fields: `filtering_labels`, `is_loaded`, `hash_checksum`, `content`, `autoload`

### mapping

- `mapping.compute.requested` -> `core.models_mit.library.RequirementMappingSet` (2 fields, source: python)
- Fields: `version`, `library_ref_id`

### oscal

- `oscal.export.requested` -> `oscal_integration.jobs.OscalExportJob` (7 fields, source: custom)
- Fields: `oscal_job_id`, `status`, `format`, `profile`, `system_id`, `include_evidence`, `metadata`
- `oscal.import.requested` -> `oscal_integration.jobs.OscalImportJob` (7 fields, source: custom)
- Fields: `oscal_job_id`, `status`, `source_object_key`, `format`, `profile`, `system_id`, `metadata`

### poam

- `poam.item.upsert` -> `poam.models.poam_item.POAMItem` (39 fields, source: python)
- Fields: `weakness_id`, `title`, `description`, `source_type`, `source_reference`, `system_group_id`, `assessment_id`, `vulnerability_finding_id`, `control_id`, `cci_ids`, `risk_level`, `impact_description`, `likelihood`, `status`, `identified_date`, `submitted_date`, `approved_date`, `estimated_completion_date`, `actual_completion_date`, `responsible_organization`, `point_of_contact`, `contact_email`, `contact_phone`, `remediation_plan`, `resources_required`, `estimated_cost`, `milestones`, `has_deviation`, `deviation_justification`, `deviation_approved`, `deviation_approval_date`, `evidence_before`, `evidence_after`, `supporting_documents`, `comments`, `tags`, `last_reviewed_date`, `next_review_date`, `is_recurring`

### scanners

- `sarif.import.requested` -> `core.bounded_contexts.rmf_operations.aggregates.vulnerability_finding.VulnerabilityFinding` (13 fields, source: python)
- Fields: `checklistId`, `vulnId`, `stigId`, `ruleId`, `ruleTitle`, `ruleDiscussion`, `checkContent`, `fixText`, `status_data`, `severity_category`, `ruleVersion`, `cciIds`, `tags`
- `scanner.sync.requested` -> `core.bounded_contexts.rmf_operations.aggregates.vulnerability_finding.VulnerabilityFinding` (13 fields, source: python)
- Fields: `checklistId`, `vulnId`, `stigId`, `ruleId`, `ruleTitle`, `ruleDiscussion`, `checkContent`, `fixText`, `status_data`, `severity_category`, `ruleVersion`, `cciIds`, `tags`
- `scap.import.requested` -> `core.bounded_contexts.rmf_operations.aggregates.vulnerability_finding.VulnerabilityFinding` (13 fields, source: python)
- Fields: `checklistId`, `vulnId`, `stigId`, `ruleId`, `ruleTitle`, `ruleDiscussion`, `checkContent`, `fixText`, `status_data`, `severity_category`, `ruleVersion`, `cciIds`, `tags`

### security_graph

- `security-graph.ingest.requested` -> `security_graph.jobs.SecurityGraphIngestJob` (7 fields, source: custom)
- Fields: `ingest_job_id`, `status`, `graph_object_key`, `nodes`, `edges`, `source`, `metadata`

### translation

- `ocsf.oscal.translate.requested` -> `integrations.ocsf.jobs.TranslationJob` (7 fields, source: custom)
- Fields: `translation_job_id`, `status`, `source_format`, `target_format`, `source_object_key`, `output_format`, `metadata`

### vendor_questionnaires

- `vendor.questionnaire.upsert` -> `questionnaires.models.questionnaire.Questionnaire` (20 fields, source: python)
- Fields: `title`, `description`, `questionnaire_type`, `category`, `status`, `questionnaire_version`, `estimated_duration_minutes`, `is_public`, `requires_authentication`, `enable_scoring`, `passing_score_percentage`, `enable_conditional_logic`, `allow_back_navigation`, `show_progress_bar`, `introduction_text`, `completion_message`, `tags`, `usage_count`, `average_completion_time`, `question_ids`

### version_history

- `version-history.snapshot.requested` -> `core.bounded_contexts.version_history.models.VersionHistory` (15 fields, source: python)
- Fields: `id`, `object_id`, `version_number`, `version_label`, `change_type`, `change_summary`, `change_reason`, `snapshot_data`, `changed_fields`, `previous_values`, `created_at`, `ip_address`, `user_agent`, `request_id`, `tags`

### workflows

- `workflow.execution.requested` -> `core.bounded_contexts.workflow_engine.models.WorkflowExecution` (12 fields, source: python)
- Fields: `id`, `execution_number`, `status`, `triggered_by`, `trigger_data`, `started_at`, `completed_at`, `context`, `variables`, `output`, `error`, `created_at`

## Runtime Verification APIs

- `GET /api/v2/parity/checklist`
- `GET /api/v2/parity/coverage?tenant_id=<tenant>`
- `GET /api/v2/parity/validate?tenant_id=<tenant>&model_key=<model>&record_id=<id>`
