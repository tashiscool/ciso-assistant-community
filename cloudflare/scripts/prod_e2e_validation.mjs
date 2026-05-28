#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
const READ_ONLY = process.env.E2E_READ_ONLY === '1';
const ALLOW_MUTATIONS =
  process.env.E2E_ALLOW_PRODUCTION_MUTATIONS === '1' &&
  process.env.LIVE_VALIDATION_ALLOW_MUTATIONS === '1';
const RUN_ID = process.env.E2E_RUN_ID || `e2e-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`;
const MARKER = `E2E ${RUN_ID}`;
const USER_AGENT = 'regovise-prod-e2e-validation/1.0';
const OUTPUT_DIR = path.resolve(process.env.E2E_OUTPUT_DIR || path.resolve(scriptDir, '../../.playwright-regovise', RUN_ID));
const TRACE_PATH = path.join(OUTPUT_DIR, 'trace.zip');
const RESULT_PATH = path.join(OUTPUT_DIR, 'result.json');

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

const SHARED_MODULE_ALIAS_ROUTES = [
  { moduleKey: 'assets', route: '/assets' },
  { moduleKey: 'capabilities', route: '/capabilities' },
  { moduleKey: 'case-management', route: '/case-management' },
  { moduleKey: 'causal-analysis', route: '/causal-analysis' },
  { moduleKey: 'changes', route: '/changes' },
  { moduleKey: 'components', route: '/components' },
  { moduleKey: 'data-calls', route: '/data-calls' },
  { moduleKey: 'evidence-locker', route: '/evidence-locker' },
  { moduleKey: 'exceptions', route: '/security-exceptions' },
  { moduleKey: 'incidents', route: '/incidents' },
  { moduleKey: 'interconnections', route: '/interconnections' },
  { moduleKey: 'issues', route: '/issues' },
  { moduleKey: 'policies', route: '/policies' },
  { moduleKey: 'programs', route: '/programs' },
  { moduleKey: 'projects', route: '/projects' },
  { moduleKey: 'requests', route: '/requests' },
  { moduleKey: 'requirements', route: '/requirements' },
  { moduleKey: 'risks', route: '/risks' },
  { moduleKey: 'security-controls', route: '/security-controls' },
  { moduleKey: 'security-plans', route: '/security-plans' },
  { moduleKey: 'supply-chain', route: '/supply-chain' },
  { moduleKey: 'tasks', route: '/tasks' },
  { moduleKey: 'threats', route: '/threats' },
];

const SHARED_MODULE_MUTATION_KEYS = [
  'assets',
  'policies',
  'incidents',
  'exceptions',
  'supply-chain',
  'tasks',
  'data-calls',
  'risks',
  'requirements',
  'evidence-locker',
];

const ROUTE_CHECKS = [
  { group: 'shell', path: '/', expectAny: ['Regovise', 'Dashboard', 'Workspace'] },
  { group: 'program', path: '/program', expectAny: ['Program', 'Workspace'] },
  { group: 'program', path: '/program/setup', expectAny: ['Quick', 'Start', 'Setup'] },
  { group: 'modules', path: '/modules', expectAny: ['Tenant Module Directory', 'Module Directory'] },
  { group: 'workspace', path: '/workspace/me', expectAny: ['Profile', 'Access'] },
  { group: 'workspace', path: '/workspace/domains', expectAny: ['Domains', 'Folders'] },
  { group: 'workspace', path: '/workspace/team', expectAny: ['Team', 'Users'] },
  { group: 'workspace', path: '/workspace/access', expectAny: ['Access', 'Roles'] },
  { group: 'setup', path: '/setup/tags', expectAny: ['Tags'] },
  { group: 'setup', path: '/setup/general', expectAny: ['General', 'Organization'] },
  { group: 'setup', path: '/setup/classification', expectAny: ['Classification'] },
  { group: 'setup', path: '/setup/service-accounts', expectAny: ['Service Accounts'] },
  { group: 'setup', path: '/setup/branding', expectAny: ['Branding'] },
  { group: 'setup', path: '/setup/email', expectAny: ['Email'] },
  { group: 'setup', path: '/setup/logs-utilization', expectAny: ['Logs', 'Utilization'] },
  { group: 'setup', path: '/setup/security', expectAny: ['Security'] },
  { group: 'setup', path: '/setup/modules-features', expectAny: ['Modules', 'Features'] },
  { group: 'setup', path: '/setup/risk-model', expectAny: ['Risk Model', 'Risk'] },
  { group: 'setup', path: '/setup/sso', expectAny: ['SSO', 'Single Sign'] },
  { group: 'setup', path: '/setup/mfa', expectAny: ['MFA', 'Multi'] },
  { group: 'libraries', path: '/libraries', expectAny: ['Libraries', 'Loaded'] },
  { group: 'frameworks', path: '/frameworks', expectAny: ['Catalog', 'Framework'] },
  { group: 'frameworks', path: '/catalogues', expectAny: ['Catalog', 'Framework'] },
  { group: 'frameworks', path: '/framework-library', expectAny: ['Framework'] },
  { group: 'frameworks', path: '/findings', expectAny: ['Findings'] },
  { group: 'frameworks', path: '/gap-assessments', expectAny: ['Gap'] },
  { group: 'frameworks', path: '/report-bundles', expectAny: ['Report'] },
  { group: 'assessments', path: '/assessments', expectAny: ['Assessments', 'Assessment Workbench'] },
  { group: 'assessments', path: '/compliance-assessments', expectAny: ['Assessments'] },
  { group: 'assessments', path: '/risk-assessments', expectAny: ['Assessments', 'Risk'] },
  { group: 'assessments', path: '/applied-controls/kanban-mode', expectAny: ['Kanban', 'Controls'] },
  { group: 'assessments', path: '/applied-controls/flash-mode', expectAny: ['Flash', 'Controls'] },
  { group: 'templates', path: '/assessment-plans', expectAny: ['Assessment Plan', 'Plans'] },
  { group: 'templates', path: '/questionnaires', expectAny: ['Questionnaire'] },
  { group: 'builders', path: '/builders/form-builder', expectAny: ['Form Builder', 'Form'] },
  { group: 'builders', path: '/builders/export-builder', expectAny: ['Export Builder', 'Export'] },
  { group: 'builders', path: '/builders/export-builder/docx-template', expectAny: ['DOCX', 'Template'] },
  { group: 'builders', path: '/builders/report-builder', expectAny: ['Report Builder', 'Report'] },
  { group: 'builders', path: '/builders/dashboard-builder', expectAny: ['Dashboard Builder', 'Dashboard'] },
  { group: 'builders', path: '/builders/rules-builder', expectAny: ['Rules Builder', 'Rules'] },
  { group: 'builders', path: '/builders/wayfinder-builder', expectAny: ['Wayfinder'] },
  { group: 'builders', path: '/builders/questionnaire-builder', expectAny: ['Questionnaire Builder', 'Questionnaire'] },
  { group: 'builders', path: '/builders/questionnaire-builder/overview', expectAny: ['Questionnaire', 'Overview'] },
  { group: 'tprm', path: '/third-party', expectAny: ['Third', 'Vendor', 'Entity'] },
  { group: 'tprm', path: '/entities', expectAny: ['Third', 'Vendor', 'Entity'] },
  { group: 'tprm', path: '/contracts', expectAny: ['Third', 'Contract', 'Vendor'] },
  { group: 'privacy', path: '/privacy', expectAny: ['Privacy'] },
  { group: 'privacy', path: '/processings', expectAny: ['Privacy', 'Processing'] },
  { group: 'resilience', path: '/resilience', expectAny: ['Resilience', 'Business Impact'] },
  { group: 'resilience', path: '/business-impact-analysis', expectAny: ['Resilience', 'Business Impact'] },
  { group: 'reports', path: '/reports', expectAny: ['Reports', 'Report'] },
  { group: 'reports', path: '/reports/dora-roi', expectAny: ['DORA', 'ROI'] },
  { group: 'ai', path: '/features/regml', expectAny: ['RegML'] },
  { group: 'ai', path: '/features/regml/author', expectAny: ['RegML', 'Author'] },
  { group: 'ai', path: '/features/regml/explainer', expectAny: ['RegML', 'Explainer'] },
  { group: 'ai', path: '/features/regml/ssp-author', expectAny: ['SSP', 'Author'] },
  { group: 'ai', path: '/features/regml/auditor', expectAny: ['Auditor', 'RegML'] },
  { group: 'ai', path: '/features/regml/ai-generator', expectAny: ['AI', 'Generator'] },
  { group: 'ai', path: '/ai-policy-builder', expectAny: ['AI', 'Policy'] },
  { group: 'ai', path: '/response-automation', expectAny: ['Response', 'Automation'] },
  { group: 'ai', path: '/evidence-mapping', expectAny: ['Evidence', 'Mapping'] },
  { group: 'ai', path: '/compliance-exports', expectAny: ['Compliance', 'Export'] },
  { group: 'ops', path: '/imports', expectAny: ['Import'] },
  { group: 'ops', path: '/automation-manager', expectAny: ['Automation'] },
  { group: 'ops', path: '/grc-admin', expectAny: ['GRC', 'Administration'] },
  { group: 'ops', path: '/trust-center', expectAny: ['FedRAMP', 'Trust'] },
  { group: 'ops', path: '/workflow', expectAny: ['Workflow'] },
  { group: 'ops', path: '/utilities', expectAny: ['Utilities'] },
  { group: 'ops', path: '/subsystems', expectAny: ['Subsystems'] },
  { group: 'ops', path: '/rmf', expectAny: ['RMF'] },
  { group: 'ops', path: '/app-management', expectAny: ['App', 'Management'] },
  { group: 'ops', path: '/workbench', expectAny: ['Workbench'] },
  { group: 'ops', path: '/news-feed', expectAny: ['News', 'Feed'] },
  { group: 'ops', path: '/analytics', expectAny: ['Analytics'] },
  { group: 'ops', path: '/search', expectAny: ['Search'] },
  { group: 'ops', path: '/calendar', expectAny: ['Calendar'] },
  { group: 'ops', path: '/backup-restore', expectAny: ['Backup', 'Restore'] },
  { group: 'portal', path: '/portal', expectAny: ['Portal', 'Assignments'] },
  { group: 'portal', path: '/my-assignments', expectAny: ['Portal', 'Assignments'] },
  { group: 'portal', path: '/auditee-dashboard', expectAny: ['Portal', 'Assignments'] },
  { group: 'advanced-risk', path: '/advanced-risk/ebios', expectAny: ['EBIOS'] },
  { group: 'advanced-risk', path: '/advanced-risk/quantitative', expectAny: ['Quantitative', 'Risk'] },
  { group: 'advanced-risk', path: '/ebios-rm', expectAny: ['EBIOS'] },
  { group: 'advanced-risk', path: '/quantitative-risk-studies', expectAny: ['Quantitative', 'Risk'] },
  { group: 'advanced-risk', path: '/risk-scenarios', expectAny: ['Risk', 'Scenario'] },
  { group: 'evidence', path: '/evidence-management', expectAny: ['Evidence'] },
  { group: 'evidence', path: '/evidence/sources', expectAny: ['Evidence', 'Sources'] },
  { group: 'evidence', path: '/evidence/jobs', expectAny: ['Evidence', 'Jobs'] },
  { group: 'assurance', path: '/assurance', expectAny: ['Assurance'] },
  { group: 'assurance', path: '/assurance/evidence', expectAny: ['Evidence'] },
  { group: 'assurance', path: '/assurance/tracker', expectAny: ['Tracker'] },
  { group: 'assurance', path: '/assurance/packages', expectAny: ['Packages'] },
  { group: 'assurance', path: '/assurance/reviews', expectAny: ['Reviews'] },
  { group: 'assurance', path: '/assurance/agent-runs', expectAny: ['Agent'] },
  { group: 'conmon', path: '/conmon/profiles', expectAny: ['ConMon', 'Continuous'] },
  { group: 'conmon', path: '/conmon/executions', expectAny: ['ConMon', 'Executions'] },
  { group: 'legacy', path: '/folders', expectAny: ['Domains', 'Folders'] },
  { group: 'legacy', path: '/users', expectAny: ['Team', 'Users'] },
  { group: 'legacy', path: '/loaded-libraries', expectAny: ['Libraries', 'Loaded'] },
  { group: 'legacy', path: '/mapping-libraries', expectAny: ['Libraries'] },
  { group: 'legacy', path: '/stored-libraries', expectAny: ['Libraries', 'Stored'] },
  { group: 'aliases', path: '/requests', expectAny: ['Requests'] },
  { group: 'aliases', path: '/issues', expectAny: ['Issues'] },
  { group: 'aliases', path: '/security-profiles', expectAny: ['Security'] },
  { group: 'aliases', path: '/threat-models', expectAny: ['Threat'] },
];

const report = {
  ok: false,
  runId: RUN_ID,
  marker: MARKER,
  baseUrl: BASE_URL,
  tenantSlug: TENANT_SLUG,
  adminEmail: ADMIN_EMAIL,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  outputDir: OUTPUT_DIR,
  mode: {
    readOnly: READ_ONLY,
    mutationsAllowed: ALLOW_MUTATIONS,
    headless: HEADLESS,
  },
  app: {},
  suites: [],
  artifacts: [],
  cleanup: [],
  failures: [],
  skips: [],
  browserDiagnostics: {
    consoleErrors: [],
    pageErrors: [],
    failedResponses: [],
    requestFailures: [],
  },
};

const cleanupStack = [];
let activePage = null;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function absoluteUrl(route) {
  return `${BASE_URL}${route.startsWith('/') ? route : `/${route}`}`;
}

function apiRoute(route) {
  return route.startsWith('/_api') ? route : `/_api${route.startsWith('/') ? route : `/${route}`}`;
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function includesAny(bodyText, expectedValues) {
  const haystack = bodyText.toLowerCase();
  return expectedValues.some((value) => haystack.includes(value.toLowerCase()));
}

function todayIso(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function makeSuite(name) {
  const suite = {
    name,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    checks: [],
  };
  report.suites.push(suite);
  return suite;
}

async function captureFailure(name) {
  if (!activePage) {
    return null;
  }
  const fileName = `${slug(name || 'failure')}-${Date.now()}.png`;
  const screenshotPath = path.join(OUTPUT_DIR, fileName);
  await activePage.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
  return screenshotPath;
}

async function runCheck(suite, name, fn, options = {}) {
  const startedAt = new Date().toISOString();
  const check = { name, startedAt, finishedAt: null, ok: false };
  suite.checks.push(check);
  try {
    const result = await fn();
    check.ok = true;
    check.result = result ?? null;
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const screenshot = await captureFailure(`${suite.name}-${name}`);
    check.error = message;
    check.screenshot = screenshot;
    report.failures.push({ suite: suite.name, check: name, message, screenshot });
    if (options.critical) {
      throw error;
    }
    return null;
  } finally {
    check.finishedAt = new Date().toISOString();
  }
}

function finishSuite(suite) {
  suite.finishedAt = new Date().toISOString();
}

async function jsonRequest(request, method, route, body, options = {}) {
  const response = await request.fetch(absoluteUrl(apiRoute(route)), {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': USER_AGENT,
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
  const allowedStatuses = options.allowStatuses ?? [];
  if (!response.ok() && !allowedStatuses.includes(response.status())) {
    throw new Error(`${method} ${apiRoute(route)} failed with ${response.status()}: ${text.slice(0, 500)}`);
  }
  return payload;
}

async function bootstrapSession(context) {
  assert(BOOTSTRAP_SECRET, 'BOOTSTRAP_SETUP_SECRET is required for production E2E validation.');
  const payload = await jsonRequest(context.request, 'POST', '/core/bootstrap/admin-session', {
    secret: BOOTSTRAP_SECRET,
    tenantSlug: TENANT_SLUG,
    email: ADMIN_EMAIL,
  });
  assert(payload?.data || payload?.ok !== false, 'Bootstrap admin session failed.');
  report.app.session = {
    tenantSlug: payload?.data?.tenantSlug,
    tenantId: payload?.data?.tenantId,
    userId: payload?.data?.userId,
    expiresAt: payload?.data?.sessionExpiresAt,
  };
}

async function waitForSettledPage(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => undefined);
  await page.locator('body').waitFor({ state: 'visible', timeout: 12000 });
}

function isIgnorableDiagnostic(url, statusOrError = '') {
  return (
    url.includes('/favicon') ||
    url.includes('/cdn-cgi/rum') ||
    url.includes('/__vite_ping') ||
    String(statusOrError).includes('net::ERR_ABORTED')
  );
}

function wireDiagnostics(page) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      report.browserDiagnostics.consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    report.browserDiagnostics.pageErrors.push(error.message);
  });
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !isIgnorableDiagnostic(url, status)) {
      report.browserDiagnostics.failedResponses.push(`${status} ${url}`);
    }
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    const url = request.url();
    const errorText = failure?.errorText ?? 'failed';
    if (!isIgnorableDiagnostic(url, errorText)) {
      report.browserDiagnostics.requestFailures.push(`${errorText} ${url}`);
    }
  });
}

function diagnosticsBaseline() {
  return {
    consoleErrors: report.browserDiagnostics.consoleErrors.length,
    pageErrors: report.browserDiagnostics.pageErrors.length,
    failedResponses: report.browserDiagnostics.failedResponses.length,
    requestFailures: report.browserDiagnostics.requestFailures.length,
  };
}

function assertNoNewDiagnostics(route, baseline) {
  const nextConsoleErrors = report.browserDiagnostics.consoleErrors.slice(baseline.consoleErrors);
  const nextPageErrors = report.browserDiagnostics.pageErrors.slice(baseline.pageErrors);
  const nextFailedResponses = report.browserDiagnostics.failedResponses.slice(baseline.failedResponses);
  const nextRequestFailures = report.browserDiagnostics.requestFailures.slice(baseline.requestFailures);

  assert(nextPageErrors.length === 0, `${route} produced page errors: ${nextPageErrors.join(' | ')}`);
  assert(nextRequestFailures.length === 0, `${route} produced request failures: ${nextRequestFailures.join(' | ')}`);
  assert(nextFailedResponses.length === 0, `${route} produced failing responses: ${nextFailedResponses.join(' | ')}`);
  assert(nextConsoleErrors.length === 0, `${route} produced console errors: ${nextConsoleErrors.join(' | ')}`);
}

async function validateRoute(page, routeCheck) {
  const baseline = diagnosticsBaseline();
  await page.goto(absoluteUrl(routeCheck.path));
  await waitForSettledPage(page);
  const bodyText = await page.locator('body').innerText({ timeout: 12000 });
  assert(bodyText.trim().length > 40, `${routeCheck.path} rendered an unexpectedly small page.`);
  assert(
    !/route access denied|something went wrong|application error|page not found|^404$/i.test(bodyText),
    `${routeCheck.path} rendered an error/access page.`,
  );
  if (routeCheck.expectAny?.length) {
    assert(
      includesAny(bodyText, routeCheck.expectAny),
      `${routeCheck.path} did not include any expected text: ${routeCheck.expectAny.join(', ')}`,
    );
  }
  assertNoNewDiagnostics(routeCheck.path, baseline);
  return { route: routeCheck.path, group: routeCheck.group };
}

async function loadLiveCatalog(context) {
  const catalog = await jsonRequest(context.request, 'GET', '/core/modules/catalog');
  const modules = asArray(catalog?.data?.modules);
  const keys = modules.map((entry) => entry.moduleKey).sort();
  for (const key of EXPECTED_SCALE_MODULE_KEYS) {
    assert(keys.includes(key), `Missing scale.md module in live catalog: ${key}`);
  }
  assert(
    keys.length === EXPECTED_SCALE_MODULE_KEYS.length,
    `Expected ${EXPECTED_SCALE_MODULE_KEYS.length} scale.md modules, found ${keys.length}.`,
  );
  report.app.modules = {
    expected: EXPECTED_SCALE_MODULE_KEYS.length,
    actual: modules.length,
    sharedWorkspace: modules.filter((entry) => entry.implementationType === 'shared-workspace').length,
    dedicatedWorkspace: modules.filter((entry) => entry.implementationType === 'dedicated-workspace').length,
    templateWorkspace: modules.filter((entry) => entry.implementationType === 'template-workspace').length,
    subfeature: modules.filter((entry) => entry.implementationType === 'subfeature').length,
  };
  return modules;
}

async function loadTenantContext(context) {
  const [foldersPayload, usersPayload, frameworksPayload, mePayload] = await Promise.all([
    jsonRequest(context.request, 'GET', '/iam/folders?contentType=domain'),
    jsonRequest(context.request, 'GET', '/iam/users'),
    jsonRequest(context.request, 'GET', '/core/frameworks'),
    jsonRequest(context.request, 'GET', '/iam/me'),
  ]);

  const folders = asArray(foldersPayload?.data);
  const users = asArray(usersPayload?.data);
  const frameworks = asArray(frameworksPayload?.data);
  const folder = folders.find((item) => item.contentType === 'domain' && item.id) || folders.find((item) => item.id);
  const user = users.find((item) => item.email === ADMIN_EMAIL) || users.find((item) => item.id);
  const framework = frameworks.find((item) => Number(item.controlCount ?? 0) > 0) || frameworks.find((item) => item.id);

  assert(folder?.id, 'No tenant domain folder was available for E2E records.');
  assert(user?.id, 'No tenant user was available for ownership/permission validation.');
  assert(frameworks.length > 0, 'No seeded frameworks were available in the tenant.');

  let controls = [];
  if (framework?.id) {
    const controlsPayload = await jsonRequest(context.request, 'GET', `/core/frameworks/${framework.id}/controls`);
    controls = asArray(controlsPayload?.data);
  }

  report.app.seededData = {
    folders: folders.length,
    users: users.length,
    frameworks: frameworks.length,
    selectedFrameworkControlCount: controls.length,
    effectivePermissions: asArray(mePayload?.data?.permissions).length,
  };

  return { folders, users, frameworks, controls, folder, user, framework };
}

function valueForField(field, title) {
  const name = String(field.systemName || '').toLowerCase();
  const displayName = String(field.displayName || '').toLowerCase();
  const fieldType = String(field.fieldType || '').toLowerCase();

  if (name === 'title' || name === 'name' || displayName === 'title' || displayName === 'name') {
    return title;
  }
  if (name.includes('asset_id') || name.includes('reference') || name.endsWith('_id')) {
    return `${RUN_ID}-${name}`.slice(0, 96);
  }
  if (name.includes('owner') || name.includes('custodian') || name.includes('assessor')) {
    return 'Regovise E2E Owner';
  }
  if (name.includes('classification')) {
    return field.choices?.includes('Confidential') ? 'Confidential' : field.choices?.[0] ?? 'Confidential';
  }
  if (name.includes('severity')) {
    return field.choices?.includes('Moderate') ? 'Moderate' : field.choices?.[0] ?? 'Moderate';
  }
  if (name.includes('priority')) {
    return field.choices?.includes('Medium') ? 'Medium' : field.choices?.[0] ?? 'Medium';
  }
  if (name.includes('status') || name.includes('lifecycle')) {
    return field.choices?.includes('Active') ? 'Active' : field.choices?.[0] ?? 'Active';
  }
  if (name.includes('inventory')) {
    return field.choices?.includes('Verified') ? 'Verified' : field.choices?.[0] ?? 'Verified';
  }
  if (fieldType.includes('select')) {
    return field.choices?.[0] ?? 'Active';
  }
  if (fieldType.includes('date')) {
    if (name.includes('end') || name.includes('expires')) return todayIso(90);
    if (name.includes('review')) return todayIso(30);
    return todayIso(0);
  }
  if (fieldType.includes('whole') || fieldType.includes('dollar') || fieldType.includes('probability') || fieldType.includes('consequence')) {
    return 3;
  }
  if (fieldType.includes('ip')) {
    return '10.0.0.1';
  }
  if (fieldType.includes('area')) {
    return `${MARKER} validation notes for ${title}.`;
  }
  return `${MARKER} ${field.displayName || field.systemName || 'field'}`;
}

function buildModuleData(entry, title) {
  const data = {
    title,
    name: title,
    validationMarker: RUN_ID,
    description: `${MARKER} test-owned record created by the comprehensive production E2E suite.`,
  };
  for (const field of asArray(entry.starterFields)) {
    data[field.systemName] = valueForField(field, title);
  }
  return data;
}

function trackArtifact(artifact) {
  const tracked = {
    ...artifact,
    createdAt: new Date().toISOString(),
    cleanupStatus: 'pending',
  };
  cleanupStack.push(tracked);
  report.artifacts.push({
    type: tracked.type,
    id: tracked.id,
    title: tracked.title,
    route: tracked.route,
    cleanupMethod: tracked.cleanupMethod,
    residualPolicy: tracked.residualPolicy ?? 'none',
  });
  return tracked;
}

function trackModuleRecord(moduleKey, record) {
  return trackArtifact({
    type: 'module-record',
    moduleKey,
    id: record.id,
    title: record.title,
    route: `/modules/${moduleKey}?record=${record.id}`,
    cleanupMethod: 'archive',
    residualPolicy: 'archived',
    cleanup: async (context) => {
      await jsonRequest(
        context.request,
        'POST',
        `/core/modules/${moduleKey}/records/${record.id}/archive`,
        null,
        { allowStatuses: [404] },
      );
    },
  });
}

async function createModuleRecordFixture(context, entry, folderId) {
  const title = `${MARKER} ${entry.pluralName} fixture`;
  const created = await jsonRequest(context.request, 'POST', `/core/modules/${entry.moduleKey}/records`, {
    folderId,
    title,
    status: 'Active',
    startOn: todayIso(0),
    dueOn: todayIso(21),
    reviewOn: todayIso(35),
    expiresOn: todayIso(120),
    data: buildModuleData(entry, title),
    links: [
      {
        id: crypto.randomUUID(),
        relationType: 'evidence',
        targetType: 'route',
        targetId: null,
        label: `${MARKER} evidence route`,
        route: '/evidence-management',
      },
      {
        id: crypto.randomUUID(),
        relationType: 'task',
        targetType: 'route',
        targetId: null,
        label: `${MARKER} workbench route`,
        route: '/workbench',
      },
    ],
    note: `${MARKER} created for comprehensive E2E module coverage.`,
  });
  assert(created?.data?.id, `Unable to create ${entry.moduleKey} fixture.`);
  trackModuleRecord(entry.moduleKey, created.data);
  return created.data;
}

async function updateRepresentativeModuleRecord(context, entry, record) {
  const updatedTitle = `${record.title} updated`;
  const updated = await jsonRequest(context.request, 'POST', `/core/modules/${entry.moduleKey}/records/${record.id}`, {
    folderId: record.folderId,
    title: updatedTitle,
    status: 'Validated',
    startOn: record.startOn,
    dueOn: record.dueOn,
    reviewOn: record.reviewOn,
    expiresOn: record.expiresOn,
    data: {
      ...record.data,
      title: updatedTitle,
      name: updatedTitle,
      validationMarker: RUN_ID,
      validationStatus: 'updated',
    },
    links: record.links,
    note: `${MARKER} updated through API before UI verification.`,
  });
  assert(updated?.data?.title === updatedTitle, `Unable to update ${entry.moduleKey} fixture.`);
  return updated.data;
}

async function validateModuleDirectory(page, modules) {
  await page.goto(absoluteUrl('/modules'));
  await waitForSettledPage(page);
  const bodyText = await page.locator('body').innerText({ timeout: 12000 });
  const normalizedBody = bodyText.toLowerCase();
  assert(bodyText.includes('Tenant Module Directory'), 'Module directory heading was not visible.');
  for (const entry of modules) {
    assert(bodyText.includes(entry.pluralName), `Module directory missing ${entry.pluralName}.`);
    assert(
      normalizedBody.includes(entry.coverageBadge.toLowerCase()),
      `Module directory missing coverage badge for ${entry.moduleKey}.`,
    );
    assert(bodyText.includes(entry.primaryAction), `Module directory missing primary action for ${entry.moduleKey}.`);
  }
  for (const label of ['Shared Workspace', 'Dedicated Workspace', 'Template Workspace', 'Subfeature']) {
    assert(bodyText.includes(label), `Module directory missing implementation type label: ${label}.`);
  }
}

async function validateModuleRecordInUi(page, record) {
  await page.goto(absoluteUrl(`/modules/${record.moduleKey}`));
  await waitForSettledPage(page);
  await page.getByRole('textbox', { name: /^Search$/i }).fill(record.title);
  await page.getByText(record.title, { exact: false }).first().waitFor({ state: 'visible', timeout: 12000 });
  await page.getByText(record.title, { exact: false }).first().click();
  await page.getByText('Record Detail', { exact: false }).waitFor({ state: 'visible', timeout: 12000 });
  await page.getByText('Builder and reporting hooks', { exact: false }).waitFor({ state: 'visible', timeout: 12000 });
  await page.getByText('Linked records and evidence', { exact: false }).waitFor({ state: 'visible', timeout: 12000 });
}

async function validateSharedModuleVisibility(page, records) {
  for (const record of records) {
    await validateModuleRecordInUi(page, record);
  }
}

async function exerciseAssetUiCreateEditArchive(page, context) {
  const assetId = `ASSET-${RUN_ID}`;
  const title = `${MARKER} UI Asset`;

  await page.goto(absoluteUrl('/modules/assets'));
  await waitForSettledPage(page);
  await page.getByRole('button', { name: /New Asset/i }).click();
  await page.locator('.eyebrow').filter({ hasText: 'Create Record' }).waitFor({ state: 'visible', timeout: 12000 });
  await page.getByLabel(/Asset ID/i).fill(assetId);
  await page.getByLabel(/^Name/i).fill(title);
  await page.getByLabel(/^Type/i).selectOption({ label: 'Application' }).catch(async () => {
    await page.getByLabel(/^Type/i).selectOption('Application');
  });
  await page.getByLabel(/Owner/i).fill('Regovise E2E Owner').catch(() => undefined);
  await page.getByLabel(/Custodian/i).fill('Regovise E2E Custodian').catch(() => undefined);
  await page.getByLabel(/Classification/i).selectOption({ label: 'Confidential' }).catch(async () => {
    await page.getByLabel(/Classification/i).selectOption('Confidential');
  });
  await page.getByLabel(/Platform/i).fill('Regovise production validation');
  await page.getByLabel(/Location/i).fill('regovise.com');
  await page.getByLabel(/Purchase Date/i).fill(todayIso(0));
  await page.getByLabel(/End of Life Date/i).fill(todayIso(180));
  await page.getByLabel(/Description/i).fill(`${MARKER} browser-created asset used to verify the tenant-facing shared module workspace.`);
  await page.getByRole('button', { name: /Add link/i }).click();
  await page.getByLabel(/Relationship/i).last().fill('evidence');
  await page.getByLabel(/^Label$/i).last().fill(`${MARKER} evidence link`);
  await page.getByLabel(/^Route$/i).last().fill('/evidence-management');
  await page.getByLabel(/Activity note/i).fill(`${MARKER} Playwright created this asset through the UI.`);
  await page.getByRole('button', { name: /^Create Record$/i }).click();
  await page.getByText('Asset record created.', { exact: false }).waitFor({ state: 'visible', timeout: 15000 });

  const createdRecords = await jsonRequest(
    context.request,
    'GET',
    `/core/modules/assets/records?q=${encodeURIComponent(title)}&includeArchived=true`,
  );
  const created = asArray(createdRecords?.data?.records).find((record) => record.title === title);
  assert(created?.id, 'Unable to find the UI-created asset for cleanup tracking.');
  trackModuleRecord('assets', created);

  await page.getByRole('textbox', { name: /^Search$/i }).fill(title);
  await page.getByText(title, { exact: false }).first().click();
  const detailPanel = page.locator('section.panel').filter({ hasText: 'Record Detail' }).filter({ hasText: title }).first();
  await detailPanel.waitFor({ state: 'visible', timeout: 12000 });
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  const recordStatusInput = detailPanel.locator('label').filter({ hasText: 'Record status' }).locator('input').first();
  await recordStatusInput.fill('Validated');
  assert(await recordStatusInput.inputValue() === 'Validated', 'Record status input could not be edited before save.');
  const activityNoteInput = detailPanel.locator('label').filter({ hasText: 'Activity note' }).locator('textarea').first();
  await activityNoteInput.fill(`${MARKER} Playwright edited this asset through the UI.`);
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: /Save Changes/i }).click();
  await page.getByText('Asset record updated.', { exact: false }).waitFor({ state: 'visible', timeout: 15000 });
  const editedRecords = await jsonRequest(
    context.request,
    'GET',
    `/core/modules/assets/records?q=${encodeURIComponent(title)}&includeArchived=true`,
  );
  const edited = asArray(editedRecords?.data?.records).find((record) => record.id === created.id);
  assert(edited?.status === 'Validated', 'UI-edited asset status was not persisted as Validated.');

  await page.getByRole('button', { name: /^Archive$/i }).click();
  await page.getByText('Asset record archived.', { exact: false }).waitFor({ state: 'visible', timeout: 15000 });
  const archivedRecords = await jsonRequest(
    context.request,
    'GET',
    `/core/modules/assets/records?q=${encodeURIComponent(title)}&includeArchived=true`,
  );
  const archived = asArray(archivedRecords?.data?.records).find((record) => record.id === created.id);
  assert(archived?.archived === true, 'UI-archived asset was not persisted as archived.');

  return { title, id: created.id };
}

async function validateSeededOperationalContent(page) {
  const checks = [
    { path: '/framework-library', text: /SOC|NIST|Framework|Catalog/i },
    { path: '/findings', text: /Finding|github|wiz|inspector/i },
    { path: '/gap-assessments', text: /Gap|Assessment/i },
    { path: '/report-bundles', text: /Report|Bundle/i },
    { path: '/assessments', text: /Assessment|Manual|Compliance/i },
    { path: '/builders/questionnaire-builder', text: /Questionnaire|Assessment Plan|Template/i },
    { path: '/workspace/team', text: /User|Team|admin/i },
    { path: '/workspace/access', text: /Role|Access|Assignment/i },
    { path: '/reports', text: /Report|Export/i },
    { path: '/trust-center', text: /FedRAMP|Trust|Provider/i },
    { path: '/assurance', text: /Assurance|Evidence|Readiness/i },
  ];

  for (const check of checks) {
    await page.goto(absoluteUrl(check.path));
    await waitForSettledPage(page);
    const bodyText = await page.locator('body').innerText({ timeout: 12000 });
    assert(check.text.test(bodyText), `${check.path} did not show seeded/expected product content.`);
  }
}

async function validateOpsIndexes(context, page, createdRecords) {
  const activeTitles = createdRecords.map((record) => record.title);
  const [overviewPayload, workbenchPayload, newsPayload] = await Promise.all([
    jsonRequest(context.request, 'GET', '/ops/parity/overview'),
    jsonRequest(context.request, 'GET', '/ops/workbench'),
    jsonRequest(context.request, 'GET', '/ops/news-feed'),
  ]);

  const overviewText = JSON.stringify(overviewPayload?.data ?? {});
  const workbenchText = JSON.stringify(workbenchPayload?.data ?? {});
  const newsMetrics = newsPayload?.data?.metrics ?? {};
  assert(activeTitles.some((title) => overviewText.includes(title)), 'Ops parity overview did not include created module records.');
  assert(activeTitles.some((title) => workbenchText.includes(title)), 'Workbench snapshot did not include created module records.');
  assert(typeof newsMetrics.totalEvents === 'number', 'News feed snapshot did not load event metrics.');

  await page.goto(absoluteUrl('/search'));
  await waitForSettledPage(page);
  await page.getByPlaceholder(/Search modules/i).fill(MARKER);
  await page.getByText(MARKER, { exact: false }).first().waitFor({ state: 'visible', timeout: 12000 });

  await page.goto(absoluteUrl('/calendar'));
  await waitForSettledPage(page);
  const calendarText = await page.locator('body').innerText({ timeout: 12000 });
  assert(activeTitles.some((title) => calendarText.includes(title)), 'Calendar did not include created dated module records.');

  await page.goto(absoluteUrl('/workbench'));
  await waitForSettledPage(page);
  await page.getByLabel(/^Search$/i).fill(MARKER);
  await page.getByText(MARKER, { exact: false }).first().waitFor({ state: 'visible', timeout: 12000 });
}

async function validateTemplateAndAssessmentSurfaces(context, page, tenantContext) {
  const [templatesPayload, compliancePayload] = await Promise.all([
    jsonRequest(context.request, 'GET', '/builders/questionnaires'),
    jsonRequest(context.request, 'GET', '/core/compliance-assessments'),
  ]);
  const templates = asArray(templatesPayload?.data?.templates);
  const complianceAssessments = asArray(compliancePayload?.data);
  assert(templates.some((item) => item.templateKind === 'assessment-plan'), 'No seeded assessment-plan template was available.');
  assert(templates.some((item) => item.templateKind === 'questionnaire'), 'No seeded questionnaire template was available.');
  assert(tenantContext.frameworks.length > 0, 'No seeded catalogue/framework was available.');

  await page.goto(absoluteUrl('/assessment-plans'));
  await waitForSettledPage(page);
  await page.getByText('Assessment', { exact: false }).first().waitFor({ state: 'visible', timeout: 12000 });
  await page.goto(absoluteUrl('/questionnaires'));
  await waitForSettledPage(page);
  await page.getByText('Questionnaire', { exact: false }).first().waitFor({ state: 'visible', timeout: 12000 });
  await page.goto(absoluteUrl('/assessments'));
  await waitForSettledPage(page);
  const assessmentBody = await page.locator('body').innerText({ timeout: 12000 });
  assert(/manual|controls in scope|recurrence|lead assessor/i.test(assessmentBody), 'Assessment workspace did not expose manual workflow context.');
  assert(
    complianceAssessments.length > 0 || /create|launch/i.test(assessmentBody),
    'Assessment workspace did not show seeded assessments or a creation affordance.',
  );
}

async function validateBuilderSurfaces(page, modules) {
  const checks = [
    { path: '/builders/form-builder', marker: modules[0]?.pluralName ?? 'Assets' },
    { path: '/builders/export-builder', marker: 'Export' },
    { path: '/builders/report-builder', marker: 'Report' },
    { path: '/builders/dashboard-builder', marker: 'Dashboard' },
    { path: '/builders/rules-builder', marker: 'Rules' },
    { path: '/builders/wayfinder-builder', marker: 'Wayfinder' },
    { path: '/builders/questionnaire-builder', marker: 'Questionnaire' },
  ];

  for (const check of checks) {
    await page.goto(absoluteUrl(check.path));
    await waitForSettledPage(page);
    const bodyText = await page.locator('body').innerText({ timeout: 12000 });
    assert(bodyText.includes(check.marker), `${check.path} did not show ${check.marker}.`);
  }
}

async function validateIamMutation(context, page, tenantContext) {
  const email = `${RUN_ID}@example.invalid`.toLowerCase();
  const userPayload = await jsonRequest(context.request, 'POST', '/iam/users', {
    email,
    displayName: `${MARKER} Restricted User`,
    firstName: 'E2E',
    lastName: 'Restricted',
    keepLocalLogin: false,
    isThirdParty: false,
    isAuditee: false,
  });
  const user = userPayload?.data;
  assert(user?.id, 'IAM user creation failed.');
  trackArtifact({
    type: 'iam-user',
    id: user.id,
    title: email,
    route: '/workspace/team',
    cleanupMethod: 'delete',
    cleanup: async (cleanupContext) => {
      await jsonRequest(cleanupContext.request, 'DELETE', `/iam/users/${user.id}`, null, { allowStatuses: [404] });
    },
  });

  const groupPayload = await jsonRequest(context.request, 'POST', '/iam/user-groups', {
    name: `${MARKER} group`,
    description: `${MARKER} temporary E2E group.`,
    folderId: tenantContext.folder.id,
    memberUserIds: [user.id],
  });
  const group = groupPayload?.data;
  assert(group?.id, 'IAM group creation failed.');
  trackArtifact({
    type: 'iam-group',
    id: group.id,
    title: group.name,
    route: '/workspace/team',
    cleanupMethod: 'delete',
    cleanup: async (cleanupContext) => {
      await jsonRequest(cleanupContext.request, 'DELETE', `/iam/user-groups/${group.id}`, null, { allowStatuses: [404] });
    },
  });

  const rolePayload = await jsonRequest(context.request, 'POST', '/iam/roles', {
    name: `${MARKER} reader role`,
    description: `${MARKER} read-only validation role.`,
    permissions: ['view_folder', 'view_framework', 'view_riskregister', 'view_evidence'],
  });
  const role = rolePayload?.data;
  assert(role?.id, 'IAM role creation failed.');
  trackArtifact({
    type: 'iam-role',
    id: role.id,
    title: role.name,
    route: '/workspace/access',
    cleanupMethod: 'delete',
    cleanup: async (cleanupContext) => {
      await jsonRequest(cleanupContext.request, 'DELETE', `/iam/roles/${role.id}`, null, { allowStatuses: [404] });
    },
  });

  const assignmentPayload = await jsonRequest(context.request, 'POST', '/iam/role-assignments', {
    roleId: role.id,
    groupId: group.id,
    scopeFolderId: tenantContext.folder.id,
    isRecursive: true,
  });
  const assignment = assignmentPayload?.data;
  assert(assignment?.id, 'IAM role assignment creation failed.');
  assert(
    !asArray(assignment.permissions).some((permission) =>
      ['add_user', 'change_user', 'delete_user', 'add_role', 'change_role', 'delete_role'].includes(permission),
    ),
    'Restricted validation assignment unexpectedly includes administrator permissions.',
  );
  trackArtifact({
    type: 'iam-role-assignment',
    id: assignment.id,
    title: `${role.name} -> ${group.name}`,
    route: '/workspace/access',
    cleanupMethod: 'delete',
    cleanup: async (cleanupContext) => {
      await jsonRequest(cleanupContext.request, 'DELETE', `/iam/role-assignments/${assignment.id}`, null, { allowStatuses: [404] });
    },
  });

  await page.goto(absoluteUrl('/workspace/team'));
  await waitForSettledPage(page);
  await page.getByText(email, { exact: false }).first().waitFor({ state: 'visible', timeout: 12000 });
  await page.goto(absoluteUrl('/workspace/access'));
  await waitForSettledPage(page);
  await page.locator('tbody tr').filter({ hasText: role.name }).first().waitFor({ state: 'visible', timeout: 12000 });
  await page.locator('tbody tr').filter({ hasText: group.name }).first().waitFor({ state: 'visible', timeout: 12000 });
}

async function verifyNoActiveModuleResidue(context) {
  const moduleArtifacts = report.artifacts.filter((item) => item.type === 'module-record');
  const moduleKeys = [...new Set(moduleArtifacts.map((item) => item.route.match(/\/modules\/([^?]+)/)?.[1]).filter(Boolean))];
  const activeResidues = [];
  for (const moduleKey of moduleKeys) {
    const payload = await jsonRequest(
      context.request,
      'GET',
      `/core/modules/${moduleKey}/records?q=${encodeURIComponent(MARKER)}`,
    );
    const activeRecords = asArray(payload?.data?.records).filter((record) => !record.archived && JSON.stringify(record).includes(RUN_ID));
    activeResidues.push(...activeRecords.map((record) => ({ moduleKey, id: record.id, title: record.title })));
  }
  assert(activeResidues.length === 0, `Active test-owned module records remain: ${JSON.stringify(activeResidues)}`);
  return { checkedModules: moduleKeys.length, activeResidues: activeResidues.length };
}

async function verifyNoIamResidue(context) {
  const [usersPayload, groupsPayload, rolesPayload, assignmentsPayload] = await Promise.all([
    jsonRequest(context.request, 'GET', '/iam/users'),
    jsonRequest(context.request, 'GET', '/iam/user-groups'),
    jsonRequest(context.request, 'GET', '/iam/roles'),
    jsonRequest(context.request, 'GET', '/iam/role-assignments'),
  ]);
  const residues = [
    ...asArray(usersPayload?.data).filter((item) => JSON.stringify(item).includes(RUN_ID)).map((item) => ({ type: 'user', id: item.id })),
    ...asArray(groupsPayload?.data).filter((item) => JSON.stringify(item).includes(RUN_ID)).map((item) => ({ type: 'group', id: item.id })),
    ...asArray(rolesPayload?.data).filter((item) => JSON.stringify(item).includes(RUN_ID)).map((item) => ({ type: 'role', id: item.id })),
    ...asArray(assignmentsPayload?.data).filter((item) => JSON.stringify(item).includes(RUN_ID)).map((item) => ({ type: 'assignment', id: item.id })),
  ];
  assert(residues.length === 0, `IAM test-owned residues remain: ${JSON.stringify(residues)}`);
  return { activeResidues: residues.length };
}

async function cleanupArtifacts(context) {
  for (const artifact of cleanupStack.reverse()) {
    const startedAt = new Date().toISOString();
    const cleanupResult = {
      type: artifact.type,
      id: artifact.id,
      title: artifact.title,
      method: artifact.cleanupMethod,
      startedAt,
      finishedAt: null,
      ok: false,
    };
    report.cleanup.push(cleanupResult);
    try {
      await artifact.cleanup(context);
      cleanupResult.ok = true;
      artifact.cleanupStatus = 'complete';
    } catch (error) {
      cleanupResult.error = error instanceof Error ? error.message : String(error);
      artifact.cleanupStatus = 'failed';
      report.failures.push({
        suite: 'cleanup',
        check: `${artifact.type}:${artifact.id}`,
        message: cleanupResult.error,
      });
    } finally {
      cleanupResult.finishedAt = new Date().toISOString();
    }
  }
}

async function writeReport() {
  report.finishedAt = new Date().toISOString();
  report.ok = report.failures.length === 0;
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(RESULT_PATH, JSON.stringify(report, null, 2));
}

async function main() {
  if (!ALLOW_MUTATIONS && !READ_ONLY) {
    throw new Error(
      'Comprehensive production E2E validation mutates test-owned records. Set E2E_ALLOW_PRODUCTION_MUTATIONS=1 and LIVE_VALIDATION_ALLOW_MUTATIONS=1, or set E2E_READ_ONLY=1 for route/read-only validation.',
    );
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: HEADLESS, slowMo: SLOW_MO });
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 1100 },
    ignoreHTTPSErrors: false,
  });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  activePage = page;
  wireDiagnostics(page);

  let modules = [];
  let tenantContext = null;
  let createdModuleRecords = [];

  try {
    const preflight = makeSuite('preflight');
    await runCheck(preflight, 'bootstrap admin session', () => bootstrapSession(context), { critical: true });
    modules = await runCheck(preflight, 'load scale module catalog', () => loadLiveCatalog(context), { critical: true }) ?? [];
    tenantContext = await runCheck(preflight, 'load seeded tenant context', () => loadTenantContext(context), { critical: true });
    finishSuite(preflight);

    const routeSweep = makeSuite('all-route sweep');
    const routeChecks = [
      ...ROUTE_CHECKS,
      ...modules.map((entry) => ({
        group: 'scale-modules',
        path: entry.canonicalRoute,
        expectAny: [entry.pluralName, entry.moduleName],
      })),
      ...SHARED_MODULE_ALIAS_ROUTES.map((entry) => ({
        group: 'module-aliases',
        path: entry.route,
        expectAny: [entry.moduleKey.replace(/-/g, ' '), 'Record', 'Module'],
      })),
    ];
    const visitedRoutes = new Set();
    for (const routeCheck of routeChecks) {
      if (visitedRoutes.has(routeCheck.path)) continue;
      visitedRoutes.add(routeCheck.path);
      await runCheck(routeSweep, routeCheck.path, () => validateRoute(page, routeCheck));
    }
    routeSweep.routeCount = visitedRoutes.size;
    finishSuite(routeSweep);

    const seededData = makeSuite('seeded data and module directory');
    await runCheck(seededData, 'module directory contract', () => validateModuleDirectory(page, modules));
    await runCheck(seededData, 'seeded operational content', () => validateSeededOperationalContent(page));
    await runCheck(seededData, 'template and assessment surfaces', () => validateTemplateAndAssessmentSurfaces(context, page, tenantContext));
    await runCheck(seededData, 'builder surfaces', () => validateBuilderSurfaces(page, modules));
    finishSuite(seededData);

    if (READ_ONLY) {
      report.skips.push({
        suite: 'mutation flows',
        reason: 'E2E_READ_ONLY=1 was set; no production artifacts were created.',
      });
    } else {
      const mutations = makeSuite('test-owned mutation flows');
      const sharedModules = modules.filter((entry) => entry.implementationType === 'shared-workspace');
      createdModuleRecords = await runCheck(mutations, 'create shared module fixtures', async () => {
        const records = [];
        for (const entry of sharedModules) {
          records.push(await createModuleRecordFixture(context, entry, tenantContext.folder.id));
        }
        return records;
      }, { critical: true }) ?? [];

      await runCheck(mutations, 'update representative shared modules', async () => {
        const updated = [];
        for (const moduleKey of SHARED_MODULE_MUTATION_KEYS) {
          const entry = modules.find((item) => item.moduleKey === moduleKey);
          const record = createdModuleRecords.find((item) => item.moduleKey === moduleKey);
          if (entry && record) {
            updated.push(await updateRepresentativeModuleRecord(context, entry, record));
          }
        }
        return { updated: updated.length };
      });

      await runCheck(mutations, 'shared module UI list detail search', () => validateSharedModuleVisibility(page, createdModuleRecords));
      await runCheck(mutations, 'asset UI create edit archive', () => exerciseAssetUiCreateEditArchive(page, context));
      await runCheck(mutations, 'ops search calendar workbench report hooks', () => validateOpsIndexes(context, page, createdModuleRecords));
      await runCheck(mutations, 'IAM role user permission lifecycle', () => validateIamMutation(context, page, tenantContext));
      finishSuite(mutations);
    }
  } finally {
    const cleanupSuite = makeSuite('cleanup verification');
    if (!READ_ONLY) {
      await runCheck(cleanupSuite, 'cleanup tracked artifacts', () => cleanupArtifacts(context));
      await runCheck(cleanupSuite, 'verify no active module residue', () => verifyNoActiveModuleResidue(context));
      await runCheck(cleanupSuite, 'verify no IAM residue', () => verifyNoIamResidue(context));
    } else {
      report.skips.push({
        suite: 'cleanup verification',
        reason: 'Read-only run did not create cleanup artifacts.',
      });
    }
    finishSuite(cleanupSuite);
    await context.tracing.stop({ path: TRACE_PATH }).catch(() => undefined);
    await browser.close();
    await writeReport();
  }

  if (report.failures.length > 0) {
    const message = [
      `Regovise production E2E validation failed with ${report.failures.length} failure(s).`,
      `Result report: ${RESULT_PATH}`,
      ...report.failures.slice(0, 10).map((failure) => `- ${failure.suite} / ${failure.check}: ${failure.message}`),
    ].join('\n');
    throw new Error(message);
  }

  console.log(JSON.stringify({
    ok: true,
    runId: RUN_ID,
    resultPath: RESULT_PATH,
    tracePath: TRACE_PATH,
    routeChecks: report.suites.find((suite) => suite.name === 'all-route sweep')?.routeCount ?? 0,
    moduleCount: modules.length,
    createdArtifacts: report.artifacts.length,
    cleanupActions: report.cleanup.length,
    skips: report.skips,
  }, null, 2));
}

main().catch(async (error) => {
  await writeReport().catch(() => undefined);
  console.error(error);
  process.exit(1);
});
