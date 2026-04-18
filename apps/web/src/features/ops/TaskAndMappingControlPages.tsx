import { Link } from 'react-router-dom';
import { BookOpen, RefreshCw, Shapes, Workflow } from 'lucide-react';
import { useOpsParityOverview } from './useOpsParityOverview';

export function TaskOperationsControlPage() {
  const { overview, loading, error, refresh } = useOpsParityOverview();

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading task operations...</div>;
  }

  if (error || !overview) {
    return <div className="notice-error">{error ?? 'Task operations could not be loaded.'}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-400/0 via-cyan-300/60 to-cyan-400/0" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Task Operations</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Task Nodes and Templates</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Legacy task-node and task-template semantics now resolve into canonical applied-control work queues and remediation ownership.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Task queue</div>
          <div className="metric-value">{overview.tasks.length}</div>
          <div className="mt-2 text-xs text-slate-500">Applied-control items currently representing task-node style work.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Validation cues</div>
          <div className="metric-value">{overview.validationFlows.length}</div>
          <div className="mt-2 text-xs text-slate-500">Active validation signals that can turn into remediation tasks.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Search index</div>
          <div className="metric-value">{overview.searchIndex.length}</div>
          <div className="mt-2 text-xs text-slate-500">Searchable records available for drilling into task-producing surfaces.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Tenant</div>
          <div className="metric-value text-lg">{overview.settings.tenantId}</div>
          <div className="mt-2 text-xs text-slate-500">Canonical workspace context for remediation and action-plan ownership.</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
              <Workflow className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Canonical task queue</h2>
              <p className="text-sm text-slate-400">Applied controls currently standing in for task nodes and templates in the canonical stack.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {overview.tasks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm text-slate-400 md:col-span-2">
                No task-node style records are currently visible for this tenant.
              </div>
            ) : (
              overview.tasks.map((item) => (
                <Link
                  key={item.id}
                  className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                  to={item.route}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-400">{item.subtitle}</div>
                    </div>
                    <span className="badge-neutral">{item.status}</span>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-300">{item.detail}</div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
              <Shapes className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Validation-driven follow-through</h2>
              <p className="text-sm text-slate-400">Validation and exception signals that most often create or reprioritize task work.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {overview.validationFlows.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm text-slate-400">
                No validation-linked task pressure is active for this tenant.
              </div>
            ) : (
              overview.validationFlows.slice(0, 5).map((item) => (
                <Link
                  key={item.id}
                  className="block rounded-3xl border border-white/10 bg-slate-950/30 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                  to={item.route}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-400">{item.subtitle}</div>
                    </div>
                    <span className="badge-neutral">{item.status}</span>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-300">{item.detail}</div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export function LibraryMappingsControlPage() {
  const { overview, loading, error, refresh } = useOpsParityOverview();

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading library mappings...</div>;
  }

  if (error || !overview) {
    return <div className="notice-error">{error ?? 'Library mappings could not be loaded.'}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-indigo-400/0 via-indigo-300/60 to-indigo-400/0" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Mapping Operations</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Library Mapping Surfaces</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
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
          <div className="mt-2 text-xs text-slate-500">Loaded library packs currently available for mapping and sync-oriented work.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Framework sources</div>
          <div className="metric-value">{overview.analytics.find((item) => item.id === 'frameworks')?.value ?? 0}</div>
          <div className="mt-2 text-xs text-slate-500">Governance sources currently available for requirement mapping.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Search index</div>
          <div className="metric-value">{overview.searchIndex.length}</div>
          <div className="mt-2 text-xs text-slate-500">Searchable canonical records available for mapping drill-down.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Tenant</div>
          <div className="metric-value text-lg">{overview.settings.tenantId}</div>
          <div className="mt-2 text-xs text-slate-500">Canonical workspace context for library and framework mapping operations.</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-400/10 text-indigo-300">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Canonical library operations</h2>
              <p className="text-sm text-slate-400">Library packs and mapping-adjacent sources currently visible in the canonical governance stack.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {overview.libraryOperations.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm text-slate-400 md:col-span-2">
                No library mapping sources are currently visible for this tenant.
              </div>
            ) : (
              overview.libraryOperations.map((item) => (
                <Link
                  key={item.id}
                  className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                  to={item.route}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-400">{item.subtitle}</div>
                    </div>
                    <span className="badge-neutral">{item.status}</span>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-300">{item.detail}</div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
              <Shapes className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Mapping discovery</h2>
              <p className="text-sm text-slate-400">Searchable records that help operators move from mapping sets into concrete library and framework workspaces.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {overview.searchIndex.slice(0, 6).map((entry) => (
              <Link
                key={`${entry.section}-${entry.id}`}
                className="block rounded-3xl border border-white/10 bg-slate-950/30 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                to={entry.route}
              >
                <div className="font-medium text-white">{entry.title}</div>
                <div className="mt-1 text-sm text-slate-400">{entry.section}</div>
                <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
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
