import { requireAnyPermission, requireTenant } from '../../authorization';
import type { WorkerRequestContext } from '../../router';
import { json, methodNotAllowed, readJson } from '../../utils/http';

const FRAMEWORK_READ_PERMISSIONS = ['view_framework', 'add_framework', 'change_framework'];
const FRAMEWORK_WRITE_PERMISSIONS = ['add_framework', 'change_framework'];
const SCRUTINY_FEATURE_FLAG = 'grc_scrutiny_engine';

const SUFFICIENCY_STATES = [
  'draft',
  'requested',
  'responded',
  'accepted',
  'challenged',
  'clarification_needed',
  'still_needed',
  'not_applicable',
] as const;

type SufficiencyState = (typeof SUFFICIENCY_STATES)[number];

type ScrutinyPatternSource =
  | 'fedhr_fedramp_import'
  | 'persisted'
  | 'scf'
  | 'questionnaire'
  | 'generated_fallback';

type ScrutinyPattern = {
  id: string | null;
  source: ScrutinyPatternSource;
  sourceRef: string | null;
  controlRef: string;
  scfControlId: string | null;
  questionPrompt: string;
  evidenceType: string;
  evidenceHint: string | null;
  priority: number;
  metadata: Record<string, unknown>;
};

type ScrutinyRunRow = {
  id: string;
  tenant_id: string;
  folder_id: string | null;
  title: string;
  mode: string;
  status: string;
  scope_json: string;
  source_summary_json: string;
  metrics_json: string;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type ScrutinyItemRow = {
  id: string;
  tenant_id: string;
  run_id: string;
  pattern_id: string | null;
  control_ref: string;
  question_prompt: string;
  evidence_type: string;
  evidence_request: string;
  evidence_hint: string | null;
  sufficiency_state: SufficiencyState;
  owner_user_id: string | null;
  data_call_record_id: string | null;
  evidence_record_ids_json: string;
  coverage_json: string;
  reviewer_challenge: number;
  missing_feed: number;
  created_at: string;
  updated_at: string;
};

type ScrutinyCommentEventRow = {
  id: string;
  tenant_id: string;
  run_id: string;
  item_id: string;
  event_type: string;
  author: string;
  body: string;
  source: string;
  related_evidence_refs_json: string;
  previous_state: string | null;
  next_state: string | null;
  classifier_json: string;
  created_by_user_id: string | null;
  created_at: string;
};

type ScrutinyMaterializedLinkRow = {
  id: string;
  tenant_id: string;
  run_id: string;
  item_id: string;
  target_module: string;
  target_id: string;
  relation_type: string;
  created_at: string;
};

type ModuleRecordRow = {
  id: string;
  tenant_id: string;
  module_key: string;
  folder_id: string;
  title: string;
  status: string;
  owner_user_id: string | null;
  assignee_user_id: string | null;
  start_on: string | null;
  finish_on: string | null;
  due_on: string | null;
  review_on: string | null;
  expires_on: string | null;
  data_json: string;
  links_json: string;
  activity_json: string;
  archived: number;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type DraftRunInput = {
  title?: string;
  folderId?: string | null;
  scope?: {
    type?: 'package' | 'controls' | 'record' | 'default';
    packageMarker?: string;
    controlRefs?: string[];
    moduleKey?: string;
    recordId?: string;
  };
};

type MaterializeInput = {
  itemIds?: string[];
  dueOn?: string | null;
  createQuestionnaireTemplate?: boolean;
};

type ReviewInput = {
  eventType?: string;
  author?: string;
  body?: string;
  source?: string;
  relatedEvidenceRefs?: string[];
  nextState?: SufficiencyState;
};

type ScrutinyRunDetail = {
  run: ReturnType<typeof toRunResponse>;
  items: ReturnType<typeof toItemResponse>[];
  commentEvents: ReturnType<typeof toCommentEventResponse>[];
  materializedLinks: ReturnType<typeof toMaterializedLinkResponse>[];
  metrics: Record<string, unknown>;
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

function normalizeControlRef(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}

function stringArrayFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map((item) => normalizeOptionalString(item)).filter((item): item is string => Boolean(item)))];
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function controlFamily(controlRef: string): string {
  const match = controlRef.match(/^[A-Z]+/);
  return match?.[0] ?? 'OTHER';
}

function classifyComment(body: string): { eventType: string; suggestedState: SufficiencyState | null; reviewerChallenge: boolean } {
  const text = body.toLowerCase();
  if (/\b(n\/a|not applicable|not in scope)\b/.test(text)) {
    return { eventType: 'not_applicable', suggestedState: 'not_applicable', reviewerChallenge: false };
  }
  if (/\b(accepted|sufficient|approved|verified|validated|closed)\b/.test(text)) {
    return { eventType: 'accepted', suggestedState: 'accepted', reviewerChallenge: false };
  }
  if (/\b(clarify|clarification|explain|question)\b/.test(text)) {
    return { eventType: 'clarified', suggestedState: 'clarification_needed', reviewerChallenge: true };
  }
  if (/\b(challenge|insufficient|inadequate|reject|rejected|gap|does not|missing)\b/.test(text)) {
    return { eventType: 'challenged', suggestedState: 'challenged', reviewerChallenge: true };
  }
  if (/\b(still needed|need|needed|pending|follow[- ]?up)\b/.test(text)) {
    return { eventType: 'still_needed', suggestedState: 'still_needed', reviewerChallenge: true };
  }
  return { eventType: 'note', suggestedState: null, reviewerChallenge: false };
}

function resolveReviewNextState(input: ReviewInput, currentState: SufficiencyState): SufficiencyState {
  if (input.nextState && SUFFICIENCY_STATES.includes(input.nextState)) {
    return input.nextState;
  }
  const normalizedEvent = normalizeOptionalString(input.eventType)?.toLowerCase().replace(/[^a-z0-9]+/g, '_') ?? 'comment';
  if (normalizedEvent === 'accept' || normalizedEvent === 'accepted') {
    return 'accepted';
  }
  if (normalizedEvent === 'challenge' || normalizedEvent === 'challenged') {
    return 'challenged';
  }
  if (normalizedEvent === 'clarification' || normalizedEvent === 'clarified' || normalizedEvent === 'clarification_needed') {
    return 'clarification_needed';
  }
  if (normalizedEvent === 'still_needed') {
    return 'still_needed';
  }
  if (normalizedEvent === 'not_applicable') {
    return 'not_applicable';
  }
  return currentState;
}

type ScrutinyFeatureStatus = {
  enabled: boolean;
  featureFlag: typeof SCRUTINY_FEATURE_FLAG;
  message: string;
  tenantSlug: string | null;
};

async function getScrutinyFeatureStatus(ctx: WorkerRequestContext, tenantId: string): Promise<ScrutinyFeatureStatus> {
  const row = await ctx.env.D1_MAIN.prepare(
    `
    SELECT tenant.slug, features.feature_flags_json
    FROM tenants AS tenant
    LEFT JOIN setup_modules_features AS features
      ON features.tenant_id = tenant.id
    WHERE tenant.id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<{ slug: string; feature_flags_json: string | null }>();

  const flags = asJson<string[]>(row?.feature_flags_json, []);
  const enabled = flags.includes(SCRUTINY_FEATURE_FLAG) || (!row?.feature_flags_json && row?.slug === 'fedhr');
  return {
    enabled,
    featureFlag: SCRUTINY_FEATURE_FLAG,
    tenantSlug: row?.slug ?? null,
    message: enabled
      ? 'The GRC Scrutiny Engine is enabled for this workspace.'
      : 'The GRC Scrutiny Engine is disabled for this workspace. Enable grc_scrutiny_engine in Setup > Modules & Features.',
  };
}

async function requireScrutinyFeature(ctx: WorkerRequestContext, tenantId: string): Promise<Response | null> {
  const status = await getScrutinyFeatureStatus(ctx, tenantId);
  const enabled = status.enabled;
  if (enabled) {
    return null;
  }

  return json(
    {
      error: 'feature_disabled',
      message: status.message,
      featureFlag: status.featureFlag,
      enabled: status.enabled,
    },
    { status: 403 },
  );
}

function toPatternResponse(pattern: ScrutinyPattern) {
  return {
    id: pattern.id,
    source: pattern.source,
    sourceRef: pattern.sourceRef,
    controlRef: pattern.controlRef,
    scfControlId: pattern.scfControlId,
    questionPrompt: pattern.questionPrompt,
    evidenceType: pattern.evidenceType,
    evidenceHint: pattern.evidenceHint,
    priority: pattern.priority,
    metadata: pattern.metadata,
  };
}

function toRunResponse(row: ScrutinyRunRow) {
  return {
    id: row.id,
    folderId: row.folder_id,
    title: row.title,
    mode: row.mode,
    status: row.status,
    scope: asJson<Record<string, unknown>>(row.scope_json, {}),
    sourceSummary: asJson<Record<string, unknown>>(row.source_summary_json, {}),
    metrics: asJson<Record<string, unknown>>(row.metrics_json, {}),
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toItemResponse(row: ScrutinyItemRow) {
  return {
    id: row.id,
    runId: row.run_id,
    patternId: row.pattern_id,
    controlRef: row.control_ref,
    questionPrompt: row.question_prompt,
    evidenceType: row.evidence_type,
    evidenceRequest: row.evidence_request,
    evidenceHint: row.evidence_hint,
    sufficiencyState: row.sufficiency_state,
    ownerUserId: row.owner_user_id,
    dataCallRecordId: row.data_call_record_id,
    evidenceRecordIds: asJson<string[]>(row.evidence_record_ids_json, []),
    coverage: asJson<Record<string, unknown>>(row.coverage_json, {}),
    reviewerChallenge: row.reviewer_challenge === 1,
    missingFeed: row.missing_feed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCommentEventResponse(row: ScrutinyCommentEventRow) {
  return {
    id: row.id,
    runId: row.run_id,
    itemId: row.item_id,
    eventType: row.event_type,
    author: row.author,
    body: row.body,
    source: row.source,
    relatedEvidenceRefs: asJson<string[]>(row.related_evidence_refs_json, []),
    previousState: row.previous_state,
    nextState: row.next_state,
    classifier: asJson<Record<string, unknown>>(row.classifier_json, {}),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  };
}

function toMaterializedLinkResponse(row: ScrutinyMaterializedLinkRow) {
  return {
    id: row.id,
    runId: row.run_id,
    itemId: row.item_id,
    targetModule: row.target_module,
    targetId: row.target_id,
    relationType: row.relation_type,
    route:
      row.target_module === 'data-calls' || row.target_module === 'evidence-locker'
        ? `/${row.target_module}?record=${encodeURIComponent(row.target_id)}`
        : null,
    createdAt: row.created_at,
  };
}

function computeMetrics(items: ScrutinyItemRow[], events: ScrutinyCommentEventRow[]) {
  const byState: Record<string, number> = {};
  const byControlFamily: Record<string, number> = {};
  const byEvidenceType: Record<string, number> = {};
  let missingFeeds = 0;
  let reviewerChallenges = 0;

  for (const item of items) {
    byState[item.sufficiency_state] = (byState[item.sufficiency_state] ?? 0) + 1;
    byControlFamily[controlFamily(item.control_ref)] = (byControlFamily[controlFamily(item.control_ref)] ?? 0) + 1;
    byEvidenceType[item.evidence_type] = (byEvidenceType[item.evidence_type] ?? 0) + 1;
    if (item.missing_feed === 1) {
      missingFeeds += 1;
    }
    if (item.reviewer_challenge === 1) {
      reviewerChallenges += 1;
    }
  }

  return {
    totalItems: items.length,
    byState,
    byControlFamily,
    byEvidenceType,
    missingFeeds,
    reviewerChallenges,
    commentEvents: events.length,
    materializedItems: items.filter((item) => Boolean(item.data_call_record_id)).length,
  };
}

async function updateRunMetrics(env: WorkerRequestContext['env'], tenantId: string, runId: string, items: ScrutinyItemRow[], events: ScrutinyCommentEventRow[]) {
  const metrics = computeMetrics(items, events);
  await env.D1_MAIN.prepare(
    `
    UPDATE grc_scrutiny_runs
    SET metrics_json = ?,
        updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(JSON.stringify(metrics), tenantId, runId)
    .run();
  return metrics;
}

async function loadRunDetail(env: WorkerRequestContext['env'], tenantId: string, runId: string): Promise<ScrutinyRunDetail | null> {
  const [run, itemRows, eventRows, linkRows] = await Promise.all([
    env.D1_MAIN.prepare(
      `
      SELECT *
      FROM grc_scrutiny_runs
      WHERE tenant_id = ? AND id = ?
      LIMIT 1
      `,
    )
      .bind(tenantId, runId)
      .first<ScrutinyRunRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT *
      FROM grc_scrutiny_items
      WHERE tenant_id = ? AND run_id = ?
      ORDER BY control_ref ASC, created_at ASC
      `,
    )
      .bind(tenantId, runId)
      .all<ScrutinyItemRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT *
      FROM grc_scrutiny_comment_events
      WHERE tenant_id = ? AND run_id = ?
      ORDER BY created_at ASC
      `,
    )
      .bind(tenantId, runId)
      .all<ScrutinyCommentEventRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT *
      FROM grc_scrutiny_materialized_links
      WHERE tenant_id = ? AND run_id = ?
      ORDER BY created_at ASC
      `,
    )
      .bind(tenantId, runId)
      .all<ScrutinyMaterializedLinkRow>(),
  ]);

  if (!run) {
    return null;
  }

  const items = itemRows.results ?? [];
  const events = eventRows.results ?? [];
  const metrics = await updateRunMetrics(env, tenantId, runId, items, events);
  return {
    run: toRunResponse({ ...run, metrics_json: JSON.stringify(metrics) }),
    items: items.map(toItemResponse),
    commentEvents: events.map(toCommentEventResponse),
    materializedLinks: (linkRows.results ?? []).map(toMaterializedLinkResponse),
    metrics,
  };
}

async function listPersistedPatterns(env: WorkerRequestContext['env'], tenantId: string, controlRefs: string[]) {
  const bindings: unknown[] = [tenantId];
  const predicates = ['tenant_id = ?'];
  if (controlRefs.length > 0) {
    predicates.push(`control_ref IN (${controlRefs.map(() => '?').join(', ')})`);
    bindings.push(...controlRefs);
  }

  const rows = await env.D1_MAIN.prepare(
    `
    SELECT id, source, source_ref, control_ref, scf_control_id, question_prompt, evidence_type, evidence_hint, priority, metadata_json
    FROM grc_scrutiny_patterns
    WHERE ${predicates.join(' AND ')}
    ORDER BY priority DESC, updated_at DESC
    LIMIT 500
    `,
  )
    .bind(...bindings)
    .all<{
      id: string;
      source: string;
      source_ref: string | null;
      control_ref: string;
      scf_control_id: string | null;
      question_prompt: string;
      evidence_type: string;
      evidence_hint: string | null;
      priority: number;
      metadata_json: string;
    }>();

  return (rows.results ?? []).map((row): ScrutinyPattern => ({
    id: row.id,
    source: 'persisted',
    sourceRef: row.source_ref,
    controlRef: row.control_ref,
    scfControlId: row.scf_control_id,
    questionPrompt: row.question_prompt,
    evidenceType: row.evidence_type,
    evidenceHint: row.evidence_hint,
    priority: Number(row.priority ?? 0) + 90,
    metadata: {
      ...asJson<Record<string, unknown>>(row.metadata_json, {}),
      persistedSource: row.source,
    },
  }));
}

async function listFedHrPatterns(env: WorkerRequestContext['env'], tenantId: string, controlRefs: string[], packageMarker: string | null) {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT id, title, data_json
    FROM module_records
    WHERE tenant_id = ?
      AND module_key = 'data-calls'
      AND archived = 0
      AND LOWER(COALESCE(data_json, '')) LIKE '%assessmentevidencepackage%'
    ORDER BY updated_at DESC
    LIMIT 1000
    `,
  )
    .bind(tenantId)
    .all<Pick<ModuleRecordRow, 'id' | 'title' | 'data_json'>>();

  const controlFilter = new Set(controlRefs);
  const patterns: ScrutinyPattern[] = [];
  for (const row of rows.results ?? []) {
    const data = asJson<Record<string, unknown>>(row.data_json, {});
    const marker = normalizeOptionalString(data.importMarker);
    if (packageMarker && marker !== packageMarker) {
      continue;
    }
    const rowControlRefs = stringArrayFromUnknown(data.controlRefs)
      .map(normalizeControlRef)
      .filter((item): item is string => Boolean(item));
    const matchingControls = controlFilter.size > 0 ? rowControlRefs.filter((ref) => controlFilter.has(ref)) : rowControlRefs;
    const prompt = normalizeOptionalString(data.request_details) ?? row.title;
    const evidenceType = normalizeOptionalString(data.evidenceType) ?? 'Historical FedRAMP Request';
    const evidenceHint = normalizeOptionalString(data.response_package_summary) ?? normalizeOptionalString(data.audit_trail_summary);

    for (const controlRef of matchingControls) {
      patterns.push({
        id: null,
        source: 'fedhr_fedramp_import',
        sourceRef: row.id,
        controlRef,
        scfControlId: null,
        questionPrompt: prompt,
        evidenceType,
        evidenceHint,
        priority: 100,
        metadata: {
          moduleRecordId: row.id,
          importMarker: marker,
          packageTitle: normalizeOptionalString(data.packageTitle),
          sourceExcelRow: data.sourceExcelRow,
          coreControl: data.coreControl === true,
          assessmentFamily: normalizeOptionalString(data.assessmentFamily),
          commentEvents: Array.isArray(data.commentEvents) ? data.commentEvents : [],
          historicalReferenceOnly: true,
        },
      });
    }
  }
  return patterns;
}

function evidenceRequestsFromUnknown(value: unknown): Array<{ prompt: string; evidenceType: string; evidenceHint: string | null }> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (typeof item === 'string') {
        return { prompt: item, evidenceType: 'SCF Evidence Request', evidenceHint: null };
      }
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      const prompt =
        normalizeOptionalString(record.question) ??
        normalizeOptionalString(record.prompt) ??
        normalizeOptionalString(record.request) ??
        normalizeOptionalString(record.evidence_request) ??
        normalizeOptionalString(record.description);
      if (!prompt) {
        return null;
      }
      return {
        prompt,
        evidenceType:
          normalizeOptionalString(record.type) ??
          normalizeOptionalString(record.evidenceType) ??
          normalizeOptionalString(record.evidence_type) ??
          'SCF Evidence Request',
        evidenceHint:
          normalizeOptionalString(record.hint) ??
          normalizeOptionalString(record.guidance) ??
          normalizeOptionalString(record.evidenceHint),
      };
    })
    .filter((item): item is { prompt: string; evidenceType: string; evidenceHint: string | null } => Boolean(item));
}

async function listScfPatterns(env: WorkerRequestContext['env'], controlRefs: string[]) {
  const bindings: unknown[] = [];
  const predicates = ['version_id = (SELECT id FROM grc_scf_versions ORDER BY imported_at DESC LIMIT 1)'];
  if (controlRefs.length > 0) {
    predicates.push(`control_id IN (${controlRefs.map(() => '?').join(', ')})`);
    bindings.push(...controlRefs);
  }

  const rows = await env.D1_MAIN.prepare(
    `
    SELECT control_id, family_code, family_name, title, description, evidence_requests_json
    FROM grc_scf_controls
    WHERE ${predicates.join(' AND ')}
    ORDER BY control_id ASC
    LIMIT 500
    `,
  )
    .bind(...bindings)
    .all<{
      control_id: string;
      family_code: string | null;
      family_name: string | null;
      title: string;
      description: string | null;
      evidence_requests_json: string;
    }>();

  const patterns: ScrutinyPattern[] = [];
  for (const row of rows.results ?? []) {
    const requests = evidenceRequestsFromUnknown(asJson<unknown>(row.evidence_requests_json, []));
    const effectiveRequests =
      requests.length > 0
        ? requests
        : [
            {
              prompt: `Provide evidence that ${row.control_id} - ${row.title} is implemented, operating, and monitored.`,
              evidenceType: 'SCF Control Evidence',
              evidenceHint: row.description,
            },
          ];
    for (const request of effectiveRequests) {
      patterns.push({
        id: null,
        source: 'scf',
        sourceRef: row.control_id,
        controlRef: row.control_id,
        scfControlId: row.control_id,
        questionPrompt: request.prompt,
        evidenceType: request.evidenceType,
        evidenceHint: request.evidenceHint,
        priority: 60,
        metadata: {
          familyCode: row.family_code,
          familyName: row.family_name,
          title: row.title,
        },
      });
    }
  }
  return patterns;
}

async function listQuestionnairePatterns(env: WorkerRequestContext['env'], tenantId: string, controlRefs: string[]) {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT id, name, questions_json, metadata_json
    FROM questionnaire_templates
    WHERE tenant_id = ?
    ORDER BY updated_at DESC
    LIMIT 100
    `,
  )
    .bind(tenantId)
    .all<{ id: string; name: string; questions_json: string; metadata_json: string | null }>();

  const controlFilter = new Set(controlRefs);
  const patterns: ScrutinyPattern[] = [];
  for (const row of rows.results ?? []) {
    const questions = asJson<Array<Record<string, unknown>>>(row.questions_json, []);
    const metadata = asJson<Record<string, unknown>>(row.metadata_json, {});
    for (const question of questions) {
      const prompt = normalizeOptionalString(question.prompt) ?? normalizeOptionalString(question.label) ?? normalizeOptionalString(question.text);
      if (!prompt) {
        continue;
      }
      const refs = [
        normalizeControlRef(question.requirementRef),
        normalizeControlRef(question.controlRef),
        normalizeControlRef(question.control_ref),
        ...stringArrayFromUnknown(question.controlRefs).map(normalizeControlRef),
      ].filter((item): item is string => Boolean(item));
      const effectiveRefs = refs.length > 0 ? refs : stringArrayFromUnknown(metadata.controlRefs).map(normalizeControlRef).filter((item): item is string => Boolean(item));
      const matchingRefs = controlFilter.size > 0 ? effectiveRefs.filter((ref) => controlFilter.has(ref)) : effectiveRefs;
      for (const controlRef of matchingRefs) {
        patterns.push({
          id: null,
          source: 'questionnaire',
          sourceRef: row.id,
          controlRef,
          scfControlId: null,
          questionPrompt: prompt,
          evidenceType: normalizeOptionalString(question.type) ?? 'Questionnaire Question',
          evidenceHint: normalizeOptionalString(question.evidenceHint) ?? normalizeOptionalString(question.helpText),
          priority: 50,
          metadata: {
            templateId: row.id,
            templateName: row.name,
            questionId: normalizeOptionalString(question.id),
            questionRef: normalizeOptionalString(question.ref),
          },
        });
      }
    }
  }
  return patterns;
}

function fallbackPatterns(controlRefs: string[]) {
  return controlRefs.map((controlRef): ScrutinyPattern => ({
    id: null,
    source: 'generated_fallback',
    sourceRef: null,
    controlRef,
    scfControlId: null,
    questionPrompt: `Describe how ${controlRef} is implemented, operated, monitored, and evidenced for the selected scope.`,
    evidenceType: 'Generated Evidence Request',
    evidenceHint:
      'No imported package, SCF evidence request, or questionnaire pattern was found. Attach missing-feed notes and route this through human review.',
    priority: 10,
    metadata: {
      missingFeeds: ['fedhr_fedramp_patterns', 'scf_evidence_requests', 'questionnaire_patterns'],
      generatedFallback: true,
    },
  }));
}

async function collectPatterns(args: {
  env: WorkerRequestContext['env'];
  tenantId: string;
  controlRefs: string[];
  packageMarker: string | null;
}) {
  const [fedhr, persisted, scf, questionnaire] = await Promise.all([
    listFedHrPatterns(args.env, args.tenantId, args.controlRefs, args.packageMarker),
    listPersistedPatterns(args.env, args.tenantId, args.controlRefs),
    listScfPatterns(args.env, args.controlRefs),
    listQuestionnairePatterns(args.env, args.tenantId, args.controlRefs),
  ]);

  const discovered = [...fedhr, ...persisted, ...scf, ...questionnaire];
  const byControl = new Map<string, ScrutinyPattern[]>();
  for (const pattern of discovered) {
    byControl.set(pattern.controlRef, [...(byControl.get(pattern.controlRef) ?? []), pattern]);
  }
  for (const controlRef of args.controlRefs) {
    if (!byControl.has(controlRef)) {
      byControl.set(controlRef, fallbackPatterns([controlRef]));
    }
  }

  const selected = [...byControl.values()].flatMap((patterns) =>
    patterns.sort((left, right) => right.priority - left.priority).slice(0, 8),
  );
  return selected.length > 0 ? selected : fallbackPatterns(['AC-2', 'IA-2', 'SI-4', 'CM-6', 'RA-5']);
}

function countPatternsBySource(patterns: ScrutinyPattern[]) {
  return patterns.reduce<Record<string, number>>((acc, pattern) => {
    acc[pattern.source] = (acc[pattern.source] ?? 0) + 1;
    return acc;
  }, {});
}

function readinessCheck(
  id: string,
  label: string,
  status: 'ok' | 'warn' | 'blocker' | 'info',
  message: string,
  evidence: Record<string, unknown> = {},
) {
  return { id, label, status, message, evidence };
}

async function buildScrutinyReadiness(ctx: WorkerRequestContext, tenantId: string) {
  const featureStatus = await getScrutinyFeatureStatus(ctx, tenantId);
  const packageMarker = normalizeOptionalString(ctx.url.searchParams.get('packageMarker'));
  const controlRefs = (ctx.url.searchParams.get('controlRefs') ?? 'AC-2,IA-2,SI-4')
    .split(',')
    .map(normalizeControlRef)
    .filter((item): item is string => Boolean(item));
  const effectiveControlRefs = controlRefs.length > 0 ? [...new Set(controlRefs)] : ['AC-2', 'IA-2', 'SI-4'];

  const [folderCounts, runCounts, patterns] = await Promise.all([
    ctx.env.D1_MAIN.prepare(
      `
      SELECT
        SUM(CASE WHEN content_type = 'root' THEN 1 ELSE 0 END) AS root_count,
        SUM(CASE WHEN content_type = 'domain' THEN 1 ELSE 0 END) AS domain_count,
        COUNT(*) AS total_count
      FROM folders
      WHERE tenant_id = ?
      `,
    )
      .bind(tenantId)
      .first<{ root_count: number | null; domain_count: number | null; total_count: number | null }>(),
    ctx.env.D1_MAIN.prepare(
      `
      SELECT
        (SELECT COUNT(*) FROM grc_scrutiny_runs WHERE tenant_id = ?) AS run_count,
        (SELECT COUNT(*) FROM grc_scrutiny_items WHERE tenant_id = ?) AS item_count,
        (SELECT COUNT(*) FROM grc_scrutiny_comment_events WHERE tenant_id = ?) AS comment_count,
        (SELECT COUNT(*) FROM grc_scrutiny_materialized_links WHERE tenant_id = ?) AS link_count
      `,
    )
      .bind(tenantId, tenantId, tenantId, tenantId)
      .first<{ run_count: number | null; item_count: number | null; comment_count: number | null; link_count: number | null }>(),
    collectPatterns({
      env: ctx.env,
      tenantId,
      controlRefs: effectiveControlRefs,
      packageMarker,
    }),
  ]);

  const sourceCounts = countPatternsBySource(patterns);
  const nonFallbackCount = patterns.filter((pattern) => pattern.source !== 'generated_fallback').length;
  const folderScopeCount = Number(folderCounts?.root_count ?? 0) + Number(folderCounts?.domain_count ?? 0);
  const checks = [
    readinessCheck(
      'feature-flag',
      'Tenant feature flag',
      featureStatus.enabled ? 'ok' : 'warn',
      featureStatus.enabled
        ? 'Feature flag is enabled; draft/materialize/reconcile/review operations are available to authorized users.'
        : 'Feature flag is disabled; read-only readiness is available, but mutating scrutiny workflows stay blocked.',
      { featureFlag: featureStatus.featureFlag, tenantSlug: featureStatus.tenantSlug },
    ),
    readinessCheck(
      'folder-scope',
      'Folder/domain scope',
      folderScopeCount > 0 ? 'ok' : 'blocker',
      folderScopeCount > 0
        ? 'At least one root/domain folder exists, so materialized Data Calls and Evidence Locker records can be domain-scoped.'
        : 'No root/domain folder exists. Create a workspace domain before materializing scrutiny items.',
      {
        rootFolders: Number(folderCounts?.root_count ?? 0),
        domainFolders: Number(folderCounts?.domain_count ?? 0),
        totalFolders: Number(folderCounts?.total_count ?? 0),
      },
    ),
    readinessCheck(
      'hybrid-question-library',
      'Hybrid question library',
      nonFallbackCount > 0 ? 'ok' : 'warn',
      nonFallbackCount > 0
        ? 'At least one imported, persisted, SCF, or questionnaire pattern is available for the probe scope.'
        : 'Only generated fallback prompts were found for the probe scope; import package rows, SCF evidence requests, or questionnaire patterns to improve assessor scrutiny quality.',
      { controlRefs: effectiveControlRefs, packageMarker, sourceCounts },
    ),
    readinessCheck(
      'draft-first',
      'Draft-first automation',
      'ok',
      'Draft runs write only scrutiny tables. Data Calls, Evidence Locker records, and templates are created only by materialize.',
      { draftEndpoint: '/_api/grc/scrutiny-runs/draft', materializeEndpoint: '/_api/grc/scrutiny-runs/:id/materialize' },
    ),
    readinessCheck(
      'materialization-targets',
      'Materialization targets',
      'ok',
      'Approved drafts materialize into Data Calls, Evidence Locker placeholders/rollups, and optional questionnaire templates.',
      { modules: ['data-calls', 'evidence-locker', 'questionnaires'] },
    ),
    readinessCheck(
      'immutable-comments',
      'Immutable comment trail',
      'ok',
      'Sufficiency reviews append comment events and preserve previous/next states instead of rewriting history.',
      { states: ['accepted', 'challenged', 'clarified', 'still_needed', 'note'] },
    ),
    readinessCheck(
      'missing-feeds',
      'Missing-feed visibility',
      'ok',
      'Fallback and reconciliation metadata keep missing evidence feeds explicit instead of silently certifying coverage.',
      { coverageFields: ['manualResponse', 'evidenceLocker', 'grcFindings', 'evidenceArtifacts', 'connectorOutput', 'feedMissing'] },
    ),
  ];

  return {
    feature: featureStatus,
    ready: featureStatus.enabled && folderScopeCount > 0,
    probe: {
      controlRefs: effectiveControlRefs,
      packageMarker,
    },
    counts: {
      folders: {
        root: Number(folderCounts?.root_count ?? 0),
        domain: Number(folderCounts?.domain_count ?? 0),
        total: Number(folderCounts?.total_count ?? 0),
      },
      runs: Number(runCounts?.run_count ?? 0),
      items: Number(runCounts?.item_count ?? 0),
      commentEvents: Number(runCounts?.comment_count ?? 0),
      materializedLinks: Number(runCounts?.link_count ?? 0),
    },
    patternSources: sourceCounts,
    samplePatterns: patterns.slice(0, 10).map(toPatternResponse),
    lifecycleApis: [
      'GET /_api/grc/scrutiny-readiness',
      'GET /_api/grc/scrutiny-patterns',
      'POST /_api/grc/scrutiny-runs/draft',
      'GET /_api/grc/scrutiny-runs',
      'GET /_api/grc/scrutiny-runs/:id',
      'POST /_api/grc/scrutiny-runs/:id/materialize',
      'POST /_api/grc/scrutiny-runs/:id/reconcile',
      'POST /_api/grc/scrutiny-items/:id/review',
    ],
    materializationTargets: ['data-calls', 'evidence-locker', 'questionnaires'],
    generatedRecordTags: [
      'scrutinyRunId',
      'scrutinyItemId',
      'sourcePatternId',
      'sourcePatternSource',
      'sourcePatternRef',
      'importMarker',
      'controlRefs',
      'evidenceType',
      'sufficiencyState',
      'missingFeed',
      'reviewerChallenge',
    ],
    checks,
  };
}

async function inferControlRefsForDraft(env: WorkerRequestContext['env'], tenantId: string, input: DraftRunInput): Promise<string[]> {
  const explicit = (input.scope?.controlRefs ?? []).map(normalizeControlRef).filter((item): item is string => Boolean(item));
  if (explicit.length > 0) {
    return [...new Set(explicit)];
  }

  const packageMarker = normalizeOptionalString(input.scope?.packageMarker);
  if (packageMarker) {
    const patterns = await listFedHrPatterns(env, tenantId, [], packageMarker);
    return [...new Set(patterns.map((pattern) => pattern.controlRef))].slice(0, 80);
  }

  const moduleKey = normalizeOptionalString(input.scope?.moduleKey);
  const recordId = normalizeOptionalString(input.scope?.recordId);
  if (moduleKey && recordId) {
    const row = await env.D1_MAIN.prepare(
      `
      SELECT data_json
      FROM module_records
      WHERE tenant_id = ? AND module_key = ? AND id = ? AND archived = 0
      LIMIT 1
      `,
    )
      .bind(tenantId, moduleKey, recordId)
      .first<{ data_json: string }>();
    const data = asJson<Record<string, unknown>>(row?.data_json, {});
    const refs = [
      ...stringArrayFromUnknown(data.controlRefs),
      ...stringArrayFromUnknown(data.controls),
      normalizeOptionalString(data.control_ref) ?? '',
      normalizeOptionalString(data.control) ?? '',
    ]
      .map(normalizeControlRef)
      .filter((item): item is string => Boolean(item));
    if (refs.length > 0) {
      return [...new Set(refs)];
    }
  }

  return ['AC-2', 'IA-2', 'SI-4', 'CM-6', 'RA-5'];
}

function buildEvidenceRequest(pattern: ScrutinyPattern) {
  if (pattern.source === 'fedhr_fedramp_import') {
    return pattern.questionPrompt;
  }
  return `${pattern.questionPrompt}\n\nExpected evidence: ${pattern.evidenceHint ?? pattern.evidenceType}`;
}

async function insertSourceCommentEvents(args: {
  env: WorkerRequestContext['env'];
  tenantId: string;
  runId: string;
  itemId: string;
  pattern: ScrutinyPattern;
  userId: string | null;
}) {
  const events = Array.isArray(args.pattern.metadata.commentEvents) ? args.pattern.metadata.commentEvents : [];
  for (const event of events) {
    if (!event || typeof event !== 'object') {
      continue;
    }
    const record = event as Record<string, unknown>;
    const body = normalizeOptionalString(record.text) ?? normalizeOptionalString(record.body) ?? normalizeOptionalString(record.comment);
    if (!body) {
      continue;
    }
    const classifier = classifyComment(body);
    await args.env.D1_MAIN.prepare(
      `
      INSERT INTO grc_scrutiny_comment_events (
        id, tenant_id, run_id, item_id, event_type, author, body, source,
        related_evidence_refs_json, previous_state, next_state, classifier_json, created_by_user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        crypto.randomUUID(),
        args.tenantId,
        args.runId,
        args.itemId,
        classifier.eventType,
        normalizeOptionalString(record.author) ?? 'Historical workbook',
        body,
        'fedhr_workbook',
        JSON.stringify([]),
        'draft',
        classifier.suggestedState,
        JSON.stringify({
          ...classifier,
          dateLabel: normalizeOptionalString(record.dateLabel),
          sourceRef: args.pattern.sourceRef,
        }),
        args.userId,
      )
      .run();
  }
}

async function createDraftRun(ctx: WorkerRequestContext, tenantId: string) {
  const permission = await requireAnyPermission(
    ctx,
    FRAMEWORK_WRITE_PERMISSIONS,
    'Scrutiny run generation requires framework management permissions.',
  );
  if (permission instanceof Response) {
    return permission;
  }
  const featureDisabled = await requireScrutinyFeature(ctx, tenantId);
  if (featureDisabled) {
    return featureDisabled;
  }

  const body = await readJson<DraftRunInput>(ctx.request);
  const folderId = normalizeOptionalString(body.folderId);
  if (folderId) {
    const folder = await ctx.env.D1_MAIN.prepare(
      `SELECT id FROM folders WHERE tenant_id = ? AND id = ? LIMIT 1`,
    )
      .bind(tenantId, folderId)
      .first<{ id: string }>();
    if (!folder) {
      return json({ error: 'folder_not_found', message: 'Select a valid workspace folder for the scrutiny run.' }, { status: 404 });
    }
  }

  const controlRefs = await inferControlRefsForDraft(ctx.env, tenantId, body);
  const packageMarker = normalizeOptionalString(body.scope?.packageMarker);
  const patterns = await collectPatterns({
    env: ctx.env,
    tenantId,
    controlRefs,
    packageMarker,
  });
  const runId = crypto.randomUUID();
  const now = nowIso();
  const scope = {
    type: body.scope?.type ?? (packageMarker ? 'package' : 'controls'),
    packageMarker,
    controlRefs,
    moduleKey: normalizeOptionalString(body.scope?.moduleKey),
    recordId: normalizeOptionalString(body.scope?.recordId),
  };
  const sourceSummary = {
    priorityOrder: ['fedhr_fedramp_import', 'persisted', 'scf', 'questionnaire', 'generated_fallback'],
    selectedPatterns: patterns.length,
    sources: [...new Set(patterns.map((pattern) => pattern.source))],
    missingFeedItems: patterns.filter((pattern) => pattern.source === 'generated_fallback').length,
    draftOnly: true,
  };

  await ctx.env.D1_MAIN.prepare(
    `
    INSERT INTO grc_scrutiny_runs (
      id, tenant_id, folder_id, title, mode, status, scope_json, source_summary_json,
      metrics_json, created_by_user_id, updated_by_user_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, 'draft', 'draft', ?, ?, '{}', ?, ?, ?, ?)
    `,
  )
    .bind(
      runId,
      tenantId,
      folderId,
      normalizeOptionalString(body.title) ?? `Scrutiny run ${now.slice(0, 10)}`,
      JSON.stringify(scope),
      JSON.stringify(sourceSummary),
      permission.userId,
      permission.userId,
      now,
      now,
    )
    .run();

  for (const pattern of patterns) {
    const missingFeeds = pattern.source === 'generated_fallback'
      ? stringArrayFromUnknown(pattern.metadata.missingFeeds)
      : [];
    const itemId = crypto.randomUUID();
    await ctx.env.D1_MAIN.prepare(
      `
      INSERT INTO grc_scrutiny_items (
        id, tenant_id, run_id, pattern_id, control_ref, question_prompt, evidence_type,
        evidence_request, evidence_hint, sufficiency_state, coverage_json, reviewer_challenge, missing_feed
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, 0, ?)
      `,
    )
      .bind(
        itemId,
        tenantId,
        runId,
        pattern.id,
        pattern.controlRef,
        pattern.questionPrompt,
        pattern.evidenceType,
        buildEvidenceRequest(pattern),
        pattern.evidenceHint,
        JSON.stringify({
          source: pattern.source,
          sourceRef: pattern.sourceRef,
          priority: pattern.priority,
          metadata: pattern.metadata,
          missingFeeds,
          suggestedState: 'draft',
          authoritativeReviewRequired: true,
        }),
        missingFeeds.length > 0 ? 1 : 0,
      )
      .run();
    await insertSourceCommentEvents({
      env: ctx.env,
      tenantId,
      runId,
      itemId,
      pattern,
      userId: permission.userId,
    });
  }

  const detail = await loadRunDetail(ctx.env, tenantId, runId);
  return json({ data: detail }, { status: 201 });
}

async function listRuns(ctx: WorkerRequestContext, tenantId: string) {
  const featureStatus = await getScrutinyFeatureStatus(ctx, tenantId);
  if (!featureStatus.enabled) {
    return json({
      data: [],
      meta: featureStatus,
    });
  }

  const rows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT *
    FROM grc_scrutiny_runs
    WHERE tenant_id = ?
    ORDER BY updated_at DESC
    LIMIT 100
    `,
  )
    .bind(tenantId)
    .all<ScrutinyRunRow>();
  return json({ data: rows.results.map(toRunResponse) });
}

async function createModuleRecord(args: {
  env: WorkerRequestContext['env'];
  tenantId: string;
  userId: string | null;
  moduleKey: 'data-calls' | 'evidence-locker';
  folderId: string;
  title: string;
  status: string;
  dueOn?: string | null;
  data: Record<string, unknown>;
  links: Array<Record<string, unknown>>;
  activityMessage: string;
}) {
  const id = crypto.randomUUID();
  const today = nowIso().slice(0, 10);
  await args.env.D1_MAIN.prepare(
    `
    INSERT INTO module_records (
      id, tenant_id, module_key, folder_id, title, status, owner_user_id, assignee_user_id,
      start_on, finish_on, due_on, review_on, expires_on, data_json, links_json, activity_json,
      archived, created_by_user_id, updated_by_user_id
    )
    VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?, NULL, NULL, ?, ?, ?, 0, ?, ?)
    `,
  )
    .bind(
      id,
      args.tenantId,
      args.moduleKey,
      args.folderId,
      args.title,
      args.status,
      today,
      args.dueOn ?? null,
      JSON.stringify(args.data),
      JSON.stringify(args.links),
      JSON.stringify([
        {
          id: crypto.randomUUID(),
          type: 'scrutiny-materialized',
          message: args.activityMessage,
          createdByUserId: args.userId,
          createdAt: nowIso(),
        },
      ]),
      args.userId,
      args.userId,
    )
    .run();
  return id;
}

async function materializeRun(ctx: WorkerRequestContext, tenantId: string, runId: string) {
  const permission = await requireAnyPermission(
    ctx,
    FRAMEWORK_WRITE_PERMISSIONS,
    'Scrutiny materialization requires framework management permissions.',
  );
  if (permission instanceof Response) {
    return permission;
  }
  const featureDisabled = await requireScrutinyFeature(ctx, tenantId);
  if (featureDisabled) {
    return featureDisabled;
  }

  const body = await readJson<MaterializeInput>(ctx.request);
  const run = await ctx.env.D1_MAIN.prepare(
    `
    SELECT *
    FROM grc_scrutiny_runs
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, runId)
    .first<ScrutinyRunRow>();
  if (!run) {
    return json({ error: 'not_found', message: 'Scrutiny run not found.' }, { status: 404 });
  }
  if (!run.folder_id) {
    return json(
      {
        error: 'folder_required',
        message: 'Materialization requires a folder-scoped scrutiny run so generated records have a domain boundary.',
      },
      { status: 400 },
    );
  }

  const selectedItemIds = new Set((body.itemIds ?? []).filter((id) => typeof id === 'string' && id.trim()));
  const itemRows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT *
    FROM grc_scrutiny_items
    WHERE tenant_id = ? AND run_id = ?
    ORDER BY control_ref ASC, created_at ASC
    `,
  )
    .bind(tenantId, runId)
    .all<ScrutinyItemRow>();
  const items = (itemRows.results ?? []).filter((item) => selectedItemIds.size === 0 || selectedItemIds.has(item.id));
  const dueOn = normalizeDate(body.dueOn);

  for (const item of items) {
    const coverage = asJson<Record<string, unknown>>(item.coverage_json, {});
    const patternMetadata = recordFromUnknown(coverage.metadata);
    const importMarker =
      normalizeOptionalString(patternMetadata.importMarker) ??
      normalizeOptionalString(asJson<Record<string, unknown>>(run.scope_json, {}).packageMarker);
    const sourcePatternSource = normalizeOptionalString(coverage.source);
    const sourcePatternRef = normalizeOptionalString(coverage.sourceRef);
    const links = [
      {
        relationType: 'scrutiny-run',
        targetType: 'grc-scrutiny-run',
        targetId: run.id,
        label: run.title,
        route: `/grc-admin/scrutiny-engine?runId=${encodeURIComponent(run.id)}`,
      },
      {
        relationType: 'control-ref',
        targetType: 'security-control',
        targetId: null,
        label: item.control_ref,
        route: `/security-controls?q=${encodeURIComponent(item.control_ref)}`,
      },
      ...(importMarker
        ? [
            {
              relationType: 'assessment-evidence-package',
              targetType: 'package',
              targetId: importMarker,
              label: importMarker,
              route: `/assessment-evidence-packages/${encodeURIComponent(importMarker)}`,
            },
          ]
        : []),
    ];
    const dataCallId =
      item.data_call_record_id ??
      (await createModuleRecord({
        env: ctx.env,
        tenantId,
        userId: permission.userId,
        moduleKey: 'data-calls',
        folderId: run.folder_id,
        title: item.evidence_request.split('\n')[0].slice(0, 240),
        status: 'Requested',
        dueOn,
        data: {
          title: item.evidence_request.split('\n')[0],
          request_reference: `SCRUTINY-${run.id.slice(0, 8)}-${item.id.slice(0, 8)}`,
          request_type: 'Evidence Collection',
          requested_by: 'Regovise Scrutiny Engine',
          requested_to: 'Unassigned',
          requested_at: nowIso().slice(0, 10),
          due_date: dueOn,
          assessment_or_matter: run.title,
          status: 'Requested',
          evidence_count: 0,
          response_package_summary: `${item.evidence_type} requested for ${item.control_ref}.`,
          audit_trail_summary: 'Generated from a draft scrutiny run; reviewer sufficiency decision remains human-authoritative.',
          request_details: item.evidence_request,
          scrutinyRunId: run.id,
          scrutinyItemId: item.id,
          sourcePatternId: item.pattern_id,
          sourcePatternSource,
          sourcePatternRef,
          importMarker,
          controlRefs: [item.control_ref],
          evidenceType: item.evidence_type,
          sufficiencyState: 'requested',
          missingFeed: item.missing_feed === 1,
          reviewerChallenge: item.reviewer_challenge === 1,
          coverage,
        },
        links,
        activityMessage: `Materialized Data Call from scrutiny run ${run.title}.`,
      }));

    const existingEvidenceIds = asJson<string[]>(item.evidence_record_ids_json, []);
    const evidenceId =
      existingEvidenceIds[0] ??
      (await createModuleRecord({
        env: ctx.env,
        tenantId,
        userId: permission.userId,
        moduleKey: 'evidence-locker',
        folderId: run.folder_id,
        title: `${item.control_ref}: ${item.evidence_type}`,
        status: 'Open',
        dueOn,
        data: {
          title: `${item.control_ref}: ${item.evidence_type}`,
          evidence_type: item.evidence_type,
          related_record: dataCallId,
          update_frequency: 'Ad Hoc',
          next_due_date: dueOn,
          mapped_control_summary: item.control_ref,
          control_count: 1,
          file_count: 0,
          evidence_summary: item.evidence_hint ?? item.evidence_request,
          status: 'Open',
          scrutinyRunId: run.id,
          scrutinyItemId: item.id,
          sourcePatternId: item.pattern_id,
          sourcePatternSource,
          sourcePatternRef,
          importMarker,
          controlRefs: [item.control_ref],
          sufficiencyState: 'requested',
          missingFeed: item.missing_feed === 1,
          reviewerChallenge: item.reviewer_challenge === 1,
          placeholderOnly: true,
        },
        links: [
          ...links,
          {
            relationType: 'data-call',
            targetType: 'data-calls',
            targetId: dataCallId,
            label: item.evidence_request.split('\n')[0],
            route: `/data-calls?record=${encodeURIComponent(dataCallId)}`,
          },
        ],
        activityMessage: `Materialized Evidence Locker placeholder from scrutiny run ${run.title}.`,
      }));

    await ctx.env.D1_MAIN.prepare(
      `
      UPDATE grc_scrutiny_items
      SET sufficiency_state = 'requested',
          data_call_record_id = ?,
          evidence_record_ids_json = ?,
          updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      WHERE tenant_id = ? AND id = ?
      `,
    )
      .bind(dataCallId, JSON.stringify([...new Set([...existingEvidenceIds, evidenceId])]), tenantId, item.id)
      .run();

    for (const [moduleKey, targetId, relationType] of [
      ['data-calls', dataCallId, 'materialized_data_call'],
      ['evidence-locker', evidenceId, 'materialized_evidence_placeholder'],
    ] as const) {
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT OR IGNORE INTO grc_scrutiny_materialized_links (
          id, tenant_id, run_id, item_id, target_module, target_id, relation_type
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(crypto.randomUUID(), tenantId, run.id, item.id, moduleKey, targetId, relationType)
        .run();
    }
  }

  if (body.createQuestionnaireTemplate && items.length > 0) {
    const templateId = crypto.randomUUID();
    const now = nowIso();
    const questions = items.map((item, index) => ({
      id: crypto.randomUUID(),
      ref: `SCRUTINY_${String(index + 1).padStart(3, '0')}`,
      prompt: item.question_prompt,
      type: 'text',
      section: controlFamily(item.control_ref),
      required: true,
      weight: 0,
      requirementRef: item.control_ref,
      evidenceHint: item.evidence_hint,
      enableUpload: true,
    }));
    await ctx.env.D1_MAIN.prepare(
      `
      INSERT INTO questionnaire_templates (
        id, tenant_id, name, description, status, scoring_mode, audience, version,
        questions_json, metadata_json, created_by_user_id, updated_by_user_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, 'draft', 'weighted', 'assessor', 1, ?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        templateId,
        tenantId,
        `${run.title} scrutiny questionnaire`,
        'Generated from the GRC Scrutiny Engine; review before assigning.',
        JSON.stringify(questions),
        JSON.stringify({
          templateKind: 'assessment-plan',
          source: 'grc_scrutiny_engine',
          scrutinyRunId: run.id,
          controlRefs: [...new Set(items.map((item) => item.control_ref))],
        }),
        permission.userId,
        permission.userId,
        now,
        now,
      )
      .run();
    await ctx.env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO grc_scrutiny_materialized_links (
        id, tenant_id, run_id, item_id, target_module, target_id, relation_type
      )
      VALUES (?, ?, ?, ?, 'questionnaires', ?, 'materialized_questionnaire_template')
      `,
    )
      .bind(crypto.randomUUID(), tenantId, run.id, items[0].id, templateId)
      .run();
  }

  await ctx.env.D1_MAIN.prepare(
    `
    UPDATE grc_scrutiny_runs
    SET status = 'materialized',
        mode = 'materialized',
        updated_by_user_id = ?,
        updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(permission.userId, tenantId, runId)
    .run();

  return json({ data: await loadRunDetail(ctx.env, tenantId, runId) });
}

async function reconcileRun(ctx: WorkerRequestContext, tenantId: string, runId: string) {
  const permission = await requireAnyPermission(
    ctx,
    FRAMEWORK_WRITE_PERMISSIONS,
    'Scrutiny reconciliation requires framework management permissions.',
  );
  if (permission instanceof Response) {
    return permission;
  }
  const featureDisabled = await requireScrutinyFeature(ctx, tenantId);
  if (featureDisabled) {
    return featureDisabled;
  }

  const detail = await loadRunDetail(ctx.env, tenantId, runId);
  if (!detail) {
    return json({ error: 'not_found', message: 'Scrutiny run not found.' }, { status: 404 });
  }

  for (const item of detail.items) {
    const coverage = item.coverage;
    const evidenceIds = item.evidenceRecordIds;
    let evidenceCount = evidenceIds.length;
    let dataCallStatus: string | null = null;
    if (item.dataCallRecordId) {
      const dataCall = await ctx.env.D1_MAIN.prepare(
        `
        SELECT status, data_json
        FROM module_records
        WHERE tenant_id = ? AND module_key = 'data-calls' AND id = ?
        LIMIT 1
        `,
      )
        .bind(tenantId, item.dataCallRecordId)
        .first<{ status: string; data_json: string }>();
      dataCallStatus = dataCall?.status ?? null;
      const data = asJson<Record<string, unknown>>(dataCall?.data_json, {});
      if (typeof data.evidence_count === 'number') {
        evidenceCount = Math.max(evidenceCount, data.evidence_count);
      }
    }

    const relatedEvents = detail.commentEvents.filter((event) => event.itemId === item.id);
    const commentSuggestion = relatedEvents
      .map((event) => classifyComment(event.body))
      .find((classifier) => classifier.suggestedState && classifier.suggestedState !== 'accepted');
    const suggestedState =
      commentSuggestion?.suggestedState ??
      (evidenceCount > 0 || dataCallStatus === 'Closed' || dataCallStatus === 'Delivered' ? 'responded' : 'still_needed');

    const nextCoverage = {
      ...coverage,
      reconciliation: {
        reconciledAt: nowIso(),
        reconciledByUserId: permission.userId,
        evidenceCount,
        dataCallStatus,
        suggestedState,
        authoritativeReviewRequired: true,
      },
    };

    await ctx.env.D1_MAIN.prepare(
      `
      UPDATE grc_scrutiny_items
      SET sufficiency_state = CASE
            WHEN sufficiency_state IN ('draft', 'requested') AND ? = 'responded' THEN 'responded'
            ELSE sufficiency_state
          END,
          coverage_json = ?,
          reviewer_challenge = CASE WHEN ? IN ('challenged', 'clarification_needed', 'still_needed') THEN 1 ELSE reviewer_challenge END,
          updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      WHERE tenant_id = ? AND id = ?
      `,
    )
      .bind(suggestedState, JSON.stringify(nextCoverage), suggestedState, tenantId, item.id)
      .run();
  }

  await ctx.env.D1_MAIN.prepare(
    `
    UPDATE grc_scrutiny_runs
    SET status = 'reconciled',
        updated_by_user_id = ?,
        updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(permission.userId, tenantId, runId)
    .run();

  return json({ data: await loadRunDetail(ctx.env, tenantId, runId) });
}

async function reviewItem(ctx: WorkerRequestContext, tenantId: string, itemId: string) {
  const permission = await requireAnyPermission(
    ctx,
    FRAMEWORK_WRITE_PERMISSIONS,
    'Scrutiny review requires framework management permissions.',
  );
  if (permission instanceof Response) {
    return permission;
  }
  const featureDisabled = await requireScrutinyFeature(ctx, tenantId);
  if (featureDisabled) {
    return featureDisabled;
  }

  const body = await readJson<ReviewInput>(ctx.request);
  const item = await ctx.env.D1_MAIN.prepare(
    `
    SELECT *
    FROM grc_scrutiny_items
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, itemId)
    .first<ScrutinyItemRow>();
  if (!item) {
    return json({ error: 'not_found', message: 'Scrutiny item not found.' }, { status: 404 });
  }

  const commentBody = normalizeOptionalString(body.body);
  if (!commentBody) {
    return json({ error: 'bad_request', message: 'Review comment body is required.' }, { status: 400 });
  }
  const normalizedEvent = normalizeOptionalString(body.eventType)?.toLowerCase().replace(/[^a-z0-9]+/g, '_') ?? 'comment';
  const nextState = resolveReviewNextState(body, item.sufficiency_state);
  const classifier = classifyComment(commentBody);
  const eventId = crypto.randomUUID();

  await ctx.env.D1_MAIN.prepare(
    `
    INSERT INTO grc_scrutiny_comment_events (
      id, tenant_id, run_id, item_id, event_type, author, body, source,
      related_evidence_refs_json, previous_state, next_state, classifier_json, created_by_user_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      eventId,
      tenantId,
      item.run_id,
      item.id,
      normalizedEvent,
      normalizeOptionalString(body.author) ?? permission.userId ?? 'Reviewer',
      commentBody,
      normalizeOptionalString(body.source) ?? 'manual_review',
      JSON.stringify(body.relatedEvidenceRefs ?? []),
      item.sufficiency_state,
      nextState,
      JSON.stringify(classifier),
      permission.userId,
    )
    .run();

  await ctx.env.D1_MAIN.prepare(
    `
    UPDATE grc_scrutiny_items
    SET sufficiency_state = ?,
        reviewer_challenge = CASE WHEN ? IN ('challenged', 'clarification_needed', 'still_needed') THEN 1 ELSE reviewer_challenge END,
        updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(nextState, nextState, tenantId, item.id)
    .run();

  return json({ data: await loadRunDetail(ctx.env, tenantId, item.run_id) });
}

export async function handleGrcScrutinyRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response | null> {
  const [resource, id, subresource] = segments;
  if (
    resource !== 'scrutiny-readiness' &&
    resource !== 'scrutiny-patterns' &&
    resource !== 'scrutiny-runs' &&
    resource !== 'scrutiny-items'
  ) {
    return null;
  }

  const tenantId = requireTenant(ctx);
  if (tenantId instanceof Response) {
    return tenantId;
  }
  const permission = await requireAnyPermission(
    ctx,
    FRAMEWORK_READ_PERMISSIONS,
    'Scrutiny Engine access requires framework-view permissions.',
  );
  if (permission instanceof Response) {
    return permission;
  }

  if (resource === 'scrutiny-readiness') {
    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    return json({ data: await buildScrutinyReadiness(ctx, tenantId) });
  }

  if (resource === 'scrutiny-patterns') {
    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    const featureStatus = await getScrutinyFeatureStatus(ctx, tenantId);
    if (!featureStatus.enabled) {
      return json({
        data: {
          ...featureStatus,
          patterns: [],
        },
      });
    }
    const controlRefs = (ctx.url.searchParams.get('controlRefs') ?? '')
      .split(',')
      .map(normalizeControlRef)
      .filter((item): item is string => Boolean(item));
    const packageMarker = normalizeOptionalString(ctx.url.searchParams.get('packageMarker'));
    const patterns = await collectPatterns({
      env: ctx.env,
      tenantId,
      controlRefs,
      packageMarker,
    });
    return json({
      data: {
        ...featureStatus,
        patterns: patterns.map(toPatternResponse),
      },
    });
  }

  if (resource === 'scrutiny-runs') {
    if (id === 'draft' && !subresource && ctx.request.method === 'POST') {
      return createDraftRun(ctx, tenantId);
    }
    if (!id && ctx.request.method === 'GET') {
      return listRuns(ctx, tenantId);
    }
    if (!id && ctx.request.method === 'POST') {
      return createDraftRun(ctx, tenantId);
    }
    if (id && !subresource && ctx.request.method === 'GET') {
      const featureDisabled = await requireScrutinyFeature(ctx, tenantId);
      if (featureDisabled) {
        return featureDisabled;
      }
      const detail = await loadRunDetail(ctx.env, tenantId, id);
      if (!detail) {
        return json({ error: 'not_found', message: 'Scrutiny run not found.' }, { status: 404 });
      }
      return json({ data: detail });
    }
    if (id && subresource === 'materialize' && ctx.request.method === 'POST') {
      return materializeRun(ctx, tenantId, id);
    }
    if (id && subresource === 'reconcile' && ctx.request.method === 'POST') {
      return reconcileRun(ctx, tenantId, id);
    }
    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'scrutiny-items' && id && subresource === 'review') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }
    return reviewItem(ctx, tenantId, id);
  }

  return json({ error: 'not_found' }, { status: 404 });
}
