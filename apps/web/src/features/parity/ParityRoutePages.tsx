import { type PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Progress } from '../../components/ui/progress';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';

const client = new ApiClient();

type ParityCard = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  detail: string;
  route: string;
};

type ParityMetric = {
  id: string;
  label: string;
  value: number;
  detail: string;
};

type ParityOverview = {
  tenantId: string;
  assets: ParityCard[];
  actors: ParityCard[];
  vulnerabilities: ParityCard[];
  policies: ParityCard[];
  incidents: ParityCard[];
  exceptions: ParityCard[];
  analytics: ParityMetric[];
  calendar: Array<{
    id: string;
    title: string;
    date: string;
    detail: string;
    route: string;
  }>;
  backupRestore: {
    exportsCount: number;
    importsCount: number;
    latestExport: string | null;
    latestImport: string | null;
  };
  quickStart: Array<{
    id: string;
    title: string;
    completed: boolean;
    detail: string;
    route: string;
  }>;
  searchIndex: Array<{
    id: string;
    title: string;
    subtitle: string;
    section: string;
    route: string;
    keywords: string[];
  }>;
  settings: {
    tenantId: string;
    userId: string | null;
    authStrategy: string;
    appEnv: string;
  };
  libraryOperations: ParityCard[];
  tasks: ParityCard[];
  dashboards: ParityCard[];
  validationFlows: ParityCard[];
  xRays: ParityCard[];
  program: ParityCard[];
};

type Variant =
  | 'assets'
  | 'actors'
  | 'vulnerabilities'
  | 'policies'
  | 'incidents'
  | 'exceptions'
  | 'analytics'
  | 'search'
  | 'backup'
  | 'calendar'
  | 'quickStart'
  | 'settings'
  | 'dashboards'
  | 'validation'
  | 'xrays'
  | 'tasks'
  | 'libraries'
  | 'program';

type PageProps = {
  title: string;
  description: string;
  variant: Variant;
  eyebrow: string;
  primaryActions: Array<{ label: string; to: string }>;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function useParityOverviewData() {
  const { identity } = useEdgeIdentity();
  const [overview, setOverview] = useState<ParityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadOverview() {
    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{ data: ParityOverview }>('/ops/parity/overview');
      setOverview(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, [identity.tenantId, identity.userId]);

  return { overview, loading, error, refresh: loadOverview };
}

function PageShell({
  title,
  description,
  eyebrow,
  primaryActions,
  children,
  refresh,
}: PropsWithChildren<{
  title: string;
  description: string;
  eyebrow: string;
  primaryActions: Array<{ label: string; to: string }>;
  refresh: () => Promise<void>;
}>) {
  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {primaryActions.map((action) => (
              <Link className="button-secondary" key={action.to} to={action.to}>
                {action.label}
              </Link>
            ))}
            <button className="button-primary" onClick={() => void refresh()} type="button">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </section>
      {children}
    </div>
  );
}

function LoadingState() {
  return <div className="panel p-6 text-sm text-slate-300">Loading parity workspace...</div>;
}

function ErrorState({ message }: { message: string }) {
  return <div className="notice-error">{message}</div>;
}

function SummaryStats({ items }: { items: Array<{ label: string; value: string | number; detail: string }> }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div className="metric-card" key={item.label}>
          <div className="metric-label">{item.label}</div>
          <div className="metric-value">{item.value}</div>
          <div className="mt-2 text-xs text-slate-500">{item.detail}</div>
        </div>
      ))}
    </section>
  );
}

function CardGrid({ items }: { items: ParityCard[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Link
          key={`${item.route}-${item.id}`}
          className="panel-subtle block transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]"
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
          <div className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-cyan-300/80">
            Open workspace
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>
      ))}
    </section>
  );
}

function TimelineList({
  items,
}: {
  items: Array<{ id: string; title: string; date: string; detail: string; route: string }>;
}) {
  return (
    <section className="panel">
      <div className="eyebrow">Upcoming Activity</div>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <Link className="panel-subtle block" key={item.id} to={item.route}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-white">{item.title}</div>
                <div className="mt-1 text-sm text-slate-400">{item.detail}</div>
              </div>
              <div className="text-sm text-slate-300">{formatDate(item.date)}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SearchWorkspace({ overview }: { overview: ParityOverview }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return overview.searchIndex;
    }

    return overview.searchIndex.filter((item) =>
      [item.title, item.subtitle, item.section, ...item.keywords]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [overview.searchIndex, query]);

  return (
    <>
      <SummaryStats
        items={[
          { label: 'Indexed records', value: overview.searchIndex.length, detail: 'Tenant-scoped legacy search surface.' },
          {
            label: 'Covered sections',
            value: new Set(overview.searchIndex.map((item) => item.section)).size,
            detail: 'Governance, risk, privacy, portal, and advanced-risk sources.',
          },
          {
            label: 'Policy records',
            value: overview.searchIndex.filter((item) => item.section === 'Policies').length,
            detail: 'Framework and governance pack entries.',
          },
          {
            label: 'Advanced risk',
            value: overview.searchIndex.filter((item) => item.section === 'Advanced Risk').length,
            detail: 'EBIOS and quantitative study records.',
          },
        ]}
      />
      <section className="panel">
        <div className="eyebrow">Tenant Search Index</div>
        <div className="mt-4 space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              className="input pl-11"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search frameworks, entities, incidents, studies, and imported operations..."
              value={query}
            />
          </div>
          <div className="grid gap-3">
            {results.map((item) => (
              <Link className="panel-subtle block" key={`${item.section}-${item.id}`} to={item.route}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{item.title}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {item.section} · {item.subtitle}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.keywords.map((keyword) => (
                        <span className="badge-neutral" key={`${item.id}-${keyword}`}>
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="badge-success">open</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function QuickStartWorkspace({ overview }: { overview: ParityOverview }) {
  const completed = overview.quickStart.filter((item) => item.completed).length;
  const progress = Math.round((completed / Math.max(overview.quickStart.length, 1)) * 100);

  return (
    <>
      <SummaryStats
        items={[
          { label: 'Completed', value: completed, detail: 'Onboarding steps already satisfied by tenant data.' },
          { label: 'Remaining', value: overview.quickStart.length - completed, detail: 'Suggested next moves to finish readiness.' },
          { label: 'Progress', value: `${progress}%`, detail: 'Quick-start parity completion.' },
          { label: 'Tenant', value: overview.tenantId, detail: 'Current workspace scope.' },
        ]}
      />
      <section className="panel">
        <div className="eyebrow">Quick Start Progress</div>
        <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-white">Tenant readiness</div>
            <div className="text-sm text-cyan-200">{progress}% complete</div>
          </div>
          <Progress className="mt-4" value={progress} />
        </div>
        <div className="mt-4 space-y-3">
          {overview.quickStart.map((item) => (
            <Link className="panel-subtle block" key={item.id} to={item.route}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-white">{item.title}</div>
                  <div className="mt-1 text-sm text-slate-400">{item.detail}</div>
                </div>
                <span className={item.completed ? 'badge-success' : 'badge-neutral'}>
                  {item.completed ? 'done' : 'next'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function SettingsWorkspace({ overview }: { overview: ParityOverview }) {
  return (
    <>
      <SummaryStats
        items={[
          { label: 'Tenant', value: overview.settings.tenantId, detail: 'Resolved tenant context.' },
          { label: 'User', value: overview.settings.userId ?? 'anonymous', detail: 'Active workspace identity.' },
          { label: 'Auth', value: overview.settings.authStrategy, detail: 'Resolved authentication strategy.' },
          { label: 'Runtime', value: overview.settings.appEnv, detail: 'Worker runtime environment.' },
        ]}
      />
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="panel">
          <div className="eyebrow">Settings Control Room</div>
          <div className="mt-4 grid gap-3">
            {overview.program.map((item) => (
              <Link className="panel-subtle block" key={item.id} to={item.route}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{item.title}</div>
                    <div className="mt-1 text-sm text-slate-400">{item.subtitle}</div>
                  </div>
                  <span className="badge-neutral">{item.status}</span>
                </div>
                <div className="mt-3 text-sm text-slate-300">{item.detail}</div>
              </Link>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="eyebrow">Runtime Diagnostics</div>
          <div className="mt-4 space-y-3">
            {overview.xRays.map((item) => (
              <Link className="panel-subtle block" key={item.id} to={item.route}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{item.title}</div>
                    <div className="mt-1 text-sm text-slate-400">{item.subtitle}</div>
                  </div>
                  <span className="badge-success">{item.status}</span>
                </div>
                <div className="mt-3 text-sm text-slate-300">{item.detail}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function BackupWorkspace({ overview }: { overview: ParityOverview }) {
  return (
    <>
      <SummaryStats
        items={[
          { label: 'Report exports', value: overview.backupRestore.exportsCount, detail: 'Recoverable generated report artifacts.' },
          { label: 'Import jobs', value: overview.backupRestore.importsCount, detail: 'Replayable import pipeline state.' },
          { label: 'Latest export', value: overview.backupRestore.latestExport ?? 'n/a', detail: 'Most recent report package.' },
          { label: 'Latest import', value: overview.backupRestore.latestImport ?? 'n/a', detail: 'Most recent import execution.' },
        ]}
      />
      <section className="grid gap-4 xl:grid-cols-2">
        <div className="panel">
          <div className="eyebrow">Recovery Sources</div>
          <div className="mt-4 grid gap-3">
            <Link className="panel-subtle block" to="/reports">
              <div className="font-medium text-white">Report export archive</div>
              <div className="mt-2 text-sm text-slate-400">
                Review generated report artifacts and export packages available for controlled recovery.
              </div>
            </Link>
            <Link className="panel-subtle block" to="/imports">
              <div className="font-medium text-white">Import replay pipeline</div>
              <div className="mt-2 text-sm text-slate-400">
                Re-run workbook-style imports and inspect created-object tracking for recovery verification.
              </div>
            </Link>
          </div>
        </div>
        <div className="panel">
          <div className="eyebrow">Validation Flows</div>
          <div className="mt-4 space-y-3">
            {overview.validationFlows.slice(0, 4).map((item) => (
              <Link className="panel-subtle block" key={item.id} to={item.route}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{item.title}</div>
                    <div className="mt-1 text-sm text-slate-400">{item.subtitle}</div>
                  </div>
                  <span className="badge-neutral">{item.status}</span>
                </div>
                <div className="mt-3 text-sm text-slate-300">{item.detail}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function AnalyticsWorkspace({ overview }: { overview: ParityOverview }) {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overview.analytics.map((item) => (
          <div className="metric-card" key={item.id}>
            <div className="metric-label">{item.label}</div>
            <div className="metric-value">{item.value}</div>
            <div className="mt-2 text-xs text-slate-500">{item.detail}</div>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="eyebrow">Operational Dashboards</div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {overview.dashboards.map((item) => (
            <Link className="panel-subtle block" key={item.id} to={item.route}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-white">{item.title}</div>
                  <div className="mt-1 text-sm text-slate-400">{item.detail}</div>
                </div>
                <span className="badge-neutral">{item.subtitle}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function ParityRoutePage({ title, description, variant, eyebrow, primaryActions }: PageProps) {
  const { overview, loading, error, refresh } = useParityOverviewData();

  const cards = useMemo(() => {
    if (!overview) {
      return [];
    }

    switch (variant) {
      case 'assets':
        return overview.assets;
      case 'actors':
        return overview.actors;
      case 'vulnerabilities':
        return overview.vulnerabilities;
      case 'policies':
        return overview.policies;
      case 'incidents':
        return overview.incidents;
      case 'exceptions':
        return overview.exceptions;
      case 'dashboards':
        return overview.dashboards;
      case 'validation':
        return overview.validationFlows;
      case 'xrays':
        return overview.xRays;
      case 'tasks':
        return overview.tasks;
      case 'libraries':
        return overview.libraryOperations;
      case 'program':
        return overview.program;
      default:
        return [];
    }
  }, [overview, variant]);

  if (loading || !overview) {
    return <LoadingState />;
  }

  return (
    <PageShell
      description={description}
      eyebrow={eyebrow}
      primaryActions={primaryActions}
      refresh={refresh}
      title={title}
    >
      {error ? <ErrorState message={error} /> : null}

      {variant === 'analytics' ? <AnalyticsWorkspace overview={overview} /> : null}
      {variant === 'search' ? <SearchWorkspace overview={overview} /> : null}
      {variant === 'backup' ? <BackupWorkspace overview={overview} /> : null}
      {variant === 'calendar' ? <TimelineList items={overview.calendar} /> : null}
      {variant === 'quickStart' ? <QuickStartWorkspace overview={overview} /> : null}
      {variant === 'settings' ? <SettingsWorkspace overview={overview} /> : null}

      {['assets', 'actors', 'vulnerabilities', 'policies', 'incidents', 'exceptions', 'dashboards', 'validation', 'xrays', 'tasks', 'libraries', 'program'].includes(
        variant,
      ) ? (
        <>
          <SummaryStats
            items={[
              { label: 'Records', value: cards.length, detail: 'Legacy parity items mapped into the migrated workspace.' },
              {
                label: 'Routes',
                value: new Set(cards.map((item) => item.route)).size,
                detail: 'Destination workspaces currently owning this surface.',
              },
              {
                label: 'Healthy',
                value: cards.filter((item) => ['healthy', 'active', 'mapped', 'visible'].includes(item.status)).length,
                detail: 'Items already in a good or mapped state.',
              },
              {
                label: 'Needs review',
                value: cards.filter((item) => !['healthy', 'active', 'mapped', 'visible'].includes(item.status)).length,
                detail: 'Items still worth operator attention.',
              },
            ]}
          />
          <CardGrid items={cards} />
        </>
      ) : null}
    </PageShell>
  );
}

export function AssetsParityPage() {
  return (
    <ParityRoutePage
      eyebrow="Asset Parity"
      primaryActions={[
        { label: 'Open resilience', to: '/resilience' },
        { label: 'Open evidence jobs', to: '/evidence/jobs' },
      ]}
      title="Assets"
      description="Asset inventory, asset-assessment semantics, and recovery-oriented dependency visibility are now expressed through the migrated resilience and evidence workspaces."
      variant="assets"
    />
  );
}

export function AssetAssessmentsParityPage() {
  return (
    <ParityRoutePage
      eyebrow="Asset Parity"
      primaryActions={[
        { label: 'Open resilience', to: '/resilience' },
        { label: 'Open assessments', to: '/assessments' },
      ]}
      title="Asset Assessments"
      description="Legacy asset-assessment routes are consolidated into resilience analysis, evidence-backed recovery planning, and assessment-linked review coverage."
      variant="assets"
    />
  );
}

export function ActorsParityPage() {
  return (
    <ParityRoutePage
      eyebrow="Actor Registry"
      primaryActions={[
        { label: 'Open team', to: '/workspace/team' },
        { label: 'Open access control', to: '/workspace/access' },
      ]}
      title="Actors"
      description="Regovise actor semantics are unified into the migrated team, identity, and role-assignment control room."
      variant="actors"
    />
  );
}

export function VulnerabilitiesParityPage() {
  return (
    <ParityRoutePage
      eyebrow="Exposure Coverage"
      primaryActions={[
        { label: 'Open risk scenarios', to: '/risk-scenarios' },
        { label: 'Open assessments', to: '/assessments' },
      ]}
      title="Vulnerabilities"
      description="Vulnerability tracking is represented through risk scenarios, evidence-backed assessments, and remediation-oriented workspace flows."
      variant="vulnerabilities"
    />
  );
}

export function PoliciesParityPage() {
  return (
    <ParityRoutePage
      eyebrow="Governance Packs"
      primaryActions={[
        { label: 'Open frameworks', to: '/frameworks' },
        { label: 'Open libraries', to: '/libraries' },
      ]}
      title="Policies"
      description="Policy management now resolves into Worker-backed frameworks, libraries, and governance packs instead of the legacy policy-only surface."
      variant="policies"
    />
  );
}

export function IncidentsParityPage() {
  return (
    <ParityRoutePage
      eyebrow="Incident Control Room"
      primaryActions={[
        { label: 'Open privacy', to: '/privacy' },
        { label: 'Open portal', to: '/portal' },
      ]}
      title="Incidents"
      description="Incident-like operational events now sit inside privacy breach handling, tenant activity, and assignment-driven collaboration flows."
      variant="incidents"
    />
  );
}

export function SecurityExceptionsParityPage() {
  return (
    <ParityRoutePage
      eyebrow="Exception Tracking"
      primaryActions={[
        { label: 'Open compliance reviews', to: '/assessments' },
        { label: 'Open reports', to: '/reports' },
      ]}
      title="Security Exceptions"
      description="Exception semantics are mapped from partial and non-compliant control reviews, export validation signals, and remediation work."
      variant="exceptions"
    />
  );
}

export function AnalyticsParityPage() {
  return (
    <ParityRoutePage
      eyebrow="Tenant Analytics"
      primaryActions={[
        { label: 'Open dashboard', to: '/' },
        { label: 'Open reports', to: '/reports' },
      ]}
      title="Analytics"
      description="Legacy analytics now resolve into Worker-backed cross-domain metrics drawn from governance, risk, privacy, portal, and advanced-risk state."
      variant="analytics"
    />
  );
}

export function SearchParityPage() {
  return (
    <ParityRoutePage
      eyebrow="Unified Search"
      primaryActions={[
        { label: 'Open frameworks', to: '/frameworks' },
        { label: 'Open libraries', to: '/libraries' },
      ]}
      title="Search"
      description="Search semantics are covered by a tenant-scoped index over migrated governance, risk, privacy, portal, and advanced-risk records."
      variant="search"
    />
  );
}

export function BackupRestoreParityPage() {
  return (
    <ParityRoutePage
      eyebrow="Recovery Surfaces"
      primaryActions={[
        { label: 'Open reports', to: '/reports' },
        { label: 'Open imports', to: '/imports' },
      ]}
      title="Backup and Restore"
      description="Backup and restore coverage now comes from export archives, import replays, and tenant-scoped operational verification rather than a standalone legacy page."
      variant="backup"
    />
  );
}

export function CalendarParityPage() {
  return (
    <ParityRoutePage
      eyebrow="Operational Timeline"
      primaryActions={[
        { label: 'Open portal', to: '/portal' },
        { label: 'Open privacy', to: '/privacy' },
      ]}
      title="Calendar"
      description="Operational dates are derived from portal assignments, privacy deadlines, and assessment-driven work rather than a separate calendar-only module."
      variant="calendar"
    />
  );
}

export function QuickStartParityPage() {
  return (
    <ParityRoutePage
      eyebrow="Onboarding"
      primaryActions={[
        { label: 'Open workspace access', to: '/workspace/access' },
        { label: 'Open assessments', to: '/assessments' },
      ]}
      title="Quick Start"
      description="Legacy onboarding is now represented by a tenant-aware readiness checklist drawn from real workspace, risk, portal, and advanced-risk state."
      variant="quickStart"
    />
  );
}

export function SettingsParityPage() {
  return (
    <ParityRoutePage
      eyebrow="Settings Control Room"
      primaryActions={[
        { label: 'Open my access', to: '/workspace/me' },
        { label: 'Open access control', to: '/workspace/access' },
      ]}
      title="Settings"
      description="Settings, runtime, auth, profile, and licensing semantics are now consolidated into a Worker-backed settings control room."
      variant="settings"
    />
  );
}

export function DashboardsParityPage() {
  return (
    <ParityRoutePage
      eyebrow="Dashboard Surfaces"
      primaryActions={[
        { label: 'Open main dashboard', to: '/' },
        { label: 'Open analytics', to: '/analytics' },
      ]}
      title="Dashboards"
      description="Legacy dashboards, recap views, and matrix-style summaries now land on the migrated dashboard and metric surfaces."
      variant="dashboards"
    />
  );
}

export function ValidationFlowsParityPage() {
  return (
    <ParityRoutePage
      eyebrow="Validation Flows"
      primaryActions={[
        { label: 'Open reports', to: '/reports' },
        { label: 'Open assessments', to: '/assessments' },
      ]}
      title="Validation Flows"
      description="Validation semantics now resolve into export validation, compliance exception handling, and assessment-driven remediation workflows."
      variant="validation"
    />
  );
}

export function XRaysParityPage() {
  return (
    <ParityRoutePage
      eyebrow="Runtime Diagnostics"
      primaryActions={[
        { label: 'Open settings', to: '/settings' },
        { label: 'Open my access', to: '/workspace/me' },
      ]}
      title="X-Rays"
      description="Operational diagnostics now map to runtime, tenant, and authentication health views surfaced from the Worker-backed control plane."
      variant="xrays"
    />
  );
}

export function TaskNodesParityPage() {
  return (
    <ParityRoutePage
      eyebrow="Task Operations"
      primaryActions={[
        { label: 'Open kanban mode', to: '/applied-controls/kanban-mode' },
        { label: 'Open flash mode', to: '/applied-controls/flash-mode' },
      ]}
      title="Task Nodes"
      description="Task-node and task-template semantics are represented through applied controls, action plans, and remediation-focused work queues."
      variant="tasks"
    />
  );
}

export function TaskTemplatesParityPage() {
  return (
    <ParityRoutePage
      eyebrow="Task Operations"
      primaryActions={[
        { label: 'Open kanban mode', to: '/applied-controls/kanban-mode' },
        { label: 'Open assessments', to: '/assessments' },
      ]}
      title="Task Templates"
      description="Task-template coverage is handled through action-plan generation, control workflows, and remediation queue ownership in the migrated app."
      variant="tasks"
    />
  );
}

export function LibraryMappingsParityPage({ title, description }: { title: string; description: string }) {
  return (
    <ParityRoutePage
      eyebrow="Mapping Operations"
      primaryActions={[
        { label: 'Open libraries', to: '/libraries' },
        { label: 'Open frameworks', to: '/frameworks' },
      ]}
      title={title}
      description={description}
      variant="libraries"
    />
  );
}

export function ProgramParityPage({ title, description }: { title: string; description: string }) {
  return (
    <ParityRoutePage
      eyebrow="Program Workbench"
      primaryActions={[
        { label: 'Open settings', to: '/settings' },
        { label: 'Open frameworks', to: '/frameworks' },
      ]}
      title={title}
      description={description}
      variant="program"
    />
  );
}
