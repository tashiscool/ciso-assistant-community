# Cloudflare Workers Foundation (D1 + R2 + CQRS)

This directory now contains a full Cloudflare-first implementation slice for all major CISO Assistant feature domains.

## Services

- `edge-api-worker`: command/job API, signed R2 upload/download URLs, projection reads, export job intake
- `command-worker`: CQRS command executor, domain writes, domain event persistence, projection/event fan-out, export enqueue
- `analytics-worker`: immutable event consumer, R2 raw shard writer, D1 rollup projector, retention runner
- `projection-worker`: read-model projector for dashboards, graph, automation, workflows, compliance, risk, scanner, integrations
- `automation-worker`: cron enqueue + connector queue fan-in with persisted command/job rows
- `export-worker`: async report/transform generation to R2 with module-specific completion events

## Queues

Expected queues:

- `commands-q`
- `events-q`
- `projections-q`
- `connector-sync-q`
- `exports-q`
- `dead-letter-q`

## D1 migrations

SQL migrations are in `migrations/`:

- `0001_core.sql`: commands, jobs, outbox, domain events, projection checkpoints
- `0002_read_models.sql`: initial projection/read-model tables
- `0003_domain_and_read_expansion.sql`: feature write-model tables, artifact metadata tables, expanded read models
- `0004_field_parity.sql`: field-level parity models/records/index tables
- `0009_analytics_subsystem.sql`: immutable analytics dedupe, raw shard metadata, rollups, checkpoints

Apply:

```bash
cd cloudflare
npm install
npm run migrate
```

Or with explicit wrangler config/environment:

```bash
WRANGLER_CONFIG=wrangler.edge-api.toml WRANGLER_ENV=staging ./scripts/apply-migrations.sh
```

## `/api/v2` endpoints

- `GET /api/v2/catalog`
- `POST /api/v2/commands/{command_type}`
- `GET /api/v2/jobs/{job_id}`
- `POST /api/v2/exports`
- `POST /api/v2/files/upload-url`
- `GET /api/v2/files/download-url`
- `PUT /api/v2/files/upload/{token}`
- `GET /api/v2/files/download/{token}`
- `GET /api/v2/read/{projection}`
- `GET /api/v2/legacy/state`
- `GET /api/v2/canonical/resources`
- `GET /api/v2/resources`
- `POST /api/v2/resources/mutate`
- `POST /api/v2/legacy/dispatch`
- `POST /api/v2/analytics/events`
- `GET /api/v2/analytics/overview`
- `GET /api/v2/analytics/volume`
- `GET /api/v2/analytics/domains`
- `GET /api/v2/analytics/sources`
- `GET /api/v2/analytics/models`
- `GET /api/v2/analytics/checkpoints`
- `GET /api/v2/parity/models`
- `POST /api/v2/parity/models/seed` (Bearer token if `CISO_ADMIN_TOKEN` set)
- `GET /api/v2/parity/records`
- `GET /api/v2/parity/validate`
- `GET /api/v2/parity/checklist`
- `GET /api/v2/parity/coverage`

`/api/v2/commands/{command_type}` accepts both known command types (listed in `/api/v2/catalog`) and unknown types, which are routed through a legacy migration bridge (`legacy_domain_state` + `rm_legacy_domain_overview`) to keep long-tail Python features migrating without blocking.

For the large mounted DRF-style surface, prefer the canonical resource layer:

- `GET /api/v2/canonical/resources?resource_path=folders`
- `GET /api/v2/resources?tenant_id=<tenant>&resource_path=folders`
- `POST /api/v2/resources/mutate`

That layer resolves route families against the seeded Django model/route registries in D1 and keeps generic CRUD migration logic inside the worker instead of the frontend proxy.

For broad legacy `/api/*` parity, the frontend compat layer can now forward generic traffic to:

- `POST /api/v2/legacy/dispatch`

This endpoint parses legacy paths like `/api/folders/`, `/api/folders/{id}/`, and `/api/folders/status/` and routes them through the worker-side canonical resource handlers.

## Cost optimization defaults

- Heavy payloads are persisted in R2; D1 keeps metadata pointers and compact projections.
- Analytics uses write-once immutable events, R2 NDJSON shard storage, and multi-grain D1 rollups instead of raw scans.
- Field parity snapshots preserve full record payloads per model key (`field_parity_records`), with strict completeness checks (`STRICT_FIELD_PARITY=true`) and R2 offload for large records.
- Tenant-scoped object keys are enforced (`{prefix}/{tenant_id}/...`) for safety and sharding readiness.
- Artifact metadata is centralized in `r2_artifacts` for lifecycle/retention management.
- Async-heavy domains route through queues and read models instead of synchronous joins.

## Frontend cutover toggle

The existing frontend config supports adapter selection via env var:

```bash
SVELTEKIT_ADAPTER=cloudflare
PUBLIC_FRONTEND_RUNTIME=cloudflare
PUBLIC_CLOUDFLARE_API_URL=/api/v2
```

In Cloudflare mode, the frontend runs as SPA (`frontend/src/routes/+layout.ts` has `ssr=false`) and the root app page uses typed `/api/v2` contracts from `frontend/src/lib/cloudflare/*`.
