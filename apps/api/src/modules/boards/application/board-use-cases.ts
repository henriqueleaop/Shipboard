import { createHash } from 'node:crypto';

import type {
  CreateBoardRequest,
  UpdateBoardRequest,
} from '@shipboard/contracts';

import type { Principal } from '../../../shared/types/principal.js';
import { Board } from '../domain/board.js';
import { BoardError } from './board-error.js';
import type { BoardCursor, BoardUnitOfWork } from './ports/board-store.js';

function boardHash(metadata: CreateBoardRequest): string {
  return createHash('sha256')
    .update(
      JSON.stringify([metadata.name, metadata.slug, metadata.description]),
    )
    .digest('hex');
}

export async function createBoard(
  unit: BoardUnitOfWork,
  actor: Principal,
  metadata: CreateBoardRequest,
  key?: string,
): Promise<{ board: Board; replayed: boolean }> {
  if (!key) {
    const board = Board.create(actor.id, metadata);
    await unit.store.insert(board);
    return { board, replayed: false };
  }
  const scope = `${actor.id}:POST:/api/v1/boards`;
  const hash = boardHash(metadata);
  return unit.run(async (store) => {
    if (!(await store.tryReplayLock(scope, key))) {
      throw new BoardError('IDEMPOTENCY_IN_PROGRESS');
    }
    const existing = await store.findReplay(scope, key);
    if (existing && existing.expiresAt > new Date()) {
      if (existing.requestHash !== hash) {
        throw new BoardError('IDEMPOTENCY_KEY_REUSED');
      }
      return { board: existing.board, replayed: true };
    }
    if (existing) await store.deleteReplay(scope, key);
    const board = Board.create(actor.id, metadata);
    await store.insert(board);
    await store.saveReplay(
      scope,
      key,
      hash,
      board,
      new Date(Date.now() + 24 * 60 * 60 * 1000),
    );
    return { board, replayed: false };
  });
}

export async function ownedBoards(
  unit: BoardUnitOfWork,
  actor: Principal,
  limit: number,
  cursor?: BoardCursor,
): Promise<{ items: Board[]; nextCursor: BoardCursor | null }> {
  const rows = await unit.store.listOwned(actor.id, limit + 1, cursor);
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > limit && last
        ? { createdAt: last.createdAt, id: last.id }
        : null,
  };
}

export async function ownedBoard(
  unit: BoardUnitOfWork,
  actor: Principal,
  id: string,
): Promise<Board> {
  const board = await unit.store.find(id);
  if (!board) throw new BoardError('BOARD_NOT_FOUND');
  if (board.ownerId !== actor.id) throw new BoardError('BOARD_FORBIDDEN');
  return board;
}

export async function editBoard(
  unit: BoardUnitOfWork,
  actor: Principal,
  id: string,
  expectedVersion: number,
  changes: UpdateBoardRequest,
): Promise<Board> {
  const board = await ownedBoard(unit, actor, id);
  if (board.version !== expectedVersion) throw new BoardError('BOARD_STALE');
  const changed = board.withMetadata(changes);
  if (!(await unit.store.update(changed, expectedVersion))) {
    throw new BoardError('BOARD_STALE');
  }
  return changed;
}
