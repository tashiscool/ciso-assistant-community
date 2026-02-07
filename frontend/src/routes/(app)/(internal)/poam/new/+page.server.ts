import type { PageServerLoad } from './$types';
import { BASE_API_URL } from '$lib/utils/constants';

export const load: PageServerLoad = async ({ fetch }) => {
	// Load system groups for the dropdown
	const systemGroupsRes = await fetch(`${BASE_API_URL}/folders/`).catch(() => null);
	const systemGroups = systemGroupsRes?.ok
		? await systemGroupsRes.json().then((d: any) => d.results || d || [])
		: [];

	// Load compliance assessments for association
	const assessmentsRes = await fetch(`${BASE_API_URL}/compliance-assessments/`).catch(() => null);
	const assessments = assessmentsRes?.ok
		? await assessmentsRes.json().then((d: any) => d.results || d || [])
		: [];

	return {
		title: 'New POA&M Item',
		systemGroups,
		assessments
	};
};
