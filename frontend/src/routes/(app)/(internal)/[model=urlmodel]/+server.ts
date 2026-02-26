import { BASE_API_URL } from '$lib/utils/constants';
import { getModelInfo } from '$lib/utils/crud';
import { error, type NumericRange } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const EMPTY_LIST_PAYLOAD = {
	count: 0,
	next: null,
	previous: null,
	results: []
};

async function readJsonSafe(response: Response): Promise<any> {
	const contentType = response.headers.get('content-type') || '';
	if (contentType.includes('application/json')) {
		return response.json().catch(() => null);
	}
	const rawText = await response.text().catch(() => '');
	if (!rawText) return null;
	try {
		return JSON.parse(rawText);
	} catch {
		return { detail: rawText };
	}
}

export const GET: RequestHandler = async ({ fetch, params, url }) => {
	const model = getModelInfo(params.model);
	const endpoint = `${BASE_API_URL}/${model.endpointUrl ? model.endpointUrl : params.model}/${
		url.searchParams ? '?' + url.searchParams.toString() : ''
	}`;

	const res = await fetch(endpoint);
	if (!res.ok) {
		// Some optional feature endpoints can be absent in community mode.
		// Return an empty collection instead of crashing with a non-JSON parse failure.
		if (res.status === 404) {
			return new Response(JSON.stringify(EMPTY_LIST_PAYLOAD), {
				status: 200,
				headers: {
					'Content-Type': 'application/json'
				}
			});
		}
		error(res.status as NumericRange<400, 599>, await readJsonSafe(res));
	}
	const data = await readJsonSafe(res);

	return new Response(JSON.stringify(data), {
		status: res.status,
		headers: {
			'Content-Type': 'application/json'
		}
	});
};
