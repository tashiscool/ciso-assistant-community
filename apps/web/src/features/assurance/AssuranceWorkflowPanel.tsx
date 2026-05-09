import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAssuranceWorkflowRuns } from './api';
import type { AssuranceWorkflowRun } from './types';

type AssuranceWorkflowPanelProps = {
  heading?: string;
  helperText?: string;
  linkedRecordIds: string[];
  emptyMessage?: string;
  disabledMessage?: string;
  limit?: number;
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString();
}

function badgeClass(status: string) {
  switch (status) {
    case 'Done':
      return 'badge-success';
    case 'Failed':
      return 'badge-danger';
    default:
      return 'badge-neutral';
  }
}

function metadataValueAsString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function metadataValueAsStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildReviewRoute(recommendationId: string, evidenceJobId: string | null, decisionId: string | null): string {
  const searchParams = new URLSearchParams();
  searchParams.set('recommendationId', recommendationId);
  if (evidenceJobId) {
    searchParams.set('evidenceJobId', evidenceJobId);
  }
  if (decisionId) {
    searchParams.set('decisionId', decisionId);
  }
  return `/assurance/reviews?${searchParams.toString()}`;
}

function buildAgentRoute(agentRunId: string, writebackApprovalId: string | null): string {
  const searchParams = new URLSearchParams();
  searchParams.set('runId', agentRunId);
  if (writebackApprovalId) {
    searchParams.set('writebackId', writebackApprovalId);
  }
  return `/assurance/agent-runs?${searchParams.toString()}`;
}

function linkedRecords(run: AssuranceWorkflowRun) {
  const metadata = run.metadata ?? {};
  const evidenceJobId = metadataValueAsString(metadata.evidenceJobId);
  const packageJobId = metadataValueAsString(metadata.packageJobId);
  const refreshedPackageIds = metadataValueAsStringArray(metadata.refreshedPackageIds);
  const trackerImportId = metadataValueAsString(metadata.trackerImportId);
  const recommendationId = metadataValueAsString(metadata.recommendationId);
  const reviewDecisionId = metadataValueAsString(metadata.reviewDecisionId);
  const writebackApprovalId = metadataValueAsString(metadata.writebackApprovalId);
  const agentRunId = metadataValueAsString(metadata.agentRunId) ?? (run.runType === 'assurance_agent' ? run.sourceRecordId : null);
  const records = [
    evidenceJobId
      ? { label: 'Evidence', value: evidenceJobId, route: `/assurance/evidence?evidenceJobId=${encodeURIComponent(evidenceJobId)}` }
      : null,
    packageJobId
      ? { label: 'Package', value: packageJobId, route: `/assurance/packages?packageId=${encodeURIComponent(packageJobId)}` }
      : null,
    trackerImportId
      ? { label: 'Tracker', value: trackerImportId, route: `/assurance/tracker?importId=${encodeURIComponent(trackerImportId)}` }
      : null,
    recommendationId
      ? { label: 'Review', value: recommendationId, route: buildReviewRoute(recommendationId, evidenceJobId, reviewDecisionId) }
      : null,
    agentRunId
      ? { label: 'Agent', value: agentRunId, route: buildAgentRoute(agentRunId, writebackApprovalId) }
      : null,
    ...refreshedPackageIds.map((value) => ({
      label: 'Package',
      value,
      route: `/assurance/packages?packageId=${encodeURIComponent(value)}`,
    })),
  ].filter(Boolean) as Array<{ label: string; value: string; route: string }>;

  return Array.from(
    new Map(records.map((record) => [`${record.label}:${record.value}:${record.route}`, record])).values(),
  );
}

type WorkflowStatusFilter = 'all' | 'Running' | 'Awaiting Review' | 'Done' | 'Failed';

export function AssuranceWorkflowPanel({
  heading = 'Workflow ledger',
  helperText = 'Recent workflow runs linked to the currently selected assurance records.',
  linkedRecordIds,
  emptyMessage = 'No workflow runs are linked to the current selection yet.',
  disabledMessage = 'Select an assurance item to load its workflow activity.',
  limit = 25,
}: AssuranceWorkflowPanelProps) {
  const normalizedLinkedRecordIds = useMemo(
    () => Array.from(new Set(linkedRecordIds.map((value) => value.trim()).filter(Boolean))),
    [linkedRecordIds],
  );
  const [runs, setRuns] = useState<AssuranceWorkflowRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<WorkflowStatusFilter>('all');
  const [expandedRunId, setExpandedRunId] = useState('');

  async function loadRuns() {
    if (normalizedLinkedRecordIds.length === 0) {
      setRuns([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setRuns(
        await listAssuranceWorkflowRuns({
          linkedRecordIds: normalizedLinkedRecordIds,
          limit,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load workflow activity.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRuns();
  }, [limit, normalizedLinkedRecordIds]);

  const statusCounts = useMemo(
    () => ({
      running: runs.filter((run) => run.status === 'Running').length,
      awaitingReview: runs.filter((run) => run.status === 'Awaiting Review').length,
      completed: runs.filter((run) => run.status === 'Done').length,
      failed: runs.filter((run) => run.status === 'Failed').length,
    }),
    [runs],
  );
  const filteredRuns = useMemo(
    () => runs.filter((run) => statusFilter === 'all' || run.status === statusFilter),
    [runs, statusFilter],
  );

  useEffect(() => {
    setExpandedRunId((current) => (filteredRuns.some((run) => run.runId === current) ? current : filteredRuns[0]?.runId ?? ''));
  }, [filteredRuns]);

  return (
    <section className="panel-subtle">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="label">{heading}</div>
          <div className="mt-1 text-sm text-slate-400">{helperText}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input min-w-[190px]" onChange={(event) => setStatusFilter(event.target.value as WorkflowStatusFilter)} value={statusFilter}>
            <option value="all">All statuses</option>
            <option value="Running">Running</option>
            <option value="Awaiting Review">Awaiting review</option>
            <option value="Done">Completed</option>
            <option value="Failed">Failed</option>
          </select>
          <button className="button-secondary" disabled={loading || normalizedLinkedRecordIds.length === 0} onClick={() => void loadRuns()} type="button">
            Refresh
          </button>
        </div>
      </div>

      {normalizedLinkedRecordIds.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="metric-card">
            <div className="metric-label">Running</div>
            <div className="metric-value">{statusCounts.running}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Awaiting review</div>
            <div className="metric-value">{statusCounts.awaitingReview}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Completed</div>
            <div className="metric-value">{statusCounts.completed}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Failed</div>
            <div className="metric-value">{statusCounts.failed}</div>
          </div>
        </div>
      )}

      {error && <div className="notice-error mt-4">{error}</div>}

      <div className="mt-4 space-y-3">
        {normalizedLinkedRecordIds.length === 0 && <div className="text-sm text-slate-400">{disabledMessage}</div>}
        {normalizedLinkedRecordIds.length > 0 && loading && <div className="text-sm text-slate-400">Loading workflow activity...</div>}
        {normalizedLinkedRecordIds.length > 0 && !loading && runs.length === 0 && <div className="text-sm text-slate-400">{emptyMessage}</div>}
        {normalizedLinkedRecordIds.length > 0 && !loading && runs.length > 0 && filteredRuns.length === 0 && (
          <div className="text-sm text-slate-400">No workflow runs match the current status filter.</div>
        )}
        {filteredRuns.map((run) => {
          const links = linkedRecords(run);
          const expanded = expandedRunId === run.runId;
          return (
          <div key={run.runId} className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium text-white">{run.title}</div>
                  <span className="badge-neutral">{run.module}</span>
                  <span className={badgeClass(run.status)}>{run.status}</span>
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-300">{run.detail}</div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>{run.runType}</span>
                  <span>Created {formatDate(run.createdAt)}</span>
                  <span>{formatDate(run.updatedAt)}</span>
                  {run.sourceRecordId && <span className="font-mono text-cyan-200">{run.sourceRecordId}</span>}
                </div>
                {links.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {links.map((link) => (
                      <Link
                        key={`${run.runId}:${link.label}:${link.value}`}
                        className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] px-3 py-1 text-xs text-cyan-200 transition hover:border-cyan-300/30"
                        to={link.route}
                      >
                        {link.label}: <span className="font-mono">{link.value}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="button-secondary"
                  onClick={() => setExpandedRunId((current) => (current === run.runId ? '' : run.runId))}
                  type="button"
                >
                  {expanded ? 'Hide details' : 'Inspect'}
                </button>
                <Link className="button-secondary" to={run.route}>
                  Open
                </Link>
              </div>
            </div>
            {expanded && (
              <div className="mt-4 grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
                <div className="rounded-2xl border border-white/8 bg-slate-950/50 px-4 py-4 text-sm text-slate-300">
                  <div className="label">Run context</div>
                  <div className="mt-3 space-y-2">
                    <div>
                      <span className="text-slate-500">Route:</span> <span className="font-mono text-cyan-200">{run.route}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Run id:</span> <span className="font-mono text-cyan-200">{run.runId}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Source record:</span>{' '}
                      <span className="font-mono text-cyan-200">{run.sourceRecordId ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Folder scope:</span>{' '}
                      <span className="font-mono text-cyan-200">{run.folderId ?? 'Tenant-wide'}</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-slate-950/50 px-4 py-4">
                  <div className="label">Workflow metadata</div>
                  <pre className="mt-3 max-h-[320px] overflow-auto rounded-2xl border border-white/10 bg-black/25 p-4 text-xs leading-6 text-slate-300">
                    {run.metadata ? JSON.stringify(run.metadata, null, 2) : 'No metadata was attached to this workflow run.'}
                  </pre>
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </section>
  );
}
