import { useEffect, useMemo, useState } from 'react';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { WorkspaceFolder } from './types';

const client = new ApiClient();

export function FoldersPage() {
  const { identity } = useEdgeIdentity();
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contentType, setContentType] = useState('domain');
  const [parentFolderId, setParentFolderId] = useState('');

  const selectableParents = useMemo(
    () => folders.filter((folder) => folder.contentType === 'root' || folder.contentType === 'domain'),
    [folders],
  );

  async function loadFolders() {
    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{ data: WorkspaceFolder[] }>('/iam/folders');
      setFolders(response.data);
      if (!parentFolderId) {
        const rootFolder = response.data.find((folder) => folder.contentType === 'root');
        if (rootFolder) {
          setParentFolderId(rootFolder.id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFolders();
  }, [identity.tenantId, identity.userId]);

  async function createFolder() {
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      await client.post('/iam/folders', {
        name,
        description,
        contentType,
        parentFolderId: contentType === 'root' ? null : parentFolderId || null,
      });
      setName('');
      setDescription('');
      setContentType('domain');
      setNotice('Workspace folder created.');
      await loadFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading workspace folders...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="eyebrow">Workspace</div>
          <h1 className="mt-2 text-3xl font-semibold text-[#241232]">Domains & Folders</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#4f435c]">
            Shape the operating perimeter of the workspace. Domains, enclaves, and shared root
            folders drive ownership, visibility, and scoped access across the product.
          </p>
        </div>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void createFolder();
          }}
        >
          <label className="space-y-1">
            <span className="label">Folder name</span>
            <input
              className="input"
              onChange={(event) => setName(event.target.value)}
              placeholder="Corporate Governance"
              value={name}
            />
          </label>
          <label className="space-y-1">
            <span className="label">Description</span>
            <textarea
              className="input min-h-[92px]"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What part of the workspace does this folder represent?"
              value={description}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Content type</span>
              <select
                className="input"
                onChange={(event) => setContentType(event.target.value)}
                value={contentType}
              >
                <option value="domain">Domain</option>
                <option value="enclave">Enclave</option>
                {!folders.some((folder) => folder.contentType === 'root') && (
                  <option value="root">Root</option>
                )}
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Parent folder</span>
              <select
                className="input"
                disabled={contentType === 'root'}
                onChange={(event) => setParentFolderId(event.target.value)}
                value={contentType === 'root' ? '' : parentFolderId}
              >
                <option value="">Use workspace root</option>
                {selectableParents.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.pathLabel}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="button-primary" disabled={busy} type="submit">
            {busy ? 'Saving...' : 'Add Folder'}
          </button>
        </form>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="panel overflow-x-auto p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#ded8e4] bg-white text-xs uppercase tracking-[0.18em] text-[#62576a]">
            <tr>
              <th className="px-4 py-3">Folder</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Children</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {folders.map((folder) => (
              <tr key={folder.id} className="border-t border-[#eeeaf2] align-top">
                <td className="px-4 py-4">
                  <div className="font-medium text-[#241232]">{folder.name}</div>
                  <div className="mt-1 text-xs text-[#6d28d9]">{folder.pathLabel}</div>
                  {folder.description && (
                    <div className="mt-2 text-sm leading-6 text-[#4f435c]">{folder.description}</div>
                  )}
                </td>
                <td className="px-4 py-4">
                  <span className="status-pill-neutral">{folder.contentType}</span>
                </td>
                <td className="px-4 py-4 text-[#4f435c]">{folder.childCount}</td>
                <td className="px-4 py-4 text-[#4f435c]">{folder.updatedAt}</td>
              </tr>
            ))}
            {folders.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-[#6f6578]" colSpan={4}>
                  No workspace folders found for tenant{' '}
                  <span className="font-mono">{identity.tenantId}</span>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
