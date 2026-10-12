import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createReleasePlan } from './release_plan.mjs';

const scripts = dirname(fileURLToPath(import.meta.url));

function releaseFixture() {
  const directory = mkdtempSync(resolve(tmpdir(), 'regovise-release-plan-'));
  const worker = resolve(directory, 'cloudflare');
  const fixtureScripts = resolve(worker, 'scripts');
  const commandLog = resolve(directory, 'forbidden-effects.log');
  mkdirSync(fixtureScripts, { recursive: true });
  mkdirSync(resolve(directory, 'apps/web'), { recursive: true });
  mkdirSync(resolve(worker, 'migrations'), { recursive: true });
  mkdirSync(resolve(directory, 'bin'));
  for (const file of ['deploy_production.sh', 'apply_d1_migrations_remote.sh', 'release_plan.mjs']) {
    if (existsSync(resolve(scripts, file))) copyFileSync(resolve(scripts, file), resolve(fixtureScripts, file));
  }
  writeFileSync(resolve(fixtureScripts, '_prod_env.sh'), 'printf "environment-loader-ran\\n" >> "$TEST_EFFECTS_LOG"\nreturn 97\n');
  writeFileSync(resolve(worker, '.env-prod'), 'printf "synthetic-env-sourced\\n" >> "$TEST_EFFECTS_LOG"\n');
  writeFileSync(resolve(worker, 'wrangler.toml'), 'name = "fixture-worker"\nmain = "src/index.ts"\n[assets]\ndirectory = "../apps/web/dist"\n[[d1_databases]]\nbinding = "D1_MAIN"\nmigrations_dir = "migrations"\n[env.production]\nname = "fixture-worker-production"\n[[env.production.d1_databases]]\nbinding = "D1_MAIN"\nmigrations_dir = "migrations"\n');
  writeFileSync(resolve(worker, 'migrations/0001_fixture.sql'), 'CREATE TABLE fixture (id TEXT PRIMARY KEY);\n');
  for (const command of ['npm', 'npx', 'curl', 'wrangler', 'git']) {
    writeFileSync(resolve(directory, 'bin', command), `#!/bin/sh\nprintf '${command} ran\\n' >> "$TEST_EFFECTS_LOG"\nexit 98\n`, { mode: 0o755 });
  }
  return { directory, worker, fixtureScripts, commandLog };
}

test('DRY_RUN exits before environment loaders, migration, providers, secret sync and build', () => {
  const fixture = releaseFixture();
  try {
    const result = spawnSync('bash', [resolve(fixture.fixtureScripts, 'deploy_production.sh')], {
      cwd: fixture.directory,
      env: { PATH: `${resolve(fixture.directory, 'bin')}:${process.env.PATH}`, TEST_EFFECTS_LOG: fixture.commandLog, DRY_RUN: '1', APPLY_D1_MIGRATIONS: '1', RUN_SECRET_SYNC: '1', RUN_PREDEPLOY_TESTS: '1' },
      encoding: 'utf8', timeout: 10_000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(existsSync(fixture.commandLog), false, 'dry run reached a forbidden effect');
    const plan = JSON.parse(result.stdout);
    assert.equal(plan.mode, 'offline-plan');
    assert.equal(plan.effectsExecuted, false);
    assert.equal(plan.target.environment, 'production');
  } finally { rmSync(fixture.directory, { recursive: true, force: true }); }
});

test('release plan flags and an explicit environment file never load that file', () => {
  const fixture = releaseFixture();
  try {
    for (const flag of ['--plan', '--dry-run']) {
      const result = spawnSync('bash', [resolve(fixture.fixtureScripts, 'deploy_production.sh'), flag, '--env', 'production', resolve(fixture.worker, '.env-prod')], {
        cwd: fixture.directory,
        env: { PATH: `${resolve(fixture.directory, 'bin')}:${process.env.PATH}`, TEST_EFFECTS_LOG: fixture.commandLog, APPLY_D1_MIGRATIONS: '1' },
        encoding: 'utf8', timeout: 10_000,
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(existsSync(fixture.commandLog), false);
      const plan = JSON.parse(result.stdout);
      assert.equal(plan.target.workerName, 'fixture-worker-production');
      assert.equal(plan.migrations.requested, true);
      assert.match(plan.migrations.inventory[0].sha256, /^[a-f0-9]{64}$/);
      assert.equal(plan.environmentFilesRead, false);
    }
  } finally { rmSync(fixture.directory, { recursive: true, force: true }); }
});

test('standalone migration dry-run and plan do not load environment or reach remote commands', () => {
  const fixture = releaseFixture();
  try {
    for (const args of [[], ['--plan'], ['--dry-run', '--env=production']]) {
      const result = spawnSync('bash', [resolve(fixture.fixtureScripts, 'apply_d1_migrations_remote.sh'), ...args], {
        cwd: fixture.directory,
        env: { PATH: `${resolve(fixture.directory, 'bin')}:${process.env.PATH}`, TEST_EFFECTS_LOG: fixture.commandLog, DRY_RUN: args.length ? '0' : '1' },
        encoding: 'utf8', timeout: 10_000,
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(existsSync(fixture.commandLog), false);
      const plan = JSON.parse(result.stdout);
      assert.equal(plan.operation, 'migration');
      assert.equal(plan.migrations.requested, true);
      assert.equal(plan.effectsExecuted, false);
    }
  } finally { rmSync(fixture.directory, { recursive: true, force: true }); }
});

function workflowCondition(name) {
  const workflow = readFileSync(resolve(scripts, '../../.github/workflows/deploy-regovise-edge.yml'), 'utf8');
  const marker = `      - name: ${name}\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `Missing release step: ${name}`);
  const remainder = workflow.slice(start + marker.length);
  const block = remainder.split(/\n      - /)[0];
  const condition = block.match(/^\s+if: (.+)$/m)?.[1];
  assert.ok(condition, `Missing effect guard: ${name}`);
  return condition;
}

// Evaluate the small declarative condition language, never JavaScript from a workflow.
function evaluateCondition(condition, context) {
  const tokens = condition.match(/'[^']*'|\b(?:true|false)\b|[a-zA-Z_][a-zA-Z0-9_.]*|==|!=|&&|\|\||[()]/g) ?? [];
  let index = 0;
  function value() {
    const token = tokens[index++];
    if (token === '(') { const result = or(); assert.equal(tokens[index++], ')'); return result; }
    if (token === 'true' || token === 'false') return token === 'true';
    if (token?.startsWith("'")) return token.slice(1, -1);
    assert.ok(Object.hasOwn(context, token), `Unknown workflow value: ${token}`);
    return context[token];
  }
  function comparison() {
    const left = value();
    const operator = tokens[index];
    if (operator !== '==' && operator !== '!=') return left;
    index += 1;
    const right = value();
    return operator === '==' ? left === right : left !== right;
  }
  function and() { let result = comparison(); while (tokens[index] === '&&') { index += 1; const right = comparison(); result = Boolean(result && right); } return result; }
  function or() { let result = and(); while (tokens[index] === '||') { index += 1; const right = and(); result = Boolean(result || right); } return result; }
  const result = or();
  assert.equal(index, tokens.length, 'Unparsed workflow condition');
  return Boolean(result);
}

test('CI does not apply migrations when manual release is a dry run', () => {
  const condition = workflowCondition('Apply D1 migrations');
  for (const event of ['workflow_dispatch', 'push']) for (const apply of [true, false]) for (const dry of [true, false]) {
    assert.equal(evaluateCondition(condition, { 'github.event_name': event, 'inputs.apply_migrations': apply, 'inputs.dry_run': dry }), event === 'workflow_dispatch' && apply && !dry, `${event}, apply=${apply}, dry=${dry}`);
  }
});

test('plan inventories only the named target binding and rejects unknown or escaping targets', () => {
  const fixture = releaseFixture();
  try {
    const config = resolve(fixture.worker, 'wrangler.toml');
    const original = readFileSync(config, 'utf8');
    writeFileSync(config, `${original}[[env.production.d1_databases]]\nbinding = "OTHER_DATABASE"\nmigrations_dir = "missing-other-migrations"\n`);
    const plan = createReleasePlan({ root: fixture.worker });
    assert.equal(plan.migrations.binding, 'D1_MAIN');
    assert.equal(plan.migrations.inventory.length, 1);
    assert.throws(() => createReleasePlan({ root: fixture.worker, environment: 'undeclared' }), /not declared/);
    assert.throws(() => createReleasePlan({ root: fixture.worker, environment: '../production' }), /named Wrangler/);
    writeFileSync(config, original.replaceAll('migrations_dir = "migrations"', 'migrations_dir = "../outside"'));
    assert.throws(() => createReleasePlan({ root: fixture.worker }), /within the Worker/);
  } finally { rmSync(fixture.directory, { recursive: true, force: true }); }
});

test('CI manual dry-run skips every cloud-affecting release step', () => {
  for (const name of ['Validate production probe inputs before cloud mutations', 'Apply D1 migrations', 'Deploy worker', 'Post-deploy release probe']) {
    assert.equal(evaluateCondition(workflowCondition(name), { 'github.event_name': 'workflow_dispatch', 'inputs.apply_migrations': true, 'inputs.dry_run': true }), false, `${name} must not run in a dry release`);
  }
});

test('invalid plan arguments fail before any environment loader or provider operation', () => {
  const fixture = releaseFixture();
  try {
    for (const script of ['deploy_production.sh', 'apply_d1_migrations_remote.sh']) for (const args of [['--plan', '--env'], ['--plan', '--env='], ['--plan', '--env', 'undeclared'], ['--plan', '--unexpected']]) {
      const result = spawnSync('bash', [resolve(fixture.fixtureScripts, script), ...args], {
        cwd: fixture.directory,
        env: { PATH: `${resolve(fixture.directory, 'bin')}:${process.env.PATH}`, TEST_EFFECTS_LOG: fixture.commandLog },
        encoding: 'utf8', timeout: 10_000,
      });
      assert.notEqual(result.status, 0, `${script}: ${args.join(' ')}`);
      assert.equal(existsSync(fixture.commandLog), false);
    }
  } finally { rmSync(fixture.directory, { recursive: true, force: true }); }
});

test('production-check shell plans before loading credentials and never invokes provider helpers', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'regovise-probe-plan-shell-'));
  try {
    const worker = resolve(directory, 'cloudflare'); const fixtureScripts = resolve(worker, 'scripts'); const release = resolve(directory, 'ops/release');
    mkdirSync(fixtureScripts, { recursive: true }); mkdirSync(release, { recursive: true });
    copyFileSync(resolve(scripts, 'check_production_release.sh'), resolve(fixtureScripts, 'check_production_release.sh'));
    const forbidden = resolve(directory, 'forbidden.log');
    writeFileSync(resolve(fixtureScripts, '_prod_env.sh'), 'printf "credential-loader-ran\\n" >> "$TEST_EFFECTS_LOG"\nreturn 97\n');
    writeFileSync(resolve(worker, '.env-prod'), 'printf "synthetic-env-sourced\\n" >> "$TEST_EFFECTS_LOG"\n');
    writeFileSync(resolve(release, 'production_probe.mjs'), 'if (!process.argv.includes("--plan")) process.exit(98); console.log(JSON.stringify({mode:"offline-probe-plan",cloudRequestsMade:false}));');
    for (const args of [['--plan'], ['--dry-run', '--bootstrap-session'], []]) {
      const result = spawnSync('bash', [resolve(fixtureScripts, 'check_production_release.sh'), ...args, resolve(worker, '.env-prod')], { cwd: directory, env: { PATH: process.env.PATH, TEST_EFFECTS_LOG: forbidden, ...(args.length ? {} : { DRY_RUN: '1' }) }, encoding: 'utf8', timeout: 10_000 });
      assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).cloudRequestsMade, false); assert.equal(existsSync(forbidden), false);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('real release refuses absent validation metadata before loading credentials', () => {
  const fixture = releaseFixture();
  try {
    const result = spawnSync('bash', [resolve(fixture.fixtureScripts, 'deploy_production.sh'), resolve(fixture.worker, '.env-prod')], { cwd: fixture.directory, env: { PATH: process.env.PATH, TEST_EFFECTS_LOG: fixture.commandLog }, encoding: 'utf8', timeout: 10_000 });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /validated commit/); assert.equal(existsSync(fixture.commandLog), false);
  } finally { rmSync(fixture.directory, { recursive: true, force: true }); }
});

test('real shell validates required production probe configuration before either cloud mutation',()=>{
  const source=readFileSync(resolve(scripts,'deploy_production.sh'),'utf8'); const preflight=source.indexOf('production_probe.mjs" --validate-inputs');
  assert.ok(preflight>0);assert.ok(preflight<source.indexOf('release_artifact.mjs" migrate'));assert.ok(preflight<source.indexOf('release_artifact.mjs" deploy'));
});
