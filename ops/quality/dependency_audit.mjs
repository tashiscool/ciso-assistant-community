import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { root, revision, sourceFingerprint, writeJson } from '../lib/repository.mjs';
const results = [];
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'regovise-advisories-'));
const startedAt = new Date().toISOString();
await fs.writeFile(path.join(scratch, 'npmrc'), '');
try {
  for (const workspace of ['apps/web', 'cloudflare']) {
    const result = spawnSync('npm', ['audit', '--json', '--ignore-scripts', '--registry=https://registry.npmjs.org', `--userconfig=${path.join(scratch, 'npmrc')}`, `--cache=${path.join(scratch, 'cache')}`], { cwd: path.join(root, workspace), env: { PATH: process.env.PATH, CI: 'true' }, timeout: 60_000, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    let report;
    try { report = JSON.parse(result.stdout); } catch { report = { error: { code: result.error?.code ?? 'INVALID_AUDIT_RESPONSE', summary: 'Registry advisory query did not return usable JSON.' } }; }
    results.push({ workspace, exitCode: result.status, signal: result.signal, error: result.error ? { code: result.error.code ?? 'AUDIT_EXECUTION_FAILED' } : report.error ?? null, vulnerabilityTotals: report.metadata?.vulnerabilities ?? null, vulnerabilities: report.vulnerabilities ?? {} });
  }
} finally { await fs.rm(scratch, { recursive: true, force: true }); }
const output = path.join(root, 'artifacts/verification/dependency-audit.json');
await writeJson(output, { startedAt, finishedAt: new Date().toISOString(), revision: revision(), sourceFingerprint: await sourceFingerprint(), mode: 'registry-advisory-query', severityGate: 'high-or-critical', results });
console.log(JSON.stringify({ output, results: results.map(({ workspace, vulnerabilityTotals, error }) => ({ workspace, vulnerabilityTotals, error })) }, null, 2));
if (results.some((result) => result.error || !result.vulnerabilityTotals || result.vulnerabilityTotals.high > 0 || result.vulnerabilityTotals.critical > 0)) process.exitCode = 1;
