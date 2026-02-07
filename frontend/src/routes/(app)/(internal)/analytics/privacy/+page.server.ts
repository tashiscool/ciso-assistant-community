import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, depends }) => {
	depends('app:privacy-analytics');
	try {
		const processingsResponse = await fetch(`${BASE_API_URL}/processings/?limit=1000`);
		const processingsData = processingsResponse.ok ? await processingsResponse.json() : { results: [], count: 0 };
		const processings = processingsData.results || [];

		const analytics = {
			totalProcessings: processingsData.count || 0,
			activeProcessings: processings.filter((p: any) => p.status === 'active').length,
			draftProcessings: processings.filter((p: any) => p.status === 'draft').length,
			legalBasis: {} as Record<string, number>,
			recentProcessings: processings.slice(0, 10),
			complianceRate: 0
		};

		// Aggregate by legal basis
		processings.forEach((p: any) => {
			const basis = p.legal_basis || 'unknown';
			analytics.legalBasis[basis] = (analytics.legalBasis[basis] || 0) + 1;
		});

		analytics.complianceRate = analytics.totalProcessings > 0 ?
			Math.round((analytics.activeProcessings / analytics.totalProcessings) * 100) : 0;

		return { title: 'Privacy Analytics Dashboard', analytics };
	} catch (err) {
		console.error('Error loading privacy analytics:', err);
		throw error(500, 'Failed to load privacy analytics');
	}
};
