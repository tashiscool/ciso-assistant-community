import { BASE_API_URL } from '$lib/utils/constants';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch, setHeaders, params }) => {
	const endpoint = `${BASE_API_URL}/evidence-revisions/${params.id}/attachment/`;

	try {
		const attachmentResponse = await fetch(endpoint);

		// Early validation with proper error handling
		if (!attachmentResponse.ok) {
			throw new Error(`Fetch failed with status ${attachmentResponse.status}`);
		}

		const contentType =
			attachmentResponse.headers.get('Content-Type') || 'application/octet-stream';
		const contentDisposition = attachmentResponse.headers.get('Content-Disposition');

		if (!contentDisposition) {
			throw new Error('Missing Content-Disposition header');
		}

		const fileName = contentDisposition.split('filename=')[1]?.replace(/"/g, '').trim();
		if (!fileName) {
			throw new Error('Invalid filename in Content-Disposition');
		}

		setHeaders({
			'Content-Type': contentType,
			'Content-Disposition': `attachment; filename="${fileName}"`
		});

		return new Response(attachmentResponse.body, {
			status: attachmentResponse.status
		});
	} catch (err) {
		console.error('Attachment fetch error:', err);
		throw error(500, 'Failed to fetch attachment');
	}
};
