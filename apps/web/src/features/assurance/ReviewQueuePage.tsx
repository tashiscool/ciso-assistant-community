import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { explainAssurance, listPendingReviews, listReviewHistory, recordReviewDecision } from './api';
import { AssuranceExplainPanel } from './AssuranceExplainPanel';
import { AssuranceWorkflowPanel } from './AssuranceWorkflowPanel';
import { CoachMarksPanel } from '../../components/CoachMarksPanel';
import type { AssuranceExplainAudience, ReviewDecision, ReviewRecommendation } from './types';
import { useEdgeIdentity } from '../../shared/session/identity';

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
  const [loading, setLoading] = useState(true);
  const [busyDecision, setBusyDecision] = useState<string | null>(null);
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

  async function handleDecision(decision: 'accepted' | 'rejected') {
    if (!selectedRecommendation) {
      return;
    }
    try {
      setBusyDecision(decision);
      setError(null);
      setNotice(null);
      const result = await recordReviewDecision({
        recommendationId: selectedRecommendation.id,
        decision,
        justification,
        evidenceRefs: [String(selectedRecommendation.recommendation.recommendedArtifact ?? '')].filter(Boolean),
        controlRefs: Array.isArray(selectedRecommendation.recommendation.controlRefs)
          ? (selectedRecommendation.recommendation.controlRefs as string[])
          : [],
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record the review decision.');
    } finally {
      setBusyDecision(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Assurance</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Review Queue</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
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
        <div className="panel-subtle flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
          <div>
            Decision history is filtered to evidence job <span className="font-mono text-cyan-200">{requestedEvidenceJobId}</span>.
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
                <div className="mt-1 text-sm text-slate-400">Only recommendations within your accessible domains are shown here.</div>
              </div>
              <button className="button-secondary" onClick={() => void loadQueue()} type="button">
                Refresh
              </button>
            </div>
          </div>

          {pending.map((item) => (
            <button
              key={item.id}
              className={`panel w-full text-left transition ${selectedRecommendationId === item.id ? 'border-cyan-400/30 bg-cyan-400/10' : ''}`}
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
                  <h2 className="mt-2 text-lg font-semibold text-white">{item.title}</h2>
                  <div className="mt-2 font-mono text-xs text-cyan-200">{item.id}</div>
                </div>
                <span className="badge-neutral">{String(item.recommendation.severity ?? item.status)}</span>
              </div>
              <div className="mt-3 text-sm leading-6 text-slate-400">{item.summary}</div>
            </button>
          ))}

          {!loading && pending.length === 0 && (
            <div className="panel text-sm text-slate-400">No pending review recommendations are waiting for your scope.</div>
          )}
          {loading && <div className="panel text-sm text-slate-400">Loading review queue...</div>}
        </section>

        <section className="space-y-4">
          {selectedRecommendation ? (
            <>
              <section className="panel">
                <div className="label">Selected recommendation</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedRecommendation.title}</h2>
                <div className="mt-2 font-mono text-xs text-cyan-200">{selectedRecommendation.id}</div>
                <p className="mt-4 text-sm leading-6 text-slate-300">{selectedRecommendation.summary}</p>
                <div className="mt-4 grid gap-3 text-sm text-slate-400 sm:grid-cols-2">
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
                  <button className="button-primary" disabled={busyDecision !== null} onClick={() => void handleDecision('accepted')} type="button">
                    {busyDecision === 'accepted' ? 'Accepting...' : 'Accept'}
                  </button>
                  <button className="button-secondary" disabled={busyDecision !== null} onClick={() => void handleDecision('rejected')} type="button">
                    {busyDecision === 'rejected' ? 'Rejecting...' : 'Reject'}
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
                        className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] px-3 py-1 font-mono text-xs text-cyan-200 transition hover:border-cyan-300/30"
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
            <div className="panel text-sm text-slate-400">Select a pending recommendation to review it.</div>
          )}

          <section className="grid gap-4 xl:grid-cols-[0.84fr_1.16fr]">
            <section className="panel-subtle">
              <div className="label">Decision history</div>
              {lastRefreshedPackageIds.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {lastRefreshedPackageIds.map((packageId) => (
                    <Link
                      key={packageId}
                      className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] px-3 py-1 font-mono text-xs text-cyan-200 transition hover:border-cyan-300/30"
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
                        ? 'border-cyan-300/30 bg-cyan-400/[0.06]'
                        : 'border-white/8 bg-black/15 hover:border-cyan-300/20 hover:bg-cyan-400/[0.03]'
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
                      <div className="text-sm font-medium text-white">{humanizeKey(item.decision)}</div>
                      <div className="text-xs text-slate-500">{formatDate(item.createdAt)}</div>
                    </div>
                    <div className="mt-2 text-sm text-slate-300">{item.recommendationTitle ?? item.recommendationId}</div>
                    <div className="mt-2 font-mono text-xs text-cyan-200">{item.id}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-400">{item.justification}</div>
                  </button>
                ))}
                {!loading && history.length === 0 && (
                  <div className="text-sm text-slate-400">No review decisions have been recorded yet.</div>
                )}
              </div>
            </section>

            <section className="panel-subtle">
              <div className="label">Selected decision</div>
              {selectedDecision ? (
                <div className="mt-3 space-y-4">
                  <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">{selectedDecision.recommendationTitle ?? selectedDecision.recommendationId}</div>
                        <div className="mt-1 font-mono text-xs text-cyan-200">{selectedDecision.id}</div>
                      </div>
                      <span className="badge-neutral">{humanizeKey(selectedDecision.decision)}</span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
                      <div>Target type: {humanizeKey(selectedDecision.targetType)}</div>
                      <div>Target id: {selectedDecision.targetId ?? '—'}</div>
                      <div>Evidence refs: {selectedDecision.evidenceRefs.length}</div>
                      <div>Finding refs: {selectedDecision.findingRefs.length}</div>
                    </div>
                    <div className="mt-3 text-sm leading-6 text-slate-300">{selectedDecision.justification}</div>
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
                    <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Evidence refs</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedDecision.evidenceRefs.map((item) => (
                          <span key={item} className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 font-mono text-xs text-cyan-200">
                            {item}
                          </span>
                        ))}
                        {selectedDecision.evidenceRefs.length === 0 && <span className="text-xs text-slate-500">None recorded</span>}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Finding refs</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedDecision.findingRefs.map((item) => (
                          <span key={item} className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 font-mono text-xs text-cyan-200">
                            {item}
                          </span>
                        ))}
                        {selectedDecision.findingRefs.length === 0 && <span className="text-xs text-slate-500">None recorded</span>}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Control refs</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedDecision.controlRefs.map((item) => (
                          <span key={item} className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 font-mono text-xs text-cyan-200">
                            {item}
                          </span>
                        ))}
                        {selectedDecision.controlRefs.length === 0 && <span className="text-xs text-slate-500">None recorded</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-400">Select a historical decision to inspect its lineage.</div>
              )}
            </section>
          </section>
        </section>
      </section>
    </div>
  );
}
