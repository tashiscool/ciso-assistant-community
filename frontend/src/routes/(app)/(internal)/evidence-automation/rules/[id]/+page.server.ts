import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';
import type { EvidenceCollectionRule } from '$lib/services/evidence-automation/api';

export const load: PageServerLoad = async ({ fetch, params }) => {
	try {
		const response = await fetch(`${BASE_API_URL}/evidence-automation/rules/${params.id}/`);
		if (!response.ok) {
			console.error('Failed to fetch rule:', response.status, response.statusText);
			return { rule: null as EvidenceCollectionRule | null };
		}
		const data = await response.json();
		const rule: EvidenceCollectionRule = data?.data ?? data;
		return { rule };
	} catch (error) {
		console.error('Error loading collection rule:', error);
		return { rule: null as EvidenceCollectionRule | null };
	}
};
