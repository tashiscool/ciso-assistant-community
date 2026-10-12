import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  RegActionMenu,
  RegModal,
  RegRightDrawer,
  RegStatusPill,
} from '../../components/regovise/PagePrimitives';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { PortalAssignment, PortalRequirement } from './types';

const client = new ApiClient();

type PillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'n/a';
}

function resultTone(value: string | null | undefined): PillTone {
  const normalized = (value ?? '').toLowerCase();
  if (['compliant', 'accepted', 'complete'].includes(normalized)) {
    return 'success';
  }
  if (['partially_compliant', 'not_assessed', 'pending'].includes(normalized)) {
    return 'warning';
  }
  if (['non_compliant', 'rejected', 'failed'].includes(normalized)) {
    return 'danger';
  }
  return 'neutral';
}

export function PortalAssignmentDetailPage() {
  const { identity } = useEdgeIdentity();
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [assignment, setAssignment] = useState<PortalAssignment | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PortalRequirement>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingSubmitReview, setPendingSubmitReview] = useState(false);
  const [pendingRequirementSaveId, setPendingRequirementSaveId] = useState<string | null>(null);
  const [inspectedRequirementId, setInspectedRequirementId] = useState<string | null>(null);

  async function loadAssignment() {
    if (!assignmentId) {
      setError('Portal assignment id is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{ data: PortalAssignment }>(`/ops/portal/assignments/${assignmentId}`);
      setAssignment(response.data);
      setDrafts(
        Object.fromEntries(response.data.requirements.map((item) => [item.id, item])),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAssignment();
  }, [identity.tenantId, identity.userId, assignmentId]);

  async function saveRequirement(requirementId: string) {
    if (!assignmentId) {
      return;
    }

    try {
      setBusyId(requirementId);
      setError(null);
      setNotice(null);
      await client.post(`/ops/portal/assignments/${assignmentId}/requirements/${requirementId}`, drafts[requirementId]);
      setNotice('Requirement response saved.');
      await loadAssignment();
      setPendingRequirementSaveId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyId(null);
    }
  }

  async function submitAssignment() {
    if (!assignmentId) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setNotice(null);
      await client.post(`/ops/portal/assignments/${assignmentId}/submit`);
      setNotice('Assignment submitted for review.');
      setPendingSubmitReview(false);
      await loadAssignment();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading portal assignment...</div>;
  }

  if (!assignment) {
    return <div className="notice-error">Portal assignment not found for tenant {identity.tenantId}.</div>;
  }

  const isReadOnly = assignment.status === 'submitted' || assignment.status === 'closed';
  const inspectedRequirement = assignment.requirements.find((item) => item.id === inspectedRequirementId) ?? null;
  const inspectedDraft = inspectedRequirement
    ? drafts[inspectedRequirement.id] ?? inspectedRequirement
    : null;
  const pendingRequirementSave = assignment.requirements.find((item) => item.id === pendingRequirementSaveId) ?? null;
  const pendingRequirementDraft = pendingRequirementSave
    ? drafts[pendingRequirementSave.id] ?? pendingRequirementSave
    : null;

  return (
    <div className="min-w-0 space-y-6">
      <section className="panel grid min-w-0 gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
        <div className="min-w-0">
          <Link className="text-sm text-[#6d28d9] transition hover:text-[#5f1aa8]" to="/portal">
            Back to portal
          </Link>
          <div className="eyebrow mt-4">Assignment</div>
          <h1 className="mt-2 break-words text-3xl font-semibold text-[#241232]">{assignment.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
            {assignment.observation || 'Complete the remaining requirement responses and submit the pack for review.'}
          </p>
        </div>
        <div className="panel-subtle grid gap-3 sm:grid-cols-2">
          <div className="metric-card">
            <div className="metric-label">Framework</div>
            <div className="mt-3 text-sm font-semibold text-[#241232]">{assignment.frameworkName ?? 'n/a'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Status</div>
            <div className="mt-3 text-sm font-semibold capitalize text-[#241232]">{assignment.status.replace(/_/g, ' ')}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Progress</div>
            <div className="metric-value">{assignment.progressPercent}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Due</div>
            <div className="mt-3 text-sm font-semibold text-[#241232]">{formatDate(assignment.dueDate)}</div>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid min-w-0 gap-6 2xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-4">
          {assignment.requirements.map((requirement) => {
            const draft = drafts[requirement.id] ?? requirement;
            return (
              <section key={requirement.id} className="panel">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="eyebrow">{requirement.ref}</div>
                    <h2 className="mt-2 break-words text-xl font-semibold text-[#241232]">{requirement.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-[#4f435c]">{requirement.question}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RegStatusPill className="capitalize" tone={resultTone(draft.result)}>
                      {draft.result.replace(/_/g, ' ')}
                    </RegStatusPill>
                    <RegActionMenu
                      label={`Open actions for ${requirement.title}`}
                      actions={[
                        {
                          label: 'Inspect response',
                          onSelect: () => setInspectedRequirementId(requirement.id),
                        },
                        {
                          label: 'Review save',
                          disabled: isReadOnly,
                          onSelect: () => setPendingRequirementSaveId(requirement.id),
                        },
                      ]}
                    />
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  <label className="space-y-1">
                    <span className="label">Result</span>
                    <select
                      className="input"
                      disabled={isReadOnly}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [requirement.id]: {
                            ...draft,
                            result: event.target.value,
                          },
                        }))
                      }
                      value={draft.result}
                    >
                      <option value="not_assessed">Not assessed</option>
                      <option value="non_compliant">Non compliant</option>
                      <option value="partially_compliant">Partially compliant</option>
                      <option value="compliant">Compliant</option>
                      <option value="not_applicable">Not applicable</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="label">Response</span>
                    <textarea
                      className="input min-h-[110px]"
                      disabled={isReadOnly}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [requirement.id]: {
                            ...draft,
                            response: event.target.value,
                          },
                        }))
                      }
                      value={draft.response ?? ''}
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="label">Observation</span>
                      <input
                        className="input"
                        disabled={isReadOnly}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [requirement.id]: {
                              ...draft,
                              observation: event.target.value,
                            },
                          }))
                        }
                        value={draft.observation ?? ''}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="label">Evidence note</span>
                      <input
                        className="input"
                        disabled={isReadOnly}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [requirement.id]: {
                              ...draft,
                              evidenceNote: event.target.value,
                            },
                          }))
                        }
                        value={draft.evidenceNote ?? ''}
                      />
                    </label>
                  </div>
                  {!isReadOnly && (
                    <button
                      className="button-secondary"
                      disabled={busyId === requirement.id}
                      onClick={() => setPendingRequirementSaveId(requirement.id)}
                      type="button"
                    >
                      {busyId === requirement.id ? 'Saving...' : 'Review Save'}
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </section>

        <section className="space-y-6">
          <section className="panel">
            <div className="eyebrow">Submission</div>
            <div className="mt-4 text-sm leading-6 text-[#4f435c]">
              Reviewed responses: {assignment.assessedRequirements} of {assignment.totalRequirements}
            </div>
            {!isReadOnly && (
              <button className="button-primary mt-4" disabled={submitting} onClick={() => setPendingSubmitReview(true)} type="button">
                {submitting ? 'Submitting...' : 'Submit for Review'}
              </button>
            )}
            {isReadOnly && (
              <div className="mt-4 text-sm text-[#6f6578]">
                This assignment is already in a read-only review state.
              </div>
            )}
          </section>

          <section className="panel">
            <div className="eyebrow">History</div>
            <div className="mt-4 space-y-3">
              {assignment.events.map((event) => (
                <div key={event.id} className="panel-subtle">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-[#241232]">{event.eventType.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-[#62576a]">{formatDate(event.createdAt)}</div>
                  </div>
                  <div className="mt-2 text-sm text-[#4f435c]">{event.actorName}</div>
                  {event.note && <div className="mt-1 text-sm text-[#6f6578]">{event.note}</div>}
                </div>
              ))}
            </div>
          </section>
        </section>
      </section>
      <RegModal
        open={pendingSubmitReview}
        onOpenChange={setPendingSubmitReview}
        title="Submit portal assignment"
        description="Review this external response pack before sending it to the internal review queue."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" disabled={submitting} onClick={() => setPendingSubmitReview(false)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={submitting} onClick={() => void submitAssignment()} type="button">
              {submitting ? 'Submitting...' : 'Submit assignment'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-sm leading-6 text-[#4f435c]">
          <p>
            Submitting moves the portal assignment into a read-only review state. Reviewers can still reopen the work
            if changes are required.
          </p>
          <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
            <div className="font-semibold text-[#241232]">{assignment.name}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="status-pill-neutral capitalize">{assignment.status.replace(/_/g, ' ')}</span>
              <span className="status-pill-neutral">{assignment.frameworkName ?? 'No framework'}</span>
              <span className="status-pill-neutral">{assignment.progressPercent}% complete</span>
              <span className="status-pill-neutral">
                {assignment.assessedRequirements}/{assignment.totalRequirements} reviewed
              </span>
              <span className="status-pill-neutral">Due {formatDate(assignment.dueDate)}</span>
            </div>
          </div>
        </div>
      </RegModal>
      <RegRightDrawer
        open={Boolean(inspectedRequirement)}
        onOpenChange={(open) => {
          if (!open) {
            setInspectedRequirementId(null);
          }
        }}
        title={inspectedRequirement?.title ?? 'Requirement response'}
        description={inspectedRequirement?.question}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setInspectedRequirementId(null)} type="button">
              Close
            </button>
            {!isReadOnly && inspectedRequirement ? (
              <button
                className="button-primary"
                onClick={() => {
                  setPendingRequirementSaveId(inspectedRequirement.id);
                  setInspectedRequirementId(null);
                }}
                type="button"
              >
                Review save
              </button>
            ) : null}
          </div>
        }
      >
        {inspectedRequirement && inspectedDraft ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <RegStatusPill tone="neutral">{inspectedRequirement.ref}</RegStatusPill>
              <RegStatusPill className="capitalize" tone={resultTone(inspectedDraft.result)}>
                {inspectedDraft.result.replace(/_/g, ' ')}
              </RegStatusPill>
              <RegStatusPill tone={inspectedRequirement.assessable ? 'info' : 'neutral'}>
                {inspectedRequirement.assessable ? 'Assessable' : 'Informational'}
              </RegStatusPill>
            </div>
            <section className="panel-subtle">
              <div className="label">Response</div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#4f435c]">
                {inspectedDraft.response?.trim() || 'No response provided yet.'}
              </p>
            </section>
            <section className="panel-subtle">
              <div className="label">Observation</div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#4f435c]">
                {inspectedDraft.observation?.trim() || 'No observation recorded.'}
              </p>
            </section>
            <section className="panel-subtle">
              <div className="label">Evidence note</div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#4f435c]">
                {inspectedDraft.evidenceNote?.trim() || 'No evidence note recorded.'}
              </p>
            </section>
          </div>
        ) : null}
      </RegRightDrawer>
      <RegModal
        open={Boolean(pendingRequirementSave)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRequirementSaveId(null);
          }
        }}
        title="Save requirement response"
        description="Review this portal response before updating the assignment."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="button-secondary"
              disabled={Boolean(pendingRequirementSave && busyId === pendingRequirementSave.id)}
              onClick={() => setPendingRequirementSaveId(null)}
              type="button"
            >
              Cancel
            </button>
            {pendingRequirementSave ? (
              <button
                className="button-primary"
                disabled={busyId === pendingRequirementSave.id}
                onClick={() => void saveRequirement(pendingRequirementSave.id)}
                type="button"
              >
                {busyId === pendingRequirementSave.id ? 'Saving...' : 'Save response'}
              </button>
            ) : null}
          </div>
        }
      >
        {pendingRequirementSave && pendingRequirementDraft ? (
          <div className="space-y-4 text-sm leading-6 text-[#4f435c]">
            <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="eyebrow">{pendingRequirementSave.ref}</div>
              <div className="mt-2 break-words font-semibold text-[#241232]">{pendingRequirementSave.title}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <RegStatusPill className="capitalize" tone={resultTone(pendingRequirementDraft.result)}>
                  {pendingRequirementDraft.result.replace(/_/g, ' ')}
                </RegStatusPill>
                <RegStatusPill tone={pendingRequirementSave.assessable ? 'info' : 'neutral'}>
                  {pendingRequirementSave.assessable ? 'Assessable' : 'Informational'}
                </RegStatusPill>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <section className="panel-subtle">
                <div className="label">Response</div>
                <p className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words">
                  {pendingRequirementDraft.response?.trim() || 'No response provided yet.'}
                </p>
              </section>
              <section className="panel-subtle">
                <div className="label">Evidence note</div>
                <p className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words">
                  {pendingRequirementDraft.evidenceNote?.trim() || 'No evidence note recorded.'}
                </p>
              </section>
            </div>
            <section className="panel-subtle">
              <div className="label">Observation</div>
              <p className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words">
                {pendingRequirementDraft.observation?.trim() || 'No observation recorded.'}
              </p>
            </section>
          </div>
        ) : null}
      </RegModal>
    </div>
  );
}
