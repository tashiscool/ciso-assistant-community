#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OPENREGSCALE_ROUTE_COMPATIBILITY,
  buildSemanticGapMatrix,
} from './semantic_gap_matrix.mjs';
import { buildFrontendBackendAlignment } from './frontend_backend_alignment_check.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRequire = createRequire(path.resolve(scriptDir, '../../frontend/package.json'));
const scaleMdPath = path.resolve(scriptDir, '../../features/scale.md');

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

const SCALE_MD_HEADING_IGNORES = new Set([
  'RegScale Manual Assessments Guide',
  'How to Perform a Manual Assessment in RegScale',
]);

const SCALE_MD_HEADING_TO_MODULE_KEY = new Map([
  ['Assets', 'assets'],
  ['Assessments', 'assessments'],
  ['Assessment Plans', 'assessment-plans'],
  ['Capabilities', 'capabilities'],
  ['Case Management', 'case-management'],
  ['Catalogues', 'catalogues'],
  ['Import Regscale Catalogs', 'import-regscale-catalogs'],
  ['Causal Analysis', 'causal-analysis'],
  ['Changes', 'changes'],
  ['Components', 'components'],
  ['Data Calls', 'data-calls'],
  ['Evidence Locker', 'evidence-locker'],
  ['Exceptions', 'exceptions'],
  ['Incidents', 'incidents'],
  ['Interconnections', 'interconnections'],
  ['Policies', 'policies'],
  ['Programs', 'programs'],
  ['Projects', 'projects'],
  ['Questionnaires', 'questionnaires'],
  ['Requirements', 'requirements'],
  ['Risks', 'risks'],
  ['Security Controls', 'security-controls'],
  ['Security Plans', 'security-plans'],
  ['Supply Chain', 'supply-chain'],
  ['Tasks', 'tasks'],
  ['Threats', 'threats'],
]);

const SCALE_MD_SEMANTIC_SURFACES = new Map([
  ['assessments', { implementationType: 'dedicated-workspace', semanticSurface: '/assessments' }],
  ['assessment-plans', { implementationType: 'template-workspace', semanticSurface: '/assessment-plans' }],
  ['catalogues', { implementationType: 'dedicated-workspace', semanticSurface: '/catalogues' }],
  ['import-regscale-catalogs', { implementationType: 'subfeature', semanticSurface: '/framework-library' }],
  ['questionnaires', { implementationType: 'template-workspace', semanticSurface: '/questionnaires' }],
]);

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
  { group: 'setup', path: '/setup', expectAny: ['Setup Launcher', 'Workspace Setup'] },
  { group: 'setup', path: '/setup/compliance-settings', expectAny: ['Catalog', 'Framework', 'Compliance'] },
  { group: 'setup', path: '/setup/file-system', expectAny: ['Evidence', 'Sources', 'File'] },
  { group: 'setup', path: '/setup/facilities', expectAny: ['Domains', 'Folders', 'Facilities'] },
  { group: 'setup', path: '/setup/cause-codes', expectAny: ['Risk Model', 'Cause'] },
  { group: 'setup', path: '/setup/security-policies', expectAny: ['Policies', 'Security'] },
  { group: 'setup', path: '/setup/user-management-roles/roles', expectAny: ['Access', 'Roles'] },
  { group: 'setup', path: '/setup/user-management-roles/mfa', expectAny: ['MFA', 'Multi'] },
  { group: 'setup', path: '/setup/user-management-roles', expectAny: ['Team', 'Users', 'Roles'] },
  { group: 'setup', path: '/setup/functional-roles', expectAny: ['Access', 'Roles'] },
  { group: 'setup', path: '/setup/email-settings', expectAny: ['Email'] },
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
  { group: 'builders', path: '/builders', expectAny: ['Builder Launcher', 'Builder Control Plane'] },
  { group: 'builders', path: '/builders/form-builder', expectAny: ['Form Builder', 'Form'] },
  { group: 'builders', path: '/builders/form-builder/user-guide', expectAny: ['Form Builder', 'Form'] },
  { group: 'builders', path: '/builders/form-builder/rules-guide', expectAny: ['Rules Builder', 'Rules'] },
  { group: 'builders', path: '/builders/export-builder', expectAny: ['Export Builder', 'Export'] },
  { group: 'builders', path: '/builders/export-builder/docx-template', expectAny: ['DOCX', 'Template'] },
  { group: 'builders', path: '/builders/export-builder/docx-template-guide', expectAny: ['DOCX', 'Template'] },
  { group: 'builders', path: '/builders/report-builder', expectAny: ['Report Builder', 'Report'] },
  { group: 'builders', path: '/builders/dashboard-builder', expectAny: ['Dashboard Builder', 'Dashboard'] },
  { group: 'builders', path: '/builders/rules-builder', expectAny: ['Rules Builder', 'Rules'] },
  { group: 'builders', path: '/builders/wayfinder-builder', expectAny: ['Wayfinder'] },
  { group: 'builders', path: '/builders/questionnaire-builder', expectAny: ['Questionnaire Builder', 'Questionnaire'] },
  { group: 'builders', path: '/builders/questionnaire-builder/overview', expectAny: ['Questionnaire', 'Overview'] },
  { group: 'features', path: '/features', expectAny: ['Feature Launcher', 'Feature Workspaces'] },
  { group: 'tprm', path: '/third-party', expectAny: ['Third', 'Vendor', 'Entity'] },
  { group: 'tprm', path: '/features/third-party-risk', expectAny: ['Third', 'Vendor', 'Entity'] },
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
  { group: 'ai', path: '/features/compliance-exports', expectAny: ['Compliance', 'Export'] },
  { group: 'ai', path: '/features/compliance-exports/emass', expectAny: ['eMASS', 'Export'] },
  { group: 'ai', path: '/features/compliance-exports/emass/hardware-software-list', expectAny: ['eMASS', 'Hardware', 'Software'] },
  { group: 'ai', path: '/features/compliance-exports/emass/poams', expectAny: ['eMASS', 'POA'] },
  { group: 'ai', path: '/features/compliance-exports/emass/ports-protocols', expectAny: ['eMASS', 'Ports', 'Protocols'] },
  { group: 'ai', path: '/features/compliance-exports/emass/sap-sar', expectAny: ['SAP', 'SAR', 'eMASS'] },
  { group: 'ai', path: '/features/compliance-exports/emass/slcm', expectAny: ['SLCM', 'eMASS'] },
  { group: 'ai', path: '/features/compliance-exports/fedramp', expectAny: ['FedRAMP', 'Export'] },
  { group: 'ai', path: '/features/compliance-exports/fedramp/cis-crm', expectAny: ['FedRAMP', 'CIS', 'CRM'] },
  { group: 'ai', path: '/features/compliance-exports/fedramp/inventory', expectAny: ['FedRAMP', 'Inventory'] },
  { group: 'ai', path: '/features/compliance-exports/fedramp/poams', expectAny: ['FedRAMP', 'POA'] },
  { group: 'ai', path: '/features/compliance-exports/fedramp/risk-exposure', expectAny: ['FedRAMP', 'Risk'] },
  { group: 'ai', path: '/features/compliance-exports/fedramp/test-case-procedures', expectAny: ['FedRAMP', 'Test'] },
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
  { group: 'conmon', path: '/features/continuous-monitoring', expectAny: ['ConMon', 'Continuous'] },
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

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  const retries = options.retries ?? (method === 'GET' ? 3 : 1);
  const allowedStatuses = options.allowStatuses ?? [];
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
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
      const retryableStatus = response.status() === 429 || response.status() >= 500;
      if (!response.ok() && !allowedStatuses.includes(response.status())) {
        const error = new Error(`${method} ${apiRoute(route)} failed with ${response.status()}: ${text.slice(0, 500)}`);
        if (attempt < retries && retryableStatus) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
          continue;
        }
        throw error;
      }
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
        continue;
      }
    }
  }

  throw lastError ?? new Error(`${method} ${apiRoute(route)} failed without a response.`);
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

async function loadScaleMdSemanticInventory() {
  const source = await fs.readFile(scaleMdPath, 'utf8');
  const headings = [...source.matchAll(/^#\s+(.+)$/gm)].map((match) => match[1].trim());
  const unmappedHeadings = [];
  const ignoredHeadings = [];
  const headingToModule = [];

  for (const heading of headings) {
    if (SCALE_MD_HEADING_IGNORES.has(heading)) {
      ignoredHeadings.push(heading);
      continue;
    }

    const moduleKey = SCALE_MD_HEADING_TO_MODULE_KEY.get(heading);
    if (!moduleKey) {
      unmappedHeadings.push(heading);
      continue;
    }
    headingToModule.push({ heading, moduleKey });
  }

  const sourceKeys = [...new Set(headingToModule.map((entry) => entry.moduleKey))].sort();
  const expectedKeys = [...EXPECTED_SCALE_MODULE_KEYS].sort();
  const missingFromHarness = sourceKeys.filter((key) => !expectedKeys.includes(key));
  const missingFromScaleMd = expectedKeys.filter((key) => !sourceKeys.includes(key));

  assert(unmappedHeadings.length === 0, `features/scale.md has unmapped top-level module headings: ${unmappedHeadings.join(', ')}`);
  assert(missingFromHarness.length === 0, `Production E2E harness is missing scale.md module keys: ${missingFromHarness.join(', ')}`);
  assert(missingFromScaleMd.length === 0, `Production E2E harness expects keys absent from scale.md: ${missingFromScaleMd.join(', ')}`);

  report.app.scaleMdSource = {
    path: scaleMdPath,
    topLevelHeadings: headings.length,
    ignoredGuideHeadings: ignoredHeadings.length,
    uniqueSemanticModules: sourceKeys.length,
    duplicateSemanticSections: headingToModule.length - sourceKeys.length,
    moduleKeys: sourceKeys,
  };

  return { headings, headingToModule, moduleKeys: sourceKeys };
}

async function validateScaleMdSemanticSurfaceCoverage(modules) {
  const routeChecks = new Set([
    ...ROUTE_CHECKS.map((entry) => entry.path),
    ...modules.map((entry) => entry.canonicalRoute),
    ...modules.map((entry) => entry.directRoute).filter(Boolean),
    ...SHARED_MODULE_ALIAS_ROUTES.map((entry) => entry.route),
  ]);

  for (const key of EXPECTED_SCALE_MODULE_KEYS) {
    const entry = modules.find((item) => item.moduleKey === key);
    assert(entry, `Live module catalog is missing scale.md semantic module ${key}.`);
    assert(entry.pluralName?.trim(), `${key} does not expose a tenant-facing product label.`);
    assert(entry.description?.trim(), `${key} does not expose a tenant-facing module summary.`);
    assert(entry.primaryAction?.trim(), `${key} does not expose a primary tenant action.`);
    assert(entry.coverageBadge?.trim(), `${key} does not expose a coverage badge.`);
    assert(asArray(entry.relatedModules).length > 0, `${key} does not expose related modules.`);
    assert(routeChecks.has(entry.canonicalRoute), `${key} canonical route is not included in the E2E route sweep: ${entry.canonicalRoute}`);

    const expectation = SCALE_MD_SEMANTIC_SURFACES.get(key);
    if (expectation) {
      assert(
        entry.implementationType === expectation.implementationType,
        `${key} should be ${expectation.implementationType}, found ${entry.implementationType}.`,
      );
      assert(
        entry.canonicalRoute === expectation.semanticSurface,
        `${key} should route to ${expectation.semanticSurface}, found ${entry.canonicalRoute}.`,
      );
      continue;
    }

    assert(entry.implementationType === 'shared-workspace', `${key} should use the shared workspace, found ${entry.implementationType}.`);
    assert(entry.canonicalRoute === `/modules/${key}`, `${key} should route through /modules/${key}, found ${entry.canonicalRoute}.`);
  }

  return {
    checkedModules: EXPECTED_SCALE_MODULE_KEYS.length,
    specialSemanticSurfaces: SCALE_MD_SEMANTIC_SURFACES.size,
    sharedWorkspaceModules: EXPECTED_SCALE_MODULE_KEYS.length - SCALE_MD_SEMANTIC_SURFACES.size,
  };
}

async function validateSemanticGapMatrix() {
  const matrix = await buildSemanticGapMatrix({ cwd: path.resolve(scriptDir, '../..') });
  assert(
    matrix.summary.scaleMdUnmappedHeadings === 0,
    `Semantic matrix has unmapped scale.md headings: ${matrix.sources.scaleMd.unmappedHeadings.join(', ')}`,
  );
  assert(
    matrix.summary.unresolvedRequired === 0,
    `Semantic matrix has unresolved required mappings: ${matrix.unresolvedRequired
      .map((entry) => entry.semanticKey ?? entry.sourceRoute ?? entry.canonicalRoute)
      .join(', ')}`,
  );
  report.app.semanticGapMatrix = {
    generatedAt: matrix.generatedAt,
    summary: matrix.summary,
    unresolvedRequired: matrix.unresolvedRequired,
  };
  return matrix.summary;
}

async function validateFrontendBackendAlignment() {
  const alignment = await buildFrontendBackendAlignment({ cwd: path.resolve(scriptDir, '../..') });
  assert(
    alignment.ok,
    `Frontend/backend alignment has unresolved gaps: ${alignment.alignment.unresolvedAlignmentGaps
      .map((entry) => `${entry.category}:${entry.route ?? entry.path ?? entry.service ?? entry.semanticKey ?? entry.reason}`)
      .join(', ')}`,
  );
  report.app.frontendBackendAlignment = {
    generatedAt: alignment.generatedAt,
    summary: alignment.summary,
    unresolvedAlignmentGaps: alignment.alignment.unresolvedAlignmentGaps,
  };
  return alignment.summary;
}

async function validateLiveSemanticAlignment(context) {
  const payload = await jsonRequest(context.request, 'GET', '/core/semantic-coverage');
  const data = payload?.data;
  assert(data?.ok === true, `Live semantic coverage endpoint is not healthy: ${JSON.stringify(data?.unresolvedRequired ?? [])}`);
  assert(data?.summary?.unresolvedRequired === 0, 'Live semantic coverage endpoint reports unresolved semantic mappings.');
  assert(data?.summary?.unresolvedAlignmentGaps === 0, 'Live semantic coverage endpoint reports unresolved alignment gaps.');
  const alignment = data?.alignment;
  assert(alignment, 'Live semantic coverage endpoint did not include alignment evidence.');
  for (const key of ['frontendRoutesCovered', 'frontendApiCallsCovered', 'backendHandlersCovered', 'permissionGatesCovered']) {
    assert(alignment[key] === true, `Live semantic alignment endpoint reports ${key}=false.`);
  }
  assert(
    !Array.isArray(alignment.unresolvedAlignmentGaps) || alignment.unresolvedAlignmentGaps.length === 0,
    `Live semantic alignment endpoint has unresolved gaps: ${JSON.stringify(alignment.unresolvedAlignmentGaps)}`,
  );
  report.app.liveSemanticAlignment = {
    generatedAt: data.generatedAt,
    summary: data.summary,
    alignmentSummary: alignment.summary,
  };
  return {
    semanticContracts: data.summary,
    alignment: alignment.summary,
  };
}

function semanticCompatibilityRouteChecks() {
  return OPENREGSCALE_ROUTE_COMPATIBILITY
    .filter((entry) => entry.required && entry.canonicalRoute && !entry.sourceRoute.includes('*') && entry.sourceRoute !== '/404')
    .map((entry) => ({
      group: `openregscale-${entry.group}`,
      path: entry.sourceRoute,
      expectAny: entry.expectAny,
    }));
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

function trackExportBuilderConfig(config) {
  return trackArtifact({
    type: 'export-builder-config',
    id: config.id,
    title: config.title,
    route: '/builders/export-builder',
    cleanupMethod: 'delete',
    cleanup: async (context) => {
      await jsonRequest(context.request, 'DELETE', `/builders/exports/${config.id}`, null, { allowStatuses: [404] });
    },
  });
}

function trackWayfinderTemplate(template) {
  return trackArtifact({
    type: 'wayfinder-template',
    id: template.id,
    title: template.title,
    route: '/builders/wayfinder-builder',
    cleanupMethod: 'delete',
    cleanup: async (context) => {
      await jsonRequest(context.request, 'DELETE', `/builders/wayfinders/${template.id}`, null, { allowStatuses: [404] });
    },
  });
}

function trackReportBuilderReport(reportDefinition) {
  return trackArtifact({
    type: 'report-builder-report',
    id: reportDefinition.id,
    title: reportDefinition.title,
    route: '/builders/report-builder',
    cleanupMethod: 'delete',
    cleanup: async (context) => {
      await jsonRequest(context.request, 'DELETE', `/builders/reports/${reportDefinition.id}`, null, { allowStatuses: [404] });
    },
  });
}

function trackReportExport(exportArtifact) {
  return trackArtifact({
    type: 'report-export',
    id: exportArtifact.id,
    title: exportArtifact.name ?? exportArtifact.artifactName ?? exportArtifact.id,
    route: '/reports',
    cleanupMethod: 'delete',
    cleanup: async (context) => {
      await jsonRequest(context.request, 'DELETE', `/ops/reports/exports/${exportArtifact.id}`, null, { allowStatuses: [404] });
    },
  });
}

function trackDashboardBuilderDashboard(dashboard) {
  return trackArtifact({
    type: 'dashboard-builder-dashboard',
    id: dashboard.id,
    title: dashboard.title,
    route: '/builders/dashboard-builder',
    cleanupMethod: 'delete',
    cleanup: async (context) => {
      await jsonRequest(context.request, 'DELETE', `/builders/dashboards/${dashboard.id}`, null, { allowStatuses: [404] });
    },
  });
}

function trackQuestionnaireTemplate(template) {
  return trackArtifact({
    type: 'questionnaire-builder-template',
    id: template.id,
    title: template.name ?? template.title ?? template.id,
    route: '/builders/questionnaire-builder',
    cleanupMethod: 'delete',
    cleanup: async (context) => {
      await jsonRequest(context.request, 'DELETE', `/builders/questionnaires/${template.id}`, null, { allowStatuses: [404] });
    },
  });
}

function trackQuestionnaireInstance(questionnaireId, instance) {
  return trackArtifact({
    type: 'questionnaire-instance',
    id: instance.id,
    title: instance.title,
    route: `/questionnaires/response/${instance.shareToken}`,
    cleanupMethod: 'delete',
    cleanup: async (context) => {
      await jsonRequest(
        context.request,
        'DELETE',
        `/builders/questionnaires/${questionnaireId}/instances/${instance.id}`,
        null,
        { allowStatuses: [404] },
      );
    },
  });
}

function formBuilderSavePayload(moduleDetail) {
  return {
    moduleName: moduleDetail.moduleName,
    pluralName: moduleDetail.pluralName,
    tabSort: moduleDetail.tabSort,
    status: moduleDetail.status,
    description: moduleDetail.description,
    sections: moduleDetail.sections,
    rules: moduleDetail.rules,
  };
}

async function restoreFormBuilderModule(context, moduleDetail) {
  await jsonRequest(
    context.request,
    'PUT',
    `/builders/forms/${moduleDetail.id}`,
    formBuilderSavePayload(moduleDetail),
    { retries: 3 },
  );
}

function trackFormBuilderSnapshot(moduleDetail) {
  const snapshot = deepClone(moduleDetail);
  return trackArtifact({
    type: 'form-builder-module-snapshot',
    id: snapshot.id,
    title: `${snapshot.moduleName} Form Builder snapshot`,
    route: `/builders/form-builder?moduleKey=${snapshot.moduleKey}`,
    cleanupMethod: 'restore',
    cleanup: async (context) => {
      await restoreFormBuilderModule(context, snapshot);
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
  for (const marker of [
    'Form Builder',
    'Rules Builder',
    'Export Builder',
    'Report Builder',
    'Dashboard Builder',
    'Questionnaire Builder',
    'Wayfinder Builder',
  ]) {
    await page.getByText(marker, { exact: false }).first().waitFor({ state: 'visible', timeout: 12000 });
  }
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
    await page.goto(absoluteUrl(check.path), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForSettledPage(page);
    const bodyText = await page.locator('body').innerText({ timeout: 12000 });
    assert(check.text.test(bodyText), `${check.path} did not show seeded/expected product content.`);
  }
}

async function validateConnectorLifecycleSemantics(context, page) {
  const providers = ['ad-ldap', 'slack', 'teams', 'tenable', 'webhook'];
  const created = [];

  try {
    for (const provider of providers) {
      const payload = await jsonRequest(context.request, 'POST', '/integrations/connectors', {
        name: `${MARKER} ${provider} connector`,
        provider,
      });
      const connector = payload?.data;
      assert(connector?.id, `${provider} connector was not created.`);
      created.push(connector);

      const testRun = await jsonRequest(context.request, 'POST', `/integrations/connectors/${connector.id}/test`);
      const testSummary = testRun?.data?.summary ?? {};
      assert(testRun?.data?.status === 'completed', `${provider} test did not complete.`);
      assert(Array.isArray(testSummary.lifecycle) && testSummary.lifecycle.length >= 4, `${provider} test did not expose lifecycle stages.`);
      assert(testSummary.credentialMetadata && typeof testSummary.credentialMetadata === 'object', `${provider} test did not expose credential metadata.`);
      assert(testSummary.dryRunSupported === true, `${provider} test did not expose dry-run support.`);
      assert(Array.isArray(testSummary.errorStates) && testSummary.errorStates.length > 0, `${provider} test did not expose error states.`);

      const syncRun = await jsonRequest(context.request, 'POST', `/integrations/connectors/${connector.id}/sync`);
      const syncSummary = syncRun?.data?.summary ?? {};
      assert(syncRun?.data?.status === 'completed', `${provider} sync did not complete.`);
      assert(syncSummary.dryRun === true, `${provider} sync did not run as a dry-run.`);
      assert(typeof syncSummary.syncStatus === 'string' && syncSummary.syncStatus.length > 0, `${provider} sync did not expose sync status.`);
      assert(Array.isArray(syncSummary.errorStates) && syncSummary.errorStates.length > 0, `${provider} sync did not expose error states.`);
    }

    await page.goto(absoluteUrl('/features/automation-manager'));
    await waitForSettledPage(page);
    const bodyText = await page.locator('body').innerText({ timeout: 12000 });
    for (const expected of ['AD/LDAP', 'Teams', 'Tenable', 'credential metadata', 'dry-run', 'error states']) {
      assert(bodyText.toLowerCase().includes(expected.toLowerCase()), `Automation Manager UI did not mention ${expected}.`);
    }

    return {
      providers: providers.length,
      connectorsCreated: created.length,
    };
  } finally {
    for (const connector of created.reverse()) {
      await jsonRequest(
        context.request,
        'DELETE',
        `/integrations/connectors/${connector.id}`,
        null,
        { allowStatuses: [404] },
      ).then((payload) => {
        report.cleanup.push({
          type: 'integration-connector',
          id: connector.id,
          title: connector.name,
          method: 'delete',
          ok: payload?.data?.deleted !== false,
        });
      }).catch((error) => {
        report.cleanup.push({
          type: 'integration-connector',
          id: connector.id,
          title: connector.name,
          method: 'delete',
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
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
  await page.getByLabel(/^Search calendar$/i).fill(MARKER);
  await page.getByText(MARKER, { exact: false }).first().waitFor({ state: 'visible', timeout: 12000 });
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

async function validateCatalogueAndImportSurfaces(page) {
  await page.goto(absoluteUrl('/frameworks'));
  await waitForSettledPage(page);
  const cataloguesBody = await page.locator('body').innerText({ timeout: 12000 });
  assert(cataloguesBody.includes('Catalogues Workspace'), 'Catalogues dedicated workspace did not render.');
  assert(cataloguesBody.includes('Import RegScale Catalogs'), 'Import RegScale Catalogs subfeature was not visible.');
  assert(cataloguesBody.includes('Upload'), 'Catalogue upload import option was not visible.');
  assert(/Learn more|All packaged catalogues|No packaged catalogue snapshot/i.test(cataloguesBody), 'Import-from-system catalogue context was not visible.');

  await page.getByRole('button', { name: /^Upload$/i }).click();
  await page.getByText('Import from file', { exact: false }).waitFor({ state: 'visible', timeout: 12000 });
  await page.getByText('Select catalogue file', { exact: false }).waitFor({ state: 'visible', timeout: 12000 });

  await page.getByRole('button', { name: /Import RegScale Catalogs/i }).click();
  await page.getByText('Import from system', { exact: false }).waitFor({ state: 'visible', timeout: 12000 });
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

  await page.goto(absoluteUrl('/'));
  await waitForSettledPage(page);
  await page.locator('nav').evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  const shellText = await page.locator('body').innerText({ timeout: 12000 });
  const normalizedShellText = shellText.toLowerCase();
  for (const marker of [
    'Builders',
    'Form Builder',
    'Rules Builder',
    'Export Builder',
    'Report Builder',
    'Dashboard Builder',
    'Questionnaire Builder',
    'Wayfinder Builder',
  ]) {
    assert(normalizedShellText.includes(marker.toLowerCase()), `Main navigation did not expose ${marker}.`);
  }

  await page.goto(absoluteUrl('/builders/form-builder'));
  await waitForSettledPage(page);
  let builderText = await page.locator('body').innerText({ timeout: 12000 });
  for (const marker of [
    'Module Display Settings',
    'Section Layout',
    'Field Properties',
    'Field Type',
    'Active / Show',
    'Editable',
    'Validations',
    'Factory Reset',
    'Import',
    'Export',
  ]) {
    assert(builderText.toLowerCase().includes(marker.toLowerCase()), `Form Builder did not expose ${marker}.`);
  }
  await page.getByRole('button', { name: /Add Validation/i }).first().click();
  builderText = await page.locator('body').innerText({ timeout: 12000 });
  assert(builderText.includes('Constant value'), 'Form Builder validation value source was not visible.');
  assert(builderText.includes('Field reference'), 'Form Builder validation field-reference source was not visible.');

  await page.goto(absoluteUrl('/builders/rules-builder'));
  await waitForSettledPage(page);
  await page.getByRole('button', { name: /Add Rule/i }).click();
  let rulesText = await page.locator('body').innerText({ timeout: 12000 });
  for (const marker of [
    'Rules Builder',
    'Conditional Logic',
    'Active',
    'Conditions',
    'Actions',
    'Add Condition',
    'Add Action',
    'Select a field',
    'Constant value',
    'Field reference',
  ]) {
    assert(rulesText.toLowerCase().includes(marker.toLowerCase()), `Rules Builder did not expose ${marker}.`);
  }
  const actionTypeSelect = page
    .locator('select')
    .filter({ has: page.locator('option[value="SET_VALUE"]') })
    .last();
  await actionTypeSelect.selectOption('SET_VALUE');
  rulesText = await page.locator('body').innerText({ timeout: 12000 });
  assert(rulesText.includes('Bypass existing value'), 'Rules Builder did not expose SET_VALUE overwrite control.');
  assert(rulesText.includes('Allow external value'), 'Rules Builder did not expose SET_VALUE external override control.');
}

function buildE2EFormField(sectionId, displayName, systemName, fieldType, overrides = {}) {
  return {
    id: crypto.randomUUID(),
    displayName,
    systemName,
    fieldType,
    required: false,
    active: true,
    editable: true,
    helpText: `${MARKER} Form Builder lifecycle coverage field.`,
    pattern: null,
    min: null,
    max: null,
    selectType: null,
    sectionId,
    choices: [],
    validations: [],
    lockedType: false,
    ...overrides,
  };
}

function buildFormBuilderRuleLifecycleConfig(original) {
  const suffix = slug(RUN_ID).replace(/-/g, '_').slice(-16);
  const labels = {
    trigger: `E2E Trigger ${suffix}`,
    notes: `E2E Rule Notes ${suffix}`,
    auto: `E2E Auto Value ${suffix}`,
    locked: `E2E Locked Value ${suffix}`,
    due: `E2E Due Date ${suffix}`,
  };
  const fields = {
    trigger: `e2e_${suffix}_trigger`,
    notes: `e2e_${suffix}_notes`,
    auto: `e2e_${suffix}_auto`,
    locked: `e2e_${suffix}_locked`,
    due: `e2e_${suffix}_due`,
  };
  const fieldNameSet = new Set(Object.values(fields));
  const sections = deepClone(original.sections).map((section) => ({
    ...section,
    fields: asArray(section.fields).filter((field) => !fieldNameSet.has(field.systemName)),
  }));
  const targetSectionIndex = Math.max(
    0,
    sections.findIndex((section) => section.active),
  );
  const section = sections[targetSectionIndex];
  section.fields = [
    ...asArray(section.fields),
    buildE2EFormField(section.id, labels.trigger, fields.trigger, 'Select', {
      choices: [
        { id: crypto.randomUUID(), label: 'Low', value: 'low', active: true },
        { id: crypto.randomUUID(), label: 'High', value: 'high', active: true },
      ],
    }),
    buildE2EFormField(section.id, labels.notes, fields.notes, 'Text Area', {
      active: false,
    }),
    buildE2EFormField(section.id, labels.auto, fields.auto, 'Text Field'),
    buildE2EFormField(section.id, labels.locked, fields.locked, 'Text Field'),
    buildE2EFormField(section.id, labels.due, fields.due, 'Date'),
  ];

  const autoValue = `${MARKER} server applied value`;
  const rules = [
    ...asArray(original.rules).filter((rule) => !String(rule.name || '').includes(RUN_ID)),
    {
      id: crypto.randomUUID(),
      name: `${MARKER} Form Builder live rule lifecycle`,
      active: true,
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: fields.trigger,
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'high',
        },
      ],
      actions: [
        { id: crypto.randomUUID(), actionType: 'SHOW', targetType: 'Field', target: fields.notes },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: fields.notes },
        {
          id: crypto.randomUUID(),
          actionType: 'SET_VALUE',
          targetType: 'Field',
          target: fields.auto,
          operator: 'EQUALS',
          value: autoValue,
          bypassExistingValue: true,
          allowExternalValue: false,
        },
        { id: crypto.randomUUID(), actionType: 'DISABLE', targetType: 'Field', target: fields.locked },
        {
          id: crypto.randomUUID(),
          actionType: 'VALIDATE',
          targetType: 'Field',
          target: fields.due,
          operator: 'WITHIN_NEXT',
          value: '30',
        },
      ],
    },
  ];

  return { suffix, labels, fields, sections, rules, autoValue };
}

function buildFormBuilderLifecycleAssetData(title, lifecycle) {
  return {
    title,
    name: title,
    asset_id: `ASSET-${lifecycle.suffix}`,
    type: 'Application',
    platform: 'Regovise production validation',
    location: 'regovise.com',
    custodian: 'Regovise E2E Custodian',
    classification: 'Confidential',
    status: 'Active',
    lifecycle_status: 'Active',
    inventory_status: 'Verified',
    purchase_date: todayIso(0),
    end_of_life_date: todayIso(180),
    description: `${MARKER} validates Form Builder live rules and Cloudflare API parity.`,
  };
}

async function validateFormBuilderRuleLifecycle(context, page, tenantContext) {
  const formsPayload = await jsonRequest(context.request, 'GET', '/builders/forms');
  const assetFormSummary = asArray(formsPayload?.data?.modules).find((module) => module.moduleKey === 'assets');
  assert(assetFormSummary?.id, 'Unable to find Assets Form Builder package.');
  const detailPayload = await jsonRequest(context.request, 'GET', `/builders/forms/${assetFormSummary.id}`);
  const original = detailPayload?.data;
  assert(original?.id, 'Unable to load Assets Form Builder detail.');
  trackFormBuilderSnapshot(original);

  const lifecycle = buildFormBuilderRuleLifecycleConfig(original);
  const patched = {
    ...deepClone(original),
    sections: lifecycle.sections,
    rules: lifecycle.rules,
  };

  try {
    const validationPayload = await jsonRequest(context.request, 'POST', `/builders/forms/${original.id}/validate`, {
      sections: patched.sections,
      rules: patched.rules,
    });
    const validationErrors = asArray(validationPayload?.data?.diagnostics).filter((diagnostic) => diagnostic.severity === 'error');
    assert(validationErrors.length === 0, `Injected Form Builder lifecycle config has validation errors: ${JSON.stringify(validationErrors)}`);

    await jsonRequest(context.request, 'PUT', `/builders/forms/${original.id}`, formBuilderSavePayload(patched));

    const title = `${MARKER} Form Builder Rule Asset`;
    const lowData = {
      ...buildFormBuilderLifecycleAssetData(title, lifecycle),
      [lifecycle.fields.trigger]: 'low',
      [lifecycle.fields.locked]: `${MARKER} original locked value`,
      [lifecycle.fields.due]: todayIso(10),
    };
    const createdPayload = await jsonRequest(context.request, 'POST', '/core/modules/assets/records', {
      folderId: tenantContext.folder.id,
      title,
      status: 'Active',
      data: lowData,
      note: `${MARKER} created for Form Builder rule lifecycle validation.`,
    });
    const created = createdPayload?.data;
    assert(created?.id, 'Form Builder lifecycle asset was not created.');
    trackModuleRecord('assets', created);
    assert(created.data?.[lifecycle.fields.locked] === lowData[lifecycle.fields.locked], 'Low-trigger create did not preserve editable value.');

    const invalidPayload = await jsonRequest(
      context.request,
      'POST',
      `/core/modules/assets/records/${created.id}`,
      {
        folderId: created.folderId,
        title,
        status: 'Active',
        data: {
          ...created.data,
          [lifecycle.fields.trigger]: 'high',
          [lifecycle.fields.notes]: '',
          [lifecycle.fields.locked]: `${MARKER} tampered locked value`,
          [lifecycle.fields.due]: todayIso(45),
        },
        note: `${MARKER} expected validation failure.`,
      },
      { allowStatuses: [400] },
    );
    assert(
      invalidPayload?.error === 'form_rule_validation_failed',
      'Cloudflare module-record update did not reject missing/invalid Form Builder rule data.',
    );
    const invalidDiagnostics = JSON.stringify(invalidPayload?.diagnostics ?? []);
    assert(
      invalidDiagnostics.includes(lifecycle.fields.notes) || invalidDiagnostics.includes(lifecycle.labels.notes),
      'Required rule diagnostic did not mention the conditional notes field.',
    );
    assert(
      invalidDiagnostics.includes(lifecycle.fields.due) || invalidDiagnostics.includes('WITHIN_NEXT'),
      'Validation rule diagnostic did not mention the conditional due date field.',
    );

    const validPayload = await jsonRequest(context.request, 'POST', `/core/modules/assets/records/${created.id}`, {
      folderId: created.folderId,
      title,
      status: 'Active',
      data: {
        ...created.data,
        [lifecycle.fields.trigger]: 'high',
        [lifecycle.fields.notes]: `${MARKER} required notes satisfied.`,
        [lifecycle.fields.locked]: `${MARKER} tampered locked value`,
        [lifecycle.fields.due]: todayIso(10),
      },
      note: `${MARKER} expected successful rule update.`,
    });
    const updated = validPayload?.data;
    assert(updated?.data?.[lifecycle.fields.auto] === lifecycle.autoValue, 'SET_VALUE rule did not apply in the Cloudflare API.');
    assert(
      updated?.data?.[lifecycle.fields.locked] === lowData[lifecycle.fields.locked],
      'DISABLE rule did not preserve the existing read-only field value in the Cloudflare API.',
    );

    const uiTitle = `${MARKER} Form Builder UI Asset`;
    await page.goto(absoluteUrl('/modules/assets'));
    await waitForSettledPage(page);
    await page.getByRole('button', { name: /New Asset/i }).click();
    await page.locator('.eyebrow').filter({ hasText: 'Create Record' }).waitFor({ state: 'visible', timeout: 12000 });
    const domainSelect = page.getByLabel(/^Domain$/i);
    if ((await domainSelect.inputValue().catch(() => '')) === '') {
      await domainSelect.selectOption({ index: 1 }).catch(() => undefined);
    }
    await page.getByLabel(/Asset ID/i).fill(`ASSET-UI-${lifecycle.suffix}`);
    await page.getByLabel(/^Name/i).fill(uiTitle);
    await page.getByLabel(/^Type/i).selectOption({ label: 'Application' }).catch(async () => {
      await page.getByLabel(/^Type/i).selectOption('Application');
    });
    await page.getByLabel(/Custodian/i).fill('Regovise E2E Custodian').catch(() => undefined);
    await page.getByLabel(/Classification/i).selectOption({ label: 'Confidential' }).catch(async () => {
      await page.getByLabel(/Classification/i).selectOption('Confidential');
    });
    await page.getByLabel(/Platform/i).fill('Regovise production validation');
    await page.getByLabel(/Location/i).fill('regovise.com');
    await page.getByLabel(/Purchase Date/i).fill(todayIso(0));
    await page.getByLabel(/End of Life Date/i).fill(todayIso(180));
    await page.getByLabel(/Description/i).fill(`${MARKER} browser-created asset validates live Form Builder runtime behavior.`);

    const triggerLabel = new RegExp(escapeRegExp(lifecycle.labels.trigger), 'i');
    const notesLabel = new RegExp(escapeRegExp(lifecycle.labels.notes), 'i');
    const autoLabel = new RegExp(escapeRegExp(lifecycle.labels.auto), 'i');
    const lockedLabel = new RegExp(escapeRegExp(lifecycle.labels.locked), 'i');
    const dueLabel = new RegExp(escapeRegExp(lifecycle.labels.due), 'i');

    await page.getByLabel(triggerLabel).selectOption('high');
    await page.getByLabel(notesLabel).waitFor({ state: 'visible', timeout: 12000 });
    const notesLabelText = await page.locator('label').filter({ hasText: lifecycle.labels.notes }).locator('span.label').first().innerText();
    assert(notesLabelText.includes('*'), 'Live rule did not mark the conditional notes field as required in the UI.');
    await page.waitForTimeout(500);
    assert(await page.getByLabel(lockedLabel).isDisabled(), 'Live DISABLE rule did not mark the locked field read-only in the UI.');
    assert(
      (await page.getByLabel(autoLabel).inputValue()) === lifecycle.autoValue,
      'Live SET_VALUE rule did not populate the auto field in the UI.',
    );
    await page.getByLabel(notesLabel).fill(`${MARKER} UI required notes satisfied.`);
    await page.getByLabel(dueLabel).fill(todayIso(45));
    await page.getByText(/Form Builder validation issue/i).waitFor({ state: 'visible', timeout: 12000 });
    await page.getByText(new RegExp(`${escapeRegExp(lifecycle.labels.due)} failed WITHIN_NEXT`, 'i')).waitFor({
      state: 'visible',
      timeout: 12000,
    });
    await page.getByLabel(dueLabel).fill(todayIso(10));
    await page.getByRole('button', { name: /^Create Record$/i }).click();
    await page.getByText('Asset record created.', { exact: false }).waitFor({ state: 'visible', timeout: 15000 });

    const uiCreatedPayload = await jsonRequest(
      context.request,
      'GET',
      `/core/modules/assets/records?q=${encodeURIComponent(RUN_ID)}&includeArchived=true`,
    );
    const uiCreated = asArray(uiCreatedPayload?.data?.records).find((record) => record.title === uiTitle);
    assert(uiCreated?.id, 'Unable to find UI-created Form Builder lifecycle asset.');
    trackModuleRecord('assets', uiCreated);
    assert(uiCreated.data?.[lifecycle.fields.auto] === lifecycle.autoValue, 'UI-created record did not persist SET_VALUE output.');

    const resetPayload = await jsonRequest(context.request, 'POST', `/builders/forms/${original.id}/reset`);
    const resetFields = asArray(resetPayload?.data?.sections).flatMap((section) =>
      asArray(section.fields).map((field) => ({ ...field, sectionActive: section.active, sectionName: section.displayName })),
    );
    const preserved = Object.values(lifecycle.fields).map((fieldName) => resetFields.find((field) => field.systemName === fieldName));
    assert(preserved.every(Boolean), 'Factory reset did not preserve injected custom fields.');
    assert(
      preserved.every((field) => field.active === false || field.sectionActive === false),
      'Factory reset preserved custom fields but did not deactivate them.',
    );

    return {
      apiRecordId: created.id,
      uiRecordId: uiCreated.id,
      checkedFields: Object.keys(lifecycle.fields).length,
    };
  } finally {
    await restoreFormBuilderModule(context, original);
  }
}

async function validateReportBuilderWorkflow(context, page) {
  const libraryPayload = await jsonRequest(context.request, 'GET', '/builders/reports');
  const seededReports = asArray(libraryPayload?.data?.reports);
  for (const title of ['Open POAM Aging Review', 'Residual Risk Heatmap', 'Control Coverage Summary']) {
    assert(seededReports.some((item) => item.title === title), `Report Builder missing seeded report: ${title}`);
  }
  const chartTypes = new Set(seededReports.map((item) => item.chartType));
  for (const chartType of ['List', 'Bar', 'Pie']) {
    assert(chartTypes.has(chartType), `Report Builder seeded reports missing ${chartType} coverage.`);
  }

  const createdPayload = await jsonRequest(context.request, 'POST', '/builders/reports', {
    title: `${MARKER} Report Builder`,
    owner: 'Regovise E2E Owner',
    chartType: 'List',
    module: 'Risks',
    description: `${MARKER} validates list reports, chart reports, filters, sorting, exports, sharing, and subscriptions.`,
  });
  const created = createdPayload?.data;
  assert(created?.id, 'Report Builder report creation failed.');
  trackReportBuilderReport(created);

  const listConfig = {
    reportTitle: created.title,
    chartType: 'List',
    module: 'Risks',
    groupBy: 'Status',
    aggregateField: 'Residual Risk',
    aggregationType: 'Count',
    selectedFields: ['Title', 'Status', 'Owner', 'Due Date', 'Severity'],
    displayFields: ['Title', 'Severity', 'Status', 'Owner', 'Due Date'],
    drillDownFields: ['Owner', 'Program'],
    sortingFields: ['Severity', 'Due Date'],
    filterLogic: '1 AND (2 OR 3)',
    filters: [
      { id: crypto.randomUUID(), field: 'Status', operator: 'Does Not Equal', value: 'Archived' },
      { id: crypto.randomUUID(), field: 'Due Date', operator: 'Next X Days', value: '90 days' },
      { id: crypto.randomUUID(), field: 'Owner', operator: 'Equals', value: 'Current User' },
    ],
  };
  const savedListPayload = await jsonRequest(context.request, 'PUT', `/builders/reports/${created.id}`, {
    title: created.title,
    chartType: 'List',
    module: 'Risks',
    owner: 'Regovise E2E Owner',
    status: 'Active',
    description: `${MARKER} active list report definition.`,
    config: listConfig,
  });
  const savedList = savedListPayload?.data;
  assert(savedList?.status === 'Active', 'Report Builder list report did not save as Active.');
  assert(JSON.stringify(savedList.config).includes('Current User'), 'Report Builder did not persist dynamic user filter.');
  assert(JSON.stringify(savedList.config).includes('Next X Days'), 'Report Builder did not persist relative date filter.');

  const listPreviewPayload = await jsonRequest(context.request, 'POST', `/builders/reports/${created.id}/preview`, {
    title: created.title,
    chartType: 'List',
    module: 'Risks',
    owner: 'Regovise E2E Owner',
    status: 'Active',
    description: savedList.description,
    config: listConfig,
  });
  const listPreview = listPreviewPayload?.data?.preview;
  assert(listPreview?.kind === 'table', 'Report Builder list preview did not return a table.');
  assert(asArray(listPreview.columns).includes('Severity'), 'Report Builder list preview missing selected display fields.');
  assert(listPreview.filterExpressionValid === true, 'Report Builder list preview did not validate filter logic.');

  const chartConfig = {
    ...listConfig,
    chartType: 'Bar',
    groupBy: 'Status',
    aggregateField: 'Residual Risk',
    aggregationType: 'Average',
    drillDownFields: ['Owner', 'Severity'],
  };
  await jsonRequest(context.request, 'PUT', `/builders/reports/${created.id}`, {
    title: created.title,
    chartType: 'Bar',
    module: 'Risks',
    owner: 'Regovise E2E Owner',
    status: 'Active',
    description: `${MARKER} active chart report definition.`,
    config: chartConfig,
  });
  const chartPreviewPayload = await jsonRequest(context.request, 'POST', `/builders/reports/${created.id}/preview`, {
    title: created.title,
    chartType: 'Bar',
    module: 'Risks',
    owner: 'Regovise E2E Owner',
    status: 'Active',
    description: `${MARKER} active chart report definition.`,
    config: chartConfig,
  });
  const chartPreview = chartPreviewPayload?.data?.preview;
  assert(chartPreview?.kind === 'series', 'Report Builder chart preview did not return a series.');
  assert(asArray(chartPreview.labels).length > 0, 'Report Builder chart preview did not return grouped labels.');

  const sharePayload = await jsonRequest(context.request, 'POST', `/builders/reports/${created.id}/share`, {
    recipients: ['security-ops@regovise.com', 'audit@regovise.com'],
  });
  assert(asArray(sharePayload?.data?.recipients).length === 2, 'Report Builder share did not record recipients.');

  const subscriptionPayload = await jsonRequest(context.request, 'POST', `/builders/reports/${created.id}/subscriptions`, {
    recipientEmail: `${slug(RUN_ID)}@regovise.example`,
    recipientType: 'user',
    startDate: todayIso(1),
    recurrenceType: 'Weekly',
  });
  const subscriptionId = subscriptionPayload?.data?.id;
  assert(subscriptionId, 'Report Builder subscription creation failed.');
  let detailPayload = await jsonRequest(context.request, 'GET', `/builders/reports/${created.id}`);
  assert(
    asArray(detailPayload?.data?.subscriptions).some((subscription) => subscription.id === subscriptionId),
    'Report Builder subscription was not visible in detail.',
  );
  await jsonRequest(context.request, 'DELETE', `/builders/reports/${created.id}/subscriptions/${subscriptionId}`);
  detailPayload = await jsonRequest(context.request, 'GET', `/builders/reports/${created.id}`);
  assert(
    !asArray(detailPayload?.data?.subscriptions).some((subscription) => subscription.id === subscriptionId),
    'Report Builder subscription delete did not remove the subscription.',
  );

  const exportPayload = await jsonRequest(context.request, 'POST', `/builders/reports/${created.id}/export`);
  const exportResult = exportPayload?.data;
  assert(exportResult?.exportId && exportResult?.downloadPath, 'Report Builder export did not create a downloadable CSV artifact.');
  trackReportExport({
    id: exportResult.exportId,
    name: exportResult.artifactName,
  });

  const opsReportsPayload = await jsonRequest(context.request, 'GET', '/ops/reports');
  const catalog = asArray(opsReportsPayload?.data?.catalog);
  const exports = asArray(opsReportsPayload?.data?.exports);
  assert(catalog.some((item) => item.title === 'Create New Report'), 'Reports page catalog missing Create New Report entry.');
  assert(catalog.some((item) => item.title === created.title && item.source === 'Report Builder'), 'Reports catalog missing saved Report Builder definition.');
  assert(exports.some((item) => item.id === exportResult.exportId), 'Reports exports table missing Report Builder CSV artifact.');

  await page.goto(absoluteUrl('/reports'));
  await waitForSettledPage(page);
  let bodyText = await page.locator('body').innerText({ timeout: 12000 });
  assert(bodyText.includes('Create New Report'), 'Reports page did not expose Create New Report.');
  assert(bodyText.includes(created.title), 'Reports page did not list the saved Report Builder definition.');
  assert(bodyText.includes('Report Builder'), 'Reports page did not expose Report Builder source.');
  assert(bodyText.includes(`${created.title} CSV export`), 'Reports page did not list the generated Report Builder export.');

  await page.goto(absoluteUrl(`/builders/report-builder?reportId=${encodeURIComponent(created.id)}`));
  await waitForSettledPage(page);
  await page.waitForFunction(
    (title) => Array.from(document.querySelectorAll('input, textarea')).some((field) => field.value === title),
    created.title,
    { timeout: 12000 },
  );
  bodyText = await page.locator('body').innerText({ timeout: 12000 });
  for (const marker of [
    'Report Builder',
    'Create New Report',
    'Report Title',
    'Chart Type',
    'Select Fields',
    'Display Fields',
    'Sorting Fields',
    'Drill-Down Fields',
    'Filters',
    'Filter Logic',
    'Current User',
    'My Organization',
    'Next X Days',
    'Generate Report',
    'More Tools',
    'Share',
    'Subscriptions',
    'Export CSV',
    'Done',
  ]) {
    assert(bodyText.toLowerCase().includes(marker.toLowerCase()), `Report Builder UI did not expose ${marker}.`);
  }
  await page.getByRole('button', { name: /Generate Report/i }).first().click();
  await page.getByText('Preview generated from the canonical Report Builder service.', { exact: false })
    .waitFor({ state: 'visible', timeout: 15000 });

  return { reportId: created.id, exportId: exportResult.exportId };
}

async function validateExportBuilderWorkflow(context, page) {
  const listPayload = await jsonRequest(context.request, 'GET', '/builders/exports');
  const starters = asArray(listPayload?.data?.starterTemplates);
  const fieldCatalogText = JSON.stringify(listPayload?.data?.fieldCatalog ?? {});
  for (const title of [
    'LABS SSP',
    'DOE SSP',
    'CMMC SSP',
    'FedRAMP Rev 5 SSP',
    'FedRAMP Rev 5 SAP',
    'FedRAMP Rev 5 SAR',
    'FedRAMP Rev 5 Appendix Q',
    'FedRAMP Rev 5 Appendix A',
    'FedRAMP Rev 5 Separation of Duties Matrix',
  ]) {
    assert(starters.some((template) => template.title === title), `Export Builder missing starter template: ${title}`);
  }
  assert(fieldCatalogText.includes('Component Control Implementations'), 'Export Builder field catalog is missing component implementation data.');
  assert(fieldCatalogText.includes('DataObjects'), 'Export Builder field catalog is missing DataObjects.');

  const createdPayload = await jsonRequest(context.request, 'POST', '/builders/exports', {
    title: `${MARKER} Export Builder`,
    starterTemplateId: 'starter-fedramp-ssp',
  });
  const created = createdPayload?.data;
  assert(created?.id, 'Export Builder config creation failed.');
  trackExportBuilderConfig(created);

  const templateContent = [
    'System Name {{systemname}}',
    'Authorization Date {{authorizationDateYYYYMMDD}}',
    'Owner {{systemowner.name}}',
    'Control {{control_id}} {{control_title}}',
    'Component {{component.controlImplementation.status}}',
    'Component detail {{component.controlImplementation.statement}}',
    'DataObject {{dataObject.controlSummary}}',
    'Boundary {{authorization-boundaryfilename}}',
    'Checkbox {{checkboxYESNO}}',
    'Repeat {{control_id}}',
  ].join('\n');

  const analyzedPayload = await jsonRequest(
    context.request,
    'POST',
    `/builders/exports/${created.id}/analyze-template`,
    {
      fileName: `${slug(RUN_ID)}-export-builder.docx`,
      content: templateContent,
    },
    { retries: 3 },
  );
  const analyzed = analyzedPayload?.data;
  assert(analyzed?.templateAnalysis?.tagsFound >= 9, 'Template analysis did not extract DOCX placeholders.');
  assert(analyzed.templateAnalysis.repeatedTags >= 1, 'Template analysis did not detect repeated placeholders.');

  const remappedPayload = await jsonRequest(context.request, 'POST', `/builders/exports/${created.id}/auto-map`, {
    mappings: analyzed.mappings,
  }, { retries: 3 });
  const remapped = remappedPayload?.data;
  const mappings = asArray(remapped?.mappings).map((mapping) => {
    const tag = String(mapping.tag).toLowerCase();
    if (tag.includes('authorizationdate')) {
      return { ...mapping, renderType: 'Date (YYYY-MM-DD)', accepted: Boolean(mapping.fieldPath) };
    }
    if (tag.includes('checkbox')) {
      return { ...mapping, renderType: 'Checkbox YES/NO', accepted: true };
    }
    if (tag.includes('dataobject')) {
      return { ...mapping, renderType: 'DataObject Table', accepted: Boolean(mapping.fieldPath) };
    }
    if (tag.includes('statement')) {
      return { ...mapping, renderType: 'RTF / HTML', accepted: Boolean(mapping.fieldPath) };
    }
    return { ...mapping, accepted: Boolean(mapping.fieldPath) };
  });
  const mappingText = JSON.stringify(mappings);
  assert(mappingText.includes('Component.Control Implementation.Status'), 'Auto-map did not resolve component control implementation status.');
  assert(mappingText.includes('DataObject.Control Implementation Summary'), 'Auto-map did not resolve DataObject control summary.');

  const filterRows = [
    { id: crypto.randomUUID(), field: 'status', operator: 'Equals', value: 'Active' },
    { id: crypto.randomUUID(), field: 'owner', operator: 'Equals', value: 'Current User' },
    { id: crypto.randomUUID(), field: 'lastUpdated', operator: 'Within Last', value: '30 days' },
  ];
  const savedPayload = await jsonRequest(context.request, 'PUT', `/builders/exports/${created.id}`, {
    title: created.title,
    status: 'Active',
    module: 'Security Plans',
    exportGroup: 'E2E Export Builder',
    exportType: 'DOCX',
    description: `${MARKER} validates template upload, mapping, filters, subtemplates, and preview generation.`,
    templateFileName: analyzed.templateFileName,
    templateAnalysis: analyzed.templateAnalysis,
    mappings,
    filterRows,
    filterExpression: '1 AND (2 OR 3)',
    subTemplates: [],
  }, { retries: 3 });
  const saved = savedPayload?.data;
  assert(saved?.filterExpression === '1 AND (2 OR 3)', 'Export Builder did not persist advanced filter logic.');

  const subTemplatePayload = await jsonRequest(context.request, 'POST', `/builders/exports/${created.id}/sub-templates`, {
    title: `${MARKER} Appendix`,
    fileName: `${slug(RUN_ID)}-appendix.docx`,
    content: 'Appendix {{control_id}} {{control_title}} {{component.controlImplementation.status}}',
  }, { retries: 3 });
  const withSubTemplate = subTemplatePayload?.data;
  assert(asArray(withSubTemplate?.subTemplates).length === 1, 'DOCX sub-template was not created.');
  assert(
    JSON.stringify(withSubTemplate.subTemplates).includes('Component.Control Implementation.Status'),
    'Sub-template mappings did not include component implementation data.',
  );

  const importedPayload = await jsonRequest(context.request, 'POST', `/builders/exports/${created.id}/import-mappings`, {
    mappings: withSubTemplate.mappings,
    filterRows,
    filterExpression: '1 AND (2 OR 3)',
  }, { retries: 3 });
  assert(importedPayload?.data?.templateAnalysis?.mappedTags >= 1, 'Import Field Mappings did not validate compatible mappings.');

  const testPayload = await jsonRequest(context.request, 'POST', `/builders/exports/${created.id}/test`, {
    scenarioName: `${MARKER} SAP SAR preview`,
  });
  const testResult = testPayload?.data?.result;
  assert(testResult?.filterExpressionValid === true, 'Export Builder preview did not validate filter expression.');
  assert(testResult?.subTemplates === 1, 'Export Builder preview did not include sub-template count.');
  assert(asArray(testResult?.renderTypes).includes('Checkbox YES/NO'), 'Export Builder preview did not include checkbox render type.');
  assert(asArray(testResult?.dataSources).includes('DataObjects'), 'Export Builder preview did not include DataObject data source.');
  assert(testResult?.generatedArtifactName?.endsWith('.docx'), 'Export Builder preview did not produce a DOCX artifact name.');

  await page.goto(absoluteUrl('/builders/export-builder'));
  await waitForSettledPage(page);
  await page.getByPlaceholder(/Search exports/i).fill(MARKER);
  await page.getByText(created.title, { exact: false }).first().waitFor({ state: 'visible', timeout: 12000 });
  await page.getByText(created.title, { exact: false }).first().click();
  let bodyText = await page.locator('body').innerText({ timeout: 12000 });
  for (const marker of [
    'Create New Export',
    'Export Mappings',
    'Sub Templates',
    'Template Gallery',
    'Preview & Tests',
    'Auto Map Fields',
    'DataObject',
    'Component Control',
  ]) {
    assert(bodyText.toLowerCase().includes(marker.toLowerCase()), `Export Builder UI did not expose ${marker}.`);
  }
  await page.getByRole('tab', { name: /Export Mappings/i }).click();
  bodyText = await page.locator('body').innerText({ timeout: 12000 });
  for (const marker of [
    'Import Field Mappings',
    'Export Field Mappings',
    'Advanced Filters',
    'Filter Logic Expression',
    'Tag delimiter',
  ]) {
    assert(bodyText.toLowerCase().includes(marker.toLowerCase()), `Export Builder UI did not expose ${marker}.`);
  }
  await page.getByRole('tab', { name: /Template Gallery/i }).click();
  bodyText = await page.locator('body').innerText({ timeout: 12000 });
  for (const marker of ['DOE SSP', 'CMMC SSP', 'FedRAMP Rev 5 Appendix Q', 'Copy & Customize']) {
    assert(bodyText.includes(marker), `Export Builder template gallery missing ${marker}.`);
  }
  await page.getByRole('tab', { name: /Preview/i }).click();
  bodyText = await page.locator('body').innerText({ timeout: 12000 });
  assert(/generation\s+mode/i.test(bodyText), 'Export Builder preview did not expose generation diagnostics.');
  assert(/data\s+sources/i.test(bodyText), 'Export Builder preview did not expose data-source diagnostics.');

  await page.goto(absoluteUrl('/builders/export-builder/docx-template'));
  await waitForSettledPage(page);
  const guideText = await page.locator('body').innerText({ timeout: 12000 });
  for (const marker of [
    'Creating an Export Builder DOCX Template',
    '{{field_name}}',
    'Static table',
    'Repeating table',
    'Standard and Yes/No checkboxes',
    '{{authorizationDateYYYYMMDD}}',
    '{{authorization-boundaryimage}}',
  ]) {
    assert(guideText.includes(marker), `DOCX template guide missing ${marker}.`);
  }

  return { exportBuilderConfigId: created.id, mappedTags: testResult.mappedTags, subTemplates: testResult.subTemplates };
}

async function validateWayfinderBuilderWorkflow(context, page) {
  const listPayload = await jsonRequest(context.request, 'GET', '/builders/wayfinders');
  const seededTemplates = asArray(listPayload?.data?.templates);
  for (const title of [
    'RMF Authorization Wayfinder',
    'FedRAMP Readiness Wayfinder',
    'Internal Audit Preparation Wayfinder',
    'Annual Security Review Wayfinder',
  ]) {
    assert(seededTemplates.some((template) => template.title === title), `Wayfinder Builder missing seeded template: ${title}`);
  }

  const createdPayload = await jsonRequest(
    context.request,
    'POST',
    '/builders/wayfinders',
    {
      title: `${MARKER} Wayfinder`,
      owner: 'Regovise E2E Owner',
      description: `${MARKER} created to validate Wayfinder Builder templates.`,
    },
    { retries: 3 },
  );
  const created = createdPayload?.data;
  assert(created?.id, 'Wayfinder template creation failed.');
  trackWayfinderTemplate(created);

  const stages = [
    {
      id: crypto.randomUUID(),
      name: `${MARKER} Intake`,
      description: 'Collect scope and audit context before certification work starts.',
      activities: [
        {
          id: crypto.randomUUID(),
          title: `${MARKER} Confirm scope`,
          type: 'Manual Activity',
          description: 'Confirm certification scope, owner, deadline, and evidence sources.',
          link: '/modules/security-plans',
          documentationLinks: [
            {
              id: crypto.randomUUID(),
              label: 'Security Plan Workspace',
              url: '/modules/security-plans',
            },
            {
              id: crypto.randomUUID(),
              label: 'Internal Process Guide',
              url: 'https://regovise.com/builders/wayfinder-builder',
            },
          ],
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: `${MARKER} Evidence Review`,
      description: 'Track evidence refresh and final review tasks.',
      activities: [
        {
          id: crypto.randomUUID(),
          title: `${MARKER} Review evidence`,
          type: 'Evidence Activity',
          description: 'Review evidence freshness and route gaps to owners.',
          link: '/evidence-management',
          documentationLinks: [
            {
              id: crypto.randomUUID(),
              label: 'Evidence Workspace',
              url: '/evidence-management',
            },
          ],
        },
        {
          id: crypto.randomUUID(),
          title: `${MARKER} Approval checkpoint`,
          type: 'Approval Activity',
          description: 'Confirm certification readiness with the accountable owner.',
          link: '/workbench',
          documentationLinks: [
            {
              id: crypto.randomUUID(),
              label: 'Workbench',
              url: '/workbench',
            },
          ],
        },
      ],
    },
  ];

  const savedPayload = await jsonRequest(
    context.request,
    'PUT',
    `/builders/wayfinders/${created.id}`,
    {
      title: created.title,
      status: 'Active',
      owner: 'Regovise E2E Owner',
      description: `${MARKER} active Wayfinder with stages, activities, and documentation links.`,
      stages,
    },
    { retries: 3 },
  );
  const saved = savedPayload?.data;
  assert(saved?.status === 'Active', 'Wayfinder template did not save as Active.');
  assert(asArray(saved?.stages).length === 2, 'Wayfinder template did not persist two stages.');
  assert(
    JSON.stringify(saved.stages).includes('documentationLinks') && JSON.stringify(saved.stages).includes('Security Plan Workspace'),
    'Wayfinder template did not persist documentation links.',
  );

  const importedPayload = await jsonRequest(
    context.request,
    'POST',
    '/builders/wayfinders/import',
    {
      title: `${MARKER} Imported Wayfinder`,
      status: 'Draft',
      owner: 'Regovise E2E Owner',
      description: `${MARKER} imported as a new template from JSON.`,
      stages,
    },
    { retries: 3 },
  );
  const imported = importedPayload?.data;
  assert(imported?.id && imported.id !== created.id, 'Wayfinder import-as-new did not create a distinct template.');
  trackWayfinderTemplate(imported);

  await page.goto(absoluteUrl('/builders/wayfinder-builder'));
  await waitForSettledPage(page);
  await page.getByPlaceholder(/Search templates/i).fill(MARKER);
  const createdCard = page.locator('aside .panel-subtle').filter({ hasText: created.title }).filter({ hasText: 'ACTIVE' }).first();
  await createdCard.waitFor({ state: 'visible', timeout: 12000 });
  let bodyText = await page.locator('body').innerText({ timeout: 12000 });
  for (const marker of [
    'Template Selector',
    'New blank Wayfinder Template',
    'Import JSON as New',
    'Import Into Selected',
    'ID',
    'Creator',
    'Owner',
    'View',
    'Stage Builder',
    'Activities',
    'Documentation Links',
  ]) {
    assert(bodyText.toLowerCase().includes(marker.toLowerCase()), `Wayfinder Builder UI did not expose ${marker}.`);
  }

  await createdCard.getByRole('button', { name: /View/i }).click();
  await page.waitForFunction(
    (title) => Array.from(document.querySelectorAll('input, textarea'))
      .some((field) => field.value === title),
    created.title,
    { timeout: 12000 },
  );
  await page.getByText(`${MARKER} Intake`, { exact: false }).first().waitFor({ state: 'visible', timeout: 12000 });
  await page.getByText(`${MARKER} Confirm scope`, { exact: false }).first().waitFor({ state: 'visible', timeout: 12000 });
  await page.getByRole('button', { name: /Add Documentation Link/i }).first().waitFor({ state: 'visible', timeout: 12000 });
  for (const documentationLabel of [
    'Security Plan Workspace',
    'Internal Process Guide',
    'Evidence Workspace',
    'Workbench',
  ]) {
    await page.waitForFunction(
      (expectedLabel) => Array.from(document.querySelectorAll('input, textarea'))
        .some((field) => field.value === expectedLabel),
      documentationLabel,
      { timeout: 12000 },
    );
  }
  bodyText = await page.locator('body').innerText({ timeout: 12000 });
  assert(bodyText.includes('Manual Activity'), 'Wayfinder activity type was not visible.');
  assert(bodyText.includes('Evidence Activity'), 'Wayfinder evidence activity type was not visible.');

  return {
    templateId: created.id,
    importedTemplateId: imported.id,
    stages: saved.stages.length,
    activities: saved.stages.reduce((total, stage) => total + asArray(stage.activities).length, 0),
  };
}

async function validateDashboardBuilderWorkflow(context, page) {
  const listPayload = await jsonRequest(context.request, 'GET', '/builders/dashboards');
  const seededDashboards = asArray(listPayload?.data?.dashboards);
  assert(seededDashboards.some((item) => item.title === 'Security Operations Overview'), 'Dashboard Builder missing seeded Security Operations Overview.');
  assert(seededDashboards.some((item) => item.title === 'Audit Readiness Board'), 'Dashboard Builder missing seeded Audit Readiness Board.');

  const createdPayload = await jsonRequest(
    context.request,
    'POST',
    '/builders/dashboards',
    {
      title: `${MARKER} Dashboard Builder`,
      access: 'Private',
      groups: ['Regovise E2E Dashboard Group'],
    },
    { retries: 3 },
  );
  const created = createdPayload?.data;
  assert(created?.id, 'Dashboard Builder dashboard creation failed.');
  trackDashboardBuilderDashboard(created);

  const availableItems = asArray(created.availableItems).length > 0
    ? asArray(created.availableItems)
    : asArray(listPayload?.data?.availableItems);
  const widget = availableItems.find((item) => item.type === 'Widget' && item.tab === 'Widgets') ?? availableItems[0];
  const moduleWidget =
    availableItems.find((item) => item.tab === 'By Module' && item.templateId !== widget?.templateId) ??
    availableItems.find((item) => item.templateId !== widget?.templateId);
  assert(widget?.templateId && moduleWidget?.templateId, 'Dashboard Builder palette did not include enough widgets for layout validation.');

  const leftItem = { ...widget, instanceId: crypto.randomUUID(), column: 'left' };
  const rightItem = { ...moduleWidget, instanceId: crypto.randomUUID(), column: 'right' };
  const savedPayload = await jsonRequest(
    context.request,
    'PUT',
    `/builders/dashboards/${created.id}`,
    {
      title: `${MARKER} Dashboard Builder Updated`,
      access: 'Private',
      groups: ['Regovise E2E Dashboard Group', 'Audit Team'],
      items: [leftItem, rightItem],
      layout: {
        left: [leftItem.instanceId],
        right: [rightItem.instanceId],
      },
    },
    { retries: 3 },
  );
  const saved = savedPayload?.data;
  assert(saved?.items?.length === 2, 'Dashboard Builder layout did not persist two tiles.');
  assert(saved.layout?.left?.includes(leftItem.instanceId), 'Dashboard Builder left column layout was not persisted.');
  assert(saved.layout?.right?.includes(rightItem.instanceId), 'Dashboard Builder right column layout was not persisted.');

  const favoritedPayload = await jsonRequest(context.request, 'POST', `/builders/dashboards/${created.id}/favorite`, {}, { retries: 3 });
  assert(favoritedPayload?.data?.favorite === true, 'Dashboard Builder favorite action did not persist.');
  const publishedPayload = await jsonRequest(context.request, 'POST', `/builders/dashboards/${created.id}/publish`, {}, { retries: 3 });
  assert(publishedPayload?.data?.published === true, 'Dashboard Builder publish action did not persist.');

  const detailPayload = await jsonRequest(context.request, 'GET', `/builders/dashboards/${created.id}`);
  const detail = detailPayload?.data;
  assert(detail?.title === `${MARKER} Dashboard Builder Updated`, 'Dashboard Builder detail did not reflect saved title.');
  assert(detail?.access === 'Private', 'Dashboard Builder detail did not reflect private access level.');
  assert(asArray(detail?.groups).includes('Audit Team'), 'Dashboard Builder did not persist private group assignments.');

  await page.goto(absoluteUrl('/builders/dashboard-builder'));
  await waitForSettledPage(page);
  await page.getByPlaceholder(/Search dashboards/i).fill(MARKER);
  const dashboardCard = page
    .locator('aside button')
    .filter({ hasText: `${MARKER} Dashboard Builder Updated` })
    .first();
  await dashboardCard.waitFor({ state: 'visible', timeout: 12000 });
  await dashboardCard.click();
  let bodyText = await page.locator('body').innerText({ timeout: 12000 });
  for (const marker of [
    'Manage Dashboards',
    'Select Dashboard',
    'Create New Dashboard',
    'Dashboard Summary',
    'More Actions',
    'Preview Dashboard',
    '+ Left',
    '+ Right',
  ]) {
    assert(bodyText.toLowerCase().includes(marker.toLowerCase()), `Dashboard Builder UI did not expose ${marker}.`);
  }

  await page.getByRole('button', { name: /More Actions/i }).click();
  bodyText = await page.locator('body').innerText({ timeout: 12000 });
  for (const marker of ['Edit', 'Preview', 'Favorite', 'Delete']) {
    assert(bodyText.toLowerCase().includes(marker.toLowerCase()), `Dashboard Builder More Actions menu missing ${marker}.`);
  }
  await page.getByRole('button', { name: /^Preview$/i }).click();
  bodyText = await page.locator('body').innerText({ timeout: 12000 });
  assert(/publish\s+summary/i.test(bodyText), 'Dashboard Builder preview mode did not expose publish summary.');
  assert(/live\s+preview\s+tile/i.test(bodyText), 'Dashboard Builder preview mode did not expose live preview tiles.');

  return {
    dashboardId: created.id,
    tiles: detail.items.length,
    published: detail.published,
    favorite: detail.favorite,
  };
}

async function validateQuestionnaireBuilderWorkflow(context, page, tenantContext) {
  const listPayload = await jsonRequest(context.request, 'GET', '/builders/questionnaires');
  const seededTemplates = asArray(listPayload?.data?.templates);
  assert(seededTemplates.some((item) => item.name === 'Third-Party Security Review'), 'Questionnaire Builder missing seeded questionnaire template.');
  assert(seededTemplates.some((item) => item.name === 'Manual Control Assessment Plan'), 'Questionnaire Builder missing seeded assessment-plan template.');

  const createdPayload = await jsonRequest(
    context.request,
    'POST',
    '/builders/questionnaires',
    {
      name: `${MARKER} Questionnaire Builder`,
      description: `${MARKER} validates questionnaire creation, assignment, response, review, scoring, exports, public access, and cleanup.`,
      templateKind: 'questionnaire',
      audience: 'E2E respondents',
      ownerName: 'Regovise E2E Owner',
      ownerUserId: tenantContext.user.id,
      profile: 'E2E Control Profile',
      instructions: `${MARKER} complete every required prompt and attach evidence references.`,
      allowPublicUrl: true,
      loginRequired: false,
      enableScoring: true,
      enableQuestionAssignment: true,
    },
    { retries: 3 },
  );
  const createdDetail = createdPayload?.data;
  const template = createdDetail?.template;
  assert(template?.id, 'Questionnaire Builder template creation failed.');
  trackQuestionnaireTemplate(template);

  const questions = [
    {
      id: crypto.randomUUID(),
      ref: 'RISK_LEVEL',
      prompt: `${MARKER} What is the questionnaire risk level?`,
      type: 'single-select',
      section: 'Risk',
      required: true,
      weight: 30,
      maxScore: 30,
      options: ['Low', 'Moderate', 'High', 'Critical'],
      answerScores: { Low: 10, Moderate: 20, High: 30, Critical: 30 },
      helpText: 'Drives visual rule testing and scoring.',
      requirementRef: tenantContext.controls[0]?.id ?? 'AC-2',
      evidenceHint: 'Use seeded control context as a semantic mapping target.',
    },
    {
      id: crypto.randomUUID(),
      ref: 'HAS_EVIDENCE',
      prompt: `${MARKER} Has supporting evidence been provided?`,
      type: 'boolean',
      section: 'Evidence',
      required: true,
      weight: 20,
      maxScore: 20,
      enableUpload: true,
      helpText: 'Requires Manage Uploads support.',
      requirementRef: null,
      evidenceHint: 'Attach evidence references or upload notes.',
    },
    {
      id: crypto.randomUUID(),
      ref: 'REMEDIATION_DATE',
      prompt: `${MARKER} Target remediation date`,
      type: 'date',
      section: 'Schedule',
      required: true,
      weight: 10,
      maxScore: 10,
      helpText: 'Exercises date style responses and relative reporting fields.',
      requirementRef: null,
      evidenceHint: 'Capture follow-up schedule.',
    },
    {
      id: crypto.randomUUID(),
      ref: 'CONTACT_EMAIL',
      prompt: `${MARKER} Respondent contact email`,
      type: 'email',
      section: 'Respondent',
      required: true,
      weight: 10,
      maxScore: 10,
      requirementRef: null,
      evidenceHint: 'Tracks the respondent identity for review.',
    },
    {
      id: crypto.randomUUID(),
      ref: 'SUPPORTING_FILES',
      prompt: `${MARKER} Supporting file references`,
      type: 'file-upload',
      section: 'Evidence',
      required: false,
      weight: 0,
      maxScore: 0,
      enableUpload: true,
      requirementRef: null,
      evidenceHint: 'Manage Uploads accepts filenames, URLs, or artifact identifiers.',
    },
    {
      id: crypto.randomUUID(),
      ref: 'REVIEW_GUIDANCE',
      prompt: `${MARKER} Instructional guidance for reviewers`,
      type: 'instructional',
      section: 'Guidance',
      required: false,
      weight: 0,
      maxScore: 0,
      requirementRef: null,
      evidenceHint: 'Display-only guidance should not count against completion.',
    },
  ];

  const savedPayload = await jsonRequest(
    context.request,
    'PUT',
    `/builders/questionnaires/${template.id}`,
    {
      name: `${MARKER} Questionnaire Builder Updated`,
      description: `${MARKER} updated template with sections, question types, scoring, uploads, and public URL support.`,
      status: 'active',
      templateKind: 'questionnaire',
      audience: 'Internal and external E2E respondents',
      scoringMode: 'weighted',
      ownerName: 'Regovise E2E Owner',
      ownerUserId: tenantContext.user.id,
      profile: 'E2E Control Profile',
      instructions: `${MARKER} updated instructions for respondent workflow validation.`,
      allowPublicUrl: true,
      loginRequired: false,
      enableScoring: true,
      enableQuestionAssignment: true,
      questions,
    },
    { retries: 3 },
  );
  const savedTemplate = savedPayload?.data?.template;
  assert(savedTemplate?.name === `${MARKER} Questionnaire Builder Updated`, 'Questionnaire Builder template update did not persist title.');
  assert(asArray(savedTemplate.questions).length === questions.length, 'Questionnaire Builder did not persist all custom questions.');
  assert(savedTemplate.allowPublicUrl === true, 'Questionnaire Builder did not persist self-assignment URL flag.');
  assert(savedTemplate.enableQuestionAssignment === true, 'Questionnaire Builder did not persist per-question assignment flag.');

  const rules = [
    {
      id: crypto.randomUUID(),
      name: `${MARKER} Show evidence on high risk`,
      description: 'Show and enable evidence prompts for elevated risk.',
      logic: 'AND',
      active: true,
      conditions: ['Question "RISK_LEVEL" equals "High"'],
      actions: [
        'SHOW_QUESTIONS "SUPPORTING_FILES"',
        'ENABLE_QUESTIONS "SUPPORTING_FILES"',
        'ADD_TO_SCORE 5',
        'SET_GRADE "Needs Review"',
      ],
    },
    {
      id: crypto.randomUUID(),
      name: `${MARKER} Display score and grade`,
      description: 'Always expose score/grade display options in the questionnaire runtime.',
      logic: 'AND',
      active: true,
      conditions: ['NO_CONDITION'],
      actions: ['SET_DISPLAY_OPTIONS "displayscore=true;displaygrade=true"', 'SHOW_QUESTIONS "REVIEW_GUIDANCE"'],
    },
  ];

  const savedRulesPayload = await jsonRequest(
    context.request,
    'PUT',
    `/builders/questionnaires/${template.id}/rules`,
    { name: `${MARKER} Rule Set`, rules },
    { retries: 3 },
  );
  assert(asArray(savedRulesPayload?.data?.rules).length === rules.length, 'Questionnaire Builder rules were not saved.');
  const validatePayload = await jsonRequest(context.request, 'POST', `/builders/questionnaires/${template.id}/validate`, { questions, rules });
  assert(
    asArray(validatePayload?.data?.diagnostics).some((diagnostic) => diagnostic.severity === 'info'),
    'Questionnaire Builder validation did not return a passing diagnostic.',
  );
  const previewPayload = await jsonRequest(context.request, 'POST', `/builders/questionnaires/${template.id}/test-preview`, {
    scenarioName: `${MARKER} Preview`,
    draftQuestions: questions,
    draftRules: rules,
    answers: { RISK_LEVEL: 'High', HAS_EVIDENCE: true, REMEDIATION_DATE: todayIso(20), CONTACT_EMAIL: 'e2e@example.invalid' },
  });
  assert(asArray(previewPayload?.data?.result?.matchedRules).length >= 1, 'Questionnaire Builder preview did not execute visual rules.');
  const testRunPayload = await jsonRequest(context.request, 'POST', `/builders/questionnaires/${template.id}/test-runs`, {
    scenarioName: `${MARKER} Persisted Rule Test`,
    answers: { RISK_LEVEL: 'High', HAS_EVIDENCE: true, REMEDIATION_DATE: todayIso(20), CONTACT_EMAIL: 'e2e@example.invalid' },
  });
  assert(testRunPayload?.data?.status === 'completed', 'Questionnaire Builder persisted rule test did not complete.');

  const assignmentTypes = [
    {
      assignmentType: 'user',
      title: `${MARKER} User Assignment`,
      assigneeUserId: tenantContext.user.id,
      reviewerUserId: tenantContext.user.id,
      dueDate: todayIso(14),
    },
    {
      assignmentType: 'email',
      title: `${MARKER} Email Assignment`,
      assigneeEmail: `vendor-${RUN_ID}@example.invalid`,
      reviewerUserId: tenantContext.user.id,
      dueDate: todayIso(15),
    },
    {
      assignmentType: 'module',
      title: `${MARKER} Module Assignment`,
      assigneeUserId: tenantContext.user.id,
      reviewerUserId: tenantContext.user.id,
      parentModule: 'assets',
      parentRecordId: `asset-${RUN_ID}`,
      dueDate: todayIso(16),
    },
    {
      assignmentType: 'recurring',
      title: `${MARKER} Recurring Assignment`,
      assigneeEmail: `recurring-${RUN_ID}@example.invalid`,
      reviewerUserId: tenantContext.user.id,
      recurrenceType: 'Monthly',
      startDate: todayIso(1),
      endDate: todayIso(31),
      dueDate: todayIso(17),
    },
    {
      assignmentType: 'bulk',
      title: `${MARKER} Bulk Assignment`,
      reviewerUserId: tenantContext.user.id,
      bulkCsv: `bulk-a-${RUN_ID}@example.invalid\nbulk-b-${RUN_ID}@example.invalid`,
      dueDate: todayIso(18),
    },
    {
      assignmentType: 'self',
      title: `${MARKER} Self Assignment`,
      reviewerUserId: tenantContext.user.id,
      dueDate: todayIso(19),
      loginRequired: false,
    },
  ];

  const createdInstances = [];
  for (const assignment of assignmentTypes) {
    const assignmentPayload = await jsonRequest(
      context.request,
      'POST',
      `/builders/questionnaires/${template.id}/assignments`,
      assignment,
      { retries: 3 },
    );
    const instances = asArray(assignmentPayload?.data?.instances);
    assert(instances.length > 0, `Questionnaire ${assignment.assignmentType} assignment did not create instances.`);
    for (const instance of instances) {
      trackQuestionnaireInstance(template.id, instance);
      createdInstances.push(instance);
    }
  }
  assert(createdInstances.length >= 7, 'Questionnaire Builder did not create all assignment styles, including bulk rows.');

  const responseInstance =
    createdInstances.find((instance) => instance.assignmentType === 'self') ??
    createdInstances.find((instance) => instance.assignmentType === 'email') ??
    createdInstances[0];
  const answers = {
    RISK_LEVEL: 'High',
    HAS_EVIDENCE: true,
    REMEDIATION_DATE: todayIso(20),
    CONTACT_EMAIL: `respondent-${RUN_ID}@example.invalid`,
    SUPPORTING_FILES: `${MARKER} evidence-index.txt`,
  };
  const uploads = {
    HAS_EVIDENCE: `${MARKER} SOC2-report.pdf`,
    SUPPORTING_FILES: `${MARKER} policy-evidence.zip`,
  };
  const savedResponsePayload = await jsonRequest(
    context.request,
    'PUT',
    `/builders/questionnaires/${template.id}/instances/${responseInstance.id}/responses`,
    {
      answers,
      uploads,
      headerValues: { projectCode: RUN_ID, department: 'E2E' },
      comment: `${MARKER} saved by production validation.`,
    },
    { retries: 3 },
  );
  assert(savedResponsePayload?.data?.percentComplete === 100, 'Questionnaire response did not reach 100% completion.');
  assert(savedResponsePayload?.data?.passingStatus === 'Passing', 'Questionnaire response did not calculate passing status.');

  const publicShellPayload = await jsonRequest(
    context.request,
    'GET',
    `/builders/questionnaire-access/${responseInstance.shareToken}`,
  );
  assert(publicShellPayload?.data?.title?.includes(MARKER), 'Public questionnaire shell did not resolve by share token.');
  const accessPayload = await jsonRequest(
    context.request,
    'POST',
    `/builders/questionnaire-access/${responseInstance.shareToken}/validate`,
    { accessCode: responseInstance.accessCode },
  );
  assert(accessPayload?.data?.id === responseInstance.id, 'Public questionnaire access-code validation failed.');

  const submittedPayload = await jsonRequest(
    context.request,
    'POST',
    `/builders/questionnaires/${template.id}/instances/${responseInstance.id}/submit`,
    { reviewerComments: `${MARKER} submitted for review.` },
    { retries: 3 },
  );
  assert(submittedPayload?.data?.status === 'Submitted', 'Questionnaire submit workflow did not move to Submitted.');
  const rejectedPayload = await jsonRequest(
    context.request,
    'POST',
    `/builders/questionnaires/${template.id}/instances/${responseInstance.id}/reject`,
    {
      reviewerComments: `${MARKER} request changes for evidence detail.`,
      sendEmail: true,
      feedback: {
        HAS_EVIDENCE: { rating: 'Partially Acceptable', comment: `${MARKER} add more detail.` },
      },
    },
    { retries: 3 },
  );
  assert(rejectedPayload?.data?.status === 'RequestChanges', 'Questionnaire reject workflow did not reopen for changes.');
  const resavedPayload = await jsonRequest(
    context.request,
    'PUT',
    `/builders/questionnaires/${template.id}/instances/${responseInstance.id}/responses`,
    {
      answers: { ...answers, SUPPORTING_FILES: `${MARKER} evidence-index-v2.txt` },
      uploads,
      comment: `${MARKER} response updated after request changes.`,
    },
    { retries: 3 },
  );
  assert(resavedPayload?.data?.answers?.SUPPORTING_FILES?.includes('v2'), 'Questionnaire response changes after rejection were not persisted.');
  await jsonRequest(
    context.request,
    'POST',
    `/builders/questionnaires/${template.id}/instances/${responseInstance.id}/submit`,
    { reviewerComments: `${MARKER} resubmitted.` },
    { retries: 3 },
  );
  const acceptedPayload = await jsonRequest(
    context.request,
    'POST',
    `/builders/questionnaires/${template.id}/instances/${responseInstance.id}/accept`,
    {
      reviewerComments: `${MARKER} accepted by production validation.`,
      feedback: {
        HAS_EVIDENCE: { rating: 'Acceptable', comment: `${MARKER} evidence accepted.` },
      },
    },
    { retries: 3 },
  );
  assert(acceptedPayload?.data?.status === 'Accepted', 'Questionnaire accept workflow did not move to Accepted.');

  const instancesPayload = await jsonRequest(context.request, 'GET', `/builders/questionnaires/${template.id}/instances`);
  assert(asArray(instancesPayload?.data?.instances).length >= createdInstances.length, 'Questionnaire instance listing did not include created assignments.');
  const templateExport = await jsonRequest(context.request, 'GET', `/builders/questionnaires/${template.id}/export`);
  assert(templateExport?.data?.template?.id === template.id, 'Questionnaire template export did not include the created template.');
  const instanceExport = await jsonRequest(context.request, 'GET', `/builders/questionnaires/${template.id}/instances/${responseInstance.id}/export`);
  assert(instanceExport?.data?.instance?.id === responseInstance.id, 'Questionnaire response export did not include the selected instance.');

  await page.goto(absoluteUrl('/builders/questionnaire-builder'));
  await waitForSettledPage(page);
  const createdTemplateCard = page
    .locator('aside button')
    .filter({ hasText: `${MARKER} Questionnaire Builder Updated` })
    .first();
  await createdTemplateCard.waitFor({ state: 'visible', timeout: 12000 });
  await createdTemplateCard.click();
  await page.getByRole('tab', { name: /Overview/i }).click();
  let bodyText = await page.locator('body').innerText({ timeout: 12000 });
  for (const marker of [
    'Questionnaire Builder',
    'Assignments',
    'Responses',
    'Visual Rules Engine',
    'Scoring System',
  ]) {
    assert(bodyText.toLowerCase().includes(marker.toLowerCase()), `Questionnaire Builder UI did not expose ${marker}.`);
  }
  await page.getByRole('tab', { name: /^Builder$/i }).click();
  bodyText = await page.locator('body').innerText({ timeout: 12000 });
  for (const marker of [
    'Generate self-assignment URL',
    'Add Section',
    'Add Question',
    'Enable Upload / Manage Uploads',
  ]) {
    assert(bodyText.toLowerCase().includes(marker.toLowerCase()), `Questionnaire Builder UI did not expose ${marker}.`);
  }
  await page.getByRole('tab', { name: /Assignments/i }).click();
  bodyText = await page.locator('body').innerText({ timeout: 12000 });
  for (const marker of ['Assign to User', 'Assign by Email', 'Assign by Module', 'Assign Recurring', 'Bulk Assignment', 'Self-Assignment URL', 'Bulk CSV Emails', 'Import / Export JSON']) {
    assert(bodyText.toLowerCase().includes(marker.toLowerCase()), `Questionnaire assignment UI missing ${marker}.`);
  }
  await page.getByRole('tab', { name: /Responses/i }).click();
  await page.getByText(responseInstance.title, { exact: false }).first().waitFor({ state: 'visible', timeout: 12000 });
  await page.getByText(responseInstance.title, { exact: false }).first().click();
  bodyText = await page.locator('body').innerText({ timeout: 12000 });
  for (const marker of ['Access Code', 'Manage Uploads', 'Reviewer Feedback', 'Save Progress', 'Submit', 'Send Email & Reject', 'Accept', 'Passing Status']) {
    assert(bodyText.toLowerCase().includes(marker.toLowerCase()), `Questionnaire response UI missing ${marker}.`);
  }
  await page.getByRole('tab', { name: /Visual Rules Engine/i }).click();
  bodyText = await page.locator('body').innerText({ timeout: 12000 });
  for (const marker of ['Visual Editor', 'JSON Editor', 'Validate Draft', 'Save Rules', 'Conditions', 'Actions']) {
    assert(bodyText.toLowerCase().includes(marker.toLowerCase()), `Questionnaire rules UI missing ${marker}.`);
  }
  await page.getByRole('tab', { name: /Test Runs/i }).click();
  bodyText = await page.locator('body').innerText({ timeout: 12000 });
  for (const marker of ['Run Rule Test', 'Preview Draft', 'Persist Saved Test', 'Execution Log']) {
    assert(bodyText.toLowerCase().includes(marker.toLowerCase()), `Questionnaire test mode UI missing ${marker}.`);
  }

  await page.goto(absoluteUrl(`/questionnaires/response/${responseInstance.shareToken}`));
  await waitForSettledPage(page);
  bodyText = await page.locator('body').innerText({ timeout: 12000 });
  assert(/Questionnaire Response|Access Code|Response Progress/i.test(bodyText), 'Public questionnaire response route did not render.');

  return {
    templateId: template.id,
    instances: createdInstances.length,
    completedInstanceId: responseInstance.id,
    percentComplete: acceptedPayload.data.percentComplete,
  };
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

async function verifyNoExportBuilderResidue(context) {
  const payload = await jsonRequest(context.request, 'GET', '/builders/exports');
  const residues = asArray(payload?.data?.exports).filter((item) => JSON.stringify(item).includes(RUN_ID));
  assert(residues.length === 0, `Export Builder test-owned configs remain: ${JSON.stringify(residues)}`);
  return { activeResidues: residues.length };
}

async function verifyNoWayfinderResidue(context) {
  const payload = await jsonRequest(context.request, 'GET', '/builders/wayfinders');
  const residues = asArray(payload?.data?.templates).filter((item) => JSON.stringify(item).includes(RUN_ID));
  assert(residues.length === 0, `Wayfinder Builder test-owned templates remain: ${JSON.stringify(residues)}`);
  return { activeResidues: residues.length };
}

async function verifyNoReportBuilderResidue(context) {
  const builderPayload = await jsonRequest(context.request, 'GET', '/builders/reports');
  const reportResidues = asArray(builderPayload?.data?.reports).filter((item) => JSON.stringify(item).includes(RUN_ID));
  const opsPayload = await jsonRequest(context.request, 'GET', '/ops/reports');
  const exportResidues = asArray(opsPayload?.data?.exports).filter((item) => JSON.stringify(item).includes(RUN_ID));
  assert(
    reportResidues.length === 0 && exportResidues.length === 0,
    `Report Builder residues remain: ${JSON.stringify({ reportResidues, exportResidues })}`,
  );
  return { reportResidues: reportResidues.length, exportResidues: exportResidues.length };
}

async function verifyNoDashboardBuilderResidue(context) {
  const payload = await jsonRequest(context.request, 'GET', '/builders/dashboards');
  const residues = asArray(payload?.data?.dashboards).filter((item) => JSON.stringify(item).includes(RUN_ID));
  assert(residues.length === 0, `Dashboard Builder test-owned dashboards remain: ${JSON.stringify(residues)}`);
  return { activeResidues: residues.length };
}

async function verifyNoQuestionnaireBuilderResidue(context) {
  const payload = await jsonRequest(context.request, 'GET', '/builders/questionnaires');
  const residues = asArray(payload?.data?.templates).filter((item) => JSON.stringify(item).includes(RUN_ID));
  assert(residues.length === 0, `Questionnaire Builder test-owned templates remain: ${JSON.stringify(residues)}`);
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
    await runCheck(preflight, 'features/scale.md semantic inventory', () => loadScaleMdSemanticInventory(), { critical: true });
    await runCheck(preflight, 'bootstrap admin session', () => bootstrapSession(context), { critical: true });
    await runCheck(preflight, 'frontend/backend static alignment', () => validateFrontendBackendAlignment(), { critical: true });
    await runCheck(preflight, 'live semantic alignment endpoint', () => validateLiveSemanticAlignment(context), { critical: true });
    modules = await runCheck(preflight, 'load scale module catalog', () => loadLiveCatalog(context), { critical: true }) ?? [];
    await runCheck(preflight, 'scale.md semantic surface coverage', () => validateScaleMdSemanticSurfaceCoverage(modules), { critical: true });
    await runCheck(preflight, 'semantic gap matrix', () => validateSemanticGapMatrix(), { critical: true });
    tenantContext = await runCheck(preflight, 'load seeded tenant context', () => loadTenantContext(context), { critical: true });
    finishSuite(preflight);

    const routeSweep = makeSuite('all-route sweep');
    const routeChecks = [
      ...ROUTE_CHECKS,
      ...semanticCompatibilityRouteChecks(),
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
    await runCheck(seededData, 'catalogue import subfeature surface', () => validateCatalogueAndImportSurfaces(page));
    await runCheck(seededData, 'builder surfaces', () => validateBuilderSurfaces(page, modules));
    if (!READ_ONLY) {
      await runCheck(seededData, 'report builder semantic workflow', () => validateReportBuilderWorkflow(context, page));
      await runCheck(seededData, 'export builder semantic workflow', () => validateExportBuilderWorkflow(context, page));
      await runCheck(seededData, 'wayfinder builder semantic workflow', () => validateWayfinderBuilderWorkflow(context, page));
      await runCheck(seededData, 'dashboard builder semantic workflow', () => validateDashboardBuilderWorkflow(context, page));
      await runCheck(seededData, 'questionnaire builder semantic workflow', () => validateQuestionnaireBuilderWorkflow(context, page, tenantContext));
      await runCheck(seededData, 'form builder live rule lifecycle', () => validateFormBuilderRuleLifecycle(context, page, tenantContext));
      await runCheck(seededData, 'automation connector lifecycle semantics', () => validateConnectorLifecycleSemantics(context, page));
    } else {
      report.skips.push({
        suite: 'seeded data and module directory',
        reason: 'E2E_READ_ONLY=1 was set; builder mutation workflows were skipped.',
      });
    }
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
      await runCheck(cleanupSuite, 'verify no Export Builder residue', () => verifyNoExportBuilderResidue(context));
      await runCheck(cleanupSuite, 'verify no Wayfinder Builder residue', () => verifyNoWayfinderResidue(context));
      await runCheck(cleanupSuite, 'verify no Report Builder residue', () => verifyNoReportBuilderResidue(context));
      await runCheck(cleanupSuite, 'verify no Dashboard Builder residue', () => verifyNoDashboardBuilderResidue(context));
      await runCheck(cleanupSuite, 'verify no Questionnaire Builder residue', () => verifyNoQuestionnaireBuilderResidue(context));
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
