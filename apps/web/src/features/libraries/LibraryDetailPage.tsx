import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import { countAssessableNodes, FrameworkTree } from '../core/FrameworkTree';
import type { LibraryDetail } from './types';

const client = new ApiClient();

function formatTimestamp(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : 'n/a';
}

function severityBadge(severity: string) {
  if (severity === 'high') {
    return 'badge-danger';
  }
  if (severity === 'medium') {
    return 'inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] text-amber-200';
  }
  return 'badge-neutral';
}

export function LibraryDetailPage() {
  const { identity } = useEdgeIdentity();
  const { libraryId } = useParams<{ libraryId: string }>();
  const [library, setLibrary] = useState<LibraryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadLibraryDetail() {
    if (!libraryId) {
      setError('Library id is missing from the route.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{ data: LibraryDetail }>(`/core/libraries/${libraryId}`);
      setLibrary(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLibraryDetail();
  }, [identity.tenantId, identity.userId, libraryId]);

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading library workspace...</div>;
  }

  if (!library) {
    return <div className="notice-error">Library not found for tenant {identity.tenantId}.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <Link className="text-sm text-cyan-200 transition hover:text-cyan-100" to="/libraries">
            Back to libraries
          </Link>
          <div className="eyebrow mt-4">Catalog</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">{library.name}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            {library.description || 'No library description available.'}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="metric-card">
              <div className="metric-label">Provider</div>
              <div className="mt-3 text-sm font-semibold text-white">{library.provider}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Packager</div>
              <div className="mt-3 text-sm font-semibold text-white">{library.packager}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Version</div>
              <div className="metric-value">{library.version ?? 'n/a'}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Status</div>
              <div className="mt-3">
                <span className={library.hasUpdate ? 'badge-success' : 'badge-neutral'}>
                  {library.hasUpdate ? 'Update Available' : 'Current'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="panel-subtle space-y-4 text-sm text-slate-300">
          <div>
            <div className="label">Publication date</div>
            <div className="mt-2">{formatTimestamp(library.publicationDate)}</div>
          </div>
          <div>
            <div className="label">Framework</div>
            {library.framework ? (
              <Link className="mt-2 inline-flex text-cyan-200 transition hover:text-cyan-100" to={`/frameworks/${library.framework.id}`}>
                Open {library.framework.name}
              </Link>
            ) : (
              <div className="mt-2 text-slate-400">No linked framework.</div>
            )}
          </div>
          <div>
            <div className="label">Dependencies</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {library.dependencies.length > 0 ? (
                library.dependencies.map((dependency) => (
                  <span key={dependency.id} className="badge-neutral">
                    {dependency.name}
                  </span>
                ))
              ) : (
                <span className="text-slate-400">No dependencies</span>
              )}
            </div>
          </div>
          <div>
            <div className="label">Copyright</div>
            <div className="mt-2">{library.copyright || 'Not specified'}</div>
          </div>
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Framework</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Reference Tree</h2>
            </div>
            <div className="badge-neutral">{countAssessableNodes(library.tree)} assessable items</div>
          </div>
          <div className="mt-5">
            {library.tree.length > 0 ? (
              <FrameworkTree nodes={library.tree} />
            ) : (
              <div className="panel-subtle text-sm text-slate-400">
                This library does not include a linked framework tree.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <section className="panel">
            <div className="eyebrow">Risk Matrices</div>
            <h2 className="mt-2 text-xl font-semibold text-white">Scoring Assets</h2>
            <div className="mt-4 space-y-4">
              {library.riskMatrices.map((matrix) => (
                <div key={matrix.id} className="panel-subtle">
                  <div className="font-medium text-white">{matrix.name}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-300">{matrix.description}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {matrix.levels.map((level) => (
                      <span key={`${matrix.id}-${level.score}`} className="badge-neutral">
                        {level.score} {level.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel overflow-hidden p-0">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Threat</th>
                  <th className="px-4 py-3">Severity</th>
                </tr>
              </thead>
              <tbody>
                {library.threats.map((threat) => (
                  <tr key={threat.id} className="border-t border-white/5 align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">
                        {threat.refId} {threat.name}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-400">{threat.description}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={severityBadge(threat.severity)}>{threat.severity}</span>
                    </td>
                  </tr>
                ))}
                {library.threats.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-400" colSpan={2}>
                      No threats are packaged in this library.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </section>
      </section>

      <section className="panel overflow-hidden p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Control</th>
            </tr>
          </thead>
          <tbody>
            {library.referenceControls.map((control) => (
              <tr key={control.id} className="border-t border-white/5 align-top">
                <td className="px-4 py-4 font-mono text-xs text-cyan-200">{control.ref}</td>
                <td className="px-4 py-4">
                  <div className="font-medium text-white">{control.title}</div>
                  {control.description && (
                    <div className="mt-2 text-sm leading-6 text-slate-400">{control.description}</div>
                  )}
                </td>
              </tr>
            ))}
            {library.referenceControls.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={2}>
                  No reference controls are linked to this library.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
