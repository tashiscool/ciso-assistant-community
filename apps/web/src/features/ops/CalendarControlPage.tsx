import { Link } from 'react-router-dom';
import { CalendarDays, RefreshCw, ShieldCheck, TimerReset } from 'lucide-react';
import { useOpsParityOverview } from './useOpsParityOverview';

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function CalendarControlPage() {
  const { overview, loading, error, refresh } = useOpsParityOverview();

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading operational calendar...</div>;
  }

  if (error || !overview) {
    return <div className="notice-error">{error ?? 'Operational calendar could not be loaded.'}</div>;
  }

  const nextEvent = overview.calendar[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-emerald-400/0 via-emerald-300/60 to-emerald-400/0" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Operational Timeline</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Calendar</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              The canonical operational calendar now combines live module lifecycle dates, manual assessment schedules,
              portal deadlines, and privacy obligations surfaced by the Worker.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to="/portal">
              Open portal
            </Link>
            <Link className="button-secondary" to="/privacy">
              Open privacy
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
          <div className="metric-label">Upcoming events</div>
          <div className="metric-value">{overview.calendar.length}</div>
          <div className="mt-2 text-xs text-slate-500">Module, assessment, portal, and privacy commitments currently visible in the tenant.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Next due</div>
          <div className="metric-value text-lg">{nextEvent ? formatDate(nextEvent.date) : 'None'}</div>
          <div className="mt-2 text-xs text-slate-500">Earliest dated module or operational milestone known to the Worker.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Portal load</div>
          <div className="metric-value">{overview.analytics.find((item) => item.id === 'portal')?.value ?? 0}</div>
          <div className="mt-2 text-xs text-slate-500">Assignments that can contribute external due dates and evidence pressure.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Processings</div>
          <div className="metric-value">{overview.analytics.find((item) => item.id === 'processings')?.value ?? 0}</div>
          <div className="mt-2 text-xs text-slate-500">Privacy registry activity that can generate rights-response timelines.</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
              <CalendarDays className="h-5 w-5" />
            </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Scheduled events</h2>
              <p className="text-sm text-slate-400">The canonical time-ordered queue of module milestones, assessment windows, portal deadlines, and privacy response dates.</p>
              </div>
          </div>
          <div className="mt-5 space-y-3">
            {overview.calendar.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm text-slate-400">
                No dated events are queued for this tenant yet.
              </div>
            ) : (
              overview.calendar.slice(0, 8).map((item) => (
                <Link
                  key={item.id}
                  className="block rounded-3xl border border-white/10 bg-slate-950/30 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                  to={item.route}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-400">{formatDate(item.date)}</div>
                    </div>
                    <span className="badge-neutral">Scheduled</span>
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
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Operational readiness</h2>
                <p className="text-sm text-slate-400">Quick-start completion influences whether dated work can actually be acted on cleanly.</p>
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

          <div className="panel-subtle">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
                <TimerReset className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Deadline context</h2>
                <p className="text-sm text-slate-400">Searchable module and workflow records that most often produce dated work in the canonical platform.</p>
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
        </div>
      </section>
    </div>
  );
}
