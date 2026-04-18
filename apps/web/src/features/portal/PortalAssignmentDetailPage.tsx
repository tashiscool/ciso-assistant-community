import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { PortalAssignment, PortalRequirement } from './types';

const client = new ApiClient();

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'n/a';
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
      await loadAssignment();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading portal assignment...</div>;
  }

  if (!assignment) {
    return <div className="notice-error">Portal assignment not found for tenant {identity.tenantId}.</div>;
  }

  const isReadOnly = assignment.status === 'submitted' || assignment.status === 'closed';

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <Link className="text-sm text-cyan-200 transition hover:text-cyan-100" to="/portal">
            Back to portal
          </Link>
          <div className="eyebrow mt-4">Assignment</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">{assignment.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            {assignment.observation || 'Complete the remaining requirement responses and submit the pack for review.'}
          </p>
        </div>
        <div className="panel-subtle grid gap-3 sm:grid-cols-2">
          <div className="metric-card">
            <div className="metric-label">Framework</div>
            <div className="mt-3 text-sm font-semibold text-white">{assignment.frameworkName ?? 'n/a'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Status</div>
            <div className="mt-3 text-sm font-semibold capitalize text-white">{assignment.status.replace(/_/g, ' ')}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Progress</div>
            <div className="metric-value">{assignment.progressPercent}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Due</div>
            <div className="mt-3 text-sm font-semibold text-white">{formatDate(assignment.dueDate)}</div>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-4">
          {assignment.requirements.map((requirement) => {
            const draft = drafts[requirement.id] ?? requirement;
            return (
              <section key={requirement.id} className="panel">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="eyebrow">{requirement.ref}</div>
                    <h2 className="mt-2 text-xl font-semibold text-white">{requirement.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{requirement.question}</p>
                  </div>
                  <span className="badge-neutral">{draft.result}</span>
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
                      onClick={() => void saveRequirement(requirement.id)}
                      type="button"
                    >
                      {busyId === requirement.id ? 'Saving...' : 'Save Response'}
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
            <div className="mt-4 text-sm leading-6 text-slate-300">
              Reviewed responses: {assignment.assessedRequirements} of {assignment.totalRequirements}
            </div>
            {!isReadOnly && (
              <button className="button-primary mt-4" disabled={submitting} onClick={() => void submitAssignment()} type="button">
                {submitting ? 'Submitting...' : 'Submit for Review'}
              </button>
            )}
            {isReadOnly && (
              <div className="mt-4 text-sm text-slate-400">
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
                    <div className="font-medium text-white">{event.eventType.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-slate-500">{formatDate(event.createdAt)}</div>
                  </div>
                  <div className="mt-2 text-sm text-slate-300">{event.actorName}</div>
                  {event.note && <div className="mt-1 text-sm text-slate-400">{event.note}</div>}
                </div>
              ))}
            </div>
          </section>
        </section>
      </section>
    </div>
  );
}
