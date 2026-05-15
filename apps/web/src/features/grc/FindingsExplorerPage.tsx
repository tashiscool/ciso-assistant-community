import { useEffect, useMemo, useState } from 'react';
import { getFindingDetail, getFindings, getFrameworkLibrary } from './api';
import type { FindingDetail, FindingSummary, FrameworkLibrarySummary } from './types';

function summarizeFindingLocation(item: FindingSummary) {
  return [item.accountId, item.region].filter(Boolean).join(' • ') || 'Scope not provided';
}

export function FindingsExplorerPage() {
  const [frameworks, setFrameworks] = useState<FrameworkLibrarySummary[]>([]);
  const [findings, setFindings] = useState<FindingSummary[]>([]);
  const [detail, setDetail] = useState<FindingDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    framework: '',
    source: '',
    severity: '',
    status: '',
  });
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadList(nextSelectedId?: string | null) {
    try {
      setLoading(true);
      setError(null);
      const [frameworkData, findingData] = await Promise.all([
        getFrameworkLibrary(),
        getFindings(filters),
      ]);
      setFrameworks(frameworkData);
      setFindings(findingData);
      const preferred = nextSelectedId && findingData.some((item) => item.id === nextSelectedId)
        ? nextSelectedId
        : findingData[0]?.id ?? null;
      setSelectedId(preferred);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load normalized findings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadList(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    const findingId = selectedId;

    let cancelled = false;

    async function loadDetail() {
      try {
        setDetailLoading(true);
        const response = await getFindingDetail(findingId);
        if (!cancelled) {
          setDetail(response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load finding detail.');
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
  }, [selectedId]);

  const sourceOptions = useMemo(
    () => [...new Set(findings.map((item) => item.source))].sort((left, right) => left.localeCompare(right)),
    [findings],
  );

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Normalized Findings</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Findings Explorer</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Review normalized connector and import findings, inspect mapped control evaluations, and follow evidence
          references that feed cross-framework assessments and report bundles.
        </p>
      </section>

      {error ? <div className="notice-error">{error}</div> : null}

      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="eyebrow">Filters</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Assessment-ready intake</h2>
          </div>
          <button className="button-primary" onClick={() => void loadList(selectedId)} type="button">
            Refresh findings
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Framework
            <select
              className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
              onChange={(event) => setFilters((current) => ({ ...current, framework: event.target.value }))}
              value={filters.framework}
            >
              <option value="">All frameworks</option>
              {frameworks.map((framework) => (
                <option key={framework.id} value={framework.slug}>
                  {framework.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Source
            <select
              className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
              onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))}
              value={filters.source}
            >
              <option value="">All sources</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Severity
            <select
              className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
              onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}
              value={filters.severity}
            >
              <option value="">All severities</option>
              {['critical', 'high', 'medium', 'low', 'info'].map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Status
            <select
              className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/40"
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              value={filters.status}
            >
              <option value="">All statuses</option>
              {['fail', 'inconclusive', 'pass', 'not_applicable', 'skipped'].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4">
          <button className="button-secondary" onClick={() => void loadList(selectedId)} type="button">
            Apply filters
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="panel space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="eyebrow">Findings</div>
            <span className="badge-neutral">{findings.length} loaded</span>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-sm text-slate-400">
              Loading normalized findings...
            </div>
          ) : null}

          {!loading && findings.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-sm text-slate-400">
              No findings match the current filters yet.
            </div>
          ) : null}

          {!loading
            ? findings.map((item) => {
                const active = item.id === selectedId;
                return (
                  <button
                    className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                      active
                        ? 'border-cyan-300/30 bg-cyan-400/[0.06] text-white'
                        : 'border-white/10 bg-slate-950/20 text-slate-300 hover:border-cyan-300/20 hover:bg-cyan-400/[0.03]'
                    }`}
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="eyebrow">{item.source}</div>
                        <div className="mt-2 text-base font-semibold">{item.resourceId}</div>
                      </div>
                      <span className={item.statusSummary === 'fail' ? 'badge-warning' : 'badge-neutral'}>
                        {item.statusSummary}
                      </span>
                    </div>
                    <div className="mt-3 text-sm text-slate-400">{item.resourceType}</div>
                    <div className="mt-2 text-xs text-slate-500">{summarizeFindingLocation(item)}</div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                      <span>{item.severitySummary}</span>
                      <span>{item.evaluationCount} evals</span>
                      <span>{item.scfMatchCount} SCF matches</span>
                    </div>
                  </button>
                );
              })
            : null}
        </div>

        <div className="panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="eyebrow">Finding detail</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {detail?.resourceId ?? 'Select a finding'}
              </h2>
            </div>
            {detail ? <span className="badge-neutral">{detail.source}</span> : null}
          </div>

          {detailLoading ? (
            <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-sm text-slate-400">
              Loading finding detail...
            </div>
          ) : null}

          {!detailLoading && detail ? (
            <div className="mt-6 space-y-6">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="panel-subtle">
                  <div className="label">Status</div>
                  <div className="mt-2 text-lg font-semibold text-white">{detail.statusSummary}</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">Severity</div>
                  <div className="mt-2 text-lg font-semibold text-white">{detail.severitySummary}</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">Evaluations</div>
                  <div className="mt-2 text-lg font-semibold text-white">{detail.evaluationCount}</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">Evidence refs</div>
                  <div className="mt-2 text-lg font-semibold text-white">{detail.evidenceRefCount}</div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-5">
                <div className="eyebrow">Resource scope</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="label">Type</div>
                    <div className="mt-1 text-sm text-white">{detail.resourceType}</div>
                  </div>
                  <div>
                    <div className="label">Collected</div>
                    <div className="mt-1 text-sm text-white">{new Date(detail.collectedAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="label">Account</div>
                    <div className="mt-1 text-sm text-white">{detail.accountId ?? 'n/a'}</div>
                  </div>
                  <div>
                    <div className="label">Region</div>
                    <div className="mt-1 text-sm text-white">{detail.region ?? 'n/a'}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="eyebrow">Control evaluations</div>
                {detail.evaluations.map((evaluation) => (
                  <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-5" key={evaluation.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {evaluation.controlFramework} • {evaluation.controlId}
                        </div>
                        <div className="mt-2 text-sm text-slate-300">{evaluation.title ?? evaluation.message ?? 'No narrative attached.'}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={evaluation.status === 'fail' ? 'badge-warning' : 'badge-neutral'}>
                          {evaluation.status}
                        </span>
                        {evaluation.severity ? <span className="badge-neutral">{evaluation.severity}</span> : null}
                      </div>
                    </div>
                    {evaluation.remediationSummary ? (
                      <div className="mt-4 text-sm leading-6 text-slate-300">
                        <span className="font-semibold text-white">Remediation:</span> {evaluation.remediationSummary}
                      </div>
                    ) : null}
                    {evaluation.scfControlIds.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {evaluation.scfControlIds.map((controlId) => (
                          <span className="badge-neutral" key={controlId}>
                            {controlId}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!detailLoading && !detail ? (
            <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-sm text-slate-400">
              Select a finding from the left to inspect mapped evaluations and evidence references.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
