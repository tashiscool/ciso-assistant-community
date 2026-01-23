import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const workflowsRes = await fetch(`${BASE_API_URL}/workflows/`);
		const workflowsData = workflowsRes.ok ? await workflowsRes.json() : [];

		return {
			workflows: Array.isArray(workflowsData) ? workflowsData : workflowsData.results || [],
		};
	} catch (error) {
		console.error('Failed to load workflows:', error);
		return {
			workflows: [],
			error: 'Failed to load workflows'
		};
	}
};
