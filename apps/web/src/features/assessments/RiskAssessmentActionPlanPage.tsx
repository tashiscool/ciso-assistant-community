import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { RiskActionPlanItem, RiskAssessment } from './types';

const client = new ApiClient();

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatScore(value: number) {
  return value.toFixed(1);
}

export function RiskAssessmentActionPlanPage() {
  const { identity } = useEdgeIdentity();
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [items, setItems] = useState<RiskActionPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadActionPlan() {
    if (!assessmentId) {
      setError('Risk assessment id is missing from the route.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{
        data: {
          assessment: RiskAssessment;
          actionPlan: RiskActionPlanItem[];
          summary: {
            controlsCount: number;
            totalAnnualCost: number;
            highestResidualScore: number;
            byPriority: Record<string, number>;
            byStatus: Record<string, number>;
          };
        };
      }>(`/core/risk-assessments/${assessmentId}/action-plan`);
      setAssessment(response.data.assessment);
      setItems(response.data.actionPlan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadActionPlan();
  }, [identity.tenantId, identity.userId, assessmentId]);

  const summary = useMemo(() => {
    const byPriority = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.priority] = (acc[item.priority] ?? 0) + 1;
      return acc;
    }, {});

    return {
      totalAnnualCost: items.reduce((sum, item) => sum + item.annualCost, 0),
      highestResidualScore: items.reduce((highest, item) => Math.max(highest, item.residualScore), 0),
      p1Items: byPriority.P1 ?? 0,
    };
  }, [items]);

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading risk treatment plan...</div>;
  }

  if (!assessment) {
    return <div className="notice-error">{error ?? 'Risk treatment plan is unavailable.'}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <Link className="text-sm text-cyan-200 transition hover:text-cyan-100" to={`/risk-assessments/${assessment.id}`}>
            Back to risk assessment
          </Link>
          <div className="eyebrow mt-4">Risk Treatment</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Action Plan</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Legacy risk-treatment routes now resolve into a Worker-backed action-plan summary built
            from the assessment register, scenario posture, and estimated remediation effort.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="metric-card">
              <div className="metric-label">Assessment</div>
              <div className="mt-3 text-sm font-semibold text-white">{assessment.name}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Perimeter</div>
              <div className="mt-3 text-sm font-semibold text-white">
                {assessment.perimeterName ?? assessment.folderName}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Register</div>
              <div className="mt-3 text-sm font-semibold text-white">
                {assessment.riskRegisterName ?? 'Unassigned'}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Version</div>
              <div className="metric-value">{assessment.version}</div>
            </div>
          </div>
        </div>

        <div className="panel-subtle space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="metric-card">
              <div className="metric-label">Treatment items</div>
              <div className="metric-value">{items.length}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">P1 items</div>
              <div className="metric-value">{summary.p1Items}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Annual budget</div>
              <div className="metric-value">{formatCurrency(summary.totalAnnualCost)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Highest residual</div>
              <div className="metric-value">{formatScore(summary.highestResidualScore)}</div>
            </div>
          </div>
          <div className="panel-subtle">
            <div className="label">Execution note</div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              These treatment items are derived from the current risk scenario portfolio so the old
              action-plan route has a live semantic equivalent in the migrated app.
            </p>
          </div>
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="panel overflow-hidden p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Scenario</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Residual</th>
              <th className="px-4 py-3">Effort</th>
              <th className="px-4 py-3">Annual cost</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-white/5 align-top">
                <td className="px-4 py-4">
                  <div className="font-medium text-white">{item.scenarioTitle}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">{item.recommendedAction}</div>
                  <div className="mt-2">
                    <Link className="text-xs text-cyan-200 transition hover:text-cyan-100" to={item.targetRoute}>
                      Open mapped scenario workspace
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-4 text-slate-300">{item.priority}</td>
                <td className="px-4 py-4 capitalize text-slate-300">{item.status.replace(/_/g, ' ')}</td>
                <td className="px-4 py-4 text-slate-300">
                  {formatScore(item.residualScore)}
                  <div className="mt-1 text-xs text-slate-500">
                    Inherent {formatScore(item.inherentScore)}
                  </div>
                </td>
                <td className="px-4 py-4 text-slate-300">{item.effort}</td>
                <td className="px-4 py-4 text-slate-300">{formatCurrency(item.annualCost)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={6}>
                  No scenarios are currently in scope for this assessment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
