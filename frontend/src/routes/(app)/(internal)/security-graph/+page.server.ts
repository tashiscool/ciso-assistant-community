import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params }) => {
	const endpoint = `${BASE_API_URL}/security-graph/?format=vis`;

	try {
		const response = await fetch(endpoint);
		if (response.ok) {
			const graphData = await response.json();
			return {
				graphData,
				title: 'Security Graph'
			};
		}
	} catch (error) {
		console.error('Error loading security graph:', error);
	}

	return {
		graphData: { nodes: [], edges: [] },
		title: 'Security Graph'
	};
};
