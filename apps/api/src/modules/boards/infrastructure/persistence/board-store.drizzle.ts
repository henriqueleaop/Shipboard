import { sql, type SQL } from 'drizzle-orm';

import type { createDatabase } from '../../../../infrastructure/database/client.js';
import { BoardError } from '../../application/board-error.js';
import type {
  BoardCursor,
  BoardStore,
  BoardUnitOfWork,
  ReplayRecord,
} from '../../application/ports/board-store.js';
import { Board } from '../../domain/board.js';

type Executor = {
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
};

function date(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function mapBoard(row: Record<string, unknown>): Board {
  return new Board({
    id: String(row.id),
    ownerId: String(row.owner_id),
    name: String(row.name),
    slug: String(row.slug),
    description: String(row.description),
    visibility: String(row.visibility) as Board['visibility'],
    githubRepositoryUrl:
      row.github_repository_url == null
        ? null
        : String(row.github_repository_url),
    version: Number(row.version),
    createdAt: date(row.created_at),
    updatedAt: date(row.updated_at),
    deletedAt: row.deleted_at == null ? null : date(row.deleted_at),
  });
}

function snapshot(board: Board) {
  return {
    id: board.id,
    owner_id: board.ownerId,
    name: board.name,
    slug: board.slug,
    description: board.description,
    visibility: board.visibility,
    github_repository_url: board.githubRepositoryUrl,
    version: board.version,
    created_at: board.createdAt.toISOString(),
    updated_at: board.updatedAt.toISOString(),
    deleted_at: board.deletedAt?.toISOString() ?? null,
  };
}

function translateUnique(error: unknown): never {
  const cause = error instanceof Error ? error.cause : error;
  if (
    cause &&
    typeof cause === 'object' &&
    'code' in cause &&
    cause.code === '23505' &&
    'constraint' in cause &&
    (cause.constraint === 'boards_slug_unique' ||
      cause.constraint === 'boards_owner_slug_unique')
  ) {
    throw new BoardError('SLUG_CONFLICT');
  }
  throw error;
}

class DrizzleBoardStore implements BoardStore {
  constructor(private readonly executor: Executor) {}

  async insert(board: Board): Promise<void> {
    try {
      await this.executor.execute(sql`
        INSERT INTO boards (id, owner_id, name, slug, description, visibility, github_repository_url, version, created_at, updated_at, deleted_at)
        VALUES (${board.id}, ${board.ownerId}, ${board.name}, ${board.slug}, ${board.description}, ${board.visibility}, ${board.githubRepositoryUrl}, ${board.version}, ${board.createdAt}, ${board.updatedAt}, NULL)
      `);
    } catch (error) {
      translateUnique(error);
    }
  }

  async find(id: string): Promise<Board | null> {
    const result = await this.executor.execute(sql`
      SELECT id, owner_id, name, slug, description, visibility, github_repository_url, version, created_at, updated_at, deleted_at
      FROM boards WHERE id = ${id}::uuid AND deleted_at IS NULL
    `);
    return result.rows[0] ? mapBoard(result.rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<Board | null> {
    const result = await this.executor.execute(sql`
      SELECT id, owner_id, name, slug, description, visibility, github_repository_url, version, created_at, updated_at, deleted_at
      FROM boards WHERE slug = ${slug} AND deleted_at IS NULL
    `);
    return result.rows[0] ? mapBoard(result.rows[0]) : null;
  }

  async findPublicByIdentity(
    username: string,
    slug: string,
    actorId?: string,
  ): Promise<{ board: Board; ownerUsername: string } | null> {
    const result = await this.executor.execute(sql`
      SELECT b.id, b.owner_id, b.name, b.slug, b.description, b.visibility,
        b.github_repository_url, b.version, b.created_at, b.updated_at,
        b.deleted_at, u.username AS owner_username
      FROM boards b JOIN "user" u ON u.id = b.owner_id
      WHERE u.username = ${username} AND b.slug = ${slug}
        AND b.deleted_at IS NULL
        AND (b.visibility IN ('PUBLIC', 'UNLISTED')
          ${actorId ? sql`OR b.owner_id = ${actorId}::uuid` : sql``})
      LIMIT 1
    `);
    const row = result.rows[0];
    if (!row || typeof row.owner_username !== 'string') return null;
    return { board: mapBoard(row), ownerUsername: row.owner_username };
  }

  async findLegacyPublicBySlug(
    slug: string,
  ): Promise<{ board: Board; ownerUsername: string } | null> {
    const result = await this.executor.execute(sql`
      SELECT b.id, b.owner_id, b.name, b.slug, b.description, b.visibility,
        b.github_repository_url, b.version, b.created_at, b.updated_at,
        b.deleted_at, u.username AS owner_username
      FROM boards b JOIN "user" u ON u.id = b.owner_id
      WHERE b.slug = ${slug} AND b.visibility = 'PUBLIC' AND b.deleted_at IS NULL
      LIMIT 2
    `);
    if (result.rows.length !== 1) return null;
    const row = result.rows[0]!;
    if (typeof row.owner_username !== 'string') return null;
    return { board: mapBoard(row), ownerUsername: row.owner_username };
  }

  async listOwned(
    ownerId: string,
    limit: number,
    cursor?: BoardCursor,
  ): Promise<Board[]> {
    const result = await this.executor.execute(sql`
      SELECT id, owner_id, name, slug, description, visibility, github_repository_url, version, created_at, updated_at, deleted_at
      FROM boards
      WHERE owner_id = ${ownerId}::uuid AND deleted_at IS NULL
        ${cursor ? sql`AND (created_at, id) < (${cursor.createdAt}, ${cursor.id}::uuid)` : sql``}
      ORDER BY created_at DESC, id DESC LIMIT ${limit}
    `);
    return result.rows.map(mapBoard);
  }

  async update(board: Board, expectedVersion: number): Promise<boolean> {
    try {
      const result = await this.executor.execute(sql`
        UPDATE boards SET name = ${board.name}, slug = ${board.slug},
          description = ${board.description}, visibility = ${board.visibility},
          github_repository_url = ${board.githubRepositoryUrl}, updated_at = ${board.updatedAt},
          version = version + 1
        WHERE id = ${board.id}::uuid AND owner_id = ${board.ownerId}::uuid
          AND version = ${expectedVersion} AND deleted_at IS NULL
        RETURNING id
      `);
      return result.rows.length === 1;
    } catch (error) {
      translateUnique(error);
    }
  }

  async remove(board: Board, expectedVersion: number): Promise<boolean> {
    if (!board.deletedAt) throw new Error('Board must be marked removed.');
    const result = await this.executor.execute(sql`
      UPDATE boards SET deleted_at = ${board.deletedAt}, updated_at = ${board.updatedAt},
        version = version + 1
      WHERE id = ${board.id}::uuid AND owner_id = ${board.ownerId}::uuid
        AND version = ${expectedVersion} AND deleted_at IS NULL
      RETURNING id
    `);
    return result.rows.length === 1;
  }

  async tryReplayLock(scope: string, key: string): Promise<boolean> {
    const result = await this.executor.execute(sql`
      SELECT pg_try_advisory_xact_lock(hashtextextended(${`${scope}:${key}`}, 0)) AS locked
    `);
    return result.rows[0]?.locked === true;
  }

  async findReplay(scope: string, key: string): Promise<ReplayRecord | null> {
    const result = await this.executor.execute(sql`
      SELECT request_hash, response_body, expires_at
      FROM board_idempotency WHERE scope = ${scope} AND key = ${key}::uuid
    `);
    const row = result.rows[0];
    if (!row) return null;
    if (!row.response_body || typeof row.response_body !== 'object') {
      throw new Error('Invalid idempotency response.');
    }
    return {
      requestHash: String(row.request_hash),
      board: mapBoard(row.response_body as Record<string, unknown>),
      expiresAt: date(row.expires_at),
    };
  }

  async deleteReplay(scope: string, key: string): Promise<void> {
    await this.executor.execute(sql`
      DELETE FROM board_idempotency WHERE scope = ${scope} AND key = ${key}::uuid
    `);
  }

  async saveReplay(
    scope: string,
    key: string,
    requestHash: string,
    board: Board,
    expiresAt: Date,
  ): Promise<void> {
    await this.executor.execute(sql`
      INSERT INTO board_idempotency
        (scope, key, request_hash, state, response_status, response_body,
         response_location, response_etag, created_at, expires_at)
      VALUES
        (${scope}, ${key}::uuid, ${requestHash}, 'completed', 201,
         ${JSON.stringify(snapshot(board))}::jsonb, ${`/api/v1/boards/${board.id}`},
         ${`"${board.version}"`}, ${new Date()}, ${expiresAt})
    `);
  }
}

export function createBoardUnitOfWork(
  database: ReturnType<typeof createDatabase>,
): BoardUnitOfWork {
  return {
    store: new DrizzleBoardStore(database.db),
    run: (work) =>
      database.db.transaction(async (transaction) =>
        work(new DrizzleBoardStore(transaction)),
      ),
  };
}
