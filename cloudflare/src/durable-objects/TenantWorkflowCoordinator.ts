import { DurableObject } from 'cloudflare:workers';
import type { EnvBindings } from '../types/env';

type LeaseRecord = {
  leaseKey: string;
  acquiredAt: string;
  expiresAt: string;
  metadata: Record<string, unknown> | null;
};

type WorkflowRunStatus = 'Queued' | 'Running' | 'Awaiting Review' | 'Done' | 'Failed';

type WorkflowRunRecord = {
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

type AcquireLeaseBody = {
  leaseKey?: string;
  ttlSeconds?: number;
  metadata?: Record<string, unknown> | null;
};

type ReleaseLeaseBody = {
  leaseKey?: string;
};

type StartRunBody = {
  runId?: string;
  runType?: string;
  module?: string;
  title?: string;
  status?: WorkflowRunStatus;
  folderId?: string | null;
  sourceRecordId?: string | null;
  route?: string;
  detail?: string;
  metadata?: Record<string, unknown> | null;
};

type UpdateRunBody = {
  runId?: string;
  title?: string;
  status?: WorkflowRunStatus;
  route?: string;
  detail?: string;
  metadata?: Record<string, unknown> | null;
  sourceRecordId?: string | null;
};

const LEASE_PREFIX = 'lease:';
const RUN_PREFIX = 'run:';
const MAX_WORKFLOW_RUNS = 200;

function leaseStorageKey(leaseKey: string): string {
  return `${LEASE_PREFIX}${leaseKey}`;
}

function runStorageKey(runId: string): string {
  return `${RUN_PREFIX}${runId}`;
}

export class TenantWorkflowCoordinator extends DurableObject<EnvBindings> {
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/leases') {
      return this.listLeases();
    }

    if (request.method === 'POST' && url.pathname === '/leases/acquire') {
      return this.acquireLease(request);
    }

    if (request.method === 'POST' && url.pathname === '/leases/release') {
      return this.releaseLease(request);
    }

    if (request.method === 'GET' && url.pathname === '/runs') {
      return this.listRuns(url);
    }

    if (request.method === 'GET' && url.pathname.startsWith('/runs/')) {
      return this.getRun(url.pathname.slice('/runs/'.length));
    }

    if (request.method === 'POST' && url.pathname === '/runs/start') {
      return this.startRun(request);
    }

    if (request.method === 'POST' && url.pathname === '/runs/update') {
      return this.updateRun(request);
    }

    return new Response('Not Found', { status: 404 });
  }

  override async alarm(): Promise<void> {
    await this.cleanupExpiredLeases();
  }

  private async listLeases(): Promise<Response> {
    await this.cleanupExpiredLeases();

    const records = await this.ctx.storage.list<LeaseRecord>({ prefix: LEASE_PREFIX });
    const activeLeases = [...records.values()]
      .sort((left, right) => left.expiresAt.localeCompare(right.expiresAt))
      .map((record) => ({
        leaseKey: record.leaseKey,
        acquiredAt: record.acquiredAt,
        expiresAt: record.expiresAt,
        metadata: record.metadata,
      }));

    return Response.json({ activeLeases });
  }

  private async acquireLease(request: Request): Promise<Response> {
    const body = (await request.json()) as AcquireLeaseBody;
    const leaseKey = body.leaseKey?.trim();
    if (!leaseKey) {
      return Response.json(
        { error: 'leaseKey is required' },
        {
          status: 400,
        },
      );
    }

    const ttlSeconds = Math.max(15, Math.min(body.ttlSeconds ?? 90, 900));
    const key = leaseStorageKey(leaseKey);
    const existing = await this.ctx.storage.get<LeaseRecord>(key);
    const now = Date.now();

    if (existing && Date.parse(existing.expiresAt) > now) {
      return Response.json({
        acquired: false,
        lease: existing,
      });
    }

    const lease: LeaseRecord = {
      leaseKey,
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlSeconds * 1000).toISOString(),
      metadata: body.metadata ?? null,
    };

    await this.ctx.storage.put(key, lease);
    await this.scheduleCleanup();

    return Response.json({
      acquired: true,
      lease,
    });
  }

  private async releaseLease(request: Request): Promise<Response> {
    const body = (await request.json()) as ReleaseLeaseBody;
    const leaseKey = body.leaseKey?.trim();
    if (!leaseKey) {
      return Response.json(
        { error: 'leaseKey is required' },
        {
          status: 400,
        },
      );
    }

    await this.ctx.storage.delete(leaseStorageKey(leaseKey));

    return Response.json({
      released: true,
    });
  }

  private async listRuns(url: URL): Promise<Response> {
    const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') ?? '25'), MAX_WORKFLOW_RUNS));
    const records = await this.ctx.storage.list<WorkflowRunRecord>({ prefix: RUN_PREFIX });
    const workflowRuns = [...records.values()]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, limit);

    return Response.json({ workflowRuns });
  }

  private async getRun(runId: string): Promise<Response> {
    const normalizedRunId = runId.trim();
    if (!normalizedRunId) {
      return Response.json({ error: 'runId is required' }, { status: 400 });
    }

    const record = await this.ctx.storage.get<WorkflowRunRecord>(runStorageKey(normalizedRunId));
    if (!record) {
      return Response.json({ error: 'run_not_found' }, { status: 404 });
    }

    return Response.json({ workflowRun: record });
  }

  private async startRun(request: Request): Promise<Response> {
    const body = (await request.json()) as StartRunBody;
    const runId = body.runId?.trim();
    const runType = body.runType?.trim();
    const module = body.module?.trim();
    const title = body.title?.trim();
    const route = body.route?.trim();
    const detail = body.detail?.trim();

    if (!runId || !runType || !module || !title || !route || !detail) {
      return Response.json(
        {
          error: 'invalid_run',
          message: 'runId, runType, module, title, route, and detail are required.',
        },
        { status: 400 },
      );
    }

    const existing = await this.ctx.storage.get<WorkflowRunRecord>(runStorageKey(runId));
    const timestamp = new Date().toISOString();
    const workflowRun: WorkflowRunRecord = {
      runId,
      runType,
      module,
      title,
      status: body.status ?? 'Queued',
      folderId: body.folderId ?? existing?.folderId ?? null,
      sourceRecordId: body.sourceRecordId ?? existing?.sourceRecordId ?? null,
      route,
      detail,
      metadata: body.metadata ?? existing?.metadata ?? null,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    await this.ctx.storage.put(runStorageKey(runId), workflowRun);
    await this.trimWorkflowRuns();

    return Response.json({ workflowRun });
  }

  private async updateRun(request: Request): Promise<Response> {
    const body = (await request.json()) as UpdateRunBody;
    const runId = body.runId?.trim();
    if (!runId) {
      return Response.json({ error: 'runId is required' }, { status: 400 });
    }

    const existing = await this.ctx.storage.get<WorkflowRunRecord>(runStorageKey(runId));
    if (!existing) {
      return Response.json({ error: 'run_not_found' }, { status: 404 });
    }

    const workflowRun: WorkflowRunRecord = {
      ...existing,
      title: body.title?.trim() || existing.title,
      status: body.status ?? existing.status,
      route: body.route?.trim() || existing.route,
      detail: body.detail?.trim() || existing.detail,
      sourceRecordId: body.sourceRecordId ?? existing.sourceRecordId,
      metadata: body.metadata ?? existing.metadata,
      updatedAt: new Date().toISOString(),
    };

    await this.ctx.storage.put(runStorageKey(runId), workflowRun);
    await this.trimWorkflowRuns();

    return Response.json({ workflowRun });
  }

  private async cleanupExpiredLeases(): Promise<void> {
    const now = Date.now();
    const records = await this.ctx.storage.list<LeaseRecord>({ prefix: LEASE_PREFIX });
    let nextAlarmAt: number | null = null;

    for (const [key, record] of records.entries()) {
      const expiresAt = Date.parse(record.expiresAt);
      if (!Number.isFinite(expiresAt) || expiresAt <= now) {
        await this.ctx.storage.delete(key);
        continue;
      }

      if (nextAlarmAt === null || expiresAt < nextAlarmAt) {
        nextAlarmAt = expiresAt;
      }
    }

    if (nextAlarmAt !== null) {
      await this.ctx.storage.setAlarm(nextAlarmAt);
    }
  }

  private async scheduleCleanup(): Promise<void> {
    const records = await this.ctx.storage.list<LeaseRecord>({ prefix: LEASE_PREFIX });
    let nextAlarmAt: number | null = null;

    for (const record of records.values()) {
      const expiresAt = Date.parse(record.expiresAt);
      if (!Number.isFinite(expiresAt)) {
        continue;
      }

      if (nextAlarmAt === null || expiresAt < nextAlarmAt) {
        nextAlarmAt = expiresAt;
      }
    }

    if (nextAlarmAt !== null) {
      await this.ctx.storage.setAlarm(nextAlarmAt);
    }
  }

  private async trimWorkflowRuns(): Promise<void> {
    const records = await this.ctx.storage.list<WorkflowRunRecord>({ prefix: RUN_PREFIX });
    const runs = [...records.entries()].sort((left, right) =>
      right[1].updatedAt.localeCompare(left[1].updatedAt),
    );

    if (runs.length <= MAX_WORKFLOW_RUNS) {
      return;
    }

    await Promise.all(
      runs.slice(MAX_WORKFLOW_RUNS).map(async ([key]) => {
        await this.ctx.storage.delete(key);
      }),
    );
  }
}
