import type { WorkerRequestContext } from '../../router';
import { generateJsonWithAi, getAiRuntimeStatus } from './runtime';
import { buildRegmlAttemptPrompts, buildRegmlPlanPrompts } from './promptPacks';
import { buildTenantAiContext } from './tenantContext';
import { json, methodNotAllowed, readJson } from '../../utils/http';

type RegmlWorkspaceMode = 'SSP Author' | 'Auditor' | 'AI Generator';
type RegmlPromptMode = 'Build' | 'Plan';
type RegmlAttemptStatus = 'Draft' | 'Applied' | 'Needs Review';
type RegmlMessageType = 'text' | 'warning' | 'plan' | 'version';
type RegmlFeatureAvailability = 'Ready' | 'Pending Terms' | 'Locked';
type RegmlDeploymentMode = 'SaaS' | 'Local';

type UpdateRegmlSettingsInput = {
  enabled?: boolean;
  termsAccepted?: boolean;
  deploymentMode?: RegmlDeploymentMode;
};

type RunRegmlPromptInput = {
  prompt?: string;
  promptMode?: RegmlPromptMode;
  sourceSet?: string;
};

type RegmlSettingsRow = {
  tenant_id: string;
  enabled: number;
  terms_accepted: number;
  deployment_mode: RegmlDeploymentMode;
  backend_available: number;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type RegmlSessionRow = {
  id: string;
  tenant_id: string;
  mode: RegmlWorkspaceMode;
  prompt: string;
  prompt_mode: RegmlPromptMode;
  source_set: string;
  credits_quota: number;
  credits_remaining: number;
  low_credit_banner_dismissed: number;
  selected_attempt_id: string | null;
  streaming: number;
  queue_depth: number;
  last_heartbeat: string;
  created_at: string;
  updated_at: string;
};

type RegmlAttemptRow = {
  id: string;
  tenant_id: string;
  session_id: string;
  mode: RegmlWorkspaceMode;
  version_label: string;
  title: string;
  summary_json: string;
  before_items_json: string;
  after_items_json: string;
  status: RegmlAttemptStatus;
  coverage: number;
  confidence: number;
  nodes_changed: number;
  credits_cost: number;
  issues: number;
  created_at: string;
  applied_at: string | null;
};

type RegmlMessageRow = {
  id: string;
  tenant_id: string;
  session_id: string;
  mode: RegmlWorkspaceMode;
  role: 'user' | 'assistant';
  message_type: RegmlMessageType;
  content_json: string;
  created_at: string;
};

type RegmlPlanDraft = {
  steps?: string[];
  reviewer_note?: string;
};

type RegmlAttemptDraft = {
  summary?: string[];
  before_items?: string[];
  after_items?: string[];
  note?: string;
  warning?: string | null;
};

const regmlWorkspaceModes: RegmlWorkspaceMode[] = ['SSP Author', 'Auditor', 'AI Generator'];

const regmlSourceSetOptions: Record<RegmlWorkspaceMode, string[]> = {
  'SSP Author': [
    'Policies + questionnaires + SSP files',
    'Policies + system diagrams',
    'Questionnaires + uploaded evidence',
  ],
  Auditor: [
    'Control implementations + evidence',
    'Control implementations + assessments',
    'Assessments + issue history',
  ],
  'AI Generator': [
    'Onboarding questionnaire + selected catalog',
    'Assessment questionnaire + imported controls',
    'Component questionnaire + inherited controls',
  ],
};

const regmlModeFocus: Record<RegmlWorkspaceMode, string[]> = {
  'SSP Author': ['Control implementation drafting', 'Source-backed language', 'Gap review before publish'],
  Auditor: ['Completeness checks', 'Quality scoring', 'Issue generation readiness'],
  'AI Generator': ['Questionnaire-driven narratives', 'Inherited responsibility language', 'Version comparison'],
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

function getDefaultSourceSet(mode: RegmlWorkspaceMode) {
  return regmlSourceSetOptions[mode][0];
}

function getCreditCost(mode: RegmlWorkspaceMode, promptMode: RegmlPromptMode) {
  if (promptMode === 'Plan') {
    return 1;
  }

  if (mode === 'SSP Author') {
    return 2;
  }

  if (mode === 'Auditor') {
    return 5;
  }

  return 4;
}

function truncatePrompt(prompt: string, limit = 56) {
  return prompt.length > limit ? `${prompt.slice(0, limit - 1)}…` : prompt;
}

function getStatusLabel(settings: RegmlSettingsRow) {
  if (!settings.enabled) {
    return 'Not Enabled';
  }

  if (!settings.terms_accepted) {
    return 'Pending Terms Acceptance';
  }

  return settings.deployment_mode === 'Local' ? 'Enabled for Local Deployment' : 'Enabled for SaaS';
}

function toBooleanFlag(value: number) {
  return value === 1;
}
async function ensureRegmlSettings(
  env: WorkerRequestContext['env'],
  tenantId: string,
  userId: string | null,
) {
  let row = await env.D1_MAIN.prepare(
    `
    SELECT tenant_id, enabled, terms_accepted, deployment_mode, backend_available, updated_by_user_id, created_at, updated_at
    FROM regml_settings
    WHERE tenant_id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<RegmlSettingsRow>();

  if (!row) {
    const timestamp = nowIso();
    await env.D1_MAIN.prepare(
      `
      INSERT INTO regml_settings (
        tenant_id,
        enabled,
        terms_accepted,
        deployment_mode,
        backend_available,
        updated_by_user_id,
        created_at,
        updated_at
      ) VALUES (?, 1, 0, 'SaaS', ?, ?, ?, ?)
      `,
    )
      .bind(tenantId, env.AI ? 1 : 0, userId, timestamp, timestamp)
      .run();

    row = (await env.D1_MAIN.prepare(
      `
      SELECT tenant_id, enabled, terms_accepted, deployment_mode, backend_available, updated_by_user_id, created_at, updated_at
      FROM regml_settings
      WHERE tenant_id = ?
      LIMIT 1
      `,
    )
      .bind(tenantId)
      .first<RegmlSettingsRow>()) as RegmlSettingsRow;
  }

  return row;
}

async function insertMessage(
  env: WorkerRequestContext['env'],
  tenantId: string,
  sessionId: string,
  mode: RegmlWorkspaceMode,
  role: 'user' | 'assistant',
  messageType: RegmlMessageType,
  content: Record<string, unknown>,
  createdAt = nowIso(),
) {
  await env.D1_MAIN.prepare(
    `
    INSERT INTO regml_messages (
      id,
      tenant_id,
      session_id,
      mode,
      role,
      message_type,
      content_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      crypto.randomUUID(),
      tenantId,
      sessionId,
      mode,
      role,
      messageType,
      JSON.stringify(content),
      createdAt,
    )
    .run();
}

async function ensureRegmlSessions(env: WorkerRequestContext['env'], tenantId: string) {
  for (const mode of regmlWorkspaceModes) {
    const existing = await env.D1_MAIN.prepare(
      `
      SELECT id
      FROM regml_sessions
      WHERE tenant_id = ? AND mode = ?
      LIMIT 1
      `,
    )
      .bind(tenantId, mode)
      .first<{ id: string }>();

    if (existing) {
      continue;
    }

    const sessionId = crypto.randomUUID();
    const timestamp = nowIso();

    await env.D1_MAIN.prepare(
      `
      INSERT INTO regml_sessions (
        id,
        tenant_id,
        mode,
        prompt,
        prompt_mode,
        source_set,
        credits_quota,
        credits_remaining,
        low_credit_banner_dismissed,
        selected_attempt_id,
        streaming,
        queue_depth,
        last_heartbeat,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, '', 'Build', ?, 120, 120, 0, NULL, 0, 0, ?, ?, ?)
      `,
    )
      .bind(sessionId, tenantId, mode, getDefaultSourceSet(mode), timestamp, timestamp, timestamp)
      .run();

    await insertMessage(env, tenantId, sessionId, mode, 'assistant', 'text', {
      content:
        mode === 'SSP Author'
          ? 'RegML SSP Author is ready. Select source context, draft a plan or build run, and review generated statements before applying them.'
          : mode === 'Auditor'
            ? 'RegML Auditor is ready. Run a planning pass or generate audit guidance across the current security-plan context.'
            : 'RegML AI Generator is ready. Use questionnaire context and inherited controls to produce a reusable first draft.',
    }, timestamp);
  }
}

function buildRegmlPromptPlan(mode: RegmlWorkspaceMode, prompt: string) {
  const promptLabel = truncatePrompt(prompt);

  if (mode === 'SSP Author') {
    return {
      title: `Plan draft for "${promptLabel}"`,
      steps: [
        'Validate the selected source set and narrow retrieval to the most relevant policies, questionnaires, and SSP files.',
        'Group targeted controls by family, then extract organization-specific evidence snippets for each control and part.',
        'Generate draft implementation statements, highlight low-confidence controls, and stop for human review before publish.',
      ],
    };
  }

  if (mode === 'Auditor') {
    return {
      title: `Audit plan for "${promptLabel}"`,
      steps: [
        'Scan control implementations for completeness, role ownership, evidence attachment, and assessment history.',
        'Run AI quality evaluation against each implementation statement and identify controls below the configured confidence threshold.',
        'Prepare issue generation, publishable history, and assessment-export steps after the review threshold is confirmed.',
      ],
    };
  }

  return {
    title: `Generation plan for "${promptLabel}"`,
    steps: [
      'Load questionnaire context and map it to the selected catalog and control inventory.',
      'Generate owner narratives first, then produce cloud and inherited-responsibility language for shared-service controls.',
      'Open a version review pass so owners can compare the draft against the current SSP before publish.',
    ],
  };
}

function extractBulletLines(text: string | null, fallback: string[]) {
  if (!text) {
    return fallback;
  }

  const lines = text
    .split('\n')
    .map((line) => line.replace(/^\s*[-*0-9.)]+\s*/, '').trim())
    .filter((line) => {
      if (!line) {
        return false;
      }

      return !/^(here are|summary:|before:|after:|bullets?:)/i.test(line);
    });

  if (lines.length >= 3) {
    return lines.slice(0, 3);
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return sentences.length >= 3 ? sentences.slice(0, 3) : fallback;
}

async function buildRegmlPromptPlanWithAi(
  env: WorkerRequestContext['env'],
  mode: RegmlWorkspaceMode,
  prompt: string,
  workspaceContext: Awaited<ReturnType<typeof buildTenantAiContext>>,
  issueThreshold: number | null,
) {
  const fallbackPlan = buildRegmlPromptPlan(mode, prompt);
  const prompts = buildRegmlPlanPrompts({
    mode,
    prompt,
    context: workspaceContext,
    issueThreshold,
  });
  const generated = await generateJsonWithAi<RegmlPlanDraft>(env, {
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    maxTokens: 360,
    temperature: 0.1,
  });

  return {
    title: fallbackPlan.title,
    steps:
      Array.isArray(generated?.steps) && generated.steps.length >= 3
        ? generated.steps.map((step) => String(step).trim()).filter(Boolean).slice(0, 3)
        : fallbackPlan.steps,
  };
}

function buildRegmlAttemptFromPrompt(
  mode: RegmlWorkspaceMode,
  prompt: string,
  attemptIndex: number,
  creditsCost: number,
) {
  const signal = prompt.replace(/\s+/g, '').length % 9;
  const promptLabel = truncatePrompt(prompt, 58);

  if (mode === 'SSP Author') {
    return {
      versionLabel: `V${attemptIndex + 3}`,
      title: `Draft statements for "${promptLabel}"`,
      summary: [
        `Matched current evidence against the requested SSP scope and drafted language for ${12 + signal} controls.`,
        'Split owner and cloud responsibilities where inheritance or shared services were implied by the prompt.',
        `Flagged ${Math.max(2, 5 - (signal % 3))} controls where the context was too broad for direct publish.`,
      ],
      beforeItems: [
        'Prior SSP content was either missing, generic, or not clearly tied to the current environment.',
        'Several controls depended on policy language without enough operational detail to satisfy assessor review.',
        'Cloud responsibility boundaries were ambiguous across inherited services.',
      ],
      afterItems: [
        'New drafts reference organization-specific ownership, evidence sources, and review cadence.',
        'Controls with weak retrieval matches remain clearly marked for manual validation before publish.',
        'Cloud and customer responsibilities are separated more explicitly where applicable.',
      ],
      status: 'Needs Review' as RegmlAttemptStatus,
      coverage: 78 + signal,
      confidence: 84 + (signal % 5),
      nodesChanged: 4 + (signal % 3),
      creditsCost,
      issues: Math.max(2, 5 - (signal % 3)),
      note:
        'I generated a new SSP-author draft and packaged the changes as a version card so you can review them before applying to the plan.',
      warning:
        prompt.length < 70
          ? 'Short prompts tend to produce broader drafts. Add system details, implementation boundaries, or evidence hints for a tighter result.'
          : null,
    };
  }

  if (mode === 'Auditor') {
    return {
      versionLabel: `Audit ${attemptIndex + 1}`,
      title: `Audit findings for "${promptLabel}"`,
      summary: [
        `Evaluated ${18 + signal} control statements across completeness and quality checks.`,
        `Found ${3 + (signal % 4)} controls under the issue threshold and grouped them for follow-up.`,
        'Prepared a publish-ready issue package with recommended next actions.',
      ],
      beforeItems: [
        'Completeness and quality issues were only visible through manual review.',
        'Evidence coverage and role ownership were inconsistent across control families.',
        'Assessment follow-up depended on manual score interpretation.',
      ],
      afterItems: [
        'Audit output grades low-confidence controls and identifies follow-up focus areas.',
        'Control families with weak evidence posture are grouped for easier remediation planning.',
        'Issue-generation guidance is ready for the next assessment pass.',
      ],
      status: 'Needs Review' as RegmlAttemptStatus,
      coverage: 81 + signal,
      confidence: 82 + (signal % 7),
      nodesChanged: 3 + (signal % 4),
      creditsCost,
      issues: 3 + (signal % 4),
      note:
        'I ran the Auditor pass and produced a review package you can use before publishing results or generating issues.',
      warning: null,
    };
  }

  return {
    versionLabel: `Generator ${attemptIndex + 1}`,
    title: `Generated narrative for "${promptLabel}"`,
    summary: [
      `Produced first-pass language for ${10 + signal} controls using questionnaire and inheritance context.`,
      'Separated inherited responsibilities from tenant-owned statements where the prompt implied shared-service operation.',
      'Prepared a version review package so owners can compare generated output against the current plan.',
    ],
    beforeItems: [
      'Control statements depended on questionnaire interpretation without a shared narrative baseline.',
      'Inherited responsibilities were blended into tenant-owned language.',
      'Repeated authoring work increased drift between questionnaires and the current plan.',
    ],
    afterItems: [
      'Generated narratives now align questionnaire context with catalog expectations.',
      'Inherited and tenant-owned responsibilities are called out separately.',
      'Version comparison is ready before committing updates to the plan.',
    ],
    status: 'Needs Review' as RegmlAttemptStatus,
    coverage: 76 + signal,
    confidence: 80 + (signal % 6),
    nodesChanged: 5 + (signal % 3),
    creditsCost,
    issues: 1 + (signal % 3),
    note:
      'I generated a first-pass narrative package using the selected questionnaire context and captured the result as a reviewable version.',
    warning: null,
  };
}

async function buildRegmlAttemptFromPromptWithAi(
  env: WorkerRequestContext['env'],
  mode: RegmlWorkspaceMode,
  prompt: string,
  attemptIndex: number,
  creditsCost: number,
  workspaceContext: Awaited<ReturnType<typeof buildTenantAiContext>>,
  issueThreshold: number | null,
) {
  const fallbackAttempt = buildRegmlAttemptFromPrompt(mode, prompt, attemptIndex, creditsCost);
  const prompts = buildRegmlAttemptPrompts({
    mode,
    prompt,
    context: workspaceContext,
    issueThreshold,
    creditsCost,
  });
  const generated = await generateJsonWithAi<RegmlAttemptDraft>(env, {
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    maxTokens: 520,
    temperature: 0.15,
  });

  return {
    ...fallbackAttempt,
    summary:
      Array.isArray(generated?.summary) && generated.summary.length >= 3
        ? generated.summary.map((item) => String(item).trim()).filter(Boolean).slice(0, 3)
        : fallbackAttempt.summary,
    beforeItems:
      Array.isArray(generated?.before_items) && generated.before_items.length >= 3
        ? generated.before_items.map((item) => String(item).trim()).filter(Boolean).slice(0, 3)
        : fallbackAttempt.beforeItems,
    afterItems:
      Array.isArray(generated?.after_items) && generated.after_items.length >= 3
        ? generated.after_items.map((item) => String(item).trim()).filter(Boolean).slice(0, 3)
        : fallbackAttempt.afterItems,
    note: generated?.note?.trim() || fallbackAttempt.note,
    warning:
      typeof generated?.warning === 'string'
        ? generated.warning.trim() || null
        : fallbackAttempt.warning,
  };
}

async function getSessionRow(
  env: WorkerRequestContext['env'],
  tenantId: string,
  mode: RegmlWorkspaceMode,
) {
  return env.D1_MAIN.prepare(
    `
    SELECT id, tenant_id, mode, prompt, prompt_mode, source_set, credits_quota, credits_remaining,
           low_credit_banner_dismissed, selected_attempt_id, streaming, queue_depth, last_heartbeat,
           created_at, updated_at
    FROM regml_sessions
    WHERE tenant_id = ? AND mode = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, mode)
    .first<RegmlSessionRow>();
}

async function listAttemptRows(
  env: WorkerRequestContext['env'],
  tenantId: string,
  mode: RegmlWorkspaceMode,
) {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT id, tenant_id, session_id, mode, version_label, title, summary_json, before_items_json,
           after_items_json, status, coverage, confidence, nodes_changed, credits_cost, issues,
           created_at, applied_at
    FROM regml_attempts
    WHERE tenant_id = ? AND mode = ?
    ORDER BY created_at DESC
    `,
  )
    .bind(tenantId, mode)
    .all<RegmlAttemptRow>();

  return rows.results;
}

async function listMessageRows(
  env: WorkerRequestContext['env'],
  tenantId: string,
  mode: RegmlWorkspaceMode,
) {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT id, tenant_id, session_id, mode, role, message_type, content_json, created_at
    FROM regml_messages
    WHERE tenant_id = ? AND mode = ?
    ORDER BY created_at ASC
    `,
  )
    .bind(tenantId, mode)
    .all<RegmlMessageRow>();

  return rows.results;
}

function toMessage(row: RegmlMessageRow) {
  const payload = asJson<Record<string, unknown>>(row.content_json, {});

  if (row.message_type === 'plan') {
    return {
      id: row.id,
      type: 'plan' as const,
      role: 'assistant' as const,
      title: String(payload.title ?? 'Plan'),
      steps: Array.isArray(payload.steps) ? payload.steps.map((item) => String(item)) : [],
      createdAt: row.created_at,
    };
  }

  if (row.message_type === 'warning') {
    return {
      id: row.id,
      type: 'warning' as const,
      role: 'assistant' as const,
      title: String(payload.title ?? 'Review needed'),
      content: String(payload.content ?? ''),
      createdAt: row.created_at,
    };
  }

  if (row.message_type === 'version') {
    return {
      id: row.id,
      type: 'version' as const,
      role: 'assistant' as const,
      attemptId: String(payload.attemptId ?? ''),
      createdAt: row.created_at,
    };
  }

  return {
    id: row.id,
    type: 'text' as const,
    role: row.role,
    content: String(payload.content ?? ''),
    createdAt: row.created_at,
  };
}

function toAttempt(row: RegmlAttemptRow) {
  return {
    id: row.id,
    mode: row.mode,
    versionLabel: row.version_label,
    title: row.title,
    summary: asJson<string[]>(row.summary_json, []),
    beforeItems: asJson<string[]>(row.before_items_json, []),
    afterItems: asJson<string[]>(row.after_items_json, []),
    status: row.status,
    coverage: row.coverage,
    confidence: row.confidence,
    nodesChanged: row.nodes_changed,
    creditsCost: row.credits_cost,
    issues: row.issues,
    createdAt: row.created_at,
  };
}

async function buildSession(
  env: WorkerRequestContext['env'],
  tenantId: string,
  mode: RegmlWorkspaceMode,
  workspaceContext: Awaited<ReturnType<typeof buildTenantAiContext>>,
) {
  const [sessionRow, attemptRows, messageRows] = await Promise.all([
    getSessionRow(env, tenantId, mode),
    listAttemptRows(env, tenantId, mode),
    listMessageRows(env, tenantId, mode),
  ]);

  if (!sessionRow) {
    return null;
  }

  const sourceCoverage = [
    `Policies (${workspaceContext.metrics.policies})`,
    `Questionnaires (${workspaceContext.metrics.questionnaires})`,
    `Security Plans (${workspaceContext.metrics.securityPlans})`,
    `Evidence (${workspaceContext.metrics.evidenceArtifacts})`,
  ];

  if (mode !== 'SSP Author') {
    sourceCoverage.push(`Controls (${workspaceContext.metrics.controls})`);
  }

  if (mode === 'AI Generator') {
    sourceCoverage.push(`Components (${workspaceContext.metrics.components})`);
  }

  return {
    mode,
    creditsQuota: sessionRow.credits_quota,
    creditsRemaining: sessionRow.credits_remaining,
    prompt: sessionRow.prompt,
    promptMode: sessionRow.prompt_mode,
    sourceSet: sessionRow.source_set,
    sourceOptions: regmlSourceSetOptions[mode],
    lowCreditBannerDismissed: toBooleanFlag(sessionRow.low_credit_banner_dismissed),
    selectedAttemptId: sessionRow.selected_attempt_id,
    streaming: toBooleanFlag(sessionRow.streaming),
    queueDepth: sessionRow.queue_depth,
    lastHeartbeat: sessionRow.last_heartbeat,
    messages: messageRows.map(toMessage),
    attempts: attemptRows.map(toAttempt),
    context: {
      organizationName: workspaceContext.organizationName,
      workspaceLabel: mode,
      primaryFramework: workspaceContext.primaryFramework,
      issueThreshold: mode === 'Auditor' && workspaceContext.metrics.securityPlans > 0 ? 72 : null,
      sourceCoverage,
      modeFocus: regmlModeFocus[mode],
    },
  };
}

function buildFeatureCards(settings: RegmlSettingsRow) {
  const availability: RegmlFeatureAvailability = !settings.enabled
    ? 'Locked'
    : settings.terms_accepted
      ? 'Ready'
      : 'Pending Terms';

  return [
    {
      id: 'author',
      name: 'RegML Author',
      description: 'Draft first-pass control implementation statements and improvement suggestions.',
      availability,
      supportedContext: 'Control implementation records',
      route: '/features/regml/author',
      contextual: true,
    },
    {
      id: 'explainer',
      name: 'RegML Explainer',
      description: 'Rewrite dense control language into plain-English guidance for reviewers and owners.',
      availability,
      supportedContext: 'Control and catalog records',
      route: '/features/regml/explainer',
      contextual: true,
    },
    {
      id: 'ssp-author',
      name: 'RegML SSP Author',
      description: 'Bulk-author control implementation statements from policies, questionnaires, and files.',
      availability,
      supportedContext: 'Security Plans',
      route: '/features/regml/ssp-author',
      contextual: false,
    },
    {
      id: 'auditor',
      name: 'RegML Auditor',
      description: 'Run completeness and AI-quality audits against plan-wide control implementations.',
      availability,
      supportedContext: 'Security Plans',
      route: '/features/regml/auditor',
      contextual: false,
    },
    {
      id: 'ai-generator',
      name: 'AI Generator',
      description: 'Generate first-pass control narratives from questionnaire and inherited-control context.',
      availability,
      supportedContext: 'Security Plans',
      route: '/features/regml/ai-generator',
      contextual: false,
    },
    {
      id: 'response-automation',
      name: 'Response Automation',
      description: 'Launch grounded response jobs from approved internal content.',
      availability: 'Ready' as RegmlFeatureAvailability,
      supportedContext: 'Questionnaire and DDQ workflows',
      route: '/response-automation',
      contextual: false,
    },
    {
      id: 'evidence-mapping',
      name: 'Evidence Mapping',
      description: 'Map evidence records to plans, controls, and components with recommendation support.',
      availability: 'Ready' as RegmlFeatureAvailability,
      supportedContext: 'Evidence records',
      route: '/evidence-mapping',
      contextual: false,
    },
    {
      id: 'ai-policy-builder',
      name: 'AI Policy Builder',
      description: 'Generate policy requirements from profiles and catalogues inside the canonical stack.',
      availability: 'Ready' as RegmlFeatureAvailability,
      supportedContext: 'Policy workspaces',
      route: '/ai-policy-builder',
      contextual: false,
    },
  ];
}

async function buildRegmlWorkspace(
  env: WorkerRequestContext['env'],
  tenantId: string,
  userId: string | null,
) {
  const settings = await ensureRegmlSettings(env, tenantId, userId);
  await ensureRegmlSessions(env, tenantId);

  const [workspaceContext, runtime] = await Promise.all([
    buildTenantAiContext(env, tenantId),
    getAiRuntimeStatus(env),
  ]);
  const sessions = Object.fromEntries(
    await Promise.all(
      regmlWorkspaceModes.map(async (mode) => [mode, await buildSession(env, tenantId, mode, workspaceContext)]),
    ),
  );

  return {
    settings: {
      enabled: toBooleanFlag(settings.enabled),
      termsAccepted: toBooleanFlag(settings.terms_accepted),
      deploymentMode: settings.deployment_mode,
      backendAvailable: runtime.textGenerationAvailable,
      statusLabel:
        !toBooleanFlag(settings.enabled)
          ? 'Not Enabled'
          : !toBooleanFlag(settings.terms_accepted)
            ? 'Pending Terms Acceptance'
            : runtime.textGenerationAvailable
              ? getStatusLabel(settings)
              : 'Enabled without Workers AI runtime',
      chatbotVisible: toBooleanFlag(settings.enabled) && toBooleanFlag(settings.terms_accepted),
      toolsVisible: toBooleanFlag(settings.enabled) && toBooleanFlag(settings.terms_accepted),
      modulesFeaturesPath: '/setup/modules-features',
      saveInstructions: 'User menu → Setup → Modules and Features → RegML checkbox → Terms and Conditions → Save',
      updatedAt: settings.updated_at,
      runtimeProvider: runtime.provider,
    },
    health: {
      environmentHealthy: runtime.environmentHealthy,
      policiesCount: workspaceContext.metrics.policies,
      questionnairesCount: workspaceContext.metrics.questionnaires,
      securityPlansCount: workspaceContext.metrics.securityPlans,
      evidenceCount: workspaceContext.metrics.evidenceArtifacts,
      controlsCount: workspaceContext.metrics.controls,
      componentsCount: workspaceContext.metrics.components,
      issueThreshold: workspaceContext.metrics.securityPlans > 0 ? 72 : null,
      vectorDatabaseDeployed: runtime.vectorizeAvailable,
    },
    deploymentGuidance: {
      saas: [
        'Contact Customer Success to enable RegML for the tenant if it is not already provisioned.',
        'Complete the in-app enablement flow from Setup → Modules and Features and save the entitlement state.',
        'Once enabled and accepted, RegML tools appear on supported records and the chatbot entry point becomes visible.',
      ],
      local: [
        'Provision the local AI runtime and model-serving stack for the deployment environment.',
        'Enable RegML from Setup → Modules and Features, accept terms, and verify local service connectivity.',
        'Use local deployment when privacy or residency requirements require model execution inside your environment.',
      ],
    },
    features: buildFeatureCards(settings),
    sessions,
  };
}

async function updateRegmlSettings(ctx: WorkerRequestContext, tenantId: string) {
  const userId = requireUser(ctx);
  if (userId instanceof Response) {
    return userId;
  }

  const current = await ensureRegmlSettings(ctx.env, tenantId, userId);
  const body = await readJson<UpdateRegmlSettingsInput>(ctx.request);
  const nextEnabled = body.enabled ?? toBooleanFlag(current.enabled);
  const nextTermsAccepted = body.termsAccepted ?? toBooleanFlag(current.terms_accepted);
  const nextDeploymentMode = body.deploymentMode ?? current.deployment_mode;
  const timestamp = nowIso();

  await ctx.env.D1_MAIN.prepare(
    `
    UPDATE regml_settings
    SET enabled = ?,
        terms_accepted = ?,
        deployment_mode = ?,
        updated_by_user_id = ?,
        updated_at = ?
    WHERE tenant_id = ?
    `,
  )
    .bind(nextEnabled ? 1 : 0, nextTermsAccepted ? 1 : 0, nextDeploymentMode, userId, timestamp, tenantId)
    .run();

  return json({ data: await buildRegmlWorkspace(ctx.env, tenantId, userId) });
}

async function runRegmlPrompt(
  ctx: WorkerRequestContext,
  tenantId: string,
  mode: RegmlWorkspaceMode,
) {
  const userId = requireUser(ctx);
  if (userId instanceof Response) {
    return userId;
  }

  const settings = await ensureRegmlSettings(ctx.env, tenantId, userId);
  if (!toBooleanFlag(settings.enabled)) {
    return json(
      { error: 'regml_disabled', message: 'Enable RegML before launching AI tools.' },
      { status: 409 },
    );
  }

  if (!toBooleanFlag(settings.terms_accepted)) {
    return json(
      { error: 'regml_terms_required', message: 'Accept RegML terms before launching AI tools.' },
      { status: 409 },
    );
  }

  const session = await getSessionRow(ctx.env, tenantId, mode);
  if (!session) {
    return json({ error: 'regml_session_not_found' }, { status: 404 });
  }

  const body = await readJson<RunRegmlPromptInput>(ctx.request);
  const prompt = body.prompt?.trim();
  const promptMode: RegmlPromptMode = body.promptMode === 'Plan' ? 'Plan' : 'Build';
  const sourceSet = regmlSourceSetOptions[mode].includes(body.sourceSet ?? '') ? (body.sourceSet as string) : session.source_set || getDefaultSourceSet(mode);

  if (!prompt) {
    return json({ error: 'invalid_prompt', message: 'A prompt is required to run RegML.' }, { status: 400 });
  }

  const creditsCost = getCreditCost(mode, promptMode);
  if (session.credits_remaining < creditsCost) {
    return json(
      { error: 'regml_credit_limit', message: 'Not enough RegML credits remain for this run.' },
      { status: 409 },
    );
  }

  const timestamp = nowIso();
  await insertMessage(ctx.env, tenantId, session.id, mode, 'user', 'text', { content: prompt }, timestamp);

  let selectedAttemptId: string | null = session.selected_attempt_id;
  const workspaceContext = await buildTenantAiContext(ctx.env, tenantId);
  const issueThreshold = workspaceContext.metrics.securityPlans > 0 ? 72 : null;
  const runtime = await getAiRuntimeStatus(ctx.env);

  if (promptMode === 'Plan') {
    const plan = runtime.textGenerationAvailable
      ? await buildRegmlPromptPlanWithAi(ctx.env, mode, prompt, workspaceContext, issueThreshold)
      : buildRegmlPromptPlan(mode, prompt);
    await insertMessage(ctx.env, tenantId, session.id, mode, 'assistant', 'plan', plan, timestamp);
    await insertMessage(
      ctx.env,
      tenantId,
      session.id,
      mode,
      'assistant',
      'text',
      { content: 'Plan created. Review the step sequence, then run a build when you are ready for a versioned draft.' },
      timestamp,
    );
  } else {
    const existingAttempts = await listAttemptRows(ctx.env, tenantId, mode);
    const nextAttempt = runtime.textGenerationAvailable
      ? await buildRegmlAttemptFromPromptWithAi(
          ctx.env,
          mode,
          prompt,
          existingAttempts.length,
          creditsCost,
          workspaceContext,
          issueThreshold,
        )
      : buildRegmlAttemptFromPrompt(mode, prompt, existingAttempts.length, creditsCost);
    selectedAttemptId = crypto.randomUUID();

    await ctx.env.D1_MAIN.prepare(
      `
      INSERT INTO regml_attempts (
        id,
        tenant_id,
        session_id,
        mode,
        version_label,
        title,
        summary_json,
        before_items_json,
        after_items_json,
        status,
        coverage,
        confidence,
        nodes_changed,
        credits_cost,
        issues,
        created_at,
        applied_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `,
    )
      .bind(
        selectedAttemptId,
        tenantId,
        session.id,
        mode,
        nextAttempt.versionLabel,
        nextAttempt.title,
        JSON.stringify(nextAttempt.summary),
        JSON.stringify(nextAttempt.beforeItems),
        JSON.stringify(nextAttempt.afterItems),
        nextAttempt.status,
        nextAttempt.coverage,
        nextAttempt.confidence,
        nextAttempt.nodesChanged,
        nextAttempt.creditsCost,
        nextAttempt.issues,
        timestamp,
      )
      .run();

    await insertMessage(ctx.env, tenantId, session.id, mode, 'assistant', 'version', { attemptId: selectedAttemptId }, timestamp);
    await insertMessage(ctx.env, tenantId, session.id, mode, 'assistant', 'text', { content: nextAttempt.note }, timestamp);

    if (nextAttempt.warning) {
      await insertMessage(
        ctx.env,
        tenantId,
        session.id,
        mode,
        'assistant',
        'warning',
        {
          title: 'Prompt tuning suggestion',
          content: nextAttempt.warning,
        },
        timestamp,
      );
    }
  }

  await ctx.env.D1_MAIN.prepare(
    `
    UPDATE regml_sessions
    SET prompt = ?,
        prompt_mode = ?,
        source_set = ?,
        credits_remaining = ?,
        selected_attempt_id = ?,
        queue_depth = 0,
        streaming = 0,
        last_heartbeat = ?,
        updated_at = ?
    WHERE id = ?
    `,
  )
    .bind(
      prompt,
      promptMode,
      sourceSet,
      Math.max(0, session.credits_remaining - creditsCost),
      selectedAttemptId,
      timestamp,
      timestamp,
      session.id,
    )
    .run();

  return json({
    data: {
      session: await buildSession(ctx.env, tenantId, mode, workspaceContext),
    },
  });
}

async function applyRegmlAttempt(
  ctx: WorkerRequestContext,
  tenantId: string,
  mode: RegmlWorkspaceMode,
  attemptId: string,
) {
  const userId = requireUser(ctx);
  if (userId instanceof Response) {
    return userId;
  }

  const session = await getSessionRow(ctx.env, tenantId, mode);
  if (!session) {
    return json({ error: 'regml_session_not_found' }, { status: 404 });
  }

  const attempt = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id
    FROM regml_attempts
    WHERE tenant_id = ? AND mode = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, mode, attemptId)
    .first<{ id: string }>();

  if (!attempt) {
    return json({ error: 'regml_attempt_not_found' }, { status: 404 });
  }

  const timestamp = nowIso();
  await ctx.env.D1_MAIN.prepare(
    `
    UPDATE regml_attempts
    SET status = 'Applied',
        applied_at = ?
    WHERE id = ?
    `,
  )
    .bind(timestamp, attemptId)
    .run();

  await ctx.env.D1_MAIN.prepare(
    `
    UPDATE regml_sessions
    SET selected_attempt_id = ?,
        last_heartbeat = ?,
        updated_at = ?
    WHERE id = ?
    `,
  )
    .bind(attemptId, timestamp, timestamp, session.id)
    .run();

  await insertMessage(
    ctx.env,
    tenantId,
    session.id,
    mode,
    'assistant',
    'text',
    {
      content:
        mode === 'Auditor'
          ? 'Audit version applied. The selected review package is now the active RegML result for this workspace.'
          : 'Version applied. The selected RegML output is now the active result for this workspace.',
    },
    timestamp,
  );
  const workspaceContext = await buildTenantAiContext(ctx.env, tenantId);

  return json({
    data: {
      session: await buildSession(ctx.env, tenantId, mode, workspaceContext),
    },
  });
}

function parseMode(input: string | undefined): RegmlWorkspaceMode | null {
  if (!input) {
    return null;
  }

  const decoded = decodeURIComponent(input);
  return regmlWorkspaceModes.includes(decoded as RegmlWorkspaceMode)
    ? (decoded as RegmlWorkspaceMode)
    : null;
}

export async function handleRegmlRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const tenantId = requireTenant(ctx);
  if (tenantId instanceof Response) {
    return tenantId;
  }

  const [resource, modeSegment, subresource, subresourceId, action] = segments;

  if (!resource) {
    if (ctx.request.method === 'GET') {
      return json({ data: await buildRegmlWorkspace(ctx.env, tenantId, ctx.userId) });
    }

    return methodNotAllowed(['GET']);
  }

  if (resource === 'settings') {
    if (ctx.request.method === 'PUT') {
      return updateRegmlSettings(ctx, tenantId);
    }

    return methodNotAllowed(['PUT']);
  }

  if (resource === 'workspaces') {
    const mode = parseMode(modeSegment);
    if (!mode) {
      return json({ error: 'regml_workspace_not_found' }, { status: 404 });
    }

    if (!subresource && ctx.request.method === 'GET') {
      const workspaceContext = await buildTenantAiContext(ctx.env, tenantId);
      const session = await buildSession(ctx.env, tenantId, mode, workspaceContext);
      return session
        ? json({ data: { session } })
        : json({ error: 'regml_workspace_not_found' }, { status: 404 });
    }

    if (subresource === 'run' && ctx.request.method === 'POST') {
      return runRegmlPrompt(ctx, tenantId, mode);
    }

    if (subresource === 'attempts' && subresourceId && action === 'apply' && ctx.request.method === 'POST') {
      return applyRegmlAttempt(ctx, tenantId, mode, subresourceId);
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  return json({ error: 'not_found', path: segments.join('/') }, { status: 404 });
}
