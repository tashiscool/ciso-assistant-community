import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import { getFrameworkLibrary } from '../grc/api';
import type { FrameworkLibrarySummary } from '../grc/types';
import type { IamMePayload } from '../iam/types';
import type { Framework } from './types';

const client = new ApiClient();
const FRAMEWORK_WRITE_PERMISSIONS = new Set(['add_framework', 'change_framework']);

type ImportMode = 'system' | 'file';

type CatalogueImportResponse = {
  data: {
    framework: Framework | null;
    importedControlCount: number;
    source: 'system' | 'file';
    packagedCatalogue?: {
      id: string;
      slug: string;
      frameworkKey: string;
      name: string;
    };
  };
};

type CatalogueFilePreview = {
  fileName: string;
  key: string;
  name: string;
  version: string | null;
  category: string | null;
  controlCount: number;
};

function formatTimestamp(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : 'n/a';
}

function normalizeFrameworkKey(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readFirstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function parseControlPreviewArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      const ref = readFirstString(record, ['ref', 'controlId', 'requirementId', 'requirement_id', 'id', 'key', 'code']);
      const title = readFirstString(record, ['title', 'name', 'label', 'displayName', 'display_name', 'prompt']);
      if (!ref || !title) {
        return null;
      }
      return { ref, title };
    })
    .filter((item): item is { ref: string; title: string } => Boolean(item));
}

function firstNonEmptyControlPreview(...values: unknown[]) {
  for (const value of values) {
    const parsed = parseControlPreviewArray(value);
    if (parsed.length > 0) {
      return parsed;
    }
  }
  return [];
}

function previewCatalogueFile(source: unknown, fileName: string): CatalogueFilePreview | null {
  const root = asRecord(source);
  if (!root) {
    return null;
  }

  const metadata =
    asRecord(root.framework) ??
    asRecord(root.catalog) ??
    asRecord(root.metadata) ??
    asRecord(root.data) ??
    root;
  const controls = firstNonEmptyControlPreview(
    root.controls,
    root.requirements,
    root.items,
    root.records,
    metadata.controls,
    metadata.requirements,
    metadata.items,
    root.data,
  );
  const name =
    readFirstString(metadata, ['name', 'title', 'frameworkName', 'framework_name', 'catalogName', 'catalog_name']) ??
    fileName.replace(/\.[^.]+$/u, '').trim();
  const version = readFirstString(metadata, ['version', 'revision', 'release']);
  const key = normalizeFrameworkKey(
    readFirstString(metadata, ['key', 'frameworkKey', 'framework_key', 'catalogKey', 'catalog_key', 'slug', 'id']) ??
      `${name}_${version ?? ''}`,
  );

  if (!name || !key || controls.length === 0) {
    return null;
  }

  return {
    fileName,
    key,
    name,
    version,
    category: readFirstString(metadata, ['category', 'type', 'domain']) ?? 'security',
    controlCount: new Set(controls.map((item) => item.ref.toLowerCase())).size,
  };
}

export function FrameworksPage() {
  const { identity } = useEdgeIdentity();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [library, setLibrary] = useState<FrameworkLibrarySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('system');
  const [importingFrameworkId, setImportingFrameworkId] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<CatalogueFilePreview | null>(null);
  const [uploadPayload, setUploadPayload] = useState<unknown>(null);
  const [uploadDragging, setUploadDragging] = useState(false);
  const [canManageCatalogues, setCanManageCatalogues] = useState(false);
  const [showAllPackaged, setShowAllPackaged] = useState(false);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [category, setCategory] = useState('security');

  async function loadPage() {
    try {
      setLoading(true);
      setError(null);
      const [frameworkResponse, libraryResponse, meResponse] = await Promise.all([
        client.get<{ data: Framework[] }>('/core/frameworks'),
        getFrameworkLibrary().catch(() => []),
        client.get<{ data: IamMePayload }>('/iam/me'),
      ]);
      setFrameworks(frameworkResponse.data);
      setLibrary(libraryResponse);
      setCanManageCatalogues(
        meResponse.data.permissions.some((permission) => FRAMEWORK_WRITE_PERMISSIONS.has(permission)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
  }, [identity.tenantId, identity.userId]);

  async function createFramework() {
    try {
      setBusy(true);
      setNotice(null);
      setError(null);
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
      setNotice('Catalogue added to the workspace.');
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  async function installPackagedCatalogue(framework: FrameworkLibrarySummary) {
    try {
      setImportingFrameworkId(framework.id);
      setNotice(null);
      setError(null);
      const response = await client.post<CatalogueImportResponse>('/core/frameworks/import/system', {
        sourceFrameworkId: framework.id,
      });
      const importedControlCount = response.data.importedControlCount;
      setNotice(
        importedControlCount > 0
          ? `${framework.name} installed with ${importedControlCount} imported controls.`
          : `${framework.name} installed as a reference-only catalogue. Add or import controls later if needed.`,
      );
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to install the packaged catalogue.');
    } finally {
      setImportingFrameworkId(null);
    }
  }

  async function handleFileSelected(file: File) {
    try {
      setError(null);
      setNotice(null);
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const preview = previewCatalogueFile(parsed, file.name);
      if (!preview) {
        throw new Error(
          'The selected file must include a catalogue name and at least one control or requirement entry.',
        );
      }
      setUploadPayload(parsed);
      setUploadPreview(preview);
    } catch (err) {
      setUploadPayload(null);
      setUploadPreview(null);
      setError(err instanceof Error ? err.message : 'Unable to read the selected catalogue file.');
    }
  }

  async function importCatalogueFile() {
    if (!uploadPayload || !uploadPreview) {
      return;
    }

    try {
      setUploadBusy(true);
      setError(null);
      setNotice(null);
      const response = await client.post<CatalogueImportResponse>('/core/frameworks/import/file', {
        fileName: uploadPreview.fileName,
        payload: uploadPayload,
      });
      setNotice(
        `${uploadPreview.name} imported from file with ${response.data.importedControlCount} controls.`,
      );
      setUploadPayload(null);
      setUploadPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import the uploaded catalogue file.');
    } finally {
      setUploadBusy(false);
    }
  }

  const totalRequirements = frameworks.reduce((sum, framework) => sum + framework.controlCount, 0);
  const categoryCount = new Set(frameworks.map((framework) => framework.category ?? 'uncategorized')).size;
  const latestUpdatedAt = frameworks
    .map((framework) => framework.updatedAt)
    .sort((left, right) => right.localeCompare(left))[0] ?? null;

  const installedKeys = useMemo(
    () => new Set(frameworks.map((framework) => normalizeFrameworkKey(framework.key))),
    [frameworks],
  );
  const availablePackaged = useMemo(
    () => library.filter((framework) => !installedKeys.has(normalizeFrameworkKey(framework.frameworkKey))),
    [installedKeys, library],
  );
  const visiblePackaged = showAllPackaged ? availablePackaged : availablePackaged.slice(0, 8);

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading catalogues...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="eyebrow">Catalogues</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Catalogues Workspace</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Catalogues are the laws, regulations, and governing documents that collect the controls
            and requirements your tenant uses as a source of truth. Use them to anchor assessments
            and flow requirements into security plans, policies, components, projects, and supply
            chain records.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="panel-subtle">
              <div className="label">Why catalogues matter</div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                <div>- Keep one reusable control source for regulations and internal standards.</div>
                <div>- Reduce manual re-entry when builders generate downstream governance artifacts.</div>
                <div>- Track changes to governing requirements in one tenant workspace.</div>
              </div>
            </div>
            <div className="panel-subtle">
              <div className="label">Use alongside</div>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link className="button-secondary" to="/framework-library">
                  Browse packaged catalogue library
                </Link>
                <Link className="button-secondary" to="/requirements">
                  Open requirements
                </Link>
                <Link className="button-secondary" to="/assessment-plans">
                  Open assessment plans
                </Link>
              </div>
            </div>
          </div>
        </div>

        {canManageCatalogues ? (
          <div className="space-y-4">
            <div>
              <div className="eyebrow">Import</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Bring catalogues into this workspace</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Install packaged RegScale catalogues from the managed library, or upload a valid
                catalogue JSON file for urgent updates, licensed frameworks, or tenant-specific
                migrations.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className={importMode === 'system' ? 'button-primary' : 'button-secondary'}
                onClick={() => setImportMode('system')}
                type="button"
              >
                Import RegScale Catalogs
              </button>
              <button
                className={importMode === 'file' ? 'button-primary' : 'button-secondary'}
                onClick={() => setImportMode('file')}
                type="button"
              >
                Upload
              </button>
            </div>

            {importMode === 'system' ? (
              <div className="panel-subtle space-y-3">
                <div className="label">Import from system</div>
                <p className="text-sm leading-6 text-slate-300">
                  Install a packaged catalogue that has not yet been loaded into this tenant. Use
                  <span className="mx-1 font-medium text-white">Learn more</span>
                  to review the catalogue detail before adding it.
                </p>
                {availablePackaged.length > 0 ? (
                  <div className="space-y-3">
                    {visiblePackaged.map((framework) => (
                      <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4" key={framework.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">{framework.name}</div>
                            <div className="mt-1 text-xs text-slate-400">
                              {framework.frameworkKey} · {framework.version ?? 'Unversioned'} ·{' '}
                              {framework.category}
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-300">
                              {framework.description || 'No packaged description is available yet.'}
                            </p>
                          </div>
                          <span className={framework.crosswalkReady ? 'badge-success' : 'badge-neutral'}>
                            {framework.crosswalkReady ? 'Controls ready' : 'Reference content'}
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link className="button-secondary" to={`/framework-library/${framework.slug}`}>
                            Learn more
                          </Link>
                          <button
                            className="button-primary"
                            disabled={importingFrameworkId === framework.id}
                            onClick={() => void installPackagedCatalogue(framework)}
                            type="button"
                          >
                            {importingFrameworkId === framework.id ? 'Adding...' : 'Add'}
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                      <div>
                        Showing {visiblePackaged.length} of {availablePackaged.length} packaged catalogues
                        available for this tenant.
                      </div>
                      {availablePackaged.length > 8 ? (
                        <button
                          className="button-secondary"
                          onClick={() => setShowAllPackaged((current) => !current)}
                          type="button"
                        >
                          {showAllPackaged ? 'Show fewer' : 'Show all'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : library.length > 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm text-slate-300">
                    All packaged catalogues in the current library snapshot are already installed in
                    this tenant.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm text-slate-300">
                    No packaged catalogue snapshot is loaded yet. Open the catalogue library to
                    refresh curated content before importing from system.
                  </div>
                )}
              </div>
            ) : (
              <div className="panel-subtle space-y-3">
                <input
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleFileSelected(file);
                    }
                  }}
                  ref={fileInputRef}
                  type="file"
                />
                <div className="label">Import from file</div>
                <p className="text-sm leading-6 text-slate-300">
                  Upload a valid RegScale catalogue JSON file when you need a licensed framework, an
                  urgent update, or a tenant-specific migration from another installation.
                </p>
                <div
                  className={`rounded-2xl border border-dashed p-5 transition ${
                    uploadDragging
                      ? 'border-cyan-300/60 bg-cyan-400/[0.06]'
                      : 'border-white/10 bg-slate-950/20'
                  }`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setUploadDragging(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    const nextTarget = event.relatedTarget as Node | null;
                    if (!event.currentTarget.contains(nextTarget)) {
                      setUploadDragging(false);
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setUploadDragging(true);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setUploadDragging(false);
                    const file = event.dataTransfer.files?.[0];
                    if (file) {
                      void handleFileSelected(file);
                    }
                  }}
                >
                  <div className="text-sm font-semibold text-white">Drop a catalogue file here</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Drag and drop a `.json` RegScale catalogue export, or browse to select a file
                    from your system.
                  </p>
                  <button className="button-secondary mt-4" onClick={() => fileInputRef.current?.click()} type="button">
                    Select catalogue file
                  </button>
                </div>
                {uploadPreview ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                    <div className="text-sm font-semibold text-white">{uploadPreview.name}</div>
                    <div className="mt-2 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                      <div>Key: {uploadPreview.key}</div>
                      <div>Version: {uploadPreview.version ?? 'n/a'}</div>
                      <div>Category: {uploadPreview.category ?? 'security'}</div>
                      <div>Controls: {uploadPreview.controlCount}</div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className="button-primary"
                        disabled={uploadBusy}
                        onClick={() => void importCatalogueFile()}
                        type="button"
                      >
                        {uploadBusy ? 'Importing...' : 'Complete Import'}
                      </button>
                      <button
                        className="button-secondary"
                        onClick={() => {
                          setUploadPreview(null);
                          setUploadPayload(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        type="button"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm text-slate-300">
                    The uploaded file must define a catalogue name plus at least one control or
                    requirement entry.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="panel-subtle">
            <div className="label">Read-only access</div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              This session can review catalogue content but cannot create or import catalogues. A
              tenant administrator needs framework management permissions to install packaged
              catalogues or upload new ones.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="button-secondary" to="/me">
                Review current access
              </Link>
              <Link className="button-secondary" to="/framework-library">
                Browse packaged library
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Active catalogues</div>
          <div className="metric-value">{frameworks.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Requirements loaded</div>
          <div className="metric-value">{totalRequirements}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Packaged catalogues ready</div>
          <div className="metric-value">{availablePackaged.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Latest update</div>
          <div className="mt-3 text-lg font-semibold text-white">{formatTimestamp(latestUpdatedAt)}</div>
          <div className="mt-2 text-xs text-slate-500">{categoryCount} categories in use</div>
        </div>
      </section>

      {notice ? <div className="notice-success">{notice}</div> : null}
      {error ? <div className="notice-error">{error}</div> : null}

      {canManageCatalogues ? (
        <section className="panel">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="eyebrow">Manual entry</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Create a tenant-specific catalogue</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Use manual entry when a governing document is not part of the packaged library or
                when you want to create a tenant-only catalogue before loading controls.
              </p>
            </div>
            <form
              className="w-full max-w-xl space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void createFramework();
              }}
            >
              <label className="space-y-1">
                <span className="label">Catalogue key</span>
                <input
                  className="input"
                  onChange={(event) => setKey(event.target.value)}
                  placeholder="ISO27001_2022"
                  value={key}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Catalogue name</span>
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
                {busy ? 'Saving...' : 'Add Catalogue'}
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="panel overflow-hidden p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Catalogue</th>
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
            {frameworks.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={4}>
                  No catalogues found for tenant <span className="font-mono">{identity.tenantId}</span>.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
