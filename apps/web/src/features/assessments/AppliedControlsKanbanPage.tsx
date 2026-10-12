import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { RegStatusPill } from '../../components/regovise/PagePrimitives';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { AppliedControl } from './types';

const client = new ApiClient();

const STATUS_COLUMNS = [
  { id: '--', label: 'Tracking', tone: 'neutral' },
  { id: 'to_do', label: 'To do', tone: 'purple' },
  { id: 'in_progress', label: 'In progress', tone: 'warning' },
  { id: 'on_hold', label: 'On hold', tone: 'purple' },
  { id: 'active', label: 'Active', tone: 'success' },
  { id: 'deprecated', label: 'Deprecated', tone: 'danger' },
] as const;

function formatCurrency(value: number | null | undefined) {
  return typeof value === 'number'
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
    : 'n/a';
}

export function AppliedControlsKanbanPage() {
  const { identity } = useEdgeIdentity();
  const { assessmentId: routeAssessmentId } = useParams<{ assessmentId?: string }>();
  const [searchParams] = useSearchParams();
  const complianceAssessmentId =
    searchParams.get('complianceAssessmentId') ?? routeAssessmentId ?? '';
  const backUrl =
    searchParams.get('backUrl') ||
    (routeAssessmentId ? `/compliance-assessments/${routeAssessmentId}` : '/assessments');
  const backLabel =
    searchParams.get('backLabel') || (routeAssessmentId ? 'Back to compliance review' : 'Back');
  const [controls, setControls] = useState<AppliedControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedControlId, setDraggedControlId] = useState<string | null>(null);

  async function loadControls() {
    try {
      setLoading(true);
      setError(null);
      const suffix = complianceAssessmentId
        ? `?complianceAssessmentId=${encodeURIComponent(complianceAssessmentId)}`
        : '';
      const response = await client.get<{ data: AppliedControl[] }>(`/core/applied-controls${suffix}`);
      setControls(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadControls();
  }, [identity.tenantId, identity.userId, complianceAssessmentId]);

  const folders = useMemo(() => {
    return [...new Map(controls.map((control) => [control.folderId, control.folderName])).entries()].map(
      ([folderId, folderName]) => ({ folderId, folderName }),
    );
  }, [controls]);

  async function updateControl(id: string, patch: Partial<AppliedControl>) {
    const response = await client.post<{ data: AppliedControl }>(`/core/applied-controls/${id}`, {
      status: patch.status,
      priority: patch.priority,
      category: patch.category,
      csfFunction: patch.csfFunction,
      ownerName: patch.ownerName,
      eta: patch.eta,
      expiryDate: patch.expiryDate,
      controlImpact: patch.controlImpact,
      effort: patch.effort,
      annualCost: patch.annualCost,
      notes: patch.notes,
    });

    setControls((current) => current.map((item) => (item.id === id ? response.data : item)));
  }

  async function handleDrop(nextStatus: string) {
    if (!draggedControlId) {
      return;
    }

    const control = controls.find((item) => item.id === draggedControlId);
    if (!control || control.status === nextStatus) {
      setDraggedControlId(null);
      return;
    }

    setControls((current) =>
      current.map((item) => (item.id === draggedControlId ? { ...item, status: nextStatus } : item)),
    );

    try {
      await updateControl(draggedControlId, { ...control, status: nextStatus });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update control status.');
      await loadControls();
    } finally {
      setDraggedControlId(null);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading control board...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <Link className="text-sm text-[#6d28d9] transition hover:text-[#5f1aa8]" to={backUrl}>
          {backLabel}
        </Link>
        <div className="eyebrow mt-4">Remediation</div>
        <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Applied Controls Board</h1>
        <p className="mt-3 text-sm leading-6 text-[#4f435c]">
          Drag applied controls between workflow states to update the remediation queue.
        </p>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="space-y-6">
        {folders.map((folder) => (
          <div key={folder.folderId} className="panel">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="eyebrow">Domain</div>
                <h2 className="mt-2 text-xl font-semibold text-[#241232]">{folder.folderName}</h2>
              </div>
              <RegStatusPill tone="neutral">
                {controls.filter((control) => control.folderId === folder.folderId).length} controls
              </RegStatusPill>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-6">
              {STATUS_COLUMNS.map((column) => {
                const items = controls.filter(
                  (control) => control.folderId === folder.folderId && control.status === column.id,
                );

                return (
                  <div
                    key={`${folder.folderId}-${column.id}`}
                    className="min-h-[240px] rounded-3xl border border-[#ded8e4] bg-white p-4"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => void handleDrop(column.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <RegStatusPill tone={column.tone}>
                        {column.label}
                      </RegStatusPill>
                      <div className="text-xs text-[#62576a]">{items.length}</div>
                    </div>
                    <div className="mt-4 space-y-3">
                      {items.map((control) => (
                        <div
                          key={control.id}
                          className="cursor-grab rounded-3xl border border-[#ded8e4] bg-[#f6f1fa] p-4 active:cursor-grabbing"
                          draggable
                          onDragEnd={() => setDraggedControlId(null)}
                          onDragStart={() => setDraggedControlId(control.id)}
                        >
                          <div className="font-medium text-[#241232]">
                            {control.refId ? `${control.refId} ` : ''}
                            {control.name}
                          </div>
                          <div className="mt-2 text-xs text-[#6f6578]">{control.priority ?? '--'} priority</div>
                          <div className="mt-3 text-sm text-[#4f435c]">{control.ownerName ?? 'Unassigned'}</div>
                          <div className="mt-2 text-xs text-[#62576a]">{formatCurrency(control.annualCost)}</div>
                        </div>
                      ))}
                      {items.length === 0 && (
                        <div className="rounded-3xl border border-dashed border-[#ded8e4] p-4 text-xs text-[#62576a]">
                          Drop a control here
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {folders.length === 0 && (
          <div className="panel text-sm text-[#6f6578]">No applied controls match the current filter.</div>
        )}
      </section>
    </div>
  );
}
