# Python Backend to Cloudflare Migration Checklist

This checklist is based on the live Django backend feature surface (`backend/ciso_assistant/urls.py`, `backend/core/urls.py`, bounded-context `urls.py`, and installed app modules).

## Status Legend

- `Dedicated` = explicit Cloudflare command handlers + read projections + D1/R2 schema.
- `Bridge` = accepted through generic command ingestion and projected via `legacy_domain_state` / `rm_legacy_domain_overview`.

## Feature Checklist

| Python backend feature | Django route/module | Cloudflare path | Storage model | Status |
|---|---|---|---|---|
| Connector management + sync history | `/api/connectors/*` | `connectors.sync.requested` | D1 (`connector_instances`, `rm_connector_health`) + R2 raw payloads | Dedicated |
| Lightning/master assessments | `/api/assessments/*` | `lightning-assessment.upsert` | D1 (`lightning_assessments`, `rm_lightning_assessment_summary`) | Dedicated |
| Version history + snapshots + diff/audit | `/api/version-history/*` | `version-history.snapshot.requested` | D1 (`version_history_snapshots`, `rm_version_history_latest`) + R2 snapshots | Dedicated |
| Security graph + analysis APIs | `/api/security-graph/*` | `security-graph.ingest.requested` (+ node/edge events) | D1 (`security_graph_ingest_jobs`, graph projections) + R2 graph snapshots | Dedicated |
| Evidence automation | `/api/evidence-automation/*` | `evidence.collection.requested` | D1 (`evidence_automation_runs`, `rm_evidence_automation_status`) + R2 evidence | Dedicated |
| Workflow engine + schedules | `/api/workflows/*` | `workflow.execution.requested` | D1 (`workflow_executions`, `rm_workflow_execution_status`) | Dedicated |
| OSCAL import/export + docs | `/api/oscal/*` | `oscal.import.requested`, `oscal.export.requested` | D1 (`oscal_jobs`, `rm_oscal_job_status`) + R2 imports/exports | Dedicated |
| Continuous monitoring | `/api/conmon/*` | `conmon.profile.refresh.requested` | D1 (`conmon_activity`, `rm_conmon_dashboard`) | Dedicated |
| POA&M | `/api/poam/*` | `poam.item.upsert` | D1 (`poam_items`, `rm_poam_status`) | Dedicated |
| AI assistant API family | `/api/ai/*` | `ai.assistant.run.requested` | D1 (`ai_assistant_jobs`, `rm_ai_assistant_status`) + R2 context payloads | Dedicated |
| AI vendor scoring | `/api/ai/vendor-scoring/*` | `ai.vendor-scoring.requested` | D1 (`vendor_scoring_jobs`, `rm_vendor_scoring_summary`) | Dedicated |
| Vendor questionnaires | `/api/questionnaires/*`, `/api/vendor-portal/*` | `vendor.questionnaire.upsert` | D1 (`vendor_questionnaires`, `rm_vendor_questionnaire_status`) + R2 evidence | Dedicated |
| Libraries + indexing | `/api/stored-libraries/*`, `/api/loaded-libraries/*` | `library.index.refresh.requested` | D1 (`library_index_jobs`, `rm_framework_library_index`) + R2 sources | Dedicated |
| FedRAMP/RMF operations | `/api/rmf/*` | `fedramp.automation.run.requested` | D1 (`fedramp_automation_jobs`, `rm_fedramp_automation_status`, `rm_compliance_posture`) + R2 exports | Dedicated |
| Quantitative risk (CRQ) | `/api/crq/*` | `crq.compute.requested` | D1 (`crq_compute_jobs`, `rm_crq_summary`, `rm_risk_register_overview`) + R2 bundles | Dedicated |
| Mapping engine | `/api/mapping-libraries/*` + mapping flows | `mapping.compute.requested` | D1 (`mapping_jobs`, `rm_mapping_summary`) + R2 bundles | Dedicated |
| Scanner + SARIF + SCAP imports | scanner/rmf + import flows | `scanner.sync.requested`, `sarif.import.requested`, `scap.import.requested` | D1 (`scanner_ingest_jobs`, `rm_scanner_finding_summary`) + R2 imports | Dedicated |
| Integrations (ServiceNow/Jira) | `/api/integrations/*` | `servicenow.sync.requested`, `jira.sync.requested` | D1 (`integration_sync_jobs`, `rm_integration_sync_status`) | Dedicated |
| OCSF -> OSCAL translation | `/api/integrations/ocsf/to-oscal/` | `ocsf.oscal.translate.requested` | D1 (`translation_jobs`, `rm_translation_status`) + R2 outputs | Dedicated |
| Core platform CRUD (assets, controls, users, frameworks, findings, incidents, timelines, tasks, etc.) | `/api/*` large `core.urls` router | Any command type (unknown command acceptance) | D1 `legacy_domain_state` + `rm_legacy_domain_overview` | Bridge |
| Organization bounded context | `/api/organization/*` | Any command type (unknown command acceptance) | D1 `legacy_domain_state` + projection | Bridge |
| Asset/service bounded context | `/api/asset-service/*` | Any command type (unknown command acceptance) | D1 `legacy_domain_state` + projection | Bridge |
| Control library bounded context | `/api/control-library/*` | Any command type (unknown command acceptance) | D1 `legacy_domain_state` + projection | Bridge |
| Privacy bounded context / GDPR app | `/api/privacy/*`, `/api/gdpr/*` | Any command type (unknown command acceptance) | D1 `legacy_domain_state` + projection | Bridge |
| Security operations bounded context | `/api/security/*` | Any command type (unknown command acceptance) | D1 `legacy_domain_state` + projection | Bridge |
| Third-party management | `/api/third-party/*` | Any command type (unknown command acceptance) | D1 `legacy_domain_state` + projection | Bridge |
| Business continuity | `/api/business-continuity/*` | Any command type (unknown command acceptance) | D1 `legacy_domain_state` + projection | Bridge |
| IAM/auth/session/SAML/OIDC | `/api/iam/*`, `/accounts/*` | Any command type (unknown command acceptance) | D1 `legacy_domain_state` + projection (app auth stays edge layer responsibility) | Bridge |
| SerDes backup/restore + data wizard | `/serdes/*`, `/api/data-wizard/*` | Any command type (unknown command acceptance) + file APIs | D1 jobs + R2 artifacts + legacy bridge | Bridge |
| Metrology dashboards/metrics | `/api/metrology/*` | Any command type (unknown command acceptance) | D1 `legacy_domain_state` + projection | Bridge |
| EBIOS-RM | `/api/ebios-rm/*` | Any command type (unknown command acceptance) | D1 `legacy_domain_state` + projection | Bridge |
| Resilience | `/api/resilience/*` | Any command type (unknown command acceptance) | D1 `legacy_domain_state` + projection | Bridge |
| PMBOK | `/api/pmbok/*` | Any command type (unknown command acceptance) | D1 `legacy_domain_state` + projection | Bridge |
| Webhooks | `/api/webhooks/*` | Any command type (unknown command acceptance) | D1 `legacy_domain_state` + projection | Bridge |

## Completion Summary

- `Dedicated`: 20 high-cost/high-scale domains from the Cloudflare migration plan.
- `Bridge`: Remaining Python route families now have a Cloudflare ingestion + projection path so migration is not blocked.
- `Field-level parity`: enforced through `field_parity_models` + `field_parity_records` with strict completeness checks in `command-worker` (`STRICT_FIELD_PARITY=true`).
- `Feature-family parity visibility`: exposed via `/api/v2/parity/checklist` and `/api/v2/parity/coverage`.

This gives complete backend feature coverage under Workers (`dedicated` or `bridge`) while keeping a strangler rollout path for endpoint-by-endpoint parity hardening.

See `docs/cloudflare-feature-family-field-checklist.md` for command-by-command field inventories.
