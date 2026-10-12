import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import { RegPageHeader, RegRightDrawer, RegStatusPill, RegTableShell } from '../../components/regovise/PagePrimitives';
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
  const [requirementDrawerOpen, setRequirementDrawerOpen] = useState(false);
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
      setNotice('Requirement added to the catalogue.');
      setRequirementDrawerOpen(false);
      await loadFrameworkDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading catalogue workspace...</div>;
  }

  if (!framework) {
    return <div className="notice-error">Catalogue not found for tenant {identity.tenantId}.</div>;
  }

  return (
    <div className="space-y-6">
      <RegPageHeader
        eyebrow="Compliance / Catalogue"
        title={framework.name}
        description="Manage the requirement and control collection that downstream assessments, plans, and governance artifacts rely on."
        actions={
          <>
            <Link className="button-secondary" to="/frameworks">
              Back to catalogues
            </Link>
            <button className="button-primary" onClick={() => setRequirementDrawerOpen(true)} type="button">
              <Plus className="h-4 w-4" />
              Add requirement
            </button>
          </>
        }
        meta={
          <>
            <RegStatusPill tone="purple">{framework.key}</RegStatusPill>
            <RegStatusPill tone="neutral">{framework.version ?? 'Unversioned'}</RegStatusPill>
            <RegStatusPill tone="info">{framework.category ?? 'Uncategorized'}</RegStatusPill>
            <RegStatusPill tone="success">{framework.controlCount} requirements</RegStatusPill>
          </>
        }
        className="rounded-lg border border-[#ded8e4] shadow-[0_8px_24px_rgba(48,24,72,0.04)]"
      />
      <section className="panel grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="eyebrow">Catalogue readiness</div>
          <h2 className="mt-2 text-2xl font-semibold text-[#241232]">Requirement coverage</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#4f435c]">
            Review catalogue metadata, assessable tree coverage, and the requirement list before
            mapping the catalogue into assessments or policy evidence.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="metric-card">
              <div className="metric-label">Framework key</div>
              <div className="mt-3 font-mono text-sm text-[#6d28d9]">{framework.key}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Version</div>
              <div className="mt-3 text-lg font-semibold text-[#241232]">{framework.version ?? 'n/a'}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Category</div>
              <div className="mt-3 text-lg font-semibold capitalize text-[#241232]">
                {framework.category ?? 'n/a'}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Requirements</div>
              <div className="metric-value">{framework.controlCount}</div>
            </div>
          </div>
          <div className="mt-5 panel-subtle grid gap-3 text-sm text-[#4f435c] sm:grid-cols-2">
            <div>
              <div className="label">Created</div>
              <div className="mt-2">{formatTimestamp(framework.createdAt)}</div>
            </div>
            <div>
              <div className="label">Updated</div>
              <div className="mt-2">{formatTimestamp(framework.updatedAt)}</div>
            </div>
          </div>
          <div className="mt-5 panel-subtle">
            <div className="label">Downstream use</div>
            <div className="mt-3 space-y-2 text-sm leading-6 text-[#4f435c]">
              <div>- Flow requirements into security plans, policies, components, projects, and supply-chain records.</div>
              <div>- Keep one tenant source of truth for the governing controls your builders and assessments reference.</div>
            </div>
          </div>
        </div>

        <div className="panel-subtle flex flex-col justify-between gap-5">
          <div>
            <div className="eyebrow">Catalogue actions</div>
            <h2 className="mt-2 text-2xl font-semibold text-[#241232]">Add requirements without leaving context</h2>
            <p className="mt-3 text-sm leading-6 text-[#4f435c]">
              New requirements are appended to this catalogue and become available for downstream
              assessment, policy, evidence, and system mapping workflows.
            </p>
          </div>
          <button className="button-primary w-fit" onClick={() => setRequirementDrawerOpen(true)} type="button">
            <Plus className="h-4 w-4" />
            Add requirement
          </button>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Requirement Tree</div>
              <h2 className="mt-2 text-xl font-semibold text-[#241232]">Associated Requirements</h2>
            </div>
            <RegStatusPill tone="neutral">{countAssessableNodes(tree)} assessable items</RegStatusPill>
          </div>
          <div className="mt-5">
            {tree.length > 0 ? (
              <FrameworkTree nodes={tree} />
            ) : (
              <div className="panel-subtle text-sm text-[#6f6578]">
                Add your first requirement to build out the catalogue tree.
              </div>
            )}
          </div>
        </section>

        <RegTableShell>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#ded8e4] bg-white text-xs uppercase tracking-[0.18em] text-[#62576a]">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Requirement</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {controls.map((control) => (
                  <tr key={control.id} className="border-t border-[#eeeaf2] align-top">
                    <td className="px-4 py-4 font-mono text-xs text-[#6d28d9]">{control.ref}</td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-[#241232]">{control.title}</div>
                      {control.description && (
                        <div className="mt-2 max-w-xl text-sm leading-6 text-[#6f6578]">
                          {control.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-[#6f6578]">{formatTimestamp(control.updatedAt)}</td>
                  </tr>
                ))}
                {controls.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-[#6f6578]" colSpan={3}>
                      No requirements are loaded for this catalogue yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </RegTableShell>
      </section>

      <RegRightDrawer
        description="Add a catalogue requirement while preserving the existing framework and control route contracts."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="button-secondary"
              onClick={() => setRequirementDrawerOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button className="button-primary" disabled={busy} form="framework-requirement-form" type="submit">
              {busy ? 'Saving...' : 'Add requirement'}
            </button>
          </div>
        }
        onOpenChange={setRequirementDrawerOpen}
        open={requirementDrawerOpen}
        title="Add requirement"
      >
        <form
          className="space-y-4"
          id="framework-requirement-form"
          onSubmit={(event) => {
            event.preventDefault();
            void createControl();
          }}
        >
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
              className="input min-h-[140px]"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the requirement or expected evidence."
              value={description}
            />
          </label>
        </form>
      </RegRightDrawer>
    </div>
  );
}
