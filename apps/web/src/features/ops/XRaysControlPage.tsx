import { Link } from 'react-router-dom';
import { Activity, CalendarDays, RefreshCw, ShieldAlert, Telescope } from 'lucide-react';
import { useOpsParityOverview } from './useOpsParityOverview';

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function XRaysControlPage() {
  const { overview, loading, error, refresh } = useOpsParityOverview();

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading runtime x-rays...</div>;
  }

  if (error || !overview) {
    return <div className="notice-error">{error ?? 'Runtime x-rays could not be loaded.'}</div>;
  }

  const highSignal = overview.analytics.slice(0, 4);

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-emerald-400/0 via-emerald-300/60 to-emerald-400/0" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Runtime Diagnostics</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">X-Rays</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Operational diagnostics, validation flows, and schedule pressure are surfaced from the Worker-backed control plane so we can inspect canonical runtime posture instead of a static bridge page.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to="/settings">
              Open settings
            </Link>
            <Link className="button-secondary" to="/workspace/me">
              Open my access
            </Link>
            <button className="button-primary" onClick={() => void refresh()} type="button">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {highSignal.map((item) => (
          <div className="metric-card" key={item.id}>
            <div className="metric-label">{item.label}</div>
            <div className="metric-value">{item.value}</div>
            <div className="mt-2 text-xs text-slate-500">{item.detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
              <Telescope className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Core x-ray signals</h2>
              <p className="text-sm text-slate-400">Runtime, tenant, and auth facts resolved directly by the Worker.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {overview.xRays.map((item) => (
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
            ))}
          </div>
        </div>

        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Validation flows</h2>
              <p className="text-sm text-slate-400">Exports and compliance exceptions that currently make up the strongest validation pressure on the tenant.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {overview.validationFlows.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm text-slate-400">
                No validation flows are active yet for this tenant.
              </div>
            ) : (
              overview.validationFlows.slice(0, 8).map((item) => (
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

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Upcoming operational dates</h2>
              <p className="text-sm text-slate-400">Portal and privacy deadlines that shape near-term operational posture.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {overview.calendar.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm text-slate-400">
                No dated events are currently queued for this tenant.
              </div>
            ) : (
              overview.calendar.slice(0, 6).map((item) => (
                <Link
                  key={item.id}
                  className="block rounded-3xl border border-white/10 bg-slate-950/30 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                  to={item.route}
                >
                  <div className="font-medium text-white">{item.title}</div>
                  <div className="mt-1 text-sm text-slate-400">{formatDate(item.date)}</div>
                  <div className="mt-3 text-sm leading-6 text-slate-300">{item.detail}</div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-fuchsia-400/10 text-fuchsia-300">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Backup and replay posture</h2>
              <p className="text-sm text-slate-400">Export and import history currently anchoring replay and restore confidence.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Exports</div>
              <div className="mt-2 text-2xl font-semibold text-white">{overview.backupRestore.exportsCount}</div>
              <div className="mt-2 text-xs leading-5 text-slate-400">{overview.backupRestore.latestExport ?? 'No export generated yet'}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Imports</div>
              <div className="mt-2 text-2xl font-semibold text-white">{overview.backupRestore.importsCount}</div>
              <div className="mt-2 text-xs leading-5 text-slate-400">{overview.backupRestore.latestImport ?? 'No import replay captured yet'}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
