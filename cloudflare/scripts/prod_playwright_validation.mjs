#!/usr/bin/env node

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRequire = createRequire(path.resolve(scriptDir, '../../frontend/package.json'));

let chromium;
try {
  ({ chromium } = frontendRequire('playwright'));
} catch (error) {
  throw new Error(
    `Playwright is required from the frontend workspace. Run frontend dependency install first. ${error instanceof Error ? error.message : ''}`,
  );
}

const BASE_URL = (process.env.REGOVISE_PROD_BASE_URL || 'https://regovise.com').replace(/\/$/, '');
const TENANT_SLUG = process.env.REGOVISE_VERIFY_TENANT_SLUG || 'regovise';
const ADMIN_EMAIL = process.env.REGOVISE_VERIFY_EMAIL || 'admin@regovise.com';
const BOOTSTRAP_SECRET = process.env.BOOTSTRAP_SETUP_SECRET || '';
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== '0';
const SLOW_MO = Number.parseInt(process.env.PLAYWRIGHT_SLOW_MO || '0', 10) || 0;
const SUFFIX = `pw-${Date.now()}`;

const EXPECTED_SCALE_MODULE_KEYS = [
  'assets',
  'assessments',
  'assessment-plans',
  'capabilities',
  'case-management',
  'catalogues',
  'import-regscale-catalogs',
  'causal-analysis',
  'changes',
  'components',
  'data-calls',
  'evidence-locker',
  'exceptions',
  'incidents',
  'interconnections',
  'policies',
  'programs',
  'projects',
  'questionnaires',
  'requirements',
  'risks',
  'security-controls',
  'security-plans',
  'supply-chain',
  'tasks',
  'threats',
];

const CORE_ROUTE_CHECKS = [
  { path: '/', expect: ['Regovise'] },
  { path: '/modules', expect: ['Module Directory', 'Assets'] },
  { path: '/frameworks', expect: ['Catalog', 'Framework'] },
  { path: '/framework-library', expect: ['Framework'] },
  { path: '/findings', expect: ['Findings'] },
  { path: '/gap-assessments', expect: ['Gap'] },
  { path: '/report-bundles', expect: ['Report'] },
  { path: '/assessments', expect: ['Assessments'] },
  { path: '/assessment-plans', expect: ['Assessment'] },
  { path: '/questionnaires', expect: ['Questionnaire'] },
  { path: '/requests', expect: ['Requests'] },
  { path: '/issues', expect: ['Issues'] },
  { path: '/security-profiles', expect: ['Security'] },
  { path: '/threat-models', expect: ['Threat'] },
  { path: '/builders/form-builder', expect: ['Form'] },
  { path: '/builders/export-builder', expect: ['Export'] },
  { path: '/builders/report-builder', expect: ['Report'] },
  { path: '/builders/dashboard-builder', expect: ['Dashboard'] },
  { path: '/builders/questionnaire-builder', expect: ['Questionnaire'] },
  { path: '/builders/wayfinder-builder', expect: ['Wayfinder'] },
  { path: '/workspace/team', expect: ['Team'] },
  { path: '/workspace/access', expect: ['Access'] },
  { path: '/workspace/me', expect: ['Profile'] },
  { path: '/analytics', expect: ['Analytics'] },
  { path: '/search', expect: ['Search'] },
  { path: '/calendar', expect: ['Calendar'] },
  { path: '/workbench', expect: ['Workbench'] },
  { path: '/reports', expect: ['Reports'] },
  { path: '/trust-center', expect: ['FedRAMP', 'Trust'] },
  { path: '/grc-admin', expect: ['GRC', 'Administration'] },
  { path: '/evidence-management', expect: ['Evidence'] },
  { path: '/conmon/profiles', expect: ['ConMon', 'Continuous'] },
  { path: '/assurance', expect: ['Assurance'] },
  { path: '/third-party', expect: ['Third'] },
  { path: '/privacy', expect: ['Privacy'] },
  { path: '/resilience', expect: ['Resilience'] },
  { path: '/risk-scenarios', expect: ['Risk'] },
  { path: '/features/regml', expect: ['RegML'] },
  { path: '/ai-policy-builder', expect: ['AI'] },
  { path: '/response-automation', expect: ['Response'] },
  { path: '/compliance-exports', expect: ['Compliance'] },
  { path: '/imports', expect: ['Import'] },
  { path: '/automation-manager', expect: ['Automation'] },
];

const SHARED_MODULE_EXEMPLARS = ['assets', 'policies', 'incidents', 'exceptions', 'supply-chain'];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function absoluteUrl(route) {
  return `${BASE_URL}${route.startsWith('/') ? route : `/${route}`}`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function jsonRequest(request, method, route, body) {
  const response = await request.fetch(absoluteUrl(route), {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'regovise-prod-playwright-validation/1.0',
    },
    data: body ?? undefined,
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok()) {
    throw new Error(`${method} ${route} failed with ${response.status()}: ${text.slice(0, 500)}`);
  }
  return payload;
}

async function bootstrapSession(context) {
  assert(BOOTSTRAP_SECRET, 'BOOTSTRAP_SETUP_SECRET is required for production Playwright validation.');
  const payload = await jsonRequest(context.request, 'POST', '/_api/core/bootstrap/admin-session', {
    secret: BOOTSTRAP_SECRET,
    tenantSlug: TENANT_SLUG,
    email: ADMIN_EMAIL,
  });
  assert(payload?.data || payload?.ok !== false, 'Bootstrap admin session failed.');
}

async function waitForSettledPage(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
  await page.locator('body').waitFor({ state: 'visible', timeout: 10000 });
}

function makeRouteDiagnostics() {
  const diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedResponses: [],
    requestFailures: [],
  };

  return diagnostics;
}

function wireDiagnostics(page, diagnostics) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      diagnostics.consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push(error.message);
  });
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !url.includes('/favicon') && !url.includes('/cdn-cgi/rum')) {
      diagnostics.failedResponses.push(`${status} ${url}`);
    }
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    const url = request.url();
    const errorText = failure?.errorText ?? 'failed';
    if (
      errorText !== 'net::ERR_ABORTED' &&
      !url.includes('/favicon') &&
      !url.includes('/cdn-cgi/rum')
    ) {
      diagnostics.requestFailures.push(`${errorText} ${url}`);
    }
  });
}

function assertNoRouteDiagnostics(route, diagnostics, baseline) {
  const nextConsoleErrors = diagnostics.consoleErrors.slice(baseline.consoleErrors);
  const nextPageErrors = diagnostics.pageErrors.slice(baseline.pageErrors);
  const nextFailedResponses = diagnostics.failedResponses.slice(baseline.failedResponses);
  const nextRequestFailures = diagnostics.requestFailures.slice(baseline.requestFailures);

  assert(nextPageErrors.length === 0, `${route} produced page errors: ${nextPageErrors.join(' | ')}`);
  assert(nextRequestFailures.length === 0, `${route} produced request failures: ${nextRequestFailures.join(' | ')}`);
  assert(nextFailedResponses.length === 0, `${route} produced failing responses: ${nextFailedResponses.join(' | ')}`);
  assert(nextConsoleErrors.length === 0, `${route} produced console errors: ${nextConsoleErrors.join(' | ')}`);
}

async function validateRoute(page, diagnostics, routeCheck) {
  const baseline = {
    consoleErrors: diagnostics.consoleErrors.length,
    pageErrors: diagnostics.pageErrors.length,
    failedResponses: diagnostics.failedResponses.length,
    requestFailures: diagnostics.requestFailures.length,
  };
  await page.goto(absoluteUrl(routeCheck.path));
  await waitForSettledPage(page);
  const bodyText = await page.locator('body').innerText({ timeout: 10000 });
  assert(bodyText.trim().length > 50, `${routeCheck.path} rendered an unexpectedly small page.`);
  assert(!/route access|not found|something went wrong|application error/i.test(bodyText), `${routeCheck.path} rendered an error/access page.`);
  for (const expectedText of routeCheck.expect ?? []) {
    assert(bodyText.toLowerCase().includes(expectedText.toLowerCase()), `${routeCheck.path} did not include expected text: ${expectedText}`);
  }
  assertNoRouteDiagnostics(routeCheck.path, diagnostics, baseline);
}

async function loadLiveCatalog(context) {
  const catalog = await jsonRequest(context.request, 'GET', '/_api/core/modules/catalog');
  const modules = asArray(catalog?.data?.modules);
  const keys = modules.map((entry) => entry.moduleKey).sort();
  for (const key of EXPECTED_SCALE_MODULE_KEYS) {
    assert(keys.includes(key), `Missing scale.md module in live catalog: ${key}`);
  }
  assert(keys.length === EXPECTED_SCALE_MODULE_KEYS.length, `Expected ${EXPECTED_SCALE_MODULE_KEYS.length} modules, found ${keys.length}.`);
  return modules;
}

async function getFirstFolderId(context) {
  const foldersPayload = await jsonRequest(context.request, 'GET', '/_api/iam/folders');
  const folders = Array.isArray(foldersPayload?.data) ? foldersPayload.data : asArray(foldersPayload?.data?.folders);
  const folder = folders.find((item) => item.contentType === 'domain' && item.id) || folders.find((item) => item.id);
  assert(folder?.id, 'No tenant folder was available for seeded UI validation records.');
  return folder.id;
}

async function seedSharedModuleRecords(context, modules, folderId) {
  const seeded = [];
  const sharedModules = modules.filter((entry) => entry.implementationType === 'shared-workspace');
  for (const entry of sharedModules) {
    const title = `Playwright ${entry.moduleName} ${SUFFIX}`;
    const created = await jsonRequest(context.request, 'POST', `/_api/core/modules/${entry.moduleKey}/records`, {
      folderId,
      title,
      status: 'Active',
      startOn: '2026-05-28',
      dueOn: '2026-06-28',
      reviewOn: '2026-07-28',
      expiresOn: '2026-12-31',
      data: {
        title,
        name: title,
        validationMarker: SUFFIX,
        description: 'Seeded by production Playwright validation for browser-visible product coverage.',
      },
      links: [
        {
          id: crypto.randomUUID(),
          relationType: 'evidence',
          targetType: 'route',
          targetId: null,
          label: 'Validation route',
          route: '/modules',
        },
      ],
      note: 'Created by production Playwright validation.',
    });
    assert(created?.data?.id, `Unable to seed ${entry.moduleKey} record for UI validation.`);
    seeded.push({ moduleKey: entry.moduleKey, title, recordId: created.data.id });
  }
  return seeded;
}

async function validateModuleDirectory(page, modules) {
  await page.goto(absoluteUrl('/modules'));
  await waitForSettledPage(page);
  for (const entry of modules) {
    await page.getByText(entry.pluralName, { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });
  }
}

async function validateSharedModuleSeedVisibility(page, seededRecords) {
  for (const record of seededRecords) {
    await page.goto(absoluteUrl(`/modules/${record.moduleKey}`));
    await waitForSettledPage(page);
    await page.getByRole('textbox', { name: /^Search$/i }).fill(record.title);
    await page.getByText(record.title, { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });
    await page.getByText(record.title, { exact: false }).first().click();
    await page.getByText('Record Detail', { exact: false }).waitFor({ state: 'visible', timeout: 10000 });
  }
}

async function exerciseAssetUiCreateEditArchive(page) {
  const assetId = `ASSET-${SUFFIX}`;
  const title = `Playwright UI Asset ${SUFFIX}`;
  await page.goto(absoluteUrl('/modules/assets'));
  await waitForSettledPage(page);
  await page.getByRole('button', { name: /New Asset/i }).click();
  await page.locator('.eyebrow').filter({ hasText: 'Create Record' }).waitFor({ state: 'visible', timeout: 10000 });
  await page.getByLabel(/Asset ID/i).fill(assetId);
  await page.getByLabel(/^Name/i).fill(title);
  await page.getByLabel(/^Type/i).selectOption({ label: 'Application' }).catch(async () => {
    await page.getByLabel(/^Type/i).selectOption('Application');
  });
  await page.getByLabel(/Classification/i).selectOption({ label: 'Confidential' }).catch(async () => {
    await page.getByLabel(/Classification/i).selectOption('Confidential');
  });
  await page.getByLabel(/Platform/i).fill('Regovise production validation');
  await page.getByLabel(/Location/i).fill('regovise.com');
  await page.getByLabel(/Purchase Date/i).fill('2026-05-28');
  await page.getByLabel(/End of Life Date/i).fill('2026-12-31');
  await page.getByLabel(/Description/i).fill('Browser-created asset used to verify the tenant-facing shared module workspace.');
  await page.getByLabel(/Activity note/i).fill('Playwright created this asset through the UI.');
  await page.getByRole('button', { name: /^Create Record$/i }).click();
  await page.getByText('Asset record created.', { exact: false }).waitFor({ state: 'visible', timeout: 15000 });

  await page.getByRole('textbox', { name: /^Search$/i }).fill(title);
  await page.getByText(title, { exact: false }).first().click();
  await page.getByLabel(/Record status/i).fill('Validated');
  await page.getByLabel(/Activity note/i).fill('Playwright edited this asset through the UI.');
  await page.getByRole('button', { name: /Save Changes/i }).click();
  await page.getByText('Asset record updated.', { exact: false }).waitFor({ state: 'visible', timeout: 15000 });
  await page.getByText('Validated', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });

  await page.getByRole('button', { name: /^Archive$/i }).click();
  await page.getByText('Asset record archived.', { exact: false }).waitFor({ state: 'visible', timeout: 15000 });
}

async function validateSeededOperationalContent(page) {
  const checks = [
    { path: '/framework-library', text: /SOC|NIST|Framework|Catalog/i },
    { path: '/findings', text: /Finding|github|wiz|inspector/i },
    { path: '/gap-assessments', text: /Gap|Assessment/i },
    { path: '/report-bundles', text: /Report|Bundle/i },
    { path: '/assessments', text: /Assessment|Manual|Compliance/i },
    { path: '/builders/questionnaire-builder', text: /Questionnaire|Assessment Plan|Template/i },
    { path: '/workspace/team', text: /User|Team|Codex|admin/i },
    { path: '/workspace/access', text: /Role|Access|Assignment/i },
    { path: '/reports', text: /Report|Export/i },
    { path: '/trust-center', text: /FedRAMP|Trust|Provider/i },
  ];

  for (const check of checks) {
    await page.goto(absoluteUrl(check.path));
    await waitForSettledPage(page);
    const bodyText = await page.locator('body').innerText();
    assert(check.text.test(bodyText), `${check.path} did not show seeded/expected product content.`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: HEADLESS, slowMo: SLOW_MO });
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 1100 },
    ignoreHTTPSErrors: false,
  });
  const page = await context.newPage();
  const diagnostics = makeRouteDiagnostics();
  wireDiagnostics(page, diagnostics);

  try {
    await bootstrapSession(context);
    const modules = await loadLiveCatalog(context);
    const folderId = await getFirstFolderId(context);
    const seededRecords = await seedSharedModuleRecords(context, modules, folderId);
    const routeChecks = [
      ...CORE_ROUTE_CHECKS,
      ...modules.map((entry) => ({
        path: entry.canonicalRoute,
        expect: [entry.pluralName],
      })),
    ];

    const visitedRoutes = new Set();
    for (const routeCheck of routeChecks) {
      if (visitedRoutes.has(routeCheck.path)) {
        continue;
      }
      visitedRoutes.add(routeCheck.path);
      await validateRoute(page, diagnostics, routeCheck);
    }

    await validateModuleDirectory(page, modules);
    await validateSharedModuleSeedVisibility(page, seededRecords);
    await exerciseAssetUiCreateEditArchive(page);
    await validateSeededOperationalContent(page);

    const summary = {
      ok: true,
      suffix: SUFFIX,
      routeCount: visitedRoutes.size,
      moduleCount: modules.length,
      seededSharedModuleRecords: seededRecords.length,
      sharedModuleExemplars: SHARED_MODULE_EXEMPLARS,
      browserDiagnostics: {
        consoleErrors: diagnostics.consoleErrors.length,
        pageErrors: diagnostics.pageErrors.length,
        failedResponses: diagnostics.failedResponses.length,
        requestFailures: diagnostics.requestFailures.length,
      },
    };
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
