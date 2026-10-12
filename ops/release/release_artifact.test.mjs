import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createReleaseArtifact, verifyReleaseArtifact, deployReleaseArtifact, relocatedConfig, runWrangler, assertCommittedSource, parseWranglerSuccess, releaseEnvironment } from './release_artifact.mjs';
import { digest } from './web_artifact.mjs';

export const fixtureCommit = 'a'.repeat(40);
export function releaseFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'regovise-edge-artifact-test-'));
  const web = path.join(root, 'web'); const worker = path.join(root, 'cloudflare'); const migrations = path.join(worker, 'migrations'); const config = path.join(worker, 'wrangler.toml'); const artifact = path.join(root, 'artifact');
  fs.mkdirSync(path.join(web, 'assets'), { recursive: true }); fs.mkdirSync(migrations, { recursive: true });
  fs.writeFileSync(path.join(web, 'index.html'), '<!doctype html><title>Example</title>'); fs.writeFileSync(path.join(web, 'assets/app.js'), 'export const synthetic = true;'); fs.writeFileSync(path.join(migrations, '0001_fixture.sql'), 'CREATE TABLE synthetic (id TEXT);');
  fs.writeFileSync(config, 'name = "synthetic"\nmain = "src/index.ts"\ncompatibility_date = "2026-03-01"\n[assets]\ndirectory = "../web"\nbinding = "ASSETS"\n[env.production]\nname = "synthetic-production"\n[env.production.vars]\nAPP_ENV = "production"\n[[env.production.d1_databases]]\nbinding = "D1_MAIN"\ndatabase_id = "00000000-0000-0000-0000-000000000001"\nmigrations_dir = "migrations"\n');
  const calls = [];
  const run = async (args, options) => {
    calls.push({ args, options }); const output = args[args.indexOf('--outdir') + 1]; fs.mkdirSync(output);
    fs.writeFileSync(path.join(output, 'index.js'), 'export default {fetch:()=>new Response("synthetic")};'); fs.writeFileSync(path.join(output, 'README.md'), 'timestamp diagnostic');
    if (!args.includes('--no-bundle')) fs.writeFileSync(path.join(output, 'index.js.map'), '{}');
  };
  return { root, web, worker, migrations, config, artifact, calls, run, commit: fixtureCommit };
}
export async function packagedFixture() { const item = releaseFixture(); const created = await createReleaseArtifact(item); return { ...item, manifestSha256: created.manifestSha256 }; }

test('combined package retains exact Worker/UI/SQL/config and proves no-bundle byte identity', async () => {
  const item = await packagedFixture();
  try {
    const manifest = verifyReleaseArtifact(item);
    assert.equal(manifest.noBundleProof, 'identical-runtime-files'); assert.equal(item.calls.length, 2);
    assert.ok(item.calls.every((call) => call.args.includes('--dry-run') && call.args.includes('--env-file') && !call.options.credentials));
    assert.ok(item.calls[1].args.includes('--no-bundle'));
    assert.equal(fs.readFileSync(path.join(item.artifact, 'payload/web/assets/app.js'), 'utf8'), fs.readFileSync(path.join(item.web, 'assets/app.js'), 'utf8'));
    assert.ok(manifest.files.some((file) => file.path === 'migrations/0001_fixture.sql'));
    assert.ok(!manifest.files.some((file) => file.path.endsWith('.map') || file.path.endsWith('README.md')));
    const config = fs.readFileSync(path.join(item.artifact, 'payload/wrangler.toml'), 'utf8');
    assert.match(config, /main = "worker\/index.js"/); assert.match(config, /directory = "web"/); assert.match(config, /name = "synthetic-production"/); assert.match(config, /binding = "D1_MAIN"/);
  } finally { fs.rmSync(item.root, { recursive: true, force: true }); }
});

for (const change of ['worker', 'web', 'configuration', 'missing-migration', 'extra-file', 'extra-directory', 'symlink', 'manifest']) test(`${change} tampering blocks every provider command`, async () => {
  const item = await packagedFixture();
  try {
    const payload = path.join(item.artifact, 'payload');
    if (change === 'worker') fs.appendFileSync(path.join(payload, 'worker/index.js'), 'modified');
    if (change === 'web') fs.appendFileSync(path.join(payload, 'web/index.html'), 'modified');
    if (change === 'configuration') fs.appendFileSync(path.join(payload, 'wrangler.toml'), 'modified');
    if (change === 'missing-migration') fs.unlinkSync(path.join(payload, 'migrations/0001_fixture.sql'));
    if (change === 'extra-file') fs.writeFileSync(path.join(payload, 'worker/extra.js'), 'extra');
    if (change === 'extra-directory') fs.mkdirSync(path.join(payload, 'extra'));
    if (change === 'symlink') fs.symlinkSync(path.join(payload, 'web/index.html'), path.join(payload, 'web/link'));
    if (change === 'manifest') fs.appendFileSync(path.join(item.artifact, 'manifest.json'), ' ');
    let commands = 0;
    await assert.rejects(deployReleaseArtifact(item, { run: async () => { commands++; } }), /altered|missing|unexpected|symlinks|digest/i);
    assert.equal(commands, 0);
  } finally { fs.rmSync(item.root, { recursive: true, force: true }); }
});

test('commit/digest/config contract mismatches fail before deployment', async () => {
  const item = await packagedFixture();
  try {
    assert.throws(() => verifyReleaseArtifact({ ...item, commit: 'b'.repeat(40) }), /commit/);
    assert.throws(() => verifyReleaseArtifact({ ...item, manifestSha256: undefined }), /independently retained/);
    const manifestPath = path.join(item.artifact, 'manifest.json'); const manifest = JSON.parse(fs.readFileSync(manifestPath)); manifest.files[0].path = '../escape'; const bytes = JSON.stringify(manifest); fs.writeFileSync(manifestPath, bytes);
    assert.throws(() => verifyReleaseArtifact({ ...item, manifestSha256: digest(bytes) }), /altered/);
  } finally { fs.rmSync(item.root, { recursive: true, force: true }); }
});

test('unsupported hooks, path references, source maps and altered no-bundle output fail closed', async () => {
  for (const suffix of ['\n[build]\ncommand = "forbidden"\n', '\ntsconfig = "private-reference"\n', '\n[env.production.build]\ncommand = "forbidden"\n']) assert.throws(() => relocatedConfig('main = "src/index.ts"\n[assets]\ndirectory = "web"\n[env.production]\n' + suffix), /unsupported/);
  const item = releaseFixture();
  try {
    await assert.rejects(createReleaseArtifact({ ...item, run: async (args, options) => { await item.run(args, options); if (args.includes('--no-bundle')) fs.appendFileSync(path.join(args[args.indexOf('--outdir')+1], 'index.js'), 'changed'); } }), /changed or omitted/);
    assert.equal(fs.existsSync(item.artifact), false);
    assert.equal(fs.readdirSync(item.root).some((name) => name.includes('.stage-')), false);
  } finally { fs.rmSync(item.root, { recursive: true, force: true }); }
});

test('promotion and explicit migration reuse packaged public config without bundling or secret sync', async () => {
  const item = await packagedFixture();
  try {
    const calls = []; const run = async (args, options) => { calls.push({args, options}); assert.equal(fs.readFileSync(args[args.indexOf('--env-file')+1], 'utf8'), ''); };
    await deployReleaseArtifact(item, { run }); await deployReleaseArtifact(item, { run, migration: true });
    assert.deepEqual(calls[0].args.slice(0,2), ['deploy','--no-bundle']); assert.deepEqual(calls[1].args.slice(0,5), ['d1','migrations','apply','D1_MAIN','--remote']);
    assert.ok(calls.every((call) => call.options.credentials === true && call.args.includes(path.join(call.options.scratch, 'artifact/payload/wrangler.toml'))));
    assert.ok(calls.every((call) => !call.args.includes('secret') && !call.args.includes('--outdir')));
  } finally { fs.rmSync(item.root, { recursive: true, force: true }); }
});

test('offline Wrangler subprocess uses no inherited credential/provider environment', async () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'regovise-wrangler-env-test-'));
  try {
    let captured;
    await runWrangler(['deploy','--dry-run'], { scratch, execute: async (...args) => { captured=args; return {done:Promise.resolve({code:0})}; } });
    assert.deepEqual(Object.keys(captured[3]).sort(), ['CI','CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV','PATH','TMPDIR','WRANGLER_LOG_PATH','WRANGLER_SEND_METRICS','XDG_CACHE_HOME','XDG_CONFIG_HOME'].sort());
    assert.equal(captured[3].CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV, 'false'); assert.equal(captured[5].timeoutMs,120_000);
  } finally { fs.rmSync(scratch,{recursive:true,force:true}); }
});

test('CLI source freeze accepts committed HEAD and rejects changed/untracked canonical source', () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'regovise-commit-test-'));
  try {
    const git=(args)=>execFileSync('git',args,{cwd:temp,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    git(['init','-q']); fs.mkdirSync(path.join(temp,'ops')); fs.writeFileSync(path.join(temp,'ops/synthetic.mjs'),'synthetic'); git(['add','.']); git(['-c','user.name=Synthetic Test','-c','user.email=synthetic@example.invalid','commit','-qm','fixture']); const commit=git(['rev-parse','HEAD']);
    assertCommittedSource(commit,temp); assert.throws(()=>assertCommittedSource('b'.repeat(40),temp),/HEAD/);
    fs.writeFileSync(path.join(temp,'ops/new.mjs'),'untracked'); assert.throws(()=>assertCommittedSource(commit,temp),/Commit the canonical/); fs.unlinkSync(path.join(temp,'ops/new.mjs')); fs.appendFileSync(path.join(temp,'ops/synthetic.mjs'),'changed'); assert.throws(()=>assertCommittedSource(commit,temp),/Commit the canonical/);
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
});

test('successful deploy receipts contain only the authoritative public version ID',()=>{
  const version='12345678-1234-1234-1234-123456789abc';
  const receipt=parseWranglerSuccess(`untrusted binding output: synthetic-secret\nCurrent Version ID: ${version}\nraw provider response: synthetic-secret`);
  assert.deepEqual(receipt,{source:'wrangler-current-version-id',operation:'worker-deploy',exitCode:0,versionId:version});
  assert.ok(!JSON.stringify(receipt).includes('synthetic-secret'));
  assert.throws(()=>parseWranglerSuccess('Uploaded worker, no version confirmation'),/authoritative/);
  assert.throws(()=>parseWranglerSuccess(`Current Version ID: ${version}\nCurrent Version ID: ${version}`),/authoritative/);
  assert.deepEqual(parseWranglerSuccess('raw response omitted',{deployment:false}),{source:'successful-wrangler-exit',operation:'d1-migrations-apply',exitCode:0});
});

test('cached Wrangler authentication requires explicit opt-in, account ID and native user context',()=>{
  const scratch='/synthetic-owned-scratch'; const account='a'.repeat(32); const context={CLOUDFLARE_ACCOUNT_ID:account,HOME:'/synthetic-existing-user',XDG_CONFIG_HOME:'/synthetic-existing-config',UNRELATED_SECRET:'never-forward'};
  assert.throws(()=>releaseEnvironment(scratch,{credentials:true,environment:context}),/explicit/);
  assert.throws(()=>releaseEnvironment(scratch,{credentials:true,existingAuth:true,environment:{HOME:context.HOME}}),/account ID/);
  assert.throws(()=>releaseEnvironment(scratch,{credentials:true,existingAuth:true,environment:{CLOUDFLARE_ACCOUNT_ID:account}}),/home context/);
  assert.throws(()=>releaseEnvironment(scratch,{credentials:true,existingAuth:true,environment:{...context,GITHUB_ACTIONS:'true'}}),/CI release/);
  const existing=releaseEnvironment(scratch,{credentials:true,existingAuth:true,environment:context}); assert.equal(existing.HOME,context.HOME); assert.equal(existing.XDG_CONFIG_HOME,context.XDG_CONFIG_HOME); assert.equal(existing.CLOUDFLARE_ACCOUNT_ID,account); assert.equal(existing.UNRELATED_SECRET,undefined); assert.equal(existing.CLOUDFLARE_API_TOKEN,undefined); assert.equal(existing.CI,'true');
  const explicitEnvironment=releaseEnvironment(scratch,{credentials:true,environment:{...context,REGOVISE_USE_EXISTING_WRANGLER_AUTH:'1'}}); assert.equal(explicitEnvironment.HOME,context.HOME);
  const token=releaseEnvironment(scratch,{credentials:true,environment:{...context,CLOUDFLARE_API_TOKEN:'synthetic-token'}}); assert.equal(token.CLOUDFLARE_API_TOKEN,'synthetic-token'); assert.equal(token.HOME,undefined); assert.notEqual(token.XDG_CONFIG_HOME,context.XDG_CONFIG_HOME);
  const offline=releaseEnvironment(scratch,{existingAuth:true,environment:{...context,REGOVISE_USE_EXISTING_WRANGLER_AUTH:'1',CLOUDFLARE_API_TOKEN:'synthetic-token'}}); assert.equal(offline.HOME,undefined); assert.equal(offline.CLOUDFLARE_API_TOKEN,undefined); assert.equal(offline.CLOUDFLARE_ACCOUNT_ID,undefined);
});
