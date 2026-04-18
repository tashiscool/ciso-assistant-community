import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  FileText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { type OpsParityCard, useOpsParityOverview } from './useOpsParityOverview';

type PageConfig = {
  eyebrow: string;
  title: string;
  description: string;
  countLabel: string;
  countDetail: string;
  emptyMessage: string;
  actions: Array<{ label: string; to: string }>;
  contextTitle: string;
  contextDescription: string;
  helperTitle: string;
  helperDescription: string;
  icon: LucideIcon;
  iconToneClass: string;
  accentClass: string;
};

type RegistryPageProps = PageConfig & {
  items: OpsParityCard[];
  helperMode: 'search' | 'validation';
};

function RegistryControlPage({
  eyebrow,
  title,
  description,
  countLabel,
  countDetail,
  emptyMessage,
  actions,
  contextTitle,
  contextDescription,
  helperTitle,
  helperDescription,
  icon: Icon,
  iconToneClass,
  accentClass,
  items,
  helperMode,
}: RegistryPageProps) {
  const { overview, loading, error, refresh } = useOpsParityOverview();

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading {title.toLowerCase()}...</div>;
  }

  if (error || !overview) {
    return <div className="notice-error">{error ?? `${title} could not be loaded.`}</div>;
  }

  const helperCards =
    helperMode === 'search' ? (
      overview.searchIndex.slice(0, 5).map((entry) => (
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
      ))
    ) : overview.validationFlows.length === 0 ? (
      <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm text-slate-400">
        No validation-linked activity is active for this tenant right now.
      </div>
    ) : (
      overview.validationFlows.slice(0, 4).map((item) => (
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
    );

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accentClass}`} />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="metric-label">{countLabel}</div>
          <div className="metric-value">{items.length}</div>
          <div className="mt-2 text-xs text-slate-500">{countDetail}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Tenant</div>
          <div className="metric-value text-lg">{overview.settings.tenantId}</div>
          <div className="mt-2 text-xs text-slate-500">Canonical workspace context for this operational surface.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Search index</div>
          <div className="metric-value">{overview.searchIndex.length}</div>
          <div className="mt-2 text-xs text-slate-500">Searchable canonical records available for operator drill-down.</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Validation cues</div>
          <div className="metric-value">{overview.validationFlows.length}</div>
          <div className="mt-2 text-xs text-slate-500">Current validation-linked work that can shape remediation and review cadence.</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel-subtle">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconToneClass}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{contextTitle}</h2>
              <p className="text-sm text-slate-400">{contextDescription}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {items.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm text-slate-400 md:col-span-2">
                {emptyMessage}
              </div>
            ) : (
              items.map((item) => (
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
              ))
            )}
          </div>
        </div>

        <div className="panel-subtle">
          <h2 className="text-lg font-semibold text-white">{helperTitle}</h2>
          <p className="mt-1 text-sm text-slate-400">{helperDescription}</p>
          <div className="mt-5 space-y-3">{helperCards}</div>
        </div>
      </section>
    </div>
  );
}

export function AssetsControlPage() {
  const { overview } = useOpsParityOverview();
  return (
    <RegistryControlPage
      accentClass="from-emerald-400/0 via-emerald-300/60 to-emerald-400/0"
      actions={[
        { label: 'Open resilience', to: '/resilience' },
        { label: 'Open evidence jobs', to: '/evidence/jobs' },
      ]}
      contextDescription="Asset inventory, dependency visibility, and recovery-oriented evidence now live in the canonical resilience flow."
      contextTitle="Asset inventory"
      countDetail="Assets and recovery dependencies currently visible through canonical resilience studies."
      countLabel="Assets"
      description="Asset inventory, asset-assessment semantics, and recovery-oriented dependency visibility are now expressed through the migrated resilience and evidence workspaces."
      emptyMessage="No asset records are currently visible in the canonical resilience flow."
      eyebrow="Asset Parity"
      helperDescription="Search-index entries that operators can use to jump from asset coverage into the relevant canonical workspace."
      helperMode="search"
      helperTitle="Discovery paths"
      icon={Boxes}
      iconToneClass="bg-emerald-400/10 text-emerald-300"
      items={overview?.assets ?? []}
      title="Assets"
    />
  );
}

export function AssetAssessmentsControlPage() {
  const { overview } = useOpsParityOverview();
  return (
    <RegistryControlPage
      accentClass="from-lime-400/0 via-lime-300/60 to-lime-400/0"
      actions={[
        { label: 'Open resilience', to: '/resilience' },
        { label: 'Open assessments', to: '/assessments' },
      ]}
      contextDescription="Legacy asset-assessment semantics now resolve into resilience analysis and linked assessment coverage."
      contextTitle="Asset assessments"
      countDetail="Canonical asset-assessment style records currently represented through resilience analysis."
      countLabel="Asset assessments"
      description="Legacy asset-assessment routes are consolidated into resilience analysis, evidence-backed recovery planning, and assessment-linked review coverage."
      emptyMessage="No asset-assessment style records are currently visible for this tenant."
      eyebrow="Asset Parity"
      helperDescription="Validation-linked activity that most often drives follow-up work on resilience and control review coverage."
      helperMode="validation"
      helperTitle="Assessment follow-through"
      icon={ClipboardCheck}
      iconToneClass="bg-lime-400/10 text-lime-300"
      items={overview?.assets ?? []}
      title="Asset Assessments"
    />
  );
}

export function ActorsControlPage() {
  const { overview } = useOpsParityOverview();
  return (
    <RegistryControlPage
      accentClass="from-cyan-400/0 via-cyan-300/60 to-cyan-400/0"
      actions={[
        { label: 'Open team', to: '/workspace/team' },
        { label: 'Open access control', to: '/workspace/access' },
      ]}
      contextDescription="Actor semantics are unified into team, identities, and role-bearing collaboration records in the canonical stack."
      contextTitle="Actor registry"
      countDetail="Principals and assignment actors currently visible through canonical team and portal flows."
      countLabel="Actors"
      description="Regovise actor semantics are unified into the migrated team, identity, and role-assignment control room."
      emptyMessage="No actor records are currently visible for this tenant."
      eyebrow="Actor Registry"
      helperDescription="Search-index entries that lead operators into the team, portal, and access-control surfaces behind actor coverage."
      helperMode="search"
      helperTitle="Linked workspaces"
      icon={Users}
      iconToneClass="bg-cyan-400/10 text-cyan-300"
      items={overview?.actors ?? []}
      title="Actors"
    />
  );
}

export function VulnerabilitiesControlPage() {
  const { overview } = useOpsParityOverview();
  return (
    <RegistryControlPage
      accentClass="from-amber-400/0 via-amber-300/60 to-amber-400/0"
      actions={[
        { label: 'Open risk scenarios', to: '/risk-scenarios' },
        { label: 'Open assessments', to: '/assessments' },
      ]}
      contextDescription="Vulnerability tracking now resolves into risk scenarios and assessment-linked remediation in the canonical stack."
      contextTitle="Exposure coverage"
      countDetail="Risk-driven vulnerability records currently visible through the canonical risk scenario workspace."
      countLabel="Vulnerabilities"
      description="Vulnerability tracking is represented through risk scenarios, evidence-backed assessments, and remediation-oriented workspace flows."
      emptyMessage="No vulnerability-style risk records are currently visible for this tenant."
      eyebrow="Exposure Coverage"
      helperDescription="Validation and remediation signals that most often turn vulnerability findings into tracked review work."
      helperMode="validation"
      helperTitle="Remediation pressure"
      icon={AlertTriangle}
      iconToneClass="bg-amber-400/10 text-amber-300"
      items={overview?.vulnerabilities ?? []}
      title="Vulnerabilities"
    />
  );
}

export function PoliciesControlPage() {
  const { overview } = useOpsParityOverview();
  return (
    <RegistryControlPage
      accentClass="from-indigo-400/0 via-indigo-300/60 to-indigo-400/0"
      actions={[
        { label: 'Open frameworks', to: '/frameworks' },
        { label: 'Open libraries', to: '/libraries' },
      ]}
      contextDescription="Policy management now resolves into canonical frameworks, libraries, and governance packs."
      contextTitle="Governance packs"
      countDetail="Framework-backed policy sources currently visible in the canonical governance stack."
      countLabel="Policies"
      description="Policy management now resolves into Worker-backed frameworks, libraries, and governance packs instead of the legacy policy-only surface."
      emptyMessage="No framework-backed policy sources are currently visible for this tenant."
      eyebrow="Governance Packs"
      helperDescription="Searchable governance records that operators can use to pivot into frameworks and libraries."
      helperMode="search"
      helperTitle="Governance discovery"
      icon={FileText}
      iconToneClass="bg-indigo-400/10 text-indigo-300"
      items={overview?.policies ?? []}
      title="Policies"
    />
  );
}

export function IncidentsControlPage() {
  const { overview } = useOpsParityOverview();
  return (
    <RegistryControlPage
      accentClass="from-rose-400/0 via-rose-300/60 to-rose-400/0"
      actions={[
        { label: 'Open privacy', to: '/privacy' },
        { label: 'Open portal', to: '/portal' },
      ]}
      contextDescription="Incident-like events now live inside privacy breach handling and assignment-driven collaboration flows."
      contextTitle="Incident control room"
      countDetail="Operational incident records currently visible in the canonical privacy workspace."
      countLabel="Incidents"
      description="Incident-like operational events now sit inside privacy breach handling, tenant activity, and assignment-driven collaboration flows."
      emptyMessage="No incident-style events are currently visible for this tenant."
      eyebrow="Incident Control Room"
      helperDescription="Validation and remediation activity that most often accompanies incident handling in the canonical stack."
      helperMode="validation"
      helperTitle="Related remediation"
      icon={ShieldAlert}
      iconToneClass="bg-rose-400/10 text-rose-300"
      items={overview?.incidents ?? []}
      title="Incidents"
    />
  );
}

export function SecurityExceptionsControlPage() {
  const { overview } = useOpsParityOverview();
  return (
    <RegistryControlPage
      accentClass="from-orange-400/0 via-orange-300/60 to-orange-400/0"
      actions={[
        { label: 'Open compliance reviews', to: '/assessments' },
        { label: 'Open reports', to: '/reports' },
      ]}
      contextDescription="Exception semantics are now mapped from partial and non-compliant control reviews inside the canonical stack."
      contextTitle="Exception tracking"
      countDetail="Security-exception style review records currently visible from compliance requirement assessments."
      countLabel="Security exceptions"
      description="Exception semantics are mapped from partial and non-compliant control reviews, export validation signals, and remediation work."
      emptyMessage="No exception-style review records are currently visible for this tenant."
      eyebrow="Exception Tracking"
      helperDescription="Current validation-linked work that helps explain why exception handling is active."
      helperMode="validation"
      helperTitle="Validation-linked context"
      icon={ShieldCheck}
      iconToneClass="bg-orange-400/10 text-orange-300"
      items={overview?.exceptions ?? []}
      title="Security Exceptions"
    />
  );
}
