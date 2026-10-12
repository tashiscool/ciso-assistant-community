import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';

// Commands are passed as argv, never through a shell. Only the process group
// created by this spawn is stopped; ports and unrelated processes are not used.
export async function runCheck({ command, args = [], cwd, logPath, timeoutMs = 180_000, signal, maxLogBytes = 20 * 1024 * 1024 }) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) throw new RangeError('Check timeout must be a positive supported integer.');
  if (!Number.isSafeInteger(maxLogBytes) || maxLogBytes < 1) throw new RangeError('Check log limit must be a positive safe integer.');
  const started = Date.now();
  let log;
  try { log = await fs.open(logPath, 'w', 0o600); }
  catch (error) { return { code: null, signal: null, status: 'log-write-failed', spawnError: `Log write failed: ${error.code ?? 'unknown'}`, elapsedMs: Date.now() - started, timeoutMs, logBytes: 0 }; }
  let child; let timer; let flushTimer; let reason; let logBytes = 0; let spawnError; let logError; let cleanupError; let cleanupTimedOut = false; let closed = false; let groupEnded = false; let cleanup; let writes = Promise.resolve();
  let resolveClose; let settled = false;
  const close = new Promise((resolve) => { resolveClose = resolve; });
  const settle = (outcome) => { if (!settled) { settled = true; clearTimeout(timer); clearTimeout(flushTimer); resolveClose(outcome); } };
  const signalGroup = (kind) => {
    if (!child?.pid || groupEnded) return;
    try { if (process.platform === 'win32') child.kill(kind); else process.kill(-child.pid, kind); }
    catch (error) { if (error.code === 'ESRCH') groupEnded = true; else cleanupError ??= `Cleanup failed: ${error.code ?? 'unknown'}`; }
  };
  const groupAlive = () => {
    if (!child?.pid || groupEnded) return false;
    if (process.platform === 'win32') return child.exitCode === null && child.signalCode === null;
    try { process.kill(-child.pid, 0); return true; }
    catch (error) { if (error.code === 'ESRCH') groupEnded = true; else cleanupError ??= `Cleanup check failed: ${error.code ?? 'unknown'}`; return false; }
  };
  const cleanupGroup = () => {
    if (cleanup) return cleanup;
    cleanup = (async () => {
      signalGroup('SIGTERM');
      const gracefulUntil = Date.now() + 3000;
      while (groupAlive() && Date.now() < gracefulUntil) await new Promise((resolve) => setTimeout(resolve, 25));
      if (groupAlive()) signalGroup('SIGKILL');
      const forcedUntil = Date.now() + 1000;
      while (groupAlive() && Date.now() < forcedUntil) await new Promise((resolve) => setTimeout(resolve, 25));
      cleanupTimedOut = groupAlive();
    })();
    return cleanup;
  };
  const finishAfterCleanup = (outcome) => {
    void cleanupGroup().then(() => {
      if (closed) settle({ code: child.exitCode, signal: child.signalCode });
      else {
        // A process outside the owned group can retain inherited output pipes.
        // Bound this wait without stopping an unowned process or claiming a pass.
        clearTimeout(flushTimer);
        flushTimer = setTimeout(() => {
          reason ??= 'output-close-failed';
          child.stdout.destroy(); child.stderr.destroy(); child.unref();
          settle({ code: child.exitCode ?? outcome.code, signal: child.signalCode ?? outcome.signal });
        }, 250);
      }
    });
  };
  const stop = (why) => {
    if (reason) return;
    reason = why;
    if (child) finishAfterCleanup({ code: child.exitCode, signal: child.signalCode });
  };
  const aborted = () => stop('aborted');
  const append = (chunk) => {
    logBytes += chunk.length;
    if (logBytes > maxLogBytes) { stop('log-limit-exceeded'); return; }
    // At most maxLogBytes of buffers are queued. Serial FileHandle writes avoid
    // drain listeners that can leave child pipes paused forever after an error.
    writes = writes.then(async () => {
      if (logError) return;
      let offset = 0;
      while (offset < chunk.length) {
        const { bytesWritten } = await log.write(chunk, offset, chunk.length - offset);
        if (bytesWritten < 1) throw Object.assign(new Error('Log write did not advance.'), { code: 'EIO' });
        offset += bytesWritten;
      }
    }).catch((error) => { logError ??= error; stop('log-write-failed'); });
  };
  let result;
  try {
    if (signal?.aborted) result = { code: null, signal: null };
    else {
      try {
        child = spawn(command, args, { cwd, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: process.env.PATH ?? '', CI: 'true', WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false' } });
      } catch (error) { spawnError = error.code ?? 'spawn-error'; }
      if (child) {
        child.once('error', (error) => { spawnError = error.code ?? 'spawn-error'; });
        child.once('exit', (code, childSignal) => finishAfterCleanup({ code, signal: childSignal }));
        child.once('close', (code, childSignal) => { closed = true; finishAfterCleanup({ code, signal: childSignal }); });
        for (const stream of [child.stdout, child.stderr]) { stream.on('data', append); stream.on('error', () => stop('output-read-failed')); }
        signal?.addEventListener('abort', aborted, { once: true });
        timer = setTimeout(() => stop('timed-out'), timeoutMs);
        if (signal?.aborted) aborted();
        result = await close;
      } else result = { code: null, signal: null };
    }
  } finally {
    clearTimeout(timer); clearTimeout(flushTimer);
    signal?.removeEventListener('abort', aborted);
    if (child) await cleanupGroup();
    await writes;
    try { await log.sync(); } catch (error) { logError ??= error; }
    try { await log.close(); } catch (error) { logError ??= error; }
  }
  const status = logError ? 'log-write-failed' : reason ?? (signal?.aborted ? 'aborted' : cleanupError || cleanupTimedOut ? 'cleanup-failed' : spawnError ? 'spawn-failed' : result.code === 0 ? 'passed' : 'failed');
  if (logError) spawnError ??= `Log write failed: ${logError.code ?? 'unknown'}`;
  return { ...result, status, ...(spawnError ? { spawnError } : {}), ...(cleanupError ? { cleanupError } : {}), ...(cleanupTimedOut ? { cleanupTimedOut: true } : {}), elapsedMs: Date.now() - started, timeoutMs, logBytes };
}
