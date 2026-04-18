import type { WorkerRequestContext } from '../../router';
import { json, methodNotAllowed, readJson } from '../../utils/http';

type WayfinderStatus = 'Active' | 'Draft' | 'Archived';

type WayfinderActivity = {
  id: string;
  title: string;
  type: string;
  description: string;
  link: string;
};

type WayfinderStage = {
  id: string;
  name: string;
  description: string;
  activities: WayfinderActivity[];
};

type WayfinderTemplateRow = {
  id: string;
  tenant_id: string;
  title: string;
  status: string;
  owner: string;
  creator: string;
  description: string | null;
  stages_json: string;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type WayfinderTemplateSummary = {
  id: string;
  title: string;
  status: WayfinderStatus;
  owner: string;
  creator: string;
  description: string | null;
  stageCount: number;
  activityCount: number;
  lastUpdated: string;
};

type WayfinderTemplateDetail = {
  id: string;
  title: string;
  status: WayfinderStatus;
  owner: string;
  creator: string;
  description: string | null;
  stages: WayfinderStage[];
  createdAt: string;
  updatedAt: string;
};

type CreateWayfinderInput = {
  title?: string;
  owner?: string;
  description?: string;
};

type SaveWayfinderInput = {
  title?: string;
  status?: WayfinderStatus;
  owner?: string;
  description?: string | null;
  stages?: WayfinderStage[];
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

function countActivities(stages: WayfinderStage[]) {
  return stages.reduce((total, stage) => total + stage.activities.length, 0);
}

function emptyActivity(index: number): WayfinderActivity {
  return {
    id: crypto.randomUUID(),
    title: `Activity ${index}`,
    type: 'Manual Activity',
    description: 'Describe the work needed to complete this step.',
    link: '',
  };
}

function emptyStage(index: number): WayfinderStage {
  return {
    id: crypto.randomUUID(),
    name: `Stage ${index}`,
    description: 'Describe the outcome of this stage.',
    activities: [emptyActivity(1)],
  };
}

function seedTemplates() {
  return [
    {
      title: 'RMF Authorization Wayfinder',
      status: 'Active' as WayfinderStatus,
      owner: 'Aria Patel',
      creator: 'Regovise',
      description:
        'Stage-driven RMF workflow for categorization, control selection, implementation, assessment, and authorization readiness.',
      stages: [
        {
          id: crypto.randomUUID(),
          name: 'Prepare & Categorize',
          description: 'Confirm boundary, mission context, and categorization decisions before baselining controls.',
          activities: [
            {
              id: crypto.randomUUID(),
              title: 'Confirm boundary and system categorization',
              type: 'Manual Activity',
              description: 'Review the authorization boundary, mission impact, and categorization with stakeholders.',
              link: 'Security Plans / System Information',
            },
            {
              id: crypto.randomUUID(),
              title: 'Document assumptions and inheritance model',
              type: 'Evidence Activity',
              description: 'Capture control inheritance, hosting assumptions, and external dependencies.',
              link: 'Security Plans / Shared Responsibility',
            },
          ],
        },
        {
          id: crypto.randomUUID(),
          name: 'Assess & Authorize',
          description: 'Sequence readiness review, assessor coordination, and decision support for authorization.',
          activities: [
            {
              id: crypto.randomUUID(),
              title: 'Prepare authorization briefing',
              type: 'Approval Activity',
              description: 'Compile the SSP, evidence package, POAM summary, and decision points for authorizing officials.',
              link: 'Dashboard / Executive Briefing',
            },
          ],
        },
      ],
    },
    {
      title: 'FedRAMP Readiness Wayfinder',
      status: 'Active' as WayfinderStatus,
      owner: 'Maya Ellison',
      creator: 'Regovise',
      description:
        'Guided readiness workflow that sequences evidence capture, profiling, and executive review for FedRAMP preparation.',
      stages: [
        {
          id: crypto.randomUUID(),
          name: 'Foundation',
          description: 'Establish baseline scoping, ownership, and evidence sources.',
          activities: [
            {
              id: crypto.randomUUID(),
              title: 'Load security profile',
              type: 'Manual Activity',
              description: 'Apply the baseline profile and confirm the control catalog version for the engagement.',
              link: 'Security Profiles',
            },
            {
              id: crypto.randomUUID(),
              title: 'Assemble core evidence package',
              type: 'Evidence Activity',
              description: 'Gather policies, diagrams, inventories, and system descriptions used by assessment teams.',
              link: 'Evidence Management',
            },
          ],
        },
        {
          id: crypto.randomUUID(),
          name: 'Executive Review',
          description: 'Sequence executive review and readiness exit criteria.',
          activities: [
            {
              id: crypto.randomUUID(),
              title: 'Run readiness checkpoint',
              type: 'Review Activity',
              description: 'Review gaps, owners, and exit criteria before moving into assessment coordination.',
              link: 'Compliance Exports / FedRAMP',
            },
          ],
        },
      ],
    },
    {
      title: 'Internal Audit Preparation Wayfinder',
      status: 'Draft' as WayfinderStatus,
      owner: 'Jon Park',
      creator: 'Regovise',
      description: 'Coordinate control walkthroughs, evidence refresh, and reviewer sign-off ahead of internal audits.',
      stages: [
        {
          id: crypto.randomUUID(),
          name: 'Evidence Refresh',
          description: 'Collect and validate the latest evidence package.',
          activities: [
            {
              id: crypto.randomUUID(),
              title: 'Refresh control evidence',
              type: 'Evidence Activity',
              description: 'Confirm artifacts, screenshots, exports, and owner attestations are current.',
              link: 'Evidence Management',
            },
          ],
        },
      ],
    },
    {
      title: 'Annual Security Review Wayfinder',
      status: 'Draft' as WayfinderStatus,
      owner: 'Priya Ramesh',
      creator: 'Regovise',
      description: 'Annual review sequence for policy, inventory, and exception lifecycle refresh.',
      stages: [
        {
          id: crypto.randomUUID(),
          name: 'Policy & Inventory',
          description: 'Review policy revisions and inventory coverage first.',
          activities: [
            {
              id: crypto.randomUUID(),
              title: 'Review annual policy deltas',
              type: 'Manual Activity',
              description: 'Confirm policy revisions, ownership, and review dates are current.',
              link: 'Policies',
            },
          ],
        },
      ],
    },
  ];
}

async function ensureSeedTemplates(env: WorkerRequestContext['env'], tenantId: string, userId: string | null) {
  const row = await env.D1_MAIN.prepare(`SELECT COUNT(1) AS template_count FROM wayfinder_templates WHERE tenant_id = ?`)
    .bind(tenantId)
    .first<{ template_count: number | null }>();
  if (Number(row?.template_count ?? 0) > 0) {
    return;
  }
  const createdAt = nowIso();
  const statements = seedTemplates().map((template) =>
    env.D1_MAIN.prepare(
      `INSERT INTO wayfinder_templates (
        id, tenant_id, title, status, owner, creator, description, stages_json,
        created_by_user_id, updated_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      tenantId,
      template.title,
      template.status,
      template.owner,
      template.creator,
      template.description,
      JSON.stringify(template.stages),
      userId,
      userId,
      createdAt,
      createdAt,
    ),
  );
  await env.D1_MAIN.batch(statements);
}

function toSummary(row: WayfinderTemplateRow): WayfinderTemplateSummary {
  const stages = asJson<WayfinderStage[]>(row.stages_json, []);
  return {
    id: row.id,
    title: row.title,
    status: row.status as WayfinderStatus,
    owner: row.owner,
    creator: row.creator,
    description: row.description,
    stageCount: stages.length,
    activityCount: countActivities(stages),
    lastUpdated: row.updated_at,
  };
}

function toDetail(row: WayfinderTemplateRow): WayfinderTemplateDetail {
  return {
    id: row.id,
    title: row.title,
    status: row.status as WayfinderStatus,
    owner: row.owner,
    creator: row.creator,
    description: row.description,
    stages: asJson<WayfinderStage[]>(row.stages_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getTemplateRow(
  env: WorkerRequestContext['env'],
  tenantId: string,
  templateId: string,
): Promise<WayfinderTemplateRow | null> {
  return env.D1_MAIN.prepare(`SELECT * FROM wayfinder_templates WHERE tenant_id = ? AND id = ? LIMIT 1`)
    .bind(tenantId, templateId)
    .first<WayfinderTemplateRow>();
}

export async function handleWayfinderBuilderRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const tenantIdOrResponse = requireTenant(ctx);
  if (tenantIdOrResponse instanceof Response) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;

  await ensureSeedTemplates(ctx.env, tenantId, ctx.userId);

  const [resource, id, action] = segments;
  if (resource !== 'wayfinders') {
    return json({ error: 'unknown_builder_resource', resource }, { status: 404 });
  }

  if (!id) {
    if (ctx.request.method === 'GET') {
      const rows = await ctx.env.D1_MAIN.prepare(
        `SELECT * FROM wayfinder_templates WHERE tenant_id = ? ORDER BY updated_at DESC, title ASC`,
      )
        .bind(tenantId)
        .all<WayfinderTemplateRow>();
      return json({ data: { templates: rows.results.map(toSummary) } });
    }

    if (ctx.request.method === 'POST') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }
      const body = await readJson<CreateWayfinderInput>(ctx.request);
      const createdAt = nowIso();
      const templateId = crypto.randomUUID();
      const title = body.title?.trim() || 'New Wayfinder Template';
      const owner = body.owner?.trim() || 'Regovise Operator';
      await ctx.env.D1_MAIN.prepare(
        `INSERT INTO wayfinder_templates (
          id, tenant_id, title, status, owner, creator, description, stages_json,
          created_by_user_id, updated_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          templateId,
          tenantId,
          title,
          'Draft',
          owner,
          owner,
          body.description?.trim() || 'Custom canonical Wayfinder template.',
          JSON.stringify([emptyStage(1)]),
          userIdOrResponse,
          userIdOrResponse,
          createdAt,
          createdAt,
        )
        .run();
      const row = await getTemplateRow(ctx.env, tenantId, templateId);
      return row ? json({ data: toDetail(row) }, { status: 201 }) : json({ error: 'create_failed' }, { status: 500 });
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (!action) {
    if (ctx.request.method === 'GET') {
      const row = await getTemplateRow(ctx.env, tenantId, id);
      return row ? json({ data: toDetail(row) }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'PUT') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }
      const current = await getTemplateRow(ctx.env, tenantId, id);
      if (!current) {
        return json({ error: 'not_found', message: 'Wayfinder template not found.' }, { status: 404 });
      }
      const body = await readJson<SaveWayfinderInput>(ctx.request);
      await ctx.env.D1_MAIN.prepare(
        `UPDATE wayfinder_templates
            SET title = ?, status = ?, owner = ?, description = ?, stages_json = ?,
                updated_by_user_id = ?, updated_at = ?
          WHERE tenant_id = ? AND id = ?`,
      )
        .bind(
          body.title?.trim() || current.title,
          body.status || current.status,
          body.owner?.trim() || current.owner,
          body.description ?? current.description,
          JSON.stringify(body.stages ?? asJson<WayfinderStage[]>(current.stages_json, [])),
          userIdOrResponse,
          nowIso(),
          tenantId,
          id,
        )
        .run();
      const updated = await getTemplateRow(ctx.env, tenantId, id);
      return updated ? json({ data: toDetail(updated) }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'DELETE') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }
      await ctx.env.D1_MAIN.prepare(`DELETE FROM wayfinder_templates WHERE tenant_id = ? AND id = ?`)
        .bind(tenantId, id)
        .run();
      return json({ data: { deleted: true } });
    }

    return methodNotAllowed(['GET', 'PUT', 'DELETE']);
  }

  if (action === 'import') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }
    const userIdOrResponse = requireUser(ctx);
    if (userIdOrResponse instanceof Response) {
      return userIdOrResponse;
    }
    const current = await getTemplateRow(ctx.env, tenantId, id);
    if (!current) {
      return json({ error: 'not_found' }, { status: 404 });
    }
    const body = await readJson<SaveWayfinderInput>(ctx.request);
    const stages = body.stages ?? [];
    if (stages.length === 0) {
      return json(
        { error: 'invalid_import', message: 'Imported template must include at least one stage.' },
        { status: 400 },
      );
    }
    await ctx.env.D1_MAIN.prepare(
      `UPDATE wayfinder_templates
          SET title = ?, status = ?, owner = ?, description = ?, stages_json = ?,
              updated_by_user_id = ?, updated_at = ?
        WHERE tenant_id = ? AND id = ?`,
    )
      .bind(
        body.title?.trim() || current.title,
        body.status || current.status,
        body.owner?.trim() || current.owner,
        body.description ?? current.description,
        JSON.stringify(stages),
        userIdOrResponse,
        nowIso(),
        tenantId,
        id,
      )
      .run();
    const updated = await getTemplateRow(ctx.env, tenantId, id);
    return updated ? json({ data: toDetail(updated) }) : json({ error: 'not_found' }, { status: 404 });
  }

  return json({ error: 'unknown_builder_action', action }, { status: 404 });
}
