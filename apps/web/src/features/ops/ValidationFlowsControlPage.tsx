import { Link } from 'react-router-dom';
import { ClipboardCheck, RefreshCw, ShieldAlert } from 'lucide-react';
import { useOpsParityOverview } from './useOpsParityOverview';

export function ValidationFlowsControlPage() {
  const { overview, loading, error, refresh } = useOpsParityOverview();

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading validation flows...</div>;
  }

  if (error || !overview) {
    return <div className="notice-error">{error ?? 'Validation flows could not be loaded.'}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-amber-400/0 via-amber-300/60 to-amber-400/0" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Validation Control Room</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Validation Flows</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Validation now resolves into export verification and compliance exception handling surfaced directly from the canonical Worker-backed control plane.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to="/reports">
              Open reports
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
          <div className="metric-label">Validation flows</div>
          <div className="metric-value">{overview.validationFlows.length}</div>
          <div className="mt-2 text-xs text-slate-500">Active export and compliance validation signals in the tenant.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Exports</div>
          <div className="metric-value">{overview.backupRestore.exportsCount}</div>
          <div className="mt-2 text-xs text-slate-500">Generated outputs that can create downstream review pressure.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Assignments</div>
          <div className="metric-value">{overview.analytics.find((item) => item.id === 'portal')?.value ?? 0}</div>
          <div className="mt-2 text-xs text-slate-500">Portal activity that can compound review and remediation cadence.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Framework sources</div>
          <div className="metric-value">{overview.analytics.find((item) => item.id === 'frameworks')?.value ?? 0}</div>
          <div className="mt-2 text-xs text-slate-500">Framework-backed governance scope feeding compliance review work.</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Active validation items</h2>
              <p className="text-sm text-slate-400">Exports and compliance exception candidates currently demanding operator attention.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {overview.validationFlows.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm text-slate-400">
                No validation flows are active for this tenant right now.
              </div>
            ) : (
              overview.validationFlows.map((item) => (
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

        <div className="space-y-4">
          <div className="panel-subtle">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-400/10 text-rose-300">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Readiness dependencies</h2>
                <p className="text-sm text-slate-400">Validation is strongest when the core onboarding steps have already been completed.</p>
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
