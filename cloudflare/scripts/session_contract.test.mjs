import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto, createHash } from 'node:crypto';
import ts from 'typescript';
import test from 'node:test';
import assert from 'node:assert/strict';

const workerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadSessionModules() {
  const cache = new Map();
  function load(relative) {
    const file = path.join(workerRoot, 'src', relative);
    if (cache.has(file)) return cache.get(file);
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {}; cache.set(file, exports);
    vm.runInNewContext(output, {
      exports, module: { exports }, Request, Response, Headers, URL, TextEncoder, TextDecoder, Date, console, crypto: webcrypto,
      require(specifier) { return load(path.normalize(path.join(path.dirname(relative), `${specifier}.ts`))); },
    }, { filename: file });
    return exports;
  }
  return { session: load('session.ts'), auth: load('auth.ts'), load };
}
const { session, auth, load: loadCanonical } = loadSessionModules();
const digestId = (token) => `sha256:${createHash('sha256').update(token).digest('hex')}`;

function database(t) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  for (const file of fs.readdirSync(path.join(workerRoot, 'migrations')).filter((file) => file.endsWith('.sql')).sort()) db.exec(fs.readFileSync(path.join(workerRoot, 'migrations', file), 'utf8'));
  db.exec("INSERT INTO tenants(id,slug,name) VALUES('tenant-test','test','Test'),('tenant-other','other','Other'); INSERT INTO users(id,tenant_id,email) VALUES('user-test','tenant-test','fixture@example.test'),('user-second','tenant-test','second@example.test'),('user-other','tenant-other','other@example.test');");
  const state = { reads: 0, writes: 0, beforeRun: null, afterFirst: null, beforeBatch: null, failAfterBatch: false };
  const binding = { prepare(sql) {
    let values = [];
    return {
      bind(...args) { values = args; return this; },
      async first() { state.reads += 1; const result = db.prepare(sql).get(...values) ?? null; await state.afterFirst?.(sql, result); return result; },
      async all() { state.reads += 1; return { results: db.prepare(sql).all(...values) }; },
      async run() { state.beforeRun?.(sql); state.writes += 1; const result = db.prepare(sql).run(...values); return { success: true, meta: { changes: result.changes } }; },
    };
  }, async batch(statements) {
    await state.beforeBatch?.();
    db.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      if (state.failAfterBatch) throw new Error('Synthetic transaction failure.');
      db.exec('COMMIT');
      return results;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  } };
  return { db, state, env: { APP_ENV: 'production', D1_MAIN: binding } };
}
const request = () => new Request('https://regovise.example/_api/core/session', { headers: { 'cf-connecting-ip': '192.0.2.1', 'user-agent': 'Synthetic session contract' } });
const input = { tenantId: 'tenant-test', userId: 'user-test' };
function insertSession(db, token, overrides = {}) {
  const row = { id: token, userId: 'user-test', tenantId: 'tenant-test', expiresAt: new Date(Date.now() + 60_000).toISOString(), ...overrides };
  db.prepare('INSERT INTO sessions(id,user_id,tenant_id,expires_at) VALUES(?,?,?,?)').run(row.id, row.userId, row.tenantId, row.expiresAt);
}
function setCredential(db, hash = 'a'.repeat(64), tenantId = 'tenant-test') {
  const now = new Date().toISOString();
  db.prepare('INSERT INTO local_password_credentials(user_id,tenant_id,password_hash,password_salt,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('user-test', tenantId, hash, 'synthetic-salt', now, now);
}
function authContext(env, cookie) {
  const req = new Request('https://regovise.example/_api/core/session', { headers: cookie ? { cookie } : {} });
  return { env, request: req, url: new URL(req.url), params: {}, tenantId: null, userId: null, authStrategy: 'anonymous' };
}

test('new session storage contains the token digest, with a distinct credential for the cookie', async (t) => {
  const { db, env } = database(t); const created = await session.createSession(env, request(), input);
  assert.match(created.token, /^[a-f0-9]{64}$/); assert.equal(created.id, digestId(created.token)); assert.notEqual(created.id, created.token);
  assert.equal(db.prepare('SELECT count(*) AS total FROM sessions WHERE id = ?').get(created.token).total, 0);
  const stored = db.prepare('SELECT * FROM sessions WHERE id = ?').get(created.id);
  assert.equal(stored.user_id, 'user-test'); assert.equal(stored.tenant_id, 'tenant-test'); assert.equal(stored.ip_address, '192.0.2.1');
  const authenticated = await session.getSessionById(env, created.token);
  assert.equal(authenticated.id, created.id);
  const cookie = session.buildSessionCookieHeader(created.token, created.expires_at, true);
  assert.ok(cookie.includes(`ca_session=${created.token}`)); assert.ok(cookie.includes('HttpOnly') && cookie.includes('SameSite=Lax') && cookie.includes('Secure'));
  assert.equal(session.getSessionIdFromRequest(new Request('https://regovise.example/', { headers: { cookie } })), created.token);
});
test('stored digest identifiers cannot authenticate or revoke a session without its token', async (t) => {
  const { db, env, state } = database(t); const created = await session.createSession(env, request(), input); const before = state.reads;
  assert.equal(await session.getSessionById(env, created.id), null); assert.equal(state.reads, before);
  const authenticated = await auth.withAuth(authContext(env, `ca_session=${encodeURIComponent(created.id)}`));
  assert.equal(authenticated.authStrategy, 'anonymous');
  await session.deleteSession(env, created.id);
  assert.equal(db.prepare('SELECT count(*) AS total FROM sessions').get().total, 1);
});
test('session issuance produces independent credentials for separate logins', async (t) => {
  const { db, env } = database(t); const first = await session.createSession(env, request(), input); const second = await session.createSession(env, request(), input);
  assert.notEqual(first.token, second.token); assert.notEqual(first.id, second.id); assert.equal(db.prepare('SELECT count(*) AS total FROM sessions').get().total, 2);
});
test('valid legacy cookies upgrade their stored token without changing their browser credential', async (t) => {
  const { db, env, state } = database(t); const token = 'synthetic-legacy-session'; insertSession(db, token);
  const migrated = await session.getSessionById(env, token);
  assert.equal(migrated.id, digestId(token)); assert.equal(db.prepare('SELECT count(*) AS total FROM sessions WHERE id = ?').get(token).total, 0);
  assert.equal(db.prepare('SELECT count(*) AS total FROM sessions WHERE id = ?').get(digestId(token)).total, 1);
  const writes = state.writes; assert.equal((await session.getSessionById(env, token)).id, digestId(token)); assert.equal(state.writes, writes);
});
test('legacy session_id cookies remain usable through the canonical auth path and lazy upgrade', async (t) => {
  const { db, env } = database(t); insertSession(db, 'legacy-cookie-token');
  const result = await auth.withAuth(authContext(env, 'session_id=legacy-cookie-token'));
  assert.equal(result.authStrategy, 'd1-session'); assert.equal(result.userId, 'user-test'); assert.equal(result.tenantId, 'tenant-test');
  assert.equal(db.prepare('SELECT count(*) AS total FROM sessions WHERE id = ?').get('legacy-cookie-token').total, 0);
});
test('logout removes both the hashed row and a remaining legacy copy of the same credential', async (t) => {
  const { db, env } = database(t); const token = 'legacy-and-hashed-copy'; insertSession(db, token); insertSession(db, token, { id: digestId(token) });
  await session.deleteSession(env, token);
  assert.equal(db.prepare('SELECT count(*) AS total FROM sessions').get().total, 0); assert.equal(await session.getSessionById(env, token), null);
});
test('logout also works after a legacy token has been lazily upgraded', async (t) => {
  const { db, env } = database(t); const token = 'upgraded-logout-token'; insertSession(db, token); await session.getSessionById(env, token); await session.deleteSession(env, token);
  assert.equal(db.prepare('SELECT count(*) AS total FROM sessions').get().total, 0);
});
for (const expiresAt of [new Date(Date.now() - 60_000).toISOString(), 'not-a-date']) test(`expired or invalid expiry cannot authenticate or lazily upgrade (${expiresAt === 'not-a-date' ? 'invalid' : 'expired'})`, async (t) => {
  const { db, env, state } = database(t); insertSession(db, 'expired-legacy-token', { expiresAt });
  assert.equal(await session.getSessionById(env, 'expired-legacy-token'), null); assert.equal(state.writes, 0);
  assert.equal(db.prepare('SELECT count(*) AS total FROM sessions WHERE id = ?').get('expired-legacy-token').total, 1);
});
test('a hashed session also expires without falling through to a legacy row', async (t) => {
  const { db, env } = database(t); const token = 'expired-current-token'; insertSession(db, token, { id: digestId(token), expiresAt: new Date(Date.now() - 60_000).toISOString() });
  assert.equal(await session.getSessionById(env, token), null);
});
for (const idForm of ['legacy', 'digest']) test(`inactive principals cannot authenticate ${idForm} sessions`, async (t) => {
  const { db, env, state } = database(t); const token = 'inactive-principal-token'; insertSession(db, token, { id: idForm === 'digest' ? digestId(token) : token }); db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run('user-test');
  assert.equal(await session.getSessionById(env, token), null); assert.equal(state.writes, 0);
});
test('normal principal deletion cascades sessions and denies the old browser credential', async (t) => {
  const { db, env } = database(t); const created = await session.createSession(env, request(), input); db.prepare('DELETE FROM users WHERE id = ?').run('user-test');
  assert.equal(db.prepare('SELECT count(*) AS total FROM sessions').get().total, 0); assert.equal(await session.getSessionById(env, created.token), null);
});
test('an orphaned legacy session is denied even if a prior import disabled foreign keys', async (t) => {
  const { db, env, state } = database(t); insertSession(db, 'orphaned-token'); db.exec("PRAGMA foreign_keys = OFF; DELETE FROM users WHERE id = 'user-test'; PRAGMA foreign_keys = ON;");
  assert.equal(db.prepare('SELECT count(*) AS total FROM sessions').get().total, 1); assert.equal(await session.getSessionById(env, 'orphaned-token'), null); assert.equal(state.writes, 0);
});
for (const idForm of ['legacy', 'digest']) test(`a ${idForm} session cannot assign a principal to a different tenant`, async (t) => {
  const { db, env, state } = database(t); const token = 'cross-tenant-token'; insertSession(db, token, { id: idForm === 'digest' ? digestId(token) : token, tenantId: 'tenant-other' });
  assert.equal(await session.getSessionById(env, token), null); assert.equal(state.writes, 0);
});
for (const condition of ['inactive', 'missing', 'cross-tenant']) test(`session issuance refuses a ${condition} principal without inserting a credential`, async (t) => {
  const { db, env } = database(t);
  if (condition === 'inactive') db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run('user-test');
  if (condition === 'missing') db.prepare('DELETE FROM users WHERE id = ?').run('user-test');
  await assert.rejects(session.createSession(env, request(), { ...input, ...(condition === 'cross-tenant' ? { tenantId: 'tenant-other' } : {}) }), (error) => error.status === 401 && error.code === 'session_principal_unavailable');
  assert.equal(db.prepare('SELECT count(*) AS total FROM sessions').get().total, 0);
});
test('session insertion rechecks active principal state when it changes during issuance', async (t) => {
  const { db, env, state } = database(t); state.beforeRun = (sql) => { if (sql.includes('INSERT INTO sessions')) db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run('user-test'); };
  await assert.rejects(session.createSession(env, request(), input), (error) => error.code === 'session_principal_unavailable'); assert.equal(db.prepare('SELECT count(*) AS total FROM sessions').get().total, 0);
});
test('an expected password snapshot allows issuance only while that scoped credential matches', async (t) => {
  const { db, env } = database(t); setCredential(db);
  const created = await session.createSession(env, request(), { ...input, expectedPasswordHash: 'a'.repeat(64) }); assert.equal((await session.getSessionById(env, created.token)).user_id, 'user-test');
  await assert.rejects(session.createSession(env, request(), { ...input, expectedPasswordHash: 'b'.repeat(64) }), (error) => error.code === 'session_principal_unavailable');
  assert.equal(db.prepare('SELECT count(*) AS total FROM sessions').get().total, 1);
});
test('password replacement between verification and INSERT cannot issue a session from the old snapshot', async (t) => {
  const { db, env, state } = database(t); setCredential(db); state.beforeRun = (sql) => { if (sql.includes('INSERT INTO sessions')) db.prepare('UPDATE local_password_credentials SET password_hash = ? WHERE user_id = ?').run('b'.repeat(64), 'user-test'); };
  await assert.rejects(session.createSession(env, request(), { ...input, expectedPasswordHash: 'a'.repeat(64) }), (error) => error.code === 'session_principal_unavailable'); assert.equal(db.prepare('SELECT count(*) AS total FROM sessions').get().total, 0);
});
test('expected snapshots cannot issue a session after credential removal or from another tenant credential', async (t) => {
  const { db, env } = database(t);
  await assert.rejects(session.createSession(env, request(), { ...input, expectedPasswordHash: 'a'.repeat(64) }), (error) => error.code === 'session_principal_unavailable');
  setCredential(db, 'a'.repeat(64), 'tenant-other');
  await assert.rejects(session.createSession(env, request(), { ...input, expectedPasswordHash: 'a'.repeat(64) }), (error) => error.code === 'session_principal_unavailable'); assert.equal(db.prepare('SELECT count(*) AS total FROM sessions').get().total, 0);
});
test('malformed supplied credential snapshots fail before SQL instead of bypassing the atomic guard', async (t) => {
  const { env, state } = database(t);
  for (const expectedPasswordHash of ['', ' ', null, 'a'.repeat(63), 'G'.repeat(64), []]) await assert.rejects(session.createSession(env, request(), { ...input, expectedPasswordHash }), (error) => error.name === 'RangeError');
  assert.equal(state.reads, 0); assert.equal(state.writes, 0);
});
test('session lifetime rejects invalid or excessive numeric budgets before SQL', async (t) => {
  const { env, state } = database(t);
  for (const ttlMs of [0, -1, 1.5, NaN, Infinity, 7 * 24 * 60 * 60 * 1000 + 1]) await assert.rejects(session.createSession(env, request(), { ...input, ttlMs }), (error) => error.name === 'RangeError');
  assert.equal(state.reads, 0); assert.equal(state.writes, 0);
});
test('session revocation targets both tenant and user without removing other principals', async (t) => {
  const { db, env } = database(t); insertSession(db, 'target-legacy'); insertSession(db, 'target-digest', { id: digestId('target-digest') }); insertSession(db, 'same-tenant-other-user', { userId: 'user-second' }); insertSession(db, 'other-tenant-user', { userId: 'user-other', tenantId: 'tenant-other' }); insertSession(db, 'mismatched-tenant-row', { tenantId: 'tenant-other' });
  await session.revokeUserSessions(env, 'tenant-test', 'user-test');
  assert.equal(db.prepare('SELECT count(*) AS total FROM sessions WHERE tenant_id = ? AND user_id = ?').get('tenant-test', 'user-test').total, 0);
  assert.equal(db.prepare('SELECT count(*) AS total FROM sessions').get().total, 3);
  assert.equal(db.prepare('SELECT count(*) AS total FROM sessions WHERE id = ?').get('same-tenant-other-user').total, 1);
  assert.equal(db.prepare('SELECT count(*) AS total FROM sessions WHERE id = ?').get('other-tenant-user').total, 1);
});
test('malformed cookies are rejected without throwing or authenticating an anonymous request', async (t) => {
  const { env } = database(t);
  for (const cookie of ['ca_session=%ZZ', 'ca_session=%E0%A4%A', 'ca_session=missing-token', 'ca_session=', 'unrelated=value']) {
    const result = await auth.withAuth(authContext(env, cookie)); assert.equal(result.authStrategy, 'anonymous'); assert.equal(result.userId, null);
  }
  assert.equal(session.getSessionIdFromRequest(new Request('https://regovise.example/', { headers: { cookie: 'other=value; ca_session=token%3Dwith%3Dequals' } })), 'token=with=equals');
});
test('overlong and digest-prefixed presented credentials never cause database lookups', async (t) => {
  const { env, state } = database(t);
  for (const token of ['', 'x'.repeat(513), `sha256:${'a'.repeat(64)}`]) { assert.equal(await session.getSessionById(env, token), null); await session.deleteSession(env, token); }
  assert.equal(state.reads, 0); assert.equal(state.writes, 0);
});
test('cleared session cookies revoke the browser credential with the existing secure attributes', () => {
  const cleared = session.buildClearedSessionCookieHeader(true);
  for (const attribute of ['ca_session=', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0', 'Secure']) assert.ok(cleared.includes(attribute));
  assert.ok(!session.buildClearedSessionCookieHeader(false).includes('Secure'));
});

function loadPasswordHandlers(oidcOverrides = {}) {
  const file = path.join(workerRoot, 'src/services/core/http.ts');
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports, module: { exports }, Request, Response, Headers, URL, URLSearchParams, TextEncoder, TextDecoder, Date, console, crypto: webcrypto,
    require(specifier) {
      if (specifier === '../../session') return session;
      if (specifier === '../../authorization') return loadCanonical('authorization.ts');
      if (specifier === '../../utils/http') return loadCanonical('utils/http.ts');
      if (specifier === './oidc') return { ...loadCanonical('services/core/oidc.ts'), ...oidcOverrides };
      if (specifier === './moduleRegistry') return loadCanonical('services/core/moduleRegistry.ts');
      return {};
    },
  }, { filename: file });
  return exports;
}
const passwordCore = loadPasswordHandlers();
const oldPassword = 'Synthetic-Old-Password1!';
const newPassword = 'Synthetic-New-Password2!';
const adminPassword = 'Synthetic-Admin-Reset3!';
function passwordContext(env, cookie, userId, action, body) {
  const req = new Request(`https://regovise.example/_api/core/local-auth/${action}`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { env, request: req, url: new URL(req.url), params: {}, tenantId: 'tenant-test', userId, authStrategy: 'd1-session' };
}
async function passwordFixture(t, withCredential = true) {
  const f = database(t);
  f.db.exec("UPDATE users SET keep_local_login = 1 WHERE tenant_id = 'tenant-test'; INSERT INTO folders(id,tenant_id,name,content_type) VALUES('root-test','tenant-test','Root','root'); INSERT INTO roles(id,tenant_id,name) VALUES('admin-role','tenant-test','Administrator'); INSERT INTO role_permissions(role_id,permission) VALUES('admin-role','change_user'); INSERT INTO role_assignments(id,tenant_id,role_id,user_id,scope_folder_id,is_recursive) VALUES('admin-assignment','tenant-test','admin-role','user-second','root-test',1);");
  const admin = await session.createSession(f.env, request(), { tenantId: 'tenant-test', userId: 'user-second' });
  f.adminCookie = `ca_session=${admin.token}`;
  f.reset = async (password = adminPassword) => {
    const ctx = passwordContext(f.env, f.adminCookie, 'user-second', 'admin-set-password', { userId: 'user-test', newPassword: password, requireReset: false });
    const response = await passwordCore.handleCoreRoutes(['local-auth', 'admin-set-password'], ctx);
    assert.equal(response.status, 200); assert.equal((await response.json()).data.passwordSet, true);
  };
  if (withCredential) await f.reset(oldPassword);
  f.oldSession = await session.createSession(f.env, request(), input);
  f.oldCookie = `ca_session=${f.oldSession.token}`;
  f.change = () => passwordCore.handleCoreRoutes(['local-auth', 'set-password'], passwordContext(f.env, f.oldCookie, 'user-test', 'set-password', { currentPassword: oldPassword, newPassword }));
  return f;
}

test('canonical self-service password change atomically rotates credentials and renews the caller cookie', async (t) => {
  const f = await passwordFixture(t); const previous = f.db.prepare('SELECT password_hash,password_salt FROM local_password_credentials WHERE user_id = ?').get('user-test');
  const response = await f.change(); assert.equal(response.status, 200); assert.equal((await response.json()).data.passwordSet, true);
  const cookie = response.headers.get('set-cookie'); assert.ok(cookie && cookie.includes('HttpOnly') && cookie.includes('Secure'));
  const freshToken = session.getSessionIdFromRequest(new Request('https://regovise.example/', { headers: { cookie: cookie.split(';')[0] } }));
  assert.ok(freshToken && freshToken !== f.oldSession.token);
  const current = f.db.prepare('SELECT password_hash,password_salt FROM local_password_credentials WHERE user_id = ?').get('user-test');
  assert.notEqual(current.password_hash, previous.password_hash); assert.notEqual(current.password_salt, previous.password_salt);
  assert.equal(await session.getSessionById(f.env, f.oldSession.token), null); assert.equal((await session.getSessionById(f.env, freshToken)).user_id, 'user-test');
  assert.equal(f.db.prepare('SELECT count(*) AS total FROM sessions WHERE tenant_id = ? AND user_id = ?').get('tenant-test', 'user-test').total, 1);
  assert.equal((await auth.withAuth(authContext(f.env, cookie.split(';')[0]))).authStrategy, 'd1-session');
  assert.equal((await auth.withAuth(authContext(f.env, f.oldCookie))).authStrategy, 'anonymous');
  assert.equal((await auth.withAuth(authContext(f.env, f.adminCookie))).userId, 'user-second');
});
test('canonical password initialization requires a current session and renews it after the guarded first credential write', async (t) => {
  const f = await passwordFixture(t, false);
  const response = await f.change(); assert.equal(response.status, 200); assert.equal((await response.json()).data.passwordSet, true);
  assert.equal(f.db.prepare('SELECT count(*) AS total FROM local_password_credentials WHERE user_id = ?').get('user-test').total, 1);
  assert.equal(await session.getSessionById(f.env, f.oldSession.token), null);
  assert.ok(response.headers.get('set-cookie'));
});
test('administrator reset interleaving prevents stale self-service overwrite or revocation of replacement sessions', async (t) => {
  const f = await passwordFixture(t); let resetCredential; let replacement;
  f.state.beforeBatch = async () => {
    f.state.beforeBatch = null;
    await f.reset();
    resetCredential = f.db.prepare('SELECT password_hash,password_salt FROM local_password_credentials WHERE user_id = ?').get('user-test');
    replacement = await session.createSession(f.env, request(), { ...input, expectedPasswordHash: resetCredential.password_hash });
  };
  await assert.rejects(f.change(), (error) => error.status === 409 && error.code === 'credential_conflict');
  const current = f.db.prepare('SELECT password_hash,password_salt FROM local_password_credentials WHERE user_id = ?').get('user-test');
  assert.equal(current.password_hash, resetCredential.password_hash); assert.equal(current.password_salt, resetCredential.password_salt);
  assert.equal((await session.getSessionById(f.env, replacement.token)).user_id, 'user-test');
  assert.equal((await session.getSessionById(f.env, session.getSessionIdFromRequest(new Request('https://regovise.example/', { headers: { cookie: f.adminCookie } })))).user_id, 'user-second');
  assert.equal(f.db.prepare('SELECT count(*) AS total FROM sessions WHERE tenant_id = ? AND user_id = ?').get('tenant-test', 'user-test').total, 1);
});
test('a first-password initialization racing administrator setup cannot overwrite the new credential', async (t) => {
  const f = await passwordFixture(t, false); let resetHash;
  f.state.beforeBatch = async () => { f.state.beforeBatch = null; await f.reset(); resetHash = f.db.prepare('SELECT password_hash FROM local_password_credentials WHERE user_id = ?').get('user-test').password_hash; };
  await assert.rejects(f.change(), (error) => error.status === 409 && error.code === 'credential_conflict');
  assert.equal(f.db.prepare('SELECT password_hash FROM local_password_credentials WHERE user_id = ?').get('user-test').password_hash, resetHash);
});
test('a failed password transaction rolls back both credential replacement and session revocation', async (t) => {
  const f = await passwordFixture(t); const before = f.db.prepare('SELECT password_hash,password_salt FROM local_password_credentials WHERE user_id = ?').get('user-test'); f.state.failAfterBatch = true;
  await assert.rejects(f.change(), /Synthetic transaction failure/);
  const after = f.db.prepare('SELECT password_hash,password_salt FROM local_password_credentials WHERE user_id = ?').get('user-test');
  assert.equal(after.password_hash, before.password_hash); assert.equal(after.password_salt, before.password_salt);
  assert.equal((await session.getSessionById(f.env, f.oldSession.token)).user_id, 'user-test');
  assert.equal((await auth.withAuth(authContext(f.env, f.adminCookie))).userId, 'user-second');
});
test('self-service password changes refuse revoked or mismatched cookies before credential writes', async (t) => {
  const f = await passwordFixture(t); const before = f.db.prepare('SELECT password_hash FROM local_password_credentials WHERE user_id = ?').get('user-test').password_hash;
  const wrong = await passwordCore.handleCoreRoutes(['local-auth', 'set-password'], passwordContext(f.env, f.adminCookie, 'user-test', 'set-password', { currentPassword: oldPassword, newPassword }));
  assert.equal(wrong.status, 401);
  await session.deleteSession(f.env, f.oldSession.token);
  const revoked = await f.change(); assert.equal(revoked.status, 401); assert.equal(f.db.prepare('SELECT password_hash FROM local_password_credentials WHERE user_id = ?').get('user-test').password_hash, before);
});
test('a caller session expiring after verification is rejected at the actual password transaction', async (t) => {
  const f = await passwordFixture(t); const before = f.db.prepare('SELECT password_hash,password_salt FROM local_password_credentials WHERE user_id = ?').get('user-test');
  f.state.beforeBatch = () => {
    f.state.beforeBatch = null;
    f.db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(new Date(Date.now() - 1).toISOString(), f.oldSession.id);
  };
  await assert.rejects(f.change(), (error) => error.status === 409 && error.code === 'credential_conflict');
  const current = f.db.prepare('SELECT password_hash,password_salt FROM local_password_credentials WHERE user_id = ?').get('user-test');
  assert.equal(current.password_hash, before.password_hash); assert.equal(current.password_salt, before.password_salt);
  assert.equal(f.db.prepare('SELECT count(*) AS total FROM sessions WHERE user_id = ?').get('user-test').total, 1);
  assert.equal((await auth.withAuth(authContext(f.env, f.adminCookie))).userId, 'user-second');
});

function coordinateSnapshots(state, table) {
  let release; let arrived = 0; const gate = new Promise((resolve) => { release = resolve; });
  state.afterFirst = async (sql, row) => {
    if (!sql.includes(`FROM ${table}`) || !row) return;
    arrived += 1;
    if (arrived === 2) { state.afterFirst = null; release(); }
    await gate;
  };
}
function localCodeFixture(t, expiresAt = new Date(Date.now() + 60_000).toISOString()) {
  const f = database(t); f.db.exec("UPDATE users SET keep_local_login = 1 WHERE id = 'user-test';");
  const hash = createHash('sha256').update('tenant-test:fixture@example.test:123456:regovise-local-sign-in').digest('hex');
  f.db.prepare('INSERT INTO local_login_codes(id,tenant_id,user_id,email_normalized,code_hash,requested_at,expires_at) VALUES(?,?,?,?,?,?,?)').run('code-test','tenant-test','user-test','fixture@example.test',hash,new Date().toISOString(),expiresAt);
  f.verify = () => {
    const request = new Request('https://regovise.example/_api/core/login/verify-code', { method:'POST', body:JSON.stringify({tenantSlug:'test',email:'fixture@example.test',code:'123456'}) });
    return passwordCore.handleCoreRoutes(['login','verify-code'], { env:f.env, request, url:new URL(request.url), params:{}, tenantId:null,userId:null,authStrategy:'anonymous' });
  };
  return f;
}
test('two local-code validations with the same pending snapshot can issue only one session', async (t) => {
  const f=localCodeFixture(t); coordinateSnapshots(f.state,'local_login_codes');
  const responses=await Promise.all([f.verify(),f.verify()]); assert.deepEqual(responses.map(r=>r.status).sort(),[201,401]);
  assert.equal(f.db.prepare('SELECT count(*) AS total FROM sessions').get().total,1);
  assert.ok(f.db.prepare('SELECT consumed_at FROM local_login_codes').get().consumed_at);
  assert.equal((await f.verify()).status,401); assert.equal(f.db.prepare('SELECT count(*) AS total FROM sessions').get().total,1);
});
test('local-code expiry is checked at consumption even after a valid snapshot was read', async (t) => {
  const f=localCodeFixture(t); f.state.beforeRun=sql=>{ if(sql.includes('AND code_hash = ?')) f.db.prepare('UPDATE local_login_codes SET expires_at = ?').run(new Date(Date.now()-1).toISOString()); };
  assert.equal((await f.verify()).status,401); assert.equal(f.db.prepare('SELECT count(*) AS total FROM sessions').get().total,0);
});
test('malformed local-code expiry is denied before session issuance', async (t) => {
  const f=localCodeFixture(t,'not-a-date'); assert.equal((await f.verify()).status,401); assert.equal(f.db.prepare('SELECT count(*) AS total FROM sessions').get().total,0);
});
test('the code consume guard rechecks attempt limit and active local principal', async (t) => {
  for(const condition of ['attempts','inactive','local-disabled']) {
    const f=localCodeFixture(t); f.state.beforeRun=sql=>{if(sql.includes('AND code_hash = ?')) f.db.exec(condition==='attempts'? 'UPDATE local_login_codes SET attempts = 5':condition==='inactive'?"UPDATE users SET is_active=0 WHERE id='user-test'":"UPDATE users SET keep_local_login=0 WHERE id='user-test'");};
    assert.equal((await f.verify()).status,401); assert.equal(f.db.prepare('SELECT count(*) AS total FROM sessions').get().total,0);
  }
});
function oidcFixture(t, overrides={}) {
  const f=database(t); f.providerCalls=0;
  f.db.exec("INSERT INTO setup_sso_configs(tenant_id,provider_type,auth_protocol,client_id,callback_url,metadata_url,group_sync_enabled) VALUES('tenant-test','OIDC','oidc','fixture-client','https://regovise.example/auth/callback','https://issuer.example/.well-known/openid-configuration',0);");
  f.db.prepare('INSERT INTO sso_auth_transactions(id,tenant_id,tenant_slug,provider_type,auth_protocol,redirect_uri,code_verifier,nonce,expires_at,consumed_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('state-test','tenant-test','test','OIDC',overrides.protocol??'oidc','https://regovise.example/auth/callback','fixture-verifier','fixture-nonce',overrides.expiresAt??new Date(Date.now()+60000).toISOString(),overrides.consumedAt??null);
  const core=loadPasswordHandlers({async completeOidcCodeExchange(){f.providerCalls++; if(overrides.providerFails) throw new Error('Synthetic provider failure.'); return {issuer:'https://issuer.example',subject:'subject-test',email:'fixture@example.test',preferredUsername:'fixture@example.test',givenName:null,familyName:null,displayName:'Fixture',roleNames:[],rawClaims:{}};}});
  f.callback=()=>{const request=new Request('https://regovise.example/_api/core/sso/callback',{method:'POST',body:JSON.stringify({state:'state-test',code:'fixture-provider-code'})});return core.handleCoreRoutes(['sso','callback'],{env:f.env,request,url:new URL(request.url),params:{},tenantId:null,userId:null,authStrategy:'anonymous'});};
  return f;
}
test('concurrent callbacks for one OIDC state claim it only once before provider exchange', async (t) => {
  const f=oidcFixture(t); coordinateSnapshots(f.state,'sso_auth_transactions'); const responses=await Promise.all([f.callback(),f.callback()]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]); assert.equal(f.providerCalls,1); assert.equal(f.db.prepare('SELECT count(*) AS total FROM sessions').get().total,1);
});
test('expired, malformed, consumed and wrong-protocol OIDC states never reach a provider', async (t) => {
  for(const overrides of [{expiresAt:'not-a-date'},{expiresAt:new Date(Date.now()-60000).toISOString()},{consumedAt:new Date().toISOString()},{protocol:'saml'}]) {
    const f=oidcFixture(t,overrides); assert.equal((await f.callback()).status,409); assert.equal(f.providerCalls,0); assert.equal(f.db.prepare('SELECT count(*) AS total FROM sessions').get().total,0);
  }
});
test('OIDC expiry is rechecked by the atomic claim after the state snapshot', async (t) => {
  const f=oidcFixture(t); f.state.beforeRun=sql=>{if(sql.includes('AND auth_protocol = ?'))f.db.prepare('UPDATE sso_auth_transactions SET expires_at = ?').run(new Date(Date.now()-1).toISOString());};
  assert.equal((await f.callback()).status,409); assert.equal(f.providerCalls,0);
});
test('failed OIDC exchange consumes its one-use state and requires sign-in to restart', async (t) => {
  const f=oidcFixture(t,{providerFails:true}); await assert.rejects(f.callback(),/Synthetic provider failure/); assert.equal((await f.callback()).status,409); assert.equal(f.providerCalls,1); assert.equal(f.db.prepare('SELECT count(*) AS total FROM sessions').get().total,0);
});
