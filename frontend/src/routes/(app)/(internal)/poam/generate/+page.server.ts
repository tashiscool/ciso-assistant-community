import type { PageServerLoad } from './$types';
import { BASE_API_URL } from '$lib/utils/constants';

export const load: PageServerLoad = async ({ fetch }) => {
	// Load vulnerability findings for generation
	const findingsRes = await fetch(`${BASE_API_URL}/vulnerability-findings/`).catch(() => null);
	const findings = findingsRes?.ok
		? await findingsRes.json().then((d: any) => d.results || d || [])
		: [];

	// Load compliance assessments
	const assessmentsRes = await fetch(`${BASE_API_URL}/compliance-assessments/`).catch(() => null);
	const assessments = assessmentsRes?.ok
		? await assessmentsRes.json().then((d: any) => d.results || d || [])
		: [];

	// Load system groups
	const systemGroupsRes = await fetch(`${BASE_API_URL}/folders/`).catch(() => null);
	const systemGroups = systemGroupsRes?.ok
		? await systemGroupsRes.json().then((d: any) => d.results || d || [])
		: [];

	return {
		title: 'Generate POA&M from Findings',
		findings,
		assessments,
		systemGroups
	};
};
