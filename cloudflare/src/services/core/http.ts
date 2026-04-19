import type { WorkerRequestContext } from '../../router';
import type { EnvBindings } from '../../types/env';
import {
  getEmailRuntimeSummary,
  sendLocalSignInCodeEmail,
} from '../../email';
import { requireAnyPermission, requireRootAdminAccess } from '../../authorization';
import { getAiRuntimeStatus } from '../ai/runtime';
import { seedDemoIamWorkspace } from '../iam/http';
import { buildOpsOverviewCounts, seedDemoOpsWorkspace } from '../ops/http';
import { seedDemoSetupWorkspace } from '../setup/http';
import {
  buildClearedSessionCookieHeader,
  buildSessionCookieHeader,
  createSession,
  deleteSession,
  getSessionById,
  getSessionIdFromRequest,
  isSessionValid,
} from '../../session';
import { getTenantWorkflowSnapshot } from '../../utils/workflows';
import { json, methodNotAllowed, readJson } from '../../utils/http';

type OverviewCounts = {
  users: number;
  folders: number;
  domains: number;
  userGroups: number;
  roleAssignments: number;
  perimeters: number;
  riskAssessments: number;
  complianceAssessments: number;
  frameworks: number;
  entities: number;
  contracts: number;
  processings: number;
  rightRequests: number;
  dataBreaches: number;
  businessImpactAnalyses: number;
  riskRegisters: number;
  riskScenarios: number;
  conMonProfiles: number;
  conMonExecutions: number;
  evidenceSources: number;
  evidenceJobs: number;
  evidenceArtifacts: number;
  reportExports: number;
  chatSessions: number;
  importJobs: number;
  portalAssignments: number;
  ebiosStudies: number;
  quantitativeStudies: number;
};

type BootstrapStatusPayload = {
  initialized: boolean;
  tenantCount: number;
  userCount: number;
  bootstrapSecretConfigured: boolean;
  mode: 'initialize' | 'admin-access' | 'disabled';
};

type LoginConfigPayload = {
  initialized: boolean;
  emailCodeEnabled: boolean;
  previewOnly: boolean;
  emailProvider: string;
  emailSendingEnabled: boolean;
  passwordSignInEnabled: boolean;
  loginEnforced: boolean;
  deliveryMode: string | null;
  supportEmail: string | null;
  status: string | null;
  statusNote: string | null;
  localLoginUserCount: number;
  passwordConfiguredUserCount: number;
  suggestedTenantSlug: string | null;
  suggestedEmail: string | null;
  message: string;
};

type LocalLoginPrincipal = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  userId: string;
  userEmail: string;
  displayName: string;
  loginEnforced: boolean;
};

type LocalLoginCodeRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  email_normalized: string;
  purpose: string;
  code_hash: string;
  requested_at: string;
  expires_at: string;
  consumed_at: string | null;
  attempts: number;
  last_attempt_at: string | null;
};

type LocalPasswordCredentialRow = {
  user_id: string;
  tenant_id: string;
  password_hash: string;
  password_salt: string;
  hash_method: string;
  hash_iterations: number;
  created_at: string;
  updated_at: string;
  updated_by_user_id: string | null;
  reset_required: number;
  failed_attempts: number;
  last_failed_at: string | null;
  locked_until: string | null;
};

type SetupEmailConfigSummaryRow = {
  support_email: string | null;
  delivery_mode: string;
  status: string;
  status_note: string | null;
};

type SetupSsoLoginSummaryRow = {
  login_enforced: number;
};

type FrameworkRow = {
  id: string;
  tenant_id: string;
  key: string;
  name: string;
  version: string | null;
  category: string | null;
  control_count: number;
  created_at: string;
  updated_at: string;
};

type ControlRow = {
  id: string;
  tenant_id: string;
  framework_id: string;
  framework_key: string;
  framework_name: string;
  ref: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type RiskRegisterRow = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type RiskScenarioRow = {
  id: string;
  tenant_id: string;
  register_id: string;
  register_name: string;
  title: string;
  description: string | null;
  likelihood: number | null;
  impact: number | null;
  inherent_score: number | null;
  residual_score: number | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type PerimeterRow = {
  id: string;
  tenant_id: string;
  folder_id: string;
  folder_name: string;
  ref_id: string | null;
  name: string;
  description: string | null;
  lc_status: string;
  created_at: string;
  updated_at: string;
};

type RiskAssessmentRow = {
  id: string;
  tenant_id: string;
  folder_id: string;
  folder_name: string;
  perimeter_id: string | null;
  perimeter_name: string | null;
  risk_register_id: string | null;
  risk_register_name: string | null;
  ref_id: string | null;
  name: string;
  version: string;
  status: string;
  observation: string | null;
  scenario_count: number;
  created_at: string;
  updated_at: string;
};

type ComplianceAssessmentRow = {
  id: string;
  tenant_id: string;
  folder_id: string;
  folder_name: string;
  perimeter_id: string | null;
  perimeter_name: string | null;
  framework_id: string;
  framework_name: string;
  ref_id: string | null;
  name: string;
  version: string;
  status: string;
  observation: string | null;
  controls_total: number;
  controls_assessed: number;
  progress_percent: number;
  maturity_score: number | null;
  created_at: string;
  updated_at: string;
};

type RiskActionPlanItem = {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  status: string;
  priority: string;
  inherentScore: number;
  residualScore: number;
  annualCost: number;
  effort: string;
  recommendedAction: string;
  targetRoute: string;
};

type ComplianceRequirementAssessmentRow = {
  id: string;
  tenant_id: string;
  compliance_assessment_id: string;
  control_id: string;
  framework_id: string;
  framework_name: string;
  control_ref: string;
  control_title: string;
  control_description: string | null;
  result: string;
  observation: string | null;
  evidence_status: string;
  implementation_score: number | null;
  documentation_score: number | null;
  created_at: string;
  updated_at: string;
};

type LibraryRow = {
  id: string;
  tenant_id: string;
  framework_id: string | null;
  framework_name: string | null;
  framework_key: string | null;
  name: string;
  description: string | null;
  provider: string;
  packager: string;
  version: string | null;
  publication_date: string | null;
  copyright: string | null;
  dependencies_json: string;
  risk_matrices_json: string;
  threats_json: string;
  has_update: number;
  control_count: number;
  created_at: string;
  updated_at: string;
};

type AppliedControlRow = {
  id: string;
  tenant_id: string;
  compliance_assessment_id: string;
  requirement_assessment_id: string | null;
  folder_id: string;
  folder_name: string;
  ref_id: string | null;
  name: string;
  description: string | null;
  status: string;
  priority: string | null;
  category: string | null;
  csf_function: string | null;
  owner_name: string | null;
  eta: string | null;
  expiry_date: string | null;
  control_impact: number | null;
  effort: string | null;
  annual_cost: number | null;
  notes: string | null;
  is_generated: number;
  requirement_result: string | null;
  requirement_ref: string | null;
  requirement_name: string | null;
  created_at: string;
  updated_at: string;
};

type EntityRow = {
  id: string;
  tenant_id: string;
  folder_id: string;
  folder_name: string;
  parent_entity_id: string | null;
  parent_entity_name: string | null;
  ref_id: string | null;
  name: string;
  description: string | null;
  relationship: string | null;
  country: string | null;
  currency: string | null;
  is_active: number;
  default_dependency: number;
  default_penetration: number;
  default_maturity: number;
  default_trust: number;
  mission: string | null;
  reference_link: string | null;
  dora_entity_type: string | null;
  dora_entity_hierarchy: string | null;
  dora_provider_person_type: string | null;
  solution_count: number;
  contract_count: number;
  assessment_count: number;
  created_at: string;
  updated_at: string;
};

type SolutionRow = {
  id: string;
  tenant_id: string;
  folder_id: string;
  folder_name: string;
  provider_entity_id: string;
  provider_entity_name: string;
  recipient_entity_name: string | null;
  ref_id: string | null;
  name: string;
  description: string | null;
  is_active: number;
  criticality: number;
  reference_link: string | null;
  dora_ict_service_type: string | null;
  storage_of_data: number;
  data_location_storage: string | null;
  data_location_processing: string | null;
  dora_data_sensitiveness: string | null;
  dora_reliance_level: string | null;
  dora_substitutability: string | null;
  dora_non_substitutability_reason: string | null;
  dora_has_exit_plan: string | null;
  dora_reintegration_possibility: string | null;
  dora_discontinuing_impact: string | null;
  dora_alternative_providers: string | null;
  asset_refs_json: string;
  created_at: string;
  updated_at: string;
};

type ContractRow = {
  id: string;
  tenant_id: string;
  folder_id: string;
  folder_name: string;
  provider_entity_id: string;
  provider_entity_name: string;
  beneficiary_entity_id: string | null;
  beneficiary_entity_name: string | null;
  ref_id: string | null;
  name: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  currency: string | null;
  annual_expense: number | null;
  is_intragroup: number;
  dora_contractual_arrangement: string | null;
  governing_law_country: string | null;
  notice_period_entity: number | null;
  notice_period_provider: number | null;
  dora_exclude: number;
  solutions_json: string;
  created_at: string;
  updated_at: string;
};

type EntityAssessmentRow = {
  id: string;
  tenant_id: string;
  folder_id: string;
  folder_name: string;
  entity_id: string;
  entity_name: string;
  perimeter_id: string | null;
  perimeter_name: string | null;
  compliance_assessment_id: string | null;
  compliance_assessment_name: string | null;
  ref_id: string | null;
  name: string;
  status: string;
  criticality: number;
  dependency: number;
  penetration: number;
  maturity: number;
  trust: number;
  conclusion: string | null;
  next_review_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ProcessingRow = {
  id: string;
  tenant_id: string;
  folder_id: string;
  folder_name: string;
  ref_id: string | null;
  name: string;
  description: string | null;
  status: string;
  information_channel: string | null;
  usage_channel: string | null;
  dpia_required: number;
  dpia_reference: string | null;
  has_sensitive_personal_data: number;
  perimeters_json: string;
  purposes_json: string;
  personal_data_json: string;
  data_subjects_json: string;
  data_recipients_json: string;
  data_contractors_json: string;
  data_transfers_json: string;
  created_at: string;
  updated_at: string;
};

type RightRequestRow = {
  id: string;
  tenant_id: string;
  folder_id: string;
  folder_name: string;
  ref_id: string | null;
  name: string;
  requested_on: string;
  due_date: string | null;
  request_type: string;
  status: string;
  observation: string | null;
  processings_json: string;
  created_at: string;
  updated_at: string;
};

type DataBreachRow = {
  id: string;
  tenant_id: string;
  folder_id: string;
  folder_name: string;
  ref_id: string | null;
  name: string;
  discovered_on: string;
  breach_type: string;
  risk_level: string;
  status: string;
  affected_subjects_count: number;
  affected_personal_data_count: number;
  affected_processings_json: string;
  authority_notified_on: string | null;
  subjects_notified_on: string | null;
  potential_consequences: string | null;
  observation: string | null;
  created_at: string;
  updated_at: string;
};

type BusinessImpactAnalysisRow = {
  id: string;
  tenant_id: string;
  folder_id: string;
  folder_name: string;
  perimeter_id: string | null;
  perimeter_name: string | null;
  ref_id: string | null;
  name: string;
  description: string | null;
  version: string;
  status: string;
  observation: string | null;
  risk_matrix_name: string | null;
  risk_matrix_json: string;
  asset_assessments_json: string;
  created_at: string;
  updated_at: string;
};

type LibraryDependency = {
  id: string;
  name: string;
};

type LibraryThreat = {
  id: string;
  refId: string;
  name: string;
  description: string;
  severity: string;
};

type LibraryRiskMatrix = {
  id: string;
  name: string;
  description: string;
  levels: Array<{
    label: string;
    score: number;
    tone: string;
  }>;
};

type NamedReference = {
  id: string;
  name: string;
};

type ProcessingPurpose = {
  id: string;
  name: string;
  legalBasis: string;
  article9Condition: string | null;
};

type ProcessingPersonalData = {
  id: string;
  name: string;
  category: string;
  retention: string | null;
  deletionPolicy: string | null;
  isSensitive: boolean;
};

type ProcessingSubject = {
  id: string;
  name: string;
  category: string;
};

type ProcessingRecipient = {
  id: string;
  name: string;
  category: string;
};

type ProcessingContractor = {
  id: string;
  name: string;
  relationshipType: string;
  country: string | null;
  documentationLink: string | null;
  entity: NamedReference | null;
};

type ProcessingTransfer = {
  id: string;
  name: string;
  country: string | null;
  transferMechanism: string | null;
  guarantees: string | null;
  documentationLink: string | null;
  entity: NamedReference | null;
};

type RecoveryMatrixLevel = {
  label: string;
  score: number;
  tone: string;
};

type RecoveryMatrix = {
  levels: RecoveryMatrixLevel[];
};

type EscalationThreshold = {
  pointInTime: number;
  label: string;
  hexColor: string;
  qualiImpact: number;
  quantiImpact: number | null;
  quantiImpactUnit: string | null;
  justification: string | null;
};

type BiaAssetAssessment = {
  id: string;
  assetName: string;
  folderName: string;
  dependencies: string[];
  associatedControls: string[];
  recoveryDocumented: boolean;
  recoveryTested: boolean;
  recoveryTargetsMet: boolean;
  observation: string | null;
  thresholds: EscalationThreshold[];
};

type CreateFrameworkInput = {
  key?: string;
  name?: string;
  version?: string;
  category?: string;
};

type CreateControlInput = {
  ref?: string;
  title?: string;
  description?: string;
};

type CreateRiskRegisterInput = {
  name?: string;
  description?: string;
};

type CreateRiskScenarioInput = {
  registerId?: string;
  title?: string;
  description?: string;
  likelihood?: number;
  impact?: number;
  inherentScore?: number;
  residualScore?: number;
  status?: string;
};

type CreatePerimeterInput = {
  folderId?: string;
  refId?: string;
  name?: string;
  description?: string;
  lcStatus?: string;
};

type CreateRiskAssessmentInput = {
  perimeterId?: string;
  riskRegisterId?: string;
  refId?: string;
  name?: string;
  version?: string;
  status?: string;
  observation?: string;
};

type CreateComplianceAssessmentInput = {
  perimeterId?: string;
  frameworkId?: string;
  refId?: string;
  name?: string;
  version?: string;
  status?: string;
  observation?: string;
  controlsTotal?: number;
  controlsAssessed?: number;
  maturityScore?: number;
};

type UpdateComplianceRequirementInput = {
  result?: string | null;
  observation?: string | null;
  evidenceStatus?: string | null;
  implementationScore?: number | null;
  documentationScore?: number | null;
};

type UpdateAppliedControlInput = {
  status?: string | null;
  priority?: string | null;
  category?: string | null;
  csfFunction?: string | null;
  ownerName?: string | null;
  eta?: string | null;
  expiryDate?: string | null;
  controlImpact?: number | null;
  effort?: string | null;
  annualCost?: number | null;
  notes?: string | null;
};

type CreateEntityInput = {
  folderId?: string;
  parentEntityId?: string | null;
  refId?: string | null;
  name?: string;
  description?: string | null;
  relationship?: string | null;
  country?: string | null;
  currency?: string | null;
  mission?: string | null;
  referenceLink?: string | null;
  defaultDependency?: number | null;
  defaultPenetration?: number | null;
  defaultMaturity?: number | null;
  defaultTrust?: number | null;
  doraEntityType?: string | null;
  doraEntityHierarchy?: string | null;
  doraProviderPersonType?: string | null;
};

type CreateSolutionInput = {
  folderId?: string;
  providerEntityId?: string;
  recipientEntityName?: string | null;
  refId?: string | null;
  name?: string;
  description?: string | null;
  criticality?: number | null;
  referenceLink?: string | null;
  doraIctServiceType?: string | null;
  storageOfData?: boolean;
  dataLocationStorage?: string | null;
  dataLocationProcessing?: string | null;
  doraDataSensitiveness?: string | null;
  doraRelianceLevel?: string | null;
  doraAlternativeProviders?: string | null;
  assetRefs?: string[];
};

type CreateContractInput = {
  folderId?: string;
  providerEntityId?: string;
  beneficiaryEntityId?: string | null;
  refId?: string | null;
  name?: string;
  description?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  currency?: string | null;
  annualExpense?: number | null;
  isIntragroup?: boolean;
  doraContractualArrangement?: string | null;
  governingLawCountry?: string | null;
  noticePeriodEntity?: number | null;
  noticePeriodProvider?: number | null;
  solutions?: NamedReference[];
};

type CreateProcessingInput = {
  folderId?: string;
  refId?: string | null;
  name?: string;
  description?: string | null;
  status?: string | null;
  informationChannel?: string | null;
  usageChannel?: string | null;
  dpiaRequired?: boolean;
  dpiaReference?: string | null;
  perimeters?: NamedReference[];
};

type CreateRightRequestInput = {
  folderId?: string;
  refId?: string | null;
  name?: string;
  requestedOn?: string;
  dueDate?: string | null;
  requestType?: string | null;
  status?: string | null;
  observation?: string | null;
  processings?: NamedReference[];
};

type CreateDataBreachInput = {
  folderId?: string;
  refId?: string | null;
  name?: string;
  discoveredOn?: string;
  breachType?: string | null;
  riskLevel?: string | null;
  status?: string | null;
  affectedSubjectsCount?: number | null;
  affectedPersonalDataCount?: number | null;
  affectedProcessings?: NamedReference[];
  authorityNotifiedOn?: string | null;
  subjectsNotifiedOn?: string | null;
  potentialConsequences?: string | null;
  observation?: string | null;
};

type CreateBusinessImpactAnalysisInput = {
  perimeterId?: string;
  refId?: string | null;
  name?: string;
  description?: string | null;
  version?: string | null;
  status?: string | null;
  observation?: string | null;
  riskMatrixName?: string | null;
};

type FrameworkTreeNode = {
  id: string;
  ref: string;
  title: string;
  description: string | null;
  assessable: boolean;
  controlId: string | null;
  children: FrameworkTreeNode[];
};

const DEMO_IDS = {
  tenantId: 'tenant-demo',
  userId: 'user-demo',
  governanceFolderId: 'folder-governance-demo',
  vendorFolderId: 'folder-vendor-demo',
  perimeterId: 'perimeter-enterprise-demo',
  perimeterSecondaryId: 'perimeter-vendor-demo',
  frameworkId: 'framework-demo-iso27001',
  frameworkSecondaryId: 'framework-demo-nist-csf',
  registerId: 'risk-register-demo',
  registerSecondaryId: 'risk-register-vendor-demo',
  scenarioId: 'risk-scenario-demo',
  scenarioSecondaryId: 'risk-scenario-vendor-demo',
  riskAssessmentId: 'risk-assessment-enterprise-demo',
  riskAssessmentSecondaryId: 'risk-assessment-vendor-demo',
  complianceAssessmentId: 'compliance-assessment-iso-demo',
  complianceAssessmentSecondaryId: 'compliance-assessment-vendor-demo',
  libraryId: 'library-demo-iso-pack',
  librarySecondaryId: 'library-demo-vendor-pack',
  entityMainId: 'entity-demo-main',
  entityVendorId: 'entity-demo-vendor',
  entityResilienceId: 'entity-demo-resilience',
  solutionId: 'solution-demo-iam',
  solutionSecondaryId: 'solution-demo-dr',
  contractId: 'contract-demo-iam',
  contractSecondaryId: 'contract-demo-dr',
  entityAssessmentId: 'entity-assessment-demo-vendor',
  processingId: 'processing-demo-workforce',
  processingSecondaryId: 'processing-demo-customer',
  rightRequestId: 'right-request-demo-access',
  dataBreachId: 'data-breach-demo-payroll',
  businessImpactAnalysisId: 'bia-demo-enterprise',
  businessImpactAnalysisSecondaryId: 'bia-demo-vendor',
  profileId: 'conmon-profile-demo',
  activityId: 'conmon-activity-demo',
  sourceId: 'evidence-source-demo',
};

const COMPLIANCE_RESULTS = new Set([
  'not_assessed',
  'non_compliant',
  'partially_compliant',
  'compliant',
  'not_applicable',
]);

const EVIDENCE_STATUSES = new Set(['missing', 'draft', 'in_review', 'approved', 'rejected']);
const APPLIED_CONTROL_STATUSES = new Set([
  '--',
  'to_do',
  'in_progress',
  'on_hold',
  'active',
  'deprecated',
]);
const APPLIED_CONTROL_PRIORITIES = new Set(['P1', 'P2', 'P3', 'P4']);
const APPLIED_CONTROL_EFFORTS = new Set(['XS', 'S', 'M', 'L', 'XL']);
const FOLDER_READ_PERMISSIONS = ['view_folder', 'add_folder', 'change_folder'];
const FOLDER_WRITE_PERMISSIONS = ['add_folder', 'change_folder'];
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
const TPRM_WRITE_PERMISSIONS = [
  'add_entity',
  'change_entity',
  'add_solution',
  'change_solution',
  'add_contract',
  'change_contract',
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
const PRIVACY_WRITE_PERMISSIONS = [
  'add_processing',
  'change_processing',
  'add_rightrequest',
  'change_rightrequest',
  'add_databreach',
  'change_databreach',
];
const RESILIENCE_READ_PERMISSIONS = ['view_bia', 'add_bia', 'change_bia'];
const RESILIENCE_WRITE_PERMISSIONS = ['add_bia', 'change_bia'];
const CORE_OVERVIEW_READ_PERMISSIONS = [
  ...FOLDER_READ_PERMISSIONS,
  ...FRAMEWORK_READ_PERMISSIONS,
  ...RISK_READ_PERMISSIONS,
  ...TPRM_READ_PERMISSIONS,
  ...PRIVACY_READ_PERMISSIONS,
  ...RESILIENCE_READ_PERMISSIONS,
];

const DEMO_FRAMEWORK_CONTROLS = [
  {
    id: 'control-demo-iso-5-1',
    frameworkId: DEMO_IDS.frameworkId,
    ref: '5.1',
    title: 'Policies for information security',
    description: 'Define and maintain approved information security policies.',
  },
  {
    id: 'control-demo-iso-5-2',
    frameworkId: DEMO_IDS.frameworkId,
    ref: '5.2',
    title: 'Information security roles and responsibilities',
    description: 'Assign ownership and accountability for the control environment.',
  },
  {
    id: 'control-demo-iso-5-7',
    frameworkId: DEMO_IDS.frameworkId,
    ref: '5.7',
    title: 'Threat intelligence',
    description: 'Collect and act on relevant cyber threat intelligence sources.',
  },
  {
    id: 'control-demo-iso-5-23',
    frameworkId: DEMO_IDS.frameworkId,
    ref: '5.23',
    title: 'Information security for use of cloud services',
    description: 'Define governance and assurance expectations for cloud platforms.',
  },
  {
    id: 'control-demo-iso-6-1',
    frameworkId: DEMO_IDS.frameworkId,
    ref: '6.1',
    title: 'Screening',
    description: 'Conduct screening aligned to personnel risk and legal requirements.',
  },
  {
    id: 'control-demo-iso-6-3',
    frameworkId: DEMO_IDS.frameworkId,
    ref: '6.3',
    title: 'Information security awareness, education and training',
    description: 'Deliver recurring training and track completion for covered teams.',
  },
  {
    id: 'control-demo-iso-8-1',
    frameworkId: DEMO_IDS.frameworkId,
    ref: '8.1',
    title: 'User endpoint devices',
    description: 'Secure endpoints through configuration, hardening, and monitoring.',
  },
  {
    id: 'control-demo-iso-8-2',
    frameworkId: DEMO_IDS.frameworkId,
    ref: '8.2',
    title: 'Privileged access rights',
    description: 'Manage privileged access through approval and review workflows.',
  },
  {
    id: 'control-demo-iso-8-5',
    frameworkId: DEMO_IDS.frameworkId,
    ref: '8.5',
    title: 'Secure authentication',
    description: 'Enforce modern authentication patterns and credential hygiene.',
  },
  {
    id: 'control-demo-iso-8-9',
    frameworkId: DEMO_IDS.frameworkId,
    ref: '8.9',
    title: 'Configuration management',
    description: 'Track authorized baselines and control drift in production systems.',
  },
  {
    id: 'control-demo-iso-8-16',
    frameworkId: DEMO_IDS.frameworkId,
    ref: '8.16',
    title: 'Monitoring activities',
    description: 'Operate monitoring across assets, control health, and exceptions.',
  },
  {
    id: 'control-demo-iso-8-24',
    frameworkId: DEMO_IDS.frameworkId,
    ref: '8.24',
    title: 'Use of cryptography',
    description: 'Select and manage approved cryptographic controls.',
  },
  {
    id: 'control-demo-nist-gv-oc-01',
    frameworkId: DEMO_IDS.frameworkSecondaryId,
    ref: 'GV.OC-01',
    title: 'Organizational context is established',
    description: 'Document mission, stakeholders, and risk context for cybersecurity.',
  },
  {
    id: 'control-demo-nist-gv-rm-01',
    frameworkId: DEMO_IDS.frameworkSecondaryId,
    ref: 'GV.RM-01',
    title: 'Risk management strategy is established',
    description: 'Define governance expectations and reporting paths for cyber risk.',
  },
  {
    id: 'control-demo-nist-id-am-01',
    frameworkId: DEMO_IDS.frameworkSecondaryId,
    ref: 'ID.AM-01',
    title: 'Inventory of assets is maintained',
    description: 'Maintain a current inventory of systems, services, and owners.',
  },
  {
    id: 'control-demo-nist-pr-aa-01',
    frameworkId: DEMO_IDS.frameworkSecondaryId,
    ref: 'PR.AA-01',
    title: 'Identities and credentials are managed',
    description: 'Provision, review, and revoke identities across core systems.',
  },
  {
    id: 'control-demo-nist-pr-ds-01',
    frameworkId: DEMO_IDS.frameworkSecondaryId,
    ref: 'PR.DS-01',
    title: 'Data at rest is protected',
    description: 'Protect stored data through encryption and access constraints.',
  },
  {
    id: 'control-demo-nist-de-cm-01',
    frameworkId: DEMO_IDS.frameworkSecondaryId,
    ref: 'DE.CM-01',
    title: 'Networks and services are monitored',
    description: 'Monitor services and key suppliers for anomalous behavior.',
  },
  {
    id: 'control-demo-nist-rs-ma-01',
    frameworkId: DEMO_IDS.frameworkSecondaryId,
    ref: 'RS.MA-01',
    title: 'Incidents are categorized and triaged',
    description: 'Route incidents through consistent triage and escalation paths.',
  },
  {
    id: 'control-demo-nist-rc-rp-01',
    frameworkId: DEMO_IDS.frameworkSecondaryId,
    ref: 'RC.RP-01',
    title: 'Recovery plan is executed and improved',
    description: 'Exercise recovery plans and feed lessons learned into operations.',
  },
];

async function requireCorePermissionFamily(
  ctx: WorkerRequestContext,
  readPermissions: string[],
  writePermissions: string[],
  domainLabel: string,
): Promise<Response | null> {
  const isReadOperation = ctx.request.method === 'GET' || ctx.request.method === 'HEAD';
  const requiredPermissions = isReadOperation ? readPermissions : writePermissions;
  const access = await requireAnyPermission(
    ctx,
    requiredPermissions,
    `${domainLabel} access is not permitted for the active identity.`,
  );

  return access instanceof Response ? access : null;
}

const DEMO_LIBRARIES = [
  {
    id: DEMO_IDS.libraryId,
    frameworkId: DEMO_IDS.frameworkId,
    name: 'ISO Governance Starter Pack',
    description:
      'A curated governance library for control reviews, baseline risk scoring, and assessment kick-off.',
    provider: 'CISO Assistant Library Exchange',
    packager: 'OpenAI Migration Demo',
    version: '2026.1',
    publicationDate: '2026-01-15T00:00:00.000Z',
    copyright: 'Demo content for local migration verification',
    hasUpdate: 1,
    dependencies: [],
    riskMatrices: [
      {
        id: 'matrix-demo-qualitative',
        name: '5x5 Qualitative Matrix',
        description: 'Default enterprise matrix used for qualitative residual and inherent scoring.',
        levels: [
          { label: 'Very Low', score: 1, tone: 'emerald' },
          { label: 'Low', score: 2, tone: 'lime' },
          { label: 'Medium', score: 3, tone: 'amber' },
          { label: 'High', score: 4, tone: 'orange' },
          { label: 'Very High', score: 5, tone: 'rose' },
        ],
      },
    ],
    threats: [
      {
        id: 'threat-demo-cloud-drift',
        refId: 'T-001',
        name: 'Cloud configuration drift',
        description: 'Baseline settings diverge from approved guardrails across production services.',
        severity: 'high',
      },
      {
        id: 'threat-demo-evidence-lag',
        refId: 'T-002',
        name: 'Evidence collection lag',
        description: 'Manual evidence requests delay quarterly review readiness and exception closure.',
        severity: 'medium',
      },
    ],
  },
  {
    id: DEMO_IDS.librarySecondaryId,
    frameworkId: DEMO_IDS.frameworkSecondaryId,
    name: 'Vendor Assurance Pack',
    description:
      'A supplier-focused library with recovery, vendor due diligence, and service monitoring references.',
    provider: 'CISO Assistant Library Exchange',
    packager: 'OpenAI Migration Demo',
    version: '2026.1',
    publicationDate: '2026-02-20T00:00:00.000Z',
    copyright: 'Demo content for local migration verification',
    hasUpdate: 0,
    dependencies: [{ id: DEMO_IDS.libraryId, name: 'ISO Governance Starter Pack' }],
    riskMatrices: [
      {
        id: 'matrix-demo-vendor',
        name: 'Vendor Resilience Matrix',
        description: 'Focused matrix for supplier outage, continuity, and dependency concentration risks.',
        levels: [
          { label: 'Minor', score: 1, tone: 'emerald' },
          { label: 'Moderate', score: 2, tone: 'lime' },
          { label: 'Material', score: 3, tone: 'amber' },
          { label: 'Major', score: 4, tone: 'orange' },
          { label: 'Severe', score: 5, tone: 'rose' },
        ],
      },
    ],
    threats: [
      {
        id: 'threat-demo-vendor-outage',
        refId: 'VT-001',
        name: 'Critical supplier outage',
        description: 'A key SaaS supplier outage disrupts control monitoring and audit evidence collection.',
        severity: 'high',
      },
      {
        id: 'threat-demo-third-party-access',
        refId: 'VT-002',
        name: 'Third-party privileged misuse',
        description: 'External support access is retained beyond approved maintenance windows.',
        severity: 'high',
      },
    ],
  },
];

async function getTenantCount(
  env: EnvBindings,
  table: string,
  tenantId: string,
  extraPredicate?: string,
  extraBindings: unknown[] = [],
): Promise<number> {
  const whereClause = extraPredicate ? ` AND ${extraPredicate}` : '';
  const row = await env.D1_MAIN.prepare(
    `SELECT COUNT(*) AS count FROM ${table} WHERE tenant_id = ?${whereClause}`,
  )
    .bind(tenantId, ...extraBindings)
    .first<{ count: number }>();

  return row?.count ?? 0;
}

async function buildOverviewCounts(env: EnvBindings, tenantId: string): Promise<OverviewCounts> {
  const [
    users,
    folders,
    domains,
    userGroups,
    roleAssignments,
    perimeters,
    riskAssessments,
    complianceAssessments,
    frameworks,
    entities,
    contracts,
    processings,
    rightRequests,
    dataBreaches,
    businessImpactAnalyses,
    riskRegisters,
    riskScenarios,
    conMonProfiles,
    conMonExecutions,
    evidenceSources,
    evidenceJobs,
    evidenceArtifacts,
    opsCounts,
  ] = await Promise.all([
    getTenantCount(env, 'users', tenantId),
    getTenantCount(env, 'folders', tenantId),
    getTenantCount(env, 'folders', tenantId, 'content_type = ?', ['domain']),
    getTenantCount(env, 'user_groups', tenantId),
    getTenantCount(env, 'role_assignments', tenantId),
    getTenantCount(env, 'perimeters', tenantId),
    getTenantCount(env, 'risk_assessments', tenantId),
    getTenantCount(env, 'compliance_assessments', tenantId),
    getTenantCount(env, 'frameworks', tenantId),
    getTenantCount(env, 'entities', tenantId),
    getTenantCount(env, 'contracts', tenantId),
    getTenantCount(env, 'processings', tenantId),
    getTenantCount(env, 'right_requests', tenantId),
    getTenantCount(env, 'data_breaches', tenantId),
    getTenantCount(env, 'business_impact_analyses', tenantId),
    getTenantCount(env, 'risk_registers', tenantId),
    getTenantCount(env, 'risk_scenarios', tenantId),
    getTenantCount(env, 'conmon_profiles', tenantId),
    getTenantCount(env, 'conmon_executions', tenantId),
    getTenantCount(env, 'evidence_sources', tenantId),
    getTenantCount(env, 'evidence_jobs', tenantId),
    getTenantCount(env, 'evidence_artifacts', tenantId),
    buildOpsOverviewCounts(env, tenantId),
  ]);

  return {
    users,
    folders,
    domains,
    userGroups,
    roleAssignments,
    perimeters,
    riskAssessments,
    complianceAssessments,
    frameworks,
    entities,
    contracts,
    processings,
    rightRequests,
    dataBreaches,
    businessImpactAnalyses,
    riskRegisters,
    riskScenarios,
    conMonProfiles,
    conMonExecutions,
    evidenceSources,
    evidenceJobs,
    evidenceArtifacts,
    reportExports: opsCounts.reportExports,
    chatSessions: opsCounts.chatSessions,
    importJobs: opsCounts.importJobs,
    portalAssignments: opsCounts.portalAssignments,
    ebiosStudies: opsCounts.ebiosStudies,
    quantitativeStudies: opsCounts.quantitativeStudies,
  };
}

function toFrameworkResponse(row: FrameworkRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    key: row.key,
    name: row.name,
    version: row.version,
    category: row.category,
    controlCount: row.control_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toControlResponse(row: ControlRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    frameworkId: row.framework_id,
    frameworkKey: row.framework_key,
    frameworkName: row.framework_name,
    ref: row.ref,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRiskRegisterResponse(row: RiskRegisterRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRiskScenarioResponse(row: RiskScenarioRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    registerId: row.register_id,
    registerName: row.register_name,
    title: row.title,
    description: row.description,
    likelihood: row.likelihood,
    impact: row.impact,
    inherentScore: row.inherent_score,
    residualScore: row.residual_score,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPerimeterResponse(row: PerimeterRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    folderId: row.folder_id,
    folderName: row.folder_name,
    refId: row.ref_id,
    name: row.name,
    description: row.description,
    lcStatus: row.lc_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRiskAssessmentResponse(row: RiskAssessmentRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    folderId: row.folder_id,
    folderName: row.folder_name,
    perimeterId: row.perimeter_id,
    perimeterName: row.perimeter_name,
    riskRegisterId: row.risk_register_id,
    riskRegisterName: row.risk_register_name,
    refId: row.ref_id,
    name: row.name,
    version: row.version,
    status: row.status,
    observation: row.observation,
    scenarioCount: row.scenario_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function deriveRiskActionPlanStatus(status: string) {
  switch (status) {
    case 'closed':
      return 'completed';
    case 'mitigating':
      return 'in_progress';
    case 'monitoring':
      return 'monitoring';
    default:
      return 'to_do';
  }
}

function deriveRiskActionPlanPriority(score: number | null | undefined) {
  if ((score ?? 0) >= 16) {
    return 'P1';
  }
  if ((score ?? 0) >= 10) {
    return 'P2';
  }
  return 'P3';
}

function deriveRiskActionPlanEffort(score: number | null | undefined) {
  if ((score ?? 0) >= 16) {
    return 'L';
  }
  if ((score ?? 0) >= 10) {
    return 'M';
  }
  return 'S';
}

function deriveRiskActionPlanAnnualCost(score: number | null | undefined) {
  if ((score ?? 0) >= 16) {
    return 45000;
  }
  if ((score ?? 0) >= 10) {
    return 18000;
  }
  return 7000;
}

function buildRiskActionPlanItem(row: RiskScenarioRow): RiskActionPlanItem {
  const residualScore = row.residual_score ?? row.inherent_score ?? 0;

  return {
    id: `treatment-${row.id}`,
    scenarioId: row.id,
    scenarioTitle: row.title,
    status: deriveRiskActionPlanStatus(row.status),
    priority: deriveRiskActionPlanPriority(residualScore),
    inherentScore: row.inherent_score ?? 0,
    residualScore,
    annualCost: deriveRiskActionPlanAnnualCost(residualScore),
    effort: deriveRiskActionPlanEffort(residualScore),
    recommendedAction:
      residualScore >= 16
        ? 'Launch an immediate treatment initiative with an accountable owner and near-term milestone.'
        : residualScore >= 10
          ? 'Schedule a mitigation sprint and reduce residual exposure before the next review cycle.'
          : 'Keep the scenario under managed review and validate that residual controls stay effective.',
    targetRoute: `/risk-scenarios`,
  };
}

function toComplianceAssessmentResponse(row: ComplianceAssessmentRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    folderId: row.folder_id,
    folderName: row.folder_name,
    perimeterId: row.perimeter_id,
    perimeterName: row.perimeter_name,
    frameworkId: row.framework_id,
    frameworkName: row.framework_name,
    refId: row.ref_id,
    name: row.name,
    version: row.version,
    status: row.status,
    observation: row.observation,
    controlsTotal: row.controls_total,
    controlsAssessed: row.controls_assessed,
    progressPercent: row.progress_percent,
    maturityScore: row.maturity_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toComplianceRequirementAssessmentResponse(row: ComplianceRequirementAssessmentRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    complianceAssessmentId: row.compliance_assessment_id,
    controlId: row.control_id,
    frameworkId: row.framework_id,
    frameworkName: row.framework_name,
    controlRef: row.control_ref,
    controlTitle: row.control_title,
    controlDescription: row.control_description,
    result: row.result,
    observation: row.observation,
    evidenceStatus: row.evidence_status,
    implementationScore: row.implementation_score,
    documentationScore: row.documentation_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeComplianceResult(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';
  return COMPLIANCE_RESULTS.has(normalized) ? normalized : 'not_assessed';
}

function normalizeEvidenceStatus(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';
  return EVIDENCE_STATUSES.has(normalized) ? normalized : 'missing';
}

function normalizeOptionalScore(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Number(value.toFixed(2))
    : null;
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

function toLibraryResponse(row: LibraryRow) {
  const dependencies = parseJsonArray<LibraryDependency>(row.dependencies_json);
  const riskMatrices = parseJsonArray<LibraryRiskMatrix>(row.risk_matrices_json);
  const threats = parseJsonArray<LibraryThreat>(row.threats_json);

  return {
    id: row.id,
    tenantId: row.tenant_id,
    frameworkId: row.framework_id,
    frameworkName: row.framework_name,
    frameworkKey: row.framework_key,
    name: row.name,
    description: row.description,
    provider: row.provider,
    packager: row.packager,
    version: row.version,
    publicationDate: row.publication_date,
    copyright: row.copyright,
    dependencies,
    riskMatrices,
    threats,
    hasUpdate: row.has_update === 1,
    objectsMeta: {
      frameworks: row.framework_id ? 1 : 0,
      referenceControls: row.control_count ?? 0,
      riskMatrices: riskMatrices.length,
      threats: threats.length,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAppliedControlResponse(row: AppliedControlRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    complianceAssessmentId: row.compliance_assessment_id,
    requirementAssessmentId: row.requirement_assessment_id,
    folderId: row.folder_id,
    folderName: row.folder_name,
    refId: row.ref_id,
    name: row.name,
    description: row.description,
    status: row.status,
    priority: row.priority,
    category: row.category,
    csfFunction: row.csf_function,
    ownerName: row.owner_name,
    eta: row.eta,
    expiryDate: row.expiry_date,
    controlImpact: row.control_impact,
    effort: row.effort,
    annualCost: row.annual_cost,
    notes: row.notes,
    isGenerated: row.is_generated === 1,
    requirementAssessment:
      row.requirement_assessment_id && row.requirement_ref && row.requirement_name
        ? {
            id: row.requirement_assessment_id,
            ref: row.requirement_ref,
            name: row.requirement_name,
            result: row.requirement_result,
          }
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function calculateDefaultCriticality(
  dependency: number,
  penetration: number,
  maturity: number,
  trust: number,
) {
  if (maturity <= 0 || trust <= 0) {
    return 0;
  }

  return Number(((dependency * penetration) / (maturity * trust)).toFixed(2));
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

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toEntityResponse(row: EntityRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    folderId: row.folder_id,
    folderName: row.folder_name,
    parentEntityId: row.parent_entity_id,
    parentEntityName: row.parent_entity_name,
    refId: row.ref_id,
    name: row.name,
    description: row.description,
    relationship: row.relationship,
    country: row.country,
    currency: row.currency,
    isActive: row.is_active === 1,
    defaultDependency: row.default_dependency,
    defaultPenetration: row.default_penetration,
    defaultMaturity: row.default_maturity,
    defaultTrust: row.default_trust,
    defaultCriticality: calculateDefaultCriticality(
      row.default_dependency,
      row.default_penetration,
      row.default_maturity,
      row.default_trust,
    ),
    mission: row.mission,
    referenceLink: row.reference_link,
    doraEntityType: row.dora_entity_type,
    doraEntityHierarchy: row.dora_entity_hierarchy,
    doraProviderPersonType: row.dora_provider_person_type,
    solutionCount: row.solution_count ?? 0,
    contractCount: row.contract_count ?? 0,
    assessmentCount: row.assessment_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSolutionResponse(row: SolutionRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    folderId: row.folder_id,
    folderName: row.folder_name,
    providerEntityId: row.provider_entity_id,
    providerEntityName: row.provider_entity_name,
    recipientEntityName: row.recipient_entity_name,
    refId: row.ref_id,
    name: row.name,
    description: row.description,
    isActive: row.is_active === 1,
    criticality: row.criticality,
    referenceLink: row.reference_link,
    doraIctServiceType: row.dora_ict_service_type,
    storageOfData: row.storage_of_data === 1,
    dataLocationStorage: row.data_location_storage,
    dataLocationProcessing: row.data_location_processing,
    doraDataSensitiveness: row.dora_data_sensitiveness,
    doraRelianceLevel: row.dora_reliance_level,
    doraSubstitutability: row.dora_substitutability,
    doraNonSubstitutabilityReason: row.dora_non_substitutability_reason,
    doraHasExitPlan: row.dora_has_exit_plan,
    doraReintegrationPossibility: row.dora_reintegration_possibility,
    doraDiscontinuingImpact: row.dora_discontinuing_impact,
    doraAlternativeProviders: row.dora_alternative_providers,
    assetRefs: normalizeStringArray(parseJsonArray<string>(row.asset_refs_json)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toContractResponse(row: ContractRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    folderId: row.folder_id,
    folderName: row.folder_name,
    providerEntityId: row.provider_entity_id,
    providerEntityName: row.provider_entity_name,
    beneficiaryEntityId: row.beneficiary_entity_id,
    beneficiaryEntityName: row.beneficiary_entity_name,
    refId: row.ref_id,
    name: row.name,
    description: row.description,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    currency: row.currency,
    annualExpense: row.annual_expense,
    isIntragroup: row.is_intragroup === 1,
    doraContractualArrangement: row.dora_contractual_arrangement,
    governingLawCountry: row.governing_law_country,
    noticePeriodEntity: row.notice_period_entity,
    noticePeriodProvider: row.notice_period_provider,
    doraExclude: row.dora_exclude === 1,
    solutions: normalizeNamedReferenceArray(parseJsonArray<NamedReference>(row.solutions_json)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEntityAssessmentResponse(row: EntityAssessmentRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    folderId: row.folder_id,
    folderName: row.folder_name,
    entityId: row.entity_id,
    entityName: row.entity_name,
    perimeterId: row.perimeter_id,
    perimeterName: row.perimeter_name,
    complianceAssessmentId: row.compliance_assessment_id,
    complianceAssessmentName: row.compliance_assessment_name,
    refId: row.ref_id,
    name: row.name,
    status: row.status,
    criticality: row.criticality,
    dependency: row.dependency,
    penetration: row.penetration,
    maturity: row.maturity,
    trust: row.trust,
    conclusion: row.conclusion,
    nextReviewOn: row.next_review_on,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toProcessingResponse(row: ProcessingRow) {
  const perimeters = normalizeNamedReferenceArray(parseJsonArray<NamedReference>(row.perimeters_json));
  const purposes = parseJsonArray<ProcessingPurpose>(row.purposes_json).map((item) => ({
    id: item.id,
    name: item.name,
    legalBasis: item.legalBasis,
    article9Condition: item.article9Condition ?? null,
  }));
  const personalData = parseJsonArray<ProcessingPersonalData>(row.personal_data_json).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    retention: item.retention ?? null,
    deletionPolicy: item.deletionPolicy ?? null,
    isSensitive: Boolean(item.isSensitive),
  }));
  const dataSubjects = parseJsonArray<ProcessingSubject>(row.data_subjects_json);
  const dataRecipients = parseJsonArray<ProcessingRecipient>(row.data_recipients_json);
  const dataContractors = parseJsonArray<ProcessingContractor>(row.data_contractors_json);
  const dataTransfers = parseJsonArray<ProcessingTransfer>(row.data_transfers_json);

  return {
    id: row.id,
    tenantId: row.tenant_id,
    folderId: row.folder_id,
    folderName: row.folder_name,
    refId: row.ref_id,
    name: row.name,
    description: row.description,
    status: row.status,
    informationChannel: row.information_channel,
    usageChannel: row.usage_channel,
    dpiaRequired: row.dpia_required === 1,
    dpiaReference: row.dpia_reference,
    hasSensitivePersonalData: row.has_sensitive_personal_data === 1,
    perimeters,
    purposes,
    personalData,
    dataSubjects,
    dataRecipients,
    dataContractors,
    dataTransfers,
    purposeCount: purposes.length,
    personalDataCount: personalData.length,
    subjectCount: dataSubjects.length,
    contractorCount: dataContractors.length,
    transferCount: dataTransfers.length,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRightRequestResponse(row: RightRequestRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    folderId: row.folder_id,
    folderName: row.folder_name,
    refId: row.ref_id,
    name: row.name,
    requestedOn: row.requested_on,
    dueDate: row.due_date,
    requestType: row.request_type,
    status: row.status,
    observation: row.observation,
    processings: normalizeNamedReferenceArray(parseJsonArray<NamedReference>(row.processings_json)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDataBreachResponse(row: DataBreachRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    folderId: row.folder_id,
    folderName: row.folder_name,
    refId: row.ref_id,
    name: row.name,
    discoveredOn: row.discovered_on,
    breachType: row.breach_type,
    riskLevel: row.risk_level,
    status: row.status,
    affectedSubjectsCount: row.affected_subjects_count,
    affectedPersonalDataCount: row.affected_personal_data_count,
    affectedProcessings: normalizeNamedReferenceArray(
      parseJsonArray<NamedReference>(row.affected_processings_json),
    ),
    authorityNotifiedOn: row.authority_notified_on,
    subjectsNotifiedOn: row.subjects_notified_on,
    potentialConsequences: row.potential_consequences,
    observation: row.observation,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatPointInTime(pointInTime: number) {
  const days = Math.floor(pointInTime / 86400);
  const hours = Math.floor((pointInTime % 86400) / 3600);
  const minutes = Math.floor((pointInTime % 3600) / 60);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${pointInTime}s`;
}

function computeBiaMetrics(assetAssessments: BiaAssetAssessment[]) {
  const total = assetAssessments.length;
  if (total === 0) {
    return {
      documentation: 0,
      tests: 0,
      objectives: 0,
    };
  }

  const documented = assetAssessments.filter((item) => item.recoveryDocumented).length;
  const tested = assetAssessments.filter((item) => item.recoveryTested).length;
  const objectives = assetAssessments.filter((item) => item.recoveryTargetsMet).length;

  return {
    documentation: Math.round((documented / total) * 100),
    tests: Math.round((tested / total) * 100),
    objectives: Math.round((objectives / total) * 100),
  };
}

function toBusinessImpactAnalysisResponse(row: BusinessImpactAnalysisRow) {
  const parsedRiskMatrix = (() => {
    try {
      const candidate = JSON.parse(row.risk_matrix_json) as RecoveryMatrix;
      return {
        levels: Array.isArray(candidate?.levels) ? candidate.levels : [],
      };
    } catch {
      return { levels: [] };
    }
  })();

  const assetAssessments = parseJsonArray<BiaAssetAssessment>(row.asset_assessments_json).map((asset) => ({
    ...asset,
    dependencies: normalizeStringArray(asset.dependencies),
    associatedControls: normalizeStringArray(asset.associatedControls),
    thresholds: Array.isArray(asset.thresholds)
      ? asset.thresholds.map((threshold) => ({
          ...threshold,
          pointInTime: threshold.pointInTime,
          humanPit: formatPointInTime(threshold.pointInTime),
        }))
      : [],
  }));
  const metrics = computeBiaMetrics(assetAssessments);

  return {
    id: row.id,
    tenantId: row.tenant_id,
    folderId: row.folder_id,
    folderName: row.folder_name,
    perimeterId: row.perimeter_id,
    perimeterName: row.perimeter_name,
    refId: row.ref_id,
    name: row.name,
    description: row.description,
    version: row.version,
    status: row.status,
    observation: row.observation,
    riskMatrixName: row.risk_matrix_name,
    riskMatrix: parsedRiskMatrix,
    assetAssessments,
    metrics,
    assetCount: assetAssessments.length,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeAppliedControlStatus(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';
  return APPLIED_CONTROL_STATUSES.has(normalized) ? normalized : 'to_do';
}

function normalizeAppliedControlPriority(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';
  return APPLIED_CONTROL_PRIORITIES.has(normalized) ? normalized : null;
}

function normalizeAppliedControlEffort(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';
  return APPLIED_CONTROL_EFFORTS.has(normalized) ? normalized : null;
}

function normalizeOptionalInteger(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
}

function normalizeOptionalAmount(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Number(value.toFixed(2))
    : null;
}

function deriveCsfFunction(controlRef: string, frameworkKey: string | null | undefined) {
  const ref = controlRef.toUpperCase();
  if (ref.startsWith('GV.')) return 'govern';
  if (ref.startsWith('ID.')) return 'identify';
  if (ref.startsWith('PR.')) return 'protect';
  if (ref.startsWith('DE.')) return 'detect';
  if (ref.startsWith('RS.')) return 'respond';
  if (ref.startsWith('RC.')) return 'recover';

  if (frameworkKey?.toUpperCase().includes('ISO')) {
    return 'govern';
  }

  return null;
}

function deriveAppliedControlStatusFromRequirement(result: string) {
  switch (result) {
    case 'compliant':
      return '--';
    case 'partially_compliant':
      return 'in_progress';
    case 'non_compliant':
      return 'to_do';
    case 'not_applicable':
      return 'deprecated';
    default:
      return 'to_do';
  }
}

function deriveAppliedControlPriorityFromRequirement(result: string) {
  switch (result) {
    case 'non_compliant':
      return 'P1';
    case 'partially_compliant':
      return 'P2';
    case 'not_assessed':
      return 'P3';
    case 'compliant':
      return 'P4';
    default:
      return null;
  }
}

function deriveAppliedControlImpactFromRequirement(result: string) {
  switch (result) {
    case 'non_compliant':
      return 5;
    case 'partially_compliant':
      return 4;
    case 'not_assessed':
      return 3;
    case 'compliant':
      return 1;
    default:
      return 2;
  }
}

function deriveAppliedControlEffortFromRequirement(result: string) {
  switch (result) {
    case 'non_compliant':
      return 'L';
    case 'partially_compliant':
      return 'M';
    case 'not_assessed':
      return 'S';
    case 'compliant':
      return 'XS';
    default:
      return 'S';
  }
}

function deriveAppliedControlCost(priority: string | null) {
  switch (priority) {
    case 'P1':
      return 45000;
    case 'P2':
      return 27500;
    case 'P3':
      return 14000;
    case 'P4':
      return 5000;
    default:
      return 8000;
  }
}

function futureDate(daysFromNow: number) {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
}

function buildFrameworkTree(controls: Array<ReturnType<typeof toControlResponse>>): FrameworkTreeNode[] {
  const rootNodes: FrameworkTreeNode[] = [];

  for (const control of controls) {
    const segments = control.ref
      .split('.')
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length === 0) {
      continue;
    }

    let currentLevel = rootNodes;
    let parentRef = '';

    segments.forEach((segment, index) => {
      const ref = parentRef ? `${parentRef}.${segment}` : segment;
      let node = currentLevel.find((candidate) => candidate.ref === ref);

      if (!node) {
        node = {
          id: `${control.frameworkId}:${ref}`,
          ref,
          title: index === segments.length - 1 ? control.title : `Section ${ref}`,
          description: index === segments.length - 1 ? control.description : null,
          assessable: index === segments.length - 1,
          controlId: index === segments.length - 1 ? control.id : null,
          children: [],
        };
        currentLevel.push(node);
        currentLevel.sort((left, right) => left.ref.localeCompare(right.ref));
      }

      if (index === segments.length - 1) {
        node.title = control.title;
        node.description = control.description;
        node.assessable = true;
        node.controlId = control.id;
      }

      currentLevel = node.children;
      parentRef = ref;
    });
  }

  return rootNodes;
}

async function listFrameworkControlRows(
  env: EnvBindings,
  tenantId: string,
  frameworkId: string,
): Promise<ControlRow[]> {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      control.id,
      control.tenant_id,
      control.framework_id,
      framework_item.key AS framework_key,
      framework_item.name AS framework_name,
      control.ref,
      control.title,
      control.description,
      control.created_at,
      control.updated_at
    FROM controls AS control
    INNER JOIN frameworks AS framework_item
      ON framework_item.id = control.framework_id
    WHERE control.tenant_id = ? AND control.framework_id = ?
    ORDER BY control.ref ASC
    `,
  )
    .bind(tenantId, frameworkId)
    .all<ControlRow>();

  return results;
}

async function recalculateComplianceAssessmentMetrics(
  env: EnvBindings,
  tenantId: string,
  assessmentId: string,
) {
  const summary = await env.D1_MAIN.prepare(
    `
    SELECT
      COUNT(*) AS controls_total,
      SUM(CASE WHEN result <> 'not_assessed' THEN 1 ELSE 0 END) AS controls_assessed,
      AVG(implementation_score) AS maturity_score
    FROM compliance_requirement_assessments
    WHERE tenant_id = ? AND compliance_assessment_id = ?
    `,
  )
    .bind(tenantId, assessmentId)
    .first<{
      controls_total: number | null;
      controls_assessed: number | null;
      maturity_score: number | null;
    }>();

  const controlsTotal = summary?.controls_total ?? 0;

  if (controlsTotal === 0) {
    return;
  }

  const controlsAssessed = summary?.controls_assessed ?? 0;
  const progressPercent = Math.min(Math.round((controlsAssessed / controlsTotal) * 100), 100);
  const maturityScore = normalizeOptionalScore(summary?.maturity_score ?? null);

  await env.D1_MAIN.prepare(
    `
    UPDATE compliance_assessments
    SET controls_total = ?,
        controls_assessed = ?,
        progress_percent = ?,
        maturity_score = ?,
        updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(controlsTotal, controlsAssessed, progressPercent, maturityScore, tenantId, assessmentId)
    .run();
}

async function ensureComplianceRequirementAssessments(
  env: EnvBindings,
  tenantId: string,
  assessmentId: string,
  frameworkId: string,
  options: {
    assessedCount?: number;
    seedForIndex?: (
      index: number,
      control: ControlRow,
    ) => {
      result?: string | null;
      observation?: string | null;
      evidenceStatus?: string | null;
      implementationScore?: number | null;
      documentationScore?: number | null;
    };
  } = {},
) {
  const controls = await listFrameworkControlRows(env, tenantId, frameworkId);

  for (const [index, control] of controls.entries()) {
    const fallbackSeed =
      index < (options.assessedCount ?? 0)
        ? {
            result: 'compliant',
            observation: 'Seeded baseline review completed for the migration workspace.',
            evidenceStatus: 'approved',
            implementationScore: 4,
            documentationScore: 4,
          }
        : {
            result: 'not_assessed',
            observation: null,
            evidenceStatus: 'missing',
            implementationScore: null,
            documentationScore: null,
          };
    const seeded = options.seedForIndex?.(index, control) ?? fallbackSeed;

    await env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO compliance_requirement_assessments (
        id,
        tenant_id,
        compliance_assessment_id,
        control_id,
        result,
        observation,
        evidence_status,
        implementation_score,
        documentation_score
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        crypto.randomUUID(),
        tenantId,
        assessmentId,
        control.id,
        normalizeComplianceResult(seeded.result),
        seeded.observation?.trim() || null,
        normalizeEvidenceStatus(seeded.evidenceStatus),
        normalizeOptionalScore(seeded.implementationScore),
        normalizeOptionalScore(seeded.documentationScore),
      )
      .run();
  }

  await recalculateComplianceAssessmentMetrics(env, tenantId, assessmentId);
  await ensureAppliedControlsForComplianceAssessment(env, tenantId, assessmentId);
}

async function listAppliedControlRows(
  env: EnvBindings,
  tenantId: string,
  options: {
    complianceAssessmentId?: string;
  } = {},
): Promise<AppliedControlRow[]> {
  const predicates = ['applied_control.tenant_id = ?'];
  const bindings: unknown[] = [tenantId];

  if (options.complianceAssessmentId) {
    predicates.push('applied_control.compliance_assessment_id = ?');
    bindings.push(options.complianceAssessmentId);
  }

  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      applied_control.id,
      applied_control.tenant_id,
      applied_control.compliance_assessment_id,
      applied_control.requirement_assessment_id,
      applied_control.folder_id,
      folder_item.name AS folder_name,
      applied_control.ref_id,
      applied_control.name,
      applied_control.description,
      applied_control.status,
      applied_control.priority,
      applied_control.category,
      applied_control.csf_function,
      applied_control.owner_name,
      applied_control.eta,
      applied_control.expiry_date,
      applied_control.control_impact,
      applied_control.effort,
      applied_control.annual_cost,
      applied_control.notes,
      applied_control.is_generated,
      requirement.result AS requirement_result,
      control.ref AS requirement_ref,
      control.title AS requirement_name,
      applied_control.created_at,
      applied_control.updated_at
    FROM applied_controls AS applied_control
    INNER JOIN folders AS folder_item
      ON folder_item.id = applied_control.folder_id
    LEFT JOIN compliance_requirement_assessments AS requirement
      ON requirement.id = applied_control.requirement_assessment_id
    LEFT JOIN controls AS control
      ON control.id = requirement.control_id
    WHERE ${predicates.join(' AND ')}
    ORDER BY folder_item.name ASC, applied_control.priority ASC, applied_control.updated_at DESC
    `,
  )
    .bind(...bindings)
    .all<AppliedControlRow>();

  return results;
}

async function syncGeneratedAppliedControlForRequirement(
  env: EnvBindings,
  tenantId: string,
  requirementAssessmentId: string,
) {
  const seed = await env.D1_MAIN.prepare(
    `
    SELECT
      requirement.id AS requirement_assessment_id,
      requirement.compliance_assessment_id,
      requirement.result,
      requirement.observation,
      assessment.folder_id,
      folder_item.name AS folder_name,
      framework_item.key AS framework_key,
      framework_item.category AS framework_category,
      control.ref AS control_ref,
      control.title AS control_title,
      control.description AS control_description,
      existing.id AS applied_control_id,
      existing.is_generated AS existing_is_generated
    FROM compliance_requirement_assessments AS requirement
    INNER JOIN compliance_assessments AS assessment
      ON assessment.id = requirement.compliance_assessment_id
    INNER JOIN folders AS folder_item
      ON folder_item.id = assessment.folder_id
    INNER JOIN controls AS control
      ON control.id = requirement.control_id
    INNER JOIN frameworks AS framework_item
      ON framework_item.id = control.framework_id
    LEFT JOIN applied_controls AS existing
      ON existing.requirement_assessment_id = requirement.id
    WHERE requirement.tenant_id = ? AND requirement.id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, requirementAssessmentId)
    .first<{
      requirement_assessment_id: string;
      compliance_assessment_id: string;
      result: string;
      observation: string | null;
      folder_id: string;
      folder_name: string;
      framework_key: string;
      framework_category: string | null;
      control_ref: string;
      control_title: string;
      control_description: string | null;
      applied_control_id: string | null;
      existing_is_generated: number | null;
    }>();

  if (!seed) {
    return;
  }

  if (seed.applied_control_id && seed.existing_is_generated === 0) {
    return;
  }

  const priority = deriveAppliedControlPriorityFromRequirement(seed.result);
  const status = deriveAppliedControlStatusFromRequirement(seed.result);
  const impact = deriveAppliedControlImpactFromRequirement(seed.result);
  const effort = deriveAppliedControlEffortFromRequirement(seed.result);
  const eta =
    priority === 'P1'
      ? futureDate(30)
      : priority === 'P2'
        ? futureDate(60)
        : priority === 'P3'
          ? futureDate(90)
          : futureDate(120);
  const ownerName = seed.folder_name.toLowerCase().includes('vendor')
    ? 'Vendor Owner'
    : 'Governance Analyst';
  const notes =
    seed.observation?.trim() ||
    (seed.result === 'compliant'
      ? 'Generated follow-up item retained for tracking evidence freshness.'
      : 'Generated from compliance review findings.');

  if (!seed.applied_control_id) {
    await env.D1_MAIN.prepare(
      `
      INSERT INTO applied_controls (
        id,
        tenant_id,
        compliance_assessment_id,
        requirement_assessment_id,
        folder_id,
        ref_id,
        name,
        description,
        status,
        priority,
        category,
        csf_function,
        owner_name,
        eta,
        expiry_date,
        control_impact,
        effort,
        annual_cost,
        notes,
        is_generated
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
    )
      .bind(
        crypto.randomUUID(),
        tenantId,
        seed.compliance_assessment_id,
        seed.requirement_assessment_id,
        seed.folder_id,
        seed.control_ref,
        seed.control_title,
        seed.control_description,
        status,
        priority,
        seed.framework_category || 'security',
        deriveCsfFunction(seed.control_ref, seed.framework_key),
        ownerName,
        eta,
        futureDate(365),
        impact,
        effort,
        deriveAppliedControlCost(priority),
        notes,
      )
      .run();

    return;
  }

  await env.D1_MAIN.prepare(
    `
    UPDATE applied_controls
    SET ref_id = ?,
        name = ?,
        description = ?,
        status = ?,
        priority = ?,
        category = ?,
        csf_function = ?,
        owner_name = ?,
        eta = ?,
        expiry_date = ?,
        control_impact = ?,
        effort = ?,
        annual_cost = ?,
        notes = ?,
        updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(
      seed.control_ref,
      seed.control_title,
      seed.control_description,
      status,
      priority,
      seed.framework_category || 'security',
      deriveCsfFunction(seed.control_ref, seed.framework_key),
      ownerName,
      eta,
      futureDate(365),
      impact,
      effort,
      deriveAppliedControlCost(priority),
      notes,
      tenantId,
      seed.applied_control_id,
    )
    .run();
}

async function ensureAppliedControlsForComplianceAssessment(
  env: EnvBindings,
  tenantId: string,
  assessmentId: string,
) {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT id
    FROM compliance_requirement_assessments
    WHERE tenant_id = ? AND compliance_assessment_id = ?
    ORDER BY created_at ASC
    `,
  )
    .bind(tenantId, assessmentId)
    .all<{ id: string }>();

  for (const requirement of results) {
    await syncGeneratedAppliedControlForRequirement(env, tenantId, requirement.id);
  }
}

async function seedDemoLibraries(env: EnvBindings) {
  for (const library of DEMO_LIBRARIES) {
    await env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO libraries (
        id,
        tenant_id,
        framework_id,
        name,
        description,
        provider,
        packager,
        version,
        publication_date,
        copyright,
        dependencies_json,
        risk_matrices_json,
        threats_json,
        has_update
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        library.id,
        DEMO_IDS.tenantId,
        library.frameworkId,
        library.name,
        library.description,
        library.provider,
        library.packager,
        library.version,
        library.publicationDate,
        library.copyright,
        JSON.stringify(library.dependencies),
        JSON.stringify(library.riskMatrices),
        JSON.stringify(library.threats),
        library.hasUpdate,
      )
      .run();
  }
}

async function seedDemoTprm(env: EnvBindings) {
  const contractsPrimarySolution = JSON.stringify([
    { id: DEMO_IDS.solutionId, name: 'Northwind IAM Platform' },
  ]);
  const contractsSecondarySolution = JSON.stringify([
    { id: DEMO_IDS.solutionSecondaryId, name: 'Bluefin Recovery Hotline' },
  ]);

  const statements = [
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO entities (
        id,
        tenant_id,
        folder_id,
        parent_entity_id,
        ref_id,
        name,
        description,
        relationship,
        country,
        currency,
        is_active,
        default_dependency,
        default_penetration,
        default_maturity,
        default_trust,
        mission,
        reference_link,
        dora_entity_type,
        dora_entity_hierarchy,
        dora_provider_person_type
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.entityMainId,
      DEMO_IDS.tenantId,
      DEMO_IDS.governanceFolderId,
      null,
      'ENTITY-MAIN-001',
      'Nimbus Financial',
      'Primary financial entity used as the recipient for local third-party oversight demos.',
      'main_entity',
      'US',
      'USD',
      1,
      4,
      4,
      3,
      3,
      'Operate regulated payment and customer identity services.',
      'https://example.com/nimbus-financial',
      'financial_entity',
      'parent',
      null,
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO entities (
        id,
        tenant_id,
        folder_id,
        parent_entity_id,
        ref_id,
        name,
        description,
        relationship,
        country,
        currency,
        is_active,
        default_dependency,
        default_penetration,
        default_maturity,
        default_trust,
        mission,
        reference_link,
        dora_entity_type,
        dora_entity_hierarchy,
        dora_provider_person_type
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.entityVendorId,
      DEMO_IDS.tenantId,
      DEMO_IDS.vendorFolderId,
      null,
      'ENTITY-VENDOR-001',
      'Northwind Cloud',
      'Critical identity and audit-log provider supporting core enterprise access services.',
      'ict_provider',
      'IE',
      'EUR',
      1,
      4,
      4,
      2,
      2,
      'Deliver managed identity and access services for regulated operators.',
      'https://example.com/northwind-cloud',
      'ict_third_party_provider',
      'external',
      'legal_person',
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO entities (
        id,
        tenant_id,
        folder_id,
        parent_entity_id,
        ref_id,
        name,
        description,
        relationship,
        country,
        currency,
        is_active,
        default_dependency,
        default_penetration,
        default_maturity,
        default_trust,
        mission,
        reference_link,
        dora_entity_type,
        dora_entity_hierarchy,
        dora_provider_person_type
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.entityResilienceId,
      DEMO_IDS.tenantId,
      DEMO_IDS.vendorFolderId,
      null,
      'ENTITY-VENDOR-002',
      'Bluefin Recovery Services',
      'Specialized disaster-recovery and crisis escalation provider for vendor continuity.',
      'resilience_partner',
      'GB',
      'GBP',
      1,
      3,
      3,
      3,
      3,
      'Support service restoration planning and hotline operations.',
      'https://example.com/bluefin-recovery',
      'ict_third_party_provider',
      'external',
      'legal_person',
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO solutions (
        id,
        tenant_id,
        folder_id,
        provider_entity_id,
        recipient_entity_name,
        ref_id,
        name,
        description,
        is_active,
        criticality,
        reference_link,
        dora_ict_service_type,
        storage_of_data,
        data_location_storage,
        data_location_processing,
        dora_data_sensitiveness,
        dora_reliance_level,
        dora_alternative_providers,
        asset_refs_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.solutionId,
      DEMO_IDS.tenantId,
      DEMO_IDS.vendorFolderId,
      DEMO_IDS.entityVendorId,
      'Nimbus Financial',
      'SOL-IAM-001',
      'Northwind IAM Platform',
      'Managed identity, SSO, and audit-log retention service used across enterprise domains.',
      1,
      5,
      'https://example.com/northwind-cloud/iam',
      'identity_and_access_management',
      1,
      'IE',
      'IE',
      'high',
      'high',
      'Bluefin Recovery Services',
      JSON.stringify(['Identity Platform', 'Privileged Access Vault']),
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO solutions (
        id,
        tenant_id,
        folder_id,
        provider_entity_id,
        recipient_entity_name,
        ref_id,
        name,
        description,
        is_active,
        criticality,
        reference_link,
        dora_ict_service_type,
        storage_of_data,
        data_location_storage,
        data_location_processing,
        dora_data_sensitiveness,
        dora_reliance_level,
        dora_alternative_providers,
        asset_refs_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.solutionSecondaryId,
      DEMO_IDS.tenantId,
      DEMO_IDS.vendorFolderId,
      DEMO_IDS.entityResilienceId,
      'Nimbus Financial',
      'SOL-DR-001',
      'Bluefin Recovery Hotline',
      'Hotline and escalation service for severe outage coordination and restoration tracking.',
      1,
      4,
      'https://example.com/bluefin-recovery/hotline',
      'business_continuity_support',
      0,
      null,
      'GB',
      'medium',
      'medium',
      'Secondary crisis communications partner',
      JSON.stringify(['Recovery Hotline', 'Service Desk Escalation']),
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO contracts (
        id,
        tenant_id,
        folder_id,
        provider_entity_id,
        beneficiary_entity_id,
        ref_id,
        name,
        description,
        status,
        start_date,
        end_date,
        currency,
        annual_expense,
        is_intragroup,
        dora_contractual_arrangement,
        governing_law_country,
        notice_period_entity,
        notice_period_provider,
        dora_exclude,
        solutions_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.contractId,
      DEMO_IDS.tenantId,
      DEMO_IDS.vendorFolderId,
      DEMO_IDS.entityVendorId,
      DEMO_IDS.entityMainId,
      'CON-IAM-2026',
      'Northwind IAM Master Services Agreement',
      'Primary identity and access contract covering workforce authentication, audit logging, and support.',
      'active',
      '2025-01-01',
      '2027-12-31',
      'USD',
      185000,
      0,
      'master_service_agreement',
      'US',
      45,
      90,
      0,
      contractsPrimarySolution,
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO contracts (
        id,
        tenant_id,
        folder_id,
        provider_entity_id,
        beneficiary_entity_id,
        ref_id,
        name,
        description,
        status,
        start_date,
        end_date,
        currency,
        annual_expense,
        is_intragroup,
        dora_contractual_arrangement,
        governing_law_country,
        notice_period_entity,
        notice_period_provider,
        dora_exclude,
        solutions_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.contractSecondaryId,
      DEMO_IDS.tenantId,
      DEMO_IDS.vendorFolderId,
      DEMO_IDS.entityResilienceId,
      DEMO_IDS.entityMainId,
      'CON-DR-2026',
      'Bluefin Recovery Retainer',
      'Continuity retainer for severe incident coordination and recovery hotline coverage.',
      'active',
      '2026-01-01',
      '2026-12-31',
      'USD',
      62000,
      0,
      'retainer',
      'GB',
      30,
      60,
      0,
      contractsSecondarySolution,
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO entity_assessments (
        id,
        tenant_id,
        folder_id,
        entity_id,
        perimeter_id,
        compliance_assessment_id,
        ref_id,
        name,
        status,
        criticality,
        dependency,
        penetration,
        maturity,
        trust,
        conclusion,
        next_review_on,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.entityAssessmentId,
      DEMO_IDS.tenantId,
      DEMO_IDS.vendorFolderId,
      DEMO_IDS.entityVendorId,
      DEMO_IDS.perimeterSecondaryId,
      DEMO_IDS.complianceAssessmentSecondaryId,
      'EA-TPRM-001',
      'Northwind Annual Review',
      'in_review',
      4,
      4,
      4,
      2,
      2,
      'warning',
      '2026-09-30',
      'Evidence quality is strong, but exit-plan maturity and privileged support access remain open review items.',
    ),
  ];

  for (const statement of statements) {
    await statement.run();
  }
}

async function seedDemoPrivacy(env: EnvBindings) {
  const workforcePerimeters = JSON.stringify([
    { id: DEMO_IDS.perimeterId, name: 'Enterprise Identity Perimeter' },
  ]);
  const customerPerimeters = JSON.stringify([
    { id: DEMO_IDS.perimeterId, name: 'Enterprise Identity Perimeter' },
    { id: DEMO_IDS.perimeterSecondaryId, name: 'Vendor Service Perimeter' },
  ]);

  const workforcePurposes = JSON.stringify([
    {
      id: 'purpose-demo-workforce-1',
      name: 'Provision workforce accounts',
      legalBasis: 'privacy_contract',
      article9Condition: null,
    },
    {
      id: 'purpose-demo-workforce-2',
      name: 'Audit privileged access',
      legalBasis: 'privacy_legal_obligation',
      article9Condition: null,
    },
  ]);
  const workforcePersonalData = JSON.stringify([
    {
      id: 'pd-demo-workforce-1',
      name: 'Employee directory profile',
      category: 'privacy_basic_identity',
      retention: '7 years after departure',
      deletionPolicy: 'privacy_manual_review_deletion',
      isSensitive: false,
    },
    {
      id: 'pd-demo-workforce-2',
      name: 'MFA recovery contact',
      category: 'privacy_phone_number',
      retention: 'Active employment',
      deletionPolicy: 'privacy_automatic_deletion',
      isSensitive: false,
    },
  ]);
  const workforceSubjects = JSON.stringify([
    { id: 'subject-demo-workforce-1', name: 'Employees', category: 'privacy_employee' },
  ]);
  const workforceRecipients = JSON.stringify([
    {
      id: 'recipient-demo-workforce-1',
      name: 'Identity Operations Team',
      category: 'privacy_internal_team',
    },
  ]);
  const workforceContractors = JSON.stringify([
    {
      id: 'contractor-demo-workforce-1',
      name: 'Northwind Cloud',
      relationshipType: 'privacy_data_processor',
      country: 'IE',
      documentationLink: 'https://example.com/northwind-cloud/dpa',
      entity: { id: DEMO_IDS.entityVendorId, name: 'Northwind Cloud' },
    },
  ]);
  const workforceTransfers = JSON.stringify([
    {
      id: 'transfer-demo-workforce-1',
      name: 'EU identity log processing',
      country: 'IE',
      transferMechanism: 'privacy_adequacy_decision',
      guarantees: 'Regional storage and role-based support access.',
      documentationLink: 'https://example.com/northwind-cloud/privacy',
      entity: { id: DEMO_IDS.entityVendorId, name: 'Northwind Cloud' },
    },
  ]);

  const customerPurposes = JSON.stringify([
    {
      id: 'purpose-demo-customer-1',
      name: 'Customer due diligence',
      legalBasis: 'privacy_legal_obligation',
      article9Condition: null,
    },
    {
      id: 'purpose-demo-customer-2',
      name: 'Fraud monitoring',
      legalBasis: 'privacy_legitimate_interests',
      article9Condition: null,
    },
  ]);
  const customerPersonalData = JSON.stringify([
    {
      id: 'pd-demo-customer-1',
      name: 'Government identifier',
      category: 'privacy_government_identifiers',
      retention: '5 years after account closure',
      deletionPolicy: 'privacy_manual_review_deletion',
      isSensitive: false,
    },
    {
      id: 'pd-demo-customer-2',
      name: 'Biometric selfie match',
      category: 'privacy_biometric_data',
      retention: '90 days',
      deletionPolicy: 'privacy_automatic_deletion',
      isSensitive: true,
    },
  ]);
  const customerSubjects = JSON.stringify([
    { id: 'subject-demo-customer-1', name: 'Retail customers', category: 'privacy_customer' },
    { id: 'subject-demo-customer-2', name: 'Prospects', category: 'privacy_prospect' },
  ]);
  const customerRecipients = JSON.stringify([
    {
      id: 'recipient-demo-customer-1',
      name: 'Fraud analytics provider',
      category: 'privacy_analytics_provider',
    },
    {
      id: 'recipient-demo-customer-2',
      name: 'Regulatory authority',
      category: 'privacy_regulatory_authority',
    },
  ]);
  const customerContractors = JSON.stringify([
    {
      id: 'contractor-demo-customer-1',
      name: 'Northwind Cloud',
      relationshipType: 'privacy_data_processor',
      country: 'IE',
      documentationLink: 'https://example.com/northwind-cloud/dpa',
      entity: { id: DEMO_IDS.entityVendorId, name: 'Northwind Cloud' },
    },
    {
      id: 'contractor-demo-customer-2',
      name: 'Bluefin Recovery Services',
      relationshipType: 'privacy_sub_processor',
      country: 'GB',
      documentationLink: 'https://example.com/bluefin-recovery/privacy',
      entity: { id: DEMO_IDS.entityResilienceId, name: 'Bluefin Recovery Services' },
    },
  ]);
  const customerTransfers = JSON.stringify([
    {
      id: 'transfer-demo-customer-1',
      name: 'Support escalation transfer',
      country: 'GB',
      transferMechanism: 'privacy_appropriate_safeguards',
      guarantees: 'Contractual clauses and restricted incident access.',
      documentationLink: 'https://example.com/bluefin-recovery/scc',
      entity: { id: DEMO_IDS.entityResilienceId, name: 'Bluefin Recovery Services' },
    },
  ]);

  const processingReferences = JSON.stringify([
    { id: DEMO_IDS.processingSecondaryId, name: 'Customer Due Diligence Workflow' },
  ]);
  const breachProcessingReferences = JSON.stringify([
    { id: DEMO_IDS.processingId, name: 'Workforce Identity Lifecycle' },
  ]);

  const statements = [
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO processings (
        id,
        tenant_id,
        folder_id,
        ref_id,
        name,
        description,
        status,
        information_channel,
        usage_channel,
        dpia_required,
        dpia_reference,
        has_sensitive_personal_data,
        perimeters_json,
        purposes_json,
        personal_data_json,
        data_subjects_json,
        data_recipients_json,
        data_contractors_json,
        data_transfers_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.processingId,
      DEMO_IDS.tenantId,
      DEMO_IDS.governanceFolderId,
      'PROC-WORKFORCE-001',
      'Workforce Identity Lifecycle',
      'Provision, maintain, and remove workforce identities for corporate access services.',
      'privacy_in_review',
      'HR onboarding and manager updates',
      'Identity administration and access certification',
      0,
      null,
      0,
      workforcePerimeters,
      workforcePurposes,
      workforcePersonalData,
      workforceSubjects,
      workforceRecipients,
      workforceContractors,
      workforceTransfers,
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO processings (
        id,
        tenant_id,
        folder_id,
        ref_id,
        name,
        description,
        status,
        information_channel,
        usage_channel,
        dpia_required,
        dpia_reference,
        has_sensitive_personal_data,
        perimeters_json,
        purposes_json,
        personal_data_json,
        data_subjects_json,
        data_recipients_json,
        data_contractors_json,
        data_transfers_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.processingSecondaryId,
      DEMO_IDS.tenantId,
      DEMO_IDS.governanceFolderId,
      'PROC-CUSTOMER-001',
      'Customer Due Diligence Workflow',
      'Collect and review onboarding data, sanctions checks, and account risk signals for regulated customers.',
      'privacy_approved',
      'Customer application portal',
      'AML and fraud review operations',
      1,
      'DPIA-CDD-2026',
      1,
      customerPerimeters,
      customerPurposes,
      customerPersonalData,
      customerSubjects,
      customerRecipients,
      customerContractors,
      customerTransfers,
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO right_requests (
        id,
        tenant_id,
        folder_id,
        ref_id,
        name,
        requested_on,
        due_date,
        request_type,
        status,
        observation,
        processings_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.rightRequestId,
      DEMO_IDS.tenantId,
      DEMO_IDS.governanceFolderId,
      'RR-ACCESS-001',
      'Retail customer access request',
      '2026-03-10',
      '2026-04-09',
      'access',
      'in_progress',
      'Identity verification complete; waiting on fraud-case review to bundle related profile history.',
      processingReferences,
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO data_breaches (
        id,
        tenant_id,
        folder_id,
        ref_id,
        name,
        discovered_on,
        breach_type,
        risk_level,
        status,
        affected_subjects_count,
        affected_personal_data_count,
        affected_processings_json,
        authority_notified_on,
        subjects_notified_on,
        potential_consequences,
        observation
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.dataBreachId,
      DEMO_IDS.tenantId,
      DEMO_IDS.governanceFolderId,
      'DB-PAYROLL-001',
      'Misrouted workforce export',
      '2026-03-04T14:35:00.000Z',
      'privacy_unauthorized_disclosure',
      'privacy_risk',
      'privacy_under_investigation',
      84,
      168,
      breachProcessingReferences,
      '2026-03-05T08:00:00.000Z',
      null,
      'Risk of temporary exposure of employee contact and job-profile data to an unauthorized internal mailbox.',
      'Mailbox access was revoked and the export workflow is under corrective review.',
    ),
  ];

  for (const statement of statements) {
    await statement.run();
  }
}

async function seedDemoResilience(env: EnvBindings) {
  const enterpriseRiskMatrix = JSON.stringify({
    levels: [
      { label: 'Negligible', score: 1, tone: 'emerald' },
      { label: 'Tolerable', score: 2, tone: 'lime' },
      { label: 'Material', score: 3, tone: 'amber' },
      { label: 'Severe', score: 4, tone: 'orange' },
      { label: 'Critical', score: 5, tone: 'rose' },
    ],
  });
  const vendorRiskMatrix = JSON.stringify({
    levels: [
      { label: 'Low', score: 1, tone: 'emerald' },
      { label: 'Guarded', score: 2, tone: 'lime' },
      { label: 'Elevated', score: 3, tone: 'amber' },
      { label: 'High', score: 4, tone: 'orange' },
      { label: 'Extreme', score: 5, tone: 'rose' },
    ],
  });

  const enterpriseAssets = JSON.stringify([
    {
      id: 'bia-asset-demo-1',
      assetName: 'Identity Platform',
      folderName: 'Corporate Governance',
      dependencies: ['HRIS', 'Northwind IAM Platform'],
      associatedControls: ['8.5', 'PR.AA-01'],
      recoveryDocumented: true,
      recoveryTested: false,
      recoveryTargetsMet: false,
      observation:
        'Runbook exists, but failover identity synchronization has not been exercised in the last quarter.',
      thresholds: [
        {
          pointInTime: 3600,
          label: 'Tolerable',
          hexColor: '#84cc16',
          qualiImpact: 2,
          quantiImpact: 12,
          quantiImpactUnit: 'people',
          justification: 'Initial support impact limited to workforce login delays.',
        },
        {
          pointInTime: 14400,
          label: 'Severe',
          hexColor: '#f97316',
          qualiImpact: 4,
          quantiImpact: 150,
          quantiImpactUnit: 'people',
          justification: 'Extended outage blocks privileged recovery and onboarding.',
        },
      ],
    },
    {
      id: 'bia-asset-demo-2',
      assetName: 'Customer Onboarding API',
      folderName: 'Corporate Governance',
      dependencies: ['Fraud Screening', 'KYC Workflow'],
      associatedControls: ['5.23', 'DE.CM-01'],
      recoveryDocumented: true,
      recoveryTested: true,
      recoveryTargetsMet: true,
      observation: 'Recent test showed the active-active deployment meets the 2-hour objective.',
      thresholds: [
        {
          pointInTime: 7200,
          label: 'Material',
          hexColor: '#f59e0b',
          qualiImpact: 3,
          quantiImpact: 900,
          quantiImpactUnit: 'records',
          justification: 'Backlog begins affecting onboarding SLAs after 2 hours.',
        },
      ],
    },
    {
      id: 'bia-asset-demo-3',
      assetName: 'Privileged Access Vault',
      folderName: 'Corporate Governance',
      dependencies: ['Identity Platform', 'Recovery Hotline'],
      associatedControls: ['8.2', 'RC.RP-01'],
      recoveryDocumented: false,
      recoveryTested: false,
      recoveryTargetsMet: false,
      observation: 'Fallback credentials are maintained manually and need periodic validation.',
      thresholds: [
        {
          pointInTime: 1800,
          label: 'Material',
          hexColor: '#f59e0b',
          qualiImpact: 3,
          quantiImpact: 8,
          quantiImpactUnit: 'people',
          justification: 'Privileged operations begin queueing quickly during vault disruption.',
        },
        {
          pointInTime: 21600,
          label: 'Critical',
          hexColor: '#ef4444',
          qualiImpact: 5,
          quantiImpact: 1,
          quantiImpactUnit: 'gu',
          justification: 'Extended outage blocks coordinated recovery across services.',
        },
      ],
    },
  ]);

  const vendorAssets = JSON.stringify([
    {
      id: 'bia-asset-demo-vendor-1',
      assetName: 'Vendor Support Portal',
      folderName: 'Vendor Assurance',
      dependencies: ['Northwind IAM Platform'],
      associatedControls: ['GV.RM-01'],
      recoveryDocumented: true,
      recoveryTested: false,
      recoveryTargetsMet: false,
      observation: 'Portal failover is documented but depends on vendor-operated DNS recovery.',
      thresholds: [
        {
          pointInTime: 14400,
          label: 'Elevated',
          hexColor: '#f59e0b',
          qualiImpact: 3,
          quantiImpact: 4,
          quantiImpactUnit: 'man_hours',
          justification: 'Vendor coordination delays become visible after 4 hours.',
        },
      ],
    },
    {
      id: 'bia-asset-demo-vendor-2',
      assetName: 'Recovery Hotline',
      folderName: 'Vendor Assurance',
      dependencies: ['Bluefin Recovery Hotline'],
      associatedControls: ['RS.MA-01'],
      recoveryDocumented: true,
      recoveryTested: true,
      recoveryTargetsMet: true,
      observation: 'The annual crisis-tabletop confirmed hotline activation within the target window.',
      thresholds: [
        {
          pointInTime: 3600,
          label: 'Guarded',
          hexColor: '#84cc16',
          qualiImpact: 2,
          quantiImpact: 1,
          quantiImpactUnit: 'gu',
          justification: 'Hotline delay creates a manageable escalation bottleneck.',
        },
      ],
    },
  ]);

  const statements = [
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO business_impact_analyses (
        id,
        tenant_id,
        folder_id,
        perimeter_id,
        ref_id,
        name,
        description,
        version,
        status,
        observation,
        risk_matrix_name,
        risk_matrix_json,
        asset_assessments_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.businessImpactAnalysisId,
      DEMO_IDS.tenantId,
      DEMO_IDS.governanceFolderId,
      DEMO_IDS.perimeterId,
      'BIA-ENT-001',
      'Enterprise Service Recovery Study',
      'Business impact analysis covering identity, onboarding, and privileged recovery services.',
      '2026.1',
      'in_review',
      'Recovery objectives need one more privileged-access recovery exercise before full approval.',
      'Enterprise Recovery Matrix',
      enterpriseRiskMatrix,
      enterpriseAssets,
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO business_impact_analyses (
        id,
        tenant_id,
        folder_id,
        perimeter_id,
        ref_id,
        name,
        description,
        version,
        status,
        observation,
        risk_matrix_name,
        risk_matrix_json,
        asset_assessments_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.businessImpactAnalysisSecondaryId,
      DEMO_IDS.tenantId,
      DEMO_IDS.vendorFolderId,
      DEMO_IDS.perimeterSecondaryId,
      'BIA-VENDOR-001',
      'Vendor Continuity Recovery Study',
      'Business impact analysis focused on critical vendor continuity and escalation channels.',
      '2026.1',
      'planned',
      'Vendor tabletop is complete; dependency substitution planning remains open.',
      'Vendor Continuity Matrix',
      vendorRiskMatrix,
      vendorAssets,
    ),
  ];

  for (const statement of statements) {
    await statement.run();
  }
}

async function seedDemoFrameworkControls(env: EnvBindings) {
  for (const control of DEMO_FRAMEWORK_CONTROLS) {
    await env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO controls (id, tenant_id, framework_id, ref, title, description)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        control.id,
        DEMO_IDS.tenantId,
        control.frameworkId,
        control.ref,
        control.title,
        control.description,
      )
      .run();
  }
}

async function seedDemoComplianceRequirements(env: EnvBindings) {
  const primaryScores = [4.2, 4.4, 4.1, 4.0, 3.8, 3.9, 2.8, 3.1];
  const secondaryScores = [3.0, 2.2];

  await ensureComplianceRequirementAssessments(env, DEMO_IDS.tenantId, DEMO_IDS.complianceAssessmentId, DEMO_IDS.frameworkId, {
    seedForIndex: (index) => {
      if (index < 6) {
        return {
          result: 'compliant',
          observation: 'Demo requirement assessed as compliant.',
          evidenceStatus: 'approved',
          implementationScore: primaryScores[index],
          documentationScore: primaryScores[index] - 0.1,
        };
      }

      if (index < 8) {
        return {
          result: 'partially_compliant',
          observation: 'Demo requirement needs a follow-up evidence refresh.',
          evidenceStatus: 'in_review',
          implementationScore: primaryScores[index],
          documentationScore: primaryScores[index] - 0.2,
        };
      }

      return {
        result: 'not_assessed',
        observation: null,
        evidenceStatus: 'missing',
        implementationScore: null,
        documentationScore: null,
      };
    },
  });

  await ensureComplianceRequirementAssessments(
    env,
    DEMO_IDS.tenantId,
    DEMO_IDS.complianceAssessmentSecondaryId,
    DEMO_IDS.frameworkSecondaryId,
    {
      seedForIndex: (index) => {
        if (index === 0) {
          return {
            result: 'partially_compliant',
            observation: 'Supplier review identified a documentation gap.',
            evidenceStatus: 'in_review',
            implementationScore: secondaryScores[index],
            documentationScore: secondaryScores[index] - 0.2,
          };
        }

        if (index === 1) {
          return {
            result: 'non_compliant',
            observation: 'Control is not yet implemented for the supplier perimeter.',
            evidenceStatus: 'missing',
            implementationScore: secondaryScores[index],
            documentationScore: secondaryScores[index] - 0.3,
          };
        }

        return {
          result: 'not_assessed',
          observation: null,
          evidenceStatus: 'missing',
          implementationScore: null,
          documentationScore: null,
        };
      },
    },
  );
}

async function bootstrapDemoTenant(env: EnvBindings) {
  const now = new Date().toISOString();

  // Seed IAM first so folders and principals exist before domain records reference them.
  await seedDemoIamWorkspace(env);

  const statements = [
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO tenants (id, slug, name)
      VALUES (?, ?, ?)
      `,
    ).bind(DEMO_IDS.tenantId, 'demo', 'CISO Assistant Demo Tenant'),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO users (id, tenant_id, email, display_name, locale, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
      `,
    ).bind(
      DEMO_IDS.userId,
      DEMO_IDS.tenantId,
      'demo@ciso-assistant.local',
      'Demo Analyst',
      'en',
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO frameworks (id, tenant_id, key, name, version, category)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.frameworkId,
      DEMO_IDS.tenantId,
      'ISO27001_2022',
      'ISO 27001:2022',
      '2022',
      'security',
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO frameworks (id, tenant_id, key, name, version, category)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.frameworkSecondaryId,
      DEMO_IDS.tenantId,
      'NIST_CSF_2_0',
      'NIST Cybersecurity Framework',
      '2.0',
      'security',
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO risk_registers (id, tenant_id, name, description)
      VALUES (?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.registerId,
      DEMO_IDS.tenantId,
      'Enterprise Risk Register',
      'Seeded register for the Workers migration baseline',
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO risk_registers (id, tenant_id, name, description)
      VALUES (?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.registerSecondaryId,
      DEMO_IDS.tenantId,
      'Vendor Risk Register',
      'Third-party and supplier exposure tracked for the demo workspace',
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO perimeters (id, tenant_id, folder_id, ref_id, name, description, lc_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.perimeterId,
      DEMO_IDS.tenantId,
      'folder-governance-demo',
      'PERIM-ENT',
      'Enterprise Perimeter',
      'Primary operating perimeter for governance, risk, and assessment workflows.',
      'in_prod',
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO perimeters (id, tenant_id, folder_id, ref_id, name, description, lc_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.perimeterSecondaryId,
      DEMO_IDS.tenantId,
      'folder-vendor-demo',
      'PERIM-VEND',
      'Vendor Perimeter',
      'Supplier assurance and external oversight perimeter for the demo tenant.',
      'in_prod',
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO risk_scenarios (
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
    ).bind(
      DEMO_IDS.scenarioId,
      DEMO_IDS.tenantId,
      DEMO_IDS.registerId,
      'Cloud asset inventory drift',
      'Visibility gaps create stale compliance evidence and weak change control.',
      3.5,
      4.0,
      14.0,
      8.0,
      'open',
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO risk_scenarios (
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
    ).bind(
      DEMO_IDS.scenarioSecondaryId,
      DEMO_IDS.tenantId,
      DEMO_IDS.registerSecondaryId,
      'Critical SaaS supplier outage',
      'A key supplier outage delays evidence collection and quarterly control reviews.',
      2.8,
      4.6,
      12.9,
      7.2,
      'monitoring',
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO risk_assessments (
        id,
        tenant_id,
        folder_id,
        perimeter_id,
        risk_register_id,
        ref_id,
        name,
        version,
        status,
        observation
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.riskAssessmentId,
      DEMO_IDS.tenantId,
      'folder-governance-demo',
      DEMO_IDS.perimeterId,
      DEMO_IDS.registerId,
      'RA-001',
      'Enterprise Risk Assessment',
      '1.0',
      'in_progress',
      'Baseline assessment aligned to the seeded enterprise risk register.',
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO risk_assessments (
        id,
        tenant_id,
        folder_id,
        perimeter_id,
        risk_register_id,
        ref_id,
        name,
        version,
        status,
        observation
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.riskAssessmentSecondaryId,
      DEMO_IDS.tenantId,
      'folder-vendor-demo',
      DEMO_IDS.perimeterSecondaryId,
      DEMO_IDS.registerSecondaryId,
      'RA-002',
      'Vendor Risk Assessment',
      '1.1',
      'planned',
      'Upcoming review for third-party exposure and supplier resilience.',
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO compliance_assessments (
        id,
        tenant_id,
        folder_id,
        perimeter_id,
        framework_id,
        ref_id,
        name,
        version,
        status,
        observation,
        controls_total,
        controls_assessed,
        progress_percent,
        maturity_score
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.complianceAssessmentId,
      DEMO_IDS.tenantId,
      'folder-governance-demo',
      DEMO_IDS.perimeterId,
      DEMO_IDS.frameworkId,
      'CA-ISO-001',
      'ISO 27001 Annual Audit',
      '2026.1',
      'in_review',
      'Annual control review tied to the enterprise perimeter.',
      12,
      8,
      67,
      3.8,
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO compliance_assessments (
        id,
        tenant_id,
        folder_id,
        perimeter_id,
        framework_id,
        ref_id,
        name,
        version,
        status,
        observation,
        controls_total,
        controls_assessed,
        progress_percent,
        maturity_score
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.complianceAssessmentSecondaryId,
      DEMO_IDS.tenantId,
      'folder-vendor-demo',
      DEMO_IDS.perimeterSecondaryId,
      DEMO_IDS.frameworkSecondaryId,
      'CA-NIST-002',
      'Vendor Assurance Review',
      '2026.1',
      'planned',
      'Initial vendor perimeter assessment aligned to NIST CSF.',
      8,
      2,
      25,
      2.6,
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO conmon_profiles (id, tenant_id, name, description, profile_type, status)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.profileId,
      DEMO_IDS.tenantId,
      'Monthly ConMon Baseline',
      'Seeded continuous monitoring profile for the edge migration.',
      'fedramp_conmon',
      'active',
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO conmon_activity_configs (
        id,
        tenant_id,
        profile_id,
        name,
        description,
        cadence,
        theme,
        control_ref,
        config_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      DEMO_IDS.activityId,
      DEMO_IDS.tenantId,
      DEMO_IDS.profileId,
      'Monthly control coverage review',
      'Simulated queue-driven ConMon activity used by the React shell.',
      'monthly',
      'reporting',
      'CA-7',
      JSON.stringify({ collector: 'manual', region: 'global' }),
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO evidence_sources (
        id,
        tenant_id,
        name,
        provider,
        config_json,
        is_active
      )
      VALUES (?, ?, ?, ?, ?, 1)
      `,
    ).bind(
      DEMO_IDS.sourceId,
      DEMO_IDS.tenantId,
      'GitHub Org Inventory',
      'github',
      JSON.stringify({ org: 'intuitem', mode: 'manual-demo' }),
    ),
    env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO sessions (id, user_id, tenant_id, created_at, expires_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    ).bind(
      'session-demo',
      DEMO_IDS.userId,
      DEMO_IDS.tenantId,
      now,
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      '127.0.0.1',
      'workers-bootstrap',
    ),
  ];

  for (const statement of statements) {
    await statement.run();
  }

  await seedDemoFrameworkControls(env);
  await seedDemoLibraries(env);
  await seedDemoComplianceRequirements(env);
  await seedDemoTprm(env);
  await seedDemoPrivacy(env);
  await seedDemoResilience(env);
  await seedDemoOpsWorkspace(env);
  await seedDemoSetupWorkspace(env, {
    tenantId: DEMO_IDS.tenantId,
    userId: DEMO_IDS.userId,
  });

  return {
    ...DEMO_IDS,
    sessionId: 'session-demo',
  };
}

async function validateSessionPrincipal(
  env: EnvBindings,
  tenantId: string,
  userId: string,
): Promise<boolean> {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT id
    FROM users
    WHERE tenant_id = ? AND id = ? AND is_active = 1
    LIMIT 1
    `,
  )
    .bind(tenantId, userId)
    .first<{ id: string }>();

  return Boolean(row?.id);
}

async function buildSessionPayload(ctx: WorkerRequestContext) {
  const sessionId = getSessionIdFromRequest(ctx.request);
  const session =
    sessionId && ctx.authStrategy === 'd1-session'
      ? await getSessionById(ctx.env, sessionId)
      : null;

  return {
    appEnv: ctx.env.APP_ENV,
    authStrategy: ctx.authStrategy,
    isAuthenticated: Boolean(ctx.userId && ctx.tenantId),
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    sessionId: session?.id ?? null,
    sessionExpiresAt: session?.expires_at ?? null,
  };
}

function isSecureRequest(ctx: WorkerRequestContext): boolean {
  return ctx.env.APP_ENV === 'production' || ctx.url.protocol === 'https:';
}

function getBootstrapSecret(env: EnvBindings): string | null {
  const raw = env.BOOTSTRAP_SETUP_SECRET?.trim();
  if (raw) {
    return raw;
  }

  if (env.APP_ENV !== 'production') {
    return 'local-bootstrap-secret';
  }

  return null;
}

function slugifyTenant(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return normalized || 'workspace';
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function generateLoginCode(): string {
  const random = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return `${random}`.padStart(6, '0');
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function hashLoginCode(
  env: EnvBindings,
  tenantId: string,
  emailNormalized: string,
  code: string,
): Promise<string> {
  const secret = getBootstrapSecret(env) ?? 'regovise-local-sign-in';
  const encoded = new TextEncoder().encode(
    `${tenantId}:${emailNormalized}:${code.trim()}:${secret}`,
  );
  return toHex(await crypto.subtle.digest('SHA-256', encoded));
}

function generateSaltHex(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

async function derivePasswordHash(
  password: string,
  saltHex: string,
  iterations = 100000,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const salt = Uint8Array.from(saltHex.match(/.{1,2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    key,
    256,
  );
  return toHex(bits);
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 12 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

async function countRows(env: EnvBindings, table: string): Promise<number> {
  const row = await env.D1_MAIN.prepare(`SELECT COUNT(1) AS count FROM ${table}`).first<{ count: number }>();
  return Number(row?.count ?? 0);
}

async function buildBootstrapStatus(env: EnvBindings): Promise<BootstrapStatusPayload> {
  const [tenantCount, userCount] = await Promise.all([
    countRows(env, 'tenants'),
    countRows(env, 'users'),
  ]);
  const bootstrapSecretConfigured = Boolean(getBootstrapSecret(env));

  return {
    initialized: tenantCount > 0,
    tenantCount,
    userCount,
    bootstrapSecretConfigured,
    mode:
      !bootstrapSecretConfigured
        ? 'disabled'
        : tenantCount > 0
          ? 'admin-access'
          : 'initialize',
  };
}

async function buildLoginConfig(env: EnvBindings): Promise<LoginConfigPayload> {
  const adminPermissions = [
    'add_user',
    'change_user',
    'delete_user',
    'add_role',
    'change_role',
    'delete_role',
  ];
  const bootstrap = await buildBootstrapStatus(env);
  const emailRuntime = getEmailRuntimeSummary(env);
  const [emailConfigRow, ssoRow, localLoginUserCount, passwordConfiguredRow, suggestedLoginRow] = await Promise.all([
    env.D1_MAIN.prepare(
      `
      SELECT support_email, delivery_mode, status, status_note
      FROM setup_email_configs
      ORDER BY updated_at DESC
      LIMIT 1
      `,
    ).first<SetupEmailConfigSummaryRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT login_enforced
      FROM setup_sso_configs
      ORDER BY updated_at DESC
      LIMIT 1
      `,
    ).first<SetupSsoLoginSummaryRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT COUNT(1) AS count
      FROM users
      WHERE is_active = 1
        AND keep_local_login = 1
      `,
    ).first<{ count: number }>(),
    env.D1_MAIN.prepare(
      `
      SELECT COUNT(1) AS count
      FROM local_password_credentials
      `,
    ).first<{ count: number }>(),
    env.D1_MAIN.prepare(
      `
      SELECT
        tenant.slug AS tenant_slug,
        lower(user_item.email) AS email
      FROM users AS user_item
      INNER JOIN tenants AS tenant
        ON tenant.id = user_item.tenant_id
      LEFT JOIN folders AS root_folder
        ON root_folder.tenant_id = tenant.id
       AND root_folder.content_type = 'root'
      LEFT JOIN role_assignments AS assignment
        ON assignment.tenant_id = tenant.id
       AND assignment.user_id = user_item.id
       AND assignment.scope_folder_id = root_folder.id
      LEFT JOIN role_permissions AS permission
        ON permission.role_id = assignment.role_id
      WHERE user_item.is_active = 1
        AND user_item.keep_local_login = 1
      GROUP BY tenant.slug, user_item.email, user_item.created_at
      ORDER BY
        MAX(CASE WHEN permission.permission IN (${adminPermissions.map(() => '?').join(', ')}) THEN 1 ELSE 0 END) DESC,
        user_item.created_at ASC,
        lower(user_item.email) ASC
      LIMIT 1
      `,
    )
      .bind(...adminPermissions)
      .first<{ tenant_slug: string | null; email: string | null }>(),
  ]);

  const previewOnly = !emailRuntime.sendingEnabled && env.APP_ENV !== 'production';
  const emailCodeEnabled = bootstrap.initialized && (emailRuntime.sendingEnabled || previewOnly);
  const passwordConfiguredUserCount = Number(passwordConfiguredRow?.count ?? 0);
  const passwordSignInEnabled = bootstrap.initialized && Number(localLoginUserCount?.count ?? 0) > 0;

  let message = 'Email code sign-in is ready for users with local-login access.';
  if (!bootstrap.initialized) {
    message = 'Initialize the first tenant before enabling standard sign-in.';
  } else if (passwordConfiguredUserCount > 0) {
    message = 'Local password sign-in is ready for users with configured credentials.';
  } else if (previewOnly) {
    message = 'Email delivery is disabled locally, so sign-in codes stay in preview mode for development.';
  } else if (emailRuntime.providerSelected && !emailRuntime.sendingEnabled) {
    message = 'The selected email provider is missing required sender configuration or secrets.';
  } else if (!emailRuntime.sendingEnabled) {
    message = 'Configure EMAIL_PROVIDER and sender secrets to enable email code sign-in in production.';
  } else if (Number(localLoginUserCount?.count ?? 0) === 0) {
    message = 'No active users currently allow local email sign-in. Enable keep-local-login for at least one user.';
  }

  return {
    initialized: bootstrap.initialized,
    emailCodeEnabled,
    previewOnly,
    emailProvider: emailRuntime.provider,
    emailSendingEnabled: emailRuntime.sendingEnabled,
    passwordSignInEnabled,
    loginEnforced: ssoRow?.login_enforced === 1,
    deliveryMode: emailConfigRow?.delivery_mode ?? null,
    supportEmail: emailConfigRow?.support_email ?? null,
    status: emailConfigRow?.status ?? null,
    statusNote: emailConfigRow?.status_note ?? null,
    localLoginUserCount: Number(localLoginUserCount?.count ?? 0),
    passwordConfiguredUserCount,
    suggestedTenantSlug: suggestedLoginRow?.tenant_slug ?? null,
    suggestedEmail: suggestedLoginRow?.email ?? null,
    message,
  };
}

async function requireValidBootstrapSecret(
  env: EnvBindings,
  providedSecret: string | null | undefined,
): Promise<Response | null> {
  const configured = getBootstrapSecret(env);
  if (!configured) {
    return json(
      {
        error: 'bootstrap_disabled',
        message: 'Bootstrap access is not configured for this environment.',
      },
      { status: 503 },
    );
  }

  if ((providedSecret ?? '').trim() !== configured) {
    return json(
      {
        error: 'invalid_bootstrap_secret',
        message: 'The bootstrap secret was not accepted.',
      },
      { status: 403 },
    );
  }

  return null;
}

async function initializeFirstTenant(
  env: EnvBindings,
  input: {
    tenantName: string;
    tenantSlug: string;
    adminEmail: string;
    adminDisplayName: string;
  },
): Promise<{
  tenantId: string;
  userId: string;
}> {
  const tenantId = crypto.randomUUID();
  const rootFolderId = crypto.randomUUID();
  const primaryDomainId = crypto.randomUUID();
  const adminUserId = crypto.randomUUID();
  const adminRoleId = crypto.randomUUID();
  const adminAssignmentId = crypto.randomUUID();
  const primaryDomainName =
    input.tenantName.trim().length > 0 ? `${input.tenantName.trim()} Domain` : 'Primary Domain';

  await env.D1_MAIN.prepare(
    `
    INSERT INTO tenants (id, slug, name)
    VALUES (?, ?, ?)
    `,
  )
    .bind(tenantId, input.tenantSlug, input.tenantName)
    .run();

  await env.D1_MAIN.prepare(
    `
    INSERT INTO folders (id, tenant_id, name, description, content_type, parent_folder_id, is_builtin)
    VALUES (?, ?, ?, ?, 'root', NULL, 1)
    `,
  )
    .bind(
      rootFolderId,
      tenantId,
      'Global Workspace',
      'Root perimeter for shared governance assets and tenant-wide administration.',
    )
    .run();

  await env.D1_MAIN.prepare(
    `
    INSERT INTO folders (id, tenant_id, name, description, content_type, parent_folder_id, is_builtin)
    VALUES (?, ?, ?, ?, 'domain', ?, 1)
    `,
  )
    .bind(
      primaryDomainId,
      tenantId,
      primaryDomainName,
      'Primary operational domain created during tenant bootstrap.',
      rootFolderId,
    )
    .run();

  await env.D1_MAIN.prepare(
    `
    INSERT INTO users (
      id,
      tenant_id,
      email,
      display_name,
      first_name,
      last_name,
      locale,
      is_active,
      keep_local_login,
      is_third_party,
      is_auditee,
      preferences_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 0, 0, ?)
    `,
  )
    .bind(
      adminUserId,
      tenantId,
      input.adminEmail,
      input.adminDisplayName,
      null,
      null,
      'en',
      JSON.stringify({ lang: 'en' }),
    )
    .run();

  await env.D1_MAIN.prepare(
    `
    INSERT INTO roles (id, tenant_id, name, description, builtin)
    VALUES (?, ?, 'Administrator', ?, 1)
    `,
  )
    .bind(
      adminRoleId,
      tenantId,
      'Full workspace administration across domains, teams, setup, automation, and operating modules.',
    )
    .run();

  for (const permission of [
    'view_folder',
    'add_folder',
    'change_folder',
    'delete_folder',
    'view_user',
    'add_user',
    'change_user',
    'delete_user',
    'view_usergroup',
    'add_usergroup',
    'change_usergroup',
    'delete_usergroup',
    'view_role',
    'add_role',
    'change_role',
    'delete_role',
    'view_roleassignment',
    'add_roleassignment',
    'change_roleassignment',
    'delete_roleassignment',
    'view_framework',
    'add_framework',
    'change_framework',
    'view_riskregister',
    'add_riskregister',
    'change_riskregister',
    'view_riskscenario',
    'add_riskscenario',
    'change_riskscenario',
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
    'view_processing',
    'add_processing',
    'change_processing',
    'view_rightrequest',
    'add_rightrequest',
    'change_rightrequest',
    'view_databreach',
    'add_databreach',
    'change_databreach',
    'view_bia',
    'add_bia',
    'change_bia',
    'view_conmon',
    'run_conmon',
    'view_evidence',
    'collect_evidence',
  ]) {
    await env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO role_permissions (role_id, permission)
      VALUES (?, ?)
      `,
    )
      .bind(adminRoleId, permission)
      .run();
  }

  await env.D1_MAIN.prepare(
    `
    INSERT INTO role_assignments (
      id,
      tenant_id,
      role_id,
      user_id,
      group_id,
      scope_folder_id,
      assigned_by_user_id,
      is_recursive,
      is_builtin
    ) VALUES (?, ?, ?, ?, NULL, ?, ?, 1, 1)
    `,
  )
    .bind(
      adminAssignmentId,
      tenantId,
      adminRoleId,
      adminUserId,
      rootFolderId,
      adminUserId,
    )
    .run();

  return {
    tenantId,
    userId: adminUserId,
  };
}

async function loadLocalLoginPrincipal(
  env: EnvBindings,
  tenantSlug: string,
  email: string,
): Promise<LocalLoginPrincipal | null> {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT
      tenant.id AS tenant_id,
      tenant.slug AS tenant_slug,
      tenant.name AS tenant_name,
      user_item.id AS user_id,
      user_item.email AS user_email,
      COALESCE(NULLIF(user_item.display_name, ''), user_item.email) AS display_name,
      COALESCE(sso.login_enforced, 0) AS login_enforced
    FROM tenants AS tenant
    INNER JOIN users AS user_item
      ON user_item.tenant_id = tenant.id
    LEFT JOIN setup_sso_configs AS sso
      ON sso.tenant_id = tenant.id
    WHERE tenant.slug = ?
      AND lower(user_item.email) = ?
      AND user_item.is_active = 1
      AND user_item.keep_local_login = 1
    LIMIT 1
    `,
  )
    .bind(tenantSlug, email)
    .first<{
      tenant_id: string;
      tenant_slug: string;
      tenant_name: string;
      user_id: string;
      user_email: string;
      display_name: string;
      login_enforced: number;
    }>();

  if (!row?.tenant_id || !row?.user_id) {
    return null;
  }

  return {
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    tenantName: row.tenant_name,
    userId: row.user_id,
    userEmail: normalizeEmail(row.user_email),
    displayName: row.display_name,
    loginEnforced: row.login_enforced === 1,
  };
}

async function loadLocalPasswordCredential(
  env: EnvBindings,
  userId: string,
): Promise<LocalPasswordCredentialRow | null> {
  return env.D1_MAIN.prepare(
    `
    SELECT
      user_id,
      tenant_id,
      password_hash,
      password_salt,
      hash_method,
      hash_iterations,
      created_at,
      updated_at,
      updated_by_user_id,
      reset_required,
      failed_attempts,
      last_failed_at,
      locked_until
    FROM local_password_credentials
    WHERE user_id = ?
    LIMIT 1
    `,
  )
    .bind(userId)
    .first<LocalPasswordCredentialRow>();
}

async function loadLocalLoginAdmin(
  env: EnvBindings,
  tenantSlug: string,
  email: string,
): Promise<{ tenantId: string; userId: string } | null> {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT tenant.id AS tenant_id, user_item.id AS user_id
    FROM tenants AS tenant
    INNER JOIN users AS user_item
      ON user_item.tenant_id = tenant.id
    INNER JOIN folders AS root_folder
      ON root_folder.tenant_id = tenant.id
     AND root_folder.content_type = 'root'
    INNER JOIN role_assignments AS assignment
      ON assignment.tenant_id = tenant.id
     AND assignment.user_id = user_item.id
     AND assignment.scope_folder_id = root_folder.id
    INNER JOIN role_permissions AS permission
      ON permission.role_id = assignment.role_id
    WHERE tenant.slug = ?
      AND lower(user_item.email) = ?
      AND user_item.is_active = 1
      AND user_item.keep_local_login = 1
      AND permission.permission IN ('add_user', 'change_user', 'delete_user', 'add_role', 'change_role', 'delete_role')
    LIMIT 1
    `,
  )
    .bind(tenantSlug, email)
    .first<{ tenant_id: string; user_id: string }>();

  if (!row?.tenant_id || !row?.user_id) {
    return null;
  }

  return {
    tenantId: row.tenant_id,
    userId: row.user_id,
  };
}

async function removeActiveLoginCodes(
  env: EnvBindings,
  tenantId: string,
  emailNormalized: string,
): Promise<void> {
  await env.D1_MAIN.prepare(
    `
    DELETE FROM local_login_codes
    WHERE tenant_id = ?
      AND email_normalized = ?
      AND purpose = 'sign_in'
      AND consumed_at IS NULL
    `,
  )
    .bind(tenantId, emailNormalized)
    .run();
}

async function upsertLocalPasswordCredential(
  env: EnvBindings,
  input: {
    tenantId: string;
    userId: string;
    password: string;
    updatedByUserId: string | null;
    resetRequired?: boolean;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const saltHex = generateSaltHex();
  const iterations = 100000;
  const passwordHash = await derivePasswordHash(input.password, saltHex, iterations);

  await env.D1_MAIN.prepare(
    `
    INSERT INTO local_password_credentials (
      user_id,
      tenant_id,
      password_hash,
      password_salt,
      hash_method,
      hash_iterations,
      created_at,
      updated_at,
      updated_by_user_id,
      reset_required,
      failed_attempts,
      last_failed_at,
      locked_until
    ) VALUES (?, ?, ?, ?, 'pbkdf2_sha256', ?, ?, ?, ?, ?, 0, NULL, NULL)
    ON CONFLICT(user_id) DO UPDATE SET
      tenant_id = excluded.tenant_id,
      password_hash = excluded.password_hash,
      password_salt = excluded.password_salt,
      hash_method = excluded.hash_method,
      hash_iterations = excluded.hash_iterations,
      updated_at = excluded.updated_at,
      updated_by_user_id = excluded.updated_by_user_id,
      reset_required = excluded.reset_required,
      failed_attempts = 0,
      last_failed_at = NULL,
      locked_until = NULL
    `,
  )
    .bind(
      input.userId,
      input.tenantId,
      passwordHash,
      saltHex,
      iterations,
      now,
      now,
      input.updatedByUserId,
      input.resetRequired ? 1 : 0,
    )
    .run();
}

async function recordFailedPasswordAttempt(
  env: EnvBindings,
  credential: LocalPasswordCredentialRow,
): Promise<void> {
  const now = new Date().toISOString();
  const nextAttempts = credential.failed_attempts + 1;
  const lockedUntil =
    nextAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : credential.locked_until;

  await env.D1_MAIN.prepare(
    `
    UPDATE local_password_credentials
    SET failed_attempts = ?,
        last_failed_at = ?,
        locked_until = ?
    WHERE user_id = ?
    `,
  )
    .bind(nextAttempts, now, lockedUntil, credential.user_id)
    .run();
}

async function clearFailedPasswordAttempts(
  env: EnvBindings,
  userId: string,
): Promise<void> {
  await env.D1_MAIN.prepare(
    `
    UPDATE local_password_credentials
    SET failed_attempts = 0,
        last_failed_at = NULL,
        locked_until = NULL
    WHERE user_id = ?
    `,
  )
    .bind(userId)
    .run();
}

async function loadLocalPasswordTargetUser(
  env: EnvBindings,
  tenantId: string,
  userId: string,
): Promise<{
  id: string;
  tenant_id: string;
  email: string;
  keep_local_login: number;
  is_active: number;
} | null> {
  return env.D1_MAIN.prepare(
    `
    SELECT id, tenant_id, email, keep_local_login, is_active
    FROM users
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, userId)
    .first<{
      id: string;
      tenant_id: string;
      email: string;
      keep_local_login: number;
      is_active: number;
    }>();
}

export async function handleCoreRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const [resource, id, subresource, nestedId] = segments;

  if (resource === 'bootstrap') {
    if (id === 'status' && ctx.request.method === 'GET') {
      return json({
        data: await buildBootstrapStatus(ctx.env),
      });
    }

    if (id === 'initialize' && ctx.request.method === 'POST') {
      const status = await buildBootstrapStatus(ctx.env);
      if (status.initialized) {
        return json(
          {
            error: 'bootstrap_already_initialized',
            message: 'This workspace has already been initialized.',
          },
          { status: 409 },
        );
      }

      const body = await readJson<{
        secret?: string;
        tenantName?: string;
        tenantSlug?: string;
        adminEmail?: string;
        adminDisplayName?: string;
      }>(ctx.request);

      const secretError = await requireValidBootstrapSecret(ctx.env, body.secret);
      if (secretError) {
        return secretError;
      }

      const tenantName = body.tenantName?.trim() || '';
      const tenantSlug = slugifyTenant(body.tenantSlug?.trim() || tenantName);
      const adminEmail = body.adminEmail?.trim().toLowerCase() || '';
      const adminDisplayName = body.adminDisplayName?.trim() || '';

      if (!tenantName || !tenantSlug || !adminEmail || !adminDisplayName) {
        return json(
          {
            error: 'invalid_bootstrap_payload',
            message: 'Tenant name, tenant slug, admin email, and admin display name are required.',
          },
          { status: 400 },
        );
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
        return json(
          {
            error: 'invalid_bootstrap_payload',
            message: 'A valid admin email address is required.',
          },
          { status: 400 },
        );
      }

      const existingSlug = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id
        FROM tenants
        WHERE slug = ?
        LIMIT 1
        `,
      )
        .bind(tenantSlug)
        .first<{ id: string }>();

      if (existingSlug) {
        return json(
          {
            error: 'tenant_slug_exists',
            message: 'That tenant slug is already in use.',
          },
          { status: 409 },
        );
      }

      const initialized = await initializeFirstTenant(ctx.env, {
        tenantName,
        tenantSlug,
        adminEmail,
        adminDisplayName,
      });

      const session = await createSession(ctx.env, ctx.request, {
        tenantId: initialized.tenantId,
        userId: initialized.userId,
      });

      return json(
        {
          data: {
            initialized: true,
            tenantId: initialized.tenantId,
            userId: initialized.userId,
            tenantSlug,
            sessionId: session.id,
            sessionExpiresAt: session.expires_at,
          },
        },
        {
          status: 201,
          headers: {
            'Set-Cookie': buildSessionCookieHeader(
              session.id,
              session.expires_at,
              isSecureRequest(ctx),
            ),
          },
        },
      );
    }

    if (id === 'admin-session' && ctx.request.method === 'POST') {
      const body = await readJson<{
        secret?: string;
        tenantSlug?: string;
        email?: string;
      }>(ctx.request);

      const secretError = await requireValidBootstrapSecret(ctx.env, body.secret);
      if (secretError) {
        return secretError;
      }

      const tenantSlug = slugifyTenant(body.tenantSlug?.trim() || '');
      const email = body.email?.trim().toLowerCase() || '';
      if (!tenantSlug || !email) {
        return json(
          {
            error: 'invalid_bootstrap_payload',
            message: 'Tenant slug and admin email are required.',
          },
          { status: 400 },
        );
      }

      const principal = await loadLocalLoginAdmin(ctx.env, tenantSlug, email);
      if (!principal) {
        return json(
          {
            error: 'admin_not_found',
            message: 'No local-login tenant administrator matched that tenant slug and email.',
          },
          { status: 404 },
        );
      }

      const session = await createSession(ctx.env, ctx.request, {
        tenantId: principal.tenantId,
        userId: principal.userId,
      });

      return json(
        {
          data: {
            initialized: true,
            tenantId: principal.tenantId,
            userId: principal.userId,
            tenantSlug,
            sessionId: session.id,
            sessionExpiresAt: session.expires_at,
          },
        },
        {
          status: 201,
          headers: {
            'Set-Cookie': buildSessionCookieHeader(
              session.id,
              session.expires_at,
              isSecureRequest(ctx),
            ),
          },
        },
      );
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'login') {
    if (id === 'config' && ctx.request.method === 'GET') {
      return json({
        data: await buildLoginConfig(ctx.env),
      });
    }

    if (id === 'request-code' && ctx.request.method === 'POST') {
      const config = await buildLoginConfig(ctx.env);
      if (!config.initialized) {
        return json(
          {
            error: 'workspace_not_initialized',
            message: 'Initialize the workspace before requesting sign-in codes.',
          },
          { status: 409 },
        );
      }

      if (!config.emailCodeEnabled) {
        return json(
          {
            error: 'email_sign_in_unavailable',
            message: config.message,
          },
          { status: 503 },
        );
      }

      const body = await readJson<{
        tenantSlug?: string;
        email?: string;
      }>(ctx.request);
      const tenantSlug = slugifyTenant(body.tenantSlug?.trim() || '');
      const email = normalizeEmail(body.email);

      if (!tenantSlug || !email) {
        return json(
          {
            error: 'invalid_login_payload',
            message: 'Tenant slug and email are required to request a sign-in code.',
          },
          { status: 400 },
        );
      }

      const principal = await loadLocalLoginPrincipal(ctx.env, tenantSlug, email);
      if (!principal) {
        return json({
          data: {
            requested: true,
            delivery: config.previewOnly ? 'preview' : 'email',
            expiresAt: null,
            previewCode: null,
          },
        });
      }

      const minuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const [recentMinute, recentHour] = await Promise.all([
        ctx.env.D1_MAIN.prepare(
          `
          SELECT COUNT(1) AS count
          FROM local_login_codes
          WHERE tenant_id = ?
            AND email_normalized = ?
            AND purpose = 'sign_in'
            AND requested_at >= ?
          `,
        )
          .bind(principal.tenantId, email, minuteAgo)
          .first<{ count: number }>(),
        ctx.env.D1_MAIN.prepare(
          `
          SELECT COUNT(1) AS count
          FROM local_login_codes
          WHERE tenant_id = ?
            AND email_normalized = ?
            AND purpose = 'sign_in'
            AND requested_at >= ?
          `,
        )
          .bind(principal.tenantId, email, hourAgo)
          .first<{ count: number }>(),
      ]);

      if (Number(recentMinute?.count ?? 0) > 0) {
        return json(
          {
            error: 'login_code_rate_limited',
            message: 'Please wait about a minute before requesting another sign-in code.',
          },
          { status: 429 },
        );
      }

      if (Number(recentHour?.count ?? 0) >= 5) {
        return json(
          {
            error: 'login_code_rate_limited',
            message: 'Too many sign-in codes were requested for this account. Try again later.',
          },
          { status: 429 },
        );
      }

      await removeActiveLoginCodes(ctx.env, principal.tenantId, email);

      const requestId = crypto.randomUUID();
      const code = generateLoginCode();
      const requestedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const codeHash = await hashLoginCode(ctx.env, principal.tenantId, email, code);
      const ipAddress =
        ctx.request.headers.get('cf-connecting-ip') ??
        ctx.request.headers.get('x-forwarded-for') ??
        null;
      const userAgent = ctx.request.headers.get('user-agent');

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO local_login_codes (
          id,
          tenant_id,
          user_id,
          email_normalized,
          purpose,
          code_hash,
          requested_at,
          expires_at,
          ip_address,
          user_agent
        ) VALUES (?, ?, ?, ?, 'sign_in', ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          requestId,
          principal.tenantId,
          principal.userId,
          email,
          codeHash,
          requestedAt,
          expiresAt,
          ipAddress,
          userAgent,
        )
        .run();

      const baseOrigin = ctx.env.APP_ORIGIN?.trim() || ctx.url.origin;
      const delivery = await sendLocalSignInCodeEmail(ctx.env, {
        tenantId: principal.tenantId,
        userId: principal.userId,
        email,
        displayName: principal.displayName,
        tenantName: principal.tenantName,
        code,
        expiresInMinutes: 10,
        requestId,
        baseOrigin,
      });

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE local_login_codes
        SET delivery_status = ?,
            delivery_provider = ?,
            delivery_request_id = ?
        WHERE id = ?
        `,
      )
        .bind(
          delivery.delivered ? 'sent' : delivery.skipped ? 'skipped' : 'failed',
          delivery.provider,
          delivery.providerRequestId ?? null,
          requestId,
        )
        .run();

      if (!delivery.delivered && !config.previewOnly) {
        await ctx.env.D1_MAIN.prepare(`DELETE FROM local_login_codes WHERE id = ?`).bind(requestId).run();
        return json(
          {
            error: 'login_code_delivery_failed',
            message: 'The sign-in code could not be delivered. Check email delivery settings and try again.',
          },
          { status: 502 },
        );
      }

      return json({
        data: {
          requested: true,
          delivery: delivery.delivered ? 'email' : 'preview',
          expiresAt,
          previewCode: config.previewOnly ? code : null,
        },
      });
    }

    if (id === 'verify-code' && ctx.request.method === 'POST') {
      const body = await readJson<{
        tenantSlug?: string;
        email?: string;
        code?: string;
      }>(ctx.request);
      const tenantSlug = slugifyTenant(body.tenantSlug?.trim() || '');
      const email = normalizeEmail(body.email);
      const code = body.code?.trim() || '';

      if (!tenantSlug || !email || !/^\d{6}$/.test(code)) {
        return json(
          {
            error: 'invalid_login_payload',
            message: 'Tenant slug, email, and a six-digit sign-in code are required.',
          },
          { status: 400 },
        );
      }

      const principal = await loadLocalLoginPrincipal(ctx.env, tenantSlug, email);
      if (!principal) {
        return json(
          {
            error: 'invalid_login_code',
            message: 'That sign-in code was not accepted.',
          },
          { status: 401 },
        );
      }

      const loginCode = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id, tenant_id, user_id, email_normalized, purpose, code_hash, requested_at, expires_at, consumed_at, attempts, last_attempt_at
        FROM local_login_codes
        WHERE tenant_id = ?
          AND user_id = ?
          AND email_normalized = ?
          AND purpose = 'sign_in'
          AND consumed_at IS NULL
        ORDER BY requested_at DESC
        LIMIT 1
        `,
      )
        .bind(principal.tenantId, principal.userId, email)
        .first<LocalLoginCodeRow>();

      if (!loginCode) {
        return json(
          {
            error: 'invalid_login_code',
            message: 'That sign-in code was not accepted.',
          },
          { status: 401 },
        );
      }

      const now = new Date().toISOString();
      if (loginCode.expires_at <= now) {
        await ctx.env.D1_MAIN.prepare(
          `
          UPDATE local_login_codes
          SET consumed_at = ?,
              last_attempt_at = ?
          WHERE id = ?
          `,
        )
          .bind(now, now, loginCode.id)
          .run();

        return json(
          {
            error: 'expired_login_code',
            message: 'That sign-in code has expired. Request a new one to continue.',
          },
          { status: 401 },
        );
      }

      if (loginCode.attempts >= 5) {
        return json(
          {
            error: 'too_many_login_attempts',
            message: 'Too many attempts were made for that sign-in code. Request a new code to continue.',
          },
          { status: 429 },
        );
      }

      const codeHash = await hashLoginCode(ctx.env, principal.tenantId, email, code);
      if (codeHash !== loginCode.code_hash) {
        await ctx.env.D1_MAIN.prepare(
          `
          UPDATE local_login_codes
          SET attempts = attempts + 1,
              last_attempt_at = ?
          WHERE id = ?
          `,
        )
          .bind(now, loginCode.id)
          .run();

        return json(
          {
            error: 'invalid_login_code',
            message: 'That sign-in code was not accepted.',
          },
          { status: 401 },
        );
      }

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE local_login_codes
        SET consumed_at = ?,
            last_attempt_at = ?
        WHERE id = ?
        `,
      )
        .bind(now, now, loginCode.id)
        .run();

      const session = await createSession(ctx.env, ctx.request, {
        tenantId: principal.tenantId,
        userId: principal.userId,
      });

      return json(
        {
          data: {
            appEnv: ctx.env.APP_ENV,
            authStrategy: 'd1-session',
            isAuthenticated: true,
            userId: principal.userId,
            tenantId: principal.tenantId,
            sessionId: session.id,
            sessionExpiresAt: session.expires_at,
          },
        },
        {
          status: 201,
          headers: {
            'Set-Cookie': buildSessionCookieHeader(
              session.id,
              session.expires_at,
              isSecureRequest(ctx),
            ),
          },
        },
      );
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'local-auth') {
    if (id === 'admin-set-password' && ctx.request.method === 'POST') {
      const adminAccess = await requireRootAdminAccess(
        ctx,
        'Tenant administrator access is required to manage local passwords.',
      );
      if (adminAccess instanceof Response) {
        return adminAccess;
      }

      const body = await readJson<{
        userId?: string;
        newPassword?: string;
        requireReset?: boolean;
      }>(ctx.request);
      const userId = body.userId?.trim() || '';
      const newPassword = body.newPassword ?? '';

      if (!userId || !newPassword) {
        return json(
          {
            error: 'invalid_local_auth_payload',
            message: 'User id and a temporary password are required.',
          },
          { status: 400 },
        );
      }

      if (!isStrongPassword(newPassword)) {
        return json(
          {
            error: 'weak_password',
            message: 'Use at least 12 characters with upper, lower, number, and symbol characters.',
          },
          { status: 400 },
        );
      }

      const targetUser = await loadLocalPasswordTargetUser(ctx.env, adminAccess.tenantId, userId);
      if (!targetUser) {
        return json(
          {
            error: 'user_not_found',
            message: 'That team member was not found.',
          },
          { status: 404 },
        );
      }

      if (targetUser.is_active !== 1) {
        return json(
          {
            error: 'inactive_user',
            message: 'Local passwords can only be managed for active users.',
          },
          { status: 409 },
        );
      }

      if (targetUser.keep_local_login !== 1) {
        return json(
          {
            error: 'local_login_disabled',
            message: 'Enable local login for that user before setting a local password.',
          },
          { status: 409 },
        );
      }

      const requireReset = body.requireReset !== false;
      await upsertLocalPasswordCredential(ctx.env, {
        tenantId: adminAccess.tenantId,
        userId,
        password: newPassword,
        updatedByUserId: adminAccess.userId,
        resetRequired: requireReset,
      });

      return json({
        data: {
          passwordSet: true,
          userId,
          requireReset,
        },
      });
    }

    if (id === 'sign-in' && ctx.request.method === 'POST') {
      const body = await readJson<{
        tenantSlug?: string;
        email?: string;
        password?: string;
      }>(ctx.request);
      const tenantSlug = slugifyTenant(body.tenantSlug?.trim() || '');
      const email = normalizeEmail(body.email);
      const password = body.password ?? '';

      if (!tenantSlug || !email || !password) {
        return json(
          {
            error: 'invalid_local_auth_payload',
            message: 'Tenant slug, email, and password are required.',
          },
          { status: 400 },
        );
      }

      const principal = await loadLocalLoginPrincipal(ctx.env, tenantSlug, email);
      if (!principal) {
        return json(
          {
            error: 'invalid_credentials',
            message: 'That email or password was not accepted.',
          },
          { status: 401 },
        );
      }

      const credential = await loadLocalPasswordCredential(ctx.env, principal.userId);
      if (!credential) {
        return json(
          {
            error: 'password_not_configured',
            message: 'No local password is configured for that account yet.',
          },
          { status: 409 },
        );
      }

      if (credential.locked_until && Date.parse(credential.locked_until) > Date.now()) {
        return json(
          {
            error: 'local_auth_locked',
            message: 'Too many failed sign-in attempts. Try again in a few minutes.',
          },
          { status: 429 },
        );
      }

      const derivedHash = await derivePasswordHash(
        password,
        credential.password_salt,
        credential.hash_iterations,
      );
      if (!constantTimeEqual(derivedHash, credential.password_hash)) {
        await recordFailedPasswordAttempt(ctx.env, credential);
        return json(
          {
            error: 'invalid_credentials',
            message: 'That email or password was not accepted.',
          },
          { status: 401 },
        );
      }

      await clearFailedPasswordAttempts(ctx.env, principal.userId);

      const session = await createSession(ctx.env, ctx.request, {
        tenantId: principal.tenantId,
        userId: principal.userId,
      });

      return json(
        {
          data: {
            appEnv: ctx.env.APP_ENV,
            authStrategy: 'd1-session',
            isAuthenticated: true,
            userId: principal.userId,
            tenantId: principal.tenantId,
            sessionId: session.id,
            sessionExpiresAt: session.expires_at,
            resetRequired: credential.reset_required === 1,
          },
        },
        {
          status: 201,
          headers: {
            'Set-Cookie': buildSessionCookieHeader(
              session.id,
              session.expires_at,
              isSecureRequest(ctx),
            ),
          },
        },
      );
    }

    if (id === 'bootstrap-set-password' && ctx.request.method === 'POST') {
      const body = await readJson<{
        tenantSlug?: string;
        email?: string;
        secret?: string;
        newPassword?: string;
      }>(ctx.request);

      const secretError = await requireValidBootstrapSecret(ctx.env, body.secret);
      if (secretError) {
        return secretError;
      }

      const tenantSlug = slugifyTenant(body.tenantSlug?.trim() || '');
      const email = normalizeEmail(body.email);
      const newPassword = body.newPassword ?? '';

      if (!tenantSlug || !email || !newPassword) {
        return json(
          {
            error: 'invalid_local_auth_payload',
            message: 'Tenant slug, email, and new password are required.',
          },
          { status: 400 },
        );
      }

      if (!isStrongPassword(newPassword)) {
        return json(
          {
            error: 'weak_password',
            message: 'Use at least 12 characters with upper, lower, number, and symbol characters.',
          },
          { status: 400 },
        );
      }

      const principal = await loadLocalLoginPrincipal(ctx.env, tenantSlug, email);
      if (!principal) {
        return json(
          {
            error: 'local_login_not_found',
            message: 'No local-login account matched that tenant slug and email.',
          },
          { status: 404 },
        );
      }

      await upsertLocalPasswordCredential(ctx.env, {
        tenantId: principal.tenantId,
        userId: principal.userId,
        password: newPassword,
        updatedByUserId: principal.userId,
      });

      return json({
        data: {
          passwordSet: true,
          tenantId: principal.tenantId,
          userId: principal.userId,
          tenantSlug: principal.tenantSlug,
        },
      });
    }

    if (id === 'set-password' && ctx.request.method === 'POST') {
      if (!ctx.tenantId || !ctx.userId) {
        return json(
          {
            error: 'missing_identity',
            message: 'A secure session is required to set a password.',
          },
          { status: 401 },
        );
      }

      const body = await readJson<{
        currentPassword?: string;
        newPassword?: string;
      }>(ctx.request);
      const newPassword = body.newPassword ?? '';
      if (!isStrongPassword(newPassword)) {
        return json(
          {
            error: 'weak_password',
            message: 'Use at least 12 characters with upper, lower, number, and symbol characters.',
          },
          { status: 400 },
        );
      }

      const currentCredential = await loadLocalPasswordCredential(ctx.env, ctx.userId);
      if (currentCredential) {
        const currentPassword = body.currentPassword ?? '';
        if (!currentPassword) {
          return json(
            {
              error: 'current_password_required',
              message: 'Enter the current password before setting a new one.',
            },
            { status: 400 },
          );
        }

        const currentHash = await derivePasswordHash(
          currentPassword,
          currentCredential.password_salt,
          currentCredential.hash_iterations,
        );
        if (!constantTimeEqual(currentHash, currentCredential.password_hash)) {
          return json(
            {
              error: 'invalid_credentials',
              message: 'The current password was not accepted.',
            },
            { status: 401 },
          );
        }
      }

      await upsertLocalPasswordCredential(ctx.env, {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        password: newPassword,
        updatedByUserId: ctx.userId,
      });

      return json({
        data: {
          passwordSet: true,
        },
      });
    }

    return methodNotAllowed(['POST']);
  }

  if (resource === 'session') {
    if (!id && ctx.request.method === 'GET') {
      return json({
        data: await buildSessionPayload(ctx),
      });
    }

    if (id === 'exchange' && ctx.request.method === 'POST') {
      if (!ctx.tenantId || !ctx.userId) {
        return json(
          {
            error: 'missing_identity',
            message: 'A tenant and user identity are required to establish a workspace session.',
          },
          { status: 401 },
        );
      }

      const principalExists = await validateSessionPrincipal(ctx.env, ctx.tenantId, ctx.userId);
      if (!principalExists) {
        return json(
          {
            error: 'invalid_identity',
            message: 'The selected identity is not available for session bootstrap.',
          },
          { status: 401 },
        );
      }

      const session = await createSession(ctx.env, ctx.request, {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
      });

      return json(
        {
          data: {
            appEnv: ctx.env.APP_ENV,
            authStrategy: 'd1-session',
            isAuthenticated: true,
            userId: ctx.userId,
            tenantId: ctx.tenantId,
            sessionId: session.id,
            sessionExpiresAt: session.expires_at,
          },
        },
        {
          status: 201,
          headers: {
            'Set-Cookie': buildSessionCookieHeader(
              session.id,
              session.expires_at,
              isSecureRequest(ctx),
            ),
          },
        },
      );
    }

    if (!id && ctx.request.method === 'DELETE') {
      const sessionId = getSessionIdFromRequest(ctx.request);
      if (sessionId) {
        await deleteSession(ctx.env, sessionId);
      }

      return json(
        {
          data: {
            signedOut: true,
          },
        },
        {
          headers: {
            'Set-Cookie': buildClearedSessionCookieHeader(isSecureRequest(ctx)),
          },
        },
      );
    }

    return methodNotAllowed(['GET', 'POST', 'DELETE']);
  }

  if (resource === 'health') {
    const runtime = await getAiRuntimeStatus(ctx.env);
    return json({
      data: {
        ok: true,
        service: 'core',
        appEnv: ctx.env.APP_ENV,
        bindings: {
          assets: !!ctx.env.ASSETS,
          d1: !!ctx.env.D1_MAIN,
          r2: !!ctx.env.R2_EVIDENCE,
          queues: true,
          durableObjects: true,
          ai: runtime.textGenerationAvailable,
          vectorize: runtime.vectorizeAvailable,
          vectorCount: runtime.vectorCount,
        },
      },
    });
  }

  if (resource === 'me' && ctx.request.method === 'GET') {
    return json({
      data: await buildSessionPayload(ctx),
    });
  }

  if (resource === 'overview') {
    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }

    if (!ctx.tenantId) {
      return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
    }
    const accessError = await requireCorePermissionFamily(
      ctx,
      CORE_OVERVIEW_READ_PERMISSIONS,
      CORE_OVERVIEW_READ_PERMISSIONS,
      'Workspace overview',
    );
    if (accessError) {
      return accessError;
    }

    const counts = await buildOverviewCounts(ctx.env, ctx.tenantId);

    return json({
      data: {
        tenantId: ctx.tenantId,
        counts,
      },
    });
  }

  if (resource === 'libraries') {
    if (!ctx.tenantId) {
      return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
    }
    const accessError = await requireCorePermissionFamily(
      ctx,
      FRAMEWORK_READ_PERMISSIONS,
      FRAMEWORK_WRITE_PERMISSIONS,
      'Library',
    );
    if (accessError) {
      return accessError;
    }

    if (id) {
      if (ctx.request.method !== 'GET') {
        return methodNotAllowed(['GET']);
      }

      const library = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          library.id,
          library.tenant_id,
          library.framework_id,
          framework_item.name AS framework_name,
          framework_item.key AS framework_key,
          library.name,
          library.description,
          library.provider,
          library.packager,
          library.version,
          library.publication_date,
          library.copyright,
          library.dependencies_json,
          library.risk_matrices_json,
          library.threats_json,
          library.has_update,
          COUNT(control.id) AS control_count,
          library.created_at,
          library.updated_at
        FROM libraries AS library
        LEFT JOIN frameworks AS framework_item
          ON framework_item.id = library.framework_id
        LEFT JOIN controls AS control
          ON control.framework_id = library.framework_id
        WHERE library.tenant_id = ? AND library.id = ?
        GROUP BY library.id
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, id)
        .first<LibraryRow>();

      if (!library) {
        return json(
          { error: 'library_not_found', message: 'The selected library does not exist.' },
          { status: 404 },
        );
      }

      const referenceControls = library.framework_id
        ? (await listFrameworkControlRows(ctx.env, ctx.tenantId, library.framework_id)).map(toControlResponse)
        : [];

      return json({
        data: {
          ...toLibraryResponse(library),
          framework: library.framework_id
            ? {
                id: library.framework_id,
                name: library.framework_name,
                key: library.framework_key,
              }
            : null,
          referenceControls,
          tree: buildFrameworkTree(referenceControls),
        },
      });
    }

    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }

    const { results } = await ctx.env.D1_MAIN.prepare(
      `
      SELECT
        library.id,
        library.tenant_id,
        library.framework_id,
        framework_item.name AS framework_name,
        framework_item.key AS framework_key,
        library.name,
        library.description,
        library.provider,
        library.packager,
        library.version,
        library.publication_date,
        library.copyright,
        library.dependencies_json,
        library.risk_matrices_json,
        library.threats_json,
        library.has_update,
        COUNT(control.id) AS control_count,
        library.created_at,
        library.updated_at
      FROM libraries AS library
      LEFT JOIN frameworks AS framework_item
        ON framework_item.id = library.framework_id
      LEFT JOIN controls AS control
        ON control.framework_id = library.framework_id
      WHERE library.tenant_id = ?
      GROUP BY library.id
      ORDER BY library.updated_at DESC
      `,
    )
      .bind(ctx.tenantId)
      .all<LibraryRow>();

    return json({
      data: results.map(toLibraryResponse),
    });
  }

  if (resource === 'frameworks') {
    if (!ctx.tenantId) {
      return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
    }
    const accessError = await requireCorePermissionFamily(
      ctx,
      FRAMEWORK_READ_PERMISSIONS,
      FRAMEWORK_WRITE_PERMISSIONS,
      'Framework',
    );
    if (accessError) {
      return accessError;
    }

    if (id) {
      if (!subresource) {
        if (ctx.request.method !== 'GET') {
          return methodNotAllowed(['GET']);
        }

        const framework = await ctx.env.D1_MAIN.prepare(
          `
          SELECT
            framework.id,
            framework.tenant_id,
            framework.key,
            framework.name,
            framework.version,
            framework.category,
            COUNT(control.id) AS control_count,
            framework.created_at,
            framework.updated_at
          FROM frameworks AS framework
          LEFT JOIN controls AS control
            ON control.framework_id = framework.id
          WHERE framework.tenant_id = ? AND framework.id = ?
          GROUP BY framework.id
          LIMIT 1
          `,
        )
          .bind(ctx.tenantId, id)
          .first<FrameworkRow>();

        if (!framework) {
          return json(
            { error: 'framework_not_found', message: 'The selected framework does not exist.' },
            { status: 404 },
          );
        }

        return json({
          data: toFrameworkResponse(framework),
        });
      }

      if (subresource === 'controls') {
        if (ctx.request.method === 'GET') {
          const controls = await listFrameworkControlRows(ctx.env, ctx.tenantId, id);

          return json({
            data: controls.map(toControlResponse),
          });
        }

        if (ctx.request.method === 'POST') {
          const framework = await ctx.env.D1_MAIN.prepare(
            `
            SELECT id, key, name
            FROM frameworks
            WHERE tenant_id = ? AND id = ?
            LIMIT 1
            `,
          )
            .bind(ctx.tenantId, id)
            .first<{ id: string; key: string; name: string }>();

          if (!framework) {
            return json(
              { error: 'framework_not_found', message: 'The selected framework does not exist.' },
              { status: 404 },
            );
          }

          const body = (await ctx.request.json()) as CreateControlInput;
          const ref = body.ref?.trim();
          const title = body.title?.trim();

          if (!ref || !title) {
            return json(
              { error: 'invalid_control', message: 'Control reference and title are required.' },
              { status: 400 },
            );
          }

          const controlId = crypto.randomUUID();
          await ctx.env.D1_MAIN.prepare(
            `
            INSERT INTO controls (id, tenant_id, framework_id, ref, title, description)
            VALUES (?, ?, ?, ?, ?, ?)
            `,
          )
            .bind(controlId, ctx.tenantId, id, ref, title, body.description?.trim() || null)
            .run();

          const control = await ctx.env.D1_MAIN.prepare(
            `
            SELECT
              control.id,
              control.tenant_id,
              control.framework_id,
              framework_item.key AS framework_key,
              framework_item.name AS framework_name,
              control.ref,
              control.title,
              control.description,
              control.created_at,
              control.updated_at
            FROM controls AS control
            INNER JOIN frameworks AS framework_item
              ON framework_item.id = control.framework_id
            WHERE control.tenant_id = ? AND control.id = ?
            LIMIT 1
            `,
          )
            .bind(ctx.tenantId, controlId)
            .first<ControlRow>();

          return json(
            {
              data: control ? toControlResponse(control) : null,
            },
            { status: 201 },
          );
        }

        return methodNotAllowed(['GET', 'POST']);
      }

      if (subresource === 'tree') {
        if (ctx.request.method !== 'GET') {
          return methodNotAllowed(['GET']);
        }

        const controls = await listFrameworkControlRows(ctx.env, ctx.tenantId, id);

        return json({
          data: buildFrameworkTree(controls.map(toControlResponse)),
        });
      }

      return json({ error: 'not_found', path: segments.join('/') }, { status: 404 });
    }

    if (ctx.request.method === 'GET') {
      const { results } = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          framework.id,
          framework.tenant_id,
          framework.key,
          framework.name,
          framework.version,
          framework.category,
          COUNT(control.id) AS control_count,
          framework.created_at,
          framework.updated_at
        FROM frameworks AS framework
        LEFT JOIN controls AS control
          ON control.framework_id = framework.id
        WHERE framework.tenant_id = ?
        GROUP BY framework.id
        ORDER BY framework.name ASC
        `,
      )
        .bind(ctx.tenantId)
        .all<FrameworkRow>();

      return json({
        data: results.map(toFrameworkResponse),
      });
    }

    if (ctx.request.method === 'POST') {
      const body = (await ctx.request.json()) as CreateFrameworkInput;
      const key = body.key?.trim();
      const name = body.name?.trim();

      if (!key || !name) {
        return json(
          { error: 'invalid_framework', message: 'Framework key and name are required.' },
          { status: 400 },
        );
      }

      const frameworkId = crypto.randomUUID();
      const version = body.version?.trim() || null;
      const category = body.category?.trim() || 'security';

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO frameworks (id, tenant_id, key, name, version, category)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(frameworkId, ctx.tenantId, key, name, version, category)
        .run();

      const framework = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          framework.id,
          framework.tenant_id,
          framework.key,
          framework.name,
          framework.version,
          framework.category,
          COUNT(control.id) AS control_count,
          framework.created_at,
          framework.updated_at
        FROM frameworks AS framework
        LEFT JOIN controls AS control
          ON control.framework_id = framework.id
        WHERE framework.id = ? AND framework.tenant_id = ?
        GROUP BY framework.id
        LIMIT 1
        `,
      )
        .bind(frameworkId, ctx.tenantId)
        .first<FrameworkRow>();

      return json(
        {
          data: framework ? toFrameworkResponse(framework) : null,
        },
        { status: 201 },
      );
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'perimeters') {
    if (!ctx.tenantId) {
      return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
    }
    const accessError = await requireCorePermissionFamily(
      ctx,
      FOLDER_READ_PERMISSIONS,
      FOLDER_WRITE_PERMISSIONS,
      'Perimeter',
    );
    if (accessError) {
      return accessError;
    }

    if (ctx.request.method === 'GET') {
      const { results } = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          perimeter.id,
          perimeter.tenant_id,
          perimeter.folder_id,
          folder_item.name AS folder_name,
          perimeter.ref_id,
          perimeter.name,
          perimeter.description,
          perimeter.lc_status,
          perimeter.created_at,
          perimeter.updated_at
        FROM perimeters AS perimeter
        INNER JOIN folders AS folder_item
          ON folder_item.id = perimeter.folder_id
        WHERE perimeter.tenant_id = ?
        ORDER BY folder_item.name ASC, perimeter.name ASC
        `,
      )
        .bind(ctx.tenantId)
        .all<PerimeterRow>();

      return json({
        data: results.map(toPerimeterResponse),
      });
    }

    if (ctx.request.method === 'POST') {
      const body = (await ctx.request.json()) as CreatePerimeterInput;
      const folderId = body.folderId?.trim();
      const name = body.name?.trim();

      if (!folderId || !name) {
        return json(
          { error: 'invalid_perimeter', message: 'Perimeter name and folder are required.' },
          { status: 400 },
        );
      }

      const folder = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id, name
        FROM folders
        WHERE tenant_id = ? AND id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, folderId)
        .first<{ id: string; name: string }>();

      if (!folder) {
        return json(
          { error: 'folder_not_found', message: 'The selected folder does not exist.' },
          { status: 404 },
        );
      }

      const perimeterId = crypto.randomUUID();
      const refId = body.refId?.trim() || null;
      const description = body.description?.trim() || null;
      const lcStatus = body.lcStatus?.trim() || 'in_design';

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO perimeters (id, tenant_id, folder_id, ref_id, name, description, lc_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(perimeterId, ctx.tenantId, folderId, refId, name, description, lcStatus)
        .run();

      const perimeter = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          perimeter.id,
          perimeter.tenant_id,
          perimeter.folder_id,
          folder_item.name AS folder_name,
          perimeter.ref_id,
          perimeter.name,
          perimeter.description,
          perimeter.lc_status,
          perimeter.created_at,
          perimeter.updated_at
        FROM perimeters AS perimeter
        INNER JOIN folders AS folder_item
          ON folder_item.id = perimeter.folder_id
        WHERE perimeter.id = ? AND perimeter.tenant_id = ?
        LIMIT 1
        `,
      )
        .bind(perimeterId, ctx.tenantId)
        .first<PerimeterRow>();

      return json(
        {
          data: perimeter ? toPerimeterResponse(perimeter) : null,
        },
        { status: 201 },
      );
    }

    if (ctx.request.method === 'PUT' && id) {
      const body = (await ctx.request.json()) as CreatePerimeterInput;
      const name = body.name?.trim();

      if (!name) {
        return json(
          { error: 'invalid_perimeter', message: 'Perimeter name is required.' },
          { status: 400 },
        );
      }

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE perimeters
        SET name = ?,
            description = ?,
            ref_id = ?,
            lc_status = ?,
            updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(
          name,
          body.description?.trim() || null,
          body.refId?.trim() || null,
          body.lcStatus?.trim() || null,
          id,
          ctx.tenantId,
        )
        .run();

      const updated = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          perimeter.id,
          perimeter.tenant_id,
          perimeter.folder_id,
          folder_item.name AS folder_name,
          perimeter.ref_id,
          perimeter.name,
          perimeter.description,
          perimeter.lc_status,
          perimeter.created_at,
          perimeter.updated_at
        FROM perimeters AS perimeter
        INNER JOIN folders AS folder_item
          ON folder_item.id = perimeter.folder_id
        WHERE perimeter.id = ? AND perimeter.tenant_id = ?
        LIMIT 1
        `,
      )
        .bind(id, ctx.tenantId)
        .first<PerimeterRow>();

      return updated ? json({ data: toPerimeterResponse(updated) }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'DELETE' && id) {
      const result = await ctx.env.D1_MAIN.prepare(
        `DELETE FROM perimeters WHERE id = ? AND tenant_id = ?`,
      )
        .bind(id, ctx.tenantId)
        .run();

      if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
      return json({ data: { deleted: true, id } });
    }

    if (id) {
      return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'risk-registers') {
    if (!ctx.tenantId) {
      return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
    }
    const accessError = await requireCorePermissionFamily(
      ctx,
      RISK_READ_PERMISSIONS,
      RISK_WRITE_PERMISSIONS,
      'Risk register',
    );
    if (accessError) {
      return accessError;
    }

    if (ctx.request.method === 'GET') {
      const { results } = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id, tenant_id, name, description, created_at, updated_at
        FROM risk_registers
        WHERE tenant_id = ?
        ORDER BY name ASC
        `,
      )
        .bind(ctx.tenantId)
        .all<RiskRegisterRow>();

      return json({
        data: results.map(toRiskRegisterResponse),
      });
    }

    if (ctx.request.method === 'POST') {
      const body = (await ctx.request.json()) as CreateRiskRegisterInput;
      const name = body.name?.trim();

      if (!name) {
        return json(
          { error: 'invalid_risk_register', message: 'Risk register name is required.' },
          { status: 400 },
        );
      }

      const registerId = crypto.randomUUID();
      const description = body.description?.trim() || null;

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO risk_registers (id, tenant_id, name, description)
        VALUES (?, ?, ?, ?)
        `,
      )
        .bind(registerId, ctx.tenantId, name, description)
        .run();

      const register = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id, tenant_id, name, description, created_at, updated_at
        FROM risk_registers
        WHERE id = ? AND tenant_id = ?
        LIMIT 1
        `,
      )
        .bind(registerId, ctx.tenantId)
        .first<RiskRegisterRow>();

      return json(
        {
          data: register ? toRiskRegisterResponse(register) : null,
        },
        { status: 201 },
      );
    }

    if (ctx.request.method === 'PUT' && id) {
      const body = (await ctx.request.json()) as CreateRiskRegisterInput;
      const name = body.name?.trim();

      if (!name) {
        return json(
          { error: 'invalid_risk_register', message: 'Risk register name is required.' },
          { status: 400 },
        );
      }

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE risk_registers
        SET name = ?,
            description = ?,
            updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(name, body.description?.trim() || null, id, ctx.tenantId)
        .run();

      const updated = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id, tenant_id, name, description, created_at, updated_at
        FROM risk_registers
        WHERE id = ? AND tenant_id = ?
        LIMIT 1
        `,
      )
        .bind(id, ctx.tenantId)
        .first<RiskRegisterRow>();

      return updated ? json({ data: toRiskRegisterResponse(updated) }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'DELETE' && id) {
      const result = await ctx.env.D1_MAIN.prepare(
        `DELETE FROM risk_registers WHERE id = ? AND tenant_id = ?`,
      )
        .bind(id, ctx.tenantId)
        .run();

      if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
      return json({ data: { deleted: true, id } });
    }

    if (id) {
      return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'risk-scenarios') {
    if (!ctx.tenantId) {
      return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
    }
    const accessError = await requireCorePermissionFamily(
      ctx,
      RISK_READ_PERMISSIONS,
      RISK_WRITE_PERMISSIONS,
      'Risk scenario',
    );
    if (accessError) {
      return accessError;
    }

    if (ctx.request.method === 'GET') {
      const { results } = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          scenario.id,
          scenario.tenant_id,
          scenario.register_id,
          register_item.name AS register_name,
          scenario.title,
          scenario.description,
          scenario.likelihood,
          scenario.impact,
          scenario.inherent_score,
          scenario.residual_score,
          scenario.status,
          scenario.created_at,
          scenario.updated_at
        FROM risk_scenarios AS scenario
        INNER JOIN risk_registers AS register_item
          ON register_item.id = scenario.register_id
        WHERE scenario.tenant_id = ?
        ORDER BY scenario.updated_at DESC
        `,
      )
        .bind(ctx.tenantId)
        .all<RiskScenarioRow>();

      return json({
        data: results.map(toRiskScenarioResponse),
      });
    }

    if (ctx.request.method === 'POST') {
      const body = (await ctx.request.json()) as CreateRiskScenarioInput;
      const registerId = body.registerId?.trim();
      const title = body.title?.trim();

      if (!registerId || !title) {
        return json(
          {
            error: 'invalid_risk_scenario',
            message: 'Risk scenario title and register are required.',
          },
          { status: 400 },
        );
      }

      const registerExists = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id
        FROM risk_registers
        WHERE id = ? AND tenant_id = ?
        LIMIT 1
        `,
      )
        .bind(registerId, ctx.tenantId)
        .first<{ id: string }>();

      if (!registerExists) {
        return json(
          {
            error: 'risk_register_not_found',
            message: 'The selected risk register does not exist for this tenant.',
          },
          { status: 404 },
        );
      }

      const likelihood = body.likelihood ?? null;
      const impact = body.impact ?? null;
      const inherentScore =
        body.inherentScore ?? (likelihood !== null && impact !== null ? likelihood * impact : null);
      const residualScore =
        body.residualScore ??
        (inherentScore !== null ? Math.max(Number((inherentScore * 0.65).toFixed(2)), 0) : null);
      const scenarioId = crypto.randomUUID();
      const description = body.description?.trim() || null;
      const status = body.status?.trim() || 'open';

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
          registerId,
          title,
          description,
          likelihood,
          impact,
          inherentScore,
          residualScore,
          status,
        )
        .run();

      const scenario = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          scenario.id,
          scenario.tenant_id,
          scenario.register_id,
          register_item.name AS register_name,
          scenario.title,
          scenario.description,
          scenario.likelihood,
          scenario.impact,
          scenario.inherent_score,
          scenario.residual_score,
          scenario.status,
          scenario.created_at,
          scenario.updated_at
        FROM risk_scenarios AS scenario
        INNER JOIN risk_registers AS register_item
          ON register_item.id = scenario.register_id
        WHERE scenario.id = ? AND scenario.tenant_id = ?
        LIMIT 1
        `,
      )
        .bind(scenarioId, ctx.tenantId)
        .first<RiskScenarioRow>();

      return json(
        {
          data: scenario ? toRiskScenarioResponse(scenario) : null,
        },
        { status: 201 },
      );
    }

    if (ctx.request.method === 'PUT' && id) {
      const body = (await ctx.request.json()) as CreateRiskScenarioInput;
      const title = body.title?.trim();

      if (!title) {
        return json(
          { error: 'invalid_risk_scenario', message: 'Risk scenario title is required.' },
          { status: 400 },
        );
      }

      const likelihood = body.likelihood ?? null;
      const impact = body.impact ?? null;
      const inherentScore =
        body.inherentScore ?? (likelihood !== null && impact !== null ? likelihood * impact : null);
      const residualScore =
        body.residualScore ??
        (inherentScore !== null ? Math.max(Number((inherentScore * 0.65).toFixed(2)), 0) : null);

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE risk_scenarios
        SET title = ?,
            description = ?,
            likelihood = ?,
            impact = ?,
            inherent_score = ?,
            residual_score = ?,
            status = ?,
            updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(
          title,
          body.description?.trim() || null,
          likelihood,
          impact,
          inherentScore,
          residualScore,
          body.status?.trim() || null,
          id,
          ctx.tenantId,
        )
        .run();

      const updated = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          scenario.id,
          scenario.tenant_id,
          scenario.register_id,
          register_item.name AS register_name,
          scenario.title,
          scenario.description,
          scenario.likelihood,
          scenario.impact,
          scenario.inherent_score,
          scenario.residual_score,
          scenario.status,
          scenario.created_at,
          scenario.updated_at
        FROM risk_scenarios AS scenario
        INNER JOIN risk_registers AS register_item
          ON register_item.id = scenario.register_id
        WHERE scenario.id = ? AND scenario.tenant_id = ?
        LIMIT 1
        `,
      )
        .bind(id, ctx.tenantId)
        .first<RiskScenarioRow>();

      return updated ? json({ data: toRiskScenarioResponse(updated) }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'DELETE' && id) {
      const result = await ctx.env.D1_MAIN.prepare(
        `DELETE FROM risk_scenarios WHERE id = ? AND tenant_id = ?`,
      )
        .bind(id, ctx.tenantId)
        .run();

      if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
      return json({ data: { deleted: true, id } });
    }

    if (id) {
      return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'risk-assessments') {
    if (!ctx.tenantId) {
      return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
    }
    const accessError = await requireCorePermissionFamily(
      ctx,
      RISK_READ_PERMISSIONS,
      RISK_WRITE_PERMISSIONS,
      'Risk assessment',
    );
    if (accessError) {
      return accessError;
    }

    if (id) {
      if (!subresource) {
        if (ctx.request.method !== 'GET') {
          return methodNotAllowed(['GET']);
        }

        const assessment = await ctx.env.D1_MAIN.prepare(
          `
          SELECT
            assessment.id,
            assessment.tenant_id,
            assessment.folder_id,
            folder_item.name AS folder_name,
            assessment.perimeter_id,
            perimeter_item.name AS perimeter_name,
            assessment.risk_register_id,
            register_item.name AS risk_register_name,
            assessment.ref_id,
            assessment.name,
            assessment.version,
            assessment.status,
            assessment.observation,
            COALESCE(COUNT(scenario.id), 0) AS scenario_count,
            assessment.created_at,
            assessment.updated_at
          FROM risk_assessments AS assessment
          INNER JOIN folders AS folder_item
            ON folder_item.id = assessment.folder_id
          LEFT JOIN perimeters AS perimeter_item
            ON perimeter_item.id = assessment.perimeter_id
          LEFT JOIN risk_registers AS register_item
            ON register_item.id = assessment.risk_register_id
          LEFT JOIN risk_scenarios AS scenario
            ON scenario.register_id = assessment.risk_register_id
          WHERE assessment.tenant_id = ? AND assessment.id = ?
          GROUP BY assessment.id
          LIMIT 1
          `,
        )
          .bind(ctx.tenantId, id)
          .first<RiskAssessmentRow>();

        if (!assessment) {
          return json(
            {
              error: 'risk_assessment_not_found',
              message: 'The selected risk assessment does not exist.',
            },
            { status: 404 },
          );
        }

        return json({
          data: assessment ? toRiskAssessmentResponse(assessment) : null,
        });
      }

      if (subresource === 'scenarios') {
        const assessment = await ctx.env.D1_MAIN.prepare(
          `
          SELECT id, risk_register_id
          FROM risk_assessments
          WHERE tenant_id = ? AND id = ?
          LIMIT 1
          `,
        )
          .bind(ctx.tenantId, id)
          .first<{ id: string; risk_register_id: string | null }>();

        if (!assessment) {
          return json(
            {
              error: 'risk_assessment_not_found',
              message: 'The selected risk assessment does not exist.',
            },
            { status: 404 },
          );
        }

        if (!assessment.risk_register_id) {
          return json(
            {
              error: 'risk_register_missing',
              message: 'This risk assessment does not have an associated risk register.',
            },
            { status: 400 },
          );
        }

        if (ctx.request.method === 'GET') {
          const { results } = await ctx.env.D1_MAIN.prepare(
            `
            SELECT
              scenario.id,
              scenario.tenant_id,
              scenario.register_id,
              register_item.name AS register_name,
              scenario.title,
              scenario.description,
              scenario.likelihood,
              scenario.impact,
              scenario.inherent_score,
              scenario.residual_score,
              scenario.status,
              scenario.created_at,
              scenario.updated_at
            FROM risk_scenarios AS scenario
            INNER JOIN risk_registers AS register_item
              ON register_item.id = scenario.register_id
            WHERE scenario.tenant_id = ? AND scenario.register_id = ?
            ORDER BY scenario.updated_at DESC
            `,
          )
            .bind(ctx.tenantId, assessment.risk_register_id)
            .all<RiskScenarioRow>();

          return json({
            data: results.map(toRiskScenarioResponse),
          });
        }

        if (ctx.request.method === 'POST') {
          const body = (await ctx.request.json()) as CreateRiskScenarioInput;
          const title = body.title?.trim();

          if (!title) {
            return json(
              {
                error: 'invalid_risk_scenario',
                message: 'Risk scenario title is required.',
              },
              { status: 400 },
            );
          }

          const likelihood = body.likelihood ?? null;
          const impact = body.impact ?? null;
          const inherentScore =
            body.inherentScore ??
            (likelihood !== null && impact !== null ? Number((likelihood * impact).toFixed(2)) : null);
          const residualScore =
            body.residualScore ??
            (inherentScore !== null ? Number((inherentScore * 0.65).toFixed(2)) : null);
          const scenarioId = crypto.randomUUID();

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
              assessment.risk_register_id,
              title,
              body.description?.trim() || null,
              likelihood,
              impact,
              inherentScore,
              residualScore,
              body.status?.trim() || 'open',
            )
            .run();

          const scenario = await ctx.env.D1_MAIN.prepare(
            `
            SELECT
              scenario.id,
              scenario.tenant_id,
              scenario.register_id,
              register_item.name AS register_name,
              scenario.title,
              scenario.description,
              scenario.likelihood,
              scenario.impact,
              scenario.inherent_score,
              scenario.residual_score,
              scenario.status,
              scenario.created_at,
              scenario.updated_at
            FROM risk_scenarios AS scenario
            INNER JOIN risk_registers AS register_item
              ON register_item.id = scenario.register_id
            WHERE scenario.tenant_id = ? AND scenario.id = ?
            LIMIT 1
            `,
          )
            .bind(ctx.tenantId, scenarioId)
            .first<RiskScenarioRow>();

          return json(
            {
              data: scenario ? toRiskScenarioResponse(scenario) : null,
            },
            { status: 201 },
          );
        }

        return methodNotAllowed(['GET', 'POST']);
      }

      if (subresource === 'action-plan') {
        if (ctx.request.method !== 'GET') {
          return methodNotAllowed(['GET']);
        }

        const assessment = await ctx.env.D1_MAIN.prepare(
          `
          SELECT
            assessment.id,
            assessment.tenant_id,
            assessment.folder_id,
            folder_item.name AS folder_name,
            assessment.perimeter_id,
            perimeter_item.name AS perimeter_name,
            assessment.risk_register_id,
            register_item.name AS risk_register_name,
            assessment.ref_id,
            assessment.name,
            assessment.version,
            assessment.status,
            assessment.observation,
            COALESCE(COUNT(scenario.id), 0) AS scenario_count,
            assessment.created_at,
            assessment.updated_at
          FROM risk_assessments AS assessment
          INNER JOIN folders AS folder_item
            ON folder_item.id = assessment.folder_id
          LEFT JOIN perimeters AS perimeter_item
            ON perimeter_item.id = assessment.perimeter_id
          LEFT JOIN risk_registers AS register_item
            ON register_item.id = assessment.risk_register_id
          LEFT JOIN risk_scenarios AS scenario
            ON scenario.register_id = assessment.risk_register_id
          WHERE assessment.tenant_id = ? AND assessment.id = ?
          GROUP BY assessment.id
          LIMIT 1
          `,
        )
          .bind(ctx.tenantId, id)
          .first<RiskAssessmentRow>();

        if (!assessment) {
          return json(
            {
              error: 'risk_assessment_not_found',
              message: 'The selected risk assessment does not exist.',
            },
            { status: 404 },
          );
        }

        const scenarioRows = assessment.risk_register_id
          ? (
              await ctx.env.D1_MAIN.prepare(
                `
                SELECT
                  scenario.id,
                  scenario.tenant_id,
                  scenario.register_id,
                  register_item.name AS register_name,
                  scenario.title,
                  scenario.description,
                  scenario.likelihood,
                  scenario.impact,
                  scenario.inherent_score,
                  scenario.residual_score,
                  scenario.status,
                  scenario.created_at,
                  scenario.updated_at
                FROM risk_scenarios AS scenario
                INNER JOIN risk_registers AS register_item
                  ON register_item.id = scenario.register_id
                WHERE scenario.tenant_id = ? AND scenario.register_id = ?
                ORDER BY COALESCE(scenario.residual_score, scenario.inherent_score, 0) DESC,
                  scenario.updated_at DESC
                `,
              )
                .bind(ctx.tenantId, assessment.risk_register_id)
                .all<RiskScenarioRow>()
            ).results
          : [];

        const actionPlan = scenarioRows.map(buildRiskActionPlanItem);
        const summary = {
          controlsCount: actionPlan.length,
          totalAnnualCost: actionPlan.reduce((sum, item) => sum + item.annualCost, 0),
          highestResidualScore: actionPlan.reduce(
            (highest, item) => Math.max(highest, item.residualScore),
            0,
          ),
          byPriority: actionPlan.reduce<Record<string, number>>((acc, item) => {
            acc[item.priority] = (acc[item.priority] ?? 0) + 1;
            return acc;
          }, {}),
          byStatus: actionPlan.reduce<Record<string, number>>((acc, item) => {
            acc[item.status] = (acc[item.status] ?? 0) + 1;
            return acc;
          }, {}),
        };

        if (nestedId === 'budget-overview') {
          return json({
            data: {
              assessment: toRiskAssessmentResponse(assessment),
              ...summary,
            },
          });
        }

        return json({
          data: {
            assessment: toRiskAssessmentResponse(assessment),
            actionPlan,
            summary,
          },
        });
      }

      return json({ error: 'not_found', path: segments.join('/') }, { status: 404 });
    }

    if (ctx.request.method === 'GET') {
      const { results } = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          assessment.id,
          assessment.tenant_id,
          assessment.folder_id,
          folder_item.name AS folder_name,
          assessment.perimeter_id,
          perimeter_item.name AS perimeter_name,
          assessment.risk_register_id,
          register_item.name AS risk_register_name,
          assessment.ref_id,
          assessment.name,
          assessment.version,
          assessment.status,
          assessment.observation,
          COALESCE(COUNT(scenario.id), 0) AS scenario_count,
          assessment.created_at,
          assessment.updated_at
        FROM risk_assessments AS assessment
        INNER JOIN folders AS folder_item
          ON folder_item.id = assessment.folder_id
        LEFT JOIN perimeters AS perimeter_item
          ON perimeter_item.id = assessment.perimeter_id
        LEFT JOIN risk_registers AS register_item
          ON register_item.id = assessment.risk_register_id
        LEFT JOIN risk_scenarios AS scenario
          ON scenario.register_id = assessment.risk_register_id
        WHERE assessment.tenant_id = ?
        GROUP BY assessment.id
        ORDER BY assessment.updated_at DESC
        `,
      )
        .bind(ctx.tenantId)
        .all<RiskAssessmentRow>();

      return json({
        data: results.map(toRiskAssessmentResponse),
      });
    }

    if (ctx.request.method === 'POST') {
      const body = (await ctx.request.json()) as CreateRiskAssessmentInput;
      const perimeterId = body.perimeterId?.trim();
      const riskRegisterId = body.riskRegisterId?.trim();
      const name = body.name?.trim();

      if (!perimeterId || !riskRegisterId || !name) {
        return json(
          {
            error: 'invalid_risk_assessment',
            message: 'Risk assessment name, perimeter, and risk register are required.',
          },
          { status: 400 },
        );
      }

      const perimeter = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id, folder_id
        FROM perimeters
        WHERE tenant_id = ? AND id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, perimeterId)
        .first<{ id: string; folder_id: string }>();

      if (!perimeter) {
        return json(
          { error: 'perimeter_not_found', message: 'The selected perimeter does not exist.' },
          { status: 404 },
        );
      }

      const registerExists = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id
        FROM risk_registers
        WHERE tenant_id = ? AND id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, riskRegisterId)
        .first<{ id: string }>();

      if (!registerExists) {
        return json(
          {
            error: 'risk_register_not_found',
            message: 'The selected risk register does not exist for this tenant.',
          },
          { status: 404 },
        );
      }

      const assessmentId = crypto.randomUUID();
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO risk_assessments (
          id,
          tenant_id,
          folder_id,
          perimeter_id,
          risk_register_id,
          ref_id,
          name,
          version,
          status,
          observation
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          assessmentId,
          ctx.tenantId,
          perimeter.folder_id,
          perimeterId,
          riskRegisterId,
          body.refId?.trim() || null,
          name,
          body.version?.trim() || '1.0',
          body.status?.trim() || 'planned',
          body.observation?.trim() || null,
        )
        .run();

      const assessment = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          assessment.id,
          assessment.tenant_id,
          assessment.folder_id,
          folder_item.name AS folder_name,
          assessment.perimeter_id,
          perimeter_item.name AS perimeter_name,
          assessment.risk_register_id,
          register_item.name AS risk_register_name,
          assessment.ref_id,
          assessment.name,
          assessment.version,
          assessment.status,
          assessment.observation,
          COALESCE(COUNT(scenario.id), 0) AS scenario_count,
          assessment.created_at,
          assessment.updated_at
        FROM risk_assessments AS assessment
        INNER JOIN folders AS folder_item
          ON folder_item.id = assessment.folder_id
        LEFT JOIN perimeters AS perimeter_item
          ON perimeter_item.id = assessment.perimeter_id
        LEFT JOIN risk_registers AS register_item
          ON register_item.id = assessment.risk_register_id
        LEFT JOIN risk_scenarios AS scenario
          ON scenario.register_id = assessment.risk_register_id
        WHERE assessment.id = ? AND assessment.tenant_id = ?
        GROUP BY assessment.id
        LIMIT 1
        `,
      )
        .bind(assessmentId, ctx.tenantId)
        .first<RiskAssessmentRow>();

      return json(
        {
          data: assessment ? toRiskAssessmentResponse(assessment) : null,
        },
        { status: 201 },
      );
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'compliance-assessments') {
    if (!ctx.tenantId) {
      return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
    }
    const accessError = await requireCorePermissionFamily(
      ctx,
      FRAMEWORK_READ_PERMISSIONS,
      FRAMEWORK_WRITE_PERMISSIONS,
      'Compliance assessment',
    );
    if (accessError) {
      return accessError;
    }

    if (id) {
      const assessment = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          assessment.id,
          assessment.tenant_id,
          assessment.folder_id,
          folder_item.name AS folder_name,
          assessment.perimeter_id,
          perimeter_item.name AS perimeter_name,
          assessment.framework_id,
          framework_item.name AS framework_name,
          assessment.ref_id,
          assessment.name,
          assessment.version,
          assessment.status,
          assessment.observation,
          assessment.controls_total,
          assessment.controls_assessed,
          assessment.progress_percent,
          assessment.maturity_score,
          assessment.created_at,
          assessment.updated_at
        FROM compliance_assessments AS assessment
        INNER JOIN folders AS folder_item
          ON folder_item.id = assessment.folder_id
        LEFT JOIN perimeters AS perimeter_item
          ON perimeter_item.id = assessment.perimeter_id
        INNER JOIN frameworks AS framework_item
          ON framework_item.id = assessment.framework_id
        WHERE assessment.tenant_id = ? AND assessment.id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, id)
        .first<ComplianceAssessmentRow>();

      if (!assessment) {
        return json(
          {
            error: 'compliance_assessment_not_found',
            message: 'The selected compliance assessment does not exist.',
          },
          { status: 404 },
        );
      }

      await ensureComplianceRequirementAssessments(
        ctx.env,
        ctx.tenantId,
        assessment.id,
        assessment.framework_id,
      );

      if (!subresource) {
        if (ctx.request.method !== 'GET') {
          return methodNotAllowed(['GET']);
        }

        const refreshedAssessment = await ctx.env.D1_MAIN.prepare(
          `
          SELECT
            assessment.id,
            assessment.tenant_id,
            assessment.folder_id,
            folder_item.name AS folder_name,
            assessment.perimeter_id,
            perimeter_item.name AS perimeter_name,
            assessment.framework_id,
            framework_item.name AS framework_name,
            assessment.ref_id,
            assessment.name,
            assessment.version,
            assessment.status,
            assessment.observation,
            assessment.controls_total,
            assessment.controls_assessed,
            assessment.progress_percent,
            assessment.maturity_score,
            assessment.created_at,
            assessment.updated_at
          FROM compliance_assessments AS assessment
          INNER JOIN folders AS folder_item
            ON folder_item.id = assessment.folder_id
          LEFT JOIN perimeters AS perimeter_item
            ON perimeter_item.id = assessment.perimeter_id
          INNER JOIN frameworks AS framework_item
            ON framework_item.id = assessment.framework_id
          WHERE assessment.tenant_id = ? AND assessment.id = ?
          LIMIT 1
          `,
        )
          .bind(ctx.tenantId, id)
          .first<ComplianceAssessmentRow>();

        return json({
          data: refreshedAssessment ? toComplianceAssessmentResponse(refreshedAssessment) : null,
        });
      }

      if (subresource === 'action-plan') {
        const appliedControls = (await listAppliedControlRows(ctx.env, ctx.tenantId, {
          complianceAssessmentId: id,
        })).map(toAppliedControlResponse);
        const totalAnnualCost = appliedControls.reduce(
          (sum, control) => sum + (control.annualCost ?? 0),
          0,
        );
        const byStatus = appliedControls.reduce<Record<string, number>>((acc, control) => {
          acc[control.status] = (acc[control.status] ?? 0) + 1;
          return acc;
        }, {});
        const byPriority = appliedControls.reduce<Record<string, number>>((acc, control) => {
          const key = control.priority ?? '--';
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {});

        if (nestedId === 'budget-overview') {
          if (ctx.request.method !== 'GET') {
            return methodNotAllowed(['GET']);
          }

          return json({
            data: {
              complianceAssessmentId: id,
              totalAnnualCost: Number(totalAnnualCost.toFixed(2)),
              controlsCount: appliedControls.length,
              byStatus,
              byPriority,
            },
          });
        }

        if (ctx.request.method !== 'GET') {
          return methodNotAllowed(['GET']);
        }

        return json({
          data: {
            assessment: toComplianceAssessmentResponse(assessment),
            appliedControls,
            summary: {
              controlsCount: appliedControls.length,
              totalAnnualCost: Number(totalAnnualCost.toFixed(2)),
              byStatus,
              byPriority,
            },
          },
        });
      }

      if (subresource === 'requirements' && !nestedId) {
        if (ctx.request.method !== 'GET') {
          return methodNotAllowed(['GET']);
        }

        const { results } = await ctx.env.D1_MAIN.prepare(
          `
          SELECT
            requirement.id,
            requirement.tenant_id,
            requirement.compliance_assessment_id,
            requirement.control_id,
            framework_item.id AS framework_id,
            framework_item.name AS framework_name,
            control.ref AS control_ref,
            control.title AS control_title,
            control.description AS control_description,
            requirement.result,
            requirement.observation,
            requirement.evidence_status,
            requirement.implementation_score,
            requirement.documentation_score,
            requirement.created_at,
            requirement.updated_at
          FROM compliance_requirement_assessments AS requirement
          INNER JOIN controls AS control
            ON control.id = requirement.control_id
          INNER JOIN frameworks AS framework_item
            ON framework_item.id = control.framework_id
          WHERE requirement.tenant_id = ? AND requirement.compliance_assessment_id = ?
          ORDER BY control.ref ASC
          `,
        )
          .bind(ctx.tenantId, id)
          .all<ComplianceRequirementAssessmentRow>();

        return json({
          data: results.map(toComplianceRequirementAssessmentResponse),
        });
      }

      if (subresource === 'requirements' && nestedId) {
        if (ctx.request.method !== 'POST') {
          return methodNotAllowed(['POST']);
        }

        const body = (await ctx.request.json()) as UpdateComplianceRequirementInput;

        const requirement = await ctx.env.D1_MAIN.prepare(
          `
          SELECT id
          FROM compliance_requirement_assessments
          WHERE tenant_id = ? AND compliance_assessment_id = ? AND id = ?
          LIMIT 1
          `,
        )
          .bind(ctx.tenantId, id, nestedId)
          .first<{ id: string }>();

        if (!requirement) {
          return json(
            {
              error: 'requirement_not_found',
              message: 'The selected requirement assessment does not exist.',
            },
            { status: 404 },
          );
        }

        await ctx.env.D1_MAIN.prepare(
          `
          UPDATE compliance_requirement_assessments
          SET result = ?,
              observation = ?,
              evidence_status = ?,
              implementation_score = ?,
              documentation_score = ?,
              updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
          WHERE tenant_id = ? AND compliance_assessment_id = ? AND id = ?
          `,
        )
          .bind(
            normalizeComplianceResult(body.result),
            body.observation?.trim() || null,
            normalizeEvidenceStatus(body.evidenceStatus),
            normalizeOptionalScore(body.implementationScore),
            normalizeOptionalScore(body.documentationScore),
            ctx.tenantId,
            id,
            nestedId,
          )
          .run();

        await recalculateComplianceAssessmentMetrics(ctx.env, ctx.tenantId, id);
        await syncGeneratedAppliedControlForRequirement(ctx.env, ctx.tenantId, nestedId);

        const refreshedRequirement = await ctx.env.D1_MAIN.prepare(
          `
          SELECT
            requirement.id,
            requirement.tenant_id,
            requirement.compliance_assessment_id,
            requirement.control_id,
            framework_item.id AS framework_id,
            framework_item.name AS framework_name,
            control.ref AS control_ref,
            control.title AS control_title,
            control.description AS control_description,
            requirement.result,
            requirement.observation,
            requirement.evidence_status,
            requirement.implementation_score,
            requirement.documentation_score,
            requirement.created_at,
            requirement.updated_at
          FROM compliance_requirement_assessments AS requirement
          INNER JOIN controls AS control
            ON control.id = requirement.control_id
          INNER JOIN frameworks AS framework_item
            ON framework_item.id = control.framework_id
          WHERE requirement.tenant_id = ? AND requirement.compliance_assessment_id = ? AND requirement.id = ?
          LIMIT 1
          `,
        )
          .bind(ctx.tenantId, id, nestedId)
          .first<ComplianceRequirementAssessmentRow>();

        return json({
          data: refreshedRequirement ? toComplianceRequirementAssessmentResponse(refreshedRequirement) : null,
        });
      }

      return json({ error: 'not_found', path: segments.join('/') }, { status: 404 });
    }

    if (ctx.request.method === 'GET') {
      const { results } = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          assessment.id,
          assessment.tenant_id,
          assessment.folder_id,
          folder_item.name AS folder_name,
          assessment.perimeter_id,
          perimeter_item.name AS perimeter_name,
          assessment.framework_id,
          framework_item.name AS framework_name,
          assessment.ref_id,
          assessment.name,
          assessment.version,
          assessment.status,
          assessment.observation,
          assessment.controls_total,
          assessment.controls_assessed,
          assessment.progress_percent,
          assessment.maturity_score,
          assessment.created_at,
          assessment.updated_at
        FROM compliance_assessments AS assessment
        INNER JOIN folders AS folder_item
          ON folder_item.id = assessment.folder_id
        LEFT JOIN perimeters AS perimeter_item
          ON perimeter_item.id = assessment.perimeter_id
        INNER JOIN frameworks AS framework_item
          ON framework_item.id = assessment.framework_id
        WHERE assessment.tenant_id = ?
        ORDER BY assessment.updated_at DESC
        `,
      )
        .bind(ctx.tenantId)
        .all<ComplianceAssessmentRow>();

      return json({
        data: results.map(toComplianceAssessmentResponse),
      });
    }

    if (ctx.request.method === 'POST') {
      const body = (await ctx.request.json()) as CreateComplianceAssessmentInput;
      const perimeterId = body.perimeterId?.trim();
      const frameworkId = body.frameworkId?.trim();
      const name = body.name?.trim();

      if (!perimeterId || !frameworkId || !name) {
        return json(
          {
            error: 'invalid_compliance_assessment',
            message: 'Compliance assessment name, perimeter, and framework are required.',
          },
          { status: 400 },
        );
      }

      const [perimeter, framework] = await Promise.all([
        ctx.env.D1_MAIN.prepare(
          `
          SELECT id, folder_id
          FROM perimeters
          WHERE tenant_id = ? AND id = ?
          LIMIT 1
          `,
        )
          .bind(ctx.tenantId, perimeterId)
          .first<{ id: string; folder_id: string }>(),
        ctx.env.D1_MAIN.prepare(
          `
          SELECT id
          FROM frameworks
          WHERE tenant_id = ? AND id = ?
          LIMIT 1
          `,
        )
          .bind(ctx.tenantId, frameworkId)
          .first<{ id: string }>(),
      ]);

      if (!perimeter) {
        return json(
          { error: 'perimeter_not_found', message: 'The selected perimeter does not exist.' },
          { status: 404 },
        );
      }

      if (!framework) {
        return json(
          { error: 'framework_not_found', message: 'The selected framework does not exist.' },
          { status: 404 },
        );
      }

      const controlSummary = await ctx.env.D1_MAIN.prepare(
        `
        SELECT COUNT(*) AS count
        FROM controls
        WHERE tenant_id = ? AND framework_id = ?
        `,
      )
        .bind(ctx.tenantId, frameworkId)
        .first<{ count: number }>();
      const seededControlsTotal = controlSummary?.count ?? 0;
      const controlsTotal = seededControlsTotal || Math.max(body.controlsTotal ?? 0, 0);
      const controlsAssessed = Math.max(body.controlsAssessed ?? 0, 0);
      const progressPercent =
        controlsTotal > 0 ? Math.min(Math.round((controlsAssessed / controlsTotal) * 100), 100) : 0;
      const assessmentId = crypto.randomUUID();

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO compliance_assessments (
          id,
          tenant_id,
          folder_id,
          perimeter_id,
          framework_id,
          ref_id,
          name,
          version,
          status,
          observation,
          controls_total,
          controls_assessed,
          progress_percent,
          maturity_score
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          assessmentId,
          ctx.tenantId,
          perimeter.folder_id,
          perimeterId,
          frameworkId,
          body.refId?.trim() || null,
          name,
          body.version?.trim() || '1.0',
          body.status?.trim() || 'planned',
          body.observation?.trim() || null,
          controlsTotal,
          Math.min(controlsAssessed, controlsTotal),
          progressPercent,
          body.maturityScore ?? null,
        )
        .run();

      if (seededControlsTotal > 0) {
        await ensureComplianceRequirementAssessments(ctx.env, ctx.tenantId, assessmentId, frameworkId, {
          assessedCount: Math.min(controlsAssessed, seededControlsTotal),
        });
      }

      const assessment = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          assessment.id,
          assessment.tenant_id,
          assessment.folder_id,
          folder_item.name AS folder_name,
          assessment.perimeter_id,
          perimeter_item.name AS perimeter_name,
          assessment.framework_id,
          framework_item.name AS framework_name,
          assessment.ref_id,
          assessment.name,
          assessment.version,
          assessment.status,
          assessment.observation,
          assessment.controls_total,
          assessment.controls_assessed,
          assessment.progress_percent,
          assessment.maturity_score,
          assessment.created_at,
          assessment.updated_at
        FROM compliance_assessments AS assessment
        INNER JOIN folders AS folder_item
          ON folder_item.id = assessment.folder_id
        LEFT JOIN perimeters AS perimeter_item
          ON perimeter_item.id = assessment.perimeter_id
        INNER JOIN frameworks AS framework_item
          ON framework_item.id = assessment.framework_id
        WHERE assessment.id = ? AND assessment.tenant_id = ?
        LIMIT 1
        `,
      )
        .bind(assessmentId, ctx.tenantId)
        .first<ComplianceAssessmentRow>();

      return json(
        {
          data: assessment ? toComplianceAssessmentResponse(assessment) : null,
        },
        { status: 201 },
      );
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'applied-controls') {
    if (!ctx.tenantId) {
      return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
    }
    const accessError = await requireCorePermissionFamily(
      ctx,
      FRAMEWORK_READ_PERMISSIONS,
      FRAMEWORK_WRITE_PERMISSIONS,
      'Applied control',
    );
    if (accessError) {
      return accessError;
    }

    if (id) {
      if (ctx.request.method !== 'POST') {
        return methodNotAllowed(['POST']);
      }

      const body = (await ctx.request.json()) as UpdateAppliedControlInput;

      const existing = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id
        FROM applied_controls
        WHERE tenant_id = ? AND id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, id)
        .first<{ id: string }>();

      if (!existing) {
        return json(
          {
            error: 'applied_control_not_found',
            message: 'The selected applied control does not exist.',
          },
          { status: 404 },
        );
      }

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE applied_controls
        SET status = ?,
            priority = ?,
            category = ?,
            csf_function = ?,
            owner_name = ?,
            eta = ?,
            expiry_date = ?,
            control_impact = ?,
            effort = ?,
            annual_cost = ?,
            notes = ?,
            is_generated = 0,
            updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE tenant_id = ? AND id = ?
        `,
      )
        .bind(
          normalizeAppliedControlStatus(body.status),
          normalizeAppliedControlPriority(body.priority),
          body.category?.trim() || null,
          body.csfFunction?.trim() || null,
          body.ownerName?.trim() || null,
          body.eta?.trim() || null,
          body.expiryDate?.trim() || null,
          normalizeOptionalInteger(body.controlImpact),
          normalizeAppliedControlEffort(body.effort),
          normalizeOptionalAmount(body.annualCost),
          body.notes?.trim() || null,
          ctx.tenantId,
          id,
        )
        .run();

      const updated = (await listAppliedControlRows(ctx.env, ctx.tenantId)).find(
        (control) => control.id === id,
      );

      return json({
        data: updated ? toAppliedControlResponse(updated) : null,
      });
    }

    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }

    const complianceAssessmentId = ctx.url.searchParams.get('complianceAssessmentId')?.trim() || undefined;
    const appliedControls = await listAppliedControlRows(ctx.env, ctx.tenantId, {
      complianceAssessmentId,
    });

    return json({
      data: appliedControls.map(toAppliedControlResponse),
    });
  }

  if (resource === 'entities') {
    if (!ctx.tenantId) {
      return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
    }
    const accessError = await requireCorePermissionFamily(
      ctx,
      TPRM_READ_PERMISSIONS,
      TPRM_WRITE_PERMISSIONS,
      'Third-party entity',
    );
    if (accessError) {
      return accessError;
    }

    if (id) {
      if (ctx.request.method !== 'GET') {
        return methodNotAllowed(['GET']);
      }

      const entity = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          entity.id,
          entity.tenant_id,
          entity.folder_id,
          folder_item.name AS folder_name,
          entity.parent_entity_id,
          parent_entity.name AS parent_entity_name,
          entity.ref_id,
          entity.name,
          entity.description,
          entity.relationship,
          entity.country,
          entity.currency,
          entity.is_active,
          entity.default_dependency,
          entity.default_penetration,
          entity.default_maturity,
          entity.default_trust,
          entity.mission,
          entity.reference_link,
          entity.dora_entity_type,
          entity.dora_entity_hierarchy,
          entity.dora_provider_person_type,
          COUNT(DISTINCT solution.id) AS solution_count,
          COUNT(DISTINCT contract.id) AS contract_count,
          COUNT(DISTINCT assessment.id) AS assessment_count,
          entity.created_at,
          entity.updated_at
        FROM entities AS entity
        INNER JOIN folders AS folder_item
          ON folder_item.id = entity.folder_id
        LEFT JOIN entities AS parent_entity
          ON parent_entity.id = entity.parent_entity_id
        LEFT JOIN solutions AS solution
          ON solution.provider_entity_id = entity.id
        LEFT JOIN contracts AS contract
          ON contract.provider_entity_id = entity.id OR contract.beneficiary_entity_id = entity.id
        LEFT JOIN entity_assessments AS assessment
          ON assessment.entity_id = entity.id
        WHERE entity.tenant_id = ? AND entity.id = ?
        GROUP BY entity.id
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, id)
        .first<EntityRow>();

      if (!entity) {
        return json(
          { error: 'entity_not_found', message: 'The selected entity does not exist.' },
          { status: 404 },
        );
      }

      const [solutionsResult, contractsResult, assessmentsResult] = await Promise.all([
        ctx.env.D1_MAIN.prepare(
          `
          SELECT
            solution.id,
            solution.tenant_id,
            solution.folder_id,
            folder_item.name AS folder_name,
            solution.provider_entity_id,
            provider_entity.name AS provider_entity_name,
            solution.recipient_entity_name,
            solution.ref_id,
            solution.name,
            solution.description,
            solution.is_active,
            solution.criticality,
            solution.reference_link,
            solution.dora_ict_service_type,
            solution.storage_of_data,
            solution.data_location_storage,
            solution.data_location_processing,
            solution.dora_data_sensitiveness,
            solution.dora_reliance_level,
            solution.dora_substitutability,
            solution.dora_non_substitutability_reason,
            solution.dora_has_exit_plan,
            solution.dora_reintegration_possibility,
            solution.dora_discontinuing_impact,
            solution.dora_alternative_providers,
            solution.asset_refs_json,
            solution.created_at,
            solution.updated_at
          FROM solutions AS solution
          INNER JOIN folders AS folder_item
            ON folder_item.id = solution.folder_id
          INNER JOIN entities AS provider_entity
            ON provider_entity.id = solution.provider_entity_id
          WHERE solution.tenant_id = ? AND solution.provider_entity_id = ?
          ORDER BY solution.updated_at DESC
          `,
        )
          .bind(ctx.tenantId, id)
          .all<SolutionRow>(),
        ctx.env.D1_MAIN.prepare(
          `
          SELECT
            contract.id,
            contract.tenant_id,
            contract.folder_id,
            folder_item.name AS folder_name,
            contract.provider_entity_id,
            provider_entity.name AS provider_entity_name,
            contract.beneficiary_entity_id,
            beneficiary_entity.name AS beneficiary_entity_name,
            contract.ref_id,
            contract.name,
            contract.description,
            contract.status,
            contract.start_date,
            contract.end_date,
            contract.currency,
            contract.annual_expense,
            contract.is_intragroup,
            contract.dora_contractual_arrangement,
            contract.governing_law_country,
            contract.notice_period_entity,
            contract.notice_period_provider,
            contract.dora_exclude,
            contract.solutions_json,
            contract.created_at,
            contract.updated_at
          FROM contracts AS contract
          INNER JOIN folders AS folder_item
            ON folder_item.id = contract.folder_id
          INNER JOIN entities AS provider_entity
            ON provider_entity.id = contract.provider_entity_id
          LEFT JOIN entities AS beneficiary_entity
            ON beneficiary_entity.id = contract.beneficiary_entity_id
          WHERE contract.tenant_id = ?
            AND (contract.provider_entity_id = ? OR contract.beneficiary_entity_id = ?)
          ORDER BY contract.updated_at DESC
          `,
        )
          .bind(ctx.tenantId, id, id)
          .all<ContractRow>(),
        ctx.env.D1_MAIN.prepare(
          `
          SELECT
            assessment.id,
            assessment.tenant_id,
            assessment.folder_id,
            folder_item.name AS folder_name,
            assessment.entity_id,
            entity.name AS entity_name,
            assessment.perimeter_id,
            perimeter_item.name AS perimeter_name,
            assessment.compliance_assessment_id,
            compliance_assessment.name AS compliance_assessment_name,
            assessment.ref_id,
            assessment.name,
            assessment.status,
            assessment.criticality,
            assessment.dependency,
            assessment.penetration,
            assessment.maturity,
            assessment.trust,
            assessment.conclusion,
            assessment.next_review_on,
            assessment.notes,
            assessment.created_at,
            assessment.updated_at
          FROM entity_assessments AS assessment
          INNER JOIN folders AS folder_item
            ON folder_item.id = assessment.folder_id
          INNER JOIN entities AS entity
            ON entity.id = assessment.entity_id
          LEFT JOIN perimeters AS perimeter_item
            ON perimeter_item.id = assessment.perimeter_id
          LEFT JOIN compliance_assessments AS compliance_assessment
            ON compliance_assessment.id = assessment.compliance_assessment_id
          WHERE assessment.tenant_id = ? AND assessment.entity_id = ?
          ORDER BY assessment.updated_at DESC
          `,
        )
          .bind(ctx.tenantId, id)
          .all<EntityAssessmentRow>(),
      ]);

      return json({
        data: {
          entity: toEntityResponse(entity),
          solutions: solutionsResult.results.map(toSolutionResponse),
          contracts: contractsResult.results.map(toContractResponse),
          assessments: assessmentsResult.results.map(toEntityAssessmentResponse),
        },
      });
    }

    if (ctx.request.method === 'GET') {
      const { results } = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          entity.id,
          entity.tenant_id,
          entity.folder_id,
          folder_item.name AS folder_name,
          entity.parent_entity_id,
          parent_entity.name AS parent_entity_name,
          entity.ref_id,
          entity.name,
          entity.description,
          entity.relationship,
          entity.country,
          entity.currency,
          entity.is_active,
          entity.default_dependency,
          entity.default_penetration,
          entity.default_maturity,
          entity.default_trust,
          entity.mission,
          entity.reference_link,
          entity.dora_entity_type,
          entity.dora_entity_hierarchy,
          entity.dora_provider_person_type,
          COUNT(DISTINCT solution.id) AS solution_count,
          COUNT(DISTINCT contract.id) AS contract_count,
          COUNT(DISTINCT assessment.id) AS assessment_count,
          entity.created_at,
          entity.updated_at
        FROM entities AS entity
        INNER JOIN folders AS folder_item
          ON folder_item.id = entity.folder_id
        LEFT JOIN entities AS parent_entity
          ON parent_entity.id = entity.parent_entity_id
        LEFT JOIN solutions AS solution
          ON solution.provider_entity_id = entity.id
        LEFT JOIN contracts AS contract
          ON contract.provider_entity_id = entity.id OR contract.beneficiary_entity_id = entity.id
        LEFT JOIN entity_assessments AS assessment
          ON assessment.entity_id = entity.id
        WHERE entity.tenant_id = ?
        GROUP BY entity.id
        ORDER BY entity.name ASC
        `,
      )
        .bind(ctx.tenantId)
        .all<EntityRow>();

      return json({
        data: results.map(toEntityResponse),
      });
    }

    if (ctx.request.method === 'POST') {
      const body = (await ctx.request.json()) as CreateEntityInput;
      const folderId = body.folderId?.trim();
      const name = body.name?.trim();

      if (!folderId || !name) {
        return json(
          { error: 'invalid_entity', message: 'Entity name and folder are required.' },
          { status: 400 },
        );
      }

      const [folder, parentEntity] = await Promise.all([
        ctx.env.D1_MAIN.prepare(
          `
          SELECT id
          FROM folders
          WHERE tenant_id = ? AND id = ?
          LIMIT 1
          `,
        )
          .bind(ctx.tenantId, folderId)
          .first<{ id: string }>(),
        body.parentEntityId?.trim()
          ? ctx.env.D1_MAIN.prepare(
              `
              SELECT id
              FROM entities
              WHERE tenant_id = ? AND id = ?
              LIMIT 1
              `,
            )
              .bind(ctx.tenantId, body.parentEntityId.trim())
              .first<{ id: string }>()
          : Promise.resolve(null),
      ]);

      if (!folder) {
        return json(
          { error: 'folder_not_found', message: 'The selected folder does not exist.' },
          { status: 404 },
        );
      }

      if (body.parentEntityId?.trim() && !parentEntity) {
        return json(
          { error: 'parent_entity_not_found', message: 'The selected parent entity does not exist.' },
          { status: 404 },
        );
      }

      const entityId = crypto.randomUUID();
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO entities (
          id,
          tenant_id,
          folder_id,
          parent_entity_id,
          ref_id,
          name,
          description,
          relationship,
          country,
          currency,
          is_active,
          default_dependency,
          default_penetration,
          default_maturity,
          default_trust,
          mission,
          reference_link,
          dora_entity_type,
          dora_entity_hierarchy,
          dora_provider_person_type
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          entityId,
          ctx.tenantId,
          folderId,
          body.parentEntityId?.trim() || null,
          body.refId?.trim() || null,
          name,
          body.description?.trim() || null,
          body.relationship?.trim() || null,
          body.country?.trim() || null,
          body.currency?.trim() || null,
          normalizeOptionalInteger(body.defaultDependency) ?? 0,
          normalizeOptionalInteger(body.defaultPenetration) ?? 0,
          normalizeOptionalInteger(body.defaultMaturity) ?? 1,
          normalizeOptionalInteger(body.defaultTrust) ?? 1,
          body.mission?.trim() || null,
          body.referenceLink?.trim() || null,
          body.doraEntityType?.trim() || null,
          body.doraEntityHierarchy?.trim() || null,
          body.doraProviderPersonType?.trim() || null,
        )
        .run();

      const entity = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          entity.id,
          entity.tenant_id,
          entity.folder_id,
          folder_item.name AS folder_name,
          entity.parent_entity_id,
          parent_entity.name AS parent_entity_name,
          entity.ref_id,
          entity.name,
          entity.description,
          entity.relationship,
          entity.country,
          entity.currency,
          entity.is_active,
          entity.default_dependency,
          entity.default_penetration,
          entity.default_maturity,
          entity.default_trust,
          entity.mission,
          entity.reference_link,
          entity.dora_entity_type,
          entity.dora_entity_hierarchy,
          entity.dora_provider_person_type,
          0 AS solution_count,
          0 AS contract_count,
          0 AS assessment_count,
          entity.created_at,
          entity.updated_at
        FROM entities AS entity
        INNER JOIN folders AS folder_item
          ON folder_item.id = entity.folder_id
        LEFT JOIN entities AS parent_entity
          ON parent_entity.id = entity.parent_entity_id
        WHERE entity.tenant_id = ? AND entity.id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, entityId)
        .first<EntityRow>();

      return json(
        {
          data: entity ? toEntityResponse(entity) : null,
        },
        { status: 201 },
      );
    }

    if (ctx.request.method === 'PUT' && id) {
      const body = (await ctx.request.json()) as CreateEntityInput;
      const name = body.name?.trim();

      if (!name) {
        return json(
          { error: 'invalid_entity', message: 'Entity name is required.' },
          { status: 400 },
        );
      }

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE entities
        SET name = ?,
            description = ?,
            ref_id = ?,
            relationship = ?,
            country = ?,
            currency = ?,
            mission = ?,
            reference_link = ?,
            dora_entity_type = ?,
            dora_entity_hierarchy = ?,
            dora_provider_person_type = ?,
            updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(
          name,
          body.description?.trim() || null,
          body.refId?.trim() || null,
          body.relationship?.trim() || null,
          body.country?.trim() || null,
          body.currency?.trim() || null,
          body.mission?.trim() || null,
          body.referenceLink?.trim() || null,
          body.doraEntityType?.trim() || null,
          body.doraEntityHierarchy?.trim() || null,
          body.doraProviderPersonType?.trim() || null,
          id,
          ctx.tenantId,
        )
        .run();

      const updated = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          entity.id,
          entity.tenant_id,
          entity.folder_id,
          folder_item.name AS folder_name,
          entity.parent_entity_id,
          parent_entity.name AS parent_entity_name,
          entity.ref_id,
          entity.name,
          entity.description,
          entity.relationship,
          entity.country,
          entity.currency,
          entity.is_active,
          entity.default_dependency,
          entity.default_penetration,
          entity.default_maturity,
          entity.default_trust,
          entity.mission,
          entity.reference_link,
          entity.dora_entity_type,
          entity.dora_entity_hierarchy,
          entity.dora_provider_person_type,
          0 AS solution_count,
          0 AS contract_count,
          0 AS assessment_count,
          entity.created_at,
          entity.updated_at
        FROM entities AS entity
        INNER JOIN folders AS folder_item
          ON folder_item.id = entity.folder_id
        LEFT JOIN entities AS parent_entity
          ON parent_entity.id = entity.parent_entity_id
        WHERE entity.tenant_id = ? AND entity.id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, id)
        .first<EntityRow>();

      return updated ? json({ data: toEntityResponse(updated) }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'DELETE' && id) {
      const result = await ctx.env.D1_MAIN.prepare(
        `DELETE FROM entities WHERE id = ? AND tenant_id = ?`,
      )
        .bind(id, ctx.tenantId)
        .run();

      if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
      return json({ data: { deleted: true, id } });
    }

    if (id) {
      return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'solutions') {
    if (!ctx.tenantId) {
      return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
    }
    const accessError = await requireCorePermissionFamily(
      ctx,
      TPRM_READ_PERMISSIONS,
      TPRM_WRITE_PERMISSIONS,
      'Third-party solution',
    );
    if (accessError) {
      return accessError;
    }

    if (ctx.request.method === 'GET') {
      const entityId = ctx.url.searchParams.get('entityId')?.trim();
      const predicates = ['solution.tenant_id = ?'];
      const bindings: unknown[] = [ctx.tenantId];

      if (entityId) {
        predicates.push('solution.provider_entity_id = ?');
        bindings.push(entityId);
      }

      const { results } = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          solution.id,
          solution.tenant_id,
          solution.folder_id,
          folder_item.name AS folder_name,
          solution.provider_entity_id,
          provider_entity.name AS provider_entity_name,
          solution.recipient_entity_name,
          solution.ref_id,
          solution.name,
          solution.description,
          solution.is_active,
          solution.criticality,
          solution.reference_link,
          solution.dora_ict_service_type,
          solution.storage_of_data,
          solution.data_location_storage,
          solution.data_location_processing,
          solution.dora_data_sensitiveness,
          solution.dora_reliance_level,
          solution.dora_substitutability,
          solution.dora_non_substitutability_reason,
          solution.dora_has_exit_plan,
          solution.dora_reintegration_possibility,
          solution.dora_discontinuing_impact,
          solution.dora_alternative_providers,
          solution.asset_refs_json,
          solution.created_at,
          solution.updated_at
        FROM solutions AS solution
        INNER JOIN folders AS folder_item
          ON folder_item.id = solution.folder_id
        INNER JOIN entities AS provider_entity
          ON provider_entity.id = solution.provider_entity_id
        WHERE ${predicates.join(' AND ')}
        ORDER BY solution.updated_at DESC
        `,
      )
        .bind(...bindings)
        .all<SolutionRow>();

      return json({
        data: results.map(toSolutionResponse),
      });
    }

    if (ctx.request.method === 'POST') {
      const body = (await ctx.request.json()) as CreateSolutionInput;
      const folderId = body.folderId?.trim();
      const providerEntityId = body.providerEntityId?.trim();
      const name = body.name?.trim();

      if (!folderId || !providerEntityId || !name) {
        return json(
          { error: 'invalid_solution', message: 'Solution name, folder, and provider are required.' },
          { status: 400 },
        );
      }

      const [folder, entity] = await Promise.all([
        ctx.env.D1_MAIN.prepare(
          `
          SELECT id
          FROM folders
          WHERE tenant_id = ? AND id = ?
          LIMIT 1
          `,
        )
          .bind(ctx.tenantId, folderId)
          .first<{ id: string }>(),
        ctx.env.D1_MAIN.prepare(
          `
          SELECT id
          FROM entities
          WHERE tenant_id = ? AND id = ?
          LIMIT 1
          `,
        )
          .bind(ctx.tenantId, providerEntityId)
          .first<{ id: string }>(),
      ]);

      if (!folder) {
        return json(
          { error: 'folder_not_found', message: 'The selected folder does not exist.' },
          { status: 404 },
        );
      }

      if (!entity) {
        return json(
          { error: 'provider_not_found', message: 'The selected provider entity does not exist.' },
          { status: 404 },
        );
      }

      const solutionId = crypto.randomUUID();
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO solutions (
          id,
          tenant_id,
          folder_id,
          provider_entity_id,
          recipient_entity_name,
          ref_id,
          name,
          description,
          is_active,
          criticality,
          reference_link,
          dora_ict_service_type,
          storage_of_data,
          data_location_storage,
          data_location_processing,
          dora_data_sensitiveness,
          dora_reliance_level,
          dora_alternative_providers,
          asset_refs_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          solutionId,
          ctx.tenantId,
          folderId,
          providerEntityId,
          body.recipientEntityName?.trim() || null,
          body.refId?.trim() || null,
          name,
          body.description?.trim() || null,
          normalizeOptionalInteger(body.criticality) ?? 0,
          body.referenceLink?.trim() || null,
          body.doraIctServiceType?.trim() || null,
          body.storageOfData ? 1 : 0,
          body.dataLocationStorage?.trim() || null,
          body.dataLocationProcessing?.trim() || null,
          body.doraDataSensitiveness?.trim() || null,
          body.doraRelianceLevel?.trim() || null,
          body.doraAlternativeProviders?.trim() || null,
          JSON.stringify(normalizeStringArray(body.assetRefs)),
        )
        .run();

      const solution = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          solution.id,
          solution.tenant_id,
          solution.folder_id,
          folder_item.name AS folder_name,
          solution.provider_entity_id,
          provider_entity.name AS provider_entity_name,
          solution.recipient_entity_name,
          solution.ref_id,
          solution.name,
          solution.description,
          solution.is_active,
          solution.criticality,
          solution.reference_link,
          solution.dora_ict_service_type,
          solution.storage_of_data,
          solution.data_location_storage,
          solution.data_location_processing,
          solution.dora_data_sensitiveness,
          solution.dora_reliance_level,
          solution.dora_substitutability,
          solution.dora_non_substitutability_reason,
          solution.dora_has_exit_plan,
          solution.dora_reintegration_possibility,
          solution.dora_discontinuing_impact,
          solution.dora_alternative_providers,
          solution.asset_refs_json,
          solution.created_at,
          solution.updated_at
        FROM solutions AS solution
        INNER JOIN folders AS folder_item
          ON folder_item.id = solution.folder_id
        INNER JOIN entities AS provider_entity
          ON provider_entity.id = solution.provider_entity_id
        WHERE solution.tenant_id = ? AND solution.id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, solutionId)
        .first<SolutionRow>();

      return json(
        {
          data: solution ? toSolutionResponse(solution) : null,
        },
        { status: 201 },
      );
    }

    if (ctx.request.method === 'PUT' && id) {
      const body = (await ctx.request.json()) as CreateSolutionInput;
      const name = body.name?.trim();

      if (!name) {
        return json(
          { error: 'invalid_solution', message: 'Solution name is required.' },
          { status: 400 },
        );
      }

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE solutions
        SET name = ?,
            description = ?,
            recipient_entity_name = ?,
            ref_id = ?,
            criticality = ?,
            reference_link = ?,
            dora_ict_service_type = ?,
            storage_of_data = ?,
            data_location_storage = ?,
            data_location_processing = ?,
            dora_data_sensitiveness = ?,
            dora_reliance_level = ?,
            dora_alternative_providers = ?,
            asset_refs_json = ?,
            updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(
          name,
          body.description?.trim() || null,
          body.recipientEntityName?.trim() || null,
          body.refId?.trim() || null,
          normalizeOptionalInteger(body.criticality) ?? 0,
          body.referenceLink?.trim() || null,
          body.doraIctServiceType?.trim() || null,
          body.storageOfData ? 1 : 0,
          body.dataLocationStorage?.trim() || null,
          body.dataLocationProcessing?.trim() || null,
          body.doraDataSensitiveness?.trim() || null,
          body.doraRelianceLevel?.trim() || null,
          body.doraAlternativeProviders?.trim() || null,
          JSON.stringify(normalizeStringArray(body.assetRefs)),
          id,
          ctx.tenantId,
        )
        .run();

      const updated = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          solution.id,
          solution.tenant_id,
          solution.folder_id,
          folder_item.name AS folder_name,
          solution.provider_entity_id,
          provider_entity.name AS provider_entity_name,
          solution.recipient_entity_name,
          solution.ref_id,
          solution.name,
          solution.description,
          solution.is_active,
          solution.criticality,
          solution.reference_link,
          solution.dora_ict_service_type,
          solution.storage_of_data,
          solution.data_location_storage,
          solution.data_location_processing,
          solution.dora_data_sensitiveness,
          solution.dora_reliance_level,
          solution.dora_substitutability,
          solution.dora_non_substitutability_reason,
          solution.dora_has_exit_plan,
          solution.dora_reintegration_possibility,
          solution.dora_discontinuing_impact,
          solution.dora_alternative_providers,
          solution.asset_refs_json,
          solution.created_at,
          solution.updated_at
        FROM solutions AS solution
        INNER JOIN folders AS folder_item
          ON folder_item.id = solution.folder_id
        INNER JOIN entities AS provider_entity
          ON provider_entity.id = solution.provider_entity_id
        WHERE solution.tenant_id = ? AND solution.id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, id)
        .first<SolutionRow>();

      return updated ? json({ data: toSolutionResponse(updated) }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'DELETE' && id) {
      const result = await ctx.env.D1_MAIN.prepare(
        `DELETE FROM solutions WHERE id = ? AND tenant_id = ?`,
      )
        .bind(id, ctx.tenantId)
        .run();

      if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
      return json({ data: { deleted: true, id } });
    }

    if (id) {
      return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'contracts') {
    if (!ctx.tenantId) {
      return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
    }
    const accessError = await requireCorePermissionFamily(
      ctx,
      TPRM_READ_PERMISSIONS,
      TPRM_WRITE_PERMISSIONS,
      'Contract',
    );
    if (accessError) {
      return accessError;
    }

    if (ctx.request.method === 'GET') {
      const entityId = ctx.url.searchParams.get('entityId')?.trim();
      const predicates = ['contract.tenant_id = ?'];
      const bindings: unknown[] = [ctx.tenantId];

      if (entityId) {
        predicates.push('(contract.provider_entity_id = ? OR contract.beneficiary_entity_id = ?)');
        bindings.push(entityId, entityId);
      }

      const { results } = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          contract.id,
          contract.tenant_id,
          contract.folder_id,
          folder_item.name AS folder_name,
          contract.provider_entity_id,
          provider_entity.name AS provider_entity_name,
          contract.beneficiary_entity_id,
          beneficiary_entity.name AS beneficiary_entity_name,
          contract.ref_id,
          contract.name,
          contract.description,
          contract.status,
          contract.start_date,
          contract.end_date,
          contract.currency,
          contract.annual_expense,
          contract.is_intragroup,
          contract.dora_contractual_arrangement,
          contract.governing_law_country,
          contract.notice_period_entity,
          contract.notice_period_provider,
          contract.dora_exclude,
          contract.solutions_json,
          contract.created_at,
          contract.updated_at
        FROM contracts AS contract
        INNER JOIN folders AS folder_item
          ON folder_item.id = contract.folder_id
        INNER JOIN entities AS provider_entity
          ON provider_entity.id = contract.provider_entity_id
        LEFT JOIN entities AS beneficiary_entity
          ON beneficiary_entity.id = contract.beneficiary_entity_id
        WHERE ${predicates.join(' AND ')}
        ORDER BY contract.updated_at DESC
        `,
      )
        .bind(...bindings)
        .all<ContractRow>();

      return json({
        data: results.map(toContractResponse),
      });
    }

    if (ctx.request.method === 'POST') {
      const body = (await ctx.request.json()) as CreateContractInput;
      const folderId = body.folderId?.trim();
      const providerEntityId = body.providerEntityId?.trim();
      const name = body.name?.trim();

      if (!folderId || !providerEntityId || !name) {
        return json(
          { error: 'invalid_contract', message: 'Contract name, folder, and provider are required.' },
          { status: 400 },
        );
      }

      const [folder, provider, beneficiary] = await Promise.all([
        ctx.env.D1_MAIN.prepare(
          `
          SELECT id
          FROM folders
          WHERE tenant_id = ? AND id = ?
          LIMIT 1
          `,
        )
          .bind(ctx.tenantId, folderId)
          .first<{ id: string }>(),
        ctx.env.D1_MAIN.prepare(
          `
          SELECT id
          FROM entities
          WHERE tenant_id = ? AND id = ?
          LIMIT 1
          `,
        )
          .bind(ctx.tenantId, providerEntityId)
          .first<{ id: string }>(),
        body.beneficiaryEntityId?.trim()
          ? ctx.env.D1_MAIN.prepare(
              `
              SELECT id
              FROM entities
              WHERE tenant_id = ? AND id = ?
              LIMIT 1
              `,
            )
              .bind(ctx.tenantId, body.beneficiaryEntityId.trim())
              .first<{ id: string }>()
          : Promise.resolve(null),
      ]);

      if (!folder) {
        return json(
          { error: 'folder_not_found', message: 'The selected folder does not exist.' },
          { status: 404 },
        );
      }

      if (!provider) {
        return json(
          { error: 'provider_not_found', message: 'The selected provider entity does not exist.' },
          { status: 404 },
        );
      }

      if (body.beneficiaryEntityId?.trim() && !beneficiary) {
        return json(
          {
            error: 'beneficiary_not_found',
            message: 'The selected beneficiary entity does not exist.',
          },
          { status: 404 },
        );
      }

      const contractId = crypto.randomUUID();
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO contracts (
          id,
          tenant_id,
          folder_id,
          provider_entity_id,
          beneficiary_entity_id,
          ref_id,
          name,
          description,
          status,
          start_date,
          end_date,
          currency,
          annual_expense,
          is_intragroup,
          dora_contractual_arrangement,
          governing_law_country,
          notice_period_entity,
          notice_period_provider,
          dora_exclude,
          solutions_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        `,
      )
        .bind(
          contractId,
          ctx.tenantId,
          folderId,
          providerEntityId,
          body.beneficiaryEntityId?.trim() || null,
          body.refId?.trim() || null,
          name,
          body.description?.trim() || null,
          body.status?.trim() || 'draft',
          body.startDate?.trim() || null,
          body.endDate?.trim() || null,
          body.currency?.trim() || null,
          normalizeOptionalAmount(body.annualExpense),
          body.isIntragroup ? 1 : 0,
          body.doraContractualArrangement?.trim() || null,
          body.governingLawCountry?.trim() || null,
          normalizeOptionalInteger(body.noticePeriodEntity),
          normalizeOptionalInteger(body.noticePeriodProvider),
          JSON.stringify(normalizeNamedReferenceArray(body.solutions)),
        )
        .run();

      const contract = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          contract.id,
          contract.tenant_id,
          contract.folder_id,
          folder_item.name AS folder_name,
          contract.provider_entity_id,
          provider_entity.name AS provider_entity_name,
          contract.beneficiary_entity_id,
          beneficiary_entity.name AS beneficiary_entity_name,
          contract.ref_id,
          contract.name,
          contract.description,
          contract.status,
          contract.start_date,
          contract.end_date,
          contract.currency,
          contract.annual_expense,
          contract.is_intragroup,
          contract.dora_contractual_arrangement,
          contract.governing_law_country,
          contract.notice_period_entity,
          contract.notice_period_provider,
          contract.dora_exclude,
          contract.solutions_json,
          contract.created_at,
          contract.updated_at
        FROM contracts AS contract
        INNER JOIN folders AS folder_item
          ON folder_item.id = contract.folder_id
        INNER JOIN entities AS provider_entity
          ON provider_entity.id = contract.provider_entity_id
        LEFT JOIN entities AS beneficiary_entity
          ON beneficiary_entity.id = contract.beneficiary_entity_id
        WHERE contract.tenant_id = ? AND contract.id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, contractId)
        .first<ContractRow>();

      return json(
        {
          data: contract ? toContractResponse(contract) : null,
        },
        { status: 201 },
      );
    }

    if (ctx.request.method === 'PUT' && id) {
      const body = (await ctx.request.json()) as CreateContractInput;
      const name = body.name?.trim();

      if (!name) {
        return json(
          { error: 'invalid_contract', message: 'Contract name is required.' },
          { status: 400 },
        );
      }

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE contracts
        SET name = ?,
            description = ?,
            ref_id = ?,
            status = ?,
            start_date = ?,
            end_date = ?,
            currency = ?,
            annual_expense = ?,
            is_intragroup = ?,
            dora_contractual_arrangement = ?,
            governing_law_country = ?,
            notice_period_entity = ?,
            notice_period_provider = ?,
            solutions_json = ?,
            updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(
          name,
          body.description?.trim() || null,
          body.refId?.trim() || null,
          body.status?.trim() || null,
          body.startDate?.trim() || null,
          body.endDate?.trim() || null,
          body.currency?.trim() || null,
          normalizeOptionalAmount(body.annualExpense),
          body.isIntragroup ? 1 : 0,
          body.doraContractualArrangement?.trim() || null,
          body.governingLawCountry?.trim() || null,
          normalizeOptionalInteger(body.noticePeriodEntity),
          normalizeOptionalInteger(body.noticePeriodProvider),
          JSON.stringify(normalizeNamedReferenceArray(body.solutions)),
          id,
          ctx.tenantId,
        )
        .run();

      const updated = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          contract.id,
          contract.tenant_id,
          contract.folder_id,
          folder_item.name AS folder_name,
          contract.provider_entity_id,
          provider_entity.name AS provider_entity_name,
          contract.beneficiary_entity_id,
          beneficiary_entity.name AS beneficiary_entity_name,
          contract.ref_id,
          contract.name,
          contract.description,
          contract.status,
          contract.start_date,
          contract.end_date,
          contract.currency,
          contract.annual_expense,
          contract.is_intragroup,
          contract.dora_contractual_arrangement,
          contract.governing_law_country,
          contract.notice_period_entity,
          contract.notice_period_provider,
          contract.dora_exclude,
          contract.solutions_json,
          contract.created_at,
          contract.updated_at
        FROM contracts AS contract
        INNER JOIN folders AS folder_item
          ON folder_item.id = contract.folder_id
        INNER JOIN entities AS provider_entity
          ON provider_entity.id = contract.provider_entity_id
        LEFT JOIN entities AS beneficiary_entity
          ON beneficiary_entity.id = contract.beneficiary_entity_id
        WHERE contract.tenant_id = ? AND contract.id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, id)
        .first<ContractRow>();

      return updated ? json({ data: toContractResponse(updated) }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'DELETE' && id) {
      const result = await ctx.env.D1_MAIN.prepare(
        `DELETE FROM contracts WHERE id = ? AND tenant_id = ?`,
      )
        .bind(id, ctx.tenantId)
        .run();

      if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
      return json({ data: { deleted: true, id } });
    }

    if (id) {
      return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'entity-assessments') {
    if (!ctx.tenantId) {
      return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
    }
    const accessError = await requireCorePermissionFamily(
      ctx,
      TPRM_READ_PERMISSIONS,
      TPRM_WRITE_PERMISSIONS,
      'Entity assessment',
    );
    if (accessError) {
      return accessError;
    }

    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }

    const entityId = ctx.url.searchParams.get('entityId')?.trim();
    const predicates = ['assessment.tenant_id = ?'];
    const bindings: unknown[] = [ctx.tenantId];

    if (entityId) {
      predicates.push('assessment.entity_id = ?');
      bindings.push(entityId);
    }

    const { results } = await ctx.env.D1_MAIN.prepare(
      `
      SELECT
        assessment.id,
        assessment.tenant_id,
        assessment.folder_id,
        folder_item.name AS folder_name,
        assessment.entity_id,
        entity.name AS entity_name,
        assessment.perimeter_id,
        perimeter_item.name AS perimeter_name,
        assessment.compliance_assessment_id,
        compliance_assessment.name AS compliance_assessment_name,
        assessment.ref_id,
        assessment.name,
        assessment.status,
        assessment.criticality,
        assessment.dependency,
        assessment.penetration,
        assessment.maturity,
        assessment.trust,
        assessment.conclusion,
        assessment.next_review_on,
        assessment.notes,
        assessment.created_at,
        assessment.updated_at
      FROM entity_assessments AS assessment
      INNER JOIN folders AS folder_item
        ON folder_item.id = assessment.folder_id
      INNER JOIN entities AS entity
        ON entity.id = assessment.entity_id
      LEFT JOIN perimeters AS perimeter_item
        ON perimeter_item.id = assessment.perimeter_id
      LEFT JOIN compliance_assessments AS compliance_assessment
        ON compliance_assessment.id = assessment.compliance_assessment_id
      WHERE ${predicates.join(' AND ')}
      ORDER BY assessment.updated_at DESC
      `,
    )
      .bind(...bindings)
      .all<EntityAssessmentRow>();

    return json({
      data: results.map(toEntityAssessmentResponse),
    });
  }

  if (resource === 'processings') {
    if (!ctx.tenantId) {
      return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
    }
    const accessError = await requireCorePermissionFamily(
      ctx,
      PRIVACY_READ_PERMISSIONS,
      PRIVACY_WRITE_PERMISSIONS,
      'Processing',
    );
    if (accessError) {
      return accessError;
    }

    if (id) {
      if (ctx.request.method !== 'GET') {
        return methodNotAllowed(['GET']);
      }

      const processing = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          processing.id,
          processing.tenant_id,
          processing.folder_id,
          folder_item.name AS folder_name,
          processing.ref_id,
          processing.name,
          processing.description,
          processing.status,
          processing.information_channel,
          processing.usage_channel,
          processing.dpia_required,
          processing.dpia_reference,
          processing.has_sensitive_personal_data,
          processing.perimeters_json,
          processing.purposes_json,
          processing.personal_data_json,
          processing.data_subjects_json,
          processing.data_recipients_json,
          processing.data_contractors_json,
          processing.data_transfers_json,
          processing.created_at,
          processing.updated_at
        FROM processings AS processing
        INNER JOIN folders AS folder_item
          ON folder_item.id = processing.folder_id
        WHERE processing.tenant_id = ? AND processing.id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, id)
        .first<ProcessingRow>();

      if (!processing) {
        return json(
          { error: 'processing_not_found', message: 'The selected processing does not exist.' },
          { status: 404 },
        );
      }

      return json({
        data: toProcessingResponse(processing),
      });
    }

    if (ctx.request.method === 'GET') {
      const { results } = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          processing.id,
          processing.tenant_id,
          processing.folder_id,
          folder_item.name AS folder_name,
          processing.ref_id,
          processing.name,
          processing.description,
          processing.status,
          processing.information_channel,
          processing.usage_channel,
          processing.dpia_required,
          processing.dpia_reference,
          processing.has_sensitive_personal_data,
          processing.perimeters_json,
          processing.purposes_json,
          processing.personal_data_json,
          processing.data_subjects_json,
          processing.data_recipients_json,
          processing.data_contractors_json,
          processing.data_transfers_json,
          processing.created_at,
          processing.updated_at
        FROM processings AS processing
        INNER JOIN folders AS folder_item
          ON folder_item.id = processing.folder_id
        WHERE processing.tenant_id = ?
        ORDER BY processing.updated_at DESC
        `,
      )
        .bind(ctx.tenantId)
        .all<ProcessingRow>();

      return json({
        data: results.map(toProcessingResponse),
      });
    }

    if (ctx.request.method === 'POST') {
      const body = (await ctx.request.json()) as CreateProcessingInput;
      const folderId = body.folderId?.trim();
      const name = body.name?.trim();

      if (!folderId || !name) {
        return json(
          { error: 'invalid_processing', message: 'Processing name and folder are required.' },
          { status: 400 },
        );
      }

      const folder = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id
        FROM folders
        WHERE tenant_id = ? AND id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, folderId)
        .first<{ id: string }>();

      if (!folder) {
        return json(
          { error: 'folder_not_found', message: 'The selected folder does not exist.' },
          { status: 404 },
        );
      }

      const processingId = crypto.randomUUID();
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
          information_channel,
          usage_channel,
          dpia_required,
          dpia_reference,
          has_sensitive_personal_data,
          perimeters_json,
          purposes_json,
          personal_data_json,
          data_subjects_json,
          data_recipients_json,
          data_contractors_json,
          data_transfers_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, '[]', '[]', '[]', '[]', '[]', '[]')
        `,
      )
        .bind(
          processingId,
          ctx.tenantId,
          folderId,
          body.refId?.trim() || null,
          name,
          body.description?.trim() || null,
          body.status?.trim() || 'privacy_draft',
          body.informationChannel?.trim() || null,
          body.usageChannel?.trim() || null,
          body.dpiaRequired ? 1 : 0,
          body.dpiaReference?.trim() || null,
          JSON.stringify(normalizeNamedReferenceArray(body.perimeters)),
        )
        .run();

      const processing = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          processing.id,
          processing.tenant_id,
          processing.folder_id,
          folder_item.name AS folder_name,
          processing.ref_id,
          processing.name,
          processing.description,
          processing.status,
          processing.information_channel,
          processing.usage_channel,
          processing.dpia_required,
          processing.dpia_reference,
          processing.has_sensitive_personal_data,
          processing.perimeters_json,
          processing.purposes_json,
          processing.personal_data_json,
          processing.data_subjects_json,
          processing.data_recipients_json,
          processing.data_contractors_json,
          processing.data_transfers_json,
          processing.created_at,
          processing.updated_at
        FROM processings AS processing
        INNER JOIN folders AS folder_item
          ON folder_item.id = processing.folder_id
        WHERE processing.tenant_id = ? AND processing.id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, processingId)
        .first<ProcessingRow>();

      return json(
        {
          data: processing ? toProcessingResponse(processing) : null,
        },
        { status: 201 },
      );
    }

    if (ctx.request.method === 'PUT' && id) {
      const body = (await ctx.request.json()) as CreateProcessingInput;
      const name = body.name?.trim();

      if (!name) {
        return json(
          { error: 'invalid_processing', message: 'Processing name is required.' },
          { status: 400 },
        );
      }

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE processings
        SET name = ?,
            description = ?,
            ref_id = ?,
            status = ?,
            information_channel = ?,
            usage_channel = ?,
            dpia_required = ?,
            dpia_reference = ?,
            perimeters_json = ?,
            updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(
          name,
          body.description?.trim() || null,
          body.refId?.trim() || null,
          body.status?.trim() || null,
          body.informationChannel?.trim() || null,
          body.usageChannel?.trim() || null,
          body.dpiaRequired ? 1 : 0,
          body.dpiaReference?.trim() || null,
          JSON.stringify(normalizeNamedReferenceArray(body.perimeters)),
          id,
          ctx.tenantId,
        )
        .run();

      const updated = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          processing.id,
          processing.tenant_id,
          processing.folder_id,
          folder_item.name AS folder_name,
          processing.ref_id,
          processing.name,
          processing.description,
          processing.status,
          processing.information_channel,
          processing.usage_channel,
          processing.dpia_required,
          processing.dpia_reference,
          processing.has_sensitive_personal_data,
          processing.perimeters_json,
          processing.purposes_json,
          processing.personal_data_json,
          processing.data_subjects_json,
          processing.data_recipients_json,
          processing.data_contractors_json,
          processing.data_transfers_json,
          processing.created_at,
          processing.updated_at
        FROM processings AS processing
        INNER JOIN folders AS folder_item
          ON folder_item.id = processing.folder_id
        WHERE processing.tenant_id = ? AND processing.id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, id)
        .first<ProcessingRow>();

      return updated ? json({ data: toProcessingResponse(updated) }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'DELETE' && id) {
      const result = await ctx.env.D1_MAIN.prepare(
        `DELETE FROM processings WHERE id = ? AND tenant_id = ?`,
      )
        .bind(id, ctx.tenantId)
        .run();

      if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
      return json({ data: { deleted: true, id } });
    }

    if (id) {
      return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'right-requests') {
    if (!ctx.tenantId) {
      return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
    }
    const accessError = await requireCorePermissionFamily(
      ctx,
      PRIVACY_READ_PERMISSIONS,
      PRIVACY_WRITE_PERMISSIONS,
      'Privacy right request',
    );
    if (accessError) {
      return accessError;
    }

    if (ctx.request.method === 'GET') {
      const { results } = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          request.id,
          request.tenant_id,
          request.folder_id,
          folder_item.name AS folder_name,
          request.ref_id,
          request.name,
          request.requested_on,
          request.due_date,
          request.request_type,
          request.status,
          request.observation,
          request.processings_json,
          request.created_at,
          request.updated_at
        FROM right_requests AS request
        INNER JOIN folders AS folder_item
          ON folder_item.id = request.folder_id
        WHERE request.tenant_id = ?
        ORDER BY request.requested_on DESC, request.updated_at DESC
        `,
      )
        .bind(ctx.tenantId)
        .all<RightRequestRow>();

      return json({
        data: results.map(toRightRequestResponse),
      });
    }

    if (ctx.request.method === 'POST') {
      const body = (await ctx.request.json()) as CreateRightRequestInput;
      const folderId = body.folderId?.trim();
      const name = body.name?.trim();
      const requestedOn = body.requestedOn?.trim();

      if (!folderId || !name || !requestedOn) {
        return json(
          {
            error: 'invalid_right_request',
            message: 'Right request name, folder, and requested date are required.',
          },
          { status: 400 },
        );
      }

      const folder = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id
        FROM folders
        WHERE tenant_id = ? AND id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, folderId)
        .first<{ id: string }>();

      if (!folder) {
        return json(
          { error: 'folder_not_found', message: 'The selected folder does not exist.' },
          { status: 404 },
        );
      }

      const requestId = crypto.randomUUID();
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO right_requests (
          id,
          tenant_id,
          folder_id,
          ref_id,
          name,
          requested_on,
          due_date,
          request_type,
          status,
          observation,
          processings_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          requestId,
          ctx.tenantId,
          folderId,
          body.refId?.trim() || null,
          name,
          requestedOn,
          body.dueDate?.trim() || null,
          body.requestType?.trim() || 'other',
          body.status?.trim() || 'new',
          body.observation?.trim() || null,
          JSON.stringify(normalizeNamedReferenceArray(body.processings)),
        )
        .run();

      const requestRow = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          request.id,
          request.tenant_id,
          request.folder_id,
          folder_item.name AS folder_name,
          request.ref_id,
          request.name,
          request.requested_on,
          request.due_date,
          request.request_type,
          request.status,
          request.observation,
          request.processings_json,
          request.created_at,
          request.updated_at
        FROM right_requests AS request
        INNER JOIN folders AS folder_item
          ON folder_item.id = request.folder_id
        WHERE request.tenant_id = ? AND request.id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, requestId)
        .first<RightRequestRow>();

      return json(
        {
          data: requestRow ? toRightRequestResponse(requestRow) : null,
        },
        { status: 201 },
      );
    }

    if (ctx.request.method === 'PUT' && id) {
      const body = (await ctx.request.json()) as CreateRightRequestInput;
      const name = body.name?.trim();

      if (!name) {
        return json(
          { error: 'invalid_right_request', message: 'Right request name is required.' },
          { status: 400 },
        );
      }

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE right_requests
        SET name = ?,
            ref_id = ?,
            requested_on = COALESCE(?, requested_on),
            due_date = ?,
            request_type = ?,
            status = ?,
            observation = ?,
            processings_json = ?,
            updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(
          name,
          body.refId?.trim() || null,
          body.requestedOn?.trim() || null,
          body.dueDate?.trim() || null,
          body.requestType?.trim() || null,
          body.status?.trim() || null,
          body.observation?.trim() || null,
          JSON.stringify(normalizeNamedReferenceArray(body.processings)),
          id,
          ctx.tenantId,
        )
        .run();

      const updated = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          request.id,
          request.tenant_id,
          request.folder_id,
          folder_item.name AS folder_name,
          request.ref_id,
          request.name,
          request.requested_on,
          request.due_date,
          request.request_type,
          request.status,
          request.observation,
          request.processings_json,
          request.created_at,
          request.updated_at
        FROM right_requests AS request
        INNER JOIN folders AS folder_item
          ON folder_item.id = request.folder_id
        WHERE request.tenant_id = ? AND request.id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, id)
        .first<RightRequestRow>();

      return updated ? json({ data: toRightRequestResponse(updated) }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'DELETE' && id) {
      const result = await ctx.env.D1_MAIN.prepare(
        `DELETE FROM right_requests WHERE id = ? AND tenant_id = ?`,
      )
        .bind(id, ctx.tenantId)
        .run();

      if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
      return json({ data: { deleted: true, id } });
    }

    if (id) {
      return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'data-breaches') {
    if (!ctx.tenantId) {
      return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
    }
    const accessError = await requireCorePermissionFamily(
      ctx,
      PRIVACY_READ_PERMISSIONS,
      PRIVACY_WRITE_PERMISSIONS,
      'Data breach',
    );
    if (accessError) {
      return accessError;
    }

    if (ctx.request.method === 'GET') {
      const { results } = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          breach.id,
          breach.tenant_id,
          breach.folder_id,
          folder_item.name AS folder_name,
          breach.ref_id,
          breach.name,
          breach.discovered_on,
          breach.breach_type,
          breach.risk_level,
          breach.status,
          breach.affected_subjects_count,
          breach.affected_personal_data_count,
          breach.affected_processings_json,
          breach.authority_notified_on,
          breach.subjects_notified_on,
          breach.potential_consequences,
          breach.observation,
          breach.created_at,
          breach.updated_at
        FROM data_breaches AS breach
        INNER JOIN folders AS folder_item
          ON folder_item.id = breach.folder_id
        WHERE breach.tenant_id = ?
        ORDER BY breach.discovered_on DESC, breach.updated_at DESC
        `,
      )
        .bind(ctx.tenantId)
        .all<DataBreachRow>();

      return json({
        data: results.map(toDataBreachResponse),
      });
    }

    if (ctx.request.method === 'POST') {
      const body = (await ctx.request.json()) as CreateDataBreachInput;
      const folderId = body.folderId?.trim();
      const name = body.name?.trim();
      const discoveredOn = body.discoveredOn?.trim();

      if (!folderId || !name || !discoveredOn) {
        return json(
          {
            error: 'invalid_data_breach',
            message: 'Data breach name, folder, and discovered timestamp are required.',
          },
          { status: 400 },
        );
      }

      const folder = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id
        FROM folders
        WHERE tenant_id = ? AND id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, folderId)
        .first<{ id: string }>();

      if (!folder) {
        return json(
          { error: 'folder_not_found', message: 'The selected folder does not exist.' },
          { status: 404 },
        );
      }

      const breachId = crypto.randomUUID();
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO data_breaches (
          id,
          tenant_id,
          folder_id,
          ref_id,
          name,
          discovered_on,
          breach_type,
          risk_level,
          status,
          affected_subjects_count,
          affected_personal_data_count,
          affected_processings_json,
          authority_notified_on,
          subjects_notified_on,
          potential_consequences,
          observation
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          breachId,
          ctx.tenantId,
          folderId,
          body.refId?.trim() || null,
          name,
          discoveredOn,
          body.breachType?.trim() || 'privacy_other',
          body.riskLevel?.trim() || 'privacy_risk',
          body.status?.trim() || 'privacy_discovered',
          normalizeOptionalInteger(body.affectedSubjectsCount) ?? 0,
          normalizeOptionalInteger(body.affectedPersonalDataCount) ?? 0,
          JSON.stringify(normalizeNamedReferenceArray(body.affectedProcessings)),
          body.authorityNotifiedOn?.trim() || null,
          body.subjectsNotifiedOn?.trim() || null,
          body.potentialConsequences?.trim() || null,
          body.observation?.trim() || null,
        )
        .run();

      const breach = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          breach.id,
          breach.tenant_id,
          breach.folder_id,
          folder_item.name AS folder_name,
          breach.ref_id,
          breach.name,
          breach.discovered_on,
          breach.breach_type,
          breach.risk_level,
          breach.status,
          breach.affected_subjects_count,
          breach.affected_personal_data_count,
          breach.affected_processings_json,
          breach.authority_notified_on,
          breach.subjects_notified_on,
          breach.potential_consequences,
          breach.observation,
          breach.created_at,
          breach.updated_at
        FROM data_breaches AS breach
        INNER JOIN folders AS folder_item
          ON folder_item.id = breach.folder_id
        WHERE breach.tenant_id = ? AND breach.id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, breachId)
        .first<DataBreachRow>();

      return json(
        {
          data: breach ? toDataBreachResponse(breach) : null,
        },
        { status: 201 },
      );
    }

    if (ctx.request.method === 'PUT' && id) {
      const body = (await ctx.request.json()) as CreateDataBreachInput;
      const name = body.name?.trim();

      if (!name) {
        return json(
          { error: 'invalid_data_breach', message: 'Data breach name is required.' },
          { status: 400 },
        );
      }

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE data_breaches
        SET name = ?,
            ref_id = ?,
            discovered_on = COALESCE(?, discovered_on),
            breach_type = ?,
            risk_level = ?,
            status = ?,
            affected_subjects_count = ?,
            affected_personal_data_count = ?,
            affected_processings_json = ?,
            authority_notified_on = ?,
            subjects_notified_on = ?,
            potential_consequences = ?,
            observation = ?,
            updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(
          name,
          body.refId?.trim() || null,
          body.discoveredOn?.trim() || null,
          body.breachType?.trim() || null,
          body.riskLevel?.trim() || null,
          body.status?.trim() || null,
          normalizeOptionalInteger(body.affectedSubjectsCount) ?? 0,
          normalizeOptionalInteger(body.affectedPersonalDataCount) ?? 0,
          JSON.stringify(normalizeNamedReferenceArray(body.affectedProcessings)),
          body.authorityNotifiedOn?.trim() || null,
          body.subjectsNotifiedOn?.trim() || null,
          body.potentialConsequences?.trim() || null,
          body.observation?.trim() || null,
          id,
          ctx.tenantId,
        )
        .run();

      const updated = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          breach.id,
          breach.tenant_id,
          breach.folder_id,
          folder_item.name AS folder_name,
          breach.ref_id,
          breach.name,
          breach.discovered_on,
          breach.breach_type,
          breach.risk_level,
          breach.status,
          breach.affected_subjects_count,
          breach.affected_personal_data_count,
          breach.affected_processings_json,
          breach.authority_notified_on,
          breach.subjects_notified_on,
          breach.potential_consequences,
          breach.observation,
          breach.created_at,
          breach.updated_at
        FROM data_breaches AS breach
        INNER JOIN folders AS folder_item
          ON folder_item.id = breach.folder_id
        WHERE breach.tenant_id = ? AND breach.id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, id)
        .first<DataBreachRow>();

      return updated ? json({ data: toDataBreachResponse(updated) }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'DELETE' && id) {
      const result = await ctx.env.D1_MAIN.prepare(
        `DELETE FROM data_breaches WHERE id = ? AND tenant_id = ?`,
      )
        .bind(id, ctx.tenantId)
        .run();

      if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
      return json({ data: { deleted: true, id } });
    }

    if (id) {
      return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'business-impact-analyses') {
    if (!ctx.tenantId) {
      return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
    }
    const accessError = await requireCorePermissionFamily(
      ctx,
      RESILIENCE_READ_PERMISSIONS,
      RESILIENCE_WRITE_PERMISSIONS,
      'Business impact analysis',
    );
    if (accessError) {
      return accessError;
    }

    if (id) {
      if (ctx.request.method !== 'GET') {
        return methodNotAllowed(['GET']);
      }

      const analysis = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          analysis.id,
          analysis.tenant_id,
          analysis.folder_id,
          folder_item.name AS folder_name,
          analysis.perimeter_id,
          perimeter_item.name AS perimeter_name,
          analysis.ref_id,
          analysis.name,
          analysis.description,
          analysis.version,
          analysis.status,
          analysis.observation,
          analysis.risk_matrix_name,
          analysis.risk_matrix_json,
          analysis.asset_assessments_json,
          analysis.created_at,
          analysis.updated_at
        FROM business_impact_analyses AS analysis
        INNER JOIN folders AS folder_item
          ON folder_item.id = analysis.folder_id
        LEFT JOIN perimeters AS perimeter_item
          ON perimeter_item.id = analysis.perimeter_id
        WHERE analysis.tenant_id = ? AND analysis.id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, id)
        .first<BusinessImpactAnalysisRow>();

      if (!analysis) {
        return json(
          {
            error: 'business_impact_analysis_not_found',
            message: 'The selected business impact analysis does not exist.',
          },
          { status: 404 },
        );
      }

      return json({
        data: toBusinessImpactAnalysisResponse(analysis),
      });
    }

    if (ctx.request.method === 'GET') {
      const { results } = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          analysis.id,
          analysis.tenant_id,
          analysis.folder_id,
          folder_item.name AS folder_name,
          analysis.perimeter_id,
          perimeter_item.name AS perimeter_name,
          analysis.ref_id,
          analysis.name,
          analysis.description,
          analysis.version,
          analysis.status,
          analysis.observation,
          analysis.risk_matrix_name,
          analysis.risk_matrix_json,
          analysis.asset_assessments_json,
          analysis.created_at,
          analysis.updated_at
        FROM business_impact_analyses AS analysis
        INNER JOIN folders AS folder_item
          ON folder_item.id = analysis.folder_id
        LEFT JOIN perimeters AS perimeter_item
          ON perimeter_item.id = analysis.perimeter_id
        WHERE analysis.tenant_id = ?
        ORDER BY analysis.updated_at DESC
        `,
      )
        .bind(ctx.tenantId)
        .all<BusinessImpactAnalysisRow>();

      return json({
        data: results.map(toBusinessImpactAnalysisResponse),
      });
    }

    if (ctx.request.method === 'POST') {
      const body = (await ctx.request.json()) as CreateBusinessImpactAnalysisInput;
      const perimeterId = body.perimeterId?.trim();
      const name = body.name?.trim();

      if (!perimeterId || !name) {
        return json(
          {
            error: 'invalid_business_impact_analysis',
            message: 'Business impact analysis name and perimeter are required.',
          },
          { status: 400 },
        );
      }

      const perimeter = await ctx.env.D1_MAIN.prepare(
        `
        SELECT id, folder_id
        FROM perimeters
        WHERE tenant_id = ? AND id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, perimeterId)
        .first<{ id: string; folder_id: string }>();

      if (!perimeter) {
        return json(
          { error: 'perimeter_not_found', message: 'The selected perimeter does not exist.' },
          { status: 404 },
        );
      }

      const analysisId = crypto.randomUUID();
      const riskMatrixJson = JSON.stringify({
        levels: [
          { label: 'Low', score: 1, tone: 'emerald' },
          { label: 'Guarded', score: 2, tone: 'lime' },
          { label: 'Material', score: 3, tone: 'amber' },
          { label: 'High', score: 4, tone: 'orange' },
          { label: 'Critical', score: 5, tone: 'rose' },
        ],
      });

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO business_impact_analyses (
          id,
          tenant_id,
          folder_id,
          perimeter_id,
          ref_id,
          name,
          description,
          version,
          status,
          observation,
          risk_matrix_name,
          risk_matrix_json,
          asset_assessments_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')
        `,
      )
        .bind(
          analysisId,
          ctx.tenantId,
          perimeter.folder_id,
          perimeterId,
          body.refId?.trim() || null,
          name,
          body.description?.trim() || null,
          body.version?.trim() || '1.0',
          body.status?.trim() || 'planned',
          body.observation?.trim() || null,
          body.riskMatrixName?.trim() || 'Recovery Matrix',
          riskMatrixJson,
        )
        .run();

      const analysis = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          analysis.id,
          analysis.tenant_id,
          analysis.folder_id,
          folder_item.name AS folder_name,
          analysis.perimeter_id,
          perimeter_item.name AS perimeter_name,
          analysis.ref_id,
          analysis.name,
          analysis.description,
          analysis.version,
          analysis.status,
          analysis.observation,
          analysis.risk_matrix_name,
          analysis.risk_matrix_json,
          analysis.asset_assessments_json,
          analysis.created_at,
          analysis.updated_at
        FROM business_impact_analyses AS analysis
        INNER JOIN folders AS folder_item
          ON folder_item.id = analysis.folder_id
        LEFT JOIN perimeters AS perimeter_item
          ON perimeter_item.id = analysis.perimeter_id
        WHERE analysis.tenant_id = ? AND analysis.id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, analysisId)
        .first<BusinessImpactAnalysisRow>();

      return json(
        {
          data: analysis ? toBusinessImpactAnalysisResponse(analysis) : null,
        },
        { status: 201 },
      );
    }

    if (ctx.request.method === 'PUT' && id) {
      const body = (await ctx.request.json()) as CreateBusinessImpactAnalysisInput;
      const name = body.name?.trim();

      if (!name) {
        return json(
          { error: 'invalid_business_impact_analysis', message: 'Business impact analysis name is required.' },
          { status: 400 },
        );
      }

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE business_impact_analyses
        SET name = ?,
            description = ?,
            ref_id = ?,
            version = ?,
            status = ?,
            observation = ?,
            risk_matrix_name = ?,
            updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(
          name,
          body.description?.trim() || null,
          body.refId?.trim() || null,
          body.version?.trim() || null,
          body.status?.trim() || null,
          body.observation?.trim() || null,
          body.riskMatrixName?.trim() || null,
          id,
          ctx.tenantId,
        )
        .run();

      const updated = await ctx.env.D1_MAIN.prepare(
        `
        SELECT
          analysis.id,
          analysis.tenant_id,
          analysis.folder_id,
          folder_item.name AS folder_name,
          analysis.perimeter_id,
          perimeter_item.name AS perimeter_name,
          analysis.ref_id,
          analysis.name,
          analysis.description,
          analysis.version,
          analysis.status,
          analysis.observation,
          analysis.risk_matrix_name,
          analysis.risk_matrix_json,
          analysis.asset_assessments_json,
          analysis.created_at,
          analysis.updated_at
        FROM business_impact_analyses AS analysis
        INNER JOIN folders AS folder_item
          ON folder_item.id = analysis.folder_id
        LEFT JOIN perimeters AS perimeter_item
          ON perimeter_item.id = analysis.perimeter_id
        WHERE analysis.tenant_id = ? AND analysis.id = ?
        LIMIT 1
        `,
      )
        .bind(ctx.tenantId, id)
        .first<BusinessImpactAnalysisRow>();

      return updated ? json({ data: toBusinessImpactAnalysisResponse(updated) }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'DELETE' && id) {
      const result = await ctx.env.D1_MAIN.prepare(
        `DELETE FROM business_impact_analyses WHERE id = ? AND tenant_id = ?`,
      )
        .bind(id, ctx.tenantId)
        .run();

      if (!result.meta.changes) return json({ error: 'not_found' }, { status: 404 });
      return json({ data: { deleted: true, id } });
    }

    if (id) {
      return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'bootstrap-demo') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }

    if (ctx.env.APP_ENV === 'production') {
      return json(
        { error: 'demo_disabled', message: 'Demo bootstrap is disabled in production.' },
        { status: 403 },
      );
    }

    const seeded = await bootstrapDemoTenant(ctx.env);

    return json({
      data: {
        ...seeded,
        message: 'Demo workspace seeded for CISO Assistant.',
      },
    });
  }

  if (resource === 'tenants' && id && subresource === 'workflows') {
    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }

    if (ctx.tenantId && ctx.tenantId !== id) {
      return json(
        { error: 'tenant_mismatch', message: 'Requested tenant does not match auth context.' },
        { status: 403 },
      );
    }

    const snapshot = await getTenantWorkflowSnapshot(ctx.env, id);

    return json({
        data: {
          tenantId: id,
          workflowState: snapshot,
        },
      });
  }

  return json({ error: 'not_found', path: segments.join('/') }, { status: 404 });
}
