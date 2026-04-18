import { useEffect, useState } from 'react';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';

type EvidenceJob = {
  id: string;
  sourceId: string;
  sourceName: string;
  scheduledFor: string;
  startedAt: string | null;
  finishedAt: string | null;
  status: string;
  statusDetail: string | null;
  artifactCount: number;
};

const client = new ApiClient();

export function EvidenceJobsPage() {
  const { identity } = useEdgeIdentity();
  const [jobs, setJobs] = useState<EvidenceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await client.get<{ data: EvidenceJob[] }>('/evidence/jobs');
        setJobs(response.data);
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
        <div className="eyebrow">Evidence</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Queue-Driven Evidence Jobs</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          Review evidence collection activity, confirm successful runs, and see whether artifacts
          were produced for each job.
        </p>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="panel overflow-hidden p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Job</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Artifacts</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-t border-white/5 align-top">
                <td className="px-4 py-4">
                  <div className="font-mono text-xs text-cyan-200">{job.id}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    Scheduled {job.scheduledFor}
                    {job.finishedAt ? `, finished ${job.finishedAt}` : ''}
                  </div>
                </td>
                <td className="px-4 py-4 text-white">{job.sourceName}</td>
                <td className="px-4 py-4">
                  <span
                    className={
                      job.status === 'success'
                        ? 'badge-success'
                        : job.status === 'failed'
                          ? 'badge-danger'
                          : 'badge-neutral'
                    }
                  >
                    {job.status}
                  </span>
                  {job.statusDetail && (
                    <div className="mt-2 max-w-md text-xs leading-5 text-slate-400">
                      {job.statusDetail}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-slate-300">{job.artifactCount}</td>
              </tr>
            ))}
            {!loading && jobs.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={4}>
                  No evidence jobs found for tenant <span className="font-mono">{identity.tenantId}</span>.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={4}>
                  Loading evidence jobs...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
