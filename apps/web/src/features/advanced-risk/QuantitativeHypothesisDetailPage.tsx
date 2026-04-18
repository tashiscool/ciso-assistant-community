import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { QuantitativeHypothesis, QuantitativeScenario, QuantitativeStudy } from './types';

const client = new ApiClient();

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function QuantitativeHypothesisDetailPage() {
  const { identity } = useEdgeIdentity();
  const { hypothesisId } = useParams<{ hypothesisId: string }>();
  const [study, setStudy] = useState<QuantitativeStudy | null>(null);
  const [scenario, setScenario] = useState<QuantitativeScenario | null>(null);
  const [hypothesis, setHypothesis] = useState<QuantitativeHypothesis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHypothesis() {
      if (!hypothesisId) {
        setError('Quantitative hypothesis id is missing.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await client.get<{
          data: {
            study: QuantitativeStudy;
            scenario: QuantitativeScenario;
            hypothesis: QuantitativeHypothesis;
          };
        }>(`/ops/quantitative-hypotheses/${hypothesisId}`);
        setStudy(response.data.study);
        setScenario(response.data.scenario);
        setHypothesis(response.data.hypothesis);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    void loadHypothesis();
  }, [identity.tenantId, identity.userId, hypothesisId]);

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading quantitative hypothesis...</div>;
  }

  if (!study || !scenario || !hypothesis) {
    return <div className="notice-error">{error ?? 'Quantitative hypothesis not found.'}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <Link className="text-sm text-cyan-200 transition hover:text-cyan-100" to={`/quantitative-risk-scenarios/${scenario.id}`}>
          Back to quantitative scenario
        </Link>
        <div className="eyebrow mt-4">{hypothesis.riskStage}</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">{hypothesis.name}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          This hypothesis belongs to {scenario.name} in {study.name}.
        </p>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Probability</div>
          <div className="metric-value">{Math.round(hypothesis.probability * 100)}%</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Impact low</div>
          <div className="mt-3 text-sm font-semibold text-white">
            {formatCurrency(hypothesis.impactLow, study.currency)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Impact high</div>
          <div className="mt-3 text-sm font-semibold text-white">
            {formatCurrency(hypothesis.impactHigh, study.currency)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">ALE</div>
          <div className="mt-3 text-sm font-semibold text-white">
            {formatCurrency(hypothesis.ale, study.currency)}
          </div>
        </div>
      </section>
    </div>
  );
}
