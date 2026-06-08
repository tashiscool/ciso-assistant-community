# Jira ticketing writeback connector

Regovise is the normal approval and dispatch surface for Observable Security Agent Jira intents. OSA may execute Jira writes in standalone mode only with explicit `--execute`.

Regovise can also run read-only Jira ingestion through `POST /agent/connectors/jira/import-tickets`. That route accepts a JQL query and emits the same reviewer-friendly artifact families used by OSA imports:

- `ticket_system_inventory`
- `ticket_process_coverage`
- `ticket_evidence_matrix`
- `source_confidence`
- `rejection_diagnostics`

## Supported v1 operations

- `create_issue`
- `add_comment`
- `link_issue`
- `transition_issue`

## Required connector capabilities

- `ticket_read`
- `ticket_write:create`
- `ticket_write:comment`
- `ticket_write:link`
- `ticket_write:transition`
- `jira:createmeta`
- `jira:dry_run`

## Required connector config

- `base_url` or connector `base_url`
- `auth_mode` of `basic` or `bearer`
- `project_allowlist`
- `issue_type_allowlist`
- `link_type_allowlist`
- `transition_allowlist`
- `custom_field_allowlist`
- `source_enclave`
- `data_classification`
- `redaction_profile`

Credential material is used only to call Jira and is never copied into connector-run summaries.

## Process coverage

Jira evidence and write intents map to the canonical process slugs:

- `dev_test_traceability`
- `change_management`
- `deployment_precheck`
- `deployment_postcheck`
- `audit_log_review`
- `monitoring_alert_triage`
- `incident_response_triage`
- `continuous_monitoring`
- `patch_flaw_remediation`
- `security_function_verification`
- `policy_change_tracking`
- `poam_corrective_action`
- `risk_exception_acceptance`
- `access_request_review`
- `evidence_data_call`
- `backup_contingency_test`
- `vendor_remediation`
- `agentic_risk_review`

Sensitive operational data, open vulnerabilities, audit logs, and CUI metadata should be summarized or linked across enclave boundaries instead of copied wholesale.
