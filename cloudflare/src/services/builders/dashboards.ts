import type { WorkerRequestContext } from '../../router';
import { json, methodNotAllowed, readJson } from '../../utils/http';
import { MODULE_CATALOG } from '../core/moduleRegistry';

type DashboardAccess = 'Public' | 'Private';
type DashboardItemType = 'Widget' | 'Report';
type PaletteTab = 'Widgets' | 'Reports' | 'By Module';

type DashboardTemplateItem = {
  templateId: string;
  title: string;
  type: DashboardItemType;
  tab: PaletteTab;
  description: string;
  sourceLabel: string;
  defaultColumn: 'left' | 'right';
};

type DashboardLayoutItem = DashboardTemplateItem & {
  instanceId: string;
  column: 'left' | 'right';
};

type DashboardRow = {
  id: string;
  tenant_id: string;
  title: string;
  access_level: string;
  group_assignments: string;
  favorite: number;
  published: number;
  items_json: string;
  layout_json: string;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type DashboardSummary = {
  id: string;
  title: string;
  access: DashboardAccess;
  groups: string[];
  favorite: boolean;
  published: boolean;
  lastUpdated: string;
  itemCount: number;
};

type DashboardDetail = {
  id: string;
  title: string;
  access: DashboardAccess;
  groups: string[];
  favorite: boolean;
  published: boolean;
  items: DashboardLayoutItem[];
  layout: {
    left: string[];
    right: string[];
  };
  availableItems: DashboardTemplateItem[];
  createdAt: string;
  updatedAt: string;
};

type CreateDashboardInput = {
  title?: string;
  access?: DashboardAccess;
  groups?: string[];
};

type SaveDashboardInput = {
  title?: string;
  access?: DashboardAccess;
  groups?: string[];
  items?: DashboardLayoutItem[];
  layout?: { left: string[]; right: string[] };
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

const widgetTemplates: DashboardTemplateItem[] = [
  { templateId: 'tpl-kpi-summary', title: 'KPI Summary', type: 'Widget', tab: 'Widgets', description: 'Executive scorecard for key compliance and remediation metrics.', sourceLabel: 'Executive Widget', defaultColumn: 'left' },
  { templateId: 'tpl-compliance-status', title: 'Compliance Status', type: 'Widget', tab: 'Widgets', description: 'Pass / partial / fail posture across active frameworks.', sourceLabel: 'Controls Widget', defaultColumn: 'left' },
  { templateId: 'tpl-risk-heatmap', title: 'Risk Heat Map', type: 'Widget', tab: 'Widgets', description: 'Residual risk by likelihood and impact.', sourceLabel: 'Risk Widget', defaultColumn: 'right' },
  { templateId: 'tpl-recent-issues', title: 'Recent Issues Table', type: 'Widget', tab: 'Widgets', description: 'Escalated POAMs, overdue issues, and fresh findings.', sourceLabel: 'Issue Widget', defaultColumn: 'right' },
  { templateId: 'tpl-upcoming-tasks', title: 'Upcoming Tasks', type: 'Widget', tab: 'Widgets', description: 'Due dates and accountable work pulled into one queue.', sourceLabel: 'Task Widget', defaultColumn: 'left' },
  { templateId: 'tpl-module-security-plans', title: 'Security Plans by Program', type: 'Widget', tab: 'By Module', description: 'Module-level rollup for plans and lifecycle progress.', sourceLabel: 'Security Plans Module', defaultColumn: 'left' },
];

const generatedModuleTemplates: DashboardTemplateItem[] = MODULE_CATALOG.filter(
  (entry) => entry.implementationType !== 'subfeature',
)
  .map((entry) => ({
    templateId: `tpl-module-${entry.moduleKey}`,
    title: `${entry.pluralName} Overview`,
    type: 'Widget' as const,
    tab: 'By Module' as const,
    description: `Tenant rollup for ${entry.pluralName.toLowerCase()} using the shared module registry and related workspaces.`,
    sourceLabel: `${entry.pluralName} Module`,
    defaultColumn: 'left' as const,
  }))
  .filter((template) => !widgetTemplates.some((existing) => existing.templateId === template.templateId));

const allWidgetTemplates = [...widgetTemplates, ...generatedModuleTemplates];

async function reportTemplates(env: WorkerRequestContext['env'], tenantId: string): Promise<DashboardTemplateItem[]> {
  const rows = await env.D1_MAIN.prepare(
    `SELECT id, title FROM report_builder_reports WHERE tenant_id = ? ORDER BY updated_at DESC, title ASC LIMIT 20`,
  )
    .bind(tenantId)
    .all<{ id: string; title: string }>();
  return rows.results.map((row) => ({
    templateId: `report:${row.id}`,
    title: row.title,
    type: 'Report' as const,
    tab: 'Reports' as const,
    description: 'Embedded output from Report Builder with drill-in filtering.',
    sourceLabel: 'Report Builder',
    defaultColumn: 'right' as const,
  }));
}

function seedDashboards() {
  return [
    {
      title: 'Security Operations Overview',
      access: 'Public' as DashboardAccess,
      groups: [],
      favorite: true,
      published: true,
      items: [
        { ...widgetTemplates[0], instanceId: crypto.randomUUID(), column: 'left' as const },
        { ...widgetTemplates[2], instanceId: crypto.randomUUID(), column: 'right' as const },
        { ...widgetTemplates[3], instanceId: crypto.randomUUID(), column: 'right' as const },
      ],
    },
    {
      title: 'Audit Readiness Board',
      access: 'Private' as DashboardAccess,
      groups: ['Audit Team'],
      favorite: false,
      published: false,
      items: [
        { ...widgetTemplates[1], instanceId: crypto.randomUUID(), column: 'left' as const },
        { ...widgetTemplates[4], instanceId: crypto.randomUUID(), column: 'right' as const },
      ],
    },
  ];
}

async function ensureSeedDashboards(env: WorkerRequestContext['env'], tenantId: string, userId: string | null) {
  const row = await env.D1_MAIN.prepare(`SELECT COUNT(1) AS dashboard_count FROM dashboard_builder_dashboards WHERE tenant_id = ?`)
    .bind(tenantId)
    .first<{ dashboard_count: number | null }>();
  if (Number(row?.dashboard_count ?? 0) > 0) {
    return;
  }
  const createdAt = nowIso();
  const statements = seedDashboards().map((dashboard) =>
    env.D1_MAIN.prepare(
      `INSERT INTO dashboard_builder_dashboards (
        id, tenant_id, title, access_level, group_assignments, favorite, published, items_json, layout_json,
        created_by_user_id, updated_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      tenantId,
      dashboard.title,
      dashboard.access,
      JSON.stringify(dashboard.groups),
      dashboard.favorite ? 1 : 0,
      dashboard.published ? 1 : 0,
      JSON.stringify(dashboard.items),
      JSON.stringify({
        left: dashboard.items.filter((item) => item.column === 'left').map((item) => item.instanceId),
        right: dashboard.items.filter((item) => item.column === 'right').map((item) => item.instanceId),
      }),
      userId,
      userId,
      createdAt,
      createdAt,
    ),
  );
  await env.D1_MAIN.batch(statements);
}

function toSummary(row: DashboardRow): DashboardSummary {
  const items = asJson<DashboardLayoutItem[]>(row.items_json, []);
  return {
    id: row.id,
    title: row.title,
    access: row.access_level as DashboardAccess,
    groups: asJson<string[]>(row.group_assignments, []),
    favorite: Boolean(row.favorite),
    published: Boolean(row.published),
    lastUpdated: row.updated_at,
    itemCount: items.length,
  };
}

async function getDashboardRow(env: WorkerRequestContext['env'], tenantId: string, dashboardId: string): Promise<DashboardRow | null> {
  return env.D1_MAIN.prepare(`SELECT * FROM dashboard_builder_dashboards WHERE tenant_id = ? AND id = ? LIMIT 1`)
    .bind(tenantId, dashboardId)
    .first<DashboardRow>();
}

async function toDetail(env: WorkerRequestContext['env'], tenantId: string, row: DashboardRow): Promise<DashboardDetail> {
  return {
    id: row.id,
    title: row.title,
    access: row.access_level as DashboardAccess,
    groups: asJson<string[]>(row.group_assignments, []),
    favorite: Boolean(row.favorite),
    published: Boolean(row.published),
    items: asJson<DashboardLayoutItem[]>(row.items_json, []),
    layout: asJson<{ left: string[]; right: string[] }>(row.layout_json, { left: [], right: [] }),
    availableItems: [...allWidgetTemplates, ...(await reportTemplates(env, tenantId))],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function handleDashboardBuilderRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const tenantIdOrResponse = requireTenant(ctx);
  if (tenantIdOrResponse instanceof Response) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;
  await ensureSeedDashboards(ctx.env, tenantId, ctx.userId);

  const [resource, id, action] = segments;
  if (resource !== 'dashboards') {
    return json({ error: 'unknown_builder_resource', resource }, { status: 404 });
  }

  if (!id) {
    if (ctx.request.method === 'GET') {
      const rows = await ctx.env.D1_MAIN.prepare(
        `SELECT * FROM dashboard_builder_dashboards WHERE tenant_id = ? ORDER BY favorite DESC, updated_at DESC, title ASC`,
      )
        .bind(tenantId)
        .all<DashboardRow>();
      return json({ data: { dashboards: rows.results.map(toSummary), availableItems: [...allWidgetTemplates, ...(await reportTemplates(ctx.env, tenantId))] } });
    }

    if (ctx.request.method === 'POST') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }
      const body = await readJson<CreateDashboardInput>(ctx.request);
      const createdAt = nowIso();
      const dashboardId = crypto.randomUUID();
      await ctx.env.D1_MAIN.prepare(
        `INSERT INTO dashboard_builder_dashboards (
          id, tenant_id, title, access_level, group_assignments, favorite, published, items_json, layout_json,
          created_by_user_id, updated_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          dashboardId,
          tenantId,
          body.title?.trim() || 'New Dashboard',
          body.access || 'Public',
          JSON.stringify(body.groups ?? []),
          0,
          0,
          JSON.stringify([]),
          JSON.stringify({ left: [], right: [] }),
          userIdOrResponse,
          userIdOrResponse,
          createdAt,
          createdAt,
        )
        .run();
      const row = await getDashboardRow(ctx.env, tenantId, dashboardId);
      return row ? json({ data: await toDetail(ctx.env, tenantId, row) }, { status: 201 }) : json({ error: 'create_failed' }, { status: 500 });
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (!action) {
    if (ctx.request.method === 'GET') {
      const row = await getDashboardRow(ctx.env, tenantId, id);
      return row ? json({ data: await toDetail(ctx.env, tenantId, row) }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'PUT') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }
      const current = await getDashboardRow(ctx.env, tenantId, id);
      if (!current) {
        return json({ error: 'not_found', message: 'Dashboard Builder layout not found.' }, { status: 404 });
      }
      const body = await readJson<SaveDashboardInput>(ctx.request);
      await ctx.env.D1_MAIN.prepare(
        `UPDATE dashboard_builder_dashboards
            SET title = ?, access_level = ?, group_assignments = ?, items_json = ?, layout_json = ?,
                updated_by_user_id = ?, updated_at = ?
          WHERE tenant_id = ? AND id = ?`,
      )
        .bind(
          body.title?.trim() || current.title,
          body.access || current.access_level,
          JSON.stringify(body.groups ?? asJson<string[]>(current.group_assignments, [])),
          JSON.stringify(body.items ?? asJson<DashboardLayoutItem[]>(current.items_json, [])),
          JSON.stringify(body.layout ?? asJson<{ left: string[]; right: string[] }>(current.layout_json, { left: [], right: [] })),
          userIdOrResponse,
          nowIso(),
          tenantId,
          id,
        )
        .run();
      const updated = await getDashboardRow(ctx.env, tenantId, id);
      return updated ? json({ data: await toDetail(ctx.env, tenantId, updated) }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'DELETE') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }
      await ctx.env.D1_MAIN.prepare(`DELETE FROM dashboard_builder_dashboards WHERE tenant_id = ? AND id = ?`)
        .bind(tenantId, id)
        .run();
      return json({ data: { deleted: true } });
    }

    return methodNotAllowed(['GET', 'PUT', 'DELETE']);
  }

  if (action === 'favorite') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }
    const current = await getDashboardRow(ctx.env, tenantId, id);
    if (!current) {
      return json({ error: 'not_found' }, { status: 404 });
    }
    await ctx.env.D1_MAIN.prepare(
      `UPDATE dashboard_builder_dashboards SET favorite = ?, updated_at = ? WHERE tenant_id = ? AND id = ?`,
    )
      .bind(current.favorite ? 0 : 1, nowIso(), tenantId, id)
      .run();
    const updated = await getDashboardRow(ctx.env, tenantId, id);
    return updated ? json({ data: await toDetail(ctx.env, tenantId, updated) }) : json({ error: 'not_found' }, { status: 404 });
  }

  if (action === 'publish') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }
    await ctx.env.D1_MAIN.prepare(
      `UPDATE dashboard_builder_dashboards SET published = 1, updated_at = ? WHERE tenant_id = ? AND id = ?`,
    )
      .bind(nowIso(), tenantId, id)
      .run();
    const updated = await getDashboardRow(ctx.env, tenantId, id);
    return updated ? json({ data: await toDetail(ctx.env, tenantId, updated) }) : json({ error: 'not_found' }, { status: 404 });
  }

  return json({ error: 'unknown_builder_action', action }, { status: 404 });
}
