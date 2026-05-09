import type { EnvBindings } from '../../types/env';

export type EvidenceInputMode = 'live' | 'fixture' | 'tracker';
export type BundleKind = 'assessment' | 'threat-hunt' | '20x' | 'tracker-to-20x';
export type AssuranceEvalStatus = 'PASS' | 'PARTIAL' | 'FAIL';
export type AssuranceSeverity = 'critical' | 'high' | 'moderate' | 'low';

export type DeclaredInventoryRecord = {
  assetId: string;
  name: string;
  assetType: string;
  environment: string;
  owner?: string | null;
  region?: string | null;
  accountId?: string | null;
  inBoundary: boolean;
  scannerRequired: boolean;
  logRequired: boolean;
  isPublic?: boolean;
  expectedPrivateIp?: string | null;
  expectedPublicIp?: string | null;
  metadata?: Record<string, unknown>;
};

export type AssetRecord = {
  assetId: string;
  name: string;
  assetType: string;
  environment: string;
  owner?: string | null;
  region?: string | null;
  accountId?: string | null;
  inBoundary: boolean;
  isPublic: boolean;
  privateIps: string[];
  publicIps: string[];
  metadata?: Record<string, unknown>;
};

export type SecurityEventRecord = {
  eventId: string;
  assetId?: string | null;
  semanticType: string;
  severity: AssuranceSeverity;
  status: string;
  centralEventRef?: string | null;
  localEventRef?: string | null;
  title: string;
  metadata?: Record<string, unknown>;
};

export type ScannerTargetRecord = {
  targetId: string;
  assetId?: string | null;
  scannerName: string;
  hostname?: string | null;
  ipAddress?: string | null;
  credentialed: boolean;
  lastScanTime?: string | null;
  metadata?: Record<string, unknown>;
};

export type ScannerFindingRecord = {
  findingId: string;
  assetId?: string | null;
  severity: AssuranceSeverity;
  status: string;
  title: string;
  cveIds: string[];
  linkedTicketIds: string[];
  exploitationReview: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type LogSourceRecord = {
  sourceId: string;
  assetId?: string | null;
  sourceType?: string | null;
  localSource?: string | null;
  centralDestination?: string | null;
  status: string;
  sampleLocalEventRef?: string | null;
  sampleCentralEventRef?: string | null;
  lastSeen?: string | null;
  metadata?: Record<string, unknown>;
};

export type AlertRuleRecord = {
  ruleId: string;
  name: string;
  enabled: boolean;
  semanticTypes: string[];
  recipients: string[];
  lastFired?: string | null;
  metadata?: Record<string, unknown>;
};

export type TicketRecord = {
  ticketId: string;
  title: string;
  status: string;
  linkedAssetIds: string[];
  linkedEventIds: string[];
  linkedFindingIds: string[];
  hasSecurityImpactAnalysis: boolean;
  hasTestingEvidence: boolean;
  hasApproval: boolean;
  hasDeploymentEvidence: boolean;
  hasVerificationEvidence: boolean;
  metadata?: Record<string, unknown>;
};

export type SeededPoamRecord = {
  poamId: string;
  title: string;
  status: string;
  severity: AssuranceSeverity;
  metadata?: Record<string, unknown>;
};

export type NormalizedEvidenceBundle = {
  tenantId: string;
  folderId: string | null;
  inputMode: EvidenceInputMode;
  bundleKind: BundleKind;
  sourceName: string;
  provider: string;
  collectedAt: string;
  schemaVersion: string;
  declaredInventory: DeclaredInventoryRecord[];
  discoveredAssets: AssetRecord[];
  cloudEvents: SecurityEventRecord[];
  scannerTargets: ScannerTargetRecord[];
  scannerFindings: ScannerFindingRecord[];
  centralLogSources: LogSourceRecord[];
  alertRules: AlertRuleRecord[];
  tickets: TicketRecord[];
  seededPoam: SeededPoamRecord[];
  metadata: Record<string, unknown>;
};

export type EvidenceCoverageSummary = {
  declaredInventoryCount: number;
  discoveredAssetCount: number;
  cloudEventCount: number;
  scannerTargetCount: number;
  scannerFindingCount: number;
  centralLogSourceCount: number;
  alertRuleCount: number;
  ticketCount: number;
  seededPoamCount: number;
  inBoundaryAssetCount: number;
  publicAssetCount: number;
};

export type EvalResult = {
  id: string;
  evalCode: string;
  title: string;
  status: AssuranceEvalStatus;
  severity: AssuranceSeverity;
  summary: string;
  rationale: string;
  metrics: Record<string, unknown>;
  evidenceRefs: Array<{ artifact: string; field: string; note?: string }>;
};

export type EvidenceGap = {
  id: string;
  evalResultId: string | null;
  gapType: string;
  severity: AssuranceSeverity;
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
  severity: AssuranceSeverity;
  weaknessName: string;
  weaknessDescription: string;
  plannedRemediation: string;
  milestoneDueDate: string | null;
  sourceEvalCode: string | null;
  controlRefs: string[];
};

export type ReasonablenessFinding = {
  id: string;
  title: string;
  status: AssuranceEvalStatus;
  detail: string;
  cadence?: string;
  coverage?: 'reasonable' | 'partial' | 'missing';
  controlRefs?: string[];
  matchedObjectIds?: string[];
};

export type ReviewRecommendation = {
  id: string;
  evidenceJobId?: string | null;
  targetType: string;
  targetId: string;
  title: string;
  summary: string;
  status: string;
  recommendation: Record<string, unknown>;
};

export type ReviewDecision = {
  id: string;
  recommendationId: string;
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

export type GraphNode = {
  key: string;
  type: string;
  label: string;
  attributes: Record<string, unknown>;
};

export type GraphEdge = {
  type: string;
  from: string;
  to: string;
  attributes: Record<string, unknown>;
};

export type EvidenceGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type AssessmentSummary = {
  evidenceJobId: string;
  tenantId: string;
  folderId: string | null;
  bundleKind: BundleKind;
  inputMode: EvidenceInputMode;
  generatedAt: string;
  passingEvaluations: number;
  partialEvaluations: number;
  failingEvaluations: number;
  openGaps: number;
  poamOpenItems: number;
  criticalOpenFindings: number;
  highOpenFindings: number;
};

export type EvaluationArtifacts = {
  summary: AssessmentSummary;
  evalResults: EvalResult[];
  gaps: EvidenceGap[];
  poamItems: PoamItem[];
  graph: EvidenceGraph;
  correlations: Array<Record<string, unknown>>;
  reasonablenessFindings: ReasonablenessFinding[];
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

export type TwentyXPackageSummary = {
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

export type AgentStepTrace = {
  id: string;
  order: number;
  actionCategory: string;
  actionId: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  startedAt: string;
  finishedAt: string | null;
};

export type AgentPolicyDecisionTrace = {
  id: string;
  actionId: string;
  allowed: boolean;
  category: string;
  reason: string;
  detail: Record<string, unknown>;
};

export type AgentRunTrace = {
  runId: string;
  workflowName: string;
  status: string;
  generatedAt: string;
  evidenceJobId: string | null;
  importJobId: string | null;
  summary: Record<string, unknown>;
  steps: AgentStepTrace[];
  policyDecisions: AgentPolicyDecisionTrace[];
  pendingWritebacks: string[];
};

export type WritebackApprovalRecord = {
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

export type BundlePersistenceContext = {
  env: EnvBindings;
  tenantId: string;
  folderId: string | null;
  evidenceJobId: string;
};
