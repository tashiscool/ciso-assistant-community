import { useEffect, useState } from 'react';
import { RegModal, RegRightDrawer, RegStatusPill } from '../../components/regovise/PagePrimitives';
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

const client = new ApiClient();

export function EvidenceSourcesPage() {
  const { identity } = useEdgeIdentity();
  const [sources, setSources] = useState<EvidenceSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sourceDrawerOpen, setSourceDrawerOpen] = useState(false);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('github');
  const [awsRegion, setAwsRegion] = useState('us-gov-west-1');
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [awsSessionToken, setAwsSessionToken] = useState('');
  const [awsAllEnabledRegions, setAwsAllEnabledRegions] = useState(false);
  const [sourceToCollect, setSourceToCollect] = useState<EvidenceSource | null>(null);

  async function loadSources() {
    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{ data: EvidenceSource[] }>('/evidence/sources');
      setSources(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSources();
  }, [identity.tenantId, identity.userId]);

  const canCreateSource =
    name.trim().length > 0 &&
    (provider !== 'aws' ||
      (awsRegion.trim().length > 0 &&
        awsAccessKeyId.trim().length > 0 &&
        awsSecretAccessKey.trim().length > 0));

  async function createSource() {
    try {
      setBusyId('create');
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
              createdFrom: 'react-shell',
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
      setSourceDrawerOpen(false);
      setNotice('Created a new evidence source in D1.');
      await loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyId(null);
    }
  }

  async function collectEvidence(sourceId: string) {
    try {
      setBusyId(sourceId);
      setNotice(null);
      const response = await client.post<{ data: { jobId: string } }>(
        `/evidence/sources/${sourceId}/collect`,
      );
      setNotice(`Queued evidence collection job ${response.data.jobId}.`);
      setSourceToCollect(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="eyebrow">Evidence</div>
              <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Evidence Collection Sources</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#4f435c]">
                Keep a catalog of collection sources and trigger evidence runs whenever you need fresh
                artifacts for review or audit support.
              </p>
            </div>
            <button
              className="button-primary shrink-0"
              onClick={() => setSourceDrawerOpen(true)}
              type="button"
            >
              Add source
            </button>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="panel overflow-hidden p-0">
        <div className="max-w-full overflow-x-auto">
          <table className="min-w-[760px] text-left text-sm">
            <thead className="border-b border-[#ded8e4] bg-white text-xs uppercase tracking-[0.18em] text-[#62576a]">
              <tr>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id} className="border-t border-[#eeeaf2] align-top">
                  <td className="px-4 py-4">
                    <div className="font-medium text-[#241232]">{source.name}</div>
                    <div className="mt-1 text-xs text-[#62576a]">{source.updatedAt}</div>
                  </td>
                  <td className="px-4 py-4 text-[#4f435c]">{source.provider}</td>
                  <td className="px-4 py-4">
                    <RegStatusPill tone={source.isActive ? 'success' : 'neutral'}>
                      {source.isActive ? 'active' : 'inactive'}
                    </RegStatusPill>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      className="button-secondary"
                      disabled={busyId === source.id}
                      onClick={() => setSourceToCollect(source)}
                      type="button"
                    >
                      {busyId === source.id ? 'Queueing...' : 'Collect'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && sources.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-[#6f6578]" colSpan={4}>
                    No evidence sources found for tenant <span className="font-mono">{identity.tenantId}</span>.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="px-4 py-8 text-center text-[#6f6578]" colSpan={4}>
                    Loading evidence sources...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <RegRightDrawer
        description="Configure a source for repeatable collection jobs without leaving the evidence workspace."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="button-secondary"
              onClick={() => setSourceDrawerOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={busyId === 'create' || !canCreateSource}
              form="evidence-source-form"
              type="submit"
            >
              {busyId === 'create' ? 'Creating...' : 'Create source'}
            </button>
          </div>
        }
        onOpenChange={setSourceDrawerOpen}
        open={sourceDrawerOpen}
        title="Add evidence source"
      >
        <form
          className="space-y-4"
          id="evidence-source-form"
          onSubmit={(event) => {
            event.preventDefault();
            void createSource();
          }}
        >
          <label className="space-y-1">
            <span className="label">Source name</span>
            <input
              className="input"
              onChange={(event) => setName(event.target.value)}
              placeholder="GitHub Org Inventory"
              value={name}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Provider</span>
            <select
              className="input"
              onChange={(event) => setProvider(event.target.value)}
              value={provider}
            >
              <option value="aws">AWS</option>
              <option value="github">GitHub</option>
              <option value="snyk">Snyk</option>
              <option value="wiz">Wiz</option>
              <option value="custom_http">Custom HTTP</option>
            </select>
          </label>
          {provider === 'aws' && (
            <div className="space-y-3 rounded-lg border border-[#9fdfb7] bg-[#ddf7e6] p-4">
              <label className="space-y-1">
                <span className="label">AWS region</span>
                <input
                  className="input"
                  onChange={(event) => setAwsRegion(event.target.value)}
                  value={awsRegion}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Access key id</span>
                <input
                  className="input"
                  onChange={(event) => setAwsAccessKeyId(event.target.value)}
                  value={awsAccessKeyId}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Secret access key</span>
                <input
                  className="input"
                  onChange={(event) => setAwsSecretAccessKey(event.target.value)}
                  type="password"
                  value={awsSecretAccessKey}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Session token</span>
                <input
                  className="input"
                  onChange={(event) => setAwsSessionToken(event.target.value)}
                  value={awsSessionToken}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-[#4f435c]">
                <input
                  checked={awsAllEnabledRegions}
                  onChange={(event) => setAwsAllEnabledRegions(event.target.checked)}
                  type="checkbox"
                />
                Collect all enabled regions
              </label>
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
              disabled={!sourceToCollect || busyId === sourceToCollect?.id}
              onClick={() => sourceToCollect && void collectEvidence(sourceToCollect.id)}
              type="button"
            >
              {busyId === sourceToCollect?.id ? 'Queueing...' : 'Queue collection'}
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
                <RegStatusPill tone="neutral">Updated {sourceToCollect.updatedAt}</RegStatusPill>
              </div>
            </div>
            <p>
              Regovise will call the existing collection endpoint and append the resulting job to the
              evidence queue for this tenant.
            </p>
          </div>
        ) : null}
      </RegModal>
    </div>
  );
}
