export const JIRA_WRITE_OPERATIONS = ['create_issue', 'add_comment', 'link_issue', 'transition_issue'] as const;

export const JIRA_PROCESS_SLUGS = [
  'dev_test_traceability',
  'change_management',
  'deployment_precheck',
  'deployment_postcheck',
  'audit_log_review',
  'monitoring_alert_triage',
  'incident_response_triage',
  'continuous_monitoring',
  'patch_flaw_remediation',
  'security_function_verification',
  'policy_change_tracking',
  'poam_corrective_action',
  'risk_exception_acceptance',
  'access_request_review',
  'evidence_data_call',
  'backup_contingency_test',
  'vendor_remediation',
  'agentic_risk_review',
] as const;

export type JiraConnectorRow = {
  id: string;
  name: string;
  provider: string;
  category: string;
  auth_mode: string;
  base_url: string | null;
  status: string;
  is_enabled: number;
  config_json: string;
  capabilities_json: string;
};

export type JiraWriteIntent = {
  operation?: string;
  process_slug?: string;
  control_mappings?: string[];
  target?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  evidence_refs?: string[];
  sensitivity?: Record<string, unknown>;
  idempotency_key?: string;
};

export type JiraIntentValidation = {
  valid: boolean;
  errors: string[];
  operation: string;
  processSlug: string;
  targetSummary: Record<string, string | null>;
  redaction: Record<string, string>;
};

export type JiraDispatchResult = {
  status: 'validated' | 'dispatched' | 'failed';
  validation: JiraIntentValidation;
  dryRun: boolean;
  externalDispatchPerformed: boolean;
  jiraIssueKey?: string | null;
  jiraUrl?: string | null;
  jiraCommentId?: string | null;
  jiraLinkResult?: unknown;
  jiraTransitionResult?: unknown;
  failureReason?: string;
  httpStatus?: number;
  response?: unknown;
};

const PROCESS_KEYWORDS: Record<string, string[]> = {
  dev_test_traceability: ['dev', 'test', 'qa', 'uat', 'story', 'bug', 'sprint', 'acceptance criteria'],
  change_management: ['change', 'cab', 'release', 'deploy', 'implementation plan', 'rollback'],
  deployment_precheck: ['precheck', 'pre-check', 'readiness', 'go/no-go', 'pre deploy', 'pre-deploy'],
  deployment_postcheck: ['postcheck', 'post-check', 'post deploy', 'post-deploy', 'verification', 'smoke test'],
  audit_log_review: ['audit log', 'log review', 'au-6', 'audit trail', 'log retention'],
  monitoring_alert_triage: ['alert', 'monitoring', 'siem', 'soc', 'detection', 'triage'],
  incident_response_triage: ['incident', 'ir-', 'sev', 'breach', 'forensic', 'root cause'],
  continuous_monitoring: ['conmon', 'continuous monitoring', 'monthly', 'weekly review', 'ca-7'],
  patch_flaw_remediation: ['patch', 'vulnerability', 'vuln', 'cve-', 'nessus', 'inspector', 'si-2', 'si-6'],
  security_function_verification: ['security function', 'si-6', 'control verification', 'ids', 'edr', 'guardrail'],
  policy_change_tracking: ['policy', 'procedure', 'standard', 'baseline', 'approved policy'],
  poam_corrective_action: ['poa&m', 'poam', 'corrective action', 'cap', 'milestone'],
  risk_exception_acceptance: ['exception', 'risk acceptance', 'waiver', 'deviation', 'accepted risk'],
  access_request_review: ['access', 'iam', 'account', 'privilege', 'role', 'permission', 'recertification'],
  evidence_data_call: ['evidence', 'data call', 'audit request', 'artifact request', 'auditor'],
  backup_contingency_test: ['backup', 'restore', 'contingency', 'dr test', 'disaster recovery', 'cp-9'],
  vendor_remediation: ['vendor', 'supplier', 'third party', 'third-party', 'subcontractor'],
  agentic_risk_review: ['agent', 'llm', 'prompt injection', 'tool call', 'autonomous', 'memory safety'],
};

const PROCESS_CONTROLS: Record<string, string[]> = {
  dev_test_traceability: ['SA-10', 'SA-11', 'CM-3'],
  change_management: ['CM-3', 'CM-4', 'CM-5', 'CM-6'],
  deployment_precheck: ['CM-3', 'CM-4', 'SA-10'],
  deployment_postcheck: ['CM-3', 'CM-4', 'SI-2'],
  audit_log_review: ['AU-6', 'AU-12'],
  monitoring_alert_triage: ['SI-4', 'AU-6', 'IR-6'],
  incident_response_triage: ['IR-4', 'IR-5', 'IR-6'],
  continuous_monitoring: ['CA-7', 'SI-4', 'AU-6'],
  patch_flaw_remediation: ['SI-2', 'SI-6', 'RA-5'],
  security_function_verification: ['SI-6', 'SI-4', 'CA-7'],
  policy_change_tracking: ['PM-1', 'PL-2', 'CM-6'],
  poam_corrective_action: ['CA-5', 'CA-7'],
  risk_exception_acceptance: ['RA-3', 'CA-5', 'PM-9'],
  access_request_review: ['AC-2', 'AC-6', 'IA-2'],
  evidence_data_call: ['CA-2', 'CA-7', 'AU-6'],
  backup_contingency_test: ['CP-9', 'CP-10'],
  vendor_remediation: ['SR-3', 'SR-5', 'SA-9'],
  agentic_risk_review: ['SI-4', 'IR-4', 'AC-6'],
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseJsonRecord(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return {};
  }
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function readString(record: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return fallback;
}

function readStringArray(record: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
    if (typeof value === 'string' && value.trim()) return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function field(issue: Record<string, unknown>, key: string): unknown {
  return asRecord(issue.fields)[key];
}

function nameOf(value: unknown): string {
  const record = asRecord(value);
  if (Object.keys(record).length) return readString(record, ['name', 'key', 'value']);
  return typeof value === 'string' ? value : '';
}

function namesOf(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => nameOf(item)).filter(Boolean) : [];
}

function redactText(value: unknown, limit = 240): string {
  return String(value ?? '')
    .replace(/(password|secret|token|api[_-]?key|authorization)\s*[:=]\s*\S+/gi, '$1=[REDACTED]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g, '[email-redacted]')
    .slice(0, limit);
}

function classifyIssue(issue: Record<string, unknown>): string[] {
  const labels = Array.isArray(field(issue, 'labels')) ? (field(issue, 'labels') as unknown[]).join(' ') : '';
  const blob = [
    nameOf(field(issue, 'project')),
    nameOf(field(issue, 'issuetype')),
    labels,
    namesOf(field(issue, 'components')).join(' '),
    String(field(issue, 'summary') ?? ''),
    String(field(issue, 'description') ?? ''),
  ].join(' ').toLowerCase();
  return JIRA_PROCESS_SLUGS.filter((slug) => PROCESS_KEYWORDS[slug].some((keyword) => blob.includes(keyword)));
}

function ticketGapFlags(row: Record<string, unknown>): string[] {
  const blob = [row.summary, row.description_excerpt, row.status, row.status_category].join(' ').toLowerCase();
  const slugs = Array.isArray(row.process_slugs) ? row.process_slugs.map((item) => String(item)) : [];
  const gaps = new Set<string>();
  if (slugs.some((slug) => ['change_management', 'deployment_precheck', 'deployment_postcheck'].includes(slug))) {
    if (!blob.includes('security impact') && !blob.includes('sia')) gaps.add('missing_sia');
    if (!blob.includes('approved') && !blob.includes('approval') && !blob.includes('cab')) gaps.add('missing_approval');
    if (!blob.includes('deploy')) gaps.add('missing_deployment_evidence');
    if (!blob.includes('verified') && !blob.includes('verification') && !blob.includes('post-check') && !blob.includes('smoke')) gaps.add('missing_post_check_verification');
  }
  if (slugs.some((slug) => ['dev_test_traceability', 'deployment_precheck', 'deployment_postcheck'].includes(slug))) {
    if (!blob.includes('test') && !blob.includes('qa') && !blob.includes('validation') && !blob.includes('smoke')) gaps.add('missing_testing_evidence');
  }
  if (slugs.includes('patch_flaw_remediation') && !blob.includes('retest') && !blob.includes('rescanned') && !blob.includes('verified') && !blob.includes('closed')) {
    gaps.add('missing_retest_or_closure');
  }
  if (slugs.includes('incident_response_triage') && !blob.includes('detected') && !blob.includes('contained') && !blob.includes('eradicated') && !blob.includes('recovered') && !blob.includes('timeline')) {
    gaps.add('missing_incident_timeline');
  }
  if (slugs.includes('policy_change_tracking') && !blob.includes('approved') && !blob.includes('effective date') && !blob.includes('communication') && !blob.includes('reviewed')) {
    gaps.add('missing_policy_approval');
  }
  return [...gaps].sort();
}

function connectorConfig(connector: JiraConnectorRow): Record<string, unknown> {
  return parseJsonRecord(connector.config_json);
}

function connectorCapabilities(connector: JiraConnectorRow): string[] {
  return parseJsonArray(connector.capabilities_json);
}

function capabilityForOperation(operation: string): string {
  switch (operation) {
    case 'create_issue':
      return 'ticket_write:create';
    case 'add_comment':
      return 'ticket_write:comment';
    case 'link_issue':
      return 'ticket_write:link';
    case 'transition_issue':
      return 'ticket_write:transition';
    default:
      return `ticket_write:${operation}`;
  }
}

function allowlist(config: Record<string, unknown>, keys: string[]): string[] {
  return readStringArray(config, keys);
}

function hasCapability(connector: JiraConnectorRow, capability: string): boolean {
  const capabilities = connectorCapabilities(connector);
  return capabilities.includes(capability) || capabilities.includes('ticket_write') || capabilities.includes('*');
}

function connectorBaseUrl(connector: JiraConnectorRow): string {
  const config = connectorConfig(connector);
  return (connector.base_url || readString(config, ['baseUrl', 'base_url']) || '').replace(/\/$/, '');
}

function authHeaders(connector: JiraConnectorRow): Record<string, string> {
  const config = connectorConfig(connector);
  const username = readString(config, ['username', 'user']);
  const password = readString(config, ['password', 'apiToken', 'token']);
  const bearer = readString(config, ['bearerToken', 'accessToken']);
  if (connector.auth_mode === 'bearer' || bearer) {
    return bearer ? { Authorization: `Bearer ${bearer}` } : {};
  }
  if (username && password) {
    return { Authorization: `Basic ${btoa(`${username}:${password}`)}` };
  }
  return {};
}

function redactConnectorSummary(connector: JiraConnectorRow): Record<string, unknown> {
  const config = connectorConfig(connector);
  return {
    connectorId: connector.id,
    name: connector.name,
    provider: connector.provider,
    category: connector.category,
    baseUrl: connectorBaseUrl(connector),
    authMode: connector.auth_mode,
    sourceEnclave: readString(config, ['source_enclave', 'sourceEnclave']) || null,
    dataClassification: readString(config, ['data_classification', 'dataClassification']) || null,
    redactionProfile: readString(config, ['redaction_profile', 'redactionProfile']) || null,
    credentialMaterialPersistedInResult: false,
  };
}

export function validateJiraConnector(connector: JiraConnectorRow): JiraIntentValidation {
  const errors: string[] = [];
  if (connector.provider.toLowerCase() !== 'jira') errors.push('Connector provider must be jira.');
  if (connector.category.toLowerCase() !== 'ticketing') errors.push('Connector category must be ticketing.');
  if (!connector.is_enabled) errors.push('Connector is disabled.');
  if (!connectorBaseUrl(connector)) errors.push('Jira base URL is required.');
  if (!hasCapability(connector, 'jira:dry_run')) errors.push('Connector must declare jira:dry_run capability.');
  return {
    valid: errors.length === 0,
    errors,
    operation: 'connector_test',
    processSlug: '',
    targetSummary: { baseUrl: connectorBaseUrl(connector) || null },
    redaction: { profile: 'connector', credentialMaterialPersistedInResult: 'false' },
  };
}

export function validateJiraWriteIntent(connector: JiraConnectorRow, intentInput: unknown): JiraIntentValidation {
  const intent = asRecord(intentInput) as JiraWriteIntent;
  const target = asRecord(intent.target);
  const payload = asRecord(intent.payload);
  const config = connectorConfig(connector);
  const operation = typeof intent.operation === 'string' ? intent.operation : '';
  const processSlug = typeof intent.process_slug === 'string' ? intent.process_slug : '';
  const projectKey = readString(target, ['project_key', 'projectKey']);
  const issueType = readString(target, ['issue_type', 'issueType']);
  const issueKey = readString(target, ['issue_key', 'issueKey']);
  const linkType = readString(target, ['link_type', 'linkType']);
  const transition = readString(target, ['transition_id', 'transitionId', 'transition_name', 'transitionName']);
  const customFields = asRecord(payload.custom_fields);
  const errors: string[] = [];

  const connectorValidation = validateJiraConnector(connector);
  errors.push(...connectorValidation.errors);

  if (!JIRA_WRITE_OPERATIONS.includes(operation as (typeof JIRA_WRITE_OPERATIONS)[number])) {
    errors.push(`Unsupported operation: ${operation || '(missing)'}.`);
  }
  if (!JIRA_PROCESS_SLUGS.includes(processSlug as (typeof JIRA_PROCESS_SLUGS)[number])) {
    errors.push(`Unsupported process_slug: ${processSlug || '(missing)'}.`);
  }
  if (operation && !hasCapability(connector, capabilityForOperation(operation))) {
    errors.push(`Connector does not declare capability ${capabilityForOperation(operation)}.`);
  }

  if (operation === 'create_issue') {
    if (!projectKey) errors.push('create_issue requires target.project_key.');
    if (!issueType) errors.push('create_issue requires target.issue_type.');
    if (!readString(payload, ['summary'])) errors.push('create_issue requires payload.summary.');
    if (!readString(payload, ['description'])) errors.push('create_issue requires payload.description.');
  }
  if (operation === 'add_comment') {
    if (!issueKey) errors.push('add_comment requires target.issue_key.');
    if (!readString(payload, ['comment', 'body'])) errors.push('add_comment requires payload.comment.');
  }
  if (operation === 'link_issue') {
    if (!issueKey) errors.push('link_issue requires target.issue_key.');
    if (!readString(target, ['outward_issue_key', 'outwardIssueKey', 'related_issue_key', 'relatedIssueKey'])) {
      errors.push('link_issue requires target.outward_issue_key.');
    }
    if (!linkType) errors.push('link_issue requires target.link_type.');
  }
  if (operation === 'transition_issue') {
    if (!issueKey) errors.push('transition_issue requires target.issue_key.');
    if (!transition) errors.push('transition_issue requires target.transition_id or transition_name.');
  }

  const projectAllowlist = allowlist(config, ['project_allowlist', 'projectAllowlist']);
  const issueTypeAllowlist = allowlist(config, ['issue_type_allowlist', 'issueTypeAllowlist']);
  const linkTypeAllowlist = allowlist(config, ['link_type_allowlist', 'linkTypeAllowlist']);
  const transitionAllowlist = allowlist(config, ['transition_allowlist', 'transitionAllowlist']);
  const customFieldAllowlist = allowlist(config, ['custom_field_allowlist', 'customFieldAllowlist']);
  if (projectAllowlist.length && projectKey && !projectAllowlist.includes(projectKey)) {
    errors.push(`Project ${projectKey} is not allowlisted.`);
  }
  if (issueTypeAllowlist.length && issueType && !issueTypeAllowlist.includes(issueType)) {
    errors.push(`Issue type ${issueType} is not allowlisted.`);
  }
  if (linkTypeAllowlist.length && linkType && !linkTypeAllowlist.includes(linkType)) {
    errors.push(`Link type ${linkType} is not allowlisted.`);
  }
  if (transitionAllowlist.length && transition && !transitionAllowlist.includes(transition)) {
    errors.push(`Transition ${transition} is not allowlisted.`);
  }
  if (customFieldAllowlist.length) {
    const blocked = Object.keys(customFields).filter((field) => !customFieldAllowlist.includes(field));
    if (blocked.length) errors.push(`Custom fields not allowlisted: ${blocked.sort().join(', ')}.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    operation,
    processSlug,
    targetSummary: {
      baseUrl: connectorBaseUrl(connector) || null,
      projectKey: projectKey || null,
      issueType: issueType || null,
      issueKey: issueKey || null,
      linkType: linkType || null,
      transition: transition || null,
    },
    redaction: {
      profile: readString(config, ['redaction_profile', 'redactionProfile'], 'summary_only'),
      payloadBodiesEchoed: 'false',
    },
  };
}

async function jiraRequest(connector: JiraConnectorRow, method: string, path: string, body?: unknown): Promise<{ status: number; data: unknown }> {
  const baseUrl = connectorBaseUrl(connector);
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'regovise-jira-connector/1.0',
      ...authHeaders(connector),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data: unknown = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { text: text.slice(0, 600) };
    }
  }
  if (!response.ok) {
    const message = typeof data === 'object' && data && 'errorMessages' in data
      ? JSON.stringify((data as Record<string, unknown>).errorMessages)
      : text.slice(0, 600);
    throw Object.assign(new Error(`Jira HTTP ${response.status}: ${message}`), { status: response.status, data });
  }
  return { status: response.status, data };
}

function issueFields(intentInput: unknown): Record<string, unknown> {
  const intent = asRecord(intentInput);
  const target = asRecord(intent.target);
  const payload = asRecord(intent.payload);
  const fields: Record<string, unknown> = {
    project: { key: readString(target, ['project_key', 'projectKey']) },
    issuetype: { name: readString(target, ['issue_type', 'issueType']) },
    summary: readString(payload, ['summary']),
    description: readString(payload, ['description']),
  };
  const labels = Array.isArray(payload.labels) ? payload.labels.map((item) => String(item)).filter(Boolean) : [];
  if (labels.length) fields.labels = labels;
  const components = Array.isArray(payload.components) ? payload.components.map((item) => ({ name: String(item) })).filter((item) => item.name) : [];
  if (components.length) fields.components = components;
  Object.assign(fields, asRecord(payload.custom_fields));
  return fields;
}

export async function testJiraConnector(connector: JiraConnectorRow): Promise<Record<string, unknown>> {
  const validation = validateJiraConnector(connector);
  if (!validation.valid) {
    return { status: 'failed', validation, connector: redactConnectorSummary(connector) };
  }
  const [serverInfo, myself, projects, createmeta] = await Promise.all([
    jiraRequest(connector, 'GET', '/rest/api/2/serverInfo'),
    jiraRequest(connector, 'GET', '/rest/api/2/myself'),
    jiraRequest(connector, 'GET', '/rest/api/2/project'),
    jiraRequest(connector, 'GET', '/rest/api/2/issue/createmeta?expand=projects.issuetypes.fields'),
  ]);
  const projectList = Array.isArray(projects.data) ? projects.data : [];
  const metaProjects = Array.isArray(asRecord(createmeta.data).projects) ? (asRecord(createmeta.data).projects as unknown[]) : [];
  return {
    status: 'validated',
    validation,
    connector: redactConnectorSummary(connector),
    serverInfo: {
      version: asRecord(serverInfo.data).version ?? null,
      deploymentType: asRecord(serverInfo.data).deploymentType ?? null,
      serverTitle: asRecord(serverInfo.data).serverTitle ?? null,
    },
    authenticated: Boolean(asRecord(myself.data).name || asRecord(myself.data).key || asRecord(myself.data).displayName),
    projectCount: projectList.length,
    createmetaProjectCount: metaProjects.length,
  };
}

export async function dryRunJiraWriteIntent(connector: JiraConnectorRow, intentInput: unknown): Promise<JiraDispatchResult> {
  const validation = validateJiraWriteIntent(connector, intentInput);
  return {
    status: validation.valid ? 'validated' : 'failed',
    validation,
    dryRun: true,
    externalDispatchPerformed: false,
  };
}

export async function dispatchJiraWriteIntent(connector: JiraConnectorRow, intentInput: unknown): Promise<JiraDispatchResult> {
  const dryRun = await dryRunJiraWriteIntent(connector, intentInput);
  if (!dryRun.validation.valid) {
    return { ...dryRun, status: 'failed', failureReason: dryRun.validation.errors.join('; ') };
  }
  const intent = asRecord(intentInput);
  const target = asRecord(intent.target);
  const payload = asRecord(intent.payload);
  const operation = dryRun.validation.operation;
  try {
    if (operation === 'create_issue') {
      const response = await jiraRequest(connector, 'POST', '/rest/api/2/issue', { fields: issueFields(intentInput) });
      const data = asRecord(response.data);
      return {
        status: 'dispatched',
        validation: dryRun.validation,
        dryRun: false,
        externalDispatchPerformed: true,
        jiraIssueKey: typeof data.key === 'string' ? data.key : null,
        jiraUrl: typeof data.self === 'string' ? data.self : null,
        response: { key: data.key ?? null, self: data.self ?? null },
      };
    }
    if (operation === 'add_comment') {
      const issueKey = encodeURIComponent(readString(target, ['issue_key', 'issueKey']));
      const response = await jiraRequest(connector, 'POST', `/rest/api/2/issue/${issueKey}/comment`, {
        body: readString(payload, ['comment', 'body']),
      });
      const data = asRecord(response.data);
      return {
        status: 'dispatched',
        validation: dryRun.validation,
        dryRun: false,
        externalDispatchPerformed: true,
        jiraCommentId: typeof data.id === 'string' ? data.id : null,
        jiraUrl: typeof data.self === 'string' ? data.self : null,
        response: { id: data.id ?? null, self: data.self ?? null },
      };
    }
    if (operation === 'link_issue') {
      const response = await jiraRequest(connector, 'POST', '/rest/api/2/issueLink', {
        type: { name: readString(target, ['link_type', 'linkType']) },
        inwardIssue: { key: readString(target, ['issue_key', 'issueKey']) },
        outwardIssue: {
          key: readString(target, ['outward_issue_key', 'outwardIssueKey', 'related_issue_key', 'relatedIssueKey']),
        },
        ...(readString(payload, ['comment', 'body']) ? { comment: { body: readString(payload, ['comment', 'body']) } } : {}),
      });
      return {
        status: 'dispatched',
        validation: dryRun.validation,
        dryRun: false,
        externalDispatchPerformed: true,
        jiraLinkResult: response.data || { accepted: true },
      };
    }
    const issueKey = encodeURIComponent(readString(target, ['issue_key', 'issueKey']));
    const transitionId = readString(target, ['transition_id', 'transitionId', 'transition_name', 'transitionName']);
    const response = await jiraRequest(connector, 'POST', `/rest/api/2/issue/${issueKey}/transitions`, {
      transition: { id: transitionId },
      ...(readString(payload, ['comment', 'body'])
        ? { update: { comment: [{ add: { body: readString(payload, ['comment', 'body']) } }] } }
        : {}),
    });
    return {
      status: 'dispatched',
      validation: dryRun.validation,
      dryRun: false,
      externalDispatchPerformed: true,
      jiraTransitionResult: response.data || { accepted: true, transitionId },
    };
  } catch (error) {
    const failure = error as Error & { status?: number; data?: unknown };
    return {
      status: 'failed',
      validation: dryRun.validation,
      dryRun: false,
      externalDispatchPerformed: false,
      failureReason: failure.message,
      httpStatus: failure.status,
      response: failure.data,
    };
  }
}

export async function importJiraTickets(connector: JiraConnectorRow, input: { jql?: string; maxResults?: number }): Promise<Record<string, unknown>> {
  const validation = validateJiraConnector(connector);
  if (!validation.valid) {
    return { status: 'failed', validation, artifacts: {}, error: 'Connector validation failed.' };
  }
  const config = connectorConfig(connector);
  const sourceEnclave = readString(config, ['source_enclave', 'sourceEnclave'], 'default');
  const dataClassification = readString(config, ['data_classification', 'dataClassification'], 'internal');
  const redactionProfile = readString(config, ['redaction_profile', 'redactionProfile'], 'summary_only');
  const jql = input.jql?.trim() || 'updated >= -30d ORDER BY updated DESC';
  const maxResults = Math.max(1, Math.min(Number(input.maxResults ?? 50), 200));
  const [serverInfo, projects, linkTypes, searchResult] = await Promise.all([
    jiraRequest(connector, 'GET', '/rest/api/2/serverInfo'),
    jiraRequest(connector, 'GET', '/rest/api/2/project'),
    jiraRequest(connector, 'GET', '/rest/api/2/issueLinkType'),
    jiraRequest(connector, 'GET', `/rest/api/2/search?${new URLSearchParams({ jql, maxResults: String(maxResults) }).toString()}`),
  ]);
  const issues = Array.isArray(asRecord(searchResult.data).issues) ? (asRecord(searchResult.data).issues as Record<string, unknown>[]) : [];
  const rows = issues.map((issue) => {
    const status = field(issue, 'status');
    const statusCategory = asRecord(status).statusCategory;
    const processSlugs = classifyIssue(issue);
    const controlMappings = [...new Set(processSlugs.flatMap((slug) => PROCESS_CONTROLS[slug] ?? []))].sort();
    const row: Record<string, unknown> = {
      ticket_key: readString(issue, ['key', 'id'], 'JIRA-UNKNOWN'),
      ticket_url: `${connectorBaseUrl(connector)}/browse/${encodeURIComponent(readString(issue, ['key'], 'JIRA-UNKNOWN'))}`,
      source_system: 'jira',
      source_enclave: sourceEnclave,
      data_classification: dataClassification,
      redaction_profile: redactionProfile,
      project: nameOf(field(issue, 'project')),
      issue_type: nameOf(field(issue, 'issuetype')),
      status: nameOf(status),
      status_category: nameOf(statusCategory),
      priority: nameOf(field(issue, 'priority')) || null,
      severity: nameOf(field(issue, 'severity')) || null,
      labels: Array.isArray(field(issue, 'labels')) ? field(issue, 'labels') : [],
      components: namesOf(field(issue, 'components')),
      summary: redactText(field(issue, 'summary'), 300),
      description_excerpt: redactText(field(issue, 'description')),
      process_slugs: processSlugs,
      control_mappings: controlMappings,
      redaction_status: 'redacted_summary',
      source_confidence: field(issue, 'project') && field(issue, 'issuetype') && field(issue, 'summary') && field(issue, 'status') ? 'high' : 'medium',
    };
    row.gap_flags = ticketGapFlags(row);
    return row;
  });
  const coverage = JIRA_PROCESS_SLUGS.map((slug) => ({
    process_slug: slug,
    ticket_count: rows.filter((row) => Array.isArray(row.process_slugs) && row.process_slugs.includes(slug)).length,
    ticket_keys: rows.filter((row) => Array.isArray(row.process_slugs) && row.process_slugs.includes(slug)).map((row) => row.ticket_key),
    control_mappings: PROCESS_CONTROLS[slug],
  }));
  const gapCounts: Record<string, number> = {};
  for (const row of rows) {
    for (const gap of Array.isArray(row.gap_flags) ? row.gap_flags : []) {
      const key = String(gap);
      gapCounts[key] = (gapCounts[key] ?? 0) + 1;
    }
  }
  const projectList = Array.isArray(projects.data) ? projects.data as Record<string, unknown>[] : [];
  const artifacts = {
    ticket_system_inventory: {
      schema_version: '1.0',
      system: 'jira',
      base_url: connectorBaseUrl(connector),
      server: {
        version: asRecord(serverInfo.data).version ?? null,
        deployment_type: asRecord(serverInfo.data).deploymentType ?? null,
        title: asRecord(serverInfo.data).serverTitle ?? null,
      },
      source_enclave: sourceEnclave,
      data_classification: dataClassification,
      redaction_profile: redactionProfile,
      project_count: projectList.length,
      projects: projectList.map((project) => ({ key: project.key ?? null, name: project.name ?? null })),
      issue_link_types: Array.isArray(asRecord(linkTypes.data).issueLinkTypes) ? asRecord(linkTypes.data).issueLinkTypes : [],
    },
    ticket_process_coverage: {
      schema_version: '1.0',
      slug_count: JIRA_PROCESS_SLUGS.length,
      covered_slug_count: coverage.filter((row) => row.ticket_count > 0).length,
      coverage,
      gaps: coverage.filter((row) => row.ticket_count === 0).map((row) => row.process_slug),
      unclassified_ticket_keys: rows.filter((row) => Array.isArray(row.process_slugs) && row.process_slugs.length === 0).map((row) => row.ticket_key),
      evidence_gap_counts: gapCounts,
    },
    ticket_evidence_matrix: {
      schema_version: '1.0',
      ticket_count: rows.length,
      rows,
      gap_counts: gapCounts,
      summary: 'Ticket evidence matrix generated from Regovise Jira connector import.',
    },
    source_confidence: {
      schema_version: '1.0',
      source: 'jira',
      record_count: rows.length,
      overall_confidence: rows.some((row) => row.source_confidence !== 'high') ? 'medium' : 'high',
      confidence_reasons: [
        'Jira Server REST API responses were normalized without Atlassian Cloud accountId assumptions.',
        'Descriptions are summarized/redacted in generated artifacts.',
      ],
    },
    rejection_diagnostics: {
      schema_version: '1.0',
      rejected_record_count: rows.filter((row) => row.source_confidence !== 'high').length,
      records: rows
        .filter((row) => row.source_confidence !== 'high')
        .map((row) => ({ ticket_key: row.ticket_key, reason: 'missing required Jira project, issue type, summary, or status field' })),
    },
  };
  return {
    status: 'completed',
    connector: redactConnectorSummary(connector),
    jqlHash: await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jql)).then((buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')),
    artifacts,
    summary: {
      ticketCount: rows.length,
      coveredProcessSlugCount: artifacts.ticket_process_coverage.covered_slug_count,
      missingProcessSlugs: artifacts.ticket_process_coverage.gaps,
      evidenceGapCounts: gapCounts,
    },
  };
}

export function summarizeJiraResult(result: JiraDispatchResult): Record<string, unknown> {
  return {
    status: result.status,
    dryRun: result.dryRun,
    externalDispatchPerformed: result.externalDispatchPerformed,
    validation: result.validation,
    jiraIssueKey: result.jiraIssueKey ?? null,
    jiraUrl: result.jiraUrl ?? null,
    jiraCommentId: result.jiraCommentId ?? null,
    jiraLinkResult: result.jiraLinkResult ?? null,
    jiraTransitionResult: result.jiraTransitionResult ?? null,
    failureReason: result.failureReason ?? null,
    httpStatus: result.httpStatus ?? null,
    response: result.response ?? null,
  };
}
