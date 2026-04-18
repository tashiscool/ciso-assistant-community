import { useEffect, useMemo, useState } from 'react';
import { Copy, Plus, RefreshCw, Save, ServerCog } from 'lucide-react';
import {
  createAppManagementApp,
  duplicateAppManagementApp,
  getAppManagementControlSnapshot,
  saveAppManagementApp,
  type AppManagementControlSnapshot,
} from './controlApi';

type DraftState = {
  name: string;
  description: string;
  automationOwner: string;
  notes: string;
  defaultPublic: boolean;
  inheritParentAccess: boolean;
};

function toDraft(app: AppManagementControlSnapshot['apps'][number]): DraftState {
  return {
    name: app.name,
    description: app.description,
    automationOwner: app.automationOwner,
    notes: app.notes,
    defaultPublic: app.defaultPublic,
    inheritParentAccess: app.inheritParentAccess,
  };
}

export function AppManagementControlPage() {
  const [snapshot, setSnapshot] = useState<AppManagementControlSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const next = await getAppManagementControlSnapshot();
      setSnapshot(next);
      const nextSelected = selectedId ?? next.apps[0]?.id ?? null;
      setSelectedId(nextSelected);
      const app = next.apps.find((item) => item.id === nextSelected) ?? next.apps[0] ?? null;
      setDraft(app ? toDraft(app) : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'App Management could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedApp = useMemo(
    () => snapshot?.apps.find((item) => item.id === selectedId) ?? snapshot?.apps[0] ?? null,
    [selectedId, snapshot],
  );

  useEffect(() => {
    if (selectedApp) {
      setDraft(toDraft(selectedApp));
    }
  }, [selectedApp?.id]);

  async function handleCreate() {
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      const result = await createAppManagementApp({ name: 'New business unit' });
      setSnapshot(result.snapshot);
      if (result.app) {
        setSelectedId(result.app.id);
        setDraft(toDraft(result.app));
      }
      setNotice('Business-unit partition created from the canonical control room.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create app partition.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!selectedApp || !draft) {
      return;
    }

    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      const result = await saveAppManagementApp(selectedApp.id, draft);
      setSnapshot(result.snapshot);
      if (result.app) {
        setDraft(toDraft(result.app));
      }
      setNotice(`${draft.name} saved in App Management.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save app partition.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate() {
    if (!selectedApp) {
      return;
    }

    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      const result = await duplicateAppManagementApp(selectedApp.id);
      setSnapshot(result.snapshot);
      if (result.app) {
        setSelectedId(result.app.id);
        setDraft(toDraft(result.app));
      }
      setNotice(`${selectedApp.name} duplicated for a new business-unit partition.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to duplicate app partition.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading app management...</div>;
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
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">App Management</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Manage business-unit partitions, delegated access, automation ownership, and service-account posture from
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
          <div className="metric-label">Apps</div>
          <div className="metric-value">{snapshot?.metrics.apps ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Groups</div>
          <div className="metric-value">{snapshot?.metrics.groups ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Users</div>
          <div className="metric-value">{snapshot?.metrics.users ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Svc accounts</div>
          <div className="metric-value">{snapshot?.metrics.serviceAccounts ?? 0}</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="panel-subtle space-y-4">
          <div className="flex items-center gap-2 text-white">
            <ServerCog className="h-4 w-4 text-cyan-300" />
            <h2 className="text-lg font-semibold">Business-unit partitions</h2>
          </div>
          <button className="button-primary" disabled={busy} onClick={() => void handleCreate()} type="button">
            <Plus className="mr-2 h-4 w-4" />
            New partition
          </button>
          <div className="space-y-3">
            {snapshot?.apps.map((app) => (
              <button
                className={`panel-subtle w-full text-left transition ${selectedApp?.id === app.id ? 'border-cyan-300/40 bg-cyan-400/[0.04]' : ''}`}
                key={app.id}
                onClick={() => setSelectedId(app.id)}
                type="button"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium text-white">{app.name}</div>
                  <span className="badge-neutral">{app.automationHealth}</span>
                  {app.defaultPublic && <span className="badge-neutral">Public</span>}
                </div>
                <div className="mt-2 text-sm text-slate-300">{app.description}</div>
                <div className="mt-2 text-xs text-slate-500">
                  {app.groups.length} groups · {app.users.length} users · {app.serviceAccounts.length} service accounts
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedApp && draft && (
          <div className="space-y-4">
            <section className="panel">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="eyebrow">Selected app</div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{selectedApp.name}</h2>
                  <p className="mt-2 text-sm text-slate-300">Update the partition metadata and automation ownership.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="button-secondary" disabled={busy} onClick={() => void handleDuplicate()} type="button">
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate
                  </button>
                  <button className="button-primary" disabled={busy} onClick={() => void handleSave()} type="button">
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="label">Name</span>
                  <input className="input" onChange={(event) => setDraft((current) => (current ? { ...current, name: event.target.value } : current))} value={draft.name} />
                </label>
                <label className="space-y-1">
                  <span className="label">Automation owner</span>
                  <input className="input" onChange={(event) => setDraft((current) => (current ? { ...current, automationOwner: event.target.value } : current))} value={draft.automationOwner} />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="label">Description</span>
                  <textarea className="input min-h-[96px]" onChange={(event) => setDraft((current) => (current ? { ...current, description: event.target.value } : current))} value={draft.description} />
                </label>
                <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                  <span className="text-sm text-slate-300">Default public</span>
                  <input checked={draft.defaultPublic} onChange={(event) => setDraft((current) => (current ? { ...current, defaultPublic: event.target.checked } : current))} type="checkbox" />
                </label>
                <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                  <span className="text-sm text-slate-300">Inherit parent access</span>
                  <input checked={draft.inheritParentAccess} onChange={(event) => setDraft((current) => (current ? { ...current, inheritParentAccess: event.target.checked } : current))} type="checkbox" />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="label">Notes</span>
                  <textarea className="input min-h-[120px]" onChange={(event) => setDraft((current) => (current ? { ...current, notes: event.target.value } : current))} value={draft.notes} />
                </label>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <div className="panel-subtle">
                <div className="eyebrow">Administrators</div>
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  {selectedApp.administrators.map((item) => (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3" key={item}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel-subtle">
                <div className="eyebrow">Groups</div>
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  {selectedApp.groups.map((item) => (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3" key={item.name}>
                      <div className="font-medium text-white">{item.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.create ? 'Create' : 'No create'} · {item.update ? 'Update' : 'Read only'} ·{' '}
                        {item.ssoSync ? 'SSO sync' : 'Manual'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel-subtle">
                <div className="eyebrow">Service accounts</div>
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  {selectedApp.serviceAccounts.map((item) => (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3" key={`${item.purpose}-${item.tokenDuration}`}>
                      <div className="font-medium text-white">{item.purpose}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.crudScope} · {item.tokenDuration} · {item.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
