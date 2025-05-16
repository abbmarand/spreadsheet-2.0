import type { InferSelectModel } from 'drizzle-orm';
// Crucially, use 'import type' for schema objects when defining types here
import type { 
    field as fieldSchemaType, 
    row as rowSchemaType, 
    fieldValue as fieldValueSchemaType 
} from '$lib/server/db/schema';

export type Field = InferSelectModel<typeof fieldSchemaType>;
export type Row = InferSelectModel<typeof rowSchemaType>;
export type FieldValue = InferSelectModel<typeof fieldValueSchemaType>;

// Enriched types for component/frontend usage, matching what +page.server.ts prepares
export type ClientFieldValue = FieldValue & { 
    field?: Field; // Field definition might be included
};
export type ClientRow = Row & {
    fieldValues?: ClientFieldValue[];
}; 