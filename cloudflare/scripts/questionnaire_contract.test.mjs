import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ts = createRequire(path.join(root, 'cloudflare/package.json'))('typescript');
const table = { id: 'table', ref: 'TABLE', prompt: 'Inventory', type: 'table', section: 'Review', required: true, weight: 1, tableColumns: [
  { id: 'owner', title: 'Owner', dataType: 'text', required: true, score: 2 },
  { id: 'count', title: 'Count', dataType: 'number', required: false, score: 1 },
  { id: 'date', title: 'Reviewed', dataType: 'date', required: false, score: 1 },
  { id: 'decision', title: 'Decision', dataType: 'dropdown', required: false, score: 1, options: [{ value: 'Pass', score: 3 }] },
] };
const multi = { id: 'multi', ref: 'MULTI', prompt: 'Environments', type: 'multi-select', section: 'Review', required: false, weight: 1, options: ['Test', 'Staging'] };
function fixture(t, { login = false, answers = {}, status = 'Open' } = {}) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  let beforeUpdate = null;
  let afterUpdate = null;
  let inTransaction = false;
  let actor = {};
  const state = { interleavings: 0, afterInterleavings: 0, errors: [], atomicBatches: [], rollbacks: 0, beforeUpdateEffects: [] };
  const isInstanceUpdate = (sql) => /^\s*UPDATE\s+questionnaire_instances\b/i.test(sql);
  function injectBeforeUpdate(sql) {
    if (!beforeUpdate) return;
    const interleave = beforeUpdate; beforeUpdate = null; state.interleavings += 1;
    interleave({ db, sql });
  }
  async function injectAfterUpdate() {
    if (!afterUpdate) return;
    const interleave = afterUpdate; afterUpdate = null; state.afterInterleavings += 1;
    await interleave({ db });
  }
  for (const file of fs.readdirSync(path.join(root, 'cloudflare/migrations')).filter(f => f.endsWith('.sql')).sort()) db.exec(fs.readFileSync(path.join(root, 'cloudflare/migrations', file), 'utf8'));
  const stamp = new Date().toISOString();
  db.prepare('INSERT INTO questionnaire_templates(id,tenant_id,name,questions_json,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('template', 'tenant', 'Synthetic contract', JSON.stringify([table, multi]), stamp, stamp);
  db.prepare('INSERT INTO questionnaire_instances(id,tenant_id,questionnaire_template_id,title,assignment_type,status,access_code,share_token,login_required,answers_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('instance', 'tenant', 'template', 'Synthetic inventory', 'email', status, '123456789', 'synthetic-token', Number(login), JSON.stringify(answers), stamp, stamp);
  const env = { APP_ENV: 'production', D1_MAIN: { prepare(sql) {
    let values = [];
    return { sql, bind(...args) { values = args; return this; }, async first() { return db.prepare(sql).get(...values) ?? null; }, async all() { return { results: db.prepare(sql).all(...values) }; }, async run() {
      if (isInstanceUpdate(sql)) {
        if (!inTransaction) injectBeforeUpdate(sql);
        state.beforeUpdateEffects.push({
          inTransaction,
          history: Number(db.prepare('SELECT COUNT(*) AS count FROM questionnaire_history_entries WHERE questionnaire_instance_id = ?').get('instance').count),
          properties: Number(db.prepare('SELECT COUNT(*) AS count FROM questionnaire_response_properties WHERE questionnaire_instance_id = ?').get('instance').count),
        });
      }
      const r = db.prepare(sql).run(...values);
      if (isInstanceUpdate(sql) && r.changes && !inTransaction) await injectAfterUpdate();
      return { success: true, meta: { changes: Number(r.changes) } };
    } };
  }, async batch(items) {
    const update = items.find((item) => isInstanceUpdate(item.sql));
    // A competing SQLite writer lands before BEGIN, not between statements of
    // one transaction. The hook targets the pending canonical write's batch.
    if (update) {
      injectBeforeUpdate(update.sql);
      state.atomicBatches.push(items.map((item) => item.sql));
    }
    const result = []; db.exec('BEGIN'); inTransaction = true;
    try {
      for (const item of items) result.push(await item.run());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK'); state.rollbacks += 1; throw error;
    } finally { inTransaction = false; }
    if (update && result[items.indexOf(update)].meta.changes) await injectAfterUpdate();
    return result;
  } } };
  const modules = new Map();
  function load(file) {
    if (modules.has(file)) return modules.get(file);
    const output = ts.transpileModule(fs.readFileSync(path.join(root, 'cloudflare/src', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    modules.set(file, exports);
    vm.runInNewContext(output, { exports, module: { exports }, crypto: webcrypto, Request, Response, Headers, URL, TextEncoder, TextDecoder, Date, console: { ...console, error: (...args) => state.errors.push(args) }, require(name) {
      if (name === '../../utils/http' || name === './utils/http') return load('utils/http.ts');
      if (name === './services/builders/http') return load('services/builders/http.ts');
      // Auth/permission behavior has its own contract suite. Synthetic actors
      // isolate the actual router, handler and SQLite persistence tested here.
      if (name === './auth') return { withAuth: async (ctx) => ({ ...ctx, ...actor }) };
      if (name === '../../authorization') return { requireAnyPermission: async () => ({}) };
      return {};
    } }); return exports;
  }
  const handler = load('router.ts').handleRequest;
  async function send(segments, { method = 'GET', body, tenantId = null, userId = null, authStrategy = 'anonymous' } = {}) {
    actor = { tenantId, userId, authStrategy };
    const request = new Request(`https://regovise.example/_api/builders/${segments.join('/')}`, { method, headers: { 'content-type': 'application/json', origin: 'https://regovise.example' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const response = await handler(request, env, {});
    return { status: response.status, body: await response.json() };
  }
  return {
    db, state,
    request(action = '', options) { return send(['questionnaire-access', 'synthetic-token', ...(action ? [action] : [])], options); },
    privateRequest(action, options = {}) { return send(['questionnaires', 'template', 'instances', 'instance', action], { tenantId: 'tenant', userId: 'synthetic-user', authStrategy: 'd1-session', ...options }); },
    beforeNextUpdate(callback) { assert.equal(beforeUpdate, null); beforeUpdate = callback; },
    afterNextCommittedUpdate(callback) { assert.equal(afterUpdate, null); afterUpdate = callback; },
    saved() { return JSON.parse(db.prepare('SELECT answers_json FROM questionnaire_instances WHERE id = ?').get('instance').answers_json); },
    row() { return db.prepare('SELECT * FROM questionnaire_instances WHERE id = ?').get('instance'); },
    sideEffects() { return {
      history: db.prepare('SELECT * FROM questionnaire_history_entries WHERE questionnaire_instance_id = ? ORDER BY id').all('instance'),
      properties: db.prepare('SELECT * FROM questionnaire_response_properties WHERE questionnaire_instance_id = ? ORDER BY id').all('instance'),
    }; },
  };
}
test('public table metadata excludes scoring and private template fields', async t => {
  const f = fixture(t); const r = await f.request(); assert.equal(r.status, 200);
  assert.deepEqual(r.body.data.questions[0].tableColumns, table.tableColumns.map(({ id, title, dataType, required, options }) => ({ id, title, dataType, required, ...(options ? { options: options.map(({ value }) => ({ value })) } : {}) })));
  assert.equal(JSON.stringify(r.body).includes('answerScores'), false);
});
test('login-required public access denies anonymous, header identities and cross-tenant sessions before disclosure or writes', async t => {
  const f = fixture(t, { login: true });
  for (const identity of [{}, { tenantId: 'tenant', userId: 'user', authStrategy: 'headers' }, { tenantId: 'other', userId: 'user', authStrategy: 'd1-session' }]) {
    for (const action of ['', 'validate', 'responses', 'submit']) {
      const r = await f.request(action, { ...identity, method: action === 'responses' ? 'PUT' : action ? 'POST' : 'GET', body: action ? { accessCode: '123456789', answers: { TABLE: [{ owner: 'Wrong' }] } } : undefined });
      assert.equal(r.status, 401); assert.equal(r.body.error, 'questionnaire_login_required'); assert.equal(r.body.data, undefined);
    }
  }
  assert.deepEqual(f.saved(), {}); assert.equal((await f.request('', { tenantId: 'tenant', userId: 'user', authStrategy: 'd1-session' })).status, 200);
});
test('table rows and multiselect lists persist without losing unknown row fields', async t => {
  const f = fixture(t); const answers = { TABLE: [{ owner: 'Analyst', count: 2, date: '2026-10-12', decision: 'Pass', future: { retained: true } }], MULTI: ['Test', 'Staging'] };
  assert.equal((await f.request('responses', { method: 'PUT', body: { accessCode: '123456789', answers } })).status, 200); assert.deepEqual(f.saved(), answers);
});
for (const [name, value] of [['string', 'owner'], ['primitive row', [42]], ['nested array', [[]]], ['number cell', [{ owner: 'Analyst', count: '2' }]], ['invalid calendar', [{ owner: 'Analyst', date: '2026-02-30' }]], ['unknown dropdown', [{ owner: 'Analyst', decision: 'Unknown' }]]]) {
  test(`invalid changed table ${name} is rejected without persistence`, async t => {
    const original = { TABLE: [{ owner: 'Original' }] }; const f = fixture(t, { answers: original });
    const r = await f.request('responses', { method: 'PUT', body: { accessCode: '123456789', answers: { TABLE: value } } }); assert.equal(r.status, 400); assert.equal(r.body.error, 'invalid_answer_shape'); assert.deepEqual(f.saved(), original);
  });
}
test('new malformed multi-select is rejected and unchanged legacy answers remain preservable in a draft', async t => {
  const legacy = { MULTI: 'Test,Staging', TABLE: 'legacy rows' }; const f = fixture(t, { answers: legacy });
  assert.equal((await f.request('responses', { method: 'PUT', body: { accessCode: '123456789', answers: legacy } })).status, 200); assert.deepEqual(f.saved(), legacy);
  assert.equal((await f.request('responses', { method: 'PUT', body: { accessCode: '123456789', answers: { MULTI: ['Invalid'] } } })).status, 400); assert.deepEqual(f.saved(), legacy);
});
test('partial table draft is saveable but missing required cells cannot be submitted', async t => {
  const f = fixture(t); assert.equal((await f.request('responses', { method: 'PUT', body: { accessCode: '123456789', answers: { TABLE: [{ count: 1 }] } } })).status, 200);
  const r = await f.request('submit', { method: 'POST', body: { accessCode: '123456789' } }); assert.equal(r.status, 409); assert.match(r.body.validationErrors[0].message, /Owner is required/);
});
test('wrong access codes and repeated submitted changes cannot write or re-submit', async t => {
  const f = fixture(t, { status: 'Submitted', answers: { TABLE: [{ owner: 'Final' }] } });
  assert.equal((await f.request('responses', { method: 'PUT', body: { accessCode: 'wrong', answers: {} } })).status, 403);
  for (const action of ['responses', 'submit']) assert.equal((await f.request(action, { method: action === 'responses' ? 'PUT' : 'POST', body: { accessCode: '123456789', answers: { TABLE: [] } } })).status, 409);
  assert.deepEqual(f.saved(), { TABLE: [{ owner: 'Final' }] });
});

const raceChanges = [
  ['status', (db) => db.prepare("UPDATE questionnaire_instances SET status = 'Closed' WHERE id = ?").run('instance')],
  ['answers', (db) => db.prepare('UPDATE questionnaire_instances SET answers_json = ? WHERE id = ?').run(JSON.stringify({ TABLE: [{ owner: 'Concurrent answer' }] }), 'instance')],
  ['archive', (db) => db.prepare('UPDATE questionnaire_instances SET archived = 1 WHERE id = ?').run('instance')],
  ['timestamp', (db) => db.prepare('UPDATE questionnaire_instances SET updated_at = ? WHERE id = ?').run('2099-01-01T00:00:00.000Z', 'instance')],
];

for (const target of ['public draft', 'private draft', 'public submit']) {
  const changes = [...raceChanges, ['collaboration', (db) => db.prepare('UPDATE questionnaire_instances SET collaboration_json = ? WHERE id = ?').run(JSON.stringify([{ id: 'synthetic-concurrent-note', action: 'feedback', message: 'Concurrent note' }]), 'instance')]];
  for (const [changedField, mutate] of changes) {
    test(`${target} rejects an interleaved ${changedField} change before its atomic batch without extra side effects`, async (t) => {
      const f = fixture(t, { answers: { TABLE: [{ owner: 'Initial complete answer' }] } });
      const originalEffects = f.sideEffects();
      let concurrentRow;
      f.beforeNextUpdate(({ db, sql }) => {
        assert.match(sql, target === 'public submit' ? /SET status = \?/ : /SET answers_json = \?/);
        mutate(db);
        concurrentRow = f.row();
      });
      const action = target === 'public submit' ? 'submit' : 'responses';
      const options = { method: target === 'public submit' ? 'POST' : 'PUT', body: { accessCode: '123456789', answers: { TABLE: [{ owner: 'Stale request answer' }] } } };
      const response = target === 'private draft' ? await f.privateRequest(action, options) : await f.request(action, options);
      assert.equal(f.state.interleavings, 1, 'The concurrent write must run immediately before the guarded transaction.');
      assert.equal(response.status, 409);
      assert.equal(response.body.error, 'response_conflict');
      assert.deepEqual(f.row(), concurrentRow, 'The stale request must not overwrite any concurrent row fields.');
      assert.deepEqual(f.sideEffects(), originalEffects, 'Rejected writes must not add history or rewrite response properties.');
      assert.equal(f.sideEffects().history.length, 0);
      assert.equal(f.sideEffects().properties.length, 0);
    });
  }
}

test('private draft still writes successfully when the actual row snapshot is unchanged', async (t) => {
  const f = fixture(t, { answers: { TABLE: [{ owner: 'Initial complete answer' }] } });
  const answers = { TABLE: [{ owner: 'Updated private answer' }], MULTI: ['Test'] };
  const response = await f.privateRequest('responses', { method: 'PUT', body: { answers } });
  assert.equal(response.status, 200);
  assert.deepEqual(f.saved(), answers);
  assert.equal(f.sideEffects().properties.length, 2);
});

for (const target of ['public draft', 'private draft', 'public submit']) {
  test(`${target} rolls back earlier derived/history statements when the final canonical UPDATE fails`, async (t) => {
    const f = fixture(t, { answers: { TABLE: [{ owner: 'Initial complete answer' }] } });
    const originalRow = f.row();
    const originalEffects = f.sideEffects();
    f.db.exec("CREATE TRIGGER synthetic_update_failure BEFORE UPDATE ON questionnaire_instances BEGIN SELECT RAISE(ABORT, 'Synthetic update failure'); END");
    const action = target === 'public submit' ? 'submit' : 'responses';
    const options = { method: target === 'public submit' ? 'POST' : 'PUT', body: { accessCode: '123456789', answers: { TABLE: [{ owner: 'Failed stale answer' }] } } };
    const response = target === 'private draft' ? await f.privateRequest(action, options) : await f.request(action, options);
    assert.equal(response.status, 500);
    assert.equal(response.body.error, 'request_failed');
    assert.equal(f.state.rollbacks, 1);
    const beforeUpdate = f.state.beforeUpdateEffects.at(-1);
    assert.equal(beforeUpdate.inTransaction, true);
    assert.equal(beforeUpdate[target === 'public submit' ? 'history' : 'properties'], target === 'public submit' ? 1 : 2);
    assert.deepEqual(f.row(), originalRow);
    assert.deepEqual(f.sideEffects(), originalEffects);
    const statements = f.state.atomicBatches.at(-1);
    assert.match(statements.at(-1), /UPDATE questionnaire_instances/);
    assert.ok(statements.slice(0, -1).every((sql) => /INSERT INTO questionnaire_(response_properties|history_entries)/.test(sql)));
  });
}

test('a later real private save after the public batch preserves the latest canonical and property snapshot', async (t) => {
  const f = fixture(t, { answers: { TABLE: [{ owner: 'Initial complete answer' }] } });
  const laterAnswers = { TABLE: [{ owner: 'Later committed answer' }], MULTI: ['Staging'] };
  f.afterNextCommittedUpdate(async () => {
    const later = await f.privateRequest('responses', { method: 'PUT', body: { answers: laterAnswers } });
    assert.equal(later.status, 200);
  });
  const first = await f.request('responses', { method: 'PUT', body: { accessCode: '123456789', answers: { TABLE: [{ owner: 'Earlier answer' }] } } });
  assert.equal(first.status, 200);
  assert.equal(f.state.afterInterleavings, 1);
  assert.deepEqual(f.saved(), laterAnswers);
  assert.deepEqual(first.body.data.answers, laterAnswers);
  const properties = Object.fromEntries(f.sideEffects().properties.map((property) => [property.key, JSON.parse(property.value)]));
  assert.deepEqual(properties, laterAnswers);
});

test('Submitted history keeps its committed snapshot when a later real review runs before response readback', async (t) => {
  const answers = { TABLE: [{ owner: 'Initial complete answer' }] };
  const f = fixture(t, { answers });
  f.afterNextCommittedUpdate(async () => {
    const reviewed = await f.privateRequest('accept', { method: 'POST', body: { reviewerComments: 'Later review accepted the response.' } });
    assert.equal(reviewed.status, 200);
  });
  const first = await f.request('submit', { method: 'POST', body: { accessCode: '123456789' } });
  assert.equal(first.status, 200);
  assert.equal(f.state.afterInterleavings, 1);
  assert.equal(f.row().status, 'Accepted');
  assert.equal(first.body.data.status, 'Accepted');
  const entries = f.sideEffects().history;
  assert.equal(entries.length, 2);
  const submitted = JSON.parse(entries.find((entry) => entry.discriminator === 'Submitted').json_data);
  const accepted = JSON.parse(entries.find((entry) => entry.discriminator === 'Accepted').json_data);
  assert.equal(submitted.status, 'Submitted');
  assert.equal(accepted.status, 'Accepted');
  assert.deepEqual(submitted.answers, answers);
  assert.equal(submitted.collaboration.length, 1);
  assert.equal(submitted.collaboration[0].action, 'submit');
  assert.equal(accepted.collaboration.length, 2);
  assert.equal(accepted.collaboration[1].action, 'accept');
});
