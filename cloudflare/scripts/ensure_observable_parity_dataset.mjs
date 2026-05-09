const baseUrlRaw =
  process.env.REGOVISE_VERIFY_BASE_URL ??
  process.env.REGOVISE_PROD_BASE_URL ??
  process.env.CLOUDFLARE_LOCAL_URL ??
  process.argv[2] ??
  'http://127.0.0.1:8787';

const tenantId =
  process.env.REGOVISE_VERIFY_TENANT_ID ??
  process.env.PROD_SMOKE_TENANT_ID ??
  'tenant-demo';
const userId =
  process.env.REGOVISE_VERIFY_USER_ID ??
  process.env.PROD_SMOKE_USER_ID ??
  'user-demo';
const bootstrapSecret =
  process.env.REGOVISE_VERIFY_BOOTSTRAP_SECRET ??
  process.env.BOOTSTRAP_SETUP_SECRET ??
  '';
const bootstrapTenantSlug = process.env.REGOVISE_VERIFY_TENANT_SLUG ?? 'regovise';
const bootstrapEmail = process.env.REGOVISE_VERIFY_EMAIL ?? 'admin@regovise.com';
const baseUrl = baseUrlRaw.endsWith('/') ? baseUrlRaw.slice(0, -1) : baseUrlRaw;
let sessionCookie = '';

function authHeaders() {
  if (sessionCookie) {
    return { cookie: sessionCookie };
  }

  return {
    'x-tenant-id': tenantId,
    'x-user-id': userId,
  };
}

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: new Headers(init.headers ?? {}),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} failed (${response.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function waitForStableHealth() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const health = await request('/_api/core/health');
      if (health?.data?.ok === true) {
        return;
      }
    } catch {
      // Ignore and retry.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('Worker did not reach a stable healthy state in time.');
}

async function establishAdminSessionIfConfigured() {
  if (!bootstrapSecret) {
    return false;
  }

  const response = await fetch(`${baseUrl}/_api/core/bootstrap/admin-session`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      secret: bootstrapSecret,
      tenantSlug: bootstrapTenantSlug,
      email: bootstrapEmail,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `POST /_api/core/bootstrap/admin-session failed (${response.status}): ${text}`,
    );
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('Bootstrap admin-session response did not include a session cookie.');
  }

  sessionCookie = setCookie.split(';', 1)[0] ?? '';
  if (!sessionCookie) {
    throw new Error('Bootstrap admin-session response returned an empty session cookie.');
  }

  return true;
}

async function poll(path, predicate, headers, attempts = 40, delayMs = 750) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const payload = await request(path, { headers });
    if (predicate(payload)) {
      return payload;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`Polling ${path} timed out after ${attempts} attempts.`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function ensureDomain(headers, uniqueSuffix) {
  const folders = await request('/_api/iam/folders', { headers });
  const existingDomain = folders?.data?.find((folder) => folder.contentType === 'domain');
  if (existingDomain?.id) {
    return existingDomain.id;
  }

  const created = await request('/_api/iam/folders', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Observable Assurance ${uniqueSuffix}`,
      description: 'Production parity domain created for assurance verification.',
      contentType: 'domain',
    }),
  });
  const domainId = created?.data?.id;
  assert(domainId, 'Domain creation did not return an id.');
  return domainId;
}

async function ensureEvidenceSource(headers) {
  const sources = await request('/_api/evidence/sources', { headers });
  const existing = sources?.data?.find((item) => item.name === 'Observable Live Adapter');
  if (existing?.id) {
    return existing.id;
  }

  const created = await request('/_api/evidence/sources', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Observable Live Adapter',
      provider: 'observable_live_adapter',
      config: {
        description: 'Provider-normalized live collection used for production assurance parity verification.',
      },
    }),
  });
  const sourceId = created?.data?.id;
  assert(sourceId, 'Evidence source creation did not return an id.');
  return sourceId;
}

function buildLiveCollection(uniqueSuffix) {
  return {
    declaredInventory: [
      {
        assetId: `asset-${uniqueSuffix}`,
        name: `Threat Hunt Asset ${uniqueSuffix}`,
        assetType: 'ec2',
        environment: 'production',
        owner: 'Security Engineering',
        region: 'us-east-1',
        accountId: 'prod-primary',
        inBoundary: true,
        scannerRequired: true,
        logRequired: true,
        isPublic: false,
      },
    ],
    assets: [
      {
        assetId: `asset-${uniqueSuffix}`,
        name: `Threat Hunt Asset ${uniqueSuffix}`,
        assetType: 'ec2',
        environment: 'production',
        owner: 'Security Engineering',
        region: 'us-east-1',
        accountId: 'prod-primary',
        inBoundary: true,
        isPublic: false,
        privateIps: ['10.20.30.40'],
        publicIps: [],
      },
    ],
    securityGroups: [
      {
        groupId: `sg-${uniqueSuffix}`,
        ipPermissions: [
          {
            ipProtocol: 'tcp',
            fromPort: 22,
            toPort: 22,
            ipRanges: [{ cidrIp: '0.0.0.0/0' }],
          },
        ],
      },
    ],
    cloudTrail: [
      {
        detail: {
          eventID: `event-${uniqueSuffix}`,
          eventName: 'AuthorizeSecurityGroupIngress',
          eventSource: 'ec2.amazonaws.com',
          requestParameters: {
            groupId: `sg-${uniqueSuffix}`,
            instanceId: `asset-${uniqueSuffix}`,
          },
          userIdentity: {
            userName: 'regovise-operator',
          },
        },
        title: 'Security group ingress rule opened publicly',
      },
    ],
    scannerFindings: [
      {
        findingId: `finding-${uniqueSuffix}`,
        assetId: `asset-${uniqueSuffix}`,
        severity: 'critical',
        status: 'open',
        title: 'Critical remote exposure requires exploitation review',
        linkedTicketIds: [`ticket-${uniqueSuffix}`],
        exploitationReview: {},
      },
    ],
    tickets: [
      {
        ticketId: `ticket-${uniqueSuffix}`,
        title: 'Threat hunt remediation ticket',
        status: 'open',
        linkedAssetIds: [`asset-${uniqueSuffix}`],
        linkedFindingIds: [`finding-${uniqueSuffix}`],
        hasSecurityImpactAnalysis: true,
        hasTestingEvidence: false,
        hasApproval: false,
        hasDeploymentEvidence: false,
        hasVerificationEvidence: false,
      },
    ],
    logSources: [
      {
        sourceId: `logs-${uniqueSuffix}`,
        assetId: `asset-${uniqueSuffix}`,
        sourceType: 'cloudtrail',
        localSource: 'cloudtrail',
        centralDestination: 'siem',
        status: 'stale',
        sampleLocalEventRef: `event-${uniqueSuffix}`,
        sampleCentralEventRef: null,
        lastSeen: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    alertRules: [
      {
        ruleId: `rule-${uniqueSuffix}`,
        name: 'Generic triage rule',
        enabled: true,
        semanticTypes: ['generic.event'],
        recipients: ['soc@example.com'],
      },
    ],
  };
}

async function main() {
  console.log(`Ensuring observable parity dataset against ${baseUrl}`);
  const uniqueSuffix = Date.now();

  await waitForStableHealth();
  const usingSession = await establishAdminSessionIfConfigured();
  const headers = {
    'content-type': 'application/json',
    ...authHeaders(),
  };
  console.log(
    usingSession
      ? `Established bootstrap admin session for ${bootstrapEmail} in ${bootstrapTenantSlug}.`
      : 'Using direct tenant/user headers to seed the observable parity dataset.',
  );

  try {
    const parityStatus = await request('/_api/assurance/parity/status', { headers });
    const overview = await request('/_api/assurance/overview', { headers });
    if (
      parityStatus?.data?.status === 'pass' &&
      Number(overview?.data?.summary?.pendingWritebackCount ?? 0) >= 1
    ) {
      console.log('Observable parity dataset already present and passing; skipping production seed.');
      return;
    }
  } catch {
    // Continue with seeding when parity status is missing or unauthenticated.
  }

  const domainId = await ensureDomain(headers, uniqueSuffix);
  const sourceId = await ensureEvidenceSource(headers);
  const connectors = await request('/_api/integrations/connectors', { headers });
  const capabilities = new Set(
    (connectors?.data ?? []).flatMap((connector) =>
      Array.isArray(connector.capabilities) ? connector.capabilities : [],
    ),
  );
  assert(
    capabilities.has('ticket_push') && capabilities.has('send_alerts'),
    'Observable parity dataset needs ticket_push and send_alerts connectors to create pending writeback approvals.',
  );

  const trackerImport = await request('/_api/assurance/tracker/import', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      folderId: domainId,
      name: `Observable tracker import ${uniqueSuffix}`,
      sourceType: 'json',
      rows: [
        {
          control_id: `CM-8-${uniqueSuffix}`,
          category: 'inventory',
          severity: 'high',
          owner: 'Platform',
          status: 'open',
          detail: 'Asset is missing from discovery output.',
        },
        {
          control_id: `SC-7-${uniqueSuffix}`,
          category: 'exposure',
          severity: 'critical',
          owner: 'Network',
          status: 'open',
          detail: 'Public IP is still reachable without closure evidence.',
        },
      ],
    }),
  });
  const trackerImportId = trackerImport?.data?.importJobId;
  assert(trackerImportId, 'Tracker import did not return an import job id.');

  const threatHuntCollect = await request(`/_api/evidence/sources/${sourceId}/collect`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      inputMode: 'live',
      bundleKind: 'threat-hunt',
      folderId: domainId,
      adapterHints: {
        liveCollection: buildLiveCollection(uniqueSuffix),
      },
    }),
  });
  const threatHuntJobId = threatHuntCollect?.data?.jobId;
  assert(threatHuntJobId, 'Threat-hunt evidence collect did not return a job id.');

  await poll(
    '/_api/evidence/jobs',
    (payload) => payload?.data?.some((item) => item.id === threatHuntJobId && item.status === 'success'),
    headers,
  );

  const threatHuntEval = await request('/_api/assurance/evals/run', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      evidenceJobId: threatHuntJobId,
    }),
  });
  assert(
    threatHuntEval?.data?.summary?.bundleKind === 'threat-hunt',
    'Threat-hunt evaluation did not preserve the threat-hunt bundle kind.',
  );

  const threatHuntPackage = await request('/_api/assurance/packages/build', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      evidenceJobId: threatHuntJobId,
      folderId: domainId,
    }),
  });
  const threatHuntPackageId = threatHuntPackage?.data?.package?.packageJobId;
  assert(threatHuntPackageId, 'Threat-hunt package build did not return a package job id.');

  const agentRun = await request('/_api/agent/runs', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      evidenceJobId: threatHuntJobId,
      folderId: domainId,
      requestedWritebacks: true,
    }),
  });
  const agentRunId = agentRun?.data?.trace?.runId;
  const refreshedPackageId = agentRun?.data?.trace?.summary?.packageJobId;
  assert(agentRunId, 'Threat-hunt agent run did not return a run id.');
  assert(refreshedPackageId, 'Threat-hunt agent run did not preserve the package job id.');

  console.log(
    `Observable parity dataset ensured: trackerImportId=${trackerImportId}, evidenceJobId=${threatHuntJobId}, packageId=${refreshedPackageId}, agentRunId=${agentRunId}`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
