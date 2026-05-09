import type {
  AssessmentSummary,
  AssuranceSeverity,
  EvalResult,
  EvaluationArtifacts,
  EvidenceGap,
  NormalizedEvidenceBundle,
  PoamItem,
  ReconciliationSummary,
  TwentyXPackageSummary,
} from './types';

export type AssuranceValidationStatus = 'pass' | 'warn' | 'fail';

export type AssuranceValidationCheck = {
  id: string;
  title: string;
  status: AssuranceValidationStatus;
  detail: string;
  evidenceRefs: string[];
};

export type AssuranceValidationReport = {
  scope: 'evidence' | 'package';
  status: AssuranceValidationStatus;
  summary: string;
  generatedAt: string;
  checks: AssuranceValidationCheck[];
};

export type EvidenceGapMatrixRow = {
  gap_id: string;
  eval_code: string;
  title: string;
  severity: AssuranceSeverity;
  control_refs: string;
  ksi_refs: string;
  recommended_artifact: string;
  current_state: string;
  target_state: string;
  priority: string;
  estimated_effort: string;
  remediation_steps: string;
  poam_required: string;
};

type PackageFindingRecord = Record<string, unknown>;
type PackagePoamRecord = Record<string, unknown>;
type PackageDocument = Record<string, unknown>;

const REQUIRED_EVAL_CODES = [
  'CM8_INVENTORY_RECONCILIATION',
  'RA5_SCANNER_SCOPE_COVERAGE',
  'AU6_CENTRALIZED_LOG_COVERAGE',
  'AU6_LOCAL_TO_CENTRAL_CORRELATION',
  'SI4_ALERT_INSTRUMENTATION',
  'CM3_CHANGE_TICKET_LINKAGE',
  'RA5_EXPLOITATION_REVIEW',
  'CA7_CONMON_REASONABLENESS',
  'SC7_PUBLIC_EXPOSURE_POLICY',
  'F20X_KSI_ROLLUP',
] as const;

const REQUIRED_EVIDENCE_ARTIFACTS = [
  'normalized_bundle',
  'assessment_summary',
  'eval_results',
  'evidence_gaps',
  'poam_items',
  'evidence_graph',
  'correlations',
  'reasonableness_findings',
  'correlation_report',
  'auditor_questions',
  'instrumentation_plan',
  'evidence_gap_matrix',
  'validation_report',
] as const;

type EvidenceArtifactReference =
  | (typeof REQUIRED_EVIDENCE_ARTIFACTS)[number]
  | 'threat_hunt_findings'
  | 'threat_hunt_timeline'
  | 'threat_hunt_queries';

const REQUIRED_PACKAGE_ROLES = ['assessor', 'executive', 'ao', 'assessor_poam_md'] as const;
const REQUIRED_PACKAGE_EVIDENCE_LINKS = [
  'assessment_summary',
  'eval_results',
  'evidence_gaps',
  'poam_items',
  'correlation_report',
  'auditor_questions',
  'instrumentation_plan',
  'evidence_gap_matrix',
  'reasonableness_findings',
  'validation_report',
  'threat_hunt_findings',
  'threat_hunt_timeline',
] as const;

type PackageEvidenceLinkReference =
  | (typeof REQUIRED_PACKAGE_EVIDENCE_LINKS)[number]
  | 'threat_hunt_queries'
  | 'agent_eval_results'
  | 'agent_risk_report'
  | 'agent_poam'
  | 'agent_instrumentation_plan'
  | 'secure_agent_architecture';

function requiredEvidenceArtifacts(bundleKind: string): EvidenceArtifactReference[] {
  const requiredArtifacts: EvidenceArtifactReference[] = [...REQUIRED_EVIDENCE_ARTIFACTS];
  if (bundleKind === 'threat-hunt') {
    requiredArtifacts.push('threat_hunt_findings', 'threat_hunt_timeline', 'threat_hunt_queries');
  }
  return requiredArtifacts;
}

function packageBundleKind(document: PackageDocument): string {
  const metadata =
    document.metadata && typeof document.metadata === 'object'
      ? (document.metadata as Record<string, unknown>)
      : {};
  return nonEmptyString(metadata.bundle_kind) ?? 'assessment';
}

function packageHasAgentSecurity(document: PackageDocument): boolean {
  const metadata =
    document.metadata && typeof document.metadata === 'object'
      ? (document.metadata as Record<string, unknown>)
      : {};
  return Boolean(nonEmptyString(metadata.agent_run_id));
}

function requiredPackageEvidenceLinks(
  bundleKind: string,
  includeAgentSecurity = false,
): PackageEvidenceLinkReference[] {
  const requiredLinks: PackageEvidenceLinkReference[] = [...REQUIRED_PACKAGE_EVIDENCE_LINKS];
  if (bundleKind === 'threat-hunt') {
    requiredLinks.push('threat_hunt_queries');
  }
  if (includeAgentSecurity) {
    requiredLinks.push(
      'agent_eval_results',
      'agent_risk_report',
      'agent_poam',
      'agent_instrumentation_plan',
      'secure_agent_architecture',
    );
  }
  return requiredLinks;
}

function nowIso(): string {
  return new Date().toISOString();
}

function statusRank(status: AssuranceValidationStatus): number {
  switch (status) {
    case 'fail':
      return 3;
    case 'warn':
      return 2;
    default:
      return 1;
  }
}

function mergeStatuses(checks: AssuranceValidationCheck[]): AssuranceValidationStatus {
  if (checks.some((item) => item.status === 'fail')) {
    return 'fail';
  }
  if (checks.some((item) => item.status === 'warn')) {
    return 'warn';
  }
  return 'pass';
}

export function severityPriority(severity: AssuranceSeverity): string {
  switch (severity) {
    case 'critical':
      return 'P1';
    case 'high':
      return 'P2';
    case 'moderate':
      return 'P3';
    case 'low':
      return 'P4';
  }
}

export function severityEffort(severity: AssuranceSeverity): string {
  switch (severity) {
    case 'critical':
      return 'large';
    case 'high':
      return 'medium';
    case 'moderate':
      return 'medium';
    case 'low':
      return 'small';
  }
}

function recommendedTargetState(gap: EvidenceGap): string {
  const artifact = gap.recommendedArtifact?.trim() || 'supporting evidence';
  return `Provide ${artifact}, document closure evidence, and re-run deterministic assurance validation.`;
}

export function remediationSteps(detail: string, recommendedArtifact: string | null): string[] {
  const baseSteps = detail
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (recommendedArtifact?.trim()) {
    baseSteps.push(`Attach ${recommendedArtifact.trim()} to the package and update the linked POA&M item.`);
  }
  if (baseSteps.length === 0) {
    baseSteps.push('Collect the missing evidence, update the linked record, and rerun the assurance evaluation.');
  }
  return Array.from(new Set(baseSteps));
}

export function buildEvidenceGapMatrixRows(
  artifacts: Pick<EvaluationArtifacts, 'evalResults' | 'gaps'>,
): EvidenceGapMatrixRow[] {
  const evalById = new Map(artifacts.evalResults.map((item) => [item.id, item.evalCode]));
  return artifacts.gaps.map((gap) => ({
    gap_id: gap.id,
    eval_code: gap.evalResultId ? evalById.get(gap.evalResultId) ?? 'unknown' : 'unknown',
    title: gap.title,
    severity: gap.severity,
    control_refs: gap.controlRefs.join('|'),
    ksi_refs: gap.ksiRefs.join('|'),
    recommended_artifact: gap.recommendedArtifact ?? '',
    current_state: gap.detail,
    target_state: recommendedTargetState(gap),
    priority: severityPriority(gap.severity),
    estimated_effort: severityEffort(gap.severity),
    remediation_steps: remediationSteps(gap.detail, gap.recommendedArtifact).join(' | '),
    poam_required: gap.poamRequired ? 'yes' : 'no',
  }));
}

export function renderEvidenceGapMatrixCsv(rows: EvidenceGapMatrixRow[]): string {
  const headers = [
    'gap_id',
    'eval_code',
    'title',
    'severity',
    'control_refs',
    'ksi_refs',
    'recommended_artifact',
    'current_state',
    'target_state',
    'priority',
    'estimated_effort',
    'remediation_steps',
    'poam_required',
  ] as const;

  const csvRow = (values: string[]) => values.map((value) => `"${value.replaceAll('"', '""')}"`).join(',');
  const lines = [csvRow([...headers])];
  for (const row of rows) {
    lines.push(
      csvRow(
        headers.map((key) => {
          const value = row[key];
          return typeof value === 'string' ? value : String(value);
        }),
      ),
    );
  }
  return lines.join('\n');
}

export function buildAuditorQuestionsMarkdown(args: {
  summary: AssessmentSummary;
  evalResults: EvalResult[];
  gaps: EvidenceGap[];
  poamItems: PoamItem[];
}): string {
  const failingEvals = args.evalResults.filter((item) => item.status !== 'PASS');
  return [
    '# Auditor Questions',
    '',
    `Generated: ${args.summary.generatedAt}`,
    `Evidence job: ${args.summary.evidenceJobId}`,
    '',
    '## Focus Areas',
    ...(failingEvals.length > 0
      ? failingEvals.map((item) => `- ${item.evalCode}: What evidence supports or closes the current ${item.status} result for ${item.title}?`)
      : ['- Which evidence family should be sampled first to confirm the current PASS posture remains accurate?']),
    '',
    '## Gap Follow-up',
    ...(args.gaps.length > 0
      ? args.gaps.slice(0, 15).map((gap) => `- ${gap.title}: When will ${gap.recommendedArtifact ?? 'closure evidence'} be attached, and who approves the disposition?`)
      : ['- No open gaps were recorded in the current run.']),
    '',
    '## POA&M Verification',
    ...(args.poamItems.length > 0
      ? args.poamItems
          .slice(0, 10)
          .map((item) => `- ${item.identifier}: What milestone evidence proves the remediation for ${item.weaknessName} is complete?`)
      : ['- No open POA&M items were generated by this assurance run.']),
  ].join('\n');
}

export function buildInstrumentationPlanMarkdown(args: {
  bundle: NormalizedEvidenceBundle;
  evalResults: EvalResult[];
  gaps: EvidenceGap[];
}): string {
  const missingAlertCoverage = args.gaps.filter((item) => item.gapType === 'missing_alert_rule');
  const missingLogging = args.gaps.filter((item) => item.gapType === 'missing_central_logging');
  const publicExposure = args.gaps.filter((item) => item.gapType === 'public_exposure_open');

  const section = (title: string, bullets: string[]) => [
    `## ${title}`,
    ...(bullets.length > 0 ? bullets.map((item) => `- ${item}`) : ['- No additional instrumentation actions were generated.']),
    '',
  ];

  return [
    '# Instrumentation Plan',
    '',
    'This plan is generated from deterministic assurance gaps. It recommends the smallest instrumentation deltas needed to close current proof-chain failures.',
    '',
    ...section('Splunk', [
      ...missingAlertCoverage.map((item) => `Create or verify a saved search for ${item.affectedObjectId ?? item.title} and attach one real firing example.`),
      ...missingLogging.map((item) => `Confirm ${item.affectedObjectId ?? item.title} sends control-plane and workload logs into Splunk with a searchable retention window.`),
      ...(publicExposure.length > 0
        ? ['Add a high-severity exposure detection for public administrative or sensitive services and prove recipient routing.']
        : []),
    ]),
    ...section('Sentinel', [
      ...missingAlertCoverage.map((item) => `Create a scheduled analytics rule for ${item.affectedObjectId ?? item.title} and preserve the rule export plus a sample incident.`),
      ...missingLogging.map((item) => `Verify the required data connectors or custom tables exist for ${item.affectedObjectId ?? item.title}.`),
    ]),
    ...section('AWS', [
      'Preserve CloudTrail, Config, and Security Hub coverage for all in-boundary assets and accounts referenced by this package.',
      ...(publicExposure.length > 0
        ? ['Capture the precise security-group, load balancer, or public endpoint evidence that proves exposure has been closed or exceptioned.']
        : []),
    ]),
    ...section('GCP', [
      'Verify Cloud Logging export, SCC visibility, and firewall audit evidence for any Google Cloud assets in scope.',
      ...(missingLogging.length > 0
        ? ['Preserve evidence that centralized exports reached the expected sink and are queryable in the required time window.']
        : []),
    ]),
  ].join('\n');
}

export function buildCorrelationReportMarkdown(args: {
  summary: AssessmentSummary;
  bundle: NormalizedEvidenceBundle;
  evalResults: EvalResult[];
  gaps: EvidenceGap[];
}): string {
  const highSeverityGaps = args.gaps.filter((item) => item.severity === 'critical' || item.severity === 'high');
  return [
    '# Correlation Report',
    '',
    `Generated: ${args.summary.generatedAt}`,
    `Evidence job: ${args.summary.evidenceJobId}`,
    '',
    '## Population Summary',
    `- Declared inventory: ${args.bundle.declaredInventory.length}`,
    `- Discovered assets: ${args.bundle.discoveredAssets.length}`,
    `- Cloud events: ${args.bundle.cloudEvents.length}`,
    `- Scanner findings: ${args.bundle.scannerFindings.length}`,
    `- Log sources: ${args.bundle.centralLogSources.length}`,
    `- Alert rules: ${args.bundle.alertRules.length}`,
    `- Tickets: ${args.bundle.tickets.length}`,
    '',
    '## Deterministic Results',
    ...args.evalResults.map((item) => `- ${item.evalCode} ${item.status}: ${item.summary}`),
    '',
    '## Highest Priority Correlations',
    ...(highSeverityGaps.length > 0
      ? highSeverityGaps.slice(0, 12).map((item) => `- ${item.title}: ${item.detail}`)
      : ['- No critical or high-severity correlations require immediate follow-up.']),
  ].join('\n');
}

export function buildAssessorWorkpaper(gap: EvidenceGap): Record<string, unknown> {
  return {
    current_state: gap.detail,
    target_state: recommendedTargetState(gap),
    estimated_effort: severityEffort(gap.severity),
    priority: severityPriority(gap.severity),
    remediation_steps: remediationSteps(gap.detail, gap.recommendedArtifact),
  };
}

export function buildPoamRemediationPlan(poam: PoamItem): Array<Record<string, unknown>> {
  const steps = remediationSteps(poam.plannedRemediation, null);
  return steps.map((description, index) => ({
    order: index + 1,
    description,
    status: index === 0 ? 'planned' : 'pending',
    due_date: poam.milestoneDueDate,
  }));
}

export function validateEvidenceArtifacts(args: {
  bundle: NormalizedEvidenceBundle;
  artifacts: EvaluationArtifacts;
  availableArtifactFamilies: string[];
  threatHuntFindingCount: number;
}): AssuranceValidationReport {
  const checks: AssuranceValidationCheck[] = [];
  const evalCodes = new Set(args.artifacts.evalResults.map((item) => item.evalCode));
  const missingEvalCodes = REQUIRED_EVAL_CODES.filter((item) => !evalCodes.has(item));
  checks.push({
    id: 'required_eval_codes',
    title: 'Required deterministic evaluations are present',
    status: missingEvalCodes.length === 0 ? 'pass' : 'fail',
    detail:
      missingEvalCodes.length === 0
        ? `All ${REQUIRED_EVAL_CODES.length} required deterministic evaluation families were produced.`
        : `Missing evaluation families: ${missingEvalCodes.join(', ')}`,
    evidenceRefs: ['eval_results'],
  });

  const availableArtifacts = new Set(args.availableArtifactFamilies);
  const requiredArtifacts = requiredEvidenceArtifacts(args.bundle.bundleKind);
  const missingArtifacts = requiredArtifacts.filter((item) => !availableArtifacts.has(item));
  checks.push({
    id: 'required_artifact_families',
    title: 'Required artifact families are present',
    status: missingArtifacts.length === 0 ? 'pass' : 'fail',
    detail:
      missingArtifacts.length === 0
        ? `All required artifact families were written for ${args.bundle.bundleKind}.`
        : `Missing artifact families: ${missingArtifacts.join(', ')}`,
    evidenceRefs: requiredArtifacts,
  });

  const failOrPartial = args.artifacts.evalResults.filter((item) => item.status !== 'PASS');
  const missingGapCoverage = failOrPartial.filter(
    (item) => !args.artifacts.gaps.some((gap) => gap.evalResultId === item.id),
  );
  checks.push({
    id: 'fail_partial_gap_alignment',
    title: 'FAIL and PARTIAL results map to explicit evidence gaps',
    status: missingGapCoverage.length === 0 ? 'pass' : 'fail',
    detail:
      missingGapCoverage.length === 0
        ? 'Every FAIL or PARTIAL result maps to at least one explicit evidence gap.'
        : `Missing gap mapping for: ${missingGapCoverage.map((item) => item.evalCode).join(', ')}`,
    evidenceRefs: ['eval_results', 'evidence_gaps'],
  });

  const poamRequiredGaps = args.artifacts.gaps.filter((item) => item.poamRequired);
  const missingPoam = poamRequiredGaps.filter(
    (gap) => !args.artifacts.poamItems.some((item) => item.sourceGapId === gap.id),
  );
  checks.push({
    id: 'poam_coverage',
    title: 'POA&M-required gaps map to POA&M items',
    status: missingPoam.length === 0 ? 'pass' : 'fail',
    detail:
      missingPoam.length === 0
        ? `All ${poamRequiredGaps.length} POA&M-required gaps are tracked in POA&M output.`
        : `Missing POA&M linkage for gaps: ${missingPoam.map((item) => item.id).join(', ')}`,
    evidenceRefs: ['evidence_gaps', 'poam_items'],
  });

  checks.push({
    id: 'conmon_reasonableness',
    title: 'Continuous monitoring reasonableness remains explainable',
    status: args.artifacts.reasonablenessFindings.length === 0 ? 'pass' : 'warn',
    detail:
      args.artifacts.reasonablenessFindings.length === 0
        ? 'No outstanding reasonableness findings were recorded.'
        : `${args.artifacts.reasonablenessFindings.length} reasonableness finding(s) still require review before closure.`,
    evidenceRefs: ['reasonableness_findings'],
  });

  const publicExposureFailures = args.artifacts.gaps.filter((item) => item.gapType === 'public_exposure_open');
  checks.push({
    id: 'threat_hunt_coverage',
    title: 'Threat-hunt artifacts exist when exposure or threat-hunt mode requires them',
    status:
      publicExposureFailures.length === 0 && args.bundle.bundleKind !== 'threat-hunt'
        ? 'pass'
        : args.threatHuntFindingCount > 0
          ? 'pass'
          : 'warn',
    detail:
      publicExposureFailures.length === 0 && args.bundle.bundleKind !== 'threat-hunt'
        ? 'No threat-hunt-specific findings were required by the current bundle.'
        : args.threatHuntFindingCount > 0
          ? `${args.threatHuntFindingCount} threat-hunt finding(s) were generated for operator review.`
          : 'Threat-hunt mode or exposure evidence exists, but no threat-hunt findings were generated.',
    evidenceRefs: ['threat_hunt_findings', 'threat_hunt_timeline', 'threat_hunt_queries'],
  });

  const status = mergeStatuses(checks);
  return {
    scope: 'evidence',
    status,
    summary:
      status === 'pass'
        ? 'The evidence package satisfies the deterministic artifact contract.'
        : status === 'warn'
          ? 'The evidence package is usable, but some validation checks still require reviewer attention.'
          : 'The evidence package is missing required deterministic proof artifacts or mappings.',
    generatedAt: nowIso(),
    checks,
  };
}

function textContainsAll(text: string, snippets: string[]): boolean {
  return snippets.every((snippet) => text.includes(snippet));
}

function packageFindings(document: PackageDocument): PackageFindingRecord[] {
  const findings = document.findings;
  return Array.isArray(findings) ? findings.filter((item): item is PackageFindingRecord => Boolean(item) && typeof item === 'object') : [];
}

function packagePoamItems(document: PackageDocument): PackagePoamRecord[] {
  const items = document.poam_items;
  return Array.isArray(items) ? items.filter((item): item is PackagePoamRecord => Boolean(item) && typeof item === 'object') : [];
}

function numericField(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function packageEvidenceLinks(document: PackageDocument): Array<Record<string, unknown>> {
  const links = document.evidence_links;
  return Array.isArray(links) ? links.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : [];
}

function packageValidationRows(document: PackageDocument): Array<Record<string, unknown>> {
  const rows = document.ksi_validation_results;
  return Array.isArray(rows) ? rows.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : [];
}

function isAgentEvalCode(value: unknown): value is string {
  const normalized = nonEmptyString(value);
  return Boolean(normalized && normalized.startsWith('AGENT_'));
}

function packagePoamSourceEvalCode(record: PackagePoamRecord): string | null {
  return nonEmptyString(record.sourceEvalCode) ?? nonEmptyString(record.source_eval_code);
}

function packageReviewLedger(document: PackageDocument): Record<string, unknown> {
  return (document.review_ledger ?? {}) as Record<string, unknown>;
}

function packageAgentSecuritySummary(document: PackageDocument): Record<string, unknown> {
  return (document.agent_security_summary ?? {}) as Record<string, unknown>;
}

function countMarkdownTableRows(markdown: string): number {
  const remediationIndex = markdown.indexOf('\n## Remediation');
  const head = remediationIndex >= 0 ? markdown.slice(0, remediationIndex) : markdown;
  const lines = head
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
  const tableLines = lines.filter((item) => item.startsWith('|') && item.endsWith('|'));
  if (tableLines.length < 3) {
    return 0;
  }
  return Math.max(0, tableLines.length - 2);
}

export function buildPackageValidationReport(args: {
  packageDocument: PackageDocument;
  summary: TwentyXPackageSummary;
  reconciliation: ReconciliationSummary;
  assessorReport: string;
  executiveReport: string;
  aoReport: string;
  assessorPoamReport: string;
}): AssuranceValidationReport {
  const checks: AssuranceValidationCheck[] = [];
  const metadata = (args.packageDocument.metadata ?? {}) as Record<string, unknown>;
  const agentRunId = nonEmptyString(metadata.agent_run_id);
  checks.push({
    id: 'package_metadata',
    title: 'Package metadata is complete',
    status:
      metadata.schema_version && metadata.evidence_job_id && metadata.package_job_id ? 'pass' : 'fail',
    detail:
      metadata.schema_version && metadata.evidence_job_id && metadata.package_job_id
        ? 'Package metadata contains schema version, evidence job id, and package job id.'
        : 'Package metadata is missing one or more required identifiers.',
    evidenceRefs: ['package_json'],
  });

  const roles = new Set(args.summary.reportManifest.map((item) => item.role));
  const missingRoles = REQUIRED_PACKAGE_ROLES.filter((item) => !roles.has(item));
  checks.push({
    id: 'report_roles',
    title: 'All required report roles are present',
    status: missingRoles.length === 0 ? 'pass' : 'fail',
    detail:
      missingRoles.length === 0
        ? 'Assessor, executive, AO, and assessor POA&M reports are present in the report manifest.'
        : `Missing report roles: ${missingRoles.join(', ')}`,
    evidenceRefs: ['report_manifest'],
  });

  const invalidReportManifestPaths = args.summary.reportManifest.filter(
    (item) => !nonEmptyString(item.path),
  );
  checks.push({
    id: 'report_manifest_paths',
    title: 'Report manifest paths are populated',
    status: invalidReportManifestPaths.length === 0 ? 'pass' : 'fail',
    detail:
      invalidReportManifestPaths.length === 0
        ? `All ${args.summary.reportManifest.length} report manifest entries include artifact paths.`
        : `${invalidReportManifestPaths.length} report manifest entr${invalidReportManifestPaths.length === 1 ? 'y is' : 'ies are'} missing artifact paths.`,
    evidenceRefs: ['report_manifest'],
  });

  const evidenceLinks = packageEvidenceLinks(args.packageDocument);
  const packageRequiredEvidenceLinks = requiredPackageEvidenceLinks(
    packageBundleKind(args.packageDocument),
    packageHasAgentSecurity(args.packageDocument),
  );
  const evidenceLinkFamilies = new Set(
    evidenceLinks
      .map((item) => nonEmptyString(item.family))
      .filter((item): item is string => Boolean(item)),
  );
  const missingEvidenceLinks = packageRequiredEvidenceLinks.filter((item) => !evidenceLinkFamilies.has(item));
  const invalidEvidenceLinkPaths = evidenceLinks.filter((item) => !nonEmptyString(item.path));
  checks.push({
    id: 'package_evidence_links',
    title: 'Evidence-link contract is complete',
    status: missingEvidenceLinks.length === 0 && invalidEvidenceLinkPaths.length === 0 ? 'pass' : 'fail',
    detail:
      missingEvidenceLinks.length === 0 && invalidEvidenceLinkPaths.length === 0
        ? `All ${packageRequiredEvidenceLinks.length} required evidence-link families are present with non-empty paths.`
        : `Missing evidence-link families: ${missingEvidenceLinks.join(', ') || 'none'}; invalid paths: ${invalidEvidenceLinkPaths.length}.`,
    evidenceRefs: ['package_json'],
  });

  const validationRows = packageValidationRows(args.packageDocument);
  const agentValidationRows = validationRows.filter((item) => isAgentEvalCode(item.eval_code));
  const failingAgentValidationRows = agentValidationRows.filter(
    (item) => nonEmptyString(item.status) !== 'PASS',
  );
  const agentSecuritySummary = packageAgentSecuritySummary(args.packageDocument);
  const invalidNarrativeRows = validationRows.filter((item) => {
    const status = nonEmptyString(item.status) ?? 'PASS';
    if (status === 'PASS') {
      return false;
    }
    const evidenceRefs = Array.isArray(item.evidence_refs) ? item.evidence_refs : [];
    return !nonEmptyString(item.summary) || !nonEmptyString(item.rationale) || evidenceRefs.length === 0;
  });
  checks.push({
    id: 'fail_partial_narrative_contract',
    title: 'FAIL and PARTIAL validation rows preserve narrative contract',
    status: invalidNarrativeRows.length === 0 ? 'pass' : 'fail',
    detail:
      invalidNarrativeRows.length === 0
        ? 'All FAIL/PARTIAL validation rows include summary, rationale, and evidence references.'
        : `${invalidNarrativeRows.length} FAIL/PARTIAL validation row(s) are missing summary, rationale, or evidence references.`,
    evidenceRefs: ['package_json'],
  });

  const findingRows = packageFindings(args.packageDocument);
  const agentFindingRows = findingRows.filter((item) => isAgentEvalCode(item.source_eval_code));
  const findingsMissingWorkpaper = findingRows.filter((item) => {
    const record = item as Record<string, unknown>;
    const workpaper = record.assessor_workpaper;
    return !workpaper || typeof workpaper !== 'object';
  });
  checks.push({
    id: 'assessor_workpaper_chain',
    title: 'Package findings preserve assessor workpaper detail',
    status: findingsMissingWorkpaper.length === 0 ? 'pass' : 'fail',
    detail:
      findingsMissingWorkpaper.length === 0
        ? `All ${findingRows.length} package finding row(s) include assessor workpaper detail.`
        : `${findingsMissingWorkpaper.length} package finding row(s) are missing assessor workpaper detail.`,
    evidenceRefs: ['package_json'],
  });

  const findingsMissingLineage = findingRows.filter((item) => {
    const record = item as Record<string, unknown>;
    const refs = Array.isArray(record.source_artifact_refs) ? record.source_artifact_refs : [];
    return !nonEmptyString(record.source_eval_code) || refs.length < 2 || !nonEmptyString(record.current_state) || !nonEmptyString(record.target_state);
  });
  checks.push({
    id: 'finding_lineage_contract',
    title: 'Package findings preserve source lineage and target state',
    status: findingsMissingLineage.length === 0 ? 'pass' : 'fail',
    detail:
      findingsMissingLineage.length === 0
        ? `All ${findingRows.length} package finding row(s) include source lineage and explicit current/target state.`
        : `${findingsMissingLineage.length} package finding row(s) are missing source lineage or state fields.`,
    evidenceRefs: ['package_json'],
  });

  const invalidAgentFindingRows = agentFindingRows.filter((item) => {
    const refs = Array.isArray(item.source_artifact_refs) ? item.source_artifact_refs : [];
    const normalizedRefs = refs
      .map((ref) => nonEmptyString(ref))
      .filter((ref): ref is string => Boolean(ref));
    return (
      !normalizedRefs.some((ref) => /agent[-_]eval[-_]results/i.test(ref)) ||
      !normalizedRefs.some((ref) => /agent[-_]risk[-_]report/i.test(ref))
    );
  });
  checks.push({
    id: 'agent_finding_lineage',
    title: 'Embedded agent findings preserve agent-artifact lineage',
    status:
      !packageHasAgentSecurity(args.packageDocument) || invalidAgentFindingRows.length === 0
        ? 'pass'
        : 'fail',
    detail:
      !packageHasAgentSecurity(args.packageDocument)
        ? 'No bounded-agent artifact family is linked to this package.'
        : invalidAgentFindingRows.length === 0
          ? `All ${agentFindingRows.length} agent finding row(s) reference the embedded agent evaluation and risk artifacts.`
          : `${invalidAgentFindingRows.length} agent finding row(s) are missing agent evaluation or risk artifact lineage.`,
    evidenceRefs: ['package_json', 'agent_eval_results', 'agent_risk_report'],
  });

  const poamRows = packagePoamItems(args.packageDocument);
  const agentPoamRows = poamRows.filter((item) => isAgentEvalCode(packagePoamSourceEvalCode(item)));
  const poamMissingPlans = poamRows.filter((item) => {
    const record = item as Record<string, unknown>;
    return !Array.isArray(record.remediation_plan) || record.remediation_plan.length === 0;
  });
  checks.push({
    id: 'poam_remediation_plan',
    title: 'POA&M rows include milestone-oriented remediation plans',
    status: poamMissingPlans.length === 0 ? 'pass' : 'fail',
    detail:
      poamMissingPlans.length === 0
        ? `All ${poamRows.length} POA&M row(s) include a remediation plan.`
        : `${poamMissingPlans.length} POA&M row(s) are missing remediation_plan entries.`,
    evidenceRefs: ['package_json'],
  });

  const poamMissingLineage = poamRows.filter((item) => {
    const record = item as Record<string, unknown>;
    const controlRefs = Array.isArray(record.controlRefs) ? record.controlRefs : Array.isArray(record.control_refs) ? record.control_refs : [];
    return !nonEmptyString(record.finding_id) || controlRefs.length === 0 || !nonEmptyString(record.current_state) || !nonEmptyString(record.target_state);
  });
  checks.push({
    id: 'poam_lineage_contract',
    title: 'POA&M rows preserve finding lineage and state transition',
    status: poamMissingLineage.length === 0 ? 'pass' : 'fail',
    detail:
      poamMissingLineage.length === 0
        ? `All ${poamRows.length} POA&M row(s) preserve finding lineage, controls, and state transition fields.`
        : `${poamMissingLineage.length} POA&M row(s) are missing lineage or state transition fields.`,
    evidenceRefs: ['package_json'],
  });

  const missingAgentPoamEvalCodes = failingAgentValidationRows
    .map((item) => nonEmptyString(item.eval_code))
    .filter((code): code is string => Boolean(code))
    .filter(
      (evalCode) =>
        !agentPoamRows.some((row) => packagePoamSourceEvalCode(row) === evalCode),
    );
  const missingAgentFindingEvalCodes = failingAgentValidationRows
    .map((item) => nonEmptyString(item.eval_code))
    .filter((code): code is string => Boolean(code))
    .filter(
      (evalCode) =>
        !agentFindingRows.some((row) => nonEmptyString(row.source_eval_code) === evalCode),
    );
  checks.push({
    id: 'agent_eval_embedding',
    title: 'Embedded agent validation rows are present when a bounded-agent run is linked',
    status:
      !packageHasAgentSecurity(args.packageDocument) || agentValidationRows.length > 0
        ? 'pass'
        : 'fail',
    detail:
      !packageHasAgentSecurity(args.packageDocument)
        ? 'No bounded-agent run is linked to this package.'
        : agentValidationRows.length > 0
          ? `${agentValidationRows.length} embedded agent validation row(s) were recorded in the package JSON.`
          : 'The package links a bounded-agent run, but no AGENT_* validation rows were embedded in the package JSON.',
    evidenceRefs: ['package_json', 'agent_eval_results'],
  });
  const agentSummaryAligned =
    !packageHasAgentSecurity(args.packageDocument) ||
    (numericField(agentSecuritySummary.evaluation_count) === agentValidationRows.length &&
      numericField(agentSecuritySummary.pass_count) ===
        agentValidationRows.filter((item) => nonEmptyString(item.status) === 'PASS').length &&
      numericField(agentSecuritySummary.partial_count) ===
        agentValidationRows.filter((item) => nonEmptyString(item.status) === 'PARTIAL').length &&
      numericField(agentSecuritySummary.fail_count) ===
        agentValidationRows.filter((item) => nonEmptyString(item.status) === 'FAIL').length &&
      numericField(agentSecuritySummary.gap_count) === agentFindingRows.length &&
      numericField(agentSecuritySummary.poam_count) === agentPoamRows.length);
  checks.push({
    id: 'agent_security_summary_alignment',
    title: 'Machine-readable agent security summary aligns with embedded agent rows',
    status: agentSummaryAligned ? 'pass' : 'fail',
    detail:
      !packageHasAgentSecurity(args.packageDocument)
        ? 'No bounded-agent run is linked to this package.'
        : agentSummaryAligned
          ? 'The embedded agent security summary aligns with the agent validation, finding, and POA&M rows.'
          : 'The embedded agent security summary does not align with the agent validation, finding, or POA&M rows.',
    evidenceRefs: ['package_json', 'agent_eval_results', 'agent_poam'],
  });
  checks.push({
    id: 'agent_poam_alignment',
    title: 'Non-pass agent evaluations reconcile with embedded findings and POA&M rows',
    status:
      !packageHasAgentSecurity(args.packageDocument) ||
      (missingAgentPoamEvalCodes.length === 0 && missingAgentFindingEvalCodes.length === 0)
        ? 'pass'
        : 'fail',
    detail:
      !packageHasAgentSecurity(args.packageDocument)
        ? 'No bounded-agent run is linked to this package.'
        : missingAgentPoamEvalCodes.length === 0 && missingAgentFindingEvalCodes.length === 0
          ? `All ${failingAgentValidationRows.length} non-pass agent evaluation(s) reconcile with embedded findings and POA&M rows.`
          : `Missing agent finding coverage for: ${missingAgentFindingEvalCodes.join(', ') || 'none'}; missing agent POA&M coverage for: ${missingAgentPoamEvalCodes.join(', ') || 'none'}.`,
    evidenceRefs: ['package_json', 'agent_eval_results', 'agent_poam'],
  });

  const summaryRecord = (args.packageDocument.summary ?? {}) as Record<string, unknown>;
  const summaryAligned =
    numericField(summaryRecord.pass_count) === validationRows.filter((item) => nonEmptyString(item.status) === 'PASS').length &&
    numericField(summaryRecord.partial_count) === validationRows.filter((item) => nonEmptyString(item.status) === 'PARTIAL').length &&
    numericField(summaryRecord.fail_count) === validationRows.filter((item) => nonEmptyString(item.status) === 'FAIL').length &&
    numericField(summaryRecord.gap_count) === findingRows.length &&
    numericField(summaryRecord.poam_count) === poamRows.length;
  checks.push({
    id: 'package_summary_counts',
    title: 'Package summary counts are internally consistent',
    status: summaryAligned ? 'pass' : 'fail',
    detail: summaryAligned
      ? 'Package summary counts are internally consistent with package arrays.'
      : 'Package summary counts are not internally consistent with package arrays.',
    evidenceRefs: ['package_json'],
  });

  const reviewLedger = packageReviewLedger(args.packageDocument);
  const ledgerDecisions = Array.isArray(reviewLedger.decisions) ? reviewLedger.decisions : [];
  const acceptedCount = ledgerDecisions.filter((item) => nonEmptyString((item as Record<string, unknown>).decision)?.toLowerCase() === 'accepted').length;
  const rejectedCount = ledgerDecisions.filter((item) => nonEmptyString((item as Record<string, unknown>).decision)?.toLowerCase() === 'rejected').length;
  const otherCount = ledgerDecisions.length - acceptedCount - rejectedCount;
  const reviewLedgerAligned =
    numericField(reviewLedger.total) === ledgerDecisions.length &&
    numericField(reviewLedger.accepted_count) === acceptedCount &&
    numericField(reviewLedger.rejected_count) === rejectedCount &&
    numericField(reviewLedger.other_count) === otherCount &&
    numericField(summaryRecord.review_decision_count) === ledgerDecisions.length &&
    numericField(summaryRecord.accepted_review_count) === acceptedCount &&
    numericField(summaryRecord.rejected_review_count) === rejectedCount;
  checks.push({
    id: 'review_ledger_alignment',
    title: 'Review ledger counts reconcile with package summary',
    status: reviewLedgerAligned ? 'pass' : 'fail',
    detail: reviewLedgerAligned
      ? 'Review ledger totals reconcile with decision rows and package summary counts.'
      : 'Review ledger totals do not reconcile with decision rows or package summary counts.',
    evidenceRefs: ['review_ledger', 'package_json'],
  });

  const assessorHasCounts = textContainsAll(args.assessorReport, [
    `- PASS: ${numericField(summaryRecord.pass_count)}`,
    `- PARTIAL: ${numericField(summaryRecord.partial_count)}`,
    `- FAIL: ${numericField(summaryRecord.fail_count)}`,
  ]);
  checks.push({
    id: 'assessor_report_counts',
    title: 'Assessor report mirrors package counts',
    status: assessorHasCounts ? 'pass' : 'warn',
    detail: assessorHasCounts
      ? 'The assessor report mirrors package PASS/PARTIAL/FAIL totals.'
      : 'The assessor report does not clearly mirror the package summary counts.',
    evidenceRefs: ['assessor', 'package_json'],
  });

  const agentReportsEmbedded =
    !packageHasAgentSecurity(args.packageDocument) ||
    (args.assessorReport.includes('## Embedded Agent Security') &&
      args.executiveReport.includes('## Agent Governance') &&
      args.aoReport.includes('## Agent Residual Risk') &&
      (!agentRunId ||
        (args.assessorReport.includes(agentRunId) &&
          args.executiveReport.includes(agentRunId) &&
          args.aoReport.includes(agentRunId))));
  checks.push({
    id: 'agent_report_embedding',
    title: 'Rendered reports preserve embedded agent-security narrative',
    status: agentReportsEmbedded ? 'pass' : 'fail',
    detail:
      !packageHasAgentSecurity(args.packageDocument)
        ? 'No bounded-agent run is linked to this package.'
        : agentReportsEmbedded
          ? 'Assessor, executive, and AO reports all preserve the embedded agent-security sections and linked run context.'
          : 'One or more rendered reports is missing the embedded agent-security section or linked run context.',
    evidenceRefs: ['assessor', 'executive', 'ao', 'package_json'],
  });

  const assessorPoamRowCount = countMarkdownTableRows(args.assessorPoamReport);
  const assessorPoamIncludesAgentCount =
    !packageHasAgentSecurity(args.packageDocument) ||
    args.assessorPoamReport.includes(
      `Agent POA&M rows: ${poamRows.filter((item) => isAgentEvalCode(packagePoamSourceEvalCode(item))).length}`,
    );
  checks.push({
    id: 'assessor_poam_report_rows',
    title: 'Assessor POA&M report mirrors machine-readable POA&M rows',
    status:
      assessorPoamRowCount === poamRows.length && assessorPoamIncludesAgentCount ? 'pass' : 'fail',
    detail:
      assessorPoamRowCount === poamRows.length && assessorPoamIncludesAgentCount
        ? `The assessor POA&M report renders all ${poamRows.length} POA&M row(s).`
        : `The assessor POA&M report renders ${assessorPoamRowCount} row(s), the package JSON contains ${poamRows.length}, or the agent POA&M summary line is missing.`,
    evidenceRefs: ['assessor_poam_md', 'package_json'],
  });

  const reconciliationMismatches = args.reconciliation.checks.filter((item) => item.status === 'mismatch');
  checks.push({
    id: 'reconciliation_status',
    title: 'Machine-readable package and rendered reports reconcile cleanly',
    status: reconciliationMismatches.length === 0 ? 'pass' : 'fail',
    detail:
      reconciliationMismatches.length === 0
        ? 'All reconciliation checks passed.'
        : `Mismatched reconciliation checks: ${reconciliationMismatches.map((item) => item.id).join(', ')}`,
    evidenceRefs: ['reconciliation', 'report_manifest'],
  });

  const status = mergeStatuses(checks);
  return {
    scope: 'package',
    status,
    summary:
      status === 'pass'
        ? 'The 20x package satisfies the current schema and report-contract checks.'
        : status === 'warn'
          ? 'The 20x package is structurally valid, but one or more report-contract checks should be reviewed.'
          : 'The 20x package is missing required schema or assessor-contract fields.',
    generatedAt: nowIso(),
    checks,
  };
}

export function buildPackageReconciliation(args: {
  artifacts: EvaluationArtifacts;
  packageDocument: PackageDocument;
  assessorReport: string;
  executiveReport: string;
  aoReport: string;
  assessorPoamReport: string;
  reviewDecisionCount: number;
}): ReconciliationSummary {
  const summary = (args.packageDocument.summary ?? {}) as Record<string, unknown>;
  const packageRequiredEvidenceLinks = requiredPackageEvidenceLinks(
    packageBundleKind(args.packageDocument),
    packageHasAgentSecurity(args.packageDocument),
  );
  const findings = packageFindings(args.packageDocument);
  const poamItems = packagePoamItems(args.packageDocument);
  const checks: ReconciliationSummary['checks'] = [
    {
      id: 'eval-count',
      expected: args.artifacts.evalResults.length,
      actual: Array.isArray(args.packageDocument.ksi_validation_results)
        ? args.packageDocument.ksi_validation_results.length
        : 0,
      status:
        (Array.isArray(args.packageDocument.ksi_validation_results)
          ? args.packageDocument.ksi_validation_results.length
          : 0) === args.artifacts.evalResults.length
          ? 'match'
          : 'mismatch',
    },
    {
      id: 'gap-count',
      expected: args.artifacts.gaps.length,
      actual: findings.length,
      status: findings.length === args.artifacts.gaps.length ? 'match' : 'mismatch',
    },
    {
      id: 'poam-count',
      expected: args.artifacts.poamItems.length,
      actual: poamItems.length,
      status: poamItems.length === args.artifacts.poamItems.length ? 'match' : 'mismatch',
    },
    {
      id: 'review-decision-count',
      expected: args.reviewDecisionCount,
      actual: numericField(summary.review_decision_count),
      status: numericField(summary.review_decision_count) === args.reviewDecisionCount ? 'match' : 'mismatch',
    },
    {
      id: 'pass-count',
      expected: args.artifacts.summary.passingEvaluations,
      actual: numericField(summary.pass_count),
      status: numericField(summary.pass_count) === args.artifacts.summary.passingEvaluations ? 'match' : 'mismatch',
    },
    {
      id: 'partial-count',
      expected: args.artifacts.summary.partialEvaluations,
      actual: numericField(summary.partial_count),
      status: numericField(summary.partial_count) === args.artifacts.summary.partialEvaluations ? 'match' : 'mismatch',
    },
    {
      id: 'report-manifest-count',
      expected: REQUIRED_PACKAGE_ROLES.length,
      actual: Array.isArray(args.packageDocument.report_manifest) ? args.packageDocument.report_manifest.length : 0,
      status:
        (Array.isArray(args.packageDocument.report_manifest) ? args.packageDocument.report_manifest.length : 0) ===
        REQUIRED_PACKAGE_ROLES.length
          ? 'match'
          : 'mismatch',
    },
    {
      id: 'evidence-link-count',
      expected: packageRequiredEvidenceLinks.length,
      actual: packageEvidenceLinks(args.packageDocument).length,
      status: packageEvidenceLinks(args.packageDocument).length >= packageRequiredEvidenceLinks.length ? 'match' : 'mismatch',
    },
    {
      id: 'assessor-report-failures',
      expected: args.artifacts.summary.failingEvaluations,
      actual: args.assessorReport.includes(`- FAIL: ${args.artifacts.summary.failingEvaluations}`)
        ? args.artifacts.summary.failingEvaluations
        : 0,
      status: args.assessorReport.includes(`- FAIL: ${args.artifacts.summary.failingEvaluations}`) ? 'match' : 'mismatch',
    },
    {
      id: 'executive-report-poam',
      expected: args.artifacts.poamItems.length,
      actual: args.executiveReport.includes(`${args.artifacts.poamItems.length} POA&M item`)
        ? args.artifacts.poamItems.length
        : 0,
      status: args.executiveReport.includes(`${args.artifacts.poamItems.length} POA&M item`) ? 'match' : 'mismatch',
    },
    {
      id: 'ao-report-gap-count',
      expected: args.artifacts.summary.openGaps,
      actual: args.aoReport.includes(`${args.artifacts.summary.openGaps} open evidence gaps`)
        ? args.artifacts.summary.openGaps
        : 0,
      status: args.aoReport.includes(`${args.artifacts.summary.openGaps} open evidence gaps`) ? 'match' : 'mismatch',
    },
    {
      id: 'assessor-poam-report-count',
      expected: args.artifacts.poamItems.length,
      actual: countMarkdownTableRows(args.assessorPoamReport),
      status:
        countMarkdownTableRows(args.assessorPoamReport) === args.artifacts.poamItems.length
          ? 'match'
          : 'mismatch',
    },
  ];

  const expectedAgentEvalCount = args.artifacts.evalResults.filter((item) => item.evalCode.startsWith('AGENT_')).length;
  if (expectedAgentEvalCount > 0 || packageHasAgentSecurity(args.packageDocument)) {
    const actualAgentEvalCount = packageValidationRows(args.packageDocument).filter((item) => isAgentEvalCode(item.eval_code)).length;
    const expectedAgentFindingCount = args.artifacts.gaps.filter((item) => (item.evalResultId ?? '').startsWith('AGENT_')).length;
    const actualAgentFindingCount = findings.filter((item) => isAgentEvalCode(item.source_eval_code)).length;
    const expectedAgentPoamCount = args.artifacts.poamItems.filter((item) => (item.sourceEvalCode ?? '').startsWith('AGENT_')).length;
    const actualAgentPoamCount = poamItems.filter((item) => isAgentEvalCode(packagePoamSourceEvalCode(item))).length;
    checks.push(
      {
        id: 'agent-eval-count',
        expected: expectedAgentEvalCount,
        actual: actualAgentEvalCount,
        status: actualAgentEvalCount === expectedAgentEvalCount ? 'match' : 'mismatch',
      },
      {
        id: 'agent-finding-count',
        expected: expectedAgentFindingCount,
        actual: actualAgentFindingCount,
        status: actualAgentFindingCount === expectedAgentFindingCount ? 'match' : 'mismatch',
      },
      {
        id: 'agent-poam-count',
        expected: expectedAgentPoamCount,
        actual: actualAgentPoamCount,
        status: actualAgentPoamCount === expectedAgentPoamCount ? 'match' : 'mismatch',
      },
    );
  }

  return {
    id: crypto.randomUUID(),
    packageJobId: '',
    evidenceJobId: args.artifacts.summary.evidenceJobId,
    status: checks.some((item) => item.status === 'mismatch') ? 'mismatch' : 'matched',
    checks,
  };
}
