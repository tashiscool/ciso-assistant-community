import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Layers3,
  Save,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useEdgeIdentity } from '../../shared/session/identity';
import {
  applyRegmlAttempt,
  getRegmlWorkspace,
  runRegmlPrompt,
  updateRegmlSettings,
} from './api';
import type {
  RegmlAttempt,
  RegmlDeploymentMode,
  RegmlPromptMode,
  RegmlSession,
  RegmlWorkspace,
  RegmlWorkspaceMode,
} from './types';

type RegmlPane = 'hub' | 'author' | 'explainer' | 'ssp-author' | 'auditor' | 'ai-generator';

type Props = {
  initialPane?: RegmlPane;
};

const paneTitles: Record<RegmlPane, { title: string; description: string }> = {
  hub: {
    title: 'RegML (AI)',
    description:
      'RegScale-style AI and ML acceleration for compliance authoring, auditing, explainability, and first-draft generation across the canonical Cloudflare stack.',
  },
  author: {
    title: 'RegML Author',
    description:
      'Draft or improve control implementation statements with reviewable output that stays grounded in your plan, policy, and evidence context.',
  },
  explainer: {
    title: 'RegML Explainer',
    description:
      'Translate dense control requirements into plain-English guidance that helps reviewers and owners understand what a requirement is really asking for.',
  },
  'ssp-author': {
    title: 'RegML SSP Author',
    description:
      'Launch bulk authoring runs for security-plan content using policies, questionnaires, and uploaded source material.',
  },
  auditor: {
    title: 'RegML Auditor',
    description:
      'Evaluate completeness and AI-quality posture across security-plan content and prepare follow-up issue-generation decisions.',
  },
  'ai-generator': {
    title: 'AI Generator',
    description:
      'Generate first-pass narratives from questionnaire and inherited-control context, then compare versions before publishing.',
  },
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function availabilityBadgeClass(value: string) {
  if (value === 'Ready') return 'status-pill-success';
  if (value === 'Locked') return 'status-pill-danger';
  return 'status-pill-neutral';
}

function attemptStatusClass(value: string) {
  if (value === 'Applied') return 'status-pill-success';
  if (value === 'Needs Review') return 'status-pill-neutral';
  return 'status-pill-neutral';
}

function paneToMode(pane: RegmlPane): RegmlWorkspaceMode {
  if (pane === 'auditor') return 'Auditor';
  if (pane === 'ai-generator') return 'AI Generator';
  return 'SSP Author';
}

function getDefaultPromptForPane(pane: RegmlPane) {
  if (pane === 'author') {
    return 'Draft a first-pass implementation statement for encryption-at-rest controls in the production environment.';
  }

  if (pane === 'explainer') {
    return 'Explain in plain English why multi-factor authentication is required for privileged accounts.';
  }

  if (pane === 'auditor') {
    return 'Audit the current plan for weak implementation statements and identify controls that should generate issues.';
  }

  if (pane === 'ai-generator') {
    return 'Generate inherited-control language for shared cloud services based on completed onboarding questionnaires.';
  }

  return 'Generate control implementation statements for the selected plan using policy and questionnaire context.';
}

function getSelectedAttempt(session: RegmlSession | null) {
  if (!session) {
    return null;
  }

  return (
    session.attempts.find((attempt) => attempt.id === session.selectedAttemptId) ??
    session.attempts[0] ??
    null
  );
}

async function copyToClipboard(text: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    throw new Error('Clipboard access is not available in this browser.');
  }

  await navigator.clipboard.writeText(text);
}

function WorkspaceRunner({
  pane,
  session,
  promptDraft,
  setPromptDraft,
  promptMode,
  setPromptMode,
  sourceSet,
  setSourceSet,
  onRun,
  onApply,
  busy,
}: {
  pane: RegmlPane;
  session: RegmlSession;
  promptDraft: string;
  setPromptDraft: (value: string) => void;
  promptMode: RegmlPromptMode;
  setPromptMode: (value: RegmlPromptMode) => void;
  sourceSet: string;
  setSourceSet: (value: string) => void;
  onRun: () => void;
  onApply: (attemptId: string) => void;
  busy: string | null;
}) {
  const selectedAttempt = getSelectedAttempt(session);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <div className="panel-subtle">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Prompt Runner</div>
              <h2 className="mt-2 text-xl font-semibold text-[#241232]">{paneTitles[pane].title}</h2>
            </div>
            <button className="button-primary" disabled={busy !== null} onClick={onRun} type="button">
              <Sparkles className="mr-2 h-4 w-4" />
              {busy === 'run' ? 'Running...' : 'Run RegML'}
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="block space-y-2 md:col-span-2">
              <span className="label">Prompt</span>
              <textarea
                className="input min-h-[160px]"
                onChange={(event) => setPromptDraft(event.target.value)}
                placeholder={getDefaultPromptForPane(pane)}
                value={promptDraft}
              />
            </label>
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="label">Prompt Mode</span>
                <select
                  className="input"
                  onChange={(event) => setPromptMode(event.target.value as RegmlPromptMode)}
                  value={promptMode}
                >
                  <option value="Build">Build</option>
                  <option value="Plan">Plan</option>
                </select>
              </label>
              <label className="block space-y-2">
                <span className="label">Source Set</span>
                <select
                  className="input"
                  onChange={(event) => setSourceSet(event.target.value)}
                  value={sourceSet}
                >
                  {session.sourceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-2xl border border-[#ded8e4] bg-white p-4 text-sm text-[#4f435c]">
                <div className="label">Mode focus</div>
                <div className="mt-3 space-y-2">
                  {session.context.modeFocus.map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#126b36]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {selectedAttempt && (
          <div className="panel-subtle">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="eyebrow">Latest Version</div>
                <h3 className="mt-2 text-xl font-semibold text-[#241232]">{selectedAttempt.title}</h3>
              </div>
              <div className="flex gap-2">
                <span className={attemptStatusClass(selectedAttempt.status)}>{selectedAttempt.status}</span>
                <span className="status-pill-neutral">{selectedAttempt.versionLabel}</span>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
                <div className="label">Coverage</div>
                <div className="mt-2 text-2xl font-semibold text-[#241232]">{selectedAttempt.coverage}%</div>
              </div>
              <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
                <div className="label">Confidence</div>
                <div className="mt-2 text-2xl font-semibold text-[#241232]">{selectedAttempt.confidence}%</div>
              </div>
              <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
                <div className="label">Issues</div>
                <div className="mt-2 text-2xl font-semibold text-[#241232]">{selectedAttempt.issues}</div>
              </div>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
                <div className="label">Before</div>
                <div className="mt-3 space-y-2 text-sm text-[#4f435c]">
                  {selectedAttempt.beforeItems.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
                <div className="label">After</div>
                <div className="mt-3 space-y-2 text-sm text-[#4f435c]">
                  {selectedAttempt.afterItems.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="button-primary"
                disabled={busy !== null}
                onClick={() => onApply(selectedAttempt.id)}
                type="button"
              >
                <Save className="mr-2 h-4 w-4" />
                Apply Version
              </button>
              <span className="self-center text-xs uppercase tracking-[0.18em] text-[#62576a]">
                Human review remains required before publishing plan changes.
              </span>
            </div>
          </div>
        )}

        <div className="panel-subtle">
          <div className="eyebrow">Session Timeline</div>
          <div className="mt-4 space-y-3">
            {session.messages.length === 0 ? (
              <div className="text-sm text-[#6f6578]">No messages yet.</div>
            ) : (
              session.messages.map((message) => (
                <div key={message.id} className="rounded-2xl border border-[#ded8e4] bg-[#f6f1fa]5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-[#241232]">
                      {message.type === 'plan'
                        ? message.title
                        : message.type === 'warning'
                          ? message.title
                          : message.type === 'version'
                            ? 'Version created'
                            : message.role === 'user'
                              ? 'Prompt'
                              : 'Assistant'}
                    </div>
                    <div className="text-xs text-[#62576a]">{formatDate(message.createdAt)}</div>
                  </div>
                  {message.type === 'plan' ? (
                    <div className="mt-3 space-y-2 text-sm text-[#4f435c]">
                      {message.steps.map((step) => (
                        <div key={step}>{step}</div>
                      ))}
                    </div>
                  ) : message.type === 'warning' ? (
                    <div className="mt-3 text-sm text-[#8a4d00]">{message.content}</div>
                  ) : message.type === 'version' ? (
                    <div className="mt-3 text-sm text-[#4f435c]">Attempt ID: {message.attemptId}</div>
                  ) : (
                    <div className="mt-3 text-sm text-[#4f435c]">{message.content}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="panel-subtle">
          <div className="eyebrow">Runtime Posture</div>
          <div className="mt-4 space-y-3 text-sm text-[#4f435c]">
            <div className="flex items-center justify-between">
              <span>Credits remaining</span>
              <span className="font-medium text-[#241232]">
                {session.creditsRemaining} / {session.creditsQuota}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Queue depth</span>
              <span className="font-medium text-[#241232]">{session.queueDepth}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Last heartbeat</span>
              <span className="font-medium text-[#241232]">{formatDate(session.lastHeartbeat)}</span>
            </div>
          </div>
        </div>
        <div className="panel-subtle">
          <div className="eyebrow">Context Coverage</div>
          <div className="mt-4 space-y-2 text-sm text-[#4f435c]">
            {session.context.sourceCoverage.map((item) => (
              <div key={item} className="rounded-2xl border border-[#ded8e4] bg-white px-3 py-2">
                {item}
              </div>
            ))}
          </div>
          {session.context.issueThreshold !== null && (
            <div className="mt-4 rounded-2xl border border-[#ded8e4] bg-white px-3 py-2 text-sm text-[#4f435c]">
              Auditor issue threshold: <span className="font-medium text-[#241232]">{session.context.issueThreshold}</span>
            </div>
          )}
        </div>
        <div className="panel-subtle">
          <div className="eyebrow">Recent Versions</div>
          <div className="mt-4 space-y-3">
            {session.attempts.length === 0 ? (
              <div className="text-sm text-[#6f6578]">No version history yet.</div>
            ) : (
              session.attempts.map((attempt) => (
                <div key={attempt.id} className="rounded-2xl border border-[#ded8e4] bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-[#241232]">{attempt.versionLabel}</div>
                    <span className={attemptStatusClass(attempt.status)}>{attempt.status}</span>
                  </div>
                  <div className="mt-2 text-sm text-[#4f435c]">{attempt.title}</div>
                  <div className="mt-2 text-xs text-[#62576a]">{formatDate(attempt.createdAt)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

export function RegMLWorkspacePage({ initialPane = 'hub' }: Props) {
  const { identity } = useEdgeIdentity();
  const [workspace, setWorkspace] = useState<RegmlWorkspace | null>(null);
  const [activePane, setActivePane] = useState<RegmlPane>(initialPane);
  const [promptDraft, setPromptDraft] = useState('');
  const [promptMode, setPromptMode] = useState<RegmlPromptMode>('Build');
  const [sourceSet, setSourceSet] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [deploymentMode, setDeploymentMode] = useState<RegmlDeploymentMode>('SaaS');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setActivePane(initialPane);
  }, [initialPane]);

  async function loadWorkspace() {
    try {
      setLoading(true);
      setError(null);
      const next = await getRegmlWorkspace();
      setWorkspace(next);
      setEnabled(next.settings.enabled);
      setTermsAccepted(next.settings.termsAccepted);
      setDeploymentMode(next.settings.deploymentMode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load RegML.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [identity.tenantId, identity.userId]);

  const currentMode = paneToMode(activePane);
  const currentSession = workspace?.sessions[currentMode] ?? null;
  const selectedAttempt = getSelectedAttempt(currentSession);

  useEffect(() => {
    if (!currentSession) {
      return;
    }

    setPromptDraft(currentSession.prompt || getDefaultPromptForPane(activePane));
    setPromptMode(currentSession.promptMode);
    setSourceSet(currentSession.sourceSet || currentSession.sourceOptions[0] || '');
  }, [activePane, currentSession?.lastHeartbeat, currentSession?.prompt, currentSession?.promptMode, currentSession?.sourceSet]);

  const metrics = useMemo(() => {
    if (!workspace) {
      return [];
    }

    const totalAttempts = Object.values(workspace.sessions).reduce((total, session) => total + session.attempts.length, 0);

    return [
      {
        label: 'Policies',
        value: workspace.health.policiesCount,
        detail: 'Policy context available for grounded authoring.',
      },
      {
        label: 'Questionnaires',
        value: workspace.health.questionnairesCount,
        detail: 'Questionnaire templates available for AI Generator and SSP source selection.',
      },
      {
        label: 'Security Plans',
        value: workspace.health.securityPlansCount,
        detail: 'Plans available for SSP Author and Auditor workflows.',
      },
      {
        label: 'RegML Versions',
        value: totalAttempts,
        detail: 'Versioned RegML outputs stored in the canonical Worker runtime.',
      },
    ];
  }, [workspace]);

  async function handleSaveSettings() {
    try {
      setBusy('settings');
      setError(null);
      setNotice(null);
      const next = await updateRegmlSettings({
        enabled,
        termsAccepted,
        deploymentMode,
      });
      setWorkspace(next);
      setNotice('RegML platform settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save RegML settings.');
    } finally {
      setBusy(null);
    }
  }

  async function handleRun() {
    if (!workspace || !currentSession) {
      return;
    }

    try {
      setBusy('run');
      setError(null);
      setNotice(null);
      const next = await runRegmlPrompt(currentMode, {
        prompt: promptDraft.trim() || getDefaultPromptForPane(activePane),
        promptMode,
        sourceSet,
      });
      setWorkspace({
        ...workspace,
        sessions: {
          ...workspace.sessions,
          [currentMode]: next.session,
        },
      });
      setNotice(promptMode === 'Plan' ? 'RegML plan created.' : 'RegML version generated and ready for review.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run RegML.');
    } finally {
      setBusy(null);
    }
  }

  async function handleApply(attemptId: string) {
    if (!workspace) {
      return;
    }

    try {
      setBusy(`apply:${attemptId}`);
      setError(null);
      setNotice(null);
      const next = await applyRegmlAttempt(currentMode, attemptId);
      setWorkspace({
        ...workspace,
        sessions: {
          ...workspace.sessions,
          [currentMode]: next.session,
        },
      });
      setNotice('Selected RegML version applied to the active workspace.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to apply RegML version.');
    } finally {
      setBusy(null);
    }
  }

  async function handleCopyOutput(attempt: RegmlAttempt | null, mode: 'after' | 'summary') {
    if (!attempt) {
      return;
    }

    try {
      const content = mode === 'after' ? attempt.afterItems.join('\n') : attempt.summary.join('\n');
      await copyToClipboard(content);
      setNotice(mode === 'after' ? 'Generated statement copied.' : 'Explanation copied.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to copy output.');
    }
  }

  if (loading || !workspace || !currentSession) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading RegML...</div>;
  }

  const statusVariant =
    workspace.settings.statusLabel === 'Not Enabled'
      ? 'status-pill-danger'
      : workspace.settings.statusLabel === 'Pending Terms Acceptance'
        ? 'status-pill-neutral'
        : workspace.settings.statusLabel === 'Enabled without Workers AI runtime'
          ? 'status-pill-danger'
          : 'status-pill-success';

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="eyebrow">Features</div>
          <h1 className="mt-2 text-3xl font-semibold text-[#241232]">{paneTitles[activePane].title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">{paneTitles[activePane].description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className={statusVariant}>{workspace.settings.statusLabel}</span>
            <span className={workspace.settings.backendAvailable ? 'status-pill-success' : 'status-pill-danger'}>
              {workspace.settings.backendAvailable ? 'Backend available' : 'Backend unavailable'}
            </span>
            <span className="status-pill-neutral">{workspace.settings.runtimeProvider}</span>
            <span className={workspace.settings.chatbotVisible ? 'status-pill-success' : 'status-pill-neutral'}>
              {workspace.settings.chatbotVisible ? 'Chatbot visible' : 'Chatbot hidden'}
            </span>
          </div>
        </div>
        <div className="panel-subtle space-y-3">
          <div className="text-xs uppercase tracking-[0.22em] text-[#62576a]">Enablement</div>
          <div className="rounded-2xl border border-[#ded8e4] bg-white p-4">
            <div className="label">How to enable</div>
            <div className="mt-3 text-sm leading-6 text-[#4f435c]">{workspace.settings.saveInstructions}</div>
            <Link className="button-secondary mt-4 inline-flex" to={workspace.settings.modulesFeaturesPath}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Settings
            </Link>
          </div>
          <div className="rounded-2xl border border-[#ded8e4] bg-white p-4 text-sm text-[#4f435c]">
            Once enabled and accepted, RegML tools become available on supported records and the chatbot entry point appears in the workspace.
          </div>
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}
      {notice && <div className="notice-success">{notice}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="panel-subtle">
            <div className="text-xs uppercase tracking-[0.22em] text-[#62576a]">{metric.label}</div>
            <div className="mt-3 text-3xl font-semibold text-[#241232]">{metric.value}</div>
            <div className="mt-2 text-sm text-[#6f6578]">{metric.detail}</div>
          </article>
        ))}
      </section>

      <section className="panel grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="panel-subtle">
            <div className="eyebrow">Status & Deployment</div>
            <div className="mt-4 space-y-4 text-sm text-[#4f435c]">
              <label className="flex items-center justify-between gap-3">
                <span>RegML enabled</span>
                <input
                  checked={enabled}
                  className="h-4 w-4 rounded border-[#d7c3f1] bg-white"
                  onChange={(event) => setEnabled(event.target.checked)}
                  type="checkbox"
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>Terms accepted</span>
                <input
                  checked={termsAccepted}
                  className="h-4 w-4 rounded border-[#d7c3f1] bg-white"
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                  type="checkbox"
                />
              </label>
              <label className="block space-y-2">
                <span className="label">Deployment mode</span>
                <select
                  className="input"
                  onChange={(event) => setDeploymentMode(event.target.value as RegmlDeploymentMode)}
                  value={deploymentMode}
                >
                  <option value="SaaS">SaaS / Cloud</option>
                  <option value="Local">Local / Self Hosted</option>
                </select>
              </label>
              <button className="button-primary w-full" disabled={busy !== null} onClick={() => void handleSaveSettings()} type="button">
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </button>
            </div>
          </div>
          <div className="panel-subtle">
            <div className="eyebrow">{deploymentMode === 'Local' ? 'Local deployment guide' : 'SaaS deployment guide'}</div>
            <div className="mt-4 space-y-3 text-sm text-[#4f435c]">
              {(deploymentMode === 'Local' ? workspace.deploymentGuidance.local : workspace.deploymentGuidance.saas).map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#126b36]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel-subtle">
            <div className="eyebrow">Feature Launch</div>
            <div className="mt-4 space-y-3">
              {workspace.features.map((feature) => (
                <Link
                  key={feature.id}
                  className="block rounded-2xl border border-[#ded8e4] bg-white p-4 transition hover:border-[#d7c3f1]"
                  to={feature.route}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-[#241232]">{feature.name}</div>
                      <div className="mt-1 text-sm text-[#6f6578]">{feature.description}</div>
                    </div>
                    <span className={availabilityBadgeClass(feature.availability)}>{feature.availability}</span>
                  </div>
                  <div className="mt-3 text-xs uppercase tracking-[0.18em] text-[#62576a]">{feature.supportedContext}</div>
                </Link>
              ))}
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          <Tabs onValueChange={(value) => setActivePane(value as RegmlPane)} value={activePane}>
            <TabsList className="grid w-full grid-cols-3 xl:grid-cols-6">
              <TabsTrigger value="hub">Hub</TabsTrigger>
              <TabsTrigger value="author">Author</TabsTrigger>
              <TabsTrigger value="explainer">Explainer</TabsTrigger>
              <TabsTrigger value="ssp-author">SSP Author</TabsTrigger>
              <TabsTrigger value="auditor">Auditor</TabsTrigger>
              <TabsTrigger value="ai-generator">AI Generator</TabsTrigger>
            </TabsList>

            <TabsContent value="hub" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="panel-subtle">
                  <div className="eyebrow">Control AI Features</div>
                  <div className="mt-4 grid gap-3">
                    {workspace.features
                      .filter((feature) => feature.id === 'author' || feature.id === 'explainer')
                      .map((feature) => (
                        <Link key={feature.id} className="rounded-2xl border border-[#ded8e4] bg-white p-4 transition hover:border-[#d7c3f1]" to={feature.route}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-[#241232]">{feature.name}</div>
                              <div className="mt-1 text-sm text-[#6f6578]">{feature.description}</div>
                            </div>
                            <span className={availabilityBadgeClass(feature.availability)}>{feature.availability}</span>
                          </div>
                        </Link>
                      ))}
                  </div>
                </div>
                <div className="panel-subtle">
                  <div className="eyebrow">SSP AI Features</div>
                  <div className="mt-4 grid gap-3">
                    {workspace.features
                      .filter((feature) => feature.id === 'ssp-author' || feature.id === 'auditor' || feature.id === 'ai-generator')
                      .map((feature) => (
                        <Link key={feature.id} className="rounded-2xl border border-[#ded8e4] bg-white p-4 transition hover:border-[#d7c3f1]" to={feature.route}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-[#241232]">{feature.name}</div>
                              <div className="mt-1 text-sm text-[#6f6578]">{feature.description}</div>
                            </div>
                            <span className={availabilityBadgeClass(feature.availability)}>{feature.availability}</span>
                          </div>
                        </Link>
                      ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="panel-subtle">
                  <div className="eyebrow">Availability messaging</div>
                  <div className="mt-4 space-y-3 text-sm text-[#4f435c]">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#126b36]" />
                      <span>Once enabled, RegML tools become available for supported records and plan-level workflows.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Bot className="mt-0.5 h-4 w-4 text-[#7a3ccf]" />
                      <span>The chatbot entry point appears when RegML is enabled and terms are accepted.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-[#8a4d00]" />
                      <span>Disabling RegML hides record-context tools and removes the chatbot entry point until re-enabled.</span>
                    </div>
                  </div>
                </div>
                <div className="panel-subtle">
                  <div className="eyebrow">Dependencies</div>
                  <div className="mt-4 space-y-3 text-sm text-[#4f435c]">
                    <div className="flex items-center justify-between">
                      <span>Policies available</span>
                      <span className={workspace.health.policiesCount > 0 ? 'status-pill-success' : 'status-pill-danger'}>
                        {workspace.health.policiesCount > 0 ? 'Ready' : 'Missing'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Questionnaires available</span>
                      <span className={workspace.health.questionnairesCount > 0 ? 'status-pill-success' : 'status-pill-danger'}>
                        {workspace.health.questionnairesCount > 0 ? 'Ready' : 'Missing'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Environment healthy</span>
                      <span className={workspace.health.environmentHealthy ? 'status-pill-success' : 'status-pill-danger'}>
                        {workspace.health.environmentHealthy ? 'Healthy' : 'Attention'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Vector database deployed</span>
                      <span className={workspace.health.vectorDatabaseDeployed ? 'status-pill-success' : 'status-pill-danger'}>
                        {workspace.health.vectorDatabaseDeployed ? 'Ready' : 'Missing'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="author" className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="panel-subtle">
                  <div className="eyebrow">Control Context</div>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-[#ded8e4] bg-white p-4">
                      <div className="label">Control</div>
                      <div className="mt-2 text-lg font-semibold text-[#241232]">SC-13 Cryptographic Protection</div>
                      <div className="mt-2 text-sm text-[#4f435c]">
                        The system protects the confidentiality and integrity of transmitted and stored information using approved cryptographic mechanisms.
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#ded8e4] bg-white p-4 text-sm text-[#4f435c]">
                      Use RegML Author to draft a first-pass statement or improve an existing one before you insert it into the control implementation.
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <WorkspaceRunner
                    busy={busy}
                    onApply={(attemptId) => void handleApply(attemptId)}
                    onRun={() => void handleRun()}
                    pane={activePane}
                    promptDraft={promptDraft}
                    promptMode={promptMode}
                    session={currentSession}
                    setPromptDraft={setPromptDraft}
                    setPromptMode={setPromptMode}
                    setSourceSet={setSourceSet}
                    sourceSet={sourceSet}
                  />
                  {selectedAttempt && (
                    <div className="panel-subtle">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="eyebrow">Author Actions</div>
                          <div className="mt-2 text-lg font-semibold text-[#241232]">Reviewable AI-assist output</div>
                        </div>
                        <div className="flex gap-2">
                          <button className="button-secondary" onClick={() => void handleCopyOutput(selectedAttempt, 'after')} type="button">
                            <Copy className="mr-2 h-4 w-4" />
                            Copy
                          </button>
                          <button className="button-primary" disabled={busy !== null} onClick={() => void handleApply(selectedAttempt.id)} type="button">
                            <Wand2 className="mr-2 h-4 w-4" />
                            Use This Statement
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="explainer" className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="panel-subtle">
                  <div className="eyebrow">Original Control</div>
                  <div className="mt-4 rounded-2xl border border-[#ded8e4] bg-white p-4">
                    <div className="text-lg font-semibold text-[#241232]">IA-2 Multi-Factor Authentication</div>
                    <div className="mt-2 text-sm leading-6 text-[#4f435c]">
                      Multi-factor authentication must be enabled for all privileged accounts to prevent unauthorized access and reduce the impact of credential compromise.
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-[#ded8e4] bg-white p-4 text-sm text-[#4f435c]">
                    Explainer output aids understanding and decision support, but it does not replace expert interpretation or assessor review.
                  </div>
                </div>
                <div className="space-y-6">
                  <WorkspaceRunner
                    busy={busy}
                    onApply={(attemptId) => void handleApply(attemptId)}
                    onRun={() => void handleRun()}
                    pane={activePane}
                    promptDraft={promptDraft}
                    promptMode={promptMode}
                    session={currentSession}
                    setPromptDraft={setPromptDraft}
                    setPromptMode={setPromptMode}
                    setSourceSet={setSourceSet}
                    sourceSet={sourceSet}
                  />
                  {selectedAttempt && (
                    <div className="panel-subtle">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="eyebrow">Explainer Output</div>
                          <div className="mt-2 text-lg font-semibold text-[#241232]">Plain-language takeaways</div>
                        </div>
                        <button className="button-secondary" onClick={() => void handleCopyOutput(selectedAttempt, 'summary')} type="button">
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Explanation
                        </button>
                      </div>
                      <div className="mt-4 space-y-2 text-sm text-[#4f435c]">
                        {selectedAttempt.summary.map((item) => (
                          <div key={item} className="rounded-2xl border border-[#ded8e4] bg-white px-3 py-2">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="ssp-author">
              <WorkspaceRunner
                busy={busy}
                onApply={(attemptId) => void handleApply(attemptId)}
                onRun={() => void handleRun()}
                pane={activePane}
                promptDraft={promptDraft}
                promptMode={promptMode}
                session={currentSession}
                setPromptDraft={setPromptDraft}
                setPromptMode={setPromptMode}
                setSourceSet={setSourceSet}
                sourceSet={sourceSet}
              />
            </TabsContent>

            <TabsContent value="auditor">
              <WorkspaceRunner
                busy={busy}
                onApply={(attemptId) => void handleApply(attemptId)}
                onRun={() => void handleRun()}
                pane={activePane}
                promptDraft={promptDraft}
                promptMode={promptMode}
                session={currentSession}
                setPromptDraft={setPromptDraft}
                setPromptMode={setPromptMode}
                setSourceSet={setSourceSet}
                sourceSet={sourceSet}
              />
            </TabsContent>

            <TabsContent value="ai-generator">
              <WorkspaceRunner
                busy={busy}
                onApply={(attemptId) => void handleApply(attemptId)}
                onRun={() => void handleRun()}
                pane={activePane}
                promptDraft={promptDraft}
                promptMode={promptMode}
                session={currentSession}
                setPromptDraft={setPromptDraft}
                setPromptMode={setPromptMode}
                setSourceSet={setSourceSet}
                sourceSet={sourceSet}
              />
            </TabsContent>
          </Tabs>

          <section className="grid gap-4 md:grid-cols-3">
            <Link className="panel-subtle transition hover:border-[#d7c3f1]" to="/response-automation">
              <Bot className="h-5 w-5 text-[#7a3ccf]" />
              <div className="mt-4 text-lg font-semibold text-[#241232]">Response Automation</div>
              <div className="mt-2 text-sm text-[#6f6578]">Launch grounded questionnaire-answering jobs from internal sources.</div>
            </Link>
            <Link className="panel-subtle transition hover:border-[#d7c3f1]" to="/evidence-mapping">
              <Layers3 className="h-5 w-5 text-[#7a3ccf]" />
              <div className="mt-4 text-lg font-semibold text-[#241232]">Evidence Mapping</div>
              <div className="mt-2 text-sm text-[#6f6578]">Map evidence to plans, controls, and components with recommendation support.</div>
            </Link>
            <Link className="panel-subtle transition hover:border-[#d7c3f1]" to="/ai-policy-builder">
              <FileText className="h-5 w-5 text-[#7a3ccf]" />
              <div className="mt-4 text-lg font-semibold text-[#241232]">AI Policy Builder</div>
              <div className="mt-2 text-sm text-[#6f6578]">Generate policy requirements from profiles and catalogue context.</div>
            </Link>
          </section>
        </section>
      </section>
    </div>
  );
}

export function RegMLPage() {
  return <RegMLWorkspacePage initialPane="hub" />;
}

export function RegMLAuthorPage() {
  return <RegMLWorkspacePage initialPane="author" />;
}

export function RegMLExplainerPage() {
  return <RegMLWorkspacePage initialPane="explainer" />;
}

export function RegMLSSPAuthorPage() {
  return <RegMLWorkspacePage initialPane="ssp-author" />;
}

export function RegMLAuditorPage() {
  return <RegMLWorkspacePage initialPane="auditor" />;
}

export function RegMLAIGeneratorPage() {
  return <RegMLWorkspacePage initialPane="ai-generator" />;
}
