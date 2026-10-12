import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { RegFilterBar, RegModal, RegPageHeader, RegStatusPill } from '../../components/regovise/PagePrimitives';
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
  const [importReviewOpen, setImportReviewOpen] = useState(false);

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
      setImportReviewOpen(false);
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
    return <section className="panel p-6 text-sm text-[#4f435c]">Loading catalogue library...</section>;
  }

  return (
    <div className="space-y-6">
      <RegPageHeader
        eyebrow="Compliance"
        title="Catalogue Library"
        description="Browse managed laws, regulations, and control-pack guidance that Regovise keeps as reference content for tenant catalogues, assessment planning, and cross-framework operations."
        actions={
          <>
            <Link className="button-secondary" to="/frameworks">
              Open workspace catalogues
            </Link>
            <Link className="button-secondary" to="/modules">
              Open module directory
            </Link>
            {adminStatus ? (
              <button className="button-primary" disabled={runningImport} onClick={() => setImportReviewOpen(true)} type="button">
                {runningImport ? 'Importing...' : 'Import packaged catalogues'}
              </button>
            ) : null}
          </>
        }
        meta={
          <>
            <RegStatusPill tone="purple">{overview?.frameworks.length ?? frameworks.length} packaged catalogues</RegStatusPill>
            <RegStatusPill tone="neutral">{overview?.assessments ?? 0} gap assessments</RegStatusPill>
            <RegStatusPill tone="info">{overview?.reportBundles ?? 0} report bundles</RegStatusPill>
          </>
        }
        className="rounded-lg border border-[#ded8e4] shadow-[0_8px_24px_rgba(48,24,72,0.04)]"
      />
      <section className="panel">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="panel-subtle">
            <div className="label">Packaged catalogues</div>
            <div className="mt-2 text-2xl font-semibold text-[#241232]">{overview?.frameworks.length ?? frameworks.length}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Imported findings</div>
            <div className="mt-2 text-2xl font-semibold text-[#241232]">{overview?.findings ?? 0}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Gap assessments</div>
            <div className="mt-2 text-2xl font-semibold text-[#241232]">{overview?.assessments ?? 0}</div>
          </div>
          <div className="panel-subtle">
            <div className="label">Report bundles</div>
            <div className="mt-2 text-2xl font-semibold text-[#241232]">{overview?.reportBundles ?? 0}</div>
          </div>
        </div>

        {adminStatus ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="panel-subtle">
              <div className="label">Packaged import status</div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[#4f435c]">
                <div>- {adminStatus.frameworkCount} packaged catalogues and {adminStatus.documentCount} managed documents are available in the curated snapshot.</div>
                <div>- Use the import action to refresh packaged catalogue content before launching new assessment planning or crosswalk work.</div>
              </div>
            </div>
            <div className="panel-subtle">
              <div className="label">Latest curated snapshot</div>
              <div className="mt-3 space-y-2 text-sm text-[#4f435c]">
                {adminStatus.latestSnapshot ? (
                  <>
                    <div>Revision: {adminStatus.latestSnapshot.sourceRevision}</div>
                    <div>Imported: {formatTimestamp(adminStatus.latestSnapshot.importedAt)}</div>
                  </>
                ) : (
                  <div>No curated snapshot has been imported into this tenant yet.</div>
                )}
                <Link className="inline-flex text-[#6d28d9] transition hover:text-[#5f1aa8]" to="/grc-admin">
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
            <h2 className="mt-2 text-2xl font-semibold text-[#241232]">Managed catalogue content</h2>
          </div>
        </div>
        <RegFilterBar className="-mx-6 mt-5">
          <label className="flex min-w-[280px] flex-col gap-2 text-sm text-[#4f435c]">
            Search catalogues
            <input
              className="rounded-2xl border border-[#ded8e4] bg-white px-4 py-3 text-sm text-[#241232] outline-none transition focus:border-[#8b35e6]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by catalogue, SCF ID, or tag"
              value={query}
            />
          </label>
        </RegFilterBar>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {filtered.map((framework) => (
            <Link
              className="rounded-3xl border border-[#ded8e4] bg-[#fbf9fc] p-5 transition hover:border-[#d7c3f1] hover:bg-[#f6f1fa]"
              key={framework.id}
              to={`/framework-library/${framework.slug}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="eyebrow">{framework.category}</div>
                  <h3 className="mt-2 text-2xl font-semibold text-[#241232]">{framework.name}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#4f435c]">
                    {framework.description || 'No framework description has been imported yet.'}
                  </p>
                </div>
                <RegStatusPill tone={framework.crosswalkReady ? 'success' : 'neutral'}>
                  {framework.crosswalkReady ? 'Crosswalk ready' : 'Reference content'}
                </RegStatusPill>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="panel-subtle">
                  <div className="label">Catalogue key</div>
                  <div className="mt-2 text-sm font-semibold text-[#241232]">{framework.frameworkKey}</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">Documents</div>
                  <div className="mt-2 text-2xl font-semibold text-[#241232]">{framework.documentCount}</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">SCF mapping</div>
                  <div className="mt-2 text-sm font-semibold text-[#241232]">{framework.scfFrameworkId ?? 'Pending'}</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">Updated</div>
                  <div className="mt-2 text-sm font-semibold text-[#241232]">{formatTimestamp(framework.updatedAt)}</div>
                </div>
              </div>

              {framework.tags.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {framework.tags.slice(0, 6).map((tag) => (
                    <RegStatusPill tone="neutral" key={tag}>
                      {tag}
                    </RegStatusPill>
                  ))}
                </div>
              ) : null}
            </Link>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-[#ded8e4] bg-[#fbf9fc] p-6 text-sm text-[#6f6578]">
            No catalogues match the current search.
          </div>
        ) : null}
      </section>
      <RegModal
        description="Review the curated snapshot refresh before queueing the packaged catalogue import for this tenant."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="button-secondary"
              disabled={runningImport}
              onClick={() => setImportReviewOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button className="button-primary" disabled={runningImport} onClick={() => void handleImportSnapshot()} type="button">
              {runningImport ? 'Importing...' : 'Import catalogues'}
            </button>
          </div>
        }
        onOpenChange={(open) => {
          if (!open && !runningImport) {
            setImportReviewOpen(false);
          }
        }}
        open={importReviewOpen}
        title="Import packaged catalogues"
      >
        <div className="space-y-4 text-sm text-[#4f435c]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="panel-subtle">
              <div className="label">Catalogues</div>
              <div className="mt-2 text-2xl font-semibold text-[#241232]">{adminStatus?.frameworkCount ?? 0}</div>
            </div>
            <div className="panel-subtle">
              <div className="label">Managed documents</div>
              <div className="mt-2 text-2xl font-semibold text-[#241232]">{adminStatus?.documentCount ?? 0}</div>
            </div>
            <div className="panel-subtle sm:col-span-2">
              <div className="label">Latest curated snapshot</div>
              <div className="mt-2 text-[#241232]">
                {adminStatus?.latestSnapshot?.sourceRevision ?? 'No snapshot imported yet'}
              </div>
              <div className="mt-1 text-[#6f6578]">
                Imported {formatTimestamp(adminStatus?.latestSnapshot?.importedAt)}
              </div>
            </div>
          </div>
          <div className="notice-warning">
            This uses the existing packaged catalogue import API and refreshes tenant reference content. Confirm only if the
            current tenant should receive the curated snapshot state.
          </div>
        </div>
      </RegModal>
    </div>
  );
}
