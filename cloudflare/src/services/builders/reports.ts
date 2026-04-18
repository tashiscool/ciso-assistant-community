import type { WorkerRequestContext } from '../../router';
import { json, methodNotAllowed, readJson } from '../../utils/http';

type ReportChartType = 'List' | 'Bar' | 'Line' | 'Pie';
type ReportStatus = 'Active' | 'Draft';
type RecurrenceType = 'Daily' | 'Weekly' | 'Monthly';

type FilterRow = {
  id: string;
  field: string;
  operator: string;
  value: string;
};

type ReportConfig = {
  reportTitle: string;
  chartType: ReportChartType;
  module: string;
  groupBy: string;
  aggregateField: string;
  aggregationType: 'Count' | 'Sum' | 'Average';
  selectedFields: string[];
  displayFields: string[];
  drillDownFields: string[];
  sortingFields: string[];
  filterLogic: string;
  filters: FilterRow[];
};

type ReportBuilderRow = {
  id: string;
  tenant_id: string;
  title: string;
  chart_type: string;
  module_name: string;
  owner: string;
  status: string;
  source: string;
  description: string | null;
  config_json: string;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type ReportSubscriptionRow = {
  id: string;
  recipient_email: string;
  recipient_type: string;
  start_date: string;
  recurrence_type: string;
  last_sent_at: string | null;
  created_at: string;
};

type ReportBuilderSummary = {
  id: string;
  title: string;
  chartType: ReportChartType;
  module: string;
  owner: string;
  status: ReportStatus;
  source: 'Report Builder';
  description: string | null;
  lastUpdated: string;
};

type ReportSubscription = {
  id: string;
  recipientEmail: string;
  recipientType: string;
  startDate: string;
  recurrenceType: RecurrenceType;
  lastSentAt: string | null;
  createdAt: string;
};

type ReportBuilderDetail = {
  id: string;
  title: string;
  chartType: ReportChartType;
  module: string;
  owner: string;
  status: ReportStatus;
  source: 'Report Builder';
  description: string | null;
  config: ReportConfig;
  subscriptions: ReportSubscription[];
  createdAt: string;
  updatedAt: string;
};

type CreateReportInput = {
  title?: string;
  owner?: string;
};

type SaveReportInput = {
  title?: string;
  chartType?: ReportChartType;
  module?: string;
  owner?: string;
  status?: ReportStatus;
  description?: string | null;
  config?: ReportConfig;
};

type SubscriptionInput = {
  recipientEmail?: string;
  recipientType?: string;
  startDate?: string;
  recurrenceType?: RecurrenceType;
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

const modules = ['Security Plans', 'Risks', 'Issues', 'Evidence', 'Assessments'];
const displayFields = ['Title', 'Status', 'Owner', 'Last Updated', 'Due Date', 'Severity', 'Program', 'Framework'];

function defaultConfig(title = 'Quarterly Control Status Rollup'): ReportConfig {
  return {
    reportTitle: title,
    chartType: 'List',
    module: 'Security Plans',
    groupBy: 'Program',
    aggregateField: 'Control Count',
    aggregationType: 'Count',
    selectedFields: ['Title', 'Status', 'Owner', 'Last Updated'],
    displayFields: ['Title', 'Status', 'Owner', 'Last Updated'],
    drillDownFields: ['Framework'],
    sortingFields: ['Last Updated'],
    filterLogic: '1 AND (2 OR 3)',
    filters: [
      { id: crypto.randomUUID(), field: 'Status', operator: 'Equals', value: 'Open' },
      { id: crypto.randomUUID(), field: 'Due Date', operator: 'Within Last', value: '30 days' },
      { id: crypto.randomUUID(), field: 'Owner', operator: 'Equals', value: 'Current User' },
    ],
  };
}

function seedReports() {
  return [
    {
      title: 'Open POAM Aging Review',
      chartType: 'List' as ReportChartType,
      module: 'Issues',
      owner: 'Maya Ellison',
      status: 'Active' as ReportStatus,
      description: 'Operational report showing remediation aging, ownership, and status.',
      config: {
        ...defaultConfig('Open POAM Aging Review'),
        module: 'Issues',
        selectedFields: ['Title', 'Severity', 'Owner', 'Due Date', 'Status'],
        displayFields: ['Title', 'Severity', 'Owner', 'Due Date', 'Status'],
      },
    },
    {
      title: 'Residual Risk Heatmap',
      chartType: 'Bar' as ReportChartType,
      module: 'Risks',
      owner: 'Jon Park',
      status: 'Draft' as ReportStatus,
      description: 'Grouped residual risk posture by program and severity.',
      config: {
        ...defaultConfig('Residual Risk Heatmap'),
        chartType: 'Bar',
        module: 'Risks',
        groupBy: 'Program',
        aggregateField: 'Residual Risk',
        aggregationType: 'Average',
      },
    },
    {
      title: 'Control Coverage Summary',
      chartType: 'Pie' as ReportChartType,
      module: 'Security Plans',
      owner: 'Priya Ramesh',
      status: 'Active' as ReportStatus,
      description: 'Coverage summary of mapped controls, evidence, and review activity.',
      config: {
        ...defaultConfig('Control Coverage Summary'),
        chartType: 'Pie',
        aggregateField: 'Control Count',
        aggregationType: 'Count',
      },
    },
  ];
}

function seedSubscriptions(reportId: string): Array<Omit<ReportSubscriptionRow, 'id'>> {
  return [
    {
      recipient_email: 'security-ops@regovise.com',
      recipient_type: 'user',
      start_date: '2026-04-18',
      recurrence_type: 'Weekly',
      last_sent_at: '2026-04-11T09:15:00.000Z',
      created_at: nowIso(),
    },
    {
      recipient_email: 'audit@regovise.com',
      recipient_type: 'group',
      start_date: '2026-04-19',
      recurrence_type: 'Monthly',
      last_sent_at: '2026-04-03T06:42:00.000Z',
      created_at: nowIso(),
    },
  ];
}

async function ensureSeedReports(env: WorkerRequestContext['env'], tenantId: string, userId: string | null) {
  const row = await env.D1_MAIN.prepare(`SELECT COUNT(1) AS report_count FROM report_builder_reports WHERE tenant_id = ?`)
    .bind(tenantId)
    .first<{ report_count: number | null }>();
  if (Number(row?.report_count ?? 0) > 0) {
    return;
  }
  const createdAt = nowIso();
  const reportStatements = seedReports().map((report) => {
    const reportId = crypto.randomUUID();
    return {
      reportId,
      statement: env.D1_MAIN.prepare(
        `INSERT INTO report_builder_reports (
          id, tenant_id, title, chart_type, module_name, owner, status, source, description, config_json,
          created_by_user_id, updated_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        reportId,
        tenantId,
        report.title,
        report.chartType,
        report.module,
        report.owner,
        report.status,
        'Report Builder',
        report.description,
        JSON.stringify(report.config),
        userId,
        userId,
        createdAt,
        createdAt,
      ),
    };
  });

  await env.D1_MAIN.batch(reportStatements.map((item) => item.statement));

  const subscriptionStatements = reportStatements.flatMap((item) =>
    seedSubscriptions(item.reportId).map((subscription) =>
      env.D1_MAIN.prepare(
        `INSERT INTO report_builder_subscriptions (
          id, tenant_id, report_id, recipient_email, recipient_type, start_date, recurrence_type, last_sent_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        tenantId,
        item.reportId,
        subscription.recipient_email,
        subscription.recipient_type,
        subscription.start_date,
        subscription.recurrence_type,
        subscription.last_sent_at,
        subscription.created_at,
      ),
    ),
  );

  await env.D1_MAIN.batch(subscriptionStatements);
}

function toSummary(row: ReportBuilderRow): ReportBuilderSummary {
  return {
    id: row.id,
    title: row.title,
    chartType: row.chart_type as ReportChartType,
    module: row.module_name,
    owner: row.owner,
    status: row.status as ReportStatus,
    source: 'Report Builder',
    description: row.description,
    lastUpdated: row.updated_at,
  };
}

function previewForConfig(config: ReportConfig) {
  if (config.chartType === 'List') {
    return {
      kind: 'table' as const,
      columns: config.displayFields.length > 0 ? config.displayFields : config.selectedFields,
      rows: [
        ['Open POAM 2026-04', 'Open', 'Maya Ellison', '2026-04-11', 'High'],
        ['Control Gap Follow-up', 'In Progress', 'Jon Park', '2026-04-10', 'Moderate'],
        ['Assessment Packet Review', 'Open', 'Priya Ramesh', '2026-04-09', 'Low'],
      ],
    };
  }
  return {
    kind: 'series' as const,
    labels: ['Program A', 'Program B', 'Program C'],
    values:
      config.chartType === 'Pie'
        ? [42, 31, 27]
        : config.aggregationType === 'Average'
          ? [72, 58, 63]
          : [14, 22, 18],
  };
}

async function getSubscriptions(
  env: WorkerRequestContext['env'],
  tenantId: string,
  reportId: string,
): Promise<ReportSubscription[]> {
  const rows = await env.D1_MAIN.prepare(
    `SELECT id, recipient_email, recipient_type, start_date, recurrence_type, last_sent_at, created_at
       FROM report_builder_subscriptions
      WHERE tenant_id = ? AND report_id = ?
      ORDER BY created_at DESC`,
  )
    .bind(tenantId, reportId)
    .all<ReportSubscriptionRow>();
  return rows.results.map((row) => ({
    id: row.id,
    recipientEmail: row.recipient_email,
    recipientType: row.recipient_type,
    startDate: row.start_date,
    recurrenceType: row.recurrence_type as RecurrenceType,
    lastSentAt: row.last_sent_at,
    createdAt: row.created_at,
  }));
}

async function getReportRow(
  env: WorkerRequestContext['env'],
  tenantId: string,
  reportId: string,
): Promise<ReportBuilderRow | null> {
  return env.D1_MAIN.prepare(`SELECT * FROM report_builder_reports WHERE tenant_id = ? AND id = ? LIMIT 1`)
    .bind(tenantId, reportId)
    .first<ReportBuilderRow>();
}

async function toDetail(
  env: WorkerRequestContext['env'],
  tenantId: string,
  row: ReportBuilderRow,
): Promise<ReportBuilderDetail> {
  return {
    id: row.id,
    title: row.title,
    chartType: row.chart_type as ReportChartType,
    module: row.module_name,
    owner: row.owner,
    status: row.status as ReportStatus,
    source: 'Report Builder',
    description: row.description,
    config: asJson<ReportConfig>(row.config_json, defaultConfig(row.title)),
    subscriptions: await getSubscriptions(env, tenantId, row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function handleReportBuilderRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const tenantIdOrResponse = requireTenant(ctx);
  if (tenantIdOrResponse instanceof Response) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;

  await ensureSeedReports(ctx.env, tenantId, ctx.userId);

  const [resource, id, action, subId] = segments;
  if (resource !== 'reports') {
    return json({ error: 'unknown_builder_resource', resource }, { status: 404 });
  }

  if (!id) {
    if (ctx.request.method === 'GET') {
      const rows = await ctx.env.D1_MAIN.prepare(
        `SELECT * FROM report_builder_reports WHERE tenant_id = ? ORDER BY updated_at DESC, title ASC`,
      )
        .bind(tenantId)
        .all<ReportBuilderRow>();
      return json({ data: { reports: rows.results.map(toSummary), modules, displayFields } });
    }

    if (ctx.request.method === 'POST') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }
      const body = await readJson<CreateReportInput>(ctx.request);
      const createdAt = nowIso();
      const reportId = crypto.randomUUID();
      const title = body.title?.trim() || 'New Report';
      const owner = body.owner?.trim() || 'Regovise Operator';
      const config = defaultConfig(title);
      await ctx.env.D1_MAIN.prepare(
        `INSERT INTO report_builder_reports (
          id, tenant_id, title, chart_type, module_name, owner, status, source, description, config_json,
          created_by_user_id, updated_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          reportId,
          tenantId,
          title,
          config.chartType,
          config.module,
          owner,
          'Draft',
          'Report Builder',
          'Custom canonical report definition.',
          JSON.stringify(config),
          userIdOrResponse,
          userIdOrResponse,
          createdAt,
          createdAt,
        )
        .run();
      const row = await getReportRow(ctx.env, tenantId, reportId);
      return row ? json({ data: await toDetail(ctx.env, tenantId, row) }, { status: 201 }) : json({ error: 'create_failed' }, { status: 500 });
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (!action) {
    if (ctx.request.method === 'GET') {
      const row = await getReportRow(ctx.env, tenantId, id);
      return row ? json({ data: await toDetail(ctx.env, tenantId, row) }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'PUT') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }
      const current = await getReportRow(ctx.env, tenantId, id);
      if (!current) {
        return json({ error: 'not_found', message: 'Report Builder definition not found.' }, { status: 404 });
      }
      const body = await readJson<SaveReportInput>(ctx.request);
      const config = body.config ?? asJson<ReportConfig>(current.config_json, defaultConfig(current.title));
      await ctx.env.D1_MAIN.prepare(
        `UPDATE report_builder_reports
            SET title = ?, chart_type = ?, module_name = ?, owner = ?, status = ?, description = ?, config_json = ?,
                updated_by_user_id = ?, updated_at = ?
          WHERE tenant_id = ? AND id = ?`,
      )
        .bind(
          body.title?.trim() || current.title,
          body.chartType || current.chart_type,
          body.module || current.module_name,
          body.owner?.trim() || current.owner,
          body.status || current.status,
          body.description ?? current.description,
          JSON.stringify(config),
          userIdOrResponse,
          nowIso(),
          tenantId,
          id,
        )
        .run();
      const updated = await getReportRow(ctx.env, tenantId, id);
      return updated ? json({ data: await toDetail(ctx.env, tenantId, updated) }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'DELETE') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }
      await ctx.env.D1_MAIN.prepare(`DELETE FROM report_builder_subscriptions WHERE tenant_id = ? AND report_id = ?`)
        .bind(tenantId, id)
        .run();
      await ctx.env.D1_MAIN.prepare(`DELETE FROM report_builder_reports WHERE tenant_id = ? AND id = ?`)
        .bind(tenantId, id)
        .run();
      return json({ data: { deleted: true } });
    }

    return methodNotAllowed(['GET', 'PUT', 'DELETE']);
  }

  if (action === 'preview') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }
    const current = await getReportRow(ctx.env, tenantId, id);
    if (!current) {
      return json({ error: 'not_found' }, { status: 404 });
    }
    const body = await readJson<SaveReportInput>(ctx.request);
    const config = body.config ?? asJson<ReportConfig>(current.config_json, defaultConfig(current.title));
    return json({ data: { preview: previewForConfig(config) } });
  }

  if (action === 'share') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }
    const body = await readJson<{ recipients?: string[] | string }>(ctx.request);
    const recipients = Array.isArray(body.recipients)
      ? body.recipients
      : typeof body.recipients === 'string'
        ? body.recipients.split(',').map((value) => value.trim()).filter(Boolean)
        : [];
    return json({ data: { shared: true, recipients, sharedAt: nowIso() } });
  }

  if (action === 'export') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }
    const current = await getReportRow(ctx.env, tenantId, id);
    if (!current) {
      return json({ error: 'not_found' }, { status: 404 });
    }
    return json({
      data: {
        exported: true,
        format: 'csv',
        artifactName: `${current.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`,
      },
    });
  }

  if (action === 'subscriptions') {
    if (!subId) {
      if (ctx.request.method !== 'POST') {
        return methodNotAllowed(['POST']);
      }
      const body = await readJson<SubscriptionInput>(ctx.request);
      const subscriptionId = crypto.randomUUID();
      await ctx.env.D1_MAIN.prepare(
        `INSERT INTO report_builder_subscriptions (
          id, tenant_id, report_id, recipient_email, recipient_type, start_date, recurrence_type, last_sent_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          subscriptionId,
          tenantId,
          id,
          body.recipientEmail?.trim() || 'recipient@regovise.com',
          body.recipientType?.trim() || 'user',
          body.startDate?.trim() || '2026-04-18',
          body.recurrenceType || 'Weekly',
          null,
          nowIso(),
        )
        .run();
      return json({ data: { id: subscriptionId, created: true } }, { status: 201 });
    }

    if (ctx.request.method !== 'DELETE') {
      return methodNotAllowed(['DELETE']);
    }
    await ctx.env.D1_MAIN.prepare(`DELETE FROM report_builder_subscriptions WHERE tenant_id = ? AND report_id = ? AND id = ?`)
      .bind(tenantId, id, subId)
      .run();
    return json({ data: { deleted: true } });
  }

  return json({ error: 'unknown_builder_action', action }, { status: 404 });
}
