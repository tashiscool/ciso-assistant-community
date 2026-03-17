import type { DomainEventEnvelope, ExportJobMessage } from "./shared/types";

interface Env {
  APP_D1_MAIN: D1Database;
  CISO_EXPORTS_R2: R2Bucket;
  CISO_SNAPSHOTS_R2: R2Bucket;
  PROJECTIONS_Q: Queue<DomainEventEnvelope>;
  DEAD_LETTER_Q: Queue<Record<string, unknown>>;
}

export default {
  async queue(batch: MessageBatch<ExportJobMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const body = message.body;

      try {
        validateExportMessage(body);
        await processExport(body, env);
        message.ack();
      } catch (error) {
        await env.DEAD_LETTER_Q.send({
          queue: "exports-q",
          failed_at: new Date().toISOString(),
          error: (error as Error).message,
          body
        });

        if (body?.job_id) {
          await markExportFailed(body.job_id, env, (error as Error).message);
        }

        message.ack();
      }
    }
  },

  async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === "/healthz") {
      return new Response(JSON.stringify({ status: "ok", service: "export-worker" }), {
        headers: { "content-type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404 });
  }
};

function validateExportMessage(body: ExportJobMessage): void {
  if (!body?.job_id || !body?.tenant_id || !body?.module) {
    throw new Error("Invalid export job message");
  }
}

async function processExport(message: ExportJobMessage, env: Env): Promise<void> {
  const now = new Date();
  const startedAt = now.toISOString();
  const module = message.module.toLowerCase();

  await env.APP_D1_MAIN.prepare(
    `UPDATE jobs
     SET status = 'processing', progress = 0.3, updated_at = ?
     WHERE id = ?`
  )
    .bind(startedAt, message.job_id)
    .run();

  const target = resolveExportTarget(module);
  const format = (message.format || "json").toLowerCase();
  const objectKey = buildObjectKey(target.prefix, message.tenant_id, message.object_group || module, message.job_id, format, now);

  const artifactPayload = {
    generated_at: startedAt,
    tenant_id: message.tenant_id,
    module,
    format,
    aggregate_id: message.aggregate_id || null,
    payload: message.payload ?? {}
  };

  const bucket = target.bucket === "snapshot" ? env.CISO_SNAPSHOTS_R2 : env.CISO_EXPORTS_R2;
  const serialized = JSON.stringify(artifactPayload, null, 2);

  await bucket.put(objectKey, serialized, {
    httpMetadata: {
      contentType: format === "json" ? "application/json" : "application/octet-stream"
    }
  });

  const completedAt = new Date().toISOString();
  const artifactId = crypto.randomUUID();

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO r2_artifacts (
       id, tenant_id, object_type, bucket, object_key, object_group, content_type,
       size_bytes, retention_class, status, created_at, updated_at
     ) VALUES (?, ?, 'export', ?, ?, ?, ?, ?, ?, 'uploaded', ?, ?)
     ON CONFLICT(tenant_id, object_key)
     DO UPDATE SET
       size_bytes = excluded.size_bytes,
       content_type = excluded.content_type,
       status = excluded.status,
       updated_at = excluded.updated_at`
  )
    .bind(
      artifactId,
      message.tenant_id,
      target.bucket,
      objectKey,
      sanitizeSegment(message.object_group || module),
      format === "json" ? "application/json" : "application/octet-stream",
      serialized.length,
      target.retentionClass,
      completedAt,
      completedAt
    )
    .run();

  await env.APP_D1_MAIN.prepare(
    `INSERT OR IGNORE INTO job_artifacts (job_id, artifact_id, relation_type, created_at)
     VALUES (?, ?, 'result', ?)`
  )
    .bind(message.job_id, artifactId, completedAt)
    .run();

  await env.APP_D1_MAIN.prepare(
    `UPDATE jobs
     SET status = 'completed',
         progress = 1.0,
         result_ref = ?,
         completed_at = ?,
         updated_at = ?
     WHERE id = ?`
  )
    .bind(objectKey, completedAt, completedAt, message.job_id)
    .run();

  await updateModuleState(message, module, objectKey, completedAt, env);

  const projectionEvent: DomainEventEnvelope = {
    event_id: crypto.randomUUID(),
    event_type: message.event_type || defaultEventTypeByModule(module),
    aggregate_id: message.aggregate_id || message.job_id,
    aggregate_version: 1,
    tenant_id: message.tenant_id,
    occurred_at: completedAt,
    payload: {
      ...(message.payload ?? {}),
      module,
      status: "completed",
      format,
      result_ref: objectKey,
      job_id: message.job_id,
      aggregate_id: message.aggregate_id || null
    }
  };

  await env.PROJECTIONS_Q.send(projectionEvent);
}

async function updateModuleState(
  message: ExportJobMessage,
  module: string,
  resultRef: string,
  completedAt: string,
  env: Env
): Promise<void> {
  if (module === "oscal" && message.aggregate_id) {
    await env.APP_D1_MAIN.prepare(
      `UPDATE oscal_jobs
       SET status = 'completed', output_ref = ?, updated_at = ?
       WHERE tenant_id = ? AND oscal_job_id = ?`
    )
      .bind(resultRef, completedAt, message.tenant_id, message.aggregate_id)
      .run();
    return;
  }

  if (module === "fedramp" && message.aggregate_id) {
    await env.APP_D1_MAIN.prepare(
      `UPDATE fedramp_automation_jobs
       SET status = 'completed', result_ref = ?, updated_at = ?
       WHERE tenant_id = ? AND run_id = ?`
    )
      .bind(resultRef, completedAt, message.tenant_id, message.aggregate_id)
      .run();
    return;
  }

  if (module === "crq" && message.aggregate_id) {
    await env.APP_D1_MAIN.prepare(
      `UPDATE crq_compute_jobs
       SET status = 'completed', result_ref = ?, updated_at = ?
       WHERE tenant_id = ? AND run_id = ?`
    )
      .bind(resultRef, completedAt, message.tenant_id, message.aggregate_id)
      .run();
    return;
  }

  if (module === "mapping" && message.aggregate_id) {
    await env.APP_D1_MAIN.prepare(
      `UPDATE mapping_jobs
       SET status = 'completed', result_ref = ?, updated_at = ?
       WHERE tenant_id = ? AND mapping_job_id = ?`
    )
      .bind(resultRef, completedAt, message.tenant_id, message.aggregate_id)
      .run();
    return;
  }

  if (module === "translation" && message.aggregate_id) {
    await env.APP_D1_MAIN.prepare(
      `UPDATE translation_jobs
       SET status = 'completed', output_ref = ?, updated_at = ?
       WHERE tenant_id = ? AND translation_job_id = ?`
    )
      .bind(resultRef, completedAt, message.tenant_id, message.aggregate_id)
      .run();
  }
}

async function markExportFailed(jobId: string, env: Env, error: string): Promise<void> {
  const now = new Date().toISOString();
  await env.APP_D1_MAIN.prepare(
    `UPDATE jobs
     SET status = 'failed', error = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(error, now, jobId)
    .run();
}

function resolveExportTarget(module: string): {
  bucket: "export" | "snapshot";
  prefix: string;
  retentionClass: "short" | "long";
} {
  if (module === "version-history" || module === "snapshots") {
    return {
      bucket: "snapshot",
      prefix: "snapshots",
      retentionClass: "short"
    };
  }

  return {
    bucket: "export",
    prefix: "exports",
    retentionClass: "short"
  };
}

function buildObjectKey(
  prefix: string,
  tenantId: string,
  objectGroup: string,
  jobId: string,
  format: string,
  now: Date
): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${prefix}/${tenantId}/${sanitizeSegment(objectGroup)}/${yyyy}/${mm}/${dd}/${jobId}.${sanitizeSegment(format)}`;
}

function defaultEventTypeByModule(module: string): string {
  switch (module) {
    case "oscal":
      return "OscalExportCompleted";
    case "fedramp":
      return "FedrampAutomationCompleted";
    case "crq":
      return "CrqComputationCompleted";
    case "mapping":
      return "MappingComputationCompleted";
    case "translation":
      return "OcsfOscalTranslationCompleted";
    default:
      return "ExportJobCompleted";
  }
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80) || "export";
}
