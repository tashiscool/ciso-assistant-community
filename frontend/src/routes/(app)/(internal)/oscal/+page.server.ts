import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';
import * as m from '$paraglide/messages';

const DEFAULT_OSCAL_EXPORT_FRAMEWORKS = [
	{ id: 'framework-fedramp-moderate', name: 'FedRAMP Moderate Baseline' },
	{ id: 'framework-nist-csf-1-1', name: 'NIST CSF v1.1' }
];

const DEFAULT_OSCAL_EXPORT_ASSESSMENTS = [
	{ id: 'assessment-fedramp-moderate', name: 'FedRAMP Moderate Assessment' }
];

const DEFAULT_OSCAL_EXPORT_POAMS = [
	{ id: 'risk-assessment-fedramp-poam', name: 'FedRAMP POA&M Baseline' }
];

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
		complianceAssessments:
			complianceAssessments.length > 0
				? complianceAssessments
				: DEFAULT_OSCAL_EXPORT_ASSESSMENTS,
		frameworks:
			frameworks.length > 0 ? frameworks : DEFAULT_OSCAL_EXPORT_FRAMEWORKS,
		riskAssessments:
			riskAssessments.length > 0 ? riskAssessments : DEFAULT_OSCAL_EXPORT_POAMS,
		title: m.oscalImportExport()
	};
};
