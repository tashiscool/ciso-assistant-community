import type { PageServerLoad } from './$types';
import { BASE_API_URL } from '$lib/utils/constants';
import type { ArtifactPackage } from '$lib/services/assessment-artifacts/api';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const response = await fetch(`${BASE_API_URL}/assessment-artifacts/packages/`);
		if (!response.ok) {
			console.error('Failed to fetch artifact packages:', response.status);
			return { packages: [] as ArtifactPackage[] };
		}

		const data = await response.json();
		let packages: ArtifactPackage[] = [];
		if (data?.data?.results) {
			packages = data.data.results;
		} else if (data?.results) {
			packages = data.results;
		} else if (Array.isArray(data)) {
			packages = data;
		}

		return { packages };
	} catch (error) {
		console.error('Error loading artifact packages:', error);
		return { packages: [] as ArtifactPackage[] };
	}
};
