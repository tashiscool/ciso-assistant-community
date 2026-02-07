import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, url, depends }) => {
	depends('app:bcp-plans');

	try {
		const status = url.searchParams.get('status');
		const impact = url.searchParams.get('impact');

		let endpoint = `${BASE_API_URL}/business-continuity/bcp-plans/?limit=1000`;
		if (status) endpoint += `&status=${status}`;
		if (impact) endpoint += `&business_impact=${impact}`;

		const response = await fetch(endpoint);
		const data = response.ok ? await response.json() : { results: [], count: 0 };

		return {
			title: 'Business Continuity Plans',
			plans: data.results || [],
			count: data.count || 0,
			filters: { status, impact }
		};
	} catch (err) {
		console.error('Error loading BCP plans:', err);
		throw error(500, 'Failed to load BCP plans');
	}
};
