import type { PageServerLoad } from './$types';
import { BASE_API_URL } from '$lib/utils/constants';

export const load: PageServerLoad = async ({ fetch, params }) => {
	const response = await fetch(`${BASE_API_URL}/poam-items/${params.id}/`);
	const item = response.ok ? await response.json() : null;

	return {
		title: item ? `POA&M: ${item.weakness_id}` : 'POA&M Item',
		item
	};
};
