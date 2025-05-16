import type { AdapterAccountType } from '@auth/sveltekit/adapters';
import { relations } from 'drizzle-orm';

import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from 'drizzle-orm/pg-core';


type CustomFieldType = 'boolean' | 'date' | 'number' | 'text';

export const users = pgTable('user', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name'),
	email: text('email').unique(),
	emailVerified: timestamp('emailVerified', { mode: 'date' }),
	image: text('image')
});

export const accounts = pgTable(
	'account',
	{
		userId: text('userId')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		type: text('type').$type<AdapterAccountType>().notNull(),
		provider: text('provider').notNull(),
		providerAccountId: text('providerAccountId').notNull(),
		refresh_token: text('refresh_token'),
		access_token: text('access_token'),
		expires_at: integer('expires_at'),
		token_type: text('token_type'),
		scope: text('scope'),
		id_token: text('id_token'),
		session_state: text('session_state')
	},
	(account) => [
		{
			compoundKey: primaryKey({
				columns: [account.provider, account.providerAccountId]
			})
		}
	]
);

export const sessions = pgTable('session', {
	sessionToken: text('sessionToken').primaryKey(),
	userId: text('userId')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expires: timestamp('expires', { mode: 'date' }).notNull()
});

export const verificationTokens = pgTable(
	'verificationToken',
	{
		identifier: text('identifier').notNull(),
		token: text('token').notNull(),
		expires: timestamp('expires', { mode: 'date' }).notNull()
	},
	(verificationToken) => [
		{
			compositePk: primaryKey({
				columns: [verificationToken.identifier, verificationToken.token]
			})
		}
	]
);

export const authenticators = pgTable(
	'authenticator',
	{
		credentialID: text('credentialID').notNull().unique(),
		userId: text('userId')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		providerAccountId: text('providerAccountId').notNull(),
		credentialPublicKey: text('credentialPublicKey').notNull(),
		counter: integer('counter').notNull(),
		credentialDeviceType: text('credentialDeviceType').notNull(),
		credentialBackedUp: boolean('credentialBackedUp').notNull(),
		transports: text('transports')
	},
	(authenticator) => [
		{
			compositePK: primaryKey({
				columns: [authenticator.userId, authenticator.credentialID]
			})
		}
	]
);

export const authenticatorRelations = relations(authenticators, ({ one }) => ({
	user: one(users, {
		fields: [authenticators.userId],
		references: [users.id]
	})
}));

export const chat = pgTable('chat', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text('title'),
	createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
	updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow()
});

export const chatRelations = relations(chat, ({ many }) => ({ messages: many(chatMessage) }));

export const chatMessage = pgTable('chatMessage', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	chatId: text('chatId')
		.notNull()
		.references(() => chat.id, { onDelete: 'cascade' }),
	role: text('role').notNull(),
	content: text('content'),
	createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow()
});

export const messageChunk = pgTable('messageChunk', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	chatMessageId: text('chatMessageId')
		.notNull()
		.references(() => chatMessage.id, { onDelete: 'cascade' }),
	chunk: jsonb('chunk'),
	createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow()
});

export const chatMessageRelations = relations(chatMessage, ({ one, many }) => ({
	chat: one(chat, {
		fields: [chatMessage.chatId],
		references: [chat.id]
	}),
	messageChunks: many(messageChunk)
}));

export const messageChunkRelations = relations(messageChunk, ({ one }) => ({
	chatMessage: one(chatMessage, {
		fields: [messageChunk.chatMessageId],
		references: [chatMessage.id]
	})
}));

export const sheet = pgTable('sheet', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name'),
	createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
	updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow()
});

export const field = pgTable(
	'field',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		sheetId: text('sheetId')
			.notNull()
			.references(() => sheet.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		type: text('type').$type<CustomFieldType>().notNull(),
		createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow()
	},
	(table) => ({
		sheetIdIdx: index('field_sheetId_idx').on(table.sheetId)
	})
);

export const row = pgTable('row', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	sheetId: text('sheetId')
		.notNull()
		.references(() => sheet.id, { onDelete: 'cascade' }),
	createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
	updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow()
});

export const fieldValue = pgTable(
	'fieldValue',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		rowId: text('rowId')
			.notNull()
			.references(() => row.id, { onDelete: 'cascade' }),
		fieldId: text('fieldId')
			.notNull()
			.references(() => field.id, { onDelete: 'cascade' }),
		value: text('value'),
		reasoning: text('reasoning'),
		createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow()
	},
	(table) => ({
		rowIdIdx: index('fieldValue_rowId_idx').on(table.rowId),
		fieldIdIdx: index('fieldValue_fieldId_idx').on(table.fieldId)
	})
);

export const sheetRelations = relations(sheet, ({ many }) => ({
	fields: many(field),
	rows: many(row)
}));

export const fieldRelations = relations(field, ({ one, many }) => ({
	sheet: one(sheet, {
		fields: [field.sheetId],
		references: [sheet.id]
	}),
	fieldValues: many(fieldValue)
}));

export const rowRelations = relations(row, ({ one, many }) => ({
	sheet: one(sheet, {
		fields: [row.sheetId],
		references: [sheet.id]
	}),
	fieldValues: many(fieldValue)
}));

export const fieldValueRelations = relations(fieldValue, ({ one }) => ({
	row: one(row, {
		fields: [fieldValue.rowId],
		references: [row.id]
	}),
	field: one(field, {
		fields: [fieldValue.fieldId],
		references: [field.id]
	})
}));
