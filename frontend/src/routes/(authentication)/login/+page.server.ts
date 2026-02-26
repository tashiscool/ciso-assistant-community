import { getSecureRedirect } from '$lib/utils/helpers';

import { ALLAUTH_API_URL, BASE_API_URL } from '$lib/utils/constants';
import { loginSchema } from '$lib/utils/schemas';
import type { LoginRequestBody } from '$lib/utils/types';
import { fail, redirect, type Actions } from '@sveltejs/kit';
import { setError, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { PageServerLoad } from './$types';
import { mfaAuthenticateSchema } from './mfa/utils/schemas';

interface AuthenticationFlow {
	id:
		| 'verify_email'
		| 'login'
		| 'signup'
		| 'provider_redirect'
		| 'provider_signup'
		| 'provider_token'
		| 'mfa_authenticate'
		| 'reauthenticate'
		| 'mfa_reauthenticate';
	provider?: Record<string, string>;
	is_pending: boolean;
	types: 'totp' | 'recovery_codes';
}

function useSecureCookies(url: URL): boolean {
	const isLocalHttpHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
	return url.protocol === 'https:' && !isLocalHttpHost;
}

export const load: PageServerLoad = async ({ fetch, request, locals }) => {
	// redirect user if already logged in
	if (locals.user) {
		redirect(302, '/analytics');
	}

	const form = await superValidate(request, zod(loginSchema));

	let SSOInfo: Record<string, unknown> = { is_enabled: false };
	try {
		const ssoResponse = await fetch(`${BASE_API_URL}/settings/sso/info/`);
		const raw = await ssoResponse.text();
		SSOInfo = raw ? JSON.parse(raw) : { is_enabled: false };
	} catch {
		SSOInfo = { is_enabled: false };
	}

	const mfaAuthenticateForm = await superValidate(request, zod(mfaAuthenticateSchema));

	return { form, SSOInfo, mfaAuthenticateForm };
};

export const actions: Actions = {
	login: async ({ request, fetch, cookies, url }) => {
		const form = await superValidate(request, zod(loginSchema));
		if (!form.valid) {
			return fail(400, { form });
		}

		const secureCookie = useSecureCookies(url);
		const email = form.data.username;
		const password = form.data.password;

		const login: LoginRequestBody = {
			email,
			password
		};

		const endpoint = `${ALLAUTH_API_URL}/auth/login`;

		const requestInitOptions: RequestInit = {
			method: 'POST',
			body: JSON.stringify(login)
		};

		const res = await fetch(endpoint, requestInitOptions).then((res) => res.json());

		if (res.status !== 200) {
			console.error(res);
			if (res.errors) {
				res.errors.forEach((error) => {
					setError(form, error.param, error.code);
				});
				return fail(res.status, { form });
			}
			if (res.status === 401 && res.data) {
				// User is not authenticated
				const flows: AuthenticationFlow[] = res.data.flows;
				if (flows.length > 0) {
					const mfaFlow = flows.find((flow) => flow.id === 'mfa_authenticate');
					const sessionToken = res.meta.session_token;
					if (sessionToken) {
						cookies.set('allauth_session_token', sessionToken, {
							httpOnly: true,
							sameSite: 'lax',
							path: '/',
							secure: secureCookie
						});
					}

					if (mfaFlow) {
						return {
							form,
							mfa: true,
							mfaFlow
						};
					}
				}
			}
			return { form };
		}

		cookies.set('token', res.meta.access_token, {
			httpOnly: true,
			sameSite: 'lax',
			path: '/',
			secure: secureCookie
		});

		cookies.set('allauth_session_token', res.meta.session_token, {
			httpOnly: true,
			sameSite: 'lax',
			path: '/',
			secure: secureCookie
		});

		cookies.set('show_first_login_modal', 'true', {
			httpOnly: false,
			sameSite: 'lax',
			path: '/',
			secure: secureCookie
		});
		const next = url.searchParams.get('next');
		const secureNext = getSecureRedirect(next) || '/';
		redirect(302, secureNext);
	},
	mfaAuthenticate: async (event) => {
		const formData = await event.request.formData();
		if (!formData) return fail(400, { error: 'No form data' });

		const form = await superValidate(formData, zod(mfaAuthenticateSchema));
		if (!form.valid) return fail(400, { form });

		const endpoint = `${ALLAUTH_API_URL}/auth/2fa/authenticate`;
		const requestInitOptions: RequestInit = {
			method: 'POST',
			body: JSON.stringify(form.data)
		};

		const response = await event.fetch(endpoint, requestInitOptions).then((res) => res.json());

		if (response.status !== 200) {
			console.error('Could not authenticate using TOTP', response);
			if (Object.hasOwn(response, 'errors')) {
				response.errors.forEach((error) => {
					setError(form, error.param, error.code);
				});
			}
			return fail(response.status, { form });
		}

		const secureCookie = useSecureCookies(event.url);
		event.cookies.set('token', response.meta.access_token, {
			httpOnly: true,
			sameSite: 'lax',
			path: '/',
			secure: secureCookie
		});

		event.cookies.set('allauth_session_token', response.meta.session_token, {
			httpOnly: true,
			sameSite: 'lax',
			path: '/',
			secure: secureCookie
		});

		return { form };
	}
};
