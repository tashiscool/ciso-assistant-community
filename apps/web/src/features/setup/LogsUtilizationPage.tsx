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
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading logs and utilization...</div>;
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
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#241232]">Logs and Utilization</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
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
                <Icon className="h-4 w-4 text-[#7a3ccf]" />
              </div>
              <div className="metric-value mt-3 text-lg">{value}</div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="panel-subtle">
          <h2 className="text-lg font-semibold text-[#241232]">Volume summary</h2>
          <div className="mt-5 grid gap-3">
            <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="label">Monthly errors</div>
              <div className="mt-2 text-2xl font-semibold text-[#241232]">{snapshot.metrics.monthlyErrorVolume}</div>
              <div className="mt-2 text-sm text-[#6f6578]">Aggregated issues from imports, exports, and notification failures.</div>
            </div>
            <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="label">Monthly logins</div>
              <div className="mt-2 text-2xl font-semibold text-[#241232]">{snapshot.metrics.monthlyLogins}</div>
              <div className="mt-2 text-sm text-[#6f6578]">Recent session volume for the tenant-scoped workspace.</div>
            </div>
            <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="label">System events</div>
              <div className="mt-2 text-2xl font-semibold text-[#241232]">{snapshot.metrics.systemEvents}</div>
              <div className="mt-2 text-sm text-[#6f6578]">Combined export, import, and notification workload count.</div>
            </div>
            <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="label">Active users</div>
              <div className="mt-2 text-2xl font-semibold text-[#241232]">{snapshot.metrics.activeUsers}</div>
              <div className="mt-2 text-sm text-[#6f6578]">Distinct users seen in recent session history.</div>
            </div>
          </div>
        </div>

        <section className="panel overflow-hidden p-0">
          <div className="border-b border-[#ded8e4] px-6 py-4">
            <div className="eyebrow">Operational error detail</div>
            <p className="mt-1 text-sm text-[#6f6578]">Current warning and backlog signals derived from canonical worker tables.</p>
          </div>
          <div className="divide-y divide-[#ded8e4]">
            {snapshot.records.errorRows.map((row, index) => (
              <div className="px-6 py-4" key={`${row.system}:${index}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-medium text-[#241232]">{row.system}</div>
                    <div className="mt-1 text-sm text-[#4f435c]">{row.summary}</div>
                    <div className="mt-2 text-xs text-[#62576a]">{new Date(row.timestamp).toLocaleString()}</div>
                  </div>
                  <span className={row.count > 0 ? 'status-pill-neutral' : 'status-pill-positive'}>{row.count}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="panel overflow-hidden p-0">
        <div className="border-b border-[#ded8e4] px-6 py-4">
          <div className="eyebrow">Recent access</div>
          <p className="mt-1 text-sm text-[#6f6578]">Recent session activity resolved from Worker-backed session state.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#ded8e4] text-sm">
            <thead className="bg-[#fbf9fc] text-left text-xs uppercase tracking-[0.18em] text-[#62576a]">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Login time</th>
                <th className="px-6 py-4">Active</th>
                <th className="px-6 py-4">Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ded8e4]">
              {snapshot.records.accessLogs.map((row, index) => (
                <tr key={`${row.user}:${index}`}>
                  <td className="px-6 py-4 text-[#38254a]">{row.user}</td>
                  <td className="px-6 py-4 text-[#4f435c]">{new Date(row.loginTime).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={row.active === 'Yes' ? 'status-pill-positive' : 'status-pill-neutral'}>{row.active}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={row.admin === 'Yes' ? 'status-pill-neutral' : 'status-pill-positive'}>{row.admin}</span>
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
