import type { PageServerLoad } from './$types';
import { BASE_API_URL } from '$lib/utils/constants';
import type { EvidenceSource } from '$lib/services/evidence-automation/api';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const response = await fetch(`${BASE_API_URL}/evidence-automation/sources/`);
		if (!response.ok) {
			console.error('Failed to fetch evidence sources:', response.status, response.statusText);
			return { sources: [] as EvidenceSource[] };
		}

		const data = await response.json();

		// Handle both envelope { success, data: { results } } and plain { results }
		let sources: EvidenceSource[] = [];
		if (data?.data?.results) {
			sources = data.data.results;
		} else if (data?.results) {
			sources = data.results;
		} else if (Array.isArray(data)) {
			sources = data;
		}

		return { sources };
	} catch (error) {
		console.error('Error loading evidence sources:', error);
		return { sources: [] as EvidenceSource[] };
	}
};
