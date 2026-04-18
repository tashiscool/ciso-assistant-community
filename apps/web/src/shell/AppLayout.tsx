import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ConMonProfilesPage } from '../features/conmon/ConMonProfilesPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { BrandingPage } from '../features/setup/BrandingPage';
import { ClassificationPage } from '../features/setup/ClassificationPage';
import { GeneralPage } from '../features/setup/GeneralPage';
import { EvidenceSourcesPage } from '../features/evidence/EvidenceSourcesPage';
import { EvidenceJobsPage } from '../features/evidence/EvidenceJobsPage';
import { EvidenceManagementPage } from '../features/evidence/EvidenceManagementPage';
import { EmailPage } from '../features/setup/EmailPage';
import { MePage } from '../features/core/MePage';
import { BootstrapAccessPanel } from '../features/core/BootstrapAccessPanel';
import { ConMonExecutionsPage } from '../features/conmon/ConMonExecutionsPage';
import { FrameworksPage } from '../features/core/FrameworksPage';
import { FrameworkDetailPage } from '../features/core/FrameworkDetailPage';
import { LibrariesPage } from '../features/libraries/LibrariesPage';
import { LibraryDetailPage } from '../features/libraries/LibraryDetailPage';
import { RiskScenariosPage } from '../features/risk/RiskScenariosPage';
import { FoldersPage } from '../features/iam/FoldersPage';
import { TeamPage } from '../features/iam/TeamPage';
import { AccessPage } from '../features/iam/AccessPage';
import { AssessmentsPage } from '../features/assessments/AssessmentsPage';
import { RiskAssessmentDetailPage } from '../features/assessments/RiskAssessmentDetailPage';
import { ComplianceAssessmentDetailPage } from '../features/assessments/ComplianceAssessmentDetailPage';
import { ComplianceActionPlanPage } from '../features/assessments/ComplianceActionPlanPage';
import { RiskAssessmentActionPlanPage } from '../features/assessments/RiskAssessmentActionPlanPage';
import { AppliedControlsKanbanPage } from '../features/assessments/AppliedControlsKanbanPage';
import { AppliedControlsFlashPage } from '../features/assessments/AppliedControlsFlashPage';
import { TprmWorkspacePage } from '../features/tprm/TprmWorkspacePage';
import { EntityDetailPage } from '../features/tprm/EntityDetailPage';
import { PrivacyWorkspacePage } from '../features/privacy/PrivacyWorkspacePage';
import { ProcessingDetailPage } from '../features/privacy/ProcessingDetailPage';
import { ResiliencePage } from '../features/resilience/ResiliencePage';
import { BusinessImpactAnalysisDetailPage } from '../features/resilience/BusinessImpactAnalysisDetailPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { DoraReportPage } from '../features/reports/DoraReportPage';
import { ChatWorkspacePage } from '../features/chat/ChatWorkspacePage';
import { ImportsPage } from '../features/imports/ImportsPage';
import { AutomationManagerPage } from '../features/integrations/AutomationManagerPage';
import { PortalDashboardPage } from '../features/portal/PortalDashboardPage';
import { PortalAssignmentDetailPage } from '../features/portal/PortalAssignmentDetailPage';
import { ExportBuilderPage } from '../features/builders/ExportBuilderPage';
import { ExportBuilderDocxGuidePage } from '../features/builders/ExportBuilderDocxGuidePage';
import { FormBuilderPage } from '../features/builders/FormBuilderPage';
import { ReportBuilderPage } from '../features/builders/ReportBuilderPage';
import { DashboardBuilderPage } from '../features/builders/DashboardBuilderPage';
import { QuestionnaireBuilderPage } from '../features/builders/QuestionnaireBuilderPage';
import { QuestionnaireOverviewPage } from '../features/builders/QuestionnaireOverviewPage';
import { QuestionnaireRulesEnginePage } from '../features/builders/QuestionnaireRulesEnginePage';
import { RulesBuilderPage } from '../features/builders/RulesBuilderPage';
import { WayfinderBuilderPage } from '../features/builders/WayfinderBuilderPage';
import { AIPolicyBuilderPage } from '../features/ai/AIPolicyBuilderPage';
import { ComplianceExportsPage } from '../features/ai/ComplianceExportsPage';
import { ResponseAutomationPage } from '../features/ai/ResponseAutomationPage';
import { EvidenceMappingPage } from '../features/ai/EvidenceMappingPage';
import {
  RegMLAIGeneratorPage,
  RegMLAuditorPage,
  RegMLAuthorPage,
  RegMLExplainerPage,
  RegMLPage,
  RegMLSSPAuthorPage,
} from '../features/ai/RegMLPage';
import { EbiosWorkspacePage } from '../features/advanced-risk/EbiosWorkspacePage';
import { EbiosStudyDetailPage } from '../features/advanced-risk/EbiosStudyDetailPage';
import { QuantitativeWorkspacePage } from '../features/advanced-risk/QuantitativeWorkspacePage';
import { QuantitativeStudyDetailPage } from '../features/advanced-risk/QuantitativeStudyDetailPage';
import { QuantitativeExecutiveSummaryPage } from '../features/advanced-risk/QuantitativeExecutiveSummaryPage';
import { QuantitativeKeyMetricsPage } from '../features/advanced-risk/QuantitativeKeyMetricsPage';
import { QuantitativeActionPlanPage } from '../features/advanced-risk/QuantitativeActionPlanPage';
import { QuantitativeScenarioDetailPage } from '../features/advanced-risk/QuantitativeScenarioDetailPage';
import { QuantitativeHypothesisDetailPage } from '../features/advanced-risk/QuantitativeHypothesisDetailPage';
import { RiskAssessmentConversionPage } from '../features/advanced-risk/RiskAssessmentConversionPage';
import { AnalyticsControlRoomPage } from '../features/ops/AnalyticsControlRoomPage';
import { BackupRestoreControlPage } from '../features/ops/BackupRestoreControlPage';
import { CalendarControlPage } from '../features/ops/CalendarControlPage';
import { DashboardsControlPage } from '../features/ops/DashboardsControlPage';
import { ProgramControlPage } from '../features/ops/ProgramControlPage';
import { QuickStartControlPage } from '../features/ops/QuickStartControlPage';
import {
  ActorsControlPage,
  AssetAssessmentsControlPage,
  AssetsControlPage,
  IncidentsControlPage,
  PoliciesControlPage,
  SecurityExceptionsControlPage,
  VulnerabilitiesControlPage,
} from '../features/ops/RegistryControlPages';
import { SearchControlRoomPage } from '../features/ops/SearchControlRoomPage';
import { SettingsControlRoomPage } from '../features/ops/SettingsControlRoomPage';
import { NewsFeedControlPage } from '../features/ops/NewsFeedControlPage';
import { LibraryMappingsControlPage, TaskOperationsControlPage } from '../features/ops/TaskAndMappingControlPages';
import { ValidationFlowsControlPage } from '../features/ops/ValidationFlowsControlPage';
import { WorkbenchControlPage } from '../features/ops/WorkbenchControlPage';
import { WorkflowControlPage } from '../features/ops/WorkflowControlPage';
import { XRaysControlPage } from '../features/ops/XRaysControlPage';
import { UtilitiesControlPage } from '../features/ops/UtilitiesControlPage';
import { SubsystemsControlPage } from '../features/ops/SubsystemsControlPage';
import { RMFControlPage } from '../features/ops/RMFControlPage';
import { AppManagementControlPage } from '../features/ops/AppManagementControlPage';
import { LogsUtilizationPage } from '../features/setup/LogsUtilizationPage';
import { MFAPage } from '../features/setup/MFAPage';
import { ModulesFeaturesPage } from '../features/setup/ModulesFeaturesPage';
import { RiskModelPage } from '../features/setup/RiskModelPage';
import { SecurityPosturePage } from '../features/setup/SecurityPosturePage';
import { ServiceAccountsPage } from '../features/setup/ServiceAccountsPage';
import { SSOPage } from '../features/setup/SSOPage';
import { TagsPage } from '../features/setup/TagsPage';
import { LegacyRouteBridgePage } from '../features/parity/LegacyRouteBridgePage';
import { useEdgeIdentity } from '../shared/session/identity';
import { useSessionBootstrap } from '../shared/session/useSessionBootstrap';
import { ApiClient } from '../shared/api/client';
import type { IamMePayload } from '../features/iam/types';
import {
} from '../features/parity/ParityRoutePages';

const legacyBridgeModels = [
  'accreditations',
  'analytics',
  'actors',
  'asset-assessments',
  'assets',
  'auditee-assessments',
  'auditee-dashboard',
  'backup-restore',
  'business-impact-analysis',
  'calendar',
  'compliance-assessments',
  'contracts',
  'dashboards',
  'ebios-rm',
  'entities',
  'entity-assessments',
  'evidence-revisions',
  'evidences',
  'experimental',
  'findings-assessments',
  'first-connexion',
  'folders',
  'generic-collections',
  'incidents',
  'libraries',
  'license-management',
  'loaded-libraries',
  'login',
  'logout',
  'mapping-libraries',
  'metric-instances',
  'my-assignments',
  'my-profile',
  'operating-modes',
  'operational-scenarios',
  'password-reset',
  'policies',
  'preset-journeys',
  'presets',
  'processings',
  'quantitative-risk-hypotheses',
  'quantitative-risk-scenarios',
  'quantitative-risk-studies',
  'quick-start',
  'recap',
  'reports',
  'requirement-assessments',
  'requirement-mapping-sets',
  'risk-assessments',
  'risk-matrices',
  'risk-scenarios',
  'ro-to',
  'scoring-assistant',
  'search',
  'security-exceptions',
  'settings',
  'setup-mfa',
  'stakeholders',
  'stored-libraries',
  'strategic-scenarios',
  'sso',
  'sync-mappings',
  'task-nodes',
  'task-templates',
  'users',
  'validation-flows',
  'vulnerabilities',
  'x-rays',
] as const;

const client = new ApiClient();

export function AppLayout() {
  const session = useSessionBootstrap();
  const { identity } = useEdgeIdentity();
  const [passwordResetRequired, setPasswordResetRequired] = useState(false);
  const showWorkspaceShell = session.ready && session.isAuthenticated;

  useEffect(() => {
    let cancelled = false;

    async function loadPasswordPosture() {
      if (!session.ready || !session.isAuthenticated) {
        setPasswordResetRequired(false);
        return;
      }

      try {
        const response = await client.get<{ data: IamMePayload }>('/iam/me');
        if (!cancelled) {
          setPasswordResetRequired(Boolean(response.data.profile?.localPasswordResetRequired));
        }
      } catch {
        if (!cancelled) {
          setPasswordResetRequired(false);
        }
      }
    }

    void loadPasswordPosture();

    return () => {
      cancelled = true;
    };
  }, [identity.tenantId, identity.userId, session.isAuthenticated, session.ready]);

  if (!showWorkspaceShell) {
    return (
      <div className="min-h-screen bg-transparent text-slate-50">
        <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-10">
          <div className="w-full max-w-4xl space-y-6">
            {!session.ready ? (
              <section className="panel max-w-3xl">
                <div className="eyebrow">Secure Session</div>
                <h1 className="mt-2 text-2xl font-semibold text-white">Establishing workspace session</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  Regovise is exchanging the current workspace identity for a secure Cloudflare session cookie so the rest of the app can run on server-enforced authentication.
                </p>
              </section>
            ) : (
              <>
                {session.error && <div className="notice-warning">{session.error}</div>}
                <BootstrapAccessPanel />
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-transparent text-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar sessionReady={session.ready} sessionSyncing={session.syncing} />
        <main className="flex-1 overflow-auto px-6 py-6">
          <>
            {session.error && <div className="notice-warning mb-6">{session.error}</div>}
            {passwordResetRequired && (
              <div className="notice-warning mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  A temporary local password is active for this account. Rotate it now in My Access
                  to finish securing the session.
                </div>
                <Link className="button-secondary" to="/workspace/me">
                  Open My Access
                </Link>
              </div>
            )}
            <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/workspace/me" element={<MePage />} />
            <Route path="/workspace/domains" element={<FoldersPage />} />
            <Route path="/workspace/team" element={<TeamPage />} />
            <Route path="/workspace/access" element={<AccessPage />} />
            <Route path="/setup/tags" element={<TagsPage />} />
            <Route path="/setup/general" element={<GeneralPage />} />
            <Route path="/setup/classification" element={<ClassificationPage />} />
            <Route path="/setup/service-accounts" element={<ServiceAccountsPage />} />
            <Route path="/setup/branding" element={<BrandingPage />} />
            <Route path="/setup/email" element={<EmailPage />} />
            <Route path="/setup/logs-utilization" element={<LogsUtilizationPage />} />
            <Route path="/setup/security" element={<SecurityPosturePage />} />
            <Route path="/setup/modules-features" element={<ModulesFeaturesPage />} />
            <Route path="/setup/risk-model" element={<RiskModelPage />} />
            <Route path="/setup/sso" element={<SSOPage />} />
            <Route path="/setup/mfa" element={<MFAPage />} />
            <Route path="/setup/theming-branding" element={<BrandingPage />} />
            <Route path="/sso" element={<SSOPage />} />
            <Route path="/setup-mfa" element={<MFAPage />} />
            <Route path="/libraries" element={<LibrariesPage />} />
            <Route path="/libraries/:libraryId" element={<LibraryDetailPage />} />
            <Route path="/frameworks" element={<FrameworksPage />} />
            <Route path="/frameworks/:frameworkId" element={<FrameworkDetailPage />} />
            <Route path="/assessments" element={<AssessmentsPage />} />
            <Route path="/risk-assessments/:assessmentId" element={<RiskAssessmentDetailPage />} />
            <Route
              path="/risk-assessments/:assessmentId/action-plan"
              element={<RiskAssessmentActionPlanPage />}
            />
            <Route
              path="/risk-assessments/:assessmentId/action-plan/budget-overview"
              element={<RiskAssessmentActionPlanPage />}
            />
            <Route
              path="/compliance-assessments/:assessmentId"
              element={<ComplianceAssessmentDetailPage />}
            />
            <Route
              path="/compliance-assessments/:assessmentId/action-plan"
              element={<ComplianceActionPlanPage />}
            />
            <Route
              path="/compliance-assessments/:assessmentId/action-plan/budget-overview"
              element={<ComplianceActionPlanPage />}
            />
            <Route
              path="/compliance-assessments/:assessmentId/flash-mode"
              element={<AppliedControlsFlashPage />}
            />
            <Route path="/applied-controls/kanban-mode" element={<AppliedControlsKanbanPage />} />
            <Route path="/applied-controls/flash-mode" element={<AppliedControlsFlashPage />} />
            <Route path="/third-party" element={<TprmWorkspacePage />} />
            <Route path="/third-party/entities/:entityId" element={<EntityDetailPage />} />
            <Route path="/entities/:entityId" element={<EntityDetailPage />} />
            <Route path="/privacy" element={<PrivacyWorkspacePage />} />
            <Route path="/privacy/processings/:processingId" element={<ProcessingDetailPage />} />
            <Route path="/processings/:processingId" element={<ProcessingDetailPage />} />
            <Route path="/resilience" element={<ResiliencePage />} />
            <Route
              path="/resilience/business-impact-analyses/:analysisId"
              element={<BusinessImpactAnalysisDetailPage />}
            />
            <Route
              path="/business-impact-analysis/:analysisId"
              element={<BusinessImpactAnalysisDetailPage />}
            />
            <Route
              path="/business-impact-analysis/:analysisId/action-plan"
              element={<BusinessImpactAnalysisDetailPage />}
            />
            <Route
              path="/business-impact-analysis/:analysisId/report"
              element={<BusinessImpactAnalysisDetailPage />}
            />
            <Route
              path="/business-impact-analysis/:analysisId/visual"
              element={<BusinessImpactAnalysisDetailPage />}
            />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/dora-roi" element={<DoraReportPage />} />
            <Route path="/builders/export-builder" element={<ExportBuilderPage />} />
            <Route path="/builders/export-builder/docx-template" element={<ExportBuilderDocxGuidePage />} />
            <Route path="/builders/form-builder" element={<FormBuilderPage />} />
            <Route path="/builders/report-builder" element={<ReportBuilderPage />} />
            <Route path="/builders/dashboard-builder" element={<DashboardBuilderPage />} />
            <Route path="/builders/rules-builder" element={<RulesBuilderPage />} />
            <Route path="/builders/wayfinder-builder" element={<WayfinderBuilderPage />} />
            <Route path="/builders/questionnaire-builder/overview" element={<QuestionnaireOverviewPage />} />
            <Route path="/builders/questionnaire-builder" element={<QuestionnaireBuilderPage />} />
            <Route
              path="/builders/questionnaire-builder/rules-engine"
              element={<QuestionnaireRulesEnginePage />}
            />
            <Route path="/features/regml" element={<RegMLPage />} />
            <Route path="/features/regml/control-ai-features" element={<RegMLPage />} />
            <Route path="/features/regml/author" element={<RegMLAuthorPage />} />
            <Route path="/features/regml/explainer" element={<RegMLExplainerPage />} />
            <Route path="/features/regml/ssp-ai-features" element={<RegMLPage />} />
            <Route path="/features/regml/ssp-author" element={<RegMLSSPAuthorPage />} />
            <Route path="/features/regml/auditor" element={<RegMLAuditorPage />} />
            <Route path="/features/regml/ai-generator" element={<RegMLAIGeneratorPage />} />
            <Route path="/ai-policy-builder" element={<AIPolicyBuilderPage />} />
            <Route path="/features/ai-policy-builder" element={<AIPolicyBuilderPage />} />
            <Route path="/response-automation" element={<ResponseAutomationPage />} />
            <Route path="/features/response-automation" element={<ResponseAutomationPage />} />
            <Route path="/evidence-mapping" element={<EvidenceMappingPage />} />
            <Route path="/features/evidence-mapping" element={<EvidenceMappingPage />} />
            <Route path="/compliance-exports" element={<ComplianceExportsPage />} />
            <Route path="/features/compliance-exports" element={<ComplianceExportsPage />} />
            <Route path="/features/compliance-exports/emass" element={<ComplianceExportsPage initialFilter="emass" />} />
            <Route path="/features/compliance-exports/fedramp" element={<ComplianceExportsPage initialFilter="fedramp" />} />
            <Route path="/chat" element={<ChatWorkspacePage />} />
            <Route path="/imports" element={<ImportsPage />} />
            <Route path="/automation-manager" element={<AutomationManagerPage />} />
            <Route path="/features/automation-manager" element={<AutomationManagerPage />} />
            <Route path="/workflow" element={<WorkflowControlPage />} />
            <Route path="/features/workflow" element={<WorkflowControlPage />} />
            <Route path="/utilities" element={<UtilitiesControlPage />} />
            <Route path="/features/utilities" element={<UtilitiesControlPage />} />
            <Route path="/subsystems" element={<SubsystemsControlPage />} />
            <Route path="/features/subsystems" element={<SubsystemsControlPage />} />
            <Route path="/rmf" element={<RMFControlPage />} />
            <Route path="/features/rmf" element={<RMFControlPage />} />
            <Route path="/app-management" element={<AppManagementControlPage />} />
            <Route path="/features/app-management" element={<AppManagementControlPage />} />
            <Route path="/workbench" element={<WorkbenchControlPage />} />
            <Route path="/features/workbench" element={<WorkbenchControlPage />} />
            <Route path="/news-feed" element={<NewsFeedControlPage />} />
            <Route path="/features/news-feed" element={<NewsFeedControlPage />} />
            <Route path="/portal" element={<PortalDashboardPage />} />
            <Route path="/portal/assignments/:assignmentId" element={<PortalAssignmentDetailPage />} />
            <Route path="/advanced-risk/ebios" element={<EbiosWorkspacePage />} />
            <Route path="/advanced-risk/ebios/:studyId" element={<EbiosStudyDetailPage />} />
            <Route path="/advanced-risk/quantitative" element={<QuantitativeWorkspacePage />} />
            <Route
              path="/advanced-risk/quantitative/:studyId"
              element={<QuantitativeStudyDetailPage />}
            />
            <Route
              path="/advanced-risk/quantitative/:studyId/executive-summary"
              element={<QuantitativeExecutiveSummaryPage />}
            />
            <Route
              path="/advanced-risk/quantitative/:studyId/key-metrics"
              element={<QuantitativeKeyMetricsPage />}
            />
            <Route
              path="/advanced-risk/quantitative/:studyId/action-plan"
              element={<QuantitativeActionPlanPage />}
            />
            <Route
              path="/quantitative-risk-studies/:studyId/action-plan/budget-overview"
              element={<QuantitativeActionPlanPage />}
            />
            <Route
              path="/quantitative-risk-scenarios/:scenarioId"
              element={<QuantitativeScenarioDetailPage />}
            />
            <Route
              path="/quantitative-risk-hypotheses/:hypothesisId"
              element={<QuantitativeHypothesisDetailPage />}
            />
            <Route
              path="/risk-assessments/:assessmentId/convert-to-quantitative"
              element={<RiskAssessmentConversionPage />}
            />
            <Route path="/folders" element={<FoldersPage />} />
            <Route path="/users" element={<TeamPage />} />
            <Route path="/my-profile" element={<MePage />} />
            <Route path="/my-assignments" element={<PortalDashboardPage />} />
            <Route path="/entities" element={<TprmWorkspacePage />} />
            <Route path="/contracts" element={<TprmWorkspacePage />} />
            <Route path="/processings" element={<PrivacyWorkspacePage />} />
            <Route path="/business-impact-analysis" element={<ResiliencePage />} />
            <Route path="/compliance-assessments" element={<AssessmentsPage />} />
            <Route path="/risk-assessments" element={<AssessmentsPage />} />
            <Route path="/loaded-libraries" element={<LibrariesPage />} />
            <Route path="/loaded-libraries/:libraryId" element={<LibraryDetailPage />} />
            <Route path="/mapping-libraries" element={<LibrariesPage />} />
            <Route path="/stored-libraries" element={<LibrariesPage />} />
            <Route path="/stored-libraries/:libraryId" element={<LibraryDetailPage />} />
            <Route path="/auditee-dashboard" element={<PortalDashboardPage />} />
            <Route path="/auditee-assessments/:assignmentId" element={<PortalAssignmentDetailPage />} />
            <Route path="/ebios-rm" element={<EbiosWorkspacePage />} />
            <Route path="/ebios-rm/:studyId" element={<EbiosStudyDetailPage />} />
            <Route path="/ebios-rm/:studyId/visual" element={<EbiosStudyDetailPage />} />
            <Route path="/ebios-rm/:studyId/report" element={<EbiosStudyDetailPage />} />
            <Route path="/ebios-rm/:studyId/workshop-1/feared-events" element={<EbiosStudyDetailPage />} />
            <Route path="/ebios-rm/:studyId/workshop-1/baseline" element={<EbiosStudyDetailPage />} />
            <Route path="/ebios-rm/:studyId/workshop-1/ebios-rm-study" element={<EbiosStudyDetailPage />} />
            <Route path="/ebios-rm/:studyId/workshop-1/ebios-rm-study/edit" element={<EbiosStudyDetailPage />} />
            <Route path="/ebios-rm/:studyId/workshop-2/ro-to" element={<EbiosStudyDetailPage />} />
            <Route path="/ebios-rm/:studyId/workshop-3/ecosystem" element={<EbiosStudyDetailPage />} />
            <Route path="/ebios-rm/:studyId/workshop-3/strategic-scenarios" element={<EbiosStudyDetailPage />} />
            <Route path="/ebios-rm/:studyId/workshop-4/operational-scenario" element={<EbiosStudyDetailPage />} />
            <Route path="/ebios-rm/:studyId/workshop-4/elementary-actions" element={<EbiosStudyDetailPage />} />
            <Route path="/ebios-rm/:studyId/workshop-5/risk-analyses" element={<EbiosStudyDetailPage />} />
            <Route path="/quantitative-risk-studies" element={<QuantitativeWorkspacePage />} />
            <Route path="/quantitative-risk-studies/:studyId" element={<QuantitativeStudyDetailPage />} />
            <Route
              path="/quantitative-risk-studies/:studyId/executive-summary"
              element={<QuantitativeExecutiveSummaryPage />}
            />
            <Route
              path="/quantitative-risk-studies/:studyId/key-metrics"
              element={<QuantitativeKeyMetricsPage />}
            />
            <Route
              path="/quantitative-risk-studies/:studyId/action-plan"
              element={<QuantitativeActionPlanPage />}
            />
            <Route
              path="/assets"
              element={<AssetsControlPage />}
            />
            <Route
              path="/asset-assessments"
              element={<AssetAssessmentsControlPage />}
            />
            <Route
              path="/actors"
              element={<ActorsControlPage />}
            />
            <Route
              path="/vulnerabilities"
              element={<VulnerabilitiesControlPage />}
            />
            <Route
              path="/policies"
              element={<PoliciesControlPage />}
            />
            <Route
              path="/incidents"
              element={<IncidentsControlPage />}
            />
            <Route
              path="/security-exceptions"
              element={<SecurityExceptionsControlPage />}
            />
            <Route
              path="/analytics"
              element={<AnalyticsControlRoomPage />}
            />
            <Route
              path="/search"
              element={<SearchControlRoomPage />}
            />
            <Route
              path="/backup-restore"
              element={<BackupRestoreControlPage />}
            />
            <Route
              path="/calendar"
              element={<CalendarControlPage />}
            />
            <Route
              path="/quick-start"
              element={<QuickStartControlPage />}
            />
            <Route
              path="/settings"
              element={<SettingsControlRoomPage />}
            />
            <Route
              path="/dashboards"
              element={<DashboardsControlPage />}
            />
            <Route
              path="/recap"
              element={<DashboardsControlPage />}
            />
            <Route
              path="/validation-flows"
              element={<ValidationFlowsControlPage />}
            />
            <Route
              path="/x-rays"
              element={<XRaysControlPage />}
            />
            <Route
              path="/task-nodes"
              element={<TaskOperationsControlPage />}
            />
            <Route
              path="/task-templates"
              element={<TaskOperationsControlPage />}
            />
            <Route
              path="/risk-matrices"
              element={<DashboardsControlPage />}
            />
            <Route
              path="/requirement-assessments"
              element={<ValidationFlowsControlPage />}
            />
            <Route
              path="/requirement-mapping-sets"
              element={<LibraryMappingsControlPage />}
            />
            <Route
              path="/sync-mappings"
              element={<LibraryMappingsControlPage />}
            />
            <Route
              path="/content-types"
              element={<ProgramControlPage />}
            />
            <Route
              path="/generic-collections"
              element={<ProgramControlPage />}
            />
            <Route
              path="/presets"
              element={<ProgramControlPage />}
            />
            <Route
              path="/preset-journeys"
              element={<ProgramControlPage />}
            />
            <Route
              path="/experimental"
              element={<ProgramControlPage />}
            />
            <Route
              path="/license-management"
              element={<ProgramControlPage />}
            />
            <Route
              path="/metric-instances"
              element={<AnalyticsControlRoomPage />}
            />
            <Route
              path="/accreditations"
              element={<ProgramControlPage />}
            />
            <Route
              path="/findings-assessments"
              element={<ValidationFlowsControlPage />}
            />
            <Route
              path="/operating-modes"
              element={<EbiosWorkspacePage />}
            />
            <Route
              path="/operational-scenarios"
              element={<EbiosWorkspacePage />}
            />
            <Route
              path="/strategic-scenarios"
              element={<EbiosWorkspacePage />}
            />
            <Route
              path="/ro-to"
              element={<EbiosWorkspacePage />}
            />
            <Route
              path="/stakeholders"
              element={<EbiosWorkspacePage />}
            />
            <Route
              path="/scoring-assistant"
              element={<ChatWorkspacePage />}
            />
            <Route path="/risk-scenarios" element={<RiskScenariosPage />} />
            <Route path="/conmon/profiles" element={<ConMonProfilesPage />} />
            <Route path="/conmon/executions" element={<ConMonExecutionsPage />} />
            <Route path="/evidence-management" element={<EvidenceManagementPage />} />
            <Route path="/features/evidence-management" element={<EvidenceManagementPage />} />
            <Route path="/evidence/sources" element={<EvidenceSourcesPage />} />
            <Route path="/evidence/jobs" element={<EvidenceJobsPage />} />
            {legacyBridgeModels.map((model) => (
              <Route
                key={model}
                path={`/${model}/*`}
                element={<LegacyRouteBridgePage legacyModel={model} />}
              />
            ))}
                <Route
                  path="*"
                  element={
                    <div className="panel flex min-h-[240px] items-center justify-center text-slate-300">
                      Select a workspace area from the left navigation.
                    </div>
                  }
                />
            </Routes>
          </>
        </main>
      </div>
    </div>
  );
}
