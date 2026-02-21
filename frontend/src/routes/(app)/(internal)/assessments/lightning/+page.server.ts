import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const res = await fetch(`${BASE_API_URL}/assessments/lightning/`);
		if (!res.ok) return { assessments: [] };
		const data = await res.json();
		return {
			assessments: data.results || data || []
		};
	} catch {
		return { assessments: [] };
	}
};
