import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const adapterTarget = (
	process.env.SVELTEKIT_ADAPTER ||
	process.env.PUBLIC_FRONTEND_RUNTIME ||
	'cloudflare'
).toLowerCase();

async function resolveAdapter() {
	if (adapterTarget === 'cloudflare') {
		try {
			const mod = await import('@sveltejs/adapter-cloudflare');
			return mod.default();
		} catch (error) {
			throw new Error(
				`SVELTEKIT_ADAPTER=cloudflare requires @sveltejs/adapter-cloudflare. Install it in frontend/package.json. Original error: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
	}

	const mod = await import('@sveltejs/adapter-node');
	return mod.default();
}

const adapter = await resolveAdapter();

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
		// If your environment is not supported or you settled on a specific environment, switch out the adapter.
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		adapter,

		alias: {
			$paraglide: './src/paraglide/'
		}
	}
};

export default config;
