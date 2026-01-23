import { BASE_API_URL } from '$lib/utils/constants';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	// Fetch available frameworks for ConMon setup
	const frameworksResponse = await fetch(`${BASE_API_URL}/frameworks/?urn__icontains=conmon`);
	const frameworksData = await frameworksResponse.json();

	// Fetch folders for profile placement
	const foldersResponse = await fetch(`${BASE_API_URL}/folders/?content_type=DO`);
	const foldersData = await foldersResponse.json();

	return {
		frameworks: frameworksData.results || frameworksData || [],
		folders: foldersData.results || foldersData || []
	};
};

export const actions: Actions = {
	default: async ({ request, fetch }) => {
		const formData = await request.formData();

		const data = {
			framework_urn: formData.get('framework_urn'),
			profile_name: formData.get('profile_name'),
			profile_type: formData.get('profile_type'),
			implementation_groups: formData.getAll('implementation_groups'),
			generate_tasks: formData.get('generate_tasks') === 'on'
		};

		const response = await fetch(`${BASE_API_URL}/conmon/profiles/setup/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			const errorData = await response.json();
			return fail(400, {
				error: errorData.errors || errorData.error || 'Failed to create ConMon profile',
				data
			});
		}

		const result = await response.json();

		// Redirect to the new profile
		throw redirect(303, `/conmon-profiles/${result.profile_id}`);
	}
};
