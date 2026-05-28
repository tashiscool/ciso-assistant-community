import { Link } from 'react-router-dom';

type LauncherKind = 'builders' | 'features' | 'setup';

type LauncherCard = {
  title: string;
  route: string;
  status: string;
  primaryAction: string;
  summary: string;
  relatedModules: string[];
  evidence: string;
};

const builderCards: LauncherCard[] = [
  {
    title: 'Form Builder',
    route: '/builders/form-builder',
    status: 'Validated',
    primaryAction: 'Customize module forms',
    summary: 'Module-aware form sections, fields, choices, validations, import/export, factory reset, and shared-record runtime enforcement.',
    relatedModules: ['Assets', 'Policies', 'Risks', 'Security Plans'],
    evidence: 'Production E2E validates live rules, API enforcement, and cleanup-safe reset.',
  },
  {
    title: 'Rules Builder',
    route: '/builders/rules-builder',
    status: 'Validated',
    primaryAction: 'Author conditional form behavior',
    summary: 'Visibility, required, disabled, SET_VALUE, and validation rules shared by the UI runtime and Cloudflare APIs.',
    relatedModules: ['Assets', 'Incidents', 'Exceptions', 'Tasks'],
    evidence: 'Form Builder lifecycle test exercises rule create, failure, success, and reset.',
  },
  {
    title: 'Export Builder',
    route: '/builders/export-builder',
    status: 'Validated',
    primaryAction: 'Build DOCX and XLSX exports',
    summary: 'Template upload, tag extraction, auto-mapping, filter logic, sub-templates, mapping import/export, and test generation.',
    relatedModules: ['Security Plans', 'Assessments', 'Evidence Locker'],
    evidence: 'Production E2E creates, maps, tests, imports mappings, and cleans export configs.',
  },
  {
    title: 'Report Builder',
    route: '/builders/report-builder',
    status: 'Validated',
    primaryAction: 'Create list and chart reports',
    summary: 'List, bar, line, and pie reports with module fields, filters, logic, previews, exports, sharing, and subscriptions.',
    relatedModules: ['Risks', 'Requirements', 'Questionnaires'],
    evidence: 'Production E2E validates list/chart previews, CSV export, subscriptions, and cleanup.',
  },
  {
    title: 'Dashboard Builder',
    route: '/builders/dashboard-builder',
    status: 'Validated',
    primaryAction: 'Assemble dashboards',
    summary: 'Public/private dashboards with groups, widgets, reports, module cards, preview, favorite, publish, and +Left/+Right placement.',
    relatedModules: ['Reports', 'Assets', 'Incidents'],
    evidence: 'Production E2E validates widget/report/module layout, menu actions, favorite, publish, and cleanup.',
  },
  {
    title: 'Questionnaire Builder',
    route: '/builders/questionnaire-builder',
    status: 'Validated',
    primaryAction: 'Build, assign, complete, and review questionnaires',
    summary: 'Templates, sections, questions, assignments, access codes, scoring, rules, responses, feedback, exports, and instances.',
    relatedModules: ['Assessment Plans', 'Questionnaires', 'Security Controls'],
    evidence: 'Production E2E validates assignment, response, reject/reopen, accept, scoring, exports, and cleanup.',
  },
  {
    title: 'Wayfinder Builder',
    route: '/builders/wayfinder-builder',
    status: 'Validated',
    primaryAction: 'Author guided compliance journeys',
    summary: 'Stages, activities, documentation links, import/export, ownership, status, and reusable guide templates.',
    relatedModules: ['Tasks', 'Programs', 'Assessments'],
    evidence: 'Production E2E creates, imports, exports, updates, and deletes Wayfinder templates.',
  },
];

const featureCards: LauncherCard[] = [
  {
    title: 'RegML and AI Workspaces',
    route: '/features/regml',
    status: 'Tenant-visible',
    primaryAction: 'Open AI authoring and review tools',
    summary: 'Control AI features, authoring, explainers, SSP authoring, auditors, and AI generation with explicit runtime readiness.',
    relatedModules: ['Security Controls', 'Security Plans', 'Evidence Locker'],
    evidence: 'Route sweep verifies each RegML child surface and AI/vector readiness labels.',
  },
  {
    title: 'Automation Manager',
    route: '/features/automation-manager',
    status: 'D1-backed',
    primaryAction: 'Manage connectors',
    summary: 'AD/LDAP, Slack, Teams, webhooks, Tenable-style, identity, cloud, and code connectors with test, dry-run sync, status, and errors.',
    relatedModules: ['Assets', 'Incidents', 'Evidence Locker'],
    evidence: 'Production E2E validates provider lifecycle semantics and run history.',
  },
  {
    title: 'Compliance Exports',
    route: '/features/compliance-exports',
    status: 'Tenant-visible',
    primaryAction: 'Open eMASS and FedRAMP export surfaces',
    summary: 'Canonical eMASS and FedRAMP bridges for hardware/software, POA&Ms, ports/protocols, SAP/SAR, SLCM, inventory, and risk exposure.',
    relatedModules: ['Security Plans', 'Assessment Plans', 'Requirements'],
    evidence: 'Compatibility sweep resolves each openregscale export child route to a current-app surface.',
  },
  {
    title: 'Operational Workspaces',
    route: '/features/workbench',
    status: 'Tenant-visible',
    primaryAction: 'Review workbench, workflow, utilities, and subsystems',
    summary: 'Operational dashboards, workbench views, utilities, subsystems, news feed, RMF, and app-management bridge surfaces.',
    relatedModules: ['Tasks', 'Programs', 'Projects'],
    evidence: 'Route sweep covers feature aliases and legacy operational bridges.',
  },
  {
    title: 'Evidence and TPRM',
    route: '/features/evidence-management',
    status: 'Tenant-visible',
    primaryAction: 'Review evidence and third-party posture',
    summary: 'Evidence management, evidence mapping, third-party risk, and continuous monitoring route to dedicated current Regovise workspaces.',
    relatedModules: ['Evidence Locker', 'Supply Chain', 'Incidents'],
    evidence: 'Semantic matrix maps openregscale feature routes to evidence, TPRM, and ConMon surfaces.',
  },
];

const setupCards: LauncherCard[] = [
  {
    title: 'General Setup',
    route: '/setup/general',
    status: 'Configured',
    primaryAction: 'Manage workspace defaults',
    summary: 'Organization metadata, classification, tags, module/features, branding, email, logs, security posture, SSO, and MFA.',
    relatedModules: ['Programs', 'Policies', 'Requirements'],
    evidence: 'Route sweep covers setup root and canonical setup children.',
  },
  {
    title: 'Compliance Settings',
    route: '/setup/compliance-settings',
    status: 'Bridged',
    primaryAction: 'Open framework and catalogue settings',
    summary: 'Compatibility alias for compliance settings lands on the tenant catalogue/framework workspace rather than a hidden placeholder.',
    relatedModules: ['Catalogues', 'Import RegScale Catalogs', 'Security Controls'],
    evidence: 'Semantic matrix verifies setup/compliance-settings has a tenant route.',
  },
  {
    title: 'Filesystem and Facilities',
    route: '/setup/file-system',
    status: 'Bridged',
    primaryAction: 'Open evidence sources and domains',
    summary: 'File system and facilities aliases resolve to evidence source configuration and domain/folder management.',
    relatedModules: ['Evidence Locker', 'Assets', 'Supply Chain'],
    evidence: 'Compatibility sweep checks file-system and facilities aliases.',
  },
  {
    title: 'Roles and User Management',
    route: '/setup/user-management-roles',
    status: 'Configured',
    primaryAction: 'Manage users, roles, MFA, and permissions',
    summary: 'User-management, functional-role, roles, and MFA aliases land on IAM team/access controls.',
    relatedModules: ['Tasks', 'Programs', 'Assessments'],
    evidence: 'Production E2E validates IAM role/user permission lifecycle.',
  },
  {
    title: 'Policy and Risk Setup',
    route: '/setup/security-policies',
    status: 'Bridged',
    primaryAction: 'Open policy and cause-code surfaces',
    summary: 'Security policy aliases route to Policies while cause-code aliases route to the risk model configuration surface.',
    relatedModules: ['Policies', 'Risks', 'Exceptions'],
    evidence: 'Semantic matrix verifies each setup alias resolves to a product surface.',
  },
];

const launcherContent: Record<LauncherKind, { eyebrow: string; title: string; summary: string; cards: LauncherCard[] }> = {
  builders: {
    eyebrow: 'Builder Launcher',
    title: 'Builder Control Plane',
    summary:
      'One tenant-facing launcher for every authoring surface. Each builder is module-aware, discoverable, and backed by production validation evidence.',
    cards: builderCards,
  },
  features: {
    eyebrow: 'Feature Launcher',
    title: 'Feature Workspaces',
    summary:
      'Compatibility and current-product entry points for AI, automation, exports, evidence, monitoring, workbench, and operational feature families.',
    cards: featureCards,
  },
  setup: {
    eyebrow: 'Setup Launcher',
    title: 'Workspace Setup',
    summary:
      'A canonical setup entry surface with compatibility aliases for the openregscale setup taxonomy and Regovise IAM/configuration workspaces.',
    cards: setupCards,
  },
};

export function SemanticLauncherPage({ kind }: { kind: LauncherKind }) {
  const content = launcherContent[kind];

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">{content.eyebrow}</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">{content.title}</h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">{content.summary}</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {content.cards.map((card) => (
          <article className="panel-subtle flex flex-col gap-4" key={card.route}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="eyebrow">{card.status}</div>
                <h2 className="mt-2 text-xl font-semibold text-white">{card.title}</h2>
              </div>
              <span className="badge-success">{card.status}</span>
            </div>
            <p className="text-sm leading-6 text-slate-300">{card.summary}</p>
            <div>
              <div className="label">Primary action</div>
              <div className="mt-1 text-sm font-medium text-white">{card.primaryAction}</div>
            </div>
            <div>
              <div className="label">Related modules</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {card.relatedModules.map((module) => (
                  <span className="badge-neutral" key={`${card.route}-${module}`}>
                    {module}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.04] p-3 text-sm leading-6 text-cyan-100">
              <span className="font-medium text-white">Last validation evidence:</span> {card.evidence}
            </div>
            <div className="mt-auto">
              <Link className="button-primary" to={card.route}>
                {card.primaryAction}
              </Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
