import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.CLOUDFLARE_LOCAL_URL ?? 'http://127.0.0.1:8787';
const syntheticScf = process.argv.includes('--scf-fixtures');
const fixtureProviders = process.argv.includes('--fixture-providers') || syntheticScf;
if (fixtureProviders) {
  const target = new URL(baseUrl);
  if (!['http:', 'https:'].includes(target.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || target.username || target.password) {
    throw new Error('Provider fixture smoke requires a loopback target without credentials.');
  }
}
const headers = {
  'content-type': 'application/json',
  'x-tenant-id': 'tenant-demo',
  'x-user-id': 'user-demo',
};

const cloudflareRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const bannedFrameworkTerms = [/\/plugin\b/i, /\/grc-engineer:/i, /claude-grc/i, /\bmarketplace\b/i];

async function request(pathname, init = {}, expectedStatus = null) {
  const response = await fetch(`${baseUrl}${pathname}`, { ...init, signal: AbortSignal.timeout(30000), redirect: 'manual' });
  const text = await response.text();
  if (expectedStatus !== null ? response.status !== expectedStatus : !response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${pathname} failed (${response.status}): ${text}`);
  }
  if (fixtureProviders && pathname === '/_api/core/health') {
    const expectedMode = syntheticScf ? 'synthetic-scf-outbound-blocked-no-credentials' : 'outbound-blocked-no-credentials';
    assert(response.headers.get('x-regovise-verification-run') && response.headers.get('x-regovise-provider-mode') === expectedMode, 'Fixture smoke requires the matching isolated Worker verification wrapper.');
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
  const scfBefore = fixtureProviders ? await request('/_api/grc/admin/settings', { headers }) : null;
  const refreshResult = await request('/_api/grc/admin/scf/refresh', {
    method: 'POST',
    headers,
    body: JSON.stringify({ frameworkIds: refreshTargets }),
  });
  const refreshedJob = await waitForJob(refreshResult.data.jobId);
  if (fixtureProviders && !syntheticScf) {
    assert(refreshedJob.status === 'failed', 'Blocked outbound SCF refresh must report a failed job.');
    assert(Array.isArray(refreshedJob.diagnostics) && refreshedJob.diagnostics.some((diagnostic) => String(diagnostic).includes('Outbound HTTP is blocked in isolated verification.')), 'Expected the explicit outbound-block diagnostic on the failed SCF refresh.');
    assert(!refreshedJob.result?.refreshedFrameworks?.length, 'A blocked SCF refresh must not claim successfully refreshed frameworks.');
    const scfAfter = await request('/_api/grc/admin/settings', { headers });
    const frameworksAfter = await request('/_api/grc/frameworks', { headers });
    assert(scfAfter.data.scfVersion === scfBefore.data.scfVersion && scfAfter.data.scfFrameworkCount === scfBefore.data.scfFrameworkCount, 'Blocked refresh must preserve the existing SCF version and mapping count.');
    assert(JSON.stringify(frameworksAfter.data.map((item) => [item.id, item.crosswalkReady])) === JSON.stringify(frameworks.data.map((item) => [item.id, item.crosswalkReady])), 'Blocked refresh must preserve each framework mapping readiness state.');
  } else {
    assert(
      Array.isArray(refreshedJob?.result?.refreshedFrameworks) && refreshedJob.result.refreshedFrameworks.length >= 2,
      'Expected SCF refresh to process two frameworks.',
    );
    if (syntheticScf) assert(refreshedJob.status === 'completed' && refreshedJob.result.scfVersion === 'regovise-test-fixture', 'Expected a completed refresh of explicitly synthetic SCF data.');
  }

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
  if (fixtureProviders) assert(connectorStatus.data.find((item) => item.source === 'github')?.authReady === false, 'Isolated native GitHub collection must start without live connector credentials.');

  const githubCollect = await request('/_api/grc/connectors/github/collect', {
    method: 'POST',
    headers,
  });
  const githubJob = await waitForJob(githubCollect.data.jobId);
  assert(githubJob?.result?.source === 'github', 'Expected GitHub native collection run.');
  if (fixtureProviders) assert(githubJob.status === 'completed' && githubJob.result.mode === 'fixture' && githubJob.result.diagnostics?.fixture === true, 'Unconfigured local GitHub collection must explicitly identify fixture findings.');

  const githubRuns = await request('/_api/grc/connectors/github/runs', { headers });
  assert(Array.isArray(githubRuns?.data) && githubRuns.data.length >= 1, 'Expected GitHub collector run history.');

  if (fixtureProviders && !syntheticScf) {
    const fixtureDetails = await Promise.all(findings.data.map((finding) => request(`/_api/grc/findings/${encodeURIComponent(finding.id)}`, { headers })));
    assert(fixtureDetails.every((finding) => finding.data.evaluations.every((evaluation) => evaluation.scfControlIds.length === 0)), 'Without an SCF dataset, fixture ingestion must not fabricate mapped SCF ids.');
    const blockedMap = await request('/_api/grc/controls/map?framework=soc2&controlId=CC6.1', { headers }, 500);
    assert(String(blockedMap?.message).includes('Outbound HTTP is blocked in isolated verification.'), 'An uncached SCF map must expose the real blocked-provider failure.');
    console.log(JSON.stringify({ providerMode: 'outbound-blocked-no-credentials', frameworkCount: frameworks.data.length, findingCount: findings.data.length, refreshJobId: refreshedJob.id, refreshStatus: refreshedJob.status, refreshDiagnostics: refreshedJob.diagnostics, githubCollectionMode: githubJob.result.mode, skippedAssertions: ['successful live SCF refresh', 'positive SCF control mappings', 'mapped gap assessment', 'assessment evidence package', 'assessment report bundle', 'assessment executive summary'], proofLimit: 'Normalized findings and unconfigured fixture collection verified; no SCF crosswalk dataset was imported and no live provider success is claimed.' }, null, 2));
    return;
  }

  const controlMap = await request('/_api/grc/controls/map?framework=soc2&controlId=CC6.1', { headers });
  assert(Array.isArray(controlMap?.data?.scfControls) && controlMap.data.scfControls.length >= 1, 'Expected SCF control mappings.');
  if (syntheticScf) assert(controlMap.data.scfControls.every((control) => control.controlId.startsWith('TEST-') && control.title.startsWith('SYNTHETIC TEST ONLY:')), 'Synthetic SCF mapping must retain its artificial ids and labels.');

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
        providerMode: syntheticScf ? 'synthetic-scf-outbound-blocked-no-credentials' : 'live-provider-required',
        ...(syntheticScf ? { fixtureVersion: 'regovise-test-fixture', githubCollectionMode: githubJob.result.mode, skippedAssertions: ['successful live SCF network transport', 'genuine SCF mapping accuracy', 'live GitHub connector collection'], proofLimit: 'Artificial exact-URL SCF responses exercise persisted queue/mapping/assessment/report mechanics; these mappings have no regulatory meaning.' } : {}),
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
