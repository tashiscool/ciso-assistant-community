export type AssuranceArtifactSummary = {
  id: string;
  artifactFamily: string;
  objectKey: string;
  sizeBytes: number | null;
  contentType: string | null;
  checksum: string | null;
  createdAt: string;
};

export type AssuranceEvidenceJob = {
  id: string;
  tenantId: string;
  folderId: string | null;
  sourceId: string;
  sourceName: string;
  scheduledFor: string;
  startedAt: string | null;
  finishedAt: string | null;
  status: string;
  statusDetail: string | null;
  runFamily: string;
  inputMode: string;
  bundleKind: string;
  manifestKey: string | null;
  normalizationStatus: string;
  coverage: Record<string, unknown>;
  artifactCount: number;
};

export type AssuranceEvidenceJobDetail = AssuranceEvidenceJob & {
  artifacts: AssuranceArtifactSummary[];
};

export type AssuranceArtifactPreview = {
  family: string;
  items: AssuranceArtifactSummary[];
  retrieval: {
    kind: string;
    previewAvailable: boolean;
  };
  preview: unknown;
};

export type AssuranceWorkflowRun = {
  runId: string;
  runType: string;
  module: string;
  title: string;
  status: string;
  folderId: string | null;
  sourceRecordId: string | null;
  route: string;
  detail: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type AssuranceOverview = {
  summary: {
    evidenceJobCount: number;
    trackerImportCount: number;
    trackerImportErrorCount: number;
    packageCount: number;
    agentBackedPackageCount: number;
    observableParityReadyPackageCount: number;
    packageMismatchCount: number;
    packageValidationReviewCount: number;
    pendingReviewCount: number;
    reviewDecisionCount: number;
    agentRunCount: number;
    pendingWritebackCount: number;
    runningWorkflowCount: number;
    awaitingReviewWorkflowCount: number;
    failedWorkflowCount: number;
  };
  evidenceJobs: AssuranceEvidenceJob[];
  trackerImports: TrackerImportSummary[];
  trackerImportsWithErrors: TrackerImportSummary[];
  packages: PackageListItem[];
  parityReadyPackages: PackageListItem[];
  mismatchedPackages: PackageListItem[];
  packagesWithValidationDrift: PackageListItem[];
  pendingReviews: ReviewRecommendation[];
  reviewHistory: ReviewDecision[];
  agentRuns: AgentRunListItem[];
  pendingWritebacks: AssuranceOverviewPendingWriteback[];
  workflowRuns: AssuranceWorkflowRun[];
};

export type AssuranceParityCheck = {
  id: string;
  title: string;
  status: 'pass' | 'attention' | 'fail';
  detail: string;
  route: string | null;
  subjectId: string | null;
  metrics: Record<string, unknown> | null;
};

export type AssuranceParityStatus = {
  status: 'pass' | 'attention' | 'fail';
  generatedAt: string;
  source: {
    packageId: string | null;
    packageFileName: string | null;
    packageRoute: string | null;
    evidenceJobId: string | null;
    evidenceRoute: string | null;
    agentRunId: string | null;
    agentRoute: string | null;
    trackerImportId: string | null;
    trackerRoute: string | null;
    bundleKind: string | null;
    inputMode: string | null;
    updatedAt: string | null;
  };
  counts: {
    evidenceJobs: number;
    trackerImports: number;
    parityReadyPackages: number;
    agentBackedPackages: number;
    agentRuns: number;
    pendingWritebacks: number;
  };
  checks: AssuranceParityCheck[];
};

export type AssuranceOverviewPendingWriteback = {
  id: string;
  folderId: string | null;
  agentRunId: string;
  connectorId: string | null;
  connectorName: string | null;
  requestType: string;
  status: string;
  summary: string;
  evidenceRefCount: number;
  primaryFocusId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssessmentSummary = {
  evidenceJobId: string;
  tenantId: string;
  folderId: string | null;
  bundleKind: string;
  inputMode: string;
  generatedAt: string;
  passingEvaluations: number;
  partialEvaluations: number;
  failingEvaluations: number;
  openGaps: number;
  poamOpenItems: number;
  criticalOpenFindings: number;
  highOpenFindings: number;
};

export type EvalResult = {
  id: string;
  evalCode: string;
  title: string;
  status: 'PASS' | 'PARTIAL' | 'FAIL';
  severity: string;
  summary: string;
  rationale: string;
  metrics: Record<string, unknown>;
  evidenceRefs: Array<{ artifact: string; field: string; note?: string }>;
};

export type EvidenceGap = {
  id: string;
  evalResultId: string | null;
  gapType: string;
  severity: string;
  title: string;
  detail: string;
  affectedObjectType: string | null;
  affectedObjectId: string | null;
  controlRefs: string[];
  ksiRefs: string[];
  recommendedArtifact: string | null;
  poamRequired: boolean;
};

export type PoamItem = {
  id: string;
  sourceGapId: string | null;
  identifier: string;
  status: string;
  severity: string;
  weaknessName: string;
  weaknessDescription: string;
  plannedRemediation: string;
  milestoneDueDate: string | null;
  sourceEvalCode: string | null;
  controlRefs: string[];
};

export type EvidenceGraph = {
  nodes: Array<{
    key: string;
    type: string;
    label: string;
    attributes: Record<string, unknown>;
  }>;
  edges: Array<{
    type: string;
    from: string;
    to: string;
    attributes: Record<string, unknown>;
  }>;
};

export type ReviewRecommendation = {
  id: string;
  evidenceJobId?: string | null;
  targetType: string;
  targetId: string;
  title: string;
  summary: string;
  status: string;
  createdAt?: string | null;
  recommendation: Record<string, unknown>;
};

export type ReviewDecision = {
  id: string;
  evidenceJobId?: string | null;
  recommendationId: string;
  recommendationTitle?: string | null;
  targetId?: string | null;
  targetType?: string | null;
  decision: string;
  justification: string;
  evidenceRefs: string[];
  findingRefs: string[];
  controlRefs: string[];
  decidedByUserId: string | null;
  createdAt: string;
  refreshedPackageIds?: string[];
  refreshedPackageCount?: number;
  packageRefreshError?: string | null;
};

export type EvaluationArtifacts = {
  summary: AssessmentSummary;
  evalResults: EvalResult[];
  gaps: EvidenceGap[];
  poamItems: PoamItem[];
  graph: EvidenceGraph;
  correlations: Array<Record<string, unknown>>;
  reasonablenessFindings: Array<{
    id: string;
    title: string;
    status: 'PASS' | 'PARTIAL' | 'FAIL';
    detail: string;
    cadence?: string;
    coverage?: 'reasonable' | 'partial' | 'missing';
    controlRefs?: string[];
    matchedObjectIds?: string[];
  }>;
  liveCollectionCoverage: Record<string, unknown>;
  reviewRecommendations: ReviewRecommendation[];
};

export type AssuranceExplainAudience =
  | 'assessor'
  | 'executive'
  | 'ao'
  | 'derivation'
  | 'reasonableness'
  | 'remediation'
  | 'tracker';

export type AssuranceExplanation = {
  audience: AssuranceExplainAudience;
  provider: 'cloudflare-workers-ai' | 'deterministic-fallback';
  focusId: string | null;
  title: string;
  explanation: string;
  highlights: string[];
  suggestedActions: string[];
  evidenceRefs: string[];
  question: string | null;
  generatedAt: string;
};

export type TrackerImportSummary = {
  id: string;
  tenantId: string;
  folderId: string;
  name: string;
  sourceType: string;
  status: string;
  rowCount: number;
  importedCount: number;
  errorCount: number;
  summary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type TrackerDiagnostic = {
  rowIndex: number;
  rowKey: string | null;
  rowStatus: string;
  category: string | null;
  ownerName: string | null;
  gapType: string | null;
  severity: string | null;
  detail: string;
  controlRefs: string[];
  rawRow: Record<string, unknown>;
};

export type TrackerImportDetail = TrackerImportSummary & {
  diagnostics: TrackerDiagnostic[];
  packages: Array<{
    id: string;
    fileName: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type PackageListItem = {
  id: string;
  tenantId: string;
  folderId: string | null;
  sourceRecord: string | null;
  fileName: string;
  status: string;
  coverage: Record<string, unknown>;
  reconciliationStatus: string | null;
  validationStatus?: string | null;
  validationCheckCount?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type PackageSummary = {
  packageJobId: string;
  evidenceJobId: string;
  packageKey: string;
  manifestKey: string;
  generatedAt: string;
  evaluationCount: number;
  gapCount: number;
  poamCount: number;
  reportManifest: Array<{ role: string; path: string }>;
};

export type PackageEvidenceLink = {
  family: string;
  path: string;
};

export type PackageKsiValidationResult = {
  ksi_id: string;
  eval_code: string;
  title: string;
  status: 'PASS' | 'PARTIAL' | 'FAIL';
  severity: string;
  summary: string;
  rationale: string;
  evidence_refs: Array<{ artifact: string; field: string; note?: string }>;
  metrics: Record<string, unknown>;
};

export type PackageReviewLedgerDecision = {
  id: string;
  recommendation_id: string;
  recommendation_title: string;
  target_type: string;
  target_id: string;
  decision: string;
  justification: string;
  evidence_refs: string[];
  finding_refs: string[];
  control_refs: string[];
  decided_by_user_id: string | null;
  created_at: string;
};

export type PackageReviewLedger = {
  total: number;
  accepted_count: number;
  rejected_count: number;
  other_count: number;
  decisions: PackageReviewLedgerDecision[];
};

export type PackageAgentSecuritySummary = {
  run_id: string | null;
  evaluation_count: number;
  pass_count: number;
  partial_count: number;
  fail_count: number;
  gap_count: number;
  poam_count: number;
  top_non_pass_eval_codes: string[];
  top_gap_titles: string[];
};

export type TwentyXPackageDocument = {
  metadata: {
    schema_version: string;
    generated_at: string;
    evidence_job_id: string;
    package_job_id: string;
    file_name: string;
    bundle_kind?: string;
    input_mode?: string;
    agent_run_id?: string | null;
  };
  summary: {
    pass_count: number;
    partial_count: number;
    fail_count: number;
    gap_count: number;
    poam_count: number;
    review_decision_count: number;
    accepted_review_count: number;
    rejected_review_count: number;
  };
  ksi_validation_results: PackageKsiValidationResult[];
  agent_security_summary?: PackageAgentSecuritySummary;
  findings: Array<Record<string, unknown>>;
  poam_items: PoamItem[];
  review_ledger: PackageReviewLedger;
  evidence_links: PackageEvidenceLink[];
  report_manifest: Array<{ role: string; path: string }>;
};

export type ReconciliationSummary = {
  id: string;
  packageJobId: string;
  evidenceJobId: string;
  status: string;
  checks: Array<{
    id: string;
    expected: number;
    actual: number;
    status: 'match' | 'mismatch';
  }>;
};

export type PackageDetail = {
  job: {
    id: string;
    tenantId: string;
    folderId: string | null;
    fileName: string;
    status: string;
    manifestKey: string | null;
    artifactKey: string | null;
    coverage: Record<string, unknown>;
    errorSummary: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  };
  summary: PackageSummary | null;
  reconciliation: ReconciliationSummary | null;
  packageDocument?: TwentyXPackageDocument | null;
};

export type AgentRunListItem = {
  id: string;
  tenantId: string;
  folderId: string | null;
  evidenceJobId: string | null;
  importJobId: string | null;
  status: string;
  workflowName: string;
  requestedWritebacks: boolean;
  summary: Record<string, unknown>;
  approvalCount: number;
  pendingWritebackCount: number;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WritebackApproval = {
  id: string;
  agentRunId: string;
  connectorId: string | null;
  requestType: string;
  status: string;
  payload: Record<string, unknown>;
  evidenceRefs: string[];
  requestedByUserId: string | null;
  reviewedByUserId: string | null;
  justification: string | null;
  integrationRunId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentRunDetail = {
  id: string;
  tenantId: string;
  folderId: string | null;
  evidenceJobId: string | null;
  importJobId: string | null;
  status: string;
  workflowName: string;
  requestedWritebacks: boolean;
  traceKey: string | null;
  summaryKey: string | null;
  summary: Record<string, unknown>;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  writebacks: WritebackApproval[];
};

export type AgentRunTrace = {
  runId: string;
  workflowName: string;
  status: string;
  generatedAt: string;
  evidenceJobId: string | null;
  importJobId: string | null;
  summary: Record<string, unknown>;
  steps: Array<{
    id: string;
    order: number;
    actionCategory: string;
    actionId: string;
    status: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    startedAt: string;
    finishedAt: string | null;
  }>;
  policyDecisions: Array<{
    id: string;
    actionId: string;
    allowed: boolean;
    category: string;
    reason: string;
    detail: Record<string, unknown>;
  }>;
  pendingWritebacks: string[];
};
