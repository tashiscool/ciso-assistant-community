<script lang="ts">
	import { BRAND_ASSETS, BRAND_NAME } from '$lib/brand';

	type LogoVariant = 'full' | 'icon' | 'tagline';
	type LogoTheme = 'dark' | 'light';

	interface Props {
		variant?: LogoVariant;
		theme?: LogoTheme;
		height?: number | string;
		width?: number | string;
		className?: string;
		alt?: string;
	}

	let { variant = 'full', theme = 'dark', height, width, className = '', alt }: Props = $props();

	const logoSources = {
		full: {
			dark: BRAND_ASSETS.logoDark,
			light: BRAND_ASSETS.logoLight
		},
		icon: {
			dark: BRAND_ASSETS.iconDark,
			light: BRAND_ASSETS.iconLight
		},
		tagline: {
			dark: BRAND_ASSETS.logoTaglineLight,
			light: BRAND_ASSETS.logoTaglineLight
		}
	} as const;

	let src = $derived(logoSources[variant][theme]);
	let resolvedAlt = $derived(
		alt ?? (variant === 'icon' ? `${BRAND_NAME} icon` : `${BRAND_NAME} logo`)
	);
	let resolvedWidth = $derived(
		width ?? (variant === 'icon' ? 44 : variant === 'tagline' ? 240 : 168)
	);
</script>

<img
	class={className}
	{height}
	width={resolvedWidth}
	{src}
	alt={resolvedAlt}
	decoding="async"
	data-testid="logo-image"
/>
