import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Box,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Database,
  Eye,
  FileCheck2,
  FileText,
  HelpCircle,
  History,
  Home,
  Link2,
  List,
  Lock,
  Megaphone,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  UserPlus,
  Users,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import './VantaClonePage.css';
import {
  AddControlsModalScreen,
  AddDocumentToControlModalScreen,
  AddRiskScenarioModalScreen,
  AddTestToControlModalScreen,
  AssignApproverModalScreen,
  AuditModalScreen,
  ConsoleHomeScreen,
  ConsoleHomeTooltipScreen,
  ConsoleProgramHealthScreen,
  ControlsImportReviewScreen,
  ControlsOverviewScreen,
  ControlsUploadScreen,
  CreateCustomPolicyScreen,
  CustomPolicyDetailScreen,
  CustomTestModalScreen,
  CustomTestsFilteredScreen,
  DeactivatedTestsScreen,
  DocumentDetailScreen,
  DocumentUploadDetailsModalScreen,
  DocumentUploadScreen,
  DocumentsListScreen,
  EditCustomDocumentRequestScreen,
  EmployeeAssignmentModalScreen,
  FrameworkControlDrawerScreen,
  FrameworkDetailScreen,
  FrameworkImportModalScreen,
  FrameworkImportReviewScreen,
  FrameworkUploadScreen,
  FrameworksCatalogScreen,
  FrameworkScopeScreen,
  HomeWelcomeScreen,
  IntegrationScopeConfigScreen,
  IntegrationsCatalogScreen,
  InventoryScopeScreen,
  JiraTestDetailScreen,
  NewCustomDocumentScreen,
  NotificationsSettingsScreen,
  PeopleTaskStatusScreen,
  PoliciesListScreen,
  PolicyCreateVersionScreen,
  PolicyEditorScreen,
  PolicyReacceptModalScreen,
  PolicySyncConfluenceScreen,
  PolicyTemplatesScreen,
  PolicyUploadVersionScreen,
  PolicyVersionEmptyScreen,
  PolicyBuilderScreen,
  PrivacyPeopleScopeScreen,
  RiskLibraryScreen,
  ScopeSettingsScreen,
  StarterGuideScreen,
  TestDeactivateMenuScreen,
  TestDetailScreen,
  TestsOverviewScreen,
  UsersAccessScreen,
} from './VantaAdditionalScreens';

type Screen =
  | 'vendor'
  | 'starterGuide'
  | 'commitments'
  | 'people'
  | 'peopleTasks'
  | 'complianceReport'
  | 'riskReport'
  | 'questionnaire'
  | 'audits'
  | 'auditModal'
  | 'documents'
  | 'policies'
  | 'policyBuilder'
  | 'thirdPartyPolicy'
  | 'addControlsModal'
  | 'testsOverview'
  | 'testDetail'
  | 'testDeactivateMenu'
  | 'deactivatedTests'
  | 'controlsOverview'
  | 'controlsUpload'
  | 'controlsReview'
  | 'frameworksCatalog'
  | 'frameworkImport'
  | 'frameworkUpload'
  | 'frameworkReview'
  | 'frameworkDetail'
  | 'frameworkControlDrawer'
  | 'frameworkScope'
  | 'integrationScope'
  | 'inventoryScope'
  | 'privacyPeopleScope'
  | 'scopeSettings'
  | 'consoleProgram'
  | 'consoleHome'
  | 'consoleHomeTooltip'
  | 'homeWelcome'
  | 'notificationsSettings'
  | 'integrations'
  | 'riskLibrary'
  | 'addRiskScenario'
  | 'users'
  | 'usersAdd'
  | 'usersSelected'
  | 'usersPlain'
  | 'customTestModal'
  | 'customTestsFiltered'
  | 'jiraTestDetail'
  | 'addTestControl'
  | 'documentsList'
  | 'newDocument'
  | 'addDocumentControl'
  | 'addDocumentControlSelected'
  | 'documentUpload'
  | 'documentUploadDetails'
  | 'documentDetail'
  | 'documentDetailMore'
  | 'editDocumentRequest'
  | 'policyTemplates'
  | 'policyEditor'
  | 'assignApprover'
  | 'policyReaccept'
  | 'policyVersionEmpty'
  | 'policyCreateVersion'
  | 'policyUploadVersion'
  | 'policySyncConfluence'
  | 'createCustomPolicy'
  | 'customPolicyDetail'
  | 'employeeAssignment';

type NavChild = {
  label: string;
  screen: Screen;
};

type NavItem = {
  label: string;
  icon?: LucideIcon;
  screen?: Screen;
  sectionBreak?: boolean;
  children?: NavChild[];
};

const routeByScreen: Record<Screen, string> = {
  vendor: '/vanta-clone/vendors',
  starterGuide: '/vanta-clone/starter-guide',
  commitments: '/vanta-clone/customer-trust/commitments',
  people: '/vanta-clone/personnel/people',
  peopleTasks: '/vanta-clone/personnel/people/tasks',
  complianceReport: '/vanta-clone/reports/compliance',
  riskReport: '/vanta-clone/reports/risk',
  questionnaire: '/vanta-clone/questionnaires/tasknimbus',
  audits: '/vanta-clone/compliance/audits',
  auditModal: '/vanta-clone/compliance/audits/new',
  documents: '/vanta-clone/compliance/documents',
  policies: '/vanta-clone/compliance/policies',
  policyBuilder: '/vanta-clone/compliance/policies/code-of-conduct',
  thirdPartyPolicy: '/vanta-clone/compliance/policies/third-party-management',
  addControlsModal: '/vanta-clone/compliance/policies/third-party-management/add-controls',
  testsOverview: '/vanta-clone/tests',
  testDetail: '/vanta-clone/tests/inventory-owners',
  testDeactivateMenu: '/vanta-clone/tests/asset-management-policy/deactivate',
  deactivatedTests: '/vanta-clone/tests/deactivated',
  controlsOverview: '/vanta-clone/controls',
  controlsUpload: '/vanta-clone/controls/upload',
  controlsReview: '/vanta-clone/controls/review-finalize',
  frameworksCatalog: '/vanta-clone/frameworks',
  frameworkImport: '/vanta-clone/frameworks/import',
  frameworkUpload: '/vanta-clone/frameworks/upload',
  frameworkReview: '/vanta-clone/frameworks/review-finalize',
  frameworkDetail: '/vanta-clone/frameworks/test-framework/controls',
  frameworkControlDrawer: '/vanta-clone/frameworks/test-framework/controls/drawer',
  frameworkScope: '/vanta-clone/frameworks/esg-demo/scope',
  integrationScope: '/vanta-clone/frameworks/esg-demo/scope/addigy',
  inventoryScope: '/vanta-clone/inventory/autoscale-groups',
  privacyPeopleScope: '/vanta-clone/frameworks/australian-privacy-principles/people',
  scopeSettings: '/vanta-clone/frameworks/australian-privacy-principles/scope-settings',
  consoleProgram: '/vanta-clone/console/program-health',
  consoleHome: '/vanta-clone/console/home',
  consoleHomeTooltip: '/vanta-clone/console/home-tooltip',
  homeWelcome: '/vanta-clone/home/welcome',
  notificationsSettings: '/vanta-clone/settings/notifications',
  integrations: '/vanta-clone/integrations',
  riskLibrary: '/vanta-clone/risk/library',
  addRiskScenario: '/vanta-clone/risk/register/add-scenario',
  users: '/vanta-clone/users',
  usersAdd: '/vanta-clone/users/add',
  usersSelected: '/vanta-clone/users/selected',
  usersPlain: '/vanta-clone/users/plain',
  customTestModal: '/vanta-clone/tests/custom/new',
  customTestsFiltered: '/vanta-clone/tests/custom',
  jiraTestDetail: '/vanta-clone/tests/jira-test',
  addTestControl: '/vanta-clone/tests/jira-test/add-control',
  documentsList: '/vanta-clone/compliance/documents/all',
  newDocument: '/vanta-clone/compliance/documents/new',
  addDocumentControl: '/vanta-clone/compliance/documents/new-control',
  addDocumentControlSelected: '/vanta-clone/compliance/documents/new-control-selected',
  documentUpload: '/vanta-clone/compliance/documents/upload',
  documentUploadDetails: '/vanta-clone/compliance/documents/upload/details',
  documentDetail: '/vanta-clone/compliance/documents/board-charter',
  documentDetailMore: '/vanta-clone/compliance/documents/board-charter/more',
  editDocumentRequest: '/vanta-clone/compliance/documents/edit-custom-request',
  policyTemplates: '/vanta-clone/compliance/policies/templates',
  policyEditor: '/vanta-clone/compliance/policies/access-control/editor',
  assignApprover: '/vanta-clone/compliance/policies/access-control/approver',
  policyReaccept: '/vanta-clone/compliance/policies/access-control/reaccept',
  policyVersionEmpty: '/vanta-clone/compliance/policies/access-control/version-empty',
  policyCreateVersion: '/vanta-clone/compliance/policies/access-control/version',
  policyUploadVersion: '/vanta-clone/compliance/policies/access-control/upload-version',
  policySyncConfluence: '/vanta-clone/compliance/policies/access-control/sync-confluence',
  createCustomPolicy: '/vanta-clone/compliance/policies/new-custom',
  customPolicyDetail: '/vanta-clone/compliance/policies/help-center-review',
  employeeAssignment: '/vanta-clone/compliance/policies/help-center-review/employee-assignment',
};

const screenFromPath = (pathname: string): Screen => {
  if (pathname.includes('/starter-guide')) return 'starterGuide';
  if (pathname.includes('/frameworks/upload')) return 'frameworkUpload';
  if (pathname.includes('/frameworks/review-finalize')) return 'frameworkReview';
  if (pathname.includes('/frameworks/test-framework/controls/drawer')) return 'frameworkControlDrawer';
  if (pathname.includes('/tests/custom/new')) return 'customTestModal';
  if (pathname.includes('/tests/custom')) return 'customTestsFiltered';
  if (pathname.includes('/tests/jira-test/add-control')) return 'addTestControl';
  if (pathname.includes('/tests/jira-test')) return 'jiraTestDetail';
  if (pathname.includes('/compliance/documents/new-control-selected')) return 'addDocumentControlSelected';
  if (pathname.includes('/compliance/documents/new-control')) return 'addDocumentControl';
  if (pathname.includes('/compliance/documents/upload/details')) return 'documentUploadDetails';
  if (pathname.includes('/compliance/documents/upload')) return 'documentUpload';
  if (pathname.includes('/compliance/documents/board-charter/more')) return 'documentDetailMore';
  if (pathname.includes('/compliance/documents/board-charter')) return 'documentDetail';
  if (pathname.includes('/compliance/documents/edit-custom-request')) return 'editDocumentRequest';
  if (pathname.includes('/compliance/documents/new')) return 'newDocument';
  if (pathname.includes('/compliance/documents/all')) return 'documentsList';
  if (pathname.includes('/compliance/policies/access-control/editor')) return 'policyEditor';
  if (pathname.includes('/compliance/policies/access-control/approver')) return 'assignApprover';
  if (pathname.includes('/compliance/policies/access-control/reaccept')) return 'policyReaccept';
  if (pathname.includes('/compliance/policies/access-control/version-empty')) return 'policyVersionEmpty';
  if (pathname.includes('/compliance/policies/access-control/upload-version')) return 'policyUploadVersion';
  if (pathname.includes('/compliance/policies/access-control/sync-confluence')) return 'policySyncConfluence';
  if (pathname.includes('/compliance/policies/access-control/version')) return 'policyCreateVersion';
  if (pathname.includes('/compliance/policies/new-custom')) return 'createCustomPolicy';
  if (pathname.includes('/compliance/policies/help-center-review/employee-assignment')) return 'employeeAssignment';
  if (pathname.includes('/compliance/policies/help-center-review')) return 'customPolicyDetail';
  if (pathname.includes('/compliance/policies/templates')) return 'policyTemplates';
  if (pathname.includes('/compliance/policies/code-of-conduct')) return 'policyBuilder';
  if (pathname.includes('/compliance/policies/third-party-management/add-controls')) return 'addControlsModal';
  if (pathname.includes('/compliance/policies/third-party-management')) return 'thirdPartyPolicy';
  if (pathname.includes('/compliance/policies')) return 'policies';
  if (pathname.includes('/personnel/people/tasks')) return 'peopleTasks';
  if (pathname.includes('/tests/asset-management-policy/deactivate')) return 'testDeactivateMenu';
  if (pathname.includes('/tests/inventory-owners')) return 'testDetail';
  if (pathname.includes('/tests/deactivated')) return 'deactivatedTests';
  if (pathname.endsWith('/vanta-clone/tests') || pathname.includes('/vanta-clone/tests?')) return 'testsOverview';
  if (pathname.includes('/controls/upload')) return 'controlsUpload';
  if (pathname.includes('/controls/review-finalize')) return 'controlsReview';
  if (pathname.endsWith('/vanta-clone/controls')) return 'controlsOverview';
  if (pathname.includes('/frameworks/import')) return 'frameworkImport';
  if (pathname.includes('/frameworks/test-framework/controls')) return 'frameworkDetail';
  if (pathname.includes('/frameworks/esg-demo/scope/addigy')) return 'integrationScope';
  if (pathname.includes('/frameworks/esg-demo/scope')) return 'frameworkScope';
  if (pathname.endsWith('/vanta-clone/frameworks')) return 'frameworksCatalog';
  if (pathname.includes('/inventory/autoscale-groups')) return 'inventoryScope';
  if (pathname.includes('/frameworks/australian-privacy-principles/scope-settings')) return 'scopeSettings';
  if (pathname.includes('/frameworks/australian-privacy-principles/people')) return 'privacyPeopleScope';
  if (pathname.includes('/compliance/audits/new')) return 'auditModal';
  if (pathname.includes('/console/home-tooltip')) return 'consoleHomeTooltip';
  if (pathname.includes('/home/welcome')) return 'homeWelcome';
  if (pathname.includes('/console/home')) return 'consoleHome';
  if (pathname.includes('/console/program-health')) return 'consoleProgram';
  if (pathname.includes('/settings/notifications')) return 'notificationsSettings';
  if (pathname.includes('/integrations')) return 'integrations';
  if (pathname.includes('/risk/register/add-scenario')) return 'addRiskScenario';
  if (pathname.includes('/risk/library')) return 'riskLibrary';
  if (pathname.includes('/users/add')) return 'usersAdd';
  if (pathname.includes('/users/selected')) return 'usersSelected';
  if (pathname.includes('/users/plain')) return 'usersPlain';
  if (pathname.includes('/users')) return 'users';
  if (pathname.includes('/customer-trust/commitments')) return 'commitments';
  if (pathname.includes('/personnel/people')) return 'people';
  if (pathname.includes('/reports/risk')) return 'riskReport';
  if (pathname.includes('/reports/compliance')) return 'complianceReport';
  if (pathname.includes('/questionnaires/tasknimbus')) return 'questionnaire';
  if (pathname.includes('/compliance/audits')) return 'audits';
  if (pathname.includes('/compliance/documents')) return 'documents';
  return 'vendor';
};

const vendor: Screen = 'vendor';
const documents: Screen = 'documents';
const complianceReport: Screen = 'complianceReport';
const commitments: Screen = 'commitments';
const riskReport: Screen = 'riskReport';
const audits: Screen = 'audits';
const people: Screen = 'people';
const questionnaire: Screen = 'questionnaire';
const policies: Screen = 'policies';
const integrations: Screen = 'integrations';
const testsOverview: Screen = 'testsOverview';
const inventoryScope: Screen = 'inventoryScope';
const controlsOverview: Screen = 'controlsOverview';
const frameworksCatalog: Screen = 'frameworksCatalog';

const normalNav: NavItem[] = [
  { label: 'Home', icon: Home, screen: 'consoleHome' },
  { label: 'Starter guide', screen: 'starterGuide' },
  { label: 'Tests', icon: ClipboardCheck, screen: testsOverview },
  { label: 'Reports', icon: BarChart3, screen: complianceReport },
  {
    label: 'Compliance',
    icon: ClipboardCheck,
    screen: audits,
    sectionBreak: true,
    children: [
      { label: 'Frameworks', screen: frameworksCatalog },
      { label: 'Controls', screen: controlsOverview },
      { label: 'Policies', screen: policies },
      { label: 'Documents', screen: documents },
      { label: 'Audits', screen: audits },
      { label: 'Issues', screen: riskReport },
    ],
  },
  {
    label: 'Customer Trust',
    icon: ShieldCheck,
    screen: commitments,
    children: [
      { label: 'Overview', screen: commitments },
      { label: 'Trust Center', screen: commitments },
      { label: 'Questionnaires', screen: questionnaire },
      { label: 'Commitments', screen: commitments },
      { label: 'Accounts', screen: commitments },
      { label: 'Knowledge Base', screen: commitments },
      { label: 'Settings', screen: commitments },
    ],
  },
  { label: 'Risk', icon: Shield, screen: riskReport },
  {
    label: 'Vendors',
    icon: Briefcase,
    screen: vendor,
    children: [
      { label: 'Overview', screen: vendor },
      { label: 'Discovery', screen: vendor },
      { label: 'Procurement', screen: vendor },
      { label: 'Security reviews', screen: vendor },
      { label: 'Managed vendors', screen: vendor },
      { label: 'Reports', screen: vendor },
      { label: 'Settings', screen: vendor },
    ],
  },
  { label: 'Assets', icon: Database, screen: inventoryScope },
  {
    label: 'Personnel',
    icon: Users,
    screen: people,
    children: [
      { label: 'People', screen: people },
      { label: 'Computers', screen: people },
      { label: 'Access', screen: people },
      { label: 'Settings', screen: people },
    ],
  },
  { label: 'Integrations', icon: Link2, screen: integrations, sectionBreak: true },
];

const compactIcons: { icon: LucideIcon; screen: Screen; label: string; divider?: boolean }[] = [
  { icon: Search, screen: vendor, label: 'Search' },
  { icon: Home, screen: vendor, label: 'Home' },
  { icon: Clock3, screen: questionnaire, label: 'Questionnaires' },
  { icon: List, screen: questionnaire, label: 'Tasks' },
  { icon: BarChart3, screen: complianceReport, label: 'Reports', divider: true },
  { icon: ClipboardCheck, screen: audits, label: 'Audits' },
  { icon: ShieldCheck, screen: documents, label: 'Evidence' },
  { icon: CircleAlert, screen: riskReport, label: 'Risks' },
  { icon: Briefcase, screen: vendor, label: 'Vendors' },
  { icon: Database, screen: documents, label: 'Assets' },
  { icon: Users, screen: people, label: 'People' },
  { icon: Zap, screen: commitments, label: 'Integrations', divider: true },
];

const documentNav: { icon: LucideIcon; label: string; target: Screen; divider?: boolean }[] = [
  { icon: Home, label: 'Home', target: vendor },
  { icon: CheckCircle2, label: 'My work', target: documents },
  { icon: List, label: 'Tests', target: testsOverview },
  { icon: BarChart3, label: 'Reports', target: complianceReport },
  { icon: ClipboardCheck, label: 'Compliance', target: audits, divider: true },
  { icon: ShieldCheck, label: 'Trust Center', target: commitments },
  { icon: CircleAlert, label: 'Risk', target: riskReport },
  { icon: Briefcase, label: 'Vendors', target: vendor },
  { icon: Database, label: 'Assets', target: documents },
  { icon: Users, label: 'Personnel', target: people },
  { icon: Zap, label: 'Integrations', target: integrations, divider: true },
];

const documentComplianceChildren: NavChild[] = [
  { label: 'Frameworks', screen: frameworksCatalog },
  { label: 'Controls', screen: controlsOverview },
  { label: 'Policies', screen: policies },
  { label: 'Documents', screen: documents },
  { label: 'Audits', screen: audits },
  { label: 'Issues', screen: riskReport },
];

const peopleRows = [
  ['Aarav Singh', 'aarav.singh@acme.co', 'Current', 'Aug 11', '-', 'Okta', '2 Overdue', 'Oct 1', 'red', 12],
  ['Aiden Park', 'aiden.park@acme.co', 'Current', 'Dec 5', '-', 'Okta', '1 Overdue', 'Oct 1', 'red', 16],
  ['Aileen Khalid', 'aileen.khalid@acme.co', 'Current', 'May 22', '-', 'Okta', '1 Due soon', 'Oct 1', 'yellow', 26],
  ['Akira Tanaka', 'akira.tanaka@acme.co', 'Terminated', 'May 17', 'Sep 15', 'Okta', '1 Due soon', '-', 'yellow', 32],
  ['Alejandro Garcia', 'alejandro.garcia@acme.co', 'Upcoming', 'Nov 20', '-', 'Vanta', '5 Due soon', '-', 'yellow', 44],
  ['Alessandro Rossi', 'alessandro.rossi@acme.co', 'Current', 'Mar 27', '-', 'Okta', '2 Due soon', 'Oct 1', 'yellow', 54],
  ['Alina Zhang', 'alina.zhang@acme.co', 'Upcoming', 'Dec 2', '-', 'Vanta', '5 Due soon', '-', 'yellow', 65],
  ['Amy Prawnson', 'amy.prawnson@acme.co', 'Current', 'Aug 27', '-', 'Okta', '3 Due soon', 'Oct 1', 'yellow', 72],
  ['Anastasia Ivanov', 'ana.ivanov@acme.co', 'Current', 'Jan 4', '-', 'Okta', '1 Overdue', 'Oct 1', 'red', 5],
] as const;

const questionnaireRows = [
  [
    'Do you have approved Information Security policies and standards?',
    'Information Security policies are approved, documented, and reviewe...',
    'AD',
  ],
  [
    'Is there an information security function (with more than 50 staffs) responsible fo...',
    'The team is comprised of Directors of Security, an Engineering...',
    'CF',
  ],
  [
    'Do you have an information security awareness program which include mand...',
    'Yes. Employees complete mandatory security awareness training at hire an...',
    'GR',
  ],
  [
    'Are your employee subjected to background investigation checks includi...',
    'Yes. All new hires must pass a thorough background check, includin...',
    'RJ',
  ],
  [
    'Are your employees covered by confidentiality clause or non-disclosure...',
    'All employees must sign confidentiality agreements and comp...',
    'GR',
  ],
  [
    'Do you have an IT asset management policy which covers below mentioned po...',
    'Their policies cover asset inventory, ownership, classification, and...',
    'CF',
  ],
  [
    'Do you define data classification for information assets and control requireme...',
    'Yes. Data is classified by type and sensitivity, with controls aligned to pr...',
    'ES',
  ],
  [
    'Do you restrict user from installing unauthorized or unlicensed software?',
    'Yes. Unauthorized addition, removal, update, and management of organiza...',
    'RJ',
  ],
  [
    'Do you have mobile device management (MDM) policy which require to enforce b...',
    'Yes. MDM policy enforces data encryption, antivirus, and remote wip...',
    'AD',
  ],
  [
    'Are you using encryption to protect data at rest (AES256 or higher) and data in-tr...',
    'Encryption keys are managed via AWS KMS, which stores key material i...',
    'GR',
  ],
] as const;

function VantaLogo() {
  return <div className="vanta-logo">Vanta</div>;
}

function WorkspaceSelector({ name = 'Acme Co', secure = false }: { name?: string; secure?: boolean }) {
  return (
    <button className="vanta-workspace" type="button">
      <span className={`vanta-workspace-mark ${secure ? 'trusecure' : ''}`}>
        {secure ? <ShieldCheck size={18} strokeWidth={3} /> : <Box size={16} fill="currentColor" />}
      </span>
      <span>{name}</span>
      <ChevronDown size={18} />
    </button>
  );
}

function Topbar({
  screen,
  secure = false,
  account = 'Acme Co',
  compactActions = false,
}: {
  screen: Screen;
  secure?: boolean;
  account?: string;
  compactActions?: boolean;
}) {
  return (
    <header className="vanta-topbar">
      <div className="vanta-brand-area">
        <VantaLogo />
        <WorkspaceSelector name={account} secure={secure} />
      </div>
      {screen === 'vendor' ? null : (
        <div className="vanta-top-actions">
          {compactActions ? (
            <>
              <button className="vanta-icon-button" type="button" aria-label="Help">
                <HelpCircle size={24} />
              </button>
              <button className="vanta-icon-button" type="button" aria-label="Announcements">
                <Megaphone size={24} />
              </button>
              <button className="vanta-icon-button" type="button" aria-label="Settings">
                <Settings size={24} />
              </button>
            </>
          ) : null}
          <span className="vanta-avatar">A</span>
        </div>
      )}
    </header>
  );
}

function Shell({
  screen,
  children,
  secure,
  account,
  compactActions,
}: {
  screen: Screen;
  children: ReactNode;
  secure?: boolean;
  account?: string;
  compactActions?: boolean;
}) {
  return (
    <div className="vanta-app">
      <Topbar screen={screen} secure={secure} account={account} compactActions={compactActions} />
      <div className="vanta-shell">
        <Sidebar screen={screen} />
        <main className="vanta-main">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ screen }: { screen: Screen }) {
  const navigate = useNavigate();
  const activeParent = (item: NavItem) =>
    item.screen === screen || item.children?.some((child) => child.screen === screen) || false;
  const activeChild = (parent: NavItem, child: NavChild) => {
    if (parent.label === 'Customer Trust' && screen === commitments) return child.label === 'Commitments';
    if (parent.label === 'Vendors' && screen === vendor) return child.label === 'Overview';
    if (parent.label === 'Personnel' && screen === people) return child.label === 'People';
    if (parent.label === 'Personnel' && screen === 'peopleTasks') return child.label === 'People';
    if (parent.label === 'Compliance') {
      if (screen === audits) return child.label === 'Audits';
      if (screen === 'auditModal') return child.label === 'Audits';
      if (screen === documents) return child.label === 'Documents';
      if (screen === policies || screen === 'policyBuilder' || screen === 'thirdPartyPolicy' || screen === 'addControlsModal') return child.label === 'Policies';
      if (screen === 'controlsOverview' || screen === 'controlsUpload' || screen === 'controlsReview') return child.label === 'Controls';
      if (screen === riskReport) return child.label === 'Issues';
      if (screen === complianceReport || screen === 'frameworksCatalog' || screen === 'frameworkImport' || screen === 'frameworkDetail' || screen === 'frameworkScope' || screen === 'privacyPeopleScope' || screen === 'scopeSettings' || screen === 'integrationScope') return child.label === 'Frameworks';
    }
    return child.screen === screen;
  };

  return (
    <aside className="vanta-sidebar">
      <div className="vanta-search">
        <Search />
        <span>Find...</span>
      </div>
      <nav className="vanta-nav" aria-label="Vanta clone navigation">
        {normalNav.map((item) => {
          const Icon = item.icon;
          const isActive = activeParent(item);
          const expanded = Boolean(isActive && item.children?.length);
          return (
            <div key={item.label}>
              {item.sectionBreak ? <div className="vanta-nav-divider" /> : null}
              <button
                aria-current={isActive ? 'page' : undefined}
                className={`vanta-nav-item ${isActive ? 'is-active' : ''}`}
                data-active={isActive ? 'true' : undefined}
                type="button"
                onClick={() => item.screen && navigate(routeByScreen[item.screen])}
              >
                {Icon ? <Icon /> : null}
                <span>{item.label}</span>
                {item.children ? <ChevronDown className="vanta-nav-caret" size={17} /> : null}
              </button>
              {expanded ? (
                <div className="vanta-nav-children">
                  {item.children?.map((child) => {
                    const childActive = activeChild(item, child);
                    return (
                      <button
                        key={child.label}
                        aria-current={childActive ? 'page' : undefined}
                        className={`vanta-nav-child ${childActive ? 'is-active' : ''}`}
                        data-active={childActive ? 'true' : undefined}
                        type="button"
                        onClick={() => navigate(routeByScreen[child.screen])}
                      >
                        {child.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function Tabs({
  items,
  active,
  onChange,
}: {
  items: { label: string; count?: number }[];
  active: string;
  onChange: (label: string) => void;
}) {
  return (
    <div className="vanta-tabs">
      {items.map((item) => (
        <button
          key={item.label}
          className={`vanta-tab ${item.label === active ? 'is-active' : ''}`}
          type="button"
          onClick={() => onChange(item.label)}
        >
          <span>{item.label}</span>
          {typeof item.count === 'number' ? <span className="vanta-count">{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

function StatusPill({
  children,
  tone = 'gray',
  icon,
}: {
  children: ReactNode;
  tone?: 'purple' | 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  icon?: ReactNode;
}) {
  return (
    <span className={`vanta-pill ${tone}`}>
      {icon}
      {children}
    </span>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

function avatarBackground(seed: number) {
  const palette = [
    'linear-gradient(135deg, #d7c5ff, #6437b6)',
    'linear-gradient(135deg, #ffd3bd, #90452d)',
    'linear-gradient(135deg, #cde8ff, #2c65ad)',
    'linear-gradient(135deg, #ffe0e7, #9d315c)',
    'linear-gradient(135deg, #e2d6c8, #5f3d29)',
  ];
  return palette[seed % palette.length];
}

function AskVantaBubble() {
  return (
    <div className="vanta-ask-bubble">
      <Sparkles className="vanta-spark" size={48} />
      <span>Ask Vanta AI</span>
    </div>
  );
}

function VendorReviewScreen() {
  const [activeTab, setActiveTab] = useState('Evidence');
  const [questionFilter, setQuestionFilter] = useState('All questions');

  return (
    <Shell screen="vendor">
      <AskVantaBubble />
      <section className="vanta-page">
        <div className="vanta-eyebrow">Vendors / TaskNimbus</div>
        <h1 className="vanta-page-title">TaskNimbus security review</h1>
        <div className="vanta-status-row">
          <StatusPill tone="purple" icon={<Clock3 size={16} fill="currentColor" />}>
            In progress
          </StatusPill>
          <span>Due Sep 1</span>
          <span>Ready for analysis</span>
          <span>Scheduled Nov 21</span>
          <span>No decision yet</span>
        </div>
        <Tabs
          active={activeTab}
          onChange={setActiveTab}
          items={[
            { label: 'Evidence' },
            { label: 'Findings', count: 3 },
            { label: 'Activity' },
          ]}
        />

        {activeTab === 'Evidence' ? (
          <>
            <h2 className="vanta-section-heading">Documentation</h2>
            <div className="vanta-table vanta-doc-table">
              <div className="vanta-table-header">
                <div className="vanta-table-cell">Document type</div>
                <div className="vanta-table-cell">Status</div>
                <div className="vanta-table-cell">Source</div>
                <div className="vanta-table-cell">AI usage</div>
              </div>
              {[
                ['SOC 2', 'Trust Center', 'Ready'],
                ['ISO 27001 Certification', 'Uploaded by Amy Lin', 'Incompatible'],
              ].map(([doc, source, ai]) => (
                <div className="vanta-table-row" key={doc}>
                  <div className="vanta-table-cell">{doc}</div>
                  <div className="vanta-table-cell">
                    <StatusPill tone="green" icon={<CheckCircle2 size={16} />}>
                      Available
                    </StatusPill>
                  </div>
                  <div className="vanta-table-cell">
                    {source === 'Trust Center' ? (
                      <span className="vanta-trust-mark">
                        Trust Center <span className="vanta-mini-v">v</span>
                      </span>
                    ) : (
                      source
                    )}
                  </div>
                  <div className="vanta-table-cell">
                    {ai === 'Ready' ? (
                      <span className="vanta-ai-cell">
                        <Sparkles className="vanta-spark" size={22} />
                        Ready
                      </span>
                    ) : (
                      ai
                    )}
                  </div>
                </div>
              ))}
            </div>

            <h2 className="vanta-section-heading">Questionnaire</h2>
            <div className="vanta-doc-controls">
              <div className="vanta-filter-tabs">
                {[
                  ['All questions', 20],
                  ['Answered', 18],
                  ['Not answered', 2],
                ].map(([label, count]) => (
                  <button
                    className={`vanta-filter-tab ${questionFilter === label ? 'is-active' : ''}`}
                    key={label}
                    type="button"
                    onClick={() => setQuestionFilter(String(label))}
                  >
                    <span>{label}</span>
                    <span className="vanta-count">{count}</span>
                  </button>
                ))}
              </div>
              <button className="vanta-outline-button" type="button" onClick={() => setQuestionFilter('Not answered')}>
                Review 20 questions
              </button>
            </div>
            <div className="vanta-table vanta-question-table">
              <div className="vanta-table-header">
                <div className="vanta-table-cell">Question</div>
                <div className="vanta-table-cell">Answer</div>
              </div>
              {[
                ['Has your company experienced a security incident in the past 3 years?', 'No'],
                [
                  'Explain your multi-factor authentication on enterprise applications and production systems.',
                  'We assess all third-party vendors through a stringent evaluation process that typically includes the following steps:',
                ],
                ['How often are third party penetration tests conducted against your product/service?', 'Yearly basis.'],
              ].map(([question, answer]) => (
                <div className="vanta-table-row" key={question}>
                  <div className="vanta-table-cell">
                    <div className="vanta-question-text">{question}</div>
                  </div>
                  <div className="vanta-table-cell">
                    <span className="vanta-ai-cell">
                      <Sparkles className="vanta-spark" size={22} />
                      {answer}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="vanta-table vanta-question-table" style={{ marginTop: 34 }}>
            <div className="vanta-table-header">
              <div className="vanta-table-cell">{activeTab}</div>
              <div className="vanta-table-cell">Status</div>
            </div>
            {[
              ['Encryption documentation needs reviewer confirmation', 'Open'],
              ['Penetration test scope imported from Trust Center', 'Resolved'],
              ['Vendor owner added a follow-up for SOC 2 bridge letter', 'Scheduled'],
            ].map(([finding, status]) => (
              <div className="vanta-table-row" key={finding}>
                <div className="vanta-table-cell">{finding}</div>
                <div className="vanta-table-cell">
                  <StatusPill tone={status === 'Resolved' ? 'green' : 'purple'}>{status}</StatusPill>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}

function AiExtractionPanel() {
  return (
    <aside className="vanta-ai-rail">
      <h2>
        <Sparkles className="vanta-spark" size={28} /> AI data extraction
      </h2>
      <div className="vanta-doc-preview">
        <div className="vanta-doc-line" style={{ width: '86%' }} />
        <div className="vanta-doc-line" style={{ width: '78%' }} />
        <div className="vanta-doc-line" style={{ width: '66%' }} />
        <h4>9. Data Protection and Security</h4>
        <h4>9.1 Vulnerability Notice</h4>
        <div className="vanta-doc-line blue" style={{ width: '100%' }} />
        <div className="vanta-doc-line blue" style={{ width: '100%' }} />
        <div className="vanta-doc-line blue" style={{ width: '88%' }} />
        <div className="vanta-doc-line blue" style={{ width: '55%' }} />
        <h4>9.2 Security Incident Notification</h4>
        <div className="vanta-doc-line blue" style={{ width: '98%' }} />
        <div className="vanta-doc-line blue" style={{ width: '98%' }} />
        <div className="vanta-doc-line blue" style={{ width: '91%' }} />
      </div>
    </aside>
  );
}

function CommitmentCard({
  title,
  standard,
  nonStandard,
  logos,
  first,
  second,
}: {
  title: string;
  standard: number;
  nonStandard: number;
  logos: string[];
  first: string;
  second: string;
}) {
  const colors = ['#7944dc', '#4f8dff', '#20bbb6', '#1cc263', '#ff6c9a', '#ffc048', '#6a64ff'];
  return (
    <article className="vanta-commitment-card">
      <h3>{title}</h3>
      <div className="vanta-commitment-meta">
        <span>
          <List size={16} /> Standard commitments {standard}
        </span>
        <span>
          <List size={16} /> Non-standard commitments {nonStandard}
        </span>
      </div>
      <div className="vanta-logo-stack">
        {logos.map((logo, index) => (
          <span key={`${title}-${logo}-${index}`} className="vanta-logo-chip" style={{ background: colors[index % colors.length] }}>
            {logo}
          </span>
        ))}
        <span style={{ marginLeft: 8, color: '#625b66', fontSize: 16, fontWeight: 700 }}>+{logos.length > 4 ? 20 : 12}</span>
      </div>
      <div className="vanta-sla-row">
        <span>{first}</span>
        <span>{second}</span>
      </div>
    </article>
  );
}

function CommitmentsScreen() {
  return (
    <Shell screen="commitments" secure account="TruSecure">
      <section className="vanta-page narrow-top vanta-commitment-page">
        <h1 className="vanta-page-title" style={{ color: '#17131b' }}>
          Customer commitments
        </h1>
        <div className="vanta-commitment-tabs">
          <button className="vanta-tab is-active" type="button">
            Commitments
          </button>
          <button className="vanta-tab" type="button">
            Contracts
          </button>
        </div>
        <h2 className="vanta-section-heading" style={{ color: '#29242d', marginTop: 24 }}>
          Commitments being tracked
        </h2>
        <CommitmentCard
          title="Security incident and breach notice"
          standard={16}
          nonStandard={8}
          logos={['', 'Z', 'M', '+']}
          first="Standard SLA: 72 hours"
          second="Strictest SLA: 24 hours"
        />
        <CommitmentCard
          title="Data deletion and return"
          standard={15}
          nonStandard={5}
          logos={['', 'O', 'D', '~']}
          first="Standard SLA: 180 days"
          second="Strictest SLA: 90 days"
        />
        <CommitmentCard
          title="Subprocessor change notice"
          standard={19}
          nonStandard={5}
          logos={['', 'O', 'J', 'M']}
          first="Standard SLA: 10 days"
          second="Strictest SLA: 60 days"
        />
        <CommitmentCard
          title="Customer right to audit"
          standard={10}
          nonStandard={6}
          logos={['M', 'O', 'D', 'L']}
          first="Standard frequency: 365 days"
          second="Strictest frequency: 180 days"
        />
      </section>
      <AiExtractionPanel />
      <div className="vanta-floating-detail">
        <h3>Security incident and breach notice</h3>
        <div className="vanta-detail-list">
          <div>
            <Sparkles size={18} /> Added by AI
          </div>
          <div>
            <Calendar size={18} /> <strong>SLA:</strong> <code>24 hours</code>
          </div>
          <div>
            <Zap size={18} /> <strong>Trigger:</strong> <code>Security compromise</code>
          </div>
          <div>
            <Box size={18} /> <strong>Data scope:</strong> <code>Personal data</code>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function PeopleScreen() {
  const [query, setQuery] = useState('');
  const [added, setAdded] = useState(false);
  const filtered = useMemo(
    () =>
      peopleRows.filter((row) =>
        [row[0], row[1], row[2], row[5]].some((value) => value.toLowerCase().includes(query.trim().toLowerCase())),
      ),
    [query],
  );
  const rows = added
    ? ([['Anika Shah', 'anika.shah@acme.co', 'Incoming', 'Jan 8', '-', 'Vanta', '2 Due soon', '-', 'yellow', 18], ...filtered] as const)
    : filtered;

  return (
    <Shell screen="people" compactActions>
      <section className="vanta-page narrow-top">
        <h1 className="vanta-page-title">People</h1>
        <Tabs
          active="People"
          onChange={() => undefined}
          items={[
            { label: 'People' },
            { label: 'Groups' },
            { label: 'Background checks' },
          ]}
        />
        <div className="vanta-filter-tabs" style={{ marginTop: 30 }}>
          <button className="vanta-filter-tab is-active" type="button">
            Incomplete tasks <span className="vanta-count">32</span>
          </button>
          <button className="vanta-filter-tab" type="button">
            Current <span className="vanta-count">218</span>
          </button>
          <button className="vanta-filter-tab" type="button">
            Incoming <span className="vanta-count">5</span>
          </button>
        </div>
        <div className="vanta-toolbar">
          <div className="vanta-people-search">
            <Search size={21} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
          </div>
          <button className="vanta-outline-button" type="button" onClick={() => setAdded(true)}>
            <Plus size={19} /> Add person
          </button>
        </div>
        <div className="vanta-table vanta-people-table">
          <div className="vanta-table-header">
            {['Name', 'Employment status', 'Start date', 'End date', 'Source', 'Task status', 'Last reminded'].map((heading) => (
              <div className="vanta-table-cell" key={heading}>
                {heading}
              </div>
            ))}
          </div>
          {rows.map((row) => (
            <div className="vanta-table-row" key={`${row[0]}-${row[1]}`}>
              <div className="vanta-table-cell">
                <div className="vanta-person">
                  <span className="vanta-person-fallback" style={{ background: avatarBackground(row[9]) }}>
                    {getInitials(row[0])}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="vanta-person-name">{row[0]}</div>
                    <div className="vanta-person-email">{row[1]}</div>
                  </div>
                </div>
              </div>
              <div className="vanta-table-cell">
                <StatusPill>{row[2]}</StatusPill>
              </div>
              <div className="vanta-table-cell">{row[3]}</div>
              <div className="vanta-table-cell">{row[4]}</div>
              <div className="vanta-table-cell">
                <span className="vanta-source-mark">
                  {row[5] === 'Okta' ? <span className="vanta-okta-dot" /> : <span className="vanta-v-mark">v</span>}
                  {row[5]}
                </span>
              </div>
              <div className="vanta-table-cell">
                <StatusPill tone={row[8] === 'red' ? 'red' : 'yellow'} icon={row[8] === 'red' ? <CircleAlert size={15} fill="currentColor" /> : <TriangleAlert size={15} fill="currentColor" />}>
                  {row[6]}
                </StatusPill>
              </div>
              <div className="vanta-table-cell">{row[7]}</div>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}

function PolylineChart({
  lines,
  yLabels,
  height = 300,
}: {
  lines: { points: string; color: string; width?: number; dash?: string }[];
  yLabels?: string[];
  height?: number;
}) {
  return (
    <svg className="vanta-chart" viewBox={`0 0 720 ${height}`} role="img" aria-label="Line chart">
      {[70, 125, 180, 235].map((y, index) => (
        <line className="grid" x1="70" x2="690" y1={y} y2={y} key={y} />
      ))}
      <line className="axis" x1="70" x2="690" y1={height - 44} y2={height - 44} />
      {yLabels?.map((label, index) => (
        <text key={label} x="28" y={70 + index * 55}>
          {label}
        </text>
      ))}
      {lines.map((line, index) => (
        <polyline
          key={`${line.color}-${index}`}
          className="line"
          points={line.points}
          stroke={line.color}
          strokeWidth={line.width ?? 4}
          strokeDasharray={line.dash}
        />
      ))}
    </svg>
  );
}

function FrameworkLineChart() {
  const legend = [
    ['SOC 2', '#7a3ab2', ''],
    ['ISO 27001:2022', '#9a2d9b', '7 7'],
    ['GDPR', '#d449c8', '4 7'],
    ['HIPAA', '#4e9df5', '2 5'],
    ['NIST 800-53', '#65cad7', '9 9'],
  ] as const;
  return (
    <>
      <PolylineChart
        lines={[
          { points: '70,212 170,178 280,142 365,124 520,108 670,104 690,106', color: '#7a3ab2' },
          { points: '70,226 180,188 300,150 390,134 515,154 615,160 690,160', color: '#9a2d9b', dash: '7 7' },
          { points: '70,268 170,240 300,190 410,154 520,134 690,134', color: '#d449c8', dash: '4 7' },
          { points: '70,250 170,254 260,246 365,210 465,166 550,172 690,222', color: '#4e9df5', dash: '2 5' },
          { points: '70,220 140,300 240,250 350,224 480,216 610,226 690,236', color: '#65cad7', dash: '9 9' },
        ]}
      />
      <div className="vanta-chart-legend">
        {legend.map(([label, color, dash]) => (
          <span className="vanta-legend-item" key={label}>
            <span className="vanta-legend-line" style={{ '--swatch': color, backgroundImage: dash ? `repeating-linear-gradient(to right, ${color} 0 8px, transparent 8px 14px)` : undefined } as CSSProperties} />
            {label}
          </span>
        ))}
      </div>
    </>
  );
}

function AuditTimelineChart() {
  const rows = [
    ['SOC 2', 0, 18],
    ['ISO 27001:2022', 0, 49],
    ['HIPAA', 24, 51],
    ['GDPR', 42, 37],
  ] as const;
  return (
    <div className="vanta-audit-chart">
      <div />
      <div className="vanta-audit-months">
        {['Today', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'].map((month) => (
          <span key={month}>{month}</span>
        ))}
      </div>
      {rows.map(([label, left, width]) => (
        <div style={{ display: 'contents' }} key={label}>
          <div className="vanta-audit-label">{label}</div>
          <div className="vanta-audit-row">
            <span className="vanta-audit-bar" style={{ left: `${left}%`, width: `${width}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function OwnersChart() {
  const rows = [
    ['Engineering', [22, 19, 5, 17]],
    ['IT', [16, 11, 11, 19]],
    ['Security', [11, 22, 11, 11]],
    ['Amy Prawnson', [10, 10, 5, 4]],
    ['Alejandro Petit', [6, 11, 5, 3]],
    ['Amanda Mott', [5, 3, 3, 11]],
  ] as const;
  const colors = ['#f5575f', '#ffc21a', '#10c744', '#d9d6dc'];
  return (
    <>
      <div className="vanta-owner-bars">
        {rows.map(([label, values]) => (
          <div style={{ display: 'contents' }} key={label}>
            <div className="vanta-owner-label">{label}</div>
            <div className="vanta-stacked-bar">
              {values.map((value, index) => (
                <span
                  key={`${label}-${index}`}
                  className="vanta-stacked-segment"
                  style={{ width: `${value}%`, background: colors[index] }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="vanta-chart-legend" style={{ marginTop: 34 }}>
        {[
          ['Overdue', '#f5575f'],
          ['Due soon', '#ffc21a'],
          ['OK', '#10c744'],
          ['No SLA', '#d9d6dc'],
        ].map(([label, color]) => (
          <span className="vanta-legend-item" key={label}>
            <span className="vanta-legend-swatch" style={{ '--swatch': color } as CSSProperties} />
            {label}
          </span>
        ))}
      </div>
    </>
  );
}

function PassingCategoryChart() {
  return (
    <>
      <PolylineChart
        height={305}
        yLabels={['100%', '75%', '50%', '25%', '0%']}
        lines={[
          { points: '90,190 210,190 285,178 390,174 475,150 560,148 690,116', color: '#7a3ab2' },
          { points: '90,238 160,238 210,206 335,206 430,178 560,174 690,170', color: '#a72b96' },
          { points: '90,250 150,250 220,218 340,218 460,174 590,168 690,156', color: '#d449c8' },
          { points: '90,228 185,220 225,178 330,174 420,168 515,150 600,120 690,106', color: '#4e9df5' },
          { points: '90,214 160,200 250,192 360,184 430,160 535,150 610,142 690,134', color: '#65cad7' },
          { points: '90,224 210,216 300,188 390,170 470,166 585,144 690,128', color: '#78db94' },
        ]}
      />
      <div className="vanta-chart-legend">
        {[
          ['HR', '#7a3ab2'],
          ['IT', '#a72b96'],
          ['Policy', '#d449c8'],
          ['Engineering', '#4e9df5'],
          ['Risks', '#65cad7'],
          ['All', '#78db94'],
        ].map(([label, color]) => (
          <span className="vanta-legend-item" key={label}>
            <span className="vanta-legend-swatch" style={{ '--swatch': color } as CSSProperties} />
            {label}
          </span>
        ))}
      </div>
    </>
  );
}

function ComplianceReportScreen() {
  return (
    <Shell screen="complianceReport" compactActions>
      <section className="vanta-page narrow-top">
        <div className="vanta-eyebrow">Reports</div>
        <h1 className="vanta-page-title">Compliance report</h1>
        <div className="vanta-filter-tabs" style={{ marginTop: 28 }}>
          <button className="vanta-filter-tab is-active" type="button">
            <Calendar size={19} /> Last 30 days
          </button>
          <button className="vanta-filter-tab is-active" type="button">
            Framework (4)
          </button>
        </div>
        <div className="vanta-dashboard-grid">
          <div className="vanta-card large">
            <h2>Framework progress</h2>
            <FrameworkLineChart />
          </div>
          <div className="vanta-card large">
            <h2>Upcoming audits</h2>
            <AuditTimelineChart />
          </div>
          <div className="vanta-card large">
            <h2>Top test owners as of today</h2>
            <OwnersChart />
          </div>
          <div className="vanta-card large">
            <h2>Tests passing by category</h2>
            <PassingCategoryChart />
          </div>
        </div>
      </section>
      <div className="vanta-floating-mini">
        <h3>Program task completion</h3>
        <div className="vanta-score-row">
          <div>
            <small>HR</small>
            <strong>50%</strong>
          </div>
          <div className="vanta-meter">
            <span style={{ width: '50%' }} />
          </div>
        </div>
        <div className="vanta-score-row">
          <div>
            <small>Policy</small>
            <strong>75%</strong>
          </div>
          <div className="vanta-meter">
            <span style={{ width: '75%' }} />
          </div>
        </div>
      </div>
    </Shell>
  );
}

function RiskScoresChart() {
  return (
    <>
      <PolylineChart
        height={310}
        yLabels={['2000', '1500', '1000', '500', '0']}
        lines={[
          { points: '95,170 185,152 285,188 385,142 500,188 590,202 670,154 770,166', color: '#7135ac' },
          { points: '95,158 215,132 300,132 405,108 505,108 600,108 700,72 790,72', color: '#b260f1', width: 4 },
          { points: '95,244 300,244 400,222 595,222 700,222 790,196', color: '#ead7ff', width: 4 },
        ]}
      />
      <div className="vanta-chart-legend">
        {[
          ['Current risk score', '#7135ac'],
          ['Inherent risk score', '#b260f1'],
          ['Residual risk score', '#ead7ff'],
        ].map(([label, color]) => (
          <span className="vanta-legend-item" key={label}>
            <span className="vanta-legend-swatch" style={{ '--swatch': color } as CSSProperties} />
            {label}
          </span>
        ))}
      </div>
    </>
  );
}

function InherentRiskBars() {
  const groups = [
    ['Feb 8', [10, 11, 8, 12]],
    ['Feb 15', [12, 16, 8, 9]],
    ['Feb 22', [14, 17, 10, 10]],
    ['Mar 1', [12, 18, 16, 9]],
    ['Mar 9', [18, 12, 18, 0]],
  ] as const;
  const colors = ['#10c744', '#ffc21a', '#f5575f', '#a43d3d'];
  return (
    <>
      <svg className="vanta-chart" viewBox="0 0 560 330" role="img" aria-label="Stacked bar chart">
        {[72, 126, 180, 234].map((y) => (
          <line key={y} className="grid" x1="68" x2="520" y1={y} y2={y} />
        ))}
        <line className="axis" x1="68" x2="520" y1="260" y2="260" />
        {['100', '75', '50', '25', '0'].map((label, index) => (
          <text key={label} x="36" y={72 + index * 47}>
            {label}
          </text>
        ))}
        {groups.map(([label, values], groupIndex) => {
          const x = 92 + groupIndex * 93;
          let y = 260;
          return (
            <g key={label}>
              {values.map((value, valueIndex) => {
                const h = value * 2.4;
                y -= h;
                return <rect key={`${label}-${valueIndex}`} x={x} y={y} width="26" height={h} fill={colors[valueIndex]} />;
              })}
              <text x={x - 12} y="288">
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="vanta-chart-legend">
        {[
          ['Critical', '#a43d3d'],
          ['High', '#f5575f'],
          ['Medium', '#ffc21a'],
          ['Low', '#10c744'],
        ].map(([label, color]) => (
          <span className="vanta-legend-item" key={label}>
            <span className="vanta-legend-swatch" style={{ '--swatch': color } as CSSProperties} />
            {label}
          </span>
        ))}
      </div>
    </>
  );
}

function Heatmap() {
  const labelsY = ['Very High', 'High', 'Medium', 'Low', 'Very low'];
  const labelsX = ['Very unlikely', 'Unlikely', 'Somewhat unlikely', 'Likely', 'Very likely'];
  const values = [
    [1, 1, 1, 3, 2],
    [3, 1, 1, 4, 1],
    [1, 2, 3, 4, 3],
    [2, 1, 3, 1, 1],
    [4, 7, 2, 1, 4],
  ];
  const colors = [
    ['#10c744', '#ffc21a', '#f5575f', '#a43d3d', '#a43d3d'],
    ['#10c744', '#10c744', '#ffc21a', '#f5575f', '#a43d3d'],
    ['#10c744', '#10c744', '#10c744', '#ffc21a', '#f5575f'],
    ['#10c744', '#10c744', '#10c744', '#10c744', '#ffc21a'],
    ['#10c744', '#10c744', '#10c744', '#10c744', '#10c744'],
  ];
  return (
    <>
      <div className="vanta-heatmap">
        <div />
        {labelsY.map((rowLabel, rowIndex) => (
          <div style={{ display: 'contents' }} key={rowLabel}>
            <div className="vanta-heatmap-label">{rowLabel}</div>
            {values[rowIndex].map((value, colIndex) => (
              <div className="vanta-heatmap-cell" key={`${rowLabel}-${colIndex}`} style={{ background: colors[rowIndex][colIndex] }}>
                {value}
              </div>
            ))}
          </div>
        ))}
        <div />
        {labelsX.map((label) => (
          <div className="vanta-heatmap-axis" key={label}>
            {label}
          </div>
        ))}
      </div>
      <div className="vanta-chart-legend" style={{ marginTop: 28 }}>
        {[
          ['Critical', '#a43d3d'],
          ['High', '#f5575f'],
          ['Medium', '#ffc21a'],
          ['Low', '#10c744'],
        ].map(([label, color]) => (
          <span className="vanta-legend-item" key={label}>
            <span className="vanta-legend-swatch" style={{ '--swatch': color } as CSSProperties} />
            {label}
          </span>
        ))}
      </div>
    </>
  );
}

function RiskReportScreen() {
  return (
    <Shell screen="riskReport">
      <section className="vanta-page narrow-top">
        <div className="vanta-eyebrow">Reports</div>
        <h1 className="vanta-page-title">Risk report</h1>
        <div className="vanta-card risk-wide vanta-risk-score-layout">
          <h2>Risk scores</h2>
          <RiskScoresChart />
        </div>
        <div className="vanta-risk-grid">
          <div className="vanta-card large">
            <h2>Inherent risk over time</h2>
            <InherentRiskBars />
          </div>
          <div className="vanta-card large">
            <h2>Inherent risk as of today</h2>
            <Heatmap />
          </div>
        </div>
      </section>
      <aside className="vanta-risk-drawer">
        <h3>Untimely notification in delays in breach response</h3>
        <div className="vanta-risk-drawer-row">
          <span>Category</span>
          <strong>Information security</strong>
        </div>
        <div className="vanta-risk-drawer-row">
          <span>Owner</span>
          <strong>Jane Nguyen</strong>
        </div>
        <div className="vanta-risk-drawer-row">
          <span>Source</span>
          <strong>Vanta</strong>
        </div>
        <Tabs active="Assessment" onChange={() => undefined} items={[{ label: 'Assessment' }]} />
        <StatusPill>
          <span className="vanta-count">1</span> Inherent risk
        </StatusPill>
        <div style={{ marginTop: 12, padding: 14, background: '#fbf6fd', border: '1px solid var(--vanta-border)', borderRadius: 4 }}>
          <StatusPill>
            <span className="vanta-count">2</span> Treatment plan
          </StatusPill>
          <div className="vanta-drawer-label" style={{ marginTop: 18 }}>
            Type
          </div>
          {['Mitigate', 'Transfer', 'Avoid', 'Accept'].map((label, index) => (
            <label key={label}>
              <span className={`vanta-radio ${index === 0 ? 'on' : ''}`} />
              <span>
                <strong>{label}</strong>
                {index === 0 ? <span style={{ display: 'block', color: '#77717c' }}>Identify controls to put in place will reduce the risk score.</span> : null}
              </span>
            </label>
          ))}
        </div>
      </aside>
    </Shell>
  );
}

function CompactShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="vanta-app">
      <Topbar screen="questionnaire" compactActions />
      <div className="vanta-shell vanta-shell-compact">
        <aside className="vanta-compact-sidebar">
          <div className="vanta-compact-search">
            <Search size={22} />
          </div>
          <div className="vanta-rail-icons">
            {compactIcons.map(({ icon: Icon, screen, label, divider }) => (
              <div key={label} style={{ display: 'contents' }}>
                {divider ? <div className="vanta-rail-divider" /> : null}
                <button
                  type="button"
                  className={`vanta-rail-icon ${label === 'Questionnaires' ? 'is-active' : ''}`}
                  onClick={() => navigate(routeByScreen[screen])}
                  aria-label={label}
                >
                  <Icon size={24} />
                </button>
              </div>
            ))}
          </div>
        </aside>
        {children}
      </div>
    </div>
  );
}

function QuestionnaireScreen() {
  const [assigned, setAssigned] = useState(false);
  return (
    <CompactShell>
      <main className="vanta-questionnaire-main">
        <div className="vanta-q-head">
          <div>
            <div className="vanta-eyebrow">Questionnaires</div>
            <h1 className="vanta-page-title">TaskNimbus</h1>
            <div className="vanta-status-row">
              <StatusPill tone="blue" icon={<Clock3 size={16} />}>
                In progress
              </StatusPill>
              <span>Due on Feb 8</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="vanta-outline-button" type="button" aria-label="More options">
              <MoreHorizontal size={20} />
            </button>
            <button className="vanta-outline-button" type="button">
              <Sparkles className="vanta-spark" size={20} /> Vanta Agent
            </button>
          </div>
        </div>
        <Tabs active="Questions" onChange={() => undefined} items={[{ label: 'Questions' }, { label: 'Comments' }]} />
        <div className="vanta-table vanta-q-table" style={{ marginTop: 14 }}>
          <div className="vanta-table-header">
            <div className="vanta-table-cell">
              <div className="vanta-checkbox" />
            </div>
            <div className="vanta-table-cell">Question</div>
            <div className="vanta-table-cell">Answer</div>
            <div className="vanta-table-cell">Owner</div>
            <div className="vanta-table-cell">Status</div>
          </div>
          {questionnaireRows.map(([question, answer, owner]) => (
            <div className="vanta-table-row" key={question}>
              <div className="vanta-table-cell">
                <div className="vanta-checkbox" />
              </div>
              <div className="vanta-table-cell">
                <div className="vanta-q-text">{question}</div>
              </div>
              <div className="vanta-table-cell">
                <div className="vanta-q-answer">
                  <Sparkles className="vanta-spark" size={22} />
                  <span>{answer}</span>
                </div>
              </div>
              <div className="vanta-table-cell">
                <span className="vanta-owner-bubble">{owner}</span>
              </div>
              <div className="vanta-table-cell">
                <StatusPill>{assigned ? 'Assigned' : 'Needs approval'}</StatusPill>
              </div>
            </div>
          ))}
        </div>
      </main>
      <aside className="vanta-agent-panel">
        <div className="vanta-agent-card">
          <div className="vanta-agent-actions">
            <h2>Vanta Agent</h2>
            <span>
              <History size={20} /> <X size={22} />
            </span>
          </div>
          <Sparkles className="vanta-spark" size={42} />
          <div className="vanta-agent-copy">
            <p>Thinking involved 3 steps</p>
            <strong>Summary of results:</strong>
            <p>
              <CheckCircle2 size={18} color="#12c94b" fill="#12c94b" /> 38 questions answered automatically. The other 2 are privacy related, and are best handled by the legal team.
            </p>
            <strong>Here's what we recommend you do next:</strong>
            <button className="vanta-tiny-button" type="button" onClick={() => setAssigned(true)}>
              Assign remaining questions
            </button>
          </div>
        </div>
      </aside>
    </CompactShell>
  );
}

function AuditTracker({ second = false }: { second?: boolean }) {
  const items = second
    ? [
        ['#f5575f', 16],
        ['#4d9cf6', 43],
        ['#12c94b', 31],
        ['#f39b14', 2],
        ['#d9d6dc', 8],
      ]
    : [
        ['#f5575f', 14],
        ['#f39b14', 2],
        ['#4d9cf6', 37],
        ['#12c94b', 34],
        ['#d9d6dc', 13],
      ];
  const labels = second
    ? ['Not ready for audit: 50', 'Ready for audit: 220', 'Accepted: 150']
    : ['Not ready for audit: 70', 'Flagged by auditor: 2', 'Ready for audit: 165', 'Accepted: 170', 'Not applicable: 25'];
  return (
    <div className="vanta-tracker-card">
      <h3>
        Evidence tracker <CircleAlert size={17} />
      </h3>
      <div className="vanta-progress-track">
        {items.map(([color, width], index) => (
          <span key={`${color}-${index}`} style={{ background: color, width: `${width}%` }} />
        ))}
      </div>
      <div style={{ display: 'grid', gap: 14, color: '#817988', fontSize: 17, fontWeight: 750 }}>
        {labels.map((label, index) => (
          <span key={label}>
            <span className="vanta-legend-swatch" style={{ '--swatch': items[index][0], display: 'inline-block', marginRight: 10 } as CSSProperties} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function AuditCard({ title, second = false }: { title: string; second?: boolean }) {
  return (
    <article className="vanta-audit-card">
      <div className="vanta-audit-card-head">
        <div className="vanta-audit-title">
          <span className="vanta-audit-badge">{second ? 'ISO 27001' : 'SOC 2'}</span>
          <div>
            <h2>{title}</h2>
            <div className="vanta-status-row" style={{ marginTop: 28 }}>
              <StatusPill tone="blue" icon={<Check size={16} />}>
                {second ? 'Internal' : 'External'}
              </StatusPill>
              <StatusPill>Upcoming</StatusPill>
            </div>
          </div>
        </div>
        {second ? (
          <button className="vanta-outline-button" type="button">
            Open audit
          </button>
        ) : null}
      </div>
      <div className="vanta-audit-detail-grid">
        <div className="vanta-timeline-card">
          <h3>Timeline</h3>
          <div className="vanta-timeline">
            <div>
              <Eye size={18} /> Auditor gets access <small>{second ? 'Jan 15' : 'Nov 1'}</small>
            </div>
            <div>
              <Clock3 size={18} /> Audit starts <small>{second ? 'Feb 1' : 'Nov 15'}</small>
            </div>
            <div>
              <ShieldCheck size={18} /> Audit ends <small>{second ? 'Feb 28' : 'Nov 30'}</small>
            </div>
          </div>
        </div>
        <AuditTracker second={second} />
      </div>
    </article>
  );
}

function AuditsScreen() {
  const [internal, setInternal] = useState(false);
  return (
    <Shell screen="audits">
      <section className="vanta-page narrow-top vanta-audit-page">
        <h1 className="vanta-page-title">Audits</h1>
        <Tabs active="Active" onChange={() => undefined} items={[{ label: 'Active' }, { label: 'Completed' }]} />
        <AuditCard title="SOC 2 Type II" />
        <AuditCard title="ISO 27001" second />
      </section>
      <aside className="vanta-drawer">
        <h2>Add a new audit</h2>
        <div className="vanta-drawer-body">
          <h3 style={{ margin: 0, fontSize: 18 }}>Define audit scope</h3>
          <div className="vanta-drawer-field">
            <label>Framework</label>
            <div className="vanta-select-like">Select a framework</div>
          </div>
          <div className="vanta-drawer-field">
            <span className="vanta-drawer-label">Audit type</span>
            <div className="vanta-radio-row">
              <button className="vanta-ghost-button" type="button" onClick={() => setInternal(false)}>
                <span className={`vanta-radio ${!internal ? 'on' : ''}`} /> External
              </button>
              <button className="vanta-ghost-button" type="button" onClick={() => setInternal(true)}>
                <span className={`vanta-radio ${internal ? 'on' : ''}`} /> Internal
              </button>
            </div>
          </div>
          <div className="vanta-drawer-field">
            <label>Audit firm (optional)</label>
            <div className="vanta-select-like">Select an audit firm</div>
            <p style={{ color: '#8f8794', fontSize: 14 }}>Don't see your auditor? Invite them</p>
          </div>
          <div className="vanta-drawer-field">
            <label>Auditor</label>
            <div className="vanta-select-like" style={{ color: '#beb7c2' }}>
              Select the auditor
            </div>
          </div>
        </div>
      </aside>
    </Shell>
  );
}

function DocumentSidebar({ screen }: { screen: Screen }) {
  const navigate = useNavigate();
  const activeComplianceChild = (child: NavChild) => {
    if (screen === audits) return child.label === 'Audits';
    if (screen === documents) return child.label === 'Documents';
    if (screen === policies || screen === 'policyBuilder' || screen === 'thirdPartyPolicy' || screen === 'addControlsModal') return child.label === 'Policies';
    if (screen === 'controlsOverview' || screen === 'controlsUpload' || screen === 'controlsReview') return child.label === 'Controls';
    if (screen === riskReport) return child.label === 'Issues';
    if (screen === complianceReport || screen === 'frameworksCatalog' || screen === 'frameworkImport' || screen === 'frameworkDetail') return child.label === 'Frameworks';
    return child.screen === screen;
  };
  return (
    <aside className="vanta-sidebar">
      <div className="vanta-search">
        <Search />
        <span>Find...</span>
      </div>
      <nav className="vanta-nav">
        {documentNav.map(({ icon: Icon, label, target, divider }) => {
          const isActive = screen === target;
          return (
            <div key={label}>
              {divider ? <div className="vanta-nav-divider" /> : null}
              <button
                aria-current={isActive ? 'page' : undefined}
                className={`vanta-nav-item ${isActive ? 'is-active' : ''}`}
                data-active={isActive ? 'true' : undefined}
                type="button"
                onClick={() => navigate(routeByScreen[target])}
              >
                <Icon />
                <span>{label}</span>
              </button>
              {label === 'Compliance' && (
                <div className="vanta-nav-children">
                  {documentComplianceChildren.map((child) => (
                    <button
                      key={child.label}
                      type="button"
                      aria-current={activeComplianceChild(child) ? 'page' : undefined}
                      className={`vanta-nav-child ${activeComplianceChild(child) ? 'is-active' : ''}`}
                      data-active={activeComplianceChild(child) ? 'true' : undefined}
                      onClick={() => navigate(routeByScreen[child.screen])}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function DocumentsScreen() {
  const [complete, setComplete] = useState(false);
  return (
    <div className="vanta-app">
      <Topbar screen="documents" />
      <div className="vanta-documents-shell">
        <DocumentSidebar screen="documents" />
        <main className="vanta-doc-review-page">
          <div className="vanta-doc-review-inner">
            <div className="vanta-eyebrow">Documents</div>
            <h1 className="vanta-doc-review-title">Proof of completed access review</h1>
            <div className="vanta-doc-subtitle-lines">
              <div style={{ width: '92%' }} />
              <div style={{ width: '76%' }} />
            </div>
            <Tabs
              active="Evidence"
              onChange={() => undefined}
              items={[
                { label: 'Evidence' },
                { label: 'Tasks (3)' },
                { label: 'Controls (23)' },
                { label: 'Audits' },
                { label: 'Notes' },
              ]}
            />
            <section className="vanta-evidence-card">
              <div className="vanta-evidence-top">
                <div>
                  <div style={{ color: '#7c7380', fontWeight: 700 }}>Renew before Dec 10, 2025</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 28 }}>
                    <span className="vanta-file-icon" style={{ width: 40, height: 40 }}>
                      <FileText size={22} />
                    </span>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 850 }}>Draft</div>
                      <div style={{ color: '#6e6570' }}>2 files</div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="vanta-primary-button" type="button" onClick={() => setComplete(true)}>
                    <CheckCircle2 size={18} /> {complete ? 'Completed' : 'Mark as complete'}
                  </button>
                  <button className="vanta-outline-button" type="button" aria-label="Delete draft">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="vanta-success-banner">
                <span>
                  <CheckCircle2 size={18} fill="currentColor" /> Vanta AI found 0 gaps in the provided evidence.
                </span>
                <button className="vanta-outline-button" type="button">
                  <Sparkles size={18} /> Review evaluation
                </button>
              </div>
              <div style={{ display: 'flex', gap: 28, padding: '0 24px 16px', fontWeight: 800 }}>
                <button className="vanta-ghost-button" type="button">
                  <Plus size={17} /> Upload
                </button>
                <button className="vanta-ghost-button" type="button">
                  <Plus size={17} /> Add URL
                </button>
                <button className="vanta-ghost-button" type="button">
                  <Plus size={17} /> Import
                </button>
              </div>
              {[
                ['Access_Review_Q4_2024.pdf', 'Expires on Sep 7, 2026 - Link - Added by Laurie Cain'],
                ['Review_Methodology.docx', 'Expires on Sep 7, 2026 - Link - Added by Laurie Cain'],
              ].map(([name, meta]) => (
                <div className="vanta-file-row" key={name}>
                  <span className="vanta-file-icon">
                    <Link2 size={24} />
                  </span>
                  <div>
                    <h4>{name}</h4>
                    <p>{meta}</p>
                  </div>
                </div>
              ))}
            </section>
          </div>
        </main>
        <aside className="vanta-doc-agent">
          <h2>Vanta Agent</h2>
          <Sparkles className="vanta-spark" size={42} />
          <div className="vanta-doc-agent-body">
            <p>
              <strong>Thinking involved 3 steps</strong>
            </p>
            <h3>Summary:</h3>
            <p>
              <CheckCircle2 size={16} color="#12c94b" fill="#12c94b" /> 0 gaps in your compliance found
            </p>
            <h3>Scope of review:</h3>
            <p>
              We reviewed the evidence submitted for Proof of completed access review, which should include documentation of a recent,
              completed review of access rights across all in-scope systems.
            </p>
            <h3>Findings and remediation instructions:</h3>
            <p>The files pass all evaluation checks!</p>
            <p style={{ marginTop: 30 }}>
              <FileText size={15} /> 3 sources
            </p>
          </div>
          <div className="vanta-agent-input">
            <span>Ask anything</span>
            <button className="vanta-icon-button" type="button" aria-label="Send">
              <Plus size={18} />
            </button>
          </div>
          <div className="vanta-agent-disclaimer">Vanta AI can make mistakes. Please verify responses.</div>
        </aside>
      </div>
    </div>
  );
}

export function VantaClonePage() {
  const { pathname } = useLocation();
  const screen = screenFromPath(pathname);

  switch (screen) {
    case 'starterGuide':
      return <StarterGuideScreen />;
    case 'frameworkUpload':
      return <FrameworkUploadScreen />;
    case 'frameworkReview':
      return <FrameworkImportReviewScreen />;
    case 'frameworkControlDrawer':
      return <FrameworkControlDrawerScreen />;
    case 'customTestModal':
      return <CustomTestModalScreen />;
    case 'customTestsFiltered':
      return <CustomTestsFilteredScreen />;
    case 'jiraTestDetail':
      return <JiraTestDetailScreen />;
    case 'addTestControl':
      return <AddTestToControlModalScreen />;
    case 'documentsList':
      return <DocumentsListScreen />;
    case 'newDocument':
      return <NewCustomDocumentScreen />;
    case 'addDocumentControl':
      return <AddDocumentToControlModalScreen />;
    case 'addDocumentControlSelected':
      return <AddDocumentToControlModalScreen selected />;
    case 'documentUpload':
      return <DocumentUploadScreen />;
    case 'documentUploadDetails':
      return <DocumentUploadDetailsModalScreen />;
    case 'documentDetail':
      return <DocumentDetailScreen />;
    case 'documentDetailMore':
      return <DocumentDetailScreen menu />;
    case 'editDocumentRequest':
      return <EditCustomDocumentRequestScreen />;
    case 'policyTemplates':
      return <PolicyTemplatesScreen />;
    case 'policyEditor':
      return <PolicyEditorScreen />;
    case 'assignApprover':
      return <AssignApproverModalScreen />;
    case 'policyReaccept':
      return <PolicyReacceptModalScreen />;
    case 'policyVersionEmpty':
      return <PolicyVersionEmptyScreen />;
    case 'policyCreateVersion':
      return <PolicyCreateVersionScreen />;
    case 'policyUploadVersion':
      return <PolicyUploadVersionScreen />;
    case 'policySyncConfluence':
      return <PolicySyncConfluenceScreen />;
    case 'createCustomPolicy':
      return <CreateCustomPolicyScreen />;
    case 'customPolicyDetail':
      return <CustomPolicyDetailScreen />;
    case 'employeeAssignment':
      return <EmployeeAssignmentModalScreen />;
    case 'policies':
      return <PoliciesListScreen />;
    case 'policyBuilder':
      return <PolicyBuilderScreen />;
    case 'thirdPartyPolicy':
      return <AddControlsModalScreen mode="policy" />;
    case 'addControlsModal':
      return <AddControlsModalScreen mode="modal" />;
    case 'peopleTasks':
      return <PeopleTaskStatusScreen />;
    case 'testsOverview':
      return <TestsOverviewScreen />;
    case 'testDetail':
      return <TestDetailScreen />;
    case 'testDeactivateMenu':
      return <TestDeactivateMenuScreen />;
    case 'deactivatedTests':
      return <DeactivatedTestsScreen />;
    case 'controlsOverview':
      return <ControlsOverviewScreen />;
    case 'controlsUpload':
      return <ControlsUploadScreen />;
    case 'controlsReview':
      return <ControlsImportReviewScreen />;
    case 'frameworksCatalog':
      return <FrameworksCatalogScreen />;
    case 'frameworkImport':
      return <FrameworkImportModalScreen />;
    case 'frameworkDetail':
      return <FrameworkDetailScreen />;
    case 'frameworkScope':
      return <FrameworkScopeScreen />;
    case 'integrationScope':
      return <IntegrationScopeConfigScreen />;
    case 'inventoryScope':
      return <InventoryScopeScreen />;
    case 'privacyPeopleScope':
      return <PrivacyPeopleScopeScreen />;
    case 'scopeSettings':
      return <ScopeSettingsScreen />;
    case 'auditModal':
      return <AuditModalScreen />;
    case 'consoleProgram':
      return <ConsoleProgramHealthScreen />;
    case 'consoleHome':
      return <ConsoleHomeScreen />;
    case 'consoleHomeTooltip':
      return <ConsoleHomeTooltipScreen />;
    case 'homeWelcome':
      return <HomeWelcomeScreen />;
    case 'notificationsSettings':
      return <NotificationsSettingsScreen />;
    case 'integrations':
      return <IntegrationsCatalogScreen />;
    case 'riskLibrary':
      return <RiskLibraryScreen />;
    case 'addRiskScenario':
      return <AddRiskScenarioModalScreen />;
    case 'usersAdd':
      return <UsersAccessScreen mode="add" />;
    case 'usersSelected':
      return <UsersAccessScreen mode="selected" />;
    case 'usersPlain':
      return <UsersAccessScreen mode="plain" />;
    case 'users':
      return <UsersAccessScreen />;
    case 'commitments':
      return <CommitmentsScreen />;
    case 'people':
      return <PeopleScreen />;
    case 'complianceReport':
      return <ComplianceReportScreen />;
    case 'riskReport':
      return <RiskReportScreen />;
    case 'questionnaire':
      return <QuestionnaireScreen />;
    case 'audits':
      return <AuditsScreen />;
    case 'documents':
      return <DocumentsScreen />;
    case 'vendor':
    default:
      return <VendorReviewScreen />;
  }
}
