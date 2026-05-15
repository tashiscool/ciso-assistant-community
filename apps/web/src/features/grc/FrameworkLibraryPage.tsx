import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFrameworkLibrary, getGrcOverview } from './api';
import type { FrameworkLibrarySummary, GrcOverview } from './types';

function formatTimestamp(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'n/a';
}

export function FrameworkLibraryPage() {
  const [frameworks, setFrameworks] = useState<FrameworkLibrarySummary[]>([]);
  const [overview, setOverview] = useState<GrcOverview | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [frameworkData, overviewData] = await Promise.all([getFrameworkLibrary(), getGrcOverview()]);
        if (!cancelled) {
          setFrameworks(frameworkData);
          setOverview(overviewData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load the framework library.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

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
    return <section className="panel p-6 text-sm text-slate-300">Loading framework knowledge library...</section>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Framework Knowledge</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Framework Library</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Browse imported guidance, evidence checklists, assessment playbooks, and implementation notes that Regovise
          uses as managed reference content for cross-framework operations.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="panel-subtle">
            <div className="label">Frameworks</div>
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
      </section>

      {error ? <div className="notice-error">{error}</div> : null}

      <section className="panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow">Search</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Managed framework content</h2>
          </div>
          <label className="flex min-w-[280px] flex-col gap-2 text-sm text-slate-300">
            Search frameworks
            <input
              className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by framework, SCF ID, or tag"
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
                  {framework.crosswalkReady ? 'SCF ready' : 'Content only'}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="panel-subtle">
                  <div className="label">Framework key</div>
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
            No frameworks match the current search.
          </div>
        ) : null}
      </section>
    </div>
  );
}

