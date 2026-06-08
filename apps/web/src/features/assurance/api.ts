import { ApiClient } from '../../shared/api/client';
import type {
  AgentRunDetail,
  AgentRunListItem,
  AgentRunTrace,
  AssuranceExplainAudience,
  AssuranceExplanation,
  AssuranceArtifactPreview,
  AssuranceEvidenceJob,
  AssuranceEvidenceJobDetail,
  AssuranceOverview,
  AssuranceParityStatus,
  AssuranceWorkflowRun,
  EvaluationArtifacts,
  PackageDetail,
  TwentyXPackageDocument,
  PackageListItem,
  ReconciliationSummary,
  ReviewDecision,
  ReviewRecommendation,
  TrackerImportDetail,
  TrackerImportSummary,
  WritebackApproval,
} from './types';

const client = new ApiClient();

export async function getAssuranceOverview() {
  const response = await client.get<{ data: AssuranceOverview }>('/assurance/overview');
  return response.data;
}

export async function getObservableParityStatus() {
  const response = await client.get<{ data: AssuranceParityStatus }>('/assurance/parity/status');
  return response.data;
}

export async function listEvidenceJobs() {
  const response = await client.get<{ data: AssuranceEvidenceJob[] }>('/evidence/jobs');
  return response.data;
}

export async function getEvidenceJob(jobId: string) {
  const response = await client.get<{ data: AssuranceEvidenceJobDetail }>(`/evidence/jobs/${jobId}`);
  return response.data;
}

export async function getEvidenceArtifactPreview(jobId: string, family: string) {
  const response = await client.get<{ data: AssuranceArtifactPreview }>(
    `/evidence/jobs/${jobId}/artifacts/${family}`,
  );
  return response.data;
}

export async function runAssuranceEvaluation(evidenceJobId: string) {
  const response = await client.post<{ data: EvaluationArtifacts }>('/assurance/evals/run', { evidenceJobId });
  return response.data;
}

export async function getAssuranceEvaluation(evidenceJobId: string) {
  const response = await client.get<{ data: EvaluationArtifacts }>(`/assurance/evals/${evidenceJobId}`);
  return response.data;
}

export async function explainAssurance(body: {
  audience: AssuranceExplainAudience;
  evidenceJobId?: string;
  importJobId?: string;
  focusId?: string;
  question?: string;
}) {
  const response = await client.post<{ data: AssuranceExplanation }>('/assurance/explain', body);
  return response.data;
}

export async function listAssuranceWorkflowRuns(params: {
  linkedRecordIds?: string[];
  runTypes?: string[];
  limit?: number;
} = {}) {
  const searchParams = new URLSearchParams();
  for (const recordId of params.linkedRecordIds ?? []) {
    if (recordId) {
      searchParams.append('linkedRecordId', recordId);
    }
  }
  for (const runType of params.runTypes ?? []) {
    if (runType) {
      searchParams.append('runType', runType);
    }
  }
  if (typeof params.limit === 'number') {
    searchParams.set('limit', String(params.limit));
  }
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const response = await client.get<{ data: AssuranceWorkflowRun[] }>(`/assurance/workflows${suffix}`);
  return response.data;
}

export async function listTrackerImports() {
  const response = await client.get<{ data: TrackerImportSummary[] }>('/assurance/tracker/imports');
  return response.data;
}

export async function getTrackerImport(importId: string) {
  const response = await client.get<{ data: TrackerImportDetail }>(`/assurance/tracker/imports/${importId}`);
  return response.data;
}

export async function getTrackerArtifactPreview(importId: string, family: string) {
  const response = await client.get<{ data: AssuranceArtifactPreview }>(
    `/assurance/tracker/imports/${importId}/artifacts/${family}`,
  );
  return response.data;
}

export async function createTrackerImport(body: {
  folderId: string;
  name: string;
  sourceType: string;
  rows: Array<Record<string, unknown>>;
}) {
  const response = await client.post<{ data: { importJobId: string } & Record<string, unknown> }>(
    '/assurance/tracker/import',
    body,
  );
  return response.data;
}

export async function convertTrackerToTwentyX(importId: string) {
  const response = await client.post<{
    data: {
      evidenceJobId: string;
      packageJobId: string;
      reconciliation: ReconciliationSummary;
    };
  }>(`/assurance/tracker/${importId}/to-20x`, {});
  return response.data;
}

export async function listPackages() {
  const response = await client.get<{ data: PackageListItem[] }>('/assurance/packages');
  return response.data;
}

export async function buildPackage(evidenceJobId: string, folderId?: string | null) {
  const response = await client.post<{
    data: {
      package: Record<string, unknown>;
      reconciliation: ReconciliationSummary;
    };
  }>('/assurance/packages/build', { evidenceJobId, folderId });
  return response.data;
}

export async function getPackage(packageJobId: string) {
  const response = await client.get<{
    data: {
      job: {
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
      summary: PackageDetail['summary'];
      reconciliation: PackageDetail['reconciliation'];
    };
  }>(`/assurance/packages/${packageJobId}`);
  return {
    job: {
      id: response.data.job.id,
      tenantId: response.data.job.tenant_id,
      folderId: response.data.job.folder_id,
      fileName: response.data.job.file_name,
      status: response.data.job.status,
      manifestKey: response.data.job.manifest_key,
      artifactKey: response.data.job.artifact_key,
      coverage: JSON.parse(response.data.job.coverage_json || '{}') as Record<string, unknown>,
      errorSummary: JSON.parse(response.data.job.error_summary_json || '{}') as Record<string, unknown>,
      createdAt: response.data.job.created_at,
      updatedAt: response.data.job.updated_at,
    },
    summary: response.data.summary,
    reconciliation: response.data.reconciliation,
  } satisfies PackageDetail;
}

export async function getPackageDocument(packageJobId: string) {
  const artifact = await getPackageArtifactPreview(packageJobId, 'package_json');
  return (artifact.preview ?? null) as TwentyXPackageDocument | null;
}

export async function getPackageArtifactPreview(packageJobId: string, family: string) {
  const response = await client.get<{ data: AssuranceArtifactPreview }>(
    `/assurance/packages/${packageJobId}/artifacts/${family}`,
  );
  return response.data;
}

export async function listPendingReviews() {
  const response = await client.get<{ data: ReviewRecommendation[] }>('/assurance/reviews/pending');
  return response.data;
}

export async function listReviewHistory(evidenceJobId?: string) {
  const path = evidenceJobId
    ? `/assurance/reviews/history?evidenceJobId=${encodeURIComponent(evidenceJobId)}`
    : '/assurance/reviews/history';
  const response = await client.get<{ data: ReviewDecision[] }>(path);
  return response.data;
}

export async function recordReviewDecision(body: {
  recommendationId: string;
  decision: string;
  justification: string;
  evidenceRefs?: string[];
  findingRefs?: string[];
  controlRefs?: string[];
}) {
  const response = await client.post<{ data: ReviewDecision }>('/assurance/reviews/decision', body);
  return response.data;
}

export async function listAgentRuns() {
  const response = await client.get<{ data: AgentRunListItem[] }>('/agent/runs');
  return response.data;
}

export async function createAgentRun(body: {
  evidenceJobId?: string;
  importJobId?: string;
  folderId?: string;
  requestedWritebacks?: boolean;
}) {
  const response = await client.post<{ data: { trace: AgentRunTrace } }>('/agent/runs', body);
  return response.data;
}

export async function importObservableAgentRun(body: Record<string, unknown>) {
  const response = await client.post<{ data: { runId: string; trace: AgentRunTrace } }>(
    '/agent/runs/import-observable',
    body,
  );
  return response.data;
}

export async function getAgentRun(runId: string) {
  const response = await client.get<{
    data: {
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
      summary: Record<string, unknown>;
      created_by_user_id: string | null;
      created_at: string;
      updated_at: string;
      writebacks: WritebackApproval[];
    };
  }>(`/agent/runs/${runId}`);
  return {
    id: response.data.id,
    tenantId: response.data.tenant_id,
    folderId: response.data.folder_id,
    evidenceJobId: response.data.evidence_job_id,
    importJobId: response.data.import_job_id,
    status: response.data.status,
    workflowName: response.data.workflow_name,
    requestedWritebacks: Boolean(response.data.requested_writebacks),
    traceKey: response.data.trace_key,
    summaryKey: response.data.summary_key,
    summary: response.data.summary,
    createdByUserId: response.data.created_by_user_id,
    createdAt: response.data.created_at,
    updatedAt: response.data.updated_at,
    writebacks: response.data.writebacks,
  } satisfies AgentRunDetail;
}

export async function getAgentTrace(runId: string) {
  const response = await client.get<{ data: AgentRunTrace }>(`/agent/runs/${runId}/trace`);
  return response.data;
}

export async function getAgentArtifactPreview(runId: string, family: string) {
  const response = await client.get<{ data: AssuranceArtifactPreview }>(
    `/agent/runs/${runId}/artifacts/${family}`,
  );
  return response.data;
}

export async function approveWriteback(writebackId: string, justification: string) {
  const response = await client.post<{ data: { approvalId: string; integrationRunId: string | null; status: string } }>(
    `/agent/writebacks/${writebackId}/approve`,
    { justification },
  );
  return response.data;
}

export async function rejectWriteback(writebackId: string, justification: string) {
  const response = await client.post<{ data: { approvalId: string; status: string } }>(
    `/agent/writebacks/${writebackId}/reject`,
    { justification },
  );
  return response.data;
}


export async function requestWritebackEvidence(writebackId: string, justification: string) {
  const response = await client.post<{ data: { approvalId: string; status: string } }>(
    `/agent/writebacks/${writebackId}/request-more-evidence`,
    { justification },
  );
  return response.data;
}

export async function markWritebackDuplicate(writebackId: string, justification: string) {
  const response = await client.post<{ data: { approvalId: string; status: string } }>(
    `/agent/writebacks/${writebackId}/duplicate`,
    { justification },
  );
  return response.data;
}

export async function exportWritebackDraft(writebackId: string) {
  const response = await client.get<{
    data: {
      approvalId: string;
      agentRunId: string;
      requestType: string;
      status: string;
      dispatchPerformed: boolean;
      payload: Record<string, unknown>;
      evidenceRefs: string[];
      exportedAt: string;
    };
  }>(`/agent/writebacks/${writebackId}/export`);
  return response.data;
}
