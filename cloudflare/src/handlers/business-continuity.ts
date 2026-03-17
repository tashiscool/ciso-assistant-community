/**
 * Business Continuity command handler.
 *
 * Handles CQRS commands for BC plans, audits, and tasks.
 * This module is designed to be imported by command-worker.ts for dispatching
 * bc.* command types.
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

async function refreshBcPlanStatusProjection(
  db: D1Database,
  tenantId: string,
  planId: string,
  now: string
): Promise<void> {
  // Fetch current plan metadata
  const plan = await db
    .prepare(
      `SELECT name, status, scope, rto_hours, rpo_hours, last_tested, next_test_date
       FROM bc_plans
       WHERE tenant_id = ? AND entity_id = ?
       LIMIT 1`
    )
    .bind(tenantId, planId)
    .first<Record<string, unknown>>();

  if (!plan) {
    return;
  }

  // Count audits for this plan
  const auditCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM bc_audits
       WHERE tenant_id = ? AND plan_id = ?`
    )
    .bind(tenantId, planId)
    .first<{ cnt: number }>();

  // Count total tasks for this plan
  const taskCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM bc_tasks
       WHERE tenant_id = ? AND plan_id = ?`
    )
    .bind(tenantId, planId)
    .first<{ cnt: number }>();

  // Count completed tasks for this plan
  const completedTaskCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM bc_tasks
       WHERE tenant_id = ? AND plan_id = ? AND status = 'completed'`
    )
    .bind(tenantId, planId)
    .first<{ cnt: number }>();

  // Count overdue tasks for this plan
  const overdueTaskCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM bc_tasks
       WHERE tenant_id = ? AND plan_id = ? AND status != 'completed'
         AND due_date IS NOT NULL AND due_date < ?`
    )
    .bind(tenantId, planId, now)
    .first<{ cnt: number }>();

  await db
    .prepare(
      `INSERT INTO rm_bc_plan_status (
         tenant_id, plan_id, name, status, scope,
         rto_hours, rpo_hours, last_tested, next_test_date,
         total_audits, total_tasks, completed_tasks, overdue_tasks,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, plan_id)
       DO UPDATE SET
         name = excluded.name,
         status = excluded.status,
         scope = excluded.scope,
         rto_hours = excluded.rto_hours,
         rpo_hours = excluded.rpo_hours,
         last_tested = excluded.last_tested,
         next_test_date = excluded.next_test_date,
         total_audits = excluded.total_audits,
         total_tasks = excluded.total_tasks,
         completed_tasks = excluded.completed_tasks,
         overdue_tasks = excluded.overdue_tasks,
         updated_at = excluded.updated_at`
    )
    .bind(
      tenantId,
      planId,
      readString(plan, "name"),
      readString(plan, "status") || "draft",
      readString(plan, "scope"),
      readNumber(plan, "rto_hours"),
      readNumber(plan, "rpo_hours"),
      readString(plan, "last_tested") || null,
      readString(plan, "next_test_date") || null,
      auditCount?.cnt ?? 0,
      taskCount?.cnt ?? 0,
      completedTaskCount?.cnt ?? 0,
      overdueTaskCount?.cnt ?? 0,
      now
    )
    .run();
}

// ---------------------------------------------------------------------------
// Individual command handlers
// ---------------------------------------------------------------------------

async function handlePlanUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "draft";
  const scope = readString(payload, "scope");
  const rtoHours = readNumber(payload, "rto_hours");
  const rpoHours = readNumber(payload, "rpo_hours");
  const lastTested = readOptionalString(payload, "last_tested");
  const nextTestDate = readOptionalString(payload, "next_test_date");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO bc_plans (
       tenant_id, entity_id, name, description, status, scope,
       rto_hours, rpo_hours, last_tested, next_test_date,
       folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       scope = excluded.scope,
       rto_hours = excluded.rto_hours,
       rpo_hours = excluded.rpo_hours,
       last_tested = excluded.last_tested,
       next_test_date = excluded.next_test_date,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      status,
      scope,
      rtoHours,
      rpoHours,
      lastTested,
      nextTestDate,
      folderId,
      now,
      now
    )
    .run();

  await refreshBcPlanStatusProjection(env.APP_D1_MAIN, command.tenant_id, entityId, now);

  return {
    events: [
      makeEvent("BcPlanUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        status,
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
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "planned";
  const planId = readString(payload, "plan_id");
  const auditDate = readOptionalString(payload, "audit_date");
  const findings = readArray(payload, "findings");
  const folderId = readOptionalString(payload, "folder_id");

  if (!planId) {
    throw new Error("bc.audit.upsert requires payload.plan_id");
  }

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO bc_audits (
       tenant_id, entity_id, name, description, status,
       plan_id, audit_date, findings_json,
       folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       plan_id = excluded.plan_id,
       audit_date = excluded.audit_date,
       findings_json = excluded.findings_json,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      status,
      planId,
      auditDate,
      JSON.stringify(findings),
      folderId,
      now,
      now
    )
    .run();

  await refreshBcPlanStatusProjection(env.APP_D1_MAIN, command.tenant_id, planId, now);

  return {
    events: [
      makeEvent("BcAuditUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        status,
        plan_id: planId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleTaskUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "pending";
  const planId = readString(payload, "plan_id");
  const assigneeId = readOptionalString(payload, "assignee_id");
  const priority = readString(payload, "priority") || "medium";
  const dueDate = readOptionalString(payload, "due_date");
  const folderId = readOptionalString(payload, "folder_id");

  if (!planId) {
    throw new Error("bc.task.upsert requires payload.plan_id");
  }

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO bc_tasks (
       tenant_id, entity_id, name, description, status,
       plan_id, assignee_id, priority, due_date,
       folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       plan_id = excluded.plan_id,
       assignee_id = excluded.assignee_id,
       priority = excluded.priority,
       due_date = excluded.due_date,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      status,
      planId,
      assigneeId,
      priority,
      dueDate,
      folderId,
      now,
      now
    )
    .run();

  await refreshBcPlanStatusProjection(env.APP_D1_MAIN, command.tenant_id, planId, now);

  return {
    events: [
      makeEvent("BcTaskUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        status,
        plan_id: planId,
        priority,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleTaskComplete(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id");

  if (!entityId) {
    throw new Error("bc.task.complete requires payload.id");
  }

  // Verify the task exists and fetch its plan_id
  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT plan_id, status
     FROM bc_tasks
     WHERE tenant_id = ? AND entity_id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, entityId)
    .first<{ plan_id: string; status: string }>();

  if (!existing) {
    throw new Error(`Task '${entityId}' not found for tenant '${command.tenant_id}'`);
  }

  if (existing.status === "completed") {
    // Already completed; emit event but skip DB write
    return {
      events: [
        makeEvent("BcTaskCompleted", command.tenant_id, entityId, {
          command_id: command.command_id,
          command_type: command.command_type,
          tenant_id: command.tenant_id,
          id: entityId,
          plan_id: existing.plan_id,
          previous_status: existing.status,
          executed_at: now
        })
      ],
      finalizeJob: true
    };
  }

  await env.APP_D1_MAIN.prepare(
    `UPDATE bc_tasks
     SET status = 'completed', completed_at = ?, updated_at = ?
     WHERE tenant_id = ? AND entity_id = ?`
  )
    .bind(now, now, command.tenant_id, entityId)
    .run();

  await refreshBcPlanStatusProjection(env.APP_D1_MAIN, command.tenant_id, existing.plan_id, now);

  return {
    events: [
      makeEvent("BcTaskCompleted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        plan_id: existing.plan_id,
        previous_status: existing.status,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// ---------------------------------------------------------------------------
// Public command dispatcher
// ---------------------------------------------------------------------------

export async function handleBusinessContinuityCommand(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  switch (command.command_type) {
    case "bc.plan.upsert":
      return handlePlanUpsert(command, env);

    case "bc.audit.upsert":
      return handleAuditUpsert(command, env);

    case "bc.task.upsert":
      return handleTaskUpsert(command, env);

    case "bc.task.complete":
      return handleTaskComplete(command, env);

    default:
      throw new Error(`Unsupported business continuity command type: ${command.command_type}`);
  }
}
