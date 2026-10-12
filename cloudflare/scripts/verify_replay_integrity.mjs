import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('Unexpected network call in replay integrity verification.'); };
after(() => { globalThis.fetch = originalFetch; });

async function sourceModule(relative, imports = {}) {
  const source = await readFile(new URL(relative, import.meta.url), 'utf8');
  let output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  for (const [specifier, url] of Object.entries(imports)) output = output.replaceAll(`'${specifier}'`, `'${url}'`).replaceAll(`"${specifier}"`, `"${url}"`);
  return `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`;
}

const deadLetterUrl = await sourceModule('../src/queues/deadLetter.ts');
const workflowsUrl = await sourceModule('../src/utils/workflows.ts');
const recoveryUrl = await sourceModule('../src/services/ops/queueRecovery.ts', { '../../queues/deadLetter': deadLetterUrl, '../../utils/workflows': workflowsUrl });
const { replayQueueDeadLetter } = await import(recoveryUrl);

const queues = {
  QUEUE_EVIDENCE_JOBS: 'ciso-assistant-evidence-jobs',
  QUEUE_CONMON_JOBS: 'ciso-assistant-conmon-jobs',
  QUEUE_GRC_CONTENT_IMPORT: 'ciso-assistant-grc-content-import',
  QUEUE_GRC_SCF_REFRESH: 'ciso-assistant-grc-scf-refresh',
  QUEUE_GRC_FINDING_INGEST: 'ciso-assistant-grc-finding-ingest',
  QUEUE_GRC_GAP_REPORT: 'ciso-assistant-grc-gap-report',
  QUEUE_GRC_AI_ENRICH: 'ciso-assistant-grc-ai-enrich',
};
const base = { tenantId: 'tenant-test', requestedBy: 'user-original' };
const variants = [
  [{ ...base, type: 'evidence.job.run', sourceId: 'source-test', jobId: 'job-test' }, queues.QUEUE_EVIDENCE_JOBS],
  [{ ...base, type: 'conmon.execution.run', profileId: 'profile-test', activityId: 'activity-test', executionId: 'execution-test' }, queues.QUEUE_CONMON_JOBS],
  [{ ...base, type: 'grc.content.import' }, queues.QUEUE_GRC_CONTENT_IMPORT],
  [{ ...base, type: 'grc.scf.refresh', frameworkIds: ['framework-test'] }, queues.QUEUE_GRC_SCF_REFRESH],
  [{ ...base, type: 'grc.finding.ingest', payloadId: 'payload-test' }, queues.QUEUE_GRC_FINDING_INGEST],
  [{ ...base, type: 'grc.connector.collect', source: 'github' }, queues.QUEUE_GRC_FINDING_INGEST],
  [{ ...base, type: 'grc.gap.report', assessmentId: 'assessment-test' }, queues.QUEUE_GRC_GAP_REPORT],
  [{ ...base, type: 'grc.evidence.package', assessmentId: 'assessment-test' }, queues.QUEUE_GRC_GAP_REPORT],
  [{ ...base, type: 'grc.ai.enrich', bundleId: 'bundle-test' }, queues.QUEUE_GRC_AI_ENRICH],
  ...['exec-summary', 'board-brief', 'program-health', 'automation-coverage'].map((reportKind) => [{ ...base, type: 'grc.gap.report', reportKind, ...(['exec-summary', 'board-brief'].includes(reportKind) ? { assessmentId: 'assessment-test' } : {}) }, queues.QUEUE_GRC_CONTENT_IMPORT]),
];

async function hash(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Buffer.from(digest).toString('hex');
}

async function fixture(payload = variants[0][0], originalQueue = variants[0][1], options = {}) {
  const bytes = options.bytes ?? new TextEncoder().encode(JSON.stringify(payload));
  const row = { id: 'dead-letter-test', tenant_id: 'tenant-test', original_queue: originalQueue, dead_letter_queue: 'ciso-assistant-dlq', message_type: payload?.type ?? 'evidence.job.run', message_id: 'message-test', attempts: 3, payload_r2_key: 'queue-dead-letters/test/fixture.json', payload_sha256: await hash(bytes), status: 'pending', replay_count: 0, last_replay_error: null, captured_at: '2026-10-12T00:00:00.000Z', replayed_at: null, replayed_by_user_id: null, ...options.row };
  const state = { row, bytes, sends: [], writes: [], events: [], leases: [], r2Reads: 0, order: [] };
  const env = {
    D1_MAIN: {
      prepare(sql) {
        let bound;
        return {
          bind(...args) { bound = args; return this; },
          async first() {
            assert.match(sql, /SELECT \*\s+FROM queue_dead_letters/);
            assert.ok(bound[0] === row.id && bound[1] === 'tenant-test', 'Receipt selector must bind the requested id and authenticated tenant.');
            state.order.push('read-receipt');
            return options.missingRow ? null : { ...row };
          },
          async run() {
            state.writes.push(sql);
            if (sql.includes('INSERT INTO queue_dead_letter_events')) {
              state.events.push(bound[3]); state.order.push(`audit:${bound[3]}`);
              assert.ok(bound[1] === row.id && bound[2] === 'tenant-test', 'Audit event must remain scoped to the receipt tenant.');
            } else if (sql.includes("SET status = 'replaying'")) {
              row.status = 'replaying'; row.last_replay_error = null; state.order.push('state:replaying');
            } else if (sql.includes("SET status = 'replayed'")) {
              row.status = 'replayed'; row.replay_count += 1; row.replayed_at = bound[0]; row.replayed_by_user_id = bound[1]; row.last_replay_error = null; state.order.push('state:replayed');
            } else if (sql.includes("SET status = 'replay_failed'")) {
              row.status = 'replay_failed'; row.last_replay_error = bound[0]; state.order.push('state:replay_failed');
            } else throw new Error('Unexpected D1 write in replay fixture.');
            return { success: true };
          },
        };
      },
    },
    R2_EVIDENCE: {
      async get(key) {
        assert.ok(key === row.payload_r2_key, 'R2 lookup must use the saved receipt key.'); state.r2Reads += 1;
        if (options.missingObject) return null;
        return { async arrayBuffer() { return Uint8Array.from(state.bytes).buffer; }, async text() { throw new Error('Replay must verify original bytes before decoding.'); } };
      },
    },
    TENANT_WORKFLOW_COORDINATOR: {
      idFromName(tenant) { assert.equal(tenant, 'tenant-test'); return tenant; },
      get() {
        return { async fetch(url, init) {
          const action = new URL(url).pathname; const body = JSON.parse(init.body);
          assert.equal(body.leaseKey, 'queue-dead-letter-replay:dead-letter-test'); state.leases.push(action); state.order.push(`lease:${action}`);
          return Response.json(action === '/leases/acquire' ? { acquired: !options.leaseHeld, lease: {} } : { released: true });
        } };
      },
    },
    ...Object.fromEntries(Object.entries(queues).map(([binding, name]) => [binding, { async send(message) {
      state.sends.push({ queue: name, message }); state.order.push('queue-send');
      if (options.sendFails) throw new Error('Synthetic queue-send failure.');
    } }])),
  };
  if (options.missingBinding) delete env[options.missingBinding];
  return { state, ctx: { env, tenantId: 'tenant-test', userId: 'user-replay', url: new URL('https://fixture.invalid/') } };
}

async function rejectedWithoutBusinessEffects(replayFixture, expected = /Dead-letter payload/) {
  await assert.rejects(replayQueueDeadLetter(replayFixture.ctx, 'dead-letter-test'), (error) => {
    assert.match(error.message, expected);
    assert.ok(!error.message.includes('queue-dead-letters/') && !error.message.includes('sensitive-fixture') && !error.message.includes('https:'), 'Rejection must not expose payload, storage path or URL details.');
    return true;
  });
  assert.equal(replayFixture.state.sends.length, 0, 'Rejected evidence must not be sent.');
  assert.equal(replayFixture.state.writes.length, 0, 'Rejected evidence must not update dead-letter business state or audit.');
  assert.deepEqual(replayFixture.state.leases, ['/leases/acquire', '/leases/release'], 'The existing transient tenant lease must be released.');
  assert.equal(replayFixture.state.row.status, 'pending');
}

for (const [payload, queue] of variants) test(`valid replay retains routing and state/audit flow for ${payload.type}${payload.reportKind ? ` ${payload.reportKind}` : ''}`, async () => {
  const { ctx, state } = await fixture(payload, queue);
  const returned = await replayQueueDeadLetter(ctx, 'dead-letter-test');
  assert.equal(state.sends.length, 1); assert.equal(state.sends[0].queue, queue);
  assert.ok(JSON.stringify(state.sends[0].message) === JSON.stringify(payload), 'Replay must preserve the original valid message body.');
  assert.equal(returned.status, 'replayed'); assert.equal(returned.replay_count, 1); assert.equal(returned.replayed_by_user_id, 'user-replay');
  assert.deepEqual(state.order.filter((value) => value.startsWith('state:') || value.startsWith('audit:') || value === 'queue-send'), ['state:replaying', 'audit:replay_started', 'queue-send', 'state:replayed', 'audit:replayed']);
  assert.deepEqual(state.leases, ['/leases/acquire', '/leases/release']);
});

test('replay compares exact bytes, including whitespace that leaves JSON values unchanged', async () => {
  const f = await fixture(); f.state.bytes = new TextEncoder().encode(`${JSON.stringify(variants[0][0])}\n`);
  await rejectedWithoutBusinessEffects(f, /integrity/);
});
test('a swapped valid message with the same tenant/type/queue fails its original hash', async () => {
  const f = await fixture(); f.state.bytes = new TextEncoder().encode(JSON.stringify({ ...variants[0][0], jobId: 'job-swapped' }));
  await rejectedWithoutBusinessEffects(f, /integrity/);
});
test('a byte mismatch is rejected before decoding malformed JSON', async () => {
  const f = await fixture(); f.state.bytes = new TextEncoder().encode('{sensitive-fixture');
  await rejectedWithoutBusinessEffects(f, /integrity/);
});
test('matching receipt hashes still require valid UTF-8 JSON', async () => {
  for (const bytes of [new TextEncoder().encode('{sensitive-fixture'), new Uint8Array([0xff, 0x7b, 0x7d])]) await rejectedWithoutBusinessEffects(await fixture(variants[0][0], variants[0][1], { bytes }), /valid UTF-8 JSON/);
});
test('a receipt checksum must contain a complete canonical SHA256', async () => {
  for (const payload_sha256 of ['', 'not-a-checksum', 'f'.repeat(63), 'G'.repeat(64)]) await rejectedWithoutBusinessEffects(await fixture(variants[0][0], variants[0][1], { row: { payload_sha256 } }), /integrity/);
});
test('tenant identity must agree across authenticated context, receipt and hashed payload', async () => {
  await rejectedWithoutBusinessEffects(await fixture({ ...variants[0][0], tenantId: 'tenant-other' }), /tenant/);
  await rejectedWithoutBusinessEffects(await fixture(variants[0][0], variants[0][1], { row: { tenant_id: 'tenant-other' } }), /tenant/);
});
test('hashed message type must match the saved receipt type', async () => {
  await rejectedWithoutBusinessEffects(await fixture(variants[0][0], variants[0][1], { row: { message_type: 'conmon.execution.run' } }), /type/);
});
test('a known type must map to the saved original queue', async () => {
  await rejectedWithoutBusinessEffects(await fixture(variants[0][0], queues.QUEUE_CONMON_JOBS), /queue/);
});
test('executive and assessment report variants cannot be swapped between their two queues', async () => {
  await rejectedWithoutBusinessEffects(await fixture({ ...base, type: 'grc.gap.report', reportKind: 'board-brief', assessmentId: 'assessment-test' }, queues.QUEUE_GRC_GAP_REPORT), /queue/);
  await rejectedWithoutBusinessEffects(await fixture({ ...base, type: 'grc.gap.report', assessmentId: 'assessment-test' }, queues.QUEUE_GRC_CONTENT_IMPORT), /queue/);
});
test('unknown message types are rejected even with a matching receipt hash/type', async () => {
  await rejectedWithoutBusinessEffects(await fixture({ ...base, type: 'sensitive-fixture-unsupported' }), /unsupported/);
});
test('JSON arrays, null and scalar values cannot stand in for a queue message object', async () => {
  for (const payload of [[], null, 42, 'sensitive-fixture']) await rejectedWithoutBusinessEffects(await fixture(payload), /message object/);
});
test('requester identity is required and must be null or a nonblank string', async () => {
  for (const requestedBy of [undefined, '', ' ', 5, [], {}]) await rejectedWithoutBusinessEffects(await fixture({ ...variants[0][0], requestedBy }), /requester identity/);
  const f = await fixture({ ...variants[0][0], requestedBy: null }); await replayQueueDeadLetter(f.ctx, 'dead-letter-test'); assert.equal(f.state.sends.length, 1);
});
for (const [payload, queue] of variants) {
  const requiredIds = payload.type === 'evidence.job.run' ? ['sourceId', 'jobId']
    : payload.type === 'conmon.execution.run' ? ['profileId', 'activityId', 'executionId']
      : payload.type === 'grc.finding.ingest' ? ['payloadId']
        : payload.type === 'grc.connector.collect' ? ['source']
          : payload.type === 'grc.ai.enrich' ? ['bundleId']
            : payload.assessmentId ? ['assessmentId'] : [];
  for (const field of requiredIds) test(`${payload.type}${payload.reportKind ? ` ${payload.reportKind}` : ''} rejects missing or malformed ${field}`, async () => {
    for (const value of [undefined, '', ' ', 7, [], {}]) await rejectedWithoutBusinessEffects(await fixture({ ...payload, [field]: value }, queue), /identity|fields/);
  });
}
test('optional GRC job identities must retain their string shape when present', async () => {
  for (const jobId of ['', ' ', 7, null, []]) await rejectedWithoutBusinessEffects(await fixture({ ...base, type: 'grc.content.import', jobId }, queues.QUEUE_GRC_CONTENT_IMPORT), /job identity/);
});
test('SCF refresh framework ids must be an optional array of nonblank identifiers', async () => {
  for (const frameworkIds of [null, 'framework-test', [3], [''], [{}]]) await rejectedWithoutBusinessEffects(await fixture({ ...base, type: 'grc.scf.refresh', frameworkIds }, queues.QUEUE_GRC_SCF_REFRESH), /fields/);
  for (const frameworkIds of [undefined, []]) { const f = await fixture({ ...base, type: 'grc.scf.refresh', frameworkIds }, queues.QUEUE_GRC_SCF_REFRESH); await replayQueueDeadLetter(f.ctx, 'dead-letter-test'); assert.equal(f.state.sends.length, 1); }
});
test('report kind must be one of the actual supported report names', async () => {
  for (const reportKind of [null, '', 8, ['board-brief'], 'sensitive-fixture-unsupported']) await rejectedWithoutBusinessEffects(await fixture({ ...base, type: 'grc.gap.report', reportKind, assessmentId: 'assessment-test' }, queues.QUEUE_GRC_CONTENT_IMPORT), /fields/);
});
test('a missing R2 object produces a safe rejection without business effects', async () => {
  await rejectedWithoutBusinessEffects(await fixture(variants[0][0], variants[0][1], { missingObject: true }), /missing from R2/);
});
test('a missing queue binding fails only after evidence validation, without business effects', async () => {
  await rejectedWithoutBusinessEffects(await fixture({ ...base, type: 'grc.content.import' }, queues.QUEUE_GRC_CONTENT_IMPORT, { missingBinding: 'QUEUE_GRC_CONTENT_IMPORT' }), /queue binding is unavailable/);
});
test('already replayed receipts never read or send the stored payload', async () => {
  const f = await fixture(variants[0][0], variants[0][1], { row: { status: 'replayed' } });
  await assert.rejects(replayQueueDeadLetter(f.ctx, 'dead-letter-test'), /already replayed/);
  assert.equal(f.state.r2Reads, 0); assert.equal(f.state.sends.length, 0); assert.equal(f.state.writes.length, 0); assert.deepEqual(f.state.leases, ['/leases/acquire', '/leases/release']);
});
test('a held tenant lease prevents any receipt or payload processing', async () => {
  const f = await fixture(variants[0][0], variants[0][1], { leaseHeld: true });
  await assert.rejects(replayQueueDeadLetter(f.ctx, 'dead-letter-test'), /already being replayed/);
  assert.equal(f.state.r2Reads, 0); assert.equal(f.state.sends.length, 0); assert.equal(f.state.writes.length, 0); assert.deepEqual(f.state.leases, ['/leases/acquire']);
});
test('valid evidence keeps the existing failed-send state/audit flow and releases its lease', async () => {
  const f = await fixture(variants[0][0], variants[0][1], { sendFails: true });
  await assert.rejects(replayQueueDeadLetter(f.ctx, 'dead-letter-test'), /Synthetic queue-send failure/);
  assert.equal(f.state.row.status, 'replay_failed'); assert.equal(f.state.row.replay_count, 0); assert.deepEqual(f.state.events, ['replay_started', 'replay_failed']); assert.deepEqual(f.state.leases, ['/leases/acquire', '/leases/release']);
});
