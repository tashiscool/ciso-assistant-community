#!/usr/bin/env node

import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLoopbackBaseUrl, evaluateResponsiveResult, isUnexpectedResponseFailure } from './responsive_qa_policy.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const frontendRequire = createRequire(path.resolve(repoRoot, 'frontend/package.json'));

const BASE_URL = assertLoopbackBaseUrl(
  process.env.REGOVISE_RESPONSIVE_BASE_URL ||
  process.env.CLOUDFLARE_LOCAL_URL ||
  'http://127.0.0.1:8787',
);
const OUTPUT_ROOT =
  process.env.REGOVISE_RESPONSIVE_OUTPUT_DIR ||
  path.resolve(repoRoot, 'artifacts/responsive-qa');
const RUN_ID =
  process.env.REGOVISE_RESPONSIVE_RUN_ID ||
  new Date().toISOString().replace(/[:.]/g, '-');
const RUN_DIR = path.resolve(OUTPUT_ROOT, RUN_ID);
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== '0';
const DEMO_SESSION_ID = 'session-demo';
const DEMO_TENANT_ID = 'tenant-demo';
const DEMO_USER_ID = 'user-demo';
const WIDTHS = (process.env.REGOVISE_RESPONSIVE_WIDTHS || '1440,1024,768,390')
  .split(',')
  .map((part) => Number.parseInt(part.trim(), 10))
  .filter(Boolean);
const HEIGHT = Number.parseInt(process.env.REGOVISE_RESPONSIVE_HEIGHT || '900', 10) || 900;
const MAX_ALLOWED_PAGE_OVERFLOW = Number.parseInt(process.env.REGOVISE_RESPONSIVE_MAX_OVERFLOW || '4', 10) || 4;
const MAX_ROUTES = Number.parseInt(process.env.REGOVISE_RESPONSIVE_MAX_ROUTES || '0', 10) || 0;
const CAPTURE_SCREENSHOTS = process.env.REGOVISE_RESPONSIVE_SCREENSHOTS === '1';

const ROUTES = [
  '/',
  '/program/setup',
  '/tasks',
  '/assurance/evidence?artifact=normalized_bundle&evidenceJobId=bacafef5-4489-4f87-976b-73d32ee63e10',
  '/frameworks',
  '/security-controls',
  '/assessments',
  '/policies',
  '/evidence-locker',
  '/assessment-evidence-packages',
  '/risk-scenarios',
  '/risks',
  '/advanced-risk/ebios',
  '/advanced-risk/quantitative',
  '/incidents',
  '/security-exceptions',
  '/evidence-management',
  '/evidence/jobs',
  '/conmon/executions',
  '/assurance',
  '/assurance/tracker',
  '/assurance/packages',
  '/third-party',
  '/portal',
  '/questionnaires',
  '/trust-center',
  '/assets',
  '/components',
  '/integrations',
  '/workspace/team',
  '/workspace/access',
  '/privacy',
  '/resilience',
  '/reports',
  '/builders/export-builder',
  '/builders/questionnaire-builder',
  '/setup/general',
  '/setup/security',
  '/grc-admin',
  '/modules',
  '/modules/tasks',
  '/vanta-clone/tests',
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function routeName(route) {
  return route
    .replace(/^\//, 'home-')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

async function requestJson(context, route, init = {}) {
  const response = await context.request.fetch(`${BASE_URL}${route}`, {
    ...init,
    maxRedirects: 0,
    headers: {
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  if (!response.ok()) {
    throw new Error(`${init.method ?? 'GET'} ${route} failed with ${response.status()}.`);
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

async function inspectLayout(page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const body = document.body;
    const doc = document.documentElement;
    const main = document.querySelector('main');
    const visible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number.parseFloat(style.opacity || '1') > 0.01 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const cssPath = (el) => {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const classes = Array.from(el.classList ?? [])
        .slice(0, 5)
        .map((name) => `.${name}`)
        .join('');
      return `${tag}${id}${classes}`;
    };

    const offenders = Array.from(document.querySelectorAll('body *'))
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          selector: cssPath(el),
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          overflowRight: Math.max(0, Math.round(rect.right - viewportWidth)),
          overflowLeft: Math.max(0, Math.round(-rect.left)),
        };
      })
      .filter((item) => item.overflowRight > 4 || item.overflowLeft > 4 || item.width > viewportWidth + 4)
      .sort((a, b) => Math.max(b.overflowRight, b.overflowLeft) - Math.max(a.overflowRight, a.overflowLeft))
      .slice(0, 12);

    const buttons = Array.from(document.querySelectorAll('button, a')).filter(visible);
    const openNavigationButtonVisible = buttons.some((el) =>
      /open navigation/i.test(el.getAttribute('aria-label') || el.textContent || ''),
    );
    const mobileDrawerVisible = Boolean(
      Array.from(document.querySelectorAll('button[aria-label="Close navigation"]')).find(visible),
    );
    const activeNavVisible = Boolean(
      Array.from(document.querySelectorAll('[aria-current="page"], .bg-\\[\\#ebe4ef\\], .text-\\[\\#8f2ee8\\]')).find(visible),
    );

    return {
      viewportWidth,
      documentOverflow: Math.max(0, doc.scrollWidth - doc.clientWidth),
      bodyOverflow: Math.max(0, body.scrollWidth - body.clientWidth),
      mainOverflow: main ? Math.max(0, main.scrollWidth - main.clientWidth) : 0,
      openNavigationButtonVisible,
      mobileDrawerVisible,
      activeNavVisible,
      offenderCount: offenders.length,
      offenders,
    };
  });
}

async function checkRoute(browser, route, width) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width, height: HEIGHT },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedResponses = [];
  const failedRequests = [];
  const pageErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text().slice(0, 500));
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 500)));
  page.on('response', (response) => {
    if (isUnexpectedResponseFailure(response.status(), response.url(), BASE_URL)) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'Request failed'}`);
  });

  try {
    await bootstrapDemoSession(context);
    await installDemoIdentity(context);
    await page.goto(route, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(350);

    const title = await page.title().catch(() => '');
    const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    const layout = await inspectLayout(page);
    const mobileNavOpened =
      width < 768
        ? await page
            .getByLabel(/open navigation/i)
            .click({ timeout: 1500 })
            .then(async () => {
              await page.waitForTimeout(150);
              const afterOpen = await inspectLayout(page);
              return afterOpen.mobileDrawerVisible;
            })
            .catch(() => false)
        : null;

    if (CAPTURE_SCREENSHOTS && mobileNavOpened) {
      const closeNavigationButtons = page.locator('button[aria-label="Close navigation"]');
      await closeNavigationButtons.last().click({ timeout: 1500 }).catch(() => undefined);
      await closeNavigationButtons
        .first()
        .waitFor({ state: 'hidden', timeout: 1500 })
        .catch(async () => {
          await page.keyboard.press('Escape').catch(() => undefined);
        });
      await page.waitForTimeout(200);
    }

    const hasAppContent = !/Sign in to Regovise|Enter your credentials|404/i.test(bodyText) && bodyText.trim().length > 50;
    const maxOverflow = Math.max(layout.documentOverflow, layout.bodyOverflow);
    const usesRegoviseShell = !route.startsWith('/vanta-clone');
    const { passed, failureReasons } = evaluateResponsiveResult({
      hasAppContent,
      maxOverflow,
      maxAllowedOverflow: MAX_ALLOWED_PAGE_OVERFLOW,
      width,
      usesRegoviseShell,
      openNavigationButtonVisible: layout.openNavigationButtonVisible,
      mobileNavOpened,
      consoleErrors,
      pageErrors,
      failedResponses,
      failedRequests,
    });

    const screenshot =
      passed && !CAPTURE_SCREENSHOTS
        ? null
        : path.join(RUN_DIR, `${passed ? 'capture' : 'failure'}-${width}-${routeName(route)}.png`);
    if (screenshot) {
      await fs.mkdir(path.dirname(screenshot), { recursive: true });
      await page.screenshot({ path: screenshot, fullPage: !passed });
    }

    return {
      route,
      width,
      status: passed ? 'passed' : 'failed',
      title,
      hasAppContent,
      maxOverflow,
      mobileNavOpened,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedResponses: [...failedResponses],
      failedRequests: [...failedRequests],
      failureReasons,
      layout,
      screenshot: screenshot ? path.relative(repoRoot, screenshot) : null,
    };
  } catch (error) {
    const screenshot = path.join(RUN_DIR, `error-${width}-${routeName(route)}.png`);
    await fs.mkdir(path.dirname(screenshot), { recursive: true });
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined);
    return {
      route,
      width,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      screenshot: path.relative(repoRoot, screenshot),
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}

async function main() {
  let chromium;
  try {
    ({ chromium } = frontendRequire('playwright'));
  } catch (error) {
    throw new Error(
      `Playwright is required from the frontend workspace. Run the frontend dependency install first. ${error instanceof Error ? error.message : ''}`,
    );
  }
  const routes = MAX_ROUTES > 0 ? ROUTES.slice(0, MAX_ROUTES) : ROUTES;
  await fs.mkdir(RUN_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: HEADLESS });
  const results = [];
  try {
    for (const width of WIDTHS) {
      console.log(`\nWidth ${width}`);
      for (const route of routes) {
        const result = await checkRoute(browser, route, width);
        results.push(result);
        const suffix =
          result.status === 'passed'
            ? ''
            : ` overflow=${result.maxOverflow ?? 'n/a'} screenshot=${result.screenshot ?? 'n/a'}`;
        console.log(`  ${result.status.padEnd(6)} ${route}${suffix}`);
      }
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  const summary = {
    baseUrl: BASE_URL,
    runId: RUN_ID,
    widths: WIDTHS,
    routes,
    total: results.length,
    failed: results.filter((result) => result.status !== 'passed').length,
    results,
  };
  const summaryPath = path.join(RUN_DIR, 'responsive-summary.json');
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(OUTPUT_ROOT, 'latest.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`\nResponsive summary: ${summaryPath}`);
  if (summary.failed > 0) {
    console.error(`${summary.failed} responsive check(s) failed.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
