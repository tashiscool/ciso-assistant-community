import { ApiClient } from '../../shared/api/client';
import type { WayfinderTemplateDetail, WayfinderTemplateSummary } from './wayfinderTypes';

const client = new ApiClient();

export async function listWayfinderTemplates(): Promise<WayfinderTemplateSummary[]> {
  const response = await client.get<{ data: { templates: WayfinderTemplateSummary[] } }>('/builders/wayfinders');
  return response.data.templates;
}

export async function createWayfinderTemplate(body?: {
  title?: string;
  owner?: string;
  description?: string;
}): Promise<WayfinderTemplateDetail> {
  const response = await client.post<{ data: WayfinderTemplateDetail }>('/builders/wayfinders', body ?? {});
  return response.data;
}

export async function getWayfinderTemplate(templateId: string): Promise<WayfinderTemplateDetail> {
  const response = await client.get<{ data: WayfinderTemplateDetail }>(`/builders/wayfinders/${templateId}`);
  return response.data;
}

export async function saveWayfinderTemplate(
  templateId: string,
  body: {
    title: string;
    status: WayfinderTemplateDetail['status'];
    owner: string;
    description: string | null;
    stages: WayfinderTemplateDetail['stages'];
  },
): Promise<WayfinderTemplateDetail> {
  const response = await client.put<{ data: WayfinderTemplateDetail }>(`/builders/wayfinders/${templateId}`, body);
  return response.data;
}

export async function importWayfinderTemplate(
  templateId: string,
  body: {
    title: string;
    status: WayfinderTemplateDetail['status'];
    owner: string;
    description: string | null;
    stages: WayfinderTemplateDetail['stages'];
  },
): Promise<WayfinderTemplateDetail> {
  const response = await client.post<{ data: WayfinderTemplateDetail }>(
    `/builders/wayfinders/${templateId}/import`,
    body,
  );
  return response.data;
}

export async function deleteWayfinderTemplate(templateId: string): Promise<{ deleted: boolean }> {
  const response = await client.delete<{ data: { deleted: boolean } }>(`/builders/wayfinders/${templateId}`);
  return response.data;
}
