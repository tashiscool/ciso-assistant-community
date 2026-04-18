import { useEffect, useState } from 'react';
import { Activity, Database, HardDrive, Workflow } from 'lucide-react';
import { getSetupLogsUtilization } from './api';
import type { SetupLogsUtilizationSnapshot } from './types';

const icons = [Database, HardDrive, Workflow, Activity];

export function LogsUtilizationPage() {
  const [snapshot, setSnapshot] = useState<SetupLogsUtilizationSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        setSnapshot(await getSetupLogsUtilization());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load logs and utilization.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading logs and utilization...</div>;
  }

  if (error || !snapshot) {
    return <div className="notice-error">{error ?? 'Logs and utilization could not be loaded.'}</div>;
  }

  const metricCards = [
    ['D1 Metadata', snapshot.metrics.d1Metadata],
    ['R2 Objects', snapshot.metrics.r2Objects],
    ['Queue Backlog', snapshot.metrics.queueBacklog],
    ['DO Sessions', snapshot.metrics.durableObjectSessions],
  ];

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Setup</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Logs and Utilization</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Review tenant telemetry across storage, async workload posture, login activity, and operational error volume
          from the canonical Worker control plane.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(([label, value], index) => {
          const Icon = icons[index] ?? Activity;
          return (
            <div className="metric-card" key={label}>
              <div className="flex items-center justify-between">
                <div className="metric-label">{label}</div>
                <Icon className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="metric-value mt-3 text-lg">{value}</div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="panel-subtle">
          <h2 className="text-lg font-semibold text-white">Volume summary</h2>
          <div className="mt-5 grid gap-3">
            <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <div className="label">Monthly errors</div>
              <div className="mt-2 text-2xl font-semibold text-white">{snapshot.metrics.monthlyErrorVolume}</div>
              <div className="mt-2 text-sm text-slate-400">Aggregated issues from imports, exports, and notification failures.</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <div className="label">Monthly logins</div>
              <div className="mt-2 text-2xl font-semibold text-white">{snapshot.metrics.monthlyLogins}</div>
              <div className="mt-2 text-sm text-slate-400">Recent session volume for the tenant-scoped workspace.</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <div className="label">System events</div>
              <div className="mt-2 text-2xl font-semibold text-white">{snapshot.metrics.systemEvents}</div>
              <div className="mt-2 text-sm text-slate-400">Combined export, import, and notification workload count.</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <div className="label">Active users</div>
              <div className="mt-2 text-2xl font-semibold text-white">{snapshot.metrics.activeUsers}</div>
              <div className="mt-2 text-sm text-slate-400">Distinct users seen in recent session history.</div>
            </div>
          </div>
        </div>

        <section className="panel overflow-hidden p-0">
          <div className="border-b border-white/10 px-6 py-4">
            <div className="eyebrow">Operational error detail</div>
            <p className="mt-1 text-sm text-slate-400">Current warning and backlog signals derived from canonical worker tables.</p>
          </div>
          <div className="divide-y divide-white/6">
            {snapshot.records.errorRows.map((row, index) => (
              <div className="px-6 py-4" key={`${row.system}:${index}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-medium text-white">{row.system}</div>
                    <div className="mt-1 text-sm text-slate-300">{row.summary}</div>
                    <div className="mt-2 text-xs text-slate-500">{new Date(row.timestamp).toLocaleString()}</div>
                  </div>
                  <span className={row.count > 0 ? 'badge-neutral' : 'badge-positive'}>{row.count}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="panel overflow-hidden p-0">
        <div className="border-b border-white/10 px-6 py-4">
          <div className="eyebrow">Recent access</div>
          <p className="mt-1 text-sm text-slate-400">Recent session activity resolved from Worker-backed session state.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/8 text-sm">
            <thead className="bg-slate-950/30 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Login time</th>
                <th className="px-6 py-4">Active</th>
                <th className="px-6 py-4">Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {snapshot.records.accessLogs.map((row, index) => (
                <tr key={`${row.user}:${index}`}>
                  <td className="px-6 py-4 text-slate-200">{row.user}</td>
                  <td className="px-6 py-4 text-slate-300">{new Date(row.loginTime).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={row.active === 'Yes' ? 'badge-positive' : 'badge-neutral'}>{row.active}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={row.admin === 'Yes' ? 'badge-neutral' : 'badge-positive'}>{row.admin}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
