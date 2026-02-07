import type { PageServerLoad } from './$types';
import { BASE_API_URL } from '$lib/utils/constants';

export const load: PageServerLoad = async ({ fetch, url }) => {
	const status = url.searchParams.get('status') || '';
	const riskLevel = url.searchParams.get('risk_level') || '';
	const search = url.searchParams.get('search') || '';
	const ordering = url.searchParams.get('ordering') || '-created_at';

	const params = new URLSearchParams();
	if (status) params.set('status', status);
	if (riskLevel) params.set('risk_level', riskLevel);
	if (search) params.set('search', search);
	params.set('ordering', ordering);

	const response = await fetch(`${BASE_API_URL}/poam-items/?${params.toString()}`);
	const data = response.ok ? await response.json() : { results: [] };

	const overdueResponse = await fetch(`${BASE_API_URL}/poam-items/overdue/`);
	const overdueData = overdueResponse.ok ? await overdueResponse.json() : [];

	return {
		title: 'POA&M Management',
		items: data.results || data || [],
		totalCount: data.count || (data.results || data || []).length,
		overdueCount: Array.isArray(overdueData) ? overdueData.length : (overdueData.results || []).length,
		filters: { status, riskLevel, search, ordering }
	};
};
