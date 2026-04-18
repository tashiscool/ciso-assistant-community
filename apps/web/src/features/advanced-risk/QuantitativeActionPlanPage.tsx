import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { QuantitativeAction, QuantitativeStudy } from './types';

const client = new ApiClient();

function formatCurrency(value: number | null, currency: string) {
  if (typeof value !== 'number') {
    return 'n/a';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function QuantitativeActionPlanPage() {
  const { identity } = useEdgeIdentity();
  const { studyId } = useParams<{ studyId: string }>();
  const [study, setStudy] = useState<QuantitativeStudy | null>(null);
  const [actionPlan, setActionPlan] = useState<QuantitativeAction[]>([]);
  const [budget, setBudget] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadActionPlan() {
    if (!studyId) {
      setError('Quantitative study id is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{
        data: { study: QuantitativeStudy; actionPlan: QuantitativeAction[]; budget: number };
      }>(`/ops/quantitative-studies/${studyId}/action-plan`);
      setStudy(response.data.study);
      setActionPlan(response.data.actionPlan);
      setBudget(response.data.budget);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadActionPlan();
  }, [identity.tenantId, identity.userId, studyId]);

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading quantitative action plan...</div>;
  }

  if (!study) {
    return <div className="notice-error">Quantitative action plan unavailable.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <Link className="text-sm text-cyan-200 transition hover:text-cyan-100" to={`/advanced-risk/quantitative/${study.id}`}>
            Back to quantitative study
          </Link>
          <div className="eyebrow mt-4">Action Plan</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">{study.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Turn scenario economics into a prioritized set of treatment initiatives and budget asks.
          </p>
        </div>
        <div className="panel-subtle grid gap-3 sm:grid-cols-2">
          <div className="metric-card">
            <div className="metric-label">Budget</div>
            <div className="mt-3 text-sm font-semibold text-white">{formatCurrency(budget, study.currency)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Actions</div>
            <div className="metric-value">{actionPlan.length}</div>
          </div>
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="panel overflow-hidden p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Scenario</th>
              <th className="px-4 py-3">Annual cost</th>
            </tr>
          </thead>
          <tbody>
            {actionPlan.map((item) => (
              <tr key={item.id} className="border-t border-white/5 align-top">
                <td className="px-4 py-4 font-medium text-white">{item.title}</td>
                <td className="px-4 py-4 text-slate-300">{item.ownerName ?? 'Unassigned'}</td>
                <td className="px-4 py-4 text-slate-300">{item.status}</td>
                <td className="px-4 py-4 text-slate-300">{item.scenarioName}</td>
                <td className="px-4 py-4 text-slate-300">{formatCurrency(item.annualCost, study.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
