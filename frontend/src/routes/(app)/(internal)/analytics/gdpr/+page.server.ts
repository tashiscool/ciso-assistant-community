import { BASE_API_URL } from '$lib/utils/constants';

import type { PageServerLoad } from './$types';
import * as m from '$paraglide/messages';

export const load = (async ({ fetch }) => {
	const endpoint = `${BASE_API_URL}/privacy/processings/agg_metrics/`;

	try {
		const res = await fetch(endpoint);
		const data = res.ok ? await res.json() : {};

		return { data, title: m.overview() };
	} catch (err) {
		console.error('Error loading GDPR analytics:', err);
		return { data: {}, title: m.overview() };
	}
}) satisfies PageServerLoad;
