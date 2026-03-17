import { FEATURE_COMMAND_MAP, SUPPORTED_COMMAND_TYPES, type SupportedCommandType } from "./catalog";
import { PYTHON_MODEL_FIELD_REGISTRY, PYTHON_MODEL_REGISTRY_STATS } from "./model-field-registry";

export const COMMAND_MODEL_KEY_HINTS: Partial<Record<SupportedCommandType, string>> = {
  "connectors.sync.requested": "connectors.models.ConnectorInstance",
  "lightning-assessment.upsert": "core.bounded_contexts.assessment_engine.models.LightningAssessment",
  "version-history.snapshot.requested": "core.bounded_contexts.version_history.models.VersionHistory",
  "security-graph.ingest.requested": "security_graph.jobs.SecurityGraphIngestJob",
  "evidence.collection.requested": "evidence_automation.models.EvidenceCollectionRun",
  "workflow.execution.requested": "core.bounded_contexts.workflow_engine.models.WorkflowExecution",
  "oscal.import.requested": "oscal_integration.jobs.OscalImportJob",
  "oscal.export.requested": "oscal_integration.jobs.OscalExportJob",
  "conmon.profile.refresh.requested": "continuous_monitoring.models.ConMonProfile",
  "poam.item.upsert": "poam.models.poam_item.POAMItem",
  "ai.assistant.run.requested": "ai_assistant.jobs.AssistantJob",
  "ai.vendor-scoring.requested": "tprm.models.EntityAssessment",
  "vendor.questionnaire.upsert": "questionnaires.models.questionnaire.Questionnaire",
  "library.index.refresh.requested": "core.models.StoredLibrary",
  "fedramp.automation.run.requested": "core.bounded_contexts.rmf_operations.aggregates.cloud_service_offering.CloudServiceOffering",
  "crq.compute.requested": "crq.models.QuantitativeRiskStudy",
  "mapping.compute.requested": "core.models_mit.library.RequirementMappingSet",
  "scanner.sync.requested": "core.bounded_contexts.rmf_operations.aggregates.vulnerability_finding.VulnerabilityFinding",
  "sarif.import.requested": "core.bounded_contexts.rmf_operations.aggregates.vulnerability_finding.VulnerabilityFinding",
  "scap.import.requested": "core.bounded_contexts.rmf_operations.aggregates.vulnerability_finding.VulnerabilityFinding",
  "servicenow.sync.requested": "integrations.models.SyncMapping",
  "jira.sync.requested": "integrations.models.SyncMapping",
  "ocsf.oscal.translate.requested": "integrations.ocsf.jobs.TranslationJob",
  "assessment-artifact.package.upsert": "assessment_artifacts.models.ArtifactPackage",
  "assessment-artifact.item.upsert": "assessment_artifacts.models.ArtifactRequestItem",
  "assessment-artifact.schedule.upsert": "assessment_artifacts.models.EvidenceSchedule",
  "assessment-artifact.package.generate-from-template": "assessment_artifacts.models.ArtifactPackage",
  "assessment-artifact.package.import-tsv": "assessment_artifacts.models.ArtifactPackage",
  "assessment-artifact.schedule.pause": "assessment_artifacts.models.EvidenceSchedule",
  "assessment-artifact.schedule.resume": "assessment_artifacts.models.EvidenceSchedule"
};

export const CUSTOM_MODEL_FIELD_REGISTRY: Record<string, readonly string[]> = {
  "security_graph.jobs.SecurityGraphIngestJob": [
    "ingest_job_id",
    "status",
    "graph_object_key",
    "nodes",
    "edges",
    "source",
    "metadata"
  ],
  "oscal_integration.jobs.OscalImportJob": [
    "oscal_job_id",
    "status",
    "source_object_key",
    "format",
    "profile",
    "system_id",
    "metadata"
  ],
  "oscal_integration.jobs.OscalExportJob": [
    "oscal_job_id",
    "status",
    "format",
    "profile",
    "system_id",
    "include_evidence",
    "metadata"
  ],
  "ai_assistant.jobs.AssistantJob": [
    "ai_job_id",
    "status",
    "model_name",
    "prompt",
    "context",
    "temperature",
    "max_tokens",
    "metadata"
  ],
  "integrations.ocsf.jobs.TranslationJob": [
    "translation_job_id",
    "status",
    "source_format",
    "target_format",
    "source_object_key",
    "output_format",
    "metadata"
  ],
  "assessment_artifacts.models.ArtifactPackage": [
    "package_id",
    "name",
    "description",
    "status",
    "package_type",
    "system_name",
    "platform_tags",
    "stats",
    "collection_playbooks",
    "quality_report",
    "indexes",
    "source_file",
    "template_key",
    "total_items",
    "schedule_count",
    "quality_gate",
    "periodicity_breakdown"
  ],
  "assessment_artifacts.models.ArtifactRequestItem": [
    "item_id",
    "package_id",
    "request_id",
    "source_line",
    "category",
    "artifact_request",
    "controls",
    "control_families",
    "control_domains",
    "workstreams",
    "primary_artifact_type",
    "artifact_types",
    "collection_channel",
    "platform_tags",
    "time_scopes",
    "periodicity",
    "commands",
    "config_paths",
    "bundle_hint"
  ],
  "assessment_artifacts.models.EvidenceSchedule": [
    "schedule_id",
    "package_id",
    "name",
    "description",
    "frequency",
    "status",
    "cron_expression",
    "control_families",
    "controls",
    "evidence_types",
    "platform_tags",
    "collection_actions",
    "items_count"
  ]
};

export type FeatureFieldParityTarget = {
  feature_family: string;
  command_type: SupportedCommandType;
  model_key: string;
  expected_fields: string[];
  expected_field_count: number;
  registry_source: "python" | "custom" | "runtime";
};

export const COMMAND_FEATURE_FAMILY_INDEX: Record<SupportedCommandType, string> =
  buildCommandFeatureFamilyIndex();

const PARITY_METADATA_FIELDS = new Set([
  "model_key",
  "model_fields",
  "record_id",
  "entity_id",
  "id",
  "parity_partial",
  "field_parity_mode"
]);

export type PrimitiveField = {
  field_path: string;
  value_type: "text" | "number" | "bool" | "null";
  value_text: string | null;
  value_number: number | null;
  value_bool: number | null;
};

export type ParityDiff = {
  missing_fields: string[];
  extra_fields: string[];
  present_fields: string[];
  expected_field_count: number;
  present_field_count: number;
  coverage_ratio: number;
};

export function resolveModelKey(commandType: string, payload: Record<string, unknown>): string | null {
  const explicit = readString(payload, "model_key");
  if (explicit) {
    return explicit;
  }
  const hinted = (COMMAND_MODEL_KEY_HINTS as Record<string, string>)[commandType];
  if (hinted) {
    return hinted;
  }
  return null;
}

export function resolveExpectedFields(modelKey: string | null, payload: Record<string, unknown>): string[] {
  const explicit = readStringArray(payload, "model_fields");
  if (explicit.length > 0) {
    return uniqueStrings(explicit);
  }
  if (!modelKey) {
    return [];
  }
  const fromCustom = CUSTOM_MODEL_FIELD_REGISTRY[modelKey];
  if (fromCustom) {
    return uniqueStrings(Array.from(fromCustom));
  }
  const fromRegistry = PYTHON_MODEL_FIELD_REGISTRY[modelKey];
  if (!fromRegistry) {
    return [];
  }
  return uniqueStrings(Array.from(fromRegistry));
}

export const FEATURE_FIELD_PARITY_TARGETS: FeatureFieldParityTarget[] = buildFeatureFieldParityTargets();

export const FEATURE_FIELD_PARITY_TARGETS_BY_COMMAND: Record<SupportedCommandType, FeatureFieldParityTarget> =
  Object.fromEntries(
    FEATURE_FIELD_PARITY_TARGETS.map((target) => [target.command_type, target])
  ) as Record<SupportedCommandType, FeatureFieldParityTarget>;

export const FEATURE_FIELD_PARITY_FAMILIES: string[] = uniqueStrings(
  FEATURE_FIELD_PARITY_TARGETS.map((target) => target.feature_family)
);

export const FIELD_PARITY_GAPS: FeatureFieldParityTarget[] = FEATURE_FIELD_PARITY_TARGETS.filter(
  (target) => target.expected_field_count === 0
);

export function deriveRecordId(payload: Record<string, unknown>, fallback: string): string {
  const candidates = [
    readString(payload, "record_id"),
    readString(payload, "entity_id"),
    readString(payload, "id"),
    readString(payload, "run_id"),
    readString(payload, "assessment_id"),
    readString(payload, "snapshot_id"),
    readString(payload, "ingest_job_id"),
    readString(payload, "execution_id"),
    readString(payload, "oscal_job_id"),
    readString(payload, "activity_id"),
    readString(payload, "poam_item_id"),
    readString(payload, "ai_job_id"),
    readString(payload, "scoring_id"),
    readString(payload, "questionnaire_id"),
    readString(payload, "library_job_id"),
    readString(payload, "mapping_job_id"),
    readString(payload, "sync_job_id"),
    readString(payload, "translation_job_id")
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  return fallback;
}

export function extractParityState(payload: Record<string, unknown>): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (PARITY_METADATA_FIELDS.has(key)) {
      continue;
    }
    state[key] = value;
  }
  return state;
}

export function computeParityDiff(expectedFields: readonly string[], state: Record<string, unknown>): ParityDiff {
  const expected = uniqueStrings(expectedFields);
  const present = uniqueStrings(Object.keys(state));

  const presentSet = new Set(present);
  const expectedSet = new Set(expected);

  const missing = expected.filter((field) => !presentSet.has(field));
  const extra = present.filter((field) => !expectedSet.has(field));

  const coverageRatio = expected.length === 0 ? 1 : (expected.length - missing.length) / expected.length;

  return {
    missing_fields: missing,
    extra_fields: extra,
    present_fields: present,
    expected_field_count: expected.length,
    present_field_count: present.length,
    coverage_ratio: Number(coverageRatio.toFixed(6))
  };
}

export function flattenPrimitiveFields(
  state: Record<string, unknown>,
  maxFields: number = 256,
  maxDepth: number = 3
): PrimitiveField[] {
  const rows: PrimitiveField[] = [];

  function visit(path: string, value: unknown, depth: number): void {
    if (rows.length >= maxFields) {
      return;
    }

    if (value === null) {
      rows.push({
        field_path: path,
        value_type: "null",
        value_text: null,
        value_number: null,
        value_bool: null
      });
      return;
    }

    if (typeof value === "string") {
      rows.push({
        field_path: path,
        value_type: "text",
        value_text: value.slice(0, 2048),
        value_number: null,
        value_bool: null
      });
      return;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      rows.push({
        field_path: path,
        value_type: "number",
        value_text: null,
        value_number: value,
        value_bool: null
      });
      return;
    }

    if (typeof value === "boolean") {
      rows.push({
        field_path: path,
        value_type: "bool",
        value_text: null,
        value_number: null,
        value_bool: value ? 1 : 0
      });
      return;
    }

    if (depth >= maxDepth) {
      rows.push({
        field_path: path,
        value_type: "text",
        value_text: JSON.stringify(value).slice(0, 2048),
        value_number: null,
        value_bool: null
      });
      return;
    }

    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        visit(`${path}[${index}]`, value[index], depth + 1);
        if (rows.length >= maxFields) {
          return;
        }
      }
      return;
    }

    if (isRecord(value)) {
      for (const [k, v] of Object.entries(value)) {
        visit(path ? `${path}.${k}` : k, v, depth + 1);
        if (rows.length >= maxFields) {
          return;
        }
      }
    }
  }

  for (const [key, value] of Object.entries(state)) {
    visit(key, value, 0);
    if (rows.length >= maxFields) {
      break;
    }
  }

  return rows;
}

export function sanitizeModelKeySegment(modelKey: string): string {
  return modelKey.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "model";
}

export function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

export function readStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function uniqueStrings(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}

function buildCommandFeatureFamilyIndex(): Record<SupportedCommandType, string> {
  const out = {} as Record<SupportedCommandType, string>;
  for (const [featureFamily, commandTypes] of Object.entries(FEATURE_COMMAND_MAP)) {
    for (const commandType of commandTypes) {
      out[commandType] = featureFamily;
    }
  }
  for (const commandType of SUPPORTED_COMMAND_TYPES) {
    if (!out[commandType]) {
      out[commandType] = "unassigned";
    }
  }
  return out;
}

function buildFeatureFieldParityTargets(): FeatureFieldParityTarget[] {
  const targets: FeatureFieldParityTarget[] = [];

  for (const commandType of SUPPORTED_COMMAND_TYPES) {
    const hintedModelKey = COMMAND_MODEL_KEY_HINTS[commandType] ?? null;
    const fromCustom = hintedModelKey ? CUSTOM_MODEL_FIELD_REGISTRY[hintedModelKey] : undefined;
    const fromPython = hintedModelKey ? PYTHON_MODEL_FIELD_REGISTRY[hintedModelKey] : undefined;
    const expectedFields = resolveExpectedFields(hintedModelKey, {});
    const modelKey = hintedModelKey ?? `runtime.${commandType}`;

    targets.push({
      feature_family: COMMAND_FEATURE_FAMILY_INDEX[commandType] || "unassigned",
      command_type: commandType,
      model_key: modelKey,
      expected_fields: expectedFields,
      expected_field_count: expectedFields.length,
      registry_source: fromCustom ? "custom" : fromPython ? "python" : "runtime"
    });
  }

  return targets;
}

export { PYTHON_MODEL_FIELD_REGISTRY, PYTHON_MODEL_REGISTRY_STATS };
