import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	// Load available document types from the export API
	const documentTypes = await fetch(`${BASE_API_URL}/oscal/documents/types/`)
		.then((res) => res.json())
		.then((res) => ({
			document_types: res.document_types || [],
			format_options: res.format_options || []
		}))
		.catch(() => ({ document_types: [], format_options: [] }));

	// Load compliance assessments for the assessment selector
	const complianceAssessments = await fetch(`${BASE_API_URL}/compliance-assessments/`)
		.then((res) => res.json())
		.then((res) => res.results || [])
		.catch(() => []);

	// Load frameworks for reference
	const frameworks = await fetch(`${BASE_API_URL}/frameworks/`)
		.then((res) => res.json())
		.then((res) => res.results || [])
		.catch(() => []);

	// Load risk assessments for risk register exports
	const riskAssessments = await fetch(`${BASE_API_URL}/risk-assessments/`)
		.then((res) => res.json())
		.then((res) => res.results || [])
		.catch(() => []);

	return {
		documentTypes: documentTypes.document_types,
		formatOptions: documentTypes.format_options,
		complianceAssessments,
		frameworks,
		riskAssessments,
		title: 'Document Hub'
	};
};
