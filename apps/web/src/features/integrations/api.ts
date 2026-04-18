import { ApiClient } from '../../shared/api/client';
import type { ConnectorCapability, ConnectorDetail, ConnectorSummary } from './types';

const client = new ApiClient();

export async function listConnectors(): Promise<ConnectorSummary[]> {
  const response = await client.get<{ data: ConnectorSummary[] }>('/integrations/connectors');
  return response.data;
}

export async function getConnector(connectorId: string): Promise<ConnectorDetail> {
  const response = await client.get<{ data: ConnectorDetail }>(`/integrations/connectors/${connectorId}`);
  return response.data;
}

export async function createConnector(body: {
  name?: string;
  provider?: string;
  category?: string;
  authMode?: string;
  baseUrl?: string | null;
}): Promise<ConnectorDetail> {
  const response = await client.post<{ data: ConnectorDetail }>('/integrations/connectors', body);
  return response.data;
}

export async function updateConnector(
  connectorId: string,
  body: {
    name: string;
    category: string;
    authMode: string;
    baseUrl: string | null;
    status: string;
    isEnabled: boolean;
    capabilities: ConnectorCapability[];
    config: Record<string, unknown>;
  },
): Promise<ConnectorDetail> {
  const response = await client.put<{ data: ConnectorDetail }>(`/integrations/connectors/${connectorId}`, body);
  return response.data;
}

export async function testConnector(
  connectorId: string,
): Promise<{ runId: string; status: string; summary: Record<string, unknown> }> {
  const response = await client.post<{ data: { runId: string; status: string; summary: Record<string, unknown> } }>(
    `/integrations/connectors/${connectorId}/test`,
  );
  return response.data;
}

export async function syncConnector(
  connectorId: string,
): Promise<{ runId: string; status: string; summary: Record<string, unknown> }> {
  const response = await client.post<{ data: { runId: string; status: string; summary: Record<string, unknown> } }>(
    `/integrations/connectors/${connectorId}/sync`,
  );
  return response.data;
}
