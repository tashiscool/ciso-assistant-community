import type { WorkerRequestContext } from '../../router';
import type { QueueMessagePayload } from '../../types/env';
import {
  appendDeadLetterEvent,
  inferOriginalQueue,
  queueForOriginalName,
  type QueueDeadLetterRecord,
} from '../../queues/deadLetter';
import { acquireTenantLease, releaseTenantLease } from '../../utils/workflows';

function isIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function validateReplayPayload(
  value: unknown,
  row: QueueDeadLetterRecord,
  tenantId: string,
): QueueMessagePayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Dead-letter payload must be a message object.');
  }
  const body = value as Record<string, unknown>;
  if (!isIdentity(body.tenantId) || row.tenant_id !== tenantId || body.tenantId !== row.tenant_id) {
    throw new Error('Dead-letter payload tenant does not match the authenticated tenant and receipt.');
  }
  if (!isIdentity(body.type) || body.type !== row.message_type) {
    throw new Error('Dead-letter payload type does not match its receipt.');
  }
  if (body.requestedBy !== null && !isIdentity(body.requestedBy)) {
    throw new Error('Dead-letter payload requester identity is invalid.');
  }
  if (body.jobId !== undefined && !isIdentity(body.jobId)) {
    throw new Error('Dead-letter payload job identity is invalid.');
  }
  let validFields = false;
  switch (body.type) {
    case 'evidence.job.run':
      validFields = isIdentity(body.sourceId) && isIdentity(body.jobId);
      break;
    case 'conmon.execution.run':
      validFields = isIdentity(body.profileId) && isIdentity(body.activityId) && isIdentity(body.executionId);
      break;
    case 'grc.content.import':
      validFields = true;
      break;
    case 'grc.scf.refresh':
      validFields = body.frameworkIds === undefined
        || (Array.isArray(body.frameworkIds) && body.frameworkIds.every(isIdentity));
      break;
    case 'grc.finding.ingest':
      validFields = isIdentity(body.payloadId);
      break;
    case 'grc.connector.collect':
      validFields = isIdentity(body.source);
      break;
    case 'grc.gap.report': {
      const kind = body.reportKind;
      const validKind = kind === undefined || (typeof kind === 'string' && ['gap-assessment', 'exec-summary', 'board-brief', 'program-health', 'automation-coverage'].includes(kind));
      const needsAssessment = kind === undefined || kind === 'gap-assessment' || kind === 'exec-summary' || kind === 'board-brief';
      validFields = validKind && (needsAssessment
        ? isIdentity(body.assessmentId)
        : body.assessmentId === undefined || isIdentity(body.assessmentId));
      break;
    }
    case 'grc.evidence.package':
      validFields = isIdentity(body.assessmentId);
      break;
    case 'grc.ai.enrich':
      validFields = isIdentity(body.bundleId);
      break;
    default:
      throw new Error('Dead-letter payload message type is unsupported.');
  }
  if (!validFields) {
    throw new Error('Dead-letter payload message fields are invalid.');
  }
  const originalQueue = inferOriginalQueue(body);
  if (originalQueue === 'unknown' || originalQueue !== row.original_queue) {
    throw new Error('Dead-letter payload queue does not match its receipt.');
  }
  return body as QueueMessagePayload;
}

export async function listQueueDeadLetters(
  ctx: WorkerRequestContext,
): Promise<QueueDeadLetterRecord[]> {
  const status = ctx.url.searchParams.get('status')?.trim() || null;
  const requestedLimit = Number(ctx.url.searchParams.get('limit') ?? 50);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(200, Math.max(1, Math.floor(requestedLimit)))
    : 50;
  const { results } = status
    ? await ctx.env.D1_MAIN.prepare(
        `
        SELECT *
        FROM queue_dead_letters
        WHERE tenant_id = ? AND status = ?
        ORDER BY captured_at DESC
        LIMIT ?
        `,
      )
        .bind(ctx.tenantId, status, limit)
        .all<QueueDeadLetterRecord>()
    : await ctx.env.D1_MAIN.prepare(
        `
        SELECT *
        FROM queue_dead_letters
        WHERE tenant_id = ?
        ORDER BY captured_at DESC
        LIMIT ?
        `,
      )
        .bind(ctx.tenantId, limit)
        .all<QueueDeadLetterRecord>();
  return results;
}

export async function replayQueueDeadLetter(
  ctx: WorkerRequestContext,
  deadLetterId: string,
): Promise<QueueDeadLetterRecord> {
  if (!ctx.tenantId || !ctx.userId) {
    throw new Error('Tenant and user context are required for queue replay.');
  }

  const leaseKey = `queue-dead-letter-replay:${deadLetterId}`;
  const lease = await acquireTenantLease(ctx.env, ctx.tenantId, leaseKey, {
    deadLetterId,
    requestedBy: ctx.userId,
  });
  if (!lease.acquired) {
    throw new Error('This dead-letter message is already being replayed.');
  }

  try {
    const row = await getQueueDeadLetter(ctx, deadLetterId);
    if (!row) throw new Error('Queue dead-letter record not found.');
    if (row.status === 'replayed') throw new Error('Queue dead-letter message was already replayed.');

    const object = await ctx.env.R2_EVIDENCE.get(row.payload_r2_key);
    if (!object) throw new Error('Dead-letter payload is missing from R2.');
    const payloadBytes = await object.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', payloadBytes);
    const payloadSha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    if (!/^[a-f0-9]{64}$/.test(row.payload_sha256) || payloadSha256 !== row.payload_sha256) {
      throw new Error('Dead-letter payload integrity does not match its receipt.');
    }
    let decoded: unknown;
    try { decoded = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(payloadBytes)); }
    catch { throw new Error('Dead-letter payload is not valid UTF-8 JSON.'); }
    const payload = validateReplayPayload(decoded, row, ctx.tenantId);
    const queue = queueForOriginalName(ctx.env, row.original_queue);
    if (!queue) throw new Error('Dead-letter queue binding is unavailable.');

    const now = new Date().toISOString();
    await ctx.env.D1_MAIN.prepare(
      `
      UPDATE queue_dead_letters
      SET status = 'replaying', last_replay_error = NULL
      WHERE id = ? AND tenant_id = ?
      `,
    )
      .bind(deadLetterId, ctx.tenantId)
      .run();
    await appendDeadLetterEvent(ctx.env, {
      deadLetterId,
      tenantId: ctx.tenantId,
      eventType: 'replay_started',
      actorUserId: ctx.userId,
      details: { originalQueue: row.original_queue },
    });

    try {
      await queue.send(payload);
      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE queue_dead_letters
        SET status = 'replayed',
            replay_count = replay_count + 1,
            replayed_at = ?,
            replayed_by_user_id = ?,
            last_replay_error = NULL
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(now, ctx.userId, deadLetterId, ctx.tenantId)
        .run();
      await appendDeadLetterEvent(ctx.env, {
        deadLetterId,
        tenantId: ctx.tenantId,
        eventType: 'replayed',
        actorUserId: ctx.userId,
        details: { originalQueue: row.original_queue, payloadSha256: row.payload_sha256 },
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE queue_dead_letters
        SET status = 'replay_failed', last_replay_error = ?
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(detail.slice(0, 1_000), deadLetterId, ctx.tenantId)
        .run();
      await appendDeadLetterEvent(ctx.env, {
        deadLetterId,
        tenantId: ctx.tenantId,
        eventType: 'replay_failed',
        actorUserId: ctx.userId,
        details: { originalQueue: row.original_queue, error: detail.slice(0, 1_000) },
      });
      throw error;
    }

    const updated = await getQueueDeadLetter(ctx, deadLetterId);
    if (!updated) throw new Error('Replayed queue dead-letter record could not be reloaded.');
    return updated;
  } finally {
    await releaseTenantLease(ctx.env, ctx.tenantId, leaseKey).catch((error) => {
      console.warn('Failed to release queue dead-letter replay lease', error);
    });
  }
}

async function getQueueDeadLetter(
  ctx: WorkerRequestContext,
  deadLetterId: string,
): Promise<QueueDeadLetterRecord | null> {
  return ctx.env.D1_MAIN.prepare(
    `
    SELECT *
    FROM queue_dead_letters
    WHERE id = ? AND tenant_id = ?
    LIMIT 1
    `,
  )
    .bind(deadLetterId, ctx.tenantId)
    .first<QueueDeadLetterRecord>();
}
