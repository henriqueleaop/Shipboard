import type { Board } from './domain/board.js';
import type { BoardUnitOfWork } from './application/ports/board-store.js';

export interface BoardAccess {
  byId(id: string): Promise<Board | null>;
  bySlug(slug: string): Promise<Board | null>;
}

export function createBoardAccess(unit: BoardUnitOfWork): BoardAccess {
  return {
    byId: (id) => unit.store.find(id),
    bySlug: (slug) => unit.store.findBySlug(slug),
  };
}
