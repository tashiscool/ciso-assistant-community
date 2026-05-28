import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.CLOUDFLARE_LOCAL_URL ?? 'http://127.0.0.1:8787';
const headers = {
  'content-type': 'application/json',
  'x-tenant-id': 'tenant-demo',
  'x-user-id': 'user-demo',
};

const cloudflareRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const bannedFrameworkTerms = [/\/plugin\b/i, /\/grc-engineer:/i, /claude-grc/i, /\bmarketplace\b/i];

async function request(pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${pathname} failed (${response.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function waitForJob(jobId, timeoutMs = 120000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const job = await request(`/_api/grc/jobs/${jobId}`, { headers });
    if (job?.data?.status === 'completed' || job?.data?.status === 'failed') {
      return job.data;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for job ${jobId}.`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readFixture(name) {
  const filePath = path.join(cloudflareRoot, 'testdata', 'grc', 'findings', name);
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function importCuratedSnapshot() {
  const queued = await request('/_api/grc/admin/import-snapshot', {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  assert(queued?.data?.jobId, 'Expected snapshot import to return a job id.');
  return waitForJob(queued.data.jobId);
}

async function main() {
  console.log(`Running GRC engine smoke against ${baseUrl}`);

  const health = await request('/_api/core/health');
  assert(health?.data?.ok === true, 'Worker health check failed.');

  const bootstrap = await request('/_api/core/bootstrap-demo', { method: 'POST' });
  assert(bootstrap?.data?.tenantId === 'tenant-demo', 'Expected demo tenant bootstrap.');

  const importResult = await importCuratedSnapshot();
  assert(importResult?.result?.imported?.summary?.frameworkCount > 10, 'Expected curated frameworks to import.');

  const overview = await request('/_api/grc', { headers });
  assert(Array.isArray(overview?.data?.frameworks) && overview.data.frameworks.length > 10, 'Expected GRC overview frameworks.');

  const frameworks = await request('/_api/grc/frameworks', { headers });
  assert(frameworks?.data?.some((item) => item.slug === 'soc2'), 'Expected soc2 in imported framework library.');
  assert(frameworks?.data?.some((item) => item.slug === 'fedramp-rev5'), 'Expected fedramp-rev5 in imported framework library.');
  const soc2Detail = await request('/_api/grc/frameworks/soc2', { headers });
  const overviewDocument = soc2Detail?.data?.documents?.find((item) => item.slug === 'overview') ?? soc2Detail?.data?.documents?.[0];
  assert(overviewDocument?.slug, 'Expected a framework overview document for SOC 2.');
  const frameworkDocument = await request(`/_api/grc/frameworks/soc2/content/${encodeURIComponent(overviewDocument.slug)}`, { headers });
  assert(
    !bannedFrameworkTerms.some((pattern) => pattern.test(frameworkDocument?.data?.bodyMarkdown ?? '')),
    'Expected sanitized framework content without upstream plugin language.',
  );

  const refreshTargets = frameworks.data
    .filter((item) => item.slug === 'soc2' || item.slug === 'fedramp-rev5')
    .map((item) => item.id);
  const refreshResult = await request('/_api/grc/admin/scf/refresh', {
    method: 'POST',
    headers,
    body: JSON.stringify({ frameworkIds: refreshTargets }),
  });
  const refreshedJob = await waitForJob(refreshResult.data.jobId);
  assert(
    Array.isArray(refreshedJob?.result?.refreshedFrameworks) && refreshedJob.result.refreshedFrameworks.length >= 2,
    'Expected SCF refresh to process two frameworks.',
  );

  const githubFinding = await readFixture('github-branch-protection.json');
  const wizFinding = await readFixture('wiz-public-storage.json');

  const ingest = await request('/_api/grc/findings/ingest', {
    method: 'POST',
    headers,
    body: JSON.stringify({ findings: [githubFinding, wizFinding] }),
  });
  const ingestedJob = await waitForJob(ingest.data.jobId);
  assert(ingestedJob?.result?.insertedFindings >= 2, 'Expected at least two inserted findings.');

  const findings = await request('/_api/grc/findings?severity=critical,high,medium', { headers });
  assert(Array.isArray(findings?.data) && findings.data.length >= 2, 'Expected normalized findings list.');

  const connectorStatus = await request('/_api/grc/connectors', { headers });
  assert(Array.isArray(connectorStatus?.data) && connectorStatus.data.some((item) => item.source === 'github'), 'Expected collector status payload.');

  const githubCollect = await request('/_api/grc/connectors/github/collect', {
    method: 'POST',
    headers,
  });
  const githubJob = await waitForJob(githubCollect.data.jobId);
  assert(githubJob?.result?.source === 'github', 'Expected GitHub native collection run.');

  const githubRuns = await request('/_api/grc/connectors/github/runs', { headers });
  assert(Array.isArray(githubRuns?.data) && githubRuns.data.length >= 1, 'Expected GitHub collector run history.');

  const controlMap = await request('/_api/grc/controls/map?framework=soc2&controlId=CC6.1', { headers });
  assert(Array.isArray(controlMap?.data?.scfControls) && controlMap.data.scfControls.length >= 1, 'Expected SCF control mappings.');

  const assessment = await request('/_api/grc/assessments', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'SOC 2 + FedRAMP readiness smoke',
      frameworks: ['soc2', 'fedramp-rev5'],
      sources: ['github', 'wiz'],
      severities: ['critical', 'high', 'medium'],
      statuses: ['fail', 'inconclusive'],
    }),
  });
  assert(assessment?.data?.gapCount >= 1, 'Expected at least one assessment gap row.');

  const evidencePackage = await request('/_api/grc/evidence-packages', {
    method: 'POST',
    headers,
    body: JSON.stringify({ assessmentId: assessment.data.id }),
  });
  const evidencePackageJob = await waitForJob(evidencePackage.data.jobId);
  assert(evidencePackageJob?.result?.evidencePackageId, 'Expected evidence package id.');

  const bundle = await request(`/_api/grc/assessments/${assessment.data.id}/report`, {
    method: 'POST',
    headers,
  });
  const bundleJob = await waitForJob(bundle.data.jobId);
  assert(bundleJob?.result?.reportBundleId, 'Expected report bundle id.');

  const execSummary = await request('/_api/grc/reports/exec-summary', {
    method: 'POST',
    headers,
    body: JSON.stringify({ assessmentId: assessment.data.id, audience: 'ciso' }),
  });
  const execSummaryJob = await waitForJob(execSummary.data.jobId);
  assert(execSummaryJob?.result?.reportKind === 'exec-summary', 'Expected executive summary snapshot.');

  const status = await request('/_api/grc/status', { headers });
  assert(status?.data?.evidencePackages >= 1, 'Expected status payload to include evidence package count.');

  const bundleDetail = await request(`/_api/grc/report-bundles/${bundleJob.result.reportBundleId}`, { headers });
  assert(bundleDetail?.data?.manifest, 'Expected bundle manifest.');

  console.log(
    JSON.stringify(
      {
        frameworkCount: frameworks.data.length,
        findingCount: findings.data.length,
        gapCount: assessment.data.gapCount,
        evidencePackageId: evidencePackageJob.result.evidencePackageId,
        reportBundleId: bundleJob.result.reportBundleId,
        execSummaryId: execSummaryJob.result.reportId,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
