import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { Perimeter } from '../assessments/types';
import type { BusinessImpactAnalysis } from './types';

const client = new ApiClient();

export function ResiliencePage() {
  const { identity } = useEdgeIdentity();
  const [perimeters, setPerimeters] = useState<Perimeter[]>([]);
  const [analyses, setAnalyses] = useState<BusinessImpactAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [perimeterId, setPerimeterId] = useState('');
  const [name, setName] = useState('');
  const [refId, setRefId] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0');
  const [status, setStatus] = useState('planned');
  const [riskMatrixName, setRiskMatrixName] = useState('Recovery Matrix');

  async function loadWorkspace() {
    try {
      setLoading(true);
      setError(null);
      const [perimeterResponse, analysisResponse] = await Promise.all([
        client.get<{ data: Perimeter[] }>('/core/perimeters'),
        client.get<{ data: BusinessImpactAnalysis[] }>('/core/business-impact-analyses'),
      ]);
      setPerimeters(perimeterResponse.data);
      setAnalyses(analysisResponse.data);
      if (!perimeterId && perimeterResponse.data[0]?.id) {
        setPerimeterId(perimeterResponse.data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [identity.tenantId, identity.userId]);

  async function createAnalysis() {
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      await client.post('/core/business-impact-analyses', {
        perimeterId,
        refId,
        name,
        description,
        version,
        status,
        riskMatrixName,
      });
      setName('');
      setRefId('');
      setDescription('');
      setVersion('1.0');
      setStatus('planned');
      setRiskMatrixName('Recovery Matrix');
      setNotice('Business impact analysis created.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading resilience workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Resilience</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Business Impact Analysis</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Track recovery objectives, asset dependencies, and escalation thresholds so resilience
          planning sits alongside governance, privacy, and third-party oversight.
        </p>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">BIAs</div>
          <div className="metric-value">{analyses.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Assets in scope</div>
          <div className="metric-value">{analyses.reduce((sum, item) => sum + item.assetCount, 0)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Documented</div>
          <div className="metric-value">
            {analyses.length
              ? Math.round(
                  analyses.reduce((sum, item) => sum + item.metrics.documentation, 0) / analyses.length,
                )
              : 0}
            %
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Recovery tested</div>
          <div className="metric-value">
            {analyses.length
              ? Math.round(analyses.reduce((sum, item) => sum + item.metrics.tests, 0) / analyses.length)
              : 0}
            %
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="panel">
          <div className="eyebrow">New BIA</div>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createAnalysis();
            }}
          >
            <label className="space-y-1">
              <span className="label">Perimeter</span>
              <select className="input" onChange={(event) => setPerimeterId(event.target.value)} value={perimeterId}>
                {perimeters.map((perimeter) => (
                  <option key={perimeter.id} value={perimeter.id}>
                    {perimeter.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label">Name</span>
                <input className="input" onChange={(event) => setName(event.target.value)} value={name} />
              </label>
              <label className="space-y-1">
                <span className="label">Reference</span>
                <input className="input" onChange={(event) => setRefId(event.target.value)} value={refId} />
              </label>
            </div>
            <label className="space-y-1">
              <span className="label">Description</span>
              <textarea className="input min-h-[92px]" onChange={(event) => setDescription(event.target.value)} value={description} />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="label">Version</span>
                <input className="input" onChange={(event) => setVersion(event.target.value)} value={version} />
              </label>
              <label className="space-y-1">
                <span className="label">Status</span>
                <select className="input" onChange={(event) => setStatus(event.target.value)} value={status}>
                  <option value="planned">Planned</option>
                  <option value="in_review">In review</option>
                  <option value="approved">Approved</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Matrix name</span>
                <input className="input" onChange={(event) => setRiskMatrixName(event.target.value)} value={riskMatrixName} />
              </label>
            </div>
            <button className="button-primary" disabled={busy} type="submit">
              {busy ? 'Creating...' : 'Create BIA'}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="eyebrow">Active Studies</div>
          <div className="mt-4 space-y-4">
            {analyses.map((analysis) => (
              <Link
                key={analysis.id}
                className="panel-subtle block transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                to={`/resilience/business-impact-analyses/${analysis.id}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-white">{analysis.name}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {analysis.perimeterName ?? 'No perimeter'} · {analysis.riskMatrixName ?? 'No matrix'}
                    </div>
                  </div>
                  <span className="badge-neutral">{analysis.status}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {analysis.description || 'No business impact analysis description provided.'}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div className="metric-card">
                    <div className="metric-label">Assets</div>
                    <div className="metric-value">{analysis.assetCount}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Documented</div>
                    <div className="metric-value">{analysis.metrics.documentation}%</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Tested</div>
                    <div className="metric-value">{analysis.metrics.tests}%</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Targets met</div>
                    <div className="metric-value">{analysis.metrics.objectives}%</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
