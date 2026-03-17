import type { CommandEnvelope } from "./shared/types";

interface Env {
  APP_D1_MAIN: D1Database;
  COMMANDS_Q: Queue<CommandEnvelope>;
  AUTOMATION_DEFAULT_TENANT?: string;
}

type ConnectorSyncMessage = {
  tenant_id?: string;
  connector_instance_id?: string;
  connector_type?: string;
};

export default {
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    const tenantId = env.AUTOMATION_DEFAULT_TENANT || "global";
    const now = new Date().toISOString();

    const automationRequests = [
      {
        command_type: "connectors.sync.requested",
        idempotency_key: `cron:${controller.cron}:${now}:connectors`,
        payload: { schedule: controller.cron, source: "automation-worker" }
      },
      {
        command_type: "conmon.profile.refresh.requested",
        idempotency_key: `cron:${controller.cron}:${now}:conmon`,
        payload: { schedule: controller.cron, source: "automation-worker" }
      },
      {
        command_type: "evidence.collection.requested",
        idempotency_key: `cron:${controller.cron}:${now}:evidence`,
        payload: { schedule: controller.cron, source: "automation-worker" }
      },
      {
        command_type: "library.index.refresh.requested",
        idempotency_key: `cron:${controller.cron}:${now}:library`,
        payload: { schedule: controller.cron, source: "automation-worker", library_id: "default" }
      },
      {
        command_type: "fedramp.automation.run.requested",
        idempotency_key: `cron:${controller.cron}:${now}:fedramp`,
        payload: { schedule: controller.cron, source: "automation-worker", framework: "fedramp" }
      }
    ] as const;

    for (const request of automationRequests) {
      await persistAndEnqueueCommand(env, {
        tenant_id: tenantId,
        command_type: request.command_type,
        idempotency_key: request.idempotency_key,
        payload: request.payload
      });
    }
  },

  async queue(batch: MessageBatch<ConnectorSyncMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const body = message.body;
      const tenantId = body.tenant_id || env.AUTOMATION_DEFAULT_TENANT || "global";
      const connectorInstanceId = body.connector_instance_id || "unknown";
      const connectorType = body.connector_type || "generic";
      const now = new Date().toISOString();

      await persistAndEnqueueCommand(env, {
        tenant_id: tenantId,
        command_type: "connectors.sync.requested",
        idempotency_key: `connector-sync:${connectorInstanceId}:${now}`,
        payload: {
          source: "connector-sync-q",
          connector_instance_id: connectorInstanceId,
          connector_type: connectorType
        }
      });

      message.ack();
    }
  },

  async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === "/healthz") {
      return new Response(JSON.stringify({ status: "ok", service: "automation-worker" }), {
        headers: { "content-type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404 });
  }
};

async function persistAndEnqueueCommand(
  env: Env,
  params: {
    tenant_id: string;
    command_type: string;
    idempotency_key: string;
    payload: Record<string, unknown>;
  }
): Promise<void> {
  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT id AS command_id, job_id
     FROM commands
     WHERE tenant_id = ? AND command_type = ? AND idempotency_key = ?
     LIMIT 1`
  )
    .bind(params.tenant_id, params.command_type, params.idempotency_key)
    .first<Record<string, unknown>>();

  if (existing) {
    return;
  }

  const now = new Date().toISOString();
  const commandId = crypto.randomUUID();
  const jobId = crypto.randomUUID();

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO commands (id, idempotency_key, command_type, tenant_id, payload_json, status, job_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'accepted', ?, ?, ?)`
  )
    .bind(
      commandId,
      params.idempotency_key,
      params.command_type,
      params.tenant_id,
      JSON.stringify(params.payload),
      jobId,
      now,
      now
    )
    .run();

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO jobs (id, tenant_id, job_type, status, progress, created_at, updated_at)
     VALUES (?, ?, ?, 'accepted', 0, ?, ?)`
  )
    .bind(jobId, params.tenant_id, params.command_type, now, now)
    .run();

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO command_outbox (id, command_id, tenant_id, event_type, event_payload_json, dispatch_status, retry_count, next_attempt_at, created_at, updated_at)
     VALUES (?, ?, ?, 'CommandAccepted', ?, 'pending', 0, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      commandId,
      params.tenant_id,
      JSON.stringify({
        command_id: commandId,
        command_type: params.command_type,
        job_id: jobId
      }),
      now,
      now,
      now
    )
    .run();

  const command: CommandEnvelope = {
    command_id: commandId,
    command_type: params.command_type,
    tenant_id: params.tenant_id,
    idempotency_key: params.idempotency_key,
    payload: params.payload,
    job_id: jobId,
    created_at: now
  };

  await env.COMMANDS_Q.send(command);

  await env.APP_D1_MAIN.prepare(
    `UPDATE command_outbox
     SET dispatch_status = 'delivered',
         updated_at = ?
     WHERE command_id = ?`
  )
    .bind(now, commandId)
    .run();
}
