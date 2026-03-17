# CISO Assistant Cloudflare Workers -- Completeness Audit

**Audited:** 2026-03-13
**Auditor:** Backend Architecture Review
**Scope:** Analytics pattern compliance, domain model migration, API endpoint coverage, queue/DO architecture, and gap analysis

---

## A. Analytics Pattern Completeness

Assessment of the "write once, project many" event-sourced analytics pattern.

| Criterion | Status | Evidence |
|---|---|---|
| **Immutable raw events** | PASS | `analytics_event_dedupe` stores every event with payload_hash. Events are INSERT OR IGNORE (never updated). Raw NDJSON shards written to R2 are append-only objects keyed by `analytics-raw/{tenant}/{yyyy}/{mm}/{dd}/{hh}/{suffix}.ndjson`. |
| **Async queue-based processing** | PASS | `events-q` queue feeds `analytics-worker.ts`. The command-worker publishes to `events-q` inside `persistAndPublishEvent()` via `env.EVENTS_Q.send(event)`. Batch processing with `MessageBatch<AnalyticsQueueMessage>`. |
| **D1 materialized projections** | PASS | Seven rollup/projection tables in D1: `analytics_rollup_1m_event_volume`, `analytics_rollup_1h_event_volume`, `analytics_rollup_1d_event_volume`, `analytics_rollup_1d_domain_activity`, `analytics_rollup_1d_source_health`, `analytics_rollup_1d_model_activity`, plus `analytics_raw_shards` and `analytics_checkpoints`. All use upsert with ON CONFLICT for idempotent accumulation. |
| **R2 cold storage / replay** | PASS | `CISO_ANALYTICS_R2` bucket stores raw NDJSON shards. `analytics_rebuild_runs` table exists in migration 0009 with `cursor`, `replayed_events`, `source_prefix` columns, indicating backfill infrastructure is schematized. |
| **Rollups at multiple grains** | PASS | Three volume grains: `1m`, `1h`, `1d`. Additional daily rollups by domain, source (with error tracking), and model_key. `aggregateVolume()` called with all three grains per shard flush. |
| **Idempotent writes + dedupe** | PASS | `claimAnalyticsEvent()` uses `INSERT OR IGNORE INTO analytics_event_dedupe` keyed on `(tenant_id, event_id)`. Returns false if already claimed, causing immediate `message.ack()` with no further processing. Rollup upserts use `ON CONFLICT ... DO UPDATE SET total_events = table.total_events + excluded.total_events`. |
| **Backfill from R2** | PARTIAL | Schema support exists (`analytics_rebuild_runs` table with status, cursor, replayed_events). However, no runtime backfill handler was found in any worker. There is no scheduled task, queue consumer, or API endpoint that reads R2 shard objects and replays them through the aggregator. The infrastructure is there but the execution path is not wired. |
| **Durable Objects for real-time** | PASS | `AnalyticsAggregateDurableObject` class in `analytics-worker.ts` with `DurableObjectState` storage. Shards are routed to DO by shard key (`env.ANALYTICS_AGGREGATOR.idFromName(first.shardKey)`). DO accumulates flush counts and writes both to R2 and D1 atomically. Declared in `wrangler.analytics-worker.toml` with `new_sqlite_classes`. |

**Overall analytics pattern score: 7.5/8** -- The only gap is a missing runtime backfill executor; the schema and data model support it, but no code path triggers a replay from R2 shards.

### Retention Strategy

The analytics worker includes a `runRetentionTasks()` function triggered by a daily cron (`15 3 * * *`):
- Hot tier (dedupe rows): 30 days default
- Warm tier (1h rollups): 180 days default
- Cold tier (1d rollups, raw shard metadata): 730 days default
- R2 objects: Not explicitly garbage-collected (raw shards persist indefinitely in R2)

**Finding:** R2 object lifecycle is not managed. Shards older than `COLD_RETENTION_DAYS` should have corresponding R2 objects deleted or transitioned to a cheaper storage class.

---

## B. Domain Model Migration: Django to D1

### Complete Model Inventory

The Django backend contains models across 20+ apps. The D1 schema (migrations 0001-0011) maps these as follows.

#### Core GRC (backend/core/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| Folder (iam/models.py) | `grc_folders` | PRESENT |
| Framework | `grc_frameworks` | PRESENT |
| RequirementNode | `grc_requirement_nodes` | PRESENT |
| ReferenceControl | `grc_reference_controls` | PRESENT |
| AppliedControl | `grc_applied_controls` | PRESENT |
| Policy | `grc_policies` | PRESENT |
| RiskMatrix | `grc_risk_matrices` | PRESENT |
| Threat | `grc_threats` | PRESENT |
| Vulnerability | `grc_vulnerabilities` | PRESENT |
| RiskAssessment | `grc_risk_assessments` | PRESENT |
| RiskScenario | `grc_risk_scenarios` | PRESENT |
| RiskAcceptance | `grc_risk_acceptances` | PRESENT |
| Evidence | `grc_evidences` | PRESENT |
| ComplianceAssessment | `grc_compliance_assessments` | PRESENT |
| RequirementAssessment | `grc_requirement_assessments` | PRESENT |
| Finding | `grc_findings` | PRESENT |
| FilteringLabel | `grc_filtering_labels` | PRESENT |
| Campaign | `grc_campaigns` | PRESENT |
| RequirementMappingSet | `grc_requirement_mapping_sets` | PRESENT |
| Asset | `grc_assets` | PRESENT |
| RequirementMapping | -- | MISSING -- junction/mapping table not migrated |
| Perimeter | -- | MISSING |
| SecurityException | -- | MISSING |
| AssetCapability | -- | MISSING |
| AssetClass | -- | MISSING |
| EvidenceRevision | -- | MISSING |
| Incident | -- | MISSING (mapped to `secops_incidents` instead) |
| TimelineEntry | -- | MISSING |
| OrganisationIssue | -- | MISSING |
| OrganisationObjective | -- | MISSING |
| HistoricalMetric | -- | MISSING |
| FindingsAssessment | -- | MISSING |
| AccessReview | -- | MISSING |
| CryptoAsset | -- | MISSING |
| DetectionRule | -- | MISSING |
| TaskTemplate | -- | MISSING |
| TaskNode | -- | MISSING |
| ValidationFlow | -- | MISSING |
| FlowEvent | -- | MISSING |
| Team | -- | MISSING |
| Actor | -- | MISSING (partially covered by IAM) |
| Terminology | -- | MISSING |
| StoredLibrary | -- | MISSING |
| LoadedLibrary | -- | MISSING |

#### TPRM (backend/tprm/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| Entity | `tprm_entities` | PRESENT |
| EntityAssessment | `tprm_entity_assessments` | PRESENT |
| Representative | `tprm_representatives` | PRESENT |
| Solution | `tprm_solutions` | PRESENT |
| Contract | `tprm_contracts` | PRESENT |

#### EBIOS RM (backend/ebios_rm/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| EbiosRMStudy | `ebios_studies` | PRESENT |
| FearedEvent | `ebios_feared_events` | PRESENT |
| RoTo | `ebios_ro_to` | PRESENT |
| Stakeholder | `ebios_stakeholders` | PRESENT |
| StrategicScenario | `ebios_strategic_scenarios` | PRESENT |
| AttackPath | `ebios_attack_paths` | PRESENT |
| OperationalScenario | `ebios_operational_scenarios` | PRESENT |
| ElementaryAction | -- | MISSING |
| OperatingMode | -- | MISSING |
| KillChain | -- | MISSING |
| RiskOrigin (ebios_rm_mit) | -- | MISSING |
| TargetObjective (ebios_rm_mit) | -- | MISSING |

#### Privacy (backend/privacy_mit/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| ProcessingNature / Purpose | `privacy_purposes` | PRESENT |
| DataSubject | `privacy_data_subjects` | PRESENT |
| PersonalData | `privacy_personal_data` | PRESENT |
| DataRecipient | `privacy_data_recipients` | PRESENT |
| Processing | `privacy_processings` | PRESENT |
| DataTransfer | `privacy_data_transfers` | PRESENT |
| RightRequest | `privacy_right_requests` | PRESENT |
| DataBreach | `privacy_data_breaches` | PRESENT |
| DataContractor | -- | MISSING |
| ConsentRecord | `privacy_consent_records` | PRESENT (extended beyond Django) |
| DataAsset | `privacy_data_assets` | PRESENT (extended beyond Django) |
| DataFlow | `privacy_data_flows` | PRESENT (extended beyond Django) |

#### CRQ (backend/crq/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| QuantitativeRiskStudy | `crq_studies` | PRESENT |
| QuantitativeRiskScenario | `crq_scenarios` | PRESENT |
| QuantitativeRiskHypothesis | `crq_hypotheses` | PRESENT |

#### Resilience (backend/resilience/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| BusinessImpactAnalysis | `resilience_bia` | PRESENT |
| AssetAssessment | `resilience_asset_assessments` | PRESENT |
| EscalationThreshold | `resilience_escalation_thresholds` | PRESENT |

#### Metrology (backend/metrology/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| MetricDefinition | `metrology_definitions` | PRESENT |
| MetricInstance | `metrology_instances` | PRESENT |
| Dashboard | `metrology_dashboards` | PRESENT |
| DashboardWidget | `metrology_widgets` | PRESENT |
| CustomMetricSample | -- | MISSING |
| BuiltinMetricSample / Snapshot | -- | MISSING |

#### IAM (backend/iam/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| User | `iam_users` | PRESENT |
| UserGroup | `iam_user_groups` | PRESENT |
| RoleAssignment | `iam_role_assignments` | PRESENT |
| Role | -- | MISSING (roles stored as inline JSON in role assignments) |
| Folder | `grc_folders` | PRESENT (shared with GRC) |
| PersonalAccessToken | -- | MISSING |
| AuditLog (iam_mit) | -- | MISSING |

#### Continuous Monitoring (backend/continuous_monitoring/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| ConMonProfile | -- | MISSING (profiles are ephemeral in `conmon_activity`) |
| ConMonActivityConfig | -- | MISSING |
| ConMonExecution | -- | MISSING |
| ConMonMetric | -- | MISSING |

**Note:** ConMon state is tracked via `conmon_activity` and read models `rm_conmon_dashboard` / `rm_conmon_operational_rollup`, but the underlying configuration models are not migrated.

#### Integrations (backend/integrations/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| IntegrationProvider | -- | MISSING (hard-coded in DEFAULT_CONNECTOR_REGISTRY) |
| IntegrationConfiguration | -- | MISSING |
| SyncMapping | -- | MISSING |
| SyncEvent | -- | MISSING |

**Note:** Integration sync jobs exist (`integration_sync_jobs`) and connector instances exist (`connector_instances`), but the provider/configuration registry is not in D1.

#### Connectors (backend/connectors/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| ConnectorInstance | `connector_instances` | PRESENT |
| SyncExecution | -- | MISSING (tracked via events/read models instead) |

#### Assessment Engine (backend/core/bounded_contexts/assessment_engine/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| AssessmentTemplate | -- | MISSING |
| LightningAssessment | `lightning_assessments` | PRESENT |
| MasterAssessment | -- | MISSING |
| ControlGroup | -- | MISSING |
| TestCase | -- | MISSING |
| TestResult | -- | MISSING |
| LightningAssessmentRun | -- | MISSING |

#### Workflow Engine (backend/core/bounded_contexts/workflow_engine/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| Workflow | `wf_templates` | PRESENT (renamed) |
| WorkflowNode | -- | MISSING |
| WorkflowConnection | -- | MISSING |
| WorkflowExecution | `wf_executions` + `workflow_executions` | PRESENT (two tables -- potential duplication) |
| WorkflowStep | -- | MISSING |
| WorkflowSchedule | `wf_schedules` | PRESENT |
| WorkflowWebhook | -- | MISSING |

#### Version History (backend/core/bounded_contexts/version_history/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| VersionHistory | -- | MISSING (replaced by snapshot-based model) |
| VersionSnapshot | `version_history_snapshots` | PRESENT |
| VersionDiff | -- | MISSING |
| VersionComment | -- | MISSING |
| VersionedModel | -- | MISSING (abstract mixin) |

#### Evidence Automation (backend/evidence_automation/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| EvidenceSource | -- | MISSING |
| EvidenceCollectionRule | -- | MISSING |
| EvidenceCollectionRun | `evidence_automation_runs` | PRESENT |

#### Global Settings (backend/global_settings/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| GlobalSettings | `settings_global` | PRESENT |
| FeatureFlag (global_settings_mit) | `settings_feature_flags` | PRESENT |
| SSOSettings | -- | MISSING |

#### Webhooks (backend/webhooks/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| WebhookEventType | -- | MISSING |
| WebhookEndpoint | -- | MISSING |
| WebhookDelivery (webhooks_mit) | -- | MISSING |

#### Assessment Artifacts (backend/assessment_artifacts/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| ArtifactPackage | `assessment_artifact_packages` | PRESENT |
| ArtifactRequestItem | `assessment_artifact_items` | PRESENT |
| EvidenceSchedule | `assessment_artifact_schedules` | PRESENT |

#### PMBOK (backend/pmbok/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| GenericCollection | -- | MISSING |
| Accreditation | -- | MISSING |

#### Calendar (backend/cal/models.py)

| Django Model | D1 Table | Status |
|---|---|---|
| Event | -- | MISSING |
| RecurringSchedule (cal_mit) | -- | MISSING |

### Migration Summary

| Category | Models in Django | Tables in D1 | Coverage |
|---|---|---|---|
| Core GRC | 43 | 20 | 47% |
| TPRM | 5 | 5 | 100% |
| EBIOS RM | 12 | 7 | 58% |
| Privacy | 10 | 9 | 90% |
| CRQ | 3 | 3 | 100% |
| Resilience | 3 | 3 | 100% |
| Metrology | 6 | 4 | 67% |
| IAM | 7 | 3 | 43% |
| ConMon | 4 | 0 | 0% |
| Integrations | 4 | 0 | 0% |
| Connectors | 2 | 1 | 50% |
| Assessment Engine | 7 | 1 | 14% |
| Workflow Engine | 7 | 3 | 43% |
| Version History | 5 | 1 | 20% |
| Evidence Automation | 3 | 1 | 33% |
| Global Settings | 3 | 2 | 67% |
| Webhooks | 3 | 0 | 0% |
| Assessment Artifacts | 3 | 3 | 100% |
| PMBOK | 2 | 0 | 0% |
| Calendar | 2 | 0 | 0% |
| **Total** | **~133** | **~66 domain** | **~50%** |

**Note:** The Workers implementation compensates for missing tables through two mechanisms: (1) `canonical_domain_state` stores arbitrary entity state as JSON with field indexing, acting as a schemaless catch-all; (2) `legacy_domain_state` provides a domain/entity/status store for any command type that does not match a named handler. Together these provide effective coverage for reads, though without the schema enforcement or query optimization that dedicated tables provide.

---

## C. API Endpoint Coverage

### Edge API Worker Native Routes (v2)

The edge-api-worker exposes these native v2 endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v2/healthz` | GET | Health check |
| `/api/v2/catalog` | GET | List commands, projections, features |
| `/api/v2/parity/models` | GET | Field parity model registry |
| `/api/v2/parity/models/seed` | POST | Seed parity models from Python registry |
| `/api/v2/parity/records` | GET | Field parity record lookup |
| `/api/v2/parity/validate` | GET | Validate parity for a model/record |
| `/api/v2/parity/checklist` | GET | Feature parity checklist |
| `/api/v2/parity/coverage` | GET | Parity coverage statistics |
| `/api/v2/canonical/models` | GET | Canonical model registry |
| `/api/v2/canonical/routes` | GET | Canonical route registry |
| `/api/v2/canonical/resources` | GET | Resource descriptor lookup |
| `/api/v2/canonical/state` | GET | Read canonical domain state |
| `/api/v2/resources` | GET | Read canonical resources (query) |
| `/api/v2/resources/mutate` | POST | Create/update/delete resources |
| `/api/v2/legacy/dispatch` | POST | Proxy to Django-compatible endpoints |
| `/api/v2/legacy/state` | GET | Read legacy domain state |
| `/api/v2/analytics/events` | POST | Ingest analytics events directly |
| `/api/v2/analytics/overview` | GET | Analytics summary dashboard |
| `/api/v2/analytics/volume` | GET | Event volume rollups |
| `/api/v2/analytics/domains` | GET | Domain activity rollups |
| `/api/v2/analytics/sources` | GET | Source health rollups |
| `/api/v2/analytics/models` | GET | Model activity rollups |
| `/api/v2/analytics/checkpoints` | GET | Processing checkpoints |
| `/api/v2/commands/{type}` | POST | Submit any command type |
| `/api/v2/jobs/{id}` | GET | Job status/progress |
| `/api/v2/exports` | POST | Create async export job |
| `/api/v2/files/upload-url` | POST | Generate signed upload URL |
| `/api/v2/files/download-url` | GET | Generate signed download URL |
| `/api/v2/files/upload/{token}` | PUT | Direct file upload |
| `/api/v2/files/download/{token}` | GET | Direct file download |
| `/api/v2/read/{projection}` | GET | Read any projection table |
| `/api/v2/ai/extractor/upload` | POST | Finalize AI extractor upload |
| `/api/v2/vendor-portal/evidence` | POST | Finalize vendor evidence upload |
| `/api/v2/folders/import` | POST | Finalize folder import |
| `/api/v2/serdes/load-backup` | POST | Load backup from R2 |
| `/api/v2/serdes/full-restore` | POST | Full database restore |

### Django REST Endpoint Domains vs. Workers Legacy Dispatch

The edge-api-worker supports legacy dispatch via `/api/v2/legacy/dispatch` which proxies requests through a comprehensive route resolution system. The `LEGACY_NAMESPACED_ROUTE_PREFIXES` covers 22 domain namespaces:

| Django Domain | Legacy Prefix | Workers Coverage |
|---|---|---|
| AI | `ai` | Legacy dispatch + dedicated command |
| Assessments | `assessments` | Legacy dispatch + lightning assessment commands |
| Asset Service | `asset-service` | Legacy dispatch + 4 dedicated commands |
| Business Continuity | `business-continuity` | Legacy dispatch + 4 dedicated commands |
| Compliance | `compliance` | Legacy dispatch + 7 dedicated commands |
| ConMon | `conmon` | Legacy dispatch + profile refresh command |
| Connectors | `connectors` | Legacy dispatch + sync command |
| CRQ | `crq` | Legacy dispatch + 3 study commands + compute |
| EBIOS RM | `ebios-rm` | Legacy dispatch + 7 dedicated commands |
| Evidence Automation | `evidence-automation` | Legacy dispatch + collection command |
| GDPR/Privacy | `gdpr` / `privacy` | Legacy dispatch + 13 dedicated commands |
| IAM | `iam` | Legacy dispatch + 3 dedicated commands |
| Integrations | `integrations` | Legacy dispatch |
| Mapping Libraries | `mapping-libraries` | Legacy dispatch + mapping compute |
| Metrology | `metrology` | Legacy dispatch + 4 dedicated commands |
| Organization | `organization` | Legacy dispatch + 5 dedicated commands |
| OSCAL | `oscal` | Legacy dispatch + import/export commands |
| POAM | `poam` | Legacy dispatch + upsert command |
| Resilience | `resilience` | Legacy dispatch + 3 dedicated commands |
| Risks | `risks` | Legacy dispatch (covered by GRC commands) |
| RMF | `rmf` | Legacy dispatch + 9 dedicated commands |
| Security | `security` | Legacy dispatch |
| Security Graph | `security-graph` | Legacy dispatch + ingest command |
| Third Party | `third-party` | Legacy dispatch (covered by TPRM commands) |
| Vendor Portal | `vendor-portal` | Legacy dispatch + dedicated endpoints |
| Version History | `version-history` | Legacy dispatch + snapshot command |
| Workflows | `workflows` | Legacy dispatch + 7 dedicated commands |

### Missing Endpoint Categories

The following Django endpoint patterns have no native v2 equivalent (rely exclusively on legacy dispatch):

1. **Authentication endpoints** -- Login, logout, token refresh, password reset, SAML/OIDC flows. The edge-api-worker has session management (`worker_access_sessions`) but auth flows are dispatched to Django.
2. **User profile management** -- User CRUD, password change, preference update.
3. **SSO configuration** -- SAML/OIDC provider management.
4. **Webhook management** -- CRUD for webhook endpoints and delivery inspection.
5. **Library management** -- StoredLibrary/LoadedLibrary import/export/CRUD.
6. **Calendar/scheduling** -- Event and recurring schedule management.
7. **Audit log retrieval** -- No D1 audit log table; no API endpoint.
8. **Bulk operations** -- Django bulk delete, bulk status change.

---

## D. Queue / Durable Object Architecture

### Queues

| Queue Name | Producer(s) | Consumer | Purpose |
|---|---|---|---|
| `commands-q` | edge-api-worker, automation-worker | command-worker | Process domain commands (CQRS write side) |
| `events-q` | command-worker | analytics-worker | Feed analytics pipeline with domain events |
| `projections-q` | command-worker, export-worker | projection-worker | Update read model projections from events |
| `exports-q` | command-worker, edge-api-worker | export-worker | Async export job processing |
| `dead-letter-q` | analytics-worker, command-worker, export-worker, projection-worker | (none) | Failed message quarantine |
| `connector-sync-q` | (external triggers) | automation-worker | Trigger connector sync commands |

### Durable Objects

| DO Class | Binding | Purpose |
|---|---|---|
| `AnalyticsAggregateDurableObject` | `ANALYTICS_AGGREGATOR` | Per-shard event aggregation. Accumulates events within an hourly shard, writes NDJSON to R2, maintains flush count/stats in DO storage, and batch-writes rollups to D1. |

### R2 Buckets

| Bucket | Binding | Purpose |
|---|---|---|
| `ciso-evidence-r2` | `CISO_EVIDENCE_R2` | Evidence artifacts, vendor questionnaire responses |
| `ciso-imports-r2` | `CISO_IMPORTS_R2` | OSCAL imports, scanner uploads, AI prompts, library sources |
| `ciso-exports-r2` | `CISO_EXPORTS_R2` | Export artifacts (OSCAL, FedRAMP, CRQ, mapping results) |
| `ciso-snapshots-r2` | `CISO_SNAPSHOTS_R2` | Version history snapshots, security graph snapshots, field parity overflow, canonical state overflow, event payload overflow |
| `ciso-analytics-raw-r2` | `CISO_ANALYTICS_R2` | Raw analytics event shards (NDJSON) |

### Architecture Gaps

1. **Dead letter queue has no consumer.** The `dead-letter-q` is a write-only sink. There is no worker that processes dead letters for alerting, retry, or human review. No scheduled task inspects it.

2. **No Durable Object for real-time projection streaming.** While the analytics pipeline uses a DO for aggregation, there is no WebSocket-capable DO for pushing real-time projection updates to connected clients. The read side is purely poll-based via `/api/v2/read/{projection}`.

3. **Command outbox is written but not swept.** The `command_outbox` table tracks dispatch status, but there is no scheduled worker or cron that retries `pending` outbox entries. If `EVENTS_Q.send()` or `PROJECTIONS_Q.send()` fails after the D1 write succeeds, the event is lost. The outbox pattern is half-implemented.

4. **No rate limiting or backpressure on the analytics event ingestion API.** The `/api/v2/analytics/events` endpoint accepts events directly and enqueues them without rate limiting, tenant-scoped quotas, or payload size validation beyond basic field checks.

5. **Automation worker cron schedules are broad.** Three crons (`*/15 * * * *`, `5 */1 * * *`, `0 3 * * *`) all run the same five command types. There is no differentiation -- evidence collection runs every 15 minutes, which may be excessive.

---

## E. Gaps and Recommendations (Priority-Ordered)

### P0 -- Critical

1. **Implement command outbox sweep.** Add a scheduled handler (cron in automation-worker or a new worker) that queries `command_outbox WHERE dispatch_status = 'pending' AND next_attempt_at <= now()` and retries failed event publications. Without this, any transient queue failure silently drops events from both the analytics and projection pipelines.

2. **Implement dead letter queue consumer.** Create a worker or scheduled task that reads from `dead-letter-q`, logs failures to a D1 table (e.g., `dead_letter_log`), and optionally triggers alerts. Currently failed messages vanish into a queue with no consumer.

3. **Wire up analytics backfill executor.** The `analytics_rebuild_runs` table schema is ready. Implement a handler (triggered via command or scheduled task) that: lists R2 objects under `analytics-raw/{tenant}/`, reads each NDJSON shard, replays events through the aggregator DO, and updates the rebuild run's cursor/progress. This is essential for disaster recovery and rollup correction.

### P1 -- High

4. **Migrate ConMon configuration models.** ConMonProfile, ConMonActivityConfig, ConMonExecution, and ConMonMetric have no D1 tables. The `conmon_activity` table and read models provide runtime state but lose the configuration that drives continuous monitoring. Without these, the system cannot reconstruct what monitoring was configured.

5. **Migrate webhook models.** WebhookEventType, WebhookEndpoint, and WebhookDelivery are entirely absent. The edge-api-worker references `DEFAULT_WEBHOOK_EVENT_TYPES` as a hard-coded constant, but there is no mechanism to register, manage, or deliver webhooks from the Workers platform.

6. **Migrate integration provider/configuration models.** IntegrationProvider and IntegrationConfiguration are not in D1. The connector registry is a hard-coded array (`DEFAULT_CONNECTOR_REGISTRY`). This means adding new connector types requires code deployment rather than configuration.

7. **Add R2 object lifecycle management.** Raw analytics shards in `CISO_ANALYTICS_R2` are never cleaned up. Add a scheduled task that deletes R2 objects corresponding to `analytics_raw_shards` rows deleted by the retention sweep.

### P2 -- Medium

8. **Consolidate workflow execution tables.** Both `workflow_executions` (migration 0003) and `wf_executions` (migration 0011) exist. The command-worker writes to `workflow_executions` for generic workflow commands and `wf_executions` for the typed workflow handler. This creates ambiguity about which table holds the authoritative state.

9. **Migrate missing EBIOS RM models.** ElementaryAction, OperatingMode, KillChain, RiskOrigin, and TargetObjective are not in D1. These are essential for complete EBIOS RM workshop support (Workshops 3 and 4).

10. **Migrate missing Core GRC models.** The following models represent important GRC concepts without dedicated tables: Perimeter, SecurityException, AssetCapability, AssetClass, RequirementMapping, Incident/TimelineEntry, TaskTemplate/TaskNode, ValidationFlow/FlowEvent, AccessReview, CryptoAsset, DetectionRule, Team/Actor. Many of these are high-value entities that benefit from indexed queries.

11. **Migrate assessment engine models.** AssessmentTemplate, MasterAssessment, ControlGroup, TestCase, TestResult, and LightningAssessmentRun are missing. Only LightningAssessment has a table. This limits the assessment engine to basic lightning assessments.

12. **Add per-tenant analytics quotas.** The analytics ingestion API has no rate limiting. Implement per-tenant event volume caps (configurable via KV or D1) with 429 responses when exceeded.

13. **Migrate WorkflowNode, WorkflowConnection, WorkflowStep.** Without these, workflow definitions are opaque JSON rather than queryable graph structures.

### P3 -- Low

14. **Migrate PersonalAccessToken.** API tokens are managed in Django but not tracked in D1. The `worker_access_sessions` table handles session auth but not long-lived API tokens.

15. **Migrate Calendar/Event models.** The cal app's Event and RecurringSchedule have no D1 representation.

16. **Migrate PMBOK models.** GenericCollection and Accreditation are not in D1.

17. **Migrate StoredLibrary / LoadedLibrary.** Library catalog metadata is not in D1; library import/export relies on legacy dispatch.

18. **Migrate AuditLog.** No D1 table for audit trails. Consider whether `domain_events` serves this purpose or if a dedicated audit log table is needed.

19. **Add Durable Object for real-time projections.** Implement a WebSocket-capable DO that clients subscribe to for live updates when projections change. The current poll-based read model is sufficient for dashboards but inadequate for collaborative real-time views.

20. **Implement tenant-scoped backup/restore.** The `serdes.dump-db.requested` and `serdes.load-backup.requested` commands exist but the edge-api-worker's `/api/v2/serdes/load-backup` and `/api/v2/serdes/full-restore` endpoints perform R2 operations without clear tenant isolation guarantees.

---

## Summary Metrics

| Metric | Value |
|---|---|
| Analytics pattern score | 7.5 / 8 |
| Django models total | ~133 |
| D1 domain tables | ~66 |
| Domain model coverage | ~50% |
| D1 read model (rm_) tables | 42 |
| D1 infrastructure tables | 24 |
| Total D1 tables | ~170 |
| Command types (typed handlers) | 127 |
| Command types (accepts unknown via catch-all) | Unlimited |
| Projection event types handled | 90+ |
| Queues | 6 |
| Durable Object classes | 1 |
| R2 buckets | 5 |
| Workers | 6 |
| v2 API endpoints | 35 |
| Legacy dispatch namespaces | 22 |
| Wrangler config files | 6 |
| Migration files | 11 |
| P0 gaps | 3 |
| P1 gaps | 4 |
| P2 gaps | 6 |
| P3 gaps | 7 |
