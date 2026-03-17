/**
 * Governance / Assessment Workflow command handler.
 *
 * Handles CQRS commands for control originations, responsibility matrices,
 * responsibility assignments, assessment plans, attestations, and authorization
 * timelines. This module is designed to be imported by command-worker.ts for
 * dispatching gov.* command types.
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

async function refreshGovernanceOverview(
  db: D1Database,
  tenantId: string,
  now: string
): Promise<void> {
  const originationCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM gov_control_originations WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const matrixCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM gov_responsibility_matrices WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const assignmentCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM gov_responsibility_assignments WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const planCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM gov_assessment_plans WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const approvedPlans = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM gov_assessment_plans
       WHERE tenant_id = ? AND status = 'approved'`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const attestationCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM gov_attestations WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const activeAttestations = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM gov_attestations
       WHERE tenant_id = ? AND status = 'approved'`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const timelineCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM gov_authorization_timelines WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  await db
    .prepare(
      `INSERT INTO rm_governance_overview (
         tenant_id, total_originations, total_matrices, total_assignments,
         total_plans, approved_plans, total_attestations, active_attestations,
         total_timelines, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id)
       DO UPDATE SET
         total_originations = excluded.total_originations,
         total_matrices = excluded.total_matrices,
         total_assignments = excluded.total_assignments,
         total_plans = excluded.total_plans,
         approved_plans = excluded.approved_plans,
         total_attestations = excluded.total_attestations,
         active_attestations = excluded.active_attestations,
         total_timelines = excluded.total_timelines,
         updated_at = excluded.updated_at`
    )
    .bind(
      tenantId,
      originationCount?.cnt ?? 0,
      matrixCount?.cnt ?? 0,
      assignmentCount?.cnt ?? 0,
      planCount?.cnt ?? 0,
      approvedPlans?.cnt ?? 0,
      attestationCount?.cnt ?? 0,
      activeAttestations?.cnt ?? 0,
      timelineCount?.cnt ?? 0,
      now
    )
    .run();
}

// ---------------------------------------------------------------------------
// Individual command handlers
// ---------------------------------------------------------------------------

async function handleControlOriginationUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const controlId = readOptionalString(payload, "control_id");
  const originationType = readString(payload, "origination_type");
  const providerId = readOptionalString(payload, "provider_id");
  const status = readString(payload, "status") || "active";
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO gov_control_originations (
       tenant_id, entity_id, name, description, control_id,
       origination_type, provider_id, status, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       control_id = excluded.control_id,
       origination_type = excluded.origination_type,
       provider_id = excluded.provider_id,
       status = excluded.status,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      controlId,
      originationType,
      providerId,
      status,
      folderId,
      now,
      now
    )
    .run();

  await refreshGovernanceOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GovernanceControlOriginationUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        origination_type: originationType,
        status,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleResponsibilityMatrixUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const frameworkId = readOptionalString(payload, "framework_id");
  const status = readString(payload, "status") || "draft";
  const matrixJson = isRecord(payload.matrix_json) || Array.isArray(payload.matrix_json)
    ? JSON.stringify(payload.matrix_json)
    : readString(payload, "matrix_json") || "{}";
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO gov_responsibility_matrices (
       tenant_id, entity_id, name, description, framework_id, status,
       matrix_json, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       framework_id = excluded.framework_id,
       status = excluded.status,
       matrix_json = excluded.matrix_json,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      frameworkId,
      status,
      matrixJson,
      folderId,
      now,
      now
    )
    .run();

  await refreshGovernanceOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GovernanceResponsibilityMatrixUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        framework_id: frameworkId,
        status,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleResponsibilityAssignmentUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const matrixId = readOptionalString(payload, "matrix_id");
  const controlId = readOptionalString(payload, "control_id");
  const role = readString(payload, "role");
  const assigneeId = readOptionalString(payload, "assignee_id");
  const status = readString(payload, "status") || "active";
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO gov_responsibility_assignments (
       tenant_id, entity_id, name, description, matrix_id, control_id,
       role, assignee_id, status, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       matrix_id = excluded.matrix_id,
       control_id = excluded.control_id,
       role = excluded.role,
       assignee_id = excluded.assignee_id,
       status = excluded.status,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      matrixId,
      controlId,
      role,
      assigneeId,
      status,
      folderId,
      now,
      now
    )
    .run();

  await refreshGovernanceOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GovernanceResponsibilityAssignmentUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        matrix_id: matrixId,
        control_id: controlId,
        role,
        assignee_id: assigneeId,
        status,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleAssessmentPlanUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "draft";
  const frameworkId = readOptionalString(payload, "framework_id");
  const scope = readString(payload, "scope");
  const assessorId = readOptionalString(payload, "assessor_id");
  const plannedDate = readOptionalString(payload, "planned_date");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO gov_assessment_plans (
       tenant_id, entity_id, name, description, status, framework_id,
       scope, assessor_id, planned_date, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       framework_id = excluded.framework_id,
       scope = excluded.scope,
       assessor_id = excluded.assessor_id,
       planned_date = excluded.planned_date,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      status,
      frameworkId,
      scope,
      assessorId,
      plannedDate,
      folderId,
      now,
      now
    )
    .run();

  await refreshGovernanceOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GovernanceAssessmentPlanUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        status,
        framework_id: frameworkId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleAssessmentPlanApprove(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id");

  if (!id) {
    throw new Error("gov.assessment-plan.approve requires payload.id");
  }

  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT entity_id, status, name
     FROM gov_assessment_plans
     WHERE tenant_id = ? AND entity_id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, id)
    .first<{ entity_id: string; status: string; name: string }>();

  if (!existing) {
    throw new Error(`Assessment plan '${id}' not found for tenant '${command.tenant_id}'`);
  }

  await env.APP_D1_MAIN.prepare(
    `UPDATE gov_assessment_plans
     SET status = 'approved', approved_at = ?, updated_at = ?
     WHERE tenant_id = ? AND entity_id = ?`
  )
    .bind(now, now, command.tenant_id, id)
    .run();

  await refreshGovernanceOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GovernanceAssessmentPlanApproved", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name: existing.name,
        previous_status: existing.status,
        approved_at: now,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleAttestationUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "draft";
  const controlId = readOptionalString(payload, "control_id");
  const attesterId = readOptionalString(payload, "attester_id");
  const attestationType = readString(payload, "attestation_type");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO gov_attestations (
       tenant_id, entity_id, name, description, status, control_id,
       attester_id, attestation_type, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       control_id = excluded.control_id,
       attester_id = excluded.attester_id,
       attestation_type = excluded.attestation_type,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      status,
      controlId,
      attesterId,
      attestationType,
      folderId,
      now,
      now
    )
    .run();

  await refreshGovernanceOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GovernanceAttestationUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        status,
        attestation_type: attestationType,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleAttestationApprove(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id");

  if (!id) {
    throw new Error("gov.attestation.approve requires payload.id");
  }

  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT entity_id, status, name
     FROM gov_attestations
     WHERE tenant_id = ? AND entity_id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, id)
    .first<{ entity_id: string; status: string; name: string }>();

  if (!existing) {
    throw new Error(`Attestation '${id}' not found for tenant '${command.tenant_id}'`);
  }

  await env.APP_D1_MAIN.prepare(
    `UPDATE gov_attestations
     SET status = 'approved', attested_at = ?, updated_at = ?
     WHERE tenant_id = ? AND entity_id = ?`
  )
    .bind(now, now, command.tenant_id, id)
    .run();

  await refreshGovernanceOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GovernanceAttestationApproved", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name: existing.name,
        previous_status: existing.status,
        attested_at: now,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleAttestationRevoke(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id");

  if (!id) {
    throw new Error("gov.attestation.revoke requires payload.id");
  }

  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT entity_id, status, name
     FROM gov_attestations
     WHERE tenant_id = ? AND entity_id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, id)
    .first<{ entity_id: string; status: string; name: string }>();

  if (!existing) {
    throw new Error(`Attestation '${id}' not found for tenant '${command.tenant_id}'`);
  }

  await env.APP_D1_MAIN.prepare(
    `UPDATE gov_attestations
     SET status = 'revoked', revoked_at = ?, updated_at = ?
     WHERE tenant_id = ? AND entity_id = ?`
  )
    .bind(now, now, command.tenant_id, id)
    .run();

  await refreshGovernanceOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GovernanceAttestationRevoked", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name: existing.name,
        previous_status: existing.status,
        revoked_at: now,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleAuthorizationTimelineUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "planning";
  const systemId = readOptionalString(payload, "system_id");
  const authorizationType = readString(payload, "authorization_type");
  const targetDate = readOptionalString(payload, "target_date");
  const milestonesJson = Array.isArray(payload.milestones_json)
    ? JSON.stringify(payload.milestones_json)
    : readString(payload, "milestones_json") || "[]";
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO gov_authorization_timelines (
       tenant_id, entity_id, name, description, status, system_id,
       authorization_type, target_date, milestones_json, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       system_id = excluded.system_id,
       authorization_type = excluded.authorization_type,
       target_date = excluded.target_date,
       milestones_json = excluded.milestones_json,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      status,
      systemId,
      authorizationType,
      targetDate,
      milestonesJson,
      folderId,
      now,
      now
    )
    .run();

  await refreshGovernanceOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GovernanceAuthorizationTimelineUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        status,
        authorization_type: authorizationType,
        target_date: targetDate,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleAuthorizationTimelineAdvance(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id");
  const status = readString(payload, "status");

  if (!id) {
    throw new Error("gov.authorization-timeline.advance requires payload.id");
  }

  if (!status) {
    throw new Error("gov.authorization-timeline.advance requires payload.status");
  }

  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT entity_id, status, name
     FROM gov_authorization_timelines
     WHERE tenant_id = ? AND entity_id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, id)
    .first<{ entity_id: string; status: string; name: string }>();

  if (!existing) {
    throw new Error(`Authorization timeline '${id}' not found for tenant '${command.tenant_id}'`);
  }

  await env.APP_D1_MAIN.prepare(
    `UPDATE gov_authorization_timelines
     SET status = ?, updated_at = ?
     WHERE tenant_id = ? AND entity_id = ?`
  )
    .bind(status, now, command.tenant_id, id)
    .run();

  await refreshGovernanceOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GovernanceAuthorizationTimelineAdvanced", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name: existing.name,
        previous_status: existing.status,
        new_status: status,
        advanced_at: now,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// ---------------------------------------------------------------------------
// Public command dispatcher
// ---------------------------------------------------------------------------

export async function handleGovernanceCommand(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  switch (command.command_type) {
    case "gov.control-origination.upsert":
      return handleControlOriginationUpsert(command, env);

    case "gov.responsibility-matrix.upsert":
      return handleResponsibilityMatrixUpsert(command, env);

    case "gov.responsibility-assignment.upsert":
      return handleResponsibilityAssignmentUpsert(command, env);

    case "gov.assessment-plan.upsert":
      return handleAssessmentPlanUpsert(command, env);

    case "gov.assessment-plan.approve":
      return handleAssessmentPlanApprove(command, env);

    case "gov.attestation.upsert":
      return handleAttestationUpsert(command, env);

    case "gov.attestation.approve":
      return handleAttestationApprove(command, env);

    case "gov.attestation.revoke":
      return handleAttestationRevoke(command, env);

    case "gov.authorization-timeline.upsert":
      return handleAuthorizationTimelineUpsert(command, env);

    case "gov.authorization-timeline.advance":
      return handleAuthorizationTimelineAdvance(command, env);

    default:
      throw new Error(`Unsupported governance command type: ${command.command_type}`);
  }
}
