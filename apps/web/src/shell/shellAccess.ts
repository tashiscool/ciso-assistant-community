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
  canUseModules: boolean;
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
  '/builders/export-builder',
  '/builders/questionnaire-builder',
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
  '/builders/dashboard-builder',
  '/builders/export-builder',
  '/builders/form-builder',
  '/builders/questionnaire-builder',
  '/builders/rules-builder',
  '/builders/wayfinder-builder',
  '/backup-restore',
  '/folders',
  '/license-management',
  '/users',
  '/quick-start',
  '/conmon/profiles',
  '/evidence/sources',
  '/settings',
  '/trust-center',
]);

const INTERNAL_ROUTE_PREFIXES: string[] = [];

const INTERNAL_ROUTE_EXACT = new Set<string>([]);

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
    canUseModules: canUseOperations,
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
    [
      [
        '/program',
        '/calendar',
        '/workflow',
        '/features/workflow',
        '/workbench',
        '/features/workbench',
        '/news-feed',
        '/features/news-feed',
        '/app-management',
        '/features/app-management',
        '/content-types',
        '/generic-collections',
        '/presets',
        '/preset-journeys',
        '/accreditations',
        '/experimental',
      ],
      access.canUseProgramWorkspace,
    ],
    [
      [
        '/modules',
        '/assets',
        '/capabilities',
        '/case-management',
        '/causal-analysis',
        '/changes',
        '/components',
        '/data-calls',
        '/evidence-locker',
        '/incidents',
        '/interconnections',
        '/issues',
        '/policies',
        '/programs',
        '/projects',
        '/requirements',
        '/risks',
        '/security-controls',
        '/security-exceptions',
        '/security-plans',
        '/security-profiles',
        '/supply-chain',
        '/tasks',
        '/threat-models',
        '/threats',
        '/catalogues',
        '/assessment-plans',
        '/questionnaires',
      ],
      access.canUseModules,
    ],
    [
      [
        '/libraries',
        '/loaded-libraries',
        '/mapping-libraries',
        '/stored-libraries',
        '/requirement-mapping-sets',
        '/sync-mappings',
      ],
      access.canUseLibraries,
    ],
    [['/frameworks'], access.canUseFrameworks],
    [['/framework-library'], access.canUseFrameworks],
    [['/findings'], access.canUseFrameworks],
    [['/gap-assessments'], access.canUseFrameworks],
    [['/report-bundles'], access.canUseFrameworks],
    [['/rmf', '/features/rmf', '/requirement-assessments', '/validation-flows', '/findings-assessments'], access.canUseFrameworks],
    [['/assessments', '/compliance-assessments'], access.canUseAssessmentWorkspace],
    [['/applied-controls'], access.canUseComplianceAssessments],
    [['/risk-assessments', '/risk-scenarios', '/vulnerabilities', '/risk-matrices'], access.canUseRiskAssessments],
    [['/third-party', '/entities', '/contracts'], access.canUseThirdParty],
    [['/privacy', '/processings'], access.canUsePrivacy],
    [['/resilience', '/business-impact-analysis', '/asset-assessments'], access.canUseResilience],
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
    [
      [
        '/evidence-management',
        '/features/evidence-management',
        '/assessment-evidence-packages',
        '/evidence/jobs',
        '/evidences',
        '/evidence-revisions',
      ],
      access.canUseEvidence,
    ],
    [['/conmon/executions'], access.canUseConMon],
    [['/reports', '/builders/report-builder'], access.canUseReports],
    [['/dashboards', '/recap', '/metric-instances', '/x-rays'], access.canUseAnalytics],
    [['/utilities', '/features/utilities', '/subsystems', '/features/subsystems', '/task-nodes', '/task-templates'], access.canUseModules],
    [['/assurance'], access.canUseAssurance],
    [['/chat', '/scoring-assistant'], access.canUseChat],
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
