<script lang="ts">
	import '../app.css';

	import { ModeWatcher } from 'mode-watcher';

	import { page } from '$app/state';
	import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	const { children } = $props();
</script>

<ModeWatcher />
<Toaster />
<ErrorBoundary />
<div class="min-h-screen bg-background">
	{@render children()}
</div>
