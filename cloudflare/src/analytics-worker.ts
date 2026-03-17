import {
  type AnalyticsEventEnvelope,
  type AnalyticsQueueMessage,
  buildHourShardKey,
  buildRawShardObjectKey,
  bucketStartIso,
  domainBucketKey,
  isRecord,
  normalizeAnalyticsEvent,
  readString,
  sha256Hex,
  sourceBucketKey
} from "./shared/analytics";
import { errorResponse, jsonResponse, parseJson } from "./shared/http";

interface Env {
  APP_D1_MAIN: D1Database;
  CISO_ANALYTICS_R2: R2Bucket;
  ANALYTICS_AGGREGATOR: DurableObjectNamespace;
  DEAD_LETTER_Q: Queue<Record<string, unknown>>;
  HOT_RETENTION_DAYS?: string;
  WARM_RETENTION_DAYS?: string;
  COLD_RETENTION_DAYS?: string;
}

interface PendingMessage {
  message: Message<AnalyticsQueueMessage>;
  event: AnalyticsEventEnvelope;
  shardKey: string;
  bucketHourStart: string;
}

interface AggregatorIngestRequest {
  events: AnalyticsEventEnvelope[];
  shard_key: string;
  bucket_hour_start: string;
}

interface AggregatorIngestResponse {
  shard_key: string;
  bucket_hour_start: string;
  object_key: string;
  event_count: number;
  payload_hash: string;
  flush_count: number;
  first_event_time: string;
  last_event_time: string;
}

interface DurableObjectShardStats {
  flush_count: number;
  events_written: number;
  last_object_key: string | null;
  last_flush_at: string | null;
}

interface VolumeRollupEntry {
  bucketStart: string;
  eventType: string;
  totalEvents: number;
  lastEventTime: string;
}

interface DomainRollupEntry {
  bucketStart: string;
  domain: string;
  totalEvents: number;
  lastEventTime: string;
}

interface SourceRollupEntry {
  bucketStart: string;
  source: string;
  totalEvents: number;
  errorEvents: number;
  lastEventTime: string;
}

interface ModelRollupEntry {
  bucketStart: string;
  modelKey: string;
  totalEvents: number;
  lastEventTime: string;
}

export default {
  async queue(batch: MessageBatch<AnalyticsQueueMessage>, env: Env): Promise<void> {
    const grouped = new Map<string, PendingMessage[]>();

    for (const message of batch.messages) {
      try {
        const event = normalizeAnalyticsEvent(message.body, new Date().toISOString());
        const claimed = await claimAnalyticsEvent(event, env);
        if (!claimed) {
          message.ack();
          continue;
        }

        const bucketHourStart = bucketStartIso(event.event_time, "1h");
        const shardKey = buildHourShardKey(event.tenant_id, event.event_time);
        const pending: PendingMessage = {
          message,
          event,
          shardKey,
          bucketHourStart
        };
        const existing = grouped.get(shardKey);
        if (existing) {
          existing.push(pending);
        } else {
          grouped.set(shardKey, [pending]);
        }
      } catch (error) {
        await sendToDeadLetter(env, {
          queue: "events-q",
          failed_at: new Date().toISOString(),
          error: (error as Error).message,
          payload: message.body
        });
        message.ack();
      }
    }

    for (const entries of grouped.values()) {
      try {
        const response = await sendShardToAggregator(entries, env);
        await markAnalyticsEventsProjected(entries, response.object_key, env);
        await updateAnalyticsCheckpoints(entries, response, env);
        for (const entry of entries) {
          entry.message.ack();
        }
      } catch (error) {
        for (const entry of entries) {
          await sendToDeadLetter(env, {
            queue: "events-q",
            failed_at: new Date().toISOString(),
            error: (error as Error).message,
            event: entry.event,
            shard_key: entry.shardKey
          });
          entry.message.ack();
        }
      }
    }
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await runRetentionTasks(env);
  },

  async fetch(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/healthz") {
      return jsonResponse({ status: "ok", service: "analytics-worker" });
    }
    return errorResponse(404, `Route not found: ${pathname}`);
  }
};

export class AnalyticsAggregateDurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env
  ) {}

  async fetch(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (request.method === "POST" && pathname === "/ingest") {
      return this.handleIngest(request);
    }
    if (request.method === "GET" && pathname === "/healthz") {
      return jsonResponse({ status: "ok", durable_object: "analytics-aggregate" });
    }
    return errorResponse(404, `Route not found: ${pathname}`);
  }

  private async handleIngest(request: Request): Promise<Response> {
    const payload = await parseJson<AggregatorIngestRequest>(request);
    const events = Array.isArray(payload.events) ? payload.events.map((entry) => normalizeAnalyticsEvent(entry)) : [];
    if (events.length === 0) {
      return errorResponse(400, "events array is required");
    }

    const shardKey = payload.shard_key || buildHourShardKey(events[0].tenant_id, events[0].event_time);
    const bucketHourStart = payload.bucket_hour_start || bucketStartIso(events[0].event_time, "1h");
    const tenantId = events[0].tenant_id;

    for (const event of events) {
      if (event.tenant_id !== tenantId) {
        return errorResponse(400, "all events in an analytics shard must belong to the same tenant");
      }
      if (bucketStartIso(event.event_time, "1h") !== bucketHourStart) {
        return errorResponse(400, "all events in an analytics shard must belong to the same hour bucket");
      }
    }

    const rawBody = `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
    const nowIso = new Date().toISOString();
    const objectKey = buildRawShardObjectKey(tenantId, bucketHourStart, `${Date.now()}-${crypto.randomUUID()}`);
    const payloadHash = await sha256Hex(rawBody);

    await this.env.CISO_ANALYTICS_R2.put(objectKey, rawBody, {
      httpMetadata: { contentType: "application/x-ndjson" },
      customMetadata: {
        tenant_id: tenantId,
        shard_key: shardKey,
        bucket_hour_start: bucketHourStart
      }
    });

    const volume1m = aggregateVolume(events, "1m");
    const volume1h = aggregateVolume(events, "1h");
    const volume1d = aggregateVolume(events, "1d");
    const domains1h = aggregateDomains(events, "1h");
    const domains1d = aggregateDomains(events, "1d");
    const sources1h = aggregateSources(events, "1h");
    const sources1d = aggregateSources(events, "1d");
    const models1h = aggregateModels(events, "1h");
    const models1d = aggregateModels(events, "1d");
    const firstEventTime = events.reduce((current, event) => (event.event_time < current ? event.event_time : current), events[0].event_time);
    const lastEventTime = events.reduce((current, event) => (event.event_time > current ? event.event_time : current), events[0].event_time);

    const shardStats = ((await this.state.storage.get<DurableObjectShardStats>("stats")) || {
      flush_count: 0,
      events_written: 0,
      last_object_key: null,
      last_flush_at: null
    }) as DurableObjectShardStats;
    shardStats.flush_count += 1;
    shardStats.events_written += events.length;
    shardStats.last_object_key = objectKey;
    shardStats.last_flush_at = nowIso;
    await this.state.storage.put("stats", shardStats);

    const statements: D1PreparedStatement[] = [
      this.env.APP_D1_MAIN.prepare(
        `INSERT INTO analytics_raw_shards (
           tenant_id, object_key, shard_key, bucket_hour_start,
           event_count, first_event_time, last_event_time, payload_hash,
           size_bytes, flush_count, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        tenantId,
        objectKey,
        shardKey,
        bucketHourStart,
        events.length,
        firstEventTime,
        lastEventTime,
        payloadHash,
        rawBody.length,
        shardStats.flush_count,
        nowIso,
        nowIso
      )
    ];

    pushVolumeStatements(statements, this.env.APP_D1_MAIN, "analytics_rollup_1m_event_volume", tenantId, volume1m, nowIso);
    pushVolumeStatements(statements, this.env.APP_D1_MAIN, "analytics_rollup_1h_event_volume", tenantId, volume1h, nowIso);
    pushVolumeStatements(statements, this.env.APP_D1_MAIN, "analytics_rollup_1d_event_volume", tenantId, volume1d, nowIso);
    pushDomainStatements(statements, this.env.APP_D1_MAIN, "analytics_rollup_1h_domain_activity", tenantId, domains1h, nowIso);
    pushDomainStatements(statements, this.env.APP_D1_MAIN, "analytics_rollup_1d_domain_activity", tenantId, domains1d, nowIso);
    pushSourceStatements(statements, this.env.APP_D1_MAIN, "analytics_rollup_1h_source_health", tenantId, sources1h, nowIso);
    pushSourceStatements(statements, this.env.APP_D1_MAIN, "analytics_rollup_1d_source_health", tenantId, sources1d, nowIso);
    pushModelStatements(statements, this.env.APP_D1_MAIN, "analytics_rollup_1h_model_activity", tenantId, models1h, nowIso);
    pushModelStatements(statements, this.env.APP_D1_MAIN, "analytics_rollup_1d_model_activity", tenantId, models1d, nowIso);

    await this.env.APP_D1_MAIN.batch(statements);

    return jsonResponse({
      shard_key: shardKey,
      bucket_hour_start: bucketHourStart,
      object_key: objectKey,
      event_count: events.length,
      payload_hash: payloadHash,
      flush_count: shardStats.flush_count,
      first_event_time: firstEventTime,
      last_event_time: lastEventTime
    } satisfies AggregatorIngestResponse);
  }
}

async function claimAnalyticsEvent(event: AnalyticsEventEnvelope, env: Env): Promise<boolean> {
  const payloadHash = await sha256Hex(JSON.stringify(event.payload ?? {}));
  const result = await env.APP_D1_MAIN.prepare(
    `INSERT OR IGNORE INTO analytics_event_dedupe (
       tenant_id, event_id, event_type, source, domain, model_key,
       aggregate_id, event_version, event_time, ingest_time,
       payload_hash, raw_object_key, projected_at, processed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`
  )
    .bind(
      event.tenant_id,
      event.event_id,
      event.event_type,
      event.source,
      event.domain,
      event.model_key,
      event.aggregate_id,
      event.event_version,
      event.event_time,
      event.ingest_time,
      payloadHash,
      new Date().toISOString()
    )
    .run();

  return Number(result.meta.changes || 0) > 0;
}

async function sendShardToAggregator(entries: PendingMessage[], env: Env): Promise<AggregatorIngestResponse> {
  const first = entries[0];
  const stub = env.ANALYTICS_AGGREGATOR.get(env.ANALYTICS_AGGREGATOR.idFromName(first.shardKey));
  const response = await stub.fetch("https://analytics.internal/ingest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      shard_key: first.shardKey,
      bucket_hour_start: first.bucketHourStart,
      events: entries.map((entry) => entry.event)
    } satisfies AggregatorIngestRequest)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`analytics aggregator failed (${response.status}): ${details}`);
  }

  const payload = (await response.json()) as AggregatorIngestResponse;
  if (!payload.object_key) {
    throw new Error("analytics aggregator response missing object_key");
  }
  return payload;
}

async function markAnalyticsEventsProjected(
  entries: PendingMessage[],
  objectKey: string,
  env: Env
): Promise<void> {
  const nowIso = new Date().toISOString();
  const statements = entries.map((entry) =>
    env.APP_D1_MAIN.prepare(
      `UPDATE analytics_event_dedupe
       SET raw_object_key = ?, projected_at = ?
       WHERE tenant_id = ? AND event_id = ?`
    ).bind(objectKey, nowIso, entry.event.tenant_id, entry.event.event_id)
  );
  if (statements.length > 0) {
    await env.APP_D1_MAIN.batch(statements);
  }
}

async function updateAnalyticsCheckpoints(
  entries: PendingMessage[],
  response: AggregatorIngestResponse,
  env: Env
): Promise<void> {
  const sorted = [...entries].sort((left, right) => left.event.event_time.localeCompare(right.event.event_time));
  const latest = sorted[sorted.length - 1]?.event;
  if (!latest) {
    return;
  }

  const nowIso = new Date().toISOString();
  const statsJson = JSON.stringify({
    shard_key: response.shard_key,
    bucket_hour_start: response.bucket_hour_start,
    event_count: response.event_count,
    payload_hash: response.payload_hash
  });

  const statements: D1PreparedStatement[] = [
    env.APP_D1_MAIN.prepare(
      `INSERT INTO analytics_checkpoints (
         checkpoint_key, tenant_id, last_event_id, last_event_time, last_ingest_time,
         last_raw_object_key, stats_json, updated_at
       ) VALUES ('events-q:global', NULL, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(checkpoint_key)
       DO UPDATE SET
         last_event_id = excluded.last_event_id,
         last_event_time = excluded.last_event_time,
         last_ingest_time = excluded.last_ingest_time,
         last_raw_object_key = excluded.last_raw_object_key,
         stats_json = excluded.stats_json,
         updated_at = excluded.updated_at`
    ).bind(
      latest.event_id,
      latest.event_time,
      latest.ingest_time,
      response.object_key,
      statsJson,
      nowIso
    ),
    env.APP_D1_MAIN.prepare(
      `INSERT INTO analytics_checkpoints (
         checkpoint_key, tenant_id, last_event_id, last_event_time, last_ingest_time,
         last_raw_object_key, stats_json, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(checkpoint_key)
       DO UPDATE SET
         last_event_id = excluded.last_event_id,
         last_event_time = excluded.last_event_time,
         last_ingest_time = excluded.last_ingest_time,
         last_raw_object_key = excluded.last_raw_object_key,
         stats_json = excluded.stats_json,
         updated_at = excluded.updated_at`
    ).bind(
      `events-q:tenant:${latest.tenant_id}`,
      latest.tenant_id,
      latest.event_id,
      latest.event_time,
      latest.ingest_time,
      response.object_key,
      statsJson,
      nowIso
    )
  ];

  await env.APP_D1_MAIN.batch(statements);
}

async function runRetentionTasks(env: Env): Promise<void> {
  const hotDays = parsePositiveInt(env.HOT_RETENTION_DAYS, 30);
  const warmDays = parsePositiveInt(env.WARM_RETENTION_DAYS, 180);
  const coldDays = parsePositiveInt(env.COLD_RETENTION_DAYS, 730);
  const now = new Date();
  const hotCutoff = daysAgoIso(now, hotDays);
  const warmCutoff = daysAgoIso(now, warmDays);
  const coldCutoff = daysAgoIso(now, coldDays);
  const runAt = now.toISOString();

  await env.APP_D1_MAIN.batch([
    env.APP_D1_MAIN.prepare(`DELETE FROM analytics_event_dedupe WHERE event_time < ?`).bind(hotCutoff),
    env.APP_D1_MAIN.prepare(`DELETE FROM analytics_rollup_1m_event_volume WHERE bucket_start < ?`).bind(hotCutoff),
    env.APP_D1_MAIN.prepare(`DELETE FROM analytics_rollup_1h_event_volume WHERE bucket_start < ?`).bind(warmCutoff),
    env.APP_D1_MAIN.prepare(`DELETE FROM analytics_rollup_1h_domain_activity WHERE bucket_start < ?`).bind(warmCutoff),
    env.APP_D1_MAIN.prepare(`DELETE FROM analytics_rollup_1h_source_health WHERE bucket_start < ?`).bind(warmCutoff),
    env.APP_D1_MAIN.prepare(`DELETE FROM analytics_rollup_1h_model_activity WHERE bucket_start < ?`).bind(warmCutoff),
    env.APP_D1_MAIN.prepare(`DELETE FROM analytics_rollup_1d_event_volume WHERE bucket_start < ?`).bind(coldCutoff),
    env.APP_D1_MAIN.prepare(`DELETE FROM analytics_rollup_1d_domain_activity WHERE bucket_start < ?`).bind(coldCutoff),
    env.APP_D1_MAIN.prepare(`DELETE FROM analytics_rollup_1d_source_health WHERE bucket_start < ?`).bind(coldCutoff),
    env.APP_D1_MAIN.prepare(`DELETE FROM analytics_rollup_1d_model_activity WHERE bucket_start < ?`).bind(coldCutoff),
    env.APP_D1_MAIN.prepare(`DELETE FROM analytics_raw_shards WHERE bucket_hour_start < ?`).bind(coldCutoff),
    env.APP_D1_MAIN.prepare(`DELETE FROM dead_letter_entries WHERE status = 'resolved' AND resolved_at < ?`).bind(warmCutoff),
    env.APP_D1_MAIN.prepare(
      `INSERT INTO analytics_checkpoints (
         checkpoint_key, tenant_id, last_event_id, last_event_time, last_ingest_time,
         last_raw_object_key, stats_json, updated_at
       ) VALUES ('retention:analytics', NULL, NULL, NULL, NULL, NULL, ?, ?)
       ON CONFLICT(checkpoint_key)
       DO UPDATE SET stats_json = excluded.stats_json, updated_at = excluded.updated_at`
    ).bind(
      JSON.stringify({ hot_days: hotDays, warm_days: warmDays, cold_days: coldDays, executed_at: runAt }),
      runAt
    )
  ]);
}

function aggregateVolume(events: AnalyticsEventEnvelope[], grain: "1m" | "1h" | "1d"): VolumeRollupEntry[] {
  const rollups = new Map<string, VolumeRollupEntry>();
  for (const event of events) {
    const bucketStart = bucketStartIso(event.event_time, grain);
    const key = `${bucketStart}::${event.event_type}`;
    const current = rollups.get(key);
    if (current) {
      current.totalEvents += 1;
      if (event.event_time > current.lastEventTime) {
        current.lastEventTime = event.event_time;
      }
      continue;
    }
    rollups.set(key, {
      bucketStart,
      eventType: event.event_type,
      totalEvents: 1,
      lastEventTime: event.event_time
    });
  }
  return Array.from(rollups.values());
}

function aggregateDomains(events: AnalyticsEventEnvelope[], grain: "1h" | "1d" = "1d"): DomainRollupEntry[] {
  const rollups = new Map<string, DomainRollupEntry>();
  for (const event of events) {
    const bucketStart = bucketStartIso(event.event_time, grain);
    const domain = domainBucketKey(event.domain);
    const key = `${bucketStart}::${domain}`;
    const current = rollups.get(key);
    if (current) {
      current.totalEvents += 1;
      if (event.event_time > current.lastEventTime) {
        current.lastEventTime = event.event_time;
      }
      continue;
    }
    rollups.set(key, {
      bucketStart,
      domain,
      totalEvents: 1,
      lastEventTime: event.event_time
    });
  }
  return Array.from(rollups.values());
}

function aggregateSources(events: AnalyticsEventEnvelope[], grain: "1h" | "1d" = "1d"): SourceRollupEntry[] {
  const rollups = new Map<string, SourceRollupEntry>();
  for (const event of events) {
    const bucketStart = bucketStartIso(event.event_time, grain);
    const source = sourceBucketKey(event.source);
    const key = `${bucketStart}::${source}`;
    const current = rollups.get(key);
    if (current) {
      current.totalEvents += 1;
      current.errorEvents += isErrorEvent(event) ? 1 : 0;
      if (event.event_time > current.lastEventTime) {
        current.lastEventTime = event.event_time;
      }
      continue;
    }
    rollups.set(key, {
      bucketStart,
      source,
      totalEvents: 1,
      errorEvents: isErrorEvent(event) ? 1 : 0,
      lastEventTime: event.event_time
    });
  }
  return Array.from(rollups.values());
}

function aggregateModels(events: AnalyticsEventEnvelope[], grain: "1h" | "1d" = "1d"): ModelRollupEntry[] {
  const rollups = new Map<string, ModelRollupEntry>();
  for (const event of events) {
    if (!event.model_key) {
      continue;
    }
    const bucketStart = bucketStartIso(event.event_time, grain);
    const key = `${bucketStart}::${event.model_key}`;
    const current = rollups.get(key);
    if (current) {
      current.totalEvents += 1;
      if (event.event_time > current.lastEventTime) {
        current.lastEventTime = event.event_time;
      }
      continue;
    }
    rollups.set(key, {
      bucketStart,
      modelKey: event.model_key,
      totalEvents: 1,
      lastEventTime: event.event_time
    });
  }
  return Array.from(rollups.values());
}

function pushVolumeStatements(
  statements: D1PreparedStatement[],
  db: D1Database,
  tableName: "analytics_rollup_1m_event_volume" | "analytics_rollup_1h_event_volume" | "analytics_rollup_1d_event_volume",
  tenantId: string,
  entries: VolumeRollupEntry[],
  nowIso: string
): void {
  for (const entry of entries) {
    statements.push(
      db.prepare(
        `INSERT INTO ${tableName} (
           tenant_id, bucket_start, event_type, total_events, last_event_time, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, bucket_start, event_type)
         DO UPDATE SET
           total_events = ${tableName}.total_events + excluded.total_events,
           last_event_time = CASE
             WHEN ${tableName}.last_event_time IS NULL THEN excluded.last_event_time
             WHEN excluded.last_event_time > ${tableName}.last_event_time THEN excluded.last_event_time
             ELSE ${tableName}.last_event_time
           END,
           updated_at = excluded.updated_at`
      ).bind(tenantId, entry.bucketStart, entry.eventType, entry.totalEvents, entry.lastEventTime, nowIso)
    );
  }
}

function pushDomainStatements(
  statements: D1PreparedStatement[],
  db: D1Database,
  tableName: "analytics_rollup_1h_domain_activity" | "analytics_rollup_1d_domain_activity",
  tenantId: string,
  entries: DomainRollupEntry[],
  nowIso: string
): void {
  for (const entry of entries) {
    statements.push(
      db.prepare(
        `INSERT INTO ${tableName} (
           tenant_id, bucket_start, domain, total_events, last_event_time, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, bucket_start, domain)
         DO UPDATE SET
           total_events = ${tableName}.total_events + excluded.total_events,
           last_event_time = CASE
             WHEN ${tableName}.last_event_time IS NULL THEN excluded.last_event_time
             WHEN excluded.last_event_time > ${tableName}.last_event_time THEN excluded.last_event_time
             ELSE ${tableName}.last_event_time
           END,
           updated_at = excluded.updated_at`
      ).bind(tenantId, entry.bucketStart, entry.domain, entry.totalEvents, entry.lastEventTime, nowIso)
    );
  }
}

function pushSourceStatements(
  statements: D1PreparedStatement[],
  db: D1Database,
  tableName: "analytics_rollup_1h_source_health" | "analytics_rollup_1d_source_health",
  tenantId: string,
  entries: SourceRollupEntry[],
  nowIso: string
): void {
  for (const entry of entries) {
    statements.push(
      db.prepare(
        `INSERT INTO ${tableName} (
           tenant_id, bucket_start, source, total_events, error_events, last_event_time, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, bucket_start, source)
         DO UPDATE SET
           total_events = ${tableName}.total_events + excluded.total_events,
           error_events = ${tableName}.error_events + excluded.error_events,
           last_event_time = CASE
             WHEN ${tableName}.last_event_time IS NULL THEN excluded.last_event_time
             WHEN excluded.last_event_time > ${tableName}.last_event_time THEN excluded.last_event_time
             ELSE ${tableName}.last_event_time
           END,
           updated_at = excluded.updated_at`
      ).bind(
        tenantId,
        entry.bucketStart,
        entry.source,
        entry.totalEvents,
        entry.errorEvents,
        entry.lastEventTime,
        nowIso
      )
    );
  }
}

function pushModelStatements(
  statements: D1PreparedStatement[],
  db: D1Database,
  tableName: "analytics_rollup_1h_model_activity" | "analytics_rollup_1d_model_activity",
  tenantId: string,
  entries: ModelRollupEntry[],
  nowIso: string
): void {
  for (const entry of entries) {
    statements.push(
      db.prepare(
        `INSERT INTO ${tableName} (
           tenant_id, bucket_start, model_key, total_events, last_event_time, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, bucket_start, model_key)
         DO UPDATE SET
           total_events = ${tableName}.total_events + excluded.total_events,
           last_event_time = CASE
             WHEN ${tableName}.last_event_time IS NULL THEN excluded.last_event_time
             WHEN excluded.last_event_time > ${tableName}.last_event_time THEN excluded.last_event_time
             ELSE ${tableName}.last_event_time
           END,
           updated_at = excluded.updated_at`
      ).bind(tenantId, entry.bucketStart, entry.modelKey, entry.totalEvents, entry.lastEventTime, nowIso)
    );
  }
}

function isErrorEvent(event: AnalyticsEventEnvelope): boolean {
  const status = readString(event.payload, "status").toLowerCase();
  const severity = readString(event.payload, "severity").toLowerCase();
  const eventType = event.event_type.toLowerCase();
  return (
    status === "failed" ||
    status === "error" ||
    status === "denied" ||
    severity === "critical" ||
    severity === "high" ||
    eventType.includes("failed") ||
    eventType.includes("error") ||
    eventType.includes("denied")
  );
}

async function sendToDeadLetter(env: Env, payload: Record<string, unknown>): Promise<void> {
  await env.DEAD_LETTER_Q.send(payload);
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function daysAgoIso(now: Date, days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}
