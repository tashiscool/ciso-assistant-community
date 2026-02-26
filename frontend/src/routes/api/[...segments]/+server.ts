import { BASE_API_URL } from '$lib/utils/constants';
import type { RequestHandler } from './$types';

const proxy: RequestHandler = async ({ fetch, params, request, url }) => {
	const targetPath = (params.segments || '').replace(/^\/+/, '');
	const targetUrl = `${BASE_API_URL}/${targetPath}${url.search}`;
	const headers = new Headers(request.headers);
	headers.delete('host');

	const method = request.method.toUpperCase();
	const body =
		method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

	const response = await fetch(targetUrl, {
		method,
		headers,
		body
	});

	const responseHeaders = new Headers(response.headers);
	responseHeaders.set('x-proxied-by', 'frontend-api-proxy');
	return new Response(response.body, {
		status: response.status,
		headers: responseHeaders
	});
};

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
