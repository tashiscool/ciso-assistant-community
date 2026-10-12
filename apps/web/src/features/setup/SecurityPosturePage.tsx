import { useEffect, useState } from 'react';
import { Cloud, Database, HardDrive, ShieldCheck, Workflow } from 'lucide-react';
import { RegModal } from '../../components/regovise/PagePrimitives';
import { getSetupSecurity, updateSetupSecurityControl } from './api';
import type { SetupSecurityControl, SetupSecuritySnapshot } from './types';

const controlIcons = [HardDrive, Database, Workflow, Cloud];
const statusOptions = ['Monitored', 'Managed', 'Hardened', 'Enforced'];

type PendingSecurityUpdate = {
  control: SetupSecurityControl;
  patch: Partial<SetupSecurityControl>;
  summary: string;
};

export function SecurityPosturePage() {
  const [snapshot, setSnapshot] = useState<SetupSecuritySnapshot | null>(null);
  const [ownerDrafts, setOwnerDrafts] = useState<Record<string, string>>({});
  const [pendingUpdate, setPendingUpdate] = useState<PendingSecurityUpdate | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const nextSnapshot = await getSetupSecurity();
      setSnapshot(nextSnapshot);
      setOwnerDrafts(
        Object.fromEntries(nextSnapshot.records.controls.map((control) => [control.id, control.ownerName ?? ''])),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load security posture.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function updateControl(control: SetupSecurityControl, patch: Partial<SetupSecurityControl>) {
    try {
      setSavingId(control.id);
      setError(null);
      setNotice(null);
      const nextSnapshot = await updateSetupSecurityControl(control.id, {
          status: patch.status,
          ownerName: patch.ownerName,
          description: patch.description,
          detail: patch.detail,
      });
      setSnapshot(nextSnapshot);
      setOwnerDrafts(
        Object.fromEntries(nextSnapshot.records.controls.map((nextControl) => [nextControl.id, nextControl.ownerName ?? ''])),
      );
      setPendingUpdate(null);
      setNotice(`Security control ${control.title} updated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update security control.');
    } finally {
      setSavingId(null);
    }
  }

  function queueControlUpdate(control: SetupSecurityControl, patch: Partial<SetupSecurityControl>, summary: string) {
    if (patch.status !== undefined && patch.status === control.status) {
      return;
    }
    if (patch.ownerName !== undefined && patch.ownerName === (control.ownerName ?? null)) {
      return;
    }
    setPendingUpdate({ control, patch, summary });
  }

  function dismissPendingUpdate() {
    if (pendingUpdate?.patch.ownerName !== undefined) {
      setOwnerDrafts((current) => ({
        ...current,
        [pendingUpdate.control.id]: pendingUpdate.control.ownerName ?? '',
      }));
    }
    setPendingUpdate(null);
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading security posture...</div>;
  }

  if (error && !snapshot) {
    return <div className="notice-error">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Setup</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#241232]">Security</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
          Track identity, storage, workflow, and observability controls from a canonical Cloudflare-backed security
          posture workspace.
        </p>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Managed controls</div>
          <div className="metric-value">{snapshot?.metrics.managedControls ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Hardened</div>
          <div className="metric-value">{snapshot?.metrics.hardenedControls ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Queue backlog</div>
          <div className="metric-value">{snapshot?.metrics.queueBacklog ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Evidence artifacts</div>
          <div className="metric-value">{snapshot?.metrics.evidenceArtifacts ?? 0}</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="panel overflow-hidden p-0">
          <div className="border-b border-[#ded8e4] px-6 py-4">
            <div className="eyebrow">Security controls</div>
            <p className="mt-1 text-sm text-[#6f6578]">Persisted tenant controls with editable status and ownership.</p>
          </div>
          <div className="divide-y divide-[#ded8e4]">
            {snapshot?.records.controls.map((control) => (
              <div className="px-6 py-4" key={control.id}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-[#241232]">{control.title}</div>
                      <span className="status-pill-neutral">{control.category}</span>
                    </div>
                    <div className="mt-2 text-sm text-[#4f435c]">{control.description}</div>
                    <div className="mt-2 text-xs text-[#62576a]">
                      Owner {control.ownerName ?? 'Unassigned'} · Updated {new Date(control.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px]">
                    <label className="space-y-1">
                      <span className="label">Status</span>
                      <select
                        className="input"
                        disabled={savingId === control.id}
                        onChange={(event) =>
                          queueControlUpdate(control, { status: event.target.value }, `Change status to ${event.target.value}`)
                        }
                        value={control.status}
                      >
                        {statusOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="label">Owner</span>
                      <input
                        className="input"
                        disabled={savingId === control.id}
                        onChange={(event) =>
                          setOwnerDrafts((current) => ({
                            ...current,
                            [control.id]: event.target.value,
                          }))
                        }
                        onBlur={(event) =>
                          queueControlUpdate(
                            control,
                            {
                              ownerName: event.target.value.trim() || null,
                            },
                            event.target.value.trim()
                              ? `Assign owner to ${event.target.value.trim()}`
                              : 'Clear the assigned owner',
                          )
                        }
                        placeholder="Security Operations"
                        value={ownerDrafts[control.id] ?? control.ownerName ?? ''}
                      />
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f2e8ff] text-[#7a3ccf]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#241232]">Cloudflare control layers</h2>
                <p className="text-sm text-[#6f6578]">Platform boundaries the canonical deployment depends on.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              {snapshot?.records.cloudflareControls.map((control, index) => {
                const Icon = controlIcons[index] ?? ShieldCheck;
                return (
                  <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4" key={control.title}>
                    <Icon className="h-5 w-5 text-[#7a3ccf]" />
                    <div className="mt-3 font-medium text-[#241232]">{control.title}</div>
                    <div className="mt-2 text-sm text-[#6f6578]">{control.description}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel-subtle">
            <h2 className="text-lg font-semibold text-[#241232]">Access layers</h2>
            <div className="mt-5 space-y-3">
              {snapshot?.records.accessLayers.map((layer) => (
                <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4" key={layer.title}>
                  <div className="font-medium text-[#241232]">{layer.title}</div>
                  <div className="mt-2 text-sm text-[#6f6578]">{layer.description}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel-subtle">
            <h2 className="text-lg font-semibold text-[#241232]">Architecture notes</h2>
            <div className="mt-5 space-y-3 text-sm text-[#4f435c]">
              {snapshot?.records.architecture.map((line) => (
                <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4" key={line}>
                  {line}
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
      <RegModal
        description="Review this setup change before updating the canonical security posture record."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" disabled={Boolean(savingId)} onClick={dismissPendingUpdate} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={!pendingUpdate || savingId === pendingUpdate.control.id}
              onClick={() => pendingUpdate && void updateControl(pendingUpdate.control, pendingUpdate.patch)}
              type="button"
            >
              {pendingUpdate && savingId === pendingUpdate.control.id ? 'Updating...' : 'Update control'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open && !savingId) {
            dismissPendingUpdate();
          }
        }}
        open={Boolean(pendingUpdate)}
        title="Update security control"
      >
        {pendingUpdate ? (
          <div className="space-y-4 text-sm text-[#4f435c]">
            <div className="panel-subtle">
              <div className="label">Control</div>
              <div className="mt-2 font-semibold text-[#241232]">{pendingUpdate.control.title}</div>
              <div className="mt-2 text-[#6f6578]">{pendingUpdate.control.description}</div>
            </div>
            <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="font-semibold text-[#241232]">{pendingUpdate.summary}</div>
              <div className="mt-2 text-[#6f6578]">
                Existing owner: {pendingUpdate.control.ownerName ?? 'Unassigned'} · Existing status:{' '}
                {pendingUpdate.control.status}
              </div>
            </div>
          </div>
        ) : null}
      </RegModal>
    </div>
  );
}
