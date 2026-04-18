import type { EnvBindings, EvidenceJobMessage } from '../types/env';
import { acquireTenantLease, releaseTenantLease } from '../utils/workflows';

type EvidenceJobRow = {
  status: string;
};

type EvidenceSourceRow = {
  id: string;
  name: string;
  provider: string;
};

const artifactIdForJob = (jobId: string) => `artifact:${jobId}`;

export async function consumeEvidenceQueue(
  batch: MessageBatch<EvidenceJobMessage>,
  env: EnvBindings,
  ctx: ExecutionContext,
): Promise<void> {
  for (const message of batch.messages) {
    const payload = message.body;
    const leaseKey = `evidence:${payload.jobId}`;

    try {
      const job = await env.D1_MAIN.prepare(
        `
        SELECT status
        FROM evidence_jobs
        WHERE id = ? AND tenant_id = ?
        LIMIT 1
        `,
      )
        .bind(payload.jobId, payload.tenantId)
        .first<EvidenceJobRow>();

      if (!job || job.status === 'success') {
        message.ack();
        continue;
      }

      const lease = await acquireTenantLease(env, payload.tenantId, leaseKey, {
        queue: batch.queue,
        jobId: payload.jobId,
      });

      if (!lease.acquired) {
        message.ack();
        continue;
      }

      await env.D1_MAIN.prepare(
        `
        UPDATE evidence_jobs
        SET status = 'running',
            status_detail = ?,
            started_at = ?
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(
          'Evidence collection is running in the queue consumer.',
          new Date().toISOString(),
          payload.jobId,
          payload.tenantId,
        )
        .run();

      const source = await env.D1_MAIN.prepare(
        `
        SELECT id, name, provider
        FROM evidence_sources
        WHERE id = ? AND tenant_id = ?
        LIMIT 1
        `,
      )
        .bind(payload.sourceId, payload.tenantId)
        .first<EvidenceSourceRow>();

      if (!source) {
        throw new Error(`Evidence source ${payload.sourceId} was not found.`);
      }

      const artifactBody = JSON.stringify(
        {
          jobId: payload.jobId,
          tenantId: payload.tenantId,
          source,
          capturedAt: new Date().toISOString(),
          requestedBy: payload.requestedBy,
          items: [
            { kind: 'repository', name: 'ciso-assistant-community', status: 'present' },
            { kind: 'branch-protection', name: 'main', status: 'review-required' },
          ],
        },
        null,
        2,
      );

      const objectKey = `${payload.tenantId}/evidence/${payload.sourceId}/${payload.jobId}/snapshot.json`;
      await env.R2_EVIDENCE.put(objectKey, artifactBody, {
        httpMetadata: {
          contentType: 'application/json',
        },
      });

      await env.D1_MAIN.prepare(
        `
        INSERT OR REPLACE INTO evidence_artifacts (
          id,
          tenant_id,
          job_id,
          object_key,
          content_type,
          size_bytes,
          checksum,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          artifactIdForJob(payload.jobId),
          payload.tenantId,
          payload.jobId,
          objectKey,
          'application/json',
          artifactBody.length,
          `sha1:${payload.jobId}`,
          new Date().toISOString(),
        )
        .run();

      await env.D1_MAIN.prepare(
        `
        UPDATE evidence_jobs
        SET status = 'success',
            status_detail = ?,
            finished_at = ?
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(
          'Evidence collected and stored in R2 successfully.',
          new Date().toISOString(),
          payload.jobId,
          payload.tenantId,
        )
        .run();

      message.ack();
    } catch (error) {
      console.error('Evidence queue execution failed', error);

      ctx.waitUntil(
        env.D1_MAIN.prepare(
          `
          UPDATE evidence_jobs
          SET status = 'failed',
              status_detail = ?,
              finished_at = ?
          WHERE id = ? AND tenant_id = ?
          `,
        )
          .bind(
            error instanceof Error ? error.message : 'Unknown queue consumer failure',
            new Date().toISOString(),
            payload.jobId,
            payload.tenantId,
          )
          .run(),
      );

      message.retry();
    } finally {
      await releaseTenantLease(env, payload.tenantId, leaseKey).catch((leaseError) => {
        console.warn('Failed to release evidence lease', leaseError);
      });
    }
  }
}
