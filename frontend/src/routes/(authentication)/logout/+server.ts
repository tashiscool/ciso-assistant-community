import { fail, redirect } from '@sveltejs/kit';
import { ALLAUTH_API_URL, BASE_API_URL, IS_CLOUDFLARE_RUNTIME } from '$lib/utils/constants';

export const GET = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, `/login?next=/`);
	}
	redirect(302, '/analytics');
};

export const POST = async ({ fetch, cookies }) => {
	const endpoint = IS_CLOUDFLARE_RUNTIME
		? `${BASE_API_URL}/iam/logout/`
		: `${ALLAUTH_API_URL}/auth/session`;
	const requestInitOptions: RequestInit = {
		method: IS_CLOUDFLARE_RUNTIME ? 'POST' : 'DELETE'
	};
	const res = await fetch(endpoint, requestInitOptions);

	if (!IS_CLOUDFLARE_RUNTIME) {
		const response = await res.json();
		if (response.meta.is_authenticated !== false) return fail(400, response.error);
	} else if (!res.ok) {
		return fail(res.status, { error: 'logout_failed' });
	}

	cookies.delete('token', { path: '/' });
	cookies.delete('allauth_session_token', { path: '/' });

	redirect(302, '/login');
};
