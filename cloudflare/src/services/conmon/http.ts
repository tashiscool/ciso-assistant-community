import type { WorkerRequestContext } from '../../router';
import type { ConMonJobMessage } from '../../types/env';
import { requireAnyPermission } from '../../authorization';
import { json, methodNotAllowed, readJson } from '../../utils/http';

type ConMonProfileRow = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  profile_type: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type ConMonExecutionRow = {
  id: string;
  tenant_id: string;
  profile_id: string;
  profile_name: string;
  activity_id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  status_detail: string | null;
  metrics_json: string | null;
};

type CreateConMonProfileInput = {
  name?: string;
  description?: string;
  profileType?: string;
  cadence?: string;
  theme?: string;
};

export async function handleConMonRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const [resource, id, action] = segments;

  if (resource === 'profiles' && ctx.request.method === 'GET') {
    const access = await requireAnyPermission(
      ctx,
      ['view_conmon', 'run_conmon'],
      'Continuous monitoring access requires ConMon view permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const stmt = ctx.env.D1_MAIN.prepare(
      `
      SELECT id, tenant_id, name, description, profile_type, status, created_at, updated_at
      FROM conmon_profiles
      WHERE tenant_id = ?
      ORDER BY name ASC
      `,
    ).bind(access.tenantId);

    const { results } = await stmt.all<ConMonProfileRow>();

    return json({
      data: results.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        name: row.name,
        description: row.description,
        profileType: row.profile_type,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  }

  if (resource === 'profiles' && id && action === 'run') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }

    const access = await requireAnyPermission(
      ctx,
      ['run_conmon'],
      'Running continuous monitoring requires ConMon execution permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const activity = await ctx.env.D1_MAIN.prepare(
      `
      SELECT id
      FROM conmon_activity_configs
      WHERE tenant_id = ? AND profile_id = ?
      ORDER BY created_at ASC
      LIMIT 1
      `,
    )
      .bind(access.tenantId, id)
      .first<{ id: string }>();

    if (!activity) {
      return json(
        {
          error: 'missing_activity',
          message: 'The selected profile has no activity configuration to run.',
        },
        { status: 400 },
      );
    }

    const executionId = crypto.randomUUID();
    const payload: ConMonJobMessage = {
      type: 'conmon.execution.run',
      tenantId: access.tenantId,
      profileId: id,
      activityId: activity.id,
      executionId,
      requestedBy: access.userId,
    };

    await ctx.env.D1_MAIN.prepare(
      `
      INSERT INTO conmon_executions (
        id,
        tenant_id,
        profile_id,
        activity_id,
        started_at,
        status,
        status_detail,
        metrics_json,
        raw_stats_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        executionId,
        access.tenantId,
        id,
        activity.id,
        new Date().toISOString(),
        'pending',
        'Queued from the Cloudflare Worker API',
        null,
        null,
      )
      .run();

    await ctx.env.QUEUE_CONMON_JOBS.send(payload);

    return json(
      {
        data: {
          executionId,
          profileId: id,
          activityId: activity.id,
          status: 'pending',
        },
      },
      { status: 202 },
    );
  }

  if (resource === 'profiles' && id && ctx.request.method === 'PUT') {
    const access = await requireAnyPermission(
      ctx,
      ['run_conmon'],
      'Updating continuous monitoring profiles requires ConMon execution permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const body = await readJson<CreateConMonProfileInput>(ctx.request);
    const name = body.name?.trim();

    if (!name) {
      return json({ error: 'invalid_name', message: 'Profile name is required.' }, { status: 400 });
    }

    await ctx.env.D1_MAIN.prepare(
      `
      UPDATE conmon_profiles
      SET name = ?,
          description = ?,
          profile_type = ?,
          updated_at = ?
      WHERE id = ? AND tenant_id = ?
      `,
    )
      .bind(
        name,
        body.description?.trim() || null,
        body.profileType?.trim() || 'fedramp_conmon',
        new Date().toISOString(),
        id,
        access.tenantId,
      )
      .run();

    const updated = await ctx.env.D1_MAIN.prepare(
      `
      SELECT id, tenant_id, name, description, profile_type, status, created_at, updated_at
      FROM conmon_profiles
      WHERE id = ? AND tenant_id = ?
      `,
    )
      .bind(id, access.tenantId)
      .first<ConMonProfileRow>();

    return updated
      ? json({
          data: {
            id: updated.id,
            tenantId: updated.tenant_id,
            name: updated.name,
            description: updated.description,
            profileType: updated.profile_type,
            status: updated.status,
            createdAt: updated.created_at,
            updatedAt: updated.updated_at,
          },
        })
      : json({ error: 'not_found' }, { status: 404 });
  }

  if (resource === 'profiles' && id && ctx.request.method === 'DELETE') {
    const access = await requireAnyPermission(
      ctx,
      ['run_conmon'],
      'Deleting continuous monitoring profiles requires ConMon execution permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const result = await ctx.env.D1_MAIN.prepare(
      `DELETE FROM conmon_profiles WHERE id = ? AND tenant_id = ?`,
    )
      .bind(id, access.tenantId)
      .run();

    if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
    return json({ data: { deleted: true, id } });
  }

  if (resource === 'profiles' && id) {
    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'profiles' && ctx.request.method === 'POST') {
    const access = await requireAnyPermission(
      ctx,
      ['run_conmon'],
      'Creating continuous monitoring profiles requires ConMon execution permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const body = await readJson<CreateConMonProfileInput>(ctx.request);
    const name = body.name?.trim();

    if (!name) {
      return json({ error: 'invalid_name', message: 'Profile name is required.' }, { status: 400 });
    }

    const profileId = crypto.randomUUID();
    const activityId = crypto.randomUUID();
    const description = body.description?.trim() || null;
    const profileType = body.profileType?.trim() || 'fedramp_conmon';
    const cadence = body.cadence?.trim() || 'monthly';
    const theme = body.theme?.trim() || 'reporting';

    await ctx.env.D1_MAIN.prepare(
      `
      INSERT INTO conmon_profiles (id, tenant_id, name, description, profile_type, status)
      VALUES (?, ?, ?, ?, ?, 'active')
      `,
    )
      .bind(profileId, access.tenantId, name, description, profileType)
      .run();

    await ctx.env.D1_MAIN.prepare(
      `
      INSERT INTO conmon_activity_configs (
        id,
        tenant_id,
        profile_id,
        name,
        description,
        cadence,
        theme,
        control_ref,
        config_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        activityId,
        access.tenantId,
        profileId,
        `${name} default activity`,
        'Created from the React migration shell.',
        cadence,
        theme,
        'CA-7',
        JSON.stringify({ executionMode: 'queue', generatedBy: 'react-shell' }),
      )
      .run();

    return json(
      {
        data: {
          id: profileId,
          activityId,
          name,
          description,
          profileType,
          cadence,
          theme,
        },
      },
      { status: 201 },
    );
  }

  if (resource === 'executions' && ctx.request.method === 'GET') {
    const access = await requireAnyPermission(
      ctx,
      ['view_conmon', 'run_conmon'],
      'Continuous monitoring execution access requires ConMon view permissions.',
    );
    if (access instanceof Response) {
      return access;
    }

    const stmt = ctx.env.D1_MAIN.prepare(
      `
      SELECT
        execution.id,
        execution.tenant_id,
        execution.profile_id,
        profile.name AS profile_name,
        execution.activity_id,
        execution.started_at,
        execution.finished_at,
        execution.status,
        execution.status_detail,
        execution.metrics_json
      FROM conmon_executions AS execution
      INNER JOIN conmon_profiles AS profile
        ON profile.id = execution.profile_id
      WHERE execution.tenant_id = ?
      ORDER BY execution.started_at DESC
      LIMIT 50
      `,
    ).bind(access.tenantId);

    const { results } = await stmt.all<ConMonExecutionRow>();

    return json({
      data: results.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        profileId: row.profile_id,
        profileName: row.profile_name,
        activityId: row.activity_id,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        status: row.status,
        statusDetail: row.status_detail,
        metrics: row.metrics_json ? JSON.parse(row.metrics_json) : null,
      })),
    });
  }

  if (resource === 'profiles') {
    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'executions') {
    return methodNotAllowed(['GET']);
  }

  return json({ error: 'not_found', path: segments.join('/') }, { status: 404 });
}
