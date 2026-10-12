import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers3, Pin, PinOff, RefreshCw, Workflow } from 'lucide-react';
import {
  getSubsystemsControlSnapshot,
  selectSubsystemPanel,
  toggleSubsystemPin,
  type SubsystemsControlSnapshot,
} from './controlApi';

const recordTypes = ['Security Plan', 'Issue', 'Risk', 'Evidence'] as const;

export function SubsystemsControlPage() {
  const [snapshot, setSnapshot] = useState<SubsystemsControlSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recordType, setRecordType] = useState<(typeof recordTypes)[number]>('Security Plan');

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const next = await getSubsystemsControlSnapshot();
      setSnapshot(next);
      setRecordType((next.activeSelection.recordType as (typeof recordTypes)[number]) ?? 'Security Plan');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subsystems control room could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const activeSubsystem = useMemo(
    () =>
      snapshot?.subsystems.find((item) => item.key === snapshot.activeSelection.subsystemKey) ??
      snapshot?.subsystems[0] ??
      null,
    [snapshot],
  );

  async function handleSelect(subsystemKey: string) {
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      const next = await selectSubsystemPanel({ subsystemKey, recordType });
      setSnapshot(next);
      setNotice(`Selected ${subsystemKey} for ${recordType} records.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to select subsystem panel.');
    } finally {
      setBusy(false);
    }
  }

  async function handleTogglePin(subsystemKey: string, pinned: boolean) {
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      const next = await toggleSubsystemPin(subsystemKey, { pinned: !pinned });
      setSnapshot(next);
      setNotice(`${subsystemKey} ${pinned ? 'unpinned' : 'pinned'} from the subsystem tray.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update subsystem pin state.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#51465e]">Loading subsystems...</div>;
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
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#241232]">Subsystems</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#51465e]">
              Manage the shared record tray for comments, files, links, workflow, history, and related subsystems from
              a canonical Worker-backed control room.
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
          <div className="metric-label">Subsystems</div>
          <div className="metric-value">{snapshot?.metrics.totalSubsystems ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Pinned</div>
          <div className="metric-value">{snapshot?.metrics.pinned ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Record types</div>
          <div className="metric-value">{snapshot?.metrics.activeRecordTypes ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Tray opens</div>
          <div className="metric-value">{snapshot?.metrics.openedSessions ?? 0}</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="panel-subtle space-y-4">
          <div className="flex items-center gap-2 text-[#241232]">
            <Layers3 className="h-4 w-4 text-[#7a2ed6]" />
            <h2 className="text-lg font-semibold">Active tray selection</h2>
          </div>
          <label className="space-y-1">
            <span className="label">Record type</span>
            <select className="input" onChange={(event) => setRecordType(event.target.value as (typeof recordTypes)[number])} value={recordType}>
              {recordTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          {activeSubsystem && (
            <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium text-[#241232]">{activeSubsystem.title}</div>
                <span className="status-pill-neutral">{activeSubsystem.category}</span>
                {activeSubsystem.pinned && <span className="status-pill-neutral">Pinned</span>}
              </div>
              <div className="mt-2 text-sm text-[#51465e]">{activeSubsystem.description}</div>
              <div className="mt-3 text-xs text-[#62576a]">{activeSubsystem.usageExample}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="button-primary" disabled={busy} onClick={() => void handleSelect(activeSubsystem.key)} type="button">
                  <Workflow className="mr-2 h-4 w-4" />
                  Select panel
                </button>
                <button className="button-secondary" disabled={busy} onClick={() => void handleTogglePin(activeSubsystem.key, activeSubsystem.pinned)} type="button">
                  {activeSubsystem.pinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
                  {activeSubsystem.pinned ? 'Unpin' : 'Pin'}
                </button>
                <Link className="button-secondary" to={activeSubsystem.route}>
                  Open route
                </Link>
              </div>
            </div>
          )}

          {activeSubsystem && (
            <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="eyebrow">Availability matrix</div>
              <div className="mt-4 grid gap-3">
                {Object.entries(activeSubsystem.availability).map(([key, value]) => (
                  <div className="flex items-center justify-between rounded-2xl border border-[#ded8e4] bg-white px-4 py-3" key={key}>
                    <span className="text-sm text-[#51465e]">{key}</span>
                    <span className="status-pill-neutral">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <section className="panel overflow-hidden p-0">
          <div className="border-b border-[#ded8e4] px-6 py-4">
            <div className="eyebrow">Subsystem library</div>
            <p className="mt-1 text-sm text-[#6f6578]">Pinned state, usage, and access contract for each subsystem.</p>
          </div>
          <div className="divide-y divide-[#ded8e4]">
            {snapshot?.subsystems.map((item) => (
              <div className="px-6 py-4" key={item.key}>
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-[#241232]">{item.title}</div>
                      <span className="status-pill-neutral">{item.category}</span>
                      {item.pinned && <span className="status-pill-neutral">Pinned</span>}
                    </div>
                    <div className="mt-2 text-sm text-[#51465e]">{item.description}</div>
                    <div className="mt-2 text-xs text-[#62576a]">
                      {item.openCount} opens
                      {item.lastOpenedAt ? ` · Last opened ${new Date(item.lastOpenedAt).toLocaleString()}` : ' · Never opened'}
                    </div>
                    {item.activityNote && <div className="mt-2 text-xs text-[#62576a]">{item.activityNote}</div>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="button-secondary" disabled={busy} onClick={() => void handleSelect(item.key)} type="button">
                      Select
                    </button>
                    <button className="button-secondary" disabled={busy} onClick={() => void handleTogglePin(item.key, item.pinned)} type="button">
                      {item.pinned ? 'Unpin' : 'Pin'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
