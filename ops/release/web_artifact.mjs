#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function entryExists(location) {
  try { fs.lstatSync(location); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

export function checkCommit(commit) {
  if (typeof commit !== 'string' || !/^[a-f0-9]{40}$/.test(commit)) throw new Error('An explicit 40-character commit SHA is required.');
}

export function checkRelative(value) {
  if (typeof value !== 'string' || !value || /[\\\x00-\x1f]/.test(value) || value.startsWith('/') || /^[a-zA-Z]:/.test(value)
    || value.split('/').some((part) => !part || part === '.' || part === '..') || path.posix.normalize(value) !== value) {
    throw new Error(`Unsafe artifact path: ${JSON.stringify(value)}`);
  }
  if (/^(?:\.env(?:[.-].*)?|\.dev\.vars(?:\..*)?)$/.test(path.posix.basename(value))) throw new Error('Environment files cannot be packaged as web assets.');
}

export function assertDirectory(directory) {
  const status = fs.lstatSync(directory);
  if (status.isSymbolicLink() || !status.isDirectory()) throw new Error(`Expected an ordinary artifact directory: ${directory}`);
}

export function inspectTree(directory) {
  assertDirectory(directory);
  const files = [];
  const directories = [];
  function visit(current, prefix = '') {
    for (const name of fs.readdirSync(current).sort()) {
      const relative = prefix ? `${prefix}/${name}` : name;
      checkRelative(relative);
      const location = path.join(current, name);
      const status = fs.lstatSync(location);
      if (status.isSymbolicLink()) throw new Error(`Artifact symlinks are not allowed: ${relative}`);
      if (status.isDirectory()) { directories.push(relative); visit(location, relative); }
      else if (status.isFile()) { const bytes = fs.readFileSync(location); files.push({ path: relative, size: bytes.length, sha256: digest(bytes) }); }
      else throw new Error(`Unsupported artifact entry: ${relative}`);
    }
  }
  visit(directory);
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  directories.sort();
  return { files, directories };
}

function resolvedLocation(location) {
  let ancestor = path.resolve(location);
  const parts = [];
  while (!entryExists(ancestor)) { parts.unshift(path.basename(ancestor)); ancestor = path.dirname(ancestor); }
  return path.join(fs.realpathSync(ancestor), ...parts);
}

export function assertSeparate(first, second) {
  const a = resolvedLocation(first);
  const b = resolvedLocation(second);
  for (const relative of [path.relative(a, b), path.relative(b, a)]) {
    if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) throw new Error('Artifact and source/destination directories must not overlap.');
  }
}

export function createWebArtifact({ source, artifact, commit }) {
  checkCommit(commit);
  assertSeparate(source, artifact);
  if (entryExists(artifact)) throw new Error('Artifact output already exists; use a new output directory.');
  const inventory = inspectTree(source);
  if (!inventory.files.some((file) => file.path === 'index.html' && file.size > 0)) throw new Error('Web build must contain a nonempty index.html.');
  const manifest = { schemaVersion: 1, kind: 'regovise-web-static', commit, ...inventory };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const manifestSha256 = digest(manifestBytes);
  fs.mkdirSync(path.dirname(artifact), { recursive: true });
  const stage = `${artifact}.stage-${randomUUID()}`;
  fs.mkdirSync(stage);
  try {
    fs.cpSync(source, path.join(stage, 'web'), { recursive: true, dereference: false });
    fs.writeFileSync(path.join(stage, 'manifest.json'), manifestBytes, { flag: 'wx' });
    verifyWebArtifact({ artifact: stage, commit, manifestSha256 });
    if (entryExists(artifact)) throw new Error('Artifact output appeared while packaging; refusing to replace it.');
    fs.renameSync(stage, artifact);
    return { commit, manifestSha256, files: inventory.files.length, directories: inventory.directories.length };
  } finally { fs.rmSync(stage, { recursive: true, force: true }); }
}

export function verifyWebArtifact({ artifact, commit, manifestSha256 }) {
  checkCommit(commit);
  assertDirectory(artifact);
  if (!/^[a-f0-9]{64}$/.test(manifestSha256 ?? '')) throw new Error('The independently retained manifest SHA-256 is required.');
  const entries = fs.readdirSync(artifact).sort();
  if (JSON.stringify(entries) !== JSON.stringify(['manifest.json', 'web'])) throw new Error('Unexpected or missing entries in the artifact package.');
  const manifestPath = path.join(artifact, 'manifest.json');
  const status = fs.lstatSync(manifestPath);
  if (status.isSymbolicLink() || !status.isFile()) throw new Error('The artifact manifest must be an ordinary file.');
  const bytes = fs.readFileSync(manifestPath);
  if (digest(bytes) !== manifestSha256) throw new Error('Artifact manifest digest mismatch.');
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (manifest.schemaVersion !== 1 || manifest.kind !== 'regovise-web-static' || manifest.commit !== commit) throw new Error('Artifact schema or commit does not match the validated release.');
  if (!Array.isArray(manifest.files) || !manifest.files.length || !Array.isArray(manifest.directories)) throw new Error('Artifact manifest needs files and directories.');
  const names = new Set();
  for (const file of manifest.files) {
    if (!file || typeof file !== 'object') throw new Error('Invalid artifact file record.');
    checkRelative(file.path);
    if (names.has(file.path)) throw new Error('Duplicate artifact file path.');
    names.add(file.path);
    if (!Number.isSafeInteger(file.size) || file.size < 0 || !/^[a-f0-9]{64}$/.test(file.sha256 ?? '')) throw new Error('Invalid artifact file size or digest.');
  }
  const directoryNames = new Set();
  for (const directory of manifest.directories) { checkRelative(directory); if (directoryNames.has(directory)) throw new Error('Duplicate artifact directory path.'); directoryNames.add(directory); }
  const actual = inspectTree(path.join(artifact, 'web'));
  if (JSON.stringify(actual.directories) !== JSON.stringify(manifest.directories)) throw new Error('Unexpected or missing artifact directories.');
  if (JSON.stringify(actual.files) !== JSON.stringify(manifest.files)) throw new Error('Artifact files are missing, unexpected or have altered bytes.');
  if (!actual.files.some((file) => file.path === 'index.html' && file.size > 0)) throw new Error('Artifact has no valid web entrypoint.');
  return { ...manifest, manifestSha256 };
}

export function installWebArtifact({ artifact, destination, commit, manifestSha256 }) {
  assertSeparate(artifact, destination);
  const verified = verifyWebArtifact({ artifact, commit, manifestSha256 });
  if (entryExists(destination)) throw new Error('Install destination already exists; refusing to replace existing files.');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const stage = `${destination}.stage-${randomUUID()}`;
  fs.mkdirSync(stage);
  try {
    fs.cpSync(path.join(artifact, 'web'), path.join(stage, 'web'), { recursive: true, dereference: false });
    fs.copyFileSync(path.join(artifact, 'manifest.json'), path.join(stage, 'manifest.json'));
    verifyWebArtifact({ artifact: stage, commit, manifestSha256 });
    if (entryExists(destination)) throw new Error('Install destination appeared while validating; refusing to replace it.');
    fs.renameSync(path.join(stage, 'web'), destination);
    return { commit, manifestSha256, files: verified.files.length };
  } finally { fs.rmSync(stage, { recursive: true, force: true }); }
}

function main(args) {
  const [command, ...flags] = args;
  if (!['create', 'verify', 'install'].includes(command)) throw new Error('Use create, verify or install.');
  const options = { source: path.join(root, 'apps/web/dist'), artifact: path.join(root, 'target/regovise-web-artifact'), destination: path.join(root, 'apps/web/dist') };
  const keys = { '--source': 'source', '--artifact': 'artifact', '--destination': 'destination', '--commit': 'commit', '--manifest-sha256': 'manifestSha256', '--github-output': 'githubOutput' };
  const seen = new Set();
  for (let index = 0; index < flags.length; index += 2) {
    const key = Object.hasOwn(keys, flags[index]) ? keys[flags[index]] : undefined;
    const value = flags[index + 1];
    if (!key || !value || value.startsWith('--') || seen.has(key)) throw new Error(`Invalid artifact argument: ${flags[index]}`);
    seen.add(key);
    options[key] = ['source', 'artifact', 'destination', 'githubOutput'].includes(key) ? path.resolve(value) : value;
  }
  if (options.githubOutput && command !== 'create') throw new Error('GitHub outputs are only written by create.');
  const result = command === 'create' ? createWebArtifact(options) : command === 'verify' ? verifyWebArtifact(options) : installWebArtifact(options);
  if (options.githubOutput) {
    fs.appendFileSync(options.githubOutput, `manifest_sha256=${result.manifestSha256}\n`);
  }
  process.stdout.write(`${JSON.stringify({ status: 'validated', commit: result.commit, manifestSha256: result.manifestSha256, files: Array.isArray(result.files) ? result.files.length : result.files })}\n`);
}

if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`Web artifact rejected: ${error.message}`); process.exitCode = 1; }
}
