import type { Board } from '../../domain/board.js';

export interface BoardCursor {
  createdAt: Date;
  id: string;
}

export interface ReplayRecord {
  requestHash: string;
  board: Board;
  expiresAt: Date;
}

export interface BoardStore {
  insert(board: Board): Promise<void>;
  find(id: string): Promise<Board | null>;
  findBySlug(slug: string): Promise<Board | null>;
  findPublicByIdentity(
    username: string,
    slug: string,
    actorId?: string,
  ): Promise<{ board: Board; ownerUsername: string } | null>;
  findLegacyPublicBySlug(
    slug: string,
  ): Promise<{ board: Board; ownerUsername: string } | null>;
  listOwned(
    ownerId: string,
    limit: number,
    cursor?: BoardCursor,
  ): Promise<Board[]>;
  update(board: Board, expectedVersion: number): Promise<boolean>;
  remove(board: Board, expectedVersion: number): Promise<boolean>;
  tryReplayLock(scope: string, key: string): Promise<boolean>;
  findReplay(scope: string, key: string): Promise<ReplayRecord | null>;
  deleteReplay(scope: string, key: string): Promise<void>;
  saveReplay(
    scope: string,
    key: string,
    requestHash: string,
    board: Board,
    expiresAt: Date,
  ): Promise<void>;
}

export interface BoardUnitOfWork {
  readonly store: BoardStore;
  run<T>(work: (store: BoardStore) => Promise<T>): Promise<T>;
}
