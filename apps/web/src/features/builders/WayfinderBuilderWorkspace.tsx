import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Eye,
  FileJson,
  FolderKanban,
  GripVertical,
  Link2,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  createWayfinderTemplate,
  deleteWayfinderTemplate,
  getWayfinderTemplate,
  importNewWayfinderTemplate,
  importWayfinderTemplate,
  listWayfinderTemplates,
  saveWayfinderTemplate,
} from './wayfinderApi';
import type {
  WayfinderActivity,
  WayfinderDocumentationLink,
  WayfinderStage,
  WayfinderTemplateDetail,
  WayfinderTemplateSummary,
} from './wayfinderTypes';
import { useEdgeIdentity } from '../../shared/session/identity';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function reorder<T>(items: T[], index: number, direction: 'up' | 'down'): T[] {
  const next = [...items];
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) {
    return next;
  }
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function emptyDocumentationLink(index: number): WayfinderDocumentationLink {
  return {
    id: crypto.randomUUID(),
    label: `Documentation ${index}`,
    url: '',
  };
}

function emptyActivity(index: number): WayfinderActivity {
  return {
    id: crypto.randomUUID(),
    title: `Activity ${index}`,
    type: 'Manual Activity',
    description: 'Describe the work needed to complete this step.',
    link: '',
    documentationLinks: [emptyDocumentationLink(1)],
  };
}

function emptyStage(index: number): WayfinderStage {
  return {
    id: crypto.randomUUID(),
    name: `Stage ${index}`,
    description: 'Describe the outcome of this stage.',
    activities: [emptyActivity(1)],
  };
}

const owners = ['Aria Patel', 'Maya Ellison', 'Jon Park', 'Priya Ramesh', 'Regovise Operator'];
const activityTypes = ['Manual Activity', 'Approval Activity', 'Evidence Activity', 'Review Activity'];

function normalizeImportedStages(stages: WayfinderStage[] | undefined): WayfinderStage[] {
  return (stages?.length ? stages : [emptyStage(1)]).map((stage, stageIndex) => ({
    ...stage,
    id: stage.id || crypto.randomUUID(),
    name: stage.name || `Stage ${stageIndex + 1}`,
    description: stage.description ?? '',
    activities: (stage.activities?.length ? stage.activities : [emptyActivity(1)]).map((activity, activityIndex) => {
      const documentationLinks =
        activity.documentationLinks?.length
          ? activity.documentationLinks
          : activity.link
            ? [{ id: crypto.randomUUID(), label: 'Reference Link', url: activity.link }]
            : [emptyDocumentationLink(1)];
      return {
        ...activity,
        id: activity.id || crypto.randomUUID(),
        title: activity.title || `Activity ${activityIndex + 1}`,
        type: activity.type || 'Manual Activity',
        description: activity.description ?? '',
        link: activity.link ?? documentationLinks[0]?.url ?? '',
        documentationLinks,
      };
    }),
  }));
}

export function WayfinderBuilderWorkspace() {
  const { identity } = useEdgeIdentity();
  const [templates, setTemplates] = useState<WayfinderTemplateSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WayfinderTemplateDetail | null>(null);
  const [draft, setDraft] = useState<WayfinderTemplateDetail | null>(null);
  const [search, setSearch] = useState('');
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateOwner, setNewTemplateOwner] = useState('Regovise Operator');
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'selected' | 'new'>('selected');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  async function loadTemplates() {
    try {
      setLoading(true);
      setError(null);
      const next = await listWayfinderTemplates();
      setTemplates(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Wayfinder templates.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(templateId: string) {
    try {
      setDetailLoading(true);
      setError(null);
      const next = await getWayfinderTemplate(templateId);
      setDetail(next);
      setDraft(clone(next));
      setSelectedStageId(next.stages[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Wayfinder template detail.');
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadTemplates();
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
    return JSON.stringify(draft) !== JSON.stringify(detail);
  }, [detail, draft]);

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return templates;
    }
    return templates.filter((template) =>
      [template.title, template.owner, template.creator, template.description ?? '', template.status]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [templates, search]);

  const metrics = useMemo(() => {
    return [
      {
        label: 'Templates',
        value: templates.length,
        detail: 'Canonical guidance workflows available to the tenant.',
      },
      {
        label: 'Stages',
        value: draft?.stages.length ?? 0,
        detail: 'Ordered workflow stages in the selected template.',
      },
      {
        label: 'Activities',
        value: draft?.stages.reduce((total, stage) => total + stage.activities.length, 0) ?? 0,
        detail: 'Nested activities currently defined across stages.',
      },
      {
        label: 'Owner',
        value: draft?.owner ?? '—',
        detail: 'Current template owner for operational accountability.',
      },
    ];
  }, [draft, templates.length]);

  const selectedStage =
    draft?.stages.find((stage) => stage.id === selectedStageId) ?? draft?.stages[0] ?? null;

  async function handleCreateTemplate(input?: { title?: string; owner?: string; description?: string }) {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const created = await createWayfinderTemplate({
        title: input?.title ?? (newTemplateTitle || undefined),
        owner: input?.owner ?? (newTemplateOwner || undefined),
        description: input?.description,
      });
      setNewTemplateTitle('');
      setNewTemplateOwner('Regovise Operator');
      await loadTemplates();
      setSelectedId(created.id);
      setNotice('New Wayfinder template created.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create Wayfinder template.');
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
      const saved = await saveWayfinderTemplate(draft.id, {
        title: draft.title,
        status: draft.status,
        owner: draft.owner,
        description: draft.description,
        stages: draft.stages,
      });
      setDetail(saved);
      setDraft(clone(saved));
      await loadTemplates();
      setNotice('Wayfinder template saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save Wayfinder template.');
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
      await deleteWayfinderTemplate(draft.id);
      setSelectedId(null);
      await loadTemplates();
      setNotice('Wayfinder template deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete Wayfinder template.');
    } finally {
      setBusyAction(null);
    }
  }

  function handleExport() {
    if (!draft) {
      return;
    }
    const blob = new Blob(
      [
        JSON.stringify(
          {
            schemaVersion: 1,
            title: draft.title,
            status: draft.status,
            owner: draft.owner,
            creator: draft.creator,
            description: draft.description,
            stages: draft.stages,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${draft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice('Wayfinder template exported to JSON.');
  }

  async function handleImport(file: File, mode: 'selected' | 'new' = 'selected') {
    if (!draft && mode === 'selected') {
      return;
    }
    try {
      setBusyAction('import');
      setError(null);
      setNotice(null);
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        title?: string;
        status?: WayfinderTemplateDetail['status'];
        owner?: string;
        description?: string | null;
        stages?: WayfinderTemplateDetail['stages'];
      };
      const stages = normalizeImportedStages(parsed.stages);
      const imported =
        mode === 'new'
          ? await importNewWayfinderTemplate({
              title: parsed.title ?? 'Imported Wayfinder Template',
              status: parsed.status ?? 'Draft',
              owner: parsed.owner ?? 'Regovise Operator',
              description: parsed.description ?? 'Imported Wayfinder template.',
              stages,
            })
          : await importWayfinderTemplate(draft!.id, {
              title: parsed.title ?? draft!.title,
              status: parsed.status ?? draft!.status,
              owner: parsed.owner ?? draft!.owner,
              description: parsed.description ?? draft!.description,
              stages,
            });
      setDetail(imported);
      setDraft(clone(imported));
      await loadTemplates();
      setSelectedId(imported.id);
      setNotice(
        mode === 'new'
          ? 'Wayfinder template imported as a new canonical template.'
          : 'Wayfinder template imported into the selected canonical builder template.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import Wayfinder template.');
    } finally {
      setBusyAction(null);
      if (importRef.current) {
        importRef.current.value = '';
      }
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading Wayfinder Builder...</div>;
  }

  return (
    <div className="space-y-6">
      <input
        ref={importRef}
        className="hidden"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleImport(file, importMode);
          }
        }}
      />

      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Builders</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">Wayfinder Builder</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Create and manage step-by-step compliance guides tailored to internal processes
              and regulatory frameworks, with clear stage progression, nested activities,
              and JSON import/export support in the canonical Cloudflare runtime.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to="/builders/wayfinder-builder">
              <Eye className="mr-2 h-4 w-4" />
              Wayfinder Builder
            </Link>
            <button className="button-secondary" onClick={handleExport} type="button">
              <Download className="mr-2 h-4 w-4" />
              Export
            </button>
            <button
              className="button-secondary"
              onClick={() => {
                setImportMode('selected');
                importRef.current?.click();
              }}
              type="button"
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Into Selected
            </button>
            <button
              className="button-secondary"
              onClick={() => {
                setImportMode('new');
                importRef.current?.click();
              }}
              type="button"
            >
              <FileJson className="mr-2 h-4 w-4" />
              Import JSON as New
            </button>
            <button className="button-secondary" onClick={() => void handleDelete()} type="button">
              <Trash2 className="mr-2 h-4 w-4" />
              {busyAction === 'delete' ? 'Deleting...' : 'Delete'}
            </button>
            <button className="button-primary" disabled={saving} onClick={() => void handleSave()} type="button">
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="metric-card">
            <div className="metric-label">{metric.label}</div>
            <div className="metric-value">{metric.value}</div>
            <div className="mt-2 text-xs text-slate-500">{metric.detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="panel space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Template Library</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Wayfinders</h2>
            </div>
            <FolderKanban className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
            <input
              className="input pl-10"
              placeholder="Search templates"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div>
            <label className="label">Template Selector</label>
            <select
              aria-label="Wayfinder template selector"
              className="input mt-2"
              value={selectedId ?? ''}
              onChange={(event) => {
                if (event.target.value === '__new__') {
                  void handleCreateTemplate({
                    title: newTemplateTitle || 'New Wayfinder Template',
                    owner: newTemplateOwner,
                    description: 'New blank Wayfinder template created from the selector.',
                  });
                  return;
                }
                setSelectedId(event.target.value);
              }}
            >
              <option value="" disabled>
                Select a Wayfinder template
              </option>
              <option value="__new__">New blank Wayfinder template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>
          </div>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateTemplate();
            }}
          >
            <input
              className="input"
              placeholder="New template title"
              value={newTemplateTitle}
              onChange={(event) => setNewTemplateTitle(event.target.value)}
            />
            <input
              className="input"
              list="wayfinder-owner-options"
              placeholder="Owner"
              value={newTemplateOwner}
              onChange={(event) => setNewTemplateOwner(event.target.value)}
            />
            <datalist id="wayfinder-owner-options">
              {owners.map((owner) => (
                <option key={owner} value={owner} />
              ))}
            </datalist>
            <button className="button-secondary w-full" disabled={saving} type="submit">
              <Plus className="mr-2 h-4 w-4" />
              New
            </button>
          </form>
          <div className="space-y-3">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className={`panel-subtle w-full text-left transition ${
                  selectedId === template.id ? 'border-cyan-300/30 bg-cyan-400/[0.04]' : 'hover:border-cyan-300/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{template.title}</div>
                    <div className="mt-1 text-xs text-slate-500">ID {template.id}</div>
                    <div className="mt-2 text-sm text-slate-400">
                      Creator {template.creator} · Owner {template.owner}
                    </div>
                  </div>
                  <span className={template.status === 'Active' ? 'badge-success' : 'badge-neutral'}>
                    {template.status}
                  </span>
                </div>
                {template.description && (
                  <div className="mt-3 text-sm leading-6 text-slate-300">{template.description}</div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="badge-neutral">{template.stageCount} stages</span>
                  <span className="badge-neutral">{template.activityCount} activities</span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">Updated {formatDate(template.lastUpdated)}</div>
                  <button className="button-secondary px-3 py-2" onClick={() => setSelectedId(template.id)} type="button">
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="panel">
          {detailLoading || !draft ? (
            <div className="text-sm text-slate-300">Loading wayfinder detail...</div>
          ) : (
            <div className="space-y-6">
              <div className="panel-subtle">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label">Title</label>
                    <input
                      className="input mt-2"
                      value={draft.title}
                      onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select
                      className="input mt-2"
                      value={draft.status}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          status: event.target.value as WayfinderTemplateDetail['status'],
                        })
                      }
                    >
                      <option value="Active">Active</option>
                      <option value="Draft">Draft</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Owner</label>
                    <input
                      className="input mt-2"
                      list="wayfinder-owner-options"
                      value={draft.owner}
                      onChange={(event) => setDraft({ ...draft, owner: event.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Creator</label>
                    <input className="input mt-2" value={draft.creator} disabled />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Description</label>
                    <textarea
                      className="input mt-2 min-h-[92px]"
                      value={draft.description ?? ''}
                      onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="eyebrow">Stage Builder</div>
                      <h3 className="mt-2 text-lg font-semibold text-white">Ordered workflow stages</h3>
                    </div>
                    <button
                      className="button-secondary"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          stages: [...draft.stages, emptyStage(draft.stages.length + 1)],
                        })
                      }
                      type="button"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Stage
                    </button>
                  </div>

                  {draft.stages.map((stage, stageIndex) => (
                    <div key={stage.id} className="panel-subtle">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                          className="flex items-center gap-3 text-left"
                          onClick={() => setSelectedStageId(stage.id)}
                          type="button"
                        >
                          <GripVertical className="h-4 w-4 text-slate-500" />
                          <div>
                            <div className="font-medium text-white">{stage.name}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {stage.activities.length} activities
                            </div>
                          </div>
                        </button>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="button-secondary px-3 py-2"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                stages: reorder(draft.stages, stageIndex, 'up'),
                              })
                            }
                            type="button"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            className="button-secondary px-3 py-2"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                stages: reorder(draft.stages, stageIndex, 'down'),
                              })
                            }
                            type="button"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            className="button-secondary px-3 py-2 text-rose-200"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                stages: draft.stages.filter((entry) => entry.id !== stage.id),
                              })
                            }
                            type="button"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="label">Stage Title</label>
                          <input
                            className="input mt-2"
                            value={stage.name}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                stages: draft.stages.map((entry) =>
                                  entry.id === stage.id ? { ...entry, name: event.target.value } : entry,
                                ),
                              })
                            }
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="label">Description</label>
                          <textarea
                            className="input mt-2 min-h-[88px]"
                            value={stage.description}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                stages: draft.stages.map((entry) =>
                                  entry.id === stage.id ? { ...entry, description: event.target.value } : entry,
                                ),
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="label">Activities</div>
                          <button
                            className="button-secondary"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                stages: draft.stages.map((entry) =>
                                  entry.id === stage.id
                                    ? {
                                        ...entry,
                                        activities: [...entry.activities, emptyActivity(entry.activities.length + 1)],
                                      }
                                    : entry,
                                ),
                              })
                            }
                            type="button"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Activity
                          </button>
                        </div>
                        <div className="space-y-3">
                          {stage.activities.map((activity, activityIndex) => (
                            <div key={activity.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <div className="font-medium text-white">{activity.title}</div>
                                  <div className="mt-1 text-xs text-slate-500">{activity.type}</div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    className="button-secondary px-3 py-2"
                                    onClick={() =>
                                      setDraft({
                                        ...draft,
                                        stages: draft.stages.map((entry) =>
                                          entry.id === stage.id
                                            ? {
                                                ...entry,
                                                activities: reorder(entry.activities, activityIndex, 'up'),
                                              }
                                            : entry,
                                        ),
                                      })
                                    }
                                    type="button"
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                  </button>
                                  <button
                                    className="button-secondary px-3 py-2"
                                    onClick={() =>
                                      setDraft({
                                        ...draft,
                                        stages: draft.stages.map((entry) =>
                                          entry.id === stage.id
                                            ? {
                                                ...entry,
                                                activities: reorder(entry.activities, activityIndex, 'down'),
                                              }
                                            : entry,
                                        ),
                                      })
                                    }
                                    type="button"
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                  </button>
                                  <button
                                    className="button-secondary px-3 py-2 text-rose-200"
                                    onClick={() =>
                                      setDraft({
                                        ...draft,
                                        stages: draft.stages.map((entry) =>
                                          entry.id === stage.id
                                            ? {
                                                ...entry,
                                                activities: entry.activities.filter((item) => item.id !== activity.id),
                                              }
                                            : entry,
                                        ),
                                      })
                                    }
                                    type="button"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>

                              <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div>
                                  <label className="label">Activity Title</label>
                                  <input
                                    className="input mt-2"
                                    value={activity.title}
                                    onChange={(event) =>
                                      setDraft({
                                        ...draft,
                                        stages: draft.stages.map((entry) =>
                                          entry.id === stage.id
                                            ? {
                                                ...entry,
                                                activities: entry.activities.map((item) =>
                                                  item.id === activity.id
                                                    ? { ...item, title: event.target.value }
                                                    : item,
                                                ),
                                              }
                                            : entry,
                                        ),
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <label className="label">Activity Type</label>
                                  <select
                                    className="input mt-2"
                                    value={activity.type}
                                    onChange={(event) =>
                                      setDraft({
                                        ...draft,
                                        stages: draft.stages.map((entry) =>
                                          entry.id === stage.id
                                            ? {
                                                ...entry,
                                                activities: entry.activities.map((item) =>
                                                  item.id === activity.id
                                                    ? { ...item, type: event.target.value }
                                                    : item,
                                                ),
                                              }
                                            : entry,
                                        ),
                                      })
                                    }
                                  >
                                    {activityTypes.map((type) => (
                                      <option key={type} value={type}>
                                        {type}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="md:col-span-2">
                                  <label className="label">Description</label>
                                  <textarea
                                    className="input mt-2 min-h-[88px]"
                                    value={activity.description}
                                    onChange={(event) =>
                                      setDraft({
                                        ...draft,
                                        stages: draft.stages.map((entry) =>
                                          entry.id === stage.id
                                            ? {
                                                ...entry,
                                                activities: entry.activities.map((item) =>
                                                  item.id === activity.id
                                                    ? { ...item, description: event.target.value }
                                                    : item,
                                                ),
                                              }
                                            : entry,
                                        ),
                                      })
                                    }
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <div className="mb-3 flex items-center justify-between gap-3">
                                    <label className="label">Documentation Links</label>
                                    <button
                                      className="button-secondary"
                                      onClick={() =>
                                        setDraft({
                                          ...draft,
                                          stages: draft.stages.map((entry) =>
                                            entry.id === stage.id
                                              ? {
                                                  ...entry,
                                                  activities: entry.activities.map((item) =>
                                                    item.id === activity.id
                                                      ? {
                                                          ...item,
                                                          documentationLinks: [
                                                            ...(item.documentationLinks?.length
                                                              ? item.documentationLinks
                                                              : [emptyDocumentationLink(1)]),
                                                            emptyDocumentationLink((item.documentationLinks?.length ?? 1) + 1),
                                                          ],
                                                        }
                                                      : item,
                                                  ),
                                                }
                                              : entry,
                                          ),
                                        })
                                      }
                                      type="button"
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add Documentation Link
                                    </button>
                                  </div>
                                  <div className="space-y-3">
                                    {(activity.documentationLinks?.length
                                      ? activity.documentationLinks
                                      : [emptyDocumentationLink(1)]
                                    ).map((docLink, docLinkIndex) => (
                                      <div
                                        key={docLink.id}
                                        className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]"
                                      >
                                        <input
                                          className="input"
                                          aria-label="Documentation label"
                                          placeholder="Label"
                                          value={docLink.label}
                                          onChange={(event) =>
                                            setDraft({
                                              ...draft,
                                              stages: draft.stages.map((entry) =>
                                                entry.id === stage.id
                                                  ? {
                                                      ...entry,
                                                      activities: entry.activities.map((item) =>
                                                        item.id === activity.id
                                                          ? {
                                                              ...item,
                                                              documentationLinks: (
                                                                item.documentationLinks?.length
                                                                  ? item.documentationLinks
                                                                  : [docLink]
                                                              ).map((link) =>
                                                                link.id === docLink.id
                                                                  ? { ...link, label: event.target.value }
                                                                  : link,
                                                              ),
                                                            }
                                                          : item,
                                                      ),
                                                    }
                                                  : entry,
                                              ),
                                            })
                                          }
                                        />
                                        <input
                                          className="input"
                                          aria-label="Documentation URL"
                                          placeholder="URL or module path"
                                          value={docLink.url}
                                          onChange={(event) =>
                                            setDraft({
                                              ...draft,
                                              stages: draft.stages.map((entry) =>
                                                entry.id === stage.id
                                                  ? {
                                                      ...entry,
                                                      activities: entry.activities.map((item) =>
                                                        item.id === activity.id
                                                          ? {
                                                              ...item,
                                                              link: docLinkIndex === 0 ? event.target.value : item.link,
                                                              documentationLinks: (
                                                                item.documentationLinks?.length
                                                                  ? item.documentationLinks
                                                                  : [docLink]
                                                              ).map((link) =>
                                                                link.id === docLink.id
                                                                  ? { ...link, url: event.target.value }
                                                                  : link,
                                                              ),
                                                            }
                                                          : item,
                                                      ),
                                                    }
                                                  : entry,
                                              ),
                                            })
                                          }
                                        />
                                        <button
                                          className="button-secondary px-3 py-2 text-rose-200"
                                          onClick={() =>
                                            setDraft({
                                              ...draft,
                                              stages: draft.stages.map((entry) =>
                                                entry.id === stage.id
                                                  ? {
                                                      ...entry,
                                                      activities: entry.activities.map((item) =>
                                                        item.id === activity.id
                                                          ? {
                                                              ...item,
                                                              documentationLinks: (
                                                                item.documentationLinks?.length
                                                                  ? item.documentationLinks
                                                                  : [docLink]
                                                              ).filter((link) => link.id !== docLink.id),
                                                            }
                                                          : item,
                                                      ),
                                                    }
                                                  : entry,
                                              ),
                                            })
                                          }
                                          type="button"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <aside className="space-y-4">
                  <div className="panel-subtle">
                    <div className="eyebrow">Selected Stage</div>
                    {selectedStage ? (
                      <div className="mt-4 space-y-3 text-sm text-slate-300">
                        <div className="font-medium text-white">{selectedStage.name}</div>
                        <div>{selectedStage.description}</div>
                        <div className="flex flex-wrap gap-2">
                          <span className="badge-neutral">{selectedStage.activities.length} activities</span>
                          <span className="badge-neutral">{draft.status}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 text-sm text-slate-400">
                        Select a stage to focus the builder on its activities.
                      </div>
                    )}
                  </div>

                  <div className="panel-subtle">
                    <div className="eyebrow">Suggested Uses</div>
                    <div className="mt-4 space-y-3 text-sm text-slate-300">
                      <div>RMF Authorization Wayfinder</div>
                      <div>FedRAMP Readiness Wayfinder</div>
                      <div>Internal Audit Preparation Wayfinder</div>
                      <div>Annual Security Review Wayfinder</div>
                    </div>
                  </div>

                  <div className="panel-subtle">
                    <div className="eyebrow">Template Notes</div>
                    <div className="mt-4 space-y-3 text-sm text-slate-300">
                      <div>Export JSON for backup or transfer between environments.</div>
                      <div>Import JSON into the same editor surface to continue refining it.</div>
                      <div>Use activity links to route operators into modules, dashboards, or evidence views.</div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          )}
        </section>
      </section>

      {hasUnsavedChanges && (
        <section className="panel sticky bottom-4 border-cyan-300/20 bg-slate-950/85 backdrop-blur-xl">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
              <div>
                <div className="font-medium text-white">Unsaved changes</div>
                <div className="mt-1 text-sm text-slate-300">
                  Saving updates the ordered stage and activity flow for every operator using this template.
                </div>
              </div>
            </div>
            <button className="button-primary" disabled={saving} onClick={() => void handleSave()} type="button">
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
