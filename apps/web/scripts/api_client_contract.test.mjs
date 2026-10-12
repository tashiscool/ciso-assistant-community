import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const sourceRoot = path.join(webRoot, 'src/shared/api');
const ts = createRequire(path.join(webRoot, 'package.json'))('typescript');

/** Runs the actual TS transport with a fake identity/fetch, never the auth module or network. */
function createSandbox({ authMode = 'session', fetchResult = async () => new Response('{}') } = {}) {
  const calls = [];
  const modules = new Map();
  const identity = { tenantId: 'tenant-example', userId: 'user-example' };
  function load(name) {
    if (modules.has(name)) return modules.get(name);
    const sourcePath = path.join(sourceRoot, `${name}.ts`);
    // import.meta is compile-time Vite configuration. The test uses the default
    // configured API path; explicit baseUrl options are tested independently.
    const source = readFileSync(sourcePath, 'utf8').replaceAll('import.meta.env.VITE_API_BASE_URL', 'undefined');
    const compiled = ts.transpileModule(source, {
      fileName: sourcePath,
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    const errors = (compiled.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
    assert.equal(errors.length, 0, errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'));
    const exports = {};
    modules.set(name, exports);
    vm.runInNewContext(compiled.outputText, {
      exports,
      module: { exports },
      require(specifier) {
        if (specifier === '../session/identity') return { getEdgeIdentity: () => identity, getEdgeAuthMode: () => authMode };
        if (specifier === './response') return load('response');
        if (specifier === './error') return load('error');
        throw new Error(`Unexpected transport test import: ${specifier}`);
      },
      Error,
      JSON,
      Array,
      Response,
      fetch: async (url, init) => { calls.push({ url, init }); return fetchResult(url, init); },
    }, { filename: sourcePath });
    return exports;
  }
  return { ...load('client'), ...load('response'), ...load('error'), calls, identity };
}

test('preserves every valid JSON value and reads the body once', async () => {
  const { readApiResponse } = createSandbox();
  for (const value of [{ data: { id: 'record-1' } }, [], null, false, 0, 'ready']) {
    let reads = 0;
    const response = { status: 200, ok: true, text: async () => { reads += 1; return JSON.stringify(value); } };
    assert.deepEqual(await readApiResponse(response), value);
    assert.equal(reads, 1);
  }
});

test('preserves valid JSON even if the server omits or mislabels content type', async () => {
  const { readApiResponse } = createSandbox();
  const response = new Response('{"data":{"saved":true}}', { headers: { 'content-type': 'text/plain' } });
  assert.deepEqual(await readApiResponse(response), { data: { saved: true } });
});

for (const status of [204, 205]) {
  test(`returns undefined for empty successful ${status} responses`, async () => {
    const { readApiResponse } = createSandbox();
    assert.equal(await readApiResponse(new Response(null, { status })), undefined);
  });
}

test('retains HTTP status, code and explicit structured error details', async () => {
  const { readApiResponse, ApiError } = createSandbox();
  const details = { field: 'title', issue: 'required' };
  await assert.rejects(readApiResponse(new Response(JSON.stringify({ error: 'invalid_input', message: 'A title is required.', details }), { status: 422 })), (error) => {
    assert.ok(error instanceof Error);
    assert.ok(error instanceof ApiError);
    assert.equal(error.name, 'ApiError');
    assert.equal(error.status, 422);
    assert.equal(error.code, 'invalid_input');
    assert.equal(error.message, 'A title is required.');
    assert.deepEqual(error.details, details);
    return true;
  });
});

test('preserves useful JSON error-only messages and an explicit code', async () => {
  const { readApiResponse } = createSandbox();
  await assert.rejects(readApiResponse(new Response('{"error":"Unavailable","code":"source_unavailable"}', { status: 503 })), (error) => {
    assert.equal(error.message, 'Unavailable');
    assert.equal(error.code, 'source_unavailable');
    assert.equal(error.status, 503);
    return true;
  });
});

for (const status of [401, 403, 404, 429, 500]) {
  test(`uses a safe fallback for an empty ${status} error`, async () => {
    const { readApiResponse } = createSandbox();
    await assert.rejects(readApiResponse(new Response('', { status })), (error) => {
      assert.equal(error.message, `Request failed: ${status}`);
      assert.equal(error.status, status);
      assert.equal(error.details, undefined);
      return true;
    });
  });
}

for (const body of ['<!doctype html><title>Internal credential-like text</title>', '{"message":', 'opaque internal response', '["private server data"]', '"private server data"']) {
  test(`does not expose an opaque or non-object error body (${body.startsWith('<') ? 'HTML' : body[0]})`, async () => {
    const { readApiResponse } = createSandbox();
    await assert.rejects(readApiResponse(new Response(body, { status: 502 })), (error) => {
      assert.equal(error.message, 'Request failed: 502');
      assert.equal(error.code, undefined);
      assert.equal(error.details, undefined);
      assert.ok(!String(error).includes(body));
      return true;
    });
  });
}

test('does not promote malformed success or an empty 200 into a successful result', async () => {
  const { readApiResponse, ApiError } = createSandbox();
  for (const [body, code] of [['<html>Internal response</html>', 'invalid_json_response'], ['invalid-json', 'invalid_json_response'], ['', 'empty_response'], ['  ', 'empty_response']]) {
    await assert.rejects(readApiResponse(new Response(body, { status: 200 })), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 200);
      assert.equal(error.code, code);
      assert.ok(!error.message.includes('Internal response'));
      return true;
    });
  }
});

for (const authMode of ['headers', 'session', 'anonymous']) {
  test(`keeps request methods, headers, cookies and body serialization unchanged in ${authMode} mode`, async () => {
    const sandbox = createSandbox({ authMode });
    const client = new sandbox.ApiClient();
    await client.get('/core/items');
    await client.post('/core/items', { name: 'Example' });
    await client.put('/core/items/one', { status: 'open' });
    await client.patch('/core/items/one', { note: 'Updated' });
    await client.delete('/core/items/one');
    assert.deepEqual(sandbox.calls.map(({ init }) => init.method), ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
    assert.deepEqual(sandbox.calls.map(({ url }) => url), ['/_api/core/items', '/_api/core/items', '/_api/core/items/one', '/_api/core/items/one', '/_api/core/items/one']);
    assert.deepEqual(sandbox.calls.map(({ init }) => init.body), [undefined, '{"name":"Example"}', '{"status":"open"}', '{"note":"Updated"}', undefined]);
    for (const { init } of sandbox.calls) {
      assert.equal(init.credentials, 'include');
      assert.equal(init.headers['content-type'], 'application/json');
      assert.equal(init.headers['x-tenant-id'], authMode === 'headers' ? sandbox.identity.tenantId : undefined);
      assert.equal(init.headers['x-user-id'], authMode === 'headers' ? sandbox.identity.userId : undefined);
      assert.equal(Object.keys(init.headers).length, authMode === 'headers' ? 3 : 1);
    }
  });
}

test('keeps explicit baseUrl and body omission behavior unchanged', async () => {
  const sandbox = createSandbox();
  const client = new sandbox.ApiClient({ baseUrl: '/custom/' });
  await client.post('/items');
  assert.equal(sandbox.calls[0].url, '/custom//items');
  assert.equal(sandbox.calls[0].init.body, undefined);
});

test('propagates a network error without retrying or changing it into HTTP success', async () => {
  const failure = new TypeError('Synthetic offline request');
  const sandbox = createSandbox({ fetchResult: async () => { throw failure; } });
  const client = new sandbox.ApiClient();
  await assert.rejects(client.post('/core/items', { name: 'Example' }), (error) => error === failure);
  assert.equal(sandbox.calls.length, 1);
});

test('client routes parser errors through its existing public methods', async () => {
  const sandbox = createSandbox({ fetchResult: async () => new Response('<html>Internal response</html>', { status: 500 }) });
  const client = new sandbox.ApiClient();
  await assert.rejects(client.get('/core/items'), (error) => error instanceof sandbox.ApiError && error.status === 500 && error.message === 'Request failed: 500');
});
