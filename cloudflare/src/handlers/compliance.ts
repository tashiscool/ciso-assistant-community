/**
 * Compliance command handler.
 *
 * Handles CQRS commands for compliance online assessments, assessment runs,
 * audits, findings, and exceptions. This module is designed to be imported
 * by command-worker.ts for dispatching compliance.* command types.
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

async function refreshComplianceOverview(
  db: D1Database,
  tenantId: string,
  now: string
): Promise<void> {
  const assessmentCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM compliance_online_assessments WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const activeRuns = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM compliance_assessment_runs
       WHERE tenant_id = ? AND status = 'running'`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const completedRuns = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM compliance_assessment_runs
       WHERE tenant_id = ? AND status = 'completed'`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const auditCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM compliance_audit_records WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const openFindings = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM compliance_findings
       WHERE tenant_id = ? AND status != 'closed'`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const activeExceptions = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM compliance_exceptions
       WHERE tenant_id = ? AND status = 'approved'`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  await db
    .prepare(
      `INSERT INTO rm_compliance_overview (
         tenant_id, total_assessments, active_runs, completed_runs,
         total_audits, open_findings, active_exceptions, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id)
       DO UPDATE SET
         total_assessments = excluded.total_assessments,
         active_runs = excluded.active_runs,
         completed_runs = excluded.completed_runs,
         total_audits = excluded.total_audits,
         open_findings = excluded.open_findings,
         active_exceptions = excluded.active_exceptions,
         updated_at = excluded.updated_at`
    )
    .bind(
      tenantId,
      assessmentCount?.cnt ?? 0,
      activeRuns?.cnt ?? 0,
      completedRuns?.cnt ?? 0,
      auditCount?.cnt ?? 0,
      openFindings?.cnt ?? 0,
      activeExceptions?.cnt ?? 0,
      now
    )
    .run();
}

// ---------------------------------------------------------------------------
// Individual command handlers
// ---------------------------------------------------------------------------

async function handleOnlineAssessmentUpsert(
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
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO compliance_online_assessments (
       tenant_id, entity_id, name, description, status, framework_id,
       scope, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       framework_id = excluded.framework_id,
       scope = excluded.scope,
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
      folderId,
      now,
      now
    )
    .run();

  await refreshComplianceOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("ComplianceOnlineAssessmentUpserted", command.tenant_id, id, {
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

async function handleAssessmentRunStart(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const assessmentId = readString(payload, "assessment_id");
  const name = readString(payload, "name");
  const folderId = readOptionalString(payload, "folder_id");

  if (!assessmentId) {
    throw new Error("compliance.assessment-run.start requires payload.assessment_id");
  }

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO compliance_assessment_runs (
       tenant_id, entity_id, assessment_id, name, status, started_at,
       folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, 'running', ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       assessment_id = excluded.assessment_id,
       name = excluded.name,
       status = 'running',
       started_at = excluded.started_at,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      assessmentId,
      name,
      now,
      folderId,
      now,
      now
    )
    .run();

  await refreshComplianceOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("ComplianceAssessmentRunStarted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        assessment_id: assessmentId,
        name,
        status: "running",
        started_at: now,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleAssessmentRunComplete(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id");
  const score = readNumber(payload, "score");

  if (!id) {
    throw new Error("compliance.assessment-run.complete requires payload.id");
  }

  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT entity_id, status, assessment_id
     FROM compliance_assessment_runs
     WHERE tenant_id = ? AND entity_id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, id)
    .first<{ entity_id: string; status: string; assessment_id: string }>();

  if (!existing) {
    throw new Error(`Assessment run '${id}' not found for tenant '${command.tenant_id}'`);
  }

  await env.APP_D1_MAIN.prepare(
    `UPDATE compliance_assessment_runs
     SET status = 'completed', completed_at = ?, score = ?, updated_at = ?
     WHERE tenant_id = ? AND entity_id = ?`
  )
    .bind(now, score, now, command.tenant_id, id)
    .run();

  await refreshComplianceOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("ComplianceAssessmentRunCompleted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        assessment_id: existing.assessment_id,
        previous_status: existing.status,
        score,
        completed_at: now,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleAuditUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "planned";
  const auditType = readString(payload, "audit_type");
  const auditorId = readOptionalString(payload, "auditor_id");
  const startDate = readOptionalString(payload, "start_date");
  const endDate = readOptionalString(payload, "end_date");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO compliance_audit_records (
       tenant_id, entity_id, name, description, status, audit_type,
       auditor_id, start_date, end_date, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       audit_type = excluded.audit_type,
       auditor_id = excluded.auditor_id,
       start_date = excluded.start_date,
       end_date = excluded.end_date,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      status,
      auditType,
      auditorId,
      startDate,
      endDate,
      folderId,
      now,
      now
    )
    .run();

  await refreshComplianceOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("ComplianceAuditUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        status,
        audit_type: auditType,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleFindingUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "open";
  const severity = readString(payload, "severity");
  const auditId = readOptionalString(payload, "audit_id");
  const controlId = readOptionalString(payload, "control_id");
  const remediation = readString(payload, "remediation");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO compliance_findings (
       tenant_id, entity_id, name, description, status, severity,
       audit_id, control_id, remediation, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       severity = excluded.severity,
       audit_id = excluded.audit_id,
       control_id = excluded.control_id,
       remediation = excluded.remediation,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      status,
      severity,
      auditId,
      controlId,
      remediation,
      folderId,
      now,
      now
    )
    .run();

  await refreshComplianceOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("ComplianceFindingUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        status,
        severity,
        audit_id: auditId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleExceptionUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "pending";
  const controlId = readOptionalString(payload, "control_id");
  const justification = readString(payload, "justification");
  const expirationDate = readOptionalString(payload, "expiration_date");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO compliance_exceptions (
       tenant_id, entity_id, name, description, status, control_id,
       justification, expiration_date, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       control_id = excluded.control_id,
       justification = excluded.justification,
       expiration_date = excluded.expiration_date,
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
      justification,
      expirationDate,
      folderId,
      now,
      now
    )
    .run();

  await refreshComplianceOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("ComplianceExceptionUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        status,
        control_id: controlId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleExceptionApprove(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id");
  const approverId = readString(payload, "approver_id") || readString(payload, "context_user_id");

  if (!id) {
    throw new Error("compliance.exception.approve requires payload.id");
  }

  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT entity_id, status, name
     FROM compliance_exceptions
     WHERE tenant_id = ? AND entity_id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, id)
    .first<{ entity_id: string; status: string; name: string }>();

  if (!existing) {
    throw new Error(`Compliance exception '${id}' not found for tenant '${command.tenant_id}'`);
  }

  await env.APP_D1_MAIN.prepare(
    `UPDATE compliance_exceptions
     SET status = 'approved', approver_id = ?, updated_at = ?
     WHERE tenant_id = ? AND entity_id = ?`
  )
    .bind(approverId, now, command.tenant_id, id)
    .run();

  await refreshComplianceOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("ComplianceExceptionApproved", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name: existing.name,
        previous_status: existing.status,
        approver_id: approverId,
        approved_at: now,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// ---------------------------------------------------------------------------
// Public command dispatcher
// ---------------------------------------------------------------------------

export async function handleComplianceCommand(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  switch (command.command_type) {
    case "compliance.online-assessment.upsert":
      return handleOnlineAssessmentUpsert(command, env);

    case "compliance.assessment-run.start":
      return handleAssessmentRunStart(command, env);

    case "compliance.assessment-run.complete":
      return handleAssessmentRunComplete(command, env);

    case "compliance.audit.upsert":
      return handleAuditUpsert(command, env);

    case "compliance.finding.upsert":
      return handleFindingUpsert(command, env);

    case "compliance.exception.upsert":
      return handleExceptionUpsert(command, env);

    case "compliance.exception.approve":
      return handleExceptionApprove(command, env);

    default:
      throw new Error(`Unsupported compliance command type: ${command.command_type}`);
  }
}
