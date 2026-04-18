import { ApiClient } from '../../shared/api/client';
import type { FormBuilderDetail, FormBuilderSummary, FormRule, FormSection, FormTabSort } from './formTypes';

const client = new ApiClient();

export async function listFormBuilderModules(): Promise<FormBuilderSummary[]> {
  const response = await client.get<{ data: { modules: FormBuilderSummary[] } }>('/builders/forms');
  return response.data.modules;
}

export async function createFormBuilderModule(body?: {
  moduleName?: string;
  pluralName?: string;
  moduleKey?: string;
}): Promise<FormBuilderDetail> {
  const response = await client.post<{ data: FormBuilderDetail }>('/builders/forms', body ?? {});
  return response.data;
}

export async function getFormBuilderModule(moduleId: string): Promise<FormBuilderDetail> {
  const response = await client.get<{ data: FormBuilderDetail }>(`/builders/forms/${moduleId}`);
  return response.data;
}

export async function saveFormBuilderModule(
  moduleId: string,
  body: {
    moduleName: string;
    pluralName: string;
    tabSort: FormTabSort;
    status: string;
    description: string | null;
    sections: FormSection[];
    rules: FormRule[];
  },
): Promise<FormBuilderDetail> {
  const response = await client.put<{ data: FormBuilderDetail }>(`/builders/forms/${moduleId}`, body);
  return response.data;
}

export async function importFormBuilderModule(
  moduleId: string,
  body: {
    moduleName: string;
    pluralName: string;
    tabSort: FormTabSort;
    status: string;
    description: string | null;
    sections: FormSection[];
    rules: FormRule[];
  },
): Promise<FormBuilderDetail> {
  const response = await client.post<{ data: FormBuilderDetail }>(`/builders/forms/${moduleId}/import`, body);
  return response.data;
}

export async function resetFormBuilderModule(moduleId: string): Promise<FormBuilderDetail> {
  const response = await client.post<{ data: FormBuilderDetail }>(`/builders/forms/${moduleId}/reset`);
  return response.data;
}

export async function validateFormBuilderModule(
  moduleId: string,
  body: {
    sections: FormSection[];
    rules: FormRule[];
  },
): Promise<{ diagnostics: FormBuilderDetail['diagnostics'] }> {
  const response = await client.post<{ data: { diagnostics: FormBuilderDetail['diagnostics'] } }>(
    `/builders/forms/${moduleId}/validate`,
    body,
  );
  return response.data;
}
