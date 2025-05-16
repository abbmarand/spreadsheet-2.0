<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Card from '$lib/components/ui/card';
	import { PlusCircle } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	type Sheet = {
		id: string;
		name: string;
		createdAt: string; // Assuming string date for simplicity from JSON
		updatedAt: string;
	};

	let sheets = $state<Sheet[]>([]);
	let newSheetName = $state('');
	let isLoadingSheets = $state(true);
	let errorLoadingSheets = $state<string | null>(null);
	let isCreatingSheet = $state(false);
	let errorCreatingSheet = $state<string | null>(null);

	async function fetchSheets() {
		isLoadingSheets = true;
		errorLoadingSheets = null;
		try {
			const response = await fetch('/api/sheets');
			if (!response.ok) {
				const errorData = await response.text();
				throw new Error(errorData || `Failed to fetch sheets: ${response.status}`);
			}
			const data = await response.json();
			sheets = data as Sheet[];
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'An unknown error occurred while fetching sheets.';
			errorLoadingSheets = message;
			console.error('Error fetching sheets:', err);
		} finally {
			isLoadingSheets = false;
		}
	}

	async function createSheet() {
		if (!newSheetName.trim()) {
			errorCreatingSheet = 'Sheet name cannot be empty.';
			return;
		}
		isCreatingSheet = true;
		errorCreatingSheet = null;
		try {
			const response = await fetch('/api/sheets', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ name: newSheetName.trim() })
			});
			if (!response.ok) {
				const errorData = await response.text();
				throw new Error(errorData || `Failed to create sheet: ${response.status}`);
			}
			const newSheet = await response.json();
			sheets = [...sheets, newSheet]; // Add to local list
			newSheetName = ''; // Clear input
			// Optionally, navigate to the new sheet: await goto(`/sheet/${newSheet.id}`);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'An unknown error occurred while creating the sheet.';
			errorCreatingSheet = message;
			console.error('Error creating sheet:', err);
		} finally {
			isCreatingSheet = false;
		}
	}

	onMount(() => {
		fetchSheets();
	});

</script>

<div class="container mx-auto p-4 md:p-8">
	<header class="mb-8">
		<h1 class="text-4xl font-bold tracking-tight">Your Sheets</h1>
		<p class="text-muted-foreground">
			Create new sheets or manage existing ones.
		</p>
	</header>

	<section class="mb-10">
		<h2 class="mb-4 text-2xl font-semibold">Create New Sheet</h2>
		<form on:submit|preventDefault={createSheet} class="flex items-start gap-3">
			<div class="flex-grow">
				<Input 
					bind:value={newSheetName} 
					placeholder="Enter sheet name (e.g., Q3 Marketing Candidates)" 
					disabled={isCreatingSheet}
					aria-label="New sheet name"
				/>
				{#if errorCreatingSheet}
					<p class="mt-1 text-sm text-red-600">{errorCreatingSheet}</p>
				{/if}
			</div>
			<Button type="submit" disabled={isCreatingSheet || !newSheetName.trim()}>
				<PlusCircle class="mr-2 h-5 w-5" />
				{isCreatingSheet ? 'Creating...' : 'Create Sheet'}
			</Button>
		</form>
	</section>

	<section>
		<h2 class="mb-6 text-2xl font-semibold">Existing Sheets</h2>
		{#if isLoadingSheets}
			<p class="text-muted-foreground">Loading sheets...</p>
		{:else if errorLoadingSheets}
			<p class="text-red-600">Error: {errorLoadingSheets}</p>
		{:else if sheets.length === 0}
			<p class="text-muted-foreground">No sheets found. Create one to get started!</p>
		{:else}
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each sheets as sheet (sheet.id)}
					<a href={`/sheet/${sheet.id}`} data-testid={`sheet-link-${sheet.id}`}>
						<Card.Root class="hover:shadow-lg transition-shadow duration-200 ease-in-out">
							<Card.Header>
								<Card.Title class="truncate" title={sheet.name}>{sheet.name}</Card.Title>
							</Card.Header>
							<Card.Content>
								<p class="text-sm text-muted-foreground">
									Created: {new Date(sheet.createdAt).toLocaleDateString()}
								</p>
								<p class="text-sm text-muted-foreground">
									Updated: {new Date(sheet.updatedAt).toLocaleDateString()}
								</p>
							</Card.Content>
							<Card.Footer class="pt-4">
								<Button variant="outline" size="sm" class="w-full">View Sheet</Button>
							</Card.Footer>
						</Card.Root>
					</a>
				{/each}
			</div>
		{/if}
	</section>
</div>