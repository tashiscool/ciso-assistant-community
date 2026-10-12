import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileOutput, Upload } from 'lucide-react';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { WorkspaceFolder } from '../iam/types';
import {
  convertTrackerToTwentyX,
  createTrackerImport,
  explainAssurance,
  getTrackerArtifactPreview,
  getTrackerImport,
  listTrackerImports,
} from './api';
import { AssuranceExplainPanel } from './AssuranceExplainPanel';
import { AssuranceWorkflowPanel } from './AssuranceWorkflowPanel';
import { CoachMarksPanel } from '../../components/CoachMarksPanel';
import {
  RegActionMenu,
  RegModal,
  RegRightDrawer,
  RegStatusPill,
} from '../../components/regovise/PagePrimitives';
import type {
  AssuranceArtifactPreview,
  AssuranceExplainAudience,
  TrackerDiagnostic,
  TrackerImportDetail,
  TrackerImportSummary,
} from './types';

const client = new ApiClient();

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString();
}

function humanizeKey(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function severityTone(value: string | null | undefined): 'danger' | 'neutral' {
  return value === 'critical' || value === 'high' ? 'danger' : 'neutral';
}

function toPreview(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function trackerRowId(item: Pick<TrackerDiagnostic, 'rowIndex' | 'rowKey'>) {
  return item.rowKey ?? String(item.rowIndex);
}

function isExplainAudience(value: string | null): value is AssuranceExplainAudience {
  return value === 'tracker';
}

function isTrackerArtifactFamily(value: string | null) {
  return (
    value === 'tracker_diagnostics' ||
    value === 'tracker_gap_report' ||
    value === 'tracker_gap_matrix' ||
    value === 'tracker_instrumentation_plan'
  );
}

const SAMPLE_ROWS = JSON.stringify(
  [
    {
      control_id: 'CM-8',
      title: 'Inventory mismatch',
      severity: 'high',
      owner: 'Platform',
      status: 'open',
      detail: 'Asset is missing from discovery output.',
    },
    {
      control_id: 'SC-7',
      title: 'Public exposure unresolved',
      severity: 'critical',
      owner: 'Network',
      status: 'open',
      detail: 'Public IP is still reachable without closure evidence.',
    },
  ],
  null,
  2,
);

export function TrackerWorkbenchPage() {
  const { identity } = useEdgeIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [imports, setImports] = useState<TrackerImportSummary[]>([]);
  const [selectedImportId, setSelectedImportId] = useState('');
  const [detail, setDetail] = useState<TrackerImportDetail | null>(null);
  const [lastConvertedEvidenceJobId, setLastConvertedEvidenceJobId] = useState('');
  const [lastConvertedPackageId, setLastConvertedPackageId] = useState('');
  const [selectedRowId, setSelectedRowId] = useState('');
  const [previewFamily, setPreviewFamily] = useState('tracker_diagnostics');
  const [previewState, setPreviewState] = useState<AssuranceArtifactPreview | null>(null);
  const [preview, setPreview] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importDrawerOpen, setImportDrawerOpen] = useState(false);
  const [convertReviewOpen, setConvertReviewOpen] = useState(false);
  const [folderId, setFolderId] = useState('');
  const [name, setName] = useState('Observable tracker import');
  const [rowsText, setRowsText] = useState(SAMPLE_ROWS);
  const requestedImportId = searchParams.get('importId') ?? '';
  const requestedRowId = searchParams.get('rowId') ?? '';
  const requestedFocusId = searchParams.get('focusId') ?? '';
  const requestedAudience = searchParams.get('audience');
  const requestedArtifactFamily = searchParams.get('artifact');

  function updateSearchState(updates: {
    importId?: string | null;
    rowId?: string | null;
    focusId?: string | null;
    audience?: AssuranceExplainAudience | null;
    artifact?: string | null;
  }) {
    const next = new URLSearchParams(searchParams);
    const entries = [
      ['importId', updates.importId],
      ['rowId', updates.rowId],
      ['focusId', updates.focusId],
      ['audience', updates.audience],
      ['artifact', updates.artifact],
    ] as const;
    for (const [key, value] of entries) {
      if (value === undefined) {
        continue;
      }
      if (!value) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    setSearchParams(next, { replace: true });
  }

  async function loadWorkspace() {
    try {
      setLoading(true);
      setError(null);
      const [folderResponse, importResponse] = await Promise.all([
        client.get<{ data: WorkspaceFolder[] }>('/iam/folders?contentType=domain'),
        listTrackerImports(),
      ]);
      setFolders(folderResponse.data);
      setImports(importResponse);
      setFolderId((current) => current || folderResponse.data[0]?.id || '');
      setSelectedImportId((current) => {
        if (requestedImportId && importResponse.some((item) => item.id === requestedImportId)) {
          return requestedImportId;
        }
        return current || importResponse[0]?.id || '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the tracker workbench.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [identity.tenantId, identity.userId, requestedImportId]);

  useEffect(() => {
    if (!requestedImportId || requestedImportId === selectedImportId) {
      return;
    }
    if (imports.some((item) => item.id === requestedImportId)) {
      setSelectedImportId(requestedImportId);
    }
  }, [imports, requestedImportId, selectedImportId]);

  useEffect(() => {
    const current = searchParams.get('importId') ?? '';
    if (current === selectedImportId || (!current && !selectedImportId)) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (selectedImportId) {
      next.set('importId', selectedImportId);
    } else {
      next.delete('importId');
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, selectedImportId, setSearchParams]);

  useEffect(() => {
    if (!selectedImportId) {
      setDetail(null);
      setLastConvertedEvidenceJobId('');
      setLastConvertedPackageId('');
      setSelectedRowId('');
      setPreviewState(null);
      setPreview(null);
      return;
    }
    setLastConvertedEvidenceJobId('');
    setLastConvertedPackageId('');
    let cancelled = false;
    void (async () => {
      try {
        setDetailLoading(true);
        const next = await getTrackerImport(selectedImportId);
        if (!cancelled) {
          setDetail(next);
          setPreviewFamily(isTrackerArtifactFamily(requestedArtifactFamily) ? requestedArtifactFamily : 'tracker_diagnostics');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load the tracker import.');
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requestedArtifactFamily, selectedImportId]);

  useEffect(() => {
    if (!selectedImportId) {
      setPreviewState(null);
      setPreview(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const artifact = await getTrackerArtifactPreview(selectedImportId, previewFamily);
        if (!cancelled) {
          setPreviewState(artifact);
          setPreview(artifact.preview);
        }
      } catch {
        if (!cancelled) {
          setPreviewState(null);
          setPreview(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [previewFamily, selectedImportId]);

  useEffect(() => {
    if (!detail) {
      setSelectedRowId('');
      return;
    }
    const availableRowIds = detail.diagnostics.map((item) => trackerRowId(item));
    setSelectedRowId((current) => {
      if (requestedRowId && availableRowIds.includes(requestedRowId)) {
        return requestedRowId;
      }
      if (current && availableRowIds.includes(current)) {
        return current;
      }
      return availableRowIds[0] ?? '';
    });
  }, [detail, requestedRowId]);

  useEffect(() => {
    const current = searchParams.get('rowId') ?? '';
    if (current === selectedRowId || (!current && !selectedRowId)) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (selectedRowId) {
      next.set('rowId', selectedRowId);
    } else {
      next.delete('rowId');
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, selectedRowId, setSearchParams]);

  const diagnostics = detail?.diagnostics ?? [];
  const selectedRow = useMemo(
    () => diagnostics.find((item) => trackerRowId(item) === selectedRowId) ?? null,
    [diagnostics, selectedRowId],
  );
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of diagnostics) {
      const key = item.category ?? 'general';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [diagnostics]);
  const ownerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of diagnostics) {
      const key = item.ownerName ?? 'Unassigned';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [diagnostics]);
  const openRows = useMemo(
    () => diagnostics.filter((item) => item.rowStatus !== 'closed').length,
    [diagnostics],
  );
  const closedRows = diagnostics.length - openRows;
  const coachMarkItems = [
    {
      id: 'tracker-import',
      eyebrow: 'Import',
      title: 'Tracker rows land here before they become assurance records',
      body: 'This workbench is for row-level intake, diagnostics, and cleanup before you convert tracker material into the formal evidence and package chain.',
      tone: 'focus' as const,
    },
    {
      id: 'tracker-diagnostics',
      eyebrow: 'Diagnostics',
      title: 'Use row diagnostics to classify the real issue',
      body: 'The row list is meant to explain whether the problem is evidence, mapping, ownership, severity, or packaging readiness.',
    },
    {
      id: 'tracker-evidence',
      eyebrow: 'Conversion',
      title: 'Tracker to 20x is a handoff into assurance',
      body: 'Once the row diagnostics make sense, convert the import so Evidence and Packages inherit one consistent record.',
      route: lastConvertedEvidenceJobId ? `/assurance/evidence?evidenceJobId=${encodeURIComponent(lastConvertedEvidenceJobId)}` : '/assurance/evidence',
      ctaLabel: 'Open evidence explorer',
    },
    {
      id: 'tracker-package',
      eyebrow: 'Outputs',
      title: 'Converted packages are meant to stay inspectable',
      body: 'Use the package workbench after conversion to confirm validation, reconciliation, and report outputs instead of treating conversion as the final step.',
      route: lastConvertedPackageId ? `/assurance/packages?packageId=${encodeURIComponent(lastConvertedPackageId)}` : '/assurance/packages',
      ctaLabel: 'Open packages',
    },
  ];

  async function handleImport() {
    try {
      setBusyAction('import');
      setError(null);
      setNotice(null);
      const rows = JSON.parse(rowsText) as Array<Record<string, unknown>>;
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('Tracker rows must be a non-empty JSON array.');
      }
      const result = await createTrackerImport({
        folderId,
        name,
        sourceType: 'csv',
        rows,
      });
      await loadWorkspace();
      setSelectedImportId(result.importJobId);
      setNotice(`Tracker import ${result.importJobId} completed and diagnostics are ready.`);
      setImportDrawerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create the tracker import.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleConvert() {
    if (!detail) {
      return;
    }
    try {
      setBusyAction('convert');
      setError(null);
      setNotice(null);
      const result = await convertTrackerToTwentyX(detail.id);
      setLastConvertedEvidenceJobId(result.evidenceJobId);
      setLastConvertedPackageId(result.packageJobId);
      await loadWorkspace();
      setNotice(`Tracker import converted into evidence job ${result.evidenceJobId} and package ${result.packageJobId}.`);
      setConvertReviewOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to convert the tracker import to 20x.');
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Assurance</div>
        <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Tracker Workbench</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#51465e]">
          Import tracker rows, inspect row-level diagnostics, and convert evidence-gap scenarios into assurance-backed 20x package flows.
        </p>
      </section>

      <CoachMarksPanel
        storageKey="assurance-tracker-workbench"
        title="Use Tracker as the intake-and-diagnostics layer."
        description="This page helps teams turn messy tracker rows into a cleaner evidence-backed assurance flow instead of treating a spreadsheet as the system of record."
        items={coachMarkItems}
      />

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
        <section className="space-y-4">
          <section className="panel">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="label">Tracker intake</div>
                <h2 className="mt-2 text-lg font-semibold text-[#241232]">New tracker import</h2>
                <p className="mt-2 text-sm leading-6 text-[#6f6578]">
                  Review the domain, import label, and row payload in a drawer before adding tracker diagnostics.
                </p>
              </div>
              <button className="button-primary shrink-0" onClick={() => setImportDrawerOpen(true)} type="button">
                <Upload className="mr-2 h-4 w-4" />
                New import
              </button>
            </div>
          </section>

          <section className="space-y-3">
            {imports.map((item) => (
              <button
                key={item.id}
                className={`panel w-full text-left transition ${selectedImportId === item.id ? 'border-[#d7c3f1] bg-[#f3e9ff]' : ''}`}
                onClick={() => {
                  setSelectedImportId(item.id);
                  updateSearchState({ importId: item.id, rowId: null, focusId: null });
                }}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="eyebrow">{item.sourceType}</div>
                    <h2 className="mt-2 text-lg font-semibold text-[#241232]">{item.name}</h2>
                    <div className="mt-2 font-mono text-xs text-[#6d28d9]">{item.id}</div>
                  </div>
                  <RegStatusPill tone="neutral">{item.status}</RegStatusPill>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-[#6f6578] sm:grid-cols-3">
                  <div>Rows: {item.rowCount}</div>
                  <div>Imported: {item.importedCount}</div>
                  <div>Errors: {item.errorCount}</div>
                </div>
              </button>
            ))}

            {!loading && imports.length === 0 && (
              <div className="panel text-sm text-[#6f6578]">No tracker imports are available yet.</div>
            )}
            {loading && <div className="panel text-sm text-[#6f6578]">Loading tracker imports...</div>}
          </section>
        </section>

        <section className="space-y-4">
          {detailLoading && <div className="panel text-sm text-[#6f6578]">Loading tracker diagnostics...</div>}

          {detail && (
            <>
              <section className="panel">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="label">Selected import</div>
                    <h2 className="mt-2 text-2xl font-semibold text-[#241232]">{detail.name}</h2>
                    <div className="mt-2 font-mono text-xs text-[#6d28d9]">{detail.id}</div>
                    <div className="mt-3 grid gap-2 text-sm text-[#6f6578] sm:grid-cols-2">
                      <div>Created: {formatDate(detail.createdAt)}</div>
                      <div>Updated: {formatDate(detail.updatedAt)}</div>
                      <div>Rows: {detail.rowCount}</div>
                      <div>Imported: {detail.importedCount}</div>
                    </div>
                    {(lastConvertedEvidenceJobId || lastConvertedPackageId) && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {lastConvertedEvidenceJobId && (
                          <Link
                            className="button-secondary"
                            to={`/assurance/evidence?evidenceJobId=${encodeURIComponent(lastConvertedEvidenceJobId)}`}
                          >
                            Open latest evidence bundle
                          </Link>
                        )}
                        {lastConvertedPackageId && (
                          <Link
                            className="button-secondary"
                            to={`/assurance/packages?packageId=${encodeURIComponent(lastConvertedPackageId)}`}
                          >
                            Open latest package
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      className="button-secondary"
                      disabled={busyAction === 'convert'}
                      onClick={() => setConvertReviewOpen(true)}
                      type="button"
                    >
                      <FileOutput className="mr-2 h-4 w-4" />
                      {busyAction === 'convert' ? 'Converting...' : 'Tracker to 20x'}
                    </button>
                    <RegActionMenu
                      actions={[
                        {
                          label: 'Review conversion',
                          icon: FileOutput,
                          onSelect: () => setConvertReviewOpen(true),
                        },
                        ...(lastConvertedEvidenceJobId
                          ? [
                              {
                                label: 'Open latest evidence bundle',
                                to: `/assurance/evidence?evidenceJobId=${encodeURIComponent(lastConvertedEvidenceJobId)}`,
                              },
                            ]
                          : []),
                        ...(lastConvertedPackageId
                          ? [
                              {
                                label: 'Open latest package',
                                to: `/assurance/packages?packageId=${encodeURIComponent(lastConvertedPackageId)}`,
                              },
                            ]
                          : []),
                      ]}
                      label="Open tracker import actions"
                    />
                  </div>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="metric-card">
                  <div className="metric-label">Open rows</div>
                  <div className="metric-value">{String(detail.summary.openRows ?? openRows)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">High</div>
                  <div className="metric-value">{String((detail.summary.severityCounts as Record<string, number> | undefined)?.high ?? 0)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Critical</div>
                  <div className="metric-value">{String((detail.summary.severityCounts as Record<string, number> | undefined)?.critical ?? 0)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Packages</div>
                  <div className="metric-value">{detail.packages.length}</div>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-3">
                <section className="panel-subtle">
                  <div className="label">Status posture</div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3 text-sm">
                      <div className="text-[#51465e]">Open rows</div>
                      <div className="font-mono text-[#6d28d9]">{openRows}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3 text-sm">
                      <div className="text-[#51465e]">Closed rows</div>
                      <div className="font-mono text-[#6d28d9]">{closedRows}</div>
                    </div>
                  </div>
                </section>

                <section className="panel-subtle">
                  <div className="label">Top categories</div>
                  <div className="mt-3 space-y-2">
                    {categoryCounts.map(([category, count]) => (
                      <div key={category} className="flex items-center justify-between gap-3 rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3 text-sm">
                        <div className="text-[#51465e]">{humanizeKey(category)}</div>
                        <div className="font-mono text-[#6d28d9]">{count}</div>
                      </div>
                    ))}
                    {categoryCounts.length === 0 && <div className="text-sm text-[#6f6578]">No categories were parsed from this import yet.</div>}
                  </div>
                </section>

                <section className="panel-subtle">
                  <div className="label">Top owners</div>
                  <div className="mt-3 space-y-2">
                    {ownerCounts.map(([owner, count]) => (
                      <div key={owner} className="flex items-center justify-between gap-3 rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3 text-sm">
                        <div className="text-[#51465e]">{owner}</div>
                        <div className="font-mono text-[#6d28d9]">{count}</div>
                      </div>
                    ))}
                    {ownerCounts.length === 0 && <div className="text-sm text-[#6f6578]">No owners were parsed from this import yet.</div>}
                  </div>
                </section>
              </section>

              <AssuranceWorkflowPanel
                disabledMessage="Select a tracker import to load its workflow activity."
                emptyMessage="No workflow runs are linked to this tracker import yet."
                helperText="Trace tracker import, tracker-to-20x conversion, and downstream package activity from the same import lineage."
                linkedRecordIds={[selectedImportId, lastConvertedEvidenceJobId, lastConvertedPackageId]}
              />

              <section className="panel-subtle">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <div className="label">Tracker artifacts</div>
                    <p className="mt-2 text-sm text-[#6f6578]">
                      Review the published tracker diagnostics, gap report, gap matrix, and instrumentation plan before converting the import into a 20x package.
                    </p>
                  </div>
                  <label className="space-y-1 xl:min-w-[280px]">
                    <span className="label">Artifact preview</span>
                    <select
                      className="input"
                      onChange={(event) => {
                        setPreviewFamily(event.target.value);
                        updateSearchState({ artifact: event.target.value });
                      }}
                      value={previewFamily}
                    >
                      <option value="tracker_diagnostics">tracker_diagnostics</option>
                      <option value="tracker_gap_report">tracker_gap_report</option>
                      <option value="tracker_gap_matrix">tracker_gap_matrix</option>
                      <option value="tracker_instrumentation_plan">tracker_instrumentation_plan</option>
                    </select>
                  </label>
                </div>
                {previewState && (
                  <div className="mt-4 rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-4 py-4 text-sm text-[#6f6578]">
                    <div>Artifact family: {previewState.family}</div>
                    <div>Object count: {previewState.items.length}</div>
                    <div>Retrieval: {previewState.retrieval.kind}</div>
                  </div>
                )}
                <pre className="mt-4 max-h-[420px] overflow-auto rounded-2xl border border-[#ded8e4] bg-[#f7f2fa] p-4 text-xs leading-6 text-[#51465e]">
                  {toPreview(preview)}
                </pre>
              </section>

              <section className="panel-subtle">
                <div className="label">Row diagnostics</div>
                <div className="mt-3 space-y-2">
                  {detail.diagnostics.map((item) => {
                    const rowId = trackerRowId(item);
                    return (
                    <button
                      key={`${item.rowIndex}:${item.rowKey ?? 'row'}`}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                        selectedRowId === rowId
                          ? 'border-[#8b35e6]/30 bg-[#f2e8ff]'
                          : 'border-[#ded8e4] bg-[#fbf9fc] hover:border-[#8b35e6]/25 hover:bg-[#f8f3ff]'
                      }`}
                      onClick={() => {
                        setSelectedRowId(rowId);
                        updateSearchState({ rowId, focusId: rowId });
                      }}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-[#241232]">
                            Row {item.rowIndex}
                            {item.rowKey ? ` · ${item.rowKey}` : ''}
                          </div>
                          <div className="mt-2 text-xs leading-5 text-[#6f6578]">{item.detail}</div>
                        </div>
                        <RegStatusPill tone={severityTone(item.severity)}>
                          {item.severity ?? item.rowStatus}
                        </RegStatusPill>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-[#62576a] sm:grid-cols-3">
                        <div>Owner: {item.ownerName ?? '—'}</div>
                        <div>Category: {item.category ?? 'general'}</div>
                        <div>Controls: {item.controlRefs.join(', ') || '—'}</div>
                      </div>
                    </button>
                  )})}
                  {detail.diagnostics.length === 0 && (
                    <div className="text-sm text-[#6f6578]">No tracker diagnostics were recorded for this import.</div>
                  )}
                </div>
              </section>

              {selectedRow && (
                <section className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
                  <section className="panel-subtle">
                    <div className="label">Selected row</div>
                    <div className="mt-3 rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-[#241232]">
                            Row {selectedRow.rowIndex}
                            {selectedRow.rowKey ? ` · ${selectedRow.rowKey}` : ''}
                          </div>
                          <div className="mt-2 text-xs leading-5 text-[#6f6578]">{selectedRow.detail}</div>
                        </div>
                        <RegStatusPill tone={severityTone(selectedRow.severity)}>
                          {selectedRow.severity ?? selectedRow.rowStatus}
                        </RegStatusPill>
                      </div>
                      <div className="mt-4 grid gap-2 text-sm text-[#6f6578] sm:grid-cols-2">
                        <div>Status: {selectedRow.rowStatus}</div>
                        <div>Category: {selectedRow.category ?? 'general'}</div>
                        <div>Owner: {selectedRow.ownerName ?? '—'}</div>
                        <div>Gap type: {selectedRow.gapType ?? 'evidence_gap'}</div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedRow.controlRefs.map((control) => (
                          <span key={control} className="rounded-full border border-[#d7c3f1] bg-[#f2e8ff] px-3 py-1 font-mono text-xs text-[#6d28d9]">
                            {control}
                          </span>
                        ))}
                        {selectedRow.controlRefs.length === 0 && (
                          <span className="text-xs text-[#62576a]">No control references recorded for this row.</span>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          className="button-secondary"
                          onClick={() => updateSearchState({ rowId: trackerRowId(selectedRow), focusId: trackerRowId(selectedRow), audience: 'tracker' })}
                          type="button"
                        >
                          Explain selected row
                        </button>
                        {lastConvertedEvidenceJobId && (
                          <Link
                            className="button-secondary"
                            to={`/assurance/evidence?evidenceJobId=${encodeURIComponent(lastConvertedEvidenceJobId)}`}
                          >
                            Open converted evidence
                          </Link>
                        )}
                        {lastConvertedPackageId && (
                          <Link
                            className="button-secondary"
                            to={`/assurance/packages?packageId=${encodeURIComponent(lastConvertedPackageId)}`}
                          >
                            Open converted package
                          </Link>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="panel-subtle">
                    <div className="label">Raw row payload</div>
                    <pre className="mt-4 max-h-[460px] overflow-auto rounded-2xl border border-[#ded8e4] bg-[#f7f2fa] p-4 text-xs leading-6 text-[#51465e]">
                      {toPreview(selectedRow.rawRow)}
                    </pre>
                  </section>
                </section>
              )}

              <AssuranceExplainPanel
                audiences={[{ value: 'tracker', label: 'Tracker reviewer' }]}
                defaultAudience="tracker"
                disabled={!detail}
                focusOptions={
                  detail?.diagnostics.map((item) => ({
                    value: item.rowKey ?? String(item.rowIndex),
                    label: `Row ${item.rowIndex}${item.rowKey ? ` · ${item.rowKey}` : ''}`,
                  })) ?? []
                }
                heading="Tracker explainer"
                initialAudience={isExplainAudience(requestedAudience) ? requestedAudience : 'tracker'}
                initialFocusId={requestedFocusId}
                helperText="Summarize the imported tracker rows, drill into a specific row, and keep the explanation grounded in the row diagnostics."
                loadExplanation={({ audience, focusId, question }) =>
                  explainAssurance({
                    audience,
                    importJobId: selectedImportId,
                    focusId,
                    question,
                  })
                }
                onAudienceChange={(audience) => updateSearchState({ audience })}
                onFocusIdChange={(focusId) => updateSearchState({ focusId: focusId || null })}
                requestKey={`${selectedImportId}:${detail?.updatedAt ?? 'none'}`}
              />

              <section className="panel-subtle">
                <div className="label">Generated packages</div>
                <div className="mt-3 space-y-2">
                  {detail.packages.map((item) => (
                    <Link
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3 transition hover:border-[#8b35e6]/30 hover:bg-[#f8f3ff]"
                      to={`/assurance/packages?packageId=${encodeURIComponent(item.id)}`}
                    >
                      <div>
                        <div className="text-sm font-medium text-[#241232]">{item.fileName}</div>
                        <div className="font-mono text-xs text-[#62576a]">{item.id}</div>
                      </div>
                      <div className="text-xs text-[#6f6578]">{formatDate(item.createdAt)}</div>
                    </Link>
                  ))}
                  {detail.packages.length === 0 && (
                    <div className="text-sm text-[#6f6578]">No packages have been built from this tracker import yet.</div>
                  )}
                </div>
              </section>
            </>
          )}
        </section>
      </section>

      <RegRightDrawer
        description="Import tracker rows into the diagnostics layer without changing backend contracts."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setImportDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={busyAction === 'import'} form="tracker-import-form" type="submit">
              <Upload className="mr-2 h-4 w-4" />
              {busyAction === 'import' ? 'Importing...' : 'Import rows'}
            </button>
          </div>
        }
        onOpenChange={setImportDrawerOpen}
        open={importDrawerOpen}
        title="New tracker import"
      >
        <form
          className="space-y-4"
          id="tracker-import-form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleImport();
          }}
        >
          <label className="space-y-1">
            <span className="label">Domain</span>
            <select className="input" onChange={(event) => setFolderId(event.target.value)} value={folderId}>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">Import name</span>
            <input className="input" onChange={(event) => setName(event.target.value)} value={name} />
          </label>
          <label className="space-y-1">
            <span className="label">Tracker rows JSON</span>
            <textarea
              className="input min-h-[360px] font-mono text-xs leading-6"
              onChange={(event) => setRowsText(event.target.value)}
              value={rowsText}
            />
          </label>
          <div className="rounded-lg border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3 text-xs leading-5 text-[#62576a]">
            Rows must be a non-empty JSON array. Imported rows stay in tracker diagnostics until you review conversion to 20x.
          </div>
        </form>
      </RegRightDrawer>

      <RegModal
        description="Confirm the tracker-to-20x handoff before creating downstream evidence and package records."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setConvertReviewOpen(false)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={busyAction === 'convert' || !detail} onClick={() => void handleConvert()} type="button">
              <FileOutput className="mr-2 h-4 w-4" />
              {busyAction === 'convert' ? 'Converting...' : 'Convert to 20x'}
            </button>
          </div>
        }
        onOpenChange={setConvertReviewOpen}
        open={convertReviewOpen}
        title="Convert tracker import to 20x"
      >
        <div className="space-y-4 text-sm text-[#51465e]">
          <p>
            This creates a formal evidence job and package from the selected tracker import. Review row counts and unresolved
            diagnostics before continuing.
          </p>
          {detail ? (
            <div className="rounded-lg border border-[#ded8e4] bg-[#fbf9fc] px-4 py-4">
              <div className="font-semibold text-[#241232]">{detail.name}</div>
              <div className="mt-2 font-mono text-xs text-[#6d28d9]">{detail.id}</div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div>Rows: {detail.rowCount}</div>
                <div>Imported: {detail.importedCount}</div>
                <div>Open rows: {String((detail.summary.openRows as number | undefined) ?? openRows)}</div>
                <div>Generated packages: {detail.packages.length}</div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-[#ded8e4] bg-[#fbf9fc] px-4 py-4">Select an import before converting.</div>
          )}
        </div>
      </RegModal>
    </div>
  );
}
