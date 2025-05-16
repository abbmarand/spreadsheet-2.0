// src/hooks.server.ts
import type { HandleServerError } from '@sveltejs/kit';
import { type Handle, redirect, type RequestEvent } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { eq } from 'drizzle-orm';

import { building } from '$app/environment';

import { users } from '$lib/server/db/schema';

import type { ExtendedWebSocket } from './app';
import { handle as AuthHandle } from './auth';
import { GlobalThisWSS } from '$lib/websocket/server.svelte';
import type { ExtendedGlobal } from '$lib/websocket/server.svelte';
import { db } from '$lib/server/db';

const authorizationHandle: Handle = async ({ event, resolve }) => {
	const auth = await event.locals.auth();
	
	// Handle protected routes
	if (
		(event.url.pathname.startsWith('/api')) ||
		event.url.pathname.startsWith('/dashboard')
	) {
		if (!auth?.user?.email) {
			redirect(302, '/signin');
		}

		const user = await db.query.users.findFirst({
			where: eq(users.email, auth.user.email)
		});

		if (!user) {
			redirect(302, '/signin');
		}

		event.locals.user = user;
		event.locals.session = auth;
	}

	return resolve(event);
};

const startupWebsocketServer = async (event: RequestEvent) => {
	const wss = (globalThis as ExtendedGlobal)[GlobalThisWSS];
	if (wss !== undefined) {
		wss.on('connection', async (ws: ExtendedWebSocket) => {
			const user = event.locals.user;

			if (!user) {
				return;
			}
			ws.userId = user.id;
		});
	}
};

const webSocketHandle: Handle = async ({ event, resolve }) => {
	await startupWebsocketServer(event);
	if (!building) {
		const wss = (globalThis as ExtendedGlobal)[GlobalThisWSS];
		if (wss !== undefined) {
			event.locals.wss = wss;
		}
	}

	const response = await resolve(event, {
		filterSerializedResponseHeaders: (name: string) => name === 'content-type'
	});

	return response;
};

export const handle: Handle = sequence(
	AuthHandle,
	authorizationHandle,
	webSocketHandle
);

export const handleError: HandleServerError = ({ error, event }) => {
	console.error('❌  Server error for', event.url, '\n', error);
	// Return a safe payload – it becomes $page.error in +error.svelte
	return { message: 'Unexpected server error' };
};
