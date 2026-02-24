import { BASE_API_URL } from '$lib/utils/constants';
import type { RequestHandler } from './$types';

const SUPPORTED_ACTIONS = new Set(['activate', 'deactivate', 'execute']);

export const POST: RequestHandler = async ({ fetch, params, request }) => {
	if (!SUPPORTED_ACTIONS.has(params.action)) {
		return new Response(JSON.stringify({ detail: 'Unsupported workflow action' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const endpoint = `${BASE_API_URL}/workflows/${params.id}/${params.action}/`;
	const body = await request.text();
	const response = await fetch(endpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: body || undefined
	});

	const contentType = response.headers.get('content-type') || 'application/json';
	const responseBody = await response.text();

	return new Response(responseBody || null, {
		status: response.status,
		headers: { 'Content-Type': contentType }
	});
};
