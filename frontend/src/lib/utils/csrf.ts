import { BASE_API_URL } from '$lib/utils/constants';

export async function getCsrfToken(): Promise<string | undefined> {
	try {
		const response = await fetch(`${BASE_API_URL}/csrf/`, {
			credentials: 'include'
		}).then((res) => res.json());
		return response.csrfToken;
	} catch (error) {
		console.error(error);
	}
}
