# Cloudflare Workers Cost-Optimization Plan (D1 + R2 + CQRS)

## 1. Scope and current-state review

This plan is based on a review of the current codebase and feature inventory in:
- `README.md`
- `qa/feature_coverage_manifest.json`
- `backend/ciso_assistant/settings.py`
- `backend/ciso_assistant/urls.py`
- `backend/core/urls.py`
- `backend/connectors/base/registry.py`
- `backend/core/domain/events.py`
- `backend/core/domain/event_store.py`
- `backend/core/bounded_contexts/*/{projections,read_models}`
- `frontend/svelte.config.js`
- `frontend/src/routes/api/[...segments]/+server.ts`

Observed scale and constraints:
- 20 critical parity features are tracked in `qa/feature_coverage_manifest.json`.
- 169 internal app routes exist under `frontend/src/routes/(app)/(internal)`.
- 31 connector modules are registered in `backend/connectors/base/registry.py`.
- 118 Django model classes exist across backend modules.
- 73 async/scheduled task decorators exist across core task modules.
- Frontend uses `@sveltejs/adapter-node` and a backend proxy route today.
- Backend includes heavy Python-native/reporting/scientific dependencies (WeasyPrint, openpyxl, pandas, numpy/scipy, docx).
- A DDD event/read-model foundation already exists (event store + projections + read models), which is a strong base for incremental CQRS.

## 2. Feature review and migration target

### 2.1 Critical parity features (all 20)

| Feature | Current workload profile | Cloudflare target | CQRS needed |
|---|---|---|---|
| Connectors / Scanner Connectors | IO-heavy, scheduled sync, external APIs | Worker API + Queue consumers + D1 status tables + R2 raw payloads | Yes |
| Assessments Lightning | transactional CRUD + state transitions | Worker API + D1 transactional tables | Partial |
| Version History | append-heavy audit timeline + diff reads | Event log in D1 + read projections | Yes |
| Security Graph | graph-style reads, derived relationships | Projection tables in D1 for nodes/edges | Yes |
| Evidence Automation | scheduled jobs + evidence file outputs | Queue + Cron + D1 metadata + R2 files | Yes |
| Workflows | stateful orchestration, delays, retries | Worker command API + Queue; optional Durable Object coordinator | Yes |
| OSCAL Import/Export | file ingestion + heavy doc exports | Async import/export jobs, R2 artifacts, D1 metadata | Yes |
| Continuous Monitoring | scheduled checks + dashboard reads | Queue/Cron + D1 projections | Yes |
| POA&M Management | CRUD + reporting/export | D1 transactional + async exports to R2 | Partial |
| AI Assistant / Vendor Scoring | external LLM calls + document parsing | Async jobs + D1 metadata + R2 documents | Yes |
| Vendor Questionnaires | form-heavy CRUD + evidence uploads | D1 transactional + R2 uploads via signed URLs | No |
| Multi-framework Libraries | read-heavy catalogs + metadata | R2 source bundles + D1 indexed metadata | Partial |
| FedRAMP Automation | periodic compliance computations + exports | Queue/Cron + read projections + async document build | Yes |
| Quantitative Risk | compute-heavy simulation | Async compute worker + D1 results + R2 artifacts | Yes |
| Mapping Engine | compute-heavy mapping generation | Async compute pipeline + D1 summary + R2 full outputs | Yes |
| SARIF/SCAP Import | potentially large file import + normalization | R2 ingest + queue parsing + D1 normalized findings | Yes |
| ServiceNow/Jira Integration | external API sync + status views | queue-based connectors + projection tables | Yes |
| OCSF to OSCAL Translation | transformation + export artifacts | async transformer + D1 metadata + R2 outputs | Yes |

### 2.2 Other major platform capabilities

- Core GRC CRUD modules (assets, controls, risks, compliance, IAM, privacy, resilience, incidents): move to direct D1 transactional writes first.
- Reporting/document generation (PDF/DOCX/XLSX): remove from synchronous request path; run async and store in R2.
- MCP server tools/resources: re-host as Worker endpoints backed by D1 read models.
- Backup/restore and large file operations: store snapshots in R2 and metadata in D1.

## 3. Target architecture (cost-first)

## 3.1 Runtime split

1. Edge/API Worker (primary)
- Authn/authz, request validation, command acceptance, read endpoints.
- No heavy compute in-request.

2. Command processors (Queue consumers)
- Apply domain commands and transactional writes to D1.
- Emit domain events into an event/outbox stream.

3. Projection processors (Queue consumers)
- Update read models in D1 for dashboards/search/analytics.

4. Batch/export processors (async)
- Generate PDF/DOCX/XLSX and heavy transforms.
- Persist outputs in R2 and update D1 job status.

5. Frontend on Workers
- Switch SvelteKit to Cloudflare adapter.
- Keep `/api/...` facade stable while backend internals migrate.

## 3.2 Storage split

D1 (system of record for metadata + read models)
- transactional domain tables.
- command log / outbox / idempotency keys.
- domain events and projection tables.
- job state and execution history.

R2 (binary and large payload store)
- evidence attachments and revisions.
- imported scan files (SARIF/SCAP/OSCAL/archives).
- generated reports/exports.
- optional framework library bundles and snapshots.

## 3.3 CQRS boundaries

Use CQRS for these domains:
- connectors, evidence automation, continuous monitoring, workflows, version history, security graph, fedramp/rmf reporting, analytics dashboards, AI job status.

Do not force CQRS for low-complexity CRUD domains initially:
- user/profile/settings/template CRUD and small reference lists.

## 4. Data design blueprint

## 4.1 Core D1 tables to introduce early

- `commands` (idempotent command intake)
- `command_outbox` (reliable queue publishing)
- `domain_events` (append-only)
- `projection_checkpoints` (consumer offsets)
- `idempotency_keys` (client retry safety)
- `jobs` (async operation lifecycle)

## 4.2 Read-model tables (examples)

- `rm_compliance_posture`
- `rm_risk_register_overview`
- `rm_conmon_dashboard`
- `rm_security_graph_nodes`
- `rm_security_graph_edges`
- `rm_connector_health`
- `rm_poam_status`
- `rm_vendor_questionnaire_status`

All read-model tables should include:
- `tenant_id`/`folder_id` partition keys
- `updated_at`
- minimal denormalized fields for target UI/API reads

## 4.3 R2 key strategy

- `evidence/{tenant}/{evidence_id}/{revision}/{filename}`
- `imports/{tenant}/{source}/{upload_id}/{filename}`
- `exports/{tenant}/{module}/{yyyy}/{mm}/{job_id}.{ext}`
- `snapshots/{tenant}/{yyyy-mm-dd}/{snapshot_id}.tar.zst`

## 5. Phased migration plan

## Phase 0: Baseline and guardrails (1-2 weeks)

- Instrument current hot paths (DB latency, endpoint p95, queue/cron load, storage volume).
- Define SLO and cost KPIs before migration.
- Freeze feature additions in modules selected for first migration wave.

Exit criteria:
- Baseline dashboard exists.
- Top 20 endpoints by traffic and cost are identified.

## Phase 1: Edge-first deployment and storage offload (2-4 weeks)

- Move frontend to Cloudflare Worker runtime (adapter change).
- Keep current backend as origin behind `/api` proxy for compatibility.
- Implement R2 for file upload/download via signed URL flow.
- Move static framework/library blobs to R2 where possible.

Exit criteria:
- Frontend fully served from Cloudflare.
- New uploads and exports no longer use local filesystem.

## Phase 2: Command/Event foundation (3-5 weeks)

- Implement D1 command, outbox, event tables.
- Add queue-based command handlers for selected domains:
  - connectors
  - evidence automation
  - version history
- Implement idempotency and retry semantics.

Exit criteria:
- Commands are async-safe and idempotent.
- At least 3 high-cost domains no longer rely on in-request heavy processing.

## Phase 3: Projection and read optimization (3-6 weeks)

- Create D1 read models for:
  - dashboards (risk/compliance/conmon)
  - connector health/history
  - security graph views
- Route read APIs to projection tables.
- Add projector checkpointing and replay tooling.

Exit criteria:
- Read endpoints meet p95 latency target.
- Query count per request reduced on dashboard endpoints.

## Phase 4: Workflow, reporting, and heavy compute split (4-8 weeks)

- Migrate workflow execution to queue-based orchestration.
- Introduce optional Durable Object coordinator for long-running workflow locks.
- Move PDF/DOCX/XLSX generation and quantitative risk compute to async worker path.
- Store artifacts in R2; return job handles from API.

Exit criteria:
- No synchronous heavy document generation in API request path.
- Long-running jobs are fully async with resumable status.

## Phase 5: Legacy retirement and cost tuning (2-4 weeks)

- Cut over remaining CRUD modules to Worker + D1.
- Decommission Django origins by domain slice.
- Tune cron cadence, queue batch sizes, projection update frequency.

Exit criteria:
- Majority traffic handled by Cloudflare Worker services.
- Legacy backend retained only for explicitly deferred modules or removed.

## 6. Cost optimization controls (must-have)

1. Keep synchronous Worker CPU short.
- Move every heavy transform/export/simulation to queue jobs.

2. Read from projections, not transactional joins.
- Precompute dashboard and graph views.

3. Optimize D1 access patterns.
- Prepared statements, narrow selects, composite indexes with tenant key first.

4. Use R2 for all binaries and large payloads.
- D1 stores metadata and pointers only.

5. Enforce idempotent command processing.
- Prevent duplicate external sync/export/AI calls.

6. Use Cron only for scheduling, Queue for workload.
- Cron triggers enqueue work; workers perform processing.

7. Apply retention/lifecycle policies.
- Expire transient exports and stale raw imports in R2.

8. Cache stable data.
- Connector registry metadata, framework catalogs, static lookups.

9. Stream where possible.
- Avoid buffering large files in Worker memory.

10. Add per-feature cost telemetry.
- Attribute D1, Queue, and R2 usage by module to guide tuning.

## 7. Top risks and mitigations

1. Risk: direct migration of heavy Python-dependent logic to Worker runtime.
- Mitigation: async compute service path first; then selectively rewrite hotspots.

2. Risk: D1 performance degradation from dashboard joins.
- Mitigation: mandatory projection tables for all dashboard endpoints.

3. Risk: inconsistent state during dual-write migration.
- Mitigation: outbox pattern + replayable event log + cutover by bounded context.

4. Risk: workflow engine race conditions.
- Mitigation: queue serialization by workflow/execution key; Durable Object only where lock coordination is required.

5. Risk: cost regressions from over-frequent sync/cron jobs.
- Mitigation: tenant-level schedule controls, jittering, backoff, and usage-based defaults.

## 8. First 30-day implementation backlog

1. Frontend runtime shift
- replace `@sveltejs/adapter-node` with Cloudflare adapter.
- keep existing `/api/[...segments]` proxy contract stable.

2. R2 artifact flow
- evidence and export uploads/downloads via signed URLs.
- metadata pointer model in D1-ready schema.

3. Command/event skeleton
- implement `commands`, `command_outbox`, `domain_events`, `jobs` in D1.
- implement queue consumer with idempotency keys.

4. First CQRS domain
- migrate connectors and evidence automation to command + projection flow.

5. Reporting async conversion
- convert one report endpoint (for example POA&M/FedRAMP export) to job + R2 artifact.

6. Observability and budget guardrails
- create dashboards for p95 latency, queue lag, D1 query counts, R2 object growth.

## 9. Success metrics

- API p95 latency: reduced for dashboard and list endpoints after projection cutover.
- Worker CPU time per request: reduced by shifting heavy work async.
- D1 query count per request: reduced on dashboard-heavy routes.
- Export success and retry rates: improved due to durable async jobs.
- Monthly infra cost per active tenant/workspace: trending down after each phase.

