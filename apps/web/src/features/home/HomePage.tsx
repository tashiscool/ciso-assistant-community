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
import { CoachMarksPanel, type CoachMarkItem } from '../../components/CoachMarksPanel';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { Skeleton } from '../../components/ui/skeleton';
import { cn } from '../../lib/utils';
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

function buildHomeCoachMarks(stage: HomeStage, access: ShellAccessProfile): { title: string; description: string; items: CoachMarkItem[] } {
  const allItems: Record<HomeStage, { title: string; description: string; items: CoachMarkItem[] }> = {
    setup: {
      title: 'Set up the workspace in the order the product expects.',
      description:
        'Regovise works best when domains, team access, governance sources, and the first assessment are established in sequence instead of as isolated admin chores.',
      items: [
        {
          id: 'setup-domains',
          eyebrow: 'Boundaries',
          title: 'Define domains first',
          body: 'Domains and access boundaries decide what every later page, review, and package is allowed to see.',
          route: '/workspace/domains',
          ctaLabel: 'Open domains',
        },
        {
          id: 'setup-team',
          eyebrow: 'People',
          title: 'Assign the operating team',
          body: 'Invite administrators, contributors, and portal users before loading too much content into the workspace.',
          route: '/workspace/team',
          ctaLabel: 'Open team',
        },
        {
          id: 'setup-frameworks',
          eyebrow: 'Sources',
          title: 'Load frameworks and controls',
          body: 'Frameworks give assessments, evidence mapping, and reports a common source of truth.',
          route: '/frameworks',
          ctaLabel: 'Open frameworks',
          tone: 'focus',
        },
        {
          id: 'setup-assessments',
          eyebrow: 'Launch',
          title: 'Start the first assessment',
          body: 'Once the foundations exist, assessments become the engine that creates evidence demand, review work, and package outputs.',
          route: '/assessments',
          ctaLabel: 'Open assessments',
        },
      ],
    },
    program: {
      title: 'Think in one operating loop, not separate modules.',
      description:
        'Program work in Regovise starts with frameworks and domains, runs through assessments and supporting records, and then feeds evidence and assurance work.',
      items: [
        {
          id: 'program-workspace',
          eyebrow: 'Program',
          title: 'This page is the operating layer',
          body: 'Use Program as the place to orient the governance program before you dive into a specific workbench.',
          route: '/program',
          ctaLabel: 'Stay here',
        },
        {
          id: 'program-assessments',
          eyebrow: 'Assessments',
          title: 'Assessments create the real work',
          body: 'Risk and compliance assessments are where the program turns frameworks and business context into concrete action.',
          route: '/assessments',
          ctaLabel: 'Open assessments',
          tone: 'focus',
        },
        {
          id: 'program-evidence',
          eyebrow: 'Evidence',
          title: 'Evidence is downstream of program work',
          body: 'Evidence and monitoring should support active assessments instead of being collected as an isolated archive.',
          route: '/evidence-management',
          ctaLabel: 'Open evidence',
        },
        {
          id: 'program-assurance',
          eyebrow: 'Outputs',
          title: 'Assurance packages are the final product',
          body: 'When the program is healthy, packages and reviews become the clean, shareable output of the system.',
          route: '/assurance',
          ctaLabel: 'Open assurance',
        },
      ],
    },
    assurance: {
      title: 'Assurance is a chain, not a report folder.',
      description:
        'The assurance side of Regovise is meant to move from evidence intake to deterministic checks, human review, packages, and bounded automation.',
      items: [
        {
          id: 'assurance-evidence',
          eyebrow: 'Evidence',
          title: 'Start with evidence intake',
          body: 'Evidence jobs and source artifacts are the grounded inputs that the rest of assurance depends on.',
          route: '/assurance/evidence',
          ctaLabel: 'Open evidence explorer',
        },
        {
          id: 'assurance-reviews',
          eyebrow: 'Review',
          title: 'Human review is part of the contract',
          body: 'Recommendations, approval gates, and review history are first-class, not afterthoughts.',
          route: '/assurance/reviews',
          ctaLabel: 'Open review queue',
          tone: 'focus',
        },
        {
          id: 'assurance-packages',
          eyebrow: 'Packages',
          title: 'Packages assemble the shareable output',
          body: '20x packages are where validation, reconciliation, lineage, and final report artifacts come together.',
          route: '/assurance/packages',
          ctaLabel: 'Open packages',
        },
        {
          id: 'assurance-agents',
          eyebrow: 'Automation',
          title: 'Agent runs stay bounded and reviewable',
          body: 'The automation layer is designed to explain itself and wait for approval instead of hiding decisions.',
          route: '/assurance/agent-runs',
          ctaLabel: 'Open agent runs',
        },
      ],
    },
    portal: {
      title: 'Portal users stay on the external collaboration path.',
      description:
        'The portal flow exists so outside contributors can respond to assigned work without navigating the broader program and assurance shell.',
      items: [
        {
          id: 'portal-assignments',
          eyebrow: 'Assignments',
          title: 'Start with assigned work',
          body: 'The portal is for responding to specific requests, not for browsing the full compliance workspace.',
          route: '/portal',
          ctaLabel: 'Open portal',
          tone: 'focus',
        },
        {
          id: 'portal-requests',
          eyebrow: 'Responses',
          title: 'Complete evidence requests in place',
          body: 'Keep external collaboration inside the portal flow instead of sending users into the admin shell.',
          route: '/portal',
          ctaLabel: 'Review assignments',
        },
        {
          id: 'portal-access',
          eyebrow: 'Identity',
          title: 'Use My Access if something looks wrong',
          body: 'If the wrong assignments or domains appear, check the current role and perimeter before escalating.',
          route: '/workspace/me',
          ctaLabel: 'Open My Access',
        },
      ],
    },
    workspace: {
      title: 'This account is intentionally scoped.',
      description:
        'Regovise is keeping the workspace intentionally narrow until the role expands. That keeps limited users focused on the few places they actually need.',
      items: [
        {
          id: 'workspace-access',
          eyebrow: 'Access',
          title: 'Check your current scope first',
          body: 'My Access explains the active roles, groups, and domains shaping what this account can see.',
          route: '/workspace/me',
          ctaLabel: 'Open My Access',
          tone: 'focus',
        },
      ],
    },
  };

  const coachMarks = allItems[stage];
  return {
    ...coachMarks,
    items: coachMarks.items.filter((item) => !item.route || canAccessShellRoute(item.route, access)),
  };
}

function toneClasses(tone: WorklistItem['tone']) {
  if (tone === 'complete') {
    return 'bg-emerald-400/10 text-emerald-300';
  }
  if (tone === 'active') {
    return 'bg-cyan-400/10 text-cyan-300';
  }
  return 'bg-amber-400/10 text-amber-300';
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
  const heroTitle =
    derived.stage === 'portal'
      ? 'Keep external collaboration moving from the right Regovise surface.'
      : derived.stage === 'workspace'
        ? 'Work from the Regovise areas assigned to this account.'
        : 'Run the complete compliance program from Regovise.';
  const hasCoreSnapshot = Boolean(data.core);
  const primaryMetric = access.canUsePortal && !hasAnyProgramArea(access)
    ? { label: 'Portal access', value: access.isAuditee ? 'Active' : 'Available', detail: 'This session is centered on external assignments and collaboration.' }
    : { label: 'Assessments', value: String(derived.assessmentCount), detail: 'Risk and compliance work already running in this tenant.' };
  const secondaryMetric = access.canUseAssurance
    ? {
        label: 'Assurance queue',
        value: String(derived.assuranceSignals),
        detail: 'Packages, pending reviews, and approval-gated assurance actions.',
      }
    : access.canUsePortal
      ? {
          label: 'Assigned surfaces',
          value: access.canUsePortal ? 'Portal' : 'Workspace',
          detail: 'The current account is focused on external collaboration and scoped workspace access.',
        }
      : {
          label: 'Current access',
          value: 'Scoped',
          detail: 'This account only sees the routes and records allowed by the current role assignments.',
        };

  const stageCardTone =
    derived.stage === 'assurance'
      ? 'bg-cyan-400/10 text-cyan-300'
      : derived.stage === 'program'
        ? 'bg-violet-400/10 text-violet-300'
        : 'bg-amber-400/10 text-amber-300';
  const coachMarks = buildHomeCoachMarks(derived.stage, access);

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="eyebrow">{derived.copy.eyebrow}</div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">
            {heroTitle}
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
                <span>{access.isWorkspaceAdmin && data.ops ? 'Setup progress' : 'Workspace maturity'}</span>
                <span>
                  {access.isWorkspaceAdmin && data.ops
                    ? `${derived.quickStartCompleted}/${data.ops.quickStart.length || 0}`
                    : `${derived.assessmentCount} active assessment${derived.assessmentCount === 1 ? '' : 's'}`}
                </span>
              </div>
              <Progress
                className="mt-3 h-2"
                value={access.isWorkspaceAdmin && data.ops ? derived.quickStartProgress : Math.min(100, derived.assuranceSignals > 0 ? 100 : 60)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{primaryMetric.label}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{primaryMetric.value}</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">
                  {primaryMetric.detail}
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{secondaryMetric.label}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{secondaryMetric.value}</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">
                  {secondaryMetric.detail}
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    {access.canUseAssurance ? 'Assurance package readiness' : 'Current access surface'}
                  </div>
                  <div className="mt-2 text-sm font-medium text-white">
                    {access.canUseAssurance
                      ? data.readiness?.source.packageFileName ??
                        (assurance.summary.packageCount > 0
                          ? `${assurance.summary.packageCount} package${assurance.summary.packageCount === 1 ? '' : 's'} assembled`
                          : 'No assurance package has been built yet')
                      : access.canUsePortal
                        ? 'This session is focused on portal-driven collaboration and assigned external work.'
                        : 'This session is limited to the workspace capabilities currently assigned to your account.'}
                  </div>
                </div>
                {access.canUseAssurance && data.readiness?.status ? (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]',
                      data.readiness.status === 'pass'
                        ? 'bg-emerald-400/10 text-emerald-300'
                        : data.readiness.status === 'attention'
                          ? 'bg-amber-400/10 text-amber-300'
                          : 'bg-rose-400/10 text-rose-300',
                    )}
                  >
                    {data.readiness.status}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 text-sm text-slate-400">
                {access.canUseAssurance
                  ? data.readiness?.source.packageRoute
                    ? 'The current evidence, review, and package chain is ready to inspect from one place.'
                    : 'Build an evidence-backed package to unlock review-ready assurance sharing from the Home surface.'
                  : access.canUsePortal
                    ? 'Open the auditee portal to respond to assigned work without exposing the broader workspace.'
                    : 'Use My Access to confirm the current role or request broader access when you need additional workspace areas.'}
              </div>
              {access.canUseAssurance && data.readiness?.source.packageRoute ? (
                <Link
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-300 transition hover:text-cyan-200"
                  to={data.readiness.source.packageRoute}
                >
                  Open current package
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>

      <CoachMarksPanel
        storageKey={`home-${derived.stage}`}
        title={coachMarks.title}
        description={coachMarks.description}
        items={coachMarks.items}
      />

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
                  : derived.stage === 'portal'
                    ? 'Portal focus'
                    : derived.stage === 'workspace'
                      ? 'Current access'
                      : 'Assurance attention queue'}
            </div>
            <CardTitle className="text-2xl text-white">
              {derived.stage === 'setup'
                ? 'Finish the few steps that unlock the rest of the platform.'
                : derived.stage === 'program'
                  ? 'Keep the program moving without losing the operating picture.'
                  : derived.stage === 'portal'
                    ? 'Move external assignments forward from the surfaces your role is meant to use.'
                    : derived.stage === 'workspace'
                      ? 'Start with your current access and expand only when the work calls for it.'
                      : 'Review the items most likely to block a package or approval flow.'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {derived.worklist.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-5 text-sm text-slate-400">
                No immediate items are queued here right now. Use the next recommended workspace to move into the right operating area for this role.
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
              <CardTitle className="text-xl text-white">
                {hasCoreSnapshot ? 'What is already active' : 'What this role is focused on'}
              </CardTitle>
            </CardHeader>
            {hasCoreSnapshot ? (
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Users className="h-4 w-4 text-cyan-300" />
                    Domains and access
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-white">{core.counts.domains}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {core.counts.users} team members and {core.counts.roleAssignments} assignments.
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <ShieldCheck className="h-4 w-4 text-cyan-300" />
                    Governance sources
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-white">{core.counts.frameworks}</div>
                  <div className="mt-1 text-xs text-slate-400">Frameworks ready to support policy and assessment work.</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Activity className="h-4 w-4 text-cyan-300" />
                    Monitoring activity
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-white">{core.counts.conMonExecutions}</div>
                  <div className="mt-1 text-xs text-slate-400">Continuous-monitoring runs already captured in the workspace.</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <FileOutput className="h-4 w-4 text-cyan-300" />
                    Evidence collection
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-white">{core.counts.evidenceJobs}</div>
                  <div className="mt-1 text-xs text-slate-400">Evidence jobs that can now feed review and package workflows.</div>
                </div>
              </CardContent>
            ) : (
              <CardContent className="space-y-3">
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm leading-6 text-slate-300">
                  {access.canUsePortal
                    ? 'This account is centered on portal collaboration and scoped external work rather than the broader program workspace.'
                    : 'This account currently has a narrower workspace role, so Regovise is only presenting the areas needed for the assigned work.'}
                </div>
              </CardContent>
            )}
          </Card>

          <Card className="border-white/10">
            <CardHeader className="pb-3">
              <div className="eyebrow">Useful next places</div>
              <CardTitle className="text-xl text-white">Jump straight to the right workspace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {nextPlaces.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-5 text-sm text-slate-400">
                  Open My Access to review the current role and request broader workspace capabilities if you need them.
                </div>
              ) : (
                nextPlaces.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.route}
                      className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                      to={item.route}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-cyan-300" />
                        {item.label}
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-500" />
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {access.isWorkspaceAdmin && data.readiness?.checks.some((check) => check.status !== 'pass') ? (
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
                {data.readiness.checks
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
      ) : null}
    </div>
  );
}
