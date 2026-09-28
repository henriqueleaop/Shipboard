import { describe, expect, it } from 'vitest';

import {
  boardResponseSchema,
  createBoardRequestSchema,
  createSuggestionRequestSchema,
  currentUserSchema,
  localReturnPathSchema,
  githubStartRequestSchema,
  githubRepositoryUrlSchema,
  isReservedUsername,
  signUpRequestSchema,
  updateBoardRequestSchema,
  usernameSchema,
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

  it('enforces the limits shown in the web form', () => {
    expect(
      createBoardRequestSchema.safeParse({
        name: 'n'.repeat(101),
        slug: 'valid-board',
        description: '',
      }).success,
    ).toBe(false);
    expect(
      createSuggestionRequestSchema.safeParse({
        title: 't'.repeat(121),
        description: 'A useful suggestion.',
      }).success,
    ).toBe(false);
    expect(
      createSuggestionRequestSchema.safeParse({
        title: 'Useful suggestion',
        description: 'd'.repeat(2_001),
      }).success,
    ).toBe(false);
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

  it('defines safe public identity and GitHub repository values', () => {
    expect(usernameSchema.safeParse('henrique-dev').success).toBe(true);
    expect(usernameSchema.safeParse('Henrique').success).toBe(false);
    expect(usernameSchema.safeParse('me').success).toBe(false);
    expect(isReservedUsername('boards')).toBe(true);
    expect(
      githubRepositoryUrlSchema.safeParse(
        'https://github.com/shipboard/shipboard',
      ).success,
    ).toBe(true);
    expect(
      githubRepositoryUrlSchema.safeParse(
        'https://github.com/shipboard/shipboard/issues',
      ).success,
    ).toBe(false);
  });
});
