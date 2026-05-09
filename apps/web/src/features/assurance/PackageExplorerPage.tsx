import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { explainAssurance, getPackage, getPackageArtifactPreview, getPackageDocument, listPackages, listReviewHistory } from './api';
import { AssuranceExplainPanel } from './AssuranceExplainPanel';
import { AssuranceWorkflowPanel } from './AssuranceWorkflowPanel';
import type { AssuranceArtifactPreview, AssuranceExplainAudience, PackageDetail, PackageListItem, ReviewDecision, TwentyXPackageDocument } from './types';
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

function packageStatusBadgeClass(value: string | null | undefined) {
  if (!value) {
    return 'badge-neutral';
  }
  switch (value.toLowerCase()) {
    case 'matched':
    case 'ready':
    case 'pass':
    case 'accepted':
    case 'complete':
    case 'completed':
    case 'closed':
      return 'badge-success';
    case 'mismatch':
    case 'failed':
    case 'fail':
    case 'rejected':
    case 'blocked':
      return 'badge-danger';
    default:
      return 'badge-neutral';
  }
}

function evaluationStatusBadgeClass(value: string) {
  switch (value) {
    case 'FAIL':
      return 'badge-danger';
    case 'PARTIAL':
      return 'badge-neutral';
    default:
      return 'badge-success';
  }
}

function severityBadgeClass(value: string | null | undefined) {
  switch ((value ?? '').toLowerCase()) {
    case 'critical':
    case 'high':
      return 'badge-danger';
    case 'medium':
      return 'badge-neutral';
    case 'low':
      return 'badge-success';
    default:
      return 'badge-neutral';
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

function reportRoleDescription(value: string) {
  switch (value) {
    case 'assessor':
      return 'Detailed proof-chain narrative for assessor review.';
    case 'executive':
      return 'Leadership summary focused on posture, evidence gaps, and exposure.';
    case 'ao':
      return 'Residual-risk framing for authorizing-official review.';
    case 'assessor_poam_md':
      return 'Human-readable POA&M report for assessor review and remediation tracking.';
    default:
      return 'Generated package artifact.';
  }
}

function reportRoleAudience(value: string): AssuranceExplainAudience | null {
  switch (value) {
    case 'assessor':
    case 'executive':
    case 'ao':
      return value;
    case 'assessor_poam_md':
      return 'remediation';
    default:
      return null;
  }
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

function toRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown, fallback = '—') {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isAgentLineageFamily(value: string) {
  return (
    value === 'agent_eval_results' ||
    value === 'agent_risk_report' ||
    value === 'agent_poam' ||
    value === 'agent_instrumentation_plan' ||
    value === 'secure_agent_architecture'
  );
}

function isExplainAudience(value: string | null): value is AssuranceExplainAudience {
  return value === 'assessor' || value === 'executive' || value === 'ao' || value === 'derivation' || value === 'reasonableness' || value === 'remediation' || value === 'tracker';
}

function isPackageArtifactFamily(value: string | null) {
  return value === 'package_json' || value === 'review_ledger' || value === 'reconciliation' || value === 'validation_report' || value === 'report_manifest' || value === 'assessor' || value === 'executive' || value === 'ao' || value === 'assessor_poam_md';
}

export function PackageExplorerPage() {
  const { identity } = useEdgeIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const [packages, setPackages] = useState<PackageListItem[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [detail, setDetail] = useState<PackageDetail | null>(null);
  const [packageDocument, setPackageDocument] = useState<TwentyXPackageDocument | null>(null);
  const [reviewHistory, setReviewHistory] = useState<ReviewDecision[]>([]);
  const [previewFamily, setPreviewFamily] = useState('package_json');
  const [previewState, setPreviewState] = useState<AssuranceArtifactPreview | null>(null);
  const [preview, setPreview] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestedPackageId = searchParams.get('packageId') ?? '';
  const requestedPreviewFamily = searchParams.get('artifact');
  const requestedExplainAudience = searchParams.get('audience');
  const requestedFocusId = searchParams.get('focusId') ?? '';

  function updateSearchState(updates: {
    packageId?: string | null;
    artifact?: string | null;
    audience?: AssuranceExplainAudience | null;
    focusId?: string | null;
  }) {
    const next = new URLSearchParams(searchParams);
    const entries = [
      ['packageId', updates.packageId],
      ['artifact', updates.artifact],
      ['audience', updates.audience],
      ['focusId', updates.focusId],
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

  function selectExplanation(nextAudience: AssuranceExplainAudience, nextFocusId = '') {
    updateSearchState({
      audience: nextAudience,
      focusId: nextFocusId || null,
    });
  }

  async function loadPackages() {
    try {
      setLoading(true);
      setError(null);
      const data = await listPackages();
      setPackages(data);
      setSelectedPackageId((current) => {
        if (requestedPackageId && data.some((item) => item.id === requestedPackageId)) {
          return requestedPackageId;
        }
        return current || data[0]?.id || '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load assurance packages.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPackages();
  }, [identity.tenantId, identity.userId, requestedPackageId]);

  useEffect(() => {
    if (!requestedPackageId || requestedPackageId === selectedPackageId) {
      return;
    }
    if (packages.some((item) => item.id === requestedPackageId)) {
      setSelectedPackageId(requestedPackageId);
    }
  }, [packages, requestedPackageId, selectedPackageId]);

  useEffect(() => {
    const current = searchParams.get('packageId') ?? '';
    if (current === selectedPackageId || (!current && !selectedPackageId)) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (selectedPackageId) {
      next.set('packageId', selectedPackageId);
    } else {
      next.delete('packageId');
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, selectedPackageId, setSearchParams]);

  useEffect(() => {
    if (!selectedPackageId) {
      setDetail(null);
      setPackageDocument(null);
      setReviewHistory([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        setDetailLoading(true);
        const [next, nextPackageDocument] = await Promise.all([
          getPackage(selectedPackageId),
          getPackageDocument(selectedPackageId).catch(() => null),
        ]);
        const nextHistory = next.summary?.evidenceJobId
          ? await listReviewHistory(next.summary.evidenceJobId).catch(() => [])
          : [];
        if (!cancelled) {
          setDetail(next);
          setPackageDocument(nextPackageDocument);
          setReviewHistory(nextHistory);
          setPreviewFamily(isPackageArtifactFamily(requestedPreviewFamily) ? requestedPreviewFamily : 'package_json');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load the assurance package.');
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
  }, [selectedPackageId]);

  useEffect(() => {
    if (!isPackageArtifactFamily(requestedPreviewFamily)) {
      return;
    }
    if (requestedPreviewFamily !== previewFamily) {
      setPreviewFamily(requestedPreviewFamily);
    }
  }, [previewFamily, requestedPreviewFamily]);

  useEffect(() => {
    if (!selectedPackageId || !previewFamily) {
      setPreviewState(null);
      setPreview(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const artifact = await getPackageArtifactPreview(selectedPackageId, previewFamily);
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
  }, [previewFamily, selectedPackageId]);

  const acceptedReviewCount = useMemo(
    () => reviewHistory.filter((item) => item.decision.toLowerCase() === 'accepted').length,
    [reviewHistory],
  );
  const failedValidationResults = useMemo(
    () => packageDocument?.ksi_validation_results.filter((item) => item.status !== 'PASS') ?? [],
    [packageDocument],
  );
  const mismatchChecks = useMemo(
    () => detail?.reconciliation?.checks.filter((item) => item.status === 'mismatch') ?? [],
    [detail],
  );
  const reportBundleEntries = useMemo(
    () => packageDocument?.report_manifest ?? detail?.summary?.reportManifest ?? [],
    [detail, packageDocument],
  );
  const agentSecuritySummary = packageDocument?.agent_security_summary ?? null;
  const agentValidationResults = useMemo(
    () =>
      packageDocument?.ksi_validation_results.filter((item) => item.eval_code.startsWith('AGENT_')) ?? [],
    [packageDocument],
  );
  const failingAgentValidationResults = useMemo(
    () => agentValidationResults.filter((item) => item.status !== 'PASS'),
    [agentValidationResults],
  );
  const agentFindings = useMemo(
    () =>
      packageDocument?.findings
        .map((item) => toRecord(item))
        .filter((item) => {
          const sourceEvalCode = item.source_eval_code;
          return typeof sourceEvalCode === 'string' && sourceEvalCode.startsWith('AGENT_');
        }) ?? [],
    [packageDocument],
  );
  const agentPoamItems = useMemo(
    () => packageDocument?.poam_items.filter((item) => (item.sourceEvalCode ?? '').startsWith('AGENT_')) ?? [],
    [packageDocument],
  );
  const evidenceLinks = useMemo(
    () => packageDocument?.evidence_links ?? [],
    [packageDocument],
  );
  const reviewLedger = packageDocument?.review_ledger ?? null;
  const packageSummary = packageDocument?.summary ?? null;
  const validationPreview = useMemo(
    () => (previewFamily === 'validation_report' ? toRecord(preview) : null),
    [preview, previewFamily],
  );
  const validationChecks = useMemo(
    () =>
      validationPreview && Array.isArray(validationPreview.checks)
        ? validationPreview.checks.map((item) => toRecord(item))
        : [],
    [validationPreview],
  );
  const selectedPreviewItem = useMemo(
    () => previewState?.items[0] ?? null,
    [previewState],
  );
  const reviewLedgerDecisions = useMemo(
    () => reviewLedger?.decisions.slice(0, 6) ?? [],
    [reviewLedger],
  );
  const highlightedFindings = useMemo(
    () => packageDocument?.findings.slice(0, 6).map((item) => toRecord(item)) ?? [],
    [packageDocument],
  );
  const highlightedPoamItems = useMemo(
    () => packageDocument?.poam_items.slice(0, 6) ?? [],
    [packageDocument],
  );
  const explanationFocusOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    for (const item of failedValidationResults.slice(0, 8)) {
      options.push({
        value: item.eval_code,
        label: `Evaluation · ${item.status} · ${item.eval_code}`,
      });
    }
    for (const item of packageDocument?.findings.slice(0, 8) ?? []) {
      const finding = toRecord(item);
      options.push({
        value: readString(finding.id, `${readString(finding.gap_type)}:${readString(finding.title)}`),
        label: `Gap · ${humanizeKey(readString(finding.severity, 'unknown'))} · ${readString(finding.title, 'Untitled gap')}`,
      });
    }
    for (const item of packageDocument?.poam_items.slice(0, 8) ?? []) {
      options.push({
        value: item.id,
        label: `POA&M · ${humanizeKey(item.status)} · ${item.identifier}`,
      });
    }
    for (const item of reviewLedgerDecisions.slice(0, 8)) {
      options.push({
        value: item.id,
        label: `Review · ${humanizeKey(item.decision)} · ${item.recommendation_title}`,
      });
    }
    return options;
  }, [failedValidationResults, packageDocument, reviewLedgerDecisions]);

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Assurance</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">20x Package Explorer</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Browse generated package jobs, inspect deterministic rollups, and validate machine-to-human reconciliation before export or handoff.
        </p>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="space-y-3">
          <div className="panel">
            <div className="flex items-center justify-between">
              <div>
                <div className="label">Package jobs</div>
                <div className="mt-1 text-sm text-slate-400">Latest assurance packages available in your current scope.</div>
              </div>
              <button className="button-secondary" onClick={() => void loadPackages()} type="button">
                Refresh
              </button>
            </div>
          </div>

          {packages.map((item) => (
            <button
              key={item.id}
              className={`panel w-full text-left transition ${selectedPackageId === item.id ? 'border-cyan-400/30 bg-cyan-400/10' : ''}`}
              onClick={() => {
                setSelectedPackageId(item.id);
                updateSearchState({ packageId: item.id, focusId: null });
              }}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="eyebrow">{item.reconciliationStatus ?? 'pending'}</div>
                  <h2 className="mt-2 text-lg font-semibold text-white">{item.fileName}</h2>
                  <div className="mt-2 font-mono text-xs text-cyan-200">{item.id}</div>
                </div>
                <span className="badge-neutral">{item.status}</span>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                <div>Created: {formatDate(item.createdAt)}</div>
                <div>Evidence: {String(item.coverage.evaluationCount ?? 0)} evals</div>
              </div>
            </button>
          ))}

          {!loading && packages.length === 0 && (
            <div className="panel text-sm text-slate-400">No assurance packages are available yet.</div>
          )}
          {loading && <div className="panel text-sm text-slate-400">Loading package jobs...</div>}
        </section>

        <section className="space-y-4">
          {detailLoading && <div className="panel text-sm text-slate-400">Loading package detail...</div>}

          {detail && (
            <>
              <section className="panel">
                <div className="label">Selected package</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">{detail.job.fileName}</h2>
                <div className="mt-2 font-mono text-xs text-cyan-200">{detail.job.id}</div>
                <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
                  <div>Created: {formatDate(detail.job.createdAt)}</div>
                  <div>Updated: {formatDate(detail.job.updatedAt)}</div>
                  <div>Status: {detail.job.status}</div>
                  <div>Validation: {String(detail.job.coverage.validationStatus ?? 'unknown')}</div>
                  <div>Folder: {detail.job.folderId ?? 'Tenant-wide'}</div>
                  <div>Reconciliation: {String(detail.job.coverage.reconciliationStatus ?? detail.reconciliation?.status ?? 'pending')}</div>
                </div>
                {detail.summary?.evidenceJobId && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link className="button-secondary" to={`/assurance/evidence?evidenceJobId=${encodeURIComponent(detail.summary.evidenceJobId)}`}>
                      Open evidence bundle
                    </Link>
                    <Link className="button-secondary" to={`/assurance/reviews?evidenceJobId=${encodeURIComponent(detail.summary.evidenceJobId)}`}>
                      Open review history
                    </Link>
                  </div>
                )}
              </section>

              {detail.summary && (
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <div className="metric-card">
                    <div className="metric-label">Evaluations</div>
                    <div className="metric-value">{detail.summary.evaluationCount}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Gaps</div>
                    <div className="metric-value">{detail.summary.gapCount}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">POA&amp;M</div>
                    <div className="metric-value">{detail.summary.poamCount}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Generated</div>
                    <div className="metric-value text-base">{formatDate(detail.summary.generatedAt)}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Accepted Reviews</div>
                    <div className="metric-value">{acceptedReviewCount}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Validation</div>
                    <div className="metric-value text-base">{String(detail.job.coverage.validationStatus ?? 'unknown')}</div>
                  </div>
                </section>
              )}

              {mismatchChecks.length > 0 && (
                <section className="panel border-rose-500/20 bg-rose-500/[0.08]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="label text-rose-200">Mismatch triage</div>
                      <h3 className="mt-2 text-xl font-semibold text-white">
                        {mismatchChecks.length} reconciliation check{mismatchChecks.length === 1 ? '' : 's'} require attention
                      </h3>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-rose-100/85">
                        These mismatches mean the rendered handoff package does not fully align with the deterministic source state yet.
                      </p>
                    </div>
                    {detail.summary?.evidenceJobId && (
                      <Link className="button-secondary" to={`/assurance/evidence?evidenceJobId=${encodeURIComponent(detail.summary.evidenceJobId)}`}>
                        Trace back to evidence
                      </Link>
                    )}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {mismatchChecks.map((check) => (
                      <div key={check.id} className="rounded-2xl border border-rose-400/20 bg-black/20 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-white">{humanizeKey(check.id)}</div>
                          <span className="badge-danger">{check.status}</span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-rose-50/90 sm:grid-cols-2">
                          <div>Expected: {check.expected}</div>
                          <div>Actual: {check.actual}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {packageDocument && (
                <section className="grid gap-4 xl:grid-cols-4">
                  <div className="panel-subtle">
                    <div className="label">Validation rollup</div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                      <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">PASS</div>
                        <div className="mt-2 text-2xl font-semibold text-white">{packageDocument.summary.pass_count}</div>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">PARTIAL</div>
                        <div className="mt-2 text-2xl font-semibold text-white">{packageDocument.summary.partial_count}</div>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">FAIL</div>
                        <div className="mt-2 text-2xl font-semibold text-white">{packageDocument.summary.fail_count}</div>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">GAPS</div>
                        <div className="mt-2 text-2xl font-semibold text-white">{packageDocument.summary.gap_count}</div>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">REVIEWS</div>
                        <div className="mt-2 text-2xl font-semibold text-white">{packageDocument.summary.review_decision_count}</div>
                      </div>
                    </div>
                  </div>

                  <div className="panel-subtle">
                    <div className="label">Reconciliation posture</div>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                        <div className="text-sm text-slate-300">Status</div>
                        <span className={packageStatusBadgeClass(detail.reconciliation?.status ?? detail.job.status)}>
                          {detail.reconciliation?.status ?? detail.job.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                        <div className="text-sm text-slate-300">Checks</div>
                        <div className="font-mono text-cyan-200">{detail.reconciliation?.checks.length ?? 0}</div>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                        <div className="text-sm text-slate-300">Mismatches</div>
                        <div className="font-mono text-cyan-200">{mismatchChecks.length}</div>
                      </div>
                    </div>
                  </div>

                  <div className="panel-subtle">
                    <div className="label">Review ledger</div>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                        <div className="text-sm text-slate-300">Accepted</div>
                        <div className="font-mono text-cyan-200">{reviewLedger?.accepted_count ?? acceptedReviewCount}</div>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                        <div className="text-sm text-slate-300">Rejected</div>
                        <div className="font-mono text-cyan-200">{reviewLedger?.rejected_count ?? 0}</div>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                        <div className="text-sm text-slate-300">Other</div>
                        <div className="font-mono text-cyan-200">{reviewLedger?.other_count ?? 0}</div>
                      </div>
                    </div>
                  </div>

                  <div className="panel-subtle">
                    <div className="label">Package lineage</div>
                    <div className="mt-3 space-y-2 text-sm text-slate-300">
                      <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Schema</div>
                        <div className="mt-2 font-medium text-white">{packageDocument.metadata.schema_version}</div>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Generated</div>
                        <div className="mt-2 font-medium text-white">{formatDate(packageDocument.metadata.generated_at)}</div>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Bundle kind</div>
                        <div className="mt-2 font-medium text-white">{humanizeKey(packageDocument.metadata.bundle_kind ?? 'assessment')}</div>
                        <div className="mt-1 text-xs text-slate-500">{humanizeKey(packageDocument.metadata.input_mode ?? 'live')}</div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <AssuranceWorkflowPanel
                disabledMessage="Select a package to load its workflow activity."
                emptyMessage="No workflow runs are linked to this package yet."
                helperText="See package generation, reconciliation, review, and related evidence activity tied to the selected package."
                linkedRecordIds={[selectedPackageId, detail.summary?.evidenceJobId ?? '']}
              />

              <AssuranceExplainPanel
                audiences={[
                  { value: 'assessor', label: 'Assessor' },
                  { value: 'executive', label: 'Executive' },
                  { value: 'ao', label: 'Authorizing official' },
                  { value: 'derivation', label: 'Derivation trace' },
                  { value: 'remediation', label: 'Remediation focus' },
                ]}
                defaultAudience="executive"
                disabled={!detail.summary?.evidenceJobId}
                focusOptions={explanationFocusOptions}
                heading="Package explainer"
                initialAudience={isExplainAudience(requestedExplainAudience) ? requestedExplainAudience : 'executive'}
                initialFocusId={requestedFocusId}
                helperText="Translate the deterministic package state into an audience-specific explanation, or drill into a failed evaluation, gap, POA&M item, or review decision."
                loadExplanation={({ audience, focusId, question }) =>
                  explainAssurance({
                    audience,
                    evidenceJobId: detail.summary?.evidenceJobId,
                    focusId,
                    question,
                  })
                }
                onAudienceChange={(audience) => updateSearchState({ audience })}
                onFocusIdChange={(focusId) => updateSearchState({ focusId: focusId || null })}
                requestKey={`${selectedPackageId}:${detail.summary?.generatedAt ?? detail.job.updatedAt}:${isExplainAudience(requestedExplainAudience) ? requestedExplainAudience : 'executive'}:${requestedFocusId}`}
              />

              <section className="grid gap-4 xl:grid-cols-2">
                <section className="panel-subtle">
                  <div className="label">Package artifact preview</div>
                  <div className="mt-2 text-sm text-slate-400">
                    Preview the canonical package JSON, reconciliation artifact, or rendered report output that will be handed off downstream.
                  </div>
                  <select className="input mt-3" onChange={(event) => selectPreviewFamily(event.target.value)} value={previewFamily}>
                    <option value="package_json">package_json</option>
                    <option value="review_ledger">review_ledger</option>
                    <option value="reconciliation">reconciliation</option>
                    <option value="validation_report">validation_report</option>
                    <option value="report_manifest">report_manifest</option>
                    <option value="assessor">assessor</option>
                    <option value="executive">executive</option>
                    <option value="ao">ao</option>
                    <option value="assessor_poam_md">assessor_poam_md</option>
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
                  {validationPreview && (
                    <div className="mt-4 rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Validation posture</div>
                          <div className="mt-2 text-sm font-medium text-white">{readString(validationPreview.summary, 'No validation summary attached.')}</div>
                        </div>
                        <span className={packageStatusBadgeClass(readString(validationPreview.status, 'unknown'))}>
                          {readString(validationPreview.status, 'unknown')}
                        </span>
                      </div>
                      {validationChecks.length > 0 && (
                        <div className="mt-4 grid gap-2">
                          {validationChecks.slice(0, 8).map((item, index) => (
                            <div key={readString(item.id, `validation-check-${index}`)} className="rounded-2xl border border-white/8 bg-slate-950/60 px-3 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-medium text-white">{readString(item.title, 'Validation check')}</div>
                                <span className={packageStatusBadgeClass(readString(item.status, 'unknown'))}>
                                  {readString(item.status, 'unknown')}
                                </span>
                              </div>
                              <div className="mt-2 text-xs leading-5 text-slate-400">{readString(item.detail, 'No detail available.')}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <pre className="mt-4 max-h-[460px] overflow-auto rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-xs leading-6 text-slate-300">
                    {preview ? toPreview(preview) : 'No preview is available for the selected package artifact.'}
                  </pre>
                </section>

                <div className="space-y-4">
                  {packageSummary && (
                    <section className="panel-subtle">
                      <div className="label">Package summary</div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Accepted reviews</div>
                          <div className="mt-2 text-xl font-semibold text-white">{packageSummary.accepted_review_count}</div>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Rejected reviews</div>
                          <div className="mt-2 text-xl font-semibold text-white">{packageSummary.rejected_review_count}</div>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">POA&amp;M items</div>
                          <div className="mt-2 text-xl font-semibold text-white">{packageSummary.poam_count}</div>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Evidence bundle</div>
                          <div className="mt-2 font-mono text-xs text-cyan-200">{packageDocument?.metadata.evidence_job_id ?? '—'}</div>
                        </div>
                      </div>
                    </section>
                  )}

                  {packageDocument && (packageDocument.metadata.agent_run_id || agentValidationResults.length > 0) && (
                    <section className="panel-subtle">
                      <div className="label">Embedded agent security</div>
                      <div className="mt-2 text-sm text-slate-400">
                        This package includes bounded-agent governance outputs inside the canonical 20x contract, including agent evaluations, findings, POA&amp;M items, and linked architecture artifacts.
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Agent run</div>
                          <div className="mt-2 font-mono text-xs text-cyan-200">
                            {agentSecuritySummary?.run_id ?? packageDocument.metadata.agent_run_id ?? 'Not linked'}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Agent checks</div>
                          <div className="mt-2 text-xl font-semibold text-white">
                            {agentSecuritySummary?.evaluation_count ?? agentValidationResults.length}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Open agent findings</div>
                          <div className="mt-2 text-xl font-semibold text-white">
                            {agentSecuritySummary?.gap_count ?? agentFindings.length}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Agent POA&amp;M</div>
                          <div className="mt-2 text-xl font-semibold text-white">
                            {agentSecuritySummary?.poam_count ?? agentPoamItems.length}
                          </div>
                        </div>
                      </div>
                      {agentSecuritySummary ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">PASS</div>
                            <div className="mt-2 text-xl font-semibold text-white">{agentSecuritySummary.pass_count}</div>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">PARTIAL</div>
                            <div className="mt-2 text-xl font-semibold text-white">{agentSecuritySummary.partial_count}</div>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">FAIL</div>
                            <div className="mt-2 text-xl font-semibold text-white">{agentSecuritySummary.fail_count}</div>
                          </div>
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {packageDocument.metadata.agent_run_id ? (
                          <Link
                            className="button-secondary"
                            to={`/assurance/agent-runs?runId=${encodeURIComponent(packageDocument.metadata.agent_run_id)}`}
                          >
                            Open agent run
                          </Link>
                        ) : null}
                        {failingAgentValidationResults[0] ? (
                          <button
                            className="button-secondary"
                            onClick={() => selectExplanation('assessor', failingAgentValidationResults[0]?.eval_code ?? '')}
                            type="button"
                          >
                            Explain top agent check
                          </button>
                        ) : null}
                      </div>
                      {agentSecuritySummary && (agentSecuritySummary.top_non_pass_eval_codes.length > 0 || agentSecuritySummary.top_gap_titles.length > 0) ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Top non-pass checks</div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-cyan-200">
                              {agentSecuritySummary.top_non_pass_eval_codes.length > 0
                                ? agentSecuritySummary.top_non_pass_eval_codes.map((item) => (
                                    <span key={item} className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1">
                                      {item}
                                    </span>
                                  ))
                                : <span className="text-slate-500">None</span>}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Top agent gaps</div>
                            <div className="mt-2 space-y-1 text-xs text-slate-300">
                              {agentSecuritySummary.top_gap_titles.length > 0
                                ? agentSecuritySummary.top_gap_titles.map((item) => <div key={item}>{item}</div>)
                                : <div className="text-slate-500">None</div>}
                            </div>
                          </div>
                        </div>
                      ) : null}
                      <div className="mt-4 space-y-2">
                        {agentValidationResults.slice(0, 4).map((item) => (
                          <div key={item.eval_code} className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-white">{item.title}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {item.eval_code} · {item.ksi_id}
                                </div>
                              </div>
                              <span className={evaluationStatusBadgeClass(item.status)}>{item.status}</span>
                            </div>
                            <div className="mt-2 text-xs leading-5 text-slate-400">{item.summary}</div>
                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                              <span>{humanizeKey(item.severity)}</span>
                              <span>{item.evidence_refs.length} evidence refs</span>
                            </div>
                            <div className="mt-3">
                              <button
                                className="button-secondary"
                                onClick={() => selectExplanation('assessor', item.eval_code)}
                                type="button"
                              >
                                Explain this agent check
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {agentFindings.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Agent findings</div>
                          {agentFindings.slice(0, 3).map((item) => (
                            <div
                              key={readString(item.id, `${readString(item.source_eval_code)}:${readString(item.title)}`)}
                              className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium text-white">{readString(item.title, 'Untitled agent gap')}</div>
                                  <div className="mt-1 text-xs text-slate-500">{readString(item.source_eval_code, 'AGENT_UNKNOWN')}</div>
                                </div>
                                <span className={severityBadgeClass(readString(item.severity))}>
                                  {readString(item.severity)}
                                </span>
                              </div>
                              <div className="mt-2 text-xs leading-5 text-slate-400">
                                {readString(item.detail, 'No agent finding detail recorded.')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {agentPoamItems.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Agent POA&amp;M</div>
                          {agentPoamItems.slice(0, 3).map((item) => (
                            <div key={item.id} className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium text-white">{item.identifier}</div>
                                  <div className="mt-1 text-xs text-slate-500">{item.sourceEvalCode ?? 'Agent remediation item'}</div>
                                </div>
                                <span className={packageStatusBadgeClass(item.status)}>{item.status}</span>
                              </div>
                              <div className="mt-2 text-xs leading-5 text-slate-400">{item.plannedRemediation}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {packageDocument && (
                    <section className="panel-subtle">
                      <div className="label">Validation failures</div>
                      <div className="mt-3 space-y-2">
                        {failedValidationResults.slice(0, 6).map((item) => (
                          <div key={`${item.eval_code}:${item.ksi_id}`} className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-white">{item.title}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {item.eval_code} · {item.ksi_id}
                                </div>
                              </div>
                              <span className={evaluationStatusBadgeClass(item.status)}>{item.status}</span>
                            </div>
                            <div className="mt-2 text-xs leading-5 text-slate-400">{item.summary}</div>
                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                              <span>{humanizeKey(item.severity)}</span>
                              <span>{item.evidence_refs.length} evidence refs</span>
                            </div>
                            <div className="mt-3">
                              <button
                                className="button-secondary"
                                onClick={() => selectExplanation('assessor', item.eval_code)}
                                type="button"
                              >
                                Explain this check
                              </button>
                            </div>
                          </div>
                        ))}
                        {failedValidationResults.length === 0 && (
                          <div className="text-sm text-slate-400">All KSI validation results currently pass in this package.</div>
                        )}
                      </div>
                    </section>
                  )}

                  {highlightedFindings.length > 0 && (
                    <section className="panel-subtle">
                      <div className="label">Priority findings</div>
                      <div className="mt-3 space-y-2">
                        {highlightedFindings.map((item) => {
                          const controlRefs = readStringArray(item.control_refs);
                          const ksiRefs = readStringArray(item.ksi_refs);
                          const severity = readString(item.severity);
                          return (
                            <div
                              key={readString(item.id, `${readString(item.gap_type)}:${readString(item.title)}`)}
                              className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium text-white">{readString(item.title, 'Untitled gap')}</div>
                                  <div className="mt-1 text-xs text-slate-500">{humanizeKey(readString(item.gap_type, 'gap'))}</div>
                                </div>
                                <span className={severityBadgeClass(severity)}>{severity}</span>
                              </div>
                              <div className="mt-2 text-xs leading-5 text-slate-400">{readString(item.detail, 'No detail recorded.')}</div>
                              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                                <span>{controlRefs.length} control refs</span>
                                <span>{ksiRefs.length} KSI refs</span>
                                <span>{readString(item.recommended_artifact, 'No recommended artifact')}</span>
                              </div>
                              <div className="mt-3">
                                <button
                                  className="button-secondary"
                                  onClick={() => selectExplanation('remediation', readString(item.id))}
                                  type="button"
                                >
                                  Explain this gap
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {highlightedPoamItems.length > 0 && (
                    <section className="panel-subtle">
                      <div className="label">POA&amp;M readiness</div>
                      <div className="mt-3 space-y-2">
                        {highlightedPoamItems.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-white">{item.identifier}</div>
                                <div className="mt-1 text-xs text-slate-500">{item.weaknessName}</div>
                              </div>
                              <span className={packageStatusBadgeClass(item.status)}>{item.status}</span>
                            </div>
                            <div className="mt-2 text-xs leading-5 text-slate-400">{item.plannedRemediation}</div>
                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                              <span>{humanizeKey(item.severity)}</span>
                              <span>Due {formatDate(item.milestoneDueDate)}</span>
                              {item.sourceEvalCode ? <span>{item.sourceEvalCode}</span> : null}
                            </div>
                            <div className="mt-3">
                              <button
                                className="button-secondary"
                                onClick={() => selectExplanation('remediation', item.id)}
                                type="button"
                              >
                                Explain this POA&amp;M
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="panel-subtle">
                    <div className="label">Reconciliation checks</div>
                    <div className="mt-3 space-y-2">
                      {detail.reconciliation?.checks.map((check) => (
                        <div key={check.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm">
                          <div>
                            <div className="font-medium text-white">{check.id}</div>
                            <div className="text-xs text-slate-400">
                              Expected {check.expected} · Actual {check.actual}
                            </div>
                          </div>
                          <span className={check.status === 'match' ? 'badge-success' : 'badge-danger'}>{check.status}</span>
                        </div>
                      ))}
                      {!detail.reconciliation && (
                        <div className="text-sm text-slate-400">No reconciliation summary is attached to this package job yet.</div>
                      )}
                      {mismatchChecks.length > 0 && (
                        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.08] px-3 py-3 text-xs leading-5 text-rose-100">
                          {mismatchChecks.length} reconciliation check(s) are mismatched and should be resolved before external handoff.
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="panel-subtle">
                    <div className="label">Report bundle</div>
                    <div className="mt-3 space-y-2">
                      {reportBundleEntries.map((item) => (
                        <div
                          key={item.role}
                          className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-white">{humanizeKey(item.role)}</div>
                            {previewFamily === item.role ? <span className="badge-success">Previewing</span> : null}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">{reportRoleDescription(item.role)}</div>
                          <div className="mt-2 font-mono text-xs text-slate-500">{item.path}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button className="button-secondary" onClick={() => selectPreviewFamily(item.role)} type="button">
                              Preview report
                            </button>
                            {reportRoleAudience(item.role) ? (
                              <button
                                className="button-secondary"
                                onClick={() => selectExplanation(reportRoleAudience(item.role) ?? 'executive')}
                                type="button"
                              >
                                Explain for {humanizeKey(item.role)}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                      {reportBundleEntries.length === 0 && (
                        <div className="text-sm text-slate-400">The package JSON exists, but no report manifest has been loaded yet.</div>
                      )}
                    </div>
                  </section>

                  {packageDocument && (
                    <section className="panel-subtle">
                      <div className="label">Evidence lineage</div>
                      <div className="mt-2 text-sm text-slate-400">
                        These artifact families live on the source evidence bundle, so open the evidence explorer to inspect the full payload behind each lineage link.
                      </div>
                      {detail.summary?.evidenceJobId && (
                        <div className="mt-3">
                          <Link className="button-secondary" to={`/assurance/evidence?evidenceJobId=${encodeURIComponent(detail.summary.evidenceJobId)}`}>
                            Open evidence explorer
                          </Link>
                        </div>
                      )}
                      <div className="mt-3 space-y-2">
                        {evidenceLinks.map((item) => (
                          <Link
                            key={`${item.family}:${item.path}`}
                            to={
                              isAgentLineageFamily(item.family) && packageDocument?.metadata?.agent_run_id
                                ? `/assurance/agent-runs?runId=${encodeURIComponent(packageDocument.metadata.agent_run_id)}&artifact=${encodeURIComponent(item.family)}`
                                : detail.summary?.evidenceJobId
                                  ? `/assurance/evidence?evidenceJobId=${encodeURIComponent(detail.summary.evidenceJobId)}&artifact=${encodeURIComponent(item.family)}`
                                  : '/assurance/evidence'
                            }
                            className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-medium text-white">{humanizeKey(item.family)}</div>
                              <span className="text-xs text-cyan-200">
                                {isAgentLineageFamily(item.family) ? 'Inspect agent artifact' : 'Inspect artifact'}
                              </span>
                            </div>
                            <div className="mt-1 font-mono text-xs text-slate-500">{item.path}</div>
                          </Link>
                        ))}
                        {evidenceLinks.length === 0 && (
                          <div className="text-sm text-slate-400">No evidence lineage entries were embedded in the package JSON.</div>
                        )}
                      </div>
                    </section>
                  )}

                  {reviewLedgerDecisions.length > 0 && (
                    <section className="panel-subtle">
                      <div className="label">Review ledger decisions</div>
                      <div className="mt-3 space-y-2">
                        {reviewLedgerDecisions.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="font-medium text-white">{item.recommendation_title}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {humanizeKey(item.target_type)} · {item.target_id}
                                </div>
                              </div>
                              <span className={packageStatusBadgeClass(item.decision)}>{item.decision}</span>
                            </div>
                            <div className="mt-2 text-xs leading-5 text-slate-400">{item.justification}</div>
                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                              <span>{item.evidence_refs.length} evidence refs</span>
                              <span>{item.finding_refs.length} finding refs</span>
                              <span>{item.control_refs.length} control refs</span>
                              <span>{formatDate(item.created_at)}</span>
                            </div>
                            <div className="mt-3">
                              <button
                                className="button-secondary"
                                onClick={() => selectExplanation('remediation', item.id)}
                                type="button"
                              >
                                Explain this decision
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="panel-subtle">
                    <div className="label">Recent review decisions</div>
                    <div className="mt-3 space-y-2">
                      {reviewHistory.slice(0, 5).map((item) => (
                        <div key={item.id} className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-white">{item.decision}</div>
                            <div className="text-xs text-slate-500">{formatDate(item.createdAt)}</div>
                          </div>
                          <div className="mt-2 font-mono text-xs text-cyan-200">{item.recommendationId}</div>
                          <div className="mt-2 text-xs leading-5 text-slate-400">{item.justification}</div>
                        </div>
                      ))}
                      {reviewHistory.length === 0 && (
                        <div className="text-sm text-slate-400">No review decisions have been recorded for this package’s evidence bundle yet.</div>
                      )}
                    </div>
                  </section>
                </div>
              </section>
            </>
          )}
        </section>
      </section>
    </div>
  );
}
