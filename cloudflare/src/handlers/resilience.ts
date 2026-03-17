/**
 * Resilience command handler.
 *
 * Handles CQRS commands for business impact analysis, asset assessments, and
 * escalation thresholds. This module is designed to be imported by
 * command-worker.ts for dispatching resilience.* command types.
 */

import type { CommandEnvelope, DomainEventEnvelope } from "../shared/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CommandExecutionResult {
  events: DomainEventEnvelope[];
  finalizeJob: boolean;
  pendingProgress?: number;
}

interface Env {
  APP_D1_MAIN: D1Database;
}

// ---------------------------------------------------------------------------
// Payload read helpers (mirrors command-worker.ts helpers)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Event factory
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Read model projection updater
// ---------------------------------------------------------------------------

async function refreshResilienceStatus(
  db: D1Database,
  tenantId: string,
  now: string
): Promise<void> {
  const biaCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM resilience_bia WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const assetAssessmentCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM resilience_asset_assessments WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const thresholdCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM resilience_escalation_thresholds WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  // Compute average RTO/RPO across BIAs
  const avgMetrics = await db
    .prepare(
      `SELECT AVG(rto_hours) AS avg_rto, AVG(rpo_hours) AS avg_rpo
       FROM resilience_bia
       WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ avg_rto: number | null; avg_rpo: number | null }>();

  await db
    .prepare(
      `INSERT INTO rm_resilience_status (
         tenant_id, total_bia, total_asset_assessments, total_thresholds,
         avg_rto_hours, avg_rpo_hours, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id)
       DO UPDATE SET
         total_bia = excluded.total_bia,
         total_asset_assessments = excluded.total_asset_assessments,
         total_thresholds = excluded.total_thresholds,
         avg_rto_hours = excluded.avg_rto_hours,
         avg_rpo_hours = excluded.avg_rpo_hours,
         updated_at = excluded.updated_at`
    )
    .bind(
      tenantId,
      biaCount?.cnt ?? 0,
      assetAssessmentCount?.cnt ?? 0,
      thresholdCount?.cnt ?? 0,
      avgMetrics?.avg_rto ?? 0,
      avgMetrics?.avg_rpo ?? 0,
      now
    )
    .run();
}

// ---------------------------------------------------------------------------
// Individual command handlers
// ---------------------------------------------------------------------------

async function handleBiaUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const processId = readOptionalString(payload, "process_id");
  const rtoHours = readNumber(payload, "rto_hours") ?? 0;
  const rpoHours = readNumber(payload, "rpo_hours") ?? 0;
  const mtpdHours = readNumber(payload, "mtpd_hours") ?? 0;
  const impactScoresJson = isRecord(payload.impact_scores_json)
    ? JSON.stringify(payload.impact_scores_json)
    : readString(payload, "impact_scores_json") || "{}";
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO resilience_bia (
       tenant_id, entity_id, name, description, process_id, rto_hours,
       rpo_hours, mtpd_hours, impact_scores_json, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       process_id = excluded.process_id,
       rto_hours = excluded.rto_hours,
       rpo_hours = excluded.rpo_hours,
       mtpd_hours = excluded.mtpd_hours,
       impact_scores_json = excluded.impact_scores_json,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      processId,
      rtoHours,
      rpoHours,
      mtpdHours,
      impactScoresJson,
      folderId,
      now,
      now
    )
    .run();

  await refreshResilienceStatus(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("ResilienceBiaUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        process_id: processId,
        rto_hours: rtoHours,
        rpo_hours: rpoHours,
        mtpd_hours: mtpdHours,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleAssetAssessmentUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const assetId = readOptionalString(payload, "asset_id");
  const biaId = readOptionalString(payload, "bia_id");
  const criticality = readString(payload, "criticality");
  const recoveryPriority = readNumber(payload, "recovery_priority");
  const dependenciesJson = Array.isArray(payload.dependencies_json)
    ? JSON.stringify(payload.dependencies_json)
    : readString(payload, "dependencies_json") || "[]";
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO resilience_asset_assessments (
       tenant_id, entity_id, name, description, asset_id, bia_id,
       criticality, recovery_priority, dependencies_json, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       asset_id = excluded.asset_id,
       bia_id = excluded.bia_id,
       criticality = excluded.criticality,
       recovery_priority = excluded.recovery_priority,
       dependencies_json = excluded.dependencies_json,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      assetId,
      biaId,
      criticality,
      recoveryPriority,
      dependenciesJson,
      folderId,
      now,
      now
    )
    .run();

  await refreshResilienceStatus(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("ResilienceAssetAssessmentUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        asset_id: assetId,
        bia_id: biaId,
        criticality,
        recovery_priority: recoveryPriority,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleEscalationThresholdUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const metricId = readOptionalString(payload, "metric_id");
  const warningThreshold = readNumber(payload, "warning_threshold");
  const criticalThreshold = readNumber(payload, "critical_threshold");
  const actionPlan = readString(payload, "action_plan");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO resilience_escalation_thresholds (
       tenant_id, entity_id, name, description, metric_id,
       warning_threshold, critical_threshold, action_plan, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       metric_id = excluded.metric_id,
       warning_threshold = excluded.warning_threshold,
       critical_threshold = excluded.critical_threshold,
       action_plan = excluded.action_plan,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      metricId,
      warningThreshold,
      criticalThreshold,
      actionPlan,
      folderId,
      now,
      now
    )
    .run();

  await refreshResilienceStatus(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("ResilienceEscalationThresholdUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        metric_id: metricId,
        warning_threshold: warningThreshold,
        critical_threshold: criticalThreshold,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// ---------------------------------------------------------------------------
// Public command dispatcher
// ---------------------------------------------------------------------------

export async function handleResilienceCommand(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  switch (command.command_type) {
    case "resilience.bia.upsert":
      return handleBiaUpsert(command, env);

    case "resilience.asset-assessment.upsert":
      return handleAssetAssessmentUpsert(command, env);

    case "resilience.escalation-threshold.upsert":
      return handleEscalationThresholdUpsert(command, env);

    default:
      throw new Error(`Unsupported resilience command type: ${command.command_type}`);
  }
}
