import type { EnvBindings } from '../types/env';

export type WorkflowLease = {
  leaseKey: string;
  acquiredAt: string;
  expiresAt: string;
  metadata: Record<string, unknown> | null;
};

export type WorkflowRunStatus = 'Queued' | 'Running' | 'Awaiting Review' | 'Done' | 'Failed';

export type WorkflowRunRecord = {
  runId: string;
  runType: string;
  module: string;
  title: string;
  status: WorkflowRunStatus;
  folderId: string | null;
  sourceRecordId: string | null;
  route: string;
  detail: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowSnapshot = {
  tenantId: string;
  activeLeases: WorkflowLease[];
  workflowRuns: WorkflowRunRecord[];
};

type AcquireLeaseResponse = {
  acquired: boolean;
  lease: WorkflowLease;
};

type WorkflowRunsResponse = {
  workflowRuns: WorkflowRunRecord[];
};

type WorkflowRunResponse = {
  workflowRun: WorkflowRunRecord;
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
  const [leaseSnapshot, runSnapshot] = await Promise.all([
    doRequest<{ activeLeases: WorkflowLease[] }>(env, tenantId, '/leases', {
      method: 'GET',
    }),
    doRequest<WorkflowRunsResponse>(env, tenantId, '/runs?limit=25', {
      method: 'GET',
    }),
  ]);

  return {
    tenantId,
    activeLeases: leaseSnapshot.activeLeases,
    workflowRuns: runSnapshot.workflowRuns,
  };
}

export async function getTenantWorkflowRuns(
  env: EnvBindings,
  tenantId: string,
  limit = 25,
): Promise<WorkflowRunRecord[]> {
  const response = await doRequest<WorkflowRunsResponse>(
    env,
    tenantId,
    `/runs?limit=${Math.max(1, Math.min(limit, 200))}`,
    {
      method: 'GET',
    },
  );
  return response.workflowRuns;
}

export async function startTenantWorkflowRun(
  env: EnvBindings,
  tenantId: string,
  run: Omit<WorkflowRunRecord, 'createdAt' | 'updatedAt'>,
): Promise<WorkflowRunRecord> {
  const response = await doRequest<WorkflowRunResponse>(env, tenantId, '/runs/start', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(run),
  });

  return response.workflowRun;
}

export async function updateTenantWorkflowRun(
  env: EnvBindings,
  tenantId: string,
  update: {
    runId: string;
    title?: string;
    status?: WorkflowRunStatus;
    route?: string;
    detail?: string;
    metadata?: Record<string, unknown> | null;
    sourceRecordId?: string | null;
  },
): Promise<WorkflowRunRecord> {
  const response = await doRequest<WorkflowRunResponse>(env, tenantId, '/runs/update', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(update),
  });

  return response.workflowRun;
}
