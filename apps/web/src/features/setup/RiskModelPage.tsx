import { useEffect, useState } from 'react';
import { AlertTriangle, LayoutGrid, Save, ShieldAlert, ShieldCheck } from 'lucide-react';
import { getSetupRiskModel, updateSetupRiskModel } from './api';
import type { SetupRiskModelSnapshot } from './types';

const modelTypeOptions = ['Semi-Quantitative', 'Qualitative', 'Quantitative'];
const formulaPresetOptions = ['Likelihood x Impact', 'Weighted matrix', 'Highest factor wins'];
const residualMethodOptions = ['Recalculate from adjusted likelihood and impact', 'Reviewer attestation only'];
const inheritedMethodOptions = ['Blend inherited and local controls', 'Inherited controls dominate', 'Local controls dominate'];
const ownerRoleOptions = ['System Owner', 'Control Owner', 'Risk Manager'];
const thresholdOptions = ['Monitor', 'Mitigate', 'Avoid'];

const defaultDraft = {
  modelType: 'Semi-Quantitative',
  likelihoodScale: 5,
  impactScale: 5,
  acceptableMax: 6,
  monitorMax: 10,
  mitigateMax: 16,
  formulaPreset: 'Likelihood x Impact',
  residualRiskMethod: 'Recalculate from adjusted likelihood and impact',
  inheritedRiskMethod: 'Blend inherited and local controls',
  riskOwnerRole: 'System Owner',
  autoEscalationEnabled: true,
  autoEscalationThreshold: 'Avoid',
  autoEscalationDays: 14,
};

export function RiskModelPage() {
  const [snapshot, setSnapshot] = useState<SetupRiskModelSnapshot | null>(null);
  const [draft, setDraft] = useState(defaultDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function hydrate(next: SetupRiskModelSnapshot) {
    setSnapshot(next);
    setDraft({
      modelType: next.config.modelType,
      likelihoodScale: next.config.likelihoodScale,
      impactScale: next.config.impactScale,
      acceptableMax: next.config.acceptableMax,
      monitorMax: next.config.monitorMax,
      mitigateMax: next.config.mitigateMax,
      formulaPreset: next.config.formulaPreset,
      residualRiskMethod: next.config.residualRiskMethod,
      inheritedRiskMethod: next.config.inheritedRiskMethod,
      riskOwnerRole: next.config.riskOwnerRole,
      autoEscalationEnabled: next.config.autoEscalationEnabled,
      autoEscalationThreshold: next.config.autoEscalationThreshold,
      autoEscalationDays: next.config.autoEscalationDays,
    });
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);
      hydrate(await getSetupRiskModel());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load risk model.');
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
      const next = await updateSetupRiskModel(draft);
      hydrate(next);
      setNotice('Risk model saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save risk model.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading risk model...</div>;
  }

  if (error && !snapshot) {
    return <div className="notice-error">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <div className="eyebrow">Setup</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Risk Model</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Define the tenant scoring methodology, appetite bands, and escalation posture so canonical risk workflows
            resolve from one explainable source of truth.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="metric-card">
            <div className="metric-label">Model type</div>
            <div className="metric-value">{snapshot?.metrics.modelType ?? 'Unset'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Scale size</div>
            <div className="metric-value">{snapshot?.metrics.scaleSize ?? '5x5'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Escalation</div>
            <div className="metric-value">{snapshot?.metrics.escalationEnabled ? 'On' : 'Off'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Threshold</div>
            <div className="metric-value">{snapshot?.metrics.threshold ?? 'Avoid'}</div>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="panel">
          <div className="eyebrow">Scoring controls</div>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label">Model type</span>
                <select className="input" value={draft.modelType} onChange={(e) => setDraft((c) => ({ ...c, modelType: e.target.value }))}>
                  {modelTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Formula preset</span>
                <select className="input" value={draft.formulaPreset} onChange={(e) => setDraft((c) => ({ ...c, formulaPreset: e.target.value }))}>
                  {formulaPresetOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Likelihood scale</span>
                <input className="input" min={3} max={7} type="number" value={draft.likelihoodScale} onChange={(e) => setDraft((c) => ({ ...c, likelihoodScale: Number(e.target.value || 5) }))} />
              </label>
              <label className="space-y-1">
                <span className="label">Impact scale</span>
                <input className="input" min={3} max={7} type="number" value={draft.impactScale} onChange={(e) => setDraft((c) => ({ ...c, impactScale: Number(e.target.value || 5) }))} />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="label">Acceptable max</span>
                <input className="input" type="number" value={draft.acceptableMax} onChange={(e) => setDraft((c) => ({ ...c, acceptableMax: Number(e.target.value || 0) }))} />
              </label>
              <label className="space-y-1">
                <span className="label">Monitor max</span>
                <input className="input" type="number" value={draft.monitorMax} onChange={(e) => setDraft((c) => ({ ...c, monitorMax: Number(e.target.value || 0) }))} />
              </label>
              <label className="space-y-1">
                <span className="label">Mitigate max</span>
                <input className="input" type="number" value={draft.mitigateMax} onChange={(e) => setDraft((c) => ({ ...c, mitigateMax: Number(e.target.value || 0) }))} />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label">Residual risk method</span>
                <select className="input" value={draft.residualRiskMethod} onChange={(e) => setDraft((c) => ({ ...c, residualRiskMethod: e.target.value }))}>
                  {residualMethodOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Inherited risk method</span>
                <select className="input" value={draft.inheritedRiskMethod} onChange={(e) => setDraft((c) => ({ ...c, inheritedRiskMethod: e.target.value }))}>
                  {inheritedMethodOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Risk owner role</span>
                <select className="input" value={draft.riskOwnerRole} onChange={(e) => setDraft((c) => ({ ...c, riskOwnerRole: e.target.value }))}>
                  {ownerRoleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Escalation threshold</span>
                <select className="input" value={draft.autoEscalationThreshold} onChange={(e) => setDraft((c) => ({ ...c, autoEscalationThreshold: e.target.value }))}>
                  {thresholdOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>

            <label className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <input
                checked={draft.autoEscalationEnabled}
                className="mt-1 h-4 w-4 rounded border-white/15 bg-slate-950 text-cyan-400"
                onChange={() => setDraft((c) => ({ ...c, autoEscalationEnabled: !c.autoEscalationEnabled }))}
                type="checkbox"
              />
              <div>
                <div className="font-medium text-white">Enable auto escalation</div>
                <div className="mt-2 text-sm text-slate-400">Automatically escalate high-severity risks after the configured threshold window.</div>
              </div>
            </label>

            <label className="space-y-1">
              <span className="label">Escalation days</span>
              <input className="input" type="number" min={1} max={90} value={draft.autoEscalationDays} onChange={(e) => setDraft((c) => ({ ...c, autoEscalationDays: Number(e.target.value || 14) }))} />
            </label>

            <button className="button-primary" disabled={saving} onClick={() => void handleSave()} type="button">
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save risk model'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Governance signals</h2>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot?.records.governanceSignals.map((item) => (
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4" key={item.title}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{item.title}</div>
                    <span className={item.status === 'Active' || item.status === 'Deterministic' || item.status === 'Configured' ? 'badge-positive' : 'badge-neutral'}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">{item.detail}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <LayoutGrid className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Threshold bands</h2>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot?.records.thresholdBands.map((item) => (
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4" key={item.label}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{item.label}</div>
                    <span className="badge-neutral">{item.value}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">{item.hint}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Runtime contracts</h2>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot?.records.runtimeContracts.map((item) => (
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-300" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
