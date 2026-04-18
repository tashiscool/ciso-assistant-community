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

const publicChecks = [
  { name: 'shell dashboard', path: '/', expect: [200] },
  { name: 'analytics route', path: '/analytics', expect: [200] },
  { name: 'search route', path: '/search', expect: [200] },
  { name: 'settings route', path: '/settings', expect: [200] },
  { name: 'health', path: '/_api/core/health', expect: [200] },
];

const authedChecks = [
  { name: 'workspace profile', path: '/_api/iam/me', expect: [200] },
  { name: 'core overview', path: '/_api/core/overview', expect: [200] },
  { name: 'parity overview', path: '/_api/ops/parity/overview', expect: [200] },
];

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

console.log(`[start] Regovise production smoke + latency probe (${baseUrl}, iterations=${iterations})`);

const results = [];
for (const check of publicChecks) {
  const result = await probe(check);
  results.push(result);
  console.log(
    `[ok] ${result.name.padEnd(20)} p50=${result.p50.toFixed(1)}ms p95=${result.p95.toFixed(1)}ms avg=${result.avg.toFixed(1)}ms max=${result.max.toFixed(1)}ms`,
  );
}

const authHeaders = {
  'x-tenant-id': tenantId,
  'x-user-id': userId,
};

for (const check of authedChecks) {
  const result = await probe(check, authHeaders);
  results.push(result);
  console.log(
    `[ok] ${result.name.padEnd(20)} p50=${result.p50.toFixed(1)}ms p95=${result.p95.toFixed(1)}ms avg=${result.avg.toFixed(1)}ms max=${result.max.toFixed(1)}ms`,
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
