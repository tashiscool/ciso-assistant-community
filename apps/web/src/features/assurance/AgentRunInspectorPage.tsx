import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  approveWriteback,
  explainAssurance,
  getAgentArtifactPreview,
  getAgentRun,
  getAgentTrace,
  listAgentRuns,
  rejectWriteback,
} from './api';
import { AssuranceExplainPanel } from './AssuranceExplainPanel';
import { AssuranceWorkflowPanel } from './AssuranceWorkflowPanel';
import type { AgentRunDetail, AgentRunListItem, AgentRunTrace, AssuranceArtifactPreview, AssuranceExplainAudience, WritebackApproval } from './types';
import { useEdgeIdentity } from '../../shared/session/identity';

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString();
}

function toPreview(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function humanizeKey(value: string | null | undefined) {
  if (!value) {
    return '—';
  }
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatBytes(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    return '—';
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function isExplainAudience(value: string | null): value is AssuranceExplainAudience {
  return value === 'derivation' || value === 'remediation' || value === 'executive';
}

function isAgentArtifactFamily(value: string | null) {
  return (
    value === 'trace_json' ||
    value === 'summary_markdown' ||
    value === 'task_graph' ||
    value === 'agent_eval_results' ||
    value === 'agent_risk_report' ||
    value === 'agent_poam' ||
    value === 'workflow_memory' ||
    value === 'agent_instrumentation_plan' ||
    value === 'secure_agent_architecture' ||
    value === 'blocked_actions' ||
    value === 'writeback_requests'
  );
}

export function AgentRunInspectorPage() {
  const { identity } = useEdgeIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const [runs, setRuns] = useState<AgentRunListItem[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [detail, setDetail] = useState<AgentRunDetail | null>(null);
  const [trace, setTrace] = useState<AgentRunTrace | null>(null);
  const [previewFamily, setPreviewFamily] = useState('trace_json');
  const [previewState, setPreviewState] = useState<AssuranceArtifactPreview | null>(null);
  const [preview, setPreview] = useState<unknown>(null);
  const [selectedStepId, setSelectedStepId] = useState('');
  const [selectedPolicyDecisionId, setSelectedPolicyDecisionId] = useState('');
  const [selectedWritebackId, setSelectedWritebackId] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [approvalNote, setApprovalNote] = useState('Validated by reviewer after trace inspection.');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestedRunId = searchParams.get('runId') ?? '';
  const requestedArtifactFamily = searchParams.get('artifact');
  const requestedStepId = searchParams.get('stepId') ?? '';
  const requestedPolicyDecisionId = searchParams.get('policyId') ?? '';
  const requestedWritebackId = searchParams.get('writebackId') ?? '';
  const requestedAudience = searchParams.get('audience');

  function updateSearchState(updates: {
    runId?: string | null;
    artifact?: string | null;
    stepId?: string | null;
    policyId?: string | null;
    writebackId?: string | null;
    audience?: AssuranceExplainAudience | null;
  }) {
    const next = new URLSearchParams(searchParams);
    const entries = [
      ['runId', updates.runId],
      ['artifact', updates.artifact],
      ['stepId', updates.stepId],
      ['policyId', updates.policyId],
      ['writebackId', updates.writebackId],
      ['audience', updates.audience],
    ] as const;
    for (const [key, value] of entries) {
      if (value === undefined) {
        continue;
      }
      if (!value) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    setSearchParams(next, { replace: true });
  }

  function selectPreviewFamily(nextFamily: string) {
    setPreviewFamily(nextFamily);
    updateSearchState({ artifact: nextFamily });
  }

  async function loadRuns() {
    try {
      setLoading(true);
      setError(null);
      const data = await listAgentRuns();
      setRuns(data);
      setSelectedRunId((current) => {
        if (requestedRunId && data.some((item) => item.id === requestedRunId)) {
          return requestedRunId;
        }
        return current || data[0]?.id || '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load assurance agent runs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRuns();
  }, [identity.tenantId, identity.userId, requestedRunId]);

  useEffect(() => {
    if (!requestedRunId || requestedRunId === selectedRunId) {
      return;
    }
    if (runs.some((item) => item.id === requestedRunId)) {
      setSelectedRunId(requestedRunId);
    }
  }, [requestedRunId, runs, selectedRunId]);

  useEffect(() => {
    const current = searchParams.get('runId') ?? '';
    if (current === selectedRunId || (!current && !selectedRunId)) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (selectedRunId) {
      next.set('runId', selectedRunId);
    } else {
      next.delete('runId');
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, selectedRunId, setSearchParams]);

  useEffect(() => {
    if (!selectedRunId) {
      setDetail(null);
      setTrace(null);
      setPreviewState(null);
      setPreview(null);
      setSelectedStepId('');
      setSelectedPolicyDecisionId('');
      setSelectedWritebackId('');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        setDetailLoading(true);
        const [runDetail, runTrace] = await Promise.all([
          getAgentRun(selectedRunId),
          getAgentTrace(selectedRunId),
        ]);
        if (!cancelled) {
          setDetail(runDetail);
          setTrace(runTrace);
          setPreviewFamily(isAgentArtifactFamily(requestedArtifactFamily) ? requestedArtifactFamily : 'trace_json');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load the assurance agent run.');
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedRunId]);

  useEffect(() => {
    if (!selectedRunId) {
      setPreviewState(null);
      setPreview(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const artifact = await getAgentArtifactPreview(selectedRunId, previewFamily);
        if (!cancelled) {
          setPreviewState(artifact);
          setPreview(artifact.preview);
        }
      } catch {
        if (!cancelled) {
          setPreviewState(null);
          setPreview(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [previewFamily, selectedRunId]);

  const pendingWritebacks = useMemo(
    () => detail?.writebacks.filter((item) => item.status === 'pending') ?? [],
    [detail],
  );
  const selectedPreviewItem = useMemo(
    () => previewState?.items[0] ?? null,
    [previewState],
  );
  const selectedStep = useMemo(
    () => trace?.steps.find((item) => item.id === selectedStepId) ?? null,
    [selectedStepId, trace],
  );
  const selectedPolicyDecision = useMemo(
    () => trace?.policyDecisions.find((item) => item.id === selectedPolicyDecisionId) ?? null,
    [selectedPolicyDecisionId, trace],
  );
  const selectedWriteback = useMemo(
    () => detail?.writebacks.find((item) => item.id === selectedWritebackId) ?? null,
    [detail, selectedWritebackId],
  );

  useEffect(() => {
    const availableStepIds = trace?.steps.map((item) => item.id) ?? [];
    setSelectedStepId((current) => {
      if (requestedStepId && availableStepIds.includes(requestedStepId)) {
        return requestedStepId;
      }
      if (current && availableStepIds.includes(current)) {
        return current;
      }
      return availableStepIds[0] ?? '';
    });
  }, [requestedStepId, trace]);

  useEffect(() => {
    const availableDecisionIds = trace?.policyDecisions.map((item) => item.id) ?? [];
    setSelectedPolicyDecisionId((current) => {
      if (requestedPolicyDecisionId && availableDecisionIds.includes(requestedPolicyDecisionId)) {
        return requestedPolicyDecisionId;
      }
      if (current && availableDecisionIds.includes(current)) {
        return current;
      }
      return availableDecisionIds[0] ?? '';
    });
  }, [requestedPolicyDecisionId, trace]);

  useEffect(() => {
    const availableWritebackIds = detail?.writebacks.map((item) => item.id) ?? [];
    setSelectedWritebackId((current) => {
      if (requestedWritebackId && availableWritebackIds.includes(requestedWritebackId)) {
        return requestedWritebackId;
      }
      if (current && availableWritebackIds.includes(current)) {
        return current;
      }
      return availableWritebackIds[0] ?? '';
    });
  }, [detail, requestedWritebackId]);

  useEffect(() => {
    if (!isAgentArtifactFamily(requestedArtifactFamily)) {
      return;
    }
    if (requestedArtifactFamily !== previewFamily) {
      setPreviewFamily(requestedArtifactFamily);
    }
  }, [previewFamily, requestedArtifactFamily]);

  useEffect(() => {
    const current = searchParams.get('artifact') ?? '';
    if (current === previewFamily || (!current && !previewFamily)) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (previewFamily) {
      next.set('artifact', previewFamily);
    } else {
      next.delete('artifact');
    }
    setSearchParams(next, { replace: true });
  }, [previewFamily, searchParams, setSearchParams]);

  useEffect(() => {
    const current = searchParams.get('stepId') ?? '';
    if (current === selectedStepId || (!current && !selectedStepId)) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (selectedStepId) {
      next.set('stepId', selectedStepId);
    } else {
      next.delete('stepId');
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, selectedStepId, setSearchParams]);

  useEffect(() => {
    const current = searchParams.get('policyId') ?? '';
    if (current === selectedPolicyDecisionId || (!current && !selectedPolicyDecisionId)) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (selectedPolicyDecisionId) {
      next.set('policyId', selectedPolicyDecisionId);
    } else {
      next.delete('policyId');
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, selectedPolicyDecisionId, setSearchParams]);

  useEffect(() => {
    const current = searchParams.get('writebackId') ?? '';
    if (current === selectedWritebackId || (!current && !selectedWritebackId)) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (selectedWritebackId) {
      next.set('writebackId', selectedWritebackId);
    } else {
      next.delete('writebackId');
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, selectedWritebackId, setSearchParams]);

  async function handleWritebackDecision(writeback: WritebackApproval, decision: 'approve' | 'reject') {
    try {
      setBusyAction(`${decision}:${writeback.id}`);
      setError(null);
      setNotice(null);
      if (decision === 'approve') {
        const result = await approveWriteback(writeback.id, approvalNote);
        setNotice(`Writeback ${result.approvalId} approved as integration run ${result.integrationRunId}.`);
      } else {
        const result = await rejectWriteback(writeback.id, approvalNote);
        setNotice(`Writeback ${result.approvalId} rejected.`);
      }
      const [runDetail, runTrace, nextRuns] = await Promise.all([
        getAgentRun(selectedRunId),
        getAgentTrace(selectedRunId),
        listAgentRuns(),
      ]);
      setDetail(runDetail);
      setTrace(runTrace);
      setRuns(nextRuns);
      setSelectedWritebackId(writeback.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update the writeback decision.');
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Assurance</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Agent Run Inspector</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Inspect bounded assurance-agent traces, policy decisions, and approval-gated writebacks without leaving the workspace.
        </p>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <section className="space-y-3">
          <div className="panel">
            <div className="flex items-center justify-between">
              <div>
                <div className="label">Agent runs</div>
                <div className="mt-1 text-sm text-slate-400">Completed runs and their current approval posture.</div>
              </div>
              <button className="button-secondary" onClick={() => void loadRuns()} type="button">
                Refresh
              </button>
            </div>
          </div>

          {runs.map((item) => (
            <button
              key={item.id}
              className={`panel w-full text-left transition ${selectedRunId === item.id ? 'border-cyan-400/30 bg-cyan-400/10' : ''}`}
              onClick={() => {
                setSelectedRunId(item.id);
                updateSearchState({
                  runId: item.id,
                  stepId: null,
                  policyId: null,
                  writebackId: null,
                });
              }}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="eyebrow">{item.workflowName}</div>
                  <h2 className="mt-2 text-lg font-semibold text-white">{item.status}</h2>
                  <div className="mt-2 font-mono text-xs text-cyan-200">{item.id}</div>
                </div>
                <span className="badge-neutral">{item.pendingWritebackCount} pending</span>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                <div>Created: {formatDate(item.createdAt)}</div>
                <div>Evidence: {item.evidenceJobId ?? '—'}</div>
                <div>Approvals: {item.approvalCount}</div>
                <div>Requested writebacks: {item.requestedWritebacks ? 'yes' : 'no'}</div>
              </div>
            </button>
          ))}

          {!loading && runs.length === 0 && (
            <div className="panel text-sm text-slate-400">No assurance agent runs are available yet.</div>
          )}
          {loading && <div className="panel text-sm text-slate-400">Loading agent runs...</div>}
        </section>

        <section className="space-y-4">
          {detailLoading && <div className="panel text-sm text-slate-400">Loading agent run detail...</div>}

          {detail && trace && (
            <>
              <section className="panel">
                <div className="label">Selected run</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">{trace.workflowName}</h2>
                <div className="mt-2 font-mono text-xs text-cyan-200">{detail.id}</div>
                <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
                  <div>Generated: {formatDate(trace.generatedAt)}</div>
                  <div>Status: {trace.status}</div>
                  <div>
                    Evidence job:{' '}
                    {trace.evidenceJobId ? (
                      <Link className="font-mono text-cyan-200 transition hover:text-cyan-100" to={`/assurance/evidence?evidenceJobId=${encodeURIComponent(trace.evidenceJobId)}`}>
                        {trace.evidenceJobId}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </div>
                  <div>Import job: {trace.importJobId ?? '—'}</div>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="metric-card">
                  <div className="metric-label">Steps</div>
                  <div className="metric-value">{trace.steps.length}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Blocked actions</div>
                  <div className="metric-value">{trace.policyDecisions.filter((item) => !item.allowed).length}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Pending writebacks</div>
                  <div className="metric-value">{pendingWritebacks.length}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Open gaps</div>
                  <div className="metric-value">{String(trace.summary.openGaps ?? 0)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Threat hunt</div>
                  <div className="metric-value">{String(trace.summary.threatHuntFindingCount ?? 0)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Validation</div>
                  <div className="metric-value text-base">{String(trace.summary.validationStatus ?? 'unknown')}</div>
                </div>
              </section>

              <AssuranceWorkflowPanel
                disabledMessage="Select an agent run to load its workflow activity."
                emptyMessage="No workflow runs are linked to this agent run yet."
                helperText="See the agent run itself, approval-gated writeback decisions, and related package or evidence workflow events."
                linkedRecordIds={[
                  selectedRunId,
                  trace.evidenceJobId ?? '',
                  typeof detail.summary.packageJobId === 'string' ? detail.summary.packageJobId : '',
                ]}
              />

              <AssuranceExplainPanel
                audiences={[
                  { value: 'derivation', label: 'Derivation trace' },
                  { value: 'remediation', label: 'Remediation focus' },
                  { value: 'executive', label: 'Executive summary' },
                ]}
                defaultAudience="derivation"
                disabled={!trace.evidenceJobId}
                heading="Run explainer"
                initialAudience={isExplainAudience(requestedAudience) ? requestedAudience : 'derivation'}
                helperText="Ground the bounded agent run in the same deterministic evidence bundle, then explain what the agent concluded and why external writebacks were held for review."
                loadExplanation={({ audience, question }) =>
                  explainAssurance({
                    audience,
                    evidenceJobId: trace.evidenceJobId ?? undefined,
                    question,
                  })
                }
                onAudienceChange={(audience) => updateSearchState({ audience })}
                requestKey={`${selectedRunId}:${trace.generatedAt}`}
              />

              <section className="grid gap-4 xl:grid-cols-2">
                <section className="panel-subtle">
                  <div className="label">Execution trace</div>
                  <div className="mt-3 space-y-2">
                    {trace.steps.map((step) => (
                      <button
                        key={step.id}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                          selectedStepId === step.id
                            ? 'border-cyan-300/30 bg-cyan-400/[0.06]'
                            : 'border-white/8 bg-black/15 hover:border-cyan-300/20 hover:bg-cyan-400/[0.03]'
                        }`}
                        onClick={() => {
                          setSelectedStepId(step.id);
                          updateSearchState({ stepId: step.id });
                        }}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-white">
                            {step.order}. {step.actionId}
                          </div>
                          <span className="badge-neutral">{step.status}</span>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">{step.actionCategory}</div>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="panel-subtle">
                  <div className="label">Policy decisions</div>
                  <div className="mt-3 space-y-2">
                    {trace.policyDecisions.map((decision) => (
                      <button
                        key={decision.id}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                          selectedPolicyDecisionId === decision.id
                            ? 'border-cyan-300/30 bg-cyan-400/[0.06]'
                            : 'border-white/8 bg-black/15 hover:border-cyan-300/20 hover:bg-cyan-400/[0.03]'
                        }`}
                        onClick={() => {
                          setSelectedPolicyDecisionId(decision.id);
                          updateSearchState({ policyId: decision.id });
                        }}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-white">{decision.actionId}</div>
                          <span className={decision.allowed ? 'badge-success' : 'badge-danger'}>
                            {decision.allowed ? 'allowed' : 'blocked'}
                          </span>
                        </div>
                        <div className="mt-2 text-xs leading-5 text-slate-400">{decision.reason}</div>
                      </button>
                    ))}
                  </div>
                </section>
              </section>

              <section className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
                <section className="panel-subtle">
                  <div className="label">Selected trace step</div>
                  {selectedStep ? (
                    <div className="mt-3 space-y-4">
                      <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-white">
                              {selectedStep.order}. {selectedStep.actionId}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">{selectedStep.actionCategory}</div>
                          </div>
                          <span className="badge-neutral">{selectedStep.status}</span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
                          <div>Started: {formatDate(selectedStep.startedAt)}</div>
                          <div>Finished: {formatDate(selectedStep.finishedAt)}</div>
                        </div>
                      </div>
                      <pre className="max-h-[320px] overflow-auto rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-xs leading-6 text-slate-300">
                        {toPreview({
                          input: selectedStep.input,
                          output: selectedStep.output,
                        })}
                      </pre>
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-slate-400">Select a trace step to inspect its input and output payloads.</div>
                  )}
                </section>

                <section className="panel-subtle">
                  <div className="label">Selected policy decision</div>
                  {selectedPolicyDecision ? (
                    <div className="mt-3 space-y-4">
                      <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-white">{selectedPolicyDecision.actionId}</div>
                            <div className="mt-1 text-xs text-slate-500">{humanizeKey(selectedPolicyDecision.category)}</div>
                          </div>
                          <span className={selectedPolicyDecision.allowed ? 'badge-success' : 'badge-danger'}>
                            {selectedPolicyDecision.allowed ? 'Allowed' : 'Blocked'}
                          </span>
                        </div>
                        <div className="mt-3 text-sm leading-6 text-slate-300">{selectedPolicyDecision.reason}</div>
                      </div>
                      <pre className="max-h-[320px] overflow-auto rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-xs leading-6 text-slate-300">
                        {toPreview(selectedPolicyDecision.detail)}
                      </pre>
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-slate-400">Select a policy decision to inspect the bounded-agent governance detail.</div>
                  )}
                </section>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <section className="panel-subtle">
                  <div className="label">Agent artifact preview</div>
                  <select className="input mt-3" onChange={(event) => selectPreviewFamily(event.target.value)} value={previewFamily}>
                    <option value="trace_json">trace_json</option>
                    <option value="summary_markdown">summary_markdown</option>
                    <option value="task_graph">task_graph</option>
                    <option value="agent_eval_results">agent_eval_results</option>
                    <option value="agent_risk_report">agent_risk_report</option>
                    <option value="agent_poam">agent_poam</option>
                    <option value="workflow_memory">workflow_memory</option>
                    <option value="agent_instrumentation_plan">agent_instrumentation_plan</option>
                    <option value="secure_agent_architecture">secure_agent_architecture</option>
                    <option value="blocked_actions">blocked_actions</option>
                    <option value="writeback_requests">writeback_requests</option>
                  </select>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Retrieval</div>
                      <div className="mt-2 font-medium text-white">{previewState?.retrieval.kind ?? 'preview'}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {previewState?.retrieval.previewAvailable === false ? 'Preview unavailable' : 'Preview available'}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Artifact family</div>
                      <div className="mt-2 font-medium text-white">{previewState?.family ?? previewFamily}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {previewState?.items.length ?? 0} object{(previewState?.items.length ?? 0) === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm sm:col-span-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Object key</div>
                      <div className="mt-2 break-all font-mono text-xs text-cyan-200">{selectedPreviewItem?.objectKey ?? 'No object metadata loaded.'}</div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>{selectedPreviewItem?.contentType ?? 'unknown content type'}</span>
                        <span>{formatBytes(selectedPreviewItem?.sizeBytes ?? null)}</span>
                        {selectedPreviewItem?.createdAt ? <span>{formatDate(selectedPreviewItem.createdAt)}</span> : null}
                      </div>
                    </div>
                  </div>
                  <pre className="mt-4 max-h-[460px] overflow-auto rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-xs leading-6 text-slate-300">
                    {preview ? toPreview(preview) : 'No preview is available for the selected agent artifact.'}
                  </pre>
                </section>

                <section className="panel-subtle">
                  <div className="label">Run summary</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Workflow</div>
                      <div className="mt-2 font-medium text-white">{detail.workflowName}</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Requested writebacks</div>
                      <div className="mt-2 font-medium text-white">{detail.requestedWritebacks ? 'Enabled' : 'Disabled'}</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Package job</div>
                      {typeof detail.summary.packageJobId === 'string' ? (
                        <Link
                          className="mt-2 block font-mono text-xs text-cyan-200 transition hover:text-cyan-100"
                          to={`/assurance/packages?packageId=${encodeURIComponent(detail.summary.packageJobId)}`}
                        >
                          {detail.summary.packageJobId}
                        </Link>
                      ) : (
                        <div className="mt-2 font-mono text-xs text-slate-400">—</div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Workflow rationale</div>
                      <div className="mt-2 text-sm leading-6 text-slate-300">{String(detail.summary.workflowRationale ?? '—')}</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Awaiting review reasons</div>
                      <div className="mt-2 text-sm leading-6 text-slate-300">
                        {Array.isArray(detail.summary.awaitingReviewReasons) && detail.summary.awaitingReviewReasons.length > 0
                          ? detail.summary.awaitingReviewReasons.join(', ')
                          : '—'}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Trace artifact</div>
                      <div className="mt-2 font-mono text-xs text-slate-400">{detail.traceKey ?? '—'}</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Summary artifact</div>
                      <div className="mt-2 font-mono text-xs text-slate-400">{detail.summaryKey ?? '—'}</div>
                    </div>
                  </div>
                </section>
              </section>

              <section className="panel-subtle">
                <div className="label">Writeback approvals</div>
                <label className="mt-3 block space-y-1">
                  <span className="label">Reviewer note</span>
                  <textarea
                    className="input min-h-[110px]"
                    onChange={(event) => setApprovalNote(event.target.value)}
                    value={approvalNote}
                  />
                </label>
                <div className="mt-4 space-y-2">
                  {detail.writebacks.map((item) => (
                    <button
                      key={item.id}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                        selectedWritebackId === item.id
                          ? 'border-cyan-300/30 bg-cyan-400/[0.06]'
                          : 'border-white/8 bg-black/15 hover:border-cyan-300/20 hover:bg-cyan-400/[0.03]'
                      }`}
                      onClick={() => {
                        setSelectedWritebackId(item.id);
                        updateSearchState({ writebackId: item.id });
                      }}
                      type="button"
                    >
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-white">{item.requestType}</div>
                            <span className="badge-neutral">{item.status}</span>
                          </div>
                          <div className="mt-2 font-mono text-xs text-cyan-200">{item.id}</div>
                          <div className="mt-2 text-xs leading-5 text-slate-400">
                            Connector: {item.connectorId ?? '—'} · Evidence refs: {item.evidenceRefs.join(', ') || '—'}
                          </div>
                          {item.integrationRunId && (
                            <div className="mt-2 font-mono text-xs text-slate-500">Integration run: {item.integrationRunId}</div>
                          )}
                        </div>
                        {item.status === 'pending' && (
                          <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                            <button
                              className="button-primary"
                              disabled={busyAction !== null}
                              onClick={() => void handleWritebackDecision(item, 'approve')}
                              type="button"
                            >
                              {busyAction === `approve:${item.id}` ? 'Approving...' : 'Approve'}
                            </button>
                            <button
                              className="button-secondary"
                              disabled={busyAction !== null}
                              onClick={() => void handleWritebackDecision(item, 'reject')}
                              type="button"
                            >
                              {busyAction === `reject:${item.id}` ? 'Rejecting...' : 'Reject'}
                            </button>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                  {detail.writebacks.length === 0 && (
                    <div className="text-sm text-slate-400">No external writeback approvals were generated for this run.</div>
                  )}
                </div>
              </section>

              {selectedWriteback && (
                <section className="panel-subtle">
                  <div className="label">Selected writeback</div>
                  <div className="mt-3 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
                    <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-white">{selectedWriteback.requestType}</div>
                          <div className="mt-1 font-mono text-xs text-cyan-200">{selectedWriteback.id}</div>
                        </div>
                        <span className="badge-neutral">{selectedWriteback.status}</span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
                        <div>Connector: {selectedWriteback.connectorId ?? '—'}</div>
                        <div>Integration run: {selectedWriteback.integrationRunId ?? '—'}</div>
                        <div>Requested by: {selectedWriteback.requestedByUserId ?? '—'}</div>
                        <div>Reviewed by: {selectedWriteback.reviewedByUserId ?? '—'}</div>
                      </div>
                      <div className="mt-3 text-sm leading-6 text-slate-300">
                        {selectedWriteback.justification ?? 'No reviewer justification has been recorded yet.'}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedWriteback.evidenceRefs.map((item) => (
                          <span key={item} className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 font-mono text-xs text-cyan-200">
                            {item}
                          </span>
                        ))}
                        {selectedWriteback.evidenceRefs.length === 0 && (
                          <span className="text-xs text-slate-500">No evidence refs were attached to this writeback request.</span>
                        )}
                      </div>
                    </div>
                    <pre className="max-h-[360px] overflow-auto rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-xs leading-6 text-slate-300">
                      {toPreview(selectedWriteback.payload)}
                    </pre>
                  </div>
                </section>
              )}
            </>
          )}
        </section>
      </section>
    </div>
  );
}
