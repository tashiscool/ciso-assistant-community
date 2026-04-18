import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { BusinessImpactAnalysis } from './types';

const client = new ApiClient();

export function BusinessImpactAnalysisDetailPage() {
  const { identity } = useEdgeIdentity();
  const { analysisId = '' } = useParams();
  const [analysis, setAnalysis] = useState<BusinessImpactAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDetail() {
      try {
        setLoading(true);
        setError(null);
        const response = await client.get<{ data: BusinessImpactAnalysis }>(
          `/core/business-impact-analyses/${analysisId}`,
        );
        setAnalysis(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    if (analysisId) {
      void loadDetail();
    }
  }, [analysisId, identity.tenantId]);

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading business impact analysis...</div>;
  }

  if (!analysis) {
    return <div className="notice-error">{error ?? 'Business impact analysis detail is unavailable.'}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <Link className="text-sm text-cyan-200 transition hover:text-cyan-100" to="/resilience">
          Back to resilience workspace
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="eyebrow">Business Impact Analysis</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">{analysis.name}</h1>
          </div>
          <span className="badge-neutral">{analysis.status}</span>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
          {analysis.description || 'No business impact analysis description provided.'}
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="metric-card">
            <div className="metric-label">Assets</div>
            <div className="metric-value">{analysis.assetCount}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Documented</div>
            <div className="metric-value">{analysis.metrics.documentation}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Recovery tested</div>
            <div className="metric-value">{analysis.metrics.tests}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Targets met</div>
            <div className="metric-value">{analysis.metrics.objectives}%</div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2 xl:grid-cols-4">
          <div className="panel-subtle">
            <div className="label">Perimeter</div>
            <div className="mt-2 font-medium text-white">{analysis.perimeterName ?? 'n/a'}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Version</div>
            <div className="mt-2 font-medium text-white">{analysis.version}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Matrix</div>
            <div className="mt-2 font-medium text-white">{analysis.riskMatrixName ?? 'n/a'}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Reference</div>
            <div className="mt-2 font-medium text-white">{analysis.refId ?? 'n/a'}</div>
          </div>
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="panel">
          <div className="eyebrow">Recovery Matrix</div>
          <div className="mt-4 space-y-3">
            {analysis.riskMatrix.levels.map((level) => (
              <div className="panel-subtle" key={`${level.label}:${level.score}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">{level.label}</div>
                  <span className="badge-neutral">Score {level.score}</span>
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                  Tone {level.tone}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">Asset Assessments</div>
          <div className="mt-4 space-y-4">
            {analysis.assetAssessments.map((asset) => (
              <div className="panel-subtle" key={asset.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-white">{asset.assetName}</div>
                    <div className="mt-1 text-sm text-slate-400">{asset.folderName}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={asset.recoveryDocumented ? 'badge-success' : 'badge-neutral'}>
                      {asset.recoveryDocumented ? 'Documented' : 'Undocumented'}
                    </span>
                    <span className={asset.recoveryTested ? 'badge-success' : 'badge-neutral'}>
                      {asset.recoveryTested ? 'Tested' : 'Untested'}
                    </span>
                    <span className={asset.recoveryTargetsMet ? 'badge-success' : 'badge-neutral'}>
                      {asset.recoveryTargetsMet ? 'Targets met' : 'Targets open'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="label">Dependencies</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {asset.dependencies.map((dependency) => (
                        <span className="badge-neutral" key={dependency}>
                          {dependency}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="label">Associated controls</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {asset.associatedControls.map((control) => (
                        <span className="badge-neutral" key={control}>
                          {control}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {asset.observation && <p className="mt-4 text-sm leading-6 text-slate-300">{asset.observation}</p>}

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-slate-300">
                    <thead>
                      <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        <th className="pb-3 pr-4">Threshold</th>
                        <th className="pb-3 pr-4">Impact</th>
                        <th className="pb-3 pr-4">Quantitative</th>
                        <th className="pb-3">Justification</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asset.thresholds.map((threshold) => (
                        <tr className="border-t border-white/10" key={`${asset.id}:${threshold.pointInTime}`}>
                          <td className="py-3 pr-4 text-white">
                            {threshold.humanPit} · {threshold.label}
                          </td>
                          <td className="py-3 pr-4 text-slate-300">{threshold.qualiImpact}</td>
                          <td className="py-3 pr-4 text-slate-300">
                            {threshold.quantiImpact ?? 'n/a'} {threshold.quantiImpactUnit ?? ''}
                          </td>
                          <td className="py-3 text-slate-400">{threshold.justification ?? 'n/a'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
