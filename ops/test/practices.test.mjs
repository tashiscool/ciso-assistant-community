import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { localConfig, isolatedEnvironment, child, installLoopbackFetchGuard, scfFixtureResponses, cleanupDiagnostics } from '../local/run_worker.mjs';
import { sourceFingerprint } from '../lib/repository.mjs';
test('isolated configuration has fresh fake D1 identity, no remote AI/secrets/cron, and local origin', () => {
  const config = localConfig('/tmp/regovise-unit', 9123);
  assert.equal(config.vars.APP_ENV, 'development'); assert.equal(config.vars.EMAIL_PROVIDER, 'none'); assert.equal(config.vars.SERVICE_DELIVERY_ENABLED, 'false');
  assert.equal(config.vars.APP_ORIGIN, 'http://127.0.0.1:9123'); assert.equal(config.d1_databases[0].database_id, '00000000-0000-0000-0000-000000000001');
  assert.equal(config.ai, undefined); assert.equal(config.vectorize, undefined); assert.equal(config.triggers, undefined); assert.equal(config.routes, undefined);
  assert.equal(JSON.stringify(config).includes('api_token'), false);
});
test('isolated child environment excludes inherited credentials and uses its own Wrangler configuration/cache', () => {
  const env = isolatedEnvironment('/tmp/regovise-unit');
  assert.equal(env.WRANGLER_SEND_METRICS, 'false'); assert.equal(env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV, 'false');
  assert.equal(env.XDG_CONFIG_HOME, '/tmp/regovise-unit/config'); assert.equal(env.CLOUDFLARE_API_TOKEN, undefined); assert.equal(env.BOOTSTRAP_SETUP_SECRET, undefined); assert.equal(env.OPENAI_API_KEY, undefined);
});
test('source fingerprint is deterministic and includes working-tree source, not only commit identity', async () => {
  const first = await sourceFingerprint(); const second = await sourceFingerprint(); assert.equal(first, second); assert.match(first, /^[a-f0-9]{64}$/);
});

test('cleanup diagnostics preserve owned process outcomes and distinguish execution failure from incomplete cleanup', () => {
  const children = [{ proc: { pid: 101 } }, { proc: { pid: 102 } }, { proc: {} }];
  const outcomes = [{ code: 7, signal: null }, { code: null, signal: 'SIGKILL', timedOut: true, cleanupTimedOut: true, logError: 'Synthetic log error' }, { cleanupError: 'Synthetic cleanup exception', error: 'Synthetic spawn exception', unreviewedDetail: 'Not part of the receipt' }];
  const diagnostics = cleanupDiagnostics(children, outcomes);
  assert.equal(diagnostics.failed, true); assert.match(diagnostics.error, /cleanup did not complete.*cleanup.checks/);
  assert.equal(diagnostics.checks.length, 3);
  assert.equal(diagnostics.checks[0].pid, 101); assert.equal(diagnostics.checks[0].code, 7);
  assert.equal(diagnostics.checks[1].ownedProcessGroup, process.platform === 'win32' ? null : 102);
  assert.equal(diagnostics.checks[1].signal, 'SIGKILL'); assert.equal(diagnostics.checks[1].timedOut, true); assert.equal(diagnostics.checks[1].cleanupTimedOut, true); assert.equal(diagnostics.checks[1].logError, 'Synthetic log error');
  assert.equal(diagnostics.checks[2].pid, null); assert.equal(diagnostics.checks[2].cleanupError, 'Synthetic cleanup exception'); assert.equal(diagnostics.checks[2].error, 'Synthetic spawn exception'); assert.equal(diagnostics.checks[2].unreviewedDetail, undefined);
  const cleanedExecutionFailure = cleanupDiagnostics([children[0]], [outcomes[0]]);
  assert.equal(cleanedExecutionFailure.failed, false); assert.equal(cleanedExecutionFailure.error, null);
});

test('isolated fetch rejects nonloopback, other local origins and credentials before transport', async (context) => {
  let calls = 0;
  context.mock.method(globalThis, 'fetch', async () => { calls += 1; return new Response('{}'); });
  const restore = installLoopbackFetchGuard('http://127.0.0.1:9123');
  try {
    for (const url of ['https://provider.example.invalid/', 'http://127.0.0.1:9124/', 'http://localhost.example.invalid/', 'http://user:fixture@127.0.0.1:9123/', 'file:///tmp/example']) {
      await assert.rejects(fetch(url), /blocked|loopback/);
    }
    assert.equal(calls, 0);
    await fetch('http://127.0.0.1:9123/health');
    assert.equal(calls, 1);
  } finally { restore(); }
});

test('isolated fetch disables native redirect following while preserving method and body', async (context) => {
  let actual;
  context.mock.method(globalThis, 'fetch', async (request, init) => {
    actual = { request, init };
    return new Response(null, { status: 302, headers: { location: 'https://provider.example.invalid/' } });
  });
  const restore = installLoopbackFetchGuard('http://127.0.0.1:9123');
  try {
    const result = await fetch('http://127.0.0.1:9123/fixture', { method: 'POST', body: 'fixture-body' });
    assert.equal(result.status, 302);
    assert.equal(actual.init.redirect, 'manual');
    assert.equal(actual.request.method, 'POST');
    assert.equal(await actual.request.text(), 'fixture-body');
  } finally { restore(); }
});

test('SCF fixture transport responds only to its exact synthetic GET allowlist without contacting a provider', async (context) => {
  let transports = 0;
  context.mock.method(globalThis, 'fetch', async () => { transports += 1; return new Response('{}'); });
  const fixtures = scfFixtureResponses();
  const restore = installLoopbackFetchGuard('http://127.0.0.1:9123', fixtures);
  try {
    for (const [url, expected] of Object.entries(fixtures)) {
      const response = await fetch(new Request(url));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('x-regovise-provider-fixture'), 'synthetic-scf/regovise-test-fixture');
      assert.deepEqual(await response.json(), expected);
    }
    const summaryUrl = 'https://grcengclub.github.io/scf-api/api/summary.json';
    for (const url of [`${summaryUrl}?extra=true`, 'https://grcengclub.github.io/scf-api/api/controls/REAL-CONTROL.json', 'https://another.example.invalid/api/summary.json']) await assert.rejects(fetch(url), /Outbound HTTP is blocked/);
    for (const method of ['POST', 'PUT', 'DELETE']) await assert.rejects(fetch(summaryUrl, { method }), /Outbound HTTP is blocked/);
    assert.equal(transports, 0);
    assert.equal(fixtures[summaryUrl].version, 'regovise-test-fixture');
    for (const [url, body] of Object.entries(fixtures)) if (url.includes('/controls/')) { assert.match(body.control_id, /^TEST-/); assert.match(body.title, /^SYNTHETIC TEST ONLY:/); }
  } finally { restore(); }
});

async function childFixture(context) {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'regovise-owned-child-test-'));
  const fixture = { scratch, logPath: path.join(scratch, 'child.log'), env: isolatedEnvironment(scratch), owned: null };
  context.after(async () => { if (fixture.owned) await fixture.owned.terminate(); await fs.rm(scratch, { recursive: true, force: true }); });
  return fixture;
}

test('owned child completion waits until both output streams are fully flushed', async (context) => {
  const fixture = await childFixture(context);
  const script = `process.stdout.write('stdout-start\\n'); process.stderr.write('stderr-start\\n'); process.stdout.write('x'.repeat(500000)); process.stdout.write('stdout-end\\n'); process.stderr.write('stderr-end\\n');`;
  const owned = await child(process.execPath, ['-e', script], fixture.scratch, fixture.env, fixture.logPath, { timeoutMs: 5000 });
  fixture.owned = owned;
  const result = await owned.done;
  assert.equal(result.code, 0); assert.equal(result.logError, undefined);
  const log = await fs.readFile(fixture.logPath, 'utf8');
  for (const marker of ['stdout-start', 'stderr-start', 'stdout-end', 'stderr-end']) assert.ok(log.includes(marker));
  assert.equal((log.match(/x/g) ?? []).length, 500000);
});

test('owned child deadline force-stops a process that ignores graceful termination', async (context) => {
  const fixture = await childFixture(context);
  const owned = await child(process.execPath, ['-e', "process.on('SIGTERM', () => {}); console.log('started'); setInterval(() => {}, 1000);"], fixture.scratch, fixture.env, fixture.logPath, { timeoutMs: 500, graceMs: 50 });
  fixture.owned = owned;
  const result = await owned.done;
  assert.equal(result.timedOut, true); assert.equal(result.signal, 'SIGKILL');
  assert.equal(result.cleanupTimedOut, undefined);
  assert.ok((await fs.readFile(fixture.logPath, 'utf8')).includes('started'));
  if (process.platform !== 'win32') assert.throws(() => process.kill(-owned.proc.pid, 0), (error) => error.code === 'ESRCH');
});

test('spawn failure closes its log and reports a bounded failure', async (context) => {
  const fixture = await childFixture(context);
  const owned = await child(path.join(fixture.scratch, 'missing-binary'), [], fixture.scratch, fixture.env, fixture.logPath, { timeoutMs: 1000 });
  fixture.owned = owned;
  const result = await owned.done;
  assert.match(result.error, /ENOENT/);
  assert.match(await fs.readFile(fixture.logPath, 'utf8'), /Child could not start/);
});

test('natural parent exit still cleans only its owned process-group descendant', { skip: process.platform === 'win32' }, async (context) => {
  const fixture = await childFixture(context);
  const script = `const {spawn}=require('node:child_process'); const descendant=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)"],{stdio:'ignore'}); console.log(descendant.pid); descendant.unref(); setTimeout(()=>process.exit(0),200);`;
  const owned = await child(process.execPath, ['-e', script], fixture.scratch, fixture.env, fixture.logPath, { timeoutMs: 5000, graceMs: 50 });
  fixture.owned = owned;
  const result = await owned.done;
  assert.equal(result.code, 0); assert.equal(result.cleanupTimedOut, undefined);
  assert.throws(() => process.kill(-owned.proc.pid, 0), (error) => error.code === 'ESRCH');
});
