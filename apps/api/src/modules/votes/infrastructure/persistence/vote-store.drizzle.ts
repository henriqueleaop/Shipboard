import { sql, type SQL } from 'drizzle-orm';

import type { createDatabase } from '../../../../infrastructure/database/client.js';
import type {
  VoteStore,
  VoteState,
} from '../../application/ports/vote-store.js';
import { Vote } from '../../domain/vote.js';

type Database = ReturnType<typeof createDatabase>['db'];
type Executor = {
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
};

export class DrizzleVoteStore implements VoteStore {
  constructor(private readonly database: Database) {}

  async boardActive(id: string) {
    const result = await this.database.execute(
      sql`SELECT id FROM boards WHERE id = ${id}::uuid AND deleted_at IS NULL`,
    );
    return result.rows.length === 1;
  }

  async change(suggestionId: string, userId: string, voted: boolean) {
    return this.database.transaction(async (transaction) => {
      // Serialize only this actor/idea pair; independent voters remain concurrent.
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${userId}:${suggestionId}`}, 0))`,
      );
      const target = await transaction.execute(sql`
        SELECT s.id FROM suggestions s JOIN boards b ON b.id = s.board_id
        WHERE s.id = ${suggestionId}::uuid AND s.deleted_at IS NULL AND b.deleted_at IS NULL
          AND (b.visibility <> 'PRIVATE' OR b.owner_id = ${userId}::uuid)
        FOR SHARE OF s, b
      `);
      if (!target.rows.length) return null;
      const vote = Vote.create(suggestionId, userId);
      const result = voted
        ? await transaction.execute(sql`
            INSERT INTO votes (id, suggestion_id, user_id, created_at, updated_at)
            VALUES (${vote.id}::uuid, ${suggestionId}::uuid, ${userId}::uuid, ${vote.createdAt}, ${vote.updatedAt})
            ON CONFLICT (suggestion_id, user_id) WHERE deleted_at IS NULL DO NOTHING
            RETURNING id
          `)
        : await transaction.execute(sql`
            UPDATE votes SET deleted_at = ${vote.createdAt}, updated_at = ${vote.createdAt}
            WHERE suggestion_id = ${suggestionId}::uuid AND user_id = ${userId}::uuid AND deleted_at IS NULL
            RETURNING id
          `);
      const state = await this.readState(transaction, suggestionId, userId);
      if (!state) return null;
      return { state, changed: result.rows.length === 1 };
    });
  }

  async state(suggestionId: string, userId: string): Promise<VoteState | null> {
    return this.readState(this.database, suggestionId, userId);
  }

  private async readState(
    executor: Executor,
    suggestionId: string,
    userId: string,
  ): Promise<VoteState | null> {
    const result = await executor.execute(sql`
      SELECT s.id AS suggestion_id,
        EXISTS(SELECT 1 FROM votes v WHERE v.suggestion_id = s.id AND v.user_id = ${userId}::uuid AND v.deleted_at IS NULL) AS voted,
        (SELECT count(*)::integer FROM votes v WHERE v.suggestion_id = s.id AND v.deleted_at IS NULL) AS vote_count
      FROM suggestions s JOIN boards b ON b.id = s.board_id AND b.deleted_at IS NULL
      WHERE s.id = ${suggestionId}::uuid AND s.deleted_at IS NULL
        AND (b.visibility <> 'PRIVATE' OR b.owner_id = ${userId}::uuid)
    `);
    const row = result.rows[0];
    return row
      ? {
          suggestionId: String(row.suggestion_id),
          voted: row.voted === true,
          voteCount: Number(row.vote_count),
        }
      : null;
  }

  async myVotes(boardId: string, suggestionIds: string[], userId: string) {
    const ids = sql.join(
      suggestionIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    );
    const result = await this.database.execute(sql`
      SELECT s.id AS suggestion_id,
        EXISTS(SELECT 1 FROM votes v WHERE v.suggestion_id = s.id AND v.user_id = ${userId}::uuid AND v.deleted_at IS NULL) AS voted
      FROM suggestions s JOIN boards b ON b.id = s.board_id AND b.deleted_at IS NULL
      WHERE s.board_id = ${boardId}::uuid AND s.deleted_at IS NULL AND s.id IN (${ids})
        AND (b.visibility <> 'PRIVATE' OR b.owner_id = ${userId}::uuid)
    `);
    return result.rows.map((row) => ({
      suggestionId: String(row.suggestion_id),
      voted: row.voted === true,
    }));
  }
}
