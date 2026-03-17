/**
 * Metrology command handler.
 *
 * Handles CQRS commands for metric definitions, metric instances,
 * dashboards, and dashboard widgets.
 * This module is designed to be imported by command-worker.ts for dispatching
 * metrology.* command types.
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

async function refreshMetrologyCurrent(
  db: D1Database,
  tenantId: string,
  definitionId: string,
  now: string
): Promise<void> {
  // Fetch the definition metadata
  const definition = await db
    .prepare(
      `SELECT name, metric_type, unit, category
       FROM metrology_definitions
       WHERE tenant_id = ? AND id = ?
       LIMIT 1`
    )
    .bind(tenantId, definitionId)
    .first<Record<string, unknown>>();

  if (!definition) {
    return;
  }

  // Fetch the latest instance for this definition
  const latest = await db
    .prepare(
      `SELECT id, value, status, measured_at, target_type, target_id
       FROM metrology_instances
       WHERE tenant_id = ? AND definition_id = ?
       ORDER BY measured_at DESC
       LIMIT 1`
    )
    .bind(tenantId, definitionId)
    .first<Record<string, unknown>>();

  if (!latest) {
    return;
  }

  await db
    .prepare(
      `INSERT INTO rm_metrology_current (
         tenant_id, entity_id, definition_id, definition_name, metric_type,
         unit, category, latest_value, latest_status, latest_measured_at,
         target_type, target_id, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, entity_id)
       DO UPDATE SET
         definition_name = excluded.definition_name,
         metric_type = excluded.metric_type,
         unit = excluded.unit,
         category = excluded.category,
         latest_value = excluded.latest_value,
         latest_status = excluded.latest_status,
         latest_measured_at = excluded.latest_measured_at,
         target_type = excluded.target_type,
         target_id = excluded.target_id,
         updated_at = excluded.updated_at`
    )
    .bind(
      tenantId,
      definitionId,
      definitionId,
      readString(definition, "name"),
      readString(definition, "metric_type"),
      readString(definition, "unit"),
      readString(definition, "category"),
      latest.value as number | null,
      readString(latest as Record<string, unknown>, "status"),
      readString(latest as Record<string, unknown>, "measured_at"),
      readString(latest as Record<string, unknown>, "target_type"),
      readString(latest as Record<string, unknown>, "target_id"),
      now
    )
    .run();
}

// ---------------------------------------------------------------------------
// Individual command handlers
// ---------------------------------------------------------------------------

async function handleDefinitionUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const metricType = readString(payload, "metric_type");
  const unit = readString(payload, "unit");
  const category = readString(payload, "category");
  const calculationMethod = readString(payload, "calculation_method");
  const thresholdsJson = isRecord(payload.thresholds_json) ? payload.thresholds_json : {};
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO metrology_definitions (
       tenant_id, id, name, description, metric_type, unit, category,
       calculation_method, thresholds_json, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       metric_type = excluded.metric_type,
       unit = excluded.unit,
       category = excluded.category,
       calculation_method = excluded.calculation_method,
       thresholds_json = excluded.thresholds_json,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      metricType,
      unit,
      category,
      calculationMethod,
      JSON.stringify(thresholdsJson),
      folderId,
      now,
      now
    )
    .run();

  return {
    events: [
      makeEvent("MetrologyDefinitionUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        metric_type: metricType,
        unit,
        category,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleInstanceRecord(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const definitionId = readString(payload, "definition_id");
  const targetType = readString(payload, "target_type");
  const targetId = readString(payload, "target_id");
  const value = readNumber(payload, "value");
  const status = readString(payload, "status") || "recorded";
  const measuredAt = readOptionalString(payload, "measured_at") || now;
  const folderId = readOptionalString(payload, "folder_id");

  if (!definitionId) {
    throw new Error("metrology.instance.record requires payload.definition_id");
  }

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO metrology_instances (
       tenant_id, id, definition_id, target_type, target_id, value,
       status, measured_at, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       definition_id = excluded.definition_id,
       target_type = excluded.target_type,
       target_id = excluded.target_id,
       value = excluded.value,
       status = excluded.status,
       measured_at = excluded.measured_at,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      definitionId,
      targetType,
      targetId,
      value,
      status,
      measuredAt,
      folderId,
      now,
      now
    )
    .run();

  await refreshMetrologyCurrent(env.APP_D1_MAIN, command.tenant_id, definitionId, now);

  return {
    events: [
      makeEvent("MetrologyInstanceRecorded", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        definition_id: definitionId,
        target_type: targetType,
        target_id: targetId,
        value,
        status,
        measured_at: measuredAt,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleDashboardUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const layoutJson = isRecord(payload.layout_json) ? payload.layout_json : {};
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO metrology_dashboards (
       tenant_id, id, name, description, layout_json, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       layout_json = excluded.layout_json,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      JSON.stringify(layoutJson),
      folderId,
      now,
      now
    )
    .run();

  return {
    events: [
      makeEvent("MetrologyDashboardUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleWidgetUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const dashboardId = readString(payload, "dashboard_id");
  const name = readString(payload, "name");
  const widgetType = readString(payload, "widget_type");
  const configJson = isRecord(payload.config_json) ? payload.config_json : {};
  const positionJson = isRecord(payload.position_json) ? payload.position_json : {};
  const folderId = readOptionalString(payload, "folder_id");

  if (!dashboardId) {
    throw new Error("metrology.widget.upsert requires payload.dashboard_id");
  }

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO metrology_widgets (
       tenant_id, id, dashboard_id, name, widget_type, config_json,
       position_json, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       dashboard_id = excluded.dashboard_id,
       name = excluded.name,
       widget_type = excluded.widget_type,
       config_json = excluded.config_json,
       position_json = excluded.position_json,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      dashboardId,
      name,
      widgetType,
      JSON.stringify(configJson),
      JSON.stringify(positionJson),
      folderId,
      now,
      now
    )
    .run();

  return {
    events: [
      makeEvent("MetrologyWidgetUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        dashboard_id: dashboardId,
        name,
        widget_type: widgetType,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// ---------------------------------------------------------------------------
// Public command dispatcher
// ---------------------------------------------------------------------------

export async function handleMetrologyCommand(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  switch (command.command_type) {
    case "metrology.definition.upsert":
      return handleDefinitionUpsert(command, env);

    case "metrology.instance.record":
      return handleInstanceRecord(command, env);

    case "metrology.dashboard.upsert":
      return handleDashboardUpsert(command, env);

    case "metrology.widget.upsert":
      return handleWidgetUpsert(command, env);

    default:
      throw new Error(`Unsupported metrology command type: ${command.command_type}`);
  }
}
