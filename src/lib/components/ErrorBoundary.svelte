<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	function handler(msg: unknown) {
		const text = typeof msg === 'string' ? msg : 'Unexpected error';
		toast.error(text);
	}

	onMount(() => {
		window.addEventListener('error', (e) => handler(e.message));
		window.addEventListener('unhandledrejection', (e) => handler(e.reason));

		return () => {
			window.removeEventListener('error', handler as EventListener);
			window.removeEventListener('unhandledrejection', handler as EventListener);
		};
	});
</script>
