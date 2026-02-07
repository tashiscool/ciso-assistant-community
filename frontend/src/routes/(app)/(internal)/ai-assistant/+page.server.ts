import type { PageServerLoad } from './$types';
import { BASE_API_URL } from '$lib/utils/constants';

export const load: PageServerLoad = async ({ fetch }) => {
	const frameworksResponse = await fetch(`${BASE_API_URL}/loaded-libraries/`).catch(() => null);
	let frameworks: any[] = [];
	if (frameworksResponse?.ok) {
		const data = await frameworksResponse.json();
		frameworks = (data.results || data || []).filter(
			(lib: any) => lib.library_type === 'framework'
		);
	}

	return {
		title: 'AI Assistant',
		frameworks
	};
};
