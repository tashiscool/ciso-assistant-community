import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { ReportCatalogItem, ReportExport } from './types';

const client = new ApiClient();

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function ReportsPage() {
  const { identity } = useEdgeIdentity();
  const [catalog, setCatalog] = useState<ReportCatalogItem[]>([]);
  const [exports, setExports] = useState<ReportExport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadReports() {
    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{ data: { catalog: ReportCatalogItem[]; exports: ReportExport[] } }>(
        '/ops/reports',
      );
      setCatalog(response.data.catalog);
      setExports(response.data.exports);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, [identity.tenantId, identity.userId]);

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading reporting workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Reports</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Reports and Export Flows</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Run regulatory and operating exports from the same workspace data model, then keep the
          generated packages close to the evidence and assessment record.
        </p>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="panel">
          <div className="eyebrow">Available Reports</div>
          <div className="mt-4 space-y-4">
            {catalog.map((item) => (
              <Link
                key={item.id}
                className="panel-subtle block transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                to={item.href}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-white">{item.title}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-300">{item.description}</div>
                  </div>
                  <span className="badge-neutral">Ready</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="badge-neutral">
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="panel overflow-hidden p-0">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="eyebrow">Recent Exports</div>
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Export</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Download</th>
              </tr>
            </thead>
            <tbody>
              {exports.map((item) => (
                <tr key={item.id} className="border-t border-white/5 align-top">
                  <td className="px-4 py-4">
                    <div className="font-medium text-white">{item.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.folderName ?? 'Tenant export'}</div>
                  </td>
                  <td className="px-4 py-4 capitalize text-slate-300">{item.reportId.replace(/-/g, ' ')}</td>
                  <td className="px-4 py-4">
                    <span className="badge-neutral">{item.status}</span>
                  </td>
                  <td className="px-4 py-4 text-slate-300">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-4">
                    <a
                      className="text-cyan-200 transition hover:text-cyan-100"
                      href={item.downloadPath}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
              {exports.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-400" colSpan={5}>
                    No exports have been generated for this tenant yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </section>
    </div>
  );
}
