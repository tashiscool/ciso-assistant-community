import { useEffect, useState } from 'react';
import { Fingerprint, ShieldCheck, Smartphone, TriangleAlert } from 'lucide-react';
import { getSetupMfa, updateSetupMfa } from './api';
import type { SetupMfaSnapshot } from './types';

const enforcementOptions = ['Optional', 'Admins Only', 'Tenant Wide'];
const statusOptions = ['Planned', 'Rolling Out', 'Enforced'];

export function MFAPage() {
  const [snapshot, setSnapshot] = useState<SetupMfaSnapshot | null>(null);
  const [enforcement, setEnforcement] = useState(enforcementOptions[0]);
  const [methods, setMethods] = useState<Record<string, boolean>>({});
  const [exemptServiceAccounts, setExemptServiceAccounts] = useState('');
  const [gracePeriodDays, setGracePeriodDays] = useState(14);
  const [targetCoverage, setTargetCoverage] = useState(80);
  const [status, setStatus] = useState(statusOptions[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function hydrate(next: SetupMfaSnapshot) {
    setSnapshot(next);
    setEnforcement(next.policy.enforcement);
    setMethods(next.policy.methods);
    setExemptServiceAccounts(next.policy.exemptServiceAccounts.join(', '));
    setGracePeriodDays(next.policy.gracePeriodDays);
    setTargetCoverage(next.policy.targetCoverage);
    setStatus(next.policy.status);
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);
      hydrate(await getSetupMfa());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load MFA configuration.');
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
      const next = await updateSetupMfa({
        enforcement,
        methods,
        exemptServiceAccounts: exemptServiceAccounts
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        gracePeriodDays,
        targetCoverage,
        status,
      });
      hydrate(next);
      setNotice('MFA policy saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save MFA policy.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading MFA policy...</div>;
  }

  if (error && !snapshot) {
    return <div className="notice-error">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <div className="eyebrow">Setup</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Multi-Factor Authentication</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Define enforcement scope, acceptable methods, service-account exceptions, and rollout coverage targets for
            the tenant identity boundary.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="metric-card">
            <div className="metric-label">Methods enabled</div>
            <div className="metric-value">{snapshot?.metrics.methodsEnabled ?? 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Exempt accounts</div>
            <div className="metric-value">{snapshot?.metrics.exemptAccounts ?? 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Target coverage</div>
            <div className="metric-value">{snapshot?.metrics.targetCoverage ?? 0}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Enrollment status</div>
            <div className="metric-value">{snapshot?.metrics.enrollmentStatus ?? 'Planned'}</div>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-[0.98fr_1.02fr]">
        <div className="panel">
          <div className="eyebrow">Policy</div>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label">Enforcement</span>
                <select className="input" onChange={(event) => setEnforcement(event.target.value)} value={enforcement}>
                  {enforcementOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
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
              <span className="label">Grace period (days)</span>
              <input
                className="input"
                min={0}
                onChange={(event) => setGracePeriodDays(Math.max(0, Number(event.target.value || 0)))}
                type="number"
                value={gracePeriodDays}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Target enrollment coverage (%)</span>
              <input
                className="input"
                max={100}
                min={0}
                onChange={(event) => setTargetCoverage(Math.min(100, Math.max(0, Number(event.target.value || 0))))}
                type="number"
                value={targetCoverage}
              />
            </label>
            <div className="space-y-3">
              <span className="label">Methods</span>
              {[
                ['totp', 'Authenticator app / TOTP'],
                ['webauthn', 'Security key / WebAuthn'],
                ['sms', 'SMS fallback'],
                ['email', 'Email fallback'],
              ].map(([key, label]) => (
                <label className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-4" key={key}>
                  <input
                    checked={Boolean(methods[key])}
                    className="mt-1 h-4 w-4 rounded border-white/15 bg-slate-950 text-cyan-400"
                    onChange={() => setMethods((current) => ({ ...current, [key]: !current[key] }))}
                    type="checkbox"
                  />
                  <div>
                    <div className="font-medium text-white">{label}</div>
                  </div>
                </label>
              ))}
            </div>
            <label className="space-y-1">
              <span className="label">Exempt service-account prefixes</span>
              <input
                className="input"
                onChange={(event) => setExemptServiceAccounts(event.target.value)}
                placeholder="svc-import, svc-export"
                value={exemptServiceAccounts}
              />
            </label>
            <button className="button-primary" disabled={saving} onClick={() => void handleSave()} type="button">
              <ShieldCheck className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save MFA policy'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <Fingerprint className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Coverage guidance</h2>
            </div>
            <div className="mt-5 grid gap-3">
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="font-medium text-white">Preferred methods</div>
                <div className="mt-2 text-sm text-slate-400">
                  Favor phishing-resistant methods like WebAuthn, then TOTP for the broadest workforce coverage.
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="font-medium text-white">Exception handling</div>
                <div className="mt-2 text-sm text-slate-400">
                  Keep service-account exceptions explicit, short-lived, and tied to automation owners.
                </div>
              </div>
            </div>
          </section>

          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Recommendations</h2>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot?.recommendations.map((item) => (
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-300" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <TriangleAlert className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Current posture</h2>
            </div>
            <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-300">
              MFA rollout is currently tracked as <span className="font-medium text-white">{status}</span> with a target
              enrollment threshold of <span className="font-medium text-white">{targetCoverage}%</span>.
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
