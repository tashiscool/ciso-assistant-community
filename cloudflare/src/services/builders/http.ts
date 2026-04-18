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
};

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
};

type UpdateQuestionnaireInput = {
  name?: string;
  description?: string | null;
  status?: string;
  scoringMode?: string;
  audience?: string | null;
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
  audience: string | null;
  scoringMode: string;
  version: number;
  questionCount: number;
  ruleCount: number;
  updatedAt: string;
};

type QuestionnaireTemplateDetail = {
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

function buildSeedQuestions(): QuestionnaireQuestion[] {
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
    },
    {
      id: crypto.randomUUID(),
      ref: 'HAS_SOC2',
      prompt: 'Does the supplier maintain a current SOC 2 report?',
      type: 'boolean',
      section: 'Assurance',
      required: true,
      weight: 15,
    },
    {
      id: crypto.randomUUID(),
      ref: 'MITIGATION_PLAN',
      prompt: 'Describe the mitigation plan for the identified supplier risk.',
      type: 'text',
      section: 'Follow-up',
      required: false,
      weight: 0,
    },
    {
      id: crypto.randomUUID(),
      ref: 'REVIEWER_COMMENTS',
      prompt: 'Reviewer observations',
      type: 'text',
      section: 'Review',
      required: false,
      weight: 0,
    },
  ];
}

function buildSeedRules(): QuestionnaireRule[] {
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

async function ensureSeedQuestionnaires(
  env: WorkerRequestContext['env'],
  tenantId: string,
  userId: string | null,
): Promise<void> {
  const row = await env.D1_MAIN.prepare(
    `SELECT COUNT(1) AS template_count FROM questionnaire_templates WHERE tenant_id = ?`,
  )
    .bind(tenantId)
    .first<{ template_count: number | null }>();

  if (Number(row?.template_count ?? 0) > 0) {
    return;
  }

  const createdAt = nowIso();
  const templateId = crypto.randomUUID();
  const ruleSetId = crypto.randomUUID();
  const questions = buildSeedQuestions();
  const rules = buildSeedRules();
  const diagnostics = buildRuleDiagnostics(rules, questions);

  await env.D1_MAIN.batch([
    env.D1_MAIN.prepare(
      `INSERT INTO questionnaire_templates (
        id, tenant_id, name, description, status, scoring_mode, audience, version,
        questions_json, metadata_json, created_by_user_id, updated_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      templateId,
      tenantId,
      'Third-Party Security Review',
      'Canonical questionnaire template for supplier diligence, exception triage, and control follow-up.',
      'active',
      'weighted',
      'Third-party reviewers',
      1,
      JSON.stringify(questions),
      JSON.stringify({ ownerTeam: 'Vendor Risk', source: 'regovise-canonical-seed' }),
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
      'Default rule set',
      '1.0',
      JSON.stringify(rules),
      JSON.stringify(diagnostics),
      userId,
      userId,
      createdAt,
      createdAt,
    ),
  ]);
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

  return rows.results.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    audience: row.audience,
    scoringMode: row.scoring_mode,
    version: row.version,
    questionCount: asJson<QuestionnaireQuestion[]>(row.questions_json, []).length,
    ruleCount: asJson<QuestionnaireRule[]>(row.rules_json, []).length,
    updatedAt: row.updated_at,
  }));
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
      scoringMode: templateRow.scoring_mode,
      audience: templateRow.audience,
      version: templateRow.version,
      questions,
      metadata: asJson<Record<string, unknown> | null>(templateRow.metadata_json, null),
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
      const questions = buildSeedQuestions();
      const rules = buildSeedRules();
      const diagnostics = buildRuleDiagnostics(rules, questions);

      await ctx.env.D1_MAIN.batch([
        ctx.env.D1_MAIN.prepare(
          `INSERT INTO questionnaire_templates (
             id, tenant_id, name, description, status, scoring_mode, audience, version,
             questions_json, metadata_json, created_by_user_id, updated_by_user_id, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          questionnaireId,
          tenantId,
          body.name?.trim() || 'Untitled Questionnaire',
          body.description?.trim() || null,
          'draft',
          'weighted',
          body.audience?.trim() || 'Internal reviewers',
          1,
          JSON.stringify(questions),
          JSON.stringify({ ownerTeam: 'Questionnaire Ops', source: 'user-created' }),
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
          'Default rule set',
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

      await ctx.env.D1_MAIN.prepare(
        `UPDATE questionnaire_templates
            SET name = ?, description = ?, status = ?, scoring_mode = ?, audience = ?, questions_json = ?,
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
