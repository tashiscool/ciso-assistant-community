import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listModuleCatalog } from './api';
import type { ModuleCatalogEntry, ModuleImplementationType } from './types';

const TYPE_LABELS: Record<ModuleImplementationType, string> = {
  'shared-workspace': 'Shared Workspace',
  'dedicated-workspace': 'Dedicated Workspace',
  'template-workspace': 'Template Workspace',
  subfeature: 'Subfeature',
};

function badgeClass(value: string) {
  switch (value.toLowerCase()) {
    case 'tenant-ready':
    case 'dedicated':
      return 'badge-success';
    case 'template':
      return 'inline-flex rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] text-indigo-200';
    case 'subfeature':
      return 'inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] text-amber-200';
    default:
      return 'badge-neutral';
  }
}

export function ModuleDirectoryPage() {
  const [modules, setModules] = useState<ModuleCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const catalog = await listModuleCatalog();
        if (!cancelled) {
          setModules(catalog);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load the module directory.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const order: ModuleImplementationType[] = [
      'shared-workspace',
      'dedicated-workspace',
      'template-workspace',
      'subfeature',
    ];
    return order.map((type) => ({
      type,
      modules: modules.filter((entry) => entry.implementationType === type),
    }));
  }, [modules]);

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading tenant module directory...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Modules</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Tenant Module Directory</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Every `scale.md` module is exposed here in a tenant-facing surface. Some modules run on the
          shared records workspace, while others land in stronger dedicated or template experiences.
        </p>
      </section>

      {error ? <div className="notice-error">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Modules surfaced</div>
          <div className="metric-value">{modules.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Shared workspaces</div>
          <div className="metric-value">{modules.filter((entry) => entry.implementationType === 'shared-workspace').length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Dedicated surfaces</div>
          <div className="metric-value">{modules.filter((entry) => entry.implementationType === 'dedicated-workspace').length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Template packs</div>
          <div className="metric-value">{modules.filter((entry) => entry.implementationType === 'template-workspace').length}</div>
        </div>
      </section>

      {grouped.map((group) => (
        <section className="space-y-4" key={group.type}>
          <div className="panel-subtle flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="eyebrow">{TYPE_LABELS[group.type]}</div>
              <h2 className="mt-2 text-xl font-semibold text-white">{TYPE_LABELS[group.type]}</h2>
            </div>
            <div className="badge-neutral">{group.modules.length} modules</div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {group.modules.map((entry) => (
              <article className="panel-subtle flex h-full flex-col gap-4" key={entry.moduleKey}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-lg font-semibold text-white">{entry.pluralName}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{entry.moduleKey}</div>
                  </div>
                  <span className={badgeClass(entry.coverageBadge)}>{entry.coverageBadge}</span>
                </div>
                <p className="text-sm leading-6 text-slate-300">{entry.description}</p>
                <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                  <div className="panel-subtle">
                    <div className="label">Implementation</div>
                    <div className="mt-2 text-white">{TYPE_LABELS[entry.implementationType]}</div>
                  </div>
                  <div className="panel-subtle">
                    <div className="label">Current records</div>
                    <div className="mt-2 text-white">{entry.recordCount ?? 0}</div>
                  </div>
                </div>
                <div>
                  <div className="label">Related modules</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {entry.relatedModules.map((related) => (
                      <span className="badge-neutral" key={related}>
                        {related}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-3">
                  <Link className="button-primary" to={entry.canonicalRoute}>
                    {entry.primaryAction}
                  </Link>
                  {entry.directRoute !== entry.canonicalRoute ? (
                    <Link className="button-secondary" to={entry.directRoute}>
                      Open direct route
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
