import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, params, depends }) => {
	depends('app:bcp-plan-detail');

	try {
		const response = await fetch(`${BASE_API_URL}/business-continuity/bcp-plans/${params.id}/`);
		if (!response.ok) {
			throw error(response.status, 'Plan not found');
		}
		const plan = await response.json();

		// Load tasks for this plan
		const tasksResponse = await fetch(`${BASE_API_URL}/business-continuity/bcp-tasks/?bcp_id=${params.id}&limit=100`);
		const tasksData = tasksResponse.ok ? await tasksResponse.json() : { results: [] };

		// Load audits for this plan
		const auditsResponse = await fetch(`${BASE_API_URL}/business-continuity/bcp-audits/?bcp_id=${params.id}&limit=100`);
		const auditsData = auditsResponse.ok ? await auditsResponse.json() : { results: [] };

		return {
			title: plan.plan_name || plan.name || 'BCP Plan',
			plan,
			tasks: tasksData.results || [],
			audits: auditsData.results || []
		};
	} catch (err: any) {
		if (err.status) throw err;
		console.error('Error loading BCP plan:', err);
		throw error(500, 'Failed to load BCP plan');
	}
};
