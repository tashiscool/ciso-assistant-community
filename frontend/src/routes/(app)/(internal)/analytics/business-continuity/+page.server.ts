import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, depends }) => {
	depends('app:bcp-analytics');
	try {
		const plansResponse = await fetch(`${BASE_API_URL}/business-continuity/bcp-plans/?limit=1000`);
		const plansData = plansResponse.ok ? await plansResponse.json() : { results: [], count: 0 };
		const plans = plansData.results || [];

		const analytics = {
			totalPlans: plansData.count || 0,
			activePlans: plans.filter((p: any) => p.status === 'active' || p.lifecycle_state === 'approved').length,
			draftPlans: plans.filter((p: any) => p.status === 'draft' || p.lifecycle_state === 'draft').length,
			expiredPlans: plans.filter((p: any) => p.status === 'expired' || p.lifecycle_state === 'retired').length,
			testedPlans: plans.filter((p: any) => p.last_test_date || p.lifecycle_state === 'exercised').length,
			untestedPlans: plans.filter((p: any) => !p.last_test_date && p.lifecycle_state !== 'exercised').length,
			recentPlans: plans.slice(0, 10),
			testCoverageRate: 0
		};

		analytics.testCoverageRate = analytics.totalPlans > 0 ?
			Math.round((analytics.testedPlans / analytics.totalPlans) * 100) : 0;

		return { title: 'Business Continuity Analytics', analytics };
	} catch (err) {
		console.error('Error loading BCP analytics:', err);
		throw error(500, 'Failed to load BCP analytics');
	}
};
