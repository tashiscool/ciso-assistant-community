import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { root, revision, sourceFingerprint, writeJson } from '../lib/repository.mjs';
import { runCheck } from '../lib/run_check.mjs';
const output = path.join(root, 'artifacts/verification', `verify-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`);
await fs.mkdir(output, { recursive: true });
const checks = [
  ['dependency-audit', process.execPath, ['ops/quality/dependency_audit.mjs']],
  ['source-policy', process.execPath, ['ops/quality/source_policy.mjs']],
  ['reuse-policy', process.execPath, ['ops/quality/check_reuse.mjs']],
  ['web-types', 'npm', ['--prefix', 'apps/web', 'run', 'typecheck']],
  ['worker-types', 'npm', ['--prefix', 'cloudflare', 'run', 'typecheck']],
  ['web-build', 'npm', ['--prefix', 'apps/web', 'run', 'build']],
  ['web-toolchain-contracts', 'npm', ['--prefix', 'apps/web', 'run', 'verify:toolchain']],
  ['ui-source-contracts', 'npm', ['--prefix', 'apps/web', 'run', 'verify:ia-shell']],
  ['accessibility-tokens', 'npm', ['--prefix', 'apps/web', 'run', 'verify:a11y-tokens']],
  ['observable-ui-contract', 'npm', ['--prefix', 'apps/web', 'run', 'verify:observable-import-ui']],
  ['frontend-worker-alignment', 'npm', ['--prefix', 'cloudflare', 'run', 'alignment:check']],
  ['grc-schema-fixtures', 'npm', ['--prefix', 'cloudflare', 'run', 'validate:grc-contracts']],
  ['queue-recovery-contract', 'npm', ['--prefix', 'cloudflare', 'run', 'verify:queue-recovery']],
  ['queue-replay-integrity', process.execPath, ['cloudflare/scripts/verify_replay_integrity.mjs']],
  ['security-contracts', process.execPath, ['--test', 'cloudflare/scripts/security_contract.test.mjs', 'cloudflare/scripts/session_contract.test.mjs', 'cloudflare/scripts/questionnaire_contract.test.mjs']],
  ['api-client-regressions', process.execPath, ['apps/web/scripts/verify_api_client_contract.mjs']],
  ['provider-deadline-regressions', process.execPath, ['--experimental-strip-types', 'cloudflare/scripts/verify_provider_request.mjs']],
  ['release-regressions', process.execPath, ['--test', 'cloudflare/scripts/release_plan.test.mjs']],
  ['artifact-integrity-regressions', process.execPath, ['--test', 'ops/release/web_artifact.test.mjs', 'ops/release/release_artifact.test.mjs', 'ops/release/production_probe.test.mjs']],
  ['practice-regressions', process.execPath, ['--test', 'ops/test/practices.test.mjs', 'ops/test/quality.test.mjs', 'ops/test/questionnaire-fixture.test.mjs']],
  ['feature-traceability', process.execPath, ['ops/audit/feature_traceability.mjs']],
];
if (process.argv.includes('--integration')) checks.push(['isolated-worker-d1', process.execPath, ['ops/local/run_worker.mjs', '--suites=core,grc,scrutiny,fedramp', '--scf-fixtures']]);
const record = { startedAt: new Date().toISOString(), revision: revision(), sourceFingerprint: await sourceFingerprint(), node: process.version, mode: process.argv.includes('--integration') ? 'local-integration' : 'credential-free-fast-gates', checks: [], status: 'running' };
const controller = new AbortController();
const interrupt = () => controller.abort();
process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
try {
  for (const [name, command, args] of checks) {
    console.log(`[verify] ${name}`);
    const result = await runCheck({ command, args, cwd: root, logPath: path.join(output, `${name}.log`), timeoutMs: name === 'isolated-worker-d1' ? 900_000 : 180_000, signal: controller.signal });
    record.checks.push({ name, command: [command, ...args].map((argument) => argument === process.execPath ? 'node' : argument), cwd: '.', ...result });
    if (result.status !== 'passed') throw new Error(`${name} ${result.status}. See ${path.join(output, `${name}.log`)}`);
  }
  record.finishedSourceFingerprint = await sourceFingerprint();
  if (record.finishedSourceFingerprint !== record.sourceFingerprint) throw new Error('Source changed during verification. Rerun the checks against the final tree.');
  record.status = 'passed';
} catch (error) { record.status = 'failed'; record.error = error.message; process.exitCode = 1; }
finally { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); record.finishedAt = new Date().toISOString(); await writeJson(path.join(output, 'result.json'), record); console.log(`[verify] ${record.status}: ${output}`); if (record.error) console.error(record.error); }
