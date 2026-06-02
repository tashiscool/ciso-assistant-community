export type GrcContentKind =
  | 'overview'
  | 'assessment-guide'
  | 'evidence-checklist'
  | 'implementation-guidance'
  | 'workflow-playbook'
  | 'workflow-guidance';

export type FrameworkContentDocument = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  docKind: GrcContentKind;
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
  findingMatchCount?: number;
};

export type FindingEvaluation = {
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
  evaluations: FindingEvaluation[];
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

export type GapAssessmentRow = {
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

export type GapAssessmentDetail = GapAssessmentSummary & {
  summary: {
    statusBuckets: Record<string, number>;
    severityBuckets: Record<string, number>;
    sourceCount: number;
    aiNarrativeAvailable: boolean;
  };
  rows: GapAssessmentRow[];
  evidencePackages: EvidencePackage[];
  reportBundles: ReportBundle[];
  reportSnapshots: GeneratedReportSnapshot[];
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

export type GrcJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type GrcJobRun = {
  id: string;
  jobType: string;
  sourceRef: string | null;
  status: GrcJobStatus | string;
  request: Record<string, unknown>;
  result: Record<string, unknown>;
  diagnostics: unknown[];
  artifactKey: string | null;
  createdByUserId: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GrcJobEnvelope = {
  jobId: string;
  status: GrcJobStatus | string;
  jobType: string;
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
    request?: Record<string, unknown>;
    result?: Record<string, unknown>;
    diagnostics?: unknown[];
  }>;
  settings: GrcAdminSettings;
};

export type ScrutinySufficiencyState =
  | 'draft'
  | 'requested'
  | 'responded'
  | 'accepted'
  | 'challenged'
  | 'clarification_needed'
  | 'still_needed'
  | 'not_applicable';

export type ScrutinyPattern = {
  id: string | null;
  source: 'fedhr_fedramp_import' | 'persisted' | 'scf' | 'questionnaire' | 'generated_fallback';
  sourceRef: string | null;
  controlRef: string;
  scfControlId: string | null;
  questionPrompt: string;
  evidenceType: string;
  evidenceHint: string | null;
  priority: number;
  metadata: Record<string, unknown>;
};

export type ScrutinyReadinessCheck = {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'blocker' | 'info';
  message: string;
  evidence: Record<string, unknown>;
};

export type ScrutinyReadiness = {
  feature: {
    enabled: boolean;
    featureFlag: string;
    message: string;
    tenantSlug: string | null;
  };
  ready: boolean;
  probe: {
    controlRefs: string[];
    packageMarker: string | null;
  };
  counts: {
    folders: {
      root: number;
      domain: number;
      total: number;
    };
    runs: number;
    items: number;
    commentEvents: number;
    materializedLinks: number;
  };
  patternSources: Record<string, number>;
  samplePatterns: ScrutinyPattern[];
  lifecycleApis: string[];
  materializationTargets: string[];
  generatedRecordTags: string[];
  checks: ScrutinyReadinessCheck[];
};

export type ScrutinyRunSummary = {
  id: string;
  folderId: string | null;
  title: string;
  mode: string;
  status: string;
  scope: Record<string, unknown>;
  sourceSummary: Record<string, unknown>;
  metrics: Record<string, unknown>;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScrutinyItem = {
  id: string;
  runId: string;
  patternId: string | null;
  controlRef: string;
  questionPrompt: string;
  evidenceType: string;
  evidenceRequest: string;
  evidenceHint: string | null;
  sufficiencyState: ScrutinySufficiencyState;
  ownerUserId: string | null;
  dataCallRecordId: string | null;
  evidenceRecordIds: string[];
  coverage: Record<string, unknown>;
  reviewerChallenge: boolean;
  missingFeed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ScrutinyCommentEvent = {
  id: string;
  runId: string;
  itemId: string;
  eventType: string;
  author: string;
  body: string;
  source: string;
  relatedEvidenceRefs: string[];
  previousState: string | null;
  nextState: string | null;
  classifier: Record<string, unknown>;
  createdByUserId: string | null;
  createdAt: string;
};

export type ScrutinyMaterializedLink = {
  id: string;
  runId: string;
  itemId: string;
  targetModule: string;
  targetId: string;
  relationType: string;
  route: string | null;
  createdAt: string;
};

export type ScrutinyRunDetail = {
  run: ScrutinyRunSummary;
  items: ScrutinyItem[];
  commentEvents: ScrutinyCommentEvent[];
  materializedLinks: ScrutinyMaterializedLink[];
  metrics: Record<string, unknown>;
};

export type DraftScrutinyRunInput = {
  title?: string;
  folderId?: string | null;
  scope?: {
    type?: 'package' | 'controls' | 'record' | 'default';
    packageMarker?: string;
    controlRefs?: string[];
    moduleKey?: string;
    recordId?: string;
  };
};

export type MaterializeScrutinyRunInput = {
  itemIds?: string[];
  dueOn?: string | null;
  createQuestionnaireTemplate?: boolean;
};

export type ReviewScrutinyItemInput = {
  eventType?: string;
  author?: string;
  body: string;
  source?: string;
  relatedEvidenceRefs?: string[];
  nextState?: ScrutinySufficiencyState;
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

export type ExecutiveReportRequest = {
  assessmentId?: string;
  audience?: 'ciso' | 'ceo-weekly' | 'board' | 'audit-committee';
  title?: string;
};

export type GrcOverview = {
  frameworks: FrameworkLibrarySummary[];
  findings: number;
  assessments: number;
  reportBundles: number;
};

export type FindingsFilters = {
  source?: string;
  severity?: string;
  status?: string;
  framework?: string;
};
