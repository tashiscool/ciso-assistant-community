import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { Framework } from './types';

const client = new ApiClient();

export function FrameworksPage() {
  const { identity } = useEdgeIdentity();
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [category, setCategory] = useState('security');

  async function loadFrameworks() {
    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{ data: Framework[] }>('/core/frameworks');
      setFrameworks(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFrameworks();
  }, [identity.tenantId, identity.userId]);

  async function createFramework() {
    try {
      setBusy(true);
      setNotice(null);
      await client.post('/core/frameworks', {
        key,
        name,
        version,
        category,
      });
      setKey('');
      setName('');
      setVersion('');
      setCategory('security');
      setNotice('Framework added to the workspace.');
      await loadFrameworks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading frameworks...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="eyebrow">Core</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Frameworks</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Organize the standards and baselines your team uses so assessments and evidence stay
            anchored to the right reference set.
          </p>
        </div>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void createFramework();
          }}
        >
          <label className="space-y-1">
            <span className="label">Framework key</span>
            <input
              className="input"
              onChange={(event) => setKey(event.target.value)}
              placeholder="ISO27001_2022"
              value={key}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Framework name</span>
            <input
              className="input"
              onChange={(event) => setName(event.target.value)}
              placeholder="ISO 27001:2022"
              value={name}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Version</span>
              <input
                className="input"
                onChange={(event) => setVersion(event.target.value)}
                placeholder="2022"
                value={version}
              />
            </label>
            <label className="space-y-1">
              <span className="label">Category</span>
              <select
                className="input"
                onChange={(event) => setCategory(event.target.value)}
                value={category}
              >
                <option value="security">Security</option>
                <option value="privacy">Privacy</option>
                <option value="resilience">Resilience</option>
                <option value="governance">Governance</option>
              </select>
            </label>
          </div>
          <button className="button-primary" disabled={busy} type="submit">
            {busy ? 'Saving...' : 'Add Framework'}
          </button>
        </form>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="panel overflow-hidden p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Framework</th>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Category</th>
            </tr>
          </thead>
          <tbody>
            {frameworks.map((framework) => (
              <tr key={framework.id} className="border-t border-white/5 align-top">
                <td className="px-4 py-4">
                  <Link
                    className="font-medium text-white transition hover:text-cyan-200"
                    to={`/frameworks/${framework.id}`}
                  >
                    {framework.name}
                  </Link>
                  <div className="mt-1 text-xs text-slate-500">{framework.updatedAt}</div>
                </td>
                <td className="px-4 py-4 font-mono text-xs text-cyan-200">{framework.key}</td>
                <td className="px-4 py-4 text-slate-300">{framework.version ?? 'n/a'}</td>
                <td className="px-4 py-4 text-slate-300">
                  <div>{framework.category ?? 'n/a'}</div>
                  <div className="mt-1 text-xs text-slate-500">{framework.controlCount} requirements</div>
                </td>
              </tr>
            ))}
            {frameworks.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={4}>
                  No frameworks found for tenant <span className="font-mono">{identity.tenantId}</span>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
