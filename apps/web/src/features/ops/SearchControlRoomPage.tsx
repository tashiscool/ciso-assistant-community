import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Search } from 'lucide-react';
import { useOpsParityOverview } from './useOpsParityOverview';

export function SearchControlRoomPage() {
  const { overview, loading, error, refresh } = useOpsParityOverview();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return overview.searchIndex;
    }

    return overview.searchIndex.filter((entry) => {
      return (
        entry.title.toLowerCase().includes(normalized) ||
        entry.subtitle.toLowerCase().includes(normalized) ||
        entry.section.toLowerCase().includes(normalized) ||
        entry.keywords.some((keyword) => keyword.toLowerCase().includes(normalized))
      );
    });
  }, [overview, query]);

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading workspace search...</div>;
  }

  if (error || !overview) {
    return <div className="notice-error">{error ?? 'Workspace search could not be loaded.'}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-400/0 via-cyan-300/60 to-cyan-400/0" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Workspace Search</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Search</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Search across the current workspace so teams can move quickly between program, evidence, and assurance records without guessing where something lives.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to="/program">
              Open program workspace
            </Link>
            <Link className="button-secondary" to="/assurance">
              Open assurance
            </Link>
            <button className="button-primary" onClick={() => void refresh()} type="button">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="panel-subtle">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
            <Search className="h-5 w-5" />
          </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Search index</h2>
              <p className="text-sm text-slate-400">Filter by title, section, subtitle, or workspace keywords.</p>
            </div>
          </div>
        <div className="mt-5">
          <label className="block">
            <span className="sr-only">Search canonical records</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search frameworks, assessments, evidence, studies, assignments, and more..."
              type="search"
              value={query}
            />
          </label>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {results.length === 0 ? (
          <div className="panel-subtle col-span-full text-sm text-slate-400">
            No workspace records matched that query.
          </div>
        ) : (
          results.map((entry) => (
            <Link
              key={`${entry.section}-${entry.id}`}
              className="panel-subtle block transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
              to={entry.route}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-white">{entry.title}</div>
                  <div className="mt-1 text-sm text-slate-400">{entry.section}</div>
                </div>
                <span className="badge-neutral">{entry.subtitle}</span>
              </div>
              <div className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-500">
                {entry.keywords.slice(0, 4).join(' · ')}
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
