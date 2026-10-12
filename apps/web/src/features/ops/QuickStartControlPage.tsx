import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Circle, Compass, RefreshCw, Rocket, Wrench } from 'lucide-react';
import { useOpsParityOverview } from './useOpsParityOverview';
import { RegPageHeader, RegStatusPill } from '../../components/regovise/PagePrimitives';

export function QuickStartControlPage() {
  const { overview, loading, error, refresh } = useOpsParityOverview();

  if (loading) {
    return <div className="panel p-6 text-sm text-[#4f435c]">Loading guided setup...</div>;
  }

  if (error || !overview) {
    return <div className="notice-error">{error ?? 'Guided setup could not be loaded.'}</div>;
  }

  const completed = overview.quickStart.filter((step) => step.completed).length;
  const remaining = overview.quickStart.length - completed;
  const firstPendingStep = overview.quickStart.find((step) => !step.completed);
  const starterGuideGroups = [
    {
      id: 'integrations',
      title: 'Connect your first integrations',
      detail: 'Learn about purchased frameworks, then connect the systems that begin fixing evidence and assessment gaps.',
      icon: Wrench,
      completed: 3,
      total: 3,
      done: true,
      expanded: false,
      route: '/integrations',
      items: [],
    },
    {
      id: 'policies',
      title: 'Set up policies',
      detail: 'Draft the first policy and finish the setup actions that make progress toward compliance goals.',
      icon: Rocket,
      completed,
      total: Math.max(overview.quickStart.length, 1),
      done: remaining === 0,
      expanded: true,
      route: firstPendingStep?.route ?? '/program',
      items: overview.quickStart,
    },
    {
      id: 'work-queue',
      title: 'Start operating work',
      detail: 'Open the first work queue and move the program from setup into day-to-day remediation ownership.',
      icon: Compass,
      completed: overview.tasks.length > 0 ? 1 : 0,
      total: 2,
      done: false,
      expanded: false,
      route: '/tasks',
      items: [],
    },
  ];

  return (
    <div className="space-y-6">
      <RegPageHeader
        eyebrow="Starter Guide"
        title="Starter Guide"
        description="Get up and running on Regovise fast with the key activities that establish scope, policies, assessments, and work ownership."
        actions={
          <>
            <Link className="button-secondary" to="/program">
              Open program workspace
            </Link>
            <Link className="button-secondary" to="/assessments">
              Open assessments
            </Link>
            <button className="button-primary" onClick={() => void refresh()} type="button">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
          </>
        }
        className="rounded-lg border border-[#ded8e4]"
      />

      <section className="rounded-lg border border-[#ded8e4] bg-white px-5 py-7 shadow-[0_8px_24px_rgba(48,24,72,0.05)] sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr] md:items-start">
            {[
              { index: 1, label: 'Onboarding', active: true },
              { index: 2, label: 'Program implementation', active: false },
              { index: 3, label: 'Risk remediation', active: false },
            ].map((step, index, steps) => (
              <div className="relative" key={step.index}>
                {index < steps.length - 1 ? (
                  <div className="absolute left-[28px] top-4 hidden h-1 w-[calc(100%+2rem)] bg-[#d8d4dc] md:block" />
                ) : null}
                <div className="relative flex flex-col gap-3">
                  <div
                    className={
                      step.active
                        ? 'flex h-9 w-9 items-center justify-center rounded-full bg-[#241232] text-sm font-semibold text-[#ffffff]'
                        : 'flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#d8d4dc] bg-white text-sm font-semibold text-[#62576a]'
                    }
                  >
                    {step.index}
                  </div>
                  <div className={step.active ? 'text-lg font-semibold text-[#241232]' : 'text-lg font-semibold text-[#6f6578]'}>
                    {step.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-[22px] bg-[#f7f4f9] p-5 sm:p-8">
            <h2 className="text-2xl font-semibold text-[#241232]">Onboarding</h2>
            <p className="mt-3 max-w-4xl text-base leading-7 text-[#6f6578]">
              Get started quickly by completing these essential setup tasks. They set a solid foundation and help the rest of Regovise inherit a clean operating model.
            </p>
            <div className="mt-8 space-y-4">
              {starterGuideGroups.map((group) => {
                const Icon = group.icon;
                return (
                  <div className="overflow-hidden rounded-lg border border-[#ece7f0] bg-white shadow-sm" key={group.id}>
                    <Link className="flex items-start gap-4 px-5 py-4 transition hover:bg-[#fbf9fc]" to={group.route}>
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#f2e8ff] text-[#8b35e6]">
                        <Icon className="h-7 w-7" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div
                              className={
                                group.done
                                  ? 'text-lg font-semibold text-[#126b36] line-through decoration-[#126b36]'
                                  : 'text-lg font-semibold text-[#241232]'
                              }
                            >
                              {group.title}
                            </div>
                            <p className="mt-1 text-sm leading-6 text-[#6f6578]">{group.detail}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3 text-sm font-semibold text-[#6f6578]">
                            <span>
                              {group.completed} of {group.total} complete
                            </span>
                            {group.done ? (
                              <CheckCircle2 className="h-5 w-5 text-[#1aa854]" />
                            ) : (
                              <Circle className="h-5 w-5 text-[#1aa854]" />
                            )}
                            {group.expanded ? <ChevronUp className="h-5 w-5 text-[#241232]" /> : <ChevronDown className="h-5 w-5 text-[#241232]" />}
                          </div>
                        </div>
                      </div>
                    </Link>
                    {group.expanded ? (
                      <div className="border-t border-[#ece7f0]">
                        {group.items.map((step) => (
                          <Link
                            className="flex items-center justify-between gap-4 border-b border-[#f0ecf3] px-5 py-4 last:border-b-0 hover:bg-[#fbf9fc]"
                            key={step.id}
                            to={step.route}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              {step.completed ? (
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#1aa854]" />
                              ) : (
                                <Circle className="h-5 w-5 shrink-0 text-[#a6a0ad]" />
                              )}
                              <span className={step.completed ? 'truncate text-[#126b36] line-through' : 'truncate text-[#6f20c9]'}>
                                {step.title}
                              </span>
                            </span>
                            {step.completed ? (
                              <RegStatusPill tone="success">Done</RegStatusPill>
                            ) : (
                              <span className="button-primary whitespace-nowrap">Go to step</span>
                            )}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="mt-8 flex justify-end">
              <Link className="button-secondary" to="/program">
                Continue to Program implementation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[#ded8e4] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#241232]">Setup summary</h2>
            <p className="mt-1 text-sm text-[#6f6578]">
              {completed} of {overview.quickStart.length} steps complete.{' '}
              {firstPendingStep ? `Next: ${firstPendingStep.title}.` : 'The onboarding sequence is complete.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RegStatusPill tone={remaining === 0 ? 'success' : 'warning'}>
              {remaining === 0 ? 'Onboarding complete' : `${remaining} remaining`}
            </RegStatusPill>
            {firstPendingStep ? (
              <Link className="button-primary" to={firstPendingStep.route}>
                Continue setup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>
        <nav aria-label="Starter Guide shortcuts" className="mt-5 grid border-t border-[#ece7f0] sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Scope and domains', route: '/workspace/domains' },
            { label: 'Team and access', route: '/workspace/team' },
            { label: 'Frameworks', route: '/frameworks' },
            { label: 'Work Queue', route: '/tasks' },
          ].map((item) => (
            <Link
              className="flex min-h-12 items-center justify-between border-b border-[#ece7f0] px-3 py-3 text-sm font-medium text-[#2b173d] transition hover:bg-[#f7f2ff] sm:border-r xl:border-b-0"
              key={item.route}
              to={item.route}
            >
              {item.label}
              <ArrowRight className="h-4 w-4 text-[#6f20c9]" />
            </Link>
          ))}
        </nav>
      </section>
    </div>
  );
}
