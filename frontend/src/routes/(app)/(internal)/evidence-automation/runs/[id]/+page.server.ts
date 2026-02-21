import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';
import type { EvidenceCollectionRun } from '$lib/services/evidence-automation/api';

export const load: PageServerLoad = async ({ fetch, params }) => {
	try {
		const response = await fetch(`${BASE_API_URL}/evidence-automation/runs/${params.id}/`);
		if (!response.ok) {
			console.error('Failed to fetch run:', response.status, response.statusText);
			return { run: null as EvidenceCollectionRun | null };
		}
		const data = await response.json();
		const run: EvidenceCollectionRun = data?.data ?? data;
		return { run };
	} catch (error) {
		console.error('Error loading collection run:', error);
		return { run: null as EvidenceCollectionRun | null };
	}
};
