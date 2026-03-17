/**
 * RMF Operations command handler.
 *
 * Handles CQRS commands for RMF system groups, change requests, checklists,
 * templates, artifacts, vulnerability findings, and Nessus scan imports.
 * This module is designed to be imported by command-worker.ts for dispatching
 * rmf.* command types.
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

async function refreshRmfDashboard(
  db: D1Database,
  tenantId: string,
  entityId: string,
  now: string
): Promise<void> {
  // Count system groups
  const groupCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM rmf_system_groups
       WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  // Count open change requests
  const openChangeRequests = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM rmf_change_requests
       WHERE tenant_id = ? AND status NOT IN ('approved', 'rejected', 'cancelled')`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  // Count checklists
  const checklistCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM rmf_checklists
       WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  // Count open vulnerability findings
  const openFindings = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM rmf_vulnerability_findings
       WHERE tenant_id = ? AND status NOT IN ('resolved', 'closed', 'false_positive')`
    )
    .bind(tenantId)
    .first<{ cnt: number }>();

  await db
    .prepare(
      `INSERT INTO rm_rmf_dashboard (
         tenant_id, entity_id, system_group_count, open_change_requests,
         checklist_count, open_vulnerability_findings, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, entity_id)
       DO UPDATE SET
         system_group_count = excluded.system_group_count,
         open_change_requests = excluded.open_change_requests,
         checklist_count = excluded.checklist_count,
         open_vulnerability_findings = excluded.open_vulnerability_findings,
         updated_at = excluded.updated_at`
    )
    .bind(
      tenantId,
      entityId,
      groupCount?.cnt ?? 0,
      openChangeRequests?.cnt ?? 0,
      checklistCount?.cnt ?? 0,
      openFindings?.cnt ?? 0,
      now
    )
    .run();
}

// ---------------------------------------------------------------------------
// Individual command handlers
// ---------------------------------------------------------------------------

async function handleSystemGroupUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "draft";
  const impactLevel = readString(payload, "impact_level");
  const authorizationBoundary = readString(payload, "authorization_boundary");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rmf_system_groups (
       tenant_id, id, name, description, status, impact_level,
       authorization_boundary, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       impact_level = excluded.impact_level,
       authorization_boundary = excluded.authorization_boundary,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      status,
      impactLevel,
      authorizationBoundary,
      folderId,
      now,
      now
    )
    .run();

  await refreshRmfDashboard(env.APP_D1_MAIN, command.tenant_id, entityId, now);

  return {
    events: [
      makeEvent("RmfSystemGroupUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        status,
        impact_level: impactLevel,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleChangeRequestUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "draft";
  const changeType = readString(payload, "change_type");
  const riskLevel = readString(payload, "risk_level");
  const impactAnalysis = readString(payload, "impact_analysis");
  const systemGroupId = readString(payload, "system_group_id");
  const requestedBy = readOptionalString(payload, "requested_by");
  const approvedBy = readOptionalString(payload, "approved_by");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rmf_change_requests (
       tenant_id, id, name, description, status, change_type, risk_level,
       impact_analysis, system_group_id, requested_by, approved_by,
       folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       change_type = excluded.change_type,
       risk_level = excluded.risk_level,
       impact_analysis = excluded.impact_analysis,
       system_group_id = excluded.system_group_id,
       requested_by = excluded.requested_by,
       approved_by = excluded.approved_by,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      status,
      changeType,
      riskLevel,
      impactAnalysis,
      systemGroupId,
      requestedBy,
      approvedBy,
      folderId,
      now,
      now
    )
    .run();

  await refreshRmfDashboard(env.APP_D1_MAIN, command.tenant_id, entityId, now);

  return {
    events: [
      makeEvent("RmfChangeRequestUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        status,
        change_type: changeType,
        risk_level: riskLevel,
        system_group_id: systemGroupId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleChangeRequestApprove(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id");
  const attester = readString(payload, "attester");

  if (!entityId) {
    throw new Error("rmf.change-request.approve requires payload.id");
  }

  // Fetch current record to verify it exists
  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT status FROM rmf_change_requests
     WHERE tenant_id = ? AND id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, entityId)
    .first<{ status: string }>();

  if (!existing) {
    throw new Error(`Change request ${entityId} not found for tenant ${command.tenant_id}`);
  }

  await env.APP_D1_MAIN.prepare(
    `UPDATE rmf_change_requests
     SET status = 'approved', approved_by = ?, updated_at = ?
     WHERE tenant_id = ? AND id = ?`
  )
    .bind(attester, now, command.tenant_id, entityId)
    .run();

  await refreshRmfDashboard(env.APP_D1_MAIN, command.tenant_id, entityId, now);

  return {
    events: [
      makeEvent("RmfChangeRequestApproved", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        approved_by: attester,
        previous_status: existing.status,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleChecklistUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const templateId = readOptionalString(payload, "template_id");
  const systemGroupId = readString(payload, "system_group_id");
  const status = readString(payload, "status") || "draft";
  const score = readNumber(payload, "score");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rmf_checklists (
       tenant_id, id, name, description, template_id, system_group_id,
       status, score, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       template_id = excluded.template_id,
       system_group_id = excluded.system_group_id,
       status = excluded.status,
       score = excluded.score,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      templateId,
      systemGroupId,
      status,
      score,
      folderId,
      now,
      now
    )
    .run();

  await refreshRmfDashboard(env.APP_D1_MAIN, command.tenant_id, entityId, now);

  return {
    events: [
      makeEvent("RmfChecklistUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        status,
        system_group_id: systemGroupId,
        score,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleChecklistScoreUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const checklistId = readString(payload, "checklist_id");
  const controlId = readString(payload, "control_id");
  const score = readNumber(payload, "score");
  const notes = readString(payload, "notes");
  const evidenceIds = readArray(payload, "evidence_ids");
  const folderId = readOptionalString(payload, "folder_id");

  if (!checklistId) {
    throw new Error("rmf.checklist-score.upsert requires payload.checklist_id");
  }

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rmf_checklist_scores (
       tenant_id, id, checklist_id, control_id, score, notes,
       evidence_ids_json, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       checklist_id = excluded.checklist_id,
       control_id = excluded.control_id,
       score = excluded.score,
       notes = excluded.notes,
       evidence_ids_json = excluded.evidence_ids_json,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      checklistId,
      controlId,
      score,
      notes,
      JSON.stringify(evidenceIds),
      folderId,
      now,
      now
    )
    .run();

  await refreshRmfDashboard(env.APP_D1_MAIN, command.tenant_id, entityId, now);

  return {
    events: [
      makeEvent("RmfChecklistScoreUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        checklist_id: checklistId,
        control_id: controlId,
        score,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleTemplateUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const templateType = readString(payload, "template_type");
  const contentJson = isRecord(payload.content_json) ? payload.content_json : {};
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rmf_templates (
       tenant_id, id, name, description, template_type, content_json,
       folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       template_type = excluded.template_type,
       content_json = excluded.content_json,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      templateType,
      JSON.stringify(contentJson),
      folderId,
      now,
      now
    )
    .run();

  await refreshRmfDashboard(env.APP_D1_MAIN, command.tenant_id, entityId, now);

  return {
    events: [
      makeEvent("RmfTemplateUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        template_type: templateType,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleArtifactUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const artifactType = readString(payload, "artifact_type");
  const status = readString(payload, "status") || "draft";
  const systemGroupId = readString(payload, "system_group_id");
  const r2Key = readOptionalString(payload, "r2_key");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rmf_artifacts (
       tenant_id, id, name, description, artifact_type, status,
       system_group_id, r2_key, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       artifact_type = excluded.artifact_type,
       status = excluded.status,
       system_group_id = excluded.system_group_id,
       r2_key = excluded.r2_key,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      artifactType,
      status,
      systemGroupId,
      r2Key,
      folderId,
      now,
      now
    )
    .run();

  await refreshRmfDashboard(env.APP_D1_MAIN, command.tenant_id, entityId, now);

  return {
    events: [
      makeEvent("RmfArtifactUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        artifact_type: artifactType,
        status,
        system_group_id: systemGroupId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleVulnerabilityFindingUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const severity = readString(payload, "severity");
  const status = readString(payload, "status") || "open";
  const cveId = readOptionalString(payload, "cve_id");
  const cvssScore = readNumber(payload, "cvss_score");
  const systemGroupId = readString(payload, "system_group_id");
  const scannerSource = readString(payload, "scanner_source");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rmf_vulnerability_findings (
       tenant_id, id, name, description, severity, status, cve_id,
       cvss_score, system_group_id, scanner_source, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       severity = excluded.severity,
       status = excluded.status,
       cve_id = excluded.cve_id,
       cvss_score = excluded.cvss_score,
       system_group_id = excluded.system_group_id,
       scanner_source = excluded.scanner_source,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      severity,
      status,
      cveId,
      cvssScore,
      systemGroupId,
      scannerSource,
      folderId,
      now,
      now
    )
    .run();

  await refreshRmfDashboard(env.APP_D1_MAIN, command.tenant_id, entityId, now);

  return {
    events: [
      makeEvent("RmfVulnerabilityFindingUpserted", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        severity,
        status,
        cve_id: cveId,
        cvss_score: cvssScore,
        system_group_id: systemGroupId,
        scanner_source: scannerSource,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleNessusScanImport(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const entityId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "imported";
  const scanType = readString(payload, "scan_type");
  const systemGroupId = readString(payload, "system_group_id");
  const resultsJson = isRecord(payload.results_json) ? payload.results_json : {};
  const importedAt = readString(payload, "imported_at") || now;
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rmf_nessus_scans (
       tenant_id, id, name, description, status, scan_type,
       system_group_id, results_json, imported_at, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       scan_type = excluded.scan_type,
       system_group_id = excluded.system_group_id,
       results_json = excluded.results_json,
       imported_at = excluded.imported_at,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      entityId,
      name,
      description,
      status,
      scanType,
      systemGroupId,
      JSON.stringify(resultsJson),
      importedAt,
      folderId,
      now,
      now
    )
    .run();

  await refreshRmfDashboard(env.APP_D1_MAIN, command.tenant_id, entityId, now);

  return {
    events: [
      makeEvent("RmfNessusScanImported", command.tenant_id, entityId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        id: entityId,
        name,
        status,
        scan_type: scanType,
        system_group_id: systemGroupId,
        imported_at: importedAt,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// ---------------------------------------------------------------------------
// Public command dispatcher
// ---------------------------------------------------------------------------

export async function handleRmfCommand(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  switch (command.command_type) {
    case "rmf.system-group.upsert":
      return handleSystemGroupUpsert(command, env);

    case "rmf.change-request.upsert":
      return handleChangeRequestUpsert(command, env);

    case "rmf.change-request.approve":
      return handleChangeRequestApprove(command, env);

    case "rmf.checklist.upsert":
      return handleChecklistUpsert(command, env);

    case "rmf.checklist-score.upsert":
      return handleChecklistScoreUpsert(command, env);

    case "rmf.template.upsert":
      return handleTemplateUpsert(command, env);

    case "rmf.artifact.upsert":
      return handleArtifactUpsert(command, env);

    case "rmf.vulnerability-finding.upsert":
      return handleVulnerabilityFindingUpsert(command, env);

    case "rmf.nessus-scan.import":
      return handleNessusScanImport(command, env);

    default:
      throw new Error(`Unsupported RMF command type: ${command.command_type}`);
  }
}
