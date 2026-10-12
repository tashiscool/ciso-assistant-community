import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { root, revision, sourceFingerprint, writeJson } from '../lib/repository.mjs';
const suites = {
  core: 'cloudflare/scripts/local-smoke.mjs',
  grc: 'cloudflare/scripts/smoke_grc_engine_local.mjs',
  scrutiny: 'cloudflare/scripts/smoke_scrutiny_engine_local.mjs',
  fedramp: 'cloudflare/scripts/smoke_fedramp_provider_shell_local.mjs',
};
export function localConfig(scratch, port) {
  return {
    name: 'regovise-isolated-verification', main: path.join(scratch, 'worker.ts'), compatibility_date: '2026-03-01',
    assets: { directory: path.join(root, 'apps/web/dist'), binding: 'ASSETS', not_found_handling: 'single-page-application' },
    vars: { APP_ENV: 'development', APP_ORIGIN: `http://127.0.0.1:${port}`, EMAIL_PROVIDER: 'none', SERVICE_DELIVERY_ENABLED: 'false', SERVICE_DONATION_RETURN_URL: `http://127.0.0.1:${port}/` },
    d1_databases: [{ binding: 'D1_MAIN', database_name: 'regovise-isolated-verification', database_id: '00000000-0000-0000-0000-000000000001', migrations_dir: path.join(root, 'cloudflare/migrations') }],
    r2_buckets: [{ binding: 'R2_EVIDENCE', bucket_name: 'regovise-isolated-evidence' }],
    durable_objects: { bindings: [{ name: 'TENANT_WORKFLOW_COORDINATOR', class_name: 'TenantWorkflowCoordinator' }, { name: 'SERVICE_COORDINATOR', class_name: 'DonationServiceCoordinator' }] },
    migrations: [{ tag: 'test-workflow', new_sqlite_classes: ['TenantWorkflowCoordinator'] }, { tag: 'test-services', new_sqlite_classes: ['DonationServiceCoordinator'] }],
    queues: {
      producers: [
        ['QUEUE_EVIDENCE_JOBS', 'ciso-assistant-evidence-jobs'], ['QUEUE_CONMON_JOBS', 'ciso-assistant-conmon-jobs'], ['QUEUE_GRC_CONTENT_IMPORT', 'ciso-assistant-grc-content-import'], ['QUEUE_GRC_SCF_REFRESH', 'ciso-assistant-grc-scf-refresh'], ['QUEUE_GRC_FINDING_INGEST', 'ciso-assistant-grc-finding-ingest'], ['QUEUE_GRC_GAP_REPORT', 'ciso-assistant-grc-gap-report'], ['QUEUE_GRC_AI_ENRICH', 'ciso-assistant-grc-ai-enrich'],
      ].map(([binding, queue]) => ({ binding, queue })),
      consumers: ['ciso-assistant-evidence-jobs', 'ciso-assistant-conmon-jobs', 'ciso-assistant-grc-content-import', 'ciso-assistant-grc-scf-refresh', 'ciso-assistant-grc-finding-ingest', 'ciso-assistant-grc-gap-report', 'ciso-assistant-grc-ai-enrich'].map((queue) => ({ queue, max_batch_size: 2, max_retries: 1, dead_letter_queue: 'ciso-assistant-dlq' })).concat([{ queue: 'ciso-assistant-dlq', max_batch_size: 2, max_retries: 1 }]),
    },
  };
}
export function isolatedEnvironment(scratch) {
  return {
    PATH: process.env.PATH ?? '', TMPDIR: scratch, XDG_CONFIG_HOME: path.join(scratch, 'config'), XDG_CACHE_HOME: path.join(scratch, 'cache'),
    WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: path.join(scratch, 'wrangler.log'), CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false', CI: 'true',
  };
}
async function freePort() {
  const server = net.createServer(); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port; await new Promise((resolve) => server.close(resolve)); return port;
}
export async function child(command, args, cwd, env, logPath, { timeoutMs = 120_000, graceMs = 1500 } = {}) {
  if (timeoutMs !== null && (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647)) throw new RangeError('Child timeout must be a positive supported integer.');
  if (!Number.isSafeInteger(graceMs) || graceMs < 1 || graceMs > 10_000) throw new RangeError('Child shutdown grace must be a bounded positive integer.');
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const log = await fs.open(logPath, 'a');
  let proc;
  try { proc = spawn(command, args, { cwd, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (error) { await log.close(); throw error; }
  let writes = Promise.resolve(); let logError; let spawnError; let timedOut = false; let closed = false; let stopping;
  const append = (data) => { writes = writes.then(() => log.write(data)).catch((error) => { logError ??= error; }); };
  for (const stream of [proc.stdout, proc.stderr]) { stream.on('data', append); stream.on('error', (error) => { logError ??= error; }); }
  const signalGroup = (signal) => {
    if (!proc.pid) return;
    try { if (process.platform === 'win32') proc.kill(signal); else process.kill(-proc.pid, signal); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  const groupAlive = () => {
    if (!proc.pid) return false;
    if (process.platform === 'win32') return proc.exitCode === null;
    try { process.kill(-proc.pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; }
  };
  const cleanupGroup = async () => {
    signalGroup('SIGTERM');
    const until = Date.now() + graceMs;
    while (groupAlive() && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 25));
    if (groupAlive()) signalGroup('SIGKILL');
    const forcedUntil = Date.now() + 1500;
    while (groupAlive() && Date.now() < forcedUntil) await new Promise((resolve) => setTimeout(resolve, 25));
    return groupAlive();
  };
  let finishClose;
  const close = new Promise((resolve) => { finishClose = resolve; });
  proc.once('error', (error) => { spawnError = error; append(Buffer.from(`Child could not start: ${error.message}\n`)); });
  proc.once('close', (code, signal) => { closed = true; finishClose({ code, signal }); });
  let deadline;
  const done = close.then(async (outcome) => {
    clearTimeout(deadline);
    // The process may exit while its detached group still contains descendants.
    // This group was created by this spawn; never infer ownership from a port.
    const cleanupTimedOut = await cleanupGroup();
    await writes;
    try { await log.sync(); } finally { await log.close(); }
    return { ...outcome, timedOut, ...(cleanupTimedOut ? { cleanupTimedOut: true } : {}), ...(spawnError ? { error: spawnError.message } : {}), ...(logError ? { logError: logError.message } : {}) };
  });
  void done.catch(() => {});
  const terminate = () => {
    if (stopping) return stopping;
    if (closed) return done;
    stopping = (async () => {
      signalGroup('SIGTERM');
      const force = setTimeout(() => { signalGroup('SIGKILL'); }, graceMs);
      const hard = setTimeout(() => {
        signalGroup('SIGKILL');
        proc.stdout.destroy(); proc.stderr.destroy(); proc.unref();
        finishClose({ code: null, signal: 'SIGKILL', cleanupTimedOut: true });
      }, graceMs + 3000);
      try { return await done; } finally { clearTimeout(force); clearTimeout(hard); }
    })();
    return stopping;
  };
  if (timeoutMs !== null) deadline = setTimeout(() => { timedOut = true; void terminate().catch(() => {}); }, timeoutMs);
  return { proc, done, terminate };
}

// These deliberately artificial mappings exercise storage/queue mechanics only.
// They are not copied from SCF and must never be interpreted as compliance data.
export function scfFixtureResponses() {
  const base = 'https://grcengclub.github.io/scf-api/api';
  const control = (id, title) => ({ control_id: id, title: `SYNTHETIC TEST ONLY: ${title}`, family: 'TEST', family_name: 'Artificial verification family', description: 'Artificial Regovise local verification data; not an SCF control or regulatory mapping.', evidence_requests: [], profiles: [] });
  return {
    [`${base}/summary.json`]: { version: 'regovise-test-fixture', scf_version: 'regovise-test-fixture', fixture: true, description: 'Artificial verification fixture; no regulatory meaning.' },
    [`${base}/crosswalks/general-aicpa-tsc-2017.json`]: { framework_id: 'general-aicpa-tsc-2017', display_name: 'SYNTHETIC TEST ONLY: SOC 2 mapping', framework_to_scf: { mappings: { 'CC6.1': ['TEST-ACCESS'], 'CC6.6': ['TEST-STORAGE'] } } },
    [`${base}/crosswalks/usa-federal-gsa-fedramp-5-mod.json`]: { framework_id: 'usa-federal-gsa-fedramp-5-mod', display_name: 'SYNTHETIC TEST ONLY: FedRAMP mapping', framework_to_scf: { mappings: { 'AC-3': ['TEST-STORAGE'], 'CM-3': ['TEST-CHANGE'] } } },
    [`${base}/crosswalks/general-nist-800-53-r5-2.json`]: { framework_id: 'general-nist-800-53-r5-2', display_name: 'SYNTHETIC TEST ONLY: NIST mapping', framework_to_scf: { mappings: { 'CM-3': ['TEST-CHANGE'] } } },
    [`${base}/controls/TEST-ACCESS.json`]: control('TEST-ACCESS', 'Access fixture'),
    [`${base}/controls/TEST-STORAGE.json`]: control('TEST-STORAGE', 'Storage fixture'),
    [`${base}/controls/TEST-CHANGE.json`]: control('TEST-CHANGE', 'Change fixture'),
  };
}
export function installLoopbackFetchGuard(allowedOrigin = null, fixtureResponses = {}) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    let url;
    try { url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url); }
    catch { throw new Error('Only owned loopback HTTP is permitted in isolated verification.'); }
    if (Object.prototype.hasOwnProperty.call(fixtureResponses, url.href)) {
      const request = new Request(input, init);
      if (request.method !== 'GET' || url.username || url.password) throw new Error('Outbound HTTP is blocked in isolated verification.');
      return new Response(JSON.stringify(fixtureResponses[url.href]), { status: 200, headers: { 'content-type': 'application/json', 'x-regovise-provider-fixture': 'synthetic-scf/regovise-test-fixture' } });
    }
    if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      || url.username || url.password || (allowedOrigin && url.origin !== allowedOrigin)) {
      throw new Error('Outbound HTTP is blocked in isolated verification.');
    }
    // Native redirect following would otherwise bypass the destination check.
    return originalFetch(new Request(input, init), { redirect: 'manual' });
  };
  return () => { globalThis.fetch = originalFetch; };
}
export function cleanupDiagnostics(children, outcomes) {
  const failed = outcomes.some((entry) => entry.cleanupTimedOut || entry.cleanupError);
  return {
    failed,
    error: failed ? 'Owned process cleanup did not complete; inspect cleanup.checks.' : null,
    checks: children.map((owned, index) => {
      const outcome = outcomes[index];
      const pid = owned.proc.pid ?? null;
      return { childIndex: index, pid, ownedProcessGroup: process.platform === 'win32' ? null : pid, code: outcome.code ?? null, signal: outcome.signal ?? null, timedOut: Boolean(outcome.timedOut), cleanupTimedOut: Boolean(outcome.cleanupTimedOut), error: outcome.error ?? null, logError: outcome.logError ?? null, cleanupError: outcome.cleanupError ?? null };
    }),
  };
}
export async function runLocalWorker({ selected = ['core'], keep = false, serve = false, scfFixtures = false } = {}) {
  for (const suite of selected) if (!suites[suite]) throw new Error(`Unknown local suite: ${suite}`);
  await fs.access(path.join(root, 'apps/web/dist/index.html'));
  const runId = `local-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const output = path.join(root, 'artifacts/verification', runId); await fs.mkdir(output, { recursive: true });
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'regovise-verification-'));
  const fixtureResponses = scfFixtures ? scfFixtureResponses() : {};
  const providerMode = scfFixtures ? 'synthetic-scf-outbound-blocked-no-credentials' : 'outbound-blocked-no-credentials';
  const record = { runId, revision: revision(), sourceFingerprint: await sourceFingerprint(), startedAt: new Date().toISOString(), mode: 'isolated-worker-d1', providerMode, fixtureProvenance: scfFixtures ? { source: 'ops/local/run_worker.mjs:scfFixtureResponses', version: 'regovise-test-fixture', synthetic: true, exactGetUrls: Object.keys(fixtureResponses), proofLimit: 'Artificial mappings exercise queue/D1/R2/report mechanics; no live SCF transport, genuine crosswalk accuracy or regulatory readiness is verified.' } : null, scratch, suites: [], migrations: null, bootstrap: null, cleanup: null };
  const children = []; let server; let interrupted = false; let resolveInterrupt;
  const interruption = new Promise((resolve) => { resolveInterrupt = resolve; });
  const interrupt = () => { interrupted = true; resolveInterrupt(); for (const owned of children) void owned.terminate().catch(() => {}); };
  process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
  const startChild = async (...args) => { const owned = await child(...args); children.push(owned); if (interrupted) void owned.terminate(); return owned; };
  try {
    const port = await freePort(); const baseUrl = `http://127.0.0.1:${port}`; const env = isolatedEnvironment(scratch);
    record.baseUrl = baseUrl;
    const config = path.join(scratch, 'wrangler.json'); await writeJson(config, localConfig(scratch, port));
    await fs.writeFile(path.join(scratch, 'empty.env'), '');
    // The test-only entry and suite preload both restrict fetch to this owned origin.
    const guardSource = `(${installLoopbackFetchGuard.toString()})(${JSON.stringify(baseUrl)}, ${JSON.stringify(fixtureResponses)});\n`;
    const guardPath = path.join(scratch, 'loopback_fetch_guard.mjs'); await fs.writeFile(guardPath, `(${installLoopbackFetchGuard.toString()})(${JSON.stringify(baseUrl)});\n`);
    const workerPath = path.join(root, 'cloudflare/src/index.ts');
    await fs.writeFile(path.join(scratch, 'worker.ts'), `import worker from ${JSON.stringify(workerPath)};\nexport { TenantWorkflowCoordinator, DonationServiceCoordinator } from ${JSON.stringify(workerPath)};\n${guardSource}export default { ...worker, async fetch(request, env, ctx) { const response = await worker.fetch(request, env, ctx); const headers = new Headers(response.headers); headers.set('x-regovise-verification-run', ${JSON.stringify(runId)}); headers.set('x-regovise-provider-mode', ${JSON.stringify(providerMode)}); return new Response(response.body, { status: response.status, statusText: response.statusText, headers }); } };\n`);
    const wrangler = path.join(root, 'cloudflare/node_modules/wrangler/bin/wrangler.js');
    const common = ['--config', config, '--env-file', path.join(scratch, 'empty.env'), '--persist-to', path.join(scratch, 'state')];
    if (interrupted) throw new Error('Local verification interrupted.');
    console.log(`[local] Apply migrations to new isolated D1 state: ${runId}`);
    const migration = await (await startChild(process.execPath, [wrangler, 'd1', 'migrations', 'apply', 'D1_MAIN', '--local', ...common], scratch, env, path.join(output, 'migrations.log'))).done;
    record.migrations = migration; if (migration.code !== 0 || migration.timedOut || migration.cleanupTimedOut || migration.error || migration.logError) throw new Error('Local migrations failed; inspect migrations.log.');
    server = await startChild(process.execPath, [wrangler, 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', String(await freePort()), '--log-level', 'warn', ...common], scratch, env, path.join(output, 'worker.log'), { timeoutMs: serve ? null : 900_000 });
    let ready = false;
    for (let attempt = 0; attempt < 80 && !interrupted; attempt++) {
      if (server.proc.exitCode !== null) throw new Error('Isolated Worker exited before readiness.');
      try { const response = await fetch(`${baseUrl}/_api/core/health`, { signal: AbortSignal.timeout(1000), redirect: 'manual' }); const payload = await response.json(); if (response.ok && payload?.data?.ok === true && response.headers.get('x-regovise-verification-run') === runId) { ready = true; break; } } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error('Isolated Worker did not become ready.');
    // Real fresh bootstrap then repeated bootstrap protect FK order and idempotency.
    for (let count = 0; count < 2; count++) {
      const response = await fetch(`${baseUrl}/_api/core/bootstrap-demo`, { method: 'POST', signal: AbortSignal.timeout(30000), redirect: 'manual' }); const payload = await response.json();
      if (!response.ok || payload?.data?.tenantId !== 'tenant-demo' || response.headers.get('x-regovise-verification-run') !== runId) throw new Error(`Fresh/repeated bootstrap failed (${response.status}): ${JSON.stringify(payload)}`);
    }
    record.bootstrap = { fresh: 'passed', repeated: 'passed', workaround: false };
    const readyFile = path.join(output, 'ready.json');
    await writeJson(readyFile, { runId, revision: record.revision, sourceFingerprint: record.sourceFingerprint, node: process.version, baseUrl, scratch, harnessPid: process.pid, workerPid: server.proc.pid, ownedProcessGroup: process.platform === 'win32' ? null : server.proc.pid, providerMode: record.providerMode, bootstrap: record.bootstrap });
    console.log(`[local] Ready ${baseUrl} (readiness: ${readyFile})`);
    for (const suite of selected) {
      if (interrupted) throw new Error('Local verification interrupted.');
      console.log(`[local] Run ${suite} with isolated state and blocked outbound HTTP`);
      const fixtureArgs = suite === 'grc' ? [scfFixtures ? '--scf-fixtures' : '--fixture-providers'] : [];
      const started = Date.now(); const result = await (await startChild(process.execPath, ['--import', guardPath, path.join(root, suites[suite]), ...fixtureArgs], scratch, { ...env, CLOUDFLARE_LOCAL_URL: baseUrl }, path.join(output, `${suite}.log`), { timeoutMs: 180_000 })).done;
      record.suites.push({ name: suite, ...result, elapsedMs: Date.now() - started, ...(suite === 'grc' ? { providerMode, proofLimit: scfFixtures ? record.fixtureProvenance.proofLimit : 'Provider refresh/map fail with explicit outbound-block diagnostics; normalized fixture ingestion and unconfigured collector succeed. Positive SCF mapping/assessment/report assertions are skipped because no genuine cached SCF dataset exists.' } : {}) });
      if (result.code !== 0 || result.timedOut || result.cleanupTimedOut || result.error || result.logError) console.log(`[local] ${suite} failed; continuing other selected suites.`);
    }
    if (record.suites.some((suite) => suite.code !== 0 || suite.timedOut || suite.cleanupTimedOut || suite.error || suite.logError)) throw new Error('One or more local suites failed; inspect suite logs.');
    record.status = 'passed';
    if (serve) {
      record.status = 'serving'; await writeJson(path.join(output, 'result.json'), record);
      console.log(`[local] Serving ${baseUrl}; stop this harness with SIGINT to clean up its Worker and scratch state.`);
      await Promise.race([interruption, server.done.then(() => { throw new Error('Isolated Worker stopped unexpectedly while serving.'); })]);
      record.status = 'stopped';
    }
  } catch (error) { record.status = interrupted && !serve ? 'interrupted' : 'failed'; record.error = error.message; throw error; }
  finally {
    const cleanup = await Promise.all(children.map((owned) => owned.terminate().catch((error) => ({ cleanupError: error.message }))));
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    const diagnostics = cleanupDiagnostics(children, cleanup);
    const cleanupFailed = diagnostics.failed;
    if (!keep && !cleanupFailed) await fs.rm(scratch, { recursive: true, force: true });
    record.cleanup = { worker: cleanupFailed ? 'owned-cleanup-needs-inspection' : 'terminated-owned-process-groups', state: keep ? 'retained-explicitly' : cleanupFailed ? 'retained-cleanup-failed' : 'removed-owned-scratch', checks: diagnostics.checks, ...(diagnostics.error ? { error: diagnostics.error } : {}), sharedStateTouched: false };
    if (cleanupFailed) { record.status = 'failed'; record.error ??= diagnostics.error; }
    record.finishedSourceFingerprint = await sourceFingerprint();
    record.sourceChangedDuringRun = record.sourceFingerprint !== record.finishedSourceFingerprint;
    record.sourceFreshness = serve ? 'interactive-session-no-strict-freshness-claim' : record.sourceChangedDuringRun ? 'changed-during-verification' : 'unchanged-during-verification';
    if (!serve && record.sourceChangedDuringRun) { record.status = 'failed'; record.error ??= 'Runtime source changed during local verification; rerun against stable source.'; process.exitCode = 1; }
    record.finishedAt = new Date().toISOString(); await writeJson(path.join(output, 'result.json'), record);
    console.log(`[local] ${record.status}: ${output}`);
  }
  return record;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv.find((value) => value.startsWith('--suites='));
  const serve = process.argv.includes('--serve');
  runLocalWorker({ selected: arg ? arg.slice(9).split(',').filter(Boolean) : serve ? [] : ['core'], keep: process.argv.includes('--keep-state'), serve, scfFixtures: process.argv.includes('--scf-fixtures') }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
