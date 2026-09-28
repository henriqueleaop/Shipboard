import { createHash } from 'node:crypto';

import type {
  CreateSuggestionRequest,
  SuggestionSort,
  SuggestionStatus,
} from '@shipboard/contracts';

import type { BoardAccess } from '../../boards/index.js';
import type { Principal } from '../../../shared/types/principal.js';
import { Suggestion } from '../domain/suggestion.js';
import { SuggestionError } from './suggestion-error.js';
import type {
  SuggestionCursor,
  SuggestionUnitOfWork,
} from './ports/suggestion-store.js';

function hashInput(input: CreateSuggestionRequest): string {
  return createHash('sha256')
    .update(JSON.stringify([input.title, input.description]))
    .digest('hex');
}

export async function createSuggestion(
  unit: SuggestionUnitOfWork,
  actor: Principal,
  boardId: string,
  input: CreateSuggestionRequest,
  key: string,
) {
  const scope = `${actor.id}:POST:/api/v1/boards/${boardId}/suggestions`;
  const requestHash = hashInput(input);
  return unit.run(async (store) => {
    const slug = await store.activeBoardSlug(boardId);
    if (slug === null) throw new SuggestionError('BOARD_NOT_FOUND');
    if (!(await store.tryReplayLock(scope, key)))
      throw new SuggestionError('IDEMPOTENCY_IN_PROGRESS');
    const replay = await store.findReplay(scope, key);
    if (replay && replay.expiresAt > new Date()) {
      if (replay.requestHash !== requestHash)
        throw new SuggestionError('IDEMPOTENCY_KEY_REUSED');
      return {
        suggestion: replay.suggestion,
        replayed: true,
        location: replay.location,
      };
    }
    if (replay) await store.deleteReplay(scope, key);
    const suggestion = Suggestion.create(boardId, actor.id, input);
    const location = `/api/v1/public/boards/${encodeURIComponent(slug)}/suggestions/${suggestion.id}`;
    await store.insert(suggestion);
    await store.saveReplay(
      scope,
      key,
      requestHash,
      suggestion,
      new Date(Date.now() + 86_400_000),
      location,
    );
    return { suggestion, replayed: false, location };
  });
}

export async function listSuggestions(
  unit: SuggestionUnitOfWork,
  boards: BoardAccess,
  boardId: string,
  options: {
    limit: number;
    sort: SuggestionSort;
    status?: SuggestionStatus;
    cursor?: SuggestionCursor;
    owner?: Principal;
  },
) {
  const board = await boards.byId(boardId);
  if (!board) throw new SuggestionError('BOARD_NOT_FOUND');
  if (options.owner && board.ownerId !== options.owner.id)
    throw new SuggestionError('SUGGESTION_FORBIDDEN');
  const rows = await unit.store.list({
    boardId,
    limit: options.limit + 1,
    sort: options.sort,
    status: options.status,
    cursor: options.cursor,
  });
  const items = rows.slice(0, options.limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > options.limit && last
        ? {
            id: last.suggestion.id,
            createdAt: last.cursorCreatedAt,
            voteCount: last.voteCount,
          }
        : null,
  };
}

export async function suggestionDetail(
  unit: SuggestionUnitOfWork,
  boards: BoardAccess,
  boardId: string,
  suggestionId: string,
) {
  if (!(await boards.byId(boardId)))
    throw new SuggestionError('BOARD_NOT_FOUND');
  const found = await unit.store.find(suggestionId);
  if (!found || found.suggestion.boardId !== boardId)
    throw new SuggestionError('SUGGESTION_NOT_FOUND');
  return found;
}

export async function changeSuggestionStatus(
  unit: SuggestionUnitOfWork,
  boards: BoardAccess,
  actor: Principal,
  boardId: string,
  suggestionId: string,
  expectedVersion: number,
  status: SuggestionStatus,
) {
  const board = await boards.byId(boardId);
  if (!board) throw new SuggestionError('BOARD_NOT_FOUND');
  if (board.ownerId !== actor.id)
    throw new SuggestionError('SUGGESTION_FORBIDDEN');
  const found = await unit.store.find(suggestionId);
  if (!found || found.suggestion.boardId !== boardId)
    throw new SuggestionError('SUGGESTION_NOT_FOUND');
  if (found.suggestion.version !== expectedVersion)
    throw new SuggestionError('SUGGESTION_STALE');
  const changed = found.suggestion.withStatus(status);
  if (
    changed !== found.suggestion &&
    !(await unit.store.updateStatus(changed, expectedVersion))
  ) {
    throw new SuggestionError('SUGGESTION_STALE');
  }
  return {
    suggestion: changed,
    voteCount: found.voteCount,
    changed: changed !== found.suggestion,
  };
}
