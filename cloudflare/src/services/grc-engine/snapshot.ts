import type { EnvBindings } from '../../types/env';
import { curatedSnapshot } from './curatedSnapshot.generated';

type SnapshotFrameworkRecord = (typeof curatedSnapshot.frameworks)[number];
type SnapshotWorkflowRecord = (typeof curatedSnapshot.workflows)[number];
type PreparedStatement = ReturnType<EnvBindings['D1_MAIN']['prepare']>;

type ImportStatusRow = {
  id: string;
  source_revision: string;
  imported_at: string;
  summary_json: string;
};

export type CuratedSnapshotImportPhase = 'frameworks' | 'workflows';

export type CuratedSnapshotImportProgress = {
  snapshotId: string;
  importedAt: string;
  phase: CuratedSnapshotImportPhase;
  processed: number;
  total: number;
  nextCursor: number | null;
  complete: boolean;
  summary: {
    frameworkCount: number;
    workflowCount: number;
    documentCount: number;
  };
};

const BANNED_PRODUCT_TERMS = ['/plugin', '/grc-engineer:', 'claude-grc', 'marketplace'];

function nowIso() {
  return new Date().toISOString();
}

function stripFrontmatter(markdown: string) {
  return markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/m, '');
}

export function sanitizeImportedText(value: string) {
  let sanitized = value
    .replace(/\b[Cc]laude\b/g, 'Regovise')
    .replace(/\bmarketplace\b/gi, 'reference catalog')
    .replace(/\bplugins?\b/gi, 'framework packs')
    .replace(/\bslash-commands?\b/gi, 'workspace actions')
    .replace(/\bscaffolded\b/gi, 'imported')
    .replace(/\bstub-depth\b/gi, 'imported reference depth')
    .replace(/\bfull-depth\b/gi, 'fully operational depth')
    .replace(/\breference-depth\b/gi, 'reference depth')
    .replace(/\blevel up to\b/gi, 'expand toward')
    .replace(/\bopen a PR\b/gi, 'capture the follow-up in Regovise backlog');

  for (const token of BANNED_PRODUCT_TERMS) {
    sanitized = sanitized.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 'Regovise');
  }

  return sanitized;
}

export function sanitizeImportedMarkdown(markdown: string) {
  let sanitized = stripFrontmatter(markdown).replace(/\r\n/g, '\n');

  sanitized = sanitized.replace(/```bash[\s\S]*?```/gi, (block) => {
    if (!/\/plugin|\/grc-engineer:|\/[a-z0-9-]+:[a-z0-9-]+/i.test(block)) {
      return block;
    }
    return [
      'In Regovise:',
      '',
      '- Review the imported framework guidance in Framework Library.',
      '- Use Findings Explorer to inspect normalized control evidence.',
      '- Run cross-framework analysis from Gap Assessments.',
      '- Use Report Bundles, Evidence Packages, and GRC Admin for downstream delivery and maintenance.',
      '',
    ].join('\n');
  });

  sanitized = sanitizeImportedText(sanitized)
    .replace(/\/grc-engineer:gap-assessment/gi, 'Gap Assessments')
    .replace(/\/plugin install[^\n]*/gi, 'Open the imported framework pack in Framework Library.')
    .replace(/\/[a-z0-9-]+:scope/gi, 'Framework Library scope guidance')
    .replace(/\/[a-z0-9-]+:assess/gi, 'Gap Assessments')
    .replace(/\/[a-z0-9-]+:evidence-checklist/gi, 'the evidence checklist in Framework Library')
    .replace(/\/[a-z0-9-]+:[a-z0-9-]+/gi, 'the corresponding Regovise workflow');

  return sanitized.trim();
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function putSnapshotArtifact(env: EnvBindings, key: string, payload: unknown) {
  await env.R2_EVIDENCE.put(key, JSON.stringify(payload, null, 2), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

function summarizeCuratedSnapshot() {
  return {
    frameworkCount: curatedSnapshot.frameworks.length,
    workflowCount: curatedSnapshot.workflows.length,
    documentCount:
      curatedSnapshot.frameworks.reduce((total, item) => total + item.documents.length, 0) +
      curatedSnapshot.workflows.reduce((total, item) => total + item.documents.length, 0),
  };
}

async function getCuratedSnapshotIdentity() {
  const snapshotId = await sha256(
    `${curatedSnapshot.sourceRepo}:${curatedSnapshot.sourceRevision}:${curatedSnapshot.generatedAt}`,
  );
  return {
    snapshotId,
    artifactKey: `grc-content/snapshots/${snapshotId}.json`,
    summary: summarizeCuratedSnapshot(),
  };
}

async function buildFrameworkDocumentStatements(
  env: EnvBindings,
  frameworkId: string | null,
  workspaceSlug: string | null,
  document: {
    slug: string;
    title: string;
    summary?: string;
    docKind: string;
    bodyMarkdown: string;
    sourcePath: string;
    sourceRevision?: string;
    contentHash?: string;
  },
  importedAt: string,
): Promise<PreparedStatement[]> {
  const documentId = await sha256(`${frameworkId ?? workspaceSlug}:${document.slug}`);
  const sourceRevision = document.sourceRevision ?? curatedSnapshot.sourceRevision;
  const sanitizedBodyMarkdown = sanitizeImportedMarkdown(document.bodyMarkdown);
  const contentHash = await sha256(sanitizedBodyMarkdown);
  const summary = sanitizeImportedText(document.summary ?? '').trim();
  const revisionId = await sha256(`${documentId}:${contentHash}`);

  return [
    env.D1_MAIN.prepare(
      `
      INSERT INTO grc_content_documents (
        id,
        framework_id,
        workspace_slug,
        slug,
        title,
        summary,
        doc_kind,
        audience,
        tags_json,
        source_repo,
        source_path,
        source_revision,
        content_hash,
        imported_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'product', '[]', ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        summary = excluded.summary,
        doc_kind = excluded.doc_kind,
        source_repo = excluded.source_repo,
        source_path = excluded.source_path,
        source_revision = excluded.source_revision,
        content_hash = excluded.content_hash,
        imported_at = excluded.imported_at,
        updated_at = excluded.updated_at
      `,
    ).bind(
      documentId,
      frameworkId,
      workspaceSlug,
      document.slug,
      sanitizeImportedText(document.title),
      summary,
      document.docKind,
      curatedSnapshot.sourceRepo,
      document.sourcePath,
      sourceRevision,
      contentHash,
      importedAt,
      importedAt,
      importedAt,
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR REPLACE INTO grc_content_revisions (
        id,
        document_id,
        body_markdown,
        content_hash,
        source_repo,
        source_path,
        source_revision,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      revisionId,
      documentId,
      sanitizedBodyMarkdown,
      contentHash,
      curatedSnapshot.sourceRepo,
      document.sourcePath,
      sourceRevision,
      importedAt,
    ),
  ];
}

async function importFrameworks(
  env: EnvBindings,
  frameworks: readonly SnapshotFrameworkRecord[],
  importedAt: string,
) {
  for (const framework of frameworks) {
    const frameworkId = await sha256(`framework:${framework.slug}`);
    const statements: PreparedStatement[] = [
      env.D1_MAIN.prepare(
        `
        INSERT INTO grc_frameworks (
          id,
          slug,
          framework_key,
          name,
          description,
          category,
          version,
          tags_json,
          scf_framework_id,
          source_repo,
          source_path,
          source_revision,
          imported_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          framework_key = excluded.framework_key,
          name = excluded.name,
          description = excluded.description,
          category = excluded.category,
          version = excluded.version,
          tags_json = excluded.tags_json,
          scf_framework_id = excluded.scf_framework_id,
          source_repo = excluded.source_repo,
          source_path = excluded.source_path,
          source_revision = excluded.source_revision,
          imported_at = excluded.imported_at,
          updated_at = excluded.updated_at
        `,
      ).bind(
        frameworkId,
        framework.slug,
        framework.frameworkKey,
        framework.name,
        sanitizeImportedText(framework.description),
        framework.category,
        framework.version,
        JSON.stringify(framework.tags),
        framework.scfFrameworkId,
        curatedSnapshot.sourceRepo,
        framework.sourcePath,
        framework.sourceRevision,
        importedAt,
        importedAt,
      ),
    ];

    for (const document of framework.documents) {
      statements.push(...(await buildFrameworkDocumentStatements(env, frameworkId, null, document, importedAt)));
    }

    await env.D1_MAIN.batch(statements);
  }
}

async function importWorkflowDocuments(
  env: EnvBindings,
  workflows: readonly SnapshotWorkflowRecord[],
  importedAt: string,
) {
  for (const workflow of workflows) {
    const statements: PreparedStatement[] = [];
    for (const document of workflow.documents) {
      statements.push(...(await buildFrameworkDocumentStatements(env, null, workflow.slug, document, importedAt)));
    }
    if (statements.length > 0) {
      await env.D1_MAIN.batch(statements);
    }
  }
}

export async function importCuratedSnapshotSlice(
  env: EnvBindings,
  input: {
    phase: CuratedSnapshotImportPhase;
    cursor?: number;
    limit?: number;
    importedAt?: string;
    snapshotId?: string;
  },
): Promise<CuratedSnapshotImportProgress> {
  const { snapshotId } = await getCuratedSnapshotIdentity();
  const importedAt = input.importedAt ?? nowIso();
  const cursor = Math.max(0, input.cursor ?? 0);
  const limit = Math.max(1, input.limit ?? 4);
  const phase = input.phase;
  const records =
    phase === 'frameworks' ? curatedSnapshot.frameworks : curatedSnapshot.workflows;
  const slice = records.slice(cursor, cursor + limit);

  if (phase === 'frameworks') {
    await importFrameworks(env, slice as SnapshotFrameworkRecord[], importedAt);
  } else {
    await importWorkflowDocuments(env, slice as SnapshotWorkflowRecord[], importedAt);
  }

  const nextCursor = cursor + slice.length;
  return {
    snapshotId: input.snapshotId ?? snapshotId,
    importedAt,
    phase,
    processed: slice.length,
    total: records.length,
    nextCursor: nextCursor < records.length ? nextCursor : null,
    complete: nextCursor >= records.length,
    summary: summarizeCuratedSnapshot(),
  };
}

export async function finalizeCuratedSnapshotImport(
  env: EnvBindings,
  input: {
    importedAt?: string;
    snapshotId?: string;
  } = {},
) {
  const importedAt = input.importedAt ?? nowIso();
  const { snapshotId, artifactKey, summary } = await getCuratedSnapshotIdentity();

  await putSnapshotArtifact(env, artifactKey, curatedSnapshot);

  await env.D1_MAIN.prepare(
    `
    INSERT OR REPLACE INTO grc_import_snapshots (
      id,
      snapshot_kind,
      source_repo,
      source_revision,
      artifact_key,
      summary_json,
      imported_at,
      created_at,
      updated_at
    ) VALUES (?, 'curated-content', ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      input.snapshotId ?? snapshotId,
      curatedSnapshot.sourceRepo,
      curatedSnapshot.sourceRevision,
      artifactKey,
      JSON.stringify(summary),
      importedAt,
      importedAt,
      importedAt,
    )
    .run();

  return {
    id: input.snapshotId ?? snapshotId,
    artifactKey,
    importedAt,
    summary,
  };
}

export async function importCuratedSnapshot(env: EnvBindings) {
  const importedAt = nowIso();
  const { snapshotId } = await getCuratedSnapshotIdentity();

  let frameworkCursor = 0;
  while (frameworkCursor < curatedSnapshot.frameworks.length) {
    const progress = await importCuratedSnapshotSlice(env, {
      phase: 'frameworks',
      cursor: frameworkCursor,
      importedAt,
      snapshotId,
      limit: 4,
    });
    frameworkCursor = progress.nextCursor ?? curatedSnapshot.frameworks.length;
  }

  let workflowCursor = 0;
  while (workflowCursor < curatedSnapshot.workflows.length) {
    const progress = await importCuratedSnapshotSlice(env, {
      phase: 'workflows',
      cursor: workflowCursor,
      importedAt,
      snapshotId,
      limit: 4,
    });
    workflowCursor = progress.nextCursor ?? curatedSnapshot.workflows.length;
  }

  return finalizeCuratedSnapshotImport(env, {
    importedAt,
    snapshotId,
  });
}

export async function getCuratedImportStatus(env: EnvBindings) {
  const latestSnapshot = await env.D1_MAIN.prepare(
    `
    SELECT id, source_revision, imported_at, summary_json
    FROM grc_import_snapshots
    WHERE snapshot_kind = 'curated-content'
    ORDER BY imported_at DESC
    LIMIT 1
    `,
  ).first<ImportStatusRow>();

  const counts = await env.D1_MAIN.prepare(
    `
    SELECT
      (SELECT COUNT(*) FROM grc_frameworks) AS framework_count,
      (SELECT COUNT(*) FROM grc_content_documents) AS document_count
    `,
  ).first<{ framework_count: number; document_count: number }>();

  return {
    latestSnapshot: latestSnapshot
      ? {
          id: latestSnapshot.id,
          sourceRevision: latestSnapshot.source_revision,
          importedAt: latestSnapshot.imported_at,
          summary: JSON.parse(latestSnapshot.summary_json || '{}') as Record<string, unknown>,
        }
      : null,
    frameworkCount: Number(counts?.framework_count ?? 0),
    documentCount: Number(counts?.document_count ?? 0),
  };
}
