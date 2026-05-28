import type { WorkerRequestContext } from '../../router';
import { requireAnyPermission } from '../../authorization';
import { handleDashboardBuilderRoutes } from './dashboards';
import { handleExportBuilderRoutes } from './exports';
import { handleFormBuilderRoutes } from './forms';
import { handleReportBuilderRoutes } from './reports';
import { handleWayfinderBuilderRoutes } from './wayfinder';
import { json, methodNotAllowed, readJson } from '../../utils/http';

type QuestionnaireQuestion = {
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

type QuestionnaireTemplateKind = 'assessment-plan' | 'questionnaire';

type QuestionnaireRule = {
  id: string;
  name: string;
  description: string;
  logic: 'AND' | 'OR';
  active: boolean;
  conditions: string[];
  actions: string[];
};

type RuleDiagnostic = {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
};

type QuestionnaireTemplateRow = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: string;
  scoring_mode: string;
  audience: string | null;
  version: number;
  questions_json: string;
  metadata_json: string | null;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type QuestionnaireRuleSetRow = {
  id: string;
  questionnaire_template_id: string;
  name: string;
  engine_version: string;
  rules_json: string;
  diagnostics_json: string | null;
  updated_at: string;
};

type QuestionnaireTestRunRow = {
  id: string;
  scenario_name: string;
  input_json: string;
  execution_log_json: string;
  result_json: string;
  status: string;
  created_by_user_id: string | null;
  created_at: string;
};

type QuestionnaireInstanceRow = {
  id: string;
  tenant_id: string;
  questionnaire_template_id: string;
  title: string;
  assignment_type: string;
  assignee_user_id: string | null;
  assignee_email: string | null;
  reviewer_user_id: string | null;
  parent_module: string | null;
  parent_record_id: string | null;
  status: string;
  due_date: string | null;
  access_code: string;
  share_token: string;
  login_required: number;
  answers_json: string;
  uploads_json: string;
  header_values_json: string;
  feedback_json: string;
  collaboration_json: string;
  recurrence_json: string | null;
  score: number;
  max_score: number;
  grade: string | null;
  percent_complete: number;
  passing_status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
};

type CreateQuestionnaireInput = {
  name?: string;
  description?: string | null;
  audience?: string | null;
  templateKind?: QuestionnaireTemplateKind;
  sourceFramework?: string | null;
  usageNotes?: string | null;
  questionnaireType?: string | null;
  assignmentModel?: string | null;
  relatedWorkflow?: string | null;
  attestationScope?: string | null;
  responseOwnerModel?: string | null;
  evidenceCollectionMode?: string | null;
  fileUploadGuidance?: string | null;
  exportMode?: string | null;
  distributionCadence?: string | null;
  ownerUserId?: string | null;
  ownerName?: string | null;
  profile?: string | null;
  instructions?: string | null;
  allowPublicUrl?: boolean;
  loginRequired?: boolean;
  enableScoring?: boolean;
  enableQuestionAssignment?: boolean;
};

type UpdateQuestionnaireInput = {
  name?: string;
  description?: string | null;
  status?: string;
  templateKind?: QuestionnaireTemplateKind;
  scoringMode?: string;
  audience?: string | null;
  sourceFramework?: string | null;
  usageNotes?: string | null;
  questionnaireType?: string | null;
  assignmentModel?: string | null;
  relatedWorkflow?: string | null;
  attestationScope?: string | null;
  responseOwnerModel?: string | null;
  evidenceCollectionMode?: string | null;
  fileUploadGuidance?: string | null;
  exportMode?: string | null;
  distributionCadence?: string | null;
  ownerUserId?: string | null;
  ownerName?: string | null;
  profile?: string | null;
  instructions?: string | null;
  allowPublicUrl?: boolean;
  loginRequired?: boolean;
  enableScoring?: boolean;
  enableQuestionAssignment?: boolean;
  questions?: QuestionnaireQuestion[];
};

type UpdateRuleSetInput = {
  name?: string;
  rules?: QuestionnaireRule[];
};

type RunRuleTestInput = {
  scenarioName?: string;
  answers?: Record<string, unknown>;
  draftRules?: QuestionnaireRule[];
  draftQuestions?: QuestionnaireQuestion[];
};

type AssignmentInput = {
  assignmentType?: 'user' | 'email' | 'module' | 'self' | 'recurring' | 'bulk';
  title?: string;
  assigneeUserId?: string | null;
  assigneeEmail?: string | null;
  assigneeEmails?: string[];
  bulkCsv?: string | null;
  reviewerUserId?: string | null;
  parentModule?: string | null;
  parentRecordId?: string | null;
  dueDate?: string | null;
  recurrenceType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  loginRequired?: boolean;
};

type ResponseUpdateInput = {
  answers?: Record<string, unknown>;
  uploads?: Record<string, unknown>;
  headerValues?: Record<string, unknown>;
  comment?: string | null;
  accessCode?: string | null;
};

type ReviewInput = {
  feedback?: Record<string, { rating?: string | null; comment?: string | null }>;
  reviewerComments?: string | null;
  sendEmail?: boolean;
  accessCode?: string | null;
};

type ValidateQuestionnaireInput = {
  rules?: QuestionnaireRule[];
  questions?: QuestionnaireQuestion[];
};

type QuestionnaireTemplateSummary = {
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

type QuestionnaireTemplateDetail = {
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

type QuestionnaireTemplateMetadata = {
  templateKind?: QuestionnaireTemplateKind;
  sourceFramework?: string | null;
  usageNotes?: string | null;
  ownerTeam?: string | null;
  source?: string | null;
  seedKey?: string | null;
  questionnaireType?: string | null;
  assignmentModel?: string | null;
  relatedWorkflow?: string | null;
  attestationScope?: string | null;
  responseOwnerModel?: string | null;
  evidenceCollectionMode?: string | null;
  fileUploadGuidance?: string | null;
  exportMode?: string | null;
  distributionCadence?: string | null;
  ownerUserId?: string | null;
  ownerName?: string | null;
  profile?: string | null;
  instructions?: string | null;
  allowPublicUrl?: boolean;
  loginRequired?: boolean;
  enableScoring?: boolean;
  enableQuestionAssignment?: boolean;
};

type QuestionnaireSeedDefinition = {
  seedKey: string;
  templateKind: QuestionnaireTemplateKind;
  name: string;
  description: string;
  audience: string;
  ownerTeam: string;
  sourceFramework?: string | null;
  usageNotes?: string | null;
  questionnaireType?: string | null;
  assignmentModel?: string | null;
  relatedWorkflow?: string | null;
  attestationScope?: string | null;
  responseOwnerModel?: string | null;
  evidenceCollectionMode?: string | null;
  fileUploadGuidance?: string | null;
  exportMode?: string | null;
  distributionCadence?: string | null;
  scoringMode: string;
  status: string;
  questions: QuestionnaireQuestion[];
  rules: QuestionnaireRule[];
};

type RuleSetDetail = {
  id: string;
  questionnaireId: string;
  name: string;
  engineVersion: string;
  rules: QuestionnaireRule[];
  diagnostics: RuleDiagnostic[];
  updatedAt: string;
};

type RuleTestRun = {
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

type QuestionnaireInstance = {
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
  collaboration: Array<{ id: string; authorUserId: string | null; message: string; action: string; createdAt: string; emailQueued?: boolean }>;
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

function nowIso() {
  return new Date().toISOString();
}

function asJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function requireTenant(ctx: WorkerRequestContext): string | Response {
  if (!ctx.tenantId) {
    return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
  }
  return ctx.tenantId;
}

function requireUser(ctx: WorkerRequestContext): string | Response {
  if (!ctx.userId) {
    return json({ error: 'missing_user', message: 'x-user-id is required' }, { status: 401 });
  }
  return ctx.userId;
}

function cleanString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseQuestionRefFromExpression(expression: string): string | null {
  return parseQuotedValues(expression)[0] ?? null;
}

function parseQuotedValues(expression: string): string[] {
  return Array.from(expression.matchAll(/"([^"]*)"/g)).map((match) => match[1]);
}

function parseQuestionRefsFromExpression(expression: string): string[] {
  const first = parseQuestionRefFromExpression(expression);
  return first
    ? first
        .split(',')
        .map((ref) => ref.trim())
        .filter(Boolean)
    : [];
}

function parseRuleNumber(expression: string): number | null {
  const match = expression.match(/(-?\d+(?:\.\d+)?)/);
  const value = Number(match?.[1]);
  return Number.isFinite(value) ? value : null;
}

function parseDisplayOptions(expression: string): Record<string, boolean | string> {
  const payload = parseQuotedValues(expression)[0] ?? expression.replace(/^SET_DISPLAY_OPTIONS/i, '').trim();
  return Object.fromEntries(
    payload
      .split(/[;,]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [rawKey, rawValue = 'true'] = entry.split('=').map((part) => part.trim());
        const key = rawKey.replace(/[-_\s]/g, '').toLowerCase();
        const normalizedValue = rawValue.toLowerCase();
        return [key, normalizedValue === 'true' ? true : normalizedValue === 'false' ? false : rawValue];
      }),
  );
}

function normalizeTemplateKind(value: unknown): QuestionnaireTemplateKind {
  return value === 'assessment-plan' ? 'assessment-plan' : 'questionnaire';
}

function buildTemplateMetadata(args: {
  current?: QuestionnaireTemplateMetadata | null;
  templateKind?: QuestionnaireTemplateKind;
  sourceFramework?: string | null;
  usageNotes?: string | null;
  ownerTeam?: string | null;
  source?: string | null;
  seedKey?: string | null;
  questionnaireType?: string | null;
  assignmentModel?: string | null;
  relatedWorkflow?: string | null;
  attestationScope?: string | null;
  responseOwnerModel?: string | null;
  evidenceCollectionMode?: string | null;
  fileUploadGuidance?: string | null;
  exportMode?: string | null;
  distributionCadence?: string | null;
  ownerUserId?: string | null;
  ownerName?: string | null;
  profile?: string | null;
  instructions?: string | null;
  allowPublicUrl?: boolean;
  loginRequired?: boolean;
  enableScoring?: boolean;
  enableQuestionAssignment?: boolean;
}): QuestionnaireTemplateMetadata {
  return {
    ...(args.current ?? {}),
    ...(args.templateKind ? { templateKind: args.templateKind } : {}),
    ...(args.sourceFramework !== undefined ? { sourceFramework: args.sourceFramework } : {}),
    ...(args.usageNotes !== undefined ? { usageNotes: args.usageNotes } : {}),
    ...(args.ownerTeam !== undefined ? { ownerTeam: args.ownerTeam } : {}),
    ...(args.source !== undefined ? { source: args.source } : {}),
    ...(args.seedKey !== undefined ? { seedKey: args.seedKey } : {}),
    ...(args.questionnaireType !== undefined ? { questionnaireType: args.questionnaireType } : {}),
    ...(args.assignmentModel !== undefined ? { assignmentModel: args.assignmentModel } : {}),
    ...(args.relatedWorkflow !== undefined ? { relatedWorkflow: args.relatedWorkflow } : {}),
    ...(args.attestationScope !== undefined ? { attestationScope: args.attestationScope } : {}),
    ...(args.responseOwnerModel !== undefined ? { responseOwnerModel: args.responseOwnerModel } : {}),
    ...(args.evidenceCollectionMode !== undefined ? { evidenceCollectionMode: args.evidenceCollectionMode } : {}),
    ...(args.fileUploadGuidance !== undefined ? { fileUploadGuidance: args.fileUploadGuidance } : {}),
    ...(args.exportMode !== undefined ? { exportMode: args.exportMode } : {}),
    ...(args.distributionCadence !== undefined ? { distributionCadence: args.distributionCadence } : {}),
    ...(args.ownerUserId !== undefined ? { ownerUserId: args.ownerUserId } : {}),
    ...(args.ownerName !== undefined ? { ownerName: args.ownerName } : {}),
    ...(args.profile !== undefined ? { profile: args.profile } : {}),
    ...(args.instructions !== undefined ? { instructions: args.instructions } : {}),
    ...(args.allowPublicUrl !== undefined ? { allowPublicUrl: args.allowPublicUrl } : {}),
    ...(args.loginRequired !== undefined ? { loginRequired: args.loginRequired } : {}),
    ...(args.enableScoring !== undefined ? { enableScoring: args.enableScoring } : {}),
    ...(args.enableQuestionAssignment !== undefined ? { enableQuestionAssignment: args.enableQuestionAssignment } : {}),
  };
}

function mappedRequirementCount(questions: QuestionnaireQuestion[]) {
  return questions.filter((question) => question.requirementRef?.trim()).length;
}

function summarizeTemplateMetadata(
  metadata: QuestionnaireTemplateMetadata | null | undefined,
  questions: QuestionnaireQuestion[],
) {
  const normalized = metadata ?? {};
  return {
    templateKind: normalizeTemplateKind(normalized.templateKind),
    sourceFramework: normalized.sourceFramework?.trim() || null,
    usageNotes: normalized.usageNotes?.trim() || null,
    questionnaireType: normalized.questionnaireType?.trim() || null,
    assignmentModel: normalized.assignmentModel?.trim() || null,
    relatedWorkflow: normalized.relatedWorkflow?.trim() || null,
    attestationScope: normalized.attestationScope?.trim() || null,
    responseOwnerModel: normalized.responseOwnerModel?.trim() || null,
    evidenceCollectionMode: normalized.evidenceCollectionMode?.trim() || null,
    fileUploadGuidance: normalized.fileUploadGuidance?.trim() || null,
    exportMode: normalized.exportMode?.trim() || null,
    distributionCadence: normalized.distributionCadence?.trim() || null,
    ownerUserId: normalized.ownerUserId?.trim() || null,
    ownerName: normalized.ownerName?.trim() || null,
    profile: normalized.profile?.trim() || null,
    instructions: normalized.instructions?.trim() || null,
    allowPublicUrl: Boolean(normalized.allowPublicUrl),
    loginRequired: Boolean(normalized.loginRequired),
    enableScoring: normalized.enableScoring !== false,
    enableQuestionAssignment: Boolean(normalized.enableQuestionAssignment),
    mappedRequirementCount: mappedRequirementCount(questions),
  };
}

function buildRuleDiagnostics(
  rules: QuestionnaireRule[],
  questions: QuestionnaireQuestion[],
): RuleDiagnostic[] {
  const knownQuestionRefs = new Set(questions.map((question) => question.ref));
  const diagnostics: RuleDiagnostic[] = [];

  for (const rule of rules) {
    if (!rule.name.trim()) {
      diagnostics.push({
        id: `${rule.id}-name`,
        severity: 'error',
        message: 'Every rule needs a name before it can be saved.',
      });
    }
    if (rule.actions.length === 0) {
      diagnostics.push({
        id: `${rule.id}-actions`,
        severity: 'error',
        message: `Rule "${rule.name || 'Untitled'}" has no actions to execute.`,
      });
    }
    if (rule.conditions.length === 0) {
      diagnostics.push({
        id: `${rule.id}-conditions`,
        severity: 'warning',
        message: `Rule "${rule.name || 'Untitled'}" has no conditions and may trigger unexpectedly.`,
      });
    }

    const conditionRefs = new Set(
      rule.conditions
        .map((condition) => condition.match(/^Question "([^"]+)"/)?.[1])
        .filter((ref): ref is string => Boolean(ref)),
    );

    for (const action of rule.actions) {
      const knownAction = /SHOW_QUESTIONS|HIDE_QUESTIONS|ENABLE_QUESTIONS|DISABLE_QUESTIONS|REQUIRE_QUESTIONS|NOT_REQUIRE_QUESTIONS|SET_ANSWER|CLEAR_ANSWER|SET_SCORE|ADD_TO_SCORE|CALCULATE_TOTAL_SCORE|SET_GRADE|REPEAT_QUESTIONS|SET_DISPLAY_OPTIONS/.test(action);
      if (!knownAction) {
        diagnostics.push({
          id: `${rule.id}-action-${diagnostics.length}`,
          severity: 'warning',
          message: `Rule "${rule.name || 'Untitled'}" uses an unrecognized action "${action}".`,
        });
      }
      const refs = parseQuestionRefsFromExpression(action);
      if (
        refs.length > 0 &&
        /SHOW_QUESTIONS|HIDE_QUESTIONS|ENABLE_QUESTIONS|DISABLE_QUESTIONS|REQUIRE_QUESTIONS|NOT_REQUIRE_QUESTIONS|SET_ANSWER|CLEAR_ANSWER|REPEAT_QUESTIONS/.test(action)
      ) {
        for (const ref of refs) {
          if (!knownQuestionRefs.has(ref)) {
            diagnostics.push({
              id: `${rule.id}-${ref}`,
              severity: 'warning',
              message: `Rule "${rule.name || 'Untitled'}" references unknown question ref "${ref}".`,
            });
          }
        }
      }
      if (/SET_ANSWER/.test(action) && parseQuotedValues(action).length < 2) {
        diagnostics.push({
          id: `${rule.id}-set-answer-${diagnostics.length}`,
          severity: 'warning',
          message: `Rule "${rule.name || 'Untitled'}" sets an answer without a value.`,
        });
      }
      if ((/SET_SCORE|ADD_TO_SCORE/.test(action)) && parseRuleNumber(action) === null) {
        diagnostics.push({
          id: `${rule.id}-score-${diagnostics.length}`,
          severity: 'warning',
          message: `Rule "${rule.name || 'Untitled'}" uses a score action without a numeric value.`,
        });
      }
      if (/SET_ANSWER|CLEAR_ANSWER/.test(action)) {
        for (const ref of refs) {
          if (conditionRefs.has(ref)) {
            diagnostics.push({
              id: `${rule.id}-circular-${ref}`,
              severity: 'warning',
              message: `Rule "${rule.name || 'Untitled'}" both reads and mutates "${ref}"; verify this is not circular.`,
            });
          }
        }
      }
    }

    for (const condition of rule.conditions) {
      const ref = condition.match(/^Question "([^"]+)"/)?.[1];
      if (ref && !knownQuestionRefs.has(ref)) {
        diagnostics.push({
          id: `${rule.id}-condition-${ref}`,
          severity: 'warning',
          message: `Rule "${rule.name || 'Untitled'}" condition references unknown question ref "${ref}".`,
        });
      }
      const knownCondition =
        condition === 'NO_CONDITION' ||
        condition === 'NO_PARENT' ||
        /^Question "/.test(condition) ||
        /^Score /.test(condition) ||
        /^Grade /.test(condition) ||
        /^SYSTEM /.test(condition) ||
        /^System "/.test(condition);
      if (!knownCondition) {
        diagnostics.push({
          id: `${rule.id}-condition-${diagnostics.length}`,
          severity: 'warning',
          message: `Rule "${rule.name || 'Untitled'}" uses an unrecognized condition "${condition}".`,
        });
      }
    }
  }

  if (diagnostics.length === 0) {
    diagnostics.push({
      id: 'rules-valid',
      severity: 'info',
      message: 'All rules passed structural validation checks.',
    });
  }

  return diagnostics;
}

function evaluateCondition(
  condition: string,
  answers: Record<string, unknown>,
  context: { score?: number; grade?: string; isNewRecord?: boolean } = {},
): boolean {
  const normalized = condition.trim();
  if (normalized === 'NO_CONDITION' || normalized === 'SYSTEM NO_CONDITION' || normalized === 'System "NO_CONDITION"') {
    return true;
  }
  if (normalized === 'NO_PARENT' || normalized === 'SYSTEM NO_PARENT' || normalized === 'System "NO_PARENT"') {
    return Boolean(context.isNewRecord);
  }

  const scoreMatch = normalized.match(/^Score (equals|not equals|greater than|less than|greater than or equal|less than or equal) "?([^"]+)"?$/i);
  if (scoreMatch) {
    return compareRuleValues(scoreMatch[1], context.score ?? 0, scoreMatch[2]);
  }

  const gradeMatch = normalized.match(/^Grade (equals|not equals|contains) "([^"]*)"$/i);
  if (gradeMatch) {
    return compareRuleValues(gradeMatch[1], context.grade ?? '', gradeMatch[2]);
  }

  const emptyMatch = normalized.match(/^Question "([^"]+)" (is empty|is not empty|has value|no value)$/i);
  if (emptyMatch) {
    const actual = answers[emptyMatch[1]];
    const hasAnswer = hasQuestionAnswer(actual);
    return /not empty|has value/i.test(emptyMatch[2]) ? hasAnswer : !hasAnswer;
  }

  const match = normalized.match(/^Question "([^"]+)" (equals|not equals|contains|not contains|greater than|less than|greater than or equal|less than or equal|before|after|in|not in) "([^"]*)"$/i);
  if (!match) {
    return false;
  }

  const [, ref, operator, expected] = match;
  const actual = answers[ref];
  if (Array.isArray(actual)) {
    const values = expected.split(',').map((value) => value.trim()).filter(Boolean);
    if (/not in|not contains|not equals/i.test(operator)) {
      return !actual.some((value) => values.includes(String(value)));
    }
    return actual.some((value) => values.includes(String(value)));
  }
  return compareRuleValues(operator, actual, expected);
}

function hasQuestionAnswer(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function compareRuleValues(operator: string, actual: unknown, expected: unknown): boolean {
  const op = operator.trim().toLowerCase();
  const actualText = String(actual ?? '');
  const expectedText = String(expected ?? '');
  if (op === 'equals') return actualText === expectedText;
  if (op === 'not equals') return actualText !== expectedText;
  if (op === 'contains') return actualText.toLowerCase().includes(expectedText.toLowerCase());
  if (op === 'not contains') return !actualText.toLowerCase().includes(expectedText.toLowerCase());
  if (op === 'in') return expectedText.split(',').map((value) => value.trim()).includes(actualText);
  if (op === 'not in') return !expectedText.split(',').map((value) => value.trim()).includes(actualText);

  const actualNumber = Number(actualText);
  const expectedNumber = Number(expectedText);
  if (op === 'greater than') return Number.isFinite(actualNumber) && Number.isFinite(expectedNumber) && actualNumber > expectedNumber;
  if (op === 'less than') return Number.isFinite(actualNumber) && Number.isFinite(expectedNumber) && actualNumber < expectedNumber;
  if (op === 'greater than or equal') return Number.isFinite(actualNumber) && Number.isFinite(expectedNumber) && actualNumber >= expectedNumber;
  if (op === 'less than or equal') return Number.isFinite(actualNumber) && Number.isFinite(expectedNumber) && actualNumber <= expectedNumber;

  const actualDate = new Date(actualText);
  const expectedDate = new Date(expectedText);
  if (op === 'before') return !Number.isNaN(actualDate.getTime()) && !Number.isNaN(expectedDate.getTime()) && actualDate < expectedDate;
  if (op === 'after') return !Number.isNaN(actualDate.getTime()) && !Number.isNaN(expectedDate.getTime()) && actualDate > expectedDate;
  return false;
}

function calculateQuestionnaireScore(
  questions: QuestionnaireQuestion[],
  answers: Record<string, unknown>,
  runtime: {
    hiddenQuestions?: Set<string>;
    requiredQuestions?: Set<string>;
    optionalQuestions?: Set<string>;
    scoreDelta?: number;
    scoreOverride?: number | null;
    gradeOverride?: string | null;
  } = {},
): { score: number; maxScore: number; percentComplete: number; passingStatus: string; grade: string } {
  const hiddenQuestions = runtime.hiddenQuestions ?? new Set<string>();
  const requiredByRules = runtime.requiredQuestions ?? new Set<string>();
  const optionalByRules = runtime.optionalQuestions ?? new Set<string>();
  const scorableQuestions = questions.filter((question) => question.type !== 'instructional' && !hiddenQuestions.has(question.ref));
  const requiredQuestions = scorableQuestions.filter((question) => requiredByRules.has(question.ref) || (question.required && !optionalByRules.has(question.ref)));
  const answeredRequired = requiredQuestions.filter((question) => hasQuestionAnswer(answers[question.ref])).length;
  const maxScore = scorableQuestions.reduce((total, question) => total + (question.maxScore ?? question.weight ?? 0), 0);
  const calculatedScore = scorableQuestions.reduce((total, question) => {
    const answer = answers[question.ref];
    if (!hasQuestionAnswer(answer)) {
      return total;
    }
    const max = question.maxScore ?? question.weight ?? 0;
    if (question.answerScores && typeof answer === 'string' && question.answerScores[answer] !== undefined) {
      return total + Number(question.answerScores[answer] ?? 0);
    }
    if (Array.isArray(answer) && question.answerScores) {
      return total + answer.reduce((inner, value) => inner + Number(question.answerScores?.[String(value)] ?? 0), 0);
    }
    if (question.type === 'boolean') {
      return total + (String(answer) === 'true' || answer === true ? max : 0);
    }
    if (question.type === 'number') {
      const numeric = Number(answer);
      return total + (Number.isFinite(numeric) ? Math.min(max || numeric, numeric) : 0);
    }
    return total + max;
  }, 0);
  const score = Math.max(0, runtime.scoreOverride ?? calculatedScore + (runtime.scoreDelta ?? 0));
  const percentComplete = requiredQuestions.length === 0 ? 100 : Math.round((answeredRequired / requiredQuestions.length) * 100);
  const scorePercent = maxScore > 0 ? (score / maxScore) * 100 : percentComplete;
  const passingStatus = percentComplete < 100 ? 'Incomplete' : scorePercent >= 70 ? 'Passing' : 'Needs Review';
  const grade = runtime.gradeOverride ?? (scorePercent >= 90 ? 'Excellent' : scorePercent >= 70 ? 'Pass' : scorePercent >= 50 ? 'Needs Review' : 'Fail');
  return { score, maxScore, percentComplete, passingStatus, grade };
}

function coerceRuleAnswerValue(question: QuestionnaireQuestion | undefined, value: string): unknown {
  if (!question) {
    return value;
  }
  if (question.type === 'boolean') {
    return /^(true|yes|1)$/i.test(value);
  }
  if (question.type === 'number') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }
  if (question.type === 'multi-select') {
    return value.split(',').map((entry) => entry.trim()).filter(Boolean);
  }
  if (question.type === 'table') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : value;
    } catch {
      return value;
    }
  }
  return value;
}

function buildQuestionValidationErrors(
  questions: QuestionnaireQuestion[],
  answers: Record<string, unknown>,
  requiredQuestions: Set<string>,
  hiddenQuestions: Set<string>,
): Array<{ ref: string; message: string }> {
  const errors: Array<{ ref: string; message: string }> = [];
  for (const question of questions) {
    if (hiddenQuestions.has(question.ref) || question.type === 'instructional') {
      continue;
    }
    if (requiredQuestions.has(question.ref) && !hasQuestionAnswer(answers[question.ref])) {
      errors.push({ ref: question.ref, message: `${question.prompt} is required by questionnaire rules.` });
    }
    if (question.type === 'email' && hasQuestionAnswer(answers[question.ref]) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(answers[question.ref]))) {
      errors.push({ ref: question.ref, message: `${question.prompt} must be a valid email address.` });
    }
    if (question.type === 'date' && hasQuestionAnswer(answers[question.ref]) && Number.isNaN(new Date(String(answers[question.ref])).getTime())) {
      errors.push({ ref: question.ref, message: `${question.prompt} must be a valid date.` });
    }
  }
  return errors;
}

function evaluateQuestionnaireRuntime(
  questions: QuestionnaireQuestion[],
  rules: QuestionnaireRule[],
  answers: Record<string, unknown>,
): RuleTestRun['result'] & { answers: Record<string, unknown>; executionLog: string[] } {
  const executionLog: string[] = [];
  const matchedRules: string[] = [];
  const questionByRef = new Map(questions.map((question) => [question.ref, question]));
  const runtimeAnswers = { ...answers };
  const visibleQuestions = new Set<string>();
  const hiddenQuestions = new Set<string>();
  const disabledQuestions = new Set<string>();
  const requiredQuestions = new Set(questions.filter((question) => question.required).map((question) => question.ref));
  const optionalQuestions = new Set<string>();
  const displayOptions: Record<string, boolean | string> = {};
  let scoreDelta = 0;
  let scoreOverride: number | null = null;
  let gradeOverride: string | null = null;

  for (const rule of rules) {
    if (!rule.active) {
      executionLog.push(`Rule "${rule.name}" skipped because it is inactive`);
      continue;
    }

    const currentScore = calculateQuestionnaireScore(questions, runtimeAnswers, {
      hiddenQuestions,
      requiredQuestions,
      optionalQuestions,
      scoreDelta,
      scoreOverride,
      gradeOverride,
    });
    const evaluations = rule.conditions.map((condition) =>
      evaluateCondition(condition, runtimeAnswers, { score: currentScore.score, grade: currentScore.grade }),
    );
    const matched = rule.conditions.length === 0 ? rule.logic === 'AND' : rule.logic === 'AND' ? evaluations.every(Boolean) : evaluations.some(Boolean);
    executionLog.push(`Rule "${rule.name}" ${matched ? 'EXECUTED' : 'SKIPPED'}`);

    if (!matched) {
      continue;
    }

    matchedRules.push(rule.name);
    for (const action of rule.actions) {
      executionLog.push(`Action ${action} fired`);
      const refs = parseQuestionRefsFromExpression(action);
      if (action.includes('SHOW_QUESTIONS')) {
        for (const ref of refs) {
          visibleQuestions.add(ref);
          hiddenQuestions.delete(ref);
        }
      }
      if (action.includes('HIDE_QUESTIONS')) {
        for (const ref of refs) {
          hiddenQuestions.add(ref);
          visibleQuestions.delete(ref);
        }
      }
      if (action.includes('ENABLE_QUESTIONS')) {
        for (const ref of refs) {
          disabledQuestions.delete(ref);
        }
      }
      if (action.includes('DISABLE_QUESTIONS')) {
        for (const ref of refs) {
          disabledQuestions.add(ref);
        }
      }
      if (action.includes('REQUIRE_QUESTIONS')) {
        for (const ref of refs) {
          requiredQuestions.add(ref);
          optionalQuestions.delete(ref);
        }
      }
      if (action.includes('NOT_REQUIRE_QUESTIONS')) {
        for (const ref of refs) {
          optionalQuestions.add(ref);
          requiredQuestions.delete(ref);
        }
      }
      if (action.includes('SET_ANSWER')) {
        const quoted = parseQuotedValues(action);
        const [ref, value = ''] = quoted;
        if (ref) {
          runtimeAnswers[ref] = coerceRuleAnswerValue(questionByRef.get(ref), value);
        }
      }
      if (action.includes('CLEAR_ANSWER')) {
        for (const ref of refs) {
          const question = questionByRef.get(ref);
          runtimeAnswers[ref] = question ? defaultAnswerForQuestion(question) : '';
        }
      }
      if (action.includes('SET_SCORE')) {
        const value = parseRuleNumber(action);
        if (value !== null) {
          scoreOverride = value;
        }
      }
      if (action.includes('ADD_TO_SCORE')) {
        const value = parseRuleNumber(action);
        if (value !== null) {
          scoreDelta += value;
        }
      }
      if (action.includes('CALCULATE_TOTAL_SCORE')) {
        scoreOverride = null;
      }
      if (action.includes('SET_GRADE')) {
        const match = action.match(/SET_GRADE\s+"([^"]+)"/);
        if (match) {
          gradeOverride = match[1];
        }
      }
      if (action.includes('SET_DISPLAY_OPTIONS')) {
        Object.assign(displayOptions, parseDisplayOptions(action));
      }
      if (action.includes('REPEAT_QUESTIONS')) {
        for (const ref of refs) {
          const answer = runtimeAnswers[ref];
          displayOptions[`repeat:${ref}`] = String(Array.isArray(answer) ? answer.length : answer ?? '');
        }
      }
    }
  }

  for (const ref of hiddenQuestions) {
    requiredQuestions.delete(ref);
  }

  const finalScore = calculateQuestionnaireScore(questions, runtimeAnswers, {
    hiddenQuestions,
    requiredQuestions,
    optionalQuestions,
    scoreDelta,
    scoreOverride,
    gradeOverride,
  });
  const validationErrors = buildQuestionValidationErrors(questions, runtimeAnswers, requiredQuestions, hiddenQuestions);
  const answerUpdates = Object.fromEntries(
    Object.entries(runtimeAnswers).filter(([ref, value]) => JSON.stringify(value) !== JSON.stringify(answers[ref])),
  );

  executionLog.push(`Final score: ${finalScore.score}`);
  executionLog.push(`Final grade: "${finalScore.grade}"`);
  if (hiddenQuestions.size > 0) {
    executionLog.push(`Hidden questions: ${Array.from(hiddenQuestions).join(', ')}`);
  }
  if (disabledQuestions.size > 0) {
    executionLog.push(`Disabled questions: ${Array.from(disabledQuestions).join(', ')}`);
  }
  if (requiredQuestions.size > 0) {
    executionLog.push(`Required questions: ${Array.from(requiredQuestions).join(', ')}`);
  }
  if (validationErrors.length > 0) {
    executionLog.push(`Validation errors: ${validationErrors.map((error) => error.ref).join(', ')}`);
  }

  return {
    matchedRules,
    visibleQuestions: Array.from(visibleQuestions),
    hiddenQuestions: Array.from(hiddenQuestions),
    disabledQuestions: Array.from(disabledQuestions),
    requiredQuestions: Array.from(requiredQuestions),
    displayOptions,
    validationErrors,
    answerUpdates,
    score: finalScore.score,
    maxScore: finalScore.maxScore,
    percentComplete: finalScore.percentComplete,
    passingStatus: finalScore.passingStatus,
    grade: finalScore.grade,
    answers: runtimeAnswers,
    executionLog,
  };
}

function evaluateRuleSet(
  rules: QuestionnaireRule[],
  answers: Record<string, unknown>,
  questions: QuestionnaireQuestion[] = [],
): RuleTestRun['result'] & { answers: Record<string, unknown>; executionLog: string[] } {
  if (questions.length > 0) {
    return evaluateQuestionnaireRuntime(questions, rules, answers);
  }

  const executionLog: string[] = [];
  const matchedRules: string[] = [];
  const visibleQuestions = new Set<string>();
  const hiddenQuestions = new Set<string>();
  const disabledQuestions = new Set<string>();
  const requiredQuestions = new Set<string>();
  const displayOptions: Record<string, boolean | string> = {};
  const runtimeAnswers = { ...answers };
  let score = 60;
  let grade = 'Pending';

  for (const rule of rules) {
    if (!rule.active) {
      executionLog.push(`Rule "${rule.name}" skipped because it is inactive`);
      continue;
    }

    const evaluations = rule.conditions.map((condition) => evaluateCondition(condition, runtimeAnswers, { score, grade }));
    const matched = rule.conditions.length === 0 ? rule.logic === 'AND' : rule.logic === 'AND' ? evaluations.every(Boolean) : evaluations.some(Boolean);
    executionLog.push(`Rule "${rule.name}" ${matched ? 'EXECUTED' : 'SKIPPED'}`);

    if (!matched) {
      continue;
    }

    matchedRules.push(rule.name);
    for (const action of rule.actions) {
      executionLog.push(`Action ${action} fired`);
      const refs = parseQuestionRefsFromExpression(action);
      for (const ref of refs) {
        if (action.includes('SHOW_QUESTIONS') || action.includes('ENABLE_QUESTIONS')) {
        visibleQuestions.add(ref);
        hiddenQuestions.delete(ref);
      }
        if (action.includes('HIDE_QUESTIONS')) {
        hiddenQuestions.add(ref);
        visibleQuestions.delete(ref);
      }
        if (action.includes('DISABLE_QUESTIONS')) {
        disabledQuestions.add(ref);
      }
        if (action.includes('REQUIRE_QUESTIONS')) {
          requiredQuestions.add(ref);
        }
        if (action.includes('NOT_REQUIRE_QUESTIONS')) {
          requiredQuestions.delete(ref);
        }
        if (action.includes('CLEAR_ANSWER')) {
          runtimeAnswers[ref] = '';
        }
      }
      if (action.includes('SET_ANSWER')) {
        const [ref, value = ''] = parseQuotedValues(action);
        if (ref) {
          runtimeAnswers[ref] = value;
        }
      }
      if (action.includes('SET_SCORE')) {
        const value = parseRuleNumber(action);
        if (value !== null) {
          score = value;
        }
      }
      if (action.includes('ADD_TO_SCORE')) {
        const value = parseRuleNumber(action);
        if (value !== null) {
          score += value;
        }
      }
      if (action.includes('SET_GRADE')) {
        const match = action.match(/SET_GRADE\s+"([^"]+)"/);
        if (match) {
          grade = match[1];
        }
      }
      if (action.includes('SET_DISPLAY_OPTIONS')) {
        Object.assign(displayOptions, parseDisplayOptions(action));
      }
    }
  }

  score = Math.max(0, Math.min(100, score + matchedRules.length * 8));
  if (grade === 'Pending') {
    grade = score >= 85 ? 'Pass' : score >= 70 ? 'Needs Review' : 'Fail';
  }

  executionLog.push(`Final score: ${score}`);
  executionLog.push(`Final grade: "${grade}"`);
  if (hiddenQuestions.size > 0) {
    executionLog.push(`Hidden questions: ${Array.from(hiddenQuestions).join(', ')}`);
  }
  if (disabledQuestions.size > 0) {
    executionLog.push(`Disabled questions: ${Array.from(disabledQuestions).join(', ')}`);
  }

  return {
    matchedRules,
    visibleQuestions: Array.from(visibleQuestions),
    hiddenQuestions: Array.from(hiddenQuestions),
    disabledQuestions: Array.from(disabledQuestions),
    requiredQuestions: Array.from(requiredQuestions),
    displayOptions,
    validationErrors: [],
    answerUpdates: Object.fromEntries(
      Object.entries(runtimeAnswers).filter(([ref, value]) => JSON.stringify(value) !== JSON.stringify(answers[ref])),
    ),
    score,
    maxScore: 100,
    percentComplete: 100,
    passingStatus: score >= 70 ? 'Passing' : 'Needs Review',
    grade,
    answers: runtimeAnswers,
    executionLog,
  };
}

function buildQuestionnaireSeedQuestions(): QuestionnaireQuestion[] {
  return [
    {
      id: crypto.randomUUID(),
      ref: 'RISK_LEVEL',
      prompt: 'What is the supplier risk level for this review?',
      type: 'single-select',
      section: 'Risk Posture',
      required: true,
      weight: 20,
      options: ['Low', 'Moderate', 'High', 'Critical'],
      helpText: 'Used by the visual rules engine to reveal mitigation and review follow-up.',
      requirementRef: null,
      evidenceHint: 'Capture the supplier risk classification used for triage.',
    },
    {
      id: crypto.randomUUID(),
      ref: 'HAS_SOC2',
      prompt: 'Does the supplier maintain a current SOC 2 report?',
      type: 'boolean',
      section: 'Assurance',
      required: true,
      weight: 15,
      requirementRef: null,
      evidenceHint: 'Reference the latest assurance report or supporting evidence.',
      enableUpload: true,
    },
    {
      id: crypto.randomUUID(),
      ref: 'MITIGATION_PLAN',
      prompt: 'Describe the mitigation plan for the identified supplier risk.',
      type: 'text',
      section: 'Follow-up',
      required: false,
      weight: 0,
      requirementRef: null,
      evidenceHint: 'Summarize the mitigation commitments expected from the supplier.',
    },
    {
      id: crypto.randomUUID(),
      ref: 'REVIEWER_COMMENTS',
      prompt: 'Reviewer observations',
      type: 'text',
      section: 'Review',
      required: false,
      weight: 0,
      requirementRef: null,
      evidenceHint: 'Capture reviewer commentary and escalation context.',
    },
    {
      id: crypto.randomUUID(),
      ref: 'SUPPORTING_FILES',
      prompt: 'Upload or reference supporting evidence for this questionnaire response.',
      type: 'file-upload',
      section: 'Evidence',
      required: false,
      weight: 0,
      requirementRef: null,
      evidenceHint: 'Use Manage Uploads to attach SOC reports, policies, diagrams, or other evidence.',
      enableUpload: true,
    },
  ];
}

function buildQuestionnaireSeedRules(): QuestionnaireRule[] {
  return [
    {
      id: crypto.randomUUID(),
      name: 'Show mitigation on elevated risk',
      description: 'Reveal mitigation planning when the supplier risk level is high or critical.',
      logic: 'OR',
      active: true,
      conditions: ['Question "RISK_LEVEL" equals "High"', 'Question "RISK_LEVEL" equals "Critical"'],
      actions: ['SHOW_QUESTIONS "MITIGATION_PLAN"', 'ENABLE_QUESTIONS "MITIGATION_PLAN"'],
    },
    {
      id: crypto.randomUUID(),
      name: 'Open reviewer comments for collaborative review',
      description: 'Expose reviewer comments when the rules engine is used for analyst triage.',
      logic: 'AND',
      active: true,
      conditions: ['NO_CONDITION'],
      actions: ['SHOW_QUESTIONS "REVIEWER_COMMENTS"'],
    },
  ];
}

function buildAssessmentPlanSeedQuestions(): QuestionnaireQuestion[] {
  return [
    {
      id: crypto.randomUUID(),
      ref: 'AC2_ACCESS_REVIEW',
      prompt: 'Verify that user access is reviewed, approved, and periodically revalidated for the in-scope system.',
      type: 'boolean',
      section: 'Access Control',
      required: true,
      weight: 25,
      helpText: 'Use this line of inquiry to test access-review evidence and role approval traceability.',
      requirementRef: 'AC-2',
      evidenceHint: 'Review access review reports, approvals, and any role certification evidence.',
    },
    {
      id: crypto.randomUUID(),
      ref: 'CM3_CHANGE_APPROVAL',
      prompt: 'Confirm that production changes were approved, tested, and traceable to authorized change records.',
      type: 'boolean',
      section: 'Change Management',
      required: true,
      weight: 25,
      helpText: 'This line of inquiry checks pre-implementation approval and traceability for sampled changes.',
      requirementRef: 'CM-3',
      evidenceHint: 'Collect change tickets, approval records, deployment logs, and test evidence.',
    },
    {
      id: crypto.randomUUID(),
      ref: 'AU6_LOG_REVIEW',
      prompt: 'Determine whether audit logs are reviewed and retained in accordance with the control requirement.',
      type: 'boolean',
      section: 'Audit & Accountability',
      required: true,
      weight: 20,
      helpText: 'Use for periodic review of log-monitoring coverage and retention posture.',
      requirementRef: 'AU-6',
      evidenceHint: 'Review sample log reviews, retention settings, and any exception handling notes.',
    },
    {
      id: crypto.randomUUID(),
      ref: 'LOI_OBSERVATIONS',
      prompt: 'Document observations, gaps, and differences for this assessment plan execution.',
      type: 'text',
      section: 'Assessment Notes',
      required: false,
      weight: 0,
      helpText: 'Use this line of inquiry to capture narrative observations when a check needs follow-up.',
      requirementRef: null,
      evidenceHint: 'Summarize exceptions, follow-up items, or issue-generation rationale.',
    },
  ];
}

function buildAssessmentPlanSeedRules(): QuestionnaireRule[] {
  return [
    {
      id: crypto.randomUUID(),
      name: 'Open observations when a line of inquiry fails',
      description: 'Show the observations line whenever a sampled control check is not satisfied.',
      logic: 'OR',
      active: true,
      conditions: [
        'Question "AC2_ACCESS_REVIEW" equals "false"',
        'Question "CM3_CHANGE_APPROVAL" equals "false"',
        'Question "AU6_LOG_REVIEW" equals "false"',
      ],
      actions: ['SHOW_QUESTIONS "LOI_OBSERVATIONS"', 'ENABLE_QUESTIONS "LOI_OBSERVATIONS"'],
    },
  ];
}

function buildSeedTemplateDefinitions(): QuestionnaireSeedDefinition[] {
  return [
    {
      seedKey: 'questionnaire-third-party-security-review',
      templateKind: 'questionnaire',
      name: 'Third-Party Security Review',
      description: 'Canonical questionnaire template for supplier diligence, exception triage, and control follow-up.',
      audience: 'Third-party reviewers',
      ownerTeam: 'Vendor Risk',
      sourceFramework: 'Vendor due diligence',
      usageNotes: 'Use this questionnaire for supplier reviews, external evidence collection, and conditional follow-up.',
      questionnaireType: 'Vendor Risk',
      assignmentModel: 'External respondent',
      relatedWorkflow: 'Supplier diligence and exception triage',
      attestationScope: 'Supplier security and compliance posture',
      responseOwnerModel: 'Vendor contact and internal reviewer',
      evidenceCollectionMode: 'Structured evidence collection',
      fileUploadGuidance: 'Collect SOC reports, policy excerpts, and supporting diligence artifacts during response handling.',
      exportMode: 'Spreadsheet-ready',
      distributionCadence: 'Recurring or event-driven',
      scoringMode: 'weighted',
      status: 'active',
      questions: buildQuestionnaireSeedQuestions(),
      rules: buildQuestionnaireSeedRules(),
    },
    {
      seedKey: 'assessment-plan-manual-audit',
      templateKind: 'assessment-plan',
      name: 'Manual Control Assessment Plan',
      description: 'Reusable lines of inquiry for manual control assessments inside scoped compliance reviews.',
      audience: 'Internal assessors',
      ownerTeam: 'Assessment Ops',
      sourceFramework: 'NIST 800-53 Rev. 5',
      usageNotes:
        'Load these lines of inquiry into manual assessments to drive consistent audit checks, observations, and follow-up.',
      scoringMode: 'boolean',
      status: 'active',
      questions: buildAssessmentPlanSeedQuestions(),
      rules: buildAssessmentPlanSeedRules(),
    },
  ];
}

async function ensureSeedQuestionnaires(
  env: WorkerRequestContext['env'],
  tenantId: string,
  userId: string | null,
): Promise<void> {
  const rows = await env.D1_MAIN.prepare(
    `SELECT id, metadata_json FROM questionnaire_templates WHERE tenant_id = ?`,
  )
    .bind(tenantId)
    .all<{ id: string; metadata_json: string | null }>();

  const existingSeedKeys = new Set(
    (rows.results ?? [])
      .map((row) => asJson<QuestionnaireTemplateMetadata | null>(row.metadata_json, null)?.seedKey?.trim())
      .filter(Boolean),
  );

  for (const seed of buildSeedTemplateDefinitions()) {
    if (existingSeedKeys.has(seed.seedKey)) {
      continue;
    }

    const createdAt = nowIso();
    const templateId = crypto.randomUUID();
    const ruleSetId = crypto.randomUUID();
    const diagnostics = buildRuleDiagnostics(seed.rules, seed.questions);

    await env.D1_MAIN.batch([
      env.D1_MAIN.prepare(
        `INSERT INTO questionnaire_templates (
          id, tenant_id, name, description, status, scoring_mode, audience, version,
          questions_json, metadata_json, created_by_user_id, updated_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        templateId,
        tenantId,
        seed.name,
        seed.description,
        seed.status,
        seed.scoringMode,
        seed.audience,
        1,
        JSON.stringify(seed.questions),
        JSON.stringify(
          buildTemplateMetadata({
            templateKind: seed.templateKind,
            sourceFramework: seed.sourceFramework ?? null,
            usageNotes: seed.usageNotes ?? null,
            ownerTeam: seed.ownerTeam,
            source: 'regovise-canonical-seed',
            seedKey: seed.seedKey,
            questionnaireType: seed.questionnaireType ?? null,
            assignmentModel: seed.assignmentModel ?? null,
            relatedWorkflow: seed.relatedWorkflow ?? null,
            attestationScope: seed.attestationScope ?? null,
            responseOwnerModel: seed.responseOwnerModel ?? null,
            evidenceCollectionMode: seed.evidenceCollectionMode ?? null,
            fileUploadGuidance: seed.fileUploadGuidance ?? null,
            exportMode: seed.exportMode ?? null,
            distributionCadence: seed.distributionCadence ?? null,
            ownerName: seed.ownerTeam,
            profile: seed.templateKind === 'assessment-plan' ? 'Control Assessment Profile' : 'Vendor Security Profile',
            instructions:
              seed.templateKind === 'assessment-plan'
                ? 'Use these lines of inquiry to complete manual assessment fieldwork and record observations.'
                : 'Complete each required question, attach supporting evidence where requested, and submit for reviewer feedback.',
            allowPublicUrl: seed.templateKind === 'questionnaire',
            loginRequired: false,
            enableScoring: true,
            enableQuestionAssignment: false,
          }),
        ),
        userId,
        userId,
        createdAt,
        createdAt,
      ),
      env.D1_MAIN.prepare(
        `INSERT INTO questionnaire_rule_sets (
          id, tenant_id, questionnaire_template_id, name, engine_version, rules_json, diagnostics_json,
          created_by_user_id, updated_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        ruleSetId,
        tenantId,
        templateId,
        seed.templateKind === 'assessment-plan' ? 'Assessment plan rule set' : 'Default rule set',
        '1.0',
        JSON.stringify(seed.rules),
        JSON.stringify(diagnostics),
        userId,
        userId,
        createdAt,
        createdAt,
      ),
    ]);
  }
}

async function listQuestionnaireSummaries(
  env: WorkerRequestContext['env'],
  tenantId: string,
): Promise<QuestionnaireTemplateSummary[]> {
  const rows = await env.D1_MAIN.prepare(
    `SELECT
       template.id,
       template.name,
       template.description,
       template.status,
       template.scoring_mode,
       template.audience,
       template.version,
       template.questions_json,
       template.metadata_json,
       template.updated_at,
       rules.rules_json,
       (SELECT COUNT(1) FROM questionnaire_instances instance
          WHERE instance.tenant_id = template.tenant_id
            AND instance.questionnaire_template_id = template.id
            AND instance.archived = 0) AS instance_count,
       (SELECT COUNT(1) FROM questionnaire_instances instance
          WHERE instance.tenant_id = template.tenant_id
            AND instance.questionnaire_template_id = template.id
            AND instance.status IN ('Submitted', 'Accepted')
            AND instance.archived = 0) AS submitted_count
     FROM questionnaire_templates template
     LEFT JOIN questionnaire_rule_sets rules
       ON rules.questionnaire_template_id = template.id
      AND rules.tenant_id = template.tenant_id
     WHERE template.tenant_id = ?
     ORDER BY template.updated_at DESC`,
  )
    .bind(tenantId)
    .all<QuestionnaireTemplateRow & { rules_json: string | null; instance_count: number | null; submitted_count: number | null }>();

  return rows.results.map((row) => {
    const questions = asJson<QuestionnaireQuestion[]>(row.questions_json, []);
    const metadata = asJson<QuestionnaireTemplateMetadata | null>(row.metadata_json, null);
    const summary = summarizeTemplateMetadata(metadata, questions);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      templateKind: summary.templateKind,
      audience: row.audience,
      scoringMode: row.scoring_mode,
      version: row.version,
      questionCount: questions.length,
      ruleCount: asJson<QuestionnaireRule[]>(row.rules_json, []).length,
      sourceFramework: summary.sourceFramework,
      usageNotes: summary.usageNotes,
      questionnaireType: summary.questionnaireType,
      assignmentModel: summary.assignmentModel,
      relatedWorkflow: summary.relatedWorkflow,
      attestationScope: summary.attestationScope,
      responseOwnerModel: summary.responseOwnerModel,
      evidenceCollectionMode: summary.evidenceCollectionMode,
      fileUploadGuidance: summary.fileUploadGuidance,
      exportMode: summary.exportMode,
      distributionCadence: summary.distributionCadence,
      ownerUserId: summary.ownerUserId,
      ownerName: summary.ownerName,
      profile: summary.profile,
      instructions: summary.instructions,
      allowPublicUrl: summary.allowPublicUrl,
      loginRequired: summary.loginRequired,
      enableScoring: summary.enableScoring,
      enableQuestionAssignment: summary.enableQuestionAssignment,
      mappedRequirementCount: summary.mappedRequirementCount,
      instanceCount: Number(row.instance_count ?? 0),
      submittedCount: Number(row.submitted_count ?? 0),
      updatedAt: row.updated_at,
    };
  });
}

async function getQuestionnaireTemplateRow(
  env: WorkerRequestContext['env'],
  tenantId: string,
  questionnaireId: string,
): Promise<QuestionnaireTemplateRow> {
  const row = await env.D1_MAIN.prepare(
    `SELECT * FROM questionnaire_templates WHERE tenant_id = ? AND id = ? LIMIT 1`,
  )
    .bind(tenantId, questionnaireId)
    .first<QuestionnaireTemplateRow>();

  if (!row) {
    throw new Error(`Questionnaire ${questionnaireId} was not found.`);
  }

  return row;
}

async function getRuleSetRow(
  env: WorkerRequestContext['env'],
  tenantId: string,
  questionnaireId: string,
): Promise<QuestionnaireRuleSetRow | null> {
  return env.D1_MAIN.prepare(
    `SELECT * FROM questionnaire_rule_sets WHERE tenant_id = ? AND questionnaire_template_id = ? LIMIT 1`,
  )
    .bind(tenantId, questionnaireId)
    .first<QuestionnaireRuleSetRow>();
}

async function listRuleTestRuns(
  env: WorkerRequestContext['env'],
  tenantId: string,
  questionnaireId: string,
): Promise<RuleTestRun[]> {
  const rows = await env.D1_MAIN.prepare(
    `SELECT * FROM questionnaire_rule_test_runs
      WHERE tenant_id = ? AND questionnaire_template_id = ?
      ORDER BY created_at DESC
      LIMIT 12`,
  )
    .bind(tenantId, questionnaireId)
    .all<QuestionnaireTestRunRow>();

  return rows.results.map((row) => ({
    id: row.id,
    scenarioName: row.scenario_name,
    status: row.status,
    input: asJson<Record<string, unknown>>(row.input_json, {}),
    executionLog: asJson<string[]>(row.execution_log_json, []),
    result: asJson<RuleTestRun['result']>(row.result_json, {
      matchedRules: [],
      visibleQuestions: [],
      hiddenQuestions: [],
      disabledQuestions: [],
      requiredQuestions: [],
      displayOptions: {},
      validationErrors: [],
      answerUpdates: {},
      score: 0,
      maxScore: 0,
      percentComplete: 0,
      passingStatus: 'Incomplete',
      grade: 'Pending',
    }),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  }));
}

async function getQuestionnaireDetail(
  env: WorkerRequestContext['env'],
  tenantId: string,
  questionnaireId: string,
): Promise<{
  template: QuestionnaireTemplateDetail;
  ruleSet: RuleSetDetail;
  testRuns: RuleTestRun[];
}> {
  const templateRow = await getQuestionnaireTemplateRow(env, tenantId, questionnaireId);
  const ruleSetRow = await getRuleSetRow(env, tenantId, questionnaireId);
  const questions = asJson<QuestionnaireQuestion[]>(templateRow.questions_json, []);
  const metadata = asJson<QuestionnaireTemplateMetadata | null>(templateRow.metadata_json, null);
  const summary = summarizeTemplateMetadata(metadata, questions);
  const rules = asJson<QuestionnaireRule[]>(ruleSetRow?.rules_json ?? '[]', []);
  const diagnostics = asJson<RuleDiagnostic[]>(
    ruleSetRow?.diagnostics_json ?? '[]',
    buildRuleDiagnostics(rules, questions),
  );

  return {
    template: {
      id: templateRow.id,
      name: templateRow.name,
      description: templateRow.description,
      status: templateRow.status,
      templateKind: summary.templateKind,
      scoringMode: templateRow.scoring_mode,
      audience: templateRow.audience,
      version: templateRow.version,
      questions,
      metadata: metadata as Record<string, unknown> | null,
      sourceFramework: summary.sourceFramework,
      usageNotes: summary.usageNotes,
      questionnaireType: summary.questionnaireType,
      assignmentModel: summary.assignmentModel,
      relatedWorkflow: summary.relatedWorkflow,
      attestationScope: summary.attestationScope,
      responseOwnerModel: summary.responseOwnerModel,
      evidenceCollectionMode: summary.evidenceCollectionMode,
      fileUploadGuidance: summary.fileUploadGuidance,
      exportMode: summary.exportMode,
      distributionCadence: summary.distributionCadence,
      ownerUserId: summary.ownerUserId,
      ownerName: summary.ownerName,
      profile: summary.profile,
      instructions: summary.instructions,
      allowPublicUrl: summary.allowPublicUrl,
      loginRequired: summary.loginRequired,
      enableScoring: summary.enableScoring,
      enableQuestionAssignment: summary.enableQuestionAssignment,
      mappedRequirementCount: summary.mappedRequirementCount,
      createdAt: templateRow.created_at,
      updatedAt: templateRow.updated_at,
    },
    ruleSet: {
      id: ruleSetRow?.id ?? crypto.randomUUID(),
      questionnaireId,
      name: ruleSetRow?.name ?? 'Default rule set',
      engineVersion: ruleSetRow?.engine_version ?? '1.0',
      rules,
      diagnostics,
      updatedAt: ruleSetRow?.updated_at ?? templateRow.updated_at,
    },
    testRuns: await listRuleTestRuns(env, tenantId, questionnaireId),
  };
}

function buildPreviewTestRun(args: {
  scenarioName: string;
  answers: Record<string, unknown>;
  rules: QuestionnaireRule[];
  questions: QuestionnaireQuestion[];
}): RuleTestRun {
  const evaluation = evaluateRuleSet(args.rules, args.answers, args.questions);
  return {
    id: `preview-${crypto.randomUUID()}`,
    scenarioName: args.scenarioName,
    status: 'preview',
    input: args.answers,
    executionLog: evaluation.executionLog,
    result: {
      matchedRules: evaluation.matchedRules,
      visibleQuestions: evaluation.visibleQuestions,
      hiddenQuestions: evaluation.hiddenQuestions,
      disabledQuestions: evaluation.disabledQuestions,
      requiredQuestions: evaluation.requiredQuestions,
      displayOptions: evaluation.displayOptions,
      validationErrors: evaluation.validationErrors,
      answerUpdates: evaluation.answerUpdates,
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      percentComplete: evaluation.percentComplete,
      passingStatus: evaluation.passingStatus,
      grade: evaluation.grade,
    },
    createdByUserId: null,
    createdAt: nowIso(),
  };
}

function generateAccessCode() {
  return String(Math.floor(100000000 + Math.random() * 900000000));
}

function defaultAnswerForQuestion(question: QuestionnaireQuestion): unknown {
  if (question.type === 'boolean') return false;
  if (question.type === 'number') return '';
  if (question.type === 'multi-select') return [];
  if (question.type === 'table') return [];
  return '';
}

function buildInitialAnswers(questions: QuestionnaireQuestion[]) {
  return Object.fromEntries(questions.map((question) => [question.ref, defaultAnswerForQuestion(question)]));
}

function parseBulkEmails(input: AssignmentInput): string[] {
  const direct = Array.isArray(input.assigneeEmails) ? input.assigneeEmails : [];
  const fromCsv = (input.bulkCsv ?? '')
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
  const single = input.assigneeEmail ? [input.assigneeEmail] : [];
  return Array.from(new Set([...direct, ...fromCsv, ...single].map((value) => value.trim()).filter(Boolean)));
}

function publicShareLink(shareToken: string) {
  return `/questionnaires/response/${shareToken}`;
}

async function getQuestionnaireInstanceRow(
  env: WorkerRequestContext['env'],
  tenantId: string,
  templateId: string,
  instanceId: string,
): Promise<QuestionnaireInstanceRow | null> {
  return env.D1_MAIN.prepare(
    `SELECT * FROM questionnaire_instances
      WHERE tenant_id = ? AND questionnaire_template_id = ? AND id = ?
      LIMIT 1`,
  )
    .bind(tenantId, templateId, instanceId)
    .first<QuestionnaireInstanceRow>();
}

async function getQuestionnaireInstanceByToken(
  env: WorkerRequestContext['env'],
  shareToken: string,
): Promise<QuestionnaireInstanceRow | null> {
  return env.D1_MAIN.prepare(
    `SELECT * FROM questionnaire_instances WHERE share_token = ? AND archived = 0 LIMIT 1`,
  )
    .bind(shareToken)
    .first<QuestionnaireInstanceRow>();
}

function toQuestionnaireInstance(row: QuestionnaireInstanceRow, templateName: string): QuestionnaireInstance {
  return {
    id: row.id,
    questionnaireId: row.questionnaire_template_id,
    templateName,
    title: row.title,
    assignmentType: row.assignment_type,
    assigneeUserId: row.assignee_user_id,
    assigneeEmail: row.assignee_email,
    reviewerUserId: row.reviewer_user_id,
    parentModule: row.parent_module,
    parentRecordId: row.parent_record_id,
    status: row.status,
    dueDate: row.due_date,
    accessCode: row.access_code,
    shareToken: row.share_token,
    shareLink: publicShareLink(row.share_token),
    loginRequired: Boolean(row.login_required),
    answers: asJson<Record<string, unknown>>(row.answers_json, {}),
    uploads: asJson<Record<string, unknown>>(row.uploads_json, {}),
    headerValues: asJson<Record<string, unknown>>(row.header_values_json, {}),
    feedback: asJson<Record<string, { rating?: string | null; comment?: string | null }>>(row.feedback_json, {}),
    collaboration: asJson<QuestionnaireInstance['collaboration']>(row.collaboration_json, []),
    recurrence: asJson<Record<string, unknown> | null>(row.recurrence_json, null),
    score: Number(row.score ?? 0),
    maxScore: Number(row.max_score ?? 0),
    grade: row.grade,
    percentComplete: Number(row.percent_complete ?? 0),
    passingStatus: row.passing_status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    archived: Boolean(row.archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function runtimeStateFromEvaluation(evaluation: ReturnType<typeof evaluateQuestionnaireRuntime>): NonNullable<QuestionnaireInstance['runtime']> {
  return {
    visibleQuestions: evaluation.visibleQuestions,
    hiddenQuestions: evaluation.hiddenQuestions,
    disabledQuestions: evaluation.disabledQuestions,
    requiredQuestions: evaluation.requiredQuestions,
    displayOptions: evaluation.displayOptions,
    validationErrors: evaluation.validationErrors,
  };
}

function attachQuestionnaireRuntime(
  instance: QuestionnaireInstance,
  questions: QuestionnaireQuestion[],
  rules: QuestionnaireRule[],
): QuestionnaireInstance {
  const evaluation = evaluateQuestionnaireRuntime(questions, rules, instance.answers);
  return {
    ...instance,
    answers: evaluation.answers,
    runtime: runtimeStateFromEvaluation(evaluation),
  };
}

async function listQuestionnaireInstances(
  env: WorkerRequestContext['env'],
  tenantId: string,
  templateId: string,
): Promise<QuestionnaireInstance[]> {
  const template = await getQuestionnaireTemplateRow(env, tenantId, templateId);
  const rows = await env.D1_MAIN.prepare(
    `SELECT * FROM questionnaire_instances
      WHERE tenant_id = ? AND questionnaire_template_id = ? AND archived = 0
      ORDER BY updated_at DESC`,
  )
    .bind(tenantId, templateId)
    .all<QuestionnaireInstanceRow>();
  return rows.results.map((row) => toQuestionnaireInstance(row, template.name));
}

async function writeQuestionnaireHistory(args: {
  env: WorkerRequestContext['env'];
  tenantId: string;
  instanceId: string;
  discriminator: string;
  payload: unknown;
  userId: string | null;
}) {
  await args.env.D1_MAIN.prepare(
    `INSERT INTO questionnaire_history_entries (
      id, tenant_id, questionnaire_instance_id, discriminator, json_data, created_by_user_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      args.tenantId,
      args.instanceId,
      args.discriminator,
      JSON.stringify(args.payload),
      args.userId,
      nowIso(),
    )
    .run();
}

async function upsertQuestionnaireProperties(args: {
  env: WorkerRequestContext['env'];
  tenantId: string;
  templateId: string;
  instanceId: string;
  questions: QuestionnaireQuestion[];
  answers: Record<string, unknown>;
}) {
  const timestamp = nowIso();
  const statements = args.questions
    .filter((question) => question.type !== 'instructional')
    .map((question) =>
      args.env.D1_MAIN.prepare(
        `INSERT INTO questionnaire_response_properties (
          id, tenant_id, questionnaire_instance_id, questionnaire_template_id, key, label, value,
          secondary_id, secondary_module, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id, questionnaire_instance_id, key)
        DO UPDATE SET label = excluded.label, value = excluded.value, secondary_id = excluded.secondary_id,
                      secondary_module = excluded.secondary_module, updated_at = excluded.updated_at`,
      ).bind(
        crypto.randomUUID(),
        args.tenantId,
        args.instanceId,
        args.templateId,
        question.ref,
        question.prompt,
        JSON.stringify(args.answers[question.ref] ?? null),
        question.requirementRef ?? null,
        question.requirementRef ? 'security-controls' : null,
        timestamp,
        timestamp,
      ),
    );
  if (statements.length > 0) {
    await args.env.D1_MAIN.batch(statements);
  }
}

async function createQuestionnaireInstance(args: {
  env: WorkerRequestContext['env'];
  tenantId: string;
  template: QuestionnaireTemplateDetail;
  assignmentType: string;
  title: string;
  assigneeUserId?: string | null;
  assigneeEmail?: string | null;
  reviewerUserId?: string | null;
  parentModule?: string | null;
  parentRecordId?: string | null;
  dueDate?: string | null;
  recurrence?: Record<string, unknown> | null;
  loginRequired?: boolean;
  rules?: QuestionnaireRule[];
  userId: string | null;
}): Promise<QuestionnaireInstance> {
  const timestamp = nowIso();
  const instanceId = crypto.randomUUID();
  const initialAnswers = buildInitialAnswers(args.template.questions);
  const runtime = evaluateQuestionnaireRuntime(args.template.questions, args.rules ?? [], initialAnswers);
  const answers = runtime.answers;
  const shareToken = crypto.randomUUID();
  await args.env.D1_MAIN.prepare(
    `INSERT INTO questionnaire_instances (
      id, tenant_id, questionnaire_template_id, title, assignment_type, assignee_user_id, assignee_email,
      reviewer_user_id, parent_module, parent_record_id, status, due_date, access_code, share_token,
      login_required, answers_json, uploads_json, header_values_json, feedback_json, collaboration_json,
      recurrence_json, score, max_score, grade, percent_complete, passing_status, created_by_user_id,
      updated_by_user_id, archived, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      instanceId,
      args.tenantId,
      args.template.id,
      args.title,
      args.assignmentType,
      args.assigneeUserId ?? null,
      args.assigneeEmail ?? null,
      args.reviewerUserId ?? null,
      args.parentModule ?? null,
      args.parentRecordId ?? null,
      'Open',
      args.dueDate ?? null,
      generateAccessCode(),
      shareToken,
      args.loginRequired ? 1 : 0,
      JSON.stringify(answers),
      JSON.stringify({}),
      JSON.stringify({}),
      JSON.stringify({}),
      JSON.stringify([]),
      args.recurrence ? JSON.stringify(args.recurrence) : null,
      runtime.score,
      runtime.maxScore,
      runtime.grade,
      runtime.percentComplete,
      runtime.passingStatus,
      args.userId,
      args.userId,
      0,
      timestamp,
      timestamp,
    )
    .run();
  await upsertQuestionnaireProperties({
    env: args.env,
    tenantId: args.tenantId,
    templateId: args.template.id,
    instanceId,
    questions: args.template.questions,
    answers,
  });
  const row = await getQuestionnaireInstanceRow(args.env, args.tenantId, args.template.id, instanceId);
  if (!row) {
    throw new Error('Questionnaire instance creation failed.');
  }
  return attachQuestionnaireRuntime(toQuestionnaireInstance(row, args.template.name), args.template.questions, args.rules ?? []);
}

async function updateQuestionnaireInstanceState(args: {
  env: WorkerRequestContext['env'];
  tenantId: string;
  template: QuestionnaireTemplateDetail;
  row: QuestionnaireInstanceRow;
  status: string;
  userId: string | null;
  feedback?: Record<string, { rating?: string | null; comment?: string | null }>;
  collaborationEntry?: QuestionnaireInstance['collaboration'][number] | null;
}) {
  const timestamp = nowIso();
  const collaboration = asJson<QuestionnaireInstance['collaboration']>(args.row.collaboration_json, []);
  if (args.collaborationEntry) {
    collaboration.push(args.collaborationEntry);
  }
  const feedback = args.feedback ?? asJson<Record<string, { rating?: string | null; comment?: string | null }>>(args.row.feedback_json, {});
  await args.env.D1_MAIN.prepare(
    `UPDATE questionnaire_instances
        SET status = ?, feedback_json = ?, collaboration_json = ?, submitted_at = ?,
            reviewed_at = ?, updated_by_user_id = ?, updated_at = ?
      WHERE tenant_id = ? AND questionnaire_template_id = ? AND id = ?`,
  )
    .bind(
      args.status,
      JSON.stringify(feedback),
      JSON.stringify(collaboration),
      args.status === 'Submitted' ? timestamp : args.row.submitted_at,
      args.status === 'Accepted' || args.status === 'RequestChanges' || args.status === 'Closed' ? timestamp : args.row.reviewed_at,
      args.userId,
      timestamp,
      args.tenantId,
      args.template.id,
      args.row.id,
    )
    .run();
  const next = await getQuestionnaireInstanceRow(args.env, args.tenantId, args.template.id, args.row.id);
  if (next) {
    await writeQuestionnaireHistory({
      env: args.env,
      tenantId: args.tenantId,
      instanceId: args.row.id,
      discriminator: args.status,
      payload: toQuestionnaireInstance(next, args.template.name),
      userId: args.userId,
    });
  }
}

async function handlePublicQuestionnaireAccess(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const [, shareToken, action] = segments;
  if (!shareToken) {
    return json({ error: 'missing_share_token', message: 'Questionnaire response link is incomplete.' }, { status: 400 });
  }
  const row = await getQuestionnaireInstanceByToken(ctx.env, shareToken);
  if (!row) {
    return json({ error: 'not_found', message: 'Questionnaire response link was not found.' }, { status: 404 });
  }
  const templateRow = await getQuestionnaireTemplateRow(ctx.env, row.tenant_id, row.questionnaire_template_id);
  const detail = await getQuestionnaireDetail(ctx.env, row.tenant_id, row.questionnaire_template_id);
  const templateDetail = detail.template;
  const instance = toQuestionnaireInstance(row, templateRow.name);
  const runtime = evaluateQuestionnaireRuntime(templateDetail.questions, detail.ruleSet.rules, instance.answers);

  if (!action && ctx.request.method === 'GET') {
    return json({
      data: {
        title: instance.title,
        templateName: instance.templateName,
        status: instance.status,
        dueDate: instance.dueDate,
        loginRequired: instance.loginRequired,
        questions: templateDetail.questions.map((question) => ({
          ref: question.ref,
          prompt: question.prompt,
          type: question.type,
          section: question.section,
          required: question.required,
          options: question.options ?? [],
          helpText: question.helpText ?? null,
          evidenceHint: question.evidenceHint ?? null,
          enableUpload: Boolean(question.enableUpload || question.type === 'file-upload'),
        })),
        runtime: runtimeStateFromEvaluation(runtime),
      },
    });
  }

  const body = await readJson<ResponseUpdateInput>(ctx.request);
  if (body.accessCode?.trim() !== row.access_code) {
    return json({ error: 'invalid_access_code', message: 'The access code did not match this questionnaire response.' }, { status: 403 });
  }

  if (action === 'validate' && ctx.request.method === 'POST') {
    return json({ data: attachQuestionnaireRuntime(instance, templateDetail.questions, detail.ruleSet.rules) });
  }

  if (action === 'responses' && ctx.request.method === 'PUT') {
    if (!['Open', 'RequestChanges'].includes(row.status)) {
      return json({ error: 'locked_response', message: 'Submitted or closed questionnaire responses are locked.' }, { status: 409 });
    }
    const mergedAnswers = { ...asJson<Record<string, unknown>>(row.answers_json, {}), ...asRecord(body.answers) };
    const responseRuntime = evaluateQuestionnaireRuntime(templateDetail.questions, detail.ruleSet.rules, mergedAnswers);
    const answers = responseRuntime.answers;
    const uploads = { ...asJson<Record<string, unknown>>(row.uploads_json, {}), ...asRecord(body.uploads) };
    await ctx.env.D1_MAIN.prepare(
      `UPDATE questionnaire_instances
          SET answers_json = ?, uploads_json = ?, score = ?, max_score = ?, grade = ?,
              percent_complete = ?, passing_status = ?, updated_at = ?
        WHERE share_token = ?`,
    )
      .bind(
        JSON.stringify(answers),
        JSON.stringify(uploads),
        responseRuntime.score,
        responseRuntime.maxScore,
        responseRuntime.grade,
        responseRuntime.percentComplete,
        responseRuntime.passingStatus,
        nowIso(),
        shareToken,
      )
      .run();
    await upsertQuestionnaireProperties({
      env: ctx.env,
      tenantId: row.tenant_id,
      templateId: row.questionnaire_template_id,
      instanceId: row.id,
      questions: templateDetail.questions,
      answers,
    });
    const updated = await getQuestionnaireInstanceByToken(ctx.env, shareToken);
    return updated
      ? json({ data: attachQuestionnaireRuntime(toQuestionnaireInstance(updated, templateRow.name), templateDetail.questions, detail.ruleSet.rules) })
      : json({ error: 'not_found' }, { status: 404 });
  }

  if (action === 'submit' && ctx.request.method === 'POST') {
    const submitRuntime = evaluateQuestionnaireRuntime(templateDetail.questions, detail.ruleSet.rules, asJson<Record<string, unknown>>(row.answers_json, {}));
    if (submitRuntime.percentComplete < 100 || submitRuntime.validationErrors.length > 0) {
      return json(
        {
          error: 'validation_failed',
          message: 'Questionnaire responses must satisfy required questions and rule validations before submission.',
          validationErrors: submitRuntime.validationErrors,
          percentComplete: submitRuntime.percentComplete,
        },
        { status: 409 },
      );
    }
    await updateQuestionnaireInstanceState({
      env: ctx.env,
      tenantId: row.tenant_id,
      template: templateDetail,
      row,
      status: 'Submitted',
      userId: null,
      collaborationEntry: {
        id: crypto.randomUUID(),
        authorUserId: null,
        action: 'submit',
        message: 'External respondent submitted the questionnaire by access code.',
        createdAt: nowIso(),
      },
    });
    const updated = await getQuestionnaireInstanceByToken(ctx.env, shareToken);
    return updated
      ? json({ data: attachQuestionnaireRuntime(toQuestionnaireInstance(updated, templateRow.name), templateDetail.questions, detail.ruleSet.rules) })
      : json({ error: 'not_found' }, { status: 404 });
  }

  return methodNotAllowed(['GET', 'POST', 'PUT']);
}

export async function handleBuilderRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  if (segments[0] === 'questionnaire-access') {
    return handlePublicQuestionnaireAccess(segments, ctx);
  }

  const builderAccess = await requireAnyPermission(
    ctx,
    ctx.request.method === 'GET'
      ? ['view_framework', 'add_framework', 'change_framework']
      : ['add_framework', 'change_framework'],
    ctx.request.method === 'GET'
      ? 'Builder access requires framework-view permissions.'
      : 'Builder changes require framework management permissions.',
  );
  if (builderAccess instanceof Response) {
    return builderAccess;
  }

  if (segments[0] === 'exports') {
    return handleExportBuilderRoutes(segments, ctx);
  }

  if (segments[0] === 'forms') {
    return handleFormBuilderRoutes(segments, ctx);
  }

  if (segments[0] === 'reports') {
    return handleReportBuilderRoutes(segments, ctx);
  }

  if (segments[0] === 'dashboards') {
    return handleDashboardBuilderRoutes(segments, ctx);
  }

  if (segments[0] === 'wayfinders') {
    return handleWayfinderBuilderRoutes(segments, ctx);
  }

  const tenantIdOrResponse = requireTenant(ctx);
  if (tenantIdOrResponse instanceof Response) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;

  const [resource, id, subresource] = segments;
  if (resource !== 'questionnaires') {
    return json({ error: 'unknown_builder_resource', resource }, { status: 404 });
  }

  await ensureSeedQuestionnaires(ctx.env, tenantId, ctx.userId);

  if (id === 'import') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }
    const userIdOrResponse = requireUser(ctx);
    if (userIdOrResponse instanceof Response) {
      return userIdOrResponse;
    }
    const body = await readJson<{ template?: Partial<UpdateQuestionnaireInput> & { name?: string }; rules?: QuestionnaireRule[] }>(ctx.request);
    const templateKind = normalizeTemplateKind(body.template?.templateKind);
    const questions = Array.isArray(body.template?.questions) && body.template.questions.length > 0
      ? body.template.questions
      : templateKind === 'assessment-plan'
        ? buildAssessmentPlanSeedQuestions()
        : buildQuestionnaireSeedQuestions();
    const rules = Array.isArray(body.rules) ? body.rules : templateKind === 'assessment-plan' ? buildAssessmentPlanSeedRules() : buildQuestionnaireSeedRules();
    const timestamp = nowIso();
    const templateId = crypto.randomUUID();
    const ruleSetId = crypto.randomUUID();
    const metadata = buildTemplateMetadata({
      templateKind,
      sourceFramework: body.template?.sourceFramework?.trim() || null,
      usageNotes: body.template?.usageNotes?.trim() || 'Imported from Questionnaire Builder JSON.',
      ownerTeam: 'Imported',
      source: 'user-import',
      questionnaireType: body.template?.questionnaireType?.trim() || (templateKind === 'questionnaire' ? 'Imported' : null),
      assignmentModel: body.template?.assignmentModel?.trim() || (templateKind === 'questionnaire' ? 'User assignment' : null),
      relatedWorkflow: body.template?.relatedWorkflow?.trim() || null,
      attestationScope: body.template?.attestationScope?.trim() || null,
      responseOwnerModel: body.template?.responseOwnerModel?.trim() || null,
      evidenceCollectionMode: body.template?.evidenceCollectionMode?.trim() || null,
      fileUploadGuidance: body.template?.fileUploadGuidance?.trim() || null,
      exportMode: body.template?.exportMode?.trim() || null,
      distributionCadence: body.template?.distributionCadence?.trim() || null,
      ownerUserId: body.template?.ownerUserId?.trim() || userIdOrResponse,
      ownerName: body.template?.ownerName?.trim() || null,
      profile: body.template?.profile?.trim() || null,
      instructions: body.template?.instructions?.trim() || null,
      allowPublicUrl: Boolean(body.template?.allowPublicUrl),
      loginRequired: Boolean(body.template?.loginRequired),
      enableScoring: body.template?.enableScoring ?? true,
      enableQuestionAssignment: Boolean(body.template?.enableQuestionAssignment),
    });
    const diagnostics = buildRuleDiagnostics(rules, questions);
    await ctx.env.D1_MAIN.batch([
      ctx.env.D1_MAIN.prepare(
        `INSERT INTO questionnaire_templates (
          id, tenant_id, name, description, status, scoring_mode, audience, version,
          questions_json, metadata_json, created_by_user_id, updated_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        templateId,
        tenantId,
        body.template?.name?.trim() || 'Imported Questionnaire',
        body.template?.description?.trim() || null,
        body.template?.status?.trim() || 'draft',
        body.template?.scoringMode?.trim() || 'weighted',
        body.template?.audience?.trim() || null,
        1,
        JSON.stringify(questions),
        JSON.stringify(metadata),
        userIdOrResponse,
        userIdOrResponse,
        timestamp,
        timestamp,
      ),
      ctx.env.D1_MAIN.prepare(
        `INSERT INTO questionnaire_rule_sets (
          id, tenant_id, questionnaire_template_id, name, engine_version, rules_json, diagnostics_json,
          created_by_user_id, updated_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        ruleSetId,
        tenantId,
        templateId,
        'Imported rule set',
        '1.0',
        JSON.stringify(rules),
        JSON.stringify(diagnostics),
        userIdOrResponse,
        userIdOrResponse,
        timestamp,
        timestamp,
      ),
    ]);
    return json({ data: await getQuestionnaireDetail(ctx.env, tenantId, templateId) }, { status: 201 });
  }

  if (!id) {
    if (ctx.request.method === 'GET') {
      const templates = await listQuestionnaireSummaries(ctx.env, tenantId);
      return json({ data: { templates } });
    }

    if (ctx.request.method === 'POST') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }

      const body = await readJson<CreateQuestionnaireInput>(ctx.request);
      const questionnaireId = crypto.randomUUID();
      const ruleSetId = crypto.randomUUID();
      const timestamp = nowIso();
      const templateKind = normalizeTemplateKind(body.templateKind);
      const questions =
        templateKind === 'assessment-plan' ? buildAssessmentPlanSeedQuestions() : buildQuestionnaireSeedQuestions();
      const rules =
        templateKind === 'assessment-plan' ? buildAssessmentPlanSeedRules() : buildQuestionnaireSeedRules();
      const diagnostics = buildRuleDiagnostics(rules, questions);
      const metadata = buildTemplateMetadata({
        templateKind,
        sourceFramework: body.sourceFramework?.trim() || null,
        usageNotes: body.usageNotes?.trim() || null,
        ownerTeam: templateKind === 'assessment-plan' ? 'Assessment Ops' : 'Questionnaire Ops',
        source: 'user-created',
        questionnaireType: body.questionnaireType?.trim() || (templateKind === 'questionnaire' ? 'Compliance Intake' : null),
        assignmentModel: body.assignmentModel?.trim() || (templateKind === 'questionnaire' ? 'User assignment' : null),
        relatedWorkflow: body.relatedWorkflow?.trim() || (templateKind === 'questionnaire' ? 'Risk and compliance intake' : null),
        attestationScope:
          body.attestationScope?.trim() ||
          (templateKind === 'questionnaire' ? 'Requirements, controls, or supporting audit inputs' : null),
        responseOwnerModel:
          body.responseOwnerModel?.trim() ||
          (templateKind === 'questionnaire' ? 'Internal control owner or external respondent' : null),
        evidenceCollectionMode:
          body.evidenceCollectionMode?.trim() ||
          (templateKind === 'questionnaire' ? 'Supporting evidence requested' : null),
        fileUploadGuidance: body.fileUploadGuidance?.trim() || null,
        exportMode: body.exportMode?.trim() || (templateKind === 'questionnaire' ? 'Spreadsheet-ready' : null),
        distributionCadence: body.distributionCadence?.trim() || (templateKind === 'questionnaire' ? 'As needed' : null),
        ownerUserId: body.ownerUserId?.trim() || userIdOrResponse,
        ownerName: body.ownerName?.trim() || null,
        profile: body.profile?.trim() || (templateKind === 'questionnaire' ? 'General Questionnaire Profile' : 'Assessment Plan Profile'),
        instructions:
          body.instructions?.trim() ||
          (templateKind === 'questionnaire'
            ? 'Complete required questions, add evidence where requested, and submit for review.'
            : 'Use each line of inquiry to guide assessment fieldwork and reviewer follow-up.'),
        allowPublicUrl: body.allowPublicUrl ?? templateKind === 'questionnaire',
        loginRequired: Boolean(body.loginRequired),
        enableScoring: body.enableScoring ?? true,
        enableQuestionAssignment: Boolean(body.enableQuestionAssignment),
      });

      await ctx.env.D1_MAIN.batch([
        ctx.env.D1_MAIN.prepare(
          `INSERT INTO questionnaire_templates (
             id, tenant_id, name, description, status, scoring_mode, audience, version,
             questions_json, metadata_json, created_by_user_id, updated_by_user_id, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          questionnaireId,
          tenantId,
          body.name?.trim() || (templateKind === 'assessment-plan' ? 'Untitled Assessment Plan' : 'Untitled Questionnaire'),
          body.description?.trim() || null,
          'draft',
          templateKind === 'assessment-plan' ? 'boolean' : 'weighted',
          body.audience?.trim() || (templateKind === 'assessment-plan' ? 'Internal assessors' : 'Internal reviewers'),
          1,
          JSON.stringify(questions),
          JSON.stringify(metadata),
          userIdOrResponse,
          userIdOrResponse,
          timestamp,
          timestamp,
        ),
        ctx.env.D1_MAIN.prepare(
          `INSERT INTO questionnaire_rule_sets (
             id, tenant_id, questionnaire_template_id, name, engine_version, rules_json, diagnostics_json,
             created_by_user_id, updated_by_user_id, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          ruleSetId,
          tenantId,
          questionnaireId,
          templateKind === 'assessment-plan' ? 'Assessment plan rule set' : 'Default rule set',
          '1.0',
          JSON.stringify(rules),
          JSON.stringify(diagnostics),
          userIdOrResponse,
          userIdOrResponse,
          timestamp,
          timestamp,
        ),
      ]);

      return json({ data: await getQuestionnaireDetail(ctx.env, tenantId, questionnaireId) }, { status: 201 });
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (!subresource) {
    if (ctx.request.method === 'GET') {
      return json({ data: await getQuestionnaireDetail(ctx.env, tenantId, id) });
    }

    if (ctx.request.method === 'PUT') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }
      const body = await readJson<UpdateQuestionnaireInput>(ctx.request);
      const current = await getQuestionnaireTemplateRow(ctx.env, tenantId, id);
      const nextQuestions = body.questions ?? asJson<QuestionnaireQuestion[]>(current.questions_json, []);
      const currentMetadata = asJson<QuestionnaireTemplateMetadata | null>(current.metadata_json, null);
      const nextTemplateKind = normalizeTemplateKind(body.templateKind ?? currentMetadata?.templateKind);
      const nextMetadata = buildTemplateMetadata({
        current: currentMetadata,
        templateKind: nextTemplateKind,
        sourceFramework: body.sourceFramework !== undefined ? body.sourceFramework?.trim() || null : undefined,
        usageNotes: body.usageNotes !== undefined ? body.usageNotes?.trim() || null : undefined,
        questionnaireType: body.questionnaireType !== undefined ? body.questionnaireType?.trim() || null : undefined,
        assignmentModel: body.assignmentModel !== undefined ? body.assignmentModel?.trim() || null : undefined,
        relatedWorkflow: body.relatedWorkflow !== undefined ? body.relatedWorkflow?.trim() || null : undefined,
        attestationScope: body.attestationScope !== undefined ? body.attestationScope?.trim() || null : undefined,
        responseOwnerModel:
          body.responseOwnerModel !== undefined ? body.responseOwnerModel?.trim() || null : undefined,
        evidenceCollectionMode:
          body.evidenceCollectionMode !== undefined ? body.evidenceCollectionMode?.trim() || null : undefined,
        fileUploadGuidance:
          body.fileUploadGuidance !== undefined ? body.fileUploadGuidance?.trim() || null : undefined,
        exportMode: body.exportMode !== undefined ? body.exportMode?.trim() || null : undefined,
        distributionCadence:
          body.distributionCadence !== undefined ? body.distributionCadence?.trim() || null : undefined,
        ownerUserId: body.ownerUserId !== undefined ? body.ownerUserId?.trim() || null : undefined,
        ownerName: body.ownerName !== undefined ? body.ownerName?.trim() || null : undefined,
        profile: body.profile !== undefined ? body.profile?.trim() || null : undefined,
        instructions: body.instructions !== undefined ? body.instructions?.trim() || null : undefined,
        allowPublicUrl: body.allowPublicUrl,
        loginRequired: body.loginRequired,
        enableScoring: body.enableScoring,
        enableQuestionAssignment: body.enableQuestionAssignment,
      });

      await ctx.env.D1_MAIN.prepare(
        `UPDATE questionnaire_templates
            SET name = ?, description = ?, status = ?, scoring_mode = ?, audience = ?, questions_json = ?, metadata_json = ?,
                version = version + 1, updated_by_user_id = ?, updated_at = ?
          WHERE tenant_id = ? AND id = ?`,
      )
        .bind(
          body.name?.trim() || current.name,
          body.description?.trim() || current.description,
          body.status?.trim() || current.status,
          body.scoringMode?.trim() || current.scoring_mode,
          body.audience?.trim() || current.audience,
          JSON.stringify(nextQuestions),
          JSON.stringify(nextMetadata),
          userIdOrResponse,
          nowIso(),
          tenantId,
          id,
        )
        .run();

      const detail = await getQuestionnaireDetail(ctx.env, tenantId, id);
      const diagnostics = buildRuleDiagnostics(detail.ruleSet.rules, detail.template.questions);
      await ctx.env.D1_MAIN.prepare(
        `UPDATE questionnaire_rule_sets
            SET diagnostics_json = ?, updated_by_user_id = ?, updated_at = ?
          WHERE tenant_id = ? AND questionnaire_template_id = ?`,
      )
        .bind(JSON.stringify(diagnostics), userIdOrResponse, nowIso(), tenantId, id)
        .run();

      return json({ data: await getQuestionnaireDetail(ctx.env, tenantId, id) });
    }

    if (ctx.request.method === 'DELETE') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }

      const current = await ctx.env.D1_MAIN.prepare(
        `SELECT id FROM questionnaire_templates WHERE tenant_id = ? AND id = ? LIMIT 1`,
      )
        .bind(tenantId, id)
        .first<{ id: string }>();
      if (!current) {
        return json({ error: 'not_found' }, { status: 404 });
      }
      const instanceRows = await ctx.env.D1_MAIN.prepare(
        `SELECT id FROM questionnaire_instances WHERE tenant_id = ? AND questionnaire_template_id = ?`,
      )
        .bind(tenantId, id)
        .all<{ id: string }>();
      const instanceIds = instanceRows.results.map((row) => row.id);
      const statements = [
        ctx.env.D1_MAIN.prepare(
          `DELETE FROM questionnaire_response_properties WHERE tenant_id = ? AND questionnaire_template_id = ?`,
        ).bind(tenantId, id),
        ctx.env.D1_MAIN.prepare(
          `DELETE FROM questionnaire_recurring_assignments WHERE tenant_id = ? AND questionnaire_template_id = ?`,
        ).bind(tenantId, id),
        ctx.env.D1_MAIN.prepare(
          `DELETE FROM questionnaire_rule_test_runs WHERE tenant_id = ? AND questionnaire_template_id = ?`,
        ).bind(tenantId, id),
        ctx.env.D1_MAIN.prepare(
          `DELETE FROM questionnaire_rule_sets WHERE tenant_id = ? AND questionnaire_template_id = ?`,
        ).bind(tenantId, id),
      ];
      for (const instanceId of instanceIds) {
        statements.push(
          ctx.env.D1_MAIN.prepare(
            `DELETE FROM questionnaire_history_entries WHERE tenant_id = ? AND questionnaire_instance_id = ?`,
          ).bind(tenantId, instanceId),
        );
      }
      statements.push(
        ctx.env.D1_MAIN.prepare(
          `DELETE FROM questionnaire_instances WHERE tenant_id = ? AND questionnaire_template_id = ?`,
        ).bind(tenantId, id),
        ctx.env.D1_MAIN.prepare(`DELETE FROM questionnaire_templates WHERE tenant_id = ? AND id = ?`).bind(
          tenantId,
          id,
        ),
      );
      await ctx.env.D1_MAIN.batch(statements);
      return json({ data: { deleted: true, id: current.id } });
    }

    return methodNotAllowed(['GET', 'PUT', 'DELETE']);
  }

  if (subresource === 'export') {
    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    const detail = await getQuestionnaireDetail(ctx.env, tenantId, id);
    const instances = await listQuestionnaireInstances(ctx.env, tenantId, id);
    return json({
      data: {
        exportedAt: nowIso(),
        template: detail.template,
        rules: detail.ruleSet.rules,
        instances: instances.map((instance) => ({
          id: instance.id,
          title: instance.title,
          status: instance.status,
          percentComplete: instance.percentComplete,
          score: instance.score,
          grade: instance.grade,
        })),
      },
    });
  }

  if (subresource === 'assignments') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }
    const userIdOrResponse = requireUser(ctx);
    if (userIdOrResponse instanceof Response) {
      return userIdOrResponse;
    }
    const body = await readJson<AssignmentInput>(ctx.request);
    const detail = await getQuestionnaireDetail(ctx.env, tenantId, id);
    const assignmentType = body.assignmentType ?? 'user';
    const title = body.title?.trim() || `${detail.template.name} assignment`;
    const loginRequired = body.loginRequired ?? detail.template.loginRequired;
    const emails = assignmentType === 'bulk' ? parseBulkEmails(body) : body.assigneeEmail ? [body.assigneeEmail] : [];
    const recipients =
      assignmentType === 'bulk'
        ? emails.map((email) => ({ assigneeEmail: email, assigneeUserId: null }))
        : [{ assigneeEmail: body.assigneeEmail?.trim() || null, assigneeUserId: body.assigneeUserId?.trim() || null }];
    const created: QuestionnaireInstance[] = [];
    for (const [index, recipient] of recipients.entries()) {
      created.push(
        await createQuestionnaireInstance({
          env: ctx.env,
          tenantId,
          template: detail.template,
          assignmentType,
          title: recipients.length > 1 ? `${title} ${index + 1}` : title,
          assigneeUserId: recipient.assigneeUserId,
          assigneeEmail: recipient.assigneeEmail,
          reviewerUserId: body.reviewerUserId?.trim() || userIdOrResponse,
          parentModule: body.parentModule?.trim() || null,
          parentRecordId: body.parentRecordId?.trim() || null,
          dueDate: body.dueDate?.trim() || null,
          recurrence:
            assignmentType === 'recurring'
              ? {
                  recurrenceType: body.recurrenceType?.trim() || 'Monthly',
                  startDate: body.startDate?.trim() || nowIso().slice(0, 10),
                  endDate: body.endDate?.trim() || null,
                }
              : null,
          loginRequired,
          rules: detail.ruleSet.rules,
          userId: userIdOrResponse,
        }),
      );
    }

    if (assignmentType === 'recurring') {
      const timestamp = nowIso();
      await ctx.env.D1_MAIN.prepare(
        `INSERT INTO questionnaire_recurring_assignments (
          id, tenant_id, questionnaire_template_id, title, recipient_user_id, recipient_email, reviewer_user_id,
          recurrence_type, start_date, end_date, last_sent_at, next_send_at, status, created_by_user_id,
          updated_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          crypto.randomUUID(),
          tenantId,
          id,
          title,
          body.assigneeUserId?.trim() || null,
          body.assigneeEmail?.trim() || null,
          body.reviewerUserId?.trim() || userIdOrResponse,
          body.recurrenceType?.trim() || 'Monthly',
          body.startDate?.trim() || nowIso().slice(0, 10),
          body.endDate?.trim() || null,
          timestamp,
          body.startDate?.trim() || nowIso().slice(0, 10),
          'Active',
          userIdOrResponse,
          userIdOrResponse,
          timestamp,
          timestamp,
        )
        .run();
    }

    return json({ data: { instances: created } }, { status: 201 });
  }

  if (subresource === 'instances') {
    const instanceId = segments[3];
    const instanceAction = segments[4];
    if (!instanceId) {
      if (ctx.request.method === 'GET') {
        return json({ data: { instances: await listQuestionnaireInstances(ctx.env, tenantId, id) } });
      }
      return methodNotAllowed(['GET']);
    }

    const detail = await getQuestionnaireDetail(ctx.env, tenantId, id);
    const row = await getQuestionnaireInstanceRow(ctx.env, tenantId, id, instanceId);
    if (!row) {
      return json({ error: 'not_found', message: 'Questionnaire response instance not found.' }, { status: 404 });
    }

    if (!instanceAction) {
      if (ctx.request.method === 'GET') {
        return json({ data: attachQuestionnaireRuntime(toQuestionnaireInstance(row, detail.template.name), detail.template.questions, detail.ruleSet.rules) });
      }
      if (ctx.request.method === 'DELETE') {
        await ctx.env.D1_MAIN.prepare(`DELETE FROM questionnaire_response_properties WHERE tenant_id = ? AND questionnaire_instance_id = ?`)
          .bind(tenantId, instanceId)
          .run();
        await ctx.env.D1_MAIN.prepare(`DELETE FROM questionnaire_history_entries WHERE tenant_id = ? AND questionnaire_instance_id = ?`)
          .bind(tenantId, instanceId)
          .run();
        await ctx.env.D1_MAIN.prepare(`DELETE FROM questionnaire_instances WHERE tenant_id = ? AND questionnaire_template_id = ? AND id = ?`)
          .bind(tenantId, id, instanceId)
          .run();
        return json({ data: { deleted: true } });
      }
      return methodNotAllowed(['GET', 'DELETE']);
    }

    if (instanceAction === 'responses' && ctx.request.method === 'PUT') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }
      if (!['Open', 'RequestChanges'].includes(row.status)) {
        return json({ error: 'locked_response', message: 'Submitted or accepted questionnaire responses are locked.' }, { status: 409 });
      }
      const body = await readJson<ResponseUpdateInput>(ctx.request);
      const mergedAnswers = { ...asJson<Record<string, unknown>>(row.answers_json, {}), ...asRecord(body.answers) };
      const responseRuntime = evaluateQuestionnaireRuntime(detail.template.questions, detail.ruleSet.rules, mergedAnswers);
      const answers = responseRuntime.answers;
      const uploads = { ...asJson<Record<string, unknown>>(row.uploads_json, {}), ...asRecord(body.uploads) };
      const headerValues = { ...asJson<Record<string, unknown>>(row.header_values_json, {}), ...asRecord(body.headerValues) };
      const collaboration = asJson<QuestionnaireInstance['collaboration']>(row.collaboration_json, []);
      if (body.comment?.trim()) {
        collaboration.push({
          id: crypto.randomUUID(),
          authorUserId: userIdOrResponse,
          action: 'save',
          message: body.comment.trim(),
          createdAt: nowIso(),
        });
      }
      await ctx.env.D1_MAIN.prepare(
        `UPDATE questionnaire_instances
            SET answers_json = ?, uploads_json = ?, header_values_json = ?, collaboration_json = ?,
                score = ?, max_score = ?, grade = ?, percent_complete = ?, passing_status = ?,
                updated_by_user_id = ?, updated_at = ?
          WHERE tenant_id = ? AND questionnaire_template_id = ? AND id = ?`,
      )
        .bind(
          JSON.stringify(answers),
          JSON.stringify(uploads),
          JSON.stringify(headerValues),
          JSON.stringify(collaboration),
          responseRuntime.score,
          responseRuntime.maxScore,
          responseRuntime.grade,
          responseRuntime.percentComplete,
          responseRuntime.passingStatus,
          userIdOrResponse,
          nowIso(),
          tenantId,
          id,
          instanceId,
        )
        .run();
      await upsertQuestionnaireProperties({
        env: ctx.env,
        tenantId,
        templateId: id,
        instanceId,
        questions: detail.template.questions,
        answers,
      });
      const updated = await getQuestionnaireInstanceRow(ctx.env, tenantId, id, instanceId);
      return updated
        ? json({ data: attachQuestionnaireRuntime(toQuestionnaireInstance(updated, detail.template.name), detail.template.questions, detail.ruleSet.rules) })
        : json({ error: 'not_found' }, { status: 404 });
    }

    if (['submit', 'accept', 'reject', 'reopen', 'close', 'feedback'].includes(instanceAction) && ctx.request.method === 'POST') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }
      const body = await readJson<ReviewInput>(ctx.request);
      const status =
        instanceAction === 'submit'
          ? 'Submitted'
          : instanceAction === 'accept'
            ? 'Accepted'
            : instanceAction === 'reject'
              ? 'RequestChanges'
              : instanceAction === 'reopen'
                ? 'Open'
                : instanceAction === 'close'
                  ? 'Closed'
                  : body.sendEmail
                    ? 'RequestChanges'
                    : row.status;
      if (status === 'Submitted') {
        const submitRuntime = evaluateQuestionnaireRuntime(detail.template.questions, detail.ruleSet.rules, asJson<Record<string, unknown>>(row.answers_json, {}));
        if (submitRuntime.percentComplete < 100 || submitRuntime.validationErrors.length > 0) {
          return json(
            {
              error: 'validation_failed',
              message: 'Questionnaire responses must satisfy required questions and rule validations before submission.',
              validationErrors: submitRuntime.validationErrors,
              percentComplete: submitRuntime.percentComplete,
            },
            { status: 409 },
          );
        }
      }
      await updateQuestionnaireInstanceState({
        env: ctx.env,
        tenantId,
        template: detail.template,
        row,
        status,
        userId: userIdOrResponse,
        feedback: body.feedback,
        collaborationEntry: {
          id: crypto.randomUUID(),
          authorUserId: userIdOrResponse,
          action: instanceAction,
          message: body.reviewerComments?.trim() || `${instanceAction} action recorded.`,
          createdAt: nowIso(),
          emailQueued: Boolean(body.sendEmail),
        },
      });
      const updated = await getQuestionnaireInstanceRow(ctx.env, tenantId, id, instanceId);
      return updated
        ? json({ data: attachQuestionnaireRuntime(toQuestionnaireInstance(updated, detail.template.name), detail.template.questions, detail.ruleSet.rules) })
        : json({ error: 'not_found' }, { status: 404 });
    }

    if (instanceAction === 'export' && ctx.request.method === 'GET') {
      return json({
        data: {
          exportedAt: nowIso(),
          template: detail.template,
          instance: toQuestionnaireInstance(row, detail.template.name),
        },
      });
    }

    return methodNotAllowed(['GET', 'PUT', 'POST', 'DELETE']);
  }

  if (subresource === 'rules') {
    if (ctx.request.method === 'GET') {
      const detail = await getQuestionnaireDetail(ctx.env, tenantId, id);
      return json({ data: detail.ruleSet });
    }

    if (ctx.request.method === 'PUT') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }
      const body = await readJson<UpdateRuleSetInput>(ctx.request);
      const templateRow = await getQuestionnaireTemplateRow(ctx.env, tenantId, id);
      const templateQuestions = asJson<QuestionnaireQuestion[]>(templateRow.questions_json, []);
      const existingRuleSet = await getRuleSetRow(ctx.env, tenantId, id);
      const nextRules = body.rules ?? asJson<QuestionnaireRule[]>(existingRuleSet?.rules_json ?? '[]', []);
      const diagnostics = buildRuleDiagnostics(nextRules, templateQuestions);
      const timestamp = nowIso();

      if (existingRuleSet) {
        await ctx.env.D1_MAIN.prepare(
          `UPDATE questionnaire_rule_sets
              SET name = ?, rules_json = ?, diagnostics_json = ?, updated_by_user_id = ?, updated_at = ?
            WHERE tenant_id = ? AND questionnaire_template_id = ?`,
        )
          .bind(
            body.name?.trim() || existingRuleSet.name,
            JSON.stringify(nextRules),
            JSON.stringify(diagnostics),
            userIdOrResponse,
            timestamp,
            tenantId,
            id,
          )
          .run();
      } else {
        await ctx.env.D1_MAIN.prepare(
          `INSERT INTO questionnaire_rule_sets (
              id, tenant_id, questionnaire_template_id, name, engine_version, rules_json, diagnostics_json,
              created_by_user_id, updated_by_user_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            crypto.randomUUID(),
            tenantId,
            id,
            body.name?.trim() || 'Default rule set',
            '1.0',
            JSON.stringify(nextRules),
            JSON.stringify(diagnostics),
            userIdOrResponse,
            userIdOrResponse,
            timestamp,
            timestamp,
          )
          .run();
      }

      return json({ data: (await getQuestionnaireDetail(ctx.env, tenantId, id)).ruleSet });
    }

    return methodNotAllowed(['GET', 'PUT']);
  }

  if (subresource === 'test-runs') {
    if (ctx.request.method === 'GET') {
      return json({ data: await listRuleTestRuns(ctx.env, tenantId, id) });
    }

    if (ctx.request.method === 'POST') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }

      const body = await readJson<RunRuleTestInput>(ctx.request);
      const detail = await getQuestionnaireDetail(ctx.env, tenantId, id);
      const answers = body.answers ?? {
        RISK_LEVEL: 'High',
        HAS_SOC2: false,
      };
      const evaluation = evaluateRuleSet(detail.ruleSet.rules, answers, detail.template.questions);
      const runId = crypto.randomUUID();
      const timestamp = nowIso();

      await ctx.env.D1_MAIN.prepare(
        `INSERT INTO questionnaire_rule_test_runs (
          id, tenant_id, questionnaire_template_id, questionnaire_rule_set_id, scenario_name,
          input_json, execution_log_json, result_json, status, created_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          runId,
          tenantId,
          id,
          detail.ruleSet.id,
          body.scenarioName?.trim() || 'High risk supplier scenario',
          JSON.stringify(answers),
          JSON.stringify(evaluation.executionLog),
          JSON.stringify({
            matchedRules: evaluation.matchedRules,
            visibleQuestions: evaluation.visibleQuestions,
            hiddenQuestions: evaluation.hiddenQuestions,
            disabledQuestions: evaluation.disabledQuestions,
            requiredQuestions: evaluation.requiredQuestions,
            displayOptions: evaluation.displayOptions,
            validationErrors: evaluation.validationErrors,
            answerUpdates: evaluation.answerUpdates,
            score: evaluation.score,
            maxScore: evaluation.maxScore,
            percentComplete: evaluation.percentComplete,
            passingStatus: evaluation.passingStatus,
            grade: evaluation.grade,
          }),
          'completed',
          userIdOrResponse,
          timestamp,
        )
        .run();

      const runs = await listRuleTestRuns(ctx.env, tenantId, id);
      return json({ data: runs[0] }, { status: 201 });
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (subresource === 'validate') {
    if (ctx.request.method === 'POST') {
      const body = await readJson<ValidateQuestionnaireInput>(ctx.request);
      const templateRow = await getQuestionnaireTemplateRow(ctx.env, tenantId, id);
      const ruleSetRow = await getRuleSetRow(ctx.env, tenantId, id);
      const questions =
        body.questions ?? asJson<QuestionnaireQuestion[]>(templateRow.questions_json, []);
      const rules = body.rules ?? asJson<QuestionnaireRule[]>(ruleSetRow?.rules_json ?? '[]', []);

      return json({
        data: {
          diagnostics: buildRuleDiagnostics(rules, questions),
        },
      });
    }

    return methodNotAllowed(['POST']);
  }

  if (subresource === 'test-preview') {
    if (ctx.request.method === 'POST') {
      const body = await readJson<RunRuleTestInput>(ctx.request);
      const templateRow = await getQuestionnaireTemplateRow(ctx.env, tenantId, id);
      const ruleSetRow = await getRuleSetRow(ctx.env, tenantId, id);
      const questions =
        body.draftQuestions ?? asJson<QuestionnaireQuestion[]>(templateRow.questions_json, []);
      const rules = body.draftRules ?? asJson<QuestionnaireRule[]>(ruleSetRow?.rules_json ?? '[]', []);
      const answers = body.answers ?? {
        RISK_LEVEL: 'High',
        HAS_SOC2: false,
      };

      return json({
        data: buildPreviewTestRun({
          scenarioName: body.scenarioName?.trim() || 'Preview run',
          answers,
          rules,
          questions,
        }),
      });
    }

    return methodNotAllowed(['POST']);
  }

  return json({ error: 'unknown_builder_subresource', subresource }, { status: 404 });
}
