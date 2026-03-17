/**
 * Asset Service command handler.
 *
 * Handles CQRS commands for asset items, processes, services, and service
 * contracts. This module is designed to be imported by command-worker.ts
 * for dispatching asset.* command types.
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

async function refreshAssetInventory(
  db: D1Database,
  tenantId: string,
  now: string
): Promise<void> {
  const itemCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM asset_items WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const processCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM asset_processes WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const serviceCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM asset_services WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const contractCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM asset_service_contracts WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  // Aggregate asset types breakdown
  const typeRows = await db
    .prepare(
      `SELECT asset_type, COUNT(*) AS cnt
       FROM asset_items
       WHERE tenant_id = ?
       GROUP BY asset_type`
    )
    .bind(tenantId)
    .all<{ asset_type: string; cnt: number }>();

  const typeBreakdown: Record<string, number> = {};
  for (const row of typeRows.results ?? []) {
    typeBreakdown[row.asset_type] = row.cnt;
  }

  await db
    .prepare(
      `INSERT INTO rm_asset_inventory (
         tenant_id, total_items, total_processes, total_services,
         total_contracts, type_breakdown_json, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id)
       DO UPDATE SET
         total_items = excluded.total_items,
         total_processes = excluded.total_processes,
         total_services = excluded.total_services,
         total_contracts = excluded.total_contracts,
         type_breakdown_json = excluded.type_breakdown_json,
         updated_at = excluded.updated_at`
    )
    .bind(
      tenantId,
      itemCount?.cnt ?? 0,
      processCount?.cnt ?? 0,
      serviceCount?.cnt ?? 0,
      contractCount?.cnt ?? 0,
      JSON.stringify(typeBreakdown),
      now
    )
    .run();
}

// ---------------------------------------------------------------------------
// Individual command handlers
// ---------------------------------------------------------------------------

async function handleItemUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const assetType = readString(payload, "asset_type");
  const status = readString(payload, "status") || "active";
  const classification = readString(payload, "classification");
  const ownerId = readOptionalString(payload, "owner_id");
  const location = readString(payload, "location");
  const tagsJson = Array.isArray(payload.tags_json)
    ? JSON.stringify(payload.tags_json)
    : readString(payload, "tags_json") || "[]";
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO asset_items (
       tenant_id, entity_id, name, description, asset_type, status,
       classification, owner_id, location, tags_json, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       asset_type = excluded.asset_type,
       status = excluded.status,
       classification = excluded.classification,
       owner_id = excluded.owner_id,
       location = excluded.location,
       tags_json = excluded.tags_json,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      assetType,
      status,
      classification,
      ownerId,
      location,
      tagsJson,
      folderId,
      now,
      now
    )
    .run();

  await refreshAssetInventory(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("AssetItemUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        asset_type: assetType,
        status,
        classification,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleProcessUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const processType = readString(payload, "process_type");
  const ownerId = readOptionalString(payload, "owner_id");
  const criticality = readString(payload, "criticality");
  const assetsJson = Array.isArray(payload.assets_json)
    ? JSON.stringify(payload.assets_json)
    : readString(payload, "assets_json") || "[]";
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO asset_processes (
       tenant_id, entity_id, name, description, process_type, owner_id,
       criticality, assets_json, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       process_type = excluded.process_type,
       owner_id = excluded.owner_id,
       criticality = excluded.criticality,
       assets_json = excluded.assets_json,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      processType,
      ownerId,
      criticality,
      assetsJson,
      folderId,
      now,
      now
    )
    .run();

  await refreshAssetInventory(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("AssetProcessUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        process_type: processType,
        criticality,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleServiceUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const serviceType = readString(payload, "service_type");
  const providerId = readOptionalString(payload, "provider_id");
  const status = readString(payload, "status") || "active";
  const slaJson = isRecord(payload.sla_json)
    ? JSON.stringify(payload.sla_json)
    : readString(payload, "sla_json") || "{}";
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO asset_services (
       tenant_id, entity_id, name, description, service_type, provider_id,
       status, sla_json, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       service_type = excluded.service_type,
       provider_id = excluded.provider_id,
       status = excluded.status,
       sla_json = excluded.sla_json,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      serviceType,
      providerId,
      status,
      slaJson,
      folderId,
      now,
      now
    )
    .run();

  await refreshAssetInventory(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("AssetServiceUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        service_type: serviceType,
        status,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleServiceContractUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const serviceId = readString(payload, "service_id");
  const contractType = readString(payload, "contract_type");
  const startDate = readOptionalString(payload, "start_date");
  const endDate = readOptionalString(payload, "end_date");
  const value = readNumber(payload, "value");
  const folderId = readOptionalString(payload, "folder_id");

  if (!serviceId) {
    throw new Error("asset.service-contract.upsert requires payload.service_id");
  }

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO asset_service_contracts (
       tenant_id, entity_id, name, description, service_id, contract_type,
       start_date, end_date, value, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       service_id = excluded.service_id,
       contract_type = excluded.contract_type,
       start_date = excluded.start_date,
       end_date = excluded.end_date,
       value = excluded.value,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      serviceId,
      contractType,
      startDate,
      endDate,
      value,
      folderId,
      now,
      now
    )
    .run();

  await refreshAssetInventory(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("AssetServiceContractUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        entity_id: id,
        name,
        service_id: serviceId,
        contract_type: contractType,
        start_date: startDate,
        end_date: endDate,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// ---------------------------------------------------------------------------
// Public command dispatcher
// ---------------------------------------------------------------------------

export async function handleAssetServiceCommand(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  switch (command.command_type) {
    case "asset.item.upsert":
      return handleItemUpsert(command, env);

    case "asset.process.upsert":
      return handleProcessUpsert(command, env);

    case "asset.service.upsert":
      return handleServiceUpsert(command, env);

    case "asset.service-contract.upsert":
      return handleServiceContractUpsert(command, env);

    default:
      throw new Error(`Unsupported asset service command type: ${command.command_type}`);
  }
}
