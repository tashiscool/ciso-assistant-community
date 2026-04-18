import { ApiClient } from '../../shared/api/client';
import type { DashboardAccess, DashboardDetail, DashboardLayoutItem, DashboardLibraryResponse } from './dashboardTypes';

const client = new ApiClient();

export async function listDashboardBuilderDashboards(): Promise<DashboardLibraryResponse> {
  const response = await client.get<{ data: DashboardLibraryResponse }>('/builders/dashboards');
  return response.data;
}

export async function createDashboardBuilderDashboard(body?: {
  title?: string;
  access?: DashboardAccess;
  groups?: string[];
}): Promise<DashboardDetail> {
  const response = await client.post<{ data: DashboardDetail }>('/builders/dashboards', body ?? {});
  return response.data;
}

export async function getDashboardBuilderDashboard(dashboardId: string): Promise<DashboardDetail> {
  const response = await client.get<{ data: DashboardDetail }>(`/builders/dashboards/${dashboardId}`);
  return response.data;
}

export async function saveDashboardBuilderDashboard(
  dashboardId: string,
  body: {
    title: string;
    access: DashboardAccess;
    groups: string[];
    items: DashboardLayoutItem[];
    layout: { left: string[]; right: string[] };
  },
): Promise<DashboardDetail> {
  const response = await client.put<{ data: DashboardDetail }>(`/builders/dashboards/${dashboardId}`, body);
  return response.data;
}

export async function deleteDashboardBuilderDashboard(dashboardId: string): Promise<void> {
  await client.delete<{ data: { deleted: boolean } }>(`/builders/dashboards/${dashboardId}`);
}

export async function favoriteDashboardBuilderDashboard(dashboardId: string): Promise<DashboardDetail> {
  const response = await client.post<{ data: DashboardDetail }>(`/builders/dashboards/${dashboardId}/favorite`);
  return response.data;
}

export async function publishDashboardBuilderDashboard(dashboardId: string): Promise<DashboardDetail> {
  const response = await client.post<{ data: DashboardDetail }>(`/builders/dashboards/${dashboardId}/publish`);
  return response.data;
}
