const baseUrl = process.env.CLOUDFLARE_LOCAL_URL ?? 'http://127.0.0.1:8787';
const headers = {
  'content-type': 'application/json',
  'x-tenant-id': 'tenant-demo',
  'x-user-id': 'user-demo',
};

async function request(pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${pathname} failed (${response.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function ensureScrutinyFeatureEnabled() {
  const snapshot = await request('/_api/setup/modules-features', { headers });
  const enabledModuleIds = (snapshot?.data?.modules ?? [])
    .filter((module) => module.enabled)
    .map((module) => module.id)
    .filter(Boolean);
  const enabledFeatureFlagIds = [
    ...new Set([
      ...(snapshot?.data?.featureFlags ?? [])
        .filter((feature) => feature.enabled)
        .map((feature) => feature.id)
        .filter(Boolean),
      'grc_scrutiny_engine',
    ]),
  ];

  if (snapshot?.data?.featureFlags?.some((feature) => feature.id === 'grc_scrutiny_engine' && feature.enabled)) {
    return snapshot.data;
  }

  return request('/_api/setup/modules-features', {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      enabledModuleIds,
      enabledFeatureFlagIds,
      regmlEnabled: Boolean(snapshot?.data?.readiness?.regmlEnabled),
      regmlTermsAccepted: Boolean(snapshot?.data?.readiness?.regmlTermsAccepted),
      statusNote: 'Enabled by local scrutiny engine smoke test.',
    }),
  }).then((response) => response.data);
}

async function findDomainFolderId() {
  const folders = await request('/_api/iam/folders', { headers });
  const folder =
    folders?.data?.find((item) => item.contentType === 'domain') ??
    folders?.data?.find((item) => item.contentType === 'root') ??
    folders?.data?.[0];
  assert(folder?.id, 'Expected at least one accessible workspace folder.');
  return folder.id;
}

async function listModuleRecords(moduleKey, marker, includeArchived = false) {
  const query = new URLSearchParams({ q: marker });
  if (includeArchived) {
    query.set('includeArchived', 'true');
  }
  const payload = await request(`/_api/core/modules/${moduleKey}/records?${query.toString()}`, { headers });
  return payload?.data?.records ?? [];
}

async function archiveModuleRecord(moduleKey, recordId) {
  await request(`/_api/core/modules/${moduleKey}/records/${encodeURIComponent(recordId)}/archive`, {
    method: 'POST',
    headers,
  });
}

async function main() {
  console.log(`Running scrutiny engine local smoke against ${baseUrl}`);
  const marker = `LOCAL SCRUTINY SMOKE ${Date.now()}`;
  const controlRefs = ['AC-2', 'IA-5'];

  const health = await request('/_api/core/health');
  assert(health?.data?.ok === true, 'Worker health check failed.');
  const bootstrap = await request('/_api/core/bootstrap-demo', { method: 'POST' });
  assert(bootstrap?.data?.tenantId === 'tenant-demo', 'Expected demo tenant bootstrap.');
  await ensureScrutinyFeatureEnabled();

  const folderId = await findDomainFolderId();
  const patterns = await request(`/_api/grc/scrutiny-patterns?controlRefs=${encodeURIComponent(controlRefs.join(','))}`, {
    headers,
  });
  assert(Array.isArray(patterns?.data?.patterns), 'Expected scrutiny pattern list.');
  assert(patterns.data.patterns.length >= controlRefs.length, 'Expected at least one pattern per requested control.');

  const beforeDataCalls = await listModuleRecords('data-calls', marker);
  const beforeEvidence = await listModuleRecords('evidence-locker', marker);
  assert(beforeDataCalls.length === 0, 'Expected no pre-existing smoke Data Calls.');
  assert(beforeEvidence.length === 0, 'Expected no pre-existing smoke Evidence Locker records.');

  const draft = await request('/_api/grc/scrutiny-runs/draft', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: marker,
      folderId,
      scope: {
        type: 'controls',
        controlRefs,
      },
    }),
  });
  const run = draft?.data?.run;
  const draftItems = draft?.data?.items ?? [];
  assert(run?.id, 'Draft scrutiny run did not return an id.');
  assert(run.status === 'draft' && run.mode === 'draft', 'Draft scrutiny run should stay in draft mode.');
  assert(draftItems.length >= controlRefs.length, 'Draft run should create scrutiny items.');
  assert(
    draftItems.every((item) => !item.dataCallRecordId && item.evidenceRecordIds.length === 0),
    'Draft mode must not materialize module records.',
  );

  const draftDataCalls = await listModuleRecords('data-calls', marker);
  const draftEvidence = await listModuleRecords('evidence-locker', marker);
  assert(draftDataCalls.length === 0, 'Draft mode created Data Calls before materialization.');
  assert(draftEvidence.length === 0, 'Draft mode created Evidence Locker records before materialization.');

  const materialized = await request(`/_api/grc/scrutiny-runs/${encodeURIComponent(run.id)}/materialize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      dueOn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      createQuestionnaireTemplate: true,
    }),
  });
  const materializedItems = materialized?.data?.items ?? [];
  assert(materialized?.data?.run?.status === 'materialized', 'Materialized run should report materialized status.');
  assert(
    materializedItems.every((item) => item.dataCallRecordId && item.evidenceRecordIds.length >= 1),
    'Materialization should create Data Calls and Evidence Locker placeholders.',
  );
  assert(
    materialized?.data?.materializedLinks?.some((link) => link.targetModule === 'questionnaires'),
    'Materialization should create a reusable questionnaire template when requested.',
  );

  const dataCalls = await listModuleRecords('data-calls', marker);
  const evidenceRecords = await listModuleRecords('evidence-locker', marker);
  assert(dataCalls.length >= materializedItems.length, 'Expected materialized Data Calls to be discoverable by marker.');
  assert(evidenceRecords.length >= materializedItems.length, 'Expected materialized Evidence Locker records to be discoverable by marker.');
  assert(
    dataCalls.every((record) => record.data?.scrutinyRunId === run.id && record.data?.scrutinyItemId),
    'Data Calls should carry scrutiny run/item backlinks.',
  );
  assert(
    evidenceRecords.every((record) => record.data?.scrutinyRunId === run.id && record.data?.placeholderOnly === true),
    'Evidence Locker records should be marked as scrutiny placeholders.',
  );

  const reconciled = await request(`/_api/grc/scrutiny-runs/${encodeURIComponent(run.id)}/reconcile`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  assert(reconciled?.data?.run?.status === 'reconciled', 'Reconcile should update run status.');
  assert(
    (reconciled?.data?.items ?? []).every((item) => item.coverage?.reconciliation?.authoritativeReviewRequired === true),
    'Reconcile suggestions must remain human-reviewable.',
  );

  const [challengeItem, acceptItem = challengeItem] = reconciled.data.items;
  const challenged = await request(`/_api/grc/scrutiny-items/${encodeURIComponent(challengeItem.id)}/review`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      eventType: 'challenged',
      author: 'Local scrutiny smoke',
      body: 'Evidence response is insufficient; missing implementation screenshots and still needed owner clarification.',
      source: 'local_smoke',
      nextState: 'challenged',
    }),
  });
  assert(
    challenged?.data?.items?.some((item) => item.id === challengeItem.id && item.sufficiencyState === 'challenged'),
    'Challenge review should set authoritative challenged state.',
  );

  const accepted = await request(`/_api/grc/scrutiny-items/${encodeURIComponent(acceptItem.id)}/review`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      eventType: 'accepted',
      author: 'Local scrutiny smoke',
      body: 'Accepted. Evidence is sufficient, verified, and closed for this control request.',
      source: 'local_smoke',
      nextState: 'accepted',
    }),
  });
  const events = accepted?.data?.commentEvents ?? [];
  assert(events.some((event) => event.eventType === 'challenged' && event.nextState === 'challenged'), 'Expected challenged audit event.');
  assert(events.some((event) => event.eventType === 'accepted' && event.nextState === 'accepted'), 'Expected accepted audit event.');

  for (const record of dataCalls) {
    await archiveModuleRecord('data-calls', record.id);
  }
  for (const record of evidenceRecords) {
    await archiveModuleRecord('evidence-locker', record.id);
  }

  console.log(
    JSON.stringify(
      {
        runId: run.id,
        itemCount: materializedItems.length,
        dataCallsArchived: dataCalls.length,
        evidenceRecordsArchived: evidenceRecords.length,
        commentEvents: events.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
