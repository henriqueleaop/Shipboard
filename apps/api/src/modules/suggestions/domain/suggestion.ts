import { randomUUID } from 'node:crypto';

import type { SuggestionStatus } from '@shipboard/contracts';

import { BaseEntity } from '../../../shared/domain/base-entity.js';

export interface SuggestionState {
  id: string;
  boardId: string;
  authorId: string;
  title: string;
  description: string;
  status: SuggestionStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class Suggestion extends BaseEntity {
  readonly boardId: string;
  readonly authorId: string;
  readonly title: string;
  readonly description: string;
  readonly status: SuggestionStatus;
  readonly version: number;

  constructor(state: SuggestionState) {
    super(state.id, state.createdAt, state.updatedAt, state.deletedAt);
    if (state.version < 1 || !state.title.trim() || !state.description.trim()) {
      throw new Error('Invalid suggestion state.');
    }
    this.boardId = state.boardId;
    this.authorId = state.authorId;
    this.title = state.title;
    this.description = state.description;
    this.status = state.status;
    this.version = state.version;
  }

  static create(
    boardId: string,
    authorId: string,
    input: { title: string; description: string },
    now = new Date(),
  ) {
    return new Suggestion({
      id: randomUUID(),
      boardId,
      authorId,
      title: input.title.trim(),
      description: input.description.trim(),
      status: 'UNDER_REVIEW',
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  withStatus(status: SuggestionStatus, now = new Date()) {
    if (this.deletedAt)
      throw new Error('Removed suggestions cannot change status.');
    if (status === this.status) return this;
    return new Suggestion({
      id: this.id,
      boardId: this.boardId,
      authorId: this.authorId,
      title: this.title,
      description: this.description,
      status,
      version: this.version + 1,
      createdAt: this.createdAt,
      updatedAt: now,
      deletedAt: null,
    });
  }

  removed(now = new Date()) {
    return new Suggestion({
      id: this.id,
      boardId: this.boardId,
      authorId: this.authorId,
      title: this.title,
      description: this.description,
      status: this.status,
      version: this.version + 1,
      createdAt: this.createdAt,
      updatedAt: now,
      deletedAt: now,
    });
  }
}
