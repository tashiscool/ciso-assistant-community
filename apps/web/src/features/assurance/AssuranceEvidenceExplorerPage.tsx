import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bot, FileOutput, PlayCircle } from 'lucide-react';
import {
  buildPackage,
  createAgentRun,
  explainAssurance,
  getAssuranceEvaluation,
  getEvidenceArtifactPreview,
  getEvidenceJob,
  listEvidenceJobs,
  runAssuranceEvaluation,
} from './api';
import { AssuranceExplainPanel } from './AssuranceExplainPanel';
import { AssuranceWorkflowPanel } from './AssuranceWorkflowPanel';
import {
  RegModal,
  RegPageHeader,
  RegStatusPill,
  RegTableShell,
} from '../../components/regovise/PagePrimitives';
import type {
  AssuranceEvidenceJob,
  AssuranceEvidenceJobDetail,
  EvaluationArtifacts,
} from './types';
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

function severityTone(value: string | null | undefined): 'success' | 'danger' | 'neutral' {
  if (!value) {
    return 'neutral';
  }
  switch (value.toLowerCase()) {
    case 'critical':
    case 'high':
      return 'danger';
    case 'moderate':
    case 'medium':
      return 'neutral';
    default:
      return 'success';
  }
}

function evalStatusTone(status: string): 'success' | 'danger' | 'neutral' {
  switch (status) {
    case 'FAIL':
      return 'danger';
    case 'PARTIAL':
      return 'neutral';
    default:
      return 'success';
  }
}

function humanizeKey(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

type EvidenceJobAction = 'evaluate' | 'package' | 'agent';

export function AssuranceEvidenceExplorerPage() {
  const { identity } = useEdgeIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState<AssuranceEvidenceJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [detail, setDetail] = useState<AssuranceEvidenceJobDetail | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationArtifacts | null>(null);
  const [previewFamily, setPreviewFamily] = useState('normalized_bundle');
  const [preview, setPreview] = useState<unknown>(null);
  const [lastBuiltPackageId, setLastBuiltPackageId] = useState('');
  const [lastAgentRunId, setLastAgentRunId] = useState('');
  const [selectedGraphNodeKey, setSelectedGraphNodeKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [pendingJobAction, setPendingJobAction] = useState<EvidenceJobAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestedEvidenceJobId = searchParams.get('evidenceJobId') ?? '';
  const requestedArtifactFamily = searchParams.get('artifact') ?? '';

  function updateSearchState(updates: {
    evidenceJobId?: string | null;
    artifact?: string | null;
  }) {
    const next = new URLSearchParams(searchParams);
    const entries = [
      ['evidenceJobId', updates.evidenceJobId],
      ['artifact', updates.artifact],
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

  async function loadJobs() {
    try {
      setLoading(true);
      setError(null);
      const data = await listEvidenceJobs();
      setJobs(data);
      setSelectedJobId((current) => {
        if (requestedEvidenceJobId && data.some((item) => item.id === requestedEvidenceJobId)) {
          return requestedEvidenceJobId;
        }
        return current || data[0]?.id || '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load evidence jobs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadJobs();
  }, [identity.tenantId, identity.userId, requestedEvidenceJobId]);

  useEffect(() => {
    if (!requestedEvidenceJobId || requestedEvidenceJobId === selectedJobId) {
      return;
    }
    if (jobs.some((item) => item.id === requestedEvidenceJobId)) {
      setSelectedJobId(requestedEvidenceJobId);
    }
  }, [jobs, requestedEvidenceJobId, selectedJobId]);

  useEffect(() => {
    const current = searchParams.get('evidenceJobId') ?? '';
    if (current === selectedJobId || (!current && !selectedJobId)) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (selectedJobId) {
      next.set('evidenceJobId', selectedJobId);
    } else {
      next.delete('evidenceJobId');
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, selectedJobId, setSearchParams]);

  useEffect(() => {
    if (!selectedJobId) {
      setDetail(null);
      setEvaluation(null);
      setPreview(null);
      setLastBuiltPackageId('');
      setLastAgentRunId('');
      return;
    }

    setLastBuiltPackageId('');
    setLastAgentRunId('');

    let cancelled = false;

    async function loadDetail() {
      try {
        setDetailLoading(true);
        setError(null);
        const [jobDetail, evalState] = await Promise.all([
          getEvidenceJob(selectedJobId),
          getAssuranceEvaluation(selectedJobId).catch(() => null),
        ]);

        if (cancelled) {
          return;
        }

        setDetail(jobDetail);
        setEvaluation(evalState);
        const families = Array.from(new Set(jobDetail.artifacts.map((item) => item.artifactFamily)));
        const nextFamily =
          families.find((item) => item === requestedArtifactFamily) ??
          families.find((item) => item === 'normalized_bundle') ??
          families.find((item) => item === 'assessment_summary') ??
          families[0] ??
          'normalized_bundle';
        setPreviewFamily(nextFamily);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load evidence detail.');
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedJobId]);

  useEffect(() => {
    if (!selectedJobId || !previewFamily) {
      setPreview(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const artifact = await getEvidenceArtifactPreview(selectedJobId, previewFamily);
        if (!cancelled) {
          setPreview(artifact.preview);
        }
      } catch {
        if (!cancelled) {
          setPreview(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [previewFamily, selectedJobId]);

  const families = useMemo(
    () => Array.from(new Set(detail?.artifacts.map((item) => item.artifactFamily) ?? [])),
    [detail],
  );

  useEffect(() => {
    if (!requestedArtifactFamily || !families.includes(requestedArtifactFamily)) {
      return;
    }
    if (requestedArtifactFamily !== previewFamily) {
      setPreviewFamily(requestedArtifactFamily);
    }
  }, [families, previewFamily, requestedArtifactFamily]);

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
  const explanationFocusOptions = useMemo(
    () => [
      ...(evaluation?.evalResults.map((item) => ({
        value: item.evalCode,
        label: `Eval · ${item.evalCode}`,
      })) ?? []),
      ...(evaluation?.gaps.map((item) => ({
        value: item.id,
        label: `Gap · ${item.title}`,
      })) ?? []),
      ...(evaluation?.poamItems.map((item) => ({
        value: item.identifier,
        label: `POA&M · ${item.identifier}`,
      })) ?? []),
      ...(evaluation?.reviewRecommendations.map((item) => ({
        value: item.id,
        label: `Review · ${item.title}`,
      })) ?? []),
      ...(evaluation?.reasonablenessFindings.map((item) => ({
        value: item.id,
        label: `Reasonableness · ${item.title}`,
      })) ?? []),
    ],
    [evaluation],
  );
  const coverageEntries = useMemo(
    () =>
      Object.entries((evaluation?.liveCollectionCoverage.coverage as Record<string, unknown> | undefined) ?? {}).filter(
        ([, value]) => typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean',
      ),
    [evaluation],
  );
  const graphNodeLookup = useMemo(
    () => new Map((evaluation?.graph.nodes ?? []).map((node) => [node.key, node])),
    [evaluation],
  );
  const graphNodeTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of evaluation?.graph.nodes ?? []) {
      counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [evaluation]);
  const graphEdgeTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of evaluation?.graph.edges ?? []) {
      counts.set(edge.type, (counts.get(edge.type) ?? 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [evaluation]);
  const selectedGraphNode = useMemo(
    () => (selectedGraphNodeKey ? graphNodeLookup.get(selectedGraphNodeKey) ?? null : null),
    [graphNodeLookup, selectedGraphNodeKey],
  );
  const selectedGraphConnections = useMemo(() => {
    if (!selectedGraphNodeKey || !evaluation) {
      return [];
    }
    return evaluation.graph.edges
      .filter((edge) => edge.from === selectedGraphNodeKey || edge.to === selectedGraphNodeKey)
      .map((edge) => {
        const relatedNodeKey = edge.from === selectedGraphNodeKey ? edge.to : edge.from;
        return {
          edgeType: edge.type,
          relatedNodeKey,
          relatedNode: graphNodeLookup.get(relatedNodeKey) ?? null,
          direction: edge.from === selectedGraphNodeKey ? 'outbound' : 'inbound',
        };
      });
  }, [evaluation, graphNodeLookup, selectedGraphNodeKey]);
  useEffect(() => {
    const nodeKeys = evaluation?.graph.nodes.map((node) => node.key) ?? [];
    if (nodeKeys.length === 0) {
      setSelectedGraphNodeKey('');
      return;
    }
    setSelectedGraphNodeKey((current) => (current && nodeKeys.includes(current) ? current : nodeKeys[0]));
  }, [evaluation]);

  async function handleRunEvaluation() {
    if (!selectedJobId) {
      setPendingJobAction(null);
      return;
    }
    try {
      setBusyAction('evaluate');
      setError(null);
      setNotice(null);
      const next = await runAssuranceEvaluation(selectedJobId);
      setEvaluation(next);
      await loadJobs();
      setNotice(`Deterministic assurance evaluation refreshed for ${selectedJobId}.`);
      setPendingJobAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run the assurance evaluation.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleBuildPackage() {
    if (!selectedJobId) {
      setPendingJobAction(null);
      return;
    }
    try {
      setBusyAction('package');
      setError(null);
      setNotice(null);
      const result = await buildPackage(selectedJobId, detail?.folderId);
      const packageJobId = String(result.package.packageJobId ?? '');
      setLastBuiltPackageId(packageJobId);
      setNotice(`20x package ${packageJobId || 'created'} is ready for review.`);
      setPendingJobAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to build the 20x package.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRunAgent() {
    if (!selectedJobId) {
      setPendingJobAction(null);
      return;
    }
    try {
      setBusyAction('agent');
      setError(null);
      setNotice(null);
      const result = await createAgentRun({
        evidenceJobId: selectedJobId,
        folderId: detail?.folderId ?? undefined,
        requestedWritebacks: true,
      });
      setLastAgentRunId(result.trace.runId);
      setNotice(`Assurance agent run ${result.trace.runId} completed with ${result.trace.pendingWritebacks.length} pending writeback(s).`);
      setPendingJobAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run the assurance agent.');
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <RegPageHeader
        eyebrow="Assurance"
        title="Evidence Explorer"
        description="Inspect normalized evidence, deterministic check results, artifact previews, and downstream package or agent actions from one traceable workspace."
        actions={
          <>
            <Link className="button-secondary" to="/assurance/reviews">
              Review queue
            </Link>
            <Link className="button-secondary" to="/assurance/packages">
              Packages
            </Link>
            <button className="button-primary" onClick={() => void loadJobs()} type="button">
              Refresh jobs
            </button>
          </>
        }
        className="rounded-lg border border-[#ded8e4]"
      />

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <RegTableShell className="self-start xl:sticky xl:top-4">
          <div className="border-b border-[#ded8e4] px-4 py-4 sm:px-5">
            <div className="label">Evidence jobs</div>
            <div className="mt-1 text-sm text-[#6f6578]">Normalized collection runs visible to your current identity.</div>
          </div>
          <div className="max-h-[44rem] divide-y divide-[#ece7f0] overflow-y-auto">
            {jobs.map((job) => (
              <button
                key={job.id}
                aria-pressed={selectedJobId === job.id}
                className={`w-full border-l-4 px-4 py-4 text-left transition sm:px-5 ${
                  selectedJobId === job.id
                    ? 'border-l-[#8b35e6] bg-[#f7f2ff]'
                    : 'border-l-transparent bg-white hover:bg-[#fbf9fc]'
                }`}
                onClick={() => setSelectedJobId(job.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-[#6f20c9]">{job.bundleKind}</div>
                    <h2 className="mt-1 font-semibold text-[#241232]">{job.sourceName}</h2>
                    <div className="mt-1 line-clamp-1 font-mono text-xs text-[#6f6578]">{job.id}</div>
                  </div>
                  <RegStatusPill tone={job.status === 'success' ? 'success' : job.status === 'failed' ? 'danger' : 'neutral'}>
                    {job.status}
                  </RegStatusPill>
                </div>
                <div className="mt-3 grid gap-x-4 gap-y-1 text-xs text-[#6f6578] sm:grid-cols-2">
                  <div>Input: {job.inputMode}</div>
                  <div>Artifacts: {job.artifactCount}</div>
                  <div>Normalized: {job.normalizationStatus}</div>
                  <div>Started: {formatDate(job.startedAt)}</div>
                </div>
              </button>
            ))}

            {!loading && jobs.length === 0 && (
              <div className="px-5 py-8 text-sm text-[#6f6578]">No evidence jobs are available for the current scope.</div>
            )}
            {loading && <div className="px-5 py-8 text-sm text-[#6f6578]">Loading evidence jobs...</div>}
          </div>
        </RegTableShell>

        <section className="space-y-4">
          <section className="panel">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="label">Selected evidence job</div>
                <h2 className="mt-2 text-2xl font-semibold text-[#241232]">{detail?.sourceName ?? 'Select a job'}</h2>
                <div className="mt-2 font-mono text-xs text-[#6f20c9]">{detail?.id ?? '—'}</div>
                <div className="mt-3 grid gap-2 text-sm text-[#6f6578] sm:grid-cols-2">
                  <div>Scheduled: {formatDate(detail?.scheduledFor)}</div>
                  <div>Finished: {formatDate(detail?.finishedAt)}</div>
                  <div>Folder: {detail?.folderId ?? 'Tenant-wide'}</div>
                  <div>Manifest: {detail?.manifestKey ?? '—'}</div>
                </div>
                {detail?.id && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link className="button-secondary" to={`/assurance/reviews?evidenceJobId=${encodeURIComponent(detail.id)}`}>
                      Open review queue
                    </Link>
                    {lastBuiltPackageId && (
                      <Link className="button-secondary" to={`/assurance/packages?packageId=${encodeURIComponent(lastBuiltPackageId)}`}>
                        Open latest package
                      </Link>
                    )}
                    {lastAgentRunId && (
                      <Link className="button-secondary" to={`/assurance/agent-runs?runId=${encodeURIComponent(lastAgentRunId)}`}>
                        Open latest agent run
                      </Link>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="button-primary" disabled={!detail || busyAction !== null} onClick={() => setPendingJobAction('evaluate')} type="button">
                  <PlayCircle className="mr-2 h-4 w-4" />
                  {busyAction === 'evaluate' ? 'Running...' : 'Run eval'}
                </button>
                <button className="button-secondary" disabled={!detail || busyAction !== null} onClick={() => setPendingJobAction('package')} type="button">
                  <FileOutput className="mr-2 h-4 w-4" />
                  {busyAction === 'package' ? 'Building...' : 'Build 20x'}
                </button>
                <button className="button-secondary" disabled={!detail || busyAction !== null} onClick={() => setPendingJobAction('agent')} type="button">
                  <Bot className="mr-2 h-4 w-4" />
                  {busyAction === 'agent' ? 'Running...' : 'Run agent'}
                </button>
              </div>
            </div>
          </section>

          {detailLoading && <div className="panel text-sm text-[#6f6578]">Loading evidence detail...</div>}

          {detail && (
            <>
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="metric-card">
                  <div className="metric-label">Declared inventory</div>
                  <div className="metric-value">{String(detail.coverage.declaredInventoryCount ?? 0)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Findings</div>
                  <div className="metric-value">{String(detail.coverage.scannerFindingCount ?? 0)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Alert rules</div>
                  <div className="metric-value">{String(detail.coverage.alertRuleCount ?? 0)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Tickets</div>
                  <div className="metric-value">{String(detail.coverage.ticketCount ?? 0)}</div>
                </div>
              </section>

              <AssuranceWorkflowPanel
                disabledMessage="Select an evidence job to load its workflow activity."
                emptyMessage="No workflow runs are linked to this evidence job yet."
                helperText="Trace evidence collection, deterministic evaluation, package builds, and bounded agent runs linked to this bundle."
                linkedRecordIds={[selectedJobId, lastBuiltPackageId, lastAgentRunId]}
              />

              <section className="grid min-w-0 gap-4 2xl:grid-cols-[0.82fr_1.18fr]">
                <section className="panel-subtle min-w-0">
                  <div className="label">Artifact preview</div>
                  <select className="input mt-3" onChange={(event) => selectPreviewFamily(event.target.value)} value={previewFamily}>
                    {families.map((family) => (
                      <option key={family} value={family}>
                        {family}
                      </option>
                    ))}
                  </select>
                  <pre className="mt-4 max-h-[460px] overflow-auto rounded-2xl border border-[#ded8e4] bg-[#f7f4f9] p-4 text-xs leading-6 text-[#4f435c]">
                    {preview ? toPreview(preview) : 'No preview available for the selected artifact family.'}
                  </pre>
                </section>

                <section className="min-w-0 space-y-4">
                  <AssuranceExplainPanel
                    audiences={[
                      { value: 'assessor', label: 'Assessor' },
                      { value: 'derivation', label: 'Derivation trace' },
                      { value: 'reasonableness', label: 'Reasonableness' },
                      { value: 'remediation', label: 'Remediation' },
                    ]}
                    defaultAudience="assessor"
                    disabled={!detail || !evaluation}
                    focusOptions={explanationFocusOptions}
                    heading="Evidence explainer"
                    helperText="Generate a grounded explanation for the current evidence job, its proof-chain evaluations, or a specific gap."
                    loadExplanation={({ audience, focusId, question }) =>
                      explainAssurance({
                        audience,
                        evidenceJobId: selectedJobId,
                        focusId,
                        question,
                      })
                    }
                    requestKey={`${selectedJobId}:${evaluation?.summary.generatedAt ?? 'none'}`}
                  />

                  <div className="panel-subtle">
                    <div className="label">Artifacts</div>
                    <div className="mt-3 grid gap-2">
                      {detail.artifacts.map((artifact) => (
                        <button
                          key={artifact.id}
                          className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left text-sm transition ${
                            previewFamily === artifact.artifactFamily
                              ? 'border-[#b891f2] bg-[#f2e8ff]'
                              : 'border-[#ded8e4] bg-white hover:border-[#d7c3f1] hover:bg-[#f7f2ff]'
                          }`}
                          onClick={() => selectPreviewFamily(artifact.artifactFamily)}
                          type="button"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-[#241232]">{artifact.artifactFamily}</div>
                            <div className="font-mono text-xs text-[#62576a]">{artifact.objectKey}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-[#6f6578]">{formatDate(artifact.createdAt)}</div>
                            {previewFamily === artifact.artifactFamily ? <div className="mt-1 text-[11px] text-[#6f20c9]">Previewing</div> : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="panel-subtle">
                    <div className="label">Evaluation summary</div>
                    {evaluation ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="metric-card">
                          <div className="metric-label">PASS</div>
                          <div className="metric-value">{evaluation.summary.passingEvaluations}</div>
                        </div>
                        <div className="metric-card">
                          <div className="metric-label">PARTIAL</div>
                          <div className="metric-value">{evaluation.summary.partialEvaluations}</div>
                        </div>
                        <div className="metric-card">
                          <div className="metric-label">FAIL</div>
                          <div className="metric-value">{evaluation.summary.failingEvaluations}</div>
                        </div>
                        <div className="metric-card">
                          <div className="metric-label">POA&amp;M</div>
                          <div className="metric-value">{evaluation.summary.poamOpenItems}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-[#6f6578]">No assurance evaluation has been generated for this evidence job yet.</div>
                    )}
                  </div>

                  {evaluation && (
                    <>
                      <div className="grid min-w-0 gap-4 2xl:grid-cols-3">
                        <div className="panel-subtle">
                          <div className="label">Collection coverage</div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-[#ded8e4] bg-white px-3 py-3 text-sm">
                              <div className="text-xs uppercase tracking-normal text-[#62576a]">Provider</div>
                              <div className="mt-2 font-medium text-[#241232]">
                                {String(evaluation.liveCollectionCoverage.provider ?? detail.sourceName ?? 'unknown')}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-[#ded8e4] bg-white px-3 py-3 text-sm">
                              <div className="text-xs uppercase tracking-normal text-[#62576a]">Collected</div>
                              <div className="mt-2 font-medium text-[#241232]">{formatDate(String(evaluation.liveCollectionCoverage.collectedAt ?? detail.finishedAt ?? ''))}</div>
                            </div>
                          </div>
                          <div className="mt-3 space-y-2">
                            {coverageEntries.map(([key, value]) => (
                              <div key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-[#ded8e4] bg-white px-3 py-3 text-sm">
                                <div className="text-[#4f435c]">{humanizeKey(key)}</div>
                                <div className="font-mono text-[#6f20c9]">{String(value)}</div>
                              </div>
                            ))}
                            {coverageEntries.length === 0 && (
                              <div className="text-sm text-[#6f6578]">No live coverage metrics were published for this evidence job.</div>
                            )}
                          </div>
                        </div>

                        <div className="panel-subtle">
                          <div className="label">Reasonableness findings</div>
                          <div className="mt-3 space-y-2">
                            {evaluation.reasonablenessFindings.map((item) => (
                              <div key={item.id} className="rounded-2xl border border-[#ded8e4] bg-white px-3 py-3">
                                <div className="flex min-w-0 items-center justify-between gap-3">
                                  <div className="min-w-0 break-words text-sm font-medium text-[#241232]">{item.title}</div>
                                  <RegStatusPill tone={evalStatusTone(item.status)}>{item.status}</RegStatusPill>
                                </div>
                                <div className="mt-2 text-xs leading-5 text-[#6f6578]">{item.detail}</div>
                                {(item.cadence || item.coverage || (item.controlRefs?.length ?? 0) > 0) && (
                                  <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[#62576a]">
                                    {item.cadence ? <span>Cadence: {item.cadence}</span> : null}
                                    {item.coverage ? <span>Coverage: {item.coverage}</span> : null}
                                    {(item.controlRefs?.length ?? 0) > 0 ? <span>Controls: {item.controlRefs?.join(', ')}</span> : null}
                                  </div>
                                )}
                              </div>
                            ))}
                            {evaluation.reasonablenessFindings.length === 0 && (
                              <div className="text-sm text-[#6f6578]">No reasonableness exceptions are open for the current evidence bundle.</div>
                            )}
                          </div>
                        </div>

                        <div className="panel-subtle">
                          <div className="label">Pending review recommendations</div>
                          <div className="mt-3 space-y-2">
                            {evaluation.reviewRecommendations.slice(0, 6).map((item) => (
                              <Link
                                key={item.id}
                                className="block rounded-2xl border border-[#ded8e4] bg-white px-3 py-3 transition hover:border-[#b891f2] hover:bg-[#f7f2ff]"
                                to={`/assurance/reviews?recommendationId=${encodeURIComponent(item.id)}&evidenceJobId=${encodeURIComponent(selectedJobId)}`}
                              >
                                <div className="flex min-w-0 items-center justify-between gap-3">
                                  <div className="min-w-0 break-words text-sm font-medium text-[#241232]">{item.title}</div>
                                  <RegStatusPill tone={severityTone(String(item.recommendation.severity ?? 'unknown'))}>
                                    {String(item.recommendation.severity ?? 'pending')}
                                  </RegStatusPill>
                                </div>
                                <div className="mt-2 text-xs leading-5 text-[#6f6578]">{item.summary}</div>
                              </Link>
                            ))}
                            {evaluation.reviewRecommendations.length === 0 && (
                              <div className="text-sm text-[#6f6578]">No review recommendations are waiting on this evidence job.</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid min-w-0 gap-4 2xl:grid-cols-2">
                      <div className="panel-subtle min-w-0">
                        <div className="label">Top failing checks</div>
                        <div className="mt-3 space-y-2">
                          {evaluation.evalResults
                            .filter((item) => item.status !== 'PASS')
                            .slice(0, 6)
                            .map((item) => (
                              <div key={item.id} className="rounded-2xl border border-[#ded8e4] bg-white px-3 py-3">
                                <div className="flex min-w-0 items-center justify-between gap-3">
                                  <div className="min-w-0 break-words text-sm font-medium text-[#241232]">{item.title}</div>
                                  <RegStatusPill tone={evalStatusTone(item.status)}>{item.status}</RegStatusPill>
                                </div>
                                <div className="mt-2 text-xs leading-5 text-[#6f6578]">{item.summary}</div>
                              </div>
                            ))}
                          {evaluation.evalResults.filter((item) => item.status !== 'PASS').length === 0 && (
                            <div className="text-sm text-[#6f6578]">All deterministic checks currently pass.</div>
                          )}
                        </div>
                      </div>

                      <div className="panel-subtle min-w-0">
                        <div className="label">Open gaps</div>
                        <div className="mt-3 space-y-2">
                          {evaluation.gaps.slice(0, 6).map((gap) => (
                            <div key={gap.id} className="rounded-2xl border border-[#ded8e4] bg-white px-3 py-3">
                              <div className="flex min-w-0 items-center justify-between gap-3">
                                <div className="min-w-0 break-words text-sm font-medium text-[#241232]">{gap.title}</div>
                                <RegStatusPill tone={severityTone(gap.severity)}>
                                  {gap.severity}
                                </RegStatusPill>
                              </div>
                              <div className="mt-2 text-xs leading-5 text-[#6f6578]">{gap.detail}</div>
                            </div>
                          ))}
                          {evaluation.gaps.length === 0 && (
                            <div className="text-sm text-[#6f6578]">No open evidence gaps were generated from the current run.</div>
                          )}
                        </div>
                      </div>
                      </div>

                      <div className="grid min-w-0 gap-4 2xl:grid-cols-[0.9fr_1.1fr]">
                        <div className="panel-subtle min-w-0">
                          <div className="label">POA&amp;M queue</div>
                          <div className="mt-3 space-y-2">
                            {evaluation.poamItems.slice(0, 6).map((item) => (
                              <div key={item.id} className="rounded-2xl border border-[#ded8e4] bg-white px-3 py-3">
                                <div className="flex min-w-0 items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="break-words text-sm font-medium text-[#241232]">{item.identifier}</div>
                                    <div className="mt-1 text-xs text-[#62576a]">{item.weaknessName}</div>
                                  </div>
                                  <RegStatusPill tone={severityTone(item.severity)}>{item.severity}</RegStatusPill>
                                </div>
                                <div className="mt-2 text-xs leading-5 text-[#6f6578]">{item.plannedRemediation}</div>
                                <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#62576a]">
                                  <span>Status: {item.status}</span>
                                  <span>Due: {formatDate(item.milestoneDueDate)}</span>
                                  {item.sourceEvalCode && <span>{item.sourceEvalCode}</span>}
                                </div>
                              </div>
                            ))}
                            {evaluation.poamItems.length === 0 && (
                              <div className="text-sm text-[#6f6578]">No POA&amp;M items were generated for this evidence job.</div>
                            )}
                          </div>
                        </div>

                        <div className="panel-subtle min-w-0">
                          <div className="label">Evidence graph</div>
                          <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                            <div className="metric-card">
                              <div className="metric-label">Nodes</div>
                              <div className="metric-value">{evaluation.graph.nodes.length}</div>
                            </div>
                            <div className="metric-card">
                              <div className="metric-label">Edges</div>
                              <div className="metric-value">{evaluation.graph.edges.length}</div>
                            </div>
                            <div className="metric-card">
                              <div className="metric-label">Node types</div>
                              <div className="metric-value">{graphNodeTypeCounts.length}</div>
                            </div>
                            <div className="metric-card">
                              <div className="metric-label">Edge types</div>
                              <div className="metric-value">{graphEdgeTypeCounts.length}</div>
                            </div>
                          </div>
                          <div className="mt-4 grid min-w-0 gap-4 2xl:grid-cols-[0.78fr_1.22fr]">
                            <div className="min-w-0 space-y-4">
                              <div>
                                <div className="label">Node types</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {graphNodeTypeCounts.map(([type, count]) => (
                                    <span key={type} className="rounded-full border border-[#ded8e4] bg-[#f7f4f9] px-3 py-1 text-xs text-[#4f435c]">
                                      {humanizeKey(type)}: <span className="font-mono text-[#6f20c9]">{count}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="label">Edge types</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {graphEdgeTypeCounts.map(([type, count]) => (
                                    <span key={type} className="rounded-full border border-[#ded8e4] bg-[#f7f4f9] px-3 py-1 text-xs text-[#4f435c]">
                                      {humanizeKey(type)}: <span className="font-mono text-[#6f20c9]">{count}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="label">Inspect node</div>
                                <select className="input mt-3" onChange={(event) => setSelectedGraphNodeKey(event.target.value)} value={selectedGraphNodeKey}>
                                  {(evaluation.graph.nodes ?? []).map((node) => (
                                    <option key={node.key} value={node.key}>
                                      {node.label} · {humanizeKey(node.type)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="min-w-0 space-y-4">
                              {selectedGraphNode ? (
                                <>
                                  <div className="rounded-2xl border border-[#ded8e4] bg-white px-3 py-3">
                                    <div className="flex min-w-0 items-center justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="break-words text-sm font-medium text-[#241232]">{selectedGraphNode.label}</div>
                                        <div className="mt-1 text-xs text-[#62576a]">{humanizeKey(selectedGraphNode.type)}</div>
                                      </div>
                                      <span className="max-w-[45%] overflow-hidden text-ellipsis font-mono text-xs text-[#6f20c9]">{selectedGraphNode.key}</span>
                                    </div>
                                    <pre className="mt-3 max-h-[180px] overflow-auto rounded-2xl border border-[#ded8e4] bg-[#f7f4f9] p-3 text-xs leading-6 text-[#4f435c]">
                                      {JSON.stringify(selectedGraphNode.attributes, null, 2)}
                                    </pre>
                                  </div>
                                  <div className="rounded-2xl border border-[#ded8e4] bg-white px-3 py-3">
                                    <div className="label">Connected records</div>
                                    <div className="mt-3 space-y-2">
                                      {selectedGraphConnections.map((connection, index) => (
                                        <div key={`${connection.relatedNodeKey}:${connection.edgeType}:${index}`} className="rounded-2xl border border-[#ded8e4] bg-[#f7f4f9] px-3 py-3">
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm font-medium text-[#241232]">
                                              {connection.relatedNode?.label ?? connection.relatedNodeKey}
                                            </div>
                                            <RegStatusPill tone="neutral">{connection.direction}</RegStatusPill>
                                          </div>
                                          <div className="mt-2 text-xs text-[#6f6578]">
                                            {humanizeKey(connection.edgeType)} · {connection.relatedNode ? humanizeKey(connection.relatedNode.type) : 'Unknown node'}
                                          </div>
                                        </div>
                                      ))}
                                      {selectedGraphConnections.length === 0 && (
                                        <div className="text-sm text-[#6f6578]">This graph node does not have any linked edges.</div>
                                      )}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="text-sm text-[#6f6578]">No graph nodes are available for inspection.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </section>
              </section>
            </>
          )}
        </section>
      </section>

      <RegModal
        open={pendingJobAction !== null}
        onOpenChange={(open) => {
          if (!open && busyAction === null) {
            setPendingJobAction(null);
          }
        }}
        title={
          pendingJobAction === 'evaluate'
            ? 'Run deterministic evaluation'
            : pendingJobAction === 'package'
              ? 'Build 20x package'
              : 'Run assurance agent'
        }
        description="Review the selected evidence job before starting a downstream assurance action."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" disabled={busyAction !== null} onClick={() => setPendingJobAction(null)} type="button">
              Cancel
            </button>
            {pendingJobAction === 'evaluate' ? (
              <button className="button-primary" disabled={busyAction !== null || !detail} onClick={() => void handleRunEvaluation()} type="button">
                {busyAction === 'evaluate' ? 'Running evaluation...' : 'Run evaluation'}
              </button>
            ) : null}
            {pendingJobAction === 'package' ? (
              <button className="button-primary" disabled={busyAction !== null || !detail} onClick={() => void handleBuildPackage()} type="button">
                {busyAction === 'package' ? 'Building package...' : 'Build package'}
              </button>
            ) : null}
            {pendingJobAction === 'agent' ? (
              <button className="button-primary" disabled={busyAction !== null || !detail} onClick={() => void handleRunAgent()} type="button">
                {busyAction === 'agent' ? 'Running agent...' : 'Run agent'}
              </button>
            ) : null}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-[#ded8e4] bg-[#f7f4f9] p-4">
            <div className="text-sm font-semibold text-[#241232]">{detail?.sourceName ?? 'No evidence job selected'}</div>
            <div className="mt-2 break-all font-mono text-xs text-[#6f20c9]">{selectedJobId || 'No evidence job id'}</div>
            <div className="mt-3 grid gap-2 text-sm text-[#4f435c] sm:grid-cols-2">
              <div>Folder: {detail?.folderId ?? 'Tenant-wide'}</div>
              <div>Artifacts: {detail?.artifacts.length ?? 0}</div>
              <div>Finished: {formatDate(detail?.finishedAt)}</div>
              <div>Evaluation: {evaluation ? `generated ${formatDate(evaluation.summary.generatedAt)}` : 'not generated yet'}</div>
            </div>
          </div>

          {pendingJobAction === 'evaluate' ? (
            <div className="text-sm leading-6 text-[#4f435c]">
              This will refresh deterministic pass, partial, and fail outputs for the selected evidence bundle. These checks remain the source of status truth before explanations or downstream packages are generated.
            </div>
          ) : null}
          {pendingJobAction === 'package' ? (
            <div className="text-sm leading-6 text-[#4f435c]">
              This will create a downstream 20x package from the current evidence job and folder context. Review deterministic outputs first when possible so package readiness reflects the latest checks.
            </div>
          ) : null}
          {pendingJobAction === 'agent' ? (
            <div className="text-sm leading-6 text-[#4f435c]">
              This will start a bounded assurance agent run with requested writebacks enabled. Any suggested writebacks still need explicit review in the agent run inspector before they affect mapped records.
            </div>
          ) : null}
        </div>
      </RegModal>
    </div>
  );
}
