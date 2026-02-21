import type { PageServerLoad } from './$types';
import { BASE_API_URL } from '$lib/utils/constants';
import type { EvidenceSource } from '$lib/services/evidence-automation/api';

export const load: PageServerLoad = async ({ fetch, params }) => {
	const { id } = params;

	try {
		const response = await fetch(`${BASE_API_URL}/evidence-automation/sources/${id}/`);
		if (!response.ok) {
			console.error('Failed to fetch evidence source:', response.status, response.statusText);
			return { source: null as EvidenceSource | null };
		}

		const data = await response.json();

		// Unwrap { success, data: { ... } } envelope if present
		const source: EvidenceSource = data?.data ?? data;

		return { source };
	} catch (error) {
		console.error('Error loading evidence source:', error);
		return { source: null as EvidenceSource | null };
	}
};
