import { CLOUDFLARE_API_BASE_URL } from '$lib/utils/constants';
import type {
	ApiCatalogResponse,
	CommandAcceptedResponse,
	CommandEnvelopeRequest,
	HealthResponse,
	JobResponse,
	ParityChecklistResponse,
	ParityCoverageResponse,
	ParityValidateResponse,
	ProjectionName,
	ProjectionReadItemResponse,
	ProjectionReadListResponse,
	SignedDownloadResponse,
	SignedUploadRequest,
	SignedUploadResponse,
	SupportedCommandType
} from './types';

type QueryValue = string | number | boolean | null | undefined;
type QueryRecord = Record<string, QueryValue>;

export class CloudflareApiError extends Error {
	status: number;
	details: unknown;

	constructor(status: number, message: string, details: unknown) {
		super(message);
		this.name = 'CloudflareApiError';
		this.status = status;
		this.details = details;
	}
}

function normalizeBaseUrl(): string {
	const raw = CLOUDFLARE_API_BASE_URL || '/api/v2';
	return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function buildUrl(path: string, query?: QueryRecord): string {
	const base = normalizeBaseUrl();
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	const url = new URL(`${base}${normalizedPath}`, window.location.origin);

	if (query) {
		for (const [key, value] of Object.entries(query)) {
			if (value === undefined || value === null || value === '') {
				continue;
			}
			url.searchParams.set(key, String(value));
		}
	}

	return `${url.pathname}${url.search}`;
}

async function requestJson<T>(
	path: string,
	init: RequestInit = {},
	query?: QueryRecord
): Promise<T> {
	const response = await fetch(buildUrl(path, query), {
		...init,
		headers: {
			'content-type': 'application/json',
			...(init.headers || {})
		}
	});

	if (!response.ok) {
		const raw = await response.text();
		let details: unknown = raw;
		let message = `Cloudflare API error (${response.status})`;
		try {
			const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
			details = parsed;
			if (typeof parsed.error === 'string' && parsed.error) {
				message = parsed.error;
			}
		} catch {
			// Keep raw text payload.
		}
		throw new CloudflareApiError(response.status, message, details);
	}

	if (response.status === 204) {
		return null as T;
	}

	return (await response.json()) as T;
}

export async function getApiHealth(): Promise<HealthResponse> {
	return requestJson<HealthResponse>('/healthz', { method: 'GET' });
}

export async function getApiCatalog(): Promise<ApiCatalogResponse> {
	return requestJson<ApiCatalogResponse>('/catalog', { method: 'GET' });
}

export async function createCommand(
	commandType: SupportedCommandType,
	body: CommandEnvelopeRequest
): Promise<CommandAcceptedResponse> {
	return requestJson<CommandAcceptedResponse>(`/commands/${encodeURIComponent(commandType)}`, {
		method: 'POST',
		body: JSON.stringify(body)
	});
}

export async function getJob(jobId: string): Promise<JobResponse> {
	return requestJson<JobResponse>(`/jobs/${encodeURIComponent(jobId)}`, { method: 'GET' });
}

export async function getParityChecklist(params?: {
	include_fields?: boolean;
	feature_family?: string;
	command_type?: SupportedCommandType;
}): Promise<ParityChecklistResponse> {
	return requestJson<ParityChecklistResponse>('/parity/checklist', { method: 'GET' }, params);
}

export async function getParityCoverage(
	tenantId: string,
	params?: {
		include_fields?: boolean;
		feature_family?: string;
		command_type?: SupportedCommandType;
	}
): Promise<ParityCoverageResponse> {
	return requestJson<ParityCoverageResponse>(
		'/parity/coverage',
		{
			method: 'GET',
			headers: { 'x-tenant-id': tenantId }
		},
		{
			tenant_id: tenantId,
			include_fields: params?.include_fields,
			feature_family: params?.feature_family,
			command_type: params?.command_type
		}
	);
}

export async function validateParityRecord(
	tenantId: string,
	modelKey: string,
	recordId: string
): Promise<ParityValidateResponse> {
	return requestJson<ParityValidateResponse>(
		'/parity/validate',
		{
			method: 'GET',
			headers: { 'x-tenant-id': tenantId }
		},
		{ tenant_id: tenantId, model_key: modelKey, record_id: recordId }
	);
}

export async function readProjection(
	projection: ProjectionName,
	tenantId: string,
	params?: {
		id?: string;
		limit?: number;
		offset?: number;
	}
): Promise<ProjectionReadListResponse | ProjectionReadItemResponse> {
	return requestJson<ProjectionReadListResponse | ProjectionReadItemResponse>(
		`/read/${encodeURIComponent(projection)}`,
		{
			method: 'GET',
			headers: { 'x-tenant-id': tenantId }
		},
		{
			tenant_id: tenantId,
			id: params?.id,
			limit: params?.limit,
			offset: params?.offset
		}
	);
}

export async function createSignedUploadUrl(
	request: SignedUploadRequest
): Promise<SignedUploadResponse> {
	return requestJson<SignedUploadResponse>('/files/upload-url', {
		method: 'POST',
		body: JSON.stringify(request)
	});
}

export async function createSignedDownloadUrl(args: {
	object_key: string;
	object_type: SignedUploadRequest['object_type'];
	tenant_id: string;
	expires_in_seconds?: number;
}): Promise<SignedDownloadResponse> {
	return requestJson<SignedDownloadResponse>('/files/download-url', { method: 'GET' }, args);
}

export async function uploadToSignedUrl(uploadUrl: string, file: File): Promise<void> {
	const response = await fetch(uploadUrl, {
		method: 'PUT',
		headers: { 'content-type': file.type || 'application/octet-stream' },
		body: file
	});

	if (!response.ok) {
		throw new CloudflareApiError(
			response.status,
			`Signed upload failed (${response.status})`,
			await response.text()
		);
	}
}

