import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { getSetupRiskModel } from '../setup/api';
import type { SetupRiskModelSnapshot } from '../setup/types';

type ThreatModelsPageProps = {
  canConfigureModel: boolean;
  canUseRiskAssessments: boolean;
};

type RiskRegister = {
  id: string;
  name: string;
  description: string | null;
  folderName: string | null;
  updatedAt: string;
};

type RiskScenario = {
  id: string;
  registerName: string;
  title: string;
  description: string | null;
  likelihood: number | null;
  impact: number | null;
  inherentScore: number | null;
  residualScore: number | null;
  status: string;
  updatedAt: string;
};

type RegisterSummary = {
  registerName: string;
  folderName: string | null;
  description: string | null;
  scenarioCount: number;
  openCount: number;
  elevatedCount: number;
  maxScore: number | null;
  updatedAt: string | null;
};

const client = new ApiClient();

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : 'n/a';
}

function formatScore(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? 'n/a' : `${value}`;
}

function normalizeStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function formatStatusLabel(value: string) {
  if (!value) {
    return 'Unspecified';
  }
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function ThreatModelsPage({ canConfigureModel, canUseRiskAssessments }: ThreatModelsPageProps) {
  const [riskModel, setRiskModel] = useState<SetupRiskModelSnapshot | null>(null);
  const [registers, setRegisters] = useState<RiskRegister[]>([]);
  const [scenarios, setScenarios] = useState<RiskScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const nextWarnings: string[] = [];
        const [riskModelResult, registerResult, scenarioResult] = await Promise.allSettled([
          canConfigureModel ? getSetupRiskModel() : Promise.resolve<SetupRiskModelSnapshot | null>(null),
          client.get<{ data: RiskRegister[] }>('/core/risk-registers'),
          client.get<{ data: RiskScenario[] }>('/core/risk-scenarios'),
        ]);

        if (cancelled) {
          return;
        }

        if (riskModelResult.status === 'fulfilled') {
          setRiskModel(riskModelResult.value);
        } else if (canConfigureModel) {
          nextWarnings.push('Risk model summary is temporarily unavailable.');
        } else {
          nextWarnings.push('Risk model configuration is available to workspace admins.');
        }

        if (registerResult.status === 'fulfilled') {
          setRegisters(registerResult.value.data);
        } else {
          nextWarnings.push('Threat-model registers could not be loaded right now.');
        }

        if (scenarioResult.status === 'fulfilled') {
          setScenarios(scenarioResult.value.data);
        } else {
          nextWarnings.push('Threat-model scenarios could not be loaded right now.');
        }

        if (registerResult.status === 'rejected' && scenarioResult.status === 'rejected') {
          setError('Unable to load the threat model workspace right now.');
        }

        setWarnings(nextWarnings);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [canConfigureModel]);

  const threshold = riskModel?.config.mitigateMax ?? 16;
  const openScenarios = scenarios.filter((scenario) => normalizeStatus(scenario.status) !== 'closed');
  const elevatedScenarios = scenarios.filter((scenario) => {
    const score = scenario.residualScore ?? scenario.inherentScore ?? 0;
    return score >= threshold;
  });
  const monitoredScenarios = scenarios.filter((scenario) => {
    const status = normalizeStatus(scenario.status);
    return status === 'monitor' || status === 'monitoring' || status === 'accepted';
  });
  const residualScoredScenarios = scenarios.filter((scenario) => scenario.residualScore != null);
  const describedScenarios = scenarios.filter((scenario) => scenario.description?.trim());
  const recentScenarios = useMemo(() => {
    return [...scenarios]
      .sort((left, right) => {
        const leftScore = left.residualScore ?? left.inherentScore ?? -1;
        const rightScore = right.residualScore ?? right.inherentScore ?? -1;
        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      })
      .slice(0, 5);
  }, [scenarios]);
  const statusBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const scenario of scenarios) {
      const status = normalizeStatus(scenario.status) || 'unspecified';
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((left, right) => right.count - left.count || left.status.localeCompare(right.status));
  }, [scenarios]);
  const registerSummaries = useMemo(() => {
    const summaryByName = new Map<string, RegisterSummary>();

    for (const register of registers) {
      summaryByName.set(register.name, {
        registerName: register.name,
        folderName: register.folderName,
        description: register.description,
        scenarioCount: 0,
        openCount: 0,
        elevatedCount: 0,
        maxScore: null,
        updatedAt: register.updatedAt,
      });
    }

    for (const scenario of scenarios) {
      const key = scenario.registerName || 'Unassigned register';
      const existing = summaryByName.get(key) ?? {
        registerName: key,
        folderName: null,
        description: null,
        scenarioCount: 0,
        openCount: 0,
        elevatedCount: 0,
        maxScore: null,
        updatedAt: null,
      };
      const score = scenario.residualScore ?? scenario.inherentScore;
      summaryByName.set(key, {
        ...existing,
        scenarioCount: existing.scenarioCount + 1,
        openCount: existing.openCount + (normalizeStatus(scenario.status) === 'closed' ? 0 : 1),
        elevatedCount: existing.elevatedCount + ((score ?? 0) >= threshold ? 1 : 0),
        maxScore:
          score == null
            ? existing.maxScore
            : existing.maxScore == null
              ? score
              : Math.max(existing.maxScore, score),
        updatedAt:
          existing.updatedAt == null ||
          new Date(scenario.updatedAt).getTime() > new Date(existing.updatedAt).getTime()
            ? scenario.updatedAt
            : existing.updatedAt,
      });
    }

    return [...summaryByName.values()].sort((left, right) => {
      if (right.scenarioCount !== left.scenarioCount) {
        return right.scenarioCount - left.scenarioCount;
      }
      const rightScore = right.maxScore ?? -1;
      const leftScore = left.maxScore ?? -1;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return left.registerName.localeCompare(right.registerName);
    });
  }, [registers, scenarios, threshold]);
  const modeledRegisters = registerSummaries.filter((summary) => summary.scenarioCount > 0);
  const assessmentReadyCount = scenarios.filter((scenario) => {
    const status = normalizeStatus(scenario.status);
    return status === 'monitor' || status === 'monitoring' || status === 'accepted' || status === 'mitigate';
  }).length;
  const runtimeContracts = riskModel?.records.runtimeContracts ?? [];
  const maxScaleScore = (riskModel?.config.likelihoodScale ?? 0) * (riskModel?.config.impactScale ?? 0);

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading threat model workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <div className="eyebrow">Risk Modeling</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Threat Models</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Threat models provide a structured way to analyze threats, vulnerabilities, and security scenarios so teams
            can prioritize mitigations, strengthen system designs, and apply the right risk workflow to the right system.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {canUseRiskAssessments ? (
              <Link className="button-primary" to="/risk-scenarios">
                Open scenario workspace
              </Link>
            ) : (
              <span className="button-secondary opacity-70">Scenario workspace requires risk assessment access</span>
            )}
            {canConfigureModel ? (
              <Link className="button-secondary" to="/setup/risk-model">
                Configure risk model
              </Link>
            ) : (
              <span className="button-secondary opacity-70">Risk model setup is limited to workspace admins</span>
            )}
            {canUseRiskAssessments ? (
              <Link className="button-secondary" to="/risk-assessments">
                Apply in assessments
              </Link>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="metric-card">
            <div className="metric-label">Model type</div>
            <div className="metric-value">{riskModel?.metrics.modelType ?? 'Unavailable'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Scale size</div>
            <div className="metric-value">{riskModel?.metrics.scaleSize ?? 'n/a'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Registers</div>
            <div className="metric-value">{registers.length}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Scenarios</div>
            <div className="metric-value">{scenarios.length}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Open scenarios</div>
            <div className="metric-value">{openScenarios.length}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Elevated exposure</div>
            <div className="metric-value">{elevatedScenarios.length}</div>
          </div>
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}
      {warnings.length > 0 && (
        <div className="panel-subtle space-y-2 text-sm text-slate-300">
          <div className="eyebrow">Workspace Notes</div>
          {warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-6">
          <section className="panel">
            <div className="eyebrow">How Threat Models Work</div>
            <div className="mt-4 grid gap-3">
              <div className="panel-subtle">
                <div className="font-medium text-white">1. Define the modeling logic</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">
                  Set the tenant risk methodology, scoring scales, escalation posture, and threshold bands so every modeled
                  scenario is evaluated from one explainable baseline.
                </div>
              </div>
              <div className="panel-subtle">
                <div className="font-medium text-white">2. Build the scenario portfolio</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">
                  Use threat-model registers as reusable modeling lanes for business domains, applications, or shared
                  services, then capture the scenarios that describe likely attack paths, vulnerable conditions, and
                  material business consequences.
                </div>
              </div>
              <div className="panel-subtle">
                <div className="font-medium text-white">3. Review model posture and reusable coverage</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">
                  Track which registers are actively modeled, which scenarios carry residual scoring, and where elevated
                  exposure still needs mitigation or review before teams reuse the model elsewhere.
                </div>
              </div>
              <div className="panel-subtle">
                <div className="font-medium text-white">4. Apply the model in system risk workflows</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">
                  Carry the tenant scoring contract and modeled scenarios into risk assessments so system owners can apply
                  the same taxonomy, treatment expectations, and escalation posture consistently.
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="eyebrow">Scenario Portfolio</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="panel-subtle">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Open</div>
                <div className="mt-2 text-2xl font-semibold text-white">{openScenarios.length}</div>
                <div className="mt-1 text-sm text-slate-400">Scenarios still in active analysis or treatment</div>
              </div>
              <div className="panel-subtle">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Elevated</div>
                <div className="mt-2 text-2xl font-semibold text-white">{elevatedScenarios.length}</div>
                <div className="mt-1 text-sm text-slate-400">Scenarios at or above the tenant mitigation threshold</div>
              </div>
              <div className="panel-subtle">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Monitoring</div>
                <div className="mt-2 text-2xl font-semibold text-white">{monitoredScenarios.length}</div>
                <div className="mt-1 text-sm text-slate-400">Scenarios sitting in monitor or accepted posture</div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="panel-subtle">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Residual scored</div>
                <div className="mt-2 text-2xl font-semibold text-white">{residualScoredScenarios.length}</div>
                <div className="mt-1 text-sm text-slate-400">Scenarios with explicit residual-risk posture captured</div>
              </div>
              <div className="panel-subtle">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Assessment ready</div>
                <div className="mt-2 text-2xl font-semibold text-white">{assessmentReadyCount}</div>
                <div className="mt-1 text-sm text-slate-400">Scenarios already sitting in monitor, accepted, or mitigate flow</div>
              </div>
              <div className="panel-subtle">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Described</div>
                <div className="mt-2 text-2xl font-semibold text-white">{describedScenarios.length}</div>
                <div className="mt-1 text-sm text-slate-400">Scenarios with narrative context captured for reviewer reuse</div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {recentScenarios.map((scenario) => (
                <div className="panel-subtle" key={scenario.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{scenario.title}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{scenario.registerName}</div>
                    </div>
                    <span className="badge-neutral">{scenario.status}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span>Likelihood: {formatScore(scenario.likelihood)}</span>
                    <span>Impact: {formatScore(scenario.impact)}</span>
                    <span>Inherent: {formatScore(scenario.inherentScore)}</span>
                    <span>Residual: {formatScore(scenario.residualScore)}</span>
                    <span>Updated: {formatDate(scenario.updatedAt)}</span>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-300">
                    {scenario.description || 'Scenario description is still being captured.'}
                  </div>
                </div>
              ))}
              {recentScenarios.length === 0 && (
                <div className="text-sm text-slate-400">
                  No threat-model scenarios are visible yet. Use the scenario workspace to begin modeling security situations.
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="eyebrow">Modeling Coverage</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="panel-subtle">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Modeled registers</div>
                <div className="mt-2 text-2xl font-semibold text-white">{modeledRegisters.length}</div>
                <div className="mt-1 text-sm text-slate-400">Registers already acting as reusable scenario libraries</div>
              </div>
              <div className="panel-subtle">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Total registers</div>
                <div className="mt-2 text-2xl font-semibold text-white">{registerSummaries.length}</div>
                <div className="mt-1 text-sm text-slate-400">Available modeling lanes across domains and business contexts</div>
              </div>
              <div className="panel-subtle">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Top scoring ceiling</div>
                <div className="mt-2 text-2xl font-semibold text-white">{maxScaleScore || 'n/a'}</div>
                <div className="mt-1 text-sm text-slate-400">Maximum score from the current tenant likelihood and impact scales</div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {registerSummaries.slice(0, 5).map((summary) => (
                <div className="panel-subtle" key={summary.registerName}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{summary.registerName}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                        {summary.folderName || 'Tenant-wide register'}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                      <span>Scenarios: {summary.scenarioCount}</span>
                      <span>Open: {summary.openCount}</span>
                      <span>Elevated: {summary.elevatedCount}</span>
                      <span>Max score: {formatScore(summary.maxScore)}</span>
                    </div>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-300">
                    {summary.description ||
                      'This register can act as a reusable threat-model lane for scenario templates and applied system reviews.'}
                  </div>
                  <div className="mt-3 text-xs text-slate-500">Latest activity {formatDate(summary.updatedAt)}</div>
                </div>
              ))}
              {registerSummaries.length === 0 && (
                <div className="text-sm text-slate-400">
                  No threat-model registers are visible yet, so reusable scenario coverage has not been established.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel-subtle">
            <div className="eyebrow">Risk Taxonomy & Scoring</div>
            {riskModel ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                  <div className="font-medium text-white">Scoring contract</div>
                  <div className="mt-2 text-sm text-slate-300">
                    {riskModel.config.formulaPreset} · Residual method: {riskModel.config.residualRiskMethod} · Owner role:{' '}
                    {riskModel.config.riskOwnerRole}
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    Updated {formatDate(riskModel.config.updatedAt)} · Escalation {riskModel.config.autoEscalationEnabled ? 'enabled' : 'disabled'}
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    Scale ceiling {maxScaleScore || 'n/a'} · Avoid threshold {riskModel.config.autoEscalationThreshold} ·{' '}
                    {riskModel.config.autoEscalationDays} day escalation window
                  </div>
                </div>
                {riskModel.records.thresholdBands.map((band) => (
                  <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4" key={band.label}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-white">{band.label}</div>
                      <span className="badge-neutral">{band.value}</span>
                    </div>
                    <div className="mt-2 text-sm text-slate-400">{band.hint}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-400">
                Risk taxonomy and scoring details are not currently visible in this workspace.
              </div>
            )}
          </section>

          <section className="panel-subtle">
            <div className="eyebrow">Runtime Contracts</div>
            <div className="mt-4 space-y-3">
              {runtimeContracts.map((contract) => (
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm leading-6 text-slate-300" key={contract}>
                  {contract}
                </div>
              ))}
              {runtimeContracts.length === 0 && (
                <div className="text-sm text-slate-400">
                  Threat-model runtime contracts are not visible right now.
                </div>
              )}
            </div>
          </section>

          <section className="panel-subtle">
            <div className="eyebrow">Governance Signals</div>
            <div className="mt-4 space-y-3">
              {riskModel?.records.governanceSignals.map((signal) => (
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4" key={signal.title}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{signal.title}</div>
                    <span className={signal.status === 'Active' || signal.status === 'Configured' || signal.status === 'Deterministic' ? 'badge-positive' : 'badge-neutral'}>
                      {signal.status}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">{signal.detail}</div>
                </div>
              )) ?? <div className="text-sm text-slate-400">Governance signals are not available right now.</div>}
            </div>
          </section>

          <section className="panel-subtle">
            <div className="eyebrow">Scenario Status Mix</div>
            <div className="mt-4 space-y-3">
              {statusBreakdown.slice(0, 5).map((item) => (
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4" key={item.status}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{formatStatusLabel(item.status)}</div>
                    <span className="badge-neutral">{item.count}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    Threat scenarios currently sitting in {formatStatusLabel(item.status).toLowerCase()} posture.
                  </div>
                </div>
              ))}
              {statusBreakdown.length === 0 && (
                <div className="text-sm text-slate-400">No threat-model scenarios are visible yet.</div>
              )}
            </div>
          </section>

          <section className="panel-subtle">
            <div className="eyebrow">Apply To Systems</div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="font-medium text-white">1. Configure the tenant scoring logic</div>
                <div className="mt-2 text-sm leading-6 text-slate-400">
                  Keep the risk model authoritative so the same likelihood, impact, residual, and escalation rules follow
                  every applied threat-model review.
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="font-medium text-white">2. Reuse scenario libraries by system or domain</div>
                <div className="mt-2 text-sm leading-6 text-slate-400">
                  Use registers and scenarios as reusable starting points for applications, environments, or shared
                  services instead of rebuilding the same threat logic each time.
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="font-medium text-white">3. Carry the model into assessments</div>
                <div className="mt-2 text-sm leading-6 text-slate-400">
                  Apply the modeled scenarios through the risk-assessment workflow so reviewers can confirm ownership,
                  treatment, and system-specific exposure without leaving the canonical scoring contract.
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {canUseRiskAssessments ? (
                <>
                  <Link className="button-secondary" to="/risk-scenarios">
                    Manage scenario library
                  </Link>
                  <Link className="button-secondary" to="/risk-assessments">
                    Open risk assessments
                  </Link>
                </>
              ) : (
                <span className="text-sm text-slate-400">
                  Risk assessment access is required to apply modeled scenarios in system reviews.
                </span>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
