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
import {
  RegPageHeader,
  RegStatusPill,
  RegTableShell,
} from '../../components/regovise/PagePrimitives';
import { Progress } from '../../components/ui/progress';
import { Skeleton } from '../../components/ui/skeleton';
import { canAccessShellRoute, type ShellAccessProfile } from '../../shell/shellAccess';
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

type HomeStage = 'setup' | 'program' | 'assurance' | 'portal' | 'workspace';

type HomeData = {
  core: CoreOverviewPayload | null;
  ops: OpsParityOverview | null;
  assurance: AssuranceOverview | null;
  readiness: AssuranceParityStatus | null;
};

type HomePageProps = {
  access: ShellAccessProfile;
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
  portal: {
    eyebrow: 'External collaboration',
    title: 'Keep vendor and auditee work moving without exposing the wider workspace.',
    description:
      'Respond to external assignments, keep evidence requests moving, and work from the portal surface without needing the broader program console.',
    primaryAction: { label: 'Open auditee portal', route: '/portal' },
    secondaryAction: { label: 'Open my access', route: '/workspace/me' },
  },
  workspace: {
    eyebrow: 'Workspace access',
    title: 'Start from the surfaces your role is allowed to use.',
    description:
      'Regovise is keeping this session focused on the workspace capabilities currently assigned to your account.',
    primaryAction: { label: 'Open my access', route: '/workspace/me' },
    secondaryAction: { label: 'Refresh workspace', route: '/' },
  },
};

const STAGE_LABELS: Record<HomeStage, string> = {
  setup: 'Guided setup',
  program: 'Program',
  assurance: 'Assurance',
  portal: 'Portal',
  workspace: 'Workspace',
};

const EMPTY_CORE_OVERVIEW: CoreOverviewPayload = {
  tenantId: '',
  counts: {
    users: 0,
    domains: 0,
    roleAssignments: 0,
    riskAssessments: 0,
    complianceAssessments: 0,
    frameworks: 0,
    entities: 0,
    processings: 0,
    businessImpactAnalyses: 0,
    conMonExecutions: 0,
    evidenceJobs: 0,
  },
};

const EMPTY_ASSURANCE_OVERVIEW: AssuranceOverview = {
  summary: {
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
  },
  evidenceJobs: [],
  trackerImports: [],
  trackerImportsWithErrors: [],
  packages: [],
  parityReadyPackages: [],
  mismatchedPackages: [],
  packagesWithValidationDrift: [],
  pendingReviews: [],
  reviewHistory: [],
  agentRuns: [],
  pendingWritebacks: [],
  workflowRuns: [],
};

function statusTone(tone: WorklistItem['tone']): 'success' | 'info' | 'warning' {
  if (tone === 'complete') {
    return 'success';
  }
  if (tone === 'active') {
    return 'info';
  }
  return 'warning';
}

function hasAnyProgramArea(access: ShellAccessProfile): boolean {
  return (
    access.canUseProgramWorkspace ||
    access.canUseFrameworks ||
    access.canUseLibraries ||
    access.canUseAssessmentWorkspace ||
    access.canUseThirdParty ||
    access.canUsePrivacy ||
    access.canUseResilience ||
    access.canUseAdvancedRisk
  );
}

function deriveStage(data: HomeData, access: ShellAccessProfile): HomeStage {
  const core = data.core ?? EMPTY_CORE_OVERVIEW;
  const assurance = data.assurance ?? EMPTY_ASSURANCE_OVERVIEW;
  const quickStartCompleted = data.ops?.quickStart.filter((step) => step.completed).length ?? 0;
  const quickStartThreshold = data.ops && data.ops.quickStart.length > 0 ? Math.min(data.ops.quickStart.length, 3) : 0;
  const hasFoundation =
    core.counts.domains > 0 &&
    core.counts.users > 0 &&
    core.counts.roleAssignments > 0 &&
    core.counts.frameworks > 0;

  if (access.isWorkspaceAdmin && (!hasFoundation || quickStartCompleted < quickStartThreshold)) {
    return 'setup';
  }

  const assuranceSignals =
    assurance.summary.packageCount +
    assurance.summary.pendingReviewCount +
    assurance.summary.pendingWritebackCount +
    assurance.summary.agentRunCount +
    core.counts.evidenceJobs +
    core.counts.conMonExecutions;

  if (access.canUseAssurance && assuranceSignals > 0) {
    return 'assurance';
  }

  if (access.canUsePortal && !hasAnyProgramArea(access) && !access.canUseAssurance) {
    return 'portal';
  }

  if (hasAnyProgramArea(access)) {
    return 'program';
  }

  return 'workspace';
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

export function HomePage({ access }: HomePageProps) {
  const { identity } = useEdgeIdentity();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadHome() {
    try {
      setLoading(true);
      setError(null);

      const shouldLoadCore =
        access.isWorkspaceAdmin ||
        access.canUseFrameworks ||
        access.canUseRiskAssessments ||
        access.canUseThirdParty ||
        access.canUsePrivacy ||
        access.canUseResilience;
      const shouldLoadAssurance = access.canUseAssurance;

      const coreRequest = shouldLoadCore
        ? client.get<{ data: CoreOverviewPayload }>('/core/overview')
        : Promise.resolve(null);
      const assuranceRequest = shouldLoadAssurance
        ? client.get<{ data: AssuranceOverview }>('/assurance/overview')
        : Promise.resolve(null);
      const opsRequest = access.isWorkspaceAdmin
        ? client.get<{ data: OpsParityOverview }>('/ops/parity/overview')
        : Promise.resolve(null);
      const readinessRequest = access.isWorkspaceAdmin
        ? client.get<{ data: AssuranceParityStatus }>('/assurance/parity/status')
        : Promise.resolve(null);

      const [coreResponse, assuranceResponse, opsResponse, readinessResponse] = await Promise.all([
        coreRequest,
        assuranceRequest,
        opsRequest,
        readinessRequest,
      ]);

      setData({
        core: coreResponse?.data ?? null,
        ops: opsResponse?.data ?? null,
        assurance: assuranceResponse?.data ?? null,
        readiness: readinessResponse?.data ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Home workspace could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHome();
  }, [access.canUseAssurance, access.canUseFrameworks, access.canUsePrivacy, access.canUseResilience, access.canUseRiskAssessments, access.canUseThirdParty, access.isWorkspaceAdmin, identity.tenantId, identity.userId]);

  const derived = useMemo(() => {
    if (!data) {
      return null;
    }

    const core = data.core ?? EMPTY_CORE_OVERVIEW;
    const assurance = data.assurance ?? EMPTY_ASSURANCE_OVERVIEW;
    const stage = deriveStage(data, access);
    const copy = STAGE_COPY[stage];
    const quickStartCompleted = data.ops?.quickStart.filter((step) => step.completed).length ?? 0;
    const quickStartProgress =
      data.ops && data.ops.quickStart.length > 0 ? (quickStartCompleted / data.ops.quickStart.length) * 100 : 100;
    const assessmentCount = core.counts.riskAssessments + core.counts.complianceAssessments;
    const assuranceSignals =
      assurance.summary.packageCount +
      assurance.summary.pendingReviewCount +
      assurance.summary.pendingWritebackCount;

    const journeyCards = [
      {
        id: 'setup',
        title: 'Guided setup',
        description:
          'Finish the foundation: domains, access, governance sources, and the first working flows.',
        route: '/program/setup',
        metric: `${quickStartCompleted}/${data.ops?.quickStart.length || 0}`,
        metricLabel: 'setup steps complete',
        tone:
          quickStartCompleted === (data.ops?.quickStart.length ?? 0) && (data.ops?.quickStart.length ?? 0) > 0
            ? 'complete'
            : stage === 'setup'
              ? 'active'
              : 'attention',
        statusLabel:
          quickStartCompleted === (data.ops?.quickStart.length ?? 0) && (data.ops?.quickStart.length ?? 0) > 0
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
        metric: String(assurance.summary.packageCount),
        metricLabel: 'packages assembled',
        tone: assuranceSignals > 0 ? 'complete' : stage === 'assurance' ? 'active' : 'attention',
        statusLabel:
          assuranceSignals > 0 ? 'Live' : stage === 'assurance' ? 'Recommended now' : 'Activate when ready',
      },
      {
        id: 'portal',
        title: 'External portal',
        description:
          'Keep auditee and vendor follow-up moving from a portal surface that stays separate from the broader workspace.',
        route: '/portal',
        metric: access.isAuditee ? 'Assigned' : String(core.counts.frameworks),
        metricLabel: access.isAuditee ? 'portal role active' : 'framework-backed portal flows',
        tone: access.canUsePortal ? (stage === 'portal' ? 'active' : 'complete') : 'attention',
        statusLabel: access.canUsePortal ? (stage === 'portal' ? 'Recommended now' : 'Available') : 'Unavailable',
      },
    ] as const;

    const setupWorklist: WorklistItem[] = (data.ops?.quickStart ?? [])
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

    const programWorklist = [
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
        detail: `${core.counts.entities} entity records are available for vendor and supplier governance.`,
        route: '/third-party',
        statusLabel: core.counts.entities > 0 ? 'In use' : 'Ready to launch',
        tone: core.counts.entities > 0 ? 'active' : 'attention',
      },
      {
        id: 'privacy',
        title: 'Privacy operations',
        detail: `${core.counts.processings} processing records are tied back to the same workspace domains.`,
        route: '/privacy',
        statusLabel: core.counts.processings > 0 ? 'In use' : 'Available',
        tone: core.counts.processings > 0 ? 'active' : 'attention',
      },
      {
        id: 'resilience',
        title: 'Resilience planning',
        detail: `${core.counts.businessImpactAnalyses} continuity and impact-analysis records are available to the team.`,
        route: '/resilience',
        statusLabel: core.counts.businessImpactAnalyses > 0 ? 'In use' : 'Available',
        tone: core.counts.businessImpactAnalyses > 0 ? 'active' : 'attention',
      },
    ].filter((item) => {
      if (item.route === '/assessments') {
        return access.canUseAssessmentWorkspace;
      }
      if (item.route === '/third-party') {
        return access.canUseThirdParty;
      }
      if (item.route === '/privacy') {
        return access.canUsePrivacy;
      }
      if (item.route === '/resilience') {
        return access.canUseResilience;
      }
      return true;
    }) as WorklistItem[];

    const portalWorklist: WorklistItem[] = [
      {
        id: 'portal-dashboard',
        title: 'Open the auditee portal',
        detail: 'Review assigned questionnaires, evidence requests, and external follow-up from the portal surface.',
        route: '/portal',
        statusLabel: 'Available now',
        tone: 'active',
      },
      {
        id: 'my-access',
        title: 'Review your access',
        detail: 'Confirm the current workspace, role context, and session security for this account.',
        route: '/workspace/me',
        statusLabel: 'Account',
        tone: 'complete',
      },
    ];

    const assuranceWorklist = buildAssuranceWorklist(
      assurance.pendingReviews,
      assurance.pendingWritebacks,
      assurance.mismatchedPackages,
      assurance.packagesWithValidationDrift,
    );

    return {
      stage,
      copy,
      quickStartCompleted,
      quickStartProgress,
      assessmentCount,
      assuranceSignals,
      journeyCards: journeyCards.filter((card) => {
        if (card.id === 'setup') {
          return access.isWorkspaceAdmin;
        }
        if (card.id === 'program') {
          return hasAnyProgramArea(access);
        }
        if (card.id === 'assurance') {
          return access.canUseAssurance;
        }
        if (card.id === 'portal') {
          return access.canUsePortal;
        }
        return true;
      }),
      worklist:
        stage === 'setup'
          ? setupWorklist
          : stage === 'portal'
            ? portalWorklist
            : stage === 'workspace'
              ? portalWorklist.filter((item) => item.route === '/workspace/me')
              : stage === 'program'
                ? programWorklist
                : assuranceWorklist,
    };
  }, [access, data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-[#ded8e4] bg-white p-6">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="mt-4 h-9 w-full max-w-[28rem] rounded-md" />
          <Skeleton className="mt-4 h-16 w-full rounded-md" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div className="rounded-lg border border-[#ded8e4] bg-white p-5" key={item}>
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="mt-4 h-8 w-20 rounded-md" />
              <Skeleton className="mt-3 h-5 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || !derived) {
    return <div className="notice-error">{error ?? 'Home workspace could not be loaded.'}</div>;
  }

  const core = data.core ?? EMPTY_CORE_OVERVIEW;
  const assurance = data.assurance ?? EMPTY_ASSURANCE_OVERVIEW;
  const nextPlaces = [
    access.canUseSearch ? { route: '/search', label: 'Search the workspace', icon: Search } : null,
    access.canUseAnalytics ? { route: '/analytics', label: 'Review workspace analytics', icon: Gauge } : null,
    access.isWorkspaceAdmin ? { route: '/features/regml', label: 'Open AI authoring tools', icon: Sparkles } : null,
    access.canUseAssurance
      ? { route: '/assurance', label: 'Open the assurance command center', icon: ClipboardCheck }
      : access.canUsePortal
        ? { route: '/portal', label: 'Open the auditee portal', icon: ClipboardCheck }
        : null,
  ].filter(
    (item): item is { route: string; label: string; icon: typeof Search } => Boolean(item),
  );
  const workQueueAvailable = canAccessShellRoute('/tasks', access);
  const primaryAction = workQueueAvailable
    ? { label: 'Open Work Queue', route: '/tasks' }
    : derived.copy.primaryAction;
  const secondaryAction =
    primaryAction.route === derived.copy.primaryAction.route
      ? derived.copy.secondaryAction
      : derived.copy.primaryAction;
  const stageTone =
    derived.stage === 'assurance'
      ? 'info'
      : derived.stage === 'program' || derived.stage === 'portal'
        ? 'purple'
        : 'warning';
  const readinessTone =
    data.readiness?.status === 'pass'
      ? 'success'
      : data.readiness?.status === 'attention'
        ? 'warning'
        : 'danger';
  const isPortalOnly = access.canUsePortal && !hasAnyProgramArea(access) && !access.canUseAssurance;
  const summaryMetrics = isPortalOnly
    ? [
        {
          label: 'Portal access',
          value: access.isAuditee ? 'Active' : 'Available',
          detail: 'External assignments and collaboration',
          icon: Users,
        },
        {
          label: 'Priority work',
          value: String(derived.worklist.length),
          detail: 'Items available to this role',
          icon: Activity,
        },
        {
          label: 'Workspace scope',
          value: 'Scoped',
          detail: 'Permission-aware route access',
          icon: ShieldCheck,
        },
        {
          label: 'Available areas',
          value: String(derived.journeyCards.length),
          detail: 'Product areas assigned to this account',
          icon: ClipboardCheck,
        },
      ]
    : [
        {
          label: 'Assessments',
          value: String(derived.assessmentCount),
          detail: 'Risk and compliance assessments',
          icon: ClipboardCheck,
        },
        {
          label: 'Priority work',
          value: String(derived.worklist.length),
          detail: 'Items needing the next action',
          icon: Activity,
        },
        {
          label: 'Evidence jobs',
          value: String(core.counts.evidenceJobs),
          detail: 'Collection jobs in the workspace',
          icon: FileOutput,
        },
        {
          label: 'Assurance queue',
          value: String(derived.assuranceSignals),
          detail: 'Packages, reviews, and writebacks',
          icon: ShieldCheck,
        },
      ];
  const progressValue =
    access.isWorkspaceAdmin && data.ops
      ? derived.quickStartProgress
      : Math.min(100, derived.assuranceSignals > 0 ? 100 : derived.assessmentCount > 0 ? 65 : 25);
  const progressLabel =
    access.isWorkspaceAdmin && data.ops
      ? `${derived.quickStartCompleted}/${data.ops.quickStart.length || 0} setup steps complete`
      : `${derived.assessmentCount} active assessment${derived.assessmentCount === 1 ? '' : 's'}`;

  return (
    <div className="space-y-6">
      <RegPageHeader
        actions={
          <>
            <Link className="button-primary justify-center" to={primaryAction.route}>
              {primaryAction.label}
            </Link>
            <Link className="button-secondary justify-center" to={secondaryAction.route}>
              {secondaryAction.label}
            </Link>
            <button className="button-secondary justify-center" onClick={() => void loadHome()} type="button">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
          </>
        }
        className="rounded-lg border border-[#ded8e4]"
        description={derived.copy.description}
        eyebrow="Home"
        meta={
          <>
            <RegStatusPill tone={stageTone}>{STAGE_LABELS[derived.stage]}</RegStatusPill>
            <span>{progressLabel}</span>
          </>
        }
        title="Program health"
      />

      <section aria-label="Program health summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div className="rounded-lg border border-[#ded8e4] bg-white p-5" key={metric.label}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[#4f435c]">{metric.label}</span>
                <Icon className="h-4 w-4 text-[#6f20c9]" />
              </div>
              <div className="mt-3 text-2xl font-semibold text-[#241232]">{metric.value}</div>
              <p className="mt-1 text-xs leading-5 text-[#6f6578]">{metric.detail}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <RegTableShell>
          <div className="border-b border-[#ded8e4] px-5 py-4">
            <div className="eyebrow">
              {derived.stage === 'setup'
                ? 'Immediate setup work'
                : derived.stage === 'assurance'
                  ? 'Assurance attention queue'
                  : 'Priority work'}
            </div>
            <h2 className="mt-1 text-lg font-semibold text-[#241232]">What needs attention next</h2>
          </div>
          <div className="divide-y divide-[#ded8e4]">
            {derived.worklist.length === 0 ? (
              <div className="px-5 py-8 text-sm text-[#6f6578]">
                No immediate items are queued. Open the recommended workspace to continue the program.
              </div>
            ) : (
              derived.worklist.map((item) => (
                <Link
                  className="flex flex-col gap-3 px-5 py-4 transition hover:bg-[#f7f2ff] sm:flex-row sm:items-start sm:justify-between"
                  key={item.id}
                  to={item.route}
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-[#241232]">{item.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-[#6f6578]">{item.detail}</span>
                  </span>
                  <RegStatusPill className="shrink-0 self-start" tone={statusTone(item.tone)}>
                    {item.statusLabel}
                  </RegStatusPill>
                </Link>
              ))
            )}
          </div>
          {workQueueAvailable ? (
            <div className="border-t border-[#ded8e4] bg-[#fbf9fc] px-5 py-3">
              <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#6f20c9]" to="/tasks">
                Open full Work Queue
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : null}
        </RegTableShell>

        <div className="space-y-4">
          <section className="rounded-lg border border-[#ded8e4] bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="eyebrow">Current posture</div>
                <h2 className="mt-1 text-lg font-semibold text-[#241232]">{derived.copy.title}</h2>
              </div>
              {access.canUseAssurance && data.readiness?.status ? (
                <RegStatusPill tone={readinessTone}>{data.readiness.status}</RegStatusPill>
              ) : null}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 text-xs font-medium text-[#62576a]">
              <span>{access.isWorkspaceAdmin && data.ops ? 'Setup progress' : 'Program maturity'}</span>
              <span>{progressLabel}</span>
            </div>
            <Progress className="mt-3 h-2" value={progressValue} />
            <div className="mt-5 border-t border-[#ded8e4] pt-4">
              <div className="text-xs font-semibold uppercase text-[#62576a]">Current package</div>
              <div className="mt-2 text-sm font-medium text-[#241232]">
                {data.readiness?.source.packageFileName ??
                  (assurance.summary.packageCount > 0
                    ? `${assurance.summary.packageCount} package${assurance.summary.packageCount === 1 ? '' : 's'} assembled`
                    : access.canUseAssurance
                      ? 'No assurance package assembled yet'
                      : 'Not available for this role')}
              </div>
              {data.readiness?.source.packageRoute ? (
                <Link
                  className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#6f20c9]"
                  to={data.readiness.source.packageRoute}
                >
                  Review package
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-[#ded8e4] bg-white p-5">
            <div className="eyebrow">Quick links</div>
            <h2 className="mt-1 text-lg font-semibold text-[#241232]">Jump to a workspace</h2>
            <div className="mt-3 divide-y divide-[#ded8e4]">
              {nextPlaces.length === 0 ? (
                <Link className="flex min-h-11 items-center justify-between text-sm text-[#4f435c]" to="/workspace/me">
                  Review My Access
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                nextPlaces.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm text-[#4f435c] hover:text-[#241232]"
                      key={item.route}
                      to={item.route}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0 text-[#6f20c9]" />
                        <span>{item.label}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[#62576a]" />
                    </Link>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <div className="eyebrow">Program areas</div>
          <h2 className="mt-1 text-lg font-semibold text-[#241232]">Work across the program without losing context</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {derived.journeyCards.map((card) => (
          <Link
            key={card.id}
            className="flex min-h-[11rem] flex-col justify-between rounded-lg border border-[#ded8e4] bg-white p-5 transition hover:border-[#b891f2] hover:bg-[#f7f2ff]"
            to={card.route}
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="text-base font-semibold text-[#241232]">{card.title}</div>
                <RegStatusPill className="shrink-0" tone={statusTone(card.tone)}>
                  {card.statusLabel}
                </RegStatusPill>
              </div>
              <div className="mt-2 text-sm leading-6 text-[#4f435c]">{card.description}</div>
            </div>
            <div className="mt-5 flex items-end justify-between gap-3 border-t border-[#ded8e4] pt-4">
              <div>
                <div className="text-xl font-semibold text-[#241232]">{card.metric}</div>
                <div className="mt-1 text-xs text-[#62576a]">{card.metricLabel}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#6f20c9]" />
            </div>
          </Link>
        ))}
        </div>
      </section>

      {access.isWorkspaceAdmin && data.readiness?.checks.some((check) => check.status !== 'pass') ? (
        <RegTableShell>
          <div className="flex items-start gap-3 border-b border-[#ded8e4] px-5 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#8a4d00]" />
            <div>
              <h2 className="text-lg font-semibold text-[#241232]">Assurance package readiness needs attention</h2>
              <p className="mt-1 text-sm leading-6 text-[#6f6578]">
                Review open deterministic checks before treating the package as share-ready.
              </p>
            </div>
          </div>
          <div className="divide-y divide-[#ded8e4]">
            {data.readiness.checks
              .filter((check) => check.status !== 'pass')
              .slice(0, 6)
              .map((check) => (
                <Link
                  className="flex flex-col gap-3 px-5 py-4 hover:bg-[#f7f2ff] sm:flex-row sm:items-start sm:justify-between"
                  key={check.id}
                  to={check.route ?? '/assurance'}
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-[#241232]">{check.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-[#6f6578]">{check.detail}</span>
                  </span>
                  <RegStatusPill tone={check.status === 'attention' ? 'warning' : 'danger'}>
                    {check.status}
                  </RegStatusPill>
                </Link>
              ))}
          </div>
        </RegTableShell>
      ) : null}
    </div>
  );
}
