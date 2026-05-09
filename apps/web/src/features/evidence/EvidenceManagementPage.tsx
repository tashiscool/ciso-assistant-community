import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Database, PlayCircle, Plus, Search, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';

type EvidenceSource = {
  id: string;
  tenantId: string;
  name: string;
  provider: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type EvidenceJob = {
  id: string;
  tenantId: string;
  sourceId: string;
  sourceName: string;
  scheduledFor: string;
  startedAt: string | null;
  finishedAt: string | null;
  status: string;
  statusDetail: string | null;
  artifactCount: number;
};

type EvidenceArtifact = {
  id: string;
  tenantId: string;
  jobId: string;
  objectKey: string;
  contentType: string | null;
  sizeBytes: number | null;
  checksum: string | null;
  createdAt: string;
};

const client = new ApiClient();

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatBytes(value: number | null) {
  if (!value) {
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

export function EvidenceManagementPage() {
  const { identity } = useEdgeIdentity();
  const [sources, setSources] = useState<EvidenceSource[]>([]);
  const [jobs, setJobs] = useState<EvidenceJob[]>([]);
  const [artifacts, setArtifacts] = useState<EvidenceArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('github');

  async function loadWorkspace() {
    try {
      setLoading(true);
      setError(null);
      const [sourcesResponse, jobsResponse, artifactsResponse] = await Promise.all([
        client.get<{ data: EvidenceSource[] }>('/evidence/sources'),
        client.get<{ data: EvidenceJob[] }>('/evidence/jobs'),
        client.get<{ data: EvidenceArtifact[] }>('/evidence/artifacts'),
      ]);
      setSources(sourcesResponse.data);
      setJobs(jobsResponse.data);
      setArtifacts(artifactsResponse.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the evidence workspace.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [identity.tenantId, identity.userId]);

  const filteredSources = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return sources;
    }
    return sources.filter((source) =>
      [source.name, source.provider].join(' ').toLowerCase().includes(query),
    );
  }, [search, sources]);

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return jobs;
    }
    return jobs.filter((job) =>
      [job.sourceName, job.status, job.statusDetail ?? ''].join(' ').toLowerCase().includes(query),
    );
  }, [jobs, search]);

  const filteredArtifacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return artifacts;
    }
    return artifacts.filter((artifact) =>
      [artifact.objectKey, artifact.contentType ?? '', artifact.checksum ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [artifacts, search]);

  const metrics = useMemo(
    () => [
      {
        label: 'Sources',
        value: sources.length,
        detail: 'Configured evidence collection sources in the canonical service.',
      },
      {
        label: 'Queued / Running',
        value: jobs.filter((job) => job.status === 'pending' || job.status === 'running').length,
        detail: 'Collection jobs currently working through the queue-backed ingestion path.',
      },
      {
        label: 'Artifacts',
        value: artifacts.length,
        detail: 'Evidence artifacts stored from completed collection jobs.',
      },
      {
        label: 'Successful Jobs',
        value: jobs.filter((job) => job.status === 'success').length,
        detail: 'Completed runs that produced evidence-ready output.',
      },
    ],
    [artifacts.length, jobs, sources.length],
  );

  async function createSource() {
    try {
      setBusyAction('create');
      setError(null);
      setNotice(null);
      await client.post('/evidence/sources', {
        name,
        provider,
        config: {
          createdFrom: 'evidence-management-workspace',
        },
      });
      setName('');
      setProvider('github');
      await loadWorkspace();
      setNotice('Evidence source created in the canonical evidence service.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create evidence source.');
    } finally {
      setBusyAction(null);
    }
  }

  async function collectEvidence(sourceId: string) {
    try {
      setBusyAction(`collect:${sourceId}`);
      setError(null);
      setNotice(null);
      const response = await client.post<{ data: { jobId: string } }>(`/evidence/sources/${sourceId}/collect`);
      await loadWorkspace();
      setNotice(`Queued evidence collection job ${response.data.jobId}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to queue evidence collection.');
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteSource(sourceId: string) {
    try {
      setBusyAction(`delete:${sourceId}`);
      setError(null);
      setNotice(null);
      await client.delete(`/evidence/sources/${sourceId}`);
      await loadWorkspace();
      setNotice('Evidence source deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete evidence source.');
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading Evidence Management...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Evidence</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">Evidence Management</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Manage collection sources, review queue-driven jobs, and inspect stored evidence artifacts from one canonical Cloudflare-backed workspace.
            </p>
          </div>
          <div className="w-full max-w-xl">
            <form
              className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-[1fr_180px_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                void createSource();
              }}
            >
              <input
                className="input"
                placeholder="GitHub Org Inventory"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <select className="input" value={provider} onChange={(event) => setProvider(event.target.value)}>
                <option value="github">GitHub</option>
                <option value="snyk">Snyk</option>
                <option value="wiz">Wiz</option>
                <option value="custom_http">Custom HTTP</option>
              </select>
              <button className="button-primary" disabled={busyAction === 'create'} type="submit">
                <Plus className="mr-2 h-4 w-4" />
                {busyAction === 'create' ? 'Creating...' : 'Add Source'}
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Link className="panel-subtle transition hover:border-cyan-300/30" to="/assurance/evidence">
          <div className="eyebrow">Assurance</div>
          <div className="mt-2 text-lg font-semibold text-white">Open Evidence Explorer</div>
          <div className="mt-2 text-sm leading-6 text-slate-400">
            Move from raw collection jobs into normalized bundle previews, deterministic checks, and package-ready evidence detail.
          </div>
        </Link>
        <Link className="panel-subtle transition hover:border-cyan-300/30" to="/assurance/tracker">
          <div className="eyebrow">Assurance</div>
          <div className="mt-2 text-lg font-semibold text-white">Open Tracker Workbench</div>
          <div className="mt-2 text-sm leading-6 text-slate-400">
            Import tracker rows, inspect diagnostics, and convert evidence-gap scenarios into assurance-backed 20x packages.
          </div>
        </Link>
        <Link className="panel-subtle transition hover:border-cyan-300/30" to="/assurance/packages">
          <div className="eyebrow">Assurance</div>
          <div className="mt-2 text-lg font-semibold text-white">Open 20x Package Explorer</div>
          <div className="mt-2 text-sm leading-6 text-slate-400">
            Review generated packages, reconciliation checks, and report bundles after collection and evaluation complete.
          </div>
        </Link>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div className="metric-card" key={metric.label}>
            <div className="metric-label">{metric.label}</div>
            <div className="metric-value">{metric.value}</div>
            <div className="mt-2 text-xs text-slate-500">{metric.detail}</div>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
          <input
            className="input pl-10"
            placeholder="Search sources, jobs, and artifacts"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </section>

      <Tabs className="space-y-6" defaultValue="sources">
        <TabsList className="w-fit">
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
        </TabsList>

        <TabsContent value="sources">
          <section className="panel overflow-hidden p-0">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSources.map((source) => (
                  <tr key={source.id} className="border-t border-white/5 align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{source.name}</div>
                      <div className="mt-1 text-xs text-slate-500">Updated {formatDate(source.updatedAt)}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-300">{source.provider}</td>
                    <td className="px-4 py-4">
                      <span className={source.isActive ? 'badge-success' : 'badge-neutral'}>
                        {source.isActive ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="button-secondary"
                          disabled={busyAction === `collect:${source.id}`}
                          onClick={() => void collectEvidence(source.id)}
                          type="button"
                        >
                          <PlayCircle className="mr-2 h-4 w-4" />
                          Collect
                        </button>
                        <button
                          className="button-secondary"
                          disabled={busyAction === `delete:${source.id}`}
                          onClick={() => void deleteSource(source.id)}
                          type="button"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredSources.length && (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-400" colSpan={4}>
                      No evidence sources matched the current search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </TabsContent>

        <TabsContent value="jobs">
          <section className="panel overflow-hidden p-0">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Artifacts</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="border-t border-white/5 align-top">
                    <td className="px-4 py-4">
                      <div className="font-mono text-xs text-cyan-200">{job.id}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        Scheduled {formatDate(job.scheduledFor)}
                        {job.finishedAt ? ` · Finished ${formatDate(job.finishedAt)}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-white">{job.sourceName}</td>
                    <td className="px-4 py-4">
                      <span
                        className={
                          job.status === 'success'
                            ? 'badge-success'
                            : job.status === 'failed'
                              ? 'badge-danger'
                              : 'badge-neutral'
                        }
                      >
                        {job.status}
                      </span>
                      {job.statusDetail && (
                        <div className="mt-2 max-w-md text-xs leading-5 text-slate-400">{job.statusDetail}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-300">{job.artifactCount}</td>
                  </tr>
                ))}
                {!filteredJobs.length && (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-400" colSpan={4}>
                      No evidence jobs matched the current search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </TabsContent>

        <TabsContent value="artifacts">
          <section className="panel overflow-hidden p-0">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Artifact</th>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Content Type</th>
                  <th className="px-4 py-3">Size</th>
                </tr>
              </thead>
              <tbody>
                {filteredArtifacts.map((artifact) => (
                  <tr key={artifact.id} className="border-t border-white/5 align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{artifact.objectKey}</div>
                      <div className="mt-1 text-xs text-slate-500">Created {formatDate(artifact.createdAt)}</div>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-cyan-200">{artifact.jobId}</td>
                    <td className="px-4 py-4 text-slate-300">{artifact.contentType ?? 'unknown'}</td>
                    <td className="px-4 py-4 text-slate-300">{formatBytes(artifact.sizeBytes)}</td>
                  </tr>
                ))}
                {!filteredArtifacts.length && (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-400" colSpan={4}>
                      No evidence artifacts matched the current search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
