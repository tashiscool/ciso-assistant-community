import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ShieldCheck, StepForward, TimerReset } from 'lucide-react';
import { advanceRMFPackageHandoff, getRMFControlSnapshot, type RMFControlSnapshot } from './controlApi';

export function RMFControlPage() {
  const [snapshot, setSnapshot] = useState<RMFControlSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const next = await getRMFControlSnapshot();
      setSnapshot(next);
      setSelectedId((current) => current ?? next.packages[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'RMF control room could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedPackage = useMemo(
    () => snapshot?.packages.find((item) => item.id === selectedId) ?? snapshot?.packages[0] ?? null,
    [selectedId, snapshot],
  );

  async function handleAdvance() {
    if (!selectedPackage) {
      return;
    }

    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      const next = await advanceRMFPackageHandoff(selectedPackage.id);
      setSnapshot(next);
      setNotice(`${selectedPackage.name} advanced to the next RMF handoff stage.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to advance RMF handoff.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading RMF...</div>;
  }

  if (error && !snapshot) {
    return <div className="notice-error">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Operations</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">RMF</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Coordinate authorization packages, RMF handoffs, and supporting artifacts from a canonical Worker-backed
              control room.
            </p>
          </div>
          <button className="button-primary" onClick={() => void load()} type="button">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Packages</div>
          <div className="metric-value">{snapshot?.metrics.packages ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">In flight</div>
          <div className="metric-value">{snapshot?.metrics.inFlightSteps ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Blocked items</div>
          <div className="metric-value">{snapshot?.metrics.blockedItems ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Ready for AO</div>
          <div className="metric-value">{snapshot?.metrics.authorizeReady ?? 0}</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="panel-subtle space-y-4">
          <div className="flex items-center gap-2 text-white">
            <ShieldCheck className="h-4 w-4 text-cyan-300" />
            <h2 className="text-lg font-semibold">Authorization packages</h2>
          </div>
          <div className="space-y-3">
            {snapshot?.packages.map((item) => (
              <button
                className={`panel-subtle w-full text-left transition ${selectedPackage?.id === item.id ? 'border-cyan-300/40 bg-cyan-400/[0.04]' : ''}`}
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                type="button"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium text-white">{item.name}</div>
                  <span className="badge-neutral">{item.authorizationStatus}</span>
                  <span className="badge-neutral">{item.currentState}</span>
                </div>
                <div className="mt-2 text-sm text-slate-300">{item.systemCategory}</div>
                <div className="mt-3 h-2 rounded-full bg-white/5">
                  <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${item.progress}%` }} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedPackage && (
          <div className="space-y-4">
            <section className="panel">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="eyebrow">Selected package</div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{selectedPackage.name}</h2>
                  <p className="mt-2 text-sm text-slate-300">{selectedPackage.authorizationBoundary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="badge-neutral">{selectedPackage.authorizationStatus}</span>
                    <span className="badge-neutral">{selectedPackage.currentState}</span>
                    <span className="badge-neutral">{selectedPackage.progress}% complete</span>
                  </div>
                </div>
                <button className="button-primary" disabled={busy} onClick={() => void handleAdvance()} type="button">
                  <StepForward className="mr-2 h-4 w-4" />
                  Advance handoff
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="panel-subtle">
                  <div className="label">Next handoff</div>
                  <div className="mt-2 text-sm text-slate-300">{selectedPackage.nextHandoff}</div>
                </div>
                <div className="panel-subtle">
                  <div className="label">Decision target</div>
                  <div className="mt-2 text-sm text-slate-300">{selectedPackage.decisionTarget}</div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="panel-subtle">
                <div className="eyebrow">RMF steps</div>
                <div className="mt-4 space-y-3">
                  {selectedPackage.steps.map((step) => (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4" key={step.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-white">{step.name}</div>
                        <span className="badge-neutral">{step.status}</span>
                        <span className="badge-neutral">{step.progress}%</span>
                      </div>
                      <div className="mt-2 text-sm text-slate-300">{step.summary}</div>
                      <div className="mt-2 text-xs text-slate-500">{step.owner}</div>
                      <div className="mt-3">
                        <Link className="button-secondary" to={step.route}>
                          Open module
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <section className="panel-subtle">
                  <div className="eyebrow">Artifacts</div>
                  <div className="mt-4 space-y-3">
                    {selectedPackage.artifacts.map((artifact) => (
                      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4" key={artifact.id}>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-white">{artifact.title}</div>
                          <span className="badge-neutral">{artifact.module}</span>
                          <span className="badge-neutral">{artifact.status}</span>
                        </div>
                        <div className="mt-2 text-sm text-slate-300">{artifact.helper}</div>
                        <div className="mt-2 text-xs text-slate-500">
                          {artifact.step} · {artifact.owner}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="panel-subtle">
                  <div className="flex items-center gap-2 text-white">
                    <TimerReset className="h-4 w-4 text-cyan-300" />
                    <div className="eyebrow">Cadence</div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {selectedPackage.timeline.map((point) => (
                      <div key={point.bucket}>
                        <div className="flex items-center justify-between text-sm text-slate-300">
                          <span>{point.bucket}</span>
                          <span>
                            {point.progress}% · {point.artifacts} artifacts · {point.findings} findings
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-white/5">
                          <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${point.progress}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {selectedPackage.blockers.length > 0 && (
                  <section className="panel-subtle">
                    <div className="eyebrow">Blockers</div>
                    <div className="mt-4 space-y-2 text-sm text-slate-300">
                      {selectedPackage.blockers.map((blocker) => (
                        <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3" key={blocker}>
                          {blocker}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
