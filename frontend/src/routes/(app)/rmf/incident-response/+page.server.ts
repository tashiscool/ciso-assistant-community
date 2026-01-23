import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
	const csoId = url.searchParams.get('cso_id');
	const openOnly = url.searchParams.get('open_only') !== 'false';

	let params = new URLSearchParams();
	if (csoId) params.set('cso_id', csoId);
	if (openOnly) params.set('open_only', 'true');
	const queryString = params.toString() ? `?${params.toString()}` : '';

	try {
		const [dashboardRes, listRes] = await Promise.all([
			fetch(`${BASE_API_URL}/rmf/incident-response/dashboard/${csoId ? `?cso_id=${csoId}` : ''}`),
			fetch(`${BASE_API_URL}/rmf/incidents/${queryString}`)
		]);

		const dashboardData = dashboardRes.ok ? await dashboardRes.json() : { success: false };
		const listData = listRes.ok ? await listRes.json() : { success: false, data: [] };

		return {
			dashboard: dashboardData.success ? dashboardData.data : null,
			incidents: listData.success ? listData.data : [],
			csoId,
			openOnly
		};
	} catch (error) {
		console.error('Failed to load incident response data:', error);
		return {
			dashboard: null,
			incidents: [],
			csoId,
			openOnly,
			error: 'Failed to load data'
		};
	}
};
