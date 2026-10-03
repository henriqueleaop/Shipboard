import { sql, type SQL } from 'drizzle-orm';

import { ProfileError } from '../../application/profile-error.js';
import type {
  CurrentProfile,
  ProfileAccess,
  ProfileCursor,
  PublicProfile,
} from '../../application/ports/profile-access.js';
import type { createDatabase } from '../../../../infrastructure/database/client.js';

type Executor = {
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
};

function githubProfileUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[A-Za-z0-9-]+$/.test(value)) return null;
  return `https://github.com/${value}`;
}

function date(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function current(row: Record<string, unknown>, email: string): CurrentProfile {
  if (typeof row.username !== 'string')
    throw new ProfileError('PROFILE_NOT_FOUND');
  return {
    id: String(row.id),
    email,
    username: row.username,
    githubProfileUrl: githubProfileUrl(row.github_username),
  };
}

function unique(error: unknown): never {
  const cause = error instanceof Error ? error.cause : error;
  if (
    cause &&
    typeof cause === 'object' &&
    'code' in cause &&
    cause.code === '23505'
  )
    throw new ProfileError('USERNAME_CONFLICT');
  throw error;
}

class DrizzleProfileAccess implements ProfileAccess {
  constructor(private readonly executor: Executor) {}

  async current(userId: string, email: string): Promise<CurrentProfile> {
    let result = await this.executor.execute(sql`
      SELECT id, username, github_username FROM "user"
      WHERE id = ${userId}::uuid LIMIT 1
    `);
    let row = result.rows[0];
    if (!row) throw new ProfileError('PROFILE_NOT_FOUND');
    if (typeof row.username !== 'string') {
      const generated = `member-${userId.replaceAll('-', '').slice(0, 12)}`;
      result = await this.executor.execute(sql`
        UPDATE "user" SET username = ${generated}, updated_at = now()
        WHERE id = ${userId}::uuid AND username IS NULL
        RETURNING id, username, github_username
      `);
      row = result.rows[0] ?? row;
    }
    return current(row, email);
  }

  async updateUsername(
    userId: string,
    username: string,
  ): Promise<CurrentProfile> {
    try {
      const result = await this.executor.execute(sql`
        UPDATE "user" SET username = ${username}, updated_at = now()
        WHERE id = ${userId}::uuid
        RETURNING id, email, username, github_username
      `);
      const row = result.rows[0];
      if (!row || typeof row.email !== 'string')
        throw new ProfileError('PROFILE_NOT_FOUND');
      return current(row, row.email);
    } catch (error) {
      unique(error);
    }
  }

  async publicByUsername(
    username: string,
    limit: number,
    cursor?: ProfileCursor,
  ): Promise<PublicProfile | null> {
    const person = await this.executor.execute(sql`
      SELECT id, username, github_username FROM "user"
      WHERE username = ${username} LIMIT 1
    `);
    const row = person.rows[0];
    if (!row || typeof row.username !== 'string') return null;
    const boards = await this.executor.execute(sql`
      SELECT id, name, slug, description, created_at FROM boards
      WHERE owner_id = ${String(row.id)}::uuid AND visibility = 'PUBLIC'
        AND deleted_at IS NULL
        ${cursor ? sql`AND (created_at, id) < (${cursor.createdAt}, ${cursor.id}::uuid)` : sql``}
      ORDER BY created_at DESC, id DESC LIMIT ${limit + 1}
    `);
    const visible = boards.rows.slice(0, limit);
    const last = visible.at(-1);
    return {
      username: row.username,
      githubProfileUrl: githubProfileUrl(row.github_username),
      boards: visible.map((board) => ({
        name: String(board.name),
        slug: String(board.slug),
        description: String(board.description),
      })),
      nextCursor:
        boards.rows.length > limit && last
          ? { id: String(last.id), createdAt: date(last.created_at) }
          : null,
    };
  }
}

export function createProfileAccess(
  database: ReturnType<typeof createDatabase>,
): ProfileAccess {
  return new DrizzleProfileAccess(database.db);
}
