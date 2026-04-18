import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileOutput, Files, RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useEdgeIdentity } from '../../shared/session/identity';
import { createComplianceExportJob, getComplianceExportJob, getComplianceExportsWorkspace } from './api';
import type { ComplianceExportJob, ComplianceExportsWorkspace } from './types';

type SectionFilter = 'all' | 'emass' | 'fedramp' | 'oscal' | 'json' | 'word';

type Props = {
  initialFilter?: SectionFilter;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function statusClass(status: string) {
  if (status === 'Ready' || status === 'Met') {
    return 'badge-success';
  }
  if (status === 'Blocked' || status === 'Missing') {
    return 'badge-danger';
  }
  return 'badge-neutral';
}

function matchesFilter(title: string, filter: SectionFilter) {
  if (filter === 'all') return true;
  if (filter === 'emass') return title === 'eMASS Exports';
  if (filter === 'fedramp') return title === 'FedRAMP Exports';
  if (filter === 'oscal') return title === 'OSCAL / XML Exports';
  if (filter === 'json') return title === 'JSON Exports';
  return title === 'Word / Narrative Exports';
}

export function ComplianceExportsPage({ initialFilter = 'all' }: Props) {
  const { identity } = useEdgeIdentity();
  const [workspace, setWorkspace] = useState<ComplianceExportsWorkspace | null>(null);
  const [selectedJob, setSelectedJob] = useState<{
    job: ComplianceExportJob;
    pipeline: Array<{
      id: string;
      title: string;
      owner: string;
      writeTarget: string;
      helper: string;
      metric: string;
      status: 'Complete' | 'Running' | 'Queued' | 'Attention';
    }>;
  } | null>(null);
  const [activeFilter, setActiveFilter] = useState<SectionFilter>(initialFilter);
  const [busyOptionId, setBusyOptionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadWorkspace() {
    try {
      setLoading(true);
      setError(null);
      const next = await getComplianceExportsWorkspace();
      setWorkspace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Compliance Exports.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [identity.tenantId, identity.userId]);

  useEffect(() => {
    setActiveFilter(initialFilter);
  }, [initialFilter]);

  const filteredSections = useMemo(() => {
    return (workspace?.sections ?? []).filter((section) => matchesFilter(section.title, activeFilter));
  }, [activeFilter, workspace?.sections]);

  const metrics = useMemo(() => {
    return [
      {
        label: 'Assessment-backed exports',
        value: workspace?.readiness.assessmentsCount ?? 0,
        detail: 'Compliance reviews currently able to feed SSP, SAP, and SAR style exports.',
      },
      {
        label: 'Findings-ready exports',
        value: workspace?.readiness.findingsCount ?? 0,
        detail: 'Findings or POA&M style items feeding exception and remediation packages.',
      },
      {
        label: 'Evidence signals',
        value: workspace?.readiness.evidenceCount ?? 0,
        detail: 'Evidence artifacts that can support inventory and monitoring exports.',
      },
      {
        label: 'Generated files',
        value: workspace?.filesPanel.totalGenerated ?? 0,
        detail: 'Previously generated compliance files linked into the files history layer.',
      },
    ];
  }, [workspace]);

  async function handleRunExport(optionId: string) {
    try {
      setBusyOptionId(optionId);
      setError(null);
      setNotice(null);
      const response = await createComplianceExportJob({ optionId });
      setSelectedJob(response);
      await loadWorkspace();
      setNotice(
        response.job.status === 'Ready'
          ? `${response.job.title} generated and linked into the files history panel.`
          : `${response.job.title} is blocked until its prerequisites are satisfied.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run compliance export.');
    } finally {
      setBusyOptionId(null);
    }
  }

  async function handleInspectJob(jobId: string) {
    try {
      setError(null);
      const response = await getComplianceExportJob(jobId);
      setSelectedJob(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load export detail.');
    }
  }

  if (loading || !workspace) {
    return <div className="panel p-6 text-sm text-slate-300">Loading Compliance Exports...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="eyebrow">Compliance Exports</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Generate standardized compliance packages for external systems</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Generate JSON, OSCAL XML, eMASS, FedRAMP, and narrative document exports from the canonical Worker-backed data model,
            then surface the resulting files directly through the tenant’s export history.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="badge-neutral">Files subsystem linkage</span>
            <span className="badge-neutral">Readiness-aware export cards</span>
            <span className="badge-neutral">FedRAMP and eMASS variants</span>
          </div>
        </div>
        <div className="panel-subtle space-y-3">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Readiness Note</div>
          <div className="text-lg font-semibold text-white">FedRAMP and OSCAL exports require system categorization</div>
          <div className="text-sm text-slate-300">
            Export cards are grayed out when prerequisite data is missing. Hover-friendly explanation text is mirrored inline here for the canonical stack.
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={workspace.readiness.systemCategorizationReady ? 'badge-success' : 'badge-danger'}>
              {workspace.readiness.systemCategorizationReady ? 'Categorization ready' : 'Categorization missing'}
            </span>
            <span className="badge-neutral">{workspace.filesPanel.totalGenerated} generated file(s)</span>
          </div>
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

      <section className="panel-subtle">
        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Export Readiness</div>
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          {workspace.readiness.rows.map((row) => (
            <article key={row.field} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-white">{row.field}</div>
                <span className={statusClass(row.status)}>{row.status}</span>
              </div>
              <div className="mt-3 text-sm text-slate-400">{row.notes}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="panel space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Export Catalog</div>
              <div className="mt-2 text-lg font-semibold text-white">Available Compliance Export Families</div>
            </div>
            <button className="button-secondary" onClick={() => void loadWorkspace()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          <Tabs value={activeFilter} onValueChange={(value) => setActiveFilter(value as SectionFilter)}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="emass">eMASS</TabsTrigger>
              <TabsTrigger value="fedramp">FedRAMP</TabsTrigger>
              <TabsTrigger value="oscal">OSCAL</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="word">Word</TabsTrigger>
            </TabsList>

            <TabsContent value={activeFilter} className="mt-6 space-y-6">
              {filteredSections.map((section) => (
                <section key={section.id} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-lg font-semibold text-white">{section.title}</div>
                    <span className="badge-neutral">{section.options.length} option(s)</span>
                  </div>
                  <div className="grid gap-4">
                    {section.options.map((option) => (
                      <article
                        key={option.id}
                        className={`rounded-3xl border p-5 ${option.ready ? 'border-white/10 bg-slate-950/50' : 'border-amber-300/20 bg-amber-400/[0.04]'}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="max-w-3xl">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-lg font-semibold text-white">{option.title}</div>
                              <span className="badge-neutral">{option.extension}</span>
                              <span className={option.ready ? 'badge-success' : 'badge-danger'}>
                                {option.ready ? 'Available' : 'Unavailable'}
                              </span>
                            </div>
                            <div className="mt-2 text-sm leading-6 text-slate-300">{option.description}</div>
                            <div className="mt-4 grid gap-2 text-sm text-slate-400 md:grid-cols-2">
                              <div>
                                <span className="font-medium text-slate-200">Scope:</span> {option.scope}
                              </div>
                              <div>
                                <span className="font-medium text-slate-200">Prerequisite:</span> {option.prerequisite}
                              </div>
                            </div>
                            {!option.ready && (
                              <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-100">
                                {option.blockedReason}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              className={`button-primary ${!option.ready ? 'cursor-not-allowed opacity-60' : ''}`}
                              disabled={!option.ready || busyOptionId !== null}
                              onClick={() => void handleRunExport(option.id)}
                            >
                              <FileOutput className="h-4 w-4" />
                              {busyOptionId === option.id ? 'Running…' : 'Run export'}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </TabsContent>
          </Tabs>
        </section>

        <section className="space-y-6">
          <section className="panel">
            <div className="flex items-center gap-2 text-white">
              <Files className="h-4 w-4 text-cyan-300" />
              <span className="font-semibold">Files History Linkage</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Generated</div>
                <div className="mt-2 text-3xl font-semibold text-white">{workspace.filesPanel.totalGenerated}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Blocked</div>
                <div className="mt-2 text-3xl font-semibold text-white">{workspace.filesPanel.totalBlocked}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Latest</div>
                <div className="mt-2 text-sm font-medium text-white">{workspace.filesPanel.latestGenerated ?? 'No generated exports yet'}</div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="flex items-center gap-2 text-white">
              <Download className="h-4 w-4 text-cyan-300" />
              <span className="font-semibold">Export History</span>
            </div>
            <div className="mt-4 space-y-3">
              {workspace.jobs.map((job) => (
                <article key={job.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{job.title}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {job.fileName} · {formatDate(job.createdAt)}
                      </div>
                    </div>
                    <span className={statusClass(job.status)}>{job.status}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="button-secondary" onClick={() => void handleInspectJob(job.id)}>
                      Inspect pipeline
                    </button>
                    {job.status === 'Ready' && (
                      <a className="button-secondary" href={job.downloadPath} rel="noreferrer" target="_blank">
                        Download
                      </a>
                    )}
                    {job.filesPath && (
                      <a className="button-secondary" href={job.filesPath} rel="noreferrer" target="_blank">
                        View in files
                      </a>
                    )}
                  </div>
                </article>
              ))}
              {workspace.jobs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">
                  No compliance export jobs have been generated yet.
                </div>
              )}
            </div>
          </section>
        </section>
      </section>

      {selectedJob && (
        <section className="panel">
          <div className="flex items-center gap-2 text-white">
            <FileOutput className="h-4 w-4 text-cyan-300" />
            <span className="font-semibold">Pipeline Detail</span>
          </div>
          <div className="mt-2 text-sm text-slate-400">
            {selectedJob.job.title} · {selectedJob.job.fileName} · {selectedJob.job.status}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-3">
              {selectedJob.job.readiness.map((row) => (
                <div key={row.field} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{row.field}</div>
                    <span className={statusClass(row.status)}>{row.status}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">{row.notes}</div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {selectedJob.pipeline.map((step) => (
                <div key={step.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{step.title}</div>
                    <span className={statusClass(step.status)}>{step.status}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-300">{step.helper}</div>
                  <div className="mt-3 text-xs text-slate-500">{step.metric}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="panel-subtle grid gap-4 md:grid-cols-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
          <div>
            <div className="font-medium text-white">Direct file linkage</div>
            <div className="mt-2 text-sm text-slate-400">
              Generated jobs register a files-history manifest so operators can find them from the same tenant-backed export layer.
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
          <div>
            <div className="font-medium text-white">Availability awareness</div>
            <div className="mt-2 text-sm text-slate-400">
              Disabled exports stay visible with prerequisite explanations instead of disappearing from the workspace.
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Files className="mt-0.5 h-5 w-5 text-cyan-300" />
          <div>
            <div className="font-medium text-white">History and interoperability</div>
            <div className="mt-2 text-sm text-slate-400">
              JSON, XML, Excel-style, and narrative exports all remain discoverable through a single canonical export history panel.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
