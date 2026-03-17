import type { DomainEventEnvelope } from "./types";

export interface AnalyticsEventEnvelope {
  event_id: string;
  tenant_id: string;
  source: string;
  event_type: string;
  event_version: number;
  event_time: string;
  ingest_time: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  domain: string;
  model_key: string | null;
}

export type AnalyticsQueueMessage = DomainEventEnvelope | AnalyticsEventEnvelope;

export type AnalyticsGrain = "1m" | "1h" | "1d";

export function isDomainEventEnvelope(value: unknown): value is DomainEventEnvelope {
  return isRecord(value) &&
    typeof value.event_id === "string" &&
    typeof value.event_type === "string" &&
    typeof value.tenant_id === "string" &&
    typeof value.aggregate_id === "string" &&
    typeof value.aggregate_version === "number" &&
    typeof value.occurred_at === "string" &&
    isRecord(value.payload);
}

export function isAnalyticsEventEnvelope(value: unknown): value is AnalyticsEventEnvelope {
  return isRecord(value) &&
    typeof value.event_id === "string" &&
    typeof value.tenant_id === "string" &&
    typeof value.source === "string" &&
    typeof value.event_type === "string" &&
    typeof value.event_version === "number" &&
    typeof value.event_time === "string" &&
    typeof value.ingest_time === "string" &&
    typeof value.aggregate_id === "string" &&
    isRecord(value.payload) &&
    typeof value.domain === "string";
}

export function normalizeAnalyticsEvent(
  input: AnalyticsQueueMessage,
  ingestTimeIso: string = new Date().toISOString()
): AnalyticsEventEnvelope {
  if (isAnalyticsEventEnvelope(input)) {
    return {
      ...input,
      event_version: normalizeVersion(input.event_version),
      event_time: normalizeIso(input.event_time, "event_time"),
      ingest_time: normalizeIso(input.ingest_time || ingestTimeIso, "ingest_time"),
      aggregate_id: input.aggregate_id || input.event_id,
      domain: normalizeDomain(input.domain || deriveAnalyticsDomain(input.event_type, input.payload)),
      model_key: normalizeOptionalString(input.model_key),
      payload: input.payload ?? {}
    };
  }

  if (!isDomainEventEnvelope(input)) {
    throw new Error("Unsupported analytics queue message");
  }

  const payload = input.payload ?? {};
  return {
    event_id: input.event_id,
    tenant_id: input.tenant_id,
    source: normalizeSource(readString(payload, "source") || "command-worker.domain-events"),
    event_type: input.event_type,
    event_version: normalizeVersion(input.aggregate_version),
    event_time: normalizeIso(input.occurred_at, "occurred_at"),
    ingest_time: normalizeIso(ingestTimeIso, "ingest_time"),
    aggregate_id: input.aggregate_id,
    payload,
    domain: normalizeDomain(deriveAnalyticsDomain(input.event_type, payload)),
    model_key: normalizeOptionalString(readString(payload, "model_key") || null)
  };
}

export function normalizeDirectAnalyticsEvent(
  input: Record<string, unknown>,
  ingestTimeIso: string = new Date().toISOString()
): AnalyticsEventEnvelope {
  const eventId = readString(input, "event_id");
  const tenantId = readString(input, "tenant_id");
  const source = normalizeSource(readString(input, "source"));
  const eventType = readString(input, "event_type");
  const eventVersionRaw = input.event_version;
  const eventVersion =
    typeof eventVersionRaw === "number"
      ? normalizeVersion(eventVersionRaw)
      : typeof eventVersionRaw === "string" && eventVersionRaw
        ? normalizeVersion(Number(eventVersionRaw))
        : 1;
  const eventTime = normalizeIso(readString(input, "event_time"), "event_time");
  const ingestTime = normalizeIso(readString(input, "ingest_time") || ingestTimeIso, "ingest_time");
  const payload = isRecord(input.payload) ? input.payload : {};
  const aggregateId = readString(input, "aggregate_id") || eventId;
  const domain = normalizeDomain(readString(input, "domain") || deriveAnalyticsDomain(eventType, payload));
  const modelKey = normalizeOptionalString(readString(input, "model_key") || null);

  if (!eventId || !tenantId || !source || !eventType) {
    throw new Error("analytics events require event_id, tenant_id, source, and event_type");
  }

  return {
    event_id: eventId,
    tenant_id: tenantId,
    source,
    event_type: eventType,
    event_version: eventVersion,
    event_time: eventTime,
    ingest_time: ingestTime,
    aggregate_id: aggregateId,
    payload,
    domain,
    model_key: modelKey
  };
}

export function deriveAnalyticsDomain(eventType: string, payload: Record<string, unknown>): string {
  const explicit = readString(payload, "domain");
  if (explicit) {
    return explicit;
  }

  const commandType = readString(payload, "command_type");
  if (commandType) {
    const parts = commandType.split(".");
    if (parts.length > 1) {
      return parts.slice(0, -1).join("/");
    }
    return commandType;
  }

  const module = readString(payload, "module");
  if (module) {
    return module.replace(/\./g, "/");
  }

  if (eventType.includes(".")) {
    return eventType.split(".").slice(0, -1).join("/");
  }

  const modelKey = readString(payload, "model_key");
  if (modelKey) {
    const normalized = modelKey.replace(/\./g, "/").replace(/\/[^/]+$/, "");
    if (normalized) {
      return normalized;
    }
  }

  const words = eventType
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);
  if (words.length > 1) {
    return words[0] || "core";
  }
  return words[0] || "core";
}

export function bucketStartIso(timestampIso: string, grain: AnalyticsGrain): string {
  const date = new Date(timestampIso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: ${timestampIso}`);
  }

  const utc = new Date(date.toISOString());
  utc.setUTCSeconds(0, 0);
  if (grain === "1m") {
    return utc.toISOString();
  }
  utc.setUTCMinutes(0, 0, 0);
  if (grain === "1h") {
    return utc.toISOString();
  }
  utc.setUTCHours(0, 0, 0, 0);
  return utc.toISOString();
}

export function buildHourShardKey(tenantId: string, eventTimeIso: string): string {
  return `${sanitizeSegment(tenantId)}:${bucketStartIso(eventTimeIso, "1h")}`;
}

export function buildRawShardObjectKey(
  tenantId: string,
  bucketHourIso: string,
  suffix: string
): string {
  const date = new Date(bucketHourIso);
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  return `analytics-raw/${sanitizeSegment(tenantId)}/${yyyy}/${mm}/${dd}/${hh}/${sanitizeSegment(suffix)}.ndjson`;
}

export function domainBucketKey(domain: string): string {
  return normalizeDomain(domain);
}

export function sourceBucketKey(source: string): string {
  return normalizeSource(source);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((valueByte) => valueByte.toString(16).padStart(2, "0"))
    .join("");
}

export function parseRange(
  params: URLSearchParams,
  defaults: { days: number }
): { startIso: string; endIso: string } {
  const now = new Date();
  const end = params.get("end") ? new Date(params.get("end") as string) : now;
  if (Number.isNaN(end.getTime())) {
    throw new Error("Invalid end timestamp");
  }

  const start = params.get("start")
    ? new Date(params.get("start") as string)
    : new Date(end.getTime() - defaults.days * 24 * 60 * 60 * 1000);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid start timestamp");
  }

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

export function normalizeGrain(value: string | null): AnalyticsGrain {
  switch ((value || "1d").toLowerCase()) {
    case "1m":
    case "minute":
    case "minutes":
      return "1m";
    case "1h":
    case "hour":
    case "hours":
      return "1h";
    case "1d":
    case "day":
    case "days":
    default:
      return "1d";
  }
}

export function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "item";
}

export function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeIso(value: string, fieldName: string): string {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName} timestamp`);
  }
  return date.toISOString();
}

function normalizeVersion(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return Math.floor(value);
}

function normalizeDomain(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[.]+/g, "/")
    .replace(/[^a-z0-9/_-]/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");
  return normalized || "core";
}

function normalizeSource(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._/-]/g, "-")
    .replace(/\/+/g, "/");
  return normalized || "unknown";
}

function normalizeOptionalString(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return value;
}

// ============================================================================
// Backfill / Replay utilities
// ============================================================================

export interface BackfillConfig {
  db: D1Database;
  r2: R2Bucket;
  eventsQueue: Queue<AnalyticsEventEnvelope>;
  tenantId?: string;
  prefix?: string;
  batchSize?: number;
}

export interface BackfillResult {
  rebuild_id: string;
  status: "completed" | "failed" | "partial";
  replayed_events: number;
  objects_scanned: number;
  cursor: string | null;
  error: string | null;
}

/**
 * Start a new backfill run. Creates a tracking record in analytics_rebuild_runs,
 * iterates over R2 raw event shards matching the given prefix, parses the ndjson
 * objects, and re-enqueues each event into the analytics queue for reprocessing.
 *
 * Supports resumable replay via the cursor stored in the rebuild run record.
 * Each batch of R2 objects processed updates the cursor, so a crash or timeout
 * can be resumed from where it left off.
 */
export async function runBackfillFromR2(config: BackfillConfig): Promise<BackfillResult> {
  const rebuildId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const batchSize = config.batchSize || 100;

  const prefix = config.prefix || (config.tenantId
    ? `analytics-raw/${sanitizeSegment(config.tenantId)}/`
    : "analytics-raw/");

  await config.db.prepare(
    `INSERT INTO analytics_rebuild_runs (
       rebuild_id, tenant_id, status, source_prefix, cursor,
       replayed_events, requested_at, started_at
     ) VALUES (?, ?, 'running', ?, NULL, 0, ?, ?)`
  )
    .bind(rebuildId, config.tenantId || null, prefix, nowIso, nowIso)
    .run();

  let cursor: string | undefined;
  let totalReplayed = 0;
  let objectsScanned = 0;
  let lastError: string | null = null;

  try {
    while (true) {
      const listResult = await config.r2.list({
        prefix,
        cursor,
        limit: batchSize
      });

      for (const object of listResult.objects) {
        objectsScanned += 1;

        try {
          const r2Object = await config.r2.get(object.key);
          if (!r2Object) {
            continue;
          }

          const body = await r2Object.text();
          const lines = body.split("\n").filter((line) => line.trim().length > 0);

          const events: AnalyticsEventEnvelope[] = [];
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (isRecord(parsed) && typeof parsed.event_id === "string") {
                events.push(normalizeDirectAnalyticsEvent(parsed));
              }
            } catch {
              // skip malformed lines
            }
          }

          if (events.length > 0) {
            const enqueueBatches = chunkArray(events, 100);
            for (const batch of enqueueBatches) {
              await config.eventsQueue.sendBatch(
                batch.map((event) => ({ body: event }))
              );
            }
            totalReplayed += events.length;
          }
        } catch {
          // continue to next object on individual failure
        }
      }

      // Update cursor checkpoint after each R2 list page
      cursor = listResult.truncated ? (listResult.cursor as string) : undefined;

      await config.db.prepare(
        `UPDATE analytics_rebuild_runs
         SET cursor = ?, replayed_events = ?, notes_json = ?
         WHERE rebuild_id = ?`
      )
        .bind(
          cursor || null,
          totalReplayed,
          JSON.stringify({ objects_scanned: objectsScanned, last_checkpoint: new Date().toISOString() }),
          rebuildId
        )
        .run();

      if (!listResult.truncated) {
        break;
      }
    }

    await config.db.prepare(
      `UPDATE analytics_rebuild_runs
       SET status = 'completed', replayed_events = ?, completed_at = ?,
           notes_json = ?
       WHERE rebuild_id = ?`
    )
      .bind(
        totalReplayed,
        new Date().toISOString(),
        JSON.stringify({ objects_scanned: objectsScanned }),
        rebuildId
      )
      .run();
  } catch (error) {
    lastError = (error as Error).message;
    await config.db.prepare(
      `UPDATE analytics_rebuild_runs
       SET status = 'failed', error = ?, replayed_events = ?,
           notes_json = ?
       WHERE rebuild_id = ?`
    )
      .bind(
        lastError,
        totalReplayed,
        JSON.stringify({ objects_scanned: objectsScanned }),
        rebuildId
      )
      .run();
  }

  return {
    rebuild_id: rebuildId,
    status: lastError ? "failed" : "completed",
    replayed_events: totalReplayed,
    objects_scanned: objectsScanned,
    cursor: cursor || null,
    error: lastError
  };
}

/**
 * Resume a previously started backfill run that was interrupted.
 * Reads the cursor from the existing rebuild run record and continues
 * from that position.
 */
export async function resumeBackfillFromR2(
  rebuildId: string,
  config: BackfillConfig
): Promise<BackfillResult> {
  const nowIso = new Date().toISOString();

  const existing = await config.db.prepare(
    `SELECT rebuild_id, tenant_id, source_prefix, cursor, replayed_events, status
     FROM analytics_rebuild_runs WHERE rebuild_id = ?`
  )
    .bind(rebuildId)
    .first<Record<string, unknown>>();

  if (!existing) {
    return {
      rebuild_id: rebuildId,
      status: "failed",
      replayed_events: 0,
      objects_scanned: 0,
      cursor: null,
      error: "Rebuild run not found"
    };
  }

  const savedCursor = typeof existing.cursor === "string" ? existing.cursor : undefined;
  const previousReplayed = Number(existing.replayed_events || 0);
  const prefix = String(existing.source_prefix || "analytics-raw/");
  const batchSize = config.batchSize || 100;

  await config.db.prepare(
    `UPDATE analytics_rebuild_runs SET status = 'running', started_at = ? WHERE rebuild_id = ?`
  )
    .bind(nowIso, rebuildId)
    .run();

  let cursor: string | undefined = savedCursor;
  let totalReplayed = previousReplayed;
  let objectsScanned = 0;
  let lastError: string | null = null;

  try {
    while (true) {
      const listResult = await config.r2.list({
        prefix,
        cursor,
        limit: batchSize
      });

      for (const object of listResult.objects) {
        objectsScanned += 1;

        try {
          const r2Object = await config.r2.get(object.key);
          if (!r2Object) continue;

          const body = await r2Object.text();
          const lines = body.split("\n").filter((line) => line.trim().length > 0);

          const events: AnalyticsEventEnvelope[] = [];
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (isRecord(parsed) && typeof parsed.event_id === "string") {
                events.push(normalizeDirectAnalyticsEvent(parsed));
              }
            } catch {
              // skip
            }
          }

          if (events.length > 0) {
            const enqueueBatches = chunkArray(events, 100);
            for (const batch of enqueueBatches) {
              await config.eventsQueue.sendBatch(
                batch.map((event) => ({ body: event }))
              );
            }
            totalReplayed += events.length;
          }
        } catch {
          // continue
        }
      }

      cursor = listResult.truncated ? (listResult.cursor as string) : undefined;

      await config.db.prepare(
        `UPDATE analytics_rebuild_runs
         SET cursor = ?, replayed_events = ?, notes_json = ?
         WHERE rebuild_id = ?`
      )
        .bind(
          cursor || null,
          totalReplayed,
          JSON.stringify({ objects_scanned: objectsScanned, last_checkpoint: new Date().toISOString() }),
          rebuildId
        )
        .run();

      if (!listResult.truncated) break;
    }

    await config.db.prepare(
      `UPDATE analytics_rebuild_runs
       SET status = 'completed', replayed_events = ?, completed_at = ?,
           notes_json = ?
       WHERE rebuild_id = ?`
    )
      .bind(
        totalReplayed,
        new Date().toISOString(),
        JSON.stringify({ objects_scanned: objectsScanned }),
        rebuildId
      )
      .run();
  } catch (error) {
    lastError = (error as Error).message;
    await config.db.prepare(
      `UPDATE analytics_rebuild_runs
       SET status = 'failed', error = ?, replayed_events = ?,
           notes_json = ?
       WHERE rebuild_id = ?`
    )
      .bind(
        lastError,
        totalReplayed,
        JSON.stringify({ objects_scanned: objectsScanned }),
        rebuildId
      )
      .run();
  }

  return {
    rebuild_id: rebuildId,
    status: lastError ? "failed" : "completed",
    replayed_events: totalReplayed,
    objects_scanned: objectsScanned,
    cursor: cursor || null,
    error: lastError
  };
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
