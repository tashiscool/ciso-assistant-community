import type { TenantAiContext } from './tenantContext';

export type WorkspaceGuidanceDomain =
  | 'risk'
  | 'privacy'
  | 'vendor'
  | 'evidence'
  | 'compliance'
  | 'operations'
  | 'setup'
  | 'general';

function joinList(values: string[]) {
  return values.length > 0 ? values.join(', ') : 'None currently available';
}

export function classifyWorkspaceGuidanceDomain(message: string): WorkspaceGuidanceDomain {
  const lower = message.toLowerCase();

  if (/\bprivacy|gdpr|processing|breach|data subject|right request|dpo\b/.test(lower)) {
    return 'privacy';
  }

  if (/\bvendor|third[- ]party|supplier|tprm|auditee|portal assignment\b/.test(lower)) {
    return 'vendor';
  }

  if (/\bebios|quant|ale|scenario|risk|treatment|register\b/.test(lower)) {
    return 'risk';
  }

  if (/\bevidence|artifact|export|oscal|regscale|emass|ssp|assessment\b/.test(lower)) {
    return 'evidence';
  }

  if (/\bcontrol|framework|policy|questionnaire|compliance|fedramp|nist|iso\b/.test(lower)) {
    return 'compliance';
  }

  if (/\bmonitor|conmon|workflow|chat|report|import|ops|operations\b/.test(lower)) {
    return 'operations';
  }

  if (/\bsetup|bootstrap|onboard|configure|module|enable\b/.test(lower)) {
    return 'setup';
  }

  return 'general';
}

export function buildWorkspaceGuidancePrompts(
  domain: WorkspaceGuidanceDomain,
  message: string,
  context: TenantAiContext,
  allowedCitationLabels: string[],
  sessionHints?: {
    folderName?: string | null;
    workflow?: string | null;
  },
) {
  const metrics = context.metrics;
  const domainContext =
    domain === 'risk'
      ? [
          `Risk assessments: ${metrics.riskAssessments}`,
          `EBIOS studies: ${metrics.ebiosStudies}`,
          `Quantitative studies: ${metrics.quantitativeStudies}`,
          `Risk samples: ${joinList(context.samples.riskAssessments)}`,
        ]
      : domain === 'privacy'
        ? [
            `Processings: ${metrics.processings}`,
            `Right requests: ${metrics.rightRequests}`,
            `Data breaches: ${metrics.dataBreaches}`,
            `Privacy samples: ${joinList(context.samples.processings)}`,
          ]
        : domain === 'vendor'
          ? [
              `Third-party entities: ${metrics.entities}`,
              `Portal assignments: ${metrics.portalAssignments}`,
              `Entity samples: ${joinList(context.samples.entities)}`,
              `Portal assignment samples: ${joinList(context.samples.portalAssignments)}`,
            ]
          : domain === 'evidence'
            ? [
                `Evidence artifacts: ${metrics.evidenceArtifacts}`,
                `Security plans / assessments: ${metrics.securityPlans}`,
                `Report exports: ${metrics.reportExports}`,
                `Evidence samples: ${joinList(context.samples.evidenceArtifacts)}`,
              ]
            : domain === 'compliance'
              ? [
                  `Primary framework: ${context.primaryFramework}`,
                  `Policies: ${metrics.policies}`,
                  `Questionnaires: ${metrics.questionnaires}`,
                  `Policy samples: ${joinList(context.samples.policies)}`,
                  `Questionnaire samples: ${joinList(context.samples.questionnaires)}`,
                ]
              : domain === 'operations'
                ? [
                    `Imports: ${metrics.importJobs}`,
                    `Report exports: ${metrics.reportExports}`,
                    `Continuous monitoring executions: ${metrics.conmonExecutions}`,
                    `Portal assignments: ${metrics.portalAssignments}`,
                  ]
                : domain === 'setup'
                  ? [
                      `Domains: ${joinList(context.domains)}`,
                      `Primary framework: ${context.primaryFramework}`,
                      `Policies: ${metrics.policies}`,
                      `Questionnaires: ${metrics.questionnaires}`,
                    ]
                  : [
                      `Domains: ${joinList(context.domains)}`,
                      `Primary framework: ${context.primaryFramework}`,
                      `Risk assessments: ${metrics.riskAssessments}`,
                      `Processings: ${metrics.processings}`,
                      `Entities: ${metrics.entities}`,
                      `Evidence artifacts: ${metrics.evidenceArtifacts}`,
                    ];

  return {
    systemPrompt: [
      'You are Regovise Workspace Guidance, a tenant-scoped security, risk, privacy, and compliance assistant.',
      'Use only the provided workspace context. Never invent counts, names, workflow states, controls, evidence, or next steps.',
      'If the workspace context is insufficient, say so plainly and keep the answer bounded to what is known.',
      'Keep the answer concise, practical, and operator-facing.',
      'Return only valid JSON with this shape: {"answer":"string","next_actions":["string"],"citations":["label"]}.',
      'Citations must be chosen only from the allowed citation labels list.',
    ].join('\n'),
    userPrompt: [
      `Requested domain: ${domain}`,
      `User question: ${message}`,
      `Organization: ${context.organizationName}`,
      `Focused folder: ${sessionHints?.folderName?.trim() || 'Not specified'}`,
      `Workflow: ${sessionHints?.workflow?.trim() || 'general'}`,
      `Domains: ${joinList(context.domains)}`,
      '',
      'Workspace context:',
      ...domainContext,
      '',
      'Allowed citation labels:',
      ...allowedCitationLabels.map((label) => `- ${label}`),
    ].join('\n'),
  };
}

export function buildResponseAutomationPrompts(input: {
  question: string;
  context: TenantAiContext;
  sourceContext: string;
  acceptedPatterns: string[];
  relevantSourceLabels: string[];
}) {
  const { question, context, sourceContext, acceptedPatterns, relevantSourceLabels } = input;

  return {
    systemPrompt: [
      'You are Regovise Response Automation, an evidence-grounded questionnaire answering assistant.',
      'Use only the supplied internal source snippets and accepted answer patterns.',
      'Do not invent controls, procedures, or technologies that are not supported by the snippets.',
      'If the evidence is insufficient, return an empty answer, confidence 55 or below, and review_state "Blank".',
      'If the evidence supports an answer, return a concise 2-4 sentence draft, confidence 60-98, and review_state "Needs Review".',
      'Citations must be chosen only from the allowed source labels and should reference the sources that actually support the answer.',
      'Return only valid JSON with this shape: {"answer":"string","confidence":0,"review_state":"Needs Review|Blank","citations":["string"],"evidence_gaps":["string"]}.',
    ].join('\n'),
    userPrompt: [
      `Question: ${question}`,
      `Organization: ${context.organizationName}`,
      `Primary framework: ${context.primaryFramework}`,
      `Policy count: ${context.metrics.policies}`,
      `Questionnaire count: ${context.metrics.questionnaires}`,
      `Security plan count: ${context.metrics.securityPlans}`,
      `Evidence artifact count: ${context.metrics.evidenceArtifacts}`,
      `Recent policy samples: ${joinList(context.samples.policies)}`,
      `Recent questionnaire samples: ${joinList(context.samples.questionnaires)}`,
      `Recent security-plan samples: ${joinList(context.samples.securityPlans)}`,
      '',
      'Accepted response patterns:',
      ...(acceptedPatterns.length > 0 ? acceptedPatterns.map((pattern) => `- ${pattern}`) : ['- None available']),
      '',
      'Allowed source labels:',
      ...(relevantSourceLabels.length > 0 ? relevantSourceLabels.map((label) => `- ${label}`) : ['- No source labels available']),
      '',
      'Approved source snippets:',
      sourceContext,
    ].join('\n'),
  };
}

function getRegmlModeDirective(mode: string) {
  if (mode === 'Auditor') {
    return 'You are the RegML Auditor agent. Focus on completeness, evidence sufficiency, assessor-readiness, and issue-generation posture.';
  }

  if (mode === 'AI Generator') {
    return 'You are the RegML AI Generator agent. Focus on questionnaire-to-narrative translation, inheritance boundaries, and version review readiness.';
  }

  return 'You are the RegML SSP Author agent. Focus on source-backed implementation statements, cloud responsibility boundaries, and low-confidence gap review.';
}

export function buildRegmlPlanPrompts(input: {
  mode: string;
  prompt: string;
  context: TenantAiContext;
  issueThreshold: number | null;
}) {
  const { mode, prompt, context, issueThreshold } = input;

  return {
    systemPrompt: [
      getRegmlModeDirective(mode),
      'Return only valid JSON with this shape: {"steps":["string","string","string"],"reviewer_note":"string"}.',
      'Provide exactly three steps. Keep each step short, concrete, and grounded in the supplied tenant context.',
      'Do not invent missing source material or completed controls.',
    ].join('\n'),
    userPrompt: [
      `Workspace mode: ${mode}`,
      `Prompt: ${prompt}`,
      `Organization: ${context.organizationName}`,
      `Primary framework: ${context.primaryFramework}`,
      `Domains: ${joinList(context.domains)}`,
      `Issue threshold: ${issueThreshold ?? 'n/a'}`,
      `Policies: ${context.metrics.policies}`,
      `Questionnaires: ${context.metrics.questionnaires}`,
      `Security plans: ${context.metrics.securityPlans}`,
      `Evidence artifacts: ${context.metrics.evidenceArtifacts}`,
      `Control inventory signals: policies=${joinList(context.samples.policies)} | questionnaires=${joinList(context.samples.questionnaires)} | security plans=${joinList(context.samples.securityPlans)}`,
    ].join('\n'),
  };
}

export function buildRegmlAttemptPrompts(input: {
  mode: string;
  prompt: string;
  context: TenantAiContext;
  issueThreshold: number | null;
  creditsCost: number;
}) {
  const { mode, prompt, context, issueThreshold, creditsCost } = input;

  return {
    systemPrompt: [
      getRegmlModeDirective(mode),
      'Return only valid JSON with this shape: {"summary":["string","string","string"],"before_items":["string","string","string"],"after_items":["string","string","string"],"note":"string","warning":"string|null"}.',
      'Keep every bullet concise and grounded in the supplied tenant signals.',
      'Do not fabricate evidence or claim the draft is publish-ready without review.',
    ].join('\n'),
    userPrompt: [
      `Workspace mode: ${mode}`,
      `Prompt: ${prompt}`,
      `Organization: ${context.organizationName}`,
      `Primary framework: ${context.primaryFramework}`,
      `Domains: ${joinList(context.domains)}`,
      `Issue threshold: ${issueThreshold ?? 'n/a'}`,
      `Credits cost: ${creditsCost}`,
      `Policies: ${context.metrics.policies}`,
      `Questionnaires: ${context.metrics.questionnaires}`,
      `Security plans: ${context.metrics.securityPlans}`,
      `Evidence artifacts: ${context.metrics.evidenceArtifacts}`,
      `Entities: ${context.metrics.entities}`,
      `Recent policy samples: ${joinList(context.samples.policies)}`,
      `Recent questionnaire samples: ${joinList(context.samples.questionnaires)}`,
      `Recent security-plan samples: ${joinList(context.samples.securityPlans)}`,
    ].join('\n'),
  };
}
