import { env as privateEnv } from '$env/dynamic/private';
import { BASE_API_URL } from '$lib/utils/constants';
import type { RequestHandler } from './$types';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PROXY_BACKEND_API_URL = privateEnv.BACKEND_API_URL || BASE_API_URL;
export const trailingSlash = 'ignore';

const proxy: RequestHandler = async ({ fetch, params, request, url, cookies }) => {
	const targetPath = (params.segments || '').replace(/^\/+/, '');
	const hasTrailingSlash = url.pathname.endsWith('/');
	const normalizedPath = targetPath
		? `${targetPath}${hasTrailingSlash && !targetPath.endsWith('/') ? '/' : ''}`
		: '';
	const targetUrl = `${PROXY_BACKEND_API_URL}${normalizedPath ? `/${normalizedPath}` : ''}${url.search}`;
	const headers = new Headers(request.headers);
	headers.delete('host');
	headers.delete('content-length');

	const token = cookies.get('token');
	const csrfToken = cookies.get('csrftoken');
	if (token && !headers.has('authorization')) {
		headers.set('authorization', `Token ${token}`);
	}

	const method = request.method.toUpperCase();
	if (UNSAFE_METHODS.has(method) && csrfToken) {
		if (!headers.has('x-csrftoken')) {
			headers.set('x-csrftoken', csrfToken);
		}
		const existingCookieHeader = headers.get('cookie') || '';
		if (!existingCookieHeader.includes('csrftoken=')) {
			headers.set(
				'cookie',
				existingCookieHeader
					? `${existingCookieHeader}; csrftoken=${csrfToken}`
					: `csrftoken=${csrfToken}`
			);
		}
	}

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
