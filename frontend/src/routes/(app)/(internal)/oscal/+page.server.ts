import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async ({ fetch }) => {
	// Load available compliance assessments for export
	const complianceAssessments = await fetch(`${BASE_API_URL}/compliance-assessments/`)
		.then((res) => res.json())
		.then((res) => res.results || [])
		.catch(() => []);

	// Load available frameworks for export as catalogs
	const frameworks = await fetch(`${BASE_API_URL}/frameworks/`)
		.then((res) => res.json())
		.then((res) => res.results || [])
		.catch(() => []);

	// Load available risk assessments for export
	const riskAssessments = await fetch(`${BASE_API_URL}/risk-assessments/`)
		.then((res) => res.json())
		.then((res) => res.results || [])
		.catch(() => []);

	return {
		complianceAssessments,
		frameworks,
		riskAssessments,
		title: m.oscalImportExport()
	};
};
