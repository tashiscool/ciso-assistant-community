import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';

function toAssessment(a: Record<string, unknown>) {
	return {
		id: a.id,
		name: a.name,
		description: a.description,
		status: a.status,
		scoringMethod: a.scoring_method,
		totalControls: a.total_controls,
		testedControls: a.tested_controls,
		passedControls: a.passed_controls,
		failedControls: a.failed_controls,
		complianceScore: a.compliance_score,
		progressPercentage: a.progress_percentage,
		startedAt: a.started_at,
		completedAt: a.completed_at,
		targetCompletion: a.target_completion,
		createdAt: a.created_at
	};
}

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const res = await fetch(`${BASE_API_URL}/assessments/lightning/`);
		if (!res.ok) return { assessments: [] };
		const data = await res.json();
		const raw: Record<string, unknown>[] = data.results || data || [];
		return { assessments: raw.map(toAssessment) };
	} catch {
		return { assessments: [] };
	}
};
