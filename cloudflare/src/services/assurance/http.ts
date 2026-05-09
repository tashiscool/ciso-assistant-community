import {
  requireAnyScopedPermission,
  requireRootAdminAccess,
  type ScopedPermissionContext,
} from '../../authorization';
import type { WorkerRequestContext } from '../../router';
import { json, methodNotAllowed, readJson } from '../../utils/http';
import {
  getTenantWorkflowRuns,
  startTenantWorkflowRun,
  updateTenantWorkflowRun,
  type WorkflowRunRecord,
  type WorkflowRunStatus,
} from '../../utils/workflows';
import {
  buildAssuranceExplanation,
  loadPackageArtifactPreview,
  buildTwentyXPackage,
  createTrackerImportArtifacts,
  evaluateNormalizedBundle,
  listPendingReviewRecommendations,
  loadEvaluationArtifacts,
  loadNormalizedBundle,
  loadPackageSummary,
  loadReviewHistory,
  loadTrackerDiagnostics,
  persistEvaluationArtifacts,
  recordReviewDecision,
  resolveBundleFromCollection,
  persistNormalizedBundle,
  storeBundleArtifacts,
} from './runtime';
import {
  trackerArtifactContentType,
  trackerImportArtifactKey,
  type TrackerArtifactFamily,
} from './trackerArtifacts';
import type {
  AssuranceExplainAudience,
  BundleKind as BundleKindType,
  EvidenceInputMode as EvidenceInputModeType,
} from './types';

type RunEvalInput = {
  evidenceJobId?: string;
};

type TrackerImportInput = {
  folderId?: string;
  name?: string;
  sourceType?: string;
  rows?: Array<Record<string, unknown>>;
};

type ReviewDecisionInput = {
  recommendationId?: string;
  decision?: string;
  justification?: string;
  evidenceRefs?: string[];
  findingRefs?: string[];
  controlRefs?: string[];
};

type PackageBuildInput = {
  evidenceJobId?: string;
  folderId?: string;
  fileName?: string;
};

type ExplainInput = {
  evidenceJobId?: string;
  importJobId?: string;
  audience?: AssuranceExplainAudience | string;
  focusId?: string;
  question?: string;
};

type EvidenceJobLookupRow = {
  id: string;
  tenant_id: string;
  folder_id: string | null;
  source_id: string;
  bundle_kind: string;
};

type TrackerImportLookupRow = {
  id: string;
  tenant_id: string;
  folder_id: string;
  name: string;
};

type TrackerImportListRow = {
  id: string;
  tenant_id: string;
  folder_id: string;
  name: string;
  source_type: string;
  status: string;
  row_count: number;
  imported_count: number;
  error_count: number;
  summary_json: string;
  created_at: string;
  updated_at: string;
};

type EvidenceJobListRow = {
  id: string;
  tenant_id: string;
  folder_id: string | null;
  source_id: string;
  source_name: string;
  scheduled_for: string;
  started_at: string | null;
  finished_at: string | null;
  status: string;
  status_detail: string | null;
  run_family: string;
  input_mode: string;
  bundle_kind: string;
  manifest_key: string | null;
  normalization_status: string;
  coverage_json: string;
  artifact_count: number;
};

type PackageListRow = {
  id: string;
  tenant_id: string;
  folder_id: string | null;
  source_record: string | null;
  file_name: string;
  status: string;
  coverage_json: string;
  created_at: string;
  updated_at: string;
  reconciliation_status: string | null;
  validation_status: string | null;
};

type AgentRunListRow = {
  id: string;
  tenant_id: string;
  folder_id: string | null;
  evidence_job_id: string | null;
  import_job_id: string | null;
  status: string;
  workflow_name: string;
  requested_writebacks: number;
  summary_json: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  approval_count: number;
  pending_writeback_count: number;
};

type PendingWritebackRow = {
  id: string;
  folder_id: string | null;
  agent_run_id: string;
  connector_id: string | null;
  connector_name: string | null;
  request_type: string;
  payload_json: string;
  evidence_refs_json: string;
  created_at: string;
  updated_at: string;
};

type CountRow = {
  total_count: number;
};

type PendingWritebackCountRow = {
  pending_writeback_count: number;
};

type EvidenceArtifactRow = {
  artifact_family: string;
  object_key: string;
};

type SystemSourceRow = {
  id: string;
};

type SourceRow = {
  id: string;
  name: string;
  provider: string;
  config_json: string;
};

type ObservableParityCheckStatus = 'pass' | 'attention' | 'fail';

type ObservableParityCheck = {
  id: string;
  title: string;
  status: ObservableParityCheckStatus;
  detail: string;
  route: string | null;
  subjectId: string | null;
  metrics: Record<string, unknown> | null;
};

type ObservableParityStatus = {
  status: ObservableParityCheckStatus;
  generatedAt: string;
  source: {
    packageId: string | null;
    packageFileName: string | null;
    packageRoute: string | null;
    evidenceJobId: string | null;
    evidenceRoute: string | null;
    agentRunId: string | null;
    agentRoute: string | null;
    trackerImportId: string | null;
    trackerRoute: string | null;
    bundleKind: string | null;
    inputMode: string | null;
    updatedAt: string | null;
  };
  counts: {
    evidenceJobs: number;
    trackerImports: number;
    parityReadyPackages: number;
    agentBackedPackages: number;
    agentRuns: number;
    pendingWritebacks: number;
  };
  checks: ObservableParityCheck[];
};

function normalizeInputMode(value: string | undefined): EvidenceInputModeType {
  if (value === 'fixture' || value === 'tracker') {
    return value;
  }
  return 'live';
}

function normalizeBundleKind(value: string | undefined): BundleKindType {
  if (value === 'threat-hunt' || value === '20x' || value === 'tracker-to-20x') {
    return value;
  }
  return 'assessment';
}

function normalizeExplainAudience(value: string | undefined): AssuranceExplainAudience {
  switch (value) {
    case 'executive':
    case 'ao':
    case 'derivation':
    case 'reasonableness':
    case 'remediation':
    case 'tracker':
      return value;
    case 'assessor':
    default:
      return 'assessor';
  }
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function summarizeWritebackPayload(payload: Record<string, unknown>, requestType: string): string {
  if (typeof payload.summary === 'string' && payload.summary.trim()) {
    return payload.summary.trim();
  }

  const recommendations = Array.isArray(payload.recommendations) ? payload.recommendations : [];
  if (recommendations.length > 0) {
    const first = normalizeRecord(recommendations[0]);
    const firstTitle = typeof first.title === 'string' && first.title.trim() ? first.title.trim() : null;
    if (firstTitle) {
      return recommendations.length > 1
        ? `${recommendations.length} recommendation(s), starting with ${firstTitle}.`
        : firstTitle;
    }
    return `${recommendations.length} recommendation(s) are queued for review.`;
  }

  if (typeof payload.connectorName === 'string' && payload.connectorName.trim()) {
    return `Queued for ${payload.connectorName.trim()}.`;
  }

  return `Pending ${requestType} writeback review.`;
}

async function beginWorkflowRun(
  ctx: WorkerRequestContext,
  tenantId: string,
  run: {
    runId: string;
    runType: string;
    module: string;
    title: string;
    status: WorkflowRunStatus;
    folderId: string | null;
    sourceRecordId: string | null;
    route: string;
    detail: string;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  try {
    await startTenantWorkflowRun(ctx.env, tenantId, {
      ...run,
      metadata: run.metadata ?? null,
    });
  } catch (error) {
    console.warn('Failed to start workflow run', error);
  }
}

async function patchWorkflowRun(
  ctx: WorkerRequestContext,
  tenantId: string,
  update: {
    runId: string;
    title?: string;
    status?: WorkflowRunStatus;
    route?: string;
    detail?: string;
    metadata?: Record<string, unknown> | null;
    sourceRecordId?: string | null;
  },
): Promise<void> {
  try {
    await updateTenantWorkflowRun(ctx.env, tenantId, update);
  } catch (error) {
    console.warn('Failed to update workflow run', error);
  }
}

function hasAssuranceScope(
  access: Pick<ScopedPermissionContext, 'accessibleDomainIds'>,
  folderId: string | null | undefined,
): boolean {
  return !folderId || access.accessibleDomainIds.includes(folderId);
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

function toPackageListItem(row: PackageListRow) {
  const coverage = JSON.parse(row.coverage_json || '{}') as Record<string, unknown>;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    folderId: row.folder_id,
    sourceRecord: row.source_record,
    fileName: row.file_name,
    status: row.status,
    coverage,
    reconciliationStatus: row.reconciliation_status,
    validationStatus: row.validation_status,
    validationCheckCount: Number(coverage.validationCheckCount ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeOverviewAgentStatus(row: Pick<AgentRunListRow, 'status' | 'summary_json' | 'pending_writeback_count'>): string {
  if (Number(row.pending_writeback_count) > 0) {
    return 'awaiting_review';
  }
  const summary = asJson<Record<string, unknown>>(row.summary_json, {});
  const awaitingReviewReasons = Array.isArray(summary.awaitingReviewReasons)
    ? summary.awaitingReviewReasons.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  if (awaitingReviewReasons.length > 0) {
    return 'awaiting_review';
  }
  return row.status === 'awaiting_review' ? 'completed' : row.status;
}

function readStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readStringField(record: Record<string, unknown> | null | undefined, key: string): string | null {
  return readStringValue(record?.[key]);
}

function readNumberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readNumberField(record: Record<string, unknown> | null | undefined, key: string): number | null {
  return readNumberValue(record?.[key]);
}

function readBooleanField(record: Record<string, unknown> | null | undefined, key: string): boolean {
  const value = record?.[key];
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    return value === '1' || value.toLowerCase() === 'true';
  }
  return false;
}

function normalizeRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map((item) => normalizeRecord(item)) : [];
}

function buildObservableParityCheck(args: {
  id: string;
  title: string;
  status: ObservableParityCheckStatus;
  detail: string;
  route?: string | null;
  subjectId?: string | null;
  metrics?: Record<string, unknown> | null;
}): ObservableParityCheck {
  return {
    id: args.id,
    title: args.title,
    status: args.status,
    detail: args.detail,
    route: args.route ?? null,
    subjectId: args.subjectId ?? null,
    metrics: args.metrics ?? null,
  };
}

function summarizeObservableParityStatus(checks: ObservableParityCheck[]): ObservableParityCheckStatus {
  if (checks.some((check) => check.status === 'fail')) {
    return 'fail';
  }
  if (checks.some((check) => check.status === 'attention')) {
    return 'attention';
  }
  return 'pass';
}

async function readR2JsonArtifact<T>(
  env: WorkerRequestContext['env'],
  objectKey: string | null | undefined,
): Promise<T | null> {
  if (!objectKey) {
    return null;
  }
  const object = await env.R2_EVIDENCE.get(objectKey);
  if (!object) {
    return null;
  }
  return (await object.json()) as T;
}

async function readR2TextArtifact(
  env: WorkerRequestContext['env'],
  objectKey: string | null | undefined,
): Promise<string | null> {
  if (!objectKey) {
    return null;
  }
  const object = await env.R2_EVIDENCE.get(objectKey);
  if (!object) {
    return null;
  }
  return object.text();
}

function buildScopedFolderPredicate(
  column: string,
  accessibleFolderIds: readonly string[],
): { clause: string; bindings: string[] } {
  if (accessibleFolderIds.length === 0) {
    return {
      clause: `${column} IS NULL`,
      bindings: [],
    };
  }

  return {
    clause: `(${column} IS NULL OR ${column} IN (${accessibleFolderIds.map(() => '?').join(', ')}))`,
    bindings: [...accessibleFolderIds],
  };
}

function isAssuranceWorkflowModule(module: string): boolean {
  return module === 'Assurance' || module === 'Evidence' || module === 'ConMon' || module === 'Agent';
}

function collectWorkflowMetadataValues(value: unknown, sink: Set<string>): void {
  if (typeof value === 'string') {
    sink.add(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectWorkflowMetadataValues(item, sink);
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectWorkflowMetadataValues(item, sink);
    }
  }
}

function workflowMatchesLinkedRecords(run: WorkflowRunRecord, linkedRecordIds: Set<string>): boolean {
  if (linkedRecordIds.size === 0) {
    return true;
  }

  if (linkedRecordIds.has(run.runId)) {
    return true;
  }

  if (run.sourceRecordId && linkedRecordIds.has(run.sourceRecordId)) {
    return true;
  }

  const metadataValues = new Set<string>();
  collectWorkflowMetadataValues(run.metadata, metadataValues);
  for (const recordId of linkedRecordIds) {
    if (metadataValues.has(recordId)) {
      return true;
    }
  }

  return false;
}

async function resolveEvidenceJob(
  ctx: WorkerRequestContext,
  tenantId: string,
  evidenceJobId: string | undefined,
): Promise<EvidenceJobLookupRow | null> {
  if (evidenceJobId) {
    return ctx.env.D1_MAIN.prepare(
      `
      SELECT id, tenant_id, folder_id, source_id, bundle_kind
      FROM evidence_jobs
      WHERE tenant_id = ? AND id = ?
      LIMIT 1
      `,
    )
      .bind(tenantId, evidenceJobId)
      .first<EvidenceJobLookupRow>();
  }

  return ctx.env.D1_MAIN.prepare(
    `
    SELECT id, tenant_id, folder_id, source_id, bundle_kind
    FROM evidence_jobs
    WHERE tenant_id = ? AND normalization_status = 'ready'
    ORDER BY created_at DESC
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<EvidenceJobLookupRow>();
}

async function ensureTrackerEvidenceSource(
  ctx: WorkerRequestContext,
  tenantId: string,
): Promise<string> {
  const existing = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id
    FROM evidence_sources
    WHERE tenant_id = ? AND provider = 'tracker_import'
    ORDER BY created_at ASC
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<SystemSourceRow>();

  if (existing?.id) {
    return existing.id;
  }

  const sourceId = crypto.randomUUID();
  await ctx.env.D1_MAIN.prepare(
    `
    INSERT INTO evidence_sources (id, tenant_id, name, provider, config_json, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
    `,
  )
    .bind(
      sourceId,
      tenantId,
      'Tracker Import Derived Source',
      'tracker_import',
      JSON.stringify({
        generatedBy: 'assurance.tracker-to-20x',
      }),
    )
    .run();

  return sourceId;
}

async function getSourceRow(
  ctx: WorkerRequestContext,
  tenantId: string,
  sourceId: string,
): Promise<SourceRow | null> {
  return ctx.env.D1_MAIN.prepare(
    `
    SELECT id, name, provider, config_json
    FROM evidence_sources
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, sourceId)
    .first<SourceRow>();
}

async function buildAndPersistTrackerDerivedEvidenceJob(args: {
  ctx: WorkerRequestContext;
  tenantId: string;
  userId: string | null;
  tracker: TrackerImportLookupRow;
}): Promise<EvidenceJobLookupRow> {
  const sourceId = await ensureTrackerEvidenceSource(args.ctx, args.tenantId);
  const source = await getSourceRow(args.ctx, args.tenantId, sourceId);
  if (!source) {
    throw new Error('Tracker evidence source could not be created.');
  }

  const evidenceJobId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await args.ctx.env.D1_MAIN.prepare(
    `
    INSERT INTO evidence_jobs (
      id, tenant_id, folder_id, source_id, scheduled_for, started_at, finished_at, status, status_detail, last_cursor,
      run_family, input_mode, bundle_kind, manifest_key, normalization_status, coverage_json, error_summary_json,
      source_schema_version, adapter_hints_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      evidenceJobId,
      args.tenantId,
      args.tracker.folder_id,
      sourceId,
      createdAt,
      createdAt,
      createdAt,
      'success',
      'Tracker-derived evidence bundle created synchronously.',
      null,
      'tracker-to-20x',
      'tracker',
      'tracker-to-20x',
      null,
      'pending',
      '{}',
      '{}',
      'v1',
      JSON.stringify({
        importJobId: args.tracker.id,
      }),
    )
    .run();

  const diagnostics = await loadTrackerDiagnostics(args.ctx.env, args.tracker.id);
  const { bundle, rawBundle } = await resolveBundleFromCollection({
    tenantId: args.tenantId,
    folderId: args.tracker.folder_id,
    provider: source.provider,
    sourceName: source.name,
    inputMode: 'tracker',
    bundleKind: 'tracker-to-20x',
    sourceConfig: JSON.parse(source.config_json) as Record<string, unknown>,
    adapterHints: {
      importJobId: args.tracker.id,
    },
    trackerDiagnostics: diagnostics,
  });

  await persistNormalizedBundle(
    {
      env: args.ctx.env,
      tenantId: args.tenantId,
      folderId: args.tracker.folder_id,
      evidenceJobId,
    },
    bundle,
  );
  const artifactState = await storeBundleArtifacts({
    env: args.ctx.env,
    tenantId: args.tenantId,
    sourceId,
    jobId: evidenceJobId,
    rawBundle,
    bundle,
  });

  await args.ctx.env.D1_MAIN.prepare(
    `
    UPDATE evidence_jobs
    SET manifest_key = ?, normalization_status = 'ready', coverage_json = ?, error_summary_json = ?, updated_at = ?, finished_at = ?
    WHERE id = ? AND tenant_id = ?
    `,
  )
    .bind(
      artifactState.manifestKey,
      JSON.stringify(artifactState.coverage),
      JSON.stringify({ diagnostics: diagnostics.length }),
      createdAt,
      createdAt,
      evidenceJobId,
      args.tenantId,
    )
    .run();

  return {
    id: evidenceJobId,
    tenant_id: args.tenantId,
    folder_id: args.tracker.folder_id,
    source_id: sourceId,
    bundle_kind: 'tracker-to-20x',
  };
}

async function loadAssuranceOverview(
  ctx: WorkerRequestContext,
  access: ScopedPermissionContext,
): Promise<{
  summary: {
    evidenceJobCount: number;
    trackerImportCount: number;
    trackerImportErrorCount: number;
    packageCount: number;
    agentBackedPackageCount: number;
    observableParityReadyPackageCount: number;
    packageMismatchCount: number;
    packageValidationReviewCount: number;
    pendingReviewCount: number;
    reviewDecisionCount: number;
    agentRunCount: number;
    pendingWritebackCount: number;
    runningWorkflowCount: number;
    awaitingReviewWorkflowCount: number;
    failedWorkflowCount: number;
  };
  evidenceJobs: Array<Record<string, unknown>>;
  trackerImports: Array<Record<string, unknown>>;
  trackerImportsWithErrors: Array<Record<string, unknown>>;
  packages: Array<Record<string, unknown>>;
  parityReadyPackages: Array<Record<string, unknown>>;
  mismatchedPackages: Array<Record<string, unknown>>;
  packagesWithValidationDrift: Array<Record<string, unknown>>;
  pendingReviews: Array<Record<string, unknown>>;
  reviewHistory: Array<Record<string, unknown>>;
  agentRuns: Array<Record<string, unknown>>;
  pendingWritebacks: Array<Record<string, unknown>>;
  workflowRuns: WorkflowRunRecord[];
}> {
  const evidenceScope = buildScopedFolderPredicate('job.folder_id', access.accessibleDomainIds);
  const trackerScope = buildScopedFolderPredicate('job.folder_id', access.accessibleDomainIds);
  const packageScope = buildScopedFolderPredicate('package_job.folder_id', access.accessibleDomainIds);
  const agentScope = buildScopedFolderPredicate('run.folder_id', access.accessibleDomainIds);

  const [
    evidenceRowsResult,
    evidenceCountResult,
    trackerRowsResult,
    trackerCountResult,
    trackerErrorCountResult,
    trackerImportsWithErrorsResult,
    packageRowsResult,
    packageCountResult,
    agentBackedPackageCountResult,
    observableParityReadyPackageCountResult,
    packageMismatchCountResult,
    packageValidationReviewCountResult,
    parityReadyPackageRowsResult,
    mismatchedPackageRowsResult,
    packagesWithValidationDriftResult,
    pendingReviews,
    reviewHistory,
    agentRowsResult,
    agentCountResult,
    pendingWritebackCountResult,
    pendingWritebackRowsResult,
    workflowRunWindow,
  ] = await Promise.all([
    ctx.env.D1_MAIN.prepare(
      `
      SELECT
        job.id,
        job.tenant_id,
        job.folder_id,
        job.source_id,
        source.name AS source_name,
        job.scheduled_for,
        job.started_at,
        job.finished_at,
        job.status,
        job.status_detail,
        job.run_family,
        job.input_mode,
        job.bundle_kind,
        job.manifest_key,
        job.normalization_status,
        job.coverage_json,
        COUNT(artifact.id) AS artifact_count
      FROM evidence_jobs AS job
      INNER JOIN evidence_sources AS source
        ON source.id = job.source_id
      LEFT JOIN evidence_artifacts AS artifact
        ON artifact.job_id = job.id
      WHERE job.tenant_id = ? AND ${evidenceScope.clause}
      GROUP BY
        job.id,
        job.tenant_id,
        job.folder_id,
        job.source_id,
        source.name,
        job.scheduled_for,
        job.started_at,
        job.finished_at,
        job.status,
        job.status_detail,
        job.run_family,
        job.input_mode,
        job.bundle_kind,
        job.manifest_key,
        job.normalization_status,
        job.coverage_json
      ORDER BY job.scheduled_for DESC
      LIMIT 8
      `,
    )
      .bind(access.tenantId, ...evidenceScope.bindings)
      .all<EvidenceJobListRow>(),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT COUNT(*) AS total_count
      FROM evidence_jobs AS job
      WHERE job.tenant_id = ? AND ${evidenceScope.clause}
      `,
    )
      .bind(access.tenantId, ...evidenceScope.bindings)
      .first<CountRow>(),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT id, tenant_id, folder_id, name, source_type, status, row_count, imported_count, error_count,
             summary_json, created_at, updated_at
      FROM import_jobs AS job
      WHERE job.tenant_id = ? AND job.run_family = 'tracker_import' AND ${trackerScope.clause}
      ORDER BY job.created_at DESC
      LIMIT 8
      `,
    )
      .bind(access.tenantId, ...trackerScope.bindings)
      .all<TrackerImportListRow>(),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT COUNT(*) AS total_count
      FROM import_jobs AS job
      WHERE job.tenant_id = ? AND job.run_family = 'tracker_import' AND ${trackerScope.clause}
      `,
    )
      .bind(access.tenantId, ...trackerScope.bindings)
      .first<CountRow>(),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT COUNT(*) AS total_count
      FROM import_jobs AS job
      WHERE job.tenant_id = ?
        AND job.run_family = 'tracker_import'
        AND ${trackerScope.clause}
        AND job.error_count > 0
      `,
    )
      .bind(access.tenantId, ...trackerScope.bindings)
      .first<CountRow>(),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT id, tenant_id, folder_id, name, source_type, status, row_count, imported_count, error_count,
             summary_json, created_at, updated_at
      FROM import_jobs AS job
      WHERE job.tenant_id = ?
        AND job.run_family = 'tracker_import'
        AND ${trackerScope.clause}
        AND job.error_count > 0
      ORDER BY job.updated_at DESC
      LIMIT 6
      `,
    )
      .bind(access.tenantId, ...trackerScope.bindings)
      .all<TrackerImportListRow>(),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT package_job.id, package_job.tenant_id, package_job.folder_id, package_job.source_record,
             package_job.file_name, package_job.status, package_job.coverage_json, package_job.created_at,
             package_job.updated_at, reconciliation.status AS reconciliation_status,
             COALESCE(json_extract(package_job.coverage_json, '$.validationStatus'), 'unknown') AS validation_status
      FROM ai_compliance_export_jobs AS package_job
      LEFT JOIN assurance_reconciliation_runs AS reconciliation
        ON reconciliation.id = (
          SELECT latest.id
          FROM assurance_reconciliation_runs AS latest
          WHERE latest.package_job_id = package_job.id
          ORDER BY latest.created_at DESC
          LIMIT 1
        )
      WHERE package_job.tenant_id = ?
        AND package_job.run_family = 'assurance_package'
        AND ${packageScope.clause}
      ORDER BY package_job.created_at DESC
      LIMIT 8
      `,
    )
      .bind(access.tenantId, ...packageScope.bindings)
      .all<PackageListRow>(),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT COUNT(*) AS total_count
      FROM ai_compliance_export_jobs AS package_job
      WHERE package_job.tenant_id = ?
        AND package_job.run_family = 'assurance_package'
        AND ${packageScope.clause}
      `,
    )
      .bind(access.tenantId, ...packageScope.bindings)
      .first<CountRow>(),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT COUNT(*) AS total_count
      FROM ai_compliance_export_jobs AS package_job
      WHERE package_job.tenant_id = ?
        AND package_job.run_family = 'assurance_package'
        AND ${packageScope.clause}
        AND COALESCE(json_extract(package_job.coverage_json, '$.hasAgentSecurity'), 0) = 1
      `,
    )
      .bind(access.tenantId, ...packageScope.bindings)
      .first<CountRow>(),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT COUNT(*) AS total_count
      FROM ai_compliance_export_jobs AS package_job
      WHERE package_job.tenant_id = ?
        AND package_job.run_family = 'assurance_package'
        AND ${packageScope.clause}
        AND COALESCE(json_extract(package_job.coverage_json, '$.observableParityReady'), 0) = 1
      `,
    )
      .bind(access.tenantId, ...packageScope.bindings)
      .first<CountRow>(),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT COUNT(*) AS total_count
      FROM ai_compliance_export_jobs AS package_job
      LEFT JOIN assurance_reconciliation_runs AS reconciliation
        ON reconciliation.id = (
          SELECT latest.id
          FROM assurance_reconciliation_runs AS latest
          WHERE latest.package_job_id = package_job.id
          ORDER BY latest.created_at DESC
          LIMIT 1
        )
      WHERE package_job.tenant_id = ?
        AND package_job.run_family = 'assurance_package'
        AND ${packageScope.clause}
        AND reconciliation.status = 'mismatch'
      `,
      )
      .bind(access.tenantId, ...packageScope.bindings)
      .first<CountRow>(),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT COUNT(*) AS total_count
      FROM ai_compliance_export_jobs AS package_job
      WHERE package_job.tenant_id = ?
        AND package_job.run_family = 'assurance_package'
        AND ${packageScope.clause}
        AND COALESCE(json_extract(package_job.coverage_json, '$.validationStatus'), 'unknown') != 'pass'
      `,
      )
      .bind(access.tenantId, ...packageScope.bindings)
      .first<CountRow>(),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT package_job.id, package_job.tenant_id, package_job.folder_id, package_job.source_record,
             package_job.file_name, package_job.status, package_job.coverage_json, package_job.created_at,
             package_job.updated_at, reconciliation.status AS reconciliation_status,
             COALESCE(json_extract(package_job.coverage_json, '$.validationStatus'), 'unknown') AS validation_status
      FROM ai_compliance_export_jobs AS package_job
      LEFT JOIN assurance_reconciliation_runs AS reconciliation
        ON reconciliation.id = (
          SELECT latest.id
          FROM assurance_reconciliation_runs AS latest
          WHERE latest.package_job_id = package_job.id
          ORDER BY latest.created_at DESC
          LIMIT 1
        )
      WHERE package_job.tenant_id = ?
        AND package_job.run_family = 'assurance_package'
        AND ${packageScope.clause}
        AND COALESCE(json_extract(package_job.coverage_json, '$.observableParityReady'), 0) = 1
      ORDER BY package_job.updated_at DESC
      LIMIT 4
      `,
    )
      .bind(access.tenantId, ...packageScope.bindings)
      .all<PackageListRow>(),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT package_job.id, package_job.tenant_id, package_job.folder_id, package_job.source_record,
             package_job.file_name, package_job.status, package_job.coverage_json, package_job.created_at,
             package_job.updated_at, reconciliation.status AS reconciliation_status,
             COALESCE(json_extract(package_job.coverage_json, '$.validationStatus'), 'unknown') AS validation_status
      FROM ai_compliance_export_jobs AS package_job
      LEFT JOIN assurance_reconciliation_runs AS reconciliation
        ON reconciliation.id = (
          SELECT latest.id
          FROM assurance_reconciliation_runs AS latest
          WHERE latest.package_job_id = package_job.id
          ORDER BY latest.created_at DESC
          LIMIT 1
        )
      WHERE package_job.tenant_id = ?
        AND package_job.run_family = 'assurance_package'
        AND ${packageScope.clause}
        AND reconciliation.status = 'mismatch'
      ORDER BY package_job.updated_at DESC
      LIMIT 6
      `,
    )
      .bind(access.tenantId, ...packageScope.bindings)
      .all<PackageListRow>(),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT package_job.id, package_job.tenant_id, package_job.folder_id, package_job.source_record,
             package_job.file_name, package_job.status, package_job.coverage_json, package_job.created_at,
             package_job.updated_at, reconciliation.status AS reconciliation_status,
             COALESCE(json_extract(package_job.coverage_json, '$.validationStatus'), 'unknown') AS validation_status
      FROM ai_compliance_export_jobs AS package_job
      LEFT JOIN assurance_reconciliation_runs AS reconciliation
        ON reconciliation.id = (
          SELECT latest.id
          FROM assurance_reconciliation_runs AS latest
          WHERE latest.package_job_id = package_job.id
          ORDER BY latest.created_at DESC
          LIMIT 1
        )
      WHERE package_job.tenant_id = ?
        AND package_job.run_family = 'assurance_package'
        AND ${packageScope.clause}
        AND COALESCE(json_extract(package_job.coverage_json, '$.validationStatus'), 'unknown') != 'pass'
      ORDER BY package_job.updated_at DESC
      LIMIT 6
      `,
    )
      .bind(access.tenantId, ...packageScope.bindings)
      .all<PackageListRow>(),
    listPendingReviewRecommendations(ctx.env, access.tenantId, access.accessibleDomainIds),
    loadReviewHistory(ctx.env, access.tenantId, {}, access.accessibleDomainIds),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT run.id, run.tenant_id, run.folder_id, run.evidence_job_id, run.import_job_id, run.status,
             run.workflow_name, run.requested_writebacks, run.summary_json, run.created_by_user_id,
             run.created_at, run.updated_at,
             COUNT(approval.id) AS approval_count,
             COALESCE(SUM(CASE WHEN approval.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_writeback_count
      FROM assurance_agent_runs AS run
      LEFT JOIN assurance_writeback_approvals AS approval
        ON approval.agent_run_id = run.id
      WHERE run.tenant_id = ? AND ${agentScope.clause}
      GROUP BY run.id
      ORDER BY run.created_at DESC
      LIMIT 8
      `,
    )
      .bind(access.tenantId, ...agentScope.bindings)
      .all<AgentRunListRow>(),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT COUNT(*) AS total_count
      FROM assurance_agent_runs AS run
      WHERE run.tenant_id = ? AND ${agentScope.clause}
      `,
    )
      .bind(access.tenantId, ...agentScope.bindings)
      .first<CountRow>(),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT COUNT(approval.id) AS pending_writeback_count
      FROM assurance_writeback_approvals AS approval
      INNER JOIN assurance_agent_runs AS run
        ON run.id = approval.agent_run_id
      WHERE run.tenant_id = ?
        AND approval.status = 'pending'
        AND ${agentScope.clause}
      `,
    )
      .bind(access.tenantId, ...agentScope.bindings)
      .first<PendingWritebackCountRow>(),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT approval.id, approval.folder_id, approval.agent_run_id, approval.connector_id, connector.name AS connector_name,
             approval.request_type, approval.payload_json, approval.evidence_refs_json, approval.created_at, approval.updated_at
      FROM assurance_writeback_approvals AS approval
      INNER JOIN assurance_agent_runs AS run
        ON run.id = approval.agent_run_id
      LEFT JOIN integration_connectors AS connector
        ON connector.id = approval.connector_id
      WHERE run.tenant_id = ?
        AND approval.status = 'pending'
        AND ${agentScope.clause}
      ORDER BY approval.created_at ASC
      LIMIT 6
      `,
    )
      .bind(access.tenantId, ...agentScope.bindings)
      .all<PendingWritebackRow>(),
    getTenantWorkflowRuns(ctx.env, access.tenantId, 200),
  ]);

  const workflowRuns = workflowRunWindow
    .filter((run) => isAssuranceWorkflowModule(run.module) && hasAssuranceScope(access, run.folderId))
    .slice(0, 12);
  const visibleWorkflowWindow = workflowRunWindow.filter(
    (run) => isAssuranceWorkflowModule(run.module) && hasAssuranceScope(access, run.folderId),
  );

  return {
    summary: {
      evidenceJobCount: Number(evidenceCountResult?.total_count ?? 0),
      trackerImportCount: Number(trackerCountResult?.total_count ?? 0),
      trackerImportErrorCount: Number(trackerErrorCountResult?.total_count ?? 0),
      packageCount: Number(packageCountResult?.total_count ?? 0),
      agentBackedPackageCount: Number(agentBackedPackageCountResult?.total_count ?? 0),
      observableParityReadyPackageCount: Number(observableParityReadyPackageCountResult?.total_count ?? 0),
      packageMismatchCount: Number(packageMismatchCountResult?.total_count ?? 0),
      packageValidationReviewCount: Number(packageValidationReviewCountResult?.total_count ?? 0),
      pendingReviewCount: pendingReviews.length,
      reviewDecisionCount: reviewHistory.length,
      agentRunCount: Number(agentCountResult?.total_count ?? 0),
      pendingWritebackCount: Number(pendingWritebackCountResult?.pending_writeback_count ?? 0),
      runningWorkflowCount: visibleWorkflowWindow.filter((run) => run.status === 'Running').length,
      awaitingReviewWorkflowCount: visibleWorkflowWindow.filter((run) => run.status === 'Awaiting Review').length,
      failedWorkflowCount: visibleWorkflowWindow.filter((run) => run.status === 'Failed').length,
    },
    evidenceJobs: evidenceRowsResult.results.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      folderId: row.folder_id,
      sourceId: row.source_id,
      sourceName: row.source_name,
      scheduledFor: row.scheduled_for,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      status: row.status,
      statusDetail: row.status_detail,
      runFamily: row.run_family,
      inputMode: row.input_mode,
      bundleKind: row.bundle_kind,
      manifestKey: row.manifest_key,
      normalizationStatus: row.normalization_status,
      coverage: JSON.parse(row.coverage_json || '{}') as Record<string, unknown>,
      artifactCount: Number(row.artifact_count ?? 0),
    })),
    trackerImports: trackerRowsResult.results.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      folderId: row.folder_id,
      name: row.name,
      sourceType: row.source_type,
      status: row.status,
      rowCount: row.row_count,
      importedCount: row.imported_count,
      errorCount: row.error_count,
      summary: JSON.parse(row.summary_json || '{}') as Record<string, unknown>,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    trackerImportsWithErrors: trackerImportsWithErrorsResult.results.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      folderId: row.folder_id,
      name: row.name,
      sourceType: row.source_type,
      status: row.status,
      rowCount: row.row_count,
      importedCount: row.imported_count,
      errorCount: row.error_count,
      summary: JSON.parse(row.summary_json || '{}') as Record<string, unknown>,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    packages: packageRowsResult.results.map(toPackageListItem),
    parityReadyPackages: parityReadyPackageRowsResult.results.map(toPackageListItem),
    mismatchedPackages: mismatchedPackageRowsResult.results.map(toPackageListItem),
    packagesWithValidationDrift: packagesWithValidationDriftResult.results.map(toPackageListItem),
    pendingReviews: pendingReviews.slice(0, 8),
    reviewHistory: reviewHistory.slice(0, 8),
    agentRuns: agentRowsResult.results.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      folderId: row.folder_id,
      evidenceJobId: row.evidence_job_id,
      importJobId: row.import_job_id,
      status: normalizeOverviewAgentStatus(row),
      workflowName: row.workflow_name,
      requestedWritebacks: Boolean(row.requested_writebacks),
      summary: JSON.parse(row.summary_json || '{}') as Record<string, unknown>,
      approvalCount: Number(row.approval_count ?? 0),
      pendingWritebackCount: Number(row.pending_writeback_count ?? 0),
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    pendingWritebacks: pendingWritebackRowsResult.results.map((row) => {
      const payload = normalizeRecord(JSON.parse(row.payload_json || '{}') as Record<string, unknown>);
      const evidenceRefs = normalizeStringArray(JSON.parse(row.evidence_refs_json || '[]'));
      const recommendationRecords = Array.isArray(payload.recommendations)
        ? payload.recommendations.map((item) => normalizeRecord(item))
        : [];
      const primaryRecommendationId =
        recommendationRecords
          .map((item) => (typeof item.id === 'string' && item.id.trim() ? item.id.trim() : null))
          .find(Boolean) ?? null;
      return {
        id: row.id,
        folderId: row.folder_id,
        agentRunId: row.agent_run_id,
        connectorId: row.connector_id,
        connectorName: row.connector_name ?? (typeof payload.connectorName === 'string' ? payload.connectorName : null),
        requestType: row.request_type,
        status: 'pending',
        summary: summarizeWritebackPayload(payload, row.request_type),
        evidenceRefCount: evidenceRefs.length,
        primaryFocusId: primaryRecommendationId ?? evidenceRefs[0] ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }),
    workflowRuns,
  };
}

async function loadObservableParityStatus(
  ctx: WorkerRequestContext,
  access: ScopedPermissionContext,
): Promise<ObservableParityStatus> {
  const overview = await loadAssuranceOverview(ctx, access);
  const generatedAt = new Date().toISOString();
  const overviewTrackerImports = overview.trackerImports as Array<{
    id: string;
    name: string;
    rowCount: number;
    importedCount: number;
    errorCount: number;
  }>;
  const overviewParityReadyPackages = overview.parityReadyPackages as Array<{
    id: string;
    fileName: string;
    sourceRecord: string | null;
    coverage: Record<string, unknown>;
    updatedAt: string;
  }>;
  const overviewAgentRuns = overview.agentRuns as Array<{ id: string }>;
  const trackerImport = overviewTrackerImports[0] ?? null;
  const trackerRoute = trackerImport
    ? `/assurance/tracker?importId=${encodeURIComponent(trackerImport.id)}`
    : null;

  let parityPackage = overviewParityReadyPackages[0] ?? null;
  let packageDocument: Record<string, unknown> = {};
  for (const candidate of overviewParityReadyPackages) {
    const preview = await loadPackageArtifactPreview(ctx.env, access.tenantId, candidate.id, 'package_json');
    const candidateDocument = normalizeRecord(preview?.preview ?? null);
    const candidateMetadata = normalizeRecord(candidateDocument.metadata);
    if (
      readStringField(candidateMetadata, 'bundle_kind') === 'threat-hunt' &&
      Object.keys(normalizeRecord(candidateDocument.agent_security_summary)).length > 0
    ) {
      parityPackage = candidate;
      packageDocument = candidateDocument;
      break;
    }
    if (candidate.id === parityPackage?.id) {
      packageDocument = candidateDocument;
    }
  }
  const fallbackMetadata = normalizeRecord(packageDocument.metadata);

  const fallbackSource = {
    packageId: parityPackage?.id ?? null,
    packageFileName: parityPackage?.fileName ?? null,
    packageRoute: parityPackage ? `/assurance/packages?packageId=${encodeURIComponent(parityPackage.id)}` : null,
    evidenceJobId: parityPackage?.sourceRecord ?? null,
    evidenceRoute: parityPackage?.sourceRecord
      ? `/assurance/evidence?evidenceJobId=${encodeURIComponent(parityPackage.sourceRecord)}`
      : null,
    agentRunId: readStringField(parityPackage?.coverage ?? null, 'agentRunId'),
    agentRoute: readStringField(parityPackage?.coverage ?? null, 'agentRunId')
      ? `/assurance/agent-runs?runId=${encodeURIComponent(readStringField(parityPackage?.coverage ?? null, 'agentRunId') ?? '')}`
      : null,
    trackerImportId: trackerImport?.id ?? null,
    trackerRoute,
    bundleKind: readStringField(fallbackMetadata, 'bundle_kind'),
    inputMode: readStringField(fallbackMetadata, 'input_mode'),
    updatedAt: parityPackage?.updatedAt ?? null,
  };

  if (!parityPackage) {
    const checks = [
      buildObservableParityCheck({
        id: 'parity_package',
        title: 'Threat-hunt parity package',
        status: 'fail',
        detail: 'No observable-parity package is available in the current scoped workspace yet.',
        route: '/assurance/packages',
      }),
      buildObservableParityCheck({
        id: 'tracker_artifacts',
        title: 'Tracker artifact contract',
        status: trackerImport ? 'attention' : 'fail',
        detail: trackerImport
          ? 'Tracker imports exist, but no parity-ready package has been produced from the current evidence pipeline yet.'
          : 'No tracker import artifacts are available in the current scoped workspace.',
        route: trackerRoute ?? '/assurance/tracker',
        subjectId: trackerImport?.id ?? null,
      }),
    ];

    return {
      status: summarizeObservableParityStatus(checks),
      generatedAt,
      source: fallbackSource,
      counts: {
        evidenceJobs: overview.summary.evidenceJobCount,
        trackerImports: overview.summary.trackerImportCount,
        parityReadyPackages: overview.summary.observableParityReadyPackageCount,
        agentBackedPackages: overview.summary.agentBackedPackageCount,
        agentRuns: overview.summary.agentRunCount,
        pendingWritebacks: overview.summary.pendingWritebackCount,
      },
      checks,
    };
  }

  const packageRoute = `/assurance/packages?packageId=${encodeURIComponent(parityPackage.id)}`;
  const packageState = await loadPackageSummary(ctx.env, access.tenantId, parityPackage.id);
  if (!Object.keys(packageDocument).length) {
    const packagePreview = await loadPackageArtifactPreview(ctx.env, access.tenantId, parityPackage.id, 'package_json');
    packageDocument = normalizeRecord(packagePreview?.preview ?? null);
  }
  const packageMetadata = normalizeRecord(packageDocument.metadata);
  const packageSummaryRecord = normalizeRecord(packageDocument.summary);
  const packageAgentSummary = normalizeRecord(packageDocument.agent_security_summary);
  const packageEvidenceLinks = normalizeRecordArray(packageDocument.evidence_links);
  const packageFindings = normalizeRecordArray(packageDocument.findings);
  const packagePoamItems = normalizeRecordArray(packageDocument.poam_items);
  const evidenceJobId = readStringField(packageMetadata, 'evidence_job_id') ?? parityPackage.sourceRecord;
  const evidenceRoute = evidenceJobId
    ? `/assurance/evidence?evidenceJobId=${encodeURIComponent(evidenceJobId)}`
    : null;
  const agentRunId =
    readStringField(packageMetadata, 'agent_run_id') ?? readStringField(parityPackage.coverage, 'agentRunId');
  const agentRoute = agentRunId
    ? `/assurance/agent-runs?runId=${encodeURIComponent(agentRunId)}`
    : null;

  const validationPreview = await loadPackageArtifactPreview(
    ctx.env,
    access.tenantId,
    parityPackage.id,
    'validation_report',
  );
  const validationReport = normalizeRecord(validationPreview?.preview ?? null);
  const validationChecks = normalizeRecordArray(validationReport.checks);
  const requiredValidationChecks = [
    'agent_eval_embedding',
    'agent_security_summary_alignment',
    'agent_finding_lineage',
    'agent_poam_alignment',
    'agent_report_embedding',
  ];
  const passingValidationChecks = requiredValidationChecks.filter((checkId) =>
    validationChecks.some(
      (check) => readStringField(check, 'id') === checkId && readStringField(check, 'status') === 'pass',
    ),
  );

  const assessorReportPreview = await loadPackageArtifactPreview(
    ctx.env,
    access.tenantId,
    parityPackage.id,
    'assessor',
  );
  const executiveReportPreview = await loadPackageArtifactPreview(
    ctx.env,
    access.tenantId,
    parityPackage.id,
    'executive',
  );
  const aoReportPreview = await loadPackageArtifactPreview(ctx.env, access.tenantId, parityPackage.id, 'ao');
  const assessorReport = typeof assessorReportPreview?.preview === 'string' ? assessorReportPreview.preview : null;
  const executiveReport = typeof executiveReportPreview?.preview === 'string' ? executiveReportPreview.preview : null;
  const aoReport = typeof aoReportPreview?.preview === 'string' ? aoReportPreview.preview : null;

  const evidenceArtifactRows = evidenceJobId
    ? await ctx.env.D1_MAIN.prepare(
        `
        SELECT artifact_family, object_key
        FROM evidence_artifacts
        WHERE tenant_id = ? AND job_id = ?
        `,
      )
        .bind(access.tenantId, evidenceJobId)
        .all<EvidenceArtifactRow>()
    : { results: [] as EvidenceArtifactRow[] };
  const evidenceArtifactFamilies = new Set(evidenceArtifactRows.results.map((row) => row.artifact_family));
  const requiredEvidenceArtifacts = [
    'validation_report',
    'threat_hunt_findings',
    'threat_hunt_timeline',
    'threat_hunt_queries',
  ];
  const missingEvidenceArtifacts = requiredEvidenceArtifacts.filter(
    (family) => !evidenceArtifactFamilies.has(family),
  );

  const agentEvalLink =
    packageEvidenceLinks.find((item) => readStringField(item, 'family') === 'agent_eval_results') ?? null;
  const agentEvalArtifact = await readR2JsonArtifact<Record<string, unknown>>(
    ctx.env,
    readStringField(agentEvalLink, 'path'),
  );
  const agentEvaluations = normalizeRecordArray(agentEvalArtifact?.evaluations);
  const agentFindingCount = packageFindings.filter((item) =>
    (readStringField(item, 'source_eval_code') ?? '').startsWith('AGENT_'),
  ).length;
  const agentPoamCount = packagePoamItems.filter((item) =>
    (readStringField(item, 'sourceEvalCode') ?? '').startsWith('AGENT_'),
  ).length;
  const agentPassCount = agentEvaluations.filter((item) => readStringField(item, 'status') === 'PASS').length;
  const agentPartialCount = agentEvaluations.filter((item) => readStringField(item, 'status') === 'PARTIAL').length;
  const agentFailCount = agentEvaluations.filter((item) => readStringField(item, 'status') === 'FAIL').length;
  const agentSummaryAligned =
    readStringField(packageAgentSummary, 'run_id') === agentRunId &&
    (readNumberField(packageAgentSummary, 'evaluation_count') ?? -1) === agentEvaluations.length &&
    (readNumberField(packageAgentSummary, 'pass_count') ?? -1) === agentPassCount &&
    (readNumberField(packageAgentSummary, 'partial_count') ?? -1) === agentPartialCount &&
    (readNumberField(packageAgentSummary, 'fail_count') ?? -1) === agentFailCount &&
    (readNumberField(packageAgentSummary, 'gap_count') ?? -1) === agentFindingCount &&
    (readNumberField(packageAgentSummary, 'poam_count') ?? -1) === agentPoamCount;

  const trackerArtifactFamilies: TrackerArtifactFamily[] = [
    'tracker_diagnostics',
    'tracker_gap_report',
    'tracker_gap_matrix',
    'tracker_instrumentation_plan',
  ];
  const trackerArtifactKeys = trackerImport
    ? trackerArtifactFamilies.map((family) => trackerImportArtifactKey(access.tenantId, trackerImport.id, family))
    : [];
  const trackerArtifactObjects = trackerArtifactKeys.length
    ? await Promise.all(trackerArtifactKeys.map((key) => ctx.env.R2_EVIDENCE.get(key)))
    : [];
  const trackerGapMatrix = trackerImport
    ? await readR2TextArtifact(
        ctx.env,
        trackerImportArtifactKey(access.tenantId, trackerImport.id, 'tracker_gap_matrix'),
      )
    : null;
  const trackerPlan = trackerImport
    ? await readR2TextArtifact(
        ctx.env,
        trackerImportArtifactKey(access.tenantId, trackerImport.id, 'tracker_instrumentation_plan'),
      )
    : null;
  const trackerArtifactsReady =
    trackerImport !== null &&
    trackerArtifactObjects.every((object) => object !== null) &&
    typeof trackerGapMatrix === 'string' &&
    trackerGapMatrix.includes('"row_index"') &&
    trackerGapMatrix.includes('"row_status"') &&
    typeof trackerPlan === 'string' &&
    trackerPlan.includes('Tracker Instrumentation Plan');

  const workflowRuns = (await getTenantWorkflowRuns(ctx.env, access.tenantId, 200)).filter(
    (run) =>
      isAssuranceWorkflowModule(run.module) &&
      hasAssuranceScope(access, run.folderId) &&
      workflowMatchesLinkedRecords(
        run,
        new Set(
          [parityPackage.id, evidenceJobId ?? '', agentRunId ?? '', trackerImport?.id ?? ''].filter(Boolean),
        ),
      ),
  );
  const workflowTypes = new Set(workflowRuns.map((run) => run.runType));
  const missingRequiredWorkflowTypes = ['assurance_package', 'assurance_agent'].filter(
    (runType) => !workflowTypes.has(runType),
  );
  const missingRecommendedWorkflowTypes = ['evidence_collection', 'assurance_evaluation'].filter(
    (runType) => !workflowTypes.has(runType),
  );

  const reportRoles = new Set((packageState.summary?.reportManifest ?? []).map((item) => item.role));
  const reportBundleReady =
    ['assessor', 'executive', 'ao', 'assessor_poam_md'].every((role) => reportRoles.has(role)) &&
    typeof assessorReport === 'string' &&
    assessorReport.includes('## Embedded Agent Security') &&
    (!agentRunId || assessorReport.includes(agentRunId)) &&
    typeof executiveReport === 'string' &&
    executiveReport.includes('## Agent Governance') &&
    (!agentRunId || executiveReport.includes(agentRunId)) &&
    typeof aoReport === 'string' &&
    aoReport.includes('## Agent Residual Risk') &&
    (!agentRunId || aoReport.includes(agentRunId));

  const parityReadyInOverview =
    overviewParityReadyPackages.some((item) => item.id === parityPackage.id) &&
    overview.summary.observableParityReadyPackageCount >= 1 &&
    (!agentRunId || overviewAgentRuns.some((item) => item.id === agentRunId));

  const checks: ObservableParityCheck[] = [
    buildObservableParityCheck({
      id: 'parity_package',
      title: 'Threat-hunt parity package',
      status:
        readStringField(packageMetadata, 'bundle_kind') === 'threat-hunt' &&
        readStringField(packageMetadata, 'input_mode') !== null
          ? 'pass'
          : 'fail',
      detail:
        readStringField(packageMetadata, 'bundle_kind') === 'threat-hunt'
          ? `${parityPackage.fileName} is packaged as a threat-hunt bundle with ${readStringField(packageMetadata, 'input_mode') ?? 'unknown'} input mode.`
          : `${parityPackage.fileName} is not currently tagged as a threat-hunt package.`,
      route: packageRoute,
      subjectId: parityPackage.id,
      metrics: {
        bundleKind: readStringField(packageMetadata, 'bundle_kind'),
        inputMode: readStringField(packageMetadata, 'input_mode'),
        passCount: readNumberField(packageSummaryRecord, 'pass_count') ?? 0,
        failCount: readNumberField(packageSummaryRecord, 'fail_count') ?? 0,
      },
    }),
    buildObservableParityCheck({
      id: 'package_contract',
      title: 'Package validation contract',
      status:
        readStringField(validationReport, 'status') === 'pass' &&
        passingValidationChecks.length === requiredValidationChecks.length
          ? 'pass'
          : 'fail',
      detail:
        readStringField(validationReport, 'status') === 'pass'
          ? `Validation passed with ${validationChecks.length} checks, including all required agent-embedding controls.`
          : readStringField(validationReport, 'summary') ??
            'The package validation report is missing one or more required agent-embedding checks.',
      route: `${packageRoute}&artifact=validation_report`,
      subjectId: parityPackage.id,
      metrics: {
        validationStatus: readStringField(validationReport, 'status') ?? 'unknown',
        validationCheckCount: validationChecks.length,
        passingRequiredChecks: passingValidationChecks.length,
        requiredChecks: requiredValidationChecks.length,
      },
    }),
    buildObservableParityCheck({
      id: 'reconciliation',
      title: 'Package reconciliation',
      status: packageState.reconciliation?.status === 'matched' ? 'pass' : 'fail',
      detail:
        packageState.reconciliation?.status === 'matched'
          ? `Package reconciliation matched across ${packageState.reconciliation.checks.length} check(s).`
          : `Reconciliation is ${packageState.reconciliation?.status ?? 'missing'} and needs review before parity can be trusted.`,
      route: `${packageRoute}&artifact=reconciliation`,
      subjectId: parityPackage.id,
      metrics: {
        reconciliationStatus: packageState.reconciliation?.status ?? 'missing',
        checkCount: packageState.reconciliation?.checks.length ?? 0,
      },
    }),
    buildObservableParityCheck({
      id: 'agent_embedding',
      title: 'Agent security embedding',
      status: agentRunId && agentSummaryAligned && agentEvaluations.length > 0 ? 'pass' : 'fail',
      detail:
        agentRunId && agentSummaryAligned && agentEvaluations.length > 0
          ? `Embedded agent security stays aligned with ${agentEvaluations.length} evaluation(s), ${agentFindingCount} finding(s), and ${agentPoamCount} POA&M item(s).`
          : 'The package is missing a linked agent run, a readable agent evaluation artifact, or aligned embedded agent counts.',
      route: agentRoute ?? packageRoute,
      subjectId: agentRunId,
      metrics: {
        agentRunId,
        evaluationCount: agentEvaluations.length,
        passCount: agentPassCount,
        partialCount: agentPartialCount,
        failCount: agentFailCount,
        gapCount: agentFindingCount,
        poamCount: agentPoamCount,
      },
    }),
    buildObservableParityCheck({
      id: 'report_bundle',
      title: 'Assessor and executive report bundle',
      status: reportBundleReady ? 'pass' : 'fail',
      detail: reportBundleReady
        ? `Assessor, executive, AO, and assessor POA&M outputs all include the expected agent-governance narrative.`
        : 'One or more rendered reports are missing or do not embed the expected agent-governance sections.',
      route: `${packageRoute}&artifact=assessor`,
      subjectId: parityPackage.id,
      metrics: {
        reportCount: packageState.summary?.reportManifest.length ?? 0,
        roles: [...reportRoles],
      },
    }),
    buildObservableParityCheck({
      id: 'evidence_artifacts',
      title: 'Evidence artifact contract',
      status: missingEvidenceArtifacts.length === 0 ? 'pass' : 'fail',
      detail:
        missingEvidenceArtifacts.length === 0
          ? `Evidence lineage includes ${requiredEvidenceArtifacts.length} required artifact families for threat-hunt parity.`
          : `The evidence bundle is missing ${missingEvidenceArtifacts.join(', ')}.`,
      route: evidenceRoute,
      subjectId: evidenceJobId,
      metrics: {
        requiredArtifacts: requiredEvidenceArtifacts.length,
        presentArtifacts: requiredEvidenceArtifacts.length - missingEvidenceArtifacts.length,
      },
    }),
    buildObservableParityCheck({
      id: 'tracker_artifacts',
      title: 'Tracker artifact contract',
      status: trackerArtifactsReady ? 'pass' : trackerImport ? 'attention' : 'fail',
      detail: trackerArtifactsReady
        ? `Tracker diagnostics, gap matrix, gap report, and instrumentation plan are all present for ${trackerImport?.name ?? 'the latest import'}.`
        : trackerImport
          ? `Tracker import ${trackerImport.name} exists, but one or more tracker artifact previews are still missing or incomplete.`
          : 'No tracker import artifacts are available for parity validation.',
      route: trackerRoute ?? '/assurance/tracker',
      subjectId: trackerImport?.id ?? null,
      metrics: trackerImport
        ? {
            errorCount: trackerImport.errorCount,
            rowCount: trackerImport.rowCount,
            importedCount: trackerImport.importedCount,
          }
        : null,
    }),
    buildObservableParityCheck({
      id: 'workflow_lineage',
      title: 'Workflow lineage',
      status:
        missingRequiredWorkflowTypes.length > 0
          ? 'fail'
          : missingRecommendedWorkflowTypes.length > 0
            ? 'attention'
            : 'pass',
      detail:
        missingRequiredWorkflowTypes.length > 0
          ? `Workflow lineage is missing required run type(s): ${missingRequiredWorkflowTypes.join(', ')}.`
          : missingRecommendedWorkflowTypes.length > 0
            ? `Required workflow lineage is present, but ${missingRecommendedWorkflowTypes.join(', ')} has not been observed for this parity slice.`
            : `Workflow lineage includes evidence collection, deterministic evaluation, package build, and bounded agent execution.`,
      route: packageRoute,
      subjectId: parityPackage.id,
      metrics: {
        workflowCount: workflowRuns.length,
        runTypes: [...workflowTypes],
      },
    }),
    buildObservableParityCheck({
      id: 'overview_alignment',
      title: 'Command-center alignment',
      status: parityReadyInOverview ? 'pass' : 'attention',
      detail: parityReadyInOverview
        ? 'The assurance overview, parity-ready slice, and agent-run list are all aligned with the selected parity package.'
        : 'The assurance overview is not fully aligned with the selected parity package or linked agent run yet.',
      route: '/assurance',
      subjectId: parityPackage.id,
      metrics: {
        parityReadyPackageCount: overview.summary.observableParityReadyPackageCount,
        agentBackedPackageCount: overview.summary.agentBackedPackageCount,
        pendingWritebackCount: overview.summary.pendingWritebackCount,
      },
    }),
  ];

  return {
    status: summarizeObservableParityStatus(checks),
    generatedAt,
    source: {
      packageId: parityPackage.id,
      packageFileName: parityPackage.fileName,
      packageRoute,
      evidenceJobId,
      evidenceRoute,
      agentRunId,
      agentRoute,
      trackerImportId: trackerImport?.id ?? null,
      trackerRoute,
      bundleKind: readStringField(packageMetadata, 'bundle_kind'),
      inputMode: readStringField(packageMetadata, 'input_mode'),
      updatedAt: parityPackage.updatedAt,
    },
    counts: {
      evidenceJobs: overview.summary.evidenceJobCount,
      trackerImports: overview.summary.trackerImportCount,
      parityReadyPackages: overview.summary.observableParityReadyPackageCount,
      agentBackedPackages: overview.summary.agentBackedPackageCount,
      agentRuns: overview.summary.agentRunCount,
      pendingWritebacks: overview.summary.pendingWritebackCount,
    },
    checks,
  };
}

export async function handleAssuranceRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const [resource, id, action] = segments;

  if (resource === 'overview' && !id && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
    if (access instanceof Response) {
      return access;
    }

    return json({
      data: await loadAssuranceOverview(ctx, access),
    });
  }

  if (resource === 'parity' && id === 'status' && !action && ctx.request.method === 'GET') {
    const adminAccess = await requireRootAdminAccess(
      ctx,
      'Tenant administrator access is required to inspect operational readiness.',
    );
    if (adminAccess instanceof Response) {
      return adminAccess;
    }

    const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
    if (access instanceof Response) {
      return access;
    }

    return json({
      data: await loadObservableParityStatus(ctx, access),
    });
  }

  if (resource === 'workflows' && !id && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
    if (access instanceof Response) {
      return access;
    }

    const linkedRecordIds = ctx.url.searchParams
      .getAll('linkedRecordId')
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter(Boolean);
    const requestedRunTypes = ctx.url.searchParams
      .getAll('runType')
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter(Boolean);
    const linkedRecordIdSet = new Set(linkedRecordIds);
    const runTypeSet = new Set(requestedRunTypes);
    const limit = Math.max(1, Math.min(Number(ctx.url.searchParams.get('limit') ?? '50'), 200));
    const workflowRuns = await getTenantWorkflowRuns(ctx.env, access.tenantId, limit);

    return json({
      data: workflowRuns.filter(
        (run) =>
          isAssuranceWorkflowModule(run.module) &&
          hasAssuranceScope(access, run.folderId) &&
          workflowMatchesLinkedRecords(run, linkedRecordIdSet) &&
          (runTypeSet.size === 0 || runTypeSet.has(run.runType)),
      ),
    });
  }

  if (resource === 'evals' && action === 'run') {
    return methodNotAllowed(['POST']);
  }

  if (resource === 'evals' && ctx.request.method === 'POST' && id === 'run') {
    const access = await requireAnyScopedPermission(
      ctx,
      ['view_evidence', 'collect_evidence'],
      'Running assurance evaluations requires evidence access.',
    );
    if (access instanceof Response) {
      return access;
    }

    const body = await readJson<RunEvalInput>(ctx.request);
    const evidenceJob = await resolveEvidenceJob(ctx, access.tenantId, body.evidenceJobId);
    if (!evidenceJob) {
      return json(
        {
          error: 'evidence_job_not_found',
          message: 'A normalized evidence job is required before evaluations can run.',
        },
        { status: 404 },
      );
    }
    if (!hasAssuranceScope(access, evidenceJob.folder_id)) {
      return json(
        {
          error: 'evidence_job_not_found',
          message: 'A normalized evidence job is required before evaluations can run.',
        },
        { status: 404 },
      );
    }

    const workflowRunId = `assurance-eval:${evidenceJob.id}`;
    await beginWorkflowRun(ctx, access.tenantId, {
      runId: workflowRunId,
      runType: 'assurance_evaluation',
      module: 'Assurance',
      title: 'Deterministic assurance evaluation',
      status: 'Running',
      folderId: evidenceJob.folder_id,
      sourceRecordId: evidenceJob.id,
      route: `/assurance/evidence?evidenceJobId=${encodeURIComponent(evidenceJob.id)}`,
      detail: 'Normalizing the current evidence package into deterministic evaluation artifacts.',
      metadata: {
        evidenceJobId: evidenceJob.id,
      },
    });

    try {
      const bundle = await loadNormalizedBundle(ctx.env, evidenceJob.id);
      if (!bundle) {
        await patchWorkflowRun(ctx, access.tenantId, {
          runId: workflowRunId,
          status: 'Failed',
          detail: 'The selected evidence job does not have a normalized bundle yet.',
        });
        return json(
          {
            error: 'bundle_not_found',
            message: 'The selected evidence job does not have a normalized bundle yet.',
          },
          { status: 409 },
        );
      }

      const artifacts = evaluateNormalizedBundle({
        evidenceJobId: evidenceJob.id,
        bundle,
      });
      await persistEvaluationArtifacts({
        env: ctx.env,
        tenantId: access.tenantId,
        folderId: evidenceJob.folder_id,
        sourceId: evidenceJob.source_id,
        evidenceJobId: evidenceJob.id,
        artifacts,
      });
      await patchWorkflowRun(ctx, access.tenantId, {
        runId: workflowRunId,
        status: artifacts.reviewRecommendations.length > 0 ? 'Awaiting Review' : 'Done',
        detail: `Generated ${artifacts.evalResults.length} deterministic evaluations, ${artifacts.gaps.length} gap(s), and ${artifacts.poamItems.length} POA&M item(s).`,
        metadata: {
          evidenceJobId: evidenceJob.id,
          failingEvaluations: artifacts.summary.failingEvaluations,
          recommendationCount: artifacts.reviewRecommendations.length,
        },
      });

      return json({
        data: artifacts,
      });
    } catch (error) {
      await patchWorkflowRun(ctx, access.tenantId, {
        runId: workflowRunId,
        status: 'Failed',
        detail: error instanceof Error ? error.message : 'Assurance evaluation failed unexpectedly.',
      });
      throw error;
    }
  }

  if (resource === 'evals' && id && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(
      ctx,
      ['view_evidence', 'collect_evidence'],
      'Viewing assurance evaluations requires evidence access.',
    );
    if (access instanceof Response) {
      return access;
    }

    const evidenceJob = await resolveEvidenceJob(ctx, access.tenantId, id);
    if (!evidenceJob || !hasAssuranceScope(access, evidenceJob.folder_id)) {
      return json({ error: 'not_found', message: 'No evaluation artifacts were found for this run.' }, { status: 404 });
    }

    const artifacts = await loadEvaluationArtifacts(ctx.env, id);
    return artifacts
      ? json({ data: artifacts })
      : json({ error: 'not_found', message: 'No evaluation artifacts were found for this run.' }, { status: 404 });
  }

  if (resource === 'gaps' && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
    if (access instanceof Response) {
      return access;
    }

    const evidenceJobId = ctx.url.searchParams.get('evidenceJobId');
    if (!evidenceJobId) {
      return json(
        { error: 'missing_evidence_job', message: 'evidenceJobId is required.' },
        { status: 400 },
      );
    }
    const evidenceJob = await resolveEvidenceJob(ctx, access.tenantId, evidenceJobId);
    if (!evidenceJob || !hasAssuranceScope(access, evidenceJob.folder_id)) {
      return json({ error: 'not_found' }, { status: 404 });
    }
    const artifacts = await loadEvaluationArtifacts(ctx.env, evidenceJobId);
    return artifacts ? json({ data: artifacts.gaps }) : json({ error: 'not_found' }, { status: 404 });
  }

  if (resource === 'poam' && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
    if (access instanceof Response) {
      return access;
    }
    const evidenceJobId = ctx.url.searchParams.get('evidenceJobId');
    if (!evidenceJobId) {
      return json(
        { error: 'missing_evidence_job', message: 'evidenceJobId is required.' },
        { status: 400 },
      );
    }
    const evidenceJob = await resolveEvidenceJob(ctx, access.tenantId, evidenceJobId);
    if (!evidenceJob || !hasAssuranceScope(access, evidenceJob.folder_id)) {
      return json({ error: 'not_found' }, { status: 404 });
    }
    const artifacts = await loadEvaluationArtifacts(ctx.env, evidenceJobId);
    return artifacts ? json({ data: artifacts.poamItems }) : json({ error: 'not_found' }, { status: 404 });
  }

  if (resource === 'graph' && id && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
    if (access instanceof Response) {
      return access;
    }
    const evidenceJob = await resolveEvidenceJob(ctx, access.tenantId, id);
    if (!evidenceJob || !hasAssuranceScope(access, evidenceJob.folder_id)) {
      return json({ error: 'not_found' }, { status: 404 });
    }
    const artifacts = await loadEvaluationArtifacts(ctx.env, id);
    return artifacts ? json({ data: artifacts.graph }) : json({ error: 'not_found' }, { status: 404 });
  }

  if (resource === 'explain' && ctx.request.method === 'POST') {
    const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
    if (access instanceof Response) {
      return access;
    }

    const body = await readJson<ExplainInput>(ctx.request);
    const audience = normalizeExplainAudience(body.audience);

    if (audience === 'tracker') {
      if (!body.importJobId?.trim()) {
        return json(
          { error: 'missing_import_job', message: 'importJobId is required for tracker explanations.' },
          { status: 400 },
        );
      }

      const tracker = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id, tenant_id, folder_id, name
        FROM import_jobs
        WHERE tenant_id = ? AND id = ?
        LIMIT 1
        `,
      )
        .bind(access.tenantId, body.importJobId.trim())
        .first<TrackerImportLookupRow>();

      if (!tracker || !hasAssuranceScope(access, tracker.folder_id)) {
        return json({ error: 'not_found', message: 'Tracker import not found.' }, { status: 404 });
      }

      return json({
        data: await buildAssuranceExplanation({
          env: ctx.env,
          audience,
          importJobId: tracker.id,
          focusId: body.focusId?.trim() || null,
          question: body.question?.trim() || null,
        }),
      });
    }

    if (!body.evidenceJobId?.trim()) {
      return json(
        { error: 'missing_evidence_job', message: 'evidenceJobId is required for this explanation.' },
        { status: 400 },
      );
    }

    const evidenceJob = await resolveEvidenceJob(ctx, access.tenantId, body.evidenceJobId.trim());
    if (!evidenceJob || !hasAssuranceScope(access, evidenceJob.folder_id)) {
      return json({ error: 'not_found', message: 'Evidence job not found.' }, { status: 404 });
    }

    return json({
      data: await buildAssuranceExplanation({
        env: ctx.env,
        audience,
        evidenceJobId: evidenceJob.id,
        focusId: body.focusId?.trim() || null,
        question: body.question?.trim() || null,
      }),
    });
  }

  if (resource === 'tracker' && id === 'imports' && !action && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
    if (access instanceof Response) {
      return access;
    }

    const rows = await ctx.env.D1_MAIN.prepare(
      `
      SELECT id, tenant_id, folder_id, name, source_type, status, row_count, imported_count, error_count,
             summary_json, created_at, updated_at
      FROM import_jobs
      WHERE tenant_id = ? AND run_family = 'tracker_import'
      ORDER BY created_at DESC
      LIMIT 50
      `,
    )
      .bind(access.tenantId)
      .all<TrackerImportListRow>();

    return json({
      data: rows.results
        .filter((row) => hasAssuranceScope(access, row.folder_id))
        .map((row) => ({
          id: row.id,
          tenantId: row.tenant_id,
          folderId: row.folder_id,
          name: row.name,
          sourceType: row.source_type,
          status: row.status,
          rowCount: row.row_count,
          importedCount: row.imported_count,
          errorCount: row.error_count,
          summary: JSON.parse(row.summary_json || '{}') as Record<string, unknown>,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
    });
  }

  if (resource === 'tracker' && id === 'imports' && action && ctx.request.method === 'GET') {
    if (segments[3] === 'artifacts') {
      const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
      if (access instanceof Response) {
        return access;
      }

      const family = segments[4] as TrackerArtifactFamily | undefined;
      if (!family) {
        return json({ error: 'invalid_family', message: 'Artifact family is required.' }, { status: 400 });
      }
      if (
        family !== 'tracker_diagnostics' &&
        family !== 'tracker_gap_report' &&
        family !== 'tracker_gap_matrix' &&
        family !== 'tracker_instrumentation_plan'
      ) {
        return json({ error: 'invalid_family', message: 'Tracker artifact family is not supported.' }, { status: 400 });
      }

      const row = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id, tenant_id, folder_id, updated_at
        FROM import_jobs
        WHERE tenant_id = ? AND run_family = 'tracker_import' AND id = ?
        LIMIT 1
        `,
      )
        .bind(access.tenantId, action)
        .first<{ id: string; tenant_id: string; folder_id: string; updated_at: string }>();

      if (!row || !hasAssuranceScope(access, row.folder_id)) {
        return json({ error: 'not_found', message: 'Tracker import not found.' }, { status: 404 });
      }

      const objectKey = trackerImportArtifactKey(row.tenant_id, row.id, family);
      const object = await ctx.env.R2_EVIDENCE.get(objectKey);
      if (!object) {
        return json({ error: 'not_found', message: 'Tracker artifact not found.' }, { status: 404 });
      }

      const preview =
        family === 'tracker_diagnostics' ? await object.json() : await object.text();

      return json({
        data: {
          family,
          items: [
            {
              id: `${row.id}:${family}`,
              artifactFamily: family,
              objectKey,
              sizeBytes: object.size ?? null,
              contentType: object.httpMetadata?.contentType ?? trackerArtifactContentType(family),
              checksum: object.checksums?.md5 ?? null,
              createdAt: row.updated_at,
            },
          ],
          retrieval: {
            kind: 'r2',
            previewAvailable: true,
          },
          preview,
        },
      });
    }

    const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
    if (access instanceof Response) {
      return access;
    }

    const row = await ctx.env.D1_MAIN.prepare(
      `
      SELECT id, tenant_id, folder_id, name, source_type, status, row_count, imported_count, error_count,
             summary_json, created_at, updated_at
      FROM import_jobs
      WHERE tenant_id = ? AND run_family = 'tracker_import' AND id = ?
      LIMIT 1
      `,
    )
      .bind(access.tenantId, action)
      .first<TrackerImportListRow>();

    if (!row || !hasAssuranceScope(access, row.folder_id)) {
      return json({ error: 'not_found', message: 'Tracker import not found.' }, { status: 404 });
    }

    const [diagnostics, packageRows] = await Promise.all([
      loadTrackerDiagnostics(ctx.env, row.id),
      ctx.env.D1_MAIN.prepare(
        `
        SELECT id, tenant_id, folder_id, source_record, file_name, status, coverage_json, created_at, updated_at
        FROM ai_compliance_export_jobs
        WHERE tenant_id = ? AND run_family = 'assurance_package' AND source_record = ?
        ORDER BY created_at DESC
        `,
      )
        .bind(access.tenantId, row.id)
        .all<PackageListRow>(),
    ]);

    return json({
      data: {
        id: row.id,
        tenantId: row.tenant_id,
        folderId: row.folder_id,
        name: row.name,
        sourceType: row.source_type,
        status: row.status,
        rowCount: row.row_count,
        importedCount: row.imported_count,
        errorCount: row.error_count,
        summary: JSON.parse(row.summary_json || '{}') as Record<string, unknown>,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        diagnostics: diagnostics.map((item) => ({
          rowIndex: item.row_index,
          rowKey: item.row_key,
          rowStatus: item.row_status,
          category: item.category,
          ownerName: item.owner_name,
          gapType: item.gap_type,
          severity: item.severity,
          detail: item.detail,
          controlRefs: JSON.parse(item.control_refs_json || '[]') as string[],
          rawRow: JSON.parse(item.raw_row_json || '{}') as Record<string, unknown>,
        })),
        packages: packageRows.results.map((item) => ({
          id: item.id,
          fileName: item.file_name,
          status: item.status,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })),
      },
    });
  }

  if (resource === 'tracker' && id === 'import' && ctx.request.method === 'POST') {
    const access = await requireAnyScopedPermission(
      ctx,
      ['collect_evidence'],
      'Importing tracker evidence requires evidence-collection permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const body = await readJson<TrackerImportInput>(ctx.request);
    const folderId = body.folderId?.trim();
    if (!folderId) {
      return json({ error: 'invalid_folder', message: 'folderId is required.' }, { status: 400 });
    }
    if (!hasAssuranceScope(access, folderId)) {
      return json(
        {
          error: 'forbidden',
          message: 'You do not have access to import tracker evidence for the selected folder.',
        },
        { status: 403 },
      );
    }
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (rows.length === 0) {
      return json({ error: 'invalid_rows', message: 'rows are required.' }, { status: 400 });
    }

    const jobId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const importSteps = [
      { key: 'parse', label: 'Tracker rows parsed', status: 'completed' },
      { key: 'classify', label: 'Evidence gaps classified', status: 'completed' },
      { key: 'summarize', label: 'Tracker summary published', status: 'completed' },
    ];

    await beginWorkflowRun(ctx, access.tenantId, {
      runId: jobId,
      runType: 'tracker_import',
      module: 'Assurance',
      title: body.name?.trim() || 'Observable tracker import',
      status: 'Running',
      folderId,
      sourceRecordId: jobId,
      route: `/assurance/tracker?importId=${encodeURIComponent(jobId)}`,
      detail: `Parsing ${rows.length} tracker row(s) into assurance diagnostics.`,
      metadata: {
        rowCount: rows.length,
        sourceType: body.sourceType?.trim() || 'assessment_tracker',
      },
    });

    try {
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO import_jobs (
          id, tenant_id, folder_id, created_by_user_id, name, source_type, target_kind, status, row_count,
          imported_count, error_count, steps_json, summary_json, created_objects_json, run_family, input_mode,
          manifest_key, normalization_status, coverage_json, error_summary_json, source_schema_version
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          jobId,
          access.tenantId,
          folderId,
          access.userId,
          body.name?.trim() || 'Observable tracker import',
          body.sourceType?.trim() || 'assessment_tracker',
          'assurance_tracker',
          'running',
          rows.length,
          0,
          0,
          JSON.stringify(importSteps),
          '{}',
          '[]',
          'tracker_import',
          'tracker',
          null,
          'running',
          '{}',
          '{}',
          'v1',
        )
        .run();

      const trackerArtifacts = await createTrackerImportArtifacts({
        env: ctx.env,
        tenantId: access.tenantId,
        folderId,
        importJobId: jobId,
        rows,
      });

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE import_jobs
        SET status = ?,
            imported_count = ?,
            summary_json = ?,
            manifest_key = ?,
            normalization_status = ?,
            coverage_json = ?,
            updated_at = ?
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(
          'completed',
          rows.length,
          JSON.stringify(trackerArtifacts.summary),
          trackerArtifacts.manifestKey,
          'ready',
          JSON.stringify(trackerArtifacts.summary),
          createdAt,
          jobId,
          access.tenantId,
        )
        .run();
      await patchWorkflowRun(ctx, access.tenantId, {
        runId: jobId,
        status: 'Done',
        detail: `Imported ${rows.length} tracker row(s) and published the tracker diagnostics artifact.`,
        metadata: {
          rowCount: rows.length,
          openRows: Number(trackerArtifacts.summary.openRows ?? 0),
        },
      });

      return json({
        data: {
          importJobId: jobId,
          summary: trackerArtifacts.summary,
        },
      }, { status: 201 });
    } catch (error) {
      await patchWorkflowRun(ctx, access.tenantId, {
        runId: jobId,
        status: 'Failed',
        detail: error instanceof Error ? error.message : 'Tracker import failed unexpectedly.',
      });
      throw error;
    }
  }

  if (resource === 'tracker' && id && action === 'to-20x' && ctx.request.method === 'POST') {
    const access = await requireAnyScopedPermission(
      ctx,
      ['collect_evidence'],
      'Tracker-to-20x processing requires evidence-collection permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const tracker = await ctx.env.D1_MAIN.prepare(
      `
      SELECT id, tenant_id, folder_id, name
      FROM import_jobs
      WHERE tenant_id = ? AND id = ?
      LIMIT 1
      `,
    )
      .bind(access.tenantId, id)
      .first<TrackerImportLookupRow>();

    if (!tracker || !hasAssuranceScope(access, tracker.folder_id)) {
      return json({ error: 'not_found', message: 'Tracker import not found.' }, { status: 404 });
    }

    const workflowRunId = crypto.randomUUID();
    await beginWorkflowRun(ctx, access.tenantId, {
      runId: workflowRunId,
      runType: 'tracker_to_20x',
      module: 'Assurance',
      title: `Tracker-to-20x package for ${tracker.name}`,
      status: 'Running',
      folderId: tracker.folder_id,
      sourceRecordId: tracker.id,
      route: `/assurance/tracker?importId=${encodeURIComponent(tracker.id)}`,
      detail: 'Deriving tracker evidence, running deterministic evaluations, and building the 20x package.',
      metadata: {
        trackerImportId: tracker.id,
      },
    });

    try {
      const evidenceJob = await buildAndPersistTrackerDerivedEvidenceJob({
        ctx,
        tenantId: access.tenantId,
        userId: access.userId,
        tracker,
      });
      const bundle = await loadNormalizedBundle(ctx.env, evidenceJob.id);
      if (!bundle) {
        await patchWorkflowRun(ctx, access.tenantId, {
          runId: workflowRunId,
          status: 'Failed',
          detail: 'The derived tracker evidence job did not produce a normalized bundle.',
        });
        return json({ error: 'bundle_not_found' }, { status: 500 });
      }

      const artifacts = evaluateNormalizedBundle({
        evidenceJobId: evidenceJob.id,
        bundle,
      });
      await persistEvaluationArtifacts({
        env: ctx.env,
        tenantId: access.tenantId,
        folderId: evidenceJob.folder_id,
        sourceId: evidenceJob.source_id,
        evidenceJobId: evidenceJob.id,
        artifacts,
      });

      const packageJobId = crypto.randomUUID();
      const fileName = `tracker-${tracker.id}-20x-package.json`;
      const packageState = await buildTwentyXPackage({
        env: ctx.env,
        tenantId: access.tenantId,
        folderId: evidenceJob.folder_id,
        evidenceJobId: evidenceJob.id,
        packageJobId,
        fileName,
        sourceId: evidenceJob.source_id,
        artifacts,
      });

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO ai_compliance_export_jobs (
          id, tenant_id, folder_id, option_id, family, format, title, description, source_record, file_name, status,
          readiness_json, artifact_key, report_export_id, queue_depth, created_by_user_id, created_at, updated_at,
          run_family, manifest_key, coverage_json, error_summary_json, source_schema_version
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          packageJobId,
          access.tenantId,
          evidenceJob.folder_id,
          'assurance-tracker-20x',
          'FedRAMP',
          'JSON',
          'Observable Tracker 20x Package',
          `Tracker-to-20x package for import ${tracker.id}.`,
          tracker.id,
          fileName,
          'Ready',
          JSON.stringify([
            { field: 'evidence_job_id', status: 'Met', notes: evidenceJob.id },
            { field: 'eval_results', status: 'Met', notes: `${artifacts.evalResults.length} evaluation results generated.` },
          ]),
          packageState.summary.packageKey,
          null,
          0,
          access.userId,
          new Date().toISOString(),
          new Date().toISOString(),
          'assurance_package',
          packageState.summary.manifestKey,
          JSON.stringify(packageState.coverage),
          JSON.stringify({
            trackerImportId: tracker.id,
            validationSummary: packageState.validation.summary,
          }),
          'v1',
        )
        .run();

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO assurance_reconciliation_runs (
          id, tenant_id, folder_id, evidence_job_id, package_job_id, status, summary_json, diff_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          packageState.reconciliation.id,
          access.tenantId,
          evidenceJob.folder_id,
          evidenceJob.id,
          packageJobId,
          packageState.reconciliation.status,
          JSON.stringify({
            checks: packageState.reconciliation.checks.length,
          }),
          JSON.stringify({
            checks: packageState.reconciliation.checks,
            mismatches: packageState.reconciliation.checks.filter((item) => item.status === 'mismatch'),
          }),
          new Date().toISOString(),
          new Date().toISOString(),
        )
        .run();
      await patchWorkflowRun(ctx, access.tenantId, {
        runId: workflowRunId,
        status: artifacts.reviewRecommendations.length > 0 ? 'Awaiting Review' : 'Done',
        route: `/assurance/packages?packageId=${encodeURIComponent(packageJobId)}`,
        detail: `Built tracker-derived evidence job ${evidenceJob.id} and package ${packageJobId} with ${artifacts.gaps.length} gap(s).`,
        sourceRecordId: packageJobId,
        metadata: {
          trackerImportId: tracker.id,
          evidenceJobId: evidenceJob.id,
          packageJobId,
          recommendationCount: artifacts.reviewRecommendations.length,
        },
      });

      return json({
        data: {
          evidenceJobId: evidenceJob.id,
          packageJobId,
          reconciliation: packageState.reconciliation,
        },
      });
    } catch (error) {
      await patchWorkflowRun(ctx, access.tenantId, {
        runId: workflowRunId,
        status: 'Failed',
        detail: error instanceof Error ? error.message : 'Tracker-to-20x processing failed unexpectedly.',
      });
      throw error;
    }
  }

  if (resource === 'reviews' && id === 'pending' && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
    if (access instanceof Response) {
      return access;
    }

    return json({
      data: await listPendingReviewRecommendations(ctx.env, access.tenantId, access.accessibleDomainIds),
    });
  }

  if (resource === 'reviews' && id === 'decision' && ctx.request.method === 'POST') {
    const access = await requireAnyScopedPermission(
      ctx,
      ['collect_evidence'],
      'Recording review decisions requires evidence-collection permissions.',
    );
    if (access instanceof Response) {
      return access;
    }
    const body = await readJson<ReviewDecisionInput>(ctx.request);
    if (!body.recommendationId || !body.decision || !body.justification?.trim()) {
      return json(
        {
          error: 'invalid_decision',
          message: 'recommendationId, decision, and justification are required.',
        },
        { status: 400 },
      );
    }

    const recommendation = await ctx.env.D1_MAIN.prepare(
      `
      SELECT id, folder_id, evidence_job_id, title, target_type
      FROM assurance_review_recommendations
      WHERE tenant_id = ? AND id = ?
      LIMIT 1
      `,
    )
      .bind(access.tenantId, body.recommendationId)
      .first<{ id: string; folder_id: string | null; evidence_job_id: string | null; title: string; target_type: string }>();

    if (!recommendation || !hasAssuranceScope(access, recommendation.folder_id)) {
      return json({ error: 'not_found', message: 'Review recommendation not found.' }, { status: 404 });
    }

    const result = await recordReviewDecision({
      env: ctx.env,
      tenantId: access.tenantId,
      userId: access.userId,
      recommendationId: body.recommendationId,
      decision: body.decision.trim(),
      justification: body.justification.trim(),
      evidenceRefs: body.evidenceRefs ?? [],
      findingRefs: body.findingRefs ?? [],
      controlRefs: body.controlRefs ?? [],
    });

    await beginWorkflowRun(ctx, access.tenantId, {
      runId: crypto.randomUUID(),
      runType: 'review_decision',
      module: 'Assurance',
      title: `${body.decision.trim()} review recommendation`,
      status: 'Done',
      folderId: recommendation.folder_id,
      sourceRecordId: recommendation.id,
      route: `/assurance/reviews?recommendationId=${encodeURIComponent(recommendation.id)}${
        recommendation.evidence_job_id ? `&evidenceJobId=${encodeURIComponent(recommendation.evidence_job_id)}` : ''
      }&decisionId=${encodeURIComponent(result.id)}`,
      detail: `Recorded a ${body.decision.trim().toLowerCase()} decision for ${recommendation.target_type} recommendation "${recommendation.title}".`,
      metadata: {
        recommendationId: recommendation.id,
        evidenceJobId: recommendation.evidence_job_id,
        reviewDecisionId: result.id,
        refreshedPackageIds: result.refreshedPackageIds ?? [],
        refreshedPackageCount: result.refreshedPackageCount ?? 0,
        packageRefreshError: result.packageRefreshError ?? null,
      },
    });

    return json({
      data: result,
    });
  }

  if (resource === 'reviews' && id === 'history' && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
    if (access instanceof Response) {
      return access;
    }

    return json({
      data: await loadReviewHistory(ctx.env, access.tenantId, {
        recommendationId: ctx.url.searchParams.get('recommendationId'),
        evidenceJobId: ctx.url.searchParams.get('evidenceJobId'),
      }, access.accessibleDomainIds),
    });
  }

  if (resource === 'packages' && !id && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
    if (access instanceof Response) {
      return access;
    }

    const rows = await ctx.env.D1_MAIN.prepare(
      `
      SELECT package_job.id, package_job.tenant_id, package_job.folder_id, package_job.source_record,
             package_job.file_name, package_job.status, package_job.coverage_json, package_job.created_at,
             package_job.updated_at, reconciliation.status AS reconciliation_status,
             COALESCE(json_extract(package_job.coverage_json, '$.validationStatus'), 'unknown') AS validation_status
      FROM ai_compliance_export_jobs AS package_job
      LEFT JOIN assurance_reconciliation_runs AS reconciliation
        ON reconciliation.id = (
          SELECT latest.id
          FROM assurance_reconciliation_runs AS latest
          WHERE latest.package_job_id = package_job.id
          ORDER BY latest.created_at DESC
          LIMIT 1
        )
      WHERE package_job.tenant_id = ? AND package_job.run_family = 'assurance_package'
      ORDER BY package_job.created_at DESC
      LIMIT 50
      `,
    )
      .bind(access.tenantId)
      .all<PackageListRow>();

    return json({
      data: rows.results
        .filter((row) => hasAssuranceScope(access, row.folder_id))
        .map((row) => ({
          id: row.id,
          tenantId: row.tenant_id,
          folderId: row.folder_id,
          sourceRecord: row.source_record,
          fileName: row.file_name,
          status: row.status,
          coverage: JSON.parse(row.coverage_json || '{}') as Record<string, unknown>,
          reconciliationStatus: row.reconciliation_status,
          validationStatus: row.validation_status,
          validationCheckCount: Number((asJson<Record<string, unknown>>(row.coverage_json, {}) as Record<string, unknown>).validationCheckCount ?? 0),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
    });
  }

  if (resource === 'packages' && id === 'build' && ctx.request.method === 'POST') {
    const access = await requireAnyScopedPermission(
      ctx,
      ['collect_evidence'],
      'Building assurance packages requires evidence-collection permissions.',
    );
    if (access instanceof Response) {
      return access;
    }
    const body = await readJson<PackageBuildInput>(ctx.request);
    if (body.folderId?.trim() && !hasAssuranceScope(access, body.folderId)) {
      return json(
        {
          error: 'forbidden',
          message: 'You do not have access to build packages for the selected folder.',
        },
        { status: 403 },
      );
    }
    const evidenceJob = await resolveEvidenceJob(ctx, access.tenantId, body.evidenceJobId);
    if (!evidenceJob) {
      return json({ error: 'evidence_job_not_found' }, { status: 404 });
    }
    if (!hasAssuranceScope(access, evidenceJob.folder_id)) {
      return json({ error: 'evidence_job_not_found' }, { status: 404 });
    }
    const artifacts = await loadEvaluationArtifacts(ctx.env, evidenceJob.id);
    if (!artifacts) {
      return json(
        {
          error: 'evals_missing',
          message: 'Evaluation artifacts are required before a package can be built.',
        },
        { status: 409 },
      );
    }

    const packageJobId = crypto.randomUUID();
    const fileName = body.fileName?.trim() || `assurance-${evidenceJob.id}-20x-package.json`;
    await beginWorkflowRun(ctx, access.tenantId, {
      runId: packageJobId,
      runType: 'assurance_package',
      module: 'Assurance',
      title: 'FedRAMP 20x package build',
      status: 'Running',
      folderId: body.folderId?.trim() || evidenceJob.folder_id,
      sourceRecordId: evidenceJob.id,
      route: `/assurance/packages?packageId=${encodeURIComponent(packageJobId)}`,
      detail: `Building a deterministic 20x package from evidence job ${evidenceJob.id}.`,
      metadata: {
        evidenceJobId: evidenceJob.id,
        packageJobId,
      },
    });

    try {
      const packageState = await buildTwentyXPackage({
        env: ctx.env,
        tenantId: access.tenantId,
        folderId: body.folderId?.trim() || evidenceJob.folder_id,
        evidenceJobId: evidenceJob.id,
        packageJobId,
        fileName,
        sourceId: evidenceJob.source_id,
        artifacts,
      });

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO ai_compliance_export_jobs (
          id, tenant_id, folder_id, option_id, family, format, title, description, source_record, file_name, status,
          readiness_json, artifact_key, report_export_id, queue_depth, created_by_user_id, created_at, updated_at,
          run_family, manifest_key, coverage_json, error_summary_json, source_schema_version
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          packageJobId,
          access.tenantId,
          body.folderId?.trim() || evidenceJob.folder_id,
          'assurance-fedramp-20x',
          'FedRAMP',
          'JSON',
          'Observable Security Agent 20x Package',
          'Deterministic package and report bundle built from assurance evaluation artifacts.',
          evidenceJob.id,
          fileName,
          'Ready',
          JSON.stringify([
            { field: 'evidence_job_id', status: 'Met', notes: evidenceJob.id },
            { field: 'eval_results', status: 'Met', notes: `${artifacts.evalResults.length} evaluation results generated.` },
          ]),
          packageState.summary.packageKey,
          null,
          0,
          access.userId,
          new Date().toISOString(),
          new Date().toISOString(),
          'assurance_package',
          packageState.summary.manifestKey,
          JSON.stringify(packageState.coverage),
          JSON.stringify({
            evidenceJobId: evidenceJob.id,
            validationSummary: packageState.validation.summary,
          }),
          'v1',
        )
        .run();

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO assurance_reconciliation_runs (
          id, tenant_id, folder_id, evidence_job_id, package_job_id, status, summary_json, diff_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          packageState.reconciliation.id,
          access.tenantId,
          body.folderId?.trim() || evidenceJob.folder_id,
          evidenceJob.id,
          packageJobId,
          packageState.reconciliation.status,
          JSON.stringify({
            checks: packageState.reconciliation.checks.length,
          }),
          JSON.stringify({
            checks: packageState.reconciliation.checks,
            mismatches: packageState.reconciliation.checks.filter((item) => item.status === 'mismatch'),
          }),
          new Date().toISOString(),
          new Date().toISOString(),
        )
        .run();
      await patchWorkflowRun(ctx, access.tenantId, {
        runId: packageJobId,
        status: artifacts.reviewRecommendations.length > 0 ? 'Awaiting Review' : 'Done',
        detail: `Built package ${packageJobId} with ${packageState.summary.evaluationCount} evaluation result(s) and ${packageState.summary.gapCount} gap(s).`,
        sourceRecordId: packageJobId,
        metadata: {
          evidenceJobId: evidenceJob.id,
          packageJobId,
          gapCount: packageState.summary.gapCount,
          poamCount: packageState.summary.poamCount,
          reconciliationStatus: packageState.reconciliation.status,
        },
      });

      return json({
        data: {
          package: packageState.summary,
          reconciliation: packageState.reconciliation,
        },
      }, { status: 201 });
    } catch (error) {
      await patchWorkflowRun(ctx, access.tenantId, {
        runId: packageJobId,
        status: 'Failed',
        detail: error instanceof Error ? error.message : 'Package build failed unexpectedly.',
      });
      throw error;
    }
  }

  if (resource === 'packages' && id && action === 'artifacts' && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
    if (access instanceof Response) {
      return access;
    }

    const family = segments[3];
    if (!family) {
      return json({ error: 'invalid_family', message: 'Artifact family is required.' }, { status: 400 });
    }

    const packageState = await loadPackageSummary(ctx.env, access.tenantId, id);
    if (!hasAssuranceScope(access, packageState.job.folder_id)) {
      return json({ error: 'not_found', message: 'Package job not found.' }, { status: 404 });
    }

    const preview = await loadPackageArtifactPreview(ctx.env, access.tenantId, id, family);
    if (!preview) {
      return json({ error: 'not_found', message: 'Package artifact not found.' }, { status: 404 });
    }

    return json({
      data: {
        family,
        items: [
          {
            id: `${id}:${family}`,
            artifactFamily: family,
            objectKey: preview.objectKey,
            sizeBytes: null,
            contentType: preview.contentType,
            checksum: null,
            createdAt: packageState.job.updated_at,
          },
        ],
        retrieval: {
          kind: 'r2',
          previewAvailable: preview.preview !== null,
        },
        preview: preview.preview,
      },
    });
  }

  if (resource === 'packages' && id && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
    if (access instanceof Response) {
      return access;
    }
    const packageState = await loadPackageSummary(ctx.env, access.tenantId, id);
    if (!hasAssuranceScope(access, packageState.job.folder_id)) {
      return json({ error: 'not_found', message: 'Package job not found.' }, { status: 404 });
    }
    return json({
      data: packageState,
    });
  }

  if (resource === 'reconciliation' && id && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
    if (access instanceof Response) {
      return access;
    }
    const packageState = await loadPackageSummary(ctx.env, access.tenantId, id);
    if (!hasAssuranceScope(access, packageState.job.folder_id)) {
      return json({ error: 'not_found', message: 'Reconciliation record not found.' }, { status: 404 });
    }
    return json({
      data: packageState.reconciliation,
    });
  }

  return json({ error: 'not_found', path: segments.join('/') }, { status: 404 });
}
