import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, depends }) => {
	depends('app:bcp-tests');

	try {
		const response = await fetch(`${BASE_API_URL}/business-continuity/bcp-audits/?limit=1000`);
		const data = response.ok ? await response.json() : { results: [], count: 0 };

		return {
			title: 'BCP Tests & Exercises',
			audits: data.results || [],
			count: data.count || 0
		};
	} catch (err) {
		console.error('Error loading BCP tests:', err);
		throw error(500, 'Failed to load BCP tests');
	}
};
