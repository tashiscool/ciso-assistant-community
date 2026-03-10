/**
 * Assessment Artifact Package API Client
 *
 * TypeScript interfaces and API functions for assessment artifact packages,
 * evidence request items, and periodic evidence schedules.
 */

// NOTE:
// Keep this module self-contained so it can be typechecked directly with `tsc`
// (without relying on Svelte alias resolution or ambient project config).
export interface ApiResponse<T> {
	success: boolean;
	data: T;
	message?: string;
}

type PaginatedData<T> = {
	results: T[];
	count: number;
	next: string | null;
	previous: string | null;
};

export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;

type RequestConfig = {
	params?: Record<string, unknown>;
	headers?: Record<string, string>;
};

const API_BASE = '/api';

function buildUrl(path: string, params?: Record<string, unknown>): string {
	let url = `${API_BASE}${path}`;
	if (!params) return url;
	const qs = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null || value === '') continue;
		qs.append(key, String(value));
	}
	const serialized = qs.toString();
	if (serialized) {
		url += (url.includes('?') ? '&' : '?') + serialized;
	}
	return url;
}

async function request<T>(
	method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
	path: string,
	data?: unknown,
	config?: RequestConfig
): Promise<ApiResponse<T>> {
	const headers: Record<string, string> = { ...(config?.headers || {}) };
	let body: BodyInit | undefined;

	if (data instanceof FormData) {
		body = data;
	} else if (data !== undefined) {
		headers['Content-Type'] = headers['Content-Type'] || 'application/json';
		body = JSON.stringify(data);
	}

	const response = await fetch(buildUrl(path, config?.params), {
		method,
		headers,
		body,
		credentials: 'include'
	});

	if (!response.ok) {
		const errorPayload = await response.json().catch(() => ({}));
		return {
			success: false,
			data: errorPayload as T,
			message:
				(errorPayload as { detail?: string; message?: string }).detail ||
				(errorPayload as { detail?: string; message?: string }).message ||
				`HTTP ${response.status}: ${response.statusText}`
		};
	}

	if (response.status === 204) {
		return { success: true, data: null as T };
	}

	return { success: true, data: (await response.json()) as T };
}

const api = {
	get<T>(path: string, config?: RequestConfig): Promise<ApiResponse<T>> {
		return request<T>('GET', path, undefined, config);
	},
	post<T>(path: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
		return request<T>('POST', path, data, config);
	},
	patch<T>(path: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
		return request<T>('PATCH', path, data, config);
	},
	put<T>(path: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
		return request<T>('PUT', path, data, config);
	},
	delete<T>(path: string, config?: RequestConfig): Promise<ApiResponse<T>> {
		return request<T>('DELETE', path, undefined, config);
	}
};

// ── Types ───────────────────────────────────────────────────────────────

export type PackageStatus = 'draft' | 'active' | 'archived';
export type PackageType = 'fedramp' | 'nist_800_53' | 'iso_27001' | 'soc_2' | 'cmmc' | 'custom';

export type PrimaryArtifactType =
	| 'system_generated_output'
	| 'configuration_snapshot'
	| 'command_output'
	| 'scan_evidence'
	| 'report'
	| 'policy_document'
	| 'procedure_document'
	| 'plan_document'
	| 'records'
	| 'meeting_evidence'
	| 'communication_evidence'
	| 'screenshot'
	| 'inventory_listing'
	| 'training_artifact'
	| 'matrix_or_mapping'
	| 'alert_evidence'
	| 'ticketing_evidence'
	| 'generic_evidence';

export type CollectionChannel =
	| 'tool_export'
	| 'cli_capture'
	| 'scanner_export'
	| 'report_export'
	| 'document_repository'
	| 'system_of_record_export'
	| 'governance_records'
	| 'mail_ticket_export'
	| 'screenshot_capture'
	| 'manual_collection';

export type Periodicity =
	| 'on_demand'
	| 'weekly'
	| 'monthly'
	| 'quarterly'
	| 'semi_annual'
	| 'annual'
	| 'event_driven'
	| 'continuous';

export type ScheduleFrequency = 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
export type ScheduleStatus = 'active' | 'paused' | 'completed';

export interface ArtifactRequestItem {
	id: string;
	request_id: string;
	source_line: number;
	category: string;
	artifact_request: string;
	request_date?: string;
	controls: string[];
	control_families: string[];
	control_domains: string[];
	workstreams: string[];
	supplemental_references: string[];
	primary_artifact_type: PrimaryArtifactType;
	artifact_types: string[];
	collection_channel: CollectionChannel;
	platform_tags: string[];
	time_scopes: string[];
	periodicity: Periodicity;
	periodicity_display: string;
	commands: string[];
	config_paths: string[];
	bundle_hint: {
		relative_path: string;
		suggested_extension: string;
	};
	evidence?: string;
	created_at: string;
}

export interface EvidenceSchedule {
	id: string;
	name: string;
	description: string;
	frequency: ScheduleFrequency;
	frequency_display: string;
	status: ScheduleStatus;
	status_display: string;
	cron_expression: string;
	control_families: string[];
	controls: string[];
	evidence_types: string[];
	platform_tags: string[];
	collection_actions: Array<{
		channel: string;
		request_count?: number;
		request_ids?: string[];
		commands?: string[];
		note?: string;
	}>;
	evidence_rule?: string;
	conmon_activity?: string;
	last_collected_at?: string;
	next_due_at?: string;
	items_count: number;
	created_at: string;
}

export interface CollectionPlaybook {
	playbook_id: string;
	name: string;
	applies_to_platform_tags: string[];
	required_channels: string[];
	example_commands: string[];
}

export interface QualityIssue {
	request_id: string;
	source_line: number;
	issue: string;
}

export interface PackageStats {
	total_requests: number;
	requests_with_quality_issues: number;
	unique_controls: number;
	unique_workstreams: number;
	unique_artifact_types: number;
	unique_platform_tags: number;
	top_controls: [string, number][];
	top_workstreams: [string, number][];
	top_artifact_types: [string, number][];
	top_platform_tags: [string, number][];
	periodicity_breakdown: Record<string, number>;
}

export interface ArtifactPackage {
	id: string;
	name: string;
	description: string;
	status: PackageStatus;
	status_display: string;
	package_type: PackageType;
	package_type_display: string;
	system_name: string;
	system_description: string;
	compliance_assessment?: string;
	platform_tags: string[];
	stats: PackageStats;
	collection_playbooks: CollectionPlaybook[];
	quality_report: {
		issues: QualityIssue[];
		quality_gate: 'pass' | 'needs_review';
	};
	indexes: Record<string, Record<string, string[]>>;
	source_file: string;
	total_items: number;
	schedule_count: number;
	created_at: string;
	updated_at: string;
}

export interface ArtifactPackageDetail extends ArtifactPackage {
	request_items: ArtifactRequestItem[];
	evidence_schedules: EvidenceSchedule[];
}

export interface ScheduleSummary {
	total_items: number;
	scheduled_items: number;
	unscheduled_items: number;
	schedule_count: number;
	by_frequency: Record<
		string,
		Array<{
			id: string;
			name: string;
			items_count: number;
			controls_count: number;
			control_families: string[];
			cron: string;
			status: string;
		}>
	>;
}

export interface PeriodicityBreakdown {
	total_items: number;
	breakdown: Record<
		string,
		{
			label: string;
			count: number;
			controls: string[];
			control_families: string[];
		}
	>;
}

export interface ArtifactTemplateSummary {
	key: string;
	name: string;
	description: string;
	framework: string;
	platforms: string[];
	item_count: number;
}

// ── API Functions ───────────────────────────────────────────────────────

const BASE = '/assessment-artifacts';

export const artifactPackageApi = {
	async list(params?: Record<string, any>): Promise<PaginatedResponse<ArtifactPackage>> {
		return api.get(`${BASE}/packages/`, { params });
	},

	async retrieve(id: string): Promise<ApiResponse<ArtifactPackageDetail>> {
		return api.get(`${BASE}/packages/${id}/`);
	},

	async create(data: Partial<ArtifactPackage>): Promise<ApiResponse<ArtifactPackage>> {
		return api.post(`${BASE}/packages/`, data);
	},

	async update(
		id: string,
		data: Partial<ArtifactPackage>
	): Promise<ApiResponse<ArtifactPackage>> {
		return api.patch(`${BASE}/packages/${id}/`, data);
	},

	async delete(id: string): Promise<ApiResponse<void>> {
		return api.delete(`${BASE}/packages/${id}/`);
	},

	async importTsv(formData: FormData): Promise<ApiResponse<ArtifactPackageDetail>> {
		return api.post(`${BASE}/packages/import_tsv/`, formData);
	},

	async listTemplates(): Promise<ApiResponse<{ templates: ArtifactTemplateSummary[] }>> {
		return api.get(`${BASE}/packages/templates/`);
	},

	async generateFromTemplate(data: {
		template_key: string;
		name?: string;
		system_name?: string;
		package_type?: PackageType;
		generate_schedules?: boolean;
	}): Promise<ApiResponse<ArtifactPackageDetail>> {
		return api.post(`${BASE}/packages/generate_from_template/`, data);
	},

	async generateSchedules(id: string): Promise<ApiResponse<EvidenceSchedule[]>> {
		return api.post(`${BASE}/packages/${id}/generate_schedules/`);
	},

	async scheduleSummary(id: string): Promise<ApiResponse<ScheduleSummary>> {
		return api.get(`${BASE}/packages/${id}/schedule_summary/`);
	},

	async exportJson(id: string): Promise<string> {
		const resp = await fetch(`/api${BASE}/packages/${id}/export_json/`);
		return resp.url;
	},

	async periodicityBreakdown(id: string): Promise<ApiResponse<PeriodicityBreakdown>> {
		return api.get(`${BASE}/packages/${id}/periodicity_breakdown/`);
	}
};

export const artifactItemApi = {
	async list(params?: Record<string, any>): Promise<PaginatedResponse<ArtifactRequestItem>> {
		return api.get(`${BASE}/items/`, { params });
	},

	async retrieve(id: string): Promise<ApiResponse<ArtifactRequestItem>> {
		return api.get(`${BASE}/items/${id}/`);
	}
};

export const evidenceScheduleApi = {
	async list(params?: Record<string, any>): Promise<PaginatedResponse<EvidenceSchedule>> {
		return api.get(`${BASE}/schedules/`, { params });
	},

	async retrieve(id: string): Promise<ApiResponse<EvidenceSchedule>> {
		return api.get(`${BASE}/schedules/${id}/`);
	},

	async pause(id: string): Promise<ApiResponse<EvidenceSchedule>> {
		return api.post(`${BASE}/schedules/${id}/pause/`);
	},

	async resume(id: string): Promise<ApiResponse<EvidenceSchedule>> {
		return api.post(`${BASE}/schedules/${id}/resume/`);
	}
};
