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
  type: 'single-select' | 'multi-select' | 'text' | 'number' | 'boolean';
  section: string;
  required: boolean;
  weight: number;
  options?: string[];
  helpText?: string | null;
  requirementRef?: string | null;
  evidenceHint?: string | null;
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
  questions?: QuestionnaireQuestion[];
};

type UpdateRuleSetInput = {
  name?: string;
  rules?: QuestionnaireRule[];
};

type RunRuleTestInput = {
  scenarioName?: string;
  answers?: Record<string, string | number | boolean | string[]>;
  draftRules?: QuestionnaireRule[];
  draftQuestions?: QuestionnaireQuestion[];
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
  mappedRequirementCount: number;
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
    score: number;
    grade: string;
  };
  createdByUserId: string | null;
  createdAt: string;
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

function parseQuestionRefFromExpression(expression: string): string | null {
  const match = expression.match(/"([^"]+)"/);
  return match?.[1] ?? null;
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

    for (const action of rule.actions) {
      if (!action.includes('SHOW_QUESTIONS') && !action.includes('ENABLE_QUESTIONS')) {
        continue;
      }
      const ref = parseQuestionRefFromExpression(action);
      if (ref && !knownQuestionRefs.has(ref)) {
        diagnostics.push({
          id: `${rule.id}-${ref}`,
          severity: 'warning',
          message: `Rule "${rule.name || 'Untitled'}" references unknown question ref "${ref}".`,
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
  answers: Record<string, string | number | boolean | string[]>,
): boolean {
  if (condition === 'NO_CONDITION') {
    return true;
  }
  const match = condition.match(/^Question "([^"]+)" equals "([^"]+)"$/);
  if (!match) {
    return false;
  }

  const [, ref, expected] = match;
  const actual = answers[ref];
  if (Array.isArray(actual)) {
    return actual.includes(expected);
  }
  return String(actual ?? '') === expected;
}

function evaluateRuleSet(
  rules: QuestionnaireRule[],
  answers: Record<string, string | number | boolean | string[]>,
): RuleTestRun['result'] & { executionLog: string[] } {
  const executionLog: string[] = [];
  const matchedRules: string[] = [];
  const visibleQuestions = new Set<string>();

  for (const rule of rules) {
    if (!rule.active) {
      executionLog.push(`Rule "${rule.name}" skipped because it is inactive`);
      continue;
    }

    const evaluations = rule.conditions.map((condition) => evaluateCondition(condition, answers));
    const matched = rule.logic === 'AND' ? evaluations.every(Boolean) : evaluations.some(Boolean);
    executionLog.push(`Rule "${rule.name}" ${matched ? 'EXECUTED' : 'SKIPPED'}`);

    if (!matched) {
      continue;
    }

    matchedRules.push(rule.name);
    for (const action of rule.actions) {
      executionLog.push(`Action ${action} fired`);
      const ref = parseQuestionRefFromExpression(action);
      if (ref && (action.includes('SHOW_QUESTIONS') || action.includes('ENABLE_QUESTIONS'))) {
        visibleQuestions.add(ref);
      }
    }
  }

  const score = Math.max(35, Math.min(100, 60 + matchedRules.length * 12));
  const grade = score >= 85 ? 'Pass' : score >= 70 ? 'Needs Review' : 'Fail';

  executionLog.push(`Final score: ${score}`);
  executionLog.push(`Final grade: "${grade}"`);

  return {
    matchedRules,
    visibleQuestions: Array.from(visibleQuestions),
    score,
    grade,
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
       rules.rules_json
     FROM questionnaire_templates template
     LEFT JOIN questionnaire_rule_sets rules
       ON rules.questionnaire_template_id = template.id
      AND rules.tenant_id = template.tenant_id
     WHERE template.tenant_id = ?
     ORDER BY template.updated_at DESC`,
  )
    .bind(tenantId)
    .all<QuestionnaireTemplateRow & { rules_json: string | null }>();

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
      mappedRequirementCount: summary.mappedRequirementCount,
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
      score: 0,
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
  answers: Record<string, string | number | boolean | string[]>;
  rules: QuestionnaireRule[];
}): RuleTestRun {
  const evaluation = evaluateRuleSet(args.rules, args.answers);
  return {
    id: `preview-${crypto.randomUUID()}`,
    scenarioName: args.scenarioName,
    status: 'preview',
    input: args.answers,
    executionLog: evaluation.executionLog,
    result: {
      matchedRules: evaluation.matchedRules,
      visibleQuestions: evaluation.visibleQuestions,
      score: evaluation.score,
      grade: evaluation.grade,
    },
    createdByUserId: null,
    createdAt: nowIso(),
  };
}

export async function handleBuilderRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
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

    return methodNotAllowed(['GET', 'PUT']);
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
      const evaluation = evaluateRuleSet(detail.ruleSet.rules, answers);
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
            score: evaluation.score,
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
        }),
      });
    }

    return methodNotAllowed(['POST']);
  }

  return json({ error: 'unknown_builder_subresource', subresource }, { status: 404 });
}
