export type BoardErrorCode =
  | 'BOARD_NOT_FOUND'
  | 'BOARD_FORBIDDEN'
  | 'BOARD_STALE'
  | 'SLUG_CONFLICT'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'IDEMPOTENCY_IN_PROGRESS';

export class BoardError extends Error {
  constructor(readonly code: BoardErrorCode) {
    super(code);
  }
}
