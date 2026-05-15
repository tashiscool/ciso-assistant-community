import type { IamMePayload } from '../features/iam/types';

const WORKSPACE_ADMIN_PERMISSIONS = new Set([
  'add_user',
  'change_user',
  'delete_user',
  'add_usergroup',
  'change_usergroup',
  'delete_usergroup',
  'add_role',
  'change_role',
  'delete_role',
  'add_roleassignment',
  'change_roleassignment',
  'delete_roleassignment',
  'add_folder',
  'change_folder',
  'delete_folder',
]);

const FRAMEWORK_READ_PERMISSIONS = new Set(['view_framework', 'add_framework', 'change_framework']);
const RISK_READ_PERMISSIONS = new Set([
  'view_riskregister',
  'add_riskregister',
  'change_riskregister',
  'view_riskscenario',
  'add_riskscenario',
  'change_riskscenario',
]);
const TPRM_READ_PERMISSIONS = new Set([
  'view_entity',
  'add_entity',
  'change_entity',
  'view_solution',
  'add_solution',
  'change_solution',
  'view_contract',
  'add_contract',
  'change_contract',
  'view_entityassessment',
  'add_entityassessment',
  'change_entityassessment',
]);
const PRIVACY_READ_PERMISSIONS = new Set([
  'view_processing',
  'add_processing',
  'change_processing',
  'view_rightrequest',
  'add_rightrequest',
  'change_rightrequest',
  'view_databreach',
  'add_databreach',
  'change_databreach',
]);
const RESILIENCE_READ_PERMISSIONS = new Set(['view_bia', 'add_bia', 'change_bia']);
const EVIDENCE_READ_PERMISSIONS = new Set(['view_evidence', 'collect_evidence']);
const CONMON_READ_PERMISSIONS = new Set(['view_conmon', 'run_conmon']);
const OPERATIONS_READ_PERMISSIONS = new Set([
  ...FRAMEWORK_READ_PERMISSIONS,
  ...RISK_READ_PERMISSIONS,
  ...EVIDENCE_READ_PERMISSIONS,
  ...CONMON_READ_PERMISSIONS,
]);

export type ShellAccessProfile = {
  isWorkspaceAdmin: boolean;
  canViewAdminNavigation: boolean;
  canViewInternalTools: boolean;
  isAuditee: boolean;
  canUseSearch: boolean;
  canUseAnalytics: boolean;
  canUseProgramWorkspace: boolean;
  canUseLibraries: boolean;
  canUseFrameworks: boolean;
  canUseAssessmentWorkspace: boolean;
  canUseComplianceAssessments: boolean;
  canUseRiskAssessments: boolean;
  canUseThirdParty: boolean;
  canUsePrivacy: boolean;
  canUseResilience: boolean;
  canUsePortal: boolean;
  canUseAdvancedRisk: boolean;
  canUseEvidence: boolean;
  canUseConMon: boolean;
  canUseReports: boolean;
  canUseAssurance: boolean;
  canUseChat: boolean;
};

const ADMIN_ROUTE_PREFIXES = [
  '/program/setup',
  '/workspace/domains',
  '/workspace/team',
  '/workspace/access',
  '/setup/',
  '/builders/',
  '/features/regml',
  '/features/compliance-exports',
  '/features/response-automation',
  '/features/evidence-mapping',
  '/features/automation-manager',
  '/grc-admin',
];

const ADMIN_ROUTE_EXACT = new Set([
  '/sso',
  '/setup-mfa',
  '/ai-policy-builder',
  '/features/ai-policy-builder',
  '/response-automation',
  '/evidence-mapping',
  '/compliance-exports',
  '/imports',
  '/automation-manager',
  '/folders',
  '/users',
  '/quick-start',
  '/conmon/profiles',
  '/evidence/sources',
  '/policies',
  '/settings',
]);

const INTERNAL_ROUTE_PREFIXES = [
  '/workflow',
  '/features/workflow',
  '/utilities',
  '/features/utilities',
  '/subsystems',
  '/features/subsystems',
  '/rmf',
  '/features/rmf',
  '/app-management',
  '/features/app-management',
  '/workbench',
  '/features/workbench',
  '/news-feed',
  '/features/news-feed',
];

const INTERNAL_ROUTE_EXACT = new Set([
  '/assets',
  '/asset-assessments',
  '/actors',
  '/vulnerabilities',
  '/incidents',
  '/security-exceptions',
  '/backup-restore',
  '/calendar',
  '/dashboards',
  '/recap',
  '/validation-flows',
  '/x-rays',
  '/task-nodes',
  '/task-templates',
  '/risk-matrices',
  '/requirement-assessments',
  '/requirement-mapping-sets',
  '/sync-mappings',
  '/content-types',
  '/generic-collections',
  '/presets',
  '/preset-journeys',
  '/experimental',
  '/license-management',
  '/metric-instances',
  '/accreditations',
  '/findings-assessments',
  '/scoring-assistant',
]);

function hasAnyPermission(payload: IamMePayload | null, permissions: Set<string>): boolean {
  if (!payload) {
    return false;
  }

  return payload.permissions.some((permission) => permissions.has(permission));
}

export function deriveShellAccessProfile(payload: IamMePayload | null): ShellAccessProfile {
  const isWorkspaceAdmin = hasAnyPermission(payload, WORKSPACE_ADMIN_PERMISSIONS);
  const canUseFrameworks = hasAnyPermission(payload, FRAMEWORK_READ_PERMISSIONS);
  const canUseRiskAssessments = hasAnyPermission(payload, RISK_READ_PERMISSIONS);
  const canUseThirdParty = hasAnyPermission(payload, TPRM_READ_PERMISSIONS);
  const canUsePrivacy = hasAnyPermission(payload, PRIVACY_READ_PERMISSIONS);
  const canUseResilience = hasAnyPermission(payload, RESILIENCE_READ_PERMISSIONS);
  const canUseEvidence = hasAnyPermission(payload, EVIDENCE_READ_PERMISSIONS);
  const canUseConMon = hasAnyPermission(payload, CONMON_READ_PERMISSIONS);
  const canUseOperations = hasAnyPermission(payload, OPERATIONS_READ_PERMISSIONS);
  const isAuditee = Boolean(payload?.profile?.isAuditee);
  const canUsePortal = isAuditee || canUseFrameworks;

  return {
    isWorkspaceAdmin,
    canViewAdminNavigation: isWorkspaceAdmin,
    canViewInternalTools: isWorkspaceAdmin,
    isAuditee,
    canUseSearch: canUseOperations,
    canUseAnalytics: canUseOperations,
    canUseProgramWorkspace: canUseOperations,
    canUseLibraries: canUseFrameworks,
    canUseFrameworks,
    canUseAssessmentWorkspace: canUseFrameworks && canUseRiskAssessments,
    canUseComplianceAssessments: canUseFrameworks,
    canUseRiskAssessments,
    canUseThirdParty,
    canUsePrivacy,
    canUseResilience,
    canUsePortal,
    canUseAdvancedRisk: canUseRiskAssessments,
    canUseEvidence,
    canUseConMon,
    canUseReports: canUseFrameworks,
    canUseAssurance: canUseEvidence,
    canUseChat: canUseOperations,
  };
}

function canAccessStandardRoute(route: string, access: ShellAccessProfile): boolean | null {
  const capabilityChecks: Array<[Array<string>, boolean]> = [
    [['/search'], access.canUseSearch],
    [['/analytics'], access.canUseAnalytics],
    [['/program'], access.canUseProgramWorkspace],
    [['/libraries', '/loaded-libraries', '/mapping-libraries', '/stored-libraries'], access.canUseLibraries],
    [['/frameworks'], access.canUseFrameworks],
    [['/framework-library'], access.canUseFrameworks],
    [['/findings'], access.canUseFrameworks],
    [['/gap-assessments'], access.canUseFrameworks],
    [['/report-bundles'], access.canUseFrameworks],
    [['/assessments', '/compliance-assessments'], access.canUseAssessmentWorkspace],
    [['/applied-controls'], access.canUseComplianceAssessments],
    [['/risk-assessments', '/risk-scenarios'], access.canUseRiskAssessments],
    [['/third-party', '/entities', '/contracts'], access.canUseThirdParty],
    [['/privacy', '/processings'], access.canUsePrivacy],
    [['/resilience', '/business-impact-analysis'], access.canUseResilience],
    [['/portal', '/auditee-dashboard', '/auditee-assessments', '/my-assignments'], access.canUsePortal],
    [
      [
        '/advanced-risk/ebios',
        '/advanced-risk/quantitative',
        '/ebios-rm',
        '/operating-modes',
        '/operational-scenarios',
        '/strategic-scenarios',
        '/ro-to',
        '/stakeholders',
        '/quantitative-risk-studies',
        '/quantitative-risk-scenarios',
        '/quantitative-risk-hypotheses',
      ],
      access.canUseAdvancedRisk,
    ],
    [['/evidence-management', '/features/evidence-management', '/evidence/jobs'], access.canUseEvidence],
    [['/conmon/executions'], access.canUseConMon],
    [['/reports'], access.canUseReports],
    [['/assurance'], access.canUseAssurance],
    [['/chat'], access.canUseChat],
  ];

  for (const [prefixes, allowed] of capabilityChecks) {
    if (prefixes.some((prefix) => route === prefix || route.startsWith(`${prefix}/`))) {
      return allowed;
    }
  }

  return null;
}

export function canAccessShellRoute(route: string, access: ShellAccessProfile): boolean {
  if (!route.startsWith('/')) {
    return true;
  }

  if (INTERNAL_ROUTE_EXACT.has(route) || INTERNAL_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix))) {
    return access.canViewInternalTools;
  }

  if (ADMIN_ROUTE_EXACT.has(route) || ADMIN_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix))) {
    return access.canViewAdminNavigation;
  }

  const standardRouteAccess = canAccessStandardRoute(route, access);
  if (standardRouteAccess !== null) {
    return standardRouteAccess;
  }

  return true;
}

export function getDefaultShellRoute(access: ShellAccessProfile): string {
  if (access.canUseProgramWorkspace) {
    return '/program';
  }

  if (access.canUseAssurance) {
    return '/assurance';
  }

  if (access.canUsePortal) {
    return '/portal';
  }

  if (access.canUseFrameworks) {
    return '/frameworks';
  }

  if (access.canUseEvidence) {
    return '/evidence-management';
  }

  if (access.canUseConMon) {
    return '/conmon/executions';
  }

  if (access.canUseThirdParty) {
    return '/third-party';
  }

  if (access.canUsePrivacy) {
    return '/privacy';
  }

  if (access.canUseResilience) {
    return '/resilience';
  }

  if (access.canUseAdvancedRisk) {
    return '/advanced-risk/ebios';
  }

  if (access.canUseLibraries) {
    return '/libraries';
  }

  if (access.canUseReports) {
    return '/reports';
  }

  if (access.canUseChat) {
    return '/chat';
  }

  return '/workspace/me';
}
