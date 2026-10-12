import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import { createReleaseArtifact } from './release_artifact.mjs';
import { probeProduction, productionProbePlan, validateProbeOrigin, productionProbeInputReceipt } from './production_probe.mjs';

async function fixture() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'regovise-probe-test-')); const web=path.join(root,'web'); const worker=path.join(root,'worker'); const migrations=path.join(worker,'migrations'); const config=path.join(worker,'wrangler.toml'); const artifact=path.join(root,'artifact');
  fs.mkdirSync(path.join(web,'assets'),{recursive:true}); fs.mkdirSync(migrations,{recursive:true}); fs.writeFileSync(path.join(web,'index.html'),'<html>Synthetic fixture</html>'); fs.writeFileSync(path.join(web,'assets/app.js'),'synthetic'); fs.writeFileSync(path.join(migrations,'0001.sql'),'SELECT 1;'); fs.writeFileSync(config,'main = "src/index.ts"\n[assets]\ndirectory = "web"\n[env.production]\nname = "synthetic"\n');
  const commit='a'.repeat(40); const result=await createReleaseArtifact({web,migrations,config,artifact,commit,run:async(args)=>{const output=args[args.indexOf('--outdir')+1];fs.mkdirSync(output);fs.writeFileSync(path.join(output,'index.js'),'export default {};');}});
  const calls=[]; const fetchImpl=async(url,init)=>{
    calls.push({url,init}); const route=new URL(url).pathname;
    const json=(data,headers={})=>new Response(JSON.stringify({data}),{headers:{'content-type':'application/json',...headers}});
    if(route==='/_api/core/health') return json({ok:true,appEnv:'production'});
    if(route==='/_api/core/bootstrap/admin-session') return json({sessionId:'not-logged'},{'set-cookie':'ca_session=synthetic-cookie; HttpOnly; Secure; SameSite=Lax'});
    if(route==='/_api/core/session') return init.method==='DELETE'?json({signedOut:true}):json({isAuthenticated:Boolean(init.headers.cookie),authStrategy:init.headers.cookie?'d1-session':'anonymous',appEnv:'production',userId:'never-log-client-identity'});
    return new Response(fs.readFileSync(path.join(web,route==='/'?'index.html':route.slice(1))));
  };
  return {root,web,artifact,commit,manifestSha256:result.manifestSha256,baseUrl:'https://example.invalid',cookie:'ca_session=synthetic-provided-token',fetchImpl,calls};
}

test('production plan is offline and the origin cannot redirect credentials through URL parts',()=>{
  assert.equal(productionProbePlan().cloudRequestsMade,false); assert.equal(productionProbePlan().environmentFilesRead,false);
  for(const value of ['http://example.invalid','https://user:password@example.invalid','https://example.invalid/path','https://example.invalid/?secret=synthetic','https://example.invalid/#fragment']) assert.throws(()=>validateProbeOrigin(value),/HTTPS origin/);
});

test('provided cookie probes only health/session/public exact assets and emits no identity or credential data',async()=>{
  const item=await fixture();
  try{
    const result=await probeProduction(item); assert.equal(result.status,'passed'); assert.equal(result.authentication,'provided-existing-cookie');
    assert.ok(item.calls.every(({init})=>init.method==='GET'&&init.redirect==='manual'&&!Object.keys(init.headers).some(name=>name.startsWith('x-'))));
    assert.equal(item.calls.filter(({init})=>init.headers.cookie).length,1);
    const output=JSON.stringify(result); assert.ok(!output.includes('synthetic-provided-token')); assert.ok(!output.includes('never-log-client-identity'));
    assert.deepEqual(item.calls.map(call=>new URL(call.url).pathname),['/_api/core/health','/_api/core/session','/_api/core/session','/assets/app.js','/']);
  }finally{fs.rmSync(item.root,{recursive:true,force:true});}
});

test('missing genuine credentials fail before any network request even when legacy identity variables exist',async()=>{
  const item=await fixture();
  try{
    for(const cookie of [undefined,'user-demo','ca_session=abc; injected=bad','ca_session=abc\r\nx-user-id: demo']) await assert.rejects(probeProduction({...item,cookie}),/ca_session cookie/);
    await assert.rejects(probeProduction({...item,cookie:undefined,bootstrapSession:true}),/requires its existing admin/);
    assert.equal(item.calls.length,0);
  }finally{fs.rmSync(item.root,{recursive:true,force:true});}
});

test('explicit bootstrap creates only existing-admin auth session and revokes that same owned cookie',async()=>{
  const item=await fixture();
  try{
    const result=await probeProduction({...item,cookie:undefined,bootstrapSession:true,bootstrapSecret:'synthetic-secret-never-log',tenantSlug:'synthetic',email:'synthetic@example.invalid'});
    assert.equal(result.authentication,'existing-admin-session-created-and-revoked'); assert.ok(!JSON.stringify(result).includes('synthetic-secret'));
    const writes=item.calls.filter(({init})=>init.method!=='GET'); assert.equal(writes.length,2);
    assert.equal(new URL(writes[0].url).pathname,'/_api/core/bootstrap/admin-session'); assert.equal(writes[0].init.method,'POST'); assert.equal(writes[1].init.method,'DELETE'); assert.equal(writes[1].init.headers.cookie,'ca_session=synthetic-cookie');
  }finally{fs.rmSync(item.root,{recursive:true,force:true});}
});

for(const failure of ['redirect','wrong-asset','header-auth','wrong-environment','response-too-large','provider-secret-error']) test(`${failure} fails and still revokes a probe-owned session`,async()=>{
  const item=await fixture();
  try{
    const fetchImpl=async(url,init)=>{
      const route=new URL(url).pathname;
      if(route==='/assets/app.js'){
        if(failure==='redirect') return new Response(null,{status:302,headers:{location:'https://elsewhere.invalid'}});
        if(failure==='wrong-asset') return new Response('different');
        if(failure==='response-too-large') return new Response('x'.repeat(100));
        if(failure==='provider-secret-error') return new Response('synthetic-secret-never-log',{status:500});
      }
      if(route==='/_api/core/session'&&init.headers.cookie&&init.method==='GET'&&['header-auth','wrong-environment'].includes(failure))return new Response(JSON.stringify({data:{isAuthenticated:true,authStrategy:failure==='header-auth'?'request-headers':'d1-session',appEnv:failure==='wrong-environment'?'development':'production'}}));
      return item.fetchImpl(url,init);
    };
    await assert.rejects(probeProduction({...item,cookie:undefined,bootstrapSession:true,bootstrapSecret:'synthetic-secret-never-log',tenantSlug:'synthetic',email:'synthetic@example.invalid',fetchImpl}),error=>{assert.ok(!error.message.includes('synthetic-secret'));return true;});
    assert.ok(item.calls.some(({init})=>init.method==='DELETE'&&init.headers.cookie==='ca_session=synthetic-cookie'));
  }finally{fs.rmSync(item.root,{recursive:true,force:true});}
});

test('tampered release files prevent all network access',async()=>{
  const item=await fixture();
  try{
    fs.appendFileSync(path.join(item.artifact,'payload/worker/index.js'),'modified');
    await assert.rejects(probeProduction(item),/altered/); assert.equal(item.calls.length,0);
  }finally{fs.rmSync(item.root,{recursive:true,force:true});}
});

test('a failed owned-session cleanup cannot produce a passing receipt',async()=>{
  const item=await fixture();
  try{
    await assert.rejects(probeProduction({...item,cookie:undefined,bootstrapSession:true,bootstrapSecret:'synthetic-secret',tenantSlug:'synthetic',email:'synthetic@example.invalid',fetchImpl:async(url,init)=>init.method==='DELETE'?new Response('sensitive response never printed',{status:500}):item.fetchImpl(url,init)}),/could not revoke/);
  }finally{fs.rmSync(item.root,{recursive:true,force:true});}
});

test('offline input preflight validates both supported modes without authenticating or exposing configured values',async()=>{
  const item=await fixture();
  try{
    const existing=productionProbeInputReceipt(item); assert.equal(existing.mode,'offline-probe-input-validation'); assert.equal(existing.cloudRequestsMade,false); assert.ok(!JSON.stringify(existing).includes('synthetic-provided-token'));
    const bootstrap=productionProbeInputReceipt({...item,cookie:undefined,bootstrapSession:true,bootstrapSecret:'synthetic-private-secret',tenantSlug:'synthetic-private-tenant',email:'synthetic-private@example.invalid'}); assert.equal(bootstrap.status,'passed'); const receipt=JSON.stringify(bootstrap); for(const value of ['synthetic-private-secret','synthetic-private-tenant','synthetic-private@example.invalid'])assert.ok(!receipt.includes(value)); assert.equal(item.calls.length,0);
    assert.throws(()=>productionProbeInputReceipt({...item,cookie:undefined,bootstrapSession:true,bootstrapSecret:'synthetic-private-secret'}),error=>{assert.deepEqual(error.missingFields,['REGOVISE_VERIFY_TENANT_SLUG','REGOVISE_VERIFY_EMAIL']);assert.ok(!error.publicMessage.includes('synthetic-private-secret'));return true;});
  }finally{fs.rmSync(item.root,{recursive:true,force:true});}
});

test('CLI preflight fails on missing explicit identity before network and reports only missing variable names',async()=>{
  const item=await fixture();
  try{
    const script=fileURLToPath(new URL('./production_probe.mjs',import.meta.url)); const args=[script,'--validate-inputs','--bootstrap-session','--artifact',item.artifact,'--commit',item.commit,'--manifest-sha256',item.manifestSha256]; const env={PATH:process.env.PATH,BOOTSTRAP_SETUP_SECRET:'synthetic-private-secret'};
    const missing=spawnSync(process.execPath,args,{env,encoding:'utf8',timeout:10_000});assert.equal(missing.status,1);const failure=JSON.parse(missing.stdout);assert.deepEqual(failure.missingFields,['REGOVISE_VERIFY_TENANT_SLUG','REGOVISE_VERIFY_EMAIL']);assert.ok(!missing.stdout.includes('synthetic-private-secret'));
    const valid=spawnSync(process.execPath,args,{env:{...env,REGOVISE_VERIFY_TENANT_SLUG:'regovise',REGOVISE_VERIFY_EMAIL:'admin@regovise.com'},encoding:'utf8',timeout:10_000});assert.equal(valid.status,0,valid.stderr);const receipt=JSON.parse(valid.stdout);assert.equal(receipt.mode,'offline-probe-input-validation');assert.equal(receipt.cloudRequestsMade,false);assert.ok(!valid.stdout.includes('admin@regovise.com'));assert.ok(!valid.stdout.includes('synthetic-private-secret'));
    const ambiguous=spawnSync(process.execPath,args,{env:{...env,DRY_RUN:'1'},encoding:'utf8',timeout:10_000});assert.notEqual(ambiguous.status,0);
  }finally{fs.rmSync(item.root,{recursive:true,force:true});}
});
