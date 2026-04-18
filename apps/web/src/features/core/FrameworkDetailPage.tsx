import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { Framework, FrameworkControl, FrameworkTreeNode } from './types';
import { countAssessableNodes, FrameworkTree } from './FrameworkTree';

const client = new ApiClient();

function formatTimestamp(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'n/a';
}

export function FrameworkDetailPage() {
  const { identity } = useEdgeIdentity();
  const { frameworkId } = useParams<{ frameworkId: string }>();
  const [framework, setFramework] = useState<Framework | null>(null);
  const [controls, setControls] = useState<FrameworkControl[]>([]);
  const [tree, setTree] = useState<FrameworkTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  async function loadFrameworkDetail() {
    if (!frameworkId) {
      setError('Framework id is missing from the route.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [frameworkResponse, controlResponse, treeResponse] = await Promise.all([
        client.get<{ data: Framework }>(`/core/frameworks/${frameworkId}`),
        client.get<{ data: FrameworkControl[] }>(`/core/frameworks/${frameworkId}/controls`),
        client.get<{ data: FrameworkTreeNode[] }>(`/core/frameworks/${frameworkId}/tree`),
      ]);

      setFramework(frameworkResponse.data);
      setControls(controlResponse.data);
      setTree(treeResponse.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFrameworkDetail();
  }, [identity.tenantId, identity.userId, frameworkId]);

  async function createControl() {
    if (!frameworkId) {
      return;
    }

    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      await client.post(`/core/frameworks/${frameworkId}/controls`, {
        ref,
        title,
        description,
      });
      setRef('');
      setTitle('');
      setDescription('');
      setNotice('Requirement added to the framework library.');
      await loadFrameworkDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading framework workspace...</div>;
  }

  if (!framework) {
    return <div className="notice-error">Framework not found for tenant {identity.tenantId}.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <Link className="text-sm text-cyan-200 transition hover:text-cyan-100" to="/frameworks">
            Back to frameworks
          </Link>
          <div className="eyebrow mt-4">Governance</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">{framework.name}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Use this framework workspace to manage assessable requirements before running compliance
            reviews against the standard.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="metric-card">
              <div className="metric-label">Framework key</div>
              <div className="mt-3 font-mono text-sm text-cyan-200">{framework.key}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Version</div>
              <div className="mt-3 text-lg font-semibold text-white">{framework.version ?? 'n/a'}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Category</div>
              <div className="mt-3 text-lg font-semibold capitalize text-white">
                {framework.category ?? 'n/a'}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Requirements</div>
              <div className="metric-value">{framework.controlCount}</div>
            </div>
          </div>
          <div className="mt-5 panel-subtle grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div>
              <div className="label">Created</div>
              <div className="mt-2">{formatTimestamp(framework.createdAt)}</div>
            </div>
            <div>
              <div className="label">Updated</div>
              <div className="mt-2">{formatTimestamp(framework.updatedAt)}</div>
            </div>
          </div>
        </div>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void createControl();
          }}
        >
          <div className="eyebrow">New Requirement</div>
          <label className="space-y-1">
            <span className="label">Reference</span>
            <input
              className="input font-mono text-xs"
              onChange={(event) => setRef(event.target.value)}
              placeholder="A.5.1 or GV.OC-01"
              value={ref}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Title</span>
            <input
              className="input"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Define the requirement title"
              value={title}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Description</span>
            <textarea
              className="input min-h-[120px]"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the requirement or expected evidence."
              value={description}
            />
          </label>
          <button className="button-primary" disabled={busy} type="submit">
            {busy ? 'Saving...' : 'Add Requirement'}
          </button>
        </form>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Requirement Tree</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Associated Requirements</h2>
            </div>
            <div className="badge-neutral">{countAssessableNodes(tree)} assessable items</div>
          </div>
          <div className="mt-5">
            {tree.length > 0 ? (
              <FrameworkTree nodes={tree} />
            ) : (
              <div className="panel-subtle text-sm text-slate-400">
                Add your first requirement to build out the framework tree.
              </div>
            )}
          </div>
        </section>

        <section className="panel overflow-hidden p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Requirement</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {controls.map((control) => (
                <tr key={control.id} className="border-t border-white/5 align-top">
                  <td className="px-4 py-4 font-mono text-xs text-cyan-200">{control.ref}</td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-white">{control.title}</div>
                    {control.description && (
                      <div className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                        {control.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-slate-400">{formatTimestamp(control.updatedAt)}</td>
                </tr>
              ))}
              {controls.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-400" colSpan={3}>
                    No requirements are loaded for this framework yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </section>
    </div>
  );
}
