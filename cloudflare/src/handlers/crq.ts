/**
 * Cyber Risk Quantification (CRQ) command handler.
 *
 * Handles CQRS commands for CRQ studies, scenarios, and hypotheses.
 * This module is designed to be imported by command-worker.ts for dispatching
 * crq.* command types.
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

async function refreshCrqPortfolioProjection(
  db: D1Database,
  tenantId: string,
  studyId: string,
  now: string
): Promise<void> {
  // Fetch current study metadata
  const study = await db
    .prepare(
      `SELECT name, status, methodology, risk_assessment_id
       FROM crq_studies
       WHERE tenant_id = ? AND entity_id = ?
       LIMIT 1`
    )
    .bind(tenantId, studyId)
    .first<Record<string, unknown>>();

  if (!study) {
    return;
  }

  // Count scenarios for this study
  const scenarioCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM crq_scenarios
       WHERE tenant_id = ? AND study_id = ?`
    )
    .bind(tenantId, studyId)
    .first<{ cnt: number }>();

  // Count hypotheses for this study (across all scenarios)
  const hypothesisCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM crq_hypotheses h
       INNER JOIN crq_scenarios s ON h.tenant_id = s.tenant_id AND h.scenario_id = s.entity_id
       WHERE s.tenant_id = ? AND s.study_id = ?`
    )
    .bind(tenantId, studyId)
    .first<{ cnt: number }>();

  // Aggregate annualized loss expectancy (ALE) across all scenarios in the study
  const aleAgg = await db
    .prepare(
      `SELECT
         COALESCE(SUM(annualized_loss), 0) AS total_ale,
         MIN(annualized_loss) AS min_ale,
         MAX(annualized_loss) AS max_ale,
         AVG(annualized_loss) AS avg_ale
       FROM crq_scenarios
       WHERE tenant_id = ? AND study_id = ?
         AND annualized_loss IS NOT NULL`
    )
    .bind(tenantId, studyId)
    .first<{ total_ale: number; min_ale: number | null; max_ale: number | null; avg_ale: number | null }>();

  // Compute confidence level breakdown
  const confidenceRows = await db
    .prepare(
      `SELECT confidence_level, COUNT(*) AS cnt
       FROM crq_scenarios
       WHERE tenant_id = ? AND study_id = ?
         AND confidence_level IS NOT NULL
       GROUP BY confidence_level`
    )
    .bind(tenantId, studyId)
    .all<{ confidence_level: string; cnt: number }>();

  const confidenceBreakdown: Record<string, number> = {};
  for (const row of confidenceRows.results ?? []) {
    confidenceBreakdown[row.confidence_level] = row.cnt;
  }

  await db
    .prepare(
      `INSERT INTO rm_crq_portfolio (
         tenant_id, study_id, name, status, methodology,
         risk_assessment_id, total_scenarios, total_hypotheses,
         total_ale, min_ale, max_ale, avg_ale,
         confidence_breakdown_json, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, study_id)
       DO UPDATE SET
         name = excluded.name,
         status = excluded.status,
         methodology = excluded.methodology,
         risk_assessment_id = excluded.risk_assessment_id,
         total_scenarios = excluded.total_scenarios,
         total_hypotheses = excluded.total_hypotheses,
         total_ale = excluded.total_ale,
         min_ale = excluded.min_ale,
         max_ale = excluded.max_ale,
         avg_ale = excluded.avg_ale,
         confidence_breakdown_json = excluded.confidence_breakdown_json,
         updated_at = excluded.updated_at`
    )
    .bind(
      tenantId,
      studyId,
      readString(study, "name"),
      readString(study, "status") || "draft",
      readString(study, "methodology"),
      readString(study, "risk_assessment_id") || null,
      scenarioCount?.cnt ?? 0,
      hypothesisCount?.cnt ?? 0,
      aleAgg?.total_ale ?? 0,
      aleAgg?.min_ale ?? null,
      aleAgg?.max_ale ?? null,
      aleAgg?.avg_ale ?? null,
      JSON.stringify(confidenceBreakdown),
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
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "draft";
  const methodology = readString(payload, "methodology");
  const riskAssessmentId = readOptionalString(payload, "risk_assessment_id");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO crq_studies (
       tenant_id, entity_id, name, description, status,
       methodology, risk_assessment_id, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       methodology = excluded.methodology,
       risk_assessment_id = excluded.risk_assessment_id,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      status,
      methodology,
      riskAssessmentId,
      folderId,
      now,
      now
    )
    .run();

  await refreshCrqPortfolioProjection(env.APP_D1_MAIN, command.tenant_id, entityId, now);

  return {
    events: [
      makeEvent("CrqStudyUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        status,
        methodology,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleScenarioUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const studyId = readString(payload, "study_id");
  const probability = readNumber(payload, "probability");
  const singleLossExpectancy = readNumber(payload, "single_loss_expectancy");
  const annualRate = readNumber(payload, "annual_rate");
  const annualizedLoss = readNumber(payload, "annualized_loss");
  const confidenceLevel = readOptionalString(payload, "confidence_level");
  const folderId = readOptionalString(payload, "folder_id");

  if (!studyId) {
    throw new Error("crq.scenario.upsert requires payload.study_id");
  }

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO crq_scenarios (
       tenant_id, entity_id, name, description, study_id,
       probability, single_loss_expectancy, annual_rate,
       annualized_loss, confidence_level, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       study_id = excluded.study_id,
       probability = excluded.probability,
       single_loss_expectancy = excluded.single_loss_expectancy,
       annual_rate = excluded.annual_rate,
       annualized_loss = excluded.annualized_loss,
       confidence_level = excluded.confidence_level,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      studyId,
      probability,
      singleLossExpectancy,
      annualRate,
      annualizedLoss,
      confidenceLevel,
      folderId,
      now,
      now
    )
    .run();

  await refreshCrqPortfolioProjection(env.APP_D1_MAIN, command.tenant_id, studyId, now);

  return {
    events: [
      makeEvent("CrqScenarioUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        study_id: studyId,
        annualized_loss: annualizedLoss,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleHypothesisUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const scenarioId = readString(payload, "scenario_id");
  const hypothesisType = readString(payload, "hypothesis_type");
  const minValue = readNumber(payload, "min_value");
  const maxValue = readNumber(payload, "max_value");
  const mostLikely = readNumber(payload, "most_likely");
  const distribution = readString(payload, "distribution");
  const folderId = readOptionalString(payload, "folder_id");

  if (!scenarioId) {
    throw new Error("crq.hypothesis.upsert requires payload.scenario_id");
  }

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO crq_hypotheses (
       tenant_id, entity_id, name, description, scenario_id,
       hypothesis_type, min_value, max_value, most_likely,
       distribution, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, entity_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       scenario_id = excluded.scenario_id,
       hypothesis_type = excluded.hypothesis_type,
       min_value = excluded.min_value,
       max_value = excluded.max_value,
       most_likely = excluded.most_likely,
       distribution = excluded.distribution,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      scenarioId,
      hypothesisType,
      minValue,
      maxValue,
      mostLikely,
      distribution,
      folderId,
      now,
      now
    )
    .run();

  // Look up the study_id for this scenario to refresh the portfolio projection
  const scenario = await env.APP_D1_MAIN.prepare(
    `SELECT study_id
     FROM crq_scenarios
     WHERE tenant_id = ? AND entity_id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, scenarioId)
    .first<{ study_id: string }>();

  if (scenario?.study_id) {
    await refreshCrqPortfolioProjection(env.APP_D1_MAIN, command.tenant_id, scenario.study_id, now);
  }

  return {
    events: [
      makeEvent("CrqHypothesisUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        scenario_id: scenarioId,
        hypothesis_type: hypothesisType,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// ---------------------------------------------------------------------------
// Public command dispatcher
// ---------------------------------------------------------------------------

export async function handleCrqCommand(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  switch (command.command_type) {
    case "crq.study.upsert":
      return handleStudyUpsert(command, env);

    case "crq.scenario.upsert":
      return handleScenarioUpsert(command, env);

    case "crq.hypothesis.upsert":
      return handleHypothesisUpsert(command, env);

    default:
      throw new Error(`Unsupported CRQ command type: ${command.command_type}`);
  }
}
