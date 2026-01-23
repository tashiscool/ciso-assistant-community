import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const [connectorsRes, registryRes] = await Promise.all([
			fetch(`${BASE_API_URL}/connectors/`),
			fetch(`${BASE_API_URL}/connectors/registry/`)
		]);

		const connectorsData = connectorsRes.ok ? await connectorsRes.json() : { results: [] };
		const registryData = registryRes.ok ? await registryRes.json() : { connectors: [] };

		return {
			connectors: connectorsData.results || connectorsData || [],
			availableConnectors: registryData.connectors || registryData || [],
		};
	} catch (error) {
		console.error('Failed to load connectors:', error);
		return {
			connectors: [],
			availableConnectors: [],
			error: 'Failed to load connectors'
		};
	}
};
