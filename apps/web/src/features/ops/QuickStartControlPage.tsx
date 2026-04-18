import { Link } from 'react-router-dom';
import { ArrowRight, Compass, RefreshCw, Rocket } from 'lucide-react';
import { useOpsParityOverview } from './useOpsParityOverview';

export function QuickStartControlPage() {
  const { overview, loading, error, refresh } = useOpsParityOverview();

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading quick-start workspace...</div>;
  }

  if (error || !overview) {
    return <div className="notice-error">{error ?? 'Quick-start workspace could not be loaded.'}</div>;
  }

  const completed = overview.quickStart.filter((step) => step.completed).length;

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-amber-400/0 via-amber-300/60 to-amber-400/0" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Canonical Onboarding</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Quick Start</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Quick start is now a live canonical readiness path driven by tenant data in the Worker rather than a static onboarding bridge page.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to="/workspace/access">
              Open workspace access
            </Link>
            <Link className="button-secondary" to="/assessments">
              Open assessments
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
          <div className="metric-label">Completed steps</div>
          <div className="metric-value">{completed}</div>
          <div className="mt-2 text-xs text-slate-500">Readiness milestones already satisfied in this tenant.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Remaining steps</div>
          <div className="metric-value">{overview.quickStart.length - completed}</div>
          <div className="mt-2 text-xs text-slate-500">Next actions still needed to fully light up the workspace.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Framework sources</div>
          <div className="metric-value">{overview.analytics.find((item) => item.id === 'frameworks')?.value ?? 0}</div>
          <div className="mt-2 text-xs text-slate-500">Governance sources available for control and policy work.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Portal assignments</div>
          <div className="metric-value">{overview.analytics.find((item) => item.id === 'portal')?.value ?? 0}</div>
          <div className="mt-2 text-xs text-slate-500">External collaboration workflows already activated for this tenant.</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Readiness path</h2>
              <p className="text-sm text-slate-400">The concrete sequence for moving a tenant from initial setup into active governance and risk operations.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {overview.quickStart.map((step, index) => (
              <Link
                key={step.id}
                className="block rounded-3xl border border-white/10 bg-slate-950/30 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                to={step.route}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-sm font-semibold text-slate-300">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-white">{step.title}</div>
                        <div className="mt-1 text-sm text-slate-400">{step.detail}</div>
                      </div>
                      <span className={step.completed ? 'badge-positive' : 'badge-neutral'}>
                        {step.completed ? 'Complete' : 'Pending'}
                      </span>
                    </div>
                    <div className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-cyan-300/80">
                      Open workspace
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
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
                <h2 className="text-lg font-semibold text-white">Suggested next destinations</h2>
                <p className="text-sm text-slate-400">Search-index entries that help move the tenant from setup into sustained operations.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {overview.searchIndex.slice(0, 5).map((entry) => (
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
            <h2 className="text-lg font-semibold text-white">Operational activation</h2>
            <p className="mt-1 text-sm text-slate-400">Once onboarding is underway, these counts show how quickly the tenant is moving into live use.</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {overview.analytics.slice(0, 4).map((item) => (
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4" key={item.id}>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{item.value}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
