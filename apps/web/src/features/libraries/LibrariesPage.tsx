import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { Library } from './types';

const client = new ApiClient();

function formatTimestamp(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : 'n/a';
}

export function LibrariesPage() {
  const { identity } = useEdgeIdentity();
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadLibraries() {
    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{ data: Library[] }>('/core/libraries');
      setLibraries(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLibraries();
  }, [identity.tenantId, identity.userId]);

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading library catalog...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Catalog</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Libraries</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          Browse the packaged frameworks, threats, and scoring assets that seed governance and
          assessment workflows inside the migrated workspace.
        </p>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 lg:grid-cols-2">
        {libraries.map((library) => (
          <Link
            key={library.id}
            className="panel transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
            to={`/libraries/${library.id}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="eyebrow">Library Pack</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">{library.name}</h2>
              </div>
              <span className={library.hasUpdate ? 'badge-success' : 'badge-neutral'}>
                {library.hasUpdate ? 'Update Available' : 'Current'}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {library.description || 'No library description available.'}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="panel-subtle">
                <div className="label">Reference controls</div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {library.objectsMeta.referenceControls}
                </div>
              </div>
              <div className="panel-subtle">
                <div className="label">Threats</div>
                <div className="mt-2 text-lg font-semibold text-white">{library.objectsMeta.threats}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Risk matrices</div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {library.objectsMeta.riskMatrices}
                </div>
              </div>
              <div className="panel-subtle">
                <div className="label">Framework</div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {library.frameworkName ?? 'None'}
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-4 text-sm text-slate-400">
              <span>Provider: {library.provider}</span>
              <span>Packager: {library.packager}</span>
              <span>Version: {library.version ?? 'n/a'}</span>
              <span>Published: {formatTimestamp(library.publicationDate)}</span>
            </div>
          </Link>
        ))}
        {libraries.length === 0 && (
          <div className="panel text-sm text-slate-400">
            No library packs are available for tenant <span className="font-mono">{identity.tenantId}</span>.
          </div>
        )}
      </section>
    </div>
  );
}
