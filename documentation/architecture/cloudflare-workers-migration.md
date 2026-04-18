# Cloudflare Workers Migration Blueprint

This repository is currently a large Django + DRF backend paired with a SvelteKit frontend. Converting it to Cloudflare Workers + D1 + R2 + Queues + Durable Objects + React is not a lift-and-shift rewrite. It is a decomposition exercise.

The goal of this document is to define the migration shape we can actually execute without freezing product delivery.

## Target architecture

The new baseline is:

- `cloudflare/`: the new edge runtime
- `apps/web/`: the new React shell
- `D1`: metadata, tenancy, lightweight transactional state
- `R2`: evidence artifacts, exports, report payloads, uploaded files
- `Queues`: long-running or retryable work such as evidence collection, ConMon runs, report generation dispatch, import pipelines
- `Durable Objects`: tenant-scoped coordination, execution leases, rate limiting, workflow serialization

The Cloudflare Worker now owns:

- `/_api/core/*`
- `/_api/iam/*`
- `/_api/conmon/*`
- `/_api/evidence/*`
- `/_api/ops/*`
- SPA asset serving for the React shell

Today, the verified product slices in the new app are:

- dashboard and workspace overview
- workspace administration: folders, users, groups, roles, and role assignments
- frameworks and library packs
- perimeters, risk assessments, and compliance assessments
- compliance action plans and applied controls
- third-party management: entities, solutions, contracts, and vendor assessments
- privacy operations: processings, rights requests, and breach registers
- resilience operations: business impact analyses, recovery metrics, and escalation thresholds
- reports and export packages
- workspace guidance chat and deterministic import pipelines
- auditee portal assignments and response workflows
- advanced risk modules: EBIOS RM and quantitative studies
- risk registers and risk scenarios
- continuous monitoring profiles and executions
- evidence sources, jobs, and artifacts

## What ports cleanly

These areas map well to Workers + D1:

- health, me, tenant metadata
- reports, exports, chat session state, and portal response workflows
- advanced-risk orchestration and lightweight quantitative summaries
- continuous monitoring orchestration
- evidence source and job metadata
- light CRUD around frameworks, risks, assessments, comments, tasks
- webhook dispatch metadata
- queue-backed asynchronous workflows

These areas should move to Workers later, feature slice by feature slice:

- `core`
- `resilience`
- `privacy`
- `tprm`
- `webhooks`
- `global_settings`

## What does not belong inside a Worker

Several Django dependencies are Python-heavy or runtime-heavy enough that they should be externalized rather than reimplemented directly in a Worker:

- `weasyprint`
- `python-docx`
- `docxtpl`
- `numpy`
- `scipy`
- `pandas`
- `matplotlib`
- `openpyxl`
- `PyMuPDF`
- `sentence-transformers`
- `xmlsec`

Recommended treatment:

- keep metadata and orchestration in Workers
- dispatch heavy document, import, and AI/indexing work through Queues
- run the heavy work in a separate containerized service or specialized worker tier

## Phased migration

### Phase 1: Edge foundation

Land a working target deployment before porting the full product:

- Worker with D1, R2, Queue, and Durable Object bindings
- React shell served from the same deployment
- bootstrap and health endpoints
- first D1-backed feature slices for ConMon and Evidence

This phase is what the current scaffolding in [`cloudflare/`](/Users/tkhan/IdeaProjects/ciso-assistant-community/cloudflare) and [`apps/web/`](/Users/tkhan/IdeaProjects/ciso-assistant-community/apps/web) now supports.

### Phase 2: Auth and tenancy

Replace Django/Knox auth with an edge-native session model:

- explicit tenant and user identity for local migration work
- D1-backed sessions
- D1-backed workspace principals, domain folders, and scoped role assignments
- eventual session broker and IdP integration
- tenant-aware authorization checks on every route

### Phase 3: Core GRC domain slices

Port by bounded vertical slices, not by framework layer:

- folders + perimeters + users + role assignments
- frameworks + controls + libraries + assessments
- risk registers + scenarios + applied controls + action plans
- third-party entities + solutions + contracts + reviews
- privacy processings + requests + breaches
- resilience BIAs + recovery thresholds
- dashboards, portal workbenches, and global search

Each slice should include:

- D1 schema
- Worker routes
- React views
- migration script or importer from current Django data

### Phase 4: Heavy async services

Move report generation, import/export, and evidence enrichment behind queues:

- queue message accepted quickly at the edge
- worker or external processor performs the heavy work
- D1 tracks status
- R2 stores the binary output

### Phase 5: Chat, search, and advanced integrations

The current chat stack depends on Django ORM, Qdrant, and Python ML tooling. That should become a separate subsystem with a thin Worker front door rather than being forced into the edge runtime.

## Mapping from the current app

High-level mapping from current surfaces:

- `backend/core` -> Worker services for core CRUD, search metadata, dashboards
- `backend/resilience` -> Worker services for BIA and resilience assessments
- `backend/privacy` -> Worker services for privacy inventories and requests
- `backend/tprm` -> Worker services for entities, solutions, contracts
- `backend/webhooks` -> Worker-native outbound webhook dispatch and retries
- `backend/serdes` -> queue-backed import/export processors
- `backend/chat` -> Worker session front door plus future externalized AI/runtime providers
- `backend/ebios_rm` -> Worker services for EBIOS RM studies and workshop state
- `backend/crq` -> Worker services for quantitative studies, metrics, and treatment plans
- `backend/doc_management` -> queue-backed document generation service
- `frontend/src/routes/(app)` -> React route modules under `apps/web/src/features`

## Why not do a big-bang rewrite

The current backend exposes a very large API surface from [`backend/core/urls.py`](/Users/tkhan/IdeaProjects/ciso-assistant-community/backend/core/urls.py), and the current UI spans dozens of Svelte routes under [`frontend/src/routes`](/Users/tkhan/IdeaProjects/ciso-assistant-community/frontend/src/routes).

A big-bang replacement would combine these risks at once:

- data model drift
- auth regressions
- route parity failures
- background job regressions
- broken report generation
- import/export incompatibility

The safer path is parallel runtime migration:

1. establish the Cloudflare runtime foundation
2. port one vertical slice at a time
3. cut traffic feature-by-feature
4. retire Django/Svelte only after the slices reach parity

## First commands

From the repository root:

```bash
npm --prefix apps/web install
npm --prefix apps/web run build
npm --prefix cloudflare install
npm --prefix cloudflare run migrate:local
npm --prefix cloudflare run dev
```

Then seed demo data:

```bash
curl -X POST http://127.0.0.1:8787/_api/core/bootstrap-demo
```

Use:

- tenant id: `tenant-demo`
- user id: `user-demo`

## Verified local workflow

The following path is verified locally in this repository:

1. Install React dependencies:

```bash
npm --prefix apps/web install
```

2. Build the React shell:

```bash
npm --prefix apps/web run build
```

3. Install Worker dependencies:

```bash
npm --prefix cloudflare install
```

4. Apply D1 migrations:

```bash
npm --prefix cloudflare run migrate:local
```

5. Start the Worker:

```bash
npm --prefix cloudflare run dev:local
```

Wait for Wrangler to report that the local server is ready before continuing.

6. In another terminal, run the local smoke test:

```bash
npm --prefix cloudflare run smoke:local
```

7. Open the UI:

```text
http://127.0.0.1:8787/
```

The verified local flow covers:

- Worker startup
- React asset serving
- demo bootstrap
- D1 reads and writes
- workspace folder, user, group, role, and access-assignment creation
- IAM me/access resolution for a secondary user
- framework creation, requirement seeding, and framework detail rendering
- library list/detail rendering with seeded governance packs
- third-party entity, solution, and contract create/list/detail flows
- privacy processing, rights request, and breach create/list/detail flows
- business impact analysis create/list/detail flows
- reports catalog, DORA linting, export creation, and download flows
- workspace chat session creation and messaging
- import pipeline execution and created-object tracking
- portal assignment review, response updates, and submission
- EBIOS RM list/detail/workshop update flows
- quantitative study detail, executive-summary, key-metrics, action-plan, and refresh flows
- risk register and risk scenario creation plus risk-assessment drill-down rendering
- compliance assessment requirement review and progress updates
- applied-control generation, flash-mode review, and kanban rendering
- compliance action-plan budget and summary endpoints
- ConMon queue execution
- evidence queue execution
- R2 artifact creation
- Durable Object workflow state endpoint

## Verified local endpoints

After bootstrap, these endpoints should return data successfully:

- `GET /_api/core/health`
- `POST /_api/core/bootstrap-demo`
- `GET /_api/core/overview`
- `GET /_api/iam/me`
- `GET /_api/iam/folders`
- `POST /_api/iam/folders`
- `GET /_api/iam/users`
- `POST /_api/iam/users`
- `GET /_api/iam/user-groups`
- `POST /_api/iam/user-groups`
- `GET /_api/iam/roles`
- `POST /_api/iam/roles`
- `GET /_api/iam/role-assignments`
- `POST /_api/iam/role-assignments`
- `GET /_api/core/frameworks`
- `POST /_api/core/frameworks`
- `GET /_api/core/frameworks/:frameworkId`
- `GET /_api/core/frameworks/:frameworkId/tree`
- `GET /_api/core/frameworks/:frameworkId/controls`
- `POST /_api/core/frameworks/:frameworkId/controls`
- `GET /_api/core/libraries`
- `GET /_api/core/libraries/:libraryId`
- `GET /_api/core/entities`
- `POST /_api/core/entities`
- `GET /_api/core/entities/:entityId`
- `GET /_api/core/solutions`
- `POST /_api/core/solutions`
- `GET /_api/core/contracts`
- `POST /_api/core/contracts`
- `GET /_api/core/entity-assessments`
- `GET /_api/core/processings`
- `POST /_api/core/processings`
- `GET /_api/core/processings/:processingId`
- `GET /_api/core/right-requests`
- `POST /_api/core/right-requests`
- `GET /_api/core/data-breaches`
- `POST /_api/core/data-breaches`
- `GET /_api/core/business-impact-analyses`
- `POST /_api/core/business-impact-analyses`
- `GET /_api/core/business-impact-analyses/:analysisId`
- `GET /_api/core/perimeters`
- `POST /_api/core/perimeters`
- `GET /_api/core/risk-assessments`
- `POST /_api/core/risk-assessments`
- `GET /_api/core/risk-assessments/:assessmentId`
- `GET /_api/core/risk-assessments/:assessmentId/scenarios`
- `POST /_api/core/risk-assessments/:assessmentId/scenarios`
- `GET /_api/core/risk-assessments/:assessmentId/action-plan`
- `GET /_api/core/risk-assessments/:assessmentId/action-plan/budget-overview`
- `GET /_api/core/compliance-assessments`
- `POST /_api/core/compliance-assessments`
- `GET /_api/core/compliance-assessments/:assessmentId`
- `GET /_api/core/compliance-assessments/:assessmentId/requirements`
- `GET /_api/core/compliance-assessments/:assessmentId/action-plan`
- `GET /_api/core/compliance-assessments/:assessmentId/action-plan/budget-overview`
- `POST /_api/core/compliance-assessments/:assessmentId/requirements/:requirementId`
- `GET /_api/core/risk-registers`
- `POST /_api/core/risk-registers`
- `GET /_api/core/risk-scenarios`
- `POST /_api/core/risk-scenarios`
- `GET /_api/core/applied-controls`
- `POST /_api/core/applied-controls/:appliedControlId`
- `GET /_api/core/tenants/tenant-demo/workflows`
- `GET /_api/conmon/profiles`
- `POST /_api/conmon/profiles/conmon-profile-demo/run`
- `GET /_api/conmon/executions`
- `GET /_api/evidence/sources`
- `GET /_api/ops/reports`
- `GET /_api/ops/reports/dora-roi`
- `GET /_api/ops/reports/exports`
- `POST /_api/ops/reports/exports`
- `GET /_api/ops/reports/exports/:exportId/download`
- `GET /_api/ops/chat/status`
- `GET /_api/ops/chat/sessions`
- `POST /_api/ops/chat/sessions`
- `POST /_api/ops/chat/sessions/:sessionId/messages`
- `GET /_api/ops/imports`
- `POST /_api/ops/imports`
- `GET /_api/ops/portal/assignments`
- `GET /_api/ops/portal/assignments/:assignmentId`
- `POST /_api/ops/portal/assignments/:assignmentId/requirements/:requirementId`
- `POST /_api/ops/portal/assignments/:assignmentId/submit`
- `GET /_api/ops/ebios-studies`
- `POST /_api/ops/ebios-studies`
- `GET /_api/ops/ebios-studies/:studyId`
- `POST /_api/ops/ebios-studies/:studyId/workshops/:workshopId/:stepId`
- `GET /_api/ops/quantitative-studies`
- `POST /_api/ops/quantitative-studies`
- `GET /_api/ops/quantitative-studies/:studyId`
- `GET /_api/ops/quantitative-studies/:studyId/executive-summary`
- `GET /_api/ops/quantitative-studies/:studyId/key-metrics`
- `GET /_api/ops/quantitative-studies/:studyId/action-plan`
- `POST /_api/ops/quantitative-studies/:studyId/retrigger-simulations`
- `GET /_api/ops/quantitative-scenarios/:scenarioId`
- `GET /_api/ops/quantitative-hypotheses/:hypothesisId`
- `GET /_api/ops/parity/overview`

## Current local product baseline

The local Cloudflare/React app now opens as a usable workspace baseline rather than only a stack scaffold. The current routes verified in-browser are:

- `/`
- `/workspace/me`
- `/workspace/domains`
- `/workspace/team`
- `/workspace/access`
- `/frameworks`
- `/frameworks/:frameworkId`
- `/libraries`
- `/libraries/:libraryId`
- `/assessments`
- `/risk-assessments/:assessmentId`
- `/risk-assessments/:assessmentId/action-plan`
- `/compliance-assessments/:assessmentId`
- `/compliance-assessments/:assessmentId/action-plan`
- `/compliance-assessments/:assessmentId/flash-mode`
- `/applied-controls/flash-mode`
- `/applied-controls/kanban-mode`
- `/third-party`
- `/third-party/entities/:entityId`
- `/entities/:entityId`
- `/privacy`
- `/privacy/processings/:processingId`
- `/processings/:processingId`
- `/resilience`
- `/resilience/business-impact-analyses/:analysisId`
- `/business-impact-analysis/:analysisId`
- `/reports`
- `/reports/dora-roi`
- `/chat`
- `/imports`
- `/portal`
- `/portal/assignments/:assignmentId`
- `/advanced-risk/ebios`
- `/advanced-risk/ebios/:studyId`
- `/advanced-risk/quantitative`
- `/advanced-risk/quantitative/:studyId`
- `/advanced-risk/quantitative/:studyId/executive-summary`
- `/advanced-risk/quantitative/:studyId/key-metrics`
- `/advanced-risk/quantitative/:studyId/action-plan`
- `/quantitative-risk-scenarios/:scenarioId`
- `/quantitative-risk-hypotheses/:hypothesisId`
- `/risk-scenarios`
- `/conmon/profiles`
- `/conmon/executions`
- `/evidence/sources`
- `/evidence/jobs`

The app also now ships a legacy route bridge for the remaining Svelte entry points. Old paths like `/my-profile/settings`, `/assets/:id`, `/compliance-assessments/:id/advanced-analytics`, `/risk-assessments/:id/export/pdf`, `/settings/webhooks/endpoints/:id`, `/login`, `/password-reset/confirm`, and `/quantitative-risk-studies/:id/action-plan/budget-overview` resolve into an explicit migrated owner instead of falling through to a blank page.

The seeded local tenant includes:

- root workspace folder: `Global Workspace`
- domains: `Corporate Governance`, `Vendor Assurance`
- users: `Demo Administrator`, `Governance Analyst`, `Vendor Owner`
- built-in roles: `Administrator`, `Domain Manager`, `Analyst`, `Reader`
- seeded libraries: `ISO Governance Starter Pack`, `Vendor Assurance Pack`
- seeded entities: `Nimbus Financial`, `Northwind Cloud`, `Bluefin Recovery Services`
- seeded privacy processings: `Workforce Identity Lifecycle`, `Customer Due Diligence Workflow`
- seeded BIAs: `Enterprise Service Recovery Study`, `Vendor Continuity Recovery Study`
- seeded report export: `DORA ROI demo export`
- seeded import job: `Seeded risk scenario import`
- seeded chat session: `Workspace overview`
- seeded portal assignment: `Vendor due diligence pack`
- seeded EBIOS study: `Enterprise identity dependency study`
- seeded quantitative study: `Identity service economic exposure`

The smoke test additionally creates a temporary domain, user, group, custom role, and both group-based and direct role assignments to verify that scoped access resolution works end to end.
- `POST /_api/evidence/sources/evidence-source-demo/collect`
- `GET /_api/evidence/jobs`
- `GET /_api/evidence/artifacts`

## Current local status

The current migration shell is working locally for the first slice:

- dashboard renders from the Worker-served React app
- frameworks page renders and supports create/list/detail
- framework detail renders a requirement tree and supports adding controls
- libraries page renders and links into seeded library detail views
- assessments page renders and links to risk/compliance detail workspaces
- risk assessment detail renders a heatmap and supports scoped scenario creation
- risk assessment action-plan renders a derived treatment backlog and budget signal from scoped scenarios
- compliance assessment detail renders requirement review state and supports saving updates
- compliance action-plan workspace renders generated applied controls and budget rollups
- compliance flash-mode can now be opened from both canonical and legacy route shapes
- applied-controls flash mode supports focused review and inline save
- applied-controls kanban mode supports status updates across workflow columns
- third-party workspace renders entities, solutions, contracts, and vendor assessment coverage
- entity detail renders linked solutions, contracts, and review posture
- privacy workspace renders processings, rights requests, and breach handling
- processing detail renders purposes, personal data, contractors, and transfer mappings
- resilience workspace renders BIA summaries and create/list flows
- business impact analysis detail renders asset recovery thresholds and coverage metrics
- reports workspace renders catalog and export history
- DORA report workspace renders validation detail and export generation
- chat workspace renders sessions and tenant-scoped assistant responses
- imports workspace renders pipeline state and created-object summaries
- portal workspace renders auditee assignments and response flows
- EBIOS workspace renders workshop state and advanced-risk detail
- quantitative workspace renders portfolio metrics, summaries, and action plans
- quantitative scenario and hypothesis routes have direct semantic-equivalent detail pages
- risk scenarios page renders and supports register/scenario create/list
- ConMon profiles page renders and lists seeded data
- Evidence sources page renders and lists seeded data
- queue consumers complete locally and mark jobs/executions as `success`

This is now a route-complete local baseline for the legacy Svelte entry points: every known page route has either a direct migrated React implementation or a semantic bridge into the migrated owner workspace. Backend parity remains intentionally consolidated rather than 1:1 for some Django APIs, but the user-facing route surface no longer depends on Svelte or Django-only pages.

## Troubleshooting

If the dashboard loads but counts stay at `0`:

- re-run `POST /_api/core/bootstrap-demo`
- confirm `GET /_api/core/overview` is called with `x-tenant-id: tenant-demo`

If the UI loads but API requests fail:

- make sure the Worker is serving the built React app from `apps/web/dist`
- rebuild with `npm --prefix apps/web run build`

If migrations appear missing:

- run `npm --prefix cloudflare run migrate:local`

If queue actions stay `pending`:

- ensure you are testing against `wrangler dev`, not a static file server
- run `npm --prefix cloudflare run smoke:local` to verify the local consumer path
