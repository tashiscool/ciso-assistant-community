import { useEffect, useState } from 'react';
import {
  getGrcAdminStatus,
  importGrcSnapshot,
  launchNativeCollector,
  refreshGrcScf,
  updateGrcAdminSettings,
  waitForGrcJob,
} from './api';
import type { GrcAdminStatus } from './types';

export function GrcAdministrationPage() {
  const [status, setStatus] = useState<GrcAdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningImport, setRunningImport] = useState(false);
  const [refreshingScf, setRefreshingScf] = useState(false);
  const [runningCollectorSource, setRunningCollectorSource] = useState<string | null>(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to collect findings from ${source}.`);
    } finally {
      setRunningCollectorSource(null);
    }
  }

  if (loading) {
    return <section className="panel p-6 text-sm text-slate-300">Loading GRC administration workspace...</section>;
  }

  if (!status) {
    return <section className="panel p-6 text-sm text-slate-300">GRC administration status is not available.</section>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">GRC Content Administration</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Knowledge & AI Control Plane</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Manage the curated content snapshot, SCF synchronization state, and provider-neutral GRC AI backend
          settings that power framework knowledge, gap assessments, and report bundles.
        </p>
      </section>

      {error ? <div className="notice-error">{error}</div> : null}
      {message ? <div className="notice-success">{message}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <div className="panel">
            <div className="eyebrow">Imported corpus</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Curated snapshot status</h2>
            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <div className="panel-subtle">
                <div className="label">Frameworks</div>
                <div className="mt-2 text-2xl font-semibold text-white">{status.frameworkCount}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Documents</div>
                <div className="mt-2 text-2xl font-semibold text-white">{status.documentCount}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">SCF version</div>
                <div className="mt-2 text-sm font-semibold text-white">{status.scfVersion ?? 'Pending'}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">SCF frameworks</div>
                <div className="mt-2 text-2xl font-semibold text-white">{status.scfFrameworkCount}</div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="panel-subtle">
                <div className="label">Normalized findings</div>
                <div className="mt-2 text-2xl font-semibold text-white">{status.status.findings}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Evidence packages</div>
                <div className="mt-2 text-2xl font-semibold text-white">{status.status.evidencePackages}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Recent jobs</div>
                <div className="mt-2 text-2xl font-semibold text-white">{status.status.recentJobs}</div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/30 p-5">
              <div className="eyebrow">Latest snapshot</div>
              {status.latestSnapshot ? (
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <div>Snapshot ID: {status.latestSnapshot.id}</div>
                  <div>Source revision: {status.latestSnapshot.sourceRevision}</div>
                  <div>Imported at: {new Date(status.latestSnapshot.importedAt).toLocaleString()}</div>
                  <div>Summary: {JSON.stringify(status.latestSnapshot.summary)}</div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-400">No curated snapshot has been imported yet.</div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="eyebrow">Provider-neutral AI</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">GRC backend settings</h2>
            <div className="mt-6 grid gap-4">
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Default provider
                <select
                  className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
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

              <label className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-300">
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

              <label className="flex flex-col gap-2 text-sm text-slate-300">
                OpenAI model override
                <input
                  className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
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

            <button className="button-primary mt-6" disabled={saving} onClick={() => void handleSaveSettings()} type="button">
              {saving ? 'Saving…' : 'Save AI settings'}
            </button>
          </div>

          <div className="panel">
            <div className="eyebrow">Native collectors</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Priority connector status</h2>
            <div className="mt-6 grid gap-4">
              {status.connectors.map((connector) => (
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-5" key={connector.source}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="eyebrow">{connector.category}</div>
                      <div className="mt-2 text-lg font-semibold text-white">{connector.label}</div>
                    </div>
                    <span className={connector.authReady ? 'badge-success' : 'badge-neutral'}>
                      {connector.collectionMode}
                    </span>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-300">{connector.readyMessage}</div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="panel-subtle">
                      <div className="label">Runs</div>
                      <div className="mt-2 text-xl font-semibold text-white">{connector.runCount}</div>
                    </div>
                    <div className="panel-subtle">
                      <div className="label">Last success</div>
                      <div className="mt-2 text-sm font-semibold text-white">
                        {connector.lastSuccessAt ? new Date(connector.lastSuccessAt).toLocaleString() : 'No runs yet'}
                      </div>
                    </div>
                    <div className="panel-subtle">
                      <div className="label">Provider</div>
                      <div className="mt-2 text-sm font-semibold text-white">{connector.provider}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {connector.capabilities.map((capability) => (
                      <span className="badge-neutral" key={`${connector.source}-${capability}`}>
                        {capability}
                      </span>
                    ))}
                  </div>
                  <button
                    className="button-secondary mt-4"
                    disabled={runningCollectorSource === connector.source}
                    onClick={() => void handleCollect(connector.source)}
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
            <h2 className="mt-2 text-2xl font-semibold text-white">Content operations</h2>
          </div>

          <button className="button-primary w-full justify-center" disabled={runningImport} onClick={() => void handleImport()} type="button">
            {runningImport ? 'Importing snapshot…' : 'Import curated snapshot'}
          </button>

          <button className="button-secondary w-full justify-center" disabled={refreshingScf} onClick={() => void handleRefreshScf()} type="button">
            {refreshingScf ? 'Refreshing SCF…' : 'Refresh SCF crosswalks'}
          </button>

          <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm leading-6 text-slate-300">
            These actions operate on the curated upstream snapshot only. Regovise imports content and contracts with
            provenance, but it does not execute upstream plugin runtime behavior.
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
            <div className="eyebrow">Recent background work</div>
            <div className="mt-4 space-y-3">
              {status.recentJobs.length > 0 ? (
                status.recentJobs.map((job) => (
                  <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4" key={job.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{job.jobType}</div>
                        <div className="mt-1 text-xs text-slate-500">{job.sourceRef ?? 'tenant-wide operation'}</div>
                      </div>
                      <span className="badge-neutral">{job.status}</span>
                    </div>
                    <div className="mt-3 text-xs text-slate-400">
                      Started {new Date(job.startedAt).toLocaleString()}
                      {job.finishedAt ? ` • Finished ${new Date(job.finishedAt).toLocaleString()}` : ''}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">No GRC background jobs have been recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
