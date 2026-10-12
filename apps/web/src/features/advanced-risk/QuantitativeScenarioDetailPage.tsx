import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RegStatusPill } from '../../components/regovise/PagePrimitives';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { QuantitativeScenario, QuantitativeStudy } from './types';

const client = new ApiClient();

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function QuantitativeScenarioDetailPage() {
  const { identity } = useEdgeIdentity();
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const [study, setStudy] = useState<QuantitativeStudy | null>(null);
  const [scenario, setScenario] = useState<QuantitativeScenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadScenario() {
      if (!scenarioId) {
        setError('Quantitative scenario id is missing.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await client.get<{ data: { study: QuantitativeStudy; scenario: QuantitativeScenario } }>(
          `/ops/quantitative-scenarios/${scenarioId}`,
        );
        setStudy(response.data.study);
        setScenario(response.data.scenario);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    void loadScenario();
  }, [identity.tenantId, identity.userId, scenarioId]);

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading quantitative scenario...</div>;
  }

  if (!study || !scenario) {
    return <div className="notice-error">{error ?? 'Quantitative scenario not found.'}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <Link className="text-sm text-[#6d28d9] transition hover:text-[#5f1aa8]" to={`/advanced-risk/quantitative/${study.id}`}>
          Back to quantitative study
        </Link>
        <div className="eyebrow mt-4">{scenario.refId}</div>
        <h1 className="mt-2 text-3xl font-semibold text-[#241232]">{scenario.name}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
          {scenario.description || 'No scenario description provided.'}
        </p>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Current ALE</div>
          <div className="mt-3 text-sm font-semibold text-[#241232]">
            {formatCurrency(scenario.currentAle, study.currency)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Residual ALE</div>
          <div className="mt-3 text-sm font-semibold text-[#241232]">
            {formatCurrency(scenario.residualAle, study.currency)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Owner</div>
          <div className="mt-3 text-sm font-semibold text-[#241232]">{scenario.ownerName ?? 'Unassigned'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Status</div>
          <div className="mt-3 text-sm font-semibold text-[#241232]">{scenario.status}</div>
        </div>
      </section>

      <section className="panel">
        <div className="eyebrow">Hypotheses</div>
        <div className="mt-4 space-y-3">
          {scenario.hypotheses.map((item) => (
            <Link key={item.id} className="panel-subtle block" to={`/quantitative-risk-hypotheses/${item.id}`}>
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium text-[#241232]">{item.name}</div>
                  <div className="mt-1 text-sm text-[#6f6578]">{item.riskStage}</div>
                </div>
                <RegStatusPill tone="neutral" className="shrink-0">
                  {formatCurrency(item.ale, study.currency)}
                </RegStatusPill>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
