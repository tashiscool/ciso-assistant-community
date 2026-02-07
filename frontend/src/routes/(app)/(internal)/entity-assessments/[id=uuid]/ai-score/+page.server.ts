import { BASE_API_URL } from '$lib/utils/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const assessmentId = params.id;

	// Load the entity assessment details
	const assessmentRes = await fetch(`${BASE_API_URL}/entity-assessments/${assessmentId}/`);
	let assessment = null;
	if (assessmentRes.ok) {
		assessment = await assessmentRes.json();
	}

	return {
		assessmentId,
		assessment
	};
};

export const actions = {
	score: async ({ request, fetch, params }) => {
		const assessmentId = params.id;
		const formData = await request.formData();
		const responsesRaw = formData.get('questionnaire_responses');

		let questionnaire_responses = null;
		if (responsesRaw && typeof responsesRaw === 'string') {
			try {
				questionnaire_responses = JSON.parse(responsesRaw);
			} catch {
				// Will use DB-loaded responses
			}
		}

		const body: Record<string, unknown> = {};
		if (questionnaire_responses) {
			body.questionnaire_responses = questionnaire_responses;
		}

		const endpoint = `${BASE_API_URL}/ai/vendor-scoring/${assessmentId}/`;
		const res = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			const errorData = await res.json().catch(() => ({ error: 'Scoring request failed' }));
			return {
				success: false,
				error: errorData.error || 'Failed to score vendor assessment'
			};
		}

		const data = await res.json();
		return {
			success: true,
			scoreData: data.data
		};
	}
};
