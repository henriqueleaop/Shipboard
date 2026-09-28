import { describe, expect, it } from 'vitest';

import { Vote } from './vote.js';

describe('Vote', () => {
  it('preserves the historical identity when removed', () => {
    const vote = Vote.create(crypto.randomUUID(), crypto.randomUUID());
    const removed = vote.removed();
    expect(removed.id).toBe(vote.id);
    expect(removed.createdAt).toEqual(vote.createdAt);
    expect(removed.deletedAt).toEqual(removed.updatedAt);
    expect(removed.suggestionId).toBe(vote.suggestionId);
  });
});
