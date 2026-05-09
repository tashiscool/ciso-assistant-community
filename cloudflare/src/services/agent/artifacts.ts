import type {
  AssuranceSeverity,
  EvaluationArtifacts,
  NormalizedEvidenceBundle,
  WritebackApprovalRecord,
} from '../assurance/types';
import type { ThreatHuntArtifacts } from '../assurance/threatHunt';
import type { AgentWorkflowGraph, AgentWorkflowMemory } from './workflow';

type AgentPolicyDecisionSummary = {
  actionId: string;
  allowed: boolean;
  category: string;
  reason: string;
};

type AgentSecurityEvalStatus = 'PASS' | 'PARTIAL' | 'FAIL';

type AgentSecurityEvalResult = {
  evalId: string;
  title: string;
  status: AgentSecurityEvalStatus;
  severity: AssuranceSeverity;
  summary: string;
  rationale: string;
  evidenceRefs: string[];
  metrics: Record<string, unknown>;
};

type AgentSecurityEvalDocument = {
  metadata: {
    schema_version: string;
    generated_at: string;
    run_id: string;
    evidence_job_id: string;
    package_job_id: string | null;
    workflow_name: string;
    bundle_kind: string;
  };
  summary: {
    pass_count: number;
    partial_count: number;
    fail_count: number;
    pending_writeback_count: number;
    awaiting_review_count: number;
    blocked_control_count: number;
    unknown_action_count: number;
  };
  evaluations: AgentSecurityEvalResult[];
  review_gates: string[];
  blocked_controls: Array<{
    action_id: string;
    category: string;
    reason: string;
  }>;
  pending_writebacks: Array<{
    id: string;
    request_type: string;
    status: string;
    connector_id: string | null;
  }>;
  threat_hunt_findings: Array<{
    id: string;
    title: string;
    severity: AssuranceSeverity;
    status: string;
  }>;
};

type AgentSecurityArtifacts = {
  evalResultsDocument: AgentSecurityEvalDocument;
  riskReportMarkdown: string;
  poamCsv: string;
};

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  );
}

function sliceOrFallback(values: string[], fallback: string[]): string[] {
  return values.length > 0 ? values.slice(0, 6) : fallback;
}

function codeBlock(language: string, lines: string[]): string {
  return [`\`\`\`${language}`, ...lines, '```'].join('\n');
}

function nowIso(): string {
  return new Date().toISOString();
}

function severityRank(value: AssuranceSeverity): number {
  switch (value) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'moderate':
      return 2;
    case 'low':
      return 1;
  }
}

function dueDateBySeverity(severity: AssuranceSeverity): string {
  const date = new Date();
  switch (severity) {
    case 'critical':
      date.setDate(date.getDate() + 7);
      break;
    case 'high':
      date.setDate(date.getDate() + 14);
      break;
    case 'moderate':
      date.setDate(date.getDate() + 30);
      break;
    case 'low':
      date.setDate(date.getDate() + 45);
      break;
  }
  return date.toISOString().slice(0, 10);
}

function csvRow(values: string[]): string {
  return values.map((value) => `"${value.replaceAll('"', '""')}"`).join(',');
}

function suspiciousMemoryKeys(
  value: unknown,
  path = '',
  findings: string[] = [],
): string[] {
  if (!value || typeof value !== 'object') {
    return findings;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  for (const [key, item] of entries) {
    const nextPath = path ? `${path}.${key}` : key;
    if (/(secret|token|password|credential|private[_-]?key|authorization|api[_-]?key)/i.test(key)) {
      findings.push(nextPath);
    }
    suspiciousMemoryKeys(item, nextPath, findings);
  }
  return findings;
}

function buildAgentSecurityEvaluations(args: {
  runId: string;
  runStatus: string;
  runFolderId: string | null;
  evidenceJobId: string;
  workflowName: string;
  bundle: NormalizedEvidenceBundle;
  workflowGraph: AgentWorkflowGraph;
  workflowMemory: AgentWorkflowMemory;
  policyDecisions: AgentPolicyDecisionSummary[];
  requestedWritebacks: boolean;
  pendingWritebacks: WritebackApprovalRecord[];
  awaitingReviewReasons: string[];
  assurance: EvaluationArtifacts;
  threatHunt: ThreatHuntArtifacts;
  reportCount: number;
  validationStatus: string;
  reconciliationStatus: string;
}): AgentSecurityEvalResult[] {
  const allowedActions = args.policyDecisions.filter((item) => item.allowed);
  const blockedControls = args.policyDecisions.filter(
    (item) => !item.allowed && item.category === 'blocked',
  );
  const unknownActions = args.policyDecisions.filter(
    (item) => !item.allowed && item.category === 'unknown',
  );
  const suspiciousKeys = suspiciousMemoryKeys(args.workflowMemory);
  const auditArtifactFamilies = [
    'trace_json',
    'summary_markdown',
    'task_graph',
    'workflow_memory',
    'agent_instrumentation_plan',
    'secure_agent_architecture',
  ];
  const auditEvidenceRefs =
    args.reportCount > 0
      ? [...auditArtifactFamilies, 'report_manifest', 'validation_report']
      : auditArtifactFamilies;
  const reviewGateCount = args.awaitingReviewReasons.length + args.pendingWritebacks.length;
  const scopeMismatch =
    Boolean(args.runFolderId) &&
    Boolean(args.bundle.folderId) &&
    args.runFolderId !== args.bundle.folderId;
  const tenantWideScope = !args.runFolderId || !args.bundle.folderId;
  const validationDrift = args.validationStatus !== 'pass';
  const reconciliationDrift = args.reconciliationStatus !== 'matched';

  return [
    {
      evalId: 'AGENT_TOOL_GOVERNANCE',
      title: 'Tool governance and bounded-action enforcement',
      status:
        unknownActions.length > 0
          ? 'FAIL'
          : allowedActions.length > 0 && blockedControls.length > 0
            ? 'PASS'
            : 'PARTIAL',
      severity: unknownActions.length > 0 ? 'critical' : 'high',
      summary:
        unknownActions.length > 0
          ? `${unknownActions.length} action(s) fell outside the bounded workflow contract.`
          : `The bounded run recorded ${allowedActions.length} allowed action(s) and kept ${blockedControls.length} high-risk control path(s) blocked.`,
      rationale:
        unknownActions.length > 0
          ? 'The run produced action identifiers that were not classified into the approved bounded workflow categories.'
          : 'Allowed workflow actions stayed inside the bounded contract, and high-risk external action categories remained explicitly blocked.',
      evidenceRefs: ['task_graph', 'workflow_memory', 'blocked_actions'],
      metrics: {
        runId: args.runId,
        workflowName: args.workflowName,
        allowedActionCount: allowedActions.length,
        blockedControlCount: blockedControls.length,
        unknownActionCount: unknownActions.length,
      },
    },
    {
      evalId: 'AGENT_PERMISSION_SCOPE',
      title: 'Tenant and folder scope preservation',
      status: scopeMismatch ? 'FAIL' : tenantWideScope ? 'PARTIAL' : 'PASS',
      severity: scopeMismatch ? 'critical' : 'high',
      summary: scopeMismatch
        ? `The run folder scope (${args.runFolderId}) does not match the normalized bundle scope (${args.bundle.folderId}).`
        : tenantWideScope
          ? `The run stayed tenant-wide without a narrower folder scope boundary.`
          : `The run stayed within folder scope ${args.bundle.folderId}.`,
      rationale: scopeMismatch
        ? 'Scope drift between the run context and the normalized bundle would weaken authorization and artifact lineage guarantees.'
        : tenantWideScope
          ? 'Tenant-wide scope is allowed, but it carries broader blast radius than a folder-scoped bounded run.'
          : 'The bounded run, evidence bundle, and artifact lineage all remained aligned to the same folder scope.',
      evidenceRefs: ['trace_json', `evidence_job:${args.evidenceJobId}`],
      metrics: {
        runFolderId: args.runFolderId,
        bundleFolderId: args.bundle.folderId,
        tenantId: args.bundle.tenantId,
        inBoundaryAssetCount: args.bundle.declaredInventory.filter((item) => item.inBoundary).length,
      },
    },
    {
      evalId: 'AGENT_MEMORY_CONTEXT_SAFETY',
      title: 'Workflow memory and context-safety hygiene',
      status:
        suspiciousKeys.length > 0
          ? 'FAIL'
          : Object.keys(args.workflowMemory.perTask).length === 0
            ? 'PARTIAL'
            : 'PASS',
      severity: suspiciousKeys.length > 0 ? 'critical' : 'high',
      summary:
        suspiciousKeys.length > 0
          ? `${suspiciousKeys.length} suspicious memory key(s) were detected in the workflow memory ledger.`
          : `The workflow memory ledger recorded ${Object.keys(args.workflowMemory.perTask).length} task memory record(s) without obvious secret-shaped keys.`,
      rationale:
        suspiciousKeys.length > 0
          ? 'Secret-like or credential-like keys should not be retained in long-lived workflow memory artifacts.'
          : 'The workflow memory artifact preserved bounded task context and artifact lineage without obvious secret-shaped fields.',
      evidenceRefs: ['workflow_memory'],
      metrics: {
        workflowName: args.workflowMemory.workflowName,
        taskMemoryCount: Object.keys(args.workflowMemory.perTask).length,
        suspiciousKeys,
      },
    },
    {
      evalId: 'AGENT_APPROVAL_GATES',
      title: 'Approval gates and human-review enforcement',
      status:
        reviewGateCount > 0
          ? args.runStatus === 'awaiting_review'
            ? 'PARTIAL'
            : 'FAIL'
          : 'PASS',
      severity: reviewGateCount > 0 ? 'high' : 'moderate',
      summary:
        reviewGateCount > 0
          ? `The run preserved ${args.pendingWritebacks.length} pending writeback(s) and ${args.awaitingReviewReasons.length} additional review gate(s).`
          : 'The run completed without pending approvals or unresolved review gates.',
      rationale:
        reviewGateCount > 0
          ? 'Approval-gated external writebacks and unresolved review reasons must keep the run in analyst review until a human closes them.'
          : 'No pending approvals or unresolved review gates remained at bounded-run completion.',
      evidenceRefs: ['summary_markdown', 'writeback_requests'],
      metrics: {
        pendingWritebackCount: args.pendingWritebacks.length,
        awaitingReviewReasonCount: args.awaitingReviewReasons.length,
        runStatus: args.runStatus,
        requestedWritebacks: args.requestedWritebacks,
      },
    },
    {
      evalId: 'AGENT_POLICY_VIOLATIONS',
      title: 'Policy violation capture and escalation readiness',
      status:
        unknownActions.length > 0
          ? 'FAIL'
          : validationDrift || reconciliationDrift || args.threatHunt.findingCount > 0
            ? 'PARTIAL'
            : 'PASS',
      severity:
        unknownActions.length > 0
          ? 'critical'
          : args.threatHunt.findingCount > 0
            ? 'high'
            : 'moderate',
      summary:
        unknownActions.length > 0
          ? `${unknownActions.length} out-of-contract action(s) require immediate policy remediation.`
          : `The run surfaced ${args.threatHunt.findingCount} threat-hunt finding(s), validation status ${args.validationStatus}, and reconciliation status ${args.reconciliationStatus}.`,
      rationale:
        unknownActions.length > 0
          ? 'Unknown actions indicate a gap in bounded-action policy classification.'
          : 'No unknown actions were observed, but unresolved drift or hunt findings still require escalation and human review before external follow-up.',
      evidenceRefs: ['blocked_actions', 'validation_report', 'threat_hunt_findings'],
      metrics: {
        blockedControlCount: blockedControls.length,
        unknownActionCount: unknownActions.length,
        threatHuntFindingCount: args.threatHunt.findingCount,
        validationStatus: args.validationStatus,
        reconciliationStatus: args.reconciliationStatus,
      },
    },
    {
      evalId: 'AGENT_AUDITABILITY',
      title: 'Run trace completeness and artifact auditability',
      status:
        args.workflowGraph.tasks.length > 0 &&
        Object.keys(args.workflowMemory.perTask).length > 0 &&
        args.reportCount > 0
          ? 'PASS'
          : 'PARTIAL',
      severity: 'moderate',
      summary:
        args.reportCount > 0
          ? `The bounded run preserved ${auditEvidenceRefs.length} audit-facing artifact family reference(s) plus ${args.reportCount} rendered report(s).`
          : 'The bounded run preserved core trace artifacts, but downstream report rendering did not complete.',
      rationale:
        args.reportCount > 0
          ? 'Trace, workflow graph, workflow memory, package validation, and rendered report artifacts are all available for post-run audit and reviewer inspection.'
          : 'Core run artifacts exist, but downstream reporting is incomplete and weakens reviewer replayability.',
      evidenceRefs: auditEvidenceRefs,
      metrics: {
        taskCount: args.workflowGraph.tasks.length,
        policyDecisionCount: args.policyDecisions.length,
        reportCount: args.reportCount,
        artifactFamilyCount: auditEvidenceRefs.length,
      },
    },
  ];
}

function buildAgentEvalResultsDocument(args: {
  runId: string;
  evidenceJobId: string;
  packageJobId: string | null;
  workflowName: string;
  bundleKind: string;
  evaluations: AgentSecurityEvalResult[];
  pendingWritebacks: WritebackApprovalRecord[];
  awaitingReviewReasons: string[];
  policyDecisions: AgentPolicyDecisionSummary[];
  threatHunt: ThreatHuntArtifacts;
}): AgentSecurityEvalDocument {
  const passCount = args.evaluations.filter((item) => item.status === 'PASS').length;
  const partialCount = args.evaluations.filter((item) => item.status === 'PARTIAL').length;
  const failCount = args.evaluations.filter((item) => item.status === 'FAIL').length;
  const blockedControls = args.policyDecisions.filter(
    (item) => !item.allowed && item.category === 'blocked',
  );
  const unknownActions = args.policyDecisions.filter(
    (item) => !item.allowed && item.category === 'unknown',
  );

  return {
    metadata: {
      schema_version: 'v1',
      generated_at: nowIso(),
      run_id: args.runId,
      evidence_job_id: args.evidenceJobId,
      package_job_id: args.packageJobId,
      workflow_name: args.workflowName,
      bundle_kind: args.bundleKind,
    },
    summary: {
      pass_count: passCount,
      partial_count: partialCount,
      fail_count: failCount,
      pending_writeback_count: args.pendingWritebacks.length,
      awaiting_review_count: args.awaitingReviewReasons.length,
      blocked_control_count: blockedControls.length,
      unknown_action_count: unknownActions.length,
    },
    evaluations: args.evaluations,
    review_gates: args.awaitingReviewReasons,
    blocked_controls: blockedControls.map((item) => ({
      action_id: item.actionId,
      category: item.category,
      reason: item.reason,
    })),
    pending_writebacks: args.pendingWritebacks.map((item) => ({
      id: item.id,
      request_type: item.requestType,
      status: item.status,
      connector_id: item.connectorId,
    })),
    threat_hunt_findings: args.threatHunt.findings.slice(0, 10).map((item) => ({
      id: item.id,
      title: item.title,
      severity: item.severity,
      status: item.status,
    })),
  };
}

function buildAgentRiskReportMarkdown(args: {
  workflowName: string;
  runId: string;
  evidenceJobId: string;
  packageJobId: string | null;
  evaluations: AgentSecurityEvalResult[];
  pendingWritebacks: WritebackApprovalRecord[];
  awaitingReviewReasons: string[];
  assurance: EvaluationArtifacts;
  threatHunt: ThreatHuntArtifacts;
  validationStatus: string;
  reconciliationStatus: string;
}): string {
  const sortedThreatFindings = [...args.threatHunt.findings].sort(
    (left, right) => severityRank(right.severity) - severityRank(left.severity),
  );
  return [
    '# Agentic Risk Assessment',
    '',
    `Workflow: ${args.workflowName}`,
    `Run: ${args.runId}`,
    `Evidence bundle: ${args.evidenceJobId}`,
    `Package job: ${args.packageJobId ?? 'not built'}`,
    `Validation status: ${args.validationStatus}`,
    `Reconciliation status: ${args.reconciliationStatus}`,
    '',
    '## Agent Governance Evaluations',
    ...args.evaluations.map(
      (item) => `- **${item.evalId}** — ${item.status}: ${item.summary}`,
    ),
    '',
    '## Assurance Posture',
    `- Failing deterministic evaluations: ${args.assurance.summary.failingEvaluations}`,
    `- Open evidence gaps: ${args.assurance.gaps.length}`,
    `- Pending review recommendations: ${args.assurance.reviewRecommendations.length}`,
    `- Threat-hunt findings requiring review: ${args.threatHunt.findingCount}`,
    '',
    '## Pending Approval Gates',
    ...(args.pendingWritebacks.length > 0
      ? args.pendingWritebacks.map(
          (item) =>
            `- Writeback ${item.id} (${item.requestType}) is ${item.status}${item.connectorId ? ` via ${item.connectorId}` : ''}.`,
        )
      : ['- No pending external writeback approvals were recorded.']),
    ...(args.awaitingReviewReasons.length > 0
      ? ['', '## Awaiting Review Reasons', ...args.awaitingReviewReasons.map((item) => `- ${item}`)]
      : []),
    '',
    '## Threat-Hunt Highlights',
    ...(sortedThreatFindings.length > 0
      ? sortedThreatFindings.slice(0, 5).map(
          (item) => `- [${item.severity.toUpperCase()}] ${item.title}: ${item.detail}`,
        )
      : ['- No threat-hunt findings were generated for this run.']),
    '',
    '## Recommended Follow-Up',
    '- Close all pending writebacks through the approval ledger before allowing any external side effects.',
    '- Resolve package validation or reconciliation drift before representing the package as authorize-ready.',
    '- Preserve analyst notes, ticket lineage, and supporting hunt queries alongside the bounded run artifacts.',
  ].join('\n');
}

function buildAgentPoamCsv(evaluations: AgentSecurityEvalResult[]): string {
  const headers = [
    'poam_id',
    'source_eval_id',
    'status',
    'severity',
    'weakness_name',
    'weakness_description',
    'planned_remediation',
    'milestone_due_date',
    'evidence_refs',
  ];
  const nonPassing = evaluations.filter((item) => item.status !== 'PASS');
  const lines = [csvRow(headers)];
  for (const [index, item] of nonPassing.entries()) {
    lines.push(
      csvRow([
        `AGENT-POAM-${index + 1}`,
        item.evalId,
        item.status === 'FAIL' ? 'open' : 'planned',
        item.severity,
        item.title,
        item.summary,
        `${item.rationale} Attach updated trace, workflow memory, and review evidence before rerunning the bounded agent.`,
        dueDateBySeverity(item.severity),
        item.evidenceRefs.join('|'),
      ]),
    );
  }
  return lines.join('\n');
}

export function buildAgentSecurityArtifacts(args: {
  runId: string;
  runStatus: string;
  evidenceJobId: string;
  packageJobId: string | null;
  runFolderId: string | null;
  workflowName: string;
  bundle: NormalizedEvidenceBundle;
  workflowGraph: AgentWorkflowGraph;
  workflowMemory: AgentWorkflowMemory;
  policyDecisions: AgentPolicyDecisionSummary[];
  requestedWritebacks: boolean;
  pendingWritebacks: WritebackApprovalRecord[];
  awaitingReviewReasons: string[];
  assurance: EvaluationArtifacts;
  threatHunt: ThreatHuntArtifacts;
  reportCount: number;
  validationStatus: string;
  reconciliationStatus: string;
}): AgentSecurityArtifacts {
  const evaluations = buildAgentSecurityEvaluations({
    runId: args.runId,
    runStatus: args.runStatus,
    runFolderId: args.runFolderId,
    evidenceJobId: args.evidenceJobId,
    workflowName: args.workflowName,
    bundle: args.bundle,
    workflowGraph: args.workflowGraph,
    workflowMemory: args.workflowMemory,
    policyDecisions: args.policyDecisions,
    requestedWritebacks: args.requestedWritebacks,
    pendingWritebacks: args.pendingWritebacks,
    awaitingReviewReasons: args.awaitingReviewReasons,
    assurance: args.assurance,
    threatHunt: args.threatHunt,
    reportCount: args.reportCount,
    validationStatus: args.validationStatus,
    reconciliationStatus: args.reconciliationStatus,
  });

  return {
    evalResultsDocument: buildAgentEvalResultsDocument({
      runId: args.runId,
      evidenceJobId: args.evidenceJobId,
      packageJobId: args.packageJobId,
      workflowName: args.workflowName,
      bundleKind: args.bundle.bundleKind,
      evaluations,
      pendingWritebacks: args.pendingWritebacks,
      awaitingReviewReasons: args.awaitingReviewReasons,
      policyDecisions: args.policyDecisions,
      threatHunt: args.threatHunt,
    }),
    riskReportMarkdown: buildAgentRiskReportMarkdown({
      workflowName: args.workflowName,
      runId: args.runId,
      evidenceJobId: args.evidenceJobId,
      packageJobId: args.packageJobId,
      evaluations,
      pendingWritebacks: args.pendingWritebacks,
      awaitingReviewReasons: args.awaitingReviewReasons,
      assurance: args.assurance,
      threatHunt: args.threatHunt,
      validationStatus: args.validationStatus,
      reconciliationStatus: args.reconciliationStatus,
    }),
    poamCsv: buildAgentPoamCsv(evaluations),
  };
}

export function buildAgentInstrumentationPlanMarkdown(args: {
  bundle: NormalizedEvidenceBundle;
  workflowName: string;
  policyDecisions: AgentPolicyDecisionSummary[];
  pendingWritebackCount: number;
  validationStatus: string;
  reconciliationStatus: string;
  awaitingReviewReasons: string[];
}): string {
  const blockedActions = args.policyDecisions.filter((item) => !item.allowed);
  const draftActions = args.policyDecisions.filter((item) => item.category === 'draft');
  const semanticTypes = sliceOrFallback(
    unique(args.bundle.cloudEvents.map((item) => item.semanticType)),
    ['generic.event'],
  );
  const focusAssets = sliceOrFallback(
    unique(
      args.bundle.declaredInventory
        .filter((item) => item.inBoundary || item.isPublic)
        .map((item) => item.assetId),
    ),
    ['unknown-asset'],
  );
  const reviewReasons = args.awaitingReviewReasons.length > 0
    ? args.awaitingReviewReasons
    : ['Track blocked actions, pending approvals, validation drift, and reconciliation drift.'];

  const splunkLines = [
    'index=security sourcetype=regovise:assurance:agent',
    `| search workflow_name="${args.workflowName}"`,
    `| search (${semanticTypes.map((item) => `semantic_type="${item}"`).join(' OR ')})`,
    `| search (${focusAssets.map((item) => `asset_id="${item}"`).join(' OR ')})`,
    '| stats count by action_id, category, status, validation_status, reconciliation_status',
  ];

  const sentinelLines = [
    'AssuranceAgent_CL',
    `| where WorkflowName_s == "${args.workflowName}"`,
    `| where SemanticType_s in (${semanticTypes.map((item) => `"${item}"`).join(', ')})`,
    `| where AssetId_s in (${focusAssets.map((item) => `"${item}"`).join(', ')})`,
    '| summarize Events=count() by ActionId_s, Category_s, Status_s, ValidationStatus_s, ReconciliationStatus_s',
  ];

  const awsLines = [
    "fields @timestamp, action_id, category, status, validation_status, reconciliation_status",
    `| filter workflow_name = "${args.workflowName}"`,
    `| filter semantic_type in [${semanticTypes.map((item) => `"${item}"`).join(', ')}]`,
    `| filter asset_id in [${focusAssets.map((item) => `"${item}"`).join(', ')}]`,
    '| stats count() by action_id, category, status, validation_status, reconciliation_status',
  ];

  const gcpLines = [
    'resource.type="regovise_assurance_agent"',
    `jsonPayload.workflowName="${args.workflowName}"`,
    `jsonPayload.semanticType=(${semanticTypes.map((item) => `"${item}"`).join(' OR ')})`,
    `jsonPayload.assetId=(${focusAssets.map((item) => `"${item}"`).join(' OR ')})`,
  ];

  return [
    '# Agent Instrumentation Plan',
    '',
    `Workflow: ${args.workflowName}`,
    `Validation status: ${args.validationStatus}`,
    `Reconciliation status: ${args.reconciliationStatus}`,
    `Pending writebacks: ${args.pendingWritebackCount}`,
    '',
    '## Detection Objectives',
    '- Detect blocked or out-of-contract agent actions before they can become external side effects.',
    '- Preserve approval-gate observability for every draft writeback and every pending reviewer action.',
    '- Keep validation drift and reconciliation drift queryable in the same operational timeline as the agent run.',
    '',
    '## Current Review Gates',
    ...reviewReasons.map((item) => `- ${item}`),
    '',
    '## Policy Signals',
    `- Blocked actions observed: ${blockedActions.length}`,
    `- Draft-only actions observed: ${draftActions.length}`,
    `- Semantic types in scope: ${semanticTypes.join(', ')}`,
    `- Assets in scope: ${focusAssets.join(', ')}`,
    '',
    '## Splunk',
    codeBlock('spl', splunkLines),
    '',
    '## Sentinel (KQL)',
    codeBlock('kusto', sentinelLines),
    '',
    '## AWS CloudWatch Logs Insights',
    codeBlock('sql', awsLines),
    '',
    '## GCP Cloud Logging',
    codeBlock('text', gcpLines),
    '',
    '## Review Priority',
    ...(blockedActions.length > 0
      ? blockedActions.slice(0, 6).map((item) => `- ${item.actionId}: ${item.reason}`)
      : ['- No blocked actions were recorded in this bounded run.']),
  ].join('\n');
}

export function buildSecureAgentArchitectureMarkdown(args: {
  bundle: NormalizedEvidenceBundle;
  workflowGraph: AgentWorkflowGraph;
  evidenceJobId: string;
  packageJobId: string | null;
  requestedWritebacks: boolean;
  policyDecisions: AgentPolicyDecisionSummary[];
  awaitingReviewReasons: string[];
  pendingWritebackCount: number;
}): string {
  const allowedActions = args.policyDecisions.filter((item) => item.allowed);
  const blockedActions = args.policyDecisions.filter((item) => !item.allowed);
  const categories = unique(args.workflowGraph.tasks.map((item) => item.actionCategory));
  const publicAssets = unique(
    args.bundle.declaredInventory.filter((item) => item.isPublic).map((item) => item.assetId),
  );

  return [
    '# Secure Agent Architecture',
    '',
    `Workflow: ${args.workflowGraph.workflowName}`,
    `Evidence bundle: ${args.evidenceJobId}`,
    `Package job: ${args.packageJobId ?? 'not built'}`,
    `Bundle kind: ${args.bundle.bundleKind}`,
    '',
    '## Bounded Mission',
    `- ${args.workflowGraph.rationale}`,
    '- The agent is constrained to evidence interpretation, package construction, reconciliation, validation, explanation, and draft-only external writeback preparation.',
    '- Direct cloud mutation, IAM mutation, destructive actions, and unapproved external notifications remain outside the v1 execution boundary.',
    '',
    '## Identity And Scope',
    `- Tenant: ${args.bundle.tenantId}`,
    `- Folder scope: ${args.bundle.folderId ?? 'tenant-wide'}`,
    `- In-boundary assets: ${args.bundle.declaredInventory.filter((item) => item.inBoundary).length}`,
    `- Public assets: ${publicAssets.length > 0 ? publicAssets.join(', ') : 'none'}`,
    '',
    '## Workflow Graph',
    `- Task count: ${args.workflowGraph.tasks.length}`,
    `- Optional tasks: ${args.workflowGraph.tasks.filter((item) => item.optional).length}`,
    `- Action categories: ${categories.join(', ')}`,
    '',
    '## Control Boundaries',
    `- Allowed actions recorded: ${allowedActions.length}`,
    `- Blocked actions recorded: ${blockedActions.length}`,
    `- Pending writeback approvals: ${args.pendingWritebackCount}`,
    `- External writebacks requested: ${args.requestedWritebacks ? 'yes' : 'no'}`,
    '',
    '## Approval Gates',
    ...(args.awaitingReviewReasons.length > 0
      ? args.awaitingReviewReasons.map((item) => `- ${item}`)
      : ['- No open review gates were recorded for this run.']),
    '',
    '## Observability Artifacts',
    '- `trace_json`: immutable bounded-run trace with step inputs and outputs.',
    '- `task_graph`: deterministic workflow DAG used by the run.',
    '- `workflow_memory`: per-task memory ledger with artifact lineage.',
    '- `summary_markdown`: operator-facing bounded-run summary.',
    '- `agent_eval_results`: deterministic governance evaluation set for the bounded run.',
    '- `agent_risk_report`: reviewer-facing markdown summary of governance posture and follow-up.',
    '- `agent_poam`: CSV backlog for non-passing governance and approval-gate controls.',
    '- `agent_instrumentation_plan`: detection-oriented telemetry guidance for the bounded workflow.',
    '- `secure_agent_architecture`: architecture narrative for review, audit, and BuildLab presentation use.',
    '',
    '## Blocked Action Records',
    ...(blockedActions.length > 0
      ? blockedActions.slice(0, 8).map((item) => `- ${item.actionId}: ${item.reason}`)
      : ['- No blocked actions were observed in this run.']),
  ].join('\n');
}
