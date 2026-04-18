import { useEffect, useState } from 'react';
import { Edit3, Plus, Tags, Trash2 } from 'lucide-react';
import { createSetupTag, deleteSetupTag, getSetupTags, updateSetupTag } from './api';
import type { SetupTagRecord, SetupTagsSnapshot } from './types';

const emptyDraft = {
  title: '',
  type: 'User' as 'User' | 'System',
  oscalRequired: false,
};

export function TagsPage() {
  const [snapshot, setSnapshot] = useState<SetupTagsSnapshot | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [editing, setEditing] = useState<SetupTagRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setSnapshot(await getSetupTags());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load setup tags.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSubmit() {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      const nextSnapshot = editing
        ? await updateSetupTag(editing.id, draft)
        : await createSetupTag(draft);

      setSnapshot(nextSnapshot);
      setDraft(emptyDraft);
      setEditing(null);
      setNotice(editing ? 'Tag updated in the canonical setup service.' : 'Tag created in the canonical setup service.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save tag.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tagId: string) {
    try {
      setError(null);
      setNotice(null);
      setSnapshot(await deleteSetupTag(tagId));
      if (editing?.id === tagId) {
        setDraft(emptyDraft);
        setEditing(null);
      }
      setNotice('Tag removed from tenant setup.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete tag.');
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading tag setup...</div>;
  }

  if (error && !snapshot) {
    return <div className="notice-error">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="eyebrow">Setup</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Tags</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Define reusable tenant tags for evidence, exports, OSCAL packaging, and workflow classification from the
            canonical Cloudflare setup service.
          </p>
        </div>
        <div className="panel-subtle space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="metric-card">
              <div className="metric-label">Total tags</div>
              <div className="metric-value">{snapshot?.metrics.totalTags ?? 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">System tags</div>
              <div className="metric-value">{snapshot?.metrics.systemTags ?? 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">OSCAL required</div>
              <div className="metric-value">{snapshot?.metrics.oscalRequired ?? 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Usage count</div>
              <div className="metric-value">{snapshot?.metrics.totalUsage ?? 0}</div>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-300">
            System tags preserve structured export semantics. User tags stay flexible for evidence, assignment, and
            workflow context.
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="panel">
          <div className="eyebrow">{editing ? 'Edit Tag' : 'New Tag'}</div>
          <div className="mt-4 grid gap-4">
            <label className="space-y-1">
              <span className="label">Title</span>
              <input
                className="input"
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Assessment Evidence"
                value={draft.title}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label">Type</span>
                <select
                  className="input"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, type: event.target.value === 'System' ? 'System' : 'User' }))
                  }
                  value={draft.type}
                >
                  <option value="User">User</option>
                  <option value="System">System</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">OSCAL required</span>
                <select
                  className="input"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, oscalRequired: event.target.value === 'true' }))
                  }
                  value={draft.oscalRequired ? 'true' : 'false'}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="button-primary" disabled={saving} onClick={() => void handleSubmit()} type="button">
                <Plus className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : editing ? 'Save Tag' : 'Create Tag'}
              </button>
              {editing && (
                <button
                  className="button-secondary"
                  onClick={() => {
                    setEditing(null);
                    setDraft(emptyDraft);
                    setNotice(null);
                  }}
                  type="button"
                >
                  Cancel edit
                </button>
              )}
            </div>
          </div>
        </div>

        <section className="panel overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div>
              <div className="eyebrow">Tag Catalog</div>
              <p className="mt-1 text-sm text-slate-400">Tenant-scoped metadata available to exports, evidence, and automation.</p>
            </div>
            <Tags className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="divide-y divide-white/6">
            {snapshot?.tags.map((tag) => (
              <div className="flex flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center lg:justify-between" key={tag.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium text-white">{tag.title}</div>
                    <span className={tag.type === 'System' ? 'badge-positive' : 'badge-neutral'}>{tag.type}</span>
                    {tag.oscalRequired && <span className="badge-neutral">OSCAL</span>}
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    Usage {tag.usageCount} · Updated {new Date(tag.updatedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="button-secondary"
                    onClick={() => {
                      setEditing(tag);
                      setDraft({
                        title: tag.title,
                        type: tag.type,
                        oscalRequired: tag.oscalRequired,
                      });
                    }}
                    type="button"
                  >
                    <Edit3 className="mr-2 h-4 w-4" />
                    Edit
                  </button>
                  <button className="button-secondary" onClick={() => void handleDelete(tag.id)} type="button">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
