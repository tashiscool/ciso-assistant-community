import { DurableObject } from 'cloudflare:workers';
import type { EnvBindings } from '../types/env';

type LeaseRecord = {
  leaseKey: string;
  acquiredAt: string;
  expiresAt: string;
  metadata: Record<string, unknown> | null;
};

type AcquireLeaseBody = {
  leaseKey?: string;
  ttlSeconds?: number;
  metadata?: Record<string, unknown> | null;
};

type ReleaseLeaseBody = {
  leaseKey?: string;
};

const LEASE_PREFIX = 'lease:';

function leaseStorageKey(leaseKey: string): string {
  return `${LEASE_PREFIX}${leaseKey}`;
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
}
