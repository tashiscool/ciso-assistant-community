import { useEffect, useMemo, useState } from 'react';
import { Download, Edit3, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import {
  createSetupClassification,
  deleteSetupClassification,
  getSetupClassification,
  updateSetupClassification,
} from './api';
import type { SetupClassificationRecord, SetupClassificationSnapshot } from './types';

const defaultDraft = {
  title: '',
  confidentiality: 'Moderate',
  integrity: 'Moderate',
  availability: 'Moderate',
};

function exportCsv(records: SetupClassificationRecord[]) {
  const rows = [
    ['Title', 'Confidentiality', 'Integrity', 'Availability'],
    ...records.map((record) => [record.title, record.confidentiality, record.integrity, record.availability]),
  ];
  const csv = rows
    .map((row) => row.map((value) => `"${value.split('"').join('""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'regovise-classifications.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ClassificationPage() {
  const [snapshot, setSnapshot] = useState<SetupClassificationSnapshot | null>(null);
  const [draft, setDraft] = useState(defaultDraft);
  const [editing, setEditing] = useState<SetupClassificationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setSnapshot(await getSetupClassification());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load classifications.');
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
      const next = editing
        ? await updateSetupClassification(editing.id, draft)
        : await createSetupClassification(draft);
      setSnapshot(next);
      setDraft(defaultDraft);
      setEditing(null);
      setNotice(editing ? 'Classification updated.' : 'Classification created.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save classification.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(record: SetupClassificationRecord) {
    try {
      setError(null);
      setNotice(null);
      const next = await deleteSetupClassification(record.id);
      setSnapshot(next);
      if (editing?.id === record.id) {
        setEditing(null);
        setDraft(defaultDraft);
      }
      setNotice('Classification removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete classification.');
    }
  }

  const highestProfiles = useMemo(
    () =>
      snapshot?.records.filter((record) =>
        [record.confidentiality, record.integrity, record.availability].includes('High'),
      ) ?? [],
    [snapshot],
  );

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading classifications...</div>;
  }

  if (error && !snapshot) {
    return <div className="notice-error">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <div className="eyebrow">Setup</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Classification</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Maintain tenant impact profiles that drive downstream system categorization, export posture, and review
            expectations across the canonical stack.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="metric-card">
            <div className="metric-label">Profiles</div>
            <div className="metric-value">{snapshot?.metrics.totalProfiles ?? 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">High impact</div>
            <div className="metric-value">{snapshot?.metrics.highImpact ?? 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Moderate impact</div>
            <div className="metric-value">{snapshot?.metrics.moderateImpact ?? 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Low impact</div>
            <div className="metric-value">{snapshot?.metrics.lowImpact ?? 0}</div>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          <section className="panel">
            <div className="eyebrow">{editing ? 'Edit Classification' : 'New Classification'}</div>
            <div className="mt-4 grid gap-4">
              <label className="space-y-1">
                <span className="label">Title</span>
                <input
                  className="input"
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Moderate SaaS Workspace"
                  value={draft.title}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                {(['confidentiality', 'integrity', 'availability'] as const).map((field) => (
                  <label className="space-y-1" key={field}>
                    <span className="label">{field[0].toUpperCase() + field.slice(1)}</span>
                    <select
                      className="input"
                      onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
                      value={draft[field]}
                    >
                      <option value="Low">Low</option>
                      <option value="Moderate">Moderate</option>
                      <option value="High">High</option>
                    </select>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="button-primary" disabled={saving} onClick={() => void handleSubmit()} type="button">
                  <Plus className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : editing ? 'Save Classification' : 'Create Classification'}
                </button>
                {editing && (
                  <button
                    className="button-secondary"
                    onClick={() => {
                      setEditing(null);
                      setDraft(defaultDraft);
                      setNotice(null);
                    }}
                    type="button"
                  >
                    Cancel edit
                  </button>
                )}
                <button
                  className="button-secondary"
                  onClick={() => snapshot && exportCsv(snapshot.records)}
                  type="button"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </button>
              </div>
            </div>
          </section>

          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Coverage by level</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {snapshot?.coverage.map((item) => (
                <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/30 p-4" key={item.level}>
                  <div className="text-sm text-slate-300">{item.level}</div>
                  <span className="badge-neutral">{item.count}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="panel overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div>
              <div className="eyebrow">Classification Catalog</div>
              <p className="mt-1 text-sm text-slate-400">Persisted tenant impact profiles used by system and export workflows.</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="divide-y divide-white/6">
            {snapshot?.records.map((record) => (
              <div className="px-6 py-4" key={record.id}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="font-medium text-white">{record.title}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="badge-neutral">C {record.confidentiality}</span>
                      <span className="badge-neutral">I {record.integrity}</span>
                      <span className="badge-neutral">A {record.availability}</span>
                      <span className="badge-neutral">Usage {record.usageCount}</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Updated {new Date(record.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="button-secondary"
                      onClick={() => {
                        setEditing(record);
                        setDraft({
                          title: record.title,
                          confidentiality: record.confidentiality,
                          integrity: record.integrity,
                          availability: record.availability,
                        });
                      }}
                      type="button"
                    >
                      <Edit3 className="mr-2 h-4 w-4" />
                      Edit
                    </button>
                    <button className="button-secondary" onClick={() => void handleDelete(record)} type="button">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {highestProfiles.length > 0 && (
            <div className="border-t border-white/10 px-6 py-4 text-sm text-slate-400">
              Highest-impact profiles: {highestProfiles.map((item) => item.title).join(', ')}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
