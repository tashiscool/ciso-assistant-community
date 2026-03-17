import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';

type JsonValue = Record<string, unknown> | unknown[] | null;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function safeJson(response: Response): Promise<JsonValue> {
	try {
		return await response.json();
	} catch {
		return null;
	}
}

function listFromPayload(payload: JsonValue): Record<string, unknown>[] {
	if (Array.isArray(payload)) {
		return payload.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
	}
	if (payload && typeof payload === 'object' && Array.isArray((payload as { results?: unknown[] }).results)) {
		return (payload as { results: unknown[] }).results.filter(
			(item): item is Record<string, unknown> => typeof item === 'object' && item !== null
		);
	}
	return [];
}

export const load: PageServerLoad = async ({ fetch, url }) => {
	const requestedProfileId = url.searchParams.get('profile') || '';

	// Fetch profiles for selection
	const profilesResponse = await fetch(`${BASE_API_URL}/conmon/profiles/`);
	const profilesPayload = await safeJson(profilesResponse);
	const profiles = listFromPayload(profilesPayload);
	const selectedProfileId =
		(profiles.some((profile) => profile.id === requestedProfileId) ||
			UUID_RE.test(requestedProfileId)) &&
		requestedProfileId
			? requestedProfileId
			: '';
	const profileQuery = selectedProfileId ? `?profile=${encodeURIComponent(selectedProfileId)}` : '';

	// Fetch dashboard data (all profiles when no profile is selected)
	const dashboardResponse = await fetch(`${BASE_API_URL}/conmon/dashboard/${profileQuery}`);

	// Fetch upcoming executions
	const upcomingResponse = await fetch(
		`${BASE_API_URL}/conmon/executions/upcoming/?days=14${selectedProfileId ? `&profile=${encodeURIComponent(selectedProfileId)}` : ''}`
	);

	// Fetch overdue executions
	const overdueResponse = await fetch(
		`${BASE_API_URL}/conmon/executions/overdue/${selectedProfileId ? `?profile=${encodeURIComponent(selectedProfileId)}` : ''}`
	);

	const [dashboardPayload, upcomingPayload, overduePayload] = await Promise.all([
		safeJson(dashboardResponse),
		safeJson(upcomingResponse),
		safeJson(overdueResponse)
	]);

	let operationalRollup: JsonValue = null;
	if (selectedProfileId) {
		const rollupResponse = await fetch(
			`${BASE_API_URL}/conmon/profiles/${selectedProfileId}/operational_rollup/`
		);
		operationalRollup = rollupResponse.ok ? await safeJson(rollupResponse) : null;
	}

	return {
		selectedProfileId,
		profiles,
		dashboard: dashboardPayload,
		upcoming: listFromPayload(upcomingPayload),
		overdue: listFromPayload(overduePayload),
		operationalRollup
	};
};
