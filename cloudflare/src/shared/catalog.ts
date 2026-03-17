import type { ProjectionName, ProjectionTable } from "./types";

export const SUPPORTED_COMMAND_TYPES = [
  "connectors.sync.requested",
  "lightning-assessment.upsert",
  "version-history.snapshot.requested",
  "security-graph.ingest.requested",
  "evidence.collection.requested",
  "workflow.execution.requested",
  "oscal.import.requested",
  "oscal.export.requested",
  "conmon.profile.refresh.requested",
  "poam.item.upsert",
  "ai.assistant.run.requested",
  "ai.vendor-scoring.requested",
  "vendor.questionnaire.upsert",
  "library.index.refresh.requested",
  "fedramp.automation.run.requested",
  "crq.compute.requested",
  "mapping.compute.requested",
  "scanner.sync.requested",
  "sarif.import.requested",
  "scap.import.requested",
  "servicenow.sync.requested",
  "jira.sync.requested",
  "ocsf.oscal.translate.requested",
  "assessment-artifact.package.upsert",
  "assessment-artifact.item.upsert",
  "assessment-artifact.schedule.upsert",
  "assessment-artifact.package.generate-from-template",
  "assessment-artifact.package.import-tsv",
  "assessment-artifact.schedule.pause",
  "assessment-artifact.schedule.resume",

  // Core GRC
  "grc.folder.upsert",
  "grc.framework.upsert",
  "grc.framework.import",
  "grc.requirement-node.upsert",
  "grc.reference-control.upsert",
  "grc.applied-control.upsert",
  "grc.policy.upsert",
  "grc.risk-matrix.upsert",
  "grc.threat.upsert",
  "grc.vulnerability.upsert",
  "grc.risk-assessment.upsert",
  "grc.risk-scenario.upsert",
  "grc.risk-acceptance.upsert",
  "grc.risk-acceptance.approve",
  "grc.risk-acceptance.reject",
  "grc.evidence.upsert",
  "grc.evidence.upload",
  "grc.compliance-assessment.upsert",
  "grc.requirement-assessment.upsert",
  "grc.requirement-assessment.bulk-update",
  "grc.finding.upsert",
  "grc.finding.close",
  "grc.filtering-label.upsert",
  "grc.campaign.upsert",
  "grc.requirement-mapping-set.upsert",
  "grc.asset.upsert",

  // TPRM
  "tprm.entity.upsert",
  "tprm.entity-assessment.upsert",
  "tprm.solution.upsert",
  "tprm.representative.upsert",
  "tprm.contract.upsert",

  // EBIOS RM
  "ebios.study.upsert",
  "ebios.feared-event.upsert",
  "ebios.ro-to.upsert",
  "ebios.stakeholder.upsert",
  "ebios.attack-path.upsert",
  "ebios.operational-scenario.upsert",
  "ebios.strategic-scenario.upsert",

  // GDPR / Privacy
  "privacy.purpose.upsert",
  "privacy.personal-data.upsert",
  "privacy.data-subject.upsert",
  "privacy.data-recipient.upsert",
  "privacy.data-transfer.upsert",
  "privacy.processing.upsert",
  "privacy.right-request.upsert",
  "privacy.right-request.complete",
  "privacy.data-breach.upsert",
  "privacy.data-breach.report",
  "privacy.data-asset.upsert",
  "privacy.data-flow.upsert",
  "privacy.consent-record.upsert",

  // Business Continuity
  "bc.plan.upsert",
  "bc.audit.upsert",
  "bc.task.upsert",
  "bc.task.complete",

  // CRQ
  "crq.study.upsert",
  "crq.scenario.upsert",
  "crq.hypothesis.upsert",

  // RMF
  "rmf.system-group.upsert",
  "rmf.change-request.upsert",
  "rmf.change-request.approve",
  "rmf.checklist.upsert",
  "rmf.checklist-score.upsert",
  "rmf.template.upsert",
  "rmf.artifact.upsert",
  "rmf.vulnerability-finding.upsert",
  "rmf.nessus-scan.import",

  // Security Operations
  "secops.incident.upsert",
  "secops.incident.resolve",
  "secops.awareness-program.upsert",
  "secops.awareness-campaign.upsert",
  "secops.awareness-completion.record",

  // Metrology
  "metrology.definition.upsert",
  "metrology.instance.record",
  "metrology.dashboard.upsert",
  "metrology.widget.upsert",

  // Workflows
  "wf.template.upsert",
  "wf.execution.start",
  "wf.execution.advance",
  "wf.execution.complete",
  "wf.schedule.upsert",
  "wf.assessment-task.upsert",
  "wf.assessment-task.complete",

  // Compliance
  "compliance.online-assessment.upsert",
  "compliance.assessment-run.start",
  "compliance.assessment-run.complete",
  "compliance.audit.upsert",
  "compliance.finding.upsert",
  "compliance.exception.upsert",
  "compliance.exception.approve",

  // Asset Service
  "asset.item.upsert",
  "asset.process.upsert",
  "asset.service.upsert",
  "asset.service-contract.upsert",

  // Resilience
  "resilience.bia.upsert",
  "resilience.asset-assessment.upsert",
  "resilience.escalation-threshold.upsert",

  // Control Library
  "ctllib.control.upsert",
  "ctllib.implementation.upsert",
  "ctllib.policy.upsert",
  "ctllib.policy-ack.record",
  "ctllib.evidence-item.upsert",

  // Governance
  "gov.control-origination.upsert",
  "gov.responsibility-matrix.upsert",
  "gov.responsibility-assignment.upsert",
  "gov.assessment-plan.upsert",
  "gov.assessment-plan.approve",
  "gov.attestation.upsert",
  "gov.attestation.approve",
  "gov.attestation.revoke",
  "gov.authorization-timeline.upsert",
  "gov.authorization-timeline.advance",

  // Organization
  "org.unit.upsert",

  // Settings
  "settings.global.upsert",
  "settings.feature-flag.upsert",

  // IAM
  "iam.user.upsert",
  "iam.user-group.upsert",
  "iam.role-assignment.upsert",

  // Vendor Portal
  "vp.questionnaire-response.submit",
  "vp.evidence-submission.upload",

  // SerDes
  "serdes.dump-db.requested",
  "serdes.load-backup.requested"
] as const;

export type SupportedCommandType = (typeof SUPPORTED_COMMAND_TYPES)[number];

export const FEATURE_COMMAND_MAP: Record<string, readonly SupportedCommandType[]> = {
  connectors: ["connectors.sync.requested"],
  assessments: ["lightning-assessment.upsert"],
  version_history: ["version-history.snapshot.requested"],
  security_graph: ["security-graph.ingest.requested"],
  evidence_automation: ["evidence.collection.requested"],
  workflows: ["workflow.execution.requested"],
  oscal: ["oscal.import.requested", "oscal.export.requested"],
  conmon: ["conmon.profile.refresh.requested"],
  poam: ["poam.item.upsert"],
  ai_assistant: ["ai.assistant.run.requested"],
  ai_vendor_scoring: ["ai.vendor-scoring.requested"],
  vendor_questionnaires: ["vendor.questionnaire.upsert"],
  libraries: ["library.index.refresh.requested"],
  fedramp: ["fedramp.automation.run.requested"],
  crq: ["crq.compute.requested"],
  mapping: ["mapping.compute.requested"],
  scanners: ["scanner.sync.requested", "sarif.import.requested", "scap.import.requested"],
  integrations: ["servicenow.sync.requested", "jira.sync.requested"],
  translation: ["ocsf.oscal.translate.requested"],
  assessment_artifacts: [
    "assessment-artifact.package.upsert",
    "assessment-artifact.item.upsert",
    "assessment-artifact.schedule.upsert",
    "assessment-artifact.package.generate-from-template",
    "assessment-artifact.package.import-tsv",
    "assessment-artifact.schedule.pause",
    "assessment-artifact.schedule.resume"
  ],
  grc: [
    "grc.folder.upsert",
    "grc.framework.upsert",
    "grc.framework.import",
    "grc.requirement-node.upsert",
    "grc.reference-control.upsert",
    "grc.applied-control.upsert",
    "grc.policy.upsert",
    "grc.risk-matrix.upsert",
    "grc.threat.upsert",
    "grc.vulnerability.upsert",
    "grc.risk-assessment.upsert",
    "grc.risk-scenario.upsert",
    "grc.risk-acceptance.upsert",
    "grc.risk-acceptance.approve",
    "grc.risk-acceptance.reject",
    "grc.evidence.upsert",
    "grc.evidence.upload",
    "grc.compliance-assessment.upsert",
    "grc.requirement-assessment.upsert",
    "grc.requirement-assessment.bulk-update",
    "grc.finding.upsert",
    "grc.finding.close",
    "grc.filtering-label.upsert",
    "grc.campaign.upsert",
    "grc.requirement-mapping-set.upsert",
    "grc.asset.upsert"
  ],
  tprm: [
    "tprm.entity.upsert",
    "tprm.entity-assessment.upsert",
    "tprm.solution.upsert",
    "tprm.representative.upsert",
    "tprm.contract.upsert"
  ],
  ebios: [
    "ebios.study.upsert",
    "ebios.feared-event.upsert",
    "ebios.ro-to.upsert",
    "ebios.stakeholder.upsert",
    "ebios.attack-path.upsert",
    "ebios.operational-scenario.upsert",
    "ebios.strategic-scenario.upsert"
  ],
  privacy: [
    "privacy.purpose.upsert",
    "privacy.personal-data.upsert",
    "privacy.data-subject.upsert",
    "privacy.data-recipient.upsert",
    "privacy.data-transfer.upsert",
    "privacy.processing.upsert",
    "privacy.right-request.upsert",
    "privacy.right-request.complete",
    "privacy.data-breach.upsert",
    "privacy.data-breach.report",
    "privacy.data-asset.upsert",
    "privacy.data-flow.upsert",
    "privacy.consent-record.upsert"
  ],
  business_continuity: [
    "bc.plan.upsert",
    "bc.audit.upsert",
    "bc.task.upsert",
    "bc.task.complete"
  ],
  crq_domain: [
    "crq.study.upsert",
    "crq.scenario.upsert",
    "crq.hypothesis.upsert"
  ],
  rmf: [
    "rmf.system-group.upsert",
    "rmf.change-request.upsert",
    "rmf.change-request.approve",
    "rmf.checklist.upsert",
    "rmf.checklist-score.upsert",
    "rmf.template.upsert",
    "rmf.artifact.upsert",
    "rmf.vulnerability-finding.upsert",
    "rmf.nessus-scan.import"
  ],
  secops: [
    "secops.incident.upsert",
    "secops.incident.resolve",
    "secops.awareness-program.upsert",
    "secops.awareness-campaign.upsert",
    "secops.awareness-completion.record"
  ],
  metrology: [
    "metrology.definition.upsert",
    "metrology.instance.record",
    "metrology.dashboard.upsert",
    "metrology.widget.upsert"
  ],
  wf: [
    "wf.template.upsert",
    "wf.execution.start",
    "wf.execution.advance",
    "wf.execution.complete",
    "wf.schedule.upsert",
    "wf.assessment-task.upsert",
    "wf.assessment-task.complete"
  ],
  compliance_domain: [
    "compliance.online-assessment.upsert",
    "compliance.assessment-run.start",
    "compliance.assessment-run.complete",
    "compliance.audit.upsert",
    "compliance.finding.upsert",
    "compliance.exception.upsert",
    "compliance.exception.approve"
  ],
  asset_service: [
    "asset.item.upsert",
    "asset.process.upsert",
    "asset.service.upsert",
    "asset.service-contract.upsert"
  ],
  resilience: [
    "resilience.bia.upsert",
    "resilience.asset-assessment.upsert",
    "resilience.escalation-threshold.upsert"
  ],
  control_library: [
    "ctllib.control.upsert",
    "ctllib.implementation.upsert",
    "ctllib.policy.upsert",
    "ctllib.policy-ack.record",
    "ctllib.evidence-item.upsert"
  ],
  governance: [
    "gov.control-origination.upsert",
    "gov.responsibility-matrix.upsert",
    "gov.responsibility-assignment.upsert",
    "gov.assessment-plan.upsert",
    "gov.assessment-plan.approve",
    "gov.attestation.upsert",
    "gov.attestation.approve",
    "gov.attestation.revoke",
    "gov.authorization-timeline.upsert",
    "gov.authorization-timeline.advance"
  ],
  organization: [
    "org.unit.upsert"
  ],
  settings: [
    "settings.global.upsert",
    "settings.feature-flag.upsert"
  ],
  iam: [
    "iam.user.upsert",
    "iam.user-group.upsert",
    "iam.role-assignment.upsert"
  ],
  vendor_portal: [
    "vp.questionnaire-response.submit",
    "vp.evidence-submission.upload"
  ],
  serdes: [
    "serdes.dump-db.requested",
    "serdes.load-backup.requested"
  ]
};

export const PROJECTION_TABLES: Record<ProjectionName, ProjectionTable> = {
  "connector-health": {
    table: "rm_connector_health",
    idColumn: "connector_instance_id",
    orderBy: "updated_at DESC"
  },
  "conmon-dashboard": {
    table: "rm_conmon_dashboard",
    idColumn: "dashboard_key",
    orderBy: "updated_at DESC"
  },
  "conmon-operational-rollup": {
    table: "rm_conmon_operational_rollup",
    idColumn: "profile_id",
    orderBy: "updated_at DESC"
  },
  "poam-status": {
    table: "rm_poam_status",
    idColumn: "poam_item_id",
    orderBy: "updated_at DESC"
  },
  "security-graph-nodes": {
    table: "rm_security_graph_nodes",
    idColumn: "node_id",
    orderBy: "updated_at DESC"
  },
  "security-graph-edges": {
    table: "rm_security_graph_edges",
    idColumn: "edge_id",
    orderBy: "updated_at DESC"
  },
  "risk-register-overview": {
    table: "rm_risk_register_overview",
    idColumn: "risk_type",
    orderBy: "updated_at DESC"
  },
  "compliance-posture": {
    table: "rm_compliance_posture",
    idColumn: "framework_id",
    orderBy: "updated_at DESC"
  },
  "vendor-questionnaire-status": {
    table: "rm_vendor_questionnaire_status",
    idColumn: "questionnaire_id",
    orderBy: "updated_at DESC"
  },
  "lightning-assessment-summary": {
    table: "rm_lightning_assessment_summary",
    idColumn: "assessment_id",
    orderBy: "updated_at DESC"
  },
  "version-history-latest": {
    table: "rm_version_history_latest",
    idColumn: "resource_id",
    orderBy: "updated_at DESC"
  },
  "evidence-automation-status": {
    table: "rm_evidence_automation_status",
    idColumn: "run_id",
    orderBy: "updated_at DESC"
  },
  "workflow-execution-status": {
    table: "rm_workflow_execution_status",
    idColumn: "execution_id",
    orderBy: "updated_at DESC"
  },
  "oscal-job-status": {
    table: "rm_oscal_job_status",
    idColumn: "oscal_job_id",
    orderBy: "updated_at DESC"
  },
  "ai-assistant-status": {
    table: "rm_ai_assistant_status",
    idColumn: "ai_job_id",
    orderBy: "updated_at DESC"
  },
  "vendor-scoring-summary": {
    table: "rm_vendor_scoring_summary",
    idColumn: "scoring_id",
    orderBy: "updated_at DESC"
  },
  "framework-library-index": {
    table: "rm_framework_library_index",
    idColumn: "library_id",
    orderBy: "updated_at DESC"
  },
  "fedramp-automation-status": {
    table: "rm_fedramp_automation_status",
    idColumn: "run_id",
    orderBy: "updated_at DESC"
  },
  "crq-summary": {
    table: "rm_crq_summary",
    idColumn: "run_id",
    orderBy: "updated_at DESC"
  },
  "mapping-summary": {
    table: "rm_mapping_summary",
    idColumn: "mapping_job_id",
    orderBy: "updated_at DESC"
  },
  "scanner-finding-summary": {
    table: "rm_scanner_finding_summary",
    idColumn: "ingest_job_id",
    orderBy: "updated_at DESC"
  },
  "integration-sync-status": {
    table: "rm_integration_sync_status",
    idColumn: "sync_job_id",
    orderBy: "updated_at DESC"
  },
  "translation-status": {
    table: "rm_translation_status",
    idColumn: "translation_job_id",
    orderBy: "updated_at DESC"
  },
  "legacy-domain-overview": {
    table: "rm_legacy_domain_overview",
    idColumn: "entity_id",
    orderBy: "updated_at DESC"
  },
  "assessment-artifact-summary": {
    table: "rm_assessment_artifact_summary",
    idColumn: "package_id",
    orderBy: "updated_at DESC"
  },
  "grc-overview": {
    table: "rm_grc_overview",
    idColumn: "folder_id",
    orderBy: "updated_at DESC"
  },
  "tprm-overview": {
    table: "rm_tprm_overview",
    idColumn: "entity_id",
    orderBy: "updated_at DESC"
  },
  "ebios-study-summary": {
    table: "rm_ebios_study_summary",
    idColumn: "study_id",
    orderBy: "updated_at DESC"
  },
  "privacy-overview": {
    table: "rm_privacy_overview",
    idColumn: "processing_id",
    orderBy: "updated_at DESC"
  },
  "bc-plan-status": {
    table: "rm_bc_plan_status",
    idColumn: "plan_id",
    orderBy: "updated_at DESC"
  },
  "crq-portfolio": {
    table: "rm_crq_portfolio",
    idColumn: "study_id",
    orderBy: "updated_at DESC"
  },
  "rmf-dashboard": {
    table: "rm_rmf_dashboard",
    idColumn: "system_group_id",
    orderBy: "updated_at DESC"
  },
  "secops-dashboard": {
    table: "rm_secops_dashboard",
    idColumn: "incident_id",
    orderBy: "updated_at DESC"
  },
  "metrology-current": {
    table: "rm_metrology_current",
    idColumn: "definition_id",
    orderBy: "updated_at DESC"
  },
  "compliance-overview": {
    table: "rm_compliance_overview",
    idColumn: "assessment_id",
    orderBy: "updated_at DESC"
  },
  "asset-inventory": {
    table: "rm_asset_inventory",
    idColumn: "asset_id",
    orderBy: "updated_at DESC"
  },
  "resilience-status": {
    table: "rm_resilience_status",
    idColumn: "bia_id",
    orderBy: "updated_at DESC"
  },
  "workflow-overview": {
    table: "rm_workflow_overview",
    idColumn: "template_id",
    orderBy: "updated_at DESC"
  },
  "control-library-index": {
    table: "rm_control_library_index",
    idColumn: "control_id",
    orderBy: "updated_at DESC"
  },
  "governance-overview": {
    table: "rm_governance_overview",
    idColumn: "plan_id",
    orderBy: "updated_at DESC"
  },
  "org-structure": {
    table: "rm_org_structure",
    idColumn: "unit_id",
    orderBy: "updated_at DESC"
  },
  "iam-user-directory": {
    table: "rm_iam_user_directory",
    idColumn: "user_id",
    orderBy: "updated_at DESC"
  },
  "settings-current": {
    table: "rm_settings_current",
    idColumn: "setting_key",
    orderBy: "updated_at DESC"
  },
  "vendor-portal-status": {
    table: "rm_vendor_portal_status",
    idColumn: "submission_id",
    orderBy: "updated_at DESC"
  }
};

export const PROJECTION_NAMES = Object.keys(PROJECTION_TABLES) as ProjectionName[];
