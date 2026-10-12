import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const dossiers = sqliteTable('dossiers', {
id:text('id').primaryKey(),owner:text('owner').notNull(),data:text('data').notNull(),
revision:integer('revision').notNull().default(0),updated:text('updated').notNull(),
}, t=>[index('dossiers_owner_idx').on(t.owner)]);