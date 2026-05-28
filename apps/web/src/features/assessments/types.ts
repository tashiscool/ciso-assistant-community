export type Perimeter = {
  id: string;
  tenantId: string;
  folderId: string;
  folderName: string;
  refId: string | null;
  name: string;
  description: string | null;
  lcStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type RiskRegister = {
  id: string;
  tenantId: string;
  folderId: string | null;
  folderName: string | null;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RiskScenario = {
  id: string;
  tenantId: string;
  registerId: string;
  registerName: string;
  title: string;
  description: string | null;
  likelihood: number | null;
  impact: number | null;
  inherentScore: number | null;
  residualScore: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type RiskAssessment = {
  id: string;
  tenantId: string;
  folderId: string;
  folderName: string;
  perimeterId: string | null;
  perimeterName: string | null;
  riskRegisterId: string | null;
  riskRegisterName: string | null;
  refId: string | null;
  name: string;
  version: string;
  status: string;
  observation: string | null;
  scenarioCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ComplianceAssessment = {
  id: string;
  tenantId: string;
  folderId: string;
  folderName: string;
  perimeterId: string | null;
  perimeterName: string | null;
  frameworkId: string;
  frameworkName: string;
  refId: string | null;
  name: string;
  version: string;
  status: string;
  assessmentKind: string;
  leadAssessorUserId: string | null;
  instructions: string | null;
  plannedStartOn: string | null;
  plannedFinishOn: string | null;
  processInfo: string | null;
  assignmentPrincipalType: string | null;
  assignmentPrincipalId: string | null;
  recurrence: Record<string, unknown> | null;
  sourceSecurityPlanId: string | null;
  assessmentPlanTemplateId: string | null;
  assessmentPlanName: string | null;
  recurrenceSourceAssessmentId: string | null;
  observation: string | null;
  controlsTotal: number;
  controlsAssessed: number;
  progressPercent: number;
  maturityScore: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ComplianceAssessmentPlanItem = {
  id: string;
  tenantId: string;
  complianceAssessmentId: string;
  assessmentPlanTemplateId: string;
  assessmentPlanName: string | null;
  templateQuestionId: string | null;
  lineRef: string;
  lineSection: string | null;
  linePrompt: string;
  requirementRef: string | null;
  evidenceHint: string | null;
  sortOrder: number;
  result: string;
  observation: string | null;
  evidenceNote: string | null;
  gapsDifferences: string | null;
  likelihood: number | null;
  impact: number | null;
  autoGenerateFollowUp: boolean;
  generatedFollowUpId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ComplianceRequirementAssessment = {
  id: string;
  tenantId: string;
  complianceAssessmentId: string;
  controlId: string;
  frameworkId: string;
  frameworkName: string;
  controlRef: string;
  controlTitle: string;
  controlDescription: string | null;
  inScope: boolean;
  sortOrder: number;
  result: string;
  observation: string | null;
  evidenceNote: string | null;
  gapsDifferences: string | null;
  likelihood: number | null;
  impact: number | null;
  autoGenerateFollowUp: boolean;
  evidenceStatus: string;
  implementationScore: number | null;
  documentationScore: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AppliedControl = {
  id: string;
  tenantId: string;
  complianceAssessmentId: string;
  requirementAssessmentId: string | null;
  assessmentPlanItemId: string | null;
  folderId: string;
  folderName: string;
  refId: string | null;
  name: string;
  description: string | null;
  status: string;
  priority: string | null;
  category: string | null;
  csfFunction: string | null;
  ownerName: string | null;
  eta: string | null;
  expiryDate: string | null;
  controlImpact: number | null;
  effort: string | null;
  annualCost: number | null;
  notes: string | null;
  isGenerated: boolean;
  requirementAssessment: {
    id: string;
    ref: string;
    name: string;
    result: string | null;
  } | null;
  assessmentPlanItem: {
    id: string;
    ref: string;
    prompt: string;
    result: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type RiskActionPlanItem = {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  status: string;
  priority: string;
  inherentScore: number;
  residualScore: number;
  annualCost: number;
  effort: string;
  recommendedAction: string;
  targetRoute: string;
};
