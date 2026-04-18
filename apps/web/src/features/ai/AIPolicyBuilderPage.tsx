import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, Plus, Save, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useEdgeIdentity } from '../../shared/session/identity';
import {
  clearPolicyBuilderQueue,
  createPolicyBuilderSession,
  finishPolicyBuilderSession,
  getPolicyBuilderSession,
  getPolicyBuilderWorkspace,
  queuePolicyControl,
  queuePolicyProfile,
  updatePolicyBuilderSession,
} from './api';
import type { PolicyBuilderSessionDetail, PolicyBuilderWorkspace } from './types';

type WizardStep = 'profiles' | 'controls' | 'review';

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function badgeClass(status: string) {
  if (status === 'Finished' || status === 'Complete') {
    return 'badge-success';
  }
  if (status === 'Attention') {
    return 'badge-danger';
  }
  return 'badge-neutral';
}

export function AIPolicyBuilderPage() {
  const { identity } = useEdgeIdentity();
  const [workspace, setWorkspace] = useState<PolicyBuilderWorkspace | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PolicyBuilderSessionDetail | null>(null);
  const [activeStep, setActiveStep] = useState<WizardStep>('profiles');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedCatalogueName, setSelectedCatalogueName] = useState('');
  const [selectedControlId, setSelectedControlId] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadWorkspace() {
    try {
      setLoading(true);
      setError(null);
      const next = await getPolicyBuilderWorkspace();
      setWorkspace(next);
      setSelectedSessionId((current) => current ?? next.sessions[0]?.id ?? null);
      if (!selectedProfileId) {
        setSelectedProfileId(next.profiles[0]?.id ?? '');
      }
      if (!selectedCatalogueName) {
        setSelectedCatalogueName(next.catalogues[0]?.name ?? '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load AI Policy Builder.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(sessionId: string) {
    try {
      setDetailLoading(true);
      setError(null);
      const next = await getPolicyBuilderSession(sessionId);
      setDetail(next);
      setTitleDraft(next.session.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load builder session.');
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [identity.tenantId, identity.userId]);

  useEffect(() => {
    if (selectedSessionId) {
      void loadDetail(selectedSessionId);
    } else {
      setDetail(null);
    }
  }, [selectedSessionId]);

  const selectedCatalogue = useMemo(
    () => workspace?.catalogues.find((catalogue) => catalogue.name === selectedCatalogueName) ?? workspace?.catalogues[0] ?? null,
    [selectedCatalogueName, workspace],
  );

  useEffect(() => {
    setSelectedControlId(selectedCatalogue?.controls[0]?.controlId ?? '');
  }, [selectedCatalogue?.name]);

  const metrics = useMemo(() => {
    return [
      {
        label: 'Profiles',
        value: workspace?.profiles.length ?? 0,
        detail: 'Configured security profiles with mapped controls.',
      },
      {
        label: 'Catalogues',
        value: workspace?.catalogues.length ?? 0,
        detail: 'Loaded security control catalogues available for manual selection.',
      },
      {
        label: 'Queued controls',
        value: detail?.queue.length ?? 0,
        detail: 'Candidate requirements currently waiting in the builder queue.',
      },
      {
        label: 'Created requirements',
        value: detail?.createdRequirements.length ?? 0,
        detail: 'Generated requirement records for this policy context.',
      },
    ];
  }, [detail?.createdRequirements.length, detail?.queue.length, workspace?.catalogues.length, workspace?.profiles.length]);

  async function refreshCurrentSession() {
    if (!selectedSessionId) {
      return;
    }
    await loadDetail(selectedSessionId);
    await loadWorkspace();
  }

  async function handleCreateSession() {
    try {
      setBusy('create-session');
      setError(null);
      setNotice(null);
      const created = await createPolicyBuilderSession({
        title: `Policy Builder ${workspace ? workspace.sessions.length + 1 : 1}`,
      });
      await loadWorkspace();
      setSelectedSessionId(created.session.id);
      setActiveStep('profiles');
      setNotice('New AI policy-builder session created in the canonical Worker runtime.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create builder session.');
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveSession() {
    if (!selectedSessionId) {
      return;
    }
    try {
      setBusy('save-session');
      setError(null);
      setNotice(null);
      await updatePolicyBuilderSession(selectedSessionId, { title: titleDraft });
      await refreshCurrentSession();
      setNotice('Policy-builder context saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save builder session.');
    } finally {
      setBusy(null);
    }
  }

  async function handleQueueProfile() {
    if (!selectedSessionId || !selectedProfileId) {
      return;
    }
    try {
      setBusy('queue-profile');
      setError(null);
      setNotice(null);
      const response = await queuePolicyProfile(selectedSessionId, selectedProfileId);
      setDetail(response.detail);
      await loadWorkspace();
      setActiveStep('controls');
      setNotice(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to queue profile controls.');
    } finally {
      setBusy(null);
    }
  }

  async function handleQueueControl() {
    if (!selectedSessionId || !selectedCatalogueName || !selectedControlId) {
      return;
    }
    try {
      setBusy('queue-control');
      setError(null);
      setNotice(null);
      const response = await queuePolicyControl(selectedSessionId, {
        catalogName: selectedCatalogueName,
        controlId: selectedControlId,
      });
      setDetail(response.detail);
      await loadWorkspace();
      setActiveStep('review');
      setNotice(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to queue control.');
    } finally {
      setBusy(null);
    }
  }

  async function handleClearQueue() {
    if (!selectedSessionId) {
      return;
    }
    try {
      setBusy('clear-queue');
      setError(null);
      setNotice(null);
      const next = await clearPolicyBuilderQueue(selectedSessionId);
      setDetail(next);
      await loadWorkspace();
      setActiveStep('profiles');
      setNotice('Queued controls cleared from this policy-builder session.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to clear queued controls.');
    } finally {
      setBusy(null);
    }
  }

  async function handleFinish() {
    if (!selectedSessionId) {
      return;
    }
    try {
      setBusy('finish');
      setError(null);
      setNotice(null);
      const response = await finishPolicyBuilderSession(selectedSessionId);
      setDetail(response.detail);
      await loadWorkspace();
      setNotice(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to finish policy builder.');
    } finally {
      setBusy(null);
    }
  }

  if (loading || !workspace) {
    return <div className="panel p-6 text-sm text-slate-300">Loading AI Policy Builder...</div>;
  }

  const currentProfile = workspace.profiles.find((profile) => profile.id === selectedProfileId) ?? workspace.profiles[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="eyebrow">AI Policy Builder</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Standardize policy requirements from profiles and control catalogues</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Launch the builder from a policy context, queue mapped controls from security profiles or manual catalogue picks,
            then batch-create standardized requirements that stay editable after generation.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="badge-neutral">Policy wizard</span>
            <span className="badge-neutral">D1-backed queue</span>
            <span className="badge-neutral">Control deduplication</span>
          </div>
        </div>
        <div className="panel-subtle space-y-3">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Policy Context</div>
          <div className="text-lg font-semibold text-white">{workspace.policyContext.name}</div>
          <div className="text-sm text-slate-300">Owner: {workspace.policyContext.owner}</div>
          <div className="text-sm text-slate-300">Location: {workspace.policyContext.location}</div>
          <div className="grid gap-2 text-sm text-slate-300">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2">
              <span>Profiles configured</span>
              <span className={workspace.policyContext.readiness.profilesConfigured ? 'badge-success' : 'badge-danger'}>
                {workspace.policyContext.readiness.profilesConfigured ? 'Ready' : 'Missing'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2">
              <span>Control catalogues loaded</span>
              <span className={workspace.policyContext.readiness.controlCataloguesLoaded ? 'badge-success' : 'badge-danger'}>
                {workspace.policyContext.readiness.controlCataloguesLoaded ? 'Ready' : 'Missing'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2">
              <span>Existing requirements</span>
              <span className="badge-neutral">{workspace.policyContext.readiness.existingRequirementCount}</span>
            </div>
          </div>
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}
      {notice && <div className="notice-success">{notice}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="panel-subtle">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{metric.label}</div>
            <div className="mt-3 text-3xl font-semibold text-white">{metric.value}</div>
            <div className="mt-2 text-sm text-slate-400">{metric.detail}</div>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
        <section className="panel space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Sessions</div>
              <div className="mt-2 text-lg font-semibold text-white">Policy Builder Sessions</div>
            </div>
            <button className="button-primary" onClick={() => void handleCreateSession()} disabled={busy !== null}>
              <Plus className="h-4 w-4" />
              New session
            </button>
          </div>
          <div className="space-y-3">
            {workspace.sessions.map((session) => (
              <button
                key={session.id}
                className={`panel-subtle w-full text-left transition ${selectedSessionId === session.id ? 'border-cyan-300/40 bg-cyan-400/[0.06]' : ''}`}
                onClick={() => setSelectedSessionId(session.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{session.title}</div>
                    <div className="mt-1 text-xs text-slate-400">{session.policyLocation}</div>
                  </div>
                  <span className={badgeClass(session.status)}>{session.status}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span>{session.queuedControls} queued</span>
                  <span>Owner: {session.owner}</span>
                </div>
                <div className="mt-2 text-xs text-slate-500">Saved {formatDate(session.lastSavedAt)}</div>
              </button>
            ))}
            {workspace.sessions.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">
                No builder sessions yet. Create one to start generating policy requirements.
              </div>
            )}
          </div>
        </section>

        <section className="panel space-y-6">
          {detailLoading && <div className="text-sm text-slate-400">Loading builder session...</div>}
          {!detailLoading && detail ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="eyebrow">Wizard</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{detail.session.title}</div>
                  <div className="mt-2 text-sm text-slate-300">
                    Owner: {detail.session.owner} · Policy location: {detail.session.policyLocation}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="button-secondary" disabled={busy !== null} onClick={() => void handleSaveSession()}>
                    <Save className="h-4 w-4" />
                    Save context
                  </button>
                  <button className="button-secondary" disabled={busy !== null} onClick={() => void refreshCurrentSession()}>
                    Refresh
                  </button>
                </div>
              </div>

              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Session title</span>
                <input
                  className="input"
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  placeholder="Policy Builder Session"
                />
              </label>

              <Tabs value={activeStep} onValueChange={(value) => setActiveStep(value as WizardStep)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="profiles">1. Select Profile</TabsTrigger>
                  <TabsTrigger value="controls">2. Select Controls</TabsTrigger>
                  <TabsTrigger value="review">3. Review & Finish</TabsTrigger>
                </TabsList>

                <TabsContent value="profiles" className="mt-6 space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                    <div className="space-y-3">
                      <label className="block space-y-2">
                        <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Security Profile</span>
                        <select className="input" value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)}>
                          {workspace.profiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {profile.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className="button-primary w-full" onClick={() => void handleQueueProfile()} disabled={busy !== null || !selectedProfileId}>
                        <Sparkles className="h-4 w-4" />
                        Queue profile controls
                      </button>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                        Selecting a profile queues all mapped controls, skips duplicates already in the policy context, and preserves the queue across wizard steps.
                      </div>
                    </div>
                    <div className="panel-subtle">
                      <div className="flex items-center gap-2 text-white">
                        <ShieldCheck className="h-4 w-4 text-cyan-300" />
                        <span className="font-semibold">{currentProfile?.label ?? 'No profile selected'}</span>
                      </div>
                      <div className="mt-2 text-sm text-slate-300">{currentProfile?.description}</div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(currentProfile?.catalogues ?? []).map((catalogue) => (
                          <span key={catalogue} className="badge-neutral">
                            {catalogue}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
                            <tr>
                              <th className="px-4 py-3">Control</th>
                              <th className="px-4 py-3">Title</th>
                              <th className="px-4 py-3">Family</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(currentProfile?.controls ?? []).map((control) => (
                              <tr key={control.controlId} className="border-t border-white/5">
                                <td className="px-4 py-3 font-medium text-white">{control.controlId}</td>
                                <td className="px-4 py-3 text-slate-300">{control.title}</td>
                                <td className="px-4 py-3 text-slate-400">{control.family}</td>
                              </tr>
                            ))}
                            {(currentProfile?.controls.length ?? 0) === 0 && (
                              <tr>
                                <td className="px-4 py-6 text-slate-400" colSpan={3}>
                                  No controls available for this profile.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="controls" className="mt-6 space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                    <div className="space-y-3">
                      <label className="block space-y-2">
                        <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Catalogue</span>
                        <select className="input" value={selectedCatalogueName} onChange={(event) => setSelectedCatalogueName(event.target.value)}>
                          {workspace.catalogues.map((catalogue) => (
                            <option key={catalogue.name} value={catalogue.name}>
                              {catalogue.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-2">
                        <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Security Control</span>
                        <select className="input" value={selectedControlId} onChange={(event) => setSelectedControlId(event.target.value)}>
                          {(selectedCatalogue?.controls ?? []).map((control) => (
                            <option key={control.controlId} value={control.controlId}>
                              {control.controlId} · {control.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className="button-primary w-full" onClick={() => void handleQueueControl()} disabled={busy !== null || !selectedControlId}>
                        <Wand2 className="h-4 w-4" />
                        Add control to queue
                      </button>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                        Duplicate controls are rejected clearly and the queue continues to accumulate across multiple catalogues.
                      </div>
                    </div>
                    <div className="panel-subtle">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-white">
                          <ClipboardList className="h-4 w-4 text-cyan-300" />
                          <span className="font-semibold">Current queue</span>
                        </div>
                        <span className="badge-neutral">{detail.queue.length} queued</span>
                      </div>
                      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
                            <tr>
                              <th className="px-4 py-3">Source</th>
                              <th className="px-4 py-3">Control</th>
                              <th className="px-4 py-3">Title</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.queue.map((item) => (
                              <tr key={item.id} className="border-t border-white/5">
                                <td className="px-4 py-3 text-slate-300">{item.sourceName}</td>
                                <td className="px-4 py-3 font-medium text-white">{item.controlId}</td>
                                <td className="px-4 py-3 text-slate-400">{item.title}</td>
                              </tr>
                            ))}
                            {detail.queue.length === 0 && (
                              <tr>
                                <td className="px-4 py-6 text-slate-400" colSpan={3}>
                                  No controls have been added to the queue yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="review" className="mt-6 space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                    <div className="space-y-3">
                      <div className="panel-subtle">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-white">
                            <CheckCircle2 className="h-4 w-4 text-cyan-300" />
                            <span className="font-semibold">Queue summary</span>
                          </div>
                          <span className="badge-neutral">{detail.queue.length} queued</span>
                        </div>
                        <div className="mt-4 space-y-2">
                          {detail.queueSummary.map((item) => (
                            <div key={item.sourceName} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm">
                              <span className="text-slate-300">{item.sourceName}</span>
                              <span className="badge-neutral">{item.count}</span>
                            </div>
                          ))}
                          {detail.queueSummary.length === 0 && (
                            <div className="text-sm text-slate-400">No queued controls to summarize yet.</div>
                          )}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button className="button-secondary" onClick={() => void handleClearQueue()} disabled={busy !== null || detail.queue.length === 0}>
                            Clear all controls
                          </button>
                          <button className="button-primary" onClick={() => void handleFinish()} disabled={busy !== null || detail.queue.length === 0}>
                            Finish and create requirements
                          </button>
                        </div>
                      </div>

                      <div className="panel-subtle">
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Pipeline</div>
                        <div className="mt-4 space-y-3">
                          {detail.pipeline.map((step) => (
                            <div key={step.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="font-medium text-white">{step.title}</div>
                                <span className={badgeClass(step.status)}>{step.status}</span>
                              </div>
                              <div className="mt-2 text-sm text-slate-300">{step.helper}</div>
                              <div className="mt-3 text-xs text-slate-500">{step.metric}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="panel-subtle overflow-hidden">
                        <div className="flex items-center gap-2 text-white">
                          <ClipboardList className="h-4 w-4 text-cyan-300" />
                          <span className="font-semibold">Preview controls</span>
                        </div>
                        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                          <table className="min-w-full text-left text-sm">
                            <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
                              <tr>
                                <th className="px-4 py-3">Control ID</th>
                                <th className="px-4 py-3">Title</th>
                                <th className="px-4 py-3">Family</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.queue.map((item) => (
                                <tr key={item.id} className="border-t border-white/5">
                                  <td className="px-4 py-3 font-medium text-white">{item.controlId}</td>
                                  <td className="px-4 py-3 text-slate-300">{item.title}</td>
                                  <td className="px-4 py-3 text-slate-400">{item.family}</td>
                                </tr>
                              ))}
                              {detail.queue.length === 0 && (
                                <tr>
                                  <td className="px-4 py-6 text-slate-400" colSpan={3}>
                                    No controls queued yet. Add profiles or manual controls before finishing.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="panel-subtle">
                        <div className="flex items-center gap-2 text-white">
                          <Sparkles className="h-4 w-4 text-cyan-300" />
                          <span className="font-semibold">Created requirements</span>
                        </div>
                        <div className="mt-4 space-y-3">
                          {detail.createdRequirements.map((item) => (
                            <article key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-medium text-white">{item.title}</div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {item.sourceControlId} · {item.sourceName}
                                  </div>
                                </div>
                                <span className="badge-success">{item.status}</span>
                              </div>
                              <div className="mt-2 text-sm text-slate-300">{item.description}</div>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                                <span>Assignee: {item.assignee ?? 'Current user'}</span>
                                <span>Created {formatDate(item.createdAt)}</span>
                              </div>
                            </article>
                          ))}
                          {detail.createdRequirements.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-sm text-slate-400">
                              Created requirements will appear here after you finish the wizard and can then be attested, edited, or deleted.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-slate-400">
              Select a builder session or create one to start queuing policy requirements.
            </div>
          )}
        </section>
      </section>

      <section className="panel-subtle grid gap-4 md:grid-cols-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-cyan-300" />
          <div>
            <div className="font-medium text-white">Profile prerequisites</div>
            <div className="mt-2 text-sm text-slate-400">
              Security profiles and control catalogues must be loaded before the builder can queue mapped requirements.
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
          <div>
            <div className="font-medium text-white">Duplicate protection</div>
            <div className="mt-2 text-sm text-slate-400">
              Controls already present in the same policy context are skipped or rejected clearly to keep requirement sets clean.
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
          <div>
            <div className="font-medium text-white">After completion</div>
            <div className="mt-2 text-sm text-slate-400">
              Finished requirements remain editable after generation and are intended to flow into score-card and attestation workflows.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
