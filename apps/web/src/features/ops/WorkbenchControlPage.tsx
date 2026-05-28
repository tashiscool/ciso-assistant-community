import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BriefcaseBusiness, Clock3, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { getWorkbenchSnapshot, type WorkbenchSnapshot } from './controlApi';

const allOwnersLabel = 'All owners';
const allModulesLabel = 'All modules';
const allStatusesLabel = 'All statuses';

export function WorkbenchControlPage() {
  const [snapshot, setSnapshot] = useState<WorkbenchSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState(allOwnersLabel);
  const [moduleFilter, setModuleFilter] = useState(allModulesLabel);
  const [statusFilter, setStatusFilter] = useState(allStatusesLabel);
  const [search, setSearch] = useState('');

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setSnapshot(await getWorkbenchSnapshot());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workbench could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredItems = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    const searchValue = search.trim().toLowerCase();
    return snapshot.items.filter((item) => {
      if (ownerFilter !== allOwnersLabel && item.owner !== ownerFilter) {
        return false;
      }
      if (moduleFilter !== allModulesLabel && item.module !== moduleFilter) {
        return false;
      }
      if (statusFilter !== allStatusesLabel && item.status !== statusFilter) {
        return false;
      }
      if (!searchValue) {
        return true;
      }
      return (
        item.title.toLowerCase().includes(searchValue) ||
        item.summary.toLowerCase().includes(searchValue) ||
        item.module.toLowerCase().includes(searchValue)
      );
    });
  }, [moduleFilter, ownerFilter, search, snapshot, statusFilter]);

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading workbench...</div>;
  }

  if (error || !snapshot) {
    return <div className="notice-error">{error ?? 'Workbench could not be loaded.'}</div>;
  }

  const owners = [allOwnersLabel, ...snapshot.users.map((user) => user.name)];
  const modules = [allModulesLabel, ...new Set(snapshot.items.map((item) => item.module))];
  const statuses = [allStatusesLabel, ...new Set(snapshot.items.map((item) => item.status))];

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Operations</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Workbench</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Review cross-module operational work from shared module records, assessments, applied controls, portal
              assignments, imports, exports, and monitoring runs in one canonical Worker-backed queue.
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
          <div className="metric-label">Active items</div>
          <div className="metric-value">{snapshot.metrics.activeItems}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Action needed</div>
          <div className="metric-value">{snapshot.metrics.actionNeeded}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Due soon</div>
          <div className="metric-value">{snapshot.metrics.dueSoon}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Completed</div>
          <div className="metric-value">{snapshot.metrics.completedItems}</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="panel-subtle space-y-4">
          <h2 className="text-lg font-semibold text-white">Filters</h2>
          <label className="space-y-1">
            <span className="label">Search</span>
            <input className="input" onChange={(event) => setSearch(event.target.value)} value={search} />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="label">Owner</span>
              <select className="input" onChange={(event) => setOwnerFilter(event.target.value)} value={ownerFilter}>
                {owners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </label>
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
              <span className="label">Status</span>
              <select className="input" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {snapshot.moduleVolume.map((entry) => (
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4" key={entry.module}>
                <div className="label">{entry.module}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{entry.count}</div>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
            <div className="eyebrow">Recent cadence</div>
            <div className="mt-4 space-y-3">
              {snapshot.activity.map((point) => (
                <div key={point.bucket}>
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>{point.bucket}</span>
                    <span>
                      {point.active} active · {point.completed} complete · {point.attention} attention
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/5">
                    <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${Math.min(100, (point.active + point.completed + point.attention) * 12)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="panel overflow-hidden p-0">
          <div className="border-b border-white/10 px-6 py-4">
            <div className="eyebrow">Operational queue</div>
            <p className="mt-1 text-sm text-slate-400">Live work derived from canonical Worker tables and tenant-facing module records.</p>
          </div>
          <div className="divide-y divide-white/6">
            {filteredItems.map((item) => (
              <div className="px-6 py-4" key={item.id}>
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-white">{item.title}</div>
                      <span className="badge-neutral">{item.module}</span>
                      <span
                        className={
                          item.status === 'Action Needed'
                            ? 'badge-neutral'
                            : item.status === 'Done'
                              ? 'badge-positive'
                              : 'badge-neutral'
                        }
                      >
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-300">{item.summary}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {item.owner}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        {item.priority}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        {new Date(item.lastActivity).toLocaleString()}
                      </span>
                      {item.dueDate && <span>Due {new Date(item.dueDate).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 xl:w-[220px] xl:justify-end">
                    <div className="w-full max-w-[120px]">
                      <div className="mb-1 text-xs uppercase tracking-[0.16em] text-slate-500">Progress</div>
                      <div className="h-2 rounded-full bg-white/5">
                        <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>
                    <Link className="button-secondary" to={item.route}>
                      Open
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="panel overflow-hidden p-0">
        <div className="border-b border-white/10 px-6 py-4">
          <div className="eyebrow">Recently completed</div>
          <p className="mt-1 text-sm text-slate-400">Recently closed or ready items across canonical operations.</p>
        </div>
        <div className="divide-y divide-white/6">
          {snapshot.completedItems.map((item) => (
            <div className="flex flex-col gap-2 px-6 py-4 md:flex-row md:items-center md:justify-between" key={item.id}>
              <div>
                <div className="font-medium text-white">{item.title}</div>
                <div className="mt-1 text-sm text-slate-400">
                  {item.module} · {item.owner} · {new Date(item.lastActivity).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge-positive">{item.status}</span>
                <Link className="button-secondary" to={item.route}>
                  Open
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
