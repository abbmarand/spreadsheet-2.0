import { db } from '$lib/server/db';
import { field as fieldSchema } from '$lib/server/db/schema';
import { json, error } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { type WebSocketServer, WebSocket } from 'ws'; // Changed to value import for WebSocket

// DELETE /api/sheet/[sheetId]/field/[fieldId] - Delete a field from a sheet
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { sheetId, fieldId } = params;

	if (!sheetId || !fieldId) {
		throw error(400, 'Sheet ID and Field ID are required in the path.');
	}

	try {
		// First, check if the field exists and belongs to the specified sheet
		const field = await db.query.field.findFirst({
			where: and(eq(fieldSchema.id, fieldId), eq(fieldSchema.sheetId, sheetId))
		});

		if (!field) {
			throw error(404, `Field with ID ${fieldId} not found on sheet ${sheetId}, or sheet does not exist.`);
		}

		// Delete associated fieldValues first (if any, Drizzle handles cascading deletes if schema is set up for it)
		// For explicit control or if cascading is not set: await db.delete(fieldValueSchema).where(eq(fieldValueSchema.fieldId, fieldId));
		// Assuming cascading delete for fieldValues or that they should be handled separately if needed.

		const [deletedField] = await db
			.delete(fieldSchema)
			.where(and(eq(fieldSchema.id, fieldId), eq(fieldSchema.sheetId, sheetId)))
			.returning(); // { id: string } or the full field, depending on DB driver

		if (!deletedField) {
			// This case should ideally be caught by the findFirst check, but as a safeguard:
			throw error(404, `Failed to delete field ${fieldId}. It might have been already deleted or an issue occurred.`);
		}

		// Broadcast the field deletion via WebSocket
		// Similar to field creation, but a different messageType, e.g., `${sheetId}.fieldDeleted`
		// The Table.svelte component currently removes fields locally upon successful DELETE response.
		// A WebSocket broadcast would ensure all other clients are updated too.
		if (locals.wss) {
			const wss = locals.wss as WebSocketServer;
			wss.clients.forEach((client: WebSocket) => {
				if (client.readyState === WebSocket.OPEN) {
					client.send(JSON.stringify({
						messageType: `${sheetId}.fieldDeleted`, // Define a new messageType for this
						data: { fieldId: fieldId, sheetId: sheetId }
					}));
				}
			});
		} else {
			console.warn('WebSocket server (locals.wss) not available. Cannot broadcast field deletion.');
		}

		return json({ success: true, fieldId: fieldId }, { status: 200 });
	} catch (e: unknown) {
		console.error(`Error deleting field ${fieldId} from sheet ${sheetId}:`, e);
		if (e instanceof Error && 'status' in e && typeof e.status === 'number') {
			throw error(e.status as number, e.message);
		}
		const message = e instanceof Error ? e.message : 'Failed to delete field';
		throw error(500, message);
	}
}; 