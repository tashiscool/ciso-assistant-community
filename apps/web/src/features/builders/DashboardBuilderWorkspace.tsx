import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeftRight, ArrowUp, LayoutDashboard, Plus, Save, Search, Star, Trash2 } from 'lucide-react';
import {
  createDashboardBuilderDashboard,
  deleteDashboardBuilderDashboard,
  favoriteDashboardBuilderDashboard,
  getDashboardBuilderDashboard,
  listDashboardBuilderDashboards,
  publishDashboardBuilderDashboard,
  saveDashboardBuilderDashboard,
} from './dashboardApi';
import { useEdgeIdentity } from '../../shared/session/identity';
import type {
  DashboardAccess,
  DashboardDetail,
  DashboardLayoutItem,
  DashboardSummary,
  DashboardTemplateItem,
  PaletteTab,
} from './dashboardTypes';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function reorder<T>(items: T[], itemId: string, direction: 'up' | 'down') {
  const index = items.findIndex((item) => item === itemId);
  if (index === -1) {
    return items;
  }
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) {
    return items;
  }
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function dashboardPayload(draft: DashboardDetail) {
  return {
    title: draft.title,
    access: draft.access,
    groups: draft.groups,
    items: draft.items,
    layout: draft.layout,
  };
}

function normalizeDraft(detail: DashboardDetail): DashboardDetail {
  const itemIds = new Set(detail.items.map((item) => item.instanceId));
  const left = detail.layout.left.filter((id) => itemIds.has(id));
  const right = detail.layout.right.filter((id) => itemIds.has(id));
  for (const item of detail.items) {
    if (item.column === 'left' && !left.includes(item.instanceId)) {
      left.push(item.instanceId);
    }
    if (item.column === 'right' && !right.includes(item.instanceId)) {
      right.push(item.instanceId);
    }
  }
  return {
    ...detail,
    layout: { left, right },
  };
}

const paletteTabs: PaletteTab[] = ['Widgets', 'Reports', 'By Module'];

export function DashboardBuilderWorkspace() {
  const { identity } = useEdgeIdentity();
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [availableItems, setAvailableItems] = useState<DashboardTemplateItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DashboardDetail | null>(null);
  const [draft, setDraft] = useState<DashboardDetail | null>(null);
  const [search, setSearch] = useState('');
  const [paletteSearch, setPaletteSearch] = useState('');
  const [paletteTab, setPaletteTab] = useState<PaletteTab>('Widgets');
  const [newTitle, setNewTitle] = useState('');
  const [newAccess, setNewAccess] = useState<DashboardAccess>('Public');
  const [newGroups, setNewGroups] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadDashboards() {
    try {
      setLoading(true);
      setError(null);
      const next = await listDashboardBuilderDashboards();
      setDashboards(next.dashboards);
      setAvailableItems(next.availableItems);
      setSelectedId((current) => current ?? next.dashboards[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Dashboard Builder library.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(dashboardId: string) {
    try {
      setDetailLoading(true);
      setError(null);
      const next = normalizeDraft(await getDashboardBuilderDashboard(dashboardId));
      setDetail(next);
      setDraft(clone(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Dashboard Builder detail.');
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboards();
  }, [identity.tenantId, identity.userId]);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    }
  }, [selectedId]);

  const hasUnsavedChanges = useMemo(() => {
    if (!detail || !draft) {
      return false;
    }
    return JSON.stringify(dashboardPayload(detail)) !== JSON.stringify(dashboardPayload(draft));
  }, [detail, draft]);

  const metrics = useMemo(() => {
    return [
      {
        label: 'Dashboards',
        value: dashboards.length,
        detail: 'Canonical dashboard definitions available in this tenant.',
      },
      {
        label: 'Published',
        value: dashboards.filter((dashboard) => dashboard.published).length,
        detail: 'Dashboards currently marked ready for wider consumption.',
      },
      {
        label: 'Favorites',
        value: dashboards.filter((dashboard) => dashboard.favorite).length,
        detail: 'Curated boards highlighted for fast operator access.',
      },
      {
        label: 'Tiles',
        value: draft?.items.length ?? 0,
        detail: 'Widgets and embedded reports currently in the active canvas.',
      },
    ];
  }, [dashboards, draft]);

  const filteredDashboards = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return dashboards;
    }
    return dashboards.filter((dashboard) =>
      [dashboard.title, dashboard.access, dashboard.groups.join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [dashboards, search]);

  const currentPalette = useMemo(() => {
    const source = draft?.availableItems ?? availableItems;
    const query = paletteSearch.trim().toLowerCase();
    return source.filter((item) => {
      if (item.tab !== paletteTab) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [item.title, item.type, item.description, item.sourceLabel]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [availableItems, draft?.availableItems, paletteSearch, paletteTab]);

  const leftColumnItems = useMemo(() => {
    if (!draft) {
      return [];
    }
    return draft.layout.left
      .map((instanceId) => draft.items.find((item) => item.instanceId === instanceId))
      .filter((item): item is DashboardLayoutItem => Boolean(item));
  }, [draft]);

  const rightColumnItems = useMemo(() => {
    if (!draft) {
      return [];
    }
    return draft.layout.right
      .map((instanceId) => draft.items.find((item) => item.instanceId === instanceId))
      .filter((item): item is DashboardLayoutItem => Boolean(item));
  }, [draft]);

  const canvasColumns = useMemo(
    () => [
      { id: 'left' as const, title: 'left', items: leftColumnItems },
      { id: 'right' as const, title: 'right', items: rightColumnItems },
    ],
    [leftColumnItems, rightColumnItems],
  );

  async function handleCreateDashboard() {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const created = await createDashboardBuilderDashboard({
        title: newTitle || undefined,
        access: newAccess,
        groups: newGroups
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      });
      setNewTitle('');
      setNewAccess('Public');
      setNewGroups('');
      await loadDashboards();
      setSelectedId(created.id);
      setNotice('New dashboard created in the canonical Dashboard Builder service.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create dashboard.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!draft) {
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const saved = normalizeDraft(await saveDashboardBuilderDashboard(draft.id, dashboardPayload(draft)));
      setDetail(saved);
      setDraft(clone(saved));
      await loadDashboards();
      setNotice('Dashboard layout saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save dashboard layout.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!draft) {
      return;
    }
    const confirmation = window.prompt(`Type "${draft.title}" to confirm delete.`);
    if (confirmation !== draft.title) {
      setNotice('Delete cancelled.');
      return;
    }
    try {
      setBusyAction('delete');
      setError(null);
      setNotice(null);
      await deleteDashboardBuilderDashboard(draft.id);
      setSelectedId(null);
      setDetail(null);
      setDraft(null);
      await loadDashboards();
      setNotice('Dashboard deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete dashboard.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleFavorite() {
    if (!draft) {
      return;
    }
    try {
      setBusyAction('favorite');
      setError(null);
      setNotice(null);
      const updated = normalizeDraft(await favoriteDashboardBuilderDashboard(draft.id));
      setDetail(updated);
      setDraft(clone(updated));
      await loadDashboards();
      setNotice(updated.favorite ? 'Dashboard marked as favorite.' : 'Dashboard removed from favorites.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to toggle dashboard favorite status.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePublish() {
    if (!draft) {
      return;
    }
    try {
      setBusyAction('publish');
      setError(null);
      setNotice(null);
      const updated = normalizeDraft(await publishDashboardBuilderDashboard(draft.id));
      setDetail(updated);
      setDraft(clone(updated));
      await loadDashboards();
      setNotice('Dashboard published.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish dashboard.');
    } finally {
      setBusyAction(null);
    }
  }

  function updateDraft(patch: Partial<DashboardDetail>) {
    setDraft((current) => (current ? normalizeDraft({ ...current, ...patch }) : current));
  }

  function addPaletteItem(item: DashboardTemplateItem) {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const instanceId = crypto.randomUUID();
      const added: DashboardLayoutItem = {
        ...item,
        instanceId,
        column: item.defaultColumn,
      };
      return normalizeDraft({
        ...current,
        items: [...current.items, added],
        layout: {
          ...current.layout,
          [item.defaultColumn]: [...current.layout[item.defaultColumn], instanceId],
        },
      });
    });
  }

  function removeItem(instanceId: string) {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return normalizeDraft({
        ...current,
        items: current.items.filter((item) => item.instanceId !== instanceId),
        layout: {
          left: current.layout.left.filter((id) => id !== instanceId),
          right: current.layout.right.filter((id) => id !== instanceId),
        },
      });
    });
  }

  function moveItem(instanceId: string, direction: 'up' | 'down') {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const item = current.items.find((entry) => entry.instanceId === instanceId);
      if (!item) {
        return current;
      }
      const column = item.column;
      return normalizeDraft({
        ...current,
        layout: {
          ...current.layout,
          [column]: reorder(current.layout[column], instanceId, direction),
        },
      });
    });
  }

  function flipColumn(instanceId: string) {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const item = current.items.find((entry) => entry.instanceId === instanceId);
      if (!item) {
        return current;
      }
      const from = item.column;
      const to = from === 'left' ? 'right' : 'left';
      return normalizeDraft({
        ...current,
        items: current.items.map((entry) =>
          entry.instanceId === instanceId ? { ...entry, column: to } : entry,
        ),
        layout: {
          ...current.layout,
          [from]: current.layout[from].filter((id) => id !== instanceId),
          [to]: [...current.layout[to], instanceId],
        },
      });
    });
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading Dashboard Builder...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Builders</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">Dashboard Builder</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Assemble executive, operational, and module-specific dashboards with real Report
              Builder embeds and reusable widget tiles stored in the canonical Cloudflare runtime.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-secondary" onClick={() => void handleFavorite()} type="button">
              <Star className="mr-2 h-4 w-4" />
              {busyAction === 'favorite' ? 'Updating...' : draft?.favorite ? 'Unfavorite' : 'Favorite'}
            </button>
            <button className="button-secondary" onClick={() => void handlePublish()} type="button">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              {busyAction === 'publish' ? 'Publishing...' : draft?.published ? 'Published' : 'Publish'}
            </button>
            <button className="button-primary" disabled={saving} onClick={() => void handleSave()} type="button">
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Layout'}
            </button>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div className="metric-card" key={metric.label}>
            <div className="metric-label">{metric.label}</div>
            <div className="metric-value">{metric.value}</div>
            <div className="mt-2 text-xs text-slate-500">{metric.detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="panel space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Dashboard Library</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Canvases</h2>
            </div>
            <LayoutDashboard className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
            <input
              className="input pl-10"
              placeholder="Search dashboards"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateDashboard();
            }}
          >
            <input
              className="input"
              placeholder="New dashboard title"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
            />
            <select className="input" value={newAccess} onChange={(event) => setNewAccess(event.target.value as DashboardAccess)}>
              <option value="Public">Public</option>
              <option value="Private">Private</option>
            </select>
            {newAccess === 'Private' && (
              <input
                className="input"
                placeholder="Audit Team, FedRAMP PMO"
                value={newGroups}
                onChange={(event) => setNewGroups(event.target.value)}
              />
            )}
            <button className="button-secondary w-full" disabled={saving} type="submit">
              <Plus className="mr-2 h-4 w-4" />
              Create New Dashboard
            </button>
          </form>
          <div className="space-y-3">
            {filteredDashboards.map((dashboard) => (
              <button
                key={dashboard.id}
                className={`panel-subtle w-full text-left transition ${
                  selectedId === dashboard.id ? 'border-cyan-300/30 bg-cyan-400/[0.04]' : 'hover:border-cyan-300/20'
                }`}
                onClick={() => setSelectedId(dashboard.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{dashboard.title}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {dashboard.access} · {dashboard.itemCount} tiles
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {dashboard.favorite && <span className="badge-success">Favorite</span>}
                    <span className={dashboard.published ? 'badge-success' : 'badge-neutral'}>
                      {dashboard.published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </div>
                {dashboard.groups.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {dashboard.groups.map((group) => (
                      <span className="badge-neutral" key={group}>
                        {group}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 text-xs text-slate-500">Updated {formatDate(dashboard.lastUpdated)}</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel">
          {detailLoading || !draft ? (
            <div className="text-sm text-slate-300">Loading dashboard definition...</div>
          ) : (
            <div className="space-y-6">
              <div className="panel-subtle">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="eyebrow">Dashboard Summary</div>
                    <h3 className="mt-2 text-xl font-semibold text-white">{draft.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="badge-neutral">{draft.access}</span>
                      <span className={draft.published ? 'badge-success' : 'badge-neutral'}>
                        {draft.published ? 'Published' : 'Draft'}
                      </span>
                      {draft.favorite && <span className="badge-success">Favorite</span>}
                      {hasUnsavedChanges && <span className="badge-neutral">Unsaved changes</span>}
                    </div>
                  </div>
                  <button className="button-secondary" onClick={() => void handleDelete()} type="button">
                    <Trash2 className="mr-2 h-4 w-4" />
                    {busyAction === 'delete' ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
                <div className="space-y-6">
                  <div className="panel-subtle">
                    <div className="eyebrow">Settings</div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-medium text-slate-200">Title</span>
                        <input
                          className="input"
                          value={draft.title}
                          onChange={(event) => updateDraft({ title: event.target.value })}
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-200">Access</span>
                        <select
                          className="input"
                          value={draft.access}
                          onChange={(event) => updateDraft({ access: event.target.value as DashboardAccess })}
                        >
                          <option value="Public">Public</option>
                          <option value="Private">Private</option>
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-200">Groups</span>
                        <input
                          className="input"
                          value={draft.groups.join(', ')}
                          onChange={(event) =>
                            updateDraft({
                              groups: event.target.value
                                .split(',')
                                .map((value) => value.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="Audit Team, FedRAMP PMO"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="panel-subtle">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="eyebrow">Canvas</div>
                        <p className="mt-2 text-sm text-slate-400">
                          Arrange tiles across left and right columns. Items can be moved between columns and reordered before saving.
                        </p>
                      </div>
                      <span className="badge-neutral">{draft.items.length} active tiles</span>
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      {canvasColumns.map((column) => (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4" key={column.id}>
                          <div className="text-sm font-medium capitalize text-slate-200">{column.title} column</div>
                          <div className="mt-4 space-y-3">
                            {column.items.map((item) => (
                              <div className="rounded-2xl border border-white/10 bg-black/20 p-4" key={item.instanceId}>
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="flex flex-wrap gap-2">
                                      <span className="badge-neutral">{item.type}</span>
                                      <span className="badge-neutral">{item.sourceLabel}</span>
                                    </div>
                                    <div className="mt-2 text-sm font-medium text-white">{item.title}</div>
                                    <div className="mt-2 text-sm text-slate-400">{item.description}</div>
                                  </div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <button className="button-secondary" onClick={() => moveItem(item.instanceId, 'up')} type="button">
                                    <ArrowUp className="mr-2 h-4 w-4" />
                                    Up
                                  </button>
                                  <button className="button-secondary" onClick={() => moveItem(item.instanceId, 'down')} type="button">
                                    <ArrowDown className="mr-2 h-4 w-4" />
                                    Down
                                  </button>
                                  <button className="button-secondary" onClick={() => flipColumn(item.instanceId)} type="button">
                                    <ArrowLeftRight className="mr-2 h-4 w-4" />
                                    Move
                                  </button>
                                  <button className="button-secondary" onClick={() => removeItem(item.instanceId)} type="button">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                            {column.items.length === 0 && (
                              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
                                No tiles in the {column.title} column yet.
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="panel-subtle">
                    <div className="eyebrow">Palette</div>
                    <p className="mt-2 text-sm text-slate-400">
                      Add widgets or embedded Report Builder outputs to the current dashboard.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {paletteTabs.map((tab) => (
                        <button
                          className={paletteTab === tab ? 'badge-success' : 'badge-neutral'}
                          key={tab}
                          onClick={() => setPaletteTab(tab)}
                          type="button"
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                    <div className="relative mt-4">
                      <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                      <input
                        className="input pl-10"
                        placeholder="Search palette"
                        value={paletteSearch}
                        onChange={(event) => setPaletteSearch(event.target.value)}
                      />
                    </div>
                    <div className="mt-4 space-y-3">
                      {currentPalette.map((item) => (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4" key={item.templateId}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap gap-2">
                                <span className="badge-neutral">{item.type}</span>
                                <span className="badge-neutral">{item.sourceLabel}</span>
                              </div>
                              <div className="mt-2 text-sm font-medium text-white">{item.title}</div>
                              <div className="mt-2 text-sm text-slate-400">{item.description}</div>
                            </div>
                            <button className="button-secondary" onClick={() => addPaletteItem(item)} type="button">
                              <Plus className="mr-2 h-4 w-4" />
                              Add
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
