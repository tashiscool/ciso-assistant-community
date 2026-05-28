import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import type { IamMePayload } from '../iam/types';
import { deriveShellAccessProfile } from '../../shell/shellAccess';
import { getFrameworkLibrary, getGrcAdminStatus, getGrcOverview, importGrcSnapshot, waitForGrcJob } from './api';
import type { FrameworkLibrarySummary, GrcAdminStatus, GrcOverview } from './types';

const client = new ApiClient();

function formatTimestamp(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'n/a';
}

export function FrameworkLibraryPage() {
  const [frameworks, setFrameworks] = useState<FrameworkLibrarySummary[]>([]);
  const [overview, setOverview] = useState<GrcOverview | null>(null);
  const [adminStatus, setAdminStatus] = useState<GrcAdminStatus | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [runningImport, setRunningImport] = useState(false);

  async function loadLibrary() {
    try {
      setLoading(true);
      setError(null);
      const [frameworkData, overviewData] = await Promise.all([getFrameworkLibrary(), getGrcOverview()]);
      setFrameworks(frameworkData);
      setOverview(overviewData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the framework library.');
    } finally {
      setLoading(false);
    }
  }

  async function loadAdminSurface() {
    try {
      const meResponse = await client.get<{ data: IamMePayload }>('/iam/me');
      const access = deriveShellAccessProfile(meResponse.data);
      if (!access.canViewAdminNavigation) {
        setAdminStatus(null);
        return;
      }
      setAdminStatus(await getGrcAdminStatus());
    } catch {
      setAdminStatus(null);
    }
  }

  useEffect(() => {
    async function load() {
      await Promise.all([loadLibrary(), loadAdminSurface()]);
    }

    void load();
  }, []);

  async function handleImportSnapshot() {
    try {
      setRunningImport(true);
      setError(null);
      setMessage(null);
      const queued = await importGrcSnapshot();
      setMessage(`Queued packaged catalogue import job ${queued.jobId.slice(0, 12)}.`);
      const finished = await waitForGrcJob(queued.jobId);
      await Promise.all([loadLibrary(), loadAdminSurface()]);
      setMessage(
        finished.status === 'completed'
          ? `Packaged catalogue import completed for job ${queued.jobId.slice(0, 12)}.`
          : `Packaged catalogue import failed for job ${queued.jobId.slice(0, 12)}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import packaged catalogue content.');
    } finally {
      setRunningImport(false);
    }
  }

  const filtered = useMemo(() => {
    const token = query.trim().toLowerCase();
    if (!token) {
      return frameworks;
    }

    return frameworks.filter((framework) =>
      [
        framework.name,
        framework.frameworkKey,
        framework.description ?? '',
        framework.scfFrameworkId ?? '',
        framework.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(token),
    );
  }, [frameworks, query]);

  if (loading) {
    return <section className="panel p-6 text-sm text-slate-300">Loading catalogue library...</section>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Catalogues</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Catalogue Library</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Browse managed laws, regulations, and control-pack guidance that Regovise keeps as
          reference content for tenant catalogues, assessment planning, and cross-framework
          operations.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link className="button-secondary" to="/frameworks">
            Open workspace catalogues
          </Link>
          <Link className="button-secondary" to="/modules">
            Open module directory
          </Link>
          {adminStatus ? (
            <button className="button-primary" disabled={runningImport} onClick={() => void handleImportSnapshot()} type="button">
              {runningImport ? 'Importing…' : 'Import packaged catalogues'}
            </button>
          ) : null}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="panel-subtle">
            <div className="label">Packaged catalogues</div>
            <div className="mt-2 text-2xl font-semibold text-white">{overview?.frameworks.length ?? frameworks.length}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Imported findings</div>
            <div className="mt-2 text-2xl font-semibold text-white">{overview?.findings ?? 0}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Gap assessments</div>
            <div className="mt-2 text-2xl font-semibold text-white">{overview?.assessments ?? 0}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Report bundles</div>
            <div className="mt-2 text-2xl font-semibold text-white">{overview?.reportBundles ?? 0}</div>
          </div>
        </div>

        {adminStatus ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="panel-subtle">
              <div className="label">Packaged import status</div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                <div>- {adminStatus.frameworkCount} packaged catalogues and {adminStatus.documentCount} managed documents are available in the curated snapshot.</div>
                <div>- Use the import action to refresh packaged catalogue content before launching new assessment planning or crosswalk work.</div>
              </div>
            </div>
            <div className="panel-subtle">
              <div className="label">Latest curated snapshot</div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                {adminStatus.latestSnapshot ? (
                  <>
                    <div>Revision: {adminStatus.latestSnapshot.sourceRevision}</div>
                    <div>Imported: {formatTimestamp(adminStatus.latestSnapshot.importedAt)}</div>
                  </>
                ) : (
                  <div>No curated snapshot has been imported into this tenant yet.</div>
                )}
                <Link className="inline-flex text-cyan-200 transition hover:text-cyan-100" to="/grc-admin">
                  Open catalogue administration
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {error ? <div className="notice-error">{error}</div> : null}
      {message ? <div className="notice-success">{message}</div> : null}

      <section className="panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow">Search</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Managed catalogue content</h2>
          </div>
          <label className="flex min-w-[280px] flex-col gap-2 text-sm text-slate-300">
            Search catalogues
            <input
              className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by catalogue, SCF ID, or tag"
              value={query}
            />
          </label>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {filtered.map((framework) => (
            <Link
              className="rounded-3xl border border-white/10 bg-slate-950/30 p-5 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
              key={framework.id}
              to={`/framework-library/${framework.slug}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="eyebrow">{framework.category}</div>
                  <h3 className="mt-2 text-2xl font-semibold text-white">{framework.name}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {framework.description || 'No framework description has been imported yet.'}
                  </p>
                </div>
                <span className={framework.crosswalkReady ? 'badge-success' : 'badge-neutral'}>
                  {framework.crosswalkReady ? 'Crosswalk ready' : 'Reference content'}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="panel-subtle">
                  <div className="label">Catalogue key</div>
                  <div className="mt-2 text-sm font-semibold text-white">{framework.frameworkKey}</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">Documents</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{framework.documentCount}</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">SCF mapping</div>
                  <div className="mt-2 text-sm font-semibold text-white">{framework.scfFrameworkId ?? 'Pending'}</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">Updated</div>
                  <div className="mt-2 text-sm font-semibold text-white">{formatTimestamp(framework.updatedAt)}</div>
                </div>
              </div>

              {framework.tags.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {framework.tags.slice(0, 6).map((tag) => (
                    <span className="badge-neutral" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </Link>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-sm text-slate-400">
            No catalogues match the current search.
          </div>
        ) : null}
      </section>
    </div>
  );
}
