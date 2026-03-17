import type { DomainEventEnvelope } from "./shared/types";

interface Env {
  APP_D1_MAIN: D1Database;
  DEAD_LETTER_Q: Queue<Record<string, unknown>>;
}

export default {
  async queue(batch: MessageBatch<DomainEventEnvelope>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const event = message.body;

      try {
        validateEvent(event);
        await applyProjection(event, env);
        await updateCheckpoint("default-projector", event, env);
        message.ack();
      } catch (error) {
        await env.DEAD_LETTER_Q.send({
          queue: "projections-q",
          failed_at: new Date().toISOString(),
          error: (error as Error).message,
          event
        });
        message.ack();
      }
    }
  },

  async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === "/healthz") {
      return new Response(JSON.stringify({ status: "ok", service: "projection-worker" }), {
        headers: { "content-type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404 });
  }
};

function validateEvent(event: DomainEventEnvelope): void {
  if (!event.event_id || !event.event_type || !event.tenant_id) {
    throw new Error("Invalid domain event envelope");
  }
}

async function applyProjection(event: DomainEventEnvelope, env: Env): Promise<void> {
  switch (event.event_type) {
    case "ConnectorSyncRequested":
    case "ConnectorSyncCompleted":
    case "ConnectorSyncFailed":
      await projectConnectorHealth(event, env);
      return;

    case "ConMonDashboardUpdated":
      await projectConMonDashboard(event, env);
      return;

    case "ConMonOperationalRollupUpdated":
      await projectConMonOperationalRollup(event, env);
      return;

    case "PoamStatusUpdated":
      await projectPoamStatus(event, env);
      return;

    case "SecurityGraphNodeUpserted":
      await projectSecurityGraphNode(event, env);
      return;

    case "SecurityGraphEdgeUpserted":
      await projectSecurityGraphEdge(event, env);
      return;

    case "RiskRegisterOverviewRecomputed":
      await projectRiskRegisterOverview(event, env);
      return;

    case "CompliancePostureUpdated":
      await projectCompliancePosture(event, env);
      return;

    case "VendorQuestionnaireStatusUpdated":
      await projectVendorQuestionnaireStatus(event, env);
      return;

    case "LightningAssessmentUpserted":
      await projectLightningAssessmentSummary(event, env);
      return;

    case "VersionHistorySnapshotCreated":
      await projectVersionHistoryLatest(event, env);
      return;

    case "EvidenceCollectionRequested":
    case "EvidenceCollectionCompleted":
    case "EvidenceCollectionFailed":
      await projectEvidenceAutomationStatus(event, env);
      return;

    case "WorkflowExecutionRequested":
    case "WorkflowExecutionUpdated":
    case "WorkflowExecutionFailed":
      await projectWorkflowExecutionStatus(event, env);
      return;

    case "OscalImportRequested":
    case "OscalExportRequested":
    case "OscalExportCompleted":
      await projectOscalJobStatus(event, env);
      return;

    case "AIAssistantJobRequested":
    case "AIAssistantJobCompleted":
    case "AIAssistantJobFailed":
      await projectAIAssistantStatus(event, env);
      return;

    case "VendorScoringRequested":
    case "VendorScoringCompleted":
      await projectVendorScoringSummary(event, env);
      return;

    case "LibraryIndexRefreshed":
      await projectFrameworkLibraryIndex(event, env);
      return;

    case "FedrampAutomationRequested":
    case "FedrampAutomationCompleted":
      await projectFedrampAutomationStatus(event, env);
      await projectCompliancePosture(event, env);
      return;

    case "CrqComputationRequested":
    case "CrqComputationCompleted":
      await projectCrqSummary(event, env);
      await projectRiskRegisterOverview(event, env);
      return;

    case "MappingComputationRequested":
    case "MappingComputationCompleted":
      await projectMappingSummary(event, env);
      return;

    case "ScannerSyncRequested":
    case "SarifImportRequested":
    case "ScapImportRequested":
    case "ScannerIngestCompleted":
      await projectScannerFindingSummary(event, env);
      return;

    case "ServiceNowSyncRequested":
    case "JiraSyncRequested":
    case "IntegrationSyncCompleted":
    case "IntegrationSyncFailed":
      await projectIntegrationSyncStatus(event, env);
      return;

    case "OcsfOscalTranslationRequested":
    case "OcsfOscalTranslationCompleted":
      await projectTranslationStatus(event, env);
      return;

    case "LegacyDomainStateUpserted":
    case "CommandExecuted":
      await projectLegacyDomainOverview(event, env);
      return;

    case "ExportJobCompleted":
      await projectExportModuleFallback(event, env);
      return;

    // ── Core GRC events ───────────────────────────────────────────────────
    case "GrcFolderUpserted":
    case "GrcFrameworkUpserted":
    case "GrcRequirementNodeUpserted":
    case "GrcReferenceControlUpserted":
    case "GrcAppliedControlUpserted":
    case "GrcPolicyUpserted":
    case "GrcRiskMatrixUpserted":
    case "GrcThreatUpserted":
    case "GrcVulnerabilityUpserted":
    case "GrcRiskAssessmentUpserted":
    case "GrcRiskScenarioUpserted":
    case "GrcRiskAcceptanceUpserted":
    case "GrcRiskAcceptanceApproved":
    case "GrcRiskAcceptanceRejected":
    case "GrcEvidenceUpserted":
    case "GrcEvidenceUploaded":
    case "GrcComplianceAssessmentUpserted":
    case "GrcRequirementAssessmentUpserted":
    case "GrcRequirementAssessmentUpdated":
    case "GrcFindingUpserted":
    case "GrcFindingClosed":
    case "GrcFilteringLabelUpserted":
    case "GrcCampaignUpserted":
    case "GrcRequirementMappingSetUpserted":
    case "GrcAssetUpserted":
      await projectDomainOverviewFromEvent("grc", event, env);
      return;

    // ── TPRM events ───────────────────────────────────────────────────────
    case "TprmEntityUpserted":
    case "TprmEntityAssessmentUpserted":
    case "TprmSolutionUpserted":
    case "TprmRepresentativeUpserted":
    case "TprmContractUpserted":
      await projectDomainOverviewFromEvent("tprm", event, env);
      return;

    // ── EBIOS RM events ───────────────────────────────────────────────────
    case "EbiosStudyUpserted":
    case "EbiosFearedEventUpserted":
    case "EbiosRoToUpserted":
    case "EbiosStakeholderUpserted":
    case "EbiosAttackPathUpserted":
    case "EbiosOperationalScenarioUpserted":
    case "EbiosStrategicScenarioUpserted":
      await projectDomainOverviewFromEvent("ebios", event, env);
      return;

    // ── Privacy / GDPR events ─────────────────────────────────────────────
    case "PrivacyPurposeUpserted":
    case "PrivacyPersonalDataUpserted":
    case "PrivacyDataSubjectUpserted":
    case "PrivacyDataRecipientUpserted":
    case "PrivacyDataTransferUpserted":
    case "PrivacyProcessingUpserted":
    case "PrivacyRightRequestUpserted":
    case "PrivacyRightRequestCompleted":
    case "PrivacyDataBreachUpserted":
    case "PrivacyDataBreachReported":
    case "PrivacyDataAssetUpserted":
    case "PrivacyDataFlowUpserted":
    case "PrivacyConsentRecordUpserted":
      await projectDomainOverviewFromEvent("privacy", event, env);
      return;

    // ── Business Continuity events ────────────────────────────────────────
    case "BcPlanUpserted":
    case "BcAuditUpserted":
    case "BcTaskUpserted":
    case "BcTaskCompleted":
      await projectDomainOverviewFromEvent("bc", event, env);
      return;

    // ── CRQ events ────────────────────────────────────────────────────────
    case "CrqStudyUpserted":
    case "CrqScenarioUpserted":
    case "CrqHypothesisUpserted":
      await projectDomainOverviewFromEvent("crq", event, env);
      return;

    // ── RMF Operations events ─────────────────────────────────────────────
    case "RmfSystemGroupUpserted":
    case "RmfChangeRequestUpserted":
    case "RmfChangeRequestApproved":
    case "RmfChecklistUpserted":
    case "RmfChecklistScoreUpserted":
    case "RmfTemplateUpserted":
    case "RmfArtifactUpserted":
    case "RmfVulnerabilityFindingUpserted":
    case "RmfNessusScanImported":
      await projectDomainOverviewFromEvent("rmf", event, env);
      return;

    // ── Security Operations events ────────────────────────────────────────
    case "SecopsIncidentUpserted":
    case "SecopsIncidentResolved":
    case "SecopsAwarenessProgramUpserted":
    case "SecopsAwarenessCampaignUpserted":
    case "SecopsAwarenessCompletionRecorded":
      await projectDomainOverviewFromEvent("secops", event, env);
      return;

    // ── Metrology events ──────────────────────────────────────────────────
    case "MetrologyDefinitionUpserted":
    case "MetrologyInstanceRecorded":
    case "MetrologyDashboardUpserted":
    case "MetrologyWidgetUpserted":
      await projectDomainOverviewFromEvent("metrology", event, env);
      return;

    // ── Workflow events ───────────────────────────────────────────────────
    case "WorkflowTemplateUpserted":
    case "WorkflowExecutionStarted":
    case "WorkflowExecutionAdvanced":
    case "WorkflowExecutionCompleted":
    case "WorkflowScheduleUpserted":
    case "WorkflowAssessmentTaskUpserted":
    case "WorkflowAssessmentTaskCompleted":
      await projectDomainOverviewFromEvent("workflow", event, env);
      return;

    // ── Compliance events ─────────────────────────────────────────────────
    case "ComplianceOnlineAssessmentUpserted":
    case "ComplianceAssessmentRunStarted":
    case "ComplianceAssessmentRunCompleted":
    case "ComplianceAuditUpserted":
    case "ComplianceFindingUpserted":
    case "ComplianceExceptionUpserted":
    case "ComplianceExceptionApproved":
      await projectDomainOverviewFromEvent("compliance", event, env);
      return;

    // ── Asset Service events ──────────────────────────────────────────────
    case "AssetItemUpserted":
    case "AssetProcessUpserted":
    case "AssetServiceUpserted":
    case "AssetServiceContractUpserted":
      await projectDomainOverviewFromEvent("asset", event, env);
      return;

    // ── Resilience events ─────────────────────────────────────────────────
    case "ResilienceBiaUpserted":
    case "ResilienceAssetAssessmentUpserted":
    case "ResilienceEscalationThresholdUpserted":
      await projectDomainOverviewFromEvent("resilience", event, env);
      return;

    // ── Control Library events ────────────────────────────────────────────
    case "ControlLibraryControlUpserted":
    case "ControlLibraryImplementationUpserted":
    case "ControlLibraryPolicyUpserted":
    case "ControlLibraryPolicyAckRecorded":
    case "ControlLibraryEvidenceItemUpserted":
      await projectDomainOverviewFromEvent("control-library", event, env);
      return;

    // ── Governance events ─────────────────────────────────────────────────
    case "GovernanceControlOriginationUpserted":
    case "GovernanceResponsibilityMatrixUpserted":
    case "GovernanceResponsibilityAssignmentUpserted":
    case "GovernanceAssessmentPlanUpserted":
    case "GovernanceAssessmentPlanApproved":
    case "GovernanceAttestationUpserted":
    case "GovernanceAttestationApproved":
    case "GovernanceAttestationRevoked":
    case "GovernanceAuthorizationTimelineUpserted":
    case "GovernanceAuthorizationTimelineAdvanced":
      await projectDomainOverviewFromEvent("governance", event, env);
      return;

    // ── IAM events ────────────────────────────────────────────────────────
    case "IamUserUpserted":
    case "IamUserGroupUpserted":
    case "IamRoleAssignmentUpserted":
      await projectDomainOverviewFromEvent("iam", event, env);
      return;

    // ── Settings events ───────────────────────────────────────────────────
    case "SettingsGlobalUpserted":
    case "SettingsFeatureFlagUpserted":
      await projectDomainOverviewFromEvent("settings", event, env);
      return;

    // ── Organization / Vendor Portal / SerDes events ──────────────────────
    case "OrgUnitUpserted":
    case "VpQuestionnaireResponseSubmitted":
    case "VpEvidenceSubmissionUploaded":
    case "SerdesDumpDbRequested":
    case "SerdesLoadBackupRequested":
      await projectDomainOverviewFromEvent("organization", event, env);
      return;

    default:
      return;
  }
}

async function projectConnectorHealth(event: DomainEventEnvelope, env: Env): Promise<void> {
  const connectorInstanceId = readString(event.payload, "connector_instance_id") || event.aggregate_id;
  const status =
    event.event_type === "ConnectorSyncCompleted"
      ? "connected"
      : event.event_type === "ConnectorSyncFailed"
        ? "error"
        : readString(event.payload, "status") || "syncing";

  const errorMessage = readOptionalString(event.payload, "error");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_connector_health (tenant_id, connector_instance_id, status, last_sync_at, last_error, metrics_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, connector_instance_id)
     DO UPDATE SET
       status = excluded.status,
       last_sync_at = excluded.last_sync_at,
       last_error = excluded.last_error,
       metrics_json = excluded.metrics_json,
       updated_at = excluded.updated_at`
  )
    .bind(
      event.tenant_id,
      connectorInstanceId,
      status,
      event.occurred_at,
      errorMessage,
      JSON.stringify(event.payload ?? {}),
      event.occurred_at
    )
    .run();
}

async function projectConMonDashboard(event: DomainEventEnvelope, env: Env): Promise<void> {
  const dashboardKey = readString(event.payload, "dashboard_key") || "primary";
  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_conmon_dashboard (tenant_id, dashboard_key, counters_json, status, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, dashboard_key)
     DO UPDATE SET
       counters_json = excluded.counters_json,
       status = excluded.status,
       updated_at = excluded.updated_at`
  )
    .bind(
      event.tenant_id,
      dashboardKey,
      JSON.stringify(event.payload ?? {}),
      readString(event.payload, "status") || "active",
      event.occurred_at
    )
    .run();
}

async function projectConMonOperationalRollup(event: DomainEventEnvelope, env: Env): Promise<void> {
  const profileId = readString(event.payload, "profile_id") || event.aggregate_id;
  const rollupPayload =
    typeof event.payload.rollup_json === "object" &&
    event.payload.rollup_json !== null &&
    !Array.isArray(event.payload.rollup_json)
      ? (event.payload.rollup_json as Record<string, unknown>)
      : event.payload;

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_conmon_operational_rollup (tenant_id, profile_id, rollup_json, status, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, profile_id)
     DO UPDATE SET
       rollup_json = excluded.rollup_json,
       status = excluded.status,
       updated_at = excluded.updated_at`
  )
    .bind(
      event.tenant_id,
      profileId,
      JSON.stringify(rollupPayload ?? {}),
      readString(event.payload, "status") || "active",
      event.occurred_at
    )
    .run();
}

async function projectPoamStatus(event: DomainEventEnvelope, env: Env): Promise<void> {
  const poamItemId = readString(event.payload, "poam_item_id") || event.aggregate_id;
  const status = readString(event.payload, "status") || "open";
  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_poam_status (tenant_id, poam_item_id, status, summary_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, poam_item_id)
     DO UPDATE SET
       status = excluded.status,
       summary_json = excluded.summary_json,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, poamItemId, status, JSON.stringify(event.payload ?? {}), event.occurred_at)
    .run();
}

async function projectSecurityGraphNode(event: DomainEventEnvelope, env: Env): Promise<void> {
  const nodeId = readString(event.payload, "node_id") || event.aggregate_id;
  const nodeType = readString(event.payload, "node_type") || "unknown";
  const label = readString(event.payload, "label") || nodeId;

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_security_graph_nodes (tenant_id, node_id, node_type, label, attributes_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, node_id)
     DO UPDATE SET
       node_type = excluded.node_type,
       label = excluded.label,
       attributes_json = excluded.attributes_json,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, nodeId, nodeType, label, JSON.stringify(event.payload ?? {}), event.occurred_at)
    .run();
}

async function projectSecurityGraphEdge(event: DomainEventEnvelope, env: Env): Promise<void> {
  const edgeId = readString(event.payload, "edge_id") || event.aggregate_id;
  const sourceNodeId = readString(event.payload, "source_node_id");
  const targetNodeId = readString(event.payload, "target_node_id");
  const edgeType = readString(event.payload, "edge_type") || "related";

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_security_graph_edges (tenant_id, edge_id, source_node_id, target_node_id, edge_type, attributes_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, edge_id)
     DO UPDATE SET
       source_node_id = excluded.source_node_id,
       target_node_id = excluded.target_node_id,
       edge_type = excluded.edge_type,
       attributes_json = excluded.attributes_json,
       updated_at = excluded.updated_at`
  )
    .bind(
      event.tenant_id,
      edgeId,
      sourceNodeId,
      targetNodeId,
      edgeType,
      JSON.stringify(event.payload ?? {}),
      event.occurred_at
    )
    .run();
}

async function projectRiskRegisterOverview(event: DomainEventEnvelope, env: Env): Promise<void> {
  const riskType = readString(event.payload, "risk_type") || "crq";

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_risk_register_overview (tenant_id, risk_type, overview_json, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(tenant_id, risk_type)
     DO UPDATE SET
       overview_json = excluded.overview_json,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, riskType, JSON.stringify(event.payload ?? {}), event.occurred_at)
    .run();
}

async function projectCompliancePosture(event: DomainEventEnvelope, env: Env): Promise<void> {
  const frameworkId = readString(event.payload, "framework") || readString(event.payload, "framework_id") || "global";

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_compliance_posture (tenant_id, framework_id, posture_json, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(tenant_id, framework_id)
     DO UPDATE SET
       posture_json = excluded.posture_json,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, frameworkId, JSON.stringify(event.payload ?? {}), event.occurred_at)
    .run();
}

async function projectVendorQuestionnaireStatus(event: DomainEventEnvelope, env: Env): Promise<void> {
  const questionnaireId = readString(event.payload, "questionnaire_id") || event.aggregate_id;
  const status = readString(event.payload, "status") || "pending";

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_vendor_questionnaire_status (tenant_id, questionnaire_id, status, summary_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, questionnaire_id)
     DO UPDATE SET
       status = excluded.status,
       summary_json = excluded.summary_json,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, questionnaireId, status, JSON.stringify(event.payload ?? {}), event.occurred_at)
    .run();
}

async function projectLightningAssessmentSummary(event: DomainEventEnvelope, env: Env): Promise<void> {
  const assessmentId = readString(event.payload, "assessment_id") || event.aggregate_id;
  const status = readString(event.payload, "status") || "submitted";
  const frameworkId = readString(event.payload, "framework_id") || "n/a";
  const score = readNumber(event.payload, "score") ?? 0;

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_lightning_assessment_summary (tenant_id, assessment_id, status, framework_id, score, summary_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, assessment_id)
     DO UPDATE SET
       status = excluded.status,
       framework_id = excluded.framework_id,
       score = excluded.score,
       summary_json = excluded.summary_json,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, assessmentId, status, frameworkId, score, JSON.stringify(event.payload ?? {}), event.occurred_at)
    .run();
}

async function projectVersionHistoryLatest(event: DomainEventEnvelope, env: Env): Promise<void> {
  const resourceId = readString(event.payload, "resource_id") || "global";
  const snapshotId = readString(event.payload, "snapshot_id") || event.aggregate_id;
  const snapshotRef = readString(event.payload, "snapshot_ref") || "";
  const versionLabel = readString(event.payload, "version_label") || event.occurred_at;

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_version_history_latest (tenant_id, resource_id, snapshot_id, snapshot_ref, version_label, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, resource_id)
     DO UPDATE SET
       snapshot_id = excluded.snapshot_id,
       snapshot_ref = excluded.snapshot_ref,
       version_label = excluded.version_label,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, resourceId, snapshotId, snapshotRef, versionLabel, event.occurred_at)
    .run();
}

async function projectEvidenceAutomationStatus(event: DomainEventEnvelope, env: Env): Promise<void> {
  const runId = readString(event.payload, "run_id") || event.aggregate_id;
  const status =
    event.event_type === "EvidenceCollectionCompleted"
      ? "completed"
      : event.event_type === "EvidenceCollectionFailed"
        ? "failed"
        : readString(event.payload, "status") || "queued";
  const artifactRef = readString(event.payload, "artifact_ref") || "";

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_evidence_automation_status (tenant_id, run_id, status, last_collected_at, artifact_ref, summary_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, run_id)
     DO UPDATE SET
       status = excluded.status,
       last_collected_at = excluded.last_collected_at,
       artifact_ref = excluded.artifact_ref,
       summary_json = excluded.summary_json,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, runId, status, event.occurred_at, artifactRef, JSON.stringify(event.payload ?? {}), event.occurred_at)
    .run();
}

async function projectWorkflowExecutionStatus(event: DomainEventEnvelope, env: Env): Promise<void> {
  const executionId = readString(event.payload, "execution_id") || event.aggregate_id;
  const workflowId = readString(event.payload, "workflow_id") || "default";
  const status =
    event.event_type === "WorkflowExecutionFailed"
      ? "failed"
      : readString(event.payload, "status") || "queued";
  const currentStep = readString(event.payload, "current_step") || "queued";
  const lastError = readOptionalString(event.payload, "error");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_workflow_execution_status (tenant_id, execution_id, workflow_id, status, current_step, last_error, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, execution_id)
     DO UPDATE SET
       workflow_id = excluded.workflow_id,
       status = excluded.status,
       current_step = excluded.current_step,
       last_error = excluded.last_error,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, executionId, workflowId, status, currentStep, lastError, event.occurred_at)
    .run();
}

async function projectOscalJobStatus(event: DomainEventEnvelope, env: Env): Promise<void> {
  const oscalJobId = readString(event.payload, "oscal_job_id") || event.aggregate_id;
  const jobType = readString(event.payload, "job_type") || inferOscalJobType(event.event_type);
  const status =
    event.event_type === "OscalExportCompleted"
      ? "completed"
      : readString(event.payload, "status") || "queued";
  const sourceRef = readOptionalString(event.payload, "source_ref");
  const outputRef = readOptionalString(event.payload, "result_ref") || readOptionalString(event.payload, "output_ref");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_oscal_job_status (tenant_id, oscal_job_id, job_type, status, source_ref, output_ref, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, oscal_job_id)
     DO UPDATE SET
       job_type = excluded.job_type,
       status = excluded.status,
       source_ref = excluded.source_ref,
       output_ref = excluded.output_ref,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, oscalJobId, jobType, status, sourceRef, outputRef, event.occurred_at)
    .run();
}

async function projectAIAssistantStatus(event: DomainEventEnvelope, env: Env): Promise<void> {
  const aiJobId = readString(event.payload, "ai_job_id") || event.aggregate_id;
  const status =
    event.event_type === "AIAssistantJobCompleted"
      ? "completed"
      : event.event_type === "AIAssistantJobFailed"
        ? "failed"
        : readString(event.payload, "status") || "queued";
  const modelName = readString(event.payload, "model_name") || "default";
  const resultRef = readOptionalString(event.payload, "result_ref");
  const error = readOptionalString(event.payload, "error");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_ai_assistant_status (tenant_id, ai_job_id, status, model_name, result_ref, error, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, ai_job_id)
     DO UPDATE SET
       status = excluded.status,
       model_name = excluded.model_name,
       result_ref = excluded.result_ref,
       error = excluded.error,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, aiJobId, status, modelName, resultRef, error, event.occurred_at)
    .run();
}

async function projectVendorScoringSummary(event: DomainEventEnvelope, env: Env): Promise<void> {
  const scoringId = readString(event.payload, "scoring_id") || event.aggregate_id;
  const vendorId = readString(event.payload, "vendor_id") || "unknown";
  const status = readString(event.payload, "status") || "queued";
  const score = readNumber(event.payload, "score");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_vendor_scoring_summary (tenant_id, scoring_id, vendor_id, status, score, summary_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, scoring_id)
     DO UPDATE SET
       vendor_id = excluded.vendor_id,
       status = excluded.status,
       score = excluded.score,
       summary_json = excluded.summary_json,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, scoringId, vendorId, status, score, JSON.stringify(event.payload ?? {}), event.occurred_at)
    .run();
}

async function projectFrameworkLibraryIndex(event: DomainEventEnvelope, env: Env): Promise<void> {
  const libraryId = readString(event.payload, "library_id") || "default";
  const status = readString(event.payload, "status") || "queued";
  const indexRef = readOptionalString(event.payload, "index_ref") || readOptionalString(event.payload, "source_ref");
  const itemCount = readNumber(event.payload, "item_count") ?? 0;

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_framework_library_index (tenant_id, library_id, status, index_ref, item_count, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, library_id)
     DO UPDATE SET
       status = excluded.status,
       index_ref = excluded.index_ref,
       item_count = excluded.item_count,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, libraryId, status, indexRef, itemCount, event.occurred_at)
    .run();
}

async function projectFedrampAutomationStatus(event: DomainEventEnvelope, env: Env): Promise<void> {
  const runId = readString(event.payload, "run_id") || event.aggregate_id;
  const framework = readString(event.payload, "framework") || "fedramp";
  const status =
    event.event_type === "FedrampAutomationCompleted"
      ? "completed"
      : readString(event.payload, "status") || "processing";
  const resultRef = readOptionalString(event.payload, "result_ref");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_fedramp_automation_status (tenant_id, run_id, status, framework, result_ref, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, run_id)
     DO UPDATE SET
       status = excluded.status,
       framework = excluded.framework,
       result_ref = excluded.result_ref,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, runId, status, framework, resultRef, event.occurred_at)
    .run();
}

async function projectCrqSummary(event: DomainEventEnvelope, env: Env): Promise<void> {
  const runId = readString(event.payload, "run_id") || event.aggregate_id;
  const modelName = readString(event.payload, "model_name") || "FAIR";
  const status =
    event.event_type === "CrqComputationCompleted"
      ? "completed"
      : readString(event.payload, "status") || "processing";
  const lossExposure = readNumber(event.payload, "loss_exposure");
  const resultRef = readOptionalString(event.payload, "result_ref");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_crq_summary (tenant_id, run_id, status, model_name, loss_exposure, result_ref, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, run_id)
     DO UPDATE SET
       status = excluded.status,
       model_name = excluded.model_name,
       loss_exposure = excluded.loss_exposure,
       result_ref = excluded.result_ref,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, runId, status, modelName, lossExposure, resultRef, event.occurred_at)
    .run();
}

async function projectMappingSummary(event: DomainEventEnvelope, env: Env): Promise<void> {
  const mappingJobId = readString(event.payload, "mapping_job_id") || event.aggregate_id;
  const status =
    event.event_type === "MappingComputationCompleted"
      ? "completed"
      : readString(event.payload, "status") || "processing";
  const sourceFramework = readString(event.payload, "source_framework") || "unknown";
  const targetFramework = readString(event.payload, "target_framework") || "unknown";
  const resultRef = readOptionalString(event.payload, "result_ref");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_mapping_summary (tenant_id, mapping_job_id, status, source_framework, target_framework, result_ref, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, mapping_job_id)
     DO UPDATE SET
       status = excluded.status,
       source_framework = excluded.source_framework,
       target_framework = excluded.target_framework,
       result_ref = excluded.result_ref,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, mappingJobId, status, sourceFramework, targetFramework, resultRef, event.occurred_at)
    .run();
}

async function projectScannerFindingSummary(event: DomainEventEnvelope, env: Env): Promise<void> {
  const ingestJobId = readString(event.payload, "ingest_job_id") || event.aggregate_id;
  const ingestType = readString(event.payload, "ingest_type") || inferScannerType(event.event_type);
  const status = readString(event.payload, "status") || "queued";
  const findingCount = readNumber(event.payload, "finding_count") ?? 0;
  const highCount = readNumber(event.payload, "high_count") ?? 0;
  const criticalCount = readNumber(event.payload, "critical_count") ?? 0;
  const sourceRef = readOptionalString(event.payload, "source_ref");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_scanner_finding_summary (
       tenant_id, ingest_job_id, ingest_type, status, finding_count, high_count, critical_count, source_ref, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, ingest_job_id)
     DO UPDATE SET
       ingest_type = excluded.ingest_type,
       status = excluded.status,
       finding_count = excluded.finding_count,
       high_count = excluded.high_count,
       critical_count = excluded.critical_count,
       source_ref = excluded.source_ref,
       updated_at = excluded.updated_at`
  )
    .bind(
      event.tenant_id,
      ingestJobId,
      ingestType,
      status,
      findingCount,
      highCount,
      criticalCount,
      sourceRef,
      event.occurred_at
    )
    .run();
}

async function projectIntegrationSyncStatus(event: DomainEventEnvelope, env: Env): Promise<void> {
  const syncJobId = readString(event.payload, "sync_job_id") || event.aggregate_id;
  const integrationType =
    readString(event.payload, "integration_type") ||
    (event.event_type.includes("Jira") ? "jira" : "servicenow");
  const status =
    event.event_type === "IntegrationSyncCompleted"
      ? "completed"
      : event.event_type === "IntegrationSyncFailed"
        ? "failed"
        : readString(event.payload, "status") || "queued";
  const lastSyncedAt = status === "completed" ? event.occurred_at : null;
  const lastError = readOptionalString(event.payload, "error");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_integration_sync_status (
       tenant_id, sync_job_id, integration_type, status, last_synced_at, last_error, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, sync_job_id)
     DO UPDATE SET
       integration_type = excluded.integration_type,
       status = excluded.status,
       last_synced_at = excluded.last_synced_at,
       last_error = excluded.last_error,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, syncJobId, integrationType, status, lastSyncedAt, lastError, event.occurred_at)
    .run();
}

async function projectTranslationStatus(event: DomainEventEnvelope, env: Env): Promise<void> {
  const translationJobId = readString(event.payload, "translation_job_id") || event.aggregate_id;
  const status =
    event.event_type === "OcsfOscalTranslationCompleted"
      ? "completed"
      : readString(event.payload, "status") || "processing";
  const sourceFormat = readString(event.payload, "source_format") || "ocsf";
  const targetFormat = readString(event.payload, "target_format") || "oscal";
  const outputRef = readOptionalString(event.payload, "result_ref") || readOptionalString(event.payload, "output_ref");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_translation_status (
       tenant_id, translation_job_id, status, source_format, target_format, output_ref, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, translation_job_id)
     DO UPDATE SET
       status = excluded.status,
       source_format = excluded.source_format,
       target_format = excluded.target_format,
       output_ref = excluded.output_ref,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, translationJobId, status, sourceFormat, targetFormat, outputRef, event.occurred_at)
    .run();
}

async function projectExportModuleFallback(event: DomainEventEnvelope, env: Env): Promise<void> {
  const module = readString(event.payload, "module");
  if (!module) {
    return;
  }

  if (module === "crq") {
    await projectCrqSummary(event, env);
    await projectRiskRegisterOverview(event, env);
    return;
  }

  if (module === "mapping") {
    await projectMappingSummary(event, env);
    return;
  }

  if (module === "fedramp") {
    await projectFedrampAutomationStatus(event, env);
    await projectCompliancePosture(event, env);
    return;
  }

  if (module === "oscal") {
    await projectOscalJobStatus(event, env);
    return;
  }

  if (module === "translation") {
    await projectTranslationStatus(event, env);
  }
}

async function projectLegacyDomainOverview(event: DomainEventEnvelope, env: Env): Promise<void> {
  const domain = readString(event.payload, "domain") || "core";
  const entityId =
    readString(event.payload, "entity_id") || readString(event.payload, "aggregate_id") || event.aggregate_id;
  const status = readString(event.payload, "status") || "updated";

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_legacy_domain_overview (tenant_id, domain, entity_id, status, summary_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, domain, entity_id)
     DO UPDATE SET
       status = excluded.status,
       summary_json = excluded.summary_json,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, domain, entityId, status, JSON.stringify(event.payload ?? {}), event.occurred_at)
    .run();
}

async function updateCheckpoint(
  projectorName: string,
  event: DomainEventEnvelope,
  env: Env
): Promise<void> {
  await env.APP_D1_MAIN.prepare(
    `INSERT INTO projection_checkpoints (projector_name, last_event_id, last_occurred_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(projector_name)
     DO UPDATE SET
       last_event_id = excluded.last_event_id,
       last_occurred_at = excluded.last_occurred_at,
       updated_at = excluded.updated_at`
  )
    .bind(projectorName, event.event_id, event.occurred_at, new Date().toISOString())
    .run();
}

function inferOscalJobType(eventType: string): string {
  if (eventType.includes("Import")) {
    return "import";
  }
  return "export";
}

function inferScannerType(eventType: string): string {
  if (eventType.includes("Sarif")) {
    return "sarif";
  }
  if (eventType.includes("Scap")) {
    return "scap";
  }
  return "scanner";
}

function readString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function readOptionalString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function readNumber(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function projectDomainOverviewFromEvent(
  domain: string,
  event: DomainEventEnvelope,
  env: Env
): Promise<void> {
  const entityId = readString(event.payload, "entity_id") || event.aggregate_id;
  const status = readString(event.payload, "status") || "updated";

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO rm_legacy_domain_overview (tenant_id, domain, entity_id, status, summary_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, domain, entity_id)
     DO UPDATE SET
       status = excluded.status,
       summary_json = excluded.summary_json,
       updated_at = excluded.updated_at`
  )
    .bind(event.tenant_id, domain, entityId, status, JSON.stringify(event.payload ?? {}), event.occurred_at)
    .run();
}
