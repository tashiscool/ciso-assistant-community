import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { AwsClient } from 'aws4fetch';
import ts from 'typescript';
import { DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS, providerRequest } from '../src/utils/providerRequest.ts';

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('Unexpected live network call in provider request contract test.'); };
after(() => { globalThis.fetch = originalFetch; });

test('provider request consumes one successful response without changing its result', async () => {
  let calls = 0;
  const value = await providerRequest(
    async (signal) => {
      calls += 1;
      assert.equal(signal.aborted, false);
      return new Response(JSON.stringify({ items: ['observed'] }), {
        status: 201,
        headers: { 'content-type': 'application/json', 'x-provider-result': 'actual' },
      });
    },
    async (response) => {
      assert.equal(response.status, 201);
      assert.equal(response.headers.get('x-provider-result'), 'actual');
      return response.json();
    },
  );
  assert.deepEqual(value, { items: ['observed'] });
  assert.equal(calls, 1);
});

async function bounded(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('deadline_not_enforced')), 200); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

test('provider request rejects a noncooperative fetch at the configured deadline', async () => {
  let signal;
  let consumes = 0;
  await assert.rejects(bounded(providerRequest(
    async (requestSignal) => { signal = requestSignal; return new Promise(() => {}); },
    () => { consumes += 1; },
    { timeoutMs: 10 },
  )), (error) => error.code === 'provider_request_timeout');
  assert.equal(signal.aborted, true);
  assert.equal(consumes, 0);
});

test('an already cancelled caller does not start a provider operation or disclose its reason', async () => {
  const caller = new AbortController();
  caller.abort(new Error('sensitive-caller-reason'));
  let calls = 0;
  await assert.rejects(providerRequest(
    async () => { calls += 1; return new Response('{}'); },
    (response) => response.json(),
    { signal: caller.signal },
  ), (error) => error.code === 'provider_request_aborted' && !error.message.includes('sensitive'));
  assert.equal(calls, 0);
});

test('invalid deadlines fail before starting the provider', async () => {
  for (const timeoutMs of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648]) {
    let calls = 0;
    await assert.rejects(providerRequest(
      async () => { calls += 1; return new Response('{}'); },
      (response) => response.json(),
      { timeoutMs },
    ), RangeError);
    assert.equal(calls, 0);
  }
});

test('the default request deadline is thirty seconds', () => {
  assert.equal(DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS, 30_000);
});

test('a noncooperative response body is included in the deadline', async () => {
  let signal;
  let consumes = 0;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); } });
  await assert.rejects(bounded(providerRequest(
    async (requestSignal) => { signal = requestSignal; return new Response(body); },
    async (response) => { consumes += 1; return response.json(); },
    { timeoutMs: 10 },
  )), (error) => error.code === 'provider_request_timeout');
  assert.equal(signal.aborted, true);
  assert.equal(consumes, 1);
});

test('caller cancellation stops a noncooperative fetch without disclosing its reason', async () => {
  const caller = new AbortController();
  let signal;
  let started;
  const startedPromise = new Promise((resolve) => { started = resolve; });
  const pending = providerRequest(
    async (requestSignal) => { signal = requestSignal; started(); return new Promise(() => {}); },
    (response) => response.json(),
    { signal: caller.signal },
  );
  await startedPromise;
  caller.abort(new Error('sensitive-caller-reason'));
  await assert.rejects(bounded(pending), (error) => error.code === 'provider_request_aborted' && !error.message.includes('sensitive'));
  assert.equal(signal.aborted, true);
});

test('caller cancellation also bounds a noncooperative body consumer', async () => {
  const caller = new AbortController();
  let signal;
  await assert.rejects(bounded(providerRequest(
    async (requestSignal) => { signal = requestSignal; return new Response('{}'); },
    () => { caller.abort(); return new Promise(() => {}); },
    { signal: caller.signal },
  )), (error) => error.code === 'provider_request_aborted');
  assert.equal(signal.aborted, true);
});

test('cancellation before the deferred operation begins avoids a provider call', async () => {
  const caller = new AbortController();
  let calls = 0;
  const pending = providerRequest(
    async () => { calls += 1; return new Response('{}'); },
    (response) => response.json(),
    { signal: caller.signal },
  );
  caller.abort();
  await assert.rejects(pending, (error) => error.code === 'provider_request_aborted');
  assert.equal(calls, 0);
});

test('late fetch success after timeout does not run the body consumer', async () => {
  let resolveFetch;
  let consumes = 0;
  let bodyCancelled = false;
  const pending = providerRequest(
    () => new Promise((resolve) => { resolveFetch = resolve; }),
    () => { consumes += 1; },
    { timeoutMs: 10 },
  );
  await assert.rejects(bounded(pending), (error) => error.code === 'provider_request_timeout');
  resolveFetch(new Response(new ReadableStream({ cancel() { bodyCancelled = true; } })));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(consumes, 0);
  assert.equal(bodyCancelled, true);
});

test('HTTP error status and body remain caller-owned without automatic retries', async () => {
  let calls = 0;
  const result = await providerRequest(
    async () => { calls += 1; return new Response('{"error":"rate_limited"}', { status: 429 }); },
    async (response) => ({ status: response.status, body: await response.json() }),
  );
  assert.deepEqual(result, { status: 429, body: { error: 'rate_limited' } });
  assert.equal(calls, 1);
});

test('request and body-consumer failures retain their existing error contract', async () => {
  const failure = new Error('provider_fixture_error');
  await assert.rejects(providerRequest(async () => { throw failure; }, (response) => response.text()), (error) => error === failure);
  await assert.rejects(providerRequest(async () => new Response('invalid-json'), (response) => response.json()), SyntaxError);
});

test('an elapsed deadline is enforced before body consumption even when the timer is delayed', async (context) => {
  let clock = 1000;
  let consumes = 0;
  context.mock.method(Date, 'now', () => clock);
  await assert.rejects(providerRequest(
    async () => { clock += 20; return new Response('{}'); },
    () => { consumes += 1; },
    { timeoutMs: 10 },
  ), (error) => error.code === 'provider_request_timeout');
  assert.equal(consumes, 0);
});

test('a body result completed beyond its deadline is not returned as success', async (context) => {
  let clock = 1000;
  context.mock.method(Date, 'now', () => clock);
  await assert.rejects(providerRequest(
    async () => new Response('{}'),
    () => { clock += 20; return 'late result'; },
    { timeoutMs: 10 },
  ), (error) => error.code === 'provider_request_timeout');
});

function trackResources(context, signal) {
  const activeTimers = new Set();
  const abortListeners = new Set();
  const nativeSetTimeout = globalThis.setTimeout;
  const nativeClearTimeout = globalThis.clearTimeout;
  const nativeAdd = signal.addEventListener.bind(signal);
  const nativeRemove = signal.removeEventListener.bind(signal);
  context.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    const timer = nativeSetTimeout(callback, delay, ...args);
    activeTimers.add(timer);
    return timer;
  });
  context.mock.method(globalThis, 'clearTimeout', (timer) => { activeTimers.delete(timer); nativeClearTimeout(timer); });
  context.mock.method(signal, 'addEventListener', (type, listener, options) => {
    if (type === 'abort') abortListeners.add(listener);
    nativeAdd(type, listener, options);
  });
  context.mock.method(signal, 'removeEventListener', (type, listener, options) => {
    if (type === 'abort') abortListeners.delete(listener);
    nativeRemove(type, listener, options);
  });
  return { activeTimers, abortListeners };
}

for (const outcome of ['success', 'request-failure', 'body-failure', 'timeout', 'caller-abort']) {
  test(`timers and caller listeners are released after ${outcome}`, async (context) => {
    const caller = new AbortController();
    const resources = trackResources(context, caller.signal);
    const pending = providerRequest(
      async () => {
        if (outcome === 'request-failure') throw new Error('fixture_failure');
        if (outcome === 'timeout') return new Promise(() => {});
        return new Response('{}');
      },
      (response) => {
        if (outcome === 'body-failure') throw new Error('fixture_failure');
        if (outcome === 'caller-abort') { caller.abort(); return new Promise(() => {}); }
        return response.json();
      },
      { signal: caller.signal, timeoutMs: 10 },
    );
    if (outcome === 'success') await pending;
    else await assert.rejects(bounded(pending));
    assert.equal(resources.activeTimers.size, 0);
    assert.equal(resources.abortListeners.size, 0);
  });
}

test('AWS signing preserves the propagated signal and the existing read request', async (context) => {
  const caller = new AbortController();
  const aws = new AwsClient({ accessKeyId: 'fixture-only-access', secretAccessKey: 'fixture-only-secret', service: 'ec2', region: 'us-east-1', retries: 0 });
  let request;
  context.mock.method(globalThis, 'fetch', async (input) => { request = input; return new Response('<inventory/>'); });
  const payload = await providerRequest(
    (signal) => aws.fetch('https://ec2.us-east-1.amazonaws.com/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: 'Action=DescribeInstances&Version=2016-11-15',
      signal,
    }),
    (response) => response.text(),
    { signal: caller.signal },
  );
  assert.equal(payload, '<inventory/>');
  assert.equal(request.method, 'POST');
  assert.equal(await request.text(), 'Action=DescribeInstances&Version=2016-11-15');
  assert.equal(request.headers.get('content-type'), 'application/x-www-form-urlencoded; charset=utf-8');
  assert.ok(request.headers.get('authorization').startsWith('AWS4-HMAC-SHA256 '));
  assert.equal(request.signal.aborted, false);
});

test('caller abort reaches an actual AWS signed Request while its fetch is pending', async (context) => {
  const caller = new AbortController();
  const aws = new AwsClient({ accessKeyId: 'fixture-only-access', secretAccessKey: 'fixture-only-secret', service: 's3', region: 'us-east-1', retries: 0 });
  let request;
  let started;
  const startedPromise = new Promise((resolve) => { started = resolve; });
  context.mock.method(globalThis, 'fetch', async (input) => { request = input; started(); return new Promise(() => {}); });
  const pending = providerRequest(
    (signal) => aws.fetch('https://s3.us-east-1.amazonaws.com/', { signal }),
    (response) => response.text(),
    { signal: caller.signal },
  );
  await startedPromise;
  caller.abort();
  await assert.rejects(bounded(pending), (error) => error.code === 'provider_request_aborted');
  assert.equal(request.signal.aborted, true);
});

// Compile the actual collector module with the existing TypeScript dev dependency.
// Only import resolution changes for Node; tests call its public entry point.
async function loadCollectorModule() {
  const source = await readFile(new URL('../src/services/grc-engine/collectors.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, specifier) => {
    const resolved = specifier === '../../utils/providerRequest'
      ? new URL('../src/utils/providerRequest.ts', import.meta.url).href
      : import.meta.resolve(specifier);
    return `from ${quote}${resolved}${quote}`;
  });
  return import(`data:text/javascript,${encodeURIComponent(compiled)}`);
}
const collectors = loadCollectorModule();

function fixtureConnector(config, baseUrl = 'https://provider.example.invalid') {
  return { id: 'fixture', name: 'Fixture provider', provider: 'fixture', category: 'fixture', authMode: 'fixture', baseUrl, status: 'configured', isEnabled: true, config, capabilities: [], lastError: null };
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('native GitHub collection retains request headers, response parsing and findings', async (context) => {
  const calls = [];
  context.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, init });
    assert.equal(init.signal.aborted, false);
    if (url.endsWith('/protection')) return jsonResponse({ required_pull_request_reviews: { required_approving_review_count: 1 }, required_status_checks: { contexts: ['ci'] } });
    return jsonResponse({ default_branch: 'main', security_and_analysis: { code_scanning: { status: 'enabled' }, secret_scanning: { status: 'enabled' } } });
  });
  const { collectNativeFindings } = await collectors;
  const result = await collectNativeFindings({ APP_ENV: 'production' }, 'github', fixtureConnector({ token: 'fixture-token', repository: 'fixture/repo' }));
  assert.equal(result.mode, 'live');
  assert.equal(result.findings.length, 3);
  assert.ok(result.findings.every((finding) => finding.source === 'github' && finding.evaluations[0].status === 'pass'));
  assert.deepEqual(calls.map((call) => call.url), ['https://provider.example.invalid/repos/fixture/repo', 'https://provider.example.invalid/repos/fixture/repo/branches/main/protection']);
  for (const call of calls) {
    assert.equal(call.init.headers.Authorization, 'Bearer fixture-token');
    assert.equal(call.init.headers['X-GitHub-Api-Version'], '2022-11-28');
    assert.equal(call.init.method, undefined);
  }
});

test('native Wiz collection preserves credential acquisition and read-only query payloads', async (context) => {
  const calls = [];
  context.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/oauth/token')) return jsonResponse({ access_token: 'fixture-access-token' });
    return jsonResponse({ data: { issuesV2: { nodes: [{ id: 'issue-fixture', title: 'Fixture issue', severity: 'high', status: 'open', type: 'configuration', entitySnapshot: { name: 'Fixture resource' } }] } } });
  });
  const { collectNativeFindings } = await collectors;
  const result = await collectNativeFindings({ APP_ENV: 'production' }, 'wiz', fixtureConnector({ clientId: 'fixture-client', clientSecret: 'fixture-secret' }));
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].evaluations[0].status, 'fail');
  assert.deepEqual(JSON.parse(calls[0].init.body), { client_id: 'fixture-client', client_secret: 'fixture-secret', audience: 'wiz-api', grant_type: 'client_credentials' });
  const query = JSON.parse(calls[1].init.body);
  assert.equal(query.variables.first, 5);
  assert.match(query.query, /query RegoviseIssues/);
  assert.equal(calls[1].init.headers.Authorization, 'Bearer fixture-access-token');
  assert.ok(calls.every((call) => call.init.method === 'POST' && !call.init.signal.aborted));
});

test('native Okta collection retains parallel scoped reads and the existing failure contract', async (context) => {
  let failed = false;
  const calls = [];
  context.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push(url);
    assert.equal(init.headers.Authorization, 'SSWS fixture-token');
    assert.equal(init.signal.aborted, false);
    if (failed) return jsonResponse({ error: 'fixture_forbidden' }, 403);
    return jsonResponse(url.endsWith('/roles') ? [{ id: 'role-fixture' }] : [{ factorType: 'webauthn', status: 'active' }]);
  });
  const { collectNativeFindings } = await collectors;
  const connector = fixtureConnector({ apiToken: 'fixture-token' });
  const result = await collectNativeFindings({ APP_ENV: 'production' }, 'okta', connector);
  assert.equal(result.findings.length, 2);
  assert.ok(result.findings.every((finding) => finding.evaluations[0].status === 'pass'));
  assert.deepEqual(calls.sort(), ['https://provider.example.invalid/api/v1/org/factors', 'https://provider.example.invalid/api/v1/roles']);
  failed = true;
  await assert.rejects(collectNativeFindings({ APP_ENV: 'production' }, 'okta', connector), /Okta API request failed \(403\)/);
});
