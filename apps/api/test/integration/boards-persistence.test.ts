import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, it } from 'vitest';

import {
  createBoard,
  editBoard,
  ownedBoard,
  ownedBoards,
} from '../../src/modules/boards/application/board-use-cases.js';
import { BoardError } from '../../src/modules/boards/application/board-error.js';
import { createBoardUnitOfWork } from '../../src/modules/boards/infrastructure/persistence/board-store.drizzle.js';
import { createDatabase } from '../../src/infrastructure/database/client.js';

describe('board persistence', () => {
  it('enforces retries, ownership, versions, slugs and active records', async () => {
    const container = await new PostgreSqlContainer('postgres:18.1').start();
    const database = createDatabase(container.getConnectionUri());
    try {
      await migrate(database.db, {
        migrationsFolder: resolve('src/infrastructure/database/migrations'),
      });
      const owner = { id: randomUUID(), email: 'owner@example.com' };
      const other = { id: randomUUID(), email: 'other@example.com' };
      for (const actor of [owner, other]) {
        await database.db.execute(sql`
          INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
          VALUES (${actor.id}::uuid, 'User', ${actor.email}, false, now(), now())
        `);
      }
      const unit = createBoardUnitOfWork(database);
      const metadata = { name: 'Acme', slug: 'acme', description: '' };
      const key = randomUUID();
      const first = await createBoard(unit, owner, metadata, key);
      expect(first.replayed).toBe(false);
      const replay = await createBoard(unit, owner, metadata, key);
      expect(replay.replayed).toBe(true);
      expect(replay.board.id).toBe(first.board.id);
      await expect(
        createBoard(unit, owner, { ...metadata, name: 'Different' }, key),
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
      const parallelSlug = await Promise.allSettled([
        createBoard(unit, owner, {
          name: 'Parallel one',
          slug: 'parallel',
          description: '',
        }),
        createBoard(unit, other, {
          name: 'Parallel two',
          slug: 'parallel',
          description: '',
        }),
      ]);
      expect(
        parallelSlug.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(2);
      await database.db.execute(sql`
        UPDATE board_idempotency SET expires_at = now() - interval '1 second'
        WHERE key = ${key}::uuid
      `);
      const afterExpiry = await createBoard(
        unit,
        owner,
        { name: 'After expiry', slug: 'after-expiry', description: '' },
        key,
      );
      expect(afterExpiry.replayed).toBe(false);
      expect(afterExpiry.board.id).not.toBe(first.board.id);
      const busyKey = randomUUID();
      await unit.run(async (store) => {
        expect(
          await store.tryReplayLock(`${owner.id}:POST:/api/v1/boards`, busyKey),
        ).toBe(true);
        await expect(
          createBoard(
            unit,
            owner,
            { name: 'Busy', slug: 'busy', description: '' },
            busyKey,
          ),
        ).rejects.toMatchObject({ code: 'IDEMPOTENCY_IN_PROGRESS' });
      });
      await expect(createBoard(unit, owner, metadata)).rejects.toMatchObject({
        code: 'SLUG_CONFLICT',
      });
      await expect(
        ownedBoard(unit, other, first.board.id),
      ).rejects.toMatchObject({
        code: 'BOARD_FORBIDDEN',
      });
      const list = await ownedBoards(unit, owner, 20);
      expect(list.items.some((board) => board.id === first.board.id)).toBe(
        true,
      );
      const page = await ownedBoards(unit, owner, 1);
      expect(page.items).toHaveLength(1);
      expect(page.nextCursor).not.toBeNull();
      const nextPage = await ownedBoards(unit, owner, 1, page.nextCursor!);
      expect(nextPage.items).toHaveLength(1);
      expect(nextPage.items[0]?.id).not.toBe(page.items[0]?.id);
      expect(
        (await ownedBoards(unit, other, 20)).items.every(
          (board) => board.ownerId === other.id,
        ),
      ).toBe(true);
      const changed = await editBoard(unit, owner, first.board.id, 1, {
        slug: 'acme-new',
        description: 'New details',
      });
      expect(changed.version).toBe(2);
      expect((await ownedBoard(unit, owner, first.board.id)).slug).toBe(
        'acme-new',
      );
      const oldSlug = await database.db.execute(sql`
        SELECT id FROM boards WHERE slug = 'acme' AND deleted_at IS NULL
      `);
      expect(oldSlug.rows).toHaveLength(0);
      await expect(
        editBoard(unit, owner, first.board.id, 2, { slug: 'parallel' }),
      ).rejects.toMatchObject({ code: 'SLUG_CONFLICT' });
      await expect(
        editBoard(unit, owner, first.board.id, 1, { name: 'Stale' }),
      ).rejects.toMatchObject({ code: 'BOARD_STALE' });
      const removed = changed.removed();
      expect(await unit.store.remove(removed, 2)).toBe(true);
      expect(removed.updatedAt).toEqual(removed.deletedAt);
      await expect(
        ownedBoard(unit, owner, first.board.id),
      ).rejects.toBeInstanceOf(BoardError);
      expect(
        (await ownedBoards(unit, owner, 20)).items.some(
          (board) => board.id === first.board.id,
        ),
      ).toBe(false);
      expect(await unit.store.remove(removed, 2)).toBe(false);
    } finally {
      await database.close();
      await container.stop();
    }
  }, 90_000);
});
