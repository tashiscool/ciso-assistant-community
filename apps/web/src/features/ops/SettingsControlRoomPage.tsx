import { Link } from 'react-router-dom';
import { RefreshCw, Shield, UserCog, Waypoints } from 'lucide-react';
import { useOpsParityOverview } from './useOpsParityOverview';

function formatUserId(value: string | null) {
  return value ?? 'Unresolved';
}

export function SettingsControlRoomPage() {
  const { overview, loading, error, refresh } = useOpsParityOverview();

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading settings control room...</div>;
  }

  if (error || !overview) {
    return <div className="notice-error">{error ?? 'Settings control room could not be loaded.'}</div>;
  }

  const completedSteps = overview.quickStart.filter((step) => step.completed).length;

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-400/0 via-cyan-300/60 to-cyan-400/0" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Settings Control Room</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Settings</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Workspace identity, authentication strategy, and environment posture are now surfaced through the
              canonical Worker control plane instead of a generic parity page.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to="/workspace/me">
              Open my access
            </Link>
            <Link className="button-secondary" to="/workspace/access">
              Open access control
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
          <div className="metric-label">Tenant</div>
          <div className="metric-value text-lg">{overview.settings.tenantId}</div>
          <div className="mt-2 text-xs text-slate-500">Resolved tenant context for the current workspace session.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Auth Strategy</div>
          <div className="metric-value text-lg capitalize">{overview.settings.authStrategy}</div>
          <div className="mt-2 text-xs text-slate-500">Server-resolved authentication mode protecting the app.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">App Environment</div>
          <div className="metric-value text-lg uppercase">{overview.settings.appEnv}</div>
          <div className="mt-2 text-xs text-slate-500">Worker runtime profile currently serving this tenant.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Readiness</div>
          <div className="metric-value text-lg">
            {completedSteps}/{overview.quickStart.length}
          </div>
          <div className="mt-2 text-xs text-slate-500">Canonical quick-start milestones completed in this tenant.</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Identity and runtime</h2>
              <p className="text-sm text-slate-400">Who the Worker resolved, how access is enforced, and where this tenant is running.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">User principal</div>
              <div className="mt-2 text-sm font-medium text-white">{formatUserId(overview.settings.userId)}</div>
              <div className="mt-2 text-xs leading-5 text-slate-400">Current authenticated principal resolved by the edge session.</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Operational mode</div>
              <div className="mt-2 text-sm font-medium text-white capitalize">{overview.settings.authStrategy}</div>
              <div className="mt-2 text-xs leading-5 text-slate-400">Settings, licensing, and runtime semantics follow this server-side strategy.</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Environment</div>
              <div className="mt-2 text-sm font-medium text-white uppercase">{overview.settings.appEnv}</div>
              <div className="mt-2 text-xs leading-5 text-slate-400">Useful when validating production, preview, or local parity behavior.</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Route coverage</div>
              <div className="mt-2 text-sm font-medium text-white">{overview.program.length} mapped surfaces</div>
              <div className="mt-2 text-xs leading-5 text-slate-400">Legacy settings and licensing routes consolidated into canonical workspaces.</div>
            </div>
          </div>
        </div>

        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Readiness checklist</h2>
              <p className="text-sm text-slate-400">Operational steps that determine whether the workspace is ready for full use.</p>
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
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-fuchsia-400/10 text-fuchsia-300">
              <Waypoints className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Mapped settings surfaces</h2>
              <p className="text-sm text-slate-400">Canonical destinations that now absorb legacy settings, profile, and licensing behavior.</p>
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

        <div className="panel-subtle">
          <h2 className="text-lg font-semibold text-white">Searchable admin context</h2>
          <p className="mt-1 text-sm text-slate-400">
            Canonical records that can be discovered from the Worker-backed search index while working through settings and access changes.
          </p>
          <div className="mt-5 space-y-3">
            {overview.searchIndex.slice(0, 6).map((entry) => (
              <Link
                key={`${entry.section}-${entry.id}`}
                className="block rounded-3xl border border-white/10 bg-slate-950/30 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                to={entry.route}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{entry.title}</div>
                    <div className="mt-1 text-sm text-slate-400">{entry.section}</div>
                  </div>
                  <span className="badge-neutral">{entry.subtitle}</span>
                </div>
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
