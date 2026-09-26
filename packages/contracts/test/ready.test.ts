import { describe, expect, it } from 'vitest';

import {
  readyHealthResponseSchema,
  unavailableHealthResponseSchema,
} from '../src/index.js';

describe('readiness contracts', () => {
  it('accepts the ready response and rejects incorrect status', () => {
    expect(readyHealthResponseSchema.parse({ status: 'ok' })).toEqual({
      status: 'ok',
    });
    expect(
      readyHealthResponseSchema.safeParse({ status: 'down' }).success,
    ).toBe(false);
  });

  it('accepts the unavailable problem and rejects missing fields', () => {
    const problem = {
      type: 'https://shipboard.dev/problems/service-unavailable',
      title: 'Service unavailable',
      status: 503,
      detail: 'A required dependency is unavailable.',
      instance: '/health/ready',
      code: 'SERVICE_UNAVAILABLE',
      requestId: 'test-request-123',
    };
    expect(unavailableHealthResponseSchema.parse(problem)).toEqual(problem);
    expect(
      unavailableHealthResponseSchema.safeParse({ ...problem, status: 500 })
        .success,
    ).toBe(false);
    expect(
      unavailableHealthResponseSchema.safeParse({ ...problem, requestId: 7 })
        .success,
    ).toBe(false);
    expect(
      unavailableHealthResponseSchema.safeParse({ status: 503 }).success,
    ).toBe(false);
  });
});
