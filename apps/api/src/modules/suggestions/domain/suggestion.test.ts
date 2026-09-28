import { describe, expect, it } from 'vitest';

import { Suggestion } from './suggestion.js';

describe('Suggestion', () => {
  it('starts under review and advances a status change without losing identity or creation time', () => {
    const suggestion = Suggestion.create(
      crypto.randomUUID(),
      crypto.randomUUID(),
      {
        title: ' Better onboarding ',
        description: ' Make first use clear ',
      },
    );
    expect(suggestion.title).toBe('Better onboarding');
    expect(suggestion.status).toBe('UNDER_REVIEW');
    const changed = suggestion.withStatus('PLANNED');
    expect(changed.id).toBe(suggestion.id);
    expect(changed.createdAt).toEqual(suggestion.createdAt);
    expect(changed.version).toBe(2);
    expect(changed.withStatus('PLANNED')).toBe(changed);
    const removed = changed.removed();
    expect(removed.deletedAt).toEqual(removed.updatedAt);
    expect(removed.version).toBe(3);
    expect(() => removed.withStatus('SHIPPED')).toThrow();
  });
});
