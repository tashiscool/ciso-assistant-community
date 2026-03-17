/**
 * Workflow command handler.
 *
 * Handles CQRS commands for workflow templates, executions, schedules, and
 * assessment tasks. This module is designed to be imported by command-worker.ts
 * for dispatching wf.* command types.
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

async function refreshWorkflowOverview(
  db: D1Database,
  tenantId: string,
  now: string
): Promise<void> {
  const templateCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM wf_templates WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const activeExecutions = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM wf_executions
       WHERE tenant_id = ? AND status = 'running'`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const completedExecutions = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM wf_executions
       WHERE tenant_id = ? AND status = 'completed'`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const scheduleCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM wf_schedules WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const pendingTasks = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM wf_assessment_tasks
       WHERE tenant_id = ? AND status != 'completed'`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  await db
    .prepare(
      `INSERT INTO rm_workflow_overview (
         tenant_id, total_templates, active_executions, completed_executions,
         total_schedules, pending_tasks, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id)
       DO UPDATE SET
         total_templates = excluded.total_templates,
         active_executions = excluded.active_executions,
         completed_executions = excluded.completed_executions,
         total_schedules = excluded.total_schedules,
         pending_tasks = excluded.pending_tasks,
         updated_at = excluded.updated_at`
    )
    .bind(
      tenantId,
      templateCount?.cnt ?? 0,
      activeExecutions?.cnt ?? 0,
      completedExecutions?.cnt ?? 0,
      scheduleCount?.cnt ?? 0,
      pendingTasks?.cnt ?? 0,
      now
    )
    .run();
}

// ---------------------------------------------------------------------------
// Individual command handlers
// ---------------------------------------------------------------------------

async function handleTemplateUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "draft";
  const triggerType = readString(payload, "trigger_type");
  const stepsJson = isRecord(payload.steps_json) || Array.isArray(payload.steps_json)
    ? JSON.stringify(payload.steps_json)
    : readString(payload, "steps_json") || "[]";
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO wf_templates (
       tenant_id, entity_id, name, description, status, trigger_type,
       steps_json, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       trigger_type = excluded.trigger_type,
       steps_json = excluded.steps_json,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      status,
      triggerType,
      stepsJson,
      folderId,
      now,
      now
    )
    .run();

  await refreshWorkflowOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("WorkflowTemplateUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        status,
        trigger_type: triggerType,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleExecutionStart(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const templateId = readString(payload, "template_id");
  const name = readString(payload, "name");
  const folderId = readOptionalString(payload, "folder_id");

  if (!templateId) {
    throw new Error("wf.execution.start requires payload.template_id");
  }

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO wf_executions (
       tenant_id, entity_id, template_id, name, status, current_step,
       started_at, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, 'running', 0, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       template_id = excluded.template_id,
       name = excluded.name,
       status = 'running',
       current_step = 0,
       started_at = excluded.started_at,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      templateId,
      name,
      now,
      folderId,
      now,
      now
    )
    .run();

  await refreshWorkflowOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("WorkflowExecutionStarted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        template_id: templateId,
        name,
        status: "running",
        started_at: now,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleExecutionAdvance(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id");
  const currentStep = readNumber(payload, "current_step");
  const status = readString(payload, "status") || "running";

  if (!id) {
    throw new Error("wf.execution.advance requires payload.id");
  }

  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT entity_id, current_step, status
     FROM wf_executions
     WHERE tenant_id = ? AND entity_id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, id)
    .first<{ entity_id: string; current_step: number; status: string }>();

  if (!existing) {
    throw new Error(`Workflow execution '${id}' not found for tenant '${command.tenant_id}'`);
  }

  const nextStep = currentStep ?? (existing.current_step + 1);

  await env.APP_D1_MAIN.prepare(
    `UPDATE wf_executions
     SET current_step = ?, status = ?, updated_at = ?
     WHERE tenant_id = ? AND entity_id = ?`
  )
    .bind(nextStep, status, now, command.tenant_id, id)
    .run();

  await refreshWorkflowOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("WorkflowExecutionAdvanced", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        previous_step: existing.current_step,
        current_step: nextStep,
        status,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleExecutionComplete(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id");

  if (!id) {
    throw new Error("wf.execution.complete requires payload.id");
  }

  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT entity_id, status
     FROM wf_executions
     WHERE tenant_id = ? AND entity_id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, id)
    .first<{ entity_id: string; status: string }>();

  if (!existing) {
    throw new Error(`Workflow execution '${id}' not found for tenant '${command.tenant_id}'`);
  }

  await env.APP_D1_MAIN.prepare(
    `UPDATE wf_executions
     SET status = 'completed', completed_at = ?, updated_at = ?
     WHERE tenant_id = ? AND entity_id = ?`
  )
    .bind(now, now, command.tenant_id, id)
    .run();

  await refreshWorkflowOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("WorkflowExecutionCompleted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        previous_status: existing.status,
        completed_at: now,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleScheduleUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const templateId = readString(payload, "template_id");
  const name = readString(payload, "name");
  const cronExpression = readString(payload, "cron_expression");
  const status = readString(payload, "status") || "active";
  const nextRun = readOptionalString(payload, "next_run");
  const lastRun = readOptionalString(payload, "last_run");
  const folderId = readOptionalString(payload, "folder_id");

  if (!templateId) {
    throw new Error("wf.schedule.upsert requires payload.template_id");
  }

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO wf_schedules (
       tenant_id, entity_id, template_id, name, cron_expression, status,
       next_run, last_run, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       template_id = excluded.template_id,
       name = excluded.name,
       cron_expression = excluded.cron_expression,
       status = excluded.status,
       next_run = excluded.next_run,
       last_run = excluded.last_run,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      templateId,
      name,
      cronExpression,
      status,
      nextRun,
      lastRun,
      folderId,
      now,
      now
    )
    .run();

  await refreshWorkflowOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("WorkflowScheduleUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        template_id: templateId,
        name,
        cron_expression: cronExpression,
        status,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleAssessmentTaskUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const executionId = readString(payload, "execution_id");
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "pending";
  const assigneeId = readOptionalString(payload, "assignee_id");
  const dueDate = readOptionalString(payload, "due_date");
  const folderId = readOptionalString(payload, "folder_id");

  if (!executionId) {
    throw new Error("wf.assessment-task.upsert requires payload.execution_id");
  }

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO wf_assessment_tasks (
       tenant_id, entity_id, execution_id, name, description, status,
       assignee_id, due_date, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       execution_id = excluded.execution_id,
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       assignee_id = excluded.assignee_id,
       due_date = excluded.due_date,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      executionId,
      name,
      description,
      status,
      assigneeId,
      dueDate,
      folderId,
      now,
      now
    )
    .run();

  await refreshWorkflowOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("WorkflowAssessmentTaskUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        execution_id: executionId,
        name,
        status,
        assignee_id: assigneeId,
        due_date: dueDate,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleAssessmentTaskComplete(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id");

  if (!id) {
    throw new Error("wf.assessment-task.complete requires payload.id");
  }

  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT entity_id, status, execution_id
     FROM wf_assessment_tasks
     WHERE tenant_id = ? AND entity_id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, id)
    .first<{ entity_id: string; status: string; execution_id: string }>();

  if (!existing) {
    throw new Error(`Assessment task '${id}' not found for tenant '${command.tenant_id}'`);
  }

  await env.APP_D1_MAIN.prepare(
    `UPDATE wf_assessment_tasks
     SET status = 'completed', updated_at = ?
     WHERE tenant_id = ? AND entity_id = ?`
  )
    .bind(now, command.tenant_id, id)
    .run();

  await refreshWorkflowOverview(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("WorkflowAssessmentTaskCompleted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        execution_id: existing.execution_id,
        previous_status: existing.status,
        completed_at: now,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// ---------------------------------------------------------------------------
// Public command dispatcher
// ---------------------------------------------------------------------------

export async function handleWorkflowCommand(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  switch (command.command_type) {
    case "wf.template.upsert":
      return handleTemplateUpsert(command, env);

    case "wf.execution.start":
      return handleExecutionStart(command, env);

    case "wf.execution.advance":
      return handleExecutionAdvance(command, env);

    case "wf.execution.complete":
      return handleExecutionComplete(command, env);

    case "wf.schedule.upsert":
      return handleScheduleUpsert(command, env);

    case "wf.assessment-task.upsert":
      return handleAssessmentTaskUpsert(command, env);

    case "wf.assessment-task.complete":
      return handleAssessmentTaskComplete(command, env);

    default:
      throw new Error(`Unsupported workflow command type: ${command.command_type}`);
  }
}
