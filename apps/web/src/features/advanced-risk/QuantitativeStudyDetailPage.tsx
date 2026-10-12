import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  RegActionMenu,
  RegModal,
  RegRightDrawer,
} from '../../components/regovise/PagePrimitives';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { QuantitativeStudy } from './types';

const client = new ApiClient();

type QuantitativeEditForm = {
  name: string;
  description: string;
  status: string;
  distributionModel: string;
  currency: string;
  lossThreshold: string;
  observation: string;
  version: string;
};

function buildEditForm(study: QuantitativeStudy): QuantitativeEditForm {
  return {
    name: study.name,
    description: study.description ?? '',
    status: study.status,
    distributionModel: study.distributionModel,
    currency: study.currency,
    lossThreshold: String(study.lossThreshold ?? ''),
    observation: study.observation ?? '',
    version: study.version,
  };
}

function StudyField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-md border border-[#ded8e4] bg-white px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[#62576a]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-[#241232]">{value || 'n/a'}</dd>
    </div>
  );
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function QuantitativeStudyDetailPage() {
  const { identity } = useEdgeIdentity();
  const navigate = useNavigate();
  const { studyId } = useParams<{ studyId: string }>();
  const [study, setStudy] = useState<QuantitativeStudy | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<QuantitativeEditForm>({
    name: '',
    description: '',
    status: 'planned',
    distributionModel: 'lognormal_ci90',
    currency: 'USD',
    lossThreshold: '',
    observation: '',
    version: '1.0',
  });

  async function loadStudy() {
    if (!studyId) {
      setError('Quantitative study id is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{ data: QuantitativeStudy }>(`/ops/quantitative-studies/${studyId}`);
      setStudy(response.data);
      setEditForm(buildEditForm(response.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStudy();
  }, [identity.tenantId, identity.userId, studyId]);

  function openEditDrawer() {
    if (study) {
      setEditForm(buildEditForm(study));
    }
    setEditDrawerOpen(true);
  }

  async function saveStudy() {
    if (!study) {
      return;
    }

    const parsedThreshold = Number(editForm.lossThreshold);
    const lossThreshold =
      editForm.lossThreshold.trim() && Number.isFinite(parsedThreshold) ? parsedThreshold : null;

    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      const response = await client.put<{ data: QuantitativeStudy }>(`/ops/quantitative-studies/${study.id}`, {
        ...editForm,
        lossThreshold,
      });
      setStudy(response.data);
      setEditForm(buildEditForm(response.data));
      setEditDrawerOpen(false);
      setNotice('Quantitative study details updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  async function deleteStudy() {
    if (!study) {
      return;
    }

    try {
      setBusy(true);
      setError(null);
      await client.delete(`/ops/quantitative-studies/${study.id}`);
      setDeleteModalOpen(false);
      navigate('/advanced-risk/quantitative');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  async function retrigger() {
    if (!studyId) {
      return;
    }

    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      await client.post(`/ops/quantitative-studies/${studyId}/retrigger-simulations`);
      setNotice('Portfolio metrics refreshed.');
      await loadStudy();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading quantitative study...</div>;
  }

  if (!study) {
    return <div className="notice-error">Quantitative study not found for tenant {identity.tenantId}.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <Link className="text-sm text-[#6d28d9] transition hover:text-[#5f1aa8]" to="/advanced-risk/quantitative">
                Back to quantitative workspace
              </Link>
              <div className="eyebrow mt-4">{study.refId ?? 'Quantitative Study'}</div>
              <h1 className="mt-2 text-3xl font-semibold text-[#241232]">{study.name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
                {study.description || 'No quantitative study description provided.'}
              </p>
            </div>
            <RegActionMenu
              actions={[
                { label: 'Review study snapshot', onSelect: () => setReviewDrawerOpen(true) },
                { label: 'Edit study details', onSelect: openEditDrawer },
                { label: 'Delete study', destructive: true, onSelect: () => setDeleteModalOpen(true) },
              ]}
              label="Open quantitative study actions"
            />
          </div>
        </div>
        <div className="panel-subtle space-y-4">
          <div className="flex flex-wrap gap-3">
            <Link className="button-secondary" to={`/advanced-risk/quantitative/${study.id}/executive-summary`}>
              Executive Summary
            </Link>
            <Link className="button-secondary" to={`/advanced-risk/quantitative/${study.id}/key-metrics`}>
              Key Metrics
            </Link>
            <Link className="button-secondary" to={`/advanced-risk/quantitative/${study.id}/action-plan`}>
              Action Plan
            </Link>
          </div>
          <button className="button-primary" disabled={busy} onClick={() => void retrigger()} type="button">
            {busy ? 'Refreshing...' : 'Retrigger Simulations'}
          </button>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Current ALE</div>
          <div className="mt-3 text-sm font-semibold text-[#241232]">
            {formatCurrency(study.metrics.currentAleCombined, study.currency)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Residual ALE</div>
          <div className="mt-3 text-sm font-semibold text-[#241232]">
            {formatCurrency(study.metrics.residualAleCombined, study.currency)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Risk reduction</div>
          <div className="mt-3 text-sm font-semibold text-[#241232]">
            {formatCurrency(study.metrics.riskReduction, study.currency)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Threshold breaches</div>
          <div className="metric-value">{study.metrics.scenariosAboveThreshold}</div>
        </div>
      </section>

      <section className="panel min-w-0 overflow-hidden p-0">
        <div className="max-w-full overflow-x-auto">
          <table className="min-w-[860px] text-left text-sm">
            <thead className="border-b border-[#ded8e4] bg-white text-xs uppercase tracking-[0.18em] text-[#62576a]">
              <tr>
                <th className="px-4 py-3">Scenario</th>
                <th className="px-4 py-3">Current ALE</th>
                <th className="px-4 py-3">Residual ALE</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Treatment</th>
              </tr>
            </thead>
            <tbody>
              {study.scenarios.map((scenario) => (
                <tr key={scenario.id} className="border-t border-[#eeeaf2] align-top">
                  <td className="px-4 py-4">
                    <div className="font-medium text-[#241232]">
                      {scenario.refId} {scenario.name}
                    </div>
                    {scenario.description && <div className="mt-2 text-sm text-[#6f6578]">{scenario.description}</div>}
                  </td>
                  <td className="px-4 py-4 text-[#4f435c]">
                    {formatCurrency(scenario.currentAle, study.currency)}
                  </td>
                  <td className="px-4 py-4 text-[#4f435c]">
                    {formatCurrency(scenario.residualAle, study.currency)}
                  </td>
                  <td className="px-4 py-4 text-[#4f435c]">{scenario.ownerName ?? 'Unassigned'}</td>
                  <td className="px-4 py-4 text-[#4f435c]">{scenario.treatmentStrategy ?? 'No treatment defined'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <RegRightDrawer
        description="Review the economic model, mapped register, and current portfolio metrics without changing the study."
        footer={
          <div className="flex justify-end">
            <button className="button-secondary" onClick={() => setReviewDrawerOpen(false)} type="button">
              Close
            </button>
          </div>
        }
        onOpenChange={setReviewDrawerOpen}
        open={reviewDrawerOpen}
        title="Quantitative study snapshot"
      >
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StudyField label="Name" value={study.name} />
          <StudyField label="Reference" value={study.refId ?? 'Quantitative Study'} />
          <StudyField label="Domain" value={study.folderName} />
          <StudyField label="Risk register" value={study.riskRegisterName} />
          <StudyField label="Status" value={study.status.replace(/_/g, ' ')} />
          <StudyField label="Version" value={study.version} />
          <StudyField label="Distribution model" value={study.distributionModel} />
          <StudyField label="Loss threshold" value={study.lossThreshold ? formatCurrency(study.lossThreshold, study.currency) : null} />
          <StudyField label="Current ALE" value={formatCurrency(study.metrics.currentAleCombined, study.currency)} />
          <StudyField label="Residual ALE" value={formatCurrency(study.metrics.residualAleCombined, study.currency)} />
          <StudyField label="Risk reduction" value={formatCurrency(study.metrics.riskReduction, study.currency)} />
          <StudyField label="Scenarios" value={study.metrics.totalScenarios} />
        </dl>
        <div className="mt-4 rounded-md border border-[#ded8e4] bg-[#f8f5fb] p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#62576a]">Observation</div>
          <p className="mt-2 text-sm leading-6 text-[#4f435c]">
            {study.observation || 'No study observation has been recorded.'}
          </p>
        </div>
      </RegRightDrawer>

      <RegRightDrawer
        description="Update the editable quantitative risk study fields. Register mappings and generated scenarios stay preserved."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setEditDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={busy} form="quantitative-edit-study" type="submit">
              {busy ? 'Saving...' : 'Save study'}
            </button>
          </div>
        }
        onOpenChange={setEditDrawerOpen}
        open={editDrawerOpen}
        title="Edit quantitative study"
      >
        <form
          className="space-y-4"
          id="quantitative-edit-study"
          onSubmit={(event) => {
            event.preventDefault();
            void saveStudy();
          }}
        >
          <label className="space-y-1">
            <span className="label">Name</span>
            <input
              className="input"
              onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
              value={editForm.name}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Description</span>
            <textarea
              className="input min-h-[110px]"
              onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
              value={editForm.description}
            />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Status</span>
              <select
                className="input"
                onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
                value={editForm.status}
              >
                <option value="planned">Planned</option>
                <option value="in_progress">In progress</option>
                <option value="in_review">In review</option>
                <option value="complete">Complete</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Distribution model</span>
              <select
                className="input"
                onChange={(event) => setEditForm((current) => ({ ...current, distributionModel: event.target.value }))}
                value={editForm.distributionModel}
              >
                <option value="lognormal_ci90">Lognormal CI90</option>
                <option value="triangular">Triangular</option>
                <option value="pert">PERT</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Currency</span>
              <input
                className="input"
                onChange={(event) => setEditForm((current) => ({ ...current, currency: event.target.value }))}
                value={editForm.currency}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Loss threshold</span>
              <input
                className="input"
                inputMode="numeric"
                onChange={(event) => setEditForm((current) => ({ ...current, lossThreshold: event.target.value }))}
                value={editForm.lossThreshold}
              />
            </label>
          </div>
          <label className="space-y-1">
            <span className="label">Version</span>
            <input
              className="input"
              onChange={(event) => setEditForm((current) => ({ ...current, version: event.target.value }))}
              value={editForm.version}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Observation</span>
            <textarea
              className="input min-h-[110px]"
              onChange={(event) => setEditForm((current) => ({ ...current, observation: event.target.value }))}
              value={editForm.observation}
            />
          </label>
        </form>
      </RegRightDrawer>

      <RegModal
        description="This permanently removes the quantitative risk study from this tenant. Cancel if you only need to remove it from active review."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setDeleteModalOpen(false)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={busy} onClick={() => void deleteStudy()} type="button">
              {busy ? 'Deleting...' : 'Delete study'}
            </button>
          </div>
        }
        onOpenChange={setDeleteModalOpen}
        open={deleteModalOpen}
        title="Delete quantitative study"
      >
        <div className="rounded-md border border-[#f2b7bf] bg-[#fff4f5] p-4 text-sm leading-6 text-[#9d1f2c]">
          {study.name} and its portfolio model will be removed. This action cannot be undone.
        </div>
      </RegModal>
    </div>
  );
}
