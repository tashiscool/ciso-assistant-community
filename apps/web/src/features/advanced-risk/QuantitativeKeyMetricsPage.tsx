import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';

const client = new ApiClient();

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

type MetricsPayload = {
  studyId: string;
  metrics: {
    currency: string;
    currentAleCombined: number;
    residualAleCombined: number;
    riskReduction: number;
    scenariosAboveThreshold: number;
    totalScenarios: number;
  };
};

export function QuantitativeKeyMetricsPage() {
  const { identity } = useEdgeIdentity();
  const { studyId } = useParams<{ studyId: string }>();
  const [payload, setPayload] = useState<MetricsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadMetrics() {
    if (!studyId) {
      setError('Quantitative study id is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{ data: MetricsPayload }>(`/ops/quantitative-studies/${studyId}/key-metrics`);
      setPayload(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMetrics();
  }, [identity.tenantId, identity.userId, studyId]);

  if (loading || !payload) {
    return <div className="panel p-6 text-sm text-slate-300">Loading key metrics...</div>;
  }

  const { metrics } = payload;

  return (
    <div className="space-y-6">
      <section className="panel">
        <Link className="text-sm text-cyan-200 transition hover:text-cyan-100" to={`/advanced-risk/quantitative/${payload.studyId}`}>
          Back to quantitative study
        </Link>
        <div className="eyebrow mt-4">Key Metrics</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Portfolio Metrics</h1>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="metric-card">
          <div className="metric-label">Current ALE</div>
          <div className="mt-3 text-sm font-semibold text-white">
            {formatCurrency(metrics.currentAleCombined, metrics.currency)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Residual ALE</div>
          <div className="mt-3 text-sm font-semibold text-white">
            {formatCurrency(metrics.residualAleCombined, metrics.currency)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Risk reduction</div>
          <div className="mt-3 text-sm font-semibold text-white">
            {formatCurrency(metrics.riskReduction, metrics.currency)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Above threshold</div>
          <div className="metric-value">{metrics.scenariosAboveThreshold}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Scenarios</div>
          <div className="metric-value">{metrics.totalScenarios}</div>
        </div>
      </section>
    </div>
  );
}
