import { useEffect, useState } from 'react';
import { Copy, KeyRound, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
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
    return <div className="panel p-6 text-sm text-slate-300">Loading service account setup...</div>;
  }

  if (error && !snapshot) {
    return <div className="notice-error">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="eyebrow">Setup</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Service Accounts</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
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
              <div className="mt-2 font-mono text-sm text-white break-all">{revealedToken}</div>
              <div className="mt-2 text-xs text-slate-400">Copy this token now. Only the prefix is stored after issuance.</div>
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
            <button className="button-primary" disabled={saving} onClick={() => void handleCreate()} type="button">
              <KeyRound className="mr-2 h-4 w-4" />
              {saving ? 'Issuing...' : 'Issue token'}
            </button>
          </div>
        </div>

        <section className="panel overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div>
              <div className="eyebrow">Token Inventory</div>
              <p className="mt-1 text-sm text-slate-400">Stored prefixes, runtime scope, and lifecycle posture for automation credentials.</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="divide-y divide-white/6">
            {snapshot?.accounts.map((account) => (
              <div className="flex flex-col gap-3 px-6 py-4" key={account.id}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-white">{account.tokenPrefix}</div>
                      <span className={account.isActive ? 'badge-positive' : 'badge-neutral'}>
                        {account.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="badge-neutral">{account.role}</span>
                    </div>
                    <div className="mt-2 text-sm text-slate-300">{account.purpose}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      Runtime {account.runtime} · Scopes {account.scopes}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Expires {new Date(account.expirationDate).toLocaleDateString()} · Last rotated{' '}
                      {new Date(account.lastRotatedAt).toLocaleString()}
                      {account.lastUsedAt ? ` · Last used ${new Date(account.lastUsedAt).toLocaleString()}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="button-secondary"
                      disabled={busyId === account.id}
                      onClick={() => void handleRotate(account)}
                      type="button"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Rotate
                    </button>
                    <button
                      className="button-secondary"
                      disabled={busyId === account.id}
                      onClick={() => void handleDelete(account.id)}
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
    </div>
  );
}
