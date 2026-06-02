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
  getScrutinyRun,
  listScrutinyRuns,
  materializeScrutinyRun,
  reconcileScrutinyRun,
  reviewScrutinyItem,
} from './api';
import type {
  ScrutinyItem,
  ScrutinyPattern,
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

function stateBadgeClass(state: ScrutinySufficiencyState | string) {
  if (state === 'accepted') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200';
  if (state === 'challenged' || state === 'still_needed' || state === 'clarification_needed') {
    return 'border-amber-400/30 bg-amber-500/10 text-amber-200';
  }
  if (state === 'responded') return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200';
  return 'border-white/10 bg-white/[0.04] text-slate-300';
}

function joinControlRefs(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string').join(', ') : '';
}

function ItemMiniCard({ item, onSelect }: { item: ScrutinyItem; onSelect?: (item: ScrutinyItem) => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-xs font-semibold text-cyan-200">
          {item.controlRef}
        </span>
        <span className={`rounded-full border px-2 py-1 text-xs ${stateBadgeClass(item.sufficiencyState)}`}>
          {item.sufficiencyState.replace(/_/g, ' ')}
        </span>
        {item.missingFeed && (
          <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
            missing feed
          </span>
        )}
        {item.reviewerChallenge && (
          <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
            reviewer challenge
          </span>
        )}
      </div>
      <div className="mt-3 text-sm font-semibold text-white">{item.questionPrompt}</div>
      <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{item.evidenceType}</div>
      {item.evidenceHint && <div className="mt-2 text-sm leading-6 text-slate-400">{item.evidenceHint}</div>}
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
  const [detail, setDetail] = useState<ScrutinyRunDetail | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [featureDisabledMessage, setFeatureDisabledMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
      const [folderResponse, runResponse, patternResponse] = await Promise.all([
        client.get<{ data: WorkspaceFolder[] }>('/iam/folders'),
        listScrutinyRuns(),
        getScrutinyPatterns({
          packageMarker: initialPackageMarker || undefined,
          controlRefs: initialControlRefs
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      ]);
      setFolders(folderResponse.data);
      setRuns(runResponse);
      setPatterns(patternResponse.patterns);
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

  const selectedItem = detail?.items.find((item) => item.id === selectedItemId) ?? detail?.items[0] ?? null;
  const missingFeedItems = detail?.items.filter((item) => item.missingFeed) ?? [];
  const challengedItems = detail?.items.filter((item) => item.reviewerChallenge) ?? [];
  const responses = detail?.items.filter((item) => item.sufficiencyState !== 'draft') ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300/70">
            <ShieldCheck className="h-4 w-4" />
            GRC Scrutiny Engine
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Assessor scrutiny cockpit</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            Controls generate questions, questions generate evidence requests, responses are reconciled for sufficiency, and comments remain the living audit trail. Regovise drafts the chain; reviewers make authoritative decisions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadBasics(detail?.run.id)} disabled={loading || busy}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          {detail && (
            <Button variant="secondary" onClick={() => void reconcile()} disabled={busy}>
              <FileSearch className="h-4 w-4" />
              Reconcile
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}
      {featureDisabledMessage && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          {featureDisabledMessage}
        </div>
      )}
      {notice && (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {notice}
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-8 text-sm text-slate-400">Loading scrutiny engine...</CardContent>
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
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="label">Folder scope</span>
                    <select
                      value={draftForm.folderId}
                      onChange={(event) => setDraftForm((current) => ({ ...current, folderId: event.target.value }))}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
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
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
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
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="label">Control refs</span>
                    <input
                      value={draftForm.controlRefs}
                      onChange={(event) => setDraftForm((current) => ({ ...current, controlRefs: event.target.value }))}
                      placeholder="AC-2, IA-2, SI-4"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="label">Module key</span>
                    <input
                      value={draftForm.moduleKey}
                      onChange={(event) => setDraftForm((current) => ({ ...current, moduleKey: event.target.value }))}
                      placeholder="security-controls"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="label">Record id</span>
                    <input
                      value={draftForm.recordId}
                      onChange={(event) => setDraftForm((current) => ({ ...current, recordId: event.target.value }))}
                      placeholder="Optional current record id"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                    />
                  </label>
                  <Button className="md:col-span-2" onClick={() => void generateDraft()} disabled={busy}>
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
                          ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-50'
                          : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20'
                      }`}
                    >
                      <div className="font-medium">{run.title}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        {run.status} - {formatDate(run.updatedAt)}
                      </div>
                    </button>
                  ))}
                  {runs.length === 0 && <div className="text-sm text-slate-400">No scrutiny runs yet.</div>}
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
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
                    <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
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
                  <div key={`${pattern.source}-${pattern.sourceRef}-${pattern.controlRef}-${pattern.questionPrompt}`} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-200">
                        {pattern.controlRef}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-300">
                        {sourceLabel(pattern.source)}
                      </span>
                    </div>
                    <div className="mt-3 text-sm font-semibold text-white">{pattern.questionPrompt}</div>
                    <div className="mt-2 text-sm text-slate-400">{pattern.evidenceHint ?? pattern.evidenceType}</div>
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
                    className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                  />
                  <input
                    value={materializeForm.dueOn}
                    onChange={(event) => setMaterializeForm((current) => ({ ...current, dueOn: event.target.value }))}
                    type="date"
                    className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                  />
                  <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={materializeForm.createQuestionnaireTemplate}
                      onChange={(event) => setMaterializeForm((current) => ({ ...current, createQuestionnaireTemplate: event.target.checked }))}
                    />
                    Create template
                  </label>
                  <Button onClick={() => void materialize()} disabled={!detail || busy}>
                    Materialize
                  </Button>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {(detail?.items ?? []).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-white">{item.controlRef}</div>
                        <span className={`rounded-full border px-2 py-1 text-xs ${stateBadgeClass(item.sufficiencyState)}`}>
                          {item.sufficiencyState.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-black/20 p-3 text-xs leading-5 text-slate-300">
                        {item.evidenceRequest}
                      </pre>
                      <div className="mt-3 text-xs text-slate-500">Item id: {item.id}</div>
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
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{item.controlRef}: {item.evidenceType}</div>
                        <div className="mt-1 text-sm text-slate-400">{item.questionPrompt}</div>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-xs ${stateBadgeClass(item.sufficiencyState)}`}>
                        {item.sufficiencyState.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm">
                      {item.dataCallRecordId && (
                        <Link className="inline-flex items-center gap-1 text-cyan-200 hover:text-cyan-100" to={`/data-calls?record=${encodeURIComponent(item.dataCallRecordId)}`}>
                          <Link2 className="h-3 w-3" />
                          Data Call
                        </Link>
                      )}
                      {item.evidenceRecordIds.map((recordId) => (
                        <Link key={recordId} className="inline-flex items-center gap-1 text-cyan-200 hover:text-cyan-100" to={`/evidence-locker?record=${encodeURIComponent(recordId)}`}>
                          <Link2 className="h-3 w-3" />
                          Evidence Placeholder
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
                {responses.length === 0 && <div className="text-sm text-slate-400">No materialized or reconciled responses yet.</div>}
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
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
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
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
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
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                  />
                  <Button onClick={() => void submitReview()} disabled={!selectedItemId || !reviewForm.body.trim() || busy}>
                    <MessageSquare className="h-4 w-4" />
                    Append Review Event
                  </Button>
                </CardContent>
              </Card>
              {selectedItem ? (
                <ItemMiniCard item={selectedItem} />
              ) : (
                <Card>
                  <CardContent className="p-8 text-sm text-slate-400">Select an item to review.</CardContent>
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
                    <div key={event.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-cyan-200">
                          {item?.controlRef ?? event.itemId}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-slate-300">
                          {event.eventType.replace(/_/g, ' ')}
                        </span>
                        <span className="text-slate-500">{formatDate(event.createdAt)}</span>
                      </div>
                      <div className="mt-3 text-sm leading-6 text-slate-300">{event.body}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        {event.author} via {event.source} - {event.previousState ?? '-'} to {event.nextState ?? '-'}
                      </div>
                    </div>
                  );
                })}
                {(detail?.commentEvents.length ?? 0) === 0 && <div className="text-sm text-slate-400">No comment events yet.</div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feeds">
            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Missing Feeds</CardTitle>
                  <CardDescription>Coverage gaps are explicit work context, not hidden blockers.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {missingFeedItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                      <div className="flex items-center gap-2 font-semibold text-amber-100">
                        <AlertTriangle className="h-4 w-4" />
                        {item.controlRef}
                      </div>
                      <div className="mt-2 text-sm text-amber-100/80">{joinControlRefs(item.coverage.missingFeeds) || 'No source feed matched this control.'}</div>
                      <div className="mt-2 text-sm text-slate-300">{item.questionPrompt}</div>
                    </div>
                  ))}
                  {missingFeedItems.length === 0 && <div className="text-sm text-slate-400">No missing-feed items in this run.</div>}
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
                  {challengedItems.length === 0 && <div className="text-sm text-slate-400">No challenged items yet.</div>}
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
                  <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div>
                      <div className="font-semibold text-white">{link.targetModule}</div>
                      <div className="mt-1 text-xs text-slate-500">{link.relationType} - {link.targetId}</div>
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
                {(detail?.materializedLinks.length ?? 0) === 0 && <div className="text-sm text-slate-400">No materialized records yet.</div>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
