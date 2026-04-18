import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { QuantitativeStudy } from './types';

const client = new ApiClient();

export function QuantitativeExecutiveSummaryPage() {
  const { identity } = useEdgeIdentity();
  const { studyId } = useParams<{ studyId: string }>();
  const [study, setStudy] = useState<QuantitativeStudy | null>(null);
  const [narrative, setNarrative] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadSummary() {
    if (!studyId) {
      setError('Quantitative study id is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{ data: { study: QuantitativeStudy; narrative: string } }>(
        `/ops/quantitative-studies/${studyId}/executive-summary`,
      );
      setStudy(response.data.study);
      setNarrative(response.data.narrative);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, [identity.tenantId, identity.userId, studyId]);

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading executive summary...</div>;
  }

  if (!study) {
    return <div className="notice-error">Executive summary is unavailable.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <Link className="text-sm text-cyan-200 transition hover:text-cyan-100" to={`/advanced-risk/quantitative/${study.id}`}>
          Back to quantitative study
        </Link>
        <div className="eyebrow mt-4">Executive Summary</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">{study.name}</h1>
        <p className="mt-4 max-w-4xl text-base leading-8 text-slate-200">{narrative}</p>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="metric-card">
          <div className="metric-label">Risk register</div>
          <div className="mt-3 text-sm font-semibold text-white">{study.riskRegisterName ?? 'n/a'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Scenarios</div>
          <div className="metric-value">{study.metrics.totalScenarios}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Threshold</div>
          <div className="mt-3 text-sm font-semibold text-white">{study.lossThreshold ?? 'n/a'}</div>
        </div>
      </section>
    </div>
  );
}
