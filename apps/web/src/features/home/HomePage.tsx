import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  FileOutput,
  Gauge,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { Skeleton } from '../../components/ui/skeleton';
import { cn } from '../../lib/utils';
import type { OpsParityOverview } from '../ops/useOpsParityOverview';
import type {
  AssuranceOverview,
  AssuranceOverviewPendingWriteback,
  AssuranceParityStatus,
  PackageListItem,
  ReviewRecommendation,
} from '../assurance/types';

const client = new ApiClient();

type CoreOverviewPayload = {
  tenantId: string;
  counts: {
    users: number;
    domains: number;
    roleAssignments: number;
    riskAssessments: number;
    complianceAssessments: number;
    frameworks: number;
    entities: number;
    processings: number;
    businessImpactAnalyses: number;
    conMonExecutions: number;
    evidenceJobs: number;
  };
};

type HomeStage = 'setup' | 'program' | 'assurance';

type HomeData = {
  core: CoreOverviewPayload;
  ops: OpsParityOverview;
  assurance: AssuranceOverview;
  parity: AssuranceParityStatus;
};

type WorklistItem = {
  id: string;
  title: string;
  detail: string;
  route: string;
  statusLabel: string;
  tone: 'active' | 'attention' | 'complete';
};

const STAGE_COPY: Record<
  HomeStage,
  {
    eyebrow: string;
    title: string;
    description: string;
    primaryAction: { label: string; route: string };
    secondaryAction: { label: string; route: string };
  }
> = {
  setup: {
    eyebrow: 'Start here',
    title: 'Stand up the foundation before the program spreads across the app.',
    description:
      'Define domains, permissions, governance sources, and the first working paths so Regovise becomes the system of record instead of another admin console.',
    primaryAction: { label: 'Finish guided setup', route: '/program/setup' },
    secondaryAction: { label: 'Open program workspace', route: '/program' },
  },
  program: {
    eyebrow: 'Program workspace',
    title: 'Run the operating program from one shared workspace.',
    description:
      'Move from setup into day-to-day assessments, third-party oversight, privacy, and resilience without jumping across disconnected tools.',
    primaryAction: { label: 'Open program workspace', route: '/program' },
    secondaryAction: { label: 'Open assessments', route: '/assessments' },
  },
  assurance: {
    eyebrow: 'Assurance command center',
    title: 'Collect evidence, review gaps, and publish assurance packages from one flow.',
    description:
      'Your workspace is active enough to lean on the evidence, monitoring, review, and package loops that replace a traditional RegScale-style assurance stack.',
    primaryAction: { label: 'Open assurance overview', route: '/assurance' },
    secondaryAction: { label: 'Open package explorer', route: '/assurance/packages' },
  },
};

const STAGE_LABELS: Record<HomeStage, string> = {
  setup: 'Guided setup',
  program: 'Program',
  assurance: 'Assurance',
};

function toneClasses(tone: WorklistItem['tone']) {
  if (tone === 'complete') {
    return 'bg-emerald-400/10 text-emerald-300';
  }
  if (tone === 'active') {
    return 'bg-cyan-400/10 text-cyan-300';
  }
  return 'bg-amber-400/10 text-amber-300';
}

function deriveStage(data: HomeData): HomeStage {
  const quickStartCompleted = data.ops.quickStart.filter((step) => step.completed).length;
  const quickStartThreshold = data.ops.quickStart.length > 0 ? Math.min(data.ops.quickStart.length, 3) : 0;
  const hasFoundation =
    data.core.counts.domains > 0 &&
    data.core.counts.users > 0 &&
    data.core.counts.roleAssignments > 0 &&
    data.core.counts.frameworks > 0;

  if (!hasFoundation || quickStartCompleted < quickStartThreshold) {
    return 'setup';
  }

  const assuranceSignals =
    data.assurance.summary.packageCount +
    data.assurance.summary.pendingReviewCount +
    data.assurance.summary.pendingWritebackCount +
    data.assurance.summary.agentRunCount +
    data.core.counts.evidenceJobs +
    data.core.counts.conMonExecutions;

  if (assuranceSignals > 0) {
    return 'assurance';
  }

  return 'program';
}

function buildAssuranceWorklist(
  pendingReviews: ReviewRecommendation[],
  pendingWritebacks: AssuranceOverviewPendingWriteback[],
  mismatchedPackages: PackageListItem[],
  validationDriftPackages: PackageListItem[],
): WorklistItem[] {
  const items: WorklistItem[] = [];

  for (const recommendation of pendingReviews.slice(0, 2)) {
    items.push({
      id: `review-${recommendation.id}`,
      title: recommendation.title,
      detail: recommendation.summary,
      route: `/assurance/reviews?recommendationId=${encodeURIComponent(recommendation.id)}`,
      statusLabel: 'Review needed',
      tone: 'attention',
    });
  }

  for (const writeback of pendingWritebacks.slice(0, 2)) {
    items.push({
      id: `writeback-${writeback.id}`,
      title: writeback.summary,
      detail: 'An external notification or ticket update is queued behind approval.',
      route: `/assurance/agent-runs?runId=${encodeURIComponent(writeback.agentRunId)}&writebackId=${encodeURIComponent(writeback.id)}`,
      statusLabel: 'Approval gate',
      tone: 'attention',
    });
  }

  for (const item of mismatchedPackages.slice(0, 1)) {
    items.push({
      id: `mismatch-${item.id}`,
      title: item.fileName,
      detail: 'The package currently has reconciliation differences that should be reviewed before sharing.',
      route: `/assurance/packages?packageId=${encodeURIComponent(item.id)}`,
      statusLabel: 'Mismatch',
      tone: 'attention',
    });
  }

  for (const item of validationDriftPackages.slice(0, 1)) {
    items.push({
      id: `validation-${item.id}`,
      title: item.fileName,
      detail: 'The package needs validation follow-up before it can be treated as cleanly ready.',
      route: `/assurance/packages?packageId=${encodeURIComponent(item.id)}`,
      statusLabel: 'Validation drift',
      tone: 'attention',
    });
  }

  return items.slice(0, 5);
}

export function HomePage() {
  const { identity } = useEdgeIdentity();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadHome() {
    try {
      setLoading(true);
      setError(null);

      const [coreResponse, opsResponse, assuranceResponse, parityResponse] = await Promise.all([
        client.get<{ data: CoreOverviewPayload }>('/core/overview'),
        client.get<{ data: OpsParityOverview }>('/ops/parity/overview'),
        client.get<{ data: AssuranceOverview }>('/assurance/overview'),
        client.get<{ data: AssuranceParityStatus }>('/assurance/parity/status'),
      ]);

      setData({
        core: coreResponse.data,
        ops: opsResponse.data,
        assurance: assuranceResponse.data,
        parity: parityResponse.data,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Home workspace could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHome();
  }, [identity.tenantId, identity.userId]);

  const derived = useMemo(() => {
    if (!data) {
      return null;
    }

    const stage = deriveStage(data);
    const copy = STAGE_COPY[stage];
    const quickStartCompleted = data.ops.quickStart.filter((step) => step.completed).length;
    const quickStartProgress =
      data.ops.quickStart.length > 0 ? (quickStartCompleted / data.ops.quickStart.length) * 100 : 100;
    const assessmentCount = data.core.counts.riskAssessments + data.core.counts.complianceAssessments;
    const assuranceSignals =
      data.assurance.summary.packageCount +
      data.assurance.summary.pendingReviewCount +
      data.assurance.summary.pendingWritebackCount;

    const journeyCards = [
      {
        id: 'setup',
        title: 'Guided setup',
        description:
          'Finish the foundation: domains, access, governance sources, and the first operator paths.',
        route: '/program/setup',
        metric: `${quickStartCompleted}/${data.ops.quickStart.length || 0}`,
        metricLabel: 'setup steps complete',
        tone:
          quickStartCompleted === data.ops.quickStart.length && data.ops.quickStart.length > 0
            ? 'complete'
            : stage === 'setup'
              ? 'active'
              : 'attention',
        statusLabel:
          quickStartCompleted === data.ops.quickStart.length && data.ops.quickStart.length > 0
            ? 'Ready'
            : stage === 'setup'
              ? 'Recommended now'
              : 'Keep tightening',
      },
      {
        id: 'program',
        title: 'Program operations',
        description:
          'Run assessments, privacy, third-party, resilience, and core governance work from one model.',
        route: '/program',
        metric: String(assessmentCount),
        metricLabel: 'active assessments',
        tone: assessmentCount > 0 ? 'complete' : stage === 'program' ? 'active' : 'attention',
        statusLabel: assessmentCount > 0 ? 'Running' : stage === 'program' ? 'Recommended now' : 'Next up',
      },
      {
        id: 'assurance',
        title: 'Assurance command center',
        description:
          'Collect evidence, review findings, manage approval gates, and assemble review-ready packages.',
        route: '/assurance',
        metric: String(data.assurance.summary.packageCount),
        metricLabel: 'packages assembled',
        tone: assuranceSignals > 0 ? 'complete' : stage === 'assurance' ? 'active' : 'attention',
        statusLabel:
          assuranceSignals > 0 ? 'Live' : stage === 'assurance' ? 'Recommended now' : 'Activate when ready',
      },
    ] as const;

    const setupWorklist: WorklistItem[] = data.ops.quickStart
      .filter((step) => !step.completed)
      .slice(0, 5)
      .map((step) => ({
        id: step.id,
        title: step.title,
        detail: step.detail,
        route: step.route,
        statusLabel: 'Pending',
        tone: 'attention',
      }));

    const programWorklist: WorklistItem[] = [
      {
        id: 'assessments',
        title: 'Assessments',
        detail: `${assessmentCount} risk and compliance assessments currently anchor the operating program.`,
        route: '/assessments',
        statusLabel: assessmentCount > 0 ? 'Active' : 'Ready to launch',
        tone: assessmentCount > 0 ? 'active' : 'attention',
      },
      {
        id: 'third-party',
        title: 'Third-party oversight',
        detail: `${data.core.counts.entities} entity records are available for vendor and supplier governance.`,
        route: '/third-party',
        statusLabel: data.core.counts.entities > 0 ? 'In use' : 'Ready to launch',
        tone: data.core.counts.entities > 0 ? 'active' : 'attention',
      },
      {
        id: 'privacy',
        title: 'Privacy operations',
        detail: `${data.core.counts.processings} processing records are tied back to the same workspace domains.`,
        route: '/privacy',
        statusLabel: data.core.counts.processings > 0 ? 'In use' : 'Available',
        tone: data.core.counts.processings > 0 ? 'active' : 'attention',
      },
      {
        id: 'resilience',
        title: 'Resilience planning',
        detail: `${data.core.counts.businessImpactAnalyses} continuity and impact-analysis records are available to the team.`,
        route: '/resilience',
        statusLabel: data.core.counts.businessImpactAnalyses > 0 ? 'In use' : 'Available',
        tone: data.core.counts.businessImpactAnalyses > 0 ? 'active' : 'attention',
      },
    ];

    const assuranceWorklist = buildAssuranceWorklist(
      data.assurance.pendingReviews,
      data.assurance.pendingWritebacks,
      data.assurance.mismatchedPackages,
      data.assurance.packagesWithValidationDrift,
    );

    return {
      stage,
      copy,
      quickStartCompleted,
      quickStartProgress,
      assessmentCount,
      assuranceSignals,
      journeyCards,
      worklist:
        stage === 'setup'
          ? setupWorklist
          : stage === 'program'
            ? programWorklist
            : assuranceWorklist,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="panel">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="mt-4 h-10 w-[28rem] rounded-2xl" />
          <Skeleton className="mt-4 h-20 w-full rounded-3xl" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <Card key={item} className="border-white/10">
              <CardContent className="p-6">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="mt-4 h-8 w-20 rounded-2xl" />
                <Skeleton className="mt-4 h-16 w-full rounded-3xl" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || !derived) {
    return <div className="notice-error">{error ?? 'Home workspace could not be loaded.'}</div>;
  }

  const stageCardTone =
    derived.stage === 'assurance'
      ? 'bg-cyan-400/10 text-cyan-300'
      : derived.stage === 'program'
        ? 'bg-violet-400/10 text-violet-300'
        : 'bg-amber-400/10 text-amber-300';

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="eyebrow">{derived.copy.eyebrow}</div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">
            Run the complete compliance program from Regovise.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{derived.copy.description}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="button-primary" to={derived.copy.primaryAction.route}>
              {derived.copy.primaryAction.label}
            </Link>
            <Link className="button-secondary" to={derived.copy.secondaryAction.route}>
              {derived.copy.secondaryAction.label}
            </Link>
            <button className="button-secondary" onClick={() => void loadHome()} type="button">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <Card className="border-white/10">
          <CardHeader className="pb-3">
            <div className="eyebrow">Recommended posture</div>
            <CardTitle className="flex items-center gap-3 text-xl text-white">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]',
                  stageCardTone,
                )}
              >
                {STAGE_LABELS[derived.stage]}
              </span>
              {derived.copy.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-0">
            <div>
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-500">
                <span>Setup progress</span>
                <span>
                  {derived.quickStartCompleted}/{data.ops.quickStart.length || 0}
                </span>
              </div>
              <Progress className="mt-3 h-2" value={derived.quickStartProgress} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Assessments</div>
                <div className="mt-2 text-2xl font-semibold text-white">{derived.assessmentCount}</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">
                  Risk and compliance work already running in this tenant.
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Assurance queue</div>
                <div className="mt-2 text-2xl font-semibold text-white">{derived.assuranceSignals}</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">
                  Packages, pending reviews, and approval-gated assurance actions.
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Assurance package readiness
                  </div>
                  <div className="mt-2 text-sm font-medium text-white">
                    {data.parity.source.packageFileName ?? 'No assurance package has been built yet'}
                  </div>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]',
                    data.parity.status === 'pass'
                      ? 'bg-emerald-400/10 text-emerald-300'
                      : data.parity.status === 'attention'
                        ? 'bg-amber-400/10 text-amber-300'
                        : 'bg-rose-400/10 text-rose-300',
                  )}
                >
                  {data.parity.status}
                </span>
              </div>
              <div className="mt-3 text-sm text-slate-400">
                {data.parity.source.packageRoute
                  ? 'The current evidence, package, and agent workflow chain is grounded enough to check end-to-end readiness from here.'
                  : 'Build an evidence-backed package to unlock end-to-end readiness checks directly from the Home surface.'}
              </div>
              {data.parity.source.packageRoute && (
                <Link
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-300 transition hover:text-cyan-200"
                  to={data.parity.source.packageRoute}
                >
                  Open current package
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {derived.journeyCards.map((card) => (
          <Link
            key={card.id}
            className="panel-subtle block transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
            to={card.route}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">{card.title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">{card.description}</div>
              </div>
              <span
                className={cn(
                  'inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]',
                  toneClasses(card.tone),
                )}
              >
                {card.statusLabel}
              </span>
            </div>
            <div className="mt-6 flex items-end justify-between gap-3">
              <div>
                <div className="text-3xl font-semibold text-white">{card.metric}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{card.metricLabel}</div>
              </div>
              <div className="inline-flex items-center gap-2 text-sm font-medium text-cyan-300">
                Open
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-white/10">
          <CardHeader>
            <div className="eyebrow">
              {derived.stage === 'setup'
                ? 'Immediate setup work'
                : derived.stage === 'program'
                  ? 'Program focus'
                  : 'Assurance attention queue'}
            </div>
            <CardTitle className="text-2xl text-white">
              {derived.stage === 'setup'
                ? 'Finish the few steps that unlock the rest of the platform.'
                : derived.stage === 'program'
                  ? 'Keep the program moving without losing the operating picture.'
                  : 'Review the items most likely to block a package or approval flow.'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {derived.worklist.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-5 text-sm text-slate-400">
                No immediate items are queued here right now. Use search or the program workspace to move into the next operating area.
              </div>
            ) : (
              derived.worklist.map((item) => (
                <Link
                  key={item.id}
                  className="block rounded-3xl border border-white/10 bg-slate-950/30 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                  to={item.route}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{item.title}</div>
                      <div className="mt-1 text-sm leading-6 text-slate-400">{item.detail}</div>
                    </div>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]',
                        toneClasses(item.tone),
                      )}
                    >
                      {item.statusLabel}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-white/10">
            <CardHeader className="pb-3">
              <div className="eyebrow">Workspace snapshot</div>
              <CardTitle className="text-xl text-white">What is already active</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Users className="h-4 w-4 text-cyan-300" />
                  Domains and access
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">{data.core.counts.domains}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {data.core.counts.users} team members and {data.core.counts.roleAssignments} assignments.
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <ShieldCheck className="h-4 w-4 text-cyan-300" />
                  Governance sources
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">{data.core.counts.frameworks}</div>
                <div className="mt-1 text-xs text-slate-400">Frameworks ready to support policy and assessment work.</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Activity className="h-4 w-4 text-cyan-300" />
                  Monitoring activity
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">{data.core.counts.conMonExecutions}</div>
                <div className="mt-1 text-xs text-slate-400">Continuous-monitoring runs already captured in the workspace.</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <FileOutput className="h-4 w-4 text-cyan-300" />
                  Evidence collection
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">{data.core.counts.evidenceJobs}</div>
                <div className="mt-1 text-xs text-slate-400">Evidence jobs that can now feed review and package workflows.</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10">
            <CardHeader className="pb-3">
              <div className="eyebrow">Useful next places</div>
              <CardTitle className="text-xl text-white">Jump straight to the right workspace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link
                className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                to="/search"
              >
                <span className="flex items-center gap-3">
                  <Search className="h-4 w-4 text-cyan-300" />
                  Search the workspace
                </span>
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </Link>
              <Link
                className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                to="/analytics"
              >
                <span className="flex items-center gap-3">
                  <Gauge className="h-4 w-4 text-cyan-300" />
                  Review workspace analytics
                </span>
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </Link>
              <Link
                className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                to="/features/regml"
              >
                <span className="flex items-center gap-3">
                  <Sparkles className="h-4 w-4 text-cyan-300" />
                  Use AI and automation tools
                </span>
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </Link>
              <Link
                className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                to="/assurance"
              >
                <span className="flex items-center gap-3">
                  <ClipboardCheck className="h-4 w-4 text-cyan-300" />
                  Open the assurance command center
                </span>
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {data.parity.checks.some((check) => check.status !== 'pass') && (
        <section className="panel-subtle">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-white">Assurance package readiness needs attention</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                The current package chain has open readiness checks. Review the flagged evidence, package, or agent work before treating it as fully share-ready.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.parity.checks
                  .filter((check) => check.status !== 'pass')
                  .slice(0, 6)
                  .map((check) => (
                    <Link
                      key={check.id}
                      className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                      to={check.route ?? '/assurance'}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-medium text-white">{check.title}</div>
                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]',
                            check.status === 'attention'
                              ? 'bg-amber-400/10 text-amber-300'
                              : 'bg-rose-400/10 text-rose-300',
                          )}
                        >
                          {check.status}
                        </span>
                      </div>
                      <div className="mt-3 text-sm leading-6 text-slate-400">{check.detail}</div>
                    </Link>
                  ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
