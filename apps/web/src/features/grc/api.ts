import { ApiClient } from '../../shared/api/client';
import type {
  CollectorStatus,
  ConnectorRun,
  CrosswalkResolution,
  EvidencePackage,
  ExecutiveReportRequest,
  FindingDetail,
  FindingSummary,
  FindingsFilters,
  FrameworkContentDocument,
  FrameworkKnowledgeDetail,
  FrameworkLibrarySummary,
  GapAssessmentDetail,
  GapAssessmentRequest,
  GapAssessmentSummary,
  GrcAdminSettings,
  GrcAdminStatus,
  GrcJobEnvelope,
  GrcJobRun,
  GrcOverview,
  GrcStatus,
  GeneratedReportSnapshot,
  ReportBundle,
} from './types';

const client = new ApiClient();

function withQuery(path: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value?.trim()) {
      search.set(key, value.trim());
    }
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export async function getGrcOverview() {
  const response = await client.get<{ data: GrcOverview }>('/grc');
  return response.data;
}

export async function getGrcStatus() {
  const response = await client.get<{ data: GrcStatus }>('/grc/status');
  return response.data;
}

export async function getFrameworkLibrary() {
  const response = await client.get<{ data: FrameworkLibrarySummary[] }>('/grc/frameworks');
  return response.data;
}

export async function getFrameworkDetail(frameworkId: string) {
  const response = await client.get<{ data: FrameworkKnowledgeDetail }>(`/grc/frameworks/${encodeURIComponent(frameworkId)}`);
  return response.data;
}

export async function getFrameworkDocument(frameworkId: string, slug: string) {
  const response = await client.get<{ data: FrameworkContentDocument }>(
    `/grc/frameworks/${encodeURIComponent(frameworkId)}/content/${encodeURIComponent(slug)}`,
  );
  return response.data;
}

export async function getFindings(filters: FindingsFilters = {}) {
  const response = await client.get<{ data: FindingSummary[] }>(
    withQuery('/grc/findings', filters),
  );
  return response.data;
}

export async function getControlMap(framework: string, controlId: string) {
  const response = await client.get<{ data: CrosswalkResolution }>(
    withQuery('/grc/controls/map', {
      framework,
      controlId,
    }),
  );
  return response.data;
}

export async function analyzeControlConflicts(body: { assessmentId?: string; frameworks?: string[] }) {
  const response = await client.post<{
    data: {
      totalConflicts: number;
      conflicts: Array<{
        scfControlId: string;
        title: string;
        severity: string;
        status: string;
        targetFrameworks: string[];
        conflictingControls: Array<{
          frameworkId: string;
          frameworkName: string;
          controlId: string;
        }>;
        resolutionHint: string;
      }>;
    };
  }>('/grc/controls/conflicts', body);
  return response.data;
}

export async function optimizeControlCoverage(body: { frameworks?: string[] }) {
  const response = await client.post<{
    data: {
      provider: string;
      clusters: Array<Record<string, unknown>>;
      remediationThemes: string[];
      quickWins: string[];
    };
  }>('/grc/controls/optimize', body);
  return response.data;
}

export async function getFindingDetail(findingId: string) {
  const response = await client.get<{ data: FindingDetail }>(`/grc/findings/${encodeURIComponent(findingId)}`);
  return response.data;
}

export async function createGapAssessment(body: GapAssessmentRequest) {
  const response = await client.post<{ data: GapAssessmentDetail }>('/grc/assessments', body);
  return response.data;
}

export async function getGapAssessments() {
  const response = await client.get<{ data: GapAssessmentSummary[] }>('/grc/assessments');
  return response.data;
}

export async function getGapAssessment(assessmentId: string) {
  const response = await client.get<{ data: GapAssessmentDetail }>(
    `/grc/assessments/${encodeURIComponent(assessmentId)}`,
  );
  return response.data;
}

export async function createReportBundle(assessmentId: string) {
  const response = await client.post<{ data: GrcJobEnvelope & { assessmentId: string } }>(
    `/grc/assessments/${encodeURIComponent(assessmentId)}/report`,
  );
  return response.data;
}

export async function createEvidencePackage(assessmentId: string) {
  const response = await client.post<{ data: GrcJobEnvelope & { assessmentId: string } }>('/grc/evidence-packages', {
    assessmentId,
  });
  return response.data;
}

export async function getReportBundles(assessmentId?: string) {
  const response = await client.get<{ data: ReportBundle[] }>(
    withQuery('/grc/report-bundles', { assessmentId }),
  );
  return response.data;
}

export async function getReportBundle(bundleId: string) {
  const response = await client.get<{ data: ReportBundle }>(
    `/grc/report-bundles/${encodeURIComponent(bundleId)}`,
  );
  return response.data;
}

export async function getCollectorStatuses() {
  const response = await client.get<{ data: CollectorStatus[] }>('/grc/connectors');
  return response.data;
}

export async function getCollectorRuns(source: string) {
  const response = await client.get<{ data: ConnectorRun[] }>(
    `/grc/connectors/${encodeURIComponent(source)}/runs`,
  );
  return response.data;
}

export async function launchNativeCollector(source: string) {
  const response = await client.post<{
    data: GrcJobEnvelope & {
      collector: CollectorStatus | undefined;
    };
  }>(`/grc/connectors/${encodeURIComponent(source)}/collect`);
  return response.data;
}

export async function generateExecutiveReport(
  reportKind: GeneratedReportSnapshot['reportKind'],
  body: ExecutiveReportRequest,
) {
  const response = await client.post<{ data: GrcJobEnvelope & { assessmentId: string | null } }>(
    `/grc/reports/${encodeURIComponent(reportKind)}`,
    body,
  );
  return response.data;
}

export async function getGrcAdminStatus() {
  const response = await client.get<{ data: GrcAdminStatus }>('/grc/admin/settings');
  return response.data;
}

export async function updateGrcAdminSettings(body: GrcAdminSettings) {
  const response = await client.put<{ data: GrcAdminSettings }>('/grc/admin/settings', body);
  return response.data;
}

export async function importGrcSnapshot() {
  const response = await client.post<{ data: GrcJobEnvelope }>('/grc/admin/import-snapshot', {});
  return response.data;
}

export async function refreshGrcScf(frameworkIds?: string[]) {
  const targetFrameworkIds =
    frameworkIds && frameworkIds.length > 0
      ? frameworkIds
      : (await getFrameworkLibrary())
          .filter((framework) => Boolean(framework.scfFrameworkId))
          .map((framework) => framework.id);
  const response = await client.post<{ data: GrcJobEnvelope }>('/grc/admin/scf/refresh', {
    frameworkIds: targetFrameworkIds,
  });
  return response.data;
}

export async function getGrcJobs() {
  const response = await client.get<{ data: GrcJobRun[] }>('/grc/jobs');
  return response.data;
}

export async function getGrcJob(jobId: string) {
  const response = await client.get<{ data: GrcJobRun }>(`/grc/jobs/${encodeURIComponent(jobId)}`);
  return response.data;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function waitForGrcJob(jobId: string, options: { pollMs?: number; timeoutMs?: number } = {}) {
  const pollMs = options.pollMs ?? 1200;
  const timeoutMs = options.timeoutMs ?? 120000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const job = await getGrcJob(jobId);
    if (job.status === 'completed' || job.status === 'failed') {
      return job;
    }
    await delay(pollMs);
  }

  throw new Error(`Timed out waiting for GRC job ${jobId}.`);
}
