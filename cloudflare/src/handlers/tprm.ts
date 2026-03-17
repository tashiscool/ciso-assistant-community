/**
 * TPRM (Third-Party Risk Management) command handler.
 *
 * Handles CQRS commands for entities, entity assessments, solutions,
 * representatives, and contracts.
 * This module is designed to be imported by command-worker.ts for dispatching
 * tprm.* command types.
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

async function refreshTprmOverviewProjection(
  db: D1Database,
  tenantId: string,
  entityId: string,
  now: string
): Promise<void> {
  // Fetch entity metadata
  const entity = await db
    .prepare(
      `SELECT name, folder_id
       FROM tprm_entities
       WHERE id = ? AND folder_id IN (
         SELECT folder_id FROM tprm_entities WHERE id = ?
       )
       LIMIT 1`
    )
    .bind(entityId, entityId)
    .first<Record<string, unknown>>();

  if (!entity) {
    return;
  }

  // Count assessments for this entity
  const assessmentCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM tprm_entity_assessments
       WHERE entity_id = ?`
    )
    .bind(entityId)
    .first<{ cnt: number }>();

  // Compute aggregate risk level from assessment conclusions
  const riskRow = await db
    .prepare(
      `SELECT conclusion
       FROM tprm_entity_assessments
       WHERE entity_id = ?
       ORDER BY due_date DESC
       LIMIT 1`
    )
    .bind(entityId)
    .first<{ conclusion: string }>();

  const riskLevel = riskRow?.conclusion || "unknown";

  // Determine overall status from the most recent assessment
  const statusRow = await db
    .prepare(
      `SELECT status
       FROM tprm_entity_assessments
       WHERE entity_id = ?
       ORDER BY due_date DESC
       LIMIT 1`
    )
    .bind(entityId)
    .first<{ status: string }>();

  const status = statusRow?.status || "not_assessed";

  await db
    .prepare(
      `INSERT INTO rm_tprm_overview (
         tenant_id, entity_id, name, status, assessment_count,
         risk_level, folder_id, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, entity_id)
       DO UPDATE SET
         name = excluded.name,
         status = excluded.status,
         assessment_count = excluded.assessment_count,
         risk_level = excluded.risk_level,
         folder_id = excluded.folder_id,
         updated_at = excluded.updated_at`
    )
    .bind(
      tenantId,
      entityId,
      readString(entity, "name"),
      status,
      assessmentCount?.cnt ?? 0,
      riskLevel,
      readString(entity, "folder_id"),
      now
    )
    .run();
}

// ---------------------------------------------------------------------------
// Individual command handlers
// ---------------------------------------------------------------------------

async function handleEntityUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const mission = readString(payload, "mission");
  const referenceLink = readString(payload, "reference_link");
  const businessContactInfo = isRecord(payload.business_contact_info_json)
    ? payload.business_contact_info_json
    : {};
  const ownedFolders = isRecord(payload.owned_folders_json)
    ? payload.owned_folders_json
    : {};
  const folderId = readString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO tprm_entities (
       id, name, description, mission, reference_link,
       business_contact_info_json, owned_folders_json, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       mission = excluded.mission,
       reference_link = excluded.reference_link,
       business_contact_info_json = excluded.business_contact_info_json,
       owned_folders_json = excluded.owned_folders_json,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      id,
      name,
      description,
      mission,
      referenceLink,
      JSON.stringify(businessContactInfo),
      JSON.stringify(ownedFolders),
      folderId,
      now,
      now
    )
    .run();

  await refreshTprmOverviewProjection(env.APP_D1_MAIN, command.tenant_id, id, now);

  return {
    events: [
      makeEvent("TprmEntityUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        folder_id: folderId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleEntityAssessmentUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const projectId = readString(payload, "project_id");
  const entityId = readString(payload, "entity_id");
  const status = readString(payload, "status") || "planned";
  const eta = readOptionalString(payload, "eta");
  const dueDate = readOptionalString(payload, "due_date");
  const conclusion = readString(payload, "conclusion");
  const folderId = readString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO tprm_entity_assessments (
       id, name, description, project_id, entity_id, status,
       eta, due_date, conclusion, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       project_id = excluded.project_id,
       entity_id = excluded.entity_id,
       status = excluded.status,
       eta = excluded.eta,
       due_date = excluded.due_date,
       conclusion = excluded.conclusion,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      id,
      name,
      description,
      projectId,
      entityId,
      status,
      eta,
      dueDate,
      conclusion,
      folderId,
      now,
      now
    )
    .run();

  await refreshTprmOverviewProjection(env.APP_D1_MAIN, command.tenant_id, entityId, now);

  return {
    events: [
      makeEvent("TprmEntityAssessmentUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        assessment_id: id,
        entity_id: entityId,
        name,
        status,
        conclusion,
        folder_id: folderId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleSolutionUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const providerEntityId = readString(payload, "provider_entity_id");
  const refId = readString(payload, "ref_id");
  const status = readString(payload, "status") || "active";
  const folderId = readString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO tprm_solutions (
       id, name, description, provider_entity_id, ref_id, status, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       provider_entity_id = excluded.provider_entity_id,
       ref_id = excluded.ref_id,
       status = excluded.status,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      id,
      name,
      description,
      providerEntityId,
      refId,
      status,
      folderId,
      now,
      now
    )
    .run();

  await refreshTprmOverviewProjection(env.APP_D1_MAIN, command.tenant_id, providerEntityId, now);

  return {
    events: [
      makeEvent("TprmSolutionUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        solution_id: id,
        provider_entity_id: providerEntityId,
        name,
        status,
        folder_id: folderId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleRepresentativeUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const email = readString(payload, "email");
  const firstName = readString(payload, "first_name");
  const lastName = readString(payload, "last_name");
  const phone = readString(payload, "phone");
  const role = readString(payload, "role");
  const description = readString(payload, "description");
  const entityId = readString(payload, "entity_id");
  const folderId = readString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO tprm_representatives (
       id, email, first_name, last_name, phone, role, description,
       entity_id, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id)
     DO UPDATE SET
       email = excluded.email,
       first_name = excluded.first_name,
       last_name = excluded.last_name,
       phone = excluded.phone,
       role = excluded.role,
       description = excluded.description,
       entity_id = excluded.entity_id,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      id,
      email,
      firstName,
      lastName,
      phone,
      role,
      description,
      entityId,
      folderId,
      now,
      now
    )
    .run();

  await refreshTprmOverviewProjection(env.APP_D1_MAIN, command.tenant_id, entityId, now);

  return {
    events: [
      makeEvent("TprmRepresentativeUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        representative_id: id,
        entity_id: entityId,
        email,
        role,
        folder_id: folderId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleContractUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const contractType = readString(payload, "contract_type");
  const startDate = readOptionalString(payload, "start_date");
  const endDate = readOptionalString(payload, "end_date");
  const entityId = readString(payload, "entity_id");
  const folderId = readString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO tprm_contracts (
       id, name, description, contract_type, start_date, end_date,
       entity_id, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       contract_type = excluded.contract_type,
       start_date = excluded.start_date,
       end_date = excluded.end_date,
       entity_id = excluded.entity_id,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      id,
      name,
      description,
      contractType,
      startDate,
      endDate,
      entityId,
      folderId,
      now,
      now
    )
    .run();

  await refreshTprmOverviewProjection(env.APP_D1_MAIN, command.tenant_id, entityId, now);

  return {
    events: [
      makeEvent("TprmContractUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        contract_id: id,
        entity_id: entityId,
        name,
        contract_type: contractType,
        folder_id: folderId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// ---------------------------------------------------------------------------
// Public command dispatcher
// ---------------------------------------------------------------------------

export async function handleTprmCommand(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  switch (command.command_type) {
    case "tprm.entity.upsert":
      return handleEntityUpsert(command, env);

    case "tprm.entity-assessment.upsert":
      return handleEntityAssessmentUpsert(command, env);

    case "tprm.solution.upsert":
      return handleSolutionUpsert(command, env);

    case "tprm.representative.upsert":
      return handleRepresentativeUpsert(command, env);

    case "tprm.contract.upsert":
      return handleContractUpsert(command, env);

    default:
      throw new Error(`Unsupported TPRM command type: ${command.command_type}`);
  }
}
