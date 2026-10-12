import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  RegActionMenu,
  RegModal,
  RegRightDrawer,
  RegStatusPill,
} from '../../components/regovise/PagePrimitives';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { EbiosStudy, EbiosWorkshopStep } from './types';

const client = new ApiClient();

type EbiosEditForm = {
  name: string;
  description: string;
  status: string;
  quotationMethod: string;
  observation: string;
  version: string;
};

function buildEditForm(study: EbiosStudy): EbiosEditForm {
  return {
    name: study.name,
    description: study.description ?? '',
    status: study.status,
    quotationMethod: study.quotationMethod,
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

export function EbiosStudyDetailPage() {
  const { identity } = useEdgeIdentity();
  const navigate = useNavigate();
  const { studyId } = useParams<{ studyId: string }>();
  const [study, setStudy] = useState<EbiosStudy | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<EbiosEditForm>({
    name: '',
    description: '',
    status: 'planned',
    quotationMethod: 'express',
    observation: '',
    version: '1.0',
  });

  async function loadStudy() {
    if (!studyId) {
      setError('EBIOS study id is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{ data: EbiosStudy }>(`/ops/ebios-studies/${studyId}`);
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

    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      const response = await client.put<{ data: EbiosStudy }>(`/ops/ebios-studies/${study.id}`, editForm);
      setStudy(response.data);
      setEditForm(buildEditForm(response.data));
      setEditDrawerOpen(false);
      setNotice('EBIOS RM study details updated.');
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
      await client.delete(`/ops/ebios-studies/${study.id}`);
      setDeleteModalOpen(false);
      navigate('/advanced-risk/ebios');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  async function updateStep(workshopId: string, step: EbiosWorkshopStep, status: EbiosWorkshopStep['status']) {
    if (!studyId) {
      return;
    }

    try {
      setBusyId(step.id);
      setError(null);
      await client.post(`/ops/ebios-studies/${studyId}/workshops/${workshopId}/${step.id}`, {
        status,
      });
      await loadStudy();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading EBIOS study...</div>;
  }

  if (!study) {
    return <div className="notice-error">EBIOS study not found for tenant {identity.tenantId}.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <Link className="text-sm text-[#6d28d9] transition hover:text-[#5f1aa8]" to="/advanced-risk/ebios">
                Back to EBIOS workspace
              </Link>
              <div className="eyebrow mt-4">{study.refId ?? 'EBIOS RM'}</div>
              <h1 className="mt-2 text-3xl font-semibold text-[#241232]">{study.name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
                {study.description || 'No EBIOS RM study description provided.'}
              </p>
            </div>
            <RegActionMenu
              actions={[
                { label: 'Review study snapshot', onSelect: () => setReviewDrawerOpen(true) },
                { label: 'Edit study details', onSelect: openEditDrawer },
                { label: 'Delete study', destructive: true, onSelect: () => setDeleteModalOpen(true) },
              ]}
              label="Open EBIOS study actions"
            />
          </div>
        </div>
        <div className="panel-subtle grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
          <div className="metric-card">
            <div className="metric-label">Perimeter</div>
            <div className="mt-3 text-sm font-semibold text-[#241232]">{study.perimeterName ?? 'n/a'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Reference entity</div>
            <div className="mt-3 text-sm font-semibold text-[#241232]">{study.referenceEntityName ?? 'n/a'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Status</div>
            <div className="mt-3 text-sm font-semibold capitalize text-[#241232]">{study.status.replace(/_/g, ' ')}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Workshop progress</div>
            <div className="metric-value">{study.metrics.workshopProgress}%</div>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="space-y-4">
          {study.workshops.map((workshop) => (
            <section key={workshop.id} className="panel">
              <div className="eyebrow">{workshop.label}</div>
              <div className="mt-4 space-y-3">
                {workshop.steps.map((step) => (
                  <div key={step.id} className="panel-subtle flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-medium text-[#241232]">{step.label}</div>
                      <div className="mt-1 text-xs text-[#62576a]">{step.status.replace(/_/g, ' ')}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(['to_do', 'in_progress', 'done'] as const).map((status) => (
                        <button
                          key={status}
                          className={status === step.status ? 'button-primary' : 'button-secondary'}
                          disabled={busyId === step.id}
                          onClick={() => void updateStep(workshop.id, step, status)}
                          type="button"
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </section>

        <section className="space-y-6">
          <section className="panel">
            <div className="eyebrow">Feared Events</div>
            <div className="mt-4 space-y-3">
              {study.fearedEvents.map((item) => (
                <div key={item.id} className="panel-subtle">
                  <div className="font-medium text-[#241232]">{item.name}</div>
                  <div className="mt-2 text-sm text-[#4f435c]">Gravity: {item.gravity}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.assets.map((asset) => (
                      <RegStatusPill key={asset} tone="neutral">
                        {asset}
                      </RegStatusPill>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="eyebrow">Stakeholders and Scenarios</div>
            <div className="mt-4 space-y-3">
              {study.stakeholders.map((stakeholder) => (
                <div key={stakeholder.id} className="panel-subtle">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="font-medium text-[#241232]">{stakeholder.name}</div>
                    <RegStatusPill tone="neutral" className="shrink-0">
                      {stakeholder.category}
                    </RegStatusPill>
                  </div>
                  <div className="mt-2 text-sm text-[#4f435c]">Dependency rating: {stakeholder.dependency}</div>
                </div>
              ))}
              {study.strategicScenarios.map((scenario) => (
                <div key={scenario.id} className="panel-subtle">
                  <div className="font-medium text-[#241232]">{scenario.name}</div>
                  <div className="mt-2 text-sm text-[#4f435c]">
                    Attacker: {scenario.attacker} · Priority: {scenario.priority}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      </section>

      <RegRightDrawer
        description="Review the study metadata, mappings, and workshop health without changing the record."
        footer={
          <div className="flex justify-end">
            <button className="button-secondary" onClick={() => setReviewDrawerOpen(false)} type="button">
              Close
            </button>
          </div>
        }
        onOpenChange={setReviewDrawerOpen}
        open={reviewDrawerOpen}
        title="EBIOS study snapshot"
      >
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StudyField label="Name" value={study.name} />
          <StudyField label="Reference" value={study.refId ?? 'EBIOS RM'} />
          <StudyField label="Domain" value={study.folderName} />
          <StudyField label="Perimeter" value={study.perimeterName} />
          <StudyField label="Reference entity" value={study.referenceEntityName} />
          <StudyField label="Status" value={study.status.replace(/_/g, ' ')} />
          <StudyField label="Quotation method" value={study.quotationMethod} />
          <StudyField label="Version" value={study.version} />
          <StudyField label="Feared events" value={study.metrics.fearedEvents} />
          <StudyField label="Stakeholders" value={study.metrics.stakeholders} />
          <StudyField label="Strategic scenarios" value={study.metrics.strategicScenarios} />
          <StudyField label="Operational scenarios" value={study.metrics.operationalScenarios} />
        </dl>
        <div className="mt-4 rounded-md border border-[#ded8e4] bg-[#f8f5fb] p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#62576a]">Observation</div>
          <p className="mt-2 text-sm leading-6 text-[#4f435c]">
            {study.observation || 'No study observation has been recorded.'}
          </p>
        </div>
      </RegRightDrawer>

      <RegRightDrawer
        description="Update the editable EBIOS RM study fields. Core folder, perimeter, and third-party mappings stay preserved."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setEditDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={busy} form="ebios-edit-study" type="submit">
              {busy ? 'Saving...' : 'Save study'}
            </button>
          </div>
        }
        onOpenChange={setEditDrawerOpen}
        open={editDrawerOpen}
        title="Edit EBIOS study"
      >
        <form
          className="space-y-4"
          id="ebios-edit-study"
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
              <span className="label">Quotation method</span>
              <select
                className="input"
                onChange={(event) => setEditForm((current) => ({ ...current, quotationMethod: event.target.value }))}
                value={editForm.quotationMethod}
              >
                <option value="express">Express</option>
                <option value="standard">Standard</option>
                <option value="detailed">Detailed</option>
              </select>
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
        description="This permanently removes the EBIOS RM study from this tenant. Cancel if you only need to keep it out of day-to-day review."
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
        title="Delete EBIOS study"
      >
        <div className="rounded-md border border-[#f2b7bf] bg-[#fff4f5] p-4 text-sm leading-6 text-[#9d1f2c]">
          {study.name} and its workshop state will be removed. This action cannot be undone.
        </div>
      </RegModal>
    </div>
  );
}
