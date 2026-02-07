import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		// Load available questionnaire templates
		const templatesResponse = await fetch(
			`${BASE_API_URL}/questionnaires/vendor-templates/`
		);
		const templates = templatesResponse.ok ? await templatesResponse.json() : [];

		// Load vendor entities for the entity selector
		const entitiesResponse = await fetch(`${BASE_API_URL}/entities/?limit=200`);
		const entitiesData = entitiesResponse.ok ? await entitiesResponse.json() : { results: [] };
		const entities = entitiesData.results || [];

		// Load existing questionnaire runs (pending and completed)
		const runsResponse = await fetch(`${BASE_API_URL}/questionnaires/runs/?limit=100`);
		const runsData = runsResponse.ok ? await runsResponse.json() : { results: [] };
		const runs = runsData.results || [];

		// Load entity assessments for context
		const assessmentsResponse = await fetch(
			`${BASE_API_URL}/entity-assessments/?limit=100`
		);
		const assessmentsData = assessmentsResponse.ok
			? await assessmentsResponse.json()
			: { results: [] };
		const entityAssessments = assessmentsData.results || [];

		// Categorize runs by status
		const pendingRuns = runs.filter(
			(r: any) => r.status === 'in_progress'
		);
		const completedRuns = runs.filter(
			(r: any) => r.status === 'completed'
		);
		const abandonedRuns = runs.filter(
			(r: any) => r.status === 'abandoned' || r.status === 'expired'
		);

		// Pre-built template definitions for client-side display
		// (in case the API endpoint for templates is not yet wired up)
		const fallbackTemplates = [
			{
				id: 'soc2',
				name: 'SOC 2 Type II Vendor Assessment',
				framework: 'soc2',
				description:
					'Comprehensive vendor assessment based on SOC 2 Trust Services Criteria covering Security, Availability, Processing Integrity, Confidentiality, and Privacy.',
				total_questions: 27,
				categories: 5,
				estimated_duration_minutes: 90
			},
			{
				id: 'iso27001',
				name: 'ISO 27001 Vendor Assessment',
				framework: 'iso27001',
				description:
					'Vendor security assessment aligned with ISO/IEC 27001:2022 Annex A controls for information security management.',
				total_questions: 26,
				categories: 5,
				estimated_duration_minutes: 75
			},
			{
				id: 'nist_csf',
				name: 'NIST Cybersecurity Framework Vendor Assessment',
				framework: 'nist_csf',
				description:
					'Vendor assessment based on the NIST Cybersecurity Framework (CSF) 2.0 core functions: Govern, Identify, Protect, Detect, Respond, and Recover.',
				total_questions: 30,
				categories: 6,
				estimated_duration_minutes: 80
			},
			{
				id: 'sig_lite',
				name: 'SIG Lite Vendor Assessment',
				framework: 'sig_lite',
				description:
					'Standardized Information Gathering (SIG) Lite questionnaire for third-party risk assessment, covering key domains of enterprise security governance.',
				total_questions: 30,
				categories: 6,
				estimated_duration_minutes: 60
			}
		];

		const displayTemplates =
			Array.isArray(templates) && templates.length > 0 ? templates : fallbackTemplates;

		return {
			title: 'Vendor Questionnaire Management',
			templates: displayTemplates,
			entities,
			pendingRuns,
			completedRuns,
			abandonedRuns,
			entityAssessments,
			totalRuns: runs.length
		};
	} catch (err) {
		console.error('Error loading vendor questionnaire data:', err);
		throw error(500, 'Failed to load vendor questionnaire management page');
	}
};
