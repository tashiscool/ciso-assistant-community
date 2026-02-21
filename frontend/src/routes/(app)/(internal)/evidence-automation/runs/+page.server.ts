import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';
import type { EvidenceCollectionRun } from '$lib/services/evidence-automation/api';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const response = await fetch(`${BASE_API_URL}/evidence-automation/runs/`);
		if (!response.ok) {
			console.error('Failed to fetch runs:', response.status, response.statusText);
			return { runs: [] as EvidenceCollectionRun[] };
		}
		const data = await response.json();
		const runs: EvidenceCollectionRun[] = data?.results ?? data ?? [];
		return { runs };
	} catch (error) {
		console.error('Error loading collection runs:', error);
		return { runs: [] as EvidenceCollectionRun[] };
	}
};
