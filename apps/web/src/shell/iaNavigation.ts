import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Boxes,
  Building2,
  ClipboardCheck,
  Compass,
  Cpu,
  Database,
  Eye,
  FileOutput,
  FileText,
  Gauge,
  GitBranch,
  Link2,
  Lock,
  MessageSquare,
  PlayCircle,
  Search,
  ServerCog,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  User,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { canAccessShellRoute, type ShellAccessProfile } from './shellAccess';

export type IaAudience = 'standard' | 'admin' | 'internal';

export type IaPreservationState =
  | 'primary-nav'
  | 'secondary-nav'
  | 'local-tab'
  | 'contextual-action'
  | 'search-alias'
  | 'legacy-route'
  | 'admin-only'
  | 'internal-only';

export type IaNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  audience: IaAudience;
  preservation: IaPreservationState;
  keywords?: string[];
};

export type IaNavGroup = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  audience?: IaAudience;
  items: IaNavItem[];
};

export type IaRouteFamily = {
  pattern: string;
  group: string;
  state: IaPreservationState;
  audience: IaAudience;
};

const item = (entry: IaNavItem): IaNavItem => entry;

export const IA_NAV_GROUPS: IaNavGroup[] = [
  {
    id: 'home',
    label: 'Home',
    description: 'Workspace overview, search, and operational analytics.',
    icon: Gauge,
    items: [
      item({ to: '/', label: 'Home', icon: Gauge, audience: 'standard', preservation: 'primary-nav' }),
      item({ to: '/search', label: 'Find anything', icon: Search, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/analytics', label: 'Analytics', icon: BarChart3, audience: 'standard', preservation: 'secondary-nav' }),
    ],
  },
  {
    id: 'starter-guide',
    label: 'Starter Guide',
    description: 'Guided setup and onboarding work.',
    icon: PlayCircle,
    audience: 'admin',
    items: [
      item({ to: '/program/setup', label: 'Starter Guide', icon: PlayCircle, audience: 'admin', preservation: 'primary-nav' }),
    ],
  },
  {
    id: 'work-queue',
    label: 'Work Queue',
    description: 'User-owned tasks, findings, and assurance review work.',
    icon: ClipboardCheck,
    items: [
      item({ to: '/workspace/me', label: 'My Access', icon: User, audience: 'standard', preservation: 'primary-nav' }),
      item({ to: '/tasks', label: 'Tasks', icon: ClipboardCheck, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/findings', label: 'Findings', icon: Search, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/assurance/reviews', label: 'Review Queue', icon: ClipboardCheck, audience: 'standard', preservation: 'secondary-nav' }),
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    description: 'Frameworks, controls, assessments, policies, documents, audits, and findings.',
    icon: ShieldCheck,
    items: [
      item({ to: '/program', label: 'Overview', icon: Compass, audience: 'standard', preservation: 'primary-nav' }),
      item({ to: '/frameworks', label: 'Frameworks', icon: GitBranch, audience: 'standard', preservation: 'primary-nav' }),
      item({ to: '/framework-library', label: 'Framework Library', icon: BookOpen, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/libraries', label: 'Libraries', icon: BookOpen, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/modules', label: 'Modules', icon: Boxes, audience: 'standard', preservation: 'legacy-route' }),
      item({ to: '/security-controls', label: 'Controls', icon: Shield, audience: 'standard', preservation: 'primary-nav' }),
      item({ to: '/assessments', label: 'Assessments and Tests', icon: ClipboardCheck, audience: 'standard', preservation: 'primary-nav' }),
      item({ to: '/gap-assessments', label: 'Gap Assessments', icon: ClipboardCheck, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/policies', label: 'Policies', icon: FileText, audience: 'standard', preservation: 'primary-nav' }),
      item({ to: '/evidence-locker', label: 'Documents and Evidence', icon: Database, audience: 'standard', preservation: 'primary-nav' }),
      item({ to: '/assessment-evidence-packages', label: 'Audit Packages', icon: Upload, audience: 'standard', preservation: 'secondary-nav' }),
    ],
  },
  {
    id: 'risk',
    label: 'Risk',
    description: 'Risk library, register, scenarios, EBIOS, quantitative studies, incidents, and actions.',
    icon: Activity,
    items: [
      item({ to: '/risk-scenarios', label: 'Risk Library', icon: Activity, audience: 'standard', preservation: 'primary-nav' }),
      item({ to: '/risks', label: 'Risk Register', icon: Shield, audience: 'standard', preservation: 'primary-nav' }),
      item({ to: '/risk-actions', label: 'Action Tracker', icon: ClipboardCheck, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/threat-models', label: 'Threat Models', icon: GitBranch, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/advanced-risk/ebios', label: 'EBIOS RM', icon: ShieldCheck, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/advanced-risk/quantitative', label: 'Quantitative Risk', icon: BarChart3, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/incidents', label: 'Incidents', icon: Activity, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/security-exceptions', label: 'Exceptions', icon: Shield, audience: 'standard', preservation: 'secondary-nav' }),
    ],
  },
  {
    id: 'evidence-assurance',
    label: 'Evidence and Assurance',
    description: 'Evidence collection, monitoring, packages, reviews, trackers, and agent runs.',
    icon: Database,
    items: [
      item({ to: '/evidence-management', label: 'Evidence Workspace', icon: Database, audience: 'standard', preservation: 'primary-nav' }),
      item({ to: '/evidence/jobs', label: 'Collection Jobs', icon: Cpu, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/conmon/executions', label: 'Monitoring Runs', icon: PlayCircle, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/assurance', label: 'Assurance Overview', icon: Gauge, audience: 'standard', preservation: 'primary-nav' }),
      item({ to: '/assurance/evidence', label: 'Evidence Explorer', icon: Search, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/assurance/tracker', label: 'Tracker Workbench', icon: Upload, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/assurance/packages', label: '20x Packages', icon: FileOutput, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/assurance/agent-runs', label: 'Agent Runs', icon: Bot, audience: 'standard', preservation: 'secondary-nav' }),
    ],
  },
  {
    id: 'vendors-trust',
    label: 'Vendors and Trust',
    description: 'Third-party risk, customer trust, portals, and questionnaires.',
    icon: Building2,
    items: [
      item({ to: '/third-party', label: 'Vendors', icon: Building2, audience: 'standard', preservation: 'primary-nav' }),
      item({ to: '/portal', label: 'External Portal', icon: Link2, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/questionnaires', label: 'Questionnaires', icon: ClipboardCheck, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/trust-center', label: 'Trust Center', icon: ShieldCheck, audience: 'admin', preservation: 'admin-only' }),
    ],
  },
  {
    id: 'assets-systems',
    label: 'Assets and Systems',
    description: 'Assets, systems, integrations, interconnections, and supply chain scope.',
    icon: Boxes,
    items: [
      item({ to: '/assets', label: 'Assets', icon: Boxes, audience: 'standard', preservation: 'primary-nav' }),
      item({ to: '/components', label: 'Components', icon: Cpu, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/interconnections', label: 'Interconnections', icon: Link2, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/supply-chain', label: 'Supply Chain', icon: Building2, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/integrations', label: 'Integrations', icon: ServerCog, audience: 'admin', preservation: 'admin-only' }),
    ],
  },
  {
    id: 'people-access',
    label: 'People and Access',
    description: 'Personnel, roles, workspace access, SSO, MFA, and service accounts.',
    icon: Users,
    items: [
      item({ to: '/workspace/team', label: 'People', icon: Users, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/workspace/access', label: 'Access', icon: Shield, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/setup/sso', label: 'SSO', icon: Lock, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/setup/mfa', label: 'MFA', icon: ShieldCheck, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/setup/service-accounts', label: 'Service Accounts', icon: User, audience: 'admin', preservation: 'admin-only' }),
    ],
  },
  {
    id: 'privacy-resilience',
    label: 'Privacy and Resilience',
    description: 'Privacy processing, resilience, incidents, and exception handling.',
    icon: Lock,
    items: [
      item({ to: '/privacy', label: 'Privacy', icon: Lock, audience: 'standard', preservation: 'primary-nav' }),
      item({ to: '/resilience', label: 'Resilience', icon: Activity, audience: 'standard', preservation: 'primary-nav' }),
      item({ to: '/incidents', label: 'Incidents', icon: Activity, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/security-exceptions', label: 'Exceptions', icon: Shield, audience: 'standard', preservation: 'secondary-nav' }),
    ],
  },
  {
    id: 'reports-exports',
    label: 'Reports and Exports',
    description: 'Reports, DORA ROI, bundles, report builder, and compliance exports.',
    icon: FileOutput,
    items: [
      item({ to: '/reports', label: 'Reports', icon: FileOutput, audience: 'standard', preservation: 'primary-nav' }),
      item({ to: '/reports/dora-roi', label: 'DORA ROI', icon: BarChart3, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/report-bundles', label: 'Report Bundles', icon: FileOutput, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/builders/report-builder', label: 'Report Builder', icon: BarChart3, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/compliance-exports', label: 'Compliance Exports', icon: FileOutput, audience: 'admin', preservation: 'admin-only' }),
    ],
  },
  {
    id: 'automation-builders',
    label: 'Automation and Builders',
    description: 'Workspace AI, response automation, evidence mapping, RegML, imports, and builders.',
    icon: Sparkles,
    items: [
      item({ to: '/chat', label: 'Workspace AI', icon: MessageSquare, audience: 'standard', preservation: 'primary-nav' }),
      item({ to: '/workbench', label: 'Workbench', icon: Compass, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/workflow', label: 'Workflow', icon: Workflow, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/utilities', label: 'Utilities', icon: SlidersHorizontal, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/subsystems', label: 'Subsystems', icon: ServerCog, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/news-feed', label: 'News Feed', icon: MessageSquare, audience: 'standard', preservation: 'secondary-nav' }),
      item({ to: '/builders', label: 'Builder Launcher', icon: Sparkles, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/response-automation', label: 'Response Automation', icon: Bot, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/evidence-mapping', label: 'Evidence Mapping', icon: Link2, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/features/regml', label: 'AI Authoring', icon: Sparkles, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/builders/form-builder', label: 'Form Builder', icon: SlidersHorizontal, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/builders/rules-builder', label: 'Rules Builder', icon: Workflow, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/builders/export-builder', label: 'Export Builder', icon: FileOutput, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/builders/dashboard-builder', label: 'Dashboard Builder', icon: Gauge, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/builders/questionnaire-builder', label: 'Questionnaire Builder', icon: ClipboardCheck, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/builders/wayfinder-builder', label: 'Wayfinder Builder', icon: Compass, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/imports', label: 'Imports', icon: Upload, audience: 'admin', preservation: 'admin-only' }),
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    description: 'Workspace settings, scope, content governance, monitoring profiles, and internal utilities.',
    icon: SlidersHorizontal,
    audience: 'admin',
    items: [
      item({ to: '/setup/general', label: 'Workspace Settings', icon: SlidersHorizontal, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/setup/security', label: 'Security', icon: ShieldCheck, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/workspace/domains', label: 'Scope', icon: Boxes, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/setup/tags', label: 'Tags', icon: FileText, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/setup/classification', label: 'Classification', icon: BookOpen, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/setup/modules-features', label: 'Modules and Features', icon: Boxes, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/setup/risk-model', label: 'Risk Model', icon: Activity, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/evidence/sources', label: 'Evidence Sources', icon: Database, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/conmon/profiles', label: 'Monitoring Profiles', icon: Eye, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/grc-admin', label: 'GRC Content and AI', icon: ServerCog, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/grc-admin/scrutiny-engine', label: 'Scrutiny Engine', icon: ClipboardCheck, audience: 'admin', preservation: 'admin-only' }),
      item({ to: '/settings', label: 'Platform Settings', icon: ServerCog, audience: 'internal', preservation: 'internal-only' }),
    ],
  },
];

export const IA_ROUTE_FAMILIES: IaRouteFamily[] = [
  { pattern: '/accreditations/*', group: 'Compliance', state: 'legacy-route', audience: 'standard' },
  { pattern: '/analytics/*', group: 'Home', state: 'legacy-route', audience: 'standard' },
  { pattern: '/actors/*', group: 'Risk', state: 'legacy-route', audience: 'standard' },
  { pattern: '/asset-assessments/*', group: 'Privacy and Resilience', state: 'legacy-route', audience: 'standard' },
  { pattern: '/assets/*', group: 'Assets and Systems', state: 'legacy-route', audience: 'standard' },
  { pattern: '/auditee-assessments/*', group: 'Vendors and Trust', state: 'legacy-route', audience: 'standard' },
  { pattern: '/auditee-dashboard/*', group: 'Vendors and Trust', state: 'legacy-route', audience: 'standard' },
  { pattern: '/backup-restore/*', group: 'Admin', state: 'admin-only', audience: 'admin' },
  { pattern: '/business-impact-analysis/*', group: 'Privacy and Resilience', state: 'legacy-route', audience: 'standard' },
  { pattern: '/calendar/*', group: 'Home', state: 'legacy-route', audience: 'standard' },
  { pattern: '/compliance-assessments/*', group: 'Compliance', state: 'contextual-action', audience: 'standard' },
  { pattern: '/contracts/*', group: 'Vendors and Trust', state: 'legacy-route', audience: 'standard' },
  { pattern: '/dashboards/*', group: 'Home', state: 'legacy-route', audience: 'standard' },
  { pattern: '/ebios-rm/*', group: 'Risk', state: 'legacy-route', audience: 'standard' },
  { pattern: '/entities/*', group: 'Vendors and Trust', state: 'legacy-route', audience: 'standard' },
  { pattern: '/entity-assessments/*', group: 'Vendors and Trust', state: 'legacy-route', audience: 'standard' },
  { pattern: '/evidence-revisions/*', group: 'Evidence and Assurance', state: 'legacy-route', audience: 'standard' },
  { pattern: '/evidences/*', group: 'Evidence and Assurance', state: 'legacy-route', audience: 'standard' },
  { pattern: '/experimental/*', group: 'Home', state: 'legacy-route', audience: 'standard' },
  { pattern: '/findings-assessments/*', group: 'Compliance', state: 'legacy-route', audience: 'standard' },
  { pattern: '/first-connexion/*', group: 'Starter Guide', state: 'legacy-route', audience: 'standard' },
  { pattern: '/folders/*', group: 'Admin', state: 'admin-only', audience: 'admin' },
  { pattern: '/generic-collections/*', group: 'Home', state: 'legacy-route', audience: 'standard' },
  { pattern: '/incidents/*', group: 'Risk', state: 'legacy-route', audience: 'standard' },
  { pattern: '/libraries/*', group: 'Compliance', state: 'legacy-route', audience: 'standard' },
  { pattern: '/license-management/*', group: 'Admin', state: 'admin-only', audience: 'admin' },
  { pattern: '/loaded-libraries/*', group: 'Compliance', state: 'legacy-route', audience: 'standard' },
  { pattern: '/mapping-libraries/*', group: 'Compliance', state: 'legacy-route', audience: 'standard' },
  { pattern: '/metric-instances/*', group: 'Home', state: 'legacy-route', audience: 'standard' },
  { pattern: '/my-assignments/*', group: 'Vendors and Trust', state: 'legacy-route', audience: 'standard' },
  { pattern: '/my-profile/*', group: 'Work Queue', state: 'legacy-route', audience: 'standard' },
  { pattern: '/operating-modes/*', group: 'Risk', state: 'legacy-route', audience: 'standard' },
  { pattern: '/operational-scenarios/*', group: 'Risk', state: 'legacy-route', audience: 'standard' },
  { pattern: '/password-reset/*', group: 'Work Queue', state: 'legacy-route', audience: 'standard' },
  { pattern: '/policies/*', group: 'Compliance', state: 'legacy-route', audience: 'standard' },
  { pattern: '/preset-journeys/*', group: 'Home', state: 'legacy-route', audience: 'standard' },
  { pattern: '/presets/*', group: 'Home', state: 'legacy-route', audience: 'standard' },
  { pattern: '/processings/*', group: 'Privacy and Resilience', state: 'legacy-route', audience: 'standard' },
  { pattern: '/quantitative-risk-hypotheses/*', group: 'Risk', state: 'legacy-route', audience: 'standard' },
  { pattern: '/quantitative-risk-scenarios/*', group: 'Risk', state: 'legacy-route', audience: 'standard' },
  { pattern: '/quantitative-risk-studies/*', group: 'Risk', state: 'legacy-route', audience: 'standard' },
  { pattern: '/quick-start/*', group: 'Starter Guide', state: 'admin-only', audience: 'admin' },
  { pattern: '/recap/*', group: 'Home', state: 'legacy-route', audience: 'standard' },
  { pattern: '/reports/*', group: 'Reports and Exports', state: 'legacy-route', audience: 'standard' },
  { pattern: '/requirement-assessments/*', group: 'Compliance', state: 'legacy-route', audience: 'standard' },
  { pattern: '/requirement-mapping-sets/*', group: 'Compliance', state: 'legacy-route', audience: 'standard' },
  { pattern: '/risk-assessments/*', group: 'Risk', state: 'contextual-action', audience: 'standard' },
  { pattern: '/risk-matrices/*', group: 'Risk', state: 'legacy-route', audience: 'standard' },
  { pattern: '/risk-scenarios/*', group: 'Risk', state: 'legacy-route', audience: 'standard' },
  { pattern: '/ro-to/*', group: 'Risk', state: 'legacy-route', audience: 'standard' },
  { pattern: '/scoring-assistant/*', group: 'Automation and Builders', state: 'legacy-route', audience: 'standard' },
  { pattern: '/search/*', group: 'Home', state: 'search-alias', audience: 'standard' },
  { pattern: '/security-profiles/*', group: 'Risk', state: 'legacy-route', audience: 'standard' },
  { pattern: '/security-exceptions/*', group: 'Risk', state: 'legacy-route', audience: 'standard' },
  { pattern: '/settings/*', group: 'Admin', state: 'internal-only', audience: 'internal' },
  { pattern: '/setup-mfa/*', group: 'People and Access', state: 'admin-only', audience: 'admin' },
  { pattern: '/stakeholders/*', group: 'Risk', state: 'legacy-route', audience: 'standard' },
  { pattern: '/stored-libraries/*', group: 'Compliance', state: 'legacy-route', audience: 'standard' },
  { pattern: '/strategic-scenarios/*', group: 'Risk', state: 'legacy-route', audience: 'standard' },
  { pattern: '/sso/*', group: 'People and Access', state: 'admin-only', audience: 'admin' },
  { pattern: '/sync-mappings/*', group: 'Compliance', state: 'legacy-route', audience: 'standard' },
  { pattern: '/task-nodes/*', group: 'Work Queue', state: 'legacy-route', audience: 'standard' },
  { pattern: '/task-templates/*', group: 'Work Queue', state: 'legacy-route', audience: 'standard' },
  { pattern: '/users/*', group: 'People and Access', state: 'admin-only', audience: 'admin' },
  { pattern: '/validation-flows/*', group: 'Compliance', state: 'legacy-route', audience: 'standard' },
  { pattern: '/vulnerabilities/*', group: 'Risk', state: 'legacy-route', audience: 'standard' },
  { pattern: '/x-rays/*', group: 'Home', state: 'legacy-route', audience: 'standard' },
  { pattern: '/modules/*', group: 'Compliance', state: 'legacy-route', audience: 'standard' },
  { pattern: '/features/workbench/*', group: 'Automation and Builders', state: 'secondary-nav', audience: 'standard' },
  { pattern: '/features/workflow/*', group: 'Automation and Builders', state: 'secondary-nav', audience: 'standard' },
  { pattern: '/features/utilities/*', group: 'Automation and Builders', state: 'secondary-nav', audience: 'standard' },
  { pattern: '/features/subsystems/*', group: 'Automation and Builders', state: 'secondary-nav', audience: 'standard' },
  { pattern: '/features/news-feed/*', group: 'Automation and Builders', state: 'secondary-nav', audience: 'standard' },
  { pattern: '/features/*', group: 'Automation and Builders', state: 'legacy-route', audience: 'admin' },
  { pattern: '/builders/*', group: 'Automation and Builders', state: 'legacy-route', audience: 'admin' },
  { pattern: '/setup/*', group: 'Admin', state: 'admin-only', audience: 'admin' },
  { pattern: '/logs', group: 'Admin', state: 'admin-only', audience: 'admin' },
  { pattern: '/questionnaires/response/:shareToken', group: 'Vendors and Trust', state: 'contextual-action', audience: 'standard' },
  { pattern: '/portal/assignments/:assignmentId', group: 'Vendors and Trust', state: 'contextual-action', audience: 'standard' },
  { pattern: '/risk-actions', group: 'Risk', state: 'secondary-nav', audience: 'standard' },
  { pattern: '/advanced-risk/ebios/*', group: 'Risk', state: 'secondary-nav', audience: 'standard' },
  { pattern: '/advanced-risk/quantitative/*', group: 'Risk', state: 'secondary-nav', audience: 'standard' },
  { pattern: '/utilities/*', group: 'Automation and Builders', state: 'legacy-route', audience: 'standard' },
  { pattern: '/subsystems/*', group: 'Automation and Builders', state: 'legacy-route', audience: 'standard' },
  { pattern: '/workflow/*', group: 'Automation and Builders', state: 'legacy-route', audience: 'standard' },
  { pattern: '/workbench/*', group: 'Automation and Builders', state: 'legacy-route', audience: 'standard' },
  { pattern: '/news-feed/*', group: 'Automation and Builders', state: 'legacy-route', audience: 'standard' },
  { pattern: '/vanta-clone/*', group: 'Automation and Builders', state: 'legacy-route', audience: 'standard' },
];

export const CANONICAL_IA_GROUP_LABELS = IA_NAV_GROUPS.map((group) => group.label);

function canSeeAudience(audience: IaAudience | undefined, access: ShellAccessProfile): boolean {
  if (audience === 'admin') {
    return access.canViewAdminNavigation;
  }

  if (audience === 'internal') {
    return access.canViewInternalTools;
  }

  return true;
}

export function canSeeIaNavItem(itemToCheck: IaNavItem, access: ShellAccessProfile): boolean {
  return canSeeAudience(itemToCheck.audience, access) && canAccessShellRoute(itemToCheck.to, access);
}

export function getVisibleIaGroups(access: ShellAccessProfile): IaNavGroup[] {
  return IA_NAV_GROUPS.flatMap((group) => {
    if (!canSeeAudience(group.audience, access)) {
      return [];
    }

    const items = group.items.filter((navItem) => canSeeIaNavItem(navItem, access));
    return items.length > 0 ? [{ ...group, items }] : [];
  });
}

export function flattenIaNavItems(groups: IaNavGroup[] = IA_NAV_GROUPS): IaNavItem[] {
  return groups.flatMap((group) => group.items);
}
