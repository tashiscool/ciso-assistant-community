import type { EnvBindings } from '../types/env';

export type WorkflowLease = {
  leaseKey: string;
  acquiredAt: string;
  expiresAt: string;
  metadata: Record<string, unknown> | null;
};

export type WorkflowSnapshot = {
  tenantId: string;
  activeLeases: WorkflowLease[];
};

type AcquireLeaseResponse = {
  acquired: boolean;
  lease: WorkflowLease;
};

function getTenantWorkflowStub(env: EnvBindings, tenantId: string) {
  const id = env.TENANT_WORKFLOW_COORDINATOR.idFromName(tenantId);
  return env.TENANT_WORKFLOW_COORDINATOR.get(id);
}

async function doRequest<T>(
  env: EnvBindings,
  tenantId: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const stub = getTenantWorkflowStub(env, tenantId);
  const response = await stub.fetch(`https://tenant-workflow${path}`, init);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Tenant workflow coordinator request failed (${response.status}): ${message}`,
    );
  }

  return (await response.json()) as T;
}

export async function acquireTenantLease(
  env: EnvBindings,
  tenantId: string,
  leaseKey: string,
  metadata: Record<string, unknown> | null = null,
): Promise<AcquireLeaseResponse> {
  return doRequest<AcquireLeaseResponse>(env, tenantId, '/leases/acquire', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      leaseKey,
      ttlSeconds: 90,
      metadata,
    }),
  });
}

export async function releaseTenantLease(
  env: EnvBindings,
  tenantId: string,
  leaseKey: string,
): Promise<void> {
  await doRequest<{ released: boolean }>(env, tenantId, '/leases/release', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ leaseKey }),
  });
}

export async function getTenantWorkflowSnapshot(
  env: EnvBindings,
  tenantId: string,
): Promise<WorkflowSnapshot> {
  const snapshot = await doRequest<WorkflowSnapshot>(env, tenantId, '/leases', {
    method: 'GET',
  });

  return {
    tenantId,
    activeLeases: snapshot.activeLeases,
  };
}
