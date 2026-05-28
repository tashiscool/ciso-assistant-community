import type { WorkerRequestContext } from '../../router';
import { json, methodNotAllowed, readJson } from '../../utils/http';
import { MODULE_CATALOG, type ModuleCatalogEntry } from '../core/moduleRegistry';

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

type ReportPreview =
  | {
      kind: 'table';
      columns: string[];
      rows: string[][];
      recordCount: number;
      filterExpressionValid: boolean;
    }
  | {
      kind: 'series';
      labels: string[];
      values: number[];
      recordCount: number;
      filterExpressionValid: boolean;
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

type ModuleRecordRow = {
  id: string;
  tenant_id: string;
  module_key: string;
  folder_id: string;
  title: string;
  status: string;
  owner_user_id: string | null;
  assignee_user_id: string | null;
  start_on: string | null;
  finish_on: string | null;
  due_on: string | null;
  review_on: string | null;
  expires_on: string | null;
  data_json: string;
  links_json: string;
  activity_json: string;
  archived: number;
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
  chartType?: ReportChartType;
  module?: string;
  status?: ReportStatus;
  description?: string | null;
  config?: ReportConfig;
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function cleanString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeIdentifier(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function slug(value: string) {
  const next = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return next || 'report-builder-export';
}

function normalizeReportChartType(value: unknown): ReportChartType {
  return value === 'Bar' || value === 'Line' || value === 'Pie' || value === 'List' ? value : 'List';
}

function normalizeReportStatus(value: unknown): ReportStatus {
  return value === 'Active' || value === 'Draft' ? value : 'Draft';
}

function normalizeAggregationType(value: unknown): ReportConfig['aggregationType'] {
  return value === 'Sum' || value === 'Average' || value === 'Count' ? value : 'Count';
}

function uniqueStrings(values: unknown, fallback: string[] = []) {
  const source = Array.isArray(values) ? values : fallback;
  return Array.from(
    new Set(
      source
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  );
}

function normalizeFilterRows(values: unknown): FilterRow[] {
  return (Array.isArray(values) ? values : []).map((item) => {
    const row = asRecord(item);
    return {
      id: cleanString(row.id, crypto.randomUUID()),
      field: cleanString(row.field, 'Status'),
      operator: cleanString(row.operator, 'Equals'),
      value: typeof row.value === 'string' ? row.value.trim() : String(row.value ?? ''),
    };
  });
}

function normalizeReportConfig(input: unknown, fallbackTitle = 'New Report'): ReportConfig {
  const fallback = defaultConfig(fallbackTitle);
  const value = asRecord(input);
  const chartType = normalizeReportChartType(value.chartType ?? fallback.chartType);
  const selectedFields = uniqueStrings(value.selectedFields, fallback.selectedFields);
  const displayFields = uniqueStrings(value.displayFields, selectedFields.length ? selectedFields : fallback.displayFields);
  const drillDownFields = uniqueStrings(value.drillDownFields, fallback.drillDownFields);
  const sortingFields = uniqueStrings(value.sortingFields, fallback.sortingFields);
  const filterLogic = cleanString(value.filterLogic, fallback.filterLogic);
  const filters = normalizeFilterRows(value.filters).length > 0 ? normalizeFilterRows(value.filters) : fallback.filters;
  return {
    reportTitle: cleanString(value.reportTitle, fallbackTitle),
    chartType,
    module: cleanString(value.module, fallback.module),
    groupBy: cleanString(value.groupBy, fallback.groupBy),
    aggregateField: cleanString(value.aggregateField, fallback.aggregateField),
    aggregationType: normalizeAggregationType(value.aggregationType),
    selectedFields,
    displayFields,
    drillDownFields,
    sortingFields,
    filterLogic,
    filters,
  };
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

const modules = Array.from(
  new Set([
    ...MODULE_CATALOG.filter((entry) => entry.implementationType !== 'subfeature').map((entry) => entry.pluralName),
    'Issues',
    'Evidence',
  ]),
);
const displayFields = Array.from(
  new Set([
    'Title',
    'Status',
    'Owner',
    'Last Updated',
    'Due Date',
    'Severity',
    'Program',
    'Framework',
    ...MODULE_CATALOG.flatMap((entry) => (entry.starterFields ?? []).map((field) => field.displayName)),
  ]),
);

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

function resolveModuleEntry(moduleName: string): ModuleCatalogEntry | null {
  const requested = normalizeIdentifier(moduleName);
  return MODULE_CATALOG.find((entry) => {
    const candidates = [
      entry.moduleKey,
      entry.moduleName,
      entry.pluralName,
      ...(entry.aliases ?? []),
    ];
    return candidates.some((candidate) => normalizeIdentifier(candidate) === requested);
  }) ?? null;
}

function getDataValue(data: Record<string, unknown>, field: string): unknown {
  const requested = normalizeIdentifier(field);
  const direct = data[field];
  if (direct !== undefined) {
    return direct;
  }
  for (const [key, value] of Object.entries(data)) {
    if (normalizeIdentifier(key) === requested) {
      return value;
    }
  }
  return undefined;
}

function fieldValue(record: ModuleRecordRow, entry: ModuleCatalogEntry | null, field: string): unknown {
  const data = asJson<Record<string, unknown>>(record.data_json, {});
  const normalized = normalizeIdentifier(field);
  if (normalized === 'title' || normalized === 'name') return record.title;
  if (normalized === 'status') return record.status;
  if (normalized === 'owner') return getDataValue(data, 'owner') ?? getDataValue(data, 'owner_user_id') ?? record.owner_user_id ?? 'Unassigned';
  if (normalized === 'assignee') return getDataValue(data, 'assignee') ?? record.assignee_user_id ?? '';
  if (normalized === 'module') return entry?.pluralName ?? record.module_key;
  if (normalized === 'lastupdated' || normalized === 'updatedat') return record.updated_at;
  if (normalized === 'createdat' || normalized === 'createdon') return record.created_at;
  if (normalized === 'duedate' || normalized === 'dueon') return record.due_on ?? getDataValue(data, 'due_date');
  if (normalized === 'reviewdate' || normalized === 'reviewon') return record.review_on ?? getDataValue(data, 'review_on');
  if (normalized === 'startdate' || normalized === 'starton') return record.start_on ?? getDataValue(data, 'start_on');
  if (normalized === 'finishdate' || normalized === 'finishon') return record.finish_on ?? getDataValue(data, 'finish_on');
  if (normalized === 'expirationdate' || normalized === 'expireson') return record.expires_on ?? getDataValue(data, 'expiration_date');

  const starter = entry?.starterFields?.find((candidate) => normalizeIdentifier(candidate.displayName) === normalized);
  if (starter) {
    return getDataValue(data, starter.systemName) ?? getDataValue(data, starter.displayName);
  }
  return getDataValue(data, field);
}

function valueToString(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(valueToString(value).replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateMs(value: unknown): number | null {
  const text = valueToString(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDayCount(value: string) {
  const match = value.match(/-?\d+/);
  return match ? Math.abs(Number(match[0])) : 0;
}

function resolveDynamicFilterValue(value: string, ctx: WorkerRequestContext) {
  const normalized = normalizeIdentifier(value);
  if (normalized === 'currentuser') return ctx.userId ?? 'Current User';
  if (normalized === 'myorganization') return 'Regovise';
  return value;
}

function filterMatches(record: ModuleRecordRow, entry: ModuleCatalogEntry | null, filter: FilterRow, ctx: WorkerRequestContext) {
  const actual = fieldValue(record, entry, filter.field);
  const actualText = valueToString(actual).toLowerCase();
  const expected = resolveDynamicFilterValue(filter.value, ctx);
  const expectedText = valueToString(expected).toLowerCase();
  const operator = normalizeIdentifier(filter.operator);

  if (operator === 'equals') return actualText === expectedText;
  if (operator === 'doesnotequal' || operator === 'notequals') return actualText !== expectedText;
  if (operator === 'contains') return actualText.includes(expectedText);
  if (operator === 'doesnotcontain') return !actualText.includes(expectedText);
  if (operator === 'greaterthan') {
    const actualNumber = parseNumber(actual);
    const expectedNumber = parseNumber(expected);
    return actualNumber !== null && expectedNumber !== null && actualNumber > expectedNumber;
  }
  if (operator === 'lessthan') {
    const actualNumber = parseNumber(actual);
    const expectedNumber = parseNumber(expected);
    return actualNumber !== null && expectedNumber !== null && actualNumber < expectedNumber;
  }
  if (operator === 'before') {
    const actualMs = parseDateMs(actual);
    const expectedMs = parseDateMs(expected);
    return actualMs !== null && expectedMs !== null && actualMs < expectedMs;
  }
  if (operator === 'after') {
    const actualMs = parseDateMs(actual);
    const expectedMs = parseDateMs(expected);
    return actualMs !== null && expectedMs !== null && actualMs > expectedMs;
  }
  if (operator === 'withinlast' || operator === 'withinthelastxdays') {
    const actualMs = parseDateMs(actual);
    const days = parseDayCount(filter.value);
    const now = Date.now();
    return actualMs !== null && days > 0 && actualMs >= now - days * 86400000 && actualMs <= now;
  }
  if (operator === 'withinnext' || operator === 'nextxdays') {
    const actualMs = parseDateMs(actual);
    const days = parseDayCount(filter.value);
    const now = Date.now();
    return actualMs !== null && days > 0 && actualMs >= now && actualMs <= now + days * 86400000;
  }
  return actualText === expectedText;
}

function tokenizeFilterLogic(logic: string) {
  return logic.match(/\d+|AND|OR|\(|\)/gi) ?? [];
}

function evaluateFilterLogic(logic: string, matches: boolean[]): { valid: boolean; matched: boolean } {
  if (matches.length === 0) {
    return { valid: true, matched: true };
  }
  const tokens = tokenizeFilterLogic(logic);
  if (tokens.length === 0) {
    return { valid: true, matched: matches.every(Boolean) };
  }
  let index = 0;

  function parsePrimary(): boolean | null {
    const token = tokens[index];
    if (!token) return null;
    if (token === '(') {
      index += 1;
      const value = parseOr();
      if (tokens[index] !== ')') return null;
      index += 1;
      return value;
    }
    if (/^\d+$/.test(token)) {
      index += 1;
      return matches[Number(token) - 1] ?? false;
    }
    return null;
  }

  function parseAnd(): boolean | null {
    let value = parsePrimary();
    if (value === null) return null;
    while (tokens[index]?.toUpperCase() === 'AND') {
      index += 1;
      const right = parsePrimary();
      if (right === null) return null;
      value = value && right;
    }
    return value;
  }

  function parseOr(): boolean | null {
    let value = parseAnd();
    if (value === null) return null;
    while (tokens[index]?.toUpperCase() === 'OR') {
      index += 1;
      const right = parseAnd();
      if (right === null) return null;
      value = value || right;
    }
    return value;
  }

  const matched = parseOr();
  return { valid: matched !== null && index === tokens.length, matched: matched ?? matches.every(Boolean) };
}

async function loadModuleRows(
  env: WorkerRequestContext['env'],
  tenantId: string,
  moduleName: string,
): Promise<{ entry: ModuleCatalogEntry | null; rows: ModuleRecordRow[] }> {
  const entry = resolveModuleEntry(moduleName);
  if (!entry || entry.implementationType !== 'shared-workspace') {
    return { entry, rows: [] };
  }
  const rows = await env.D1_MAIN.prepare(
    `SELECT * FROM module_records WHERE tenant_id = ? AND module_key = ? AND archived = 0 ORDER BY updated_at DESC LIMIT 250`,
  )
    .bind(tenantId, entry.moduleKey)
    .all<ModuleRecordRow>();
  return { entry, rows: rows.results };
}

function fallbackPreviewForConfig(config: ReportConfig): ReportPreview {
  if (config.chartType === 'List') {
    return {
      kind: 'table' as const,
      columns: config.displayFields.length > 0 ? config.displayFields : config.selectedFields,
      rows: [
        ['Open POAM 2026-04', 'Open', 'Maya Ellison', '2026-04-11', 'High'],
        ['Control Gap Follow-up', 'In Progress', 'Jon Park', '2026-04-10', 'Moderate'],
        ['Assessment Packet Review', 'Open', 'Priya Ramesh', '2026-04-09', 'Low'],
      ],
      recordCount: 3,
      filterExpressionValid: true,
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
    recordCount: 3,
    filterExpressionValid: true,
  };
}

async function previewForConfig(
  env: WorkerRequestContext['env'],
  tenantId: string,
  ctx: WorkerRequestContext,
  configInput: ReportConfig,
): Promise<ReportPreview> {
  const config = normalizeReportConfig(configInput, configInput.reportTitle);
  const { entry, rows } = await loadModuleRows(env, tenantId, config.module);
  if (rows.length === 0) {
    return fallbackPreviewForConfig(config);
  }
  const evaluations = rows.map((row) => config.filters.map((filter) => filterMatches(row, entry, filter, ctx)));
  const logicResults = evaluations.map((matches) => evaluateFilterLogic(config.filterLogic, matches));
  const filterExpressionValid = logicResults.every((result) => result.valid);
  let filtered = rows.filter((_, index) => logicResults[index]?.matched ?? true);
  if (filtered.length === 0) {
    filtered = rows.slice(0, 10);
  }
  for (const sortField of [...config.sortingFields].reverse()) {
    filtered = [...filtered].sort((a, b) =>
      valueToString(fieldValue(a, entry, sortField)).localeCompare(valueToString(fieldValue(b, entry, sortField))),
    );
  }
  if (config.chartType === 'List') {
    const columns = config.displayFields.length > 0 ? config.displayFields : config.selectedFields;
    return {
      kind: 'table',
      columns,
      rows: filtered.slice(0, 25).map((row) => columns.map((field) => valueToString(fieldValue(row, entry, field)))),
      recordCount: filtered.length,
      filterExpressionValid,
    };
  }

  const groups = new Map<string, { count: number; sum: number }>();
  for (const row of filtered) {
    const group = valueToString(fieldValue(row, entry, config.groupBy)) || 'Unspecified';
    const metric = config.aggregationType === 'Count' ? 1 : parseNumber(fieldValue(row, entry, config.aggregateField)) ?? 0;
    const current = groups.get(group) ?? { count: 0, sum: 0 };
    groups.set(group, { count: current.count + 1, sum: current.sum + metric });
  }
  const entries = Array.from(groups.entries()).slice(0, 12);
  return {
    kind: 'series',
    labels: entries.map(([label]) => label),
    values: entries.map(([, value]) =>
      config.aggregationType === 'Average' ? Math.round((value.sum / Math.max(1, value.count)) * 100) / 100 : value.sum,
    ),
    recordCount: filtered.length,
    filterExpressionValid,
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
  const config = normalizeReportConfig(asJson<ReportConfig>(row.config_json, defaultConfig(row.title)), row.title);
  return {
    id: row.id,
    title: row.title,
    chartType: row.chart_type as ReportChartType,
    module: row.module_name,
    owner: row.owner,
    status: row.status as ReportStatus,
    source: 'Report Builder',
    description: row.description,
    config: {
      ...config,
      reportTitle: row.title,
      chartType: row.chart_type as ReportChartType,
      module: row.module_name,
    },
    subscriptions: await getSubscriptions(env, tenantId, row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getFirstFolderId(env: WorkerRequestContext['env'], tenantId: string) {
  const folder = await env.D1_MAIN.prepare(
    `SELECT id FROM folders WHERE tenant_id = ? ORDER BY CASE WHEN content_type = 'domain' THEN 0 ELSE 1 END, created_at ASC LIMIT 1`,
  )
    .bind(tenantId)
    .first<{ id: string }>();
  return folder?.id ?? null;
}

function previewToRows(preview: ReportPreview): string[][] {
  if (preview.kind === 'table') {
    return [preview.columns, ...preview.rows];
  }
  return [['label', 'value'], ...preview.labels.map((label, index) => [label, String(preview.values[index] ?? 0)])];
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
      const config = {
        ...normalizeReportConfig(body.config ?? defaultConfig(title), title),
        reportTitle: title,
        chartType: normalizeReportChartType(body.chartType ?? body.config?.chartType),
        module: body.module?.trim() || body.config?.module || defaultConfig(title).module,
      };
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
          normalizeReportStatus(body.status),
          'Report Builder',
          body.description ?? 'Custom canonical report definition.',
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
      const title = body.title?.trim() || current.title;
      const chartType = normalizeReportChartType(body.chartType ?? current.chart_type);
      const moduleName = body.module?.trim() || current.module_name;
      const config = {
        ...normalizeReportConfig(body.config ?? asJson<ReportConfig>(current.config_json, defaultConfig(current.title)), title),
        reportTitle: title,
        chartType,
        module: moduleName,
      };
      await ctx.env.D1_MAIN.prepare(
        `UPDATE report_builder_reports
            SET title = ?, chart_type = ?, module_name = ?, owner = ?, status = ?, description = ?, config_json = ?,
                updated_by_user_id = ?, updated_at = ?
          WHERE tenant_id = ? AND id = ?`,
      )
        .bind(
          title,
          chartType,
          moduleName,
          body.owner?.trim() || current.owner,
          normalizeReportStatus(body.status ?? current.status),
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
    const title = body.title?.trim() || current.title;
    const config = {
      ...normalizeReportConfig(body.config ?? asJson<ReportConfig>(current.config_json, defaultConfig(current.title)), title),
      reportTitle: title,
      chartType: normalizeReportChartType(body.chartType ?? current.chart_type),
      module: body.module?.trim() || current.module_name,
    };
    return json({ data: { preview: await previewForConfig(ctx.env, tenantId, ctx, config) } });
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
    const config = normalizeReportConfig(asJson<ReportConfig>(current.config_json, defaultConfig(current.title)), current.title);
    const preview = await previewForConfig(ctx.env, tenantId, ctx, config);
    const exportId = crypto.randomUUID();
    const artifactName = `${slug(current.title)}-${Date.now()}.csv`;
    const rows = previewToRows(preview);
    await ctx.env.D1_MAIN.prepare(
      `INSERT INTO report_exports (
        id, tenant_id, folder_id, created_by_user_id, report_id, name, format, status, filter_json, summary_json, content_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        exportId,
        tenantId,
        await getFirstFolderId(ctx.env, tenantId),
        ctx.userId ?? null,
        `report-builder:${current.id}`,
        `${current.title} CSV export`,
        'csv',
        'generated',
        JSON.stringify({
          source: 'Report Builder',
          reportId: current.id,
          module: config.module,
          filterLogic: config.filterLogic,
          filters: config.filters,
        }),
        JSON.stringify({
          source: 'Report Builder',
          chartType: config.chartType,
          recordCount: preview.recordCount,
          filterExpressionValid: preview.filterExpressionValid,
        }),
        JSON.stringify({
          filename: artifactName,
          rows,
          preview,
        }),
      )
      .run();
    return json({
      data: {
        exported: true,
        format: 'csv',
        artifactName,
        exportId,
        downloadPath: `/_api/ops/reports/exports/${exportId}/download`,
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
