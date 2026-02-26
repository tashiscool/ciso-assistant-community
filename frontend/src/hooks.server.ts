import { BASE_API_URL, DEFAULT_LANGUAGE } from '$lib/utils/constants';
import { safeTranslate } from '$lib/utils/i18n';
import type { User } from '$lib/utils/types';
import { redirect, type Handle, type HandleFetch, type RequestEvent } from '@sveltejs/kit';
import { setFlash } from 'sveltekit-flash-message/server';

import { loadFeatureFlags } from '$lib/feature-flags';
import { paraglideMiddleware } from '$paraglide/server';

const normalizedBaseApiUrl = BASE_API_URL.endsWith('/')
	? BASE_API_URL.slice(0, -1)
	: BASE_API_URL;

function isFrontendProxyApiPath(pathname: string): boolean {
	if (normalizedBaseApiUrl.startsWith('http://') || normalizedBaseApiUrl.startsWith('https://')) {
		return false;
	}
	return pathname === normalizedBaseApiUrl || pathname.startsWith(`${normalizedBaseApiUrl}/`);
}

function isBackendApiRequest(requestUrl: string): boolean {
	if (normalizedBaseApiUrl.startsWith('http://') || normalizedBaseApiUrl.startsWith('https://')) {
		return requestUrl.startsWith(normalizedBaseApiUrl);
	}
	try {
		return new URL(requestUrl).pathname.startsWith(normalizedBaseApiUrl);
	} catch {
		return requestUrl.startsWith(normalizedBaseApiUrl);
	}
}

function isAllauthApiRequest(requestUrl: string): boolean {
	const suffix = '/_allauth/app';
	if (normalizedBaseApiUrl.startsWith('http://') || normalizedBaseApiUrl.startsWith('https://')) {
		return requestUrl.startsWith(`${normalizedBaseApiUrl}${suffix}`);
	}
	try {
		return new URL(requestUrl).pathname.startsWith(`${normalizedBaseApiUrl}${suffix}`);
	} catch {
		return requestUrl.startsWith(`${normalizedBaseApiUrl}${suffix}`);
	}
}

function useSecureCookies(url: URL): boolean {
	const isLocalHttpHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
	return url.protocol === 'https:' && !isLocalHttpHost;
}

async function ensureCsrfToken(event: RequestEvent): Promise<string> {
	let csrfToken = event.cookies.get('csrftoken') || '';
	if (!csrfToken) {
		const response = await event.fetch(`${BASE_API_URL}/csrf/`, {
			credentials: 'include',
			headers: { 'content-type': 'application/json' }
		});
		const rawBody = await response.text();
		let data: { csrfToken?: string } = {};
		try {
			data = rawBody ? JSON.parse(rawBody) : {};
		} catch {
			data = {};
		}
		csrfToken = data.csrfToken || '';
		if (!csrfToken) {
			return '';
		}
		event.cookies.set('csrftoken', csrfToken, {
			httpOnly: false,
			sameSite: 'lax',
			path: '/',
			secure: useSecureCookies(event.url)
		});
	}
	return csrfToken;
}

function logoutUser(event: RequestEvent) {
	event.cookies.delete('token', {
		path: '/'
	});
	const allauthSessionToken = event.cookies.get('allauth_session_token');
	if (allauthSessionToken) {
		event.cookies.delete('allauth_session_token', { path: '/' });
	}
	redirect(302, `/login?next=${event.url.pathname}`);
}

async function validateUserSession(event: RequestEvent): Promise<User | null> {
	const token = event.cookies.get('token');
	if (!token) return null;

	const allauthSessionToken = event.cookies.get('allauth_session_token');
	if (!allauthSessionToken) logoutUser(event);

	const res = await event.fetch(`${BASE_API_URL}/iam/current-user/`, {
		credentials: 'include',
		headers: {
			'content-type': 'application/json',
			Authorization: `Token ${token}`
		}
	});

	if (!res.ok) logoutUser(event);

	return res.json();
}

export const handle: Handle = async ({ event, resolve }) =>
	paraglideMiddleware(event.request, async ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;

		event.locals.featureFlags = loadFeatureFlags();

		if (isFrontendProxyApiPath(event.url.pathname)) {
			return resolve(event);
		}

		await ensureCsrfToken(event);

		if (event.locals.user)
			return await resolve(event, {
				transformPageChunk: ({ html }) => {
					return html.replace('%lang%', locale);
				}
			});

		const errorId = new URL(event.request.url).searchParams.get('error');
		if (errorId) {
			setFlash({ type: 'error', message: safeTranslate(errorId) }, event);
			redirect(302, '/login');
		}

		const user = await validateUserSession(event);
		if (user) {
			event.locals.user = user;
			const generalSettings = await event.fetch(`${BASE_API_URL}/settings/general/object/`, {
				credentials: 'include',
				headers: {
					'content-type': 'application/json',
					Authorization: `Token ${event.cookies.get('token')}`
				}
			});
			event.locals.settings = await generalSettings.json();

			const featureFlagSettings = await event.fetch(`${BASE_API_URL}/settings/feature-flags/`, {
				credentials: 'include',
				headers: {
					'content-type': 'application/json',
					Authorization: `Token ${event.cookies.get('token')}`
				}
			});
			try {
				event.locals.featureflags = await featureFlagSettings.json();
			} catch (e) {
				console.error('Error fetching feature flags', e);
				event.locals.featureflags = {};
			}
		}

		return await resolve(event, {
			transformPageChunk: ({ html }) => {
				return html.replace('%lang%', locale);
			}
		});
	});

export const handleFetch: HandleFetch = async ({ request, fetch, event }) => {
	const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
	const currentLang = event.locals.user?.preferences?.lang || DEFAULT_LANGUAGE;
	if (isBackendApiRequest(request.url)) {
		const method = request.method.toUpperCase();
		const incomingContentType = request.headers.get('Content-Type') || '';
		const isMultipartRequest = incomingContentType.startsWith('multipart/form-data');
		const shouldForceJsonContentType =
			unsafeMethods.has(method) &&
			!isMultipartRequest &&
			(!incomingContentType || incomingContentType.startsWith('text/plain'));

		// Some form helpers serialize JSON bodies without explicitly setting content type.
		// Normalize those requests so DRF JSON parser is used instead of rejecting text/plain.
		if (shouldForceJsonContentType) {
			request.headers.set('Content-Type', 'application/json');
		}
		request.headers.set('Accept-Language', currentLang);

		const token = event.cookies.get('token');
		const csrfToken = event.cookies.get('csrftoken');

		if (token && !request.headers.has('Authorization')) {
			request.headers.set('Authorization', `Token ${token}`);
		}

		if (unsafeMethods.has(method) && csrfToken) {
			request.headers.set('X-CSRFToken', csrfToken);
			const existingCookieHeader = request.headers.get('Cookie') || '';
			if (!existingCookieHeader.includes('csrftoken=')) {
				request.headers.set(
					'Cookie',
					existingCookieHeader
						? `${existingCookieHeader}; csrftoken=${csrfToken}`
						: `csrftoken=${csrfToken}`
				);
			}
		}
	}

	if (isAllauthApiRequest(request.url)) {
		const allauthSessionToken = event.cookies.get('allauth_session_token');
		if (allauthSessionToken) {
			request.headers.append('X-Session-Token', allauthSessionToken);
		}
		const response = await fetch(request);
		const clonedResponse = response.clone();

		// Session is invalid
		if (clonedResponse.status === 410) logoutUser(event);

		if (clonedResponse.status === 401) {
			const data = await clonedResponse.json();
			const reauthenticationFlows = ['reauthenticate', 'mfa_reauthenticate'];
			console.log(data);

			if (
				// User is authenticated, but needs to reauthenticate to perform a sensitive action
				data.meta.is_authenticated &&
				data.data.flows.filter((flow: Record<string, any>) =>
					reauthenticationFlows.includes(flow.id)
				)
			) {
				setFlash(
					{ type: 'warning', message: safeTranslate('reauthenticateForSensitiveAction') },
					event
				);
				// NOTE: This is a temporary solution to force the user to reauthenticate
				// We have to properly implement allauth's reauthentication flow
				// https://docs.allauth.org/en/latest/headless/openapi-specification/#tag/Authentication:-Account/paths/~1_allauth~1%7Bclient%7D~1v1~1auth~1reauthenticate/post
				logoutUser(event);
			}
		}

		return response;
	}

	return fetch(request);
};
