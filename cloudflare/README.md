# Cloudflare Edge Runtime

This directory is the starting point for the Django/Svelte to Cloudflare Workers/React migration.

It is set up to:

- serve the React app from [`apps/web`](../apps/web)
- expose API routes from `/_api/*`
- persist metadata in D1
- persist workspace administration state for folders, users, groups, roles, and assignments in D1
- persist framework controls and compliance requirement review state in D1
- persist library-pack metadata and generated applied-control action plans in D1
- persist third-party, privacy, and resilience workspace records in D1
- persist report exports, chat sessions, import jobs, portal assignments, and advanced-risk studies in D1
- store evidence artifacts in R2
- process background work with Queues
- coordinate tenant-scoped work with a Durable Object

## Local workflow

1. Build the React app:

```bash
npm --prefix ../apps/web install
npm --prefix ../apps/web run build
```

2. Install Worker dependencies:

```bash
npm install
```

3. Apply D1 migrations locally:

```bash
npm run migrate:local
```

4. Run the Worker:

```bash
npm run dev
```

Or run the verified local path that rebuilds the React shell first:

```bash
npm run dev:local
```

Wait until Wrangler prints that the local server is ready before running requests or the smoke test.

5. Bootstrap demo data:

```bash
curl -X POST http://127.0.0.1:8787/_api/core/bootstrap-demo
```

6. Run the local smoke test:

```bash
npm run smoke:local
```

Then use the React shell with:

- tenant id: `tenant-demo`
- user id: `user-demo`

The seeded workspace also includes:

- users: `user-demo`, `user-analyst-demo`, `user-vendor-demo`
- libraries: `library-demo-iso-pack`, `library-demo-vendor-pack`
- entities: `entity-demo-main`, `entity-demo-vendor`, `entity-demo-resilience`
- processings: `processing-demo-workforce`, `processing-demo-customer`
- business impact analyses: `bia-demo-enterprise`, `bia-demo-vendor`
- report export: `report-export-demo-dora`
- import job: `import-job-demo-risk`
- chat session: `chat-session-demo-overview`
- portal assignment: `portal-assignment-demo-vendor`
- EBIOS study: `ebios-study-demo-enterprise`
- quantitative study: `quantitative-study-demo-enterprise`
- routes: `/workspace/me`, `/workspace/domains`, `/workspace/team`, `/workspace/access`, `/frameworks`, `/frameworks/framework-demo-iso27001`, `/libraries`, `/libraries/library-demo-iso-pack`, `/assessments`, `/risk-assessments/risk-assessment-enterprise-demo`, `/risk-assessments/risk-assessment-enterprise-demo/action-plan`, `/compliance-assessments/compliance-assessment-iso-demo`, `/compliance-assessments/compliance-assessment-iso-demo/action-plan`, `/compliance-assessments/compliance-assessment-iso-demo/flash-mode`, `/applied-controls/flash-mode?complianceAssessmentId=compliance-assessment-iso-demo`, `/applied-controls/kanban-mode?complianceAssessmentId=compliance-assessment-iso-demo`, `/third-party`, `/third-party/entities/entity-demo-vendor`, `/entities/entity-demo-vendor`, `/privacy`, `/privacy/processings/processing-demo-customer`, `/processings/processing-demo-customer`, `/resilience`, `/resilience/business-impact-analyses/bia-demo-enterprise`, `/business-impact-analysis/bia-demo-enterprise`, `/reports`, `/reports/dora-roi`, `/chat`, `/imports`, `/portal`, `/portal/assignments/portal-assignment-demo-vendor`, `/advanced-risk/ebios`, `/advanced-risk/ebios/ebios-study-demo-enterprise`, `/advanced-risk/quantitative`, `/advanced-risk/quantitative/quantitative-study-demo-enterprise`, `/advanced-risk/quantitative/quantitative-study-demo-enterprise/executive-summary`, `/advanced-risk/quantitative/quantitative-study-demo-enterprise/key-metrics`, `/advanced-risk/quantitative/quantitative-study-demo-enterprise/action-plan`, `/quantitative-risk-scenarios/quant-scenario-demo-ransomware`, `/quantitative-risk-hypotheses/quant-hypothesis-demo-ransomware-current`

The smoke test verifies:

- folder creation
- user creation
- user group creation
- custom role creation
- direct and group-based role assignments
- scoped access resolution for a secondary user
- framework detail and requirement tree endpoints
- library catalog and library detail endpoints
- third-party entity, solution, and contract endpoints
- privacy processing, rights request, and breach endpoints
- business impact analysis endpoints
- reports catalog, DORA linting, export creation, and downloads
- workspace chat session creation and messaging
- import pipeline execution and created-object tracking
- portal assignment detail, response updates, and submission
- EBIOS study detail and workshop progression
- quantitative study detail, executive-summary, key-metrics, action-plan, and refresh flows
- risk action-plan summary and budget-overview flows
- perimeter creation
- risk assessment creation
- risk-assessment detail and scoped scenario endpoints
- compliance assessment creation
- compliance requirement review updates
- compliance action-plan summary and budget endpoints
- applied-control generation and update flows
- framework, risk, ConMon, evidence, queue, and R2 flows

Legacy route note:

- the React shell now includes a legacy route bridge so old Svelte paths still land on an owned migrated workspace instead of a dead route

## Production deployment

This Worker now follows the same production-operating pattern used in the `../alovoa` Cloudflare setup:

- a local private env file for deployment secrets and runtime knobs
- Cloudflare token preflight verification
- explicit production D1 migration and deploy scripts
- post-deploy smoke and latency validation
- a GitHub Actions deploy workflow that injects Cloudflare secrets

### Local production env file

Copy `cloudflare/.env.production.example` to `cloudflare/.env-prod` and fill in the private values.

The deploy scripts now follow the same naming convention used in `../alovoa` and `../taxes`:

- preferred: `cloudflare/.env-prod`
- also accepted: `cloudflare/.env.production.local`

For local Wrangler development, use `cloudflare/.dev.vars` when you need local-only secret bindings.

Important values:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `REGOVISE_WORKER_SERVICE_NAME`
- `REGOVISE_PROD_BASE_URL`
- optional smoke identity values: `PROD_SMOKE_TENANT_ID`, `PROD_SMOKE_USER_ID`
- optional mail settings: `EMAIL_PROVIDER`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `EMAIL_TIMEOUT_SECONDS`, `EMAIL_WEBHOOK_URL`, `EMAIL_WEBHOOK_BEARER_TOKEN`, `EMAIL_MAILCHANNELS_URL`, `EMAIL_DKIM_*`, `MAILCHANNELS_API_KEY`

The Worker now supports real Mailchannels-backed transactional email for:

- workspace access provisioning
- report export completion
- portal assignment submission confirmation

Runtime behavior:

- `EMAIL_PROVIDER=none` skips delivery but still logs delivery attempts
- `EMAIL_PROVIDER=webhook` forwards transactional email payloads to your own notification service
- `EMAIL_PROVIDER=mailchannels` enables live delivery
- `MAILCHANNELS_API_KEY` should be synced as a Cloudflare Worker secret
- `EMAIL_WEBHOOK_BEARER_TOKEN` should be synced as a Cloudflare Worker secret when using `EMAIL_PROVIDER=webhook`
- `OTP_EMAIL_*` aliases are also accepted for compatibility with the `alovoa` deploy pattern

Local validation commands:

```bash
npm run smoke:local
npm run smoke:local:email
```

Or run both together:

```bash
npm run smoke:local:full
```

### Production commands

Verify token and API access:

```bash
npm run verify:production-token
```

Apply production D1 migrations:

```bash
npm run migrate:production:script
```

Run the scripted production deploy pipeline:

```bash
npm run deploy:production:script
```

The deploy script can optionally sync the `MAILCHANNELS_API_KEY` and `EMAIL_WEBHOOK_BEARER_TOKEN` Worker secrets before deployment when `RUN_SECRET_SYNC=1`.

Run only the post-deploy smoke:

```bash
npm run smoke:production
```

### GitHub Actions

The production deploy workflow lives at `.github/workflows/deploy-regovise-edge.yml`.

It expects these GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `PROD_SMOKE_TENANT_ID`
- `PROD_SMOKE_USER_ID`
- `MAILCHANNELS_API_KEY` (optional, enables live transactional email)
- `EMAIL_WEBHOOK_BEARER_TOKEN` (optional, enables authenticated webhook email delivery)
