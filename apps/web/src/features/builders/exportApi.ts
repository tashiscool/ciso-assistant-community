import { ApiClient } from '../../shared/api/client';
import type {
  ExportBuilderDetail,
  ExportBuilderSummary,
  FieldCatalogNode,
  FilterRow,
  MappingRow,
  StarterTemplate,
  SubTemplate,
  TemplateAnalysis,
} from './exportTypes';

const client = new ApiClient();

export async function listExportBuilderConfigs(): Promise<{
  exports: ExportBuilderSummary[];
  starterTemplates: StarterTemplate[];
  fieldCatalog: FieldCatalogNode[];
}> {
  const response = await client.get<{
    data: {
      exports: ExportBuilderSummary[];
      starterTemplates: StarterTemplate[];
      fieldCatalog: FieldCatalogNode[];
    };
  }>('/builders/exports');
  return response.data;
}

export async function createExportBuilderConfig(body?: {
  title?: string;
  starterTemplateId?: string | null;
}): Promise<ExportBuilderDetail> {
  const response = await client.post<{ data: ExportBuilderDetail }>('/builders/exports', body ?? {});
  return response.data;
}

export async function getExportBuilderConfig(exportId: string): Promise<ExportBuilderDetail> {
  const response = await client.get<{ data: ExportBuilderDetail }>(`/builders/exports/${exportId}`);
  return response.data;
}

export async function saveExportBuilderConfig(
  exportId: string,
  body: {
    title: string;
    status: ExportBuilderDetail['status'];
    module: ExportBuilderDetail['module'];
    exportGroup: string;
    exportType: ExportBuilderDetail['exportType'];
    description: string | null;
    templateFileName: string | null;
    templateAnalysis: TemplateAnalysis;
    mappings: MappingRow[];
    filterRows: FilterRow[];
    filterExpression: string;
    subTemplates: SubTemplate[];
  },
): Promise<ExportBuilderDetail> {
  const response = await client.put<{ data: ExportBuilderDetail }>(`/builders/exports/${exportId}`, body);
  return response.data;
}

export async function analyzeExportBuilderTemplate(
  exportId: string,
  body: {
    fileName: string;
    content?: string;
    subTemplateId?: string | null;
  },
): Promise<ExportBuilderDetail> {
  const response = await client.post<{ data: ExportBuilderDetail }>(
    `/builders/exports/${exportId}/analyze-template`,
    body,
  );
  return response.data;
}

export async function autoMapExportBuilderConfig(
  exportId: string,
  body: {
    mappings: MappingRow[];
  },
): Promise<ExportBuilderDetail> {
  const response = await client.post<{ data: ExportBuilderDetail }>(
    `/builders/exports/${exportId}/auto-map`,
    body,
  );
  return response.data;
}

export async function importExportBuilderMappings(
  exportId: string,
  body: {
    mappings: MappingRow[];
    filterRows: FilterRow[];
    filterExpression: string;
  },
): Promise<ExportBuilderDetail> {
  const response = await client.post<{ data: ExportBuilderDetail }>(
    `/builders/exports/${exportId}/import-mappings`,
    body,
  );
  return response.data;
}

export async function duplicateExportBuilderConfig(exportId: string): Promise<ExportBuilderDetail> {
  const response = await client.post<{ data: ExportBuilderDetail }>(`/builders/exports/${exportId}/duplicate`);
  return response.data;
}

export async function deleteExportBuilderConfig(exportId: string): Promise<{ deleted: boolean }> {
  const response = await client.delete<{ data: { deleted: boolean } }>(`/builders/exports/${exportId}`);
  return response.data;
}

export async function testExportBuilderConfig(
  exportId: string,
  body?: { scenarioName?: string },
): Promise<{
  runId: string;
  status: string;
  result: ExportBuilderDetail['testRuns'][number]['result'];
}> {
  const response = await client.post<{
    data: {
      runId: string;
      status: string;
      result: ExportBuilderDetail['testRuns'][number]['result'];
    };
  }>(`/builders/exports/${exportId}/test`, body ?? {});
  return response.data;
}

export async function addExportBuilderSubTemplate(
  exportId: string,
  body: {
    title?: string;
    fileName: string;
    content?: string;
  },
): Promise<ExportBuilderDetail> {
  const response = await client.post<{ data: ExportBuilderDetail }>(
    `/builders/exports/${exportId}/sub-templates`,
    body,
  );
  return response.data;
}
