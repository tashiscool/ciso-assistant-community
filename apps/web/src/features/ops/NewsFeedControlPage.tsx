import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Filter, RefreshCw, Search } from 'lucide-react';
import { getNewsFeedSnapshot, type NewsFeedSnapshot } from './controlApi';

const allModulesLabel = 'All modules';
const allTypesLabel = 'All activity types';
const allPrioritiesLabel = 'All priorities';

export function NewsFeedControlPage() {
  const [snapshot, setSnapshot] = useState<NewsFeedSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState(allModulesLabel);
  const [typeFilter, setTypeFilter] = useState(allTypesLabel);
  const [priorityFilter, setPriorityFilter] = useState(allPrioritiesLabel);
  const [search, setSearch] = useState('');

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setSnapshot(await getNewsFeedSnapshot());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'News feed could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredEvents = useMemo(() => {
    if (!snapshot) {
      return [];
    }
    const searchValue = search.trim().toLowerCase();
    return snapshot.events.filter((event) => {
      if (moduleFilter !== allModulesLabel && event.module !== moduleFilter) {
        return false;
      }
      if (typeFilter !== allTypesLabel && event.type !== typeFilter) {
        return false;
      }
      if (priorityFilter !== allPrioritiesLabel && event.priority !== priorityFilter) {
        return false;
      }
      if (!searchValue) {
        return true;
      }
      return (
        event.title.toLowerCase().includes(searchValue) ||
        event.summary.toLowerCase().includes(searchValue) ||
        event.module.toLowerCase().includes(searchValue)
      );
    });
  }, [moduleFilter, priorityFilter, search, snapshot, typeFilter]);

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading news feed...</div>;
  }

  if (error || !snapshot) {
    return <div className="notice-error">{error ?? 'News feed could not be loaded.'}</div>;
  }

  const modules = [allModulesLabel, ...new Set(snapshot.events.map((event) => event.module))];
  const types = [allTypesLabel, ...new Set(snapshot.events.map((event) => event.type))];
  const priorities = [allPrioritiesLabel, ...new Set(snapshot.events.map((event) => event.priority))];

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Operations</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">News Feed</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Track exports, imports, portal workflows, evidence collection, and workspace guidance activity from a
              canonical Worker-backed event stream.
            </p>
          </div>
          <button className="button-primary" onClick={() => void load()} type="button">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Events</div>
          <div className="metric-value">{snapshot.metrics.totalEvents}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Action needed</div>
          <div className="metric-value">{snapshot.metrics.actionNeeded}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Workflow events</div>
          <div className="metric-value">{snapshot.metrics.workflowEvents}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Active modules</div>
          <div className="metric-value">{snapshot.metrics.activeModules}</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="panel-subtle space-y-4">
          <div className="flex items-center gap-2 text-white">
            <Filter className="h-4 w-4 text-cyan-300" />
            <h2 className="text-lg font-semibold">Feed filters</h2>
          </div>
          <label className="space-y-1">
            <span className="label">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input
                className="input pl-10"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search modules or activity..."
                value={search}
              />
            </div>
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="label">Module</span>
              <select className="input" onChange={(event) => setModuleFilter(event.target.value)} value={moduleFilter}>
                {modules.map((module) => (
                  <option key={module} value={module}>
                    {module}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Type</span>
              <select className="input" onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
                {types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Priority</span>
              <select className="input" onChange={(event) => setPriorityFilter(event.target.value)} value={priorityFilter}>
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
            <div className="eyebrow">Timeline</div>
            <div className="mt-4 space-y-3">
              {snapshot.timeline.map((point) => (
                <div key={point.bucket}>
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>{point.bucket}</span>
                    <span>
                      {point.events} total · {point.workflow} workflow · {point.action} action
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/5">
                    <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${Math.min(100, point.events * 12)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {snapshot.moduleVolume.map((entry) => (
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4" key={entry.module}>
                <div className="label">{entry.module}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{entry.count}</div>
              </div>
            ))}
          </div>
        </div>

        <section className="panel overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div>
              <div className="eyebrow">Recent activity</div>
              <p className="mt-1 text-sm text-slate-400">Canonical feed events sorted by latest tenant activity.</p>
            </div>
            <BellRing className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="divide-y divide-white/6">
            {filteredEvents.map((event) => (
              <div className="px-6 py-4" key={`${event.type}:${event.id}`}>
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-white">{event.title}</div>
                      <span className="badge-neutral">{event.module}</span>
                      <span className="badge-neutral">{event.type}</span>
                      <span className={event.priority === 'Action' ? 'badge-neutral' : 'badge-positive'}>
                        {event.priority}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-300">{event.summary}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      {event.actor ? `${event.actor} · ` : ''}
                      {new Date(event.occurredAt).toLocaleString()} · {event.status}
                    </div>
                  </div>
                  <Link className="button-secondary" to={event.route}>
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
