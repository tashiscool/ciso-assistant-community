#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from './web_artifact.mjs';
import { verifyReleaseArtifact } from './release_artifact.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function validateProbeOrigin(value) {
  let url; try { url = new URL(value); } catch { throw new Error('The production probe requires an explicit HTTPS origin.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('The production probe requires an explicit HTTPS origin without credentials, path or query.');
  return url.origin;
}
function validCookie(cookie) {
  if (!/^ca_session=[A-Za-z0-9._~-]+$/.test(cookie ?? '')) throw Object.assign(new Error('A real ca_session cookie is required; identity headers are never accepted.'), { publicMessage: 'Set REGOVISE_RELEASE_SESSION_COOKIE to an existing ca_session cookie, or explicitly use bootstrap authentication.' });
  return cookie;
}
export function validateProductionProbeInputs({ baseUrl, artifact, commit, manifestSha256, cookie, bootstrapSession = false, bootstrapSecret, tenantSlug, email } = {}) {
  const origin = validateProbeOrigin(baseUrl);
  const manifest = verifyReleaseArtifact({ artifact, commit, manifestSha256 });
  if (bootstrapSession && cookie) throw Object.assign(new Error('Choose an existing cookie or explicit bootstrap authentication, not both.'), { publicMessage: 'Choose one probe authentication mode; unset REGOVISE_RELEASE_SESSION_COOKIE when using --bootstrap-session.' });
  if (bootstrapSession) {
    const fields = [['BOOTSTRAP_SETUP_SECRET', bootstrapSecret], ['REGOVISE_VERIFY_TENANT_SLUG', tenantSlug], ['REGOVISE_VERIFY_EMAIL', email]];
    const missingFields = fields.filter(([, value]) => typeof value !== 'string' || !value.trim()).map(([name]) => name);
    if (missingFields.length) throw Object.assign(new Error('Explicit bootstrap authentication requires its existing admin identity and configured secret.'), { publicMessage: `Missing production probe configuration: ${missingFields.join(', ')}.`, missingFields });
  } else validCookie(cookie);
  return { origin, manifest };
}
export function productionProbeInputReceipt(options) {
  const { origin, manifest } = validateProductionProbeInputs(options);
  return { schemaVersion: 1, status: 'passed', mode: 'offline-probe-input-validation', origin, commit: manifest.commit, manifestSha256: manifest.manifestSha256, authentication: options.bootstrapSession ? 'explicit-existing-admin-bootstrap' : 'provided-existing-cookie', cloudRequestsMade: false, effectsExecuted: false, proofLimit: 'Validates local release inputs and presence/shape of credentials only; it does not authenticate them or confirm provider readiness.' };
}
async function bytesBounded(response, maximum) {
  const reader = response.body?.getReader(); if (!reader) return Buffer.alloc(0);
  const chunks = []; let length = 0;
  try {
    while (true) { const next = await reader.read(); if (next.done) break; length += next.value.length; if (length > maximum) throw new Error('Probe response exceeded its expected size.'); chunks.push(Buffer.from(next.value)); }
    return Buffer.concat(chunks);
  } finally { await reader.cancel().catch(() => {}); }
}
export async function probeProduction({ baseUrl, artifact, commit, manifestSha256, cookie, bootstrapSession = false, bootstrapSecret, tenantSlug, email, fetchImpl = fetch } = {}) {
  const { origin, manifest } = validateProductionProbeInputs({ baseUrl, artifact, commit, manifestSha256, cookie, bootstrapSession, bootstrapSecret, tenantSlug, email });
  const checks = []; let ownedCookie = null; let authError; let failedCheck; let stage = 'production-health';
  const request = async (route, { method = 'GET', headers = {}, body, maximum = 64 * 1024 } = {}) => {
    let response;
    try { response = await fetchImpl(`${origin}${route}`, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(15_000), cache: 'no-store' }); }
    catch { throw new Error(`Production probe transport failed for ${method} ${route}.`); }
    if (response.status >= 300 && response.status < 400) throw new Error(`Production probe refused redirect for ${method} ${route}.`);
    if (!response.ok) throw new Error(`Production probe received HTTP ${response.status} for ${method} ${route}.`);
    const bytes = await bytesBounded(response, maximum);
    return { response, bytes };
  };
  const json = async (route, options) => {
    const result = await request(route, options); let payload;
    try { payload = JSON.parse(result.bytes.toString('utf8')); } catch { throw new Error(`Production probe received invalid JSON for ${route}.`); }
    return { ...result, payload };
  };
  try {
    const health = await json('/_api/core/health');
    if (health.payload?.data?.ok !== true || health.payload?.data?.appEnv !== 'production') throw new Error('Production health did not confirm the expected environment.');
    checks.push({ name: 'production-health', status: 'passed' });
    stage = 'anonymous-session';
    const anonymous = await json('/_api/core/session');
    if (anonymous.payload?.data?.isAuthenticated !== false) throw new Error('Anonymous session unexpectedly authenticated.');
    checks.push({ name: 'anonymous-session', status: 'passed' });
    if (bootstrapSession) {
      stage = 'explicit-existing-admin-authentication';
      const established = await json('/_api/core/bootstrap/admin-session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ secret: bootstrapSecret, tenantSlug, email }) });
      const setCookies = established.response.headers.getSetCookie?.() ?? [established.response.headers.get('set-cookie') ?? ''];
      const session = setCookies.find((value) => value.startsWith('ca_session='));
      ownedCookie = validCookie(session?.split(';')[0]); cookie = ownedCookie;
    }
    stage = 'existing-admin-cookie-session';
    const session = await json('/_api/core/session', { headers: { cookie: validCookie(cookie) } });
    if (session.payload?.data?.isAuthenticated !== true || session.payload?.data?.authStrategy !== 'd1-session' || session.payload?.data?.appEnv !== 'production') throw new Error('The real production cookie did not authenticate through a D1 session.');
    checks.push({ name: 'existing-admin-cookie-session', status: 'passed' });
    stage = 'exact-public-web-assets';
    const webFiles = manifest.files.filter((file) => file.path.startsWith('web/'));
    for (const file of webFiles) {
      const relative = file.path.slice(4);
      const route = relative === 'index.html' ? '/' : `/${relative.split('/').map(encodeURIComponent).join('/')}`;
      const result = await request(route, { maximum: file.size + 1 });
      if (result.bytes.length !== file.size || digest(result.bytes) !== file.sha256) throw new Error(`Deployed public asset differs from the validated artifact: ${route}.`);
    }
    checks.push({ name: 'exact-public-web-assets', status: 'passed', files: webFiles.length });
  } catch (error) { authError = error; failedCheck = stage; }
  finally {
    if (ownedCookie) {
      try {
        const cleared = await json('/_api/core/session', { method: 'DELETE', headers: { cookie: ownedCookie } });
        if (cleared.payload?.data?.signedOut !== true) throw new Error('Probe session cleanup was not confirmed.');
        checks.push({ name: 'owned-auth-session-cleanup', status: 'passed' });
      } catch { checks.push({ name: 'owned-auth-session-cleanup', status: 'failed' }); failedCheck ??= 'owned-auth-session-cleanup'; authError ??= new Error('Production probe could not revoke its own bootstrap auth session.'); }
    }
  }
  if (authError) { authError.probeChecks = checks; authError.failedCheck = failedCheck; throw authError; }
  return { schemaVersion: 1, status: 'passed', mode: 'production-release-probe', origin, commit, manifestSha256, authentication: bootstrapSession ? 'existing-admin-session-created-and-revoked' : 'provided-existing-cookie', checks, proofLimit: 'Public asset bytes, core health and real cookie authentication only; no client domain records, provider transactions, regulatory readiness or full UI journeys are checked.' };
}
export function productionProbePlan(baseUrl = 'https://regovise.com', bootstrapSession = false) {
  return { mode: 'offline-probe-plan', origin: validateProbeOrigin(baseUrl), effectsExecuted: false, environmentFilesRead: false, cloudRequestsMade: false, clientDomainRecordsRead: false, clientDomainRecordsWritten: false, authentication: bootstrapSession ? 'explicit-existing-admin-session-create-and-revoke' : 'existing-ca_session-cookie', routes: ['GET /_api/core/health', 'GET /_api/core/session (anonymous)', ...(bootstrapSession ? ['POST /_api/core/bootstrap/admin-session (existing admin only)'] : []), 'GET /_api/core/session (cookie)', 'GET validated public web assets', ...(bootstrapSession ? ['DELETE /_api/core/session (own probe session)'] : [])] };
}
export async function runProductionProbeCli(args) {
  const options = { artifact: path.join(root, 'target/regovise-release-artifact'), baseUrl: process.env.REGOVISE_PROD_BASE_URL ?? 'https://regovise.com' };
  const keys = { '--artifact': 'artifact', '--commit': 'commit', '--manifest-sha256': 'manifestSha256', '--base-url': 'baseUrl', '--report': 'report' }; let planning = process.env.DRY_RUN === '1'; let validateInputs = false; const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--plan' || arg === '--dry-run') { planning = true; continue; }
    if (arg === '--validate-inputs') { validateInputs = true; continue; }
    if (arg === '--bootstrap-session') { options.bootstrapSession = true; continue; }
    const key = keys[arg]; const value = args[++index];
    if (!key || !value || value.startsWith('--') || seen.has(key)) throw new Error('Invalid production probe argument.');
    seen.add(key); options[key] = ['artifact', 'report'].includes(key) ? path.resolve(value) : value;
  }
  if (planning && validateInputs) throw new Error('Offline planning and credential-input validation must be requested separately.');
  if (!planning) Object.assign(options, { cookie: process.env.REGOVISE_RELEASE_SESSION_COOKIE, bootstrapSecret: process.env.BOOTSTRAP_SETUP_SECRET, tenantSlug: process.env.REGOVISE_VERIFY_TENANT_SLUG, email: process.env.REGOVISE_VERIFY_EMAIL });
  let result;
  try { result = planning ? productionProbePlan(options.baseUrl, options.bootstrapSession) : validateInputs ? productionProbeInputReceipt(options) : await probeProduction(options); }
  catch (error) { result = { schemaVersion: 1, status: 'failed', mode: validateInputs ? 'offline-probe-input-validation' : 'production-release-probe', commit: options.commit, manifestSha256: options.manifestSha256, failedCheck: error.failedCheck ?? 'input-or-artifact-validation', checks: error.probeChecks ?? [], error: error.publicMessage ?? 'Production release check failed; credentials and response bodies are omitted.', ...(error.missingFields ? { missingFields: error.missingFields } : {}) }; process.exitCode = 1; }
  const bytes = `${JSON.stringify(result, null, 2)}\n`;
  if (options.report) { fs.mkdirSync(path.dirname(options.report), { recursive: true }); fs.writeFileSync(options.report, bytes, { mode: 0o600 }); }
  process.stdout.write(bytes);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runProductionProbeCli(process.argv.slice(2)).catch(() => { console.error('Production release probe failed. Check the expected origin, artifact and existing session credentials; no response bodies or credentials are printed.'); process.exitCode = 1; });
