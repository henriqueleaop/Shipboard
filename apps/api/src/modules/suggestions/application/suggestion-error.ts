export type SuggestionErrorCode =
  | 'SUGGESTION_NOT_FOUND'
  | 'BOARD_NOT_FOUND'
  | 'SUGGESTION_FORBIDDEN'
  | 'SUGGESTION_STALE'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'IDEMPOTENCY_IN_PROGRESS';

export class SuggestionError extends Error {
  constructor(readonly code: SuggestionErrorCode) {
    super(code);
  }
}
