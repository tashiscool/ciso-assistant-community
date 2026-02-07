import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const res = await fetch('/api/entity-assessments/');
		const assessments = res.ok ? await res.json() : { results: [] };

		return {
			assessments: assessments.results || []
		};
	} catch (e) {
		return { assessments: [] };
	}
};
