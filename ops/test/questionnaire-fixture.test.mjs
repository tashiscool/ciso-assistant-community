import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createQuestionnaireFixture } from '../local/questionnaire_fixture.mjs';
async function ready(t, baseUrl) {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'regovise-questionnaire-guard-'));
  t.after(() => fs.rm(scratch, { recursive: true, force: true }));
  const file = path.join(scratch, 'ready.json');
  await fs.writeFile(file, JSON.stringify({ runId: 'synthetic-owned-run', baseUrl }));
  return file;
}
test('browser fixture rejects remote origins before any HTTP call', async (t) => {
  let calls = 0; t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('Unexpected request'); });
  const file = await ready(t, 'https://remote.example.test');
  await assert.rejects(createQuestionnaireFixture(file));
  assert.equal(calls, 0);
});
test('browser fixture proves Worker ownership before any write', async (t) => {
  const methods = []; t.mock.method(globalThis, 'fetch', async (_url, init) => { methods.push(init.method); return new Response('{}', { headers: { 'x-regovise-verification-run': 'unrelated-run' } }); });
  const file = await ready(t, 'http://127.0.0.1:9123');
  await assert.rejects(createQuestionnaireFixture(file), /not this runner-owned/);
  assert.deepEqual(methods, ['GET']);
});
