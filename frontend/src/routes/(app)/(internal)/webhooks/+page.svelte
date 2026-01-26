<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$paraglide/messages';
	import WebhooksSettings from '$lib/components/Settings/WebhooksSettings.svelte';

	let { data } = $props();
</script>

<div class="flex flex-col space-y-4">
	<div class="card p-6">
		<div class="flex flex-col gap-2 mb-4">
			<h2 class="h2">{m.webhooks()}</h2>
			<p class="text-gray-600">{m.webhooksDescription()}</p>
		</div>

		{#if page.data?.featureflags?.outgoing_webhooks}
			<WebhooksSettings {data} allowMultiple={true} />
		{:else}
			<div class="p-4 preset-tonal-warning rounded-lg">
				<p class="flex items-center gap-2">
					<i class="fa-solid fa-triangle-exclamation"></i>
					{m.featureNotEnabled({ feature: m.webhooks() })}
				</p>
				<p class="text-sm mt-2">
					Enable webhooks in <a href="/settings" class="anchor">Settings → Feature Flags</a>.
				</p>
			</div>
		{/if}
	</div>
</div>
