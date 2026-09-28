import { describe, expect, it } from 'vitest';

import {
  boardResponseSchema,
  createBoardRequestSchema,
  currentUserSchema,
  localReturnPathSchema,
  githubStartRequestSchema,
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
      createBoardRequestSchema.safeParse({
        name: 'A',
        slug: 'login',
        description: '',
      }).success,
    ).toBe(false);
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
  it('accepts only local GitHub return destinations', () => {
    expect(githubStartRequestSchema.parse({}).returnTo).toBe('/boards');
    for (const path of ['/acme', '/acme/suggestions/abc?tab=all']) {
      expect(localReturnPathSchema.safeParse(path).success).toBe(true);
    }
    for (const path of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'boards',
    ]) {
      expect(localReturnPathSchema.safeParse(path).success).toBe(false);
    }
  });
});
