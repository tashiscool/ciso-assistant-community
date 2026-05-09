import { Link } from 'react-router-dom';
import { Compass, Layers3, RefreshCw, Sparkles } from 'lucide-react';
import { useOpsParityOverview } from './useOpsParityOverview';
import { CoachMarksPanel } from '../../components/CoachMarksPanel';
import type { ShellAccessProfile } from '../../shell/shellAccess';
import { canAccessShellRoute } from '../../shell/shellAccess';

type ProgramControlPageProps = {
  access: ShellAccessProfile;
};

export function ProgramControlPage({ access }: ProgramControlPageProps) {
  const { overview, loading, error, refresh } = useOpsParityOverview();

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading program workspace...</div>;
  }

  if (error || !overview) {
    return <div className="notice-error">{error ?? 'Program workspace could not be loaded.'}</div>;
  }

  const visibleProgramCards = overview.program.filter((item) => canAccessShellRoute(item.route, access));
  const visibleDiscoveryPaths = overview.searchIndex.filter((entry) => canAccessShellRoute(entry.route, access));
  const visibleQuickStart = access.canViewAdminNavigation ? overview.quickStart : [];
  const completedQuickStartCount = visibleQuickStart.filter((step) => step.completed).length;
  const canOpenAssessments = access.canUseAssessmentWorkspace;
  const coachMarkItems = [
    access.canViewAdminNavigation
      ? {
          id: 'program-domains',
          eyebrow: 'Boundaries',
          title: 'Domains anchor the program',
          body: 'Domains and permissions decide where later assessments, evidence, and review records are allowed to live.',
          route: '/workspace/domains',
          ctaLabel: 'Open domains',
        }
      : null,
    access.canUseFrameworks
      ? {
          id: 'program-frameworks',
          eyebrow: 'Sources',
          title: 'Frameworks supply the operating vocabulary',
          body: 'Frameworks and controls are the source of truth the rest of the program measures itself against.',
          route: '/frameworks',
          ctaLabel: 'Open frameworks',
        }
      : null,
    access.canUseAssessmentWorkspace
      ? {
          id: 'program-assessments',
          eyebrow: 'Execution',
          title: 'Assessments create the working backlog',
          body: 'This is where the program turns policy and business context into evidence demand, action plans, and review work.',
          route: '/assessments',
          ctaLabel: 'Open assessments',
          tone: 'focus' as const,
        }
      : null,
    access.canUseAssurance
      ? {
          id: 'program-assurance',
          eyebrow: 'Outputs',
          title: 'Assurance is where the program becomes shareable',
          body: 'Evidence, review, and package work close the loop and turn the operating program into external outputs.',
          route: '/assurance',
          ctaLabel: 'Open assurance',
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-violet-400/0 via-violet-300/60 to-violet-400/0" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Program Workspace</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Program Workspace</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Manage the domains, governance sources, assessments, and operating work that make Regovise the source of truth for the compliance program.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {access.canViewAdminNavigation ? (
              <Link className="button-secondary" to="/program/setup">
                Open guided setup
              </Link>
            ) : null}
            {canOpenAssessments ? (
              <Link className="button-secondary" to="/assessments">
                Open assessments
              </Link>
            ) : null}
            <button className="button-primary" onClick={() => void refresh()} type="button">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <CoachMarksPanel
        storageKey="program-workspace"
        title="Use Program as the operating layer, not just another landing page."
        description="This workspace should help teams move from governance structure into real assessments, then into evidence and assurance, without getting lost in disconnected modules."
        items={coachMarkItems}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">Program areas</div>
          <div className="metric-value">{visibleProgramCards.length}</div>
          <div className="mt-2 text-xs text-slate-500">The main work areas available to run the program from one workspace.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">{access.canViewAdminNavigation ? 'Setup complete' : 'Discovery paths'}</div>
          <div className="metric-value">
            {access.canViewAdminNavigation
              ? `${completedQuickStartCount}/${visibleQuickStart.length}`
              : visibleDiscoveryPaths.length}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {access.canViewAdminNavigation
              ? 'How much of the core setup path is already complete for this workspace.'
              : 'Program destinations currently visible in your access scope.'}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Governance sources</div>
          <div className="metric-value">{overview.analytics.find((item) => item.id === 'frameworks')?.value ?? 0}</div>
          <div className="mt-2 text-xs text-slate-500">Framework and control sources ready for assessment and policy work.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">{access.canViewAdminNavigation ? 'Workspace access mode' : 'Assurance packages'}</div>
          <div className="metric-value text-lg capitalize">
            {access.canViewAdminNavigation
              ? overview.settings.authStrategy
              : overview.analytics.find((item) => item.id === 'reports')?.value ?? 0}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {access.canViewAdminNavigation
              ? 'The access model currently shaping who can operate across the workspace.'
              : 'Current report and package outputs available from the shared workspace.'}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-300">
              <Layers3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Core program areas</h2>
              <p className="text-sm text-slate-400">The places most teams will live once setup is complete and the program is active.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {visibleProgramCards.map((item) => (
              <Link
                key={item.id}
                className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
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
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel-subtle">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
                <Compass className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Discovery paths</h2>
              <p className="text-sm text-slate-400">Search-index entries that help teams move into the next program area without hunting across the app.</p>
            </div>
          </div>
            <div className="mt-5 space-y-3">
            {visibleDiscoveryPaths.slice(0, 6).map((entry) => (
              <Link
                key={`${entry.section}-${entry.id}`}
                className="block rounded-3xl border border-white/10 bg-slate-950/30 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                  to={entry.route}
                >
                  <div className="font-medium text-white">{entry.title}</div>
                  <div className="mt-1 text-sm text-slate-400">{entry.section}</div>
                  <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {entry.keywords.slice(0, 3).join(' · ')}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {access.canViewAdminNavigation ? (
            <div className="panel-subtle">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-fuchsia-400/10 text-fuchsia-300">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Readiness context</h2>
                  <p className="text-sm text-slate-400">These setup checkpoints still shape how quickly the rest of the program can move.</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {visibleQuickStart.map((step) => (
                  <Link
                    key={step.id}
                    className="block rounded-3xl border border-white/10 bg-slate-950/30 p-4 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
                    to={step.route}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-white">{step.title}</div>
                        <div className="mt-1 text-sm text-slate-400">{step.detail}</div>
                      </div>
                      <span className={step.completed ? 'badge-positive' : 'badge-neutral'}>
                        {step.completed ? 'Complete' : 'Pending'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
