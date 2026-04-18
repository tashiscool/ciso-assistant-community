import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cpu, PlayCircle, RefreshCw, Wrench } from 'lucide-react';
import {
  getUtilitiesControlSnapshot,
  launchUtilityRun,
  type UtilitiesControlSnapshot,
} from './controlApi';

export function UtilitiesControlPage() {
  const [snapshot, setSnapshot] = useState<UtilitiesControlSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [utilityKey, setUtilityKey] = useState('builder');
  const [scope, setScope] = useState('FedRAMP workspace');
  const [recordsHint, setRecordsHint] = useState(12);
  const [previewMode, setPreviewMode] = useState(true);
  const [notes, setNotes] = useState('Preview utility changes before coordinating downstream updates.');

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const next = await getUtilitiesControlSnapshot();
      setSnapshot(next);
      if (next.utilities.length > 0 && !next.utilities.find((item) => item.key === utilityKey)) {
        setUtilityKey(next.utilities[0].key);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Utilities control room could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedUtility = useMemo(
    () => snapshot?.utilities.find((item) => item.key === utilityKey) ?? snapshot?.utilities[0] ?? null,
    [snapshot, utilityKey],
  );

  async function handleLaunch() {
    if (!selectedUtility) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const result = await launchUtilityRun({
        utilityKey: selectedUtility.key,
        module: selectedUtility.module,
        scope,
        recordsHint,
        previewMode,
        notes,
      });
      setSnapshot(result.snapshot);
      setNotice(`${result.run.title} launched in ${result.run.status.toLowerCase()} mode.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to launch utility run.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading utilities...</div>;
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
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Utilities</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Launch guided utility runs for builder acceleration, inheritance carry-forward, categorization, and
              governance packaging from the canonical Worker-backed control room.
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
          <div className="metric-label">Utilities</div>
          <div className="metric-value">{snapshot?.metrics.totalUtilities ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Recent runs</div>
          <div className="metric-value">{snapshot?.metrics.recentRuns ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Preview-ready</div>
          <div className="metric-value">{snapshot?.metrics.previewReady ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Queued</div>
          <div className="metric-value">{snapshot?.metrics.queuedRuns ?? 0}</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="panel-subtle space-y-4">
          <div className="flex items-center gap-2 text-white">
            <Wrench className="h-4 w-4 text-cyan-300" />
            <h2 className="text-lg font-semibold">Launch utility</h2>
          </div>
          <label className="space-y-1">
            <span className="label">Utility</span>
            <select className="input" onChange={(event) => setUtilityKey(event.target.value)} value={utilityKey}>
              {snapshot?.utilities.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Scope</span>
            <input className="input" onChange={(event) => setScope(event.target.value)} value={scope} />
          </label>
          <label className="space-y-1">
            <span className="label">Records</span>
            <input
              className="input"
              min={1}
              onChange={(event) => setRecordsHint(Math.max(1, Number(event.target.value || 1)))}
              type="number"
              value={recordsHint}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Launch note</span>
            <textarea className="input min-h-[110px]" onChange={(event) => setNotes(event.target.value)} value={notes} />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
            <span className="text-sm text-slate-300">Preview mode</span>
            <input checked={previewMode} onChange={(event) => setPreviewMode(event.target.checked)} type="checkbox" />
          </label>
          <button className="button-primary" disabled={saving || !selectedUtility} onClick={() => void handleLaunch()} type="button">
            <PlayCircle className="mr-2 h-4 w-4" />
            {saving ? 'Launching...' : 'Launch utility'}
          </button>

          {selectedUtility && (
            <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <div className="eyebrow">Selected utility</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="font-medium text-white">{selectedUtility.title}</div>
                <span className="badge-neutral">{selectedUtility.status}</span>
                <span className="badge-neutral">{selectedUtility.module}</span>
              </div>
              <div className="mt-2 text-sm text-slate-300">{selectedUtility.description}</div>
              <div className="mt-3 text-xs text-slate-500">{selectedUtility.notes}</div>
              <div className="mt-4">
                <Link className="button-secondary" to={selectedUtility.route}>
                  Open module
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <section className="panel overflow-hidden p-0">
            <div className="border-b border-white/10 px-6 py-4">
              <div className="eyebrow">Utility catalog</div>
              <p className="mt-1 text-sm text-slate-400">Canonical launch surfaces and their target modules.</p>
            </div>
            <div className="divide-y divide-white/6">
              {snapshot?.utilities.map((item) => (
                <div className="px-6 py-4" key={item.key}>
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-white">{item.title}</div>
                        <span className="badge-neutral">{item.status}</span>
                        <span className="badge-neutral">{item.runCount} runs</span>
                      </div>
                      <div className="mt-2 text-sm text-slate-300">{item.description}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        Queue {item.queueName}
                        {item.lastRun ? ` · Last run ${new Date(item.lastRun).toLocaleString()}` : ' · No runs yet'}
                      </div>
                    </div>
                    <Link className="button-secondary" to={item.route}>
                      Open
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel overflow-hidden p-0">
            <div className="border-b border-white/10 px-6 py-4">
              <div className="eyebrow">Recent runs</div>
              <p className="mt-1 text-sm text-slate-400">Latest utility launches persisted in the canonical Worker.</p>
            </div>
            <div className="divide-y divide-white/6">
              {snapshot?.recentRuns.length ? (
                snapshot.recentRuns.map((run) => (
                  <div className="px-6 py-4" key={run.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-white">{run.title}</div>
                      <span className="badge-neutral">{run.status}</span>
                      {run.previewMode && <span className="badge-neutral">Preview</span>}
                    </div>
                    <div className="mt-2 text-sm text-slate-300">
                      {run.scope} · {run.records} records · {run.module}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <Cpu className="h-3.5 w-3.5" />
                      <span>{new Date(run.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-6 text-sm text-slate-400">No utility runs have been launched in this tenant yet.</div>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
