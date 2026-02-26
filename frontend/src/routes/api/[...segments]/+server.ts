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
	const incomingContentType = headers.get('content-type') || '';
	const hasRequestBody = method !== 'GET' && method !== 'HEAD';
	const isMultipartRequest = incomingContentType.startsWith('multipart/form-data');
	const shouldForceJsonContentType =
		hasRequestBody &&
		!isMultipartRequest &&
		(!incomingContentType || incomingContentType.startsWith('text/plain'));

	// Some client-side create flows send JSON strings without explicitly setting content type.
	// Normalize those requests so DRF parsers don't reject them as text/plain.
	if (shouldForceJsonContentType) {
		headers.set('content-type', 'application/json');
	}
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

	const body = hasRequestBody ? await request.arrayBuffer() : undefined;

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
