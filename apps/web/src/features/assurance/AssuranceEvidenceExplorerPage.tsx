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
import { CoachMarksPanel } from '../../components/CoachMarksPanel';
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

function severityBadgeClass(value: string | null | undefined) {
  if (!value) {
    return 'badge-neutral';
  }
  switch (value.toLowerCase()) {
    case 'critical':
    case 'high':
      return 'badge-danger';
    case 'moderate':
    case 'medium':
      return 'badge-neutral';
    default:
      return 'badge-success';
  }
}

function evalStatusBadgeClass(status: string) {
  switch (status) {
    case 'FAIL':
      return 'badge-danger';
    case 'PARTIAL':
      return 'badge-neutral';
    default:
      return 'badge-success';
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
  const coachMarkItems = [
    {
      id: 'evidence-bundles',
      eyebrow: 'Bundles',
      title: 'Each evidence job becomes a normalized bundle',
      body: 'This is the grounded record that later evaluations, reviews, packages, and agent runs refer back to.',
      route: detail?.id ? `/assurance/evidence?evidenceJobId=${encodeURIComponent(detail.id)}` : '/assurance/evidence',
      ctaLabel: 'Stay in explorer',
    },
    {
      id: 'evidence-evals',
      eyebrow: 'Deterministic checks',
      title: 'Run evaluations before asking for explanations',
      body: 'The pass, partial, and fail states here are meant to come from deterministic checks first, not from AI narration.',
      tone: 'focus' as const,
    },
    {
      id: 'evidence-packages',
      eyebrow: 'Outputs',
      title: 'Packages are downstream of evidence',
      body: 'Once evidence and evaluations look right, build the 20x package from this same job instead of jumping to a separate export flow.',
      route: lastBuiltPackageId ? `/assurance/packages?packageId=${encodeURIComponent(lastBuiltPackageId)}` : '/assurance/packages',
      ctaLabel: 'Open packages',
    },
    {
      id: 'evidence-agent',
      eyebrow: 'Automation',
      title: 'Agent runs should stay traceable',
      body: 'If you hand this bundle to automation, the next stop should still be a bounded, inspectable agent run with explicit review gates.',
      route: lastAgentRunId ? `/assurance/agent-runs?runId=${encodeURIComponent(lastAgentRunId)}` : '/assurance/agent-runs',
      ctaLabel: 'Open agent runs',
    },
  ];

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run the assurance evaluation.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleBuildPackage() {
    if (!selectedJobId) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to build the 20x package.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRunAgent() {
    if (!selectedJobId) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run the assurance agent.');
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Assurance</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Evidence Explorer</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Inspect normalized evidence bundles, deterministic assurance outputs, artifact previews, and downstream package or agent actions from one explorer.
        </p>
      </section>

      <CoachMarksPanel
        storageKey="assurance-evidence-explorer"
        title="Use Evidence Explorer to understand the source record before you package it."
        description="This page is the best place to confirm what was actually collected, what deterministic checks concluded, and what downstream actions will inherit from this evidence bundle."
        items={coachMarkItems}
      />

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <section className="space-y-4">
          <div className="panel">
            <div className="flex items-center justify-between">
              <div>
                <div className="label">Evidence jobs</div>
                <div className="mt-1 text-sm text-slate-400">Latest normalized evidence runs available to your current identity.</div>
              </div>
              <button className="button-secondary" onClick={() => void loadJobs()} type="button">
                Refresh
              </button>
            </div>
          </div>

          <section className="space-y-3">
            {jobs.map((job) => (
              <button
                key={job.id}
                className={`panel w-full text-left transition ${selectedJobId === job.id ? 'border-cyan-400/30 bg-cyan-400/10' : ''}`}
                onClick={() => setSelectedJobId(job.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="eyebrow">{job.bundleKind}</div>
                    <h2 className="mt-2 text-lg font-semibold text-white">{job.sourceName}</h2>
                    <div className="mt-2 font-mono text-xs text-cyan-200">{job.id}</div>
                  </div>
                  <span className={job.status === 'success' ? 'badge-success' : job.status === 'failed' ? 'badge-danger' : 'badge-neutral'}>
                    {job.status}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 text-xs text-slate-400 sm:grid-cols-2">
                  <div>Input: {job.inputMode}</div>
                  <div>Normalized: {job.normalizationStatus}</div>
                  <div>Artifacts: {job.artifactCount}</div>
                  <div>Started: {formatDate(job.startedAt)}</div>
                </div>
              </button>
            ))}

            {!loading && jobs.length === 0 && (
              <div className="panel text-sm text-slate-400">No evidence jobs are available for the current scope.</div>
            )}
            {loading && <div className="panel text-sm text-slate-400">Loading evidence jobs...</div>}
          </section>
        </section>

        <section className="space-y-4">
          <section className="panel">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="label">Selected evidence job</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">{detail?.sourceName ?? 'Select a job'}</h2>
                <div className="mt-2 font-mono text-xs text-cyan-200">{detail?.id ?? '—'}</div>
                <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
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
                <button className="button-primary" disabled={!detail || busyAction === 'evaluate'} onClick={() => void handleRunEvaluation()} type="button">
                  <PlayCircle className="mr-2 h-4 w-4" />
                  {busyAction === 'evaluate' ? 'Running...' : 'Run eval'}
                </button>
                <button className="button-secondary" disabled={!detail || busyAction === 'package'} onClick={() => void handleBuildPackage()} type="button">
                  <FileOutput className="mr-2 h-4 w-4" />
                  {busyAction === 'package' ? 'Building...' : 'Build 20x'}
                </button>
                <button className="button-secondary" disabled={!detail || busyAction === 'agent'} onClick={() => void handleRunAgent()} type="button">
                  <Bot className="mr-2 h-4 w-4" />
                  {busyAction === 'agent' ? 'Running...' : 'Run agent'}
                </button>
              </div>
            </div>
          </section>

          {detailLoading && <div className="panel text-sm text-slate-400">Loading evidence detail...</div>}

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

              <section className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
                <section className="panel-subtle">
                  <div className="label">Artifact preview</div>
                  <select className="input mt-3" onChange={(event) => selectPreviewFamily(event.target.value)} value={previewFamily}>
                    {families.map((family) => (
                      <option key={family} value={family}>
                        {family}
                      </option>
                    ))}
                  </select>
                  <pre className="mt-4 max-h-[460px] overflow-auto rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-xs leading-6 text-slate-300">
                    {preview ? toPreview(preview) : 'No preview available for the selected artifact family.'}
                  </pre>
                </section>

                <section className="space-y-4">
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
                              ? 'border-cyan-300/30 bg-cyan-400/[0.06]'
                              : 'border-white/8 bg-black/15 hover:border-cyan-300/20 hover:bg-cyan-400/[0.03]'
                          }`}
                          onClick={() => selectPreviewFamily(artifact.artifactFamily)}
                          type="button"
                        >
                          <div>
                            <div className="font-medium text-white">{artifact.artifactFamily}</div>
                            <div className="font-mono text-xs text-slate-500">{artifact.objectKey}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-400">{formatDate(artifact.createdAt)}</div>
                            {previewFamily === artifact.artifactFamily ? <div className="mt-1 text-[11px] text-cyan-200">Previewing</div> : null}
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
                      <div className="mt-3 text-sm text-slate-400">No assurance evaluation has been generated for this evidence job yet.</div>
                    )}
                  </div>

                  {evaluation && (
                    <>
                      <div className="grid gap-4 xl:grid-cols-3">
                        <div className="panel-subtle">
                          <div className="label">Collection coverage</div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm">
                              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Provider</div>
                              <div className="mt-2 font-medium text-white">
                                {String(evaluation.liveCollectionCoverage.provider ?? detail.sourceName ?? 'unknown')}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm">
                              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Collected</div>
                              <div className="mt-2 font-medium text-white">{formatDate(String(evaluation.liveCollectionCoverage.collectedAt ?? detail.finishedAt ?? ''))}</div>
                            </div>
                          </div>
                          <div className="mt-3 space-y-2">
                            {coverageEntries.map(([key, value]) => (
                              <div key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm">
                                <div className="text-slate-300">{humanizeKey(key)}</div>
                                <div className="font-mono text-cyan-200">{String(value)}</div>
                              </div>
                            ))}
                            {coverageEntries.length === 0 && (
                              <div className="text-sm text-slate-400">No live coverage metrics were published for this evidence job.</div>
                            )}
                          </div>
                        </div>

                        <div className="panel-subtle">
                          <div className="label">Reasonableness findings</div>
                          <div className="mt-3 space-y-2">
                            {evaluation.reasonablenessFindings.map((item) => (
                              <div key={item.id} className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-medium text-white">{item.title}</div>
                                  <span className={evalStatusBadgeClass(item.status)}>{item.status}</span>
                                </div>
                                <div className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</div>
                                {(item.cadence || item.coverage || (item.controlRefs?.length ?? 0) > 0) && (
                                  <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
                                    {item.cadence ? <span>Cadence: {item.cadence}</span> : null}
                                    {item.coverage ? <span>Coverage: {item.coverage}</span> : null}
                                    {(item.controlRefs?.length ?? 0) > 0 ? <span>Controls: {item.controlRefs?.join(', ')}</span> : null}
                                  </div>
                                )}
                              </div>
                            ))}
                            {evaluation.reasonablenessFindings.length === 0 && (
                              <div className="text-sm text-slate-400">No reasonableness exceptions are open for the current evidence bundle.</div>
                            )}
                          </div>
                        </div>

                        <div className="panel-subtle">
                          <div className="label">Pending review recommendations</div>
                          <div className="mt-3 space-y-2">
                            {evaluation.reviewRecommendations.slice(0, 6).map((item) => (
                              <Link
                                key={item.id}
                                className="block rounded-2xl border border-white/8 bg-black/15 px-3 py-3 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                                to={`/assurance/reviews?recommendationId=${encodeURIComponent(item.id)}&evidenceJobId=${encodeURIComponent(selectedJobId)}`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-medium text-white">{item.title}</div>
                                  <span className={severityBadgeClass(String(item.recommendation.severity ?? 'unknown'))}>
                                    {String(item.recommendation.severity ?? 'pending')}
                                  </span>
                                </div>
                                <div className="mt-2 text-xs leading-5 text-slate-400">{item.summary}</div>
                              </Link>
                            ))}
                            {evaluation.reviewRecommendations.length === 0 && (
                              <div className="text-sm text-slate-400">No review recommendations are waiting on this evidence job.</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                      <div className="panel-subtle">
                        <div className="label">Top failing checks</div>
                        <div className="mt-3 space-y-2">
                          {evaluation.evalResults
                            .filter((item) => item.status !== 'PASS')
                            .slice(0, 6)
                            .map((item) => (
                              <div key={item.id} className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-medium text-white">{item.title}</div>
                                  <span className={item.status === 'FAIL' ? 'badge-danger' : 'badge-neutral'}>{item.status}</span>
                                </div>
                                <div className="mt-2 text-xs leading-5 text-slate-400">{item.summary}</div>
                              </div>
                            ))}
                          {evaluation.evalResults.filter((item) => item.status !== 'PASS').length === 0 && (
                            <div className="text-sm text-slate-400">All deterministic checks currently pass.</div>
                          )}
                        </div>
                      </div>

                      <div className="panel-subtle">
                        <div className="label">Open gaps</div>
                        <div className="mt-3 space-y-2">
                          {evaluation.gaps.slice(0, 6).map((gap) => (
                            <div key={gap.id} className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-medium text-white">{gap.title}</div>
                                <span className={gap.severity === 'critical' || gap.severity === 'high' ? 'badge-danger' : 'badge-neutral'}>
                                  {gap.severity}
                                </span>
                              </div>
                              <div className="mt-2 text-xs leading-5 text-slate-400">{gap.detail}</div>
                            </div>
                          ))}
                          {evaluation.gaps.length === 0 && (
                            <div className="text-sm text-slate-400">No open evidence gaps were generated from the current run.</div>
                          )}
                        </div>
                      </div>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                        <div className="panel-subtle">
                          <div className="label">POA&amp;M queue</div>
                          <div className="mt-3 space-y-2">
                            {evaluation.poamItems.slice(0, 6).map((item) => (
                              <div key={item.id} className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-medium text-white">{item.identifier}</div>
                                    <div className="mt-1 text-xs text-slate-500">{item.weaknessName}</div>
                                  </div>
                                  <span className={severityBadgeClass(item.severity)}>{item.severity}</span>
                                </div>
                                <div className="mt-2 text-xs leading-5 text-slate-400">{item.plannedRemediation}</div>
                                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                                  <span>Status: {item.status}</span>
                                  <span>Due: {formatDate(item.milestoneDueDate)}</span>
                                  {item.sourceEvalCode && <span>{item.sourceEvalCode}</span>}
                                </div>
                              </div>
                            ))}
                            {evaluation.poamItems.length === 0 && (
                              <div className="text-sm text-slate-400">No POA&amp;M items were generated for this evidence job.</div>
                            )}
                          </div>
                        </div>

                        <div className="panel-subtle">
                          <div className="label">Evidence graph</div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                          <div className="mt-4 grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
                            <div className="space-y-4">
                              <div>
                                <div className="label">Node types</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {graphNodeTypeCounts.map(([type, count]) => (
                                    <span key={type} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">
                                      {humanizeKey(type)}: <span className="font-mono text-cyan-200">{count}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="label">Edge types</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {graphEdgeTypeCounts.map(([type, count]) => (
                                    <span key={type} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">
                                      {humanizeKey(type)}: <span className="font-mono text-cyan-200">{count}</span>
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

                            <div className="space-y-4">
                              {selectedGraphNode ? (
                                <>
                                  <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <div>
                                        <div className="text-sm font-medium text-white">{selectedGraphNode.label}</div>
                                        <div className="mt-1 text-xs text-slate-500">{humanizeKey(selectedGraphNode.type)}</div>
                                      </div>
                                      <span className="font-mono text-xs text-cyan-200">{selectedGraphNode.key}</span>
                                    </div>
                                    <pre className="mt-3 max-h-[180px] overflow-auto rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-xs leading-6 text-slate-300">
                                      {JSON.stringify(selectedGraphNode.attributes, null, 2)}
                                    </pre>
                                  </div>
                                  <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                                    <div className="label">Connected records</div>
                                    <div className="mt-3 space-y-2">
                                      {selectedGraphConnections.map((connection, index) => (
                                        <div key={`${connection.relatedNodeKey}:${connection.edgeType}:${index}`} className="rounded-2xl border border-white/8 bg-slate-950/50 px-3 py-3">
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm font-medium text-white">
                                              {connection.relatedNode?.label ?? connection.relatedNodeKey}
                                            </div>
                                            <span className="badge-neutral">{connection.direction}</span>
                                          </div>
                                          <div className="mt-2 text-xs text-slate-400">
                                            {humanizeKey(connection.edgeType)} · {connection.relatedNode ? humanizeKey(connection.relatedNode.type) : 'Unknown node'}
                                          </div>
                                        </div>
                                      ))}
                                      {selectedGraphConnections.length === 0 && (
                                        <div className="text-sm text-slate-400">This graph node does not have any linked edges.</div>
                                      )}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="text-sm text-slate-400">No graph nodes are available for inspection.</div>
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
    </div>
  );
}
