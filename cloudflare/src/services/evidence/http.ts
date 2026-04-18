import type { WorkerRequestContext } from '../../router';
import type { EvidenceJobMessage } from '../../types/env';
import { requireAnyPermission } from '../../authorization';
import { json, methodNotAllowed, readJson } from '../../utils/http';

type EvidenceSourceRow = {
  id: string;
  tenant_id: string;
  name: string;
  provider: string;
  config_json: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

type EvidenceJobRow = {
  id: string;
  tenant_id: string;
  source_id: string;
  source_name: string;
  scheduled_for: string;
  started_at: string | null;
  finished_at: string | null;
  status: string;
  status_detail: string | null;
  artifact_count: number;
};

type CreateEvidenceSourceInput = {
  name?: string;
  provider?: string;
  config?: Record<string, unknown>;
};

export async function handleEvidenceRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const [resource, id, action] = segments;

  if (resource === 'sources' && ctx.request.method === 'GET') {
    const access = await requireAnyPermission(
      ctx,
      ['view_evidence', 'collect_evidence'],
      'Evidence access requires evidence-view permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const stmt = ctx.env.D1_MAIN.prepare(
      `
      SELECT id, tenant_id, name, provider, config_json, is_active, created_at, updated_at
      FROM evidence_sources
      WHERE tenant_id = ?
      ORDER BY name ASC
      `,
    ).bind(access.tenantId);

    const { results } = await stmt.all<EvidenceSourceRow>();

    // Do not expose config_json in full to the client
    const safe = results.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      provider: row.provider,
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return json({ data: safe });
  }

  if (resource === 'sources' && id && action === 'collect') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }

    const access = await requireAnyPermission(
      ctx,
      ['collect_evidence'],
      'Collecting evidence requires evidence-collection permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const jobId = crypto.randomUUID();
    const payload: EvidenceJobMessage = {
      type: 'evidence.job.run',
      tenantId: access.tenantId,
      sourceId: id,
      jobId,
      requestedBy: access.userId,
    };

    await ctx.env.D1_MAIN.prepare(
      `
      INSERT INTO evidence_jobs (
        id,
        tenant_id,
        source_id,
        scheduled_for,
        started_at,
        finished_at,
        status,
        status_detail,
        last_cursor
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        jobId,
        access.tenantId,
        id,
        new Date().toISOString(),
        null,
        null,
        'pending',
        'Queued from the Cloudflare Worker API',
        null,
      )
      .run();

    await ctx.env.QUEUE_EVIDENCE_JOBS.send(payload);

    return json(
      {
        data: {
          jobId,
          sourceId: id,
          status: 'pending',
        },
      },
      { status: 202 },
    );
  }

  if (resource === 'sources' && id && ctx.request.method === 'PUT') {
    const access = await requireAnyPermission(
      ctx,
      ['collect_evidence'],
      'Updating evidence sources requires evidence-collection permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const body = await readJson<CreateEvidenceSourceInput>(ctx.request);
    const name = body.name?.trim();
    const provider = body.provider?.trim();

    if (!name || !provider) {
      return json(
        { error: 'invalid_source', message: 'Source name and provider are required.' },
        { status: 400 },
      );
    }

    await ctx.env.D1_MAIN.prepare(
      `
      UPDATE evidence_sources
      SET name = ?,
          provider = ?,
          config_json = ?,
          updated_at = ?
      WHERE id = ? AND tenant_id = ?
      `,
    )
      .bind(
        name,
        provider,
        JSON.stringify(body.config ?? {}),
        new Date().toISOString(),
        id,
        access.tenantId,
      )
      .run();

    const updated = await ctx.env.D1_MAIN.prepare(
      `
      SELECT id, tenant_id, name, provider, config_json, is_active, created_at, updated_at
      FROM evidence_sources
      WHERE id = ? AND tenant_id = ?
      `,
    )
      .bind(id, access.tenantId)
      .first<EvidenceSourceRow>();

    return updated
      ? json({
          data: {
            id: updated.id,
            tenantId: updated.tenant_id,
            name: updated.name,
            provider: updated.provider,
            isActive: !!updated.is_active,
            createdAt: updated.created_at,
            updatedAt: updated.updated_at,
          },
        })
      : json({ error: 'not_found' }, { status: 404 });
  }

  if (resource === 'sources' && id && ctx.request.method === 'DELETE') {
    const access = await requireAnyPermission(
      ctx,
      ['collect_evidence'],
      'Deleting evidence sources requires evidence-collection permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const result = await ctx.env.D1_MAIN.prepare(
      `DELETE FROM evidence_sources WHERE id = ? AND tenant_id = ?`,
    )
      .bind(id, access.tenantId)
      .run();

    if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
    return json({ data: { deleted: true, id } });
  }

  if (resource === 'sources' && id) {
    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'sources' && ctx.request.method === 'POST') {
    const access = await requireAnyPermission(
      ctx,
      ['collect_evidence'],
      'Creating evidence sources requires evidence-collection permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const body = await readJson<CreateEvidenceSourceInput>(ctx.request);
    const name = body.name?.trim();
    const provider = body.provider?.trim();

    if (!name || !provider) {
      return json(
        { error: 'invalid_source', message: 'Source name and provider are required.' },
        { status: 400 },
      );
    }

    const sourceId = crypto.randomUUID();

    await ctx.env.D1_MAIN.prepare(
      `
      INSERT INTO evidence_sources (id, tenant_id, name, provider, config_json, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
      `,
    )
      .bind(sourceId, access.tenantId, name, provider, JSON.stringify(body.config ?? {}))
      .run();

    return json(
      {
        data: {
          id: sourceId,
          tenantId: access.tenantId,
          name,
          provider,
          isActive: true,
        },
      },
      { status: 201 },
    );
  }

  if (resource === 'jobs' && ctx.request.method === 'GET') {
    const access = await requireAnyPermission(
      ctx,
      ['view_evidence', 'collect_evidence'],
      'Evidence job access requires evidence-view permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const stmt = ctx.env.D1_MAIN.prepare(
      `
      SELECT
        job.id,
        job.tenant_id,
        job.source_id,
        source.name AS source_name,
        job.scheduled_for,
        job.started_at,
        job.finished_at,
        job.status,
        job.status_detail,
        COUNT(artifact.id) AS artifact_count
      FROM evidence_jobs AS job
      INNER JOIN evidence_sources AS source
        ON source.id = job.source_id
      LEFT JOIN evidence_artifacts AS artifact
        ON artifact.job_id = job.id
      WHERE job.tenant_id = ?
      GROUP BY
        job.id,
        job.tenant_id,
        job.source_id,
        source.name,
        job.scheduled_for,
        job.started_at,
        job.finished_at,
        job.status,
        job.status_detail
      ORDER BY job.scheduled_for DESC
      LIMIT 50
      `,
    ).bind(access.tenantId);

    const { results } = await stmt.all<EvidenceJobRow>();

    return json({
      data: results.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        sourceId: row.source_id,
        sourceName: row.source_name,
        scheduledFor: row.scheduled_for,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        status: row.status,
        statusDetail: row.status_detail,
        artifactCount: row.artifact_count,
      })),
    });
  }

  if (resource === 'artifacts' && ctx.request.method === 'GET') {
    const access = await requireAnyPermission(
      ctx,
      ['view_evidence', 'collect_evidence'],
      'Evidence artifact access requires evidence-view permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const { results } = await ctx.env.D1_MAIN.prepare(
      `
      SELECT id, tenant_id, job_id, object_key, content_type, size_bytes, checksum, created_at
      FROM evidence_artifacts
      WHERE tenant_id = ?
      ORDER BY created_at DESC
      LIMIT 50
      `,
    )
      .bind(access.tenantId)
      .all<{
        id: string;
        tenant_id: string;
        job_id: string;
        object_key: string;
        content_type: string | null;
        size_bytes: number | null;
        checksum: string | null;
        created_at: string;
      }>();

    return json({
      data: results.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        jobId: row.job_id,
        objectKey: row.object_key,
        contentType: row.content_type,
        sizeBytes: row.size_bytes,
        checksum: row.checksum,
        createdAt: row.created_at,
      })),
    });
  }

  if (resource === 'sources') {
    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'jobs' || resource === 'artifacts') {
    return methodNotAllowed(['GET']);
  }

  return json({ error: 'not_found', path: segments.join('/') }, { status: 404 });
}
