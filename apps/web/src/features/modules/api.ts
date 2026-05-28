import { ApiClient } from '../../shared/api/client';
import type {
  ModuleCatalogEntry,
  ModuleCatalogResponse,
  ModuleRecord,
  ModuleRecordsResponse,
  SaveModuleRecordInput,
} from './types';

const client = new ApiClient();

export async function listModuleCatalog(): Promise<ModuleCatalogEntry[]> {
  const response = await client.get<{ data: ModuleCatalogResponse }>('/core/modules/catalog');
  return response.data.modules;
}

export async function getModuleCatalogEntry(moduleKey: string): Promise<ModuleCatalogEntry> {
  const response = await client.get<{ data: ModuleCatalogEntry }>(`/core/modules/${moduleKey}`);
  return response.data;
}

export async function listModuleRecords(
  moduleKey: string,
  params: {
    q?: string;
    status?: string;
    folderId?: string;
    includeArchived?: boolean;
  } = {},
): Promise<ModuleRecordsResponse> {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.status?.trim()) search.set('status', params.status.trim());
  if (params.folderId?.trim()) search.set('folderId', params.folderId.trim());
  if (params.includeArchived) search.set('includeArchived', 'true');
  const query = search.toString();
  const response = await client.get<{ data: ModuleRecordsResponse }>(
    `/core/modules/${moduleKey}/records${query ? `?${query}` : ''}`,
  );
  return response.data;
}

export async function getModuleRecord(moduleKey: string, recordId: string): Promise<ModuleRecord> {
  const response = await client.get<{ data: ModuleRecord }>(`/core/modules/${moduleKey}/records/${recordId}`);
  return response.data;
}

export async function createModuleRecord(moduleKey: string, body: SaveModuleRecordInput): Promise<ModuleRecord> {
  const response = await client.post<{ data: ModuleRecord }>(`/core/modules/${moduleKey}/records`, body);
  return response.data;
}

export async function updateModuleRecord(
  moduleKey: string,
  recordId: string,
  body: SaveModuleRecordInput,
): Promise<ModuleRecord> {
  const response = await client.post<{ data: ModuleRecord }>(`/core/modules/${moduleKey}/records/${recordId}`, body);
  return response.data;
}

export async function archiveModuleRecord(moduleKey: string, recordId: string): Promise<ModuleRecord> {
  const response = await client.post<{ data: ModuleRecord }>(
    `/core/modules/${moduleKey}/records/${recordId}/archive`,
  );
  return response.data;
}
