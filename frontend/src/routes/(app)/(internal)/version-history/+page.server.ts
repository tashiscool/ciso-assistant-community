import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';

function toVersion(v: Record<string, unknown>) {
	return {
		id: String(v.id ?? ''),
		versionNumber: Number(v.version_number ?? 0),
		versionLabel: v.version_label ? String(v.version_label) : undefined,
		changeType: String(v.change_type ?? 'update'),
		changeSummary: String(v.change_summary ?? ''),
		changeReason: v.change_reason ? String(v.change_reason) : undefined,
		changedFields: Array.isArray(v.changed_fields) ? v.changed_fields : [],
		snapshotData: (v.snapshot_data as Record<string, unknown>) ?? {},
		previousValues: (v.previous_values as Record<string, unknown>) ?? {},
		contentTypeName: v.content_type_name ? String(v.content_type_name) : undefined,
		objectId: v.object_id ? String(v.object_id) : undefined,
		createdAt: String(v.created_at ?? ''),
		createdBy: v.created_by ? String(v.created_by) : undefined,
		createdByName: v.created_by_name ? String(v.created_by_name) : undefined,
		tags: Array.isArray(v.tags) ? v.tags : []
	};
}

export const load: PageServerLoad = async ({ fetch, url }) => {
	const page = url.searchParams.get('page') || '1';
	const changeType = url.searchParams.get('change_type') || '';
	const contentType = url.searchParams.get('content_type') || '';
	const fromDate = url.searchParams.get('from_date') || '';
	const toDate = url.searchParams.get('to_date') || '';

	const params = new URLSearchParams({ page });
	if (changeType) params.set('change_type', changeType);
	if (contentType) params.set('content_type', contentType);
	if (fromDate) params.set('from_date', fromDate);
	if (toDate) params.set('to_date', toDate);

	try {
		const res = await fetch(`${BASE_API_URL}/version-history/?${params.toString()}`);
		if (!res.ok) return { versions: [], count: 0, next: null, previous: null };
		const data = await res.json();
		const raw: Record<string, unknown>[] = data.results || data || [];
		return {
			versions: raw.map(toVersion),
			count: data.count || 0,
			next: data.next || null,
			previous: data.previous || null
		};
	} catch {
		return { versions: [], count: 0, next: null, previous: null };
	}
};
