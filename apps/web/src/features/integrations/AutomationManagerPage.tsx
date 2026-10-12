import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Boxes,
  Eye,
  FileJson,
  KeyRound,
  Link2,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Wrench,
} from 'lucide-react';
import { RegActionMenu, RegRightDrawer, RegStatusPill } from '../../components/regovise/PagePrimitives';
import { useEdgeIdentity } from '../../shared/session/identity';
import {
  createConnector,
  getConnector,
  listConnectors,
  syncConnector,
  testConnector,
  updateConnector,
} from './api';
import type { ConnectorCapability, ConnectorDetail, ConnectorRun, ConnectorSummary } from './types';

const capabilityOptions: ConnectorCapability[] = [
  'sync_assets',
  'sync_findings',
  'sync_identities',
  'sync_vulnerabilities',
  'send_alerts',
  'receive_webhooks',
  'scim_provisioning',
  'ticket_push',
  'dry_run',
  'credential_metadata',
];

type PillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
type ConnectorActionDrawer = 'provider' | 'scope' | 'security' | 'raw-config' | null;

type ProviderHint = {
  endpoint: string;
  credential: string;
  scope: string;
  apiVersion: string;
};

const providerHints: Record<string, ProviderHint> = {
  wiz: {
    endpoint: 'https://api.wiz.io/graphql',
    credential: 'WIZ_CLIENT_SECRET_REF',
    scope: 'Cloud accounts, projects, findings, and vulnerability resources.',
    apiVersion: 'graphql-v1',
  },
  github: {
    endpoint: 'https://api.github.com',
    credential: 'GITHUB_APP_PRIVATE_KEY_REF',
    scope: 'Repositories, organizations, Dependabot alerts, branch protection, and code scanning.',
    apiVersion: '2022-11-28',
  },
  'ad-ldap': {
    endpoint: 'ldaps://directory.example.com:636',
    credential: 'DIRECTORY_BIND_SECRET_REF',
    scope: 'Users, groups, access accounts, service accounts, and provisioning deltas.',
    apiVersion: 'ldap-v3',
  },
  slack: {
    endpoint: 'https://slack.com/api',
    credential: 'SLACK_BOT_TOKEN_REF',
    scope: 'Channels, alert delivery targets, incident notifications, and questionnaire reminders.',
    apiVersion: 'web-api',
  },
  teams: {
    endpoint: 'https://graph.microsoft.com/v1.0',
    credential: 'MICROSOFT_GRAPH_SECRET_REF',
    scope: 'Teams, channels, groups, users, and notification delivery targets.',
    apiVersion: 'v1.0',
  },
  tenable: {
    endpoint: 'https://cloud.tenable.com',
    credential: 'TENABLE_ACCESS_SECRET_REF',
    scope: 'Assets, vulnerabilities, scan status, and exposure findings.',
    apiVersion: 'v3',
  },
  webhook: {
    endpoint: 'https://hooks.example.com/regovise',
    credential: 'WEBHOOK_SIGNING_SECRET_REF',
    scope: 'Inbound evidence, findings, alerts, and generic event payloads.',
    apiVersion: 'custom',
  },
  default: {
    endpoint: 'https://api.example.com',
    credential: 'CONNECTOR_SECRET_REF',
    scope: 'Provider resources selected for monitoring and evidence automation.',
    apiVersion: 'default',
  },
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Never';
}

function prettyCapability(value: ConnectorCapability) {
  return value.replace(/_/g, ' ');
}

function statusTone(value: string | null | undefined): PillTone {
  const normalized = (value ?? '').toLowerCase();
  if (['healthy', 'completed', 'success', 'enabled'].includes(normalized)) {
    return 'success';
  }
  if (['configured', 'running', 'pending', 'queued'].includes(normalized)) {
    return 'warning';
  }
  if (['degraded', 'failed', 'error', 'disabled'].includes(normalized)) {
    return 'danger';
  }
  return 'neutral';
}

function stringConfig(config: Record<string, unknown>, key: string, fallback = '') {
  const value = config[key];
  return typeof value === 'string' ? value : fallback;
}

function booleanConfig(config: Record<string, unknown>, key: string, fallback = false) {
  const value = config[key];
  return typeof value === 'boolean' ? value : fallback;
}

function arrayConfig(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return Array.isArray(value) ? value.map(String) : [];
}

function splitScopeLines(value: string) {
  return value
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function jsonPreview(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function DrawerField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-[#e7e1ec] bg-white px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6f6578]">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-[#241232]">{value}</div>
    </div>
  );
}

export function AutomationManagerPage() {
  const { identity } = useEdgeIdentity();
  const [connectors, setConnectors] = useState<ConnectorSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConnectorDetail | null>(null);
  const [draft, setDraft] = useState<ConnectorDetail | null>(null);
  const [configDraft, setConfigDraft] = useState('{}');
  const [configError, setConfigError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [connectorDrawerOpen, setConnectorDrawerOpen] = useState(false);
  const [connectorActionDrawer, setConnectorActionDrawer] = useState<ConnectorActionDrawer>(null);
  const [selectedRun, setSelectedRun] = useState<ConnectorRun | null>(null);
  const [newName, setNewName] = useState('');
  const [newProvider, setNewProvider] = useState('wiz');

  async function loadConnectors() {
    try {
      setLoading(true);
      setError(null);
      const next = await listConnectors();
      setConnectors(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load connectors.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(connectorId: string) {
    try {
      setDetailLoading(true);
      setError(null);
      const next = await getConnector(connectorId);
      setDetail(next);
      setDraft(next);
      setConfigDraft(JSON.stringify(next.config, null, 2));
      setConfigError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load connector detail.');
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadConnectors();
  }, [identity.tenantId, identity.userId]);

  useEffect(() => {
    if (selectedId) {
      setConnectorActionDrawer(null);
      setSelectedRun(null);
      void loadDetail(selectedId);
    }
  }, [selectedId]);

  const metrics = useMemo(() => {
    return [
      {
        label: 'Connectors',
        value: connectors.length,
        detail: 'Tenant-scoped automation integrations stored in D1.',
      },
      {
        label: 'Healthy',
        value: connectors.filter((connector) => connector.status === 'healthy').length,
        detail: 'Connectors with a passing recent test or sync state.',
      },
      {
        label: 'Enabled',
        value: connectors.filter((connector) => connector.isEnabled).length,
        detail: 'Active connectors participating in operational workflows.',
      },
      {
        label: 'Sync-ready',
        value: connectors.filter((connector) => connector.capabilities.includes('sync_findings')).length,
        detail: 'Connectors currently configured to pull findings or asset data.',
      },
    ];
  }, [connectors]);

  async function handleCreateConnector() {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const created = await createConnector({
        name: newName || undefined,
        provider: newProvider,
      });
      setNewName('');
      setNewProvider('wiz');
      setConnectorDrawerOpen(false);
      await loadConnectors();
      setSelectedId(created.id);
      setNotice('Connector created in the canonical Cloudflare runtime.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create connector.');
    } finally {
      setSaving(false);
    }
  }

  function applyConfigDraft() {
    if (!draft) {
      return;
    }

    try {
      const parsed = JSON.parse(configDraft) as Record<string, unknown>;
      setDraft({ ...draft, config: parsed });
      setConfigError(null);
      setNotice('Connector config JSON applied locally.');
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Invalid connector config JSON.');
    }
  }

  function updateDraftConfig(nextConfig: Record<string, unknown>) {
    if (!draft) {
      return;
    }

    setDraft({ ...draft, config: nextConfig });
    setConfigDraft(jsonPreview(nextConfig));
    setConfigError(null);
  }

  function updateDraftConfigValue(key: string, value: unknown) {
    if (!draft) {
      return;
    }

    updateDraftConfig({ ...draft.config, [key]: value });
  }

  function updateDraftConfigFromLines(key: string, value: string) {
    updateDraftConfigValue(key, splitScopeLines(value));
  }

  async function handleSaveConnector() {
    if (!draft) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const saved = await updateConnector(draft.id, {
        name: draft.name,
        category: draft.category,
        authMode: draft.authMode,
        baseUrl: draft.baseUrl,
        status: draft.status,
        isEnabled: draft.isEnabled,
        capabilities: draft.capabilities,
        config: draft.config,
      });
      setDetail(saved);
      setDraft(saved);
      setConfigDraft(JSON.stringify(saved.config, null, 2));
      await loadConnectors();
      setNotice('Connector saved to D1.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save connector.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(action: 'test' | 'sync') {
    if (!draft) {
      return;
    }

    try {
      setBusyAction(action);
      setError(null);
      setNotice(null);
      const response = action === 'test' ? await testConnector(draft.id) : await syncConnector(draft.id);
      await loadDetail(draft.id);
      await loadConnectors();
      setNotice(
        `${action === 'test' ? 'Connector test' : 'Connector sync'} ${response.status}. Run ${response.runId} recorded in D1.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to ${action} connector.`);
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading automation manager...</div>;
  }

  const activeProviderHint = draft ? (providerHints[draft.provider] ?? providerHints.default) : providerHints.default;
  const scopeMode = draft ? stringConfig(draft.config, 'scopeMode', 'all_resources') : 'all_resources';
  const saveDrawerFooter = (
    <div className="flex flex-wrap justify-end gap-2">
      <button className="button-secondary" onClick={() => setConnectorActionDrawer(null)} type="button">
        Close
      </button>
      <button className="button-primary" disabled={!draft || saving} onClick={() => void handleSaveConnector()} type="button">
        {saving ? 'Saving...' : 'Save connector'}
      </button>
    </div>
  );

  return (
    <div className="min-w-0 space-y-6">
      <section className="panel">
        <div className="min-w-0">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="eyebrow">Automation Manager</div>
              <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Connectors and Automation</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
                Manage connector posture for platforms like Wiz, GitHub, Slack, Teams, AD/LDAP, Tenable, and webhooks from the
                canonical Cloudflare stack. This replaces the old parity-only surface with real D1-backed
                connector state, credential metadata, dry-run tests, sync status, error states, and recent run history.
              </p>
            </div>
            <button className="button-primary shrink-0" onClick={() => setConnectorDrawerOpen(true)} type="button">
              <Plus className="mr-2 h-4 w-4" />
              Create connector
            </button>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {metrics.map((metric) => (
          <div className="metric-card" key={metric.label}>
            <div className="metric-label">{metric.label}</div>
            <div className="metric-value">{metric.value}</div>
            <div className="mt-2 text-xs text-[#62576a]">{metric.detail}</div>
          </div>
        ))}
      </section>

      <section className="grid min-w-0 gap-6 2xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="panel space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Connector Library</div>
              <h2 className="mt-2 text-xl font-semibold text-[#241232]">Tenant Integrations</h2>
            </div>
            <RefreshCw className="h-5 w-5 text-[#7a3ccf]" />
          </div>
          <div className="space-y-3">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                className={`panel-subtle w-full text-left transition ${
                  selectedId === connector.id ? 'border-[#d7c3f1] bg-[#f6f1fa]' : 'hover:border-[#d7c3f1]'
                }`}
                onClick={() => setSelectedId(connector.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-words font-medium text-[#241232]">{connector.name}</div>
                    <div className="mt-1 text-sm text-[#6f6578]">
                      {connector.provider} · {connector.category}
                    </div>
                  </div>
                  <RegStatusPill className="shrink-0 capitalize" tone={statusTone(connector.status)}>
                    {connector.status}
                  </RegStatusPill>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {connector.capabilities.map((capability) => (
                    <RegStatusPill key={`${connector.id}-${capability}`} tone="neutral">
                      {prettyCapability(capability)}
                    </RegStatusPill>
                  ))}
                </div>
                <div className="mt-3 text-xs text-[#62576a]">Updated {formatDate(connector.updatedAt)}</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel">
          {detailLoading || !draft ? (
            <div className="text-sm text-[#4f435c]">Loading connector detail...</div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="eyebrow">Connector Detail</div>
                  <h2 className="mt-2 text-2xl font-semibold text-[#241232]">{draft.name}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[#4f435c]">
                    Configure auth posture, credential metadata, endpoint scope, enabled capabilities, dry-run behavior,
                    sync status, and recent error states for this automation integration.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <RegActionMenu
                    actions={[
                      {
                        label: 'Configure provider',
                        icon: SlidersHorizontal,
                        onSelect: () => setConnectorActionDrawer('provider'),
                      },
                      {
                        label: 'Manage resource scope',
                        icon: Boxes,
                        onSelect: () => setConnectorActionDrawer('scope'),
                      },
                      {
                        label: 'Review secure configuration',
                        icon: KeyRound,
                        onSelect: () => setConnectorActionDrawer('security'),
                      },
                      {
                        label: 'Edit raw config',
                        icon: FileJson,
                        onSelect: () => setConnectorActionDrawer('raw-config'),
                      },
                    ]}
                    label={`Open connector actions for ${draft.name}`}
                  />
                  <button
                    className="button-secondary"
                    disabled={busyAction === 'test'}
                    onClick={() => void handleAction('test')}
                    type="button"
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {busyAction === 'test' ? 'Testing...' : 'Run Test'}
                  </button>
                  <button
                    className="button-secondary"
                    disabled={busyAction === 'sync'}
                    onClick={() => void handleAction('sync')}
                    type="button"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {busyAction === 'sync' ? 'Syncing...' : 'Sync Now'}
                  </button>
                  <button className="button-primary" disabled={saving} onClick={() => void handleSaveConnector()} type="button">
                    <Wrench className="mr-2 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Connector'}
                  </button>
                </div>
              </div>

              <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-6">
                  <div className="panel-subtle">
                    <div className="eyebrow">Metadata</div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="label">Name</label>
                        <input
                          className="input mt-2"
                          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                          value={draft.name}
                        />
                      </div>
                      <div>
                        <label className="label">Provider</label>
                        <input className="input mt-2" readOnly value={draft.provider} />
                      </div>
                      <div>
                        <label className="label">Category</label>
                        <input
                          className="input mt-2"
                          onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                          value={draft.category}
                        />
                      </div>
                      <div>
                        <label className="label">Auth Mode</label>
                        <input
                          className="input mt-2"
                          onChange={(event) => setDraft({ ...draft, authMode: event.target.value })}
                          value={draft.authMode}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="label">Base URL</label>
                        <input
                          className="input mt-2"
                          onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
                          value={draft.baseUrl ?? ''}
                        />
                      </div>
                      <div>
                        <label className="label">Status</label>
                        <select
                          className="input mt-2"
                          onChange={(event) => setDraft({ ...draft, status: event.target.value })}
                          value={draft.status}
                        >
                          <option value="configured">Configured</option>
                          <option value="healthy">Healthy</option>
                          <option value="degraded">Degraded</option>
                          <option value="disabled">Disabled</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-3 pt-7 text-sm text-[#4f435c]">
                        <input
                          checked={draft.isEnabled}
                          className="h-4 w-4 rounded border-[#d7c3f1] bg-white"
                          onChange={(event) => setDraft({ ...draft, isEnabled: event.target.checked })}
                          type="checkbox"
                        />
                        Connector enabled
                      </label>
                    </div>
                  </div>

                  <div className="panel-subtle">
                    <div className="eyebrow">Capabilities</div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {capabilityOptions.map((capability) => {
                        const checked = draft.capabilities.includes(capability);
                        return (
                          <label className="flex items-center gap-3 text-sm text-[#4f435c]" key={capability}>
                            <input
                              checked={checked}
                              className="h-4 w-4 rounded border-[#d7c3f1] bg-white"
                              onChange={(event) =>
                                setDraft({
                                  ...draft,
                                  capabilities: event.target.checked
                                    ? [...draft.capabilities, capability]
                                    : draft.capabilities.filter((entry) => entry !== capability),
                                })
                              }
                              type="checkbox"
                            />
                            {prettyCapability(capability)}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="panel-subtle">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="eyebrow">Config Envelope</div>
                        <h3 className="mt-2 text-lg font-semibold text-[#241232]">Connector Config JSON</h3>
                      </div>
                      <button className="button-secondary" onClick={applyConfigDraft} type="button">
                        Apply JSON
                      </button>
                    </div>
                    <textarea
                      className="input mt-4 min-h-[320px] font-mono text-xs leading-6"
                      onChange={(event) => {
                        setConfigDraft(event.target.value);
                        if (configError) {
                          setConfigError(null);
                        }
                      }}
                      spellCheck={false}
                      value={configDraft}
                    />
                    {configError && <div className="notice-error mt-4">{configError}</div>}
                  </div>
                </div>

                <aside className="space-y-4">
                  <div className="panel-subtle">
                    <div className="eyebrow">Runtime Signals</div>
                      <div className="mt-4 space-y-3 text-sm text-[#4f435c]">
                        <div className="flex items-center justify-between">
                          <span>Lifecycle</span>
                          <span className="font-medium text-[#241232]">
                            {(() => {
                              const lifecycle = draft.lastTest?.lifecycle;
                              return Array.isArray(lifecycle) ? `${lifecycle.length} stages` : 'Not tested';
                            })()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Sync status</span>
                          <span className="font-medium text-[#241232]">
                            {String(draft.lastSync?.syncStatus ?? draft.lastTest?.syncStatus ?? 'Not tested')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Created</span>
                          <span className="font-medium text-[#241232]">{formatDate(draft.createdAt)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Last test</span>
                          <span className="font-medium text-[#241232]">
                            {formatDate((draft.lastTest?.finishedAt as string | null) ?? null)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Last sync</span>
                          <span className="font-medium text-[#241232]">
                            {formatDate((draft.lastSync?.finishedAt as string | null) ?? null)}
                          </span>
                        </div>
                      </div>
                    {draft.lastError && <div className="notice-error mt-4">{draft.lastError}</div>}
                  </div>

                  <div className="panel-subtle">
                    <div className="eyebrow">Recent Runs</div>
                    <div className="mt-4 space-y-3">
                      {draft.runs.map((run) => (
                        <div className="rounded-2xl border border-[#ded8e4] bg-white p-3" key={run.id}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 break-words font-medium capitalize text-[#241232]">{run.actionType}</div>
                            <div className="flex shrink-0 items-center gap-2">
                              <RegStatusPill className="capitalize" tone={statusTone(run.status)}>
                                {run.status}
                              </RegStatusPill>
                              <RegActionMenu
                                actions={[
                                  {
                                    label: 'Inspect run',
                                    icon: Eye,
                                    onSelect: () => setSelectedRun(run),
                                  },
                                ]}
                                label={`Open run actions for ${run.id}`}
                              />
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-[#62576a]">{formatDate(run.startedAt)}</div>
                          <div className="mt-3 text-sm leading-6 text-[#4f435c]">
                            {'message' in run.summary ? String(run.summary.message) : 'No run summary available.'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          )}
        </section>
      </section>

      <section className="panel-subtle">
        <div className="eyebrow">Prompt-Pack Alignment</div>
        <div className="mt-3 text-sm leading-6 text-[#4f435c]">
          This canonical slice covers the prompt-pack&apos;s `Automation Manager` family with a real Cloudflare-backed
          integration workspace. Provider-specific lifecycle semantics are available for AD/LDAP, Slack, Teams,
          webhooks, Tenable-style vulnerability feeds, credential metadata, dry-run/test, sync status, and explicit
          error states.
        </div>
      </section>

      <RegRightDrawer
        description="Review endpoint, auth, and provider-specific runtime hints without leaving the connector workspace."
        footer={saveDrawerFooter}
        onOpenChange={(open) => {
          if (!open) {
            setConnectorActionDrawer(null);
          }
        }}
        open={connectorActionDrawer === 'provider' && Boolean(draft)}
        title="Configure provider"
      >
        {draft ? (
          <div className="space-y-5">
            <div className="notice-info">
              <div className="flex items-start gap-3">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold text-[#241232]">{draft.provider} provider profile</div>
                  <p className="mt-1 text-sm leading-6 text-[#4f435c]">{activeProviderHint.scope}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3">
              <DrawerField label="Provider" value={draft.provider} />
              <DrawerField label="Suggested endpoint" value={activeProviderHint.endpoint} />
              <DrawerField label="Suggested credential reference" value={activeProviderHint.credential} />
              <DrawerField label="API version" value={activeProviderHint.apiVersion} />
            </div>
            <div className="grid gap-4">
              <label className="space-y-1">
                <span className="label">Connector name</span>
                <input
                  className="input"
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  value={draft.name}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Base URL</span>
                <input
                  className="input"
                  onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
                  placeholder={activeProviderHint.endpoint}
                  value={draft.baseUrl ?? ''}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="label">Category</span>
                  <input
                    className="input"
                    onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                    value={draft.category}
                  />
                </label>
                <label className="space-y-1">
                  <span className="label">Auth mode</span>
                  <input
                    className="input"
                    onChange={(event) => setDraft({ ...draft, authMode: event.target.value })}
                    value={draft.authMode}
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="label">Environment</span>
                  <input
                    className="input"
                    onChange={(event) => updateDraftConfigValue('environment', event.target.value)}
                    placeholder="production"
                    value={stringConfig(draft.config, 'environment')}
                  />
                </label>
                <label className="space-y-1">
                  <span className="label">Provider API version</span>
                  <input
                    className="input"
                    onChange={(event) => updateDraftConfigValue('apiVersion', event.target.value)}
                    placeholder={activeProviderHint.apiVersion}
                    value={stringConfig(draft.config, 'apiVersion')}
                  />
                </label>
              </div>
              <label className="flex items-center gap-3 rounded-lg border border-[#e7e1ec] bg-white p-3 text-sm text-[#4f435c]">
                <input
                  checked={draft.isEnabled}
                  className="h-4 w-4 rounded border-[#d7c3f1] bg-white"
                  onChange={(event) => setDraft({ ...draft, isEnabled: event.target.checked })}
                  type="checkbox"
                />
                Connector enabled for scheduled workflows
              </label>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Choose which provider resources should participate in evidence collection, monitoring, and downstream automation."
        footer={saveDrawerFooter}
        onOpenChange={(open) => {
          if (!open) {
            setConnectorActionDrawer(null);
          }
        }}
        open={connectorActionDrawer === 'scope' && Boolean(draft)}
        title="Manage resource scope"
      >
        {draft ? (
          <div className="space-y-5">
            <div className="grid gap-3">
              <DrawerField label="Current mode" value={scopeMode.replace(/_/g, ' ')} />
              <DrawerField
                label="Included resources"
                value={arrayConfig(draft.config, 'includedResources').length || 'All provider resources'}
              />
              <DrawerField label="Excluded resources" value={arrayConfig(draft.config, 'excludedResources').length || 'None'} />
            </div>
            <label className="space-y-1">
              <span className="label">Scope mode</span>
              <select
                className="input"
                onChange={(event) => updateDraftConfigValue('scopeMode', event.target.value)}
                value={scopeMode}
              >
                <option value="all_resources">All resources</option>
                <option value="selected_resources">Selected resources only</option>
                <option value="excluded_resources">All except excluded resources</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Included resource identifiers</span>
              <textarea
                className="input min-h-[120px]"
                onChange={(event) => updateDraftConfigFromLines('includedResources', event.target.value)}
                placeholder="resource-id-1&#10;resource-id-2"
                value={arrayConfig(draft.config, 'includedResources').join('\n')}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Excluded resource identifiers</span>
              <textarea
                className="input min-h-[120px]"
                onChange={(event) => updateDraftConfigFromLines('excludedResources', event.target.value)}
                placeholder="sandbox-resource&#10;legacy-resource"
                value={arrayConfig(draft.config, 'excludedResources').join('\n')}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Owner or team scope</span>
              <input
                className="input"
                onChange={(event) => updateDraftConfigValue('ownerScope', event.target.value)}
                placeholder="Security operations"
                value={stringConfig(draft.config, 'ownerScope')}
              />
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-[#e7e1ec] bg-white p-3 text-sm text-[#4f435c]">
              <input
                checked={booleanConfig(draft.config, 'includeNewResources', true)}
                className="h-4 w-4 rounded border-[#d7c3f1] bg-white"
                onChange={(event) => updateDraftConfigValue('includeNewResources', event.target.checked)}
                type="checkbox"
              />
              Automatically include newly discovered resources unless explicitly excluded
            </label>
            <div className="rounded-lg border border-[#e7e1ec] bg-white p-3">
              <div className="label">Enabled capabilities</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {draft.capabilities.map((capability) => (
                  <RegStatusPill key={`scope-${capability}`} tone="neutral">
                    {prettyCapability(capability)}
                  </RegStatusPill>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Review credential metadata, dry-run posture, and safety settings. Secret values stay in the configured vault or provider and are not exposed here."
        footer={saveDrawerFooter}
        onOpenChange={(open) => {
          if (!open) {
            setConnectorActionDrawer(null);
          }
        }}
        open={connectorActionDrawer === 'security' && Boolean(draft)}
        title="Review secure configuration"
      >
        {draft ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <DrawerField
                label="Credential metadata"
                value={
                  draft.capabilities.includes('credential_metadata') ? (
                    <RegStatusPill tone="success">Tracked</RegStatusPill>
                  ) : (
                    <RegStatusPill tone="warning">Not tracked</RegStatusPill>
                  )
                }
              />
              <DrawerField
                label="Dry-run support"
                value={
                  draft.capabilities.includes('dry_run') ? (
                    <RegStatusPill tone="success">Enabled</RegStatusPill>
                  ) : (
                    <RegStatusPill tone="neutral">Optional</RegStatusPill>
                  )
                }
              />
            </div>
            <div className="notice-warning">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold text-[#241232]">No secrets in browser state</div>
                  <p className="mt-1 text-sm leading-6 text-[#4f435c]">
                    Store only references, rotation metadata, and reviewer notes in connector config. Real tokens remain
                    outside this UI.
                  </p>
                </div>
              </div>
            </div>
            <label className="space-y-1">
              <span className="label">Credential reference</span>
              <input
                className="input"
                onChange={(event) => updateDraftConfigValue('credentialRef', event.target.value)}
                placeholder={activeProviderHint.credential}
                value={stringConfig(draft.config, 'credentialRef')}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Webhook or signing secret reference</span>
              <input
                className="input"
                onChange={(event) => updateDraftConfigValue('secretRef', event.target.value)}
                placeholder="CONNECTOR_SIGNING_SECRET_REF"
                value={stringConfig(draft.config, 'secretRef')}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Last credential rotation</span>
              <input
                className="input"
                onChange={(event) => updateDraftConfigValue('tokenLastRotatedAt', event.target.value)}
                placeholder="2026-06-01"
                value={stringConfig(draft.config, 'tokenLastRotatedAt')}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Least privilege notes</span>
              <textarea
                className="input min-h-[130px]"
                onChange={(event) => updateDraftConfigValue('leastPrivilegeNotes', event.target.value)}
                placeholder="Scopes granted, reviewer, and exception rationale."
                value={stringConfig(draft.config, 'leastPrivilegeNotes')}
              />
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-[#e7e1ec] bg-white p-3 text-sm text-[#4f435c]">
              <input
                checked={booleanConfig(draft.config, 'blockSyncWhenCredentialStale', false)}
                className="h-4 w-4 rounded border-[#d7c3f1] bg-white"
                onChange={(event) => updateDraftConfigValue('blockSyncWhenCredentialStale', event.target.checked)}
                type="checkbox"
              />
              Block sync when credential metadata is stale
            </label>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Inspect and apply the full connector config envelope for advanced provider settings."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setConnectorActionDrawer(null)} type="button">
              Close
            </button>
            <button className="button-secondary" onClick={applyConfigDraft} type="button">
              Apply JSON
            </button>
            <button className="button-primary" disabled={!draft || saving} onClick={() => void handleSaveConnector()} type="button">
              {saving ? 'Saving...' : 'Save connector'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) {
            setConnectorActionDrawer(null);
          }
        }}
        open={connectorActionDrawer === 'raw-config' && Boolean(draft)}
        title="Edit raw config"
      >
        <div className="space-y-4">
          <textarea
            className="input min-h-[520px] font-mono text-xs leading-6"
            onChange={(event) => {
              setConfigDraft(event.target.value);
              if (configError) {
                setConfigError(null);
              }
            }}
            spellCheck={false}
            value={configDraft}
          />
          {configError && <div className="notice-error">{configError}</div>}
        </div>
      </RegRightDrawer>

      <RegRightDrawer
        description="Review the deterministic connector run payload and status written by the Cloudflare runtime."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setSelectedRun(null)} type="button">
              Close
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRun(null);
          }
        }}
        open={Boolean(selectedRun)}
        title={selectedRun ? `${selectedRun.actionType} run` : 'Connector run'}
      >
        {selectedRun ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <DrawerField label="Status" value={<RegStatusPill tone={statusTone(selectedRun.status)}>{selectedRun.status}</RegStatusPill>} />
              <DrawerField label="Run ID" value={selectedRun.id} />
              <DrawerField label="Started" value={formatDate(selectedRun.startedAt)} />
              <DrawerField label="Finished" value={formatDate(selectedRun.finishedAt)} />
              <DrawerField label="Triggered by" value={selectedRun.triggeredByUserId ?? 'System'} />
              <DrawerField label="Action type" value={selectedRun.actionType} />
            </div>
            <div className="rounded-lg border border-[#e7e1ec] bg-white p-3">
              <div className="label">Run summary</div>
              <pre className="mt-3 max-h-[420px] overflow-auto rounded-md bg-[#f7f5f9] p-3 text-xs leading-6 text-[#241232]">
                {jsonPreview(selectedRun.summary)}
              </pre>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Create a tenant-scoped automation connector. Provider-specific credentials and runtime metadata can be configured after creation."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setConnectorDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={saving} form="automation-create-connector" type="submit">
              {saving ? 'Creating...' : 'Create connector'}
            </button>
          </div>
        }
        onOpenChange={setConnectorDrawerOpen}
        open={connectorDrawerOpen}
        title="Create connector"
      >
        <form
          className="space-y-4"
          id="automation-create-connector"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreateConnector();
          }}
        >
          <label className="space-y-1">
            <span className="label">Connector name</span>
            <input
              className="input"
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Cloud posture feed"
              value={newName}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Provider</span>
            <select className="input" onChange={(event) => setNewProvider(event.target.value)} value={newProvider}>
              <option value="wiz">Wiz</option>
              <option value="github">GitHub</option>
              <option value="ad-ldap">AD/LDAP</option>
              <option value="slack">Slack</option>
              <option value="teams">Teams</option>
              <option value="tenable">Tenable</option>
              <option value="webhook">Webhook</option>
            </select>
          </label>
        </form>
      </RegRightDrawer>
    </div>
  );
}
