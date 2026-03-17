<script lang="ts">
	import Logo from '$lib/components/Logo/Logo.svelte';
	import { BRAND_TAGLINE } from '$lib/brand';
</script>

<header class="mb-6 border-b border-white/10 pb-4">
	<a
		href="/analytics"
		class="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-sm transition-colors hover:bg-white/8"
	>
		<Logo
			theme="light"
			width={154}
			className="h-auto w-[154px]"
		/>
		<div class="space-y-1">
			<span class="brand-overline !text-white/65">Enterprise Governance</span>
			<p class="text-sm font-medium text-slate-200">{BRAND_TAGLINE}</p>
		</div>
	</a>
</header>
