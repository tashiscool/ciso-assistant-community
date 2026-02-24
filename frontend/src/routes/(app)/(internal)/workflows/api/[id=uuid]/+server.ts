import { BASE_API_URL } from '$lib/utils/constants';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ fetch, params }) => {
	const endpoint = `${BASE_API_URL}/workflows/${params.id}/`;
	const response = await fetch(endpoint, { method: 'DELETE' });

	if (response.status === 204) {
		return new Response(null, { status: response.status });
	}

	const contentType = response.headers.get('content-type') || 'application/json';
	const responseBody = await response.text();

	return new Response(responseBody || null, {
		status: response.status,
		headers: { 'Content-Type': contentType }
	});
};
