import type { CommandEnvelope, DomainEventEnvelope, ExportJobMessage } from "./shared/types";
import { handleAssessmentArtifactCommand } from "./handlers/assessment-artifacts";
import { handleCoreGrcCommand } from "./handlers/core-grc";
import { handleTprmCommand } from "./handlers/tprm";
import { handleEbiosRmCommand } from "./handlers/ebios-rm";
import { handlePrivacyCommand } from "./handlers/privacy";
import { handleBusinessContinuityCommand } from "./handlers/business-continuity";
import { handleCrqCommand } from "./handlers/crq";
import { handleRmfCommand } from "./handlers/rmf-operations";
import { handleSecurityOperationsCommand } from "./handlers/security-operations";
import { handleMetrologyCommand } from "./handlers/metrology";
import { handleWorkflowCommand } from "./handlers/workflows";
import { handleComplianceCommand } from "./handlers/compliance";
import { handleAssetServiceCommand } from "./handlers/asset-service";
import { handleResilienceCommand } from "./handlers/resilience";
import { handleControlLibraryCommand } from "./handlers/control-library";
import { handleGovernanceCommand } from "./handlers/governance";
import { handleIamCommand } from "./handlers/iam";
import { handleSettingsCommand } from "./handlers/settings";
import { handleOrganizationCommand } from "./handlers/organization";
import {
  computeParityDiff,
  deriveRecordId,
  extractParityState,
  flattenPrimitiveFields,
  isRecord as isParityRecord,
  PYTHON_MODEL_FIELD_REGISTRY,
  resolveExpectedFields,
  resolveModelKey,
  sanitizeModelKeySegment
} from "./shared/parity";

interface Env {
  APP_D1_MAIN: D1Database;
  EVENTS_Q: Queue<DomainEventEnvelope>;
  PROJECTIONS_Q: Queue<DomainEventEnvelope>;
  EXPORTS_Q: Queue<ExportJobMessage>;
  DEAD_LETTER_Q: Queue<Record<string, unknown>>;
  CISO_EVIDENCE_R2: R2Bucket;
  CISO_IMPORTS_R2: R2Bucket;
  CISO_EXPORTS_R2: R2Bucket;
  CISO_SNAPSHOTS_R2: R2Bucket;
  MAX_INLINE_EVENT_BYTES?: string;
  MAX_INLINE_PARITY_BYTES?: string;
  MAX_PARITY_INDEX_FIELDS?: string;
  STRICT_FIELD_PARITY?: string;
}

interface CommandExecutionResult {
  events: DomainEventEnvelope[];
  finalizeJob: boolean;
  pendingProgress?: number;
}

export default {
  async queue(batch: MessageBatch<CommandEnvelope>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const command = message.body;

      try {
        validateCommandEnvelope(command);
        await handleCommand(command, env);
        message.ack();
      } catch (error) {
        await markCommandFailed(command.command_id, command.job_id, env, (error as Error).message);
        await env.DEAD_LETTER_Q.send({
          queue: "commands-q",
          failed_at: new Date().toISOString(),
          error: (error as Error).message,
          command
        });
        message.ack();
      }
    }
  },

  async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === "/healthz") {
      return new Response(JSON.stringify({ status: "ok", service: "command-worker" }), {
        headers: { "content-type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await sweepCommandOutbox(env);
  }
};

/**
 * Sweeps the command_outbox for entries stuck in 'pending' status and retries dispatch.
 * Runs on a cron schedule. Marks entries as 'delivered' on success, increments retry_count
 * on failure, and marks as 'failed' after 5 attempts.
 */
async function sweepCommandOutbox(env: Env): Promise<void> {
  const MAX_RETRIES = 5;
  const BATCH_SIZE = 50;
  const now = new Date().toISOString();

  const pending = await env.APP_D1_MAIN.prepare(
    `SELECT id, command_id, tenant_id, event_type, event_payload_json, retry_count
     FROM command_outbox
     WHERE dispatch_status = 'pending'
       AND next_attempt_at <= ?
     ORDER BY created_at ASC
     LIMIT ?`
  ).bind(now, BATCH_SIZE).all<{
    id: string;
    command_id: string;
    tenant_id: string;
    event_type: string;
    event_payload_json: string;
    retry_count: number;
  }>();

  if (!pending.results?.length) return;

  for (const entry of pending.results) {
    try {
      const payload = JSON.parse(entry.event_payload_json);
      const event: DomainEventEnvelope = {
        event_id: crypto.randomUUID(),
        event_type: entry.event_type,
        aggregate_id: payload.aggregate_id ?? entry.command_id,
        aggregate_version: payload.aggregate_version ?? 1,
        tenant_id: entry.tenant_id,
        occurred_at: now,
        payload
      };

      await Promise.all([env.EVENTS_Q.send(event), env.PROJECTIONS_Q.send(event)]);

      await env.APP_D1_MAIN.prepare(
        `UPDATE command_outbox SET dispatch_status = 'delivered', updated_at = ? WHERE id = ?`
      ).bind(now, entry.id).run();
    } catch (error) {
      const newRetryCount = entry.retry_count + 1;
      const backoffSeconds = Math.min(300, Math.pow(2, newRetryCount) * 10);
      const nextAttempt = new Date(Date.now() + backoffSeconds * 1000).toISOString();

      if (newRetryCount >= MAX_RETRIES) {
        await env.APP_D1_MAIN.prepare(
          `UPDATE command_outbox SET dispatch_status = 'failed', retry_count = ?, updated_at = ? WHERE id = ?`
        ).bind(newRetryCount, now, entry.id).run();

        await env.DEAD_LETTER_Q.send({
          queue: "command-outbox-sweep",
          failed_at: now,
          error: (error as Error).message,
          outbox_entry: entry
        });
      } else {
        await env.APP_D1_MAIN.prepare(
          `UPDATE command_outbox SET retry_count = ?, next_attempt_at = ?, updated_at = ? WHERE id = ?`
        ).bind(newRetryCount, nextAttempt, now, entry.id).run();
      }
    }
  }
}

function validateCommandEnvelope(command: CommandEnvelope): void {
  if (!command.command_id || !command.command_type || !command.tenant_id || !command.job_id) {
    throw new Error("Invalid command envelope");
  }
}

async function handleCommand(command: CommandEnvelope, env: Env): Promise<void> {
  const now = new Date().toISOString();

  await env.APP_D1_MAIN.prepare(`UPDATE commands SET status = 'processing', updated_at = ? WHERE id = ?`)
    .bind(now, command.command_id)
    .run();

  await env.APP_D1_MAIN.prepare(`UPDATE jobs SET status = 'processing', progress = 0.1, updated_at = ? WHERE id = ?`)
    .bind(now, command.job_id)
    .run();

  const execution = await executeCommand(command, env);

  for (const event of execution.events) {
    await persistAndPublishEvent(event, command, env);
  }

  const completedAt = new Date().toISOString();
  await env.APP_D1_MAIN.prepare(
    `UPDATE commands
     SET status = 'completed',
         updated_at = ?
     WHERE id = ?`
  )
    .bind(completedAt, command.command_id)
    .run();

  if (execution.finalizeJob) {
    await env.APP_D1_MAIN.prepare(
      `UPDATE jobs
       SET status = 'completed',
           progress = 1.0,
           completed_at = ?,
           updated_at = ?
       WHERE id = ?`
    )
      .bind(completedAt, completedAt, command.job_id)
      .run();
    return;
  }

  await env.APP_D1_MAIN.prepare(
    `UPDATE jobs
     SET status = 'processing',
         progress = ?,
         updated_at = ?
     WHERE id = ?`
  )
    .bind(execution.pendingProgress ?? 0.5, completedAt, command.job_id)
    .run();
}

async function executeCommand(command: CommandEnvelope, env: Env): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  await persistFieldParitySnapshot(command, payload, env);
  const eventPayloadBase = {
    command_id: command.command_id,
    command_type: command.command_type,
    tenant_id: command.tenant_id,
    payload,
    executed_at: now
  };

  switch (command.command_type) {
    case "connectors.sync.requested": {
      const connectorInstanceId = readString(payload, "connector_instance_id") || command.command_id;
      const connectorType = readString(payload, "connector_type") || "generic";

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO connector_instances (
           tenant_id, connector_instance_id, connector_type, status,
           last_sync_at, last_error, config_json, metrics_json, created_at, updated_at
         )
         VALUES (?, ?, ?, 'syncing', ?, NULL, ?, '{}', ?, ?)
         ON CONFLICT(tenant_id, connector_instance_id)
         DO UPDATE SET
           connector_type = excluded.connector_type,
           status = excluded.status,
           last_sync_at = excluded.last_sync_at,
           config_json = excluded.config_json,
           updated_at = excluded.updated_at`
      )
        .bind(
          command.tenant_id,
          connectorInstanceId,
          connectorType,
          now,
          JSON.stringify(payload),
          now,
          now
        )
        .run();

      return {
        events: [
          makeEvent("ConnectorSyncRequested", command.tenant_id, connectorInstanceId, {
            ...eventPayloadBase,
            connector_instance_id: connectorInstanceId,
            connector_type: connectorType,
            status: "syncing"
          })
        ],
        finalizeJob: true
      };
    }

    case "lightning-assessment.upsert": {
      const assessmentId = readString(payload, "assessment_id") || command.command_id;
      const frameworkId = readString(payload, "framework_id") || "n/a";
      const status = readString(payload, "status") || "submitted";
      const score = readNumber(payload, "score") ?? 0;

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO lightning_assessments (
           tenant_id, assessment_id, framework_id, status, score,
           summary_json, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, assessment_id)
         DO UPDATE SET
           framework_id = excluded.framework_id,
           status = excluded.status,
           score = excluded.score,
           summary_json = excluded.summary_json,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, assessmentId, frameworkId, status, score, JSON.stringify(payload), now, now)
        .run();

      return {
        events: [
          makeEvent("LightningAssessmentUpserted", command.tenant_id, assessmentId, {
            ...eventPayloadBase,
            assessment_id: assessmentId,
            framework_id: frameworkId,
            status,
            score
          })
        ],
        finalizeJob: true
      };
    }

    case "version-history.snapshot.requested": {
      const snapshotId = readString(payload, "snapshot_id") || command.command_id;
      const resourceId = readString(payload, "resource_id") || "global";
      const versionLabel = readString(payload, "version_label") || now;
      const snapshotObjectKey =
        readString(payload, "snapshot_object_key") ||
        (await writeJsonArtifact(env.CISO_SNAPSHOTS_R2, {
          rootPrefix: "snapshots",
          tenantId: command.tenant_id,
          objectGroup: "version-history",
          objectId: snapshotId,
          payload
        }));

      await upsertArtifactMetadata(env, {
        tenantId: command.tenant_id,
        objectType: "snapshot",
        bucket: "snapshot",
        objectKey: snapshotObjectKey,
        objectGroup: "version-history",
        sizeBytes: null,
        contentType: "application/json",
        retentionClass: "short",
        status: "uploaded"
      });

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO version_history_snapshots (
           tenant_id, snapshot_id, resource_id, version_label,
           snapshot_ref, created_by_command_id, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, snapshot_id)
         DO UPDATE SET
           resource_id = excluded.resource_id,
           version_label = excluded.version_label,
           snapshot_ref = excluded.snapshot_ref,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, snapshotId, resourceId, versionLabel, snapshotObjectKey, command.command_id, now, now)
        .run();

      return {
        events: [
          makeEvent("VersionHistorySnapshotCreated", command.tenant_id, snapshotId, {
            ...eventPayloadBase,
            snapshot_id: snapshotId,
            resource_id: resourceId,
            version_label: versionLabel,
            snapshot_ref: snapshotObjectKey
          })
        ],
        finalizeJob: true
      };
    }

    case "security-graph.ingest.requested": {
      const ingestJobId = readString(payload, "ingest_job_id") || command.command_id;
      const graphRef =
        readString(payload, "graph_object_key") ||
        (await writeJsonArtifact(env.CISO_SNAPSHOTS_R2, {
          rootPrefix: "snapshots",
          tenantId: command.tenant_id,
          objectGroup: "security-graph",
          objectId: ingestJobId,
          payload
        }));

      await upsertArtifactMetadata(env, {
        tenantId: command.tenant_id,
        objectType: "snapshot",
        bucket: "snapshot",
        objectKey: graphRef,
        objectGroup: "security-graph",
        sizeBytes: null,
        contentType: "application/json",
        retentionClass: "short",
        status: "uploaded"
      });

      const nodes = readArray(payload, "nodes");
      const edges = readArray(payload, "edges");

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO security_graph_ingest_jobs (
           tenant_id, ingest_job_id, status, graph_ref, node_count, edge_count, created_at, updated_at
         )
         VALUES (?, ?, 'queued', ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, ingest_job_id)
         DO UPDATE SET
           status = excluded.status,
           graph_ref = excluded.graph_ref,
           node_count = excluded.node_count,
           edge_count = excluded.edge_count,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, ingestJobId, graphRef, nodes.length, edges.length, now, now)
        .run();

      const events: DomainEventEnvelope[] = [
        makeEvent("SecurityGraphIngestRequested", command.tenant_id, ingestJobId, {
          ...eventPayloadBase,
          ingest_job_id: ingestJobId,
          graph_ref: graphRef,
          node_count: nodes.length,
          edge_count: edges.length
        })
      ];

      for (const node of nodes.slice(0, 100)) {
        if (!isRecord(node)) {
          continue;
        }
        const nodeId = readString(node, "id") || readString(node, "node_id") || crypto.randomUUID();
        events.push(
          makeEvent("SecurityGraphNodeUpserted", command.tenant_id, nodeId, {
            ...node,
            node_id: nodeId,
            node_type: readString(node, "node_type") || readString(node, "type") || "unknown",
            label: readString(node, "label") || nodeId
          })
        );
      }

      for (const edge of edges.slice(0, 100)) {
        if (!isRecord(edge)) {
          continue;
        }
        const edgeId = readString(edge, "id") || readString(edge, "edge_id") || crypto.randomUUID();
        events.push(
          makeEvent("SecurityGraphEdgeUpserted", command.tenant_id, edgeId, {
            ...edge,
            edge_id: edgeId,
            source_node_id: readString(edge, "source_node_id") || readString(edge, "source") || "",
            target_node_id: readString(edge, "target_node_id") || readString(edge, "target") || "",
            edge_type: readString(edge, "edge_type") || readString(edge, "type") || "related"
          })
        );
      }

      return {
        events,
        finalizeJob: true
      };
    }

    case "evidence.collection.requested": {
      const runId = readString(payload, "run_id") || command.command_id;
      const artifactRef =
        readString(payload, "evidence_object_key") ||
        (await writeJsonArtifact(env.CISO_EVIDENCE_R2, {
          rootPrefix: "evidence",
          tenantId: command.tenant_id,
          objectGroup: "evidence-automation",
          objectId: runId,
          payload
        }));

      await upsertArtifactMetadata(env, {
        tenantId: command.tenant_id,
        objectType: "evidence",
        bucket: "evidence",
        objectKey: artifactRef,
        objectGroup: "evidence-automation",
        sizeBytes: null,
        contentType: "application/json",
        retentionClass: "long",
        status: "uploaded"
      });

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO evidence_automation_runs (
           tenant_id, run_id, status, artifact_ref, metadata_json, created_at, updated_at
         )
         VALUES (?, ?, 'queued', ?, ?, ?, ?)
         ON CONFLICT(tenant_id, run_id)
         DO UPDATE SET
           status = excluded.status,
           artifact_ref = excluded.artifact_ref,
           metadata_json = excluded.metadata_json,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, runId, artifactRef, JSON.stringify(payload), now, now)
        .run();

      return {
        events: [
          makeEvent("EvidenceCollectionRequested", command.tenant_id, runId, {
            ...eventPayloadBase,
            run_id: runId,
            status: "queued",
            artifact_ref: artifactRef
          })
        ],
        finalizeJob: true
      };
    }

    case "workflow.execution.requested": {
      const executionId = readString(payload, "execution_id") || command.command_id;
      const workflowId = readString(payload, "workflow_id") || "default";

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO workflow_executions (
           tenant_id, execution_id, workflow_id, status, current_step,
           context_json, created_at, updated_at
         )
         VALUES (?, ?, ?, 'queued', 'queued', ?, ?, ?)
         ON CONFLICT(tenant_id, execution_id)
         DO UPDATE SET
           workflow_id = excluded.workflow_id,
           status = excluded.status,
           current_step = excluded.current_step,
           context_json = excluded.context_json,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, executionId, workflowId, JSON.stringify(payload), now, now)
        .run();

      return {
        events: [
          makeEvent("WorkflowExecutionRequested", command.tenant_id, executionId, {
            ...eventPayloadBase,
            execution_id: executionId,
            workflow_id: workflowId,
            status: "queued",
            current_step: "queued"
          })
        ],
        finalizeJob: true
      };
    }

    case "oscal.import.requested": {
      const oscalJobId = readString(payload, "oscal_job_id") || command.command_id;
      const sourceRef =
        readString(payload, "source_object_key") ||
        (await writeJsonArtifact(env.CISO_IMPORTS_R2, {
          rootPrefix: "imports",
          tenantId: command.tenant_id,
          objectGroup: "oscal",
          objectId: oscalJobId,
          payload
        }));

      await upsertArtifactMetadata(env, {
        tenantId: command.tenant_id,
        objectType: "import",
        bucket: "import",
        objectKey: sourceRef,
        objectGroup: "oscal",
        sizeBytes: null,
        contentType: "application/json",
        retentionClass: "short",
        status: "uploaded"
      });

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO oscal_jobs (
           tenant_id, oscal_job_id, job_type, status, source_ref, output_ref,
           metadata_json, created_at, updated_at
         )
         VALUES (?, ?, 'import', 'queued', ?, NULL, ?, ?, ?)
         ON CONFLICT(tenant_id, oscal_job_id)
         DO UPDATE SET
           job_type = excluded.job_type,
           status = excluded.status,
           source_ref = excluded.source_ref,
           metadata_json = excluded.metadata_json,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, oscalJobId, sourceRef, JSON.stringify(payload), now, now)
        .run();

      return {
        events: [
          makeEvent("OscalImportRequested", command.tenant_id, oscalJobId, {
            ...eventPayloadBase,
            oscal_job_id: oscalJobId,
            job_type: "import",
            status: "queued",
            source_ref: sourceRef
          })
        ],
        finalizeJob: true
      };
    }

    case "oscal.export.requested": {
      const oscalJobId = readString(payload, "oscal_job_id") || command.command_id;

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO oscal_jobs (
           tenant_id, oscal_job_id, job_type, status, source_ref, output_ref,
           metadata_json, created_at, updated_at
         )
         VALUES (?, ?, 'export', 'processing', NULL, NULL, ?, ?, ?)
         ON CONFLICT(tenant_id, oscal_job_id)
         DO UPDATE SET
           job_type = excluded.job_type,
           status = excluded.status,
           metadata_json = excluded.metadata_json,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, oscalJobId, JSON.stringify(payload), now, now)
        .run();

      await enqueueExportJob(command, env, {
        module: "oscal",
        format: readString(payload, "format") || "json",
        aggregate_id: oscalJobId,
        event_type: "OscalExportCompleted",
        object_group: "oscal",
        payload: {
          oscal_job_id: oscalJobId,
          ...payload
        }
      });

      return {
        events: [
          makeEvent("OscalExportRequested", command.tenant_id, oscalJobId, {
            ...eventPayloadBase,
            oscal_job_id: oscalJobId,
            job_type: "export",
            status: "processing"
          })
        ],
        finalizeJob: false,
        pendingProgress: 0.5
      };
    }

    case "conmon.profile.refresh.requested": {
      const activityId = readString(payload, "activity_id") || command.command_id;
      const dashboardKey = readString(payload, "dashboard_key") || "primary";
      const profileId = readString(payload, "profile_id") || readString(payload, "id") || dashboardKey;
      const operationalRollup =
        isRecord(payload.operational_rollup) ? payload.operational_rollup : payload;

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO conmon_activity (
           tenant_id, activity_id, activity_type, status, summary_json, created_at, updated_at
         )
         VALUES (?, ?, 'profile-refresh', 'completed', ?, ?, ?)
         ON CONFLICT(tenant_id, activity_id)
         DO UPDATE SET
           status = excluded.status,
           summary_json = excluded.summary_json,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, activityId, JSON.stringify(payload), now, now)
        .run();

      return {
        events: [
          makeEvent("ConMonDashboardUpdated", command.tenant_id, dashboardKey, {
            ...eventPayloadBase,
            dashboard_key: dashboardKey,
            status: "active",
            counters_json: payload
          }),
          makeEvent("ConMonOperationalRollupUpdated", command.tenant_id, profileId, {
            ...eventPayloadBase,
            profile_id: profileId,
            status: "active",
            rollup_json: operationalRollup
          })
        ],
        finalizeJob: true
      };
    }

    case "poam.item.upsert": {
      const poamItemId = readString(payload, "poam_item_id") || command.command_id;
      const status = readString(payload, "status") || "open";
      const dueAt = readOptionalString(payload, "due_at");

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO poam_items (
           tenant_id, poam_item_id, status, due_at, details_json, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, poam_item_id)
         DO UPDATE SET
           status = excluded.status,
           due_at = excluded.due_at,
           details_json = excluded.details_json,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, poamItemId, status, dueAt, JSON.stringify(payload), now, now)
        .run();

      return {
        events: [
          makeEvent("PoamStatusUpdated", command.tenant_id, poamItemId, {
            ...eventPayloadBase,
            poam_item_id: poamItemId,
            status,
            due_at: dueAt
          })
        ],
        finalizeJob: true
      };
    }

    case "ai.assistant.run.requested": {
      const aiJobId = readString(payload, "ai_job_id") || command.command_id;
      const modelName = readString(payload, "model_name") || "default";
      const prompt = readString(payload, "prompt");

      const promptRef =
        readString(payload, "prompt_object_key") ||
        (await writeJsonArtifact(env.CISO_IMPORTS_R2, {
          rootPrefix: "imports",
          tenantId: command.tenant_id,
          objectGroup: "ai-assistant",
          objectId: aiJobId,
          payload: { prompt, context: payload }
        }));

      await upsertArtifactMetadata(env, {
        tenantId: command.tenant_id,
        objectType: "import",
        bucket: "import",
        objectKey: promptRef,
        objectGroup: "ai-assistant",
        sizeBytes: null,
        contentType: "application/json",
        retentionClass: "short",
        status: "uploaded"
      });

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO ai_assistant_jobs (
           tenant_id, ai_job_id, status, model_name, prompt_ref,
           result_ref, error, metadata_json, created_at, updated_at
         )
         VALUES (?, ?, 'queued', ?, ?, NULL, NULL, ?, ?, ?)
         ON CONFLICT(tenant_id, ai_job_id)
         DO UPDATE SET
           status = excluded.status,
           model_name = excluded.model_name,
           prompt_ref = excluded.prompt_ref,
           metadata_json = excluded.metadata_json,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, aiJobId, modelName, promptRef, JSON.stringify(payload), now, now)
        .run();

      return {
        events: [
          makeEvent("AIAssistantJobRequested", command.tenant_id, aiJobId, {
            ...eventPayloadBase,
            ai_job_id: aiJobId,
            status: "queued",
            model_name: modelName,
            prompt_ref: promptRef
          })
        ],
        finalizeJob: true
      };
    }

    case "ai.vendor-scoring.requested": {
      const scoringId = readString(payload, "scoring_id") || command.command_id;
      const vendorId = readString(payload, "vendor_id") || "unknown";
      const score = readNumber(payload, "score");

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO vendor_scoring_jobs (
           tenant_id, scoring_id, vendor_id, status, score,
           summary_json, created_at, updated_at
         )
         VALUES (?, ?, ?, 'queued', ?, ?, ?, ?)
         ON CONFLICT(tenant_id, scoring_id)
         DO UPDATE SET
           vendor_id = excluded.vendor_id,
           status = excluded.status,
           score = excluded.score,
           summary_json = excluded.summary_json,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, scoringId, vendorId, score, JSON.stringify(payload), now, now)
        .run();

      return {
        events: [
          makeEvent("VendorScoringRequested", command.tenant_id, scoringId, {
            ...eventPayloadBase,
            scoring_id: scoringId,
            vendor_id: vendorId,
            status: "queued",
            score
          })
        ],
        finalizeJob: true
      };
    }

    case "vendor.questionnaire.upsert": {
      const questionnaireId = readString(payload, "questionnaire_id") || command.command_id;
      const status = readString(payload, "status") || "draft";
      const responseRef =
        readString(payload, "response_object_key") ||
        (await writeJsonArtifact(env.CISO_EVIDENCE_R2, {
          rootPrefix: "evidence",
          tenantId: command.tenant_id,
          objectGroup: "vendor-questionnaires",
          objectId: questionnaireId,
          payload
        }));

      await upsertArtifactMetadata(env, {
        tenantId: command.tenant_id,
        objectType: "evidence",
        bucket: "evidence",
        objectKey: responseRef,
        objectGroup: "vendor-questionnaires",
        sizeBytes: null,
        contentType: "application/json",
        retentionClass: "long",
        status: "uploaded"
      });

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO vendor_questionnaires (
           tenant_id, questionnaire_id, status, response_ref,
           summary_json, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, questionnaire_id)
         DO UPDATE SET
           status = excluded.status,
           response_ref = excluded.response_ref,
           summary_json = excluded.summary_json,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, questionnaireId, status, responseRef, JSON.stringify(payload), now, now)
        .run();

      return {
        events: [
          makeEvent("VendorQuestionnaireStatusUpdated", command.tenant_id, questionnaireId, {
            ...eventPayloadBase,
            questionnaire_id: questionnaireId,
            status,
            response_ref: responseRef
          })
        ],
        finalizeJob: true
      };
    }

    case "library.index.refresh.requested": {
      const libraryJobId = readString(payload, "library_job_id") || command.command_id;
      const libraryId = readString(payload, "library_id") || "default";
      const sourceRef =
        readString(payload, "source_object_key") ||
        (await writeJsonArtifact(env.CISO_IMPORTS_R2, {
          rootPrefix: "imports",
          tenantId: command.tenant_id,
          objectGroup: "libraries",
          objectId: libraryJobId,
          payload
        }));

      await upsertArtifactMetadata(env, {
        tenantId: command.tenant_id,
        objectType: "import",
        bucket: "import",
        objectKey: sourceRef,
        objectGroup: "libraries",
        sizeBytes: null,
        contentType: "application/json",
        retentionClass: "short",
        status: "uploaded"
      });

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO library_index_jobs (
           tenant_id, library_job_id, library_id, status, source_ref,
           item_count, metadata_json, created_at, updated_at
         )
         VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, library_job_id)
         DO UPDATE SET
           library_id = excluded.library_id,
           status = excluded.status,
           source_ref = excluded.source_ref,
           item_count = excluded.item_count,
           metadata_json = excluded.metadata_json,
           updated_at = excluded.updated_at`
      )
        .bind(
          command.tenant_id,
          libraryJobId,
          libraryId,
          sourceRef,
          readNumber(payload, "item_count") ?? 0,
          JSON.stringify(payload),
          now,
          now
        )
        .run();

      return {
        events: [
          makeEvent("LibraryIndexRefreshed", command.tenant_id, libraryJobId, {
            ...eventPayloadBase,
            library_job_id: libraryJobId,
            library_id: libraryId,
            status: "queued",
            source_ref: sourceRef,
            item_count: readNumber(payload, "item_count") ?? 0
          })
        ],
        finalizeJob: true
      };
    }

    case "fedramp.automation.run.requested": {
      const runId = readString(payload, "run_id") || command.command_id;
      const framework = readString(payload, "framework") || "fedramp";

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO fedramp_automation_jobs (
           tenant_id, run_id, framework, status, result_ref,
           summary_json, created_at, updated_at
         )
         VALUES (?, ?, ?, 'processing', NULL, ?, ?, ?)
         ON CONFLICT(tenant_id, run_id)
         DO UPDATE SET
           framework = excluded.framework,
           status = excluded.status,
           summary_json = excluded.summary_json,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, runId, framework, JSON.stringify(payload), now, now)
        .run();

      await enqueueExportJob(command, env, {
        module: "fedramp",
        format: readString(payload, "format") || "json",
        aggregate_id: runId,
        event_type: "FedrampAutomationCompleted",
        object_group: "fedramp",
        payload: {
          run_id: runId,
          framework,
          ...payload
        }
      });

      return {
        events: [
          makeEvent("FedrampAutomationRequested", command.tenant_id, runId, {
            ...eventPayloadBase,
            run_id: runId,
            framework,
            status: "processing"
          })
        ],
        finalizeJob: false,
        pendingProgress: 0.5
      };
    }

    case "crq.compute.requested": {
      const runId = readString(payload, "run_id") || command.command_id;
      const modelName = readString(payload, "model_name") || "FAIR";

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO crq_compute_jobs (
           tenant_id, run_id, model_name, status, result_ref,
           summary_json, created_at, updated_at
         )
         VALUES (?, ?, ?, 'processing', NULL, ?, ?, ?)
         ON CONFLICT(tenant_id, run_id)
         DO UPDATE SET
           model_name = excluded.model_name,
           status = excluded.status,
           summary_json = excluded.summary_json,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, runId, modelName, JSON.stringify(payload), now, now)
        .run();

      await enqueueExportJob(command, env, {
        module: "crq",
        format: readString(payload, "format") || "json",
        aggregate_id: runId,
        event_type: "CrqComputationCompleted",
        object_group: "crq",
        payload: {
          run_id: runId,
          model_name: modelName,
          ...payload
        }
      });

      return {
        events: [
          makeEvent("CrqComputationRequested", command.tenant_id, runId, {
            ...eventPayloadBase,
            run_id: runId,
            model_name: modelName,
            status: "processing"
          })
        ],
        finalizeJob: false,
        pendingProgress: 0.5
      };
    }

    case "mapping.compute.requested": {
      const mappingJobId = readString(payload, "mapping_job_id") || command.command_id;
      const sourceFramework = readString(payload, "source_framework") || "unknown";
      const targetFramework = readString(payload, "target_framework") || "unknown";

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO mapping_jobs (
           tenant_id, mapping_job_id, source_framework, target_framework,
           status, result_ref, summary_json, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, 'processing', NULL, ?, ?, ?)
         ON CONFLICT(tenant_id, mapping_job_id)
         DO UPDATE SET
           source_framework = excluded.source_framework,
           target_framework = excluded.target_framework,
           status = excluded.status,
           summary_json = excluded.summary_json,
           updated_at = excluded.updated_at`
      )
        .bind(
          command.tenant_id,
          mappingJobId,
          sourceFramework,
          targetFramework,
          JSON.stringify(payload),
          now,
          now
        )
        .run();

      await enqueueExportJob(command, env, {
        module: "mapping",
        format: readString(payload, "format") || "json",
        aggregate_id: mappingJobId,
        event_type: "MappingComputationCompleted",
        object_group: "mapping",
        payload: {
          mapping_job_id: mappingJobId,
          source_framework: sourceFramework,
          target_framework: targetFramework,
          ...payload
        }
      });

      return {
        events: [
          makeEvent("MappingComputationRequested", command.tenant_id, mappingJobId, {
            ...eventPayloadBase,
            mapping_job_id: mappingJobId,
            source_framework: sourceFramework,
            target_framework: targetFramework,
            status: "processing"
          })
        ],
        finalizeJob: false,
        pendingProgress: 0.5
      };
    }

    case "scanner.sync.requested": {
      const ingestJobId = readString(payload, "ingest_job_id") || command.command_id;
      const sourceRef =
        readString(payload, "raw_scan_object_key") ||
        (await writeJsonArtifact(env.CISO_IMPORTS_R2, {
          rootPrefix: "imports",
          tenantId: command.tenant_id,
          objectGroup: "scanner",
          objectId: ingestJobId,
          payload
        }));

      await upsertArtifactMetadata(env, {
        tenantId: command.tenant_id,
        objectType: "import",
        bucket: "import",
        objectKey: sourceRef,
        objectGroup: "scanner",
        sizeBytes: null,
        contentType: "application/json",
        retentionClass: "short",
        status: "uploaded"
      });

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO scanner_ingest_jobs (
           tenant_id, ingest_job_id, ingest_type, status, source_ref,
           finding_count, high_count, critical_count, created_at, updated_at
         )
         VALUES (?, ?, 'scanner', 'queued', ?, 0, 0, 0, ?, ?)
         ON CONFLICT(tenant_id, ingest_job_id)
         DO UPDATE SET
           ingest_type = excluded.ingest_type,
           status = excluded.status,
           source_ref = excluded.source_ref,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, ingestJobId, sourceRef, now, now)
        .run();

      return {
        events: [
          makeEvent("ScannerSyncRequested", command.tenant_id, ingestJobId, {
            ...eventPayloadBase,
            ingest_job_id: ingestJobId,
            ingest_type: "scanner",
            status: "queued",
            source_ref: sourceRef
          })
        ],
        finalizeJob: true
      };
    }

    case "sarif.import.requested": {
      const ingestJobId = readString(payload, "ingest_job_id") || command.command_id;
      const sourceRef =
        readString(payload, "source_object_key") ||
        (await writeJsonArtifact(env.CISO_IMPORTS_R2, {
          rootPrefix: "imports",
          tenantId: command.tenant_id,
          objectGroup: "sarif",
          objectId: ingestJobId,
          payload
        }));

      await upsertArtifactMetadata(env, {
        tenantId: command.tenant_id,
        objectType: "import",
        bucket: "import",
        objectKey: sourceRef,
        objectGroup: "sarif",
        sizeBytes: null,
        contentType: "application/json",
        retentionClass: "short",
        status: "uploaded"
      });

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO scanner_ingest_jobs (
           tenant_id, ingest_job_id, ingest_type, status, source_ref,
           finding_count, high_count, critical_count, created_at, updated_at
         )
         VALUES (?, ?, 'sarif', 'queued', ?, 0, 0, 0, ?, ?)
         ON CONFLICT(tenant_id, ingest_job_id)
         DO UPDATE SET
           ingest_type = excluded.ingest_type,
           status = excluded.status,
           source_ref = excluded.source_ref,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, ingestJobId, sourceRef, now, now)
        .run();

      return {
        events: [
          makeEvent("SarifImportRequested", command.tenant_id, ingestJobId, {
            ...eventPayloadBase,
            ingest_job_id: ingestJobId,
            ingest_type: "sarif",
            status: "queued",
            source_ref: sourceRef
          })
        ],
        finalizeJob: true
      };
    }

    case "scap.import.requested": {
      const ingestJobId = readString(payload, "ingest_job_id") || command.command_id;
      const sourceRef =
        readString(payload, "source_object_key") ||
        (await writeJsonArtifact(env.CISO_IMPORTS_R2, {
          rootPrefix: "imports",
          tenantId: command.tenant_id,
          objectGroup: "scap",
          objectId: ingestJobId,
          payload
        }));

      await upsertArtifactMetadata(env, {
        tenantId: command.tenant_id,
        objectType: "import",
        bucket: "import",
        objectKey: sourceRef,
        objectGroup: "scap",
        sizeBytes: null,
        contentType: "application/json",
        retentionClass: "short",
        status: "uploaded"
      });

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO scanner_ingest_jobs (
           tenant_id, ingest_job_id, ingest_type, status, source_ref,
           finding_count, high_count, critical_count, created_at, updated_at
         )
         VALUES (?, ?, 'scap', 'queued', ?, 0, 0, 0, ?, ?)
         ON CONFLICT(tenant_id, ingest_job_id)
         DO UPDATE SET
           ingest_type = excluded.ingest_type,
           status = excluded.status,
           source_ref = excluded.source_ref,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, ingestJobId, sourceRef, now, now)
        .run();

      return {
        events: [
          makeEvent("ScapImportRequested", command.tenant_id, ingestJobId, {
            ...eventPayloadBase,
            ingest_job_id: ingestJobId,
            ingest_type: "scap",
            status: "queued",
            source_ref: sourceRef
          })
        ],
        finalizeJob: true
      };
    }

    case "servicenow.sync.requested": {
      const syncJobId = readString(payload, "sync_job_id") || command.command_id;

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO integration_sync_jobs (
           tenant_id, sync_job_id, integration_type, status, last_synced_at,
           last_error, metadata_json, created_at, updated_at
         )
         VALUES (?, ?, 'servicenow', 'queued', NULL, NULL, ?, ?, ?)
         ON CONFLICT(tenant_id, sync_job_id)
         DO UPDATE SET
           integration_type = excluded.integration_type,
           status = excluded.status,
           metadata_json = excluded.metadata_json,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, syncJobId, JSON.stringify(payload), now, now)
        .run();

      return {
        events: [
          makeEvent("ServiceNowSyncRequested", command.tenant_id, syncJobId, {
            ...eventPayloadBase,
            sync_job_id: syncJobId,
            integration_type: "servicenow",
            status: "queued"
          })
        ],
        finalizeJob: true
      };
    }

    case "jira.sync.requested": {
      const syncJobId = readString(payload, "sync_job_id") || command.command_id;

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO integration_sync_jobs (
           tenant_id, sync_job_id, integration_type, status, last_synced_at,
           last_error, metadata_json, created_at, updated_at
         )
         VALUES (?, ?, 'jira', 'queued', NULL, NULL, ?, ?, ?)
         ON CONFLICT(tenant_id, sync_job_id)
         DO UPDATE SET
           integration_type = excluded.integration_type,
           status = excluded.status,
           metadata_json = excluded.metadata_json,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, syncJobId, JSON.stringify(payload), now, now)
        .run();

      return {
        events: [
          makeEvent("JiraSyncRequested", command.tenant_id, syncJobId, {
            ...eventPayloadBase,
            sync_job_id: syncJobId,
            integration_type: "jira",
            status: "queued"
          })
        ],
        finalizeJob: true
      };
    }

    case "ocsf.oscal.translate.requested": {
      const translationJobId = readString(payload, "translation_job_id") || command.command_id;
      const sourceFormat = readString(payload, "source_format") || "ocsf";
      const targetFormat = readString(payload, "target_format") || "oscal";
      const sourceRef =
        readString(payload, "source_object_key") ||
        (await writeJsonArtifact(env.CISO_IMPORTS_R2, {
          rootPrefix: "imports",
          tenantId: command.tenant_id,
          objectGroup: "translation",
          objectId: translationJobId,
          payload
        }));

      await upsertArtifactMetadata(env, {
        tenantId: command.tenant_id,
        objectType: "import",
        bucket: "import",
        objectKey: sourceRef,
        objectGroup: "translation",
        sizeBytes: null,
        contentType: "application/json",
        retentionClass: "short",
        status: "uploaded"
      });

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO translation_jobs (
           tenant_id, translation_job_id, source_format, target_format,
           status, source_ref, output_ref, metadata_json, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, 'processing', ?, NULL, ?, ?, ?)
         ON CONFLICT(tenant_id, translation_job_id)
         DO UPDATE SET
           source_format = excluded.source_format,
           target_format = excluded.target_format,
           status = excluded.status,
           source_ref = excluded.source_ref,
           metadata_json = excluded.metadata_json,
           updated_at = excluded.updated_at`
      )
        .bind(
          command.tenant_id,
          translationJobId,
          sourceFormat,
          targetFormat,
          sourceRef,
          JSON.stringify(payload),
          now,
          now
        )
        .run();

      await enqueueExportJob(command, env, {
        module: "translation",
        format: readString(payload, "format") || "json",
        aggregate_id: translationJobId,
        event_type: "OcsfOscalTranslationCompleted",
        object_group: "translation",
        payload: {
          translation_job_id: translationJobId,
          source_format: sourceFormat,
          target_format: targetFormat,
          source_ref: sourceRef,
          ...payload
        }
      });

      return {
        events: [
          makeEvent("OcsfOscalTranslationRequested", command.tenant_id, translationJobId, {
            ...eventPayloadBase,
            translation_job_id: translationJobId,
            source_format: sourceFormat,
            target_format: targetFormat,
            status: "processing",
            source_ref: sourceRef
          })
        ],
        finalizeJob: false,
        pendingProgress: 0.5
      };
    }

    // ── Assessment Artifact Package ───────────────────────────────────────
    case "assessment-artifact.package.generate-from-template":
    case "assessment-artifact.package.import-tsv":
    case "assessment-artifact.package.upsert":
    case "assessment-artifact.item.upsert":
    case "assessment-artifact.schedule.upsert":
    case "assessment-artifact.schedule.pause":
    case "assessment-artifact.schedule.resume": {
      return handleAssessmentArtifactCommand(command, env);
    }

    // ── Core GRC (26 commands) ────────────────────────────────────────────
    case "grc.folder.upsert":
    case "grc.framework.upsert":
    case "grc.framework.import":
    case "grc.requirement-node.upsert":
    case "grc.reference-control.upsert":
    case "grc.applied-control.upsert":
    case "grc.policy.upsert":
    case "grc.risk-matrix.upsert":
    case "grc.threat.upsert":
    case "grc.vulnerability.upsert":
    case "grc.risk-assessment.upsert":
    case "grc.risk-scenario.upsert":
    case "grc.risk-acceptance.upsert":
    case "grc.risk-acceptance.approve":
    case "grc.risk-acceptance.reject":
    case "grc.evidence.upsert":
    case "grc.evidence.upload":
    case "grc.compliance-assessment.upsert":
    case "grc.requirement-assessment.upsert":
    case "grc.requirement-assessment.bulk-update":
    case "grc.finding.upsert":
    case "grc.finding.close":
    case "grc.filtering-label.upsert":
    case "grc.campaign.upsert":
    case "grc.requirement-mapping-set.upsert":
    case "grc.asset.upsert": {
      return handleCoreGrcCommand(command, env);
    }

    // ── TPRM (5 commands) ─────────────────────────────────────────────────
    case "tprm.entity.upsert":
    case "tprm.entity-assessment.upsert":
    case "tprm.solution.upsert":
    case "tprm.representative.upsert":
    case "tprm.contract.upsert": {
      return handleTprmCommand(command, env);
    }

    // ── EBIOS RM (7 commands) ─────────────────────────────────────────────
    case "ebios.study.upsert":
    case "ebios.feared-event.upsert":
    case "ebios.ro-to.upsert":
    case "ebios.stakeholder.upsert":
    case "ebios.attack-path.upsert":
    case "ebios.operational-scenario.upsert":
    case "ebios.strategic-scenario.upsert": {
      return handleEbiosRmCommand(command, env);
    }

    // ── Privacy / GDPR (13 commands) ──────────────────────────────────────
    case "privacy.purpose.upsert":
    case "privacy.personal-data.upsert":
    case "privacy.data-subject.upsert":
    case "privacy.data-recipient.upsert":
    case "privacy.data-transfer.upsert":
    case "privacy.processing.upsert":
    case "privacy.right-request.upsert":
    case "privacy.right-request.complete":
    case "privacy.data-breach.upsert":
    case "privacy.data-breach.report":
    case "privacy.data-asset.upsert":
    case "privacy.data-flow.upsert":
    case "privacy.consent-record.upsert": {
      return handlePrivacyCommand(command, env);
    }

    // ── Business Continuity (4 commands) ──────────────────────────────────
    case "bc.plan.upsert":
    case "bc.audit.upsert":
    case "bc.task.upsert":
    case "bc.task.complete": {
      return handleBusinessContinuityCommand(command, env);
    }

    // ── CRQ (3 commands) ──────────────────────────────────────────────────
    case "crq.study.upsert":
    case "crq.scenario.upsert":
    case "crq.hypothesis.upsert": {
      return handleCrqCommand(command, env);
    }

    // ── RMF Operations (9 commands) ───────────────────────────────────────
    case "rmf.system-group.upsert":
    case "rmf.change-request.upsert":
    case "rmf.change-request.approve":
    case "rmf.checklist.upsert":
    case "rmf.checklist-score.upsert":
    case "rmf.template.upsert":
    case "rmf.artifact.upsert":
    case "rmf.vulnerability-finding.upsert":
    case "rmf.nessus-scan.import": {
      return handleRmfCommand(command, env);
    }

    // ── Security Operations (5 commands) ──────────────────────────────────
    case "secops.incident.upsert":
    case "secops.incident.resolve":
    case "secops.awareness-program.upsert":
    case "secops.awareness-campaign.upsert":
    case "secops.awareness-completion.record": {
      return handleSecurityOperationsCommand(command, env);
    }

    // ── Metrology (4 commands) ────────────────────────────────────────────
    case "metrology.definition.upsert":
    case "metrology.instance.record":
    case "metrology.dashboard.upsert":
    case "metrology.widget.upsert": {
      return handleMetrologyCommand(command, env);
    }

    // ── Workflows (7 commands) ────────────────────────────────────────────
    case "wf.template.upsert":
    case "wf.execution.start":
    case "wf.execution.advance":
    case "wf.execution.complete":
    case "wf.schedule.upsert":
    case "wf.assessment-task.upsert":
    case "wf.assessment-task.complete": {
      return handleWorkflowCommand(command, env);
    }

    // ── Compliance (7 commands) ───────────────────────────────────────────
    case "compliance.online-assessment.upsert":
    case "compliance.assessment-run.start":
    case "compliance.assessment-run.complete":
    case "compliance.audit.upsert":
    case "compliance.finding.upsert":
    case "compliance.exception.upsert":
    case "compliance.exception.approve": {
      return handleComplianceCommand(command, env);
    }

    // ── Asset Service (4 commands) ────────────────────────────────────────
    case "asset.item.upsert":
    case "asset.process.upsert":
    case "asset.service.upsert":
    case "asset.service-contract.upsert": {
      return handleAssetServiceCommand(command, env);
    }

    // ── Resilience (3 commands) ───────────────────────────────────────────
    case "resilience.bia.upsert":
    case "resilience.asset-assessment.upsert":
    case "resilience.escalation-threshold.upsert": {
      return handleResilienceCommand(command, env);
    }

    // ── Control Library (5 commands) ──────────────────────────────────────
    case "ctllib.control.upsert":
    case "ctllib.implementation.upsert":
    case "ctllib.policy.upsert":
    case "ctllib.policy-ack.record":
    case "ctllib.evidence-item.upsert": {
      return handleControlLibraryCommand(command, env);
    }

    // ── Governance (10 commands) ──────────────────────────────────────────
    case "gov.control-origination.upsert":
    case "gov.responsibility-matrix.upsert":
    case "gov.responsibility-assignment.upsert":
    case "gov.assessment-plan.upsert":
    case "gov.assessment-plan.approve":
    case "gov.attestation.upsert":
    case "gov.attestation.approve":
    case "gov.attestation.revoke":
    case "gov.authorization-timeline.upsert":
    case "gov.authorization-timeline.advance": {
      return handleGovernanceCommand(command, env);
    }

    // ── IAM (3 commands) ──────────────────────────────────────────────────
    case "iam.user.upsert":
    case "iam.user-group.upsert":
    case "iam.role-assignment.upsert": {
      return handleIamCommand(command, env);
    }

    // ── Settings (2 commands) ─────────────────────────────────────────────
    case "settings.global.upsert":
    case "settings.feature-flag.upsert": {
      return handleSettingsCommand(command, env);
    }

    // ── Organization / Vendor Portal / SerDes (5 commands) ────────────────
    case "org.unit.upsert":
    case "vp.questionnaire-response.submit":
    case "vp.evidence-submission.upload":
    case "serdes.dump-db.requested":
    case "serdes.load-backup.requested": {
      return handleOrganizationCommand(command, env);
    }

    default: {
      const domain = resolveLegacyDomain(payload, command.command_type);
      const entityId = deriveRecordId(payload, command.command_id);
      const modelKey = resolveModelKey(command.command_type, payload) || `runtime.${domain.replace(/\//g, ".")}`;
      const status = readString(payload, "status") || "updated";
      const state = extractParityState(payload);

      await persistCanonicalDomainState(command, {
        domain,
        entityId,
        modelKey,
        status,
        state
      }, env, now);

      await env.APP_D1_MAIN.prepare(
        `INSERT INTO legacy_domain_state (
           tenant_id, domain, entity_id, command_type, status, state_json, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, domain, entity_id)
         DO UPDATE SET
           command_type = excluded.command_type,
           status = excluded.status,
           state_json = excluded.state_json,
           updated_at = excluded.updated_at`
      )
        .bind(command.tenant_id, domain, entityId, command.command_type, status, JSON.stringify(payload), now, now)
        .run();

      return {
        events: [
          makeEvent("LegacyDomainStateUpserted", command.tenant_id, entityId, {
            ...eventPayloadBase,
            domain,
            entity_id: entityId,
            status
          })
        ],
        finalizeJob: true
      };
    }
  }
}

async function persistAndPublishEvent(
  event: DomainEventEnvelope,
  command: CommandEnvelope,
  env: Env
): Promise<void> {
  const now = new Date().toISOString();
  const compactPayload = await compactPayloadForD1(event.payload, env, command.tenant_id, event.event_type, event.event_id);

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO domain_events (id, event_type, aggregate_id, aggregate_version, tenant_id, payload_json, occurred_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      event.event_id,
      event.event_type,
      event.aggregate_id,
      event.aggregate_version,
      event.tenant_id,
      JSON.stringify(compactPayload),
      event.occurred_at,
      now
    )
    .run();

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO command_outbox (id, command_id, tenant_id, event_type, event_payload_json, dispatch_status, retry_count, next_attempt_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      command.command_id,
      command.tenant_id,
      event.event_type,
      JSON.stringify(compactPayload),
      now,
      now,
      now
    )
    .run();

  await Promise.all([env.EVENTS_Q.send(event), env.PROJECTIONS_Q.send(event)]);

  await env.APP_D1_MAIN.prepare(
    `UPDATE command_outbox
     SET dispatch_status = 'delivered',
         updated_at = ?
     WHERE command_id = ? AND event_type = ?`
  )
    .bind(now, command.command_id, event.event_type)
    .run();
}

async function enqueueExportJob(
  command: CommandEnvelope,
  env: Env,
  params: Omit<ExportJobMessage, "job_id" | "tenant_id">
): Promise<void> {
  await env.EXPORTS_Q.send({
    job_id: command.job_id,
    tenant_id: command.tenant_id,
    ...params
  });
}

function makeEvent(
  eventType: string,
  tenantId: string,
  aggregateId: string,
  payload: Record<string, unknown>
): DomainEventEnvelope {
  return {
    event_id: crypto.randomUUID(),
    event_type: eventType,
    aggregate_id: aggregateId,
    aggregate_version: 1,
    tenant_id: tenantId,
    occurred_at: new Date().toISOString(),
    payload
  };
}

async function markCommandFailed(
  commandId: string,
  jobId: string,
  env: Env,
  errorMessage: string
): Promise<void> {
  const now = new Date().toISOString();

  await env.APP_D1_MAIN.prepare(
    `UPDATE commands
     SET status = 'failed',
         error = ?,
         updated_at = ?
     WHERE id = ?`
  )
    .bind(errorMessage, now, commandId)
    .run();

  await env.APP_D1_MAIN.prepare(
    `UPDATE jobs
     SET status = 'failed',
         error = ?,
         updated_at = ?
     WHERE id = ?`
  )
    .bind(errorMessage, now, jobId)
    .run();
}

async function persistFieldParitySnapshot(
  command: CommandEnvelope,
  payload: Record<string, unknown>,
  env: Env
): Promise<void> {
  const strictParity = (env.STRICT_FIELD_PARITY ?? "false").toLowerCase() === "true";
  const now = new Date().toISOString();
  const modelKey = resolveModelKey(command.command_type, payload);

  if (!modelKey) {
    if (strictParity) {
      throw new Error(
        `Field parity requires payload.model_key for command_type=${command.command_type}`
      );
    }
    return;
  }

  const expectedFields = resolveExpectedFields(modelKey, payload);
  if (strictParity && expectedFields.length === 0) {
    throw new Error(
      `No field registry for model_key=${modelKey}. Provide payload.model_fields for strict parity.`
    );
  }

  await upsertFieldParityModel(env, modelKey, expectedFields, now);

  const recordId = deriveRecordId(payload, command.command_id);
  const current = await env.APP_D1_MAIN.prepare(
    `SELECT data_json, data_ref
     FROM field_parity_records
     WHERE tenant_id = ? AND model_key = ? AND record_id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, modelKey, recordId)
    .first<Record<string, unknown>>();

  const existingState = await loadFieldParityState(current, env);
  const updateState = extractParityState(payload);
  const mergedState: Record<string, unknown> = {
    ...existingState,
    ...updateState
  };

  const parity = computeParityDiff(expectedFields, mergedState);
  const parityStatus = parity.missing_fields.length === 0 ? "complete" : "incomplete";

  if (strictParity && parity.missing_fields.length > 0) {
    throw new Error(
      `Field parity failed for ${modelKey}/${recordId}; missing fields: ${parity.missing_fields.slice(0, 12).join(", ")}`
    );
  }

  const serialized = JSON.stringify(mergedState);
  const maxInlineBytes = Number(env.MAX_INLINE_PARITY_BYTES || "24576");
  let dataJson: string | null = serialized;
  let dataRef: string | null = null;
  let dataSizeBytes = serialized.length;

  if (serialized.length > maxInlineBytes) {
    dataRef = await writeJsonArtifact(env.CISO_SNAPSHOTS_R2, {
      rootPrefix: "snapshots",
      tenantId: command.tenant_id,
      objectGroup: `field-parity/${sanitizeModelKeySegment(modelKey)}`,
      objectId: recordId,
      payload: mergedState
    });
    dataJson = null;

    await upsertArtifactMetadata(env, {
      tenantId: command.tenant_id,
      objectType: "snapshot",
      bucket: "snapshot",
      objectKey: dataRef,
      objectGroup: `field-parity-${sanitizeModelKeySegment(modelKey)}`,
      sizeBytes: serialized.length,
      contentType: "application/json",
      retentionClass: "long",
      status: "uploaded"
    });
  }

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO field_parity_records (
       tenant_id, model_key, record_id, domain, command_type,
       data_json, data_ref, data_size_bytes, parity_status,
       missing_fields_json, extra_fields_json, field_count,
       updated_by_command_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, model_key, record_id)
     DO UPDATE SET
       domain = excluded.domain,
       command_type = excluded.command_type,
       data_json = excluded.data_json,
       data_ref = excluded.data_ref,
       data_size_bytes = excluded.data_size_bytes,
       parity_status = excluded.parity_status,
       missing_fields_json = excluded.missing_fields_json,
       extra_fields_json = excluded.extra_fields_json,
       field_count = excluded.field_count,
       updated_by_command_id = excluded.updated_by_command_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      modelKey,
      recordId,
      readString(payload, "domain") || command.command_type.split(".")[0] || "core",
      command.command_type,
      dataJson,
      dataRef,
      dataSizeBytes,
      parityStatus,
      JSON.stringify(parity.missing_fields),
      JSON.stringify(parity.extra_fields),
      parity.present_field_count,
      command.command_id,
      now,
      now
    )
    .run();

  const maxIndexFields = Number(env.MAX_PARITY_INDEX_FIELDS || "256");
  const flattened = flattenPrimitiveFields(mergedState, maxIndexFields, 3);

  await env.APP_D1_MAIN.prepare(
    `DELETE FROM field_parity_field_index
     WHERE tenant_id = ? AND model_key = ? AND record_id = ?`
  )
    .bind(command.tenant_id, modelKey, recordId)
    .run();

  for (const field of flattened) {
    await env.APP_D1_MAIN.prepare(
      `INSERT INTO field_parity_field_index (
         tenant_id, model_key, record_id, field_path,
         value_type, value_text, value_number, value_bool, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        command.tenant_id,
        modelKey,
        recordId,
        field.field_path,
        field.value_type,
        field.value_text,
        field.value_number,
        field.value_bool,
        now
      )
      .run();
  }
}

async function persistCanonicalDomainState(
  command: CommandEnvelope,
  params: {
    domain: string;
    entityId: string;
    modelKey: string;
    status: string;
    state: Record<string, unknown>;
  },
  env: Env,
  nowIso: string
): Promise<void> {
  const expectedFields = resolveExpectedFields(params.modelKey, params.state);
  await upsertCanonicalModelRegistryEntry(env, params.modelKey, expectedFields, nowIso);

  const serialized = JSON.stringify(params.state);
  const checksum = await sha256Hex(serialized);
  const maxInlineBytes = Number(env.MAX_INLINE_PARITY_BYTES || "24576");
  let stateJson: string | null = serialized;
  let stateRef: string | null = null;

  if (serialized.length > maxInlineBytes) {
    stateRef = await writeJsonArtifact(env.CISO_SNAPSHOTS_R2, {
      rootPrefix: "snapshots",
      tenantId: command.tenant_id,
      objectGroup: `canonical-state/${sanitizeModelKeySegment(params.modelKey)}`,
      objectId: params.entityId,
      payload: params.state
    });
    stateJson = null;

    await upsertArtifactMetadata(env, {
      tenantId: command.tenant_id,
      objectType: "snapshot",
      bucket: "snapshot",
      objectKey: stateRef,
      objectGroup: `canonical-state-${sanitizeModelKeySegment(params.modelKey)}`,
      sizeBytes: serialized.length,
      contentType: "application/json",
      retentionClass: "long",
      status: "uploaded"
    });
  }

  const folderId = readString(params.state, "folder_id") || readString(params.state, "folder") || null;
  const ownerId = readString(params.state, "owner_id") || readString(params.state, "owner") || null;
  const deletedAt = params.status.toLowerCase() === "deleted" ? nowIso : null;

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO canonical_domain_state (
       tenant_id, domain, entity_id, model_key, command_type, status,
       state_json, state_ref, state_size_bytes, checksum, folder_id, owner_id,
       deleted_at, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, domain, entity_id)
     DO UPDATE SET
       model_key = excluded.model_key,
       command_type = excluded.command_type,
       status = excluded.status,
       state_json = excluded.state_json,
       state_ref = excluded.state_ref,
       state_size_bytes = excluded.state_size_bytes,
       checksum = excluded.checksum,
       folder_id = excluded.folder_id,
       owner_id = excluded.owner_id,
       deleted_at = excluded.deleted_at,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      params.domain,
      params.entityId,
      params.modelKey,
      command.command_type,
      params.status,
      stateJson,
      stateRef,
      serialized.length,
      checksum,
      folderId,
      ownerId,
      deletedAt,
      nowIso,
      nowIso
    )
    .run();

  await env.APP_D1_MAIN.prepare(
    `DELETE FROM canonical_domain_field_index
     WHERE tenant_id = ? AND domain = ? AND entity_id = ?`
  )
    .bind(command.tenant_id, params.domain, params.entityId)
    .run();

  const flattened = flattenPrimitiveFields(params.state, Number(env.MAX_PARITY_INDEX_FIELDS || "256"), 3);
  for (const field of flattened) {
    await env.APP_D1_MAIN.prepare(
      `INSERT INTO canonical_domain_field_index (
         tenant_id, domain, entity_id, model_key, field_path,
         value_type, value_text, value_number, value_bool, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        command.tenant_id,
        params.domain,
        params.entityId,
        params.modelKey,
        field.field_path,
        field.value_type,
        field.value_text,
        field.value_number,
        field.value_bool,
        nowIso
      )
      .run();
  }

  await env.APP_D1_MAIN.prepare(
    `DELETE FROM canonical_domain_relations
     WHERE tenant_id = ? AND domain = ? AND entity_id = ?`
  )
    .bind(command.tenant_id, params.domain, params.entityId)
    .run();

  for (const relation of extractCanonicalRelations(params.state)) {
    await env.APP_D1_MAIN.prepare(
      `INSERT INTO canonical_domain_relations (
         tenant_id, domain, entity_id, relation_name, target_entity_id, target_model_key, position, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        command.tenant_id,
        params.domain,
        params.entityId,
        relation.relation_name,
        relation.target_entity_id,
        relation.target_model_key,
        relation.position,
        nowIso
      )
      .run();
  }
}

async function upsertFieldParityModel(
  env: Env,
  modelKey: string,
  expectedFields: readonly string[],
  nowIso: string
): Promise<void> {
  const fromRegistry = PYTHON_MODEL_FIELD_REGISTRY[modelKey];
  const sourceFile = modelKey in PYTHON_MODEL_FIELD_REGISTRY ? modelKey : "runtime";
  const fields =
    fromRegistry && fromRegistry.length > 0
      ? Array.from(fromRegistry)
      : expectedFields.length > 0
        ? Array.from(expectedFields)
        : [];

  if (fields.length === 0) {
    return;
  }

  const schemaHash = await sha256Hex(JSON.stringify(fields));
  await env.APP_D1_MAIN.prepare(
    `INSERT INTO field_parity_models (
       model_key, source_file, field_count, field_names_json, schema_hash, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(model_key)
     DO UPDATE SET
       source_file = excluded.source_file,
       field_count = excluded.field_count,
       field_names_json = excluded.field_names_json,
       schema_hash = excluded.schema_hash,
       updated_at = excluded.updated_at`
  )
    .bind(modelKey, sourceFile, fields.length, JSON.stringify(fields), schemaHash, nowIso, nowIso)
    .run();
}

async function upsertCanonicalModelRegistryEntry(
  env: Env,
  modelKey: string,
  expectedFields: readonly string[],
  nowIso: string
): Promise<void> {
  const fromRegistry = PYTHON_MODEL_FIELD_REGISTRY[modelKey];
  const fieldNames =
    fromRegistry && fromRegistry.length > 0
      ? Array.from(fromRegistry)
      : expectedFields.length > 0
        ? Array.from(expectedFields)
        : [];
  const normalizedModelKey = sanitizeModelKeySegment(modelKey);
  const segments = modelKey.split(".");
  const modelName = segments[segments.length - 1] || normalizedModelKey;
  const appLabel = segments.length > 1 ? segments[0] || "runtime" : "runtime";
  const sourceModule = segments.slice(0, -1).join(".") || "runtime";
  const dbTable = normalizedModelKey.replace(/\./g, "_").toLowerCase();

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO canonical_model_registry (
       model_key, app_label, model_name, db_table, source_module,
       source_file, pk_field, field_names_json, relation_fields_json, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(model_key)
     DO UPDATE SET
       app_label = excluded.app_label,
       model_name = excluded.model_name,
       db_table = excluded.db_table,
       source_module = excluded.source_module,
       source_file = excluded.source_file,
       pk_field = excluded.pk_field,
       field_names_json = excluded.field_names_json,
       updated_at = excluded.updated_at`
  )
    .bind(
      modelKey,
      appLabel,
      modelName,
      dbTable,
      sourceModule,
      sourceModule,
      "id",
      JSON.stringify(fieldNames),
      "[]",
      nowIso,
      nowIso
    )
    .run();
}

async function loadFieldParityState(
  record: Record<string, unknown> | null,
  env: Env
): Promise<Record<string, unknown>> {
  if (!record) {
    return {};
  }

  const inlinePayload = readOptionalString(record, "data_json");
  if (inlinePayload) {
    return parseJsonObject(inlinePayload);
  }

  const ref = readOptionalString(record, "data_ref");
  if (!ref) {
    return {};
  }

  const object = await env.CISO_SNAPSHOTS_R2.get(ref);
  if (!object) {
    return {};
  }
  const text = await object.text();
  return parseJsonObject(text);
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return isParityRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((valueByte) => valueByte.toString(16).padStart(2, "0"))
    .join("");
}

function resolveLegacyDomain(payload: Record<string, unknown>, commandType: string): string {
  const explicitDomain = readString(payload, "domain");
  if (explicitDomain) {
    return explicitDomain
      .split("/")
      .map((segment) => sanitizeDomainSegment(segment))
      .filter(Boolean)
      .join("/");
  }

  const normalizedType = commandType.trim().toLowerCase();
  const requestedSuffix = ".requested";
  if (normalizedType.endsWith(requestedSuffix)) {
    const withoutRequested = normalizedType.slice(0, -requestedSuffix.length);
    const tokens = withoutRequested.split(".");
    if (tokens.length > 1) {
      return tokens
        .slice(0, -1)
        .map((segment) => sanitizeDomainSegment(segment))
        .filter(Boolean)
        .join("/");
    }
  }

  const tokens = normalizedType.split(".");
  if (tokens.length > 1) {
    return tokens
      .slice(0, -1)
      .map((segment) => sanitizeDomainSegment(segment))
      .filter(Boolean)
      .join("/");
  }

  return "core";
}

function extractCanonicalRelations(
  state: Record<string, unknown>
): Array<{
  relation_name: string;
  target_entity_id: string;
  target_model_key: string | null;
  position: number;
}> {
  const relations: Array<{
    relation_name: string;
    target_entity_id: string;
    target_model_key: string | null;
    position: number;
  }> = [];

  for (const [key, value] of Object.entries(state)) {
    if (typeof value === "string" && key.endsWith("_id") && value) {
      relations.push({
        relation_name: key.slice(0, -3),
        target_entity_id: value,
        target_model_key: null,
        position: 0
      });
      continue;
    }

    if (Array.isArray(value) && key.endsWith("_ids")) {
      let position = 0;
      for (const entry of value) {
        if (typeof entry !== "string" || !entry) {
          continue;
        }
        relations.push({
          relation_name: key.slice(0, -4),
          target_entity_id: entry,
          target_model_key: null,
          position
        });
        position += 1;
      }
    }
  }

  return relations;
}

function sanitizeDomainSegment(segment: string): string {
  return segment.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}

function readString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function readOptionalString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function readNumber(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readArray(payload: Record<string, unknown>, key: string): unknown[] {
  const value = payload[key];
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80) || "item";
}

async function writeJsonArtifact(
  bucket: R2Bucket,
  params: {
    rootPrefix: string;
    tenantId: string;
    objectGroup: string;
    objectId: string;
    payload: unknown;
  }
): Promise<string> {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const objectKey = `${params.rootPrefix}/${params.tenantId}/${sanitizeSegment(params.objectGroup)}/${yyyy}/${mm}/${dd}/${sanitizeSegment(params.objectId)}.json`;

  await bucket.put(objectKey, JSON.stringify(params.payload ?? {}), {
    httpMetadata: {
      contentType: "application/json"
    }
  });

  return objectKey;
}

async function upsertArtifactMetadata(
  env: Env,
  params: {
    tenantId: string;
    objectType: "evidence" | "import" | "export" | "snapshot";
    bucket: "evidence" | "import" | "export" | "snapshot";
    objectKey: string;
    objectGroup: string;
    sizeBytes: number | null;
    contentType: string;
    retentionClass: "short" | "long" | "transient" | "pinned";
    status: "issued" | "uploaded";
  }
): Promise<void> {
  const now = new Date().toISOString();

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO r2_artifacts (
       id, tenant_id, object_type, bucket, object_key, object_group, content_type,
       size_bytes, retention_class, status, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, object_key)
     DO UPDATE SET
       content_type = excluded.content_type,
       size_bytes = excluded.size_bytes,
       retention_class = excluded.retention_class,
       status = excluded.status,
       updated_at = excluded.updated_at`
  )
    .bind(
      crypto.randomUUID(),
      params.tenantId,
      params.objectType,
      params.bucket,
      params.objectKey,
      sanitizeSegment(params.objectGroup),
      params.contentType,
      params.sizeBytes,
      params.retentionClass,
      params.status,
      now,
      now
    )
    .run();
}

async function compactPayloadForD1(
  payload: Record<string, unknown>,
  env: Env,
  tenantId: string,
  eventType: string,
  eventId: string
): Promise<Record<string, unknown>> {
  const inlineThreshold = Number(env.MAX_INLINE_EVENT_BYTES || "8192");
  const serialized = JSON.stringify(payload ?? {});

  if (serialized.length <= inlineThreshold) {
    return payload;
  }

  const objectKey = await writeJsonArtifact(env.CISO_SNAPSHOTS_R2, {
    rootPrefix: "snapshots",
    tenantId,
    objectGroup: `events/${eventType}`,
    objectId: eventId,
    payload
  });

  await upsertArtifactMetadata(env, {
    tenantId,
    objectType: "snapshot",
    bucket: "snapshot",
    objectKey,
    objectGroup: `events-${eventType}`,
    sizeBytes: serialized.length,
    contentType: "application/json",
    retentionClass: "short",
    status: "uploaded"
  });

  return {
    payload_ref: objectKey,
    payload_size_bytes: serialized.length,
    payload_inline: false
  };
}
