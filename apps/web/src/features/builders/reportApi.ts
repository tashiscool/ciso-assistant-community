import { ApiClient } from '../../shared/api/client';
import type {
  RecurrenceType,
  ReportBuilderDetail,
  ReportConfig,
  ReportLibraryResponse,
  ReportPreview,
} from './reportTypes';

const client = new ApiClient();

export async function listReportBuilderReports(): Promise<ReportLibraryResponse> {
  const response = await client.get<{ data: ReportLibraryResponse }>('/builders/reports');
  return response.data;
}

export async function createReportBuilderReport(body?: {
  title?: string;
  owner?: string;
  chartType?: ReportBuilderDetail['chartType'];
  module?: string;
  status?: ReportBuilderDetail['status'];
  description?: string | null;
  config?: ReportConfig;
}): Promise<ReportBuilderDetail> {
  const response = await client.post<{ data: ReportBuilderDetail }>('/builders/reports', body ?? {});
  return response.data;
}

export async function getReportBuilderReport(reportId: string): Promise<ReportBuilderDetail> {
  const response = await client.get<{ data: ReportBuilderDetail }>(`/builders/reports/${reportId}`);
  return response.data;
}

export async function saveReportBuilderReport(
  reportId: string,
  body: {
    title: string;
    chartType: ReportBuilderDetail['chartType'];
    module: string;
    owner: string;
    status: ReportBuilderDetail['status'];
    description: string | null;
    config: ReportConfig;
  },
): Promise<ReportBuilderDetail> {
  const response = await client.put<{ data: ReportBuilderDetail }>(`/builders/reports/${reportId}`, body);
  return response.data;
}

export async function deleteReportBuilderReport(reportId: string): Promise<void> {
  await client.delete<{ data: { deleted: boolean } }>(`/builders/reports/${reportId}`);
}

export async function previewReportBuilderReport(
  reportId: string,
  body: {
    title: string;
    chartType: ReportBuilderDetail['chartType'];
    module: string;
    owner: string;
    status: ReportBuilderDetail['status'];
    description: string | null;
    config: ReportConfig;
  },
): Promise<ReportPreview> {
  const response = await client.post<{ data: { preview: ReportPreview } }>(
    `/builders/reports/${reportId}/preview`,
    body,
  );
  return response.data.preview;
}

export async function shareReportBuilderReport(
  reportId: string,
  recipients: string[],
): Promise<{ recipients: string[]; sharedAt: string }> {
  const response = await client.post<{ data: { recipients: string[]; sharedAt: string } }>(
    `/builders/reports/${reportId}/share`,
    { recipients },
  );
  return response.data;
}

export async function exportReportBuilderReport(
  reportId: string,
): Promise<{ format: string; artifactName: string; exportId?: string; downloadPath?: string }> {
  const response = await client.post<{ data: { format: string; artifactName: string; exportId?: string; downloadPath?: string } }>(
    `/builders/reports/${reportId}/export`,
  );
  return response.data;
}

export async function createReportBuilderSubscription(
  reportId: string,
  body: {
    recipientEmail?: string;
    recipientType?: string;
    startDate?: string;
    recurrenceType?: RecurrenceType;
  },
): Promise<{ id: string; created: boolean }> {
  const response = await client.post<{ data: { id: string; created: boolean } }>(
    `/builders/reports/${reportId}/subscriptions`,
    body,
  );
  return response.data;
}

export async function deleteReportBuilderSubscription(
  reportId: string,
  subscriptionId: string,
): Promise<void> {
  await client.delete<{ data: { deleted: boolean } }>(
    `/builders/reports/${reportId}/subscriptions/${subscriptionId}`,
  );
}
