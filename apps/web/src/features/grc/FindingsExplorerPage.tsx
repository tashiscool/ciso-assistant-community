import { useEffect, useMemo, useState } from 'react';
import { RegFilterBar, RegPageHeader, RegStatusPill } from '../../components/regovise/PagePrimitives';
import { getFindingDetail, getFindings, getFrameworkLibrary } from './api';
import type { FindingDetail, FindingSummary, FrameworkLibrarySummary } from './types';

function summarizeFindingLocation(item: FindingSummary) {
  return [item.accountId, item.region].filter(Boolean).join(' • ') || 'Scope not provided';
}

function statusTone(status: string) {
  if (status === 'fail') {
    return 'danger';
  }
  if (status === 'pass') {
    return 'success';
  }
  if (status === 'inconclusive' || status === 'partial') {
    return 'warning';
  }
  return 'neutral';
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
      <RegPageHeader
        eyebrow="Compliance / Normalized Findings"
        title="Findings Explorer"
        description="Review normalized connector and import findings, inspect mapped control evaluations, and follow evidence references that feed cross-framework assessments and report bundles."
        meta={
          <>
            <RegStatusPill tone="neutral">{findings.length} loaded</RegStatusPill>
            <RegStatusPill tone="purple">{frameworks.length} framework targets</RegStatusPill>
            <RegStatusPill tone="info">{sourceOptions.length} sources</RegStatusPill>
          </>
        }
        actions={
          <button className="button-primary" onClick={() => void loadList(selectedId)} type="button">
            Refresh findings
          </button>
        }
        className="rounded-lg border border-[#ded8e4] shadow-[0_8px_24px_rgba(48,24,72,0.04)]"
      />

      {error ? <div className="notice-error">{error}</div> : null}

      <section className="panel">
        <div className="eyebrow">Assessment-ready intake</div>
        <h2 className="mt-2 text-2xl font-semibold text-[#241232]">Filters</h2>

        <RegFilterBar className="mt-5 rounded-lg border border-[#ded8e4] px-4 py-4">
          <label className="flex flex-col gap-2 text-sm text-[#4f435c]">
            Framework
            <select
              className="rounded-2xl border border-[#ded8e4] bg-white px-4 py-3 text-sm text-[#241232] outline-none focus:border-[#8b35e6]"
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
          <label className="flex flex-col gap-2 text-sm text-[#4f435c]">
            Source
            <select
              className="rounded-2xl border border-[#ded8e4] bg-white px-4 py-3 text-sm text-[#241232] outline-none focus:border-[#8b35e6]"
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
          <label className="flex flex-col gap-2 text-sm text-[#4f435c]">
            Severity
            <select
              className="rounded-2xl border border-[#ded8e4] bg-white px-4 py-3 text-sm text-[#241232] outline-none focus:border-[#8b35e6]"
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
          <label className="flex flex-col gap-2 text-sm text-[#4f435c]">
            Status
            <select
              className="rounded-2xl border border-[#ded8e4] bg-white px-4 py-3 text-sm text-[#241232] outline-none focus:border-[#8b35e6]"
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
        </RegFilterBar>

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
            <RegStatusPill tone="neutral">{findings.length} loaded</RegStatusPill>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-dashed border-[#ded8e4] bg-[#fbf9fc] p-6 text-sm text-[#6f6578]">
              Loading normalized findings...
            </div>
          ) : null}

          {!loading && findings.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#ded8e4] bg-[#fbf9fc] p-6 text-sm text-[#6f6578]">
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
                        ? 'border-[#d7c3f1] bg-[#f2e8ff] text-[#241232]'
                        : 'border-[#ded8e4] bg-[#fbf9fc] text-[#4f435c] hover:border-[#d7c3f1] hover:bg-[#f6f1fa]'
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
                      <RegStatusPill tone={statusTone(item.statusSummary)}>
                        {item.statusSummary}
                      </RegStatusPill>
                    </div>
                    <div className="mt-3 text-sm text-[#6f6578]">{item.resourceType}</div>
                    <div className="mt-2 text-xs text-[#62576a]">{summarizeFindingLocation(item)}</div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#6f6578]">
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
              <h2 className="mt-2 text-2xl font-semibold text-[#241232]">
                {detail?.resourceId ?? 'Select a finding'}
              </h2>
            </div>
            {detail ? <RegStatusPill tone="neutral">{detail.source}</RegStatusPill> : null}
          </div>

          {detailLoading ? (
            <div className="mt-6 rounded-3xl border border-dashed border-[#ded8e4] bg-[#fbf9fc] p-6 text-sm text-[#6f6578]">
              Loading finding detail...
            </div>
          ) : null}

          {!detailLoading && detail ? (
            <div className="mt-6 space-y-6">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="panel-subtle">
                  <div className="label">Status</div>
                  <div className="mt-2 text-lg font-semibold text-[#241232]">{detail.statusSummary}</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">Severity</div>
                  <div className="mt-2 text-lg font-semibold text-[#241232]">{detail.severitySummary}</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">Evaluations</div>
                  <div className="mt-2 text-lg font-semibold text-[#241232]">{detail.evaluationCount}</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">Evidence refs</div>
                  <div className="mt-2 text-lg font-semibold text-[#241232]">{detail.evidenceRefCount}</div>
                </div>
              </div>

              <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-5">
                <div className="eyebrow">Resource scope</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="label">Type</div>
                    <div className="mt-1 text-sm text-[#241232]">{detail.resourceType}</div>
                  </div>
                  <div>
                    <div className="label">Collected</div>
                    <div className="mt-1 text-sm text-[#241232]">{new Date(detail.collectedAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="label">Account</div>
                    <div className="mt-1 text-sm text-[#241232]">{detail.accountId ?? 'n/a'}</div>
                  </div>
                  <div>
                    <div className="label">Region</div>
                    <div className="mt-1 text-sm text-[#241232]">{detail.region ?? 'n/a'}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="eyebrow">Control evaluations</div>
                {detail.evaluations.map((evaluation) => (
                  <div className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-5" key={evaluation.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#241232]">
                          {evaluation.controlFramework} • {evaluation.controlId}
                        </div>
                        <div className="mt-2 text-sm text-[#4f435c]">{evaluation.title ?? evaluation.message ?? 'No narrative attached.'}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <RegStatusPill tone={statusTone(evaluation.status)}>
                          {evaluation.status}
                        </RegStatusPill>
                        {evaluation.severity ? <RegStatusPill tone="neutral">{evaluation.severity}</RegStatusPill> : null}
                      </div>
                    </div>
                    {evaluation.remediationSummary ? (
                      <div className="mt-4 text-sm leading-6 text-[#4f435c]">
                        <span className="font-semibold text-[#241232]">Remediation:</span> {evaluation.remediationSummary}
                      </div>
                    ) : null}
                    {evaluation.scfControlIds.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {evaluation.scfControlIds.map((controlId) => (
                          <RegStatusPill tone="neutral" key={controlId}>
                            {controlId}
                          </RegStatusPill>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!detailLoading && !detail ? (
            <div className="mt-6 rounded-3xl border border-dashed border-[#ded8e4] bg-[#fbf9fc] p-6 text-sm text-[#6f6578]">
              Select a finding from the left to inspect mapped evaluations and evidence references.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
