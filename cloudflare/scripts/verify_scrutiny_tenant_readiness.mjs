#!/usr/bin/env node

const BASE_URL = (process.env.REGOVISE_PROD_BASE_URL || process.env.APP_ORIGIN || 'https://regovise.com').replace(/\/$/, '');
const BOOTSTRAP_SECRET = process.env.BOOTSTRAP_SETUP_SECRET || '';
const DEFAULT_TENANT = process.env.REGOVISE_VERIFY_TENANT_SLUG || 'regovise';
const DEFAULT_EMAIL = process.env.REGOVISE_VERIFY_EMAIL || 'admin@regovise.com';
const REQUIRE_ENABLED = process.env.REQUIRE_SCRUTINY_ENABLED === '1';
const PACKAGE_MARKER = process.env.SCRUTINY_READINESS_PACKAGE_MARKER || '';
const CONTROL_REFS = (process.env.SCRUTINY_READINESS_CONTROL_REFS || 'AC-2,IA-2,SI-4')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseTargets() {
  const raw = process.env.SCRUTINY_TENANT_TARGETS || `${DEFAULT_TENANT}:${DEFAULT_EMAIL}`;
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [slug, email] = entry.split(':');
      return {
        tenantSlug: slug?.trim() || DEFAULT_TENANT,
        email: email?.trim() || DEFAULT_EMAIL,
      };
    });
}

function firstCookie(setCookieHeader) {
  if (!setCookieHeader) {
    return '';
  }
  return (
    setCookieHeader
      .split(',')
      .map((part) => part.trim())
      .find((part) => part.startsWith('ca_session=') || part.startsWith('regovise_session='))
      ?.split(';')[0] ?? ''
  );
}

async function request(pathname, init = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${pathname} failed (${response.status}): ${text.slice(0, 500)}`);
  }
  return { response, payload };
}

async function establishSession(target) {
  assert(BOOTSTRAP_SECRET, 'BOOTSTRAP_SETUP_SECRET is required for tenant readiness verification.');
  const { response, payload } = await request('/_api/core/bootstrap/admin-session', {
    method: 'POST',
    body: JSON.stringify({
      secret: BOOTSTRAP_SECRET,
      tenantSlug: target.tenantSlug,
      email: target.email,
    }),
  });
  const cookie = firstCookie(response.headers.get('set-cookie'));
  assert(cookie, `Bootstrap admin-session did not return a session cookie for tenant ${target.tenantSlug}.`);
  assert(payload?.data?.tenantId, `Bootstrap session did not return tenant data for ${target.tenantSlug}.`);
  return {
    cookie,
    tenantId: payload.data.tenantId,
    userId: payload.data.userId,
    tenantSlug: payload.data.tenantSlug,
  };
}

async function verifyTenant(target) {
  const session = await establishSession(target);
  const query = new URLSearchParams({
    controlRefs: CONTROL_REFS.join(','),
  });
  if (PACKAGE_MARKER) {
    query.set('packageMarker', PACKAGE_MARKER);
  }
  const { payload } = await request(`/_api/grc/scrutiny-readiness?${query.toString()}`, {
    headers: {
      cookie: session.cookie,
    },
  });
  const readiness = payload?.data;
  assert(readiness?.feature?.featureFlag === 'grc_scrutiny_engine', `${target.tenantSlug} did not return scrutiny readiness data.`);
  assert(Array.isArray(readiness.checks) && readiness.checks.length >= 5, `${target.tenantSlug} readiness checks were incomplete.`);
  assert(
    readiness.lifecycleApis?.includes('POST /_api/grc/scrutiny-runs/draft'),
    `${target.tenantSlug} readiness did not advertise the draft endpoint.`,
  );
  assert(
    readiness.generatedRecordTags?.includes('scrutinyRunId') && readiness.generatedRecordTags?.includes('scrutinyItemId'),
    `${target.tenantSlug} readiness did not advertise generated record discovery tags.`,
  );

  if (REQUIRE_ENABLED) {
    assert(readiness.feature.enabled === true, `${target.tenantSlug} has grc_scrutiny_engine disabled.`);
    assert(readiness.ready === true, `${target.tenantSlug} is not ready for materialization.`);
  }

  return {
    tenantSlug: session.tenantSlug,
    tenantId: session.tenantId,
    featureEnabled: readiness.feature.enabled,
    ready: readiness.ready,
    probe: readiness.probe,
    counts: readiness.counts,
    patternSources: readiness.patternSources,
    blockers: readiness.checks.filter((check) => check.status === 'blocker').map((check) => check.id),
    warnings: readiness.checks.filter((check) => check.status === 'warn').map((check) => check.id),
  };
}

async function main() {
  const targets = parseTargets();
  console.log(`Running Scrutiny Engine tenant readiness against ${BASE_URL} for ${targets.length} tenant(s).`);
  const results = [];
  for (const target of targets) {
    results.push(await verifyTenant(target));
  }
  const ok = results.every((result) => result.blockers.length === 0 && (!REQUIRE_ENABLED || (result.featureEnabled && result.ready)));
  console.log(
    JSON.stringify(
      {
        ok,
        requireEnabled: REQUIRE_ENABLED,
        controlRefs: CONTROL_REFS,
        packageMarker: PACKAGE_MARKER || null,
        results,
      },
      null,
      2,
    ),
  );
  if (!ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
