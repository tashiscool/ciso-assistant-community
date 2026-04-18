import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { RiskAssessment, RiskScenario } from './types';

const client = new ApiClient();

function formatTimestamp(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'n/a';
}

function formatScore(value: number | null | undefined) {
  return typeof value === 'number' ? value.toFixed(1) : 'n/a';
}

function toMatrixBucket(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return Math.min(5, Math.max(1, Math.round(value)));
}

function riskTone(score: number) {
  if (score >= 16) {
    return 'bg-rose-500/15 text-rose-200';
  }
  if (score >= 10) {
    return 'bg-amber-500/15 text-amber-200';
  }
  return 'bg-emerald-500/15 text-emerald-200';
}

export function RiskAssessmentDetailPage() {
  const { identity } = useEdgeIdentity();
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [scenarios, setScenarios] = useState<RiskScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [likelihood, setLikelihood] = useState('3');
  const [impact, setImpact] = useState('3');
  const [status, setStatus] = useState('open');

  async function loadAssessmentDetail() {
    if (!assessmentId) {
      setError('Risk assessment id is missing from the route.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [assessmentResponse, scenarioResponse] = await Promise.all([
        client.get<{ data: RiskAssessment }>(`/core/risk-assessments/${assessmentId}`),
        client.get<{ data: RiskScenario[] }>(`/core/risk-assessments/${assessmentId}/scenarios`),
      ]);
      setAssessment(assessmentResponse.data);
      setScenarios(scenarioResponse.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAssessmentDetail();
  }, [identity.tenantId, identity.userId, assessmentId]);

  async function createScenario() {
    if (!assessmentId) {
      return;
    }

    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      await client.post(`/core/risk-assessments/${assessmentId}/scenarios`, {
        title,
        description,
        likelihood: Number(likelihood),
        impact: Number(impact),
        status,
      });
      setTitle('');
      setDescription('');
      setLikelihood('3');
      setImpact('3');
      setStatus('open');
      setNotice('Risk scenario added to the assessment register.');
      await loadAssessmentDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  const metrics = useMemo(() => {
    const inherentScores = scenarios
      .map((scenario) => scenario.inherentScore)
      .filter((value): value is number => typeof value === 'number');
    const residualScores = scenarios
      .map((scenario) => scenario.residualScore)
      .filter((value): value is number => typeof value === 'number');

    const average = (values: number[]) =>
      values.length > 0 ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)) : 0;

    return {
      total: scenarios.length,
      open: scenarios.filter((scenario) => scenario.status === 'open').length,
      monitoring: scenarios.filter((scenario) => scenario.status === 'monitoring').length,
      avgInherent: average(inherentScores),
      avgResidual: average(residualScores),
    };
  }, [scenarios]);

  const matrix = useMemo(() => {
    return Array.from({ length: 5 }, (_, impactIndex) =>
      Array.from({ length: 5 }, (_, likelihoodIndex) => {
        const impactValue = 5 - impactIndex;
        const likelihoodValue = likelihoodIndex + 1;
        return scenarios.filter(
          (scenario) =>
            toMatrixBucket(scenario.impact) === impactValue &&
            toMatrixBucket(scenario.likelihood) === likelihoodValue,
        );
      }),
    );
  }, [scenarios]);

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading risk assessment workspace...</div>;
  }

  if (!assessment) {
    return <div className="notice-error">Risk assessment not found for tenant {identity.tenantId}.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <Link className="text-sm text-cyan-200 transition hover:text-cyan-100" to="/assessments">
            Back to assessments
          </Link>
          <div className="eyebrow mt-4">Risk</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">{assessment.name}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Review the attached risk register, add scenarios directly into scope, and watch how the
            inherent and residual posture changes over time.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="metric-card">
              <div className="metric-label">Perimeter</div>
              <div className="mt-3 text-lg font-semibold text-white">
                {assessment.perimeterName ?? assessment.folderName}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Register</div>
              <div className="mt-3 text-lg font-semibold text-white">
                {assessment.riskRegisterName ?? 'Unassigned'}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Version</div>
              <div className="metric-value">{assessment.version}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Status</div>
              <div className="mt-3 text-lg font-semibold capitalize text-white">{assessment.status}</div>
            </div>
          </div>
          <div className="mt-5 panel-subtle grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div>
              <div className="label">Reference</div>
              <div className="mt-2 font-mono text-xs text-cyan-200">{assessment.refId ?? 'n/a'}</div>
            </div>
            <div>
              <div className="label">Updated</div>
              <div className="mt-2">{formatTimestamp(assessment.updatedAt)}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="label">Observation</div>
              <div className="mt-2 whitespace-pre-line leading-6 text-slate-300">
                {assessment.observation || 'No observation recorded yet.'}
              </div>
            </div>
          </div>
        </div>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void createScenario();
          }}
        >
          <div className="eyebrow">Add Scenario</div>
          <label className="space-y-1">
            <span className="label">Scenario title</span>
            <input
              className="input"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Unauthorized access to production logging"
              value={title}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Description</span>
            <textarea
              className="input min-h-[120px]"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Document the threat, exposure path, and expected impact."
              value={description}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="label">Likelihood</span>
              <input
                className="input"
                max="5"
                min="1"
                onChange={(event) => setLikelihood(event.target.value)}
                step="0.1"
                type="number"
                value={likelihood}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Impact</span>
              <input
                className="input"
                max="5"
                min="1"
                onChange={(event) => setImpact(event.target.value)}
                step="0.1"
                type="number"
                value={impact}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Status</span>
              <select className="input" onChange={(event) => setStatus(event.target.value)} value={status}>
                <option value="open">Open</option>
                <option value="monitoring">Monitoring</option>
                <option value="mitigating">Mitigating</option>
                <option value="closed">Closed</option>
              </select>
            </label>
          </div>
          <button className="button-primary" disabled={busy} type="submit">
            {busy ? 'Saving...' : 'Add Risk Scenario'}
          </button>
        </form>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Scenarios in scope</div>
          <div className="metric-value">{metrics.total}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Open scenarios</div>
          <div className="metric-value">{metrics.open}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Average inherent score</div>
          <div className="metric-value">{metrics.avgInherent.toFixed(1)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Average residual score</div>
          <div className="metric-value">{metrics.avgResidual.toFixed(1)}</div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="panel">
          <div className="eyebrow">Matrix View</div>
          <h2 className="mt-2 text-xl font-semibold text-white">Likelihood x Impact Heatmap</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Scenarios are placed using the currently stored likelihood and impact values from the
            attached risk register.
          </p>
          <div className="mt-5 overflow-x-auto">
            <div className="grid min-w-[640px] grid-cols-[72px_repeat(5,minmax(0,1fr))] gap-2">
              <div />
              {[1, 2, 3, 4, 5].map((value) => (
                <div key={value} className="label text-center">
                  L{value}
                </div>
              ))}
              {matrix.map((row, rowIndex) => {
                const impactValue = 5 - rowIndex;
                return (
                  <div key={`row-${impactValue}`} className="contents">
                    <div className="label flex items-center">
                      I{impactValue}
                    </div>
                    {row.map((cell, columnIndex) => {
                      const riskLevel = (columnIndex + 1) * impactValue;
                      return (
                        <div
                          key={`${impactValue}-${columnIndex + 1}`}
                          className={`min-h-[108px] rounded-3xl border border-white/10 p-3 ${riskTone(riskLevel)}`}
                        >
                          <div className="text-xs uppercase tracking-[0.16em]">{cell.length} items</div>
                          <div className="mt-3 space-y-2">
                            {cell.slice(0, 2).map((scenario) => (
                              <div key={scenario.id} className="rounded-2xl bg-slate-950/35 px-3 py-2 text-xs text-white">
                                {scenario.title}
                              </div>
                            ))}
                            {cell.length > 2 && (
                              <div className="text-xs text-slate-200">+{cell.length - 2} more</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="panel overflow-hidden p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Scenario</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Likelihood / Impact</th>
                <th className="px-4 py-3">Scores</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((scenario) => (
                <tr key={scenario.id} className="border-t border-white/5 align-top">
                  <td className="px-4 py-4">
                    <div className="font-medium text-white">{scenario.title}</div>
                    {scenario.description && (
                      <div className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{scenario.description}</div>
                    )}
                    <div className="mt-2 text-xs text-slate-500">{formatTimestamp(scenario.updatedAt)}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="badge-neutral capitalize">{scenario.status}</span>
                  </td>
                  <td className="px-4 py-4 text-slate-300">
                    {scenario.likelihood ?? 'n/a'} / {scenario.impact ?? 'n/a'}
                  </td>
                  <td className="px-4 py-4 text-slate-300">
                    <div>Inherent {formatScore(scenario.inherentScore)}</div>
                    <div className="mt-1 text-xs text-slate-500">Residual {formatScore(scenario.residualScore)}</div>
                  </td>
                </tr>
              ))}
              {scenarios.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-400" colSpan={4}>
                    No risk scenarios are linked to this assessment yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </section>
    </div>
  );
}
