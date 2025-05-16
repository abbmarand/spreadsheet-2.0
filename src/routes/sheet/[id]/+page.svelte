<script lang="ts">
	import Table from '$lib/components/Table.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// The Table component expects `rows` and `fields` as separate props,
	// and `sheetId` (formerly jobId).
	// Our load function structures data as data.sheet (which contains rows) and data.fields.
	const sheetData = $state(data.sheet);
	const fieldsData = $state(data.fields);

</script>

{#if sheetData && fieldsData}
	<div class="container mx-auto py-8">
		<h1 class="mb-6 text-3xl font-bold">Sheet: {sheetData.name ?? 'Unnamed Sheet'}</h1>
		<Table
			sheetId={sheetData.id}
			rows={sheetData.rows}
			fields={fieldsData}
		/>
	</div>
{:else}
	<div class="container mx-auto py-8">
		<p class="text-center text-red-500">Sheet data could not be loaded or is not in the expected format.</p>
		{#if !sheetData}
			<p class="text-center text-sm text-muted-foreground">Sheet details are missing.</p>
		{/if}
		{#if !fieldsData}
			<p class="text-center text-sm text-muted-foreground">Field definitions are missing.</p>
		{/if}
	</div>
{/if}
