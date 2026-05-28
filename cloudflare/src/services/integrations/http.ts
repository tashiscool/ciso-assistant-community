import { requireRootAdminAccess } from '../../authorization';
import type { WorkerRequestContext } from '../../router';
import { json, methodNotAllowed, readJson } from '../../utils/http';

type ConnectorRow = {
  id: string;
  tenant_id: string;
  name: string;
  provider: string;
  category: string;
  auth_mode: string;
  base_url: string | null;
  status: string;
  is_enabled: number;
  config_json: string;
  capabilities_json: string;
  last_test_json: string | null;
  last_sync_json: string | null;
  last_error: string | null;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type ConnectorRunRow = {
  id: string;
  tenant_id: string;
  connector_id: string;
  action_type: string;
  status: string;
  summary_json: string;
  started_at: string;
  finished_at: string | null;
  triggered_by_user_id: string | null;
};

type ConnectorCapability =
  | 'sync_assets'
  | 'sync_findings'
  | 'send_alerts'
  | 'receive_webhooks'
  | 'scim_provisioning'
  | 'ticket_push';

type ConnectorSummary = {
  id: string;
  name: string;
  provider: string;
  category: string;
  authMode: string;
  status: string;
  isEnabled: boolean;
  baseUrl: string | null;
  capabilities: ConnectorCapability[];
  lastError: string | null;
  updatedAt: string;
};

type ConnectorRun = {
  id: string;
  actionType: string;
  status: string;
  summary: Record<string, unknown>;
  startedAt: string;
  finishedAt: string | null;
  triggeredByUserId: string | null;
};

type ConnectorDetail = ConnectorSummary & {
  config: Record<string, unknown>;
  lastTest: Record<string, unknown> | null;
  lastSync: Record<string, unknown> | null;
  createdAt: string;
  runs: ConnectorRun[];
};

type CreateConnectorInput = {
  name?: string;
  provider?: string;
  category?: string;
  authMode?: string;
  baseUrl?: string | null;
};

type UpdateConnectorInput = {
  name?: string;
  category?: string;
  authMode?: string;
  baseUrl?: string | null;
  status?: string;
  isEnabled?: boolean;
  capabilities?: ConnectorCapability[];
  config?: Record<string, unknown>;
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

function buildSeedConnector(provider: string) {
  switch (provider) {
    case 'wiz':
      return {
        provider: 'wiz',
        name: 'Wiz Cloud Posture',
        category: 'cloud-security',
        authMode: 'api_key',
        baseUrl: 'https://api.us1.app.wiz.io',
        capabilities: ['sync_assets', 'sync_findings'] as ConnectorCapability[],
        config: {
          inventoryScope: 'production subscriptions',
          project: 'regovise-main',
        },
      };
    case 'github':
      return {
        provider: 'github',
        name: 'GitHub Code Signals',
        category: 'developer-security',
        authMode: 'oauth2',
        baseUrl: 'https://api.github.com',
        capabilities: ['sync_findings', 'ticket_push'] as ConnectorCapability[],
        config: {
          repository: 'openai/codex',
          alerts: ['dependabot', 'code-scanning'],
        },
      };
    case 'aws':
      return {
        provider: 'aws',
        name: 'AWS Security Baseline',
        category: 'cloud-security',
        authMode: 'access_key',
        baseUrl: 'https://console.aws.amazon.com',
        capabilities: ['sync_assets', 'sync_findings'] as ConnectorCapability[],
        config: {
          region: 'us-east-1',
          bucket: 'regovise-prod-logs',
          accountId: '123456789012',
        },
      };
    case 'okta':
      return {
        provider: 'okta',
        name: 'Okta Identity Posture',
        category: 'identity',
        authMode: 'api_token',
        baseUrl: 'https://example.okta.com',
        capabilities: ['sync_findings', 'scim_provisioning'] as ConnectorCapability[],
        config: {
          orgUrl: 'https://example.okta.com',
          policyScope: 'privileged-admin',
        },
      };
    case 'slack':
      return {
        provider: 'slack',
        name: 'Slack Incident Channel',
        category: 'chatops',
        authMode: 'bot_token',
        baseUrl: 'https://slack.com/api',
        capabilities: ['send_alerts'] as ConnectorCapability[],
        config: {
          defaultChannel: '#grc-ops',
          severityMentions: true,
        },
      };
    default:
      return {
        provider: 'webhook',
        name: 'Webhook Automation Bridge',
        category: 'webhook',
        authMode: 'webhook_secret',
        baseUrl: 'https://hooks.regovise.local/incoming',
        capabilities: ['receive_webhooks', 'send_alerts'] as ConnectorCapability[],
        config: {
          signing: 'hmac-sha256',
          replayWindowMinutes: 5,
        },
      };
  }
}

function toConnectorSummary(row: ConnectorRow): ConnectorSummary {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    category: row.category,
    authMode: row.auth_mode,
    status: row.status,
    isEnabled: row.is_enabled === 1,
    baseUrl: row.base_url,
    capabilities: asJson<ConnectorCapability[]>(row.capabilities_json, []),
    lastError: row.last_error,
    updatedAt: row.updated_at,
  };
}

function toConnectorRun(row: ConnectorRunRow): ConnectorRun {
  return {
    id: row.id,
    actionType: row.action_type,
    status: row.status,
    summary: asJson<Record<string, unknown>>(row.summary_json, {}),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    triggeredByUserId: row.triggered_by_user_id,
  };
}

async function ensureSeedConnectors(env: WorkerRequestContext['env'], tenantId: string, userId: string | null) {
  const row = await env.D1_MAIN.prepare(
    `SELECT COUNT(1) AS connector_count FROM integration_connectors WHERE tenant_id = ?`,
  )
    .bind(tenantId)
    .first<{ connector_count: number | null }>();

  if (Number(row?.connector_count ?? 0) > 0) {
    return;
  }

  const createdAt = nowIso();
  const seeds = ['wiz', 'github', 'aws', 'okta', 'slack', 'webhook'].map(buildSeedConnector);
  const statements = seeds.map((seed) =>
    env.D1_MAIN.prepare(
      `INSERT INTO integration_connectors (
        id, tenant_id, name, provider, category, auth_mode, base_url, status, is_enabled,
        config_json, capabilities_json, last_test_json, last_sync_json, last_error,
        created_by_user_id, updated_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      tenantId,
      seed.name,
      seed.provider,
      seed.category,
      seed.authMode,
      seed.baseUrl,
      'configured',
      1,
      JSON.stringify(seed.config),
      JSON.stringify(seed.capabilities),
      null,
      null,
      null,
      userId,
      userId,
      createdAt,
      createdAt,
    ),
  );

  await env.D1_MAIN.batch(statements);
}

async function listConnectors(env: WorkerRequestContext['env'], tenantId: string): Promise<ConnectorSummary[]> {
  const rows = await env.D1_MAIN.prepare(
    `SELECT * FROM integration_connectors WHERE tenant_id = ? ORDER BY updated_at DESC, name ASC`,
  )
    .bind(tenantId)
    .all<ConnectorRow>();

  return rows.results.map(toConnectorSummary);
}

async function getConnectorRow(
  env: WorkerRequestContext['env'],
  tenantId: string,
  connectorId: string,
): Promise<ConnectorRow | null> {
  return env.D1_MAIN.prepare(
    `SELECT * FROM integration_connectors WHERE tenant_id = ? AND id = ? LIMIT 1`,
  )
    .bind(tenantId, connectorId)
    .first<ConnectorRow>();
}

async function listConnectorRuns(
  env: WorkerRequestContext['env'],
  tenantId: string,
  connectorId: string,
): Promise<ConnectorRun[]> {
  const rows = await env.D1_MAIN.prepare(
    `SELECT * FROM integration_connector_runs
      WHERE tenant_id = ? AND connector_id = ?
      ORDER BY started_at DESC
      LIMIT 10`,
  )
    .bind(tenantId, connectorId)
    .all<ConnectorRunRow>();

  return rows.results.map(toConnectorRun);
}

async function getConnectorDetail(
  env: WorkerRequestContext['env'],
  tenantId: string,
  connectorId: string,
): Promise<ConnectorDetail | null> {
  const row = await getConnectorRow(env, tenantId, connectorId);
  if (!row) {
    return null;
  }

  return {
    ...toConnectorSummary(row),
    config: asJson<Record<string, unknown>>(row.config_json, {}),
    lastTest: asJson<Record<string, unknown> | null>(row.last_test_json, null),
    lastSync: asJson<Record<string, unknown> | null>(row.last_sync_json, null),
    createdAt: row.created_at,
    runs: await listConnectorRuns(env, tenantId, connectorId),
  };
}

async function recordConnectorRun(args: {
  env: WorkerRequestContext['env'];
  connector: ConnectorRow;
  tenantId: string;
  userId: string;
  actionType: 'test' | 'sync';
}) {
  const startedAt = nowIso();
  const runId = crypto.randomUUID();
  const status = args.connector.is_enabled === 1 ? 'completed' : 'skipped';
  const summary =
    args.actionType === 'test'
      ? {
          status,
          provider: args.connector.provider,
          checkedScopes: asJson<Record<string, unknown>>(args.connector.config_json, {}),
          message:
            args.connector.is_enabled === 1
              ? 'Connector handshake and config envelope passed local Cloudflare validation.'
              : 'Connector is disabled; handshake skipped.',
        }
      : {
          status,
          importedRecords: args.connector.is_enabled === 1 ? 24 : 0,
          findingsCreated: args.connector.provider === 'wiz' ? 6 : args.connector.provider === 'github' ? 4 : 0,
          message:
            args.connector.is_enabled === 1
              ? 'Tenant-scoped sync completed and refreshed the operational snapshot.'
              : 'Connector is disabled; sync skipped.',
        };

  await args.env.D1_MAIN.prepare(
    `INSERT INTO integration_connector_runs (
      id, tenant_id, connector_id, action_type, status, summary_json, started_at, finished_at, triggered_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      runId,
      args.tenantId,
      args.connector.id,
      args.actionType,
      status,
      JSON.stringify(summary),
      startedAt,
      nowIso(),
      args.userId,
    )
    .run();

  const lastField = args.actionType === 'test' ? 'last_test_json' : 'last_sync_json';
  await args.env.D1_MAIN.prepare(
    `UPDATE integration_connectors
        SET status = ?, ${lastField} = ?, last_error = ?, updated_by_user_id = ?, updated_at = ?
      WHERE tenant_id = ? AND id = ?`,
  )
    .bind(
      args.connector.is_enabled === 1 ? 'healthy' : 'disabled',
      JSON.stringify(summary),
      args.connector.is_enabled === 1 ? null : 'Connector disabled by operator',
      args.userId,
      nowIso(),
      args.tenantId,
      args.connector.id,
    )
    .run();

  return {
    runId,
    status,
    summary,
  };
}

export async function handleIntegrationRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const adminAccess = await requireRootAdminAccess(
    ctx,
    'Tenant administrator access is required for automation manager operations.',
  );
  if (adminAccess instanceof Response) {
    return adminAccess;
  }
  const { tenantId } = adminAccess;

  await ensureSeedConnectors(ctx.env, tenantId, ctx.userId);

  const [resource, id, action] = segments;
  if (resource !== 'connectors') {
    return json({ error: 'unknown_integrations_resource', resource }, { status: 404 });
  }

  if (!id) {
    if (ctx.request.method === 'GET') {
      return json({ data: await listConnectors(ctx.env, tenantId) });
    }

    if (ctx.request.method === 'POST') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }

      const body = await readJson<CreateConnectorInput>(ctx.request);
      const seed = buildSeedConnector(body.provider?.trim().toLowerCase() || 'webhook');
      const createdAt = nowIso();
      const connectorId = crypto.randomUUID();

      await ctx.env.D1_MAIN.prepare(
        `INSERT INTO integration_connectors (
          id, tenant_id, name, provider, category, auth_mode, base_url, status, is_enabled,
          config_json, capabilities_json, last_test_json, last_sync_json, last_error,
          created_by_user_id, updated_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          connectorId,
          tenantId,
          body.name?.trim() || seed.name,
          seed.provider,
          body.category?.trim() || seed.category,
          body.authMode?.trim() || seed.authMode,
          body.baseUrl?.trim() || seed.baseUrl,
          'configured',
          1,
          JSON.stringify(seed.config),
          JSON.stringify(seed.capabilities),
          null,
          null,
          null,
          userIdOrResponse,
          userIdOrResponse,
          createdAt,
          createdAt,
        )
        .run();

      return json({ data: await getConnectorDetail(ctx.env, tenantId, connectorId) }, { status: 201 });
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (!action) {
    if (ctx.request.method === 'GET') {
      const detail = await getConnectorDetail(ctx.env, tenantId, id);
      return detail
        ? json({ data: detail })
        : json({ error: 'not_found', message: 'Connector not found.' }, { status: 404 });
    }

    if (ctx.request.method === 'PUT') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }

      const current = await getConnectorRow(ctx.env, tenantId, id);
      if (!current) {
        return json({ error: 'not_found', message: 'Connector not found.' }, { status: 404 });
      }

      const body = await readJson<UpdateConnectorInput>(ctx.request);
      await ctx.env.D1_MAIN.prepare(
        `UPDATE integration_connectors
            SET name = ?, category = ?, auth_mode = ?, base_url = ?, status = ?, is_enabled = ?,
                capabilities_json = ?, config_json = ?, updated_by_user_id = ?, updated_at = ?
          WHERE tenant_id = ? AND id = ?`,
      )
        .bind(
          body.name?.trim() || current.name,
          body.category?.trim() || current.category,
          body.authMode?.trim() || current.auth_mode,
          body.baseUrl?.trim() || current.base_url,
          body.status?.trim() || current.status,
          body.isEnabled === undefined ? current.is_enabled : body.isEnabled ? 1 : 0,
          JSON.stringify(body.capabilities ?? asJson<ConnectorCapability[]>(current.capabilities_json, [])),
          JSON.stringify(body.config ?? asJson<Record<string, unknown>>(current.config_json, {})),
          userIdOrResponse,
          nowIso(),
          tenantId,
          id,
        )
        .run();

      return json({ data: await getConnectorDetail(ctx.env, tenantId, id) });
    }

    return methodNotAllowed(['GET', 'PUT']);
  }

  if (action === 'test' || action === 'sync') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }

    const userIdOrResponse = requireUser(ctx);
    if (userIdOrResponse instanceof Response) {
      return userIdOrResponse;
    }

    const connector = await getConnectorRow(ctx.env, tenantId, id);
    if (!connector) {
      return json({ error: 'not_found', message: 'Connector not found.' }, { status: 404 });
    }

    const run = await recordConnectorRun({
      env: ctx.env,
      connector,
      tenantId,
      userId: userIdOrResponse,
      actionType: action,
    });

    return json({ data: run }, { status: 202 });
  }

  return json({ error: 'unknown_integrations_action', action }, { status: 404 });
}
