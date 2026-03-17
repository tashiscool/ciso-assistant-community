import { env as privateEnv } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const DEFAULT_EDGE_API_BASE = 'http://127.0.0.1:8787/api/v2';

function resolveEdgeApiBaseUrl(): string {
	const raw =
		privateEnv.CLOUDFLARE_EDGE_API_URL || privateEnv.CLOUDFLARE_API_URL || privateEnv.BACKEND_API_URL || '';
	const selected = raw || DEFAULT_EDGE_API_BASE;
	if (!selected.startsWith('http://') && !selected.startsWith('https://')) {
		return '';
	}
	return selected.endsWith('/') ? selected.slice(0, -1) : selected;
}

export const trailingSlash = 'ignore';

const proxy: RequestHandler = async ({ fetch, params, request, url }) => {
	const edgeApiBaseUrl = resolveEdgeApiBaseUrl();
	if (!edgeApiBaseUrl) {
		return new Response(
			JSON.stringify({
				error:
					'Cloudflare edge API URL is not configured. Set CLOUDFLARE_EDGE_API_URL (or BACKEND_API_URL) to an absolute /api/v2 base URL.'
			}),
			{
				status: 500,
				headers: { 'content-type': 'application/json' }
			}
		);
	}

	const segments = (params.segments || '').replace(/^\/+/, '');
	const targetUrl = `${edgeApiBaseUrl}${segments ? `/${segments}` : ''}${url.search}`;
	const headers = new Headers(request.headers);
	headers.delete('host');
	headers.delete('content-length');

	if (!headers.has('x-tenant-id')) {
		headers.set('x-tenant-id', privateEnv.DEFAULT_TENANT_ID || 'default');
	}

	const method = request.method.toUpperCase();
	const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

	const response = await fetch(targetUrl, {
		method,
		headers,
		body
	});

	const responseHeaders = new Headers(response.headers);
	responseHeaders.set('x-proxied-by', 'frontend-v2-proxy');

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
