import { describe, expect, it } from 'vitest';

import { liveHealthResponseSchema } from '../src/index.js';

describe('live health response contract', () => {
  it('accepts the documented liveness response', () => {
    expect(liveHealthResponseSchema.safeParse({ status: 'ok' }).success).toBe(
      true,
    );
  });

  it('rejects missing or invalid status values', () => {
    expect(liveHealthResponseSchema.safeParse({}).success).toBe(false);
    expect(
      liveHealthResponseSchema.safeParse({ status: 'healthy' }).success,
    ).toBe(false);
  });

  it('is exposed from the built public entry point', async () => {
    const entryPoint = await import('@shipboard/contracts');

    expect(entryPoint.liveHealthResponseSchema.parse({ status: 'ok' })).toEqual(
      { status: 'ok' },
    );
  });
});
