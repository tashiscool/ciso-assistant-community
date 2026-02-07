import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	// Load available plans for the select dropdown
	const plansResponse = await fetch(`${BASE_API_URL}/business-continuity/bcp-plans/?limit=1000`);
	const plansData = plansResponse.ok ? await plansResponse.json() : { results: [] };

	return {
		title: 'Schedule BCP Test',
		plans: plansData.results || []
	};
};

export const actions: Actions = {
	default: async ({ request, fetch }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const bcpId = formData.get('bcp_id') as string;

		const response = await fetch(`${BASE_API_URL}/business-continuity/bcp-audits/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, description, bcpId })
		});

		if (response.ok) {
			throw redirect(303, '/business-continuity/tests');
		}

		return { error: 'Failed to schedule test' };
	}
};
