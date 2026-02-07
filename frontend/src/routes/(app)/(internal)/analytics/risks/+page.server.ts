import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, depends }) => {
	depends('app:risk-analytics');
	try {
		const risksResponse = await fetch(`${BASE_API_URL}/risk-scenarios/?limit=1000`);
		const risksData = risksResponse.ok ? await risksResponse.json() : { results: [], count: 0 };
		const riskAssessmentsResponse = await fetch(`${BASE_API_URL}/risk-assessments/?limit=1000`);
		const riskAssessmentsData = riskAssessmentsResponse.ok ? await riskAssessmentsResponse.json() : { results: [], count: 0 };

		const scenarios = risksData.results || [];
		const assessments = riskAssessmentsData.results || [];

		const analytics = {
			totalScenarios: risksData.count || 0,
			totalAssessments: riskAssessmentsData.count || 0,
			// severity distribution
			criticalScenarios: scenarios.filter((s: any) => s.current_level === 3 || s.current_level === 4).length,
			highScenarios: scenarios.filter((s: any) => s.current_level === 2).length,
			mediumScenarios: scenarios.filter((s: any) => s.current_level === 1).length,
			lowScenarios: scenarios.filter((s: any) => s.current_level === 0).length,
			// treatment status
			treatedScenarios: scenarios.filter((s: any) => s.treatment === 'mitigate' || s.treatment === 'accept').length,
			untreatedScenarios: scenarios.filter((s: any) => !s.treatment || s.treatment === 'open').length,
			recentScenarios: scenarios.slice(0, 10),
			recentAssessments: assessments.slice(0, 10),
			riskReductionRate: 0
		};

		analytics.riskReductionRate = analytics.totalScenarios > 0 ?
			Math.round((analytics.treatedScenarios / analytics.totalScenarios) * 100) : 0;

		return { title: 'Risk Analytics Dashboard', analytics };
	} catch (err) {
		console.error('Error loading risk analytics:', err);
		throw error(500, 'Failed to load risk analytics');
	}
};
