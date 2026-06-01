import { performance } from 'node:perf_hooks';

const baseUrlRaw = process.env.REGOVISE_PROD_BASE_URL || process.argv[2];
if (!baseUrlRaw) {
  console.error('Missing REGOVISE_PROD_BASE_URL (or pass base URL as first arg).');
  process.exit(1);
}

const tenantId = process.env.PROD_SMOKE_TENANT_ID || 'tenant-demo';
const userId = process.env.PROD_SMOKE_USER_ID || 'user-demo';
const baseUrl = baseUrlRaw.endsWith('/') ? baseUrlRaw.slice(0, -1) : baseUrlRaw;
const iterations = Math.max(1, Number.parseInt(process.env.LATENCY_PROBE_ITERATIONS ?? '5', 10) || 5);
const p95BudgetMs = Math.max(1, Number.parseInt(process.env.LATENCY_P95_BUDGET_MS ?? '1000', 10) || 1000);
const enforceBudget = ['1', 'true', 'yes'].includes(String(process.env.LATENCY_ENFORCE_BUDGET ?? '0').toLowerCase());
const requireSession = ['1', 'true', 'yes'].includes(String(process.env.PROD_SMOKE_REQUIRE_SESSION ?? '0').toLowerCase());
const bootstrapSecret = process.env.BOOTSTRAP_SETUP_SECRET ?? process.env.REGOVISE_VERIFY_BOOTSTRAP_SECRET ?? '';
const bootstrapTenantSlug = process.env.REGOVISE_VERIFY_TENANT_SLUG ?? 'regovise';
const bootstrapEmail = process.env.REGOVISE_VERIFY_EMAIL ?? 'admin@regovise.com';
let sessionCookie = '';
const bannedFrameworkTerms = [/\/plugin\b/i, /\/grc-engineer:/i, /claude-grc/i, /\bmarketplace\b/i];

const publicChecks = [
  { name: 'shell dashboard', path: '/', expect: [200] },
  { name: 'analytics route', path: '/analytics', expect: [200] },
  { name: 'search route', path: '/search', expect: [200] },
  { name: 'settings route', path: '/settings', expect: [200] },
  { name: 'framework library route', path: '/framework-library', expect: [200] },
  { name: 'findings route', path: '/findings', expect: [200] },
  { name: 'gap assessments route', path: '/gap-assessments', expect: [200] },
  { name: 'report bundles route', path: '/report-bundles', expect: [200] },
  { name: 'grc admin route', path: '/grc-admin', expect: [200] },
  { name: 'health', path: '/_api/core/health', expect: [200] },
];

const authedChecks = [
  { name: 'workspace profile', path: '/_api/iam/me', expect: [200] },
  { name: 'semantic coverage', path: '/_api/core/semantic-coverage', expect: [200] },
  { name: 'grc overview', path: '/_api/grc', expect: [200] },
  { name: 'grc status', path: '/_api/grc/status', expect: [200] },
  { name: 'grc frameworks', path: '/_api/grc/frameworks', expect: [200] },
  { name: 'grc findings', path: '/_api/grc/findings', expect: [200] },
  { name: 'grc assessments', path: '/_api/grc/assessments', expect: [200] },
  { name: 'grc report bundles', path: '/_api/grc/report-bundles', expect: [200] },
  { name: 'grc admin settings', path: '/_api/grc/admin/settings', expect: [200] },
];

function authHeaders() {
  if (sessionCookie) {
    return {
      cookie: sessionCookie,
    };
  }

  return {
    'x-tenant-id': tenantId,
    'x-user-id': userId,
  };
}

async function establishAdminSessionIfConfigured() {
  if (!bootstrapSecret) {
    return false;
  }

  const response = await fetch(`${baseUrl}/_api/core/bootstrap/admin-session`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'User-Agent': 'regovise-prod-smoke/1.0',
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
      `Unable to establish bootstrap admin session (${response.status}): ${text.slice(0, 500)}`,
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

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

async function probe(check, headers = {}) {
  const timings = [];
  for (let i = 0; i < iterations; i += 1) {
    const startedAt = performance.now();
    const res = await fetch(`${baseUrl}${check.path}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'regovise-prod-smoke/1.0',
        ...headers,
      },
    });
    const duration = performance.now() - startedAt;
    timings.push(duration);
    if (!check.expect.includes(res.status)) {
      const body = await res.text();
      throw new Error(
        `Unexpected status for ${check.name} (${check.path}): ${res.status}. Body=${body.slice(0, 500)}`,
      );
    }
  }

  const sorted = [...timings].sort((a, b) => a - b);
  const sum = timings.reduce((acc, value) => acc + value, 0);
  return {
    ...check,
    avg: sum / timings.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1],
  };
}

async function fetchJson(pathname, headers = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: {
      'User-Agent': 'regovise-prod-smoke/1.0',
      ...headers,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Unexpected status for ${pathname}: ${response.status}. Body=${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : null;
}

console.log(`[start] Regovise production smoke + latency probe (${baseUrl}, iterations=${iterations})`);

const usingSession = await establishAdminSessionIfConfigured();
if (requireSession && !usingSession) {
  throw new Error('Production smoke is configured to require a real session cookie, but no bootstrap admin session was established.');
}
if (usingSession) {
  const profile = await fetch(`${baseUrl}/_api/iam/me`, {
    headers: {
      'User-Agent': 'regovise-prod-smoke/1.0',
      ...authHeaders(),
    },
  }).then(async (response) => {
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Authenticated profile check failed (${response.status}): ${text.slice(0, 500)}`);
    }
    return text ? JSON.parse(text) : null;
  });
  if (profile?.data?.isAuthenticated !== true) {
    throw new Error('Bootstrap admin session did not produce an authenticated IAM profile.');
  }
}

if (!usingSession && baseUrl.includes('regovise.com')) {
  throw new Error('Production smoke refused to fall back to header-mode identity for regovise.com. Configure BOOTSTRAP_SETUP_SECRET for CI.');
}

const results = [];
for (const check of publicChecks) {
  const result = await probe(check);
  results.push(result);
  console.log(
    `[ok] ${result.name.padEnd(20)} p50=${result.p50.toFixed(1)}ms p95=${result.p95.toFixed(1)}ms avg=${result.avg.toFixed(1)}ms max=${result.max.toFixed(1)}ms`,
  );
}

for (const check of authedChecks) {
  const result = await probe(check, authHeaders());
  results.push(result);
  console.log(
    `[ok] ${result.name.padEnd(20)} p50=${result.p50.toFixed(1)}ms p95=${result.p95.toFixed(1)}ms avg=${result.avg.toFixed(1)}ms max=${result.max.toFixed(1)}ms`,
  );
}

const grcStatus = await fetchJson('/_api/grc/status', authHeaders());
if (!grcStatus?.data?.latestSnapshot?.id) {
  throw new Error('Expected GRC latest snapshot to be populated in production.');
}
if (!grcStatus?.data?.scfVersion) {
  throw new Error('Expected an SCF version to be present in production.');
}

const frameworkLibrary = await fetchJson('/_api/grc/frameworks', authHeaders());
const firstFramework = Array.isArray(frameworkLibrary?.data) ? frameworkLibrary.data[0] : null;
if (!firstFramework?.id && !firstFramework?.slug) {
  throw new Error('Expected at least one framework in the production library.');
}
const frameworkToken = encodeURIComponent(firstFramework.slug || firstFramework.id);
const frameworkDetail = await fetchJson(`/_api/grc/frameworks/${frameworkToken}`, authHeaders());
const firstDocument = Array.isArray(frameworkDetail?.data?.documents) ? frameworkDetail.data.documents[0] : null;
if (!firstDocument?.slug) {
  throw new Error(`Expected at least one framework document for ${String(firstFramework.slug || firstFramework.id)}.`);
}
const frameworkDocument = await fetchJson(
  `/_api/grc/frameworks/${frameworkToken}/content/${encodeURIComponent(firstDocument.slug)}`,
  authHeaders(),
);
const bodyMarkdown = String(frameworkDocument?.data?.bodyMarkdown ?? '');
if (bannedFrameworkTerms.some((pattern) => pattern.test(bodyMarkdown))) {
  throw new Error('Sanitized framework content still contains banned upstream plugin language.');
}

const connectors = await fetchJson('/_api/grc/connectors', authHeaders());
if (Array.isArray(connectors?.data)) {
  for (const connector of connectors.data) {
    if (connector.collectionMode === 'live' && connector.authReady !== true) {
      throw new Error(`Collector ${connector.source} reported live mode without live auth readiness.`);
    }
  }
}

const semanticCoverage = await fetchJson('/_api/core/semantic-coverage', authHeaders());
if (semanticCoverage?.data?.ok !== true) {
  throw new Error(`Production semantic coverage is not healthy: ${JSON.stringify(semanticCoverage?.data?.unresolvedRequired ?? [])}`);
}
if (semanticCoverage.data.summary?.unresolvedRequired !== 0) {
  throw new Error(`Production semantic coverage has unresolved required mappings: ${semanticCoverage.data.summary.unresolvedRequired}`);
}
if (semanticCoverage.data.summary?.scaleModules !== 26) {
  throw new Error(`Expected 26 scale.md modules, found ${semanticCoverage.data.summary?.scaleModules ?? 'unknown'}.`);
}
if (semanticCoverage.data.summary?.regscaleBuilderDomains !== 7) {
  throw new Error(
    `Expected 7 RegScale builder domains, found ${semanticCoverage.data.summary?.regscaleBuilderDomains ?? 'unknown'}.`,
  );
}
const semanticAlignment = semanticCoverage.data.alignment;
if (!semanticAlignment) {
  throw new Error('Production semantic coverage did not include frontend/backend alignment evidence.');
}
for (const key of ['frontendRoutesCovered', 'frontendApiCallsCovered', 'backendHandlersCovered', 'permissionGatesCovered']) {
  if (semanticAlignment[key] !== true) {
    throw new Error(`Production semantic alignment check failed for ${key}.`);
  }
}
if (Array.isArray(semanticAlignment.unresolvedAlignmentGaps) && semanticAlignment.unresolvedAlignmentGaps.length > 0) {
  throw new Error(
    `Production semantic alignment has unresolved gaps: ${JSON.stringify(semanticAlignment.unresolvedAlignmentGaps)}`,
  );
}

const violations = results.filter((item) => item.p95 > p95BudgetMs);
if (violations.length > 0) {
  console.error(
    `[warn] ${violations.length} endpoint(s) exceeded LATENCY_P95_BUDGET_MS=${p95BudgetMs}: ${violations
      .map((item) => `${item.name}(${item.p95.toFixed(1)}ms)`)
      .join(', ')}`,
  );
  if (enforceBudget) {
    process.exit(1);
  }
}

console.log('[ok] Regovise production smoke + latency probe complete');
