import { BASE_API_URL } from '$lib/utils/constants';

import { defaultDeleteFormAction } from '$lib/utils/actions';
import { safeTranslate } from '$lib/utils/i18n';
import { LibraryUploadSchema } from '$lib/utils/schemas';
import { listViewFields } from '$lib/utils/table';
import { m } from '$paraglide/messages';
import { fail, type Actions } from '@sveltejs/kit';
import { setFlash } from 'sveltekit-flash-message/server';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { PageServerLoad } from './$types';

export const load = (async ({ fetch }) => {
	const storedLibrariesEndpoint = `${BASE_API_URL}/stored-libraries/`;
	const storedLibrariesResponse = await fetch(storedLibrariesEndpoint);
	const storedLibrariesPayload = storedLibrariesResponse.ok
		? await storedLibrariesResponse.json()
		: { results: [], count: 0, next: null, previous: null };
	const storedLibraries =
		storedLibrariesPayload && typeof storedLibrariesPayload === 'object'
			? storedLibrariesPayload
			: { results: [], count: 0, next: null, previous: null };
	const libraryRows = Array.isArray((storedLibraries as Record<string, any>).results)
		? (storedLibraries as Record<string, any>).results
		: Array.isArray(storedLibraries)
			? storedLibraries
			: [];

	const prepareRow = (row: Record<string, any>) => {
		const objectsMeta = row.objects_meta && typeof row.objects_meta === 'object' ? row.objects_meta : {};
		row.overview = [
			`Packager: ${row.packager ?? '-'}`,
			`Version: ${row.version ?? '-'}`,
			...Object.entries(objectsMeta).map(([key, value]) => `${key}: ${value}`)
		];
		row.allowDeleteLibrary = row.reference_count && row.reference_count > 0 ? false : true;
	};

	libraryRows.forEach(prepareRow);

	const makeHeadData = (URLModel) => {
		return listViewFields[URLModel].body.reduce((obj, key, index) => {
			obj[key] = listViewFields[URLModel].head[index];
			return obj;
		}, {});
	};

	const storedLibrariesTable = {
		head: makeHeadData('stored-libraries'),
		meta: {
			urlmodel: 'stored-libraries',
			...(typeof storedLibraries === 'object' && !Array.isArray(storedLibraries)
				? storedLibraries
				: { results: libraryRows, count: libraryRows.length, next: null, previous: null }),
			results: libraryRows
		},
		body: []
	};

	const schema = z.object({ id: z.string() });
	const deleteForm = await superValidate(zod(schema));
	const uploadForm = await superValidate({}, zod(LibraryUploadSchema), { errors: false });

	return {
		storedLibrariesTable,
		deleteForm,
		uploadForm,
		title: m.libraries()
	};
}) satisfies PageServerLoad;

export const actions: Actions = {
	upload: async (event) => {
		const formData = await event.request.formData();
		const form = await superValidate(formData, zod(LibraryUploadSchema));

		if (formData.has('file')) {
			const { file } = Object.fromEntries(formData) as { file: File };
			// Should i check if attachment.size > 0 ?
			const endpoint = `${BASE_API_URL}/stored-libraries/upload/`;
			const req = await event.fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Disposition': `attachment; filename=${file.name}`
				},
				body: file
			});
			if (!req.ok) {
				const response = await req.json();
				console.error(response);

				const translate_error = safeTranslate(response.error);
				const toast_error_message =
					translate_error ?? m.libraryLoadingError() + '(' + response.error + ')';

				setFlash({ type: 'error', message: toast_error_message }, event);
				delete form.data['file']; // This removes a warning: Cannot stringify arbitrary non-POJOs (data..form.data.file)
				return fail(400, { form });
			}
			setFlash({ type: 'success', message: m.librarySuccessfullyLoaded() }, event);
		} else {
			setFlash({ type: 'error', message: m.noLibraryDetected() }, event);
			return fail(400, { form });
		}
	},
	delete: async (event) => {
		return defaultDeleteFormAction({ event, urlModel: 'stored-libraries' });
	}
};
