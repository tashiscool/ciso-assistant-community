import { requireRootAdminAccess } from '../../authorization';
import type { WorkerRequestContext } from '../../router';
import type { EnvBindings } from '../../types/env';

type ArtifactPublicationState = 'working' | 'published' | 'superseded' | 'withdrawn';
type ArtifactGenerationSource = 'manual' | 'package_publication' | 'scheduled';
type AudienceMode = 'public' | 'portal' | 'admin';
type FedrampMessageStatus = 'draft' | 'queued' | 'partially_delivered' | 'delivered' | 'cancelled';
type FedrampDeliveryStatus = 'queued' | 'delivery_pending' | 'delivered' | 'failed' | 'acknowledged' | 'expired';
type FedrampReportStatus = 'not_required' | 'queued' | 'confirmed' | 'failed';

export class FedrampHttpError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown> | null;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> | null = null) {
    super(message);
    this.name = 'FedrampHttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type OfferingRow = {
  id: string;
  tenant_id: string;
  slug: string;
  name: string;
  description: string | null;
  fedramp_id: string | null;
  marketplace_url: string | null;
  service_model: string | null;
  deployment_model: string | null;
  business_category: string | null;
  uei: string | null;
  contact_email: string | null;
  support_email: string | null;
  trust_center_url: string | null;
  access_guidance: string | null;
  availability_status: string;
  recent_disruption_summary: string | null;
  next_oar_due_on: string | null;
  next_quarterly_review_on: string | null;
  metadata_json: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type ServiceRow = {
  id: string;
  offering_id: string;
  tenant_id: string;
  name: string;
  service_slug: string;
  description: string | null;
  security_objectives_json: string;
  customer_responsibilities_json: string;
  secure_configuration_summary: string | null;
  in_scope: number;
  tags_json: string;
  created_at: string;
  updated_at: string;
};

type ArtifactRow = {
  id: string;
  offering_id: string;
  service_id: string | null;
  tenant_id: string;
  artifact_kind: string;
  audience: string;
  title: string;
  version_label: string;
  summary: string | null;
  status: string;
  is_public: number;
  is_machine_readable: number;
  object_key: string | null;
  content_type: string;
  sha256: string | null;
  metadata_json: string;
  published_at: string | null;
  publication_state: ArtifactPublicationState;
  generation_source: ArtifactGenerationSource;
  superseded_by_artifact_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type CountRow = {
  total_count: number;
};

type TimestampCountRow = CountRow & {
  latest_at: string | null;
};

type GrantRow = {
  id: string;
  offering_id: string;
  tenant_id: string;
  agency_name: string;
  contact_name: string | null;
  contact_email: string;
  grant_type: string;
  status: string;
  token_hint: string | null;
  issued_at: string;
  expires_at: string | null;
  last_accessed_at: string | null;
  metadata_json: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  offering_id: string;
  tenant_id: string;
  message_type: string;
  criticality: string;
  subject: string;
  body_markdown: string;
  status: string;
  required_actions_json: string;
  due_at: string | null;
  metadata_json: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type DeliveryRow = {
  id: string;
  tenant_id: string;
  message_id: string;
  contact_id: string | null;
  channel: string;
  recipient_email: string;
  delivery_status: string;
  escalation_due_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  delivery_log_json: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
  confirmation_method: string | null;
  created_at: string;
  updated_at: string;
};

type ContactRow = {
  id: string;
  offering_id: string;
  tenant_id: string;
  agency_name: string;
  contact_name: string;
  contact_email: string;
  role: string;
  incident_email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type IncidentRow = {
  id: string;
  offering_id: string;
  tenant_id: string;
  message_id: string | null;
  incident_title: string;
  incident_state: string;
  reported_to_fedramp_at: string | null;
  reported_to_cisa_at: string | null;
  agency_notified_at: string | null;
  final_report_due_at: string | null;
  update_cadence_hours: number;
  fedramp_report_status: FedrampReportStatus;
  cisa_report_status: FedrampReportStatus;
  agency_report_status: FedrampReportStatus;
  summary_json: string;
  created_at: string;
  updated_at: string;
};

type VdrEvaluationRow = {
  id: string;
  offering_id: string;
  tenant_id: string;
  source_type: string;
  source_record_id: string;
  source_control_id: string | null;
  title: string;
  detection_source: string;
  detected_at: string;
  evaluated_at: string;
  internet_reachable: number;
  likely_exploitable: number;
  adverse_impact: string;
  accepted_vulnerability: number;
  accepted_reason: string | null;
  overdue: number;
  current_status: string;
  next_target_date: string | null;
  remediation_summary: string | null;
  details_json: string;
  created_at: string;
  updated_at: string;
};

type VdrReportRow = {
  id: string;
  offering_id: string;
  tenant_id: string;
  report_month: string;
  title: string;
  report_markdown: string;
  report_json: string;
  artifact_version_id: string | null;
  status: string;
  published_at: string | null;
  publication_state: ArtifactPublicationState;
  generation_source: ArtifactGenerationSource;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type OarCycleRow = {
  id: string;
  offering_id: string;
  tenant_id: string;
  cycle_label: string;
  period_start: string;
  period_end: string;
  next_report_due_on: string;
  target_review_on: string | null;
  feedback_channel: string | null;
  status: string;
  report_markdown: string;
  feedback_addendum_markdown: string;
  summary_json: string;
  artifact_version_id: string | null;
  publication_state: ArtifactPublicationState;
  generation_source: ArtifactGenerationSource;
  source_package_job_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type QuarterlyReviewRow = {
  id: string;
  offering_id: string;
  tenant_id: string;
  oar_cycle_id: string | null;
  title: string;
  scheduled_for: string;
  registration_url: string | null;
  calendar_ics: string | null;
  recording_url: string | null;
  transcript_url: string | null;
  status: string;
  summary_json: string;
  publication_state: ArtifactPublicationState;
  generation_source: ArtifactGenerationSource;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type FeedbackItemRow = {
  id: string;
  tenant_id: string;
  oar_cycle_id: string | null;
  quarterly_review_id: string | null;
  submitted_by: string | null;
  submitted_email: string | null;
  question: string;
  response: string | null;
  status: string;
  is_anonymized: number;
  created_at: string;
  updated_at: string;
};

type SignificantChangeRow = {
  id: string;
  offering_id: string;
  tenant_id: string;
  title: string;
  change_type: string;
  status: string;
  description: string;
  reason: string | null;
  customer_impact: string | null;
  plan_timeline: string | null;
  impact_analysis: string | null;
  approver_name: string | null;
  approver_title: string | null;
  planned_start_on: string | null;
  finished_on: string | null;
  verified_on: string | null;
  verification_summary: string | null;
  poam_refs_json: string;
  artifact_version_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type SignificantChangeNoticeRow = {
  id: string;
  tenant_id: string;
  significant_change_id: string;
  notice_kind: string;
  due_on: string | null;
  sent_at: string | null;
  status: string;
  payload_json: string;
  created_at: string;
  updated_at: string;
};

type GuideRow = {
  id: string;
  offering_id: string;
  tenant_id: string;
  title: string;
  summary: string | null;
  guide_markdown: string;
  machine_json: string;
  access_instructions: string | null;
  current_settings_json: string;
  artifact_version_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type SecureDefaultReleaseRow = {
  id: string;
  tenant_id: string;
  guide_id: string;
  version_label: string;
  defaults_json: string;
  release_notes: string | null;
  released_at: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type ScopeDocumentRow = {
  id: string;
  offering_id: string;
  tenant_id: string;
  title: string;
  status: string;
  narrative_markdown: string;
  metadata_json: string;
  artifact_version_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type ResourceFlowRow = {
  id: string;
  tenant_id: string;
  scope_document_id: string;
  resource_name: string;
  resource_type: string;
  security_objectives_json: string;
  handles_federal_data: number;
  metadata_in_scope: number;
  flow_summary: string | null;
  upstream_resources_json: string;
  downstream_resources_json: string;
  created_at: string;
  updated_at: string;
};

type ThirdPartyResourceRow = {
  id: string;
  tenant_id: string;
  scope_document_id: string;
  name: string;
  provider: string | null;
  usage_summary: string | null;
  justification: string | null;
  mitigations_json: string;
  compensating_controls_json: string;
  created_at: string;
  updated_at: string;
};

type CryptoModuleRow = {
  id: string;
  offering_id: string;
  service_id: string | null;
  tenant_id: string;
  service_name: string;
  module_name: string;
  module_version: string | null;
  cmvp_certificate: string | null;
  validation_status: string;
  validation_provenance: string | null;
  update_stream: string | null;
  protects_federal_data: number;
  tenant_default_enabled: number;
  notes: string | null;
  artifact_version_id: string | null;
  created_at: string;
  updated_at: string;
};

type TenantRow = {
  id: string;
  slug: string;
  name: string;
};

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
};

type PackageRow = {
  id: string;
  file_name: string;
  artifact_key: string | null;
  manifest_key: string | null;
  coverage_json: string;
  source_record: string | null;
  created_at: string;
  updated_at: string;
};

type GrcEvaluationSourceRow = {
  evaluation_id: string;
  control_framework: string;
  control_id: string;
  title: string | null;
  message: string | null;
  remediation_summary: string | null;
  status: string;
  severity: string | null;
  finding_source: string;
  collected_at: string;
  evidence_refs_json: string;
};

type BiaSignalRow = {
  id: string;
  name: string;
  description: string | null;
  perimeter_name: string | null;
  asset_assessments_json: string;
};

type BreachSignalRow = {
  id: string;
  name: string;
  discovered_on: string;
  status: string;
  authority_notified_on: string | null;
  subjects_notified_on: string | null;
};

type ConnectorSignalRow = {
  id: string;
  name: string;
  provider: string;
  category: string;
  status: string;
  capabilities_json: string;
};

type EvidenceSourceSignalRow = {
  id: string;
  name: string;
  provider: string;
  config_json: string;
};

type ScopePerimeterSignalRow = {
  id: string;
  name: string;
  description: string | null;
  lc_status: string;
};

type ScopeSolutionSignalRow = {
  id: string;
  solution_name: string;
  solution_description: string | null;
  provider_name: string;
  dora_ict_service_type: string | null;
  asset_refs_json: string;
};

type SsoSignalRow = {
  provider_type: string;
  domain_hint: string | null;
  client_id: string | null;
  callback_url: string | null;
  metadata_url: string | null;
  login_enforced: number;
};

type MfaSignalRow = {
  enforcement: string;
  methods_json: string;
  target_coverage: number;
};

type LocalLoginSignalRow = {
  total_count: number;
};

type PublishArtifactLink = {
  artifactKind: string;
  artifactId: string;
  title: string;
  versionLabel: string;
  route?: string;
};

type ArtifactReference = PublishArtifactLink & {
  publicationState: ArtifactPublicationState;
  generationSource: ArtifactGenerationSource;
};

function buildTrustCenterPublicManifestRoute(tenantSlug: string): string {
  return `/_api/trust-center/public?tenantSlug=${encodeURIComponent(tenantSlug)}`;
}

function buildTrustCenterArtifactRoute(
  artifactId: string,
  options: {
    grantId?: string | null;
    portalToken?: string | null;
  } = {},
): string {
  const baseRoute = `/_api/trust-center/artifacts/${encodeURIComponent(artifactId)}`;
  const search = new URLSearchParams();
  if (options.grantId?.trim()) {
    search.set('grantId', options.grantId.trim());
  }
  if (options.portalToken?.trim()) {
    search.set('token', options.portalToken.trim());
  }
  const query = search.toString();
  return query ? `${baseRoute}?${query}` : baseRoute;
}

export type FedrampAdminContext = {
  tenantId: string;
  userId: string;
  rootFolderId: string;
  permissions: string[];
};

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

function nowIso() {
  return new Date().toISOString();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function quarterLabel(date = new Date()) {
  const month = date.getUTCMonth();
  const quarter = Math.floor(month / 3) + 1;
  return `${date.getUTCFullYear()}-Q${quarter}`;
}

function addDays(dateIso: string, days: number) {
  const date = new Date(dateIso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function sameCalendarMonth(leftIso: string, rightIso: string) {
  return leftIso.slice(0, 7) === rightIso.slice(0, 7);
}

function isFedrampAdminContext(value: unknown): value is FedrampAdminContext {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'tenantId' in value &&
      'userId' in value &&
      'rootFolderId' in value,
  );
}

function fedrampError(
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> | null = null,
): never {
  throw new FedrampHttpError(status, code, message, details);
}

function severityToImpact(value: string | null | undefined) {
  switch ((value ?? '').toLowerCase()) {
    case 'critical':
      return 'N5';
    case 'high':
      return 'N4';
    case 'medium':
      return 'N3';
    case 'low':
      return 'N2';
    default:
      return 'N1';
  }
}

function likelyExploitableFromSignal(input: string) {
  return /(critical|high|exploit|credential|public|internet|exposure|unauthorized|remote)/i.test(input);
}

function internetReachableFromSignal(input: string) {
  return /(public|internet|external|load balancer|edge|http|https|egress|ingress)/i.test(input);
}

function summarizeArtifactKind(kind: string) {
  switch (kind) {
    case 'service_list':
      return 'Service catalog and security-objective inventory.';
    case 'assurance_package':
      return 'FedRAMP package generated from the assurance engine.';
    case 'vdr_report':
      return 'Monthly vulnerability detection and response report.';
    case 'oar':
      return 'Ongoing Authorization Report cycle publication.';
    case 'scn_history':
      return 'Significant change history and notices.';
    case 'secure_configuration_guide':
      return 'Secure configuration guidance and defaults.';
    case 'scope_document':
      return 'Minimum assessment scope narrative and flow inventory.';
    case 'scope_summary':
      return 'Sanitized public minimum assessment scope summary.';
    case 'crypto_inventory':
      return 'Cryptographic module inventory and tenant crypto posture.';
    default:
      return 'FedRAMP authorization artifact.';
  }
}

function determineMessageStatus(deliveries: DeliveryRow[]): FedrampMessageStatus {
  if (deliveries.length === 0) {
    return 'draft';
  }

  const states = new Set(deliveries.map((item) => item.delivery_status));
  if (states.size === 1 && states.has('queued')) {
    return 'queued';
  }
  if ([...states].every((state) => state === 'delivered' || state === 'acknowledged')) {
    return 'delivered';
  }
  if (states.has('failed') && !states.has('delivered') && !states.has('acknowledged')) {
    return 'cancelled';
  }
  return 'partially_delivered';
}

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function putJsonArtifact(
  env: EnvBindings,
  objectKey: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const body = JSON.stringify(payload, null, 2);
  await env.R2_EVIDENCE.put(objectKey, body, {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
    },
  });
  return sha256Hex(body);
}

async function getJsonArtifact<T>(env: EnvBindings, objectKey: string | null | undefined): Promise<T | null> {
  if (!objectKey) {
    return null;
  }
  const object = await env.R2_EVIDENCE.get(objectKey);
  if (!object) {
    return null;
  }
  return (await object.json()) as T;
}

function normalizeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function buildSettingDiff(
  current: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Array<{ path: string; current: unknown; recommended: unknown }> {
  const paths = new Set([...Object.keys(current), ...Object.keys(defaults)]);
  const diffs: Array<{ path: string; current: unknown; recommended: unknown }> = [];
  for (const key of [...paths].sort((left, right) => left.localeCompare(right))) {
    const currentValue = current[key];
    const defaultValue = defaults[key];
    if (JSON.stringify(currentValue) !== JSON.stringify(defaultValue)) {
      diffs.push({
        path: key,
        current: currentValue,
        recommended: defaultValue,
      });
    }
  }
  return diffs;
}

function buildQuarterlyReviewIcs(args: { title: string; scheduledFor: string; description: string }) {
  const start = new Date(args.scheduledFor);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const dtStamp = nowIso().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const format = (value: Date) => value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Regovise//FedRAMP Quarterly Review//EN',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${format(start)}`,
    `DTEND:${format(end)}`,
    `SUMMARY:${args.title}`,
    `DESCRIPTION:${args.description.replace(/\n/g, '\\n')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

async function loadTenant(env: EnvBindings, tenantId: string) {
  return env.D1_MAIN.prepare(
    `
    SELECT id, slug, name
    FROM tenants
    WHERE id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<TenantRow>();
}

async function loadUser(env: EnvBindings, tenantId: string, userId: string) {
  return env.D1_MAIN.prepare(
    `
    SELECT id, email, display_name
    FROM users
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, userId)
    .first<UserRow>();
}

async function loadOfferingRow(env: EnvBindings, tenantId: string) {
  return env.D1_MAIN.prepare(
    `
    SELECT *
    FROM trust_center_offerings
    WHERE tenant_id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<OfferingRow>();
}

export async function requireFedrampAdmin(ctx: WorkerRequestContext) {
  const access = await requireRootAdminAccess(
    ctx,
    'Tenant administrator access is required for FedRAMP provider operations.',
  );
  if (access instanceof Response) {
    return access;
  }
  return access as FedrampAdminContext;
}

export async function ensureTrustCenterOffering(
  env: EnvBindings,
  tenantId: string,
  userId: string,
): Promise<OfferingRow> {
  const existing = await loadOfferingRow(env, tenantId);
  if (existing) {
    return existing;
  }

  const [tenant, user] = await Promise.all([loadTenant(env, tenantId), loadUser(env, tenantId, userId)]);
  if (!tenant) {
    fedrampError(404, 'tenant_not_found', 'Unable to seed the trust center offering because the tenant does not exist.');
  }

  const createdAt = nowIso();
  const offering: OfferingRow = {
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    slug: slugify(tenant.slug || tenant.name || 'offering'),
    name: `${tenant.name} Cloud Service Offering`,
    description:
      'Primary FedRAMP cloud service offering boundary managed in Regovise, including authorization data, ongoing monitoring, and provider-process artifacts.',
    fedramp_id: null,
    marketplace_url: null,
    service_model: 'SaaS',
    deployment_model: 'Single Tenant',
    business_category: 'Cybersecurity and compliance operations',
    uei: null,
    contact_email: user?.email ?? null,
    support_email: user?.email ?? null,
    trust_center_url: null,
    access_guidance:
      'Use the Regovise trust center public manifest for public materials and agency portal grants for necessary-party access.',
    availability_status: 'operational',
    recent_disruption_summary: null,
    next_oar_due_on: addDays(createdAt, 90),
    next_quarterly_review_on: addDays(createdAt, 97),
    metadata_json: JSON.stringify({
      createdFrom: 'fedramp-provider-shell',
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
    }),
    created_by_user_id: userId,
    created_at: createdAt,
    updated_at: createdAt,
  };

  await env.D1_MAIN.prepare(
    `
    INSERT INTO trust_center_offerings (
      id, tenant_id, slug, name, description, fedramp_id, marketplace_url, service_model, deployment_model,
      business_category, uei, contact_email, support_email, trust_center_url, access_guidance, availability_status,
      recent_disruption_summary, next_oar_due_on, next_quarterly_review_on, metadata_json, created_by_user_id,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      offering.id,
      offering.tenant_id,
      offering.slug,
      offering.name,
      offering.description,
      offering.fedramp_id,
      offering.marketplace_url,
      offering.service_model,
      offering.deployment_model,
      offering.business_category,
      offering.uei,
      offering.contact_email,
      offering.support_email,
      offering.trust_center_url,
      offering.access_guidance,
      offering.availability_status,
      offering.recent_disruption_summary,
      offering.next_oar_due_on,
      offering.next_quarterly_review_on,
      offering.metadata_json,
      offering.created_by_user_id,
      offering.created_at,
      offering.updated_at,
    )
    .run();

  return offering;
}

export async function ensureDefaultTrustCenterService(
  env: EnvBindings,
  offering: OfferingRow,
): Promise<ServiceRow> {
  const existing = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM trust_center_services
    WHERE offering_id = ?
    ORDER BY updated_at DESC
    LIMIT 1
    `,
  )
    .bind(offering.id)
    .first<ServiceRow>();

  if (existing) {
    return existing;
  }

  const createdAt = nowIso();
  const service: ServiceRow = {
    id: crypto.randomUUID(),
    offering_id: offering.id,
    tenant_id: offering.tenant_id,
    name: `${offering.name} Core Platform`,
    service_slug: 'core-platform',
    description:
      'Primary in-scope service boundary for the offering, covering hosted compliance operations workflows, assurance packages, and tenant administration.',
    security_objectives_json: JSON.stringify(['confidentiality', 'integrity', 'availability']),
    customer_responsibilities_json: JSON.stringify([
      'Maintain administrative account hygiene.',
      'Review ongoing authorization reports and vulnerability reports.',
      'Configure tenant integrations, domains, and secure defaults.',
    ]),
    secure_configuration_summary:
      'Use enterprise identity, review local fallback posture, and align tenant settings to the published secure defaults before onboarding agency workloads.',
    in_scope: 1,
    tags_json: JSON.stringify(['fedramp-20x', 'trust-center', 'regovise']),
    created_at: createdAt,
    updated_at: createdAt,
  };

  await env.D1_MAIN.prepare(
    `
    INSERT INTO trust_center_services (
      id, offering_id, tenant_id, name, service_slug, description, security_objectives_json,
      customer_responsibilities_json, secure_configuration_summary, in_scope, tags_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      service.id,
      service.offering_id,
      service.tenant_id,
      service.name,
      service.service_slug,
      service.description,
      service.security_objectives_json,
      service.customer_responsibilities_json,
      service.secure_configuration_summary,
      service.in_scope,
      service.tags_json,
      service.created_at,
      service.updated_at,
    )
    .run();

  return service;
}

async function deriveCurrentSecureConfigSnapshot(env: EnvBindings, tenantId: string) {
  const [ssoRow, mfaRow, localLoginRow, connectorCount, evidenceSourceCount] = await Promise.all([
    env.D1_MAIN.prepare(
      `
      SELECT provider_type, domain_hint, client_id, callback_url, metadata_url, login_enforced
      FROM setup_sso_configs
      WHERE tenant_id = ?
      LIMIT 1
      `,
    )
      .bind(tenantId)
      .first<SsoSignalRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT enforcement, methods_json, target_coverage
      FROM setup_mfa_policies
      WHERE tenant_id = ?
      LIMIT 1
      `,
    )
      .bind(tenantId)
      .first<MfaSignalRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT COUNT(*) AS total_count
      FROM users
      WHERE tenant_id = ? AND is_active = 1
      `,
    )
      .bind(tenantId)
      .first<LocalLoginSignalRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT COUNT(*) AS total_count
      FROM integration_connectors
      WHERE tenant_id = ? AND is_enabled = 1
      `,
    )
      .bind(tenantId)
      .first<CountRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT COUNT(*) AS total_count
      FROM evidence_sources
      WHERE tenant_id = ? AND is_active = 1
      `,
    )
      .bind(tenantId)
      .first<CountRow>(),
  ]);

  return {
    identity: {
      ssoConfigured: Boolean(ssoRow?.client_id?.trim() && ssoRow?.metadata_url?.trim() && ssoRow?.callback_url?.trim()),
      ssoProvider: ssoRow?.provider_type ?? null,
      ssoDomainHint: ssoRow?.domain_hint ?? null,
      loginEnforced: ssoRow?.login_enforced === 1,
      localUserCount: Number(localLoginRow?.total_count ?? 0),
    },
    mfa: {
      enforcement: mfaRow?.enforcement ?? 'Optional',
      methods: asJson<Record<string, boolean>>(mfaRow?.methods_json, {}),
      targetCoverage: Number(mfaRow?.target_coverage ?? 0),
    },
    integrations: {
      enabledConnectorCount: Number(connectorCount?.total_count ?? 0),
      activeEvidenceSourceCount: Number(evidenceSourceCount?.total_count ?? 0),
    },
  } satisfies Record<string, unknown>;
}

async function ensureBaselineSecureConfigGuide(
  env: EnvBindings,
  offering: OfferingRow,
  userId: string,
) {
  const existing = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM secure_config_guides
    WHERE tenant_id = ?
    ORDER BY updated_at DESC
    LIMIT 1
    `,
  )
    .bind(offering.tenant_id)
    .first<GuideRow>();

  if (existing) {
    return existing;
  }

  const currentSettings = await deriveCurrentSecureConfigSnapshot(env, offering.tenant_id);
  const createdAt = nowIso();
  const markdown = [
    '# Secure Configuration Guide',
    '',
    'This guide captures the current tenant security posture and the recommended secure defaults for top-level administrative access, identity, monitoring, and integrations.',
    '',
    '## Administrative access',
    '- Use enterprise identity where possible and limit local fallback to break-glass or staged rollout scenarios.',
    '- Review workspace team, permission, and domain scoping before onboarding agency workloads.',
    '',
    '## Monitoring and evidence',
    '- Configure evidence collectors, connectors, and monitoring profiles before claiming continuous monitoring readiness.',
    '- Review assurance packages, VDR reporting, and OAR publications on a standing cadence.',
  ].join('\n');

  const guideId = crypto.randomUUID();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO secure_config_guides (
      id, offering_id, tenant_id, title, summary, guide_markdown, machine_json, access_instructions,
      current_settings_json, created_by_user_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      guideId,
      offering.id,
      offering.tenant_id,
      'Regovise Secure Configuration Guide',
      'Recommended secure defaults for tenant identity, monitoring, and evidence posture.',
      markdown,
      JSON.stringify({
        recommendedDefaults: {
          ssoRequired: true,
          mfaRequired: true,
          connectorReviewCadenceDays: 30,
          evidenceSourceFreshnessDays: 7,
        },
      }),
      'Open the trust center or use the machine-readable guide artifact to compare current settings to the recommended secure defaults.',
      JSON.stringify(currentSettings),
      userId,
      createdAt,
      createdAt,
    )
    .run();

  return env.D1_MAIN.prepare(
    `
    SELECT *
    FROM secure_config_guides
    WHERE id = ?
    LIMIT 1
    `,
  )
    .bind(guideId)
    .first<GuideRow>() as Promise<GuideRow>;
}

async function ensureBaselineScopeDocument(
  env: EnvBindings,
  offering: OfferingRow,
  userId: string,
) {
  const existing = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM scope_documents
    WHERE tenant_id = ?
    ORDER BY updated_at DESC
    LIMIT 1
    `,
  )
    .bind(offering.tenant_id)
    .first<ScopeDocumentRow>();

  if (existing) {
    return existing;
  }

  const [biais, breaches, connectors, sources] = await Promise.all([
    env.D1_MAIN.prepare(
      `
      SELECT bia.id, bia.name, bia.description, perimeter.name AS perimeter_name, bia.asset_assessments_json
      FROM business_impact_analyses AS bia
      LEFT JOIN perimeters AS perimeter
        ON perimeter.id = bia.perimeter_id
      WHERE bia.tenant_id = ?
      ORDER BY bia.updated_at DESC
      LIMIT 8
      `,
    )
      .bind(offering.tenant_id)
      .all<BiaSignalRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT id, name, discovered_on, status, authority_notified_on, subjects_notified_on
      FROM data_breaches
      WHERE tenant_id = ?
      ORDER BY updated_at DESC
      LIMIT 6
      `,
    )
      .bind(offering.tenant_id)
      .all<BreachSignalRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT id, name, provider, category, status, capabilities_json
      FROM integration_connectors
      WHERE tenant_id = ?
      ORDER BY updated_at DESC
      LIMIT 10
      `,
    )
      .bind(offering.tenant_id)
      .all<ConnectorSignalRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT id, name, provider, config_json
      FROM evidence_sources
      WHERE tenant_id = ?
      ORDER BY updated_at DESC
      LIMIT 10
      `,
    )
      .bind(offering.tenant_id)
      .all<EvidenceSourceSignalRow>(),
  ]);

  const createdAt = nowIso();
  const scopeId = crypto.randomUUID();
  const scopeMarkdown = [
    '# Minimum Assessment Scope',
    '',
    'This scope document captures the in-scope information resources, supporting third-party dependencies, and the high-level information flows required to operate the Regovise offering boundary.',
    '',
    `- Business impact analyses in scope: ${biais.results.length}`,
    `- Active connectors considered for scope review: ${connectors.results.length}`,
    `- Active evidence sources considered for scope review: ${sources.results.length}`,
    `- Recent breach records reviewed for incident impact context: ${breaches.results.length}`,
  ].join('\n');

  await env.D1_MAIN.prepare(
    `
    INSERT INTO scope_documents (
      id, offering_id, tenant_id, title, status, narrative_markdown, metadata_json, created_by_user_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      scopeId,
      offering.id,
      offering.tenant_id,
      'Regovise Minimum Assessment Scope',
      'draft',
      scopeMarkdown,
      JSON.stringify({
        source: 'baseline-seed',
        biaIds: biais.results.map((item) => item.id),
        connectorIds: connectors.results.map((item) => item.id),
        evidenceSourceIds: sources.results.map((item) => item.id),
      }),
      userId,
      createdAt,
      createdAt,
    )
    .run();

  const defaultFlows = [
    {
      resourceName: 'Regovise application tier',
      resourceType: 'application',
      securityObjectives: ['confidentiality', 'integrity', 'availability'],
      handlesFederalData: true,
      metadataInScope: true,
      flowSummary: 'Receives tenant administrative actions, evidence workflows, and authorization artifact generation traffic.',
      upstreamResources: ['Agency administrators', 'Enterprise identity provider'],
      downstreamResources: ['Evidence collectors', 'Reporting and package artifacts'],
    },
    {
      resourceName: 'Evidence collection pipeline',
      resourceType: 'automation',
      securityObjectives: ['integrity', 'availability'],
      handlesFederalData: true,
      metadataInScope: true,
      flowSummary: 'Collects security telemetry and evidence snapshots used for ongoing authorization and VDR reporting.',
      upstreamResources: sources.results.map((item) => item.name),
      downstreamResources: ['Assurance package engine', 'Trust center artifacts'],
    },
  ];

  for (const flow of defaultFlows) {
    await env.D1_MAIN.prepare(
      `
      INSERT INTO resource_flows (
        id, tenant_id, scope_document_id, resource_name, resource_type, security_objectives_json,
        handles_federal_data, metadata_in_scope, flow_summary, upstream_resources_json, downstream_resources_json,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        crypto.randomUUID(),
        offering.tenant_id,
        scopeId,
        flow.resourceName,
        flow.resourceType,
        JSON.stringify(flow.securityObjectives),
        flow.handlesFederalData ? 1 : 0,
        flow.metadataInScope ? 1 : 0,
        flow.flowSummary,
        JSON.stringify(flow.upstreamResources),
        JSON.stringify(flow.downstreamResources),
        createdAt,
        createdAt,
      )
      .run();
  }

  for (const connector of connectors.results.slice(0, 4)) {
    await env.D1_MAIN.prepare(
      `
      INSERT INTO third_party_resources (
        id, tenant_id, scope_document_id, name, provider, usage_summary, justification, mitigations_json,
        compensating_controls_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        crypto.randomUUID(),
        offering.tenant_id,
        scopeId,
        connector.name,
        connector.provider,
        `${connector.category} connector used to coordinate provider workflows or external evidence.`,
        'Required to integrate the provider operating boundary with upstream monitoring, ticketing, or collaboration systems.',
        JSON.stringify(['Restrict connector scopes', 'Review connector last-test status', 'Audit service-account ownership']),
        JSON.stringify(['Fallback manual export path', 'Tenant-admin approval on connector changes']),
        createdAt,
        createdAt,
      )
      .run();
  }

  return env.D1_MAIN.prepare(
    `
    SELECT *
    FROM scope_documents
    WHERE id = ?
    LIMIT 1
    `,
  )
    .bind(scopeId)
    .first<ScopeDocumentRow>() as Promise<ScopeDocumentRow>;
}

export async function seedFedrampBaselines(
  env: EnvBindings,
  tenantId: string,
  userId: string,
) {
  const offering = await ensureTrustCenterOffering(env, tenantId, userId);
  const defaultService = await ensureDefaultTrustCenterService(env, offering);
  const guide = await ensureBaselineSecureConfigGuide(env, offering, userId);
  const scope = await ensureBaselineScopeDocument(env, offering, userId);
  return { offering, defaultService, guide, scope };
}

export async function upsertTrustCenterOffering(
  env: EnvBindings,
  tenantId: string,
  userId: string,
  input: Partial<{
    slug: string;
    name: string;
    description: string | null;
    fedrampId: string | null;
    marketplaceUrl: string | null;
    serviceModel: string | null;
    deploymentModel: string | null;
    businessCategory: string | null;
    uei: string | null;
    contactEmail: string | null;
    supportEmail: string | null;
    trustCenterUrl: string | null;
    accessGuidance: string | null;
    availabilityStatus: string | null;
    recentDisruptionSummary: string | null;
    nextOarDueOn: string | null;
    nextQuarterlyReviewOn: string | null;
    metadata: Record<string, unknown> | null;
  }>,
) {
  const current = await ensureTrustCenterOffering(env, tenantId, userId);
  const updatedAt = nowIso();
  await env.D1_MAIN.prepare(
    `
    UPDATE trust_center_offerings
    SET slug = ?, name = ?, description = ?, fedramp_id = ?, marketplace_url = ?, service_model = ?,
        deployment_model = ?, business_category = ?, uei = ?, contact_email = ?, support_email = ?,
        trust_center_url = ?, access_guidance = ?, availability_status = ?, recent_disruption_summary = ?,
        next_oar_due_on = ?, next_quarterly_review_on = ?, metadata_json = ?, updated_at = ?
    WHERE id = ?
    `,
  )
    .bind(
      input.slug?.trim() ? slugify(input.slug) : current.slug,
      input.name?.trim() || current.name,
      input.description ?? current.description,
      input.fedrampId ?? current.fedramp_id,
      input.marketplaceUrl ?? current.marketplace_url,
      input.serviceModel ?? current.service_model,
      input.deploymentModel ?? current.deployment_model,
      input.businessCategory ?? current.business_category,
      input.uei ?? current.uei,
      input.contactEmail ?? current.contact_email,
      input.supportEmail ?? current.support_email,
      input.trustCenterUrl ?? current.trust_center_url,
      input.accessGuidance ?? current.access_guidance,
      input.availabilityStatus ?? current.availability_status,
      input.recentDisruptionSummary ?? current.recent_disruption_summary,
      input.nextOarDueOn ?? current.next_oar_due_on,
      input.nextQuarterlyReviewOn ?? current.next_quarterly_review_on,
      JSON.stringify(input.metadata ?? asJson<Record<string, unknown>>(current.metadata_json, {})),
      updatedAt,
      current.id,
    )
    .run();

  return loadOfferingRow(env, tenantId);
}

export async function createTrustCenterService(
  env: EnvBindings,
  tenantId: string,
  userId: string,
  input: {
    name?: string;
    description?: string | null;
    securityObjectives?: string[];
    customerResponsibilities?: string[];
    secureConfigurationSummary?: string | null;
    serviceSlug?: string;
    inScope?: boolean;
    tags?: string[];
  },
) {
  const offering = await ensureTrustCenterOffering(env, tenantId, userId);
  const createdAt = nowIso();
  const row: ServiceRow = {
    id: crypto.randomUUID(),
    offering_id: offering.id,
    tenant_id: tenantId,
    name: input.name?.trim() || `${offering.name} Service ${createdAt.slice(0, 10)}`,
    service_slug: slugify(input.serviceSlug?.trim() || input.name?.trim() || `service-${createdAt.slice(0, 10)}`),
    description: input.description ?? null,
    security_objectives_json: JSON.stringify(input.securityObjectives ?? ['confidentiality', 'integrity', 'availability']),
    customer_responsibilities_json: JSON.stringify(input.customerResponsibilities ?? []),
    secure_configuration_summary: input.secureConfigurationSummary ?? null,
    in_scope: input.inScope === false ? 0 : 1,
    tags_json: JSON.stringify(input.tags ?? []),
    created_at: createdAt,
    updated_at: createdAt,
  };

  await env.D1_MAIN.prepare(
    `
    INSERT INTO trust_center_services (
      id, offering_id, tenant_id, name, service_slug, description, security_objectives_json,
      customer_responsibilities_json, secure_configuration_summary, in_scope, tags_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      row.id,
      row.offering_id,
      row.tenant_id,
      row.name,
      row.service_slug,
      row.description,
      row.security_objectives_json,
      row.customer_responsibilities_json,
      row.secure_configuration_summary,
      row.in_scope,
      row.tags_json,
      row.created_at,
      row.updated_at,
    )
    .run();

  return row;
}

async function recordArtifactVersion(
  env: EnvBindings,
  input: {
    tenantId: string;
    offeringId: string;
    serviceId?: string | null;
    artifactKind: string;
    title: string;
    versionLabel: string;
    summary?: string | null;
    audience?: string;
    isPublic?: boolean;
    publicationState?: ArtifactPublicationState;
    generationSource?: ArtifactGenerationSource;
    supersededByArtifactId?: string | null;
    objectPayload: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    createdByUserId?: string | null;
  },
) {
  const createdAt = nowIso();
  const artifactId = crypto.randomUUID();
  const objectKey = `trust-center/${input.tenantId}/${input.artifactKind}/${artifactId}.json`;
  const sha256 = await putJsonArtifact(env, objectKey, input.objectPayload);

  await env.D1_MAIN.prepare(
    `
    INSERT INTO artifact_versions (
      id, offering_id, service_id, tenant_id, artifact_kind, audience, title, version_label, summary, status,
      is_public, is_machine_readable, object_key, content_type, sha256, metadata_json, published_at, publication_state,
      generation_source, superseded_by_artifact_id, created_by_user_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, 1, ?, 'application/json; charset=utf-8', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      artifactId,
      input.offeringId,
      input.serviceId ?? null,
      input.tenantId,
      input.artifactKind,
      input.audience ?? 'necessary-parties',
      input.title,
      input.versionLabel,
      input.summary ?? summarizeArtifactKind(input.artifactKind),
      input.isPublic ? 1 : 0,
      objectKey,
      sha256,
      JSON.stringify(input.metadata ?? {}),
      input.publicationState === 'published' ? createdAt : null,
      input.publicationState ?? 'published',
      input.generationSource ?? 'manual',
      input.supersededByArtifactId ?? null,
      input.createdByUserId ?? null,
      createdAt,
      createdAt,
    )
    .run();

  return env.D1_MAIN.prepare(
    `
    SELECT *
    FROM artifact_versions
    WHERE id = ?
    LIMIT 1
    `,
  )
    .bind(artifactId)
    .first<ArtifactRow>() as Promise<ArtifactRow>;
}

async function supersedeArtifactVersions(
  env: EnvBindings,
  input: {
    tenantId: string;
    artifactKind: string;
    currentArtifactId: string;
    versionLabel?: string | null;
  },
) {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT id
    FROM artifact_versions
    WHERE tenant_id = ?
      AND artifact_kind = ?
      AND publication_state = 'published'
      AND id != ?
      ${input.versionLabel ? 'AND version_label = ?' : ''}
    `,
  )
    .bind(
      input.tenantId,
      input.artifactKind,
      input.currentArtifactId,
      ...(input.versionLabel ? [input.versionLabel] : []),
    )
    .all<{ id: string }>();

  if (!rows.results.length) {
    return;
  }

  const updatedAt = nowIso();
  for (const row of rows.results) {
    await env.D1_MAIN.prepare(
      `
      UPDATE artifact_versions
      SET publication_state = 'superseded', superseded_by_artifact_id = ?, updated_at = ?
      WHERE id = ?
      `,
    )
      .bind(input.currentArtifactId, updatedAt, row.id)
      .run();
  }
}

async function loadArtifactRow(env: EnvBindings, artifactId: string) {
  return env.D1_MAIN.prepare(`SELECT * FROM artifact_versions WHERE id = ? LIMIT 1`).bind(artifactId).first<ArtifactRow>();
}

async function promoteArtifactVersion(
  env: EnvBindings,
  input: {
    artifactId: string;
    tenantId: string;
    artifactKind: string;
    versionLabel?: string | null;
  },
) {
  const artifact = await loadArtifactRow(env, input.artifactId);
  if (!artifact || artifact.tenant_id !== input.tenantId) {
    fedrampError(404, 'artifact_not_found', 'The requested FedRAMP artifact does not exist.');
  }

  const publishedAt = nowIso();
  await env.D1_MAIN.prepare(
    `
    UPDATE artifact_versions
    SET publication_state = 'published', superseded_by_artifact_id = NULL, published_at = COALESCE(published_at, ?), updated_at = ?
    WHERE id = ?
    `,
  )
    .bind(publishedAt, publishedAt, input.artifactId)
    .run();

  await supersedeArtifactVersions(env, {
    tenantId: input.tenantId,
    artifactKind: input.artifactKind,
    currentArtifactId: input.artifactId,
    versionLabel: input.versionLabel ?? artifact.version_label,
  });

  return (await loadArtifactRow(env, input.artifactId)) as ArtifactRow;
}

async function publishServiceCatalogArtifact(
  env: EnvBindings,
  offering: OfferingRow,
  createdByUserId: string | null,
) {
  const services = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM trust_center_services
    WHERE offering_id = ?
    ORDER BY in_scope DESC, name ASC
    `,
  )
    .bind(offering.id)
    .all<ServiceRow>();

  const markdownLines = [
    '# Service List',
    '',
    ...services.results.map((service) => {
      const objectives = asJson<string[]>(service.security_objectives_json, []);
      return `- **${service.name}** (${service.in_scope === 1 ? 'in scope' : 'supplemental'}): ${service.description ?? 'No summary yet.'} Security objectives: ${objectives.join(', ') || 'not recorded'}.`;
    }),
  ];

  return recordArtifactVersion(env, {
    tenantId: offering.tenant_id,
    offeringId: offering.id,
    artifactKind: 'service_list',
    title: `${offering.name} Service List`,
    versionLabel: monthKey(),
    isPublic: true,
    audience: 'public',
    createdByUserId,
    objectPayload: {
      artifactKind: 'service_list',
      offering: {
        id: offering.id,
        slug: offering.slug,
        name: offering.name,
      },
      generatedAt: nowIso(),
      humanReadable: {
        markdown: markdownLines.join('\n'),
      },
      machineReadable: {
        services: services.results.map((service) => ({
          id: service.id,
          slug: service.service_slug,
          name: service.name,
          description: service.description,
          inScope: service.in_scope === 1,
          securityObjectives: asJson<string[]>(service.security_objectives_json, []),
          customerResponsibilities: asJson<string[]>(service.customer_responsibilities_json, []),
          secureConfigurationSummary: service.secure_configuration_summary,
          tags: asJson<string[]>(service.tags_json, []),
        })),
      },
    },
  });
}

export async function createTrustCenterAccessGrant(
  env: EnvBindings,
  tenantId: string,
  userId: string,
  input: {
    agencyName?: string;
    contactName?: string | null;
    contactEmail?: string;
    grantType?: string;
    expiresAt?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const offering = await ensureTrustCenterOffering(env, tenantId, userId);
  const createdAt = nowIso();
  const rawToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const row: GrantRow = {
    id: crypto.randomUUID(),
    offering_id: offering.id,
    tenant_id: tenantId,
    agency_name: input.agencyName?.trim() || 'Agency reviewer',
    contact_name: input.contactName ?? null,
    contact_email: input.contactEmail?.trim() || offering.contact_email || 'agency@example.gov',
    grant_type: input.grantType?.trim() || 'agency',
    status: 'active',
    token_hint: rawToken.slice(0, 6),
    issued_at: createdAt,
    expires_at: input.expiresAt ?? null,
    last_accessed_at: null,
    metadata_json: JSON.stringify(input.metadata ?? {}),
    created_by_user_id: userId,
    created_at: createdAt,
    updated_at: createdAt,
  };

  await env.D1_MAIN.prepare(
    `
    INSERT INTO trust_center_access_grants (
      id, offering_id, tenant_id, agency_name, contact_name, contact_email, grant_type, status, token_hash, token_hint,
      issued_at, expires_at, last_accessed_at, metadata_json, created_by_user_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      row.id,
      row.offering_id,
      row.tenant_id,
      row.agency_name,
      row.contact_name,
      row.contact_email,
      row.grant_type,
      row.status,
      await sha256Hex(rawToken),
      row.token_hint,
      row.issued_at,
      row.expires_at,
      row.last_accessed_at,
      row.metadata_json,
      row.created_by_user_id,
      row.created_at,
      row.updated_at,
    )
    .run();

  return {
    grant: row,
    portalToken: rawToken,
    portalPath: `/_api/trust-center/portal/${encodeURIComponent(row.id)}?token=${encodeURIComponent(rawToken)}`,
  };
}

async function recordAccessEvent(
  env: EnvBindings,
  input: {
    tenantId: string;
    grantId?: string | null;
    artifactVersionId?: string | null;
    eventType: string;
    actorEmail?: string | null;
    actorName?: string | null;
    requestPath?: string | null;
    userAgent?: string | null;
    summary?: Record<string, unknown>;
  },
) {
  await env.D1_MAIN.prepare(
    `
    INSERT INTO trust_center_access_events (
      id, tenant_id, grant_id, artifact_version_id, event_type, actor_email, actor_name, request_path, user_agent,
      summary_json, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      crypto.randomUUID(),
      input.tenantId,
      input.grantId ?? null,
      input.artifactVersionId ?? null,
      input.eventType,
      input.actorEmail ?? null,
      input.actorName ?? null,
      input.requestPath ?? null,
      input.userAgent ?? null,
      JSON.stringify(input.summary ?? {}),
      nowIso(),
    )
    .run();
}

async function loadLatestPackageRows(env: EnvBindings, tenantId: string, limit = 8) {
  return env.D1_MAIN.prepare(
    `
    SELECT id, file_name, artifact_key, manifest_key, coverage_json, source_record, created_at, updated_at
    FROM ai_compliance_export_jobs
    WHERE tenant_id = ? AND run_family = 'assurance_package'
    ORDER BY updated_at DESC
    LIMIT ?
    `,
  )
    .bind(tenantId, limit)
    .all<PackageRow>();
}

async function buildAssurancePackageArtifactLinks(
  env: EnvBindings,
  offering: OfferingRow,
  packageRow: PackageRow,
  createdByUserId: string | null,
) {
  const packageDoc = await getJsonArtifact<Record<string, unknown>>(env, packageRow.artifact_key);
  if (!packageDoc) {
    return null;
  }

  const artifact = await recordArtifactVersion(env, {
    tenantId: offering.tenant_id,
    offeringId: offering.id,
    artifactKind: 'assurance_package',
    title: packageRow.file_name,
    versionLabel: packageRow.updated_at.slice(0, 10),
    summary: 'FedRAMP 20x package published from the assurance engine.',
    isPublic: false,
    audience: 'necessary-parties',
    createdByUserId,
    objectPayload: {
      artifactKind: 'assurance_package',
      generatedAt: nowIso(),
      humanReadable: {
        markdown: [
          '# Assurance Package',
          '',
          `- File: ${packageRow.file_name}`,
          `- Package job id: ${packageRow.id}`,
          `- Source evidence job: ${packageRow.source_record ?? 'n/a'}`,
        ].join('\n'),
      },
      machineReadable: {
        packageJobId: packageRow.id,
        sourceRecord: packageRow.source_record,
        coverage: asJson<Record<string, unknown>>(packageRow.coverage_json, {}),
        packageDocument: packageDoc,
      },
    },
    metadata: {
      packageJobId: packageRow.id,
      sourceRecord: packageRow.source_record,
    },
  });

  return artifact;
}

async function upsertVulnerabilityEvaluation(
  env: EnvBindings,
  input: {
    offeringId: string;
    tenantId: string;
    sourceType: string;
    sourceRecordId: string;
    sourceControlId?: string | null;
    title: string;
    detectionSource: string;
    detectedAt: string;
    internetReachable: boolean;
    likelyExploitable: boolean;
    adverseImpact: string;
    acceptedVulnerability: boolean;
    acceptedReason?: string | null;
    currentStatus: string;
    nextTargetDate?: string | null;
    remediationSummary?: string | null;
    details: Record<string, unknown>;
  },
) {
  const existing = await env.D1_MAIN.prepare(
    `
    SELECT id
    FROM vulnerability_evaluations
    WHERE tenant_id = ? AND source_type = ? AND source_record_id = ?
    LIMIT 1
    `,
  )
    .bind(input.tenantId, input.sourceType, input.sourceRecordId)
    .first<{ id: string }>();

  const evaluatedAt = nowIso();
  const overdue = Boolean(input.nextTargetDate && new Date(input.nextTargetDate).getTime() < Date.now());

  if (existing) {
    await env.D1_MAIN.prepare(
      `
      UPDATE vulnerability_evaluations
      SET source_control_id = ?, title = ?, detection_source = ?, detected_at = ?, evaluated_at = ?,
          internet_reachable = ?, likely_exploitable = ?, adverse_impact = ?, accepted_vulnerability = ?,
          accepted_reason = ?, overdue = ?, current_status = ?, next_target_date = ?, remediation_summary = ?,
          details_json = ?, updated_at = ?
      WHERE id = ?
      `,
    )
      .bind(
        input.sourceControlId ?? null,
        input.title,
        input.detectionSource,
        input.detectedAt,
        evaluatedAt,
        input.internetReachable ? 1 : 0,
        input.likelyExploitable ? 1 : 0,
        input.adverseImpact,
        input.acceptedVulnerability ? 1 : 0,
        input.acceptedReason ?? null,
        overdue ? 1 : 0,
        input.currentStatus,
        input.nextTargetDate ?? null,
        input.remediationSummary ?? null,
        JSON.stringify(input.details),
        evaluatedAt,
        existing.id,
      )
      .run();
    return existing.id;
  }

  const id = crypto.randomUUID();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO vulnerability_evaluations (
      id, offering_id, tenant_id, source_type, source_record_id, source_control_id, title, detection_source,
      detected_at, evaluated_at, internet_reachable, likely_exploitable, adverse_impact, accepted_vulnerability,
      accepted_reason, overdue, current_status, next_target_date, remediation_summary, details_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      id,
      input.offeringId,
      input.tenantId,
      input.sourceType,
      input.sourceRecordId,
      input.sourceControlId ?? null,
      input.title,
      input.detectionSource,
      input.detectedAt,
      evaluatedAt,
      input.internetReachable ? 1 : 0,
      input.likelyExploitable ? 1 : 0,
      input.adverseImpact,
      input.acceptedVulnerability ? 1 : 0,
      input.acceptedReason ?? null,
      overdue ? 1 : 0,
      input.currentStatus,
      input.nextTargetDate ?? null,
      input.remediationSummary ?? null,
      JSON.stringify(input.details),
      evaluatedAt,
      evaluatedAt,
    )
    .run();
  return id;
}

export async function syncVulnerabilityEvaluations(
  env: EnvBindings,
  tenantId: string,
  userId: string,
) {
  const offering = await ensureTrustCenterOffering(env, tenantId, userId);
  const grcRows = await env.D1_MAIN.prepare(
    `
    SELECT
      evaluation.id AS evaluation_id,
      evaluation.control_framework,
      evaluation.control_id,
      evaluation.title,
      evaluation.message,
      evaluation.remediation_summary,
      evaluation.status,
      evaluation.severity,
      finding.source AS finding_source,
      finding.collected_at,
      evaluation.evidence_refs_json
    FROM grc_finding_evaluations AS evaluation
    INNER JOIN grc_findings AS finding
      ON finding.id = evaluation.finding_id
    WHERE evaluation.tenant_id = ? AND finding.tenant_id = ?
    ORDER BY finding.collected_at DESC
    LIMIT 250
    `,
  )
    .bind(tenantId, tenantId)
    .all<GrcEvaluationSourceRow>();

  let syncedCount = 0;
  for (const row of grcRows.results) {
    const signal = [row.title, row.message, row.remediation_summary, row.status, row.severity, row.finding_source]
      .filter(Boolean)
      .join(' ');
    await upsertVulnerabilityEvaluation(env, {
      offeringId: offering.id,
      tenantId,
      sourceType: 'grc_finding_evaluation',
      sourceRecordId: row.evaluation_id,
      sourceControlId: row.control_id,
      title: row.title?.trim() || `${row.control_framework} ${row.control_id}`,
      detectionSource: row.finding_source,
      detectedAt: row.collected_at,
      internetReachable: internetReachableFromSignal(signal),
      likelyExploitable: likelyExploitableFromSignal(signal),
      adverseImpact: severityToImpact(row.severity),
      acceptedVulnerability: false,
      currentStatus: row.status.toLowerCase() === 'pass' ? 'mitigated' : 'open',
      remediationSummary: row.remediation_summary ?? row.message ?? null,
      details: {
        controlFramework: row.control_framework,
        controlId: row.control_id,
        severity: row.severity,
        message: row.message,
        evidenceRefs: asJson<string[]>(row.evidence_refs_json, []),
      },
    });
    syncedCount += 1;
  }

  const packageRows = await loadLatestPackageRows(env, tenantId, 6);
  for (const packageRow of packageRows.results) {
    const packageDoc = await getJsonArtifact<Record<string, unknown>>(env, packageRow.artifact_key);
    const findings = Array.isArray(packageDoc?.findings) ? packageDoc.findings : [];
    const poamItems = Array.isArray(packageDoc?.poam_items) ? packageDoc.poam_items : [];
    const poamByFinding = new Map<string, Record<string, unknown>>();

    for (const poam of poamItems) {
      const poamRecord = normalizeObject(poam);
      const findingId = typeof poamRecord.finding_id === 'string' ? poamRecord.finding_id : null;
      if (findingId) {
        poamByFinding.set(findingId, poamRecord);
      }
    }

    for (const finding of findings) {
      const findingRecord = normalizeObject(finding);
      const findingId = typeof findingRecord.id === 'string' ? findingRecord.id : null;
      if (!findingId) {
        continue;
      }
      const title = typeof findingRecord.title === 'string' ? findingRecord.title : 'Assurance package finding';
      const detail = typeof findingRecord.detail === 'string' ? findingRecord.detail : '';
      const severity = typeof findingRecord.severity === 'string' ? findingRecord.severity : 'medium';
      const evalCode = typeof findingRecord.source_eval_code === 'string' ? findingRecord.source_eval_code : null;
      const poam = poamByFinding.get(findingId);
      const targetDate = typeof poam?.milestoneDueDate === 'string' ? poam.milestoneDueDate : null;
      const signal = [title, detail, severity, evalCode].filter(Boolean).join(' ');
      await upsertVulnerabilityEvaluation(env, {
        offeringId: offering.id,
        tenantId,
        sourceType: 'assurance_package_finding',
        sourceRecordId: `${packageRow.id}:${findingId}`,
        sourceControlId: evalCode,
        title,
        detectionSource: 'assurance-package',
        detectedAt: packageRow.updated_at,
        internetReachable: internetReachableFromSignal(signal),
        likelyExploitable: likelyExploitableFromSignal(signal),
        adverseImpact: severityToImpact(severity),
        acceptedVulnerability: Boolean(targetDate && new Date(targetDate).getTime() - Date.now() > 192 * 24 * 60 * 60 * 1000),
        acceptedReason: null,
        currentStatus: severity.toLowerCase() === 'low' ? 'tracked' : 'open',
        nextTargetDate: targetDate,
        remediationSummary:
          typeof findingRecord.target_state === 'string'
            ? findingRecord.target_state
            : typeof poam?.plannedRemediation === 'string'
              ? poam.plannedRemediation
              : null,
        details: {
          packageJobId: packageRow.id,
          severity,
          detail,
          controlRefs: Array.isArray(findingRecord.control_refs) ? findingRecord.control_refs : [],
          poamId: poam?.identifier ?? poam?.id ?? null,
        },
      });
      syncedCount += 1;
    }
  }

  return {
    syncedCount,
  };
}

export async function generateVdrReport(
  env: EnvBindings,
  tenantId: string,
  userId: string,
  input: {
    reportMonth?: string;
    publicationState?: ArtifactPublicationState;
    generationSource?: ArtifactGenerationSource;
  } = {},
) {
  const offering = await ensureTrustCenterOffering(env, tenantId, userId);
  await syncVulnerabilityEvaluations(env, tenantId, userId);
  const reportMonth = input.reportMonth?.trim() || monthKey();
  const publicationState = input.publicationState ?? 'working';
  const generationSource = input.generationSource ?? 'manual';
  const evaluations = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM vulnerability_evaluations
    WHERE tenant_id = ?
    ORDER BY evaluated_at DESC
    LIMIT 250
    `,
  )
    .bind(tenantId)
    .all<VdrEvaluationRow>();

  const byImpact = new Map<string, number>();
  const accepted = evaluations.results.filter((item) => item.accepted_vulnerability === 1);
  const overdue = evaluations.results.filter((item) => item.overdue === 1);
  for (const evaluation of evaluations.results) {
    byImpact.set(evaluation.adverse_impact, (byImpact.get(evaluation.adverse_impact) ?? 0) + 1);
  }

  const markdown = [
    `# Vulnerability Detection and Response Report (${reportMonth})`,
    '',
    `- Total tracked vulnerabilities: ${evaluations.results.length}`,
    `- Accepted vulnerabilities: ${accepted.length}`,
    `- Overdue vulnerabilities: ${overdue.length}`,
    '',
    '## Impact distribution',
    ...['N5', 'N4', 'N3', 'N2', 'N1'].map((impact) => `- ${impact}: ${byImpact.get(impact) ?? 0}`),
    '',
    '## Highlights',
    ...evaluations.results.slice(0, 12).map((item) => {
      const flags = [
        item.internet_reachable === 1 ? 'IRV' : 'NIRV',
        item.likely_exploitable === 1 ? 'LEV' : 'NLEV',
        item.adverse_impact,
      ];
      return `- **${item.title}** [${flags.join(', ')}] status=${item.current_status} target=${item.next_target_date ?? 'not set'}`;
    }),
  ].join('\n');

  const artifact = await recordArtifactVersion(env, {
    tenantId,
    offeringId: offering.id,
    artifactKind: 'vdr_report',
    title: `${offering.name} VDR Report ${reportMonth}`,
    versionLabel: reportMonth,
    summary: `Monthly VDR report for ${reportMonth}.`,
    isPublic: false,
    audience: 'necessary-parties',
    publicationState,
    generationSource,
    createdByUserId: userId,
    objectPayload: {
      artifactKind: 'vdr_report',
      generatedAt: nowIso(),
      humanReadable: {
        markdown,
      },
      machineReadable: {
        reportMonth,
        total: evaluations.results.length,
        acceptedCount: accepted.length,
        overdueCount: overdue.length,
        impactCounts: Object.fromEntries(byImpact),
        evaluations: evaluations.results.map((item) => ({
          id: item.id,
          sourceType: item.source_type,
          sourceRecordId: item.source_record_id,
          title: item.title,
          detectionSource: item.detection_source,
          detectedAt: item.detected_at,
          internetReachable: item.internet_reachable === 1,
          likelyExploitable: item.likely_exploitable === 1,
          adverseImpact: item.adverse_impact,
          acceptedVulnerability: item.accepted_vulnerability === 1,
          acceptedReason: item.accepted_reason,
          overdue: item.overdue === 1,
          currentStatus: item.current_status,
          nextTargetDate: item.next_target_date,
          remediationSummary: item.remediation_summary,
          details: asJson<Record<string, unknown>>(item.details_json, {}),
        })),
      },
    },
    metadata: {
      reportMonth,
      total: evaluations.results.length,
    },
  });

  const existing = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM vdr_reports
    WHERE tenant_id = ? AND report_month = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, reportMonth)
    .first<VdrReportRow>();

  const updatedAt = nowIso();
  const reportJson = {
    total: evaluations.results.length,
    acceptedCount: accepted.length,
    overdueCount: overdue.length,
    impactCounts: Object.fromEntries(byImpact),
  };

  if (existing) {
    await env.D1_MAIN.prepare(
      `
      UPDATE vdr_reports
      SET title = ?, report_markdown = ?, report_json = ?, artifact_version_id = ?, status = ?,
          published_at = ?, publication_state = ?, generation_source = ?, updated_at = ?
      WHERE id = ?
      `,
    )
      .bind(
        `${offering.name} VDR Report ${reportMonth}`,
        markdown,
        JSON.stringify(reportJson),
        artifact.id,
        publicationState === 'published' ? 'published' : 'working',
        publicationState === 'published' ? updatedAt : existing.published_at,
        publicationState,
        generationSource,
        updatedAt,
        existing.id,
      )
      .run();
    return env.D1_MAIN.prepare(`SELECT * FROM vdr_reports WHERE id = ? LIMIT 1`).bind(existing.id).first<VdrReportRow>();
  }

  const reportId = crypto.randomUUID();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO vdr_reports (
      id, offering_id, tenant_id, report_month, title, report_markdown, report_json, artifact_version_id,
      status, published_at, publication_state, generation_source, created_by_user_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, report_month) DO UPDATE SET
      title = excluded.title,
      report_markdown = excluded.report_markdown,
      report_json = excluded.report_json,
      artifact_version_id = excluded.artifact_version_id,
      status = excluded.status,
      published_at = excluded.published_at,
      publication_state = excluded.publication_state,
      generation_source = excluded.generation_source,
      updated_at = excluded.updated_at
    `,
  )
    .bind(
      reportId,
      offering.id,
      tenantId,
      reportMonth,
      `${offering.name} VDR Report ${reportMonth}`,
      markdown,
      JSON.stringify(reportJson),
      artifact.id,
      publicationState === 'published' ? 'published' : 'working',
      publicationState === 'published' ? updatedAt : null,
      publicationState,
      generationSource,
      userId,
      updatedAt,
      updatedAt,
    )
    .run();

  return env.D1_MAIN.prepare(`SELECT * FROM vdr_reports WHERE tenant_id = ? AND report_month = ? LIMIT 1`)
    .bind(tenantId, reportMonth)
    .first<VdrReportRow>();
}

export async function publishVdrReport(
  env: EnvBindings,
  tenantId: string,
  reportId: string,
) {
  const report = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM vdr_reports
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, reportId)
    .first<VdrReportRow>();
  if (!report) {
    fedrampError(404, 'vdr_report_not_found', 'The selected VDR report does not exist.');
  }
  if (!report.artifact_version_id) {
    fedrampError(409, 'missing_artifact', 'The selected VDR report cannot be published without an artifact.');
  }

  await promoteArtifactVersion(env, {
    artifactId: report.artifact_version_id,
    tenantId,
    artifactKind: 'vdr_report',
    versionLabel: report.report_month,
  });

  const updatedAt = nowIso();
  await env.D1_MAIN.prepare(
    `
    UPDATE vdr_reports
    SET status = 'published', publication_state = 'published', published_at = COALESCE(published_at, ?), updated_at = ?
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(updatedAt, updatedAt, tenantId, reportId)
    .run();

  return env.D1_MAIN.prepare(`SELECT * FROM vdr_reports WHERE tenant_id = ? AND id = ? LIMIT 1`)
    .bind(tenantId, reportId)
    .first<VdrReportRow>();
}

function buildFeedbackAddendumMarkdown(rows: FeedbackItemRow[]) {
  if (rows.length === 0) {
    return 'No feedback has been recorded for this cycle yet.';
  }

  return [
    '# Feedback Addendum',
    '',
    ...rows.map((row) =>
      [
        `- Question: ${row.question}`,
        `  Submitted by: ${row.is_anonymized === 1 ? 'Anonymous' : row.submitted_by || 'Unknown'}`,
        `  Status: ${row.status}`,
        `  Response: ${row.response || 'Pending response'}`,
      ].join('\n'),
    ),
  ].join('\n');
}

async function refreshOarCycleFeedbackAddendum(env: EnvBindings, tenantId: string, oarCycleId: string) {
  const feedback = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM feedback_items
    WHERE tenant_id = ? AND oar_cycle_id = ?
    ORDER BY created_at ASC
    `,
  )
    .bind(tenantId, oarCycleId)
    .all<FeedbackItemRow>();

  const addendum = buildFeedbackAddendumMarkdown(feedback.results);
  await env.D1_MAIN.prepare(
    `
    UPDATE oar_cycles
    SET feedback_addendum_markdown = ?, updated_at = ?
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(addendum, nowIso(), tenantId, oarCycleId)
    .run();
}

export async function scheduleQuarterlyReview(
  env: EnvBindings,
  tenantId: string,
  userId: string,
  input: {
    oarCycleId?: string | null;
    title?: string;
    scheduledFor?: string;
    registrationUrl?: string | null;
    recordingUrl?: string | null;
    transcriptUrl?: string | null;
    status?: string;
    publicationState?: ArtifactPublicationState;
    generationSource?: ArtifactGenerationSource;
    summary?: Record<string, unknown>;
  } = {},
) {
  const offering = await ensureTrustCenterOffering(env, tenantId, userId);
  const scheduledFor = input.scheduledFor ?? addDays(nowIso(), 10);
  const title = input.title?.trim() || `${offering.name} Quarterly Review`;
  const publicationState = input.publicationState ?? 'working';
  const generationSource = input.generationSource ?? 'manual';
  const createdAt = nowIso();
  const reviewId = crypto.randomUUID();
  const registrationUrl =
    input.registrationUrl ??
    `${offering.trust_center_url ?? '/trust-center'}?quarterlyReviewId=${encodeURIComponent(reviewId)}`;
  const calendarIcs = buildQuarterlyReviewIcs({
    title,
    scheduledFor,
    description: 'Quarterly review of the current Ongoing Authorization Report, vulnerability trends, and significant changes.',
  });

  await env.D1_MAIN.prepare(
    `
    INSERT INTO quarterly_reviews (
      id, offering_id, tenant_id, oar_cycle_id, title, scheduled_for, registration_url, calendar_ics,
      recording_url, transcript_url, status, summary_json, publication_state, generation_source,
      created_by_user_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      reviewId,
      offering.id,
      tenantId,
      input.oarCycleId ?? null,
      title,
      scheduledFor,
      registrationUrl,
      calendarIcs,
      input.recordingUrl ?? null,
      input.transcriptUrl ?? null,
      input.status?.trim() || 'scheduled',
      JSON.stringify(input.summary ?? {}),
      publicationState,
      generationSource,
      userId,
      createdAt,
      createdAt,
    )
    .run();

  return env.D1_MAIN.prepare(`SELECT * FROM quarterly_reviews WHERE id = ? LIMIT 1`).bind(reviewId).first<QuarterlyReviewRow>();
}

export async function publishQuarterlyReview(
  env: EnvBindings,
  tenantId: string,
  reviewId: string,
) {
  const review = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM quarterly_reviews
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, reviewId)
    .first<QuarterlyReviewRow>();
  if (!review) {
    fedrampError(404, 'quarterly_review_not_found', 'The selected quarterly review does not exist.');
  }

  const updatedAt = nowIso();
  if (review.oar_cycle_id) {
    await env.D1_MAIN.prepare(
      `
      UPDATE quarterly_reviews
      SET publication_state = 'superseded', status = 'archived', updated_at = ?
      WHERE tenant_id = ? AND oar_cycle_id = ? AND id != ? AND publication_state = 'published'
      `,
    )
      .bind(updatedAt, tenantId, review.oar_cycle_id, reviewId)
      .run();
  }

  await env.D1_MAIN.prepare(
    `
    UPDATE quarterly_reviews
    SET publication_state = 'published', status = 'published', updated_at = ?
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(updatedAt, tenantId, reviewId)
    .run();

  await env.D1_MAIN.prepare(
    `
    UPDATE trust_center_offerings
    SET next_quarterly_review_on = ?, updated_at = ?
    WHERE tenant_id = ?
    `,
  )
    .bind(review.scheduled_for, updatedAt, tenantId)
    .run();

  return env.D1_MAIN.prepare(`SELECT * FROM quarterly_reviews WHERE tenant_id = ? AND id = ? LIMIT 1`)
    .bind(tenantId, reviewId)
    .first<QuarterlyReviewRow>();
}

export async function createFeedbackItem(
  env: EnvBindings,
  tenantId: string,
  input: {
    oarCycleId?: string | null;
    quarterlyReviewId?: string | null;
    submittedBy?: string | null;
    submittedEmail?: string | null;
    question?: string;
    response?: string | null;
    status?: string;
    isAnonymized?: boolean;
  },
) {
  const createdAt = nowIso();
  const feedbackId = crypto.randomUUID();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO feedback_items (
      id, tenant_id, oar_cycle_id, quarterly_review_id, submitted_by, submitted_email, question, response,
      status, is_anonymized, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      feedbackId,
      tenantId,
      input.oarCycleId ?? null,
      input.quarterlyReviewId ?? null,
      input.submittedBy ?? null,
      input.submittedEmail ?? null,
      input.question?.trim() || 'Feedback item',
      input.response ?? null,
      input.status?.trim() || 'open',
      input.isAnonymized === false ? 0 : 1,
      createdAt,
      createdAt,
    )
    .run();

  if (input.oarCycleId?.trim()) {
    await refreshOarCycleFeedbackAddendum(env, tenantId, input.oarCycleId.trim());
  }

  return env.D1_MAIN.prepare(`SELECT * FROM feedback_items WHERE id = ? LIMIT 1`).bind(feedbackId).first<FeedbackItemRow>();
}

export async function updateFeedbackItem(
  env: EnvBindings,
  tenantId: string,
  feedbackId: string,
  input: {
    response?: string | null;
    status?: string | null;
  },
) {
  const existing = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM feedback_items
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, feedbackId)
    .first<FeedbackItemRow>();
  if (!existing) {
    fedrampError(404, 'feedback_not_found', 'The selected feedback item does not exist.');
  }

  await env.D1_MAIN.prepare(
    `
    UPDATE feedback_items
    SET response = ?, status = ?, updated_at = ?
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(
      input.response ?? existing.response,
      input.status?.trim() || existing.status,
      nowIso(),
      tenantId,
      feedbackId,
    )
    .run();

  if (existing.oar_cycle_id) {
    await refreshOarCycleFeedbackAddendum(env, tenantId, existing.oar_cycle_id);
  }

  return env.D1_MAIN.prepare(`SELECT * FROM feedback_items WHERE tenant_id = ? AND id = ? LIMIT 1`)
    .bind(tenantId, feedbackId)
    .first<FeedbackItemRow>();
}

export async function generateOarCycle(
  env: EnvBindings,
  tenantId: string,
  userId: string,
  input: {
    cycleLabel?: string;
    periodStart?: string;
    periodEnd?: string;
    nextReportDueOn?: string;
    targetReviewOn?: string | null;
    feedbackChannel?: string | null;
    publicationState?: ArtifactPublicationState;
    generationSource?: ArtifactGenerationSource;
    sourcePackageJobId?: string | null;
  } = {},
) {
  const offering = await ensureTrustCenterOffering(env, tenantId, userId);
  const publicationState = input.publicationState ?? 'working';
  const generationSource = input.generationSource ?? 'manual';
  const latestVdr = await generateVdrReport(env, tenantId, userId, {
    publicationState: 'working',
    generationSource,
  });
  const packageRows = await loadLatestPackageRows(env, tenantId, 6);
  const changeRows = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM significant_changes
    WHERE tenant_id = ?
    ORDER BY updated_at DESC
    LIMIT 12
    `,
  )
    .bind(tenantId)
    .all<SignificantChangeRow>();
  const acceptedVulnerabilities = await env.D1_MAIN.prepare(
    `
    SELECT COUNT(*) AS total_count
    FROM vulnerability_evaluations
    WHERE tenant_id = ? AND accepted_vulnerability = 1
    `,
  )
    .bind(tenantId)
    .first<CountRow>();

  const periodEnd = input.periodEnd ?? nowIso();
  const periodStart = input.periodStart ?? addDays(periodEnd, -90);
  const cycleLabel = input.cycleLabel?.trim() || quarterLabel(new Date(periodEnd));
  const nextReportDueOn = input.nextReportDueOn ?? addDays(periodEnd, 90);
  const targetReviewOn = input.targetReviewOn ?? addDays(periodEnd, 97);
  const feedbackChannel = input.feedbackChannel ?? (offering.contact_email ? `mailto:${offering.contact_email}` : null);

  const markdown = [
    `# Ongoing Authorization Report (${cycleLabel})`,
    '',
    `- Reporting period: ${periodStart.slice(0, 10)} to ${periodEnd.slice(0, 10)}`,
    `- Next report target date: ${nextReportDueOn.slice(0, 10)}`,
    `- Quarterly review target date: ${targetReviewOn ? targetReviewOn.slice(0, 10) : 'not scheduled'}`,
    '',
    '## Changes to authorization data',
    ...packageRows.results.slice(0, 6).map((item) => `- Published package ${item.file_name} at ${item.updated_at}`),
    '',
    '## Planned changes in the next cycle',
    ...changeRows.results
      .filter((item) => item.status !== 'completed')
      .slice(0, 8)
      .map((item) => `- ${item.title} (${item.change_type}) status=${item.status}`),
    '',
    '## Accepted vulnerabilities',
    `- Accepted vulnerabilities currently tracked: ${Number(acceptedVulnerabilities?.total_count ?? 0)}`,
    '',
    '## Updated recommendations and best practices',
    '- Review the current secure configuration guide and tenant secure defaults before the next cycle.',
    `- Latest VDR report: ${latestVdr?.title ?? 'not generated'}`,
  ].join('\n');

  const artifact = await recordArtifactVersion(env, {
    tenantId,
    offeringId: offering.id,
    artifactKind: 'oar',
    title: `${offering.name} OAR ${cycleLabel}`,
    versionLabel: cycleLabel,
    summary: `Ongoing Authorization Report for ${cycleLabel}.`,
    isPublic: false,
    audience: 'necessary-parties',
    publicationState,
    generationSource,
    createdByUserId: userId,
    objectPayload: {
      artifactKind: 'oar',
      generatedAt: nowIso(),
      humanReadable: {
        markdown,
      },
      machineReadable: {
        cycleLabel,
        periodStart,
        periodEnd,
        nextReportDueOn,
        targetReviewOn,
        acceptedVulnerabilityCount: Number(acceptedVulnerabilities?.total_count ?? 0),
        packagePublications: packageRows.results.map((item) => ({
          packageJobId: item.id,
          fileName: item.file_name,
          updatedAt: item.updated_at,
          coverage: asJson<Record<string, unknown>>(item.coverage_json, {}),
        })),
        significantChanges: changeRows.results.map((item) => ({
          id: item.id,
          title: item.title,
          changeType: item.change_type,
          status: item.status,
          plannedStartOn: item.planned_start_on,
          finishedOn: item.finished_on,
        })),
      },
    },
    metadata: {
      cycleLabel,
      latestVdrReportId: latestVdr?.id ?? null,
    },
  });

  const createdAt = nowIso();
  const cycleId = crypto.randomUUID();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO oar_cycles (
      id, offering_id, tenant_id, cycle_label, period_start, period_end, next_report_due_on, target_review_on,
      feedback_channel, status, report_markdown, feedback_addendum_markdown, summary_json, artifact_version_id,
      publication_state, generation_source, source_package_job_id, created_by_user_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      cycleId,
      offering.id,
      tenantId,
      cycleLabel,
      periodStart,
      periodEnd,
      nextReportDueOn,
      targetReviewOn,
      feedbackChannel,
      publicationState === 'published' ? 'published' : 'working',
      markdown,
      '',
      JSON.stringify({
        latestVdrReportId: latestVdr?.id ?? null,
        packageCount: packageRows.results.length,
        acceptedVulnerabilityCount: Number(acceptedVulnerabilities?.total_count ?? 0),
      }),
      artifact.id,
      publicationState,
      generationSource,
      input.sourcePackageJobId ?? null,
      userId,
      createdAt,
      createdAt,
    )
    .run();

  const review = await scheduleQuarterlyReview(env, tenantId, userId, {
    oarCycleId: cycleId,
    title: `${offering.name} Quarterly Review ${cycleLabel}`,
    scheduledFor: targetReviewOn ?? addDays(periodEnd, 97),
    registrationUrl: `${offering.trust_center_url ?? '/trust-center'}?oarCycleId=${encodeURIComponent(cycleId)}`,
    publicationState,
    generationSource,
    summary: {
      cycleLabel,
    },
  });

  if (publicationState === 'published') {
    await env.D1_MAIN.prepare(
      `
      UPDATE trust_center_offerings
      SET next_oar_due_on = ?, next_quarterly_review_on = ?, updated_at = ?
      WHERE id = ?
      `,
    )
      .bind(nextReportDueOn, review?.scheduled_for ?? targetReviewOn, createdAt, offering.id)
      .run();
  }

  return {
    cycle: await env.D1_MAIN.prepare(`SELECT * FROM oar_cycles WHERE id = ? LIMIT 1`).bind(cycleId).first<OarCycleRow>(),
    review,
  };
}

export async function publishOarCycle(
  env: EnvBindings,
  tenantId: string,
  cycleId: string,
) {
  const cycle = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM oar_cycles
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, cycleId)
    .first<OarCycleRow>();
  if (!cycle) {
    fedrampError(404, 'oar_cycle_not_found', 'The selected OAR cycle does not exist.');
  }
  if (!cycle.artifact_version_id) {
    fedrampError(409, 'missing_artifact', 'The selected OAR cycle cannot be published without an artifact.');
  }

  await promoteArtifactVersion(env, {
    artifactId: cycle.artifact_version_id,
    tenantId,
    artifactKind: 'oar',
    versionLabel: cycle.cycle_label,
  });

  const updatedAt = nowIso();
  await env.D1_MAIN.prepare(
    `
    UPDATE oar_cycles
    SET publication_state = 'superseded', status = 'archived', updated_at = ?
    WHERE tenant_id = ? AND cycle_label = ? AND id != ? AND publication_state = 'published'
    `,
  )
    .bind(updatedAt, tenantId, cycle.cycle_label, cycleId)
    .run();

  await env.D1_MAIN.prepare(
    `
    UPDATE oar_cycles
    SET publication_state = 'published', status = 'published', updated_at = ?
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(updatedAt, tenantId, cycleId)
    .run();

  const publishedReview = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM quarterly_reviews
    WHERE tenant_id = ? AND oar_cycle_id = ? AND publication_state = 'published'
    ORDER BY scheduled_for DESC
    LIMIT 1
    `,
  )
    .bind(tenantId, cycleId)
    .first<QuarterlyReviewRow>();

  await env.D1_MAIN.prepare(
    `
    UPDATE trust_center_offerings
    SET next_oar_due_on = ?, next_quarterly_review_on = ?, updated_at = ?
    WHERE tenant_id = ?
    `,
  )
    .bind(cycle.next_report_due_on, publishedReview?.scheduled_for ?? cycle.target_review_on, updatedAt, tenantId)
    .run();

  return env.D1_MAIN.prepare(`SELECT * FROM oar_cycles WHERE tenant_id = ? AND id = ? LIMIT 1`)
    .bind(tenantId, cycleId)
    .first<OarCycleRow>();
}

function computeScnNoticePlan(change: {
  changeType: string;
  plannedStartOn?: string | null;
  finishedOn?: string | null;
  verifiedOn?: string | null;
}) {
  const notices: Array<{ noticeKind: string; dueOn: string | null; status: string; payload: Record<string, unknown> }> = [];
  if (change.changeType === 'routine-recurring') {
    return notices;
  }

  if (change.changeType === 'adaptive') {
    notices.push({
      noticeKind: 'adaptive-finish',
      dueOn: change.finishedOn ? addDays(change.finishedOn, 10) : null,
      status: change.finishedOn ? 'scheduled' : 'pending',
      payload: {
        requirement: 'notify-within-10-business-days',
      },
    });
    return notices;
  }

  notices.push({
    noticeKind: 'transformative-initial-plan',
    dueOn: change.plannedStartOn ? addDays(change.plannedStartOn, -30) : null,
    status: change.plannedStartOn ? 'scheduled' : 'pending',
    payload: {
      requirement: 'notify-initial-plan-30-business-days-before-start',
    },
  });
  notices.push({
    noticeKind: 'transformative-final-plan',
    dueOn: change.plannedStartOn ? addDays(change.plannedStartOn, -10) : null,
    status: change.plannedStartOn ? 'scheduled' : 'pending',
    payload: {
      requirement: 'notify-final-plan-10-business-days-before-start',
    },
  });
  notices.push({
    noticeKind: 'transformative-finished',
    dueOn: change.finishedOn ? addDays(change.finishedOn, 5) : null,
    status: change.finishedOn ? 'scheduled' : 'pending',
    payload: {
      requirement: 'notify-within-5-business-days-after-finishing',
    },
  });
  notices.push({
    noticeKind: 'transformative-verified',
    dueOn: change.verifiedOn ? addDays(change.verifiedOn, 5) : null,
    status: change.verifiedOn ? 'scheduled' : 'pending',
    payload: {
      requirement: 'notify-within-5-business-days-after-verification',
    },
  });
  return notices;
}

async function syncSignificantChangeNotices(
  env: EnvBindings,
  tenantId: string,
  significantChangeId: string,
  notices: Array<{ noticeKind: string; dueOn: string | null; status: string; payload: Record<string, unknown> }>,
) {
  const existing = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM significant_change_notices
    WHERE tenant_id = ? AND significant_change_id = ?
    `,
  )
    .bind(tenantId, significantChangeId)
    .all<SignificantChangeNoticeRow>();

  const byKind = new Map(existing.results.map((row) => [row.notice_kind, row]));
  const updatedAt = nowIso();
  for (const notice of notices) {
    const current = byKind.get(notice.noticeKind);
    if (current) {
      const nextStatus =
        current.status === 'published' || current.status === 'failed'
          ? current.status
          : notice.status;
      await env.D1_MAIN.prepare(
        `
        UPDATE significant_change_notices
        SET due_on = ?, status = ?, payload_json = ?, updated_at = ?
        WHERE tenant_id = ? AND id = ?
        `,
      )
        .bind(notice.dueOn, nextStatus, JSON.stringify(notice.payload), updatedAt, tenantId, current.id)
        .run();
      byKind.delete(notice.noticeKind);
      continue;
    }

    await env.D1_MAIN.prepare(
      `
      INSERT INTO significant_change_notices (
        id, tenant_id, significant_change_id, notice_kind, due_on, sent_at, status, payload_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
      `,
    )
      .bind(
        crypto.randomUUID(),
        tenantId,
        significantChangeId,
        notice.noticeKind,
        notice.dueOn,
        notice.status,
        JSON.stringify(notice.payload),
        updatedAt,
        updatedAt,
      )
      .run();
  }

  for (const stale of byKind.values()) {
    if (stale.status === 'published') {
      continue;
    }
    await env.D1_MAIN.prepare(
      `
      UPDATE significant_change_notices
      SET status = 'failed', updated_at = ?
      WHERE tenant_id = ? AND id = ?
      `,
    )
      .bind(updatedAt, tenantId, stale.id)
      .run();
  }
}

export async function createSignificantChange(
  env: EnvBindings,
  tenantId: string,
  userId: string,
  input: {
    title?: string;
    changeType?: string;
    status?: string;
    description?: string;
    reason?: string | null;
    customerImpact?: string | null;
    planTimeline?: string | null;
    impactAnalysis?: string | null;
    approverName?: string | null;
    approverTitle?: string | null;
    plannedStartOn?: string | null;
    finishedOn?: string | null;
    verifiedOn?: string | null;
    verificationSummary?: string | null;
    poamRefs?: string[];
  },
) {
  const offering = await ensureTrustCenterOffering(env, tenantId, userId);
  const createdAt = nowIso();
  const rowId = crypto.randomUUID();
  const changeType = input.changeType?.trim() || 'adaptive';

  await env.D1_MAIN.prepare(
    `
    INSERT INTO significant_changes (
      id, offering_id, tenant_id, title, change_type, status, description, reason, customer_impact, plan_timeline,
      impact_analysis, approver_name, approver_title, planned_start_on, finished_on, verified_on, verification_summary,
      poam_refs_json, created_by_user_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      rowId,
      offering.id,
      tenantId,
      input.title?.trim() || 'Significant change',
      changeType,
      input.status?.trim() || 'planned',
      input.description?.trim() || 'Significant change record created from the FedRAMP provider shell.',
      input.reason ?? null,
      input.customerImpact ?? null,
      input.planTimeline ?? null,
      input.impactAnalysis ?? null,
      input.approverName ?? null,
      input.approverTitle ?? null,
      input.plannedStartOn ?? null,
      input.finishedOn ?? null,
      input.verifiedOn ?? null,
      input.verificationSummary ?? null,
      JSON.stringify(input.poamRefs ?? []),
      userId,
      createdAt,
      createdAt,
    )
    .run();

  const notices = computeScnNoticePlan({
    changeType,
    plannedStartOn: input.plannedStartOn ?? null,
    finishedOn: input.finishedOn ?? null,
    verifiedOn: input.verifiedOn ?? null,
  });

  await syncSignificantChangeNotices(env, tenantId, rowId, notices);
  await publishScnHistoryArtifact(env, offering, userId, 'working', 'manual');

  return env.D1_MAIN.prepare(`SELECT * FROM significant_changes WHERE id = ? LIMIT 1`).bind(rowId).first<SignificantChangeRow>();
}

export async function updateSignificantChange(
  env: EnvBindings,
  tenantId: string,
  userId: string,
  changeId: string,
  input: {
    title?: string;
    changeType?: string;
    status?: string;
    description?: string;
    reason?: string | null;
    customerImpact?: string | null;
    planTimeline?: string | null;
    impactAnalysis?: string | null;
    approverName?: string | null;
    approverTitle?: string | null;
    plannedStartOn?: string | null;
    finishedOn?: string | null;
    verifiedOn?: string | null;
    verificationSummary?: string | null;
    poamRefs?: string[];
  },
) {
  const existing = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM significant_changes
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, changeId)
    .first<SignificantChangeRow>();
  if (!existing) {
    fedrampError(404, 'significant_change_not_found', 'The selected significant change does not exist.');
  }

  const nextChangeType = input.changeType?.trim() || existing.change_type;
  await env.D1_MAIN.prepare(
    `
    UPDATE significant_changes
    SET title = ?, change_type = ?, status = ?, description = ?, reason = ?, customer_impact = ?, plan_timeline = ?,
        impact_analysis = ?, approver_name = ?, approver_title = ?, planned_start_on = ?, finished_on = ?,
        verified_on = ?, verification_summary = ?, poam_refs_json = ?, updated_at = ?
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(
      input.title?.trim() || existing.title,
      nextChangeType,
      input.status?.trim() || existing.status,
      input.description?.trim() || existing.description,
      input.reason ?? existing.reason,
      input.customerImpact ?? existing.customer_impact,
      input.planTimeline ?? existing.plan_timeline,
      input.impactAnalysis ?? existing.impact_analysis,
      input.approverName ?? existing.approver_name,
      input.approverTitle ?? existing.approver_title,
      input.plannedStartOn ?? existing.planned_start_on,
      input.finishedOn ?? existing.finished_on,
      input.verifiedOn ?? existing.verified_on,
      input.verificationSummary ?? existing.verification_summary,
      JSON.stringify(input.poamRefs ?? asJson<string[]>(existing.poam_refs_json, [])),
      nowIso(),
      tenantId,
      changeId,
    )
    .run();

  await syncSignificantChangeNotices(
    env,
    tenantId,
    changeId,
    computeScnNoticePlan({
      changeType: nextChangeType,
      plannedStartOn: input.plannedStartOn ?? existing.planned_start_on,
      finishedOn: input.finishedOn ?? existing.finished_on,
      verifiedOn: input.verifiedOn ?? existing.verified_on,
    }),
  );

  const offering = await ensureTrustCenterOffering(env, tenantId, userId);
  await publishScnHistoryArtifact(env, offering, userId, 'working', 'manual');
  return env.D1_MAIN.prepare(`SELECT * FROM significant_changes WHERE tenant_id = ? AND id = ? LIMIT 1`)
    .bind(tenantId, changeId)
    .first<SignificantChangeRow>();
}

async function publishScnHistoryArtifact(
  env: EnvBindings,
  offering: OfferingRow,
  createdByUserId: string | null,
  publicationState: ArtifactPublicationState = 'working',
  generationSource: ArtifactGenerationSource = 'manual',
) {
  const [changes, notices] = await Promise.all([
    env.D1_MAIN.prepare(
      `
      SELECT *
      FROM significant_changes
      WHERE tenant_id = ?
      ORDER BY updated_at DESC
      LIMIT 100
      `,
    )
      .bind(offering.tenant_id)
      .all<SignificantChangeRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT notice.*
      FROM significant_change_notices AS notice
      INNER JOIN significant_changes AS change_row
        ON change_row.id = notice.significant_change_id
      WHERE notice.tenant_id = ?
      ORDER BY notice.updated_at DESC
      LIMIT 200
      `,
    )
      .bind(offering.tenant_id)
      .all<SignificantChangeNoticeRow>(),
  ]);

  return recordArtifactVersion(env, {
    tenantId: offering.tenant_id,
    offeringId: offering.id,
    artifactKind: 'scn_history',
    title: `${offering.name} Significant Change History`,
    versionLabel: monthKey(),
    summary: 'Historical significant change notifications and notice schedules.',
    isPublic: false,
    audience: 'necessary-parties',
    publicationState,
    generationSource,
    createdByUserId,
    objectPayload: {
      artifactKind: 'scn_history',
      generatedAt: nowIso(),
      humanReadable: {
        markdown: [
          '# Significant Change History',
          '',
          ...changes.results.map((item) => `- **${item.title}** (${item.change_type}) status=${item.status}`),
        ].join('\n'),
      },
      machineReadable: {
        changes: changes.results.map((item) => ({
          id: item.id,
          title: item.title,
          changeType: item.change_type,
          status: item.status,
          plannedStartOn: item.planned_start_on,
          finishedOn: item.finished_on,
          verifiedOn: item.verified_on,
          poamRefs: asJson<string[]>(item.poam_refs_json, []),
        })),
        notices: notices.results.map((item) => ({
          id: item.id,
          significantChangeId: item.significant_change_id,
          noticeKind: item.notice_kind,
          dueOn: item.due_on,
          sentAt: item.sent_at,
          status: item.status,
          payload: asJson<Record<string, unknown>>(item.payload_json, {}),
        })),
      },
    },
  });
}

export async function publishSignificantChangeNotice(
  env: EnvBindings,
  tenantId: string,
  userId: string,
  noticeId: string,
) {
  const notice = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM significant_change_notices
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, noticeId)
    .first<SignificantChangeNoticeRow>();
  if (!notice) {
    fedrampError(404, 'significant_change_notice_not_found', 'The selected significant change notice does not exist.');
  }

  const updatedAt = nowIso();
  await env.D1_MAIN.prepare(
    `
    UPDATE significant_change_notices
    SET status = 'published', sent_at = COALESCE(sent_at, ?), updated_at = ?
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(updatedAt, updatedAt, tenantId, noticeId)
    .run();

  const offering = await ensureTrustCenterOffering(env, tenantId, userId);
  const artifact = await publishScnHistoryArtifact(env, offering, userId, 'published', 'manual');
  await promoteArtifactVersion(env, {
    artifactId: artifact.id,
    tenantId,
    artifactKind: 'scn_history',
    versionLabel: artifact.version_label,
  });
  return env.D1_MAIN.prepare(`SELECT * FROM significant_change_notices WHERE tenant_id = ? AND id = ? LIMIT 1`)
    .bind(tenantId, noticeId)
    .first<SignificantChangeNoticeRow>();
}

export async function createFedrampMessage(
  env: EnvBindings,
  tenantId: string,
  userId: string,
  input: {
    messageType?: string;
    criticality?: string;
    subject?: string;
    bodyMarkdown?: string;
    status?: string;
    requiredActions?: Array<Record<string, unknown>>;
    dueAt?: string | null;
    metadata?: Record<string, unknown>;
    contactIds?: string[];
  },
) {
  const offering = await ensureTrustCenterOffering(env, tenantId, userId);
  const createdAt = nowIso();
  const messageId = crypto.randomUUID();
  const messageStatus = (input.status?.trim() as FedrampMessageStatus | undefined) ?? 'draft';
  await env.D1_MAIN.prepare(
    `
    INSERT INTO fedramp_messages (
      id, offering_id, tenant_id, message_type, criticality, subject, body_markdown, status, required_actions_json,
      due_at, metadata_json, created_by_user_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      messageId,
      offering.id,
      tenantId,
      input.messageType?.trim() || 'general',
      input.criticality?.trim() || 'general',
      input.subject?.trim() || 'FedRAMP communication',
      input.bodyMarkdown ?? '',
      messageStatus,
      JSON.stringify(input.requiredActions ?? []),
      input.dueAt ?? null,
      JSON.stringify(input.metadata ?? {}),
      userId,
      createdAt,
      createdAt,
    )
    .run();

  const contacts = input.contactIds?.length
    ? (
        await env.D1_MAIN.prepare(
          `
          SELECT *
          FROM agency_contacts
          WHERE tenant_id = ? AND id IN (${input.contactIds.map(() => '?').join(', ')})
          `,
        )
          .bind(tenantId, ...input.contactIds)
          .all<ContactRow>()
      ).results
    : (
        await env.D1_MAIN.prepare(
          `
          SELECT *
          FROM agency_contacts
          WHERE tenant_id = ?
          ORDER BY updated_at DESC
          LIMIT 50
          `,
        )
          .bind(tenantId)
          .all<ContactRow>()
      ).results;

  for (const contact of contacts) {
    await env.D1_MAIN.prepare(
      `
      INSERT INTO fedramp_message_deliveries (
        id, tenant_id, message_id, contact_id, channel, recipient_email, delivery_status, escalation_due_at,
        acknowledged_at, acknowledged_by, delivery_log_json, confirmed_at, confirmed_by, confirmation_method, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, 'email', ?, 'queued', ?, NULL, NULL, ?, NULL, NULL, NULL, ?, ?)
      `,
    )
      .bind(
        crypto.randomUUID(),
        tenantId,
        messageId,
        contact.id,
        contact.incident_email ?? contact.contact_email,
        input.dueAt ?? null,
        JSON.stringify({
          contactName: contact.contact_name,
          agencyName: contact.agency_name,
          criticality: input.criticality?.trim() || 'general',
          queuedBy: userId,
          queuedAt: createdAt,
        }),
        createdAt,
        createdAt,
      )
      .run();
  }

  return env.D1_MAIN.prepare(`SELECT * FROM fedramp_messages WHERE id = ? LIMIT 1`).bind(messageId).first<MessageRow>();
}

async function updateMessageDeliveryStatuses(env: EnvBindings, tenantId: string, messageId: string) {
  const deliveries = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM fedramp_message_deliveries
    WHERE tenant_id = ? AND message_id = ?
    `,
  )
    .bind(tenantId, messageId)
    .all<DeliveryRow>();

  const nextStatus = determineMessageStatus(deliveries.results);
  await env.D1_MAIN.prepare(
    `
    UPDATE fedramp_messages
    SET status = ?, updated_at = ?
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(nextStatus, nowIso(), tenantId, messageId)
    .run();
}

export async function queueFedrampMessage(
  env: EnvBindings,
  tenantId: string,
  userId: string,
  messageId: string,
) {
  const message = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM fedramp_messages
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, messageId)
    .first<MessageRow>();

  if (!message) {
    fedrampError(404, 'message_not_found', 'The requested FedRAMP message does not exist.');
  }

  const updatedAt = nowIso();
  await env.D1_MAIN.prepare(
    `
    UPDATE fedramp_messages
    SET status = 'queued', updated_at = ?
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(updatedAt, tenantId, messageId)
    .run();

  const deliveries = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM fedramp_message_deliveries
    WHERE tenant_id = ? AND message_id = ?
    `,
  )
    .bind(tenantId, messageId)
    .all<DeliveryRow>();
  for (const delivery of deliveries.results) {
    const deliveryLog = asJson<Record<string, unknown>>(delivery.delivery_log_json, {});
    deliveryLog.queuedBy = userId;
    deliveryLog.queuedAt = updatedAt;
    await env.D1_MAIN.prepare(
      `
      UPDATE fedramp_message_deliveries
      SET delivery_status = CASE
            WHEN delivery_status IN ('queued', 'failed', 'expired') THEN 'queued'
            ELSE delivery_status
          END,
          delivery_log_json = ?,
          updated_at = ?
      WHERE tenant_id = ? AND id = ?
      `,
    )
      .bind(JSON.stringify(deliveryLog), updatedAt, tenantId, delivery.id)
      .run();
  }

  return env.D1_MAIN.prepare(`SELECT * FROM fedramp_messages WHERE tenant_id = ? AND id = ? LIMIT 1`)
    .bind(tenantId, messageId)
    .first<MessageRow>();
}

export async function acknowledgeFedrampDelivery(
  env: EnvBindings,
  tenantId: string,
  input: {
    deliveryId?: string;
    messageId?: string;
    recipientEmail?: string;
    acknowledgedBy?: string | null;
  },
) {
  const createdAt = nowIso();
  let deliveryId = input.deliveryId?.trim() || null;
  if (!deliveryId && input.messageId?.trim() && input.recipientEmail?.trim()) {
    const match = await env.D1_MAIN.prepare(
      `
      SELECT id
      FROM fedramp_message_deliveries
      WHERE tenant_id = ? AND message_id = ? AND recipient_email = ?
      LIMIT 1
      `,
    )
      .bind(tenantId, input.messageId.trim(), input.recipientEmail.trim())
      .first<{ id: string }>();
    deliveryId = match?.id ?? null;
  }

  if (!deliveryId) {
    fedrampError(404, 'delivery_not_found', 'A matching FedRAMP delivery record was not found for acknowledgement.');
  }

  const confirmedAt = nowIso();
  const delivery = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM fedramp_message_deliveries
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, deliveryId)
    .first<DeliveryRow>();
  if (!delivery) {
    fedrampError(404, 'delivery_not_found', 'The requested FedRAMP delivery does not exist.');
  }

  await env.D1_MAIN.prepare(
    `
    UPDATE fedramp_message_deliveries
    SET delivery_status = 'acknowledged', acknowledged_at = ?, acknowledged_by = ?, confirmed_at = ?, confirmed_by = ?,
        confirmation_method = 'manual_acknowledgement', updated_at = ?
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(
      confirmedAt,
      input.acknowledgedBy ?? input.recipientEmail ?? null,
      confirmedAt,
      input.acknowledgedBy ?? input.recipientEmail ?? null,
      confirmedAt,
      tenantId,
      deliveryId,
    )
    .run();

  await updateMessageDeliveryStatuses(env, tenantId, delivery.message_id);
  return env.D1_MAIN.prepare(`SELECT * FROM fedramp_message_deliveries WHERE id = ? LIMIT 1`).bind(deliveryId).first<DeliveryRow>();
}

export async function confirmFedrampDelivery(
  env: EnvBindings,
  tenantId: string,
  input: {
    deliveryId: string;
    confirmedBy?: string | null;
    confirmationMethod?: string | null;
  },
) {
  const delivery = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM fedramp_message_deliveries
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, input.deliveryId)
    .first<DeliveryRow>();

  if (!delivery) {
    fedrampError(404, 'delivery_not_found', 'The requested FedRAMP delivery does not exist.');
  }

  const confirmedAt = nowIso();
  await env.D1_MAIN.prepare(
    `
    UPDATE fedramp_message_deliveries
    SET delivery_status = 'delivered', confirmed_at = ?, confirmed_by = ?, confirmation_method = ?, updated_at = ?
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(
      confirmedAt,
      input.confirmedBy ?? null,
      input.confirmationMethod ?? 'manual_confirmation',
      confirmedAt,
      tenantId,
      input.deliveryId,
    )
    .run();

  await updateMessageDeliveryStatuses(env, tenantId, delivery.message_id);
  return env.D1_MAIN.prepare(`SELECT * FROM fedramp_message_deliveries WHERE id = ? LIMIT 1`).bind(input.deliveryId).first<DeliveryRow>();
}

export async function failFedrampDelivery(
  env: EnvBindings,
  tenantId: string,
  input: {
    deliveryId: string;
    confirmedBy?: string | null;
    confirmationMethod?: string | null;
    failureReason?: string | null;
  },
) {
  const delivery = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM fedramp_message_deliveries
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, input.deliveryId)
    .first<DeliveryRow>();

  if (!delivery) {
    fedrampError(404, 'delivery_not_found', 'The requested FedRAMP delivery does not exist.');
  }

  const updatedAt = nowIso();
  const deliveryLog = asJson<Record<string, unknown>>(delivery.delivery_log_json, {});
  deliveryLog.failureReason = input.failureReason ?? 'Delivery failed';
  deliveryLog.failedAt = updatedAt;

  await env.D1_MAIN.prepare(
    `
    UPDATE fedramp_message_deliveries
    SET delivery_status = 'failed', confirmed_at = ?, confirmed_by = ?, confirmation_method = ?, delivery_log_json = ?, updated_at = ?
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(
      updatedAt,
      input.confirmedBy ?? null,
      input.confirmationMethod ?? 'manual_failure',
      JSON.stringify(deliveryLog),
      updatedAt,
      tenantId,
      input.deliveryId,
    )
    .run();

  await updateMessageDeliveryStatuses(env, tenantId, delivery.message_id);
  return env.D1_MAIN.prepare(`SELECT * FROM fedramp_message_deliveries WHERE id = ? LIMIT 1`).bind(input.deliveryId).first<DeliveryRow>();
}

export async function createAgencyContact(
  env: EnvBindings,
  tenantId: string,
  userId: string,
  input: {
    agencyName?: string;
    contactName?: string;
    contactEmail?: string;
    role?: string;
    incidentEmail?: string | null;
    notes?: string | null;
  },
) {
  const offering = await ensureTrustCenterOffering(env, tenantId, userId);
  const createdAt = nowIso();
  const row: ContactRow = {
    id: crypto.randomUUID(),
    offering_id: offering.id,
    tenant_id: tenantId,
    agency_name: input.agencyName?.trim() || 'Agency reviewer',
    contact_name: input.contactName?.trim() || 'Agency contact',
    contact_email: input.contactEmail?.trim() || 'agency@example.gov',
    role: input.role?.trim() || 'security-reviewer',
    incident_email: input.incidentEmail ?? null,
    notes: input.notes ?? null,
    created_at: createdAt,
    updated_at: createdAt,
  };

  await env.D1_MAIN.prepare(
    `
    INSERT INTO agency_contacts (
      id, offering_id, tenant_id, agency_name, contact_name, contact_email, role, incident_email, notes, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      row.id,
      row.offering_id,
      row.tenant_id,
      row.agency_name,
      row.contact_name,
      row.contact_email,
      row.role,
      row.incident_email,
      row.notes,
      row.created_at,
      row.updated_at,
    )
    .run();

  return row;
}

export async function createIncidentNotification(
  env: EnvBindings,
  tenantId: string,
  userId: string,
  input: {
    incidentTitle?: string;
    incidentState?: string;
    reportedToFedrampAt?: string | null;
    reportedToCisaAt?: string | null;
    agencyNotifiedAt?: string | null;
    finalReportDueAt?: string | null;
    updateCadenceHours?: number;
    fedrampReportStatus?: FedrampReportStatus;
    cisaReportStatus?: FedrampReportStatus;
    agencyReportStatus?: FedrampReportStatus;
    summary?: Record<string, unknown>;
  },
) {
  const offering = await ensureTrustCenterOffering(env, tenantId, userId);
  const createdAt = nowIso();
  const rowId = crypto.randomUUID();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO incident_notifications (
      id, offering_id, tenant_id, message_id, incident_title, incident_state, reported_to_fedramp_at, reported_to_cisa_at,
      agency_notified_at, final_report_due_at, update_cadence_hours, fedramp_report_status, cisa_report_status,
      agency_report_status, summary_json, created_at, updated_at
    )
    VALUES (
      ?, ?, ?, NULL,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    `,
  )
    .bind(
      rowId,
      offering.id,
      tenantId,
      input.incidentTitle?.trim() || 'Incident notification',
      input.incidentState?.trim() || 'identified',
      input.reportedToFedrampAt ?? null,
      input.reportedToCisaAt ?? null,
      input.agencyNotifiedAt ?? null,
      input.finalReportDueAt ?? addDays(createdAt, 7),
      input.updateCadenceHours ?? 24,
      input.fedrampReportStatus ?? 'queued',
      input.cisaReportStatus ?? 'not_required',
      input.agencyReportStatus ?? 'queued',
      JSON.stringify(input.summary ?? {}),
      createdAt,
      createdAt,
    )
    .run();

  return env.D1_MAIN.prepare(`SELECT * FROM incident_notifications WHERE id = ? LIMIT 1`).bind(rowId).first<IncidentRow>();
}

export async function queueIncidentNotification(
  env: EnvBindings,
  tenantId: string,
  incidentId: string,
) {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM incident_notifications
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, incidentId)
    .first<IncidentRow>();

  if (!row) {
    fedrampError(404, 'incident_not_found', 'The requested incident notification does not exist.');
  }

  await env.D1_MAIN.prepare(
    `
    UPDATE incident_notifications
    SET fedramp_report_status = CASE
          WHEN fedramp_report_status = 'not_required' THEN 'not_required'
          ELSE 'queued'
        END,
        cisa_report_status = CASE
          WHEN cisa_report_status = 'confirmed' THEN 'confirmed'
          ELSE cisa_report_status
        END,
        agency_report_status = CASE
          WHEN agency_report_status = 'not_required' THEN 'not_required'
          ELSE 'queued'
        END,
        updated_at = ?
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(nowIso(), tenantId, incidentId)
    .run();

  return env.D1_MAIN.prepare(`SELECT * FROM incident_notifications WHERE id = ? LIMIT 1`).bind(incidentId).first<IncidentRow>();
}

async function confirmIncidentChannel(
  env: EnvBindings,
  tenantId: string,
  incidentId: string,
  channel: 'fedramp' | 'cisa' | 'agencies',
) {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM incident_notifications
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, incidentId)
    .first<IncidentRow>();

  if (!row) {
    fedrampError(404, 'incident_not_found', 'The requested incident notification does not exist.');
  }

  const updatedAt = nowIso();
  const column =
    channel === 'fedramp'
      ? 'reported_to_fedramp_at'
      : channel === 'cisa'
        ? 'reported_to_cisa_at'
        : 'agency_notified_at';
  const statusColumn =
    channel === 'fedramp'
      ? 'fedramp_report_status'
      : channel === 'cisa'
        ? 'cisa_report_status'
        : 'agency_report_status';
  await env.D1_MAIN.prepare(
    `
    UPDATE incident_notifications
    SET ${column} = COALESCE(${column}, ?), ${statusColumn} = 'confirmed', updated_at = ?
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(updatedAt, updatedAt, tenantId, incidentId)
    .run();

  return env.D1_MAIN.prepare(`SELECT * FROM incident_notifications WHERE id = ? LIMIT 1`).bind(incidentId).first<IncidentRow>();
}

export async function confirmIncidentFedrampReport(env: EnvBindings, tenantId: string, incidentId: string) {
  return confirmIncidentChannel(env, tenantId, incidentId, 'fedramp');
}

export async function confirmIncidentCisaReport(env: EnvBindings, tenantId: string, incidentId: string) {
  return confirmIncidentChannel(env, tenantId, incidentId, 'cisa');
}

export async function confirmIncidentAgencyNotifications(env: EnvBindings, tenantId: string, incidentId: string) {
  return confirmIncidentChannel(env, tenantId, incidentId, 'agencies');
}

export async function createSecureConfigGuide(
  env: EnvBindings,
  tenantId: string,
  userId: string,
  input: {
    title?: string;
    summary?: string | null;
    guideMarkdown?: string;
    machine?: Record<string, unknown>;
    accessInstructions?: string | null;
    currentSettings?: Record<string, unknown>;
  },
) {
  const offering = await ensureTrustCenterOffering(env, tenantId, userId);
  const createdAt = nowIso();
  const guideId = crypto.randomUUID();
  const liveCurrentSettings = await deriveCurrentSecureConfigSnapshot(env, tenantId);
  await env.D1_MAIN.prepare(
    `
    INSERT INTO secure_config_guides (
      id, offering_id, tenant_id, title, summary, guide_markdown, machine_json, access_instructions,
      current_settings_json, created_by_user_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      guideId,
      offering.id,
      tenantId,
      input.title?.trim() || `${offering.name} Secure Configuration Guide`,
      input.summary ?? null,
      input.guideMarkdown ?? '# Secure Configuration Guide\n',
      JSON.stringify(input.machine ?? {}),
      input.accessInstructions ?? null,
      JSON.stringify({
        ...liveCurrentSettings,
        ...(input.currentSettings ?? {}),
      }),
      userId,
      createdAt,
      createdAt,
    )
    .run();

  await publishSecureConfigurationArtifact(env, offering, userId);
  return env.D1_MAIN.prepare(`SELECT * FROM secure_config_guides WHERE id = ? LIMIT 1`).bind(guideId).first<GuideRow>();
}

export async function createSecureDefaultRelease(
  env: EnvBindings,
  tenantId: string,
  userId: string,
  input: {
    guideId?: string;
    versionLabel?: string;
    defaults?: Record<string, unknown>;
    releaseNotes?: string | null;
  },
) {
  const guide =
    input.guideId?.trim()
      ? await env.D1_MAIN.prepare(`SELECT * FROM secure_config_guides WHERE tenant_id = ? AND id = ? LIMIT 1`).bind(tenantId, input.guideId.trim()).first<GuideRow>()
      : await env.D1_MAIN.prepare(`SELECT * FROM secure_config_guides WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 1`).bind(tenantId).first<GuideRow>();

  if (!guide) {
    fedrampError(409, 'guide_required', 'Create a secure configuration guide before publishing a secure default release.');
  }

  const createdAt = nowIso();
  const releaseId = crypto.randomUUID();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO secure_default_releases (
      id, tenant_id, guide_id, version_label, defaults_json, release_notes, released_at, created_by_user_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      releaseId,
      tenantId,
      guide.id,
      input.versionLabel?.trim() || createdAt.slice(0, 10),
      JSON.stringify(input.defaults ?? {}),
      input.releaseNotes ?? null,
      createdAt,
      userId,
      createdAt,
      createdAt,
    )
    .run();

  const offering = await ensureTrustCenterOffering(env, tenantId, userId);
  await publishSecureConfigurationArtifact(env, offering, userId);
  return env.D1_MAIN.prepare(`SELECT * FROM secure_default_releases WHERE id = ? LIMIT 1`).bind(releaseId).first<SecureDefaultReleaseRow>();
}

async function publishSecureConfigurationArtifact(
  env: EnvBindings,
  offering: OfferingRow,
  createdByUserId: string | null,
) {
  const guide = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM secure_config_guides
    WHERE tenant_id = ?
    ORDER BY updated_at DESC
    LIMIT 1
    `,
  )
    .bind(offering.tenant_id)
    .first<GuideRow>();
  if (!guide) {
    return null;
  }
  const releases = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM secure_default_releases
    WHERE tenant_id = ? AND guide_id = ?
    ORDER BY released_at DESC
    LIMIT 20
    `,
  )
    .bind(offering.tenant_id, guide.id)
    .all<SecureDefaultReleaseRow>();

  const currentSettings = await deriveCurrentSecureConfigSnapshot(env, offering.tenant_id);
  await env.D1_MAIN.prepare(
    `
    UPDATE secure_config_guides
    SET current_settings_json = ?, updated_at = ?
    WHERE id = ?
    `,
  )
    .bind(JSON.stringify(currentSettings), nowIso(), guide.id)
    .run();
  const latestDefaults = releases.results[0] ? asJson<Record<string, unknown>>(releases.results[0].defaults_json, {}) : {};
  const currentVsDefaultDiff = buildSettingDiff(currentSettings, latestDefaults);

  const artifact = await recordArtifactVersion(env, {
    tenantId: offering.tenant_id,
    offeringId: offering.id,
    artifactKind: 'secure_configuration_guide',
    title: guide.title,
    versionLabel: releases.results[0]?.version_label ?? monthKey(),
    summary: guide.summary ?? 'Current secure configuration guide and default release history.',
    isPublic: true,
    audience: 'public',
    createdByUserId,
    objectPayload: {
      artifactKind: 'secure_configuration_guide',
      generatedAt: nowIso(),
      humanReadable: {
        markdown: guide.guide_markdown,
      },
      machineReadable: {
        title: guide.title,
        summary: guide.summary,
        accessInstructions: guide.access_instructions,
        currentSettings,
        latestDefaults,
        currentVsDefaultDiff,
        releases: releases.results.map((item) => ({
          id: item.id,
          versionLabel: item.version_label,
          releasedAt: item.released_at,
          releaseNotes: item.release_notes,
          defaults: asJson<Record<string, unknown>>(item.defaults_json, {}),
        })),
      },
    },
  });

  await env.D1_MAIN.prepare(
    `
    UPDATE secure_config_guides
    SET artifact_version_id = ?, updated_at = ?
    WHERE id = ?
    `,
  )
    .bind(artifact.id, nowIso(), guide.id)
    .run();
  return artifact;
}

async function deriveScopeScaffold(env: EnvBindings, tenantId: string, offeringName: string) {
  const [perimeters, bias, solutions, evidenceSources] = await Promise.all([
    env.D1_MAIN.prepare(
      `
      SELECT id, name, description, lc_status
      FROM perimeters
      WHERE tenant_id = ?
      ORDER BY updated_at DESC
      LIMIT 20
      `,
    )
      .bind(tenantId)
      .all<ScopePerimeterSignalRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT
        analysis.id,
        analysis.name,
        analysis.description,
        perimeter_item.name AS perimeter_name,
        analysis.asset_assessments_json
      FROM business_impact_analyses AS analysis
      LEFT JOIN perimeters AS perimeter_item
        ON perimeter_item.id = analysis.perimeter_id
      WHERE analysis.tenant_id = ?
      ORDER BY analysis.updated_at DESC
      LIMIT 20
      `,
    )
      .bind(tenantId)
      .all<BiaSignalRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT
        solution.id,
        solution.name AS solution_name,
        solution.description AS solution_description,
        entity.name AS provider_name,
        solution.dora_ict_service_type,
        solution.asset_refs_json
      FROM solutions AS solution
      INNER JOIN entities AS entity
        ON entity.id = solution.provider_entity_id
      WHERE solution.tenant_id = ?
      ORDER BY solution.updated_at DESC
      LIMIT 30
      `,
    )
      .bind(tenantId)
      .all<ScopeSolutionSignalRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT id, name, provider, config_json
      FROM evidence_sources
      WHERE tenant_id = ? AND is_active = 1
      ORDER BY updated_at DESC
      LIMIT 20
      `,
    )
      .bind(tenantId)
      .all<EvidenceSourceSignalRow>(),
  ]);

  const resourceFlows = [
    ...perimeters.results.map((item) => ({
      resourceName: item.name,
      resourceType: 'service-boundary',
      securityObjectives: ['confidentiality', 'integrity', 'availability'],
      handlesFederalData: true,
      metadataInScope: true,
      flowSummary: item.description ?? `Perimeter status: ${item.lc_status}.`,
      upstreamResources: [],
      downstreamResources: evidenceSources.results.map((source) => source.name),
    })),
    ...evidenceSources.results.map((item) => ({
      resourceName: item.name,
      resourceType: 'evidence-collector',
      securityObjectives: ['integrity', 'availability'],
      handlesFederalData: false,
      metadataInScope: true,
      flowSummary: `${item.provider} evidence source used for persistent validation and reporting.`,
      upstreamResources: perimeters.results.map((perimeter) => perimeter.name),
      downstreamResources: ['Assurance package pipeline'],
    })),
  ];

  const thirdPartyResources = solutions.results.map((item) => ({
    name: item.solution_name,
    provider: item.provider_name,
    usageSummary: item.solution_description ?? item.dora_ict_service_type ?? 'Third-party technology dependency.',
    justification: `Supports ${offeringName} service delivery and evidence-backed authorization workflows.`,
    mitigations: ['Contract review', 'Configuration review', 'Scope tracking'],
    compensatingControls: ['Assurance package monitoring', 'Quarterly review coverage'],
  }));

  const narrativeMarkdown = [
    '# Minimum Assessment Scope',
    '',
    `This scope document was scaffolded from live tenant records for ${offeringName}.`,
    '',
    '## In-scope perimeters',
    ...(perimeters.results.length > 0
      ? perimeters.results.map((item) => `- **${item.name}** (${item.lc_status}): ${item.description ?? 'No summary recorded.'}`)
      : ['- No perimeter records are available yet.']),
    '',
    '## Business impact analyses',
    ...(bias.results.length > 0
      ? bias.results.map((item) => `- **${item.name}**${item.perimeter_name ? ` for ${item.perimeter_name}` : ''}`)
      : ['- No business impact analyses are available yet.']),
    '',
    '## Third-party information resources',
    ...(thirdPartyResources.length > 0
      ? thirdPartyResources.map((item) => `- **${item.name}** provided by ${item.provider ?? 'unknown provider'}`)
      : ['- No third-party resources are recorded yet.']),
  ].join('\n');

  return {
    narrativeMarkdown,
    metadata: {
      derived: {
        perimeterCount: perimeters.results.length,
        businessImpactAnalysisCount: bias.results.length,
        thirdPartyResourceCount: thirdPartyResources.length,
        evidenceSourceCount: evidenceSources.results.length,
      },
      sectionModes: {
        narrative: 'derived',
        resourceFlows: 'derived',
        thirdPartyResources: 'derived',
      },
    },
    resourceFlows,
    thirdPartyResources,
  };
}

export async function createScopeDocument(
  env: EnvBindings,
  tenantId: string,
  userId: string,
  input: {
    title?: string;
    status?: string;
    narrativeMarkdown?: string;
    metadata?: Record<string, unknown>;
    resourceFlows?: Array<{
      resourceName: string;
      resourceType: string;
      securityObjectives?: string[];
      handlesFederalData?: boolean;
      metadataInScope?: boolean;
      flowSummary?: string | null;
      upstreamResources?: string[];
      downstreamResources?: string[];
    }>;
    thirdPartyResources?: Array<{
      name: string;
      provider?: string | null;
      usageSummary?: string | null;
      justification?: string | null;
      mitigations?: string[];
      compensatingControls?: string[];
    }>;
  },
) {
  const offering = await ensureTrustCenterOffering(env, tenantId, userId);
  const derived = await deriveScopeScaffold(env, tenantId, offering.name);
  const createdAt = nowIso();
  const scopeId = crypto.randomUUID();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO scope_documents (
      id, offering_id, tenant_id, title, status, narrative_markdown, metadata_json, created_by_user_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      scopeId,
      offering.id,
      tenantId,
      input.title?.trim() || `${offering.name} Scope Document`,
      input.status?.trim() || 'draft',
      input.narrativeMarkdown ?? derived.narrativeMarkdown,
      JSON.stringify({
        ...derived.metadata,
        ...(input.metadata ?? {}),
        sectionModes: {
          ...normalizeObject((derived.metadata as Record<string, unknown>).sectionModes),
          ...(normalizeObject(input.metadata).sectionModes as Record<string, unknown> | undefined),
          narrative: input.narrativeMarkdown ? 'manual' : 'derived',
          resourceFlows: input.resourceFlows?.length ? 'manual' : 'derived',
          thirdPartyResources: input.thirdPartyResources?.length ? 'manual' : 'derived',
        },
      }),
      userId,
      createdAt,
      createdAt,
    )
    .run();

  for (const flow of input.resourceFlows ?? derived.resourceFlows) {
    await env.D1_MAIN.prepare(
      `
      INSERT INTO resource_flows (
        id, tenant_id, scope_document_id, resource_name, resource_type, security_objectives_json,
        handles_federal_data, metadata_in_scope, flow_summary, upstream_resources_json, downstream_resources_json,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        crypto.randomUUID(),
        tenantId,
        scopeId,
        flow.resourceName,
        flow.resourceType,
        JSON.stringify(flow.securityObjectives ?? []),
        flow.handlesFederalData === true ? 1 : 0,
        flow.metadataInScope === false ? 0 : 1,
        flow.flowSummary ?? null,
        JSON.stringify(flow.upstreamResources ?? []),
        JSON.stringify(flow.downstreamResources ?? []),
        createdAt,
        createdAt,
      )
      .run();
  }

  for (const thirdParty of input.thirdPartyResources ?? derived.thirdPartyResources) {
    await env.D1_MAIN.prepare(
      `
      INSERT INTO third_party_resources (
        id, tenant_id, scope_document_id, name, provider, usage_summary, justification, mitigations_json,
        compensating_controls_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        crypto.randomUUID(),
        tenantId,
        scopeId,
        thirdParty.name,
        thirdParty.provider ?? null,
        thirdParty.usageSummary ?? null,
        thirdParty.justification ?? null,
        JSON.stringify(thirdParty.mitigations ?? []),
        JSON.stringify(thirdParty.compensatingControls ?? []),
        createdAt,
        createdAt,
      )
      .run();
  }

  await publishScopeArtifact(env, offering, userId);
  return env.D1_MAIN.prepare(`SELECT * FROM scope_documents WHERE id = ? LIMIT 1`).bind(scopeId).first<ScopeDocumentRow>();
}

async function publishScopeArtifact(
  env: EnvBindings,
  offering: OfferingRow,
  createdByUserId: string | null,
) {
  const document = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM scope_documents
    WHERE tenant_id = ?
    ORDER BY updated_at DESC
    LIMIT 1
    `,
  )
    .bind(offering.tenant_id)
    .first<ScopeDocumentRow>();
  if (!document) {
    return null;
  }

  const [flows, thirdParties] = await Promise.all([
    env.D1_MAIN.prepare(`SELECT * FROM resource_flows WHERE tenant_id = ? AND scope_document_id = ? ORDER BY updated_at DESC`).bind(offering.tenant_id, document.id).all<ResourceFlowRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM third_party_resources WHERE tenant_id = ? AND scope_document_id = ? ORDER BY updated_at DESC`).bind(offering.tenant_id, document.id).all<ThirdPartyResourceRow>(),
  ]);

  const scopeMetadata = asJson<Record<string, unknown>>(document.metadata_json, {});
  const fullArtifact = await recordArtifactVersion(env, {
    tenantId: offering.tenant_id,
    offeringId: offering.id,
    artifactKind: 'scope_document',
    title: document.title,
    versionLabel: monthKey(),
    summary: 'Minimum assessment scope document, resource flows, and third-party justifications.',
    isPublic: false,
    audience: 'necessary-parties',
    createdByUserId,
    objectPayload: {
      artifactKind: 'scope_document',
      generatedAt: nowIso(),
      humanReadable: {
        markdown: document.narrative_markdown,
      },
      machineReadable: {
        document: {
          id: document.id,
          title: document.title,
          status: document.status,
          metadata: scopeMetadata,
        },
        resourceFlows: flows.results.map((item) => ({
          id: item.id,
          resourceName: item.resource_name,
          resourceType: item.resource_type,
          securityObjectives: asJson<string[]>(item.security_objectives_json, []),
          handlesFederalData: item.handles_federal_data === 1,
          metadataInScope: item.metadata_in_scope === 1,
          flowSummary: item.flow_summary,
          upstreamResources: asJson<string[]>(item.upstream_resources_json, []),
          downstreamResources: asJson<string[]>(item.downstream_resources_json, []),
        })),
        thirdPartyResources: thirdParties.results.map((item) => ({
          id: item.id,
          name: item.name,
          provider: item.provider,
          usageSummary: item.usage_summary,
          justification: item.justification,
          mitigations: asJson<string[]>(item.mitigations_json, []),
          compensatingControls: asJson<string[]>(item.compensating_controls_json, []),
        })),
      },
    },
  });

  const derived = normalizeObject(scopeMetadata.derived);
  const publicSummary = await recordArtifactVersion(env, {
    tenantId: offering.tenant_id,
    offeringId: offering.id,
    artifactKind: 'scope_summary',
    title: `${document.title} Public Summary`,
    versionLabel: monthKey(),
    summary: 'Sanitized public minimum assessment scope summary.',
    isPublic: true,
    audience: 'public',
    publicationState: 'published',
    generationSource: 'manual',
    createdByUserId,
    objectPayload: {
      artifactKind: 'scope_summary',
      generatedAt: nowIso(),
      humanReadable: {
        markdown: [
          '# Minimum Assessment Scope Summary',
          '',
          `- Document: ${document.title}`,
          `- Status: ${document.status}`,
          `- Resource flows: ${flows.results.length}`,
          `- Third-party resources: ${thirdParties.results.length}`,
          `- Perimeters represented: ${String(derived.perimeterCount ?? 0)}`,
          `- Business impact analyses represented: ${String(derived.businessImpactAnalysisCount ?? 0)}`,
        ].join('\n'),
      },
      machineReadable: {
        document: {
          id: document.id,
          title: document.title,
          status: document.status,
        },
        summary: {
          resourceFlowCount: flows.results.length,
          thirdPartyResourceCount: thirdParties.results.length,
          perimeterCount: Number(derived.perimeterCount ?? 0),
          businessImpactAnalysisCount: Number(derived.businessImpactAnalysisCount ?? 0),
          entityCount: Number(derived.entityCount ?? 0),
          evidenceSourceCount: Number(derived.evidenceSourceCount ?? 0),
        },
      },
    },
  });
  await supersedeArtifactVersions(env, {
    tenantId: offering.tenant_id,
    artifactKind: 'scope_summary',
    currentArtifactId: publicSummary.id,
  });

  await env.D1_MAIN.prepare(`UPDATE scope_documents SET artifact_version_id = ?, updated_at = ? WHERE id = ?`).bind(fullArtifact.id, nowIso(), document.id).run();
  return fullArtifact;
}

export async function createCryptoModuleInventoryRecord(
  env: EnvBindings,
  tenantId: string,
  userId: string,
  input: {
    serviceId?: string | null;
    serviceName?: string;
    moduleName?: string;
    moduleVersion?: string | null;
    cmvpCertificate?: string | null;
    validationStatus?: string;
    validationProvenance?: string | null;
    updateStream?: string | null;
    protectsFederalData?: boolean;
    tenantDefaultEnabled?: boolean;
    notes?: string | null;
  },
) {
  const offering = await ensureTrustCenterOffering(env, tenantId, userId);
  const service =
    input.serviceId?.trim()
      ? await env.D1_MAIN.prepare(`SELECT * FROM trust_center_services WHERE tenant_id = ? AND id = ? LIMIT 1`).bind(tenantId, input.serviceId.trim()).first<ServiceRow>()
      : await ensureDefaultTrustCenterService(env, offering);
  const createdAt = nowIso();
  const rowId = crypto.randomUUID();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO crypto_module_inventory (
      id, offering_id, service_id, tenant_id, service_name, module_name, module_version, cmvp_certificate,
      validation_status, validation_provenance, update_stream, protects_federal_data, tenant_default_enabled, notes,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      rowId,
      offering.id,
      service?.id ?? null,
      tenantId,
      input.serviceName?.trim() || service?.name || `${offering.name} service`,
      input.moduleName?.trim() || 'Documented cryptographic module',
      input.moduleVersion ?? null,
      input.cmvpCertificate ?? null,
      input.validationStatus?.trim() || 'documented',
      input.validationProvenance ?? (input.cmvpCertificate ? 'cmvp-certificate' : 'provider-attestation'),
      input.updateStream ?? null,
      input.protectsFederalData === false ? 0 : 1,
      input.tenantDefaultEnabled === false ? 0 : 1,
      input.notes ?? null,
      createdAt,
      createdAt,
    )
    .run();

  await publishCryptoInventoryArtifact(env, offering, userId);
  return env.D1_MAIN.prepare(`SELECT * FROM crypto_module_inventory WHERE id = ? LIMIT 1`).bind(rowId).first<CryptoModuleRow>();
}

async function publishCryptoInventoryArtifact(
  env: EnvBindings,
  offering: OfferingRow,
  createdByUserId: string | null,
) {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM crypto_module_inventory
    WHERE tenant_id = ?
    ORDER BY updated_at DESC
    LIMIT 100
    `,
  )
    .bind(offering.tenant_id)
    .all<CryptoModuleRow>();

  if (rows.results.length === 0) {
    return null;
  }

  return recordArtifactVersion(env, {
    tenantId: offering.tenant_id,
    offeringId: offering.id,
    artifactKind: 'crypto_inventory',
    title: `${offering.name} Crypto Inventory`,
    versionLabel: monthKey(),
    summary: 'Cryptographic module inventory and tenant default crypto posture.',
    isPublic: false,
    audience: 'necessary-parties',
    createdByUserId,
    objectPayload: {
      artifactKind: 'crypto_inventory',
      generatedAt: nowIso(),
      humanReadable: {
        markdown: [
          '# Cryptographic Module Inventory',
          '',
          ...rows.results.map((item) => `- **${item.service_name}** uses ${item.module_name} (${item.validation_status})`),
        ].join('\n'),
      },
      machineReadable: {
        modules: rows.results.map((item) => ({
          id: item.id,
          serviceId: item.service_id,
          serviceName: item.service_name,
          moduleName: item.module_name,
          moduleVersion: item.module_version,
          cmvpCertificate: item.cmvp_certificate,
          validationStatus: item.validation_status,
          validationProvenance: item.validation_provenance,
          updateStream: item.update_stream,
          protectsFederalData: item.protects_federal_data === 1,
          tenantDefaultEnabled: item.tenant_default_enabled === 1,
          notes: item.notes,
        })),
        tenantDefaultCryptoPosture: {
          enabledByDefaultCount: rows.results.filter((item) => item.tenant_default_enabled === 1).length,
          protectsFederalDataCount: rows.results.filter((item) => item.protects_federal_data === 1).length,
        },
      },
    },
  });
}

export async function publishAssurancePackageToFedrampShell(
  env: EnvBindings,
  input: {
    tenantId: string;
    userId: string;
    packageJobId: string;
  },
) {
  const { offering, defaultService } = await seedFedrampBaselines(env, input.tenantId, input.userId);
  const packageRow = await env.D1_MAIN.prepare(
    `
    SELECT id, file_name, artifact_key, manifest_key, coverage_json, source_record, created_at, updated_at
    FROM ai_compliance_export_jobs
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(input.tenantId, input.packageJobId)
    .first<PackageRow>();

  if (!packageRow) {
    fedrampError(404, 'package_not_found', `Package job ${input.packageJobId} could not be published because it does not exist.`);
  }

  const links: ArtifactReference[] = [];
  const serviceList = await publishServiceCatalogArtifact(env, offering, input.userId);
  if (serviceList) {
    links.push({
      artifactKind: 'service_list',
      artifactId: serviceList.id,
      title: serviceList.title,
      versionLabel: serviceList.version_label,
      publicationState: serviceList.publication_state,
      generationSource: serviceList.generation_source,
      route: buildTrustCenterArtifactRoute(serviceList.id),
    });
  }

  const packageArtifact = await buildAssurancePackageArtifactLinks(env, offering, packageRow, input.userId);
  if (packageArtifact) {
    links.push({
      artifactKind: 'assurance_package',
      artifactId: packageArtifact.id,
      title: packageArtifact.title,
      versionLabel: packageArtifact.version_label,
      publicationState: packageArtifact.publication_state,
      generationSource: packageArtifact.generation_source,
    });
  }

  const vdrReport = await generateVdrReport(env, input.tenantId, input.userId, {
    publicationState: 'working',
    generationSource: 'package_publication',
  });
  if (vdrReport?.artifact_version_id) {
    const artifact = await env.D1_MAIN.prepare(`SELECT * FROM artifact_versions WHERE id = ? LIMIT 1`).bind(vdrReport.artifact_version_id).first<ArtifactRow>();
    if (artifact) {
      links.push({
        artifactKind: 'vdr_report',
        artifactId: artifact.id,
        title: artifact.title,
        versionLabel: artifact.version_label,
        publicationState: artifact.publication_state,
        generationSource: artifact.generation_source,
      });
    }
  }

  const oar = await generateOarCycle(env, input.tenantId, input.userId, {
    publicationState: 'working',
    generationSource: 'package_publication',
    sourcePackageJobId: input.packageJobId,
  });
  if (oar.cycle?.artifact_version_id) {
    const artifact = await env.D1_MAIN.prepare(`SELECT * FROM artifact_versions WHERE id = ? LIMIT 1`).bind(oar.cycle.artifact_version_id).first<ArtifactRow>();
    if (artifact) {
      links.push({
        artifactKind: 'oar',
        artifactId: artifact.id,
        title: artifact.title,
        versionLabel: artifact.version_label,
        publicationState: artifact.publication_state,
        generationSource: artifact.generation_source,
      });
    }
  }

  const latestScnArtifact = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM artifact_versions
    WHERE tenant_id = ? AND artifact_kind = 'scn_history'
    ORDER BY published_at DESC, updated_at DESC
    LIMIT 1
    `,
  )
    .bind(input.tenantId)
    .first<ArtifactRow>();
  if (latestScnArtifact) {
    links.push({
      artifactKind: 'scn_history',
      artifactId: latestScnArtifact.id,
      title: latestScnArtifact.title,
      versionLabel: latestScnArtifact.version_label,
      publicationState: latestScnArtifact.publication_state,
      generationSource: latestScnArtifact.generation_source,
    });
  }

  const secureArtifact = await publishSecureConfigurationArtifact(env, offering, input.userId);
  if (secureArtifact) {
    links.push({
      artifactKind: 'secure_configuration_guide',
      artifactId: secureArtifact.id,
      title: secureArtifact.title,
      versionLabel: secureArtifact.version_label,
      publicationState: secureArtifact.publication_state,
      generationSource: secureArtifact.generation_source,
      route: secureArtifact.is_public === 1 ? buildTrustCenterArtifactRoute(secureArtifact.id) : undefined,
    });
  }

  const scopeArtifact = await publishScopeArtifact(env, offering, input.userId);
  if (scopeArtifact) {
    links.push({
      artifactKind: 'scope_document',
      artifactId: scopeArtifact.id,
      title: scopeArtifact.title,
      versionLabel: scopeArtifact.version_label,
      publicationState: scopeArtifact.publication_state,
      generationSource: scopeArtifact.generation_source,
    });
  }

  const cryptoArtifact = await publishCryptoInventoryArtifact(env, offering, input.userId);
  if (cryptoArtifact) {
    links.push({
      artifactKind: 'crypto_inventory',
      artifactId: cryptoArtifact.id,
      title: cryptoArtifact.title,
      versionLabel: cryptoArtifact.version_label,
      publicationState: cryptoArtifact.publication_state,
      generationSource: cryptoArtifact.generation_source,
    });
  }

  const packageDocument = await getJsonArtifact<Record<string, unknown>>(env, packageRow.artifact_key);
  if (packageDocument) {
    const metadata = normalizeObject(packageDocument.metadata);
    metadata.provider_process_artifacts = links.map((item) => ({
      kind: item.artifactKind,
      artifact_id: item.artifactId,
      title: item.title,
      version: item.versionLabel,
      publication_state: item.publicationState,
      generation_source: item.generationSource,
    }));
    metadata.trust_center = {
      offering_id: offering.id,
      service_id: defaultService.id,
      public_manifest_route: buildTrustCenterPublicManifestRoute(offering.slug),
    };
    packageDocument.metadata = metadata;
    await putJsonArtifact(env, packageRow.artifact_key ?? `packages/${input.tenantId}/${packageRow.id}.json`, packageDocument);
    if (packageArtifact) {
      if (!packageArtifact.object_key) {
        fedrampError(
          409,
          'artifact_storage_missing',
          'The published assurance-package artifact is missing its backing object payload.',
        );
      }
      const packageArtifactPayload =
        (await getJsonArtifact<Record<string, unknown>>(env, packageArtifact.object_key)) ?? {};
      const machineReadable = normalizeObject(packageArtifactPayload.machineReadable);
      machineReadable.packageDocument = packageDocument;
      packageArtifactPayload.machineReadable = machineReadable;
      const updatedAt = nowIso();
      const sha256 = await putJsonArtifact(env, packageArtifact.object_key, packageArtifactPayload);
      await env.D1_MAIN.prepare(
        `
        UPDATE artifact_versions
        SET sha256 = ?, updated_at = ?
        WHERE id = ?
        `,
      )
        .bind(sha256, updatedAt, packageArtifact.id)
        .run();
    }
  }

  return {
    offeringId: offering.id,
    serviceId: defaultService.id,
    publishedArtifactLinks: links,
  };
}

function artifactSummary(
  row: ArtifactRow,
  options: {
    grantId?: string | null;
    portalToken?: string | null;
    includeRoute?: boolean;
  } = {},
) {
  return {
    id: row.id,
    artifactKind: row.artifact_kind,
    title: row.title,
    versionLabel: row.version_label,
    summary: row.summary,
    status: row.status,
    isPublic: row.is_public === 1,
    audience: row.audience,
    publishedAt: row.published_at ?? row.updated_at,
    publicationState: row.publication_state,
    generationSource: row.generation_source,
    route: options.includeRoute === false ? null : buildTrustCenterArtifactRoute(row.id, options),
    metadata: asJson<Record<string, unknown>>(row.metadata_json, {}),
  };
}

export async function loadFedrampOverview(
  env: EnvBindings,
  tenantId: string,
  userId: string,
) {
  const baselines = await seedFedrampBaselines(env, tenantId, userId);
  const offering = baselines.offering;

  const [
    services,
    artifacts,
    grants,
    eventsSummary,
    contacts,
    messages,
    deliveries,
    incidents,
    evaluations,
    vdrReports,
    oarCycles,
    quarterlyReviews,
    feedbackItems,
    changes,
    notices,
    guides,
    releases,
    scopeDocuments,
    flows,
    thirdParties,
    cryptoRows,
  ] = await Promise.all([
    env.D1_MAIN.prepare(`SELECT * FROM trust_center_services WHERE tenant_id = ? ORDER BY in_scope DESC, name ASC`).bind(tenantId).all<ServiceRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM artifact_versions WHERE tenant_id = ? ORDER BY COALESCE(published_at, updated_at) DESC LIMIT 60`).bind(tenantId).all<ArtifactRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM trust_center_access_grants WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 40`).bind(tenantId).all<GrantRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(*) AS total_count, MAX(created_at) AS latest_at FROM trust_center_access_events WHERE tenant_id = ?`).bind(tenantId).first<TimestampCountRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM agency_contacts WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 40`).bind(tenantId).all<ContactRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM fedramp_messages WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 40`).bind(tenantId).all<MessageRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM fedramp_message_deliveries WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 80`).bind(tenantId).all<DeliveryRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM incident_notifications WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 40`).bind(tenantId).all<IncidentRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM vulnerability_evaluations WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 120`).bind(tenantId).all<VdrEvaluationRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM vdr_reports WHERE tenant_id = ? ORDER BY report_month DESC LIMIT 24`).bind(tenantId).all<VdrReportRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM oar_cycles WHERE tenant_id = ? ORDER BY period_end DESC LIMIT 24`).bind(tenantId).all<OarCycleRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM quarterly_reviews WHERE tenant_id = ? ORDER BY scheduled_for DESC LIMIT 24`).bind(tenantId).all<QuarterlyReviewRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM feedback_items WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 80`).bind(tenantId).all<FeedbackItemRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM significant_changes WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 60`).bind(tenantId).all<SignificantChangeRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM significant_change_notices WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 120`).bind(tenantId).all<SignificantChangeNoticeRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM secure_config_guides WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 20`).bind(tenantId).all<GuideRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM secure_default_releases WHERE tenant_id = ? ORDER BY released_at DESC LIMIT 40`).bind(tenantId).all<SecureDefaultReleaseRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM scope_documents WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 20`).bind(tenantId).all<ScopeDocumentRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM resource_flows WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 120`).bind(tenantId).all<ResourceFlowRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM third_party_resources WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 120`).bind(tenantId).all<ThirdPartyResourceRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM crypto_module_inventory WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 60`).bind(tenantId).all<CryptoModuleRow>(),
  ]);

  const overdueDeliveries = deliveries.results.filter(
    (item) =>
      !['acknowledged', 'delivered', 'failed', 'expired'].includes(item.delivery_status) &&
      item.escalation_due_at &&
      new Date(item.escalation_due_at).getTime() < Date.now(),
  ).length;
  const latestSecureRelease = releases.results[0] ?? null;

  return {
    offering: {
      id: offering.id,
      slug: offering.slug,
      name: offering.name,
      description: offering.description,
      fedrampId: offering.fedramp_id,
      marketplaceUrl: offering.marketplace_url,
      serviceModel: offering.service_model,
      deploymentModel: offering.deployment_model,
      businessCategory: offering.business_category,
      uei: offering.uei,
      contactEmail: offering.contact_email,
      supportEmail: offering.support_email,
      trustCenterUrl: offering.trust_center_url,
      accessGuidance: offering.access_guidance,
      availabilityStatus: offering.availability_status,
      nextOarDueOn: offering.next_oar_due_on,
      nextQuarterlyReviewOn: offering.next_quarterly_review_on,
      metadata: asJson<Record<string, unknown>>(offering.metadata_json, {}),
    },
    trustCenter: {
      services: services.results.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.service_slug,
        description: row.description,
        inScope: row.in_scope === 1,
        securityObjectives: asJson<string[]>(row.security_objectives_json, []),
        customerResponsibilities: asJson<string[]>(row.customer_responsibilities_json, []),
        secureConfigurationSummary: row.secure_configuration_summary,
        tags: asJson<string[]>(row.tags_json, []),
      })),
      artifacts: artifacts.results.map((artifact) => artifactSummary(artifact)),
      grants: grants.results.map((row) => ({
        id: row.id,
        agencyName: row.agency_name,
        contactName: row.contact_name,
        contactEmail: row.contact_email,
        grantType: row.grant_type,
        status: row.status,
        tokenHint: row.token_hint,
        issuedAt: row.issued_at,
        expiresAt: row.expires_at,
        lastAccessedAt: row.last_accessed_at,
        metadata: asJson<Record<string, unknown>>(row.metadata_json, {}),
      })),
      accessSummary: {
        eventCount: Number(eventsSummary?.total_count ?? 0),
        latestEventAt: eventsSummary?.latest_at ?? null,
      },
      publicManifestRoute: buildTrustCenterPublicManifestRoute(offering.slug),
    },
    communications: {
      contacts: contacts.results.map((row) => ({
        id: row.id,
        agencyName: row.agency_name,
        contactName: row.contact_name,
        contactEmail: row.contact_email,
        role: row.role,
        incidentEmail: row.incident_email,
        notes: row.notes,
      })),
      messages: messages.results.map((row) => ({
        id: row.id,
        messageType: row.message_type,
        criticality: row.criticality,
        subject: row.subject,
        status: row.status,
        dueAt: row.due_at,
        requiredActions: asJson<Array<Record<string, unknown>>>(row.required_actions_json, []),
        metadata: asJson<Record<string, unknown>>(row.metadata_json, {}),
        createdAt: row.created_at,
      })),
      deliveries: deliveries.results.map((row) => ({
        id: row.id,
        messageId: row.message_id,
        contactId: row.contact_id,
        recipientEmail: row.recipient_email,
        deliveryStatus: row.delivery_status,
        escalationDueAt: row.escalation_due_at,
        acknowledgedAt: row.acknowledged_at,
        acknowledgedBy: row.acknowledged_by,
        confirmedAt: row.confirmed_at,
        confirmedBy: row.confirmed_by,
        confirmationMethod: row.confirmation_method,
        deliveryLog: asJson<Record<string, unknown>>(row.delivery_log_json, {}),
      })),
      incidents: incidents.results.map((row) => ({
        id: row.id,
        incidentTitle: row.incident_title,
        incidentState: row.incident_state,
        reportedToFedrampAt: row.reported_to_fedramp_at,
        reportedToCisaAt: row.reported_to_cisa_at,
        agencyNotifiedAt: row.agency_notified_at,
        finalReportDueAt: row.final_report_due_at,
        updateCadenceHours: row.update_cadence_hours,
        fedrampReportStatus: row.fedramp_report_status,
        cisaReportStatus: row.cisa_report_status,
        agencyReportStatus: row.agency_report_status,
        summary: asJson<Record<string, unknown>>(row.summary_json, {}),
      })),
      summary: {
        contactCount: contacts.results.length,
        messageCount: messages.results.length,
        incidentCount: incidents.results.length,
        overdueDeliveryCount: overdueDeliveries,
      },
    },
    vdr: {
      evaluations: evaluations.results.map((row) => ({
        id: row.id,
        sourceType: row.source_type,
        sourceRecordId: row.source_record_id,
        sourceControlId: row.source_control_id,
        title: row.title,
        detectionSource: row.detection_source,
        detectedAt: row.detected_at,
        evaluatedAt: row.evaluated_at,
        internetReachable: row.internet_reachable === 1,
        likelyExploitable: row.likely_exploitable === 1,
        adverseImpact: row.adverse_impact,
        acceptedVulnerability: row.accepted_vulnerability === 1,
        acceptedReason: row.accepted_reason,
        overdue: row.overdue === 1,
        currentStatus: row.current_status,
        nextTargetDate: row.next_target_date,
        remediationSummary: row.remediation_summary,
        details: asJson<Record<string, unknown>>(row.details_json, {}),
      })),
      reports: vdrReports.results.map((row) => ({
        id: row.id,
        reportMonth: row.report_month,
        title: row.title,
        status: row.status,
        publicationState: row.publication_state,
        generationSource: row.generation_source,
        artifactVersionId: row.artifact_version_id,
        publishedAt: row.published_at,
        summary: asJson<Record<string, unknown>>(row.report_json, {}),
      })),
    },
    ccm: {
      cycles: oarCycles.results.map((row) => ({
        id: row.id,
        cycleLabel: row.cycle_label,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        nextReportDueOn: row.next_report_due_on,
        targetReviewOn: row.target_review_on,
        feedbackChannel: row.feedback_channel,
        status: row.status,
        publicationState: row.publication_state,
        generationSource: row.generation_source,
        artifactVersionId: row.artifact_version_id,
        summary: asJson<Record<string, unknown>>(row.summary_json, {}),
      })),
      quarterlyReviews: quarterlyReviews.results.map((row) => ({
        id: row.id,
        oarCycleId: row.oar_cycle_id,
        title: row.title,
        scheduledFor: row.scheduled_for,
        registrationUrl: row.registration_url,
        recordingUrl: row.recording_url,
        transcriptUrl: row.transcript_url,
        status: row.status,
        publicationState: row.publication_state,
        generationSource: row.generation_source,
        summary: asJson<Record<string, unknown>>(row.summary_json, {}),
      })),
      feedbackItems: feedbackItems.results.map((row) => ({
        id: row.id,
        oarCycleId: row.oar_cycle_id,
        quarterlyReviewId: row.quarterly_review_id,
        submittedBy: row.is_anonymized === 1 ? 'Anonymous' : row.submitted_by,
        submittedEmail: row.is_anonymized === 1 ? null : row.submitted_email,
        question: row.question,
        response: row.response,
        status: row.status,
        createdAt: row.created_at,
      })),
    },
    scn: {
      changes: changes.results.map((row) => ({
        id: row.id,
        title: row.title,
        changeType: row.change_type,
        status: row.status,
        description: row.description,
        plannedStartOn: row.planned_start_on,
        finishedOn: row.finished_on,
        verifiedOn: row.verified_on,
        verificationSummary: row.verification_summary,
        poamRefs: asJson<string[]>(row.poam_refs_json, []),
      })),
      notices: notices.results.map((row) => ({
        id: row.id,
        significantChangeId: row.significant_change_id,
        noticeKind: row.notice_kind,
        dueOn: row.due_on,
        sentAt: row.sent_at,
        status: row.status,
        payload: asJson<Record<string, unknown>>(row.payload_json, {}),
      })),
    },
    secureConfig: {
      guides: guides.results.map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        accessInstructions: row.access_instructions,
        currentSettings: asJson<Record<string, unknown>>(row.current_settings_json, {}),
        machine: asJson<Record<string, unknown>>(row.machine_json, {}),
        currentVsDefaultDiff: buildSettingDiff(
          asJson<Record<string, unknown>>(row.current_settings_json, {}),
          latestSecureRelease ? asJson<Record<string, unknown>>(latestSecureRelease.defaults_json, {}) : {},
        ),
        artifactVersionId: row.artifact_version_id,
      })),
      releases: releases.results.map((row) => ({
        id: row.id,
        guideId: row.guide_id,
        versionLabel: row.version_label,
        defaults: asJson<Record<string, unknown>>(row.defaults_json, {}),
        releaseNotes: row.release_notes,
        releasedAt: row.released_at,
      })),
    },
    scope: {
      documents: scopeDocuments.results.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        narrativeMarkdown: row.narrative_markdown,
        metadata: asJson<Record<string, unknown>>(row.metadata_json, {}),
        artifactVersionId: row.artifact_version_id,
      })),
      resourceFlows: flows.results.map((row) => ({
        id: row.id,
        scopeDocumentId: row.scope_document_id,
        resourceName: row.resource_name,
        resourceType: row.resource_type,
        securityObjectives: asJson<string[]>(row.security_objectives_json, []),
        handlesFederalData: row.handles_federal_data === 1,
        metadataInScope: row.metadata_in_scope === 1,
        flowSummary: row.flow_summary,
        upstreamResources: asJson<string[]>(row.upstream_resources_json, []),
        downstreamResources: asJson<string[]>(row.downstream_resources_json, []),
      })),
      thirdPartyResources: thirdParties.results.map((row) => ({
        id: row.id,
        scopeDocumentId: row.scope_document_id,
        name: row.name,
        provider: row.provider,
        usageSummary: row.usage_summary,
        justification: row.justification,
        mitigations: asJson<string[]>(row.mitigations_json, []),
        compensatingControls: asJson<string[]>(row.compensating_controls_json, []),
      })),
    },
    crypto: {
      inventory: cryptoRows.results.map((row) => ({
        id: row.id,
        serviceId: row.service_id,
        serviceName: row.service_name,
        moduleName: row.module_name,
        moduleVersion: row.module_version,
        cmvpCertificate: row.cmvp_certificate,
        validationStatus: row.validation_status,
        validationProvenance: row.validation_provenance,
        updateStream: row.update_stream,
        protectsFederalData: row.protects_federal_data === 1,
        tenantDefaultEnabled: row.tenant_default_enabled === 1,
        notes: row.notes,
        artifactVersionId: row.artifact_version_id,
      })),
    },
  };
}

async function loadOfferingBySlug(env: EnvBindings, tenantSlug: string) {
  return env.D1_MAIN.prepare(
    `
    SELECT offering.*
    FROM trust_center_offerings AS offering
    INNER JOIN tenants AS tenant
      ON tenant.id = offering.tenant_id
    WHERE tenant.slug = ?
    LIMIT 1
    `,
  )
    .bind(tenantSlug)
    .first<OfferingRow>();
}

async function buildTrustCenterPublicPayload(
  env: EnvBindings,
  offering: OfferingRow,
  audience: AudienceMode,
  options: {
    grantId?: string | null;
    portalToken?: string | null;
  } = {},
) {
  const [services, artifacts, cycles, reviews] = await Promise.all([
    env.D1_MAIN.prepare(`SELECT * FROM trust_center_services WHERE offering_id = ? ORDER BY in_scope DESC, name ASC`).bind(offering.id).all<ServiceRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT *
      FROM artifact_versions
      WHERE offering_id = ?
        AND status = 'published'
        AND publication_state = 'published'
        AND (${audience === 'public' ? 'is_public = 1' : "audience IN ('public', 'necessary-parties')"})
      ORDER BY COALESCE(published_at, updated_at) DESC
      LIMIT 80
      `,
    )
      .bind(offering.id)
      .all<ArtifactRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM oar_cycles WHERE offering_id = ? AND publication_state = 'published' ORDER BY period_end DESC LIMIT 12`).bind(offering.id).all<OarCycleRow>(),
    env.D1_MAIN.prepare(`SELECT * FROM quarterly_reviews WHERE offering_id = ? AND publication_state = 'published' ORDER BY scheduled_for DESC LIMIT 12`).bind(offering.id).all<QuarterlyReviewRow>(),
  ]);

  return {
    generatedAt: nowIso(),
    audience,
    offering: {
      slug: offering.slug,
      name: offering.name,
      description: offering.description,
      fedrampId: offering.fedramp_id,
      marketplaceUrl: offering.marketplace_url,
      serviceModel: offering.service_model,
      deploymentModel: offering.deployment_model,
      businessCategory: offering.business_category,
      uei: offering.uei,
      contactEmail: audience === 'public' ? offering.contact_email : offering.contact_email,
      trustCenterUrl: offering.trust_center_url,
      accessGuidance: offering.access_guidance,
      availabilityStatus: offering.availability_status,
      nextOarDueOn: offering.next_oar_due_on,
      nextQuarterlyReviewOn: offering.next_quarterly_review_on,
    },
    humanReadable: {
      markdown: [
        `# ${offering.name} Trust Center`,
        '',
        offering.description ?? '',
        '',
        '## Service catalog',
        ...services.results.map((service) => `- **${service.name}**: ${service.description ?? 'No summary yet.'}`),
        '',
        '## Published artifacts',
        ...artifacts.results.map((artifact) => `- **${artifact.title}** (${artifact.artifact_kind}) version=${artifact.version_label}`),
      ].join('\n'),
    },
    machineReadable: {
      services: services.results.map((service) => ({
        id: service.id,
        slug: service.service_slug,
        name: service.name,
        description: service.description,
        inScope: service.in_scope === 1,
        securityObjectives: asJson<string[]>(service.security_objectives_json, []),
        customerResponsibilities: asJson<string[]>(service.customer_responsibilities_json, []),
      })),
      artifacts: artifacts.results.map((artifact) => artifactSummary(artifact, options)),
      ongoingAuthorizationReports: cycles.results.map((cycle) => ({
        id: cycle.id,
        cycleLabel: cycle.cycle_label,
        publicationState: cycle.publication_state,
        periodStart: cycle.period_start,
        periodEnd: cycle.period_end,
        nextReportDueOn: cycle.next_report_due_on,
        targetReviewOn: cycle.target_review_on,
      })),
      quarterlyReviews: reviews.results.map((review) => ({
        id: review.id,
        title: review.title,
        publicationState: review.publication_state,
        scheduledFor: review.scheduled_for,
        registrationUrl: review.registration_url,
      })),
    },
  };
}

export async function loadPublicTrustCenterView(
  env: EnvBindings,
  input: {
    tenantId?: string | null;
    tenantSlug?: string | null;
  },
) {
  let offering: OfferingRow | null = null;
  if (input.tenantId?.trim()) {
    offering = await loadOfferingRow(env, input.tenantId.trim());
  } else if (input.tenantSlug?.trim()) {
    offering = await loadOfferingBySlug(env, input.tenantSlug.trim());
  }

  if (!offering) {
    fedrampError(404, 'trust_center_not_found', 'A published trust center offering could not be found for that tenant.');
  }
  return buildTrustCenterPublicPayload(env, offering, 'public');
}

export async function loadPortalTrustCenterView(
  env: EnvBindings,
  input: {
    grantId: string;
    token: string;
    requestPath?: string | null;
    userAgent?: string | null;
  },
) {
  const grant = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM trust_center_access_grants
    WHERE id = ?
    LIMIT 1
    `,
  )
    .bind(input.grantId)
    .first<GrantRow & { token_hash: string }>();

  if (!grant || grant.status !== 'active') {
    fedrampError(403, 'invalid_grant', 'Trust center grant not found or inactive.');
  }
  if (grant.expires_at && new Date(grant.expires_at).getTime() < Date.now()) {
    fedrampError(403, 'expired_grant', 'Trust center grant has expired.');
  }
  const suppliedHash = await sha256Hex(input.token);
  if (suppliedHash !== (grant as GrantRow & { token_hash: string }).token_hash) {
    fedrampError(403, 'invalid_grant_token', 'Trust center grant token is invalid.');
  }

  const offering = await env.D1_MAIN.prepare(`SELECT * FROM trust_center_offerings WHERE id = ? LIMIT 1`).bind(grant.offering_id).first<OfferingRow>();
  if (!offering) {
    fedrampError(404, 'trust_center_not_found', 'Trust center offering not found.');
  }

  await env.D1_MAIN.prepare(
    `
    UPDATE trust_center_access_grants
    SET last_accessed_at = ?, updated_at = ?
    WHERE id = ?
    `,
  )
    .bind(nowIso(), nowIso(), grant.id)
    .run();
  await recordAccessEvent(env, {
    tenantId: offering.tenant_id,
    grantId: grant.id,
    eventType: 'portal_view',
    actorEmail: grant.contact_email,
    actorName: grant.contact_name,
    requestPath: input.requestPath ?? null,
    userAgent: input.userAgent ?? null,
    summary: {
      agencyName: grant.agency_name,
    },
  });

  return buildTrustCenterPublicPayload(env, offering, 'portal', {
    grantId: grant.id,
    portalToken: input.token,
  });
}

export async function loadArtifactPayload(
  env: EnvBindings,
  input: {
    artifactId: string;
    tenantId?: string | null;
    isTenantAdmin?: boolean;
    grantId?: string | null;
    portalToken?: string | null;
    requestPath?: string | null;
    userAgent?: string | null;
  },
) {
  const artifact = await env.D1_MAIN.prepare(`SELECT * FROM artifact_versions WHERE id = ? LIMIT 1`).bind(input.artifactId).first<ArtifactRow>();
  if (!artifact || artifact.status !== 'published' || artifact.publication_state !== 'published') {
    fedrampError(404, 'artifact_not_found', 'Published artifact not found.');
  }

  if (input.grantId?.trim() && input.portalToken?.trim()) {
    await loadPortalTrustCenterView(env, {
      grantId: input.grantId.trim(),
      token: input.portalToken.trim(),
      requestPath: input.requestPath ?? null,
      userAgent: input.userAgent ?? null,
    });
  } else if (artifact.is_public !== 1) {
    if (!input.tenantId?.trim() || input.tenantId.trim() !== artifact.tenant_id || input.isTenantAdmin !== true) {
      fedrampError(
        403,
        'artifact_requires_admin_or_portal_grant',
        'This artifact requires an authenticated tenant-admin session or a trust-center portal grant.',
      );
    }
  }

  const payload = await getJsonArtifact<Record<string, unknown>>(env, artifact.object_key);
  if (!payload) {
    fedrampError(404, 'artifact_body_missing', 'Artifact body is missing from object storage.');
  }

  await recordAccessEvent(env, {
    tenantId: artifact.tenant_id,
    grantId: input.grantId ?? null,
    artifactVersionId: artifact.id,
    eventType: 'artifact_download',
    requestPath: input.requestPath ?? null,
    userAgent: input.userAgent ?? null,
    summary: {
      artifactKind: artifact.artifact_kind,
      title: artifact.title,
    },
  });

  return {
    artifact: artifactSummary(artifact, {
      grantId: input.grantId ?? null,
      portalToken: input.portalToken ?? null,
    }),
    payload,
  };
}
