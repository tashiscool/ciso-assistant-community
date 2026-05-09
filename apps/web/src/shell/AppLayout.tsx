import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ConMonProfilesPage } from '../features/conmon/ConMonProfilesPage';
import { HomePage } from '../features/home/HomePage';
import { BrandingPage } from '../features/setup/BrandingPage';
import { ClassificationPage } from '../features/setup/ClassificationPage';
import { GeneralPage } from '../features/setup/GeneralPage';
import { EvidenceSourcesPage } from '../features/evidence/EvidenceSourcesPage';
import { EvidenceJobsPage } from '../features/evidence/EvidenceJobsPage';
import { EvidenceManagementPage } from '../features/evidence/EvidenceManagementPage';
import { AssuranceOverviewPage } from '../features/assurance/AssuranceOverviewPage';
import { AssuranceEvidenceExplorerPage } from '../features/assurance/AssuranceEvidenceExplorerPage';
import { TrackerWorkbenchPage } from '../features/assurance/TrackerWorkbenchPage';
import { PackageExplorerPage } from '../features/assurance/PackageExplorerPage';
import { ReviewQueuePage } from '../features/assurance/ReviewQueuePage';
import { AgentRunInspectorPage } from '../features/assurance/AgentRunInspectorPage';
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
import { isAuthEntryPath, isLogoutPath, resetEdgeIdentity, useEdgeIdentity } from '../shared/session/identity';
import { useSessionBootstrap } from '../shared/session/useSessionBootstrap';
import { ApiClient } from '../shared/api/client';
import type { IamMePayload } from '../features/iam/types';
import { deriveShellAccessProfile, getDefaultShellRoute } from './shellAccess';
import { RouteAccessBoundary } from './RouteAccessBoundary';

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

type BootstrapStatusResponse = {
  data: {
    initialized: boolean;
  };
};

function SessionExitScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setError(null);
        await fetch('/_api/core/session', {
          method: 'DELETE',
          credentials: 'include',
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to end the current session cleanly.');
        }
      } finally {
        if (cancelled) {
          return;
        }

        resetEdgeIdentity('anonymous');
        const next = new URLSearchParams(location.search).get('next');
        navigate(next?.startsWith('/') ? `/login?next=${encodeURIComponent(next)}` : '/login', {
          replace: true,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.search, navigate]);

  return (
    <section className="panel max-w-3xl">
      <div className="eyebrow">Secure Session</div>
      <h1 className="mt-2 text-2xl font-semibold text-white">Signing out</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
        Regovise is clearing the current workspace session before opening the standard sign-in surface.
      </p>
      {error ? <div className="notice-warning mt-4">{error}</div> : null}
    </section>
  );
}

function AccessEntryRouter() {
  const location = useLocation();
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setError(null);
        const response = await fetch('/_api/core/bootstrap/status', {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error(`Unable to load bootstrap status (${response.status})`);
        }
        const payload = (await response.json()) as BootstrapStatusResponse;
        if (!cancelled) {
          setInitialized(payload.data.initialized);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load access routing.');
          setInitialized(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (initialized === null) {
    return (
      <section className="panel max-w-3xl">
        <div className="eyebrow">Secure Session</div>
        <h1 className="mt-2 text-2xl font-semibold text-white">Preparing sign-in</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          Regovise is checking whether this workspace should open sign-in, first-run setup, or administrator recovery.
        </p>
      </section>
    );
  }

  const currentPath = location.pathname;
  const currentTarget = `${location.pathname}${location.search}${location.hash}`;
  const defaultTarget = initialized ? '/login' : '/setup/initialize';

  if (!isAuthEntryPath(currentPath)) {
    const next = currentTarget !== '/' ? `?next=${encodeURIComponent(currentTarget)}` : '';
    return <Navigate replace to={`${defaultTarget}${next}`} />;
  }

  return (
    <>
      {error ? <div className="notice-warning mb-6">{error}</div> : null}
      <Routes>
        <Route path="/login" element={<BootstrapAccessPanel surface="login" />} />
        <Route path="/setup/initialize" element={<BootstrapAccessPanel surface="initialize" />} />
        <Route path="/admin/recover" element={<BootstrapAccessPanel surface="recovery" />} />
        <Route path="*" element={<Navigate replace to={defaultTarget} />} />
      </Routes>
    </>
  );
}

export function AppLayout() {
  const location = useLocation();
  const session = useSessionBootstrap();
  const { identity } = useEdgeIdentity();
  const [passwordResetRequired, setPasswordResetRequired] = useState(false);
  const [accessPayload, setAccessPayload] = useState<IamMePayload | null>(null);
  const [accessReady, setAccessReady] = useState(false);
  const showWorkspaceShell = session.ready && session.isAuthenticated;
  const access = deriveShellAccessProfile(accessPayload);
  const forceSignedOutEntry =
    isLogoutPath(location.pathname) ||
    (isAuthEntryPath(location.pathname) && new URLSearchParams(location.search).get('reauth') === '1');

  useEffect(() => {
    let cancelled = false;

    async function loadAccessContext() {
      if (!session.ready || !session.isAuthenticated) {
        setPasswordResetRequired(false);
        setAccessPayload(null);
        setAccessReady(true);
        return;
      }

      try {
        setAccessReady(false);
        const response = await client.get<{ data: IamMePayload }>('/iam/me');
        if (!cancelled) {
          setAccessPayload(response.data);
          setPasswordResetRequired(Boolean(response.data.profile?.localPasswordResetRequired));
          setAccessReady(true);
        }
      } catch {
        if (!cancelled) {
          setAccessPayload(null);
          setPasswordResetRequired(false);
          setAccessReady(true);
        }
      }
    }

    void loadAccessContext();

    return () => {
      cancelled = true;
    };
  }, [identity.tenantId, identity.userId, session.isAuthenticated, session.ready]);

  if (forceSignedOutEntry) {
    return (
      <div className="min-h-screen bg-transparent text-slate-50">
        <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-10">
          <div className="w-full max-w-4xl space-y-6">
            <SessionExitScreen />
          </div>
        </main>
      </div>
    );
  }

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
                  Regovise is preparing the secure session needed to open the workspace.
                </p>
              </section>
            ) : (
              <>
                {session.error && <div className="notice-warning">{session.error}</div>}
                <AccessEntryRouter />
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  if (!accessReady) {
    return (
      <div className="flex min-h-screen bg-transparent text-slate-50">
        <div className="flex flex-1 flex-col">
          <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-10">
            <section className="panel max-w-3xl">
              <div className="eyebrow">Workspace Access</div>
              <h1 className="mt-2 text-2xl font-semibold text-white">Preparing your workspace</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Regovise is loading the current workspace identity and access profile before rendering the main navigation.
              </p>
            </section>
          </main>
        </div>
      </div>
    );
  }

  function adminOnly(element: JSX.Element, fallback = getDefaultShellRoute(access)): JSX.Element {
    return access.isWorkspaceAdmin ? element : <RouteAccessBoundary fallback={fallback} variant="admin" />;
  }

  function internalOnly(element: JSX.Element, fallback = getDefaultShellRoute(access)): JSX.Element {
    return access.canViewInternalTools ? element : <RouteAccessBoundary fallback={fallback} variant="internal" />;
  }

  function allowedOnly(condition: boolean, element: JSX.Element, fallback = getDefaultShellRoute(access)): JSX.Element {
    return condition ? element : <RouteAccessBoundary fallback={fallback} variant="standard" />;
  }

  return (
    <div className="flex min-h-screen bg-transparent text-slate-50">
      <Sidebar access={access} />
      <div className="flex flex-1 flex-col">
        <Topbar
          access={access}
          profileEmail={accessPayload?.profile?.email ?? null}
          profileName={accessPayload?.profile?.displayName ?? null}
          sessionReady={session.ready}
          sessionSyncing={session.syncing}
        />
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
            <Route path="/login" element={<Navigate replace to="/" />} />
            <Route path="/setup/initialize" element={<Navigate replace to="/" />} />
            <Route path="/admin/recover" element={<Navigate replace to="/" />} />
            <Route path="/" element={<HomePage access={access} />} />
            <Route path="/program" element={allowedOnly(access.canUseProgramWorkspace, <ProgramControlPage access={access} />)} />
            <Route path="/program/setup" element={adminOnly(<QuickStartControlPage />)} />
            <Route path="/workspace/me" element={<MePage />} />
            <Route path="/workspace/domains" element={adminOnly(<FoldersPage />)} />
            <Route path="/workspace/team" element={adminOnly(<TeamPage />)} />
            <Route path="/workspace/access" element={adminOnly(<AccessPage />, '/workspace/me')} />
            <Route path="/setup/tags" element={adminOnly(<TagsPage />)} />
            <Route path="/setup/general" element={adminOnly(<GeneralPage />)} />
            <Route path="/setup/classification" element={adminOnly(<ClassificationPage />)} />
            <Route path="/setup/service-accounts" element={adminOnly(<ServiceAccountsPage />)} />
            <Route path="/setup/branding" element={adminOnly(<BrandingPage />)} />
            <Route path="/setup/email" element={adminOnly(<EmailPage />)} />
            <Route path="/setup/logs-utilization" element={adminOnly(<LogsUtilizationPage />)} />
            <Route path="/setup/security" element={adminOnly(<SecurityPosturePage />)} />
            <Route path="/setup/modules-features" element={adminOnly(<ModulesFeaturesPage />)} />
            <Route path="/setup/risk-model" element={adminOnly(<RiskModelPage />)} />
            <Route path="/setup/sso" element={adminOnly(<SSOPage />)} />
            <Route path="/setup/mfa" element={adminOnly(<MFAPage />)} />
            <Route path="/setup/theming-branding" element={adminOnly(<BrandingPage />)} />
            <Route path="/sso" element={adminOnly(<SSOPage />)} />
            <Route path="/setup-mfa" element={adminOnly(<MFAPage />)} />
            <Route path="/libraries" element={allowedOnly(access.canUseLibraries, <LibrariesPage />)} />
            <Route path="/libraries/:libraryId" element={allowedOnly(access.canUseLibraries, <LibraryDetailPage />)} />
            <Route path="/frameworks" element={allowedOnly(access.canUseFrameworks, <FrameworksPage />)} />
            <Route path="/frameworks/:frameworkId" element={allowedOnly(access.canUseFrameworks, <FrameworkDetailPage />)} />
            <Route path="/assessments" element={allowedOnly(access.canUseAssessmentWorkspace, <AssessmentsPage />)} />
            <Route path="/risk-assessments/:assessmentId" element={allowedOnly(access.canUseRiskAssessments, <RiskAssessmentDetailPage />)} />
            <Route
              path="/risk-assessments/:assessmentId/action-plan"
              element={allowedOnly(access.canUseRiskAssessments, <RiskAssessmentActionPlanPage />)}
            />
            <Route
              path="/risk-assessments/:assessmentId/action-plan/budget-overview"
              element={allowedOnly(access.canUseRiskAssessments, <RiskAssessmentActionPlanPage />)}
            />
            <Route
              path="/compliance-assessments/:assessmentId"
              element={allowedOnly(access.canUseComplianceAssessments, <ComplianceAssessmentDetailPage />)}
            />
            <Route
              path="/compliance-assessments/:assessmentId/action-plan"
              element={allowedOnly(access.canUseComplianceAssessments, <ComplianceActionPlanPage />)}
            />
            <Route
              path="/compliance-assessments/:assessmentId/action-plan/budget-overview"
              element={allowedOnly(access.canUseComplianceAssessments, <ComplianceActionPlanPage />)}
            />
            <Route
              path="/compliance-assessments/:assessmentId/flash-mode"
              element={allowedOnly(access.canUseComplianceAssessments, <AppliedControlsFlashPage />)}
            />
            <Route path="/applied-controls/kanban-mode" element={allowedOnly(access.canUseComplianceAssessments, <AppliedControlsKanbanPage />)} />
            <Route path="/applied-controls/flash-mode" element={allowedOnly(access.canUseComplianceAssessments, <AppliedControlsFlashPage />)} />
            <Route path="/third-party" element={allowedOnly(access.canUseThirdParty, <TprmWorkspacePage />)} />
            <Route path="/third-party/entities/:entityId" element={allowedOnly(access.canUseThirdParty, <EntityDetailPage />)} />
            <Route path="/entities/:entityId" element={allowedOnly(access.canUseThirdParty, <EntityDetailPage />)} />
            <Route path="/privacy" element={allowedOnly(access.canUsePrivacy, <PrivacyWorkspacePage />)} />
            <Route path="/privacy/processings/:processingId" element={allowedOnly(access.canUsePrivacy, <ProcessingDetailPage />)} />
            <Route path="/processings/:processingId" element={allowedOnly(access.canUsePrivacy, <ProcessingDetailPage />)} />
            <Route path="/resilience" element={allowedOnly(access.canUseResilience, <ResiliencePage />)} />
            <Route
              path="/resilience/business-impact-analyses/:analysisId"
              element={allowedOnly(access.canUseResilience, <BusinessImpactAnalysisDetailPage />)}
            />
            <Route
              path="/business-impact-analysis/:analysisId"
              element={allowedOnly(access.canUseResilience, <BusinessImpactAnalysisDetailPage />)}
            />
            <Route
              path="/business-impact-analysis/:analysisId/action-plan"
              element={allowedOnly(access.canUseResilience, <BusinessImpactAnalysisDetailPage />)}
            />
            <Route
              path="/business-impact-analysis/:analysisId/report"
              element={allowedOnly(access.canUseResilience, <BusinessImpactAnalysisDetailPage />)}
            />
            <Route
              path="/business-impact-analysis/:analysisId/visual"
              element={allowedOnly(access.canUseResilience, <BusinessImpactAnalysisDetailPage />)}
            />
            <Route path="/reports" element={allowedOnly(access.canUseReports, <ReportsPage />)} />
            <Route path="/reports/dora-roi" element={allowedOnly(access.canUseReports, <DoraReportPage />)} />
            <Route path="/builders/export-builder" element={adminOnly(<ExportBuilderPage />)} />
            <Route path="/builders/export-builder/docx-template" element={adminOnly(<ExportBuilderDocxGuidePage />)} />
            <Route path="/builders/form-builder" element={adminOnly(<FormBuilderPage />)} />
            <Route path="/builders/report-builder" element={adminOnly(<ReportBuilderPage />)} />
            <Route path="/builders/dashboard-builder" element={adminOnly(<DashboardBuilderPage />)} />
            <Route path="/builders/rules-builder" element={adminOnly(<RulesBuilderPage />)} />
            <Route path="/builders/wayfinder-builder" element={adminOnly(<WayfinderBuilderPage />)} />
            <Route path="/builders/questionnaire-builder/overview" element={adminOnly(<QuestionnaireOverviewPage />)} />
            <Route path="/builders/questionnaire-builder" element={adminOnly(<QuestionnaireBuilderPage />)} />
            <Route
              path="/builders/questionnaire-builder/rules-engine"
              element={adminOnly(<QuestionnaireRulesEnginePage />)}
            />
            <Route path="/features/regml" element={adminOnly(<RegMLPage />)} />
            <Route path="/features/regml/control-ai-features" element={adminOnly(<RegMLPage />)} />
            <Route path="/features/regml/author" element={adminOnly(<RegMLAuthorPage />)} />
            <Route path="/features/regml/explainer" element={adminOnly(<RegMLExplainerPage />)} />
            <Route path="/features/regml/ssp-ai-features" element={adminOnly(<RegMLPage />)} />
            <Route path="/features/regml/ssp-author" element={adminOnly(<RegMLSSPAuthorPage />)} />
            <Route path="/features/regml/auditor" element={adminOnly(<RegMLAuditorPage />)} />
            <Route path="/features/regml/ai-generator" element={adminOnly(<RegMLAIGeneratorPage />)} />
            <Route path="/ai-policy-builder" element={adminOnly(<AIPolicyBuilderPage />)} />
            <Route path="/features/ai-policy-builder" element={adminOnly(<AIPolicyBuilderPage />)} />
            <Route path="/response-automation" element={adminOnly(<ResponseAutomationPage />)} />
            <Route path="/features/response-automation" element={adminOnly(<ResponseAutomationPage />)} />
            <Route path="/evidence-mapping" element={adminOnly(<EvidenceMappingPage />)} />
            <Route path="/features/evidence-mapping" element={adminOnly(<EvidenceMappingPage />)} />
            <Route path="/compliance-exports" element={adminOnly(<ComplianceExportsPage />)} />
            <Route path="/features/compliance-exports" element={adminOnly(<ComplianceExportsPage />)} />
            <Route path="/features/compliance-exports/emass" element={adminOnly(<ComplianceExportsPage initialFilter="emass" />)} />
            <Route path="/features/compliance-exports/fedramp" element={adminOnly(<ComplianceExportsPage initialFilter="fedramp" />)} />
            <Route path="/chat" element={allowedOnly(access.canUseChat, <ChatWorkspacePage />)} />
            <Route path="/imports" element={adminOnly(<ImportsPage />)} />
            <Route path="/automation-manager" element={adminOnly(<AutomationManagerPage />)} />
            <Route path="/features/automation-manager" element={adminOnly(<AutomationManagerPage />)} />
            <Route path="/workflow" element={internalOnly(<WorkflowControlPage />)} />
            <Route path="/features/workflow" element={internalOnly(<WorkflowControlPage />)} />
            <Route path="/utilities" element={internalOnly(<UtilitiesControlPage />)} />
            <Route path="/features/utilities" element={internalOnly(<UtilitiesControlPage />)} />
            <Route path="/subsystems" element={internalOnly(<SubsystemsControlPage />)} />
            <Route path="/features/subsystems" element={internalOnly(<SubsystemsControlPage />)} />
            <Route path="/rmf" element={internalOnly(<RMFControlPage />)} />
            <Route path="/features/rmf" element={internalOnly(<RMFControlPage />)} />
            <Route path="/app-management" element={internalOnly(<AppManagementControlPage />)} />
            <Route path="/features/app-management" element={internalOnly(<AppManagementControlPage />)} />
            <Route path="/workbench" element={internalOnly(<WorkbenchControlPage />)} />
            <Route path="/features/workbench" element={internalOnly(<WorkbenchControlPage />)} />
            <Route path="/news-feed" element={internalOnly(<NewsFeedControlPage />)} />
            <Route path="/features/news-feed" element={internalOnly(<NewsFeedControlPage />)} />
            <Route path="/portal" element={allowedOnly(access.canUsePortal, <PortalDashboardPage />)} />
            <Route path="/portal/assignments/:assignmentId" element={allowedOnly(access.canUsePortal, <PortalAssignmentDetailPage />)} />
            <Route path="/advanced-risk/ebios" element={allowedOnly(access.canUseAdvancedRisk, <EbiosWorkspacePage />)} />
            <Route path="/advanced-risk/ebios/:studyId" element={allowedOnly(access.canUseAdvancedRisk, <EbiosStudyDetailPage />)} />
            <Route path="/advanced-risk/quantitative" element={allowedOnly(access.canUseAdvancedRisk, <QuantitativeWorkspacePage />)} />
            <Route
              path="/advanced-risk/quantitative/:studyId"
              element={allowedOnly(access.canUseAdvancedRisk, <QuantitativeStudyDetailPage />)}
            />
            <Route
              path="/advanced-risk/quantitative/:studyId/executive-summary"
              element={allowedOnly(access.canUseAdvancedRisk, <QuantitativeExecutiveSummaryPage />)}
            />
            <Route
              path="/advanced-risk/quantitative/:studyId/key-metrics"
              element={allowedOnly(access.canUseAdvancedRisk, <QuantitativeKeyMetricsPage />)}
            />
            <Route
              path="/advanced-risk/quantitative/:studyId/action-plan"
              element={allowedOnly(access.canUseAdvancedRisk, <QuantitativeActionPlanPage />)}
            />
            <Route
              path="/quantitative-risk-studies/:studyId/action-plan/budget-overview"
              element={allowedOnly(access.canUseAdvancedRisk, <QuantitativeActionPlanPage />)}
            />
            <Route
              path="/quantitative-risk-scenarios/:scenarioId"
              element={allowedOnly(access.canUseAdvancedRisk, <QuantitativeScenarioDetailPage />)}
            />
            <Route
              path="/quantitative-risk-hypotheses/:hypothesisId"
              element={allowedOnly(access.canUseAdvancedRisk, <QuantitativeHypothesisDetailPage />)}
            />
            <Route
              path="/risk-assessments/:assessmentId/convert-to-quantitative"
              element={allowedOnly(access.canUseAdvancedRisk, <RiskAssessmentConversionPage />)}
            />
            <Route path="/folders" element={adminOnly(<FoldersPage />)} />
            <Route path="/users" element={adminOnly(<TeamPage />)} />
            <Route path="/my-profile" element={<MePage />} />
            <Route path="/my-assignments" element={allowedOnly(access.canUsePortal, <PortalDashboardPage />)} />
            <Route path="/entities" element={allowedOnly(access.canUseThirdParty, <TprmWorkspacePage />)} />
            <Route path="/contracts" element={allowedOnly(access.canUseThirdParty, <TprmWorkspacePage />)} />
            <Route path="/processings" element={allowedOnly(access.canUsePrivacy, <PrivacyWorkspacePage />)} />
            <Route path="/business-impact-analysis" element={allowedOnly(access.canUseResilience, <ResiliencePage />)} />
            <Route path="/compliance-assessments" element={allowedOnly(access.canUseAssessmentWorkspace, <AssessmentsPage />)} />
            <Route path="/risk-assessments" element={allowedOnly(access.canUseAssessmentWorkspace, <AssessmentsPage />)} />
            <Route path="/loaded-libraries" element={allowedOnly(access.canUseLibraries, <LibrariesPage />)} />
            <Route path="/loaded-libraries/:libraryId" element={allowedOnly(access.canUseLibraries, <LibraryDetailPage />)} />
            <Route path="/mapping-libraries" element={allowedOnly(access.canUseLibraries, <LibrariesPage />)} />
            <Route path="/stored-libraries" element={allowedOnly(access.canUseLibraries, <LibrariesPage />)} />
            <Route path="/stored-libraries/:libraryId" element={allowedOnly(access.canUseLibraries, <LibraryDetailPage />)} />
            <Route path="/auditee-dashboard" element={allowedOnly(access.canUsePortal, <PortalDashboardPage />)} />
            <Route path="/auditee-assessments/:assignmentId" element={allowedOnly(access.canUsePortal, <PortalAssignmentDetailPage />)} />
            <Route path="/ebios-rm" element={allowedOnly(access.canUseAdvancedRisk, <EbiosWorkspacePage />)} />
            <Route path="/ebios-rm/:studyId" element={allowedOnly(access.canUseAdvancedRisk, <EbiosStudyDetailPage />)} />
            <Route path="/ebios-rm/:studyId/visual" element={allowedOnly(access.canUseAdvancedRisk, <EbiosStudyDetailPage />)} />
            <Route path="/ebios-rm/:studyId/report" element={allowedOnly(access.canUseAdvancedRisk, <EbiosStudyDetailPage />)} />
            <Route path="/ebios-rm/:studyId/workshop-1/feared-events" element={allowedOnly(access.canUseAdvancedRisk, <EbiosStudyDetailPage />)} />
            <Route path="/ebios-rm/:studyId/workshop-1/baseline" element={allowedOnly(access.canUseAdvancedRisk, <EbiosStudyDetailPage />)} />
            <Route path="/ebios-rm/:studyId/workshop-1/ebios-rm-study" element={allowedOnly(access.canUseAdvancedRisk, <EbiosStudyDetailPage />)} />
            <Route path="/ebios-rm/:studyId/workshop-1/ebios-rm-study/edit" element={allowedOnly(access.canUseAdvancedRisk, <EbiosStudyDetailPage />)} />
            <Route path="/ebios-rm/:studyId/workshop-2/ro-to" element={allowedOnly(access.canUseAdvancedRisk, <EbiosStudyDetailPage />)} />
            <Route path="/ebios-rm/:studyId/workshop-3/ecosystem" element={allowedOnly(access.canUseAdvancedRisk, <EbiosStudyDetailPage />)} />
            <Route path="/ebios-rm/:studyId/workshop-3/strategic-scenarios" element={allowedOnly(access.canUseAdvancedRisk, <EbiosStudyDetailPage />)} />
            <Route path="/ebios-rm/:studyId/workshop-4/operational-scenario" element={allowedOnly(access.canUseAdvancedRisk, <EbiosStudyDetailPage />)} />
            <Route path="/ebios-rm/:studyId/workshop-4/elementary-actions" element={allowedOnly(access.canUseAdvancedRisk, <EbiosStudyDetailPage />)} />
            <Route path="/ebios-rm/:studyId/workshop-5/risk-analyses" element={allowedOnly(access.canUseAdvancedRisk, <EbiosStudyDetailPage />)} />
            <Route path="/quantitative-risk-studies" element={allowedOnly(access.canUseAdvancedRisk, <QuantitativeWorkspacePage />)} />
            <Route path="/quantitative-risk-studies/:studyId" element={allowedOnly(access.canUseAdvancedRisk, <QuantitativeStudyDetailPage />)} />
            <Route
              path="/quantitative-risk-studies/:studyId/executive-summary"
              element={allowedOnly(access.canUseAdvancedRisk, <QuantitativeExecutiveSummaryPage />)}
            />
            <Route
              path="/quantitative-risk-studies/:studyId/key-metrics"
              element={allowedOnly(access.canUseAdvancedRisk, <QuantitativeKeyMetricsPage />)}
            />
            <Route
              path="/quantitative-risk-studies/:studyId/action-plan"
              element={allowedOnly(access.canUseAdvancedRisk, <QuantitativeActionPlanPage />)}
            />
            <Route
              path="/assets"
              element={internalOnly(<AssetsControlPage />)}
            />
            <Route
              path="/asset-assessments"
              element={internalOnly(<AssetAssessmentsControlPage />)}
            />
            <Route
              path="/actors"
              element={internalOnly(<ActorsControlPage />)}
            />
            <Route
              path="/vulnerabilities"
              element={internalOnly(<VulnerabilitiesControlPage />)}
            />
            <Route
              path="/policies"
              element={adminOnly(<PoliciesControlPage />)}
            />
            <Route
              path="/incidents"
              element={internalOnly(<IncidentsControlPage />)}
            />
            <Route
              path="/security-exceptions"
              element={internalOnly(<SecurityExceptionsControlPage />)}
            />
            <Route path="/analytics" element={allowedOnly(access.canUseAnalytics, <AnalyticsControlRoomPage access={access} />)} />
            <Route path="/search" element={allowedOnly(access.canUseSearch, <SearchControlRoomPage access={access} />)} />
            <Route
              path="/backup-restore"
              element={internalOnly(<BackupRestoreControlPage />)}
            />
            <Route
              path="/calendar"
              element={internalOnly(<CalendarControlPage />)}
            />
            <Route
              path="/quick-start"
              element={adminOnly(<QuickStartControlPage />)}
            />
            <Route
              path="/settings"
              element={adminOnly(<SettingsControlRoomPage />)}
            />
            <Route
              path="/dashboards"
              element={internalOnly(<DashboardsControlPage />)}
            />
            <Route
              path="/recap"
              element={internalOnly(<DashboardsControlPage />)}
            />
            <Route
              path="/validation-flows"
              element={internalOnly(<ValidationFlowsControlPage />)}
            />
            <Route
              path="/x-rays"
              element={internalOnly(<XRaysControlPage />)}
            />
            <Route
              path="/task-nodes"
              element={internalOnly(<TaskOperationsControlPage />)}
            />
            <Route
              path="/task-templates"
              element={internalOnly(<TaskOperationsControlPage />)}
            />
            <Route
              path="/risk-matrices"
              element={internalOnly(<DashboardsControlPage />)}
            />
            <Route
              path="/requirement-assessments"
              element={internalOnly(<ValidationFlowsControlPage />)}
            />
            <Route
              path="/requirement-mapping-sets"
              element={internalOnly(<LibraryMappingsControlPage />)}
            />
            <Route
              path="/sync-mappings"
              element={internalOnly(<LibraryMappingsControlPage />)}
            />
            <Route
              path="/content-types"
              element={internalOnly(<ProgramControlPage access={access} />)}
            />
            <Route
              path="/generic-collections"
              element={internalOnly(<ProgramControlPage access={access} />)}
            />
            <Route
              path="/presets"
              element={internalOnly(<ProgramControlPage access={access} />)}
            />
            <Route
              path="/preset-journeys"
              element={internalOnly(<ProgramControlPage access={access} />)}
            />
            <Route
              path="/experimental"
              element={internalOnly(<ProgramControlPage access={access} />)}
            />
            <Route
              path="/license-management"
              element={internalOnly(<ProgramControlPage access={access} />)}
            />
            <Route
              path="/metric-instances"
              element={internalOnly(<AnalyticsControlRoomPage access={access} />)}
            />
            <Route
              path="/accreditations"
              element={internalOnly(<ProgramControlPage access={access} />)}
            />
            <Route
              path="/findings-assessments"
              element={internalOnly(<ValidationFlowsControlPage />)}
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
              element={internalOnly(<ChatWorkspacePage />)}
            />
            <Route path="/risk-scenarios" element={allowedOnly(access.canUseRiskAssessments, <RiskScenariosPage />)} />
            <Route path="/conmon/profiles" element={adminOnly(<ConMonProfilesPage />)} />
            <Route path="/conmon/executions" element={allowedOnly(access.canUseConMon, <ConMonExecutionsPage />)} />
            <Route path="/evidence-management" element={allowedOnly(access.canUseEvidence, <EvidenceManagementPage />)} />
            <Route path="/features/evidence-management" element={allowedOnly(access.canUseEvidence, <EvidenceManagementPage />)} />
            <Route path="/evidence/sources" element={adminOnly(<EvidenceSourcesPage />)} />
            <Route path="/evidence/jobs" element={allowedOnly(access.canUseEvidence, <EvidenceJobsPage />)} />
            <Route path="/assurance" element={allowedOnly(access.canUseAssurance, <AssuranceOverviewPage showOperationalReadiness={access.isWorkspaceAdmin} />)} />
            <Route path="/assurance/evidence" element={allowedOnly(access.canUseAssurance, <AssuranceEvidenceExplorerPage />)} />
            <Route path="/assurance/tracker" element={allowedOnly(access.canUseAssurance, <TrackerWorkbenchPage />)} />
            <Route path="/assurance/packages" element={allowedOnly(access.canUseAssurance, <PackageExplorerPage />)} />
            <Route path="/assurance/reviews" element={allowedOnly(access.canUseAssurance, <ReviewQueuePage />)} />
            <Route path="/assurance/agent-runs" element={allowedOnly(access.canUseAssurance, <AgentRunInspectorPage />)} />
            {legacyBridgeModels.map((model) => (
              <Route
                key={model}
                path={`/${model}/*`}
                element={<LegacyRouteBridgePage legacyModel={model} access={access} />}
              />
            ))}
                <Route
                  path="*"
                  element={
                    <div className="panel flex min-h-[240px] items-center justify-center text-slate-300">
                      Choose a Regovise workspace area from the left navigation.
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
