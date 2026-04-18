import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { DoraLintPayload, ReportExport } from './types';

const client = new ApiClient();

function severityClasses(severity: string) {
  switch (severity) {
    case 'error':
      return 'border-rose-400/20 bg-rose-500/10 text-rose-100';
    case 'warning':
      return 'border-amber-400/20 bg-amber-500/10 text-amber-100';
    case 'ok':
      return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100';
    default:
      return 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100';
  }
}

export function DoraReportPage() {
  const { identity } = useEdgeIdentity();
  const [lint, setLint] = useState<DoraLintPayload | null>(null);
  const [exports, setExports] = useState<ReportExport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [identifierType, setIdentifierType] = useState('entity_ref');
  const [level, setLevel] = useState('IND');
  const [namingConvention, setNamingConvention] = useState('eba');

  async function loadPage() {
    try {
      setLoading(true);
      setError(null);
      const [lintResponse, exportResponse] = await Promise.all([
        client.get<{ data: { lintResults: DoraLintPayload } }>('/ops/reports/dora-roi'),
        client.get<{ data: ReportExport[] }>('/ops/reports/exports'),
      ]);
      setLint(lintResponse.data.lintResults);
      setExports(exportResponse.data.filter((item) => item.reportId === 'dora-roi'));
      if (lintResponse.data.lintResults.available_identifiers[0]?.type) {
        setIdentifierType(lintResponse.data.lintResults.available_identifiers[0].type);
      }
      setNamingConvention(lintResponse.data.lintResults.entity_country === 'BE' ? 'nbb' : 'eba');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
  }, [identity.tenantId, identity.userId]);

  async function generateExport() {
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      const response = await client.post<{ data: ReportExport }>('/ops/reports/exports', {
        reportId: 'dora-roi',
        format: 'csv',
        identifierType,
        level,
        namingConvention,
      });
      setNotice(`Generated export: ${response.data.name}`);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !lint) {
    return <div className="panel p-6 text-sm text-slate-300">Loading DORA report workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <Link className="text-sm text-cyan-200 transition hover:text-cyan-100" to="/reports">
            Back to reports
          </Link>
          <div className="eyebrow mt-4">DORA</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Register of Information</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Validate entity and contract completeness before generating the regulatory package.
          </p>
        </div>
        <div className="panel-subtle space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="metric-card">
              <div className="metric-label">Errors</div>
              <div className="metric-value">{lint.summary.errors}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Warnings</div>
              <div className="metric-value">{lint.summary.warnings}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Authority</div>
              <div className="mt-3 text-sm font-semibold text-white">{lint.competent_authority}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Country</div>
              <div className="mt-3 text-sm font-semibold text-white">{lint.entity_country}</div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="label">Identifier</span>
              <select className="input" onChange={(event) => setIdentifierType(event.target.value)} value={identifierType}>
                {lint.available_identifiers.map((item) => (
                  <option key={`${item.type}-${item.value}`} value={item.type}>
                    {item.label}: {item.value}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Level</span>
              <select className="input" onChange={(event) => setLevel(event.target.value)} value={level}>
                <option value="IND">IND</option>
                <option value="CON">CON</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Naming</span>
              <select className="input" onChange={(event) => setNamingConvention(event.target.value)} value={namingConvention}>
                <option value="eba">EBA</option>
                <option value="nbb">NBB</option>
              </select>
            </label>
          </div>
          <button className="button-primary" disabled={busy || lint.summary.errors > 0} onClick={() => void generateExport()} type="button">
            {busy ? 'Generating...' : 'Generate DORA Export'}
          </button>
          {lint.summary.errors > 0 && (
            <div className="text-sm text-amber-200">Resolve export errors before generating the package.</div>
          )}
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="panel">
          <div className="eyebrow">Validation Detail</div>
          <div className="mt-4 space-y-3">
            {lint.results.map((result, index) => (
              <div key={`${result.category}-${index}`} className={`rounded-3xl border p-4 ${severityClasses(result.severity)}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{result.category}</div>
                  <span className="badge-neutral">{result.severity}</span>
                </div>
                <div className="mt-2 text-sm leading-6">{result.message}</div>
                {result.field && <div className="mt-2 text-xs opacity-80">Field: {result.field}</div>}
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">Export History</div>
          <div className="mt-4 space-y-3">
            {exports.map((item) => (
              <div key={item.id} className="panel-subtle">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{item.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.status}</div>
                  </div>
                  <a className="text-cyan-200 transition hover:text-cyan-100" href={item.downloadPath} rel="noreferrer" target="_blank">
                    Download
                  </a>
                </div>
              </div>
            ))}
            {exports.length === 0 && (
              <div className="text-sm text-slate-400">No DORA exports have been generated yet.</div>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
