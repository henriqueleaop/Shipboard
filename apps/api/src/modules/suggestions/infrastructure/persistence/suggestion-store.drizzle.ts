import { sql, type SQL } from 'drizzle-orm';

import type { createDatabase } from '../../../../infrastructure/database/client.js';
import type {
  SuggestionListOptions,
  SuggestionReplay,
  SuggestionStore,
  SuggestionUnitOfWork,
  SuggestionWithCount,
} from '../../application/ports/suggestion-store.js';
import { Suggestion } from '../../domain/suggestion.js';

type Executor = {
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
};

const asDate = (value: unknown) =>
  value instanceof Date ? value : new Date(String(value));

function fromRow(row: Record<string, unknown>): Suggestion {
  return new Suggestion({
    id: String(row.id),
    boardId: String(row.board_id),
    authorId: String(row.author_id),
    title: String(row.title),
    description: String(row.description),
    status: String(row.status) as Suggestion['status'],
    version: Number(row.version),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
    deletedAt: row.deleted_at == null ? null : asDate(row.deleted_at),
  });
}

function fromCountRow(row: Record<string, unknown>): SuggestionWithCount {
  return {
    suggestion: fromRow(row),
    voteCount: Number(row.vote_count),
    cursorCreatedAt: String(row.cursor_created_at),
  };
}

function snapshot(value: Suggestion) {
  return {
    id: value.id,
    board_id: value.boardId,
    author_id: value.authorId,
    title: value.title,
    description: value.description,
    status: value.status,
    version: value.version,
    created_at: value.createdAt.toISOString(),
    updated_at: value.updatedAt.toISOString(),
    deleted_at: value.deletedAt?.toISOString() ?? null,
  };
}

const voteCount = sql`(SELECT count(*)::integer FROM votes v WHERE v.suggestion_id = s.id AND v.deleted_at IS NULL)`;
// PostgreSQL timestamps can carry microseconds that a JS Date cannot retain.
const cursorCreatedAt = sql`to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

class DrizzleSuggestionStore implements SuggestionStore {
  constructor(private readonly executor: Executor) {}

  async activeBoardSlug(id: string): Promise<string | null> {
    const result = await this.executor.execute(
      sql`SELECT slug FROM boards WHERE id = ${id}::uuid AND deleted_at IS NULL FOR SHARE`,
    );
    return result.rows[0] ? String(result.rows[0].slug) : null;
  }

  async insert(value: Suggestion): Promise<void> {
    await this.executor.execute(sql`
      INSERT INTO suggestions (id, board_id, author_id, title, description, status, version, created_at, updated_at)
      VALUES (${value.id}::uuid, ${value.boardId}::uuid, ${value.authorId}::uuid, ${value.title}, ${value.description}, ${value.status}, ${value.version}, ${value.createdAt}, ${value.updatedAt})
    `);
  }

  async find(id: string): Promise<SuggestionWithCount | null> {
    const result = await this.executor.execute(sql`
      SELECT s.*, ${voteCount} AS vote_count, ${cursorCreatedAt} AS cursor_created_at FROM suggestions s
      JOIN boards b ON b.id = s.board_id AND b.deleted_at IS NULL
      WHERE s.id = ${id}::uuid AND s.deleted_at IS NULL
    `);
    return result.rows[0] ? fromCountRow(result.rows[0]) : null;
  }

  async list(options: SuggestionListOptions): Promise<SuggestionWithCount[]> {
    const { boardId, status, cursor, limit, sort } = options;
    const result = await this.executor.execute(sql`
      SELECT s.*, ${voteCount} AS vote_count, ${cursorCreatedAt} AS cursor_created_at FROM suggestions s
      JOIN boards b ON b.id = s.board_id AND b.deleted_at IS NULL
      WHERE s.board_id = ${boardId}::uuid AND s.deleted_at IS NULL
        ${status ? sql`AND s.status = ${status}` : sql``}
        ${cursor && sort === 'newest' ? sql`AND (s.created_at, s.id) < (${cursor.createdAt}, ${cursor.id}::uuid)` : sql``}
        ${cursor && sort === 'most_voted' ? sql`AND (${voteCount}, s.created_at, s.id) < (${cursor.voteCount}, ${cursor.createdAt}, ${cursor.id}::uuid)` : sql``}
      ${sort === 'newest' ? sql`ORDER BY s.created_at DESC, s.id DESC` : sql`ORDER BY vote_count DESC, s.created_at DESC, s.id DESC`}
      LIMIT ${limit}
    `);
    return result.rows.map(fromCountRow);
  }

  async updateStatus(
    value: Suggestion,
    expectedVersion: number,
  ): Promise<boolean> {
    const result = await this.executor.execute(sql`
      UPDATE suggestions SET status = ${value.status}, updated_at = ${value.updatedAt}, version = version + 1
      WHERE id = ${value.id}::uuid AND board_id = ${value.boardId}::uuid
        AND deleted_at IS NULL AND version = ${expectedVersion}
      RETURNING id
    `);
    return result.rows.length === 1;
  }

  async tryReplayLock(scope: string, key: string): Promise<boolean> {
    const result = await this.executor.execute(
      sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${`${scope}:${key}`}, 0)) AS locked`,
    );
    return result.rows[0]?.locked === true;
  }

  async findReplay(
    scope: string,
    key: string,
  ): Promise<SuggestionReplay | null> {
    const result = await this.executor.execute(sql`
      SELECT request_hash, response_body, expires_at, response_location FROM suggestion_idempotency
      WHERE scope = ${scope} AND key = ${key}::uuid
    `);
    const row = result.rows[0];
    if (!row) return null;
    if (!row.response_body || typeof row.response_body !== 'object')
      throw new Error('Invalid suggestion replay.');
    return {
      requestHash: String(row.request_hash),
      suggestion: fromRow(row.response_body as Record<string, unknown>),
      expiresAt: asDate(row.expires_at),
      location: String(row.response_location),
    };
  }

  async deleteReplay(scope: string, key: string): Promise<void> {
    await this.executor.execute(
      sql`DELETE FROM suggestion_idempotency WHERE scope = ${scope} AND key = ${key}::uuid`,
    );
  }

  async saveReplay(
    scope: string,
    key: string,
    hash: string,
    value: Suggestion,
    expiresAt: Date,
    location: string,
  ): Promise<void> {
    await this.executor.execute(sql`
      INSERT INTO suggestion_idempotency
        (scope, key, request_hash, state, response_status, response_body, response_location, response_etag, created_at, expires_at)
      VALUES (${scope}, ${key}::uuid, ${hash}, 'completed', 201, ${JSON.stringify(snapshot(value))}::jsonb,
        ${location}, ${`"${value.version}"`}, ${new Date()}, ${expiresAt})
    `);
  }
}

export function createSuggestionUnitOfWork(
  database: ReturnType<typeof createDatabase>,
): SuggestionUnitOfWork {
  return {
    store: new DrizzleSuggestionStore(database.db),
    run: (work) =>
      database.db.transaction(async (transaction) =>
        work(new DrizzleSuggestionStore(transaction)),
      ),
  };
}
