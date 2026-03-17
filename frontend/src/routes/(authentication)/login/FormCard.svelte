<script lang="ts">
	import { run } from 'svelte/legacy';

	import SuperForm from '$lib/components/Forms/Form.svelte';
	import TextField from '$lib/components/Forms/TextField.svelte';
	import { loginSchema } from '$lib/utils/schemas';

	import { page } from '$app/state';
	import { redirectToProvider } from '$lib/allauth.js';
	import { zod } from 'sveltekit-superforms/adapters';
	import MfaAuthenticateModal from './mfa/components/MFAAuthenticateModal.svelte';
	import { m } from '$paraglide/messages';
	import {
		getModalStore,
		type ModalComponent,
		type ModalSettings,
		type ModalStore
	} from '$lib/components/Modals/stores';

	interface Props {
		data: any;
		form: any;
	}

	let { data, form }: Props = $props();

	const modalStore: ModalStore = getModalStore();

	function modalMFAAuthenticate(): void {
		const modalComponent: ModalComponent = {
			ref: MfaAuthenticateModal,
			props: {
				_form: data.mfaAuthenticateForm,
				formAction: '?/mfaAuthenticate'
			}
		};
		const modal: ModalSettings = {
			type: 'component',
			component: modalComponent,
			// Data
			title: m.mfaAuthenticateTitle(),
			body: m.enterCodeGeneratedByApp()
		};
		modalStore.trigger(modal);
	}

	run(() => {
		form && form.mfaFlow ? modalMFAAuthenticate() : null;
	});
</script>

<div class="brand-card w-full max-w-[32rem] p-8 lg:p-10">
	<div data-testid="login" class="flex flex-col w-full items-center space-y-5">
		<div class="brand-icon-badge text-3xl">
			<i class="fa-solid fa-right-to-bracket"></i>
		</div>
		<h3
			class="brand-title-gradient text-center text-3xl font-bold leading-tight tracking-tight"
		>
			{m.logIntoYourAccount()}
		</h3>
		<p class="text-center text-sm text-slate-600">
			Access your governance workspace and continue with evidence, controls, and assurance work.
		</p>
		<div class="w-full">
			<!-- SuperForm with dataType 'form' -->
			<SuperForm
				class="flex flex-col space-y-3"
				data={data?.form}
				dataType="form"
				validators={zod(loginSchema)}
				action="?/login&next={page.url.searchParams.get('next') || '/'}"
			>
				{#snippet children({ form })}
					<TextField type="email" {form} field="username" label={m.email()} />
					<TextField type="password" {form} field="password" label={m.password()} />
					<div class="flex flex-row justify-end">
						<a
							href="/password-reset"
							class="flex items-center space-x-2 text-primary-800 hover:text-primary-600"
							data-testid="forgot-password-btn"
						>
							<p class="">{m.forgtPassword()}?</p>
						</a>
					</div>
					<p class="">
						<button
							class="btn preset-filled-primary-500 w-full font-semibold shadow-[var(--rv-shadow-soft)]"
							data-testid="login-btn"
							type="submit">{m.login()}</button
						>
					</p>
				{/snippet}
			</SuperForm>
		</div>
		{#if data.SSOInfo.is_enabled}
			<div class="flex items-center justify-center w-full space-x-2">
				<hr class="w-64 items-center border-0 bg-slate-200" />
				<span class="flex items-center text-sm text-slate-500">{m.or()}</span>
				<hr class="w-64 items-center border-0 bg-slate-200" />
			</div>
			<button
				class="btn w-full bg-[var(--rv-midnight)] text-white font-semibold hover:bg-[color-mix(in_srgb,var(--rv-midnight)_82%,var(--rv-blue)_18%)]"
				onclick={() =>
					redirectToProvider(data.SSOInfo.sp_entity_id, data.SSOInfo.callback_url, 'login')}
				>{m.loginSSO()}</button
			>
		{/if}
	</div>
</div>
