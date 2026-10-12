import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardCheck,
  FileSearch,
  Link2,
  MessageSquare,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { RegModal } from '../../components/regovise/PagePrimitives';
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
import {
  createDraftScrutinyRun,
  getScrutinyPatterns,
  getScrutinyReadiness,
  getScrutinyRun,
  listScrutinyRuns,
  materializeScrutinyRun,
  reconcileScrutinyRun,
  reviewScrutinyItem,
} from './api';
import type {
  ScrutinyItem,
  ScrutinyPattern,
  ScrutinyReadiness,
  ScrutinyRunDetail,
  ScrutinyRunSummary,
  ScrutinySufficiencyState,
} from './types';

type WorkspaceFolder = {
  id: string;
  name: string;
  pathLabel: string;
  contentType: string;
};

const client = new ApiClient();

const sufficiencyStates: ScrutinySufficiencyState[] = [
  'draft',
  'requested',
  'responded',
  'accepted',
  'challenged',
  'clarification_needed',
  'still_needed',
  'not_applicable',
];

type ScrutinyAction = 'generate' | 'reconcile' | 'materialize' | 'review';

function metricValue(metrics: Record<string, unknown>, key: string) {
  const value = metrics[key];
  return typeof value === 'number' ? value : 0;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString();
}

function sourceLabel(source: ScrutinyPattern['source']) {
  return source
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statePillClass(state: ScrutinySufficiencyState | string) {
  if (state === 'accepted') return 'border-[#9fdfb7] bg-[#ddf7e6] text-[#126b36]';
  if (state === 'challenged' || state === 'still_needed' || state === 'clarification_needed') {
    return 'border-[#f6d48e] bg-[#fff2d9] text-[#8a4d00]';
  }
  if (state === 'responded') return 'border-[#d7c3f1] bg-[#f2e8ff] text-[#6d28d9]';
  return 'border-[#ded8e4] bg-[#f6f1fa] text-[#4f435c]';
}

function readinessPillClass(status: string) {
  if (status === 'ok') return 'border-[#9fdfb7] bg-[#ddf7e6] text-[#126b36]';
  if (status === 'blocker') return 'border-[#f2b7bf] bg-[#ffe2e5] text-[#9d1f2c]';
  if (status === 'warn') return 'border-[#f6d48e] bg-[#fff2d9] text-[#8a4d00]';
  return 'border-[#d7c3f1] bg-[#f2e8ff] text-[#6d28d9]';
}

function joinControlRefs(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string').join(', ') : '';
}

function ItemMiniCard({ item, onSelect }: { item: ScrutinyItem; onSelect?: (item: ScrutinyItem) => void }) {
  return (
    <div className="rounded-2xl border border-[#ded8e4] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#d7c3f1] bg-[#f2e8ff] px-2 py-1 text-xs font-semibold text-[#6d28d9]">
          {item.controlRef}
        </span>
        <span className={`rounded-full border px-2 py-1 text-xs ${statePillClass(item.sufficiencyState)}`}>
          {item.sufficiencyState.replace(/_/g, ' ')}
        </span>
        {item.missingFeed && (
          <span className="rounded-full border border-[#f6d48e] bg-[#fff2d9] px-2 py-1 text-xs text-[#8a4d00]">
            missing feed
          </span>
        )}
        {item.reviewerChallenge && (
          <span className="rounded-full border border-[#f2b7bf] bg-[#ffe2e5] px-2 py-1 text-xs text-[#9d1f2c]">
            reviewer challenge
          </span>
        )}
      </div>
      <div className="mt-3 text-sm font-semibold text-[#241232]">{item.questionPrompt}</div>
      <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[#62576a]">{item.evidenceType}</div>
      {item.evidenceHint && <div className="mt-2 text-sm leading-6 text-[#6f6578]">{item.evidenceHint}</div>}
      {onSelect && (
        <Button className="mt-4" variant="secondary" onClick={() => onSelect(item)}>
          Review this item
        </Button>
      )}
    </div>
  );
}

export function ScrutinyEnginePage() {
  const { identity } = useEdgeIdentity();
  const location = useLocation();
  const navigate = useNavigate();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialPackageMarker = query.get('packageMarker') ?? '';
  const initialControlRefs = query.get('controlRefs') ?? '';
  const initialRunId = query.get('runId') ?? '';
  const initialModuleKey = query.get('moduleKey') ?? '';
  const initialRecordId = query.get('recordId') ?? '';

  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [runs, setRuns] = useState<ScrutinyRunSummary[]>([]);
  const [patterns, setPatterns] = useState<ScrutinyPattern[]>([]);
  const [readiness, setReadiness] = useState<ScrutinyReadiness | null>(null);
  const [detail, setDetail] = useState<ScrutinyRunDetail | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [featureDisabledMessage, setFeatureDisabledMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ScrutinyAction | null>(null);
  const [draftForm, setDraftForm] = useState({
    title: initialPackageMarker ? `Scrutiny run for ${initialPackageMarker}` : 'Draft assessor scrutiny run',
    folderId: '',
    scopeType: initialPackageMarker ? 'package' : initialModuleKey && initialRecordId ? 'record' : 'controls',
    packageMarker: initialPackageMarker,
    controlRefs: initialControlRefs,
    moduleKey: initialModuleKey,
    recordId: initialRecordId,
  });
  const [materializeForm, setMaterializeForm] = useState({
    itemIds: '',
    dueOn: '',
    createQuestionnaireTemplate: true,
  });
  const [reviewForm, setReviewForm] = useState({
    eventType: 'accepted',
    nextState: 'accepted' as ScrutinySufficiencyState,
    body: '',
  });

  async function loadBasics(runId = initialRunId) {
    try {
      setLoading(true);
      setError(null);
      const probeControlRefs = initialControlRefs
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const [folderResponse, runResponse, patternResponse, readinessResponse] = await Promise.all([
        client.get<{ data: WorkspaceFolder[] }>('/iam/folders'),
        listScrutinyRuns(),
        getScrutinyPatterns({
          packageMarker: initialPackageMarker || undefined,
          controlRefs: probeControlRefs,
        }),
        getScrutinyReadiness({
          packageMarker: initialPackageMarker || undefined,
          controlRefs: probeControlRefs,
        }),
      ]);
      setFolders(folderResponse.data);
      setRuns(runResponse);
      setPatterns(patternResponse.patterns);
      setReadiness(readinessResponse);
      setFeatureDisabledMessage(patternResponse.enabled === false ? patternResponse.message : null);
      setDraftForm((current) => ({
        ...current,
        folderId:
          current.folderId ||
          folderResponse.data.find((folder) => folder.contentType === 'domain')?.id ||
          folderResponse.data.find((folder) => folder.contentType === 'root')?.id ||
          '',
      }));
      const targetRunId = runId || runResponse[0]?.id || '';
      if (targetRunId) {
        const runDetail = await getScrutinyRun(targetRunId);
        setDetail(runDetail);
        setSelectedItemId(runDetail.items[0]?.id ?? '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the Scrutiny Engine.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBasics();
  }, [identity.tenantId, identity.userId]);

  async function generateDraft() {
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      const controlRefs = draftForm.controlRefs
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const created = await createDraftScrutinyRun({
        title: draftForm.title,
        folderId: draftForm.folderId || null,
        scope: {
          type: draftForm.scopeType as 'package' | 'controls' | 'record' | 'default',
          packageMarker: draftForm.packageMarker.trim() || undefined,
          controlRefs,
          moduleKey: draftForm.moduleKey.trim() || undefined,
          recordId: draftForm.recordId.trim() || undefined,
        },
      });
      setDetail(created);
      setSelectedItemId(created.items[0]?.id ?? '');
      setNotice('Draft scrutiny run generated without creating operational module records.');
      navigate(`/grc-admin/scrutiny-engine?runId=${encodeURIComponent(created.run.id)}`, { replace: true });
      await loadBasics(created.run.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate scrutiny run.');
    } finally {
      setBusy(false);
    }
  }

  async function openRun(runId: string) {
    try {
      setBusy(true);
      setError(null);
      const runDetail = await getScrutinyRun(runId);
      setDetail(runDetail);
      setSelectedItemId(runDetail.items[0]?.id ?? '');
      navigate(`/grc-admin/scrutiny-engine?runId=${encodeURIComponent(runId)}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open scrutiny run.');
    } finally {
      setBusy(false);
    }
  }

  async function materialize() {
    if (!detail) return;
    try {
      setBusy(true);
      setError(null);
      const itemIds = materializeForm.itemIds
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const next = await materializeScrutinyRun(detail.run.id, {
        itemIds,
        dueOn: materializeForm.dueOn || null,
        createQuestionnaireTemplate: materializeForm.createQuestionnaireTemplate,
      });
      setDetail(next);
      setRuns(await listScrutinyRuns());
      setNotice('Selected scrutiny items were materialized into Data Calls and Evidence Locker records.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to materialize scrutiny run.');
    } finally {
      setBusy(false);
    }
  }

  async function reconcile() {
    if (!detail) return;
    try {
      setBusy(true);
      setError(null);
      const next = await reconcileScrutinyRun(detail.run.id);
      setDetail(next);
      setNotice('Reconciliation refreshed suggested states. Acceptance or challenge still requires reviewer action.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reconcile scrutiny run.');
    } finally {
      setBusy(false);
    }
  }

  async function submitReview() {
    if (!selectedItemId || !reviewForm.body.trim()) return;
    try {
      setBusy(true);
      setError(null);
      const next = await reviewScrutinyItem(selectedItemId, {
        eventType: reviewForm.eventType,
        nextState: reviewForm.nextState,
        body: reviewForm.body.trim(),
        source: 'manual_review',
      });
      setDetail(next);
      setReviewForm((current) => ({ ...current, body: '' }));
      setNotice('Review event appended to the immutable comment trail.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to append review event.');
    } finally {
      setBusy(false);
    }
  }

  async function runPendingAction() {
    const action = pendingAction;
    if (!action) return;

    if (action === 'generate') {
      await generateDraft();
    } else if (action === 'reconcile') {
      await reconcile();
    } else if (action === 'materialize') {
      await materialize();
    } else if (action === 'review') {
      await submitReview();
    }

    setPendingAction(null);
  }

  const selectedItem = detail?.items.find((item) => item.id === selectedItemId) ?? detail?.items[0] ?? null;
  const missingFeedItems = detail?.items.filter((item) => item.missingFeed) ?? [];
  const challengedItems = detail?.items.filter((item) => item.reviewerChallenge) ?? [];
  const responses = detail?.items.filter((item) => item.sufficiencyState !== 'draft') ?? [];
  const pendingActionTitle =
    pendingAction === 'generate'
      ? 'Generate scrutiny run'
      : pendingAction === 'reconcile'
        ? 'Reconcile scrutiny run'
        : pendingAction === 'materialize'
          ? 'Materialize evidence requests'
          : pendingAction === 'review'
            ? 'Append review event'
            : '';
  const pendingActionDescription =
    pendingAction === 'generate'
      ? 'Review the draft scope before creating a new scrutiny run.'
      : pendingAction === 'reconcile'
        ? 'Review this reconciliation action before refreshing suggested sufficiency states.'
        : pendingAction === 'materialize'
          ? 'Review the operational records that will be created from this scrutiny run.'
          : pendingAction === 'review'
            ? 'Review the authoritative comment before appending it to the immutable trail.'
            : undefined;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.28em] text-[#7a3ccf]">
            <ShieldCheck className="h-4 w-4" />
            GRC Scrutiny Engine
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#241232]">Assessor scrutiny cockpit</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-[#6f6578]">
            Controls generate questions, questions generate evidence requests, responses are reconciled for sufficiency, and comments remain the living audit trail. Regovise drafts the chain; reviewers make authoritative decisions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadBasics(detail?.run.id)} disabled={loading || busy}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          {detail && (
            <Button variant="secondary" onClick={() => setPendingAction('reconcile')} disabled={busy}>
              <FileSearch className="h-4 w-4" />
              Reconcile
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#f2b7bf] bg-[#ffe2e5] p-4 text-sm text-[#9d1f2c]">
          {error}
        </div>
      )}
      {featureDisabledMessage && (
        <div className="rounded-2xl border border-[#f6d48e] bg-[#fff2d9] p-4 text-sm text-[#8a4d00]">
          {featureDisabledMessage}
        </div>
      )}
      {notice && (
        <div className="rounded-2xl border border-[#9fdfb7] bg-[#ddf7e6] p-4 text-sm text-[#126b36]">
          {notice}
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-8 text-sm text-[#6f6578]">Loading scrutiny engine...</CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="scope" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="scope">Scope</TabsTrigger>
            <TabsTrigger value="questions">Draft Questions</TabsTrigger>
            <TabsTrigger value="requests">Evidence Requests</TabsTrigger>
            <TabsTrigger value="responses">Evidence Responses</TabsTrigger>
            <TabsTrigger value="review">Sufficiency Review</TabsTrigger>
            <TabsTrigger value="comments">Comment Trail</TabsTrigger>
            <TabsTrigger value="feeds">Missing Feeds</TabsTrigger>
            <TabsTrigger value="records">Materialized Records</TabsTrigger>
          </TabsList>

          <TabsContent value="scope" className="space-y-4">
            {readiness && (
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle>Tenant Readiness</CardTitle>
                      <CardDescription>
                        Confirms each tenant has the building blocks for draft-first assessor scrutiny before operational records are created.
                      </CardDescription>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${readinessPillClass(readiness.ready ? 'ok' : readiness.feature.enabled ? 'warn' : 'blocker')}`}>
                      {readiness.ready ? 'Ready' : readiness.feature.enabled ? 'Needs setup' : 'Feature disabled'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-[#ded8e4] bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[#62576a]">Tenant</div>
                      <div className="mt-2 text-sm font-semibold text-[#241232]">{readiness.feature.tenantSlug ?? 'current workspace'}</div>
                    </div>
                    <div className="rounded-2xl border border-[#ded8e4] bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[#62576a]">Domain folders</div>
                      <div className="mt-2 text-sm font-semibold text-[#241232]">{readiness.counts.folders.domain + readiness.counts.folders.root}</div>
                    </div>
                    <div className="rounded-2xl border border-[#ded8e4] bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[#62576a]">Scrutiny runs</div>
                      <div className="mt-2 text-sm font-semibold text-[#241232]">{readiness.counts.runs}</div>
                    </div>
                    <div className="rounded-2xl border border-[#ded8e4] bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[#62576a]">Pattern sources</div>
                      <div className="mt-2 text-sm font-semibold text-[#241232]">
                        {Object.keys(readiness.patternSources).length || 0}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-2">
                    {readiness.checks.map((check) => (
                      <div key={check.id} className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${readinessPillClass(check.status)}`}>
                            {check.status}
                          </span>
                          <span className="text-sm font-semibold text-[#241232]">{check.label}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[#6f6578]">{check.message}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 lg:grid-cols-3">
                    <div className="rounded-2xl border border-[#ded8e4] bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[#62576a]">Probe Controls</div>
                      <div className="mt-2 text-sm text-[#4f435c]">{readiness.probe.controlRefs.join(', ') || 'Default starter controls'}</div>
                    </div>
                    <div className="rounded-2xl border border-[#ded8e4] bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[#62576a]">Source Mix</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(readiness.patternSources).map(([source, count]) => (
                          <span key={source} className="rounded-full border border-[#d7c3f1] bg-[#f2e8ff] px-2 py-1 text-xs text-[#5f1aa8]">
                            {source.replace(/_/g, ' ')}: {count}
                          </span>
                        ))}
                        {Object.keys(readiness.patternSources).length === 0 && (
                          <span className="text-sm text-[#6f6578]">No source probe results yet.</span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#ded8e4] bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[#62576a]">Generated Tags</div>
                      <div className="mt-2 text-sm text-[#4f435c]">{readiness.generatedRecordTags.slice(0, 6).join(', ')}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Generate Scrutiny Run</CardTitle>
                  <CardDescription>
                    Draft mode writes scrutiny tables only. Materialization is a separate human-approved step.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 md:col-span-2">
                    <span className="label">Run title</span>
                    <input
                      value={draftForm.title}
                      onChange={(event) => setDraftForm((current) => ({ ...current, title: event.target.value }))}
                      className="w-full rounded-2xl border border-[#ded8e4] bg-white px-3 py-2 text-sm text-[#241232] outline-none focus:border-[#b788ed]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="label">Folder scope</span>
                    <select
                      value={draftForm.folderId}
                      onChange={(event) => setDraftForm((current) => ({ ...current, folderId: event.target.value }))}
                      className="w-full rounded-2xl border border-[#ded8e4] bg-white px-3 py-2 text-sm text-[#241232] outline-none focus:border-[#b788ed]"
                    >
                      <option value="">Draft without materialization folder</option>
                      {folders
                        .filter((folder) => folder.contentType === 'domain' || folder.contentType === 'root')
                        .map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.pathLabel || folder.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="label">Scope type</span>
                    <select
                      value={draftForm.scopeType}
                      onChange={(event) => setDraftForm((current) => ({ ...current, scopeType: event.target.value }))}
                      className="w-full rounded-2xl border border-[#ded8e4] bg-white px-3 py-2 text-sm text-[#241232] outline-none focus:border-[#b788ed]"
                    >
                      <option value="package">Assessment Evidence Package</option>
                      <option value="controls">Control refs</option>
                      <option value="record">Module record</option>
                      <option value="default">Default FedRAMP starter</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="label">Package marker</span>
                    <input
                      value={draftForm.packageMarker}
                      onChange={(event) => setDraftForm((current) => ({ ...current, packageMarker: event.target.value }))}
                      placeholder="FEDHR-FY20-FEDRAMP-XLSX"
                      className="w-full rounded-2xl border border-[#ded8e4] bg-white px-3 py-2 text-sm text-[#241232] outline-none focus:border-[#b788ed]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="label">Control refs</span>
                    <input
                      value={draftForm.controlRefs}
                      onChange={(event) => setDraftForm((current) => ({ ...current, controlRefs: event.target.value }))}
                      placeholder="AC-2, IA-2, SI-4"
                      className="w-full rounded-2xl border border-[#ded8e4] bg-white px-3 py-2 text-sm text-[#241232] outline-none focus:border-[#b788ed]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="label">Module key</span>
                    <input
                      value={draftForm.moduleKey}
                      onChange={(event) => setDraftForm((current) => ({ ...current, moduleKey: event.target.value }))}
                      placeholder="security-controls"
                      className="w-full rounded-2xl border border-[#ded8e4] bg-white px-3 py-2 text-sm text-[#241232] outline-none focus:border-[#b788ed]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="label">Record id</span>
                    <input
                      value={draftForm.recordId}
                      onChange={(event) => setDraftForm((current) => ({ ...current, recordId: event.target.value }))}
                      placeholder="Optional current record id"
                      className="w-full rounded-2xl border border-[#ded8e4] bg-white px-3 py-2 text-sm text-[#241232] outline-none focus:border-[#b788ed]"
                    />
                  </label>
                  <Button className="md:col-span-2" onClick={() => setPendingAction('generate')} disabled={busy}>
                    <PlayCircle className="h-4 w-4" />
                    Generate Scrutiny Run
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Runs</CardTitle>
                  <CardDescription>Select a prior run or inspect pattern coverage before drafting.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {runs.slice(0, 8).map((run) => (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => void openRun(run.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        detail?.run.id === run.id
                          ? 'border-[#c7a9ed] bg-[#f2e8ff] text-[#4f227d]'
                          : 'border-[#ded8e4] bg-[#fbf9fc] text-[#4f435c] hover:border-[#d7c3f1]'
                      }`}
                    >
                      <div className="font-medium">{run.title}</div>
                      <div className="mt-2 text-xs text-[#62576a]">
                        {run.status} - {formatDate(run.updatedAt)}
                      </div>
                    </button>
                  ))}
                  {runs.length === 0 && <div className="text-sm text-[#6f6578]">No scrutiny runs yet.</div>}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              {[
                ['Items', metricValue(detail?.metrics ?? {}, 'totalItems')],
                ['Missing feeds', metricValue(detail?.metrics ?? {}, 'missingFeeds')],
                ['Challenges', metricValue(detail?.metrics ?? {}, 'reviewerChallenges')],
                ['Comments', metricValue(detail?.metrics ?? {}, 'commentEvents')],
              ].map(([label, value]) => (
                <Card key={label}>
                  <CardContent className="p-5">
                    <div className="text-xs uppercase tracking-[0.2em] text-[#62576a]">{label}</div>
                    <div className="mt-3 text-3xl font-semibold text-[#241232]">{value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="questions">
            <Card>
              <CardHeader>
                <CardTitle>Draft Questions</CardTitle>
                <CardDescription>
                  Pattern priority is imported FedHR/FedRAMP rows, persisted patterns, SCF evidence requests, questionnaire questions, then generated fallback.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 xl:grid-cols-2">
                {(detail?.items ?? []).map((item) => (
                  <ItemMiniCard key={item.id} item={item} onSelect={(next) => setSelectedItemId(next.id)} />
                ))}
                {!detail && patterns.slice(0, 12).map((pattern) => (
                  <div key={`${pattern.source}-${pattern.sourceRef}-${pattern.controlRef}-${pattern.questionPrompt}`} className="rounded-2xl border border-[#ded8e4] bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[#d7c3f1] bg-[#f2e8ff] px-2 py-1 text-xs text-[#6d28d9]">
                        {pattern.controlRef}
                      </span>
                      <span className="rounded-full border border-[#ded8e4] bg-[#f6f1fa] px-2 py-1 text-xs text-[#4f435c]">
                        {sourceLabel(pattern.source)}
                      </span>
                    </div>
                    <div className="mt-3 text-sm font-semibold text-[#241232]">{pattern.questionPrompt}</div>
                    <div className="mt-2 text-sm text-[#6f6578]">{pattern.evidenceHint ?? pattern.evidenceType}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle>Evidence Requests</CardTitle>
                <CardDescription>
                  Materialize all draft items or provide comma-separated item ids to materialize a subset.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1fr_180px_220px_auto]">
                  <input
                    value={materializeForm.itemIds}
                    onChange={(event) => setMaterializeForm((current) => ({ ...current, itemIds: event.target.value }))}
                    placeholder="Optional item ids, comma-separated"
                    className="rounded-2xl border border-[#ded8e4] bg-white px-3 py-2 text-sm text-[#241232] outline-none focus:border-[#b788ed]"
                  />
                  <input
                    value={materializeForm.dueOn}
                    onChange={(event) => setMaterializeForm((current) => ({ ...current, dueOn: event.target.value }))}
                    type="date"
                    className="rounded-2xl border border-[#ded8e4] bg-white px-3 py-2 text-sm text-[#241232] outline-none focus:border-[#b788ed]"
                  />
                  <label className="flex items-center gap-2 rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] px-3 py-2 text-sm text-[#4f435c]">
                    <input
                      type="checkbox"
                      checked={materializeForm.createQuestionnaireTemplate}
                      onChange={(event) => setMaterializeForm((current) => ({ ...current, createQuestionnaireTemplate: event.target.checked }))}
                    />
                    Create template
                  </label>
                  <Button onClick={() => setPendingAction('materialize')} disabled={!detail || busy}>
                    Materialize
                  </Button>
                </div>
                <div className="grid min-w-0 gap-4 2xl:grid-cols-2">
                  {(detail?.items ?? []).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-[#ded8e4] bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-[#241232]">{item.controlRef}</div>
                        <span className={`rounded-full border px-2 py-1 text-xs ${statePillClass(item.sufficiencyState)}`}>
                          {item.sufficiencyState.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-[#fbf9fc] p-3 text-xs leading-5 text-[#4f435c]">
                        {item.evidenceRequest}
                      </pre>
                      <div className="mt-3 text-xs text-[#62576a]">Item id: {item.id}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="responses">
            <Card>
              <CardHeader>
                <CardTitle>Evidence Responses</CardTitle>
                <CardDescription>
                  Reconcile checks materialized records and evidence placeholders, then suggests states without silently accepting evidence.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {responses.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[#241232]">{item.controlRef}: {item.evidenceType}</div>
                        <div className="mt-1 text-sm text-[#6f6578]">{item.questionPrompt}</div>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-xs ${statePillClass(item.sufficiencyState)}`}>
                        {item.sufficiencyState.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm">
                      {item.dataCallRecordId && (
                        <Link className="inline-flex items-center gap-1 text-[#6d28d9] hover:text-[#5f1aa8]" to={`/data-calls?record=${encodeURIComponent(item.dataCallRecordId)}`}>
                          <Link2 className="h-3 w-3" />
                          Data Call
                        </Link>
                      )}
                      {item.evidenceRecordIds.map((recordId) => (
                        <Link key={recordId} className="inline-flex items-center gap-1 text-[#6d28d9] hover:text-[#5f1aa8]" to={`/evidence-locker?record=${encodeURIComponent(recordId)}`}>
                          <Link2 className="h-3 w-3" />
                          Evidence Placeholder
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
                {responses.length === 0 && <div className="text-sm text-[#6f6578]">No materialized or reconciled responses yet.</div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="review">
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Sufficiency Review</CardTitle>
                  <CardDescription>Reviewer action is authoritative; reconciliation only suggests.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <select
                    value={selectedItemId}
                    onChange={(event) => setSelectedItemId(event.target.value)}
                    className="w-full rounded-2xl border border-[#ded8e4] bg-white px-3 py-2 text-sm text-[#241232] outline-none focus:border-[#b788ed]"
                  >
                    {(detail?.items ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.controlRef} - {item.questionPrompt.slice(0, 80)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={reviewForm.nextState}
                    onChange={(event) => setReviewForm((current) => ({ ...current, nextState: event.target.value as ScrutinySufficiencyState, eventType: event.target.value }))}
                    className="w-full rounded-2xl border border-[#ded8e4] bg-white px-3 py-2 text-sm text-[#241232] outline-none focus:border-[#b788ed]"
                  >
                    {sufficiencyStates.map((state) => (
                      <option key={state} value={state}>{state.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <textarea
                    value={reviewForm.body}
                    onChange={(event) => setReviewForm((current) => ({ ...current, body: event.target.value }))}
                    rows={7}
                    placeholder="Why is this accepted, challenged, clarified, still needed, or not applicable?"
                    className="w-full rounded-2xl border border-[#ded8e4] bg-white px-3 py-2 text-sm text-[#241232] outline-none focus:border-[#b788ed]"
                  />
                  <Button onClick={() => setPendingAction('review')} disabled={!selectedItemId || !reviewForm.body.trim() || busy}>
                    <MessageSquare className="h-4 w-4" />
                    Append Review Event
                  </Button>
                </CardContent>
              </Card>
              {selectedItem ? (
                <ItemMiniCard item={selectedItem} />
              ) : (
                <Card>
                  <CardContent className="p-8 text-sm text-[#6f6578]">Select an item to review.</CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="comments">
            <Card>
              <CardHeader>
                <CardTitle>Comment Trail</CardTitle>
                <CardDescription>Comments are append-only events with previous and next sufficiency states.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(detail?.commentEvents ?? []).map((event) => {
                  const item = detail?.items.find((candidate) => candidate.id === event.itemId);
                  return (
                    <div key={event.id} className="rounded-2xl border border-[#ded8e4] bg-white p-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full border border-[#d7c3f1] bg-[#f2e8ff] px-2 py-1 text-[#6d28d9]">
                          {item?.controlRef ?? event.itemId}
                        </span>
                        <span className="rounded-full border border-[#ded8e4] bg-[#f6f1fa] px-2 py-1 text-[#4f435c]">
                          {event.eventType.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[#62576a]">{formatDate(event.createdAt)}</span>
                      </div>
                      <div className="mt-3 text-sm leading-6 text-[#4f435c]">{event.body}</div>
                      <div className="mt-2 text-xs text-[#62576a]">
                        {event.author} via {event.source} - {event.previousState ?? '-'} to {event.nextState ?? '-'}
                      </div>
                    </div>
                  );
                })}
                {(detail?.commentEvents.length ?? 0) === 0 && <div className="text-sm text-[#6f6578]">No comment events yet.</div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feeds">
            <div className="grid min-w-0 gap-4 2xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Missing Feeds</CardTitle>
                  <CardDescription>Coverage gaps are explicit work context, not hidden blockers.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {missingFeedItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-[#f6d48e] bg-[#fff2d9] p-4">
                      <div className="flex items-center gap-2 font-semibold text-[#8a4d00]">
                        <AlertTriangle className="h-4 w-4" />
                        {item.controlRef}
                      </div>
                      <div className="mt-2 text-sm text-[#8a4d00]">{joinControlRefs(item.coverage.missingFeeds) || 'No source feed matched this control.'}</div>
                      <div className="mt-2 text-sm text-[#4f435c]">{item.questionPrompt}</div>
                    </div>
                  ))}
                  {missingFeedItems.length === 0 && <div className="text-sm text-[#6f6578]">No missing-feed items in this run.</div>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Reviewer Challenges</CardTitle>
                  <CardDescription>Items with comments or classifications that require explicit follow-up.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {challengedItems.map((item) => (
                    <ItemMiniCard key={item.id} item={item} onSelect={(next) => setSelectedItemId(next.id)} />
                  ))}
                  {challengedItems.length === 0 && <div className="text-sm text-[#6f6578]">No challenged items yet.</div>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="records">
            <Card>
              <CardHeader>
                <CardTitle>Materialized Records</CardTitle>
                <CardDescription>Backlinks connect generated records to the originating run and item.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(detail?.materializedLinks ?? []).map((link) => (
                  <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
                    <div>
                      <div className="font-semibold text-[#241232]">{link.targetModule}</div>
                      <div className="mt-1 text-xs text-[#62576a]">{link.relationType} - {link.targetId}</div>
                    </div>
                    {link.route && (
                      <Button variant="secondary" asChild>
                        <Link to={link.route}>
                          <ClipboardCheck className="h-4 w-4" />
                          Open
                        </Link>
                      </Button>
                    )}
                  </div>
                ))}
                {(detail?.materializedLinks.length ?? 0) === 0 && <div className="text-sm text-[#6f6578]">No materialized records yet.</div>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
      <RegModal
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
          }
        }}
        title={pendingActionTitle}
        description={pendingActionDescription}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button className="button-secondary" onClick={() => setPendingAction(null)} type="button">
              Cancel
            </button>
            <button className="button-primary" disabled={busy} onClick={() => void runPendingAction()} type="button">
              {busy
                ? 'Working...'
                : pendingAction === 'generate'
                  ? 'Generate run'
                  : pendingAction === 'reconcile'
                    ? 'Reconcile'
                    : pendingAction === 'materialize'
                      ? 'Materialize records'
                      : 'Append review'}
            </button>
          </div>
        }
      >
        {pendingAction === 'generate' ? (
          <div className="space-y-4 text-sm text-[#4f435c]">
            <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="font-semibold text-[#241232]">{draftForm.title || 'Untitled scrutiny run'}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="status-pill-neutral">{draftForm.scopeType}</span>
                <span className="status-pill-neutral">
                  {draftForm.folderId ? folders.find((folder) => folder.id === draftForm.folderId)?.pathLabel || 'Scoped folder' : 'No folder'}
                </span>
              </div>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="label">Package marker</dt>
                <dd className="mt-1 text-[#241232]">{draftForm.packageMarker || 'Not provided'}</dd>
              </div>
              <div>
                <dt className="label">Control refs</dt>
                <dd className="mt-1 text-[#241232]">{draftForm.controlRefs || 'Default starter controls'}</dd>
              </div>
              <div>
                <dt className="label">Module key</dt>
                <dd className="mt-1 text-[#241232]">{draftForm.moduleKey || 'Not provided'}</dd>
              </div>
              <div>
                <dt className="label">Record id</dt>
                <dd className="mt-1 text-[#241232]">{draftForm.recordId || 'Not provided'}</dd>
              </div>
            </dl>
          </div>
        ) : pendingAction === 'reconcile' ? (
          <div className="space-y-4 text-sm text-[#4f435c]">
            <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="font-semibold text-[#241232]">{detail?.run.title ?? 'Current scrutiny run'}</div>
              <p className="mt-2 leading-6">
                Reconciliation checks materialized records and evidence placeholders, then refreshes suggested states.
                Reviewers still make the authoritative acceptance or challenge decision.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="panel-subtle">
                <div className="label">Items</div>
                <div className="mt-2 text-2xl font-semibold text-[#241232]">{metricValue(detail?.metrics ?? {}, 'totalItems')}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Missing feeds</div>
                <div className="mt-2 text-2xl font-semibold text-[#241232]">{metricValue(detail?.metrics ?? {}, 'missingFeeds')}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Challenges</div>
                <div className="mt-2 text-2xl font-semibold text-[#241232]">{metricValue(detail?.metrics ?? {}, 'reviewerChallenges')}</div>
              </div>
            </div>
          </div>
        ) : pendingAction === 'materialize' ? (
          <div className="space-y-4 text-sm text-[#4f435c]">
            <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="font-semibold text-[#241232]">{detail?.run.title ?? 'Current scrutiny run'}</div>
              <p className="mt-2 leading-6">
                Materialization creates Data Call and Evidence Locker records for the selected scrutiny items using the
                existing backend workflow.
              </p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="label">Item ids</dt>
                <dd className="mt-1 text-[#241232]">{materializeForm.itemIds || 'All draft items'}</dd>
              </div>
              <div>
                <dt className="label">Due date</dt>
                <dd className="mt-1 text-[#241232]">{materializeForm.dueOn || 'No due date'}</dd>
              </div>
              <div>
                <dt className="label">Questionnaire template</dt>
                <dd className="mt-1 text-[#241232]">{materializeForm.createQuestionnaireTemplate ? 'Create template' : 'Do not create template'}</dd>
              </div>
              <div>
                <dt className="label">Available items</dt>
                <dd className="mt-1 text-[#241232]">{detail?.items.length ?? 0}</dd>
              </div>
            </dl>
          </div>
        ) : pendingAction === 'review' ? (
          <div className="space-y-4 text-sm text-[#4f435c]">
            <div className="rounded-2xl border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="font-semibold text-[#241232]">{selectedItem?.controlRef ?? 'Selected item'}</div>
              <p className="mt-2 leading-6">{selectedItem?.questionPrompt ?? 'No selected item.'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="status-pill-neutral">{reviewForm.nextState.replace(/_/g, ' ')}</span>
                <span className="status-pill-neutral">{reviewForm.eventType.replace(/_/g, ' ')}</span>
              </div>
            </div>
            <div>
              <div className="label">Comment body</div>
              <div className="mt-2 max-h-52 overflow-auto rounded-2xl border border-[#ded8e4] bg-white p-4 text-[#241232]">
                {reviewForm.body.trim()}
              </div>
            </div>
          </div>
        ) : null}
      </RegModal>
    </div>
  );
}
