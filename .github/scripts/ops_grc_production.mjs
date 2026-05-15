import fs from 'node:fs/promises';

const baseUrlRaw =
  process.env.REGOVISE_VERIFY_BASE_URL ??
  process.env.REGOVISE_PROD_BASE_URL ??
  process.argv[2] ??
  'https://regovise.com';
const bootstrapSecret =
  process.env.REGOVISE_VERIFY_BOOTSTRAP_SECRET ??
  process.env.BOOTSTRAP_SETUP_SECRET ??
  '';
const bootstrapTenantSlug = process.env.REGOVISE_VERIFY_TENANT_SLUG ?? 'regovise';
const bootstrapEmail = process.env.REGOVISE_VERIFY_EMAIL ?? 'admin@regovise.com';
const requireReadyCollector = ['1', 'true', 'yes'].includes(
  String(process.env.GRC_PROD_REQUIRE_READY_COLLECTOR ?? '0').toLowerCase(),
);
const summaryFile = process.env.GRC_PROD_SUMMARY_FILE?.trim() || '';
const baseUrl = baseUrlRaw.endsWith('/') ? baseUrlRaw.slice(0, -1) : baseUrlRaw;
const bannedFrameworkTerms = [/\/plugin\b/i, /\/grc-engineer:/i, /claude-grc/i, /\bmarketplace\b/i];
let sessionCookie = '';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function authHeaders(extraHeaders = {}) {
  const headers = {
    'content-type': 'application/json',
    ...extraHeaders,
  };
  if (sessionCookie) {
    headers.cookie = sessionCookie;
  }
  return headers;
}

async function request(path, init = {}, expectedStatuses = [200]) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: authHeaders(init.headers ?? {}),
  });
  const text = await response.text();
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${init.method ?? 'GET'} ${path} failed (${response.status}): ${text.slice(0, 1000)}`);
  }
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  return {
    status: response.status,
    payload,
  };
}

async function waitForStableHealth() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const { payload } = await request('/_api/core/health', { method: 'GET', headers: {} });
      if (payload?.data?.ok === true) {
        return;
      }
    } catch {
      // Ignore and retry.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('Worker did not reach a stable healthy state in time.');
}

async function establishAdminSession() {
  if (!bootstrapSecret) {
    throw new Error('BOOTSTRAP_SETUP_SECRET (or REGOVISE_VERIFY_BOOTSTRAP_SECRET) is required.');
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
    throw new Error(`POST /_api/core/bootstrap/admin-session failed (${response.status}): ${text.slice(0, 1000)}`);
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('Bootstrap admin-session response did not include a session cookie.');
  }
  sessionCookie = setCookie.split(';', 1)[0] ?? '';
  if (!sessionCookie) {
    throw new Error('Bootstrap admin-session response returned an empty session cookie.');
  }
}

async function waitForJob(jobId, { attempts = 120, delayMs = 1500 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { payload } = await request(`/_api/grc/jobs/${encodeURIComponent(jobId)}`, { method: 'GET', headers: {} });
    const job = payload?.data;
    if (!job) {
      throw new Error(`GRC job ${jobId} disappeared while polling.`);
    }
    if (job.status === 'completed') {
      return job;
    }
    if (job.status === 'failed') {
      throw new Error(`GRC job ${jobId} failed: ${JSON.stringify(job.diagnostics ?? [])}`);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`Timed out waiting for GRC job ${jobId}.`);
}

async function startJob(label, path, body = undefined) {
  const { payload } = await request(
    path,
    {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {},
    },
    [200, 202],
  );
  const envelope = payload?.data;
  const jobId = envelope?.jobId;
  assert(jobId, `${label} did not return a job envelope.`);
  const job = await waitForJob(jobId);
  return { envelope, job };
}

function chooseFrameworkDocument(frameworks, detailById) {
  for (const framework of frameworks) {
    const detail = detailById.get(framework.id);
    const firstDocument = detail?.documents?.[0];
    if (firstDocument?.slug) {
      return {
        framework,
        detail,
        document: firstDocument,
      };
    }
  }
  return null;
}

async function ensureAssessment(frameworks) {
  const { payload } = await request('/_api/grc/assessments', { method: 'GET', headers: {} });
  const assessments = Array.isArray(payload?.data) ? payload.data : [];
  const reusable = assessments.find((assessment) => String(assessment.title ?? '').startsWith('GRC Ops Validation'));
  if (reusable?.id) {
    return reusable.id;
  }

  const selectedFrameworkIds = frameworks.slice(0, 2).map((framework) => framework.id);
  assert(selectedFrameworkIds.length > 0, 'No frameworks are available to build an ops validation assessment.');

  const { payload: createdPayload } = await request('/_api/grc/assessments', {
    method: 'POST',
    headers: {},
    body: JSON.stringify({
      title: `GRC Ops Validation ${new Date().toISOString().slice(0, 10)}`,
      frameworks: selectedFrameworkIds,
    }),
  });
  const createdId = createdPayload?.data?.id;
  assert(createdId, 'Gap assessment creation did not return an id.');
  return createdId;
}

async function fetchFrameworkDetail(frameworkId) {
  const { payload } = await request(`/_api/grc/frameworks/${encodeURIComponent(frameworkId)}`, {
    method: 'GET',
    headers: {},
  });
  return payload?.data ?? null;
}

async function fetchFrameworkDocument(frameworkId, slug) {
  const { payload } = await request(
    `/_api/grc/frameworks/${encodeURIComponent(frameworkId)}/content/${encodeURIComponent(slug)}`,
    {
      method: 'GET',
      headers: {},
    },
  );
  return payload?.data ?? null;
}

function assertDocumentSanitized(document) {
  const bodyMarkdown = String(document?.bodyMarkdown ?? '');
  if (bannedFrameworkTerms.some((pattern) => pattern.test(bodyMarkdown))) {
    throw new Error('Rendered framework content still contains banned upstream plugin language after re-import.');
  }
}

async function main() {
  console.log(`Running GRC production ops against ${baseUrl}`);
  await waitForStableHealth();
  await establishAdminSession();

  const summary = {
    baseUrl,
    tenantSlug: bootstrapTenantSlug,
    adminEmail: bootstrapEmail,
    reimport: null,
    renderedContent: null,
    scfRefresh: null,
    collector: null,
    assessmentId: null,
    reportBundle: null,
    evidencePackage: null,
    execSummary: null,
    recentJobsCount: 0,
  };

  const reimport = await startJob('curated snapshot import', '/_api/grc/admin/import-snapshot', {});
  summary.reimport = {
    jobId: reimport.job.id,
    status: reimport.job.status,
    result: reimport.job.result,
  };

  const { payload: frameworksPayload } = await request('/_api/grc/frameworks', { method: 'GET', headers: {} });
  const frameworks = Array.isArray(frameworksPayload?.data) ? frameworksPayload.data : [];
  assert(frameworks.length > 0, 'Framework library is empty after production re-import.');

  const detailById = new Map();
  for (const framework of frameworks.slice(0, 6)) {
    const detail = await fetchFrameworkDetail(framework.id);
    if (detail?.id) {
      detailById.set(framework.id, detail);
    }
  }

  const chosenDocument = chooseFrameworkDocument(frameworks, detailById);
  assert(chosenDocument, 'Could not find a framework document to validate after re-import.');
  const renderedDocument = await fetchFrameworkDocument(chosenDocument.framework.id, chosenDocument.document.slug);
  assert(renderedDocument?.slug, 'Framework document fetch did not return a document payload.');
  assertDocumentSanitized(renderedDocument);
  summary.renderedContent = {
    frameworkId: chosenDocument.framework.id,
    frameworkSlug: chosenDocument.framework.slug,
    documentSlug: renderedDocument.slug,
  };

  const scfTargets = frameworks.filter((framework) => framework.scfFrameworkId).slice(0, 12).map((framework) => framework.id);
  if (scfTargets.length > 0) {
    const scfRefresh = await startJob('SCF refresh', '/_api/grc/admin/scf/refresh', {
      frameworkIds: scfTargets,
    });
    summary.scfRefresh = {
      jobId: scfRefresh.job.id,
      frameworkCount: scfTargets.length,
      status: scfRefresh.job.status,
      result: scfRefresh.job.result,
    };
  }

  const { payload: connectorsPayload } = await request('/_api/grc/connectors', { method: 'GET', headers: {} });
  const connectors = Array.isArray(connectorsPayload?.data) ? connectorsPayload.data : [];
  const readyCollector = connectors.find((collector) => collector.authReady === true);

  if (readyCollector) {
    const collectorRun = await startJob(
      `${readyCollector.source} collector launch`,
      `/_api/grc/connectors/${encodeURIComponent(readyCollector.source)}/collect`,
    );
    summary.collector = {
      source: readyCollector.source,
      mode: readyCollector.collectionMode,
      status: collectorRun.job.status,
      jobId: collectorRun.job.id,
      result: collectorRun.job.result,
    };
  } else {
    const blockedCollector = connectors[0] ?? null;
    if (!blockedCollector) {
      summary.collector = {
        status: 'skipped',
        reason: 'No native collectors are configured in production.',
      };
    } else {
      const blockedAttempt = await request(
        `/_api/grc/connectors/${encodeURIComponent(blockedCollector.source)}/collect`,
        {
          method: 'POST',
          headers: {},
        },
        [202, 412],
      );
      if (blockedAttempt.status === 202) {
        const jobId = blockedAttempt.payload?.data?.jobId;
        const collectorRun = await waitForJob(jobId);
        summary.collector = {
          source: blockedCollector.source,
          mode: blockedCollector.collectionMode,
          status: collectorRun.status,
          jobId: collectorRun.id,
          result: collectorRun.result,
        };
      } else {
        if (requireReadyCollector) {
          throw new Error(`No live-ready collector was available. ${blockedCollector.source} returned 412 as expected.`);
        }
        summary.collector = {
          source: blockedCollector.source,
          mode: blockedCollector.collectionMode,
          status: 'blocked',
          responseStatus: blockedAttempt.status,
          message: blockedAttempt.payload?.message ?? blockedAttempt.payload?.error ?? 'collector not ready',
        };
      }
    }
  }

  const assessmentId = await ensureAssessment(frameworks);
  summary.assessmentId = assessmentId;

  const reportBundle = await startJob(
    'report bundle generation',
    `/_api/grc/assessments/${encodeURIComponent(assessmentId)}/report`,
  );
  const reportBundleId = reportBundle.job.result?.reportBundleId ?? null;
  assert(reportBundleId, 'Report bundle job completed without a reportBundleId.');
  await request(`/_api/grc/report-bundles/${encodeURIComponent(reportBundleId)}`, { method: 'GET', headers: {} });
  summary.reportBundle = {
    jobId: reportBundle.job.id,
    reportBundleId,
    status: reportBundle.job.status,
  };

  const evidencePackage = await startJob('evidence package generation', '/_api/grc/evidence-packages', {
    assessmentId,
  });
  const evidencePackageId = evidencePackage.job.result?.evidencePackageId ?? null;
  assert(evidencePackageId, 'Evidence package job completed without an evidencePackageId.');
  await request(`/_api/grc/evidence-packages/${encodeURIComponent(evidencePackageId)}`, {
    method: 'GET',
    headers: {},
  });
  summary.evidencePackage = {
    jobId: evidencePackage.job.id,
    evidencePackageId,
    status: evidencePackage.job.status,
  };

  const execSummary = await startJob('exec summary generation', '/_api/grc/reports/exec-summary', {
    assessmentId,
  });
  const reportSnapshotId = execSummary.job.result?.reportId ?? null;
  assert(reportSnapshotId, 'Exec summary job completed without a reportId.');
  await request(`/_api/grc/report-snapshots/${encodeURIComponent(reportSnapshotId)}`, {
    method: 'GET',
    headers: {},
  });
  summary.execSummary = {
    jobId: execSummary.job.id,
    reportId: reportSnapshotId,
    status: execSummary.job.status,
  };

  const { payload: jobsPayload } = await request('/_api/grc/jobs', { method: 'GET', headers: {} });
  summary.recentJobsCount = Array.isArray(jobsPayload?.data) ? jobsPayload.data.length : 0;

  if (summaryFile) {
    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
  }

  console.log(JSON.stringify(summary, null, 2));
}

await main();
