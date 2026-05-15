export type FindingEvaluationStatus = 'pass' | 'fail' | 'not_applicable' | 'inconclusive' | 'skipped';

export type MetricV1 = {
  schema_version: string;
  metric_key: string;
  name: string;
  description?: string | null;
  unit?: string | null;
  measured_at: string;
  value: number;
  dimensions?: Record<string, string | number | boolean | null>;
  source_ref?: string | null;
  [key: string]: unknown;
};

export type RiskV1 = {
  schema_version: string;
  risk_id: string;
  title: string;
  owner?: string | null;
  status?: string | null;
  inherent_score?: number | null;
  residual_score?: number | null;
  linked_findings?: string[];
  [key: string]: unknown;
};

export type ExceptionV1 = {
  schema_version: string;
  exception_id: string;
  title: string;
  status: string;
  severity?: string | null;
  owner?: string | null;
  due_date?: string | null;
  [key: string]: unknown;
};

export type VendorV1 = {
  schema_version: string;
  vendor_id: string;
  name: string;
  tier?: string | null;
  status?: string | null;
  last_review?: string | null;
  [key: string]: unknown;
};

export type PolicyV1 = {
  schema_version: string;
  policy_id: string;
  title: string;
  status?: string | null;
  review_due_at?: string | null;
  [key: string]: unknown;
};

export type FindingV1 = {
  schema_version: string;
  source: string;
  source_version: string;
  run_id: string;
  collected_at: string;
  resource: {
    type: string;
    id: string;
    arn?: string;
    region?: string;
    account_id?: string;
    [key: string]: unknown;
  };
  evaluations: Array<{
    control_framework: string;
    control_id: string;
    status: FindingEvaluationStatus;
    severity?: 'critical' | 'high' | 'medium' | 'low' | 'info' | null;
    title?: string | null;
    message?: string | null;
    evidence_refs?: string[];
    remediation?: {
      summary?: string | null;
      ref?: string | null;
      effort_hours?: number | null;
      automation?: string | null;
    } | null;
    [key: string]: unknown;
  }>;
  evidence_refs?: string[];
  [key: string]: unknown;
};

export type FrameworkContentDocument = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  docKind: 'overview' | 'assessment-guide' | 'evidence-checklist' | 'implementation-guidance' | 'workflow-playbook' | 'workflow-guidance';
  bodyMarkdown?: string;
  sourcePath: string;
  sourceRevision: string;
  importedAt: string;
};

export type FrameworkLibrarySummary = {
  id: string;
  slug: string;
  frameworkKey: string;
  name: string;
  description: string | null;
  version: string | null;
  category: string;
  tags: string[];
  scfFrameworkId: string | null;
  crosswalkReady: boolean;
  documentCount: number;
  updatedAt: string;
};

export type FrameworkKnowledgeDetail = FrameworkLibrarySummary & {
  documents: FrameworkContentDocument[];
};

export type CrosswalkResolution = {
  framework: string;
  controlId: string;
  scfControls: Array<{
    controlId: string;
    title: string;
    familyCode: string | null;
    familyName: string | null;
    description: string | null;
  }>;
  targets: Array<{
    frameworkId: string;
    frameworkName: string;
    controlIds: string[];
  }>;
};

export type FindingSummary = {
  id: string;
  source: string;
  sourceVersion: string;
  upstreamRunId: string;
  collectedAt: string;
  resourceType: string;
  resourceId: string;
  region: string | null;
  accountId: string | null;
  statusSummary: string;
  severitySummary: string;
  evaluationCount: number;
  scfMatchCount: number;
  evidenceRefCount: number;
};

export type FindingDetail = FindingSummary & {
  resourceArn: string | null;
  evidenceRefs: string[];
  rawPayloadJson?: Record<string, unknown> | null;
  evaluations: Array<{
    id: string;
    controlFramework: string;
    controlId: string;
    status: string;
    severity: string | null;
    title: string | null;
    message: string | null;
    remediationSummary: string | null;
    remediationRef: string | null;
    evidenceRefs: string[];
    scfControlIds: string[];
  }>;
};

export type GapAssessmentRequest = {
  title?: string;
  frameworks: string[];
  sources?: string[];
  severities?: string[];
  statuses?: string[];
};

export type GapAssessmentSummary = {
  id: string;
  title: string;
  frameworks: string[];
  sources: string[];
  status: string;
  findingsCount: number;
  gapCount: number;
  createdAt: string;
  updatedAt: string;
};

export type GapAssessmentDetail = GapAssessmentSummary & {
  summary: {
    statusBuckets: Record<string, number>;
    severityBuckets: Record<string, number>;
    sourceCount: number;
    aiNarrativeAvailable: boolean;
  };
  rows: Array<{
    id: string;
    scfControlId: string;
    sourceFramework: string;
    title: string;
    description: string | null;
    status: string;
    severity: string;
    mappedTargets: Array<{
      frameworkId: string;
      frameworkName: string;
      controlIds: string[];
    }>;
    relatedFindingIds: string[];
    evidenceRefs: string[];
    remediation: Record<string, unknown>;
  }>;
  evidencePackages: EvidencePackage[];
  reportBundles: ReportBundle[];
  reportSnapshots: GeneratedReportSnapshot[];
};

export type ReportBundle = {
  id: string;
  assessmentId: string;
  title: string;
  status: string;
  reportFamily: string;
  aiProvider: string | null;
  narrativeSummary: string | null;
  createdAt: string;
  updatedAt: string;
  manifest: Record<string, unknown>;
  downloadPath: string;
};

export type ConnectorRun = {
  id: string;
  source: string;
  status: string;
  mode: 'live' | 'fixture' | 'dry-run';
  sourceVersion: string;
  findingsCreated: number;
  startedAt: string;
  finishedAt: string | null;
  triggeredByUserId: string | null;
  summary: Record<string, unknown>;
};

export type CollectorStatus = {
  source: string;
  connectorId: string | null;
  label: string;
  provider: string;
  category: string;
  authReady: boolean;
  status: string;
  collectionMode: 'live' | 'fixture' | 'mixed';
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  runCount: number;
  sourceVersion: string | null;
  readyMessage: string;
  capabilities: string[];
};

export type EvidencePackage = {
  id: string;
  assessmentId: string | null;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  manifest: Record<string, unknown>;
  downloadPath: string;
};

export type ExecutiveReportRequest = {
  assessmentId?: string;
  audience?: 'ciso' | 'ceo-weekly' | 'board' | 'audit-committee';
  title?: string;
};

export type GeneratedReportSnapshot = {
  id: string;
  reportKind: 'exec-summary' | 'board-brief' | 'program-health' | 'automation-coverage';
  title: string;
  status: string;
  aiProvider: string | null;
  createdAt: string;
  updatedAt: string;
  summary: Record<string, unknown>;
  contentMarkdown: string;
  downloadPath: string;
};

export type ProgramHealthReport = GeneratedReportSnapshot & {
  reportKind: 'program-health';
};

export type AutomationCoverageSnapshot = {
  id: string;
  measuredAt: string;
  metricKey: string;
  name: string;
  value: number;
  unit: string | null;
  dimensions: Record<string, string | number | boolean | null>;
  sourceRef: string | null;
};

export type GrcAdminSettings = {
  defaultProvider: 'cloudflare-workers-ai' | 'openai-responses';
  openaiEnabled: boolean;
  openaiModel: string | null;
};

export type GrcAdminStatus = {
  latestSnapshot: {
    id: string;
    sourceRevision: string;
    importedAt: string;
    summary: Record<string, unknown>;
  } | null;
  frameworkCount: number;
  documentCount: number;
  scfVersion: string | null;
  scfFrameworkCount: number;
  status: {
    findings: number;
    assessments: number;
    reportBundles: number;
    evidencePackages: number;
    openExceptions: number;
    metricPoints: number;
    recentJobs: number;
  };
  connectors: CollectorStatus[];
  recentJobs: Array<{
    id: string;
    jobType: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    sourceRef: string | null;
  }>;
  settings: GrcAdminSettings;
};

export type GrcStatus = {
  latestSnapshot: GrcAdminStatus['latestSnapshot'];
  scfVersion: string | null;
  findings: number;
  assessments: number;
  reportBundles: number;
  evidencePackages: number;
  openExceptions: number;
  metricPoints: number;
  connectors: CollectorStatus[];
  recentJobs: GrcAdminStatus['recentJobs'];
};
