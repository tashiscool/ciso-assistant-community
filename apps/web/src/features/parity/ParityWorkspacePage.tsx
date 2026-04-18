import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';

const client = new ApiClient();

type ParityCard = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  detail: string;
  route: string;
};

type ParityMetric = {
  id: string;
  label: string;
  value: number;
  detail: string;
};

type ParityOverview = {
  tenantId: string;
  assets: ParityCard[];
  actors: ParityCard[];
  vulnerabilities: ParityCard[];
  policies: ParityCard[];
  incidents: ParityCard[];
  exceptions: ParityCard[];
  analytics: ParityMetric[];
  calendar: Array<{
    id: string;
    title: string;
    date: string;
    detail: string;
    route: string;
  }>;
  backupRestore: {
    exportsCount: number;
    importsCount: number;
    latestExport: string | null;
    latestImport: string | null;
  };
  quickStart: Array<{
    id: string;
    title: string;
    completed: boolean;
    detail: string;
    route: string;
  }>;
  searchIndex: Array<{
    id: string;
    title: string;
    subtitle: string;
    section: string;
    route: string;
    keywords: string[];
  }>;
  settings: {
    tenantId: string;
    userId: string | null;
    authStrategy: string;
    appEnv: string;
  };
  libraryOperations: ParityCard[];
  tasks: ParityCard[];
  dashboards: ParityCard[];
  validationFlows: ParityCard[];
  xRays: ParityCard[];
  program: ParityCard[];
};

type Props = {
  section:
    | 'assets'
    | 'actors'
    | 'vulnerabilities'
    | 'policies'
    | 'incidents'
    | 'exceptions'
    | 'analytics'
    | 'calendar'
    | 'search'
    | 'backup'
    | 'settings'
    | 'quickStart'
    | 'libraries'
    | 'tasks'
    | 'dashboards'
    | 'validation'
    | 'xrays'
    | 'program';
  title: string;
  description: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function ParityWorkspacePage({ section, title, description }: Props) {
  const { identity } = useEdgeIdentity();
  const [overview, setOverview] = useState<ParityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  async function loadOverview() {
    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{ data: ParityOverview }>('/ops/parity/overview');
      setOverview(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, [identity.tenantId, identity.userId]);

  const cards = useMemo(() => {
    if (!overview) {
      return [];
    }

    switch (section) {
      case 'assets':
        return overview.assets;
      case 'actors':
        return overview.actors;
      case 'vulnerabilities':
        return overview.vulnerabilities;
      case 'policies':
        return overview.policies;
      case 'incidents':
        return overview.incidents;
      case 'exceptions':
        return overview.exceptions;
      case 'libraries':
        return overview.libraryOperations;
      case 'tasks':
        return overview.tasks;
      case 'dashboards':
        return overview.dashboards;
      case 'validation':
        return overview.validationFlows;
      case 'xrays':
        return overview.xRays;
      case 'program':
        return overview.program;
      default:
        return [];
    }
  }, [overview, section]);

  const searchResults = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return overview.searchIndex;
    }

    return overview.searchIndex.filter((item) =>
      [item.title, item.subtitle, item.section, ...item.keywords]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [overview, query]);

  if (loading || !overview) {
    return <div className="panel p-6 text-sm text-slate-300">Loading parity workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Legacy Coverage</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
      </section>

      {error && <div className="notice-error">{error}</div>}

      {section === 'analytics' && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overview.analytics.map((item) => (
            <div key={item.id} className="metric-card">
              <div className="metric-label">{item.label}</div>
              <div className="metric-value">{item.value}</div>
              <div className="mt-2 text-xs text-slate-500">{item.detail}</div>
            </div>
          ))}
        </section>
      )}

      {section === 'calendar' && (
        <section className="panel">
          <div className="eyebrow">Upcoming Dates</div>
          <div className="mt-4 space-y-3">
            {overview.calendar.map((item) => (
              <Link key={item.id} className="panel-subtle block" to={item.route}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{item.title}</div>
                    <div className="mt-1 text-sm text-slate-400">{item.detail}</div>
                  </div>
                  <div className="text-sm text-slate-300">{formatDate(item.date)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {section === 'backup' && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="metric-card">
            <div className="metric-label">Exports</div>
            <div className="metric-value">{overview.backupRestore.exportsCount}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Imports</div>
            <div className="metric-value">{overview.backupRestore.importsCount}</div>
          </div>
          <div className="panel-subtle md:col-span-2">
            <div className="label">Latest activity</div>
            <div className="mt-3 text-sm text-slate-300">
              Export: {overview.backupRestore.latestExport ?? 'n/a'}
            </div>
            <div className="mt-1 text-sm text-slate-300">
              Import: {overview.backupRestore.latestImport ?? 'n/a'}
            </div>
          </div>
        </section>
      )}

      {section === 'settings' && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="metric-card">
            <div className="metric-label">Tenant</div>
            <div className="mt-3 text-sm font-semibold text-white">{overview.settings.tenantId}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">User</div>
            <div className="mt-3 text-sm font-semibold text-white">{overview.settings.userId ?? 'anonymous'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Auth</div>
            <div className="mt-3 text-sm font-semibold text-white">{overview.settings.authStrategy}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Runtime</div>
            <div className="mt-3 text-sm font-semibold text-white">{overview.settings.appEnv}</div>
          </div>
        </section>
      )}

      {section === 'quickStart' && (
        <section className="panel">
          <div className="eyebrow">Quick Start Progress</div>
          <div className="mt-4 space-y-3">
            {overview.quickStart.map((item) => (
              <Link key={item.id} className="panel-subtle block" to={item.route}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{item.title}</div>
                    <div className="mt-1 text-sm text-slate-400">{item.detail}</div>
                  </div>
                  <span className="badge-neutral">{item.completed ? 'done' : 'next'}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {section === 'search' && (
        <section className="panel">
          <div className="eyebrow">Search Index</div>
          <div className="mt-4 space-y-4">
            <input
              className="input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search frameworks, entities, processings, studies, and incidents..."
              value={query}
            />
            <div className="space-y-3">
              {searchResults.map((item) => (
                <Link key={`${item.section}-${item.id}`} className="panel-subtle block" to={item.route}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        {item.section} · {item.subtitle}
                      </div>
                    </div>
                    <span className="badge-neutral">open</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {!['analytics', 'calendar', 'backup', 'settings', 'quickStart', 'search'].includes(section) && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((item) => (
            <Link
              key={`${item.route}-${item.id}`}
              className="panel-subtle block transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
              to={item.route}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-white">{item.title}</div>
                  <div className="mt-1 text-sm text-slate-400">{item.subtitle}</div>
                </div>
                <span className="badge-neutral">{item.status}</span>
              </div>
              <div className="mt-3 text-sm leading-6 text-slate-300">{item.detail}</div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
