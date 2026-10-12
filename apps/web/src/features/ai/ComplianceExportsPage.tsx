import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Eye, FileOutput, Files, RefreshCw, RotateCcw } from 'lucide-react';
import { RegActionMenu, RegModal, RegRightDrawer } from '../../components/regovise/PagePrimitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useEdgeIdentity } from '../../shared/session/identity';
import { createComplianceExportJob, getComplianceExportJob, getComplianceExportsWorkspace } from './api';
import type { ComplianceExportJob, ComplianceExportOption, ComplianceExportsWorkspace } from './types';

type SectionFilter = 'all' | 'emass' | 'fedramp' | 'oscal' | 'json' | 'word';

type Props = {
  initialFilter?: SectionFilter;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function statusClass(status: string) {
  if (status === 'Ready' || status === 'Met') {
    return 'status-pill-success';
  }
  if (status === 'Blocked' || status === 'Missing') {
    return 'status-pill-danger';
  }
  return 'status-pill-neutral';
}

function matchesFilter(title: string, filter: SectionFilter) {
  if (filter === 'all') return true;
  if (filter === 'emass') return title === 'eMASS Exports';
  if (filter === 'fedramp') return title === 'FedRAMP Exports';
  if (filter === 'oscal') return title === 'OSCAL / XML Exports';
  if (filter === 'json') return title === 'JSON Exports';
  return title === 'Word / Narrative Exports';
}

function findOptionForJob(workspace: ComplianceExportsWorkspace | null, job: ComplianceExportJob | null): ComplianceExportOption | null {
  if (!workspace || !job) return null;
  const options = workspace.sections.flatMap((section) => section.options);
  return (
    options.find((option) => job.fileName.startsWith(`${option.id}-`)) ??
    options.find((option) => option.title === job.title) ??
    null
  );
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
  const [pendingRetryJob, setPendingRetryJob] = useState<ComplianceExportJob | null>(null);
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

  async function handleRetryJob(job: ComplianceExportJob) {
    const option = findOptionForJob(workspace, job);
    if (!option) {
      setError('Unable to identify the export option for this historical job.');
      setPendingRetryJob(null);
      return;
    }

    try {
      setBusyOptionId(option.id);
      setError(null);
      setNotice(null);
      const response = await createComplianceExportJob({ optionId: option.id, sourceRecord: job.sourceRecord });
      setSelectedJob(response);
      await loadWorkspace();
      setPendingRetryJob(null);
      setNotice(
        response.job.status === 'Ready'
          ? `${response.job.title} retried and linked into the files history panel.`
          : `${response.job.title} retry is blocked until its prerequisites are satisfied.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to retry compliance export.');
    } finally {
      setBusyOptionId(null);
    }
  }

  if (loading || !workspace) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading Compliance Exports...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="eyebrow">Compliance Exports</div>
          <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Generate standardized compliance packages for external systems</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
            Generate JSON, OSCAL XML, eMASS, FedRAMP, and narrative document exports from the canonical Worker-backed data model,
            then surface the resulting files directly through the tenant’s export history.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#6f6578]">
            <span className="status-pill-neutral">Files subsystem linkage</span>
            <span className="status-pill-neutral">Readiness-aware export cards</span>
            <span className="status-pill-neutral">FedRAMP and eMASS variants</span>
          </div>
        </div>
        <div className="panel-subtle space-y-3">
          <div className="text-xs uppercase tracking-[0.22em] text-[#62576a]">Readiness Note</div>
          <div className="text-lg font-semibold text-[#241232]">FedRAMP and OSCAL exports require system categorization</div>
          <div className="text-sm text-[#4f435c]">
            Export cards are grayed out when prerequisite data is missing. Hover-friendly explanation text is mirrored inline here for the canonical stack.
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={workspace.readiness.systemCategorizationReady ? 'status-pill-success' : 'status-pill-danger'}>
              {workspace.readiness.systemCategorizationReady ? 'Categorization ready' : 'Categorization missing'}
            </span>
            <span className="status-pill-neutral">{workspace.filesPanel.totalGenerated} generated file(s)</span>
          </div>
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}
      {notice && <div className="notice-success">{notice}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="panel-subtle">
            <div className="text-xs uppercase tracking-[0.22em] text-[#62576a]">{metric.label}</div>
            <div className="mt-3 text-3xl font-semibold text-[#241232]">{metric.value}</div>
            <div className="mt-2 text-sm text-[#6f6578]">{metric.detail}</div>
          </article>
        ))}
      </section>

      <section className="panel-subtle">
        <div className="text-xs uppercase tracking-[0.22em] text-[#62576a]">Export Readiness</div>
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          {workspace.readiness.rows.map((row) => (
            <article key={row.field} className="rounded-2xl border border-[#ded8e4] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-[#241232]">{row.field}</div>
                <span className={statusClass(row.status)}>{row.status}</span>
              </div>
              <div className="mt-3 text-sm text-[#6f6578]">{row.notes}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="panel space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Export Catalog</div>
              <div className="mt-2 text-lg font-semibold text-[#241232]">Available Compliance Export Families</div>
            </div>
            <button className="button-secondary" onClick={() => void loadWorkspace()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          <Tabs value={activeFilter} onValueChange={(value) => setActiveFilter(value as SectionFilter)}>
            <TabsList className="w-full">
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
                    <div className="text-lg font-semibold text-[#241232]">{section.title}</div>
                    <span className="status-pill-neutral">{section.options.length} option(s)</span>
                  </div>
                  <div className="grid gap-4">
                    {section.options.map((option) => (
                      <article
                        key={option.id}
                        className={`rounded-3xl border p-5 ${option.ready ? 'border-[#ded8e4] bg-white' : 'border-[#f6d48e] bg-[#fff2d9]'}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="max-w-3xl">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-lg font-semibold text-[#241232]">{option.title}</div>
                              <span className="status-pill-neutral">{option.extension}</span>
                              <span className={option.ready ? 'status-pill-success' : 'status-pill-danger'}>
                                {option.ready ? 'Available' : 'Unavailable'}
                              </span>
                            </div>
                            <div className="mt-2 text-sm leading-6 text-[#4f435c]">{option.description}</div>
                            <div className="mt-4 grid gap-2 text-sm text-[#6f6578] md:grid-cols-2">
                              <div>
                                <span className="font-medium text-[#38254a]">Scope:</span> {option.scope}
                              </div>
                              <div>
                                <span className="font-medium text-[#38254a]">Prerequisite:</span> {option.prerequisite}
                              </div>
                            </div>
                            {!option.ready && (
                              <div className="mt-4 rounded-2xl border border-[#f6d48e] bg-[#fff2d9] px-4 py-3 text-sm text-[#8a4d00]">
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
            <div className="flex items-center gap-2 text-[#241232]">
              <Files className="h-4 w-4 text-[#7a3ccf]" />
              <span className="font-semibold">Files History Linkage</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl border border-[#ded8e4] bg-white p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[#62576a]">Generated</div>
                <div className="mt-2 text-3xl font-semibold text-[#241232]">{workspace.filesPanel.totalGenerated}</div>
              </div>
              <div className="rounded-2xl border border-[#ded8e4] bg-white p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[#62576a]">Blocked</div>
                <div className="mt-2 text-3xl font-semibold text-[#241232]">{workspace.filesPanel.totalBlocked}</div>
              </div>
              <div className="rounded-2xl border border-[#ded8e4] bg-white p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[#62576a]">Latest</div>
                <div className="mt-2 text-sm font-medium text-[#241232]">{workspace.filesPanel.latestGenerated ?? 'No generated exports yet'}</div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="flex items-center gap-2 text-[#241232]">
              <Download className="h-4 w-4 text-[#7a3ccf]" />
              <span className="font-semibold">Export History</span>
            </div>
            <div className="mt-4 space-y-3">
              {workspace.jobs.map((job) => (
                <article key={job.id} className="rounded-2xl border border-[#ded8e4] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-[#241232]">{job.title}</div>
                      <div className="mt-1 text-xs text-[#62576a]">
                        {job.fileName} · {formatDate(job.createdAt)}
                      </div>
                    </div>
                    <span className={statusClass(job.status)}>{job.status}</span>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <RegActionMenu
                      actions={[
                        {
                          label: 'Inspect pipeline',
                          icon: Eye,
                          onSelect: () => void handleInspectJob(job.id),
                        },
                        {
                          label: 'Retry export',
                          icon: RotateCcw,
                          onSelect: () => setPendingRetryJob(job),
                        },
                        {
                          label: 'Download file',
                          icon: Download,
                          disabled: job.status !== 'Ready',
                          onSelect: () => window.open(job.downloadPath, '_blank', 'noopener,noreferrer'),
                        },
                        {
                          label: 'View in files',
                          icon: Files,
                          disabled: !job.filesPath,
                          onSelect: () => {
                            if (job.filesPath) {
                              window.open(job.filesPath, '_blank', 'noopener,noreferrer');
                            }
                          },
                        },
                      ]}
                      label={`Open actions for ${job.title}`}
                    />
                  </div>
                </article>
              ))}
              {workspace.jobs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#ded8e4] px-4 py-8 text-center text-sm text-[#6f6578]">
                  No compliance export jobs have been generated yet.
                </div>
              )}
            </div>
          </section>
        </section>
      </section>

      <RegRightDrawer
        description={
          selectedJob
            ? `${selectedJob.job.fileName} · ${selectedJob.job.status} · ${formatDate(selectedJob.job.createdAt)}`
            : undefined
        }
        footer={
          selectedJob ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button className="button-secondary" onClick={() => setSelectedJob(null)} type="button">
                Close
              </button>
              {selectedJob.job.filesPath ? (
                <a className="button-secondary" href={selectedJob.job.filesPath} rel="noreferrer" target="_blank">
                  <Files className="h-4 w-4" />
                  View in files
                </a>
              ) : null}
              {selectedJob.job.status === 'Ready' ? (
                <a className="button-secondary" href={selectedJob.job.downloadPath} rel="noreferrer" target="_blank">
                  <Download className="h-4 w-4" />
                  Download
                </a>
              ) : null}
            </div>
          ) : null
        }
        onOpenChange={(open) => {
          if (!open) setSelectedJob(null);
        }}
        open={selectedJob !== null}
        title={selectedJob?.job.title ?? 'Pipeline detail'}
      >
        {selectedJob ? (
          <div className="space-y-6">
            <section>
              <div className="flex items-center gap-2 text-[#241232]">
                <FileOutput className="h-4 w-4 text-[#7a3ccf]" />
                <span className="font-semibold">Readiness inputs</span>
              </div>
              <div className="mt-3 space-y-3">
                {selectedJob.job.readiness.map((row) => (
                  <div key={row.field} className="rounded-lg border border-[#ded8e4] bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-[#241232]">{row.field}</div>
                      <span className={statusClass(row.status)}>{row.status}</span>
                    </div>
                    <div className="mt-2 text-sm text-[#6f6578]">{row.notes}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="font-semibold text-[#241232]">Pipeline execution</div>
              <div className="mt-3 space-y-3">
                {selectedJob.pipeline.map((step) => (
                  <div key={step.id} className="rounded-lg border border-[#ded8e4] bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-[#241232]">{step.title}</div>
                      <span className={statusClass(step.status)}>{step.status}</span>
                    </div>
                    <div className="mt-2 text-sm text-[#4f435c]">{step.helper}</div>
                    <div className="mt-3 text-xs text-[#62576a]">{step.metric}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </RegRightDrawer>

      <section className="panel-subtle grid gap-4 md:grid-cols-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#126b36]" />
          <div>
            <div className="font-medium text-[#241232]">Direct file linkage</div>
            <div className="mt-2 text-sm text-[#6f6578]">
              Generated jobs register a files-history manifest so operators can find them from the same tenant-backed export layer.
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-[#8a4d00]" />
          <div>
            <div className="font-medium text-[#241232]">Availability awareness</div>
            <div className="mt-2 text-sm text-[#6f6578]">
              Disabled exports stay visible with prerequisite explanations instead of disappearing from the workspace.
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Files className="mt-0.5 h-5 w-5 text-[#7a3ccf]" />
          <div>
            <div className="font-medium text-[#241232]">History and interoperability</div>
            <div className="mt-2 text-sm text-[#6f6578]">
              JSON, XML, Excel-style, and narrative exports all remain discoverable through a single canonical export history panel.
            </div>
          </div>
        </div>
      </section>

      <RegModal
        description="Create a fresh export job from the same export family and source record. The original job stays in history for auditability."
        footer={
          pendingRetryJob ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button className="button-secondary" onClick={() => setPendingRetryJob(null)} type="button">
                Cancel
              </button>
              <button
                className="button-primary"
                disabled={busyOptionId === findOptionForJob(workspace, pendingRetryJob)?.id}
                onClick={() => void handleRetryJob(pendingRetryJob)}
                type="button"
              >
                {busyOptionId === findOptionForJob(workspace, pendingRetryJob)?.id ? 'Retrying...' : 'Retry export'}
              </button>
            </div>
          ) : null
        }
        onOpenChange={(open) => {
          if (!open) setPendingRetryJob(null);
        }}
        open={pendingRetryJob !== null}
        title="Retry compliance export"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-[#ded8e4] bg-[#f8f6fa] p-4">
            <div className="font-semibold text-[#241232]">{pendingRetryJob?.title}</div>
            <div className="mt-2 text-sm text-[#51465e]">
              Source record: {pendingRetryJob?.sourceRecord ?? 'primary-security-plan'}
            </div>
          </div>
          <div className="rounded-lg border border-[#ded8e4] bg-white p-4 text-sm text-[#51465e]">
            Retry uses the current readiness checks and can create a ready file or another blocked job if prerequisites are
            still missing.
          </div>
        </div>
      </RegModal>
    </div>
  );
}
