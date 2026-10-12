import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Eye, XCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { explainAssurance, listPendingReviews, listReviewHistory, recordReviewDecision } from './api';
import { AssuranceExplainPanel } from './AssuranceExplainPanel';
import { AssuranceWorkflowPanel } from './AssuranceWorkflowPanel';
import { CoachMarksPanel } from '../../components/CoachMarksPanel';
import { RegActionMenu, RegModal, RegRightDrawer, RegStatusPill } from '../../components/regovise/PagePrimitives';
import type { AssuranceExplainAudience, ReviewDecision, ReviewRecommendation } from './types';
import { useEdgeIdentity } from '../../shared/session/identity';

type ReviewQueueDecision = 'accepted' | 'rejected';

const reviewDecisionLabels: Record<ReviewQueueDecision, string> = {
  accepted: 'Accept',
  rejected: 'Reject',
};

const reviewDecisionDescriptions: Record<ReviewQueueDecision, string> = {
  accepted: 'Accept this recommendation, preserve the reviewer note, and refresh any downstream assurance package artifacts linked to it.',
  rejected: 'Reject this recommendation and preserve the reviewer note as the decision rationale for future audits.',
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString();
}

function humanizeKey(value: string | null | undefined) {
  if (!value) {
    return '—';
  }
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function isExplainAudience(value: string | null): value is AssuranceExplainAudience {
  return value === 'remediation' || value === 'derivation';
}

export function ReviewQueuePage() {
  const { identity } = useEdgeIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pending, setPending] = useState<ReviewRecommendation[]>([]);
  const [history, setHistory] = useState<ReviewDecision[]>([]);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState('');
  const [selectedDecisionId, setSelectedDecisionId] = useState('');
  const [lastRefreshedPackageIds, setLastRefreshedPackageIds] = useState<string[]>([]);
  const [lastRefreshRecommendationId, setLastRefreshRecommendationId] = useState('');
  const [justification, setJustification] = useState('Accepted after assurance review.');
  const [inspectedRecommendation, setInspectedRecommendation] = useState<ReviewRecommendation | null>(null);
  const [decisionToReview, setDecisionToReview] = useState<ReviewQueueDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyDecision, setBusyDecision] = useState<ReviewQueueDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestedRecommendationId = searchParams.get('recommendationId') ?? '';
  const requestedDecisionId = searchParams.get('decisionId') ?? '';
  const requestedEvidenceJobId = searchParams.get('evidenceJobId') ?? '';
  const requestedFocusId = searchParams.get('focusId') ?? '';
  const requestedAudience = searchParams.get('audience');

  function updateSearchState(updates: {
    recommendationId?: string | null;
    decisionId?: string | null;
    evidenceJobId?: string | null;
    focusId?: string | null;
    audience?: AssuranceExplainAudience | null;
  }) {
    const next = new URLSearchParams(searchParams);
    const entries = [
      ['recommendationId', updates.recommendationId],
      ['decisionId', updates.decisionId],
      ['evidenceJobId', updates.evidenceJobId],
      ['focusId', updates.focusId],
      ['audience', updates.audience],
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

  async function loadQueue() {
    try {
      setLoading(true);
      setError(null);
      const [pendingItems, historyItems] = await Promise.all([
        listPendingReviews(),
        listReviewHistory(requestedEvidenceJobId || undefined),
      ]);
      setPending(pendingItems);
      setHistory(historyItems);
      setSelectedRecommendationId((current) => {
        if (requestedRecommendationId && pendingItems.some((item) => item.id === requestedRecommendationId)) {
          return requestedRecommendationId;
        }
        if (current && pendingItems.some((item) => item.id === current)) {
          return current;
        }
        return pendingItems[0]?.id || '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the review queue.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue();
  }, [identity.tenantId, identity.userId, requestedEvidenceJobId, requestedRecommendationId]);

  useEffect(() => {
    if (!requestedRecommendationId || requestedRecommendationId === selectedRecommendationId) {
      return;
    }
    if (pending.some((item) => item.id === requestedRecommendationId)) {
      setSelectedRecommendationId(requestedRecommendationId);
    }
  }, [pending, requestedRecommendationId, selectedRecommendationId]);

  const selectedRecommendation = useMemo(
    () => pending.find((item) => item.id === selectedRecommendationId) ?? null,
    [pending, selectedRecommendationId],
  );

  useEffect(() => {
    setSelectedDecisionId((current) => {
      if (requestedDecisionId && history.some((item) => item.id === requestedDecisionId)) {
        return requestedDecisionId;
      }
      if (current && history.some((item) => item.id === current)) {
        return current;
      }
      return history[0]?.id || '';
    });
  }, [history, requestedDecisionId]);

  const selectedDecision = useMemo(
    () => history.find((item) => item.id === selectedDecisionId) ?? null,
    [history, selectedDecisionId],
  );

  useEffect(() => {
    const currentRecommendationId = searchParams.get('recommendationId') ?? '';
    const currentDecisionId = searchParams.get('decisionId') ?? '';
    const currentEvidenceJobId = searchParams.get('evidenceJobId') ?? '';
    const nextEvidenceJobId =
      selectedRecommendation?.evidenceJobId ??
      selectedDecision?.evidenceJobId ??
      requestedEvidenceJobId;
    if (
      currentRecommendationId === selectedRecommendationId &&
      currentDecisionId === selectedDecisionId &&
      currentEvidenceJobId === (nextEvidenceJobId ?? '')
    ) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (selectedRecommendationId) {
      next.set('recommendationId', selectedRecommendationId);
    } else {
      next.delete('recommendationId');
    }
    if (selectedDecisionId) {
      next.set('decisionId', selectedDecisionId);
    } else {
      next.delete('decisionId');
    }
    if (nextEvidenceJobId) {
      next.set('evidenceJobId', nextEvidenceJobId);
    } else {
      next.delete('evidenceJobId');
    }
    setSearchParams(next, { replace: true });
  }, [requestedEvidenceJobId, searchParams, selectedDecision?.evidenceJobId, selectedDecisionId, selectedRecommendation?.evidenceJobId, selectedRecommendationId, setSearchParams]);

  const explanationFocusOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    if (selectedRecommendation) {
      options.push({
        value: selectedRecommendation.id,
        label: `Recommendation · ${selectedRecommendation.title}`,
      });
    }
    if (selectedDecision) {
      options.push({
        value: selectedDecision.id,
        label: `Decision · ${humanizeKey(selectedDecision.decision)} · ${selectedDecision.recommendationTitle ?? selectedDecision.recommendationId}`,
      });
    }
    return options;
  }, [selectedDecision, selectedRecommendation]);
  const coachMarkItems = [
    {
      id: 'review-recommendations',
      eyebrow: 'Recommendations',
      title: 'This queue is where deterministic findings meet human judgment',
      body: 'The purpose of this page is not just to click approve or reject, but to capture why a person accepted or overruled the recommendation.',
      tone: 'focus' as const,
    },
    {
      id: 'review-lineage',
      eyebrow: 'Lineage',
      title: 'A good decision should stay close to the evidence',
      body: 'Use the evidence and package links here to verify that the recommendation really came from the record you think it did.',
      route: selectedRecommendation?.evidenceJobId ? `/assurance/evidence?evidenceJobId=${encodeURIComponent(selectedRecommendation.evidenceJobId)}` : '/assurance/evidence',
      ctaLabel: 'Open evidence explorer',
    },
    {
      id: 'review-history',
      eyebrow: 'History',
      title: 'Decision history is part of the output',
      body: 'The history panel is meant to explain how the human review posture evolved, not just archive old clicks.',
    },
    {
      id: 'review-packages',
      eyebrow: 'Propagation',
      title: 'Accepted decisions should refresh downstream packages',
      body: 'Use the refreshed package links after a decision to verify that the shareable output now reflects the human review outcome.',
      route: lastRefreshedPackageIds[0] ? `/assurance/packages?packageId=${encodeURIComponent(lastRefreshedPackageIds[0])}` : '/assurance/packages',
      ctaLabel: 'Open packages',
    },
  ];

  function evidenceRefsForRecommendation(item: ReviewRecommendation) {
    return [String(item.recommendation.recommendedArtifact ?? '')].filter(Boolean);
  }

  function controlRefsForRecommendation(item: ReviewRecommendation) {
    return Array.isArray(item.recommendation.controlRefs)
      ? (item.recommendation.controlRefs as string[])
      : [];
  }

  async function handleDecision(decision: ReviewQueueDecision) {
    if (!selectedRecommendation) {
      return false;
    }
    try {
      setBusyDecision(decision);
      setError(null);
      setNotice(null);
      const result = await recordReviewDecision({
        recommendationId: selectedRecommendation.id,
        decision,
        justification,
        evidenceRefs: evidenceRefsForRecommendation(selectedRecommendation),
        controlRefs: controlRefsForRecommendation(selectedRecommendation),
      });
      setLastRefreshedPackageIds(result.refreshedPackageIds ?? []);
      setLastRefreshRecommendationId(selectedRecommendation.id);
      setSelectedDecisionId(result.id);
      await loadQueue();
      setJustification(decision === 'accepted' ? 'Accepted after assurance review.' : 'Rejected after assurance review.');
      setNotice(
        `Recommendation ${selectedRecommendation.id} marked ${decision}.` +
          (result.refreshedPackageCount
            ? ` Refreshed ${result.refreshedPackageCount} package artifact set(s).`
            : '') +
          (result.packageRefreshError ? ` Package refresh deferred: ${result.packageRefreshError}` : ''),
      );
      setDecisionToReview(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record the review decision.');
      return false;
    } finally {
      setBusyDecision(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Assurance</div>
        <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Review Queue</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#51465e]">
          Review deterministic recommendations, capture human decisions, and keep an immutable decision history close to the evidence bundle.
        </p>
      </section>

      <CoachMarksPanel
        storageKey="assurance-review-queue"
        title="Use Review Queue to make explicit human decisions, not silent overrides."
        description="This is the human governance layer of assurance. Good decisions here should be justified, linked to evidence, and reflected downstream in the package record."
        items={coachMarkItems}
      />

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}
      {requestedEvidenceJobId && (
        <div className="panel-subtle flex flex-wrap items-center justify-between gap-3 text-sm text-[#51465e]">
          <div>
            Decision history is filtered to evidence job <span className="font-mono text-[#6d28d9]">{requestedEvidenceJobId}</span>.
          </div>
          <Link className="button-secondary" to="/assurance/reviews">
            Clear filter
          </Link>
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <section className="space-y-3">
          <div className="panel">
            <div className="flex items-center justify-between">
              <div>
                <div className="label">Pending recommendations</div>
                <div className="mt-1 text-sm text-[#6f6578]">Only recommendations within your accessible domains are shown here.</div>
              </div>
              <button className="button-secondary" onClick={() => void loadQueue()} type="button">
                Refresh
              </button>
            </div>
          </div>

          {pending.map((item) => (
            <button
              key={item.id}
              className={`panel w-full text-left transition ${selectedRecommendationId === item.id ? 'border-[#d7c3f1] bg-[#f3e9ff]' : ''}`}
              onClick={() => {
                setSelectedRecommendationId(item.id);
                updateSearchState({
                  recommendationId: item.id,
                  evidenceJobId: item.evidenceJobId ?? null,
                  focusId: item.id,
                });
              }}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="eyebrow">{item.targetType}</div>
                  <h2 className="mt-2 text-lg font-semibold text-[#241232]">{item.title}</h2>
                  <div className="mt-2 font-mono text-xs text-[#6d28d9]">{item.id}</div>
                </div>
                <RegStatusPill tone="neutral">{String(item.recommendation.severity ?? item.status)}</RegStatusPill>
              </div>
              <div className="mt-3 text-sm leading-6 text-[#6f6578]">{item.summary}</div>
            </button>
          ))}

          {!loading && pending.length === 0 && (
            <div className="panel text-sm text-[#6f6578]">No pending review recommendations are waiting for your scope.</div>
          )}
          {loading && <div className="panel text-sm text-[#6f6578]">Loading review queue...</div>}
        </section>

        <section className="space-y-4">
              {selectedRecommendation ? (
            <>
              <section className="panel">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="label">Selected recommendation</div>
                    <h2 className="mt-2 text-2xl font-semibold text-[#241232]">{selectedRecommendation.title}</h2>
                  </div>
                  <RegActionMenu
                    actions={[
                      {
                        label: 'Inspect recommendation',
                        icon: Eye,
                        onSelect: () => setInspectedRecommendation(selectedRecommendation),
                      },
                      ...(selectedRecommendation.evidenceJobId
                        ? [
                            {
                              label: 'Open evidence bundle',
                              icon: ExternalLink,
                              to: `/assurance/evidence?evidenceJobId=${encodeURIComponent(selectedRecommendation.evidenceJobId)}`,
                            },
                          ]
                        : []),
                      {
                        label: 'Accept',
                        icon: CheckCircle2,
                        disabled: busyDecision !== null,
                        onSelect: () => {
                          setJustification((current) => current || 'Accepted after assurance review.');
                          setDecisionToReview('accepted');
                        },
                      },
                      {
                        label: 'Reject',
                        icon: XCircle,
                        disabled: busyDecision !== null,
                        destructive: true,
                        onSelect: () => {
                          setJustification((current) => current || 'Rejected after assurance review.');
                          setDecisionToReview('rejected');
                        },
                      },
                    ]}
                    label="Open selected recommendation actions"
                  />
                </div>
                <div className="mt-2 font-mono text-xs text-[#6d28d9]">{selectedRecommendation.id}</div>
                <p className="mt-4 text-sm leading-6 text-[#51465e]">{selectedRecommendation.summary}</p>
                <div className="mt-4 grid gap-3 text-sm text-[#6f6578] sm:grid-cols-2">
                  <div>Target type: {selectedRecommendation.targetType}</div>
                  <div>Target id: {selectedRecommendation.targetId}</div>
                  <div>Severity: {String(selectedRecommendation.recommendation.severity ?? 'unknown')}</div>
                  <div>Recommended artifact: {String(selectedRecommendation.recommendation.recommendedArtifact ?? '—')}</div>
                </div>
                <label className="mt-4 block space-y-1">
                  <span className="label">Justification</span>
                  <textarea
                    className="input min-h-[140px]"
                    onChange={(event) => setJustification(event.target.value)}
                    value={justification}
                  />
                </label>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="button-secondary" onClick={() => setInspectedRecommendation(selectedRecommendation)} type="button">
                    Inspect recommendation
                  </button>
                  <button
                    className="button-primary"
                    disabled={busyDecision !== null}
                    onClick={() => {
                      setJustification((current) => current || 'Accepted after assurance review.');
                      setDecisionToReview('accepted');
                    }}
                    type="button"
                  >
                    Review decision
                  </button>
                  {lastRefreshedPackageIds.length > 0 && lastRefreshRecommendationId === selectedRecommendation.id && (
                    <Link
                      className="button-secondary"
                      to={`/assurance/packages?packageId=${encodeURIComponent(lastRefreshedPackageIds[0] ?? '')}`}
                    >
                      Open refreshed package
                    </Link>
                  )}
                </div>
                {lastRefreshedPackageIds.length > 0 && lastRefreshRecommendationId === selectedRecommendation.id && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {lastRefreshedPackageIds.map((packageId) => (
                      <Link
                        key={packageId}
                        className="rounded-full border border-[#d7c3f1] bg-[#f2e8ff] px-3 py-1 font-mono text-xs text-[#6d28d9] transition hover:border-[#8b35e6]/30"
                        to={`/assurance/packages?packageId=${encodeURIComponent(packageId)}`}
                      >
                        {packageId}
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <AssuranceWorkflowPanel
                disabledMessage="Select a recommendation to load its workflow activity."
                emptyMessage="No workflow runs are linked to the selected recommendation yet."
                helperText="Track review decisions, refreshed packages, and other linked assurance activity for this recommendation."
                linkedRecordIds={[
                  selectedRecommendation.id,
                  selectedDecisionId,
                  selectedRecommendation.evidenceJobId ?? '',
                  lastRefreshRecommendationId,
                  ...lastRefreshedPackageIds,
                ]}
              />

              <AssuranceExplainPanel
                audiences={[
                  { value: 'remediation', label: 'Remediation' },
                  { value: 'derivation', label: 'Derivation trace' },
                ]}
                defaultAudience="remediation"
                disabled={!selectedRecommendation.evidenceJobId}
                heading="Review explainer"
                helperText="Generate a remediation-focused explanation for the selected recommendation before accepting or rejecting it."
                initialAudience={isExplainAudience(requestedAudience) ? requestedAudience : 'remediation'}
                initialFocusId={requestedFocusId}
                focusOptions={explanationFocusOptions}
                loadExplanation={({ audience, focusId, question }) =>
                  explainAssurance({
                    audience,
                    evidenceJobId: selectedRecommendation.evidenceJobId ?? undefined,
                    focusId: focusId || selectedRecommendation.targetId,
                    question,
                  })
                }
                onAudienceChange={(audience) => updateSearchState({ audience })}
                onFocusIdChange={(focusId) => updateSearchState({ focusId: focusId || null })}
                requestKey={`${selectedRecommendation.id}:${selectedRecommendation.evidenceJobId ?? 'none'}`}
              />
            </>
          ) : (
            <div className="panel text-sm text-[#6f6578]">Select a pending recommendation to review it.</div>
          )}

          <section className="grid gap-4 xl:grid-cols-[0.84fr_1.16fr]">
            <section className="panel-subtle">
              <div className="label">Decision history</div>
              {lastRefreshedPackageIds.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {lastRefreshedPackageIds.map((packageId) => (
                    <Link
                      key={packageId}
                      className="rounded-full border border-[#d7c3f1] bg-[#f2e8ff] px-3 py-1 font-mono text-xs text-[#6d28d9] transition hover:border-[#8b35e6]/30"
                      to={`/assurance/packages?packageId=${encodeURIComponent(packageId)}`}
                    >
                      Refreshed package {packageId}
                    </Link>
                  ))}
                </div>
              )}
              <div className="mt-3 space-y-2">
                {history.map((item) => (
                  <button
                    key={item.id}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      selectedDecisionId === item.id
                        ? 'border-[#8b35e6]/30 bg-[#f2e8ff]'
                        : 'border-[#ded8e4] bg-[#fbf9fc] hover:border-[#8b35e6]/25 hover:bg-[#f8f3ff]'
                    }`}
                    onClick={() => {
                      setSelectedDecisionId(item.id);
                      updateSearchState({
                        decisionId: item.id,
                        evidenceJobId: item.evidenceJobId ?? requestedEvidenceJobId ?? null,
                        focusId: item.id,
                      });
                    }}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-[#241232]">{humanizeKey(item.decision)}</div>
                      <div className="text-xs text-[#62576a]">{formatDate(item.createdAt)}</div>
                    </div>
                    <div className="mt-2 text-sm text-[#51465e]">{item.recommendationTitle ?? item.recommendationId}</div>
                    <div className="mt-2 font-mono text-xs text-[#6d28d9]">{item.id}</div>
                    <div className="mt-2 text-sm leading-6 text-[#6f6578]">{item.justification}</div>
                  </button>
                ))}
                {!loading && history.length === 0 && (
                  <div className="text-sm text-[#6f6578]">No review decisions have been recorded yet.</div>
                )}
              </div>
            </section>

            <section className="panel-subtle">
              <div className="label">Selected decision</div>
              {selectedDecision ? (
                <div className="mt-3 space-y-4">
                  <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-[#241232]">{selectedDecision.recommendationTitle ?? selectedDecision.recommendationId}</div>
                        <div className="mt-1 font-mono text-xs text-[#6d28d9]">{selectedDecision.id}</div>
                      </div>
                      <RegStatusPill tone="neutral">{humanizeKey(selectedDecision.decision)}</RegStatusPill>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-[#6f6578] sm:grid-cols-2">
                      <div>Target type: {humanizeKey(selectedDecision.targetType)}</div>
                      <div>Target id: {selectedDecision.targetId ?? '—'}</div>
                      <div>Evidence refs: {selectedDecision.evidenceRefs.length}</div>
                      <div>Finding refs: {selectedDecision.findingRefs.length}</div>
                    </div>
                    <div className="mt-3 text-sm leading-6 text-[#51465e]">{selectedDecision.justification}</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedDecision.evidenceJobId && (
                        <Link
                          className="button-secondary"
                          to={`/assurance/evidence?evidenceJobId=${encodeURIComponent(selectedDecision.evidenceJobId)}`}
                        >
                          Open evidence bundle
                        </Link>
                      )}
                      {selectedRecommendation?.id === selectedDecision.recommendationId && lastRefreshedPackageIds[0] && (
                        <Link
                          className="button-secondary"
                          to={`/assurance/packages?packageId=${encodeURIComponent(lastRefreshedPackageIds[0])}`}
                        >
                          Open refreshed package
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-[#62576a]">Evidence refs</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedDecision.evidenceRefs.map((item) => (
                          <span key={item} className="rounded-full border border-[#ded8e4] bg-[#f7f2fa] px-3 py-1 font-mono text-xs text-[#6d28d9]">
                            {item}
                          </span>
                        ))}
                        {selectedDecision.evidenceRefs.length === 0 && <span className="text-xs text-[#62576a]">None recorded</span>}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-[#62576a]">Finding refs</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedDecision.findingRefs.map((item) => (
                          <span key={item} className="rounded-full border border-[#ded8e4] bg-[#f7f2fa] px-3 py-1 font-mono text-xs text-[#6d28d9]">
                            {item}
                          </span>
                        ))}
                        {selectedDecision.findingRefs.length === 0 && <span className="text-xs text-[#62576a]">None recorded</span>}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-[#62576a]">Control refs</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedDecision.controlRefs.map((item) => (
                          <span key={item} className="rounded-full border border-[#ded8e4] bg-[#f7f2fa] px-3 py-1 font-mono text-xs text-[#6d28d9]">
                            {item}
                          </span>
                        ))}
                        {selectedDecision.controlRefs.length === 0 && <span className="text-xs text-[#62576a]">None recorded</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-[#6f6578]">Select a historical decision to inspect its lineage.</div>
              )}
            </section>
          </section>
        </section>
      </section>

      <RegRightDrawer
        open={inspectedRecommendation !== null}
        onOpenChange={(open) => {
          if (!open) {
            setInspectedRecommendation(null);
          }
        }}
        title={inspectedRecommendation?.title ?? 'Recommendation details'}
        description={inspectedRecommendation ? inspectedRecommendation.summary : undefined}
        footer={
          inspectedRecommendation ? (
            <div className="flex flex-wrap justify-end gap-2">
              {inspectedRecommendation.evidenceJobId ? (
                <Link
                  className="button-secondary"
                  to={`/assurance/evidence?evidenceJobId=${encodeURIComponent(inspectedRecommendation.evidenceJobId)}`}
                >
                  Open evidence bundle
                </Link>
              ) : null}
              <button
                className="button-secondary"
                disabled={busyDecision !== null}
                onClick={() => {
                  setSelectedRecommendationId(inspectedRecommendation.id);
                  setJustification((current) => current || 'Rejected after assurance review.');
                  setDecisionToReview('rejected');
                }}
                type="button"
              >
                Reject
              </button>
              <button
                className="button-primary"
                disabled={busyDecision !== null}
                onClick={() => {
                  setSelectedRecommendationId(inspectedRecommendation.id);
                  setJustification((current) => current || 'Accepted after assurance review.');
                  setDecisionToReview('accepted');
                }}
                type="button"
              >
                Accept
              </button>
            </div>
          ) : null
        }
      >
        {inspectedRecommendation ? (
          <div className="space-y-5">
            <div className="grid gap-3 text-sm text-[#51465e] sm:grid-cols-2">
              <div className="rounded-lg border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3">
                <div className="label">Target type</div>
                <div className="mt-2 font-medium text-[#241232]">{humanizeKey(inspectedRecommendation.targetType)}</div>
              </div>
              <div className="rounded-lg border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3">
                <div className="label">Target id</div>
                <div className="mt-2 break-all font-mono text-xs text-[#6d28d9]">{inspectedRecommendation.targetId}</div>
              </div>
              <div className="rounded-lg border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3">
                <div className="label">Evidence refs</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {evidenceRefsForRecommendation(inspectedRecommendation).map((item) => (
                    <span key={item} className="rounded-full border border-[#d7c3f1] bg-[#f2e8ff] px-2.5 py-1 font-mono text-xs text-[#5f1aa8]">
                      {item}
                    </span>
                  ))}
                  {evidenceRefsForRecommendation(inspectedRecommendation).length === 0 ? <span className="text-[#62576a]">None suggested</span> : null}
                </div>
              </div>
              <div className="rounded-lg border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3">
                <div className="label">Control refs</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {controlRefsForRecommendation(inspectedRecommendation).map((item) => (
                    <span key={item} className="rounded-full border border-[#ded8e4] bg-white px-2.5 py-1 font-mono text-xs text-[#51465e]">
                      {item}
                    </span>
                  ))}
                  {controlRefsForRecommendation(inspectedRecommendation).length === 0 ? <span className="text-[#62576a]">None suggested</span> : null}
                </div>
              </div>
            </div>

            <div>
              <div className="label">Recommendation payload</div>
              <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-[#ded8e4] bg-[#fbf9fc] p-3 text-xs text-[#241232]">
                {JSON.stringify(inspectedRecommendation.recommendation, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegModal
        open={decisionToReview !== null}
        onOpenChange={(open) => {
          if (!open && busyDecision === null) {
            setDecisionToReview(null);
          }
        }}
        title={decisionToReview ? `${reviewDecisionLabels[decisionToReview]} recommendation` : 'Review recommendation'}
        description={decisionToReview ? reviewDecisionDescriptions[decisionToReview] : undefined}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" disabled={busyDecision !== null} onClick={() => setDecisionToReview(null)} type="button">
              Cancel
            </button>
            <button
              className={decisionToReview === 'rejected' ? 'button-secondary' : 'button-primary'}
              disabled={busyDecision !== null || !decisionToReview}
              onClick={() => {
                if (decisionToReview) {
                  void handleDecision(decisionToReview);
                }
              }}
              type="button"
            >
              {decisionToReview && busyDecision === decisionToReview
                ? `${reviewDecisionLabels[decisionToReview]}ing...`
                : decisionToReview
                  ? reviewDecisionLabels[decisionToReview]
                  : 'Confirm'}
            </button>
          </div>
        }
      >
        {selectedRecommendation ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#ded8e4] bg-[#fbf9fc] px-4 py-4">
              <div className="label">Recommendation</div>
              <div className="mt-2 text-base font-semibold text-[#241232]">{selectedRecommendation.title}</div>
              <div className="mt-1 font-mono text-xs text-[#6d28d9]">{selectedRecommendation.id}</div>
              <p className="mt-3 text-sm leading-6 text-[#51465e]">{selectedRecommendation.summary}</p>
            </div>
            <label className="block space-y-1">
              <span className="label">Reviewer note</span>
              <textarea
                className="input min-h-[160px]"
                onChange={(event) => setJustification(event.target.value)}
                value={justification}
              />
            </label>
            <div className="grid gap-3 text-sm text-[#51465e] sm:grid-cols-2">
              <div className="rounded-lg border border-[#ded8e4] bg-white px-3 py-3">
                <div className="label">Evidence refs</div>
                <div className="mt-2">{evidenceRefsForRecommendation(selectedRecommendation).length || 'None suggested'}</div>
              </div>
              <div className="rounded-lg border border-[#ded8e4] bg-white px-3 py-3">
                <div className="label">Control refs</div>
                <div className="mt-2">{controlRefsForRecommendation(selectedRecommendation).length || 'None suggested'}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-[#6f6578]">Select a recommendation before recording a decision.</div>
        )}
      </RegModal>
    </div>
  );
}
