import { handleErrorResponse } from '$lib/utils/actions';
import { BASE_API_URL } from '$lib/utils/constants';
import { m } from '$paraglide/messages';
import { safeTranslate } from '$lib/utils/i18n';
import { webhookEndpointSchema } from '$lib/utils/schemas';
import { fail, type Actions } from '@sveltejs/kit';
import { setFlash } from 'sveltekit-flash-message/server';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const webhookEndpoints = await fetch(`${BASE_API_URL}/webhooks/endpoints/`)
		.then((res) => res.json())
		.then((res) => res.results);

	const webhookEndpointCreateForm = await superValidate(zod(webhookEndpointSchema), {
		errors: false
	});

	return {
		webhookEndpoints,
		webhookEndpointCreateForm,
		title: m.webhooks()
	};
};

export const actions: Actions = {
	createWebhookEndpoint: async (event) => {
		const formData = await event.request.formData();

		if (!formData) {
			return fail(400, { form: null });
		}

		const schema = webhookEndpointSchema;
		const form = await superValidate(formData, zod(schema));

		if (!form.valid) {
			return fail(400, { form });
		}

		const endpoint = `${BASE_API_URL}/webhooks/endpoints/`;

		const requestInitOptions: RequestInit = {
			method: 'POST',
			body: JSON.stringify(form.data)
		};

		const response = await event.fetch(endpoint, requestInitOptions);

		if (!response.ok) return handleErrorResponse({ event, response, form });

		setFlash(
			{ type: 'success', message: m.successfullyCreatedObject({ object: m.webhookEndpoint() }) },
			event
		);

		return { form };
	},
	deleteWebhookEndpoint: async (event) => {
		const formData = await event.request.formData();
		const schema = z.object({ id: z.string() });
		const deleteForm = await superValidate(formData, zod(schema));
		const id = deleteForm.data.id;
		const endpoint = `${BASE_API_URL}/webhooks/endpoints/${id}/`;

		if (!deleteForm.valid) {
			console.error(deleteForm.errors);
			return message(deleteForm, { status: 400 });
		}

		const requestInitOptions: RequestInit = {
			method: 'DELETE'
		};
		const res = await event.fetch(endpoint, requestInitOptions);
		if (!res.ok) {
			const response = await res.json();
			if (response.error) {
				const errorMessages = Array.isArray(response.error) ? response.error : [response.error];
				errorMessages.forEach((error: string) => {
					setFlash({ type: 'error', message: safeTranslate(error) }, event);
				});
				return message(deleteForm, { status: res.status });
			}
			if (response.non_field_errors) {
				setError(deleteForm, 'non_field_errors', response.non_field_errors);
			}
			return message(deleteForm, { status: res.status });
		}
		setFlash(
			{
				type: 'success',
				message: m.successfullyDeletedObject({
					object: m.webhookEndpoint().toLowerCase()
				})
			},
			event
		);

		return message(deleteForm, { status: res.status });
	}
};
