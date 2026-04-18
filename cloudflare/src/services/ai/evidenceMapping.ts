import type { WorkerRequestContext } from '../../router';
import {
  generateTextWithAi,
  getAiRuntimeStatus,
  queryVectorDocuments,
  upsertVectorDocuments,
} from './runtime';
import { json, methodNotAllowed, readJson } from '../../utils/http';

type MappingType = 'Security Plan' | 'Component' | 'Control';

type EvidenceArtifactRow = {
  id: string;
  tenant_id: string;
  job_id: string;
  object_key: string;
  content_type: string | null;
  size_bytes: number | null;
  checksum: string | null;
  created_at: string;
  source_name: string;
};

type EvidenceMappingRow = {
  id: string;
  tenant_id: string;
  artifact_id: string;
  mapped_type: MappingType;
  mapped_id: string;
  mapped_title: string;
  parent_label: string | null;
  lineage: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type RecommendationRunRow = {
  id: string;
  tenant_id: string;
  artifact_id: string;
  status: string;
  threshold: number;
  recommendations_json: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type CreateMappingsInput = {
  mappingType?: MappingType;
  targetIds?: string[];
};

type GenerateRecommendationsInput = {
  threshold?: number;
};

type TargetRecord = {
  id: string;
  mappingType: MappingType;
  title: string;
  parentLabel: string;
  description: string;
};

function nowIso() {
  return new Date().toISOString();
}

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

function requireTenant(ctx: WorkerRequestContext): string | Response {
  if (!ctx.tenantId) {
    return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
  }
  return ctx.tenantId;
}

function requireUser(ctx: WorkerRequestContext): string | Response {
  if (!ctx.userId) {
    return json({ error: 'missing_user', message: 'x-user-id is required' }, { status: 401 });
  }
  return ctx.userId;
}

async function listEvidenceArtifacts(env: WorkerRequestContext['env'], tenantId: string) {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      artifact.id,
      artifact.tenant_id,
      artifact.job_id,
      artifact.object_key,
      artifact.content_type,
      artifact.size_bytes,
      artifact.checksum,
      artifact.created_at,
      source.name AS source_name
    FROM evidence_artifacts AS artifact
    INNER JOIN evidence_jobs AS job
      ON job.id = artifact.job_id
    INNER JOIN evidence_sources AS source
      ON source.id = job.source_id
    WHERE artifact.tenant_id = ?
    ORDER BY artifact.created_at DESC
    `,
  )
    .bind(tenantId)
    .all<EvidenceArtifactRow>();
  return results;
}

async function getEvidenceArtifact(env: WorkerRequestContext['env'], tenantId: string, artifactId: string) {
  return env.D1_MAIN.prepare(
    `
    SELECT
      artifact.id,
      artifact.tenant_id,
      artifact.job_id,
      artifact.object_key,
      artifact.content_type,
      artifact.size_bytes,
      artifact.checksum,
      artifact.created_at,
      source.name AS source_name
    FROM evidence_artifacts AS artifact
    INNER JOIN evidence_jobs AS job
      ON job.id = artifact.job_id
    INNER JOIN evidence_sources AS source
      ON source.id = job.source_id
    WHERE artifact.tenant_id = ? AND artifact.id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, artifactId)
    .first<EvidenceArtifactRow>();
}

async function listMappings(env: WorkerRequestContext['env'], tenantId: string, artifactId: string) {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM evidence_record_mappings
    WHERE tenant_id = ? AND artifact_id = ?
    ORDER BY created_at DESC
    `,
  )
    .bind(tenantId, artifactId)
    .all<EvidenceMappingRow>();
  return results;
}

async function listTargets(env: WorkerRequestContext['env'], tenantId: string) {
  const [securityPlans, components, controls] = await Promise.all([
    env.D1_MAIN.prepare(
      `
      SELECT id, name, observation
      FROM compliance_assessments
      WHERE tenant_id = ?
      ORDER BY updated_at DESC, name ASC
      LIMIT 20
      `,
    )
      .bind(tenantId)
      .all<{ id: string; name: string; observation: string | null }>(),
    env.D1_MAIN.prepare(
      `
      SELECT solution.id, solution.name, entity.name AS provider_name, solution.description
      FROM solutions AS solution
      INNER JOIN entities AS entity
        ON entity.id = solution.provider_entity_id
      WHERE solution.tenant_id = ?
      ORDER BY solution.updated_at DESC, solution.name ASC
      LIMIT 20
      `,
    )
      .bind(tenantId)
      .all<{ id: string; name: string; provider_name: string; description: string | null }>(),
    env.D1_MAIN.prepare(
      `
      SELECT id, COALESCE(ref_id, id) AS ref_id, name, description, owner_name
      FROM applied_controls
      WHERE tenant_id = ?
      ORDER BY updated_at DESC, name ASC
      LIMIT 30
      `,
    )
      .bind(tenantId)
      .all<{ id: string; ref_id: string; name: string; description: string | null; owner_name: string | null }>(),
  ]);

  return {
    securityPlans: securityPlans.results.map((row) => ({
      id: row.id,
      mappingType: 'Security Plan' as const,
      title: row.name,
      parentLabel: 'Security Plan',
      description: row.observation ?? 'Security-plan backed assessment context.',
    })),
    components: components.results.map((row) => ({
      id: row.id,
      mappingType: 'Component' as const,
      title: row.name,
      parentLabel: row.provider_name,
      description: row.description ?? 'Component or solution context.',
    })),
    controls: controls.results.map((row) => ({
      id: row.id,
      mappingType: 'Control' as const,
      title: `${row.ref_id} · ${row.name}`,
      parentLabel: row.owner_name ?? 'Applied control',
      description: row.description ?? 'Control implementation available for mapping.',
    })),
  };
}

function toMappingResponse(row: EvidenceMappingRow) {
  return {
    id: row.id,
    mappedId: row.mapped_id,
    mappingType: row.mapped_type,
    mappingTitle: row.mapped_title,
    parentLabel: row.parent_label,
    lineage: row.lineage,
    createdAt: row.created_at,
  };
}

async function getLatestRecommendationRun(env: WorkerRequestContext['env'], tenantId: string, artifactId: string) {
  return env.D1_MAIN.prepare(
    `
    SELECT *
    FROM evidence_mapping_recommendation_runs
    WHERE tenant_id = ? AND artifact_id = ?
    ORDER BY created_at DESC
    LIMIT 1
    `,
  )
    .bind(tenantId, artifactId)
    .first<RecommendationRunRow>();
}

function calculateScore(artifact: EvidenceArtifactRow, target: TargetRecord) {
  const haystack = `${artifact.object_key} ${artifact.source_name}`.toLowerCase();
  const targetText = `${target.title} ${target.description} ${target.parentLabel}`.toLowerCase();
  let score = 42;
  for (const token of targetText.split(/[^a-z0-9]+/).filter(Boolean)) {
    if (token.length > 3 && haystack.includes(token)) {
      score += 11;
    }
  }
  if (target.mappingType === 'Control' && haystack.includes('evidence')) {
    score += 8;
  }
  return Math.max(18, Math.min(98, score));
}

function buildArtifactContext(artifact: EvidenceArtifactRow) {
  return [
    `Artifact path: ${artifact.object_key}`,
    `Source: ${artifact.source_name}`,
    `Content type: ${artifact.content_type ?? 'unknown'}`,
    artifact.checksum ? `Checksum: ${artifact.checksum}` : null,
  ]
    .filter(Boolean)
    .join('. ');
}

function buildTargetDocumentText(target: TargetRecord) {
  return `${target.mappingType}: ${target.title}. Parent: ${target.parentLabel}. ${target.description}`;
}

async function buildRecommendationItems(
  ctx: WorkerRequestContext,
  tenantId: string,
  artifact: EvidenceArtifactRow,
  targets: TargetRecord[],
) {
  const runtime = await getAiRuntimeStatus(ctx.env);
  if (!runtime.vectorizeAvailable) {
    return targets
      .map((target) => ({
        id: crypto.randomUUID(),
        mappedId: target.id,
        mappingType: target.mappingType,
        title: target.title,
        parentLabel: target.parentLabel,
        rationale: `Similarity was derived from the artifact path, source context, and canonical target metadata for ${target.title}.`,
        score: calculateScore(artifact, target),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 12);
  }

  const namespace = `evidence-mapping:${tenantId}:targets`;
  await upsertVectorDocuments(
    ctx.env,
    namespace,
    targets.map((target) => ({
      id: `${target.mappingType}:${target.id}`,
      text: buildTargetDocumentText(target),
      metadata: {
        tenantId,
        mappedId: target.id,
        mappingType: target.mappingType,
        title: target.title,
        parentLabel: target.parentLabel,
      },
    })),
  );

  const matches = await queryVectorDocuments(ctx.env, namespace, buildArtifactContext(artifact), 12);
  if (matches.length === 0) {
    return targets
      .map((target) => ({
        id: crypto.randomUUID(),
        mappedId: target.id,
        mappingType: target.mappingType,
        title: target.title,
        parentLabel: target.parentLabel,
        rationale: `Similarity was derived from the artifact path, source context, and canonical target metadata for ${target.title}.`,
        score: calculateScore(artifact, target),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 12);
  }

  const targetById = new Map(targets.map((target) => [target.id, target]));
  const items = [];
  for (const match of matches) {
    const mappedId = String(match.metadata.mappedId ?? match.id.split(':').slice(1).join(':'));
    const target = targetById.get(mappedId);
    if (!target) {
      continue;
    }

    const rationale =
      (await generateTextWithAi(ctx.env, {
        systemPrompt:
          'You explain why an evidence artifact should map to a compliance record. Respond with one sentence grounded only in the provided artifact and target context.',
        userPrompt: [
          `Artifact: ${buildArtifactContext(artifact)}`,
          `Target: ${buildTargetDocumentText(target)}`,
          `Similarity score: ${match.score}`,
        ].join('\n'),
        maxTokens: 120,
        temperature: 0.1,
      })) ??
      `Vector similarity aligned the artifact context with ${target.title} in the canonical target catalog.`;

    items.push({
      id: crypto.randomUUID(),
      mappedId: target.id,
      mappingType: target.mappingType,
      title: target.title,
      parentLabel: target.parentLabel,
      rationale,
      score: match.score,
    });
  }

  return items;
}

async function buildWorkspace(ctx: WorkerRequestContext, tenantId: string) {
  const [artifacts, targets, runtime] = await Promise.all([
    listEvidenceArtifacts(ctx.env, tenantId),
    listTargets(ctx.env, tenantId),
    getAiRuntimeStatus(ctx.env),
  ]);

  const records = await Promise.all(
    artifacts.map(async (artifact) => {
      const [mappingRow, recommendationRow] = await Promise.all([
        ctx.env.D1_MAIN.prepare(`SELECT COUNT(1) AS count FROM evidence_record_mappings WHERE tenant_id = ? AND artifact_id = ?`)
          .bind(tenantId, artifact.id)
          .first<{ count: number | null }>(),
        ctx.env.D1_MAIN.prepare(`SELECT COUNT(1) AS count FROM evidence_mapping_recommendation_runs WHERE tenant_id = ? AND artifact_id = ?`)
          .bind(tenantId, artifact.id)
          .first<{ count: number | null }>(),
      ]);

      return {
        id: artifact.id,
        title: artifact.object_key.split('/').pop() ?? artifact.object_key,
        objectKey: artifact.object_key,
        contentType: artifact.content_type,
        sourceName: artifact.source_name,
        uploadedAt: artifact.created_at,
        mappingCount: Number(mappingRow?.count ?? 0),
        recommendationCount: Number(recommendationRow?.count ?? 0),
        status: Number(recommendationRow?.count ?? 0) > 0 ? 'Ready' : 'Needs Metadata',
      };
    }),
  );

  return {
    readiness: {
      evidenceModuleEnabled: true,
      canMapEvidence: !!ctx.userId,
      evidenceRecords: records.length,
      targetSecurityPlans: targets.securityPlans.length,
      targetComponents: targets.components.length,
      targetControls: targets.controls.length,
      aiRecommendationsAvailable: runtime.textGenerationAvailable,
      vectorDatabaseDeployed: runtime.vectorizeAvailable,
    },
    records,
  };
}

async function buildDetail(ctx: WorkerRequestContext, tenantId: string, artifactId: string) {
  const artifact = await getEvidenceArtifact(ctx.env, tenantId, artifactId);
  if (!artifact) {
    return null;
  }

  const [mappings, targets, latestRun] = await Promise.all([
    listMappings(ctx.env, tenantId, artifactId),
    listTargets(ctx.env, tenantId),
    getLatestRecommendationRun(ctx.env, tenantId, artifactId),
  ]);

  return {
    artifact: {
      id: artifact.id,
      title: artifact.object_key.split('/').pop() ?? artifact.object_key,
      objectKey: artifact.object_key,
      contentType: artifact.content_type,
      sizeBytes: artifact.size_bytes,
      checksum: artifact.checksum,
      uploadedAt: artifact.created_at,
      sourceName: artifact.source_name,
    },
    mappings: mappings.map(toMappingResponse),
    targets,
    recommendations: latestRun
      ? {
          runId: latestRun.id,
          threshold: latestRun.threshold,
          createdAt: latestRun.created_at,
          items: asJson<
            Array<{
              id: string;
              mappedId: string;
              mappingType: MappingType;
              title: string;
              parentLabel: string;
              rationale: string;
              score: number;
            }>
          >(latestRun.recommendations_json, []),
        }
      : null,
  };
}

export async function handleEvidenceMappingRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const tenantId = requireTenant(ctx);
  if (tenantId instanceof Response) {
    return tenantId;
  }

  const [resource, artifactId, action, nestedId] = segments;

  if (!resource && ctx.request.method === 'GET') {
    return json({ data: await buildWorkspace(ctx, tenantId) });
  }

  if (resource === 'evidence' && artifactId && !action && ctx.request.method === 'GET') {
    const detail = await buildDetail(ctx, tenantId, artifactId);
    return detail ? json({ data: detail }) : json({ error: 'evidence_artifact_not_found' }, { status: 404 });
  }

  if (resource === 'evidence' && artifactId && action === 'mappings' && ctx.request.method === 'POST') {
    const userId = requireUser(ctx);
    if (userId instanceof Response) {
      return userId;
    }

    const detail = await buildDetail(ctx, tenantId, artifactId);
    if (!detail) {
      return json({ error: 'evidence_artifact_not_found' }, { status: 404 });
    }

    const body = await readJson<CreateMappingsInput>(ctx.request);
    const mappingType = body.mappingType;
    const targetIds = body.targetIds ?? [];
    if (!mappingType || targetIds.length === 0) {
      return json({ error: 'invalid_mapping_request' }, { status: 400 });
    }

    const targetList =
      mappingType === 'Security Plan'
        ? detail.targets.securityPlans
        : mappingType === 'Component'
          ? detail.targets.components
          : detail.targets.controls;

    const targetMap = new Map(targetList.map((target) => [target.id, target]));

    for (const targetId of targetIds) {
      const target = targetMap.get(targetId);
      if (!target) {
        continue;
      }
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT OR IGNORE INTO evidence_record_mappings (
          id,
          tenant_id,
          artifact_id,
          mapped_type,
          mapped_id,
          mapped_title,
          parent_label,
          lineage,
          created_by_user_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          crypto.randomUUID(),
          tenantId,
          artifactId,
          mappingType,
          target.id,
          target.title,
          target.parentLabel,
          `Mapped from ${detail.artifact.title}`,
          userId,
          nowIso(),
          nowIso(),
        )
        .run();
    }

    return json({ data: await buildDetail(ctx, tenantId, artifactId) });
  }

  if (resource === 'evidence' && artifactId && action === 'mappings' && nestedId && ctx.request.method === 'DELETE') {
    await ctx.env.D1_MAIN.prepare(
      `DELETE FROM evidence_record_mappings WHERE tenant_id = ? AND artifact_id = ? AND id = ?`,
    )
      .bind(tenantId, artifactId, nestedId)
      .run();

    return json({ data: await buildDetail(ctx, tenantId, artifactId) });
  }

  if (resource === 'evidence' && artifactId && action === 'recommendations' && ctx.request.method === 'POST') {
    const userId = requireUser(ctx);
    if (userId instanceof Response) {
      return userId;
    }

    const artifact = await getEvidenceArtifact(ctx.env, tenantId, artifactId);
    if (!artifact) {
      return json({ error: 'evidence_artifact_not_found' }, { status: 404 });
    }

    const body = await readJson<GenerateRecommendationsInput>(ctx.request);
    const threshold = Math.max(0, Math.min(100, Math.round(body.threshold ?? 50)));
    const targets = await listTargets(ctx.env, tenantId);
    const combinedTargets = [...targets.securityPlans, ...targets.components, ...targets.controls];
    const items = await buildRecommendationItems(ctx, tenantId, artifact, combinedTargets);

    await ctx.env.D1_MAIN.prepare(
      `
      INSERT INTO evidence_mapping_recommendation_runs (
        id,
        tenant_id,
        artifact_id,
        status,
        threshold,
        recommendations_json,
        created_by_user_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, 'Finished', ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        crypto.randomUUID(),
        tenantId,
        artifactId,
        threshold,
        JSON.stringify(items),
        userId,
        nowIso(),
        nowIso(),
      )
      .run();

    return json({ data: await buildDetail(ctx, tenantId, artifactId) });
  }

  if (resource === 'evidence') {
    return methodNotAllowed(['GET', 'POST', 'DELETE']);
  }

  return json({ error: 'not_found', path: segments.join('/') }, { status: 404 });
}
