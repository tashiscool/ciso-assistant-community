# Analytics Subsystem Gap Analysis and Fixes

**Date**: 2026-03-13
**Scope**: `cloudflare/` analytics-worker, projection-worker, edge-api-worker, shared utilities, migrations, wrangler configs

---

## Executive Summary

Five categories were audited: Rollups, Retention/Compaction, Backfill/Replay, Durable Objects, and Dead Letter Queue. Two categories were fully implemented (Retention, Durable Objects), one was partially implemented (Rollups), and two had critical gaps (Backfill/Replay, Dead Letter Queue). All gaps have been fixed.

---

## A. Rollup System

### What Was Already Present
- `analytics_rollup_1m_event_volume`, `analytics_rollup_1h_event_volume`, `analytics_rollup_1d_event_volume` tables exist in migration `0009_analytics_subsystem.sql`
- `analytics_rollup_1d_domain_activity`, `analytics_rollup_1d_source_health`, `analytics_rollup_1d_model_activity` exist at **daily grain only**
- The `AnalyticsAggregateDurableObject` correctly populates all rollup tables on every ingest
- The edge-api exposes `/api/v2/analytics/volume` with grain-selectable queries across 1m/1h/1d tables
- The edge-api exposes `/api/v2/analytics/domains`, `/api/v2/analytics/sources`, `/api/v2/analytics/models` but only queries daily rollups

### Gap Found
Domain activity, source health, and model activity rollups were only available at daily (1d) grain. Dashboards that need intra-day breakdowns (e.g., "which domain had the most events in the last 4 hours?") had to scan raw event shards -- unacceptable at scale.

### Fix Applied
- **Migration `0012_analytics_gaps.sql`**: Added three new tables:
  - `analytics_rollup_1h_domain_activity`
  - `analytics_rollup_1h_source_health`
  - `analytics_rollup_1h_model_activity`
  - Each with appropriate composite primary keys and DESC-ordered indexes

- **`src/analytics-worker.ts`**: Updated `AnalyticsAggregateDurableObject.handleIngest()`:
  - `aggregateDomains()`, `aggregateSources()`, `aggregateModels()` now accept a `grain` parameter (`"1h" | "1d"`)
  - Both hourly and daily rollup entries are computed and written in the same batch
  - `pushDomainStatements()`, `pushSourceStatements()`, `pushModelStatements()` now accept a `tableName` parameter for table-polymorphic upserts

**Status: FIXED**

---

## B. Retention / Compaction

### What Was Already Present
- `runRetentionTasks()` function in `analytics-worker.ts` with hot/warm/cold tiered purge
- Cron trigger configured in `wrangler.analytics-worker.toml`: `"15 3 * * *"` (daily at 03:15 UTC)
- Environment variables: `HOT_RETENTION_DAYS=30`, `WARM_RETENTION_DAYS=180`, `COLD_RETENTION_DAYS=730`
- Policy mapping:
  - **Hot (30d)**: purges `analytics_event_dedupe` and `analytics_rollup_1m_event_volume`
  - **Warm (180d)**: purges `analytics_rollup_1h_event_volume`
  - **Cold (730d)**: purges daily rollups and `analytics_raw_shards`
- Retention execution recorded in `analytics_checkpoints` for audit

### Fix Applied
- Added retention purge for the three new 1h rollup tables at warm cutoff
- Added retention purge for resolved DLQ entries at warm cutoff

**Status: ALREADY PRESENT (extended for new tables)**

---

## C. Backfill / Replay

### What Was Already Present
- `analytics_rebuild_runs` table exists in migration `0009_analytics_subsystem.sql` with columns for `rebuild_id`, `status`, `source_prefix`, `cursor`, `replayed_events`
- `analytics_checkpoints` table tracks per-queue and per-tenant cursors
- **No implementation existed anywhere** -- the table was defined but no code used it

### Gap Found
Critical gap: there was no way to rebuild projections or rollups from R2 raw event shards. If a bug in the analytics pipeline corrupted rollup data, or if a new rollup dimension was added (like the 1h tables above), there was no mechanism to reprocess historical data.

### Fix Applied
- **`src/shared/analytics.ts`**: Added two exported functions:
  - `runBackfillFromR2(config)`: Creates a rebuild run record, iterates R2 objects matching the given prefix, parses ndjson lines, re-enqueues events to the analytics queue, and updates cursor checkpoints after each page
  - `resumeBackfillFromR2(rebuildId, config)`: Reads the saved cursor from an existing rebuild run and continues from that position

- **`src/edge-api-worker.ts`**: Added three new endpoints:
  - `POST /api/v2/analytics/backfill` -- starts a new backfill (admin-token protected)
  - `POST /api/v2/analytics/backfill/resume` -- resumes an interrupted backfill
  - `GET /api/v2/analytics/backfill/runs` -- lists rebuild run history with status filter

- **`wrangler.edge-api.toml`**: Added `CISO_ANALYTICS_R2` R2 bucket binding so the edge-api can read raw event shards

- **`src/edge-api-worker.ts` Env interface**: Added `CISO_ANALYTICS_R2: R2Bucket`

**Status: FIXED**

---

## D. Durable Objects

### What Was Already Present
- `AnalyticsAggregateDurableObject` class fully implemented in `analytics-worker.ts`
- Handles `/ingest` POST with:
  - Tenant-isolation validation (all events in a shard must share the same tenant)
  - Hour-bucket validation (all events must share the same hour bucket)
  - R2 write of ndjson shard with SHA-256 payload hash
  - Shard metadata recording in `analytics_raw_shards`
  - All six rollup table upserts in a single D1 batch
  - Internal shard stats tracking via DO storage (flush_count, events_written)
- Bound in `wrangler.analytics-worker.toml` as `ANALYTICS_AGGREGATOR` with `AnalyticsAggregateDurableObject` class
- Migration tag `analytics-v1` registered with `new_sqlite_classes`
- Health check endpoint at `/healthz`

### Gap Found
None. The Durable Object implementation is complete and production-ready.

**Status: NO GAPS FOUND**

---

## E. Dead Letter Queue

### What Was Already Present
- `DEAD_LETTER_Q` producer bound in all four worker wrangler configs:
  - `wrangler.analytics-worker.toml`
  - `wrangler.projection-worker.toml`
  - `wrangler.command-worker.toml`
  - `wrangler.export-worker.toml`
- All workers send structured payloads to `dead-letter-q` on processing failures, including source queue name, timestamp, error message, and original event/payload
- Failed messages are ack'd after DLQ send to prevent infinite redelivery

### Gap Found
Critical gap: **No consumer existed for the `dead-letter-q` queue.** Failed messages were sent to the queue but nothing ever read, tracked, or retried them. This is a data loss risk and an operational blind spot:
- No visibility into failure rates or patterns
- No automatic retry for transient failures
- No persistence for post-mortem analysis
- No alerting capability

### Fix Applied
- **`src/dlq-worker.ts`**: New worker that consumes the `dead-letter-q`:
  - Persists each dead letter entry in the `dead_letter_entries` table
  - Deduplicates against existing pending entries (same queue + tenant + error)
  - Automatic retry: re-enqueues messages to their source queue if retry count < max
  - Status lifecycle: `pending` -> `retried` (success) or `exhausted` (max retries exceeded) or `resolved` (manual/retention)
  - Scheduled cron handler runs a retry pass every 30 minutes for pending entries
  - Health check endpoint at `/healthz`

- **`wrangler.dlq-worker.toml`**: New wrangler config:
  - Consumes `dead-letter-q` with batch size 50
  - Produces to all four source queues for retry capability
  - Cron trigger: `*/30 * * * *` (every 30 minutes)
  - Configurable `DLQ_MAX_RETRIES=3`

- **`migrations/0012_analytics_gaps.sql`**: Added `dead_letter_entries` table with:
  - Status tracking (`pending`, `retried`, `exhausted`, `resolved`)
  - Retry counter with configurable max
  - First/last failure timestamps for SLA tracking
  - Indexes on `(status, source_queue)`, `(source_queue, status)`, and `(tenant_id, status)`

- **`src/edge-api-worker.ts`**: Added two DLQ observability endpoints:
  - `GET /api/v2/dlq/entries` -- list DLQ entries filtered by status and source queue
  - `GET /api/v2/dlq/stats` -- aggregate counts by status and queue, plus oldest pending entry timestamp

- **Retention integration**: `runRetentionTasks()` now purges resolved DLQ entries older than the warm retention cutoff (180 days)

**Status: FIXED**

---

## Files Created

| File | Purpose |
|------|---------|
| `migrations/0012_analytics_gaps.sql` | Schema for 1h rollup tables and DLQ tracking |
| `src/dlq-worker.ts` | Dead letter queue consumer with retry logic |
| `wrangler.dlq-worker.toml` | Wrangler config for DLQ worker |

## Files Modified

| File | Changes |
|------|---------|
| `src/analytics-worker.ts` | 1h rollup writes, parameterized aggregate/push functions, retention for new tables |
| `src/shared/analytics.ts` | Backfill/replay utilities (`runBackfillFromR2`, `resumeBackfillFromR2`) |
| `src/edge-api-worker.ts` | Backfill endpoints, DLQ endpoints, `CISO_ANALYTICS_R2` binding |
| `wrangler.edge-api.toml` | Added `CISO_ANALYTICS_R2` R2 bucket binding |

## New API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/v2/analytics/backfill` | Admin token | Start a new R2 backfill run |
| `POST` | `/api/v2/analytics/backfill/resume` | Admin token | Resume an interrupted backfill |
| `GET` | `/api/v2/analytics/backfill/runs` | None | List backfill run history |
| `GET` | `/api/v2/dlq/entries` | None | List dead letter entries by status |
| `GET` | `/api/v2/dlq/stats` | None | Aggregate DLQ statistics |

## Deployment Notes

1. Run migration `0012_analytics_gaps.sql` against D1 before deploying updated workers
2. Deploy `ciso-dlq-worker` as a new worker (`wrangler deploy -c wrangler.dlq-worker.toml`)
3. Deploy updated `ciso-analytics-worker` (rollup changes take effect on next event ingest)
4. Deploy updated `ciso-edge-api-worker` (backfill/DLQ endpoints become available)
5. To backfill the new 1h rollup tables with historical data, call `POST /api/v2/analytics/backfill` with the admin token
