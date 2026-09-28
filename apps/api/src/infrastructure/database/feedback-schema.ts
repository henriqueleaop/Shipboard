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

import { user } from './auth-schema.js';
import { boards } from '../../modules/boards/infrastructure/persistence/board-tables.js';

export const suggestions = pgTable(
  'suggestions',
  {
    id: uuid('id').primaryKey(),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id),
    authorId: uuid('author_id')
      .notNull()
      .references(() => user.id),
    title: text('title').notNull(),
    description: text('description').notNull(),
    status: text('status').notNull().default('UNDER_REVIEW'),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('suggestions_board_active_created_idx')
      .on(table.boardId, table.createdAt, table.id)
      .where(sql`${table.deletedAt} IS NULL`),
    index('suggestions_board_active_status_idx')
      .on(table.boardId, table.status)
      .where(sql`${table.deletedAt} IS NULL`),
    check('suggestions_title_nonblank', sql`length(trim(${table.title})) >= 3`),
    check(
      'suggestions_description_nonblank',
      sql`length(trim(${table.description})) > 0`,
    ),
    check('suggestions_version_positive', sql`${table.version} > 0`),
    check(
      'suggestions_status_allowed',
      sql`${table.status} IN ('UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'SHIPPED', 'REJECTED')`,
    ),
  ],
);

export const suggestionIdempotency = pgTable(
  'suggestion_idempotency',
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
    index('suggestion_idempotency_expires_at_idx').on(table.expiresAt),
    check(
      'suggestion_idempotency_state_completed',
      sql`${table.state} = 'completed'`,
    ),
  ],
);

export const votes = pgTable(
  'votes',
  {
    id: uuid('id').primaryKey(),
    suggestionId: uuid('suggestion_id')
      .notNull()
      .references(() => suggestions.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('votes_one_active_user_suggestion_idx')
      .on(table.suggestionId, table.userId)
      .where(sql`${table.deletedAt} IS NULL`),
    index('votes_suggestion_active_idx')
      .on(table.suggestionId)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);
