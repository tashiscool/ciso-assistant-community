import { Link } from 'react-router-dom';
import { BarChart3, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { useOpsParityOverview } from './useOpsParityOverview';

export function AnalyticsControlRoomPage() {
  const { overview, loading, error, refresh } = useOpsParityOverview();

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading workspace analytics...</div>;
  }

  if (error || !overview) {
    return <div className="notice-error">{error ?? 'Workspace analytics could not be loaded.'}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-400/0 via-cyan-300/60 to-cyan-400/0" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Workspace Analytics</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Analytics</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Review the operating metrics that show how the program, evidence, portal, and assurance work are moving across the workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to="/">
              Open home
            </Link>
            <Link className="button-secondary" to="/reports">
              Open reports
            </Link>
            <button className="button-primary" onClick={() => void refresh()} type="button">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overview.analytics.map((item) => (
          <div className="metric-card" key={item.id}>
            <div className="metric-label">{item.label}</div>
            <div className="metric-value">{item.value}</div>
            <div className="mt-2 text-xs text-slate-500">{item.detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Domain coverage</h2>
              <p className="text-sm text-slate-400">Counts across governance, risk, privacy, portal, and advanced-risk surfaces.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {overview.analytics.map((item) => (
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4" key={item.id}>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{item.value}</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel-subtle">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Validation pressure</h2>
                <p className="text-sm text-slate-400">Exports and compliance exceptions currently shaping operator attention.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {overview.validationFlows.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm text-slate-400">
                  No validation flows are currently active for this tenant.
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

          <div className="panel-subtle">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-fuchsia-400/10 text-fuchsia-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Operational replay</h2>
                <p className="text-sm text-slate-400">Backup and import activity available to rehydrate or inspect tenant state.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Exports</div>
                <div className="mt-2 text-2xl font-semibold text-white">{overview.backupRestore.exportsCount}</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">{overview.backupRestore.latestExport ?? 'No export yet'}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Imports</div>
                <div className="mt-2 text-2xl font-semibold text-white">{overview.backupRestore.importsCount}</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">{overview.backupRestore.latestImport ?? 'No import yet'}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
