/**
 * Assessment Artifact command handler.
 *
 * Handles CQRS commands for assessment artifact packages, items, and schedules.
 * This module is designed to be imported by command-worker.ts for dispatching
 * assessment-artifact.* command types.
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
// FedRAMP Moderate built-in template
// ---------------------------------------------------------------------------

interface TemplateItem {
  request_id: string;
  category: string;
  artifact_request: string;
  controls: string[];
  control_families: string[];
  primary_artifact_type: string;
  collection_channel: string;
  periodicity: string;
}

interface TemplateSchedule {
  name: string;
  description: string;
  frequency: string;
  cron_expression: string;
  control_families: string[];
  evidence_types: string[];
}

interface Template {
  name: string;
  package_type: string;
  items: TemplateItem[];
  schedules: TemplateSchedule[];
}

const FEDRAMP_MODERATE_TEMPLATE: Template = {
  name: "FedRAMP Moderate Baseline",
  package_type: "fedramp",
  items: [
    {
      request_id: "FRM-AC-01",
      category: "Access Control",
      artifact_request: "Access control policy and procedures documentation",
      controls: ["AC-1"],
      control_families: ["AC"],
      primary_artifact_type: "policy_document",
      collection_channel: "manual_collection",
      periodicity: "annual"
    },
    {
      request_id: "FRM-AC-02",
      category: "Access Control",
      artifact_request: "Account management evidence including provisioning and deprovisioning logs",
      controls: ["AC-2", "AC-2(1)", "AC-2(2)", "AC-2(3)", "AC-2(4)"],
      control_families: ["AC"],
      primary_artifact_type: "system_log",
      collection_channel: "automated_pull",
      periodicity: "monthly"
    },
    {
      request_id: "FRM-AC-03",
      category: "Access Control",
      artifact_request: "Access enforcement mechanism configuration and test results",
      controls: ["AC-3", "AC-3(3)"],
      control_families: ["AC"],
      primary_artifact_type: "configuration_snapshot",
      collection_channel: "automated_pull",
      periodicity: "quarterly"
    },
    {
      request_id: "FRM-AU-01",
      category: "Audit and Accountability",
      artifact_request: "Audit policy, procedures, and audit log retention evidence",
      controls: ["AU-1", "AU-11"],
      control_families: ["AU"],
      primary_artifact_type: "policy_document",
      collection_channel: "manual_collection",
      periodicity: "annual"
    },
    {
      request_id: "FRM-AU-02",
      category: "Audit and Accountability",
      artifact_request: "Audit event logs demonstrating content and review processes",
      controls: ["AU-2", "AU-3", "AU-6", "AU-6(1)", "AU-7", "AU-7(1)"],
      control_families: ["AU"],
      primary_artifact_type: "system_log",
      collection_channel: "automated_pull",
      periodicity: "monthly"
    },
    {
      request_id: "FRM-CA-01",
      category: "Security Assessment and Authorization",
      artifact_request: "Security assessment plan and assessment results",
      controls: ["CA-1", "CA-2", "CA-2(1)"],
      control_families: ["CA"],
      primary_artifact_type: "assessment_report",
      collection_channel: "manual_collection",
      periodicity: "annual"
    },
    {
      request_id: "FRM-CM-01",
      category: "Configuration Management",
      artifact_request: "Configuration management policy and baseline configurations",
      controls: ["CM-1", "CM-2", "CM-2(1)", "CM-6"],
      control_families: ["CM"],
      primary_artifact_type: "configuration_snapshot",
      collection_channel: "automated_pull",
      periodicity: "quarterly"
    },
    {
      request_id: "FRM-CM-02",
      category: "Configuration Management",
      artifact_request: "Configuration change control records and impact analysis",
      controls: ["CM-3", "CM-3(2)", "CM-4", "CM-5"],
      control_families: ["CM"],
      primary_artifact_type: "change_record",
      collection_channel: "automated_pull",
      periodicity: "monthly"
    },
    {
      request_id: "FRM-CP-01",
      category: "Contingency Planning",
      artifact_request: "Contingency plan, test results, and alternate site documentation",
      controls: ["CP-1", "CP-2", "CP-3", "CP-4", "CP-6", "CP-7"],
      control_families: ["CP"],
      primary_artifact_type: "plan_document",
      collection_channel: "manual_collection",
      periodicity: "annual"
    },
    {
      request_id: "FRM-IA-01",
      category: "Identification and Authentication",
      artifact_request: "Identification and authentication policy, MFA configuration, and credential management evidence",
      controls: ["IA-1", "IA-2", "IA-2(1)", "IA-2(2)", "IA-2(12)", "IA-5", "IA-5(1)"],
      control_families: ["IA"],
      primary_artifact_type: "configuration_snapshot",
      collection_channel: "automated_pull",
      periodicity: "quarterly"
    },
    {
      request_id: "FRM-IR-01",
      category: "Incident Response",
      artifact_request: "Incident response plan, training records, and incident reports",
      controls: ["IR-1", "IR-2", "IR-4", "IR-5", "IR-6", "IR-8"],
      control_families: ["IR"],
      primary_artifact_type: "plan_document",
      collection_channel: "manual_collection",
      periodicity: "annual"
    },
    {
      request_id: "FRM-RA-01",
      category: "Risk Assessment",
      artifact_request: "Risk assessment report and vulnerability scan results",
      controls: ["RA-1", "RA-3", "RA-5", "RA-5(1)", "RA-5(2)", "RA-5(5)"],
      control_families: ["RA"],
      primary_artifact_type: "scan_report",
      collection_channel: "automated_pull",
      periodicity: "monthly"
    },
    {
      request_id: "FRM-SA-01",
      category: "System and Services Acquisition",
      artifact_request: "System development lifecycle documentation and supply chain risk management plan",
      controls: ["SA-1", "SA-3", "SA-4", "SA-12"],
      control_families: ["SA"],
      primary_artifact_type: "plan_document",
      collection_channel: "manual_collection",
      periodicity: "annual"
    },
    {
      request_id: "FRM-SC-01",
      category: "System and Communications Protection",
      artifact_request: "Network architecture diagrams, encryption configuration, and boundary protection evidence",
      controls: ["SC-1", "SC-7", "SC-7(3)", "SC-7(4)", "SC-8", "SC-8(1)", "SC-12", "SC-13", "SC-28"],
      control_families: ["SC"],
      primary_artifact_type: "configuration_snapshot",
      collection_channel: "automated_pull",
      periodicity: "quarterly"
    },
    {
      request_id: "FRM-SI-01",
      category: "System and Information Integrity",
      artifact_request: "Flaw remediation evidence, malicious code protection, and monitoring tool configurations",
      controls: ["SI-1", "SI-2", "SI-3", "SI-4", "SI-5"],
      control_families: ["SI"],
      primary_artifact_type: "scan_report",
      collection_channel: "automated_pull",
      periodicity: "monthly"
    },
    {
      request_id: "FRM-PE-01",
      category: "Physical and Environmental Protection",
      artifact_request: "Physical access authorizations, monitoring logs, and environmental controls evidence",
      controls: ["PE-1", "PE-2", "PE-3", "PE-6", "PE-8"],
      control_families: ["PE"],
      primary_artifact_type: "access_log",
      collection_channel: "manual_collection",
      periodicity: "quarterly"
    }
  ],
  schedules: [
    {
      name: "Monthly Automated Collection",
      description: "Automated monthly collection for continuous monitoring artifacts",
      frequency: "monthly",
      cron_expression: "0 6 1 * *",
      control_families: ["AC", "AU", "CM", "RA", "SI"],
      evidence_types: ["system_log", "scan_report", "change_record"]
    },
    {
      name: "Quarterly Configuration Review",
      description: "Quarterly review of configuration baselines and access enforcement",
      frequency: "quarterly",
      cron_expression: "0 6 1 1,4,7,10 *",
      control_families: ["AC", "CM", "IA", "SC", "PE"],
      evidence_types: ["configuration_snapshot", "access_log"]
    },
    {
      name: "Annual Policy Review",
      description: "Annual review cycle for all policy and plan documents",
      frequency: "annual",
      cron_expression: "0 6 15 1 *",
      control_families: ["AC", "AU", "CA", "CP", "IR", "SA"],
      evidence_types: ["policy_document", "plan_document", "assessment_report"]
    }
  ]
};

const TEMPLATE_REGISTRY: Record<string, Template> = {
  "fedramp-moderate": FEDRAMP_MODERATE_TEMPLATE
};

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

async function refreshArtifactSummaryProjection(
  db: D1Database,
  tenantId: string,
  packageId: string,
  now: string
): Promise<void> {
  // Fetch current package metadata
  const pkg = await db
    .prepare(
      `SELECT name, status, package_type, system_name, platform_tags_json
       FROM assessment_artifact_packages
       WHERE tenant_id = ? AND package_id = ?
       LIMIT 1`
    )
    .bind(tenantId, packageId)
    .first<Record<string, unknown>>();

  if (!pkg) {
    return;
  }

  // Count items
  const itemCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM assessment_artifact_items
       WHERE tenant_id = ? AND package_id = ?`
    )
    .bind(tenantId, packageId)
    .first<{ cnt: number }>();

  // Count schedules
  const scheduleCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM assessment_artifact_schedules
       WHERE tenant_id = ? AND package_id = ?`
    )
    .bind(tenantId, packageId)
    .first<{ cnt: number }>();

  // Compute periodicity breakdown
  const periodicityRows = await db
    .prepare(
      `SELECT periodicity, COUNT(*) AS cnt
       FROM assessment_artifact_items
       WHERE tenant_id = ? AND package_id = ?
       GROUP BY periodicity`
    )
    .bind(tenantId, packageId)
    .all<{ periodicity: string; cnt: number }>();

  const periodicityBreakdown: Record<string, number> = {};
  for (const row of periodicityRows.results ?? []) {
    periodicityBreakdown[row.periodicity] = row.cnt;
  }

  // Derive quality gate from package quality_report_json if available
  const qualityRow = await db
    .prepare(
      `SELECT quality_report_json
       FROM assessment_artifact_packages
       WHERE tenant_id = ? AND package_id = ?
       LIMIT 1`
    )
    .bind(tenantId, packageId)
    .first<{ quality_report_json: string }>();

  let qualityGate = "pass";
  if (qualityRow?.quality_report_json) {
    try {
      const report = JSON.parse(qualityRow.quality_report_json);
      if (isRecord(report) && typeof report.gate === "string") {
        qualityGate = report.gate;
      }
    } catch {
      // Malformed JSON; default to pass
    }
  }

  await db
    .prepare(
      `INSERT INTO rm_assessment_artifact_summary (
         tenant_id, package_id, name, status, package_type, system_name,
         total_items, schedule_count, platform_tags_json, quality_gate,
         periodicity_breakdown_json, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, package_id)
       DO UPDATE SET
         name = excluded.name,
         status = excluded.status,
         package_type = excluded.package_type,
         system_name = excluded.system_name,
         total_items = excluded.total_items,
         schedule_count = excluded.schedule_count,
         platform_tags_json = excluded.platform_tags_json,
         quality_gate = excluded.quality_gate,
         periodicity_breakdown_json = excluded.periodicity_breakdown_json,
         updated_at = excluded.updated_at`
    )
    .bind(
      tenantId,
      packageId,
      readString(pkg, "name"),
      readString(pkg, "status") || "draft",
      readString(pkg, "package_type") || "fedramp",
      readString(pkg, "system_name"),
      itemCount?.cnt ?? 0,
      scheduleCount?.cnt ?? 0,
      readString(pkg, "platform_tags_json") || "[]",
      qualityGate,
      JSON.stringify(periodicityBreakdown),
      now
    )
    .run();
}

// ---------------------------------------------------------------------------
// Individual command handlers
// ---------------------------------------------------------------------------

async function handlePackageUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const packageId = readString(payload, "package_id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const status = readString(payload, "status") || "draft";
  const packageType = readString(payload, "package_type") || "fedramp";
  const systemName = readString(payload, "system_name");
  const platformTags = readArray(payload, "platform_tags");
  const collectionPlaybooks = readArray(payload, "collection_playbooks");
  const qualityReport = isRecord(payload.quality_report) ? payload.quality_report : {};
  const indexes = isRecord(payload.indexes) ? payload.indexes : {};
  const sourceFile = readString(payload, "source_file");
  const templateKey = readString(payload, "template_key");
  const stats = isRecord(payload.stats) ? payload.stats : {};

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO assessment_artifact_packages (
       tenant_id, package_id, name, description, status, package_type,
       system_name, platform_tags_json, stats_json, collection_playbooks_json,
       quality_report_json, indexes_json, source_file, template_key,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, package_id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       package_type = excluded.package_type,
       system_name = excluded.system_name,
       platform_tags_json = excluded.platform_tags_json,
       stats_json = excluded.stats_json,
       collection_playbooks_json = excluded.collection_playbooks_json,
       quality_report_json = excluded.quality_report_json,
       indexes_json = excluded.indexes_json,
       source_file = excluded.source_file,
       template_key = excluded.template_key,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      packageId,
      name,
      description,
      status,
      packageType,
      systemName,
      JSON.stringify(platformTags),
      JSON.stringify(stats),
      JSON.stringify(collectionPlaybooks),
      JSON.stringify(qualityReport),
      JSON.stringify(indexes),
      sourceFile,
      templateKey,
      now,
      now
    )
    .run();

  await refreshArtifactSummaryProjection(env.APP_D1_MAIN, command.tenant_id, packageId, now);

  return {
    events: [
      makeEvent("AssessmentArtifactPackageUpserted", command.tenant_id, packageId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        package_id: packageId,
        name,
        status,
        package_type: packageType,
        system_name: systemName,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleItemUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const itemId = readString(payload, "item_id") || command.command_id;
  const packageId = readString(payload, "package_id");
  const requestId = readString(payload, "request_id");
  const sourceLine = readNumber(payload, "source_line") ?? 0;
  const category = readString(payload, "category");
  const artifactRequest = readString(payload, "artifact_request");
  const controls = readArray(payload, "controls");
  const controlFamilies = readArray(payload, "control_families");
  const controlDomains = readArray(payload, "control_domains");
  const workstreams = readArray(payload, "workstreams");
  const primaryArtifactType = readString(payload, "primary_artifact_type") || "generic_evidence";
  const artifactTypes = readArray(payload, "artifact_types");
  const collectionChannel = readString(payload, "collection_channel") || "manual_collection";
  const platformTags = readArray(payload, "platform_tags");
  const timeScopes = readArray(payload, "time_scopes");
  const periodicity = readString(payload, "periodicity") || "on_demand";
  const commands = readArray(payload, "commands");
  const configPaths = readArray(payload, "config_paths");
  const bundleHint = isRecord(payload.bundle_hint) ? payload.bundle_hint : {};

  if (!packageId) {
    throw new Error("assessment-artifact.item.upsert requires payload.package_id");
  }

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO assessment_artifact_items (
       tenant_id, item_id, package_id, request_id, source_line, category,
       artifact_request, controls_json, control_families_json, control_domains_json,
       workstreams_json, primary_artifact_type, artifact_types_json,
       collection_channel, platform_tags_json, time_scopes_json, periodicity,
       commands_json, config_paths_json, bundle_hint_json,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, item_id)
     DO UPDATE SET
       package_id = excluded.package_id,
       request_id = excluded.request_id,
       source_line = excluded.source_line,
       category = excluded.category,
       artifact_request = excluded.artifact_request,
       controls_json = excluded.controls_json,
       control_families_json = excluded.control_families_json,
       control_domains_json = excluded.control_domains_json,
       workstreams_json = excluded.workstreams_json,
       primary_artifact_type = excluded.primary_artifact_type,
       artifact_types_json = excluded.artifact_types_json,
       collection_channel = excluded.collection_channel,
       platform_tags_json = excluded.platform_tags_json,
       time_scopes_json = excluded.time_scopes_json,
       periodicity = excluded.periodicity,
       commands_json = excluded.commands_json,
       config_paths_json = excluded.config_paths_json,
       bundle_hint_json = excluded.bundle_hint_json,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      itemId,
      packageId,
      requestId,
      sourceLine,
      category,
      artifactRequest,
      JSON.stringify(controls),
      JSON.stringify(controlFamilies),
      JSON.stringify(controlDomains),
      JSON.stringify(workstreams),
      primaryArtifactType,
      JSON.stringify(artifactTypes),
      collectionChannel,
      JSON.stringify(platformTags),
      JSON.stringify(timeScopes),
      periodicity,
      JSON.stringify(commands),
      JSON.stringify(configPaths),
      JSON.stringify(bundleHint),
      now,
      now
    )
    .run();

  await refreshArtifactSummaryProjection(env.APP_D1_MAIN, command.tenant_id, packageId, now);

  return {
    events: [
      makeEvent("AssessmentArtifactItemUpserted", command.tenant_id, itemId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        item_id: itemId,
        package_id: packageId,
        request_id: requestId,
        category,
        primary_artifact_type: primaryArtifactType,
        periodicity,
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
  const scheduleId = readString(payload, "schedule_id") || command.command_id;
  const packageId = readString(payload, "package_id");
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const frequency = readString(payload, "frequency") || "monthly";
  const status = readString(payload, "status") || "active";
  const cronExpression = readString(payload, "cron_expression");
  const controlFamilies = readArray(payload, "control_families");
  const controls = readArray(payload, "controls");
  const evidenceTypes = readArray(payload, "evidence_types");
  const platformTags = readArray(payload, "platform_tags");
  const collectionActions = readArray(payload, "collection_actions");
  const itemsCount = readNumber(payload, "items_count") ?? 0;

  if (!packageId) {
    throw new Error("assessment-artifact.schedule.upsert requires payload.package_id");
  }

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO assessment_artifact_schedules (
       tenant_id, schedule_id, package_id, name, description, frequency,
       status, cron_expression, control_families_json, controls_json,
       evidence_types_json, platform_tags_json, collection_actions_json,
       items_count, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, schedule_id)
     DO UPDATE SET
       package_id = excluded.package_id,
       name = excluded.name,
       description = excluded.description,
       frequency = excluded.frequency,
       status = excluded.status,
       cron_expression = excluded.cron_expression,
       control_families_json = excluded.control_families_json,
       controls_json = excluded.controls_json,
       evidence_types_json = excluded.evidence_types_json,
       platform_tags_json = excluded.platform_tags_json,
       collection_actions_json = excluded.collection_actions_json,
       items_count = excluded.items_count,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      scheduleId,
      packageId,
      name,
      description,
      frequency,
      status,
      cronExpression,
      JSON.stringify(controlFamilies),
      JSON.stringify(controls),
      JSON.stringify(evidenceTypes),
      JSON.stringify(platformTags),
      JSON.stringify(collectionActions),
      itemsCount,
      now,
      now
    )
    .run();

  await refreshArtifactSummaryProjection(env.APP_D1_MAIN, command.tenant_id, packageId, now);

  return {
    events: [
      makeEvent("AssessmentArtifactScheduleUpserted", command.tenant_id, scheduleId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        schedule_id: scheduleId,
        package_id: packageId,
        name,
        frequency,
        status,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleGenerateFromTemplate(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const packageId = readString(payload, "package_id") || command.command_id;
  const templateKey = readString(payload, "template_key") || "fedramp-moderate";
  const systemName = readString(payload, "system_name");
  const overrideName = readOptionalString(payload, "name");
  const platformTags = readArray(payload, "platform_tags");

  const template = TEMPLATE_REGISTRY[templateKey];
  if (!template) {
    throw new Error(
      `Unknown template_key '${templateKey}'. Available templates: ${Object.keys(TEMPLATE_REGISTRY).join(", ")}`
    );
  }

  // Upsert the package
  await env.APP_D1_MAIN.prepare(
    `INSERT INTO assessment_artifact_packages (
       tenant_id, package_id, name, description, status, package_type,
       system_name, platform_tags_json, stats_json, collection_playbooks_json,
       quality_report_json, indexes_json, source_file, template_key,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, '{}', '[]', '{}', '{}', '', ?, ?, ?)
     ON CONFLICT(tenant_id, package_id)
     DO UPDATE SET
       name = excluded.name,
       status = 'draft',
       package_type = excluded.package_type,
       system_name = excluded.system_name,
       platform_tags_json = excluded.platform_tags_json,
       template_key = excluded.template_key,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      packageId,
      overrideName || template.name,
      template.package_type,
      systemName,
      JSON.stringify(platformTags),
      templateKey,
      now,
      now
    )
    .run();

  const events: DomainEventEnvelope[] = [
    makeEvent("AssessmentArtifactPackageUpserted", command.tenant_id, packageId, {
      command_id: command.command_id,
      command_type: command.command_type,
      tenant_id: command.tenant_id,
      package_id: packageId,
      name: overrideName || template.name,
      status: "draft",
      package_type: template.package_type,
      system_name: systemName,
      template_key: templateKey,
      executed_at: now
    })
  ];

  // Bulk insert items from template
  for (let i = 0; i < template.items.length; i++) {
    const templateItem = template.items[i];
    const itemId = crypto.randomUUID();

    await env.APP_D1_MAIN.prepare(
      `INSERT INTO assessment_artifact_items (
         tenant_id, item_id, package_id, request_id, source_line, category,
         artifact_request, controls_json, control_families_json, control_domains_json,
         workstreams_json, primary_artifact_type, artifact_types_json,
         collection_channel, platform_tags_json, time_scopes_json, periodicity,
         commands_json, config_paths_json, bundle_hint_json,
         created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', ?, '[]', ?, ?, '[]', ?, '[]', '[]', '{}', ?, ?)
       ON CONFLICT(tenant_id, item_id)
       DO UPDATE SET
         package_id = excluded.package_id,
         request_id = excluded.request_id,
         source_line = excluded.source_line,
         category = excluded.category,
         artifact_request = excluded.artifact_request,
         controls_json = excluded.controls_json,
         control_families_json = excluded.control_families_json,
         primary_artifact_type = excluded.primary_artifact_type,
         collection_channel = excluded.collection_channel,
         platform_tags_json = excluded.platform_tags_json,
         periodicity = excluded.periodicity,
         updated_at = excluded.updated_at`
    )
      .bind(
        command.tenant_id,
        itemId,
        packageId,
        templateItem.request_id,
        i + 1,
        templateItem.category,
        templateItem.artifact_request,
        JSON.stringify(templateItem.controls),
        JSON.stringify(templateItem.control_families),
        templateItem.primary_artifact_type,
        templateItem.collection_channel,
        JSON.stringify(platformTags),
        templateItem.periodicity,
        now,
        now
      )
      .run();

    events.push(
      makeEvent("AssessmentArtifactItemUpserted", command.tenant_id, itemId, {
        command_id: command.command_id,
        tenant_id: command.tenant_id,
        item_id: itemId,
        package_id: packageId,
        request_id: templateItem.request_id,
        category: templateItem.category,
        primary_artifact_type: templateItem.primary_artifact_type,
        periodicity: templateItem.periodicity,
        executed_at: now
      })
    );
  }

  // Generate schedules from template
  for (const templateSchedule of template.schedules) {
    const scheduleId = crypto.randomUUID();

    // Count items that match the schedule's evidence types
    const matchingItems = template.items.filter((item) =>
      templateSchedule.evidence_types.includes(item.primary_artifact_type)
    );

    await env.APP_D1_MAIN.prepare(
      `INSERT INTO assessment_artifact_schedules (
         tenant_id, schedule_id, package_id, name, description, frequency,
         status, cron_expression, control_families_json, controls_json,
         evidence_types_json, platform_tags_json, collection_actions_json,
         items_count, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, '[]', ?, ?, '[]', ?, ?, ?)
       ON CONFLICT(tenant_id, schedule_id)
       DO UPDATE SET
         package_id = excluded.package_id,
         name = excluded.name,
         description = excluded.description,
         frequency = excluded.frequency,
         status = excluded.status,
         cron_expression = excluded.cron_expression,
         control_families_json = excluded.control_families_json,
         evidence_types_json = excluded.evidence_types_json,
         platform_tags_json = excluded.platform_tags_json,
         items_count = excluded.items_count,
         updated_at = excluded.updated_at`
    )
      .bind(
        command.tenant_id,
        scheduleId,
        packageId,
        templateSchedule.name,
        templateSchedule.description,
        templateSchedule.frequency,
        templateSchedule.cron_expression,
        JSON.stringify(templateSchedule.control_families),
        JSON.stringify(templateSchedule.evidence_types),
        JSON.stringify(platformTags),
        matchingItems.length,
        now,
        now
      )
      .run();

    events.push(
      makeEvent("AssessmentArtifactScheduleUpserted", command.tenant_id, scheduleId, {
        command_id: command.command_id,
        tenant_id: command.tenant_id,
        schedule_id: scheduleId,
        package_id: packageId,
        name: templateSchedule.name,
        frequency: templateSchedule.frequency,
        status: "active",
        items_count: matchingItems.length,
        executed_at: now
      })
    );
  }

  // Update package stats
  const statsJson = JSON.stringify({
    total_items: template.items.length,
    total_schedules: template.schedules.length,
    template_key: templateKey,
    generated_at: now
  });

  await env.APP_D1_MAIN.prepare(
    `UPDATE assessment_artifact_packages
     SET stats_json = ?, updated_at = ?
     WHERE tenant_id = ? AND package_id = ?`
  )
    .bind(statsJson, now, command.tenant_id, packageId)
    .run();

  await refreshArtifactSummaryProjection(env.APP_D1_MAIN, command.tenant_id, packageId, now);

  return {
    events,
    finalizeJob: true
  };
}

async function handleImportTsv(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const packageId = readString(payload, "package_id") || command.command_id;
  const tsvContent = readString(payload, "tsv_content");
  const packageName = readString(payload, "name") || "TSV Import";
  const packageType = readString(payload, "package_type") || "fedramp";
  const systemName = readString(payload, "system_name");
  const platformTags = readArray(payload, "platform_tags");

  if (!tsvContent) {
    throw new Error("assessment-artifact.package.import-tsv requires payload.tsv_content");
  }

  // Parse TSV
  const lines = tsvContent.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("TSV content must contain a header row and at least one data row");
  }

  const headerLine = lines[0];
  const headers = headerLine.split("\t").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

  // Map known column names to item fields
  const colIndex = (candidates: string[]): number => {
    for (const candidate of candidates) {
      const idx = headers.indexOf(candidate);
      if (idx !== -1) {
        return idx;
      }
    }
    return -1;
  };

  const reqIdCol = colIndex(["request_id", "req_id", "id"]);
  const categoryCol = colIndex(["category", "control_family", "family"]);
  const requestCol = colIndex(["artifact_request", "request", "description", "artifact"]);
  const controlsCol = colIndex(["controls", "control_ids", "control"]);
  const typeCol = colIndex(["primary_artifact_type", "artifact_type", "type"]);
  const channelCol = colIndex(["collection_channel", "channel"]);
  const periodicityCol = colIndex(["periodicity", "frequency"]);

  function cellValue(row: string[], col: number): string {
    if (col < 0 || col >= row.length) {
      return "";
    }
    return row[col].trim();
  }

  function parseDelimitedList(value: string): string[] {
    if (!value) {
      return [];
    }
    return value
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Upsert package
  await env.APP_D1_MAIN.prepare(
    `INSERT INTO assessment_artifact_packages (
       tenant_id, package_id, name, description, status, package_type,
       system_name, platform_tags_json, stats_json, collection_playbooks_json,
       quality_report_json, indexes_json, source_file, template_key,
       created_at, updated_at
     )
     VALUES (?, ?, ?, 'Imported from TSV', 'draft', ?, ?, ?, '{}', '[]', '{}', '{}', 'tsv-import', '', ?, ?)
     ON CONFLICT(tenant_id, package_id)
     DO UPDATE SET
       name = excluded.name,
       status = 'draft',
       package_type = excluded.package_type,
       system_name = excluded.system_name,
       platform_tags_json = excluded.platform_tags_json,
       source_file = excluded.source_file,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      packageId,
      packageName,
      packageType,
      systemName,
      JSON.stringify(platformTags),
      now,
      now
    )
    .run();

  const events: DomainEventEnvelope[] = [
    makeEvent("AssessmentArtifactPackageUpserted", command.tenant_id, packageId, {
      command_id: command.command_id,
      command_type: command.command_type,
      tenant_id: command.tenant_id,
      package_id: packageId,
      name: packageName,
      status: "draft",
      package_type: packageType,
      source: "tsv-import",
      executed_at: now
    })
  ];

  // Parse and insert each data row
  const dataLines = lines.slice(1);
  for (let i = 0; i < dataLines.length; i++) {
    const cells = dataLines[i].split("\t");
    const itemId = crypto.randomUUID();
    const requestId = cellValue(cells, reqIdCol) || `ROW-${i + 1}`;
    const category = cellValue(cells, categoryCol);
    const artifactRequest = cellValue(cells, requestCol);
    const controlsRaw = cellValue(cells, controlsCol);
    const controls = parseDelimitedList(controlsRaw);
    const controlFamilies = [...new Set(controls.map((c) => c.replace(/-.*$/, "").trim()).filter(Boolean))];
    const primaryArtifactType = cellValue(cells, typeCol) || "generic_evidence";
    const collectionChannel = cellValue(cells, channelCol) || "manual_collection";
    const periodicity = cellValue(cells, periodicityCol) || "on_demand";

    await env.APP_D1_MAIN.prepare(
      `INSERT INTO assessment_artifact_items (
         tenant_id, item_id, package_id, request_id, source_line, category,
         artifact_request, controls_json, control_families_json, control_domains_json,
         workstreams_json, primary_artifact_type, artifact_types_json,
         collection_channel, platform_tags_json, time_scopes_json, periodicity,
         commands_json, config_paths_json, bundle_hint_json,
         created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', ?, '[]', ?, ?, '[]', ?, '[]', '[]', '{}', ?, ?)
       ON CONFLICT(tenant_id, item_id)
       DO UPDATE SET
         package_id = excluded.package_id,
         request_id = excluded.request_id,
         source_line = excluded.source_line,
         category = excluded.category,
         artifact_request = excluded.artifact_request,
         controls_json = excluded.controls_json,
         control_families_json = excluded.control_families_json,
         primary_artifact_type = excluded.primary_artifact_type,
         collection_channel = excluded.collection_channel,
         platform_tags_json = excluded.platform_tags_json,
         periodicity = excluded.periodicity,
         updated_at = excluded.updated_at`
    )
      .bind(
        command.tenant_id,
        itemId,
        packageId,
        requestId,
        i + 1,
        category,
        artifactRequest,
        JSON.stringify(controls),
        JSON.stringify(controlFamilies),
        primaryArtifactType,
        collectionChannel,
        JSON.stringify(platformTags),
        periodicity,
        now,
        now
      )
      .run();

    events.push(
      makeEvent("AssessmentArtifactItemUpserted", command.tenant_id, itemId, {
        command_id: command.command_id,
        tenant_id: command.tenant_id,
        item_id: itemId,
        package_id: packageId,
        request_id: requestId,
        source_line: i + 1,
        category,
        primary_artifact_type: primaryArtifactType,
        periodicity,
        executed_at: now
      })
    );
  }

  // Update stats
  const statsJson = JSON.stringify({
    total_items: dataLines.length,
    source: "tsv-import",
    imported_at: now
  });

  await env.APP_D1_MAIN.prepare(
    `UPDATE assessment_artifact_packages
     SET stats_json = ?, updated_at = ?
     WHERE tenant_id = ? AND package_id = ?`
  )
    .bind(statsJson, now, command.tenant_id, packageId)
    .run();

  await refreshArtifactSummaryProjection(env.APP_D1_MAIN, command.tenant_id, packageId, now);

  return {
    events,
    finalizeJob: true
  };
}

async function handleSchedulePause(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const scheduleId = readString(payload, "schedule_id");

  if (!scheduleId) {
    throw new Error("assessment-artifact.schedule.pause requires payload.schedule_id");
  }

  // Verify the schedule exists and fetch its package_id
  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT package_id, status
     FROM assessment_artifact_schedules
     WHERE tenant_id = ? AND schedule_id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, scheduleId)
    .first<{ package_id: string; status: string }>();

  if (!existing) {
    throw new Error(`Schedule '${scheduleId}' not found for tenant '${command.tenant_id}'`);
  }

  if (existing.status === "paused") {
    // Already paused; emit event but skip DB write
    return {
      events: [
        makeEvent("AssessmentArtifactSchedulePaused", command.tenant_id, scheduleId, {
          command_id: command.command_id,
          command_type: command.command_type,
          tenant_id: command.tenant_id,
          schedule_id: scheduleId,
          package_id: existing.package_id,
          previous_status: existing.status,
          executed_at: now
        })
      ],
      finalizeJob: true
    };
  }

  await env.APP_D1_MAIN.prepare(
    `UPDATE assessment_artifact_schedules
     SET status = 'paused', updated_at = ?
     WHERE tenant_id = ? AND schedule_id = ?`
  )
    .bind(now, command.tenant_id, scheduleId)
    .run();

  await refreshArtifactSummaryProjection(env.APP_D1_MAIN, command.tenant_id, existing.package_id, now);

  return {
    events: [
      makeEvent("AssessmentArtifactSchedulePaused", command.tenant_id, scheduleId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        schedule_id: scheduleId,
        package_id: existing.package_id,
        previous_status: existing.status,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleScheduleResume(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const scheduleId = readString(payload, "schedule_id");

  if (!scheduleId) {
    throw new Error("assessment-artifact.schedule.resume requires payload.schedule_id");
  }

  // Verify the schedule exists and fetch its package_id
  const existing = await env.APP_D1_MAIN.prepare(
    `SELECT package_id, status
     FROM assessment_artifact_schedules
     WHERE tenant_id = ? AND schedule_id = ?
     LIMIT 1`
  )
    .bind(command.tenant_id, scheduleId)
    .first<{ package_id: string; status: string }>();

  if (!existing) {
    throw new Error(`Schedule '${scheduleId}' not found for tenant '${command.tenant_id}'`);
  }

  if (existing.status === "active") {
    // Already active; emit event but skip DB write
    return {
      events: [
        makeEvent("AssessmentArtifactScheduleResumed", command.tenant_id, scheduleId, {
          command_id: command.command_id,
          command_type: command.command_type,
          tenant_id: command.tenant_id,
          schedule_id: scheduleId,
          package_id: existing.package_id,
          previous_status: existing.status,
          executed_at: now
        })
      ],
      finalizeJob: true
    };
  }

  await env.APP_D1_MAIN.prepare(
    `UPDATE assessment_artifact_schedules
     SET status = 'active', updated_at = ?
     WHERE tenant_id = ? AND schedule_id = ?`
  )
    .bind(now, command.tenant_id, scheduleId)
    .run();

  await refreshArtifactSummaryProjection(env.APP_D1_MAIN, command.tenant_id, existing.package_id, now);

  return {
    events: [
      makeEvent("AssessmentArtifactScheduleResumed", command.tenant_id, scheduleId, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        schedule_id: scheduleId,
        package_id: existing.package_id,
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

export async function handleAssessmentArtifactCommand(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  switch (command.command_type) {
    case "assessment-artifact.package.upsert":
      return handlePackageUpsert(command, env);

    case "assessment-artifact.item.upsert":
      return handleItemUpsert(command, env);

    case "assessment-artifact.schedule.upsert":
      return handleScheduleUpsert(command, env);

    case "assessment-artifact.package.generate-from-template":
      return handleGenerateFromTemplate(command, env);

    case "assessment-artifact.package.import-tsv":
      return handleImportTsv(command, env);

    case "assessment-artifact.schedule.pause":
      return handleSchedulePause(command, env);

    case "assessment-artifact.schedule.resume":
      return handleScheduleResume(command, env);

    default:
      throw new Error(`Unsupported assessment artifact command type: ${command.command_type}`);
  }
}
