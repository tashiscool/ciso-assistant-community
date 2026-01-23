import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
	const csoId = url.searchParams.get('cso_id');
	const params = csoId ? `?cso_id=${csoId}` : '';

	try {
		const [dashboardRes, listRes] = await Promise.all([
			fetch(`${BASE_API_URL}/rmf/change-control/dashboard/${params}`),
			fetch(`${BASE_API_URL}/rmf/change-requests/${params}`)
		]);

		const dashboardData = dashboardRes.ok ? await dashboardRes.json() : { success: false };
		const listData = listRes.ok ? await listRes.json() : { success: false, data: [] };

		return {
			dashboard: dashboardData.success ? dashboardData.data : null,
			changeRequests: listData.success ? listData.data : [],
			csoId
		};
	} catch (error) {
		console.error('Failed to load change control data:', error);
		return {
			dashboard: null,
			changeRequests: [],
			csoId,
			error: 'Failed to load data'
		};
	}
};
