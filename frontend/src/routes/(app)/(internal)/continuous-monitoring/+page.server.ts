import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	// Fetch profiles for selection
	const profilesResponse = await fetch(`${BASE_API_URL}/conmon/profiles/`);
	const profilesData = await profilesResponse.json();

	// Fetch dashboard data (all profiles if none selected)
	const dashboardResponse = await fetch(`${BASE_API_URL}/conmon/dashboard/`);
	const dashboardData = await dashboardResponse.json();

	// Fetch upcoming executions
	const upcomingResponse = await fetch(`${BASE_API_URL}/conmon/executions/upcoming/?days=14`);
	const upcomingData = await upcomingResponse.json();

	// Fetch overdue executions
	const overdueResponse = await fetch(`${BASE_API_URL}/conmon/executions/overdue/`);
	const overdueData = await overdueResponse.json();

	return {
		profiles: profilesData.results || profilesData || [],
		dashboard: dashboardData,
		upcoming: upcomingData.results || upcomingData || [],
		overdue: overdueData.results || overdueData || []
	};
};
