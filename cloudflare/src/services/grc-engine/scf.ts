import type { EnvBindings } from '../../types/env';
import type { CrosswalkResolution } from './types';

type FrameworkRow = {
  id: string;
  slug: string;
  framework_key: string;
  name: string;
  scf_framework_id: string | null;
};

type ScfVersionRow = {
  id: string;
  scf_version: string;
};

type ScfControlRow = {
  control_id: string;
  title: string;
  family_code: string | null;
  family_name: string | null;
  description: string | null;
};

type CrosswalkRow = {
  framework_id: string;
  framework_name: string;
  framework_control_id: string;
  scf_control_id: string;
};

const SCF_BASE_URL = 'https://grcengclub.github.io/scf-api';

function nowIso() {
  return new Date().toISOString();
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function normalizeFrameworkToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${SCF_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`SCF request failed for ${path}: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function upsertScfControl(
  env: EnvBindings,
  versionId: string,
  scfControlId: string,
  control: Record<string, unknown>,
) {
  const rowId = await sha256(`${versionId}:${scfControlId}`);
  const importedAt = nowIso();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO grc_scf_controls (
      id,
      version_id,
      control_id,
      family_code,
      family_name,
      title,
      description,
      evidence_requests_json,
      profiles_json,
      raw_json,
      imported_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      family_code = excluded.family_code,
      family_name = excluded.family_name,
      title = excluded.title,
      description = excluded.description,
      evidence_requests_json = excluded.evidence_requests_json,
      profiles_json = excluded.profiles_json,
      raw_json = excluded.raw_json,
      imported_at = excluded.imported_at,
      updated_at = excluded.updated_at
    `,
  )
    .bind(
      rowId,
      versionId,
      scfControlId,
      String(control.family ?? ''),
      String(control.family_name ?? ''),
      String(control.title ?? scfControlId),
      String(control.description ?? ''),
      JSON.stringify(control.evidence_requests ?? []),
      JSON.stringify(control.profiles ?? []),
      JSON.stringify(control),
      importedAt,
      importedAt,
      importedAt,
    )
    .run();
}

async function ensureScfControlDetails(
  env: EnvBindings,
  version: ScfVersionRow,
  scfControlIds: string[],
) {
  const uniqueIds = [...new Set(scfControlIds.map((value) => value.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return;
  }

  const placeholders = uniqueIds.map(() => '?').join(', ');
  const existing = await env.D1_MAIN.prepare(
    `
    SELECT control_id
    FROM grc_scf_controls
    WHERE version_id = ? AND control_id IN (${placeholders})
    `,
  )
    .bind(version.id, ...uniqueIds)
    .all<{ control_id: string }>();

  const existingIds = new Set(existing.results.map((row) => row.control_id));
  const missingIds = uniqueIds.filter((controlId) => !existingIds.has(controlId));

  for (const controlId of missingIds) {
    const control = await fetchJson<Record<string, unknown>>(`/api/controls/${encodeURIComponent(controlId)}.json`);
    await upsertScfControl(env, version.id, controlId, control);
  }
}

async function getLatestScfVersion(env: EnvBindings): Promise<ScfVersionRow | null> {
  return env.D1_MAIN.prepare(
    `
    SELECT id, scf_version
    FROM grc_scf_versions
    ORDER BY imported_at DESC
    LIMIT 1
    `,
  ).first<ScfVersionRow>();
}

async function loadFrameworkRows(env: EnvBindings): Promise<FrameworkRow[]> {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT id, slug, framework_key, name, scf_framework_id
    FROM grc_frameworks
    ORDER BY name ASC
    `,
  ).all<FrameworkRow>();

  return rows.results;
}

async function matchFrameworkRow(
  env: EnvBindings,
  token: string,
): Promise<FrameworkRow | null> {
  const normalized = normalizeFrameworkToken(token);
  const rows = await loadFrameworkRows(env);
  return (
    rows.find((row) =>
      [
        row.slug,
        row.framework_key,
        row.name,
        row.scf_framework_id ?? '',
      ].some((candidate) => normalizeFrameworkToken(candidate) === normalized),
    ) ?? null
  );
}

async function ensureScfVersion(
  env: EnvBindings,
  summary: Record<string, unknown>,
): Promise<ScfVersionRow> {
  const scfVersion = String(summary.scf_version ?? summary.version ?? 'unknown');
  const contentHash = await sha256(JSON.stringify(summary));
  const now = nowIso();
  const id = `scf:${scfVersion}`;

  await env.D1_MAIN.prepare(
    `
    INSERT INTO grc_scf_versions (
      id,
      scf_version,
      source_url,
      summary_json,
      content_hash,
      imported_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      summary_json = excluded.summary_json,
      content_hash = excluded.content_hash,
      imported_at = excluded.imported_at,
      updated_at = excluded.updated_at
    `,
  )
    .bind(id, scfVersion, `${SCF_BASE_URL}/api`, JSON.stringify(summary), contentHash, now, now, now)
    .run();

  await env.R2_EVIDENCE.put(`grc-scf/${scfVersion}/summary.json`, JSON.stringify(summary, null, 2), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });

  return { id, scf_version: scfVersion };
}

export async function refreshScfCrosswalks(
  env: EnvBindings,
  frameworkIds?: string[],
) {
  const summary = await fetchJson<Record<string, unknown>>('/api/summary.json');
  const version = await ensureScfVersion(env, summary);
  const allFrameworkRows = await loadFrameworkRows(env);
  const targetFrameworks = allFrameworkRows.filter(
    (row) => row.scf_framework_id && (!frameworkIds || frameworkIds.includes(row.id)),
  );

  const refreshedFrameworks: string[] = [];
  const uniqueScfIds = new Set<string>();

  for (const framework of targetFrameworks) {
    const frameworkId = framework.scf_framework_id;
    if (!frameworkId) {
      continue;
    }

    const crosswalk = await fetchJson<{
      framework_id: string;
      display_name: string;
      framework_to_scf?: { mappings?: Record<string, string[]> };
    }>(`/api/crosswalks/${frameworkId}.json`);

    await env.R2_EVIDENCE.put(
      `grc-scf/${version.scf_version}/crosswalks/${frameworkId}.json`,
      JSON.stringify(crosswalk, null, 2),
      { httpMetadata: { contentType: 'application/json; charset=utf-8' } },
    );

    const mappings = crosswalk.framework_to_scf?.mappings ?? {};
    const statements = [
      env.D1_MAIN.prepare(
        `
        DELETE FROM grc_scf_crosswalks
        WHERE version_id = ? AND framework_id = ?
        `,
      ).bind(version.id, frameworkId),
    ];
    for (const [frameworkControlId, scfControlIds] of Object.entries(mappings)) {
      for (const scfControlId of scfControlIds) {
        uniqueScfIds.add(scfControlId);
        const rowId = await sha256(`${version.id}:${frameworkId}:${frameworkControlId}:${scfControlId}`);
        const importedAt = nowIso();
        statements.push(
          env.D1_MAIN.prepare(
            `
            INSERT OR REPLACE INTO grc_scf_crosswalks (
              id,
              version_id,
              framework_id,
              framework_name,
              framework_control_id,
              scf_control_id,
              raw_json,
              imported_at,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
          ).bind(
            rowId,
            version.id,
            frameworkId,
            crosswalk.display_name,
            frameworkControlId,
            scfControlId,
            JSON.stringify({
              framework_control_id: frameworkControlId,
              scf_control_id: scfControlId,
            }),
            importedAt,
            importedAt,
          ),
        );
      }
    }

    await env.D1_MAIN.batch(statements);

    refreshedFrameworks.push(framework.slug);
  }

  return {
    scfVersion: version.scf_version,
    refreshedFrameworks,
    scfControlCount: uniqueScfIds.size,
  };
}

async function ensureFrameworkCrosswalkReady(env: EnvBindings, framework: FrameworkRow) {
  const latestVersion = await getLatestScfVersion(env);
  if (!latestVersion && framework.scf_framework_id) {
    await refreshScfCrosswalks(env, [framework.id]);
    return;
  }

  if (!latestVersion || !framework.scf_framework_id) {
    return;
  }

  const count = await env.D1_MAIN.prepare(
    `
    SELECT COUNT(*) AS total_count
    FROM grc_scf_crosswalks
    WHERE version_id = ? AND framework_id = ?
    `,
  )
    .bind(latestVersion.id, framework.scf_framework_id)
    .first<{ total_count: number }>();

  if (Number(count?.total_count ?? 0) === 0) {
    await refreshScfCrosswalks(env, [framework.id]);
  }
}

export async function resolveControlToScf(
  env: EnvBindings,
  frameworkToken: string,
  controlId: string,
): Promise<CrosswalkResolution> {
  const normalizedFramework = normalizeFrameworkToken(frameworkToken);
  if (normalizedFramework === 'scf' || normalizedFramework === 'secure-controls-framework') {
    const latestVersion = await getLatestScfVersion(env);
    if (!latestVersion) {
      throw new Error('No SCF version has been imported yet.');
    }

    await ensureScfControlDetails(env, latestVersion, [controlId]);

    const control = await env.D1_MAIN.prepare(
      `
      SELECT control_id, title, family_code, family_name, description
      FROM grc_scf_controls
      WHERE version_id = ? AND control_id = ?
      LIMIT 1
      `,
    )
      .bind(latestVersion.id, controlId)
      .first<ScfControlRow>();

    return {
      framework: frameworkToken,
      controlId,
      scfControls: control
        ? [
            {
              controlId: control.control_id,
              title: control.title,
              familyCode: control.family_code,
              familyName: control.family_name,
              description: control.description,
            },
          ]
        : [],
      targets: await expandScfControl(env, controlId),
    };
  }

  const framework = await matchFrameworkRow(env, frameworkToken);
  if (!framework?.scf_framework_id) {
    return {
      framework: frameworkToken,
      controlId,
      scfControls: [],
      targets: [],
    };
  }

  await ensureFrameworkCrosswalkReady(env, framework);
  const latestVersion = await getLatestScfVersion(env);
  if (!latestVersion) {
    return {
      framework: frameworkToken,
      controlId,
      scfControls: [],
      targets: [],
    };
  }

  const crosswalkRows = await env.D1_MAIN.prepare(
    `
    SELECT framework_id, framework_name, framework_control_id, scf_control_id
    FROM grc_scf_crosswalks
    WHERE version_id = ? AND framework_id = ? AND framework_control_id = ?
    `,
  )
    .bind(latestVersion.id, framework.scf_framework_id, controlId)
    .all<CrosswalkRow>();

  await ensureScfControlDetails(
    env,
    latestVersion,
    crosswalkRows.results.map((row) => row.scf_control_id),
  );

  const rows = await env.D1_MAIN.prepare(
    `
    SELECT crosswalk.framework_id, crosswalk.framework_name, crosswalk.framework_control_id, crosswalk.scf_control_id,
           control.title, control.family_code, control.family_name, control.description
    FROM grc_scf_crosswalks AS crosswalk
    LEFT JOIN grc_scf_controls AS control
      ON control.version_id = crosswalk.version_id AND control.control_id = crosswalk.scf_control_id
    WHERE crosswalk.version_id = ? AND crosswalk.framework_id = ? AND crosswalk.framework_control_id = ?
    `,
  )
    .bind(latestVersion.id, framework.scf_framework_id, controlId)
    .all<
      CrosswalkRow & {
        title: string | null;
        family_code: string | null;
        family_name: string | null;
        description: string | null;
      }
    >();

  const scfControls = rows.results.map((row) => ({
    controlId: row.scf_control_id,
    title: row.title ?? row.scf_control_id,
    familyCode: row.family_code,
    familyName: row.family_name,
    description: row.description,
  }));

  const targets = new Map<string, { frameworkId: string; frameworkName: string; controlIds: string[] }>();
  for (const scfControl of scfControls) {
    const expanded = await expandScfControl(env, scfControl.controlId);
    for (const target of expanded) {
      const existing = targets.get(target.frameworkId) ?? {
        frameworkId: target.frameworkId,
        frameworkName: target.frameworkName,
        controlIds: [],
      };
      existing.controlIds.push(...target.controlIds);
      existing.controlIds = [...new Set(existing.controlIds)].sort((left, right) => left.localeCompare(right));
      targets.set(target.frameworkId, existing);
    }
  }

  return {
    framework: frameworkToken,
    controlId,
    scfControls,
    targets: [...targets.values()].sort((left, right) => left.frameworkName.localeCompare(right.frameworkName)),
  };
}

export async function expandScfControl(
  env: EnvBindings,
  scfControlId: string,
  targetFrameworkTokens?: string[],
) {
  const latestVersion = await getLatestScfVersion(env);
  if (!latestVersion) {
    return [];
  }

  let targetIds: string[] | null = null;
  if (targetFrameworkTokens?.length) {
    const frameworks = await Promise.all(targetFrameworkTokens.map((token) => matchFrameworkRow(env, token)));
    targetIds = frameworks
      .map((framework) => framework?.scf_framework_id)
      .filter((value): value is string => Boolean(value));
  }

  const rows = await env.D1_MAIN.prepare(
    `
    SELECT framework_id, framework_name, framework_control_id, scf_control_id
    FROM grc_scf_crosswalks
    WHERE version_id = ? AND scf_control_id = ?
    `,
  )
    .bind(latestVersion.id, scfControlId)
    .all<CrosswalkRow>();

  const grouped = new Map<string, { frameworkId: string; frameworkName: string; controlIds: string[] }>();
  for (const row of rows.results) {
    if (targetIds && !targetIds.includes(row.framework_id)) {
      continue;
    }
    const entry = grouped.get(row.framework_id) ?? {
      frameworkId: row.framework_id,
      frameworkName: row.framework_name,
      controlIds: [],
    };
    entry.controlIds.push(row.framework_control_id);
    grouped.set(row.framework_id, entry);
  }

  return [...grouped.values()]
    .map((entry) => ({
      ...entry,
      controlIds: [...new Set(entry.controlIds)].sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.frameworkName.localeCompare(right.frameworkName));
}

export async function resolveEvaluationToScfIds(
  env: EnvBindings,
  controlFramework: string,
  controlId: string,
): Promise<string[]> {
  const normalizedFramework = normalizeFrameworkToken(controlFramework);
  if (normalizedFramework === 'scf' || normalizedFramework === 'secure-controls-framework') {
    return [controlId];
  }

  const resolution = await resolveControlToScf(env, controlFramework, controlId);
  return resolution.scfControls.map((control) => control.controlId);
}

export async function getScfStatus(env: EnvBindings) {
  const latestVersion = await getLatestScfVersion(env);
  const counts = await env.D1_MAIN.prepare(
    `
    SELECT
      (SELECT COUNT(*) FROM grc_scf_controls${latestVersion ? ' WHERE version_id = ?' : ''}) AS control_count,
      (SELECT COUNT(DISTINCT framework_id) FROM grc_scf_crosswalks${latestVersion ? ' WHERE version_id = ?' : ''}) AS framework_count
    `,
  )
    .bind(...(latestVersion ? [latestVersion.id, latestVersion.id] : []))
    .first<{ control_count: number; framework_count: number }>();

  return {
    version: latestVersion?.scf_version ?? null,
    controlCount: Number(counts?.control_count ?? 0),
    frameworkCount: Number(counts?.framework_count ?? 0),
  };
}
