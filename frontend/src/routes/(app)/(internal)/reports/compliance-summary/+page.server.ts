import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const endpoint = `/api/compliance-assessments/`;

	try {
		const res = await fetch(endpoint);
		const assessments = res.ok ? await res.json() : { results: [] };

		return {
			assessments: assessments.results || []
		};
	} catch (e) {
		return { assessments: [] };
	}
};
