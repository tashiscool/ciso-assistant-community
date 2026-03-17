/**
 * Organization, Vendor Portal, and SerDes command handler.
 *
 * Handles CQRS commands for organizational structure, vendor portal
 * submissions, and serialization/deserialization (dump/restore) jobs.
 * This module is designed to be imported by command-worker.ts for
 * dispatching org.*, vp.*, and serdes.* command types.
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
// Local helpers
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
// Read model projection updaters
// ---------------------------------------------------------------------------

async function refreshOrgStructureProjection(
  db: D1Database,
  tenantId: string,
  unitId: string,
  now: string
): Promise<void> {
  // Fetch the org unit
  const unit = await db
    .prepare(
      `SELECT id, name, description, parent_id, unit_type, folder_id
       FROM org_units
       WHERE tenant_id = ? AND id = ?
       LIMIT 1`
    )
    .bind(tenantId, unitId)
    .first<Record<string, unknown>>();

  if (!unit) {
    return;
  }

  // Count direct children
  const childCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM org_units
       WHERE tenant_id = ? AND parent_id = ?`
    )
    .bind(tenantId, unitId)
    .first<{ cnt: number }>();

  // Compute depth by walking parent chain
  let depth = 0;
  let currentParentId = readOptionalString(unit, "parent_id");
  const visited = new Set<string>();
  while (currentParentId && !visited.has(currentParentId)) {
    visited.add(currentParentId);
    depth++;
    const parent = await db
      .prepare(
        `SELECT parent_id FROM org_units
         WHERE tenant_id = ? AND id = ?
         LIMIT 1`
      )
      .bind(tenantId, currentParentId)
      .first<{ parent_id: string | null }>();
    currentParentId = parent?.parent_id ?? null;
  }

  // Build ancestry path
  const pathParts: string[] = [readString(unit, "name")];
  currentParentId = readOptionalString(unit, "parent_id");
  const visitedPath = new Set<string>();
  while (currentParentId && !visitedPath.has(currentParentId)) {
    visitedPath.add(currentParentId);
    const ancestor = await db
      .prepare(
        `SELECT name, parent_id FROM org_units
         WHERE tenant_id = ? AND id = ?
         LIMIT 1`
      )
      .bind(tenantId, currentParentId)
      .first<{ name: string; parent_id: string | null }>();
    if (!ancestor) break;
    pathParts.unshift(ancestor.name);
    currentParentId = ancestor.parent_id;
  }

  await db
    .prepare(
      `INSERT INTO rm_org_structure (
         tenant_id, unit_id, name, description, parent_id,
         unit_type, depth, child_count, path, folder_id, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, unit_id)
       DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         parent_id = excluded.parent_id,
         unit_type = excluded.unit_type,
         depth = excluded.depth,
         child_count = excluded.child_count,
         path = excluded.path,
         folder_id = excluded.folder_id,
         updated_at = excluded.updated_at`
    )
    .bind(
      tenantId,
      unitId,
      readString(unit, "name"),
      readString(unit, "description"),
      readOptionalString(unit, "parent_id"),
      readString(unit, "unit_type"),
      depth,
      childCount?.cnt ?? 0,
      pathParts.join(" / "),
      readString(unit, "folder_id"),
      now
    )
    .run();
}

async function refreshVendorPortalStatusProjection(
  db: D1Database,
  tenantId: string,
  entityId: string,
  now: string
): Promise<void> {
  // Count questionnaire responses for this entity
  const responseCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM vp_questionnaire_responses
       WHERE tenant_id = ? AND entity_id = ?`
    )
    .bind(tenantId, entityId)
    .first<{ cnt: number }>();

  // Count evidence submissions for this entity
  const evidenceCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM vp_evidence_submissions
       WHERE tenant_id = ? AND entity_id = ?`
    )
    .bind(tenantId, entityId)
    .first<{ cnt: number }>();

  // Get latest submission timestamp
  const latestResponse = await db
    .prepare(
      `SELECT submitted_at
       FROM vp_questionnaire_responses
       WHERE tenant_id = ? AND entity_id = ?
       ORDER BY submitted_at DESC
       LIMIT 1`
    )
    .bind(tenantId, entityId)
    .first<{ submitted_at: string }>();

  const latestEvidence = await db
    .prepare(
      `SELECT submitted_at
       FROM vp_evidence_submissions
       WHERE tenant_id = ? AND entity_id = ?
       ORDER BY submitted_at DESC
       LIMIT 1`
    )
    .bind(tenantId, entityId)
    .first<{ submitted_at: string }>();

  // Determine last activity
  let lastActivity = now;
  if (latestResponse?.submitted_at && latestEvidence?.submitted_at) {
    lastActivity = latestResponse.submitted_at > latestEvidence.submitted_at
      ? latestResponse.submitted_at
      : latestEvidence.submitted_at;
  } else if (latestResponse?.submitted_at) {
    lastActivity = latestResponse.submitted_at;
  } else if (latestEvidence?.submitted_at) {
    lastActivity = latestEvidence.submitted_at;
  }

  // Count by status
  const statusRows = await db
    .prepare(
      `SELECT status, COUNT(*) AS cnt
       FROM vp_questionnaire_responses
       WHERE tenant_id = ? AND entity_id = ?
       GROUP BY status`
    )
    .bind(tenantId, entityId)
    .all<{ status: string; cnt: number }>();

  const statusBreakdown: Record<string, number> = {};
  for (const row of statusRows.results ?? []) {
    statusBreakdown[row.status] = row.cnt;
  }

  await db
    .prepare(
      `INSERT INTO rm_vendor_portal_status (
         tenant_id, entity_id, questionnaire_count, evidence_count,
         last_activity, status_breakdown_json, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, entity_id)
       DO UPDATE SET
         questionnaire_count = excluded.questionnaire_count,
         evidence_count = excluded.evidence_count,
         last_activity = excluded.last_activity,
         status_breakdown_json = excluded.status_breakdown_json,
         updated_at = excluded.updated_at`
    )
    .bind(
      tenantId,
      entityId,
      responseCount?.cnt ?? 0,
      evidenceCount?.cnt ?? 0,
      lastActivity,
      JSON.stringify(statusBreakdown),
      now
    )
    .run();
}

// ---------------------------------------------------------------------------
// Individual command handlers
// ---------------------------------------------------------------------------

async function handleOrgUnitUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const parentId = readOptionalString(payload, "parent_id");
  const unitType = readString(payload, "unit_type");
  const folderId = readString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO org_units (
       tenant_id, id, name, description, parent_id, unit_type, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       parent_id = excluded.parent_id,
       unit_type = excluded.unit_type,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      parentId,
      unitType,
      folderId,
      now,
      now
    )
    .run();

  await refreshOrgStructureProjection(env.APP_D1_MAIN, command.tenant_id, id, now);

  return {
    events: [
      makeEvent("OrgUnitUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        unit_id: id,
        name,
        unit_type: unitType,
        parent_id: parentId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleQuestionnaireResponseSubmit(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const token = readString(payload, "token");
  const entityId = readString(payload, "entity_id");
  const questionnaireData = isRecord(payload.questionnaire_data)
    ? JSON.stringify(payload.questionnaire_data)
    : readString(payload, "questionnaire_data_json") || "{}";
  const status = readString(payload, "status") || "submitted";
  const submittedAt = readString(payload, "submitted_at") || now;
  const folderId = readString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO vp_questionnaire_responses (
       tenant_id, id, token, entity_id, questionnaire_data_json,
       status, submitted_at, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       token = excluded.token,
       entity_id = excluded.entity_id,
       questionnaire_data_json = excluded.questionnaire_data_json,
       status = excluded.status,
       submitted_at = excluded.submitted_at,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      token,
      entityId,
      questionnaireData,
      status,
      submittedAt,
      folderId,
      now,
      now
    )
    .run();

  if (entityId) {
    await refreshVendorPortalStatusProjection(env.APP_D1_MAIN, command.tenant_id, entityId, now);
  }

  return {
    events: [
      makeEvent("VpQuestionnaireResponseSubmitted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        response_id: id,
        entity_id: entityId,
        status,
        submitted_at: submittedAt,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleEvidenceSubmissionUpload(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const token = readString(payload, "token");
  const entityId = readString(payload, "entity_id");
  const evidenceType = readString(payload, "evidence_type");
  const r2Key = readString(payload, "r2_key");
  const status = readString(payload, "status") || "uploaded";
  const submittedAt = readString(payload, "submitted_at") || now;
  const folderId = readString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO vp_evidence_submissions (
       tenant_id, id, token, entity_id, evidence_type, r2_key,
       status, submitted_at, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       token = excluded.token,
       entity_id = excluded.entity_id,
       evidence_type = excluded.evidence_type,
       r2_key = excluded.r2_key,
       status = excluded.status,
       submitted_at = excluded.submitted_at,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      token,
      entityId,
      evidenceType,
      r2Key,
      status,
      submittedAt,
      folderId,
      now,
      now
    )
    .run();

  if (entityId) {
    await refreshVendorPortalStatusProjection(env.APP_D1_MAIN, command.tenant_id, entityId, now);
  }

  return {
    events: [
      makeEvent("VpEvidenceSubmissionUploaded", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        submission_id: id,
        entity_id: entityId,
        evidence_type: evidenceType,
        r2_key: r2Key,
        status,
        submitted_at: submittedAt,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleDumpDbRequested(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const jobId = readString(payload, "job_id") || command.command_id;
  const format = readString(payload, "format") || "json";
  const description = readString(payload, "description");

  // Create a dump job record
  await env.APP_D1_MAIN.prepare(
    `INSERT INTO serdes_jobs (
       tenant_id, id, job_type, format, description, status,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       job_type = excluded.job_type,
       format = excluded.format,
       description = excluded.description,
       status = excluded.status,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      jobId,
      "dump",
      format,
      description,
      "pending",
      now,
      now
    )
    .run();

  return {
    events: [
      makeEvent("SerdesDumpDbRequested", command.tenant_id, jobId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        job_id: jobId,
        format,
        requested_at: now,
        executed_at: now
      })
    ],
    finalizeJob: false
  };
}

async function handleLoadBackupRequested(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const jobId = readString(payload, "job_id") || command.command_id;
  const format = readString(payload, "format") || "json";
  const r2Key = readString(payload, "r2_key");
  const description = readString(payload, "description");

  // Create a restore job record
  await env.APP_D1_MAIN.prepare(
    `INSERT INTO serdes_jobs (
       tenant_id, id, job_type, format, r2_key, description, status,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       job_type = excluded.job_type,
       format = excluded.format,
       r2_key = excluded.r2_key,
       description = excluded.description,
       status = excluded.status,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      jobId,
      "restore",
      format,
      r2Key,
      description,
      "pending",
      now,
      now
    )
    .run();

  return {
    events: [
      makeEvent("SerdesLoadBackupRequested", command.tenant_id, jobId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        job_id: jobId,
        format,
        r2_key: r2Key,
        requested_at: now,
        executed_at: now
      })
    ],
    finalizeJob: false
  };
}

// ---------------------------------------------------------------------------
// Public command dispatcher
// ---------------------------------------------------------------------------

export async function handleOrganizationCommand(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  switch (command.command_type) {
    case "org.unit.upsert":
      return handleOrgUnitUpsert(command, env);

    case "vp.questionnaire-response.submit":
      return handleQuestionnaireResponseSubmit(command, env);

    case "vp.evidence-submission.upload":
      return handleEvidenceSubmissionUpload(command, env);

    case "serdes.dump-db.requested":
      return handleDumpDbRequested(command, env);

    case "serdes.load-backup.requested":
      return handleLoadBackupRequested(command, env);

    default:
      throw new Error(`Unsupported organization command type: ${command.command_type}`);
  }
}
