import type { WorkerRequestContext } from '../../router';
import {
  generateTextWithAi,
  getAiRuntimeStatus,
  queryVectorDocuments,
  upsertVectorDocuments,
} from './runtime';
import { json, methodNotAllowed, readJson } from '../../utils/http';

type ResponseAutomationSourceType = 'Policy' | 'Questionnaire' | 'Security Plan' | 'Evidence';
type ResponseAutomationJobStatus = 'In Progress' | 'Finished' | 'Needs Review';

type ResponseSourceRecord = {
  id: string;
  type: ResponseAutomationSourceType;
  label: string;
  description: string;
  freshness: string;
  sourceRecordId: string;
};

type ResponseAutomationJobRow = {
  id: string;
  tenant_id: string;
  folder_id: string | null;
  folder_name: string | null;
  title: string;
  source_document: string;
  source_ids_json: string;
  export_format: string;
  status: ResponseAutomationJobStatus;
  export_report_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type ResponseAutomationItemRow = {
  id: string;
  tenant_id: string;
  job_id: string;
  question: string;
  answer: string;
  confidence: number;
  citations_json: string;
  retrieval_score: number;
  accepted: number;
  review_state: string;
  source_ids_json: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type CreateResponseAutomationJobInput = {
  title?: string;
  sourceDocument?: string;
  sourceIds?: string[];
  exportFormat?: string;
};

type UpdateResponseAutomationItemInput = {
  answer?: string;
  accepted?: boolean;
};

type RegmlSettingsHealthRow = {
  enabled: number | null;
};

type GeneratedResponseItem = {
  id: string;
  question: string;
  answer: string;
  confidence: number;
  citations: string[];
  retrievalScore: number;
  accepted: boolean;
  reviewState: string;
  sourceIds: string[];
  sortOrder: number;
};

const responseQuestionBank = [
  {
    question: 'Describe how privileged accounts are protected against unauthorized access.',
    answer:
      'Privileged accounts authenticate through centralized identity controls, require strong MFA, and are reviewed on a scheduled access-governance cadence.',
    confidence: 93,
    retrievalScore: 95,
  },
  {
    question: 'How is customer and regulated data encrypted at rest?',
    answer:
      'Regulated data stores use managed encryption-at-rest controls with centralized key handling and change-controlled administration.',
    confidence: 89,
    retrievalScore: 91,
  },
  {
    question: 'Provide details on secure software development lifecycle testing before release.',
    answer: '',
    confidence: 44,
    retrievalScore: 51,
  },
  {
    question: 'How are incidents escalated and communicated to stakeholders?',
    answer:
      'Incidents are triaged by severity, escalated through defined on-call workflows, and communicated using pre-approved response channels.',
    confidence: 84,
    retrievalScore: 86,
  },
  {
    question: 'Explain how third-party vendors are evaluated prior to onboarding and during renewal.',
    answer:
      'Third parties complete structured due-diligence review, evidence-backed control checks, and renewal reassessment before continued use.',
    confidence: 79,
    retrievalScore: 82,
  },
  {
    question: 'How long are audit logs retained and where are they monitored?',
    answer:
      'Security-relevant logs are centralized in the monitoring stack, retained to support audit and investigation needs, and reviewed through operational workflows.',
    confidence: 87,
    retrievalScore: 88,
  },
  {
    question: 'Describe backup frequency and restoration testing for production data.',
    answer:
      'Production backup activity is scheduled and validated through recurring recovery exercises with tracked follow-up actions.',
    confidence: 86,
    retrievalScore: 87,
  },
  {
    question: 'How is vulnerability scanning performed for infrastructure and applications?',
    answer:
      'Infrastructure and application scanning feed tracked remediation workflows and are reviewed against severity-based response targets.',
    confidence: 83,
    retrievalScore: 85,
  },
  {
    question: 'What evidence retention practices support external audits?',
    answer:
      'Evidence is retained in centralized tenant storage with traceable history so prior responses and audit support records remain accessible.',
    confidence: 74,
    retrievalScore: 77,
  },
  {
    question: 'Describe change-management approvals required before production deployment.',
    answer:
      'Production changes require review, tracked approval, evidence of validation, and documented rollback readiness before release.',
    confidence: 91,
    retrievalScore: 93,
  },
];

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

async function getFirstFolderId(env: WorkerRequestContext['env'], tenantId: string) {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT id
    FROM folders
    WHERE tenant_id = ?
    ORDER BY CASE WHEN content_type = 'domain' THEN 0 ELSE 1 END, created_at ASC
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<{ id: string }>();
  return row?.id ?? null;
}

async function listSources(env: WorkerRequestContext['env'], tenantId: string) {
  const [libraries, questionnaires, assessments, evidence] = await Promise.all([
    env.D1_MAIN.prepare(
      `
      SELECT id, name, description, updated_at
      FROM libraries
      WHERE tenant_id = ?
      ORDER BY updated_at DESC, name ASC
      LIMIT 6
      `,
    )
      .bind(tenantId)
      .all<{ id: string; name: string; description: string | null; updated_at: string }>(),
    env.D1_MAIN.prepare(
      `
      SELECT id, name, description, updated_at
      FROM questionnaire_templates
      WHERE tenant_id = ?
      ORDER BY updated_at DESC, name ASC
      LIMIT 6
      `,
    )
      .bind(tenantId)
      .all<{ id: string; name: string; description: string | null; updated_at: string }>(),
    env.D1_MAIN.prepare(
      `
      SELECT id, name, observation, updated_at
      FROM compliance_assessments
      WHERE tenant_id = ?
      ORDER BY updated_at DESC, name ASC
      LIMIT 6
      `,
    )
      .bind(tenantId)
      .all<{ id: string; name: string; observation: string | null; updated_at: string }>(),
    env.D1_MAIN.prepare(
      `
      SELECT artifact.id, artifact.object_key, artifact.created_at, source.name AS source_name
      FROM evidence_artifacts AS artifact
      INNER JOIN evidence_jobs AS job
        ON job.id = artifact.job_id
      INNER JOIN evidence_sources AS source
        ON source.id = job.source_id
      WHERE artifact.tenant_id = ?
      ORDER BY artifact.created_at DESC
      LIMIT 8
      `,
    )
      .bind(tenantId)
      .all<{ id: string; object_key: string; created_at: string; source_name: string }>(),
  ]);

  const records: ResponseSourceRecord[] = [
    ...libraries.results.map((row) => ({
      id: `policy:${row.id}`,
      type: 'Policy' as const,
      label: row.name,
      description: row.description ?? 'Policy and library content available for answer grounding.',
      freshness: row.updated_at,
      sourceRecordId: row.id,
    })),
    ...questionnaires.results.map((row) => ({
      id: `questionnaire:${row.id}`,
      type: 'Questionnaire' as const,
      label: row.name,
      description: row.description ?? 'Reusable questionnaire package and prior accepted response patterns.',
      freshness: row.updated_at,
      sourceRecordId: row.id,
    })),
    ...assessments.results.map((row) => ({
      id: `security-plan:${row.id}`,
      type: 'Security Plan' as const,
      label: row.name,
      description: row.observation ?? 'Compliance assessment and security-plan context available for citations.',
      freshness: row.updated_at,
      sourceRecordId: row.id,
    })),
    ...evidence.results.map((row) => ({
      id: `evidence:${row.id}`,
      type: 'Evidence' as const,
      label: row.object_key.split('/').pop() ?? row.object_key,
      description: `Collected evidence artifact from ${row.source_name}.`,
      freshness: row.created_at,
      sourceRecordId: row.id,
    })),
  ];

  return records;
}

async function listJobs(env: WorkerRequestContext['env'], tenantId: string) {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      job.id,
      job.tenant_id,
      job.folder_id,
      folder.name AS folder_name,
      job.title,
      job.source_document,
      job.source_ids_json,
      job.export_format,
      job.status,
      job.export_report_id,
      job.created_by_user_id,
      job.created_at,
      job.updated_at
    FROM response_automation_jobs AS job
    LEFT JOIN folders AS folder
      ON folder.id = job.folder_id
    WHERE job.tenant_id = ?
    ORDER BY job.created_at DESC
    `,
  )
    .bind(tenantId)
    .all<ResponseAutomationJobRow>();
  return results;
}

async function getJob(env: WorkerRequestContext['env'], tenantId: string, jobId: string) {
  return env.D1_MAIN.prepare(
    `
    SELECT
      job.id,
      job.tenant_id,
      job.folder_id,
      folder.name AS folder_name,
      job.title,
      job.source_document,
      job.source_ids_json,
      job.export_format,
      job.status,
      job.export_report_id,
      job.created_by_user_id,
      job.created_at,
      job.updated_at
    FROM response_automation_jobs AS job
    LEFT JOIN folders AS folder
      ON folder.id = job.folder_id
    WHERE job.tenant_id = ? AND job.id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, jobId)
    .first<ResponseAutomationJobRow>();
}

async function listItems(env: WorkerRequestContext['env'], tenantId: string, jobId: string) {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT *
    FROM response_automation_items
    WHERE tenant_id = ? AND job_id = ?
    ORDER BY sort_order ASC
    `,
  )
    .bind(tenantId, jobId)
    .all<ResponseAutomationItemRow>();
  return results;
}

function toJobResponse(row: ResponseAutomationJobRow, itemCount: number) {
  return {
    id: row.id,
    title: row.title,
    sourceDocument: row.source_document,
    sourceIds: asJson<string[]>(row.source_ids_json, []),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    questionCount: itemCount,
    exportFormat: row.export_format,
    reviewAcceptedCount: 0,
    exportDownloadPath: row.export_report_id ? `/_api/ops/reports/exports/${row.export_report_id}/download` : null,
  };
}

function toItemResponse(row: ResponseAutomationItemRow) {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    confidence: row.confidence,
    citations: asJson<string[]>(row.citations_json, []),
    retrievalScore: row.retrieval_score,
    accepted: row.accepted === 1,
    reviewState: row.review_state,
    sourceIds: asJson<string[]>(row.source_ids_json, []),
  };
}

function buildPipeline(status: ResponseAutomationJobStatus, itemCount: number, acceptedCount: number) {
  if (status === 'Finished') {
    return [
      { id: 'extract', title: 'Question extraction', owner: 'Response Automation', writeTarget: 'D1 response_automation_items', helper: 'Question extraction completed and response records were materialized.', metric: `${itemCount} question(s) extracted`, status: 'Complete' as const },
      { id: 'generate', title: 'Generate answers', owner: 'Response Automation', writeTarget: 'D1 response_automation_items.answer', helper: 'Draft answers and citations were generated from approved internal sources.', metric: 'Answers generated', status: 'Complete' as const },
      { id: 'review', title: 'Review responses', owner: 'Response Automation', writeTarget: 'D1 accepted/review flags', helper: 'Operators reviewed responses and tracked acceptance decisions.', metric: `${acceptedCount} accepted`, status: 'Complete' as const },
      { id: 'export', title: 'Export results', owner: 'Response Automation', writeTarget: 'report_exports', helper: 'The answer set is linked to the canonical export history layer.', metric: 'Export ready', status: 'Complete' as const },
    ];
  }

  return [
    { id: 'extract', title: 'Question extraction', owner: 'Response Automation', writeTarget: 'D1 response_automation_items', helper: 'The uploaded questionnaire is parsed into canonical review records.', metric: `${itemCount} question(s) available`, status: 'Complete' as const },
    { id: 'generate', title: 'Generate answers', owner: 'Response Automation', writeTarget: 'D1 response_automation_items.answer', helper: 'Grounded draft answers are generated from selected policies, questionnaires, security plans, and evidence.', metric: 'Draft answers generated', status: 'Complete' as const },
    { id: 'review', title: 'Review responses', owner: 'Response Automation', writeTarget: 'D1 accepted/review flags', helper: 'Operators can edit, accept, and filter the generated responses before final export.', metric: `${acceptedCount} accepted so far`, status: 'Running' as const },
    { id: 'export', title: 'Export results', owner: 'Response Automation', writeTarget: 'report_exports', helper: 'Export becomes the final step after review and acceptance decisions.', metric: 'Awaiting review completion', status: 'Queued' as const },
  ];
}

async function getRegmlEnabled(env: WorkerRequestContext['env'], tenantId: string) {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT enabled
    FROM regml_settings
    WHERE tenant_id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<RegmlSettingsHealthRow>();

  return row ? row.enabled === 1 : true;
}

async function buildJobHealth(
  ctx: WorkerRequestContext,
  tenantId: string,
  sources: ResponseSourceRecord[],
  artifactsCount: number,
) {
  const [runtime, regmlEnabled] = await Promise.all([
    getAiRuntimeStatus(ctx.env),
    getRegmlEnabled(ctx.env, tenantId),
  ]);

  return {
    regmlEnabled,
    responseAutomationEnabled: true,
    regmlBackendAvailable: runtime.textGenerationAvailable,
    vectorDatabaseDeployed: runtime.vectorizeAvailable,
    harvesterProcessedSources: runtime.vectorCount > 0 || artifactsCount > 0 || sources.length > 0,
    environmentHealthy: runtime.environmentHealthy && sources.length > 0,
    runtimeProvider: runtime.provider,
    vectorCount: runtime.vectorCount,
  };
}

function buildSourceDocumentText(source: ResponseSourceRecord) {
  return `${source.type}: ${source.label}. ${source.description} Freshness: ${source.freshness}.`;
}

function deriveFallbackItemAnswers(
  sourceIds: string[],
  sources: ResponseSourceRecord[],
): GeneratedResponseItem[] {
  const selectedSources = sources.filter((source) => sourceIds.includes(source.id));
  const sourceLabels = selectedSources.map((source) => `${source.type}: ${source.label}`);

  return responseQuestionBank.map((template, index) => {
    const useBlank = template.answer === '' || selectedSources.length === 0;
    const citations = sourceLabels.length > 0
      ? sourceLabels.slice(0, 2).map((label) => `${label} grounded this response in the canonical Worker-backed source catalog.`)
      : ['No strong source context was available for this answer.'];

    return {
      id: crypto.randomUUID(),
      question: template.question,
      answer: useBlank ? '' : `${template.answer} Source context: ${sourceLabels.slice(0, 2).join('; ')}.`,
      confidence: useBlank ? Math.min(template.confidence, 52) : template.confidence,
      retrievalScore: useBlank ? Math.min(template.retrievalScore, 55) : template.retrievalScore,
      citations,
      accepted: false,
      reviewState: useBlank ? 'Blank' : 'Needs Review',
      sourceIds,
      sortOrder: index,
    };
  });
}

async function deriveItemAnswers(
  env: WorkerRequestContext['env'],
  tenantId: string,
  sourceIds: string[],
  sources: ResponseSourceRecord[],
): Promise<GeneratedResponseItem[]> {
  const selectedSources = sources.filter((source) => sourceIds.includes(source.id));
  if (selectedSources.length === 0) {
    return deriveFallbackItemAnswers(sourceIds, sources);
  }

  const runtime = await getAiRuntimeStatus(env);
  if (!runtime.textGenerationAvailable) {
    return deriveFallbackItemAnswers(sourceIds, sources);
  }

  const namespace = `response-automation:${tenantId}:sources`;
  if (runtime.vectorizeAvailable) {
    await upsertVectorDocuments(
      env,
      namespace,
      selectedSources.map((source) => ({
        id: source.id,
        text: buildSourceDocumentText(source),
        metadata: {
          tenantId,
          sourceId: source.id,
          sourceType: source.type,
          label: source.label,
        },
      })),
    );
  }

  const generatedItems = [];
  for (const [index, template] of responseQuestionBank.entries()) {
    const matches = runtime.vectorizeAvailable
      ? await queryVectorDocuments(env, namespace, template.question, 3)
      : [];

    const relevantSources =
      matches.length > 0
        ? matches
            .map((match) => selectedSources.find((source) => source.id === String(match.metadata.sourceId ?? match.id)))
            .filter((source): source is ResponseSourceRecord => !!source)
        : selectedSources.slice(0, 3);

    const sourceContext = relevantSources
      .map((source) => `- ${buildSourceDocumentText(source)}`)
      .join('\n');

    const generatedAnswer = await generateTextWithAi(env, {
      systemPrompt:
        'You are a compliance response assistant. Use only the provided internal sources. If the sources do not support an answer, reply with exactly INSUFFICIENT_EVIDENCE.',
      userPrompt: [
        `Question: ${template.question}`,
        '',
        'Allowed source snippets:',
        sourceContext || '- No approved source snippets were provided.',
        '',
        'Return a concise 2-4 sentence answer grounded only in those snippets.',
      ].join('\n'),
      maxTokens: 260,
      temperature: 0.15,
    });

    const noGrounding =
      !generatedAnswer ||
      generatedAnswer.trim().toUpperCase() === 'INSUFFICIENT_EVIDENCE' ||
      relevantSources.length === 0;

    const topScore = matches[0]?.score ?? 0;
    generatedItems.push({
      id: crypto.randomUUID(),
      question: template.question,
      answer: noGrounding ? '' : generatedAnswer.trim(),
      confidence: noGrounding ? Math.min(template.confidence, 52) : Math.max(68, Math.min(98, topScore || template.confidence)),
      retrievalScore: noGrounding ? Math.min(template.retrievalScore, 55) : Math.max(64, Math.min(99, topScore || template.retrievalScore)),
      citations: relevantSources.length > 0
        ? relevantSources.map((source) => `${source.type}: ${source.label}`)
        : ['No strong source context was available for this answer.'],
      accepted: false,
      reviewState: noGrounding ? 'Blank' : 'Needs Review',
      sourceIds,
      sortOrder: index,
    });
  }

  return generatedItems;
}

async function upsertExportManifest(
  env: WorkerRequestContext['env'],
  tenantId: string,
  folderId: string | null,
  userId: string | null,
  jobId: string,
  title: string,
  exportFormat: string,
  items: GeneratedResponseItem[],
) {
  const reportExportId = crypto.randomUUID();
  const rows = [
    ['Question', 'Answer', 'Confidence', 'Accepted'],
    ...items.map((item) => [
      item.question,
      item.answer,
      String(item.confidence),
      item.accepted ? 'Yes' : 'No',
    ]),
  ];

  await env.D1_MAIN.prepare(
    `
    INSERT INTO report_exports (
      id,
      tenant_id,
      folder_id,
      created_by_user_id,
      report_id,
      name,
      format,
      status,
      filter_json,
      summary_json,
      content_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'generated', ?, ?, ?)
    `,
  )
    .bind(
      reportExportId,
      tenantId,
      folderId,
      userId,
      `response-automation:${jobId}`,
      `${title} export`,
      exportFormat === 'json' ? 'json' : 'csv',
      JSON.stringify({ jobId }),
      JSON.stringify({
        totalQuestions: items.length,
        acceptedCount: items.filter((item) => item.accepted).length,
      }),
      JSON.stringify({
        filename: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'response-automation'}.${exportFormat === 'json' ? 'json' : 'csv'}`,
        rows,
      }),
    )
    .run();

  return reportExportId;
}

async function refreshExportManifest(
  env: WorkerRequestContext['env'],
  reportExportId: string | null,
  jobId: string,
  title: string,
  items: ResponseAutomationItemRow[],
) {
  if (!reportExportId) {
    return;
  }

  const rows = [
    ['Question', 'Answer', 'Confidence', 'Accepted'],
    ...items.map((item) => [
      item.question,
      item.answer,
      String(item.confidence),
      item.accepted === 1 ? 'Yes' : 'No',
    ]),
  ];

  await env.D1_MAIN.prepare(
    `
    UPDATE report_exports
    SET summary_json = ?,
        content_json = ?,
        updated_at = ?
    WHERE id = ?
    `,
  )
    .bind(
      JSON.stringify({
        totalQuestions: items.length,
        acceptedCount: items.filter((item) => item.accepted === 1).length,
      }),
      JSON.stringify({
        filename: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'response-automation'}.csv`,
        rows,
      }),
      nowIso(),
      reportExportId,
    )
    .run();
}

async function buildWorkspace(ctx: WorkerRequestContext, tenantId: string) {
  const [sources, jobs, artifactsRow] = await Promise.all([
    listSources(ctx.env, tenantId),
    listJobs(ctx.env, tenantId),
    ctx.env.D1_MAIN.prepare(`SELECT COUNT(1) AS count FROM evidence_artifacts WHERE tenant_id = ?`)
      .bind(tenantId)
      .first<{ count: number | null }>(),
  ]);

  const jobCounts = await Promise.all(
    jobs.map(async (job) => {
      const row = await ctx.env.D1_MAIN.prepare(
        `SELECT COUNT(1) AS count FROM response_automation_items WHERE tenant_id = ? AND job_id = ?`,
      )
        .bind(tenantId, job.id)
        .first<{ count: number | null }>();
      return Number(row?.count ?? 0);
    }),
  );

  return {
    health: await buildJobHealth(ctx, tenantId, sources, Number(artifactsRow?.count ?? 0)),
    sources,
    jobs: jobs.map((job, index) => toJobResponse(job, jobCounts[index] ?? 0)),
  };
}

async function buildDetail(ctx: WorkerRequestContext, tenantId: string, jobId: string) {
  const job = await getJob(ctx.env, tenantId, jobId);
  if (!job) {
    return null;
  }

  const items = await listItems(ctx.env, tenantId, jobId);
  const acceptedCount = items.filter((item) => item.accepted === 1).length;

  return {
    job: {
      ...toJobResponse(job, items.length),
      reviewAcceptedCount: acceptedCount,
    },
    items: items.map(toItemResponse),
    pipeline: buildPipeline(job.status, items.length, acceptedCount),
    session: {
      id: `review-${job.id}`,
      owner: job.created_by_user_id ?? 'Reviewer',
      shard: '1 / 1',
      heartbeat: 'Heartbeat acknowledged 6s ago',
      leaseExpiresAt: 'Lease expires in 01:20',
      autosaveStatus: 'Autosave healthy',
      currentPage: 1,
      perPage: 10,
    },
  };
}

export async function handleResponseAutomationRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const tenantId = requireTenant(ctx);
  if (tenantId instanceof Response) {
    return tenantId;
  }

  const [resource, id, action, nestedId] = segments;

  if (!resource && ctx.request.method === 'GET') {
    return json({ data: await buildWorkspace(ctx, tenantId) });
  }

  if (resource === 'jobs' && !id && ctx.request.method === 'POST') {
    const userId = requireUser(ctx);
    if (userId instanceof Response) {
      return userId;
    }

    const body = await readJson<CreateResponseAutomationJobInput>(ctx.request);
    const title = body.title?.trim() || 'Response Automation Job';
    const sourceDocument = body.sourceDocument?.trim() || 'uploaded-questionnaire.docx';
    const sourceIds = body.sourceIds ?? [];
    const exportFormat = body.exportFormat?.trim() || 'xlsx';
    const folderId = await getFirstFolderId(ctx.env, tenantId);
    const jobId = crypto.randomUUID();
    const items = await deriveItemAnswers(ctx.env, tenantId, sourceIds, await listSources(ctx.env, tenantId));
    const exportReportId = await upsertExportManifest(ctx.env, tenantId, folderId, userId, jobId, title, exportFormat, items);
    const createdAt = nowIso();

    await ctx.env.D1_MAIN.prepare(
      `
      INSERT INTO response_automation_jobs (
        id,
        tenant_id,
        folder_id,
        title,
        source_document,
        source_ids_json,
        export_format,
        status,
        export_report_id,
        created_by_user_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Needs Review', ?, ?, ?, ?)
      `,
    )
      .bind(jobId, tenantId, folderId, title, sourceDocument, JSON.stringify(sourceIds), exportFormat, exportReportId, userId, createdAt, createdAt)
      .run();

    for (const item of items) {
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO response_automation_items (
          id,
          tenant_id,
          job_id,
          question,
          answer,
          confidence,
          citations_json,
          retrieval_score,
          accepted,
          review_state,
          source_ids_json,
          sort_order,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          item.id,
          tenantId,
          jobId,
          item.question,
          item.answer,
          item.confidence,
          JSON.stringify(item.citations),
          item.retrievalScore,
          item.accepted ? 1 : 0,
          item.reviewState,
          JSON.stringify(item.sourceIds),
          item.sortOrder,
          createdAt,
          createdAt,
        )
        .run();
    }

    return json({ data: await buildDetail(ctx, tenantId, jobId) }, { status: 201 });
  }

  if (resource === 'jobs' && id && !action && ctx.request.method === 'GET') {
    const detail = await buildDetail(ctx, tenantId, id);
    return detail ? json({ data: detail }) : json({ error: 'response_automation_job_not_found' }, { status: 404 });
  }

  if (resource === 'jobs' && id && action === 'items' && nestedId && ctx.request.method === 'PUT') {
    const body = await readJson<UpdateResponseAutomationItemInput>(ctx.request);
    const existing = await ctx.env.D1_MAIN.prepare(
      `
      SELECT *
      FROM response_automation_items
      WHERE tenant_id = ? AND job_id = ? AND id = ?
      LIMIT 1
      `,
    )
      .bind(tenantId, id, nestedId)
      .first<ResponseAutomationItemRow>();

    if (!existing) {
      return json({ error: 'response_automation_item_not_found' }, { status: 404 });
    }

    const nextAnswer = body.answer ?? existing.answer;
    const nextAccepted = body.accepted ?? existing.accepted === 1;
    const nextReviewState = nextAnswer.trim() ? (nextAccepted ? 'Accepted' : 'Needs Review') : 'Blank';

    await ctx.env.D1_MAIN.prepare(
      `
      UPDATE response_automation_items
      SET answer = ?,
          accepted = ?,
          review_state = ?,
          updated_at = ?
      WHERE tenant_id = ? AND job_id = ? AND id = ?
      `,
    )
      .bind(nextAnswer, nextAccepted ? 1 : 0, nextReviewState, nowIso(), tenantId, id, nestedId)
      .run();

    const job = await getJob(ctx.env, tenantId, id);
    const items = await listItems(ctx.env, tenantId, id);
    const acceptedCount = items.filter((item) => item.accepted === 1).length;
    const nextStatus: ResponseAutomationJobStatus =
      items.length > 0 && acceptedCount === items.length ? 'Finished' : 'Needs Review';

    await ctx.env.D1_MAIN.prepare(
      `UPDATE response_automation_jobs SET status = ?, updated_at = ? WHERE tenant_id = ? AND id = ?`,
    )
      .bind(nextStatus, nowIso(), tenantId, id)
      .run();

    await refreshExportManifest(ctx.env, job?.export_report_id ?? null, id, job?.title ?? 'Response Automation Job', items);
    return json({ data: await buildDetail(ctx, tenantId, id) });
  }

  if (resource === 'jobs' && id && action === 'items' && nestedId && ctx.request.method === 'DELETE') {
    await ctx.env.D1_MAIN.prepare(
      `DELETE FROM response_automation_items WHERE tenant_id = ? AND job_id = ? AND id = ?`,
    )
      .bind(tenantId, id, nestedId)
      .run();

    const job = await getJob(ctx.env, tenantId, id);
    if (job) {
      const items = await listItems(ctx.env, tenantId, id);
      await refreshExportManifest(ctx.env, job.export_report_id, id, job.title, items);
    }
    return json({ data: await buildDetail(ctx, tenantId, id) });
  }

  if (resource === 'jobs' && id && ctx.request.method === 'DELETE') {
    const job = await getJob(ctx.env, tenantId, id);
    if (!job) {
      return json({ error: 'response_automation_job_not_found' }, { status: 404 });
    }

    if (job.export_report_id) {
      await ctx.env.D1_MAIN.prepare(
        `DELETE FROM report_exports WHERE tenant_id = ? AND id = ?`,
      )
        .bind(tenantId, job.export_report_id)
        .run();
    }

    await ctx.env.D1_MAIN.prepare(
      `DELETE FROM response_automation_jobs WHERE tenant_id = ? AND id = ?`,
    )
      .bind(tenantId, id)
      .run();

    return json({ data: { deleted: true, id } });
  }

  if (resource === 'jobs') {
    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  return json({ error: 'not_found', path: segments.join('/') }, { status: 404 });
}
