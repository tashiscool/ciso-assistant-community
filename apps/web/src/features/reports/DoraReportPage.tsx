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
import type { DoraLintPayload, ReportExport } from './types';

const client = new ApiClient();

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function severityClasses(severity: string) {
  switch (severity) {
    case 'error':
      return 'border-[#f2b7bf] bg-[#ffe2e5] text-[#9d1f2c]';
    case 'warning':
      return 'border-[#f6d48e] bg-[#fff2d9] text-[#8a4d00]';
    case 'ok':
      return 'border-[#9fdfb7] bg-[#ddf7e6] text-[#126b36]';
    default:
      return 'border-[#d7c3f1] bg-[#f2e8ff] text-[#5f1aa8]';
  }
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

export function DoraReportPage() {
  const { identity } = useEdgeIdentity();
  const [lint, setLint] = useState<DoraLintPayload | null>(null);
  const [exports, setExports] = useState<ReportExport[]>([]);
  const [selectedExport, setSelectedExport] = useState<ReportExport | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ReportExport | null>(null);
  const [pendingReplay, setPendingReplay] = useState<ReportExport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
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

  async function regenerateExport(item: ReportExport) {
    try {
      setBusyAction(`replay:${item.id}`);
      setError(null);
      setNotice(null);
      const response = await client.post<{ data: ReportExport }>('/ops/reports/exports', replayPayload(item));
      await loadPage();
      setPendingReplay(null);
      setNotice(`Regenerated export: ${response.data.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to regenerate report export.');
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteExport(item: ReportExport) {
    try {
      setBusyAction(`delete:${item.id}`);
      setError(null);
      setNotice(null);
      await client.delete<{ data: { deleted: boolean; id: string } }>(`/ops/reports/exports/${item.id}`);
      setExports((current) => current.filter((exportItem) => exportItem.id !== item.id));
      if (selectedExport?.id === item.id) setSelectedExport(null);
      setPendingDelete(null);
      setNotice(`${item.name} was removed from DORA export history.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete report export.');
    } finally {
      setBusyAction(null);
    }
  }

  if (loading || !lint) {
    return <div className="panel p-6 text-sm text-[#51465e]">Loading DORA report workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <Link className="text-sm text-[#6d28d9] transition hover:text-[#5f1aa8]" to="/reports">
            Back to reports
          </Link>
          <div className="eyebrow mt-4">DORA</div>
          <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Register of Information</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#51465e]">
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
              <div className="mt-3 text-sm font-semibold text-[#241232]">{lint.competent_authority}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Country</div>
              <div className="mt-3 text-sm font-semibold text-[#241232]">{lint.entity_country}</div>
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
            <div className="text-sm text-[#8a4d00]">Resolve export errors before generating the package.</div>
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
                  <span className="status-pill-neutral">{result.severity}</span>
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
                    <div className="font-medium text-[#241232]">{item.name}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <RegStatusPill tone={reportStatusTone(item.status)}>{item.status}</RegStatusPill>
                      <RegStatusPill>{item.format.toUpperCase()}</RegStatusPill>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a className="button-secondary" href={item.downloadPath} rel="noreferrer" target="_blank">
                      <Download className="h-4 w-4" />
                      Download
                    </a>
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
                  </div>
                </div>
              </div>
            ))}
            {exports.length === 0 && (
              <div className="text-sm text-[#6f6578]">No DORA exports have been generated yet.</div>
            )}
          </div>
        </section>
      </section>

      <RegRightDrawer
        description={selectedExport ? `Created ${formatDate(selectedExport.createdAt)}` : undefined}
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
        title={selectedExport?.name ?? 'DORA export'}
      >
        {selectedExport ? (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <RegStatusPill tone={reportStatusTone(selectedExport.status)}>{selectedExport.status}</RegStatusPill>
              <RegStatusPill>{selectedExport.format.toUpperCase()}</RegStatusPill>
              <RegStatusPill>{selectedExport.folderName ?? 'Tenant export'}</RegStatusPill>
            </div>
            <section>
              <h2 className="text-sm font-semibold text-[#241232]">Saved DORA filters</h2>
              <pre className="mt-2 max-h-52 overflow-auto rounded-lg border border-[#ded8e4] bg-[#f8f6fa] p-3 text-xs text-[#241232]">
                {formatJson(selectedExport.filters)}
              </pre>
            </section>
            <section>
              <h2 className="text-sm font-semibold text-[#241232]">Validation summary</h2>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-[#ded8e4] bg-[#f8f6fa] p-3 text-xs text-[#241232]">
                {formatJson(selectedExport.summary)}
              </pre>
            </section>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegModal
        description="This removes the generated DORA export artifact from persisted report history. It does not change DORA source data or validation results."
        footer={
          pendingDelete ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button className="button-secondary" onClick={() => setPendingDelete(null)} type="button">
                Cancel
              </button>
              <button
                className="button-secondary border-[#f2b7bf] text-[#9d1f2c] hover:bg-[#ffe2e5]"
                disabled={busyAction === `delete:${pendingDelete.id}`}
                onClick={() => void deleteExport(pendingDelete)}
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
        title="Delete DORA export"
      >
        <div className="rounded-lg border border-[#ded8e4] bg-[#f8f6fa] p-4">
          <div className="font-semibold text-[#241232]">{pendingDelete?.name}</div>
          <div className="mt-2 text-sm text-[#51465e]">
            Created {pendingDelete ? formatDate(pendingDelete.createdAt) : ''}.
          </div>
        </div>
      </RegModal>

      <RegModal
        description="Regenerate this DORA package using the saved filters and current workspace data. The original export remains available unless you delete it."
        footer={
          pendingReplay ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button className="button-secondary" onClick={() => setPendingReplay(null)} type="button">
                Cancel
              </button>
              <button
                className="button-primary"
                disabled={busyAction === `replay:${pendingReplay.id}`}
                onClick={() => void regenerateExport(pendingReplay)}
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
        title="Regenerate DORA export"
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-[#ded8e4] bg-[#f8f6fa] p-4">
            <div className="font-semibold text-[#241232]">{pendingReplay?.name}</div>
            <div className="mt-2 text-sm text-[#51465e]">Saved filters will be replayed against current lint results.</div>
          </div>
          <pre className="max-h-52 overflow-auto rounded-lg border border-[#ded8e4] bg-white p-3 text-xs text-[#241232]">
            {formatJson(pendingReplay?.filters)}
          </pre>
        </div>
      </RegModal>
    </div>
  );
}
