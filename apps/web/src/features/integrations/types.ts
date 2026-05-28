export type ConnectorCapability =
  | 'sync_assets'
  | 'sync_findings'
  | 'sync_identities'
  | 'sync_vulnerabilities'
  | 'send_alerts'
  | 'receive_webhooks'
  | 'scim_provisioning'
  | 'ticket_push'
  | 'dry_run'
  | 'credential_metadata';

export type ConnectorSummary = {
  id: string;
  name: string;
  provider: string;
  category: string;
  authMode: string;
  status: string;
  isEnabled: boolean;
  baseUrl: string | null;
  capabilities: ConnectorCapability[];
  lastError: string | null;
  updatedAt: string;
};

export type ConnectorRun = {
  id: string;
  actionType: string;
  status: string;
  summary: Record<string, unknown>;
  startedAt: string;
  finishedAt: string | null;
  triggeredByUserId: string | null;
};

export type ConnectorDetail = ConnectorSummary & {
  config: Record<string, unknown>;
  lastTest: Record<string, unknown> | null;
  lastSync: Record<string, unknown> | null;
  createdAt: string;
  runs: ConnectorRun[];
};
