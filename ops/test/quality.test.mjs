import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { checkSourcePolicy } from '../quality/source_policy.mjs';
import { sha256, sourceFingerprint } from '../lib/repository.mjs';
import { runCheck } from '../lib/run_check.mjs';

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'regovise-quality-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  for (const file of ['AGENTS.md', 'README.md', 'ARCHITECTURE.md', 'apps/web/README.md', 'cloudflare/README.md', 'ops/README.md', 'ops/quality/README.md', 'ops/local/README.md', 'documentation/engineering/developer-guide.md', 'package-lock.json', 'apps/web/package-lock.json', 'cloudflare/package-lock.json']) {
    await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true }); await fs.writeFile(path.join(dir, file), 'fixture');
  }
  for (const child of ['apps/web/src', 'cloudflare/src']) await fs.mkdir(path.join(dir, child), { recursive: true });
  await fs.writeFile(path.join(dir, 'ops/quality/source-policy.json'), JSON.stringify({ javascriptExceptions: [] }));
  return dir;
}

test('policy rejects newly introduced unclassified runtime JS', async (t) => {
  const dir = await fixture(t);
  assert.deepEqual((await checkSourcePolicy(dir)).failures, []);
  await fs.writeFile(path.join(dir, 'apps/web/src/rogue.js'), 'export const value = 1;');
  assert.match((await checkSourcePolicy(dir)).failures.join('\n'), /Unclassified runtime JavaScript/);
});
test('policy binds reviewed bundle provenance to bytes and removes stale exceptions', async (t) => {
  const dir = await fixture(t); const source = 'export const value = 1;';
  const file = 'cloudflare/src/bundle.mjs';
  await fs.writeFile(path.join(dir, file), source);
  await fs.writeFile(path.join(dir, 'ops/quality/source-policy.json'), JSON.stringify({ javascriptExceptions: [{ path: file, reason: 'reviewed vendor fixture', sha256: sha256(source) }] }));
  assert.deepEqual((await checkSourcePolicy(dir)).failures, []);
  await fs.writeFile(path.join(dir, file), 'export const value = 2;');
  assert.match((await checkSourcePolicy(dir)).failures.join('\n'), /without provenance review/);
  await fs.unlink(path.join(dir, file));
  assert.match((await checkSourcePolicy(dir)).failures.join('\n'), /Stale JavaScript exception/);
});
test('policy rejects cross-runtime implementation imports and missing authority', async (t) => {
  const dir = await fixture(t);
  await fs.writeFile(path.join(dir, 'apps/web/src/wrong.ts'), "import { secret } from '../../../cloudflare/src/provider';");
  await fs.writeFile(path.join(dir, 'cloudflare/src/wrong.ts'), "import { ui } from '../../apps/web/src/components';");
  await fs.unlink(path.join(dir, 'ARCHITECTURE.md'));
  const failures = (await checkSourcePolicy(dir)).failures.join('\n');
  assert.match(failures, /Browser imports server/); assert.match(failures, /Worker imports browser/); assert.match(failures, /Required authority/);
});
test('execution receipt distinguishes success, failure, and spawn failure', async (t) => {
  const dir = await fixture(t);
  for (const [name, command, args, expected] of [['pass', process.execPath, ['-e', 'console.log("fixture")'], 'passed'], ['fail', process.execPath, ['-e', 'process.exit(7)'], 'failed'], ['missing', path.join(dir, 'missing-command'), [], 'spawn-failed']]) {
    const result = await runCheck({ command, args, cwd: dir, logPath: path.join(dir, `${name}.log`) });
    assert.equal(result.status, expected);
  }
  assert.match(await fs.readFile(path.join(dir, 'pass.log'), 'utf8'), /fixture/);
});
test('hung child is terminated and recorded as timed out', async (t) => {
  const dir = await fixture(t);
  const result = await runCheck({ command: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'], cwd: dir, logPath: path.join(dir, 'timeout.log'), timeoutMs: 150 });
  assert.equal(result.status, 'timed-out'); assert.ok(result.elapsedMs < 5000);
});
test('verification children do not inherit provider credentials', async (t) => {
  const dir = await fixture(t); const before = process.env.REGovise_TEST_PROVIDER_SECRET;
  process.env.REGovise_TEST_PROVIDER_SECRET = 'synthetic-test-fixture';
  t.after(() => { if (before === undefined) delete process.env.REGovise_TEST_PROVIDER_SECRET; else process.env.REGovise_TEST_PROVIDER_SECRET = before; });
  const result = await runCheck({ command: process.execPath, args: ['-e', 'if (process.env.REGovise_TEST_PROVIDER_SECRET) process.exit(1);'], cwd: dir, logPath: path.join(dir, 'environment.log') });
  assert.equal(result.status, 'passed');
});

test('execution log is completely flushed from both child output streams before success', async (t) => {
  const dir = await fixture(t); const logPath = path.join(dir, 'flush.log');
  const script = "process.stdout.write('stdout-start\\n'+'x'.repeat(500000)+'stdout-end\\n'); process.stderr.write('stderr-start\\n'+'y'.repeat(500000)+'stderr-end\\n');";
  const result = await runCheck({ command: process.execPath, args: ['-e', script], cwd: dir, logPath });
  assert.equal(result.status, 'passed');
  const output = await fs.readFile(logPath, 'utf8');
  assert.equal((output.match(/x/g) ?? []).length, 500000); assert.equal((output.match(/y/g) ?? []).length, 500000);
  for (const marker of ['stdout-start', 'stdout-end', 'stderr-start', 'stderr-end']) assert.ok(output.includes(marker));
});

test('check rejects invalid execution/log budgets before spawning or opening logs', async (t) => {
  const dir = await fixture(t); const logPath = path.join(dir, 'invalid.log');
  for (const timeoutMs of [0, -1, NaN, Infinity, 2_147_483_648]) await assert.rejects(runCheck({ command: process.execPath, cwd: dir, logPath, timeoutMs }), RangeError);
  for (const maxLogBytes of [0, -1, NaN, Infinity]) await assert.rejects(runCheck({ command: process.execPath, cwd: dir, logPath, maxLogBytes }), RangeError);
  await assert.rejects(fs.access(logPath), (error) => error.code === 'ENOENT');
});

test('an already aborted check creates no child and removes no unrelated state', async (t) => {
  const dir = await fixture(t); const sentinel = path.join(dir, 'must-not-run'); const controller = new AbortController(); controller.abort();
  const result = await runCheck({ command: process.execPath, args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(sentinel)},'bad')`], cwd: dir, logPath: path.join(dir, 'preabort.log'), signal: controller.signal });
  assert.equal(result.status, 'aborted');
  await assert.rejects(fs.access(sentinel), (error) => error.code === 'ENOENT');
});

test('a mid-run abort stops the owned child and clears its abort listener', async (t) => {
  const dir = await fixture(t); const controller = new AbortController(); let added = 0; let removed = 0;
  const add = controller.signal.addEventListener.bind(controller.signal); const remove = controller.signal.removeEventListener.bind(controller.signal);
  t.mock.method(controller.signal, 'addEventListener', (...args) => { if (args[0] === 'abort') added += 1; return add(...args); });
  t.mock.method(controller.signal, 'removeEventListener', (...args) => { if (args[0] === 'abort') removed += 1; return remove(...args); });
  const timer = setTimeout(() => controller.abort(), 150);
  try {
    const result = await runCheck({ command: process.execPath, args: ['-e', "console.log('running'); setInterval(()=>{},1000)"], cwd: dir, logPath: path.join(dir, 'abort.log'), signal: controller.signal });
    assert.equal(result.status, 'aborted'); assert.equal(added, 1); assert.equal(removed, 1); assert.ok(result.elapsedMs < 5000);
  } finally { clearTimeout(timer); }
});

test('a child that ignores termination is force-stopped within the deadline and cleanup grace', { skip: process.platform === 'win32' }, async (t) => {
  const dir = await fixture(t); const pidPath = path.join(dir, 'timeout.pid');
  const script = `require('node:fs').writeFileSync(${JSON.stringify(pidPath)},String(process.pid)); process.on('SIGTERM',()=>{}); setInterval(()=>{},1000);`;
  const result = await runCheck({ command: process.execPath, args: ['-e', script], cwd: dir, logPath: path.join(dir, 'forced.log'), timeoutMs: 150 });
  const pid = Number(await fs.readFile(pidPath, 'utf8'));
  assert.equal(result.status, 'timed-out'); assert.equal(result.signal, 'SIGKILL'); assert.ok(result.elapsedMs < 5500);
  assert.throws(() => process.kill(-pid, 0), (error) => error.code === 'ESRCH');
});

test('natural parent success cleans its remaining owned descendants before reporting success', { skip: process.platform === 'win32' }, async (t) => {
  const dir = await fixture(t); const pidPath = path.join(dir, 'parent.pid');
  const unrelated = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { detached: true, stdio: 'ignore', env: { CI: 'true' } });
  const unrelatedClose = new Promise((resolve) => unrelated.once('close', resolve));
  t.after(async () => { try { process.kill(-unrelated.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } await unrelatedClose; });
  const script = `require('node:fs').writeFileSync(${JSON.stringify(pidPath)},String(process.pid)); const descendant=require('node:child_process').spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)"],{stdio:'ignore'}); descendant.unref(); setTimeout(()=>process.exit(0),150);`;
  const result = await runCheck({ command: process.execPath, args: ['-e', script], cwd: dir, logPath: path.join(dir, 'descendant.log'), timeoutMs: 6000 });
  const pid = Number(await fs.readFile(pidPath, 'utf8'));
  assert.equal(result.status, 'passed'); assert.equal(result.code, 0); assert.equal(result.cleanupTimedOut, undefined);
  assert.throws(() => process.kill(-pid, 0), (error) => error.code === 'ESRCH');
  assert.doesNotThrow(() => process.kill(-unrelated.pid, 0), 'Another process group must remain running.');
});

test('log-limit failure stops a noisy child and retains only bounded output', async (t) => {
  const dir = await fixture(t); const logPath = path.join(dir, 'limit.log');
  const result = await runCheck({ command: process.execPath, args: ['-e', "setInterval(()=>process.stdout.write('x'.repeat(8192)),1)"], cwd: dir, logPath, maxLogBytes: 16384 });
  assert.equal(result.status, 'log-limit-exceeded'); assert.ok((await fs.stat(logPath)).size <= 16384); assert.ok(result.elapsedMs < 5000);
});

test('log-open failure does not spawn the requested command', async (t) => {
  const dir = await fixture(t); const sentinel = path.join(dir, 'must-not-run');
  const result = await runCheck({ command: process.execPath, args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(sentinel)},'bad')`], cwd: dir, logPath: dir });
  assert.equal(result.status, 'log-write-failed');
  await assert.rejects(fs.access(sentinel), (error) => error.code === 'ENOENT');
});

test('an output log write error cannot leave child output paused indefinitely', async (t) => {
  const dir = await fixture(t); const logPath = path.join(dir, 'write-error.log'); const open = fs.open.bind(fs);
  let closed = false;
  t.mock.method(fs, 'open', async (...args) => {
    const handle = await open(...args);
    if (args[0] !== logPath) return handle;
    return {
      write: async () => { throw Object.assign(new Error('Synthetic log failure'), { code: 'EIO' }); },
      sync: () => handle.sync(),
      close: async () => { closed = true; await handle.close(); },
    };
  });
  const result = await runCheck({ command: process.execPath, args: ['-e', "process.on('SIGTERM',()=>{}); setInterval(()=>process.stdout.write('x'.repeat(65536)),1)"], cwd: dir, logPath, timeoutMs: 6000, maxLogBytes: 8 * 1024 * 1024 });
  assert.equal(result.status, 'log-write-failed'); assert.match(result.spawnError, /EIO/); assert.equal(closed, true); assert.ok(result.elapsedMs < 5500);
});


test('release source identity changes when HTML, PostCSS or Tailwind build inputs change', async (t) => {
  const dir = await fixture(t);
  for (const folder of ['cloudflare/migrations', 'cloudflare/scripts', 'apps/web/scripts', '.github/workflows']) await fs.mkdir(path.join(dir, folder), { recursive: true });
  const configs = ['package.json', '.nvmrc', '.node-version', '.editorconfig', 'apps/web/package.json', 'apps/web/index.html', 'apps/web/postcss.config.cjs', 'apps/web/tailwind.config.ts', 'apps/web/vite.config.ts', 'apps/web/tsconfig.json', 'cloudflare/package.json', 'cloudflare/wrangler.toml', 'cloudflare/tsconfig.json'];
  for (const file of configs) await fs.writeFile(path.join(dir, file), 'original public fixture');
  let previous = await sourceFingerprint(dir);
  for (const file of ['apps/web/index.html', 'apps/web/postcss.config.cjs', 'apps/web/tailwind.config.ts']) {
    await fs.writeFile(path.join(dir, file), 'changed public fixture');
    const next = await sourceFingerprint(dir); assert.notEqual(next, previous, file); previous = next;
  }
});
