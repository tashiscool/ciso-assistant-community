export type QuestionnaireTemplateKind = 'assessment-plan' | 'questionnaire';

export type QuestionnaireQuestion = {
  id: string;
  ref: string;
  prompt: string;
  type:
    | 'single-select'
    | 'multi-select'
    | 'text'
    | 'number'
    | 'boolean'
    | 'date'
    | 'email'
    | 'phone'
    | 'table'
    | 'instructional'
    | 'file-upload';
  section: string;
  required: boolean;
  weight: number;
  options?: string[];
  helpText?: string | null;
  requirementRef?: string | null;
  evidenceHint?: string | null;
  enableUpload?: boolean;
  maxScore?: number | null;
  answerScores?: Record<string, number> | null;
  tableColumns?: Array<{
    id: string;
    title: string;
    dataType: 'text' | 'number' | 'date' | 'dropdown';
    required: boolean;
    score: number;
    options?: Array<{ value: string; score?: number | null }>;
  }>;
};

export type QuestionnaireRule = {
  id: string;
  name: string;
  description: string;
  logic: 'AND' | 'OR';
  active: boolean;
  conditions: string[];
  actions: string[];
};

export type RuleDiagnostic = {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
};

export type QuestionnaireTemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  templateKind: QuestionnaireTemplateKind;
  audience: string | null;
  scoringMode: string;
  version: number;
  questionCount: number;
  ruleCount: number;
  sourceFramework: string | null;
  usageNotes: string | null;
  questionnaireType: string | null;
  assignmentModel: string | null;
  relatedWorkflow: string | null;
  attestationScope: string | null;
  responseOwnerModel: string | null;
  evidenceCollectionMode: string | null;
  fileUploadGuidance: string | null;
  exportMode: string | null;
  distributionCadence: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  profile: string | null;
  instructions: string | null;
  allowPublicUrl: boolean;
  loginRequired: boolean;
  enableScoring: boolean;
  enableQuestionAssignment: boolean;
  mappedRequirementCount: number;
  instanceCount: number;
  submittedCount: number;
  updatedAt: string;
};

export type QuestionnaireTemplateDetail = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  templateKind: QuestionnaireTemplateKind;
  scoringMode: string;
  audience: string | null;
  version: number;
  questions: QuestionnaireQuestion[];
  metadata: Record<string, unknown> | null;
  sourceFramework: string | null;
  usageNotes: string | null;
  questionnaireType: string | null;
  assignmentModel: string | null;
  relatedWorkflow: string | null;
  attestationScope: string | null;
  responseOwnerModel: string | null;
  evidenceCollectionMode: string | null;
  fileUploadGuidance: string | null;
  exportMode: string | null;
  distributionCadence: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  profile: string | null;
  instructions: string | null;
  allowPublicUrl: boolean;
  loginRequired: boolean;
  enableScoring: boolean;
  enableQuestionAssignment: boolean;
  mappedRequirementCount: number;
  updatedAt: string;
  createdAt: string;
};

export type RuleSetDetail = {
  id: string;
  questionnaireId: string;
  name: string;
  engineVersion: string;
  rules: QuestionnaireRule[];
  diagnostics: RuleDiagnostic[];
  updatedAt: string;
};

export type RuleTestRun = {
  id: string;
  scenarioName: string;
  status: string;
  input: Record<string, unknown>;
  executionLog: string[];
  result: {
    matchedRules: string[];
    visibleQuestions: string[];
    hiddenQuestions: string[];
    disabledQuestions: string[];
    requiredQuestions: string[];
    displayOptions: Record<string, boolean | string>;
    validationErrors: Array<{ ref: string; message: string }>;
    answerUpdates: Record<string, unknown>;
    score: number;
    maxScore: number;
    percentComplete: number;
    passingStatus: string;
    grade: string;
  };
  createdByUserId: string | null;
  createdAt: string;
};

export type RuleValidationResult = {
  diagnostics: RuleDiagnostic[];
};

export type QuestionnaireBuilderDetailResponse = {
  template: QuestionnaireTemplateDetail;
  ruleSet: RuleSetDetail;
  testRuns: RuleTestRun[];
};

export type QuestionnaireInstance = {
  id: string;
  questionnaireId: string;
  templateName: string;
  title: string;
  assignmentType: string;
  assigneeUserId: string | null;
  assigneeEmail: string | null;
  reviewerUserId: string | null;
  parentModule: string | null;
  parentRecordId: string | null;
  status: string;
  dueDate: string | null;
  accessCode: string;
  shareToken: string;
  shareLink: string;
  loginRequired: boolean;
  answers: Record<string, unknown>;
  uploads: Record<string, unknown>;
  headerValues: Record<string, unknown>;
  feedback: Record<string, { rating?: string | null; comment?: string | null }>;
  collaboration: Array<{
    id: string;
    authorUserId: string | null;
    message: string;
    action: string;
    createdAt: string;
    emailQueued?: boolean;
  }>;
  recurrence: Record<string, unknown> | null;
  score: number;
  maxScore: number;
  grade: string | null;
  percentComplete: number;
  passingStatus: string;
  runtime?: {
    visibleQuestions: string[];
    hiddenQuestions: string[];
    disabledQuestions: string[];
    requiredQuestions: string[];
    displayOptions: Record<string, boolean | string>;
    validationErrors: Array<{ ref: string; message: string }>;
  };
  submittedAt: string | null;
  reviewedAt: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};
