#!/usr/bin/env node

import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const frontendRequire = createRequire(path.resolve(repoRoot, 'frontend/package.json'));

let chromium;
try {
  ({ chromium } = frontendRequire('playwright'));
} catch (error) {
  throw new Error(
    `Playwright is required from the frontend workspace. Run the frontend dependency install first. ${error instanceof Error ? error.message : ''}`,
  );
}

const BASE_URL = (
  process.env.REGOVISE_DEMO_BASE_URL ||
  process.env.CLOUDFLARE_LOCAL_URL ||
  'http://127.0.0.1:8787'
).replace(/\/$/, '');
const OUTPUT_ROOT =
  process.env.REGOVISE_DEMO_OUTPUT_DIR ||
  path.resolve(repoRoot, 'artifacts/demo-videos');
const RUN_ID =
  process.env.REGOVISE_DEMO_RUN_ID ||
  new Date().toISOString().replace(/[:.]/g, '-');
const RUN_DIR = path.resolve(OUTPUT_ROOT, RUN_ID);
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== '0';
const SLOW_MO = Number.parseInt(process.env.PLAYWRIGHT_SLOW_MO || '0', 10) || 0;
const STEP_PAUSE_MS = Number.parseInt(process.env.REGOVISE_DEMO_STEP_PAUSE_MS || '700', 10) || 700;
const LONG_PAUSE_MS = Number.parseInt(process.env.REGOVISE_DEMO_LONG_PAUSE_MS || '1200', 10) || 1200;
const VIEWPORT = { width: 1440, height: 900 };
const DEMO_SESSION_ID = 'session-demo';
const DEMO_TENANT_ID = 'tenant-demo';
const DEMO_USER_ID = 'user-demo';

const args = process.argv.slice(2);

function hasFlag(name) {
  return args.includes(name);
}

function readOption(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

const CHAPTER_ARG = readOption('--chapter');
const DRY_RUN = hasFlag('--dry-run');
const LIST_ONLY = hasFlag('--list');
const SMOKE = hasFlag('--smoke');
const GENERATE_VOICEOVER = hasFlag('--voiceover');
const RENDER_PUBLISH = hasFlag('--render');
const SKIP_RECORDING = hasFlag('--skip-recording');
const OPENAI_KEY_PATH =
  process.env.OPENAI_API_KEY_FILE ||
  readOption('--openai-key-file') ||
  '~/Downloads/chatgptkey.rtf';
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'alloy';
const OPENAI_TTS_FORMAT = process.env.OPENAI_TTS_FORMAT || 'mp3';

const DEMO_CHAPTERS = [
  {
    id: 'home-program-health',
    title: 'Home and program health',
    audiencePromise:
      'Show how an operator lands in Regovise, sees program health, searches across the workspace, and opens analytics.',
    voiceover: [
      'Regovise opens on a compact GRC command center. The home dashboard summarizes program health, open work, coverage trends, and the areas that need attention first.',
      'The global search and analytics views make the workspace navigable at enterprise scale, so teams can jump from an executive metric to the underlying record without losing context.',
    ],
    steps: [
      { route: '/', label: 'Open Home', expect: ['Home'] },
      { route: '/search', label: 'Search across the workspace', expect: ['Search'] },
      { route: '/analytics', label: 'Review analytics', expect: ['Analytics'] },
    ],
  },
  {
    id: 'starter-guide-work-queue',
    title: 'Starter Guide and Work Queue',
    audiencePromise:
      'Show onboarding, personal access, task operations, findings, and assurance reviews.',
    voiceover: [
      'The Starter Guide turns setup into a clear checklist, helping a new team connect systems, define scope, and make the first compliance progress visible.',
      'The Work Queue keeps day-to-day execution focused. Tasks, findings, and review queues all stay reachable without flattening Regovise’s richer GRC model.',
    ],
    steps: [
      { route: '/program/setup', label: 'Walk the Starter Guide', expect: ['Starter'] },
      { route: '/workspace/me', label: 'Review My Access', expect: ['My Access'] },
      { route: '/tasks', label: 'Open Tasks', expect: ['Task'] },
      { route: '/findings', label: 'Inspect Findings', expect: ['Finding'] },
      { route: '/assurance/reviews', label: 'Open Assurance Reviews', expect: ['Review'] },
    ],
  },
  {
    id: 'compliance-system',
    title: 'Compliance operating system',
    audiencePromise:
      'Show frameworks, libraries, controls, assessments, policies, evidence, and audit packages.',
    voiceover: [
      'Compliance in Regovise is modeled as connected objects, not one generic checklist. Frameworks, controls, assessments, policies, documents, and audit packages keep their own lifecycle while staying linked.',
      'This lets a team move from requirements to evidence to audit-ready packages without losing traceability or over-simplifying the compliance program.',
    ],
    steps: [
      { route: '/program', label: 'Open Compliance Overview', expect: ['Compliance', 'Program'] },
      { route: '/frameworks', label: 'Review Frameworks', expect: ['Framework'] },
      { route: '/framework-library', label: 'Browse Framework Library', expect: ['Framework'] },
      { route: '/libraries', label: 'Inspect Libraries', expect: ['Librar'] },
      { route: '/security-controls', label: 'Review Controls', expect: ['Control'] },
      { route: '/assessments', label: 'Open Assessments and Tests', expect: ['Assessment'] },
      { route: '/gap-assessments', label: 'Review Gap Assessments', expect: ['Gap'] },
      { route: '/policies', label: 'Review Policies', expect: ['Polic'] },
      { route: '/evidence-locker', label: 'Open Documents and Evidence', expect: ['Evidence'] },
      { route: '/assessment-evidence-packages', label: 'Review Audit Packages', expect: ['Package'] },
    ],
  },
  {
    id: 'risk-management',
    title: 'Risk management',
    audiencePromise:
      'Show the risk library/register, action tracker, threat models, EBIOS RM, quantitative risk, incidents, and exceptions.',
    voiceover: [
      'Risk workflows stay first class. Regovise keeps scenario libraries, registers, treatments, actions, exceptions, incidents, EBIOS, and quantitative analysis visible as connected but distinct workspaces.',
      'That means the platform can support lightweight risk triage and advanced risk analysis without hiding the specialist workflows teams already depend on.',
    ],
    steps: [
      { route: '/risk-scenarios', label: 'Open Risk Library', expect: ['Risk'] },
      { route: '/risks', label: 'Open Risk Register', expect: ['Risk'] },
      { route: '/risk-actions', label: 'Review Risk Actions', expect: ['Action'] },
      { route: '/threat-models', label: 'Review Threat Models', expect: ['Threat'] },
      { route: '/advanced-risk/ebios', label: 'Open EBIOS Workspace', expect: ['EBIOS'] },
      {
        route: '/advanced-risk/ebios/ebios-study-demo-enterprise',
        label: 'Inspect an EBIOS study',
        expect: ['EBIOS'],
        optional: true,
      },
      { route: '/advanced-risk/quantitative', label: 'Open Quantitative Risk', expect: ['Quantitative'] },
      {
        route: '/advanced-risk/quantitative/quantitative-study-demo-enterprise',
        label: 'Inspect a quantitative study',
        expect: ['Quantitative'],
        optional: true,
      },
      { route: '/incidents', label: 'Review Incidents', expect: ['Incident'] },
      { route: '/security-exceptions', label: 'Review Exceptions', expect: ['Exception'] },
    ],
  },
  {
    id: 'evidence-assurance',
    title: 'Evidence and assurance',
    audiencePromise:
      'Show evidence collection, jobs, monitoring, assurance review, explorer, tracker, packages, and agent runs.',
    voiceover: [
      'Evidence and assurance are where Regovise turns controls into proof. Collection jobs, monitoring runs, evidence reviews, trackers, and assurance packages show what is deterministic and what still needs human judgment.',
      'AI explanations are useful, but status comes from the evidence record and deterministic checks first. That makes the audit trail easier to trust.',
    ],
    steps: [
      { route: '/evidence-management', label: 'Open Evidence Workspace', expect: ['Evidence'] },
      { route: '/evidence/jobs', label: 'Review Collection Jobs', expect: ['Job'] },
      { route: '/conmon/executions', label: 'Review Monitoring Runs', expect: ['Monitoring', 'Run'] },
      { route: '/assurance', label: 'Open Assurance Overview', expect: ['Assurance'] },
      {
        route: '/assurance/evidence?artifact=normalized_bundle&evidenceJobId=bacafef5-4489-4f87-976b-73d32ee63e10',
        label: 'Inspect Evidence Explorer',
        expect: ['Evidence'],
      },
      { route: '/assurance/tracker', label: 'Open Tracker Workbench', expect: ['Tracker'] },
      { route: '/assurance/packages', label: 'Review Assurance Packages', expect: ['Package'] },
      { route: '/assurance/agent-runs', label: 'Review Agent Runs', expect: ['Agent'] },
    ],
  },
  {
    id: 'vendors-trust',
    title: 'Vendors and trust',
    audiencePromise:
      'Show third-party risk, vendor detail, portal assignments, questionnaires, and trust center.',
    voiceover: [
      'Vendor and trust workflows connect third-party oversight with customer-facing proof. Regovise keeps vendor records, portal assignments, questionnaires, and trust-center material tied back to the same compliance backbone.',
      'The result is a faster path from vendor intake to assurance response without separating customer trust from the controls and risks that support it.',
    ],
    steps: [
      { route: '/third-party', label: 'Open Vendors', expect: ['Third', 'Vendor'] },
      {
        route: '/third-party/entities/entity-demo-resilience',
        label: 'Inspect Vendor Detail',
        expect: ['Third', 'Vendor'],
        optional: true,
      },
      { route: '/portal', label: 'Open External Portal', expect: ['Portal'] },
      {
        route: '/portal/assignments/portal-assignment-demo-vendor',
        label: 'Inspect Portal Assignment',
        expect: ['Portal'],
        optional: true,
      },
      { route: '/questionnaires', label: 'Review Questionnaires', expect: ['Questionnaire'] },
      { route: '/trust-center', label: 'Review Trust Center', expect: ['Trust'] },
    ],
  },
  {
    id: 'assets-systems',
    title: 'Assets, systems, and integrations',
    audiencePromise:
      'Show assets, components, interconnections, supply chain, and integrations.',
    voiceover: [
      'Assets and systems are the scope layer. Regovise tracks assets, components, interconnections, supply-chain dependencies, and integrations as living context for controls and evidence.',
      'This is how the platform keeps compliance grounded in the real environment rather than static policy language.',
    ],
    steps: [
      { route: '/assets', label: 'Open Assets', expect: ['Asset'] },
      { route: '/components', label: 'Review Components', expect: ['Component'] },
      { route: '/interconnections', label: 'Review Interconnections', expect: ['Interconnection'] },
      { route: '/supply-chain', label: 'Review Supply Chain', expect: ['Supply'] },
      { route: '/integrations', label: 'Open Integrations', expect: ['Integration'] },
    ],
  },
  {
    id: 'people-access',
    title: 'People and access',
    audiencePromise:
      'Show team, access, domains/scope, SSO, MFA, and service-account administration.',
    voiceover: [
      'People and access management gives administrators a clean place to manage users, roles, scope, SSO, MFA, and service accounts.',
      'These routes remain permission-gated, but they are still part of the complete demo because identity and ownership drive every GRC workflow.',
    ],
    steps: [
      { route: '/workspace/team', label: 'Open People', expect: ['Team'] },
      { route: '/workspace/access', label: 'Review Access', expect: ['Access'] },
      { route: '/workspace/domains', label: 'Review Scope', expect: ['Scope', 'Domain'] },
      { route: '/setup/sso', label: 'Review SSO', expect: ['SSO'] },
      { route: '/setup/mfa', label: 'Review MFA', expect: ['MFA'] },
      { route: '/setup/service-accounts', label: 'Review Service Accounts', expect: ['Service'] },
    ],
  },
  {
    id: 'privacy-resilience',
    title: 'Privacy and resilience',
    audiencePromise:
      'Show privacy processing, resilience, BIA detail, incidents, and exceptions.',
    voiceover: [
      'Privacy and resilience workflows make operational impact visible. Processing records, business impact analysis, incidents, and exceptions sit near risk and assurance instead of being buried in admin screens.',
      'That keeps data protection and continuity work connected to the same control, evidence, and action model.',
    ],
    steps: [
      { route: '/privacy', label: 'Open Privacy', expect: ['Privacy'] },
      {
        route: '/privacy/processings/9260b8ef-c608-4bcf-bb33-2eee7e457633',
        label: 'Inspect Processing Detail',
        expect: ['Processing', 'Privacy'],
        optional: true,
      },
      { route: '/resilience', label: 'Open Resilience', expect: ['Resilience'] },
      {
        route: '/resilience/business-impact-analyses/5e2c3b22-73ec-4113-8f07-9f1911dc346a',
        label: 'Inspect BIA Detail',
        expect: ['Business', 'Impact'],
        optional: true,
      },
      { route: '/incidents', label: 'Review Incidents', expect: ['Incident'] },
      { route: '/security-exceptions', label: 'Review Exceptions', expect: ['Exception'] },
    ],
  },
  {
    id: 'reports-exports',
    title: 'Reports and exports',
    audiencePromise:
      'Show report center, DORA ROI, report bundles, report builder, and compliance exports.',
    voiceover: [
      'Reports and exports turn the program into board-ready and auditor-ready output. The report center, DORA ROI report, bundles, builders, and compliance exports share the same source data.',
      'This chapter is designed to prove that reporting is not a detached dashboard. It is a governed export layer on top of the live GRC model.',
    ],
    steps: [
      { route: '/reports', label: 'Open Reports', expect: ['Report'] },
      { route: '/reports/dora-roi', label: 'Review DORA ROI', expect: ['DORA'] },
      { route: '/report-bundles', label: 'Review Report Bundles', expect: ['Report'] },
      { route: '/builders/report-builder', label: 'Open Report Builder', expect: ['Report'] },
      { route: '/compliance-exports', label: 'Open Compliance Exports', expect: ['Export'] },
    ],
  },
  {
    id: 'automation-builders',
    title: 'Automation and builders',
    audiencePromise:
      'Show workspace AI, workbench, workflow, utilities, builders, automation, RegML, and imports.',
    voiceover: [
      'Automation and builders are where Regovise becomes more than a record system. AI workspaces, workflows, utilities, RegML, response automation, evidence mapping, imports, and builders let teams extend the operating model.',
      'The demo keeps these routes visible because they are a core part of the product promise: a configurable GRC platform that can still stay governed.',
    ],
    steps: [
      { route: '/chat', label: 'Open Workspace AI', expect: ['AI', 'Chat'] },
      { route: '/workbench', label: 'Open Workbench', expect: ['Workbench'] },
      { route: '/workflow', label: 'Review Workflow', expect: ['Workflow'] },
      { route: '/utilities', label: 'Open Utilities', expect: ['Utilities'] },
      { route: '/subsystems', label: 'Open Subsystems', expect: ['Subsystem'] },
      { route: '/news-feed', label: 'Open News Feed', expect: ['News'] },
      { route: '/builders', label: 'Open Builder Launcher', expect: ['Builder'] },
      { route: '/response-automation', label: 'Review Response Automation', expect: ['Response'] },
      { route: '/evidence-mapping', label: 'Review Evidence Mapping', expect: ['Evidence'] },
      { route: '/features/regml', label: 'Open RegML', expect: ['RegML'] },
      { route: '/builders/export-builder', label: 'Open Export Builder', expect: ['Export'] },
      { route: '/builders/questionnaire-builder', label: 'Open Questionnaire Builder', expect: ['Questionnaire'] },
      { route: '/builders/wayfinder-builder', label: 'Open Wayfinder Builder', expect: ['Wayfinder'] },
      { route: '/imports', label: 'Review Imports', expect: ['Import'] },
    ],
  },
  {
    id: 'admin-setup',
    title: 'Admin and setup',
    audiencePromise:
      'Show workspace settings, security, tags, classification, modules, risk model, sources, monitoring profiles, GRC admin, and scrutiny engine.',
    voiceover: [
      'Admin is intentionally quieter in the navigation, but it remains complete. Workspace settings, security, classification, modules, risk models, sources, monitoring profiles, GRC administration, and scrutiny tooling all stay reachable.',
      'This chapter verifies that the Vanta-like information architecture does not remove the deeper Regovise administration surface.',
    ],
    steps: [
      { route: '/setup/general', label: 'Open Workspace Settings', expect: ['Workspace', 'Settings'] },
      { route: '/setup/security', label: 'Review Security Settings', expect: ['Security'] },
      { route: '/setup/tags', label: 'Review Tags', expect: ['Tag'] },
      { route: '/setup/classification', label: 'Review Classification', expect: ['Classification'] },
      { route: '/setup/modules-features', label: 'Review Modules and Features', expect: ['Module'] },
      { route: '/setup/risk-model', label: 'Review Risk Model', expect: ['Risk'] },
      { route: '/evidence/sources', label: 'Review Evidence Sources', expect: ['Source'] },
      { route: '/conmon/profiles', label: 'Review Monitoring Profiles', expect: ['Profile'] },
      { route: '/grc-admin', label: 'Open GRC Administration', expect: ['GRC'] },
      { route: '/grc-admin/scrutiny-engine', label: 'Open Scrutiny Engine', expect: ['Scrutiny'] },
    ],
  },
  {
    id: 'legacy-reference-routes',
    title: 'Legacy and reference route preservation',
    audiencePromise:
      'Show preserved module aliases and Vanta prototype routes used as design references.',
    voiceover: [
      'The redesign keeps legacy routes and prototype routes reachable. This protects existing customer links while the live Regovise screens continue to converge on the clearer Vanta-like patterns.',
      'This final regression chapter is mostly for product and engineering teams: it proves the new shell did not break the older route families.',
    ],
    steps: [
      { route: '/modules', label: 'Open Module Directory', expect: ['Module'] },
      { route: '/modules/tasks', label: 'Open Legacy Tasks Module', expect: ['Task'] },
      { route: '/vanta-clone/vendors', label: 'Open Vanta Vendors Prototype', expect: ['Vanta'], optional: true },
      { route: '/vanta-clone/tests', label: 'Open Vanta Tests Prototype', expect: ['Tests'], optional: true },
      { route: '/vanta-clone/frameworks', label: 'Open Vanta Frameworks Prototype', expect: ['Vanta'], optional: true },
    ],
  },
];

function absoluteUrl(route) {
  return `${BASE_URL}${route.startsWith('/') ? route : `/${route}`}`;
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function selectedChapters() {
  if (SMOKE) {
    return DEMO_CHAPTERS.slice(0, 1);
  }
  if (!CHAPTER_ARG) {
    return DEMO_CHAPTERS;
  }

  const wanted = new Set(
    CHAPTER_ARG.split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  );
  const selected = DEMO_CHAPTERS.filter((chapter) => wanted.has(chapter.id));
  assert(
    selected.length === wanted.size,
    `Unknown chapter id. Requested ${[...wanted].join(', ')}. Run --list to see valid ids.`,
  );
  return selected;
}

async function ensureDirectoryTree() {
  await fs.mkdir(path.join(RUN_DIR, 'videos'), { recursive: true });
  await fs.mkdir(path.join(RUN_DIR, 'audio'), { recursive: true });
  await fs.mkdir(path.join(RUN_DIR, 'publish'), { recursive: true });
  await fs.mkdir(path.join(RUN_DIR, 'screenshots'), { recursive: true });
  await fs.mkdir(path.join(RUN_DIR, 'chapters'), { recursive: true });
  await fs.mkdir(path.join(RUN_DIR, 'tmp-video'), { recursive: true });
}

async function writeLatestPointer() {
  const latestPath = path.join(OUTPUT_ROOT, 'latest');
  await fs.rm(latestPath, { recursive: true, force: true });
  await fs.symlink(RUN_DIR, latestPath, 'dir').catch(async () => {
    await fs.writeFile(path.join(OUTPUT_ROOT, 'latest.txt'), RUN_DIR, 'utf8');
  });
}

async function requestJson(context, route, init = {}) {
  const response = await context.request.fetch(absoluteUrl(route), {
    method: init.method ?? 'GET',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
    data: init.data,
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok()) {
    throw new Error(`${init.method ?? 'GET'} ${route} failed with ${response.status()}: ${text.slice(0, 500)}`);
  }
  return payload;
}

async function bootstrapDemoSession(context) {
  const bootstrap = await requestJson(context, '/_api/core/bootstrap-demo', { method: 'POST' });
  assert(bootstrap?.data?.tenantId === DEMO_TENANT_ID, 'Bootstrap did not return the seeded demo tenant.');

  const url = new URL(BASE_URL);
  await context.addCookies([
    {
      name: 'ca_session',
      value: DEMO_SESSION_ID,
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);
}

async function installDemoIdentity(context) {
  await context.addInitScript(
    ({ tenantId, userId }) => {
      window.localStorage.setItem('ciso-assistant.edge.tenant-id', tenantId);
      window.localStorage.setItem('ciso-assistant.edge.user-id', userId);
      window.localStorage.setItem('ciso-assistant.edge.auth-mode', 'session');
      window.sessionStorage.removeItem('ciso-assistant.edge.loopback-auto-session-suppressed');
      window.sessionStorage.removeItem('ciso-assistant.edge.loopback-bootstrap-migrated');
    },
    { tenantId: DEMO_TENANT_ID, userId: DEMO_USER_ID },
  );
}

function makeDiagnostics() {
  return {
    consoleErrors: [],
    pageErrors: [],
    failedResponses: [],
    requestFailures: [],
  };
}

function wireDiagnostics(page, diagnostics) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      if (!/ResizeObserver loop|cdn-cgi\/rum|favicon/i.test(text)) {
        diagnostics.consoleErrors.push(text);
      }
    }
  });
  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push(error.message);
  });
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !/favicon|cdn-cgi\/rum/i.test(url)) {
      diagnostics.failedResponses.push(`${status} ${url}`);
    }
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    const url = request.url();
    const errorText = failure?.errorText ?? 'failed';
    if (errorText !== 'net::ERR_ABORTED' && !/favicon|cdn-cgi\/rum/i.test(url)) {
      diagnostics.requestFailures.push(`${errorText} ${url}`);
    }
  });
}

function diagnosticBaseline(diagnostics) {
  return {
    consoleErrors: diagnostics.consoleErrors.length,
    pageErrors: diagnostics.pageErrors.length,
    failedResponses: diagnostics.failedResponses.length,
    requestFailures: diagnostics.requestFailures.length,
  };
}

function diagnosticDelta(diagnostics, baseline) {
  return {
    consoleErrors: diagnostics.consoleErrors.slice(baseline.consoleErrors),
    pageErrors: diagnostics.pageErrors.slice(baseline.pageErrors),
    failedResponses: diagnostics.failedResponses.slice(baseline.failedResponses),
    requestFailures: diagnostics.requestFailures.slice(baseline.requestFailures),
  };
}

async function waitForSettledPage(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
  await page.locator('body').waitFor({ state: 'visible', timeout: 10000 });
  await page.evaluate(() => document.fonts?.ready ?? Promise.resolve()).catch(() => undefined);
}

async function ensureNoPageOverflow(page, route) {
  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      scrollWidth: Math.max(doc.scrollWidth, body?.scrollWidth ?? 0),
      clientWidth: doc.clientWidth,
      scrollHeight: Math.max(doc.scrollHeight, body?.scrollHeight ?? 0),
      clientHeight: doc.clientHeight,
    };
  });
  const overflow = result.scrollWidth - result.clientWidth;
  assert(overflow <= 4, `${route} has page-level horizontal overflow of ${overflow}px.`);
}

async function validateStep(page, diagnostics, chapter, step, stepIndex) {
  const baseline = diagnosticBaseline(diagnostics);
  const startedAt = Date.now();
  const screenshotDir = path.join(RUN_DIR, 'screenshots', chapter.id);
  await fs.mkdir(screenshotDir, { recursive: true });

  try {
    await page.goto(absoluteUrl(step.route), { waitUntil: 'domcontentloaded' });
    await waitForSettledPage(page);
    await sleep(STEP_PAUSE_MS);

    const bodyText = await page.locator('body').innerText({ timeout: 10000 });
    assert(bodyText.trim().length > 50, `${step.route} rendered an unexpectedly small page.`);
    assert(
      !/route access|not found|something went wrong|application error|sign in to continue/i.test(bodyText),
      `${step.route} rendered an error, access, or login page.`,
    );

    for (const expectedText of step.expect ?? []) {
      assert(
        bodyText.toLowerCase().includes(expectedText.toLowerCase()),
        `${step.route} did not include expected text: ${expectedText}`,
      );
    }

    await ensureNoPageOverflow(page, step.route);

    const delta = diagnosticDelta(diagnostics, baseline);
    assert(delta.pageErrors.length === 0, `${step.route} produced page errors: ${delta.pageErrors.join(' | ')}`);
    assert(delta.requestFailures.length === 0, `${step.route} produced request failures: ${delta.requestFailures.join(' | ')}`);
    assert(delta.failedResponses.length === 0, `${step.route} produced failing responses: ${delta.failedResponses.join(' | ')}`);
    assert(delta.consoleErrors.length === 0, `${step.route} produced console errors: ${delta.consoleErrors.join(' | ')}`);

    const screenshotPath = path.join(
      screenshotDir,
      `${String(stepIndex + 1).padStart(2, '0')}-${slug(step.label || step.route)}.png`,
    );
    await page.screenshot({ path: screenshotPath, fullPage: false });

    return {
      route: step.route,
      label: step.label,
      status: 'passed',
      durationMs: Date.now() - startedAt,
      screenshot: path.relative(RUN_DIR, screenshotPath),
    };
  } catch (error) {
    if (!step.optional) {
      throw error;
    }

    return {
      route: step.route,
      label: step.label,
      status: 'skipped',
      optional: true,
      reason: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    };
  }
}

function chapterMarkdown(chapter, index, result = null) {
  const lines = [
    `# ${String(index + 1).padStart(2, '0')} - ${chapter.title}`,
    '',
    `**Chapter ID:** \`${chapter.id}\``,
    '',
    `**Audience promise:** ${chapter.audiencePromise}`,
    '',
    '## Voiceover Script',
    '',
    ...chapter.voiceover.map((paragraph) => `${paragraph}`),
    '',
    '## On-Screen Route Beats',
    '',
    ...chapter.steps.map((step, stepIndex) => `${stepIndex + 1}. ${step.label}: \`${step.route}\``),
  ];

  if (result) {
    lines.push('', '## Regression Result', '');
    for (const step of result.steps) {
      const suffix = step.status === 'skipped' ? ` - optional skip: ${step.reason}` : '';
      lines.push(`- ${step.status.toUpperCase()} ${step.label} (\`${step.route}\`)${suffix}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

async function writeRunArtifacts(chapters, results) {
  const outline = [
    '# Regovise YouTube Demo Suite',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Base URL: ${BASE_URL}`,
    `Run directory: ${RUN_DIR}`,
    '',
    '## Publishing Notes',
    '',
    '- Each `.webm` file is a chapter-ready source recording.',
    '- Each `.mp3` file is generated narration for the matching chapter when `--voiceover` is used.',
    '- Each `.mp4` file in `publish/` is a YouTube-ready chapter render when `--render` is used.',
    '- The voiceover text below is intentionally written for AI narration.',
    '- Use the regression manifest to decide whether a chapter is safe to publish.',
    '',
    '## Chapters',
    '',
  ];

  for (const [index, chapter] of chapters.entries()) {
    const result = results.find((entry) => entry.id === chapter.id);
    outline.push(
      `### ${String(index + 1).padStart(2, '0')} - ${chapter.title}`,
      '',
      `Chapter ID: \`${chapter.id}\``,
      `Video: ${result?.video ? `\`${result.video}\`` : '_not recorded_'}`,
      `Voiceover: ${result?.voiceover ? `\`${result.voiceover}\`` : '_not generated_'}`,
      `Publish render: ${result?.publish ? `\`${result.publish}\`` : '_not rendered_'}`,
      `Status: ${result?.status ?? 'not-run'}`,
      '',
      chapter.voiceover.join('\n\n'),
      '',
      'Route beats:',
      ...chapter.steps.map((step) => `- ${step.label}: \`${step.route}\``),
      '',
    );
  }

  const manifest = {
    runId: RUN_ID,
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    outputDir: RUN_DIR,
    viewport: VIEWPORT,
    smoke: SMOKE,
    dryRun: DRY_RUN,
    voiceover: GENERATE_VOICEOVER,
    render: RENDER_PUBLISH,
    chapters: results,
  };

  await fs.writeFile(path.join(RUN_DIR, 'youtube-outline.md'), outline.join('\n'), 'utf8');
  await fs.writeFile(path.join(RUN_DIR, 'demo-suite.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

async function writeChapterScript(chapter, index, result = null) {
  const filePath = path.join(
    RUN_DIR,
    'chapters',
    `${String(index + 1).padStart(2, '0')}-${chapter.id}.md`,
  );
  await fs.writeFile(filePath, chapterMarkdown(chapter, index, result), 'utf8');
  return path.relative(RUN_DIR, filePath);
}

async function recordChapter(browser, chapter, index) {
  const tmpVideoDir = path.join(RUN_DIR, 'tmp-video', chapter.id);
  await fs.mkdir(tmpVideoDir, { recursive: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: {
      dir: tmpVideoDir,
      size: VIEWPORT,
    },
  });

  await installDemoIdentity(context);
  await bootstrapDemoSession(context);

  const page = await context.newPage();
  const diagnostics = makeDiagnostics();
  wireDiagnostics(page, diagnostics);
  const steps = [];
  let videoPath = null;

  try {
    for (const [stepIndex, step] of chapter.steps.entries()) {
      console.log(`  ${stepIndex + 1}/${chapter.steps.length} ${step.label} ${step.route}`);
      const result = await validateStep(page, diagnostics, chapter, step, stepIndex);
      steps.push(result);
    }
    await sleep(LONG_PAUSE_MS);
    videoPath = await page.video()?.path();
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }

  let outputVideo = null;
  if (videoPath) {
    outputVideo = path.join(
      RUN_DIR,
      'videos',
      `${String(index + 1).padStart(2, '0')}-${chapter.id}.webm`,
    );
    await fs.rename(videoPath, outputVideo).catch(async () => {
      await fs.copyFile(videoPath, outputVideo);
    });
  }

  const result = {
    id: chapter.id,
    title: chapter.title,
    status: steps.some((step) => step.status === 'skipped') ? 'passed-with-optional-skips' : 'passed',
    video: outputVideo ? path.relative(RUN_DIR, outputVideo) : null,
    voiceover: null,
    publish: null,
    script: null,
    steps,
  };
  result.script = await writeChapterScript(chapter, index, result);
  return result;
}

function expandHome(value) {
  if (!value.startsWith('~')) return value;
  return path.join(process.env.HOME || '', value.slice(1));
}

function extractOpenAiKey(text) {
  const match = text.match(/sk-[A-Za-z0-9_-]{20,}/);
  return match?.[0] ?? null;
}

async function readOpenAiKey() {
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY.trim();
  }
  const keyFile = expandHome(OPENAI_KEY_PATH);
  const raw = await fs.readFile(keyFile, 'utf8');
  const key = extractOpenAiKey(raw);
  assert(key, `Could not find an OpenAI API key in ${keyFile}.`);
  return key;
}

function voiceoverText(chapter) {
  return [
    chapter.title,
    '',
    ...chapter.voiceover,
    '',
    'Route beats:',
    ...chapter.steps.map((step, index) => `${index + 1}. ${step.label}.`),
  ].join('\n');
}

async function generateVoiceover(chapter, index, apiKey) {
  const outputPath = path.join(
    RUN_DIR,
    'audio',
    `${String(index + 1).padStart(2, '0')}-${chapter.id}.${OPENAI_TTS_FORMAT}`,
  );
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      voice: OPENAI_TTS_VOICE,
      response_format: OPENAI_TTS_FORMAT,
      input: voiceoverText(chapter),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI voiceover generation failed for ${chapter.id}: ${response.status} ${text.slice(0, 1000)}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputPath, bytes);
  return path.relative(RUN_DIR, outputPath);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.stdio ?? 'pipe',
      cwd: options.cwd ?? repoRoot,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}\n${stderr || stdout}`));
      }
    });
  });
}

async function renderChapter(chapter, index, result) {
  assert(result.video, `Cannot render ${chapter.id} without a recorded video.`);
  assert(result.voiceover, `Cannot render ${chapter.id} without generated voiceover.`);

  const videoPath = path.join(RUN_DIR, result.video);
  const audioPath = path.join(RUN_DIR, result.voiceover);
  const outputPath = path.join(
    RUN_DIR,
    'publish',
    `${String(index + 1).padStart(2, '0')}-${chapter.id}.mp4`,
  );

  await runCommand('ffmpeg', [
    '-y',
    '-i',
    videoPath,
    '-i',
    audioPath,
    '-filter_complex',
    '[0:v]tpad=stop_mode=clone:stop_duration=120,format=yuv420p[v];[1:a]apad=pad_dur=120[a]',
    '-map',
    '[v]',
    '-map',
    '[a]',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '22',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-shortest',
    '-movflags',
    '+faststart',
    outputPath,
  ]);

  return path.relative(RUN_DIR, outputPath);
}

async function enrichWithPublishingArtifacts(chapters, results) {
  let apiKey = null;
  if (GENERATE_VOICEOVER) {
    apiKey = await readOpenAiKey();
  }

  for (const [index, chapter] of chapters.entries()) {
    const result = results[index];
    if (!result || result.status === 'planned') continue;

    if (GENERATE_VOICEOVER) {
      console.log(`  voiceover ${chapter.id}`);
      result.voiceover = await generateVoiceover(chapter, index, apiKey);
    }
    if (RENDER_PUBLISH) {
      console.log(`  render ${chapter.id}`);
      result.publish = await renderChapter(chapter, index, result);
    }
    result.script = await writeChapterScript(chapter, index, result);
  }
}

async function dryRun(chapters) {
  const results = [];
  for (const [index, chapter] of chapters.entries()) {
    const result = {
      id: chapter.id,
      title: chapter.title,
      status: 'planned',
      video: null,
      script: null,
      steps: chapter.steps.map((step) => ({
        route: step.route,
        label: step.label,
        status: 'planned',
      })),
    };
    result.script = await writeChapterScript(chapter, index, result);
    results.push(result);
  }
  await writeRunArtifacts(chapters, results);
  await writeLatestPointer();
  return results;
}

async function main() {
  if (LIST_ONLY) {
    for (const [index, chapter] of DEMO_CHAPTERS.entries()) {
      console.log(`${String(index + 1).padStart(2, '0')} ${chapter.id} - ${chapter.title}`);
      for (const step of chapter.steps) {
        console.log(`   ${step.route}`);
      }
    }
    return;
  }

  const chapters = selectedChapters();
  await ensureDirectoryTree();

  if (DRY_RUN) {
    const results = await dryRun(chapters);
    console.log(`Wrote dry-run demo plan for ${results.length} chapter(s): ${RUN_DIR}`);
    return;
  }

  console.log(`Recording Regovise demo suite from ${BASE_URL}`);
  console.log(`Output directory: ${RUN_DIR}`);
  console.log(`Mode: ${SMOKE ? 'smoke' : CHAPTER_ARG ? `chapter ${CHAPTER_ARG}` : 'all chapters'}`);

  const results = [];

  if (SKIP_RECORDING) {
    for (const [index, chapter] of chapters.entries()) {
      const existingVideo = path.join(
        RUN_DIR,
        'videos',
        `${String(index + 1).padStart(2, '0')}-${chapter.id}.webm`,
      );
      await fs.access(existingVideo);
      results.push({
        id: chapter.id,
        title: chapter.title,
        status: 'passed',
        video: path.relative(RUN_DIR, existingVideo),
        voiceover: null,
        publish: null,
        script: null,
        steps: chapter.steps.map((step) => ({
          route: step.route,
          label: step.label,
          status: 'not-rechecked',
        })),
      });
    }
  } else {
    const browser = await chromium.launch({
      headless: HEADLESS,
      slowMo: SLOW_MO,
    });

    try {
      for (const [index, chapter] of chapters.entries()) {
        console.log(`\n${String(index + 1).padStart(2, '0')} ${chapter.title}`);
        const result = await recordChapter(browser, chapter, index);
        results.push(result);
      }
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  await enrichWithPublishingArtifacts(chapters, results);
  await writeRunArtifacts(chapters, results);
  await writeLatestPointer();

  console.log(`\nRecorded ${results.length} chapter(s).`);
  console.log(`YouTube outline: ${path.join(RUN_DIR, 'youtube-outline.md')}`);
  console.log(`Regression manifest: ${path.join(RUN_DIR, 'demo-suite.json')}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
