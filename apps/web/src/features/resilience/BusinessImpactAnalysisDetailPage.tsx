import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Eye, Pencil, SlidersHorizontal, Trash2 } from 'lucide-react';
import {
  RegActionMenu,
  RegModal,
  RegRightDrawer,
  RegStatusPill,
} from '../../components/regovise/PagePrimitives';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { BusinessImpactAnalysis } from './types';

const client = new ApiClient();
type PillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

function statusTone(value: string): PillTone {
  const normalized = value.toLowerCase();
  if (normalized.includes('approved') || normalized.includes('complete')) {
    return 'success';
  }
  if (normalized.includes('review')) {
    return 'warning';
  }
  if (normalized.includes('planned')) {
    return 'info';
  }
  return 'neutral';
}

export function BusinessImpactAnalysisDetailPage() {
  const { identity } = useEdgeIdentity();
  const navigate = useNavigate();
  const { analysisId = '' } = useParams();
  const [analysis, setAnalysis] = useState<BusinessImpactAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [inspectedAssetId, setInspectedAssetId] = useState<string | null>(null);
  const [reviewedAssetId, setReviewedAssetId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRefId, setEditRefId] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVersion, setEditVersion] = useState('1.0');
  const [editStatus, setEditStatus] = useState('planned');
  const [editRiskMatrixName, setEditRiskMatrixName] = useState('');
  const [editObservation, setEditObservation] = useState('');

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

  useEffect(() => {
    if (analysisId) {
      void loadDetail();
    }
  }, [analysisId, identity.tenantId]);

  function openEdit() {
    if (!analysis) return;
    setEditName(analysis.name);
    setEditRefId(analysis.refId ?? '');
    setEditDescription(analysis.description ?? '');
    setEditVersion(analysis.version);
    setEditStatus(analysis.status);
    setEditRiskMatrixName(analysis.riskMatrixName ?? '');
    setEditObservation(analysis.observation ?? '');
    setEditing(true);
  }

  async function updateAnalysis() {
    if (!analysis) return;
    try {
      setActionBusy(true);
      setError(null);
      setNotice(null);
      const response = await client.put<{ data: BusinessImpactAnalysis }>(
        `/core/business-impact-analyses/${analysis.id}`,
        {
          refId: editRefId,
          name: editName,
          description: editDescription,
          version: editVersion,
          status: editStatus,
          observation: editObservation,
          riskMatrixName: editRiskMatrixName,
        },
      );
      setAnalysis(response.data);
      setEditing(false);
      setNotice('Business impact analysis updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionBusy(false);
    }
  }

  async function deleteAnalysis() {
    if (!analysis) return;
    try {
      setActionBusy(true);
      setError(null);
      await client.delete(`/core/business-impact-analyses/${analysis.id}`);
      navigate('/resilience');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading business impact analysis...</div>;
  }

  if (!analysis) {
    return <div className="notice-error">{error ?? 'Business impact analysis detail is unavailable.'}</div>;
  }

  const inspectedAsset = analysis.assetAssessments.find((asset) => asset.id === inspectedAssetId) ?? null;
  const reviewedAsset = analysis.assetAssessments.find((asset) => asset.id === reviewedAssetId) ?? null;
  const reviewedMaxThreshold = reviewedAsset
    ? reviewedAsset.thresholds[reviewedAsset.thresholds.length - 1] ?? null
    : null;

  return (
    <div className="min-w-0 space-y-6">
      <section className="panel">
        <Link className="text-sm text-[#6d28d9] transition hover:text-[#5f1aa8]" to="/resilience">
          Back to resilience workspace
        </Link>
        <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="eyebrow">Business Impact Analysis</div>
            <h1 className="mt-2 break-words text-3xl font-semibold text-[#241232]">{analysis.name}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <RegStatusPill tone={statusTone(analysis.status)}>{analysis.status}</RegStatusPill>
            <RegActionMenu
              actions={[
                {
                  icon: Pencil,
                  label: 'Edit',
                  onSelect: openEdit,
                },
                {
                  destructive: true,
                  icon: Trash2,
                  label: 'Delete',
                  onSelect: () => setDeleteOpen(true),
                },
              ]}
              label={`Open actions for ${analysis.name}`}
            />
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#4f435c]">
          {analysis.description || 'No business impact analysis description provided.'}
        </p>
        <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
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
        <div className="mt-5 grid min-w-0 gap-3 text-sm text-[#4f435c] sm:grid-cols-2 2xl:grid-cols-4">
          <div className="panel-subtle">
            <div className="label">Perimeter</div>
            <div className="mt-2 font-medium text-[#241232]">{analysis.perimeterName ?? 'n/a'}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Version</div>
            <div className="mt-2 font-medium text-[#241232]">{analysis.version}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Matrix</div>
            <div className="mt-2 font-medium text-[#241232]">{analysis.riskMatrixName ?? 'n/a'}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Reference</div>
            <div className="mt-2 font-medium text-[#241232]">{analysis.refId ?? 'n/a'}</div>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid min-w-0 gap-6 2xl:grid-cols-[0.8fr_1.2fr]">
        <section className="panel">
          <div className="eyebrow">Recovery Matrix</div>
          <div className="mt-4 space-y-3">
            {analysis.riskMatrix.levels.map((level) => (
              <div className="panel-subtle" key={`${level.label}:${level.score}`}>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 break-words text-sm font-medium text-[#241232]">{level.label}</div>
                  <RegStatusPill tone="neutral">Score {level.score}</RegStatusPill>
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[#62576a]">
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
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-words text-lg font-semibold text-[#241232]">{asset.assetName}</div>
                    <div className="mt-1 text-sm text-[#6f6578]">{asset.folderName}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <RegStatusPill tone={asset.recoveryDocumented ? 'success' : 'neutral'}>
                      {asset.recoveryDocumented ? 'Documented' : 'Undocumented'}
                    </RegStatusPill>
                    <RegStatusPill tone={asset.recoveryTested ? 'success' : 'neutral'}>
                      {asset.recoveryTested ? 'Tested' : 'Untested'}
                    </RegStatusPill>
                    <RegStatusPill tone={asset.recoveryTargetsMet ? 'success' : 'neutral'}>
                      {asset.recoveryTargetsMet ? 'Targets met' : 'Targets open'}
                    </RegStatusPill>
                    <RegActionMenu
                      actions={[
                        {
                          icon: Eye,
                          label: 'Inspect recovery plan',
                          onSelect: () => setInspectedAssetId(asset.id),
                        },
                        {
                          icon: SlidersHorizontal,
                          label: 'Review threshold configuration',
                          onSelect: () => setReviewedAssetId(asset.id),
                        },
                      ]}
                      label={`Open recovery actions for ${asset.assetName}`}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="label">Dependencies</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {asset.dependencies.map((dependency) => (
                        <RegStatusPill key={dependency} tone="neutral">
                          {dependency}
                        </RegStatusPill>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="label">Associated controls</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {asset.associatedControls.map((control) => (
                        <RegStatusPill key={control} tone="neutral">
                          {control}
                        </RegStatusPill>
                      ))}
                    </div>
                  </div>
                </div>

                {asset.observation && <p className="mt-4 text-sm leading-6 text-[#4f435c]">{asset.observation}</p>}

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-[760px] text-left text-sm text-[#4f435c]">
                    <thead>
                      <tr className="text-xs uppercase tracking-[0.18em] text-[#62576a]">
                        <th className="pb-3 pr-4">Threshold</th>
                        <th className="pb-3 pr-4">Impact</th>
                        <th className="pb-3 pr-4">Quantitative</th>
                        <th className="pb-3">Justification</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asset.thresholds.map((threshold) => (
                        <tr className="border-t border-[#ded8e4]" key={`${asset.id}:${threshold.pointInTime}`}>
                          <td className="py-3 pr-4 text-[#241232]">
                            {threshold.humanPit} · {threshold.label}
                          </td>
                          <td className="py-3 pr-4 text-[#4f435c]">{threshold.qualiImpact}</td>
                          <td className="py-3 pr-4 text-[#4f435c]">
                            {threshold.quantiImpact ?? 'n/a'} {threshold.quantiImpactUnit ?? ''}
                          </td>
                          <td className="py-3 text-[#6f6578]">{threshold.justification ?? 'n/a'}</td>
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

      <RegRightDrawer
        description="Review recovery readiness, dependencies, controls, and configured escalation thresholds for this asset."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setInspectedAssetId(null)} type="button">
              Close
            </button>
            <button
              className="button-primary"
              onClick={() => {
                if (inspectedAsset) {
                  setReviewedAssetId(inspectedAsset.id);
                  setInspectedAssetId(null);
                }
              }}
              type="button"
            >
              Review thresholds
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setInspectedAssetId(null);
        }}
        open={Boolean(inspectedAsset)}
        title={inspectedAsset?.assetName ?? 'Recovery plan'}
      >
        {inspectedAsset ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="panel-subtle">
                <div className="label">Documented</div>
                <div className="mt-2">
                  <RegStatusPill tone={inspectedAsset.recoveryDocumented ? 'success' : 'warning'}>
                    {inspectedAsset.recoveryDocumented ? 'Yes' : 'No'}
                  </RegStatusPill>
                </div>
              </div>
              <div className="panel-subtle">
                <div className="label">Tested</div>
                <div className="mt-2">
                  <RegStatusPill tone={inspectedAsset.recoveryTested ? 'success' : 'warning'}>
                    {inspectedAsset.recoveryTested ? 'Yes' : 'No'}
                  </RegStatusPill>
                </div>
              </div>
              <div className="panel-subtle">
                <div className="label">Targets</div>
                <div className="mt-2">
                  <RegStatusPill tone={inspectedAsset.recoveryTargetsMet ? 'success' : 'warning'}>
                    {inspectedAsset.recoveryTargetsMet ? 'Met' : 'Open'}
                  </RegStatusPill>
                </div>
              </div>
            </div>

            <div className="panel-subtle">
              <div className="label">Dependencies</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {inspectedAsset.dependencies.length > 0 ? (
                  inspectedAsset.dependencies.map((dependency) => (
                    <RegStatusPill key={dependency} tone="neutral">
                      {dependency}
                    </RegStatusPill>
                  ))
                ) : (
                  <span className="text-sm text-[#6f6578]">No dependencies recorded.</span>
                )}
              </div>
            </div>

            <div className="panel-subtle">
              <div className="label">Associated controls</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {inspectedAsset.associatedControls.length > 0 ? (
                  inspectedAsset.associatedControls.map((control) => (
                    <RegStatusPill key={control} tone="neutral">
                      {control}
                    </RegStatusPill>
                  ))
                ) : (
                  <span className="text-sm text-[#6f6578]">No controls associated yet.</span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="label">Escalation thresholds</div>
              {inspectedAsset.thresholds.map((threshold) => (
                <div className="rounded-lg border border-[#ded8e4] bg-white p-3" key={`${inspectedAsset.id}:drawer:${threshold.pointInTime}`}>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <div className="break-words text-sm font-semibold text-[#241232]">
                      {threshold.humanPit} · {threshold.label}
                    </div>
                    <RegStatusPill tone="neutral">Impact {threshold.qualiImpact}</RegStatusPill>
                  </div>
                  <div className="mt-2 text-sm text-[#4f435c]">
                    {threshold.quantiImpact ?? 'n/a'} {threshold.quantiImpactUnit ?? ''}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#6f6578]">{threshold.justification ?? 'No justification recorded.'}</p>
                </div>
              ))}
            </div>

            <div className="panel-subtle">
              <div className="label">Observation</div>
              <p className="mt-2 text-sm leading-6 text-[#4f435c]">
                {inspectedAsset.observation ?? 'No observation recorded for this asset assessment.'}
              </p>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegModal
        description="Confirm the configured recovery threshold picture for this asset before using it in continuity or resilience reporting."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setReviewedAssetId(null)} type="button">
              Close
            </button>
            <button
              className="button-primary"
              onClick={() => {
                setReviewedAssetId(null);
                openEdit();
              }}
              type="button"
            >
              Edit BIA metadata
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setReviewedAssetId(null);
        }}
        open={Boolean(reviewedAsset)}
        title={reviewedAsset ? `Review thresholds for ${reviewedAsset.assetName}` : 'Review thresholds'}
      >
        {reviewedAsset ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="metric-card">
                <div className="metric-label">Thresholds</div>
                <div className="metric-value">{reviewedAsset.thresholds.length}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Highest PIT</div>
                <div className="metric-value text-2xl">{reviewedMaxThreshold?.humanPit ?? 'n/a'}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Target state</div>
                <div className="metric-value text-2xl">{reviewedAsset.recoveryTargetsMet ? 'Met' : 'Open'}</div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[#ded8e4] bg-white">
              <table className="min-w-[640px] text-left text-sm text-[#4f435c]">
                <thead className="bg-[#f7f4fa] text-xs uppercase tracking-[0.18em] text-[#62576a]">
                  <tr>
                    <th className="px-4 py-3">Threshold</th>
                    <th className="px-4 py-3">Impact</th>
                    <th className="px-4 py-3">Quantitative</th>
                    <th className="px-4 py-3">Justification</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewedAsset.thresholds.map((threshold) => (
                    <tr className="border-t border-[#ded8e4]" key={`${reviewedAsset.id}:modal:${threshold.pointInTime}`}>
                      <td className="px-4 py-3 font-medium text-[#241232]">
                        {threshold.humanPit} · {threshold.label}
                      </td>
                      <td className="px-4 py-3">{threshold.qualiImpact}</td>
                      <td className="px-4 py-3">
                        {threshold.quantiImpact ?? 'n/a'} {threshold.quantiImpactUnit ?? ''}
                      </td>
                      <td className="px-4 py-3 text-[#6f6578]">{threshold.justification ?? 'n/a'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="notice-info">
              Asset-level recovery settings are reviewed here from the BIA assessment payload; scope-level metadata remains managed by the BIA edit drawer.
            </div>
          </div>
        ) : null}
      </RegModal>

      <RegRightDrawer
        description="Update BIA metadata and recovery planning status."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setEditing(false)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={actionBusy || !editName.trim()}
              form="business-impact-analysis-detail-edit-form"
              type="submit"
            >
              {actionBusy ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        }
        onOpenChange={setEditing}
        open={editing}
        title="Edit business impact analysis"
      >
        <form
          className="space-y-4"
          id="business-impact-analysis-detail-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            void updateAnalysis();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Name</span>
              <input className="input" onChange={(event) => setEditName(event.target.value)} value={editName} />
            </label>
            <label className="space-y-1">
              <span className="label">Reference</span>
              <input className="input" onChange={(event) => setEditRefId(event.target.value)} value={editRefId} />
            </label>
          </div>
          <label className="space-y-1">
            <span className="label">Description</span>
            <textarea
              className="input min-h-[132px]"
              onChange={(event) => setEditDescription(event.target.value)}
              value={editDescription}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="label">Version</span>
              <input className="input" onChange={(event) => setEditVersion(event.target.value)} value={editVersion} />
            </label>
            <label className="space-y-1">
              <span className="label">Status</span>
              <select className="input" onChange={(event) => setEditStatus(event.target.value)} value={editStatus}>
                <option value="planned">Planned</option>
                <option value="in_review">In review</option>
                <option value="approved">Approved</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Matrix name</span>
              <input className="input" onChange={(event) => setEditRiskMatrixName(event.target.value)} value={editRiskMatrixName} />
            </label>
          </div>
          <label className="space-y-1">
            <span className="label">Observation</span>
            <textarea
              className="input min-h-[110px]"
              onChange={(event) => setEditObservation(event.target.value)}
              value={editObservation}
            />
          </label>
        </form>
      </RegRightDrawer>

      <RegModal
        description="This removes the business impact analysis from the current tenant."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setDeleteOpen(false)} type="button">
              Cancel
            </button>
            <button className="button-danger" disabled={actionBusy} onClick={() => void deleteAnalysis()} type="button">
              {actionBusy ? 'Deleting...' : 'Delete BIA'}
            </button>
          </div>
        }
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        title={`Delete ${analysis.name}?`}
      >
        <div className="notice-warning">Review this destructive action before continuing.</div>
      </RegModal>
    </div>
  );
}
