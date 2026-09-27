import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { user } from '../../../../infrastructure/database/auth-schema.js';

export const boards = pgTable(
  'boards',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => user.id),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('boards_slug_unique').on(table.slug),
    index('boards_owner_active_created_idx').on(
      table.ownerId,
      table.deletedAt,
      table.createdAt,
      table.id,
    ),
    check('boards_version_positive', sql`${table.version} > 0`),
    check('boards_name_nonblank', sql`length(trim(${table.name})) > 0`),
  ],
);

export const boardIdempotency = pgTable(
  'board_idempotency',
  {
    scope: text('scope').notNull(),
    key: uuid('key').notNull(),
    requestHash: text('request_hash').notNull(),
    state: text('state').notNull(),
    responseStatus: integer('response_status').notNull(),
    responseBody: jsonb('response_body').notNull(),
    responseLocation: text('response_location').notNull(),
    responseEtag: text('response_etag').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scope, table.key] }),
    index('board_idempotency_expires_at_idx').on(table.expiresAt),
    check('board_idempotency_state', sql`${table.state} = 'completed'`),
  ],
);
