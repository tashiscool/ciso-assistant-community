import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';

function toVersion(v: Record<string, unknown>) {
	return {
		id: v.id,
		versionNumber: v.version_number,
		versionLabel: v.version_label,
		changeType: v.change_type,
		changeSummary: v.change_summary,
		changedFields: v.changed_fields,
		snapshotData: v.snapshot_data,
		createdAt: v.created_at,
		createdByName: v.created_by_name
	};
}

export const load: PageServerLoad = async ({ fetch, url }) => {
	const page = url.searchParams.get('page') || '1';
	try {
		const res = await fetch(`${BASE_API_URL}/version-history/?page=${page}`);
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
