import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Database, PlayCircle, Plus, Search, Trash2 } from 'lucide-react';
import { RegModal, RegRightDrawer, RegStatusPill } from '../../components/regovise/PagePrimitives';
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
  const [awsRegion, setAwsRegion] = useState('us-gov-west-1');
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [awsSessionToken, setAwsSessionToken] = useState('');
  const [awsAllEnabledRegions, setAwsAllEnabledRegions] = useState(false);
  const [sourceDrawerOpen, setSourceDrawerOpen] = useState(false);
  const [sourceToCollect, setSourceToCollect] = useState<EvidenceSource | null>(null);
  const [sourceToDelete, setSourceToDelete] = useState<EvidenceSource | null>(null);

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

  const canCreateSource =
    name.trim().length > 0 &&
    (provider !== 'aws' ||
      (awsRegion.trim().length > 0 &&
        awsAccessKeyId.trim().length > 0 &&
        awsSecretAccessKey.trim().length > 0));

  async function createSource() {
    try {
      setBusyAction('create');
      setError(null);
      setNotice(null);
      const config =
        provider === 'aws'
          ? {
              owner: 'Cloud Security',
              allowSyntheticSeed: false,
              region: awsRegion.trim() || 'us-gov-west-1',
              regions: awsAllEnabledRegions ? [] : [awsRegion.trim() || 'us-gov-west-1'],
              allEnabledRegions: awsAllEnabledRegions,
              auth: {
                accessKeyId: awsAccessKeyId.trim(),
                secretAccessKey: awsSecretAccessKey,
                sessionToken: awsSessionToken.trim() || undefined,
              },
            }
          : {
              createdFrom: 'evidence-management-workspace',
            };
      await client.post('/evidence/sources', {
        name,
        provider,
        config,
      });
      setName('');
      setProvider('github');
      setAwsRegion('us-gov-west-1');
      setAwsAccessKeyId('');
      setAwsSecretAccessKey('');
      setAwsSessionToken('');
      setAwsAllEnabledRegions(false);
      await loadWorkspace();
      setNotice('Evidence source created in the canonical evidence service.');
      setSourceDrawerOpen(false);
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
      setSourceToCollect(null);
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
      setSourceToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete evidence source.');
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading Evidence Management...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Evidence</div>
            <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Evidence Management</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4f435c]">
              Manage collection sources, review queue-driven jobs, and inspect stored evidence artifacts from one canonical Cloudflare-backed workspace.
            </p>
          </div>
          <div>
            <button className="button-primary" onClick={() => setSourceDrawerOpen(true)} type="button">
              <Plus className="mr-2 h-4 w-4" />
              Add source
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Link className="panel-subtle transition hover:border-[#d7c3f1]" to="/assurance/evidence">
          <div className="eyebrow">Assurance</div>
          <div className="mt-2 text-lg font-semibold text-[#241232]">Open Evidence Explorer</div>
          <div className="mt-2 text-sm leading-6 text-[#6f6578]">
            Move from raw collection jobs into normalized bundle previews, deterministic checks, and package-ready evidence detail.
          </div>
        </Link>
        <Link className="panel-subtle transition hover:border-[#d7c3f1]" to="/assurance/tracker">
          <div className="eyebrow">Assurance</div>
          <div className="mt-2 text-lg font-semibold text-[#241232]">Open Tracker Workbench</div>
          <div className="mt-2 text-sm leading-6 text-[#6f6578]">
            Import tracker rows, inspect diagnostics, and convert evidence-gap scenarios into assurance-backed 20x packages.
          </div>
        </Link>
        <Link className="panel-subtle transition hover:border-[#d7c3f1]" to="/assurance/packages">
          <div className="eyebrow">Assurance</div>
          <div className="mt-2 text-lg font-semibold text-[#241232]">Open 20x Package Explorer</div>
          <div className="mt-2 text-sm leading-6 text-[#6f6578]">
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
            <div className="mt-2 text-xs text-[#62576a]">{metric.detail}</div>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#62576a]" />
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
            <div className="max-w-full overflow-x-auto">
            <table className="min-w-[860px] text-left text-sm">
              <thead className="border-b border-[#ded8e4] bg-white text-xs uppercase tracking-[0.18em] text-[#62576a]">
                <tr>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSources.map((source) => (
                  <tr key={source.id} className="border-t border-[#eeeaf2] align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium text-[#241232]">{source.name}</div>
                      <div className="mt-1 text-xs text-[#62576a]">Updated {formatDate(source.updatedAt)}</div>
                    </td>
                    <td className="px-4 py-4 text-[#4f435c]">{source.provider}</td>
                    <td className="px-4 py-4">
                      <RegStatusPill tone={source.isActive ? 'success' : 'neutral'}>
                        {source.isActive ? 'active' : 'inactive'}
                      </RegStatusPill>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="button-secondary"
                          disabled={busyAction === `collect:${source.id}`}
                          onClick={() => setSourceToCollect(source)}
                          type="button"
                        >
                          <PlayCircle className="mr-2 h-4 w-4" />
                          Collect
                        </button>
                        <button
                          className="button-secondary"
                          disabled={busyAction === `delete:${source.id}`}
                          onClick={() => setSourceToDelete(source)}
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
                    <td className="px-4 py-8 text-center text-[#6f6578]" colSpan={4}>
                      No evidence sources matched the current search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="jobs">
          <section className="panel overflow-hidden p-0">
            <div className="max-w-full overflow-x-auto">
            <table className="min-w-[820px] text-left text-sm">
              <thead className="border-b border-[#ded8e4] bg-white text-xs uppercase tracking-[0.18em] text-[#62576a]">
                <tr>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Artifacts</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="border-t border-[#eeeaf2] align-top">
                    <td className="px-4 py-4">
                      <div className="font-mono text-xs text-[#6d28d9]">{job.id}</div>
                      <div className="mt-2 text-xs text-[#62576a]">
                        Scheduled {formatDate(job.scheduledFor)}
                        {job.finishedAt ? ` · Finished ${formatDate(job.finishedAt)}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-[#241232]">{job.sourceName}</td>
                    <td className="px-4 py-4">
                      <RegStatusPill tone={job.status === 'success' ? 'success' : job.status === 'failed' ? 'danger' : 'neutral'}>
                        {job.status}
                      </RegStatusPill>
                      {job.statusDetail && (
                        <div className="mt-2 max-w-md text-xs leading-5 text-[#6f6578]">{job.statusDetail}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-[#4f435c]">{job.artifactCount}</td>
                  </tr>
                ))}
                {!filteredJobs.length && (
                  <tr>
                    <td className="px-4 py-8 text-center text-[#6f6578]" colSpan={4}>
                      No evidence jobs matched the current search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="artifacts">
          <section className="panel overflow-hidden p-0">
            <div className="max-w-full overflow-x-auto">
            <table className="min-w-[820px] text-left text-sm">
              <thead className="border-b border-[#ded8e4] bg-white text-xs uppercase tracking-[0.18em] text-[#62576a]">
                <tr>
                  <th className="px-4 py-3">Artifact</th>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Content Type</th>
                  <th className="px-4 py-3">Size</th>
                </tr>
              </thead>
              <tbody>
                {filteredArtifacts.map((artifact) => (
                  <tr key={artifact.id} className="border-t border-[#eeeaf2] align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium text-[#241232]">{artifact.objectKey}</div>
                      <div className="mt-1 text-xs text-[#62576a]">Created {formatDate(artifact.createdAt)}</div>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-[#6d28d9]">{artifact.jobId}</td>
                    <td className="px-4 py-4 text-[#4f435c]">{artifact.contentType ?? 'unknown'}</td>
                    <td className="px-4 py-4 text-[#4f435c]">{formatBytes(artifact.sizeBytes)}</td>
                  </tr>
                ))}
                {!filteredArtifacts.length && (
                  <tr>
                    <td className="px-4 py-8 text-center text-[#6f6578]" colSpan={4}>
                      No evidence artifacts matched the current search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </section>
        </TabsContent>
      </Tabs>

      <RegRightDrawer
        description="Create a collection source for live evidence jobs and configure provider-specific credentials."
        footer={
          <>
            <button className="button-secondary" onClick={() => setSourceDrawerOpen(false)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={busyAction === 'create' || !canCreateSource}
              form="evidence-management-source-form"
              type="submit"
            >
              {busyAction === 'create' ? 'Creating...' : 'Create source'}
            </button>
          </>
        }
        onOpenChange={setSourceDrawerOpen}
        open={sourceDrawerOpen}
        title="Add evidence source"
      >
        <form
          className="space-y-4"
          id="evidence-management-source-form"
          onSubmit={(event) => {
            event.preventDefault();
            void createSource();
          }}
        >
          <label className="block text-sm font-semibold text-[#241232]">
            Source name
            <input
              className="input mt-2 w-full"
              placeholder="GitHub Org Inventory"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold text-[#241232]">
            Provider
            <select className="input mt-2 w-full" value={provider} onChange={(event) => setProvider(event.target.value)}>
              <option value="aws">AWS</option>
              <option value="github">GitHub</option>
              <option value="snyk">Snyk</option>
              <option value="wiz">Wiz</option>
              <option value="custom_http">Custom HTTP</option>
            </select>
          </label>
          {provider === 'aws' && (
            <div className="space-y-4 rounded-2xl border border-[#9fdfb7] bg-[#ecfbf1] p-4">
              <label className="block text-sm font-semibold text-[#241232]">
                AWS region
                <input
                  className="input mt-2 w-full"
                  placeholder="us-gov-west-1"
                  value={awsRegion}
                  onChange={(event) => setAwsRegion(event.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-[#ded8e4] bg-white px-3 py-2 text-sm text-[#4f435c]">
                <input
                  checked={awsAllEnabledRegions}
                  onChange={(event) => setAwsAllEnabledRegions(event.target.checked)}
                  type="checkbox"
                />
                Collect all enabled regions
              </label>
              <label className="block text-sm font-semibold text-[#241232]">
                AWS access key id
                <input
                  className="input mt-2 w-full"
                  placeholder="AWS access key id"
                  value={awsAccessKeyId}
                  onChange={(event) => setAwsAccessKeyId(event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-[#241232]">
                AWS session token
                <input
                  className="input mt-2 w-full"
                  placeholder="AWS session token (optional)"
                  value={awsSessionToken}
                  onChange={(event) => setAwsSessionToken(event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-[#241232]">
                AWS secret access key
                <input
                  className="input mt-2 w-full"
                  placeholder="AWS secret access key"
                  type="password"
                  value={awsSecretAccessKey}
                  onChange={(event) => setAwsSecretAccessKey(event.target.value)}
                />
              </label>
              <p className="text-xs leading-5 text-[#4f435c]">
                Use a read-only AWS credential scoped for evidence collection. Regovise will call AWS APIs directly during live evidence jobs instead of relying on synthetic seed data.
              </p>
            </div>
          )}
        </form>
      </RegRightDrawer>

      <RegModal
        description="This will enqueue a fresh evidence collection job using the selected source configuration."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setSourceToCollect(null)} type="button">
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={!sourceToCollect || busyAction === `collect:${sourceToCollect?.id}`}
              onClick={() => sourceToCollect && void collectEvidence(sourceToCollect.id)}
              type="button"
            >
              {busyAction === `collect:${sourceToCollect?.id}` ? 'Queueing...' : 'Queue collection'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setSourceToCollect(null);
        }}
        open={Boolean(sourceToCollect)}
        title="Queue evidence collection"
      >
        {sourceToCollect ? (
          <div className="space-y-4 text-sm text-[#4f435c]">
            <div className="rounded-lg border border-[#ded8e4] bg-[#fbf9fc] p-4">
              <div className="font-semibold text-[#241232]">{sourceToCollect.name}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <RegStatusPill tone="purple">{sourceToCollect.provider}</RegStatusPill>
                <RegStatusPill tone={sourceToCollect.isActive ? 'success' : 'neutral'}>
                  {sourceToCollect.isActive ? 'active' : 'inactive'}
                </RegStatusPill>
                <RegStatusPill tone="neutral">Updated {formatDate(sourceToCollect.updatedAt)}</RegStatusPill>
              </div>
            </div>
            <p>
              Regovise will run the existing evidence collection endpoint for this source and refresh the
              job and artifact tables when the queue accepts the request.
            </p>
          </div>
        ) : null}
      </RegModal>

      <RegModal
        description="Review the source before deleting it. Existing jobs and artifacts remain visible through their own tables."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="button-secondary" onClick={() => setSourceToDelete(null)} type="button">
              Cancel
            </button>
            <button
              className="button-danger"
              disabled={!sourceToDelete || busyAction === `delete:${sourceToDelete?.id}`}
              onClick={() => sourceToDelete && void deleteSource(sourceToDelete.id)}
              type="button"
            >
              {busyAction === `delete:${sourceToDelete?.id}` ? 'Deleting...' : 'Delete source'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open) setSourceToDelete(null);
        }}
        open={Boolean(sourceToDelete)}
        title="Delete evidence source"
      >
        {sourceToDelete ? (
          <div className="space-y-4 text-sm text-[#4f435c]">
            <div className="rounded-lg border border-[#f2b7bf] bg-[#fff4f5] p-4">
              <div className="font-semibold text-[#241232]">{sourceToDelete.name}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <RegStatusPill tone="purple">{sourceToDelete.provider}</RegStatusPill>
                <RegStatusPill tone={sourceToDelete.isActive ? 'success' : 'neutral'}>
                  {sourceToDelete.isActive ? 'active' : 'inactive'}
                </RegStatusPill>
                <RegStatusPill tone="neutral">Created {formatDate(sourceToDelete.createdAt)}</RegStatusPill>
              </div>
            </div>
            <p>
              This removes the source configuration through the existing evidence source delete API. Use this
              only when the connector should no longer be available for future collection jobs.
            </p>
          </div>
        ) : null}
      </RegModal>
    </div>
  );
}
