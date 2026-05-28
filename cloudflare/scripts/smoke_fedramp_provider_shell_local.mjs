const baseUrl = process.env.CLOUDFLARE_LOCAL_URL ?? 'http://127.0.0.1:8787';
const headers = {
  'content-type': 'application/json',
  'x-tenant-id': 'tenant-demo',
  'x-user-id': 'user-demo',
};

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} failed (${response.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForStableHealth() {
  let consecutiveHealthyResponses = 0;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const health = await request('/_api/core/health');
      if (health?.data?.ok === true) {
        consecutiveHealthyResponses += 1;
        if (consecutiveHealthyResponses >= 2) {
          return;
        }
      } else {
        consecutiveHealthyResponses = 0;
      }
    } catch {
      consecutiveHealthyResponses = 0;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('Worker did not reach a stable healthy state in time.');
}

async function main() {
  const uniqueSuffix = Date.now();
  console.log(`Running FedRAMP provider shell smoke against ${baseUrl}`);

  await waitForStableHealth();

  const health = await request('/_api/core/health');
  assert(health?.data?.ok === true, 'Health endpoint did not return ok=true.');

  const bootstrap = await request('/_api/core/bootstrap-demo', {
    method: 'POST',
  });
  assert(bootstrap?.data?.tenantId === 'tenant-demo', 'Bootstrap did not return the demo tenant.');

  const overview = await request('/_api/trust-center', { headers });
  const publicManifestRoute = overview?.data?.trustCenter?.publicManifestRoute;
  assert(
    typeof publicManifestRoute === 'string' && publicManifestRoute.includes('tenantSlug=demo'),
    'Expected the public manifest route to include the tenant slug for anonymous access.',
  );

  const publicManifest = await request(publicManifestRoute);
  assert(publicManifest?.data?.audience === 'public', 'Public trust-center manifest did not load.');
  assert(
    Array.isArray(publicManifest?.data?.machineReadable?.services) &&
      publicManifest.data.machineReadable.services.length >= 1,
    'Public trust-center manifest did not include the service catalog.',
  );

  const contact = await request('/_api/fedramp-communications/contacts', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      agencyName: `Agency ${uniqueSuffix}`,
      contactName: 'Security Reviewer',
      contactEmail: `agency.${uniqueSuffix}@example.gov`,
      role: 'security-reviewer',
    }),
  });
  assert(contact?.data?.id, 'Agency contact creation did not return an id.');

  const message = await request('/_api/fedramp-communications/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      subject: `Emergency exercise ${uniqueSuffix}`,
      criticality: 'emergency-test',
      bodyMarkdown: `# Emergency exercise ${uniqueSuffix}\n\nConfirm routing and acknowledgement.`,
      requiredActions: [{ action: 'Acknowledge receipt', dueHours: 4 }],
    }),
  });
  assert(message?.data?.id, 'FedRAMP message creation did not return a message id.');

  const communications = await request('/_api/fedramp-communications/messages', { headers });
  const createdMessage = communications?.data?.messages?.find((item) => item.id === message.data.id);
  assert(createdMessage?.status === 'draft', 'FedRAMP messages should start in a draft state.');
  const deliveryId = communications?.data?.deliveries?.find(
    (item) => item.messageId === message.data.id,
  )?.id;
  assert(deliveryId, 'FedRAMP message creation did not fan out any deliveries.');
  const createdDelivery = communications?.data?.deliveries?.find((item) => item.id === deliveryId);
  assert(createdDelivery?.deliveryStatus === 'queued', 'FedRAMP deliveries should start queued.');

  await request(`/_api/fedramp-communications/messages/${encodeURIComponent(message.data.id)}/queue`, {
    method: 'POST',
    headers,
  });

  const confirmedDelivery = await request(
    `/_api/fedramp-communications/deliveries/${encodeURIComponent(deliveryId)}/confirm`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        confirmedBy: 'local-smoke',
        confirmationMethod: 'manual_confirmation',
      }),
    },
  );
  assert(confirmedDelivery?.data?.confirmed_at, 'Delivery confirmation did not record a confirmation timestamp.');

  const acknowledged = await request(
    `/_api/fedramp-communications/messages/${encodeURIComponent(message.data.id)}/acknowledge`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        deliveryId,
        acknowledgedBy: 'local-smoke',
      }),
    },
  );
  assert(acknowledged?.data?.acknowledged_at, 'Delivery acknowledgement did not record a timestamp.');

  const incident = await request('/_api/fedramp-communications/incidents', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      incidentTitle: `Incident ${uniqueSuffix}`,
      incidentState: 'identified',
    }),
  });
  assert(incident?.data?.id, 'Incident notification creation did not return an id.');
  assert(incident?.data?.reported_to_fedramp_at == null, 'Incident creation should not fake FedRAMP report timestamps.');

  await request(`/_api/fedramp-communications/incidents/${encodeURIComponent(incident.data.id)}/queue`, {
    method: 'POST',
    headers,
  });
  const confirmedIncident = await request(
    `/_api/fedramp-communications/incidents/${encodeURIComponent(incident.data.id)}/confirm-fedramp`,
    {
      method: 'POST',
      headers,
    },
  );
  assert(confirmedIncident?.data?.reported_to_fedramp_at, 'FedRAMP incident confirmation did not set the report timestamp.');

  const syncResult = await request('/_api/vdr/sync', {
    method: 'POST',
    headers,
  });
  assert(syncResult?.data?.syncedCount >= 1, 'Expected at least one synchronized vulnerability evaluation.');

  const vdrReport = await request('/_api/vdr/reports', {
    method: 'POST',
    headers,
  });
  assert(vdrReport?.data?.id, 'VDR report generation did not return a report id.');
  assert(vdrReport?.data?.publication_state === 'working', 'VDR reports generated from the shell should start as working drafts.');
  const publishedVdr = await request(`/_api/vdr/reports/${encodeURIComponent(vdrReport.data.id)}/publish`, {
    method: 'POST',
    headers,
  });
  assert(publishedVdr?.data?.publication_state === 'published', 'VDR publish did not promote the report.');

  const oarCycle = await request('/_api/ccm/oar-cycles', {
    method: 'POST',
    headers,
  });
  assert(oarCycle?.data?.cycle?.id, 'OAR cycle generation did not return a cycle id.');
  assert(oarCycle?.data?.cycle?.publication_state === 'working', 'OAR cycles should start as working snapshots.');
  assert(
    oarCycle?.data?.review?.calendar_ics?.includes('BEGIN:VCALENDAR'),
    'Quarterly review did not include ICS output.',
  );
  await request(`/_api/ccm/oar-cycles/${encodeURIComponent(oarCycle.data.cycle.id)}/publish`, {
    method: 'POST',
    headers,
  });
  await request(`/_api/ccm/quarterly-reviews/${encodeURIComponent(oarCycle.data.review.id)}/publish`, {
    method: 'POST',
    headers,
  });

  const scheduledReview = await request('/_api/ccm/quarterly-reviews', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: `Quarterly review ${uniqueSuffix}`,
      scheduledFor: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      publicationState: 'working',
    }),
  });
  assert(scheduledReview?.data?.id, 'Standalone quarterly review scheduling did not return an id.');

  const feedback = await request('/_api/ccm/feedback', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      oarCycleId: oarCycle.data.cycle.id,
      submittedBy: 'Local smoke',
      submittedEmail: `reviewer.${uniqueSuffix}@example.gov`,
      question: `Question ${uniqueSuffix}`,
      response: `Response ${uniqueSuffix}`,
    }),
  });
  assert(feedback?.data?.id, 'OAR feedback creation did not return an id.');
  const refreshedFeedback = await request(`/_api/ccm/feedback/${encodeURIComponent(feedback.data.id)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      response: `Response refreshed ${uniqueSuffix}`,
      status: 'closed',
    }),
  });
  assert(refreshedFeedback?.data?.status === 'closed', 'Feedback patch did not update the item status.');

  const change = await request('/_api/scn/changes', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: `Transformative change ${uniqueSuffix}`,
      changeType: 'transformative',
      description: 'Exercise the significant change workflow during local smoke.',
      plannedStartOn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  });
  assert(change?.data?.id, 'Significant change creation did not return an id.');
  const scnOverview = await request('/_api/scn', { headers });
  const latestNotice = scnOverview?.data?.notices?.find((item) => item.significantChangeId === change.data.id);
  assert(latestNotice?.id, 'Expected a generated significant-change notice.');
  const publishedNotice = await request(`/_api/scn/notices/${encodeURIComponent(latestNotice.id)}/publish`, {
    method: 'POST',
    headers,
  });
  assert(publishedNotice?.data?.status === 'published', 'SCN notice publish did not promote the notice.');

  const guide = await request('/_api/secure-config/guides', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: `Regovise Secure Configuration Guide ${uniqueSuffix}`,
      summary: 'Secure configuration smoke publication.',
      guideMarkdown: `# Secure Configuration Guide ${uniqueSuffix}\n\n- Require SSO\n- Require MFA`,
    }),
  });
  assert(guide?.data?.id, 'Secure configuration guide publication did not return an id.');

  const release = await request('/_api/secure-config/releases', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      versionLabel: `2026.05.${uniqueSuffix}`,
      releaseNotes: 'Local smoke release.',
      defaultsJson: {
        ssoRequired: true,
        mfaRequired: true,
        ticketingRequired: true,
      },
    }),
  });
  assert(release?.data?.id, 'Secure configuration release creation did not return an id.');

  const scope = await request('/_api/scope/documents', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: `Scope ${uniqueSuffix}`,
      narrativeMarkdown: `# Scope ${uniqueSuffix}\n\nThis is a local smoke scope document.`,
    }),
  });
  assert(scope?.data?.id, 'Scope document creation did not return an id.');

  const crypto = await request('/_api/crypto/inventory', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      serviceName: 'Core Platform',
      moduleName: `TLS Module ${uniqueSuffix}`,
      validationStatus: 'documented',
      cmvpCertificate: `A${uniqueSuffix}`,
    }),
  });
  assert(crypto?.data?.id, 'Crypto inventory creation did not return an id.');

  const packages = await request('/_api/assurance/packages', { headers });
  assert(Array.isArray(packages?.data) && packages.data.length >= 1, 'Expected at least one assurance package.');

  const packagePublication = await request(
    `/_api/trust-center/publish-package/${encodeURIComponent(packages.data[0].id)}`,
    {
      method: 'POST',
      headers,
    },
  );
  assert(
    Array.isArray(packagePublication?.data?.publishedArtifactLinks) &&
      packagePublication.data.publishedArtifactLinks.length >= 3,
    'Package publication did not return provider-process artifact links.',
  );

  const packageArtifactLink = packagePublication.data.publishedArtifactLinks.find(
    (item) => item.artifactKind === 'assurance_package',
  );
  assert(packageArtifactLink?.artifactId, 'Package publication did not include the assurance-package artifact id.');

  const packageArtifact = await request(
    `/_api/trust-center/artifacts/${encodeURIComponent(packageArtifactLink.artifactId)}`,
    { headers },
  );
  assert(
    Array.isArray(
      packageArtifact?.data?.payload?.machineReadable?.packageDocument?.metadata?.provider_process_artifacts,
    ) &&
      packageArtifact.data.payload.machineReadable.packageDocument.metadata.provider_process_artifacts.length >= 3,
    'Published package artifact is missing provider-process artifact references.',
  );
  assert(
    !packageArtifact?.data?.payload?.machineReadable?.packageDocument?.metadata?.provider_process_artifacts?.some(
      (item) => 'route' in item,
    ),
    'Published package metadata should not embed caller-usable non-public artifact routes.',
  );
  assert(
    packageArtifact?.data?.payload?.machineReadable?.packageDocument?.metadata?.trust_center?.public_manifest_route?.includes(
      'tenantSlug=demo',
    ),
    'Published package artifact did not preserve the public manifest route.',
  );

  const standardUserDenied = await fetch(
    `${baseUrl}/_api/trust-center/artifacts/${encodeURIComponent(packageArtifactLink.artifactId)}`,
    {
      headers: {
        'x-tenant-id': 'tenant-demo',
        'x-user-id': 'user-analyst-demo',
      },
    },
  );
  assert(standardUserDenied.status === 403, 'Standard tenant users must not be able to fetch non-public trust-center artifacts.');

  const grant = await request('/_api/trust-center/grants', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      agencyName: `Portal Agency ${uniqueSuffix}`,
      contactEmail: `portal.${uniqueSuffix}@example.gov`,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  });
  assert(grant?.data?.grant?.id, 'Trust-center grant creation did not return a grant id.');
  assert(grant?.data?.portalPath?.includes('token='), 'Trust-center grant response did not include a portal path.');

  const portal = await request(grant.data.portalPath);
  assert(portal?.data?.audience === 'portal', 'Portal trust-center payload did not load.');
  assert(
    Array.isArray(portal?.data?.machineReadable?.artifacts) && portal.data.machineReadable.artifacts.length >= 1,
    'Portal trust-center payload did not include published artifacts.',
  );

  const portalArtifact = portal.data.machineReadable.artifacts[0];
  assert(
    typeof portalArtifact.route === 'string' &&
      portalArtifact.route.includes(`grantId=${encodeURIComponent(grant.data.grant.id)}`) &&
      portalArtifact.route.includes('token='),
    'Portal artifact routes did not preserve the grant context.',
  );

  const portalArtifactPayload = await request(portalArtifact.route);
  assert(portalArtifactPayload?.data?.artifact?.id === portalArtifact.id, 'Portal artifact route did not resolve the selected artifact.');

  const missingPortalToken = await fetch(`${baseUrl}/_api/trust-center/portal/${encodeURIComponent(grant.data.grant.id)}`);
  assert(missingPortalToken.status === 400, 'Portal access without a token should return 400.');

  const invalidPortalToken = await fetch(
    `${baseUrl}/_api/trust-center/portal/${encodeURIComponent(grant.data.grant.id)}?token=invalid`,
  );
  assert(invalidPortalToken.status === 403, 'Portal access with an invalid token should return 403.');

  const unknownArtifact = await fetch(`${baseUrl}/_api/trust-center/artifacts/unknown-artifact-id`, { headers });
  assert(unknownArtifact.status === 404, 'Unknown artifacts should return 404.');

  const postAccessOverview = await request('/_api/trust-center', { headers });
  assert(
    Number(postAccessOverview?.data?.trustCenter?.accessSummary?.eventCount ?? 0) >= 2,
    'Trust-center access logging did not record portal and artifact access events.',
  );

  console.log(
    JSON.stringify(
      {
        publicManifestRoute,
        vdrReportId: vdrReport.data.id,
        oarCycleId: oarCycle.data.cycle.id,
        quarterlyReviewId: scheduledReview.data.id,
        significantChangeId: change.data.id,
        secureGuideId: guide.data.id,
        scopeDocumentId: scope.data.id,
        cryptoInventoryId: crypto.data.id,
        portalGrantId: grant.data.grant.id,
        portalArtifactId: portalArtifact.id,
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
