import type { WorkerRequestContext } from '../../router';
import type { EnvBindings } from '../../types/env';
import {
  loadPermissionContext,
  loadScopedPermissionContext,
  requireAnyPermission,
} from '../../authorization';
import { getAiRuntimeStatus } from '../ai/runtime';
import { buildWorkspaceChatReply } from '../ai/workspaceGuidance';
import { MODULE_CATALOG, findModuleCatalogEntry, type ModuleCatalogEntry } from '../core/moduleRegistry';
import {
  sendPortalAssignmentSubmittedEmail,
  sendReportExportReadyEmail,
} from '../../email';
import { acquireTenantLease, getTenantWorkflowSnapshot, releaseTenantLease } from '../../utils/workflows';
import { json, methodNotAllowed } from '../../utils/http';

type OpsOverviewCounts = {
  reportExports: number;
  chatSessions: number;
  importJobs: number;
  portalAssignments: number;
  ebiosStudies: number;
  quantitativeStudies: number;
};

type NamedReference = {
  id: string;
  name: string;
};

type ReportExportRow = {
  id: string;
  tenant_id: string;
  folder_id: string | null;
  folder_name: string | null;
  created_by_user_id: string | null;
  report_id: string;
  name: string;
  format: string;
  status: string;
  filter_json: string;
  summary_json: string;
  content_json: string;
  created_at: string;
  updated_at: string;
};

type ReportBuilderCatalogRow = {
  id: string;
  title: string;
  chart_type: string;
  module_name: string;
  status: string;
  source: string;
  description: string | null;
  updated_at: string;
};

type ImportJobRow = {
  id: string;
  tenant_id: string;
  folder_id: string;
  folder_name: string;
  created_by_user_id: string | null;
  name: string;
  source_type: string;
  target_kind: string;
  status: string;
  row_count: number;
  imported_count: number;
  error_count: number;
  steps_json: string;
  summary_json: string;
  created_objects_json: string;
  created_at: string;
  updated_at: string;
};

type ChatSessionRow = {
  id: string;
  tenant_id: string;
  folder_id: string;
  folder_name: string;
  owner_user_id: string | null;
  owner_name: string | null;
  title: string;
  workflow: string;
  status: string;
  messages_json: string;
  citations_json: string;
  workflow_state_json: string;
  created_at: string;
  updated_at: string;
};

type PortalAssignmentRow = {
  id: string;
  tenant_id: string;
  folder_id: string;
  folder_name: string;
  compliance_assessment_id: string | null;
  compliance_assessment_name: string | null;
  entity_id: string | null;
  entity_name: string | null;
  ref_id: string | null;
  name: string;
  framework_name: string | null;
  actor_name: string | null;
  actor_email: string | null;
  status: string;
  due_date: string | null;
  submitted_at: string | null;
  observation: string | null;
  requirements_json: string;
  events_json: string;
  created_at: string;
  updated_at: string;
};

type UserRecipientRow = {
  email: string;
  display_name: string | null;
};

type PortalPrincipalRow = {
  id: string;
  email: string;
  display_name: string | null;
  is_auditee: number;
  is_active: number;
};

type EbiosStudyRow = {
  id: string;
  tenant_id: string;
  folder_id: string;
  folder_name: string;
  perimeter_id: string | null;
  perimeter_name: string | null;
  reference_entity_id: string | null;
  reference_entity_name: string | null;
  ref_id: string | null;
  name: string;
  description: string | null;
  version: string;
  status: string;
  quotation_method: string;
  risk_matrix_name: string | null;
  observation: string | null;
  workshop_status_json: string;
  feared_events_json: string;
  stakeholders_json: string;
  strategic_scenarios_json: string;
  operational_scenarios_json: string;
  created_at: string;
  updated_at: string;
};

type QuantitativeStudyRow = {
  id: string;
  tenant_id: string;
  folder_id: string;
  folder_name: string;
  risk_register_id: string | null;
  risk_register_name: string | null;
  ref_id: string | null;
  name: string;
  description: string | null;
  version: string;
  status: string;
  distribution_model: string;
  currency: string;
  loss_threshold: number | null;
  observation: string | null;
  risk_tolerance_json: string;
  portfolio_json: string;
  scenarios_json: string;
  action_plan_json: string;
  created_at: string;
  updated_at: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  citations?: Array<{ label: string; value: string }>;
};

type ImportStep = {
  key: string;
  label: string;
  status: 'pending' | 'completed' | 'failed';
  detail?: string | null;
};

type PortalRequirement = {
  id: string;
  ref: string;
  title: string;
  question: string;
  assessable: boolean;
  result: string;
  response: string | null;
  observation: string | null;
  evidenceNote: string | null;
};

type PortalEvent = {
  id: string;
  eventType: string;
  actorName: string;
  note: string | null;
  createdAt: string;
};

type BiaAssetAssessment = {
  id: string;
  assetName: string;
  dependencies: string[];
  associatedControls: string[];
  recoveryTargetsMet: boolean;
};

type WorkshopStep = {
  id: string;
  label: string;
  status: 'to_do' | 'in_progress' | 'done';
};

type EbiosWorkshop = {
  id: string;
  label: string;
  steps: WorkshopStep[];
};

type EbiosFearedEvent = {
  id: string;
  name: string;
  gravity: number;
  assets: string[];
};

type EbiosStakeholder = {
  id: string;
  name: string;
  category: string;
  dependency: number;
};

type EbiosStrategicScenario = {
  id: string;
  name: string;
  attacker: string;
  priority: number;
};

type EbiosOperationalScenario = {
  id: string;
  name: string;
  likelihood: number;
  impact: number;
  attackPath: string[];
};

type QuantitativeHypothesis = {
  id: string;
  name: string;
  riskStage: 'inherent' | 'current' | 'residual';
  probability: number;
  impactLow: number;
  impactHigh: number;
  ale: number;
  isSelected: boolean;
};

type QuantitativeScenario = {
  id: string;
  refId: string;
  name: string;
  description: string | null;
  status: string;
  currentAle: number;
  residualAle: number;
  ownerName: string | null;
  treatmentStrategy: string | null;
  treatmentCost: number | null;
  hypotheses: QuantitativeHypothesis[];
};

type QuantitativeAction = {
  id: string;
  title: string;
  ownerName: string | null;
  status: string;
  annualCost: number | null;
  scenarioId: string;
  scenarioName: string;
};

type WorkbenchItemRow = {
  id: string;
  title: string;
  module: string;
  status: string;
  owner_name: string | null;
  priority: string | null;
  due_date: string | null;
  updated_at: string;
  created_at: string;
  route: string;
  detail: string;
};

type ModuleRecordOpsRow = {
  id: string;
  module_key: string;
  title: string;
  status: string;
  folder_id: string | null;
  owner_user_id: string | null;
  assignee_user_id: string | null;
  start_on: string | null;
  finish_on: string | null;
  due_on: string | null;
  review_on: string | null;
  expires_on: string | null;
  data_json: string | null;
  updated_at: string;
  created_at: string;
  owner_display_name: string | null;
  owner_first_name: string | null;
  owner_last_name: string | null;
  owner_email: string | null;
  assignee_display_name: string | null;
  assignee_first_name: string | null;
  assignee_last_name: string | null;
  assignee_email: string | null;
};

type AssessmentOpsRow = {
  id: string;
  name: string;
  status: string;
  assessment_kind: string | null;
  lead_assessor_user_id: string | null;
  lead_assessor_display_name: string | null;
  lead_assessor_first_name: string | null;
  lead_assessor_last_name: string | null;
  lead_assessor_email: string | null;
  planned_start_on: string | null;
  planned_finish_on: string | null;
  instructions: string | null;
  process_info: string | null;
  source_security_plan_id: string | null;
  updated_at: string;
  created_at: string;
};

type ModuleRecordOpsItem = {
  id: string;
  moduleKey: string;
  moduleLabel: string;
  title: string;
  subtitle: string;
  status: string;
  detail: string;
  owner: string;
  route: string;
  keywords: string[];
  startOn: string | null;
  finishOn: string | null;
  dueOn: string | null;
  reviewOn: string | null;
  expiresOn: string | null;
  lastActivity: string;
};

type AssessmentOpsItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  detail: string;
  owner: string;
  route: string;
  keywords: string[];
  plannedStartOn: string | null;
  plannedFinishOn: string | null;
  lastActivity: string;
};

type NewsFeedEvent = {
  id: string;
  title: string;
  module: string;
  type: string;
  priority: string;
  status: string;
  summary: string;
  route: string;
  occurredAt: string;
  actor: string | null;
};

type UtilityCatalogEntry = {
  key: string;
  title: string;
  status: string;
  module: string;
  description: string;
  route: string;
  dryRunSupport: boolean;
  queueName: string;
  receiptPath: string;
  notes: string;
};

type UtilityRunRow = {
  id: string;
  tenant_id: string;
  utility_key: string;
  module_name: string;
  scope_label: string;
  records_hint: number;
  status: string;
  notes: string | null;
  preview_mode: number;
  receipt_path: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type SubsystemAvailability = Record<'Security Plan' | 'Issue' | 'Risk' | 'Evidence', 'Yes' | 'Optional' | 'No'>;

type SubsystemCatalogEntry = {
  key: string;
  title: string;
  category: string;
  description: string;
  route: string;
  usageExample: string;
  dataContract: string;
  actions: string[];
  availability: SubsystemAvailability;
};

type SubsystemPreferenceRow = {
  id: string;
  tenant_id: string;
  subsystem_key: string;
  pinned: number;
  open_count: number;
  last_opened_at: string | null;
  activity_note: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type SubsystemSessionRow = {
  tenant_id: string;
  active_subsystem_key: string;
  active_record_type: string;
  updated_by_user_id: string | null;
  updated_at: string;
};

type RMFStepRow = {
  id: string;
  name: string;
  status: 'Completed' | 'In Progress' | 'Planned' | 'Blocked';
  progress: number;
  owner: string;
  summary: string;
  detail: string;
  route: string;
  artifacts: string[];
};

type RMFArtifactRow = {
  id: string;
  title: string;
  module: string;
  step: string;
  owner: string;
  status: string;
  helper: string;
};

type RMFTimelinePoint = {
  bucket: string;
  progress: number;
  artifacts: number;
  findings: number;
};

type RMFPackageRow = {
  id: string;
  tenant_id: string;
  name: string;
  system_category: string;
  authorization_boundary: string;
  current_state: string;
  authorization_status: string;
  progress_percent: number;
  blockers_json: string;
  next_handoff: string;
  decision_target: string;
  steps_json: string;
  artifacts_json: string;
  timeline_json: string;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type AppManagementGroup = {
  name: string;
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
  ssoSync: boolean;
};

type AppManagementUser = {
  email: string;
  groups: string[];
  delegate: string;
  notifications: string;
  accessLogs: string;
};

type AppManagementServiceAccount = {
  purpose: string;
  tokenDuration: string;
  adminRequired: boolean;
  crudScope: string;
  status: 'Healthy' | 'Review' | 'Queued';
};

type AppManagementAppRow = {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  administrators_json: string;
  default_public: number;
  inherit_parent_access: number;
  default_users_json: string;
  default_groups_json: string;
  groups_json: string;
  users_json: string;
  service_accounts_json: string;
  automation_owner: string;
  automation_queue: string;
  automation_health: string;
  notes: string | null;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type CreateReportExportInput = {
  reportId?: string;
  format?: string;
  identifierType?: string;
  level?: string;
  namingConvention?: string;
};

type CreateChatSessionInput = {
  folderId?: string;
  title?: string;
  workflow?: string;
};

type CreateChatMessageInput = {
  content?: string;
};

type CreateImportJobInput = {
  folderId?: string;
  name?: string;
  sourceType?: string;
  targetKind?: string;
  rowCount?: number;
};

type LaunchUtilityInput = {
  utilityKey?: string;
  module?: string;
  scope?: string;
  recordsHint?: number;
  previewMode?: boolean;
  notes?: string;
};

type SelectSubsystemInput = {
  subsystemKey?: string;
  recordType?: string;
};

type ToggleSubsystemPinInput = {
  pinned?: boolean;
};

type CreateAppManagementInput = {
  name?: string;
};

type SaveAppManagementInput = {
  name?: string;
  description?: string;
  defaultPublic?: boolean;
  inheritParentAccess?: boolean;
  automationOwner?: string;
  notes?: string | null;
};

type UpdatePortalRequirementInput = {
  result?: string;
  response?: string | null;
  observation?: string | null;
  evidenceNote?: string | null;
};

type CreateEbiosStudyInput = {
  folderId?: string;
  perimeterId?: string | null;
  referenceEntityId?: string | null;
  refId?: string | null;
  name?: string;
  description?: string | null;
  version?: string | null;
  status?: string | null;
  quotationMethod?: string | null;
  observation?: string | null;
};

type CreateQuantitativeStudyInput = {
  folderId?: string;
  riskRegisterId?: string | null;
  refId?: string | null;
  name?: string;
  description?: string | null;
  version?: string | null;
  status?: string | null;
  distributionModel?: string | null;
  currency?: string | null;
  lossThreshold?: number | null;
  observation?: string | null;
};

const OPS_DEMO_IDS = {
  reportExportId: 'report-export-demo-dora',
  importJobId: 'import-job-demo-risk',
  chatSessionId: 'chat-session-demo-overview',
  portalAssignmentId: 'portal-assignment-demo-vendor',
  ebiosStudyId: 'ebios-study-demo-enterprise',
  quantitativeStudyId: 'quantitative-study-demo-enterprise',
};

const DEMO_REFS = {
  tenantId: 'tenant-demo',
  governanceFolderId: 'folder-governance-demo',
  vendorFolderId: 'folder-vendor-demo',
  userId: 'user-demo',
  entityVendorId: 'entity-demo-vendor',
  perimeterId: 'perimeter-enterprise-demo',
  complianceAssessmentId: 'compliance-assessment-iso-demo',
  riskRegisterId: 'risk-register-demo',
};

const FRAMEWORK_READ_PERMISSIONS = ['view_framework', 'add_framework', 'change_framework'];
const FRAMEWORK_WRITE_PERMISSIONS = ['add_framework', 'change_framework'];
const RISK_READ_PERMISSIONS = [
  'view_riskregister',
  'add_riskregister',
  'change_riskregister',
  'view_riskscenario',
  'add_riskscenario',
  'change_riskscenario',
];
const RISK_WRITE_PERMISSIONS = [
  'add_riskregister',
  'change_riskregister',
  'add_riskscenario',
  'change_riskscenario',
];
const TPRM_READ_PERMISSIONS = [
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
];
const PRIVACY_READ_PERMISSIONS = [
  'view_processing',
  'add_processing',
  'change_processing',
  'view_rightrequest',
  'add_rightrequest',
  'change_rightrequest',
  'view_databreach',
  'add_databreach',
  'change_databreach',
];
const RESILIENCE_READ_PERMISSIONS = ['view_bia', 'add_bia', 'change_bia'];
const OPERATIONS_READ_PERMISSIONS = [
  'view_framework',
  'add_framework',
  'change_framework',
  'view_riskregister',
  'add_riskregister',
  'change_riskregister',
  'view_riskscenario',
  'add_riskscenario',
  'change_riskscenario',
  'view_conmon',
  'run_conmon',
  'view_evidence',
  'collect_evidence',
];
const OPERATIONS_WRITE_PERMISSIONS = [
  'add_framework',
  'change_framework',
  'add_riskregister',
  'change_riskregister',
  'add_riskscenario',
  'change_riskscenario',
  'run_conmon',
  'collect_evidence',
];

const MODULE_RECORD_OPS_SCOPE_PERMISSIONS = [
  ...OPERATIONS_READ_PERMISSIONS,
  ...TPRM_READ_PERMISSIONS,
  ...PRIVACY_READ_PERMISSIONS,
  ...RESILIENCE_READ_PERMISSIONS,
];

const WORKSPACE_ADMIN_VISIBILITY_PERMISSIONS = new Set([
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

type OpsSurfaceAccessProfile = {
  isWorkspaceAdmin: boolean;
  canViewAdminNavigation: boolean;
  canViewInternalTools: boolean;
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

function deriveOpsSurfaceAccessProfile(permissions: string[]): OpsSurfaceAccessProfile {
  const isWorkspaceAdmin = permissions.some((permission) =>
    WORKSPACE_ADMIN_VISIBILITY_PERMISSIONS.has(permission),
  );
  const canUseFrameworks = permissions.some((permission) => FRAMEWORK_READ_PERMISSIONS.includes(permission));
  const canUseRiskAssessments = permissions.some((permission) => RISK_READ_PERMISSIONS.includes(permission));
  const canUseThirdParty = permissions.some((permission) => TPRM_READ_PERMISSIONS.includes(permission));
  const canUsePrivacy = permissions.some((permission) => PRIVACY_READ_PERMISSIONS.includes(permission));
  const canUseResilience = permissions.some((permission) => RESILIENCE_READ_PERMISSIONS.includes(permission));
  const canUseEvidence = permissions.some((permission) => ['view_evidence', 'collect_evidence'].includes(permission));
  const canUseConMon = permissions.some((permission) => ['view_conmon', 'run_conmon'].includes(permission));
  const canUseOperations = permissions.some((permission) => OPERATIONS_READ_PERMISSIONS.includes(permission));

  return {
    isWorkspaceAdmin,
    canViewAdminNavigation: isWorkspaceAdmin,
    canViewInternalTools: isWorkspaceAdmin,
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
    canUsePortal: canUseFrameworks,
    canUseAdvancedRisk: canUseRiskAssessments,
    canUseEvidence,
    canUseConMon,
    canUseReports: canUseFrameworks,
    canUseAssurance: canUseEvidence,
    canUseChat: canUseOperations,
  };
}

function canAccessOpsStandardRoute(route: string, access: OpsSurfaceAccessProfile): boolean | null {
  const capabilityChecks: Array<[string[], boolean]> = [
    [['/search'], access.canUseSearch],
    [['/analytics'], access.canUseAnalytics],
    [['/program'], access.canUseProgramWorkspace],
    [['/libraries', '/loaded-libraries', '/mapping-libraries', '/stored-libraries'], access.canUseLibraries],
    [['/frameworks'], access.canUseFrameworks],
    [['/assessments', '/compliance-assessments'], access.canUseAssessmentWorkspace],
    [['/applied-controls'], access.canUseComplianceAssessments],
    [['/risk-assessments', '/risk-scenarios'], access.canUseRiskAssessments],
    [['/third-party', '/entities', '/contracts'], access.canUseThirdParty],
    [['/privacy', '/processings'], access.canUsePrivacy],
    [['/resilience', '/business-impact-analysis'], access.canUseResilience],
    [['/portal'], access.canUsePortal],
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

function canAccessOpsSurfaceRoute(route: string, access: OpsSurfaceAccessProfile): boolean {
  if (!route.startsWith('/')) {
    return true;
  }

  if (INTERNAL_ROUTE_EXACT.has(route) || INTERNAL_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix))) {
    return access.canViewInternalTools;
  }

  if (ADMIN_ROUTE_EXACT.has(route) || ADMIN_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix))) {
    return access.canViewAdminNavigation;
  }

  const standardRouteAccess = canAccessOpsStandardRoute(route, access);
  if (standardRouteAccess !== null) {
    return standardRouteAccess;
  }

  return true;
}

function filterRouteItems<T extends { route: string }>(items: T[], access: OpsSurfaceAccessProfile): T[] {
  return items.filter((item) => canAccessOpsSurfaceRoute(item.route, access));
}

const utilityCatalog: UtilityCatalogEntry[] = [
  {
    key: 'builder',
    title: 'Builder Utility',
    status: 'Core',
    module: 'Builders',
    description: 'Accelerate configuration of common admin and data-model surfaces.',
    route: '/builders/form-builder',
    dryRunSupport: true,
    queueName: 'ops-utility-builder-dispatch',
    receiptPath: 'utilities/builder/receipt.json',
    notes: 'Best for standardizing builder scaffolds before routing into the deeper builder workspaces.',
  },
  {
    key: 'inheritance',
    title: 'Inheritance Utility',
    status: 'Linked',
    module: 'Evidence Mapping',
    description: 'Carry inherited relationships and implementation context into downstream records.',
    route: '/features/evidence-management',
    dryRunSupport: true,
    queueName: 'ops-utility-inheritance-dispatch',
    receiptPath: 'utilities/inheritance/receipt.json',
    notes: 'Preview inherited control and component relationships before applying them across records.',
  },
  {
    key: 'categorization',
    title: 'Categorization Utility',
    status: 'RMF',
    module: 'RMF',
    description: 'Apply categorization patterns, impact values, and boundary notes consistently.',
    route: '/rmf',
    dryRunSupport: true,
    queueName: 'ops-utility-categorization-dispatch',
    receiptPath: 'utilities/categorization/receipt.json',
    notes: 'Useful for standardizing impact values and categorization language across RMF artifacts.',
  },
  {
    key: 'deviations',
    title: 'Deviations Utility',
    status: 'Governance',
    module: 'Policies',
    description: 'Guide deviation workflows and exception packaging across compliance reviews.',
    route: '/security-exceptions',
    dryRunSupport: false,
    queueName: 'ops-utility-deviations-dispatch',
    receiptPath: 'utilities/deviations/receipt.json',
    notes: 'Packages exception candidates and residual-risk notes for review workflows.',
  },
  {
    key: 'scheduling',
    title: 'Scheduling Utility',
    status: 'Scheduling',
    module: 'Calendar',
    description: 'Coordinate operational follow-through for imports, exports, and monitoring cadence.',
    route: '/calendar',
    dryRunSupport: true,
    queueName: 'ops-utility-scheduling-dispatch',
    receiptPath: 'utilities/scheduling/receipt.json',
    notes: 'Helps align run cadence, due dates, and cross-team follow-up windows.',
  },
];

const subsystemCatalog: SubsystemCatalogEntry[] = [
  {
    key: 'comments',
    title: 'Comments',
    category: 'Collaboration',
    description: 'Discuss records inline with mention-ready collaboration threads.',
    route: '/workbench',
    usageExample: 'Risk reviewers use comments to request clarification before advancing responses.',
    dataContract: 'record_comments, notifications, mentions',
    actions: ['Add comment', '@Mention collaborator', 'Resolve thread'],
    availability: { 'Security Plan': 'Yes', Issue: 'Yes', Risk: 'Yes', Evidence: 'Yes' },
  },
  {
    key: 'files',
    title: 'Files',
    category: 'Artifacts',
    description: 'Attach evidence, exports, and supporting documents to operational records.',
    route: '/evidence-management',
    usageExample: 'Security plans attach exported SSP packages and supporting evidence here.',
    dataContract: 'files, object keys, retention metadata',
    actions: ['Upload file', 'Download export', 'View retention metadata'],
    availability: { 'Security Plan': 'Yes', Issue: 'Yes', Risk: 'Yes', Evidence: 'Yes' },
  },
  {
    key: 'links',
    title: 'Links',
    category: 'Relationships',
    description: 'Store direct cross-system references and outbound URLs.',
    route: '/automation-manager',
    usageExample: 'Analysts attach ticketing, Jira, and external audit links to issues.',
    dataContract: 'record_links, external_refs',
    actions: ['Add external URL', 'Validate link', 'Copy record permalink'],
    availability: { 'Security Plan': 'Yes', Issue: 'Yes', Risk: 'Optional', Evidence: 'Yes' },
  },
  {
    key: 'kanban',
    title: 'Kanban',
    category: 'Workflow',
    description: 'View work items in stage-based lanes when the module supports lane progression.',
    route: '/workflow',
    usageExample: 'Issue owners drag remediation work across triage, in-progress, and done lanes.',
    dataContract: 'workflow_lanes, kanban_cards',
    actions: ['Move card', 'Open lane filters', 'View assignee load'],
    availability: { 'Security Plan': 'Optional', Issue: 'Yes', Risk: 'Optional', Evidence: 'No' },
  },
  {
    key: 'history',
    title: 'History',
    category: 'Audit',
    description: 'Inspect record changes and field-level edit history over time.',
    route: '/news-feed',
    usageExample: 'Auditors review who changed a control implementation and when.',
    dataContract: 'history_entries, field_change_log',
    actions: ['Filter by field', 'Compare revisions', 'Export audit trail'],
    availability: { 'Security Plan': 'Yes', Issue: 'Yes', Risk: 'Yes', Evidence: 'Yes' },
  },
  {
    key: 'workflow',
    title: 'Workflow',
    category: 'Workflow',
    description: 'Review current step, approvals, and record transitions from the subsystem tray.',
    route: '/workflow',
    usageExample: 'Date extension requests route through workflow for sign-off and closure.',
    dataContract: 'workflow_state, approver_assignments',
    actions: ['Advance state', 'View approvers', 'Inspect transition rules'],
    availability: { 'Security Plan': 'Yes', Issue: 'Yes', Risk: 'Yes', Evidence: 'Optional' },
  },
];

const rmfStepOrder = ['Categorize', 'Select', 'Implement', 'Assess', 'Authorize', 'Monitor'] as const;

function nowIso() {
  return new Date().toISOString();
}

async function getTenantCount(
  env: EnvBindings,
  table: string,
  tenantId: string,
  extraPredicate?: string,
  extraBindings: unknown[] = [],
) {
  const whereClause = extraPredicate ? ` AND ${extraPredicate}` : '';
  const row = await env.D1_MAIN.prepare(
    `SELECT COUNT(*) AS count FROM ${table} WHERE tenant_id = ?${whereClause}`,
  )
    .bind(tenantId, ...extraBindings)
    .first<{ count: number }>();

  return row?.count ?? 0;
}

function parseJsonArray<T>(value: string | null | undefined, fallback: T[] = []): T[] {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function parseJsonObject<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return (parsed as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function formatOpsUserName(
  displayName: string | null | undefined,
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  email: string | null | undefined,
  fallback = 'Unassigned',
) {
  const trimmedDisplayName = displayName?.trim();
  if (trimmedDisplayName) {
    return trimmedDisplayName;
  }

  const fullName = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ');
  if (fullName) {
    return fullName;
  }

  const trimmedEmail = email?.trim();
  if (trimmedEmail) {
    return trimmedEmail;
  }

  return fallback;
}

function buildModuleRecordRoute(entry: ModuleCatalogEntry, recordId: string) {
  const baseRoute = entry.directRoute || entry.canonicalRoute;
  const separator = baseRoute.includes('?') ? '&' : '?';
  return `${baseRoute}${separator}record=${encodeURIComponent(recordId)}`;
}

function pickFirstTextValue(
  data: Record<string, unknown>,
  candidates: string[],
) {
  for (const candidate of candidates) {
    const value = data[candidate];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return '';
}

function buildModuleRecordOwnerLabel(row: ModuleRecordOpsRow, data: Record<string, unknown>) {
  const assignee = formatOpsUserName(
    row.assignee_display_name,
    row.assignee_first_name,
    row.assignee_last_name,
    row.assignee_email,
    '',
  );
  if (assignee) {
    return assignee;
  }

  const owner = formatOpsUserName(
    row.owner_display_name,
    row.owner_first_name,
    row.owner_last_name,
    row.owner_email,
    '',
  );
  if (owner) {
    return owner;
  }

  const fallbackOwner = pickFirstTextValue(data, [
    'owner',
    'custodian',
    'evidence_owner',
    'requested_to',
    'vendor_name',
    'source_owner',
  ]);
  return fallbackOwner || 'Unassigned';
}

function buildModuleRecordDetail(
  entry: ModuleCatalogEntry,
  row: ModuleRecordOpsRow,
  data: Record<string, unknown>,
  ownerLabel: string,
) {
  const parts = [
    pickFirstTextValue(data, [
      'type',
      'policy_type',
      'incident_type',
      'exception_type',
      'request_type',
      'project_type',
      'component_type',
      'threat_type',
      'framework_name',
      'driver',
      'objective',
      'business_outcome',
    ]),
    ownerLabel && ownerLabel !== 'Unassigned' ? `Owner ${ownerLabel}` : '',
    row.due_on ? `Due ${row.due_on}` : '',
    row.review_on ? `Review ${row.review_on}` : '',
    row.expires_on ? `Expires ${row.expires_on}` : '',
    row.finish_on ? `Finish ${row.finish_on}` : '',
  ].filter(Boolean);

  return parts.join(' · ') || entry.description;
}

function toModuleRecordOpsItem(row: ModuleRecordOpsRow): ModuleRecordOpsItem | null {
  const entry = findModuleCatalogEntry(row.module_key);
  if (!entry) {
    return null;
  }

  const data = parseJsonObject<Record<string, unknown>>(row.data_json, {});
  const ownerLabel = buildModuleRecordOwnerLabel(row, data);
  const subtitle =
    pickFirstTextValue(data, [
      'type',
      'policy_type',
      'incident_type',
      'severity',
      'component_type',
      'project_type',
      'vendor_name',
      'requirement_id',
      'asset_id',
      'control_id',
      'plan_name',
      'risk_id',
      'contract_id',
      'threat_type',
      'change_type',
    ]) ||
    (ownerLabel !== 'Unassigned' ? ownerLabel : entry.coverageBadge);

  const keywordCandidates = [
    entry.moduleKey,
    entry.moduleName,
    entry.pluralName,
    row.status,
    subtitle,
    ownerLabel,
    pickFirstTextValue(data, [
      'classification',
      'lifecycle_status',
      'inventory_status',
      'approval_status',
      'implementation_status',
      'mitigation_status',
    ]),
  ];

  return {
    id: row.id,
    moduleKey: entry.moduleKey,
    moduleLabel: entry.pluralName,
    title: row.title,
    subtitle,
    status: row.status,
    detail: buildModuleRecordDetail(entry, row, data, ownerLabel),
    owner: ownerLabel,
    route: buildModuleRecordRoute(entry, row.id),
    keywords: [...new Set(keywordCandidates.filter((value) => value && value.trim()))],
    startOn: row.start_on,
    finishOn: row.finish_on,
    dueOn: row.due_on,
    reviewOn: row.review_on,
    expiresOn: row.expires_on,
    lastActivity: row.updated_at,
  };
}

function toAssessmentOpsItem(row: AssessmentOpsRow): AssessmentOpsItem {
  const ownerLabel = formatOpsUserName(
    row.lead_assessor_display_name,
    row.lead_assessor_first_name,
    row.lead_assessor_last_name,
    row.lead_assessor_email,
    'Lead assessor unassigned',
  );
  const kindLabel =
    row.assessment_kind === 'manual'
      ? 'Manual assessment'
      : row.assessment_kind === 'risk'
        ? 'Risk assessment'
        : row.assessment_kind === 'compliance'
          ? 'Compliance assessment'
          : 'Assessment';

  return {
    id: row.id,
    title: row.name,
    subtitle: kindLabel,
    status: row.status,
    detail:
      row.instructions?.trim() ||
      row.process_info?.trim() ||
      (row.source_security_plan_id?.trim()
        ? `Scoped to security plan reference ${row.source_security_plan_id.trim()}.`
        : 'Scoped tenant assessment.'),
    owner: ownerLabel,
    route: `/compliance-assessments/${row.id}`,
    keywords: [...new Set([kindLabel, row.status, ownerLabel].filter((value) => value && value.trim()))],
    plannedStartOn: row.planned_start_on,
    plannedFinishOn: row.planned_finish_on,
    lastActivity: row.updated_at,
  };
}

function normalizeNamedReference(value: unknown): NamedReference | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  if (!id || !name) {
    return null;
  }

  return { id, name };
}

function normalizeNamedReferenceArray(value: unknown): NamedReference[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeNamedReference(item))
    .filter((item): item is NamedReference => item !== null);
}

function bucketLabel(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function normalizeWorkbenchStatus(value: string) {
  const normalized = value.trim().toLowerCase();
  if (['done', 'completed', 'ready', 'success', 'resolved'].includes(normalized)) {
    return 'Done';
  }
  if (['validation_failed', 'failed', 'partial', 'blocked'].includes(normalized)) {
    return 'Action Needed';
  }
  if (['in_review', 'review', 'submitted'].includes(normalized)) {
    return 'In Review';
  }
  if (['running', 'pending', 'in_progress', 'generated', 'planned', 'monitoring'].includes(normalized)) {
    return 'In Progress';
  }
  return 'Open';
}

function normalizePriority(value: string | null) {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (['critical', 'high'].includes(normalized)) {
    return 'High';
  }
  if (['medium', 'moderate'].includes(normalized)) {
    return 'Medium';
  }
  return 'Watch';
}

function normalizeWorkflowStatus(value: string) {
  const normalized = value.trim().toLowerCase();
  if (['done', 'completed', 'ready', 'success', 'resolved'].includes(normalized)) {
    return 'Done';
  }
  if (['submitted', 'in_review', 'review', 'validation_failed'].includes(normalized)) {
    return 'Awaiting Review';
  }
  if (['running', 'in_progress', 'pending', 'generated', 'planned', 'monitoring'].includes(normalized)) {
    return 'Running';
  }
  return 'Queued';
}

function summarizePortalRequirements(requirements: PortalRequirement[]) {
  const totalRequirements = requirements.filter((item) => item.assessable).length;
  const assessedRequirements = requirements.filter(
    (item) => item.assessable && item.result !== 'not_assessed',
  ).length;

  return {
    totalRequirements,
    assessedRequirements,
    progressPercent:
      totalRequirements > 0 ? Math.round((assessedRequirements / totalRequirements) * 100) : 0,
  };
}

function computeEbiosMetrics(detail: {
  workshops: EbiosWorkshop[];
  fearedEvents: EbiosFearedEvent[];
  stakeholders: EbiosStakeholder[];
  strategicScenarios: EbiosStrategicScenario[];
  operationalScenarios: EbiosOperationalScenario[];
}) {
  const totalSteps = detail.workshops.reduce((sum, workshop) => sum + workshop.steps.length, 0);
  const completedSteps = detail.workshops.reduce(
    (sum, workshop) => sum + workshop.steps.filter((step) => step.status === 'done').length,
    0,
  );

  return {
    workshopProgress: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
    fearedEvents: detail.fearedEvents.length,
    stakeholders: detail.stakeholders.length,
    strategicScenarios: detail.strategicScenarios.length,
    operationalScenarios: detail.operationalScenarios.length,
  };
}

function computeQuantitativeMetrics(
  scenarios: QuantitativeScenario[],
  lossThreshold: number | null,
  currency: string,
) {
  const currentAleCombined = scenarios.reduce((sum, scenario) => sum + scenario.currentAle, 0);
  const residualAleCombined = scenarios.reduce((sum, scenario) => sum + scenario.residualAle, 0);
  const riskReduction = currentAleCombined - residualAleCombined;
  const scenariosAboveThreshold =
    typeof lossThreshold === 'number'
      ? scenarios.filter((scenario) => scenario.currentAle >= lossThreshold).length
      : 0;

  return {
    currency,
    currentAleCombined,
    residualAleCombined,
    riskReduction,
    scenariosAboveThreshold,
    totalScenarios: scenarios.length,
  };
}

function toReportExportResponse(row: ReportExportRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    folderId: row.folder_id,
    folderName: row.folder_name,
    createdByUserId: row.created_by_user_id,
    reportId: row.report_id,
    name: row.name,
    format: row.format,
    status: row.status,
    filters: parseJsonObject<Record<string, string | null>>(row.filter_json, {}),
    summary: parseJsonObject<Record<string, unknown>>(row.summary_json, {}),
    content: parseJsonObject<Record<string, unknown>>(row.content_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    downloadPath: `/_api/ops/reports/exports/${row.id}/download`,
  };
}

function toImportJobResponse(row: ImportJobRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    folderId: row.folder_id,
    folderName: row.folder_name,
    createdByUserId: row.created_by_user_id,
    name: row.name,
    sourceType: row.source_type,
    targetKind: row.target_kind,
    status: row.status,
    rowCount: row.row_count,
    importedCount: row.imported_count,
    errorCount: row.error_count,
    steps: parseJsonArray<ImportStep>(row.steps_json),
    summary: parseJsonObject<Record<string, unknown>>(row.summary_json, {}),
    createdObjects: parseJsonArray<NamedReference>(row.created_objects_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toChatSessionResponse(row: ChatSessionRow) {
  const messages = parseJsonArray<ChatMessage>(row.messages_json);
  const lastMessage = messages.at(-1);

  return {
    id: row.id,
    tenantId: row.tenant_id,
    folderId: row.folder_id,
    folderName: row.folder_name,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
    title: row.title,
    workflow: row.workflow,
    status: row.status,
    messageCount: messages.length,
    lastMessagePreview: lastMessage?.content?.slice(0, 140) ?? '',
    messages,
    citations: parseJsonArray<Record<string, unknown>>(row.citations_json),
    workflowState: parseJsonObject<Record<string, unknown>>(row.workflow_state_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPortalAssignmentResponse(row: PortalAssignmentRow) {
  const requirements = parseJsonArray<PortalRequirement>(row.requirements_json);
  const events = parseJsonArray<PortalEvent>(row.events_json);
  const summary = summarizePortalRequirements(requirements);

  return {
    id: row.id,
    tenantId: row.tenant_id,
    folderId: row.folder_id,
    folderName: row.folder_name,
    complianceAssessmentId: row.compliance_assessment_id,
    complianceAssessmentName: row.compliance_assessment_name,
    entityId: row.entity_id,
    entityName: row.entity_name,
    refId: row.ref_id,
    name: row.name,
    frameworkName: row.framework_name,
    actorName: row.actor_name,
    actorEmail: row.actor_email,
    status: row.status,
    dueDate: row.due_date,
    submittedAt: row.submitted_at,
    observation: row.observation,
    requirements,
    events,
    ...summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEbiosStudyResponse(row: EbiosStudyRow) {
  const workshops = parseJsonArray<EbiosWorkshop>(row.workshop_status_json);
  const fearedEvents = parseJsonArray<EbiosFearedEvent>(row.feared_events_json);
  const stakeholders = parseJsonArray<EbiosStakeholder>(row.stakeholders_json);
  const strategicScenarios = parseJsonArray<EbiosStrategicScenario>(row.strategic_scenarios_json);
  const operationalScenarios = parseJsonArray<EbiosOperationalScenario>(
    row.operational_scenarios_json,
  );
  const metrics = computeEbiosMetrics({
    workshops,
    fearedEvents,
    stakeholders,
    strategicScenarios,
    operationalScenarios,
  });

  return {
    id: row.id,
    tenantId: row.tenant_id,
    folderId: row.folder_id,
    folderName: row.folder_name,
    perimeterId: row.perimeter_id,
    perimeterName: row.perimeter_name,
    referenceEntityId: row.reference_entity_id,
    referenceEntityName: row.reference_entity_name,
    refId: row.ref_id,
    name: row.name,
    description: row.description,
    version: row.version,
    status: row.status,
    quotationMethod: row.quotation_method,
    riskMatrixName: row.risk_matrix_name,
    observation: row.observation,
    workshops,
    fearedEvents,
    stakeholders,
    strategicScenarios,
    operationalScenarios,
    metrics,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toQuantitativeStudyResponse(row: QuantitativeStudyRow) {
  const scenarios = parseJsonArray<QuantitativeScenario>(row.scenarios_json);
  const actionPlan = parseJsonArray<QuantitativeAction>(row.action_plan_json);
  const portfolio = parseJsonObject<Record<string, unknown>>(row.portfolio_json, {});
  const riskTolerance = parseJsonObject<Record<string, unknown>>(row.risk_tolerance_json, {});
  const metrics = computeQuantitativeMetrics(scenarios, row.loss_threshold, row.currency);

  return {
    id: row.id,
    tenantId: row.tenant_id,
    folderId: row.folder_id,
    folderName: row.folder_name,
    riskRegisterId: row.risk_register_id,
    riskRegisterName: row.risk_register_name,
    refId: row.ref_id,
    name: row.name,
    description: row.description,
    version: row.version,
    status: row.status,
    distributionModel: row.distribution_model,
    currency: row.currency,
    lossThreshold: row.loss_threshold,
    observation: row.observation,
    riskTolerance,
    portfolio,
    scenarios,
    actionPlan,
    metrics,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getFirstFolderId(env: EnvBindings, tenantId: string) {
  const folder = await env.D1_MAIN.prepare(
    `
    SELECT id
    FROM folders
    WHERE tenant_id = ?
    ORDER BY CASE WHEN content_type = 'domain' THEN 0 ELSE 1 END, created_at ASC
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<{ id: string }>();

  return folder?.id ?? null;
}

async function getFolderOrError(env: EnvBindings, tenantId: string, folderId: string | null) {
  if (!folderId) {
    return null;
  }

  return env.D1_MAIN.prepare(
    `
    SELECT id, name
    FROM folders
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, folderId)
    .first<{ id: string; name: string }>();
}

async function getReportLint(env: EnvBindings, tenantId: string) {
  const entityRows = await env.D1_MAIN.prepare(
    `
    SELECT id, name, ref_id, country
    FROM entities
    WHERE tenant_id = ?
    ORDER BY name ASC
    `,
  )
    .bind(tenantId)
    .all<{ id: string; name: string; ref_id: string | null; country: string | null }>();

  const contractRows = await env.D1_MAIN.prepare(
    `
    SELECT id, name, annual_expense, status
    FROM contracts
    WHERE tenant_id = ?
    ORDER BY name ASC
    `,
  )
    .bind(tenantId)
    .all<{ id: string; name: string; annual_expense: number | null; status: string }>();

  const results: Array<{
    severity: 'error' | 'warning' | 'info' | 'ok';
    category: string;
    message: string;
    field?: string;
    object_type?: string;
    object_id?: string;
  }> = [];

  for (const entity of entityRows.results) {
    if (!entity.ref_id) {
      results.push({
        severity: 'error',
        category: 'Entity identifiers',
        message: `${entity.name} is missing a reference identifier for the DORA package.`,
        field: 'ref_id',
        object_type: 'third-party/entities',
        object_id: entity.id,
      });
    } else {
      results.push({
        severity: 'ok',
        category: 'Entity identifiers',
        message: `${entity.name} has a reference identifier ready for export.`,
        object_type: 'third-party/entities',
        object_id: entity.id,
      });
    }

    if (!entity.country) {
      results.push({
        severity: 'warning',
        category: 'Entity location',
        message: `${entity.name} is missing a country value for authority mapping.`,
        field: 'country',
        object_type: 'third-party/entities',
        object_id: entity.id,
      });
    }
  }

  for (const contract of contractRows.results) {
    if (contract.annual_expense == null) {
      results.push({
        severity: 'info',
        category: 'Contract completeness',
        message: `${contract.name} does not include an annual expense yet.`,
        field: 'annual_expense',
      });
    }

    if (contract.status === 'draft') {
      results.push({
        severity: 'warning',
        category: 'Contract lifecycle',
        message: `${contract.name} is still in draft and may need review before filing.`,
        field: 'status',
      });
    }
  }

  const availableIdentifiers = entityRows.results
    .filter((entity) => entity.ref_id)
    .map((entity) => ({
      type: 'entity_ref',
      value: entity.ref_id as string,
      label: entity.name,
    }));
  const entityCountry = entityRows.results.find((entity) => entity.country)?.country ?? 'US';
  const competentAuthority =
    entityCountry === 'BE' ? 'NBB' : entityCountry === 'FR' ? 'ACPR' : 'FDIC';

  return {
    summary: {
      errors: results.filter((item) => item.severity === 'error').length,
      warnings: results.filter((item) => item.severity === 'warning').length,
      info: results.filter((item) => item.severity === 'info').length,
      ok: results.filter((item) => item.severity === 'ok').length,
    },
    results,
    available_identifiers: availableIdentifiers,
    entity_country: entityCountry,
    competent_authority: competentAuthority,
  };
}

function createDefaultEbiosWorkshops(): EbiosWorkshop[] {
  return [
    {
      id: 'workshop-1',
      label: 'Workshop 1',
      steps: [
        { id: '1-1', label: 'Study framing', status: 'done' },
        { id: '1-2', label: 'Security baseline', status: 'done' },
        { id: '1-3', label: 'Feared events', status: 'in_progress' },
        { id: '1-4', label: 'Scope validation', status: 'to_do' },
      ],
    },
    {
      id: 'workshop-2',
      label: 'Workshop 2',
      steps: [
        { id: '2-1', label: 'Risk sources', status: 'done' },
        { id: '2-2', label: 'Objectives', status: 'in_progress' },
        { id: '2-3', label: 'Motivations', status: 'to_do' },
      ],
    },
    {
      id: 'workshop-3',
      label: 'Workshop 3',
      steps: [
        { id: '3-1', label: 'Ecosystem mapping', status: 'in_progress' },
        { id: '3-2', label: 'Strategic scenarios', status: 'to_do' },
        { id: '3-3', label: 'Scenario review', status: 'to_do' },
      ],
    },
    {
      id: 'workshop-4',
      label: 'Workshop 4',
      steps: [
        { id: '4-1', label: 'Operational scenarios', status: 'to_do' },
        { id: '4-2', label: 'Attack path detail', status: 'to_do' },
        { id: '4-3', label: 'Supporting measures', status: 'to_do' },
      ],
    },
    {
      id: 'workshop-5',
      label: 'Workshop 5',
      steps: [
        { id: '5-1', label: 'Risk treatment', status: 'to_do' },
        { id: '5-2', label: 'Residual exposure', status: 'to_do' },
        { id: '5-3', label: 'Action tracking', status: 'to_do' },
        { id: '5-4', label: 'Management review', status: 'to_do' },
        { id: '5-5', label: 'Closure', status: 'to_do' },
      ],
    },
  ];
}

function createDefaultQuantitativeScenarios(): QuantitativeScenario[] {
  return [
    {
      id: 'quant-scenario-demo-ransomware',
      refId: 'QRS-001',
      name: 'Ransomware interruption',
      description: 'Loss scenario covering prolonged service interruption across the primary workload.',
      status: 'current',
      currentAle: 920000,
      residualAle: 340000,
      ownerName: 'Security Operations',
      treatmentStrategy: 'Accelerate immutable backups and privileged access controls.',
      treatmentCost: 180000,
      hypotheses: [
        {
          id: 'quant-hypothesis-demo-ransomware-current',
          name: 'Current-state ransomware',
          riskStage: 'current',
          probability: 0.19,
          impactLow: 350000,
          impactHigh: 1600000,
          ale: 920000,
          isSelected: true,
        },
        {
          id: 'quant-hypothesis-demo-ransomware-residual',
          name: 'Residual ransomware',
          riskStage: 'residual',
          probability: 0.08,
          impactLow: 200000,
          impactHigh: 850000,
          ale: 340000,
          isSelected: true,
        },
      ],
    },
    {
      id: 'quant-scenario-demo-vendor',
      refId: 'QRS-002',
      name: 'Critical vendor outage',
      description: 'Economic loss tied to concentration risk across the identity provider tier.',
      status: 'current',
      currentAle: 510000,
      residualAle: 230000,
      ownerName: 'Platform Engineering',
      treatmentStrategy: 'Fund failover automation and contractual resilience commitments.',
      treatmentCost: 125000,
      hypotheses: [
        {
          id: 'quant-hypothesis-demo-vendor-current',
          name: 'Current vendor outage',
          riskStage: 'current',
          probability: 0.14,
          impactLow: 250000,
          impactHigh: 950000,
          ale: 510000,
          isSelected: true,
        },
        {
          id: 'quant-hypothesis-demo-vendor-residual',
          name: 'Residual vendor outage',
          riskStage: 'residual',
          probability: 0.07,
          impactLow: 120000,
          impactHigh: 620000,
          ale: 230000,
          isSelected: true,
        },
      ],
    },
  ];
}

function buildQuantitativeActionPlan(scenarios: QuantitativeScenario[]): QuantitativeAction[] {
  return scenarios.map((scenario) => ({
    id: `action-${scenario.id}`,
    title: scenario.treatmentStrategy ?? `Treat ${scenario.name}`,
    ownerName: scenario.ownerName,
    status: 'planned',
    annualCost: scenario.treatmentCost,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
  }));
}

export async function buildOpsOverviewCounts(
  env: EnvBindings,
  tenantId: string,
): Promise<OpsOverviewCounts> {
  const [
    reportExports,
    chatSessions,
    importJobs,
    portalAssignments,
    ebiosStudies,
    quantitativeStudies,
  ] = await Promise.all([
    getTenantCount(env, 'report_exports', tenantId),
    getTenantCount(env, 'chat_sessions', tenantId),
    getTenantCount(env, 'import_jobs', tenantId),
    getTenantCount(env, 'portal_assignments', tenantId),
    getTenantCount(env, 'ebios_studies', tenantId),
    getTenantCount(env, 'quantitative_studies', tenantId),
  ]);

  return {
    reportExports,
    chatSessions,
    importJobs,
    portalAssignments,
    ebiosStudies,
    quantitativeStudies,
  };
}

export async function seedDemoOpsWorkspace(env: EnvBindings) {
  const lint = await getReportLint(env, DEMO_REFS.tenantId);
  const reportSummary = {
    generatedFor: 'DORA Register of Information',
    entityCount: lint.available_identifiers.length,
    summary: lint.summary,
  };

  await env.D1_MAIN.prepare(
    `
    INSERT OR REPLACE INTO report_exports (
      id,
      tenant_id,
      folder_id,
      created_by_user_id,
      report_id,
      name,
      format,
      status,
      filter_json,
      summary_json,
      content_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      OPS_DEMO_IDS.reportExportId,
      DEMO_REFS.tenantId,
      DEMO_REFS.governanceFolderId,
      DEMO_REFS.userId,
      'dora-roi',
      'DORA ROI demo export',
      'csv',
      'generated',
      JSON.stringify({ identifierType: 'entity_ref', namingConvention: 'eba', level: 'IND' }),
      JSON.stringify(reportSummary),
      JSON.stringify({
        filename: 'dora-roi-demo.csv',
        rows: [
          ['section', 'name', 'value'],
          ['summary', 'entities', String(lint.available_identifiers.length)],
          ['summary', 'warnings', String(lint.summary.warnings)],
        ],
      }),
    )
    .run();

  await env.D1_MAIN.prepare(
    `
    INSERT OR REPLACE INTO import_jobs (
      id,
      tenant_id,
      folder_id,
      created_by_user_id,
      name,
      source_type,
      target_kind,
      status,
      row_count,
      imported_count,
      error_count,
      steps_json,
      summary_json,
      created_objects_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      OPS_DEMO_IDS.importJobId,
      DEMO_REFS.tenantId,
      DEMO_REFS.governanceFolderId,
      DEMO_REFS.userId,
      'Seeded risk scenario import',
      'spreadsheet',
      'risk_scenarios',
      'completed',
      3,
      2,
      0,
      JSON.stringify([
        { key: 'upload', label: 'Upload received', status: 'completed' },
        { key: 'validate', label: 'Validation complete', status: 'completed' },
        { key: 'apply', label: 'Records applied', status: 'completed' },
      ]),
      JSON.stringify({
        importedKinds: ['risk_scenarios'],
        note: 'Seeded import pipeline created during bootstrap.',
      }),
      JSON.stringify([{ id: 'risk-scenario-demo', name: 'Seeded risk scenario import' }]),
    )
    .run();

  await env.D1_MAIN.prepare(
    `
    INSERT OR REPLACE INTO chat_sessions (
      id,
      tenant_id,
      folder_id,
      owner_user_id,
      title,
      workflow,
      status,
      messages_json,
      citations_json,
      workflow_state_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      OPS_DEMO_IDS.chatSessionId,
      DEMO_REFS.tenantId,
      DEMO_REFS.governanceFolderId,
      DEMO_REFS.userId,
      'Workspace overview',
      'general',
      'active',
      JSON.stringify([
        {
          id: 'chat-message-demo-user',
          role: 'user',
          content: 'Give me a quick workspace summary.',
          createdAt: nowIso(),
        },
        {
          id: 'chat-message-demo-assistant',
          role: 'assistant',
          content:
            'The demo workspace is seeded with governance, third-party, privacy, resilience, portal, and advanced risk modules so you can inspect end-to-end flows locally.',
          createdAt: nowIso(),
          citations: [
            { label: 'Scope', value: 'Governance, privacy, third-party, resilience' },
          ],
        },
      ]),
      JSON.stringify([{ label: 'Seed source', value: 'bootstrap-demo' }]),
      JSON.stringify({}),
    )
    .run();

  const requirements: PortalRequirement[] = [
    {
      id: 'portal-requirement-demo-1',
      ref: '5.1',
      title: 'Policies for information security',
      question: 'Describe how the vendor publishes and reviews information security policies.',
      assessable: true,
      result: 'compliant',
      response: 'Policies are reviewed annually and approved by the security steering group.',
      observation: 'Policy evidence supplied in last annual review.',
      evidenceNote: 'Policy register and review minutes',
    },
    {
      id: 'portal-requirement-demo-2',
      ref: '8.2',
      title: 'Privileged access rights',
      question: 'Summarize how privileged access is approved and monitored.',
      assessable: true,
      result: 'partially_compliant',
      response: 'Approval is documented, but quarterly recertification is still rolling out.',
      observation: 'Follow-up evidence requested for quarterly review.',
      evidenceNote: 'Access approval screenshots',
    },
    {
      id: 'portal-requirement-demo-3',
      ref: '8.16',
      title: 'Monitoring activities',
      question: 'Explain what monitoring is performed for production services.',
      assessable: true,
      result: 'not_assessed',
      response: null,
      observation: null,
      evidenceNote: null,
    },
  ];

  await env.D1_MAIN.prepare(
    `
    INSERT OR REPLACE INTO portal_assignments (
      id,
      tenant_id,
      folder_id,
      compliance_assessment_id,
      entity_id,
      ref_id,
      name,
      framework_name,
      actor_name,
      actor_email,
      status,
      due_date,
      observation,
      requirements_json,
      events_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      OPS_DEMO_IDS.portalAssignmentId,
      DEMO_REFS.tenantId,
      DEMO_REFS.vendorFolderId,
      DEMO_REFS.complianceAssessmentId,
      DEMO_REFS.entityVendorId,
      'ASSIGN-001',
      'Vendor due diligence pack',
      'ISO 27001',
      'Jordan Vendor',
      'vendor@example.com',
      'in_progress',
      new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
      'Vendor is completing the latest security evidence refresh.',
      JSON.stringify(requirements),
      JSON.stringify([
        {
          id: 'portal-event-demo-assigned',
          eventType: 'assigned',
          actorName: 'CISO Assistant',
          note: 'Assignment opened for vendor response.',
          createdAt: nowIso(),
        },
      ]),
    )
    .run();

  const workshops = createDefaultEbiosWorkshops();
  await env.D1_MAIN.prepare(
    `
    INSERT OR REPLACE INTO ebios_studies (
      id,
      tenant_id,
      folder_id,
      perimeter_id,
      reference_entity_id,
      ref_id,
      name,
      description,
      version,
      status,
      quotation_method,
      risk_matrix_name,
      observation,
      workshop_status_json,
      feared_events_json,
      stakeholders_json,
      strategic_scenarios_json,
      operational_scenarios_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      OPS_DEMO_IDS.ebiosStudyId,
      DEMO_REFS.tenantId,
      DEMO_REFS.governanceFolderId,
      DEMO_REFS.perimeterId,
      DEMO_REFS.entityVendorId,
      'EBIOS-001',
      'Enterprise identity dependency study',
      'Advanced risk study for privileged access concentration and ecosystem dependencies.',
      '1.0',
      'in_progress',
      'express',
      'Enterprise Risk Matrix',
      'Workshop evidence is partially complete and ready for continued facilitation.',
      JSON.stringify(workshops),
      JSON.stringify([
        {
          id: 'feared-event-1',
          name: 'Privilege escalation disrupts access control',
          gravity: 4,
          assets: ['Identity platform', 'Privileged access workflows'],
        },
        {
          id: 'feared-event-2',
          name: 'Third-party outage blocks administrative recovery',
          gravity: 5,
          assets: ['Privileged recovery channel', 'Directory services'],
        },
      ]),
      JSON.stringify([
        { id: 'stakeholder-1', name: 'Identity Provider', category: 'supplier', dependency: 5 },
        { id: 'stakeholder-2', name: 'Internal IAM Team', category: 'internal', dependency: 4 },
      ]),
      JSON.stringify([
        { id: 'strategic-1', name: 'Credential theft via supplier channel', attacker: 'cybercrime', priority: 5 },
        { id: 'strategic-2', name: 'Privileged misuse after emergency access', attacker: 'insider', priority: 4 },
      ]),
      JSON.stringify([
        {
          id: 'operational-1',
          name: 'Break-glass account takeover',
          likelihood: 3,
          impact: 5,
          attackPath: ['Credential harvest', 'MFA bypass', 'Privilege escalation'],
        },
      ]),
    )
    .run();

  const scenarios = createDefaultQuantitativeScenarios();
  const actionPlan = buildQuantitativeActionPlan(scenarios);
  const metrics = computeQuantitativeMetrics(scenarios, 400000, 'USD');
  await env.D1_MAIN.prepare(
    `
    INSERT OR REPLACE INTO quantitative_studies (
      id,
      tenant_id,
      folder_id,
      risk_register_id,
      ref_id,
      name,
      description,
      version,
      status,
      distribution_model,
      currency,
      loss_threshold,
      observation,
      risk_tolerance_json,
      portfolio_json,
      scenarios_json,
      action_plan_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      OPS_DEMO_IDS.quantitativeStudyId,
      DEMO_REFS.tenantId,
      DEMO_REFS.governanceFolderId,
      DEMO_REFS.riskRegisterId,
      'QRS-001',
      'Identity service economic exposure',
      'Quantitative study estimating annualized loss from platform and supplier disruption.',
      '1.0',
      'in_progress',
      'lognormal_ci90',
      'USD',
      400000,
      'Portfolio simulation is seeded for local evaluation and UI validation.',
      JSON.stringify({
        points: {
          point1: { probability: 0.1, acceptableLoss: 350000 },
          point2: { probability: 0.02, acceptableLoss: 800000 },
        },
      }),
      JSON.stringify({
        currentAleCombined: metrics.currentAleCombined,
        residualAleCombined: metrics.residualAleCombined,
        riskReduction: metrics.riskReduction,
      }),
      JSON.stringify(scenarios),
      JSON.stringify(actionPlan),
    )
    .run();

  await env.D1_MAIN.prepare(
    `
    INSERT OR REPLACE INTO ops_utility_runs (
      id,
      tenant_id,
      utility_key,
      module_name,
      scope_label,
      records_hint,
      status,
      notes,
      preview_mode,
      receipt_path,
      created_by_user_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      'utility-run-demo-builder',
      DEMO_REFS.tenantId,
      'builder',
      'Builders',
      'FedRAMP workspace',
      12,
      'Preview only',
      'Scaffold refreshed before deeper builder edits.',
      1,
      'utilities/builder/receipt.json',
      DEMO_REFS.userId,
    )
    .run();

  await env.D1_MAIN.prepare(
    `
    INSERT OR REPLACE INTO ops_subsystem_preferences (
      id,
      tenant_id,
      subsystem_key,
      pinned,
      open_count,
      last_opened_at,
      activity_note,
      updated_by_user_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      'subsystem-pref-demo-comments',
      DEMO_REFS.tenantId,
      'comments',
      1,
      6,
      nowIso(),
      'Pinned for reviewer collaboration during SSP drafting.',
      DEMO_REFS.userId,
    )
    .run();

  await env.D1_MAIN.prepare(
    `
    INSERT OR REPLACE INTO ops_subsystem_sessions (
      tenant_id,
      active_subsystem_key,
      active_record_type,
      updated_by_user_id,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?)
    `,
  )
    .bind(DEMO_REFS.tenantId, 'comments', 'Security Plan', DEMO_REFS.userId, nowIso())
    .run();

  await env.D1_MAIN.prepare(
    `
    INSERT OR REPLACE INTO ops_rmf_packages (
      id,
      tenant_id,
      name,
      system_category,
      authorization_boundary,
      current_state,
      authorization_status,
      progress_percent,
      blockers_json,
      next_handoff,
      decision_target,
      steps_json,
      artifacts_json,
      timeline_json,
      created_by_user_id,
      updated_by_user_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      'rmf-package-demo-primary',
      DEMO_REFS.tenantId,
      'Regovise Moderate Authorization Package',
      'Moderate / SaaS',
      'Primary authorization boundary',
      'Assess',
      'ATO Prep',
      68,
      JSON.stringify([
        'Three assessment artifacts still need refreshed evidence.',
        'POAM-449 requires remediation or formal risk acceptance.',
      ]),
      'Advance to Authorize once SAR and residual-risk notes are refreshed.',
      'AO review target: May 6, 2026',
      JSON.stringify([
        {
          id: 'rmf-step-categorize',
          name: 'Categorize',
          status: 'Completed',
          progress: 100,
          owner: 'Security Architecture',
          summary: 'Impact values and system boundary approved.',
          detail: 'FIPS 199 impact values were reviewed with the mission owner.',
          route: '/utilities',
          artifacts: ['System boundary', 'Categorization memo'],
        },
        {
          id: 'rmf-step-select',
          name: 'Select',
          status: 'Completed',
          progress: 100,
          owner: 'Compliance Engineering',
          summary: 'Baseline and overlays selected.',
          detail: 'FedRAMP Moderate baseline and overlay set are approved.',
          route: '/policies',
          artifacts: ['Baseline selection', 'Overlay matrix'],
        },
        {
          id: 'rmf-step-implement',
          name: 'Implement',
          status: 'Completed',
          progress: 100,
          owner: 'System Owners',
          summary: 'Implementation statements captured.',
          detail: 'Implementation narratives and inheritance notes are available.',
          route: '/builders/report-builder',
          artifacts: ['Implementation statements', 'Inheritance notes'],
        },
        {
          id: 'rmf-step-assess',
          name: 'Assess',
          status: 'In Progress',
          progress: 72,
          owner: 'Assessment Team',
          summary: 'Assessment evidence refresh is underway.',
          detail: 'Remaining test cases and screenshots are being updated before AO handoff.',
          route: '/evidence-management',
          artifacts: ['Assessment procedures', 'Evidence refresh'],
        },
        {
          id: 'rmf-step-authorize',
          name: 'Authorize',
          status: 'Planned',
          progress: 20,
          owner: 'Authorizing Official',
          summary: 'AO package is staged after assessment closeout.',
          detail: 'Residual risk statement and SAR must be finalized first.',
          route: '/workflow',
          artifacts: ['SAR', 'Residual risk memo'],
        },
        {
          id: 'rmf-step-monitor',
          name: 'Monitor',
          status: 'Planned',
          progress: 10,
          owner: 'Continuous Monitoring',
          summary: 'Cadence prepared for post-authorization monitoring.',
          detail: 'ConMon profile is ready once the package moves to monitoring.',
          route: '/conmon/executions',
          artifacts: ['ConMon profile'],
        },
      ]),
      JSON.stringify([
        {
          id: 'rmf-artifact-ssp',
          title: 'System Security Plan',
          module: 'Security Plans',
          step: 'Implement',
          owner: 'Maya Chen',
          status: 'Ready',
          helper: 'Current working SSP package for AO handoff.',
        },
        {
          id: 'rmf-artifact-sar',
          title: 'Security Assessment Report',
          module: 'Assessments',
          step: 'Assess',
          owner: 'Jon Park',
          status: 'Refresh needed',
          helper: 'Last assessment requires refreshed evidence references.',
        },
        {
          id: 'rmf-artifact-poam',
          title: 'POA&M',
          module: 'Issues',
          step: 'Authorize',
          owner: 'Aria Patel',
          status: 'Open',
          helper: 'Residual findings awaiting remediation decisions.',
        },
      ]),
      JSON.stringify([
        { bucket: 'Week 1', progress: 34, artifacts: 12, findings: 6 },
        { bucket: 'Week 2', progress: 51, artifacts: 18, findings: 5 },
        { bucket: 'Week 3', progress: 68, artifacts: 24, findings: 3 },
      ]),
      DEMO_REFS.userId,
      DEMO_REFS.userId,
    )
    .run();

  await env.D1_MAIN.prepare(
    `
    INSERT OR REPLACE INTO ops_app_management_apps (
      id,
      tenant_id,
      name,
      description,
      administrators_json,
      default_public,
      inherit_parent_access,
      default_users_json,
      default_groups_json,
      groups_json,
      users_json,
      service_accounts_json,
      automation_owner,
      automation_queue,
      automation_health,
      notes,
      created_by_user_id,
      updated_by_user_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      'app-mgmt-demo-fedramp',
      DEMO_REFS.tenantId,
      'FedRAMP Business Unit',
      'Segregated business-unit workspace for authorization support, assessments, and exports.',
      JSON.stringify(['Maya Chen', 'Aria Patel']),
      0,
      1,
      JSON.stringify(['maya@example.com', 'aria@example.com']),
      JSON.stringify(['FedRAMP PMO', 'Assessors']),
      JSON.stringify([
        { name: 'FedRAMP PMO', create: true, read: true, update: true, delete: false, ssoSync: true },
        { name: 'Assessors', create: false, read: true, update: true, delete: false, ssoSync: true },
      ]),
      JSON.stringify([
        {
          email: 'maya@example.com',
          groups: ['FedRAMP PMO'],
          delegate: 'OpenRegScale Admin',
          notifications: 'Enabled',
          accessLogs: 'Available',
        },
        {
          email: 'aria@example.com',
          groups: ['FedRAMP PMO', 'Assessors'],
          delegate: 'Jon Park',
          notifications: 'Enabled',
          accessLogs: 'Available',
        },
      ]),
      JSON.stringify([
        {
          purpose: 'SSP export pipeline',
          tokenDuration: '30 days',
          adminRequired: false,
          crudScope: 'Read',
          status: 'Healthy',
        },
      ]),
      'Maya Chen',
      'app-fedramp-automation-dispatch',
      'Healthy',
      'Primary BU used for regulated workload authorization and AO-ready reporting.',
      DEMO_REFS.userId,
      DEMO_REFS.userId,
    )
    .run();
}

async function listReportExports(env: EnvBindings, tenantId: string) {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      export_item.id,
      export_item.tenant_id,
      export_item.folder_id,
      folder_item.name AS folder_name,
      export_item.created_by_user_id,
      export_item.report_id,
      export_item.name,
      export_item.format,
      export_item.status,
      export_item.filter_json,
      export_item.summary_json,
      export_item.content_json,
      export_item.created_at,
      export_item.updated_at
    FROM report_exports AS export_item
    LEFT JOIN folders AS folder_item
      ON folder_item.id = export_item.folder_id
    WHERE export_item.tenant_id = ?
    ORDER BY export_item.created_at DESC
    `,
  )
    .bind(tenantId)
    .all<ReportExportRow>();

  return results.map(toReportExportResponse);
}

async function listReportBuilderCatalogItems(env: EnvBindings, tenantId: string) {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT id, title, chart_type, module_name, status, source, description, updated_at
    FROM report_builder_reports
    WHERE tenant_id = ?
    ORDER BY updated_at DESC, title ASC
    LIMIT 50
    `,
  )
    .bind(tenantId)
    .all<ReportBuilderCatalogRow>();

  return rows.results.map((row) => ({
    id: `report-builder:${row.id}`,
    title: row.title,
    description: row.description ?? `${row.chart_type} report over ${row.module_name} data.`,
    href: `/builders/report-builder?reportId=${encodeURIComponent(row.id)}`,
    tags: ['Report Builder', row.chart_type, row.module_name, row.status],
    source: row.source || 'Report Builder',
    status: row.status,
    lastUpdated: row.updated_at,
  }));
}

async function listImports(env: EnvBindings, tenantId: string) {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      import_job.id,
      import_job.tenant_id,
      import_job.folder_id,
      folder_item.name AS folder_name,
      import_job.created_by_user_id,
      import_job.name,
      import_job.source_type,
      import_job.target_kind,
      import_job.status,
      import_job.row_count,
      import_job.imported_count,
      import_job.error_count,
      import_job.steps_json,
      import_job.summary_json,
      import_job.created_objects_json,
      import_job.created_at,
      import_job.updated_at
    FROM import_jobs AS import_job
    INNER JOIN folders AS folder_item
      ON folder_item.id = import_job.folder_id
    WHERE import_job.tenant_id = ?
    ORDER BY import_job.created_at DESC
    `,
  )
    .bind(tenantId)
    .all<ImportJobRow>();

  return results.map(toImportJobResponse);
}

async function listChatSessions(env: EnvBindings, tenantId: string) {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      session.id,
      session.tenant_id,
      session.folder_id,
      folder_item.name AS folder_name,
      session.owner_user_id,
      user_item.display_name AS owner_name,
      session.title,
      session.workflow,
      session.status,
      session.messages_json,
      session.citations_json,
      session.workflow_state_json,
      session.created_at,
      session.updated_at
    FROM chat_sessions AS session
    INNER JOIN folders AS folder_item
      ON folder_item.id = session.folder_id
    LEFT JOIN users AS user_item
      ON user_item.id = session.owner_user_id
    WHERE session.tenant_id = ?
    ORDER BY session.updated_at DESC
    `,
  )
    .bind(tenantId)
    .all<ChatSessionRow>();

  return results.map(toChatSessionResponse);
}

async function getChatSession(env: EnvBindings, tenantId: string, sessionId: string) {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT
      session.id,
      session.tenant_id,
      session.folder_id,
      folder_item.name AS folder_name,
      session.owner_user_id,
      user_item.display_name AS owner_name,
      session.title,
      session.workflow,
      session.status,
      session.messages_json,
      session.citations_json,
      session.workflow_state_json,
      session.created_at,
      session.updated_at
    FROM chat_sessions AS session
    INNER JOIN folders AS folder_item
      ON folder_item.id = session.folder_id
    LEFT JOIN users AS user_item
      ON user_item.id = session.owner_user_id
    WHERE session.tenant_id = ? AND session.id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, sessionId)
    .first<ChatSessionRow>();

  return row ? toChatSessionResponse(row) : null;
}

async function listPortalAssignments(env: EnvBindings, tenantId: string) {
  return listPortalAssignmentsByActor(env, tenantId, null);
}

async function listPortalAssignmentsByActor(
  env: EnvBindings,
  tenantId: string,
  actorEmail: string | null,
) {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      assignment.id,
      assignment.tenant_id,
      assignment.folder_id,
      folder_item.name AS folder_name,
      assignment.compliance_assessment_id,
      compliance_assessment.name AS compliance_assessment_name,
      assignment.entity_id,
      entity.name AS entity_name,
      assignment.ref_id,
      assignment.name,
      assignment.framework_name,
      assignment.actor_name,
      assignment.actor_email,
      assignment.status,
      assignment.due_date,
      assignment.submitted_at,
      assignment.observation,
      assignment.requirements_json,
      assignment.events_json,
      assignment.created_at,
      assignment.updated_at
    FROM portal_assignments AS assignment
    INNER JOIN folders AS folder_item
      ON folder_item.id = assignment.folder_id
    LEFT JOIN compliance_assessments AS compliance_assessment
      ON compliance_assessment.id = assignment.compliance_assessment_id
    LEFT JOIN entities AS entity
      ON entity.id = assignment.entity_id
    WHERE assignment.tenant_id = ?
      AND (? IS NULL OR LOWER(TRIM(COALESCE(assignment.actor_email, ''))) = ?)
    ORDER BY assignment.updated_at DESC
    `,
  )
    .bind(tenantId, actorEmail, actorEmail)
    .all<PortalAssignmentRow>();

  return results.map(toPortalAssignmentResponse);
}

async function getPortalAssignment(env: EnvBindings, tenantId: string, assignmentId: string) {
  return getPortalAssignmentByActor(env, tenantId, assignmentId, null);
}

async function getPortalAssignmentByActor(
  env: EnvBindings,
  tenantId: string,
  assignmentId: string,
  actorEmail: string | null,
) {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT
      assignment.id,
      assignment.tenant_id,
      assignment.folder_id,
      folder_item.name AS folder_name,
      assignment.compliance_assessment_id,
      compliance_assessment.name AS compliance_assessment_name,
      assignment.entity_id,
      entity.name AS entity_name,
      assignment.ref_id,
      assignment.name,
      assignment.framework_name,
      assignment.actor_name,
      assignment.actor_email,
      assignment.status,
      assignment.due_date,
      assignment.submitted_at,
      assignment.observation,
      assignment.requirements_json,
      assignment.events_json,
      assignment.created_at,
      assignment.updated_at
    FROM portal_assignments AS assignment
    INNER JOIN folders AS folder_item
      ON folder_item.id = assignment.folder_id
    LEFT JOIN compliance_assessments AS compliance_assessment
      ON compliance_assessment.id = assignment.compliance_assessment_id
    LEFT JOIN entities AS entity
      ON entity.id = assignment.entity_id
    WHERE assignment.tenant_id = ? AND assignment.id = ?
      AND (? IS NULL OR LOWER(TRIM(COALESCE(assignment.actor_email, ''))) = ?)
    LIMIT 1
    `,
  )
    .bind(tenantId, assignmentId, actorEmail, actorEmail)
    .first<PortalAssignmentRow>();

  return row ? toPortalAssignmentResponse(row) : null;
}

function normalizePortalEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function hasAnyPermission(permissions: string[], requiredPermissions: string[]): boolean {
  return requiredPermissions.some((permission) => permissions.includes(permission));
}

async function loadPortalPrincipal(
  env: EnvBindings,
  tenantId: string,
  userId: string | null | undefined,
): Promise<PortalPrincipalRow | null> {
  if (!userId) {
    return null;
  }

  return env.D1_MAIN.prepare(
    `
    SELECT id, email, display_name, is_auditee, is_active
    FROM users
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, userId)
    .first<PortalPrincipalRow>();
}

async function authorizePortalAccess(
  ctx: WorkerRequestContext,
  mode: 'read' | 'write',
  assignmentId?: string,
): Promise<
  | Response
  | {
      scope: 'internal' | 'auditee';
      assignment: ReturnType<typeof toPortalAssignmentResponse> | null;
      actorEmail: string | null;
    }
> {
  const permissionContext = await loadPermissionContext(ctx);
  if (permissionContext instanceof Response) {
    return permissionContext;
  }

  const internalAllowed = hasAnyPermission(
    permissionContext.permissions,
    mode === 'read' ? FRAMEWORK_READ_PERMISSIONS : FRAMEWORK_WRITE_PERMISSIONS,
  );

  if (internalAllowed) {
    const assignment = assignmentId
      ? await getPortalAssignment(ctx.env, ctx.tenantId!, assignmentId)
      : null;

    if (assignmentId && !assignment) {
      return json(
        { error: 'portal_assignment_not_found', message: 'The selected assignment does not exist.' },
        { status: 404 },
      );
    }

    return {
      scope: 'internal',
      assignment,
      actorEmail: null,
    };
  }

  const principal = await loadPortalPrincipal(ctx.env, ctx.tenantId!, ctx.userId);
  const actorEmail = normalizePortalEmail(principal?.email);
  const isAuditeeActor =
    principal?.is_active === 1 && principal?.is_auditee === 1 && actorEmail.length > 0;

  if (!isAuditeeActor) {
    return json(
      {
        error: 'forbidden',
        message:
          mode === 'read'
            ? 'Auditee portal access requires assignment ownership or framework-view permissions.'
            : 'Portal submission changes require assignment ownership or framework management permissions.',
      },
      { status: 403 },
    );
  }

  const assignment = assignmentId
    ? await getPortalAssignmentByActor(ctx.env, ctx.tenantId!, assignmentId, actorEmail)
    : null;

  if (assignmentId && !assignment) {
    return json(
      { error: 'portal_assignment_not_found', message: 'The selected assignment does not exist.' },
      { status: 404 },
    );
  }

  return {
    scope: 'auditee',
    assignment,
    actorEmail,
  };
}

async function getUserRecipient(
  env: EnvBindings,
  tenantId: string,
  userId: string | null | undefined,
): Promise<UserRecipientRow | null> {
  if (!userId) {
    return null;
  }

  return env.D1_MAIN.prepare(
    `
    SELECT email, display_name
    FROM users
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, userId)
    .first<UserRecipientRow>();
}

function buildModuleRecordScopeClause(accessibleDomainIds: readonly string[]) {
  if (accessibleDomainIds.length === 0) {
    return {
      clause: '1 = 0',
      bindings: [] as string[],
    };
  }

  return {
    clause: `record.folder_id IN (${accessibleDomainIds.map(() => '?').join(', ')})`,
    bindings: [...accessibleDomainIds],
  };
}

async function listRecentModuleRecordOpsRows(
  env: EnvBindings,
  tenantId: string,
  accessibleDomainIds: readonly string[],
  limit = 120,
) {
  const scope = buildModuleRecordScopeClause(accessibleDomainIds);
  const result = await env.D1_MAIN.prepare(
    `
    SELECT
      record.id,
      record.module_key,
      record.title,
      record.status,
      record.folder_id,
      record.owner_user_id,
      record.assignee_user_id,
      record.start_on,
      record.finish_on,
      record.due_on,
      record.review_on,
      record.expires_on,
      record.data_json,
      record.updated_at,
      record.created_at,
      owner.display_name AS owner_display_name,
      owner.first_name AS owner_first_name,
      owner.last_name AS owner_last_name,
      owner.email AS owner_email,
      assignee.display_name AS assignee_display_name,
      assignee.first_name AS assignee_first_name,
      assignee.last_name AS assignee_last_name,
      assignee.email AS assignee_email
    FROM module_records AS record
    LEFT JOIN users AS owner
      ON owner.tenant_id = record.tenant_id AND owner.id = record.owner_user_id
    LEFT JOIN users AS assignee
      ON assignee.tenant_id = record.tenant_id AND assignee.id = record.assignee_user_id
    WHERE record.tenant_id = ?
      AND record.archived = 0
      AND ${scope.clause}
    ORDER BY record.updated_at DESC
    LIMIT ?
    `,
  )
    .bind(tenantId, ...scope.bindings, limit)
    .all<ModuleRecordOpsRow>();

  return result.results ?? [];
}

async function listDatedModuleRecordOpsRows(
  env: EnvBindings,
  tenantId: string,
  accessibleDomainIds: readonly string[],
  limit = 120,
) {
  const scope = buildModuleRecordScopeClause(accessibleDomainIds);
  const result = await env.D1_MAIN.prepare(
    `
    SELECT
      record.id,
      record.module_key,
      record.title,
      record.status,
      record.folder_id,
      record.owner_user_id,
      record.assignee_user_id,
      record.start_on,
      record.finish_on,
      record.due_on,
      record.review_on,
      record.expires_on,
      record.data_json,
      record.updated_at,
      record.created_at,
      owner.display_name AS owner_display_name,
      owner.first_name AS owner_first_name,
      owner.last_name AS owner_last_name,
      owner.email AS owner_email,
      assignee.display_name AS assignee_display_name,
      assignee.first_name AS assignee_first_name,
      assignee.last_name AS assignee_last_name,
      assignee.email AS assignee_email
    FROM module_records AS record
    LEFT JOIN users AS owner
      ON owner.tenant_id = record.tenant_id AND owner.id = record.owner_user_id
    LEFT JOIN users AS assignee
      ON assignee.tenant_id = record.tenant_id AND assignee.id = record.assignee_user_id
    WHERE record.tenant_id = ?
      AND record.archived = 0
      AND ${scope.clause}
      AND (
        record.start_on IS NOT NULL OR
        record.finish_on IS NOT NULL OR
        record.due_on IS NOT NULL OR
        record.review_on IS NOT NULL OR
        record.expires_on IS NOT NULL
      )
    ORDER BY COALESCE(record.due_on, record.review_on, record.expires_on, record.finish_on, record.start_on) ASC
    LIMIT ?
    `,
  )
    .bind(tenantId, ...scope.bindings, limit)
    .all<ModuleRecordOpsRow>();

  return result.results ?? [];
}

async function listRecentAssessmentOpsRows(env: EnvBindings, tenantId: string, limit = 40) {
  const result = await env.D1_MAIN.prepare(
    `
    SELECT
      assessment.id,
      assessment.name,
      assessment.status,
      assessment.assessment_kind,
      assessment.lead_assessor_user_id,
      lead.display_name AS lead_assessor_display_name,
      lead.first_name AS lead_assessor_first_name,
      lead.last_name AS lead_assessor_last_name,
      lead.email AS lead_assessor_email,
      assessment.planned_start_on,
      assessment.planned_finish_on,
      assessment.instructions,
      assessment.process_info,
      assessment.source_security_plan_id,
      assessment.updated_at,
      assessment.created_at
    FROM compliance_assessments AS assessment
    LEFT JOIN users AS lead
      ON lead.tenant_id = assessment.tenant_id AND lead.id = assessment.lead_assessor_user_id
    WHERE assessment.tenant_id = ?
    ORDER BY assessment.updated_at DESC
    LIMIT ?
    `,
  )
    .bind(tenantId, limit)
    .all<AssessmentOpsRow>();

  return result.results ?? [];
}

async function listDatedAssessmentOpsRows(env: EnvBindings, tenantId: string, limit = 40) {
  const result = await env.D1_MAIN.prepare(
    `
    SELECT
      assessment.id,
      assessment.name,
      assessment.status,
      assessment.assessment_kind,
      assessment.lead_assessor_user_id,
      lead.display_name AS lead_assessor_display_name,
      lead.first_name AS lead_assessor_first_name,
      lead.last_name AS lead_assessor_last_name,
      lead.email AS lead_assessor_email,
      assessment.planned_start_on,
      assessment.planned_finish_on,
      assessment.instructions,
      assessment.process_info,
      assessment.source_security_plan_id,
      assessment.updated_at,
      assessment.created_at
    FROM compliance_assessments AS assessment
    LEFT JOIN users AS lead
      ON lead.tenant_id = assessment.tenant_id AND lead.id = assessment.lead_assessor_user_id
    WHERE assessment.tenant_id = ?
      AND (assessment.planned_start_on IS NOT NULL OR assessment.planned_finish_on IS NOT NULL)
    ORDER BY COALESCE(assessment.planned_start_on, assessment.planned_finish_on) ASC
    LIMIT ?
    `,
  )
    .bind(tenantId, limit)
    .all<AssessmentOpsRow>();

  return result.results ?? [];
}

async function buildWorkbenchSnapshot(
  env: EnvBindings,
  tenantId: string,
  moduleRecordAccessibleDomainIds: readonly string[],
) {
  const [
    usersResult,
    exports,
    imports,
    assignments,
    controlRows,
    conmonRows,
    grcJobRows,
    grcReportRows,
    moduleRecordRows,
    assessmentRows,
  ] = await Promise.all([
    env.D1_MAIN.prepare(
      `
      SELECT id, email, display_name, first_name, last_name
      FROM users
      WHERE tenant_id = ? AND is_active = 1
      ORDER BY COALESCE(display_name, email) ASC
      `,
    )
      .bind(tenantId)
      .all<{
        id: string;
        email: string;
        display_name: string | null;
        first_name: string | null;
        last_name: string | null;
      }>(),
    listReportExports(env, tenantId),
    listImports(env, tenantId),
    listPortalAssignments(env, tenantId),
    env.D1_MAIN.prepare(
      `
      SELECT
        control.id,
        control.name AS title,
        'Issues' AS module,
        control.status,
        control.owner_name,
        control.priority,
        control.eta AS due_date,
        control.updated_at,
        control.created_at,
        '/applied-controls/kanban-mode' AS route,
        COALESCE(control.notes, control.description, 'Action-plan item requiring operator follow-through.') AS detail
      FROM applied_controls AS control
      WHERE control.tenant_id = ?
      ORDER BY control.updated_at DESC
      LIMIT 12
      `,
    )
      .bind(tenantId)
      .all<WorkbenchItemRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT
        execution.id,
        activity.name AS title,
        'Monitoring' AS module,
        execution.status,
        profile.name AS owner_name,
        NULL AS priority,
        NULL AS due_date,
        COALESCE(execution.finished_at, execution.started_at) AS updated_at,
        execution.started_at AS created_at,
        '/conmon/executions' AS route,
        COALESCE(execution.status_detail, activity.description, 'Continuous monitoring execution activity.') AS detail
      FROM conmon_executions AS execution
      INNER JOIN conmon_profiles AS profile
        ON profile.id = execution.profile_id
      INNER JOIN conmon_activity_configs AS activity
        ON activity.id = execution.activity_id
      WHERE execution.tenant_id = ?
      ORDER BY execution.started_at DESC
      LIMIT 8
      `,
    )
      .bind(tenantId)
      .all<WorkbenchItemRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT
        job.id,
        job.job_type,
        job.source_ref,
        job.status,
        COALESCE(job.finished_at, job.started_at, job.updated_at, job.created_at) AS activity_at,
        job.result_json,
        job.diagnostics_json
      FROM grc_job_runs AS job
      WHERE job.tenant_id = ?
      ORDER BY COALESCE(job.finished_at, job.started_at, job.updated_at, job.created_at) DESC
      LIMIT 10
      `,
    )
      .bind(tenantId)
      .all<{
        id: string;
        job_type: string;
        source_ref: string | null;
        status: string;
        activity_at: string;
        result_json: string;
        diagnostics_json: string;
      }>(),
    env.D1_MAIN.prepare(
      `
      SELECT
        snapshot.id,
        snapshot.report_kind,
        snapshot.title,
        snapshot.status,
        snapshot.updated_at
      FROM grc_report_snapshots AS snapshot
      WHERE snapshot.tenant_id = ?
      ORDER BY snapshot.updated_at DESC
      LIMIT 8
      `,
    )
      .bind(tenantId)
      .all<{
        id: string;
        report_kind: string;
        title: string;
        status: string;
        updated_at: string;
      }>(),
    listRecentModuleRecordOpsRows(env, tenantId, moduleRecordAccessibleDomainIds),
    listRecentAssessmentOpsRows(env, tenantId),
  ]);

  const moduleWorkbenchItems = moduleRecordRows
    .map(toModuleRecordOpsItem)
    .filter((item): item is ModuleRecordOpsItem => Boolean(item))
    .map((item) => {
      const normalizedStatus = normalizeWorkbenchStatus(item.status);
      const actionableDate = item.dueOn ?? item.reviewOn ?? item.expiresOn ?? item.finishOn ?? item.startOn;
      return {
        id: item.id,
        title: item.title,
        module: item.moduleLabel,
        status: normalizedStatus,
        owner: item.owner,
        priority:
          normalizedStatus === 'Action Needed'
            ? 'High'
            : actionableDate
              ? 'Watch'
              : 'Medium',
        dueDate: actionableDate,
        route: item.route,
        summary: item.detail,
        lastActivity: item.lastActivity,
        progress:
          normalizedStatus === 'Done'
            ? 100
            : normalizedStatus === 'In Review'
              ? 75
              : normalizedStatus === 'In Progress'
                ? 55
                : normalizedStatus === 'Action Needed'
                  ? 35
                  : 20,
      };
    });

  const assessmentWorkbenchItems = assessmentRows.map((row) => {
    const item = toAssessmentOpsItem(row);
    const normalizedStatus = normalizeWorkbenchStatus(item.status);
    return {
      id: item.id,
      title: item.title,
      module: 'Assessments',
      status: normalizedStatus,
      owner: item.owner,
      priority:
        item.plannedFinishOn && normalizedStatus !== 'Done'
          ? 'High'
          : normalizedStatus === 'Action Needed'
            ? 'High'
            : 'Medium',
      dueDate: item.plannedFinishOn,
      route: item.route,
      summary: item.detail,
      lastActivity: item.lastActivity,
      progress:
        normalizedStatus === 'Done'
          ? 100
          : normalizedStatus === 'In Review'
            ? 75
            : normalizedStatus === 'In Progress'
              ? 55
              : normalizedStatus === 'Action Needed'
                ? 35
                : 20,
    };
  });

  const items = [
    ...(controlRows.results ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      module: row.module,
      status: normalizeWorkbenchStatus(row.status),
      owner: row.owner_name ?? 'Unassigned',
      priority: normalizePriority(row.priority),
      dueDate: row.due_date,
      route: row.route,
      summary: row.detail,
      lastActivity: row.updated_at,
      progress:
        normalizeWorkbenchStatus(row.status) === 'Done'
          ? 100
          : normalizeWorkbenchStatus(row.status) === 'In Review'
            ? 75
            : normalizeWorkbenchStatus(row.status) === 'In Progress'
              ? 55
              : normalizeWorkbenchStatus(row.status) === 'Action Needed'
                ? 35
                : 20,
    })),
    ...assignments.slice(0, 10).map((assignment) => ({
      id: assignment.id,
      title: assignment.name,
      module: 'Assessments',
      status: normalizeWorkbenchStatus(assignment.status),
      owner: assignment.actorName ?? assignment.entityName ?? 'External reviewer',
      priority: assignment.status === 'submitted' ? 'High' : 'Watch',
      dueDate: assignment.dueDate,
      route: `/portal/assignments/${assignment.id}`,
      summary: assignment.frameworkName
        ? `${assignment.frameworkName} assignment for ${assignment.folderName}`
        : `Portal assignment for ${assignment.folderName}`,
      lastActivity: assignment.updatedAt,
      progress: assignment.progressPercent,
    })),
    ...imports.slice(0, 8).map((job) => ({
      id: job.id,
      title: job.name,
      module: 'Imports',
      status: normalizeWorkbenchStatus(job.status),
      owner: job.folderName,
      priority: job.errorCount > 0 ? 'High' : 'Medium',
      dueDate: null,
      route: '/imports',
      summary: `${job.sourceType} import targeting ${job.targetKind.replace(/_/g, ' ')}`,
      lastActivity: job.updatedAt,
      progress: job.status === 'completed' ? 100 : Math.max(15, Math.min(85, Math.round((job.importedCount / Math.max(1, job.rowCount)) * 100))),
    })),
    ...exports.slice(0, 8).map((item) => ({
      id: item.id,
      title: item.name,
      module: 'Reports',
      status: normalizeWorkbenchStatus(item.status),
      owner: item.folderName ?? 'Workspace export',
      priority: item.status === 'validation_failed' ? 'High' : 'Medium',
      dueDate: null,
      route: '/reports',
      summary: `${item.reportId} export in ${item.format.toUpperCase()} format`,
      lastActivity: item.updatedAt,
      progress: item.status === 'generated' || item.status === 'ready' ? 100 : item.status === 'validation_failed' ? 40 : 65,
    })),
    ...(conmonRows.results ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      module: row.module,
      status: normalizeWorkbenchStatus(row.status),
      owner: row.owner_name ?? 'Monitoring profile',
      priority: row.status === 'failed' ? 'High' : 'Watch',
      dueDate: row.due_date,
      route: row.route,
      summary: row.detail,
      lastActivity: row.updated_at,
      progress:
        normalizeWorkbenchStatus(row.status) === 'Done'
          ? 100
          : normalizeWorkbenchStatus(row.status) === 'Action Needed'
            ? 30
            : 60,
    })),
    ...(grcJobRows.results ?? []).map((row) => ({
      id: row.id,
      title: row.job_type.replace(/-/g, ' '),
      module: 'GRC Engine',
      status: normalizeWorkbenchStatus(row.status),
      owner: row.source_ref ?? 'Tenant-wide',
      priority: row.status === 'failed' ? 'High' : 'Medium',
      dueDate: null,
      route: '/grc-admin',
      summary:
        row.status === 'failed'
          ? `Background GRC job failed: ${row.job_type}.`
          : `Background GRC job ${row.job_type.replace(/-/g, ' ')} ${row.status}.`,
      lastActivity: row.activity_at,
      progress: row.status === 'completed' ? 100 : row.status === 'failed' ? 35 : 60,
    })),
    ...(grcReportRows.results ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      module: 'GRC Reports',
      status: normalizeWorkbenchStatus(row.status),
      owner: row.report_kind,
      priority: 'Watch',
      dueDate: null,
      route: '/report-bundles',
      summary: `${row.report_kind.replace(/-/g, ' ')} snapshot is available for downstream delivery surfaces.`,
      lastActivity: row.updated_at,
      progress: row.status === 'ready' ? 100 : 65,
    })),
    ...moduleWorkbenchItems,
    ...assessmentWorkbenchItems,
  ].sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

  const activeItems = items.filter((item) => item.status !== 'Done');
  const completedItems = items.filter((item) => item.status === 'Done').slice(0, 8);

  const activityMap = new Map<string, { bucket: string; active: number; completed: number; attention: number }>();
  for (const item of items.slice(0, 20)) {
    const bucket = bucketLabel(item.lastActivity);
    const current = activityMap.get(bucket) ?? { bucket, active: 0, completed: 0, attention: 0 };
    if (item.status === 'Done') {
      current.completed += 1;
    } else {
      current.active += 1;
    }
    if (item.status === 'Action Needed') {
      current.attention += 1;
    }
    activityMap.set(bucket, current);
  }

  const moduleCounts = new Map<string, number>();
  for (const item of items) {
    moduleCounts.set(item.module, (moduleCounts.get(item.module) ?? 0) + 1);
  }

  const users = (usersResult.results ?? []).map((user) => ({
    id: user.id,
    name:
      user.display_name?.trim() ||
      [user.first_name?.trim(), user.last_name?.trim()].filter(Boolean).join(' ') ||
      user.email,
    email: user.email,
  }));

  return {
    metrics: {
      activeItems: activeItems.length,
      actionNeeded: items.filter((item) => item.status === 'Action Needed').length,
      dueSoon: items.filter((item) => {
        if (!item.dueDate) {
          return false;
        }
        const delta = Date.parse(item.dueDate) - Date.now();
        return Number.isFinite(delta) && delta >= 0 && delta <= 7 * 24 * 60 * 60 * 1000;
      }).length,
      completedItems: completedItems.length,
    },
    users,
    items: activeItems.slice(0, 20),
    completedItems,
    activity: [...activityMap.values()].reverse(),
    moduleVolume: [...moduleCounts.entries()]
      .map(([module, count]) => ({ module, count }))
      .sort((a, b) => b.count - a.count),
  };
}

async function buildNewsFeedSnapshot(env: EnvBindings, tenantId: string) {
  const [exports, imports, assignments, sessions, evidenceJobsResult, grcJobRows, grcReportRows] = await Promise.all([
    listReportExports(env, tenantId),
    listImports(env, tenantId),
    listPortalAssignments(env, tenantId),
    listChatSessions(env, tenantId),
    env.D1_MAIN.prepare(
      `
      SELECT
        job.id,
        source.name AS source_name,
        source.provider,
        job.status,
        COALESCE(job.finished_at, job.started_at, job.updated_at, job.created_at) AS occurred_at,
        job.status_detail
      FROM evidence_jobs AS job
      INNER JOIN evidence_sources AS source
        ON source.id = job.source_id
      WHERE job.tenant_id = ?
      ORDER BY COALESCE(job.finished_at, job.started_at, job.updated_at, job.created_at) DESC
      LIMIT 8
      `,
    )
      .bind(tenantId)
      .all<{
        id: string;
        source_name: string;
        provider: string;
        status: string;
        occurred_at: string | null;
        status_detail: string | null;
      }>(),
    env.D1_MAIN.prepare(
      `
      SELECT
        job.id,
        job.job_type,
        job.source_ref,
        job.status,
        COALESCE(job.finished_at, job.started_at, job.updated_at, job.created_at) AS occurred_at
      FROM grc_job_runs AS job
      WHERE job.tenant_id = ?
      ORDER BY COALESCE(job.finished_at, job.started_at, job.updated_at, job.created_at) DESC
      LIMIT 8
      `,
    )
      .bind(tenantId)
      .all<{
        id: string;
        job_type: string;
        source_ref: string | null;
        status: string;
        occurred_at: string;
      }>(),
    env.D1_MAIN.prepare(
      `
      SELECT
        snapshot.id,
        snapshot.report_kind,
        snapshot.title,
        snapshot.status,
        snapshot.updated_at
      FROM grc_report_snapshots AS snapshot
      WHERE snapshot.tenant_id = ?
      ORDER BY snapshot.updated_at DESC
      LIMIT 8
      `,
    )
      .bind(tenantId)
      .all<{
        id: string;
        report_kind: string;
        title: string;
        status: string;
        updated_at: string;
      }>(),
  ]);

  const events: NewsFeedEvent[] = [
    ...exports.slice(0, 8).map((item) => ({
      id: item.id,
      title: item.name,
      module: 'Reports',
      type: 'Export',
      priority: item.status === 'validation_failed' ? 'Action' : 'Info',
      status: item.status,
      summary: `${item.reportId} export ${item.status.replace(/_/g, ' ')} in ${item.format.toUpperCase()}.`,
      route: '/reports',
      occurredAt: item.updatedAt,
      actor: item.createdByUserId,
    })),
    ...imports.slice(0, 8).map((job) => ({
      id: job.id,
      title: job.name,
      module: 'Imports',
      type: 'Import',
      priority: job.errorCount > 0 ? 'Action' : 'Watch',
      status: job.status,
      summary: `${job.importedCount}/${job.rowCount} rows applied to ${job.targetKind.replace(/_/g, ' ')}.`,
      route: '/imports',
      occurredAt: job.updatedAt,
      actor: job.createdByUserId,
    })),
    ...assignments.slice(0, 8).map((assignment) => ({
      id: assignment.id,
      title: assignment.name,
      module: 'Portal',
      type: 'Workflow',
      priority: assignment.status === 'submitted' ? 'Watch' : 'Action',
      status: assignment.status,
      summary: `${assignment.progressPercent}% of assessable requirements completed for ${assignment.folderName}.`,
      route: `/portal/assignments/${assignment.id}`,
      occurredAt: assignment.updatedAt,
      actor: assignment.actorName,
    })),
    ...sessions.slice(0, 8).map((session) => ({
      id: session.id,
      title: session.title || 'Workspace chat',
      module: 'Guidance',
      type: 'Comment',
      priority: session.messageCount > 4 ? 'Watch' : 'Info',
      status: session.status,
      summary: session.lastMessagePreview || `Workflow ${session.workflow} is active in ${session.folderName}.`,
      route: '/chat',
      occurredAt: session.updatedAt,
      actor: session.ownerName,
    })),
    ...(evidenceJobsResult.results ?? []).map((job) => ({
      id: job.id,
      title: `${job.source_name} evidence job`,
      module: 'Evidence',
      type: 'Collection',
      priority: job.status === 'failed' ? 'Action' : 'Watch',
      status: job.status,
      summary: job.status_detail || `${job.provider} collection job ${job.status.replace(/_/g, ' ')}.`,
      route: '/evidence/jobs',
      occurredAt: job.occurred_at ?? nowIso(),
      actor: null,
    })),
    ...(grcJobRows.results ?? []).map((job) => ({
      id: job.id,
      title: job.job_type.replace(/-/g, ' '),
      module: 'GRC Engine',
      type: 'Workflow',
      priority: job.status === 'failed' ? 'Action' : 'Watch',
      status: job.status,
      summary: job.source_ref
        ? `${job.job_type.replace(/-/g, ' ')} executed for ${job.source_ref}.`
        : `${job.job_type.replace(/-/g, ' ')} executed for the tenant scope.`,
      route: '/grc-admin',
      occurredAt: job.occurred_at,
      actor: null,
    })),
    ...(grcReportRows.results ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      module: 'GRC Reports',
      type: 'Report',
      priority: 'Info',
      status: item.status,
      summary: `${item.report_kind.replace(/-/g, ' ')} snapshot is ready for reports and compliance exports.`,
      route: '/report-bundles',
      occurredAt: item.updated_at,
      actor: null,
    })),
  ]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 24);

  const timelineMap = new Map<string, { bucket: string; events: number; workflow: number; action: number }>();
  for (const event of events) {
    const bucket = bucketLabel(event.occurredAt);
    const current = timelineMap.get(bucket) ?? { bucket, events: 0, workflow: 0, action: 0 };
    current.events += 1;
    if (event.type === 'Workflow') {
      current.workflow += 1;
    }
    if (event.priority === 'Action') {
      current.action += 1;
    }
    timelineMap.set(bucket, current);
  }

  const moduleCounts = new Map<string, number>();
  for (const event of events) {
    moduleCounts.set(event.module, (moduleCounts.get(event.module) ?? 0) + 1);
  }

  return {
    metrics: {
      totalEvents: events.length,
      actionNeeded: events.filter((event) => event.priority === 'Action').length,
      workflowEvents: events.filter((event) => event.type === 'Workflow').length,
      activeModules: moduleCounts.size,
    },
    events,
    timeline: [...timelineMap.values()].reverse(),
    moduleVolume: [...moduleCounts.entries()]
      .map(([module, count]) => ({ module, count }))
      .sort((a, b) => b.count - a.count),
  };
}

async function buildWorkflowControlSnapshot(env: EnvBindings, tenantId: string) {
  const [leaseSnapshot, assignments, imports, exports, sessions, conmonResult] = await Promise.all([
    getTenantWorkflowSnapshot(env, tenantId),
    listPortalAssignments(env, tenantId),
    listImports(env, tenantId),
    listReportExports(env, tenantId),
    listChatSessions(env, tenantId),
    env.D1_MAIN.prepare(
      `
      SELECT
        execution.id,
        profile.name AS profile_name,
        activity.name AS activity_name,
        execution.status,
        COALESCE(execution.finished_at, execution.started_at) AS updated_at
      FROM conmon_executions AS execution
      INNER JOIN conmon_profiles AS profile
        ON profile.id = execution.profile_id
      INNER JOIN conmon_activity_configs AS activity
        ON activity.id = execution.activity_id
      WHERE execution.tenant_id = ?
      ORDER BY COALESCE(execution.finished_at, execution.started_at) DESC
      LIMIT 8
      `,
    )
      .bind(tenantId)
      .all<{
        id: string;
        profile_name: string;
        activity_name: string;
        status: string;
        updated_at: string;
      }>(),
  ]);

  const coordinatorRuns = leaseSnapshot.workflowRuns.map((run) => ({
    id: run.runId,
    title: run.title,
    module: run.module,
    status: run.status,
    detail: run.detail,
    updatedAt: run.updatedAt,
    route: run.route,
  }));

  const mergedRuns = [
    ...coordinatorRuns,
    ...assignments.slice(0, 8).map((assignment) => ({
      id: assignment.id,
      title: assignment.name,
      module: 'Portal',
      status: normalizeWorkflowStatus(assignment.status),
      detail: `${assignment.progressPercent}% completed for ${assignment.folderName}`,
      updatedAt: assignment.updatedAt,
      route: `/portal/assignments/${assignment.id}`,
    })),
    ...imports.slice(0, 8).map((job) => ({
      id: job.id,
      title: job.name,
      module: 'Imports',
      status: normalizeWorkflowStatus(job.status),
      detail: `${job.importedCount}/${job.rowCount} records imported into ${job.targetKind.replace(/_/g, ' ')}`,
      updatedAt: job.updatedAt,
      route: '/imports',
    })),
    ...exports.slice(0, 8).map((item) => ({
      id: item.id,
      title: item.name,
      module: 'Reports',
      status: normalizeWorkflowStatus(item.status),
      detail: `${item.reportId} export in ${item.format.toUpperCase()} format`,
      updatedAt: item.updatedAt,
      route: '/reports',
    })),
    ...sessions.slice(0, 8).map((session) => ({
      id: session.id,
      title: session.title || 'Workspace chat',
      module: 'Guidance',
      status: normalizeWorkflowStatus(session.status),
      detail: session.lastMessagePreview || `Workflow ${session.workflow} active in ${session.folderName}`,
      updatedAt: session.updatedAt,
      route: '/chat',
    })),
    ...(conmonResult.results ?? []).map((row) => ({
      id: row.id,
      title: `${row.profile_name} · ${row.activity_name}`,
      module: 'ConMon',
      status: normalizeWorkflowStatus(row.status),
      detail: `Continuous monitoring activity is ${row.status.replace(/_/g, ' ')}`,
      updatedAt: row.updated_at,
      route: '/conmon/executions',
    })),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const recentRuns = mergedRuns
    .filter((run, index, source) => source.findIndex((item) => `${item.module}:${item.id}` === `${run.module}:${run.id}`) === index)
    .slice(0, 20);

  const statusCounts = recentRuns.reduce<Record<string, number>>((acc, run) => {
    acc[run.status] = (acc[run.status] ?? 0) + 1;
    return acc;
  }, {});

  const coordinatorModuleCounts = coordinatorRuns.reduce<Record<string, number>>((acc, run) => {
    if (run.status === 'Done') {
      return acc;
    }
    acc[run.module] = (acc[run.module] ?? 0) + 1;
    return acc;
  }, {});

  const templates = [
    {
      id: 'portal-review',
      title: 'Portal Review Workflow',
      module: 'Portal',
      activeCount: assignments.filter((assignment) => assignment.status !== 'completed').length,
      detail: 'Auditee and reviewer coordination across assignment submission and assessment follow-up.',
      route: '/portal',
    },
    {
      id: 'monitoring-cadence',
      title: 'Monitoring Cadence',
      module: 'ConMon',
      activeCount: (conmonResult.results ?? []).filter((row) => row.status !== 'completed').length,
      detail: 'Queue-backed ConMon execution and operational follow-through.',
      route: '/conmon/executions',
    },
    {
      id: 'report-handoffs',
      title: 'Report Handoffs',
      module: 'Reports',
      activeCount: exports.filter((item) => item.status !== 'ready' && item.status !== 'generated').length,
      detail: 'Export generation, review, and distribution state.',
      route: '/reports',
    },
    {
      id: 'guided-workspace',
      title: 'Guided Workspace',
      module: 'Guidance',
      activeCount: sessions.length,
      detail: 'Active workflow-aware guidance sessions and coordination hints.',
      route: '/chat',
    },
    {
      id: 'assurance-orchestration',
      title: 'Assurance Orchestration',
      module: 'Assurance',
      activeCount: coordinatorModuleCounts['Assurance'] ?? 0,
      detail: 'Evidence evaluation, tracker conversion, packaging, and review activity coordinated through the tenant workflow ledger.',
      route: '/assurance/evidence',
    },
    {
      id: 'agent-governance',
      title: 'Agent Governance',
      module: 'Agent',
      activeCount: coordinatorModuleCounts['Agent'] ?? 0,
      detail: 'Bounded agent runs and approval-gated writeback decisions.',
      route: '/assurance/agent-runs',
    },
  ];

  return {
    metrics: {
      activeLeases: leaseSnapshot.activeLeases.length,
      runningFlows: statusCounts['Running'] ?? 0,
      awaitingReview: statusCounts['Awaiting Review'] ?? 0,
      completed: statusCounts['Done'] ?? 0,
    },
    activeLeases: leaseSnapshot.activeLeases,
    templates,
    lanes: [
      {
        id: 'queued',
        label: 'Queued',
        count: statusCounts['Queued'] ?? 0,
        detail: 'Prepared or staged workflow items waiting for execution.',
      },
      {
        id: 'running',
        label: 'Running',
        count: statusCounts['Running'] ?? 0,
        detail: 'In-flight workflow activity across imports, exports, monitoring, and guidance.',
      },
      {
        id: 'review',
        label: 'Awaiting Review',
        count: statusCounts['Awaiting Review'] ?? 0,
        detail: 'Workflow items requiring reviewer or approver attention.',
      },
      {
        id: 'done',
        label: 'Done',
        count: statusCounts['Done'] ?? 0,
        detail: 'Recently completed workflow items.',
      },
    ],
    recentRuns,
  };
}

function toUtilityRunResponse(row: UtilityRunRow) {
  const utility = utilityCatalog.find((item) => item.key === row.utility_key);
  return {
    id: row.id,
    utilityKey: row.utility_key,
    title: utility?.title ?? row.utility_key,
    module: row.module_name,
    scope: row.scope_label,
    records: row.records_hint,
    status: row.status,
    previewMode: row.preview_mode === 1,
    receiptPath: row.receipt_path,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function buildUtilitiesSnapshot(env: EnvBindings, tenantId: string) {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      id,
      tenant_id,
      utility_key,
      module_name,
      scope_label,
      records_hint,
      status,
      notes,
      preview_mode,
      receipt_path,
      created_by_user_id,
      created_at,
      updated_at
    FROM ops_utility_runs
    WHERE tenant_id = ?
    ORDER BY updated_at DESC
    LIMIT 24
    `,
  )
    .bind(tenantId)
    .all<UtilityRunRow>();

  const recentRuns = results.map(toUtilityRunResponse);
  const runCounts = recentRuns.reduce<Record<string, number>>((acc, run) => {
    acc[run.utilityKey] = (acc[run.utilityKey] ?? 0) + 1;
    return acc;
  }, {});

  return {
    metrics: {
      totalUtilities: utilityCatalog.length,
      recentRuns: recentRuns.length,
      previewReady: utilityCatalog.filter((item) => item.dryRunSupport).length,
      queuedRuns: recentRuns.filter((run) => run.status === 'Queued').length,
    },
    utilities: utilityCatalog.map((item) => ({
      ...item,
      runCount: runCounts[item.key] ?? 0,
      lastRun: recentRuns.find((run) => run.utilityKey === item.key)?.updatedAt ?? null,
    })),
    recentRuns,
  };
}

function toSubsystemResponse(
  entry: SubsystemCatalogEntry,
  preference: SubsystemPreferenceRow | null,
) {
  return {
    ...entry,
    pinned: preference?.pinned === 1,
    openCount: preference?.open_count ?? 0,
    lastOpenedAt: preference?.last_opened_at ?? null,
    activityNote: preference?.activity_note ?? null,
  };
}

async function buildSubsystemsSnapshot(env: EnvBindings, tenantId: string) {
  const [preferencesResult, sessionRow] = await Promise.all([
    env.D1_MAIN.prepare(
      `
      SELECT
        id,
        tenant_id,
        subsystem_key,
        pinned,
        open_count,
        last_opened_at,
        activity_note,
        updated_by_user_id,
        created_at,
        updated_at
      FROM ops_subsystem_preferences
      WHERE tenant_id = ?
      ORDER BY updated_at DESC
      `,
    )
      .bind(tenantId)
      .all<SubsystemPreferenceRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT
        tenant_id,
        active_subsystem_key,
        active_record_type,
        updated_by_user_id,
        updated_at
      FROM ops_subsystem_sessions
      WHERE tenant_id = ?
      LIMIT 1
      `,
    )
      .bind(tenantId)
      .first<SubsystemSessionRow>(),
  ]);

  const preferenceMap = new Map(
    preferencesResult.results.map((row) => [row.subsystem_key, row] as const),
  );
  const subsystems = subsystemCatalog.map((entry) =>
    toSubsystemResponse(entry, preferenceMap.get(entry.key) ?? null),
  );
  const activeSubsystem =
    subsystems.find((entry) => entry.key === sessionRow?.active_subsystem_key) ?? subsystems[0];

  return {
    metrics: {
      totalSubsystems: subsystemCatalog.length,
      pinned: subsystems.filter((entry) => entry.pinned).length,
      activeRecordTypes: 4,
      openedSessions: subsystems.reduce((sum, entry) => sum + entry.openCount, 0),
    },
    activeSelection: {
      subsystemKey: activeSubsystem?.key ?? null,
      recordType: sessionRow?.active_record_type ?? 'Security Plan',
      updatedAt: sessionRow?.updated_at ?? null,
    },
    subsystems,
  };
}

function toRMFPackageResponse(row: RMFPackageRow) {
  return {
    id: row.id,
    name: row.name,
    systemCategory: row.system_category,
    authorizationBoundary: row.authorization_boundary,
    currentState: row.current_state,
    authorizationStatus: row.authorization_status,
    progress: row.progress_percent,
    blockers: parseJsonArray<string>(row.blockers_json),
    nextHandoff: row.next_handoff,
    decisionTarget: row.decision_target,
    steps: parseJsonArray<RMFStepRow>(row.steps_json),
    artifacts: parseJsonArray<RMFArtifactRow>(row.artifacts_json),
    timeline: parseJsonArray<RMFTimelinePoint>(row.timeline_json),
    updatedAt: row.updated_at,
    route: '/rmf',
  };
}

async function buildRMFSnapshot(env: EnvBindings, tenantId: string) {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      id,
      tenant_id,
      name,
      system_category,
      authorization_boundary,
      current_state,
      authorization_status,
      progress_percent,
      blockers_json,
      next_handoff,
      decision_target,
      steps_json,
      artifacts_json,
      timeline_json,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    FROM ops_rmf_packages
    WHERE tenant_id = ?
    ORDER BY updated_at DESC
    `,
  )
    .bind(tenantId)
    .all<RMFPackageRow>();

  const packages = results.map(toRMFPackageResponse);

  return {
    metrics: {
      packages: packages.length,
      inFlightSteps: packages.reduce(
        (sum, item) => sum + item.steps.filter((step) => step.status === 'In Progress').length,
        0,
      ),
      blockedItems: packages.reduce(
        (sum, item) =>
          sum +
          item.blockers.length +
          item.steps.filter((step) => step.status === 'Blocked').length,
        0,
      ),
      authorizeReady: packages.filter((item) => item.authorizationStatus === 'Ready for AO').length,
    },
    packages,
  };
}

function toAppManagementResponse(row: AppManagementAppRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    administrators: parseJsonArray<string>(row.administrators_json),
    defaultPublic: row.default_public === 1,
    inheritParentAccess: row.inherit_parent_access === 1,
    defaultUsers: parseJsonArray<string>(row.default_users_json),
    defaultGroups: parseJsonArray<string>(row.default_groups_json),
    groups: parseJsonArray<AppManagementGroup>(row.groups_json),
    users: parseJsonArray<AppManagementUser>(row.users_json),
    serviceAccounts: parseJsonArray<AppManagementServiceAccount>(row.service_accounts_json),
    automationOwner: row.automation_owner,
    automationQueue: row.automation_queue,
    automationHealth: row.automation_health,
    notes: row.notes ?? '',
    updatedAt: row.updated_at,
  };
}

async function listAppManagementApps(env: EnvBindings, tenantId: string) {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      id,
      tenant_id,
      name,
      description,
      administrators_json,
      default_public,
      inherit_parent_access,
      default_users_json,
      default_groups_json,
      groups_json,
      users_json,
      service_accounts_json,
      automation_owner,
      automation_queue,
      automation_health,
      notes,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    FROM ops_app_management_apps
    WHERE tenant_id = ?
    ORDER BY updated_at DESC
    `,
  )
    .bind(tenantId)
    .all<AppManagementAppRow>();

  return results.map(toAppManagementResponse);
}

async function getAppManagementApp(env: EnvBindings, tenantId: string, appId: string) {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT
      id,
      tenant_id,
      name,
      description,
      administrators_json,
      default_public,
      inherit_parent_access,
      default_users_json,
      default_groups_json,
      groups_json,
      users_json,
      service_accounts_json,
      automation_owner,
      automation_queue,
      automation_health,
      notes,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    FROM ops_app_management_apps
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, appId)
    .first<AppManagementAppRow>();

  return row ? toAppManagementResponse(row) : null;
}

async function buildAppManagementSnapshot(env: EnvBindings, tenantId: string) {
  const apps = await listAppManagementApps(env, tenantId);
  return {
    metrics: {
      apps: apps.length,
      groups: apps.reduce((sum, app) => sum + app.groups.length, 0),
      users: apps.reduce((sum, app) => sum + app.users.length, 0),
      serviceAccounts: apps.reduce((sum, app) => sum + app.serviceAccounts.length, 0),
    },
    apps,
  };
}

async function listEbiosStudies(env: EnvBindings, tenantId: string) {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      study.id,
      study.tenant_id,
      study.folder_id,
      folder_item.name AS folder_name,
      study.perimeter_id,
      perimeter_item.name AS perimeter_name,
      study.reference_entity_id,
      entity.name AS reference_entity_name,
      study.ref_id,
      study.name,
      study.description,
      study.version,
      study.status,
      study.quotation_method,
      study.risk_matrix_name,
      study.observation,
      study.workshop_status_json,
      study.feared_events_json,
      study.stakeholders_json,
      study.strategic_scenarios_json,
      study.operational_scenarios_json,
      study.created_at,
      study.updated_at
    FROM ebios_studies AS study
    INNER JOIN folders AS folder_item
      ON folder_item.id = study.folder_id
    LEFT JOIN perimeters AS perimeter_item
      ON perimeter_item.id = study.perimeter_id
    LEFT JOIN entities AS entity
      ON entity.id = study.reference_entity_id
    WHERE study.tenant_id = ?
    ORDER BY study.updated_at DESC
    `,
  )
    .bind(tenantId)
    .all<EbiosStudyRow>();

  return results.map(toEbiosStudyResponse);
}

async function getEbiosStudy(env: EnvBindings, tenantId: string, studyId: string) {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT
      study.id,
      study.tenant_id,
      study.folder_id,
      folder_item.name AS folder_name,
      study.perimeter_id,
      perimeter_item.name AS perimeter_name,
      study.reference_entity_id,
      entity.name AS reference_entity_name,
      study.ref_id,
      study.name,
      study.description,
      study.version,
      study.status,
      study.quotation_method,
      study.risk_matrix_name,
      study.observation,
      study.workshop_status_json,
      study.feared_events_json,
      study.stakeholders_json,
      study.strategic_scenarios_json,
      study.operational_scenarios_json,
      study.created_at,
      study.updated_at
    FROM ebios_studies AS study
    INNER JOIN folders AS folder_item
      ON folder_item.id = study.folder_id
    LEFT JOIN perimeters AS perimeter_item
      ON perimeter_item.id = study.perimeter_id
    LEFT JOIN entities AS entity
      ON entity.id = study.reference_entity_id
    WHERE study.tenant_id = ? AND study.id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, studyId)
    .first<EbiosStudyRow>();

  return row ? toEbiosStudyResponse(row) : null;
}

async function listQuantitativeStudies(env: EnvBindings, tenantId: string) {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      study.id,
      study.tenant_id,
      study.folder_id,
      folder_item.name AS folder_name,
      study.risk_register_id,
      register_item.name AS risk_register_name,
      study.ref_id,
      study.name,
      study.description,
      study.version,
      study.status,
      study.distribution_model,
      study.currency,
      study.loss_threshold,
      study.observation,
      study.risk_tolerance_json,
      study.portfolio_json,
      study.scenarios_json,
      study.action_plan_json,
      study.created_at,
      study.updated_at
    FROM quantitative_studies AS study
    INNER JOIN folders AS folder_item
      ON folder_item.id = study.folder_id
    LEFT JOIN risk_registers AS register_item
      ON register_item.id = study.risk_register_id
    WHERE study.tenant_id = ?
    ORDER BY study.updated_at DESC
    `,
  )
    .bind(tenantId)
    .all<QuantitativeStudyRow>();

  return results.map(toQuantitativeStudyResponse);
}

async function getQuantitativeStudy(env: EnvBindings, tenantId: string, studyId: string) {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT
      study.id,
      study.tenant_id,
      study.folder_id,
      folder_item.name AS folder_name,
      study.risk_register_id,
      register_item.name AS risk_register_name,
      study.ref_id,
      study.name,
      study.description,
      study.version,
      study.status,
      study.distribution_model,
      study.currency,
      study.loss_threshold,
      study.observation,
      study.risk_tolerance_json,
      study.portfolio_json,
      study.scenarios_json,
      study.action_plan_json,
      study.created_at,
      study.updated_at
    FROM quantitative_studies AS study
    INNER JOIN folders AS folder_item
      ON folder_item.id = study.folder_id
    LEFT JOIN risk_registers AS register_item
      ON register_item.id = study.risk_register_id
    WHERE study.tenant_id = ? AND study.id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, studyId)
    .first<QuantitativeStudyRow>();

  return row ? toQuantitativeStudyResponse(row) : null;
}

async function getQuantitativeScenarioDetail(
  env: EnvBindings,
  tenantId: string,
  scenarioId: string,
) {
  const studies = await listQuantitativeStudies(env, tenantId);
  for (const study of studies) {
    const scenario = study.scenarios.find((item) => item.id === scenarioId);
    if (scenario) {
      return { study, scenario };
    }
  }

  return null;
}

async function getQuantitativeHypothesisDetail(
  env: EnvBindings,
  tenantId: string,
  hypothesisId: string,
) {
  const studies = await listQuantitativeStudies(env, tenantId);
  for (const study of studies) {
    for (const scenario of study.scenarios) {
      const hypothesis = scenario.hypotheses.find((item) => item.id === hypothesisId);
      if (hypothesis) {
        return { study, scenario, hypothesis };
      }
    }
  }

  return null;
}

async function buildParityOverview(ctx: WorkerRequestContext, access: OpsSurfaceAccessProfile) {
  const tenantId = ctx.tenantId as string;
  const moduleRecordScope = await loadScopedPermissionContext(ctx, MODULE_RECORD_OPS_SCOPE_PERMISSIONS);
  const moduleRecordAccessibleDomainIds =
    moduleRecordScope instanceof Response ? [] : moduleRecordScope.accessibleDomainIds;
  const [moduleRecordRows, datedModuleRecordRows, assessmentRows, datedAssessmentRows] = await Promise.all([
    listRecentModuleRecordOpsRows(ctx.env, tenantId, moduleRecordAccessibleDomainIds),
    listDatedModuleRecordOpsRows(ctx.env, tenantId, moduleRecordAccessibleDomainIds),
    listRecentAssessmentOpsRows(ctx.env, tenantId),
    listDatedAssessmentOpsRows(ctx.env, tenantId),
  ]);
  const moduleRecordItems = moduleRecordRows
    .map(toModuleRecordOpsItem)
    .filter((item): item is ModuleRecordOpsItem => Boolean(item));
  const datedModuleRecordItems = datedModuleRecordRows
    .map(toModuleRecordOpsItem)
    .filter((item): item is ModuleRecordOpsItem => Boolean(item));
  const assessmentItems = assessmentRows.map(toAssessmentOpsItem);
  const datedAssessmentItems = datedAssessmentRows.map(toAssessmentOpsItem);

  const assetRows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id, name, asset_assessments_json
    FROM business_impact_analyses
    WHERE tenant_id = ?
    ORDER BY updated_at DESC
    `,
  )
    .bind(tenantId)
    .all<{ id: string; name: string; asset_assessments_json: string }>();

  const assets = [
    ...moduleRecordItems
      .filter((item) => item.moduleKey === 'assets')
      .map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        status: item.status,
        detail: item.detail,
        route: item.route,
      })),
    ...assetRows.results.flatMap((analysis) =>
      parseJsonArray<BiaAssetAssessment>(analysis.asset_assessments_json).map((asset) => ({
        id: `${analysis.id}-${asset.id}`,
        title: asset.assetName,
        subtitle: analysis.name,
        status: asset.recoveryTargetsMet ? 'targets_met' : 'needs_review',
        detail: `${asset.dependencies.length} dependencies · ${asset.associatedControls.length} controls`,
        route: `/resilience/business-impact-analyses/${analysis.id}`,
      })),
    ),
  ];

  const actorUsers = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id, display_name, email
    FROM users
    WHERE tenant_id = ?
    ORDER BY display_name ASC
    LIMIT 20
    `,
  )
    .bind(tenantId)
    .all<{ id: string; display_name: string; email: string }>();
  const actorAssignments = await listPortalAssignments(ctx.env, tenantId);
  const actors = [
    ...actorUsers.results.map((user) => ({
      id: user.id,
      title: user.display_name,
      subtitle: user.email,
      status: 'internal',
      detail: 'Workspace principal',
      route: '/workspace/team',
    })),
    ...actorAssignments.map((assignment) => ({
      id: assignment.id,
      title: assignment.actorName ?? assignment.entityName ?? assignment.name,
      subtitle: assignment.actorEmail ?? assignment.folderName,
      status: assignment.status,
      detail: assignment.frameworkName ?? 'Auditee assignment',
      route: `/portal/assignments/${assignment.id}`,
    })),
  ];

  const vulnerabilityRows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id, title, status, inherent_score, residual_score
    FROM risk_scenarios
    WHERE tenant_id = ?
    ORDER BY updated_at DESC
    LIMIT 20
    `,
  )
    .bind(tenantId)
    .all<{ id: string; title: string; status: string; inherent_score: number | null; residual_score: number | null }>();
  const vulnerabilities = vulnerabilityRows.results.map((row) => ({
    id: row.id,
    title: row.title,
    subtitle: row.status,
    status:
      (row.inherent_score ?? 0) >= 12 ? 'high' : (row.inherent_score ?? 0) >= 8 ? 'medium' : 'low',
    detail: `Inherent ${(row.inherent_score ?? 0).toFixed(1)} · Residual ${(row.residual_score ?? 0).toFixed(1)}`,
    route: '/risk-scenarios',
  }));

  const frameworkRows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT framework.id, framework.name, framework.key, COUNT(control.id) AS control_count
    FROM frameworks AS framework
    LEFT JOIN controls AS control
      ON control.framework_id = framework.id
    WHERE framework.tenant_id = ?
    GROUP BY framework.id
    ORDER BY framework.updated_at DESC
    LIMIT 12
    `,
  )
    .bind(tenantId)
    .all<{ id: string; name: string; key: string; control_count: number }>();
  const policies = [
    ...moduleRecordItems
      .filter((item) => item.moduleKey === 'policies')
      .map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        status: item.status,
        detail: item.detail,
        route: item.route,
      })),
    ...frameworkRows.results.map((row) => ({
      id: row.id,
      title: row.name,
      subtitle: row.key,
      status: row.control_count > 0 ? 'active' : 'draft',
      detail: `${row.control_count} mapped controls`,
      route: `/frameworks/${row.id}`,
    })),
  ];

  const breachRows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id, name, status, risk_level, discovered_on
    FROM data_breaches
    WHERE tenant_id = ?
    ORDER BY discovered_on DESC
    LIMIT 12
    `,
  )
    .bind(tenantId)
    .all<{ id: string; name: string; status: string; risk_level: string; discovered_on: string }>();
  const incidents = [
    ...moduleRecordItems
      .filter((item) => item.moduleKey === 'incidents')
      .map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        status: item.status,
        detail: item.detail,
        route: item.route,
      })),
    ...breachRows.results.map((row) => ({
      id: row.id,
      title: row.name,
      subtitle: row.risk_level,
      status: row.status,
      detail: `Opened ${row.discovered_on}`,
      route: '/privacy',
    })),
  ];

  const exceptionRows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT
      requirement.id,
      control.ref AS control_ref,
      control.title AS control_title,
      requirement.result,
      assessment.id AS assessment_id,
      assessment.name AS assessment_name
    FROM compliance_requirement_assessments AS requirement
    INNER JOIN controls AS control
      ON control.id = requirement.control_id
    INNER JOIN compliance_assessments AS assessment
      ON assessment.id = requirement.compliance_assessment_id
    WHERE requirement.tenant_id = ? AND requirement.result IN ('non_compliant', 'partially_compliant')
    ORDER BY requirement.updated_at DESC
    LIMIT 20
    `,
  )
    .bind(tenantId)
    .all<{
      id: string;
      control_ref: string;
      control_title: string;
      result: string;
      assessment_id: string;
      assessment_name: string;
    }>();
  const exceptions = [
    ...moduleRecordItems
      .filter((item) => item.moduleKey === 'exceptions')
      .map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        status: item.status,
        detail: item.detail,
        route: item.route,
      })),
    ...exceptionRows.results.map((row) => ({
      id: row.id,
      title: `${row.control_ref} ${row.control_title}`,
      subtitle: row.assessment_name,
      status: row.result,
      detail: 'Tracked as an exception candidate from compliance review.',
      route: `/compliance-assessments/${row.assessment_id}`,
    })),
  ];

  const counts = await Promise.all([
    getTenantCount(ctx.env, 'frameworks', tenantId),
    getTenantCount(ctx.env, 'risk_scenarios', tenantId),
    getTenantCount(ctx.env, 'entities', tenantId),
    getTenantCount(ctx.env, 'processings', tenantId),
    getTenantCount(ctx.env, 'portal_assignments', tenantId),
    getTenantCount(ctx.env, 'ebios_studies', tenantId),
    getTenantCount(ctx.env, 'quantitative_studies', tenantId),
  ]);
  const analytics = [
    { id: 'frameworks', label: 'Frameworks', value: counts[0], detail: 'Policy and control sources' },
    { id: 'scenarios', label: 'Risk scenarios', value: counts[1], detail: 'Active risk modeling items' },
    { id: 'entities', label: 'Third parties', value: counts[2], detail: 'Supplier and service inventory' },
    { id: 'processings', label: 'Processings', value: counts[3], detail: 'Privacy registry' },
    { id: 'portal', label: 'Portal assignments', value: counts[4], detail: 'Auditee response workflows' },
    { id: 'ebios', label: 'EBIOS studies', value: counts[5], detail: 'Advanced attack-path studies' },
    { id: 'quant', label: 'Quant studies', value: counts[6], detail: 'Economic loss models' },
  ];

  const moduleCalendar = datedModuleRecordItems.flatMap((item) =>
    [
      { label: 'Start', value: item.startOn },
      { label: 'Finish', value: item.finishOn },
      { label: 'Due', value: item.dueOn },
      { label: 'Review', value: item.reviewOn },
      { label: 'Expires', value: item.expiresOn },
    ]
      .filter((entry) => Boolean(entry.value))
      .map((entry) => ({
        id: `${item.id}-${entry.label.toLowerCase()}`,
        title: item.title,
        date: entry.value as string,
        detail: `${item.moduleLabel} ${entry.label.toLowerCase()} milestone`,
        route: item.route,
      })),
  );

  const assessmentCalendar = datedAssessmentItems.flatMap((item) =>
    [
      { label: 'Start', value: item.plannedStartOn },
      { label: 'Finish', value: item.plannedFinishOn },
    ]
      .filter((entry) => Boolean(entry.value))
      .map((entry) => ({
        id: `${item.id}-assessment-${entry.label.toLowerCase()}`,
        title: item.title,
        date: entry.value as string,
        detail: `${item.subtitle} ${entry.label.toLowerCase()} window`,
        route: item.route,
      })),
  );

  const calendar = [
    ...moduleCalendar,
    ...assessmentCalendar,
    ...actorAssignments
      .filter((assignment) => assignment.dueDate)
      .map((assignment) => ({
        id: assignment.id,
        title: assignment.name,
        date: assignment.dueDate as string,
        detail: `Portal due date · ${assignment.folderName}`,
        route: `/portal/assignments/${assignment.id}`,
      })),
    ...(await ctx.env.D1_MAIN.prepare(
      `
      SELECT id, name, due_date
      FROM right_requests
      WHERE tenant_id = ? AND due_date IS NOT NULL
      ORDER BY due_date ASC
      LIMIT 20
      `,
    )
      .bind(tenantId)
      .all<{ id: string; name: string; due_date: string }>())
      .results.map((row) => ({
        id: row.id,
        title: row.name,
        date: row.due_date,
        detail: 'Privacy rights request deadline',
        route: '/privacy',
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const exports = await listReportExports(ctx.env, tenantId);
  const imports = await listImports(ctx.env, tenantId);
  const backupRestore = {
    exportsCount: exports.length,
    importsCount: imports.length,
    latestExport: exports[0]?.name ?? null,
    latestImport: imports[0]?.name ?? null,
  };

  const quickStart = [
    {
      id: 'workspace',
      title: 'Set up workspace administration',
      completed: counts[0] > 0,
      detail: 'Domains, users, and scoped access are present.',
      route: '/workspace/access',
    },
    {
      id: 'risk',
      title: 'Seed governance and risk',
      completed: counts[1] > 0,
      detail: 'Risk and compliance records are available for review.',
      route: '/assessments',
    },
    {
      id: 'third-party',
      title: 'Activate external collaboration',
      completed: counts[4] > 0,
      detail: 'Portal assignments and vendor reviews are in flight.',
      route: '/portal',
    },
    {
      id: 'advanced-risk',
      title: 'Run advanced studies',
      completed: counts[5] > 0 && counts[6] > 0,
      detail: 'EBIOS RM and quantitative studies are available.',
      route: '/advanced-risk/ebios',
    },
  ];

  const moduleDirectorySearchIndex = MODULE_CATALOG.map((entry) => ({
    id: `module-${entry.moduleKey}`,
    title: entry.pluralName,
    subtitle: entry.coverageBadge,
    section: 'Modules',
    route: entry.implementationType === 'shared-workspace' ? entry.directRoute || entry.canonicalRoute : entry.canonicalRoute,
    keywords: [entry.implementationType, ...entry.relatedModules],
  }));

  const moduleRecordSearchIndex = moduleRecordItems.map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    section: item.moduleLabel,
    route: item.route,
    keywords: item.keywords,
  }));

  const assessmentSearchIndex = assessmentItems.map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    section: 'Assessments',
    route: item.route,
    keywords: item.keywords,
  }));

  const searchIndex = [
    ...moduleDirectorySearchIndex,
    ...moduleRecordSearchIndex,
    ...assessmentSearchIndex,
    ...policies
      .filter((item) => item.route.startsWith('/frameworks'))
      .map((item) => ({ ...item, section: 'Policies', keywords: ['policy', item.subtitle] })),
    ...assets
      .filter((item) => item.route.startsWith('/resilience/'))
      .map((item) => ({ ...item, section: 'Assets', keywords: ['asset', item.subtitle] })),
    ...actors.map((item) => ({ ...item, section: 'Actors', keywords: ['actor', item.subtitle] })),
    ...vulnerabilities.map((item) => ({ ...item, section: 'Vulnerabilities', keywords: ['risk', item.subtitle] })),
    ...incidents
      .filter((item) => item.route.startsWith('/privacy'))
      .map((item) => ({ ...item, section: 'Incidents', keywords: ['incident', item.subtitle] })),
    ...(await listEbiosStudies(ctx.env, tenantId)).map((study) => ({
      id: study.id,
      title: study.name,
      subtitle: study.refId ?? 'EBIOS RM study',
      section: 'Advanced Risk',
      route: `/advanced-risk/ebios/${study.id}`,
      keywords: ['ebios', study.status],
    })),
    ...(await listQuantitativeStudies(ctx.env, tenantId)).map((study) => ({
      id: study.id,
      title: study.name,
      subtitle: study.refId ?? 'Quantitative study',
      section: 'Advanced Risk',
      route: `/advanced-risk/quantitative/${study.id}`,
      keywords: ['quantitative', study.status],
    })),
  ];

  const libraries = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id, name, provider, version
    FROM libraries
    WHERE tenant_id = ?
    ORDER BY updated_at DESC
    LIMIT 12
    `,
  )
    .bind(tenantId)
    .all<{ id: string; name: string; provider: string | null; version: string | null }>();
  const libraryOperations = libraries.results.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: row.provider ?? 'Library pack',
    status: row.version ?? 'current',
    detail: 'Loaded, stored, and mapping-library semantics are consolidated here.',
    route: `/libraries/${row.id}`,
  }));

  const taskRows = await ctx.env.D1_MAIN.prepare(
    `
    SELECT id, name, status, owner_name, eta
    FROM applied_controls
    WHERE tenant_id = ?
    ORDER BY updated_at DESC
    LIMIT 20
    `,
  )
    .bind(tenantId)
    .all<{ id: string; name: string; status: string; owner_name: string | null; eta: string | null }>();
  const tasks = [
    ...moduleRecordItems
      .filter((item) => item.moduleKey === 'tasks')
      .map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        status: item.status,
        detail: item.detail,
        route: item.route,
      })),
    ...taskRows.results.map((row) => ({
      id: row.id,
      title: row.name,
      subtitle: row.owner_name ?? 'Unassigned',
      status: row.status,
      detail: row.eta ? `ETA ${row.eta}` : 'No ETA set',
      route: '/applied-controls/kanban-mode',
    })),
  ];

  const dashboards = analytics.map((item) => ({
    id: item.id,
    title: item.label,
    subtitle: String(item.value),
    status: 'visible',
    detail: item.detail,
    route: '/',
  }));

  const validationFlows = [
    ...exports.slice(0, 6).map((item) => ({
      id: item.id,
      title: item.name,
      subtitle: item.reportId,
      status: item.status,
      detail: 'Report validation and export flow',
      route: '/reports/dora-roi',
    })),
    ...exceptions.slice(0, 6).map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      status: item.status,
      detail: 'Compliance validation candidate',
      route: item.route,
    })),
  ];

  const xRays = [
    { id: 'runtime', title: 'Runtime', subtitle: ctx.env.APP_ENV, status: 'healthy', detail: 'Worker runtime environment', route: '/' },
    { id: 'tenant', title: 'Tenant', subtitle: ctx.tenantId, status: 'active', detail: 'Authenticated tenant context', route: '/workspace/me' },
    { id: 'auth', title: 'Auth strategy', subtitle: ctx.authStrategy, status: 'active', detail: 'Resolved auth strategy', route: '/workspace/me' },
  ];

  const program = [
    {
      id: 'accreditations',
      title: 'Accreditations and presets',
      subtitle: 'Program metadata',
      status: 'mapped',
      detail: 'Legacy preset, accreditation, and collection routes map into governance workspaces.',
      route: '/frameworks',
    },
    {
      id: 'settings',
      title: 'Settings and licensing',
      subtitle: 'Workspace controls',
      status: 'mapped',
      detail: 'Operational settings, license views, and profile routes map into the parity workbench and workspace pages.',
      route: '/settings',
    },
  ];

  const visibleAssets = filterRouteItems(assets, access);
  const visibleActors = filterRouteItems(actors, access);
  const visiblePolicies = filterRouteItems(policies, access);
  const visibleVulnerabilities = filterRouteItems(vulnerabilities, access);
  const visibleIncidents = filterRouteItems(incidents, access);
  const visibleExceptions = filterRouteItems(exceptions, access);
  const visibleCalendar = filterRouteItems(calendar, access);
  const visibleTasks = filterRouteItems(tasks, access);
  const visibleQuickStart = access.canViewAdminNavigation ? filterRouteItems(quickStart, access) : [];
  const visibleSearchIndex = filterRouteItems(searchIndex, access);
  const visibleValidationFlows = filterRouteItems(validationFlows, access);
  const visibleProgram = filterRouteItems(program, access);
  const visibleXRays = access.canViewInternalTools ? filterRouteItems(xRays, access) : [];
  const visibleBackupRestore = access.canViewAdminNavigation
    ? backupRestore
    : {
        exportsCount: backupRestore.exportsCount,
        importsCount: 0,
        latestExport: backupRestore.latestExport,
        latestImport: null,
      };

  return {
    tenantId,
    assets: visibleAssets,
    actors: visibleActors,
    vulnerabilities: visibleVulnerabilities,
    policies: visiblePolicies,
    incidents: visibleIncidents,
    exceptions: visibleExceptions,
    analytics,
    calendar: visibleCalendar,
    backupRestore: visibleBackupRestore,
    quickStart: visibleQuickStart,
    searchIndex: visibleSearchIndex,
    settings: {
      tenantId,
      userId: access.canViewAdminNavigation ? ctx.userId : null,
      authStrategy: access.canViewAdminNavigation ? ctx.authStrategy : 'session',
      appEnv: access.canViewInternalTools ? ctx.env.APP_ENV : 'workspace',
    },
    libraryOperations,
    tasks: visibleTasks,
    dashboards,
    validationFlows: visibleValidationFlows,
    xRays: visibleXRays,
    program: visibleProgram,
  };
}

function toCsv(content: Record<string, unknown>) {
  const rows = Array.isArray(content.rows) ? (content.rows as string[][]) : [];
  return rows.map((row) => row.map((cell) => JSON.stringify(cell ?? '')).join(',')).join('\n');
}

export async function handleOpsRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const [resource, id, subresource, nestedId, extraId] = segments;
  const isReadMethod = ctx.request.method === 'GET';

  if (!ctx.tenantId) {
    return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
  }

  if (resource === 'workflow') {
    const workflowPermission = await requireAnyPermission(
      ctx,
      isReadMethod ? OPERATIONS_READ_PERMISSIONS : OPERATIONS_WRITE_PERMISSIONS,
      isReadMethod
        ? 'Workflow access requires operational-view permissions.'
        : 'Workflow changes require operational workspace permissions.',
    );
    if (workflowPermission instanceof Response) {
      return workflowPermission;
    }

    if (!id && ctx.request.method === 'GET') {
      return json({ data: await buildWorkflowControlSnapshot(ctx.env, ctx.tenantId) });
    }

    if (id === 'leases' && !subresource && ctx.request.method === 'POST') {
      if (!ctx.userId) {
        return json({ error: 'missing_user', message: 'x-user-id is required' }, { status: 401 });
      }

      const body = (await ctx.request.json()) as {
        leaseKey?: string;
        metadata?: Record<string, unknown>;
      };
      const leaseKey = body.leaseKey?.trim() || `workflow-${Date.now()}`;
      const result = await acquireTenantLease(ctx.env, ctx.tenantId, leaseKey, {
        ...(body.metadata ?? {}),
        source: 'workflow-control-room',
        userId: ctx.userId,
      });

      return json({
        data: {
          lease: result.lease,
          acquired: result.acquired,
          snapshot: await buildWorkflowControlSnapshot(ctx.env, ctx.tenantId),
        },
      });
    }

    if (id === 'leases' && subresource && nestedId === 'release' && ctx.request.method === 'POST') {
      if (!ctx.userId) {
        return json({ error: 'missing_user', message: 'x-user-id is required' }, { status: 401 });
      }

      await releaseTenantLease(ctx.env, ctx.tenantId, decodeURIComponent(subresource));
      return json({
        data: {
          released: true,
          leaseKey: decodeURIComponent(subresource),
          snapshot: await buildWorkflowControlSnapshot(ctx.env, ctx.tenantId),
        },
      });
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'utilities') {
    const utilityPermission = await requireAnyPermission(
      ctx,
      isReadMethod ? OPERATIONS_READ_PERMISSIONS : OPERATIONS_WRITE_PERMISSIONS,
      isReadMethod
        ? 'Utilities access requires operational-view permissions.'
        : 'Utility launches require operational workspace permissions.',
    );
    if (utilityPermission instanceof Response) {
      return utilityPermission;
    }

    if (!id && ctx.request.method === 'GET') {
      return json({ data: await buildUtilitiesSnapshot(ctx.env, ctx.tenantId) });
    }

    if (id === 'launch' && ctx.request.method === 'POST') {
      if (!ctx.userId) {
        return json({ error: 'missing_user', message: 'x-user-id is required' }, { status: 401 });
      }

      const body = (await ctx.request.json()) as LaunchUtilityInput;
      const utility = utilityCatalog.find((item) => item.key === body.utilityKey?.trim());
      if (!utility) {
        return json(
          { error: 'utility_not_found', message: 'Select a valid utility before launching a run.' },
          { status: 404 },
        );
      }

      const runId = crypto.randomUUID();
      const previewMode = body.previewMode === true;
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO ops_utility_runs (
          id,
          tenant_id,
          utility_key,
          module_name,
          scope_label,
          records_hint,
          status,
          notes,
          preview_mode,
          receipt_path,
          created_by_user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          runId,
          ctx.tenantId,
          utility.key,
          body.module?.trim() || utility.module,
          body.scope?.trim() || 'Tenant scope',
          Math.max(1, Number(body.recordsHint ?? 1)),
          previewMode ? 'Preview only' : 'Queued',
          body.notes?.trim() || utility.notes,
          previewMode ? 1 : 0,
          utility.receiptPath,
          ctx.userId,
        )
        .run();

      return json({
        data: {
          run: toUtilityRunResponse(
            (
              await ctx.env.D1_MAIN.prepare(
                `
                SELECT
                  id,
                  tenant_id,
                  utility_key,
                  module_name,
                  scope_label,
                  records_hint,
                  status,
                  notes,
                  preview_mode,
                  receipt_path,
                  created_by_user_id,
                  created_at,
                  updated_at
                FROM ops_utility_runs
                WHERE tenant_id = ? AND id = ?
                LIMIT 1
                `,
              )
                .bind(ctx.tenantId, runId)
                .first<UtilityRunRow>()
            ) as UtilityRunRow,
          ),
          snapshot: await buildUtilitiesSnapshot(ctx.env, ctx.tenantId),
        },
      });
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'subsystems') {
    const subsystemPermission = await requireAnyPermission(
      ctx,
      OPERATIONS_READ_PERMISSIONS,
      'Subsystem access requires operational-view permissions.',
    );
    if (subsystemPermission instanceof Response) {
      return subsystemPermission;
    }

    if (!id && ctx.request.method === 'GET') {
      return json({ data: await buildSubsystemsSnapshot(ctx.env, ctx.tenantId) });
    }

    if (id === 'select' && ctx.request.method === 'POST') {
      if (!ctx.userId) {
        return json({ error: 'missing_user', message: 'x-user-id is required' }, { status: 401 });
      }

      const body = (await ctx.request.json()) as SelectSubsystemInput;
      const subsystem = subsystemCatalog.find((item) => item.key === body.subsystemKey?.trim());
      if (!subsystem) {
        return json(
          { error: 'subsystem_not_found', message: 'Select a valid subsystem panel.' },
          { status: 404 },
        );
      }

      const recordType = body.recordType?.trim() || 'Security Plan';
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO ops_subsystem_sessions (
          tenant_id,
          active_subsystem_key,
          active_record_type,
          updated_by_user_id,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id) DO UPDATE SET
          active_subsystem_key = excluded.active_subsystem_key,
          active_record_type = excluded.active_record_type,
          updated_by_user_id = excluded.updated_by_user_id,
          updated_at = excluded.updated_at
        `,
      )
        .bind(ctx.tenantId, subsystem.key, recordType, ctx.userId, nowIso())
        .run();

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO ops_subsystem_preferences (
          id,
          tenant_id,
          subsystem_key,
          pinned,
          open_count,
          last_opened_at,
          activity_note,
          updated_by_user_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, 0, 1, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id, subsystem_key) DO UPDATE SET
          open_count = ops_subsystem_preferences.open_count + 1,
          last_opened_at = excluded.last_opened_at,
          activity_note = excluded.activity_note,
          updated_by_user_id = excluded.updated_by_user_id,
          updated_at = excluded.updated_at
        `,
      )
        .bind(
          crypto.randomUUID(),
          ctx.tenantId,
          subsystem.key,
          nowIso(),
          `Opened from ${recordType} records.`,
          ctx.userId,
          nowIso(),
          nowIso(),
        )
        .run();

      return json({ data: await buildSubsystemsSnapshot(ctx.env, ctx.tenantId) });
    }

    if (id && subresource === 'pin' && ctx.request.method === 'POST') {
      if (!ctx.userId) {
        return json({ error: 'missing_user', message: 'x-user-id is required' }, { status: 401 });
      }

      const subsystem = subsystemCatalog.find((item) => item.key === id);
      if (!subsystem) {
        return json(
          { error: 'subsystem_not_found', message: 'Select a valid subsystem panel.' },
          { status: 404 },
        );
      }

      const body = (await ctx.request.json().catch(() => ({}))) as ToggleSubsystemPinInput;
      const existing = await ctx.env.D1_MAIN.prepare(
        `
        SELECT pinned
        FROM ops_subsystem_preferences
        WHERE tenant_id = ? AND subsystem_key = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, id)
        .first<{ pinned: number }>();
      const nextPinned = typeof body.pinned === 'boolean' ? body.pinned : existing?.pinned !== 1;

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO ops_subsystem_preferences (
          id,
          tenant_id,
          subsystem_key,
          pinned,
          open_count,
          last_opened_at,
          activity_note,
          updated_by_user_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, 0, NULL, 'Pin state updated from control room.', ?, ?, ?)
        ON CONFLICT(tenant_id, subsystem_key) DO UPDATE SET
          pinned = excluded.pinned,
          activity_note = excluded.activity_note,
          updated_by_user_id = excluded.updated_by_user_id,
          updated_at = excluded.updated_at
        `,
      )
        .bind(
          crypto.randomUUID(),
          ctx.tenantId,
          id,
          nextPinned ? 1 : 0,
          ctx.userId,
          nowIso(),
          nowIso(),
        )
        .run();

      return json({ data: await buildSubsystemsSnapshot(ctx.env, ctx.tenantId) });
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'rmf') {
    const rmfPermission = await requireAnyPermission(
      ctx,
      isReadMethod ? FRAMEWORK_READ_PERMISSIONS : FRAMEWORK_WRITE_PERMISSIONS,
      isReadMethod
        ? 'RMF access requires framework-view permissions.'
        : 'RMF changes require framework management permissions.',
    );
    if (rmfPermission instanceof Response) {
      return rmfPermission;
    }

    if (!id && ctx.request.method === 'GET') {
      return json({ data: await buildRMFSnapshot(ctx.env, ctx.tenantId) });
    }

    if (id === 'packages' && subresource && nestedId === 'handoff' && ctx.request.method === 'POST') {
      if (!ctx.userId) {
        return json({ error: 'missing_user', message: 'x-user-id is required' }, { status: 401 });
      }

      const row = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          id,
          tenant_id,
          name,
          system_category,
          authorization_boundary,
          current_state,
          authorization_status,
          progress_percent,
          blockers_json,
          next_handoff,
          decision_target,
          steps_json,
          artifacts_json,
          timeline_json,
          created_by_user_id,
          updated_by_user_id,
          created_at,
          updated_at
        FROM ops_rmf_packages
        WHERE tenant_id = ? AND id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, subresource)
        .first<RMFPackageRow>();

      if (!row) {
        return json(
          { error: 'rmf_package_not_found', message: 'The selected RMF package does not exist.' },
          { status: 404 },
        );
      }

      const steps = parseJsonArray<RMFStepRow>(row.steps_json);
      const currentIndex = Math.max(0, rmfStepOrder.indexOf(row.current_state as (typeof rmfStepOrder)[number]));
      const nextIndex = Math.min(rmfStepOrder.length - 1, currentIndex + 1);
      const nextState = rmfStepOrder[nextIndex];
      const updatedSteps = steps.map((step, index) => {
        if (index < nextIndex) {
          return { ...step, status: 'Completed' as const, progress: 100 };
        }
        if (index === nextIndex) {
          return { ...step, status: nextState === 'Monitor' ? ('Completed' as const) : ('In Progress' as const), progress: nextState === 'Monitor' ? 100 : Math.max(step.progress, 75) };
        }
        return step;
      });
      const completedSteps = updatedSteps.filter((step) => step.status === 'Completed').length;
      const progressPercent = Math.round((completedSteps / updatedSteps.length) * 100);
      const authorizationStatus =
        nextState === 'Authorize'
          ? 'Ready for AO'
          : nextState === 'Monitor'
            ? 'Monitoring'
            : 'ATO Prep';
      const nextHandoff =
        nextState === 'Monitor'
          ? 'Package is in continuous monitoring cadence.'
          : `Advance to ${rmfStepOrder[Math.min(rmfStepOrder.length - 1, nextIndex + 1)]} once evidence is refreshed.`;

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE ops_rmf_packages
        SET
          current_state = ?,
          authorization_status = ?,
          progress_percent = ?,
          next_handoff = ?,
          steps_json = ?,
          updated_by_user_id = ?,
          updated_at = ?
        WHERE tenant_id = ? AND id = ?
        `,
      )
        .bind(
          nextState,
          authorizationStatus,
          progressPercent,
          nextHandoff,
          JSON.stringify(updatedSteps),
          ctx.userId,
          nowIso(),
          ctx.tenantId,
          subresource,
        )
        .run();

      return json({ data: await buildRMFSnapshot(ctx.env, ctx.tenantId) });
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'app-management') {
    const appManagementPermission = await requireAnyPermission(
      ctx,
      isReadMethod ? FRAMEWORK_READ_PERMISSIONS : FRAMEWORK_WRITE_PERMISSIONS,
      isReadMethod
        ? 'App management access requires framework-view permissions.'
        : 'App management changes require framework management permissions.',
    );
    if (appManagementPermission instanceof Response) {
      return appManagementPermission;
    }

    if (!id && ctx.request.method === 'GET') {
      return json({ data: await buildAppManagementSnapshot(ctx.env, ctx.tenantId) });
    }

    if (id === 'apps' && !subresource && ctx.request.method === 'POST') {
      if (!ctx.userId) {
        return json({ error: 'missing_user', message: 'x-user-id is required' }, { status: 401 });
      }

      const body = (await ctx.request.json()) as CreateAppManagementInput;
      const appId = crypto.randomUUID();
      const name = body.name?.trim() || 'New business unit';
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO ops_app_management_apps (
          id,
          tenant_id,
          name,
          description,
          administrators_json,
          default_public,
          inherit_parent_access,
          default_users_json,
          default_groups_json,
          groups_json,
          users_json,
          service_accounts_json,
          automation_owner,
          automation_queue,
          automation_health,
          notes,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES (?, ?, ?, ?, '[]', 0, 1, '[]', '[]', '[]', '[]', '[]', ?, ?, 'Healthy', ?, ?, ?)
        `,
      )
        .bind(
          appId,
          ctx.tenantId,
          name,
          'New business-unit partition for governed workload segmentation.',
          'Workspace Admin',
          `app-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-automation`,
          'Created from the canonical App Management control room.',
          ctx.userId,
          ctx.userId,
        )
        .run();

      return json({
        data: {
          app: await getAppManagementApp(ctx.env, ctx.tenantId, appId),
          snapshot: await buildAppManagementSnapshot(ctx.env, ctx.tenantId),
        },
      });
    }

    if (id === 'apps' && subresource && !nestedId && ctx.request.method === 'PUT') {
      if (!ctx.userId) {
        return json({ error: 'missing_user', message: 'x-user-id is required' }, { status: 401 });
      }

      const existing = await getAppManagementApp(ctx.env, ctx.tenantId, subresource);
      if (!existing) {
        return json(
          { error: 'app_management_not_found', message: 'The selected app partition does not exist.' },
          { status: 404 },
        );
      }

      const body = (await ctx.request.json()) as SaveAppManagementInput;
      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE ops_app_management_apps
        SET
          name = ?,
          description = ?,
          default_public = ?,
          inherit_parent_access = ?,
          automation_owner = ?,
          notes = ?,
          updated_by_user_id = ?,
          updated_at = ?
        WHERE tenant_id = ? AND id = ?
        `,
        )
        .bind(
          body.name?.trim() || existing.name,
          body.description?.trim() || existing.description,
          body.defaultPublic === undefined ? (existing.defaultPublic ? 1 : 0) : body.defaultPublic ? 1 : 0,
          body.inheritParentAccess === undefined
            ? existing.inheritParentAccess
              ? 1
              : 0
            : body.inheritParentAccess
              ? 1
              : 0,
          body.automationOwner?.trim() || existing.automationOwner,
          body.notes ?? existing.notes,
          ctx.userId,
          nowIso(),
          ctx.tenantId,
          subresource,
        )
        .run();

      return json({
        data: {
          app: await getAppManagementApp(ctx.env, ctx.tenantId, subresource),
          snapshot: await buildAppManagementSnapshot(ctx.env, ctx.tenantId),
        },
      });
    }

    if (id === 'apps' && subresource && nestedId === 'duplicate' && ctx.request.method === 'POST') {
      if (!ctx.userId) {
        return json({ error: 'missing_user', message: 'x-user-id is required' }, { status: 401 });
      }

      const row = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          id,
          tenant_id,
          name,
          description,
          administrators_json,
          default_public,
          inherit_parent_access,
          default_users_json,
          default_groups_json,
          groups_json,
          users_json,
          service_accounts_json,
          automation_owner,
          automation_queue,
          automation_health,
          notes,
          created_by_user_id,
          updated_by_user_id,
          created_at,
          updated_at
        FROM ops_app_management_apps
        WHERE tenant_id = ? AND id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, subresource)
        .first<AppManagementAppRow>();

      if (!row) {
        return json(
          { error: 'app_management_not_found', message: 'The selected app partition does not exist.' },
          { status: 404 },
        );
      }

      const duplicateId = crypto.randomUUID();
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO ops_app_management_apps (
          id,
          tenant_id,
          name,
          description,
          administrators_json,
          default_public,
          inherit_parent_access,
          default_users_json,
          default_groups_json,
          groups_json,
          users_json,
          service_accounts_json,
          automation_owner,
          automation_queue,
          automation_health,
          notes,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          duplicateId,
          ctx.tenantId,
          `${row.name} Copy`,
          row.description,
          row.administrators_json,
          row.default_public,
          row.inherit_parent_access,
          row.default_users_json,
          row.default_groups_json,
          row.groups_json,
          row.users_json,
          row.service_accounts_json,
          row.automation_owner,
          `${row.automation_queue}-copy`,
          row.automation_health,
          row.notes,
          ctx.userId,
          ctx.userId,
        )
        .run();

      return json({
        data: {
          app: await getAppManagementApp(ctx.env, ctx.tenantId, duplicateId),
          snapshot: await buildAppManagementSnapshot(ctx.env, ctx.tenantId),
        },
      });
    }

    return methodNotAllowed(['GET', 'POST', 'PUT']);
  }

  if (resource === 'workbench' && ctx.request.method === 'GET') {
    const workbenchPermission = await requireAnyPermission(
      ctx,
      OPERATIONS_READ_PERMISSIONS,
      'Workbench access requires operational-view permissions.',
    );
    if (workbenchPermission instanceof Response) {
      return workbenchPermission;
    }

    const moduleRecordScope = await loadScopedPermissionContext(ctx, MODULE_RECORD_OPS_SCOPE_PERMISSIONS);
    if (moduleRecordScope instanceof Response) {
      return moduleRecordScope;
    }

    return json({
      data: await buildWorkbenchSnapshot(ctx.env, ctx.tenantId, moduleRecordScope.accessibleDomainIds),
    });
  }

  if (resource === 'news-feed' && ctx.request.method === 'GET') {
    const newsFeedPermission = await requireAnyPermission(
      ctx,
      OPERATIONS_READ_PERMISSIONS,
      'News feed access requires operational-view permissions.',
    );
    if (newsFeedPermission instanceof Response) {
      return newsFeedPermission;
    }

    return json({ data: await buildNewsFeedSnapshot(ctx.env, ctx.tenantId) });
  }

  if (resource === 'reports') {
    const reportPermission = await requireAnyPermission(
      ctx,
      isReadMethod ? FRAMEWORK_READ_PERMISSIONS : FRAMEWORK_WRITE_PERMISSIONS,
      isReadMethod
        ? 'Report access requires framework-view permissions.'
        : 'Report export changes require framework management permissions.',
    );
    if (reportPermission instanceof Response) {
      return reportPermission;
    }

    if (!id && ctx.request.method === 'GET') {
      const reportBuilderCatalog = await listReportBuilderCatalogItems(ctx.env, ctx.tenantId);
      return json({
        data: {
          catalog: [
            {
              id: 'report-builder-create',
              title: 'Create New Report',
              description:
                'Open Report Builder to define list, bar, line, or pie reports with filters, sorting, exports, and subscriptions.',
              href: '/builders/report-builder',
              tags: ['Report Builder', 'Create', 'Custom'],
              source: 'Report Builder',
            },
            ...reportBuilderCatalog,
            {
              id: 'dora-roi',
              title: 'DORA Register of Information',
              description:
                'Validate entity and contract completeness, then generate a tenant-level DORA export package.',
              href: '/reports/dora-roi',
              tags: ['DORA', 'Exports', 'Authorities'],
            },
            {
              id: 'grc-exec-summary',
              title: 'GRC Executive Summary',
              description:
                'Generate executive and board-ready narratives from normalized findings, mapped controls, and gap assessments.',
              href: '/gap-assessments',
              tags: ['GRC', 'Executive', 'Narrative'],
            },
            {
              id: 'grc-program-health',
              title: 'Program Health Snapshot',
              description:
                'Summarize risk, vendor, policy, incident, and exception posture from the canonical GRC engine.',
              href: '/report-bundles',
              tags: ['GRC', 'Program', 'Health'],
            },
            {
              id: 'grc-automation-coverage',
              title: 'Automation Coverage Snapshot',
              description:
                'Track native collector readiness and evidence automation coverage across GitHub, Wiz, AWS, and Okta.',
              href: '/grc-admin',
              tags: ['GRC', 'Automation', 'Collectors'],
            },
          ],
          exports: await listReportExports(ctx.env, ctx.tenantId),
        },
      });
    }

    if (id === 'dora-roi' && ctx.request.method === 'GET') {
      return json({
        data: {
          lintResults: await getReportLint(ctx.env, ctx.tenantId),
        },
      });
    }

    if (id === 'exports' && !subresource) {
      if (ctx.request.method === 'GET') {
        return json({ data: await listReportExports(ctx.env, ctx.tenantId) });
      }

      if (ctx.request.method === 'POST') {
        const body = (await ctx.request.json()) as CreateReportExportInput;
        const reportId = body.reportId?.trim() || 'dora-roi';
        const format = body.format?.trim() || 'csv';
        const lint = await getReportLint(ctx.env, ctx.tenantId);
        const exportId = crypto.randomUUID();
        const fileRows = [
          ['section', 'field', 'value'],
          ['summary', 'errors', String(lint.summary.errors)],
          ['summary', 'warnings', String(lint.summary.warnings)],
          ['summary', 'info', String(lint.summary.info)],
          ['summary', 'ok', String(lint.summary.ok)],
        ];

        await ctx.env.D1_MAIN.prepare(
          `
          INSERT INTO report_exports (
            id,
            tenant_id,
            folder_id,
            created_by_user_id,
            report_id,
            name,
            format,
            status,
            filter_json,
            summary_json,
            content_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
          .bind(
            exportId,
            ctx.tenantId,
            await getFirstFolderId(ctx.env, ctx.tenantId),
            ctx.userId,
            reportId,
            `${reportId.toUpperCase()} export ${new Date().toLocaleDateString('en-US')}`,
            format,
            lint.summary.errors > 0 ? 'validation_failed' : 'generated',
            JSON.stringify({
              identifierType: body.identifierType ?? null,
              level: body.level ?? 'IND',
              namingConvention: body.namingConvention ?? 'eba',
            }),
            JSON.stringify({
              ...lint.summary,
              availableIdentifiers: lint.available_identifiers.length,
            }),
            JSON.stringify({
              filename: `${reportId}-${Date.now()}.${format === 'json' ? 'json' : 'csv'}`,
              rows: fileRows,
              lint: lint.results,
            }),
          )
          .run();

        const created = await ctx.env.D1_MAIN.prepare(
          `
          SELECT
            export_item.id,
            export_item.tenant_id,
            export_item.folder_id,
            folder_item.name AS folder_name,
            export_item.created_by_user_id,
            export_item.report_id,
            export_item.name,
            export_item.format,
            export_item.status,
            export_item.filter_json,
            export_item.summary_json,
            export_item.content_json,
            export_item.created_at,
            export_item.updated_at
          FROM report_exports AS export_item
          LEFT JOIN folders AS folder_item
            ON folder_item.id = export_item.folder_id
          WHERE export_item.tenant_id = ? AND export_item.id = ?
          LIMIT 1
          `,
        )
          .bind(ctx.tenantId, exportId)
          .first<ReportExportRow>();

        const exportRecipient = await getUserRecipient(ctx.env, ctx.tenantId, ctx.userId);
        if (created && exportRecipient?.email) {
          try {
            await sendReportExportReadyEmail(ctx.env, {
              tenantId: ctx.tenantId,
              exportId,
              recipientEmail: exportRecipient.email,
              recipientName: exportRecipient.display_name?.trim() || exportRecipient.email,
              exportName: created.name,
              format: created.format,
              status: created.status,
              baseOrigin: ctx.url.origin,
            });
          } catch (error) {
            console.error('Report export email failed', error);
          }
        }

        return json({ data: created ? toReportExportResponse(created) : null }, { status: 201 });
      }
    }

    if (id === 'exports' && subresource) {
      const exportItem = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          export_item.id,
          export_item.tenant_id,
          export_item.folder_id,
          folder_item.name AS folder_name,
          export_item.created_by_user_id,
          export_item.report_id,
          export_item.name,
          export_item.format,
          export_item.status,
          export_item.filter_json,
          export_item.summary_json,
          export_item.content_json,
          export_item.created_at,
          export_item.updated_at
        FROM report_exports AS export_item
        LEFT JOIN folders AS folder_item
          ON folder_item.id = export_item.folder_id
        WHERE export_item.tenant_id = ? AND export_item.id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, subresource)
        .first<ReportExportRow>();

      if (!exportItem) {
        return json(
          { error: 'report_export_not_found', message: 'The selected export does not exist.' },
          { status: 404 },
        );
      }

      if (!nestedId && ctx.request.method === 'GET') {
        return json({ data: toReportExportResponse(exportItem) });
      }

      if (nestedId === 'download' && ctx.request.method === 'GET') {
        const payload = toReportExportResponse(exportItem);
        const content =
          exportItem.format === 'json'
            ? JSON.stringify(payload.content, null, 2)
            : toCsv(payload.content as Record<string, unknown>);
        const contentType =
          exportItem.format === 'json' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8';

        return new Response(content, {
          headers: {
            'content-type': contentType,
            'content-disposition': `attachment; filename="${(payload.content as { filename?: string }).filename ?? 'export.csv'}"`,
          },
        });
      }
    }

    if (id === 'exports' && subresource && ctx.request.method === 'DELETE') {
      const result = await ctx.env.D1_MAIN.prepare(
        `DELETE FROM report_exports WHERE id = ? AND tenant_id = ?`,
      )
        .bind(subresource, ctx.tenantId)
        .run();

      if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
      return json({ data: { deleted: true, id: subresource } });
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'chat') {
    const chatPermission = await requireAnyPermission(
      ctx,
      isReadMethod ? OPERATIONS_READ_PERMISSIONS : OPERATIONS_WRITE_PERMISSIONS,
      isReadMethod
        ? 'Workspace chat access requires operational-view permissions.'
        : 'Workspace chat changes require operational workspace permissions.',
    );
    if (chatPermission instanceof Response) {
      return chatPermission;
    }

    if (id === 'status' && ctx.request.method === 'GET') {
      const counts = await buildOpsOverviewCounts(ctx.env, ctx.tenantId);
      const runtime = await getAiRuntimeStatus(ctx.env);
      return json({
        data: {
          available: true,
          provider: runtime.textGenerationAvailable ? 'workspace-guidance-ai' : 'workspace-guidance-fallback',
          sessionsCount: counts.chatSessions,
        },
      });
    }

    if (id === 'ollama-models' && ctx.request.method === 'GET') {
      const runtime = await getAiRuntimeStatus(ctx.env);
      return json({
        data: {
          available: runtime.textGenerationAvailable,
          models: [],
          message: runtime.textGenerationAvailable
            ? 'Workspace chat is backed by Workers AI with tenant-grounded context and deterministic fallback.'
            : 'Workspace chat is currently using deterministic fallback guidance because Workers AI is not provisioned.',
        },
      });
    }

    if (id === 'sessions' && !subresource) {
      if (ctx.request.method === 'GET') {
        return json({ data: await listChatSessions(ctx.env, ctx.tenantId) });
      }

      if (ctx.request.method === 'POST') {
        const body = (await ctx.request.json()) as CreateChatSessionInput;
        const fallbackFolderId = await getFirstFolderId(ctx.env, ctx.tenantId);
        const folderId = body.folderId?.trim() || fallbackFolderId;
        const folder = await getFolderOrError(ctx.env, ctx.tenantId, folderId);
        if (!folder) {
          return json(
            { error: 'folder_not_found', message: 'A valid folder is required to open a session.' },
            { status: 404 },
          );
        }

        const sessionId = crypto.randomUUID();
        await ctx.env.D1_MAIN.prepare(
          `
          INSERT INTO chat_sessions (
            id,
            tenant_id,
            folder_id,
            owner_user_id,
            title,
            workflow,
            status,
            messages_json,
            citations_json,
            workflow_state_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '[]', '{}')
          `,
        )
          .bind(
            sessionId,
            ctx.tenantId,
            folder.id,
            ctx.userId,
            body.title?.trim() || 'New workspace chat',
            body.workflow?.trim() || 'general',
            'active',
          )
          .run();

        return json({ data: await getChatSession(ctx.env, ctx.tenantId, sessionId) }, { status: 201 });
      }

      return methodNotAllowed(['GET', 'POST']);
    }

    if (id === 'sessions' && subresource) {
      if (!nestedId && ctx.request.method === 'GET') {
        const session = await getChatSession(ctx.env, ctx.tenantId, subresource);
        if (!session) {
          return json(
            { error: 'chat_session_not_found', message: 'The selected chat session does not exist.' },
            { status: 404 },
          );
        }

        return json({ data: session });
      }

      if (nestedId === 'messages' && ctx.request.method === 'POST') {
        const body = (await ctx.request.json()) as CreateChatMessageInput;
        const content = body.content?.trim();
        if (!content) {
          return json(
            { error: 'invalid_message', message: 'Message content is required.' },
            { status: 400 },
          );
        }

        const sessionRow = await ctx.env.D1_MAIN.prepare(
          `
          SELECT
            session.messages_json,
            session.title,
            session.workflow,
            folder_item.name AS folder_name
          FROM chat_sessions AS session
          INNER JOIN folders AS folder_item
            ON folder_item.id = session.folder_id
          WHERE session.tenant_id = ? AND session.id = ?
          LIMIT 1
          `,
        )
          .bind(ctx.tenantId, subresource)
          .first<{ messages_json: string; title: string; workflow: string | null; folder_name: string | null }>();

        if (!sessionRow) {
          return json(
            { error: 'chat_session_not_found', message: 'The selected chat session does not exist.' },
            { status: 404 },
          );
        }

        const messages = parseJsonArray<ChatMessage>(sessionRow.messages_json);
        const userMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content,
          createdAt: nowIso(),
        };
        const reply = await buildWorkspaceChatReply(ctx.env, ctx.tenantId, content, {
          folderName: sessionRow.folder_name,
          workflow: sessionRow.workflow,
        });
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: reply.content,
          createdAt: nowIso(),
          citations: reply.citations,
        };
        const updatedMessages = [...messages, userMessage, assistantMessage];
        const nextTitle =
          sessionRow.title && sessionRow.title.trim() ? sessionRow.title : content.slice(0, 80);

        await ctx.env.D1_MAIN.prepare(
          `
          UPDATE chat_sessions
          SET title = ?, messages_json = ?, citations_json = ?, updated_at = ?
          WHERE tenant_id = ? AND id = ?
          `,
        )
          .bind(
            nextTitle,
            JSON.stringify(updatedMessages),
            JSON.stringify(reply.citations),
            nowIso(),
            ctx.tenantId,
            subresource,
          )
          .run();

        return json({
          data: {
            session: await getChatSession(ctx.env, ctx.tenantId, subresource),
            userMessage,
            assistantMessage,
          },
        });
      }

      if (!nestedId && ctx.request.method === 'DELETE') {
        const result = await ctx.env.D1_MAIN.prepare(
          `DELETE FROM chat_sessions WHERE id = ? AND tenant_id = ?`,
        )
          .bind(subresource, ctx.tenantId)
          .run();

        if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
        return json({ data: { deleted: true, id: subresource } });
      }
    }

    return methodNotAllowed(['GET', 'POST', 'DELETE']);
  }

  if (resource === 'imports') {
    const importPermission = await requireAnyPermission(
      ctx,
      isReadMethod ? OPERATIONS_READ_PERMISSIONS : OPERATIONS_WRITE_PERMISSIONS,
      isReadMethod
        ? 'Import access requires operational-view permissions.'
        : 'Import execution requires operational workspace permissions.',
    );
    if (importPermission instanceof Response) {
      return importPermission;
    }

    if (ctx.request.method === 'GET') {
      return json({ data: await listImports(ctx.env, ctx.tenantId) });
    }

    if (ctx.request.method === 'POST') {
      const body = (await ctx.request.json()) as CreateImportJobInput;
      const fallbackFolderId = await getFirstFolderId(ctx.env, ctx.tenantId);
      const folderId = body.folderId?.trim() || fallbackFolderId;
      const folder = await getFolderOrError(ctx.env, ctx.tenantId, folderId);
      if (!folder) {
        return json(
          { error: 'folder_not_found', message: 'A valid folder is required for imports.' },
          { status: 404 },
        );
      }

      const targetKind = body.targetKind?.trim() || 'risk_scenarios';
      const createdObjects: NamedReference[] = [];

      if (targetKind === 'risk_scenarios') {
        const register = await ctx.env.D1_MAIN.prepare(
          `
          SELECT id, name
          FROM risk_registers
          WHERE tenant_id = ?
          ORDER BY created_at ASC
          LIMIT 1
          `,
        )
          .bind(ctx.tenantId)
          .first<{ id: string; name: string }>();

        if (register) {
          const scenarioId = crypto.randomUUID();
          const scenarioName = `${body.name?.trim() || 'Imported scenario'} exposure`;
          await ctx.env.D1_MAIN.prepare(
            `
            INSERT INTO risk_scenarios (
              id,
              tenant_id,
              register_id,
              title,
              description,
              likelihood,
              impact,
              inherent_score,
              residual_score,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
          )
            .bind(
              scenarioId,
              ctx.tenantId,
              register.id,
              scenarioName,
              'Created by the local import pipeline.',
              3.5,
              4.2,
              14.7,
              8.4,
              'open',
            )
            .run();
          createdObjects.push({ id: scenarioId, name: scenarioName });
        }
      } else if (targetKind === 'entities') {
        const entityId = crypto.randomUUID();
        const entityName = body.name?.trim() || 'Imported third-party entity';
        await ctx.env.D1_MAIN.prepare(
          `
          INSERT INTO entities (
            id,
            tenant_id,
            folder_id,
            ref_id,
            name,
            description,
            relationship,
            country,
            currency
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
          .bind(
            entityId,
            ctx.tenantId,
            folder.id,
            `IMP-${Date.now()}`,
            entityName,
            'Created by the local import pipeline.',
            'ict_provider',
            'US',
            'USD',
          )
          .run();
        createdObjects.push({ id: entityId, name: entityName });
      } else if (targetKind === 'processings') {
        const processingId = crypto.randomUUID();
        const processingName = body.name?.trim() || 'Imported processing record';
        await ctx.env.D1_MAIN.prepare(
          `
          INSERT INTO processings (
            id,
            tenant_id,
            folder_id,
            ref_id,
            name,
            description,
            status,
            perimeters_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, '[]')
          `,
        )
          .bind(
            processingId,
            ctx.tenantId,
            folder.id,
            `IMP-${Date.now()}`,
            processingName,
            'Created by the local import pipeline.',
            'privacy_draft',
          )
          .run();
        createdObjects.push({ id: processingId, name: processingName });
      }

      const jobId = crypto.randomUUID();
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO import_jobs (
          id,
          tenant_id,
          folder_id,
          created_by_user_id,
          name,
          source_type,
          target_kind,
          status,
          row_count,
          imported_count,
          error_count,
          steps_json,
          summary_json,
          created_objects_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          jobId,
          ctx.tenantId,
          folder.id,
          ctx.userId,
          body.name?.trim() || 'Imported workbook',
          body.sourceType?.trim() || 'spreadsheet',
          targetKind,
          'completed',
          Math.max(1, body.rowCount ?? createdObjects.length ?? 1),
          createdObjects.length,
          0,
          JSON.stringify([
            { key: 'upload', label: 'Upload received', status: 'completed' },
            { key: 'validate', label: 'Validation complete', status: 'completed' },
            { key: 'apply', label: 'Records applied', status: 'completed' },
            { key: 'finalize', label: 'Summary published', status: 'completed' },
          ]),
          JSON.stringify({
            note: 'Local import pipeline completed synchronously.',
          }),
          JSON.stringify(createdObjects),
        )
        .run();

      const created = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          import_job.id,
          import_job.tenant_id,
          import_job.folder_id,
          folder_item.name AS folder_name,
          import_job.created_by_user_id,
          import_job.name,
          import_job.source_type,
          import_job.target_kind,
          import_job.status,
          import_job.row_count,
          import_job.imported_count,
          import_job.error_count,
          import_job.steps_json,
          import_job.summary_json,
          import_job.created_objects_json,
          import_job.created_at,
          import_job.updated_at
        FROM import_jobs AS import_job
        INNER JOIN folders AS folder_item
          ON folder_item.id = import_job.folder_id
        WHERE import_job.tenant_id = ? AND import_job.id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, jobId)
        .first<ImportJobRow>();

      return json({ data: created ? toImportJobResponse(created) : null }, { status: 201 });
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'portal' && id === 'assignments') {
    if (!subresource && ctx.request.method === 'GET') {
      const portalAccess = await authorizePortalAccess(ctx, 'read');
      if (portalAccess instanceof Response) {
        return portalAccess;
      }

      return json({
        data:
          portalAccess.scope === 'internal'
            ? await listPortalAssignments(ctx.env, ctx.tenantId)
            : await listPortalAssignmentsByActor(ctx.env, ctx.tenantId, portalAccess.actorEmail),
      });
    }

    if (subresource && !nestedId && ctx.request.method === 'GET') {
      const portalAccess = await authorizePortalAccess(ctx, 'read', subresource);
      if (portalAccess instanceof Response) {
        return portalAccess;
      }

      return json({ data: portalAccess.assignment });
    }

    if (subresource && nestedId === 'requirements' && extraId && ctx.request.method === 'POST') {
      const portalAccess = await authorizePortalAccess(ctx, 'write', subresource);
      if (portalAccess instanceof Response) {
        return portalAccess;
      }
      const assignment = portalAccess.assignment!;

      const body = (await ctx.request.json()) as UpdatePortalRequirementInput;
      const requirements = assignment.requirements.map((requirement) =>
        requirement.id === extraId
          ? {
              ...requirement,
              result: body.result?.trim() || requirement.result,
              response: body.response ?? requirement.response,
              observation: body.observation ?? requirement.observation,
              evidenceNote: body.evidenceNote ?? requirement.evidenceNote,
            }
          : requirement,
      );
      const summary = summarizePortalRequirements(requirements);
      const nextStatus = assignment.status === 'draft' ? 'in_progress' : assignment.status;

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE portal_assignments
        SET requirements_json = ?, status = ?, updated_at = ?
        WHERE tenant_id = ? AND id = ?
        `,
      )
        .bind(JSON.stringify(requirements), nextStatus, nowIso(), ctx.tenantId, subresource)
        .run();

      return json({
        data: {
          assignment: await getPortalAssignment(ctx.env, ctx.tenantId, subresource),
          summary,
        },
      });
    }

    if (subresource && nestedId === 'submit' && ctx.request.method === 'POST') {
      const portalAccess = await authorizePortalAccess(ctx, 'write', subresource);
      if (portalAccess instanceof Response) {
        return portalAccess;
      }
      const assignment = portalAccess.assignment!;

      const events = [
        ...assignment.events,
        {
          id: crypto.randomUUID(),
          eventType: 'submitted',
          actorName: assignment.actorName ?? 'Auditee',
          note: 'Responses submitted for reviewer follow-up.',
          createdAt: nowIso(),
        },
      ];

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE portal_assignments
        SET status = 'submitted', submitted_at = ?, events_json = ?, updated_at = ?
        WHERE tenant_id = ? AND id = ?
        `,
      )
        .bind(nowIso(), JSON.stringify(events), nowIso(), ctx.tenantId, subresource)
        .run();

      if (assignment.actorEmail?.trim()) {
        try {
          await sendPortalAssignmentSubmittedEmail(ctx.env, {
            tenantId: ctx.tenantId,
            assignmentId: assignment.id,
            actorEmail: assignment.actorEmail.trim().toLowerCase(),
            actorName: assignment.actorName ?? 'Auditee',
            assignmentName: assignment.name,
            frameworkName: assignment.frameworkName,
            baseOrigin: ctx.url.origin,
          });
        } catch (error) {
          console.error('Portal assignment email failed', error);
        }
      }

      return json({
        data: await getPortalAssignment(ctx.env, ctx.tenantId, subresource),
      });
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'ebios-studies') {
    const ebiosPermission = await requireAnyPermission(
      ctx,
      isReadMethod ? RISK_READ_PERMISSIONS : RISK_WRITE_PERMISSIONS,
      isReadMethod
        ? 'EBIOS RM access requires risk-view permissions.'
        : 'EBIOS RM changes require risk management permissions.',
    );
    if (ebiosPermission instanceof Response) {
      return ebiosPermission;
    }

    if (!id && ctx.request.method === 'GET') {
      return json({ data: await listEbiosStudies(ctx.env, ctx.tenantId) });
    }

    if (!id && ctx.request.method === 'POST') {
      const body = (await ctx.request.json()) as CreateEbiosStudyInput;
      const folder = await getFolderOrError(ctx.env, ctx.tenantId, body.folderId?.trim() || null);
      if (!folder || !body.name?.trim()) {
        return json(
          { error: 'invalid_ebios_study', message: 'Name and folder are required.' },
          { status: 400 },
        );
      }

      const studyId = crypto.randomUUID();
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO ebios_studies (
          id,
          tenant_id,
          folder_id,
          perimeter_id,
          reference_entity_id,
          ref_id,
          name,
          description,
          version,
          status,
          quotation_method,
          risk_matrix_name,
          observation,
          workshop_status_json,
          feared_events_json,
          stakeholders_json,
          strategic_scenarios_json,
          operational_scenarios_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', '[]', '[]')
        `,
      )
        .bind(
          studyId,
          ctx.tenantId,
          folder.id,
          body.perimeterId?.trim() || null,
          body.referenceEntityId?.trim() || null,
          body.refId?.trim() || null,
          body.name.trim(),
          body.description?.trim() || null,
          body.version?.trim() || '1.0',
          body.status?.trim() || 'planned',
          body.quotationMethod?.trim() || 'express',
          'Enterprise Risk Matrix',
          body.observation?.trim() || null,
          JSON.stringify(createDefaultEbiosWorkshops()),
        )
        .run();

      return json({ data: await getEbiosStudy(ctx.env, ctx.tenantId, studyId) }, { status: 201 });
    }

    if (id && !subresource && ctx.request.method === 'GET') {
      const study = await getEbiosStudy(ctx.env, ctx.tenantId, id);
      if (!study) {
        return json(
          { error: 'ebios_study_not_found', message: 'The selected study does not exist.' },
          { status: 404 },
        );
      }

      return json({ data: study });
    }

    if (id && subresource === 'workshops' && nestedId && extraId && ctx.request.method === 'POST') {
      const body = (await ctx.request.json()) as { status?: WorkshopStep['status'] };
      const studyRow = await ctx.env.D1_MAIN.prepare(
        `
        SELECT workshop_status_json
        FROM ebios_studies
        WHERE tenant_id = ? AND id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, id)
        .first<{ workshop_status_json: string }>();

      if (!studyRow) {
        return json(
          { error: 'ebios_study_not_found', message: 'The selected study does not exist.' },
          { status: 404 },
        );
      }

      const workshops = parseJsonArray<EbiosWorkshop>(studyRow.workshop_status_json).map((workshop) =>
        workshop.id === nestedId
          ? {
              ...workshop,
              steps: workshop.steps.map((step) =>
                step.id === extraId
                  ? { ...step, status: body.status ?? 'done' }
                  : step,
              ),
            }
          : workshop,
      );

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE ebios_studies
        SET workshop_status_json = ?, updated_at = ?
        WHERE tenant_id = ? AND id = ?
        `,
      )
        .bind(JSON.stringify(workshops), nowIso(), ctx.tenantId, id)
        .run();

      return json({ data: await getEbiosStudy(ctx.env, ctx.tenantId, id) });
    }

    if (id && !subresource && ctx.request.method === 'PUT') {
      const body = (await ctx.request.json()) as CreateEbiosStudyInput;
      await ctx.env.D1_MAIN.prepare(
        `UPDATE ebios_studies
         SET name = ?, description = ?, status = ?, quotation_method = ?,
             observation = ?, version = ?, updated_at = ?
         WHERE id = ? AND tenant_id = ?`,
      )
        .bind(
          body.name?.trim() || null,
          body.description?.trim() || null,
          body.status?.trim() || null,
          body.quotationMethod?.trim() || null,
          body.observation?.trim() || null,
          body.version?.trim() || null,
          nowIso(),
          id,
          ctx.tenantId,
        )
        .run();

      const updated = await getEbiosStudy(ctx.env, ctx.tenantId, id);
      return updated ? json({ data: updated }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (id && !subresource && ctx.request.method === 'DELETE') {
      const result = await ctx.env.D1_MAIN.prepare(
        `DELETE FROM ebios_studies WHERE id = ? AND tenant_id = ?`,
      )
        .bind(id, ctx.tenantId)
        .run();

      if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
      return json({ data: { deleted: true, id } });
    }

    if (id && !subresource) {
      return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'quantitative-studies') {
    const quantitativePermission = await requireAnyPermission(
      ctx,
      isReadMethod ? RISK_READ_PERMISSIONS : RISK_WRITE_PERMISSIONS,
      isReadMethod
        ? 'Quantitative risk access requires risk-view permissions.'
        : 'Quantitative risk changes require risk management permissions.',
    );
    if (quantitativePermission instanceof Response) {
      return quantitativePermission;
    }

    if (!id && ctx.request.method === 'GET') {
      return json({ data: await listQuantitativeStudies(ctx.env, ctx.tenantId) });
    }

    if (!id && ctx.request.method === 'POST') {
      const body = (await ctx.request.json()) as CreateQuantitativeStudyInput;
      const folder = await getFolderOrError(ctx.env, ctx.tenantId, body.folderId?.trim() || null);
      if (!folder || !body.name?.trim()) {
        return json(
          { error: 'invalid_quantitative_study', message: 'Name and folder are required.' },
          { status: 400 },
        );
      }

      const scenarios = createDefaultQuantitativeScenarios().map((scenario, index) => ({
        ...scenario,
        id: crypto.randomUUID(),
        refId: `QRS-${String(index + 1).padStart(3, '0')}`,
      }));
      const actionPlan = buildQuantitativeActionPlan(scenarios);
      const metrics = computeQuantitativeMetrics(
        scenarios,
        typeof body.lossThreshold === 'number' ? body.lossThreshold : 400000,
        body.currency?.trim() || 'USD',
      );
      const studyId = crypto.randomUUID();

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO quantitative_studies (
          id,
          tenant_id,
          folder_id,
          risk_register_id,
          ref_id,
          name,
          description,
          version,
          status,
          distribution_model,
          currency,
          loss_threshold,
          observation,
          risk_tolerance_json,
          portfolio_json,
          scenarios_json,
          action_plan_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          studyId,
          ctx.tenantId,
          folder.id,
          body.riskRegisterId?.trim() || null,
          body.refId?.trim() || null,
          body.name.trim(),
          body.description?.trim() || null,
          body.version?.trim() || '1.0',
          body.status?.trim() || 'planned',
          body.distributionModel?.trim() || 'lognormal_ci90',
          body.currency?.trim() || 'USD',
          body.lossThreshold ?? 400000,
          body.observation?.trim() || null,
          JSON.stringify({
            points: {
              point1: { probability: 0.1, acceptableLoss: 350000 },
              point2: { probability: 0.02, acceptableLoss: 800000 },
            },
          }),
          JSON.stringify(metrics),
          JSON.stringify(scenarios),
          JSON.stringify(actionPlan),
        )
        .run();

      return json(
        { data: await getQuantitativeStudy(ctx.env, ctx.tenantId, studyId) },
        { status: 201 },
      );
    }

    if (id && !subresource && ctx.request.method === 'GET') {
      const study = await getQuantitativeStudy(ctx.env, ctx.tenantId, id);
      if (!study) {
        return json(
          { error: 'quantitative_study_not_found', message: 'The selected study does not exist.' },
          { status: 404 },
        );
      }

      return json({ data: study });
    }

    if (id && subresource === 'executive-summary' && ctx.request.method === 'GET') {
      const study = await getQuantitativeStudy(ctx.env, ctx.tenantId, id);
      if (!study) {
        return json(
          { error: 'quantitative_study_not_found', message: 'The selected study does not exist.' },
          { status: 404 },
        );
      }

      return json({
        data: {
          study,
          narrative: `Current modeled exposure is ${study.metrics.currentAleCombined.toLocaleString('en-US', {
            style: 'currency',
            currency: study.currency,
            maximumFractionDigits: 0,
          })}. Residual treatment lowers modeled annualized loss by ${study.metrics.riskReduction.toLocaleString(
            'en-US',
            {
              style: 'currency',
              currency: study.currency,
              maximumFractionDigits: 0,
            },
          )} across ${study.metrics.totalScenarios} scenarios.`,
        },
      });
    }

    if (id && subresource === 'key-metrics' && ctx.request.method === 'GET') {
      const study = await getQuantitativeStudy(ctx.env, ctx.tenantId, id);
      if (!study) {
        return json(
          { error: 'quantitative_study_not_found', message: 'The selected study does not exist.' },
          { status: 404 },
        );
      }

      return json({
        data: {
          studyId: study.id,
          metrics: study.metrics,
        },
      });
    }

    if (id && subresource === 'action-plan' && ctx.request.method === 'GET') {
      const study = await getQuantitativeStudy(ctx.env, ctx.tenantId, id);
      if (!study) {
        return json(
          { error: 'quantitative_study_not_found', message: 'The selected study does not exist.' },
          { status: 404 },
        );
      }

      return json({
        data: {
          study,
          actionPlan: study.actionPlan,
          budget: study.actionPlan.reduce((sum, item) => sum + (item.annualCost ?? 0), 0),
        },
      });
    }

    if (id && subresource === 'retrigger-simulations' && ctx.request.method === 'POST') {
      const study = await getQuantitativeStudy(ctx.env, ctx.tenantId, id);
      if (!study) {
        return json(
          { error: 'quantitative_study_not_found', message: 'The selected study does not exist.' },
          { status: 404 },
        );
      }

      const refreshedMetrics = computeQuantitativeMetrics(
        study.scenarios.map((scenario) => ({
          ...scenario,
          currentAle: Math.round(scenario.currentAle * 0.97),
          residualAle: Math.round(scenario.residualAle * 0.95),
        })),
        study.lossThreshold,
        study.currency,
      );

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE quantitative_studies
        SET portfolio_json = ?, updated_at = ?
        WHERE tenant_id = ? AND id = ?
        `,
      )
        .bind(JSON.stringify(refreshedMetrics), nowIso(), ctx.tenantId, id)
        .run();

      return json({
        data: {
          success: true,
          metrics: refreshedMetrics,
        },
      });
    }

    if (id && !subresource && ctx.request.method === 'PUT') {
      const body = (await ctx.request.json()) as CreateQuantitativeStudyInput;
      await ctx.env.D1_MAIN.prepare(
        `UPDATE quantitative_studies
         SET name = ?, description = ?, status = ?, distribution_model = ?,
             currency = ?, loss_threshold = ?, observation = ?, version = ?,
             updated_at = ?
         WHERE id = ? AND tenant_id = ?`,
      )
        .bind(
          body.name?.trim() || null,
          body.description?.trim() || null,
          body.status?.trim() || null,
          body.distributionModel?.trim() || null,
          body.currency?.trim() || null,
          body.lossThreshold ?? null,
          body.observation?.trim() || null,
          body.version?.trim() || null,
          nowIso(),
          id,
          ctx.tenantId,
        )
        .run();

      const updated = await getQuantitativeStudy(ctx.env, ctx.tenantId, id);
      return updated ? json({ data: updated }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (id && !subresource && ctx.request.method === 'DELETE') {
      const result = await ctx.env.D1_MAIN.prepare(
        `DELETE FROM quantitative_studies WHERE id = ? AND tenant_id = ?`,
      )
        .bind(id, ctx.tenantId)
        .run();

      if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
      return json({ data: { deleted: true, id } });
    }

    if (id && !subresource) {
      return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'quantitative-scenarios' && id && ctx.request.method === 'GET') {
    const quantitativeScenarioPermission = await requireAnyPermission(
      ctx,
      RISK_READ_PERMISSIONS,
      'Quantitative risk access requires risk-view permissions.',
    );
    if (quantitativeScenarioPermission instanceof Response) {
      return quantitativeScenarioPermission;
    }

    const detail = await getQuantitativeScenarioDetail(ctx.env, ctx.tenantId, id);
    if (!detail) {
      return json(
        { error: 'quantitative_scenario_not_found', message: 'The selected quantitative scenario does not exist.' },
        { status: 404 },
      );
    }

    return json({ data: detail });
  }

  if (resource === 'quantitative-hypotheses' && id && ctx.request.method === 'GET') {
    const quantitativeHypothesisPermission = await requireAnyPermission(
      ctx,
      RISK_READ_PERMISSIONS,
      'Quantitative risk access requires risk-view permissions.',
    );
    if (quantitativeHypothesisPermission instanceof Response) {
      return quantitativeHypothesisPermission;
    }

    const detail = await getQuantitativeHypothesisDetail(ctx.env, ctx.tenantId, id);
    if (!detail) {
      return json(
        { error: 'quantitative_hypothesis_not_found', message: 'The selected quantitative hypothesis does not exist.' },
        { status: 404 },
      );
    }

    return json({ data: detail });
  }

  if (resource === 'parity' && id === 'overview' && ctx.request.method === 'GET') {
    const permissionContext = await loadPermissionContext(ctx);
    if (permissionContext instanceof Response) {
      return permissionContext;
    }

    return json({
      data: await buildParityOverview(
        ctx,
        deriveOpsSurfaceAccessProfile(permissionContext.permissions),
      ),
    });
  }

  return json({ error: 'not_found', path: segments.join('/') }, { status: 404 });
}
