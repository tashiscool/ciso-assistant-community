export type CommandStatus =
  | "accepted"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type JobStatus =
  | "pending"
  | "accepted"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface CommandEnvelope {
  command_id: string;
  command_type: string;
  tenant_id: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
  job_id: string;
  created_at: string;
}

export interface DomainEventEnvelope {
  event_id: string;
  event_type: string;
  aggregate_id: string;
  aggregate_version: number;
  tenant_id: string;
  occurred_at: string;
  payload: Record<string, unknown>;
}

export interface ExportJobMessage {
  job_id: string;
  tenant_id: string;
  module: string;
  format?: string;
  aggregate_id?: string;
  event_type?: string;
  object_group?: string;
  payload?: Record<string, unknown>;
}

export interface SignedObjectUrlRequest {
  object_type: "evidence" | "import" | "export" | "snapshot";
  tenant_id: string;
  object_id: string;
  filename: string;
  content_type: string;
  object_group?: string;
  retention_class?: "transient" | "short" | "long" | "pinned";
  expires_in_seconds?: number;
}

export interface ProjectionTable {
  table: string;
  idColumn: string;
  orderBy: string;
}

export type ProjectionName =
  | "connector-health"
  | "conmon-dashboard"
  | "conmon-operational-rollup"
  | "poam-status"
  | "security-graph-nodes"
  | "security-graph-edges"
  | "risk-register-overview"
  | "compliance-posture"
  | "vendor-questionnaire-status"
  | "lightning-assessment-summary"
  | "version-history-latest"
  | "evidence-automation-status"
  | "workflow-execution-status"
  | "oscal-job-status"
  | "ai-assistant-status"
  | "vendor-scoring-summary"
  | "framework-library-index"
  | "fedramp-automation-status"
  | "crq-summary"
  | "mapping-summary"
  | "scanner-finding-summary"
  | "integration-sync-status"
  | "translation-status"
  | "assessment-artifact-summary"
  | "legacy-domain-overview"
  | "grc-overview"
  | "tprm-overview"
  | "ebios-study-summary"
  | "privacy-overview"
  | "bc-plan-status"
  | "crq-portfolio"
  | "rmf-dashboard"
  | "secops-dashboard"
  | "metrology-current"
  | "compliance-overview"
  | "asset-inventory"
  | "resilience-status"
  | "workflow-overview"
  | "control-library-index"
  | "governance-overview"
  | "org-structure"
  | "iam-user-directory"
  | "settings-current"
  | "vendor-portal-status";
