import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { QuantitativeStudy } from './types';

const client = new ApiClient();

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function QuantitativeStudyDetailPage() {
  const { identity } = useEdgeIdentity();
  const { studyId } = useParams<{ studyId: string }>();
  const [study, setStudy] = useState<QuantitativeStudy | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadStudy() {
    if (!studyId) {
      setError('Quantitative study id is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{ data: QuantitativeStudy }>(`/ops/quantitative-studies/${studyId}`);
      setStudy(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStudy();
  }, [identity.tenantId, identity.userId, studyId]);

  async function retrigger() {
    if (!studyId) {
      return;
    }

    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      await client.post(`/ops/quantitative-studies/${studyId}/retrigger-simulations`);
      setNotice('Portfolio metrics refreshed.');
      await loadStudy();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading quantitative study...</div>;
  }

  if (!study) {
    return <div className="notice-error">Quantitative study not found for tenant {identity.tenantId}.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <Link className="text-sm text-cyan-200 transition hover:text-cyan-100" to="/advanced-risk/quantitative">
            Back to quantitative workspace
          </Link>
          <div className="eyebrow mt-4">{study.refId ?? 'Quantitative Study'}</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">{study.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            {study.description || 'No quantitative study description provided.'}
          </p>
        </div>
        <div className="panel-subtle space-y-4">
          <div className="flex flex-wrap gap-3">
            <Link className="button-secondary" to={`/advanced-risk/quantitative/${study.id}/executive-summary`}>
              Executive Summary
            </Link>
            <Link className="button-secondary" to={`/advanced-risk/quantitative/${study.id}/key-metrics`}>
              Key Metrics
            </Link>
            <Link className="button-secondary" to={`/advanced-risk/quantitative/${study.id}/action-plan`}>
              Action Plan
            </Link>
          </div>
          <button className="button-primary" disabled={busy} onClick={() => void retrigger()} type="button">
            {busy ? 'Refreshing...' : 'Retrigger Simulations'}
          </button>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Current ALE</div>
          <div className="mt-3 text-sm font-semibold text-white">
            {formatCurrency(study.metrics.currentAleCombined, study.currency)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Residual ALE</div>
          <div className="mt-3 text-sm font-semibold text-white">
            {formatCurrency(study.metrics.residualAleCombined, study.currency)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Risk reduction</div>
          <div className="mt-3 text-sm font-semibold text-white">
            {formatCurrency(study.metrics.riskReduction, study.currency)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Threshold breaches</div>
          <div className="metric-value">{study.metrics.scenariosAboveThreshold}</div>
        </div>
      </section>

      <section className="panel overflow-hidden p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Scenario</th>
              <th className="px-4 py-3">Current ALE</th>
              <th className="px-4 py-3">Residual ALE</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Treatment</th>
            </tr>
          </thead>
          <tbody>
            {study.scenarios.map((scenario) => (
              <tr key={scenario.id} className="border-t border-white/5 align-top">
                <td className="px-4 py-4">
                  <div className="font-medium text-white">
                    {scenario.refId} {scenario.name}
                  </div>
                  {scenario.description && <div className="mt-2 text-sm text-slate-400">{scenario.description}</div>}
                </td>
                <td className="px-4 py-4 text-slate-300">
                  {formatCurrency(scenario.currentAle, study.currency)}
                </td>
                <td className="px-4 py-4 text-slate-300">
                  {formatCurrency(scenario.residualAle, study.currency)}
                </td>
                <td className="px-4 py-4 text-slate-300">{scenario.ownerName ?? 'Unassigned'}</td>
                <td className="px-4 py-4 text-slate-300">{scenario.treatmentStrategy ?? 'No treatment defined'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
