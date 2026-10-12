import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  ClipboardCheck,
  Database,
  Eye,
  FileSearch,
  MessageSquare,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  RegActionMenu,
  RegFilterBar,
  RegPageHeader,
  RegRightDrawer,
  RegStatusPill,
  RegTableShell,
  RegTabs,
} from '../../components/regovise/PagePrimitives';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';

type AssessmentEvidencePackageSummary = {
  marker: string;
  title: string;
  matter: string | null;
  folderIds: string[];
  dataCallCount: number;
  evidenceRollupCount: number;
  closedRequestCount: number;
  coreRequestCount: number;
  commentEventCount: number;
  rowsWithComments: number;
  uniqueControlRefs: number;
  familyCount: number;
  evidenceTypeCount: number;
  averageDaysToReceive: number | null;
  slowestDaysToReceive: number | null;
  anomalyCount: number;
  updatedAt: string;
};

type AssessmentRequest = {
  id: string;
  title: string;
  status: string;
  route: string;
  excelRow: number | null;
  owner: string | null;
  requestedAt: string | null;
  receivedAt: string | null;
  daysToReceive: number | null;
  coreControl: boolean;
  controlRefs: string[];
  family: string | null;
  evidenceType: string | null;
  commentEventCount: number;
  dateQuality: string | null;
};

type AssessmentEvidencePackageDetail = {
  summary: AssessmentEvidencePackageSummary;
  controlCoverage: Array<{ controlRef: string; count: number }>;
  familyCoverage: Array<{ family: string; requestCount: number; coreCount: number }>;
  ownerCoverage: Array<{ owner: string; requestCount: number; averageDaysToReceive: number | null }>;
  evidenceTypeCoverage: Array<{ evidenceType: string; requestCount: number }>;
  requests: AssessmentRequest[];
  evidenceRollups: Array<{
    id: string;
    title: string;
    status: string;
    route: string;
    family: string | null;
    evidenceType: string | null;
    controlRefs: string[];
    sourceRows: number[];
    historicalReferenceOnly: boolean;
  }>;
  reviewerComments: Array<{
    requestId: string;
    requestTitle: string;
    route: string;
    excelRow: number | null;
    author: string;
    dateLabel: string | null;
    excerpt: string;
  }>;
  anomalies: Array<{
    requestId: string;
    requestTitle: string;
    route: string;
    excelRow: number | null;
    dateQuality: string;
    requestedAt: string | null;
    receivedAt: string | null;
    daysToReceive: number | null;
  }>;
};

type EvidenceRollup = AssessmentEvidencePackageDetail['evidenceRollups'][number];
type ReviewerComment = AssessmentEvidencePackageDetail['reviewerComments'][number];
type PackageAnomaly = AssessmentEvidencePackageDetail['anomalies'][number];
type ActivePackageTab = 'overview' | 'requests' | 'comments' | 'rollups' | 'anomalies' | 'template';

const client = new ApiClient();

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleDateString();
}

function formatMetric(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }
  return `${value}${suffix}`;
}

function uniqueSorted(values: Array<string | null>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
    .sort((left, right) => left.localeCompare(right));
}

function requestMatchesFilter(
  request: AssessmentRequest,
  filters: {
    query: string;
    family: string;
    evidenceType: string;
    owner: string;
    core: string;
    anomaly: string;
    comments: string;
  },
) {
  const query = filters.query.trim().toLowerCase();
  if (query) {
    const haystack = [
      request.title,
      request.owner ?? '',
      request.family ?? '',
      request.evidenceType ?? '',
      request.controlRefs.join(' '),
      request.excelRow ? `row ${request.excelRow}` : '',
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(query)) {
      return false;
    }
  }

  if (filters.family !== 'all' && request.family !== filters.family) {
    return false;
  }
  if (filters.evidenceType !== 'all' && request.evidenceType !== filters.evidenceType) {
    return false;
  }
  if (filters.owner !== 'all' && request.owner !== filters.owner) {
    return false;
  }
  if (filters.core === 'core' && !request.coreControl) {
    return false;
  }
  if (filters.core === 'non-core' && request.coreControl) {
    return false;
  }
  if (filters.anomaly === 'anomaly' && (!request.dateQuality || request.dateQuality === 'ok')) {
    return false;
  }
  if (filters.comments === 'with-comments' && request.commentEventCount === 0) {
    return false;
  }
  if (filters.comments === 'without-comments' && request.commentEventCount > 0) {
    return false;
  }

  return true;
}

function KpiCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <article className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="mt-2 text-xs leading-5 text-[#4f435c]">{detail}</div>
    </article>
  );
}

function ToneForStatus({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone = normalized.includes('closed') || normalized.includes('ok')
    ? 'success'
    : normalized.includes('partial') || normalized.includes('review')
      ? 'warning'
      : normalized.includes('fail') || normalized.includes('error')
        ? 'danger'
        : 'neutral';
  return <RegStatusPill tone={tone}>{status}</RegStatusPill>;
}

export function AssessmentEvidencePackagePage() {
  const { identity } = useEdgeIdentity();
  const navigate = useNavigate();
  const { packageMarker } = useParams();
  const requestedMarker = packageMarker ? decodeURIComponent(packageMarker) : '';
  const [packages, setPackages] = useState<AssessmentEvidencePackageSummary[]>([]);
  const [detail, setDetail] = useState<AssessmentEvidencePackageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActivePackageTab>('overview');
  const [inspectedRequest, setInspectedRequest] = useState<AssessmentRequest | null>(null);
  const [inspectedComment, setInspectedComment] = useState<ReviewerComment | null>(null);
  const [inspectedRollup, setInspectedRollup] = useState<EvidenceRollup | null>(null);
  const [inspectedAnomaly, setInspectedAnomaly] = useState<PackageAnomaly | null>(null);
  const [filters, setFilters] = useState({
    query: '',
    family: 'all',
    evidenceType: 'all',
    owner: 'all',
    core: 'all',
    anomaly: 'all',
    comments: 'all',
  });

  async function loadPackages() {
    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{ data: { packages: AssessmentEvidencePackageSummary[] } }>(
        '/core/assessment-evidence-packages',
      );
      setPackages(response.data.packages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load assessment evidence packages.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPackages();
  }, [identity.tenantId, identity.userId]);

  const selectedMarker = requestedMarker || packages[0]?.marker || '';

  async function loadDetail(marker: string) {
    if (!marker) {
      setDetail(null);
      return;
    }
    try {
      setDetailLoading(true);
      setError(null);
      const response = await client.get<{ data: AssessmentEvidencePackageDetail }>(
        `/core/assessment-evidence-packages/${encodeURIComponent(marker)}`,
      );
      setDetail(response.data);
    } catch (err) {
      setDetail(null);
      setError(err instanceof Error ? err.message : 'Unable to load the selected package.');
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail(selectedMarker);
  }, [selectedMarker, identity.tenantId, identity.userId]);

  const filteredRequests = useMemo(() => {
    if (!detail) {
      return [];
    }
    return detail.requests.filter((request) => requestMatchesFilter(request, filters));
  }, [detail, filters]);

  const families = useMemo(() => uniqueSorted(detail?.requests.map((request) => request.family) ?? []), [detail]);
  const evidenceTypes = useMemo(
    () => uniqueSorted(detail?.requests.map((request) => request.evidenceType) ?? []),
    [detail],
  );
  const owners = useMemo(() => uniqueSorted(detail?.requests.map((request) => request.owner) ?? []), [detail]);

  const selectedSummary = detail?.summary ?? packages.find((item) => item.marker === selectedMarker) ?? null;

  const kpis = selectedSummary
    ? [
        {
          label: 'Evidence Requests',
          value: selectedSummary.dataCallCount,
          detail: `${selectedSummary.closedRequestCount} historical closed requests from the package.`,
        },
        {
          label: 'Core Requests',
          value: selectedSummary.coreRequestCount,
          detail: 'Workbook rows marked as core control scrutiny.',
        },
        {
          label: 'Reviewer Comments',
          value: selectedSummary.commentEventCount,
          detail: `${selectedSummary.rowsWithComments} rows carry structured sufficiency events.`,
        },
        {
          label: 'Avg Days',
          value: formatMetric(selectedSummary.averageDaysToReceive),
          detail: `${formatMetric(selectedSummary.slowestDaysToReceive)} day slowest evidence turn-around.`,
        },
        {
          label: 'Control Refs',
          value: selectedSummary.uniqueControlRefs,
          detail: `${selectedSummary.familyCount} families and ${selectedSummary.evidenceTypeCount} evidence types.`,
        },
        {
          label: 'Anomalies',
          value: selectedSummary.anomalyCount,
          detail: 'Date and package-quality conditions preserved for audit review.',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <RegPageHeader
        actions={
          <button className="button-secondary gap-2" onClick={() => void loadPackages()} type="button">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
        className="rounded-lg border border-[#ded8e4] shadow-[0_10px_28px_rgba(48,24,72,0.06)]"
        description="Historical FedRAMP workbook imports become traceable packages: control to request, owner response, evidence rollup, reviewer comment, sufficiency status, and reusable assessment template coverage."
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <FileSearch className="h-4 w-4" />
            Assessment Evidence Packages
          </span>
        }
        meta={
          selectedSummary ? (
            <>
              <RegStatusPill tone={selectedSummary.anomalyCount > 0 ? 'warning' : 'success'}>
                {selectedSummary.anomalyCount} anomalies
              </RegStatusPill>
              <span>{selectedSummary.folderIds.length} workspace scopes</span>
              <span>Updated {formatDate(selectedSummary.updatedAt)}</span>
            </>
          ) : null
        }
        title="Scrutiny chain cockpit"
      />

      {error ? <div className="notice-error">{error}</div> : null}

      {loading ? (
        <section className="panel" aria-live="polite">
          <div className="text-sm text-[#4f435c]">Loading assessment evidence packages...</div>
        </section>
      ) : packages.length === 0 ? (
        <section className="panel">
          <h2 className="text-xl font-semibold text-[#241232]">No assessment packages imported yet</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#4f435c]">
            Run the guarded FedHR FedRAMP importer in dry-run mode first, then apply with explicit
            production mutation guards after review.
          </p>
        </section>
      ) : (
        <>
          <div className="grid min-w-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <section className="panel">
              <div className="eyebrow">Imported packages</div>
              <h2 className="mt-2 text-xl font-semibold text-[#241232]">Imported Packages</h2>
              <p className="mt-2 text-sm leading-6 text-[#4f435c]">
                Select a package marker to inspect the imported evidence chain.
              </p>
              <div className="mt-5 space-y-3">
                {packages.map((item) => {
                  const active = item.marker === selectedMarker;
                  return (
                    <button
                      className={`w-full rounded-lg border p-4 text-left transition ${
                        active
                          ? 'border-[#8b35e6] bg-[#f2e8ff] text-[#241232] shadow-[0_8px_18px_rgba(139,53,230,0.12)]'
                          : 'border-[#ded8e4] bg-white text-[#4f435c] hover:border-[#d7c3f1] hover:bg-[#fbf9fc]'
                      }`}
                      key={item.marker}
                      onClick={() => navigate(`/assessment-evidence-packages/${encodeURIComponent(item.marker)}`)}
                      type="button"
                    >
                      <div className="text-sm font-semibold">{item.title}</div>
                      <div className="mt-2 text-xs text-[#4f435c]">{item.marker}</div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#6f6578]">
                        <RegStatusPill tone="info">{item.dataCallCount} requests</RegStatusPill>
                        <RegStatusPill tone="purple">{item.evidenceRollupCount} rollups</RegStatusPill>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="min-w-0 space-y-4">
              {selectedSummary ? (
                <section className="panel">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-xl font-semibold text-[#241232]">{selectedSummary.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-[#4f435c]">
                        {selectedSummary.matter ?? selectedSummary.marker} updated {formatDate(selectedSummary.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link className="button-secondary" to="/data-calls">Open Data Calls</Link>
                      <Link className="button-secondary" to="/evidence-locker">Open Evidence Locker</Link>
                      <Link className="button-secondary" to="/assessment-plans">Reusable Template</Link>
                      <Link
                        className="button-primary"
                        to={`/grc-admin/scrutiny-engine?packageMarker=${encodeURIComponent(selectedSummary.marker)}`}
                      >
                        Generate Scrutiny Run
                      </Link>
                    </div>
                  </div>
                </section>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {kpis.map((item) => (
                  <KpiCard key={item.label} {...item} />
                ))}
              </div>
            </div>
          </div>

          {detailLoading || !detail ? (
            <section className="panel" aria-live="polite">
              <div className="text-sm text-[#4f435c]">Loading package detail...</div>
            </section>
          ) : (
            <section className="min-w-0">
              <RegTabs
                className="rounded-t-lg border border-b-0 border-[#ded8e4] bg-white px-2"
                onSelect={(tabId) => setActiveTab(tabId as ActivePackageTab)}
                tabs={[
                  { id: 'overview', label: 'Overview', active: activeTab === 'overview' },
                  { id: 'requests', label: 'Evidence Requests', count: detail.requests.length, active: activeTab === 'requests' },
                  { id: 'comments', label: 'Reviewer Comments', count: detail.reviewerComments.length, active: activeTab === 'comments' },
                  { id: 'rollups', label: 'Evidence Rollups', count: detail.evidenceRollups.length, active: activeTab === 'rollups' },
                  { id: 'anomalies', label: 'Anomalies', count: detail.anomalies.length, active: activeTab === 'anomalies' },
                  { id: 'template', label: 'Reusable Template', active: activeTab === 'template' },
                ]}
              />

              {activeTab === 'overview' ? (
                <div className="grid gap-4 rounded-b-lg border border-[#ded8e4] bg-white p-4 xl:grid-cols-2">
                  <section className="panel-subtle">
                    <h2 className="text-lg font-semibold text-[#241232]">Control Coverage</h2>
                    <p className="mt-1 text-sm text-[#4f435c]">Most frequently scrutinized raw workbook control refs.</p>
                    <div className="mt-4 max-h-[520px] space-y-2 overflow-auto pr-1">
                      {detail.controlCoverage.slice(0, 16).map((item) => (
                        <div className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm" key={item.controlRef}>
                          <span className="font-medium text-[#241232]">{item.controlRef}</span>
                          <span className="shrink-0 text-[#4f435c]">{item.count} requests</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="panel-subtle">
                    <h2 className="text-lg font-semibold text-[#241232]">Family and Owner Bottlenecks</h2>
                    <p className="mt-1 text-sm text-[#4f435c]">Where scrutiny clusters and which owners carried volume.</p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        {detail.familyCoverage.slice(0, 10).map((item) => (
                          <div className="rounded-md bg-white px-3 py-2 text-sm" key={item.family}>
                            <div className="font-medium text-[#241232]">{item.family}</div>
                            <div className="text-xs text-[#4f435c]">
                              {item.requestCount} requests, {item.coreCount} core
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {detail.ownerCoverage.slice(0, 10).map((item) => (
                          <div className="rounded-md bg-white px-3 py-2 text-sm" key={item.owner}>
                            <div className="font-medium text-[#241232]">{item.owner}</div>
                            <div className="text-xs text-[#4f435c]">
                              {item.requestCount} requests, avg {formatMetric(item.averageDaysToReceive)} days
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                </div>
              ) : null}

              {activeTab === 'requests' ? (
                <RegTableShell className="rounded-t-none">
                  <RegFilterBar>
                    <label className="relative min-w-[240px] flex-1 lg:max-w-xs">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f6578]" />
                      <input
                        className="input pl-10"
                        onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                        placeholder="Search title, owner, control..."
                        value={filters.query}
                      />
                    </label>
                    <select
                      className="input lg:w-44"
                      onChange={(event) => setFilters((current) => ({ ...current, family: event.target.value }))}
                      value={filters.family}
                    >
                      <option value="all">All families</option>
                      {families.map((family) => (
                        <option key={family} value={family}>{family}</option>
                      ))}
                    </select>
                    <select
                      className="input lg:w-48"
                      onChange={(event) => setFilters((current) => ({ ...current, evidenceType: event.target.value }))}
                      value={filters.evidenceType}
                    >
                      <option value="all">All evidence types</option>
                      {evidenceTypes.map((evidenceType) => (
                        <option key={evidenceType} value={evidenceType}>{evidenceType}</option>
                      ))}
                    </select>
                    <select
                      className="input lg:w-40"
                      onChange={(event) => setFilters((current) => ({ ...current, owner: event.target.value }))}
                      value={filters.owner}
                    >
                      <option value="all">All owners</option>
                      {owners.map((owner) => (
                        <option key={owner} value={owner}>{owner}</option>
                      ))}
                    </select>
                    <select
                      className="input lg:w-48"
                      onChange={(event) => setFilters((current) => ({ ...current, core: event.target.value }))}
                      value={filters.core}
                    >
                      <option value="all">All request priority</option>
                      <option value="core">Core controls only</option>
                      <option value="non-core">Non-core only</option>
                    </select>
                    <select
                      className="input lg:w-44"
                      onChange={(event) => setFilters((current) => ({ ...current, comments: event.target.value }))}
                      value={filters.comments}
                    >
                      <option value="all">All comments</option>
                      <option value="with-comments">With comments</option>
                      <option value="without-comments">Without comments</option>
                    </select>
                    <select
                      className="input lg:w-44"
                      onChange={(event) => setFilters((current) => ({ ...current, anomaly: event.target.value }))}
                      value={filters.anomaly}
                    >
                      <option value="all">All date quality</option>
                      <option value="anomaly">Anomalies only</option>
                    </select>
                    <div className="rounded-md border border-[#ded8e4] bg-[#fbf9fc] px-3 py-2 text-sm text-[#4f435c]">
                      {filteredRequests.length} of {detail.requests.length} requests
                    </div>
                  </RegFilterBar>
                  <div className="max-h-[min(720px,calc(100vh-220px))] overflow-auto">
                    <table className="min-w-[1040px] w-full text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-[#f6f1fa] text-xs uppercase tracking-[0.12em] text-[#62576a]">
                        <tr>
                          <th className="px-4 py-3">Request</th>
                          <th className="px-4 py-3">Controls</th>
                          <th className="px-4 py-3">Owner</th>
                          <th className="px-4 py-3">Timing</th>
                          <th className="px-4 py-3">Signals</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#eeeaf2]">
                        {filteredRequests.slice(0, 80).map((request) => (
                          <tr className="align-top text-[#4f435c]" key={request.id}>
                            <td className="px-4 py-3">
                              <button
                                className="text-left font-medium text-[#6d28d9] underline-offset-2 hover:text-[#5f1aa8] hover:underline"
                                onClick={() => setInspectedRequest(request)}
                                type="button"
                              >
                                {request.title}
                              </button>
                              <div className="mt-1 text-xs text-[#62576a]">Row {request.excelRow ?? '-'}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="max-w-xs text-xs leading-5 text-[#4f435c]">
                                {request.controlRefs.slice(0, 6).join(', ') || '-'}
                                {request.controlRefs.length > 6 ? ` +${request.controlRefs.length - 6}` : ''}
                              </div>
                              <div className="mt-1 text-xs text-[#62576a]">{request.family ?? 'Unmapped'}</div>
                            </td>
                            <td className="px-4 py-3">{request.owner ?? '-'}</td>
                            <td className="px-4 py-3 text-xs leading-5">
                              <div>Requested {formatDate(request.requestedAt)}</div>
                              <div>Received {formatDate(request.receivedAt)}</div>
                              <div>{formatMetric(request.daysToReceive)} days</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <ToneForStatus status={request.status} />
                                {request.coreControl ? <RegStatusPill tone="purple">Core</RegStatusPill> : null}
                                {request.commentEventCount > 0 ? (
                                  <RegStatusPill tone="info">{request.commentEventCount} comments</RegStatusPill>
                                ) : null}
                                {request.dateQuality && request.dateQuality !== 'ok' ? (
                                  <RegStatusPill tone="danger">{request.dateQuality}</RegStatusPill>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <RegActionMenu
                                actions={[
                                  { label: 'Inspect request', icon: Eye, onSelect: () => setInspectedRequest(request) },
                                  { label: 'Open source record', to: request.route },
                                ]}
                                label={`Open actions for ${request.title}`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </RegTableShell>
              ) : null}

              {activeTab === 'comments' ? (
                <RegTableShell className="rounded-t-none">
                  <div className="border-b border-[#ded8e4] bg-white px-6 py-4">
                    <h2 className="text-lg font-semibold text-[#241232]">Reviewer Comments and Sufficiency Events</h2>
                    <p className="mt-1 text-sm text-[#4f435c]">
                      Sanitized excerpts preserve challenge patterns without turning sensitive operational details into dashboard copy.
                    </p>
                  </div>
                  {detail.reviewerComments.length === 0 ? (
                    <div className="p-6 text-sm text-[#4f435c]">No reviewer comments were parsed for this package.</div>
                  ) : (
                    <div className="max-h-[min(680px,calc(100vh-220px))] overflow-auto">
                      <table className="min-w-[900px] w-full text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-[#f6f1fa] text-xs uppercase tracking-[0.12em] text-[#62576a]">
                          <tr>
                            <th className="px-4 py-3">Request</th>
                            <th className="px-4 py-3">Reviewer</th>
                            <th className="px-4 py-3">Excerpt</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#eeeaf2]">
                          {detail.reviewerComments.map((comment, index) => (
                            <tr className="align-top" key={`${comment.requestId}:${index}`}>
                              <td className="px-4 py-3">
                                <button
                                  className="text-left font-medium text-[#6d28d9] underline-offset-2 hover:text-[#5f1aa8] hover:underline"
                                  onClick={() => setInspectedComment(comment)}
                                  type="button"
                                >
                                  {comment.requestTitle}
                                </button>
                                <div className="mt-1 text-xs text-[#62576a]">Row {comment.excelRow ?? '-'}</div>
                              </td>
                              <td className="px-4 py-3 text-[#4f435c]">
                                <div>{comment.author}</div>
                                <div className="text-xs text-[#62576a]">{comment.dateLabel ?? '-'}</div>
                              </td>
                              <td className="px-4 py-3 text-[#4f435c]">
                                <div className="line-clamp-2 max-w-2xl">{comment.excerpt}</div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <RegActionMenu
                                  actions={[
                                    { label: 'Inspect comment', icon: MessageSquare, onSelect: () => setInspectedComment(comment) },
                                    { label: 'Open source record', to: comment.route },
                                  ]}
                                  label={`Open actions for comment on ${comment.requestTitle}`}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </RegTableShell>
              ) : null}

              {activeTab === 'rollups' ? (
                <div className="rounded-b-lg border border-[#ded8e4] bg-white p-4">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-[#241232]">Evidence Locker Rollups</h2>
                    <p className="mt-1 text-sm text-[#4f435c]">
                      Rollups group historical file-share evidence references by family and evidence type.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {detail.evidenceRollups.map((rollup) => (
                      <article className="panel-subtle bg-white" key={rollup.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <button
                              className="text-left font-medium text-[#241232] underline-offset-2 hover:text-[#5f1aa8] hover:underline"
                              onClick={() => setInspectedRollup(rollup)}
                              type="button"
                            >
                              {rollup.title}
                            </button>
                            <div className="mt-1 text-xs text-[#62576a]">
                              {rollup.family ?? 'Unmapped'} / {rollup.evidenceType ?? 'Evidence'}
                            </div>
                          </div>
                          <RegActionMenu
                            actions={[
                              { label: 'Inspect rollup', icon: Archive, onSelect: () => setInspectedRollup(rollup) },
                              { label: 'Open locker record', to: rollup.route },
                            ]}
                            label={`Open actions for ${rollup.title}`}
                          />
                        </div>
                        <div className="mt-3 text-xs leading-5 text-[#4f435c]">
                          {rollup.sourceRows.length} source rows, {rollup.controlRefs.length} controls
                        </div>
                        {rollup.historicalReferenceOnly ? (
                          <div className="mt-3 rounded-md border border-[#f6d48e] bg-[#fff2d9] px-3 py-2 text-xs text-[#8a4d00]">
                            Historical file-share reference only. No fabricated artifact attached.
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeTab === 'anomalies' ? (
                <div className="rounded-b-lg border border-[#ded8e4] bg-white p-4">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-[#241232]">Date and Mapping Anomalies</h2>
                    <p className="mt-1 text-sm text-[#4f435c]">
                      Preserved workbook conditions that need audit-aware handling rather than silent normalization.
                    </p>
                  </div>
                  {detail.anomalies.length === 0 ? (
                    <div className="panel-subtle text-sm text-[#4f435c]">No anomalies were detected.</div>
                  ) : (
                    <div className="space-y-3">
                      {detail.anomalies.map((anomaly) => (
                        <article className="rounded-lg border border-[#f6d48e] bg-[#fff2d9] p-4" key={anomaly.requestId}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#8a4d00]" />
                              <div className="min-w-0">
                                <button
                                  className="text-left font-medium text-[#6f3d00] underline-offset-2 hover:underline"
                                  onClick={() => setInspectedAnomaly(anomaly)}
                                  type="button"
                                >
                                  {anomaly.requestTitle}
                                </button>
                                <div className="mt-1 text-xs text-[#6f3d00]">
                                  Row {anomaly.excelRow ?? '-'}: {anomaly.dateQuality}
                                </div>
                                <div className="mt-2 text-xs text-[#6f3d00]">
                                  Requested {formatDate(anomaly.requestedAt)} / Received {formatDate(anomaly.receivedAt)} / {formatMetric(anomaly.daysToReceive)} days
                                </div>
                              </div>
                            </div>
                            <RegActionMenu
                              actions={[
                                { label: 'Inspect anomaly', icon: AlertTriangle, onSelect: () => setInspectedAnomaly(anomaly) },
                                { label: 'Open source record', to: anomaly.route },
                              ]}
                              label={`Open actions for anomaly on ${anomaly.requestTitle}`}
                            />
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {activeTab === 'template' ? (
                <div className="grid gap-4 rounded-b-lg border border-[#ded8e4] bg-white p-4 lg:grid-cols-3">
                  <section className="panel-subtle bg-white">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5 text-[#7a3ccf]" />
                      <h2 className="text-lg font-semibold text-[#241232]">Builder Entry</h2>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#4f435c]">
                      Open Assessment Plans to reuse these rows as FedRAMP evidence questions grouped by family and evidence type.
                    </p>
                    <Link className="button-primary mt-4" to="/assessment-plans">Open Assessment Plans</Link>
                  </section>
                  <section className="panel-subtle bg-white">
                    <h2 className="text-lg font-semibold text-[#241232]">Discovery Hooks</h2>
                    <p className="mt-3 text-sm leading-6 text-[#4f435c]">
                      Imported Data Calls and Evidence Rollups carry the package marker and raw controls for search,
                      reports, dashboards, and workbench filtering.
                    </p>
                  </section>
                  <section className="panel-subtle bg-white">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-[#7a3ccf]" />
                      <h2 className="text-lg font-semibold text-[#241232]">Historical Integrity</h2>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#4f435c]">
                      Actual files are not embedded in the workbook, so evidence is intentionally represented as
                      historical file-share references and rollups.
                    </p>
                  </section>
                </div>
              ) : null}
            </section>
          )}
        </>
      )}

      <RegRightDrawer
        description="Imported data-call request with source row, owner, controls, and timing preserved."
        footer={
          <div className="flex justify-end gap-2">
            <button className="button-secondary" onClick={() => setInspectedRequest(null)} type="button">Close</button>
            {inspectedRequest ? <Link className="button-primary" to={inspectedRequest.route}>Open source record</Link> : null}
          </div>
        }
        onOpenChange={(open) => {
          if (!open) {
            setInspectedRequest(null);
          }
        }}
        open={Boolean(inspectedRequest)}
        title={inspectedRequest?.title ?? 'Evidence request'}
      >
        {inspectedRequest ? (
          <div className="space-y-4">
            <div className="panel-subtle">
              <div className="flex flex-wrap gap-2">
                <ToneForStatus status={inspectedRequest.status} />
                {inspectedRequest.coreControl ? <RegStatusPill tone="purple">Core control</RegStatusPill> : null}
                {inspectedRequest.commentEventCount > 0 ? (
                  <RegStatusPill tone="info">{inspectedRequest.commentEventCount} comments</RegStatusPill>
                ) : null}
                {inspectedRequest.dateQuality && inspectedRequest.dateQuality !== 'ok' ? (
                  <RegStatusPill tone="danger">{inspectedRequest.dateQuality}</RegStatusPill>
                ) : null}
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="label">Workbook row</dt>
                  <dd className="mt-1 text-[#241232]">{inspectedRequest.excelRow ?? '-'}</dd>
                </div>
                <div>
                  <dt className="label">Owner</dt>
                  <dd className="mt-1 text-[#241232]">{inspectedRequest.owner ?? '-'}</dd>
                </div>
                <div>
                  <dt className="label">Family</dt>
                  <dd className="mt-1 text-[#241232]">{inspectedRequest.family ?? 'Unmapped'}</dd>
                </div>
                <div>
                  <dt className="label">Evidence type</dt>
                  <dd className="mt-1 text-[#241232]">{inspectedRequest.evidenceType ?? 'Evidence'}</dd>
                </div>
              </dl>
            </div>
            <div className="panel-subtle">
              <h3 className="font-semibold text-[#241232]">Timing</h3>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="label">Requested</dt>
                  <dd className="mt-1 text-[#241232]">{formatDate(inspectedRequest.requestedAt)}</dd>
                </div>
                <div>
                  <dt className="label">Received</dt>
                  <dd className="mt-1 text-[#241232]">{formatDate(inspectedRequest.receivedAt)}</dd>
                </div>
                <div>
                  <dt className="label">Elapsed</dt>
                  <dd className="mt-1 text-[#241232]">{formatMetric(inspectedRequest.daysToReceive)} days</dd>
                </div>
              </dl>
            </div>
            <div className="panel-subtle">
              <h3 className="font-semibold text-[#241232]">Control references</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {inspectedRequest.controlRefs.length > 0 ? (
                  inspectedRequest.controlRefs.map((controlRef) => (
                    <RegStatusPill key={controlRef} tone="neutral">{controlRef}</RegStatusPill>
                  ))
                ) : (
                  <span className="text-sm text-[#4f435c]">No control references parsed.</span>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Reviewer sufficiency event parsed from the imported package."
        footer={
          <div className="flex justify-end gap-2">
            <button className="button-secondary" onClick={() => setInspectedComment(null)} type="button">Close</button>
            {inspectedComment ? <Link className="button-primary" to={inspectedComment.route}>Open source record</Link> : null}
          </div>
        }
        onOpenChange={(open) => {
          if (!open) {
            setInspectedComment(null);
          }
        }}
        open={Boolean(inspectedComment)}
        title={inspectedComment?.requestTitle ?? 'Reviewer comment'}
      >
        {inspectedComment ? (
          <div className="space-y-4">
            <div className="panel-subtle">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="label">Reviewer</dt>
                  <dd className="mt-1 text-[#241232]">{inspectedComment.author}</dd>
                </div>
                <div>
                  <dt className="label">Workbook row</dt>
                  <dd className="mt-1 text-[#241232]">{inspectedComment.excelRow ?? '-'}</dd>
                </div>
                <div>
                  <dt className="label">Date label</dt>
                  <dd className="mt-1 text-[#241232]">{inspectedComment.dateLabel ?? '-'}</dd>
                </div>
              </dl>
            </div>
            <div className="panel-subtle">
              <h3 className="font-semibold text-[#241232]">Excerpt</h3>
              <p className="mt-3 text-sm leading-6 text-[#4f435c]">{inspectedComment.excerpt}</p>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Historical evidence locker rollup linked to imported request rows."
        footer={
          <div className="flex justify-end gap-2">
            <button className="button-secondary" onClick={() => setInspectedRollup(null)} type="button">Close</button>
            {inspectedRollup ? <Link className="button-primary" to={inspectedRollup.route}>Open locker record</Link> : null}
          </div>
        }
        onOpenChange={(open) => {
          if (!open) {
            setInspectedRollup(null);
          }
        }}
        open={Boolean(inspectedRollup)}
        title={inspectedRollup?.title ?? 'Evidence rollup'}
      >
        {inspectedRollup ? (
          <div className="space-y-4">
            <div className="panel-subtle">
              <div className="flex flex-wrap gap-2">
                <ToneForStatus status={inspectedRollup.status} />
                {inspectedRollup.historicalReferenceOnly ? (
                  <RegStatusPill tone="warning">Historical reference only</RegStatusPill>
                ) : null}
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="label">Family</dt>
                  <dd className="mt-1 text-[#241232]">{inspectedRollup.family ?? 'Unmapped'}</dd>
                </div>
                <div>
                  <dt className="label">Evidence type</dt>
                  <dd className="mt-1 text-[#241232]">{inspectedRollup.evidenceType ?? 'Evidence'}</dd>
                </div>
                <div>
                  <dt className="label">Source rows</dt>
                  <dd className="mt-1 text-[#241232]">{inspectedRollup.sourceRows.join(', ') || '-'}</dd>
                </div>
              </dl>
            </div>
            <div className="panel-subtle">
              <h3 className="font-semibold text-[#241232]">Control references</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {inspectedRollup.controlRefs.length > 0 ? (
                  inspectedRollup.controlRefs.map((controlRef) => (
                    <RegStatusPill key={controlRef} tone="neutral">{controlRef}</RegStatusPill>
                  ))
                ) : (
                  <span className="text-sm text-[#4f435c]">No control references parsed.</span>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>

      <RegRightDrawer
        description="Workbook condition preserved for audit-aware follow-up."
        footer={
          <div className="flex justify-end gap-2">
            <button className="button-secondary" onClick={() => setInspectedAnomaly(null)} type="button">Close</button>
            {inspectedAnomaly ? <Link className="button-primary" to={inspectedAnomaly.route}>Open source record</Link> : null}
          </div>
        }
        onOpenChange={(open) => {
          if (!open) {
            setInspectedAnomaly(null);
          }
        }}
        open={Boolean(inspectedAnomaly)}
        title={inspectedAnomaly?.requestTitle ?? 'Package anomaly'}
      >
        {inspectedAnomaly ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#f6d48e] bg-[#fff2d9] p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-[#8a4d00]" />
                <div>
                  <h3 className="font-semibold text-[#6f3d00]">{inspectedAnomaly.dateQuality}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6f3d00]">
                    This condition should remain visible for review instead of being silently normalized away.
                  </p>
                </div>
              </div>
            </div>
            <div className="panel-subtle">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="label">Workbook row</dt>
                  <dd className="mt-1 text-[#241232]">{inspectedAnomaly.excelRow ?? '-'}</dd>
                </div>
                <div>
                  <dt className="label">Elapsed</dt>
                  <dd className="mt-1 text-[#241232]">{formatMetric(inspectedAnomaly.daysToReceive)} days</dd>
                </div>
                <div>
                  <dt className="label">Requested</dt>
                  <dd className="mt-1 text-[#241232]">{formatDate(inspectedAnomaly.requestedAt)}</dd>
                </div>
                <div>
                  <dt className="label">Received</dt>
                  <dd className="mt-1 text-[#241232]">{formatDate(inspectedAnomaly.receivedAt)}</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : null}
      </RegRightDrawer>
    </div>
  );
}
