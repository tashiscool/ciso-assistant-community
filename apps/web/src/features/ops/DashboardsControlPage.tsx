import { Link } from 'react-router-dom';
import { LayoutDashboard, RefreshCw, ShieldCheck, Telescope } from 'lucide-react';
import { useOpsParityOverview } from './useOpsParityOverview';

export function DashboardsControlPage() {
  const { overview, loading, error, refresh } = useOpsParityOverview();

  if (loading) {
    return <div className="panel p-6 text-sm text-[#51465e]">Loading dashboard surfaces...</div>;
  }

  if (error || !overview) {
    return <div className="notice-error">{error ?? 'Dashboard surfaces could not be loaded.'}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[#8b35e6]/0 via-[#8b35e6]/35 to-[#8b35e6]/0" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Dashboard Surfaces</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#241232]">Dashboards</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#51465e]">
              Dashboard and recap-style views now resolve into canonical Worker-backed metric surfaces rather than a generic parity bridge.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to="/">
              Open main dashboard
            </Link>
            <Link className="button-secondary" to="/analytics">
              Open analytics
            </Link>
            <button className="button-primary" onClick={() => void refresh()} type="button">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overview.analytics.slice(0, 4).map((item) => (
          <div className="metric-card" key={item.id}>
            <div className="metric-label">{item.label}</div>
            <div className="metric-value">{item.value}</div>
            <div className="mt-2 text-xs text-[#62576a]">{item.detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f3e9ff] text-[#7a2ed6]">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#241232]">Dashboard metrics</h2>
              <p className="text-sm text-[#6f6578]">Canonical metrics currently represented as dashboard-ready surfaces.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {overview.dashboards.map((item) => (
              <Link
                key={item.id}
                className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4 transition hover:border-[#8b35e6]/30 hover:bg-[#f8f3ff]"
                to={item.route}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-[#241232]">{item.title}</div>
                    <div className="mt-1 text-sm text-[#6f6578]">{item.subtitle}</div>
                  </div>
                  <span className="status-pill-neutral">{item.status}</span>
                </div>
                <div className="mt-3 text-sm leading-6 text-[#51465e]">{item.detail}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel-subtle">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e9f9ef] text-[#126b36]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#241232]">Validation-linked recap</h2>
                <p className="text-sm text-[#6f6578]">The strongest recap surfaces today are still tied to validation and exception activity.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {overview.validationFlows.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[#ded8e4] bg-[#fbf9fc] p-4 text-sm text-[#6f6578]">
                  No validation-linked recap items are active for this tenant.
                </div>
              ) : (
                overview.validationFlows.slice(0, 4).map((item) => (
                  <Link
                    key={item.id}
                    className="block rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4 transition hover:border-[#8b35e6]/30 hover:bg-[#f8f3ff]"
                    to={item.route}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-[#241232]">{item.title}</div>
                        <div className="mt-1 text-sm text-[#6f6578]">{item.subtitle}</div>
                      </div>
                      <span className="status-pill-neutral">{item.status}</span>
                    </div>
                    <div className="mt-3 text-sm leading-6 text-[#51465e]">{item.detail}</div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="panel-subtle">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-fuchsia-400/10 text-fuchsia-300">
                <Telescope className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#241232]">Diagnostic overlays</h2>
                <p className="text-sm text-[#6f6578]">X-ray signals help explain what the dashboard layer is currently seeing.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {overview.xRays.map((item) => (
                <Link
                  key={item.id}
                  className="block rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4 transition hover:border-[#8b35e6]/30 hover:bg-[#f8f3ff]"
                  to={item.route}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-[#241232]">{item.title}</div>
                      <div className="mt-1 text-sm text-[#6f6578]">{item.subtitle}</div>
                    </div>
                    <span className="status-pill-neutral">{item.status}</span>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-[#51465e]">{item.detail}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
