<script lang="ts">
	import { page } from '$app/state';
	import { safeTranslate } from '$lib/utils/i18n';
	import Anchor from '$lib/components/Anchor/Anchor.svelte';

	interface Props {
		item?: { name: string; href: string; fa_icon: string }[];
		sideBarVisibleItems: Record<string, boolean>;
	}

	let { item = [], sideBarVisibleItems }: Props = $props();

	let classesActive = $derived((href: string) =>
		href === page.url.pathname
			? 'bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(88,181,255,0.24)]'
			: 'text-slate-200 hover:bg-white/6 hover:text-white'
	);
</script>

{#each item as item}
	<!-- undefined and true must be shown -->
	{#if sideBarVisibleItems[item.name] !== false}
		<Anchor
			href={item.href}
			breadcrumbAction="replace"
			class="unstyled flex whitespace-nowrap items-center py-2 text-sm font-normal rounded-[16px] transition-colors {classesActive(
				item.href ?? ''
			)}"
			data-testid={'accordion-item-' + item.href.substring(1)}
		>
			<span
				class="flex w-full items-center space-x-3 px-4 text-xs"
				id={item.name}
				title={safeTranslate(item.name)}
			>
				<i class="{item.fa_icon} w-1/12 text-[0.8rem]"></i>
				<span class="truncate text-[0.86rem] tracking-wide">{safeTranslate(item.name)}</span>
			</span>
		</Anchor>
	{/if}
{/each}
