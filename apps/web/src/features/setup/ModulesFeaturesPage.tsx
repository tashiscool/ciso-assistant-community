import { useEffect, useState } from 'react';
import { Bot, CheckCircle2, Layers3, ShieldCheck, Sparkles } from 'lucide-react';
import { getSetupModulesFeatures, updateSetupModulesFeatures } from './api';
import type { SetupFeatureFlagRecord, SetupModuleRecord, SetupModulesFeaturesSnapshot } from './types';

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

export function ModulesFeaturesPage() {
  const [snapshot, setSnapshot] = useState<SetupModulesFeaturesSnapshot | null>(null);
  const [enabledModuleIds, setEnabledModuleIds] = useState<string[]>([]);
  const [enabledFeatureFlagIds, setEnabledFeatureFlagIds] = useState<string[]>([]);
  const [regmlEnabled, setRegmlEnabled] = useState(false);
  const [regmlTermsAccepted, setRegmlTermsAccepted] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function hydrate(next: SetupModulesFeaturesSnapshot) {
    setSnapshot(next);
    setEnabledModuleIds(next.modules.filter((module) => module.enabled).map((module) => module.id));
    setEnabledFeatureFlagIds(next.featureFlags.filter((feature) => feature.enabled).map((feature) => feature.id));
    setRegmlEnabled(next.readiness.regmlEnabled);
    setRegmlTermsAccepted(next.readiness.regmlTermsAccepted);
    setStatusNote(next.statusNote);
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);
      hydrate(await getSetupModulesFeatures());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load module enablement.');
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
      const next = await updateSetupModulesFeatures({
        enabledModuleIds,
        enabledFeatureFlagIds,
        regmlEnabled,
        regmlTermsAccepted,
        statusNote,
      });
      hydrate(next);
      setNotice('Modules, feature flags, and RegML readiness saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save modules and features.');
    } finally {
      setSaving(false);
    }
  }

  function toggleModule(module: SetupModuleRecord) {
    setEnabledModuleIds((current) => toggleId(current, module.id));
  }

  function toggleFeature(feature: SetupFeatureFlagRecord) {
    if (feature.id === 'regml') {
      const nextEnabled = !regmlEnabled;
      setRegmlEnabled(nextEnabled);
      setEnabledFeatureFlagIds((current) => {
        const next = nextEnabled ? [...new Set([...current, feature.id])] : current.filter((item) => item !== feature.id);
        return next;
      });
      if (!nextEnabled) {
        setRegmlTermsAccepted(false);
      }
      return;
    }

    setEnabledFeatureFlagIds((current) => toggleId(current, feature.id));
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading modules and features...</div>;
  }

  if (error && !snapshot) {
    return <div className="notice-error">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="eyebrow">Setup</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Modules and Features</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Control which product areas are visible to the tenant and align AI feature readiness with identity and
            security posture before exposing them in production.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="metric-card">
            <div className="metric-label">Enabled modules</div>
            <div className="metric-value">{snapshot?.metrics.enabledModules ?? 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Disabled modules</div>
            <div className="metric-value">{snapshot?.metrics.disabledModules ?? 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Feature flags</div>
            <div className="metric-value">{snapshot?.metrics.enabledFeatureFlags ?? 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">RegML ready</div>
            <div className="metric-value">{snapshot?.metrics.regmlReady ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="space-y-4">
          <section className="panel overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <div className="eyebrow">Modules</div>
                <p className="mt-1 text-sm text-slate-400">Turn core functional areas on or off for this tenant.</p>
              </div>
              <Layers3 className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="divide-y divide-white/6">
              {snapshot?.modules.map((module) => {
                const isEnabled = enabledModuleIds.includes(module.id);
                return (
                  <label className="flex cursor-pointer gap-4 px-6 py-4" key={module.id}>
                    <input
                      checked={isEnabled}
                      className="mt-1 h-4 w-4 rounded border-white/15 bg-slate-950 text-cyan-400"
                      onChange={() => toggleModule(module)}
                      type="checkbox"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-white">{module.name}</div>
                        <span className="badge-neutral">{module.category}</span>
                        <span className={isEnabled ? 'badge-positive' : 'badge-neutral'}>
                          {isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-300">{module.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="panel overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <div className="eyebrow">Feature Flags</div>
                <p className="mt-1 text-sm text-slate-400">AI-adjacent capabilities coordinated with setup posture.</p>
              </div>
              <Sparkles className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="divide-y divide-white/6">
              {snapshot?.featureFlags.map((feature) => {
                const isEnabled = feature.id === 'regml' ? regmlEnabled : enabledFeatureFlagIds.includes(feature.id);
                return (
                  <label className="flex cursor-pointer gap-4 px-6 py-4" key={feature.id}>
                    <input
                      checked={isEnabled}
                      className="mt-1 h-4 w-4 rounded border-white/15 bg-slate-950 text-cyan-400"
                      onChange={() => toggleFeature(feature)}
                      type="checkbox"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-white">{feature.name}</div>
                        <span className={isEnabled ? 'badge-positive' : 'badge-neutral'}>
                          {isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-300">{feature.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">RegML readiness</h2>
                <p className="text-sm text-slate-400">Tie AI controls to identity and acceptance state.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <label className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <input
                  checked={regmlEnabled}
                  className="mt-1 h-4 w-4 rounded border-white/15 bg-slate-950 text-cyan-400"
                  onChange={() => {
                    const nextEnabled = !regmlEnabled;
                    setRegmlEnabled(nextEnabled);
                    setEnabledFeatureFlagIds((current) =>
                      nextEnabled ? [...new Set([...current, 'regml'])] : current.filter((item) => item !== 'regml'),
                    );
                    if (!nextEnabled) {
                      setRegmlTermsAccepted(false);
                    }
                  }}
                  type="checkbox"
                />
                <div>
                  <div className="font-medium text-white">Enable RegML</div>
                  <div className="mt-2 text-sm text-slate-400">
                    Allows AI-assisted authoring, analysis, and SSP generation surfaces to run for this tenant.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <input
                  checked={regmlTermsAccepted}
                  className="mt-1 h-4 w-4 rounded border-white/15 bg-slate-950 text-cyan-400"
                  disabled={!regmlEnabled}
                  onChange={() => setRegmlTermsAccepted((current) => !current)}
                  type="checkbox"
                />
                <div>
                  <div className="font-medium text-white">Terms accepted</div>
                  <div className="mt-2 text-sm text-slate-400">
                    Required before authors or auditors can launch RegML workspaces.
                  </div>
                </div>
              </label>
            </div>
          </section>

          <section className="panel-subtle">
            <h2 className="text-lg font-semibold text-white">Readiness signals</h2>
            <div className="mt-5 space-y-3">
              {[
                { label: 'RegML enabled', ready: snapshot?.readiness.regmlEnabled ?? false },
                { label: 'RegML terms accepted', ready: snapshot?.readiness.regmlTermsAccepted ?? false },
                { label: 'SSO configured', ready: snapshot?.readiness.ssoConfigured ?? false },
                { label: 'MFA configured', ready: snapshot?.readiness.mfaConfigured ?? false },
              ].map((item) => (
                <div
                  className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/30 p-4"
                  key={item.label}
                >
                  <div className="text-sm text-slate-300">{item.label}</div>
                  <span className={item.ready ? 'badge-positive' : 'badge-neutral'}>
                    {item.ready ? 'Ready' : 'Needs setup'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Operator note</h2>
            </div>
            <textarea
              className="input mt-4 min-h-32 resize-y"
              onChange={(event) => setStatusNote(event.target.value)}
              placeholder="Capture rollout notes, dependencies, or enablement caveats..."
              value={statusNote}
            />
          </section>

          <button className="button-primary w-full" disabled={saving} onClick={() => void handleSave()} type="button">
            <ShieldCheck className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save modules and features'}
          </button>
        </div>
      </section>
    </div>
  );
}
