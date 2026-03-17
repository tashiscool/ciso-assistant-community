/**
 * Settings command handler.
 *
 * Handles CQRS commands for global settings and feature flags.
 * This module is designed to be imported by command-worker.ts for
 * dispatching settings.* command types.
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
// Read model projection updater
// ---------------------------------------------------------------------------

async function refreshSettingsCurrentProjection(
  db: D1Database,
  tenantId: string,
  now: string
): Promise<void> {
  // Fetch all global settings for this tenant
  const settingsRows = await db
    .prepare(
      `SELECT key, value_json, updated_at
       FROM settings_global
       WHERE tenant_id = ?
       ORDER BY key`
    )
    .bind(tenantId)
    .all<{ key: string; value_json: string; updated_at: string }>();

  const settingsMap: Record<string, unknown> = {};
  for (const row of settingsRows.results ?? []) {
    try {
      settingsMap[row.key] = JSON.parse(row.value_json);
    } catch {
      settingsMap[row.key] = row.value_json;
    }
  }

  // Fetch all feature flags for this tenant
  const flagRows = await db
    .prepare(
      `SELECT flag_name, enabled, description
       FROM settings_feature_flags
       WHERE tenant_id = ?
       ORDER BY flag_name`
    )
    .bind(tenantId)
    .all<{ flag_name: string; enabled: number; description: string }>();

  const flagsMap: Record<string, { enabled: boolean; description: string }> = {};
  for (const row of flagRows.results ?? []) {
    flagsMap[row.flag_name] = {
      enabled: row.enabled === 1,
      description: row.description
    };
  }

  await db
    .prepare(
      `INSERT INTO rm_settings_current (
         tenant_id, settings_json, feature_flags_json,
         total_settings, total_flags, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id)
       DO UPDATE SET
         settings_json = excluded.settings_json,
         feature_flags_json = excluded.feature_flags_json,
         total_settings = excluded.total_settings,
         total_flags = excluded.total_flags,
         updated_at = excluded.updated_at`
    )
    .bind(
      tenantId,
      JSON.stringify(settingsMap),
      JSON.stringify(flagsMap),
      settingsRows.results?.length ?? 0,
      flagRows.results?.length ?? 0,
      now
    )
    .run();
}

// ---------------------------------------------------------------------------
// Individual command handlers
// ---------------------------------------------------------------------------

async function handleGlobalSettingUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const key = readString(payload, "key");
  const valueJson = isRecord(payload.value)
    ? JSON.stringify(payload.value)
    : readString(payload, "value_json") || "null";
  const updatedAt = readString(payload, "updated_at") || now;

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO settings_global (
       tenant_id, id, key, value_json, updated_at, created_at
     )
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       key = excluded.key,
       value_json = excluded.value_json,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      key,
      valueJson,
      updatedAt,
      now
    )
    .run();

  await refreshSettingsCurrentProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("SettingsGlobalUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        setting_id: id,
        key,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleFeatureFlagUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const flagName = readString(payload, "flag_name");
  const enabled = payload.enabled === true ? 1 : 0;
  const description = readString(payload, "description");
  const updatedAt = readString(payload, "updated_at") || now;

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO settings_feature_flags (
       tenant_id, id, flag_name, enabled, description, updated_at, created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       flag_name = excluded.flag_name,
       enabled = excluded.enabled,
       description = excluded.description,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      flagName,
      enabled,
      description,
      updatedAt,
      now
    )
    .run();

  await refreshSettingsCurrentProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("SettingsFeatureFlagUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        flag_id: id,
        flag_name: flagName,
        enabled: enabled === 1,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// ---------------------------------------------------------------------------
// Public command dispatcher
// ---------------------------------------------------------------------------

export async function handleSettingsCommand(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  switch (command.command_type) {
    case "settings.global.upsert":
      return handleGlobalSettingUpsert(command, env);

    case "settings.feature-flag.upsert":
      return handleFeatureFlagUpsert(command, env);

    default:
      throw new Error(`Unsupported settings command type: ${command.command_type}`);
  }
}
