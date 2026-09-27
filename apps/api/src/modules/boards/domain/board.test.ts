import { describe, expect, it } from 'vitest';

import { Board } from './board.js';

describe('Board', () => {
  it('preserves identity and creation time through metadata changes and logical removal', () => {
    const created = Board.create(
      crypto.randomUUID(),
      { name: 'Original', slug: 'original', description: '' },
      new Date('2026-01-01T00:00:00Z'),
    );
    const changed = created.withMetadata(
      { name: 'Updated', slug: 'updated' },
      new Date('2026-01-02T00:00:00Z'),
    );
    const removed = changed.removed(new Date('2026-01-03T00:00:00Z'));
    expect(changed.id).toBe(created.id);
    expect(changed.ownerId).toBe(created.ownerId);
    expect(changed.createdAt).toEqual(created.createdAt);
    expect(changed.version).toBe(2);
    expect(removed.version).toBe(3);
    expect(removed.deletedAt).toEqual(removed.updatedAt);
  });
});
