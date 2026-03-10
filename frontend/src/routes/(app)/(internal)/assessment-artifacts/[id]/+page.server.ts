import type { PageServerLoad } from './$types';
import { BASE_API_URL } from '$lib/utils/constants';
import type { ArtifactPackageDetail } from '$lib/services/assessment-artifacts/api';

export const load: PageServerLoad = async ({ fetch, params }) => {
	try {
		const response = await fetch(`${BASE_API_URL}/assessment-artifacts/packages/${params.id}/`);
		if (!response.ok) {
			console.error('Failed to fetch artifact package:', response.status);
			return { package: null };
		}

		const data = await response.json();
		const pkg: ArtifactPackageDetail = data?.data ?? data;
		return { package: pkg };
	} catch (error) {
		console.error('Error loading artifact package:', error);
		return { package: null };
	}
};
