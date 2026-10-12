import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { assertLoopbackBaseUrl, evaluateResponsiveResult, isUnexpectedResponseFailure } from './responsive_qa_policy.mjs';

const cleanResult = {
  hasAppContent: true,
  maxOverflow: 0,
  maxAllowedOverflow: 4,
  width: 1440,
  usesRegoviseShell: true,
  openNavigationButtonVisible: false,
  mobileNavOpened: null,
};

test('allows explicit loopback origins and normalizes the origin only', () => {
  for (const [input, expected] of [
    ['http://127.0.0.1:8787/', 'http://127.0.0.1:8787'],
    ['http://localhost:8787', 'http://localhost:8787'],
    ['https://localhost:8787/', 'https://localhost:8787'],
    ['http://[::1]:8787/', 'http://[::1]:8787'],
  ]) assert.equal(assertLoopbackBaseUrl(input), expected);
});

test('rejects remote, credential-bearing or ambiguous targets without echoing their contents', () => {
  for (const input of ['https://regovise.com', 'https://localhost.example.org', 'http://127.0.0.1.example.org', 'http://private:example@localhost:8787', 'http://localhost:8787/path', 'http://localhost:8787/?token=example', 'http://localhost:8787/#fragment', 'ftp://localhost', 'not a URL']) {
    assert.throws(() => assertLoopbackBaseUrl(input), (error) => {
      assert.match(error.message, /loopback/i);
      assert.ok(!error.message.includes(input));
      return true;
    });
  }
});

test('remote target fails before loading Playwright or starting browser/bootstrap work', () => {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const result = spawnSync(process.execPath, [path.join(scriptDir, 'verify_responsive_routes.mjs')], {
    env: { REGOVISE_RESPONSIVE_BASE_URL: 'https://remote.invalid' },
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /only accepts HTTP\(S\) loopback origins/);
  assert.ok(!result.stderr.includes('Playwright is required'));
  assert.ok(!result.stdout.includes('Width'));
});

test('unexpected same-origin API 4xx and any 5xx response count as failures', () => {
  const baseUrl = 'http://127.0.0.1:8787';
  for (const status of [400, 401, 403, 404, 429, 500, 503]) assert.equal(isUnexpectedResponseFailure(status, `${baseUrl}/_api/core/items`, baseUrl), true);
  assert.equal(isUnexpectedResponseFailure(200, `${baseUrl}/_api/core/items`, baseUrl), false);
  assert.equal(isUnexpectedResponseFailure(404, `${baseUrl}/favicon.ico`, baseUrl), false);
  assert.equal(isUnexpectedResponseFailure(404, 'https://assets.invalid/icon.png', baseUrl), false);
  assert.equal(isUnexpectedResponseFailure(503, 'https://assets.invalid/icon.png', baseUrl), true);
});

test('clean desktop and mobile results pass existing structural rules', () => {
  assert.deepEqual(evaluateResponsiveResult(cleanResult), { passed: true, failureReasons: [] });
  assert.deepEqual(evaluateResponsiveResult({ ...cleanResult, width: 390, openNavigationButtonVisible: true, mobileNavOpened: true }), { passed: true, failureReasons: [] });
  assert.equal(evaluateResponsiveResult({ ...cleanResult, width: 390, usesRegoviseShell: false }).passed, true);
});

for (const field of ['consoleErrors', 'pageErrors', 'failedResponses', 'failedRequests']) {
  test(`recorded ${field} prevents a false passed result`, () => {
    const result = evaluateResponsiveResult({ ...cleanResult, [field]: ['Synthetic failure'] });
    assert.equal(result.passed, false);
    assert.equal(result.failureReasons.length, 1);
  });
}

test('content, overflow and mobile navigation failures still fail', () => {
  assert.equal(evaluateResponsiveResult({ ...cleanResult, hasAppContent: false }).passed, false);
  assert.equal(evaluateResponsiveResult({ ...cleanResult, maxOverflow: 5 }).passed, false);
  assert.equal(evaluateResponsiveResult({ ...cleanResult, maxOverflow: Number.NaN }).passed, false);
  assert.equal(evaluateResponsiveResult({ ...cleanResult, width: 390 }).passed, false);
});

test('the browser script disables bootstrap redirects and includes diagnostic failure reasons', () => {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  // Structural assertions complement the executable policy cases. This suite
  // intentionally does not seed a database or launch a browser.
  return import('node:fs/promises').then(async ({ readFile }) => {
    const source = await readFile(path.join(scriptDir, 'verify_responsive_routes.mjs'), 'utf8');
    assert.match(source, /maxRedirects:\s*0/);
    assert.match(source, /page\.on\('requestfailed'/);
    assert.match(source, /evaluateResponsiveResult\(\{/);
    assert.match(source, /failureReasons,/);
  });
});
