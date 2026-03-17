import { errorResponse, jsonResponse } from "./shared/http";

interface Env {
  APP_D1_MAIN: D1Database;
  COMMANDS_Q: Queue<Record<string, unknown>>;
  EVENTS_Q: Queue<Record<string, unknown>>;
  PROJECTIONS_Q: Queue<Record<string, unknown>>;
  EXPORTS_Q: Queue<Record<string, unknown>>;
  DLQ_MAX_RETRIES?: string;
}

interface DeadLetterPayload {
  queue: string;
  failed_at: string;
  error: string;
  event?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  shard_key?: string;
  [key: string]: unknown;
}

const RETRYABLE_QUEUES: Record<string, keyof Pick<Env, "COMMANDS_Q" | "EVENTS_Q" | "PROJECTIONS_Q" | "EXPORTS_Q">> = {
  "commands-q": "COMMANDS_Q",
  "events-q": "EVENTS_Q",
  "projections-q": "PROJECTIONS_Q",
  "exports-q": "EXPORTS_Q"
};

export default {
  async queue(batch: MessageBatch<Record<string, unknown>>, env: Env): Promise<void> {
    const maxRetries = parsePositiveInt(env.DLQ_MAX_RETRIES, 3);
    const nowIso = new Date().toISOString();

    for (const message of batch.messages) {
      try {
        const body = message.body as DeadLetterPayload;
        const sourceQueue = body.queue || "unknown";
        const failedAt = body.failed_at || nowIso;
        const errorMessage = body.error || "Unknown error";

        const tenantId = extractTenantId(body);
        const eventType = extractEventType(body);
        const entryId = crypto.randomUUID();

        const payloadToStore = body.event || body.payload || body;

        const existing = await env.APP_D1_MAIN.prepare(
          `SELECT id, retry_count, max_retries, status
           FROM dead_letter_entries
           WHERE source_queue = ? AND tenant_id = ? AND error = ? AND status = 'pending'
           ORDER BY last_failed_at DESC LIMIT 1`
        )
          .bind(sourceQueue, tenantId || "", errorMessage)
          .first<Record<string, unknown>>();

        if (existing && existing.status === "pending") {
          const retryCount = Number(existing.retry_count || 0) + 1;
          const existingMaxRetries = Number(existing.max_retries || maxRetries);

          if (retryCount >= existingMaxRetries) {
            await env.APP_D1_MAIN.prepare(
              `UPDATE dead_letter_entries
               SET retry_count = ?, status = 'exhausted', last_failed_at = ?, updated_at = ?
               WHERE id = ?`
            )
              .bind(retryCount, failedAt, nowIso, existing.id)
              .run();
          } else {
            await env.APP_D1_MAIN.prepare(
              `UPDATE dead_letter_entries
               SET retry_count = ?, last_failed_at = ?, updated_at = ?
               WHERE id = ?`
            )
              .bind(retryCount, failedAt, nowIso, existing.id)
              .run();

            await attemptRetry(sourceQueue, payloadToStore, env);
          }
        } else {
          await env.APP_D1_MAIN.prepare(
            `INSERT INTO dead_letter_entries (
               id, source_queue, tenant_id, event_type, error, payload_json,
               retry_count, max_retries, status, first_failed_at, last_failed_at,
               created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'pending', ?, ?, ?, ?)`
          )
            .bind(
              entryId,
              sourceQueue,
              tenantId,
              eventType,
              errorMessage,
              JSON.stringify(payloadToStore),
              maxRetries,
              failedAt,
              failedAt,
              nowIso,
              nowIso
            )
            .run();

          await attemptRetry(sourceQueue, payloadToStore, env);
        }

        message.ack();
      } catch {
        message.ack();
      }
    }
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await runDlqRetryPass(env);
  },

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === "/healthz") {
      return jsonResponse({ status: "ok", service: "dlq-worker" });
    }

    return errorResponse(404, `Route not found: ${pathname}`);
  }
};

async function runDlqRetryPass(env: Env): Promise<void> {
  const maxRetries = parsePositiveInt(env.DLQ_MAX_RETRIES, 3);
  const nowIso = new Date().toISOString();

  const pendingEntries = await env.APP_D1_MAIN.prepare(
    `SELECT id, source_queue, payload_json, retry_count, max_retries
     FROM dead_letter_entries
     WHERE status = 'pending' AND retry_count < max_retries
     ORDER BY last_failed_at ASC
     LIMIT 50`
  )
    .all<Record<string, unknown>>();

  for (const entry of pendingEntries.results || []) {
    const sourceQueue = String(entry.source_queue || "");
    const payload = safeJsonParse(String(entry.payload_json || "{}"));
    const retryCount = Number(entry.retry_count || 0) + 1;
    const entryMaxRetries = Number(entry.max_retries || maxRetries);

    try {
      await attemptRetry(sourceQueue, payload, env);

      await env.APP_D1_MAIN.prepare(
        `UPDATE dead_letter_entries
         SET retry_count = ?, status = 'retried', last_failed_at = ?, updated_at = ?
         WHERE id = ?`
      )
        .bind(retryCount, nowIso, nowIso, entry.id)
        .run();
    } catch {
      const newStatus = retryCount >= entryMaxRetries ? "exhausted" : "pending";
      await env.APP_D1_MAIN.prepare(
        `UPDATE dead_letter_entries
         SET retry_count = ?, status = ?, last_failed_at = ?, updated_at = ?
         WHERE id = ?`
      )
        .bind(retryCount, newStatus, nowIso, nowIso, entry.id)
        .run();
    }
  }
}

async function attemptRetry(
  sourceQueue: string,
  payload: Record<string, unknown>,
  env: Env
): Promise<void> {
  const binding = RETRYABLE_QUEUES[sourceQueue];
  if (!binding) {
    return;
  }

  const queue = env[binding];
  if (!queue) {
    return;
  }

  await (queue as Queue<Record<string, unknown>>).send(payload);
}

function extractTenantId(body: DeadLetterPayload): string | null {
  if (body.event && typeof body.event === "object") {
    const tid = (body.event as Record<string, unknown>).tenant_id;
    if (typeof tid === "string") return tid;
  }
  if (body.payload && typeof body.payload === "object") {
    const tid = (body.payload as Record<string, unknown>).tenant_id;
    if (typeof tid === "string") return tid;
  }
  if (typeof body.tenant_id === "string") return body.tenant_id;
  return null;
}

function extractEventType(body: DeadLetterPayload): string | null {
  if (body.event && typeof body.event === "object") {
    const et = (body.event as Record<string, unknown>).event_type;
    if (typeof et === "string") return et;
  }
  if (body.payload && typeof body.payload === "object") {
    const et = (body.payload as Record<string, unknown>).event_type;
    if (typeof et === "string") return et;
  }
  if (typeof body.event_type === "string") return body.event_type;
  return null;
}

function safeJsonParse(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
