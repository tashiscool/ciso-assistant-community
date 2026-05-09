import type { WorkerRequestContext } from '../../router';
import type { EvidenceJobMessage } from '../../types/env';
import { requireAnyPermission, requireAnyScopedPermission, type ScopedPermissionContext } from '../../authorization';
import { json, methodNotAllowed, readJson } from '../../utils/http';
import { startTenantWorkflowRun } from '../../utils/workflows';
import { processEvidenceJob } from '../../queues/evidence';

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
  folder_id: string | null;
  source_id: string;
  source_name: string;
  scheduled_for: string;
  started_at: string | null;
  finished_at: string | null;
  status: string;
  status_detail: string | null;
  run_family: string;
  input_mode: string;
  bundle_kind: string;
  manifest_key: string | null;
  normalization_status: string;
  coverage_json: string;
  artifact_count: number;
};

type EvidenceJobReplayRow = {
  id: string;
  folder_id: string | null;
  source_id: string;
  status: string;
  status_detail: string | null;
  manifest_key: string | null;
  normalization_status: string;
  finished_at: string | null;
};

type EvidenceArtifactRow = {
  id: string;
  tenant_id: string;
  job_id: string;
  object_key: string;
  content_type: string | null;
  size_bytes: number | null;
  checksum: string | null;
  created_at: string;
  artifact_family: string;
  manifest_group: string | null;
};

type CreateEvidenceSourceInput = {
  name?: string;
  provider?: string;
  config?: Record<string, unknown>;
};

type CollectEvidenceInput = {
  inputMode?: 'live' | 'fixture' | 'tracker';
  folderId?: string;
  bundleKind?: 'assessment' | 'threat-hunt' | '20x' | 'tracker-to-20x';
  adapterHints?: Record<string, unknown>;
};

function asJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function hasEvidenceScope(
  access: Pick<ScopedPermissionContext, 'accessibleDomainIds'>,
  folderId: string | null | undefined,
): boolean {
  return !folderId || access.accessibleDomainIds.includes(folderId);
}

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

    const access = await requireAnyScopedPermission(
      ctx,
      ['collect_evidence'],
      'Collecting evidence requires evidence-collection permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const body = await readJson<CollectEvidenceInput>(ctx.request);
    if (body.folderId?.trim() && !hasEvidenceScope(access, body.folderId)) {
      return json(
        {
          error: 'forbidden',
          message: 'You do not have access to collect evidence for the selected folder.',
        },
        { status: 403 },
      );
    }
    const jobId = crypto.randomUUID();
    const workflowRunId = `evidence:${jobId}`;
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
        folder_id,
        source_id,
        scheduled_for,
        started_at,
        finished_at,
        status,
        status_detail,
        last_cursor,
        run_family,
        input_mode,
        bundle_kind,
        manifest_key,
        normalization_status,
        coverage_json,
        error_summary_json,
        source_schema_version,
        adapter_hints_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        jobId,
        access.tenantId,
        body.folderId?.trim() || null,
        id,
        new Date().toISOString(),
        null,
        null,
        'pending',
        'Queued from the Cloudflare Worker API',
        null,
        'evidence_collection',
        body.inputMode?.trim() || 'live',
        body.bundleKind?.trim() || 'assessment',
        null,
        'pending',
        '{}',
        '{}',
        'v1',
        JSON.stringify(body.adapterHints ?? {}),
      )
      .run();

    try {
      await startTenantWorkflowRun(ctx.env, access.tenantId, {
        runId: workflowRunId,
        runType: 'evidence_collection',
        module: 'Evidence',
        title: `Evidence collection for source ${id}`,
        status: 'Queued',
        folderId: body.folderId?.trim() || null,
        sourceRecordId: jobId,
        route: `/assurance/evidence?evidenceJobId=${encodeURIComponent(jobId)}`,
        detail: `Queued ${body.inputMode?.trim() || 'live'} collection for ${body.bundleKind?.trim() || 'assessment'} evidence.`,
        metadata: {
          evidenceJobId: jobId,
          sourceId: id,
          inputMode: body.inputMode?.trim() || 'live',
          bundleKind: body.bundleKind?.trim() || 'assessment',
        },
      });
    } catch (error) {
      console.warn('Failed to publish evidence workflow run', error);
    }

    await ctx.env.QUEUE_EVIDENCE_JOBS.send(payload);

    return json(
      {
        data: {
          jobId,
          sourceId: id,
          status: 'pending',
          inputMode: body.inputMode?.trim() || 'live',
          bundleKind: body.bundleKind?.trim() || 'assessment',
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

  if (resource === 'jobs' && !id && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(
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
        job.folder_id,
        job.source_id,
        source.name AS source_name,
        job.scheduled_for,
        job.started_at,
        job.finished_at,
        job.status,
        job.status_detail,
        job.run_family,
        job.input_mode,
        job.bundle_kind,
        job.manifest_key,
        job.normalization_status,
        job.coverage_json,
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
        job.folder_id,
        job.source_id,
        source.name,
        job.scheduled_for,
        job.started_at,
        job.finished_at,
        job.status,
        job.status_detail
        ,
        job.run_family,
        job.input_mode,
        job.bundle_kind,
        job.manifest_key,
        job.normalization_status,
        job.coverage_json
      ORDER BY job.scheduled_for DESC
      LIMIT 50
      `,
    ).bind(access.tenantId);

    const { results } = await stmt.all<EvidenceJobRow>();

    return json({
      data: results
        .filter((row) => hasEvidenceScope(access, row.folder_id))
        .map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        folderId: row.folder_id,
        sourceId: row.source_id,
        sourceName: row.source_name,
        scheduledFor: row.scheduled_for,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        status: row.status,
        statusDetail: row.status_detail,
        runFamily: row.run_family,
        inputMode: row.input_mode,
        bundleKind: row.bundle_kind,
        manifestKey: row.manifest_key,
        normalizationStatus: row.normalization_status,
        coverage: asJson<Record<string, unknown>>(row.coverage_json, {}),
        artifactCount: row.artifact_count,
        })),
    });
  }

  if (resource === 'jobs' && id && !action && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(
      ctx,
      ['view_evidence', 'collect_evidence'],
      'Evidence job access requires evidence-view permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const row = await ctx.env.D1_MAIN.prepare(
      `
      SELECT
        job.id,
        job.tenant_id,
        job.folder_id,
        job.source_id,
        source.name AS source_name,
        job.scheduled_for,
        job.started_at,
        job.finished_at,
        job.status,
        job.status_detail,
        job.run_family,
        job.input_mode,
        job.bundle_kind,
        job.manifest_key,
        job.normalization_status,
        job.coverage_json,
        COUNT(artifact.id) AS artifact_count
      FROM evidence_jobs AS job
      INNER JOIN evidence_sources AS source
        ON source.id = job.source_id
      LEFT JOIN evidence_artifacts AS artifact
        ON artifact.job_id = job.id
      WHERE job.tenant_id = ? AND job.id = ?
      GROUP BY
        job.id,
        job.tenant_id,
        job.folder_id,
        job.source_id,
        source.name,
        job.scheduled_for,
        job.started_at,
        job.finished_at,
        job.status,
        job.status_detail,
        job.run_family,
        job.input_mode,
        job.bundle_kind,
        job.manifest_key,
        job.normalization_status,
        job.coverage_json
      LIMIT 1
      `,
    )
      .bind(access.tenantId, id)
      .first<EvidenceJobRow>();

    if (!row) {
      return json({ error: 'not_found', message: 'Evidence job not found.' }, { status: 404 });
    }
    if (!hasEvidenceScope(access, row.folder_id)) {
      return json({ error: 'not_found', message: 'Evidence job not found.' }, { status: 404 });
    }

    const artifacts = await ctx.env.D1_MAIN.prepare(
      `
      SELECT id, tenant_id, job_id, object_key, content_type, size_bytes, checksum, created_at, artifact_family, manifest_group
      FROM evidence_artifacts
      WHERE tenant_id = ? AND job_id = ?
      ORDER BY created_at ASC
      `,
    )
      .bind(access.tenantId, id)
      .all<EvidenceArtifactRow>();

    return json({
      data: {
        id: row.id,
        tenantId: row.tenant_id,
        folderId: row.folder_id,
        sourceId: row.source_id,
        sourceName: row.source_name,
        scheduledFor: row.scheduled_for,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        status: row.status,
        statusDetail: row.status_detail,
        runFamily: row.run_family,
        inputMode: row.input_mode,
        bundleKind: row.bundle_kind,
        manifestKey: row.manifest_key,
        normalizationStatus: row.normalization_status,
        coverage: asJson<Record<string, unknown>>(row.coverage_json, {}),
        artifactCount: row.artifact_count,
        artifacts: artifacts.results.map((artifact) => ({
          id: artifact.id,
          artifactFamily: artifact.artifact_family,
          objectKey: artifact.object_key,
          sizeBytes: artifact.size_bytes,
          contentType: artifact.content_type,
          checksum: artifact.checksum,
          createdAt: artifact.created_at,
        })),
      },
    });
  }

  if (resource === 'jobs' && id && action === 'replay') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }

    if (ctx.env.APP_ENV !== 'development') {
      return json({ error: 'not_found', path: segments.join('/') }, { status: 404 });
    }

    const access = await requireAnyScopedPermission(
      ctx,
      ['collect_evidence'],
      'Replaying evidence jobs requires evidence-collection permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const job = await ctx.env.D1_MAIN.prepare(
      `
      SELECT id, folder_id, source_id, status, status_detail, manifest_key, normalization_status, finished_at
      FROM evidence_jobs
      WHERE tenant_id = ? AND id = ?
      LIMIT 1
      `,
    )
      .bind(access.tenantId, id)
      .first<EvidenceJobReplayRow>();

    if (!job || !hasEvidenceScope(access, job.folder_id)) {
      return json({ error: 'not_found', message: 'Evidence job not found.' }, { status: 404 });
    }

    const result = await processEvidenceJob(
      {
        type: 'evidence.job.run',
        tenantId: access.tenantId,
        sourceId: job.source_id,
        jobId: job.id,
        requestedBy: access.userId,
      },
      ctx.env,
      'inline-replay',
    );

    const updated = await ctx.env.D1_MAIN.prepare(
      `
      SELECT id, folder_id, source_id, status, status_detail, manifest_key, normalization_status, finished_at
      FROM evidence_jobs
      WHERE tenant_id = ? AND id = ?
      LIMIT 1
      `,
    )
      .bind(access.tenantId, id)
      .first<EvidenceJobReplayRow>();

    return json({
      data: {
        replayResult: result,
        jobId: id,
        status: updated?.status ?? job.status,
        statusDetail: updated?.status_detail ?? job.status_detail,
        manifestKey: updated?.manifest_key ?? job.manifest_key,
        normalizationStatus: updated?.normalization_status ?? job.normalization_status,
        finishedAt: updated?.finished_at ?? job.finished_at,
      },
    });
  }

  if (resource === 'jobs' && id && action === 'artifacts') {
    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    const access = await requireAnyScopedPermission(
      ctx,
      ['view_evidence', 'collect_evidence'],
      'Evidence artifact access requires evidence-view permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const family = segments[3];
    if (!family) {
      return json({ error: 'invalid_family', message: 'Artifact family is required.' }, { status: 400 });
    }

    const job = await ctx.env.D1_MAIN.prepare(
      `
      SELECT folder_id
      FROM evidence_jobs
      WHERE tenant_id = ? AND id = ?
      LIMIT 1
      `,
    )
      .bind(access.tenantId, id)
      .first<{ folder_id: string | null }>();

    if (!job || !hasEvidenceScope(access, job.folder_id)) {
      return json({ error: 'not_found', message: 'Evidence job not found.' }, { status: 404 });
    }

    const artifacts = await ctx.env.D1_MAIN.prepare(
      `
      SELECT id, tenant_id, job_id, object_key, content_type, size_bytes, checksum, created_at, artifact_family, manifest_group
      FROM evidence_artifacts
      WHERE tenant_id = ? AND job_id = ? AND artifact_family = ?
      ORDER BY created_at DESC
      `,
    )
      .bind(access.tenantId, id, family)
      .all<EvidenceArtifactRow>();

    if (artifacts.results.length === 0) {
      return json({ error: 'not_found', message: 'No artifacts were found for this family.' }, { status: 404 });
    }

    const preview = await ctx.env.R2_EVIDENCE.get(artifacts.results[0].object_key);
    const previewPayload =
      preview && artifacts.results[0].content_type?.includes('json')
        ? await preview.json()
        : preview
          ? await preview.text()
          : null;

    return json({
      data: {
        family,
        items: artifacts.results.map((artifact) => ({
          id: artifact.id,
          artifactFamily: artifact.artifact_family,
          objectKey: artifact.object_key,
          sizeBytes: artifact.size_bytes,
          contentType: artifact.content_type,
          checksum: artifact.checksum,
          createdAt: artifact.created_at,
        })),
        retrieval: {
          kind: 'r2',
          previewAvailable: previewPayload !== null,
        },
        preview: previewPayload,
      },
    });
  }

  if (resource === 'artifacts' && ctx.request.method === 'GET') {
    const access = await requireAnyScopedPermission(
      ctx,
      ['view_evidence', 'collect_evidence'],
      'Evidence artifact access requires evidence-view permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const { results } = await ctx.env.D1_MAIN.prepare(
      `
      SELECT artifact.id, artifact.tenant_id, artifact.job_id, artifact.object_key, artifact.content_type, artifact.size_bytes,
             artifact.checksum, artifact.created_at, artifact.artifact_family, artifact.manifest_group, job.folder_id
      FROM evidence_artifacts AS artifact
      INNER JOIN evidence_jobs AS job
        ON job.id = artifact.job_id
      WHERE artifact.tenant_id = ?
      ORDER BY artifact.created_at DESC
      LIMIT 50
      `,
    )
      .bind(access.tenantId)
      .all<EvidenceArtifactRow & { folder_id: string | null }>();

    return json({
      data: results
        .filter((row) => hasEvidenceScope(access, row.folder_id))
        .map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        jobId: row.job_id,
        objectKey: row.object_key,
        contentType: row.content_type,
        sizeBytes: row.size_bytes,
        checksum: row.checksum,
        createdAt: row.created_at,
        artifactFamily: row.artifact_family,
        manifestGroup: row.manifest_group,
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
