import { useEffect, useState } from 'react';
import { Copy, KeyRound, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { RegModal } from '../../components/regovise/PagePrimitives';
import {
  createSetupServiceAccount,
  deleteSetupServiceAccount,
  getSetupServiceAccounts,
  rotateSetupServiceAccount,
} from './api';
import type { SetupServiceAccountRecord, SetupServiceAccountsSnapshot } from './types';

const defaultDraft = {
  purpose: '',
  role: 'Automation Operator' as 'Administrator' | 'Automation Operator' | 'Read Only',
  durationDays: 90,
};

export function ServiceAccountsPage() {
  const [snapshot, setSnapshot] = useState<SetupServiceAccountsSnapshot | null>(null);
  const [draft, setDraft] = useState(defaultDraft);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingCreateOpen, setPendingCreateOpen] = useState(false);
  const [pendingRotate, setPendingRotate] = useState<SetupServiceAccountRecord | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<SetupServiceAccountRecord | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setSnapshot(await getSetupServiceAccounts());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load service accounts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate() {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const next = await createSetupServiceAccount(draft);
      setSnapshot(next);
      setRevealedToken(next.newlyIssuedToken?.tokenValue ?? null);
      setDraft(defaultDraft);
      setPendingCreateOpen(false);
      setNotice('Service account issued from the canonical setup service. Copy the token now; it is shown once.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create service account.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRotate(account: SetupServiceAccountRecord) {
    try {
      setBusyId(account.id);
      setError(null);
      setNotice(null);
      const next = await rotateSetupServiceAccount(account.id, {
        durationDays: 90,
      });
      setSnapshot(next);
      setRevealedToken(next.newlyIssuedToken?.tokenValue ?? null);
      setPendingRotate(null);
      setNotice(`Service account ${account.tokenPrefix} rotated successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to rotate service account.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(accountId: string) {
    try {
      setBusyId(accountId);
      setError(null);
      setNotice(null);
      setSnapshot(await deleteSetupServiceAccount(accountId));
      setNotice('Service account deactivated.');
      setPendingDeactivate(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to deactivate service account.');
    } finally {
      setBusyId(null);
    }
  }

  async function copyToken() {
    if (!revealedToken) {
      return;
    }

    await navigator.clipboard.writeText(revealedToken);
    setNotice('Token copied to clipboard.');
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading service account setup...</div>;
  }

  if (error && !snapshot) {
    return <div className="notice-error">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="eyebrow">Setup</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#241232]">Service Accounts</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
            Issue and rotate scoped automation credentials for imports, exports, orchestration, and tenant-safe
            machine access.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="metric-card">
            <div className="metric-label">Active tokens</div>
            <div className="metric-value">{snapshot?.metrics.activeTokens ?? 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Expiring soon</div>
            <div className="metric-value">{snapshot?.metrics.expiringSoon ?? 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Admin tokens</div>
            <div className="metric-value">{snapshot?.metrics.adminTokens ?? 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Longest TTL</div>
            <div className="metric-value">{snapshot?.metrics.longestTtlDays ?? 0}d</div>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      {revealedToken && (
        <section className="panel-subtle">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="eyebrow">One-Time Secret</div>
              <div className="mt-2 font-mono text-sm text-[#241232] break-all">{revealedToken}</div>
              <div className="mt-2 text-xs text-[#6f6578]">Copy this token now. Only the prefix is stored after issuance.</div>
            </div>
            <button className="button-primary" onClick={() => void copyToken()} type="button">
              <Copy className="mr-2 h-4 w-4" />
              Copy token
            </button>
          </div>
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="panel">
          <div className="eyebrow">Issue Service Account</div>
          <div className="mt-4 grid gap-4">
            <label className="space-y-1">
              <span className="label">Purpose</span>
              <input
                className="input"
                onChange={(event) => setDraft((current) => ({ ...current, purpose: event.target.value }))}
                placeholder="Nightly vulnerability import"
                value={draft.purpose}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label">Role</span>
                <select
                  className="input"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      role: event.target.value as 'Administrator' | 'Automation Operator' | 'Read Only',
                    }))
                  }
                  value={draft.role}
                >
                  <option value="Administrator">Administrator</option>
                  <option value="Automation Operator">Automation Operator</option>
                  <option value="Read Only">Read Only</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Duration (days)</span>
                <input
                  className="input"
                  min={1}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      durationDays: Math.max(1, Number(event.target.value || 0)),
                    }))
                  }
                  type="number"
                  value={draft.durationDays}
                />
              </label>
            </div>
            <button className="button-primary" disabled={saving} onClick={() => setPendingCreateOpen(true)} type="button">
              <KeyRound className="mr-2 h-4 w-4" />
              {saving ? 'Issuing...' : 'Issue token'}
            </button>
          </div>
        </div>

        <section className="panel overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[#ded8e4] px-6 py-4">
            <div>
              <div className="eyebrow">Token Inventory</div>
              <p className="mt-1 text-sm text-[#6f6578]">Stored prefixes, runtime scope, and lifecycle posture for automation credentials.</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-[#7a3ccf]" />
          </div>
          <div className="divide-y divide-[#ded8e4]">
            {snapshot?.accounts.map((account) => (
              <div className="flex flex-col gap-3 px-6 py-4" key={account.id}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-[#241232]">{account.tokenPrefix}</div>
                      <span className={account.isActive ? 'status-pill-positive' : 'status-pill-neutral'}>
                        {account.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="status-pill-neutral">{account.role}</span>
                    </div>
                    <div className="mt-2 text-sm text-[#4f435c]">{account.purpose}</div>
                    <div className="mt-2 text-xs text-[#62576a]">
                      Runtime {account.runtime} · Scopes {account.scopes}
                    </div>
                    <div className="mt-2 text-xs text-[#62576a]">
                      Expires {new Date(account.expirationDate).toLocaleDateString()} · Last rotated{' '}
                      {new Date(account.lastRotatedAt).toLocaleString()}
                      {account.lastUsedAt ? ` · Last used ${new Date(account.lastUsedAt).toLocaleString()}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="button-secondary"
                      disabled={busyId === account.id}
                      onClick={() => setPendingRotate(account)}
                      type="button"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Rotate
                    </button>
                    <button
                      className="button-secondary"
                      disabled={busyId === account.id}
                      onClick={() => setPendingDeactivate(account)}
                      type="button"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Deactivate
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <RegModal
        description="Issue a new machine credential for this workspace. The token will only be shown once."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" disabled={saving} onClick={() => setPendingCreateOpen(false)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={saving} onClick={() => void handleCreate()} type="button">
              {saving ? 'Issuing...' : 'Issue token'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open && !saving) {
            setPendingCreateOpen(false);
          }
        }}
        open={pendingCreateOpen}
        title="Issue service account token"
      >
        <div className="space-y-4 text-sm text-[#4f435c]">
          <div className="notice-warning">
            Copy the token after issuance. Regovise stores only the prefix and cannot display the secret again.
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="panel-subtle">
              <dt className="label">Role</dt>
              <dd className="mt-2 text-[#241232]">{draft.role}</dd>
            </div>
            <div className="panel-subtle">
              <dt className="label">Duration</dt>
              <dd className="mt-2 text-[#241232]">{draft.durationDays} days</dd>
            </div>
            <div className="panel-subtle sm:col-span-2">
              <dt className="label">Purpose</dt>
              <dd className="mt-2 text-[#4f435c]">{draft.purpose || 'No purpose supplied'}</dd>
            </div>
          </dl>
        </div>
      </RegModal>

      <RegModal
        description="Rotate this credential and issue a replacement token with the same service-account posture."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" disabled={Boolean(busyId)} onClick={() => setPendingRotate(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={!pendingRotate || busyId === pendingRotate.id}
              onClick={() => pendingRotate && void handleRotate(pendingRotate)}
              type="button"
            >
              {pendingRotate && busyId === pendingRotate.id ? 'Rotating...' : 'Rotate token'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open && !busyId) {
            setPendingRotate(null);
          }
        }}
        open={Boolean(pendingRotate)}
        title="Rotate service account"
      >
        {pendingRotate ? (
          <div className="space-y-4 text-sm text-[#4f435c]">
            <div className="notice-warning">
              Jobs using the old secret must be updated with the newly issued token after rotation.
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="panel-subtle">
                <dt className="label">Token prefix</dt>
                <dd className="mt-2 font-mono text-[#241232]">{pendingRotate.tokenPrefix}</dd>
              </div>
              <div className="panel-subtle">
                <dt className="label">Role</dt>
                <dd className="mt-2 text-[#241232]">{pendingRotate.role}</dd>
              </div>
              <div className="panel-subtle sm:col-span-2">
                <dt className="label">Purpose</dt>
                <dd className="mt-2 text-[#4f435c]">{pendingRotate.purpose}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </RegModal>

      <RegModal
        description="Deactivate this automation credential before it can be used for imports, exports, or tenant operations."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setPendingDeactivate(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={!pendingDeactivate || busyId === pendingDeactivate.id}
              onClick={() => pendingDeactivate && void handleDelete(pendingDeactivate.id)}
              type="button"
            >
              {pendingDeactivate && busyId === pendingDeactivate.id ? 'Deactivating...' : 'Deactivate token'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeactivate(null);
          }
        }}
        open={Boolean(pendingDeactivate)}
        title="Deactivate service account"
      >
        {pendingDeactivate ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#f2b7bf] bg-[#ffe2e5] px-4 py-3 text-sm text-[#9d1f2c]">
              This action disables the token immediately. Existing jobs that use this prefix will fail until
              they are updated with a new credential.
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="panel-subtle">
                <dt className="label">Token prefix</dt>
                <dd className="mt-2 font-mono text-[#241232]">{pendingDeactivate.tokenPrefix}</dd>
              </div>
              <div className="panel-subtle">
                <dt className="label">Role</dt>
                <dd className="mt-2 text-[#241232]">{pendingDeactivate.role}</dd>
              </div>
              <div className="panel-subtle sm:col-span-2">
                <dt className="label">Purpose</dt>
                <dd className="mt-2 text-[#4f435c]">{pendingDeactivate.purpose}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </RegModal>
    </div>
  );
}
