/**
 * Security Operations command handler.
 *
 * Handles CQRS commands for security incidents, awareness programs,
 * awareness campaigns, and awareness completions.
 * This module is designed to be imported by command-worker.ts for dispatching
 * secops.* command types.
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

async function refreshSecopsDashboard(
  db: D1Database,
  tenantId: string,
  entityId: string,
  now: string
): Promise<void> {
  // Count total incidents
  const totalIncidents = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM secops_incidents
       WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  // Count open incidents
  const openIncidents = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM secops_incidents
       WHERE tenant_id = ? AND status NOT IN ('resolved', 'closed')`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  // Count active awareness programs
  const activePrograms = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM secops_awareness_programs
       WHERE tenant_id = ? AND status = 'active'`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  // Count total awareness completions
  const totalCompletions = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM secops_awareness_completions
       WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  await db
    .prepare(
      `INSERT INTO rm_secops_dashboard (
         tenant_id, entity_id, total_incidents, open_incidents,
         active_awareness_programs, total_completions, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, entity_id)
       DO UPDATE SET
         total_incidents = excluded.total_incidents,
         open_incidents = excluded.open_incidents,
         active_awareness_programs = excluded.active_awareness_programs,
         total_completions = excluded.total_completions,
         updated_at = excluded.updated_at`
    )
    .bind(
      tenantId,
      entityId,
      totalIncidents?.cnt ?? 0,
      openIncidents?.cnt ?? 0,
      activePrograms?.cnt ?? 0,
      totalCompletions?.cnt ?? 0,
      now
    )
    .run();
}

// ---------------------------------------------------------------------------
// Individual command handlers
// ---------------------------------------------------------------------------

async function handleIncidentUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const severity = readString(payload, "severity");
  const status = readString(payload, "status") || "open";
  const incidentType = readString(payload, "incident_type");
  const detectedAt = readOptionalString(payload, "detected_at");
  const containedAt = readOptionalString(payload, "contained_at");
  const resolvedAt = readOptionalString(payload, "resolved_at");
  const impactDescription = readString(payload, "impact_description");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO secops_incidents (
       tenant_id, id, name, description, severity, status, incident_type,
       detected_at, contained_at, resolved_at, impact_description,
       folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       severity = excluded.severity,
       status = excluded.status,
       incident_type = excluded.incident_type,
       detected_at = excluded.detected_at,
       contained_at = excluded.contained_at,
       resolved_at = excluded.resolved_at,
       impact_description = excluded.impact_description,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      severity,
      status,
      incidentType,
      detectedAt,
      containedAt,
      resolvedAt,
      impactDescription,
      folderId,
      now,
      now
    )
    .run();

  await refreshSecopsDashboard(env.APP_D1_MAIN, command.tenant_id, entityId, now);

  return {
    events: [
      makeEvent("SecopsIncidentUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        severity,
        status,
        incident_type: incidentType,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleIncidentResolve(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id");

  if (!entityId) {
    throw new Error("secops.incident.resolve requires payload.id");
  }

  // Fetch current record to verify it exists
  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT status FROM secops_incidents
     WHERE tenant_id = ? AND id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, entityId)
    .first<{ status: string }>();

  if (!existing) {
    throw new Error(`Incident ${entityId} not found for tenant ${command.tenant_id}`);
  }

  await env.APP_D1_MAIN.prepare(
    `UPDATE secops_incidents
     SET status = 'resolved', resolved_at = ?, updated_at = ?
     WHERE tenant_id = ? AND id = ?`
  )
    .bind(now, now, command.tenant_id, entityId)
    .run();

  await refreshSecopsDashboard(env.APP_D1_MAIN, command.tenant_id, entityId, now);

  return {
    events: [
      makeEvent("SecopsIncidentResolved", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        previous_status: existing.status,
        resolved_at: now,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleAwarenessProgramUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "draft";
  const programType = readString(payload, "program_type");
  const startDate = readOptionalString(payload, "start_date");
  const endDate = readOptionalString(payload, "end_date");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO secops_awareness_programs (
       tenant_id, id, name, description, status, program_type,
       start_date, end_date, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       program_type = excluded.program_type,
       start_date = excluded.start_date,
       end_date = excluded.end_date,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      status,
      programType,
      startDate,
      endDate,
      folderId,
      now,
      now
    )
    .run();

  await refreshSecopsDashboard(env.APP_D1_MAIN, command.tenant_id, entityId, now);

  return {
    events: [
      makeEvent("SecopsAwarenessProgramUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        status,
        program_type: programType,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleAwarenessCampaignUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "draft";
  const programId = readString(payload, "program_id");
  const campaignType = readString(payload, "campaign_type");
  const targetAudience = readArray(payload, "target_audience");
  const startDate = readOptionalString(payload, "start_date");
  const endDate = readOptionalString(payload, "end_date");
  const folderId = readOptionalString(payload, "folder_id");

  if (!programId) {
    throw new Error("secops.awareness-campaign.upsert requires payload.program_id");
  }

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO secops_awareness_campaigns (
       tenant_id, id, name, description, status, program_id, campaign_type,
       target_audience_json, start_date, end_date, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       program_id = excluded.program_id,
       campaign_type = excluded.campaign_type,
       target_audience_json = excluded.target_audience_json,
       start_date = excluded.start_date,
       end_date = excluded.end_date,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      status,
      programId,
      campaignType,
      JSON.stringify(targetAudience),
      startDate,
      endDate,
      folderId,
      now,
      now
    )
    .run();

  await refreshSecopsDashboard(env.APP_D1_MAIN, command.tenant_id, entityId, now);

  return {
    events: [
      makeEvent("SecopsAwarenessCampaignUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        status,
        program_id: programId,
        campaign_type: campaignType,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleAwarenessCompletionRecord(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const campaignId = readString(payload, "campaign_id");
  const userId = readString(payload, "user_id");
  const status = readString(payload, "status") || "completed";
  const completedAt = readOptionalString(payload, "completed_at") || now;
  const score = readNumber(payload, "score");
  const folderId = readOptionalString(payload, "folder_id");

  if (!campaignId) {
    throw new Error("secops.awareness-completion.record requires payload.campaign_id");
  }

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO secops_awareness_completions (
       tenant_id, id, campaign_id, user_id, status, completed_at,
       score, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       campaign_id = excluded.campaign_id,
       user_id = excluded.user_id,
       status = excluded.status,
       completed_at = excluded.completed_at,
       score = excluded.score,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      campaignId,
      userId,
      status,
      completedAt,
      score,
      folderId,
      now,
      now
    )
    .run();

  await refreshSecopsDashboard(env.APP_D1_MAIN, command.tenant_id, entityId, now);

  return {
    events: [
      makeEvent("SecopsAwarenessCompletionRecorded", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        campaign_id: campaignId,
        user_id: userId,
        status,
        score,
        completed_at: completedAt,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// ---------------------------------------------------------------------------
// Public command dispatcher
// ---------------------------------------------------------------------------

export async function handleSecurityOperationsCommand(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  switch (command.command_type) {
    case "secops.incident.upsert":
      return handleIncidentUpsert(command, env);

    case "secops.incident.resolve":
      return handleIncidentResolve(command, env);

    case "secops.awareness-program.upsert":
      return handleAwarenessProgramUpsert(command, env);

    case "secops.awareness-campaign.upsert":
      return handleAwarenessCampaignUpsert(command, env);

    case "secops.awareness-completion.record":
      return handleAwarenessCompletionRecord(command, env);

    default:
      throw new Error(`Unsupported security operations command type: ${command.command_type}`);
  }
}
