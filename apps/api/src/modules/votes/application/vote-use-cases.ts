import type { Principal } from '../../../shared/types/principal.js';
import type { VoteStore } from './ports/vote-store.js';

export class VoteError extends Error {
  constructor(readonly code: 'SUGGESTION_NOT_FOUND' | 'BOARD_NOT_FOUND') {
    super(code);
  }
}

export async function changeVote(
  store: VoteStore,
  actor: Principal,
  suggestionId: string,
  voted: boolean,
) {
  const result = await store.change(suggestionId, actor.id, voted);
  if (!result) throw new VoteError('SUGGESTION_NOT_FOUND');
  return result;
}

export async function voteState(
  store: VoteStore,
  actor: Principal,
  suggestionId: string,
) {
  const state = await store.state(suggestionId, actor.id);
  if (!state) throw new VoteError('SUGGESTION_NOT_FOUND');
  return state;
}

export async function myVotes(
  store: VoteStore,
  actor: Principal,
  boardId: string,
  ids: string[],
) {
  if (!(await store.boardActive(boardId)))
    throw new VoteError('BOARD_NOT_FOUND');
  return store.myVotes(boardId, ids, actor.id);
}
