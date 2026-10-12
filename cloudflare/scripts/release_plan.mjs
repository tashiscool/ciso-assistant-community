#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const workerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function publicConfiguration(source) {
  let current = {};
  const sections = new Map([['', [current]]]);
  for (const line of source.split(/\r?\n/)) {
    const header = line.match(/^\s*\[\[?([^\]]+)\]\]?\s*(?:#.*)?$/);
    if (header) {
      const section = header[1].trim();
      current = {};
      const entries = sections.get(section) ?? [];
      entries.push(current);
      sections.set(section, entries);
      continue;
    }
    const value = line.match(/^\s*(name|main|binding|migrations_dir|directory)\s*=\s*"([^"\n]*)"\s*(?:#.*)?$/);
    if (value) current[value[1]] = value[2];
  }
  return sections;
}

export function createReleasePlan({ environment = 'production', operation = 'release', applyMigrations = false, checks = true, smoke = true, root = workerRoot } = {}) {
  if (!/^[a-zA-Z0-9_-]+$/.test(environment)) throw new Error('Use a named Wrangler environment or default.');
  if (!['release', 'migration'].includes(operation)) throw new Error('Operation must be release or migration.');
  const sections = publicConfiguration(fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8'));
  const scope = environment === 'default' ? '' : `env.${environment}`;
  if (!sections.has(scope)) throw new Error(`Wrangler environment is not declared: ${environment}`);
  const target = sections.get(scope)[0];
  const base = sections.get('')[0];
  const databases = (sections.get(scope ? `${scope}.d1_databases` : 'd1_databases') ?? []).filter((entry) => entry.binding === 'D1_MAIN');
  if (databases.length !== 1) throw new Error('The selected environment must declare exactly one D1_MAIN binding.');
  const database = databases[0];
  if (!database?.binding || !database.migrations_dir) throw new Error('The selected environment needs a declared D1 binding and migrations directory.');
  const migrationsDirectory = path.resolve(root, database.migrations_dir);
  const relativeDirectory = path.relative(root, migrationsDirectory);
  if (relativeDirectory.startsWith('..') || path.isAbsolute(relativeDirectory)) throw new Error('Migration inventory must remain within the Worker workspace.');
  const realRelativeDirectory = path.relative(fs.realpathSync(root), fs.realpathSync(migrationsDirectory));
  if (realRelativeDirectory.startsWith('..') || path.isAbsolute(realRelativeDirectory)) throw new Error('Migration inventory must remain within the Worker workspace.');
  const files = fs.readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => ({
      file: `${relativeDirectory.replace(/\\/g, '/')}/${entry.name}`,
      sha256: createHash('sha256').update(fs.readFileSync(path.join(migrationsDirectory, entry.name))).digest('hex'),
    }));
  const migrationRequested = operation === 'migration' || applyMigrations;
  const steps = operation === 'migration'
    ? [{ action: 'apply-d1-migrations', requiresAuthorization: true, planned: true }]
    : [
        { action: 'verify-cloudflare-access', requiresAuthorization: true, planned: true },
        ...(checks ? [{ action: 'dependency-advisory-gate-and-canonical-full-verification', requiresAuthorization: false, planned: true }] : []),
        ...(migrationRequested ? [{ action: 'apply-d1-migrations', requiresAuthorization: true, planned: true }] : []),
        { action: 'promote-verified-worker-web-config-artifact', requiresAuthorization: true, planned: true },
        ...(smoke ? [{ action: 'existing-cookie-and-exact-public-assets-probe', requiresAuthorization: true, planned: true }] : []),
      ];
  return {
    schemaVersion: 1,
    mode: 'offline-plan',
    operation,
    effectsExecuted: false,
    environmentFilesRead: false,
    cloudRequestsMade: false,
    commandsExecuted: [],
    target: { environment, workerName: target.name ?? base.name ?? null, entrypoint: base.main ?? null },
    assets: { directory: sections.get('assets')?.[0]?.directory ?? null },
    migrations: { requested: migrationRequested, binding: database.binding, inventory: files, targetHistoryChecked: false },
    steps,
    releaseContract: { commitBound: true, independentlyRetainedManifestDigest: true, workerRebundledAtDeploy: false, automaticSecretSync: false, clientFixturePreparation: false },
    limitations: [
      'This plan reads only public Wrangler metadata and local migration SQL; it executes no checks, builds, providers, migrations, secret operations, deployment, or smoke.',
      'Migration inventory is not a list of pending target migrations; target history and schema compatibility need a separately authorized preflight.',
      'Configured credentials, optional secret presence, provider readiness, and deployed state are not inspected.',
    ],
  };
}

function optionsFromArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--plan' || arg === '--dry-run') continue;
    if (arg === '--env' || arg === '--operation') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value.`);
      options[arg === '--env' ? 'environment' : 'operation'] = value;
    } else if (arg.startsWith('--env=')) options.environment = arg.slice(6);
    else if (arg.startsWith('--operation=')) options.operation = arg.slice(12);
    else if (arg === '--migrations') options.applyMigrations = true;
    else if (arg === '--no-secret-sync') { /* compatibility: promotion never syncs secrets */ }
    else if (arg === '--no-checks') options.checks = false;
    else if (arg === '--no-smoke') options.smoke = false;
    else throw new Error(`Unknown release-plan argument: ${arg}`);
  }
  return options;
}

if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])) {
  try {
    process.stdout.write(`${JSON.stringify(createReleasePlan(optionsFromArguments(process.argv.slice(2))), null, 2)}\n`);
  } catch (error) {
    console.error(`Release plan failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
