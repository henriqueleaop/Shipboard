import { randomUUID } from 'node:crypto';

import { BaseEntity } from '../../../shared/domain/base-entity.js';

export interface VoteState {
  id: string;
  suggestionId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class Vote extends BaseEntity {
  readonly suggestionId: string;
  readonly userId: string;

  constructor(state: VoteState) {
    super(state.id, state.createdAt, state.updatedAt, state.deletedAt);
    this.suggestionId = state.suggestionId;
    this.userId = state.userId;
  }

  static create(suggestionId: string, userId: string, now = new Date()) {
    return new Vote({
      id: randomUUID(),
      suggestionId,
      userId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  removed(now = new Date()) {
    return new Vote({
      id: this.id,
      suggestionId: this.suggestionId,
      userId: this.userId,
      createdAt: this.createdAt,
      updatedAt: now,
      deletedAt: now,
    });
  }
}
