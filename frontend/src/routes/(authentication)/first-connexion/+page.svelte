<script lang="ts">
	import type { PageData } from './$types';
	import SuperForm from '$lib/components/Forms/Form.svelte';
	import TextField from '$lib/components/Forms/TextField.svelte';
	import { ResetPasswordSchema } from '$lib/utils/schemas';

	import { m } from '$paraglide/messages.js';
	import { zod } from 'sveltekit-superforms/adapters';
	import Logo from '$lib/components/Logo/Logo.svelte';
	import Greetings from '../login/Greetings.svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<div class="brand-shell relative min-h-screen overflow-hidden">
	<div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(88,181,255,0.18),transparent_28%)]"></div>
	<div class="relative flex min-h-screen flex-col px-6 py-6 lg:px-10 lg:py-8">
		<div class="flex items-start justify-between gap-4">
			<Logo theme="light" width={194} className="h-auto w-[194px]" />
			<span class="hidden lg:inline-flex rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-white/70 uppercase">
				First Access
			</span>
		</div>
		<div class="flex flex-1 items-center">
			<div class="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[1.15fr_0.85fr]">
				<Greetings />
				<div class="brand-card flex w-full max-w-[32rem] flex-col items-center space-y-4 p-8 lg:p-10">
					<div class="brand-icon-badge text-3xl">
						<i class="fa-solid fa-key"></i>
					</div>
					<p class="brand-title-gradient text-center text-3xl font-bold">Set your password</p>
					<p class="text-center text-sm text-slate-600">
						{m.youCanSetPasswordHere()}<br />
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
										class="btn preset-filled-primary-500 w-full font-semibold"
										type="submit"
										data-testid="set-password-btn">{m.setPassword()}</button
									>
								</p>
							{/snippet}
						</SuperForm>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
