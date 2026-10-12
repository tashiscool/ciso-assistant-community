import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import {
  RegActionMenu,
  RegModal,
  RegRightDrawer,
  RegStatusPill,
} from '../../components/regovise/PagePrimitives';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { Perimeter } from '../assessments/types';
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

export function ResiliencePage() {
  const { identity } = useEdgeIdentity();
  const [perimeters, setPerimeters] = useState<Perimeter[]>([]);
  const [analyses, setAnalyses] = useState<BusinessImpactAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [biaDrawerOpen, setBiaDrawerOpen] = useState(false);
  const [inspectedAnalysis, setInspectedAnalysis] = useState<BusinessImpactAnalysis | null>(null);
  const [editingAnalysis, setEditingAnalysis] = useState<BusinessImpactAnalysis | null>(null);
  const [analysisToDelete, setAnalysisToDelete] = useState<BusinessImpactAnalysis | null>(null);

  const [perimeterId, setPerimeterId] = useState('');
  const [name, setName] = useState('');
  const [refId, setRefId] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0');
  const [status, setStatus] = useState('planned');
  const [riskMatrixName, setRiskMatrixName] = useState('Recovery Matrix');
  const [editName, setEditName] = useState('');
  const [editRefId, setEditRefId] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVersion, setEditVersion] = useState('1.0');
  const [editStatus, setEditStatus] = useState('planned');
  const [editRiskMatrixName, setEditRiskMatrixName] = useState('');
  const [editObservation, setEditObservation] = useState('');

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

  function openAnalysisEdit(analysis: BusinessImpactAnalysis) {
    setEditName(analysis.name);
    setEditRefId(analysis.refId ?? '');
    setEditDescription(analysis.description ?? '');
    setEditVersion(analysis.version);
    setEditStatus(analysis.status);
    setEditRiskMatrixName(analysis.riskMatrixName ?? '');
    setEditObservation(analysis.observation ?? '');
    setEditingAnalysis(analysis);
  }

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
      setBiaDrawerOpen(false);
      setNotice('Business impact analysis created.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  async function updateAnalysis() {
    if (!editingAnalysis) return;
    try {
      setActionBusy(true);
      setError(null);
      setNotice(null);
      await client.put(`/core/business-impact-analyses/${editingAnalysis.id}`, {
        refId: editRefId,
        name: editName,
        description: editDescription,
        version: editVersion,
        status: editStatus,
        observation: editObservation,
        riskMatrixName: editRiskMatrixName,
      });
      setEditingAnalysis(null);
      setNotice('Business impact analysis updated.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionBusy(false);
    }
  }

  async function deleteAnalysis() {
    if (!analysisToDelete) return;
    try {
      setActionBusy(true);
      setError(null);
      setNotice(null);
      await client.delete(`/core/business-impact-analyses/${analysisToDelete.id}`);
      setAnalysisToDelete(null);
      setNotice('Business impact analysis deleted.');
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading resilience workspace...</div>;
  }

  return (
    <div className="min-w-0 space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="eyebrow">Resilience</div>
            <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Business Impact Analysis</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
              Track recovery objectives, asset dependencies, and escalation thresholds so resilience
              planning sits alongside governance, privacy, and third-party oversight.
            </p>
          </div>
          <button
            className="button-primary shrink-0"
            disabled={perimeters.length === 0}
            onClick={() => setBiaDrawerOpen(true)}
            type="button"
          >
            Create BIA
          </button>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">
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

      <section className="grid min-w-0 gap-6">
        <section className="panel">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="eyebrow">Active Studies</div>
              <h2 className="mt-2 text-xl font-semibold text-[#241232]">Business impact studies</h2>
            </div>
            <button
              className="button-secondary shrink-0"
              disabled={perimeters.length === 0}
              onClick={() => setBiaDrawerOpen(true)}
              type="button"
            >
              New BIA
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {analyses.map((analysis) => (
              <div
                key={analysis.id}
                className="panel-subtle block min-w-0 transition hover:border-[#d7c3f1] hover:bg-[#f6f1fa]"
              >
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      className="break-words text-lg font-semibold text-[#241232] transition hover:text-[#6d28d9]"
                      to={`/resilience/business-impact-analyses/${analysis.id}`}
                    >
                      {analysis.name}
                    </Link>
                    <div className="mt-1 text-sm text-[#6f6578]">
                      {analysis.perimeterName ?? 'No perimeter'} · {analysis.riskMatrixName ?? 'No matrix'}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RegStatusPill tone={statusTone(analysis.status)}>{analysis.status}</RegStatusPill>
                    <RegActionMenu
                      actions={[
                        {
                          icon: Eye,
                          label: 'Open detail',
                          to: `/resilience/business-impact-analyses/${analysis.id}`,
                        },
                        {
                          icon: Eye,
                          label: 'Inspect',
                          onSelect: () => setInspectedAnalysis(analysis),
                        },
                        {
                          icon: Pencil,
                          label: 'Edit',
                          onSelect: () => openAnalysisEdit(analysis),
                        },
                        {
                          destructive: true,
                          icon: Trash2,
                          label: 'Delete',
                          onSelect: () => setAnalysisToDelete(analysis),
                        },
                      ]}
                      label={`Open actions for ${analysis.name}`}
                    />
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#4f435c]">
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
              </div>
            ))}
          </div>
        </section>
      </section>

      <RegRightDrawer
        description="Create a resilience study tied to a perimeter and recovery matrix."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="button-secondary"
              onClick={() => setBiaDrawerOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={busy || !name.trim() || perimeters.length === 0}
              form="business-impact-analysis-form"
              type="submit"
            >
              {busy ? 'Creating...' : 'Create BIA'}
            </button>
          </div>
        }
        onOpenChange={setBiaDrawerOpen}
        open={biaDrawerOpen}
        title="Create business impact analysis"
      >
        <form
          className="space-y-4"
          id="business-impact-analysis-form"
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
            <textarea
              className="input min-h-[132px]"
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
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
              <input
                className="input"
                onChange={(event) => setRiskMatrixName(event.target.value)}
                value={riskMatrixName}
              />
            </label>
          </div>
          {perimeters.length === 0 && (
            <div className="notice-warning">Create a perimeter before starting a BIA.</div>
          )}
        </form>
      </RegRightDrawer>

      <RegRightDrawer
        description="Review BIA scope, recovery matrix, and completion metrics."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setInspectedAnalysis(null)} type="button">
              Close
            </button>
            {inspectedAnalysis ? (
              <Link className="button-primary" to={`/resilience/business-impact-analyses/${inspectedAnalysis.id}`}>
                Open detail
              </Link>
            ) : null}
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setInspectedAnalysis(null);
        }}
        open={Boolean(inspectedAnalysis)}
        title={inspectedAnalysis?.name ?? 'Business impact analysis'}
      >
        {inspectedAnalysis ? (
          <div className="space-y-4">
            <div className="panel-subtle">
              <div className="label">Description</div>
              <p className="mt-2 text-sm leading-6 text-[#4f435c]">
                {inspectedAnalysis.description || 'No business impact analysis description provided.'}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="panel-subtle">
                <div className="label">Perimeter</div>
                <div className="mt-2 text-sm font-medium text-[#241232]">{inspectedAnalysis.perimeterName ?? 'n/a'}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Reference</div>
                <div className="mt-2 text-sm font-medium text-[#241232]">{inspectedAnalysis.refId ?? 'n/a'}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Version</div>
                <div className="mt-2 text-sm font-medium text-[#241232]">{inspectedAnalysis.version}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Matrix</div>
                <div className="mt-2 text-sm font-medium text-[#241232]">{inspectedAnalysis.riskMatrixName ?? 'n/a'}</div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="metric-card">
                <div className="metric-label">Documented</div>
                <div className="metric-value">{inspectedAnalysis.metrics.documentation}%</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Recovery tested</div>
                <div className="metric-value">{inspectedAnalysis.metrics.tests}%</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Targets met</div>
                <div className="metric-value">{inspectedAnalysis.metrics.objectives}%</div>
              </div>
            </div>
            <div className="panel-subtle">
              <div className="label">Observation</div>
              <p className="mt-2 text-sm leading-6 text-[#4f435c]">
                {inspectedAnalysis.observation || 'No observations recorded.'}
              </p>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Update BIA metadata and recovery planning status."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setEditingAnalysis(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={actionBusy || !editName.trim()}
              form="business-impact-analysis-edit-form"
              type="submit"
            >
              {actionBusy ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setEditingAnalysis(null);
        }}
        open={Boolean(editingAnalysis)}
        title="Edit business impact analysis"
      >
        <form
          className="space-y-4"
          id="business-impact-analysis-edit-form"
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
            <button className="button-secondary" onClick={() => setAnalysisToDelete(null)} type="button">
              Cancel
            </button>
            <button className="button-danger" disabled={actionBusy} onClick={() => void deleteAnalysis()} type="button">
              {actionBusy ? 'Deleting...' : 'Delete BIA'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setAnalysisToDelete(null);
        }}
        open={Boolean(analysisToDelete)}
        title={`Delete ${analysisToDelete?.name ?? 'business impact analysis'}?`}
      >
        <div className="notice-warning">Review this destructive action before continuing.</div>
      </RegModal>
    </div>
  );
}
