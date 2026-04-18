import { Link } from 'react-router-dom';
import { ArchiveRestore, Download, RefreshCw, Upload } from 'lucide-react';
import { useOpsParityOverview } from './useOpsParityOverview';

export function BackupRestoreControlPage() {
  const { overview, loading, error, refresh } = useOpsParityOverview();

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading backup and restore workspace...</div>;
  }

  if (error || !overview) {
    return <div className="notice-error">{error ?? 'Backup and restore workspace could not be loaded.'}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-fuchsia-400/0 via-fuchsia-300/60 to-fuchsia-400/0" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Operational Recovery</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Backup and Restore</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Export archives, import replays, and validation flows are now surfaced through the canonical Worker-backed control plane instead of a legacy backup-only page.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to="/reports">
              Open reports
            </Link>
            <Link className="button-secondary" to="/imports">
              Open imports
            </Link>
            <button className="button-primary" onClick={() => void refresh()} type="button">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Exports</div>
          <div className="metric-value">{overview.backupRestore.exportsCount}</div>
          <div className="mt-2 text-xs text-slate-500">Generated report or archive outputs available for distribution and replay.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Imports</div>
          <div className="metric-value">{overview.backupRestore.importsCount}</div>
          <div className="mt-2 text-xs text-slate-500">Recorded import jobs that can be inspected as recovery or migration signals.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Latest export</div>
          <div className="metric-value text-lg">{overview.backupRestore.latestExport ?? 'None'}</div>
          <div className="mt-2 text-xs text-slate-500">Most recent canonical export available in this tenant.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Latest import</div>
          <div className="metric-value text-lg">{overview.backupRestore.latestImport ?? 'None'}</div>
          <div className="mt-2 text-xs text-slate-500">Most recent canonical import/replay seen by the Worker.</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-fuchsia-400/10 text-fuchsia-300">
              <ArchiveRestore className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Recovery posture</h2>
              <p className="text-sm text-slate-400">The current export/import balance shaping restore confidence for the tenant.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                <Download className="h-3.5 w-3.5" />
                Export coverage
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">{overview.backupRestore.exportsCount}</div>
              <div className="mt-2 text-xs leading-5 text-slate-400">{overview.backupRestore.latestExport ?? 'No export has been produced yet.'}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                <Upload className="h-3.5 w-3.5" />
                Replay coverage
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">{overview.backupRestore.importsCount}</div>
              <div className="mt-2 text-xs leading-5 text-slate-400">{overview.backupRestore.latestImport ?? 'No import replay has been captured yet.'}</div>
            </div>
          </div>
        </div>

        <div className="panel-subtle">
          <h2 className="text-lg font-semibold text-white">Validation-linked artifacts</h2>
          <p className="mt-1 text-sm text-slate-400">Export and remediation flows currently acting as the most visible restore-adjacent checkpoints.</p>
          <div className="mt-5 space-y-3">
            {overview.validationFlows.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm text-slate-400">
                No validation-linked export or exception flows are active yet.
              </div>
            ) : (
              overview.validationFlows.slice(0, 6).map((item) => (
                <Link
                  key={item.id}
                  className="block rounded-3xl border border-white/10 bg-slate-950/30 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                  to={item.route}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-400">{item.subtitle}</div>
                    </div>
                    <span className="badge-neutral">{item.status}</span>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-300">{item.detail}</div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
