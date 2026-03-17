export const SUPPORTED_COMMAND_TYPES = [
	'connectors.sync.requested',
	'lightning-assessment.upsert',
	'version-history.snapshot.requested',
	'security-graph.ingest.requested',
	'evidence.collection.requested',
	'workflow.execution.requested',
	'oscal.import.requested',
	'oscal.export.requested',
	'conmon.profile.refresh.requested',
	'poam.item.upsert',
	'ai.assistant.run.requested',
	'ai.vendor-scoring.requested',
	'vendor.questionnaire.upsert',
	'library.index.refresh.requested',
	'fedramp.automation.run.requested',
	'crq.compute.requested',
	'mapping.compute.requested',
	'scanner.sync.requested',
	'sarif.import.requested',
	'scap.import.requested',
	'servicenow.sync.requested',
	'jira.sync.requested',
	'ocsf.oscal.translate.requested',
	'assessment-artifact.package.upsert',
	'assessment-artifact.item.upsert',
	'assessment-artifact.schedule.upsert',
	'assessment-artifact.package.generate-from-template',
	'assessment-artifact.package.import-tsv',
	'assessment-artifact.schedule.pause',
	'assessment-artifact.schedule.resume'
] as const;

export type SupportedCommandType = (typeof SUPPORTED_COMMAND_TYPES)[number];

export const PROJECTION_NAMES = [
	'connector-health',
	'conmon-dashboard',
	'conmon-operational-rollup',
	'poam-status',
	'security-graph-nodes',
	'security-graph-edges',
	'risk-register-overview',
	'compliance-posture',
	'vendor-questionnaire-status',
	'lightning-assessment-summary',
	'version-history-latest',
	'evidence-automation-status',
	'workflow-execution-status',
	'oscal-job-status',
	'ai-assistant-status',
	'vendor-scoring-summary',
	'framework-library-index',
	'fedramp-automation-status',
	'crq-summary',
	'mapping-summary',
	'scanner-finding-summary',
	'integration-sync-status',
	'translation-status',
	'assessment-artifact-summary',
	'legacy-domain-overview'
] as const;

export type ProjectionName = (typeof PROJECTION_NAMES)[number];

export type CommandEnvelopeRequest = {
	idempotency_key: string;
	tenant_id: string;
	payload: Record<string, unknown>;
};

export type CommandAcceptedResponse = {
	command_id: string;
	job_id: string;
	status_url: string;
	known_command_type?: boolean;
	idempotent_replay?: boolean;
	status?: string;
	warning?: string;
	error?: string;
};

export type JobStatus = 'accepted' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'pending';

export type JobResponse = {
	job_id: string;
	tenant_id: string;
	job_type: string;
	status: JobStatus;
	progress: number;
	result_ref: string | null;
	error: string | null;
	created_at: string;
	updated_at: string;
	completed_at: string | null;
};

export type ApiCatalogResponse = {
	commands: readonly SupportedCommandType[];
	command_groups: Record<string, readonly SupportedCommandType[]>;
	projections: readonly ProjectionName[];
	notes: {
		accepts_unknown_command_types: boolean;
		async_export_modules: string[];
		field_parity_registry_models: number;
		field_parity_registry_fields: number;
		field_parity_feature_families?: number;
		upload_contract: string;
		read_contract: string;
	};
};

export type ParityRegistrySource = 'python' | 'custom' | 'runtime';
export type ParityStatus = 'complete' | 'incomplete' | 'unobserved';

export type ParityChecklistCommand = {
	command_type: SupportedCommandType;
	model_key: string;
	registry_source: ParityRegistrySource;
	expected_field_count: number;
	expected_fields?: string[];
};

export type ParityChecklistFamily = {
	feature_family: string;
	expected_field_count: number;
	commands: ParityChecklistCommand[];
};

export type ParityChecklistResponse = {
	feature_family_count: number;
	command_count: number;
	feature_families: string[];
	filters: {
		feature_family: string | null;
		command_type: SupportedCommandType | null;
	};
	items: ParityChecklistFamily[];
};

export type ParityCoverageCommand = {
	command_type: SupportedCommandType;
	model_key: string;
	registry_source: ParityRegistrySource;
	expected_field_count: number;
	expected_fields?: string[];
	parity_records: number;
	complete_records: number;
	incomplete_records: number;
	coverage_ratio: number;
	status: ParityStatus;
	latest_record_id: string | null;
	latest_missing_fields: string[];
	latest_extra_fields: string[];
	last_updated_at: string | null;
};

export type ParityCoverageFamily = {
	feature_family: string;
	expected_field_count: number;
	parity_records: number;
	complete_records: number;
	incomplete_records: number;
	coverage_ratio: number;
	status: ParityStatus;
	commands: ParityCoverageCommand[];
};

export type ParityCoverageSummary = {
	parity_records: number;
	complete_records: number;
	incomplete_records: number;
	overall_coverage_ratio: number;
	commands_complete: number;
	commands_incomplete: number;
	commands_unobserved: number;
};

export type ParityCoverageResponse = {
	tenant_id: string;
	feature_family_count: number;
	command_count: number;
	checklist_command_count: number;
	checklist_expected_field_count: number;
	summary: ParityCoverageSummary;
	filters: {
		feature_family: string | null;
		command_type: SupportedCommandType | null;
	};
	items: ParityCoverageFamily[];
};

export type ParityValidateResponse = {
	tenant_id: string;
	model_key: string;
	record_id: string;
	parity_status: 'complete' | 'incomplete';
	coverage_ratio: number;
	expected_field_count: number;
	present_field_count: number;
	missing_fields: string[];
	extra_fields: string[];
	last_updated_at: string;
};

export type ProjectionReadListResponse = {
	projection: ProjectionName;
	tenant_id: string;
	limit: number;
	offset: number;
	items: Record<string, unknown>[];
};

export type ProjectionReadItemResponse = {
	projection: ProjectionName;
	item: Record<string, unknown>;
};

export type SignedUploadRequest = {
	object_type: 'evidence' | 'import' | 'export' | 'snapshot';
	tenant_id: string;
	object_id: string;
	filename: string;
	content_type: string;
	object_group?: string;
	retention_class?: 'transient' | 'short' | 'long' | 'pinned';
	expires_in_seconds?: number;
};

export type SignedUploadResponse = {
	object_key: string;
	upload_url: string;
	expires_at: string;
	retention_class: 'transient' | 'short' | 'long' | 'pinned';
};

export type SignedDownloadResponse = {
	object_key: string;
	download_url: string;
	expires_at: string;
};

export type HealthResponse = {
	status: 'ok';
	service: string;
};

export type AnalyticsOverviewResponse = {
	tenant_id: string;
	start: string;
	end: string;
	totals: {
		total_events: number;
		event_type_count: number;
		error_events: number;
		active_sources: number;
		active_domains: number;
		active_models: number;
		last_event_time: string | null;
	};
	top_event_types: Array<{
		event_type: string;
		total_events: number;
		last_event_time: string | null;
	}>;
	checkpoint: {
		checkpoint_key: string;
		last_event_id: string | null;
		last_event_time: string | null;
		last_ingest_time: string | null;
		last_raw_object_key: string | null;
		stats: Record<string, unknown>;
		updated_at: string;
	} | null;
};

export type AnalyticsVolumeResponse = {
	tenant_id: string;
	grain: '1m' | '1h' | '1d';
	start: string;
	end: string;
	event_type: string | null;
	items: Array<{
		bucket_start: string;
		total_events: number;
		last_event_time: string | null;
	}>;
};

export type AnalyticsRankedListResponse = {
	tenant_id: string;
	start: string;
	end: string;
	items: Array<Record<string, unknown>>;
};
