import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  approveWriteback,
  explainAssurance,
  exportWritebackDraft,
  getAgentArtifactPreview,
  getAgentRun,
  getAgentTrace,
  importObservableAgentRun,
  listAgentRuns,
  markWritebackDuplicate,
  rejectWriteback,
  requestWritebackEvidence,
} from './api';
import { AssuranceExplainPanel } from './AssuranceExplainPanel';
import { AssuranceWorkflowPanel } from './AssuranceWorkflowPanel';
import { CoachMarksPanel } from '../../components/CoachMarksPanel';
import { RegActionMenu, RegModal, RegRightDrawer, RegStatusPill } from '../../components/regovise/PagePrimitives';
import type { AgentRunDetail, AgentRunListItem, AgentRunTrace, AssuranceArtifactPreview, AssuranceExplainAudience, WritebackApproval } from './types';
import { useEdgeIdentity } from '../../shared/session/identity';

type WritebackDecision = 'approve' | 'reject' | 'request_more_evidence' | 'duplicate' | 'export';

const writebackDecisionLabels: Record<WritebackDecision, string> = {
  approve: 'Approve',
  reject: 'Reject',
  request_more_evidence: 'Request more evidence',
  duplicate: 'Mark duplicate',
  export: 'Export draft',
};

const writebackDecisionDescriptions: Record<WritebackDecision, string> = {
  approve: 'Record this writeback as approved for local draft handling. No external dispatch is performed by this approval.',
  reject: 'Reject this writeback request and preserve the reviewer note as the decision rationale.',
  request_more_evidence: 'Move this writeback into a needs-more-evidence state so it cannot proceed without additional source support.',
  duplicate: 'Mark this writeback as a duplicate of existing work and preserve the reviewer note as the rationale.',
  export: 'Export the draft writeback payload locally for review. No external dispatch is performed.',
};

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
    value === 'writeback_requests' ||
    value === 'normalized_findings' ||
    value === 'threat_hunt_findings' ||
    value === 'draft_tickets' ||
    value === 'manifest' ||
    value === 'source_confidence' ||
    value === 'rejection_diagnostics' ||
    value === 'live_collection_coverage' ||
    value === 'package_links' ||
    value === 'reconciliation_links'
  );
}

const SAMPLE_OBSERVABLE_IMPORT = JSON.stringify(
  {
    manifest: {
      schema_version: '1.0',
      producer: { name: 'observable-security-agent', version: 'sample' },
      run_id: 'osa-sample-import',
      workflow_name: 'sample-observable-security-agent-import',
      status: 'awaiting_review',
      manifest_completeness: { complete: true, missing_families: [] },
      artifact_families: {
        agent_eval_results: { exists: true, status: 'available' },
        normalized_findings: { exists: true, status: 'available' },
        draft_tickets: { exists: true, status: 'available' },
      },
      policy_decisions: [
        { action_id: 'draft.external_writebacks', allowed: false, category: 'real_ticket_create', reason: 'External dispatch requires human approval.' },
      ],
      review_gates: ['approve_or_reject_local_writeback_drafts'],
      blocked_actions: { external_actions_require_human_approval: true },
      writeback_requests: [
        {
          id: 'osa-sample-writeback-1',
          request_type: 'ticket',
          status: 'draft_requires_human_review',
          payload: { summary: 'Review sample OSA recommendation', destination: 'draft-only' },
          evidence_refs: ['agent_eval_results'],
        },
      ],
      package_links: {},
    },
    artifacts: {
      source_confidence: { content: { overall_confidence: 'high', signals: [{ source: 'sample', confidence: 'high' }] } },
      rejection_diagnostics: { content: { rejected_record_count: 0, records: [] } },
      live_collection_coverage: { content: { mode: 'fixture_only_no_credentials', redaction: { status: 'redacted' } } },
      normalized_findings: { content: { finding_count: 1, findings: [{ finding_id: 'OSA-NF-001', status: 'pending_review' }] } },
      draft_tickets: { content: { draft_count: 1, tickets: [{ ticket_id: 'osa-sample-writeback-1', status: 'pending_human_approval' }] } },
    },
  },
  null,
  2,
);

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
  const [inspectedWriteback, setInspectedWriteback] = useState<WritebackApproval | null>(null);
  const [writebackDecisionToReview, setWritebackDecisionToReview] = useState<{
    writeback: WritebackApproval;
    decision: WritebackDecision;
  } | null>(null);
  const [observableImportText, setObservableImportText] = useState('');
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
  const coachMarkItems = [
    {
      id: 'agent-trace',
      eyebrow: 'Trace',
      title: 'Start with the run trace before you trust the summary',
      body: 'The trace and step log are meant to show how the bounded agent reasoned through the work, not just what it concluded.',
      tone: 'focus' as const,
    },
    {
      id: 'agent-policy',
      eyebrow: 'Policy',
      title: 'Policy decisions explain what the agent was allowed to do',
      body: 'Blocked actions and approval gates are as important as successful actions because they define the safety boundary.',
    },
    {
      id: 'agent-writebacks',
      eyebrow: 'Writebacks',
      title: 'External actions should wait for explicit approval',
      body: 'Use the writeback area to confirm the destination, justification, and evidence context before letting anything leave the workspace.',
      route: selectedWriteback ? `/assurance/agent-runs?runId=${encodeURIComponent(selectedRunId)}&writebackId=${encodeURIComponent(selectedWriteback.id)}` : '/assurance/agent-runs',
      ctaLabel: 'Inspect writebacks',
    },
    {
      id: 'agent-evidence',
      eyebrow: 'Source record',
      title: 'Agent runs should still lead back to the original evidence',
      body: 'If an agent conclusion matters, you should be able to jump from here back into the originating bundle or package without losing context.',
      route: trace?.evidenceJobId ? `/assurance/evidence?evidenceJobId=${encodeURIComponent(trace.evidenceJobId)}` : '/assurance/evidence',
      ctaLabel: 'Open evidence explorer',
    },
  ];

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

  async function handleObservableImport() {
    try {
      setBusyAction('import-observable');
      setError(null);
      setNotice(null);
      const body = JSON.parse(observableImportText) as Record<string, unknown>;
      const result = await importObservableAgentRun(body);
      const nextRuns = await listAgentRuns();
      setRuns(nextRuns);
      setSelectedRunId(result.runId);
      updateSearchState({ runId: result.runId, stepId: null, policyId: null, writebackId: null });
      setObservableImportText('');
      setNotice(`Imported Observable Security Agent run ${result.runId}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import the Observable run manifest.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleWritebackDecision(
    writeback: WritebackApproval,
    decision: WritebackDecision,
  ) {
    try {
      setBusyAction(`${decision}:${writeback.id}`);
      setError(null);
      setNotice(null);
      if (decision === 'approve') {
        const result = await approveWriteback(writeback.id, approvalNote);
        setNotice(`Writeback ${result.approvalId} approved as a draft-only review decision. No external dispatch was performed.`);
      } else if (decision === 'reject') {
        const result = await rejectWriteback(writeback.id, approvalNote);
        setNotice(`Writeback ${result.approvalId} rejected.`);
      } else if (decision === 'request_more_evidence') {
        const result = await requestWritebackEvidence(writeback.id, approvalNote);
        setNotice(`Writeback ${result.approvalId} now requires more evidence.`);
      } else if (decision === 'duplicate') {
        const result = await markWritebackDuplicate(writeback.id, approvalNote);
        setNotice(`Writeback ${result.approvalId} marked duplicate.`);
      } else {
        const result = await exportWritebackDraft(writeback.id);
        setPreviewFamily('writeback_requests');
        setPreview(result);
        setNotice(`Writeback ${result.approvalId} draft payload exported locally. No external dispatch was performed.`);
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
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update the writeback decision.');
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  const decisionReview = writebackDecisionToReview;

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Assurance</div>
        <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Agent Run Inspector</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#51465e]">
          Inspect bounded assurance-agent traces, policy decisions, and approval-gated writebacks without leaving the workspace.
        </p>
      </section>

      <CoachMarksPanel
        storageKey="assurance-agent-inspector"
        title="Use Agent Run Inspector to verify the automation boundary."
        description="This page should help you understand what the bounded agent observed, what policy allowed or blocked, and which actions still need a human to decide."
        items={coachMarkItems}
      />

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="panel-subtle">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="label">Observable Security Agent import</div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#51465e]">
              Paste a JSON object with a <code>manifest</code> field from <code>agent_run_manifest.json</code>. Optional <code>trace</code> and <code>artifacts</code> fields are preserved as previews; writebacks remain pending human approval.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-secondary" disabled={busyAction !== null} onClick={() => setObservableImportText(SAMPLE_OBSERVABLE_IMPORT)} type="button">
              Load sample OSA run
            </button>
            <button className="button-primary" disabled={busyAction !== null || !observableImportText.trim()} onClick={() => void handleObservableImport()} type="button">
              {busyAction === 'import-observable' ? 'Importing...' : 'Import Observable run'}
            </button>
          </div>
        </div>
        <textarea
          className="input mt-4 min-h-[130px] font-mono text-xs"
          onChange={(event) => setObservableImportText(event.target.value)}
          placeholder='{"manifest":{"schema_version":"1.0","producer":{"name":"observable-security-agent"},"artifact_families":{}}}'
          value={observableImportText}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <section className="space-y-3">
          <div className="panel">
            <div className="flex items-center justify-between">
              <div>
                <div className="label">Agent runs</div>
                <div className="mt-1 text-sm text-[#6f6578]">Completed runs and their current approval posture.</div>
              </div>
              <button className="button-secondary" onClick={() => void loadRuns()} type="button">
                Refresh
              </button>
            </div>
          </div>

          {runs.map((item) => (
            <button
              key={item.id}
              className={`panel w-full text-left transition ${selectedRunId === item.id ? 'border-[#d7c3f1] bg-[#f3e9ff]' : ''}`}
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
                  <h2 className="mt-2 text-lg font-semibold text-[#241232]">{item.status}</h2>
                  <div className="mt-2 font-mono text-xs text-[#6d28d9]">{item.id}</div>
                </div>
                <RegStatusPill tone="neutral">{item.pendingWritebackCount} pending</RegStatusPill>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-[#6f6578] sm:grid-cols-2">
                <div>Created: {formatDate(item.createdAt)}</div>
                <div>Evidence: {item.evidenceJobId ?? '—'}</div>
                <div>Approvals: {item.approvalCount}</div>
                <div>Requested writebacks: {item.requestedWritebacks ? 'yes' : 'no'}</div>
              </div>
            </button>
          ))}

          {!loading && runs.length === 0 && (
            <div className="panel text-sm text-[#6f6578]">No assurance agent runs are available yet.</div>
          )}
          {loading && <div className="panel text-sm text-[#6f6578]">Loading agent runs...</div>}
        </section>

        <section className="space-y-4">
          {detailLoading && <div className="panel text-sm text-[#6f6578]">Loading agent run detail...</div>}

          {detail && trace && (
            <>
              <section className="panel">
                <div className="label">Selected run</div>
                <h2 className="mt-2 text-2xl font-semibold text-[#241232]">{trace.workflowName}</h2>
                <div className="mt-2 font-mono text-xs text-[#6d28d9]">{detail.id}</div>
                <div className="mt-3 grid gap-2 text-sm text-[#6f6578] sm:grid-cols-2">
                  <div>Generated: {formatDate(trace.generatedAt)}</div>
                  <div>Status: {trace.status}</div>
                  <div>
                    Evidence job:{' '}
                    {trace.evidenceJobId ? (
                      <Link className="font-mono text-[#6d28d9] transition hover:text-[#5f1aa8]" to={`/assurance/evidence?evidenceJobId=${encodeURIComponent(trace.evidenceJobId)}`}>
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

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="panel-subtle">
                  <div className="label">Proof chain</div>
                  <div className="mt-3 text-sm leading-6 text-[#51465e]">
                    Manifest completeness:{' '}
                    {String((detail.summary.manifestCompleteness as Record<string, unknown> | null | undefined)?.complete ?? detail.summary.manifest_complete ?? 'unknown')}
                  </div>
                  <div className="mt-2 text-xs text-[#62576a]">Deterministic artifacts remain authoritative; LLM output is explanatory only.</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">Source confidence</div>
                  <pre className="mt-3 max-h-[180px] overflow-auto rounded-2xl border border-[#ded8e4] bg-[#f7f2fa] p-3 text-xs leading-5 text-[#51465e]">
                    {toPreview(detail.summary.sourceConfidence ?? detail.summary.source_confidence ?? 'No source confidence payload imported yet.')}
                  </pre>
                </div>
                <div className="panel-subtle">
                  <div className="label">Rejected records</div>
                  <pre className="mt-3 max-h-[180px] overflow-auto rounded-2xl border border-[#ded8e4] bg-[#f7f2fa] p-3 text-xs leading-5 text-[#51465e]">
                    {toPreview(detail.summary.rejectionDiagnostics ?? detail.summary.rejection_diagnostics ?? detail.summary.unavailableArtifactFamilies ?? 'No rejection diagnostics imported yet.')}
                  </pre>
                </div>
                <div className="panel-subtle">
                  <div className="label">Live collection coverage</div>
                  <pre className="mt-3 max-h-[180px] overflow-auto rounded-2xl border border-[#ded8e4] bg-[#f7f2fa] p-3 text-xs leading-5 text-[#51465e]">
                    {toPreview(detail.summary.liveCollectionCoverage ?? detail.summary.live_collection_coverage ?? 'No live coverage payload imported yet.')}
                  </pre>
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
                            ? 'border-[#8b35e6]/30 bg-[#f2e8ff]'
                            : 'border-[#ded8e4] bg-[#fbf9fc] hover:border-[#8b35e6]/25 hover:bg-[#f8f3ff]'
                        }`}
                        onClick={() => {
                          setSelectedStepId(step.id);
                          updateSearchState({ stepId: step.id });
                        }}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-[#241232]">
                            {step.order}. {step.actionId}
                          </div>
                          <RegStatusPill tone="neutral">{step.status}</RegStatusPill>
                        </div>
                        <div className="mt-2 text-xs text-[#62576a]">{step.actionCategory}</div>
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
                            ? 'border-[#8b35e6]/30 bg-[#f2e8ff]'
                            : 'border-[#ded8e4] bg-[#fbf9fc] hover:border-[#8b35e6]/25 hover:bg-[#f8f3ff]'
                        }`}
                        onClick={() => {
                          setSelectedPolicyDecisionId(decision.id);
                          updateSearchState({ policyId: decision.id });
                        }}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-[#241232]">{decision.actionId}</div>
                          <RegStatusPill tone={decision.allowed ? 'success' : 'danger'}>
                            {decision.allowed ? 'allowed' : 'blocked'}
                          </RegStatusPill>
                        </div>
                        <div className="mt-2 text-xs leading-5 text-[#6f6578]">{decision.reason}</div>
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
                      <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-[#241232]">
                              {selectedStep.order}. {selectedStep.actionId}
                            </div>
                            <div className="mt-1 text-xs text-[#62576a]">{selectedStep.actionCategory}</div>
                          </div>
                          <RegStatusPill tone="neutral">{selectedStep.status}</RegStatusPill>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-[#6f6578] sm:grid-cols-2">
                          <div>Started: {formatDate(selectedStep.startedAt)}</div>
                          <div>Finished: {formatDate(selectedStep.finishedAt)}</div>
                        </div>
                      </div>
                      <pre className="max-h-[320px] overflow-auto rounded-2xl border border-[#ded8e4] bg-[#f7f2fa] p-4 text-xs leading-6 text-[#51465e]">
                        {toPreview({
                          input: selectedStep.input,
                          output: selectedStep.output,
                        })}
                      </pre>
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-[#6f6578]">Select a trace step to inspect its input and output payloads.</div>
                  )}
                </section>

                <section className="panel-subtle">
                  <div className="label">Selected policy decision</div>
                  {selectedPolicyDecision ? (
                    <div className="mt-3 space-y-4">
                      <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-[#241232]">{selectedPolicyDecision.actionId}</div>
                            <div className="mt-1 text-xs text-[#62576a]">{humanizeKey(selectedPolicyDecision.category)}</div>
                          </div>
                          <RegStatusPill tone={selectedPolicyDecision.allowed ? 'success' : 'danger'}>
                            {selectedPolicyDecision.allowed ? 'Allowed' : 'Blocked'}
                          </RegStatusPill>
                        </div>
                        <div className="mt-3 text-sm leading-6 text-[#51465e]">{selectedPolicyDecision.reason}</div>
                      </div>
                      <pre className="max-h-[320px] overflow-auto rounded-2xl border border-[#ded8e4] bg-[#f7f2fa] p-4 text-xs leading-6 text-[#51465e]">
                        {toPreview(selectedPolicyDecision.detail)}
                      </pre>
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-[#6f6578]">Select a policy decision to inspect the bounded-agent governance detail.</div>
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
                    <option value="normalized_findings">normalized_findings</option>
                    <option value="threat_hunt_findings">threat_hunt_findings</option>
                    <option value="draft_tickets">draft_tickets</option>
                    <option value="manifest">manifest</option>
                    <option value="source_confidence">source_confidence</option>
                    <option value="rejection_diagnostics">rejection_diagnostics</option>
                    <option value="live_collection_coverage">live_collection_coverage</option>
                    <option value="package_links">package_links</option>
                    <option value="reconciliation_links">reconciliation_links</option>
                  </select>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3 text-sm">
                      <div className="text-xs uppercase tracking-[0.2em] text-[#62576a]">Retrieval</div>
                      <div className="mt-2 font-medium text-[#241232]">{previewState?.retrieval.kind ?? 'preview'}</div>
                      <div className="mt-1 text-xs text-[#62576a]">
                        {previewState?.retrieval.previewAvailable === false ? 'Preview unavailable' : 'Preview available'}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3 text-sm">
                      <div className="text-xs uppercase tracking-[0.2em] text-[#62576a]">Artifact family</div>
                      <div className="mt-2 font-medium text-[#241232]">{previewState?.family ?? previewFamily}</div>
                      <div className="mt-1 text-xs text-[#62576a]">
                        {previewState?.items.length ?? 0} object{(previewState?.items.length ?? 0) === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3 text-sm sm:col-span-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-[#62576a]">Object key</div>
                      <div className="mt-2 break-all font-mono text-xs text-[#6d28d9]">{selectedPreviewItem?.objectKey ?? 'No object metadata loaded.'}</div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#62576a]">
                        <span>{selectedPreviewItem?.contentType ?? 'unknown content type'}</span>
                        <span>{formatBytes(selectedPreviewItem?.sizeBytes ?? null)}</span>
                        {selectedPreviewItem?.createdAt ? <span>{formatDate(selectedPreviewItem.createdAt)}</span> : null}
                      </div>
                    </div>
                  </div>
                  <pre className="mt-4 max-h-[460px] overflow-auto rounded-2xl border border-[#ded8e4] bg-[#f7f2fa] p-4 text-xs leading-6 text-[#51465e]">
                    {preview ? toPreview(preview) : 'No preview is available for the selected agent artifact.'}
                  </pre>
                </section>

                <section className="panel-subtle">
                  <div className="label">Run summary</div>
                  <div className="mt-3 space-y-2 text-sm text-[#51465e]">
                    <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-[#62576a]">Workflow</div>
                      <div className="mt-2 font-medium text-[#241232]">{detail.workflowName}</div>
                    </div>
                    <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-[#62576a]">Requested writebacks</div>
                      <div className="mt-2 font-medium text-[#241232]">{detail.requestedWritebacks ? 'Enabled' : 'Disabled'}</div>
                    </div>
                    <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-[#62576a]">Package job</div>
                      {typeof detail.summary.packageJobId === 'string' ? (
                        <Link
                          className="mt-2 block font-mono text-xs text-[#6d28d9] transition hover:text-[#5f1aa8]"
                          to={`/assurance/packages?packageId=${encodeURIComponent(detail.summary.packageJobId)}`}
                        >
                          {detail.summary.packageJobId}
                        </Link>
                      ) : (
                        <div className="mt-2 font-mono text-xs text-[#6f6578]">—</div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-[#62576a]">Workflow rationale</div>
                      <div className="mt-2 text-sm leading-6 text-[#51465e]">{String(detail.summary.workflowRationale ?? '—')}</div>
                    </div>
                    <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-[#62576a]">Awaiting review reasons</div>
                      <div className="mt-2 text-sm leading-6 text-[#51465e]">
                        {Array.isArray(detail.summary.awaitingReviewReasons) && detail.summary.awaitingReviewReasons.length > 0
                          ? detail.summary.awaitingReviewReasons.join(', ')
                          : '—'}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-[#62576a]">Trace artifact</div>
                      <div className="mt-2 font-mono text-xs text-[#6f6578]">{detail.traceKey ?? '—'}</div>
                    </div>
                    <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-[#62576a]">Summary artifact</div>
                      <div className="mt-2 font-mono text-xs text-[#6f6578]">{detail.summaryKey ?? '—'}</div>
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
                    <div
                      key={item.id}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                        selectedWritebackId === item.id
                          ? 'border-[#8b35e6]/30 bg-[#f2e8ff]'
                          : 'border-[#ded8e4] bg-[#fbf9fc] hover:border-[#8b35e6]/25 hover:bg-[#f8f3ff]'
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => {
                            setSelectedWritebackId(item.id);
                            updateSearchState({ writebackId: item.id });
                          }}
                          type="button"
                        >
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-[#241232]">{item.requestType}</div>
                            <RegStatusPill tone="neutral">{item.status}</RegStatusPill>
                          </div>
                          <div className="mt-2 font-mono text-xs text-[#6d28d9]">{item.id}</div>
                          <div className="mt-2 text-xs leading-5 text-[#6f6578]">
                            Connector: {item.connectorId ?? '—'} · Evidence refs: {item.evidenceRefs.join(', ') || '—'}
                          </div>
                          {item.integrationRunId && (
                            <div className="mt-2 font-mono text-xs text-[#62576a]">Integration run: {item.integrationRunId}</div>
                          )}
                        </button>
                        <div className="shrink-0">
                          <RegActionMenu
                            actions={[
                              {
                                label: 'Inspect writeback',
                                onSelect: () => {
                                  setSelectedWritebackId(item.id);
                                  updateSearchState({ writebackId: item.id });
                                  setInspectedWriteback(item);
                                },
                              },
                              {
                                label: busyAction === `export:${item.id}` ? 'Exporting...' : 'Export draft',
                                disabled: busyAction !== null,
                                onSelect: () => void handleWritebackDecision(item, 'export'),
                              },
                              {
                                label: 'Approve',
                                disabled: item.status !== 'pending' || busyAction !== null,
                                onSelect: () => setWritebackDecisionToReview({ writeback: item, decision: 'approve' }),
                              },
                              {
                                label: 'Reject',
                                disabled: item.status !== 'pending' || busyAction !== null,
                                destructive: true,
                                onSelect: () => setWritebackDecisionToReview({ writeback: item, decision: 'reject' }),
                              },
                              {
                                label: 'Request more evidence',
                                disabled: item.status !== 'pending' || busyAction !== null,
                                onSelect: () => setWritebackDecisionToReview({ writeback: item, decision: 'request_more_evidence' }),
                              },
                              {
                                label: 'Mark duplicate',
                                disabled: item.status !== 'pending' || busyAction !== null,
                                onSelect: () => setWritebackDecisionToReview({ writeback: item, decision: 'duplicate' }),
                              },
                            ]}
                            label={`Open writeback actions for ${item.id}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {detail.writebacks.length === 0 && (
                    <div className="text-sm text-[#6f6578]">No external writeback approvals were generated for this run.</div>
                  )}
                </div>
              </section>

              {selectedWriteback && (
                <section className="panel-subtle">
                  <div className="label">Selected writeback</div>
                  <div className="mt-3 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
                    <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-[#241232]">{selectedWriteback.requestType}</div>
                          <div className="mt-1 font-mono text-xs text-[#6d28d9]">{selectedWriteback.id}</div>
                        </div>
                        <RegStatusPill tone="neutral">{selectedWriteback.status}</RegStatusPill>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-[#6f6578] sm:grid-cols-2">
                        <div>Connector: {selectedWriteback.connectorId ?? '—'}</div>
                        <div>Integration run: {selectedWriteback.integrationRunId ?? '—'}</div>
                        <div>Requested by: {selectedWriteback.requestedByUserId ?? '—'}</div>
                        <div>Reviewed by: {selectedWriteback.reviewedByUserId ?? '—'}</div>
                      </div>
                      <div className="mt-3 text-sm leading-6 text-[#51465e]">
                        {selectedWriteback.justification ?? 'No reviewer justification has been recorded yet.'}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedWriteback.evidenceRefs.map((item) => (
                          <span key={item} className="rounded-full border border-[#ded8e4] bg-[#f7f2fa] px-3 py-1 font-mono text-xs text-[#6d28d9]">
                            {item}
                          </span>
                        ))}
                        {selectedWriteback.evidenceRefs.length === 0 && (
                          <span className="text-xs text-[#62576a]">No evidence refs were attached to this writeback request.</span>
                        )}
                      </div>
                    </div>
                    <pre className="max-h-[360px] overflow-auto rounded-2xl border border-[#ded8e4] bg-[#f7f2fa] p-4 text-xs leading-6 text-[#51465e]">
                      {toPreview(selectedWriteback.payload)}
                    </pre>
                  </div>
                </section>
              )}
            </>
          )}
        </section>
      </section>

      <RegRightDrawer
        className="flex flex-col"
        description={inspectedWriteback ? `${inspectedWriteback.requestType} · ${inspectedWriteback.status}` : undefined}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setInspectedWriteback(null)} type="button">
              Close
            </button>
            <button
              className="button-primary"
              disabled={!inspectedWriteback || busyAction !== null}
              onClick={() => {
                if (!inspectedWriteback) {
                  return;
                }
                void handleWritebackDecision(inspectedWriteback, 'export');
              }}
              type="button"
            >
              {inspectedWriteback && busyAction === `export:${inspectedWriteback.id}` ? 'Exporting...' : 'Export draft'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) {
            setInspectedWriteback(null);
          }
        }}
        open={inspectedWriteback !== null}
        title="Writeback request"
      >
        {inspectedWriteback ? (
          <div className="space-y-5">
            <section className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#241232]">{inspectedWriteback.requestType}</div>
                  <div className="mt-1 break-all font-mono text-xs text-[#6d28d9]">{inspectedWriteback.id}</div>
                </div>
                <RegStatusPill tone="neutral">{inspectedWriteback.status}</RegStatusPill>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-[#6f6578]">
                <div>Connector: {inspectedWriteback.connectorId ?? '—'}</div>
                <div>Integration run: {inspectedWriteback.integrationRunId ?? '—'}</div>
                <div>Requested by: {inspectedWriteback.requestedByUserId ?? '—'}</div>
                <div>Reviewed by: {inspectedWriteback.reviewedByUserId ?? '—'}</div>
                <div>Created: {formatDate(inspectedWriteback.createdAt)}</div>
                <div>Updated: {formatDate(inspectedWriteback.updatedAt)}</div>
              </div>
            </section>

            <section>
              <div className="label">Review rationale</div>
              <p className="mt-2 text-sm leading-6 text-[#51465e]">
                {inspectedWriteback.justification ?? 'No reviewer justification has been recorded yet.'}
              </p>
            </section>

            <section>
              <div className="label">Evidence refs</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {inspectedWriteback.evidenceRefs.map((item) => (
                  <span key={item} className="rounded-full border border-[#ded8e4] bg-[#f7f2fa] px-3 py-1 font-mono text-xs text-[#6d28d9]">
                    {item}
                  </span>
                ))}
                {inspectedWriteback.evidenceRefs.length === 0 && (
                  <span className="text-sm text-[#6f6578]">No evidence refs were attached.</span>
                )}
              </div>
            </section>

            <section>
              <div className="label">Payload</div>
              <pre className="mt-3 max-h-[420px] overflow-auto rounded-2xl border border-[#ded8e4] bg-[#f7f2fa] p-4 text-xs leading-6 text-[#51465e]">
                {toPreview(inspectedWriteback.payload)}
              </pre>
            </section>
          </div>
        ) : null}
      </RegRightDrawer>

      {decisionReview ? (
        <RegModal
          className="max-w-3xl"
          description={writebackDecisionDescriptions[decisionReview.decision]}
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="button-secondary" onClick={() => setWritebackDecisionToReview(null)} type="button">
                Cancel
              </button>
              <button
                className={decisionReview.decision === 'reject' ? 'button-danger' : 'button-primary'}
                disabled={busyAction !== null}
                onClick={async () => {
                  const currentDecision = writebackDecisionToReview;
                  if (!currentDecision) {
                    return;
                  }
                  const ok = await handleWritebackDecision(currentDecision.writeback, currentDecision.decision);
                  if (ok) {
                    setWritebackDecisionToReview(null);
                  }
                }}
                type="button"
              >
                {busyAction === `${decisionReview.decision}:${decisionReview.writeback.id}` ? 'Saving...' : writebackDecisionLabels[decisionReview.decision]}
              </button>
            </div>
          }
          onOpenChange={(open) => {
            if (!open) {
              setWritebackDecisionToReview(null);
            }
          }}
          open
          title={`${writebackDecisionLabels[decisionReview.decision]} writeback?`}
        >
          <div className="space-y-5">
            <section className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#241232]">{decisionReview.writeback.requestType}</div>
                  <div className="mt-1 break-all font-mono text-xs text-[#6d28d9]">{decisionReview.writeback.id}</div>
                </div>
                <RegStatusPill tone="neutral">{decisionReview.writeback.status}</RegStatusPill>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-[#6f6578] sm:grid-cols-2">
                <div>Connector: {decisionReview.writeback.connectorId ?? '—'}</div>
                <div>Integration run: {decisionReview.writeback.integrationRunId ?? '—'}</div>
                <div>Requested by: {decisionReview.writeback.requestedByUserId ?? '—'}</div>
                <div>Reviewed by: {decisionReview.writeback.reviewedByUserId ?? '—'}</div>
              </div>
            </section>

            <label className="block space-y-2">
              <span className="label">Reviewer note</span>
              <textarea
                className="input min-h-[120px]"
                onChange={(event) => setApprovalNote(event.target.value)}
                value={approvalNote}
              />
            </label>

            <section>
              <div className="label">Evidence refs</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {decisionReview.writeback.evidenceRefs.map((item) => (
                  <span key={item} className="rounded-full border border-[#ded8e4] bg-[#f7f2fa] px-3 py-1 font-mono text-xs text-[#6d28d9]">
                    {item}
                  </span>
                ))}
                {decisionReview.writeback.evidenceRefs.length === 0 && (
                  <span className="text-sm text-[#6f6578]">No evidence refs were attached.</span>
                )}
              </div>
            </section>

            <section>
              <div className="label">Payload</div>
              <pre className="mt-3 max-h-[280px] overflow-auto rounded-2xl border border-[#ded8e4] bg-[#f7f2fa] p-4 text-xs leading-6 text-[#51465e]">
                {toPreview(decisionReview.writeback.payload)}
              </pre>
            </section>
          </div>
        </RegModal>
      ) : null}
    </div>
  );
}
