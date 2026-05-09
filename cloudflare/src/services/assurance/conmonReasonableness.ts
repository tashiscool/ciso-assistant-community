import type {
  AssuranceEvalStatus,
  EvaluationArtifacts,
  NormalizedEvidenceBundle,
  ReasonablenessFinding,
  ReconciliationSummary,
} from './types';

export type ConMonObligationAssessment = {
  obligationId: string;
  title: string;
  cadence: string;
  controls: string[];
  matchedEvidenceRefs: string[];
  coverage: 'reasonable' | 'partial' | 'missing';
  reasonablenessGaps: string[];
};

export type ConMonReasonablenessArtifact = {
  generatedAt: string;
  profileId: string;
  profileName: string;
  activityId: string;
  activityName: string;
  cadence: string;
  theme: string | null;
  controlRef: string | null;
  linkedEvidenceJobId: string | null;
  linkedPackageJobId: string | null;
  summary: {
    obligations: number;
    reasonable: number;
    partial: number;
    missing: number;
    evidenceAgeDays: number | null;
  };
  obligationAssessments: ConMonObligationAssessment[];
  findings: ReasonablenessFinding[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function ageInDays(timestamp: string | null | undefined): number | null {
  if (!timestamp) {
    return null;
  }
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return Math.max(0, Math.floor((Date.now() - parsed) / (24 * 60 * 60 * 1000)));
}

function evalStatus(
  artifacts: EvaluationArtifacts,
  evalCode: string,
): AssuranceEvalStatus | null {
  return artifacts.evalResults.find((item) => item.evalCode === evalCode)?.status ?? null;
}

function coverageFromStatus(status: AssuranceEvalStatus | null): 'reasonable' | 'partial' | 'missing' {
  if (status === 'PASS') {
    return 'reasonable';
  }
  if (status === 'PARTIAL') {
    return 'partial';
  }
  return 'missing';
}

function obligation(
  args: {
    obligationId: string;
    title: string;
    cadence: string;
    controls: string[];
    evidenceRefs: string[];
    status: AssuranceEvalStatus | null;
    gaps: string[];
  },
): ConMonObligationAssessment {
  return {
    obligationId: args.obligationId,
    title: args.title,
    cadence: args.cadence,
    controls: args.controls,
    matchedEvidenceRefs: args.evidenceRefs,
    coverage: coverageFromStatus(args.status),
    reasonablenessGaps: args.gaps,
  };
}

export function buildConMonReasonablenessArtifact(args: {
  profileId: string;
  profileName: string;
  activityId: string;
  activityName: string;
  cadence: string;
  theme: string | null;
  controlRef: string | null;
  bundle: NormalizedEvidenceBundle | null;
  artifacts: EvaluationArtifacts | null;
  packageJobId: string | null;
  reconciliation: ReconciliationSummary | null;
  reviewBacklogCount: number;
}): ConMonReasonablenessArtifact {
  const evidenceAgeDays = args.bundle ? ageInDays(args.bundle.collectedAt) : null;
  const obligations: ConMonObligationAssessment[] = [];

  if (!args.bundle || !args.artifacts) {
    const finding: ReasonablenessFinding = {
      id: crypto.randomUUID(),
      title: 'No current assurance bundle is linked to this ConMon run',
      status: 'FAIL',
      detail: 'Run a fresh evidence collection and deterministic assurance evaluation before using this ConMon execution for reviewer decisions.',
    };
    return {
      generatedAt: nowIso(),
      profileId: args.profileId,
      profileName: args.profileName,
      activityId: args.activityId,
      activityName: args.activityName,
      cadence: args.cadence,
      theme: args.theme,
      controlRef: args.controlRef,
      linkedEvidenceJobId: null,
      linkedPackageJobId: args.packageJobId,
      summary: {
        obligations: 0,
        reasonable: 0,
        partial: 0,
        missing: 1,
        evidenceAgeDays,
      },
      obligationAssessments: [],
      findings: [finding],
    };
  }

  obligations.push(
    obligation({
      obligationId: 'inventory_reconciliation',
      title: 'Inventory stays reconciled to discovered in-boundary assets',
      cadence: 'monthly',
      controls: ['CM-8'],
      evidenceRefs: ['CM8_INVENTORY_RECONCILIATION'],
      status: evalStatus(args.artifacts, 'CM8_INVENTORY_RECONCILIATION'),
      gaps: args.artifacts.gaps
        .filter((item) => item.gapType === 'inventory_missing_discovery_match' || item.gapType === 'rogue_discovered_asset')
        .map((item) => item.title),
    }),
  );

  obligations.push(
    obligation({
      obligationId: 'scanner_scope',
      title: 'Scanner coverage remains aligned to in-boundary assets',
      cadence: 'weekly',
      controls: ['RA-5'],
      evidenceRefs: ['RA5_SCANNER_SCOPE_COVERAGE'],
      status: evalStatus(args.artifacts, 'RA5_SCANNER_SCOPE_COVERAGE'),
      gaps: args.artifacts.gaps
        .filter((item) => item.gapType === 'missing_scanner_target')
        .map((item) => item.title),
    }),
  );

  obligations.push(
    obligation({
      obligationId: 'central_logging',
      title: 'Centralized logging remains active and recent',
      cadence: 'daily',
      controls: ['AU-6', 'CA-7'],
      evidenceRefs: ['AU6_CENTRALIZED_LOG_COVERAGE', 'CA7_CONMON_REASONABLENESS'],
      status: evalStatus(args.artifacts, 'AU6_CENTRALIZED_LOG_COVERAGE'),
      gaps: [
        ...args.artifacts.gaps
          .filter((item) => item.gapType === 'missing_central_logging')
          .map((item) => item.title),
        ...args.artifacts.reasonablenessFindings.map((item) => item.title),
      ],
    }),
  );

  obligations.push(
    obligation({
      obligationId: 'alerting',
      title: 'Observed risks retain alert and workflow coverage',
      cadence: 'daily',
      controls: ['SI-4'],
      evidenceRefs: ['SI4_ALERT_INSTRUMENTATION'],
      status: evalStatus(args.artifacts, 'SI4_ALERT_INSTRUMENTATION'),
      gaps: args.artifacts.gaps
        .filter((item) => item.gapType === 'missing_alert_rule')
        .map((item) => item.title),
    }),
  );

  obligations.push(
    obligation({
      obligationId: 'change_ticket_governance',
      title: 'High-severity findings retain a complete change and ticket chain',
      cadence: 'weekly',
      controls: ['CM-3', 'SI-2'],
      evidenceRefs: ['CM3_CHANGE_TICKET_LINKAGE', 'RA5_EXPLOITATION_REVIEW'],
      status: evalStatus(args.artifacts, 'CM3_CHANGE_TICKET_LINKAGE'),
      gaps: args.artifacts.gaps
        .filter((item) => item.gapType === 'change_ticket_linkage_missing' || item.gapType === 'exploitation_review_missing')
        .map((item) => item.title),
    }),
  );

  obligations.push({
    obligationId: 'package_reconciliation',
    title: 'The current package reconciles machine-readable and rendered outputs',
    cadence: args.cadence,
    controls: ['F20X'],
    matchedEvidenceRefs: args.packageJobId ? [args.packageJobId] : [],
    coverage:
      args.reconciliation?.status === 'matched'
        ? 'reasonable'
        : args.reconciliation
          ? 'partial'
          : 'missing',
    reasonablenessGaps:
      args.reconciliation?.checks
        .filter((item) => item.status === 'mismatch')
        .map((item) => `${item.id} mismatch`) ?? (args.packageJobId ? ['Reconciliation artifact is missing.'] : ['No linked package job was found.']),
  });

  obligations.push({
    obligationId: 'human_review',
    title: 'Human review backlog remains governable for current evidence',
    cadence: 'weekly',
    controls: ['CA-5'],
    matchedEvidenceRefs: ['review_queue'],
    coverage: args.reviewBacklogCount === 0 ? 'reasonable' : args.reviewBacklogCount <= 5 ? 'partial' : 'missing',
    reasonablenessGaps:
      args.reviewBacklogCount === 0
        ? []
        : [`${args.reviewBacklogCount} pending review recommendation(s) remain open.`],
  });

  if (evidenceAgeDays !== null && evidenceAgeDays > 30) {
    obligations.push({
      obligationId: 'evidence_freshness',
      title: 'Evidence age remains within the declared ConMon cadence window',
      cadence: args.cadence,
      controls: ['CA-7'],
      matchedEvidenceRefs: [args.bundle.collectedAt],
      coverage: evidenceAgeDays <= 30 ? 'reasonable' : evidenceAgeDays <= 60 ? 'partial' : 'missing',
      reasonablenessGaps:
        evidenceAgeDays <= 30
          ? []
          : [`The linked assurance bundle is ${evidenceAgeDays} day(s) old and should be refreshed.`],
    });
  }

  const findings: ReasonablenessFinding[] = obligations
    .filter((item) => item.coverage !== 'reasonable')
    .map((item) => ({
      id: crypto.randomUUID(),
      title: item.title,
      status: item.coverage === 'partial' ? 'PARTIAL' : 'FAIL',
      detail:
        item.reasonablenessGaps.length > 0
          ? item.reasonablenessGaps.join(' ')
          : `Coverage for ${item.title} is ${item.coverage}.`,
      cadence: item.cadence,
      coverage: item.coverage,
      controlRefs: item.controls,
      matchedObjectIds: item.matchedEvidenceRefs,
    }));

  return {
    generatedAt: nowIso(),
    profileId: args.profileId,
    profileName: args.profileName,
    activityId: args.activityId,
    activityName: args.activityName,
    cadence: args.cadence,
    theme: args.theme,
    controlRef: args.controlRef,
    linkedEvidenceJobId: args.artifacts.summary.evidenceJobId,
    linkedPackageJobId: args.packageJobId,
    summary: {
      obligations: obligations.length,
      reasonable: obligations.filter((item) => item.coverage === 'reasonable').length,
      partial: obligations.filter((item) => item.coverage === 'partial').length,
      missing: obligations.filter((item) => item.coverage === 'missing').length,
      evidenceAgeDays,
    },
    obligationAssessments: obligations,
    findings,
  };
}

export function summarizeConMonMetrics(artifact: ConMonReasonablenessArtifact): Record<string, number> {
  return {
    obligations: artifact.summary.obligations,
    reasonable: artifact.summary.reasonable,
    partial: artifact.summary.partial,
    missing: artifact.summary.missing,
    open_findings: artifact.findings.length,
  };
}
