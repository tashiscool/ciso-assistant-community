import { useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle2, ChevronLeft, ChevronRight, FileSpreadsheet, Search, Sparkles, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useEdgeIdentity } from '../../shared/session/identity';
import {
  createResponseAutomationJob,
  deleteResponseAutomationItem,
  deleteResponseAutomationJob,
  getResponseAutomationJob,
  getResponseAutomationWorkspace,
  updateResponseAutomationItem,
} from './api';
import type { ResponseAutomationJobDetail, ResponseAutomationItem, ResponseAutomationWorkspace } from './types';

type WizardStep = 'intake' | 'sources' | 'launch';

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function statusBadgeClass(status: string) {
  if (status === 'Finished') return 'badge-success';
  if (status === 'Attention') return 'badge-danger';
  return 'badge-neutral';
}

function confidenceBadgeClass(value: number) {
  if (value >= 85) return 'badge-success';
  if (value >= 60) return 'badge-neutral';
  return 'badge-danger';
}

export function ResponseAutomationPage() {
  const { identity } = useEdgeIdentity();
  const [workspace, setWorkspace] = useState<ResponseAutomationWorkspace | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ResponseAutomationJobDetail | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>('intake');
  const [title, setTitle] = useState('');
  const [sourceDocument, setSourceDocument] = useState('security-questionnaire.docx');
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [answerFilter, setAnswerFilter] = useState<'all' | 'answered' | 'unanswered'>('all');
  const [acceptedFilter, setAcceptedFilter] = useState<'all' | 'accepted' | 'unaccepted'>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [page, setPage] = useState(0);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [draftAccepted, setDraftAccepted] = useState<Record<string, boolean>>({});
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadWorkspace() {
    try {
      setLoading(true);
      setError(null);
      const next = await getResponseAutomationWorkspace();
      setWorkspace(next);
      setSelectedJobId((current) => current ?? next.jobs[0]?.id ?? null);
      setSelectedSourceIds((current) => (current.length > 0 ? current : next.sources.slice(0, 3).map((source) => source.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Response Automation.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(jobId: string) {
    try {
      setDetailLoading(true);
      setError(null);
      const next = await getResponseAutomationJob(jobId);
      setDetail(next);
      setDraftAnswers(Object.fromEntries(next.items.map((item) => [item.id, item.answer])));
      setDraftAccepted(Object.fromEntries(next.items.map((item) => [item.id, item.accepted])));
      setSelectedItemId(next.items[0]?.id ?? null);
      setPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load response-automation job.');
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [identity.tenantId, identity.userId]);

  useEffect(() => {
    if (selectedJobId) {
      void loadDetail(selectedJobId);
    } else {
      setDetail(null);
    }
  }, [selectedJobId]);

  const metrics = useMemo(() => {
    return [
      {
        label: 'Jobs',
        value: workspace?.jobs.length ?? 0,
        detail: 'Response-automation review packages stored in the canonical Worker runtime.',
      },
      {
        label: 'Sources',
        value: workspace?.sources.length ?? 0,
        detail: 'Policies, questionnaires, security plans, and evidence available for grounded answering.',
      },
      {
        label: 'Review-ready',
        value: workspace?.jobs.filter((job) => job.status === 'Needs Review').length ?? 0,
        detail: 'Jobs awaiting reviewer edits and acceptance tracking.',
      },
      {
        label: 'Finished',
        value: workspace?.jobs.filter((job) => job.status === 'Finished').length ?? 0,
        detail: 'Completed jobs with exports linked into the canonical files history layer.',
      },
    ];
  }, [workspace]);

  const filteredItems = useMemo(() => {
    if (!detail) {
      return [];
    }

    return detail.items.filter((item) => {
      const query = search.trim().toLowerCase();
      if (query && !`${item.question} ${draftAnswers[item.id] ?? item.answer}`.toLowerCase().includes(query)) {
        return false;
      }
      if (answerFilter === 'answered' && !(draftAnswers[item.id] ?? item.answer).trim()) {
        return false;
      }
      if (answerFilter === 'unanswered' && (draftAnswers[item.id] ?? item.answer).trim()) {
        return false;
      }
      if (acceptedFilter === 'accepted' && !(draftAccepted[item.id] ?? item.accepted)) {
        return false;
      }
      if (acceptedFilter === 'unaccepted' && (draftAccepted[item.id] ?? item.accepted)) {
        return false;
      }
      if (confidenceFilter === 'high' && item.confidence < 85) {
        return false;
      }
      if (confidenceFilter === 'medium' && (item.confidence < 60 || item.confidence >= 85)) {
        return false;
      }
      if (confidenceFilter === 'low' && item.confidence >= 60) {
        return false;
      }
      return true;
    });
  }, [acceptedFilter, answerFilter, confidenceFilter, detail, draftAccepted, draftAnswers, search]);

  const pageSize = detail?.session.perPage ?? 10;
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = filteredItems.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  const selectedItem = pageItems.find((item) => item.id === selectedItemId) ?? pageItems[0] ?? null;

  useEffect(() => {
    if (selectedItem) {
      setSelectedItemId(selectedItem.id);
    }
  }, [selectedItem?.id]);

  async function handleCreateJob() {
    try {
      setBusy('create');
      setError(null);
      setNotice(null);
      const created = await createResponseAutomationJob({
        title: title.trim() || `Response Job ${workspace ? workspace.jobs.length + 1 : 1}`,
        sourceDocument,
        sourceIds: selectedSourceIds,
        exportFormat,
      });
      await loadWorkspace();
      setSelectedJobId(created.job.id);
      setWizardStep('intake');
      setTitle('');
      setNotice('Response-automation job created and ready for review.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create response-automation job.');
    } finally {
      setBusy(null);
    }
  }

  async function saveCurrentPage() {
    if (!detail) {
      return;
    }

    try {
      setBusy('save');
      setError(null);
      setNotice(null);
      let latest: ResponseAutomationJobDetail | null = null;
      for (const item of pageItems) {
        const nextAnswer = draftAnswers[item.id] ?? item.answer;
        const nextAccepted = draftAccepted[item.id] ?? item.accepted;
        if (nextAnswer !== item.answer || nextAccepted !== item.accepted) {
          latest = await updateResponseAutomationItem(detail.job.id, item.id, {
            answer: nextAnswer,
            accepted: nextAccepted,
          });
        }
      }
      if (latest) {
        setDetail(latest);
        setDraftAnswers(Object.fromEntries(latest.items.map((item) => [item.id, item.answer])));
        setDraftAccepted(Object.fromEntries(latest.items.map((item) => [item.id, item.accepted])));
      }
      await loadWorkspace();
      setNotice('Current review page saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save response review.');
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!detail) {
      return;
    }
    try {
      setBusy(`delete-item:${itemId}`);
      setError(null);
      const next = await deleteResponseAutomationItem(detail.job.id, itemId);
      setDetail(next);
      setDraftAnswers(Object.fromEntries(next.items.map((item) => [item.id, item.answer])));
      setDraftAccepted(Object.fromEntries(next.items.map((item) => [item.id, item.accepted])));
      await loadWorkspace();
      setNotice('Question removed from the review set.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete response item.');
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteJob(jobId: string) {
    try {
      setBusy(`delete-job:${jobId}`);
      setError(null);
      await deleteResponseAutomationJob(jobId);
      if (selectedJobId === jobId) {
        setSelectedJobId(null);
      }
      await loadWorkspace();
      setNotice('Response-automation job deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete response-automation job.');
    } finally {
      setBusy(null);
    }
  }

  function acceptAllCurrentPage() {
    const next = { ...draftAccepted };
    for (const item of pageItems) {
      next[item.id] = true;
    }
    setDraftAccepted(next);
    setNotice('Marked all responses on the current page as accepted. Save to persist.');
  }

  if (loading || !workspace) {
    return <div className="panel p-6 text-sm text-slate-300">Loading Response Automation...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="eyebrow">Response Automation</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Automate questionnaire answering from approved internal sources</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Launch a response job, select grounded internal sources, review generated answers in batches of ten, and export the reviewed answer set from the canonical Cloudflare stack.
          </p>
        </div>
        <div className="panel-subtle space-y-3">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Prerequisites</div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
            Runtime provider: <span className="font-medium text-white">{workspace.health.runtimeProvider}</span> · Vector index records:{' '}
            <span className="font-medium text-white">{workspace.health.vectorCount}</span>
          </div>
          {([
            ['RegML enabled', workspace.health.regmlEnabled],
            ['Response automation enabled', workspace.health.responseAutomationEnabled],
            ['RegML backend available', workspace.health.regmlBackendAvailable],
            ['Vector database deployed', workspace.health.vectorDatabaseDeployed],
            ['Harvester processed sources', workspace.health.harvesterProcessedSources],
            ['Environment healthy', workspace.health.environmentHealthy],
          ] as Array<[string, boolean]>).map(([label, ready]) => (
            <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm">
              <span className="text-slate-300">{label}</span>
              <span className={ready ? 'badge-success' : 'badge-danger'}>{ready ? 'Ready' : 'Missing'}</span>
            </div>
          ))}
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}
      {notice && <div className="notice-success">{notice}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="panel-subtle">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{metric.label}</div>
            <div className="mt-3 text-3xl font-semibold text-white">{metric.value}</div>
            <div className="mt-2 text-sm text-slate-400">{metric.detail}</div>
          </article>
        ))}
      </section>

      <section className="panel space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="eyebrow">Start Response</div>
            <div className="mt-2 text-lg font-semibold text-white">Multi-step job creation flow</div>
          </div>
          <button className="button-primary" disabled={busy !== null} onClick={() => void handleCreateJob()}>
            <Sparkles className="h-4 w-4" />
            Start Response
          </button>
        </div>

        <Tabs value={wizardStep} onValueChange={(value) => setWizardStep(value as WizardStep)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="intake">1. Intake</TabsTrigger>
            <TabsTrigger value="sources">2. Sources</TabsTrigger>
            <TabsTrigger value="launch">3. Launch</TabsTrigger>
          </TabsList>
          <TabsContent value="intake" className="mt-6 grid gap-4 lg:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Title</span>
              <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Customer DDQ April 2026" />
            </label>
            <label className="block space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Questionnaire document</span>
              <input className="input" value={sourceDocument} onChange={(event) => setSourceDocument(event.target.value)} placeholder="questionnaire.docx" />
            </label>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300 lg:col-span-2">
              Supported intake references include `.pdf`, `.xls`, `.xlsx`, and `.docx`. This canonical stack currently stores the uploaded document name and links the final reviewed export into the shared files history layer.
            </div>
          </TabsContent>
          <TabsContent value="sources" className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {workspace.sources.map((source) => (
                <label key={source.id} className={`rounded-3xl border p-4 ${selectedSourceIds.includes(source.id) ? 'border-cyan-300/40 bg-cyan-400/[0.06]' : 'border-white/10 bg-slate-950/50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{source.label}</div>
                      <div className="mt-1 text-xs text-slate-500">{source.type}</div>
                    </div>
                    <input
                      checked={selectedSourceIds.includes(source.id)}
                      onChange={(event) =>
                        setSelectedSourceIds((current) =>
                          event.target.checked ? [...current, source.id] : current.filter((id) => id !== source.id),
                        )
                      }
                      type="checkbox"
                    />
                  </div>
                  <div className="mt-3 text-sm text-slate-300">{source.description}</div>
                  <div className="mt-3 text-xs text-slate-500">Indexed {formatDate(source.freshness)}</div>
                </label>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="launch" className="mt-6 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-3">
              <div className="panel-subtle">
                <div className="text-sm font-medium text-white">Launch Summary</div>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <div>Title: {title || 'Untitled response job'}</div>
                  <div>Source document: {sourceDocument}</div>
                  <div>Selected sources: {selectedSourceIds.length}</div>
                  <div>Export format: {exportFormat}</div>
                </div>
              </div>
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Export format</span>
                <select className="input" value={exportFormat} onChange={(event) => setExportFormat(event.target.value)}>
                  <option value="xlsx">Excel</option>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
              </label>
            </div>
            <div className="panel-subtle">
              <div className="flex items-center gap-2 text-white">
                <Bot className="h-4 w-4 text-cyan-300" />
                <span className="font-semibold">What happens next</span>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p>The Worker extracts a review set, generates grounded draft answers, tracks acceptance state, and prepares an export package in the shared files history layer.</p>
                <p>Blank responses remain intentionally blank when the selected source set does not provide enough grounding evidence.</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <section className="panel space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Jobs</div>
              <div className="mt-2 text-lg font-semibold text-white">Response Automation Job List</div>
            </div>
          </div>
          <div className="space-y-3">
            {workspace.jobs.map((job) => (
              <article key={job.id} className={`panel-subtle ${selectedJobId === job.id ? 'border-cyan-300/40 bg-cyan-400/[0.06]' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <button className="text-left" onClick={() => setSelectedJobId(job.id)} type="button">
                    <div className="text-sm font-semibold text-white">{job.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{job.sourceDocument}</div>
                  </button>
                  <span className={statusBadgeClass(job.status)}>{job.status}</span>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-slate-400">
                  <div>{job.questionCount} question(s)</div>
                  <div>{job.reviewAcceptedCount} accepted</div>
                  <div>Created {formatDate(job.createdAt)}</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="button-secondary" onClick={() => setSelectedJobId(job.id)}>
                    Open
                  </button>
                  <button className="button-secondary" onClick={() => setSelectedJobId(job.id)}>
                    Review Responses
                  </button>
                  {job.exportDownloadPath && (
                    <a className="button-secondary" href={job.exportDownloadPath} rel="noreferrer" target="_blank">
                      Export
                    </a>
                  )}
                  <button className="button-secondary text-rose-200" onClick={() => void handleDeleteJob(job.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
            {workspace.jobs.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">
                No response-automation jobs exist yet.
              </div>
            )}
          </div>
        </section>

        <section className="panel space-y-4">
          {detailLoading && <div className="text-sm text-slate-400">Loading review job...</div>}
          {!detailLoading && detail ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="eyebrow">Review Responses</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{detail.job.title}</div>
                  <div className="mt-2 text-sm text-slate-300">
                    {detail.job.sourceDocument} · {detail.job.questionCount} question(s) · {detail.job.status}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="button-secondary" onClick={acceptAllCurrentPage}>
                    Accept all on page
                  </button>
                  <button className="button-primary" disabled={busy !== null} onClick={() => void saveCurrentPage()}>
                    Save
                  </button>
                  {detail.job.exportDownloadPath && (
                    <a className="button-secondary" href={detail.job.exportDownloadPath} rel="noreferrer" target="_blank">
                      <FileSpreadsheet className="h-4 w-4" />
                      Export
                    </a>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <label className="block space-y-2 md:col-span-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Search</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input className="input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions or answers" />
                  </div>
                </label>
                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Answer filter</span>
                  <select className="input" value={answerFilter} onChange={(event) => setAnswerFilter(event.target.value as typeof answerFilter)}>
                    <option value="all">All</option>
                    <option value="answered">Answered</option>
                    <option value="unanswered">Unanswered</option>
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Accepted filter</span>
                  <select className="input" value={acceptedFilter} onChange={(event) => setAcceptedFilter(event.target.value as typeof acceptedFilter)}>
                    <option value="all">All</option>
                    <option value="accepted">Accepted</option>
                    <option value="unaccepted">Unaccepted</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Confidence filter</span>
                <select className="input max-w-sm" value={confidenceFilter} onChange={(event) => setConfidenceFilter(event.target.value as typeof confidenceFilter)}>
                  <option value="all">All confidence</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>

              <div className="grid gap-6 xl:grid-cols-[1fr_0.78fr]">
                <div className="space-y-4">
                  {pageItems.map((item) => (
                    <article
                      key={item.id}
                      className={`rounded-3xl border p-5 ${selectedItemId === item.id ? 'border-cyan-300/40 bg-cyan-400/[0.05]' : 'border-white/10 bg-slate-950/50'}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <button className="text-left" onClick={() => setSelectedItemId(item.id)} type="button">
                          <div className="text-sm font-semibold text-white">{item.question}</div>
                        </button>
                        <div className="flex flex-wrap gap-2">
                          <span className={confidenceBadgeClass(item.confidence)}>{item.confidence}% confidence</span>
                          <label className="flex items-center gap-2 text-xs text-slate-300">
                            <input
                              checked={draftAccepted[item.id] ?? item.accepted}
                              onChange={(event) => setDraftAccepted((current) => ({ ...current, [item.id]: event.target.checked }))}
                              type="checkbox"
                            />
                            Accept Answer
                          </label>
                        </div>
                      </div>
                      <textarea
                        className="input mt-4 min-h-[160px] resize-y"
                        value={draftAnswers[item.id] ?? item.answer}
                        onChange={(event) => setDraftAnswers((current) => ({ ...current, [item.id]: event.target.value }))}
                      />
                      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
                        <span>Retrieval score {item.retrievalScore}</span>
                        <button className="button-secondary text-rose-200" onClick={() => void handleDeleteItem(item.id)}>
                          <Trash2 className="h-4 w-4" />
                          Delete question
                        </button>
                      </div>
                    </article>
                  ))}
                  {pageItems.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">
                      No response items matched the current filters.
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
                    <div className="text-sm text-slate-300">
                      Page {currentPage + 1} of {pageCount}
                    </div>
                    <div className="flex gap-2">
                      <button className="button-secondary" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </button>
                      <button className="button-secondary" disabled={currentPage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <section className="panel-subtle">
                    <div className="flex items-center gap-2 text-white">
                      <CheckCircle2 className="h-4 w-4 text-cyan-300" />
                      <span className="font-semibold">Citations</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {(selectedItem?.citations ?? []).map((citation, index) => (
                        <article key={`${selectedItem?.id ?? 'item'}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                          {citation}
                        </article>
                      ))}
                      {(selectedItem?.citations.length ?? 0) === 0 && (
                        <div className="text-sm text-slate-400">No citations available for the current response.</div>
                      )}
                    </div>
                  </section>

                  <section className="panel-subtle">
                    <div className="flex items-center gap-2 text-white">
                      <Bot className="h-4 w-4 text-cyan-300" />
                      <span className="font-semibold">Pipeline</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {detail.pipeline.map((step) => (
                        <article key={step.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-white">{step.title}</div>
                            <span className={statusBadgeClass(step.status)}>{step.status}</span>
                          </div>
                          <div className="mt-2 text-sm text-slate-300">{step.helper}</div>
                          <div className="mt-3 text-xs text-slate-500">{step.metric}</div>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-slate-400">
              Open a response-automation job to review generated answers and citations.
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
