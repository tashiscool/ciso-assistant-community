import type { PageServerLoad, Actions } from './$types';
import { BASE_API_URL } from '$lib/utils/constants';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, params }) => {
	const response = await fetch(`${BASE_API_URL}/poam-items/${params.id}/`);
	const item = response.ok ? await response.json() : null;

	if (!item) {
		return {
			title: 'Deviation Request - POA&M Item Not Found',
			item: null,
			error: 'POA&M item not found'
		};
	}

	// Fetch existing deviation requests for this item
	let deviationRequests: any[] = [];
	try {
		const devResponse = await fetch(
			`${BASE_API_URL}/poam-items/${params.id}/deviation_requests/`
		);
		if (devResponse.ok) {
			const devData = await devResponse.json();
			deviationRequests = devData.results || devData || [];
		}
	} catch {
		// Deviation requests endpoint may not exist yet; that is acceptable
	}

	return {
		title: `Deviation Request - ${item.weakness_id}`,
		item,
		deviationRequests
	};
};

export const actions: Actions = {
	default: async ({ request, fetch, params }) => {
		const formData = await request.formData();

		const deviationType = formData.get('deviation_type') as string;
		const justification = formData.get('justification') as string;
		const compensatingControls = formData.get('compensating_controls') as string;
		const riskAssessment = formData.get('risk_assessment') as string;
		const expirationDate = formData.get('expiration_date') as string;

		// Validate required fields
		if (!deviationType) {
			return fail(400, {
				error: 'Deviation type is required',
				deviationType,
				justification,
				compensatingControls,
				riskAssessment,
				expirationDate
			});
		}

		if (!justification || justification.trim().length === 0) {
			return fail(400, {
				error: 'Justification is required',
				deviationType,
				justification,
				compensatingControls,
				riskAssessment,
				expirationDate
			});
		}

		if (deviationType === 'compensating_control' && (!compensatingControls || compensatingControls.trim().length === 0)) {
			return fail(400, {
				error: 'Compensating controls description is required when deviation type is Compensating Control',
				deviationType,
				justification,
				compensatingControls,
				riskAssessment,
				expirationDate
			});
		}

		// Submit the deviation request to the API
		// First, try the dedicated deviation request endpoint
		try {
			const payload: Record<string, any> = {
				deviation_type: deviationType,
				justification: justification.trim(),
				compensating_controls: compensatingControls?.trim() || '',
				risk_assessment: riskAssessment?.trim() || '',
				status: 'submitted'
			};

			if (expirationDate) {
				payload.expiration_date = expirationDate;
			}

			const response = await fetch(
				`${BASE_API_URL}/poam-items/${params.id}/request_deviation/`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				}
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.error || errorData.detail || 'Failed to submit deviation request',
					deviationType,
					justification,
					compensatingControls,
					riskAssessment,
					expirationDate
				});
			}
		} catch (e: any) {
			return fail(500, {
				error: e.message || 'An unexpected error occurred',
				deviationType,
				justification,
				compensatingControls,
				riskAssessment,
				expirationDate
			});
		}

		redirect(303, `/poam/${params.id}`);
	}
};
