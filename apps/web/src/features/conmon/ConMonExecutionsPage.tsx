import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';

type ConMonExecution = {
  id: string;
  profileName: string;
  status: string;
  statusDetail: string | null;
  startedAt: string;
  finishedAt: string | null;
  metrics:
    | {
        controlsChecked?: number;
        openFindings?: number;
        exceptionsReviewed?: number;
      }
    | null;
};

const client = new ApiClient();

export function ConMonExecutionsPage() {
  const { identity } = useEdgeIdentity();
  const [executions, setExecutions] = useState<ConMonExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await client.get<{ data: ConMonExecution[] }>('/conmon/executions');
        setExecutions(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, [identity.tenantId, identity.userId]);

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">ConMon</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Queue-Driven Executions</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          Review recent monitoring runs, their outcomes, and the metrics they produced.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Link className="panel-subtle transition hover:border-cyan-300/30" to="/assurance/evidence">
          <div className="eyebrow">Assurance</div>
          <div className="mt-2 text-lg font-semibold text-white">Inspect evidence-backed reasonableness</div>
          <div className="mt-2 text-sm leading-6 text-slate-400">
            Open the assurance explorer to compare recent ConMon posture with normalized evidence, gaps, and policy rollups.
          </div>
        </Link>
        <Link className="panel-subtle transition hover:border-cyan-300/30" to="/assurance/packages">
          <div className="eyebrow">Assurance</div>
          <div className="mt-2 text-lg font-semibold text-white">Review package reconciliation</div>
          <div className="mt-2 text-sm leading-6 text-slate-400">
            Validate the latest package-level reconciliation results before downstream export or human review handoff.
          </div>
        </Link>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="panel overflow-hidden p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Execution</th>
              <th className="px-4 py-3">Profile</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Metrics</th>
            </tr>
          </thead>
          <tbody>
            {executions.map((execution) => (
              <tr key={execution.id} className="border-t border-white/5 align-top">
                <td className="px-4 py-4">
                  <div className="font-mono text-xs text-cyan-200">{execution.id}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    Started {execution.startedAt}
                    {execution.finishedAt ? `, finished ${execution.finishedAt}` : ''}
                  </div>
                </td>
                <td className="px-4 py-4 text-white">{execution.profileName}</td>
                <td className="px-4 py-4">
                  <span
                    className={
                      execution.status === 'success'
                        ? 'badge-success'
                        : execution.status === 'failed'
                          ? 'badge-danger'
                          : 'badge-neutral'
                    }
                  >
                    {execution.status}
                  </span>
                  {execution.statusDetail && (
                    <div className="mt-2 max-w-md text-xs leading-5 text-slate-400">
                      {execution.statusDetail}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-slate-300">
                  {execution.metrics ? (
                    <div className="space-y-1">
                      <div>Controls checked: {execution.metrics.controlsChecked ?? 0}</div>
                      <div>Open findings: {execution.metrics.openFindings ?? 0}</div>
                      <div>Exceptions reviewed: {execution.metrics.exceptionsReviewed ?? 0}</div>
                    </div>
                  ) : (
                    <span className="text-slate-500">No metrics yet</span>
                  )}
                </td>
              </tr>
            ))}
            {!loading && executions.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={4}>
                  No ConMon executions found for tenant <span className="font-mono">{identity.tenantId}</span>.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={4}>
                  Loading executions...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
