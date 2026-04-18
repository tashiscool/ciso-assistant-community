import { useEffect, useState } from 'react';
import { AtSign, Mail, Send, ShieldCheck } from 'lucide-react';
import { getSetupEmail, updateSetupEmail } from './api';
import type { SetupEmailSnapshot } from './types';

const deliveryModes = ['Disabled', 'Mailchannels', 'Webhook'];
const statusOptions = ['Review', 'Configured', 'Validated', 'Live'];

export function EmailPage() {
  const [snapshot, setSnapshot] = useState<SetupEmailSnapshot | null>(null);
  const [supportEmail, setSupportEmail] = useState('');
  const [deliveryMode, setDeliveryMode] = useState(deliveryModes[0]);
  const [status, setStatus] = useState(statusOptions[0]);
  const [statusNote, setStatusNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function hydrate(next: SetupEmailSnapshot) {
    setSnapshot(next);
    setSupportEmail(next.config.supportEmail);
    setDeliveryMode(next.config.deliveryMode);
    setStatus(next.config.status);
    setStatusNote(next.config.statusNote);
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);
      hydrate(await getSetupEmail());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load email setup.');
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
      const next = await updateSetupEmail({
        supportEmail,
        deliveryMode,
        status,
        statusNote,
      });
      hydrate(next);
      setNotice('Email configuration notes saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save email configuration.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading email configuration...</div>;
  }

  if (error && !snapshot) {
    return <div className="notice-error">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <div className="eyebrow">Setup</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Email</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Review the runtime delivery provider, sender identity, and recent notification health before enabling live
            customer-facing email on Regovise.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="metric-card">
            <div className="metric-label">Provider</div>
            <div className="metric-value">{snapshot?.metrics.provider ?? 'none'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Sending enabled</div>
            <div className="metric-value">{snapshot?.metrics.sendingEnabled ? 'Yes' : 'No'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Delivery events</div>
            <div className="metric-value">{snapshot?.metrics.totalEvents ?? 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Failed events</div>
            <div className="metric-value">{snapshot?.metrics.failedEvents ?? 0}</div>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="panel">
          <div className="eyebrow">Delivery configuration</div>
          <div className="mt-4 grid gap-4">
            <label className="space-y-1">
              <span className="label">Support email</span>
              <input
                className="input"
                onChange={(event) => setSupportEmail(event.target.value)}
                placeholder="support@regovise.com"
                value={supportEmail}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label">Delivery mode</span>
                <select className="input" onChange={(event) => setDeliveryMode(event.target.value)} value={deliveryMode}>
                  {deliveryModes.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="label">Status</span>
                <select className="input" onChange={(event) => setStatus(event.target.value)} value={status}>
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="space-y-1">
              <span className="label">Operator note</span>
              <textarea
                className="input min-h-32 resize-y"
                onChange={(event) => setStatusNote(event.target.value)}
                placeholder="Record sender verification, rollout notes, or provider caveats..."
                value={statusNote}
              />
            </label>
            <button className="button-primary" disabled={saving} onClick={() => void handleSave()} type="button">
              <Send className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save email setup'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Runtime sender identity</h2>
            </div>
            <div className="mt-5 grid gap-3">
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="label">From</div>
                <div className="mt-2 text-sm text-slate-300">{snapshot?.config.fromName} &lt;{snapshot?.config.fromEmail || 'unset'}&gt;</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="label">DKIM</div>
                <div className="mt-2 text-sm text-slate-300">
                  {snapshot?.config.dkimSelector || 'unset'} {snapshot?.config.dkimDomain ? `@ ${snapshot.config.dkimDomain}` : ''}
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                <div className="label">Provider readiness</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={snapshot?.config.webhookConfigured ? 'badge-positive' : 'badge-neutral'}>
                    Webhook {snapshot?.config.webhookConfigured ? 'Ready' : 'Pending'}
                  </span>
                  <span className={snapshot?.config.mailchannelsConfigured ? 'badge-positive' : 'badge-neutral'}>
                    Mailchannels {snapshot?.config.mailchannelsConfigured ? 'Ready' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <AtSign className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Recent delivery events</h2>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot?.recentEvents.length ? (
                snapshot.recentEvents.map((event) => (
                  <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4" key={`${event.eventType}:${event.timestamp}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-white">{event.eventType}</div>
                      <span className={event.status === 'sent' ? 'badge-positive' : 'badge-neutral'}>{event.status}</span>
                    </div>
                    <div className="mt-2 text-sm text-slate-400">
                      {event.provider} · {new Date(event.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-400">
                  No delivery events recorded yet for this local workspace.
                </div>
              )}
            </div>
          </section>

          <section className="panel-subtle">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-semibold text-white">Guidance</h2>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot?.guidance.map((item) => (
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
