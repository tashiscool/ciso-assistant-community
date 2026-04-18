export type PolicyBuilderStatus = 'Draft' | 'Running' | 'Finished';
export type PolicyBuilderStageStatus = 'Complete' | 'Running' | 'Queued' | 'Attention';
export type QueueSourceType = 'Profile' | 'Catalog';
export type ComplianceExportFamily = 'RegScale' | 'OSCAL' | 'eMASS' | 'FedRAMP' | 'Word';
export type ComplianceExportFormat = 'JSON' | 'XML' | 'Excel' | 'Word';
export type ComplianceExportStatus = 'Ready' | 'Running' | 'Blocked';

export type PolicyControl = {
  controlId: string;
  title: string;
  family: string;
  description: string;
};

export type PolicyProfile = {
  id: string;
  label: string;
  description: string;
  catalogues: string[];
  controls: PolicyControl[];
};

export type PolicyCatalogue = {
  name: string;
  controls: PolicyControl[];
};

export type QueueItem = {
  id: string;
  sourceType: QueueSourceType;
  sourceName: string;
  controlId: string;
  title: string;
  family: string;
  description: string;
};

export type CreatedRequirement = {
  id: string;
  sourceControlId: string;
  title: string;
  description: string;
  family: string | null;
  status: string;
  assignee: string | null;
  sourceName: string;
  createdAt: string;
};

export type PolicyBuilderSessionSummary = {
  id: string;
  title: string;
  owner: string;
  status: PolicyBuilderStatus;
  policyLocation: string;
  queuedControls: number;
  selectedProfiles: string[];
  lastSavedAt: string;
};

export type PolicyBuilderPipelineStep = {
  id: string;
  title: string;
  owner: string;
  writeTarget: string;
  helper: string;
  metric: string;
  status: PolicyBuilderStageStatus;
};

export type PolicyBuilderWorkspace = {
  policyContext: {
    id: string;
    name: string;
    owner: string;
    location: string;
    readiness: {
      profilesConfigured: boolean;
      controlCataloguesLoaded: boolean;
      canEditPolicy: boolean;
      existingRequirementCount: number;
    };
  };
  profiles: PolicyProfile[];
  catalogues: PolicyCatalogue[];
  sessions: PolicyBuilderSessionSummary[];
};

export type PolicyBuilderSessionDetail = {
  session: {
    id: string;
    title: string;
    owner: string;
    status: PolicyBuilderStatus;
    policyLocation: string;
    selectedProfiles: string[];
    lastSavedAt: string;
    createdAt: string;
  };
  queue: QueueItem[];
  createdRequirements: CreatedRequirement[];
  existingRequirementIds: string[];
  queueSummary: Array<{ sourceName: string; count: number }>;
  pipeline: PolicyBuilderPipelineStep[];
};

export type ComplianceExportOption = {
  id: string;
  section: string;
  family: ComplianceExportFamily;
  format: ComplianceExportFormat;
  extension: string;
  title: string;
  description: string;
  prerequisite: string;
  scope: string;
  ready: boolean;
  blockedReason: string | null;
};

export type ComplianceExportReadinessRow = {
  field: string;
  status: 'Met' | 'Missing' | 'Derived';
  notes: string;
};

export type ComplianceExportReadiness = {
  systemCategorizationReady: boolean;
  assessmentsCount: number;
  findingsCount: number;
  evidenceCount: number;
  exportsCount: number;
  inventorySignals: number;
  rows: ComplianceExportReadinessRow[];
};

export type ComplianceExportJob = {
  id: string;
  title: string;
  family: ComplianceExportFamily;
  format: ComplianceExportFormat;
  sourceRecord: string;
  fileName: string;
  status: ComplianceExportStatus;
  readiness: ComplianceExportReadinessRow[];
  artifactKey: string | null;
  queueDepth: number;
  createdAt: string;
  updatedAt: string;
  filesPath: string | null;
  downloadPath: string;
};

export type ComplianceExportPipelineStep = {
  id: string;
  title: string;
  owner: string;
  writeTarget: string;
  helper: string;
  metric: string;
  status: 'Complete' | 'Running' | 'Queued' | 'Attention';
};

export type ComplianceExportsWorkspace = {
  readiness: ComplianceExportReadiness;
  sections: Array<{
    id: string;
    title: string;
    options: ComplianceExportOption[];
  }>;
  jobs: ComplianceExportJob[];
  filesPanel: {
    totalGenerated: number;
    totalBlocked: number;
    latestGenerated: string | null;
  };
};

export type ResponseAutomationSourceType = 'Policy' | 'Questionnaire' | 'Security Plan' | 'Evidence';
export type ResponseAutomationJobStatus = 'In Progress' | 'Finished' | 'Needs Review';

export type ResponseAutomationSource = {
  id: string;
  type: ResponseAutomationSourceType;
  label: string;
  description: string;
  freshness: string;
  sourceRecordId: string;
};

export type ResponseAutomationHealth = {
  regmlEnabled: boolean;
  responseAutomationEnabled: boolean;
  regmlBackendAvailable: boolean;
  vectorDatabaseDeployed: boolean;
  harvesterProcessedSources: boolean;
  environmentHealthy: boolean;
  runtimeProvider: string;
  vectorCount: number;
};

export type ResponseAutomationJobSummary = {
  id: string;
  title: string;
  sourceDocument: string;
  sourceIds: string[];
  status: ResponseAutomationJobStatus;
  createdAt: string;
  updatedAt: string;
  questionCount: number;
  exportFormat: string;
  reviewAcceptedCount: number;
  exportDownloadPath: string | null;
};

export type ResponseAutomationItem = {
  id: string;
  question: string;
  answer: string;
  confidence: number;
  citations: string[];
  retrievalScore: number;
  accepted: boolean;
  reviewState: string;
  sourceIds: string[];
};

export type ResponseAutomationJobDetail = {
  job: ResponseAutomationJobSummary;
  items: ResponseAutomationItem[];
  pipeline: Array<{
    id: string;
    title: string;
    owner: string;
    writeTarget: string;
    helper: string;
    metric: string;
    status: 'Complete' | 'Running' | 'Queued' | 'Attention';
  }>;
  session: {
    id: string;
    owner: string;
    shard: string;
    heartbeat: string;
    leaseExpiresAt: string;
    autosaveStatus: string;
    currentPage: number;
    perPage: number;
  };
};

export type ResponseAutomationWorkspace = {
  health: ResponseAutomationHealth;
  sources: ResponseAutomationSource[];
  jobs: ResponseAutomationJobSummary[];
};

export type EvidenceMappingType = 'Security Plan' | 'Component' | 'Control';

export type EvidenceMappingRecordSummary = {
  id: string;
  title: string;
  objectKey: string;
  contentType: string | null;
  sourceName: string;
  uploadedAt: string;
  mappingCount: number;
  recommendationCount: number;
  status: string;
};

export type EvidenceMappingTarget = {
  id: string;
  mappingType: EvidenceMappingType;
  title: string;
  parentLabel: string;
  description: string;
};

export type EvidenceMappingRecord = {
  id: string;
  mappedId: string;
  mappingType: EvidenceMappingType;
  mappingTitle: string;
  parentLabel: string | null;
  lineage: string | null;
  createdAt: string;
};

export type EvidenceMappingRecommendation = {
  id: string;
  mappedId: string;
  mappingType: EvidenceMappingType;
  title: string;
  parentLabel: string;
  rationale: string;
  score: number;
};

export type EvidenceMappingDetail = {
  artifact: {
    id: string;
    title: string;
    objectKey: string;
    contentType: string | null;
    sizeBytes: number | null;
    checksum: string | null;
    uploadedAt: string;
    sourceName: string;
  };
  mappings: EvidenceMappingRecord[];
  targets: {
    securityPlans: EvidenceMappingTarget[];
    components: EvidenceMappingTarget[];
    controls: EvidenceMappingTarget[];
  };
  recommendations: {
    runId: string;
    threshold: number;
    createdAt: string;
    items: EvidenceMappingRecommendation[];
  } | null;
};

export type EvidenceMappingWorkspace = {
  readiness: {
    evidenceModuleEnabled: boolean;
    canMapEvidence: boolean;
    evidenceRecords: number;
    targetSecurityPlans: number;
    targetComponents: number;
    targetControls: number;
    aiRecommendationsAvailable: boolean;
    vectorDatabaseDeployed: boolean;
  };
  records: EvidenceMappingRecordSummary[];
};

export type RegmlWorkspaceMode = 'SSP Author' | 'Auditor' | 'AI Generator';
export type RegmlPromptMode = 'Build' | 'Plan';
export type RegmlAttemptStatus = 'Draft' | 'Applied' | 'Needs Review';
export type RegmlFeatureAvailability = 'Ready' | 'Pending Terms' | 'Locked';
export type RegmlDeploymentMode = 'SaaS' | 'Local';

export type RegmlTextMessage = {
  id: string;
  type: 'text';
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type RegmlWarningMessage = {
  id: string;
  type: 'warning';
  role: 'assistant';
  title: string;
  content: string;
  createdAt: string;
};

export type RegmlPlanMessage = {
  id: string;
  type: 'plan';
  role: 'assistant';
  title: string;
  steps: string[];
  createdAt: string;
};

export type RegmlVersionMessage = {
  id: string;
  type: 'version';
  role: 'assistant';
  attemptId: string;
  createdAt: string;
};

export type RegmlMessage =
  | RegmlTextMessage
  | RegmlWarningMessage
  | RegmlPlanMessage
  | RegmlVersionMessage;

export type RegmlAttempt = {
  id: string;
  mode: RegmlWorkspaceMode;
  versionLabel: string;
  title: string;
  summary: string[];
  beforeItems: string[];
  afterItems: string[];
  status: RegmlAttemptStatus;
  coverage: number;
  confidence: number;
  nodesChanged: number;
  creditsCost: number;
  issues: number;
  createdAt: string;
};

export type RegmlSession = {
  mode: RegmlWorkspaceMode;
  creditsQuota: number;
  creditsRemaining: number;
  prompt: string;
  promptMode: RegmlPromptMode;
  sourceSet: string;
  sourceOptions: string[];
  lowCreditBannerDismissed: boolean;
  selectedAttemptId?: string | null;
  streaming: boolean;
  queueDepth: number;
  lastHeartbeat: string;
  messages: RegmlMessage[];
  attempts: RegmlAttempt[];
  context: {
    organizationName: string;
    workspaceLabel: string;
    primaryFramework: string;
    issueThreshold: number | null;
    sourceCoverage: string[];
    modeFocus: string[];
  };
};

export type RegmlFeatureCard = {
  id: string;
  name: string;
  description: string;
  availability: RegmlFeatureAvailability;
  supportedContext: string;
  route: string;
  contextual: boolean;
};

export type RegmlWorkspace = {
  settings: {
    enabled: boolean;
    termsAccepted: boolean;
    deploymentMode: RegmlDeploymentMode;
    backendAvailable: boolean;
    statusLabel: string;
    chatbotVisible: boolean;
    toolsVisible: boolean;
    modulesFeaturesPath: string;
    saveInstructions: string;
    updatedAt: string;
    runtimeProvider: string;
  };
  health: {
    environmentHealthy: boolean;
    policiesCount: number;
    questionnairesCount: number;
    securityPlansCount: number;
    evidenceCount: number;
    controlsCount: number;
    componentsCount: number;
    issueThreshold: number | null;
    vectorDatabaseDeployed: boolean;
  };
  deploymentGuidance: {
    saas: string[];
    local: string[];
  };
  features: RegmlFeatureCard[];
  sessions: Record<RegmlWorkspaceMode, RegmlSession>;
};
