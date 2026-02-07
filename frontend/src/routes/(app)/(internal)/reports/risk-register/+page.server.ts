import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const endpoint = `/api/risk-scenarios/`;

	try {
		const res = await fetch(endpoint);
		const scenarios = res.ok ? await res.json() : { results: [] };

		return {
			scenarios: scenarios.results || []
		};
	} catch (e) {
		return { scenarios: [] };
	}
};
