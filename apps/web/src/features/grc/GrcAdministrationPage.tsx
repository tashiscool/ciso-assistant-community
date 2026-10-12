import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RegModal, RegRightDrawer } from '../../components/regovise/PagePrimitives';
import {
  getGrcAdminStatus,
  importGrcSnapshot,
  launchNativeCollector,
  refreshGrcScf,
  updateGrcAdminSettings,
  waitForGrcJob,
} from './api';
import type { GrcAdminStatus } from './types';

type RecentGrcJob = GrcAdminStatus['recentJobs'][number];
type GrcAdminReviewAction =
  | { type: 'save-settings' }
  | { type: 'import-snapshot' }
  | { type: 'refresh-scf' }
  | { type: 'collect'; source: string; label: string };

function formatJson(value: unknown) {
  if (value === undefined || value === null) {
    return 'Not recorded';
  }
  return JSON.stringify(value, null, 2);
}

export function GrcAdministrationPage() {
  const [status, setStatus] = useState<GrcAdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningImport, setRunningImport] = useState(false);
  const [refreshingScf, setRefreshingScf] = useState(false);
  const [runningCollectorSource, setRunningCollectorSource] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<RecentGrcJob | null>(null);
  const [pendingReviewAction, setPendingReviewAction] = useState<GrcAdminReviewAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setStatus(await getGrcAdminStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load GRC administration status.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSaveSettings() {
    if (!status) {
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      const settings = await updateGrcAdminSettings(status.settings);
      setStatus((current) => (current ? { ...current, settings } : current));
      setPendingReviewAction(null);
      setMessage('AI backend settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save GRC AI backend settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleImport() {
    try {
      setRunningImport(true);
      setError(null);
      setMessage(null);
      const queued = await importGrcSnapshot();
      setMessage(`Queued curated snapshot import job ${queued.jobId.slice(0, 12)}.`);
      const response = await waitForGrcJob(queued.jobId);
      await load();
      setMessage(
        response.status === 'completed'
          ? `Imported curated content with ${String(response.result.imported ? 'a completed' : 'the latest')} snapshot job ${queued.jobId.slice(0, 12)}.`
          : `Curated snapshot import failed for job ${queued.jobId.slice(0, 12)}.`,
      );
      setPendingReviewAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import the curated content snapshot.');
    } finally {
      setRunningImport(false);
    }
  }

  async function handleRefreshScf() {
    try {
      setRefreshingScf(true);
      setError(null);
      setMessage(null);
      const queued = await refreshGrcScf();
      setMessage(`Queued SCF refresh job ${queued.jobId.slice(0, 12)}.`);
      const response = await waitForGrcJob(queued.jobId);
      await load();
      setMessage(
        response.status === 'completed'
          ? `SCF refresh completed for job ${queued.jobId.slice(0, 12)}.`
          : `SCF refresh failed for job ${queued.jobId.slice(0, 12)}.`,
      );
      setPendingReviewAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh SCF crosswalk data.');
    } finally {
      setRefreshingScf(false);
    }
  }

  async function handleCollect(source: string) {
    try {
      setRunningCollectorSource(source);
      setError(null);
      setMessage(null);
      const response = await launchNativeCollector(source);
      setMessage(`Queued ${source.toUpperCase()} collection job ${response.jobId.slice(0, 12)}.`);
      const finished = await waitForGrcJob(response.jobId);
      await load();
      setMessage(
        finished.status === 'completed'
          ? `${source.toUpperCase()} collection completed with ${String(finished.result.findingsCreated ?? 0)} normalized findings.`
          : `${source.toUpperCase()} collection failed.`,
      );
      setPendingReviewAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to collect findings from ${source}.`);
    } finally {
      setRunningCollectorSource(null);
    }
  }

  async function confirmReviewAction() {
    if (!pendingReviewAction) {
      return;
    }

    if (pendingReviewAction.type === 'save-settings') {
      await handleSaveSettings();
      return;
    }
    if (pendingReviewAction.type === 'import-snapshot') {
      await handleImport();
      return;
    }
    if (pendingReviewAction.type === 'refresh-scf') {
      await handleRefreshScf();
      return;
    }

    await handleCollect(pendingReviewAction.source);
  }

  if (loading) {
    return <section className="panel p-6 text-sm text-[#4f435c]">Loading GRC administration workspace...</section>;
  }

  if (!status) {
    return <section className="panel p-6 text-sm text-[#4f435c]">GRC administration status is not available.</section>;
  }

  const reviewBusy = saving || runningImport || refreshingScf || Boolean(runningCollectorSource);
  const pendingReviewTitle =
    pendingReviewAction?.type === 'save-settings'
      ? 'Save AI backend settings'
      : pendingReviewAction?.type === 'import-snapshot'
        ? 'Import curated snapshot'
        : pendingReviewAction?.type === 'refresh-scf'
          ? 'Refresh SCF crosswalks'
          : pendingReviewAction?.type === 'collect'
            ? `Collect ${pendingReviewAction.label} findings`
            : 'Review content operation';
  const pendingReviewDescription =
    pendingReviewAction?.type === 'save-settings'
      ? 'Confirm the default provider and OpenAI adapter posture before tenant AI settings are saved.'
      : pendingReviewAction?.type === 'import-snapshot'
        ? 'This queues the curated content importer and waits for the background job result.'
        : pendingReviewAction?.type === 'refresh-scf'
          ? 'This queues an SCF crosswalk refresh and updates framework mapping status when the job completes.'
          : pendingReviewAction?.type === 'collect'
            ? 'This queues a native collector run and may create normalized findings from the selected source.'
            : undefined;
  const pendingReviewConfirmLabel =
    pendingReviewAction?.type === 'save-settings'
      ? 'Save settings'
      : pendingReviewAction?.type === 'import-snapshot'
        ? 'Import snapshot'
        : pendingReviewAction?.type === 'refresh-scf'
          ? 'Refresh SCF'
          : pendingReviewAction?.type === 'collect'
            ? 'Collect findings'
            : 'Confirm';

  return (
    <div className="min-w-0 space-y-6">
      <section className="panel">
        <div className="eyebrow">GRC Content Administration</div>
        <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Knowledge & AI Control Plane</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
          Manage the curated content snapshot, SCF synchronization state, and provider-neutral GRC AI backend
          settings that power framework knowledge, gap assessments, and report bundles.
        </p>
        <div className="mt-5 rounded-3xl border border-[#d7c3f1] bg-[#f2e8ff] p-5">
          <div className="eyebrow text-[#6d28d9]">Assessor scrutiny workflow</div>
          <div className="mt-2 text-lg font-semibold text-[#241232]">Draft control-driven questions and materialize evidence requests</div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#4f227d]/80">
            The Scrutiny Engine turns controls and imported FedRAMP evidence packages into draft questions,
            Data Calls, Evidence Locker placeholders, reconciliation suggestions, and immutable review comments.
          </p>
          <Link className="button-primary mt-4" to="/grc-admin/scrutiny-engine">
            Open Scrutiny Engine
          </Link>
        </div>
      </section>

      {error ? <div className="notice-error">{error}</div> : null}
      {message ? <div className="notice-success">{message}</div> : null}

      <section className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <div className="panel">
            <div className="eyebrow">Imported corpus</div>
            <h2 className="mt-2 text-2xl font-semibold text-[#241232]">Curated snapshot status</h2>
            <div className="mt-6 grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-4">
              <div className="panel-subtle">
                <div className="label">Frameworks</div>
                <div className="mt-2 text-2xl font-semibold text-[#241232]">{status.frameworkCount}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Documents</div>
                <div className="mt-2 text-2xl font-semibold text-[#241232]">{status.documentCount}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">SCF version</div>
                <div className="mt-2 text-sm font-semibold text-[#241232]">{status.scfVersion ?? 'Pending'}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">SCF frameworks</div>
                <div className="mt-2 text-2xl font-semibold text-[#241232]">{status.scfFrameworkCount}</div>
              </div>
            </div>

            <div className="mt-6 grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              <div className="panel-subtle">
                <div className="label">Normalized findings</div>
                <div className="mt-2 text-2xl font-semibold text-[#241232]">{status.status.findings}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Evidence packages</div>
                <div className="mt-2 text-2xl font-semibold text-[#241232]">{status.status.evidencePackages}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Recent jobs</div>
                <div className="mt-2 text-2xl font-semibold text-[#241232]">{status.status.recentJobs}</div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-5">
              <div className="eyebrow">Latest snapshot</div>
              {status.latestSnapshot ? (
                <div className="mt-3 space-y-2 text-sm text-[#4f435c]">
                  <div>Snapshot ID: {status.latestSnapshot.id}</div>
                  <div>Source revision: {status.latestSnapshot.sourceRevision}</div>
                  <div>Imported at: {new Date(status.latestSnapshot.importedAt).toLocaleString()}</div>
                  <div>Summary: {JSON.stringify(status.latestSnapshot.summary)}</div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-[#6f6578]">No curated snapshot has been imported yet.</div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="eyebrow">Provider-neutral AI</div>
            <h2 className="mt-2 text-2xl font-semibold text-[#241232]">GRC backend settings</h2>
            <div className="mt-6 grid gap-4">
              <label className="flex flex-col gap-2 text-sm text-[#4f435c]">
                Default provider
                <select
                  className="rounded-2xl border border-[#ded8e4] bg-white px-4 py-3 text-sm text-[#241232] outline-none focus:border-[#8b35e6]"
                  onChange={(event) =>
                    setStatus((current) =>
                      current
                        ? {
                            ...current,
                            settings: {
                              ...current.settings,
                              defaultProvider:
                                event.target.value === 'openai-responses' ? 'openai-responses' : 'cloudflare-workers-ai',
                            },
                          }
                        : current,
                    )
                  }
                  value={status.settings.defaultProvider}
                >
                  <option value="cloudflare-workers-ai">Cloudflare Workers AI</option>
                  <option value="openai-responses">OpenAI Responses</option>
                </select>
              </label>

              <label className="flex items-start gap-3 rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4 text-sm text-[#4f435c]">
                <input
                  checked={status.settings.openaiEnabled}
                  className="mt-1"
                  onChange={(event) =>
                    setStatus((current) =>
                      current
                        ? {
                            ...current,
                            settings: {
                              ...current.settings,
                              openaiEnabled: event.target.checked,
                            },
                          }
                        : current,
                    )
                  }
                  type="checkbox"
                />
                <span>Allow the OpenAI Responses adapter for this tenant.</span>
              </label>

              <label className="flex flex-col gap-2 text-sm text-[#4f435c]">
                OpenAI model override
                <input
                  className="rounded-2xl border border-[#ded8e4] bg-white px-4 py-3 text-sm text-[#241232] outline-none transition focus:border-[#8b35e6]"
                  onChange={(event) =>
                    setStatus((current) =>
                      current
                        ? {
                            ...current,
                            settings: {
                              ...current.settings,
                              openaiModel: event.target.value,
                            },
                          }
                        : current,
                    )
                  }
                  placeholder="gpt-5.5"
                  value={status.settings.openaiModel ?? ''}
                />
              </label>
            </div>

            <button className="button-primary mt-6" disabled={saving} onClick={() => setPendingReviewAction({ type: 'save-settings' })} type="button">
              {saving ? 'Saving…' : 'Save AI settings'}
            </button>
          </div>

          <div className="panel">
            <div className="eyebrow">Native collectors</div>
            <h2 className="mt-2 text-2xl font-semibold text-[#241232]">Priority connector status</h2>
            <div className="mt-6 grid gap-4">
              {status.connectors.map((connector) => (
                <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-5" key={connector.source}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="eyebrow">{connector.category}</div>
                      <div className="mt-2 text-lg font-semibold text-[#241232]">{connector.label}</div>
                    </div>
                    <span className={connector.authReady ? 'status-pill-success' : 'status-pill-neutral'}>
                      {connector.collectionMode}
                    </span>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-[#4f435c]">{connector.readyMessage}</div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="panel-subtle">
                      <div className="label">Runs</div>
                      <div className="mt-2 text-xl font-semibold text-[#241232]">{connector.runCount}</div>
                    </div>
                    <div className="panel-subtle">
                      <div className="label">Last success</div>
                      <div className="mt-2 text-sm font-semibold text-[#241232]">
                        {connector.lastSuccessAt ? new Date(connector.lastSuccessAt).toLocaleString() : 'No runs yet'}
                      </div>
                    </div>
                    <div className="panel-subtle">
                      <div className="label">Provider</div>
                      <div className="mt-2 text-sm font-semibold text-[#241232]">{connector.provider}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {connector.capabilities.map((capability) => (
                      <span className="status-pill-neutral" key={`${connector.source}-${capability}`}>
                        {capability}
                      </span>
                    ))}
                  </div>
                  <button
                    className="button-secondary mt-4"
                    disabled={runningCollectorSource === connector.source}
                    onClick={() => setPendingReviewAction({ type: 'collect', source: connector.source, label: connector.label })}
                    type="button"
                  >
                    {runningCollectorSource === connector.source ? 'Collecting…' : `Collect ${connector.label} findings`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel space-y-4">
          <div>
            <div className="eyebrow">Maintenance actions</div>
            <h2 className="mt-2 text-2xl font-semibold text-[#241232]">Content operations</h2>
          </div>

          <button className="button-primary w-full justify-center" disabled={runningImport} onClick={() => setPendingReviewAction({ type: 'import-snapshot' })} type="button">
            {runningImport ? 'Importing snapshot…' : 'Import curated snapshot'}
          </button>

          <button className="button-secondary w-full justify-center" disabled={refreshingScf} onClick={() => setPendingReviewAction({ type: 'refresh-scf' })} type="button">
            {refreshingScf ? 'Refreshing SCF…' : 'Refresh SCF crosswalks'}
          </button>

          <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4 text-sm leading-6 text-[#4f435c]">
            These actions operate on the curated upstream snapshot only. Regovise imports content and contracts with
            provenance, but it does not execute upstream plugin runtime behavior.
          </div>

          <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
            <div className="eyebrow">Recent background work</div>
            <div className="mt-4 space-y-3">
              {status.recentJobs.length > 0 ? (
                status.recentJobs.map((job) => (
                  <div className="rounded-3xl border border-[#ded8e4] bg-white p-4" key={job.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#241232]">{job.jobType}</div>
                        <div className="mt-1 text-xs text-[#62576a]">{job.sourceRef ?? 'tenant-wide operation'}</div>
                      </div>
                      <span className="status-pill-neutral">{job.status}</span>
                    </div>
                    <div className="mt-3 text-xs text-[#6f6578]">
                      Started {new Date(job.startedAt).toLocaleString()}
                      {job.finishedAt ? ` • Finished ${new Date(job.finishedAt).toLocaleString()}` : ''}
                    </div>
                    <button className="button-secondary mt-3" onClick={() => setSelectedJob(job)} type="button">
                      Inspect job
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-sm text-[#6f6578]">No GRC background jobs have been recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      </section>
      <RegModal
        description={pendingReviewDescription}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" disabled={reviewBusy} onClick={() => setPendingReviewAction(null)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={reviewBusy} onClick={() => void confirmReviewAction()} type="button">
              {reviewBusy ? 'Running…' : pendingReviewConfirmLabel}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open && !reviewBusy) {
            setPendingReviewAction(null);
          }
        }}
        open={Boolean(pendingReviewAction)}
        title={pendingReviewTitle}
      >
        <div className="space-y-4 text-sm text-[#4f435c]">
          {pendingReviewAction?.type === 'save-settings' ? (
            <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="font-semibold text-[#241232]">Provider: {status.settings.defaultProvider}</div>
              <div className="mt-2 text-[#6f6578]">
                OpenAI adapter: {status.settings.openaiEnabled ? 'Allowed' : 'Disabled'}
              </div>
              <div className="mt-1 break-all text-[#6f6578]">
                Model override: {status.settings.openaiModel || 'None'}
              </div>
            </div>
          ) : null}

          {pendingReviewAction?.type === 'import-snapshot' ? (
            <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="font-semibold text-[#241232]">Current corpus</div>
              <div className="mt-2 text-[#6f6578]">
                {status.frameworkCount} frameworks · {status.documentCount} documents · {status.status.recentJobs} recent jobs
              </div>
              <div className="mt-1 text-[#6f6578]">
                Latest snapshot: {status.latestSnapshot?.sourceRevision ?? 'No snapshot imported yet'}
              </div>
            </div>
          ) : null}

          {pendingReviewAction?.type === 'refresh-scf' ? (
            <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="font-semibold text-[#241232]">SCF crosswalk refresh</div>
              <div className="mt-2 text-[#6f6578]">Current version: {status.scfVersion ?? 'Pending'}</div>
              <div className="mt-1 text-[#6f6578]">Mapped frameworks: {status.scfFrameworkCount}</div>
            </div>
          ) : null}

          {pendingReviewAction?.type === 'collect' ? (
            <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="font-semibold text-[#241232]">{pendingReviewAction.label}</div>
              <div className="mt-2 text-[#6f6578]">Source: {pendingReviewAction.source.toUpperCase()}</div>
              <div className="mt-1 text-[#6f6578]">
                The selected collector queues normalized findings and refreshes the admin status after completion.
              </div>
            </div>
          ) : null}

          <div className="notice-warning">
            This action uses the existing Regovise API path. Review the operation details, then confirm only if this is the intended tenant state.
          </div>
        </div>
      </RegModal>
      <RegRightDrawer
        open={Boolean(selectedJob)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedJob(null);
          }
        }}
        title="GRC job result"
        description={
          selectedJob
            ? `Inspect ${selectedJob.jobType} without changing the queued job, collector, or snapshot state.`
            : undefined
        }
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setSelectedJob(null)} type="button">
              Close
            </button>
          </div>
        }
      >
        {selectedJob ? (
          <div className="space-y-5 text-sm text-[#4f435c]">
            <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="font-semibold text-[#241232]">{selectedJob.jobType}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="status-pill-neutral">{selectedJob.status}</span>
                <span className="status-pill-neutral">{selectedJob.sourceRef ?? 'tenant-wide operation'}</span>
                <span className="status-pill-neutral">Started {new Date(selectedJob.startedAt).toLocaleString()}</span>
                {selectedJob.finishedAt ? (
                  <span className="status-pill-success">Finished {new Date(selectedJob.finishedAt).toLocaleString()}</span>
                ) : (
                  <span className="status-pill-warning">Still running</span>
                )}
              </div>
            </div>
            <div>
              <div className="label">Request</div>
              <pre className="mt-2 max-h-56 overflow-auto rounded-2xl border border-[#ded8e4] bg-white p-4 text-xs leading-5 text-[#241232]">
                {formatJson(selectedJob.request)}
              </pre>
            </div>
            <div>
              <div className="label">Result</div>
              <pre className="mt-2 max-h-56 overflow-auto rounded-2xl border border-[#ded8e4] bg-white p-4 text-xs leading-5 text-[#241232]">
                {formatJson(selectedJob.result)}
              </pre>
            </div>
            <div>
              <div className="label">Diagnostics</div>
              <pre className="mt-2 max-h-56 overflow-auto rounded-2xl border border-[#ded8e4] bg-white p-4 text-xs leading-5 text-[#241232]">
                {formatJson(selectedJob.diagnostics)}
              </pre>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>
    </div>
  );
}
