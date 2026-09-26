import { describe, expect, it } from 'vitest';

import { liveHealthResponseSchema } from '@shipboard/contracts';
import { buildApp } from '../../src/app/build-app.js';
import { readConfig } from '../../src/app/config.js';

describe('GET /health/live', () => {
  it('returns the shared liveness contract and a request id', async () => {
    const app = await buildApp(
      readConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
    );
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: { 'x-request-id': 'test-request-123' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe('test-request-123');
    expect(liveHealthResponseSchema.parse(response.json())).toEqual({
      status: 'ok',
    });
    await app.close();
  });
  it('returns a safe RFC 9457 response for unknown routes', async () => {
    const app = await buildApp(
      readConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
    );
    const response = await app.inject('/does-not-exist');
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(response.json()).not.toHaveProperty('stack');
    await app.close();
  });
});
