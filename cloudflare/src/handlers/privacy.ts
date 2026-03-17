/**
 * Privacy / GDPR command handler.
 *
 * Handles CQRS commands for privacy purposes, personal data, data subjects,
 * recipients, transfers, processings, right requests, data breaches,
 * data assets, data flows, and consent records.
 * This module is designed to be imported by command-worker.ts for dispatching
 * privacy.* command types.
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

async function refreshPrivacyOverviewProjection(
  db: D1Database,
  tenantId: string,
  now: string
): Promise<void> {
  // Count each privacy entity type for the tenant
  const purposeCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM privacy_purposes WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const personalDataCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM privacy_personal_data WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const subjectCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM privacy_data_subjects WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const recipientCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM privacy_data_recipients WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const transferCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM privacy_data_transfers WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const processingCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM privacy_processings WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const openRequestCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM privacy_right_requests
       WHERE tenant_id = ? AND status != 'completed'`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const openBreachCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM privacy_data_breaches
       WHERE tenant_id = ? AND status != 'reported'`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const assetCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM privacy_data_assets WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const flowCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM privacy_data_flows WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  const consentCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM privacy_consent_records WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  await db
    .prepare(
      `INSERT INTO rm_privacy_overview (
         tenant_id, total_purposes, total_personal_data, total_subjects,
         total_recipients, total_transfers, total_processings,
         open_right_requests, open_data_breaches,
         total_data_assets, total_data_flows, total_consent_records,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id)
       DO UPDATE SET
         total_purposes = excluded.total_purposes,
         total_personal_data = excluded.total_personal_data,
         total_subjects = excluded.total_subjects,
         total_recipients = excluded.total_recipients,
         total_transfers = excluded.total_transfers,
         total_processings = excluded.total_processings,
         open_right_requests = excluded.open_right_requests,
         open_data_breaches = excluded.open_data_breaches,
         total_data_assets = excluded.total_data_assets,
         total_data_flows = excluded.total_data_flows,
         total_consent_records = excluded.total_consent_records,
         updated_at = excluded.updated_at`
    )
    .bind(
      tenantId,
      purposeCount?.cnt ?? 0,
      personalDataCount?.cnt ?? 0,
      subjectCount?.cnt ?? 0,
      recipientCount?.cnt ?? 0,
      transferCount?.cnt ?? 0,
      processingCount?.cnt ?? 0,
      openRequestCount?.cnt ?? 0,
      openBreachCount?.cnt ?? 0,
      assetCount?.cnt ?? 0,
      flowCount?.cnt ?? 0,
      consentCount?.cnt ?? 0,
      now
    )
    .run();
}

// ---------------------------------------------------------------------------
// Individual command handlers
// ---------------------------------------------------------------------------

async function handlePurposeUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const legalBasis = readString(payload, "legal_basis");
  const retentionPeriod = readOptionalString(payload, "retention_period");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO privacy_purposes (
       tenant_id, entity_id, name, description, legal_basis,
       retention_period, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       legal_basis = excluded.legal_basis,
       retention_period = excluded.retention_period,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      legalBasis,
      retentionPeriod,
      folderId,
      now,
      now
    )
    .run();

  await refreshPrivacyOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("PrivacyPurposeUpserted", command.tenant_id, entityId, {
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

async function handlePersonalDataUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const category = readString(payload, "category");
  const sensitivity = readString(payload, "sensitivity");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO privacy_personal_data (
       tenant_id, entity_id, name, description, category,
       sensitivity, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       category = excluded.category,
       sensitivity = excluded.sensitivity,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      category,
      sensitivity,
      folderId,
      now,
      now
    )
    .run();

  await refreshPrivacyOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("PrivacyPersonalDataUpserted", command.tenant_id, entityId, {
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

async function handleDataSubjectUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const category = readString(payload, "category");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO privacy_data_subjects (
       tenant_id, entity_id, name, description, category,
       folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       category = excluded.category,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      category,
      folderId,
      now,
      now
    )
    .run();

  await refreshPrivacyOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("PrivacyDataSubjectUpserted", command.tenant_id, entityId, {
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

async function handleDataRecipientUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const recipientType = readString(payload, "recipient_type");
  const country = readOptionalString(payload, "country");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO privacy_data_recipients (
       tenant_id, entity_id, name, description, recipient_type,
       country, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       recipient_type = excluded.recipient_type,
       country = excluded.country,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      recipientType,
      country,
      folderId,
      now,
      now
    )
    .run();

  await refreshPrivacyOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("PrivacyDataRecipientUpserted", command.tenant_id, entityId, {
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

async function handleDataTransferUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const sourceCountry = readOptionalString(payload, "source_country");
  const destinationCountry = readOptionalString(payload, "destination_country");
  const transferMechanism = readOptionalString(payload, "transfer_mechanism");
  const recipientId = readOptionalString(payload, "recipient_id");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO privacy_data_transfers (
       tenant_id, entity_id, name, description, source_country,
       destination_country, transfer_mechanism, recipient_id,
       folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       source_country = excluded.source_country,
       destination_country = excluded.destination_country,
       transfer_mechanism = excluded.transfer_mechanism,
       recipient_id = excluded.recipient_id,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      sourceCountry,
      destinationCountry,
      transferMechanism,
      recipientId,
      folderId,
      now,
      now
    )
    .run();

  await refreshPrivacyOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("PrivacyDataTransferUpserted", command.tenant_id, entityId, {
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

async function handleProcessingUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "active";
  const purposeIds = readArray(payload, "purpose_ids");
  const dataIds = readArray(payload, "data_ids");
  const subjectIds = readArray(payload, "subject_ids");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO privacy_processings (
       tenant_id, entity_id, name, description, status,
       purpose_ids_json, data_ids_json, subject_ids_json,
       folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       purpose_ids_json = excluded.purpose_ids_json,
       data_ids_json = excluded.data_ids_json,
       subject_ids_json = excluded.subject_ids_json,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      status,
      JSON.stringify(purposeIds),
      JSON.stringify(dataIds),
      JSON.stringify(subjectIds),
      folderId,
      now,
      now
    )
    .run();

  await refreshPrivacyOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("PrivacyProcessingUpserted", command.tenant_id, entityId, {
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

async function handleRightRequestUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "pending";
  const requestType = readString(payload, "request_type");
  const subjectId = readOptionalString(payload, "subject_id");
  const dueDate = readOptionalString(payload, "due_date");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO privacy_right_requests (
       tenant_id, entity_id, name, description, status,
       request_type, subject_id, due_date,
       folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       request_type = excluded.request_type,
       subject_id = excluded.subject_id,
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
      requestType,
      subjectId,
      dueDate,
      folderId,
      now,
      now
    )
    .run();

  await refreshPrivacyOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("PrivacyRightRequestUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        status,
        request_type: requestType,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleRightRequestComplete(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id");

  if (!entityId) {
    throw new Error("privacy.right-request.complete requires payload.id");
  }

  // Verify the request exists
  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT status
     FROM privacy_right_requests
     WHERE tenant_id = ? AND entity_id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, entityId)
    .first<{ status: string }>();

  if (!existing) {
    throw new Error(`Right request '${entityId}' not found for tenant '${command.tenant_id}'`);
  }

  if (existing.status === "completed") {
    // Already completed; emit event but skip DB write
    return {
      events: [
        makeEvent("PrivacyRightRequestCompleted", command.tenant_id, entityId, {
          command_id: command.command_id,
          command_type: command.command_type,
          tenant_id: command.tenant_id,
          id: entityId,
          previous_status: existing.status,
          executed_at: now
        })
      ],
      finalizeJob: true
    };
  }

  await env.APP_D1_MAIN.prepare(
    `UPDATE privacy_right_requests
     SET status = 'completed', completed_at = ?, updated_at = ?
     WHERE tenant_id = ? AND entity_id = ?`
  )
    .bind(now, now, command.tenant_id, entityId)
    .run();

  await refreshPrivacyOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("PrivacyRightRequestCompleted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        previous_status: existing.status,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleDataBreachUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "detected";
  const severity = readString(payload, "severity");
  const detectedAt = readOptionalString(payload, "detected_at");
  const affectedCount = readNumber(payload, "affected_count");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO privacy_data_breaches (
       tenant_id, entity_id, name, description, status,
       severity, detected_at, affected_count,
       folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       severity = excluded.severity,
       detected_at = excluded.detected_at,
       affected_count = excluded.affected_count,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      status,
      severity,
      detectedAt,
      affectedCount,
      folderId,
      now,
      now
    )
    .run();

  await refreshPrivacyOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("PrivacyDataBreachUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        status,
        severity,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleDataBreachReport(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id");

  if (!entityId) {
    throw new Error("privacy.data-breach.report requires payload.id");
  }

  // Verify the breach exists
  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT status
     FROM privacy_data_breaches
     WHERE tenant_id = ? AND entity_id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, entityId)
    .first<{ status: string }>();

  if (!existing) {
    throw new Error(`Data breach '${entityId}' not found for tenant '${command.tenant_id}'`);
  }

  if (existing.status === "reported") {
    // Already reported; emit event but skip DB write
    return {
      events: [
        makeEvent("PrivacyDataBreachReported", command.tenant_id, entityId, {
          command_id: command.command_id,
          command_type: command.command_type,
          tenant_id: command.tenant_id,
          id: entityId,
          previous_status: existing.status,
          executed_at: now
        })
      ],
      finalizeJob: true
    };
  }

  await env.APP_D1_MAIN.prepare(
    `UPDATE privacy_data_breaches
     SET status = 'reported', reported_at = ?, updated_at = ?
     WHERE tenant_id = ? AND entity_id = ?`
  )
    .bind(now, now, command.tenant_id, entityId)
    .run();

  await refreshPrivacyOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("PrivacyDataBreachReported", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        previous_status: existing.status,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleDataAssetUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const assetType = readString(payload, "asset_type");
  const classification = readString(payload, "classification");
  const owner = readOptionalString(payload, "owner");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO privacy_data_assets (
       tenant_id, entity_id, name, description, asset_type,
       classification, owner, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       asset_type = excluded.asset_type,
       classification = excluded.classification,
       owner = excluded.owner,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      assetType,
      classification,
      owner,
      folderId,
      now,
      now
    )
    .run();

  await refreshPrivacyOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("PrivacyDataAssetUpserted", command.tenant_id, entityId, {
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

async function handleDataFlowUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const sourceAssetId = readOptionalString(payload, "source_asset_id");
  const destinationAssetId = readOptionalString(payload, "destination_asset_id");
  const dataTypes = readArray(payload, "data_types");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO privacy_data_flows (
       tenant_id, entity_id, name, description, source_asset_id,
       destination_asset_id, data_types_json, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       source_asset_id = excluded.source_asset_id,
       destination_asset_id = excluded.destination_asset_id,
       data_types_json = excluded.data_types_json,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      sourceAssetId,
      destinationAssetId,
      JSON.stringify(dataTypes),
      folderId,
      now,
      now
    )
    .run();

  await refreshPrivacyOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("PrivacyDataFlowUpserted", command.tenant_id, entityId, {
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

async function handleConsentRecordUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const subjectId = readOptionalString(payload, "subject_id");
  const purposeId = readOptionalString(payload, "purpose_id");
  const status = readString(payload, "status") || "active";
  const grantedAt = readOptionalString(payload, "granted_at");
  const expiresAt = readOptionalString(payload, "expires_at");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO privacy_consent_records (
       tenant_id, entity_id, name, description, subject_id,
       purpose_id, status, granted_at, expires_at,
       folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       subject_id = excluded.subject_id,
       purpose_id = excluded.purpose_id,
       status = excluded.status,
       granted_at = excluded.granted_at,
       expires_at = excluded.expires_at,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      subjectId,
      purposeId,
      status,
      grantedAt,
      expiresAt,
      folderId,
      now,
      now
    )
    .run();

  await refreshPrivacyOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("PrivacyConsentRecordUpserted", command.tenant_id, entityId, {
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

// ---------------------------------------------------------------------------
// Public command dispatcher
// ---------------------------------------------------------------------------

export async function handlePrivacyCommand(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  switch (command.command_type) {
    case "privacy.purpose.upsert":
      return handlePurposeUpsert(command, env);

    case "privacy.personal-data.upsert":
      return handlePersonalDataUpsert(command, env);

    case "privacy.data-subject.upsert":
      return handleDataSubjectUpsert(command, env);

    case "privacy.data-recipient.upsert":
      return handleDataRecipientUpsert(command, env);

    case "privacy.data-transfer.upsert":
      return handleDataTransferUpsert(command, env);

    case "privacy.processing.upsert":
      return handleProcessingUpsert(command, env);

    case "privacy.right-request.upsert":
      return handleRightRequestUpsert(command, env);

    case "privacy.right-request.complete":
      return handleRightRequestComplete(command, env);

    case "privacy.data-breach.upsert":
      return handleDataBreachUpsert(command, env);

    case "privacy.data-breach.report":
      return handleDataBreachReport(command, env);

    case "privacy.data-asset.upsert":
      return handleDataAssetUpsert(command, env);

    case "privacy.data-flow.upsert":
      return handleDataFlowUpsert(command, env);

    case "privacy.consent-record.upsert":
      return handleConsentRecordUpsert(command, env);

    default:
      throw new Error(`Unsupported privacy command type: ${command.command_type}`);
  }
}
