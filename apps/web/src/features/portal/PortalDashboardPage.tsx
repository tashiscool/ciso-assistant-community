import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RegStatusPill } from '../../components/regovise/PagePrimitives';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { PortalAssignment } from './types';

const client = new ApiClient();

type PillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

function statusTone(value: string | null | undefined): PillTone {
  const normalized = (value ?? '').toLowerCase();
  if (['submitted', 'closed', 'complete', 'completed', 'accepted'].includes(normalized)) {
    return 'success';
  }
  if (['open', 'draft', 'pending', 'in_progress'].includes(normalized)) {
    return 'warning';
  }
  if (['rejected', 'expired', 'overdue'].includes(normalized)) {
    return 'danger';
  }
  return 'neutral';
}

export function PortalDashboardPage() {
  const { identity } = useEdgeIdentity();
  const [assignments, setAssignments] = useState<PortalAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAssignments() {
    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{ data: PortalAssignment[] }>('/ops/portal/assignments');
      setAssignments(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAssignments();
  }, [identity.tenantId, identity.userId]);

  const groupedAssignments = useMemo(() => {
    return assignments.reduce<Record<string, PortalAssignment[]>>((acc, item) => {
      acc[item.folderName] = [...(acc[item.folderName] ?? []), item];
      return acc;
    }, {});
  }, [assignments]);

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading auditee portal...</div>;
  }

  return (
    <div className="min-w-0 space-y-6">
      <section className="panel">
        <div className="eyebrow">Portal</div>
        <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Auditee Portal</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
          External assessment assignments now run inside the migrated app so vendors and auditees can
          respond without depending on the older portal surface.
        </p>
      </section>

      {error && <div className="notice-error">{error}</div>}

      {Object.entries(groupedAssignments).map(([folderName, items]) => (
        <section key={folderName} className="space-y-4">
          <div className="eyebrow">{folderName}</div>
          <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {items.map((assignment) => (
              <Link
                key={assignment.id}
                className="panel-subtle block transition hover:border-[#d7c3f1] hover:bg-[#f6f1fa]"
                to={`/portal/assignments/${assignment.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="break-words text-lg font-semibold text-[#241232]">{assignment.name}</div>
                    <div className="mt-1 text-sm text-[#6f6578]">
                      {assignment.frameworkName ?? 'Assessment'} · {assignment.actorName ?? 'Auditee'}
                    </div>
                  </div>
                  <RegStatusPill className="shrink-0 capitalize" tone={statusTone(assignment.status)}>
                    {assignment.status.replace(/_/g, ' ')}
                  </RegStatusPill>
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-[#62576a]">
                    <span>Progress</span>
                    <span>
                      {assignment.assessedRequirements}/{assignment.totalRequirements}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-2 rounded-full bg-[#8b35e6]" style={{ width: `${assignment.progressPercent}%` }} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
