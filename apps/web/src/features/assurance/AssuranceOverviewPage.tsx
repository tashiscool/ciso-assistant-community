import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AssuranceExplainPanel } from './AssuranceExplainPanel';
import { AssuranceWorkflowPanel } from './AssuranceWorkflowPanel';
import { explainAssurance, getAssuranceOverview, getObservableParityStatus } from './api';
import type { AssuranceExplainAudience, AssuranceOverview, AssuranceParityStatus } from './types';
import { CoachMarksPanel } from '../../components/CoachMarksPanel';
import { useEdgeIdentity } from '../../shared/session/identity';

type AssuranceOverviewPageProps = {
  showOperationalReadiness?: boolean;
};

type AttentionTone = 'danger' | 'warning' | 'neutral';

type AttentionItem = {
  id: string;
  priority: number;
  kindLabel: string;
  statusLabel: string;
  title: string;
  detail: string;
  route: string;
  createdAt: string | null;
  tone: AttentionTone;
  evidenceJobId?: string | null;
  importJobId?: string | null;
  focusId?: string | null;
  defaultAudience?: AssuranceExplainAudience;
  linkedRecordIds: string[];
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

function workflowBadgeClass(value: string) {
  switch (value) {
    case 'Done':
      return 'badge-success';
    case 'Failed':
      return 'badge-danger';
    default:
      return 'badge-neutral';
  }
}

function attentionToneClass(value: AttentionTone) {
  switch (value) {
    case 'danger':
      return 'border-rose-300/15 bg-rose-400/[0.04] hover:border-rose-300/30';
    case 'warning':
      return 'border-amber-300/15 bg-amber-400/[0.04] hover:border-amber-300/30';
    default:
      return 'border-cyan-300/15 bg-cyan-400/[0.04] hover:border-cyan-300/30';
  }
}

function parityStatusBadgeClass(value: AssuranceParityStatus['status'] | null | undefined) {
  switch (value) {
    case 'pass':
      return 'badge-success';
    case 'fail':
      return 'badge-danger';
    case 'attention':
    default:
      return 'badge-neutral';
  }
}

function isExplainAudience(value: string | null): value is AssuranceExplainAudience {
  return (
    value === 'assessor' ||
    value === 'executive' ||
    value === 'ao' ||
    value === 'derivation' ||
    value === 'reasonableness' ||
    value === 'remediation' ||
    value === 'tracker'
  );
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'number' ? value : 0;
}

function readString(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function compareAttentionItems(a: AttentionItem, b: AttentionItem) {
  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }

  const left = a.createdAt ? Date.parse(a.createdAt) : 0;
  const right = b.createdAt ? Date.parse(b.createdAt) : 0;
  return right - left;
}

function buildReviewRoute(recommendationId: string, evidenceJobId?: string | null) {
  return `/assurance/reviews?recommendationId=${encodeURIComponent(recommendationId)}${
    evidenceJobId ? `&evidenceJobId=${encodeURIComponent(evidenceJobId)}` : ''
  }`;
}

function summarizeMetricValue(value: unknown): string | null {
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    const rendered = value
      .filter((item): item is string | number => typeof item === 'string' || typeof item === 'number')
      .slice(0, 3)
      .map((item) => String(item).trim())
      .filter(Boolean);
    return rendered.length > 0 ? rendered.join(', ') : null;
  }
  return null;
}

function summarizeMetricEntries(metrics: Record<string, unknown> | null | undefined) {
  if (!metrics) {
    return [];
  }
  return Object.entries(metrics)
    .map(([key, value]) => {
      const rendered = summarizeMetricValue(value);
      return rendered ? `${humanizeKey(key)}: ${rendered}` : null;
    })
    .filter((item): item is string => Boolean(item))
    .slice(0, 3);
}

export function AssuranceOverviewPage({ showOperationalReadiness = false }: AssuranceOverviewPageProps) {
  const { identity } = useEdgeIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState<AssuranceOverview | null>(null);
  const [parityStatus, setParityStatus] = useState<AssuranceParityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadOverview() {
    try {
      setLoading(true);
      setError(null);
      const overviewPromise = getAssuranceOverview();
      const readinessPromise = showOperationalReadiness ? getObservableParityStatus() : Promise.resolve(null);
      const [overviewData, parityData] = await Promise.all([overviewPromise, readinessPromise]);
      setOverview(overviewData);
      setParityStatus(parityData);
    } catch (err) {
      setParityStatus(null);
      setError(err instanceof Error ? err.message : 'Unable to load the assurance overview.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, [identity.tenantId, identity.userId, showOperationalReadiness]);

  const evidenceJobs = overview?.evidenceJobs ?? [];
  const trackerImports = overview?.trackerImports ?? [];
  const trackerImportsWithErrors = overview?.trackerImportsWithErrors ?? [];
  const packages = overview?.packages ?? [];
  const parityReadyPackages = overview?.parityReadyPackages ?? [];
  const mismatchedPackages = overview?.mismatchedPackages ?? [];
  const packagesWithValidationDrift = overview?.packagesWithValidationDrift ?? [];
  const pendingReviews = overview?.pendingReviews ?? [];
  const reviewHistory = overview?.reviewHistory ?? [];
  const agentRuns = overview?.agentRuns ?? [];
  const pendingWritebacks = overview?.pendingWritebacks ?? [];
  const workflowRuns = overview?.workflowRuns ?? [];
  const parityChecks = parityStatus?.checks ?? [];
  const paritySource = parityStatus?.source ?? null;
  const summary = overview?.summary ?? {
    evidenceJobCount: 0,
    trackerImportCount: 0,
    trackerImportErrorCount: 0,
    packageCount: 0,
    agentBackedPackageCount: 0,
    observableParityReadyPackageCount: 0,
    packageMismatchCount: 0,
    packageValidationReviewCount: 0,
    pendingReviewCount: 0,
    reviewDecisionCount: 0,
    agentRunCount: 0,
    pendingWritebackCount: 0,
    runningWorkflowCount: 0,
    awaitingReviewWorkflowCount: 0,
    failedWorkflowCount: 0,
  };
  const latestEvidenceJob = evidenceJobs[0] ?? null;
  const latestTrackerImport = trackerImports[0] ?? null;
  const latestPackage = packages[0] ?? null;
  const latestParityReadyPackage = parityReadyPackages[0] ?? null;
  const latestPendingReview = pendingReviews[0] ?? null;
  const latestReviewDecision = reviewHistory[0] ?? null;
  const latestAgentRun = agentRuns[0] ?? null;
  const coachMarkItems = [
    {
      id: 'assurance-evidence',
      eyebrow: 'Intake',
      title: 'Evidence arrives before anything else',
      body: 'Evidence jobs and tracker imports are the grounded inputs the rest of the assurance flow depends on.',
      route: '/assurance/evidence',
      ctaLabel: 'Open evidence explorer',
    },
    {
      id: 'assurance-reviews',
      eyebrow: 'Human review',
      title: 'Recommendations are meant to pause for people',
      body: 'Pending reviews and approval gates are part of the contract, not cleanup after the fact.',
      route: '/assurance/reviews',
      ctaLabel: 'Open review queue',
      tone: 'focus' as const,
    },
    {
      id: 'assurance-packages',
      eyebrow: 'Packages',
      title: 'Packages are the shareable result',
      body: 'Validation, reconciliation, rendered reports, and lineage all come together in the package workbench.',
      route: '/assurance/packages',
      ctaLabel: 'Open packages',
    },
    {
      id: 'assurance-agents',
      eyebrow: 'Bounded automation',
      title: 'Agent runs stay inspectable and approval-gated',
      body: 'Automation here is designed to explain itself and wait for review instead of acting like a black box.',
      route: '/assurance/agent-runs',
      ctaLabel: 'Open agent runs',
    },
  ];
  const reviewBacklog = pendingReviews.slice(0, 4);
  const recentDecisions = reviewHistory.slice(0, 2);
  const mismatchedPackageIds = new Set(mismatchedPackages.map((item) => item.id));
  const validationDriftPackages = packagesWithValidationDrift.filter((item) => !mismatchedPackageIds.has(item.id));
  const requestedItemId = searchParams.get('itemId');
  const requestedExplainId = searchParams.get('explainId');
  const requestedExplainAudience = searchParams.get('audience');
  const requestedFocusId = searchParams.get('focusId');
  const attentionItems: AttentionItem[] = [
    ...workflowRuns
      .filter((item) => item.status === 'Failed')
      .map(
        (item) =>
          ({
            id: `workflow:${item.runId}`,
            priority: 0,
            kindLabel: 'Workflow failure',
            statusLabel: item.status,
            title: item.title,
            detail: item.detail,
            route: item.route,
          createdAt: item.updatedAt,
          tone: 'danger',
          evidenceJobId: readString(item.metadata, 'evidenceJobId'),
          importJobId: readString(item.metadata, 'importJobId'),
          defaultAudience: 'derivation',
          linkedRecordIds: [
            item.runId,
            item.sourceRecordId ?? '',
            readString(item.metadata, 'evidenceJobId') ?? '',
            readString(item.metadata, 'importJobId') ?? '',
            readString(item.metadata, 'packageJobId') ?? '',
          ].filter(Boolean),
        }) satisfies AttentionItem,
      ),
    ...mismatchedPackages.map(
      (item) =>
        ({
          id: `package:${item.id}`,
          priority: 1,
          kindLabel: 'Package mismatch',
          statusLabel: humanizeKey(item.reconciliationStatus ?? 'mismatch'),
          title: item.fileName,
          detail: `${readNumber(item.coverage, 'evaluationCount')} eval(s), ${readNumber(item.coverage, 'gapCount')} gap(s), and reconciliation drift need review.`,
          route: `/assurance/packages?packageId=${encodeURIComponent(item.id)}`,
          createdAt: item.updatedAt,
          tone: 'danger',
          evidenceJobId: item.sourceRecord,
          defaultAudience: 'derivation',
          linkedRecordIds: [item.id, item.sourceRecord ?? ''].filter(Boolean),
        }) satisfies AttentionItem,
    ),
    ...validationDriftPackages.map(
      (item) =>
        ({
          id: `package-validation:${item.id}`,
          priority: 2,
          kindLabel: 'Package validation',
          statusLabel: humanizeKey(item.validationStatus ?? 'review'),
          title: item.fileName,
          detail: `${item.validationCheckCount ?? readNumber(item.coverage, 'validationCheckCount')} validation check(s) are flagging contract or lineage drift for assessor review.`,
          route: `/assurance/packages?packageId=${encodeURIComponent(item.id)}`,
          createdAt: item.updatedAt,
          tone: 'warning',
          evidenceJobId: item.sourceRecord,
          defaultAudience: 'assessor',
          linkedRecordIds: [item.id, item.sourceRecord ?? ''].filter(Boolean),
        }) satisfies AttentionItem,
    ),
    ...trackerImportsWithErrors.map(
      (item) =>
        ({
          id: `tracker:${item.id}`,
          priority: 3,
          kindLabel: 'Tracker import',
          statusLabel: `${item.errorCount} row error(s)`,
          title: item.name,
          detail: `${item.importedCount} of ${item.rowCount} row(s) imported. Classification or parse issues are still blocking conversion.`,
          route: `/assurance/tracker?importId=${encodeURIComponent(item.id)}`,
          createdAt: item.updatedAt,
          tone: 'danger',
          importJobId: item.id,
          defaultAudience: 'tracker',
          linkedRecordIds: [item.id],
        }) satisfies AttentionItem,
    ),
    ...pendingWritebacks.map(
      (item) => {
        const linkedRun = agentRuns.find((run) => run.id === item.agentRunId);
        return {
          id: `writeback:${item.id}`,
          priority: 4,
          kindLabel: 'Writeback approval',
          statusLabel: humanizeKey(item.requestType),
          title: item.connectorName
            ? `${item.connectorName} ${humanizeKey(item.requestType)}`
            : humanizeKey(item.requestType),
          detail: item.summary,
          route: `/assurance/agent-runs?runId=${encodeURIComponent(item.agentRunId)}&writebackId=${encodeURIComponent(item.id)}`,
          createdAt: item.createdAt,
          tone: 'warning',
          evidenceJobId: linkedRun?.evidenceJobId ?? null,
          importJobId: linkedRun?.importJobId ?? null,
          focusId: item.primaryFocusId ?? item.id,
          defaultAudience: linkedRun?.importJobId && !linkedRun?.evidenceJobId ? 'tracker' : 'remediation',
          linkedRecordIds: [
            item.id,
            item.agentRunId,
            linkedRun?.evidenceJobId ?? '',
            linkedRun?.importJobId ?? '',
            item.primaryFocusId ?? '',
          ].filter(Boolean),
        } satisfies AttentionItem;
      },
    ),
    ...pendingReviews.map(
      (item) =>
        ({
          id: `review:${item.id}`,
          priority: 5,
          kindLabel: 'Review recommendation',
          statusLabel: humanizeKey(item.targetType),
          title: item.title,
          detail: item.summary,
          route: buildReviewRoute(item.id, item.evidenceJobId),
          createdAt: item.createdAt ?? null,
          tone: 'warning',
          evidenceJobId: item.evidenceJobId ?? null,
          focusId: item.id,
          defaultAudience: 'remediation',
          linkedRecordIds: [item.id, item.evidenceJobId ?? '', item.targetId].filter(Boolean),
        }) satisfies AttentionItem,
    ),
  ]
    .sort(compareAttentionItems)
    .slice(0, 10);
  const explainableAttentionItems = attentionItems.filter((item) => item.evidenceJobId || item.importJobId);
  const selectedAttentionItem =
    attentionItems.find((item) => item.id === requestedItemId || item.id === requestedExplainId) ??
    attentionItems[0] ??
    null;
  const selectedExplainItem =
    explainableAttentionItems.find((item) => item.id === requestedExplainId) ??
    (selectedAttentionItem && (selectedAttentionItem.evidenceJobId || selectedAttentionItem.importJobId)
      ? selectedAttentionItem
      : null);
  let selectedExplainAudience: AssuranceExplainAudience = selectedExplainItem?.defaultAudience ?? 'assessor';
  if (isExplainAudience(requestedExplainAudience)) {
    if (
      requestedExplainAudience === 'tracker' &&
      selectedExplainItem?.importJobId &&
      !selectedExplainItem.evidenceJobId
    ) {
      selectedExplainAudience = 'tracker';
    } else if (requestedExplainAudience !== 'tracker') {
      selectedExplainAudience = requestedExplainAudience;
    }
  }
  const selectedExplainFocusId = requestedFocusId ?? selectedExplainItem?.focusId ?? '';
  const selectedAttentionLinkedRecords = selectedAttentionItem?.linkedRecordIds ?? [];
  const selectedAttentionReferenceChips = [
    selectedAttentionItem?.evidenceJobId ? { label: 'Evidence', value: selectedAttentionItem.evidenceJobId } : null,
    selectedAttentionItem?.importJobId ? { label: 'Tracker', value: selectedAttentionItem.importJobId } : null,
    selectedAttentionItem?.focusId ? { label: 'Focus', value: selectedAttentionItem.focusId } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  function updateSearchState(next: {
    itemId?: string | null;
    explainId?: string | null;
    audience?: AssuranceExplainAudience | null;
    focusId?: string | null;
  }) {
    const params = new URLSearchParams(searchParams);
    if (next.itemId === null) {
      params.delete('itemId');
    } else if (typeof next.itemId === 'string') {
      params.set('itemId', next.itemId);
    }
    if (next.explainId === null) {
      params.delete('explainId');
    } else if (typeof next.explainId === 'string') {
      params.set('explainId', next.explainId);
    }
    if (next.audience === null) {
      params.delete('audience');
    } else if (next.audience) {
      params.set('audience', next.audience);
    }
    if (next.focusId === null) {
      params.delete('focusId');
    } else if (typeof next.focusId === 'string' && next.focusId) {
      params.set('focusId', next.focusId);
    }
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Assurance</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Assurance Overview</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          See evidence intake, tracker backlog, package readiness, human review posture, bounded-agent activity, and recent workflow runs in one place.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="button-secondary" to="/assurance/evidence">
            Open evidence explorer
          </Link>
          <Link className="button-secondary" to="/assurance/tracker">
            Open tracker workbench
          </Link>
          <Link className="button-secondary" to="/assurance/packages">
            Open 20x packages
          </Link>
          <Link className="button-secondary" to="/assurance/reviews">
            Open review queue
          </Link>
          <Link className="button-secondary" to="/assurance/agent-runs">
            Open agent runs
          </Link>
        </div>
      </section>

      <CoachMarksPanel
        storageKey="assurance-overview"
        title="Assurance is a flow from evidence to review to package."
        description="Use this overview to understand where the current assurance chain is blocked, then drop into the specific workbench that owns the next decision."
        items={coachMarkItems}
      />

      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Evidence jobs</div>
          <div className="metric-value">{summary.evidenceJobCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Tracker imports</div>
          <div className="metric-value">{summary.trackerImportCount}</div>
          <div className="mt-2 text-xs text-slate-500">{summary.trackerImportErrorCount} with row errors</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Package mismatches</div>
          <div className="metric-value">{summary.packageMismatchCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Verified packages</div>
          <div className="metric-value">{summary.observableParityReadyPackageCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Agent-backed packages</div>
          <div className="metric-value">{summary.agentBackedPackageCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Validation drift</div>
          <div className="metric-value">{summary.packageValidationReviewCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Pending reviews</div>
          <div className="metric-value">{summary.pendingReviewCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Pending writebacks</div>
          <div className="metric-value">{summary.pendingWritebackCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Failed workflows</div>
          <div className="metric-value">{summary.failedWorkflowCount}</div>
        </div>
      </section>

      {showOperationalReadiness ? (
        <section className="panel-subtle">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="label">Assurance readiness</div>
            <div className="mt-1 text-sm text-slate-400">
              Live view of packages that are validation-clean, reconciliation-matched, and backed by the current evidence and agent review chain.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className={parityStatusBadgeClass(parityStatus?.status)}>{humanizeKey(parityStatus?.status ?? 'loading')}</span>
            <span>
              {summary.observableParityReadyPackageCount} verified package{summary.observableParityReadyPackageCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest verified package</div>
              <div className="mt-2 text-sm font-medium text-white">
                {paritySource?.packageFileName ?? latestParityReadyPackage?.fileName ?? 'No verified package yet'}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {formatDate(paritySource?.updatedAt ?? latestParityReadyPackage?.updatedAt ?? null)}
              </div>
              {paritySource?.packageRoute || latestParityReadyPackage ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    className="button-secondary"
                    to={
                      paritySource?.packageRoute ??
                      `/assurance/packages?packageId=${encodeURIComponent(latestParityReadyPackage?.id ?? '')}`
                    }
                  >
                    Open package
                  </Link>
                  {paritySource?.evidenceRoute ? (
                    <Link className="button-secondary" to={paritySource.evidenceRoute}>
                      Open evidence
                    </Link>
                  ) : null}
                  {paritySource?.agentRoute ? (
                    <Link className="button-secondary" to={paritySource.agentRoute}>
                      Open agent run
                    </Link>
                  ) : null}
                  {paritySource?.trackerRoute ? (
                    <Link className="button-secondary" to={paritySource.trackerRoute}>
                      Open tracker import
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Readiness posture</div>
              <div className="mt-2 space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <span>Validation clean</span>
                  <span className="font-mono text-cyan-200">{summary.observableParityReadyPackageCount}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Agent-backed</span>
                  <span className="font-mono text-cyan-200">{summary.agentBackedPackageCount}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Recent agent checks</span>
                  <span className="font-mono text-cyan-200">
                    {latestParityReadyPackage ? readNumber(latestParityReadyPackage.coverage, 'agentEvaluationCount') : parityStatus?.counts.agentRuns ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Recent agent gaps</span>
                  <span className="font-mono text-cyan-200">
                    {latestParityReadyPackage ? readNumber(latestParityReadyPackage.coverage, 'agentGapCount') : 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Verification checklist</div>
                  <div className="mt-1 text-sm text-slate-400">
                    Verified {formatDate(parityStatus?.generatedAt ?? null)} against package, evidence, tracker, workflow, and agent artifacts.
                  </div>
                </div>
                <span className={parityStatusBadgeClass(parityStatus?.status)}>
                  {humanizeKey(parityStatus?.status ?? 'loading')}
                </span>
              </div>
              <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                <div>Bundle kind: {humanizeKey(paritySource?.bundleKind)}</div>
                <div>Input mode: {humanizeKey(paritySource?.inputMode)}</div>
                <div>Tracker imports: {parityStatus?.counts.trackerImports ?? 0}</div>
                <div>Pending writebacks: {parityStatus?.counts.pendingWritebacks ?? 0}</div>
              </div>
            </div>
            {parityChecks.map((check) => {
              const metricEntries = summarizeMetricEntries(check.metrics);
              return (
                <div
                  key={check.id}
                  className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4 transition hover:border-cyan-300/25"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-medium text-white">{check.title}</div>
                    <span className={parityStatusBadgeClass(check.status)}>{humanizeKey(check.status)}</span>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-300">{check.detail}</div>
                  {metricEntries.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      {metricEntries.map((entry) => (
                        <span
                          key={`${check.id}:${entry}`}
                          className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1"
                        >
                          {entry}
                        </span>
                      ))}
                    </div>
                  )}
                  {check.route && (
                    <div className="mt-3">
                      <Link className="button-secondary" to={check.route}>
                        Open source
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
            {parityChecks.length === 0 && (
              <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4 text-sm text-slate-400">
                {loading ? 'Loading readiness checks...' : 'No readiness checks are available yet.'}
              </div>
            )}
            <div className="space-y-2">
              {parityReadyPackages.map((item) => (
                <Link
                  key={item.id}
                  className="block rounded-2xl border border-white/8 bg-black/15 px-4 py-4 transition hover:border-cyan-300/25"
                  to={`/assurance/packages?packageId=${encodeURIComponent(item.id)}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{item.fileName}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {humanizeKey(item.validationStatus ?? 'pass')} · {humanizeKey(item.reconciliationStatus ?? 'matched')}
                      </div>
                    </div>
                    <span className="badge-success">Ready</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-4">
                    <div>{readNumber(item.coverage, 'evaluationCount')} eval(s)</div>
                    <div>{readNumber(item.coverage, 'agentEvaluationCount')} agent check(s)</div>
                    <div>{readNumber(item.coverage, 'agentGapCount')} agent gap(s)</div>
                    <div>{formatDate(item.updatedAt)}</div>
                  </div>
                </Link>
              ))}
              {parityReadyPackages.length === 0 && (
                <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4 text-sm text-slate-400">
                  No verified assurance packages are currently available in this scope.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      ) : null}

      <section className="panel-subtle">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="label">Attention queue</div>
            <div className="mt-1 text-sm text-slate-400">The highest-signal approvals, exceptions, and review items that still need follow-up.</div>
          </div>
          <div className="text-xs text-slate-500">
            Showing {attentionItems.length} actionable item{attentionItems.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {attentionItems.map((item) => (
            <div
              key={item.id}
              className={`block rounded-2xl border px-4 py-4 transition ${attentionToneClass(item.tone)} ${
                selectedAttentionItem?.id === item.id ? 'ring-1 ring-cyan-300/40' : ''
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge-neutral">{item.kindLabel}</span>
                <span
                  className={
                    item.tone === 'danger'
                      ? 'badge-danger'
                      : 'rounded-full border border-amber-300/20 bg-amber-400/[0.08] px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-100'
                  }
                >
                  {item.statusLabel}
                </span>
              </div>
              <div className="mt-2 font-medium text-white">{item.title}</div>
              <div className="mt-2 text-sm leading-6 text-slate-300">{item.detail}</div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500">{formatDate(item.createdAt)}</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="button-secondary"
                    onClick={() =>
                      updateSearchState({
                        itemId: item.id,
                        explainId: selectedExplainItem?.id === item.id ? item.id : null,
                        audience: selectedExplainItem?.id === item.id ? selectedExplainAudience : null,
                        focusId: selectedExplainItem?.id === item.id ? selectedExplainFocusId : null,
                      })
                    }
                    type="button"
                  >
                    {selectedAttentionItem?.id === item.id ? 'Inspecting' : 'Inspect here'}
                  </button>
                  {(item.evidenceJobId || item.importJobId) && (
                    <button
                      className="button-secondary"
                      onClick={() =>
                        updateSearchState({
                          itemId: item.id,
                          explainId: item.id,
                          audience: item.defaultAudience ?? (item.importJobId && !item.evidenceJobId ? 'tracker' : 'assessor'),
                          focusId: item.focusId ?? null,
                        })
                      }
                      type="button"
                    >
                      {requestedExplainId === item.id ? 'Explaining' : 'Explain here'}
                    </button>
                  )}
                  <Link className="button-secondary" to={item.route}>
                    Open workbench
                  </Link>
                </div>
              </div>
            </div>
          ))}
          {!loading && attentionItems.length === 0 && (
            <div className="text-sm text-slate-400">No high-priority assurance actions are waiting right now.</div>
          )}
          {loading && <div className="text-sm text-slate-400">Loading the assurance attention queue...</div>}
        </div>
      </section>

      <AssuranceExplainPanel
        audiences={
          selectedExplainItem?.defaultAudience === 'tracker'
            ? [{ value: 'tracker', label: 'Tracker reviewer' }]
            : [
                { value: 'assessor', label: 'Assessor' },
                { value: 'executive', label: 'Executive' },
                { value: 'ao', label: 'Authorizing official' },
                { value: 'derivation', label: 'Derivation trace' },
                { value: 'reasonableness', label: 'Reasonableness' },
                { value: 'remediation', label: 'Remediation focus' },
              ]
        }
        defaultAudience={selectedExplainItem?.defaultAudience ?? 'assessor'}
        disabled={!selectedExplainItem}
        heading="Overview explainer"
        helperText={
          selectedExplainItem
            ? `Explain the currently selected ${selectedExplainItem.kindLabel.toLowerCase()} without leaving the overview.`
            : 'Select an explainable attention item to load a grounded assurance explanation here.'
        }
        initialAudience={selectedExplainAudience}
        initialFocusId={selectedExplainFocusId}
        loadExplanation={({ audience, focusId, question }) =>
          explainAssurance({
            audience,
            evidenceJobId: selectedExplainItem?.evidenceJobId ?? undefined,
            importJobId: selectedExplainItem?.importJobId ?? undefined,
            focusId,
            question,
          })
        }
        onAudienceChange={(audience) => updateSearchState({ audience })}
        onFocusIdChange={(focusId) => updateSearchState({ focusId: focusId || null })}
        requestKey={`${selectedExplainItem?.id ?? 'none'}:${selectedExplainAudience}:${selectedExplainFocusId}`}
      />

      {selectedAttentionItem && (
        <section className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
          <section className="panel-subtle">
            <div className="label">Selected queue item</div>
            <div className="mt-3 rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge-neutral">{selectedAttentionItem.kindLabel}</span>
                <span className={selectedAttentionItem.tone === 'danger' ? 'badge-danger' : 'badge-neutral'}>
                  {selectedAttentionItem.statusLabel}
                </span>
              </div>
              <div className="mt-3 text-lg font-semibold text-white">{selectedAttentionItem.title}</div>
              <div className="mt-2 text-sm leading-6 text-slate-300">{selectedAttentionItem.detail}</div>
              <div className="mt-3 text-xs text-slate-500">{formatDate(selectedAttentionItem.createdAt)}</div>
              {selectedAttentionReferenceChips.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedAttentionReferenceChips.map((chip) => (
                    <span
                      key={`${selectedAttentionItem.id}:${chip.label}:${chip.value}`}
                      className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] px-3 py-1 text-xs text-cyan-200"
                    >
                      {chip.label}: <span className="font-mono">{chip.value}</span>
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <Link className="button-secondary" to={selectedAttentionItem.route}>
                  Open selected workbench
                </Link>
              </div>
            </div>
          </section>

          <AssuranceWorkflowPanel
            disabledMessage="Select an explainable attention item to inspect its workflow lineage."
            emptyMessage="No workflow runs are linked to the selected queue item yet."
            heading="Selected item workflow lineage"
            helperText="Workflow runs, approvals, packaging steps, and review decisions connected to the currently selected overview item."
            linkedRecordIds={selectedAttentionLinkedRecords}
            limit={12}
          />
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-3">
        <section className="panel-subtle">
          <div className="label">Backlog posture</div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm">
              <div className="text-slate-300">Running workflows</div>
              <div className="font-mono text-cyan-200">{summary.runningWorkflowCount}</div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm">
              <div className="text-slate-300">Awaiting review</div>
              <div className="font-mono text-cyan-200">{summary.awaitingReviewWorkflowCount}</div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm">
              <div className="text-slate-300">Review decisions</div>
              <div className="font-mono text-cyan-200">{summary.reviewDecisionCount}</div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm">
              <div className="text-slate-300">Validation drift</div>
              <div className="font-mono text-cyan-200">{summary.packageValidationReviewCount}</div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm">
              <div className="text-slate-300">Agent runs</div>
              <div className="font-mono text-cyan-200">{summary.agentRunCount}</div>
            </div>
          </div>
        </section>

        <section className="panel-subtle">
          <div className="label">Latest handoffs</div>
          <div className="mt-3 space-y-2">
            {latestEvidenceJob && (
              <Link className="block rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm transition hover:border-cyan-300/20 hover:bg-cyan-400/[0.03]" to={`/assurance/evidence?evidenceJobId=${encodeURIComponent(latestEvidenceJob.id)}`}>
                <div className="font-medium text-white">Evidence bundle</div>
                <div className="mt-1 font-mono text-xs text-cyan-200">{latestEvidenceJob.id}</div>
                <div className="mt-1 text-xs text-slate-500">{formatDate(latestEvidenceJob.finishedAt ?? latestEvidenceJob.startedAt ?? latestEvidenceJob.scheduledFor)}</div>
              </Link>
            )}
            {latestPackage && (
              <Link className="block rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm transition hover:border-cyan-300/20 hover:bg-cyan-400/[0.03]" to={`/assurance/packages?packageId=${encodeURIComponent(latestPackage.id)}`}>
                <div className="font-medium text-white">20x package</div>
                <div className="mt-1 font-mono text-xs text-cyan-200">{latestPackage.id}</div>
                <div className="mt-1 text-xs text-slate-500">{latestPackage.fileName}</div>
              </Link>
            )}
            {latestAgentRun && (
              <Link className="block rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm transition hover:border-cyan-300/20 hover:bg-cyan-400/[0.03]" to={`/assurance/agent-runs?runId=${encodeURIComponent(latestAgentRun.id)}`}>
                <div className="font-medium text-white">Agent run</div>
                <div className="mt-1 font-mono text-xs text-cyan-200">{latestAgentRun.id}</div>
                <div className="mt-1 text-xs text-slate-500">{humanizeKey(latestAgentRun.status)}</div>
              </Link>
            )}
            {!latestEvidenceJob && !latestPackage && !latestAgentRun && (
              <div className="text-sm text-slate-400">{loading ? 'Loading recent assurance handoffs...' : 'No assurance handoffs are available yet.'}</div>
            )}
          </div>
        </section>

        <section className="panel-subtle">
          <div className="label">Human review</div>
          <div className="mt-3 space-y-2">
            {reviewBacklog.map((item, index) => (
              <Link
                key={item.id}
                className="block rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm transition hover:border-cyan-300/20 hover:bg-cyan-400/[0.03]"
                to={buildReviewRoute(item.id, item.evidenceJobId)}
              >
                <div className="font-medium text-white">{index === 0 ? 'Pending recommendation' : `Pending recommendation ${index + 1}`}</div>
                <div className="mt-1 text-sm text-slate-300">{item.title}</div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span className="font-mono text-cyan-200">{item.id}</span>
                  <span>{humanizeKey(item.targetType)}</span>
                  <span>{formatDate(item.createdAt)}</span>
                </div>
              </Link>
            ))}
            {recentDecisions.map((item, index) => (
              <Link
                key={item.id}
                className="block rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm transition hover:border-cyan-300/20 hover:bg-cyan-400/[0.03]"
                to={`/assurance/reviews?decisionId=${encodeURIComponent(item.id)}${item.evidenceJobId ? `&evidenceJobId=${encodeURIComponent(item.evidenceJobId)}` : ''}`}
              >
                <div className="font-medium text-white">{index === 0 ? 'Latest decision' : 'Recent decision'}</div>
                <div className="mt-1 text-sm text-slate-300">{item.recommendationTitle ?? item.recommendationId}</div>
                <div className="mt-1 text-xs text-slate-500">{humanizeKey(item.decision)} · {formatDate(item.createdAt)}</div>
              </Link>
            ))}
            {latestTrackerImport && (
              <Link className="block rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm transition hover:border-cyan-300/20 hover:bg-cyan-400/[0.03]" to={`/assurance/tracker?importId=${encodeURIComponent(latestTrackerImport.id)}`}>
                <div className="font-medium text-white">Latest tracker import</div>
                <div className="mt-1 font-mono text-xs text-cyan-200">{latestTrackerImport.id}</div>
                <div className="mt-1 text-xs text-slate-500">{latestTrackerImport.name}</div>
              </Link>
            )}
            {!latestPendingReview && !latestReviewDecision && !latestTrackerImport && (
              <div className="text-sm text-slate-400">{loading ? 'Loading review activity...' : 'No review or tracker activity is available yet.'}</div>
            )}
          </div>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        <section className="panel-subtle">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="label">Package mismatches</div>
              <div className="mt-1 text-sm text-slate-400">Packages whose reconciliation no longer matches the underlying evidence bundle.</div>
            </div>
            <Link className="button-secondary" to="/assurance/packages">
              Open packages
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {mismatchedPackages.map((item) => (
              <Link
                key={item.id}
                className="block rounded-2xl border border-amber-300/15 bg-amber-400/[0.04] px-3 py-3 text-sm transition hover:border-amber-300/30"
                to={`/assurance/packages?packageId=${encodeURIComponent(item.id)}`}
              >
                <div className="font-medium text-white">{item.fileName}</div>
                <div className="mt-1 font-mono text-xs text-amber-200">{item.id}</div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                  <span>{humanizeKey(item.reconciliationStatus ?? 'mismatch')}</span>
                  <span>Validation {humanizeKey(item.validationStatus ?? 'unknown')}</span>
                  <span>{readNumber(item.coverage, 'gapCount')} gap(s)</span>
                  <span>{formatDate(item.updatedAt)}</span>
                </div>
              </Link>
            ))}
            {!loading && mismatchedPackages.length === 0 && (
              <div className="text-sm text-slate-400">No package mismatches are waiting right now.</div>
            )}
            {loading && <div className="text-sm text-slate-400">Loading package mismatches...</div>}
          </div>
        </section>

        <section className="panel-subtle">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="label">Validation drift</div>
              <div className="mt-1 text-sm text-slate-400">Packages whose validation contract, lineage, or report integrity checks still need assessor attention.</div>
            </div>
            <Link className="button-secondary" to="/assurance/packages">
              Open packages
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {validationDriftPackages.map((item) => (
              <Link
                key={item.id}
                className="block rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.04] px-3 py-3 text-sm transition hover:border-cyan-300/30"
                to={`/assurance/packages?packageId=${encodeURIComponent(item.id)}`}
              >
                <div className="font-medium text-white">{item.fileName}</div>
                <div className="mt-1 font-mono text-xs text-cyan-200">{item.id}</div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                  <span>{humanizeKey(item.validationStatus ?? 'unknown')}</span>
                  <span>{item.validationCheckCount ?? readNumber(item.coverage, 'validationCheckCount')} check(s)</span>
                  <span>{formatDate(item.updatedAt)}</span>
                </div>
              </Link>
            ))}
            {!loading && validationDriftPackages.length === 0 && (
              <div className="text-sm text-slate-400">No standalone validation-drift packages are waiting right now.</div>
            )}
            {loading && <div className="text-sm text-slate-400">Loading package validation drift...</div>}
          </div>
        </section>

        <section className="panel-subtle">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="label">Pending writebacks</div>
              <div className="mt-1 text-sm text-slate-400">Approval-gated external actions queued by the bounded assurance agent.</div>
            </div>
            <Link className="button-secondary" to="/assurance/agent-runs">
              Open agent runs
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {pendingWritebacks.map((item) => (
              <Link
                key={item.id}
                className="block rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.04] px-3 py-3 text-sm transition hover:border-cyan-300/30"
                to={`/assurance/agent-runs?runId=${encodeURIComponent(item.agentRunId)}&writebackId=${encodeURIComponent(item.id)}`}
              >
                <div className="font-medium text-white">
                  {item.connectorName ? `${item.connectorName} ${humanizeKey(item.requestType)}` : humanizeKey(item.requestType)}
                </div>
                <div className="mt-1 text-sm text-slate-300">{item.summary}</div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                  <span className="font-mono text-cyan-200">{item.id}</span>
                  <span>{item.evidenceRefCount} evidence ref(s)</span>
                  <span>{formatDate(item.createdAt)}</span>
                </div>
              </Link>
            ))}
            {!loading && pendingWritebacks.length === 0 && (
              <div className="text-sm text-slate-400">No pending writebacks are awaiting approval.</div>
            )}
            {loading && <div className="text-sm text-slate-400">Loading pending writebacks...</div>}
          </div>
        </section>

        <section className="panel-subtle">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="label">Tracker rows with errors</div>
              <div className="mt-1 text-sm text-slate-400">Imports that still have unresolved parse or classification issues before conversion.</div>
            </div>
            <Link className="button-secondary" to="/assurance/tracker">
              Open tracker
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {trackerImportsWithErrors.map((item) => (
              <Link
                key={item.id}
                className="block rounded-2xl border border-rose-300/15 bg-rose-400/[0.04] px-3 py-3 text-sm transition hover:border-rose-300/30"
                to={`/assurance/tracker?importId=${encodeURIComponent(item.id)}`}
              >
                <div className="font-medium text-white">{item.name}</div>
                <div className="mt-1 font-mono text-xs text-rose-200">{item.id}</div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                  <span>{item.errorCount} errored row(s)</span>
                  <span>{item.importedCount}/{item.rowCount} imported</span>
                  <span>{formatDate(item.updatedAt)}</span>
                </div>
              </Link>
            ))}
            {!loading && trackerImportsWithErrors.length === 0 && (
              <div className="text-sm text-slate-400">No tracker imports with row errors are waiting right now.</div>
            )}
            {loading && <div className="text-sm text-slate-400">Loading tracker exceptions...</div>}
          </div>
        </section>
      </section>

      <section className="panel-subtle">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="label">Recent assurance workflows</div>
            <div className="mt-1 text-sm text-slate-400">Recent evidence, tracker, package, review, and agent orchestration activity across your current scope.</div>
          </div>
          <button className="button-secondary" onClick={() => void loadOverview()} type="button">
            Refresh
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {workflowRuns.map((run) => (
            <Link
              key={run.runId}
              className="block rounded-2xl border border-white/8 bg-black/15 px-4 py-4 transition hover:border-cyan-300/20 hover:bg-cyan-400/[0.03]"
              to={run.route}
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium text-white">{run.title}</div>
                <span className="badge-neutral">{run.module}</span>
                <span className={workflowBadgeClass(run.status)}>{run.status}</span>
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-300">{run.detail}</div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                <span>{run.runType}</span>
                <span>{formatDate(run.createdAt)}</span>
                {run.sourceRecordId ? <span className="font-mono text-cyan-200">{run.sourceRecordId}</span> : null}
              </div>
            </Link>
          ))}
          {!loading && workflowRuns.length === 0 && (
            <div className="text-sm text-slate-400">No assurance workflow activity is available yet.</div>
          )}
          {loading && <div className="text-sm text-slate-400">Loading assurance workflow activity...</div>}
        </div>
      </section>
    </div>
  );
}
