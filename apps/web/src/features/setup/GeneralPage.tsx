import { useEffect, useState } from 'react';
import { Building2, CalendarDays, Clock3, Globe2, Save, Users } from 'lucide-react';
import { getSetupGeneral, updateSetupGeneral } from './api';
import type { SetupGeneralSnapshot } from './types';

const weekdayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const fiscalMonthOptions = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const defaultDraft = {
  organizationName: '',
  workspaceLabel: '',
  timezone: 'America/New_York',
  locale: 'en-US',
  dateFormat: 'MMM d, yyyy',
  fiscalYearStartMonth: 'January',
  defaultDueTime: '17:00',
  defaultReviewerTeam: '',
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  changeFreezeEnabled: false,
  changeFreezeWindow: '',
};

function toggleDay(days: string[], day: string) {
  return days.includes(day) ? days.filter((item) => item !== day) : [...days, day];
}

export function GeneralPage() {
  const [snapshot, setSnapshot] = useState<SetupGeneralSnapshot | null>(null);
  const [draft, setDraft] = useState(defaultDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function hydrate(next: SetupGeneralSnapshot) {
    setSnapshot(next);
    setDraft({
      organizationName: next.config.organizationName,
      workspaceLabel: next.config.workspaceLabel,
      timezone: next.config.timezone,
      locale: next.config.locale,
      dateFormat: next.config.dateFormat,
      fiscalYearStartMonth: next.config.fiscalYearStartMonth,
      defaultDueTime: next.config.defaultDueTime,
      defaultReviewerTeam: next.config.defaultReviewerTeam,
      workingDays: next.config.workingDays,
      changeFreezeEnabled: next.config.changeFreezeEnabled,
      changeFreezeWindow: next.config.changeFreezeWindow,
    });
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);
      hydrate(await getSetupGeneral());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load general settings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const next = await updateSetupGeneral(draft);
      hydrate(next);
      setNotice('General tenant settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save general settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading general settings...</div>;
  }

  if (error && !snapshot) {
    return <div className="notice-error">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <div className="eyebrow">Setup</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">General</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Set tenant operating defaults for organization identity, calendar cadence, reviewer routing, and runtime
            presentation so downstream workflows inherit consistent behavior.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="metric-card">
            <div className="metric-label">Working days</div>
            <div className="metric-value">{snapshot?.metrics.workingDays ?? 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Change freeze</div>
            <div className="metric-value">{snapshot?.metrics.changeFreezeEnabled ? 'On' : 'Off'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Reviewer team</div>
            <div className="metric-value">{snapshot?.metrics.reviewerTeamConfigured ? 'Ready' : 'Missing'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Locale</div>
            <div className="metric-value">{snapshot?.metrics.locale ?? 'en-US'}</div>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="panel">
          <div className="eyebrow">Operating Defaults</div>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label">Organization name</span>
                <input className="input" value={draft.organizationName} onChange={(e) => setDraft((c) => ({ ...c, organizationName: e.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className="label">Workspace label</span>
                <input className="input" value={draft.workspaceLabel} onChange={(e) => setDraft((c) => ({ ...c, workspaceLabel: e.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className="label">Timezone</span>
                <input className="input" value={draft.timezone} onChange={(e) => setDraft((c) => ({ ...c, timezone: e.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className="label">Locale</span>
                <input className="input" value={draft.locale} onChange={(e) => setDraft((c) => ({ ...c, locale: e.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className="label">Date format</span>
                <input className="input" value={draft.dateFormat} onChange={(e) => setDraft((c) => ({ ...c, dateFormat: e.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className="label">Fiscal year start</span>
                <select className="input" value={draft.fiscalYearStartMonth} onChange={(e) => setDraft((c) => ({ ...c, fiscalYearStartMonth: e.target.value }))}>
                  {fiscalMonthOptions.map((month) => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Default due time</span>
                <input className="input" type="time" value={draft.defaultDueTime} onChange={(e) => setDraft((c) => ({ ...c, defaultDueTime: e.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className="label">Default reviewer team</span>
                <input className="input" value={draft.defaultReviewerTeam} onChange={(e) => setDraft((c) => ({ ...c, defaultReviewerTeam: e.target.value }))} />
              </label>
            </div>

            <div className="space-y-2">
              <span className="label">Working days</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {weekdayOptions.map((day) => (
                  <label className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-3" key={day}>
                    <input
                      checked={draft.workingDays.includes(day)}
                      className="mt-1 h-4 w-4 rounded border-white/15 bg-slate-950 text-cyan-400"
                      onChange={() => setDraft((current) => ({ ...current, workingDays: toggleDay(current.workingDays, day) }))}
                      type="checkbox"
                    />
                    <div className="text-sm text-white">{day}</div>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <input
                checked={draft.changeFreezeEnabled}
                className="mt-1 h-4 w-4 rounded border-white/15 bg-slate-950 text-cyan-400"
                onChange={() => setDraft((current) => ({ ...current, changeFreezeEnabled: !current.changeFreezeEnabled }))}
                type="checkbox"
              />
              <div>
                <div className="font-medium text-white">Enable change freeze guidance</div>
                <div className="mt-2 text-sm text-slate-400">Show advisory windows for sensitive admin and workflow changes.</div>
              </div>
            </label>

            <label className="space-y-1">
              <span className="label">Change freeze window</span>
              <input className="input" value={draft.changeFreezeWindow} onChange={(e) => setDraft((c) => ({ ...c, changeFreezeWindow: e.target.value }))} />
            </label>

            <button className="button-primary" disabled={saving} onClick={() => void handleSave()} type="button">
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save general settings'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Operating defaults</h2>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot?.records.operatingDefaults.map((item) => (
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4" key={item.label}>
                  <div className="font-medium text-white">{item.label}</div>
                  <div className="mt-2 text-sm text-slate-300">{item.value}</div>
                  <div className="mt-2 text-xs text-slate-500">{item.hint}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Coordination signals</h2>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot?.records.coordinationSignals.map((item) => (
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4" key={item.title}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{item.title}</div>
                    <span className={item.status === 'Healthy' || item.status === 'Configured' || item.status === 'Enabled' ? 'badge-positive' : 'badge-neutral'}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">{item.detail}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Downstream effects</h2>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot?.records.downstreamEffects.map((item) => (
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-300" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
