import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createWebArtifact, verifyWebArtifact, installWebArtifact } from './web_artifact.mjs';

const commit = 'a'.repeat(40);

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'regovise-web-artifact-'));
  const source = path.join(root, 'dist');
  const artifact = path.join(root, 'artifact');
  const destination = path.join(root, 'installed/dist');
  fs.mkdirSync(path.join(source, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(source, 'index.html'), '<!doctype html><title>Example</title>');
  fs.writeFileSync(path.join(source, 'assets/app.js'), 'export const application = true;');
  return { root, source, artifact, destination };
}

test('the committed validated web build is installed with identical file bytes', () => {
  const item = fixture();
  try {
    const created = createWebArtifact({ source: item.source, artifact: item.artifact, commit });
    const verified = verifyWebArtifact({ artifact: item.artifact, commit, manifestSha256: created.manifestSha256 });
    assert.equal(verified.commit, commit);
    assert.equal(verified.files.length, 2);
    installWebArtifact({ artifact: item.artifact, destination: item.destination, commit, manifestSha256: created.manifestSha256 });
    assert.deepEqual(fs.readFileSync(path.join(item.destination, 'assets/app.js')), fs.readFileSync(path.join(item.source, 'assets/app.js')));
    assert.deepEqual(fs.readFileSync(path.join(item.destination, 'index.html')), fs.readFileSync(path.join(item.source, 'index.html')));
  } finally { fs.rmSync(item.root, { recursive: true, force: true }); }
});

for (const change of ['tampered', 'missing', 'unexpected-file', 'unexpected-directory', 'unexpected-package-entry']) {
  test(`${change} content is rejected before web installation`, () => {
    const item = fixture();
    try {
      const created = createWebArtifact({ source: item.source, artifact: item.artifact, commit });
      const web = path.join(item.artifact, 'web');
      if (change === 'tampered') fs.writeFileSync(path.join(web, 'assets/app.js'), 'export const application = false;');
      if (change === 'missing') fs.unlinkSync(path.join(web, 'assets/app.js'));
      if (change === 'unexpected-file') fs.writeFileSync(path.join(web, 'extra.js'), 'unexpected');
      if (change === 'unexpected-directory') fs.mkdirSync(path.join(web, 'extra'));
      if (change === 'unexpected-package-entry') fs.writeFileSync(path.join(item.artifact, 'extra.json'), '{}');
      assert.throws(() => installWebArtifact({ artifact: item.artifact, destination: item.destination, commit, manifestSha256: created.manifestSha256 }), /unexpected|missing|altered/i);
      assert.equal(fs.existsSync(item.destination), false);
    } finally { fs.rmSync(item.root, { recursive: true, force: true }); }
  });
}

test('commit mismatch and replacement of both manifest and assets cannot promote an unvalidated build', () => {
  const item = fixture();
  try {
    const created = createWebArtifact({ source: item.source, artifact: item.artifact, commit });
    assert.throws(() => verifyWebArtifact({ artifact: item.artifact, commit: 'b'.repeat(40), manifestSha256: created.manifestSha256 }), /commit/);
    assert.throws(() => verifyWebArtifact({ artifact: item.artifact, commit }), /independently retained/);
    fs.writeFileSync(path.join(item.artifact, 'web/assets/app.js'), 'modified');
    const manifestPath = path.join(item.artifact, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.files.find((file) => file.path === 'assets/app.js').sha256 = createHash('sha256').update('modified').digest('hex');
    manifest.files.find((file) => file.path === 'assets/app.js').size = 8;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.throws(() => verifyWebArtifact({ artifact: item.artifact, commit, manifestSha256: created.manifestSha256 }), /manifest digest mismatch/);
  } finally { fs.rmSync(item.root, { recursive: true, force: true }); }
});

test('unsafe and duplicate manifest paths are rejected even with a matching manifest digest', () => {
  const item = fixture();
  try {
    createWebArtifact({ source: item.source, artifact: item.artifact, commit });
    const manifestPath = path.join(item.artifact, 'manifest.json');
    const original = fs.readFileSync(manifestPath, 'utf8');
    for (const invalid of ['../escape', '/absolute', 'C:\\escape', 'assets\\app.js', 'assets//app.js', '.env-prod']) {
      const manifest = JSON.parse(original);
      manifest.files[0].path = invalid;
      const bytes = JSON.stringify(manifest);
      fs.writeFileSync(manifestPath, bytes);
      assert.throws(() => verifyWebArtifact({ artifact: item.artifact, commit, manifestSha256: createHash('sha256').update(bytes).digest('hex') }), /Unsafe|Environment/);
    }
    const manifest = JSON.parse(original);
    manifest.files.push({ ...manifest.files[0] });
    const bytes = JSON.stringify(manifest);
    fs.writeFileSync(manifestPath, bytes);
    assert.throws(() => verifyWebArtifact({ artifact: item.artifact, commit, manifestSha256: createHash('sha256').update(bytes).digest('hex') }), /Duplicate/);
  } finally { fs.rmSync(item.root, { recursive: true, force: true }); }
});

test('asset symlinks are rejected and hidden web assets are retained', () => {
  const item = fixture();
  try {
    fs.mkdirSync(path.join(item.source, '.well-known'));
    fs.writeFileSync(path.join(item.source, '.well-known/association.json'), '{}');
    const created = createWebArtifact({ source: item.source, artifact: item.artifact, commit });
    assert.equal(verifyWebArtifact({ artifact: item.artifact, commit, manifestSha256: created.manifestSha256 }).files.length, 3);
    fs.symlinkSync(path.join(item.source, 'index.html'), path.join(item.artifact, 'web/linked.html'));
    assert.throws(() => installWebArtifact({ artifact: item.artifact, destination: item.destination, commit, manifestSha256: created.manifestSha256 }), /symlinks/);
    assert.equal(fs.existsSync(item.destination), false);
  } finally { fs.rmSync(item.root, { recursive: true, force: true }); }
});

test('packaging refuses invalid commits, overlapping outputs, and existing output or install files', () => {
  const item = fixture();
  try {
    assert.throws(() => createWebArtifact({ source: item.source, artifact: item.artifact, commit: 'main' }), /commit SHA/);
    assert.throws(() => createWebArtifact({ source: item.source, artifact: path.join(item.source, 'artifact'), commit }), /overlap/);
    const created = createWebArtifact({ source: item.source, artifact: item.artifact, commit });
    assert.throws(() => createWebArtifact({ source: item.source, artifact: item.artifact, commit }), /already exists/);
    fs.mkdirSync(item.destination, { recursive: true });
    fs.writeFileSync(path.join(item.destination, 'keep.txt'), 'existing user file');
    assert.throws(() => installWebArtifact({ artifact: item.artifact, destination: item.destination, commit, manifestSha256: created.manifestSha256 }), /already exists/);
    assert.equal(fs.readFileSync(path.join(item.destination, 'keep.txt'), 'utf8'), 'existing user file');
  } finally { fs.rmSync(item.root, { recursive: true, force: true }); }
});

test('artifact CLI records the independent manifest digest and installs without building', () => {
  const item = fixture();
  const executable = fileURLToPath(new URL('./web_artifact.mjs', import.meta.url));
  try {
    const output = path.join(item.root, 'github-output');
    const created = spawnSync(process.execPath, [executable, 'create', '--source', item.source, '--artifact', item.artifact, '--commit', commit, '--github-output', output], { encoding: 'utf8', timeout: 10_000 });
    assert.equal(created.status, 0, created.stderr);
    const result = JSON.parse(created.stdout);
    assert.equal(fs.readFileSync(output, 'utf8'), `manifest_sha256=${result.manifestSha256}\n`);
    const installed = spawnSync(process.execPath, [executable, 'install', '--artifact', item.artifact, '--destination', item.destination, '--commit', commit, '--manifest-sha256', result.manifestSha256], { encoding: 'utf8', timeout: 10_000 });
    assert.equal(installed.status, 0, installed.stderr);
    assert.deepEqual(fs.readFileSync(path.join(item.destination, 'index.html')), fs.readFileSync(path.join(item.source, 'index.html')));
  } finally { fs.rmSync(item.root, { recursive: true, force: true }); }
});

test('canonical CI validates without secrets, pins actions/runtime and promotes rather than rebuilds', () => {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const deploy = fs.readFileSync(path.join(repo, '.github/workflows/deploy-regovise-edge.yml'), 'utf8');
  const verify = fs.readFileSync(path.join(repo, '.github/workflows/verify-regovise.yml'), 'utf8');
  const pinned = new Set([
    'actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09',
    'actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444',
    'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
    'actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093',
  ]);
  for (const source of [deploy, verify]) {
    for (const match of source.matchAll(/uses:\s*(\S+)/g)) assert.ok(pinned.has(match[1]), `Unpinned/unreviewed action ${match[1]}`);
    assert.match(source, /NODE_VERSION: '22\.22\.0'/);
    assert.match(source, /permissions:\s*\n\s+contents: read/);
    assert.match(source, /run: npm run verify:full/);
    assert.match(source, /if: always\(\)/);
    assert.match(source, /timeout-minutes:/);
    assert.match(source, /persist-credentials: false/);
  }
  assert.doesNotMatch(verify, /\$\{\{\s*secrets\./);
  const validation = deploy.slice(deploy.indexOf('  validate:'), deploy.indexOf('  deploy:'));
  assert.doesNotMatch(validation, /\$\{\{\s*secrets\./);
  assert.match(validation, /id: release_artifact/);
  assert.match(validation, /include-hidden-files: true/);
  const promotion = deploy.slice(deploy.indexOf('  deploy:'));
  assert.doesNotMatch(promotion, /npm (?:run |--prefix[^\n]*run )build/);
  assert.match(promotion, /needs\.validate\.outputs\.manifest_sha256/);
  assert.match(promotion, /release_artifact\.mjs verify/);
  assert.match(promotion, /if: github\.ref == 'refs\/heads\/main' && \(github\.event_name != 'workflow_dispatch' \|\| inputs\.dry_run != true\)/);
  assert.ok(promotion.indexOf('release_artifact.mjs verify') < promotion.indexOf('name: Deploy worker'));
  const preflight = promotion.indexOf('name: Validate production probe inputs before cloud mutations');
  assert.ok(preflight > 0 && preflight < promotion.indexOf('name: Apply D1 migrations') && preflight < promotion.indexOf('name: Deploy worker'));
  assert.match(promotion, /production_probe\.mjs --validate-inputs --bootstrap-session/);
  assert.doesNotMatch(deploy, /secret put|ensure:observable-production|verify:observable-production|PROD_SMOKE_TENANT_ID|PROD_SMOKE_USER_ID/);
  assert.match(deploy, /production_probe\.mjs --bootstrap-session/);
  for (const source of [deploy, verify]) assert.match(source, /npm run audit:dependencies/);
});
