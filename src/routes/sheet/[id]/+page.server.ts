import { db } from '$lib/server/db';
import { sheet as sheetSchema } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const sheetId = params.id;

	if (!sheetId) {
		throw error(400, 'Sheet ID is required');
	}

	try {
		const sheet = await db.query.sheet.findFirst({
			where: eq(sheetSchema.id, sheetId),
			with: {
				fields: {
					orderBy: (fields, { asc }) => [asc(fields.createdAt)]
				},
				rows: {
					orderBy: (rows, { asc }) => [asc(rows.createdAt)],
					with: {
						fieldValues: {
							with: {
								field: true // Include field definition with each fieldValue
							}
						}
					}
				}
			}
		});

		console.log('sheet', sheet);

		if (!sheet) {
			throw error(404, 'Sheet not found');
		}

		// Ensure sheet.rows is an array and process it.
		const currentSheetRows = sheet.rows || []; // Default to empty array if sheet.rows is null/undefined
		const processedRows = currentSheetRows.map(r => ({
			...r,
			fieldValues: r.fieldValues || []
		}));
        console.log('processedRows', processedRows);

		return {
			sheet: {
				...sheet,
				rows: processedRows
			},
			fields: sheet.fields || [] // Also ensure fields is an array
		};
	} catch (e: unknown) {
		console.error('Error loading sheet:', e);
		// Drizzle or DB errors can be caught here
		if (e instanceof Error) {
			if (e.message.includes('Sheet not found')) {
				throw error(404, 'Sheet not found');
			}
			throw error(500, e.message || 'Failed to load sheet data');
		}
		throw error(500, 'An unknown error occurred while loading sheet data');
	}
};
