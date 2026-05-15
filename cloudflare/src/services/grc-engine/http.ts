import {
  requireAnyPermission,
  requireRootAdminAccess,
  requireTenant,
} from '../../authorization';
import type { WorkerRequestContext } from '../../router';
import type { GrcQueueMessage } from '../../types/env';
import { json, methodNotAllowed, readJson } from '../../utils/http';
import {
  loadAiBackendSettings,
  resolveAiBackend,
  saveAiBackendSettings,
  type AiBackendSettings,
} from './aiBackend';
import {
  finalizeCuratedSnapshotImport,
  getCuratedImportStatus,
  importCuratedSnapshotSlice,
} from './snapshot';
import {
  canUseFixtureCollectors,
  collectNativeFindings,
  hasLiveCollectorConfiguration,
  NATIVE_COLLECTOR_PROVIDERS,
  type NativeCollectorConnector,
  type NativeCollectorSource,
} from './collectors';
import {
  expandScfControl,
  getScfStatus,
  refreshScfCrosswalks,
  resolveControlToScf,
  resolveEvaluationToScfIds,
} from './scf';
import type {
  AutomationCoverageSnapshot,
  CollectorStatus,
  ConnectorRun,
  CrosswalkResolution,
  EvidencePackage,
  ExceptionV1,
  FindingDetail,
  FindingSummary,
  FindingV1,
  FrameworkContentDocument,
  FrameworkKnowledgeDetail,
  FrameworkLibrarySummary,
  GapAssessmentDetail,
  GapAssessmentRequest,
  GapAssessmentSummary,
  GrcAdminStatus,
  GrcStatus,
  MetricV1,
  PolicyV1,
  RiskV1,
  VendorV1,
  ExecutiveReportRequest,
  GeneratedReportSnapshot,
  ReportBundle,
} from './types';

type FrameworkListRow = {
  id: string;
  slug: string;
  framework_key: string;
  name: string;
  description: string | null;
  category: string;
  version: string | null;
  tags_json: string;
  scf_framework_id: string | null;
  imported_at: string;
};

type FrameworkDetailRow = FrameworkListRow & {
  document_count: number;
};

type ContentDocumentRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  doc_kind: FrameworkContentDocument['docKind'];
  source_path: string;
  source_revision: string;
  imported_at: string;
};

type ContentRevisionRow = {
  body_markdown: string;
};

type FindingRow = {
  id: string;
  source: string;
  source_version: string;
  upstream_run_id: string;
  collected_at: string;
  resource_type: string;
  resource_id: string;
  resource_arn: string | null;
  region: string | null;
  account_id: string | null;
  raw_payload_json: string;
  evidence_refs_json: string;
  status_summary: string;
  severity_summary: string;
};

type EvaluationRow = {
  id: string;
  finding_id: string;
  control_framework: string;
  control_id: string;
  status: string;
  severity: string | null;
  title: string | null;
  message: string | null;
  remediation_summary: string | null;
  remediation_ref: string | null;
  evidence_refs_json: string;
  scf_control_ids_json: string;
};

type AssessmentRow = {
  id: string;
  title: string;
  source_scopes_json: string;
  frameworks_json: string;
  status: string;
  findings_count: number;
  gap_count: number;
  summary_json: string;
  created_at: string;
  updated_at: string;
};

type AssessmentDetailRow = {
  id: string;
  assessment_id: string;
  scf_control_id: string;
  source_framework: string;
  title: string;
  description: string | null;
  status: string;
  severity: string;
  mapped_targets_json: string;
  related_finding_ids_json: string;
  evidence_refs_json: string;
  remediation_json: string;
};

type ReportBundleRow = {
  id: string;
  assessment_id: string;
  title: string;
  status: string;
  report_family: string;
  ai_provider: string | null;
  narrative_summary: string | null;
  manifest_json: string;
  created_at: string;
  updated_at: string;
  artifact_key: string | null;
};

type IntegrationConnectorRow = {
  id: string;
  name: string;
  provider: string;
  category: string;
  auth_mode: string;
  base_url: string | null;
  status: string;
  is_enabled: number;
  config_json: string;
  capabilities_json: string;
  last_error: string | null;
  updated_at: string;
};

type ConnectorRunRow = {
  id: string;
  tenant_id: string;
  source: string;
  source_version: string;
  connector_id: string;
  action_type: string;
  status: string;
  summary_json: string | null;
  metadata_json: string | null;
  scope_json: string | null;
  started_at: string;
  finished_at: string | null;
  triggered_by_user_id: string | null;
  collected_at: string | null;
  findings_created: number | null;
};

type JobRunRow = {
  id: string;
  job_type: string;
  source_ref: string | null;
  status: string;
  request_json: string;
  result_json: string;
  diagnostics_json: string;
  artifact_key: string | null;
  created_by_user_id: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

type JobRunSummary = {
  id: string;
  jobType: string;
  sourceRef: string | null;
  status: string;
  request: Record<string, unknown>;
  result: Record<string, unknown>;
  diagnostics: unknown[];
  artifactKey: string | null;
  createdByUserId: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type EvidencePackageRow = {
  id: string;
  assessment_id: string | null;
  title: string;
  status: string;
  artifact_key: string | null;
  manifest_json: string;
  created_at: string;
  updated_at: string;
};

type ReportSnapshotRow = {
  id: string;
  report_kind: 'exec-summary' | 'board-brief' | 'program-health' | 'automation-coverage';
  title: string;
  status: string;
  ai_provider: string | null;
  source_scope_json: string;
  artifact_key: string | null;
  summary_json: string;
  content_markdown: string;
  created_at: string;
  updated_at: string;
};

type MetricCatalogRow = {
  id: string;
  metric_key: string;
  name: string;
  description: string | null;
  unit: string | null;
};

type MetricPointRow = {
  id: string;
  metric_id: string;
  measured_at: string;
  numeric_value: number;
  dimensions_json: string;
  source_ref: string | null;
};

type ExceptionSnapshotRow = {
  id: string;
  source_type: string;
  source_ref: string;
  title: string;
  status: string;
  severity: string | null;
  owner_name: string | null;
  due_date: string | null;
  raw_json: string;
};

type CountRow = {
  total_count: number;
};

type LabelCountRow = {
  label: string | null;
  total_count: number;
};

type RiskProjectionRow = {
  risk_id: string;
  title: string;
  owner_name: string | null;
  status: string | null;
  inherent_score: number | null;
  residual_score: number | null;
};

type VendorProjectionRow = {
  vendor_id: string;
  name: string;
  relationship: string | null;
  status: string | null;
  next_review_on: string | null;
};

type PolicyProjectionRow = {
  policy_id: string;
  title: string;
  status: string | null;
  updated_at: string;
};

type IncidentProjectionRow = {
  incident_id: string;
  name: string;
  status: string;
  risk_level: string | null;
  discovered_on: string;
};

type ComplianceExportProjectionRow = {
  id: string;
  family: string;
  format: string;
  title: string;
  status: string;
  created_at: string;
};

const FRAMEWORK_READ_PERMISSIONS = ['view_framework', 'add_framework', 'change_framework'];
const FRAMEWORK_WRITE_PERMISSIONS = ['add_framework', 'change_framework'];
const EVIDENCE_READ_PERMISSIONS = ['view_evidence', 'collect_evidence'];
const EVALUATION_STATUSES = new Set(['pass', 'fail', 'not_applicable', 'inconclusive', 'skipped']);
const EVALUATION_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;

function nowIso() {
  return new Date().toISOString();
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
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

function highestSeverity(values: Array<string | null | undefined>) {
  for (const severity of EVALUATION_SEVERITIES) {
    if (values.some((value) => value === severity)) {
      return severity;
    }
  }
  return 'info';
}

function summarizeStatus(values: string[]) {
  if (values.includes('fail')) {
    return 'fail';
  }
  if (values.includes('inconclusive')) {
    return 'inconclusive';
  }
  if (values.includes('pass')) {
    return 'pass';
  }
  if (values.includes('not_applicable')) {
    return 'not_applicable';
  }
  if (values.includes('skipped')) {
    return 'skipped';
  }
  return 'unknown';
}

function buildValidationErrors(finding: FindingV1): string[] {
  const errors: string[] = [];
  const required = ['schema_version', 'source', 'source_version', 'run_id', 'collected_at', 'resource', 'evaluations'] as const;
  for (const key of required) {
    if (!(key in finding)) {
      errors.push(`Missing required field "${key}".`);
    }
  }

  if (!finding.resource?.type || !finding.resource?.id) {
    errors.push('resource.type and resource.id are required.');
  }

  if (!Array.isArray(finding.evaluations) || finding.evaluations.length === 0) {
    errors.push('evaluations must be a non-empty array.');
  } else {
    for (const [index, evaluation] of finding.evaluations.entries()) {
      if (!evaluation.control_framework) {
        errors.push(`evaluations[${index}].control_framework is required.`);
      }
      if (!evaluation.control_id) {
        errors.push(`evaluations[${index}].control_id is required.`);
      }
      if (!EVALUATION_STATUSES.has(evaluation.status)) {
        errors.push(`evaluations[${index}].status "${String(evaluation.status)}" is invalid.`);
      }
      if (evaluation.severity && !EVALUATION_SEVERITIES.includes(evaluation.severity)) {
        errors.push(`evaluations[${index}].severity "${String(evaluation.severity)}" is invalid.`);
      }
      if (evaluation.status === 'fail' && !evaluation.message) {
        errors.push(`evaluations[${index}] with status=fail must include a message.`);
      }
    }
  }

  return errors;
}

const REPORT_KINDS = ['exec-summary', 'board-brief', 'program-health', 'automation-coverage'] as const;

type ReportKind = (typeof REPORT_KINDS)[number];

export function buildInternalContext(env: WorkerRequestContext['env']): WorkerRequestContext {
  const request = new Request('https://internal.regovise/_api/grc');
  const url = new URL(request.url);
  return {
    env,
    request,
    url,
    params: {},
    tenantId: null,
    userId: null,
    authStrategy: 'anonymous',
  };
}

function deterministicCollectorSourceVersion(source: string) {
  return `regovise-native-${source}-collector/v1`;
}

function buildNativeCollectorFindings(source: string): FindingV1[] {
  const collectedAt = nowIso();
  switch (normalizeToken(source)) {
    case 'github':
      return [
        {
          schema_version: '1.0.0',
          source: 'github',
          source_version: deterministicCollectorSourceVersion('github'),
          run_id: crypto.randomUUID(),
          collected_at: collectedAt,
          resource: {
            type: 'github_repository',
            id: 'regovise/platform-app',
            region: 'global',
          },
          evidence_refs: ['github://regovise/platform-app/branch-protection'],
          evaluations: [
            {
              control_framework: 'SCF',
              control_id: 'IAC-03',
              status: 'fail',
              severity: 'high',
              title: 'Default branch protection',
              message: 'The default branch does not require pull-request reviews before merge.',
              evidence_refs: ['github://regovise/platform-app/branch-protection'],
              remediation: {
                summary: 'Require pull-request reviews and status checks on the default branch.',
                ref: 'regovise://grc/github/branch-protection',
                automation: 'guided',
              },
            },
          ],
        },
      ];
    case 'wiz':
      return [
        {
          schema_version: '1.0.0',
          source: 'wiz',
          source_version: deterministicCollectorSourceVersion('wiz'),
          run_id: crypto.randomUUID(),
          collected_at: collectedAt,
          resource: {
            type: 'cloud_storage_bucket',
            id: 'regovise-public-artifacts',
            arn: 'arn:aws:s3:::regovise-public-artifacts',
            region: 'us-east-1',
            account_id: '111122223333',
          },
          evidence_refs: ['wiz://bucket/regovise-public-artifacts'],
          evaluations: [
            {
              control_framework: 'SCF',
              control_id: 'AST-04',
              status: 'fail',
              severity: 'critical',
              title: 'Public storage exposure',
              message: 'The bucket is internet-accessible and contains compliance evidence artifacts.',
              evidence_refs: ['wiz://bucket/regovise-public-artifacts'],
              remediation: {
                summary: 'Restrict public access and require scoped delivery URLs.',
                ref: 'regovise://grc/wiz/public-storage',
                automation: 'guided',
              },
            },
          ],
        },
      ];
    case 'aws':
      return [
        {
          schema_version: '1.0.0',
          source: 'aws',
          source_version: deterministicCollectorSourceVersion('aws'),
          run_id: crypto.randomUUID(),
          collected_at: collectedAt,
          resource: {
            type: 'aws_s3_bucket',
            id: 'regovise-prod-logs',
            arn: 'arn:aws:s3:::regovise-prod-logs',
            region: 'us-east-1',
            account_id: '123456789012',
          },
          evidence_refs: ['aws://s3/regovise-prod-logs/default-encryption'],
          evaluations: [
            {
              control_framework: 'SCF',
              control_id: 'CRY-05',
              status: 'fail',
              severity: 'high',
              title: 'Encryption at rest',
              message: 'Bucket default encryption is not configured.',
              evidence_refs: ['aws://s3/regovise-prod-logs/default-encryption'],
              remediation: {
                summary: 'Enable SSE-KMS on the production logging bucket.',
                ref: 'regovise://grc/aws/s3-encryption',
                automation: 'auto_fixable',
              },
            },
          ],
        },
      ];
    case 'okta':
      return [
        {
          schema_version: '1.0.0',
          source: 'okta',
          source_version: deterministicCollectorSourceVersion('okta'),
          run_id: crypto.randomUUID(),
          collected_at: collectedAt,
          resource: {
            type: 'okta_policy',
            id: 'regovise-admin-access',
            region: 'global',
          },
          evidence_refs: ['okta://policy/regovise-admin-access'],
          evaluations: [
            {
              control_framework: 'SCF',
              control_id: 'IAC-06',
              status: 'fail',
              severity: 'critical',
              title: 'Privileged MFA enforcement',
              message: 'Administrative access policy does not require phishing-resistant MFA.',
              evidence_refs: ['okta://policy/regovise-admin-access'],
              remediation: {
                summary: 'Require phishing-resistant MFA for privileged Okta access.',
                ref: 'regovise://grc/okta/admin-mfa',
                automation: 'guided',
              },
            },
          ],
        },
      ];
    default:
      return [];
  }
}

export async function createJobRun(
  env: WorkerRequestContext['env'],
  tenantId: string,
  userId: string | null,
  jobType: string,
  sourceRef: string | null,
  requestPayload: Record<string, unknown> = {},
) {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO grc_job_runs (
      id,
      tenant_id,
      job_type,
      source_ref,
      status,
      request_json,
      result_json,
      diagnostics_json,
      artifact_key,
      created_by_user_id,
      started_at,
      finished_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, 'queued', ?, '{}', '[]', NULL, ?, ?, NULL, ?, ?)
    `,
  )
    .bind(
      id,
      tenantId,
      jobType,
      sourceRef,
      JSON.stringify(requestPayload),
      userId,
      createdAt,
      createdAt,
      createdAt,
    )
    .run();
  return id;
}

export async function markJobRunRunning(
  env: WorkerRequestContext['env'],
  jobId: string,
) {
  const startedAt = nowIso();
  await env.D1_MAIN.prepare(
    `
    UPDATE grc_job_runs
    SET status = 'running',
        started_at = CASE
          WHEN status = 'queued' THEN ?
          ELSE started_at
        END,
        updated_at = ?
    WHERE id = ?
    `,
  )
    .bind(startedAt, startedAt, jobId)
    .run();
}

export async function completeJobRun(
  env: WorkerRequestContext['env'],
  jobId: string,
  resultPayload: Record<string, unknown>,
  artifactKey?: string | null,
) {
  const finishedAt = nowIso();
  await env.D1_MAIN.prepare(
    `
    UPDATE grc_job_runs
    SET status = 'completed',
        result_json = ?,
        artifact_key = ?,
        finished_at = ?,
        updated_at = ?
    WHERE id = ?
    `,
  )
    .bind(JSON.stringify(resultPayload), artifactKey ?? null, finishedAt, finishedAt, jobId)
    .run();
}

export async function failJobRun(
  env: WorkerRequestContext['env'],
  jobId: string,
  diagnostics: unknown,
) {
  const finishedAt = nowIso();
  await env.D1_MAIN.prepare(
    `
    UPDATE grc_job_runs
    SET status = 'failed',
        diagnostics_json = ?,
        finished_at = ?,
        updated_at = ?
    WHERE id = ?
    `,
  )
    .bind(JSON.stringify(Array.isArray(diagnostics) ? diagnostics : [diagnostics]), finishedAt, finishedAt, jobId)
    .run();
}

async function listRecentJobRuns(
  env: WorkerRequestContext['env'],
  tenantId: string,
  limit = 12,
) {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT id, job_type, source_ref, status, request_json, result_json, diagnostics_json, artifact_key,
           created_by_user_id, started_at, finished_at, created_at, updated_at
    FROM grc_job_runs
    WHERE tenant_id = ?
    ORDER BY created_at DESC
    LIMIT ?
    `,
  )
    .bind(tenantId, limit)
    .all<JobRunRow>();

  return rows.results.map(toJobRunSummary);
}

async function getJobRunInternal(
  env: WorkerRequestContext['env'],
  tenantId: string,
  jobId: string,
) {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT id, job_type, source_ref, status, request_json, result_json, diagnostics_json, artifact_key,
           created_by_user_id, started_at, finished_at, created_at, updated_at
    FROM grc_job_runs
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, jobId)
    .first<JobRunRow>();

  return row ? toJobRunSummary(row) : null;
}

function toJobRunSummary(row: JobRunRow): JobRunSummary {
  return {
    id: row.id,
    jobType: row.job_type,
    sourceRef: row.source_ref,
    status: row.status,
    request: asJson<Record<string, unknown>>(row.request_json, {}),
    result: asJson<Record<string, unknown>>(row.result_json, {}),
    diagnostics: asJson<unknown[]>(row.diagnostics_json, []),
    artifactKey: row.artifact_key,
    createdByUserId: row.created_by_user_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function jobEnvelope(
  job: JobRunSummary,
  extra: Record<string, unknown> = {},
) {
  return {
    jobId: job.id,
    status: job.status,
    jobType: job.jobType,
    sourceRef: job.sourceRef,
    ...extra,
  };
}

async function enqueueGrcMessage(
  env: WorkerRequestContext['env'],
  message: GrcQueueMessage,
) {
  switch (message.type) {
    case 'grc.content.import':
    case 'grc.scf.refresh':
      if (!env.QUEUE_GRC_CONTENT_IMPORT) {
        throw new Error('GRC content operations queue is not configured.');
      }
      await env.QUEUE_GRC_CONTENT_IMPORT.send(message);
      return;
    case 'grc.finding.ingest':
    case 'grc.connector.collect':
      if (!env.QUEUE_GRC_FINDING_INGEST) {
        throw new Error('GRC finding-ingest queue is not configured.');
      }
      await env.QUEUE_GRC_FINDING_INGEST.send(message);
      return;
    case 'grc.gap.report':
      if (message.reportKind && message.reportKind !== 'gap-assessment') {
        if (!env.QUEUE_GRC_CONTENT_IMPORT) {
          throw new Error('GRC content operations queue is not configured.');
        }
        await env.QUEUE_GRC_CONTENT_IMPORT.send(message);
        return;
      }
      if (!env.QUEUE_GRC_GAP_REPORT) {
        throw new Error('GRC gap-report queue is not configured.');
      }
      await env.QUEUE_GRC_GAP_REPORT.send(message);
      return;
    case 'grc.evidence.package':
      if (!env.QUEUE_GRC_GAP_REPORT) {
        throw new Error('GRC gap-report queue is not configured.');
      }
      await env.QUEUE_GRC_GAP_REPORT.send(message);
      return;
    case 'grc.ai.enrich':
      if (!env.QUEUE_GRC_AI_ENRICH) {
        throw new Error('GRC AI-enrich queue is not configured.');
      }
      await env.QUEUE_GRC_AI_ENRICH.send(message);
      return;
    default: {
      const exhaustiveCheck: never = message;
      throw new Error(`Unsupported GRC queue message: ${String(exhaustiveCheck)}`);
    }
  }
}

async function syncExceptionSnapshotsFromCanonical(
  env: WorkerRequestContext['env'],
  tenantId: string,
) {
  const now = nowIso();
  const reportRows = await env.D1_MAIN.prepare(
    `
    SELECT id, name, status, summary_json, updated_at
    FROM report_exports
    WHERE tenant_id = ? AND status = 'validation_failed'
    ORDER BY updated_at DESC
    LIMIT 20
    `,
  )
    .bind(tenantId)
    .all<{
      id: string;
      name: string;
      status: string;
      summary_json: string;
      updated_at: string;
    }>();

  for (const row of reportRows.results) {
    await env.D1_MAIN.prepare(
      `
      INSERT INTO grc_exception_snapshots (
        id,
        tenant_id,
        source_type,
        source_ref,
        title,
        status,
        severity,
        owner_name,
        due_date,
        raw_json,
        created_at,
        updated_at
      ) VALUES (?, ?, 'report_export', ?, ?, ?, 'high', 'Reports Workspace', NULL, ?, ?, ?)
      ON CONFLICT(tenant_id, source_type, source_ref) DO UPDATE SET
        title = excluded.title,
        status = excluded.status,
        severity = excluded.severity,
        owner_name = excluded.owner_name,
        raw_json = excluded.raw_json,
        updated_at = excluded.updated_at
      `,
    )
      .bind(
        await sha256(`${tenantId}:report_export:${row.id}`),
        tenantId,
        row.id,
        row.name,
        row.status,
        row.summary_json,
        row.updated_at || now,
        now,
      )
      .run();
  }
}

function connectorLabel(source: string) {
  switch (normalizeToken(source)) {
    case 'github':
      return 'GitHub';
    case 'wiz':
      return 'Wiz';
    case 'aws':
      return 'AWS';
    case 'okta':
      return 'Okta';
    default:
      return source.toUpperCase();
  }
}

function connectorCategory(source: string) {
  switch (normalizeToken(source)) {
    case 'github':
      return 'developer-security';
    case 'wiz':
    case 'aws':
      return 'cloud-security';
    case 'okta':
      return 'identity';
    default:
      return 'connector';
  }
}

async function upsertMetricPoint(
  env: WorkerRequestContext['env'],
  tenantId: string,
  input: {
    metricKey: string;
    name: string;
    value: number;
    unit?: string | null;
    measuredAt?: string;
    dimensions?: Record<string, string | number | boolean | null>;
    sourceRef?: string | null;
    description?: string | null;
  },
) {
  const metricId = await sha256(`${tenantId}:${input.metricKey}`);
  const measuredAt = input.measuredAt ?? nowIso();
  const pointId = await sha256(
    `${metricId}:${measuredAt}:${JSON.stringify(input.dimensions ?? {})}:${String(input.value)}`,
  );

  await env.D1_MAIN.prepare(
    `
    INSERT INTO grc_metric_catalog (
      id,
      tenant_id,
      metric_key,
      name,
      description,
      unit,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, metric_key) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      unit = excluded.unit,
      updated_at = excluded.updated_at
    `,
  )
    .bind(
      metricId,
      tenantId,
      input.metricKey,
      input.name,
      input.description ?? null,
      input.unit ?? null,
      measuredAt,
      measuredAt,
    )
    .run();

  await env.D1_MAIN.prepare(
    `
    INSERT OR IGNORE INTO grc_metric_points (
      id,
      tenant_id,
      metric_id,
      measured_at,
      numeric_value,
      dimensions_json,
      source_ref,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      pointId,
      tenantId,
      metricId,
      measuredAt,
      input.value,
      JSON.stringify(input.dimensions ?? {}),
      input.sourceRef ?? null,
      measuredAt,
    )
    .run();
}

async function projectRiskData(
  env: WorkerRequestContext['env'],
  tenantId: string,
): Promise<RiskV1[]> {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT
      scenario.id AS risk_id,
      scenario.title,
      register_item.name AS owner_name,
      scenario.status,
      scenario.inherent_score,
      scenario.residual_score
    FROM risk_scenarios AS scenario
    INNER JOIN risk_registers AS register_item
      ON register_item.id = scenario.register_id
    WHERE scenario.tenant_id = ?
    ORDER BY scenario.updated_at DESC
    LIMIT 20
    `,
  )
    .bind(tenantId)
    .all<RiskProjectionRow>();

  return rows.results.map((row) => ({
    schema_version: '1.0.0',
    risk_id: row.risk_id,
    title: row.title,
    owner: row.owner_name,
    status: row.status,
    inherent_score: row.inherent_score,
    residual_score: row.residual_score,
  }));
}

async function projectVendorData(
  env: WorkerRequestContext['env'],
  tenantId: string,
): Promise<VendorV1[]> {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT
      entity.id AS vendor_id,
      entity.name,
      entity.relationship,
      COALESCE(assessment.status, 'active') AS status,
      MAX(assessment.next_review_on) AS next_review_on
    FROM entities AS entity
    LEFT JOIN entity_assessments AS assessment
      ON assessment.entity_id = entity.id
     AND assessment.tenant_id = entity.tenant_id
    WHERE entity.tenant_id = ?
    GROUP BY entity.id, entity.name, entity.relationship, COALESCE(assessment.status, 'active')
    ORDER BY entity.updated_at DESC
    LIMIT 20
    `,
  )
    .bind(tenantId)
    .all<VendorProjectionRow>();

  return rows.results.map((row) => ({
    schema_version: '1.0.0',
    vendor_id: row.vendor_id,
    name: row.name,
    tier: row.relationship,
    status: row.status,
    last_review: row.next_review_on,
  }));
}

async function projectPolicyData(
  env: WorkerRequestContext['env'],
  tenantId: string,
): Promise<PolicyV1[]> {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT
      requirement.id AS policy_id,
      requirement.title,
      requirement.status,
      requirement.updated_at
    FROM ai_policy_builder_requirements AS requirement
    WHERE requirement.tenant_id = ?
    ORDER BY requirement.updated_at DESC
    LIMIT 20
    `,
  )
    .bind(tenantId)
    .all<PolicyProjectionRow>();

  return rows.results.map((row) => ({
    schema_version: '1.0.0',
    policy_id: row.policy_id,
    title: row.title,
    status: row.status,
    review_due_at: row.updated_at,
  }));
}

async function projectIncidentData(
  env: WorkerRequestContext['env'],
  tenantId: string,
): Promise<Array<Record<string, unknown>>> {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT
      id AS incident_id,
      name,
      status,
      risk_level,
      discovered_on
    FROM data_breaches
    WHERE tenant_id = ?
    ORDER BY discovered_on DESC, updated_at DESC
    LIMIT 20
    `,
  )
    .bind(tenantId)
    .all<IncidentProjectionRow>();

  return rows.results.map((row) => ({
    schema_version: '1.0.0',
    incident_id: row.incident_id,
    title: row.name,
    status: row.status,
    severity: row.risk_level,
    discovered_at: row.discovered_on,
  }));
}

async function listExceptionSnapshots(
  env: WorkerRequestContext['env'],
  tenantId: string,
): Promise<ExceptionV1[]> {
  await syncExceptionSnapshotsFromCanonical(env, tenantId);

  const rows = await env.D1_MAIN.prepare(
    `
    SELECT id, source_type, source_ref, title, status, severity, owner_name, due_date, raw_json
    FROM grc_exception_snapshots
    WHERE tenant_id = ?
    ORDER BY updated_at DESC
    LIMIT 20
    `,
  )
    .bind(tenantId)
    .all<ExceptionSnapshotRow>();

  return rows.results.map((row) => ({
    schema_version: '1.0.0',
    exception_id: row.id,
    title: row.title,
    status: row.status,
    severity: row.severity,
    owner: row.owner_name,
    due_date: row.due_date,
    source_type: row.source_type,
    source_ref: row.source_ref,
    raw: asJson<Record<string, unknown>>(row.raw_json, {}),
  }));
}

async function getConnectorRows(
  env: WorkerRequestContext['env'],
  tenantId: string,
) {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT id, name, provider, category, auth_mode, base_url, status, is_enabled, config_json, capabilities_json, last_error, updated_at
    FROM integration_connectors
    WHERE tenant_id = ?
    ORDER BY updated_at DESC
    `,
  )
    .bind(tenantId)
    .all<IntegrationConnectorRow>();
  return rows.results;
}

function toNativeCollectorConnector(row: IntegrationConnectorRow | null): NativeCollectorConnector | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    category: row.category,
    authMode: row.auth_mode,
    baseUrl: row.base_url,
    status: row.status,
    isEnabled: row.is_enabled === 1,
    config: asJson<Record<string, unknown>>(row.config_json, {}),
    capabilities: asJson<string[]>(row.capabilities_json, []),
    lastError: row.last_error,
  };
}

async function listCollectorStatuses(
  env: WorkerRequestContext['env'],
  tenantId: string,
): Promise<CollectorStatus[]> {
  const [connectorRows, runAggregates] = await Promise.all([
    getConnectorRows(env, tenantId),
    env.D1_MAIN.prepare(
      `
      SELECT
        source AS label,
        COUNT(*) AS total_count,
        MAX(CASE WHEN status = 'completed' THEN collected_at END) AS last_success_at,
        MAX(CASE WHEN status != 'completed' THEN collected_at END) AS last_failure_at,
        MAX(source_version) AS source_version
      FROM grc_connector_runs
      WHERE tenant_id = ?
      GROUP BY source
      `,
    )
      .bind(tenantId)
      .all<LabelCountRow & { last_success_at: string | null; last_failure_at: string | null; source_version: string | null }>(),
  ]);

  const runMap = new Map(
    runAggregates.results.map((row) => [
      normalizeToken(row.label ?? ''),
      {
        runCount: Number(row.total_count ?? 0),
        lastSuccessAt: row.last_success_at,
        lastFailureAt: row.last_failure_at,
        sourceVersion: row.source_version,
      },
    ]),
  );

  const connectorMap = new Map(
    connectorRows.map((row) => [normalizeToken(row.provider), row]),
  );

  return [...NATIVE_COLLECTOR_PROVIDERS].map((source) => {
    const connector = connectorMap.get(normalizeToken(source)) ?? null;
    const normalizedConnector = toNativeCollectorConnector(connector);
    const run = runMap.get(normalizeToken(source)) ?? {
      runCount: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      sourceVersion: null,
    };
    const authReady =
      normalizedConnector !== null &&
      !['error', 'disabled'].includes(normalizeToken(normalizedConnector.status)) &&
      hasLiveCollectorConfiguration(source, normalizedConnector);
    const hasFixtureRuns = run.runCount > 0 && !authReady;
    const fixtureAllowed = canUseFixtureCollectors(env);
    const sourceVersion =
      run.sourceVersion ??
      (authReady ? `${deterministicCollectorSourceVersion(source).replace('/v1', '/live-v1')}` : deterministicCollectorSourceVersion(source));

    return {
      source,
      connectorId: normalizedConnector?.id ?? null,
      label: normalizedConnector?.name ?? connectorLabel(source),
      provider: normalizedConnector?.provider ?? source,
      category: normalizedConnector?.category ?? connectorCategory(source),
      authReady,
      status: normalizedConnector?.status ?? (hasFixtureRuns ? 'fixture_ready' : 'not_configured'),
      collectionMode: authReady ? 'live' : hasFixtureRuns ? 'mixed' : 'fixture',
      lastSuccessAt: run.lastSuccessAt,
      lastFailureAt: run.lastFailureAt,
      runCount: run.runCount,
      sourceVersion,
      readyMessage: authReady
        ? 'Configured through Automation Manager and ready for live native collection.'
        : fixtureAllowed
          ? 'Live credentials are not configured yet. Local and preview environments can still validate the pipeline with fixture findings.'
          : 'Live credentials are required in production before native collection can run.',
      capabilities: normalizedConnector
        ? [...new Set([...normalizedConnector.capabilities, 'sync_findings'])]
        : ['sync_findings'],
    };
  });
}

async function listConnectorRunsInternal(
  env: WorkerRequestContext['env'],
  tenantId: string,
  source: string,
): Promise<ConnectorRun[]> {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT
      run.id,
      run.tenant_id,
      run.source,
      run.source_version,
      COALESCE(connector.id, '') AS connector_id,
      COALESCE(run.status, connector_run.status, 'completed') AS status,
      connector_run.action_type,
      connector_run.summary_json,
      run.metadata_json,
      run.scope_json,
      connector_run.started_at,
      connector_run.finished_at,
      connector_run.triggered_by_user_id,
      run.collected_at,
      COUNT(finding.id) AS findings_created
    FROM grc_connector_runs AS run
    LEFT JOIN integration_connectors AS connector
      ON connector.tenant_id = run.tenant_id
     AND LOWER(connector.provider) = LOWER(run.source)
    LEFT JOIN integration_connector_runs AS connector_run
      ON connector_run.tenant_id = run.tenant_id
     AND connector_run.connector_id = connector.id
     AND json_extract(connector_run.summary_json, '$.upstreamRunId') = run.upstream_run_id
    LEFT JOIN grc_findings AS finding
      ON finding.connector_run_id = run.id
    WHERE run.tenant_id = ?
      AND LOWER(run.source) = LOWER(?)
    GROUP BY
      run.id,
      run.tenant_id,
      run.source,
      run.source_version,
      connector.id,
      run.status,
      connector_run.status,
      connector_run.action_type,
      connector_run.summary_json,
      run.metadata_json,
      run.scope_json,
      connector_run.started_at,
      connector_run.finished_at,
      connector_run.triggered_by_user_id,
      run.collected_at
    ORDER BY COALESCE(connector_run.started_at, run.collected_at) DESC
    LIMIT 20
    `,
  )
    .bind(tenantId, source)
    .all<ConnectorRunRow>();

  return rows.results.map((row) => {
    const metadata = asJson<Record<string, unknown>>(row.metadata_json, {});
    const summary = {
      ...asJson<Record<string, unknown>>(row.summary_json, {}),
      ...metadata,
    };
    return {
      id: row.id,
      source: row.source,
      status: row.status,
      mode: (metadata.mode as ConnectorRun['mode'] | undefined) ?? (row.connector_id ? 'live' : 'fixture'),
      sourceVersion: row.source_version,
      findingsCreated: Number(row.findings_created ?? 0),
      startedAt: row.started_at ?? row.collected_at ?? nowIso(),
      finishedAt: row.finished_at ?? row.collected_at,
      triggeredByUserId: row.triggered_by_user_id,
      summary,
    };
  });
}

async function recordIntegrationConnectorRun(
  env: WorkerRequestContext['env'],
  tenantId: string,
  connectorId: string | null,
  userId: string | null,
  source: string,
  status: string,
  summary: Record<string, unknown>,
) {
  if (!connectorId) {
    return null;
  }

  const id = crypto.randomUUID();
  const startedAt = nowIso();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO integration_connector_runs (
      id,
      tenant_id,
      connector_id,
      action_type,
      status,
      summary_json,
      started_at,
      finished_at,
      triggered_by_user_id,
      run_family,
      input_mode,
      normalization_status,
      source_schema_version,
      coverage_json,
      error_summary_json
    ) VALUES (?, ?, ?, 'collect_findings', ?, ?, ?, ?, ?, 'grc_collection', ?, 'completed', ?, ?, ?)
    `,
  )
    .bind(
      id,
      tenantId,
      connectorId,
      status,
      JSON.stringify(summary),
      startedAt,
      startedAt,
      userId,
      summary.mode === 'live' ? 'live' : 'fixture',
      summary.sourceVersion ?? deterministicCollectorSourceVersion(source),
      JSON.stringify({ source, findingsCreated: summary.findingsCreated ?? 0 }),
      JSON.stringify(status === 'failed' ? summary : {}),
    )
    .run();

  await env.D1_MAIN.prepare(
    `
    UPDATE integration_connectors
    SET last_sync_json = ?,
        last_error = ?,
        updated_by_user_id = ?,
        updated_at = ?
    WHERE id = ? AND tenant_id = ?
    `,
  )
    .bind(
      JSON.stringify({
        source,
        status,
        completedAt: startedAt,
        findingsCreated: summary.findingsCreated ?? 0,
      }),
      status === 'failed' ? String(summary.error ?? 'Collection failed') : null,
      userId,
      startedAt,
      connectorId,
      tenantId,
    )
    .run();

  return id;
}

async function persistIngestPayload(
  env: WorkerRequestContext['env'],
  tenantId: string,
  userId: string | null,
  payload: unknown,
) {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO grc_ingest_payloads (
      id,
      tenant_id,
      payload_json,
      created_by_user_id,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, 'queued', ?, ?)
    `,
  )
    .bind(id, tenantId, JSON.stringify(payload), userId, createdAt, createdAt)
    .run();
  return id;
}

async function listFrameworksInternal(ctx: WorkerRequestContext): Promise<FrameworkLibrarySummary[]> {
  const rows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id, slug, framework_key, name, description, category, version, tags_json, scf_framework_id, imported_at
    FROM grc_frameworks
    ORDER BY name ASC
    `,
  ).all<FrameworkListRow>();

  const scfStatus = await getScfStatus(ctx.env);

  return Promise.all(
    rows.results.map(async (row) => {
      const documentCount = await ctx.env.D1_MAIN.prepare(
        `SELECT COUNT(*) AS total_count FROM grc_content_documents WHERE framework_id = ?`,
      )
        .bind(row.id)
        .first<CountRow>();

      const crosswalkReady =
        Boolean(row.scf_framework_id) && scfStatus.version !== null
          ? Number(
              (
                await ctx.env.D1_MAIN.prepare(
                  `SELECT COUNT(*) AS total_count FROM grc_scf_crosswalks WHERE framework_id = ?`,
                )
                  .bind(row.scf_framework_id)
                  .first<CountRow>()
              )?.total_count ?? 0,
            ) > 0
          : false;

      return {
        id: row.id,
        slug: row.slug,
        frameworkKey: row.framework_key,
        name: row.name,
        description: row.description,
        version: row.version,
        category: row.category,
        tags: asJson<string[]>(row.tags_json, []),
        scfFrameworkId: row.scf_framework_id,
        crosswalkReady,
        documentCount: Number(documentCount?.total_count ?? 0),
        updatedAt: row.imported_at,
      };
    }),
  );
}

async function getFrameworkByToken(ctx: WorkerRequestContext, token: string): Promise<FrameworkKnowledgeDetail | null> {
  const rows = await listFrameworksInternal(ctx);
  const framework =
    rows.find((row) =>
      [row.id, row.slug, row.frameworkKey, row.name, row.scfFrameworkId ?? '']
        .map((candidate) => normalizeToken(candidate))
        .includes(normalizeToken(token)),
    ) ?? null;

  if (!framework) {
    return null;
  }

  const documentRows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id, slug, title, summary, doc_kind, source_path, source_revision, imported_at
    FROM grc_content_documents
    WHERE framework_id = ?
    ORDER BY
      CASE doc_kind
        WHEN 'overview' THEN 0
        WHEN 'assessment-guide' THEN 1
        WHEN 'evidence-checklist' THEN 2
        WHEN 'implementation-guidance' THEN 3
        ELSE 10
      END,
      title ASC
    `,
  )
    .bind(framework.id)
    .all<ContentDocumentRow>();

  return {
    ...framework,
    documents: documentRows.results.map((document) => ({
      id: document.id,
      slug: document.slug,
      title: document.title,
      summary: document.summary,
      docKind: document.doc_kind,
      sourcePath: document.source_path,
      sourceRevision: document.source_revision,
      importedAt: document.imported_at,
    })),
  };
}

async function getFrameworkContentDocument(
  ctx: WorkerRequestContext,
  frameworkToken: string,
  slug: string,
): Promise<FrameworkContentDocument | null> {
  const framework = await getFrameworkByToken(ctx, frameworkToken);
  if (!framework) {
    return null;
  }

  const document = framework.documents.find((item) => item.slug === slug);
  if (!document) {
    return null;
  }

  const revision = await ctx.env.D1_MAIN.prepare(
    `
    SELECT body_markdown
    FROM grc_content_revisions
    WHERE document_id = ?
    ORDER BY created_at DESC
    LIMIT 1
    `,
  )
    .bind(document.id)
    .first<ContentRevisionRow>();

  return {
    ...document,
    bodyMarkdown: revision?.body_markdown ?? '',
  };
}

async function listFindingRows(ctx: WorkerRequestContext, tenantId: string) {
  const findingRows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id, source, source_version, upstream_run_id, collected_at, resource_type, resource_id, resource_arn,
           region, account_id, raw_payload_json, evidence_refs_json, status_summary, severity_summary
    FROM grc_findings
    WHERE tenant_id = ?
    ORDER BY collected_at DESC, id DESC
    `,
  )
    .bind(tenantId)
    .all<FindingRow>();

  if (findingRows.results.length === 0) {
    return { findings: [], evaluationsByFindingId: new Map<string, EvaluationRow[]>() };
  }

  const ids = findingRows.results.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(', ');
  const evaluationRows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id, finding_id, control_framework, control_id, status, severity, title, message,
           remediation_summary, remediation_ref, evidence_refs_json, scf_control_ids_json
    FROM grc_finding_evaluations
    WHERE finding_id IN (${placeholders})
    ORDER BY finding_id ASC
    `,
  )
    .bind(...ids)
    .all<EvaluationRow>();

  const evaluationsByFindingId = new Map<string, EvaluationRow[]>();
  for (const row of evaluationRows.results) {
    const items = evaluationsByFindingId.get(row.finding_id) ?? [];
    items.push(row);
    evaluationsByFindingId.set(row.finding_id, items);
  }

  return {
    findings: findingRows.results,
    evaluationsByFindingId,
  };
}

function summarizeFinding(row: FindingRow, evaluations: EvaluationRow[]): FindingSummary {
  const scfMatchCount = new Set(
    evaluations.flatMap((evaluation) => asJson<string[]>(evaluation.scf_control_ids_json, [])),
  ).size;
  const evidenceRefCount =
    asJson<string[]>(row.evidence_refs_json, []).length +
    evaluations.reduce((total, evaluation) => total + asJson<string[]>(evaluation.evidence_refs_json, []).length, 0);

  return {
    id: row.id,
    source: row.source,
    sourceVersion: row.source_version,
    upstreamRunId: row.upstream_run_id,
    collectedAt: row.collected_at,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    region: row.region,
    accountId: row.account_id,
    statusSummary: row.status_summary,
    severitySummary: row.severity_summary,
    evaluationCount: evaluations.length,
    scfMatchCount,
    evidenceRefCount,
  };
}

function buildFindingDetail(
  row: FindingRow,
  evaluations: EvaluationRow[],
  includeRawPayload: boolean,
): FindingDetail {
  return {
    ...summarizeFinding(row, evaluations),
    resourceArn: row.resource_arn,
    evidenceRefs: asJson<string[]>(row.evidence_refs_json, []),
    rawPayloadJson: includeRawPayload ? asJson<Record<string, unknown>>(row.raw_payload_json, {}) : null,
    evaluations: evaluations.map((evaluation) => ({
      id: evaluation.id,
      controlFramework: evaluation.control_framework,
      controlId: evaluation.control_id,
      status: evaluation.status,
      severity: evaluation.severity,
      title: evaluation.title,
      message: evaluation.message,
      remediationSummary: evaluation.remediation_summary,
      remediationRef: evaluation.remediation_ref,
      evidenceRefs: asJson<string[]>(evaluation.evidence_refs_json, []),
      scfControlIds: asJson<string[]>(evaluation.scf_control_ids_json, []),
    })),
  };
}

type IngestFindingOptions = {
  scope?: Record<string, unknown>;
  metadata?: Record<string, unknown> | ((finding: FindingV1) => Record<string, unknown>);
  persistPayload?: boolean;
};

type IngestFindingResult = {
  insertedFindings: number;
  connectorRuns: number;
  findingIds: string[];
  payloadId: string | null;
};

function parseIncomingFindings(
  payload: unknown,
):
  | { ok: true; findings: FindingV1[] }
  | { ok: false; response: Response } {
  const incoming =
    Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && Array.isArray((payload as Record<string, unknown>).findings)
        ? ((payload as Record<string, unknown>).findings as unknown[])
        : [payload];

  const findings = incoming as FindingV1[];
  const validationErrors: Array<{ index: number; errors: string[] }> = [];

  for (const [index, finding] of findings.entries()) {
    validationErrors.push({
      index,
      errors: buildValidationErrors(finding),
    });
  }

  const invalidEntries = validationErrors.filter((entry) => entry.errors.length > 0);
  if (invalidEntries.length > 0) {
    return {
      ok: false,
      response: json(
        {
          error: 'invalid_findings',
          message: 'One or more finding payloads failed validation.',
          details: invalidEntries,
        },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true,
    findings,
  };
}

export async function ingestFindingsCore(
  ctx: WorkerRequestContext,
  tenantId: string,
  userId: string,
  payload: unknown,
  options: IngestFindingOptions = {},
): Promise<
  | { ok: false; response: Response }
  | { ok: true; result: IngestFindingResult }
> {
  const parsed = parseIncomingFindings(payload);
  if (!parsed.ok) {
    return parsed;
  }

  const { findings } = parsed;

  const payloadId =
    options.persistPayload === false
      ? null
      : await persistIngestPayload(
          ctx.env,
          tenantId,
          userId,
          payload,
        );

  return ingestPreparedFindings(ctx, tenantId, userId, findings, payloadId, options);
}

async function ingestPreparedFindings(
  ctx: WorkerRequestContext,
  tenantId: string,
  userId: string,
  findings: FindingV1[],
  payloadId: string | null,
  options: IngestFindingOptions = {},
): Promise<
  | { ok: false; response: Response }
  | { ok: true; result: IngestFindingResult }
> {
  let insertedFindings = 0;
  const findingIds: string[] = [];
  const sourceCounts = new Map<string, number>();

  for (const finding of findings) {
    const connectorRunId = await sha256(`${tenantId}:${finding.source}:${finding.run_id}`);
    const findingId = await sha256(
      `${tenantId}:${finding.source}:${finding.run_id}:${finding.resource.type}:${finding.resource.id}`,
    );
    const now = nowIso();
    const runMetadata =
      typeof options.metadata === 'function' ? options.metadata(finding) : options.metadata ?? {};

    await ctx.env.D1_MAIN.prepare(
      `
      INSERT INTO grc_connector_runs (
        id,
        tenant_id,
        source,
        source_version,
        upstream_run_id,
        status,
        scope_json,
        metadata_json,
        created_by_user_id,
        collected_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source_version = excluded.source_version,
        scope_json = excluded.scope_json,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at,
        collected_at = excluded.collected_at
      `,
    )
      .bind(
        connectorRunId,
        tenantId,
        finding.source,
        finding.source_version,
        finding.run_id,
        JSON.stringify(options.scope ?? {}),
        JSON.stringify({
          ...runMetadata,
          payloadId,
        }),
        userId,
        finding.collected_at,
        now,
        now,
      )
      .run();

    const evaluationStatuses = finding.evaluations.map((evaluation) => evaluation.status);
    const evaluationSeverities = finding.evaluations.map((evaluation) => evaluation.severity ?? null);

    await ctx.env.D1_MAIN.prepare(
      `
      INSERT INTO grc_findings (
        id,
        tenant_id,
        connector_run_id,
        source,
        source_version,
        upstream_run_id,
        collected_at,
        resource_type,
        resource_id,
        resource_arn,
        region,
        account_id,
        raw_payload_json,
        evidence_refs_json,
        status_summary,
        severity_summary,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source_version = excluded.source_version,
        collected_at = excluded.collected_at,
        raw_payload_json = excluded.raw_payload_json,
        evidence_refs_json = excluded.evidence_refs_json,
        status_summary = excluded.status_summary,
        severity_summary = excluded.severity_summary,
        updated_at = excluded.updated_at
      `,
    )
      .bind(
        findingId,
        tenantId,
        connectorRunId,
        finding.source,
        finding.source_version,
        finding.run_id,
        finding.collected_at,
        finding.resource.type,
        finding.resource.id,
        finding.resource.arn ?? null,
        finding.resource.region ?? null,
        finding.resource.account_id ?? null,
        JSON.stringify(finding),
        JSON.stringify(finding.evidence_refs ?? []),
        summarizeStatus(evaluationStatuses),
        highestSeverity(evaluationSeverities),
        now,
        now,
      )
      .run();

    for (const [index, evaluation] of finding.evaluations.entries()) {
      const evaluationId = await sha256(`${findingId}:${index}:${evaluation.control_framework}:${evaluation.control_id}`);
      const scfControlIds = await resolveEvaluationToScfIds(
        ctx.env,
        evaluation.control_framework,
        evaluation.control_id,
      ).catch(() => []);

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO grc_finding_evaluations (
          id,
          tenant_id,
          finding_id,
          control_framework,
          control_id,
          status,
          severity,
          title,
          message,
          remediation_summary,
          remediation_ref,
          evidence_refs_json,
          scf_control_ids_json,
          raw_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          severity = excluded.severity,
          title = excluded.title,
          message = excluded.message,
          remediation_summary = excluded.remediation_summary,
          remediation_ref = excluded.remediation_ref,
          evidence_refs_json = excluded.evidence_refs_json,
          scf_control_ids_json = excluded.scf_control_ids_json,
          raw_json = excluded.raw_json,
          updated_at = excluded.updated_at
        `,
      )
        .bind(
          evaluationId,
          tenantId,
          findingId,
          evaluation.control_framework,
          evaluation.control_id,
          evaluation.status,
          evaluation.severity ?? null,
          evaluation.title ?? null,
          evaluation.message ?? null,
          evaluation.remediation?.summary ?? null,
          evaluation.remediation?.ref ?? null,
          JSON.stringify(evaluation.evidence_refs ?? []),
          JSON.stringify(scfControlIds),
          JSON.stringify(evaluation),
          now,
          now,
        )
        .run();
    }

    insertedFindings += 1;
    findingIds.push(findingId);
    sourceCounts.set(finding.source, (sourceCounts.get(finding.source) ?? 0) + 1);
  }

  const measuredAt = nowIso();
  for (const [source, count] of sourceCounts.entries()) {
    await upsertMetricPoint(ctx.env, tenantId, {
      metricKey: `collector-${normalizeToken(source)}-findings`,
      name: `${connectorLabel(source)} findings collected`,
      description: 'Normalized finding count produced by the native ingest pipeline.',
      measuredAt,
      value: count,
      unit: 'findings',
      dimensions: {
        source,
        ingestionMode: 'normalized',
      },
      sourceRef: payloadId,
    });
  }

  return {
    ok: true,
    result: {
      insertedFindings,
      connectorRuns: [...new Set(findings.map((finding) => `${finding.source}:${finding.run_id}`))].length,
      findingIds,
      payloadId,
    },
  };
}

async function ingestFindings(
  ctx: WorkerRequestContext,
  tenantId: string,
  userId: string,
  payload: unknown,
  options: IngestFindingOptions = {},
) {
  const result = await ingestFindingsCore(ctx, tenantId, userId, payload, options);
  if (!result.ok) {
    return result.response;
  }

  return json({
    data: {
      insertedFindings: result.result.insertedFindings,
      connectorRuns: result.result.connectorRuns,
      payloadId: result.result.payloadId,
      findingIds: result.result.findingIds,
    },
  });
}

async function createGapAssessment(
  ctx: WorkerRequestContext,
  tenantId: string,
  userId: string,
  input: GapAssessmentRequest,
) {
  const { findings, evaluationsByFindingId } = await listFindingRows(ctx, tenantId);
  const sources = new Set((input.sources ?? []).map((value) => value.trim()).filter(Boolean));
  const severities = new Set((input.severities ?? []).map((value) => value.trim()).filter(Boolean));
  const statuses = new Set((input.statuses ?? []).map((value) => value.trim()).filter(Boolean));

  const filteredFindings = findings.filter((row) => {
    if (sources.size > 0 && !sources.has(row.source)) {
      return false;
    }
    if (severities.size > 0 && !severities.has(row.severity_summary)) {
      return false;
    }
    if (statuses.size > 0 && !statuses.has(row.status_summary)) {
      return false;
    }
    return true;
  });

  const grouped = new Map<
    string,
    {
      sourceFramework: string;
      title: string;
      description: string | null;
      statuses: string[];
      severities: Array<string | null>;
      mappedTargets: Array<{ frameworkId: string; frameworkName: string; controlIds: string[] }>;
      relatedFindingIds: Set<string>;
      evidenceRefs: Set<string>;
      remediationSummaries: Set<string>;
      remediationRefs: Set<string>;
    }
  >();

  for (const finding of filteredFindings) {
    const evaluations = evaluationsByFindingId.get(finding.id) ?? [];
    for (const evaluation of evaluations) {
      const scfControlIds = asJson<string[]>(evaluation.scf_control_ids_json, []);
      for (const scfControlId of scfControlIds) {
        const mappedTargets = await expandScfControl(ctx.env, scfControlId, input.frameworks);
        if (mappedTargets.length === 0) {
          continue;
        }

        const current = grouped.get(scfControlId) ?? {
          sourceFramework: evaluation.control_framework,
          title: evaluation.title ?? scfControlId,
          description: evaluation.message ?? null,
          statuses: [],
          severities: [],
          mappedTargets: [],
          relatedFindingIds: new Set<string>(),
          evidenceRefs: new Set<string>(),
          remediationSummaries: new Set<string>(),
          remediationRefs: new Set<string>(),
        };

        current.statuses.push(evaluation.status);
        current.severities.push(evaluation.severity);
        current.relatedFindingIds.add(finding.id);
        for (const ref of asJson<string[]>(finding.evidence_refs_json, [])) {
          current.evidenceRefs.add(ref);
        }
        for (const ref of asJson<string[]>(evaluation.evidence_refs_json, [])) {
          current.evidenceRefs.add(ref);
        }
        if (evaluation.remediation_summary) {
          current.remediationSummaries.add(evaluation.remediation_summary);
        }
        if (evaluation.remediation_ref) {
          current.remediationRefs.add(evaluation.remediation_ref);
        }

        const targetMap = new Map(current.mappedTargets.map((target) => [target.frameworkId, target]));
        for (const target of mappedTargets) {
          const existing = targetMap.get(target.frameworkId) ?? {
            frameworkId: target.frameworkId,
            frameworkName: target.frameworkName,
            controlIds: [],
          };
          existing.controlIds = [...new Set([...existing.controlIds, ...target.controlIds])].sort((left, right) =>
            left.localeCompare(right),
          );
          targetMap.set(target.frameworkId, existing);
        }
        current.mappedTargets = [...targetMap.values()].sort((left, right) =>
          left.frameworkName.localeCompare(right.frameworkName),
        );

        grouped.set(scfControlId, current);
      }
    }
  }

  const assessmentId = await sha256(`${tenantId}:${JSON.stringify(input.frameworks)}:${JSON.stringify(input.sources ?? [])}:${Date.now()}`);
  const createdAt = nowIso();
  const rows = [...grouped.entries()].map(([scfControlId, item]) => ({
    scfControlId,
    sourceFramework: item.sourceFramework,
    title: item.title,
    description: item.description,
    status: summarizeStatus(item.statuses),
    severity: highestSeverity(item.severities),
    mappedTargets: item.mappedTargets,
    relatedFindingIds: [...item.relatedFindingIds],
    evidenceRefs: [...item.evidenceRefs],
    remediation: {
      summaries: [...item.remediationSummaries],
      refs: [...item.remediationRefs],
    },
  }));

  const summary = {
    statusBuckets: rows.reduce<Record<string, number>>((accumulator, row) => {
      accumulator[row.status] = (accumulator[row.status] ?? 0) + 1;
      return accumulator;
    }, {}),
    severityBuckets: rows.reduce<Record<string, number>>((accumulator, row) => {
      accumulator[row.severity] = (accumulator[row.severity] ?? 0) + 1;
      return accumulator;
    }, {}),
    sourceCount: sources.size > 0 ? sources.size : new Set(filteredFindings.map((row) => row.source)).size,
    aiNarrativeAvailable: false,
  };

  await ctx.env.D1_MAIN.prepare(
    `
    INSERT INTO grc_gap_assessments (
      id,
      tenant_id,
      title,
      source_scopes_json,
      frameworks_json,
      status,
      findings_count,
      gap_count,
      summary_json,
      created_by_user_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, 'ready', ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      assessmentId,
      tenantId,
      input.title?.trim() || `Gap assessment for ${input.frameworks.join(', ')}`,
      JSON.stringify([...sources]),
      JSON.stringify(input.frameworks),
      filteredFindings.length,
      rows.length,
      JSON.stringify(summary),
      userId,
      createdAt,
      createdAt,
    )
    .run();

  for (const row of rows) {
    const rowId = await sha256(`${assessmentId}:${row.scfControlId}`);
    await ctx.env.D1_MAIN.prepare(
      `
      INSERT INTO grc_gap_assessment_rows (
        id,
        assessment_id,
        tenant_id,
        scf_control_id,
        source_framework,
        title,
        description,
        status,
        severity,
        mapped_targets_json,
        related_finding_ids_json,
        evidence_refs_json,
        remediation_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        rowId,
        assessmentId,
        tenantId,
        row.scfControlId,
        row.sourceFramework,
        row.title,
        row.description,
        row.status,
        row.severity,
        JSON.stringify(row.mappedTargets),
        JSON.stringify(row.relatedFindingIds),
        JSON.stringify(row.evidenceRefs),
        JSON.stringify(row.remediation),
        createdAt,
        createdAt,
      )
      .run();
  }

  return assessmentId;
}

async function listAssessmentsInternal(ctx: WorkerRequestContext, tenantId: string): Promise<GapAssessmentSummary[]> {
  const rows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id, title, source_scopes_json, frameworks_json, status, findings_count, gap_count, summary_json, created_at, updated_at
    FROM grc_gap_assessments
    WHERE tenant_id = ?
    ORDER BY created_at DESC
    `,
  )
    .bind(tenantId)
    .all<AssessmentRow>();

  return rows.results.map((row) => ({
    id: row.id,
    title: row.title,
    frameworks: asJson<string[]>(row.frameworks_json, []),
    sources: asJson<string[]>(row.source_scopes_json, []),
    status: row.status,
    findingsCount: Number(row.findings_count),
    gapCount: Number(row.gap_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

async function listReportBundlesInternal(ctx: WorkerRequestContext, tenantId: string, assessmentId?: string): Promise<ReportBundle[]> {
  const rows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id, assessment_id, title, status, report_family, ai_provider, narrative_summary, manifest_json, created_at, updated_at, artifact_key
    FROM grc_report_bundles
    WHERE tenant_id = ?
      ${assessmentId ? 'AND assessment_id = ?' : ''}
    ORDER BY created_at DESC
    `,
  )
    .bind(...(assessmentId ? [tenantId, assessmentId] : [tenantId]))
    .all<ReportBundleRow>();

  return rows.results.map((row) => ({
    id: row.id,
    assessmentId: row.assessment_id,
    title: row.title,
    status: row.status,
    reportFamily: row.report_family,
    aiProvider: row.ai_provider,
    narrativeSummary: row.narrative_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    manifest: asJson<Record<string, unknown>>(row.manifest_json, {}),
    downloadPath: `/_api/grc/report-bundles/${row.id}?download=1`,
  }));
}

async function getAssessmentDetail(
  ctx: WorkerRequestContext,
  tenantId: string,
  assessmentId: string,
): Promise<GapAssessmentDetail | null> {
  const assessment = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id, title, source_scopes_json, frameworks_json, status, findings_count, gap_count, summary_json, created_at, updated_at
    FROM grc_gap_assessments
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, assessmentId)
    .first<AssessmentRow>();

  if (!assessment) {
    return null;
  }

  const rows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id, assessment_id, scf_control_id, source_framework, title, description, status, severity,
           mapped_targets_json, related_finding_ids_json, evidence_refs_json, remediation_json
    FROM grc_gap_assessment_rows
    WHERE assessment_id = ?
    ORDER BY severity ASC, title ASC
    `,
  )
    .bind(assessmentId)
    .all<AssessmentDetailRow>();

  return {
    id: assessment.id,
    title: assessment.title,
    frameworks: asJson<string[]>(assessment.frameworks_json, []),
    sources: asJson<string[]>(assessment.source_scopes_json, []),
    status: assessment.status,
    findingsCount: Number(assessment.findings_count),
    gapCount: Number(assessment.gap_count),
    createdAt: assessment.created_at,
    updatedAt: assessment.updated_at,
    summary: asJson<GapAssessmentDetail['summary']>(assessment.summary_json, {
      statusBuckets: {},
      severityBuckets: {},
      sourceCount: 0,
      aiNarrativeAvailable: false,
    }),
    rows: rows.results.map((row) => ({
      id: row.id,
      scfControlId: row.scf_control_id,
      sourceFramework: row.source_framework,
      title: row.title,
      description: row.description,
      status: row.status,
      severity: row.severity,
      mappedTargets: asJson<GapAssessmentDetail['rows'][number]['mappedTargets']>(row.mapped_targets_json, []),
      relatedFindingIds: asJson<string[]>(row.related_finding_ids_json, []),
      evidenceRefs: asJson<string[]>(row.evidence_refs_json, []),
      remediation: asJson<Record<string, unknown>>(row.remediation_json, {}),
    })),
    evidencePackages: await listEvidencePackagesInternal(ctx, tenantId, assessmentId),
    reportBundles: await listReportBundlesInternal(ctx, tenantId, assessmentId),
    reportSnapshots: await listReportSnapshotsInternal(ctx, tenantId, assessmentId),
  };
}

function deterministicNarrative(detail: GapAssessmentDetail) {
  const topSeverities = Object.entries(detail.summary.severityBuckets)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([severity, count]) => `${count} ${severity}`)
    .join(', ');
  return `Regovise identified ${detail.gapCount} mapped gaps across ${detail.frameworks.join(', ')} from ${detail.findingsCount} normalized finding record(s). The dominant severities are ${topSeverities || 'not available'} and the package focuses on framework-mapped remediation opportunities.`;
}

export async function createReportBundle(
  ctx: WorkerRequestContext,
  tenantId: string,
  userId: string,
  assessmentId: string,
): Promise<ReportBundle | null> {
  const detail = await getAssessmentDetail(ctx, tenantId, assessmentId);
  if (!detail) {
    return null;
  }

  const aiBackend = await resolveAiBackend(ctx.env, tenantId);
  const [generatedSummary, remediationPlan] = await Promise.all([
    aiBackend.summarizeFindings({
      audience: 'ciso',
      assessment: {
        id: detail.id,
        title: detail.title,
        frameworks: detail.frameworks,
        findingsCount: detail.findingsCount,
        gapCount: detail.gapCount,
        severityBuckets: detail.summary.severityBuckets,
      },
      topGaps: detail.rows.slice(0, 10).map((row) => ({
        scfControlId: row.scfControlId,
        title: row.title,
        severity: row.severity,
        status: row.status,
      })),
    }),
    aiBackend.proposeRemediation({
      frameworks: detail.frameworks,
      findings: detail.rows.slice(0, 8).map((row) => ({
        scfControlId: row.scfControlId,
        title: row.title,
        severity: row.severity,
        remediation: row.remediation,
      })),
    }),
  ]);

  const bundleId = await sha256(`${tenantId}:${assessmentId}:${Date.now()}:bundle`);
  const createdAt = nowIso();
  const manifest = {
    assessmentId,
    frameworks: detail.frameworks,
    sources: detail.sources,
    generatedAt: createdAt,
    provider: aiBackend.provider,
    executiveSummary: generatedSummary?.markdown ?? deterministicNarrative(detail),
    remediationHighlights:
      remediationPlan?.quickWins ??
      detail.rows.slice(0, 5).map((row) => `${row.scfControlId}: ${row.title}`).filter(Boolean),
    rows: detail.rows,
    connectedSurfaces: {
      reports: '/reports',
      complianceExports: '/compliance-exports',
      assurance: '/assurance',
    },
  };

  const artifactKey = `grc-report-bundles/${tenantId}/${bundleId}/manifest.json`;
  await ctx.env.R2_EVIDENCE.put(artifactKey, JSON.stringify(manifest, null, 2), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });

  await ctx.env.D1_MAIN.prepare(
    `
    INSERT INTO grc_report_bundles (
      id,
      tenant_id,
      assessment_id,
      title,
      status,
      report_family,
      artifact_key,
      ai_provider,
      narrative_summary,
      manifest_json,
      created_by_user_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, 'ready', 'gap-assessment', ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      bundleId,
      tenantId,
      assessmentId,
      `${detail.title} report bundle`,
      artifactKey,
      aiBackend.provider,
      String(manifest.executiveSummary),
      JSON.stringify(manifest),
      userId,
      createdAt,
      createdAt,
    )
    .run();

  return {
    id: bundleId,
    assessmentId,
    title: `${detail.title} report bundle`,
    status: 'ready',
    reportFamily: 'gap-assessment',
    aiProvider: aiBackend.provider,
    narrativeSummary: String(manifest.executiveSummary),
    createdAt,
    updatedAt: createdAt,
    manifest,
    downloadPath: `/_api/grc/report-bundles/${bundleId}?download=1`,
  };
}

async function listEvidencePackagesInternal(
  ctx: WorkerRequestContext,
  tenantId: string,
  assessmentId?: string,
): Promise<EvidencePackage[]> {
  const rows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id, assessment_id, title, status, artifact_key, manifest_json, created_at, updated_at
    FROM grc_evidence_packages
    WHERE tenant_id = ?
      ${assessmentId ? 'AND assessment_id = ?' : ''}
    ORDER BY created_at DESC
    `,
  )
    .bind(...(assessmentId ? [tenantId, assessmentId] : [tenantId]))
    .all<EvidencePackageRow>();

  return rows.results.map((row) => ({
    id: row.id,
    assessmentId: row.assessment_id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    manifest: asJson<Record<string, unknown>>(row.manifest_json, {}),
    downloadPath: `/_api/grc/evidence-packages/${row.id}?download=1`,
  }));
}

export async function createEvidencePackage(
  ctx: WorkerRequestContext,
  tenantId: string,
  userId: string,
  assessmentId: string,
) {
  const detail = await getAssessmentDetail(ctx, tenantId, assessmentId);
  if (!detail) {
    return null;
  }

  const { findings, evaluationsByFindingId } = await listFindingRows(ctx, tenantId);
  const findingMap = new Map(findings.map((finding) => [finding.id, finding]));

  const packageId = await sha256(`${tenantId}:${assessmentId}:${Date.now()}:evidence-package`);
  const createdAt = nowIso();
  const includedFindingIds = [...new Set(detail.rows.flatMap((row) => row.relatedFindingIds))];
  const includedFindings = includedFindingIds
    .map((findingId) => {
      const row = findingMap.get(findingId);
      if (!row) {
        return null;
      }
      return buildFindingDetail(row, evaluationsByFindingId.get(row.id) ?? [], true);
    })
    .filter((item): item is FindingDetail => item !== null);

  const evidenceRefCount = new Set(
    detail.rows.flatMap((row) => row.evidenceRefs).concat(includedFindings.flatMap((finding) => finding.evidenceRefs)),
  ).size;

  const manifest = {
    assessmentId,
    generatedAt: createdAt,
    title: `${detail.title} evidence package`,
    frameworkTargets: detail.frameworks,
    scfControls: detail.rows.map((row) => row.scfControlId),
    evidenceRefCount,
    findings: includedFindings,
    proofChain: detail.rows.map((row) => ({
      scfControlId: row.scfControlId,
      evidenceRefs: row.evidenceRefs,
      relatedFindingIds: row.relatedFindingIds,
      remediation: row.remediation,
    })),
    connectedSurfaces: {
      assurance: '/assurance',
      reports: '/reports',
      complianceExports: '/compliance-exports',
      portal: '/portal',
    },
  };

  const artifactKey = `grc-evidence-raw/${tenantId}/${packageId}/manifest.json`;
  await ctx.env.R2_EVIDENCE.put(artifactKey, JSON.stringify(manifest, null, 2), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });

  await ctx.env.D1_MAIN.prepare(
    `
    INSERT INTO grc_evidence_packages (
      id,
      tenant_id,
      assessment_id,
      title,
      status,
      artifact_key,
      manifest_json,
      created_by_user_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, 'ready', ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      packageId,
      tenantId,
      assessmentId,
      `${detail.title} evidence package`,
      artifactKey,
      JSON.stringify(manifest),
      userId,
      createdAt,
      createdAt,
    )
    .run();

  await upsertMetricPoint(ctx.env, tenantId, {
    metricKey: 'evidence-packages-created',
    name: 'Evidence packages created',
    description: 'Generated evidence-package manifests linked to GRC assessments.',
    measuredAt: createdAt,
    value: 1,
    unit: 'packages',
    dimensions: {
      frameworkCount: detail.frameworks.length,
      findingCount: includedFindings.length,
    },
    sourceRef: packageId,
  });

  return {
    id: packageId,
    assessmentId,
    title: `${detail.title} evidence package`,
    status: 'ready',
    createdAt,
    updatedAt: createdAt,
    manifest,
    downloadPath: `/_api/grc/evidence-packages/${packageId}?download=1`,
  } satisfies EvidencePackage;
}

async function listReportSnapshotsInternal(
  ctx: WorkerRequestContext,
  tenantId: string,
  assessmentId?: string,
): Promise<GeneratedReportSnapshot[]> {
  const rows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id, report_kind, title, status, ai_provider, source_scope_json, artifact_key, summary_json, content_markdown, created_at, updated_at
    FROM grc_report_snapshots
    WHERE tenant_id = ?
      ${assessmentId ? "AND json_extract(source_scope_json, '$.assessmentId') = ?" : ''}
    ORDER BY created_at DESC
    `,
  )
    .bind(...(assessmentId ? [tenantId, assessmentId] : [tenantId]))
    .all<ReportSnapshotRow>();

  return rows.results.map((row) => ({
    id: row.id,
    reportKind: row.report_kind,
    title: row.title,
    status: row.status,
    aiProvider: row.ai_provider,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    summary: asJson<Record<string, unknown>>(row.summary_json, {}),
    contentMarkdown: row.content_markdown,
    downloadPath: `/_api/grc/report-snapshots/${row.id}?download=1`,
  }));
}

async function buildControlMappingSnapshot(
  ctx: WorkerRequestContext,
  tenantId: string,
  framework: string,
  controlId: string,
) {
  const resolution = await resolveControlToScf(ctx.env, framework, controlId);
  const placeholders = resolution.scfControls.map(() => '?').join(', ');
  let findingMatchCount = 0;
  if (placeholders.length > 0) {
    const row = await ctx.env.D1_MAIN.prepare(
      `
      SELECT COUNT(DISTINCT finding_id) AS total_count
      FROM grc_finding_evaluations
      WHERE tenant_id = ?
        AND scf_control_ids_json IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM json_each(grc_finding_evaluations.scf_control_ids_json)
          WHERE json_each.value IN (${placeholders})
        )
      `,
    )
      .bind(tenantId, ...resolution.scfControls.map((item) => item.controlId))
      .first<CountRow>();
    findingMatchCount = Number(row?.total_count ?? 0);
  }

  return {
    ...resolution,
    findingMatchCount,
  };
}

async function detectControlConflicts(
  ctx: WorkerRequestContext,
  tenantId: string,
  assessmentId: string | undefined,
  frameworks: string[] | undefined,
) {
  const detail =
    assessmentId !== undefined
      ? await getAssessmentDetail(ctx, tenantId, assessmentId)
      : null;

  const rows =
    detail?.rows ??
    (await createGapAssessment(
      ctx,
      tenantId,
      ctx.userId ?? 'system',
      {
        title: 'Temporary control conflict analysis',
        frameworks: frameworks && frameworks.length > 0 ? frameworks : ['soc2', 'fedramp-rev5'],
      },
    )
      .then((createdAssessmentId) => getAssessmentDetail(ctx, tenantId, createdAssessmentId)))?.rows ??
    [];

  const conflicts = rows
    .filter((row) => row.mappedTargets.length > 1)
    .map((row) => ({
      scfControlId: row.scfControlId,
      title: row.title,
      severity: row.severity,
      status: row.status,
      targetFrameworks: row.mappedTargets.map((item) => item.frameworkName),
      conflictingControls: row.mappedTargets.flatMap((item) =>
        item.controlIds.map((controlId) => ({
          frameworkId: item.frameworkId,
          frameworkName: item.frameworkName,
          controlId,
        })),
      ),
      resolutionHint:
        row.status === 'fail'
          ? 'Address the failing SCF-aligned control once, then revalidate all mapped targets.'
          : 'Target frameworks align without a material conflict for this mapped control.',
    }));

  return {
    totalConflicts: conflicts.length,
    conflicts,
  };
}

async function optimizeControls(
  ctx: WorkerRequestContext,
  tenantId: string,
  frameworks: string[] | undefined,
) {
  const detail = await createGapAssessment(ctx, tenantId, ctx.userId ?? 'system', {
    title: 'Temporary optimization analysis',
    frameworks: frameworks && frameworks.length > 0 ? frameworks : ['soc2', 'fedramp-rev5'],
  }).then((assessmentId) => getAssessmentDetail(ctx, tenantId, assessmentId));

  if (!detail) {
    return {
      clusters: [],
      remediationThemes: [],
    };
  }

  const aiBackend = await resolveAiBackend(ctx.env, tenantId);
  const mappings = await aiBackend.mapControls({
    frameworkTargets: detail.frameworks,
    scfControls: detail.rows.map((row) => row.scfControlId),
    findings: detail.rows.map((row) => ({
      scfControlId: row.scfControlId,
      title: row.title,
      severity: row.severity,
      mappedTargets: row.mappedTargets,
    })),
  });
  const remediation = await aiBackend.proposeRemediation({
    frameworks: detail.frameworks,
    findings: detail.rows.slice(0, 8).map((row) => ({
      scfControlId: row.scfControlId,
      title: row.title,
      severity: row.severity,
      remediation: row.remediation,
    })),
  });

  return {
    provider: aiBackend.provider,
    clusters: mappings?.clusters ?? [],
    remediationThemes: remediation?.themes ?? [],
    quickWins: remediation?.quickWins ?? [],
  };
}

async function buildProgramHealthSummary(
  ctx: WorkerRequestContext,
  tenantId: string,
) {
  const [risks, vendors, policies, incidents, exceptions, reportExports, reportBundles] = await Promise.all([
    projectRiskData(ctx.env, tenantId),
    projectVendorData(ctx.env, tenantId),
    projectPolicyData(ctx.env, tenantId),
    projectIncidentData(ctx.env, tenantId),
    listExceptionSnapshots(ctx.env, tenantId),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT COUNT(*) AS total_count
      FROM report_exports
      WHERE tenant_id = ?
      `,
    )
      .bind(tenantId)
      .first<CountRow>(),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT COUNT(*) AS total_count
      FROM grc_report_bundles
      WHERE tenant_id = ?
      `,
    )
      .bind(tenantId)
      .first<CountRow>(),
  ]);

  return {
    risks,
    vendors,
    policies,
    incidents,
    exceptions,
    totals: {
      risks: risks.length,
      vendors: vendors.length,
      policies: policies.length,
      incidents: incidents.length,
      openExceptions: exceptions.filter((item) => !['closed', 'resolved'].includes(normalizeToken(item.status))).length,
      reportExports: Number(reportExports?.total_count ?? 0),
      reportBundles: Number(reportBundles?.total_count ?? 0),
    },
  };
}

async function buildAutomationCoverageSummary(
  ctx: WorkerRequestContext,
  tenantId: string,
) {
  const connectorStatuses = await listCollectorStatuses(ctx.env, tenantId);
  const enabled = connectorStatuses.filter((item) => item.authReady).length;
  const ready = connectorStatuses.filter((item) => item.runCount > 0 || item.authReady).length;
  const coveragePercent =
    connectorStatuses.length === 0 ? 0 : Math.round((ready / connectorStatuses.length) * 100);

  const measuredAt = nowIso();
  await upsertMetricPoint(ctx.env, tenantId, {
    metricKey: 'automation-coverage-percent',
    name: 'Automation coverage',
    description: 'Percent of prioritized native collectors that are configured or have completed validation runs.',
    measuredAt,
    value: coveragePercent,
    unit: 'percent',
    dimensions: {
      enabled,
      ready,
      total: connectorStatuses.length,
    },
    sourceRef: 'grc-automation-coverage',
  });

  return {
    id: await sha256(`${tenantId}:automation-coverage:${measuredAt}`),
    measuredAt,
    metricKey: 'automation-coverage-percent',
    name: 'Automation coverage',
    value: coveragePercent,
    unit: 'percent',
    dimensions: {
      enabled,
      ready,
      total: connectorStatuses.length,
    },
    sourceRef: 'grc-automation-coverage',
    connectors: connectorStatuses,
  } satisfies AutomationCoverageSnapshot & { connectors: CollectorStatus[] };
}

export async function createExecutiveReport(
  ctx: WorkerRequestContext,
  tenantId: string,
  userId: string,
  reportKind: ReportKind,
  input: ExecutiveReportRequest,
) {
  const assessmentId = input.assessmentId?.trim() || null;
  const aiBackend = await resolveAiBackend(ctx.env, tenantId);
  const createdAt = nowIso();
  const reportId = await sha256(`${tenantId}:${reportKind}:${assessmentId ?? 'tenant'}:${Date.now()}`);

  let title = input.title?.trim() || '';
  let summary: Record<string, unknown> = {};
  let contentMarkdown = '';

  if (reportKind === 'exec-summary' || reportKind === 'board-brief') {
    if (!assessmentId) {
      return json(
        { error: 'bad_request', message: 'assessmentId is required for executive narrative reports.' },
        { status: 400 },
      );
    }
    const detail = await getAssessmentDetail(ctx, tenantId, assessmentId);
    if (!detail) {
      return json({ error: 'not_found', message: 'Gap assessment not found.' }, { status: 404 });
    }

    const narrative = await aiBackend.summarizeFindings({
      audience: input.audience ?? (reportKind === 'board-brief' ? 'board' : 'ciso'),
      assessment: {
        id: detail.id,
        title: detail.title,
        frameworks: detail.frameworks,
        findingsCount: detail.findingsCount,
        gapCount: detail.gapCount,
        severityBuckets: detail.summary.severityBuckets,
      },
      topGaps: detail.rows.slice(0, 6).map((row) => ({
        scfControlId: row.scfControlId,
        title: row.title,
        severity: row.severity,
        status: row.status,
      })),
    });

    title ||= reportKind === 'board-brief' ? `${detail.title} board brief` : `${detail.title} executive summary`;
    summary = {
      assessmentId,
      frameworks: detail.frameworks,
      findingsCount: detail.findingsCount,
      gapCount: detail.gapCount,
      audience: input.audience ?? (reportKind === 'board-brief' ? 'board' : 'ciso'),
    };
    contentMarkdown = narrative?.markdown ?? deterministicNarrative(detail);
  } else if (reportKind === 'program-health') {
    const program = await buildProgramHealthSummary(ctx, tenantId);
    const narrative = await aiBackend.generateText({
      systemPrompt:
        'You summarize GRC program health for operational leadership. Use concise markdown with sections for posture, hotspots, and next steps.',
      userPrompt: JSON.stringify(program),
      maxTokens: 900,
    });
    title ||= 'Program health snapshot';
    summary = program.totals;
    contentMarkdown =
      narrative ??
      `# Program health\n\n- Risks tracked: ${program.totals.risks}\n- Vendors in scope: ${program.totals.vendors}\n- Policies tracked: ${program.totals.policies}\n- Incidents tracked: ${program.totals.incidents}\n- Open exceptions: ${program.totals.openExceptions}`;
  } else {
    const coverage = await buildAutomationCoverageSummary(ctx, tenantId);
    const narrative = await aiBackend.generateText({
      systemPrompt:
        'You summarize automation coverage for a compliance operations audience. Use short markdown bullets and cite the most important gaps.',
      userPrompt: JSON.stringify(coverage),
      maxTokens: 700,
    });
    title ||= 'Automation coverage snapshot';
    summary = {
      metricKey: coverage.metricKey,
      measuredAt: coverage.measuredAt,
      value: coverage.value,
      dimensions: coverage.dimensions,
    };
    contentMarkdown =
      narrative ??
      `# Automation coverage\n\nCurrent coverage is ${coverage.value}${coverage.unit === 'percent' ? '%' : ''} across ${coverage.dimensions.total} prioritized native collectors.`;
  }

  const artifact = {
    id: reportId,
    reportKind,
    title,
    createdAt,
    summary,
    contentMarkdown,
    aiProvider: aiBackend.provider,
    sourceScope: {
      assessmentId,
      audience: input.audience ?? null,
    },
  };
  const artifactKey = `grc-report-bundles/${tenantId}/${reportId}/${reportKind}.json`;
  await ctx.env.R2_EVIDENCE.put(artifactKey, JSON.stringify(artifact, null, 2), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });

  await ctx.env.D1_MAIN.prepare(
    `
    INSERT INTO grc_report_snapshots (
      id,
      tenant_id,
      report_kind,
      title,
      status,
      ai_provider,
      source_scope_json,
      artifact_key,
      summary_json,
      content_markdown,
      created_by_user_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, 'ready', ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      reportId,
      tenantId,
      reportKind,
      title,
      aiBackend.provider,
      JSON.stringify({
        assessmentId,
        audience: input.audience ?? null,
      }),
      artifactKey,
      JSON.stringify(summary),
      contentMarkdown,
      userId,
      createdAt,
      createdAt,
    )
    .run();

  return {
    id: reportId,
    reportKind,
    title,
    status: 'ready',
    aiProvider: aiBackend.provider,
    createdAt,
    updatedAt: createdAt,
    summary,
    contentMarkdown,
    downloadPath: `/_api/grc/report-snapshots/${reportId}?download=1`,
  } satisfies GeneratedReportSnapshot;
}

async function getGrcStatus(ctx: WorkerRequestContext, tenantId: string): Promise<GrcStatus> {
  const [importStatus, scfStatus, findingsCount, assessmentsCount, reportBundleCount, evidencePackageCount, metricPointCount, connectors, recentJobs] =
    await Promise.all([
      getCuratedImportStatus(ctx.env),
      getScfStatus(ctx.env),
      ctx.env.D1_MAIN.prepare(`SELECT COUNT(*) AS total_count FROM grc_findings WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
      ctx.env.D1_MAIN.prepare(`SELECT COUNT(*) AS total_count FROM grc_gap_assessments WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
      ctx.env.D1_MAIN.prepare(`SELECT COUNT(*) AS total_count FROM grc_report_bundles WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
      ctx.env.D1_MAIN.prepare(`SELECT COUNT(*) AS total_count FROM grc_evidence_packages WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
      ctx.env.D1_MAIN.prepare(`SELECT COUNT(*) AS total_count FROM grc_metric_points WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
      listCollectorStatuses(ctx.env, tenantId),
      listRecentJobRuns(ctx.env, tenantId),
    ]);

  const exceptions = await listExceptionSnapshots(ctx.env, tenantId);

  return {
    latestSnapshot: importStatus.latestSnapshot,
    scfVersion: scfStatus.version,
    findings: Number(findingsCount?.total_count ?? 0),
    assessments: Number(assessmentsCount?.total_count ?? 0),
    reportBundles: Number(reportBundleCount?.total_count ?? 0),
    evidencePackages: Number(evidencePackageCount?.total_count ?? 0),
    openExceptions: exceptions.filter((item) => !['closed', 'resolved'].includes(normalizeToken(item.status))).length,
    metricPoints: Number(metricPointCount?.total_count ?? 0),
    connectors,
    recentJobs,
  };
}

export async function runGrcNativeCollector(
  env: WorkerRequestContext['env'],
  tenantId: string,
  userId: string,
  source: string,
  jobId?: string | null,
) {
  const ctx = buildInternalContext(env);
  ctx.tenantId = tenantId;
  ctx.userId = userId;
  ctx.authStrategy = 'headers';

  const collectorStatuses = await listCollectorStatuses(env, tenantId);
  const collector = collectorStatuses.find((item) => normalizeToken(item.source) === normalizeToken(source));
  if (!collector) {
    throw new Error(`Unsupported collector source: ${source}`);
  }

  const connectorRow = (await getConnectorRows(env, tenantId)).find(
    (item) => normalizeToken(item.provider) === normalizeToken(source),
  ) ?? null;
  const collectorConfig = toNativeCollectorConnector(connectorRow);
  const result = await collectNativeFindings(env, normalizeToken(source) as NativeCollectorSource, collectorConfig);
  const ingested = await ingestFindingsCore(
    ctx,
    tenantId,
    userId,
    { findings: result.findings },
    {
      scope: {
        source,
        collector: 'regovise-native',
      },
      metadata: {
        mode: result.mode,
        sourceVersion: result.sourceVersion,
        provider: collector.provider,
        connectorId: collector.connectorId,
        diagnostics: result.diagnostics,
      },
    },
  );

  if (!ingested.ok) {
    const text = await ingested.response.text();
    throw new Error(text || `Collector ingest failed for ${source}.`);
  }

  const runSummary = {
    source,
    mode: result.mode,
    sourceVersion: result.sourceVersion,
    findingsCreated: ingested.result.insertedFindings,
    connectorRuns: ingested.result.connectorRuns,
    jobId: jobId ?? null,
    upstreamRunId: result.upstreamRunId,
    diagnostics: result.diagnostics,
  };

  await recordIntegrationConnectorRun(env, tenantId, collector.connectorId, userId, source, 'completed', runSummary);
  return {
    collector: (await listCollectorStatuses(env, tenantId)).find(
      (item) => normalizeToken(item.source) === normalizeToken(source),
    ),
    run: runSummary,
  };
}

async function getAdminStatus(ctx: WorkerRequestContext, tenantId: string): Promise<GrcAdminStatus> {
  const [importStatus, scfStatus, settings, status, connectorStatuses, recentJobs] = await Promise.all([
    getCuratedImportStatus(ctx.env),
    getScfStatus(ctx.env),
    loadAiBackendSettings(ctx.env, tenantId),
    getGrcStatus(ctx, tenantId),
    listCollectorStatuses(ctx.env, tenantId),
    listRecentJobRuns(ctx.env, tenantId),
  ]);

  return {
    latestSnapshot: importStatus.latestSnapshot,
    frameworkCount: importStatus.frameworkCount,
    documentCount: importStatus.documentCount,
    scfVersion: scfStatus.version,
    scfFrameworkCount: scfStatus.frameworkCount,
    status: {
      findings: status.findings,
      assessments: status.assessments,
      reportBundles: status.reportBundles,
      evidencePackages: status.evidencePackages,
      openExceptions: status.openExceptions,
      metricPoints: status.metricPoints,
      recentJobs: status.recentJobs.length,
    },
    connectors: connectorStatuses,
    recentJobs,
    settings,
  };
}

export async function handleGrcRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const [resource, id, subresource] = segments;

  if (resource === 'admin') {
    if (id === 'settings') {
      const admin = await requireRootAdminAccess(
        ctx,
        'Tenant administrator access is required for GRC administration operations.',
      );
      if (admin instanceof Response) {
        return admin;
      }

      if (ctx.request.method === 'GET') {
        return json({
          data: await getAdminStatus(ctx, admin.tenantId),
        });
      }

      if (ctx.request.method === 'PUT') {
        const body = await readJson<AiBackendSettings>(ctx.request);
        const settings = await saveAiBackendSettings(ctx.env, admin.tenantId, admin.userId, {
          defaultProvider: body.defaultProvider === 'openai-responses' ? 'openai-responses' : 'cloudflare-workers-ai',
          openaiEnabled: Boolean(body.openaiEnabled),
          openaiModel: body.openaiModel?.trim() || null,
        });
        return json({ data: settings });
      }

      return methodNotAllowed(['GET', 'PUT']);
    }

    if (id === 'import-snapshot') {
      if (ctx.request.method !== 'POST') {
        return methodNotAllowed(['POST']);
      }
      const admin = await requireRootAdminAccess(
        ctx,
        'Tenant administrator access is required for GRC administration operations.',
      );
      if (admin instanceof Response) {
        return admin;
      }
      const body = await readJson<Record<string, unknown>>(ctx.request);
      const jobId = await createJobRun(ctx.env, admin.tenantId, admin.userId, 'content-import', 'curated-snapshot', body);
      const job = await getJobRunInternal(ctx.env, admin.tenantId, jobId);
      if (!job) {
        return json({ error: 'internal_error', message: 'Unable to create the snapshot import job.' }, { status: 500 });
      }
      await enqueueGrcMessage(ctx.env, {
        type: 'grc.content.import',
        tenantId: admin.tenantId,
        requestedBy: admin.userId,
        jobId,
      });
      return json({ data: jobEnvelope(job) }, { status: 202 });
    }

    if (id === 'scf' && subresource === 'refresh') {
      if (ctx.request.method !== 'POST') {
        return methodNotAllowed(['POST']);
      }
      const admin = await requireRootAdminAccess(
        ctx,
        'Tenant administrator access is required for GRC administration operations.',
      );
      if (admin instanceof Response) {
        return admin;
      }
      const body = await readJson<{ frameworkIds?: string[] }>(ctx.request);
      const jobId = await createJobRun(ctx.env, admin.tenantId, admin.userId, 'scf-refresh', 'scf', {
        frameworkIds: body.frameworkIds ?? [],
      });
      const job = await getJobRunInternal(ctx.env, admin.tenantId, jobId);
      if (!job) {
        return json({ error: 'internal_error', message: 'Unable to create the SCF refresh job.' }, { status: 500 });
      }
      await enqueueGrcMessage(ctx.env, {
        type: 'grc.scf.refresh',
        tenantId: admin.tenantId,
        requestedBy: admin.userId,
        frameworkIds: body.frameworkIds ?? [],
        jobId,
      });
      return json({ data: jobEnvelope(job) }, { status: 202 });
    }

    return json({ error: 'not_found' }, { status: 404 });
  }

  const permissionContext = await requireAnyPermission(
    ctx,
    FRAMEWORK_READ_PERMISSIONS,
    'Framework library access requires framework-view permissions.',
  );
  if (permissionContext instanceof Response) {
    return permissionContext;
  }
  const tenantId = requireTenant(ctx);
  if (tenantId instanceof Response) {
    return tenantId;
  }

  if (!resource) {
    return json({
      data: {
        frameworks: await listFrameworksInternal(ctx),
        findings: (await listFindingRows(ctx, tenantId)).findings.length,
        assessments: (await listAssessmentsInternal(ctx, tenantId)).length,
        reportBundles: (await listReportBundlesInternal(ctx, tenantId)).length,
      },
    });
  }

  if (resource === 'status') {
    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    return json({ data: await getGrcStatus(ctx, tenantId) });
  }

  if (resource === 'connectors') {
    if (!id) {
      if (ctx.request.method !== 'GET') {
        return methodNotAllowed(['GET']);
      }
      return json({ data: await listCollectorStatuses(ctx.env, tenantId) });
    }

    if (subresource === 'runs') {
      if (ctx.request.method !== 'GET') {
        return methodNotAllowed(['GET']);
      }
      return json({ data: await listConnectorRunsInternal(ctx.env, tenantId, id) });
    }

    if (subresource === 'collect') {
      if (ctx.request.method !== 'POST') {
        return methodNotAllowed(['POST']);
      }
      const writePermissions = await requireAnyPermission(
        ctx,
        FRAMEWORK_WRITE_PERMISSIONS,
        'Native collection requires framework management permissions.',
      );
      if (writePermissions instanceof Response) {
        return writePermissions;
      }

      if (!NATIVE_COLLECTOR_PROVIDERS.includes(normalizeToken(id) as NativeCollectorSource)) {
        return json({ error: 'not_found', message: 'This source is not a supported native collector.' }, { status: 404 });
      }

      const collectorStatuses = await listCollectorStatuses(ctx.env, tenantId);
      const collector = collectorStatuses.find((item) => normalizeToken(item.source) === normalizeToken(id));
      if (!collector) {
        return json({ error: 'not_found', message: 'Collector source not recognized.' }, { status: 404 });
      }
      if (ctx.env.APP_ENV === 'production' && !collector.authReady) {
        return json(
          {
            error: 'collector_not_ready',
            message: `${collector.label} requires valid live credentials before native collection can run in production.`,
          },
          { status: 412 },
        );
      }

      const jobId = await createJobRun(ctx.env, tenantId, writePermissions.userId, 'connector-collect', id, {
        source: id,
        mode: collector.collectionMode,
      });
      const job = await getJobRunInternal(ctx.env, tenantId, jobId);
      if (!job) {
        return json({ error: 'internal_error', message: 'Unable to create the collection job.' }, { status: 500 });
      }
      await enqueueGrcMessage(ctx.env, {
        type: 'grc.connector.collect',
        tenantId,
        source: id,
        requestedBy: writePermissions.userId,
        jobId,
      });
      return json(
        {
          data: {
            ...jobEnvelope(job, {
              collector: (await listCollectorStatuses(ctx.env, tenantId)).find(
                (item) => normalizeToken(item.source) === normalizeToken(id),
              ),
            }),
          },
        },
        { status: 202 },
      );
    }

    return json({ error: 'not_found' }, { status: 404 });
  }

  if (resource === 'frameworks') {
    if (!id) {
      if (ctx.request.method !== 'GET') {
        return methodNotAllowed(['GET']);
      }
      return json({ data: await listFrameworksInternal(ctx) });
    }

    if (subresource === 'content') {
      if (ctx.request.method !== 'GET' || !segments[3]) {
        return methodNotAllowed(['GET']);
      }
      const document = await getFrameworkContentDocument(ctx, id, segments[3]);
      if (!document) {
        return json({ error: 'not_found' }, { status: 404 });
      }
      return json({ data: document });
    }

    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    const framework = await getFrameworkByToken(ctx, id);
    if (!framework) {
      return json({ error: 'not_found' }, { status: 404 });
    }
    return json({ data: framework });
  }

  if (resource === 'findings') {
    if (ctx.request.method === 'POST' && (!id || id === 'ingest')) {
      const writePermissions = await requireAnyPermission(
        ctx,
        FRAMEWORK_WRITE_PERMISSIONS,
        'Finding ingestion requires framework management permissions.',
      );
      if (writePermissions instanceof Response) {
        return writePermissions;
      }
      const payload = await readJson(ctx.request);
      const parsed = parseIncomingFindings(payload);
      if (!parsed.ok) {
        return parsed.response;
      }
      const payloadId = await persistIngestPayload(ctx.env, writePermissions.tenantId, writePermissions.userId, payload);
      const jobId = await createJobRun(ctx.env, writePermissions.tenantId, writePermissions.userId, 'finding-ingest', payloadId, {
        payloadId,
        findingCount: parsed.findings.length,
      });
      const job = await getJobRunInternal(ctx.env, writePermissions.tenantId, jobId);
      if (!job) {
        return json({ error: 'internal_error', message: 'Unable to create the finding-ingest job.' }, { status: 500 });
      }
      await enqueueGrcMessage(ctx.env, {
        type: 'grc.finding.ingest',
        tenantId: writePermissions.tenantId,
        requestedBy: writePermissions.userId,
        payloadId,
        jobId,
      });
      return json({ data: jobEnvelope(job, { payloadId }) }, { status: 202 });
    }

    const { findings, evaluationsByFindingId } = await listFindingRows(ctx, tenantId);
    const canViewEvidence = permissionContext.permissions.some((permission) => EVIDENCE_READ_PERMISSIONS.includes(permission));

    if (!id) {
      if (ctx.request.method !== 'GET') {
        return methodNotAllowed(['GET', 'POST']);
      }
      const url = new URL(ctx.request.url);
      const sourceFilter = new Set((url.searchParams.get('source') ?? '').split(',').map((item) => item.trim()).filter(Boolean));
      const severityFilter = new Set((url.searchParams.get('severity') ?? '').split(',').map((item) => item.trim()).filter(Boolean));
      const statusFilter = new Set((url.searchParams.get('status') ?? '').split(',').map((item) => item.trim()).filter(Boolean));
      const frameworkFilter = (url.searchParams.get('framework') ?? '').trim();

      let items = findings.map((row) => summarizeFinding(row, evaluationsByFindingId.get(row.id) ?? []));
      if (sourceFilter.size > 0) {
        items = items.filter((item) => sourceFilter.has(item.source));
      }
      if (severityFilter.size > 0) {
        items = items.filter((item) => severityFilter.has(item.severitySummary));
      }
      if (statusFilter.size > 0) {
        items = items.filter((item) => statusFilter.has(item.statusSummary));
      }
      if (frameworkFilter) {
        const normalized = normalizeToken(frameworkFilter);
        items = items.filter((item) => {
          const evaluations = evaluationsByFindingId.get(item.id) ?? [];
          return evaluations.some((evaluation) =>
            normalizeToken(evaluation.control_framework) === normalized ||
            asJson<string[]>(evaluation.scf_control_ids_json, []).length > 0,
          );
        });
      }
      return json({ data: items });
    }

    if (id === 'ingest' && ctx.request.method === 'GET') {
      return methodNotAllowed(['POST']);
    }

    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    const row = findings.find((item) => item.id === id);
    if (!row) {
      return json({ error: 'not_found' }, { status: 404 });
    }
    return json({
      data: buildFindingDetail(row, evaluationsByFindingId.get(row.id) ?? [], canViewEvidence),
    });
  }

  if (resource === 'crosswalk') {
    if (id === 'resolve' && ctx.request.method === 'GET') {
      const url = new URL(ctx.request.url);
      const framework = url.searchParams.get('framework') ?? '';
      const controlId = url.searchParams.get('controlId') ?? '';
      if (!framework || !controlId) {
        return json({ error: 'bad_request', message: 'framework and controlId are required.' }, { status: 400 });
      }
      return json({ data: await resolveControlToScf(ctx.env, framework, controlId) });
    }

    if (id === 'expand' && ctx.request.method === 'POST') {
      const body = await readJson<{ scfControlId?: string; targets?: string[] }>(ctx.request);
      if (!body.scfControlId) {
        return json({ error: 'bad_request', message: 'scfControlId is required.' }, { status: 400 });
      }
      return json({
        data: await expandScfControl(ctx.env, body.scfControlId, body.targets),
      });
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'controls') {
    if (id === 'map' && ctx.request.method === 'GET') {
      const url = new URL(ctx.request.url);
      const framework = url.searchParams.get('framework') ?? '';
      const controlId = url.searchParams.get('controlId') ?? '';
      if (!framework || !controlId) {
        return json({ error: 'bad_request', message: 'framework and controlId are required.' }, { status: 400 });
      }
      return json({ data: await buildControlMappingSnapshot(ctx, tenantId, framework, controlId) });
    }

    if (id === 'conflicts' && ctx.request.method === 'POST') {
      const writePermissions = await requireAnyPermission(
        ctx,
        FRAMEWORK_WRITE_PERMISSIONS,
        'Control conflict analysis requires framework management permissions.',
      );
      if (writePermissions instanceof Response) {
        return writePermissions;
      }
      const body = await readJson<{ assessmentId?: string; frameworks?: string[] }>(ctx.request);
      return json({
        data: await detectControlConflicts(ctx, tenantId, body.assessmentId?.trim() || undefined, body.frameworks),
      });
    }

    if (id === 'optimize' && ctx.request.method === 'POST') {
      const writePermissions = await requireAnyPermission(
        ctx,
        FRAMEWORK_WRITE_PERMISSIONS,
        'Control optimization requires framework management permissions.',
      );
      if (writePermissions instanceof Response) {
        return writePermissions;
      }
      const body = await readJson<{ frameworks?: string[] }>(ctx.request);
      return json({
        data: await optimizeControls(ctx, tenantId, body.frameworks),
      });
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'assessments') {
    if (!id && ctx.request.method === 'GET') {
      return json({ data: await listAssessmentsInternal(ctx, tenantId) });
    }

    if (!id && ctx.request.method === 'POST') {
      const writePermissions = await requireAnyPermission(
        ctx,
        FRAMEWORK_WRITE_PERMISSIONS,
        'Gap assessments require framework management permissions.',
      );
      if (writePermissions instanceof Response) {
        return writePermissions;
      }
      const body = await readJson<GapAssessmentRequest>(ctx.request);
      if (!Array.isArray(body.frameworks) || body.frameworks.length === 0) {
        return json({ error: 'bad_request', message: 'At least one framework is required.' }, { status: 400 });
      }
      const assessmentId = await createGapAssessment(ctx, writePermissions.tenantId, writePermissions.userId, body);
      return json({ data: await getAssessmentDetail(ctx, writePermissions.tenantId, assessmentId) });
    }

    if (id && !subresource && ctx.request.method === 'GET') {
      const detail = await getAssessmentDetail(ctx, tenantId, id);
      if (!detail) {
        return json({ error: 'not_found' }, { status: 404 });
      }
      return json({ data: detail });
    }

    if (id && subresource === 'report' && ctx.request.method === 'POST') {
      const writePermissions = await requireAnyPermission(
        ctx,
        FRAMEWORK_WRITE_PERMISSIONS,
        'Report generation requires framework management permissions.',
      );
      if (writePermissions instanceof Response) {
        return writePermissions;
      }
      const detail = await getAssessmentDetail(ctx, writePermissions.tenantId, id);
      if (!detail) {
        return json({ error: 'not_found' }, { status: 404 });
      }
      const jobId = await createJobRun(ctx.env, writePermissions.tenantId, writePermissions.userId, 'gap-report', id, {
        assessmentId: id,
      });
      const job = await getJobRunInternal(ctx.env, writePermissions.tenantId, jobId);
      if (!job) {
        return json({ error: 'internal_error', message: 'Unable to create the report-bundle job.' }, { status: 500 });
      }
      await enqueueGrcMessage(ctx.env, {
        type: 'grc.gap.report',
        tenantId: writePermissions.tenantId,
        assessmentId: id,
        requestedBy: writePermissions.userId,
        reportKind: 'gap-assessment',
        jobId,
      });
      return json({ data: jobEnvelope(job, { assessmentId: detail.id }) }, { status: 202 });
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'report-bundles') {
    if (!id && ctx.request.method === 'GET') {
      const url = new URL(ctx.request.url);
      const assessmentId = url.searchParams.get('assessmentId') ?? undefined;
      return json({ data: await listReportBundlesInternal(ctx, tenantId, assessmentId) });
    }

    if (!id || ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    const bundles = await listReportBundlesInternal(ctx, tenantId);
    const bundle = bundles.find((item) => item.id === id);
    if (!bundle) {
      return json({ error: 'not_found' }, { status: 404 });
    }

    const url = new URL(ctx.request.url);
    if (url.searchParams.get('download') === '1') {
      const headers = new Headers();
      headers.set('content-type', 'application/json; charset=utf-8');
      headers.set('content-disposition', `attachment; filename="${bundle.id}.json"`);
      return new Response(JSON.stringify(bundle.manifest, null, 2), { status: 200, headers });
    }

    return json({ data: bundle });
  }

  if (resource === 'evidence-packages') {
    if (!id && ctx.request.method === 'POST') {
      const writePermissions = await requireAnyPermission(
        ctx,
        FRAMEWORK_WRITE_PERMISSIONS,
        'Evidence package generation requires framework management permissions.',
      );
      if (writePermissions instanceof Response) {
        return writePermissions;
      }
      const body = await readJson<{ assessmentId?: string }>(ctx.request);
      const assessmentId = body.assessmentId?.trim() ?? '';
      if (!assessmentId) {
        return json({ error: 'bad_request', message: 'assessmentId is required.' }, { status: 400 });
      }
      const detail = await getAssessmentDetail(ctx, tenantId, assessmentId);
      if (!detail) {
        return json({ error: 'not_found' }, { status: 404 });
      }
      const jobId = await createJobRun(ctx.env, tenantId, writePermissions.userId, 'evidence-package', assessmentId, {
        assessmentId,
      });
      const job = await getJobRunInternal(ctx.env, tenantId, jobId);
      if (!job) {
        return json({ error: 'internal_error', message: 'Unable to create the evidence-package job.' }, { status: 500 });
      }
      await enqueueGrcMessage(ctx.env, {
        type: 'grc.evidence.package',
        tenantId,
        assessmentId,
        requestedBy: writePermissions.userId,
        jobId,
      });
      return json({ data: jobEnvelope(job, { assessmentId: detail.id }) }, { status: 202 });
    }

    if (!id || ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET', 'POST']);
    }

    const packages = await listEvidencePackagesInternal(ctx, tenantId);
    const evidencePackage = packages.find((item) => item.id === id);
    if (!evidencePackage) {
      return json({ error: 'not_found' }, { status: 404 });
    }

    const url = new URL(ctx.request.url);
    if (url.searchParams.get('download') === '1') {
      const headers = new Headers();
      headers.set('content-type', 'application/json; charset=utf-8');
      headers.set('content-disposition', `attachment; filename="${evidencePackage.id}.json"`);
      return new Response(JSON.stringify(evidencePackage.manifest, null, 2), { status: 200, headers });
    }

    return json({ data: evidencePackage });
  }

  if (resource === 'report-snapshots') {
    if (!id || ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    const snapshots = await listReportSnapshotsInternal(ctx, tenantId);
    const snapshot = snapshots.find((item) => item.id === id);
    if (!snapshot) {
      return json({ error: 'not_found' }, { status: 404 });
    }
    const url = new URL(ctx.request.url);
    if (url.searchParams.get('download') === '1') {
      const headers = new Headers();
      headers.set('content-type', 'text/markdown; charset=utf-8');
      headers.set('content-disposition', `attachment; filename="${snapshot.id}.md"`);
      return new Response(snapshot.contentMarkdown, { status: 200, headers });
    }
    return json({ data: snapshot });
  }

  if (resource === 'reports') {
    if (!id || ctx.request.method !== 'POST' || !REPORT_KINDS.includes(id as ReportKind)) {
      return methodNotAllowed(['POST']);
    }
    const writePermissions = await requireAnyPermission(
      ctx,
      FRAMEWORK_WRITE_PERMISSIONS,
      'Executive report generation requires framework management permissions.',
    );
    if (writePermissions instanceof Response) {
      return writePermissions;
    }
    const body = await readJson<ExecutiveReportRequest>(ctx.request);
    if ((id === 'exec-summary' || id === 'board-brief') && !body.assessmentId?.trim()) {
      return json(
        { error: 'bad_request', message: 'assessmentId is required for executive narrative reports.' },
        { status: 400 },
      );
    }
    if ((id === 'exec-summary' || id === 'board-brief') && body.assessmentId?.trim()) {
      const detail = await getAssessmentDetail(ctx, tenantId, body.assessmentId.trim());
      if (!detail) {
        return json({ error: 'not_found', message: 'Gap assessment not found.' }, { status: 404 });
      }
    }
    const jobId = await createJobRun(ctx.env, tenantId, writePermissions.userId, `report-${id}`, body.assessmentId ?? null, body);
    const job = await getJobRunInternal(ctx.env, tenantId, jobId);
    if (!job) {
      return json({ error: 'internal_error', message: 'Unable to create the report-snapshot job.' }, { status: 500 });
    }
    await enqueueGrcMessage(ctx.env, {
      type: 'grc.gap.report',
      tenantId,
      assessmentId: body.assessmentId?.trim() || undefined,
      requestedBy: writePermissions.userId,
      reportKind: id,
      jobId,
    });
    return json({ data: jobEnvelope(job, { assessmentId: body.assessmentId?.trim() || null }) }, { status: 202 });
  }

  if (resource === 'jobs') {
    if (!id) {
      if (ctx.request.method !== 'GET') {
        return methodNotAllowed(['GET']);
      }
      return json({ data: await listRecentJobRuns(ctx.env, tenantId, 24) });
    }

    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }

    const job = await getJobRunInternal(ctx.env, tenantId, id);
    if (!job) {
      return json({ error: 'not_found' }, { status: 404 });
    }
    return json({ data: job });
  }

  return json({ error: 'not_found' }, { status: 404 });
}
