/**
 * Core GRC command handler.
 *
 * Handles CQRS commands for folders, frameworks, controls, requirements,
 * risk management, compliance, evidence, and findings.
 * This module is designed to be imported by command-worker.ts for dispatching
 * grc.* command types.
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
  CISO_EVIDENCE_R2?: R2Bucket;
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

function readBoolean(payload: Record<string, unknown>, key: string): boolean | null {
  const value = payload[key];
  return typeof value === "boolean" ? value : null;
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

async function refreshGrcOverviewProjection(
  db: D1Database,
  tenantId: string,
  now: string
): Promise<void> {
  // Count rows in each primary GRC table to build an overview summary
  const tables = [
    { key: "folders", table: "grc_folders" },
    { key: "frameworks", table: "grc_frameworks" },
    { key: "requirement_nodes", table: "grc_requirement_nodes" },
    { key: "reference_controls", table: "grc_reference_controls" },
    { key: "applied_controls", table: "grc_applied_controls" },
    { key: "policies", table: "grc_policies" },
    { key: "risk_matrices", table: "grc_risk_matrices" },
    { key: "threats", table: "grc_threats" },
    { key: "vulnerabilities", table: "grc_vulnerabilities" },
    { key: "risk_assessments", table: "grc_risk_assessments" },
    { key: "risk_scenarios", table: "grc_risk_scenarios" },
    { key: "risk_acceptances", table: "grc_risk_acceptances" },
    { key: "evidences", table: "grc_evidences" },
    { key: "compliance_assessments", table: "grc_compliance_assessments" },
    { key: "requirement_assessments", table: "grc_requirement_assessments" },
    { key: "findings", table: "grc_findings" },
    { key: "filtering_labels", table: "grc_filtering_labels" },
    { key: "campaigns", table: "grc_campaigns" },
    { key: "requirement_mapping_sets", table: "grc_requirement_mapping_sets" },
    { key: "assets", table: "grc_assets" }
  ];

  const counts: Record<string, number> = {};
  for (const entry of tables) {
    try {
      const row = await db
        .prepare(
          `SELECT COUNT(*) AS cnt FROM ${entry.table} WHERE tenant_id = ?`
        )
        .bind(tenantId)
        .first<{ cnt: number }>();
      counts[entry.key] = row?.cnt ?? 0;
    } catch {
      // Table may not exist yet; default to 0
      counts[entry.key] = 0;
    }
  }

  // Compute additional aggregate metrics
  let appliedControlsByStatus: Record<string, number> = {};
  try {
    const statusRows = await db
      .prepare(
        `SELECT status, COUNT(*) AS cnt
         FROM grc_applied_controls
         WHERE tenant_id = ?
         GROUP BY status`
      )
      .bind(tenantId)
      .all<{ status: string; cnt: number }>();
    for (const row of statusRows.results ?? []) {
      appliedControlsByStatus[row.status || "unknown"] = row.cnt;
    }
  } catch {
    appliedControlsByStatus = {};
  }

  let findingsByStatus: Record<string, number> = {};
  try {
    const findingRows = await db
      .prepare(
        `SELECT status, COUNT(*) AS cnt
         FROM grc_findings
         WHERE tenant_id = ?
         GROUP BY status`
      )
      .bind(tenantId)
      .all<{ status: string; cnt: number }>();
    for (const row of findingRows.results ?? []) {
      findingsByStatus[row.status || "unknown"] = row.cnt;
    }
  } catch {
    findingsByStatus = {};
  }

  let riskAcceptancesByState: Record<string, number> = {};
  try {
    const raRows = await db
      .prepare(
        `SELECT state, COUNT(*) AS cnt
         FROM grc_risk_acceptances
         WHERE tenant_id = ?
         GROUP BY state`
      )
      .bind(tenantId)
      .all<{ state: string; cnt: number }>();
    for (const row of raRows.results ?? []) {
      riskAcceptancesByState[row.state || "unknown"] = row.cnt;
    }
  } catch {
    riskAcceptancesByState = {};
  }

  const summaryJson = JSON.stringify({
    counts,
    applied_controls_by_status: appliedControlsByStatus,
    findings_by_status: findingsByStatus,
    risk_acceptances_by_state: riskAcceptancesByState
  });

  await db
    .prepare(
      `INSERT INTO rm_grc_overview (
         tenant_id, summary_json, updated_at
       )
       VALUES (?, ?, ?)
       ON CONFLICT(tenant_id)
       DO UPDATE SET
         summary_json = excluded.summary_json,
         updated_at = excluded.updated_at`
    )
    .bind(tenantId, summaryJson, now)
    .run();
}

// ---------------------------------------------------------------------------
// Individual command handlers
// ---------------------------------------------------------------------------

// 1. grc.folder.upsert
async function handleFolderUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const folderId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const parentId = readOptionalString(payload, "parent_id");
  const contentType = readString(payload, "content_type") || "DOMAIN";
  const iconName = readOptionalString(payload, "icon_name");
  const order = readNumber(payload, "order") ?? 0;

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_folders (
       tenant_id, id, name, description, parent_id, content_type,
       icon_name, "order", created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       parent_id = excluded.parent_id,
       content_type = excluded.content_type,
       icon_name = excluded.icon_name,
       "order" = excluded."order",
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      folderId,
      name,
      description,
      parentId,
      contentType,
      iconName,
      order,
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcFolderUpserted", command.tenant_id, folderId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        folder_id: folderId,
        name,
        content_type: contentType,
        parent_id: parentId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 2. grc.framework.upsert
async function handleFrameworkUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const frameworkId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const urnValue = readOptionalString(payload, "urn");
  const refId = readOptionalString(payload, "ref_id");
  const locale = readString(payload, "locale") || "en";
  const defaultLocale = readBoolean(payload, "default_locale") ?? true;
  const provider = readOptionalString(payload, "provider");
  const compliableValue = readBoolean(payload, "compliable") ?? true;
  const folderId = readOptionalString(payload, "folder_id");
  const minScore = readNumber(payload, "min_score") ?? 0;
  const maxScore = readNumber(payload, "max_score") ?? 100;
  const scoresDefinition = isRecord(payload.scores_definition)
    ? payload.scores_definition
    : readArray(payload, "scores_definition");
  const implementationGroupsDefinition = isRecord(payload.implementation_groups_definition)
    ? payload.implementation_groups_definition
    : readArray(payload, "implementation_groups_definition");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_frameworks (
       tenant_id, id, name, description, urn, ref_id, locale,
       default_locale, provider, compliable, folder_id,
       min_score, max_score, scores_definition_json,
       implementation_groups_definition_json, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       urn = excluded.urn,
       ref_id = excluded.ref_id,
       locale = excluded.locale,
       default_locale = excluded.default_locale,
       provider = excluded.provider,
       compliable = excluded.compliable,
       folder_id = excluded.folder_id,
       min_score = excluded.min_score,
       max_score = excluded.max_score,
       scores_definition_json = excluded.scores_definition_json,
       implementation_groups_definition_json = excluded.implementation_groups_definition_json,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      frameworkId,
      name,
      description,
      urnValue,
      refId,
      locale,
      defaultLocale ? 1 : 0,
      provider,
      compliableValue ? 1 : 0,
      folderId,
      minScore,
      maxScore,
      JSON.stringify(scoresDefinition),
      JSON.stringify(implementationGroupsDefinition),
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcFrameworkUpserted", command.tenant_id, frameworkId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        framework_id: frameworkId,
        name,
        urn: urnValue,
        provider,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 3. grc.framework.import
async function handleFrameworkImport(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const events: DomainEventEnvelope[] = [];

  // Extract framework data from the import payload
  const frameworkData = isRecord(payload.framework) ? payload.framework : payload;
  const frameworkId = readString(frameworkData, "id") || command.command_id;
  const name = readString(frameworkData, "name");
  const description = readString(frameworkData, "description");
  const urnValue = readOptionalString(frameworkData, "urn");
  const refId = readOptionalString(frameworkData, "ref_id");
  const locale = readString(frameworkData, "locale") || "en";
  const defaultLocale = readBoolean(frameworkData, "default_locale") ?? true;
  const provider = readOptionalString(frameworkData, "provider");
  const compliableValue = readBoolean(frameworkData, "compliable") ?? true;
  const folderId = readOptionalString(frameworkData, "folder_id");
  const minScore = readNumber(frameworkData, "min_score") ?? 0;
  const maxScore = readNumber(frameworkData, "max_score") ?? 100;
  const scoresDefinition = isRecord(frameworkData.scores_definition)
    ? frameworkData.scores_definition
    : readArray(frameworkData, "scores_definition");
  const implementationGroupsDefinition = isRecord(frameworkData.implementation_groups_definition)
    ? frameworkData.implementation_groups_definition
    : readArray(frameworkData, "implementation_groups_definition");

  // Upsert the framework itself
  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_frameworks (
       tenant_id, id, name, description, urn, ref_id, locale,
       default_locale, provider, compliable, folder_id,
       min_score, max_score, scores_definition_json,
       implementation_groups_definition_json, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       urn = excluded.urn,
       ref_id = excluded.ref_id,
       locale = excluded.locale,
       default_locale = excluded.default_locale,
       provider = excluded.provider,
       compliable = excluded.compliable,
       folder_id = excluded.folder_id,
       min_score = excluded.min_score,
       max_score = excluded.max_score,
       scores_definition_json = excluded.scores_definition_json,
       implementation_groups_definition_json = excluded.implementation_groups_definition_json,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      frameworkId,
      name,
      description,
      urnValue,
      refId,
      locale,
      defaultLocale ? 1 : 0,
      provider,
      compliableValue ? 1 : 0,
      folderId,
      minScore,
      maxScore,
      JSON.stringify(scoresDefinition),
      JSON.stringify(implementationGroupsDefinition),
      now,
      now
    )
    .run();

  events.push(
    makeEvent("GrcFrameworkUpserted", command.tenant_id, frameworkId, {
      command_id: command.command_id,
      command_type: command.command_type,
      tenant_id: command.tenant_id,
      framework_id: frameworkId,
      name,
      source: "import",
      executed_at: now
    })
  );

  // Bulk insert requirement_nodes
  const requirementNodes = readArray(payload, "requirement_nodes");
  for (const rawNode of requirementNodes) {
    if (!isRecord(rawNode)) continue;
    const nodeId = readString(rawNode, "id") || crypto.randomUUID();
    const nodeName = readString(rawNode, "name");
    const nodeDescription = readString(rawNode, "description");
    const nodeUrn = readOptionalString(rawNode, "urn");
    const nodeRefId = readOptionalString(rawNode, "ref_id");
    const nodeParentUrn = readOptionalString(rawNode, "parent_urn");
    const nodeLevel = readNumber(rawNode, "level") ?? 0;
    const nodeOrder = readNumber(rawNode, "order") ?? 0;
    const nodeAssessable = readBoolean(rawNode, "assessable") ?? false;
    const nodeAnnotation = readOptionalString(rawNode, "annotation");
    const nodeImplementationGroups = readArray(rawNode, "implementation_groups");
    const nodeThreats = readArray(rawNode, "threats");
    const nodeReferenceControls = readArray(rawNode, "reference_controls");

    await env.APP_D1_MAIN.prepare(
      `INSERT INTO grc_requirement_nodes (
         tenant_id, id, framework_id, name, description, urn, ref_id,
         parent_urn, level, "order", assessable, annotation,
         implementation_groups_json, threats_json, reference_controls_json,
         created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, id)
       DO UPDATE SET
         framework_id = excluded.framework_id,
         name = excluded.name,
         description = excluded.description,
         urn = excluded.urn,
         ref_id = excluded.ref_id,
         parent_urn = excluded.parent_urn,
         level = excluded.level,
         "order" = excluded."order",
         assessable = excluded.assessable,
         annotation = excluded.annotation,
         implementation_groups_json = excluded.implementation_groups_json,
         threats_json = excluded.threats_json,
         reference_controls_json = excluded.reference_controls_json,
         updated_at = excluded.updated_at`
    )
      .bind(
        command.tenant_id,
        nodeId,
        frameworkId,
        nodeName,
        nodeDescription,
        nodeUrn,
        nodeRefId,
        nodeParentUrn,
        nodeLevel,
        nodeOrder,
        nodeAssessable ? 1 : 0,
        nodeAnnotation,
        JSON.stringify(nodeImplementationGroups),
        JSON.stringify(nodeThreats),
        JSON.stringify(nodeReferenceControls),
        now,
        now
      )
      .run();

    events.push(
      makeEvent("GrcRequirementNodeUpserted", command.tenant_id, nodeId, {
        command_id: command.command_id,
        tenant_id: command.tenant_id,
        node_id: nodeId,
        framework_id: frameworkId,
        name: nodeName,
        urn: nodeUrn,
        source: "import",
        executed_at: now
      })
    );
  }

  // Bulk insert reference_controls
  const referenceControls = readArray(payload, "reference_controls");
  for (const rawCtrl of referenceControls) {
    if (!isRecord(rawCtrl)) continue;
    const ctrlId = readString(rawCtrl, "id") || crypto.randomUUID();
    const ctrlName = readString(rawCtrl, "name");
    const ctrlDescription = readString(rawCtrl, "description");
    const ctrlUrn = readOptionalString(rawCtrl, "urn");
    const ctrlRefId = readOptionalString(rawCtrl, "ref_id");
    const ctrlCategory = readOptionalString(rawCtrl, "category");
    const ctrlProvider = readOptionalString(rawCtrl, "provider");
    const ctrlAnnotation = readOptionalString(rawCtrl, "annotation");

    await env.APP_D1_MAIN.prepare(
      `INSERT INTO grc_reference_controls (
         tenant_id, id, framework_id, name, description, urn, ref_id,
         category, provider, annotation, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, id)
       DO UPDATE SET
         framework_id = excluded.framework_id,
         name = excluded.name,
         description = excluded.description,
         urn = excluded.urn,
         ref_id = excluded.ref_id,
         category = excluded.category,
         provider = excluded.provider,
         annotation = excluded.annotation,
         updated_at = excluded.updated_at`
    )
      .bind(
        command.tenant_id,
        ctrlId,
        frameworkId,
        ctrlName,
        ctrlDescription,
        ctrlUrn,
        ctrlRefId,
        ctrlCategory,
        ctrlProvider,
        ctrlAnnotation,
        now,
        now
      )
      .run();

    events.push(
      makeEvent("GrcReferenceControlUpserted", command.tenant_id, ctrlId, {
        command_id: command.command_id,
        tenant_id: command.tenant_id,
        control_id: ctrlId,
        framework_id: frameworkId,
        name: ctrlName,
        urn: ctrlUrn,
        source: "import",
        executed_at: now
      })
    );
  }

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events,
    finalizeJob: true
  };
}

// 4. grc.requirement-node.upsert
async function handleRequirementNodeUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const nodeId = readString(payload, "id") || command.command_id;
  const frameworkId = readString(payload, "framework_id");
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const urnValue = readOptionalString(payload, "urn");
  const refId = readOptionalString(payload, "ref_id");
  const parentUrn = readOptionalString(payload, "parent_urn");
  const level = readNumber(payload, "level") ?? 0;
  const order = readNumber(payload, "order") ?? 0;
  const assessable = readBoolean(payload, "assessable") ?? false;
  const annotation = readOptionalString(payload, "annotation");
  const implementationGroups = readArray(payload, "implementation_groups");
  const threats = readArray(payload, "threats");
  const referenceControls = readArray(payload, "reference_controls");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_requirement_nodes (
       tenant_id, id, framework_id, name, description, urn, ref_id,
       parent_urn, level, "order", assessable, annotation,
       implementation_groups_json, threats_json, reference_controls_json,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       framework_id = excluded.framework_id,
       name = excluded.name,
       description = excluded.description,
       urn = excluded.urn,
       ref_id = excluded.ref_id,
       parent_urn = excluded.parent_urn,
       level = excluded.level,
       "order" = excluded."order",
       assessable = excluded.assessable,
       annotation = excluded.annotation,
       implementation_groups_json = excluded.implementation_groups_json,
       threats_json = excluded.threats_json,
       reference_controls_json = excluded.reference_controls_json,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      nodeId,
      frameworkId,
      name,
      description,
      urnValue,
      refId,
      parentUrn,
      level,
      order,
      assessable ? 1 : 0,
      annotation,
      JSON.stringify(implementationGroups),
      JSON.stringify(threats),
      JSON.stringify(referenceControls),
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcRequirementNodeUpserted", command.tenant_id, nodeId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        node_id: nodeId,
        framework_id: frameworkId,
        name,
        urn: urnValue,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 5. grc.reference-control.upsert
async function handleReferenceControlUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const controlId = readString(payload, "id") || command.command_id;
  const frameworkId = readOptionalString(payload, "framework_id");
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const urnValue = readOptionalString(payload, "urn");
  const refId = readOptionalString(payload, "ref_id");
  const category = readOptionalString(payload, "category");
  const provider = readOptionalString(payload, "provider");
  const annotation = readOptionalString(payload, "annotation");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_reference_controls (
       tenant_id, id, framework_id, name, description, urn, ref_id,
       category, provider, annotation, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       framework_id = excluded.framework_id,
       name = excluded.name,
       description = excluded.description,
       urn = excluded.urn,
       ref_id = excluded.ref_id,
       category = excluded.category,
       provider = excluded.provider,
       annotation = excluded.annotation,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      controlId,
      frameworkId,
      name,
      description,
      urnValue,
      refId,
      category,
      provider,
      annotation,
      folderId,
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcReferenceControlUpserted", command.tenant_id, controlId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        control_id: controlId,
        framework_id: frameworkId,
        name,
        category,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 6. grc.applied-control.upsert
async function handleAppliedControlUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const controlId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const referenceControlId = readOptionalString(payload, "reference_control_id");
  const folderId = readOptionalString(payload, "folder_id");
  const category = readOptionalString(payload, "category");
  const status = readString(payload, "status") || "planned";
  const eta = readOptionalString(payload, "eta");
  const effort = readOptionalString(payload, "effort");
  const cost = readNumber(payload, "cost");
  const loa = readNumber(payload, "loa");
  const expiry = readOptionalString(payload, "expiry_date");
  const link = readOptionalString(payload, "link");
  const owner = readOptionalString(payload, "owner");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_applied_controls (
       tenant_id, id, name, description, reference_control_id, folder_id,
       category, status, eta, effort, cost, loa, expiry_date, link, owner,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       reference_control_id = excluded.reference_control_id,
       folder_id = excluded.folder_id,
       category = excluded.category,
       status = excluded.status,
       eta = excluded.eta,
       effort = excluded.effort,
       cost = excluded.cost,
       loa = excluded.loa,
       expiry_date = excluded.expiry_date,
       link = excluded.link,
       owner = excluded.owner,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      controlId,
      name,
      description,
      referenceControlId,
      folderId,
      category,
      status,
      eta,
      effort,
      cost,
      loa,
      expiry,
      link,
      owner,
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcAppliedControlUpserted", command.tenant_id, controlId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        control_id: controlId,
        name,
        status,
        reference_control_id: referenceControlId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 7. grc.policy.upsert
async function handlePolicyUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const policyId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const folderId = readOptionalString(payload, "folder_id");
  const status = readString(payload, "status") || "draft";
  const eta = readOptionalString(payload, "eta");
  const effort = readOptionalString(payload, "effort");
  const cost = readNumber(payload, "cost");
  const link = readOptionalString(payload, "link");
  const owner = readOptionalString(payload, "owner");
  const referenceControlId = readOptionalString(payload, "reference_control_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_policies (
       tenant_id, id, name, description, folder_id, status, eta,
       effort, cost, link, owner, reference_control_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       folder_id = excluded.folder_id,
       status = excluded.status,
       eta = excluded.eta,
       effort = excluded.effort,
       cost = excluded.cost,
       link = excluded.link,
       owner = excluded.owner,
       reference_control_id = excluded.reference_control_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      policyId,
      name,
      description,
      folderId,
      status,
      eta,
      effort,
      cost,
      link,
      owner,
      referenceControlId,
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcPolicyUpserted", command.tenant_id, policyId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        policy_id: policyId,
        name,
        status,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 8. grc.risk-matrix.upsert
async function handleRiskMatrixUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const matrixId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const urnValue = readOptionalString(payload, "urn");
  const refId = readOptionalString(payload, "ref_id");
  const locale = readString(payload, "locale") || "en";
  const defaultLocale = readBoolean(payload, "default_locale") ?? true;
  const provider = readOptionalString(payload, "provider");
  const folderId = readOptionalString(payload, "folder_id");
  const jsonDefinition = isRecord(payload.json_definition)
    ? payload.json_definition
    : {};

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_risk_matrices (
       tenant_id, id, name, description, urn, ref_id, locale,
       default_locale, provider, folder_id, json_definition,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       urn = excluded.urn,
       ref_id = excluded.ref_id,
       locale = excluded.locale,
       default_locale = excluded.default_locale,
       provider = excluded.provider,
       folder_id = excluded.folder_id,
       json_definition = excluded.json_definition,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      matrixId,
      name,
      description,
      urnValue,
      refId,
      locale,
      defaultLocale ? 1 : 0,
      provider,
      folderId,
      JSON.stringify(jsonDefinition),
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcRiskMatrixUpserted", command.tenant_id, matrixId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        matrix_id: matrixId,
        name,
        urn: urnValue,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 9. grc.threat.upsert
async function handleThreatUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const threatId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const urnValue = readOptionalString(payload, "urn");
  const refId = readOptionalString(payload, "ref_id");
  const provider = readOptionalString(payload, "provider");
  const annotation = readOptionalString(payload, "annotation");
  const folderId = readOptionalString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_threats (
       tenant_id, id, name, description, urn, ref_id, provider,
       annotation, folder_id, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       urn = excluded.urn,
       ref_id = excluded.ref_id,
       provider = excluded.provider,
       annotation = excluded.annotation,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      threatId,
      name,
      description,
      urnValue,
      refId,
      provider,
      annotation,
      folderId,
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcThreatUpserted", command.tenant_id, threatId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        threat_id: threatId,
        name,
        urn: urnValue,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 10. grc.vulnerability.upsert
async function handleVulnerabilityUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const vulnId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const urnValue = readOptionalString(payload, "urn");
  const refId = readOptionalString(payload, "ref_id");
  const provider = readOptionalString(payload, "provider");
  const annotation = readOptionalString(payload, "annotation");
  const folderId = readOptionalString(payload, "folder_id");
  const severity = readOptionalString(payload, "severity");
  const status = readString(payload, "status") || "open";

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_vulnerabilities (
       tenant_id, id, name, description, urn, ref_id, provider,
       annotation, folder_id, severity, status, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       urn = excluded.urn,
       ref_id = excluded.ref_id,
       provider = excluded.provider,
       annotation = excluded.annotation,
       folder_id = excluded.folder_id,
       severity = excluded.severity,
       status = excluded.status,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      vulnId,
      name,
      description,
      urnValue,
      refId,
      provider,
      annotation,
      folderId,
      severity,
      status,
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcVulnerabilityUpserted", command.tenant_id, vulnId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        vulnerability_id: vulnId,
        name,
        severity,
        status,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 11. grc.risk-assessment.upsert
async function handleRiskAssessmentUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const assessmentId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const folderId = readOptionalString(payload, "folder_id");
  const riskMatrixId = readOptionalString(payload, "risk_matrix_id");
  const projectId = readOptionalString(payload, "project_id");
  const version = readString(payload, "version") || "1.0";
  const status = readString(payload, "status") || "planned";
  const eta = readOptionalString(payload, "eta");
  const dueDate = readOptionalString(payload, "due_date");
  const authors = readArray(payload, "authors");
  const reviewers = readArray(payload, "reviewers");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_risk_assessments (
       tenant_id, id, name, description, folder_id, risk_matrix_id,
       project_id, version, status, eta, due_date,
       authors_json, reviewers_json, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       folder_id = excluded.folder_id,
       risk_matrix_id = excluded.risk_matrix_id,
       project_id = excluded.project_id,
       version = excluded.version,
       status = excluded.status,
       eta = excluded.eta,
       due_date = excluded.due_date,
       authors_json = excluded.authors_json,
       reviewers_json = excluded.reviewers_json,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      assessmentId,
      name,
      description,
      folderId,
      riskMatrixId,
      projectId,
      version,
      status,
      eta,
      dueDate,
      JSON.stringify(authors),
      JSON.stringify(reviewers),
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcRiskAssessmentUpserted", command.tenant_id, assessmentId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        assessment_id: assessmentId,
        name,
        status,
        risk_matrix_id: riskMatrixId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 12. grc.risk-scenario.upsert
async function handleRiskScenarioUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const scenarioId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const riskAssessmentId = readOptionalString(payload, "risk_assessment_id");
  const folderId = readOptionalString(payload, "folder_id");
  const threatId = readOptionalString(payload, "threat_id");
  const owner = readOptionalString(payload, "owner");
  const treatment = readString(payload, "treatment") || "untreated";
  const qualificationId = readOptionalString(payload, "qualification");
  const existingControls = readArray(payload, "existing_controls");
  const appliedControls = readArray(payload, "applied_controls");
  const assets = readArray(payload, "assets");
  const vulnerabilities = readArray(payload, "vulnerabilities");

  // Current risk levels
  const currentProba = readNumber(payload, "current_proba") ?? -1;
  const currentImpact = readNumber(payload, "current_impact") ?? -1;
  const currentLevel = readNumber(payload, "current_level") ?? -1;

  // Residual risk levels (after applied controls)
  const residualProba = readNumber(payload, "residual_proba") ?? -1;
  const residualImpact = readNumber(payload, "residual_impact") ?? -1;
  const residualLevel = readNumber(payload, "residual_level") ?? -1;

  const strengthOfKnowledge = readNumber(payload, "strength_of_knowledge") ?? -1;
  const justification = readOptionalString(payload, "justification");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_risk_scenarios (
       tenant_id, id, name, description, risk_assessment_id, folder_id,
       threat_id, owner, treatment, qualification,
       existing_controls_json, applied_controls_json, assets_json,
       vulnerabilities_json, current_proba, current_impact, current_level,
       residual_proba, residual_impact, residual_level,
       strength_of_knowledge, justification, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       risk_assessment_id = excluded.risk_assessment_id,
       folder_id = excluded.folder_id,
       threat_id = excluded.threat_id,
       owner = excluded.owner,
       treatment = excluded.treatment,
       qualification = excluded.qualification,
       existing_controls_json = excluded.existing_controls_json,
       applied_controls_json = excluded.applied_controls_json,
       assets_json = excluded.assets_json,
       vulnerabilities_json = excluded.vulnerabilities_json,
       current_proba = excluded.current_proba,
       current_impact = excluded.current_impact,
       current_level = excluded.current_level,
       residual_proba = excluded.residual_proba,
       residual_impact = excluded.residual_impact,
       residual_level = excluded.residual_level,
       strength_of_knowledge = excluded.strength_of_knowledge,
       justification = excluded.justification,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      scenarioId,
      name,
      description,
      riskAssessmentId,
      folderId,
      threatId,
      owner,
      treatment,
      qualificationId,
      JSON.stringify(existingControls),
      JSON.stringify(appliedControls),
      JSON.stringify(assets),
      JSON.stringify(vulnerabilities),
      currentProba,
      currentImpact,
      currentLevel,
      residualProba,
      residualImpact,
      residualLevel,
      strengthOfKnowledge,
      justification,
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcRiskScenarioUpserted", command.tenant_id, scenarioId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        scenario_id: scenarioId,
        name,
        treatment,
        risk_assessment_id: riskAssessmentId,
        current_level: currentLevel,
        residual_level: residualLevel,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 13. grc.risk-acceptance.upsert
async function handleRiskAcceptanceUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const acceptanceId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const folderId = readOptionalString(payload, "folder_id");
  const state = readString(payload, "state") || "created";
  const expiryDate = readOptionalString(payload, "expiry_date");
  const justification = readOptionalString(payload, "justification");
  const approver = readOptionalString(payload, "approver");
  const riskScenarios = readArray(payload, "risk_scenarios");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_risk_acceptances (
       tenant_id, id, name, description, folder_id, state,
       expiry_date, justification, approver, risk_scenarios_json,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       folder_id = excluded.folder_id,
       state = excluded.state,
       expiry_date = excluded.expiry_date,
       justification = excluded.justification,
       approver = excluded.approver,
       risk_scenarios_json = excluded.risk_scenarios_json,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      acceptanceId,
      name,
      description,
      folderId,
      state,
      expiryDate,
      justification,
      approver,
      JSON.stringify(riskScenarios),
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcRiskAcceptanceUpserted", command.tenant_id, acceptanceId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        acceptance_id: acceptanceId,
        name,
        state,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 14. grc.risk-acceptance.approve
async function handleRiskAcceptanceApprove(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const acceptanceId = readString(payload, "id");

  if (!acceptanceId) {
    throw new Error("grc.risk-acceptance.approve requires payload.id");
  }

  // Verify existence and fetch current state
  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT state, name
     FROM grc_risk_acceptances
     WHERE tenant_id = ? AND id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, acceptanceId)
    .first<{ state: string; name: string }>();

  if (!existing) {
    throw new Error(`Risk acceptance '${acceptanceId}' not found for tenant '${command.tenant_id}'`);
  }

  await env.APP_D1_MAIN.prepare(
    `UPDATE grc_risk_acceptances
     SET state = 'accepted', accepted_at = ?, updated_at = ?
     WHERE tenant_id = ? AND id = ?`
  )
    .bind(now, now, command.tenant_id, acceptanceId)
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcRiskAcceptanceApproved", command.tenant_id, acceptanceId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        acceptance_id: acceptanceId,
        name: existing.name,
        previous_state: existing.state,
        accepted_at: now,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 15. grc.risk-acceptance.reject
async function handleRiskAcceptanceReject(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const acceptanceId = readString(payload, "id");

  if (!acceptanceId) {
    throw new Error("grc.risk-acceptance.reject requires payload.id");
  }

  // Verify existence and fetch current state
  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT state, name
     FROM grc_risk_acceptances
     WHERE tenant_id = ? AND id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, acceptanceId)
    .first<{ state: string; name: string }>();

  if (!existing) {
    throw new Error(`Risk acceptance '${acceptanceId}' not found for tenant '${command.tenant_id}'`);
  }

  await env.APP_D1_MAIN.prepare(
    `UPDATE grc_risk_acceptances
     SET state = 'rejected', rejected_at = ?, updated_at = ?
     WHERE tenant_id = ? AND id = ?`
  )
    .bind(now, now, command.tenant_id, acceptanceId)
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcRiskAcceptanceRejected", command.tenant_id, acceptanceId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        acceptance_id: acceptanceId,
        name: existing.name,
        previous_state: existing.state,
        rejected_at: now,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 16. grc.evidence.upsert
async function handleEvidenceUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const evidenceId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const folderId = readOptionalString(payload, "folder_id");
  const link = readOptionalString(payload, "link");
  const appliedControls = readArray(payload, "applied_controls");
  const requirementAssessments = readArray(payload, "requirement_assessments");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_evidences (
       tenant_id, id, name, description, folder_id, link,
       applied_controls_json, requirement_assessments_json,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       folder_id = excluded.folder_id,
       link = excluded.link,
       applied_controls_json = excluded.applied_controls_json,
       requirement_assessments_json = excluded.requirement_assessments_json,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      evidenceId,
      name,
      description,
      folderId,
      link,
      JSON.stringify(appliedControls),
      JSON.stringify(requirementAssessments),
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcEvidenceUpserted", command.tenant_id, evidenceId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        evidence_id: evidenceId,
        name,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 17. grc.evidence.upload
async function handleEvidenceUpload(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const evidenceId = readString(payload, "id") || readString(payload, "evidence_id");
  const fileName = readString(payload, "file_name");
  const contentType = readString(payload, "content_type") || "application/octet-stream";
  const fileSize = readNumber(payload, "file_size");

  if (!evidenceId) {
    throw new Error("grc.evidence.upload requires payload.id or payload.evidence_id");
  }

  // Build the R2 object key
  const r2Key = `evidence/${command.tenant_id}/${evidenceId}/${fileName || "attachment"}`;

  // Update the evidence record with the R2 key reference
  await env.APP_D1_MAIN.prepare(
    `UPDATE grc_evidences
     SET r2_key = ?, file_name = ?, content_type = ?, file_size = ?,
         updated_at = ?
     WHERE tenant_id = ? AND id = ?`
  )
    .bind(
      r2Key,
      fileName,
      contentType,
      fileSize,
      now,
      command.tenant_id,
      evidenceId
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcEvidenceUploaded", command.tenant_id, evidenceId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        evidence_id: evidenceId,
        r2_key: r2Key,
        file_name: fileName,
        content_type: contentType,
        file_size: fileSize,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 18. grc.compliance-assessment.upsert
async function handleComplianceAssessmentUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const assessmentId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const folderId = readOptionalString(payload, "folder_id");
  const frameworkId = readOptionalString(payload, "framework_id");
  const projectId = readOptionalString(payload, "project_id");
  const version = readString(payload, "version") || "1.0";
  const status = readString(payload, "status") || "planned";
  const eta = readOptionalString(payload, "eta");
  const dueDate = readOptionalString(payload, "due_date");
  const selectedImplementationGroups = readArray(payload, "selected_implementation_groups");
  const authors = readArray(payload, "authors");
  const reviewers = readArray(payload, "reviewers");
  const baseline = readOptionalString(payload, "baseline");
  const score = readNumber(payload, "score");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_compliance_assessments (
       tenant_id, id, name, description, folder_id, framework_id,
       project_id, version, status, eta, due_date,
       selected_implementation_groups_json, authors_json, reviewers_json,
       baseline, score, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       folder_id = excluded.folder_id,
       framework_id = excluded.framework_id,
       project_id = excluded.project_id,
       version = excluded.version,
       status = excluded.status,
       eta = excluded.eta,
       due_date = excluded.due_date,
       selected_implementation_groups_json = excluded.selected_implementation_groups_json,
       authors_json = excluded.authors_json,
       reviewers_json = excluded.reviewers_json,
       baseline = excluded.baseline,
       score = excluded.score,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      assessmentId,
      name,
      description,
      folderId,
      frameworkId,
      projectId,
      version,
      status,
      eta,
      dueDate,
      JSON.stringify(selectedImplementationGroups),
      JSON.stringify(authors),
      JSON.stringify(reviewers),
      baseline,
      score,
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcComplianceAssessmentUpserted", command.tenant_id, assessmentId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        assessment_id: assessmentId,
        name,
        status,
        framework_id: frameworkId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 19. grc.requirement-assessment.upsert
async function handleRequirementAssessmentUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const assessmentId = readString(payload, "id") || command.command_id;
  const complianceAssessmentId = readOptionalString(payload, "compliance_assessment_id");
  const requirementId = readOptionalString(payload, "requirement_id");
  const status = readString(payload, "status") || "to_do";
  const result = readString(payload, "result") || "not_assessed";
  const score = readNumber(payload, "score");
  const observation = readOptionalString(payload, "observation");
  const appliedControls = readArray(payload, "applied_controls");
  const evidences = readArray(payload, "evidences");
  const mappingInference = readOptionalString(payload, "mapping_inference");
  const selectedImplementationGroups = readArray(payload, "selected_implementation_groups");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_requirement_assessments (
       tenant_id, id, compliance_assessment_id, requirement_id,
       status, result, score, observation,
       applied_controls_json, evidences_json, mapping_inference,
       selected_implementation_groups_json, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       compliance_assessment_id = excluded.compliance_assessment_id,
       requirement_id = excluded.requirement_id,
       status = excluded.status,
       result = excluded.result,
       score = excluded.score,
       observation = excluded.observation,
       applied_controls_json = excluded.applied_controls_json,
       evidences_json = excluded.evidences_json,
       mapping_inference = excluded.mapping_inference,
       selected_implementation_groups_json = excluded.selected_implementation_groups_json,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      assessmentId,
      complianceAssessmentId,
      requirementId,
      status,
      result,
      score,
      observation,
      JSON.stringify(appliedControls),
      JSON.stringify(evidences),
      mappingInference,
      JSON.stringify(selectedImplementationGroups),
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcRequirementAssessmentUpserted", command.tenant_id, assessmentId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        assessment_id: assessmentId,
        compliance_assessment_id: complianceAssessmentId,
        requirement_id: requirementId,
        status,
        result,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 20. grc.requirement-assessment.bulk-update
async function handleRequirementAssessmentBulkUpdate(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const items = readArray(payload, "items");
  const events: DomainEventEnvelope[] = [];

  if (items.length === 0) {
    throw new Error("grc.requirement-assessment.bulk-update requires a non-empty payload.items array");
  }

  for (const rawItem of items) {
    if (!isRecord(rawItem)) continue;

    const assessmentId = readString(rawItem, "id");
    if (!assessmentId) continue;

    const status = readOptionalString(rawItem, "status");
    const result = readOptionalString(rawItem, "result");
    const score = readNumber(rawItem, "score");
    const observation = readOptionalString(rawItem, "observation");

    // Build dynamic SET clause for only provided fields
    const setClauses: string[] = ["updated_at = ?"];
    const bindValues: (string | number | null)[] = [now];

    if (status !== null) {
      setClauses.push("status = ?");
      bindValues.push(status);
    }
    if (result !== null) {
      setClauses.push("result = ?");
      bindValues.push(result);
    }
    if (score !== null) {
      setClauses.push("score = ?");
      bindValues.push(score);
    }
    if (observation !== null) {
      setClauses.push("observation = ?");
      bindValues.push(observation);
    }

    // Add WHERE clause binds
    bindValues.push(command.tenant_id);
    bindValues.push(assessmentId);

    await env.APP_D1_MAIN.prepare(
      `UPDATE grc_requirement_assessments
       SET ${setClauses.join(", ")}
       WHERE tenant_id = ? AND id = ?`
    )
      .bind(...bindValues)
      .run();

    events.push(
      makeEvent("GrcRequirementAssessmentUpdated", command.tenant_id, assessmentId, {
        command_id: command.command_id,
        tenant_id: command.tenant_id,
        assessment_id: assessmentId,
        status,
        result,
        score,
        bulk: true,
        executed_at: now
      })
    );
  }

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events,
    finalizeJob: true
  };
}

// 21. grc.finding.upsert
async function handleFindingUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const findingId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const folderId = readOptionalString(payload, "folder_id");
  const complianceAssessmentId = readOptionalString(payload, "compliance_assessment_id");
  const status = readString(payload, "status") || "open";
  const severity = readOptionalString(payload, "severity");
  const recommendation = readOptionalString(payload, "recommendation");
  const dueDate = readOptionalString(payload, "due_date");
  const appliedControls = readArray(payload, "applied_controls");
  const requirementAssessments = readArray(payload, "requirement_assessments");
  const owner = readOptionalString(payload, "owner");
  const reference = readOptionalString(payload, "reference");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_findings (
       tenant_id, id, name, description, folder_id,
       compliance_assessment_id, status, severity, recommendation,
       due_date, applied_controls_json, requirement_assessments_json,
       owner, reference, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       folder_id = excluded.folder_id,
       compliance_assessment_id = excluded.compliance_assessment_id,
       status = excluded.status,
       severity = excluded.severity,
       recommendation = excluded.recommendation,
       due_date = excluded.due_date,
       applied_controls_json = excluded.applied_controls_json,
       requirement_assessments_json = excluded.requirement_assessments_json,
       owner = excluded.owner,
       reference = excluded.reference,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      findingId,
      name,
      description,
      folderId,
      complianceAssessmentId,
      status,
      severity,
      recommendation,
      dueDate,
      JSON.stringify(appliedControls),
      JSON.stringify(requirementAssessments),
      owner,
      reference,
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcFindingUpserted", command.tenant_id, findingId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        finding_id: findingId,
        name,
        status,
        severity,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 22. grc.finding.close
async function handleFindingClose(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const findingId = readString(payload, "id");

  if (!findingId) {
    throw new Error("grc.finding.close requires payload.id");
  }

  // Verify existence and fetch current state
  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT status, name
     FROM grc_findings
     WHERE tenant_id = ? AND id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, findingId)
    .first<{ status: string; name: string }>();

  if (!existing) {
    throw new Error(`Finding '${findingId}' not found for tenant '${command.tenant_id}'`);
  }

  await env.APP_D1_MAIN.prepare(
    `UPDATE grc_findings
     SET status = 'closed', closed_date = ?, updated_at = ?
     WHERE tenant_id = ? AND id = ?`
  )
    .bind(now, now, command.tenant_id, findingId)
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcFindingClosed", command.tenant_id, findingId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        finding_id: findingId,
        name: existing.name,
        previous_status: existing.status,
        closed_date: now,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 23. grc.filtering-label.upsert
async function handleFilteringLabelUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const labelId = readString(payload, "id") || command.command_id;
  const label = readString(payload, "label");
  const description = readString(payload, "description");
  const folderId = readOptionalString(payload, "folder_id");
  const color = readOptionalString(payload, "color");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_filtering_labels (
       tenant_id, id, label, description, folder_id, color,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       label = excluded.label,
       description = excluded.description,
       folder_id = excluded.folder_id,
       color = excluded.color,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      labelId,
      label,
      description,
      folderId,
      color,
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcFilteringLabelUpserted", command.tenant_id, labelId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        label_id: labelId,
        label,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 24. grc.campaign.upsert
async function handleCampaignUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const campaignId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const folderId = readOptionalString(payload, "folder_id");
  const status = readString(payload, "status") || "planned";
  const startDate = readOptionalString(payload, "start_date");
  const endDate = readOptionalString(payload, "end_date");
  const complianceAssessments = readArray(payload, "compliance_assessments");
  const riskAssessments = readArray(payload, "risk_assessments");
  const owner = readOptionalString(payload, "owner");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_campaigns (
       tenant_id, id, name, description, folder_id, status,
       start_date, end_date, compliance_assessments_json,
       risk_assessments_json, owner, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       folder_id = excluded.folder_id,
       status = excluded.status,
       start_date = excluded.start_date,
       end_date = excluded.end_date,
       compliance_assessments_json = excluded.compliance_assessments_json,
       risk_assessments_json = excluded.risk_assessments_json,
       owner = excluded.owner,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      campaignId,
      name,
      description,
      folderId,
      status,
      startDate,
      endDate,
      JSON.stringify(complianceAssessments),
      JSON.stringify(riskAssessments),
      owner,
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcCampaignUpserted", command.tenant_id, campaignId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        campaign_id: campaignId,
        name,
        status,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 25. grc.requirement-mapping-set.upsert
async function handleRequirementMappingSetUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const mappingSetId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const urnValue = readOptionalString(payload, "urn");
  const refId = readOptionalString(payload, "ref_id");
  const sourceFrameworkId = readOptionalString(payload, "source_framework_id");
  const targetFrameworkId = readOptionalString(payload, "target_framework_id");
  const provider = readOptionalString(payload, "provider");
  const folderId = readOptionalString(payload, "folder_id");
  const mappings = readArray(payload, "mappings");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_requirement_mapping_sets (
       tenant_id, id, name, description, urn, ref_id,
       source_framework_id, target_framework_id, provider,
       folder_id, mappings_json, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       urn = excluded.urn,
       ref_id = excluded.ref_id,
       source_framework_id = excluded.source_framework_id,
       target_framework_id = excluded.target_framework_id,
       provider = excluded.provider,
       folder_id = excluded.folder_id,
       mappings_json = excluded.mappings_json,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      mappingSetId,
      name,
      description,
      urnValue,
      refId,
      sourceFrameworkId,
      targetFrameworkId,
      provider,
      folderId,
      JSON.stringify(mappings),
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcRequirementMappingSetUpserted", command.tenant_id, mappingSetId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        mapping_set_id: mappingSetId,
        name,
        source_framework_id: sourceFrameworkId,
        target_framework_id: targetFrameworkId,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// 26. grc.asset.upsert
async function handleAssetUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const assetId = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const folderId = readOptionalString(payload, "folder_id");
  const businessValue = readOptionalString(payload, "business_value");
  const assetType = readString(payload, "type") || "support";
  const owner = readOptionalString(payload, "owner");
  const parentAssets = readArray(payload, "parent_assets");
  const filteringLabels = readArray(payload, "filtering_labels");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO grc_assets (
       tenant_id, id, name, description, folder_id, business_value,
       type, owner, parent_assets_json, filtering_labels_json,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       folder_id = excluded.folder_id,
       business_value = excluded.business_value,
       type = excluded.type,
       owner = excluded.owner,
       parent_assets_json = excluded.parent_assets_json,
       filtering_labels_json = excluded.filtering_labels_json,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      assetId,
      name,
      description,
      folderId,
      businessValue,
      assetType,
      owner,
      JSON.stringify(parentAssets),
      JSON.stringify(filteringLabels),
      now,
      now
    )
    .run();

  await refreshGrcOverviewProjection(env.APP_D1_MAIN, command.tenant_id, now);

  return {
    events: [
      makeEvent("GrcAssetUpserted", command.tenant_id, assetId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        asset_id: assetId,
        name,
        type: assetType,
        business_value: businessValue,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// ---------------------------------------------------------------------------
// Public command dispatcher
// ---------------------------------------------------------------------------

export async function handleCoreGrcCommand(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  switch (command.command_type) {
    case "grc.folder.upsert":
      return handleFolderUpsert(command, env);

    case "grc.framework.upsert":
      return handleFrameworkUpsert(command, env);

    case "grc.framework.import":
      return handleFrameworkImport(command, env);

    case "grc.requirement-node.upsert":
      return handleRequirementNodeUpsert(command, env);

    case "grc.reference-control.upsert":
      return handleReferenceControlUpsert(command, env);

    case "grc.applied-control.upsert":
      return handleAppliedControlUpsert(command, env);

    case "grc.policy.upsert":
      return handlePolicyUpsert(command, env);

    case "grc.risk-matrix.upsert":
      return handleRiskMatrixUpsert(command, env);

    case "grc.threat.upsert":
      return handleThreatUpsert(command, env);

    case "grc.vulnerability.upsert":
      return handleVulnerabilityUpsert(command, env);

    case "grc.risk-assessment.upsert":
      return handleRiskAssessmentUpsert(command, env);

    case "grc.risk-scenario.upsert":
      return handleRiskScenarioUpsert(command, env);

    case "grc.risk-acceptance.upsert":
      return handleRiskAcceptanceUpsert(command, env);

    case "grc.risk-acceptance.approve":
      return handleRiskAcceptanceApprove(command, env);

    case "grc.risk-acceptance.reject":
      return handleRiskAcceptanceReject(command, env);

    case "grc.evidence.upsert":
      return handleEvidenceUpsert(command, env);

    case "grc.evidence.upload":
      return handleEvidenceUpload(command, env);

    case "grc.compliance-assessment.upsert":
      return handleComplianceAssessmentUpsert(command, env);

    case "grc.requirement-assessment.upsert":
      return handleRequirementAssessmentUpsert(command, env);

    case "grc.requirement-assessment.bulk-update":
      return handleRequirementAssessmentBulkUpdate(command, env);

    case "grc.finding.upsert":
      return handleFindingUpsert(command, env);

    case "grc.finding.close":
      return handleFindingClose(command, env);

    case "grc.filtering-label.upsert":
      return handleFilteringLabelUpsert(command, env);

    case "grc.campaign.upsert":
      return handleCampaignUpsert(command, env);

    case "grc.requirement-mapping-set.upsert":
      return handleRequirementMappingSetUpsert(command, env);

    case "grc.asset.upsert":
      return handleAssetUpsert(command, env);

    default:
      throw new Error(`Unsupported core GRC command type: ${command.command_type}`);
  }
}
