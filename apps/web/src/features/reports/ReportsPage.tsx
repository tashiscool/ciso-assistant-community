import { useEffect, useState } from 'react';
import { Download, Eye, RefreshCw, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  RegActionMenu,
  RegModal,
  RegRightDrawer,
  RegStatusPill,
} from '../../components/regovise/PagePrimitives';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { ReportCatalogItem, ReportExport } from './types';

const client = new ApiClient();

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function reportStatusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (['generated', 'ready', 'complete'].includes(status.toLowerCase())) return 'success';
  if (['running', 'queued', 'pending'].includes(status.toLowerCase())) return 'warning';
  if (['validation_failed', 'failed', 'blocked', 'error'].includes(status.toLowerCase())) return 'danger';
  return 'neutral';
}

function replayPayload(item: ReportExport) {
  return {
    reportId: item.reportId,
    format: item.format,
    identifierType: item.filters.identifierType ?? undefined,
    level: item.filters.level ?? undefined,
    namingConvention: item.filters.namingConvention ?? undefined,
  };
}

export function ReportsPage() {
  const { identity } = useEdgeIdentity();
  const [catalog, setCatalog] = useState<ReportCatalogItem[]>([]);
  const [exports, setExports] = useState<ReportExport[]>([]);
  const [selectedExport, setSelectedExport] = useState<ReportExport | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ReportExport | null>(null);
  const [pendingReplay, setPendingReplay] = useState<ReportExport | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  async function handleDeleteExport(item: ReportExport) {
    try {
      setBusyAction(`delete:${item.id}`);
      setError(null);
      setNotice(null);
      await client.delete<{ data: { deleted: boolean; id: string } }>(`/ops/reports/exports/${item.id}`);
      setExports((current) => current.filter((exportItem) => exportItem.id !== item.id));
      if (selectedExport?.id === item.id) setSelectedExport(null);
      setPendingDelete(null);
      setNotice(`${item.name} was removed from report export history.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete report export.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReplayExport(item: ReportExport) {
    try {
      setBusyAction(`replay:${item.id}`);
      setError(null);
      setNotice(null);
      const response = await client.post<{ data: ReportExport }>('/ops/reports/exports', replayPayload(item));
      await loadReports();
      setPendingReplay(null);
      setNotice(`Regenerated export: ${response.data.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to regenerate report export.');
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#51465e]">Loading reporting workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="eyebrow">Reports</div>
            <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Reports and Export Flows</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#51465e]">
              Run regulatory and operating exports from the same workspace data model, then keep the
              generated packages close to the evidence and assessment record.
            </p>
          </div>
          <Link className="button-primary" to="/builders/report-builder">
            Create New Report
          </Link>
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}
      {notice && <div className="notice-success">{notice}</div>}

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="panel">
          <div className="eyebrow">Available Reports</div>
          <div className="mt-4 space-y-4">
            {catalog.map((item) => (
              <Link
                key={item.id}
                className="panel-subtle block transition hover:border-[#8b35e6]/30 hover:bg-[#f8f3ff]"
                to={item.href}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-[#241232]">{item.title}</div>
                    <div className="mt-2 text-sm leading-6 text-[#51465e]">{item.description}</div>
                  </div>
                  <span className={item.status === 'Active' ? 'status-pill-success' : 'status-pill-neutral'}>
                    {item.status ?? 'Ready'}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.source && <span className="status-pill-success">{item.source}</span>}
                  {item.tags.map((tag) => (
                    <span key={tag} className="status-pill-neutral">
                      {tag}
                    </span>
                  ))}
                </div>
                {item.lastUpdated && (
                  <div className="mt-3 text-xs text-[#62576a]">Updated {formatDate(item.lastUpdated)}</div>
                )}
              </Link>
            ))}
          </div>
        </section>

        <section className="panel overflow-x-auto p-0">
          <div className="border-b border-[#ded8e4] px-5 py-4">
            <div className="eyebrow">Recent Exports</div>
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#ded8e4] bg-[#f7f2fa] text-xs uppercase tracking-[0.18em] text-[#62576a]">
              <tr>
                <th className="px-4 py-3">Export</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Download</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exports.map((item) => (
                <tr key={item.id} className="border-t border-[#ece7f0] align-top">
                  <td className="px-4 py-4">
                    <div className="font-medium text-[#241232]">{item.name}</div>
                    <div className="mt-1 text-xs text-[#62576a]">{item.folderName ?? 'Tenant export'}</div>
                  </td>
                  <td className="px-4 py-4 capitalize text-[#51465e]">{item.reportId.replace(/-/g, ' ')}</td>
                  <td className="px-4 py-4">
                    <RegStatusPill tone={reportStatusTone(item.status)}>{item.status}</RegStatusPill>
                  </td>
                  <td className="px-4 py-4 text-[#51465e]">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-4">
                    <a
                      className="inline-flex items-center gap-2 text-[#6d28d9] transition hover:text-[#5f1aa8]"
                      href={item.downloadPath}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <RegActionMenu
                      actions={[
                        {
                          label: 'Inspect export',
                          icon: Eye,
                          onSelect: () => setSelectedExport(item),
                        },
                        {
                          label: 'Regenerate from filters',
                          icon: RefreshCw,
                          onSelect: () => setPendingReplay(item),
                        },
                        {
                          label: 'Delete export',
                          icon: Trash2,
                          destructive: true,
                          onSelect: () => setPendingDelete(item),
                        },
                      ]}
                      label={`Open actions for ${item.name}`}
                    />
                  </td>
                </tr>
              ))}
              {exports.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-[#6f6578]" colSpan={6}>
                    No exports have been generated for this tenant yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </section>

      <RegRightDrawer
        description={selectedExport ? `${selectedExport.reportId.replace(/-/g, ' ')} · ${formatDate(selectedExport.createdAt)}` : undefined}
        footer={
          selectedExport ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button className="button-secondary" onClick={() => setSelectedExport(null)} type="button">
                Close
              </button>
              <a className="button-secondary" href={selectedExport.downloadPath} rel="noreferrer" target="_blank">
                <Download className="h-4 w-4" />
                Download
              </a>
            </div>
          ) : null
        }
        onOpenChange={(open) => {
          if (!open) setSelectedExport(null);
        }}
        open={selectedExport !== null}
        title={selectedExport?.name ?? 'Report export'}
      >
        {selectedExport ? (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <RegStatusPill tone={reportStatusTone(selectedExport.status)}>{selectedExport.status}</RegStatusPill>
              <RegStatusPill>{selectedExport.format.toUpperCase()}</RegStatusPill>
              <RegStatusPill>{selectedExport.folderName ?? 'Tenant export'}</RegStatusPill>
            </div>
            <section>
              <h2 className="text-sm font-semibold text-[#241232]">Saved filters</h2>
              <pre className="mt-2 max-h-52 overflow-auto rounded-lg border border-[#ded8e4] bg-[#f8f6fa] p-3 text-xs text-[#241232]">
                {formatJson(selectedExport.filters)}
              </pre>
            </section>
            <section>
              <h2 className="text-sm font-semibold text-[#241232]">Summary</h2>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-[#ded8e4] bg-[#f8f6fa] p-3 text-xs text-[#241232]">
                {formatJson(selectedExport.summary)}
              </pre>
            </section>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegModal
        description="This removes the generated export artifact from the persisted report history. Source assessments, evidence, and controls are unchanged."
        footer={
          pendingDelete ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button className="button-secondary" onClick={() => setPendingDelete(null)} type="button">
                Cancel
              </button>
              <button
                className="button-secondary border-[#f2b7bf] text-[#9d1f2c] hover:bg-[#ffe2e5]"
                disabled={busyAction === `delete:${pendingDelete.id}`}
                onClick={() => void handleDeleteExport(pendingDelete)}
                type="button"
              >
                {busyAction === `delete:${pendingDelete.id}` ? 'Deleting...' : 'Delete export'}
              </button>
            </div>
          ) : null
        }
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        open={pendingDelete !== null}
        title="Delete report export"
      >
        <div className="rounded-lg border border-[#ded8e4] bg-[#f8f6fa] p-4">
          <div className="font-semibold text-[#241232]">{pendingDelete?.name}</div>
          <div className="mt-2 text-sm text-[#51465e]">
            Created {pendingDelete ? formatDate(pendingDelete.createdAt) : ''}.
          </div>
        </div>
      </RegModal>

      <RegModal
        description="Regenerate this report using the saved filters and current workspace data. The original export stays in history."
        footer={
          pendingReplay ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button className="button-secondary" onClick={() => setPendingReplay(null)} type="button">
                Cancel
              </button>
              <button
                className="button-primary"
                disabled={busyAction === `replay:${pendingReplay.id}`}
                onClick={() => void handleReplayExport(pendingReplay)}
                type="button"
              >
                {busyAction === `replay:${pendingReplay.id}` ? 'Regenerating...' : 'Regenerate export'}
              </button>
            </div>
          ) : null
        }
        onOpenChange={(open) => {
          if (!open) setPendingReplay(null);
        }}
        open={pendingReplay !== null}
        title="Regenerate report export"
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-[#ded8e4] bg-[#f8f6fa] p-4">
            <div className="font-semibold text-[#241232]">{pendingReplay?.name}</div>
            <div className="mt-2 text-sm text-[#51465e]">
              Saved format: {pendingReplay?.format.toUpperCase()} · Report: {pendingReplay?.reportId.replace(/-/g, ' ')}
            </div>
          </div>
          <pre className="max-h-52 overflow-auto rounded-lg border border-[#ded8e4] bg-white p-3 text-xs text-[#241232]">
            {formatJson(pendingReplay?.filters)}
          </pre>
        </div>
      </RegModal>
    </div>
  );
}
