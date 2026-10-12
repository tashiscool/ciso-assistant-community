import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto, createHash } from 'node:crypto';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ts = createRequire(path.join(repo, 'cloudflare/package.json'))('typescript');
function loader(directory) {
  const loaded = new Map();
  function load(relative) {
    const file = path.join(directory, 'cloudflare/src', relative);
    if (loaded.has(file)) return loaded.get(file);
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {}; loaded.set(file, exports);
    vm.runInNewContext(output, {
      exports, module: { exports }, Request, Response, Headers, URL, URLSearchParams, TextEncoder, TextDecoder, Date, Error, Set, Map, console, crypto: webcrypto,
      require(specifier) { return load(path.normalize(path.join(path.dirname(relative), `${specifier}.ts`))); },
    }, { filename: file });
    return exports;
  }
  return load;
}
function database(t) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  for (const file of fs.readdirSync(path.join(repo, 'cloudflare/migrations')).filter((file) => file.endsWith('.sql')).sort()) db.exec(fs.readFileSync(path.join(repo, 'cloudflare/migrations', file), 'utf8'));
  const binding = { prepare(sql) {
    let values = [];
    return { bind(...args) { values = args; return this; }, async first() { return db.prepare(sql).get(...values) ?? null; }, async all() { return { results: db.prepare(sql).all(...values) }; }, async run() { return db.prepare(sql).run(...values); } };
  } };
  return { db, binding };
}
function context(env, pathname, headers = {}) {
  const request = new Request(`https://regovise.example${pathname}`, { headers });
  return { env, request, url: new URL(request.url), params: {}, tenantId: null, userId: null, authStrategy: 'anonymous' };
}
function coreLoader(directory, workflowRead) {
  const source = fs.readFileSync(path.join(directory, 'cloudflare/src/services/core/http.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const load = loader(directory); const exports = {};
  vm.runInNewContext(output, {
    exports, module: { exports }, Request, Response, Headers, URL, Date, Error, Set, Map, console, crypto: webcrypto,
    require(specifier) {
      if (specifier === '../../authorization') return load('authorization.ts');
      if (specifier === '../../utils/http') return load('utils/http.ts');
      if (specifier === './moduleRegistry') return load('services/core/moduleRegistry.ts');
      if (specifier === '../../utils/workflows') return { getTenantWorkflowSnapshot: workflowRead };
      return {};
    },
  });
  return exports;
}

test('canonical rejects client-selected production and unknown-environment identities on session exchange', async (t) => {
  const { binding } = database(t); const load = loader(repo);
  for (const appEnv of ['production', '', 'staging', undefined]) {
    const result = await load('auth.ts').withAuth(context({ APP_ENV: appEnv, D1_MAIN: binding }, '/_api/core/session/exchange', { 'x-tenant-id': 'tenant-test', 'x-user-id': 'user-test', authorization: 'Bearer user-test' }));
    assert.equal(result.authStrategy, 'anonymous'); assert.equal(result.userId, null);
  }
});
test('canonical preserves explicit development fixtures and verified cookie identity over selected headers', async (t) => {
  const { binding, db } = database(t); const load = loader(repo);
  db.exec("INSERT INTO tenants(id,slug,name) VALUES('tenant-test','test','Test'); INSERT INTO users(id,tenant_id,email) VALUES('user-test','tenant-test','fixture@example.test');");
  db.prepare('INSERT INTO sessions(id,user_id,tenant_id,expires_at) VALUES(?,?,?,?)').run('fixture-session', 'user-test', 'tenant-test', new Date(Date.now() + 60_000).toISOString());
  const headers = { 'x-tenant-id': 'tenant-other', 'x-user-id': 'user-other' };
  const development = await load('auth.ts').withAuth(context({ APP_ENV: 'development', D1_MAIN: binding }, '/_api/core/session/exchange', headers));
  assert.equal(development.authStrategy, 'headers'); assert.equal(development.userId, 'user-other');
  const authenticated = await load('auth.ts').withAuth(context({ APP_ENV: 'production', D1_MAIN: binding }, '/_api/core/session/exchange', { ...headers, cookie: 'ca_session=fixture-session' }));
  assert.equal(authenticated.authStrategy, 'd1-session'); assert.equal(authenticated.userId, 'user-test'); assert.equal(authenticated.tenantId, 'tenant-test');
});
test('canonical malformed/expired cookie cannot crash or authenticate a request', async (t) => {
  const { binding } = database(t); const load = loader(repo);
  for (const cookie of ['ca_session=%E0%A4%A', 'ca_session=%ZZ', 'ca_session=missing-session']) {
    const result = await load('auth.ts').withAuth(context({ APP_ENV: 'production', D1_MAIN: binding }, '/_api/core/session', { cookie }));
    assert.equal(result.authStrategy, 'anonymous');
  }
});
for (const assignment of ['direct-domain', 'group-domain', 'direct-root', 'group-root']) {
  test(`canonical root administration evaluates ${assignment} against migration-derived SQLite`, async (t) => {
    const { binding, db } = database(t); const load = loader(repo);
    db.exec("INSERT INTO tenants(id,slug,name) VALUES('tenant-test','test','Test'); INSERT INTO users(id,tenant_id,email) VALUES('user-test','tenant-test','fixture@example.test'); INSERT INTO folders(id,tenant_id,name,content_type) VALUES('root-test','tenant-test','Root','root'); INSERT INTO folders(id,tenant_id,name,content_type,parent_folder_id) VALUES('domain-test','tenant-test','Domain','domain','root-test'); INSERT INTO roles(id,tenant_id,name) VALUES('role-test','tenant-test','Administrator'); INSERT INTO role_permissions(role_id,permission) VALUES('role-test','change_user'); INSERT INTO user_groups(id,tenant_id,folder_id,name) VALUES('group-test','tenant-test','domain-test','Operators'); INSERT INTO user_group_memberships(user_id,group_id) VALUES('user-test','group-test');");
    const isGroup = assignment.startsWith('group'); const folder = assignment.endsWith('root') ? 'root-test' : 'domain-test';
    db.prepare('INSERT INTO role_assignments(id,tenant_id,role_id,user_id,group_id,scope_folder_id,is_recursive) VALUES(?,?,?,?,?,?,1)').run('assignment-test', 'tenant-test', 'role-test', isGroup ? null : 'user-test', isGroup ? 'group-test' : null, folder);
    const ctx = { ...context({ D1_MAIN: binding }, '/_api/setup/general'), tenantId: 'tenant-test', userId: 'user-test', authStrategy: 'd1-session' };
    const result = await load('authorization.ts').requireRootAdminAccess(ctx);
    if (folder === 'domain-test') assert.equal(result.status, 403);
    else { assert.equal(result.rootFolderId, 'root-test'); assert.equal(result.tenantId, 'tenant-test'); }
  });
}
test('canonical CORS allows configured HTTPS origin and only explicit development loopback', () => {
  const load = loader(repo); const { withCors } = load('utils/http.ts');
  for (const [appEnv, origin, expected] of [['production', 'https://regovise.example', true], ['production', 'https://regovise.example.evil.test', false], ['production', 'http://127.0.0.1:5174', false], ['production', 'null', false], ['', 'http://localhost:5174', false], ['development', 'http://127.0.0.1:5174', true], ['development', 'http://[::1]:5174', true], ['development', 'http://localhost.evil.test:5174', false]]) {
    const response = withCors(new Request('https://regovise.example/_api/core/me', { headers: { origin } }), new Response('{}', { headers: { 'x-existing': 'kept' } }), { APP_ENV: appEnv, APP_ORIGIN: 'https://regovise.example' });
    assert.equal(response.headers.get('access-control-allow-origin'), expected ? origin : null);
    assert.equal(response.headers.get('access-control-allow-credentials'), expected ? 'true' : null);
    assert.equal(response.headers.get('x-existing'), 'kept'); assert.match(response.headers.get('vary'), /Origin/);
  }
});
test('canonical cross-offering and cross-tenant grants fail before object reads or access writes', async (t) => {
  const { binding, db } = database(t); const load = loader(repo); let objectReads = 0;
  db.exec("INSERT INTO tenants(id,slug,name) VALUES('tenant-test','test','Test'),('tenant-other','other','Other');");
  const now = new Date().toISOString();
  for (const key of ['test', 'other']) db.prepare('INSERT INTO trust_center_offerings(id,tenant_id,slug,name,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(`offering-${key}`, `tenant-${key}`, key, key, now, now);
  db.prepare('INSERT INTO artifact_versions(id,offering_id,tenant_id,artifact_kind,title,version_label,status,publication_state,is_public,object_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('artifact-test', 'offering-test', 'tenant-test', 'ssp', 'Test SSP', '1', 'published', 'published', 0, 'fixture', now, now);
  db.prepare('INSERT INTO trust_center_access_grants(id,offering_id,tenant_id,agency_name,contact_email,token_hash,token_hint,status,issued_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('grant-other', 'offering-other', 'tenant-other', 'Fixture', 'fixture@example.test', 'unused', 'test', 'active', now, now, now);
  const env = { D1_MAIN: binding, R2_EVIDENCE: { async get() { objectReads++; throw new Error('Unexpected object read'); } } };
  await assert.rejects(load('services/fedramp/runtime.ts').loadArtifactPayload(env, { artifactId: 'artifact-test', grantId: 'grant-other', portalToken: 'synthetic-token' }), (error) => error.status === 403 && error.code === 'artifact_grant_scope_mismatch');
  assert.equal(objectReads, 0); assert.equal(db.prepare('SELECT count(*) AS total FROM trust_center_access_events').get().total, 0);
  // The real grant/token path must still work for the bound artifact.
  const token = 'synthetic-canonical-token';
  db.prepare('INSERT INTO trust_center_access_grants(id,offering_id,tenant_id,agency_name,contact_email,token_hash,status,issued_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('grant-test', 'offering-test', 'tenant-test', 'Fixture', 'fixture@example.test', createHash('sha256').update(token).digest('hex'), 'active', now, now, now);
  env.R2_EVIDENCE.get = async () => { objectReads++; return { json: async () => ({ fixture: true }) }; };
  const result = await load('services/fedramp/runtime.ts').loadArtifactPayload(env, { artifactId: 'artifact-test', grantId: 'grant-test', portalToken: token });
  assert.equal(result.payload.fixture, true); assert.equal(objectReads, 1);
  assert.equal(db.prepare('SELECT count(*) AS total FROM trust_center_access_events').get().total, 2);
});
test('canonical full-tenant workflow route rejects anonymous and domain-only viewers before DO read', async (t) => {
  const { binding, db } = database(t); let reads = 0;
  const core = coreLoader(repo, async () => { reads++; return { workflowRuns: [] }; });
  const env = { D1_MAIN: binding };
  const anonymous = await core.handleCoreRoutes(['tenants', 'tenant-test', 'workflows'], context(env, '/_api/core/tenants/tenant-test/workflows'));
  assert.equal(anonymous.status, 401); assert.equal(reads, 0);
  db.exec("INSERT INTO tenants(id,slug,name) VALUES('tenant-test','test','Test'); INSERT INTO users(id,tenant_id,email) VALUES('user-test','tenant-test','fixture@example.test'); INSERT INTO folders(id,tenant_id,name,content_type) VALUES('root-test','tenant-test','Root','root'); INSERT INTO folders(id,tenant_id,name,content_type,parent_folder_id) VALUES('domain-test','tenant-test','Domain','domain','root-test'); INSERT INTO roles(id,tenant_id,name) VALUES('role-test','tenant-test','Administrator'); INSERT INTO role_permissions(role_id,permission) VALUES('role-test','change_user'); INSERT INTO role_assignments(id,tenant_id,role_id,user_id,scope_folder_id) VALUES('assignment-test','tenant-test','role-test','user-test','domain-test');");
  const ctx = { ...context(env, '/_api/core/tenants/tenant-test/workflows'), tenantId: 'tenant-test', userId: 'user-test', authStrategy: 'd1-session' };
  const denied = await core.handleCoreRoutes(['tenants', 'tenant-test', 'workflows'], ctx);
  assert.equal(denied.status, 403); assert.equal(reads, 0);
  db.prepare('UPDATE role_assignments SET scope_folder_id = ? WHERE id = ?').run('root-test', 'assignment-test');
  const crossTenant = await core.handleCoreRoutes(['tenants', 'tenant-other', 'workflows'], ctx);
  assert.equal(crossTenant.status, 403); assert.equal(reads, 0);
  const allowed = await core.handleCoreRoutes(['tenants', 'tenant-test', 'workflows'], ctx);
  assert.equal(allowed.status, 200); assert.equal(reads, 1);
});

const http = loader(repo)('utils/http.ts');
const publicEnv = { APP_ENV: 'production', APP_ORIGIN: 'https://regovise.example' };
const jsonRequest = (body, headers = {}) => new Request('https://regovise.example/_api/test', { method: 'POST', headers, body, ...(body instanceof ReadableStream ? { duplex: 'half' } : {}) });

test('canonical JSON reader accepts objects and an empty request without a network call', async () => {
  assert.equal((await http.readJson(jsonRequest('{"fixture":true}'))).fixture, true);
  for (const body of [undefined, '', ' \n\t']) assert.equal(Object.keys(await http.readJson(jsonRequest(body))).length, 0);
});
test('canonical JSON reader rejects malformed syntax and non-object roots with safe 400 errors', async () => {
  for (const body of ['{sensitive-fixture', '[]', '[1]', 'null', 'true', '42', '"sensitive-fixture"']) await assert.rejects(http.readJson(jsonRequest(body)), (error) => {
    assert.equal(error.status, 400); assert.equal(error.code, 'invalid_json'); assert.ok(!error.message.includes('sensitive-fixture')); return true;
  });
});
test('canonical JSON reader counts bytes and handles UTF-8 split across real stream chunks', async () => {
  const bytes = new TextEncoder().encode('{"fixture":"☃"}'); const firstMultibyte = bytes.findIndex((byte) => byte >= 128);
  const stream = new ReadableStream({ start(controller) { controller.enqueue(bytes.slice(0, firstMultibyte + 1)); controller.enqueue(bytes.slice(firstMultibyte + 1)); controller.close(); } });
  const request = jsonRequest(stream); assert.equal((await http.readJson(request)).fixture, '☃'); assert.equal(request.body.locked, false);
});
test('canonical JSON reader rejects invalid and truncated UTF-8 and releases its reader', async () => {
  for (const body of [new Uint8Array([0xff]), new Uint8Array([0xe2, 0x82])]) {
    const request = jsonRequest(body);
    await assert.rejects(http.readJson(request), (error) => error.status === 400 && error.code === 'invalid_json'); assert.equal(request.body.locked, false);
  }
});
test('canonical JSON reader accepts exactly one MiB and rejects a streamed byte beyond the limit', async () => {
  const limit = 1_048_576;
  const atLimit = jsonRequest(`{"v":"${'a'.repeat(limit - 8)}"}`);
  assert.equal((await http.readJson(atLimit)).v.length, limit - 8); assert.equal(atLimit.body.locked, false);
  let cancelled = 0;
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(limit + 1)); }, cancel() { cancelled += 1; } });
  const oversized = jsonRequest(stream);
  await assert.rejects(http.readJson(oversized), (error) => error.status === 413 && error.code === 'request_body_too_large'); assert.equal(cancelled, 1); assert.equal(oversized.body.locked, false);
});
test('canonical JSON reader enforces cumulative stream size even when Content-Length is misleading', async () => {
  const chunk = new Uint8Array(524_288); let cancelled = 0;
  const stream = new ReadableStream({ start(controller) { controller.enqueue(chunk); controller.enqueue(chunk); controller.enqueue(new Uint8Array([32])); }, cancel() { cancelled += 1; } });
  const request = jsonRequest(stream, { 'content-length': '1' });
  await assert.rejects(http.readJson(request), (error) => error.status === 413); assert.equal(cancelled, 1); assert.equal(request.body.locked, false);
});
test('canonical JSON reader returns a safe error for a failed request stream', async () => {
  const stream = new ReadableStream({ start(controller) { controller.error(new Error('sensitive-fixture-stream-error')); } });
  const request = jsonRequest(stream);
  await assert.rejects(http.readJson(request), (error) => error.status === 400 && error.code === 'invalid_json' && !error.message.includes('sensitive-fixture')); assert.equal(request.body.locked, false);
});

test('canonical mutation origin policy allows exact configured origin and HTTPS request origin', () => {
  for (const [target, origin, expected] of [
    ['https://edge.example/_api/test', 'https://regovise.example', true],
    ['https://www.regovise.example/_api/test', 'https://www.regovise.example', true],
    ['https://regovise.example/_api/test', 'https://regovise.example.evil.test', false],
    ['https://regovise.example/_api/test', 'https://evil-regovise.example', false],
    ['https://regovise.example/_api/test', 'http://regovise.example', false],
    ['http://regovise.example/_api/test', 'http://regovise.example', false],
    ['https://regovise.example/_api/test', 'null', false],
    ['https://regovise.example/_api/test', 'https://regovise.example/', false],
    ['https://regovise.example/_api/test', 'https://user:fixture@regovise.example', false],
  ]) assert.equal(http.isAllowedMutationOrigin(new Request(target, { method: 'POST', headers: { origin } }), publicEnv), expected);
});
test('canonical safe HTTP verbs remain allowed without relaxing mutation-origin checks', () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS']) assert.equal(http.isAllowedMutationOrigin(new Request('https://regovise.example/_api/test', { method, headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' } }), publicEnv), true);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(http.isAllowedMutationOrigin(new Request('https://regovise.example/_api/test', { method, headers: { origin: 'https://evil.example' } }), publicEnv), false);
});
test('canonical loopback mutation origins are enabled only by explicit development environment', () => {
  for (const appEnv of ['production', 'staging', '', undefined, 'development']) for (const origin of ['http://127.0.0.1:5174', 'http://localhost:5174', 'http://[::1]:5174']) {
    const request = new Request('https://regovise.example/_api/test', { method: 'POST', headers: { origin } });
    assert.equal(http.isAllowedMutationOrigin(request, { ...publicEnv, APP_ENV: appEnv }), appEnv === 'development');
  }
  assert.equal(http.isAllowedMutationOrigin(new Request('https://regovise.example/_api/test', { method: 'POST', headers: { origin: 'http://localhost.evil.test:5174' } }), { ...publicEnv, APP_ENV: 'development' }), false);
});
test('canonical missing-Origin policy preserves nonbrowser clients while denying explicit cross-site fetch metadata', () => {
  for (const [site, expected] of [[undefined, true], ['none', true], ['same-origin', true], ['same-site', true], ['cross-site', false]]) {
    const request = new Request('https://regovise.example/_api/test', { method: 'POST', headers: site ? { 'sec-fetch-site': site } : {} });
    assert.equal(http.isAllowedMutationOrigin(request, publicEnv), expected);
  }
});
test('canonical origin rejection does not inspect or parse the request body', () => {
  const request = jsonRequest('{"fixture":true}', { origin: 'https://evil.example' }); let reads = 0;
  Object.defineProperty(request, 'body', { get() { reads += 1; throw new Error('Unexpected body parse before origin rejection.'); } });
  assert.equal(http.isAllowedMutationOrigin(request, publicEnv), false); assert.equal(reads, 0);
});
test('canonical CORS clears untrusted cached credentials without discarding response state', () => {
  const request = new Request('https://regovise.example/_api/test', { headers: { origin: 'https://evil.example' } });
  const response = http.withCors(request, new Response('fixture', { status: 202, headers: { 'access-control-allow-origin': 'https://evil.example', 'access-control-allow-credentials': 'true', vary: 'Accept-Encoding', 'x-existing': 'kept' } }), publicEnv);
  assert.equal(response.status, 202); assert.equal(response.headers.get('x-existing'), 'kept'); assert.equal(response.headers.get('access-control-allow-origin'), null); assert.equal(response.headers.get('access-control-allow-credentials'), null); assert.match(response.headers.get('vary'), /Accept-Encoding/); assert.match(response.headers.get('vary'), /Origin/);
});
