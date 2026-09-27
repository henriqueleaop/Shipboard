import { describe, expect, it } from 'vitest';

import {
  boardResponseSchema,
  createBoardRequestSchema,
  currentUserSchema,
  signUpRequestSchema,
  updateBoardRequestSchema,
} from '../src/index.js';

describe('product HTTP contracts', () => {
  it('rejects client-controlled owner fields and invalid slugs', () => {
    expect(
      createBoardRequestSchema.safeParse({
        name: 'A',
        slug: 'Good Slug',
        description: '',
      }).success,
    ).toBe(false);
    expect(
      createBoardRequestSchema.safeParse({
        name: 'A',
        slug: 'good-slug',
        description: '',
        ownerId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
    expect(updateBoardRequestSchema.safeParse({}).success).toBe(false);
    expect(
      updateBoardRequestSchema.safeParse({ slug: 'new-slug' }).success,
    ).toBe(true);
  });

  it('excludes sensitive authentication data', () => {
    expect(
      signUpRequestSchema.safeParse({
        email: 'person@example.com',
        password: 'valid-secret',
      }).success,
    ).toBe(true);
    expect(
      currentUserSchema.safeParse({
        id: crypto.randomUUID(),
        email: 'person@example.com',
        token: 'private',
      }).success,
    ).toBe(false);
    expect(
      boardResponseSchema.safeParse({ id: crypto.randomUUID() }).success,
    ).toBe(false);
  });
});
