import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  confirmFedrampDelivery,
  confirmIncidentAgencies,
  confirmIncidentFedramp,
  createAgencyContact,
  createCryptoInventory,
  createFeedbackItem,
  createFedrampMessage,
  createIncidentNotification,
  createScopeDocument,
  createSecureGuide,
  createSecureRelease,
  createSignificantChange,
  createTrustCenterGrant,
  createTrustCenterService,
  generateOarCycle,
  generateVdrReport,
  getFedrampOverview,
  publishOarCycle,
  publishQuarterlyReview,
  publishSignificantChangeNotice,
  publishVdrReport,
  queueIncidentNotification,
  scheduleQuarterlyReview,
  syncVdrEvaluations,
  updateFeedbackItem,
  updateFedrampOffering,
} from './api';
import type { FedrampOverview } from './types';

function csvToList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'Pending';
}

function SectionCard(props: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="eyebrow">{props.eyebrow}</div>
      <h2 className="mt-2 text-2xl font-semibold text-white">{props.title}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{props.description}</p>
      <div className="mt-6">{props.children}</div>
    </section>
  );
}

function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm text-slate-300">
      {props.label}
      <input
        className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        type={props.type ?? 'text'}
        value={props.value}
      />
    </label>
  );
}

function AreaField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm text-slate-300">
      {props.label}
      <textarea
        className="min-h-[120px] rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        rows={props.rows ?? 5}
        value={props.value}
      />
    </label>
  );
}

function SummaryMetric(props: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="panel-subtle">
      <div className="label">{props.label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{props.value}</div>
      {props.detail ? <div className="mt-2 text-xs leading-5 text-slate-400">{props.detail}</div> : null}
    </div>
  );
}

export function FedrampProviderShellPage() {
  const [overview, setOverview] = useState<FedrampOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [grantPreview, setGrantPreview] = useState<string | null>(null);

  const [offeringForm, setOfferingForm] = useState({
    name: '',
    marketplaceUrl: '',
    contactEmail: '',
    availabilityStatus: 'operational',
    accessGuidance: '',
  });
  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    securityObjectives: 'confidentiality, integrity, availability',
    customerResponsibilities: '',
  });
  const [grantForm, setGrantForm] = useState({
    agencyName: '',
    contactEmail: '',
    expiresAt: '',
  });
  const [contactForm, setContactForm] = useState({
    agencyName: '',
    contactName: '',
    contactEmail: '',
    role: 'security-reviewer',
  });
  const [messageForm, setMessageForm] = useState({
    subject: '',
    criticality: 'important',
    bodyMarkdown: '',
  });
  const [incidentForm, setIncidentForm] = useState({
    incidentTitle: '',
    incidentState: 'identified',
  });
  const [feedbackForm, setFeedbackForm] = useState({
    question: '',
    response: '',
  });
  const [changeForm, setChangeForm] = useState({
    title: '',
    changeType: 'adaptive',
    description: '',
    plannedStartOn: '',
  });
  const [guideForm, setGuideForm] = useState({
    title: '',
    summary: '',
    guideMarkdown: '# Secure Configuration Guide\n',
  });
  const [releaseForm, setReleaseForm] = useState({
    versionLabel: '',
    releaseNotes: '',
    defaultsJson: '{\n  "ssoRequired": true,\n  "mfaRequired": true\n}',
  });
  const [scopeForm, setScopeForm] = useState({
    title: '',
    narrativeMarkdown: '# Minimum Assessment Scope\n',
  });
  const [cryptoForm, setCryptoForm] = useState({
    serviceName: '',
    moduleName: '',
    validationStatus: 'documented',
    cmvpCertificate: '',
  });

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await getFedrampOverview();
      setOverview(data);
      setOfferingForm({
        name: data.offering.name ?? '',
        marketplaceUrl: data.offering.marketplaceUrl ?? '',
        contactEmail: data.offering.contactEmail ?? '',
        availabilityStatus: data.offering.availabilityStatus ?? 'operational',
        accessGuidance: data.offering.accessGuidance ?? '',
      });
      setGuideForm((current) => ({
        ...current,
        title: data.secureConfig.guides[0]?.title ?? current.title,
        summary: data.secureConfig.guides[0]?.summary ?? current.summary,
      }));
      setScopeForm((current) => ({
        ...current,
        title: data.scope.documents[0]?.title ?? current.title,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the FedRAMP provider shell.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function runAction(key: string, action: () => Promise<void>) {
    try {
      setBusy(key);
      setError(null);
      setMessage(null);
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The requested FedRAMP action failed.');
    } finally {
      setBusy(null);
    }
  }

  const publicManifestUrl = useMemo(() => {
    if (!overview) {
      return null;
    }
    return `${window.location.origin}${overview.trustCenter.publicManifestRoute}`;
  }, [overview]);

  const latestGuide = overview?.secureConfig.guides[0] ?? null;
  const latestFeedbackItem = overview?.ccm.feedbackItems[0] ?? null;
  const latestUnpublishedNotice = overview?.scn.notices.find((notice) => notice.status !== 'published') ?? null;
  const scopeMetadata = asRecord(overview?.scope.documents[0]?.metadata);
  const scopeDerived = asRecord(scopeMetadata.derived);
  const cryptoCoverageByService = new Map<string, number>();
  for (const item of overview?.crypto.inventory ?? []) {
    const key = (item.serviceName || '').trim().toLowerCase();
    if (!key) {
      continue;
    }
    cryptoCoverageByService.set(key, (cryptoCoverageByService.get(key) ?? 0) + 1);
  }
  const servicesCoveredByCrypto = overview?.trustCenter.services.filter((service) =>
    cryptoCoverageByService.has(service.name.trim().toLowerCase()),
  ).length ?? 0;

  if (loading) {
    return <section className="panel p-6 text-sm text-slate-300">Loading the FedRAMP provider workspace...</section>;
  }

  if (!overview) {
    return <section className="panel p-6 text-sm text-slate-300">FedRAMP provider data is not available.</section>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">FedRAMP 20x</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Provider Process Shell</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
          This workspace wraps the existing assurance engine in the outward-facing provider operations FedRAMP expects:
          trust-center publication, communications, vulnerability reporting, OAR cycles, significant-change notices,
          secure configuration guidance, scope formalization, and cryptographic module inventory.
        </p>
      </section>

      {error ? <div className="notice-error">{error}</div> : null}
      {message ? <div className="notice-success">{message}</div> : null}
      {grantPreview ? <div className="notice-warning break-all">{grantPreview}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric label="Published Artifacts" value={overview.trustCenter.artifacts.length} detail="Machine-readable trust-center outputs now share one registry." />
        <SummaryMetric label="Agency Grants" value={overview.trustCenter.grants.length} detail={`Access events logged: ${overview.trustCenter.accessSummary.eventCount}`} />
        <SummaryMetric label="VDR Evaluations" value={overview.vdr.evaluations.length} detail={`Reports: ${overview.vdr.reports.length}`} />
        <SummaryMetric label="OAR Cycles" value={overview.ccm.cycles.length} detail={`Next due: ${formatDate(overview.offering.nextOarDueOn)}`} />
      </section>

      <SectionCard
        eyebrow="Trust Center Core"
        title="Offering, catalog, and publication"
        description="Define the FedRAMP offering once, keep the service list current, and expose a stable public manifest plus necessary-party artifact portal."
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <form
            className="space-y-4"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void runAction('offering', async () => {
                await updateFedrampOffering({
                  name: offeringForm.name,
                  marketplaceUrl: offeringForm.marketplaceUrl || null,
                  contactEmail: offeringForm.contactEmail || null,
                  availabilityStatus: offeringForm.availabilityStatus,
                  accessGuidance: offeringForm.accessGuidance || null,
                });
                await load();
                setMessage('Trust-center offering updated.');
              });
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Offering name" value={offeringForm.name} onChange={(value) => setOfferingForm((current) => ({ ...current, name: value }))} />
              <TextField
                label="Marketplace URL"
                value={offeringForm.marketplaceUrl}
                onChange={(value) => setOfferingForm((current) => ({ ...current, marketplaceUrl: value }))}
                placeholder="https://marketplace.fedramp.gov/..."
              />
              <TextField
                label="Primary contact email"
                value={offeringForm.contactEmail}
                onChange={(value) => setOfferingForm((current) => ({ ...current, contactEmail: value }))}
                placeholder="security@provider.com"
              />
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Availability status
                <select
                  className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                  onChange={(event) => setOfferingForm((current) => ({ ...current, availabilityStatus: event.target.value }))}
                  value={offeringForm.availabilityStatus}
                >
                  <option value="operational">Operational</option>
                  <option value="degraded">Degraded</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </label>
            </div>
            <AreaField
              label="Public access guidance"
              value={offeringForm.accessGuidance}
              onChange={(value) => setOfferingForm((current) => ({ ...current, accessGuidance: value }))}
              placeholder="Explain how agencies and other necessary parties obtain access."
              rows={4}
            />
            <button className="button-primary" disabled={busy === 'offering'} type="submit">
              {busy === 'offering' ? 'Saving…' : 'Save offering'}
            </button>
          </form>

          <div className="space-y-4">
            <div className="panel-subtle">
              <div className="label">Public manifest</div>
              <div className="mt-2 text-sm text-slate-300">
                <a className="text-cyan-300 underline-offset-4 hover:underline" href={publicManifestUrl ?? '#'} rel="noreferrer" target="_blank">
                  {publicManifestUrl}
                </a>
              </div>
              <div className="mt-3 text-xs leading-5 text-slate-400">
                This is the stable machine-readable trust-center endpoint backed by the artifact registry.
              </div>
            </div>
            <div className="panel-subtle">
              <div className="label">Recent artifacts</div>
              <div className="mt-3 space-y-3 text-sm text-slate-300">
                {overview.trustCenter.artifacts.slice(0, 6).map((artifact) => (
                  <div key={artifact.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                    <div className="font-medium text-white">{artifact.title}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {artifact.artifactKind} · {artifact.versionLabel} · {artifact.publicationState} ·{' '}
                      {artifact.isPublic ? 'public' : artifact.audience}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <form
            className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/25 p-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void runAction('service', async () => {
                await createTrustCenterService({
                  name: serviceForm.name,
                  description: serviceForm.description,
                  securityObjectives: csvToList(serviceForm.securityObjectives),
                  customerResponsibilities: csvToList(serviceForm.customerResponsibilities),
                });
                setServiceForm({
                  name: '',
                  description: '',
                  securityObjectives: 'confidentiality, integrity, availability',
                  customerResponsibilities: '',
                });
                await load();
                setMessage('Service catalog entry added.');
              });
            }}
          >
            <div className="text-sm font-semibold text-white">Add service catalog entry</div>
            <TextField label="Service name" value={serviceForm.name} onChange={(value) => setServiceForm((current) => ({ ...current, name: value }))} />
            <AreaField label="Service summary" value={serviceForm.description} onChange={(value) => setServiceForm((current) => ({ ...current, description: value }))} rows={3} />
            <TextField
              label="Security objectives (CSV)"
              value={serviceForm.securityObjectives}
              onChange={(value) => setServiceForm((current) => ({ ...current, securityObjectives: value }))}
            />
            <TextField
              label="Customer responsibilities (CSV)"
              value={serviceForm.customerResponsibilities}
              onChange={(value) => setServiceForm((current) => ({ ...current, customerResponsibilities: value }))}
            />
            <button className="button-secondary" disabled={busy === 'service'} type="submit">
              {busy === 'service' ? 'Saving…' : 'Add service'}
            </button>
          </form>

          <form
            className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/25 p-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void runAction('grant', async () => {
                const response = await createTrustCenterGrant({
                  agencyName: grantForm.agencyName,
                  contactEmail: grantForm.contactEmail,
                  expiresAt: grantForm.expiresAt || null,
                });
                setGrantForm({ agencyName: '', contactEmail: '', expiresAt: '' });
                setGrantPreview(`${window.location.origin}${response.portalPath}`);
                await load();
                setMessage('Trust-center portal grant created. Copy the portal URL from the banner above.');
              });
            }}
          >
            <div className="text-sm font-semibold text-white">Issue agency portal grant</div>
            <TextField label="Agency name" value={grantForm.agencyName} onChange={(value) => setGrantForm((current) => ({ ...current, agencyName: value }))} />
            <TextField
              label="Agency contact email"
              value={grantForm.contactEmail}
              onChange={(value) => setGrantForm((current) => ({ ...current, contactEmail: value }))}
              placeholder="agency.security@agency.gov"
              type="email"
            />
            <TextField label="Expires on (ISO)" value={grantForm.expiresAt} onChange={(value) => setGrantForm((current) => ({ ...current, expiresAt: value }))} placeholder="2026-12-31T00:00:00.000Z" />
            <button className="button-secondary" disabled={busy === 'grant'} type="submit">
              {busy === 'grant' ? 'Issuing…' : 'Create grant'}
            </button>
          </form>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Communications Hub"
        title="Security inbox, routing, and audit trail"
        description="Manage agency contacts, prepare elevated messages, and track who received and acknowledged high-priority communications."
      >
        <div className="grid gap-4 md:grid-cols-4">
          <SummaryMetric label="Agency contacts" value={overview.communications.summary.contactCount} />
          <SummaryMetric label="Messages" value={overview.communications.summary.messageCount} />
          <SummaryMetric label="Incidents" value={overview.communications.summary.incidentCount} />
          <SummaryMetric label="Overdue acknowledgements" value={overview.communications.summary.overdueDeliveryCount} />
        </div>
        <div className="mt-8 grid gap-6 xl:grid-cols-3">
          <form
            className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/25 p-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void runAction('contact', async () => {
                await createAgencyContact(contactForm);
                setContactForm({ agencyName: '', contactName: '', contactEmail: '', role: 'security-reviewer' });
                await load();
                setMessage('Agency contact added.');
              });
            }}
          >
            <div className="text-sm font-semibold text-white">Add agency contact</div>
            <TextField label="Agency name" value={contactForm.agencyName} onChange={(value) => setContactForm((current) => ({ ...current, agencyName: value }))} />
            <TextField label="Contact name" value={contactForm.contactName} onChange={(value) => setContactForm((current) => ({ ...current, contactName: value }))} />
            <TextField label="Contact email" value={contactForm.contactEmail} onChange={(value) => setContactForm((current) => ({ ...current, contactEmail: value }))} type="email" />
            <TextField label="Role" value={contactForm.role} onChange={(value) => setContactForm((current) => ({ ...current, role: value }))} />
            <button className="button-secondary" disabled={busy === 'contact'} type="submit">
              {busy === 'contact' ? 'Saving…' : 'Add contact'}
            </button>
          </form>

          <form
            className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/25 p-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void runAction('message', async () => {
                await createFedrampMessage(messageForm);
                setMessageForm({ subject: '', criticality: 'important', bodyMarkdown: '' });
                await load();
                setMessage('FedRAMP communication created in a truthful queued state for current agency contacts.');
              });
            }}
          >
            <div className="text-sm font-semibold text-white">Create communication</div>
            <TextField label="Subject" value={messageForm.subject} onChange={(value) => setMessageForm((current) => ({ ...current, subject: value }))} />
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Criticality
              <select
                className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                onChange={(event) => setMessageForm((current) => ({ ...current, criticality: event.target.value }))}
                value={messageForm.criticality}
              >
                <option value="general">General</option>
                <option value="important">Important</option>
                <option value="emergency">Emergency</option>
                <option value="emergency-test">Emergency Test</option>
              </select>
            </label>
            <AreaField label="Body (Markdown)" value={messageForm.bodyMarkdown} onChange={(value) => setMessageForm((current) => ({ ...current, bodyMarkdown: value }))} rows={4} />
            <button className="button-secondary" disabled={busy === 'message'} type="submit">
              {busy === 'message' ? 'Sending…' : 'Create message'}
            </button>
          </form>

          <form
            className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/25 p-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void runAction('incident', async () => {
                await createIncidentNotification(incidentForm);
                setIncidentForm({ incidentTitle: '', incidentState: 'identified' });
                await load();
                setMessage('Incident-notification record created in a queued confirmation state.');
              });
            }}
          >
            <div className="text-sm font-semibold text-white">Log incident notification</div>
            <TextField label="Incident title" value={incidentForm.incidentTitle} onChange={(value) => setIncidentForm((current) => ({ ...current, incidentTitle: value }))} />
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Incident state
              <select
                className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                onChange={(event) => setIncidentForm((current) => ({ ...current, incidentState: event.target.value }))}
                value={incidentForm.incidentState}
              >
                <option value="identified">Identified</option>
                <option value="investigating">Investigating</option>
                <option value="recovering">Recovering</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
            <button className="button-secondary" disabled={busy === 'incident'} type="submit">
              {busy === 'incident' ? 'Logging…' : 'Create incident'}
            </button>
          </form>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/25 p-5">
            <div className="text-sm font-semibold text-white">Recent deliveries</div>
            {overview.communications.deliveries.slice(0, 4).map((delivery) => (
              <div key={delivery.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                <div className="font-medium text-white">{delivery.recipientEmail}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {delivery.deliveryStatus} · queued due {formatDate(delivery.escalationDueAt)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="button-secondary"
                    disabled={busy === `delivery-confirm-${delivery.id}` || ['delivered', 'acknowledged'].includes(delivery.deliveryStatus)}
                    onClick={() =>
                      void runAction(`delivery-confirm-${delivery.id}`, async () => {
                        await confirmFedrampDelivery(delivery.id);
                        await load();
                        setMessage('Delivery confirmation recorded.');
                      })
                    }
                    type="button"
                  >
                    Confirm delivery
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/25 p-5">
            <div className="text-sm font-semibold text-white">Recent incidents</div>
            {overview.communications.incidents.slice(0, 4).map((incident) => (
              <div key={incident.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                <div className="font-medium text-white">{incident.incidentTitle}</div>
                <div className="mt-1 text-xs text-slate-400">
                  FedRAMP {incident.fedrampReportStatus} · Agencies {incident.agencyReportStatus}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="button-secondary"
                    disabled={busy === `incident-queue-${incident.id}`}
                    onClick={() =>
                      void runAction(`incident-queue-${incident.id}`, async () => {
                        await queueIncidentNotification(incident.id);
                        await load();
                        setMessage('Incident notification queue refreshed.');
                      })
                    }
                    type="button"
                  >
                    Queue notices
                  </button>
                  <button
                    className="button-secondary"
                    disabled={busy === `incident-fedramp-${incident.id}` || incident.fedrampReportStatus === 'confirmed'}
                    onClick={() =>
                      void runAction(`incident-fedramp-${incident.id}`, async () => {
                        await confirmIncidentFedramp(incident.id);
                        await load();
                        setMessage('FedRAMP incident confirmation recorded.');
                      })
                    }
                    type="button"
                  >
                    Confirm FedRAMP
                  </button>
                  <button
                    className="button-secondary"
                    disabled={busy === `incident-agencies-${incident.id}` || incident.agencyReportStatus === 'confirmed'}
                    onClick={() =>
                      void runAction(`incident-agencies-${incident.id}`, async () => {
                        await confirmIncidentAgencies(incident.id);
                        await load();
                        setMessage('Agency incident confirmations recorded.');
                      })
                    }
                    type="button"
                  >
                    Confirm agencies
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="VDR + CCM"
        title="Persistent reporting cadence"
        description="Turn the assurance and GRC finding pipeline into recurring vulnerability reporting and ongoing authorization publication, with quarterly review logistics attached."
      >
        <div className="flex flex-wrap gap-3">
          <button
            className="button-primary"
            disabled={busy === 'vdr-sync'}
            onClick={() =>
              void runAction('vdr-sync', async () => {
                const result = await syncVdrEvaluations();
                await load();
                setMessage(`Synced ${result.syncedCount} vulnerability evaluations into the FedRAMP VDR layer.`);
              })
            }
            type="button"
          >
            {busy === 'vdr-sync' ? 'Syncing…' : 'Sync evaluations'}
          </button>
          <button
            className="button-secondary"
            disabled={busy === 'vdr-report'}
            onClick={() =>
              void runAction('vdr-report', async () => {
                await generateVdrReport({ publicationState: 'working', generationSource: 'manual' });
                await load();
                setMessage('Generated the current monthly VDR working report.');
              })
            }
            type="button"
          >
            {busy === 'vdr-report' ? 'Generating…' : 'Generate VDR report'}
          </button>
          <button
            className="button-secondary"
            disabled={busy === 'oar'}
            onClick={() =>
              void runAction('oar', async () => {
                await generateOarCycle({ publicationState: 'working', generationSource: 'manual' });
                await load();
                setMessage('Generated a working OAR cycle and linked quarterly review draft.');
              })
            }
            type="button"
          >
            {busy === 'oar' ? 'Generating…' : 'Generate OAR cycle'}
          </button>
          <button
            className="button-secondary"
            disabled={busy === 'review'}
            onClick={() =>
              void runAction('review', async () => {
                await scheduleQuarterlyReview({ publicationState: 'working', generationSource: 'manual' });
                await load();
                setMessage('Scheduled a working quarterly review draft.');
              })
            }
            type="button"
          >
            {busy === 'review' ? 'Scheduling…' : 'Schedule quarterly review'}
          </button>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/25 p-5">
            <div className="text-sm font-semibold text-white">Latest VDR reports</div>
            {overview.vdr.reports.slice(0, 5).map((report) => (
              <div key={report.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                <div className="font-medium text-white">{report.title}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {report.reportMonth} · {report.publicationState} · {report.generationSource}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="button-secondary"
                    disabled={busy === `publish-vdr-${report.id}` || report.publicationState === 'published'}
                    onClick={() =>
                      void runAction(`publish-vdr-${report.id}`, async () => {
                        await publishVdrReport(report.id);
                        await load();
                        setMessage('VDR report promoted to published state.');
                      })
                    }
                    type="button"
                  >
                    Publish
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/25 p-5">
            <div className="text-sm font-semibold text-white">Current OAR cycles</div>
            {overview.ccm.cycles.slice(0, 5).map((cycle) => (
              <div key={cycle.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                <div className="font-medium text-white">{cycle.cycleLabel}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {cycle.periodStart.slice(0, 10)} to {cycle.periodEnd.slice(0, 10)} · {cycle.publicationState} · next report{' '}
                  {cycle.nextReportDueOn.slice(0, 10)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="button-secondary"
                    disabled={busy === `publish-oar-${cycle.id}` || cycle.publicationState === 'published'}
                    onClick={() =>
                      void runAction(`publish-oar-${cycle.id}`, async () => {
                        await publishOarCycle(cycle.id);
                        await load();
                        setMessage('OAR cycle promoted to published state.');
                      })
                    }
                    type="button"
                  >
                    Publish cycle
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/25 p-5">
          <div className="text-sm font-semibold text-white">Quarterly review drafts</div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {overview.ccm.quarterlyReviews.slice(0, 4).map((review) => (
              <div key={review.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                <div className="font-medium text-white">{review.title}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {review.publicationState} · {formatDate(review.scheduledFor)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="button-secondary"
                    disabled={busy === `publish-review-${review.id}` || review.publicationState === 'published'}
                    onClick={() =>
                      void runAction(`publish-review-${review.id}`, async () => {
                        await publishQuarterlyReview(review.id);
                        await load();
                        setMessage('Quarterly review promoted to published state.');
                      })
                    }
                    type="button"
                  >
                    Publish review
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <form
          className="mt-8 space-y-4 rounded-3xl border border-white/10 bg-slate-950/25 p-5"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void runAction('feedback', async () => {
              await createFeedbackItem(feedbackForm);
              setFeedbackForm({ question: '', response: '' });
              await load();
              setMessage('OAR feedback item recorded.');
            });
          }}
        >
          <div className="text-sm font-semibold text-white">Capture OAR feedback</div>
          <AreaField label="Question" value={feedbackForm.question} onChange={(value) => setFeedbackForm((current) => ({ ...current, question: value }))} rows={3} />
          <AreaField label="Response / addendum" value={feedbackForm.response} onChange={(value) => setFeedbackForm((current) => ({ ...current, response: value }))} rows={3} />
          <button className="button-secondary" disabled={busy === 'feedback'} type="submit">
            {busy === 'feedback' ? 'Saving…' : 'Add feedback item'}
          </button>
          {latestFeedbackItem ? (
            <button
              className="button-secondary"
              disabled={busy === 'feedback-close'}
              onClick={() =>
                void runAction('feedback-close', async () => {
                  await updateFeedbackItem(latestFeedbackItem.id, {
                    response: latestFeedbackItem.response ?? feedbackForm.response,
                    status: 'closed',
                  });
                  await load();
                  setMessage('Latest feedback item refreshed and addendum regenerated.');
                })
              }
              type="button"
            >
              {busy === 'feedback-close' ? 'Refreshing…' : 'Close latest feedback item'}
            </button>
          ) : null}
        </form>
      </SectionCard>

      <SectionCard
        eyebrow="SCN Workflow"
        title="Significant change records and notices"
        description="Classify changes as routine, adaptive, or transformative, then let the provider shell generate the notice schedule and publish change history back into the trust center."
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <form
            className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/25 p-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void runAction('scn', async () => {
                await createSignificantChange({
                  title: changeForm.title,
                  changeType: changeForm.changeType,
                  description: changeForm.description,
                  plannedStartOn: changeForm.plannedStartOn || null,
                });
                setChangeForm({ title: '', changeType: 'adaptive', description: '', plannedStartOn: '' });
                await load();
                setMessage('Significant change recorded and notice plan generated.');
              });
            }}
          >
            <div className="text-sm font-semibold text-white">Create significant change</div>
            <TextField label="Change title" value={changeForm.title} onChange={(value) => setChangeForm((current) => ({ ...current, title: value }))} />
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Change type
              <select
                className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                onChange={(event) => setChangeForm((current) => ({ ...current, changeType: event.target.value }))}
                value={changeForm.changeType}
              >
                <option value="routine-recurring">Routine recurring</option>
                <option value="adaptive">Adaptive</option>
                <option value="transformative">Transformative</option>
              </select>
            </label>
            <AreaField label="Description" value={changeForm.description} onChange={(value) => setChangeForm((current) => ({ ...current, description: value }))} rows={4} />
            <TextField
              label="Planned start (ISO)"
              value={changeForm.plannedStartOn}
              onChange={(value) => setChangeForm((current) => ({ ...current, plannedStartOn: value }))}
              placeholder="2026-07-01T00:00:00.000Z"
            />
            <button className="button-secondary" disabled={busy === 'scn'} type="submit">
              {busy === 'scn' ? 'Saving…' : 'Create change'}
            </button>
          </form>

          <div className="space-y-4">
            {overview.scn.changes.slice(0, 6).map((change) => (
              <div key={change.id} className="rounded-3xl border border-white/10 bg-slate-950/25 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-sm font-semibold text-white">{change.title}</div>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">
                    {change.changeType}
                  </span>
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-300">{change.description}</div>
                <div className="mt-3 text-xs text-slate-400">Planned start: {formatDate(change.plannedStartOn)}</div>
              </div>
            ))}
            {latestUnpublishedNotice ? (
              <button
                className="button-secondary"
                disabled={busy === 'publish-scn-notice'}
                onClick={() =>
                  void runAction('publish-scn-notice', async () => {
                    await publishSignificantChangeNotice(latestUnpublishedNotice.id);
                    await load();
                    setMessage('Latest significant-change notice promoted to published history.');
                  })
                }
                type="button"
              >
                {busy === 'publish-scn-notice' ? 'Publishing…' : 'Publish latest notice'}
              </button>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Secure Config"
        title="Guide, defaults, and release history"
        description="Publish a secure configuration guide that combines current tenant posture with recommended defaults and a machine-readable release history."
      >
        <div className="grid gap-6 xl:grid-cols-2">
          <form
            className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/25 p-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void runAction('guide', async () => {
                await createSecureGuide({
                  title: guideForm.title,
                  summary: guideForm.summary,
                  guideMarkdown: guideForm.guideMarkdown,
                });
                await load();
                setMessage('Secure configuration guide published.');
              });
            }}
          >
            <div className="text-sm font-semibold text-white">Publish guide</div>
            <TextField label="Guide title" value={guideForm.title} onChange={(value) => setGuideForm((current) => ({ ...current, title: value }))} />
            <TextField label="Summary" value={guideForm.summary} onChange={(value) => setGuideForm((current) => ({ ...current, summary: value }))} />
            <AreaField label="Guide markdown" value={guideForm.guideMarkdown} onChange={(value) => setGuideForm((current) => ({ ...current, guideMarkdown: value }))} rows={8} />
            <button className="button-secondary" disabled={busy === 'guide'} type="submit">
              {busy === 'guide' ? 'Publishing…' : 'Publish guide'}
            </button>
          </form>

          <form
            className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/25 p-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void runAction('release', async () => {
                await createSecureRelease({
                  guideId: latestGuide?.id,
                  versionLabel: releaseForm.versionLabel || undefined,
                  releaseNotes: releaseForm.releaseNotes || null,
                  defaults: JSON.parse(releaseForm.defaultsJson),
                });
                setReleaseForm({
                  versionLabel: '',
                  releaseNotes: '',
                  defaultsJson: '{\n  "ssoRequired": true,\n  "mfaRequired": true\n}',
                });
                await load();
                setMessage('Secure default release added.');
              });
            }}
          >
            <div className="text-sm font-semibold text-white">Add default release</div>
            <TextField label="Version label" value={releaseForm.versionLabel} onChange={(value) => setReleaseForm((current) => ({ ...current, versionLabel: value }))} placeholder="2026.05" />
            <AreaField label="Release notes" value={releaseForm.releaseNotes} onChange={(value) => setReleaseForm((current) => ({ ...current, releaseNotes: value }))} rows={3} />
            <AreaField label="Defaults JSON" value={releaseForm.defaultsJson} onChange={(value) => setReleaseForm((current) => ({ ...current, defaultsJson: value }))} rows={8} />
            <button className="button-secondary" disabled={busy === 'release'} type="submit">
              {busy === 'release' ? 'Publishing…' : 'Add release'}
            </button>
          </form>
        </div>
        {latestGuide ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/25 p-5">
            <div className="text-sm font-semibold text-white">Current vs default diff</div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {latestGuide.currentVsDefaultDiff.length > 0 ? (
                latestGuide.currentVsDefaultDiff.slice(0, 8).map((entry) => (
                  <div key={entry.path} className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                    <div className="font-medium text-white">{entry.path}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      current: {JSON.stringify(entry.current)} · recommended: {JSON.stringify(entry.recommended)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400">Current tenant settings match the latest recommended defaults.</div>
              )}
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        eyebrow="Scope + Crypto"
        title="Boundary formalization and crypto inventory"
        description="Track scope narratives, information-resource flows, third-party justifications, and the cryptographic posture tied to the offering boundary."
      >
        <div className="grid gap-6 xl:grid-cols-2">
          <form
            className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/25 p-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void runAction('scope', async () => {
                await createScopeDocument({
                  title: scopeForm.title,
                  narrativeMarkdown: scopeForm.narrativeMarkdown,
                });
                await load();
                setMessage('Scope document created and published into the trust-center artifact registry.');
              });
            }}
          >
            <div className="text-sm font-semibold text-white">Create scope document</div>
            <TextField label="Scope title" value={scopeForm.title} onChange={(value) => setScopeForm((current) => ({ ...current, title: value }))} />
            <AreaField label="Narrative markdown" value={scopeForm.narrativeMarkdown} onChange={(value) => setScopeForm((current) => ({ ...current, narrativeMarkdown: value }))} rows={8} />
            <button className="button-secondary" disabled={busy === 'scope'} type="submit">
              {busy === 'scope' ? 'Saving…' : 'Create scope document'}
            </button>
          </form>

          <form
            className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/25 p-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void runAction('crypto', async () => {
                await createCryptoInventory({
                  serviceName: cryptoForm.serviceName,
                  moduleName: cryptoForm.moduleName,
                  validationStatus: cryptoForm.validationStatus,
                  cmvpCertificate: cryptoForm.cmvpCertificate || null,
                  validationProvenance: cryptoForm.cmvpCertificate ? 'cmvp-certificate' : 'provider-attestation',
                });
                setCryptoForm({
                  serviceName: '',
                  moduleName: '',
                  validationStatus: 'documented',
                  cmvpCertificate: '',
                });
                await load();
                setMessage('Crypto inventory record added.');
              });
            }}
          >
            <div className="text-sm font-semibold text-white">Add cryptographic module</div>
            <TextField label="Service name" value={cryptoForm.serviceName} onChange={(value) => setCryptoForm((current) => ({ ...current, serviceName: value }))} />
            <TextField label="Module name" value={cryptoForm.moduleName} onChange={(value) => setCryptoForm((current) => ({ ...current, moduleName: value }))} />
            <TextField
              label="Validation status"
              value={cryptoForm.validationStatus}
              onChange={(value) => setCryptoForm((current) => ({ ...current, validationStatus: value }))}
            />
            <TextField
              label="CMVP certificate"
              value={cryptoForm.cmvpCertificate}
              onChange={(value) => setCryptoForm((current) => ({ ...current, cmvpCertificate: value }))}
              placeholder="A1234"
            />
            <button className="button-secondary" disabled={busy === 'crypto'} type="submit">
              {busy === 'crypto' ? 'Saving…' : 'Add crypto record'}
            </button>
          </form>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/25 p-5">
            <div className="text-sm font-semibold text-white">Latest scope documents</div>
            {overview.scope.documents.slice(0, 5).map((document) => (
              <div key={document.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                <div className="font-medium text-white">{document.title}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {document.status} · perimeters {String(scopeDerived.perimeterCount ?? 0)} · BIAs {String(scopeDerived.businessImpactAnalysisCount ?? 0)}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/25 p-5">
            <div className="text-sm font-semibold text-white">Crypto inventory</div>
            <div className="text-xs text-slate-400">
              Service coverage: {servicesCoveredByCrypto} of {overview.trustCenter.services.length} catalog services have at least one recorded module.
            </div>
            {overview.crypto.inventory.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                <div className="font-medium text-white">{item.moduleName}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {item.serviceName} · {item.validationStatus} · {item.validationProvenance ?? 'provenance not recorded'} ·{' '}
                  {item.cmvpCertificate ?? 'No certificate recorded'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
