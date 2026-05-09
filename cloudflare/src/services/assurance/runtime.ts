import type { EnvBindings } from '../../types/env';
import { generateJsonWithAi } from '../ai/runtime';
import {
  buildConMonReasonablenessArtifact,
} from './conmonReasonableness';
import {
  buildThreatHuntArtifacts,
  buildThreatHuntQueryMarkdown,
  buildThreatHuntTimelineMarkdown,
} from './threatHunt';
import { resolveLiveAdapterBundle } from './liveAdapters';
import {
  buildTrackerGapMatrixCsv,
  buildTrackerGapReportMarkdown,
  buildTrackerInstrumentationPlanMarkdown,
  trackerArtifactContentType,
  trackerImportArtifactKey,
  trackerImportManifestKey,
} from './trackerArtifacts';
import type {
  AlertRuleRecord,
  AssessmentSummary,
  AssetRecord,
  AssuranceExplainAudience,
  AssuranceExplanation,
  AssuranceEvalStatus,
  AssuranceSeverity,
  BundleKind,
  BundlePersistenceContext,
  DeclaredInventoryRecord,
  EvalResult,
  EvaluationArtifacts,
  EvidenceCoverageSummary,
  EvidenceGap,
  EvidenceGraph,
  EvidenceInputMode,
  GraphEdge,
  GraphNode,
  LogSourceRecord,
  NormalizedEvidenceBundle,
  PoamItem,
  ReasonablenessFinding,
  ReviewDecision,
  ReviewRecommendation,
  ScannerFindingRecord,
  ScannerTargetRecord,
  SecurityEventRecord,
  SeededPoamRecord,
  TicketRecord,
  TwentyXPackageSummary,
  ReconciliationSummary,
} from './types';
import {
  buildAssessorWorkpaper,
  buildAuditorQuestionsMarkdown,
  buildCorrelationReportMarkdown,
  buildEvidenceGapMatrixRows,
  buildInstrumentationPlanMarkdown,
  buildPackageReconciliation,
  buildPackageValidationReport,
  buildPoamRemediationPlan,
  renderEvidenceGapMatrixCsv,
  remediationSteps,
  severityEffort,
  severityPriority,
  validateEvidenceArtifacts,
} from './validation';

type EvidenceSourceConfig = Record<string, unknown>;

type EvidenceJobMetadataRow = {
  id: string;
  tenant_id: string;
  folder_id: string | null;
  source_id: string;
  run_family: string;
  input_mode: string;
  bundle_kind: string;
  manifest_key: string | null;
  normalization_status: string;
  coverage_json: string;
  error_summary_json: string;
  source_schema_version: string;
  adapter_hints_json: string;
  status: string;
};

type PackageJobRow = {
  id: string;
  tenant_id: string;
  folder_id: string | null;
  file_name: string;
  status: string;
  manifest_key: string | null;
  artifact_key: string | null;
  coverage_json: string;
  error_summary_json: string;
  created_at: string;
  updated_at: string;
};

type ReviewRecommendationRow = {
  id: string;
  evidence_job_id?: string | null;
  folder_id: string | null;
  target_type: string;
  target_id: string;
  title: string;
  summary: string;
  status: string;
  recommendation_json: string;
  created_at: string;
};

type ReviewDecisionRow = {
  id: string;
  evidence_job_id?: string | null;
  recommendation_title?: string | null;
  target_id?: string | null;
  target_type?: string | null;
  folder_id: string | null;
  recommendation_id: string;
  decision: string;
  justification: string;
  evidence_refs_json: string;
  finding_refs_json: string;
  control_refs_json: string;
  decided_by_user_id: string | null;
  created_at: string;
};

type TrackerDiagnosticRow = {
  row_index: number;
  row_key: string | null;
  row_status: string;
  category: string | null;
  owner_name: string | null;
  gap_type: string | null;
  severity: string | null;
  detail: string;
  control_refs_json: string;
  raw_row_json: string;
};

type BundleArtifactFamily =
  | 'raw_input'
  | 'normalized_bundle'
  | 'bundle_manifest'
  | 'assessment_summary'
  | 'eval_results'
  | 'evidence_gaps'
  | 'poam_items'
  | 'evidence_graph'
  | 'correlations'
  | 'correlation_report'
  | 'auditor_questions'
  | 'instrumentation_plan'
  | 'evidence_gap_matrix'
  | 'reasonableness_findings'
  | 'validation_report'
  | 'threat_hunt_findings'
  | 'threat_hunt_timeline'
  | 'threat_hunt_queries'
  | 'live_collection_coverage'
  | 'tracker_diagnostics'
  | 'tracker_gap_report'
  | 'tracker_gap_matrix'
  | 'tracker_instrumentation_plan'
  | 'package_json'
  | 'review_ledger'
  | 'report_manifest'
  | 'reconciliation';

const DAY_MS = 24 * 60 * 60 * 1000;

const EVAL_TITLES: Record<string, string> = {
  CM8_INVENTORY_RECONCILIATION: 'Inventory reconciliation',
  RA5_SCANNER_SCOPE_COVERAGE: 'Scanner scope coverage',
  AU6_CENTRALIZED_LOG_COVERAGE: 'Centralized log coverage',
  AU6_LOCAL_TO_CENTRAL_CORRELATION: 'Local-to-central event correlation',
  SI4_ALERT_INSTRUMENTATION: 'Alert instrumentation coverage',
  CM3_CHANGE_TICKET_LINKAGE: 'Change and ticket linkage',
  RA5_EXPLOITATION_REVIEW: 'Exploitation review for high and critical findings',
  CA7_CONMON_REASONABLENESS: 'Continuous monitoring reasonableness',
  SC7_PUBLIC_EXPOSURE_POLICY: 'Public exposure policy',
  F20X_KSI_ROLLUP: 'FedRAMP 20x criterion rollup',
};

const KSI_BY_EVAL: Record<string, string[]> = {
  CM8_INVENTORY_RECONCILIATION: ['KSI-CM8'],
  RA5_SCANNER_SCOPE_COVERAGE: ['KSI-RA5'],
  AU6_CENTRALIZED_LOG_COVERAGE: ['KSI-AU6'],
  AU6_LOCAL_TO_CENTRAL_CORRELATION: ['KSI-AU6'],
  SI4_ALERT_INSTRUMENTATION: ['KSI-SI4'],
  CM3_CHANGE_TICKET_LINKAGE: ['KSI-CM3'],
  RA5_EXPLOITATION_REVIEW: ['KSI-RA5-8'],
  CA7_CONMON_REASONABLENESS: ['KSI-CA7'],
  SC7_PUBLIC_EXPOSURE_POLICY: ['KSI-SC7'],
  F20X_KSI_ROLLUP: ['KSI-F20X'],
  AGENT_TOOL_GOVERNANCE: ['KSI-AGENT-TOOLS'],
  AGENT_PERMISSION_SCOPE: ['KSI-AGENT-SCOPE'],
  AGENT_MEMORY_CONTEXT_SAFETY: ['KSI-AGENT-MEMORY'],
  AGENT_APPROVAL_GATES: ['KSI-AGENT-APPROVAL'],
  AGENT_POLICY_VIOLATIONS: ['KSI-AGENT-POLICY'],
  AGENT_AUDITABILITY: ['KSI-AGENT-AUDIT'],
};

function nowIso(): string {
  return new Date().toISOString();
}

function asJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return fallback;
}

function normalizeNullableString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'active', 'enabled'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n', 'inactive', 'disabled'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function normalizeSeverity(value: unknown, fallback: AssuranceSeverity = 'moderate'): AssuranceSeverity {
  const normalized = normalizeString(value, fallback).toLowerCase();
  if (normalized === 'critical') return 'critical';
  if (normalized === 'high') return 'high';
  if (normalized === 'low') return 'low';
  return 'moderate';
}

function normalizeStatus(value: unknown, fallback = 'open'): string {
  return normalizeString(value, fallback).toLowerCase();
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean)
    .filter((item, index, source) => source.indexOf(item) === index);
}

function uniqueBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

function artifactKeyForEvidenceJob(
  tenantId: string,
  sourceId: string,
  jobId: string,
  family: BundleArtifactFamily,
  extension: 'json' | 'md' | 'csv' | 'txt' = 'json',
): string {
  return `${tenantId}/evidence/${sourceId}/${jobId}/${family}.${extension}`;
}

function artifactKeyForPackage(
  tenantId: string,
  packageJobId: string,
  family: BundleArtifactFamily,
  extension: 'json' | 'md' | 'csv' | 'txt' = 'json',
): string {
  return `${tenantId}/assurance/packages/${packageJobId}/${family}.${extension}`;
}

async function writeJsonArtifact(
  env: EnvBindings,
  key: string,
  value: unknown,
): Promise<void> {
  const body = JSON.stringify(value, null, 2);
  await env.R2_EVIDENCE.put(key, body, {
    httpMetadata: {
      contentType: 'application/json',
    },
  });
}

async function writeMarkdownArtifact(env: EnvBindings, key: string, markdown: string): Promise<void> {
  await env.R2_EVIDENCE.put(key, markdown, {
    httpMetadata: {
      contentType: 'text/markdown; charset=utf-8',
    },
  });
}

async function writeTextArtifact(
  env: EnvBindings,
  key: string,
  body: string,
  contentType: string,
): Promise<void> {
  await env.R2_EVIDENCE.put(key, body, {
    httpMetadata: {
      contentType,
    },
  });
}

async function readJsonArtifact<T>(env: EnvBindings, key: string): Promise<T | null> {
  const object = await env.R2_EVIDENCE.get(key);
  if (!object) {
    return null;
  }

  return (await object.json()) as T;
}

async function readTextArtifact(env: EnvBindings, key: string): Promise<string | null> {
  const object = await env.R2_EVIDENCE.get(key);
  if (!object) {
    return null;
  }

  return object.text();
}

function coverageSummary(bundle: NormalizedEvidenceBundle): EvidenceCoverageSummary {
  const inBoundaryAssetCount =
    bundle.declaredInventory.filter((item) => item.inBoundary).length +
    bundle.discoveredAssets.filter((item) => item.inBoundary).length;

  return {
    declaredInventoryCount: bundle.declaredInventory.length,
    discoveredAssetCount: bundle.discoveredAssets.length,
    cloudEventCount: bundle.cloudEvents.length,
    scannerTargetCount: bundle.scannerTargets.length,
    scannerFindingCount: bundle.scannerFindings.length,
    centralLogSourceCount: bundle.centralLogSources.length,
    alertRuleCount: bundle.alertRules.length,
    ticketCount: bundle.tickets.length,
    seededPoamCount: bundle.seededPoam.length,
    inBoundaryAssetCount,
    publicAssetCount:
      bundle.declaredInventory.filter((item) => item.isPublic).length +
      bundle.discoveredAssets.filter((item) => item.isPublic).length,
  };
}

function pickArray(source: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    if (Array.isArray(source[key])) {
      return source[key] as unknown[];
    }
  }
  return [];
}

function createProviderSeedBundle(args: {
  tenantId: string;
  folderId: string | null;
  provider: string;
  sourceName: string;
  inputMode: EvidenceInputMode;
  bundleKind: BundleKind;
  config: EvidenceSourceConfig;
}): NormalizedEvidenceBundle {
  const collectedAt = nowIso();
  const provider = args.provider.toLowerCase();
  const repository = normalizeString(args.config.repository, 'regovise/platform');
  const assetIdBase = `${provider}:${repository}`.replace(/\s+/g, '-').toLowerCase();
  const publicAsset = provider === 'wiz' || provider === 'custom_http';
  const findingSeverity: AssuranceSeverity = provider === 'wiz' ? 'critical' : provider === 'github' ? 'high' : 'moderate';

  const declaredInventory: DeclaredInventoryRecord[] = [
    {
      assetId: `${assetIdBase}:primary`,
      name: provider === 'github' ? repository : `${args.sourceName} Primary Asset`,
      assetType: provider === 'github' ? 'repository' : provider === 'wiz' ? 'cloud-instance' : 'service',
      environment: 'production',
      owner: normalizeString(args.config.owner, 'Security Engineering'),
      region: normalizeNullableString(args.config.region) ?? 'us-east-1',
      accountId: normalizeNullableString(args.config.accountId) ?? 'prod-primary',
      inBoundary: true,
      scannerRequired: true,
      logRequired: true,
      isPublic: publicAsset,
      expectedPrivateIp: '10.0.10.4',
      expectedPublicIp: publicAsset ? '203.0.113.24' : null,
      metadata: {
        scope: normalizeString(args.config.inventoryScope, 'production'),
      },
    },
  ];

  const discoveredAssets: AssetRecord[] = [
    {
      assetId: `${assetIdBase}:primary`,
      name: provider === 'github' ? `${repository} actions runner` : `${args.sourceName} runtime`,
      assetType: provider === 'github' ? 'ci-runner' : provider === 'wiz' ? 'ec2' : 'api-service',
      environment: 'production',
      owner: normalizeString(args.config.owner, 'Security Engineering'),
      region: normalizeNullableString(args.config.region) ?? 'us-east-1',
      accountId: normalizeNullableString(args.config.accountId) ?? 'prod-primary',
      inBoundary: true,
      isPublic: publicAsset,
      privateIps: ['10.0.10.4'],
      publicIps: publicAsset ? ['203.0.113.24'] : [],
      metadata: {
        provider,
      },
    },
  ];

  const cloudEvents: SecurityEventRecord[] = [
    {
      eventId: `${assetIdBase}:event:1`,
      assetId: `${assetIdBase}:primary`,
      semanticType:
        provider === 'github' ? 'repo.branch_protection_changed' : publicAsset ? 'network.public_admin_service_opened' : 'vuln.scan.completed',
      severity: findingSeverity,
      status: 'open',
      centralEventRef: provider === 'github' ? `audit:${repository}:bp` : publicAsset ? null : `central:${assetIdBase}:1`,
      localEventRef: `local:${assetIdBase}:1`,
      title:
        provider === 'github'
          ? 'Repository security posture changed'
          : publicAsset
            ? 'Public exposure identified on a production asset'
            : 'Scanner completed and produced actionable findings',
      metadata: {
        provider,
      },
    },
  ];

  const scannerTargets: ScannerTargetRecord[] = [
    {
      targetId: `${assetIdBase}:target:1`,
      assetId: `${assetIdBase}:primary`,
      scannerName: provider === 'snyk' ? 'snyk' : provider === 'github' ? 'github-code-scanning' : 'wiz',
      hostname: provider === 'github' ? repository : `${assetIdBase}.internal`,
      ipAddress: '10.0.10.4',
      credentialed: provider !== 'github',
      lastScanTime: collectedAt,
      metadata: {
        sourceName: args.sourceName,
      },
    },
  ];

  const scannerFindings: ScannerFindingRecord[] = [
    {
      findingId: `${assetIdBase}:finding:1`,
      assetId: `${assetIdBase}:primary`,
      severity: findingSeverity,
      status: provider === 'github' ? 'open' : 'open',
      title:
        provider === 'github'
          ? 'High-impact dependency exposure requires remediation'
          : publicAsset
            ? 'Public administrative surface remains internet reachable'
            : 'Critical configuration drift remains unresolved',
      cveIds: provider === 'github' ? ['CVE-2026-1000'] : [],
      linkedTicketIds: [`${assetIdBase}:ticket:1`],
      exploitationReview: provider === 'wiz' ? {} : { logReviewPerformed: true },
      metadata: {
        provider,
      },
    },
  ];

  const centralLogSources: LogSourceRecord[] = [
    {
      sourceId: `${assetIdBase}:logs:1`,
      assetId: `${assetIdBase}:primary`,
      sourceType: provider === 'github' ? 'audit' : 'cloud_control_plane',
      localSource: provider === 'github' ? 'github-audit' : 'cloudtrail',
      centralDestination: provider === 'github' ? 'siem' : publicAsset ? 'siem' : 'central-log',
      status: publicAsset ? 'stale' : 'active',
      sampleLocalEventRef: `local:${assetIdBase}:1`,
      sampleCentralEventRef: publicAsset ? null : `central:${assetIdBase}:1`,
      lastSeen: collectedAt,
      metadata: {
        provider,
      },
    },
  ];

  const alertRules: AlertRuleRecord[] = [
    {
      ruleId: `${assetIdBase}:rule:1`,
      name: `${args.sourceName} security alert`,
      enabled: true,
      semanticTypes: [cloudEvents[0]?.semanticType ?? 'generic.alert'],
      recipients: ['soc@regovise.local'],
      lastFired: provider === 'github' ? collectedAt : null,
      metadata: {
        provider,
      },
    },
  ];

  const tickets: TicketRecord[] = [
    {
      ticketId: `${assetIdBase}:ticket:1`,
      title: `${args.sourceName} corrective action`,
      status: provider === 'github' ? 'in_progress' : 'open',
      linkedAssetIds: [`${assetIdBase}:primary`],
      linkedEventIds: [`${assetIdBase}:event:1`],
      linkedFindingIds: [`${assetIdBase}:finding:1`],
      hasSecurityImpactAnalysis: provider !== 'github',
      hasTestingEvidence: provider !== 'wiz',
      hasApproval: provider !== 'wiz',
      hasDeploymentEvidence: provider !== 'wiz',
      hasVerificationEvidence: provider !== 'wiz',
      metadata: {
        system: provider === 'github' ? 'github-issues' : 'jira',
      },
    },
  ];

  const seededPoam: SeededPoamRecord[] = [];

  return {
    tenantId: args.tenantId,
    folderId: args.folderId,
    inputMode: args.inputMode,
    bundleKind: args.bundleKind,
    sourceName: args.sourceName,
    provider: args.provider,
    collectedAt,
    schemaVersion: 'v1',
    declaredInventory,
    discoveredAssets,
    cloudEvents,
    scannerTargets,
    scannerFindings,
    centralLogSources,
    alertRules,
    tickets,
    seededPoam,
    metadata: {
      generatedFrom: 'provider-seed',
      provider,
    },
  };
}

function normalizeDeclaredInventoryRecord(item: unknown, index: number): DeclaredInventoryRecord {
  const record = toRecord(item);
  return {
    assetId:
      normalizeString(record.assetId) ||
      normalizeString(record.asset_id) ||
      normalizeString(record.id) ||
      `declared-${index + 1}`,
    name: normalizeString(record.name, `Declared asset ${index + 1}`),
    assetType: normalizeString(record.assetType || record.asset_type, 'service'),
    environment: normalizeString(record.environment, 'production'),
    owner: normalizeNullableString(record.owner),
    region: normalizeNullableString(record.region),
    accountId: normalizeNullableString(record.accountId ?? record.account_id),
    inBoundary: normalizeBoolean(record.inBoundary ?? record.in_boundary, true),
    scannerRequired: normalizeBoolean(record.scannerRequired ?? record.scanner_required, true),
    logRequired: normalizeBoolean(record.logRequired ?? record.log_required, true),
    isPublic: normalizeBoolean(record.isPublic ?? record.is_public, false),
    expectedPrivateIp: normalizeNullableString(record.expectedPrivateIp ?? record.expected_private_ip),
    expectedPublicIp: normalizeNullableString(record.expectedPublicIp ?? record.expected_public_ip),
    metadata: toRecord(record.metadata),
  };
}

function normalizeAssetRecord(item: unknown, index: number): AssetRecord {
  const record = toRecord(item);
  const privateIp = normalizeNullableString(record.privateIp ?? record.private_ip);
  const publicIp = normalizeNullableString(record.publicIp ?? record.public_ip);

  return {
    assetId:
      normalizeString(record.assetId) ||
      normalizeString(record.asset_id) ||
      normalizeString(record.id) ||
      `asset-${index + 1}`,
    name: normalizeString(record.name, `Discovered asset ${index + 1}`),
    assetType:
      normalizeString(record.assetType || record.asset_type || record.resource_type, 'service'),
    environment: normalizeString(record.environment, 'production'),
    owner: normalizeNullableString(record.owner),
    region: normalizeNullableString(record.region),
    accountId: normalizeNullableString(record.accountId ?? record.account_id),
    inBoundary: normalizeBoolean(record.inBoundary ?? record.in_boundary, true),
    isPublic: normalizeBoolean(record.isPublic ?? record.is_public, false),
    privateIps: uniqueBy(
      [...normalizeStringArray(record.privateIps ?? record.private_ips), ...(privateIp ? [privateIp] : [])],
      (value) => value,
    ),
    publicIps: uniqueBy(
      [...normalizeStringArray(record.publicIps ?? record.public_ips), ...(publicIp ? [publicIp] : [])],
      (value) => value,
    ),
    metadata: toRecord(record.metadata),
  };
}

function normalizeEventRecord(item: unknown, index: number): SecurityEventRecord {
  const record = toRecord(item);
  return {
    eventId:
      normalizeString(record.eventId) ||
      normalizeString(record.event_id) ||
      normalizeString(record.id) ||
      `event-${index + 1}`,
    assetId: normalizeNullableString(record.assetId ?? record.asset_id),
    semanticType:
      normalizeString(record.semanticType || record.semantic_type || record.eventType || record.event_type, 'generic.event'),
    severity: normalizeSeverity(record.severity),
    status: normalizeStatus(record.status, 'open'),
    centralEventRef: normalizeNullableString(record.centralEventRef ?? record.central_event_ref),
    localEventRef: normalizeNullableString(record.localEventRef ?? record.local_event_ref),
    title: normalizeString(record.title, `Security event ${index + 1}`),
    metadata: toRecord(record.metadata),
  };
}

function normalizeScannerTarget(item: unknown, index: number): ScannerTargetRecord {
  const record = toRecord(item);
  return {
    targetId:
      normalizeString(record.targetId) ||
      normalizeString(record.target_id) ||
      normalizeString(record.id) ||
      `target-${index + 1}`,
    assetId: normalizeNullableString(record.assetId ?? record.asset_id),
    scannerName: normalizeString(record.scannerName ?? record.scanner ?? record.scanner_name, 'scanner'),
    hostname: normalizeNullableString(record.hostname),
    ipAddress: normalizeNullableString(record.ipAddress ?? record.ip ?? record.ip_address),
    credentialed: normalizeBoolean(record.credentialed, false),
    lastScanTime: normalizeNullableString(record.lastScanTime ?? record.last_scan_time),
    metadata: toRecord(record.metadata),
  };
}

function normalizeScannerFinding(item: unknown, index: number): ScannerFindingRecord {
  const record = toRecord(item);
  return {
    findingId:
      normalizeString(record.findingId) ||
      normalizeString(record.finding_id) ||
      normalizeString(record.id) ||
      `finding-${index + 1}`,
    assetId: normalizeNullableString(record.assetId ?? record.asset_id),
    severity: normalizeSeverity(record.severity),
    status: normalizeStatus(record.status, 'open'),
    title: normalizeString(record.title, `Finding ${index + 1}`),
    cveIds: normalizeStringArray(record.cveIds ?? record.cve_ids ?? (record.cve ? [record.cve] : [])),
    linkedTicketIds: normalizeStringArray(record.linkedTicketIds ?? record.linked_ticket_ids),
    exploitationReview: toRecord(record.exploitationReview ?? record.exploitation_review),
    metadata: toRecord(record.metadata),
  };
}

function normalizeLogSource(item: unknown, index: number): LogSourceRecord {
  const record = toRecord(item);
  return {
    sourceId:
      normalizeString(record.sourceId) ||
      normalizeString(record.source_id) ||
      normalizeString(record.id) ||
      `log-${index + 1}`,
    assetId: normalizeNullableString(record.assetId ?? record.asset_id),
    sourceType: normalizeNullableString(record.sourceType ?? record.source_type),
    localSource: normalizeNullableString(record.localSource ?? record.local_source),
    centralDestination: normalizeNullableString(record.centralDestination ?? record.central_destination),
    status: normalizeStatus(record.status, 'missing'),
    sampleLocalEventRef: normalizeNullableString(record.sampleLocalEventRef ?? record.sample_local_event_ref),
    sampleCentralEventRef: normalizeNullableString(record.sampleCentralEventRef ?? record.sample_central_event_ref),
    lastSeen: normalizeNullableString(record.lastSeen ?? record.last_seen),
    metadata: toRecord(record.metadata),
  };
}

function normalizeAlertRule(item: unknown, index: number): AlertRuleRecord {
  const record = toRecord(item);
  return {
    ruleId:
      normalizeString(record.ruleId) ||
      normalizeString(record.rule_id) ||
      normalizeString(record.id) ||
      `rule-${index + 1}`,
    name: normalizeString(record.name, `Alert rule ${index + 1}`),
    enabled: normalizeBoolean(record.enabled, true),
    semanticTypes: normalizeStringArray(
      record.semanticTypes ?? record.semantic_types ?? record.eventTypes ?? record.event_types,
    ),
    recipients: normalizeStringArray(record.recipients),
    lastFired: normalizeNullableString(record.lastFired ?? record.last_fired),
    metadata: toRecord(record.metadata),
  };
}

function normalizeTicket(item: unknown, index: number): TicketRecord {
  const record = toRecord(item);
  return {
    ticketId:
      normalizeString(record.ticketId) ||
      normalizeString(record.ticket_id) ||
      normalizeString(record.id) ||
      `ticket-${index + 1}`,
    title: normalizeString(record.title, `Ticket ${index + 1}`),
    status: normalizeStatus(record.status, 'open'),
    linkedAssetIds: normalizeStringArray(record.linkedAssetIds ?? record.linked_asset_ids ?? record.links_asset_id),
    linkedEventIds: normalizeStringArray(record.linkedEventIds ?? record.linked_event_ids ?? record.links_event_ref),
    linkedFindingIds: normalizeStringArray(record.linkedFindingIds ?? record.linked_finding_ids),
    hasSecurityImpactAnalysis: normalizeBoolean(
      record.hasSecurityImpactAnalysis ?? record.security_impact_analysis,
      false,
    ),
    hasTestingEvidence: normalizeBoolean(record.hasTestingEvidence ?? record.test_evidence, false),
    hasApproval: normalizeBoolean(record.hasApproval ?? record.approval_recorded, false),
    hasDeploymentEvidence: normalizeBoolean(
      record.hasDeploymentEvidence ?? record.deployment_recorded,
      false,
    ),
    hasVerificationEvidence: normalizeBoolean(
      record.hasVerificationEvidence ?? record.post_deploy_verification,
      false,
    ),
    metadata: toRecord(record.metadata),
  };
}

function normalizeSeededPoam(item: unknown, index: number): SeededPoamRecord {
  const record = toRecord(item);
  return {
    poamId:
      normalizeString(record.poamId) ||
      normalizeString(record.poam_id) ||
      normalizeString(record.id) ||
      `poam-${index + 1}`,
    title: normalizeString(record.title, `POA&M ${index + 1}`),
    status: normalizeStatus(record.status, 'open'),
    severity: normalizeSeverity(record.severity),
    metadata: toRecord(record.metadata),
  };
}

export function normalizeEvidenceBundle(args: {
  tenantId: string;
  folderId: string | null;
  sourceName: string;
  provider: string;
  inputMode: EvidenceInputMode;
  bundleKind: BundleKind;
  rawBundle: Record<string, unknown>;
}): NormalizedEvidenceBundle {
  const declaredInventory = pickArray(args.rawBundle, [
    'declaredInventory',
    'declared_inventory',
    'authoritative_inventory',
  ]).map(normalizeDeclaredInventoryRecord);
  const discoveredAssets = pickArray(args.rawBundle, [
    'discoveredAssets',
    'discovered_assets',
    'assets',
  ]).map(normalizeAssetRecord);
  const cloudEvents = pickArray(args.rawBundle, ['cloudEvents', 'cloud_events', 'events']).map(
    normalizeEventRecord,
  );
  const scannerTargets = pickArray(args.rawBundle, [
    'scannerTargets',
    'scanner_targets',
    'targets',
  ]).map(normalizeScannerTarget);
  const scannerFindings = pickArray(args.rawBundle, [
    'scannerFindings',
    'scanner_findings',
    'findings',
  ]).map(normalizeScannerFinding);
  const centralLogSources = pickArray(args.rawBundle, [
    'centralLogSources',
    'central_log_sources',
    'logSources',
    'sources',
  ]).map(normalizeLogSource);
  const alertRules = pickArray(args.rawBundle, ['alertRules', 'alert_rules', 'rules']).map(
    normalizeAlertRule,
  );
  const tickets = pickArray(args.rawBundle, ['tickets']).map(normalizeTicket);
  const seededPoam = pickArray(args.rawBundle, ['seededPoam', 'seeded_poam', 'poam']).map(
    normalizeSeededPoam,
  );

  return {
    tenantId: args.tenantId,
    folderId: args.folderId,
    inputMode: args.inputMode,
    bundleKind: args.bundleKind,
    sourceName: args.sourceName,
    provider: args.provider,
    collectedAt: normalizeString(args.rawBundle.collectedAt ?? args.rawBundle.generatedAt, nowIso()),
    schemaVersion: normalizeString(args.rawBundle.schemaVersion ?? args.rawBundle.schema_version, 'v1'),
    declaredInventory: uniqueBy(declaredInventory, (item) => item.assetId),
    discoveredAssets: uniqueBy(discoveredAssets, (item) => item.assetId),
    cloudEvents: uniqueBy(cloudEvents, (item) => item.eventId),
    scannerTargets: uniqueBy(scannerTargets, (item) => item.targetId),
    scannerFindings: uniqueBy(scannerFindings, (item) => item.findingId),
    centralLogSources: uniqueBy(centralLogSources, (item) => item.sourceId),
    alertRules: uniqueBy(alertRules, (item) => item.ruleId),
    tickets: uniqueBy(tickets, (item) => item.ticketId),
    seededPoam: uniqueBy(seededPoam, (item) => item.poamId),
    metadata: toRecord(args.rawBundle.metadata),
  };
}

export function bundleFromTrackerDiagnostics(args: {
  tenantId: string;
  folderId: string | null;
  sourceName: string;
  provider: string;
  bundleKind: BundleKind;
  diagnostics: TrackerDiagnosticRow[];
}): NormalizedEvidenceBundle {
  const collectedAt = nowIso();
  const declaredInventory: DeclaredInventoryRecord[] = [
    {
      assetId: 'tracker-derived-workspace',
      name: 'Tracker-derived control workspace',
      assetType: 'assessment-workspace',
      environment: 'production',
      owner: 'Assurance',
      region: 'global',
      accountId: 'tracker',
      inBoundary: true,
      scannerRequired: false,
      logRequired: false,
      isPublic: false,
      metadata: {
        source: 'tracker',
      },
    },
  ];

  const discoveredAssets: AssetRecord[] = [];
  const cloudEvents: SecurityEventRecord[] = [];
  const scannerTargets: ScannerTargetRecord[] = [];
  const scannerFindings: ScannerFindingRecord[] = args.diagnostics.map((row) => ({
    findingId: row.row_key ?? `tracker-row-${row.row_index}`,
    assetId: 'tracker-derived-workspace',
    severity: normalizeSeverity(row.severity, 'moderate'),
    status: normalizeStatus(row.row_status, 'open'),
    title: row.detail,
    cveIds: [],
    linkedTicketIds: [],
    exploitationReview: {},
    metadata: {
      category: row.category,
      owner: row.owner_name,
      controlRefs: asJson<string[]>(row.control_refs_json, []),
    },
  }));
  const centralLogSources: LogSourceRecord[] = [];
  const alertRules: AlertRuleRecord[] = [];
  const tickets: TicketRecord[] = [];
  const seededPoam: SeededPoamRecord[] = [];

  return {
    tenantId: args.tenantId,
    folderId: args.folderId,
    inputMode: 'tracker',
    bundleKind: args.bundleKind,
    sourceName: args.sourceName,
    provider: args.provider,
    collectedAt,
    schemaVersion: 'v1',
    declaredInventory,
    discoveredAssets,
    cloudEvents,
    scannerTargets,
    scannerFindings,
    centralLogSources,
    alertRules,
    tickets,
    seededPoam,
    metadata: {
      trackerRows: args.diagnostics.length,
    },
  };
}

export function resolveBundleFromCollection(args: {
  tenantId: string;
  folderId: string | null;
  provider: string;
  sourceName: string;
  inputMode: EvidenceInputMode;
  bundleKind: BundleKind;
  sourceConfig: EvidenceSourceConfig;
  adapterHints: Record<string, unknown>;
  trackerDiagnostics?: TrackerDiagnosticRow[];
}): { rawBundle: Record<string, unknown>; bundle: NormalizedEvidenceBundle } {
  if (args.inputMode === 'tracker' && args.trackerDiagnostics) {
    const bundle = bundleFromTrackerDiagnostics({
      tenantId: args.tenantId,
      folderId: args.folderId,
      sourceName: args.sourceName,
      provider: args.provider,
      bundleKind: args.bundleKind,
      diagnostics: args.trackerDiagnostics,
    });
    return {
      rawBundle: {
        metadata: bundle.metadata,
        findings: bundle.scannerFindings,
      },
      bundle,
    };
  }

  const liveAdapterBundle = resolveLiveAdapterBundle({
    provider: args.provider,
    sourceName: args.sourceName,
    inputMode: args.inputMode,
    bundleKind: args.bundleKind,
    sourceConfig: args.sourceConfig,
    adapterHints: args.adapterHints,
  });
  if (liveAdapterBundle) {
    return {
      rawBundle: liveAdapterBundle.rawBundle,
      bundle: normalizeEvidenceBundle({
        tenantId: args.tenantId,
        folderId: args.folderId,
        sourceName: args.sourceName,
        provider: args.provider,
        inputMode: args.inputMode,
        bundleKind: args.bundleKind,
        rawBundle: liveAdapterBundle.rawBundle,
      }),
    };
  }

  const hintedBundle = toRecord(args.adapterHints.bundle);
  const configuredFixtureBundle = toRecord(args.sourceConfig.fixtureBundle);
  const explicitBundle = Object.keys(hintedBundle).length > 0 ? hintedBundle : configuredFixtureBundle;

  if (args.inputMode === 'fixture' && Object.keys(explicitBundle).length > 0) {
    return {
      rawBundle: explicitBundle,
      bundle: normalizeEvidenceBundle({
        tenantId: args.tenantId,
        folderId: args.folderId,
        sourceName: args.sourceName,
        provider: args.provider,
        inputMode: args.inputMode,
        bundleKind: args.bundleKind,
        rawBundle: explicitBundle,
      }),
    };
  }

  const syntheticSeedAllowed =
    normalizeBoolean(
      args.adapterHints.allowSyntheticSeed ?? args.sourceConfig.allowSyntheticSeed,
      false,
    ) || normalizeString(args.sourceConfig.mode).toLowerCase() === 'manual-demo';

  if (!syntheticSeedAllowed && (args.inputMode === 'live' || args.inputMode === 'fixture')) {
    throw new Error(
      `Evidence source ${args.sourceName} requires adapter-backed liveCollection data or an explicit fixture bundle; synthetic provider seeding is disabled for ${args.inputMode} mode.`,
    );
  }

  const bundle = createProviderSeedBundle({
    tenantId: args.tenantId,
    folderId: args.folderId,
    provider: args.provider,
    sourceName: args.sourceName,
    inputMode: args.inputMode,
    bundleKind: args.bundleKind,
    config: args.sourceConfig,
  });

  return {
    rawBundle: {
      declaredInventory: bundle.declaredInventory,
      discoveredAssets: bundle.discoveredAssets,
      cloudEvents: bundle.cloudEvents,
      scannerTargets: bundle.scannerTargets,
      scannerFindings: bundle.scannerFindings,
      centralLogSources: bundle.centralLogSources,
      alertRules: bundle.alertRules,
      tickets: bundle.tickets,
      seededPoam: bundle.seededPoam,
      metadata: bundle.metadata,
      collectedAt: bundle.collectedAt,
      schemaVersion: bundle.schemaVersion,
    },
    bundle,
  };
}

async function insertEvidenceArtifactRecord(args: {
  env: EnvBindings;
  tenantId: string;
  jobId: string;
  artifactId: string;
  objectKey: string;
  artifactFamily: BundleArtifactFamily;
  manifestGroup: string;
  bodySize: number;
  createdAt: string;
  contentType?: string;
  checksum?: string;
}) {
  await args.env.D1_MAIN.prepare(
    `
    INSERT OR REPLACE INTO evidence_artifacts (
      id,
      tenant_id,
      job_id,
      object_key,
      content_type,
      size_bytes,
      checksum,
      created_at,
      artifact_family,
      manifest_group
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      args.artifactId,
      args.tenantId,
      args.jobId,
      args.objectKey,
      args.contentType ?? 'application/json',
      args.bodySize,
      args.checksum ?? `sha1:${args.jobId}:${args.artifactFamily}`,
      args.createdAt,
      args.artifactFamily,
      args.manifestGroup,
    )
    .run();
}

async function clearBundleSlices(env: EnvBindings, evidenceJobId: string): Promise<void> {
  await env.D1_MAIN.batch([
    env.D1_MAIN.prepare(`DELETE FROM assurance_bundle_assets WHERE evidence_job_id = ?`).bind(evidenceJobId),
    env.D1_MAIN.prepare(`DELETE FROM assurance_bundle_events WHERE evidence_job_id = ?`).bind(evidenceJobId),
    env.D1_MAIN.prepare(`DELETE FROM assurance_bundle_findings WHERE evidence_job_id = ?`).bind(evidenceJobId),
    env.D1_MAIN.prepare(`DELETE FROM assurance_bundle_scanner_targets WHERE evidence_job_id = ?`).bind(evidenceJobId),
    env.D1_MAIN.prepare(`DELETE FROM assurance_bundle_log_sources WHERE evidence_job_id = ?`).bind(evidenceJobId),
    env.D1_MAIN.prepare(`DELETE FROM assurance_bundle_alert_rules WHERE evidence_job_id = ?`).bind(evidenceJobId),
    env.D1_MAIN.prepare(`DELETE FROM assurance_bundle_tickets WHERE evidence_job_id = ?`).bind(evidenceJobId),
  ]);
}

export async function persistNormalizedBundle(
  context: BundlePersistenceContext,
  bundle: NormalizedEvidenceBundle,
): Promise<void> {
  await clearBundleSlices(context.env, context.evidenceJobId);

  const statements = [];
  const timestamp = nowIso();

  for (const item of bundle.declaredInventory) {
    statements.push(
      context.env.D1_MAIN.prepare(
        `
        INSERT INTO assurance_bundle_assets (
          id, tenant_id, folder_id, evidence_job_id, asset_key, asset_origin, asset_type, name,
          environment, owner_name, account_id, region, in_boundary, is_public, attributes_json,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).bind(
        crypto.randomUUID(),
        context.tenantId,
        context.folderId,
        context.evidenceJobId,
        item.assetId,
        'declared',
        item.assetType,
        item.name,
        item.environment,
        item.owner ?? null,
        item.accountId ?? null,
        item.region ?? null,
        item.inBoundary ? 1 : 0,
        item.isPublic ? 1 : 0,
        JSON.stringify({
          scannerRequired: item.scannerRequired,
          logRequired: item.logRequired,
          expectedPrivateIp: item.expectedPrivateIp,
          expectedPublicIp: item.expectedPublicIp,
          ...toRecord(item.metadata),
        }),
        timestamp,
        timestamp,
      ),
    );
  }

  for (const item of bundle.discoveredAssets) {
    statements.push(
      context.env.D1_MAIN.prepare(
        `
        INSERT INTO assurance_bundle_assets (
          id, tenant_id, folder_id, evidence_job_id, asset_key, asset_origin, asset_type, name,
          environment, owner_name, account_id, region, in_boundary, is_public, attributes_json,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).bind(
        crypto.randomUUID(),
        context.tenantId,
        context.folderId,
        context.evidenceJobId,
        item.assetId,
        'discovered',
        item.assetType,
        item.name,
        item.environment,
        item.owner ?? null,
        item.accountId ?? null,
        item.region ?? null,
        item.inBoundary ? 1 : 0,
        item.isPublic ? 1 : 0,
        JSON.stringify({
          privateIps: item.privateIps,
          publicIps: item.publicIps,
          ...toRecord(item.metadata),
        }),
        timestamp,
        timestamp,
      ),
    );
  }

  for (const item of bundle.cloudEvents) {
    statements.push(
      context.env.D1_MAIN.prepare(
        `
        INSERT INTO assurance_bundle_events (
          id, tenant_id, folder_id, evidence_job_id, event_id, asset_key, semantic_type, severity, status,
          central_event_ref, attributes_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).bind(
        crypto.randomUUID(),
        context.tenantId,
        context.folderId,
        context.evidenceJobId,
        item.eventId,
        item.assetId ?? null,
        item.semanticType,
        item.severity,
        item.status,
        item.centralEventRef ?? null,
        JSON.stringify({
          localEventRef: item.localEventRef,
          title: item.title,
          ...toRecord(item.metadata),
        }),
        timestamp,
        timestamp,
      ),
    );
  }

  for (const item of bundle.scannerTargets) {
    statements.push(
      context.env.D1_MAIN.prepare(
        `
        INSERT INTO assurance_bundle_scanner_targets (
          id, tenant_id, folder_id, evidence_job_id, target_id, asset_key, scanner_name,
          hostname, ip_address, credentialed, last_scan_time, attributes_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).bind(
        crypto.randomUUID(),
        context.tenantId,
        context.folderId,
        context.evidenceJobId,
        item.targetId,
        item.assetId ?? null,
        item.scannerName,
        item.hostname ?? null,
        item.ipAddress ?? null,
        item.credentialed ? 1 : 0,
        item.lastScanTime ?? null,
        JSON.stringify(toRecord(item.metadata)),
        timestamp,
        timestamp,
      ),
    );
  }

  for (const item of bundle.scannerFindings) {
    statements.push(
      context.env.D1_MAIN.prepare(
        `
        INSERT INTO assurance_bundle_findings (
          id, tenant_id, folder_id, evidence_job_id, finding_id, asset_key, severity, status,
          title, cve_ids_json, linked_ticket_ids_json, exploitation_review_json, attributes_json,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).bind(
        crypto.randomUUID(),
        context.tenantId,
        context.folderId,
        context.evidenceJobId,
        item.findingId,
        item.assetId ?? null,
        item.severity,
        item.status,
        item.title,
        JSON.stringify(item.cveIds),
        JSON.stringify(item.linkedTicketIds),
        JSON.stringify(item.exploitationReview),
        JSON.stringify(toRecord(item.metadata)),
        timestamp,
        timestamp,
      ),
    );
  }

  for (const item of bundle.centralLogSources) {
    statements.push(
      context.env.D1_MAIN.prepare(
        `
        INSERT INTO assurance_bundle_log_sources (
          id, tenant_id, folder_id, evidence_job_id, source_id, asset_key, source_type, local_source,
          central_destination, status, sample_local_event_ref, sample_central_event_ref, last_seen,
          attributes_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).bind(
        crypto.randomUUID(),
        context.tenantId,
        context.folderId,
        context.evidenceJobId,
        item.sourceId,
        item.assetId ?? null,
        item.sourceType ?? null,
        item.localSource ?? null,
        item.centralDestination ?? null,
        item.status,
        item.sampleLocalEventRef ?? null,
        item.sampleCentralEventRef ?? null,
        item.lastSeen ?? null,
        JSON.stringify(toRecord(item.metadata)),
        timestamp,
        timestamp,
      ),
    );
  }

  for (const item of bundle.alertRules) {
    statements.push(
      context.env.D1_MAIN.prepare(
        `
        INSERT INTO assurance_bundle_alert_rules (
          id, tenant_id, folder_id, evidence_job_id, rule_id, name, enabled, semantic_types_json,
          recipients_json, last_fired, attributes_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).bind(
        crypto.randomUUID(),
        context.tenantId,
        context.folderId,
        context.evidenceJobId,
        item.ruleId,
        item.name,
        item.enabled ? 1 : 0,
        JSON.stringify(item.semanticTypes),
        JSON.stringify(item.recipients),
        item.lastFired ?? null,
        JSON.stringify(toRecord(item.metadata)),
        timestamp,
        timestamp,
      ),
    );
  }

  for (const item of bundle.tickets) {
    statements.push(
      context.env.D1_MAIN.prepare(
        `
        INSERT INTO assurance_bundle_tickets (
          id, tenant_id, folder_id, evidence_job_id, ticket_id, title, status, linked_asset_keys_json,
          linked_event_ids_json, linked_finding_ids_json, has_security_impact_analysis, has_testing_evidence,
          has_approval, has_deployment_evidence, has_verification_evidence, attributes_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).bind(
        crypto.randomUUID(),
        context.tenantId,
        context.folderId,
        context.evidenceJobId,
        item.ticketId,
        item.title,
        item.status,
        JSON.stringify(item.linkedAssetIds),
        JSON.stringify(item.linkedEventIds),
        JSON.stringify(item.linkedFindingIds),
        item.hasSecurityImpactAnalysis ? 1 : 0,
        item.hasTestingEvidence ? 1 : 0,
        item.hasApproval ? 1 : 0,
        item.hasDeploymentEvidence ? 1 : 0,
        item.hasVerificationEvidence ? 1 : 0,
        JSON.stringify(toRecord(item.metadata)),
        timestamp,
        timestamp,
      ),
    );
  }

  if (statements.length > 0) {
    await context.env.D1_MAIN.batch(statements);
  }
}

export async function storeBundleArtifacts(args: {
  env: EnvBindings;
  tenantId: string;
  sourceId: string;
  jobId: string;
  rawBundle: Record<string, unknown>;
  bundle: NormalizedEvidenceBundle;
}): Promise<{
  manifestKey: string;
  coverage: EvidenceCoverageSummary;
  artifactKeys: Record<BundleArtifactFamily, string>;
}> {
  const manifestKey = artifactKeyForEvidenceJob(args.tenantId, args.sourceId, args.jobId, 'bundle_manifest');
  const rawKey = artifactKeyForEvidenceJob(args.tenantId, args.sourceId, args.jobId, 'raw_input');
  const bundleKey = artifactKeyForEvidenceJob(args.tenantId, args.sourceId, args.jobId, 'normalized_bundle');
  const liveCoverageKey = artifactKeyForEvidenceJob(
    args.tenantId,
    args.sourceId,
    args.jobId,
    'live_collection_coverage',
  );
  const coverage = coverageSummary(args.bundle);
  const manifest = {
    schemaVersion: 'v1',
    generatedAt: nowIso(),
    families: [
      { family: 'raw_input', path: rawKey },
      { family: 'normalized_bundle', path: bundleKey },
      { family: 'live_collection_coverage', path: liveCoverageKey },
    ],
  };

  await Promise.all([
    writeJsonArtifact(args.env, rawKey, args.rawBundle),
    writeJsonArtifact(args.env, bundleKey, args.bundle),
    writeJsonArtifact(args.env, liveCoverageKey, {
      status: 'ready',
      coverage,
      sourceName: args.bundle.sourceName,
      provider: args.bundle.provider,
      collectedAt: args.bundle.collectedAt,
    }),
    writeJsonArtifact(args.env, manifestKey, manifest),
  ]);

  const createdAt = nowIso();
  const artifactEntries: Array<[BundleArtifactFamily, string, unknown]> = [
    ['raw_input', rawKey, args.rawBundle],
    ['normalized_bundle', bundleKey, args.bundle],
    ['live_collection_coverage', liveCoverageKey, coverage],
    ['bundle_manifest', manifestKey, manifest],
  ];

  await Promise.all(
    artifactEntries.map(async ([family, key, payload], index) =>
      insertEvidenceArtifactRecord({
        env: args.env,
        tenantId: args.tenantId,
        jobId: args.jobId,
        artifactId: `artifact:${args.jobId}:${index}:${family}`,
        objectKey: key,
        artifactFamily: family,
        manifestGroup: args.jobId,
        bodySize: JSON.stringify(payload).length,
        createdAt,
      }),
    ),
  );

  return {
    manifestKey,
    coverage,
    artifactKeys: {
      raw_input: rawKey,
      normalized_bundle: bundleKey,
      bundle_manifest: manifestKey,
      live_collection_coverage: liveCoverageKey,
      assessment_summary: '',
      eval_results: '',
      evidence_gaps: '',
      poam_items: '',
      evidence_graph: '',
      correlations: '',
      correlation_report: '',
      auditor_questions: '',
      instrumentation_plan: '',
      evidence_gap_matrix: '',
      reasonableness_findings: '',
      validation_report: '',
      threat_hunt_findings: '',
      threat_hunt_timeline: '',
      threat_hunt_queries: '',
      tracker_diagnostics: '',
      tracker_gap_report: '',
      tracker_gap_matrix: '',
      tracker_instrumentation_plan: '',
      package_json: '',
      review_ledger: '',
      report_manifest: '',
      reconciliation: '',
    },
  };
}

function createEvalResult(
  evalCode: string,
  status: AssuranceEvalStatus,
  severity: AssuranceSeverity,
  summary: string,
  rationale: string,
  metrics: Record<string, unknown>,
  evidenceRefs: Array<{ artifact: string; field: string; note?: string }>,
): EvalResult {
  return {
    id: crypto.randomUUID(),
    evalCode,
    title: EVAL_TITLES[evalCode] ?? evalCode,
    status,
    severity,
    summary,
    rationale,
    metrics,
    evidenceRefs,
  };
}

function createGap(args: Omit<EvidenceGap, 'id'>): EvidenceGap {
  return {
    id: crypto.randomUUID(),
    ...args,
  };
}

function createPoam(args: Omit<PoamItem, 'id'>): PoamItem {
  return {
    id: crypto.randomUUID(),
    ...args,
  };
}

function assetRequirementMap(bundle: NormalizedEvidenceBundle) {
  return new Map(
    bundle.declaredInventory.map((item) => [
      item.assetId,
      {
        scannerRequired: item.scannerRequired,
        logRequired: item.logRequired,
        inBoundary: item.inBoundary,
        isPublic: item.isPublic ?? false,
      },
    ]),
  );
}

function buildGraph(bundle: NormalizedEvidenceBundle): EvidenceGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const item of bundle.declaredInventory) {
    nodes.push({
      key: `asset::declared::${item.assetId}`,
      type: 'asset',
      label: item.name,
      attributes: {
        origin: 'declared',
        assetType: item.assetType,
        environment: item.environment,
      },
    });
  }

  for (const item of bundle.discoveredAssets) {
    nodes.push({
      key: `asset::discovered::${item.assetId}`,
      type: 'asset',
      label: item.name,
      attributes: {
        origin: 'discovered',
        assetType: item.assetType,
        environment: item.environment,
      },
    });
  }

  for (const event of bundle.cloudEvents) {
    nodes.push({
      key: `event::${event.eventId}`,
      type: 'event',
      label: event.title,
      attributes: {
        semanticType: event.semanticType,
        severity: event.severity,
      },
    });
    if (event.assetId) {
      edges.push({
        type: 'AFFECTS_ASSET',
        from: `event::${event.eventId}`,
        to: `asset::discovered::${event.assetId}`,
        attributes: {},
      });
    }
  }

  for (const finding of bundle.scannerFindings) {
    nodes.push({
      key: `finding::${finding.findingId}`,
      type: 'finding',
      label: finding.title,
      attributes: {
        severity: finding.severity,
        status: finding.status,
      },
    });
    if (finding.assetId) {
      edges.push({
        type: 'OBSERVED_ON',
        from: `finding::${finding.findingId}`,
        to: `asset::discovered::${finding.assetId}`,
        attributes: {},
      });
    }
    for (const ticketId of finding.linkedTicketIds) {
      edges.push({
        type: 'TRACKED_BY',
        from: `finding::${finding.findingId}`,
        to: `ticket::${ticketId}`,
        attributes: {},
      });
    }
  }

  for (const ticket of bundle.tickets) {
    nodes.push({
      key: `ticket::${ticket.ticketId}`,
      type: 'ticket',
      label: ticket.title,
      attributes: {
        status: ticket.status,
      },
    });
    for (const assetId of ticket.linkedAssetIds) {
      edges.push({
        type: 'RELATES_TO_ASSET',
        from: `ticket::${ticket.ticketId}`,
        to: `asset::declared::${assetId}`,
        attributes: {},
      });
    }
    for (const eventId of ticket.linkedEventIds) {
      edges.push({
        type: 'RELATES_TO_EVENT',
        from: `ticket::${ticket.ticketId}`,
        to: `event::${eventId}`,
        attributes: {},
      });
    }
  }

  return {
    nodes: uniqueBy(nodes, (node) => node.key),
    edges: uniqueBy(edges, (edge) => `${edge.type}:${edge.from}:${edge.to}`),
  };
}

export function evaluateNormalizedBundle(args: {
  evidenceJobId: string;
  bundle: NormalizedEvidenceBundle;
}): EvaluationArtifacts {
  const evalResults: EvalResult[] = [];
  const gaps: EvidenceGap[] = [];
  const poamItems: PoamItem[] = [];
  const reasonablenessFindings: ReasonablenessFinding[] = [];
  const reviewRecommendations: ReviewRecommendation[] = [];
  const graph = buildGraph(args.bundle);
  const correlations: Array<Record<string, unknown>> = [];

  const requirements = assetRequirementMap(args.bundle);
  const declaredKeys = new Map(args.bundle.declaredInventory.map((item) => [item.assetId, item]));
  const discoveredKeys = new Map(args.bundle.discoveredAssets.map((item) => [item.assetId, item]));

  const missingDeclared = args.bundle.declaredInventory.filter(
    (item) => item.inBoundary && !discoveredKeys.has(item.assetId),
  );
  const rogueDiscovered = args.bundle.discoveredAssets.filter(
    (item) => item.inBoundary && !declaredKeys.has(item.assetId),
  );
  const duplicateDeclared =
    args.bundle.declaredInventory.length - uniqueBy(args.bundle.declaredInventory, (item) => item.assetId).length;
  const inventoryStatus: AssuranceEvalStatus =
    missingDeclared.length > 0 || rogueDiscovered.length > 0 || duplicateDeclared > 0
      ? 'FAIL'
      : args.bundle.declaredInventory.length === 0
        ? 'PARTIAL'
        : 'PASS';

  evalResults.push(
    createEvalResult(
      'CM8_INVENTORY_RECONCILIATION',
      inventoryStatus,
      inventoryStatus === 'FAIL' ? 'high' : 'moderate',
      inventoryStatus === 'PASS'
        ? 'Declared inventory reconciles to discovered in-boundary assets.'
        : 'Inventory reconciliation found missing or unmatched assets.',
      `Missing declared assets: ${missingDeclared.length}; rogue discovered assets: ${rogueDiscovered.length}; duplicate declared asset ids: ${duplicateDeclared}.`,
      {
        missingDeclaredAssets: missingDeclared.length,
        rogueDiscoveredAssets: rogueDiscovered.length,
        duplicateDeclaredAssetIds: duplicateDeclared,
      },
      [{ artifact: 'normalized_bundle', field: 'declaredInventory', note: 'Inventory comparison' }],
    ),
  );

  for (const item of missingDeclared) {
    gaps.push(
      createGap({
        evalResultId: evalResults.at(-1)?.id ?? null,
        gapType: 'inventory_missing_discovery_match',
        severity: 'high',
        title: `Declared asset ${item.name} was not matched in discovery`,
        detail: `The in-boundary declared asset ${item.assetId} is missing from discovered assets.`,
        affectedObjectType: 'asset',
        affectedObjectId: item.assetId,
        controlRefs: ['CM-8'],
        ksiRefs: KSI_BY_EVAL.CM8_INVENTORY_RECONCILIATION,
        recommendedArtifact: 'discovered_assets.json',
        poamRequired: true,
      }),
    );
  }

  for (const item of rogueDiscovered) {
    gaps.push(
      createGap({
        evalResultId: evalResults.at(-1)?.id ?? null,
        gapType: 'rogue_discovered_asset',
        severity: 'high',
        title: `Discovered asset ${item.name} is not in declared inventory`,
        detail: `The discovered in-boundary asset ${item.assetId} has no authoritative inventory record.`,
        affectedObjectType: 'asset',
        affectedObjectId: item.assetId,
        controlRefs: ['CM-8'],
        ksiRefs: KSI_BY_EVAL.CM8_INVENTORY_RECONCILIATION,
        recommendedArtifact: 'declared_inventory.csv',
        poamRequired: true,
      }),
    );
  }

  const targetAssetKeys = new Set(
    args.bundle.scannerTargets
      .map((item) => item.assetId ?? item.hostname ?? item.ipAddress ?? '')
      .filter(Boolean),
  );
  const assetsMissingScannerCoverage = args.bundle.declaredInventory.filter((item) => {
    const requirement = requirements.get(item.assetId);
    return requirement?.inBoundary && requirement.scannerRequired && !targetAssetKeys.has(item.assetId);
  });
  const scannerStatus: AssuranceEvalStatus =
    assetsMissingScannerCoverage.length > 0 ? 'FAIL' : args.bundle.scannerTargets.length === 0 ? 'PARTIAL' : 'PASS';
  evalResults.push(
    createEvalResult(
      'RA5_SCANNER_SCOPE_COVERAGE',
      scannerStatus,
      scannerStatus === 'FAIL' ? 'high' : 'moderate',
      scannerStatus === 'PASS'
        ? 'All required in-boundary assets are covered by scanner targets.'
        : 'Some required in-boundary assets lack scanner target coverage.',
      `Assets missing scanner targets: ${assetsMissingScannerCoverage.length}.`,
      {
        missingScannerTargets: assetsMissingScannerCoverage.length,
        scannerTargetCount: args.bundle.scannerTargets.length,
      },
      [{ artifact: 'normalized_bundle', field: 'scannerTargets', note: 'Scanner scope coverage' }],
    ),
  );
  for (const item of assetsMissingScannerCoverage) {
    gaps.push(
      createGap({
        evalResultId: evalResults.at(-1)?.id ?? null,
        gapType: 'missing_scanner_target',
        severity: 'high',
        title: `Asset ${item.name} is missing scanner target coverage`,
        detail: `The in-boundary asset ${item.assetId} requires scanning but no scanner target matched it.`,
        affectedObjectType: 'asset',
        affectedObjectId: item.assetId,
        controlRefs: ['RA-5'],
        ksiRefs: KSI_BY_EVAL.RA5_SCANNER_SCOPE_COVERAGE,
        recommendedArtifact: 'scanner_targets.csv',
        poamRequired: true,
      }),
    );
  }

  const logSourceByAsset = new Map(args.bundle.centralLogSources.map((item) => [item.assetId ?? item.sourceId, item]));
  const assetsMissingLogs = args.bundle.declaredInventory.filter((item) => {
    const requirement = requirements.get(item.assetId);
    const source = logSourceByAsset.get(item.assetId);
    return requirement?.inBoundary && requirement.logRequired && (!source || source.status !== 'active');
  });
  const logStatus: AssuranceEvalStatus =
    assetsMissingLogs.length > 0 ? 'FAIL' : args.bundle.centralLogSources.length === 0 ? 'PARTIAL' : 'PASS';
  evalResults.push(
    createEvalResult(
      'AU6_CENTRALIZED_LOG_COVERAGE',
      logStatus,
      logStatus === 'FAIL' ? 'high' : 'moderate',
      logStatus === 'PASS'
        ? 'Required assets have active centralized logging coverage.'
        : 'One or more required assets do not show active centralized logging coverage.',
      `Assets missing active centralized logging: ${assetsMissingLogs.length}.`,
      {
        missingCentralLogCoverage: assetsMissingLogs.length,
      },
      [{ artifact: 'normalized_bundle', field: 'centralLogSources', note: 'Centralized log coverage' }],
    ),
  );
  for (const item of assetsMissingLogs) {
    gaps.push(
      createGap({
        evalResultId: evalResults.at(-1)?.id ?? null,
        gapType: 'missing_central_logging',
        severity: 'high',
        title: `Asset ${item.name} is missing active centralized logging`,
        detail: `No active centralized log source was found for the required asset ${item.assetId}.`,
        affectedObjectType: 'asset',
        affectedObjectId: item.assetId,
        controlRefs: ['AU-6'],
        ksiRefs: KSI_BY_EVAL.AU6_CENTRALIZED_LOG_COVERAGE,
        recommendedArtifact: 'central_log_sources.json',
        poamRequired: true,
      }),
    );
  }

  const eventsMissingCorrelation = args.bundle.cloudEvents.filter(
    (item) => !item.centralEventRef && !logSourceByAsset.get(item.assetId ?? ''),
  );
  const correlationStatus: AssuranceEvalStatus =
    eventsMissingCorrelation.length > 0 ? 'PARTIAL' : args.bundle.cloudEvents.length === 0 ? 'PARTIAL' : 'PASS';
  evalResults.push(
    createEvalResult(
      'AU6_LOCAL_TO_CENTRAL_CORRELATION',
      correlationStatus,
      correlationStatus === 'PASS' ? 'moderate' : 'high',
      correlationStatus === 'PASS'
        ? 'Security events are traceable between local and centralized sources.'
        : 'Some security events could not be correlated to centralized evidence.',
      `Events missing centralized correlation: ${eventsMissingCorrelation.length}.`,
      {
        eventsMissingCorrelation: eventsMissingCorrelation.length,
      },
      [{ artifact: 'normalized_bundle', field: 'cloudEvents', note: 'Event correlation' }],
    ),
  );
  for (const item of eventsMissingCorrelation) {
    gaps.push(
      createGap({
        evalResultId: evalResults.at(-1)?.id ?? null,
        gapType: 'event_correlation_missing',
        severity: 'moderate',
        title: `Event ${item.eventId} is missing centralized correlation evidence`,
        detail: `The event "${item.title}" did not include a central event reference or an active correlated log source.`,
        affectedObjectType: 'event',
        affectedObjectId: item.eventId,
        controlRefs: ['AU-6'],
        ksiRefs: KSI_BY_EVAL.AU6_LOCAL_TO_CENTRAL_CORRELATION,
        recommendedArtifact: 'cloud_events.json',
        poamRequired: true,
      }),
    );
  }

  const alertableTypes = new Set(args.bundle.cloudEvents.filter((item) => item.severity !== 'low').map((item) => item.semanticType));
  const enabledAlertTypes = new Set(
    args.bundle.alertRules
      .filter((item) => item.enabled)
      .flatMap((item) => item.semanticTypes)
      .filter(Boolean),
  );
  const missingAlertTypes = [...alertableTypes].filter((item) => !enabledAlertTypes.has(item));
  const alertStatus: AssuranceEvalStatus =
    missingAlertTypes.length > 0 ? 'FAIL' : alertableTypes.size === 0 ? 'PARTIAL' : 'PASS';
  evalResults.push(
    createEvalResult(
      'SI4_ALERT_INSTRUMENTATION',
      alertStatus,
      alertStatus === 'FAIL' ? 'high' : 'moderate',
      alertStatus === 'PASS'
        ? 'Alert coverage exists for the observed risk semantics.'
        : 'Observed risk semantics are missing enabled alert coverage.',
      `Missing alert semantics: ${missingAlertTypes.join(', ') || 'none'}.`,
      {
        missingAlertTypes,
      },
      [{ artifact: 'normalized_bundle', field: 'alertRules', note: 'Alert instrumentation coverage' }],
    ),
  );
  for (const semanticType of missingAlertTypes) {
    gaps.push(
      createGap({
        evalResultId: evalResults.at(-1)?.id ?? null,
        gapType: 'missing_alert_rule',
        severity: 'high',
        title: `Missing enabled alert rule for ${semanticType}`,
        detail: `No enabled alert rule matched the observed semantic type ${semanticType}.`,
        affectedObjectType: 'alert_rule',
        affectedObjectId: semanticType,
        controlRefs: ['SI-4'],
        ksiRefs: KSI_BY_EVAL.SI4_ALERT_INSTRUMENTATION,
        recommendedArtifact: 'alert_rules.json',
        poamRequired: true,
      }),
    );
  }

  const ticketById = new Map(args.bundle.tickets.map((item) => [item.ticketId, item]));
  const criticalFindings = args.bundle.scannerFindings.filter(
    (item) => ['critical', 'high'].includes(item.severity) && item.status !== 'closed',
  );
  const findingsMissingTicketChain = criticalFindings.filter((finding) => {
    const linkedTickets = finding.linkedTicketIds
      .map((ticketId) => ticketById.get(ticketId))
      .filter((ticket): ticket is TicketRecord => Boolean(ticket));
    if (linkedTickets.length === 0) {
      return true;
    }
    return linkedTickets.every(
      (ticket) =>
        !ticket.hasSecurityImpactAnalysis ||
        !ticket.hasTestingEvidence ||
        !ticket.hasApproval ||
        !ticket.hasDeploymentEvidence ||
        !ticket.hasVerificationEvidence,
    );
  });
  const ticketStatus: AssuranceEvalStatus =
    findingsMissingTicketChain.length > 0 ? 'FAIL' : criticalFindings.length === 0 ? 'PARTIAL' : 'PASS';
  evalResults.push(
    createEvalResult(
      'CM3_CHANGE_TICKET_LINKAGE',
      ticketStatus,
      ticketStatus === 'FAIL' ? 'high' : 'moderate',
      ticketStatus === 'PASS'
        ? 'High and critical findings have linked tickets with the expected change evidence chain.'
        : 'One or more high or critical findings are missing complete ticket or change evidence.',
      `High and critical findings missing a complete ticket chain: ${findingsMissingTicketChain.length}.`,
      {
        findingsMissingTicketChain: findingsMissingTicketChain.length,
      },
      [{ artifact: 'normalized_bundle', field: 'tickets', note: 'Ticket/change linkage' }],
    ),
  );
  for (const finding of findingsMissingTicketChain) {
    gaps.push(
      createGap({
        evalResultId: evalResults.at(-1)?.id ?? null,
        gapType: 'change_ticket_linkage_missing',
        severity: 'high',
        title: `Finding ${finding.title} is missing a complete change or ticket chain`,
        detail: `The finding ${finding.findingId} does not have linked ticket evidence for SIA, testing, approval, deployment, and verification.`,
        affectedObjectType: 'finding',
        affectedObjectId: finding.findingId,
        controlRefs: ['CM-3', 'SI-2'],
        ksiRefs: KSI_BY_EVAL.CM3_CHANGE_TICKET_LINKAGE,
        recommendedArtifact: 'tickets.json',
        poamRequired: true,
      }),
    );
  }

  const findingsMissingExploitationReview = criticalFindings.filter((finding) => {
    const review = finding.exploitationReview;
    return !normalizeBoolean(review.logReviewPerformed ?? review.exploitationReviewComplete, false);
  });
  const exploitationStatus: AssuranceEvalStatus =
    findingsMissingExploitationReview.length > 0 ? 'FAIL' : criticalFindings.length === 0 ? 'PARTIAL' : 'PASS';
  evalResults.push(
    createEvalResult(
      'RA5_EXPLOITATION_REVIEW',
      exploitationStatus,
      exploitationStatus === 'FAIL' ? 'critical' : 'moderate',
      exploitationStatus === 'PASS'
        ? 'High and critical findings include exploitation review evidence.'
        : 'One or more high or critical findings are missing exploitation review evidence.',
      `Findings missing exploitation review: ${findingsMissingExploitationReview.length}.`,
      {
        findingsMissingExploitationReview: findingsMissingExploitationReview.length,
      },
      [{ artifact: 'normalized_bundle', field: 'scannerFindings', note: 'Exploitation review' }],
    ),
  );
  for (const finding of findingsMissingExploitationReview) {
    gaps.push(
      createGap({
        evalResultId: evalResults.at(-1)?.id ?? null,
        gapType: 'exploitation_review_missing',
        severity: 'critical',
        title: `Finding ${finding.title} is missing exploitation review evidence`,
        detail: `The open ${finding.severity} finding ${finding.findingId} does not show log review or exploitation review completion.`,
        affectedObjectType: 'finding',
        affectedObjectId: finding.findingId,
        controlRefs: ['RA-5(8)'],
        ksiRefs: KSI_BY_EVAL.RA5_EXPLOITATION_REVIEW,
        recommendedArtifact: 'exploitation_review_queries.md',
        poamRequired: true,
      }),
    );
  }

  const publicExposureGaps = [
    ...args.bundle.declaredInventory.filter((item) => item.isPublic),
    ...args.bundle.discoveredAssets.filter((item) => item.isPublic).map((item) => ({
      assetId: item.assetId,
      name: item.name,
    })),
  ];
  const exposureStatus: AssuranceEvalStatus = publicExposureGaps.length > 0 ? 'FAIL' : 'PASS';
  evalResults.push(
    createEvalResult(
      'SC7_PUBLIC_EXPOSURE_POLICY',
      exposureStatus,
      exposureStatus === 'FAIL' ? 'critical' : 'low',
      exposureStatus === 'PASS'
        ? 'No public exposure exceptions were detected in the current evidence bundle.'
        : 'Publicly reachable assets or services remain present without closure evidence.',
      `Public exposure findings: ${publicExposureGaps.length}.`,
      {
        publicExposureFindings: publicExposureGaps.length,
      },
      [{ artifact: 'normalized_bundle', field: 'discoveredAssets', note: 'Public exposure posture' }],
    ),
  );
  for (const item of publicExposureGaps) {
    gaps.push(
      createGap({
        evalResultId: evalResults.at(-1)?.id ?? null,
        gapType: 'public_exposure_open',
        severity: 'critical',
        title: `Public exposure remains open for ${item.name}`,
        detail: `The asset ${item.assetId} is marked as publicly reachable and still requires exception, mitigation, or closure evidence.`,
        affectedObjectType: 'asset',
        affectedObjectId: item.assetId,
        controlRefs: ['SC-7'],
        ksiRefs: KSI_BY_EVAL.SC7_PUBLIC_EXPOSURE_POLICY,
        recommendedArtifact: 'public_exposure_workbench.json',
        poamRequired: true,
      }),
    );
  }

  const recentLogSources = args.bundle.centralLogSources.filter((item) => {
    if (!item.lastSeen) {
      return false;
    }
    return Date.now() - Date.parse(item.lastSeen) <= 30 * DAY_MS;
  });
  const conmonStatus: AssuranceEvalStatus =
    recentLogSources.length >= Math.max(1, args.bundle.centralLogSources.length) ? 'PASS' : 'PARTIAL';
  evalResults.push(
    createEvalResult(
      'CA7_CONMON_REASONABLENESS',
      conmonStatus,
      conmonStatus === 'PASS' ? 'moderate' : 'high',
      conmonStatus === 'PASS'
        ? 'The evidence bundle shows recent activity aligned to continuous monitoring expectations.'
        : 'Continuous monitoring evidence is present but not recent or complete enough for full reasonableness.',
      `Recent centralized log sources: ${recentLogSources.length}/${args.bundle.centralLogSources.length}.`,
      {
        recentLogSources: recentLogSources.length,
        totalLogSources: args.bundle.centralLogSources.length,
      },
      [{ artifact: 'normalized_bundle', field: 'centralLogSources', note: 'ConMon reasonableness' }],
    ),
  );
  if (conmonStatus !== 'PASS') {
    reasonablenessFindings.push({
      id: crypto.randomUUID(),
      title: 'Continuous monitoring cadence evidence needs refresh',
      status: conmonStatus,
      detail: 'At least one expected monitoring source lacks fresh or complete evidence within the current reasonableness window.',
    });
  }

  const passCount = evalResults.filter((item) => item.status === 'PASS').length;
  const partialCount = evalResults.filter((item) => item.status === 'PARTIAL').length;
  const failCount = evalResults.filter((item) => item.status === 'FAIL').length;
  const ksiStatus: AssuranceEvalStatus = failCount > 0 ? 'FAIL' : partialCount > 0 ? 'PARTIAL' : 'PASS';
  evalResults.push(
    createEvalResult(
      'F20X_KSI_ROLLUP',
      ksiStatus,
      ksiStatus === 'FAIL' ? 'high' : 'moderate',
      'FedRAMP 20x rollup derived from deterministic proof-chain evaluations.',
      `PASS=${passCount}, PARTIAL=${partialCount}, FAIL=${failCount} across deterministic assurance evaluations.`,
      {
        passCount,
        partialCount,
        failCount,
      },
      [{ artifact: 'eval_results', field: 'status', note: 'Derived KSI rollup' }],
    ),
  );

  for (const gap of gaps) {
    if (!gap.poamRequired) {
      continue;
    }
    poamItems.push(
      createPoam({
        sourceGapId: gap.id,
        identifier: `POAM-${gap.gapType}-${poamItems.length + 1}`,
        status: 'open',
        severity: gap.severity,
        weaknessName: gap.title,
        weaknessDescription: gap.detail,
        plannedRemediation: `Provide ${gap.recommendedArtifact ?? 'supporting evidence'} and close the ${gap.gapType} gap.`,
        milestoneDueDate: new Date(Date.now() + 30 * DAY_MS).toISOString(),
        sourceEvalCode: evalResults.find((item) => item.id === gap.evalResultId)?.evalCode ?? null,
        controlRefs: gap.controlRefs,
      }),
    );
  }

  for (const gap of gaps) {
    reviewRecommendations.push({
      id: crypto.randomUUID(),
      targetType: gap.affectedObjectType ?? 'gap',
      targetId: gap.affectedObjectId ?? gap.id,
      title: gap.title,
      summary: gap.detail,
      status: 'pending',
      recommendation: {
        gapType: gap.gapType,
        severity: gap.severity,
        recommendedArtifact: gap.recommendedArtifact,
        controlRefs: gap.controlRefs,
        ksiRefs: gap.ksiRefs,
      },
    });
  }

  correlations.push({
    id: crypto.randomUUID(),
    type: 'proof-chain-summary',
    assets: args.bundle.discoveredAssets.length,
    events: args.bundle.cloudEvents.length,
    findings: args.bundle.scannerFindings.length,
    tickets: args.bundle.tickets.length,
  });

  const summary: AssessmentSummary = {
    evidenceJobId: args.evidenceJobId,
    tenantId: args.bundle.tenantId,
    folderId: args.bundle.folderId,
    bundleKind: args.bundle.bundleKind,
    inputMode: args.bundle.inputMode,
    generatedAt: nowIso(),
    passingEvaluations: evalResults.filter((item) => item.status === 'PASS').length,
    partialEvaluations: evalResults.filter((item) => item.status === 'PARTIAL').length,
    failingEvaluations: evalResults.filter((item) => item.status === 'FAIL').length,
    openGaps: gaps.length,
    poamOpenItems: poamItems.length,
    criticalOpenFindings: args.bundle.scannerFindings.filter(
      (item) => item.severity === 'critical' && item.status !== 'closed',
    ).length,
    highOpenFindings: args.bundle.scannerFindings.filter(
      (item) => item.severity === 'high' && item.status !== 'closed',
    ).length,
  };

  return {
    summary,
    evalResults,
    gaps,
    poamItems,
    graph,
    correlations,
    reasonablenessFindings,
    liveCollectionCoverage: {
      coverage: coverageSummary(args.bundle),
      collectedAt: args.bundle.collectedAt,
      provider: args.bundle.provider,
    },
    reviewRecommendations,
  };
}

async function clearEvaluationArtifacts(env: EnvBindings, evidenceJobId: string): Promise<void> {
  await env.D1_MAIN.batch([
    env.D1_MAIN.prepare(`DELETE FROM assurance_eval_results WHERE evidence_job_id = ?`).bind(evidenceJobId),
    env.D1_MAIN.prepare(`DELETE FROM assurance_evidence_gaps WHERE evidence_job_id = ?`).bind(evidenceJobId),
    env.D1_MAIN.prepare(`DELETE FROM assurance_poam_items WHERE evidence_job_id = ?`).bind(evidenceJobId),
    env.D1_MAIN.prepare(`DELETE FROM assurance_graph_nodes WHERE evidence_job_id = ?`).bind(evidenceJobId),
    env.D1_MAIN.prepare(`DELETE FROM assurance_graph_edges WHERE evidence_job_id = ?`).bind(evidenceJobId),
    env.D1_MAIN.prepare(`DELETE FROM assurance_review_recommendations WHERE evidence_job_id = ?`).bind(evidenceJobId),
    env.D1_MAIN.prepare(
      `
      DELETE FROM evidence_artifacts
      WHERE job_id = ?
        AND artifact_family IN (
          'assessment_summary',
          'eval_results',
          'evidence_gaps',
          'poam_items',
          'evidence_graph',
          'correlations',
          'correlation_report',
          'auditor_questions',
          'instrumentation_plan',
          'evidence_gap_matrix',
          'reasonableness_findings',
          'validation_report',
          'threat_hunt_findings',
          'threat_hunt_timeline',
          'threat_hunt_queries'
        )
      `,
    ).bind(evidenceJobId),
  ]);
}

export async function persistEvaluationArtifacts(args: {
  env: EnvBindings;
  tenantId: string;
  folderId: string | null;
  sourceId: string;
  evidenceJobId: string;
  artifacts: EvaluationArtifacts;
}): Promise<Record<BundleArtifactFamily, string>> {
  await clearEvaluationArtifacts(args.env, args.evidenceJobId);
  const statements = [];
  const timestamp = nowIso();

  for (const item of args.artifacts.evalResults) {
    statements.push(
      args.env.D1_MAIN.prepare(
        `
        INSERT INTO assurance_eval_results (
          id, tenant_id, folder_id, evidence_job_id, eval_code, title, status, severity, summary,
          rationale, metrics_json, evidence_refs_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).bind(
        item.id,
        args.tenantId,
        args.folderId,
        args.evidenceJobId,
        item.evalCode,
        item.title,
        item.status,
        item.severity,
        item.summary,
        item.rationale,
        JSON.stringify(item.metrics),
        JSON.stringify(item.evidenceRefs),
        timestamp,
        timestamp,
      ),
    );
  }

  for (const item of args.artifacts.gaps) {
    statements.push(
      args.env.D1_MAIN.prepare(
        `
        INSERT INTO assurance_evidence_gaps (
          id, tenant_id, folder_id, evidence_job_id, eval_result_id, gap_type, severity, title, detail,
          affected_object_type, affected_object_id, control_refs_json, ksi_refs_json, recommended_artifact,
          poam_required, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).bind(
        item.id,
        args.tenantId,
        args.folderId,
        args.evidenceJobId,
        item.evalResultId,
        item.gapType,
        item.severity,
        item.title,
        item.detail,
        item.affectedObjectType,
        item.affectedObjectId,
        JSON.stringify(item.controlRefs),
        JSON.stringify(item.ksiRefs),
        item.recommendedArtifact,
        item.poamRequired ? 1 : 0,
        timestamp,
        timestamp,
      ),
    );
  }

  for (const item of args.artifacts.poamItems) {
    statements.push(
      args.env.D1_MAIN.prepare(
        `
        INSERT INTO assurance_poam_items (
          id, tenant_id, folder_id, evidence_job_id, source_gap_id, identifier, status, severity,
          weakness_name, weakness_description, planned_remediation, milestone_due_date, source_eval_code,
          control_refs_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).bind(
        item.id,
        args.tenantId,
        args.folderId,
        args.evidenceJobId,
        item.sourceGapId,
        item.identifier,
        item.status,
        item.severity,
        item.weaknessName,
        item.weaknessDescription,
        item.plannedRemediation,
        item.milestoneDueDate,
        item.sourceEvalCode,
        JSON.stringify(item.controlRefs),
        timestamp,
        timestamp,
      ),
    );
  }

  for (const node of args.artifacts.graph.nodes) {
    statements.push(
      args.env.D1_MAIN.prepare(
        `
        INSERT INTO assurance_graph_nodes (
          id, tenant_id, folder_id, evidence_job_id, node_key, node_type, label, attributes_json,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).bind(
        crypto.randomUUID(),
        args.tenantId,
        args.folderId,
        args.evidenceJobId,
        node.key,
        node.type,
        node.label,
        JSON.stringify(node.attributes),
        timestamp,
        timestamp,
      ),
    );
  }

  for (const edge of args.artifacts.graph.edges) {
    statements.push(
      args.env.D1_MAIN.prepare(
        `
        INSERT INTO assurance_graph_edges (
          id, tenant_id, folder_id, evidence_job_id, edge_type, from_node_key, to_node_key,
          attributes_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).bind(
        crypto.randomUUID(),
        args.tenantId,
        args.folderId,
        args.evidenceJobId,
        edge.type,
        edge.from,
        edge.to,
        JSON.stringify(edge.attributes),
        timestamp,
        timestamp,
      ),
    );
  }

  for (const recommendation of args.artifacts.reviewRecommendations) {
    statements.push(
      args.env.D1_MAIN.prepare(
        `
        INSERT INTO assurance_review_recommendations (
          id, tenant_id, folder_id, evidence_job_id, target_type, target_id, title, summary, status,
          recommendation_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).bind(
        recommendation.id,
        args.tenantId,
        args.folderId,
        args.evidenceJobId,
        recommendation.targetType,
        recommendation.targetId,
        recommendation.title,
        recommendation.summary,
        recommendation.status,
        JSON.stringify(recommendation.recommendation),
        timestamp,
        timestamp,
      ),
    );
  }

  if (statements.length > 0) {
    await args.env.D1_MAIN.batch(statements);
  }

  const bundle = await loadNormalizedBundle(args.env, args.evidenceJobId);
  if (!bundle) {
    throw new Error('A normalized evidence bundle is required before evaluation artifacts can be persisted.');
  }

  const summaryKey = artifactKeyForEvidenceJob(args.tenantId, args.sourceId, args.evidenceJobId, 'assessment_summary');
  const evalResultsKey = artifactKeyForEvidenceJob(args.tenantId, args.sourceId, args.evidenceJobId, 'eval_results');
  const gapsKey = artifactKeyForEvidenceJob(args.tenantId, args.sourceId, args.evidenceJobId, 'evidence_gaps');
  const poamKey = artifactKeyForEvidenceJob(args.tenantId, args.sourceId, args.evidenceJobId, 'poam_items');
  const graphKey = artifactKeyForEvidenceJob(args.tenantId, args.sourceId, args.evidenceJobId, 'evidence_graph');
  const correlationKey = artifactKeyForEvidenceJob(args.tenantId, args.sourceId, args.evidenceJobId, 'correlations');
  const correlationReportKey = artifactKeyForEvidenceJob(
    args.tenantId,
    args.sourceId,
    args.evidenceJobId,
    'correlation_report',
    'md',
  );
  const auditorQuestionsKey = artifactKeyForEvidenceJob(
    args.tenantId,
    args.sourceId,
    args.evidenceJobId,
    'auditor_questions',
    'md',
  );
  const instrumentationPlanKey = artifactKeyForEvidenceJob(
    args.tenantId,
    args.sourceId,
    args.evidenceJobId,
    'instrumentation_plan',
    'md',
  );
  const evidenceGapMatrixKey = artifactKeyForEvidenceJob(
    args.tenantId,
    args.sourceId,
    args.evidenceJobId,
    'evidence_gap_matrix',
    'csv',
  );
  const reasonablenessKey = artifactKeyForEvidenceJob(
    args.tenantId,
    args.sourceId,
    args.evidenceJobId,
    'reasonableness_findings',
  );
  const validationReportKey = artifactKeyForEvidenceJob(
    args.tenantId,
    args.sourceId,
    args.evidenceJobId,
    'validation_report',
  );
  const threatHuntFindingsKey = artifactKeyForEvidenceJob(
    args.tenantId,
    args.sourceId,
    args.evidenceJobId,
    'threat_hunt_findings',
  );
  const threatHuntTimelineKey = artifactKeyForEvidenceJob(
    args.tenantId,
    args.sourceId,
    args.evidenceJobId,
    'threat_hunt_timeline',
    'md',
  );
  const threatHuntQueriesKey = artifactKeyForEvidenceJob(
    args.tenantId,
    args.sourceId,
    args.evidenceJobId,
    'threat_hunt_queries',
    'md',
  );

  const correlationReport = buildCorrelationReportMarkdown({
    summary: args.artifacts.summary,
    bundle,
    evalResults: args.artifacts.evalResults,
    gaps: args.artifacts.gaps,
  });
  const auditorQuestions = buildAuditorQuestionsMarkdown({
    summary: args.artifacts.summary,
    evalResults: args.artifacts.evalResults,
    gaps: args.artifacts.gaps,
    poamItems: args.artifacts.poamItems,
  });
  const instrumentationPlan = buildInstrumentationPlanMarkdown({
    bundle,
    evalResults: args.artifacts.evalResults,
    gaps: args.artifacts.gaps,
  });
  const evidenceGapMatrixRows = buildEvidenceGapMatrixRows(args.artifacts);
  const evidenceGapMatrixCsv = renderEvidenceGapMatrixCsv(evidenceGapMatrixRows);
  const threatHunt = buildThreatHuntArtifacts({
    bundle,
    artifacts: args.artifacts,
  });
  const threatHuntTimeline = buildThreatHuntTimelineMarkdown(threatHunt);
  const threatHuntQueries = buildThreatHuntQueryMarkdown({
    bundle,
    artifacts: threatHunt,
  });
  const validationReport = validateEvidenceArtifacts({
    bundle,
    artifacts: args.artifacts,
    availableArtifactFamilies: [
      'normalized_bundle',
      'assessment_summary',
      'eval_results',
      'evidence_gaps',
      'poam_items',
      'evidence_graph',
      'correlations',
      'correlation_report',
      'auditor_questions',
      'instrumentation_plan',
      'evidence_gap_matrix',
      'reasonableness_findings',
      'validation_report',
      'threat_hunt_findings',
      'threat_hunt_timeline',
      'threat_hunt_queries',
    ],
    threatHuntFindingCount: threatHunt.findingCount,
  });

  await Promise.all([
    writeJsonArtifact(args.env, summaryKey, args.artifacts.summary),
    writeJsonArtifact(args.env, evalResultsKey, args.artifacts.evalResults),
    writeJsonArtifact(args.env, gapsKey, args.artifacts.gaps),
    writeJsonArtifact(args.env, poamKey, args.artifacts.poamItems),
    writeJsonArtifact(args.env, graphKey, args.artifacts.graph),
    writeJsonArtifact(args.env, correlationKey, args.artifacts.correlations),
    writeJsonArtifact(args.env, reasonablenessKey, args.artifacts.reasonablenessFindings),
    writeJsonArtifact(args.env, validationReportKey, validationReport),
    writeJsonArtifact(args.env, threatHuntFindingsKey, threatHunt),
    writeMarkdownArtifact(args.env, correlationReportKey, correlationReport),
    writeMarkdownArtifact(args.env, auditorQuestionsKey, auditorQuestions),
    writeMarkdownArtifact(args.env, instrumentationPlanKey, instrumentationPlan),
    writeMarkdownArtifact(args.env, threatHuntTimelineKey, threatHuntTimeline),
    writeMarkdownArtifact(args.env, threatHuntQueriesKey, threatHuntQueries),
    writeTextArtifact(args.env, evidenceGapMatrixKey, evidenceGapMatrixCsv, 'text/csv; charset=utf-8'),
  ]);

  const createdAt = nowIso();
  const manifestGroup = args.evidenceJobId;
  const artifactEntries: Array<{
    family: BundleArtifactFamily;
    key: string;
    payload: unknown;
    contentType?: string;
  }> = [
    { family: 'assessment_summary', key: summaryKey, payload: args.artifacts.summary },
    { family: 'eval_results', key: evalResultsKey, payload: args.artifacts.evalResults },
    { family: 'evidence_gaps', key: gapsKey, payload: args.artifacts.gaps },
    { family: 'poam_items', key: poamKey, payload: args.artifacts.poamItems },
    { family: 'evidence_graph', key: graphKey, payload: args.artifacts.graph },
    { family: 'correlations', key: correlationKey, payload: args.artifacts.correlations },
    { family: 'correlation_report', key: correlationReportKey, payload: correlationReport, contentType: 'text/markdown; charset=utf-8' },
    { family: 'auditor_questions', key: auditorQuestionsKey, payload: auditorQuestions, contentType: 'text/markdown; charset=utf-8' },
    { family: 'instrumentation_plan', key: instrumentationPlanKey, payload: instrumentationPlan, contentType: 'text/markdown; charset=utf-8' },
    { family: 'evidence_gap_matrix', key: evidenceGapMatrixKey, payload: evidenceGapMatrixCsv, contentType: 'text/csv; charset=utf-8' },
    { family: 'reasonableness_findings', key: reasonablenessKey, payload: args.artifacts.reasonablenessFindings },
    { family: 'validation_report', key: validationReportKey, payload: validationReport },
    { family: 'threat_hunt_findings', key: threatHuntFindingsKey, payload: threatHunt },
    { family: 'threat_hunt_timeline', key: threatHuntTimelineKey, payload: threatHuntTimeline, contentType: 'text/markdown; charset=utf-8' },
    { family: 'threat_hunt_queries', key: threatHuntQueriesKey, payload: threatHuntQueries, contentType: 'text/markdown; charset=utf-8' },
  ];

  await Promise.all(
    artifactEntries.map(async ({ family, key, payload, contentType }, index) =>
      insertEvidenceArtifactRecord({
        env: args.env,
        tenantId: args.tenantId,
        jobId: args.evidenceJobId,
        artifactId: `artifact:${args.evidenceJobId}:eval:${index}:${family}`,
        objectKey: key,
        artifactFamily: family,
        manifestGroup,
        bodySize: typeof payload === 'string' ? payload.length : JSON.stringify(payload).length,
        createdAt,
        contentType,
      }),
    ),
  );

  return {
    raw_input: '',
    normalized_bundle: '',
    bundle_manifest: '',
    live_collection_coverage: '',
    assessment_summary: summaryKey,
    eval_results: evalResultsKey,
    evidence_gaps: gapsKey,
    poam_items: poamKey,
    evidence_graph: graphKey,
    correlations: correlationKey,
    correlation_report: correlationReportKey,
    auditor_questions: auditorQuestionsKey,
    instrumentation_plan: instrumentationPlanKey,
    evidence_gap_matrix: evidenceGapMatrixKey,
    reasonableness_findings: reasonablenessKey,
    validation_report: validationReportKey,
    threat_hunt_findings: threatHuntFindingsKey,
    threat_hunt_timeline: threatHuntTimelineKey,
    threat_hunt_queries: threatHuntQueriesKey,
    tracker_diagnostics: '',
    tracker_gap_report: '',
    tracker_gap_matrix: '',
    tracker_instrumentation_plan: '',
    package_json: '',
    review_ledger: '',
    report_manifest: '',
    reconciliation: '',
  };
}

export async function loadNormalizedBundle(
  env: EnvBindings,
  evidenceJobId: string,
): Promise<NormalizedEvidenceBundle | null> {
  const job = await env.D1_MAIN.prepare(
    `
    SELECT id, tenant_id, folder_id, source_id, run_family, input_mode, bundle_kind, manifest_key,
           normalization_status, coverage_json, error_summary_json, source_schema_version, adapter_hints_json, status
    FROM evidence_jobs
    WHERE id = ?
    LIMIT 1
    `,
  )
    .bind(evidenceJobId)
    .first<EvidenceJobMetadataRow>();

  if (!job) {
    return null;
  }

  const manifest = job.manifest_key ? await readJsonArtifact<{ families: Array<{ family: string; path: string }> }>(env, job.manifest_key) : null;
  const bundlePath = manifest?.families.find((item) => item.family === 'normalized_bundle')?.path;
  if (bundlePath) {
    const bundle = await readJsonArtifact<NormalizedEvidenceBundle>(env, bundlePath);
    if (bundle) {
      return bundle;
    }
  }

  const [assetRows, eventRows, findingRows, targetRows, logRows, alertRows, ticketRows] = await Promise.all([
    env.D1_MAIN.prepare(
      `SELECT asset_key, asset_origin, asset_type, name, environment, owner_name, account_id, region, in_boundary, is_public, attributes_json
       FROM assurance_bundle_assets WHERE evidence_job_id = ? ORDER BY asset_origin ASC, name ASC`,
    )
      .bind(evidenceJobId)
      .all<{
        asset_key: string;
        asset_origin: string;
        asset_type: string | null;
        name: string;
        environment: string | null;
        owner_name: string | null;
        account_id: string | null;
        region: string | null;
        in_boundary: number;
        is_public: number;
        attributes_json: string;
      }>(),
    env.D1_MAIN.prepare(
      `SELECT event_id, asset_key, semantic_type, severity, status, central_event_ref, attributes_json
       FROM assurance_bundle_events WHERE evidence_job_id = ? ORDER BY event_id ASC`,
    )
      .bind(evidenceJobId)
      .all<{
        event_id: string;
        asset_key: string | null;
        semantic_type: string;
        severity: string;
        status: string;
        central_event_ref: string | null;
        attributes_json: string;
      }>(),
    env.D1_MAIN.prepare(
      `SELECT finding_id, asset_key, severity, status, title, cve_ids_json, linked_ticket_ids_json, exploitation_review_json, attributes_json
       FROM assurance_bundle_findings WHERE evidence_job_id = ? ORDER BY finding_id ASC`,
    )
      .bind(evidenceJobId)
      .all<{
        finding_id: string;
        asset_key: string | null;
        severity: string;
        status: string;
        title: string;
        cve_ids_json: string;
        linked_ticket_ids_json: string;
        exploitation_review_json: string;
        attributes_json: string;
      }>(),
    env.D1_MAIN.prepare(
      `SELECT target_id, asset_key, scanner_name, hostname, ip_address, credentialed, last_scan_time, attributes_json
       FROM assurance_bundle_scanner_targets WHERE evidence_job_id = ? ORDER BY target_id ASC`,
    )
      .bind(evidenceJobId)
      .all<{
        target_id: string;
        asset_key: string | null;
        scanner_name: string;
        hostname: string | null;
        ip_address: string | null;
        credentialed: number;
        last_scan_time: string | null;
        attributes_json: string;
      }>(),
    env.D1_MAIN.prepare(
      `SELECT source_id, asset_key, source_type, local_source, central_destination, status, sample_local_event_ref, sample_central_event_ref, last_seen, attributes_json
       FROM assurance_bundle_log_sources WHERE evidence_job_id = ? ORDER BY source_id ASC`,
    )
      .bind(evidenceJobId)
      .all<{
        source_id: string;
        asset_key: string | null;
        source_type: string | null;
        local_source: string | null;
        central_destination: string | null;
        status: string;
        sample_local_event_ref: string | null;
        sample_central_event_ref: string | null;
        last_seen: string | null;
        attributes_json: string;
      }>(),
    env.D1_MAIN.prepare(
      `SELECT rule_id, name, enabled, semantic_types_json, recipients_json, last_fired, attributes_json
       FROM assurance_bundle_alert_rules WHERE evidence_job_id = ? ORDER BY rule_id ASC`,
    )
      .bind(evidenceJobId)
      .all<{
        rule_id: string;
        name: string;
        enabled: number;
        semantic_types_json: string;
        recipients_json: string;
        last_fired: string | null;
        attributes_json: string;
      }>(),
    env.D1_MAIN.prepare(
      `SELECT ticket_id, title, status, linked_asset_keys_json, linked_event_ids_json, linked_finding_ids_json,
              has_security_impact_analysis, has_testing_evidence, has_approval, has_deployment_evidence,
              has_verification_evidence, attributes_json
       FROM assurance_bundle_tickets WHERE evidence_job_id = ? ORDER BY ticket_id ASC`,
    )
      .bind(evidenceJobId)
      .all<{
        ticket_id: string;
        title: string;
        status: string;
        linked_asset_keys_json: string;
        linked_event_ids_json: string;
        linked_finding_ids_json: string;
        has_security_impact_analysis: number;
        has_testing_evidence: number;
        has_approval: number;
        has_deployment_evidence: number;
        has_verification_evidence: number;
        attributes_json: string;
      }>(),
  ]);

  const declaredInventory: DeclaredInventoryRecord[] = [];
  const discoveredAssets: AssetRecord[] = [];
  for (const row of assetRows.results) {
    const attributes = asJson<Record<string, unknown>>(row.attributes_json, {});
    if (row.asset_origin === 'declared') {
      declaredInventory.push({
        assetId: row.asset_key,
        name: row.name,
        assetType: row.asset_type ?? 'service',
        environment: row.environment ?? 'production',
        owner: row.owner_name,
        accountId: row.account_id,
        region: row.region,
        inBoundary: row.in_boundary === 1,
        scannerRequired: normalizeBoolean(attributes.scannerRequired, true),
        logRequired: normalizeBoolean(attributes.logRequired, true),
        isPublic: row.is_public === 1,
        expectedPrivateIp: normalizeNullableString(attributes.expectedPrivateIp),
        expectedPublicIp: normalizeNullableString(attributes.expectedPublicIp),
        metadata: attributes,
      });
    } else {
      discoveredAssets.push({
        assetId: row.asset_key,
        name: row.name,
        assetType: row.asset_type ?? 'service',
        environment: row.environment ?? 'production',
        owner: row.owner_name,
        accountId: row.account_id,
        region: row.region,
        inBoundary: row.in_boundary === 1,
        isPublic: row.is_public === 1,
        privateIps: asJson<string[]>(JSON.stringify(attributes.privateIps ?? []), []),
        publicIps: asJson<string[]>(JSON.stringify(attributes.publicIps ?? []), []),
        metadata: attributes,
      });
    }
  }

  const bundle: NormalizedEvidenceBundle = {
    tenantId: job.tenant_id,
    folderId: job.folder_id,
    inputMode: (job.input_mode as EvidenceInputMode) || 'live',
    bundleKind: (job.bundle_kind as BundleKind) || 'assessment',
    sourceName: 'Loaded evidence job',
    provider: 'loaded',
    collectedAt: nowIso(),
    schemaVersion: job.source_schema_version,
    declaredInventory,
    discoveredAssets,
    cloudEvents: eventRows.results.map((row) => {
      const attributes = asJson<Record<string, unknown>>(row.attributes_json, {});
      return {
        eventId: row.event_id,
        assetId: row.asset_key,
        semanticType: row.semantic_type,
        severity: normalizeSeverity(row.severity),
        status: row.status,
        centralEventRef: row.central_event_ref,
        localEventRef: normalizeNullableString(attributes.localEventRef),
        title: normalizeString(attributes.title, row.event_id),
        metadata: attributes,
      };
    }),
    scannerTargets: targetRows.results.map((row) => ({
      targetId: row.target_id,
      assetId: row.asset_key,
      scannerName: row.scanner_name,
      hostname: row.hostname,
      ipAddress: row.ip_address,
      credentialed: row.credentialed === 1,
      lastScanTime: row.last_scan_time,
      metadata: asJson<Record<string, unknown>>(row.attributes_json, {}),
    })),
    scannerFindings: findingRows.results.map((row) => ({
      findingId: row.finding_id,
      assetId: row.asset_key,
      severity: normalizeSeverity(row.severity),
      status: row.status,
      title: row.title,
      cveIds: asJson<string[]>(row.cve_ids_json, []),
      linkedTicketIds: asJson<string[]>(row.linked_ticket_ids_json, []),
      exploitationReview: asJson<Record<string, unknown>>(row.exploitation_review_json, {}),
      metadata: asJson<Record<string, unknown>>(row.attributes_json, {}),
    })),
    centralLogSources: logRows.results.map((row) => ({
      sourceId: row.source_id,
      assetId: row.asset_key,
      sourceType: row.source_type,
      localSource: row.local_source,
      centralDestination: row.central_destination,
      status: row.status,
      sampleLocalEventRef: row.sample_local_event_ref,
      sampleCentralEventRef: row.sample_central_event_ref,
      lastSeen: row.last_seen,
      metadata: asJson<Record<string, unknown>>(row.attributes_json, {}),
    })),
    alertRules: alertRows.results.map((row) => ({
      ruleId: row.rule_id,
      name: row.name,
      enabled: row.enabled === 1,
      semanticTypes: asJson<string[]>(row.semantic_types_json, []),
      recipients: asJson<string[]>(row.recipients_json, []),
      lastFired: row.last_fired,
      metadata: asJson<Record<string, unknown>>(row.attributes_json, {}),
    })),
    tickets: ticketRows.results.map((row) => ({
      ticketId: row.ticket_id,
      title: row.title,
      status: row.status,
      linkedAssetIds: asJson<string[]>(row.linked_asset_keys_json, []),
      linkedEventIds: asJson<string[]>(row.linked_event_ids_json, []),
      linkedFindingIds: asJson<string[]>(row.linked_finding_ids_json, []),
      hasSecurityImpactAnalysis: row.has_security_impact_analysis === 1,
      hasTestingEvidence: row.has_testing_evidence === 1,
      hasApproval: row.has_approval === 1,
      hasDeploymentEvidence: row.has_deployment_evidence === 1,
      hasVerificationEvidence: row.has_verification_evidence === 1,
      metadata: asJson<Record<string, unknown>>(row.attributes_json, {}),
    })),
    seededPoam: [],
    metadata: {
      loadedFromTables: true,
    },
  };

  return bundle;
}

export async function loadEvaluationArtifacts(env: EnvBindings, evidenceJobId: string): Promise<EvaluationArtifacts | null> {
  const summary = await env.D1_MAIN.prepare(
    `
    SELECT COUNT(*) AS eval_count,
           SUM(CASE WHEN status = 'PASS' THEN 1 ELSE 0 END) AS pass_count,
           SUM(CASE WHEN status = 'PARTIAL' THEN 1 ELSE 0 END) AS partial_count,
           SUM(CASE WHEN status = 'FAIL' THEN 1 ELSE 0 END) AS fail_count
    FROM assurance_eval_results
    WHERE evidence_job_id = ?
    `,
  )
    .bind(evidenceJobId)
    .first<{ eval_count: number | null; pass_count: number | null; partial_count: number | null; fail_count: number | null }>();

  if (!summary || Number(summary.eval_count ?? 0) === 0) {
    return null;
  }

  const bundle = await loadNormalizedBundle(env, evidenceJobId);
  if (!bundle) {
    return null;
  }

  const manifest = await env.D1_MAIN.prepare(
    `
    SELECT id, eval_code, title, status, severity, summary, rationale, metrics_json, evidence_refs_json
    FROM assurance_eval_results
    WHERE evidence_job_id = ?
    ORDER BY title ASC
    `,
  )
    .bind(evidenceJobId)
    .all<{
      id: string;
      eval_code: string;
      title: string;
      status: string;
      severity: string;
      summary: string;
      rationale: string;
      metrics_json: string;
      evidence_refs_json: string;
    }>();
  const gaps = await env.D1_MAIN.prepare(
    `
    SELECT id, eval_result_id, gap_type, severity, title, detail, affected_object_type, affected_object_id,
           control_refs_json, ksi_refs_json, recommended_artifact, poam_required
    FROM assurance_evidence_gaps
    WHERE evidence_job_id = ?
    ORDER BY severity DESC, title ASC
    `,
  )
    .bind(evidenceJobId)
    .all<{
      id: string;
      eval_result_id: string | null;
      gap_type: string;
      severity: string;
      title: string;
      detail: string;
      affected_object_type: string | null;
      affected_object_id: string | null;
      control_refs_json: string;
      ksi_refs_json: string;
      recommended_artifact: string | null;
      poam_required: number;
    }>();
  const poam = await env.D1_MAIN.prepare(
    `
    SELECT id, source_gap_id, identifier, status, severity, weakness_name, weakness_description,
           planned_remediation, milestone_due_date, source_eval_code, control_refs_json
    FROM assurance_poam_items
    WHERE evidence_job_id = ?
    ORDER BY identifier ASC
    `,
  )
    .bind(evidenceJobId)
    .all<{
      id: string;
      source_gap_id: string | null;
      identifier: string;
      status: string;
      severity: string;
      weakness_name: string;
      weakness_description: string;
      planned_remediation: string;
      milestone_due_date: string | null;
      source_eval_code: string | null;
      control_refs_json: string;
    }>();

  const graphKey = await env.D1_MAIN.prepare(
    `SELECT object_key FROM evidence_artifacts WHERE job_id = ? AND artifact_family = 'evidence_graph' LIMIT 1`,
  )
    .bind(evidenceJobId)
    .first<{ object_key: string | null }>();
  const graph = graphKey?.object_key
    ? ((await readJsonArtifact<EvidenceGraph>(env, graphKey.object_key)) ?? { nodes: [], edges: [] })
    : { nodes: [], edges: [] };
  const correlationsKey = await env.D1_MAIN.prepare(
    `SELECT object_key FROM evidence_artifacts WHERE job_id = ? AND artifact_family = 'correlations' LIMIT 1`,
  )
    .bind(evidenceJobId)
    .first<{ object_key: string | null }>();
  const reasonablenessKey = await env.D1_MAIN.prepare(
    `SELECT object_key FROM evidence_artifacts WHERE job_id = ? AND artifact_family = 'reasonableness_findings' LIMIT 1`,
  )
    .bind(evidenceJobId)
    .first<{ object_key: string | null }>();
  const recommendations = await env.D1_MAIN.prepare(
    `
    SELECT id, target_type, target_id, title, summary, status, recommendation_json
    FROM assurance_review_recommendations
    WHERE evidence_job_id = ?
    ORDER BY created_at ASC
    `,
  )
    .bind(evidenceJobId)
    .all<ReviewRecommendationRow>();

  const evalResults: EvalResult[] = manifest.results.map((row) => ({
    id: row.id,
    evalCode: row.eval_code,
    title: row.title,
    status: row.status as AssuranceEvalStatus,
    severity: normalizeSeverity(row.severity),
    summary: row.summary,
    rationale: row.rationale,
    metrics: asJson<Record<string, unknown>>(row.metrics_json, {}),
    evidenceRefs: asJson<Array<{ artifact: string; field: string; note?: string }>>(row.evidence_refs_json, []),
  }));

  const gapItems: EvidenceGap[] = gaps.results.map((row) => ({
    id: row.id,
    evalResultId: row.eval_result_id,
    gapType: row.gap_type,
    severity: normalizeSeverity(row.severity),
    title: row.title,
    detail: row.detail,
    affectedObjectType: row.affected_object_type,
    affectedObjectId: row.affected_object_id,
    controlRefs: asJson<string[]>(row.control_refs_json, []),
    ksiRefs: asJson<string[]>(row.ksi_refs_json, []),
    recommendedArtifact: row.recommended_artifact,
    poamRequired: row.poam_required === 1,
  }));

  const poamItems: PoamItem[] = poam.results.map((row) => ({
    id: row.id,
    sourceGapId: row.source_gap_id,
    identifier: row.identifier,
    status: row.status,
    severity: normalizeSeverity(row.severity),
    weaknessName: row.weakness_name,
    weaknessDescription: row.weakness_description,
    plannedRemediation: row.planned_remediation,
    milestoneDueDate: row.milestone_due_date,
    sourceEvalCode: row.source_eval_code,
    controlRefs: asJson<string[]>(row.control_refs_json, []),
  }));

  return {
    summary: {
      evidenceJobId,
      tenantId: bundle.tenantId,
      folderId: bundle.folderId,
      bundleKind: bundle.bundleKind,
      inputMode: bundle.inputMode,
      generatedAt: nowIso(),
      passingEvaluations: Number(summary.pass_count ?? 0),
      partialEvaluations: Number(summary.partial_count ?? 0),
      failingEvaluations: Number(summary.fail_count ?? 0),
      openGaps: gapItems.length,
      poamOpenItems: poamItems.filter((item) => item.status === 'open').length,
      criticalOpenFindings: bundle.scannerFindings.filter(
        (item) => item.severity === 'critical' && item.status !== 'closed',
      ).length,
      highOpenFindings: bundle.scannerFindings.filter(
        (item) => item.severity === 'high' && item.status !== 'closed',
      ).length,
    },
    evalResults,
    gaps: gapItems,
    poamItems,
    graph,
    correlations: correlationsKey?.object_key ? (await readJsonArtifact<Array<Record<string, unknown>>>(env, correlationsKey.object_key)) ?? [] : [],
    reasonablenessFindings: reasonablenessKey?.object_key
      ? ((await readJsonArtifact<ReasonablenessFinding[]>(env, reasonablenessKey.object_key)) ?? [])
      : [],
    liveCollectionCoverage: {
      coverage: coverageSummary(bundle),
      collectedAt: bundle.collectedAt,
      provider: bundle.provider,
    },
    reviewRecommendations: recommendations.results.map((row) => ({
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      title: row.title,
      summary: row.summary,
      status: row.status,
      recommendation: asJson<Record<string, unknown>>(row.recommendation_json, {}),
    })),
  };
}

type ReviewDecisionLedgerEntry = ReviewDecision & {
  recommendationTitle: string;
  targetId: string | null;
  targetType: string | null;
};

function summarizeReviewDecisions(decisions: ReviewDecisionLedgerEntry[]) {
  return {
    total: decisions.length,
    accepted: decisions.filter((item) => item.decision.toLowerCase() === 'accepted').length,
    rejected: decisions.filter((item) => item.decision.toLowerCase() === 'rejected').length,
    other: decisions.filter((item) => {
      const value = item.decision.toLowerCase();
      return value !== 'accepted' && value !== 'rejected';
    }).length,
  };
}

function buildReviewDecisionSection(decisions: ReviewDecisionLedgerEntry[]): string[] {
  const summary = summarizeReviewDecisions(decisions);
  return [
    '## Review Decisions',
    `- Total recorded decisions: ${summary.total}`,
    `- Accepted: ${summary.accepted}`,
    `- Rejected: ${summary.rejected}`,
    `- Other: ${summary.other}`,
    '',
    ...(decisions.length > 0
      ? [
          '### Recent decisions',
          ...decisions
            .slice(0, 5)
            .map(
              (item) =>
                `- ${item.decision.toUpperCase()}: ${item.recommendationTitle} (${item.targetType ?? 'artifact'} ${item.targetId ?? '—'})`,
            ),
        ]
      : ['- No human review decisions have been recorded yet.']),
  ];
}

function summarizeAgentSecurityReportState(args: {
  evalResults: EvalResult[];
  gaps: EvidenceGap[];
  poamItems: PoamItem[];
  runId?: string | null;
}) {
  const agentEvalResults = args.evalResults.filter((item) => item.evalCode.startsWith('AGENT_'));
  const agentGaps = args.gaps.filter(
    (item) => (item.evalResultId ?? '').startsWith('AGENT_') || item.gapType.startsWith('agent_'),
  );
  const agentPoamItems = args.poamItems.filter((item) => (item.sourceEvalCode ?? '').startsWith('AGENT_'));
  const nonPassAgentEvals = agentEvalResults.filter((item) => item.status !== 'PASS');

  return {
    hasAgentSecurity:
      agentEvalResults.length > 0 ||
      agentGaps.length > 0 ||
      agentPoamItems.length > 0 ||
      Boolean(args.runId),
    runId: args.runId?.trim() || null,
    passCount: agentEvalResults.filter((item) => item.status === 'PASS').length,
    partialCount: agentEvalResults.filter((item) => item.status === 'PARTIAL').length,
    failCount: agentEvalResults.filter((item) => item.status === 'FAIL').length,
    gapCount: agentGaps.length,
    poamCount: agentPoamItems.length,
    topNonPassEvalCodes: nonPassAgentEvals.slice(0, 3).map((item) => item.evalCode),
    topGapTitles: agentGaps.slice(0, 3).map((item) => item.title),
  };
}

function buildPackageCoverageRecord(args: {
  summary: TwentyXPackageSummary;
  validation: import('./validation').AssuranceValidationReport;
  reconciliation: ReconciliationSummary;
  reviewSummary: ReturnType<typeof summarizeReviewDecisions>;
  bundleKind: string;
  inputMode: string;
  agentSecuritySummary: {
    runId: string | null;
    passCount: number;
    partialCount: number;
    failCount: number;
    gapCount: number;
    poamCount: number;
    hasAgentSecurity: boolean;
  };
}) {
  const agentEvaluationCount =
    args.agentSecuritySummary.passCount +
    args.agentSecuritySummary.partialCount +
    args.agentSecuritySummary.failCount;

  return {
    evaluationCount: args.summary.evaluationCount,
    gapCount: args.summary.gapCount,
    poamCount: args.summary.poamCount,
    reportCount: args.summary.reportManifest.length,
    reviewDecisionCount: args.reviewSummary.total,
    acceptedReviewCount: args.reviewSummary.accepted,
    rejectedReviewCount: args.reviewSummary.rejected,
    validationStatus: args.validation.status,
    validationCheckCount: args.validation.checks.length,
    reconciliationStatus: args.reconciliation.status,
    bundleKind: args.bundleKind,
    inputMode: args.inputMode,
    hasAgentSecurity: args.agentSecuritySummary.hasAgentSecurity,
    agentRunId: args.agentSecuritySummary.runId,
    agentEvaluationCount,
    agentGapCount: args.agentSecuritySummary.gapCount,
    agentPoamCount: args.agentSecuritySummary.poamCount,
    observableParityReady:
      args.bundleKind === 'threat-hunt' &&
      args.agentSecuritySummary.hasAgentSecurity &&
      args.validation.status === 'pass' &&
      args.reconciliation.status === 'matched',
  };
}

function buildAssessorReport(
  summary: AssessmentSummary,
  evalResults: EvalResult[],
  gaps: EvidenceGap[],
  poamItems: PoamItem[],
  reviewDecisions: ReviewDecisionLedgerEntry[] = [],
  agentRunId: string | null = null,
): string {
  const agentSecurity = summarizeAgentSecurityReportState({
    evalResults,
    gaps,
    poamItems,
    runId: agentRunId,
  });
  return [
    '# Assessor KSI Assessment',
    '',
    `Generated: ${summary.generatedAt}`,
    `Evidence Job: ${summary.evidenceJobId}`,
    '',
    `- PASS: ${summary.passingEvaluations}`,
    `- PARTIAL: ${summary.partialEvaluations}`,
    `- FAIL: ${summary.failingEvaluations}`,
    `- Open Gaps: ${summary.openGaps}`,
    '',
    '## Evaluation Results',
    ...evalResults.map((item) => `- \`${item.evalCode}\` ${item.status}: ${item.summary}`),
    '',
    '## Open Gaps',
    ...(gaps.length > 0
      ? gaps.map((item) => `- ${item.title}: ${item.detail}`)
      : ['- No open gaps were detected.']),
    '',
    ...(agentSecurity.hasAgentSecurity
      ? [
          '## Embedded Agent Security',
          `- Agent Run: ${agentSecurity.runId ?? 'linked bounded-agent package context'}`,
          `- Agent Evaluations: ${agentSecurity.passCount + agentSecurity.partialCount + agentSecurity.failCount}`,
          `- Agent PASS/PARTIAL/FAIL: ${agentSecurity.passCount}/${agentSecurity.partialCount}/${agentSecurity.failCount}`,
          `- Agent Gaps: ${agentSecurity.gapCount}`,
          `- Agent POA&M Items: ${agentSecurity.poamCount}`,
          ...(agentSecurity.topNonPassEvalCodes.length > 0
            ? [`- Top Non-Pass Agent Checks: ${agentSecurity.topNonPassEvalCodes.join(', ')}`]
            : ['- Top Non-Pass Agent Checks: None']),
          ...(agentSecurity.topGapTitles.length > 0
            ? agentSecurity.topGapTitles.map((item) => `- Agent Gap: ${item}`)
            : []),
          '',
        ]
      : []),
    ...buildReviewDecisionSection(reviewDecisions),
  ].join('\n');
}

function buildExecutiveReport(
  summary: AssessmentSummary,
  poamItems: PoamItem[],
  evalResults: EvalResult[],
  gaps: EvidenceGap[],
  reviewDecisions: ReviewDecisionLedgerEntry[] = [],
  agentRunId: string | null = null,
): string {
  const reviewSummary = summarizeReviewDecisions(reviewDecisions);
  const agentSecurity = summarizeAgentSecurityReportState({
    evalResults,
    gaps,
    poamItems,
    runId: agentRunId,
  });
  return [
    '# Executive Summary',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    `The current evidence package recorded ${summary.failingEvaluations} failing evaluations, ${summary.partialEvaluations} partial evaluations, and ${poamItems.length} POA&M item(s).`,
    '',
    '## Risk Posture',
    `- Critical open findings: ${summary.criticalOpenFindings}`,
    `- High open findings: ${summary.highOpenFindings}`,
    `- POA&M open items: ${summary.poamOpenItems}`,
    '',
    '## Human Review',
    `- Accepted review decisions: ${reviewSummary.accepted}`,
    `- Rejected review decisions: ${reviewSummary.rejected}`,
    `- Total recorded decisions: ${reviewSummary.total}`,
    '',
    ...(agentSecurity.hasAgentSecurity
      ? [
          '## Agent Governance',
          `- Linked bounded-agent run: ${agentSecurity.runId ?? 'present'}`,
          `- Agent non-pass evaluations: ${agentSecurity.partialCount + agentSecurity.failCount}`,
          `- Agent gaps requiring governance follow-up: ${agentSecurity.gapCount}`,
          `- Agent POA&M items: ${agentSecurity.poamCount}`,
          ...(agentSecurity.topNonPassEvalCodes.length > 0
            ? [`- Highest-priority agent checks: ${agentSecurity.topNonPassEvalCodes.join(', ')}`]
            : ['- Highest-priority agent checks: None']),
        ]
      : []),
  ].join('\n');
}

function buildAoReport(
  summary: AssessmentSummary,
  evalResults: EvalResult[],
  gaps: EvidenceGap[],
  poamItems: PoamItem[],
  reviewDecisions: ReviewDecisionLedgerEntry[] = [],
  agentRunId: string | null = null,
): string {
  const reviewSummary = summarizeReviewDecisions(reviewDecisions);
  const agentSecurity = summarizeAgentSecurityReportState({
    evalResults,
    gaps,
    poamItems,
    runId: agentRunId,
  });
  return [
    '# AO Residual Risk View',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    `Residual risk is derived from ${summary.failingEvaluations} failing evaluations and ${summary.openGaps} open evidence gaps.`,
    '',
    '## Highest Risk Items',
    ...(gaps
      .filter((item) => item.severity === 'critical' || item.severity === 'high')
      .slice(0, 10)
      .map((item) => `- ${item.severity.toUpperCase()}: ${item.title}`) || ['- No high-severity residual risk items found.']),
    '',
    '## Human Review Posture',
    `- Accepted decisions in package scope: ${reviewSummary.accepted}`,
    `- Rejected decisions in package scope: ${reviewSummary.rejected}`,
    '',
    ...(agentSecurity.hasAgentSecurity
      ? [
          '## Agent Residual Risk',
          `- Linked bounded-agent run: ${agentSecurity.runId ?? 'present'}`,
          `- Agent FAIL evaluations: ${agentSecurity.failCount}`,
          `- Agent PARTIAL evaluations: ${agentSecurity.partialCount}`,
          `- Agent governance POA&M items: ${agentSecurity.poamCount}`,
          ...(agentSecurity.topGapTitles.length > 0
            ? agentSecurity.topGapTitles.map((item) => `- Agent residual risk item: ${item}`)
            : ['- Agent residual risk item: None currently open.']),
        ]
      : []),
  ].join('\n');
}

function buildAssessorPoamReport(
  summary: AssessmentSummary,
  poamItems: PoamItem[],
): string {
  const agentPoamCount = poamItems.filter((item) => (item.sourceEvalCode ?? '').startsWith('AGENT_')).length;
  const remediationSection =
    poamItems.length > 0
      ? [
          '## Remediation',
          '',
          ...poamItems.flatMap((item) => [
            `### ${item.identifier}`,
            ...buildPoamRemediationPlan(item).map((step) => {
              const title = typeof step.title === 'string' ? step.title : 'Remediation step';
              const detail = typeof step.detail === 'string' ? step.detail : '';
              return `- ${title}${detail ? `: ${detail}` : ''}`;
            }),
            '',
          ]),
        ]
      : ['## Remediation', '', '- No open POA&M remediation items were generated for this package.'];

  return [
    '# Assessor POA&M',
    '',
    `Generated: ${summary.generatedAt}`,
    `Evidence Job: ${summary.evidenceJobId}`,
    `POA&M rows: ${poamItems.length}`,
    `Agent POA&M rows: ${agentPoamCount}`,
    '',
    '| POA&M ID | Severity | Status | Source Eval | Weakness | Due Date |',
    '| --- | --- | --- | --- | --- | --- |',
    ...poamItems.map(
      (item) =>
        `| ${item.identifier} | ${item.severity.toUpperCase()} | ${item.status} | ${item.sourceEvalCode ?? '—'} | ${item.weaknessName.replaceAll('|', '/')} | ${item.milestoneDueDate ?? '—'} |`,
    ),
    '',
    ...remediationSection,
  ].join('\n');
}

type AgentPackageEvaluation = {
  evalId: string;
  title: string;
  status: AssuranceEvalStatus;
  severity: AssuranceSeverity;
  summary: string;
  rationale: string;
  evidenceRefs: string[];
  metrics: Record<string, unknown>;
};

type AgentPackageContext = {
  runId: string;
  evalResultsKey: string;
  riskReportKey: string;
  poamKey: string;
  instrumentationPlanKey: string;
  secureArchitectureKey: string;
  evaluations: AgentPackageEvaluation[];
  poamItems: PoamItem[];
  gaps: EvidenceGap[];
};

function agentEvalResultsArtifactKey(tenantId: string, runId: string): string {
  return `${tenantId}/assurance/agent-runs/${runId}/agent-eval-results.json`;
}

function agentRiskReportArtifactKey(tenantId: string, runId: string): string {
  return `${tenantId}/assurance/agent-runs/${runId}/agent-risk-report.md`;
}

function agentPoamArtifactKey(tenantId: string, runId: string): string {
  return `${tenantId}/assurance/agent-runs/${runId}/agent-poam.csv`;
}

function agentInstrumentationPlanArtifactKey(tenantId: string, runId: string): string {
  return `${tenantId}/assurance/agent-runs/${runId}/agent-instrumentation-plan.md`;
}

function secureAgentArchitectureArtifactKey(tenantId: string, runId: string): string {
  return `${tenantId}/assurance/agent-runs/${runId}/secure-agent-architecture.md`;
}

function parseAgentPoamCsv(csv: string, evaluations: AgentPackageEvaluation[]): PoamItem[] {
  const lines = csv
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (lines.length <= 1) {
    return [];
  }

  const parseRow = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        if (inQuotes && line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
        continue;
      }
      current += char;
    }
    values.push(current);
    return values.map((item) => item.trim());
  };

  const headers = parseRow(lines[0]);
  const evaluationById = new Map(evaluations.map((item) => [item.evalId, item]));
  return lines.slice(1).map((line, index) => {
    const values = parseRow(line);
    const row = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] ?? '']));
    const evalId = normalizeString(row.source_eval_id);
    const evaluation = evaluationById.get(evalId);
    return {
      id: normalizeString(row.poam_id, `agent-poam-${index + 1}`),
      sourceGapId: evalId ? `agent-gap:${evalId}` : null,
      identifier: normalizeString(row.poam_id, `agent-poam-${index + 1}`),
      status: normalizeString(row.status, 'open'),
      severity: normalizeSeverity(row.severity, evaluation?.severity ?? 'moderate'),
      weaknessName: normalizeString(row.weakness_name, evaluation?.title ?? `Agent control gap ${index + 1}`),
      weaknessDescription: normalizeString(
        row.weakness_description,
        evaluation?.summary ?? 'Agent governance control gap recorded without a weakness description.',
      ),
      plannedRemediation: normalizeString(
        row.planned_remediation,
        evaluation?.rationale ?? 'Update the bounded-agent controls and rerun the agent security evaluation.',
      ),
      milestoneDueDate: normalizeNullableString(row.milestone_due_date),
      sourceEvalCode: evalId || null,
      controlRefs: KSI_BY_EVAL[evalId] ?? [evalId].filter(Boolean),
    };
  });
}

async function loadLatestAgentPackageContext(args: {
  env: EnvBindings;
  tenantId: string;
  evidenceJobId: string;
}): Promise<AgentPackageContext | null> {
  const run = await args.env.D1_MAIN.prepare(
    `
    SELECT id
    FROM assurance_agent_runs
    WHERE tenant_id = ? AND evidence_job_id = ?
    ORDER BY updated_at DESC
    LIMIT 1
    `,
  )
    .bind(args.tenantId, args.evidenceJobId)
    .first<{ id: string }>();

  if (!run?.id) {
    return null;
  }

  const evalResultsKey = agentEvalResultsArtifactKey(args.tenantId, run.id);
  const riskReportKey = agentRiskReportArtifactKey(args.tenantId, run.id);
  const poamKey = agentPoamArtifactKey(args.tenantId, run.id);
  const instrumentationPlanKey = agentInstrumentationPlanArtifactKey(args.tenantId, run.id);
  const secureArchitectureKey = secureAgentArchitectureArtifactKey(args.tenantId, run.id);

  const [evalDocument, poamCsv] = await Promise.all([
    readJsonArtifact<Record<string, unknown>>(args.env, evalResultsKey),
    readTextArtifact(args.env, poamKey),
  ]);

  const evaluationsRaw = evalDocument?.evaluations;
  if (!Array.isArray(evaluationsRaw) || evaluationsRaw.length === 0) {
    return null;
  }

  const evaluations: AgentPackageEvaluation[] = evaluationsRaw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      evalId: normalizeString(item.evalId),
      title: normalizeString(item.title, normalizeString(item.evalId, 'Agent evaluation')),
      status: normalizeStatus(item.status, 'FAIL').toUpperCase() as AssuranceEvalStatus,
      severity: normalizeSeverity(item.severity, 'moderate'),
      summary: normalizeString(item.summary, 'Agent governance result recorded without a summary.'),
      rationale: normalizeString(item.rationale, 'No rationale was provided for this agent governance result.'),
      evidenceRefs: toArray(item.evidenceRefs)
        .map((entry) => normalizeString(entry))
        .filter(Boolean),
      metrics: toRecord(item.metrics),
    }));

  const poamItems = poamCsv ? parseAgentPoamCsv(poamCsv, evaluations) : [];
  const gapTitleByEval = new Map(poamItems.map((item) => [item.sourceEvalCode, item.weaknessName]));
  const gaps: EvidenceGap[] = evaluations
    .filter((item) => item.status !== 'PASS')
    .map((item) => ({
      id: `agent-gap:${item.evalId}`,
      evalResultId: item.evalId,
      gapType: `agent_${item.evalId.toLowerCase()}`,
      severity: item.severity,
      title: gapTitleByEval.get(item.evalId) ?? item.title,
      detail: item.summary,
      affectedObjectType: 'agent_run',
      affectedObjectId: run.id,
      controlRefs: KSI_BY_EVAL[item.evalId] ?? [item.evalId],
      ksiRefs: KSI_BY_EVAL[item.evalId] ?? [item.evalId],
      recommendedArtifact: 'agent_eval_results.json',
      poamRequired: true,
    }));

  return {
    runId: run.id,
    evalResultsKey,
    riskReportKey,
    poamKey,
    instrumentationPlanKey,
    secureArchitectureKey,
    evaluations,
    poamItems,
    gaps,
  };
}

function mergeAgentPackageContextIntoArtifacts(
  artifacts: EvaluationArtifacts,
  agentPackageContext: AgentPackageContext | null,
): EvaluationArtifacts {
  if (!agentPackageContext) {
    return artifacts;
  }

  const agentEvalResults: EvalResult[] = agentPackageContext.evaluations.map((item) => ({
    id: item.evalId,
    evalCode: item.evalId,
    title: item.title,
    status: item.status,
    severity: item.severity,
    summary: item.summary,
    rationale: item.rationale,
    metrics: item.metrics,
    evidenceRefs: item.evidenceRefs.map((ref) => ({
      artifact: ref,
      field: 'agent_security',
    })),
  }));

  return {
    ...artifacts,
    summary: {
      ...artifacts.summary,
      passingEvaluations:
        artifacts.summary.passingEvaluations +
        agentPackageContext.evaluations.filter((item) => item.status === 'PASS').length,
      partialEvaluations:
        artifacts.summary.partialEvaluations +
        agentPackageContext.evaluations.filter((item) => item.status === 'PARTIAL').length,
      failingEvaluations:
        artifacts.summary.failingEvaluations +
        agentPackageContext.evaluations.filter((item) => item.status === 'FAIL').length,
      openGaps: artifacts.summary.openGaps + agentPackageContext.gaps.length,
      poamOpenItems: artifacts.summary.poamOpenItems + agentPackageContext.poamItems.length,
      criticalOpenFindings:
        artifacts.summary.criticalOpenFindings +
        agentPackageContext.gaps.filter((item) => item.severity === 'critical').length,
      highOpenFindings:
        artifacts.summary.highOpenFindings +
        agentPackageContext.gaps.filter((item) => item.severity === 'high').length,
    },
    evalResults: [...artifacts.evalResults, ...agentEvalResults],
    gaps: [...artifacts.gaps, ...agentPackageContext.gaps],
    poamItems: [...artifacts.poamItems, ...agentPackageContext.poamItems],
  };
}

function severityRank(value: AssuranceSeverity): number {
  switch (value) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'moderate':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

function topGaps(gaps: EvidenceGap[], limit = 5): EvidenceGap[] {
  return [...gaps]
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity) || left.title.localeCompare(right.title))
    .slice(0, limit);
}

function topPoam(poamItems: PoamItem[], limit = 5): PoamItem[] {
  return [...poamItems]
    .sort(
      (left, right) =>
        severityRank(right.severity) - severityRank(left.severity) ||
        left.identifier.localeCompare(right.identifier),
    )
    .slice(0, limit);
}

function buildTrackerExplanation(args: {
  audience: AssuranceExplainAudience;
  diagnostics: TrackerDiagnosticRow[];
  focusId?: string | null;
  question?: string | null;
}): AssuranceExplanation {
  const focus =
    args.focusId
      ? args.diagnostics.find(
          (item) =>
            item.row_key === args.focusId ||
            String(item.row_index) === args.focusId ||
            `row:${item.row_index}` === args.focusId,
        ) ?? null
      : null;
  const openRows = args.diagnostics.filter((item) => item.row_status !== 'closed');
  const severeRows = [...args.diagnostics]
    .filter((item) => normalizeSeverity(item.severity, 'moderate') !== 'low')
    .sort(
      (left, right) =>
        severityRank(normalizeSeverity(right.severity, 'moderate')) -
          severityRank(normalizeSeverity(left.severity, 'moderate')) || left.row_index - right.row_index,
    )
    .slice(0, 5);
  const categoryCounts = args.diagnostics.reduce<Record<string, number>>((acc, item) => {
    const key = item.category || 'general';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const highlights = [
    `${args.diagnostics.length} tracker row(s) were parsed for assurance mapping.`,
    `${openRows.length} row(s) remain open or need evidence follow-up.`,
    ...Object.entries(categoryCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([category, count]) => `${count} row(s) fall under ${category}.`),
  ];
  const suggestedActions =
    focus !== null
      ? [
          `Resolve row ${focus.row_index} by attaching the missing evidence for ${focus.gap_type || focus.category || 'the flagged control'}.`,
          'Confirm the mapped control and KSI references before promoting the tracker rows into a 20x package.',
        ]
      : [
          'Review the highest-severity tracker rows first and confirm they map to the intended evidence family.',
          'Convert the tracker import into a 20x package once open rows have the needed evidence notes and ownership.',
          'Use the review queue to accept or reject the resulting remediation recommendations.',
        ];

  return {
    audience: 'tracker',
    provider: 'deterministic-fallback',
    focusId: args.focusId?.trim() || null,
    title:
      focus !== null
        ? `Tracker row ${focus.row_index} analysis`
        : 'Tracker import assurance summary',
    explanation:
      focus !== null
        ? `Tracker row ${focus.row_index} is currently marked ${focus.row_status}. It is classified as ${focus.gap_type || focus.category || 'an evidence gap'} with ${normalizeSeverity(focus.severity, 'moderate')} severity. ${focus.detail}`
        : `The tracker import produced ${args.diagnostics.length} parsed rows, with ${openRows.length} still open for evidence or control mapping follow-up. The current tracker state is ready for human review before or alongside tracker-to-20x conversion.`,
    highlights,
    suggestedActions,
    evidenceRefs:
      focus !== null
        ? [`tracker.row:${focus.row_index}`, ...(asJson<string[]>(focus.control_refs_json, []) ?? [])]
        : severeRows.map((item) => `tracker.row:${item.row_index}`),
    question: args.question?.trim() || null,
    generatedAt: nowIso(),
  };
}

function buildDeterministicEvidenceExplanation(args: {
  audience: AssuranceExplainAudience;
  artifacts: EvaluationArtifacts;
  reviewDecisions?: ReviewDecisionLedgerEntry[];
  focusId?: string | null;
  question?: string | null;
}): AssuranceExplanation {
  const reviewDecisions = args.reviewDecisions ?? [];
  const focusEval =
    args.focusId
      ? args.artifacts.evalResults.find(
          (item) => item.id === args.focusId || item.evalCode === args.focusId,
        ) ?? null
      : null;
  const focusGap =
    args.focusId
      ? args.artifacts.gaps.find(
          (item) =>
            item.id === args.focusId ||
            item.affectedObjectId === args.focusId ||
            item.evalResultId === args.focusId,
        ) ?? null
      : null;
  const focusPoam =
    args.focusId
      ? args.artifacts.poamItems.find(
          (item) => item.id === args.focusId || item.identifier === args.focusId,
        ) ?? null
      : null;
  const focusRecommendation =
    args.focusId
      ? args.artifacts.reviewRecommendations.find(
          (item) => item.id === args.focusId || item.targetId === args.focusId,
        ) ?? null
      : null;
  const focusReviewDecision =
    args.focusId
      ? reviewDecisions.find(
          (item) =>
            item.id === args.focusId ||
            item.recommendationId === args.focusId ||
            item.targetId === args.focusId,
        ) ?? null
      : null;
  const focusReasonableness =
    args.focusId
      ? args.artifacts.reasonablenessFindings.find((item) => item.id === args.focusId) ?? null
      : null;
  const worstGaps = topGaps(args.artifacts.gaps, 5);
  const topPoamItems = topPoam(args.artifacts.poamItems, 5);

  let title = 'Assurance explanation';
  let explanation = '';
  let highlights: string[] = [];
  let suggestedActions: string[] = [];
  let evidenceRefs: string[] = [];

  switch (args.audience) {
    case 'assessor':
      title = focusEval
        ? `Assessor view for ${focusEval.evalCode}`
        : 'Assessor proof-chain summary';
      explanation = focusEval
        ? `${focusEval.evalCode} is currently ${focusEval.status}. ${focusEval.summary} ${focusEval.rationale}`
        : `The deterministic assurance run recorded ${args.artifacts.summary.failingEvaluations} failing evaluations, ${args.artifacts.summary.partialEvaluations} partial evaluations, and ${args.artifacts.summary.openGaps} open evidence gaps. The package is ready for assessor review with explicit proof-chain artifacts and recommended follow-up items.`;
      highlights = [
        `${args.artifacts.summary.passingEvaluations} evaluation(s) passed.`,
        `${args.artifacts.summary.partialEvaluations} evaluation(s) are partial.`,
        `${args.artifacts.summary.failingEvaluations} evaluation(s) failed.`,
        ...args.artifacts.evalResults
          .filter((item) => item.status !== 'PASS')
          .slice(0, 3)
          .map((item) => `${item.evalCode}: ${item.summary}`),
      ];
      suggestedActions = [
        'Review failing proof-chain evaluations first and confirm the cited evidence artifacts are complete.',
        'Use the review queue to accept or reject the open remediation recommendations before final packaging.',
      ];
      evidenceRefs = focusEval
        ? [focusEval.evalCode, ...focusEval.evidenceRefs.map((item) => `${item.artifact}.${item.field}`)]
        : args.artifacts.evalResults
            .filter((item) => item.status !== 'PASS')
            .slice(0, 5)
            .map((item) => item.evalCode);
      break;
    case 'executive':
      title = 'Executive risk posture summary';
      explanation = `The current package shows ${args.artifacts.summary.failingEvaluations} failing evaluations, ${args.artifacts.summary.criticalOpenFindings} critical open findings, ${args.artifacts.summary.highOpenFindings} high open findings, and ${args.artifacts.summary.poamOpenItems} open POA&M item(s). Residual risk is concentrated in the top failing assurance checks and their linked remediation backlog.`;
      highlights = [
        `${args.artifacts.summary.criticalOpenFindings} critical finding(s) remain open.`,
        `${args.artifacts.summary.highOpenFindings} high finding(s) remain open.`,
        `${args.artifacts.summary.poamOpenItems} POA&M item(s) require tracking.`,
        ...worstGaps.slice(0, 2).map((item) => `${item.severity.toUpperCase()}: ${item.title}`),
      ];
      suggestedActions = [
        'Prioritize the highest-severity POA&M items with named owners and due dates.',
        'Review any public exposure or ticket-chain failures before representing the package as authorize-ready.',
      ];
      evidenceRefs = worstGaps.slice(0, 5).map((item) => item.id);
      break;
    case 'ao':
      title = 'Authorizing official residual risk view';
      explanation = `Residual risk remains driven by ${args.artifacts.summary.failingEvaluations} failing evaluations and ${args.artifacts.summary.openGaps} open evidence gaps. The strongest indicators for AO attention are the highest-severity gaps, incomplete ticket or change evidence, and any public exposure or exploitation-review failures.`;
      highlights = worstGaps.map((item) => `${item.severity.toUpperCase()}: ${item.title}`);
      suggestedActions = [
        'Confirm whether the highest-severity gaps can be remediated before authorization or need explicit acceptance.',
        'Require closure evidence for critical findings and public exposure items before reducing residual risk.',
      ];
      evidenceRefs = worstGaps.map((item) => item.id);
      break;
    case 'derivation':
      title = focusEval
        ? `Derivation trace for ${focusEval.evalCode}`
        : focusGap
          ? `Derivation trace for ${focusGap.title}`
          : focusReviewDecision
            ? `Derivation trace for review decision ${focusReviewDecision.id}`
          : 'Deterministic derivation trace';
      explanation = focusEval
        ? `${focusEval.evalCode} was derived deterministically from the normalized bundle metrics and referenced artifacts. ${focusEval.rationale}`
        : focusGap
          ? `${focusGap.title} was created because its parent evaluation failed or only partially passed, and the affected object lacked the cited evidence artifact needed to satisfy the proof-chain.`
          : focusReviewDecision
            ? `${focusReviewDecision.recommendationTitle} was recorded as a human review decision with outcome ${focusReviewDecision.decision}. The decision was not inferred by AI; it was attached to the deterministic package state through the review ledger and is traceable to the cited evidence, finding, and control references.`
          : `The assurance package was derived from normalized evidence, deterministic evaluators, generated evidence gaps, and downstream POA&M recommendations. No pass or fail status was inferred by AI.`;
      highlights = [
        ...(focusEval
          ? focusEval.evidenceRefs.map((item) => `${item.artifact}.${item.field}`)
          : args.artifacts.evalResults.slice(0, 3).map((item) => `${item.evalCode}: ${item.status}`)),
        ...(focusGap ? focusGap.controlRefs.map((item) => `Control ${item}`) : []),
        ...(focusReviewDecision
          ? [
              `Decision: ${focusReviewDecision.decision}`,
              `Target: ${focusReviewDecision.targetType ?? 'package item'} ${focusReviewDecision.targetId ?? 'unknown'}`,
              ...focusReviewDecision.controlRefs.map((item) => `Control ${item}`),
            ]
          : []),
      ];
      suggestedActions = [
        'Inspect the cited bundle artifacts and metrics before changing the downstream recommendation state.',
        'Keep deterministic evaluation outputs authoritative and use explanations only to clarify provenance.',
      ];
      evidenceRefs = focusEval
        ? focusEval.evidenceRefs.map((item) => `${item.artifact}.${item.field}`)
        : focusGap
          ? [focusGap.id, ...(focusGap.controlRefs ?? [])]
          : focusReviewDecision
            ? [
                focusReviewDecision.id,
                ...focusReviewDecision.evidenceRefs,
                ...focusReviewDecision.findingRefs,
                ...focusReviewDecision.controlRefs,
              ]
          : args.artifacts.evalResults.slice(0, 5).map((item) => item.evalCode);
      break;
    case 'reasonableness':
      title = 'Continuous monitoring reasonableness view';
      explanation =
        args.artifacts.reasonablenessFindings.length > 0
          ? `Continuous monitoring evidence is present, but the current package still carries reasonableness concerns. ${args.artifacts.reasonablenessFindings[0]?.detail ?? ''}`.trim()
          : 'The current package did not record outstanding continuous monitoring reasonableness findings.';
      highlights = [
        ...args.artifacts.reasonablenessFindings.map((item) => `${item.status}: ${item.title}`),
        `Central log sources in coverage: ${String(
          (args.artifacts.liveCollectionCoverage as Record<string, unknown>).provider ?? 'unknown',
        )}`,
      ];
      suggestedActions = [
        'Refresh stale centralized logging evidence and confirm the expected cadence for all required sources.',
        'Review the ConMon execution artifacts alongside this evidence package before closing reasonableness gaps.',
      ];
      evidenceRefs =
        focusReasonableness !== null
          ? [focusReasonableness.id]
          : args.artifacts.reasonablenessFindings.map((item) => item.id);
      break;
    case 'remediation':
      title = focusGap
        ? `Remediation plan for ${focusGap.title}`
        : focusPoam
          ? `Remediation plan for ${focusPoam.identifier}`
          : focusReviewDecision
            ? `Review decision for ${focusReviewDecision.recommendationTitle}`
          : focusRecommendation
            ? `Review action for ${focusRecommendation.title}`
            : 'Remediation plan summary';
      explanation = focusPoam
        ? `${focusPoam.identifier} remains ${focusPoam.status}. ${focusPoam.weaknessDescription} Planned remediation: ${focusPoam.plannedRemediation}`
        : focusGap
          ? `${focusGap.title} requires additional evidence or control activity. Recommended artifact: ${focusGap.recommendedArtifact ?? 'supporting evidence'}.`
          : focusReviewDecision
            ? `${focusReviewDecision.recommendationTitle} was marked ${focusReviewDecision.decision}. Justification: ${focusReviewDecision.justification || 'No reviewer justification was recorded.'}`
          : `The current assurance package generated ${args.artifacts.poamItems.length} POA&M item(s) and ${args.artifacts.reviewRecommendations.length} pending review recommendation(s). The highest-severity gaps should drive the remediation queue first.`;
      highlights = [
        ...topPoamItems.map((item) => `${item.identifier}: ${item.weaknessName}`),
        ...worstGaps.slice(0, 2).map((item) => `${item.severity.toUpperCase()}: ${item.title}`),
        ...(focusReviewDecision
          ? [
              `${focusReviewDecision.decision.toUpperCase()}: ${focusReviewDecision.recommendationTitle}`,
              `${focusReviewDecision.evidenceRefs.length} evidence ref(s) cited in the review decision.`,
            ]
          : []),
      ];
      suggestedActions = [
        'Assign owners and milestone dates to the highest-severity POA&M items first.',
        'Use accepted review decisions to regenerate package outputs after remediation evidence is attached.',
      ];
      evidenceRefs =
        focusPoam !== null
          ? [focusPoam.identifier]
          : focusGap !== null
            ? [focusGap.id]
            : focusReviewDecision !== null
              ? [
                  focusReviewDecision.id,
                  ...focusReviewDecision.evidenceRefs,
                  ...focusReviewDecision.findingRefs,
                  ...focusReviewDecision.controlRefs,
                ]
            : topPoamItems.map((item) => item.identifier);
      break;
    default:
      title = 'Assurance summary';
      explanation = `The package contains ${args.artifacts.summary.failingEvaluations} failing evaluations and ${args.artifacts.summary.openGaps} open gaps.`;
      highlights = [];
      suggestedActions = [];
      evidenceRefs = [];
      break;
  }

  return {
    audience: args.audience,
    provider: 'deterministic-fallback',
    focusId: args.focusId?.trim() || null,
    title,
    explanation,
    highlights: uniqueBy(highlights.filter(Boolean), (item) => item),
    suggestedActions: uniqueBy(suggestedActions.filter(Boolean), (item) => item),
    evidenceRefs: uniqueBy(evidenceRefs.filter(Boolean), (item) => item),
    question: args.question?.trim() || null,
    generatedAt: nowIso(),
  };
}

export async function buildAssuranceExplanation(args: {
  env: EnvBindings;
  audience: AssuranceExplainAudience;
  evidenceJobId?: string | null;
  importJobId?: string | null;
  focusId?: string | null;
  question?: string | null;
}): Promise<AssuranceExplanation> {
  if (args.audience === 'tracker') {
    if (!args.importJobId) {
      throw new Error('importJobId is required for tracker explanations.');
    }

    const diagnostics = await loadTrackerDiagnostics(args.env, args.importJobId);
    const fallback = buildTrackerExplanation({
      audience: args.audience,
      diagnostics,
      focusId: args.focusId,
      question: args.question,
    });

    const aiResponse = await generateJsonWithAi<{
      title?: unknown;
      explanation?: unknown;
      highlights?: unknown;
      suggestedActions?: unknown;
      evidenceRefs?: unknown;
    }>(args.env, {
      systemPrompt:
        'You explain tracker-import assurance evidence for reviewers. Stay grounded in the provided tracker diagnostics, do not invent pass/fail outcomes, and return only the requested JSON fields.',
      userPrompt: JSON.stringify({
        audience: args.audience,
        question: args.question ?? null,
        focusId: args.focusId ?? null,
        trackerSummary: {
          rowCount: diagnostics.length,
          openRows: diagnostics.filter((item) => item.row_status !== 'closed').length,
          topRows: diagnostics.slice(0, 5).map((item) => ({
            rowIndex: item.row_index,
            rowKey: item.row_key,
            status: item.row_status,
            category: item.category,
            gapType: item.gap_type,
            severity: item.severity,
            detail: item.detail,
          })),
        },
        responseShape: {
          title: 'string',
          explanation: 'string',
          highlights: ['string'],
          suggestedActions: ['string'],
          evidenceRefs: ['string'],
        },
      }),
      maxTokens: 500,
      temperature: 0.1,
    });

    if (!aiResponse || typeof aiResponse.explanation !== 'string') {
      return fallback;
    }

    return {
      ...fallback,
      provider: 'cloudflare-workers-ai',
      title: normalizeString(aiResponse.title, fallback.title),
      explanation: normalizeString(aiResponse.explanation, fallback.explanation),
      highlights:
        normalizeStringArray(aiResponse.highlights).slice(0, 6).length > 0
          ? normalizeStringArray(aiResponse.highlights).slice(0, 6)
          : fallback.highlights,
      suggestedActions:
        normalizeStringArray(aiResponse.suggestedActions).slice(0, 6).length > 0
          ? normalizeStringArray(aiResponse.suggestedActions).slice(0, 6)
          : fallback.suggestedActions,
      evidenceRefs:
        normalizeStringArray(aiResponse.evidenceRefs).slice(0, 8).length > 0
          ? normalizeStringArray(aiResponse.evidenceRefs).slice(0, 8)
          : fallback.evidenceRefs,
      generatedAt: nowIso(),
    };
  }

  if (!args.evidenceJobId) {
    throw new Error('evidenceJobId is required for assurance explanations.');
  }

  const baseArtifacts = await loadEvaluationArtifacts(args.env, args.evidenceJobId);
  if (!baseArtifacts) {
    throw new Error('Evaluation artifacts are required before assurance explanations can be generated.');
  }
  const agentPackageContext = await loadLatestAgentPackageContext({
    env: args.env,
    tenantId: baseArtifacts.summary.tenantId,
    evidenceJobId: args.evidenceJobId,
  });
  const artifacts = mergeAgentPackageContextIntoArtifacts(baseArtifacts, agentPackageContext);
  const reviewDecisions = await loadReviewDecisionLedger(
    args.env,
    artifacts.summary.tenantId,
    args.evidenceJobId,
  );

  const fallback = buildDeterministicEvidenceExplanation({
    audience: args.audience,
    artifacts,
    reviewDecisions,
    focusId: args.focusId,
    question: args.question,
  });

  const aiResponse = await generateJsonWithAi<{
    title?: unknown;
    explanation?: unknown;
    highlights?: unknown;
    suggestedActions?: unknown;
    evidenceRefs?: unknown;
  }>(args.env, {
    systemPrompt:
      'You explain deterministic assurance evidence for different audiences. Stay grounded in the provided summary and artifacts, do not change counts or statuses, do not invent evidence, and return only the requested JSON fields.',
    userPrompt: JSON.stringify({
      audience: args.audience,
      question: args.question ?? null,
      focusId: args.focusId ?? null,
      summary: artifacts.summary,
      failingEvaluations: artifacts.evalResults
        .filter((item) => item.status !== 'PASS')
        .slice(0, 5)
        .map((item) => ({
          evalCode: item.evalCode,
          status: item.status,
          severity: item.severity,
          summary: item.summary,
          rationale: item.rationale,
          evidenceRefs: item.evidenceRefs,
        })),
      topGaps: topGaps(artifacts.gaps, 5).map((item) => ({
        id: item.id,
        title: item.title,
        severity: item.severity,
        detail: item.detail,
        controlRefs: item.controlRefs,
        ksiRefs: item.ksiRefs,
      })),
      topPoam: topPoam(artifacts.poamItems, 5).map((item) => ({
        id: item.id,
        identifier: item.identifier,
        status: item.status,
        severity: item.severity,
        weaknessName: item.weaknessName,
        plannedRemediation: item.plannedRemediation,
      })),
      reviewDecisions: reviewDecisions.slice(0, 5).map((item) => ({
        id: item.id,
        recommendationId: item.recommendationId,
        recommendationTitle: item.recommendationTitle,
        decision: item.decision,
        justification: item.justification,
        targetId: item.targetId,
        targetType: item.targetType,
        evidenceRefs: item.evidenceRefs,
        findingRefs: item.findingRefs,
        controlRefs: item.controlRefs,
      })),
      reasonablenessFindings: artifacts.reasonablenessFindings,
      responseShape: {
        title: 'string',
        explanation: 'string',
        highlights: ['string'],
        suggestedActions: ['string'],
        evidenceRefs: ['string'],
      },
    }),
    maxTokens: 650,
    temperature: 0.1,
  });

  if (!aiResponse || typeof aiResponse.explanation !== 'string') {
    return fallback;
  }

  return {
    ...fallback,
    provider: 'cloudflare-workers-ai',
    title: normalizeString(aiResponse.title, fallback.title),
    explanation: normalizeString(aiResponse.explanation, fallback.explanation),
    highlights:
      normalizeStringArray(aiResponse.highlights).slice(0, 6).length > 0
        ? normalizeStringArray(aiResponse.highlights).slice(0, 6)
        : fallback.highlights,
    suggestedActions:
      normalizeStringArray(aiResponse.suggestedActions).slice(0, 6).length > 0
        ? normalizeStringArray(aiResponse.suggestedActions).slice(0, 6)
        : fallback.suggestedActions,
    evidenceRefs:
      normalizeStringArray(aiResponse.evidenceRefs).slice(0, 8).length > 0
        ? normalizeStringArray(aiResponse.evidenceRefs).slice(0, 8)
        : fallback.evidenceRefs,
    generatedAt: nowIso(),
  };
}

export async function buildTwentyXPackage(args: {
  env: EnvBindings;
  tenantId: string;
  folderId: string | null;
  evidenceJobId: string;
  packageJobId: string;
  fileName: string;
  sourceId: string;
  artifacts: EvaluationArtifacts;
  reviewDecisions?: ReviewDecisionLedgerEntry[];
}): Promise<{
  summary: TwentyXPackageSummary;
  reconciliation: ReconciliationSummary;
  validation: import('./validation').AssuranceValidationReport;
  coverage: Record<string, unknown>;
}> {
  const reviewDecisions =
    args.reviewDecisions ?? (await loadReviewDecisionLedger(args.env, args.tenantId, args.evidenceJobId));
  const agentPackageContext = await loadLatestAgentPackageContext({
    env: args.env,
    tenantId: args.tenantId,
    evidenceJobId: args.evidenceJobId,
  });
  const packageArtifacts = mergeAgentPackageContextIntoArtifacts(args.artifacts, agentPackageContext);
  const reviewSummary = summarizeReviewDecisions(reviewDecisions);
  const reportManifest = [
    {
      role: 'assessor',
      path: artifactKeyForPackage(args.tenantId, args.packageJobId, 'report_manifest').replace('report_manifest.json', 'assessor.md'),
    },
    {
      role: 'executive',
      path: artifactKeyForPackage(args.tenantId, args.packageJobId, 'report_manifest').replace('report_manifest.json', 'executive.md'),
    },
    {
      role: 'ao',
      path: artifactKeyForPackage(args.tenantId, args.packageJobId, 'report_manifest').replace('report_manifest.json', 'ao.md'),
    },
    {
      role: 'assessor_poam_md',
      path: artifactKeyForPackage(args.tenantId, args.packageJobId, 'report_manifest').replace('report_manifest.json', 'assessor-poam.md'),
    },
  ];

  const packageKey = artifactKeyForPackage(args.tenantId, args.packageJobId, 'package_json');
  const manifestKey = artifactKeyForPackage(args.tenantId, args.packageJobId, 'report_manifest');
  const reconciliationKey = artifactKeyForPackage(args.tenantId, args.packageJobId, 'reconciliation');
  const validationKey = artifactKeyForPackage(args.tenantId, args.packageJobId, 'validation_report');
  const evalResultsKey = artifactKeyForEvidenceJob(args.tenantId, args.sourceId, args.evidenceJobId, 'eval_results');
  const gapKey = artifactKeyForEvidenceJob(args.tenantId, args.sourceId, args.evidenceJobId, 'evidence_gaps');
  const poamKey = artifactKeyForEvidenceJob(args.tenantId, args.sourceId, args.evidenceJobId, 'poam_items');
  const summaryKey = artifactKeyForEvidenceJob(args.tenantId, args.sourceId, args.evidenceJobId, 'assessment_summary');
  const correlationReportKey = artifactKeyForEvidenceJob(
    args.tenantId,
    args.sourceId,
    args.evidenceJobId,
    'correlation_report',
    'md',
  );
  const auditorQuestionsKey = artifactKeyForEvidenceJob(
    args.tenantId,
    args.sourceId,
    args.evidenceJobId,
    'auditor_questions',
    'md',
  );
  const instrumentationPlanKey = artifactKeyForEvidenceJob(
    args.tenantId,
    args.sourceId,
    args.evidenceJobId,
    'instrumentation_plan',
    'md',
  );
  const validationReportEvidenceKey = artifactKeyForEvidenceJob(
    args.tenantId,
    args.sourceId,
    args.evidenceJobId,
    'validation_report',
  );
  const evidenceGapMatrixKey = artifactKeyForEvidenceJob(
    args.tenantId,
    args.sourceId,
    args.evidenceJobId,
    'evidence_gap_matrix',
    'csv',
  );
  const reasonablenessFindingsKey = artifactKeyForEvidenceJob(
    args.tenantId,
    args.sourceId,
    args.evidenceJobId,
    'reasonableness_findings',
  );
  const threatHuntFindingsKey = artifactKeyForEvidenceJob(
    args.tenantId,
    args.sourceId,
    args.evidenceJobId,
    'threat_hunt_findings',
  );
  const threatHuntTimelineKey = artifactKeyForEvidenceJob(
    args.tenantId,
    args.sourceId,
    args.evidenceJobId,
    'threat_hunt_timeline',
    'md',
  );
  const threatHuntQueriesKey = artifactKeyForEvidenceJob(
    args.tenantId,
    args.sourceId,
    args.evidenceJobId,
    'threat_hunt_queries',
    'md',
  );

  const evalById = new Map(packageArtifacts.evalResults.map((item) => [item.id, item]));
  const agentSecuritySummary = summarizeAgentSecurityReportState({
    evalResults: packageArtifacts.evalResults,
    gaps: packageArtifacts.gaps,
    poamItems: packageArtifacts.poamItems,
    runId: agentPackageContext?.runId ?? null,
  });

  const packageDocument = {
    metadata: {
      schema_version: 'regovise-fedramp20x-v1',
      generated_at: nowIso(),
      evidence_job_id: args.evidenceJobId,
      package_job_id: args.packageJobId,
      file_name: args.fileName,
      bundle_kind: packageArtifacts.summary.bundleKind,
      input_mode: packageArtifacts.summary.inputMode,
      agent_run_id: agentPackageContext?.runId ?? null,
    },
    summary: {
      pass_count: packageArtifacts.summary.passingEvaluations,
      partial_count: packageArtifacts.summary.partialEvaluations,
      fail_count: packageArtifacts.summary.failingEvaluations,
      gap_count: packageArtifacts.summary.openGaps,
      poam_count: packageArtifacts.poamItems.length,
      review_decision_count: reviewSummary.total,
      accepted_review_count: reviewSummary.accepted,
      rejected_review_count: reviewSummary.rejected,
    },
    ksi_validation_results: packageArtifacts.evalResults.map((item) => ({
      ksi_id: KSI_BY_EVAL[item.evalCode]?.[0] ?? item.evalCode,
      eval_code: item.evalCode,
      title: item.title,
      status: item.status,
      severity: item.severity,
      summary: item.summary,
      rationale: item.rationale,
      evidence_refs: item.evidenceRefs,
      metrics: item.metrics,
    })),
    ...(agentSecuritySummary.hasAgentSecurity
      ? {
          agent_security_summary: {
            run_id: agentSecuritySummary.runId,
            evaluation_count:
              agentSecuritySummary.passCount +
              agentSecuritySummary.partialCount +
              agentSecuritySummary.failCount,
            pass_count: agentSecuritySummary.passCount,
            partial_count: agentSecuritySummary.partialCount,
            fail_count: agentSecuritySummary.failCount,
            gap_count: agentSecuritySummary.gapCount,
            poam_count: agentSecuritySummary.poamCount,
            top_non_pass_eval_codes: agentSecuritySummary.topNonPassEvalCodes,
            top_gap_titles: agentSecuritySummary.topGapTitles,
          },
        }
      : {}),
    findings: packageArtifacts.gaps.map((item) => {
      const evalCode = item.evalResultId ? evalById.get(item.evalResultId)?.evalCode ?? null : null;
      const isAgentFinding = Boolean(evalCode?.startsWith('AGENT_') && agentPackageContext);
      const linkedAgentPoam = isAgentFinding
        ? packageArtifacts.poamItems.find(
            (poamItem) => poamItem.sourceGapId === item.id && poamItem.sourceEvalCode === evalCode,
          )
        : null;
      return ({
      id: item.id,
      source: 'eval_result',
      source_eval_code: evalCode,
      source_artifact_refs: isAgentFinding
        ? [
            `${agentPackageContext?.evalResultsKey}#/evaluations/${item.evalResultId ?? evalCode}`,
            agentPackageContext?.riskReportKey ?? '',
            ...(linkedAgentPoam ? [`${agentPackageContext?.poamKey}#${linkedAgentPoam.identifier}`] : []),
          ].filter(Boolean)
        : [
            item.evalResultId ? `${evalResultsKey}#${item.evalResultId}` : evalResultsKey,
            `${gapKey}#${item.id}`,
          ],
      gap_type: item.gapType,
      title: item.title,
      severity: item.severity,
      detail: item.detail,
      control_refs: item.controlRefs,
      ksi_refs: item.ksiRefs,
      recommended_artifact: item.recommendedArtifact,
      current_state: item.detail,
      target_state: `Provide ${item.recommendedArtifact ?? 'supporting evidence'} and rerun the deterministic package validation chain.`,
      estimated_effort: severityEffort(item.severity),
      priority: severityPriority(item.severity),
      remediation_steps: remediationSteps(item.detail, item.recommendedArtifact),
      assessor_workpaper: buildAssessorWorkpaper(item),
      ...(linkedAgentPoam ? { poam_id: linkedAgentPoam.identifier } : {}),
    });
    }),
    poam_items: packageArtifacts.poamItems.map((item) => ({
      ...item,
      finding_id: item.sourceGapId,
      current_state: item.weaknessDescription,
      target_state: item.plannedRemediation,
      estimated_effort: severityEffort(item.severity),
      priority: severityPriority(item.severity),
      remediation_plan: buildPoamRemediationPlan(item),
    })),
    review_ledger: {
      total: reviewSummary.total,
      accepted_count: reviewSummary.accepted,
      rejected_count: reviewSummary.rejected,
      other_count: reviewSummary.other,
      decisions: reviewDecisions.map((item) => ({
        id: item.id,
        recommendation_id: item.recommendationId,
        recommendation_title: item.recommendationTitle,
        target_type: item.targetType,
        target_id: item.targetId,
        decision: item.decision,
        justification: item.justification,
        evidence_refs: item.evidenceRefs,
        finding_refs: item.findingRefs,
        control_refs: item.controlRefs,
        decided_by_user_id: item.decidedByUserId,
        created_at: item.createdAt,
      })),
    },
    evidence_links: [
      { family: 'assessment_summary', path: summaryKey },
      { family: 'eval_results', path: evalResultsKey },
      { family: 'evidence_gaps', path: gapKey },
      { family: 'poam_items', path: poamKey },
      { family: 'correlation_report', path: correlationReportKey },
      { family: 'auditor_questions', path: auditorQuestionsKey },
      { family: 'instrumentation_plan', path: instrumentationPlanKey },
      { family: 'evidence_gap_matrix', path: evidenceGapMatrixKey },
      { family: 'reasonableness_findings', path: reasonablenessFindingsKey },
      { family: 'validation_report', path: validationReportEvidenceKey },
      { family: 'threat_hunt_findings', path: threatHuntFindingsKey },
      { family: 'threat_hunt_timeline', path: threatHuntTimelineKey },
      { family: 'threat_hunt_queries', path: threatHuntQueriesKey },
      ...(agentPackageContext
        ? [
            { family: 'agent_eval_results', path: agentPackageContext.evalResultsKey },
            { family: 'agent_risk_report', path: agentPackageContext.riskReportKey },
            { family: 'agent_poam', path: agentPackageContext.poamKey },
            { family: 'agent_instrumentation_plan', path: agentPackageContext.instrumentationPlanKey },
            { family: 'secure_agent_architecture', path: agentPackageContext.secureArchitectureKey },
          ]
        : []),
    ],
    report_manifest: reportManifest,
  };

  const assessorReport = buildAssessorReport(
    packageArtifacts.summary,
    packageArtifacts.evalResults,
    packageArtifacts.gaps,
    packageArtifacts.poamItems,
    reviewDecisions,
    agentPackageContext?.runId ?? null,
  );
  const executiveReport = buildExecutiveReport(
    packageArtifacts.summary,
    packageArtifacts.poamItems,
    packageArtifacts.evalResults,
    packageArtifacts.gaps,
    reviewDecisions,
    agentPackageContext?.runId ?? null,
  );
  const aoReport = buildAoReport(
    packageArtifacts.summary,
    packageArtifacts.evalResults,
    packageArtifacts.gaps,
    packageArtifacts.poamItems,
    reviewDecisions,
    agentPackageContext?.runId ?? null,
  );
  const assessorPoamReport = buildAssessorPoamReport(
    packageArtifacts.summary,
    packageArtifacts.poamItems,
  );

  const reconciliationBase = buildPackageReconciliation({
    artifacts: packageArtifacts,
    packageDocument,
    assessorReport,
    executiveReport,
    aoReport,
    assessorPoamReport,
    reviewDecisionCount: reviewSummary.total,
  });
  const reconciliation: ReconciliationSummary = {
    ...reconciliationBase,
    packageJobId: args.packageJobId,
  };
  const validation = buildPackageValidationReport({
    packageDocument,
    summary: {
      packageJobId: args.packageJobId,
      evidenceJobId: args.evidenceJobId,
      packageKey,
      manifestKey,
      generatedAt: nowIso(),
      evaluationCount: packageArtifacts.evalResults.length,
      gapCount: packageArtifacts.gaps.length,
      poamCount: packageArtifacts.poamItems.length,
      reportManifest,
    },
    reconciliation,
    assessorReport,
    executiveReport,
    aoReport,
    assessorPoamReport,
  });

  await Promise.all([
    writeJsonArtifact(args.env, packageKey, packageDocument),
    writeJsonArtifact(args.env, manifestKey, reportManifest),
    writeJsonArtifact(args.env, reconciliationKey, reconciliation),
    writeJsonArtifact(args.env, validationKey, validation),
    writeMarkdownArtifact(args.env, reportManifest[0].path, assessorReport),
    writeMarkdownArtifact(args.env, reportManifest[1].path, executiveReport),
    writeMarkdownArtifact(args.env, reportManifest[2].path, aoReport),
    writeMarkdownArtifact(args.env, reportManifest[3].path, assessorPoamReport),
  ]);

  const summary: TwentyXPackageSummary = {
    packageJobId: args.packageJobId,
    evidenceJobId: args.evidenceJobId,
    packageKey,
    manifestKey,
    generatedAt: nowIso(),
    evaluationCount: packageArtifacts.evalResults.length,
    gapCount: packageArtifacts.gaps.length,
    poamCount: packageArtifacts.poamItems.length,
    reportManifest,
  };
  const coverage = buildPackageCoverageRecord({
    summary,
    validation,
    reconciliation,
    reviewSummary,
    bundleKind: packageArtifacts.summary.bundleKind,
    inputMode: packageArtifacts.summary.inputMode,
    agentSecuritySummary,
  });

  return {
    summary,
    reconciliation,
    validation,
    coverage,
  };
}

export async function loadPackageSummary(
  env: EnvBindings,
  tenantId: string,
  packageJobId: string,
): Promise<{
  job: PackageJobRow;
  summary: TwentyXPackageSummary | null;
  reconciliation: ReconciliationSummary | null;
}> {
  const job = await env.D1_MAIN.prepare(
    `
    SELECT id, tenant_id, folder_id, file_name, status, manifest_key, artifact_key, coverage_json, error_summary_json, created_at, updated_at
    FROM ai_compliance_export_jobs
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, packageJobId)
    .first<PackageJobRow>();

  if (!job) {
    throw new Error('Package job not found.');
  }

  const manifest = job.manifest_key ? await readJsonArtifact<Array<{ role: string; path: string }>>(env, job.manifest_key) : null;
  const packageDoc = job.artifact_key ? await readJsonArtifact<Record<string, unknown>>(env, job.artifact_key) : null;
  const reconciliationRow = await env.D1_MAIN.prepare(
    `
    SELECT id, status, summary_json, diff_json, evidence_job_id
    FROM assurance_reconciliation_runs
    WHERE package_job_id = ?
    ORDER BY created_at DESC
    LIMIT 1
    `,
  )
    .bind(packageJobId)
    .first<{
      id: string;
      status: string;
      summary_json: string;
      diff_json: string;
      evidence_job_id: string;
    }>();

  const reconciliationDiff = reconciliationRow
    ? asJson<Record<string, unknown>>(reconciliationRow.diff_json, {})
    : null;
  const reconciliation: ReconciliationSummary | null = reconciliationRow
    ? {
        id: reconciliationRow.id,
        packageJobId,
        evidenceJobId: reconciliationRow.evidence_job_id,
        status: reconciliationRow.status,
        checks: Array.isArray(reconciliationDiff?.checks)
          ? (reconciliationDiff.checks as Array<{
              id: string;
              expected: number;
              actual: number;
              status: 'match' | 'mismatch';
            }>)
          : [],
      }
    : null;

  const summary: TwentyXPackageSummary | null =
    packageDoc && job.artifact_key
      ? {
          packageJobId,
          evidenceJobId: normalizeString(toRecord(packageDoc.metadata).evidence_job_id),
          packageKey: job.artifact_key,
          manifestKey: job.manifest_key ?? '',
          generatedAt: normalizeString(toRecord(packageDoc.metadata).generated_at, job.created_at),
          evaluationCount: toArray(packageDoc.ksi_validation_results).length,
          gapCount: toArray(packageDoc.findings).length,
          poamCount: toArray(packageDoc.poam_items).length,
          reportManifest: manifest ?? [],
        }
      : null;

  return {
    job,
    summary,
    reconciliation,
  };
}

export async function loadPackageArtifactPreview(
  env: EnvBindings,
  tenantId: string,
  packageJobId: string,
  family: string,
): Promise<{
  family: string;
  objectKey: string;
  contentType: string;
  preview: unknown;
} | null> {
  const packageState = await loadPackageSummary(env, tenantId, packageJobId);

  if (family === 'package_json' && packageState.job.artifact_key) {
    return {
      family,
      objectKey: packageState.job.artifact_key,
      contentType: 'application/json',
      preview:
        (await readJsonArtifact<Record<string, unknown>>(env, packageState.job.artifact_key)) ?? null,
    };
  }

  if (family === 'review_ledger' && packageState.job.artifact_key) {
    const packageDoc =
      (await readJsonArtifact<Record<string, unknown>>(env, packageState.job.artifact_key)) ?? null;
    return {
      family,
      objectKey: packageState.job.artifact_key,
      contentType: 'application/json',
      preview: packageDoc ? toRecord(packageDoc.review_ledger) : null,
    };
  }

  if (family === 'report_manifest' && packageState.job.manifest_key) {
    return {
      family,
      objectKey: packageState.job.manifest_key,
      contentType: 'application/json',
      preview:
        (await readJsonArtifact<Array<{ role: string; path: string }>>(env, packageState.job.manifest_key)) ??
        null,
    };
  }

  if (family === 'reconciliation') {
    const objectKey = artifactKeyForPackage(tenantId, packageJobId, 'reconciliation');
    return {
      family,
      objectKey,
      contentType: 'application/json',
      preview: (await readJsonArtifact<Record<string, unknown>>(env, objectKey)) ?? null,
    };
  }

  if (family === 'validation_report') {
    const objectKey = artifactKeyForPackage(tenantId, packageJobId, 'validation_report');
    return {
      family,
      objectKey,
      contentType: 'application/json',
      preview: (await readJsonArtifact<Record<string, unknown>>(env, objectKey)) ?? null,
    };
  }

  if (family === 'assessor' || family === 'executive' || family === 'ao' || family === 'assessor_poam_md') {
    const reportPath = packageState.summary?.reportManifest.find((item) => item.role === family)?.path;
    if (!reportPath) {
      return null;
    }

    return {
      family,
      objectKey: reportPath,
      contentType: 'text/markdown; charset=utf-8',
      preview: (await readTextArtifact(env, reportPath)) ?? null,
    };
  }

  return null;
}

async function loadReviewDecisionLedger(
  env: EnvBindings,
  tenantId: string,
  evidenceJobId: string,
): Promise<ReviewDecisionLedgerEntry[]> {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT review.id, review.recommendation_id, review.decision, review.justification, review.evidence_refs_json,
           review.finding_refs_json, review.control_refs_json, review.decided_by_user_id, review.created_at,
           recommendation.title, recommendation.target_id, recommendation.target_type
    FROM assurance_review_decisions AS review
    LEFT JOIN assurance_review_recommendations AS recommendation
      ON recommendation.id = review.recommendation_id
    WHERE review.tenant_id = ? AND review.evidence_job_id = ?
    ORDER BY review.created_at DESC
    `,
  )
    .bind(tenantId, evidenceJobId)
    .all<
      ReviewDecisionRow & {
        title: string | null;
        target_id: string | null;
        target_type: string | null;
      }
    >();

  return rows.results.map((row) => ({
    id: row.id,
    recommendationId: row.recommendation_id,
    decision: row.decision,
    justification: row.justification,
    evidenceRefs: asJson<string[]>(row.evidence_refs_json, []),
    findingRefs: asJson<string[]>(row.finding_refs_json, []),
    controlRefs: asJson<string[]>(row.control_refs_json, []),
    decidedByUserId: row.decided_by_user_id,
    createdAt: row.created_at,
    recommendationTitle: normalizeString(row.title, row.recommendation_id),
    targetId: row.target_id,
    targetType: row.target_type,
  }));
}

export async function refreshPackageArtifactsForEvidenceJob(args: {
  env: EnvBindings;
  tenantId: string;
  evidenceJobId: string;
}): Promise<{
  refreshedPackageIds: string[];
}> {
  const evidenceJob = await args.env.D1_MAIN.prepare(
    `
    SELECT id, tenant_id, folder_id, source_id
    FROM evidence_jobs
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(args.tenantId, args.evidenceJobId)
    .first<{ id: string; tenant_id: string; folder_id: string | null; source_id: string }>();

  if (!evidenceJob) {
    return { refreshedPackageIds: [] };
  }

  const artifacts = await loadEvaluationArtifacts(args.env, args.evidenceJobId);
  if (!artifacts) {
    return { refreshedPackageIds: [] };
  }

  const reviewDecisions = await loadReviewDecisionLedger(args.env, args.tenantId, args.evidenceJobId);
  const reviewSummary = summarizeReviewDecisions(reviewDecisions);
  const packageRows = await args.env.D1_MAIN.prepare(
    `
    SELECT DISTINCT package_job.id, package_job.file_name
    FROM ai_compliance_export_jobs AS package_job
    INNER JOIN assurance_reconciliation_runs AS reconciliation
      ON reconciliation.package_job_id = package_job.id
    WHERE package_job.tenant_id = ? AND package_job.run_family = 'assurance_package' AND reconciliation.evidence_job_id = ?
    ORDER BY package_job.created_at DESC
    `,
  )
    .bind(args.tenantId, args.evidenceJobId)
    .all<{ id: string; file_name: string }>();

  const refreshedPackageIds: string[] = [];
  for (const packageRow of packageRows.results) {
    const packageState = await buildTwentyXPackage({
      env: args.env,
      tenantId: args.tenantId,
      folderId: evidenceJob.folder_id,
      evidenceJobId: args.evidenceJobId,
      packageJobId: packageRow.id,
      fileName: packageRow.file_name,
      sourceId: evidenceJob.source_id,
      artifacts,
      reviewDecisions,
    });
    const timestamp = nowIso();

    await args.env.D1_MAIN.batch([
      args.env.D1_MAIN.prepare(
        `
        UPDATE ai_compliance_export_jobs
        SET artifact_key = ?, manifest_key = ?, coverage_json = ?, updated_at = ?
        WHERE tenant_id = ? AND id = ?
        `,
      ).bind(
        packageState.summary.packageKey,
        packageState.summary.manifestKey,
        JSON.stringify(packageState.coverage),
        timestamp,
        args.tenantId,
        packageRow.id,
      ),
      args.env.D1_MAIN.prepare(
        `
        INSERT INTO assurance_reconciliation_runs (
          id, tenant_id, folder_id, evidence_job_id, package_job_id, status, summary_json, diff_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).bind(
        packageState.reconciliation.id,
        args.tenantId,
        evidenceJob.folder_id,
        args.evidenceJobId,
        packageRow.id,
        packageState.reconciliation.status,
        JSON.stringify({
          checks: packageState.reconciliation.checks.length,
        }),
        JSON.stringify({
          checks: packageState.reconciliation.checks,
          mismatches: packageState.reconciliation.checks.filter((item) => item.status === 'mismatch'),
        }),
        timestamp,
        timestamp,
      ),
    ]);

    refreshedPackageIds.push(packageRow.id);
  }

  return {
    refreshedPackageIds,
  };
}

export async function listPendingReviewRecommendations(
  env: EnvBindings,
  tenantId: string,
  accessibleFolderIds: string[] = [],
): Promise<ReviewRecommendation[]> {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT id, evidence_job_id, folder_id, target_type, target_id, title, summary, status, recommendation_json, created_at
    FROM assurance_review_recommendations
    WHERE tenant_id = ? AND status = 'pending'
    ORDER BY created_at ASC
    `,
  )
    .bind(tenantId)
    .all<ReviewRecommendationRow>();

  return rows.results
    .filter((row) => !row.folder_id || accessibleFolderIds.includes(row.folder_id))
    .map((row) => ({
      id: row.id,
      evidenceJobId: row.evidence_job_id ?? null,
      targetType: row.target_type,
      targetId: row.target_id,
      title: row.title,
      summary: row.summary,
      status: row.status,
      createdAt: row.created_at,
      recommendation: asJson<Record<string, unknown>>(row.recommendation_json, {}),
    }));
}

export async function recordReviewDecision(args: {
  env: EnvBindings;
  tenantId: string;
  userId: string | null;
  recommendationId: string;
  decision: string;
  justification: string;
  evidenceRefs: string[];
  findingRefs: string[];
  controlRefs: string[];
}): Promise<ReviewDecision> {
  const recommendation = await args.env.D1_MAIN.prepare(
    `
    SELECT id, evidence_job_id
    FROM assurance_review_recommendations
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(args.tenantId, args.recommendationId)
    .first<{ id: string; evidence_job_id: string | null }>();

  if (!recommendation) {
    throw new Error('Review recommendation not found.');
  }

  const decisionId = crypto.randomUUID();
  const createdAt = nowIso();
  await args.env.D1_MAIN.batch([
    args.env.D1_MAIN.prepare(
      `
      INSERT INTO assurance_review_decisions (
        id, tenant_id, recommendation_id, evidence_job_id, decision, justification, evidence_refs_json,
        finding_refs_json, control_refs_json, decided_by_user_id, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      decisionId,
      args.tenantId,
      args.recommendationId,
      recommendation.evidence_job_id,
      args.decision,
      args.justification,
      JSON.stringify(args.evidenceRefs),
      JSON.stringify(args.findingRefs),
      JSON.stringify(args.controlRefs),
      args.userId,
      createdAt,
    ),
    args.env.D1_MAIN.prepare(
      `UPDATE assurance_review_recommendations SET status = ?, updated_at = ? WHERE id = ?`,
    ).bind(args.decision.toLowerCase(), createdAt, args.recommendationId),
  ]);

  let refreshedPackageIds: string[] = [];
  let packageRefreshError: string | null = null;
  if (recommendation.evidence_job_id) {
    try {
      const refresh = await refreshPackageArtifactsForEvidenceJob({
        env: args.env,
        tenantId: args.tenantId,
        evidenceJobId: recommendation.evidence_job_id,
      });
      refreshedPackageIds = refresh.refreshedPackageIds;
    } catch (error) {
      packageRefreshError = error instanceof Error ? error.message : 'Package refresh failed unexpectedly.';
      console.warn('Failed to refresh package artifacts after review decision', error);
    }
  }

  return {
    id: decisionId,
    recommendationId: args.recommendationId,
    decision: args.decision,
    justification: args.justification,
    evidenceRefs: args.evidenceRefs,
    findingRefs: args.findingRefs,
    controlRefs: args.controlRefs,
    decidedByUserId: args.userId,
    createdAt,
    refreshedPackageIds,
    refreshedPackageCount: refreshedPackageIds.length,
    packageRefreshError,
  };
}

export async function loadReviewHistory(
  env: EnvBindings,
  tenantId: string,
  filters: {
    recommendationId?: string | null;
    evidenceJobId?: string | null;
  } = {},
  accessibleFolderIds: string[] = [],
): Promise<ReviewDecision[]> {
  const conditions = ['review.tenant_id = ?'];
  const bindings: unknown[] = [tenantId];

  if (filters.recommendationId) {
    conditions.push('review.recommendation_id = ?');
    bindings.push(filters.recommendationId);
  }
  if (filters.evidenceJobId) {
    conditions.push('review.evidence_job_id = ?');
    bindings.push(filters.evidenceJobId);
  }

  const rows = await env.D1_MAIN.prepare(
    `
    SELECT review.id, review.evidence_job_id, evidence_job.folder_id, review.recommendation_id, review.decision,
           review.justification, review.evidence_refs_json, review.finding_refs_json, review.control_refs_json,
           review.decided_by_user_id, review.created_at, recommendation.title AS recommendation_title,
           recommendation.target_id, recommendation.target_type
    FROM assurance_review_decisions AS review
    LEFT JOIN evidence_jobs AS evidence_job
      ON evidence_job.id = review.evidence_job_id
    LEFT JOIN assurance_review_recommendations AS recommendation
      ON recommendation.id = review.recommendation_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY review.created_at DESC
    `,
  )
    .bind(...bindings)
    .all<ReviewDecisionRow>();

  return rows.results
    .filter((row) => !row.folder_id || accessibleFolderIds.includes(row.folder_id))
    .map((row) => ({
      id: row.id,
      evidenceJobId: row.evidence_job_id ?? null,
      recommendationId: row.recommendation_id,
      recommendationTitle: normalizeString(row.recommendation_title, row.recommendation_id),
      targetId: row.target_id ?? null,
      targetType: row.target_type ?? null,
      decision: row.decision,
      justification: row.justification,
      evidenceRefs: asJson<string[]>(row.evidence_refs_json, []),
      findingRefs: asJson<string[]>(row.finding_refs_json, []),
      controlRefs: asJson<string[]>(row.control_refs_json, []),
      decidedByUserId: row.decided_by_user_id,
      createdAt: row.created_at,
    }));
}

export async function loadTrackerDiagnostics(
  env: EnvBindings,
  importJobId: string,
): Promise<TrackerDiagnosticRow[]> {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT row_index, row_key, row_status, category, owner_name, gap_type, severity, detail, control_refs_json, raw_row_json
    FROM assurance_tracker_row_diagnostics
    WHERE import_job_id = ?
    ORDER BY row_index ASC
    `,
  )
    .bind(importJobId)
    .all<TrackerDiagnosticRow>();

  return rows.results;
}

export async function createTrackerImportArtifacts(args: {
  env: EnvBindings;
  tenantId: string;
  folderId: string;
  importJobId: string;
  rows: Array<Record<string, unknown>>;
}): Promise<{
  summary: Record<string, unknown>;
  manifestKey: string;
}> {
  await args.env.D1_MAIN.prepare(`DELETE FROM assurance_tracker_row_diagnostics WHERE import_job_id = ?`).bind(args.importJobId).run();

  const diagnostics: TrackerDiagnosticRow[] = args.rows.map((row, index) => {
    const category = normalizeString(row.category, 'general');
    const status = normalizeStatus(row.status, 'open');
    const detail =
      normalizeString(row.request_text) ||
      normalizeString(row.detail) ||
      normalizeString(row.title) ||
      `Tracker row ${index + 1}`;
    const gapType = normalizeString(row.gap_type) || (status === 'closed' ? 'informational' : 'evidence_gap');
    const severity = normalizeSeverity(row.severity, status === 'closed' ? 'low' : 'moderate');
    return {
      row_index: index + 1,
      row_key: normalizeNullableString(row.id ?? row.row_id ?? row.control_id),
      row_status: status,
      category,
      owner_name: normalizeNullableString(row.owner),
      gap_type: gapType,
      severity,
      detail,
      control_refs_json: JSON.stringify(normalizeStringArray(row.controls ?? row.control_refs ?? (row.control_id ? [row.control_id] : []))),
      raw_row_json: JSON.stringify(row),
    };
  });

  const statements = diagnostics.map((item) =>
    args.env.D1_MAIN.prepare(
      `
      INSERT INTO assurance_tracker_row_diagnostics (
        id, tenant_id, folder_id, import_job_id, row_index, row_key, row_status, category, owner_name,
        gap_type, severity, detail, control_refs_json, recommendation_json, raw_row_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      crypto.randomUUID(),
      args.tenantId,
      args.folderId,
      args.importJobId,
      item.row_index,
      item.row_key,
      item.row_status,
      item.category,
      item.owner_name,
      item.gap_type,
      item.severity,
      item.detail,
      item.control_refs_json,
      JSON.stringify({
        owner: item.owner_name,
        category: item.category,
      }),
      item.raw_row_json,
      nowIso(),
      nowIso(),
    ),
  );

  if (statements.length > 0) {
    await args.env.D1_MAIN.batch(statements);
  }

  const trackerArtifactDiagnostics = diagnostics.map((item) => ({
    rowIndex: item.row_index,
    rowKey: item.row_key,
    rowStatus: item.row_status,
    category: item.category,
    ownerName: item.owner_name,
    gapType: item.gap_type,
    severity: item.severity,
    detail: item.detail,
    controlRefs: asJson<string[]>(item.control_refs_json, []),
    rawRow: asJson<Record<string, unknown>>(item.raw_row_json, {}),
  }));

  const summary = {
    rowCount: diagnostics.length,
    openRows: diagnostics.filter((item) => item.row_status !== 'closed').length,
    severityCounts: diagnostics.reduce<Record<string, number>>((counts, item) => {
      counts[item.severity ?? 'unknown'] = (counts[item.severity ?? 'unknown'] ?? 0) + 1;
      return counts;
    }, {}),
  };

  const diagnosticsKey = trackerImportArtifactKey(args.tenantId, args.importJobId, 'tracker_diagnostics');
  const gapReportKey = trackerImportArtifactKey(args.tenantId, args.importJobId, 'tracker_gap_report');
  const gapMatrixKey = trackerImportArtifactKey(args.tenantId, args.importJobId, 'tracker_gap_matrix');
  const instrumentationKey = trackerImportArtifactKey(
    args.tenantId,
    args.importJobId,
    'tracker_instrumentation_plan',
  );
  const manifestKey = trackerImportManifestKey(args.tenantId, args.importJobId);
  const manifest = {
    generatedAt: nowIso(),
    importJobId: args.importJobId,
    summary,
    artifacts: {
      tracker_diagnostics: diagnosticsKey,
      tracker_gap_report: gapReportKey,
      tracker_gap_matrix: gapMatrixKey,
      tracker_instrumentation_plan: instrumentationKey,
    },
  };

  await Promise.all([
    writeJsonArtifact(args.env, diagnosticsKey, trackerArtifactDiagnostics),
    writeTextArtifact(
      args.env,
      gapReportKey,
      buildTrackerGapReportMarkdown({
        importJobId: args.importJobId,
        diagnostics: trackerArtifactDiagnostics,
      }),
      trackerArtifactContentType('tracker_gap_report'),
    ),
    writeTextArtifact(
      args.env,
      gapMatrixKey,
      buildTrackerGapMatrixCsv(trackerArtifactDiagnostics),
      trackerArtifactContentType('tracker_gap_matrix'),
    ),
    writeTextArtifact(
      args.env,
      instrumentationKey,
      buildTrackerInstrumentationPlanMarkdown({
        importJobId: args.importJobId,
        diagnostics: trackerArtifactDiagnostics,
      }),
      trackerArtifactContentType('tracker_instrumentation_plan'),
    ),
    writeJsonArtifact(args.env, manifestKey, manifest),
  ]);

  return {
    summary,
    manifestKey,
  };
}
