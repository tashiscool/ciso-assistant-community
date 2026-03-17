<script lang="ts">
	interface Props {
		open: boolean;
	}

	let { open = $bindable() }: Props = $props();

	function toggle() {
		open = !open;
	}

	let classesSidebarOpenButton = $derived((open: boolean) =>
		open ? 'left-[15.3rem]' : 'rotate-180 left-5'
	);
</script>

<!-- SIDEBAR TOGGLE -->
<button
	aria-label="Toggle sidebar"
	onclick={toggle}
	class="{classesSidebarOpenButton(
		open
	)} z-20 fixed top-1/2 bottom-1/2 h-8 w-8 self-center rounded-full border border-[rgb(88_181_255_/_0.24)] bg-[var(--rv-midnight)] text-white shadow-[var(--rv-shadow-glow)] transition-all duration-300 hover:scale-105 hover:bg-[var(--color-secondary-700)]"
	data-testid="sidebar-toggle-btn"
>
	<i class="fa-solid fa-angle-left"></i>
</button>
