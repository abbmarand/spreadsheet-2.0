<script lang="ts">
	import { ArrowUpDown, PlusIcon, Trash2 } from 'lucide-svelte';
	import { onMount } from 'svelte';

	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import * as Table from '$lib/components/ui/table';
	import { socket } from '$lib/websocket/client.svelte.js';

	// Import shared types from the .d.ts file
	import type { Field, ClientRow, ClientFieldValue } from '$lib/types/db.d.ts';

	// --- WebSocket Payload Types (using imported shared types) ---
	type FieldValueCreatedPayload = {
		fieldValue: ClientFieldValue;
		rowId: string; // To identify which row to update
	};
	type FieldCreatedPayload = {
		field: Field;
		sheetId: string; // Ensure this matches the event source if needed for filtering
	};

	// --- Component Props ---
	let {
		rows: initialRows,
		sheetId,
		fields: initialFields
	} = $props<{
		rows: ClientRow[];
		sheetId: string;
		fields: Field[];
	}>();

	// --- Component State ---
	type SortKey = string; // Field name or special key like 'matchScore'
	type SortDirection = 'asc' | 'desc';

	let rows = $state<ClientRow[]>(initialRows || []);
	let fields = $state<Field[]>(initialFields || []); // Represents all available field definitions

	let sortKey = $state<SortKey>(''); // No default sort column initially
	let sortDirection = $state<SortDirection>('asc');
	let newFieldName = $state('');
	let newFieldDescription = $state('');
	let newFieldType = $state<'boolean' | 'date' | 'number' | 'text'>('text');
	let isAddDialogOpen = $state(false);
	let deleteDialogStates = $state<Record<string, boolean>>({});
	let isCellDialogOpen = $state(false);
	let dialogContent = $state<string | null>(null);

	// --- WebSocket Listeners ---
	onMount(() => {
		if (!sheetId) {
			console.warn('Sheet ID not available on mount for WebSocket listeners.');
			return;
		}

		// Assuming WebSocket events are now sheet-specific for fields and values
		const fieldCreatedChannel = `${sheetId}.fieldCreated`;
		const fieldValueCreatedChannel = `${sheetId}.fieldValueCreated`;

		console.log(
			`[onMount] Listening on channels: ${fieldCreatedChannel}, ${fieldValueCreatedChannel}`
		);

		const handleFieldCreated = (payload: FieldCreatedPayload) => {
			console.log('Received fieldCreated:', payload);
			if (payload.field) {
				if (payload.sheetId && payload.sheetId !== sheetId) {
					console.log('Received fieldCreated for a different sheet, ignoring.');
					return;
				}
				if (!fields.some((f) => f.id === payload.field.id)) {
					fields = [...fields, payload.field];
					console.log('Added new field to state:', payload.field.name);
				}
			}
		};

		const handleFieldValueCreated = (payload: FieldValueCreatedPayload) => {
			console.log('Received fieldValueCreated:', payload);
			if (payload.fieldValue && payload.rowId) {
				const newValue = payload.fieldValue;
				const rowIndex = rows.findIndex((r) => r.id === payload.rowId);

				if (rowIndex !== -1) {
					const updatedRows = [...rows];
					const targetRow = { ...updatedRows[rowIndex] }; // Create a new object for the row

					targetRow.fieldValues = targetRow.fieldValues ? [...targetRow.fieldValues] : []; // New array for fieldValues

					const existingValueIndex = targetRow.fieldValues.findIndex(
						(v) => v.fieldId === newValue.fieldId
					);

					if (existingValueIndex !== -1) {
						// Update existing value
						targetRow.fieldValues[existingValueIndex] = {
							...targetRow.fieldValues[existingValueIndex],
							...newValue
						};
					} else {
						// Add new value
						targetRow.fieldValues.push(newValue);
					}
					updatedRows[rowIndex] = targetRow;
					rows = updatedRows; // Trigger reactivity
					console.log(
						`Updated/Added value for fieldId ${newValue.fieldId} to row ${payload.rowId}`
					);
				} else {
					console.warn(`Row with id ${payload.rowId} not found for fieldValueCreated.`);
				}
			}
		};

		socket.on(fieldCreatedChannel, handleFieldCreated);
		socket.on(fieldValueCreatedChannel, handleFieldValueCreated);

		return () => {
			console.log(`[onDestroy] Cleaning up listeners for sheetId: ${sheetId}`);
			socket.off(fieldCreatedChannel, handleFieldCreated);
			socket.off(fieldValueCreatedChannel, handleFieldValueCreated);
		};
	});

	// --- Sorting Logic ---
	const sortedRows: ClientRow[] = $derived.by(() => {
		const currentSortKey = sortKey;
		const currentSortDirection = sortDirection;
		if (!currentSortKey) return rows; // If no sort key, return original rows

		const getComparableData = (row: ClientRow, fieldName: string) => {
			const fieldDefinition = fields.find((f) => f.name === fieldName);
			if (!fieldDefinition || !row.fieldValues) {
				return { value: undefined, type: 'text' as Field['type'] };
			}
			const fieldValueObj = row.fieldValues.find((fv) => fv.fieldId === fieldDefinition.id);
			return { value: fieldValueObj?.value, type: fieldDefinition.type };
		};

		const sorted = [...rows].sort((a: ClientRow, b: ClientRow) => {
			let comparison = 0;
			const aData = getComparableData(a, currentSortKey);
			const bData = getComparableData(b, currentSortKey);

			const valA = aData.value;
			const valB = bData.value;
			const fieldType = aData.type; // Type comes from field definition

			const defaultEmptyValue = (type: Field['type'] | undefined) => {
				switch (type) {
					case 'number':
						return currentSortDirection === 'asc' ? Infinity : -Infinity; // Sort empty numbers last/first
					case 'date':
						// Return a Date object that represents the extreme for sorting
						return currentSortDirection === 'asc' ? new Date(8640000000000000) : new Date(-8640000000000000); 
					case 'boolean':
						return false; // Treat missing booleans as false
					default:
						return ''; // Treat missing text as empty string
				}
			};

			let finalA = valA === undefined || valA === null ? defaultEmptyValue(fieldType) : valA;
			let finalB = valB === undefined || valB === null ? defaultEmptyValue(fieldType) : valB;
			
			// Ensure finalA and finalB are of consistent types for comparison based on fieldType
			if (fieldType === 'number') {
				finalA = finalA === Infinity || finalA === -Infinity ? finalA : parseFloat(String(finalA));
				finalB = finalB === Infinity || finalB === -Infinity ? finalB : parseFloat(String(finalB));
				finalA = isNaN(Number(finalA)) ? defaultEmptyValue(fieldType) : Number(finalA);
				finalB = isNaN(Number(finalB)) ? defaultEmptyValue(fieldType) : Number(finalB);
			} else if (fieldType === 'date') {
				let timeA: number, timeB: number;
				
				if (finalA instanceof Date) { // finalA is the sentinel Date from defaultEmptyValue
					timeA = finalA.getTime();
				} else {
					const dateAObj = new Date(String(finalA));
					timeA = isNaN(dateAObj.getTime()) ? (defaultEmptyValue('date') as Date).getTime() : dateAObj.getTime();
				}

				if (finalB instanceof Date) { // finalB is the sentinel Date from defaultEmptyValue
					timeB = finalB.getTime();
				} else {
					const dateBObj = new Date(String(finalB));
					timeB = isNaN(dateBObj.getTime()) ? (defaultEmptyValue('date') as Date).getTime() : dateBObj.getTime();
				}
				finalA = timeA;
				finalB = timeB;
			} else if (fieldType === 'boolean') {
				finalA = String(finalA).toLowerCase() === 'true' ? 1 : 0;
				finalB = String(finalB).toLowerCase() === 'true' ? 1 : 0;
			} else { // text
				finalA = String(finalA);
				finalB = String(finalB);
			}


			if (finalA < finalB) {
				comparison = -1;
			} else if (finalA > finalB) {
				comparison = 1;
			} else {
				comparison = 0;
			}
			return comparison;
		});
		return currentSortDirection === 'asc' ? sorted : sorted.reverse();
	});


	function sortBy(key: SortKey) {
		if (sortKey === key) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDirection = 'asc';
		}
	}

	// --- API Actions ---
	async function addField() {
		const name = newFieldName.trim();
		const description = newFieldDescription.trim();
		const type = newFieldType;

		if (!name || !description) return;

		newFieldName = '';
		newFieldDescription = '';
		newFieldType = 'text';
		isAddDialogOpen = false;

		try {
			const response = await fetch(`/api/sheet/${sheetId}/field`, { // Updated endpoint
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, description, type })
			});

			if (!response.ok) {
				console.error('Failed to add field:', await response.text());
			} else {
				console.log('Field creation request successful (updates via WebSocket)');
				// No local state update here, rely on WebSocket for consistency
			}
		} catch (error) {
			console.error('Error sending request to add field:', error);
		}
	}

	async function deleteField(fieldId: string) {
		console.log(`Attempting to delete field: ${fieldId}`);
		try {
			const response = await fetch(`/api/sheet/${sheetId}/field/${fieldId}`, { // Updated endpoint
				method: 'DELETE'
			});

			if (!response.ok) {
				const errorData = await response.json();
				console.error('Failed to delete field:', response.status, errorData);
			} else {
				console.log('Field deleted successfully');
				delete deleteDialogStates[fieldId]; // Close dialog

				// Local optimistic updates (server should confirm via WebSocket or full reload if necessary)
				fields = fields.filter((f) => f.id !== fieldId);
				rows = rows.map((r: ClientRow) => {
					if (r.fieldValues) {
						return {
							...r,
							fieldValues: r.fieldValues.filter((fv) => fv.fieldId !== fieldId)
						};
					}
					return r;
				});
			}
		} catch (error) {
			console.error('Error sending delete field request:', error);
		}
	}

	// --- UI Helpers ---
	function showFullContent(content: string | null | undefined) {
		if (content !== null && content !== undefined) { // Explicitly check for null/undefined
			dialogContent = String(content);
			isCellDialogOpen = true;
		} else if (content === null) { // Handle null specifically if needed, or treat as empty
			dialogContent = ''; // Or 'N/A' or keep null to show nothing
			isCellDialogOpen = true;
		}
	}
	
	// Helper to get display string, truncation, and reasoning for any field by its name
	function getFieldDisplayData(row: ClientRow, fieldName: string, maxLength?: number): { full: string; truncated: string; isLong: boolean; reasoning?: string | null; isLoading: boolean } {
		const fieldDef = fields.find(f => f.name === fieldName);
		if (!fieldDef) return { full: 'N/A', truncated: 'N/A', isLong: false, reasoning: null, isLoading: true };

		const fieldValueObj = row.fieldValues?.find(val => val.fieldId === fieldDef.id);
		const value = fieldValueObj?.value;
		const isLoading = value === undefined && fieldDef !== undefined; // Undefined value for an existing field might mean loading

		let displayValue: string;

		if (value == null || String(value).trim() === '') {
			displayValue = isLoading ? '...' : 'N/A'; // Show '...' if loading, else 'N/A'
		} else {
			switch (fieldDef.type) {
				case 'boolean':
					displayValue = String(value).toLowerCase() === 'true' ? 'Yes' : 'No';
					break;
				case 'date':
					const date = new Date(String(value));
					displayValue = isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
					break;
				default: // number, text
					displayValue = String(value);
			}
		}
		
		const isLong = !!maxLength && displayValue !== 'N/A' && displayValue !== '...' && displayValue.length > maxLength;
		const truncated = isLong ? displayValue.slice(0, maxLength) + '...' : displayValue;
		
		return { full: displayValue, truncated, isLong, reasoning: fieldValueObj?.reasoning, isLoading };
	}

	const totalColspan = $derived(fields.length + 1); // +1 for add field button column

</script>

{#if initialRows && initialFields}
<Table.Root>
	<Table.Header>
		<Table.Row>
			<!-- Headers from 'fields' prop -->
			{#each fields as field (field.id)}
				<Table.Head>
					<div class="flex items-center justify-between">
						<Button
							variant="ghost"
							onclick={() => sortBy(field.name)}
							class="h-auto flex-grow justify-start p-0 text-left"
						>
							{field.name}
							<ArrowUpDown class="ml-2 h-4 w-4" />
						</Button>
						<Dialog.Root bind:open={deleteDialogStates[field.id]}>
							<Dialog.Trigger asChild let:builder>
								<Button
									builders={[builder]}
									variant="ghost"
									size="icon"
									class="dark:hover:bg-red-250 ml-1 h-6 w-6 shrink-0 hover:bg-red-300"
									aria-label={`Delete field ${field.name}`}
									onclick={() => (deleteDialogStates[field.id] = true)}
								>
									<Trash2 class="h-4 w-4 text-destructive" />
								</Button>
							</Dialog.Trigger>
							<Dialog.Content>
								<Dialog.Header>
									<Dialog.Title class="text-lg font-semibold">Delete Field</Dialog.Title>
								</Dialog.Header>
								<p class="py-4">
									Are you sure you want to delete the field "{field.name}"? All associated data for
									this field will be permanently removed. This action cannot be undone.
								</p>
								<Dialog.Footer class="flex justify-end gap-2 pt-4">
									<Button variant="outline" onclick={() => (deleteDialogStates[field.id] = false)}
										>Cancel</Button
									>
									<Button variant="destructive" onclick={() => deleteField(field.id)}>Delete</Button
									>
								</Dialog.Footer>
							</Dialog.Content>
						</Dialog.Root>
					</div>
				</Table.Head>
			{/each}

			<Table.Head class="w-auto text-right">
				<Dialog.Root bind:open={isAddDialogOpen}>
					<Dialog.Trigger asChild let:builder>
						<Button
							builders={[builder]}
							onclick={() => (isAddDialogOpen = true)}
							variant="outline"
							size="sm"
							class="flex items-center gap-1"
						>
							<PlusIcon class="h-4 w-4" /> Add Field
						</Button>
					</Dialog.Trigger>
					<Dialog.Content class="sm:max-w-md">
						<Dialog.Header>
							<Dialog.Title class="text-lg font-semibold">Add Custom Field</Dialog.Title>
							<Dialog.Description class="text-sm text-muted-foreground">
								This field will be added for all items. For AI-generated values, ensure the
								description is clear.
							</Dialog.Description>
						</Dialog.Header>
						<div class="grid gap-4 py-3">
							<div class="grid gap-2">
								<label for="name" class="text-sm font-medium">Field Name</label>
								<Input
									id="name"
									bind:value={newFieldName}
									placeholder="e.g., 'Years of Experience'"
								/>
							</div>
							<div class="grid gap-2">
								<label for="description" class="text-sm font-medium">Field Description</label>
								<Input
									id="description"
									bind:value={newFieldDescription}
									placeholder="e.g., 'The number of years of experience'"
								/>
							</div>
							<div class="grid gap-2">
								<label for="fieldType" class="text-sm font-medium">Field Type</label>
								<Select.Root
									bind:value={newFieldType}
								>
									<Select.Trigger id="fieldType" class="w-full">
										<Select.Value placeholder="Select field type..." />
									</Select.Trigger>
									<Select.Content>
										<Select.Item value="text">Text</Select.Item>
										<Select.Item value="number">Number</Select.Item>
										<Select.Item value="boolean">Boolean</Select.Item>
										<Select.Item value="date">Date</Select.Item>
									</Select.Content>
								</Select.Root>
							</div>
						</div>
						<Dialog.Footer class="flex justify-end gap-2 pt-2">
							<Button variant="outline" onclick={() => (isAddDialogOpen = false)}>Cancel</Button>
							<Button variant="default" onclick={addField}>Add Field</Button>
						</Dialog.Footer>
					</Dialog.Content>
				</Dialog.Root>
			</Table.Head>
		</Table.Row>
	</Table.Header>
	<Table.Body>
		{#if sortedRows.length > 0}
			{#each sortedRows as row (row.id)}
				<Table.Row>
					<!-- Cells from 'fields' prop -->
					{#each fields as field (field.id)}
						{@const cellData = getFieldDisplayData(row, field.name, 25)}
						{@const fieldDef = fields.find(f => f.id === field.id)}
						<Table.Cell
							class="{cellData.isLong || cellData.reasoning ? 'cursor-pointer' : ''} {fieldDef?.type === 'number' ? 'text-center' : ''}"
							onclick={() => (cellData.isLong || cellData.reasoning) && showFullContent(cellData.reasoning ? `${cellData.full}\n\nReasoning:\n${cellData.reasoning}` : cellData.full)}
						>
							{cellData.isLoading ? '...' : cellData.truncated}
						</Table.Cell>
					{/each}
				</Table.Row>
			{/each}
		{:else}
			<Table.Row>
				<Table.Cell colspan={totalColspan} class="h-24 text-center text-muted-foreground">
					No data found for this sheet yet.
				</Table.Cell>
			</Table.Row>
		{/if}
	</Table.Body>
</Table.Root>
{:else}
 <p>Loading table data or missing required props...</p>
{/if}

<!-- Reusable Dialog for Full Cell Content -->
<Dialog.Root bind:open={isCellDialogOpen}>
	<Dialog.Content class="max-w-xl">
		<Dialog.Header>
			<Dialog.Title>Full Value</Dialog.Title>
		</Dialog.Header>
		<div class="mt-4 max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words">
			{dialogContent}
		</div>
		<Dialog.Footer class="mt-4">
			<Button variant="outline" onclick={() => (isCellDialogOpen = false)}>Close</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
