import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const load: PageServerLoad = async () => {
	return {
		title: 'Create BCP Plan'
	};
};

export const actions: Actions = {
	default: async ({ request, fetch }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;

		const response = await fetch(`${BASE_API_URL}/business-continuity/bcp-plans/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, description })
		});

		if (response.ok) {
			const plan = await response.json();
			throw redirect(303, `/business-continuity/plans/${plan.id}`);
		}

		return { error: 'Failed to create plan' };
	}
};
