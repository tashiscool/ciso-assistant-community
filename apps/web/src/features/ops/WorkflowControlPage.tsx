import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, PlayCircle, RefreshCw, ShieldCheck, Trash2, Workflow } from 'lucide-react';
import {
  acquireWorkflowLease,
  getWorkflowControlSnapshot,
  releaseWorkflowLease,
  type WorkflowControlSnapshot,
} from './controlApi';

export function WorkflowControlPage() {
  const [snapshot, setSnapshot] = useState<WorkflowControlSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [leaseKey, setLeaseKey] = useState('workflow-approval-review');

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setSnapshot(await getWorkflowControlSnapshot());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workflow control room could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAcquireLease() {
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      const result = await acquireWorkflowLease({
        leaseKey,
        metadata: {
          label: 'Manual workflow coordination lease',
        },
      });
      setSnapshot(result.snapshot);
      setNotice(`Lease ${result.lease.leaseKey} is active in the tenant workflow coordinator.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to acquire workflow lease.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReleaseLease(key: string) {
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      const result = await releaseWorkflowLease(key);
      setSnapshot(result.snapshot);
      setNotice(`Lease ${result.leaseKey} released.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to release workflow lease.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#51465e]">Loading workflow control room...</div>;
  }

  if (error && !snapshot) {
    return <div className="notice-error">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Operations</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#241232]">Workflow</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#51465e]">
              Coordinate workflow templates, in-flight runs, and Durable Object leases from a canonical Worker-backed
              control room.
            </p>
          </div>
          <button className="button-primary" onClick={() => void load()} type="button">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Active leases</div>
          <div className="metric-value">{snapshot?.metrics.activeLeases ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Running flows</div>
          <div className="metric-value">{snapshot?.metrics.runningFlows ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Awaiting review</div>
          <div className="metric-value">{snapshot?.metrics.awaitingReview ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Completed</div>
          <div className="metric-value">{snapshot?.metrics.completed ?? 0}</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="panel-subtle space-y-4">
          <div className="flex items-center gap-2 text-[#241232]">
            <ShieldCheck className="h-4 w-4 text-[#7a2ed6]" />
            <h2 className="text-lg font-semibold">Lease coordination</h2>
          </div>
          <label className="space-y-1">
            <span className="label">Lease key</span>
            <input className="input" onChange={(event) => setLeaseKey(event.target.value)} value={leaseKey} />
          </label>
          <button className="button-primary" disabled={busy} onClick={() => void handleAcquireLease()} type="button">
            <PlayCircle className="mr-2 h-4 w-4" />
            Acquire lease
          </button>

          <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
            <div className="eyebrow">Workflow lanes</div>
            <div className="mt-4 grid gap-3">
              {snapshot?.lanes.map((lane) => (
                <div className="rounded-2xl border border-[#ded8e4] bg-white p-4" key={lane.id}>
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-[#241232]">{lane.label}</div>
                    <span className="status-pill-neutral">{lane.count}</span>
                  </div>
                  <div className="mt-2 text-sm text-[#6f6578]">{lane.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
            <div className="eyebrow">Templates</div>
            <div className="mt-4 space-y-3">
              {snapshot?.templates.map((template) => (
                <Link
                  className="block rounded-2xl border border-[#ded8e4] bg-white p-4 transition hover:border-[#8b35e6]/30 hover:bg-[#f8f3ff]"
                  key={template.id}
                  to={template.route}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-[#241232]">{template.title}</div>
                      <div className="mt-1 text-sm text-[#6f6578]">{template.detail}</div>
                    </div>
                    <span className="status-pill-neutral">{template.activeCount}</span>
                  </div>
                  <div className="mt-3 text-xs uppercase tracking-[0.16em] text-[#62576a]">{template.module}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <section className="panel overflow-hidden p-0">
            <div className="border-b border-[#ded8e4] px-6 py-4">
              <div className="eyebrow">Active leases</div>
              <p className="mt-1 text-sm text-[#6f6578]">Current tenant workflow coordinator locks.</p>
            </div>
            <div className="divide-y divide-[#ded8e4]">
              {snapshot?.activeLeases.length ? (
                snapshot.activeLeases.map((lease) => (
                  <div className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-start md:justify-between" key={lease.leaseKey}>
                    <div>
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-[#7a2ed6]" />
                        <div className="font-medium text-[#241232]">{lease.leaseKey}</div>
                      </div>
                      <div className="mt-2 text-sm text-[#6f6578]">
                        Acquired {new Date(lease.acquiredAt).toLocaleString()} · Expires {new Date(lease.expiresAt).toLocaleString()}
                      </div>
                      {lease.metadata && (
                        <div className="mt-2 text-xs text-[#62576a]">{JSON.stringify(lease.metadata)}</div>
                      )}
                    </div>
                    <button className="button-secondary" disabled={busy} onClick={() => void handleReleaseLease(lease.leaseKey)} type="button">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Release
                    </button>
                  </div>
                ))
              ) : (
                <div className="px-6 py-6 text-sm text-[#6f6578]">No active workflow leases in this tenant.</div>
              )}
            </div>
          </section>

          <section className="panel overflow-hidden p-0">
            <div className="border-b border-[#ded8e4] px-6 py-4">
              <div className="eyebrow">Recent workflow runs</div>
              <p className="mt-1 text-sm text-[#6f6578]">Latest cross-module workflow activity derived from canonical Worker tables.</p>
            </div>
            <div className="divide-y divide-[#ded8e4]">
              {snapshot?.recentRuns.map((run) => (
                <div className="px-6 py-4" key={`${run.module}:${run.id}`}>
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-[#241232]">{run.title}</div>
                        <span className="status-pill-neutral">{run.module}</span>
                        <span className={run.status === 'Done' ? 'status-pill-positive' : 'status-pill-neutral'}>{run.status}</span>
                      </div>
                      <div className="mt-2 text-sm text-[#51465e]">{run.detail}</div>
                      <div className="mt-2 text-xs text-[#62576a]">{new Date(run.updatedAt).toLocaleString()}</div>
                    </div>
                    <Link className="button-secondary" to={run.route}>
                      Open
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
