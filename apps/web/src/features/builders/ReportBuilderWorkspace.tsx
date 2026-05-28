import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Download,
  FileSpreadsheet,
  LineChart,
  Mail,
  PieChart,
  Plus,
  Save,
  Search,
  Share2,
  Table2,
  Trash2,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  createReportBuilderReport,
  createReportBuilderSubscription,
  deleteReportBuilderReport,
  deleteReportBuilderSubscription,
  exportReportBuilderReport,
  getReportBuilderReport,
  listReportBuilderReports,
  previewReportBuilderReport,
  saveReportBuilderReport,
  shareReportBuilderReport,
} from './reportApi';
import { useEdgeIdentity } from '../../shared/session/identity';
import type {
  RecurrenceType,
  ReportBuilderDetail,
  ReportBuilderSummary,
  ReportConfig,
  ReportFilterRow,
  ReportPreview,
} from './reportTypes';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function emptyFilterRow(): ReportFilterRow {
  return {
    id: crypto.randomUUID(),
    field: 'Status',
    operator: 'Equals',
    value: 'Open',
  };
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function addValue(values: string[], value: string) {
  const trimmed = value.trim();
  return trimmed && !values.includes(trimmed) ? [...values, trimmed] : values;
}

function removeValue(values: string[], value: string) {
  return values.filter((item) => item !== value);
}

function moveValue(values: string[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= values.length) {
    return values;
  }
  const next = [...values];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

function reportPayload(draft: ReportBuilderDetail) {
  return {
    title: draft.title,
    chartType: draft.chartType,
    module: draft.module,
    owner: draft.owner,
    status: draft.status,
    description: draft.description,
    config: draft.config,
  };
}

const filterOperators = [
  'Equals',
  'Does Not Equal',
  'Contains',
  'Does Not Contain',
  'Greater Than',
  'Less Than',
  'Before',
  'After',
  'Within the Last X Days',
  'Next X Days',
];

const recipientTypes = ['user', 'group', 'external'];
const recurrenceTypes: RecurrenceType[] = ['Daily', 'Weekly', 'Monthly'];

export function ReportBuilderWorkspace() {
  const { identity } = useEdgeIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedReportId = searchParams.get('reportId');
  const [reports, setReports] = useState<ReportBuilderSummary[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [displayFields, setDisplayFields] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportBuilderDetail | null>(null);
  const [draft, setDraft] = useState<ReportBuilderDetail | null>(null);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [search, setSearch] = useState('');
  const [newReportTitle, setNewReportTitle] = useState('');
  const [newReportOwner, setNewReportOwner] = useState('Regovise Operator');
  const [newReportChartType, setNewReportChartType] = useState<ReportBuilderDetail['chartType']>('List');
  const [newReportModule, setNewReportModule] = useState('Security Plans');
  const [shareRecipients, setShareRecipients] = useState('security-ops@regovise.com, audit@regovise.com');
  const [subscriptionEmail, setSubscriptionEmail] = useState('security-ops@regovise.com');
  const [subscriptionType, setSubscriptionType] = useState('user');
  const [subscriptionStartDate, setSubscriptionStartDate] = useState('2026-04-18');
  const [subscriptionRecurrence, setSubscriptionRecurrence] = useState<RecurrenceType>('Weekly');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadReports() {
    try {
      setLoading(true);
      setError(null);
      const next = await listReportBuilderReports();
      setReports(next.reports);
      setModules(next.modules);
      setDisplayFields(next.displayFields);
      setSelectedId((current) => requestedReportId ?? current ?? next.reports[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Report Builder library.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(reportId: string) {
    try {
      setDetailLoading(true);
      setError(null);
      const next = await getReportBuilderReport(reportId);
      setDetail(next);
      setDraft(clone(next));
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Report Builder detail.');
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, [identity.tenantId, identity.userId, requestedReportId]);

  useEffect(() => {
    if (!newReportModule && modules[0]) {
      setNewReportModule(modules[0]);
    }
  }, [modules, newReportModule]);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    }
  }, [selectedId]);

  const fieldOptions = useMemo(() => {
    const extras = draft
      ? [
          ...draft.config.selectedFields,
          ...draft.config.displayFields,
          ...draft.config.drillDownFields,
          ...draft.config.sortingFields,
        ]
      : [];
    return Array.from(new Set([...displayFields, ...extras]));
  }, [displayFields, draft]);

  const hasUnsavedChanges = useMemo(() => {
    if (!detail || !draft) {
      return false;
    }
    return JSON.stringify(reportPayload(detail)) !== JSON.stringify(reportPayload(draft));
  }, [detail, draft]);

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return reports;
    }
    return reports.filter((report) =>
      [report.title, report.module, report.owner, report.description ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [reports, search]);

  function updateDraft(patch: Partial<ReportBuilderDetail>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function updateConfig(patch: Partial<ReportConfig>) {
    setDraft((current) =>
      current
        ? {
            ...current,
            config: {
              ...current.config,
              ...patch,
            },
          }
        : current,
    );
  }

  function selectReport(reportId: string) {
    setSelectedId(reportId);
    setSearchParams({ reportId });
  }

  function updateFieldList(
    key: 'displayFields' | 'selectedFields' | 'drillDownFields' | 'sortingFields',
    values: string[],
  ) {
    updateConfig({ [key]: values } as Partial<ReportConfig>);
  }

  const metrics = useMemo(() => {
    return [
      {
        label: 'Reports',
        value: reports.length,
        detail: 'Canonical report definitions stored in Cloudflare D1.',
      },
      {
        label: 'Active',
        value: reports.filter((report) => report.status === 'Active').length,
        detail: 'Published definitions currently ready for sharing and export.',
      },
      {
        label: 'Filters',
        value: draft?.config.filters.length ?? 0,
        detail: 'Filter clauses shaping the currently selected report output.',
      },
      {
        label: 'Subscriptions',
        value: draft?.subscriptions.length ?? 0,
        detail: 'Scheduled deliveries configured on the current report.',
      },
    ];
  }, [draft, reports]);

  async function handleCreateReport() {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const created = await createReportBuilderReport({
        title: newReportTitle || undefined,
        owner: newReportOwner || undefined,
        chartType: newReportChartType,
        module: newReportModule || undefined,
        config: {
          reportTitle: newReportTitle || 'New Report',
          chartType: newReportChartType,
          module: newReportModule || 'Security Plans',
          groupBy: 'Status',
          aggregateField: 'Status',
          aggregationType: 'Count',
          selectedFields: ['Title', 'Status', 'Owner', 'Last Updated'],
          displayFields: ['Title', 'Status', 'Owner', 'Last Updated'],
          drillDownFields: ['Owner'],
          sortingFields: ['Last Updated'],
          filterLogic: '1 AND (2 OR 3)',
          filters: [
            { id: crypto.randomUUID(), field: 'Status', operator: 'Equals', value: 'Active' },
            { id: crypto.randomUUID(), field: 'Due Date', operator: 'Next X Days', value: '30 days' },
            { id: crypto.randomUUID(), field: 'Owner', operator: 'Equals', value: 'Current User' },
          ],
        },
      });
      setNewReportTitle('');
      setNewReportOwner('Regovise Operator');
      await loadReports();
      selectReport(created.id);
      setNotice('New report definition created in the canonical Report Builder service.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create report definition.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!draft) {
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const saved = await saveReportBuilderReport(draft.id, reportPayload(draft));
      setDetail(saved);
      setDraft(clone(saved));
      await loadReports();
      setNotice('Report Builder definition saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save report definition.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!draft) {
      return;
    }
    const confirmation = window.prompt(`Type "${draft.title}" to confirm delete.`);
    if (confirmation !== draft.title) {
      setNotice('Delete cancelled.');
      return;
    }
    try {
      setBusyAction('delete');
      setError(null);
      setNotice(null);
      await deleteReportBuilderReport(draft.id);
      setSelectedId(null);
      setDetail(null);
      setDraft(null);
      setPreview(null);
      await loadReports();
      setNotice('Report definition deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete report definition.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePreview() {
    if (!draft) {
      return;
    }
    try {
      setBusyAction('preview');
      setError(null);
      setNotice(null);
      const nextPreview = await previewReportBuilderReport(draft.id, reportPayload(draft));
      setPreview(nextPreview);
      setNotice('Preview generated from the canonical Report Builder service.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate report preview.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleShare() {
    if (!draft) {
      return;
    }
    const recipients = shareRecipients
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    try {
      setBusyAction('share');
      setError(null);
      setNotice(null);
      const result = await shareReportBuilderReport(draft.id, recipients);
      setNotice(`Share workflow recorded for ${result.recipients.length} recipients.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record report share request.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleExport() {
    if (!draft) {
      return;
    }
    try {
      setBusyAction('export');
      setError(null);
      setNotice(null);
      const result = await exportReportBuilderReport(draft.id);
      setNotice(
        result.downloadPath
          ? `Export generated as ${result.artifactName}. Download path: ${result.downloadPath}`
          : `Export queued as ${result.artifactName}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to queue report export.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateSubscription() {
    if (!draft) {
      return;
    }
    try {
      setBusyAction('subscription-create');
      setError(null);
      setNotice(null);
      await createReportBuilderSubscription(draft.id, {
        recipientEmail: subscriptionEmail || undefined,
        recipientType: subscriptionType || undefined,
        startDate: subscriptionStartDate || undefined,
        recurrenceType: subscriptionRecurrence,
      });
      const refreshed = await getReportBuilderReport(draft.id);
      setDetail(refreshed);
      setDraft(clone(refreshed));
      setNotice('Subscription created and stored in D1.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create report subscription.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteSubscription(subscriptionId: string) {
    if (!draft) {
      return;
    }
    try {
      setBusyAction(`subscription:${subscriptionId}`);
      setError(null);
      setNotice(null);
      await deleteReportBuilderSubscription(draft.id, subscriptionId);
      const refreshed = await getReportBuilderReport(draft.id);
      setDetail(refreshed);
      setDraft(clone(refreshed));
      setNotice('Subscription removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete report subscription.');
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading Report Builder...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Builders</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">Report Builder</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Build list and chart reports directly from the canonical Cloudflare runtime, then
              preview, share, export, and schedule recurring delivery without leaving Regovise.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to="/reports">
              Done
            </Link>
            <button className="button-secondary" onClick={() => void handleShare()} type="button">
              <Share2 className="mr-2 h-4 w-4" />
              {busyAction === 'share' ? 'Sharing...' : 'Share'}
            </button>
            <button className="button-secondary" onClick={() => void handleExport()} type="button">
              <Download className="mr-2 h-4 w-4" />
              {busyAction === 'export' ? 'Exporting...' : 'Export'}
            </button>
            <button className="button-secondary" onClick={() => void handlePreview()} type="button">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {busyAction === 'preview' ? 'Generating...' : 'Generate Report'}
            </button>
            <button className="button-primary" disabled={saving} onClick={() => void handleSave()} type="button">
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div className="metric-card" key={metric.label}>
            <div className="metric-label">{metric.label}</div>
            <div className="metric-value">{metric.value}</div>
            <div className="mt-2 text-xs text-slate-500">{metric.detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="panel space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Report Library</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Definitions</h2>
            </div>
            <BarChart3 className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
            <input
              className="input pl-10"
              placeholder="Search reports"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateReport();
            }}
          >
            <input
              className="input"
              placeholder="New report title"
              value={newReportTitle}
              onChange={(event) => setNewReportTitle(event.target.value)}
            />
            <input
              className="input"
              placeholder="Owner"
              value={newReportOwner}
              onChange={(event) => setNewReportOwner(event.target.value)}
            />
            <select
              className="input"
              aria-label="New report chart type"
              value={newReportChartType}
              onChange={(event) => setNewReportChartType(event.target.value as ReportBuilderDetail['chartType'])}
            >
              <option value="List">List</option>
              <option value="Bar">Bar</option>
              <option value="Line">Line</option>
              <option value="Pie">Pie</option>
            </select>
            <select
              className="input"
              aria-label="New report module"
              value={newReportModule}
              onChange={(event) => setNewReportModule(event.target.value)}
            >
              {modules.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
            <button className="button-secondary w-full" disabled={saving} type="submit">
              <Plus className="mr-2 h-4 w-4" />
              Create New Report
            </button>
          </form>
          <div className="space-y-3">
            {filteredReports.map((report) => {
              const Icon =
                report.chartType === 'Pie'
                  ? PieChart
                  : report.chartType === 'Bar'
                    ? BarChart3
                    : report.chartType === 'Line'
                      ? LineChart
                      : Table2;
              return (
                <button
                  key={report.id}
                  className={`panel-subtle w-full text-left transition ${
                    selectedId === report.id ? 'border-cyan-300/30 bg-cyan-400/[0.04]' : 'hover:border-cyan-300/20'
                  }`}
                  onClick={() => selectReport(report.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-xl border border-white/10 bg-white/5 p-2">
                        <Icon className="h-4 w-4 text-slate-200" />
                      </div>
                      <div>
                        <div className="font-medium text-white">{report.title}</div>
                        <div className="mt-1 text-sm text-slate-400">
                          {report.module} · {report.owner}
                        </div>
                      </div>
                    </div>
                    <span className={report.status === 'Active' ? 'badge-success' : 'badge-neutral'}>
                      {report.status}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="badge-neutral">{report.chartType}</span>
                    <span className="badge-neutral">{report.source}</span>
                  </div>
                  <div className="mt-3 text-xs text-slate-500">Updated {formatDate(report.lastUpdated)}</div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="panel">
          {detailLoading || !draft ? (
            <div className="text-sm text-slate-300">Loading report definition...</div>
          ) : (
            <div className="space-y-6">
              <div className="panel-subtle">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="eyebrow">Report Summary</div>
                    <h3 className="mt-2 text-xl font-semibold text-white">{draft.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={draft.status === 'Active' ? 'badge-success' : 'badge-neutral'}>
                        {draft.status}
                      </span>
                      <span className="badge-neutral">{draft.chartType}</span>
                      <span className="badge-neutral">{draft.module}</span>
                      <span className="badge-neutral">{draft.owner}</span>
                      {hasUnsavedChanges && <span className="badge-neutral">Unsaved changes</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="button-secondary" onClick={() => void handleDelete()} type="button">
                      <Trash2 className="mr-2 h-4 w-4" />
                      {busyAction === 'delete' ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <div className="space-y-6">
                  <div className="panel-subtle">
                    <div className="eyebrow">Basics</div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-200">Report Title</span>
                        <input
                          className="input"
                          value={draft.title}
                          onChange={(event) => updateDraft({ title: event.target.value })}
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-200">Owner</span>
                        <input
                          className="input"
                          value={draft.owner}
                          onChange={(event) => updateDraft({ owner: event.target.value })}
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-200">Chart Type</span>
                        <select
                          className="input"
                          value={draft.chartType}
                          onChange={(event) =>
                            updateDraft({ chartType: event.target.value as ReportBuilderDetail['chartType'] })
                          }
                        >
                          <option value="List">List</option>
                          <option value="Bar">Bar</option>
                          <option value="Line">Line</option>
                          <option value="Pie">Pie</option>
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-200">Status</span>
                        <select
                          className="input"
                          value={draft.status}
                          onChange={(event) =>
                            updateDraft({ status: event.target.value as ReportBuilderDetail['status'] })
                          }
                        >
                          <option value="Draft">Draft</option>
                          <option value="Active">Active</option>
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-200">Module</span>
                        <select
                          className="input"
                          value={draft.module}
                          onChange={(event) => updateDraft({ module: event.target.value })}
                        >
                          {modules.map((module) => (
                            <option key={module} value={module}>
                              {module}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-200">Group By</span>
                        <select
                          className="input"
                          value={draft.config.groupBy}
                          onChange={(event) => updateConfig({ groupBy: event.target.value })}
                        >
                          {fieldOptions.map((field) => (
                            <option key={`group-${field}`} value={field}>
                              {field}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-200">Aggregate Field</span>
                        <select
                          className="input"
                          value={draft.config.aggregateField}
                          onChange={(event) => updateConfig({ aggregateField: event.target.value })}
                        >
                          {fieldOptions.map((field) => (
                            <option key={`aggregate-${field}`} value={field}>
                              {field}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-200">Aggregation Type</span>
                        <select
                          className="input"
                          value={draft.config.aggregationType}
                          onChange={(event) =>
                            updateConfig({ aggregationType: event.target.value as ReportConfig['aggregationType'] })
                          }
                        >
                          <option value="Count">Count</option>
                          <option value="Sum">Sum</option>
                          <option value="Average">Average</option>
                        </select>
                      </label>
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-medium text-slate-200">Description</span>
                        <textarea
                          className="input min-h-[110px]"
                          value={draft.description ?? ''}
                          onChange={(event) => updateDraft({ description: event.target.value || null })}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="panel-subtle">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="eyebrow">Field Selection</div>
                        <p className="mt-2 text-sm text-slate-400">
                          Choose the fields that appear, support drill-down, and determine sorting.
                        </p>
                      </div>
                      <span className="badge-neutral">{fieldOptions.length} fields</span>
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      {[
                        {
                          label: 'Select Fields',
                          help: 'Add one or more module fields used by list reports and exports.',
                          key: 'selectedFields' as const,
                          values: draft.config.selectedFields,
                        },
                        {
                          label: 'Sorting Fields',
                          help: 'Choose ordered fields that control the display order of report results.',
                          key: 'sortingFields' as const,
                          values: draft.config.sortingFields,
                        },
                      ].map((group) => (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4" key={group.label}>
                          <div className="text-sm font-medium text-slate-200">{group.label}</div>
                          <div className="mt-1 text-xs text-slate-500">{group.help}</div>
                          <select
                            className="input mt-3"
                            aria-label={`Add ${group.label}`}
                            value=""
                            onChange={(event) => {
                              updateFieldList(group.key, addValue(group.values, event.target.value));
                              event.target.value = '';
                            }}
                          >
                            <option value="">Add field...</option>
                            {fieldOptions.map((field) => (
                              <option key={`${group.key}-${field}`} value={field}>
                                {field}
                              </option>
                            ))}
                          </select>
                          <div className="mt-3 space-y-2">
                            {group.values.map((field, index) => (
                              <div
                                className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2"
                                key={`${group.key}-selected-${field}`}
                              >
                                <span className="text-sm text-slate-200">{field}</span>
                                <div className="flex gap-1">
                                  <button
                                    className="button-secondary px-2 py-1"
                                    disabled={index === 0}
                                    onClick={() => updateFieldList(group.key, moveValue(group.values, index, -1))}
                                    type="button"
                                  >
                                    <ArrowUp className="h-3 w-3" />
                                  </button>
                                  <button
                                    className="button-secondary px-2 py-1"
                                    disabled={index === group.values.length - 1}
                                    onClick={() => updateFieldList(group.key, moveValue(group.values, index, 1))}
                                    type="button"
                                  >
                                    <ArrowDown className="h-3 w-3" />
                                  </button>
                                  <button
                                    className="button-secondary px-2 py-1"
                                    onClick={() => updateFieldList(group.key, removeValue(group.values, field))}
                                    type="button"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-sm font-medium text-slate-200">Display Fields</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Reorder or remove the fields shown in list previews. These mirror selected fields by default.
                      </div>
                      <select
                        className="input mt-3"
                        aria-label="Add display field"
                        value=""
                        onChange={(event) => {
                          updateFieldList('displayFields', addValue(draft.config.displayFields, event.target.value));
                          event.target.value = '';
                        }}
                      >
                        <option value="">Add display field...</option>
                        {fieldOptions.map((field) => (
                          <option key={`display-add-${field}`} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                      <div className="mt-3 space-y-2">
                        {draft.config.displayFields.map((field, index) => (
                          <div
                            className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2"
                            key={`display-selected-${field}`}
                          >
                            <span className="text-sm text-slate-200">{field}</span>
                            <div className="flex gap-1">
                              <button
                                className="button-secondary px-2 py-1"
                                disabled={index === 0}
                                onClick={() => updateFieldList('displayFields', moveValue(draft.config.displayFields, index, -1))}
                                type="button"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                className="button-secondary px-2 py-1"
                                disabled={index === draft.config.displayFields.length - 1}
                                onClick={() => updateFieldList('displayFields', moveValue(draft.config.displayFields, index, 1))}
                                type="button"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                              <button
                                className="button-secondary px-2 py-1"
                                onClick={() => updateFieldList('displayFields', removeValue(draft.config.displayFields, field))}
                                type="button"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-sm font-medium text-slate-200">Drill-Down Fields</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {fieldOptions.map((field) => (
                          <button
                            key={`drilldown-${field}`}
                            className={draft.config.drillDownFields.includes(field) ? 'badge-success' : 'badge-neutral'}
                            onClick={() =>
                              updateConfig({ drillDownFields: toggleValue(draft.config.drillDownFields, field) })
                            }
                            type="button"
                          >
                            {field}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="panel-subtle">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="eyebrow">Filters</div>
                        <p className="mt-2 text-sm text-slate-400">
                          Define query clauses that shape the report dataset and downstream exports.
                        </p>
                      </div>
                      <button
                        className="button-secondary"
                        onClick={() => updateConfig({ filters: [...draft.config.filters, emptyFilterRow()] })}
                        type="button"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Filter
                      </button>
                    </div>
                    <label className="mt-4 block space-y-2">
                      <span className="text-sm font-medium text-slate-200">Filter Logic</span>
                      <input
                        className="input"
                        value={draft.config.filterLogic}
                        onChange={(event) => updateConfig({ filterLogic: event.target.value })}
                      />
                      <span className="text-xs text-slate-500">
                        Supports AND/OR and parentheses, for example <code>1 AND (2 OR 3)</code>.
                      </span>
                    </label>
                    <div className="mt-4 space-y-3">
                      {draft.config.filters.map((filter, filterIndex) => (
                        <div
                          className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-[1fr_1fr_1fr_auto]"
                          key={filter.id}
                        >
                          <label className="space-y-1">
                            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">
                              Filter {filterIndex + 1} Field
                            </span>
                            <select
                              className="input"
                              value={filter.field}
                              onChange={(event) =>
                                updateConfig({
                                  filters: draft.config.filters.map((item) =>
                                    item.id === filter.id ? { ...item, field: event.target.value } : item,
                                  ),
                                })
                              }
                            >
                              {fieldOptions.map((field) => (
                                <option key={`filter-field-${filter.id}-${field}`} value={field}>
                                  {field}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1">
                            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Operator</span>
                            <select
                              className="input"
                              value={filter.operator}
                              onChange={(event) =>
                                updateConfig({
                                  filters: draft.config.filters.map((item) =>
                                    item.id === filter.id ? { ...item, operator: event.target.value } : item,
                                  ),
                                })
                              }
                            >
                              {filterOperators.map((operator) => (
                                <option key={operator} value={operator}>
                                  {operator}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1">
                            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Value</span>
                            <input
                            className="input"
                            value={filter.value}
                            onChange={(event) =>
                              updateConfig({
                                filters: draft.config.filters.map((item) =>
                                  item.id === filter.id ? { ...item, value: event.target.value } : item,
                                ),
                              })
                            }
                          />
                            <div className="mt-2 flex flex-wrap gap-1">
                              {['Current User', 'My Organization', '30 days', '90 days'].map((value) => (
                                <button
                                  className="badge-neutral"
                                  key={`${filter.id}-${value}`}
                                  onClick={() =>
                                    updateConfig({
                                      filters: draft.config.filters.map((item) =>
                                        item.id === filter.id ? { ...item, value } : item,
                                      ),
                                    })
                                  }
                                  type="button"
                                >
                                  {value}
                                </button>
                              ))}
                            </div>
                          </label>
                          <button
                            className="button-secondary"
                            onClick={() =>
                              updateConfig({
                                filters: draft.config.filters.filter((item) => item.id !== filter.id),
                              })
                            }
                            type="button"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="panel-subtle">
                    <div className="eyebrow">Live Preview</div>
                    <p className="mt-2 text-sm text-slate-400">
                      Run the preview to inspect the chart or table generated from the current unsaved definition.
                    </p>
                    <button className="button-secondary mt-4 w-full" onClick={() => void handlePreview()} type="button">
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      {busyAction === 'preview' ? 'Generating Report...' : 'Generate Report'}
                    </button>
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                      {!preview ? (
                        <div className="text-sm text-slate-400">
                          No preview generated yet. Run a preview to inspect the current report output.
                        </div>
                      ) : preview.kind === 'table' ? (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2 text-slate-200">
                            <Table2 className="h-4 w-4" />
                            <span className="text-sm font-medium">Table Preview</span>
                            <span className="badge-neutral">{preview.recordCount ?? preview.rows.length} records</span>
                            <span className={preview.filterExpressionValid === false ? 'badge-neutral' : 'badge-success'}>
                              Filter logic {preview.filterExpressionValid === false ? 'needs review' : 'valid'}
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                              <thead>
                                <tr>
                                  {preview.columns.map((column) => (
                                    <th className="border-b border-white/10 px-3 py-2 text-slate-400" key={column}>
                                      {column}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {preview.rows.map((row, rowIndex) => (
                                  <tr key={`row-${rowIndex}`}>
                                    {row.map((cell, cellIndex) => (
                                      <td className="border-b border-white/5 px-3 py-2 text-slate-200" key={`${rowIndex}-${cellIndex}`}>
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2 text-slate-200">
                            {draft.chartType === 'Pie' ? <PieChart className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
                            <span className="text-sm font-medium">{draft.chartType} Preview</span>
                            <span className="badge-neutral">{preview.recordCount ?? preview.labels.length} records</span>
                            <span className={preview.filterExpressionValid === false ? 'badge-neutral' : 'badge-success'}>
                              Filter logic {preview.filterExpressionValid === false ? 'needs review' : 'valid'}
                            </span>
                          </div>
                          <div className="space-y-3">
                            {preview.labels.map((label, index) => {
                              const value = preview.values[index] ?? 0;
                              return (
                                <div key={label}>
                                  <div className="mb-1 flex items-center justify-between text-sm text-slate-300">
                                    <span>{label}</span>
                                    <span>{value}</span>
                                  </div>
                                  <div className="h-2 rounded-full bg-white/5">
                                    <div
                                      className="h-2 rounded-full bg-cyan-400"
                                      style={{ width: `${Math.max(12, Math.min(100, value))}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="panel-subtle">
                    <div className="eyebrow">More Tools</div>
                    <p className="mt-2 text-sm text-slate-400">
                      Use the same actions exposed from existing Report Builder reports: Edit, Export, Subscriptions,
                      and Delete.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <button className="button-secondary" onClick={() => void handleSave()} type="button">
                        <Save className="mr-2 h-4 w-4" />
                        Edit / Save
                      </button>
                      <button className="button-secondary" onClick={() => void handleExport()} type="button">
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </button>
                      <a className="button-secondary" href="#report-subscriptions">
                        <Mail className="mr-2 h-4 w-4" />
                        Subscriptions
                      </a>
                      <button className="button-secondary" onClick={() => void handleDelete()} type="button">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="panel-subtle">
                    <div className="eyebrow">Share</div>
                    <p className="mt-2 text-sm text-slate-400">
                      Record a share workflow or export handoff for the current report definition.
                    </p>
                    <label className="mt-4 block space-y-2">
                      <span className="text-sm font-medium text-slate-200">Recipients</span>
                      <textarea
                        className="input min-h-[110px]"
                        value={shareRecipients}
                        onChange={(event) => setShareRecipients(event.target.value)}
                      />
                    </label>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <button className="button-secondary" onClick={() => void handleShare()} type="button">
                        <Share2 className="mr-2 h-4 w-4" />
                        {busyAction === 'share' ? 'Sharing...' : 'Record Share'}
                      </button>
                      <button className="button-secondary" onClick={() => void handleExport()} type="button">
                        <Download className="mr-2 h-4 w-4" />
                        {busyAction === 'export' ? 'Queueing...' : 'Queue Export'}
                      </button>
                    </div>
                  </div>

                  <div className="panel-subtle" id="report-subscriptions">
                    <div className="eyebrow">Subscriptions</div>
                    <p className="mt-2 text-sm text-slate-400">
                      Configure recurring delivery for the active report output.
                    </p>
                    <div className="mt-4 grid gap-3">
                      <input
                        className="input"
                        value={subscriptionEmail}
                        onChange={(event) => setSubscriptionEmail(event.target.value)}
                        placeholder="recipient@regovise.com"
                      />
                      <div className="grid gap-3 sm:grid-cols-3">
                        <select
                          className="input"
                          value={subscriptionType}
                          onChange={(event) => setSubscriptionType(event.target.value)}
                        >
                          {recipientTypes.map((recipientType) => (
                            <option key={recipientType} value={recipientType}>
                              {recipientType}
                            </option>
                          ))}
                        </select>
                        <input
                          className="input"
                          type="date"
                          value={subscriptionStartDate}
                          onChange={(event) => setSubscriptionStartDate(event.target.value)}
                        />
                        <select
                          className="input"
                          value={subscriptionRecurrence}
                          onChange={(event) => setSubscriptionRecurrence(event.target.value as RecurrenceType)}
                        >
                          {recurrenceTypes.map((recurrence) => (
                            <option key={recurrence} value={recurrence}>
                              {recurrence}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        className="button-secondary"
                        onClick={() => void handleCreateSubscription()}
                        type="button"
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        {busyAction === 'subscription-create' ? 'Creating...' : 'Create Subscription'}
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      {draft.subscriptions.map((subscription) => (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4" key={subscription.id}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-white">{subscription.recipientEmail}</div>
                              <div className="mt-1 text-xs text-slate-400">
                                {subscription.recipientType} · {subscription.recurrenceType} · starts {subscription.startDate}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {subscription.lastSentAt
                                  ? `Last sent ${formatDate(subscription.lastSentAt)}`
                                  : 'No delivery recorded yet'}
                              </div>
                            </div>
                            <button
                              className="button-secondary"
                              onClick={() => void handleDeleteSubscription(subscription.id)}
                              type="button"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
