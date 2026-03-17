<script lang="ts">
	import { page } from '$app/state';
	import { BRAND_DOCS_URL } from '$lib/brand';
	import { LOCALE_MAP, language, defaultLangLabels } from '$lib/utils/locales';
	import { m } from '$paraglide/messages';
	import { getLocale, locales, setLocale } from '$paraglide/runtime';
	import { Popover } from '@skeletonlabs/skeleton-svelte';

	import { getModalStore, type ModalSettings } from '$lib/components/Modals/stores';
	import { createEventDispatcher, onMount } from 'svelte';
	const dispatch = createEventDispatcher();

	const modalStore = getModalStore();

	let value = $state(getLocale());
	async function handleLocaleChange(event: Event) {
		value = event?.target?.value;
		await fetch('/fe-api/user-preferences', {
			method: 'PATCH',
			body: JSON.stringify({
				lang: value
			})
		}).then(() => setLocale(value));
	}

	async function modalBuildInfo() {
		const res = await fetch('/fe-api/build').then((res) => res.json());
		const modal: ModalSettings = {
			type: 'component',
			component: 'displayJSONModal',
			title: m.aboutCiso(),
			body: JSON.stringify(res)
		};
		openState = false;
		modalStore.trigger(modal);
	}

	let enableMoreBtn = $state(false);

	onMount(() => {
		enableMoreBtn = true;
	});

	let openState = $state(false);

	const menuItemClass =
		'brand-menu-link cursor-pointer flex items-center gap-2 w-full rounded-[14px] px-4 py-2.5 text-left text-sm disabled:text-slate-400';
	const selectClass =
		'brand-menu-link w-full rounded-[14px] border-transparent bg-transparent px-4 py-2.5 text-sm focus:border-transparent focus:ring-0';
</script>

<div class="mt-4 border-t border-white/10 pt-4">
	<div class="flex flex-row items-center justify-between">
		<div class="flex flex-col w-3/4">
			{#if page.data.user}
				<span
					class="w-full overflow-hidden truncate whitespace-nowrap text-sm font-medium text-white"
					data-testid="sidebar-user-name-display"
				>
					{page.data.user.first_name}
					{page.data.user.last_name}
				</span>
				<span
					class="mr-2 w-full truncate whitespace-nowrap text-xs font-normal text-slate-400"
					data-testid="sidebar-user-email-display"
				>
					{page.data.user.email}
				</span>
			{/if}
		</div>
		{#if enableMoreBtn}
			<Popover
				open={openState}
				onOpenChange={(e) => (openState = e.open)}
				positioning={{ placement: 'top' }}
				triggerBase="btn"
				contentBase="brand-sidebar-footer-card w-fit space-y-1 whitespace-nowrap p-2 shadow-lg"
				zIndex="1000"
			>
				{#snippet trigger()}
					<button
						class="btn border border-white/10 bg-white/6 text-slate-200 shadow-none hover:bg-white/10"
						data-testid="sidebar-more-btn"
						aria-label="More options"
						id="sidebar-more-btn"
					>
						<i class="fa-solid fa-ellipsis-vertical"></i>
					</button>
				{/snippet}
				{#snippet content()}
					<div data-testid="sidebar-more-panel">
						<a
							href="/my-profile"
							onclick={(e) => {
								window.location.href = e.target.href;
							}}
							class={menuItemClass}
							data-testid="profile-button"
							><i class="fa-solid fa-address-card mr-2"></i>{m.myProfile()}</a
						>
						<select
							{value}
							onchange={handleLocaleChange}
							class={selectClass}
							data-testid="language-select"
						>
							{#each locales as lang}
								<option value={lang} selected={lang === getLocale()}>
									{defaultLangLabels[lang]} ({language[LOCALE_MAP[lang].name]})
								</option>
							{/each}
						</select>
						<button
							onclick={() => dispatch('triggerGT')}
							class={menuItemClass}
							data-testid="gt-button"
							><i class="fa-solid fa-wand-magic-sparkles mr-2"></i>{m.guidedTour()}</button
						>
						<button
							onclick={() => dispatch('loadDemoDomain')}
							class={menuItemClass}
							data-testid="load-demo-data-button"
							><i class="fa-solid fa-file-import mr-2"></i>{m.loadDemoData()}</button
						>
						<button onclick={modalBuildInfo} class={menuItemClass} data-testid="about-button"
							><i class="fa-solid fa-circle-info mr-2"></i>{m.aboutCiso()}</button
						>
						{#if BRAND_DOCS_URL}
							<a
								href={BRAND_DOCS_URL}
								target="_blank"
								rel="noopener noreferrer"
								class={`unstyled ${menuItemClass}`}
								data-testid="docs-button"
								><i class="fa-solid fa-book-open mr-2"></i>{m.onlineDocs()}</a
							>
						{/if}
						<form action="/logout" method="POST">
							<button class="w-full" type="submit" data-testid="logout-button">
								<span class={menuItemClass}
									><i class="fa-solid fa-right-from-bracket mr-2"></i>{m.Logout()}</span
								>
							</button>
						</form>
					</div>
				{/snippet}
			</Popover>
		{:else}
			<button
				class="btn border border-white/10 bg-white/6 text-slate-200 shadow-none"
				data-testid="sidebar-more-btn-disabled"
				aria-label="More options"
				id="sidebar-more-btn-disabled"><i class="fa-solid fa-ellipsis-vertical"></i></button
			>
		{/if}
	</div>
</div>
