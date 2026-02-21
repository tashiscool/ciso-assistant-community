import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';
import type { EvidenceCollectionRule } from '$lib/services/evidence-automation/api';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const response = await fetch(`${BASE_API_URL}/evidence-automation/rules/`);
		if (!response.ok) {
			console.error('Failed to fetch rules:', response.status, response.statusText);
			return { rules: [] as EvidenceCollectionRule[] };
		}
		const data = await response.json();
		const rules: EvidenceCollectionRule[] = data?.results ?? data ?? [];
		return { rules };
	} catch (error) {
		console.error('Error loading collection rules:', error);
		return { rules: [] as EvidenceCollectionRule[] };
	}
};
