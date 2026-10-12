import type { EnvBindings, QueueMessagePayload } from '../types/env';

export const DEAD_LETTER_QUEUE = 'ciso-assistant-dlq';

export type QueueDeadLetterRecord = {
  id: string;
  tenant_id: string;
  original_queue: string;
  dead_letter_queue: string;
  message_type: string;
  message_id: string;
  attempts: number;
  payload_r2_key: string;
  payload_sha256: string;
  status: 'pending' | 'replaying' | 'replayed' | 'replay_failed';
  replay_count: number;
  last_replay_error: string | null;
  captured_at: string;
  replayed_at: string | null;
  replayed_by_user_id: string | null;
};

export function inferOriginalQueue(payload: unknown): string {
  const body = asRecord(payload);
  const type = typeof body.type === 'string' ? body.type : '';
  switch (type) {
    case 'evidence.job.run':
      return 'ciso-assistant-evidence-jobs';
    case 'conmon.execution.run':
      return 'ciso-assistant-conmon-jobs';
    case 'grc.content.import':
      return 'ciso-assistant-grc-content-import';
    case 'grc.scf.refresh':
      return 'ciso-assistant-grc-scf-refresh';
    case 'grc.finding.ingest':
    case 'grc.connector.collect':
      return 'ciso-assistant-grc-finding-ingest';
    case 'grc.gap.report':
      return body.reportKind && body.reportKind !== 'gap-assessment'
        ? 'ciso-assistant-grc-content-import'
        : 'ciso-assistant-grc-gap-report';
    case 'grc.evidence.package':
      return 'ciso-assistant-grc-gap-report';
    case 'grc.ai.enrich':
      return 'ciso-assistant-grc-ai-enrich';
    default:
      return 'unknown';
  }
}

export async function consumeDeadLetterQueue(
  batch: MessageBatch<QueueMessagePayload>,
  env: EnvBindings,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const body = asRecord(message.body);
      const tenantId = requiredString(body.tenantId, 'tenantId');
      const messageType = requiredString(body.type, 'type');
      const originalQueue = inferOriginalQueue(body);
      const capturedAt = new Date().toISOString();
      const id = `qdl_${await sha256(`${message.id}:${tenantId}:${messageType}`)}`;
      const payload = JSON.stringify(message.body);
      const payloadSha256 = await sha256(payload);
      const r2Key = `queue-dead-letters/${safeSegment(tenantId)}/${capturedAt.slice(0, 10)}/${id}.json`;

      await env.R2_EVIDENCE.put(r2Key, payload, {
        httpMetadata: { contentType: 'application/json' },
        customMetadata: {
          tenantId,
          messageType,
          originalQueue,
          payloadSha256,
        },
      });
      await env.D1_MAIN.prepare(
        `
        INSERT OR IGNORE INTO queue_dead_letters (
          id, tenant_id, original_queue, dead_letter_queue, message_type,
          message_id, attempts, payload_r2_key, payload_sha256, status, captured_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        `,
      )
        .bind(
          id,
          tenantId,
          originalQueue,
          batch.queue,
          messageType,
          message.id,
          message.attempts,
          r2Key,
          payloadSha256,
          capturedAt,
        )
        .run();
      await appendDeadLetterEvent(env, {
        deadLetterId: id,
        tenantId,
        eventType: 'captured',
        actorUserId: null,
        details: { originalQueue, messageType, messageId: message.id, attempts: message.attempts },
      });
      message.ack();
    } catch (error) {
      console.error('Failed to persist queue dead-letter evidence', {
        queue: batch.queue,
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
      message.retry();
    }
  }
}

export function queueForOriginalName(
  env: EnvBindings,
  queueName: string,
): Queue<QueueMessagePayload> | null {
  switch (queueName) {
    case 'ciso-assistant-evidence-jobs':
      return env.QUEUE_EVIDENCE_JOBS as Queue<QueueMessagePayload>;
    case 'ciso-assistant-conmon-jobs':
      return env.QUEUE_CONMON_JOBS as Queue<QueueMessagePayload>;
    case 'ciso-assistant-grc-content-import':
      return (env.QUEUE_GRC_CONTENT_IMPORT as Queue<QueueMessagePayload> | undefined) ?? null;
    case 'ciso-assistant-grc-scf-refresh':
      return (env.QUEUE_GRC_SCF_REFRESH as Queue<QueueMessagePayload> | undefined) ?? null;
    case 'ciso-assistant-grc-finding-ingest':
      return (env.QUEUE_GRC_FINDING_INGEST as Queue<QueueMessagePayload> | undefined) ?? null;
    case 'ciso-assistant-grc-gap-report':
      return (env.QUEUE_GRC_GAP_REPORT as Queue<QueueMessagePayload> | undefined) ?? null;
    case 'ciso-assistant-grc-ai-enrich':
      return (env.QUEUE_GRC_AI_ENRICH as Queue<QueueMessagePayload> | undefined) ?? null;
    default:
      return null;
  }
}

export async function appendDeadLetterEvent(
  env: EnvBindings,
  input: {
    deadLetterId: string;
    tenantId: string;
    eventType: 'captured' | 'replay_started' | 'replayed' | 'replay_failed';
    actorUserId: string | null;
    details: Record<string, unknown>;
  },
): Promise<void> {
  await env.D1_MAIN.prepare(
    `
    INSERT INTO queue_dead_letter_events (
      id, dead_letter_id, tenant_id, event_type, actor_user_id, details_json, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      crypto.randomUUID(),
      input.deadLetterId,
      input.tenantId,
      input.eventType,
      input.actorUserId,
      JSON.stringify(input.details),
      new Date().toISOString(),
    )
    .run();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Dead-letter payload is missing ${field}.`);
  }
  return value.trim();
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160) || 'unknown';
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
