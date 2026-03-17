/**
 * Control Library command handler.
 *
 * Handles CQRS commands for controls, implementations, policies, policy
 * acknowledgments, and evidence items. This module is designed to be imported
 * by command-worker.ts for dispatching ctllib.* command types.
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

async function refreshControlLibraryIndex(
  db: D1Database,
  tenantId: string,
  now: string
): Promise<void> {
  const controlCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM ctllib_controls WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const implementationCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM ctllib_implementations WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const policyCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM ctllib_policies WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const ackCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM ctllib_policy_acks WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const evidenceCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM ctllib_evidence_items WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  // Aggregate control categories breakdown
  const categoryRows = await db
    .prepare(
      `SELECT category, COUNT(*) AS cnt
       FROM ctllib_controls
       WHERE tenant_id = ?
       GROUP BY category`
    )
    .bind(tenantId)
    .all<{ category: string; cnt: number }>();

  const categoryBreakdown: Record<string, number> = {};
  for (const row of categoryRows.results ?? []) {
    categoryBreakdown[row.category] = row.cnt;
  }

  // Aggregate implementation status breakdown
  const implStatusRows = await db
    .prepare(
      `SELECT status, COUNT(*) AS cnt
       FROM ctllib_implementations
       WHERE tenant_id = ?
       GROUP BY status`
    )
    .bind(tenantId)
    .all<{ status: string; cnt: number }>();

  const implStatusBreakdown: Record<string, number> = {};
  for (const row of implStatusRows.results ?? []) {
    implStatusBreakdown[row.status] = row.cnt;
  }

  await db
    .prepare(
      `INSERT INTO rm_control_library_index (
         tenant_id, total_controls, total_implementations, total_policies,
         total_acks, total_evidence_items, category_breakdown_json,
         impl_status_breakdown_json, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id)
       DO UPDATE SET
         total_controls = excluded.total_controls,
         total_implementations = excluded.total_implementations,
         total_policies = excluded.total_policies,
         total_acks = excluded.total_acks,
         total_evidence_items = excluded.total_evidence_items,
         category_breakdown_json = excluded.category_breakdown_json,
         impl_status_breakdown_json = excluded.impl_status_breakdown_json,
         updated_at = excluded.updated_at`
    )
    .bind(
      tenantId,
      controlCount?.cnt ?? 0,
      implementationCount?.cnt ?? 0,
      policyCount?.cnt ?? 0,
      ackCount?.cnt ?? 0,
      evidenceCount?.cnt ?? 0,
      JSON.stringify(categoryBreakdown),
      JSON.stringify(implStatusBreakdown),
      now
    )
    .run();
}

// ---------------------------------------------------------------------------
// Individual command handlers
// ---------------------------------------------------------------------------

async function handleControlUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const refId = readString(payload, "ref_id");
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const category = readString(payload, "category");
  const csfFunction = readString(payload, "csf_function");
  const status = readString(payload, "status") || "active";
  const libraryId = readOptionalString(payload, "library_id");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO ctllib_controls (
       tenant_id, entity_id, ref_id, name, description, category,
       csf_function, status, library_id, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       ref_id = excluded.ref_id,
       name = excluded.name,
       description = excluded.description,
       category = excluded.category,
       csf_function = excluded.csf_function,
       status = excluded.status,
       library_id = excluded.library_id,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      refId,
      name,
      description,
      category,
      csfFunction,
      status,
      libraryId,
      folderId,
      now,
      now
    )
    .run();

  await refreshControlLibraryIndex(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("ControlLibraryControlUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        ref_id: refId,
        name,
        category,
        csf_function: csfFunction,
        status,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleImplementationUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const controlId = readString(payload, "control_id");
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "planned";
  const evidenceJson = Array.isArray(payload.evidence_json)
    ? JSON.stringify(payload.evidence_json)
    : readString(payload, "evidence_json") || "[]";
  const folderId = readOptionalString(payload, "folder_id");

  if (!controlId) {
    throw new Error("ctllib.implementation.upsert requires payload.control_id");
  }

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO ctllib_implementations (
       tenant_id, entity_id, control_id, name, description, status,
       evidence_json, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       control_id = excluded.control_id,
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       evidence_json = excluded.evidence_json,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      controlId,
      name,
      description,
      status,
      evidenceJson,
      folderId,
      now,
      now
    )
    .run();

  await refreshControlLibraryIndex(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("ControlLibraryImplementationUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        control_id: controlId,
        name,
        status,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handlePolicyUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "draft";
  const policyType = readString(payload, "policy_type");
  const version = readString(payload, "version");
  const effectiveDate = readOptionalString(payload, "effective_date");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO ctllib_policies (
       tenant_id, entity_id, name, description, status, policy_type,
       version, effective_date, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       policy_type = excluded.policy_type,
       version = excluded.version,
       effective_date = excluded.effective_date,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      status,
      policyType,
      version,
      effectiveDate,
      folderId,
      now,
      now
    )
    .run();

  await refreshControlLibraryIndex(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("ControlLibraryPolicyUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        status,
        policy_type: policyType,
        version,
        effective_date: effectiveDate,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handlePolicyAckRecord(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const policyId = readString(payload, "policy_id");
  const userId = readString(payload, "user_id");
  const acknowledgedAt = readOptionalString(payload, "acknowledged_at") || now;
  const folderId = readOptionalString(payload, "folder_id");

  if (!policyId) {
    throw new Error("ctllib.policy-ack.record requires payload.policy_id");
  }

  if (!userId) {
    throw new Error("ctllib.policy-ack.record requires payload.user_id");
  }

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO ctllib_policy_acks (
       tenant_id, entity_id, policy_id, user_id, acknowledged_at,
       folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       policy_id = excluded.policy_id,
       user_id = excluded.user_id,
       acknowledged_at = excluded.acknowledged_at,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      policyId,
      userId,
      acknowledgedAt,
      folderId,
      now,
      now
    )
    .run();

  await refreshControlLibraryIndex(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("ControlLibraryPolicyAckRecorded", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        policy_id: policyId,
        user_id: userId,
        acknowledged_at: acknowledgedAt,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleEvidenceItemUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const evidenceType = readString(payload, "evidence_type");
  const status = readString(payload, "status") || "draft";
  const r2Key = readOptionalString(payload, "r2_key");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO ctllib_evidence_items (
       tenant_id, entity_id, name, description, evidence_type, status,
       r2_key, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       evidence_type = excluded.evidence_type,
       status = excluded.status,
       r2_key = excluded.r2_key,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      evidenceType,
      status,
      r2Key,
      folderId,
      now,
      now
    )
    .run();

  await refreshControlLibraryIndex(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("ControlLibraryEvidenceItemUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        evidence_type: evidenceType,
        status,
        r2_key: r2Key,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// ---------------------------------------------------------------------------
// Public command dispatcher
// ---------------------------------------------------------------------------

export async function handleControlLibraryCommand(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  switch (command.command_type) {
    case "ctllib.control.upsert":
      return handleControlUpsert(command, env);

    case "ctllib.implementation.upsert":
      return handleImplementationUpsert(command, env);

    case "ctllib.policy.upsert":
      return handlePolicyUpsert(command, env);

    case "ctllib.policy-ack.record":
      return handlePolicyAckRecord(command, env);

    case "ctllib.evidence-item.upsert":
      return handleEvidenceItemUpsert(command, env);

    default:
      throw new Error(`Unsupported control library command type: ${command.command_type}`);
  }
}
