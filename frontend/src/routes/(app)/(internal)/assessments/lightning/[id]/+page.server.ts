import { BASE_API_URL } from '$lib/utils/constants';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params }) => {
	try {
		const res = await fetch(`${BASE_API_URL}/assessments/lightning/${params.id}/`);
		if (res.status === 404) throw error(404, 'Assessment not found');
		if (!res.ok) throw error(500, 'Failed to load assessment');
		const assessment = await res.json();
		return { assessment };
	} catch (e) {
		if ((e as { status?: number }).status) throw e;
		throw error(500, 'Failed to load assessment');
	}
};
