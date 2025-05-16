import { db } from '$lib/server/db';
import { sheet } from '$lib/server/db/schema';
import { json, error } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

// GET /api/sheets - List all sheets
export const GET: RequestHandler = async () => {
	try {
		const allSheets = await db.query.sheet.findMany({
			orderBy: [asc(sheet.createdAt)]
		});
		return json(allSheets);
	} catch (e: unknown) {
		console.error('Error fetching sheets:', e);
		const message = e instanceof Error ? e.message : 'Failed to fetch sheets';
		throw error(500, message);
	}
};

// POST /api/sheets - Create a new sheet
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const sheetName = body.name as string | undefined;

		if (!sheetName || typeof sheetName !== 'string' || sheetName.trim() === '') {
			throw error(400, 'Sheet name is required and must be a non-empty string.');
		}

		const [newSheet] = await db
			.insert(sheet)
			.values({
				name: sheetName.trim()
			})
			.returning();

		if (!newSheet) {
			throw error(500, 'Failed to create new sheet in database.');
		}

		return json(newSheet, { status: 201 });
	} catch (e: unknown) {
		console.error('Error creating sheet:', e);
		if (e instanceof Error && 'status' in e && typeof e.status === 'number') {
			// Forward SvelteKit errors
			throw error(e.status as number, e.message);
		}
		const message = e instanceof Error ? e.message : 'Failed to create sheet';
		throw error(500, message);
	}
}; 