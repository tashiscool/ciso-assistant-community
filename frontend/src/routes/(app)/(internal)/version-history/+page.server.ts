import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
	const page = url.searchParams.get('page') || '1';
	try {
		const res = await fetch(`${BASE_API_URL}/version-history/?page=${page}`);
		if (!res.ok) return { versions: [], count: 0, next: null, previous: null };
		const data = await res.json();
		return {
			versions: data.results || data || [],
			count: data.count || 0,
			next: data.next || null,
			previous: data.previous || null
		};
	} catch {
		return { versions: [], count: 0, next: null, previous: null };
	}
};
