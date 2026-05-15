import type { EnvBindings } from '../../types/env';
import { generateJsonWithAi, getAiRuntimeStatus } from './runtime';
import { buildTenantAiContext } from './tenantContext';
import {
  buildWorkspaceGuidancePrompts,
  classifyWorkspaceGuidanceDomain,
  type WorkspaceGuidanceDomain,
} from './promptPacks';

type ChatCitation = {
  label: string;
  value: string;
};

type WorkspaceGuidanceReply = {
  content: string;
  citations: ChatCitation[];
};

type WorkspaceGuidanceJson = {
  answer?: string;
  next_actions?: string[];
  citations?: string[];
};

function buildCitationPool(context: Awaited<ReturnType<typeof buildTenantAiContext>>) {
  return {
    Organization: context.organizationName,
    'Primary framework': context.primaryFramework,
    Domains: context.domains.join(', ') || 'None configured',
    'Risk assessments': String(context.metrics.riskAssessments),
    'EBIOS RM studies': String(context.metrics.ebiosStudies),
    'Quantitative studies': String(context.metrics.quantitativeStudies),
    'Privacy processings': String(context.metrics.processings),
    'Right requests': String(context.metrics.rightRequests),
    'Data breaches': String(context.metrics.dataBreaches),
    'Third-party entities': String(context.metrics.entities),
    'Portal assignments': String(context.metrics.portalAssignments),
    Policies: String(context.metrics.policies),
    Questionnaires: String(context.metrics.questionnaires),
    'Security plans': String(context.metrics.securityPlans),
    'Evidence artifacts': String(context.metrics.evidenceArtifacts),
    'Report exports': String(context.metrics.reportExports),
    Imports: String(context.metrics.importJobs),
    'Continuous monitoring executions': String(context.metrics.conmonExecutions),
  };
}

function composeReply(answer: string, nextActions: string[]) {
  const trimmedAnswer = answer.trim();
  const actions = nextActions.map((action) => action.trim()).filter((action) => action.length > 0).slice(0, 3);
  if (actions.length === 0) {
    return trimmedAnswer;
  }

  return `${trimmedAnswer}\n\nNext actions:\n${actions.map((action) => `- ${action}`).join('\n')}`;
}

function buildFallbackReply(
  domain: WorkspaceGuidanceDomain,
  message: string,
  context: Awaited<ReturnType<typeof buildTenantAiContext>>,
): WorkspaceGuidanceReply {
  const lower = message.toLowerCase();
  const citations = buildCitationPool(context);

  if (domain === 'privacy' || lower.includes('privacy')) {
    return {
      content: composeReply(
        `Privacy posture currently tracks ${context.metrics.processings} processing records, ${context.metrics.rightRequests} right requests, and ${context.metrics.dataBreaches} breach records. Use those artifacts to tighten response handling and confirm any high-risk processing paths are fully documented.`,
        [
          'Review recent processing records for missing DPIA or transfer details.',
          'Check whether any right requests or breach records still need follow-up evidence.',
        ],
      ),
      citations: [
        { label: 'Privacy processings', value: citations['Privacy processings'] },
        { label: 'Right requests', value: citations['Right requests'] },
        { label: 'Data breaches', value: citations['Data breaches'] },
      ],
    };
  }

  if (domain === 'vendor') {
    return {
      content: composeReply(
        `Third-party oversight currently covers ${context.metrics.entities} entities and ${context.metrics.portalAssignments} portal assignments. The most effective next step is to close the loop between open assignments and the entity records they support.`,
        [
          'Complete any portal assignments that are still waiting on auditee input.',
          'Link missing evidence or contract detail back to the affected third-party records.',
        ],
      ),
      citations: [
        { label: 'Third-party entities', value: citations['Third-party entities'] },
        { label: 'Portal assignments', value: citations['Portal assignments'] },
      ],
    };
  }

  if (domain === 'risk') {
    return {
      content: composeReply(
        `The risk workspace currently includes ${context.metrics.riskAssessments} qualitative assessments, ${context.metrics.ebiosStudies} EBIOS studies, and ${context.metrics.quantitativeStudies} quantitative studies. Choose the lane based on whether you need treatment tracking, attack-path analysis, or economic-loss modeling.`,
        [
          'Use EBIOS when you need workshop-driven strategic and operational scenario analysis.',
          'Use the quantitative workspace when you need financial-loss framing for decisions.',
        ],
      ),
      citations: [
        { label: 'Risk assessments', value: citations['Risk assessments'] },
        { label: 'EBIOS RM studies', value: citations['EBIOS RM studies'] },
        { label: 'Quantitative studies', value: citations['Quantitative studies'] },
      ],
    };
  }

  if (domain === 'evidence' || domain === 'compliance') {
    return {
      content: composeReply(
        `The workspace has ${context.metrics.policies} policies, ${context.metrics.questionnaires} questionnaires, ${context.metrics.securityPlans} security-plan records, and ${context.metrics.evidenceArtifacts} evidence artifacts available for grounded review. Use those canonical sources before exporting or drafting new attestations.`,
        [
          'Refresh weak or missing evidence before running final exports.',
          'Confirm policy and questionnaire coverage for the controls you plan to answer or publish.',
        ],
      ),
      citations: [
        { label: 'Primary framework', value: citations['Primary framework'] },
        { label: 'Policies', value: citations.Policies },
        { label: 'Evidence artifacts', value: citations['Evidence artifacts'] },
      ],
    };
  }

  if (domain === 'operations' || domain === 'setup') {
    return {
      content: composeReply(
        `The workspace is operating across ${context.domains.length} configured domains with ${context.metrics.importJobs} imports, ${context.metrics.reportExports} exports, and ${context.metrics.conmonExecutions} continuous-monitoring executions recorded. Focus next on the workstream that is blocking operational throughput.`,
        [
          'Clear failed imports or exports before they cascade into reporting gaps.',
          'Review continuous-monitoring activity if evidence freshness is lagging.',
        ],
      ),
      citations: [
        { label: 'Domains', value: citations.Domains },
        { label: 'Report exports', value: citations['Report exports'] },
        { label: 'Continuous monitoring executions', value: citations['Continuous monitoring executions'] },
      ],
    };
  }

  return {
    content: composeReply(
      `Workspace summary: ${context.metrics.riskAssessments} risk assessments, ${context.metrics.processings} privacy processings, ${context.metrics.entities} third-party entities, ${context.metrics.evidenceArtifacts} evidence artifacts, and ${context.metrics.portalAssignments} portal assignments. Ask about risk, privacy, vendors, compliance, or operations and I’ll narrow the answer down.`,
      ['Call out the domain you want to focus on so the answer can stay grounded and specific.'],
    ),
    citations: [
      { label: 'Risk assessments', value: citations['Risk assessments'] },
      { label: 'Privacy processings', value: citations['Privacy processings'] },
      { label: 'Third-party entities', value: citations['Third-party entities'] },
    ],
  };
}

export async function buildWorkspaceChatReply(
  env: EnvBindings,
  tenantId: string,
  message: string,
  sessionHints?: {
    folderName?: string | null;
    workflow?: string | null;
  },
): Promise<WorkspaceGuidanceReply> {
  const context = await buildTenantAiContext(env, tenantId);
  const domain = classifyWorkspaceGuidanceDomain(message);
  const fallback = buildFallbackReply(domain, message, context);
  const runtime = await getAiRuntimeStatus(env, tenantId);

  if (!runtime.textGenerationAvailable) {
    return fallback;
  }

  const citationPool = buildCitationPool(context);
  const allowedCitationLabels = Object.keys(citationPool);
  const prompts = buildWorkspaceGuidancePrompts(
    domain,
    message,
    context,
    allowedCitationLabels,
    sessionHints,
  );

  const generated = await generateJsonWithAi<WorkspaceGuidanceJson>(env, {
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    maxTokens: 420,
    temperature: 0.15,
  }, tenantId);

  const answer = generated?.answer?.trim();
  if (!answer) {
    return fallback;
  }

  const chosenCitations = ((generated?.citations ?? []) as string[])
    .map((label) => label.trim())
    .filter((label) => label in citationPool)
    .slice(0, 4)
    .map((label) => ({ label, value: citationPool[label as keyof typeof citationPool] }));

  return {
    content: composeReply(answer, (generated?.next_actions ?? []) as string[]),
    citations: chosenCitations.length > 0 ? chosenCitations : fallback.citations,
  };
}
