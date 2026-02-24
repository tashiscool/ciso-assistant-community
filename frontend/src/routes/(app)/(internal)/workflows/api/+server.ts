import { BASE_API_URL } from '$lib/utils/constants';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ fetch, request }) => {
	const endpoint = `${BASE_API_URL}/workflows/`;
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
