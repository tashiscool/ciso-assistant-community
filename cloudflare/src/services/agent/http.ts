import {
  requireAnyScopedPermission,
  requireRootAdminAccess,
  type ScopedPermissionContext,
} from '../../authorization';
import type { WorkerRequestContext } from '../../router';
import {
  startTenantWorkflowRun,
  updateTenantWorkflowRun,
  type WorkflowRunStatus,
} from '../../utils/workflows';
import { json, methodNotAllowed, readJson } from '../../utils/http';
import {
  buildTwentyXPackage,
  evaluateNormalizedBundle,
  loadEvaluationArtifacts,
  loadNormalizedBundle,
  loadPackageSummary,
  persistEvaluationArtifacts,
  refreshPackageArtifactsForEvidenceJob,
} from '../assurance/runtime';
import type { AgentRunTrace, ReviewRecommendation, WritebackApprovalRecord } from '../assurance/types';
import { buildThreatHuntArtifacts } from '../assurance/threatHunt';
import {
  buildObservableAssuranceWorkflow,
  createWorkflowMemory,
  recordWorkflowTaskArtifact,
  recordWorkflowTaskInputs,
  recordWorkflowTaskOutputs,
} from './workflow';
import {
  buildAgentSecurityArtifacts,
  buildAgentInstrumentationPlanMarkdown,
  buildSecureAgentArchitectureMarkdown,
} from './artifacts';

type AgentRunInput = {
  evidenceJobId?: string;
  importJobId?: string;
  folderId?: string;
  requestedWritebacks?: boolean;
};

type ApprovalInput = {
  justification?: string;
};

type EvidenceJobRow = {
  id: string;
  tenant_id: string;
  folder_id: string | null;
  source_id: string;
};

type ConnectorRow = {
  id: string;
  name: string;
  provider: string;
  capabilities_json: string;
};

type AgentRunRow = {
  id: string;
  tenant_id: string;
  folder_id: string | null;
  evidence_job_id: string | null;
  import_job_id: string | null;
  status: string;
  workflow_name: string;
  requested_writebacks: number;
  trace_key: string | null;
  summary_key: string | null;
  summary_json: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type AgentRunListRow = AgentRunRow & {
  approval_count: number;
  pending_writeback_count: number;
};

type AgentStepRow = {
  id: string;
  step_order: number;
  action_category: string;
  action_id: string;
  status: string;
  input_json: string;
  output_json: string;
  started_at: string;
  finished_at: string | null;
};

type PolicyDecisionRow = {
  id: string;
  action_id: string;
  allowed: number;
  category: string;
  reason: string;
  decision_json: string;
};

type ApprovalRow = {
  id: string;
  tenant_id: string;
  folder_id: string | null;
  agent_run_id: string;
  connector_id: string | null;
  request_type: string;
  status: string;
  payload_json: string;
  evidence_refs_json: string;
  requested_by_user_id: string | null;
  reviewed_by_user_id: string | null;
  justification: string | null;
  integration_run_id: string | null;
  created_at: string;
  updated_at: string;
};

type PackageJobRow = {
  id: string;
};

type ExistingPackageStateRow = {
  id: string;
  coverage_json: string;
  error_summary_json: string;
};

type PolicyDecision = {
  allowed: boolean;
  category: 'autonomous' | 'blocked' | 'draft' | 'unknown';
  reason: string;
};

const ALLOWED_PREFIXES: Record<string, string> = {
  'observe.': 'autonomous',
  'plan.': 'autonomous',
  'parse.': 'autonomous',
  'classify.': 'autonomous',
  'normalize.': 'autonomous',
  'evaluate.': 'autonomous',
  'map.': 'autonomous',
  'package.': 'autonomous',
  'report.': 'autonomous',
  'reconcile.': 'autonomous',
  'validate.': 'autonomous',
  'explain.': 'autonomous',
  'draft.': 'draft',
};

const BLOCKED_PREFIXES: Record<string, string> = {
  'ticket_create.': 'real_ticket_create',
  'external_notification.': 'external_notification',
  'workflow_update.': 'workflow_update',
  'cloud_modification.': 'cloud_modification',
  'permission_change.': 'permission_change',
  'destructive_change.': 'destructive_change',
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

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function classifyAction(actionId: string): PolicyDecision {
  for (const [prefix, category] of Object.entries(BLOCKED_PREFIXES)) {
    if (actionId.startsWith(prefix)) {
      return {
        allowed: false,
        category: 'blocked',
        reason: `blocked category: ${category}`,
      };
    }
  }

  for (const [prefix, category] of Object.entries(ALLOWED_PREFIXES)) {
    if (actionId.startsWith(prefix)) {
      return {
        allowed: true,
        category: category as PolicyDecision['category'],
        reason: `matches ${category} workflow contract`,
      };
    }
  }

  return {
    allowed: false,
    category: 'unknown',
    reason: 'action is outside the bounded workflow contract',
  };
}

function traceKey(tenantId: string, runId: string): string {
  return `${tenantId}/assurance/agent-runs/${runId}/trace.json`;
}

function summaryKey(tenantId: string, runId: string): string {
  return `${tenantId}/assurance/agent-runs/${runId}/summary.md`;
}

function taskGraphKey(tenantId: string, runId: string): string {
  return `${tenantId}/assurance/agent-runs/${runId}/task-graph.json`;
}

function workflowMemoryKey(tenantId: string, runId: string): string {
  return `${tenantId}/assurance/agent-runs/${runId}/workflow-memory.json`;
}

function agentEvalResultsKey(tenantId: string, runId: string): string {
  return `${tenantId}/assurance/agent-runs/${runId}/agent-eval-results.json`;
}

function agentRiskReportKey(tenantId: string, runId: string): string {
  return `${tenantId}/assurance/agent-runs/${runId}/agent-risk-report.md`;
}

function agentPoamKey(tenantId: string, runId: string): string {
  return `${tenantId}/assurance/agent-runs/${runId}/agent-poam.csv`;
}

function agentInstrumentationPlanKey(tenantId: string, runId: string): string {
  return `${tenantId}/assurance/agent-runs/${runId}/agent-instrumentation-plan.md`;
}

function secureAgentArchitectureKey(tenantId: string, runId: string): string {
  return `${tenantId}/assurance/agent-runs/${runId}/secure-agent-architecture.md`;
}

function deriveAgentRunStatus(
  status: string,
  summary: Record<string, unknown>,
  writebacks: WritebackApprovalRecord[],
): string {
  const pendingWritebacks = writebacks.filter((item) => item.status === 'pending');
  if (pendingWritebacks.length > 0) {
    return 'awaiting_review';
  }
  if (asStringArray(summary.awaitingReviewReasons).length > 0) {
    return 'awaiting_review';
  }
  return status === 'awaiting_review' ? 'completed' : status;
}

function buildTraceSummaryMarkdown(trace: AgentRunTrace): string {
  const awaitingReviewReasons = asStringArray(trace.summary.awaitingReviewReasons);
  return [
    '# Assurance Agent Run Summary',
    '',
    `Run: ${trace.runId}`,
    `Evidence job: ${trace.evidenceJobId ?? '—'}`,
    `Package job: ${typeof trace.summary.packageJobId === 'string' ? trace.summary.packageJobId : '—'}`,
    '',
    `- Failing evaluations: ${String(trace.summary.failingEvaluations ?? 0)}`,
    `- Open gaps: ${String(trace.summary.openGaps ?? 0)}`,
    `- Threat-hunt findings: ${String(trace.summary.threatHuntFindingCount ?? 0)}`,
    `- Pending writebacks: ${trace.pendingWritebacks.length}`,
    `- Validation status: ${String(trace.summary.validationStatus ?? 'unknown')}`,
    `- Reconciliation status: ${String(trace.summary.reconciliationStatus ?? 'unknown')}`,
    `- Rendered reports: ${String(trace.summary.reportCount ?? 0)}`,
    ...(awaitingReviewReasons.length > 0
      ? ['', '## Awaiting Review Reasons', ...awaitingReviewReasons.map((item) => `- ${item}`)]
      : []),
    '',
    '## Blocked Actions',
    ...trace.policyDecisions
      .filter((decision) => !decision.allowed)
      .map((decision) => `- ${decision.actionId}: ${decision.reason}`),
  ].join('\n');
}

function hasAgentScope(
  access: Pick<ScopedPermissionContext, 'accessibleDomainIds'>,
  folderId: string | null | undefined,
): boolean {
  return !folderId || access.accessibleDomainIds.includes(folderId);
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
    console.warn('Failed to start agent workflow run', error);
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
    console.warn('Failed to update agent workflow run', error);
  }
}

async function ensureEvidenceJob(
  ctx: WorkerRequestContext,
  tenantId: string,
  evidenceJobId: string | undefined,
): Promise<EvidenceJobRow | null> {
  if (!evidenceJobId) {
    return ctx.env.D1_MAIN.prepare(
      `
      SELECT id, tenant_id, folder_id, source_id
      FROM evidence_jobs
      WHERE tenant_id = ? AND normalization_status = 'ready'
      ORDER BY created_at DESC
      LIMIT 1
      `,
    )
      .bind(tenantId)
      .first<EvidenceJobRow>();
  }

  return ctx.env.D1_MAIN.prepare(
    `
    SELECT id, tenant_id, folder_id, source_id
    FROM evidence_jobs
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, evidenceJobId)
    .first<EvidenceJobRow>();
}

async function findConnector(
  env: WorkerRequestContext['env'],
  tenantId: string,
  capability: 'ticket_push' | 'send_alerts',
): Promise<ConnectorRow | null> {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT id, name, provider, capabilities_json
    FROM integration_connectors
    WHERE tenant_id = ? AND is_enabled = 1
    ORDER BY updated_at DESC
    `,
  )
    .bind(tenantId)
    .all<ConnectorRow>();

  return (
    rows.results.find((row) => asJson<string[]>(row.capabilities_json, []).includes(capability)) ?? null
  );
}

async function ensurePackageForAgentRun(args: {
  ctx: WorkerRequestContext;
  tenantId: string;
  userId: string | null;
  evidenceJob: EvidenceJobRow;
}): Promise<{
  packageJobId: string;
  packageKey: string | null;
  manifestKey: string | null;
  validationStatus: string;
  validationCheckCount: number;
  validationSummary: string | null;
  reconciliationStatus: string;
  reportCount: number;
}> {
  const existing = await args.ctx.env.D1_MAIN.prepare(
    `
    SELECT id, coverage_json, error_summary_json
    FROM ai_compliance_export_jobs
    WHERE tenant_id = ? AND source_record = ? AND run_family = 'assurance_package'
    ORDER BY created_at DESC
    LIMIT 1
    `,
  )
    .bind(args.tenantId, args.evidenceJob.id)
    .first<ExistingPackageStateRow>();

  if (existing?.id) {
    const coverage = asJson<Record<string, unknown>>(existing.coverage_json, {});
    const errorSummary = asJson<Record<string, unknown>>(existing.error_summary_json, {});
    const existingSummary = await loadPackageSummary(args.ctx.env, args.tenantId, existing.id).catch(() => null);
    return {
      packageJobId: existing.id,
      packageKey: existingSummary?.summary?.packageKey ?? null,
      manifestKey: existingSummary?.summary?.manifestKey ?? null,
      validationStatus:
        typeof coverage.validationStatus === 'string' ? coverage.validationStatus : 'unknown',
      validationCheckCount:
        typeof coverage.validationCheckCount === 'number' ? coverage.validationCheckCount : 0,
      validationSummary:
        typeof errorSummary.validationSummary === 'string' ? errorSummary.validationSummary : null,
      reconciliationStatus:
        typeof coverage.reconciliationStatus === 'string'
          ? coverage.reconciliationStatus
          : existingSummary?.reconciliation?.status ?? 'unknown',
      reportCount: existingSummary?.summary?.reportManifest.length ?? 0,
    };
  }

  const bundle = await loadNormalizedBundle(args.ctx.env, args.evidenceJob.id);
  if (!bundle) {
    throw new Error('A normalized evidence bundle is required before agent packaging can run.');
  }

  let artifacts = await loadEvaluationArtifacts(args.ctx.env, args.evidenceJob.id);
  if (!artifacts) {
    artifacts = evaluateNormalizedBundle({
      evidenceJobId: args.evidenceJob.id,
      bundle,
    });
    await persistEvaluationArtifacts({
      env: args.ctx.env,
      tenantId: args.tenantId,
      folderId: args.evidenceJob.folder_id,
      sourceId: args.evidenceJob.source_id,
      evidenceJobId: args.evidenceJob.id,
      artifacts,
    });
  }

  const packageJobId = crypto.randomUUID();
  const createdAt = nowIso();
  const packageState = await buildTwentyXPackage({
    env: args.ctx.env,
    tenantId: args.tenantId,
    folderId: args.evidenceJob.folder_id,
    evidenceJobId: args.evidenceJob.id,
    packageJobId,
    fileName: `agent-${args.evidenceJob.id}-20x-package.json`,
    sourceId: args.evidenceJob.source_id,
    artifacts,
  });

  await args.ctx.env.D1_MAIN.prepare(
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
      args.tenantId,
      args.evidenceJob.folder_id,
      'assurance-agent-package',
      'FedRAMP',
      'JSON',
      'Agent-generated 20x Package',
      'Generated during a bounded assurance agent run.',
      args.evidenceJob.id,
      `agent-${args.evidenceJob.id}-20x-package.json`,
      'Ready',
      JSON.stringify([{ field: 'evidence_job_id', status: 'Met', notes: args.evidenceJob.id }]),
      packageState.summary.packageKey,
      null,
      0,
      args.userId,
      createdAt,
      createdAt,
      'assurance_package',
      packageState.summary.manifestKey,
      JSON.stringify({
        evaluationCount: packageState.summary.evaluationCount,
        gapCount: packageState.summary.gapCount,
        poamCount: packageState.summary.poamCount,
        reportCount: packageState.summary.reportManifest.length,
        validationStatus: packageState.validation.status,
        validationCheckCount: packageState.validation.checks.length,
        reconciliationStatus: packageState.reconciliation.status,
      }),
      JSON.stringify({
        validationSummary: packageState.validation.summary,
      }),
      'v1',
    )
    .run();

  await args.ctx.env.D1_MAIN.prepare(
    `
    INSERT INTO assurance_reconciliation_runs (
      id, tenant_id, folder_id, evidence_job_id, package_job_id, status, summary_json, diff_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      packageState.reconciliation.id,
      args.tenantId,
      args.evidenceJob.folder_id,
      args.evidenceJob.id,
      packageJobId,
      packageState.reconciliation.status,
      JSON.stringify({
        checks: packageState.reconciliation.checks.length,
      }),
      JSON.stringify({
        checks: packageState.reconciliation.checks,
        mismatches: packageState.reconciliation.checks.filter((item) => item.status === 'mismatch'),
      }),
      createdAt,
      createdAt,
    )
    .run();

  return {
    packageJobId,
    packageKey: packageState.summary.packageKey,
    manifestKey: packageState.summary.manifestKey,
    validationStatus: packageState.validation.status,
    validationCheckCount: packageState.validation.checks.length,
    validationSummary: packageState.validation.summary,
    reconciliationStatus: packageState.reconciliation.status,
    reportCount: packageState.summary.reportManifest.length,
  };
}

async function buildPendingWritebacks(args: {
  ctx: WorkerRequestContext;
  tenantId: string;
  folderId: string | null;
  userId: string | null;
  agentRunId: string;
  recommendations: ReviewRecommendation[];
}): Promise<WritebackApprovalRecord[]> {
  const ticketConnector = await findConnector(args.ctx.env, args.tenantId, 'ticket_push');
  const alertConnector = await findConnector(args.ctx.env, args.tenantId, 'send_alerts');
  const records: WritebackApprovalRecord[] = [];
  const createdAt = nowIso();

  const criticalRecommendations = args.recommendations.filter(
    (item) => String(item.recommendation.severity ?? '').toLowerCase() === 'critical' || String(item.recommendation.severity ?? '').toLowerCase() === 'high',
  );

  if (ticketConnector && criticalRecommendations.length > 0) {
    records.push({
      id: crypto.randomUUID(),
      agentRunId: args.agentRunId,
      connectorId: ticketConnector.id,
      requestType: 'ticket',
      status: 'pending',
      payload: {
        connectorName: ticketConnector.name,
        recommendations: criticalRecommendations.slice(0, 10).map((item) => ({
          id: item.id,
          title: item.title,
          summary: item.summary,
        })),
      },
      evidenceRefs: criticalRecommendations.map((item) => item.targetId),
      requestedByUserId: args.userId,
      reviewedByUserId: null,
      justification: null,
      integrationRunId: null,
      createdAt,
      updatedAt: createdAt,
    });
  }

  if (alertConnector && criticalRecommendations.length > 0) {
    records.push({
      id: crypto.randomUUID(),
      agentRunId: args.agentRunId,
      connectorId: alertConnector.id,
      requestType: 'notification',
      status: 'pending',
      payload: {
        connectorName: alertConnector.name,
        summary: `${criticalRecommendations.length} high-risk recommendation(s) need notification-ready review.`,
      },
      evidenceRefs: criticalRecommendations.map((item) => item.targetId),
      requestedByUserId: args.userId,
      reviewedByUserId: null,
      justification: null,
      integrationRunId: null,
      createdAt,
      updatedAt: createdAt,
    });
  }

  if (records.length > 0) {
    await args.ctx.env.D1_MAIN.batch(
      records.map((record) =>
        args.ctx.env.D1_MAIN.prepare(
          `
          INSERT INTO assurance_writeback_approvals (
            id, tenant_id, folder_id, agent_run_id, connector_id, request_type, status, payload_json,
            evidence_refs_json, requested_by_user_id, reviewed_by_user_id, justification, integration_run_id, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        ).bind(
          record.id,
          args.tenantId,
          args.folderId,
          record.agentRunId,
          record.connectorId,
          record.requestType,
          record.status,
          JSON.stringify(record.payload),
          JSON.stringify(record.evidenceRefs),
          record.requestedByUserId,
          null,
          null,
          null,
          record.createdAt,
          record.updatedAt,
        ),
      ),
    );
  }

  return records;
}

async function loadWritebackApprovals(
  env: WorkerRequestContext['env'],
  agentRunId: string,
): Promise<WritebackApprovalRecord[]> {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT id, agent_run_id, connector_id, request_type, status, payload_json, evidence_refs_json,
           requested_by_user_id, reviewed_by_user_id, justification, integration_run_id, created_at, updated_at
    FROM assurance_writeback_approvals
    WHERE agent_run_id = ?
    ORDER BY created_at ASC
    `,
  )
    .bind(agentRunId)
    .all<ApprovalRow>();

  return rows.results.map((row) => ({
    id: row.id,
    agentRunId: row.agent_run_id,
    connectorId: row.connector_id,
    requestType: row.request_type,
    status: row.status,
    payload: asJson<Record<string, unknown>>(row.payload_json, {}),
    evidenceRefs: asJson<string[]>(row.evidence_refs_json, []),
    requestedByUserId: row.requested_by_user_id,
    reviewedByUserId: row.reviewed_by_user_id,
    justification: row.justification,
    integrationRunId: row.integration_run_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

async function loadEffectiveTrace(
  env: WorkerRequestContext['env'],
  run: Pick<AgentRunRow, 'id' | 'status' | 'trace_key'>,
): Promise<AgentRunTrace | null> {
  if (!run.trace_key) {
    return null;
  }

  const object = await env.R2_EVIDENCE.get(run.trace_key);
  if (!object) {
    return null;
  }

  const baseTrace = (await object.json()) as AgentRunTrace;
  const writebacks = await loadWritebackApprovals(env, run.id);
  const pendingWritebacks = writebacks.filter((item) => item.status === 'pending').map((item) => item.id);

  return {
    ...baseTrace,
    status: deriveAgentRunStatus(run.status, baseTrace.summary, writebacks),
    summary: {
      ...baseTrace.summary,
      pendingWritebacks: pendingWritebacks.length,
    },
    pendingWritebacks,
  };
}

export async function handleAgentRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const [resource, id, action, actionDetail] = segments;

  if (resource === 'runs' && !id && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
    if (access instanceof Response) {
      return access;
    }

    const rows = await ctx.env.D1_MAIN.prepare(
      `
      SELECT run.id, run.tenant_id, run.folder_id, run.evidence_job_id, run.import_job_id, run.status,
             run.workflow_name, run.requested_writebacks, run.trace_key, run.summary_key, run.summary_json,
             run.created_by_user_id, run.created_at, run.updated_at,
             COUNT(approval.id) AS approval_count,
             COALESCE(SUM(CASE WHEN approval.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_writeback_count
      FROM assurance_agent_runs AS run
      LEFT JOIN assurance_writeback_approvals AS approval
        ON approval.agent_run_id = run.id
      WHERE run.tenant_id = ?
      GROUP BY run.id
      ORDER BY run.created_at DESC
      LIMIT 50
      `,
    )
      .bind(access.tenantId)
      .all<AgentRunListRow>();

    return json({
      data: rows.results
        .filter((row) => hasAgentScope(access, row.folder_id))
        .map((row) => {
          const summary = asJson<Record<string, unknown>>(row.summary_json, {});
          return {
            id: row.id,
            tenantId: row.tenant_id,
            folderId: row.folder_id,
            evidenceJobId: row.evidence_job_id,
            importJobId: row.import_job_id,
            status: deriveAgentRunStatus(
              row.status,
              summary,
              Number(row.pending_writeback_count) > 0
                ? ([{ status: 'pending' }] as WritebackApprovalRecord[])
                : [],
            ),
            workflowName: row.workflow_name,
            requestedWritebacks: Boolean(row.requested_writebacks),
            summary,
            approvalCount: row.approval_count,
            pendingWritebackCount: row.pending_writeback_count,
            createdByUserId: row.created_by_user_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        }),
    });
  }

  if (resource === 'runs' && !id && ctx.request.method === 'POST') {
    const access = await requireAnyScopedPermission(
      ctx,
      ['view_evidence', 'collect_evidence'],
      'Running the assurance agent requires evidence access.',
    );
    if (access instanceof Response) {
      return access;
    }

    const body = await readJson<AgentRunInput>(ctx.request);
    if (body.folderId?.trim() && !hasAgentScope(access, body.folderId)) {
      return json(
        {
          error: 'forbidden',
          message: 'You do not have access to run the assurance agent for the selected folder.',
        },
        { status: 403 },
      );
    }
    const evidenceJob = await ensureEvidenceJob(ctx, access.tenantId, body.evidenceJobId);
    if (!evidenceJob) {
      return json({ error: 'evidence_job_not_found' }, { status: 404 });
    }
    if (!hasAgentScope(access, evidenceJob.folder_id)) {
      return json({ error: 'evidence_job_not_found' }, { status: 404 });
    }
    const runId = crypto.randomUUID();
    const runFolderId = body.folderId?.trim() || evidenceJob.folder_id;
    await beginWorkflowRun(ctx, access.tenantId, {
      runId,
      runType: 'assurance_agent',
      module: 'Agent',
      title: 'Observable assurance agent run',
      status: 'Running',
      folderId: runFolderId,
      sourceRecordId: evidenceJob.id,
      route: `/assurance/agent-runs?runId=${encodeURIComponent(runId)}`,
      detail: `Running the bounded assurance agent against evidence job ${evidenceJob.id}.`,
      metadata: {
        evidenceJobId: evidenceJob.id,
        requestedWritebacks: body.requestedWritebacks !== false,
      },
    });

    try {
      const bundle = await loadNormalizedBundle(ctx.env, evidenceJob.id);
      if (!bundle) {
        await patchWorkflowRun(ctx, access.tenantId, {
          runId,
          status: 'Failed',
          detail: 'A normalized evidence bundle is required before an agent run can start.',
        });
        return json(
          {
            error: 'bundle_not_found',
            message: 'A normalized evidence bundle is required before an agent run can start.',
          },
          { status: 409 },
        );
      }

      let assurance = await loadEvaluationArtifacts(ctx.env, evidenceJob.id);
      if (!assurance) {
        assurance = evaluateNormalizedBundle({
          evidenceJobId: evidenceJob.id,
          bundle,
        });
        await persistEvaluationArtifacts({
          env: ctx.env,
          tenantId: access.tenantId,
          folderId: evidenceJob.folder_id,
          sourceId: evidenceJob.source_id,
          evidenceJobId: evidenceJob.id,
          artifacts: assurance,
        });
      }

      const createdAt = nowIso();
      const packageState = await ensurePackageForAgentRun({
        ctx,
        tenantId: access.tenantId,
        userId: access.userId,
        evidenceJob,
      });
      const threatHunt = buildThreatHuntArtifacts({
        bundle,
        artifacts: assurance,
      });
      const awaitingReviewReasons: string[] = [];
      if (assurance.reviewRecommendations.length > 0) {
        awaitingReviewReasons.push('review recommendations remain pending');
      }
      if (packageState.validationStatus !== 'pass') {
        awaitingReviewReasons.push(`package validation is ${packageState.validationStatus}`);
      }
      if (packageState.reconciliationStatus !== 'matched') {
        awaitingReviewReasons.push(`package reconciliation is ${packageState.reconciliationStatus}`);
      }
      if (threatHunt.findingCount > 0) {
        awaitingReviewReasons.push(`${threatHunt.findingCount} threat-hunt finding(s) require analyst review`);
      }
      const workflowGraph = buildObservableAssuranceWorkflow({
        bundleKind: bundle.bundleKind,
        failingEvaluations: assurance.summary.failingEvaluations,
        openGaps: assurance.gaps.length,
        threatHuntFindingCount: threatHunt.findingCount,
        requestedWritebacks: body.requestedWritebacks !== false,
      });
      const workflowMemory = createWorkflowMemory({
        workflowName: workflowGraph.workflowName,
        globals: {
          runId,
          evidenceJobId: evidenceJob.id,
          importJobId: body.importJobId ?? null,
          bundleKind: bundle.bundleKind,
          requestedWritebacks: body.requestedWritebacks !== false,
        },
      });

      const traceSteps = workflowGraph.tasks.map((task, index) => {
        const input =
          task.actionId === 'observe.bundle_snapshot'
            ? { evidenceJobId: evidenceJob.id }
            : task.actionId === 'plan.assurance_path'
              ? { requestedWritebacks: body.requestedWritebacks ?? true }
              : task.actionId === 'evaluate.deterministic_assurance'
                ? { evidenceJobId: evidenceJob.id }
                : task.actionId === 'evaluate.threat_hunt_findings'
                  ? { bundleKind: bundle.bundleKind }
                  : task.actionId === 'map.gaps_to_recommendations'
                    ? { recommendationCount: assurance.reviewRecommendations.length }
                    : task.actionId === 'package.fedramp20x_bundle'
                      ? { evidenceJobId: evidenceJob.id }
                      : task.actionId === 'report.render_audience_bundles'
                        ? { packageJobId: packageState.packageJobId }
                        : task.actionId === 'reconcile.machine_human_views'
                          ? { packageJobId: packageState.packageJobId }
                          : task.actionId === 'validate.package_contracts'
                            ? { packageJobId: packageState.packageJobId }
                            : task.actionId === 'draft.external_writebacks'
                              ? { requestedWritebacks: body.requestedWritebacks ?? true }
                              : { packageJobId: packageState.packageJobId };

        const output =
          task.actionId === 'observe.bundle_snapshot'
            ? { bundleKind: bundle.bundleKind }
            : task.actionId === 'plan.assurance_path'
              ? {
                  packageJobId: packageState.packageJobId,
                  validationStatus: packageState.validationStatus,
                  reconciliationStatus: packageState.reconciliationStatus,
                }
              : task.actionId === 'evaluate.deterministic_assurance'
                ? { failingEvaluations: assurance.summary.failingEvaluations }
                : task.actionId === 'evaluate.threat_hunt_findings'
                  ? { threatHuntFindingCount: threatHunt.findingCount }
                  : task.actionId === 'map.gaps_to_recommendations'
                    ? { openGaps: assurance.gaps.length }
                    : task.actionId === 'package.fedramp20x_bundle'
                      ? { packageJobId: packageState.packageJobId }
                      : task.actionId === 'report.render_audience_bundles'
                        ? { reportCount: packageState.reportCount }
                        : task.actionId === 'reconcile.machine_human_views'
                          ? { reconciliationStatus: packageState.reconciliationStatus }
                          : task.actionId === 'validate.package_contracts'
                            ? {
                                validationStatus: packageState.validationStatus,
                                validationCheckCount: packageState.validationCheckCount,
                              }
                            : task.actionId === 'draft.external_writebacks'
                              ? { requestedWritebacks: body.requestedWritebacks !== false }
                              : { recommendationCount: assurance.reviewRecommendations.length, awaitingReviewReasons };

        recordWorkflowTaskInputs(workflowMemory, task.taskId, input);
        recordWorkflowTaskOutputs(workflowMemory, task.taskId, output);

        return {
          id: crypto.randomUUID(),
          order: index + 1,
          actionCategory: task.actionCategory,
          actionId: task.actionId,
          status: task.optional && task.actionId === 'evaluate.threat_hunt_findings' && threatHunt.findingCount === 0 ? 'skipped' : 'completed',
          input,
          output,
          startedAt: createdAt,
          finishedAt: createdAt,
        };
      });

      const policyActions = [
        ...workflowGraph.tasks.map((task) => task.actionId),
        'ticket_create.external_system',
        'external_notification.connector_dispatch',
        'workflow_update.status_change',
      ];

      const policyDecisions = policyActions.map((actionId) => {
        const decision = classifyAction(actionId);
        return {
          id: crypto.randomUUID(),
          actionId,
          allowed: decision.allowed,
          category: decision.category,
          reason: decision.reason,
          detail: {
            actionId,
          },
        };
      });

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO assurance_agent_runs (
          id, tenant_id, folder_id, evidence_job_id, import_job_id, status, workflow_name, requested_writebacks,
          trace_key, summary_key, summary_json, created_by_user_id, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          runId,
          access.tenantId,
          runFolderId,
          evidenceJob.id,
          body.importJobId ?? null,
          'running',
          'observable-assurance-agent',
          body.requestedWritebacks === false ? 0 : 1,
          traceKey(access.tenantId, runId),
          summaryKey(access.tenantId, runId),
          JSON.stringify({
            packageJobId: packageState.packageJobId,
            bundleKind: bundle.bundleKind,
            failingEvaluations: assurance.summary.failingEvaluations,
            openGaps: assurance.gaps.length,
            recommendationCount: assurance.reviewRecommendations.length,
            threatHuntFindingCount: threatHunt.findingCount,
            validationStatus: packageState.validationStatus,
            validationCheckCount: packageState.validationCheckCount,
            validationSummary: packageState.validationSummary,
            reconciliationStatus: packageState.reconciliationStatus,
            reportCount: packageState.reportCount,
            awaitingReviewReasons,
          }),
          access.userId,
          createdAt,
          createdAt,
        )
        .run();

      await ctx.env.D1_MAIN.batch([
        ...traceSteps.map((step) =>
          ctx.env.D1_MAIN.prepare(
            `
            INSERT INTO assurance_agent_steps (
              id, agent_run_id, step_order, action_category, action_id, status, input_json, output_json, started_at, finished_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
          ).bind(
            step.id,
            runId,
            step.order,
            step.actionCategory,
            step.actionId,
            step.status,
            JSON.stringify(step.input),
            JSON.stringify(step.output),
            step.startedAt,
            step.finishedAt,
          ),
        ),
        ...policyDecisions.map((decision) =>
          ctx.env.D1_MAIN.prepare(
            `
            INSERT INTO assurance_agent_policy_decisions (
              id, agent_run_id, agent_step_id, action_id, allowed, category, reason, decision_json, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
          ).bind(
            decision.id,
            runId,
            traceSteps.find((step) => step.actionId === decision.actionId)?.id ?? null,
            decision.actionId,
            decision.allowed ? 1 : 0,
            decision.category,
            decision.reason,
            JSON.stringify(decision.detail),
            createdAt,
          ),
        ),
      ]);

      const pendingWritebacks =
        body.requestedWritebacks === false
          ? []
          : await buildPendingWritebacks({
              ctx,
              tenantId: access.tenantId,
              folderId: runFolderId,
              userId: access.userId,
              agentRunId: runId,
              recommendations: assurance.reviewRecommendations,
            });

      const finalStatus =
        pendingWritebacks.length > 0 || awaitingReviewReasons.length > 0
          ? 'awaiting_review'
          : 'completed';

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE assurance_agent_runs
        SET status = ?, updated_at = ?
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(finalStatus, createdAt, runId, access.tenantId)
        .run();

      const trace: AgentRunTrace = {
        runId,
        workflowName: workflowGraph.workflowName,
        status: finalStatus,
        generatedAt: createdAt,
        evidenceJobId: evidenceJob.id,
        importJobId: body.importJobId ?? null,
        summary: {
          packageJobId: packageState.packageJobId,
          packageKey: packageState.packageKey,
          manifestKey: packageState.manifestKey,
          failingEvaluations: assurance.summary.failingEvaluations,
          openGaps: assurance.gaps.length,
          threatHuntFindingCount: threatHunt.findingCount,
          validationStatus: packageState.validationStatus,
          validationCheckCount: packageState.validationCheckCount,
          validationSummary: packageState.validationSummary,
          reconciliationStatus: packageState.reconciliationStatus,
          reportCount: packageState.reportCount,
          pendingWritebacks: pendingWritebacks.length,
          taskCount: workflowGraph.tasks.length,
          optionalTaskCount: workflowGraph.tasks.filter((item) => item.optional).length,
          skippedTaskCount: traceSteps.filter((item) => item.status === 'skipped').length,
          workflowRationale: workflowGraph.rationale,
          awaitingReviewReasons,
        },
        steps: traceSteps,
        policyDecisions,
        pendingWritebacks: pendingWritebacks.map((item) => item.id),
      };

      recordWorkflowTaskArtifact(workflowMemory, 'build_package', 'package_json', packageState.packageKey ?? '');
      recordWorkflowTaskArtifact(workflowMemory, 'render_reports', 'report_manifest', packageState.manifestKey ?? '');
      recordWorkflowTaskArtifact(workflowMemory, 'validate_package', 'validation_report', `package:${packageState.packageJobId}:validation_report`);
      recordWorkflowTaskArtifact(
        workflowMemory,
        'validate_package',
        'agent_eval_results',
        agentEvalResultsKey(access.tenantId, runId),
      );
      recordWorkflowTaskArtifact(
        workflowMemory,
        'map_gaps',
        'agent_poam',
        agentPoamKey(access.tenantId, runId),
      );
      recordWorkflowTaskArtifact(
        workflowMemory,
        'explain_run',
        'agent_risk_report',
        agentRiskReportKey(access.tenantId, runId),
      );
      recordWorkflowTaskArtifact(
        workflowMemory,
        'validate_package',
        'agent_instrumentation_plan',
        agentInstrumentationPlanKey(access.tenantId, runId),
      );
      recordWorkflowTaskArtifact(
        workflowMemory,
        'explain_run',
        'secure_agent_architecture',
        secureAgentArchitectureKey(access.tenantId, runId),
      );
      recordWorkflowTaskArtifact(workflowMemory, 'explain_run', 'trace_json', traceKey(access.tenantId, runId));
      recordWorkflowTaskArtifact(workflowMemory, 'explain_run', 'summary_markdown', summaryKey(access.tenantId, runId));

      const summaryMarkdown = buildTraceSummaryMarkdown(trace);
      const agentInstrumentationPlan = buildAgentInstrumentationPlanMarkdown({
        bundle,
        workflowName: workflowGraph.workflowName,
        policyDecisions,
        pendingWritebackCount: pendingWritebacks.length,
        validationStatus: packageState.validationStatus,
        reconciliationStatus: packageState.reconciliationStatus,
        awaitingReviewReasons,
      });
      const secureAgentArchitecture = buildSecureAgentArchitectureMarkdown({
        bundle,
        workflowGraph,
        evidenceJobId: evidenceJob.id,
        packageJobId: packageState.packageJobId,
        requestedWritebacks: body.requestedWritebacks !== false,
        policyDecisions,
        awaitingReviewReasons,
        pendingWritebackCount: pendingWritebacks.length,
      });
      const agentSecurityArtifacts = buildAgentSecurityArtifacts({
        runId,
        runStatus: finalStatus,
        evidenceJobId: evidenceJob.id,
        packageJobId: packageState.packageJobId,
        runFolderId,
        workflowName: workflowGraph.workflowName,
        bundle,
        workflowGraph,
        workflowMemory,
        policyDecisions,
        requestedWritebacks: body.requestedWritebacks !== false,
        pendingWritebacks,
        awaitingReviewReasons,
        assurance,
        threatHunt,
        reportCount: packageState.reportCount,
        validationStatus: packageState.validationStatus,
        reconciliationStatus: packageState.reconciliationStatus,
      });

      await Promise.all([
        ctx.env.R2_EVIDENCE.put(traceKey(access.tenantId, runId), JSON.stringify(trace, null, 2), {
          httpMetadata: {
            contentType: 'application/json',
          },
        }),
        ctx.env.R2_EVIDENCE.put(taskGraphKey(access.tenantId, runId), JSON.stringify(workflowGraph, null, 2), {
          httpMetadata: {
            contentType: 'application/json',
          },
        }),
        ctx.env.R2_EVIDENCE.put(workflowMemoryKey(access.tenantId, runId), JSON.stringify(workflowMemory, null, 2), {
          httpMetadata: {
            contentType: 'application/json',
          },
        }),
        ctx.env.R2_EVIDENCE.put(summaryKey(access.tenantId, runId), summaryMarkdown, {
          httpMetadata: {
            contentType: 'text/markdown; charset=utf-8',
          },
        }),
        ctx.env.R2_EVIDENCE.put(
          agentEvalResultsKey(access.tenantId, runId),
          JSON.stringify(agentSecurityArtifacts.evalResultsDocument, null, 2),
          {
            httpMetadata: {
              contentType: 'application/json',
            },
          },
        ),
        ctx.env.R2_EVIDENCE.put(
          agentRiskReportKey(access.tenantId, runId),
          agentSecurityArtifacts.riskReportMarkdown,
          {
            httpMetadata: {
              contentType: 'text/markdown; charset=utf-8',
            },
          },
        ),
        ctx.env.R2_EVIDENCE.put(agentPoamKey(access.tenantId, runId), agentSecurityArtifacts.poamCsv, {
          httpMetadata: {
            contentType: 'text/csv; charset=utf-8',
          },
        }),
        ctx.env.R2_EVIDENCE.put(agentInstrumentationPlanKey(access.tenantId, runId), agentInstrumentationPlan, {
          httpMetadata: {
            contentType: 'text/markdown; charset=utf-8',
          },
        }),
        ctx.env.R2_EVIDENCE.put(secureAgentArchitectureKey(access.tenantId, runId), secureAgentArchitecture, {
          httpMetadata: {
            contentType: 'text/markdown; charset=utf-8',
          },
        }),
      ]);
      await refreshPackageArtifactsForEvidenceJob({
        env: ctx.env,
        tenantId: access.tenantId,
        evidenceJobId: evidenceJob.id,
      });
      await patchWorkflowRun(ctx, access.tenantId, {
        runId,
        status: finalStatus === 'awaiting_review' ? 'Awaiting Review' : 'Done',
        detail: `Completed the bounded agent run with ${assurance.summary.failingEvaluations} failing evaluation(s) and ${pendingWritebacks.length} pending writeback(s).`,
        sourceRecordId: runId,
        metadata: {
          evidenceJobId: evidenceJob.id,
          packageJobId: packageState.packageJobId,
          pendingWritebacks: pendingWritebacks.length,
          failingEvaluations: assurance.summary.failingEvaluations,
          threatHuntFindingCount: threatHunt.findingCount,
          validationStatus: packageState.validationStatus,
          reconciliationStatus: packageState.reconciliationStatus,
          awaitingReviewReasons,
        },
      });

      return json({
        data: {
          trace,
          writebacks: pendingWritebacks,
        },
      }, { status: 201 });
    } catch (error) {
      await patchWorkflowRun(ctx, access.tenantId, {
        runId,
        status: 'Failed',
        detail: error instanceof Error ? error.message : 'Agent run failed unexpectedly.',
      });
      throw error;
    }
  }

  if (resource === 'runs' && id && !action && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
    if (access instanceof Response) {
      return access;
    }

    const run = await ctx.env.D1_MAIN.prepare(
      `
      SELECT id, tenant_id, folder_id, evidence_job_id, import_job_id, status, workflow_name, requested_writebacks,
             trace_key, summary_key, summary_json, created_by_user_id, created_at, updated_at
      FROM assurance_agent_runs
      WHERE tenant_id = ? AND id = ?
      LIMIT 1
      `,
    )
      .bind(access.tenantId, id)
      .first<AgentRunRow>();

    if (!run) {
      return json({ error: 'not_found', message: 'Agent run not found.' }, { status: 404 });
    }
    if (!hasAgentScope(access, run.folder_id)) {
      return json({ error: 'not_found', message: 'Agent run not found.' }, { status: 404 });
    }

    const writebacks = await loadWritebackApprovals(ctx.env, run.id);
    const summary = asJson<Record<string, unknown>>(run.summary_json, {});
    return json({
      data: {
        ...run,
        status: deriveAgentRunStatus(run.status, summary, writebacks),
        summary,
        writebacks,
      },
    });
  }

  if (resource === 'runs' && id && action === 'trace' && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
    if (access instanceof Response) {
      return access;
    }

    const run = await ctx.env.D1_MAIN.prepare(
      `
      SELECT id, status, trace_key, folder_id
      FROM assurance_agent_runs
      WHERE tenant_id = ? AND id = ?
      LIMIT 1
      `,
    )
      .bind(access.tenantId, id)
      .first<{ id: string; status: string; trace_key: string | null; folder_id: string | null }>();

    if (!run?.trace_key || !hasAgentScope(access, run.folder_id)) {
      return json({ error: 'not_found', message: 'Agent trace not found.' }, { status: 404 });
    }

    const trace = await loadEffectiveTrace(ctx.env, {
      id: run.id,
      status: run.status,
      trace_key: run.trace_key,
    });
    if (!trace) {
      return json({ error: 'not_found', message: 'Agent trace artifact is missing.' }, { status: 404 });
    }

    return json({
      data: trace,
    });
  }

  if (resource === 'runs' && id && action === 'artifacts' && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(ctx, ['view_evidence', 'collect_evidence']);
    if (access instanceof Response) {
      return access;
    }

    const family = actionDetail;
    if (!family) {
      return json({ error: 'invalid_family', message: 'Artifact family is required.' }, { status: 400 });
    }

    const run = await ctx.env.D1_MAIN.prepare(
      `
      SELECT id, tenant_id, folder_id, evidence_job_id, import_job_id, status, workflow_name, requested_writebacks,
             trace_key, summary_key, summary_json, created_by_user_id, created_at, updated_at
      FROM assurance_agent_runs
      WHERE tenant_id = ? AND id = ?
      LIMIT 1
      `,
    )
      .bind(access.tenantId, id)
      .first<AgentRunRow>();

    if (!run || !hasAgentScope(access, run.folder_id)) {
      return json({ error: 'not_found', message: 'Agent run not found.' }, { status: 404 });
    }

    if (family === 'trace_json' && run.trace_key) {
      const object = await ctx.env.R2_EVIDENCE.get(run.trace_key);
      if (!object) {
        return json({ error: 'not_found', message: 'Agent trace artifact is missing.' }, { status: 404 });
      }

      const trace = await loadEffectiveTrace(ctx.env, run);
      if (!trace) {
        return json({ error: 'not_found', message: 'Agent trace artifact is missing.' }, { status: 404 });
      }

      return json({
        data: {
          family,
          items: [
            {
              id: `${run.id}:${family}`,
              artifactFamily: family,
              objectKey: run.trace_key,
              sizeBytes: object.size ?? null,
              contentType: object.httpMetadata?.contentType ?? 'application/json',
              checksum: object.checksums?.md5 ?? null,
              createdAt: run.updated_at,
            },
          ],
          retrieval: {
            kind: 'r2',
            previewAvailable: true,
          },
          preview: trace,
        },
      });
    }

    if (family === 'summary_markdown' && run.summary_key) {
      const object = await ctx.env.R2_EVIDENCE.get(run.summary_key);
      if (!object) {
        return json({ error: 'not_found', message: 'Agent summary artifact is missing.' }, { status: 404 });
      }

      const trace = await loadEffectiveTrace(ctx.env, run);
      const preview = trace ? buildTraceSummaryMarkdown(trace) : await object.text();

      return json({
        data: {
          family,
          items: [
            {
              id: `${run.id}:${family}`,
              artifactFamily: family,
              objectKey: run.summary_key,
              sizeBytes: object.size ?? null,
              contentType: object.httpMetadata?.contentType ?? 'text/markdown; charset=utf-8',
              checksum: object.checksums?.md5 ?? null,
              createdAt: run.updated_at,
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

    if (family === 'task_graph') {
      const objectKey = taskGraphKey(run.tenant_id, run.id);
      const object = await ctx.env.R2_EVIDENCE.get(objectKey);
      if (!object) {
        return json({ error: 'not_found', message: 'Agent task-graph artifact is missing.' }, { status: 404 });
      }

      return json({
        data: {
          family,
          items: [
            {
              id: `${run.id}:${family}`,
              artifactFamily: family,
              objectKey,
              sizeBytes: object.size ?? null,
              contentType: object.httpMetadata?.contentType ?? 'application/json',
              checksum: object.checksums?.md5 ?? null,
              createdAt: run.updated_at,
            },
          ],
          retrieval: {
            kind: 'r2',
            previewAvailable: true,
          },
          preview: await object.json(),
        },
      });
    }

    if (family === 'agent_eval_results') {
      const objectKey = agentEvalResultsKey(run.tenant_id, run.id);
      const object = await ctx.env.R2_EVIDENCE.get(objectKey);
      if (!object) {
        return json({ error: 'not_found', message: 'Agent eval-results artifact is missing.' }, { status: 404 });
      }

      return json({
        data: {
          family,
          items: [
            {
              id: `${run.id}:${family}`,
              artifactFamily: family,
              objectKey,
              sizeBytes: object.size ?? null,
              contentType: object.httpMetadata?.contentType ?? 'application/json',
              checksum: object.checksums?.md5 ?? null,
              createdAt: run.updated_at,
            },
          ],
          retrieval: {
            kind: 'r2',
            previewAvailable: true,
          },
          preview: await object.json(),
        },
      });
    }

    if (family === 'agent_risk_report') {
      const objectKey = agentRiskReportKey(run.tenant_id, run.id);
      const object = await ctx.env.R2_EVIDENCE.get(objectKey);
      if (!object) {
        return json({ error: 'not_found', message: 'Agent risk-report artifact is missing.' }, { status: 404 });
      }

      return json({
        data: {
          family,
          items: [
            {
              id: `${run.id}:${family}`,
              artifactFamily: family,
              objectKey,
              sizeBytes: object.size ?? null,
              contentType: object.httpMetadata?.contentType ?? 'text/markdown; charset=utf-8',
              checksum: object.checksums?.md5 ?? null,
              createdAt: run.updated_at,
            },
          ],
          retrieval: {
            kind: 'r2',
            previewAvailable: true,
          },
          preview: await object.text(),
        },
      });
    }

    if (family === 'agent_poam') {
      const objectKey = agentPoamKey(run.tenant_id, run.id);
      const object = await ctx.env.R2_EVIDENCE.get(objectKey);
      if (!object) {
        return json({ error: 'not_found', message: 'Agent POA&M artifact is missing.' }, { status: 404 });
      }

      return json({
        data: {
          family,
          items: [
            {
              id: `${run.id}:${family}`,
              artifactFamily: family,
              objectKey,
              sizeBytes: object.size ?? null,
              contentType: object.httpMetadata?.contentType ?? 'text/csv; charset=utf-8',
              checksum: object.checksums?.md5 ?? null,
              createdAt: run.updated_at,
            },
          ],
          retrieval: {
            kind: 'r2',
            previewAvailable: true,
          },
          preview: await object.text(),
        },
      });
    }

    if (family === 'workflow_memory') {
      const objectKey = workflowMemoryKey(run.tenant_id, run.id);
      const object = await ctx.env.R2_EVIDENCE.get(objectKey);
      if (!object) {
        return json({ error: 'not_found', message: 'Agent workflow-memory artifact is missing.' }, { status: 404 });
      }

      return json({
        data: {
          family,
          items: [
            {
              id: `${run.id}:${family}`,
              artifactFamily: family,
              objectKey,
              sizeBytes: object.size ?? null,
              contentType: object.httpMetadata?.contentType ?? 'application/json',
              checksum: object.checksums?.md5 ?? null,
              createdAt: run.updated_at,
            },
          ],
          retrieval: {
            kind: 'r2',
            previewAvailable: true,
          },
          preview: await object.json(),
        },
      });
    }

    if (family === 'agent_instrumentation_plan') {
      const objectKey = agentInstrumentationPlanKey(run.tenant_id, run.id);
      const object = await ctx.env.R2_EVIDENCE.get(objectKey);
      if (!object) {
        return json({ error: 'not_found', message: 'Agent instrumentation-plan artifact is missing.' }, { status: 404 });
      }

      return json({
        data: {
          family,
          items: [
            {
              id: `${run.id}:${family}`,
              artifactFamily: family,
              objectKey,
              sizeBytes: object.size ?? null,
              contentType: object.httpMetadata?.contentType ?? 'text/markdown; charset=utf-8',
              checksum: object.checksums?.md5 ?? null,
              createdAt: run.updated_at,
            },
          ],
          retrieval: {
            kind: 'r2',
            previewAvailable: true,
          },
          preview: await object.text(),
        },
      });
    }

    if (family === 'secure_agent_architecture') {
      const objectKey = secureAgentArchitectureKey(run.tenant_id, run.id);
      const object = await ctx.env.R2_EVIDENCE.get(objectKey);
      if (!object) {
        return json({ error: 'not_found', message: 'Secure agent architecture artifact is missing.' }, { status: 404 });
      }

      return json({
        data: {
          family,
          items: [
            {
              id: `${run.id}:${family}`,
              artifactFamily: family,
              objectKey,
              sizeBytes: object.size ?? null,
              contentType: object.httpMetadata?.contentType ?? 'text/markdown; charset=utf-8',
              checksum: object.checksums?.md5 ?? null,
              createdAt: run.updated_at,
            },
          ],
          retrieval: {
            kind: 'r2',
            previewAvailable: true,
          },
          preview: await object.text(),
        },
      });
    }

    if (family === 'blocked_actions') {
      const decisions = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id, action_id, allowed, category, reason, decision_json
        FROM assurance_agent_policy_decisions
        WHERE agent_run_id = ? AND allowed = 0
        ORDER BY created_at ASC
        `,
      )
        .bind(run.id)
        .all<PolicyDecisionRow>();

      return json({
        data: {
          family,
          items: [
            {
              id: `${run.id}:${family}`,
              artifactFamily: family,
              objectKey: `inline:${run.id}:${family}`,
              sizeBytes: null,
              contentType: 'application/json',
              checksum: null,
              createdAt: run.updated_at,
            },
          ],
          retrieval: {
            kind: 'inline',
            previewAvailable: true,
          },
          preview: decisions.results.map((decision) => ({
            id: decision.id,
            actionId: decision.action_id,
            allowed: Boolean(decision.allowed),
            category: decision.category,
            reason: decision.reason,
            detail: asJson<Record<string, unknown>>(decision.decision_json, {}),
          })),
        },
      });
    }

    if (family === 'writeback_requests') {
      return json({
        data: {
          family,
          items: [
            {
              id: `${run.id}:${family}`,
              artifactFamily: family,
              objectKey: `inline:${run.id}:${family}`,
              sizeBytes: null,
              contentType: 'application/json',
              checksum: null,
              createdAt: run.updated_at,
            },
          ],
          retrieval: {
            kind: 'inline',
            previewAvailable: true,
          },
          preview: await loadWritebackApprovals(ctx.env, run.id),
        },
      });
    }

    return json({ error: 'not_found', message: 'Agent artifact not found.' }, { status: 404 });
  }

  if (resource === 'writebacks' && id && action === 'approve' && ctx.request.method === 'POST') {
    const adminAccess = await requireRootAdminAccess(
      ctx,
      'Approving external writebacks requires tenant administrator access.',
    );
    if (adminAccess instanceof Response) {
      return adminAccess;
    }

    const body = await readJson<ApprovalInput>(ctx.request);
    const approval = await ctx.env.D1_MAIN.prepare(
      `
      SELECT id, tenant_id, folder_id, agent_run_id, connector_id, request_type, status, payload_json, evidence_refs_json,
             requested_by_user_id, reviewed_by_user_id, justification, integration_run_id, created_at, updated_at
      FROM assurance_writeback_approvals
      WHERE id = ? AND tenant_id = ?
      LIMIT 1
      `,
    )
      .bind(id, adminAccess.tenantId)
      .first<ApprovalRow>();

    if (!approval) {
      return json({ error: 'not_found', message: 'Writeback approval request not found.' }, { status: 404 });
    }
    if (approval.status !== 'pending') {
      return json({ error: 'invalid_state', message: 'Only pending writebacks can be approved.' }, { status: 409 });
    }

    const connectorId = approval.connector_id;
    if (!connectorId) {
      return json({ error: 'missing_connector', message: 'No connector is linked to this writeback.' }, { status: 409 });
    }

    const integrationRunId = crypto.randomUUID();
    const timestamp = nowIso();
    const payload = asJson<Record<string, unknown>>(approval.payload_json, {});
    await ctx.env.D1_MAIN.batch([
      ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO integration_connector_runs (
          id, tenant_id, connector_id, action_type, status, summary_json, started_at, finished_at, triggered_by_user_id,
          folder_id, run_family, input_mode, manifest_key, normalization_status, coverage_json, error_summary_json, source_schema_version
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).bind(
        integrationRunId,
        adminAccess.tenantId,
        connectorId,
        'writeback',
        'completed',
        JSON.stringify({
          requestType: approval.request_type,
          payload,
          approvedBy: adminAccess.userId,
          justification: body.justification?.trim() || 'Approved from assurance agent review queue.',
        }),
        timestamp,
        timestamp,
        adminAccess.userId,
        approval.folder_id ?? adminAccess.rootFolderId,
        'connector_writeback',
        'live',
        null,
        'ready',
        JSON.stringify({
          requestType: approval.request_type,
        }),
        '{}',
        'v1',
      ),
      ctx.env.D1_MAIN.prepare(
        `
        UPDATE assurance_writeback_approvals
        SET status = 'approved',
            reviewed_by_user_id = ?,
            justification = ?,
            integration_run_id = ?,
            updated_at = ?
        WHERE id = ?
        `,
      ).bind(
        adminAccess.userId,
        body.justification?.trim() || 'Approved from assurance agent review queue.',
        integrationRunId,
        timestamp,
        id,
      ),
    ]);

    const remainingPending = await ctx.env.D1_MAIN.prepare(
      `
      SELECT COUNT(*) AS count
      FROM assurance_writeback_approvals
      WHERE agent_run_id = ? AND status = 'pending'
      `,
    )
      .bind(approval.agent_run_id)
      .first<{ count: number | null }>();

    if (Number(remainingPending?.count ?? 0) === 0) {
      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE assurance_agent_runs
        SET status = 'completed', updated_at = ?
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(timestamp, approval.agent_run_id, adminAccess.tenantId)
        .run();
      await patchWorkflowRun(ctx, adminAccess.tenantId, {
        runId: approval.agent_run_id,
        status: 'Done',
        detail: 'All pending external writeback approvals were resolved.',
      });
    }

    await beginWorkflowRun(ctx, adminAccess.tenantId, {
      runId: crypto.randomUUID(),
      runType: 'writeback_approval',
      module: 'Agent',
      title: 'Approved external writeback',
      status: 'Done',
      folderId: approval.folder_id ?? null,
      sourceRecordId: id,
      route: `/assurance/agent-runs?runId=${encodeURIComponent(approval.agent_run_id)}&writebackId=${encodeURIComponent(id)}`,
      detail: `Approved ${approval.request_type} writeback and dispatched integration run ${integrationRunId}.`,
      metadata: {
        agentRunId: approval.agent_run_id,
        writebackApprovalId: id,
        integrationRunId,
        requestType: approval.request_type,
      },
    });

    return json({
      data: {
        approvalId: id,
        integrationRunId,
        status: 'approved',
      },
    });
  }

  if (resource === 'writebacks' && id && action === 'reject' && ctx.request.method === 'POST') {
    const adminAccess = await requireRootAdminAccess(
      ctx,
      'Rejecting external writebacks requires tenant administrator access.',
    );
    if (adminAccess instanceof Response) {
      return adminAccess;
    }
    const body = await readJson<ApprovalInput>(ctx.request);
    const timestamp = nowIso();
    const approval = await ctx.env.D1_MAIN.prepare(
      `
      SELECT agent_run_id, folder_id, request_type, status
      FROM assurance_writeback_approvals
      WHERE id = ? AND tenant_id = ?
      LIMIT 1
      `,
    )
      .bind(id, adminAccess.tenantId)
      .first<{ agent_run_id: string; folder_id: string | null; request_type: string; status: string }>();

    if (!approval) {
      return json({ error: 'not_found', message: 'Writeback approval request not found.' }, { status: 404 });
    }
    if (approval.status !== 'pending') {
      return json({ error: 'invalid_state', message: 'Only pending writebacks can be rejected.' }, { status: 409 });
    }

    await ctx.env.D1_MAIN.prepare(
      `
      UPDATE assurance_writeback_approvals
      SET status = 'rejected',
          reviewed_by_user_id = ?,
          justification = ?,
          updated_at = ?
      WHERE id = ? AND tenant_id = ?
      `,
    )
      .bind(
        adminAccess.userId,
        body.justification?.trim() || 'Rejected from assurance agent review queue.',
        timestamp,
        id,
        adminAccess.tenantId,
      )
      .run();

    if (approval.agent_run_id) {
      const remainingPending = await ctx.env.D1_MAIN.prepare(
        `
        SELECT COUNT(*) AS count
        FROM assurance_writeback_approvals
        WHERE agent_run_id = ? AND status = 'pending'
        `,
      )
        .bind(approval.agent_run_id)
        .first<{ count: number | null }>();

      if (Number(remainingPending?.count ?? 0) === 0) {
        await ctx.env.D1_MAIN.prepare(
          `
          UPDATE assurance_agent_runs
          SET status = 'completed', updated_at = ?
          WHERE id = ? AND tenant_id = ?
          `,
        )
          .bind(timestamp, approval.agent_run_id, adminAccess.tenantId)
          .run();
        await patchWorkflowRun(ctx, adminAccess.tenantId, {
          runId: approval.agent_run_id,
          status: 'Done',
          detail: 'All pending external writeback approvals were resolved.',
        });
      }

      await beginWorkflowRun(ctx, adminAccess.tenantId, {
        runId: crypto.randomUUID(),
        runType: 'writeback_rejection',
        module: 'Agent',
        title: 'Rejected external writeback',
        status: 'Done',
        folderId: approval.folder_id ?? null,
        sourceRecordId: id,
        route: `/assurance/agent-runs?runId=${encodeURIComponent(approval.agent_run_id)}&writebackId=${encodeURIComponent(id)}`,
        detail: `Rejected ${approval.request_type} writeback from the assurance agent queue.`,
        metadata: {
          agentRunId: approval.agent_run_id,
          writebackApprovalId: id,
          requestType: approval.request_type,
        },
      });
    }

    return json({
      data: {
        approvalId: id,
        status: 'rejected',
      },
    });
  }

  if (resource === 'runs' || resource === 'writebacks') {
    return methodNotAllowed(['GET', 'POST']);
  }

  return json({ error: 'not_found', path: segments.join('/') }, { status: 404 });
}
