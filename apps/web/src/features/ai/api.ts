import { ApiClient } from '../../shared/api/client';
import type {
  ComplianceExportsWorkspace,
  EvidenceMappingDetail,
  EvidenceMappingType,
  EvidenceMappingWorkspace,
  PolicyBuilderSessionDetail,
  PolicyBuilderWorkspace,
  RegmlDeploymentMode,
  RegmlPromptMode,
  RegmlSession,
  RegmlWorkspace,
  RegmlWorkspaceMode,
  ResponseAutomationJobDetail,
  ResponseAutomationWorkspace,
} from './types';

const client = new ApiClient();

export async function getPolicyBuilderWorkspace() {
  const response = await client.get<{ data: PolicyBuilderWorkspace }>('/ai/policy-builder');
  return response.data;
}

export async function createPolicyBuilderSession(body?: { title?: string }) {
  const response = await client.post<{ data: PolicyBuilderSessionDetail }>('/ai/policy-builder/sessions', body ?? {});
  return response.data;
}

export async function getPolicyBuilderSession(sessionId: string) {
  const response = await client.get<{ data: PolicyBuilderSessionDetail }>(`/ai/policy-builder/sessions/${sessionId}`);
  return response.data;
}

export async function updatePolicyBuilderSession(sessionId: string, body: { title?: string; ownerName?: string }) {
  const response = await client.put<{ data: PolicyBuilderSessionDetail }>(`/ai/policy-builder/sessions/${sessionId}`, body);
  return response.data;
}

export async function queuePolicyProfile(sessionId: string, profileId: string) {
  const response = await client.post<{ data: { detail: PolicyBuilderSessionDetail; addedCount: number; skippedCount: number; message: string } }>(
    `/ai/policy-builder/sessions/${sessionId}/queue-profile`,
    { profileId },
  );
  return response.data;
}

export async function queuePolicyControl(sessionId: string, body: { catalogName: string; controlId: string }) {
  const response = await client.post<{ data: { detail: PolicyBuilderSessionDetail; message: string } }>(
    `/ai/policy-builder/sessions/${sessionId}/queue-control`,
    body,
  );
  return response.data;
}

export async function clearPolicyBuilderQueue(sessionId: string) {
  const response = await client.delete<{ data: PolicyBuilderSessionDetail }>(`/ai/policy-builder/sessions/${sessionId}/queue`);
  return response.data;
}

export async function finishPolicyBuilderSession(sessionId: string) {
  const response = await client.post<{
    data: {
      detail: PolicyBuilderSessionDetail;
      createdCount: number;
      skippedCount: number;
      message: string;
    };
  }>(`/ai/policy-builder/sessions/${sessionId}/finish`);
  return response.data;
}

export async function getComplianceExportsWorkspace() {
  const response = await client.get<{ data: ComplianceExportsWorkspace }>('/ai/compliance-exports');
  return response.data;
}

export async function createComplianceExportJob(body: { optionId: string; sourceRecord?: string }) {
  const response = await client.post<{
    data: {
      job: ComplianceExportsWorkspace['jobs'][number];
      pipeline: Array<{
        id: string;
        title: string;
        owner: string;
        writeTarget: string;
        helper: string;
        metric: string;
        status: 'Complete' | 'Running' | 'Queued' | 'Attention';
      }>;
    };
  }>('/ai/compliance-exports/jobs', body);
  return response.data;
}

export async function getComplianceExportJob(jobId: string) {
  const response = await client.get<{
    data: {
      job: ComplianceExportsWorkspace['jobs'][number];
      pipeline: Array<{
        id: string;
        title: string;
        owner: string;
        writeTarget: string;
        helper: string;
        metric: string;
        status: 'Complete' | 'Running' | 'Queued' | 'Attention';
      }>;
    };
  }>(`/ai/compliance-exports/jobs/${jobId}`);
  return response.data;
}

export async function getResponseAutomationWorkspace() {
  const response = await client.get<{ data: ResponseAutomationWorkspace }>('/ai/response-automation');
  return response.data;
}

export async function createResponseAutomationJob(body: {
  title: string;
  sourceDocument: string;
  sourceIds: string[];
  exportFormat?: string;
}) {
  const response = await client.post<{ data: ResponseAutomationJobDetail }>('/ai/response-automation/jobs', body);
  return response.data;
}

export async function getResponseAutomationJob(jobId: string) {
  const response = await client.get<{ data: ResponseAutomationJobDetail }>(`/ai/response-automation/jobs/${jobId}`);
  return response.data;
}

export async function updateResponseAutomationItem(jobId: string, itemId: string, body: { answer?: string; accepted?: boolean }) {
  const response = await client.put<{ data: ResponseAutomationJobDetail }>(
    `/ai/response-automation/jobs/${jobId}/items/${itemId}`,
    body,
  );
  return response.data;
}

export async function deleteResponseAutomationItem(jobId: string, itemId: string) {
  const response = await client.delete<{ data: ResponseAutomationJobDetail }>(`/ai/response-automation/jobs/${jobId}/items/${itemId}`);
  return response.data;
}

export async function deleteResponseAutomationJob(jobId: string) {
  const response = await client.delete<{ data: { deleted: boolean; id: string } }>(`/ai/response-automation/jobs/${jobId}`);
  return response.data;
}

export async function getEvidenceMappingWorkspace() {
  const response = await client.get<{ data: EvidenceMappingWorkspace }>('/ai/evidence-mapping');
  return response.data;
}

export async function getEvidenceMappingDetail(artifactId: string) {
  const response = await client.get<{ data: EvidenceMappingDetail }>(`/ai/evidence-mapping/evidence/${artifactId}`);
  return response.data;
}

export async function createEvidenceMappings(artifactId: string, body: { mappingType: EvidenceMappingType; targetIds: string[] }) {
  const response = await client.post<{ data: EvidenceMappingDetail }>(`/ai/evidence-mapping/evidence/${artifactId}/mappings`, body);
  return response.data;
}

export async function deleteEvidenceMapping(artifactId: string, mappingId: string) {
  const response = await client.delete<{ data: EvidenceMappingDetail }>(`/ai/evidence-mapping/evidence/${artifactId}/mappings/${mappingId}`);
  return response.data;
}

export async function generateEvidenceRecommendations(artifactId: string, threshold: number) {
  const response = await client.post<{ data: EvidenceMappingDetail }>(`/ai/evidence-mapping/evidence/${artifactId}/recommendations`, { threshold });
  return response.data;
}

export async function getRegmlWorkspace() {
  const response = await client.get<{ data: RegmlWorkspace }>('/ai/regml');
  return response.data;
}

export async function updateRegmlSettings(body: {
  enabled?: boolean;
  termsAccepted?: boolean;
  deploymentMode?: RegmlDeploymentMode;
}) {
  const response = await client.put<{ data: RegmlWorkspace }>('/ai/regml/settings', body);
  return response.data;
}

export async function getRegmlSession(mode: RegmlWorkspaceMode) {
  const response = await client.get<{ data: { session: RegmlSession } }>(
    `/ai/regml/workspaces/${encodeURIComponent(mode)}`,
  );
  return response.data;
}

export async function runRegmlPrompt(
  mode: RegmlWorkspaceMode,
  body: {
    prompt: string;
    promptMode: RegmlPromptMode;
    sourceSet: string;
  },
) {
  const response = await client.post<{ data: { session: RegmlSession } }>(
    `/ai/regml/workspaces/${encodeURIComponent(mode)}/run`,
    body,
  );
  return response.data;
}

export async function applyRegmlAttempt(mode: RegmlWorkspaceMode, attemptId: string) {
  const response = await client.post<{ data: { session: RegmlSession } }>(
    `/ai/regml/workspaces/${encodeURIComponent(mode)}/attempts/${attemptId}/apply`,
  );
  return response.data;
}
