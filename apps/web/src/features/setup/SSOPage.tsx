import { useEffect, useState } from 'react';
import { Cloud, Globe2, KeyRound, ShieldCheck } from 'lucide-react';
import { getSetupSso, updateSetupSso } from './api';
import type { SetupSsoSnapshot } from './types';

const providerOptions = ['Google Workspace', 'SAML / Enterprise IdP', 'Cloudflare Access'];
const statusOptions = ['Review', 'Configured', 'Validated', 'Enforced'];

export function SSOPage() {
  const [snapshot, setSnapshot] = useState<SetupSsoSnapshot | null>(null);
  const [providerType, setProviderType] = useState(providerOptions[0]);
  const [domainHint, setDomainHint] = useState('');
  const [clientId, setClientId] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [metadataUrl, setMetadataUrl] = useState('');
  const [groupSyncEnabled, setGroupSyncEnabled] = useState(false);
  const [loginEnforced, setLoginEnforced] = useState(false);
  const [status, setStatus] = useState(statusOptions[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function hydrate(next: SetupSsoSnapshot) {
    setSnapshot(next);
    setProviderType(next.config.providerType);
    setDomainHint(next.config.domainHint);
    setClientId(next.config.clientId);
    setCallbackUrl(next.config.callbackUrl);
    setMetadataUrl(next.config.metadataUrl);
    setGroupSyncEnabled(next.config.groupSyncEnabled);
    setLoginEnforced(next.config.loginEnforced);
    setStatus(next.config.status);
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);
      hydrate(await getSetupSso());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load SSO configuration.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const next = await updateSetupSso({
        providerType,
        domainHint,
        clientId,
        callbackUrl,
        metadataUrl,
        groupSyncEnabled,
        loginEnforced,
        status,
      });
      hydrate(next);
      setNotice('Single sign-on settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save SSO configuration.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading SSO configuration...</div>;
  }

  if (error && !snapshot) {
    return <div className="notice-error">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <div className="eyebrow">Setup</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Single Sign-On</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Configure provider metadata, callback posture, and directory synchronization so tenant access is governed
            before broad login enforcement goes live.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="metric-card">
            <div className="metric-label">Configured providers</div>
            <div className="metric-value">{snapshot?.metrics.configuredProviders ?? 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Callback configured</div>
            <div className="metric-value">{snapshot?.metrics.callbackConfigured ? 'Yes' : 'No'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Group sync</div>
            <div className="metric-value">{snapshot?.metrics.groupSyncEnabled ? 'On' : 'Off'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Login enforced</div>
            <div className="metric-value">{snapshot?.metrics.loginEnforced ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="panel">
          <div className="eyebrow">Provider Configuration</div>
          <div className="mt-4 grid gap-4">
            <label className="space-y-1">
              <span className="label">Provider</span>
              <select className="input" onChange={(event) => setProviderType(event.target.value)} value={providerType}>
                {providerOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label">Domain hint</span>
                <input
                  className="input"
                  onChange={(event) => setDomainHint(event.target.value)}
                  placeholder="example.com"
                  value={domainHint}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Status</span>
                <select className="input" onChange={(event) => setStatus(event.target.value)} value={status}>
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="space-y-1">
              <span className="label">Client ID</span>
              <input
                className="input"
                onChange={(event) => setClientId(event.target.value)}
                placeholder="regovise-production-client"
                value={clientId}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Callback URL</span>
              <input
                className="input"
                onChange={(event) => setCallbackUrl(event.target.value)}
                placeholder="https://regovise.com/auth/callback"
                value={callbackUrl}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Metadata URL</span>
              <input
                className="input"
                onChange={(event) => setMetadataUrl(event.target.value)}
                placeholder="https://idp.example.com/metadata"
                value={metadataUrl}
              />
            </label>
            <div className="grid gap-3">
              <label className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <input
                  checked={groupSyncEnabled}
                  className="mt-1 h-4 w-4 rounded border-white/15 bg-slate-950 text-cyan-400"
                  onChange={() => setGroupSyncEnabled((current) => !current)}
                  type="checkbox"
                />
                <div>
                  <div className="font-medium text-white">Enable group sync</div>
                  <div className="mt-2 text-sm text-slate-400">
                    Import groups only after role mappings and tenant scoping are confirmed.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <input
                  checked={loginEnforced}
                  className="mt-1 h-4 w-4 rounded border-white/15 bg-slate-950 text-cyan-400"
                  onChange={() => setLoginEnforced((current) => !current)}
                  type="checkbox"
                />
                <div>
                  <div className="font-medium text-white">Enforce SSO login</div>
                  <div className="mt-2 text-sm text-slate-400">
                    Lock tenant authentication to the configured provider once testing is complete.
                  </div>
                </div>
              </label>
            </div>
            <button className="button-primary" disabled={saving} onClick={() => void handleSave()} type="button">
              <KeyRound className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save SSO settings'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <Cloud className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Provider readiness</h2>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot?.providerCards.map((card) => (
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4" key={card.name}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{card.name}</div>
                    <span className={card.ready ? 'badge-positive' : 'badge-neutral'}>
                      {card.ready ? 'Ready' : 'Pending'}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">{card.description}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Cutover checklist</h2>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot?.checklist.map((item) => (
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-300" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <Globe2 className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Current deployment target</h2>
            </div>
            <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-300">
              Callback traffic should terminate on <span className="font-medium text-white">regovise.com</span> before
              tenant-wide enforcement is enabled.
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
