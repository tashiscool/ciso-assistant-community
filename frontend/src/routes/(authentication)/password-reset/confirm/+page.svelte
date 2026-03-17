<script lang="ts">
	import type { PageData } from './$types';
	import Logo from '$lib/components/Logo/Logo.svelte';
	import SuperForm from '$lib/components/Forms/Form.svelte';
	import TextField from '$lib/components/Forms/TextField.svelte';
	import { ResetPasswordSchema } from '$lib/utils/schemas';
	import { zod } from 'sveltekit-superforms/adapters';
	import { m } from '$paraglide/messages';
	import { BRAND_TAGLINE } from '$lib/brand';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<div class="brand-shell relative min-h-screen overflow-hidden px-6 py-6 lg:px-10 lg:py-8">
	<div class="flex items-start justify-between">
		<Logo theme="light" width={194} className="h-auto w-[194px]" />
		<span class="hidden lg:inline-flex rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-white/70 uppercase">
			Credential Reset
		</span>
	</div>
	<div class="flex min-h-[calc(100vh-7rem)] w-full items-center justify-center p-4">
		<div class="brand-card flex w-full max-w-md flex-col items-center space-y-4 p-8 lg:p-10">
			<div class="brand-icon-badge text-3xl">
				<i class="fa-solid fa-key"></i>
			</div>
			<p class="brand-title-gradient text-center text-3xl font-bold">Set a new password</p>
			<p class="text-center text-sm text-slate-600">
				{m.resetPasswordHere()}<br />
			</p>
			<p class="text-center text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
				{BRAND_TAGLINE}
			</p>
			<!-- SuperForm with dataType 'form' -->
			<div class="flex w-full">
				<SuperForm
					class="flex flex-col space-y-3 w-full"
					data={data?.form}
					dataType="form"
					validators={zod(ResetPasswordSchema)}
				>
					{#snippet children({ form })}
						<TextField type="password" {form} field="new_password" label={m.newPassword()} />
						<TextField
							type="password"
							{form}
							field="confirm_new_password"
							label={m.confirmNewPassword()}
						/>
						<p class="pt-3">
							<button
								class="btn preset-filled-primary-500 font-semibold w-full"
								type="submit"
								data-testid="set-password-btn">{m.resetPassword()}</button
							>
						</p>
					{/snippet}
				</SuperForm>
			</div>
		</div>
	</div>
</div>
