import { describe, expect, it } from 'vitest';

import {
  liveHealthResponseSchema,
  unavailableHealthResponseSchema,
} from '@shipboard/contracts';
import { buildApp } from '../../src/app/build-app.js';
import { readConfig } from '../../src/app/config.js';

describe('GET /health/live', () => {
  it('returns the shared liveness contract and a request id', async () => {
    const app = await buildApp(
      readConfig({
        AUTH_SECRET: 'test-auth-secret-at-least-thirty-two-characters',
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
      }),
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
      readConfig({
        AUTH_SECRET: 'test-auth-secret-at-least-thirty-two-characters',
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
      }),
    );
    const response = await app.inject('/does-not-exist');
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(response.json()).not.toHaveProperty('stack');
    await app.close();
  });
  it('replaces invalid request ids and keeps unexpected errors private', async () => {
    const app = await buildApp(
      readConfig({
        AUTH_SECRET: 'test-auth-secret-at-least-thirty-two-characters',
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
      }),
    );
    app.get('/test-error', () => {
      throw new Error('private-error-fixture');
    });
    const response = await app.inject({
      method: 'GET',
      url: '/test-error',
      headers: { 'x-request-id': 'invalid id' },
    });
    expect(response.statusCode).toBe(500);
    expect(response.headers['x-request-id']).not.toBe('invalid id');
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(response.json()).toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
    });
    expect(response.body).not.toContain('private-error-fixture');
    await app.close();
  });
});

describe('GET /health/ready', () => {
  const config = readConfig({
    AUTH_SECRET: 'test-auth-secret-at-least-thirty-two-characters',
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://test:private-password@127.0.0.1:1/test',
  });

  it('returns a safe 503 without changing liveness', async () => {
    const app = await buildApp(config);
    try {
      const started = performance.now();
      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
        headers: { 'x-request-id': 'readiness-test-123' },
      });
      expect(performance.now() - started).toBeLessThan(2_000);
      expect(response.statusCode).toBe(503);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['x-request-id']).toBe('readiness-test-123');
      expect(response.headers['content-type']).toContain(
        'application/problem+json',
      );
      expect(
        unavailableHealthResponseSchema.parse(response.json()),
      ).toMatchObject({
        requestId: 'readiness-test-123',
      });
      expect(response.body).not.toContain('private-password');
      expect((await app.inject('/health/live')).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('bounds a stuck check and excludes probes from rate limiting', async () => {
    const app = await buildApp(config, undefined, {
      check: () => new Promise<void>(() => undefined),
      close: async () => undefined,
    });
    try {
      const started = performance.now();
      expect((await app.inject('/health/ready')).statusCode).toBe(503);
      expect(performance.now() - started).toBeLessThan(2_200);
      const probes = await Promise.all(
        Array.from({ length: 105 }, () => app.inject('/health/live')),
      );
      expect(probes.every((response) => response.statusCode === 200)).toBe(
        true,
      );
    } finally {
      await app.close();
    }
  }, 8_000);
});
