import { useEffect, useMemo, useState } from 'react';
import { Link2, RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import { useEdgeIdentity } from '../../shared/session/identity';
import {
  createConnector,
  getConnector,
  listConnectors,
  syncConnector,
  testConnector,
  updateConnector,
} from './api';
import type { ConnectorCapability, ConnectorDetail, ConnectorSummary } from './types';

const capabilityOptions: ConnectorCapability[] = [
  'sync_assets',
  'sync_findings',
  'send_alerts',
  'receive_webhooks',
  'scim_provisioning',
  'ticket_push',
];

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Never';
}

function prettyCapability(value: ConnectorCapability) {
  return value.replace(/_/g, ' ');
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
    return <div className="panel p-6 text-sm text-slate-300">Loading automation manager...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="eyebrow">Automation Manager</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Connectors and Automation</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Manage connector posture for platforms like Wiz, GitHub, Slack, and webhooks from the
            canonical Cloudflare stack. This replaces the old parity-only surface with real D1-backed
            connector state, tests, syncs, and recent run history.
          </p>
        </div>
        <form
          className="space-y-3"
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
              <option value="slack">Slack</option>
              <option value="webhook">Webhook</option>
            </select>
          </label>
          <button className="button-primary" disabled={saving} type="submit">
            {saving ? 'Creating...' : 'Create Connector'}
          </button>
        </form>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div className="metric-card" key={metric.label}>
            <div className="metric-label">{metric.label}</div>
            <div className="metric-value">{metric.value}</div>
            <div className="mt-2 text-xs text-slate-500">{metric.detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="panel space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Connector Library</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Tenant Integrations</h2>
            </div>
            <RefreshCw className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="space-y-3">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                className={`panel-subtle w-full text-left transition ${
                  selectedId === connector.id ? 'border-cyan-300/30 bg-cyan-400/[0.04]' : 'hover:border-cyan-300/20'
                }`}
                onClick={() => setSelectedId(connector.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{connector.name}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {connector.provider} · {connector.category}
                    </div>
                  </div>
                  <span className={connector.status === 'healthy' ? 'badge-success' : 'badge-neutral'}>
                    {connector.status}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {connector.capabilities.map((capability) => (
                    <span className="badge-neutral" key={`${connector.id}-${capability}`}>
                      {prettyCapability(capability)}
                    </span>
                  ))}
                </div>
                <div className="mt-3 text-xs text-slate-500">Updated {formatDate(connector.updatedAt)}</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel">
          {detailLoading || !draft ? (
            <div className="text-sm text-slate-300">Loading connector detail...</div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="eyebrow">Connector Detail</div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{draft.name}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                    Configure auth posture, endpoint scope, enabled capabilities, and recent test/sync state for this
                    automation integration.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
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

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
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
                      <label className="flex items-center gap-3 pt-7 text-sm text-slate-300">
                        <input
                          checked={draft.isEnabled}
                          className="h-4 w-4 rounded border-white/20 bg-slate-950"
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
                          <label className="flex items-center gap-3 text-sm text-slate-300" key={capability}>
                            <input
                              checked={checked}
                              className="h-4 w-4 rounded border-white/20 bg-slate-950"
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
                        <h3 className="mt-2 text-lg font-semibold text-white">Connector Config JSON</h3>
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
                      <div className="mt-4 space-y-3 text-sm text-slate-300">
                        <div className="flex items-center justify-between">
                          <span>Created</span>
                          <span className="font-medium text-white">{formatDate(draft.createdAt)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Last test</span>
                          <span className="font-medium text-white">
                            {formatDate((draft.lastTest?.finishedAt as string | null) ?? null)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Last sync</span>
                          <span className="font-medium text-white">
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
                        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3" key={run.id}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium capitalize text-white">{run.actionType}</div>
                            <span className={run.status === 'completed' ? 'badge-success' : 'badge-neutral'}>
                              {run.status}
                            </span>
                          </div>
                          <div className="mt-2 text-xs text-slate-500">{formatDate(run.startedAt)}</div>
                          <div className="mt-3 text-sm leading-6 text-slate-300">
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
        <div className="mt-3 text-sm leading-6 text-slate-300">
          This canonical slice covers the prompt-pack&apos;s `Automation Manager` family with a real Cloudflare-backed
          integration workspace. The next connectors to deepen beyond this baseline are Teams, AD/LDAP, and Tenable,
          followed by provider-specific sync semantics and credential exchange flows.
        </div>
      </section>
    </div>
  );
}
