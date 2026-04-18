import { useEffect, useState } from 'react';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';

const client = new ApiClient();

export type OpsParityCard = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  detail: string;
  route: string;
};

export type OpsParityMetric = {
  id: string;
  label: string;
  value: number;
  detail: string;
};

export type OpsParityOverview = {
  tenantId: string;
  assets: OpsParityCard[];
  actors: OpsParityCard[];
  analytics: OpsParityMetric[];
  dashboards: OpsParityCard[];
  calendar: Array<{
    id: string;
    title: string;
    date: string;
    detail: string;
    route: string;
  }>;
  backupRestore: {
    exportsCount: number;
    importsCount: number;
    latestExport: string | null;
    latestImport: string | null;
  };
  incidents: OpsParityCard[];
  libraryOperations: OpsParityCard[];
  policies: OpsParityCard[];
  quickStart: Array<{
    id: string;
    title: string;
    completed: boolean;
    detail: string;
    route: string;
  }>;
  searchIndex: Array<{
    id: string;
    title: string;
    subtitle: string;
    section: string;
    route: string;
    keywords: string[];
  }>;
  settings: {
    tenantId: string;
    userId: string | null;
    authStrategy: string;
    appEnv: string;
  };
  exceptions: OpsParityCard[];
  tasks: OpsParityCard[];
  validationFlows: OpsParityCard[];
  vulnerabilities: OpsParityCard[];
  xRays: OpsParityCard[];
  program: OpsParityCard[];
};

export function useOpsParityOverview() {
  const { identity } = useEdgeIdentity();
  const [overview, setOverview] = useState<OpsParityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{ data: OpsParityOverview }>('/ops/parity/overview');
      setOverview(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [identity.tenantId, identity.userId]);

  return { overview, loading, error, refresh };
}
