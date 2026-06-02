import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  ClipboardCheck,
  Database,
  FileSearch,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
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
    <Card>
      <CardContent className="p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</div>
        <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
        <div className="mt-2 text-xs leading-5 text-slate-400">{detail}</div>
      </CardContent>
    </Card>
  );
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
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300/70">
            <FileSearch className="h-4 w-4" />
            Assessment Evidence Packages
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            Scrutiny chain cockpit
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Historical FedRAMP workbook imports become traceable packages: control to request,
            owner response, evidence rollup, reviewer comment, sufficiency status, and reusable
            assessment template coverage.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadPackages()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-8 text-sm text-slate-400">Loading assessment evidence packages...</CardContent>
        </Card>
      ) : packages.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No assessment packages imported yet</CardTitle>
            <CardDescription>
              Run the guarded FedHR FedRAMP importer in dry-run mode first, then apply with
              explicit production mutation guards after review.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Imported Packages</CardTitle>
                <CardDescription>Select a package marker to inspect the imported evidence chain.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {packages.map((item) => {
                  const active = item.marker === selectedMarker;
                  return (
                    <button
                      key={item.marker}
                      type="button"
                      onClick={() =>
                        navigate(`/assessment-evidence-packages/${encodeURIComponent(item.marker)}`)
                      }
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        active
                          ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-50'
                          : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="text-sm font-semibold">{item.title}</div>
                      <div className="mt-2 text-xs text-slate-400">{item.marker}</div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                        <span>{item.dataCallCount} requests</span>
                        <span>{item.evidenceRollupCount} rollups</span>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <div className="space-y-4">
              {selectedSummary && (
                <Card>
                  <CardHeader>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <CardTitle>{selectedSummary.title}</CardTitle>
                        <CardDescription>
                          {selectedSummary.matter ?? selectedSummary.marker} updated {formatDate(selectedSummary.updatedAt)}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" asChild>
                          <Link to="/data-calls">Open Data Calls</Link>
                        </Button>
                        <Button variant="secondary" asChild>
                          <Link to="/evidence-locker">Open Evidence Locker</Link>
                        </Button>
                        <Button variant="secondary" asChild>
                          <Link to="/assessment-plans">Reusable Template</Link>
                        </Button>
                        <Button asChild>
                          <Link to={`/grc-admin/scrutiny-engine?packageMarker=${encodeURIComponent(selectedSummary.marker)}`}>
                            Generate Scrutiny Run
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              )}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {kpis.map((item) => (
                  <KpiCard key={item.label} {...item} />
                ))}
              </div>
            </div>
          </div>

          {detailLoading || !detail ? (
            <Card>
              <CardContent className="p-8 text-sm text-slate-400">Loading package detail...</CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="flex h-auto flex-wrap justify-start">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="requests">Evidence Requests</TabsTrigger>
                <TabsTrigger value="comments">Reviewer Comments</TabsTrigger>
                <TabsTrigger value="rollups">Evidence Rollups</TabsTrigger>
                <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
                <TabsTrigger value="template">Reusable Template</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="grid gap-4 xl:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Control Coverage</CardTitle>
                      <CardDescription>Most frequently scrutinized raw workbook control refs.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {detail.controlCoverage.slice(0, 16).map((item) => (
                        <div key={item.controlRef} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                          <span className="font-medium text-slate-200">{item.controlRef}</span>
                          <span className="text-slate-400">{item.count} requests</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Family and Owner Bottlenecks</CardTitle>
                      <CardDescription>Where scrutiny clusters and which owners carried volume.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        {detail.familyCoverage.slice(0, 10).map((item) => (
                          <div key={item.family} className="rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                            <div className="font-medium text-slate-200">{item.family}</div>
                            <div className="text-xs text-slate-400">
                              {item.requestCount} requests, {item.coreCount} core
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {detail.ownerCoverage.slice(0, 10).map((item) => (
                          <div key={item.owner} className="rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                            <div className="font-medium text-slate-200">{item.owner}</div>
                            <div className="text-xs text-slate-400">
                              {item.requestCount} requests, avg {formatMetric(item.averageDaysToReceive)} days
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="requests">
                <Card>
                  <CardHeader>
                    <CardTitle>Evidence Requests</CardTitle>
                    <CardDescription>
                      Filter imported Data Calls by control, owner, family, evidence type, comments, and anomalies.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <input
                        value={filters.query}
                        onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                        placeholder="Search title, owner, control..."
                        className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                      />
                      <select
                        value={filters.family}
                        onChange={(event) => setFilters((current) => ({ ...current, family: event.target.value }))}
                        className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                      >
                        <option value="all">All families</option>
                        {families.map((family) => (
                          <option key={family} value={family}>{family}</option>
                        ))}
                      </select>
                      <select
                        value={filters.evidenceType}
                        onChange={(event) => setFilters((current) => ({ ...current, evidenceType: event.target.value }))}
                        className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                      >
                        <option value="all">All evidence types</option>
                        {evidenceTypes.map((evidenceType) => (
                          <option key={evidenceType} value={evidenceType}>{evidenceType}</option>
                        ))}
                      </select>
                      <select
                        value={filters.owner}
                        onChange={(event) => setFilters((current) => ({ ...current, owner: event.target.value }))}
                        className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                      >
                        <option value="all">All owners</option>
                        {owners.map((owner) => (
                          <option key={owner} value={owner}>{owner}</option>
                        ))}
                      </select>
                      <select
                        value={filters.core}
                        onChange={(event) => setFilters((current) => ({ ...current, core: event.target.value }))}
                        className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                      >
                        <option value="all">All request priority</option>
                        <option value="core">Core controls only</option>
                        <option value="non-core">Non-core only</option>
                      </select>
                      <select
                        value={filters.comments}
                        onChange={(event) => setFilters((current) => ({ ...current, comments: event.target.value }))}
                        className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                      >
                        <option value="all">All comment states</option>
                        <option value="with-comments">With comments</option>
                        <option value="without-comments">Without comments</option>
                      </select>
                      <select
                        value={filters.anomaly}
                        onChange={(event) => setFilters((current) => ({ ...current, anomaly: event.target.value }))}
                        className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                      >
                        <option value="all">All date quality</option>
                        <option value="anomaly">Anomalies only</option>
                      </select>
                      <div className="flex items-center rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
                        {filteredRequests.length} of {detail.requests.length} requests
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-white/10">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.18em] text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Request</th>
                            <th className="px-4 py-3">Controls</th>
                            <th className="px-4 py-3">Owner</th>
                            <th className="px-4 py-3">Timing</th>
                            <th className="px-4 py-3">Signals</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {filteredRequests.slice(0, 80).map((request) => (
                            <tr key={request.id} className="align-top text-slate-300">
                              <td className="px-4 py-3">
                                <Link to={request.route} className="font-medium text-cyan-200 hover:text-cyan-100">
                                  {request.title}
                                </Link>
                                <div className="mt-1 text-xs text-slate-500">Row {request.excelRow ?? '-'}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="max-w-xs text-xs leading-5 text-slate-400">
                                  {request.controlRefs.slice(0, 6).join(', ') || '-'}
                                  {request.controlRefs.length > 6 ? ` +${request.controlRefs.length - 6}` : ''}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">{request.family ?? 'Unmapped'}</div>
                              </td>
                              <td className="px-4 py-3">{request.owner ?? '-'}</td>
                              <td className="px-4 py-3 text-xs leading-5">
                                <div>Requested {formatDate(request.requestedAt)}</div>
                                <div>Received {formatDate(request.receivedAt)}</div>
                                <div>{formatMetric(request.daysToReceive)} days</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  {request.coreControl && <span className="badge-neutral">Core</span>}
                                  {request.commentEventCount > 0 && (
                                    <span className="badge-neutral">{request.commentEventCount} comments</span>
                                  )}
                                  {request.dateQuality && request.dateQuality !== 'ok' && (
                                    <span className="badge-danger">{request.dateQuality}</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="comments">
                <Card>
                  <CardHeader>
                    <CardTitle>Reviewer Comments and Sufficiency Events</CardTitle>
                    <CardDescription>
                      Sanitized excerpts preserve challenge patterns without turning sensitive operational details into dashboard copy.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {detail.reviewerComments.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                        No reviewer comments were parsed for this package.
                      </div>
                    ) : (
                      detail.reviewerComments.map((comment, index) => (
                        <div key={`${comment.requestId}:${index}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div>
                              <Link to={comment.route} className="font-medium text-cyan-200 hover:text-cyan-100">
                                {comment.requestTitle}
                              </Link>
                              <div className="mt-1 text-xs text-slate-500">
                                Row {comment.excelRow ?? '-'} by {comment.author} {comment.dateLabel ? `on ${comment.dateLabel}` : ''}
                              </div>
                            </div>
                            <MessageSquare className="h-4 w-4 text-slate-500" />
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-300">{comment.excerpt}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="rollups">
                <Card>
                  <CardHeader>
                    <CardTitle>Evidence Locker Rollups</CardTitle>
                    <CardDescription>
                      Rollups group historical file-share evidence references by family and evidence type.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {detail.evidenceRollups.map((rollup) => (
                      <Link
                        key={rollup.id}
                        to={rollup.route}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-100">{rollup.title}</div>
                            <div className="mt-1 text-xs text-slate-500">{rollup.family ?? 'Unmapped'} / {rollup.evidenceType ?? 'Evidence'}</div>
                          </div>
                          <Archive className="h-4 w-4 text-slate-500" />
                        </div>
                        <div className="mt-3 text-xs leading-5 text-slate-400">
                          {rollup.sourceRows.length} source rows, {rollup.controlRefs.length} controls
                        </div>
                        {rollup.historicalReferenceOnly && (
                          <div className="mt-3 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                            Historical file-share reference only. No fabricated artifact attached.
                          </div>
                        )}
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="anomalies">
                <Card>
                  <CardHeader>
                    <CardTitle>Date and Mapping Anomalies</CardTitle>
                    <CardDescription>
                      Preserved workbook conditions that need audit-aware handling rather than silent normalization.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {detail.anomalies.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                        No anomalies were detected.
                      </div>
                    ) : (
                      detail.anomalies.map((anomaly) => (
                        <div key={anomaly.requestId} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" />
                            <div>
                              <Link to={anomaly.route} className="font-medium text-amber-100 hover:text-amber-50">
                                {anomaly.requestTitle}
                              </Link>
                              <div className="mt-1 text-xs text-amber-100/70">
                                Row {anomaly.excelRow ?? '-'}: {anomaly.dateQuality}
                              </div>
                              <div className="mt-2 text-xs text-amber-100/70">
                                Requested {formatDate(anomaly.requestedAt)} / Received {formatDate(anomaly.receivedAt)} / {formatMetric(anomaly.daysToReceive)} days
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="template">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <ClipboardCheck className="h-5 w-5 text-cyan-300" />
                      <div>
                        <CardTitle>Reusable FedRAMP Scrutiny Template</CardTitle>
                        <CardDescription>
                          The import creates an assessment-plan/questionnaire template from workbook request items.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Builder Entry</div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        Open Assessment Plans to reuse these rows as FedRAMP evidence questions grouped by family and evidence type.
                      </p>
                      <Button className="mt-4" asChild>
                        <Link to="/assessment-plans">Open Assessment Plans</Link>
                      </Button>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Discovery Hooks</div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        Imported Data Calls and Evidence Rollups carry the package marker and raw controls for search, reports, dashboards, and workbench filtering.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <Database className="h-4 w-4" />
                        Historical Integrity
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        Actual files are not embedded in the workbook, so evidence is intentionally represented as historical file-share references and rollups.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}
