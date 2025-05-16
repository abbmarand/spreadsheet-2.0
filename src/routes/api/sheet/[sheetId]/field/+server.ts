import { db } from '$lib/server/db';
import { field as fieldSchema, sheet as sheetSchema } from '$lib/server/db/schema';
import { json, error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
// import { broadcastToUsers } from '$lib/websocket/server.svelte.js'; // Using manual broadcast for now
import { type WebSocketServer, WebSocket } from 'ws'; // Changed to value import for WebSocket to access WebSocket.OPEN

// POST /api/sheet/[sheetId]/field - Create a new field for a sheet
export const POST: RequestHandler = async ({ request, params, locals }) => {
	const sheetId = params.sheetId;

	if (!sheetId) {
		throw error(400, 'Sheet ID is required in the path.');
	}

	try {
		// Check if sheet exists
		const sheet = await db.query.sheet.findFirst({
			where: eq(sheetSchema.id, sheetId)
		});
		if (!sheet) {
			throw error(404, `Sheet with ID ${sheetId} not found.`);
		}

		const body = await request.json();
		const { name, description, type } = body;

		if (!name || typeof name !== 'string' || name.trim() === '') {
			throw error(400, 'Field name is required and must be a non-empty string.');
		}
		if (!description || typeof description !== 'string' || description.trim() === '') {
			// Optional: make description optional or enforce non-empty
			throw error(400, 'Field description is required and must be a non-empty string.');
		}
		const validTypes = ['text', 'number', 'boolean', 'date'];
		if (!type || typeof type !== 'string' || !validTypes.includes(type)) {
			throw error(400, `Field type must be one of: ${validTypes.join(', ')}.`);
		}

		const [newField] = await db
			.insert(fieldSchema)
			.values({
				sheetId: sheetId,
				name: name.trim(),
				description: description.trim(),
				type: type as 'text' | 'number' | 'boolean' | 'date' // Cast to the specific union type
			})
			.returning();

		if (!newField) {
			throw error(500, 'Failed to create new field in database.');
		}

		// Broadcast the new field creation via WebSocket
		if (locals.wss) {
			const wss = locals.wss as WebSocketServer; // Assuming locals.wss is a 'ws' WebSocketServer instance
			wss.clients.forEach((client: WebSocket) => { // Type client as WebSocket from 'ws'
				if (client.readyState === WebSocket.OPEN) { // Use WebSocket.OPEN from 'ws'
					client.send(JSON.stringify({
						messageType: `${sheetId}.fieldCreated`, // Match client-side channel
						data: { field: newField, sheetId: sheetId } // Payload matches client expectation
					}));
				}
			});
		} else {
			console.warn('WebSocket server (locals.wss) not available. Cannot broadcast field creation.');
		}

		return json(newField, { status: 201 });
	} catch (e: unknown) {
		console.error(`Error creating field for sheet ${sheetId}:`, e);
		if (e instanceof Error && 'status' in e && typeof e.status === 'number') {
			throw error(e.status as number, e.message);
		}
		const message = e instanceof Error ? e.message : 'Failed to create field';
		throw error(500, message);
	}
}; 