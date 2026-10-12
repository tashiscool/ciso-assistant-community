#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { digest, entryExists, checkCommit, inspectTree, assertDirectory, assertSeparate } from './web_artifact.mjs';
import { child, isolatedEnvironment } from '../local/run_worker.mjs';
import { sourceFingerprint } from '../lib/repository.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const wrangler = path.join(root, 'cloudflare/node_modules/wrangler/bin/wrangler.js');

// Retain all public bindings/routes/DO migrations. Change only relocatable paths.
// Reject build hooks and unsupported local file references rather than execute them.
export function relocatedConfig(source, { main = 'worker/index.js', assets = 'web', migrations = 'migrations' } = {}) {
  if (/^\s*\[\[?(?:build|site|containers|env\.[^.]+\.(?:build|site|containers))(?:\.|\])/m.test(source)
    || /^\s*(?:tsconfig|base_dir|wasm_modules|text_blobs|data_blobs|alias|python_modules)\s*=/m.test(source)) {
    throw new Error('Public config contains unsupported build hooks or file references.');
  }
  let section = ''; let mainCount = 0; let assetsCount = 0;
  const lines = source.split(/\r?\n/).map((line) => {
    const header = line.match(/^\s*\[\[?([^\]]+)\]\]?\s*(?:#.*)?$/);
    if (header) section = header[1].trim();
    if (/^\s*main\s*=/.test(line)) {
      if (section !== '') throw new Error('Environment-specific entrypoints require an explicit packaging contract.');
      mainCount += 1; return `main = ${JSON.stringify(main)}`;
    }
    if (/^\s*directory\s*=/.test(line)) {
      if (section !== 'assets') throw new Error('Only the root public assets directory is supported.');
      assetsCount += 1; return `directory = ${JSON.stringify(assets)}`;
    }
    if (/^\s*migrations_dir\s*=/.test(line)) return `migrations_dir = ${JSON.stringify(migrations)}`;
    return line;
  });
  if (mainCount !== 1 || assetsCount !== 1 || !/^\s*\[env\.production\]\s*$/m.test(source)) throw new Error('Packaging requires one main, one assets directory and a production environment.');
  return lines.join('\n');
}

export function releaseEnvironment(scratch, { credentials = false, existingAuth = false, environment = process.env } = {}) {
  const env = isolatedEnvironment(scratch);
  if (!credentials) return env;
  if (!/^[a-f0-9]{32}$/i.test(environment.CLOUDFLARE_ACCOUNT_ID ?? '')) throw new Error('Release authentication requires an explicit Cloudflare account ID from trusted account metadata.');
  env.CLOUDFLARE_ACCOUNT_ID = environment.CLOUDFLARE_ACCOUNT_ID;
  if (environment.CLOUDFLARE_API_TOKEN) env.CLOUDFLARE_API_TOKEN = environment.CLOUDFLARE_API_TOKEN;
  else if (existingAuth || environment.REGOVISE_USE_EXISTING_WRANGLER_AUTH === '1') {
    if (environment.GITHUB_ACTIONS === 'true') throw new Error('Cached Wrangler authentication is unavailable in the canonical CI release lane.');
    if (!environment.HOME) throw new Error('Explicit cached Wrangler authentication requires the existing user home context.');
    // Pass the operator's existing context unchanged. Only Wrangler reads its
    // native credential storage; this tool never opens or prints those files.
    env.HOME = environment.HOME;
    delete env.XDG_CONFIG_HOME;
    if (environment.XDG_CONFIG_HOME) env.XDG_CONFIG_HOME = environment.XDG_CONFIG_HOME;
  } else throw new Error('Release credentials require CLOUDFLARE_API_TOKEN or explicit --use-existing-wrangler-auth.');
  return env;
}

export async function runWrangler(args, { scratch, credentials = false, existingAuth = false, execute = child } = {}) {
  const env = releaseEnvironment(scratch, { credentials, existingAuth });
  const log = path.join(scratch, `wrangler-${randomUUID()}.log`);
  const owned = await execute(process.execPath, [wrangler, ...args], scratch, env, log, { timeoutMs: credentials ? 600_000 : 120_000 });
  const result = await owned.done;
  if (result.code !== 0 || result.timedOut || result.cleanupTimedOut || result.error || result.logError) {
    // Wrangler may echo credentials or provider responses on failure. Keep logs
    // private in the owned scratch directory; never forward them into CI output.
    throw new Error(`Wrangler ${credentials ? 'deployment' : 'offline packaging'} failed; exit=${result.code ?? 'unknown'}, timedOut=${Boolean(result.timedOut)}.`);
  }
  const deployment = args[0] === 'deploy' && !args.includes('--dry-run');
  const publicReceipt = credentials ? parseWranglerSuccess(fs.readFileSync(log, 'utf8'), { deployment }) : null;
  return { ...result, publicReceipt };
}

export function parseWranglerSuccess(output, { deployment = true } = {}) {
  const plain = output.replace(/\x1b\[[0-9;]*m/g, '');
  if (!deployment) return { source: 'successful-wrangler-exit', operation: 'd1-migrations-apply', exitCode: 0 };
  const ids = [...plain.matchAll(/^\s*Current Version ID:\s*([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\s*$/gmi)].map((match) => match[1].toLowerCase());
  if (ids.length !== 1) throw new Error('Deployment finished without one authoritative Wrangler version ID; verify the deployed version separately before declaring success.');
  return { source: 'wrangler-current-version-id', operation: 'worker-deploy', exitCode: 0, versionId: ids[0] };
}

export async function createReleaseArtifact({ web = path.join(root, 'apps/web/dist'), config = path.join(root, 'cloudflare/wrangler.toml'), migrations = path.join(root, 'cloudflare/migrations'), artifact, commit, fingerprint = null, run = runWrangler } = {}) {
  checkCommit(commit);
  for (const source of [web, migrations, path.dirname(config)]) assertSeparate(source, artifact);
  if (entryExists(artifact)) throw new Error('Release artifact output already exists; choose a new output directory.');
  const configStat = fs.lstatSync(config);
  if (!configStat.isFile() || configStat.isSymbolicLink()) throw new Error('Public Wrangler configuration must be an ordinary file.');
  const sourceConfig = fs.readFileSync(config, 'utf8');
  const configBytes = relocatedConfig(sourceConfig);
  const webTree = inspectTree(web); const migrationTree = inspectTree(migrations);
  if (!webTree.files.some((file) => file.path === 'index.html' && file.size)) throw new Error('Validated web entrypoint is missing.');
  if (migrationTree.files.some((file) => !file.path.endsWith('.sql'))) throw new Error('Migration inventory must contain SQL files only.');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'regovise-release-package-'));
  const stage = `${artifact}.stage-${randomUUID()}`;
  try {
    const emptyEnv = path.join(scratch, 'empty.env'); fs.writeFileSync(emptyEnv, '', { mode: 0o600 });
    const packingConfig = path.join(scratch, 'wrangler.toml');
    fs.writeFileSync(packingConfig, relocatedConfig(sourceConfig, { main: path.join(path.dirname(config), 'src/index.ts'), assets: web, migrations }));
    const bundle = path.join(scratch, 'worker');
    await run(['deploy', '--dry-run', '--env', 'production', '--config', packingConfig, '--env-file', emptyEnv, '--tsconfig', path.join(path.dirname(config), 'tsconfig.json'), '--outdir', bundle], { scratch });
    // Wrangler's README embeds a build timestamp and is not an uploaded module.
    fs.rmSync(path.join(bundle, 'README.md'), { force: true });
    // Wrangler emits a diagnostic map even when upload_source_maps is false.
    // It is not an uploaded runtime module in this public configuration.
    if (/^\s*upload_source_maps\s*=\s*true/m.test(sourceConfig)) throw new Error('Source-map uploads need an explicit artifact contract.');
    fs.rmSync(path.join(bundle, 'index.js.map'), { force: true });
    const workerTree = inspectTree(bundle);
    if (!workerTree.files.some((file) => file.path === 'index.js' && file.size)) throw new Error('Compiled Worker entrypoint is missing.');
    fs.mkdirSync(path.dirname(artifact), { recursive: true }); fs.mkdirSync(stage);
    const payload = path.join(stage, 'payload'); fs.mkdirSync(payload);
    fs.cpSync(web, path.join(payload, 'web'), { recursive: true, dereference: false });
    fs.cpSync(bundle, path.join(payload, 'worker'), { recursive: true, dereference: false });
    fs.cpSync(migrations, path.join(payload, 'migrations'), { recursive: true, dereference: false });
    fs.writeFileSync(path.join(payload, 'wrangler.toml'), configBytes);
    fs.writeFileSync(path.join(payload, 'source-wrangler.toml'), sourceConfig);
    const proof = path.join(scratch, 'promoted-worker');
    await run(['deploy', '--no-bundle', '--dry-run', '--env', 'production', '--config', path.join(payload, 'wrangler.toml'), '--env-file', emptyEnv, '--outdir', proof], { scratch });
    fs.rmSync(path.join(proof, 'README.md'), { force: true });
    if (JSON.stringify(inspectTree(proof)) !== JSON.stringify(workerTree)) throw new Error('No-bundle validation changed or omitted Worker runtime bytes.');
    const inventory = inspectTree(payload);
    const manifest = { schemaVersion: 1, kind: 'regovise-edge-release', commit, sourceFingerprint: fingerprint, environment: 'production', sourceConfigSha256: digest(sourceConfig), workerEntrypoint: 'worker/index.js', noBundleProof: 'identical-runtime-files', ...inventory };
    const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`); const manifestSha256 = digest(bytes);
    fs.writeFileSync(path.join(stage, 'manifest.json'), bytes, { flag: 'wx' });
    verifyReleaseArtifact({ artifact: stage, commit, manifestSha256 });
    if (entryExists(artifact)) throw new Error('Release artifact appeared while packaging.');
    fs.renameSync(stage, artifact);
    return { commit, manifestSha256, files: inventory.files.length, noBundleProof: manifest.noBundleProof };
  } finally { fs.rmSync(stage, { recursive: true, force: true }); fs.rmSync(scratch, { recursive: true, force: true }); }
}

export function verifyReleaseArtifact({ artifact, commit, manifestSha256 } = {}) {
  checkCommit(commit); assertDirectory(artifact);
  if (!/^[a-f0-9]{64}$/.test(manifestSha256 ?? '')) throw new Error('The independently retained manifest SHA-256 is required.');
  if (JSON.stringify(fs.readdirSync(artifact).sort()) !== JSON.stringify(['manifest.json', 'payload'])) throw new Error('Unexpected release package entries.');
  const manifestPath = path.join(artifact, 'manifest.json'); const stat = fs.lstatSync(manifestPath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Manifest must be an ordinary file.');
  const bytes = fs.readFileSync(manifestPath);
  if (digest(bytes) !== manifestSha256) throw new Error('Release manifest digest mismatch.');
  const manifest = JSON.parse(bytes);
  if (manifest.schemaVersion !== 1 || manifest.kind !== 'regovise-edge-release' || manifest.commit !== commit || manifest.environment !== 'production' || manifest.workerEntrypoint !== 'worker/index.js' || manifest.noBundleProof !== 'identical-runtime-files') throw new Error('Release manifest contract or commit mismatch.');
  const payload = path.join(artifact, 'payload'); const actual = inspectTree(payload);
  if (JSON.stringify(actual.files) !== JSON.stringify(manifest.files) || JSON.stringify(actual.directories) !== JSON.stringify(manifest.directories)) throw new Error('Release files are missing, unexpected or altered.');
  for (const file of ['web/index.html', 'worker/index.js', 'wrangler.toml', 'source-wrangler.toml']) if (!actual.files.some((entry) => entry.path === file && entry.size)) throw new Error(`Release entry is missing: ${file}`);
  const source = fs.readFileSync(path.join(payload, 'source-wrangler.toml'), 'utf8');
  if (digest(source) !== manifest.sourceConfigSha256 || fs.readFileSync(path.join(payload, 'wrangler.toml'), 'utf8') !== relocatedConfig(source)) throw new Error('Public release bindings differ from the validated source configuration.');
  return { ...manifest, manifestSha256 };
}

export async function deployReleaseArtifact(options, { run = runWrangler, migration = false } = {}) {
  const manifest = verifyReleaseArtifact(options);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'regovise-release-deploy-'));
  try {
    const snapshot = path.join(scratch, 'artifact');
    fs.cpSync(options.artifact, snapshot, { recursive: true, dereference: false });
    verifyReleaseArtifact({ ...options, artifact: snapshot });
    const emptyEnv = path.join(scratch, 'empty.env'); fs.writeFileSync(emptyEnv, '', { mode: 0o600 });
    const command = migration ? ['d1', 'migrations', 'apply', 'D1_MAIN', '--remote'] : ['deploy', '--no-bundle'];
    const result = await run([...command, '--env', 'production', '--config', path.join(snapshot, 'payload/wrangler.toml'), '--env-file', emptyEnv], { scratch, credentials: true, existingAuth: Boolean(options.existingAuth) });
    return { status: migration ? 'migrated' : 'deployed', commit: manifest.commit, manifestSha256: manifest.manifestSha256, files: manifest.files.length, providerReceipt: result?.publicReceipt ?? null };
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
}

export function assertCommittedSource(commit, repository = root) {
  checkCommit(commit);
  const env = { PATH: process.env.PATH ?? '', CI: '1' };
  const git = (args) => execFileSync('git', args, { cwd: repository, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (git(['rev-parse', 'HEAD']) !== commit) throw new Error('Release commit must match checked-out HEAD.');
  if (git(['status', '--porcelain', '--untracked-files=normal', '--', 'apps/web', 'cloudflare', 'ops', '.github/workflows', 'package.json', 'package-lock.json', '.nvmrc', '.node-version', '.npmrc', '.editorconfig'])) throw new Error('Commit the canonical source and release tooling before packaging.');
}

async function main(args) {
  const [command, ...flags] = args; if (!['create', 'verify', 'deploy', 'migrate'].includes(command)) throw new Error('Use create, verify, deploy or migrate.');
  const options = { artifact: path.join(root, 'target/regovise-release-artifact') };
  const keys = { '--artifact': 'artifact', '--commit': 'commit', '--manifest-sha256': 'manifestSha256', '--github-output': 'githubOutput' }; const seen = new Set();
  for (let index = 0; index < flags.length; index++) {
    if (flags[index] === '--use-existing-wrangler-auth') {
      if (!['deploy', 'migrate'].includes(command) || options.existingAuth) throw new Error('Existing Wrangler auth is only an explicit deploy/migrate choice.');
      options.existingAuth = true; continue;
    }
    const key = keys[flags[index]]; const value = flags[++index];
    if (!key || !value || value.startsWith('--') || seen.has(key)) throw new Error('Invalid release artifact argument.');
    seen.add(key); options[key] = ['artifact', 'githubOutput'].includes(key) ? path.resolve(value) : value;
  }
  if (options.githubOutput && command !== 'create') throw new Error('Only create can write GitHub output.');
  if (command === 'create') { assertCommittedSource(options.commit); options.fingerprint = await sourceFingerprint(); }
  const result = command === 'create' ? await createReleaseArtifact(options) : command === 'verify' ? verifyReleaseArtifact(options) : await deployReleaseArtifact(options, { migration: command === 'migrate' });
  if (command === 'create') {
    try { assertCommittedSource(options.commit); if (options.fingerprint !== await sourceFingerprint()) throw new Error('Canonical source changed during release packaging.'); }
    catch (error) { fs.rmSync(options.artifact, { recursive: true, force: true }); throw error; }
  }
  if (options.githubOutput) fs.appendFileSync(options.githubOutput, `manifest_sha256=${result.manifestSha256}\n`);
  console.log(JSON.stringify({ status: ['deploy', 'migrate'].includes(command) ? result.status : 'validated', commit: result.commit, manifestSha256: result.manifestSha256, files: Array.isArray(result.files) ? result.files.length : result.files, noBundleProof: result.noBundleProof, providerReceipt: result.providerReceipt }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch((error) => { console.error(`Release artifact rejected: ${error.message}`); process.exitCode = 1; });
