import { useEffect, useState } from 'react';
import { RegStatusPill } from '../../components/regovise/PagePrimitives';
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
        <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Queue-Driven Evidence Jobs</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#4f435c]">
          Review evidence collection activity, confirm successful runs, and see whether artifacts
          were produced for each job.
        </p>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="panel overflow-hidden p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#ded8e4] bg-white text-xs uppercase tracking-[0.18em] text-[#62576a]">
            <tr>
              <th className="px-4 py-3">Job</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Artifacts</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-t border-[#eeeaf2] align-top">
                <td className="px-4 py-4">
                  <div className="font-mono text-xs text-[#6d28d9]">{job.id}</div>
                  <div className="mt-2 text-xs text-[#62576a]">
                    Scheduled {job.scheduledFor}
                    {job.finishedAt ? `, finished ${job.finishedAt}` : ''}
                  </div>
                </td>
                <td className="px-4 py-4 text-[#241232]">{job.sourceName}</td>
                <td className="px-4 py-4">
                  <RegStatusPill tone={job.status === 'success' ? 'success' : job.status === 'failed' ? 'danger' : 'neutral'}>
                    {job.status}
                  </RegStatusPill>
                  {job.statusDetail && (
                    <div className="mt-2 max-w-md text-xs leading-5 text-[#6f6578]">
                      {job.statusDetail}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-[#4f435c]">{job.artifactCount}</td>
              </tr>
            ))}
            {!loading && jobs.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-[#6f6578]" colSpan={4}>
                  No evidence jobs found for tenant <span className="font-mono">{identity.tenantId}</span>.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td className="px-4 py-8 text-center text-[#6f6578]" colSpan={4}>
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
