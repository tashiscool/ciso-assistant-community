import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, RefreshCw, Search, Shapes } from 'lucide-react';
import {
  RegActionMenu,
  RegFilterBar,
  RegPageHeader,
  RegStatusPill,
  RegTableShell,
  RegTabs,
} from '../../components/regovise/PagePrimitives';
import { useOpsParityOverview } from './useOpsParityOverview';

type TaskOperationsControlPageProps = {
  mode?: 'legacy' | 'work-queue';
};

type WorkQueueRow = {
  id: string;
  source: string;
  title: string;
  subtitle: string;
  detail: string;
  route: string;
  status: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
};

function statusTone(status: string): WorkQueueRow['tone'] {
  const normalized = status.toLowerCase();
  if (normalized.includes('complete') || normalized.includes('ok') || normalized.includes('ready')) {
    return 'success';
  }
  if (normalized.includes('risk') || normalized.includes('fail') || normalized.includes('blocked')) {
    return 'danger';
  }
  if (normalized.includes('pending') || normalized.includes('review') || normalized.includes('validation')) {
    return 'warning';
  }
  if (normalized.includes('active') || normalized.includes('open')) {
    return 'info';
  }
  return 'neutral';
}

function formatStatus(status: string) {
  return status
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function TaskOperationsControlPage({ mode = 'legacy' }: TaskOperationsControlPageProps) {
  const { overview, loading, error, refresh } = useOpsParityOverview();
  const [selectedTab, setSelectedTab] = useState<'all' | 'tasks' | 'validation'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading work queue...</div>;
  }

  if (error || !overview) {
    return <div className="notice-error">{error ?? 'Task operations could not be loaded.'}</div>;
  }

  const rows: WorkQueueRow[] = [
    ...overview.tasks.map((item) => ({
      id: `task-${item.id}`,
      source: 'Task',
      title: item.title,
      subtitle: item.subtitle,
      detail: item.detail,
      route: item.route,
      status: item.status,
      tone: statusTone(item.status),
    })),
    ...overview.validationFlows.map((item) => ({
      id: `validation-${item.id}`,
      source: 'Validation',
      title: item.title,
      subtitle: item.subtitle,
      detail: item.detail,
      route: item.route,
      status: item.status,
      tone: statusTone(item.status),
    })),
  ];
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (selectedTab === 'tasks' && row.source !== 'Task') {
      return false;
    }
    if (selectedTab === 'validation' && row.source !== 'Validation') {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return [row.source, row.title, row.subtitle, row.detail, formatStatus(row.status)]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  });
  const attentionCount = rows.filter((row) => row.tone === 'danger' || row.tone === 'warning').length;

  const title = mode === 'work-queue' ? 'Work Queue' : 'Task Nodes and Templates';
  const eyebrow = mode === 'work-queue' ? 'Operations' : 'Task Operations';
  const description =
    mode === 'work-queue'
      ? 'A single operator queue for assigned remediation, validation cues, and applied-control follow-through.'
      : 'Legacy task-node and task-template routes now resolve into canonical applied-control work queues and remediation ownership.';

  return (
    <div className="space-y-6">
      <RegPageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <>
            <Link className="button-secondary" to="/applied-controls/kanban-mode">
              Open kanban mode
            </Link>
            <Link className="button-secondary" to="/applied-controls/flash-mode">
              Open flash mode
            </Link>
            <button className="button-primary" onClick={() => void refresh()} type="button">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
          </>
        }
        className="rounded-lg border border-[#ded8e4]"
      />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="metric-card">
          <div className="metric-label">Task queue</div>
          <div className="metric-value">{overview.tasks.length}</div>
          <div className="mt-2 text-xs text-[#62576a]">Applied-control items currently representing task-node style work.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Validation cues</div>
          <div className="metric-value">{overview.validationFlows.length}</div>
          <div className="mt-2 text-xs text-[#62576a]">Active validation signals that can turn into remediation tasks.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Needs attention</div>
          <div className="metric-value">{attentionCount}</div>
          <div className="mt-2 text-xs text-[#62576a]">Items currently pending review, validation, or remediation.</div>
        </div>
      </section>

      <RegTableShell>
        <RegTabs
          onSelect={(id) => {
            if (id === 'all' || id === 'tasks' || id === 'validation') {
              setSelectedTab(id);
            }
          }}
          tabs={[
            { id: 'all', label: 'All work', count: rows.length, active: selectedTab === 'all' },
            { id: 'tasks', label: 'Tasks', count: overview.tasks.length, active: selectedTab === 'tasks' },
            { id: 'validation', label: 'Validation', count: overview.validationFlows.length, active: selectedTab === 'validation' },
            { id: 'mapping', label: 'Mappings', count: overview.libraryOperations.length, to: '/requirement-mapping-sets' },
          ]}
        />
        <RegFilterBar>
          <label className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#62576a]" />
            <input
              className="input h-10 w-full pl-9"
              placeholder="Search work"
              onChange={(event) => setSearchQuery(event.target.value)}
              value={searchQuery}
              aria-label="Search work queue"
            />
          </label>
          <div className="text-sm text-[#6f6578] lg:ml-auto" aria-live="polite">
            {filteredRows.length} of {rows.length} items
          </div>
        </RegFilterBar>
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="bg-[#f7f4f9] text-xs uppercase tracking-normal text-[#6f6578]">
              <tr>
                <th className="w-36 px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Work item</th>
                <th className="w-48 px-4 py-3 font-semibold">Status</th>
                <th className="w-16 px-4 py-3 font-semibold" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ece7f0]">
              {filteredRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-[#6f6578]" colSpan={4}>
                    {rows.length === 0
                      ? 'No work-queue records are currently visible for this tenant.'
                      : 'No work items match the current search and tab.'}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr className="align-top transition hover:bg-[#fbf9fc]" key={row.id}>
                    <td className="px-4 py-4">
                      <RegStatusPill tone={row.source === 'Task' ? 'purple' : 'info'}>{row.source}</RegStatusPill>
                    </td>
                    <td className="px-4 py-4">
                      <Link className="font-semibold text-[#241232] hover:text-[#6f20c9]" to={row.route}>
                        {row.title}
                      </Link>
                      <div className="mt-1 text-xs text-[#6f6578]">{row.subtitle}</div>
                      <div className="mt-2 max-w-3xl text-sm leading-6 text-[#4f435c]">{row.detail}</div>
                    </td>
                    <td className="px-4 py-4">
                      <RegStatusPill tone={row.tone}>{formatStatus(row.status)}</RegStatusPill>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RegActionMenu
                        actions={[
                          { label: 'Open item', to: row.route },
                          { label: 'Open kanban', to: '/applied-controls/kanban-mode' },
                        ]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </RegTableShell>
    </div>
  );
}

export function LibraryMappingsControlPage() {
  const { overview, loading, error, refresh } = useOpsParityOverview();

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading library mappings...</div>;
  }

  if (error || !overview) {
    return <div className="notice-error">{error ?? 'Library mappings could not be loaded.'}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[#8b35e6]/0 via-[#8b35e6]/35 to-[#8b35e6]/0" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Mapping Operations</div>
            <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Library Mapping Surfaces</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
              Requirement mapping and sync-mapping semantics now land on canonical library and framework operations rather than a generic bridge page.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to="/libraries">
              Open libraries
            </Link>
            <Link className="button-secondary" to="/frameworks">
              Open frameworks
            </Link>
            <button className="button-primary" onClick={() => void refresh()} type="button">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Library packs</div>
          <div className="metric-value">{overview.libraryOperations.length}</div>
          <div className="mt-2 text-xs text-[#62576a]">Loaded library packs currently available for mapping and sync-oriented work.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Framework sources</div>
          <div className="metric-value">{overview.analytics.find((item) => item.id === 'frameworks')?.value ?? 0}</div>
          <div className="mt-2 text-xs text-[#62576a]">Governance sources currently available for requirement mapping.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Search index</div>
          <div className="metric-value">{overview.searchIndex.length}</div>
          <div className="mt-2 text-xs text-[#62576a]">Searchable canonical records available for mapping drill-down.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Tenant</div>
          <div className="metric-value text-lg">{overview.settings.tenantId}</div>
          <div className="mt-2 text-xs text-[#62576a]">Canonical workspace context for library and framework mapping operations.</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f1e7ff] text-[#5f1aa8]">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#241232]">Canonical library operations</h2>
              <p className="text-sm text-[#6f6578]">Library packs and mapping-adjacent sources currently visible in the canonical governance stack.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {overview.libraryOperations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#ded8e4] bg-[#f7f4f9] p-4 text-sm text-[#6f6578] md:col-span-2">
                No library mapping sources are currently visible for this tenant.
              </div>
            ) : (
              overview.libraryOperations.map((item) => (
                <Link
                  key={item.id}
                  className="rounded-lg border border-[#ded8e4] bg-[#fbf9fc] p-4 transition hover:border-[#b891f2] hover:bg-[#f7f2ff]"
                  to={item.route}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-[#241232]">{item.title}</div>
                      <div className="mt-1 text-sm text-[#6f6578]">{item.subtitle}</div>
                    </div>
                    <span className="status-pill-neutral">{item.status}</span>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-[#4f435c]">{item.detail}</div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#edf6ff] text-[#6f20c9]">
              <Shapes className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#241232]">Mapping discovery</h2>
              <p className="text-sm text-[#6f6578]">Searchable records that help operators move from mapping sets into concrete library and framework workspaces.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {overview.searchIndex.slice(0, 6).map((entry) => (
              <Link
                key={`${entry.section}-${entry.id}`}
                className="block rounded-lg border border-[#ded8e4] bg-[#fbf9fc] p-4 transition hover:border-[#b891f2] hover:bg-[#f7f2ff]"
                to={entry.route}
              >
                <div className="font-medium text-[#241232]">{entry.title}</div>
                <div className="mt-1 text-sm text-[#6f6578]">{entry.section}</div>
                <div className="mt-3 text-xs uppercase tracking-normal text-[#62576a]">
                  {entry.keywords.slice(0, 3).join(' · ')}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
