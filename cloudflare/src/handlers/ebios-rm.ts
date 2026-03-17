/**
 * EBIOS RM (Risk Methodology) command handler.
 *
 * Handles CQRS commands for EBIOS RM studies, feared events, RO/TO pairs,
 * stakeholders, attack paths, operational scenarios, and strategic scenarios.
 * This module is designed to be imported by command-worker.ts for dispatching
 * ebios.* command types.
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

async function refreshEbiosStudySummaryProjection(
  db: D1Database,
  tenantId: string,
  studyId: string,
  now: string
): Promise<void> {
  // Fetch study metadata
  const study = await db
    .prepare(
      `SELECT name, status, version, ref_id, folder_id
       FROM ebios_studies
       WHERE id = ?
       LIMIT 1`
    )
    .bind(studyId)
    .first<Record<string, unknown>>();

  if (!study) {
    return;
  }

  // Count feared events for this study
  const fearedEventCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM ebios_feared_events
       WHERE study_id = ?`
    )
    .bind(studyId)
    .first<{ cnt: number }>();

  // Count stakeholders for this study
  const stakeholderCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM ebios_stakeholders
       WHERE study_id = ?`
    )
    .bind(studyId)
    .first<{ cnt: number }>();

  // Count operational scenarios for this study
  const operationalScenarioCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM ebios_operational_scenarios
       WHERE study_id = ?`
    )
    .bind(studyId)
    .first<{ cnt: number }>();

  // Count strategic scenarios for this study
  const strategicScenarioCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM ebios_strategic_scenarios
       WHERE study_id = ?`
    )
    .bind(studyId)
    .first<{ cnt: number }>();

  // Count attack paths for this study
  const attackPathCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM ebios_attack_paths
       WHERE study_id = ?`
    )
    .bind(studyId)
    .first<{ cnt: number }>();

  // Count RO/TO pairs for this study
  const roToCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM ebios_ro_to
       WHERE study_id = ?`
    )
    .bind(studyId)
    .first<{ cnt: number }>();

  const totalScenarios =
    (operationalScenarioCount?.cnt ?? 0) + (strategicScenarioCount?.cnt ?? 0);

  await db
    .prepare(
      `INSERT INTO rm_ebios_study_summary (
         tenant_id, study_id, name, status, version, ref_id,
         feared_event_count, stakeholder_count, scenario_count,
         attack_path_count, ro_to_count, folder_id, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, study_id)
       DO UPDATE SET
         name = excluded.name,
         status = excluded.status,
         version = excluded.version,
         ref_id = excluded.ref_id,
         feared_event_count = excluded.feared_event_count,
         stakeholder_count = excluded.stakeholder_count,
         scenario_count = excluded.scenario_count,
         attack_path_count = excluded.attack_path_count,
         ro_to_count = excluded.ro_to_count,
         folder_id = excluded.folder_id,
         updated_at = excluded.updated_at`
    )
    .bind(
      tenantId,
      studyId,
      readString(study, "name"),
      readString(study, "status") || "in_progress",
      readString(study, "version"),
      readString(study, "ref_id"),
      fearedEventCount?.cnt ?? 0,
      stakeholderCount?.cnt ?? 0,
      totalScenarios,
      attackPathCount?.cnt ?? 0,
      roToCount?.cnt ?? 0,
      readString(study, "folder_id"),
      now
    )
    .run();
}

// ---------------------------------------------------------------------------
// Individual command handlers
// ---------------------------------------------------------------------------

async function handleStudyUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "in_progress";
  const version = readString(payload, "version");
  const refId = readString(payload, "ref_id");
  const riskMatrixId = readString(payload, "risk_matrix_id");
  const folderId = readString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO ebios_studies (
       id, name, description, status, version, ref_id,
       risk_matrix_id, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       version = excluded.version,
       ref_id = excluded.ref_id,
       risk_matrix_id = excluded.risk_matrix_id,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      id,
      name,
      description,
      status,
      version,
      refId,
      riskMatrixId,
      folderId,
      now,
      now
    )
    .run();

  await refreshEbiosStudySummaryProjection(env.APP_D1_MAIN, command.tenant_id, id, now);

  return {
    events: [
      makeEvent("EbiosStudyUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        study_id: id,
        name,
        status,
        folder_id: folderId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleFearedEventUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const refId = readString(payload, "ref_id");
  const gravity = readNumber(payload, "gravity");
  const isSelected = payload.is_selected === true ? 1 : 0;
  const justification = readString(payload, "justification");
  const studyId = readString(payload, "study_id");
  const folderId = readString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO ebios_feared_events (
       id, name, description, ref_id, gravity, is_selected,
       justification, study_id, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       ref_id = excluded.ref_id,
       gravity = excluded.gravity,
       is_selected = excluded.is_selected,
       justification = excluded.justification,
       study_id = excluded.study_id,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      id,
      name,
      description,
      refId,
      gravity,
      isSelected,
      justification,
      studyId,
      folderId,
      now,
      now
    )
    .run();

  await refreshEbiosStudySummaryProjection(env.APP_D1_MAIN, command.tenant_id, studyId, now);

  return {
    events: [
      makeEvent("EbiosFearedEventUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        feared_event_id: id,
        study_id: studyId,
        name,
        gravity,
        is_selected: isSelected === 1,
        folder_id: folderId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleRoToUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const refId = readString(payload, "ref_id");
  const riskOrigin = readString(payload, "risk_origin");
  const targetObjective = readString(payload, "target_objective");
  const motivation = readString(payload, "motivation");
  const resources = readString(payload, "resources");
  const pertinence = readNumber(payload, "pertinence");
  const activity = readString(payload, "activity");
  const isSelected = payload.is_selected === true ? 1 : 0;
  const justification = readString(payload, "justification");
  const studyId = readString(payload, "study_id");
  const folderId = readString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO ebios_ro_to (
       id, name, description, ref_id, risk_origin, target_objective,
       motivation, resources, pertinence, activity, is_selected,
       justification, study_id, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       ref_id = excluded.ref_id,
       risk_origin = excluded.risk_origin,
       target_objective = excluded.target_objective,
       motivation = excluded.motivation,
       resources = excluded.resources,
       pertinence = excluded.pertinence,
       activity = excluded.activity,
       is_selected = excluded.is_selected,
       justification = excluded.justification,
       study_id = excluded.study_id,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      id,
      name,
      description,
      refId,
      riskOrigin,
      targetObjective,
      motivation,
      resources,
      pertinence,
      activity,
      isSelected,
      justification,
      studyId,
      folderId,
      now,
      now
    )
    .run();

  await refreshEbiosStudySummaryProjection(env.APP_D1_MAIN, command.tenant_id, studyId, now);

  return {
    events: [
      makeEvent("EbiosRoToUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        ro_to_id: id,
        study_id: studyId,
        name,
        risk_origin: riskOrigin,
        target_objective: targetObjective,
        is_selected: isSelected === 1,
        folder_id: folderId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleStakeholderUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const refId = readString(payload, "ref_id");
  const category = readString(payload, "category");
  const currentCriticality = readNumber(payload, "current_criticality");
  const residualCriticality = readNumber(payload, "residual_criticality");
  const isSelected = payload.is_selected === true ? 1 : 0;
  const justification = readString(payload, "justification");
  const entityId = readString(payload, "entity_id");
  const studyId = readString(payload, "study_id");
  const folderId = readString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO ebios_stakeholders (
       id, name, description, ref_id, category, current_criticality,
       residual_criticality, is_selected, justification, entity_id,
       study_id, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       ref_id = excluded.ref_id,
       category = excluded.category,
       current_criticality = excluded.current_criticality,
       residual_criticality = excluded.residual_criticality,
       is_selected = excluded.is_selected,
       justification = excluded.justification,
       entity_id = excluded.entity_id,
       study_id = excluded.study_id,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      id,
      name,
      description,
      refId,
      category,
      currentCriticality,
      residualCriticality,
      isSelected,
      justification,
      entityId,
      studyId,
      folderId,
      now,
      now
    )
    .run();

  await refreshEbiosStudySummaryProjection(env.APP_D1_MAIN, command.tenant_id, studyId, now);

  return {
    events: [
      makeEvent("EbiosStakeholderUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        stakeholder_id: id,
        study_id: studyId,
        entity_id: entityId,
        name,
        category,
        is_selected: isSelected === 1,
        folder_id: folderId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleAttackPathUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const refId = readString(payload, "ref_id");
  const studyId = readString(payload, "study_id");
  const folderId = readString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO ebios_attack_paths (
       id, name, description, ref_id, study_id, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       ref_id = excluded.ref_id,
       study_id = excluded.study_id,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      id,
      name,
      description,
      refId,
      studyId,
      folderId,
      now,
      now
    )
    .run();

  await refreshEbiosStudySummaryProjection(env.APP_D1_MAIN, command.tenant_id, studyId, now);

  return {
    events: [
      makeEvent("EbiosAttackPathUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        attack_path_id: id,
        study_id: studyId,
        name,
        folder_id: folderId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleOperationalScenarioUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const refId = readString(payload, "ref_id");
  const likelihood = readNumber(payload, "likelihood");
  const isSelected = payload.is_selected === true ? 1 : 0;
  const studyId = readString(payload, "study_id");
  const folderId = readString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO ebios_operational_scenarios (
       id, name, description, ref_id, likelihood, is_selected,
       study_id, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       ref_id = excluded.ref_id,
       likelihood = excluded.likelihood,
       is_selected = excluded.is_selected,
       study_id = excluded.study_id,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      id,
      name,
      description,
      refId,
      likelihood,
      isSelected,
      studyId,
      folderId,
      now,
      now
    )
    .run();

  await refreshEbiosStudySummaryProjection(env.APP_D1_MAIN, command.tenant_id, studyId, now);

  return {
    events: [
      makeEvent("EbiosOperationalScenarioUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        operational_scenario_id: id,
        study_id: studyId,
        name,
        likelihood,
        is_selected: isSelected === 1,
        folder_id: folderId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleStrategicScenarioUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const refId = readString(payload, "ref_id");
  const gravity = readNumber(payload, "gravity");
  const likelihood = readNumber(payload, "likelihood");
  const studyId = readString(payload, "study_id");
  const folderId = readString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO ebios_strategic_scenarios (
       id, name, description, ref_id, gravity, likelihood,
       study_id, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       ref_id = excluded.ref_id,
       gravity = excluded.gravity,
       likelihood = excluded.likelihood,
       study_id = excluded.study_id,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      id,
      name,
      description,
      refId,
      gravity,
      likelihood,
      studyId,
      folderId,
      now,
      now
    )
    .run();

  await refreshEbiosStudySummaryProjection(env.APP_D1_MAIN, command.tenant_id, studyId, now);

  return {
    events: [
      makeEvent("EbiosStrategicScenarioUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        strategic_scenario_id: id,
        study_id: studyId,
        name,
        gravity,
        likelihood,
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

export async function handleEbiosRmCommand(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  switch (command.command_type) {
    case "ebios.study.upsert":
      return handleStudyUpsert(command, env);

    case "ebios.feared-event.upsert":
      return handleFearedEventUpsert(command, env);

    case "ebios.ro-to.upsert":
      return handleRoToUpsert(command, env);

    case "ebios.stakeholder.upsert":
      return handleStakeholderUpsert(command, env);

    case "ebios.attack-path.upsert":
      return handleAttackPathUpsert(command, env);

    case "ebios.operational-scenario.upsert":
      return handleOperationalScenarioUpsert(command, env);

    case "ebios.strategic-scenario.upsert":
      return handleStrategicScenarioUpsert(command, env);

    default:
      throw new Error(`Unsupported EBIOS RM command type: ${command.command_type}`);
  }
}
