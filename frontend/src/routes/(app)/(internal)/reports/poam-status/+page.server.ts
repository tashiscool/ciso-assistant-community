import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const endpoint = `/api/poam-items/`;

	try {
		const res = await fetch(endpoint);
		const items = res.ok ? await res.json() : { results: [] };

		let overdueRes;
		try {
			overdueRes = await fetch(`/api/poam-items/overdue/`);
		} catch {
			overdueRes = null;
		}
		const overdueItems = overdueRes?.ok ? await overdueRes.json() : [];

		return {
			items: items.results || items || [],
			overdueItems: Array.isArray(overdueItems) ? overdueItems : overdueItems.results || []
		};
	} catch (e) {
		return { items: [], overdueItems: [] };
	}
};
