export type QuestionnaireQuestion = {
  id: string;
  ref: string;
  prompt: string;
  type: 'single-select' | 'multi-select' | 'text' | 'number' | 'boolean';
  section: string;
  required: boolean;
  weight: number;
  options?: string[];
  helpText?: string | null;
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
  audience: string | null;
  scoringMode: string;
  version: number;
  questionCount: number;
  ruleCount: number;
  updatedAt: string;
};

export type QuestionnaireTemplateDetail = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  scoringMode: string;
  audience: string | null;
  version: number;
  questions: QuestionnaireQuestion[];
  metadata: Record<string, unknown> | null;
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
    score: number;
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
