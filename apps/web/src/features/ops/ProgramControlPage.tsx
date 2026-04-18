import { Link } from 'react-router-dom';
import { Compass, Layers3, RefreshCw, Sparkles } from 'lucide-react';
import { useOpsParityOverview } from './useOpsParityOverview';

export function ProgramControlPage() {
  const { overview, loading, error, refresh } = useOpsParityOverview();

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading program workbench...</div>;
  }

  if (error || !overview) {
    return <div className="notice-error">{error ?? 'Program workbench could not be loaded.'}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-violet-400/0 via-violet-300/60 to-violet-400/0" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Program Workbench</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Program Surfaces</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Recap, accreditation, preset, licensing, and program-style metadata routes now land on a canonical Worker-backed program workbench instead of a generic parity page.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to="/settings">
              Open settings
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
          <div className="metric-label">Program surfaces</div>
          <div className="metric-value">{overview.program.length}</div>
          <div className="mt-2 text-xs text-slate-500">Canonical program routes currently represented in the Worker-backed control room.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Auth strategy</div>
          <div className="metric-value text-lg capitalize">{overview.settings.authStrategy}</div>
          <div className="mt-2 text-xs text-slate-500">Runtime access mode shaping program and licensing semantics.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Tenant</div>
          <div className="metric-value text-lg">{overview.settings.tenantId}</div>
          <div className="mt-2 text-xs text-slate-500">Resolved workspace context for all recap-style program routes.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Quick-start complete</div>
          <div className="metric-value">
            {overview.quickStart.filter((step) => step.completed).length}/{overview.quickStart.length}
          </div>
          <div className="mt-2 text-xs text-slate-500">Program surfaces are most useful once the tenant readiness path is active.</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-300">
              <Layers3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Mapped program surfaces</h2>
              <p className="text-sm text-slate-400">The canonical pages now absorbing legacy recap, preset, accreditation, and licensing routes.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {overview.program.map((item) => (
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
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel-subtle">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Discovery paths</h2>
                <p className="text-sm text-slate-400">Search-index entries that most naturally lead operators into program-style views.</p>
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

          <div className="panel-subtle">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-fuchsia-400/10 text-fuchsia-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Readiness context</h2>
                <p className="text-sm text-slate-400">Program surfaces are anchored by the same tenant-readiness checkpoints as the rest of the canonical stack.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {overview.quickStart.map((step) => (
                <Link
                  key={step.id}
                  className="block rounded-3xl border border-white/10 bg-slate-950/30 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                  to={step.route}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{step.title}</div>
                      <div className="mt-1 text-sm text-slate-400">{step.detail}</div>
                    </div>
                    <span className={step.completed ? 'badge-positive' : 'badge-neutral'}>
                      {step.completed ? 'Complete' : 'Pending'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
