import { useEffect, useState } from 'react';
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
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('github');

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

  async function createSource() {
    try {
      setBusyId('create');
      setNotice(null);
      await client.post('/evidence/sources', {
        name,
        provider,
        config: {
          createdFrom: 'react-shell',
        },
      });
      setName('');
      setProvider('github');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="eyebrow">Evidence</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Evidence Collection Sources</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Keep a catalog of collection sources and trigger evidence runs whenever you need fresh
            artifacts for review or audit support.
          </p>
        </div>
        <form
          className="space-y-3"
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
              <option value="github">GitHub</option>
              <option value="snyk">Snyk</option>
              <option value="wiz">Wiz</option>
              <option value="custom_http">Custom HTTP</option>
            </select>
          </label>
          <button className="button-primary" disabled={busyId === 'create'} type="submit">
            {busyId === 'create' ? 'Creating...' : 'Create Source'}
          </button>
        </form>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="panel overflow-hidden p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id} className="border-t border-white/5 align-top">
                <td className="px-4 py-4">
                  <div className="font-medium text-white">{source.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{source.updatedAt}</div>
                </td>
                <td className="px-4 py-4 text-slate-300">{source.provider}</td>
                <td className="px-4 py-4">
                  <span className={source.isActive ? 'badge-success' : 'badge-neutral'}>
                    {source.isActive ? 'active' : 'inactive'}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <button
                    className="button-secondary"
                    disabled={busyId === source.id}
                    onClick={() => void collectEvidence(source.id)}
                    type="button"
                  >
                    {busyId === source.id ? 'Queueing...' : 'Collect'}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && sources.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={4}>
                  No evidence sources found for tenant <span className="font-mono">{identity.tenantId}</span>.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={4}>
                  Loading evidence sources...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
