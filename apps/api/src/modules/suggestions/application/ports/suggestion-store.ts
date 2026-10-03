import type { SuggestionSort, SuggestionStatus } from '@shipboard/contracts';

import type { Suggestion } from '../../domain/suggestion.js';

export interface SuggestionCursor {
  createdAt: string;
  id: string;
  voteCount: number;
}

export interface SuggestionListOptions {
  boardId: string;
  limit: number;
  sort: SuggestionSort;
  status?: SuggestionStatus;
  cursor?: SuggestionCursor;
}

export interface SuggestionWithCount {
  suggestion: Suggestion;
  voteCount: number;
  authorUsername: string;
  cursorCreatedAt: string;
}

export interface SuggestionReplay {
  requestHash: string;
  suggestion: Suggestion;
  expiresAt: Date;
  location: string;
}

export interface SuggestionStore {
  activeBoardSlug(
    id: string,
  ): Promise<{ slug: string; ownerUsername: string } | null>;
  insert(value: Suggestion): Promise<void>;
  find(id: string): Promise<SuggestionWithCount | null>;
  list(options: SuggestionListOptions): Promise<SuggestionWithCount[]>;
  updateStatus(value: Suggestion, expectedVersion: number): Promise<boolean>;
  tryReplayLock(scope: string, key: string): Promise<boolean>;
  findReplay(scope: string, key: string): Promise<SuggestionReplay | null>;
  deleteReplay(scope: string, key: string): Promise<void>;
  saveReplay(
    scope: string,
    key: string,
    hash: string,
    suggestion: Suggestion,
    expiresAt: Date,
    location: string,
  ): Promise<void>;
}

export interface SuggestionUnitOfWork {
  readonly store: SuggestionStore;
  run<T>(work: (store: SuggestionStore) => Promise<T>): Promise<T>;
}
