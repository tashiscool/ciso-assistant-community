import { Link, useLocation, useParams } from 'react-router-dom';

type LegacyRouteBridgePageProps = {
  legacyModel: string;
};

type LegacyRouteConfig = {
  title: string;
  description: string;
  ownership: string[];
  resolvePath: (segments: string[]) => string;
};

const LEGACY_ROUTE_CONFIG: Record<string, LegacyRouteConfig> = {
  accreditations: {
    title: 'Accreditations',
    description: 'Program and accreditation semantics now live in the governance parity workspace.',
    ownership: ['Governance program parity', 'Framework and preset migration layer'],
    resolvePath: () => '/accreditations',
  },
  analytics: {
    title: 'Analytics',
    description: 'Legacy analytics views are consolidated into Worker-backed workspace metrics and parity dashboards.',
    ownership: ['Analytics parity workspace', 'Dashboard summaries'],
    resolvePath: () => '/analytics',
  },
  actors: {
    title: 'Actors',
    description: 'Actor routes now resolve into the migrated actor registry and workspace team administration.',
    ownership: ['Actor parity workspace', 'Workspace team'],
    resolvePath: () => '/actors',
  },
  'asset-assessments': {
    title: 'Asset Assessments',
    description: 'Asset assessment semantics now resolve through resilience studies and the asset parity workspace.',
    ownership: ['Resilience workspace', 'Asset parity workspace'],
    resolvePath: (segments) =>
      segments[0] ? `/resilience/business-impact-analyses/${segments[0]}` : '/asset-assessments',
  },
  assets: {
    title: 'Assets',
    description: 'Legacy asset routes are mapped into the migrated asset inventory and resilience coverage.',
    ownership: ['Asset parity workspace', 'Business impact analysis detail'],
    resolvePath: () => '/assets',
  },
  'auditee-assessments': {
    title: 'Auditee Assessments',
    description: 'Auditee-facing assessment work is now handled through portal assignments.',
    ownership: ['Portal assignment workspace', 'Auditee submission workflow'],
    resolvePath: (segments) => (segments[0] ? `/portal/assignments/${segments[0]}` : '/portal'),
  },
  'auditee-dashboard': {
    title: 'Auditee Dashboard',
    description: 'Auditee dashboards now resolve into the migrated portal dashboard.',
    ownership: ['Portal dashboard', 'Assignment response workflow'],
    resolvePath: () => '/portal',
  },
  'backup-restore': {
    title: 'Backup and Restore',
    description: 'Backup and restore semantics are covered by imports, exports, and tenant-state verification.',
    ownership: ['Parity backup workspace', 'Reports/export pipeline', 'Import pipeline'],
    resolvePath: () => '/backup-restore',
  },
  'business-impact-analysis': {
    title: 'Business Impact Analysis',
    description: 'Legacy BIA detail, report, and visual views now resolve into the migrated resilience detail page.',
    ownership: ['Resilience detail workspace', 'Asset impact summaries'],
    resolvePath: (segments) =>
      segments[0] ? `/resilience/business-impact-analyses/${segments[0]}` : '/resilience',
  },
  calendar: {
    title: 'Calendar',
    description: 'Governance dates are now derived from portal deadlines, privacy requests, and treatment work.',
    ownership: ['Parity calendar workspace'],
    resolvePath: () => '/calendar',
  },
  'compliance-assessments': {
    title: 'Compliance Assessments',
    description: 'Compliance review routes now resolve into the migrated review, action-plan, and flash-mode workspaces.',
    ownership: ['Compliance assessment detail', 'Compliance action plan', 'Applied controls'],
    resolvePath: (segments) => {
      const [id, subview] = segments;
      if (!id) {
        return '/assessments';
      }
      if (subview === 'action-plan') {
        return `/compliance-assessments/${id}/action-plan`;
      }
      if (subview === 'flash-mode') {
        return `/compliance-assessments/${id}/flash-mode`;
      }
      if (subview === 'table-mode' || subview === 'assignments' || subview === 'advanced-analytics' || subview === 'evidences-list') {
        return `/compliance-assessments/${id}`;
      }
      return `/compliance-assessments/${id}`;
    },
  },
  contracts: {
    title: 'Contracts',
    description: 'Contract routes are owned by the third-party workspace in the migrated app.',
    ownership: ['Third-party workspace', 'Entity-centric supplier records'],
    resolvePath: () => '/third-party',
  },
  dashboards: {
    title: 'Dashboards',
    description: 'Dashboard and recap routes now resolve into the migrated dashboard and parity summary views.',
    ownership: ['Workspace dashboard', 'Parity dashboard view'],
    resolvePath: () => '/dashboards',
  },
  'ebios-rm': {
    title: 'EBIOS RM',
    description: 'Workshop, report, and visual routes now resolve into the advanced-risk EBIOS workspace.',
    ownership: ['EBIOS workspace', 'EBIOS study detail'],
    resolvePath: (segments) => (segments[0] ? `/advanced-risk/ebios/${segments[0]}` : '/advanced-risk/ebios'),
  },
  entities: {
    title: 'Entities',
    description: 'Entity routes are handled by the migrated third-party workspace and entity detail pages.',
    ownership: ['Third-party workspace', 'Entity detail'],
    resolvePath: (segments) => (segments[0] ? `/third-party/entities/${segments[0]}` : '/third-party'),
  },
  'entity-assessments': {
    title: 'Entity Assessments',
    description: 'Entity-assessment semantics are consolidated into third-party entity coverage and portal review work.',
    ownership: ['Third-party workspace', 'Entity detail assessment coverage'],
    resolvePath: () => '/third-party',
  },
  'evidence-revisions': {
    title: 'Evidence Revisions',
    description: 'Evidence revision routes now resolve into the Worker-backed evidence collection and artifact flow.',
    ownership: ['Evidence jobs', 'Evidence artifacts'],
    resolvePath: () => '/evidence/jobs',
  },
  evidences: {
    title: 'Evidences',
    description: 'Evidence records are now surfaced through evidence jobs, artifacts, and portal submission flows.',
    ownership: ['Evidence jobs', 'Evidence artifacts', 'Portal assignment workflow'],
    resolvePath: () => '/evidence/jobs',
  },
  experimental: {
    title: 'Experimental',
    description: 'Experimental routes now resolve into migrated parity workspaces instead of standalone Svelte sandboxes.',
    ownership: ['Program parity workspace'],
    resolvePath: () => '/experimental',
  },
  'first-connexion': {
    title: 'First Connection',
    description: 'Initial account-activation semantics now resolve into the migrated workspace identity surface.',
    ownership: ['Workspace identity', 'Settings parity workspace'],
    resolvePath: () => '/workspace/me',
  },
  'findings-assessments': {
    title: 'Findings Assessments',
    description: 'Findings-oriented validation routes are represented through validation flows and remediation workspaces.',
    ownership: ['Validation parity workspace', 'Action-plan workspaces'],
    resolvePath: () => '/findings-assessments',
  },
  folders: {
    title: 'Folders',
    description: 'Folder and domain routes now resolve into workspace domain administration.',
    ownership: ['Workspace domains'],
    resolvePath: () => '/workspace/domains',
  },
  'generic-collections': {
    title: 'Generic Collections',
    description: 'Collection semantics are mapped into the governance program parity workspace.',
    ownership: ['Program parity workspace'],
    resolvePath: () => '/generic-collections',
  },
  incidents: {
    title: 'Incidents',
    description: 'Incident-like routes now resolve into privacy breach handling and parity incident coverage.',
    ownership: ['Privacy workspace', 'Incident parity workspace'],
    resolvePath: () => '/incidents',
  },
  libraries: {
    title: 'Libraries',
    description: 'Library routes are owned by the migrated library catalog and detail pages.',
    ownership: ['Library catalog', 'Library detail'],
    resolvePath: (segments) => (segments[0] ? `/libraries/${segments[0]}` : '/libraries'),
  },
  'license-management': {
    title: 'License Management',
    description: 'Licensing and workspace configuration semantics now resolve into the parity program and settings workspaces.',
    ownership: ['Program parity workspace', 'Settings parity workspace'],
    resolvePath: () => '/license-management',
  },
  'loaded-libraries': {
    title: 'Loaded Libraries',
    description: 'Loaded-library routes now resolve into the migrated library detail workspace.',
    ownership: ['Library catalog', 'Library detail'],
    resolvePath: (segments) => (segments[0] ? `/libraries/${segments[0]}` : '/libraries'),
  },
  login: {
    title: 'Login',
    description: 'Authentication is currently represented through local identity switching and tenant-scoped Worker auth.',
    ownership: ['Workspace identity', 'Settings parity workspace'],
    resolvePath: () => '/workspace/me',
  },
  logout: {
    title: 'Logout',
    description: 'Session semantics are handled by the migrated identity model and demo session switching.',
    ownership: ['Workspace identity'],
    resolvePath: () => '/workspace/me',
  },
  'mapping-libraries': {
    title: 'Mapping Libraries',
    description: 'Mapping-library semantics now resolve into the unified library workspace.',
    ownership: ['Library catalog', 'Reference-control mapping'],
    resolvePath: () => '/libraries',
  },
  'metric-instances': {
    title: 'Metric Instances',
    description: 'Metric-instance routes now resolve into the analytics parity workspace.',
    ownership: ['Analytics parity workspace', 'Dashboard summaries'],
    resolvePath: () => '/metric-instances',
  },
  'my-assignments': {
    title: 'My Assignments',
    description: 'User assignment queues are now handled through the portal dashboard.',
    ownership: ['Portal dashboard'],
    resolvePath: () => '/portal',
  },
  'my-profile': {
    title: 'My Profile',
    description: 'Profile, password, MFA, and local identity switching now resolve into the workspace profile/settings surface.',
    ownership: ['Workspace identity', 'Settings parity workspace'],
    resolvePath: () => '/workspace/me',
  },
  'operating-modes': {
    title: 'Operating Modes',
    description: 'Operating-mode semantics are now consolidated into the EBIOS RM workspace.',
    ownership: ['EBIOS workspace'],
    resolvePath: () => '/advanced-risk/ebios',
  },
  'operational-scenarios': {
    title: 'Operational Scenarios',
    description: 'Operational-scenario routes are owned by the migrated EBIOS RM workspace.',
    ownership: ['EBIOS workspace'],
    resolvePath: () => '/advanced-risk/ebios',
  },
  'password-reset': {
    title: 'Password Reset',
    description: 'Password lifecycle routes now resolve into the migrated identity/settings surface.',
    ownership: ['Workspace identity', 'Settings parity workspace'],
    resolvePath: () => '/workspace/me',
  },
  policies: {
    title: 'Policies',
    description: 'Policy routes now resolve into frameworks, controls, and governance library pages.',
    ownership: ['Framework detail', 'Policy parity workspace'],
    resolvePath: () => '/policies',
  },
  'preset-journeys': {
    title: 'Preset Journeys',
    description: 'Preset-journey semantics now resolve into quick-start and program parity workspaces.',
    ownership: ['Quick-start parity workspace', 'Program parity workspace'],
    resolvePath: () => '/preset-journeys',
  },
  presets: {
    title: 'Presets',
    description: 'Preset semantics are covered by the migrated program parity workspace.',
    ownership: ['Program parity workspace'],
    resolvePath: () => '/presets',
  },
  processings: {
    title: 'Processings',
    description: 'Processing routes now resolve into the privacy workspace and processing detail pages.',
    ownership: ['Privacy workspace', 'Processing detail'],
    resolvePath: (segments) => (segments[0] ? `/privacy/processings/${segments[0]}` : '/privacy'),
  },
  'quantitative-risk-hypotheses': {
    title: 'Quantitative Risk Hypotheses',
    description: 'Hypothesis routes now resolve into the migrated quantitative-study workspace.',
    ownership: ['Quantitative workspace', 'Hypothesis detail'],
    resolvePath: (segments) =>
      segments[0] ? `/quantitative-risk-hypotheses/${segments[0]}` : '/advanced-risk/quantitative',
  },
  'quantitative-risk-scenarios': {
    title: 'Quantitative Risk Scenarios',
    description: 'Scenario routes now resolve into the migrated quantitative-study workspace.',
    ownership: ['Quantitative workspace', 'Scenario detail'],
    resolvePath: (segments) =>
      segments[0] ? `/quantitative-risk-scenarios/${segments[0]}` : '/advanced-risk/quantitative',
  },
  'quantitative-risk-studies': {
    title: 'Quantitative Risk Studies',
    description: 'Quantitative study routes now resolve into the migrated advanced-risk workspace.',
    ownership: ['Quantitative workspace', 'Study detail', 'Executive summary', 'Action plan'],
    resolvePath: (segments) => {
      const [id, subview] = segments;
      if (!id) {
        return '/advanced-risk/quantitative';
      }
      if (subview === 'executive-summary') {
        return `/advanced-risk/quantitative/${id}/executive-summary`;
      }
      if (subview === 'key-metrics') {
        return `/advanced-risk/quantitative/${id}/key-metrics`;
      }
      if (subview === 'action-plan') {
        return `/advanced-risk/quantitative/${id}/action-plan`;
      }
      return `/advanced-risk/quantitative/${id}`;
    },
  },
  'quick-start': {
    title: 'Quick Start',
    description: 'Quick-start flows now resolve into the parity onboarding workspace built from real tenant data.',
    ownership: ['Quick-start parity workspace'],
    resolvePath: () => '/quick-start',
  },
  recap: {
    title: 'Recap',
    description: 'Recap views now resolve into the migrated dashboard summary layer.',
    ownership: ['Dashboard', 'Parity dashboard workspace'],
    resolvePath: () => '/recap',
  },
  reports: {
    title: 'Reports',
    description: 'Legacy reports and downloads now resolve into the Worker-backed export workspace.',
    ownership: ['Reports catalog', 'DORA report export'],
    resolvePath: (segments) => (segments[0] === 'dora-roi' ? '/reports/dora-roi' : '/reports'),
  },
  'requirement-assessments': {
    title: 'Requirement Assessments',
    description: 'Requirement assessments are covered by migrated compliance reviews, portal submissions, and validation flows.',
    ownership: ['Compliance assessment detail', 'Validation parity workspace', 'Portal workflow'],
    resolvePath: () => '/requirement-assessments',
  },
  'requirement-mapping-sets': {
    title: 'Requirement Mapping Sets',
    description: 'Requirement-mapping routes now resolve into the library and mapping parity workspaces.',
    ownership: ['Library workspace', 'Mapping parity workspace'],
    resolvePath: () => '/requirement-mapping-sets',
  },
  'risk-assessments': {
    title: 'Risk Assessments',
    description: 'Risk-assessment routes now resolve into the migrated assessment detail and risk-treatment workspaces.',
    ownership: ['Risk assessment detail', 'Risk action plan', 'Quantitative conversion'],
    resolvePath: (segments) => {
      const [id, subview] = segments;
      if (!id) {
        return '/assessments';
      }
      if (subview === 'action-plan' || subview === 'sync-to-actions' || subview === 'export') {
        return `/risk-assessments/${id}/action-plan`;
      }
      if (subview === 'convert-to-quantitative') {
        return `/risk-assessments/${id}/convert-to-quantitative`;
      }
      return `/risk-assessments/${id}`;
    },
  },
  'risk-matrices': {
    title: 'Risk Matrices',
    description: 'Risk-matrix routes now resolve into the migrated dashboard and resilience summary surfaces.',
    ownership: ['Risk matrix parity workspace'],
    resolvePath: () => '/risk-matrices',
  },
  'risk-scenarios': {
    title: 'Risk Scenarios',
    description: 'Risk-scenario routes now resolve into the migrated register and scenario workspace.',
    ownership: ['Risk scenarios workspace', 'Risk assessment detail'],
    resolvePath: () => '/risk-scenarios',
  },
  'ro-to': {
    title: 'RO/TO',
    description: 'RO/TO routes are now covered by the migrated EBIOS RM workspace.',
    ownership: ['EBIOS workspace'],
    resolvePath: () => '/advanced-risk/ebios',
  },
  'scoring-assistant': {
    title: 'Scoring Assistant',
    description: 'The scoring assistant is now represented through the migrated chat and analysis workspace.',
    ownership: ['Chat workspace'],
    resolvePath: () => '/chat',
  },
  search: {
    title: 'Search',
    description: 'Search routes now resolve into the Worker-backed parity search index.',
    ownership: ['Search parity workspace'],
    resolvePath: () => '/search',
  },
  'security-exceptions': {
    title: 'Security Exceptions',
    description: 'Exception routes are represented through non-compliance review and validation flows.',
    ownership: ['Exception parity workspace', 'Compliance review'],
    resolvePath: () => '/security-exceptions',
  },
  settings: {
    title: 'Settings',
    description: 'Settings, webhooks, SSO, and environment-style routes now resolve into the settings parity workspace.',
    ownership: ['Settings parity workspace', 'Workspace identity'],
    resolvePath: () => '/settings',
  },
  'setup-mfa': {
    title: 'MFA Setup',
    description: 'MFA and related authentication setup semantics now resolve into the canonical security posture workspace.',
    ownership: ['Setup security', 'Workspace identity'],
    resolvePath: () => '/setup/security',
  },
  stakeholders: {
    title: 'Stakeholders',
    description: 'Stakeholder routes now resolve into the EBIOS RM workspace.',
    ownership: ['EBIOS workspace'],
    resolvePath: () => '/advanced-risk/ebios',
  },
  'stored-libraries': {
    title: 'Stored Libraries',
    description: 'Stored-library routes now resolve into the migrated library detail workspace.',
    ownership: ['Library catalog', 'Library detail'],
    resolvePath: (segments) => (segments[0] ? `/libraries/${segments[0]}` : '/libraries'),
  },
  'strategic-scenarios': {
    title: 'Strategic Scenarios',
    description: 'Strategic-scenario routes are now covered by the EBIOS RM workspace.',
    ownership: ['EBIOS workspace'],
    resolvePath: () => '/advanced-risk/ebios',
  },
  sso: {
    title: 'Single Sign-On',
    description: 'SSO and authentication setup routes now resolve into the canonical security posture workspace.',
    ownership: ['Setup security', 'Workspace identity'],
    resolvePath: () => '/setup/security',
  },
  'sync-mappings': {
    title: 'Sync Mappings',
    description: 'Integration and sync-mapping routes are represented through the migrated mapping parity workspace.',
    ownership: ['Mapping parity workspace', 'Library workspace'],
    resolvePath: () => '/sync-mappings',
  },
  'task-nodes': {
    title: 'Task Nodes',
    description: 'Task-node routes now resolve into migrated remediation workspaces.',
    ownership: ['Applied controls', 'Risk action plan'],
    resolvePath: () => '/task-nodes',
  },
  'task-templates': {
    title: 'Task Templates',
    description: 'Task-template routes now resolve into migrated remediation workspaces.',
    ownership: ['Applied controls', 'Risk action plan'],
    resolvePath: () => '/task-templates',
  },
  users: {
    title: 'Users',
    description: 'User administration routes now resolve into the migrated workspace team page.',
    ownership: ['Workspace team', 'Workspace access'],
    resolvePath: () => '/workspace/team',
  },
  'validation-flows': {
    title: 'Validation Flows',
    description: 'Validation routes are represented through export readiness, compliance review, and portal validation work.',
    ownership: ['Validation parity workspace'],
    resolvePath: () => '/validation-flows',
  },
  vulnerabilities: {
    title: 'Vulnerabilities',
    description: 'Vulnerability routes now resolve into the migrated risk scenario workspace.',
    ownership: ['Risk scenarios workspace'],
    resolvePath: () => '/vulnerabilities',
  },
  'x-rays': {
    title: 'X-Rays',
    description: 'Operational x-ray routes now resolve into the migrated runtime and tenant diagnostics workspace.',
    ownership: ['X-ray parity workspace'],
    resolvePath: () => '/x-rays',
  },
};

export function LegacyRouteBridgePage({ legacyModel }: LegacyRouteBridgePageProps) {
  const location = useLocation();
  const params = useParams();
  const config = LEGACY_ROUTE_CONFIG[legacyModel];
  const wildcard = params['*'] ?? '';
  const segments = wildcard.split('/').filter(Boolean);
  const canonicalPath = config?.resolvePath(segments) ?? '/';

  if (!config) {
    return (
      <div className="panel p-6">
        <div className="eyebrow">Older Link</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">This route is not mapped yet</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          This bookmarked path does not have a dedicated mapping yet. You can still continue from Home, Search, or the Program workspace.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link className="button-primary" to="/">
            Open Home
          </Link>
          <Link className="button-secondary" to="/search">
            Search the workspace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="eyebrow">Older Link</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">{config.title} moved</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          This link points to an older route. Regovise mapped it to the closest current workspace so you can keep moving without hunting through the app.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="panel-subtle">
            <div className="label">Requested path</div>
            <div className="mt-3 font-mono text-xs text-cyan-200">{location.pathname}</div>
            {segments.length > 0 && (
              <div className="mt-3 text-sm text-slate-300">
                Route details: <span className="font-mono text-cyan-200">{segments.join(' / ')}</span>
              </div>
            )}
          </div>
          <div className="panel-subtle">
            <div className="label">Current workspace</div>
            <div className="mt-3">
              <Link className="button-primary" to={canonicalPath}>
                Open current workspace
              </Link>
            </div>
            <div className="mt-3 font-mono text-xs text-slate-400">{canonicalPath}</div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="eyebrow">Need a different starting point?</div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Link className="panel-subtle text-sm text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]" to="/">
            Home
          </Link>
          <Link className="panel-subtle text-sm text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]" to="/program">
            Program Workspace
          </Link>
          <Link className="panel-subtle text-sm text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.03]" to="/search">
            Search the workspace
          </Link>
        </div>
      </section>
    </div>
  );
}
