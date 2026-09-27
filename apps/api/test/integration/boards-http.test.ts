import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import {
  boardResponseSchema,
  ownedBoardsResponseSchema,
  problemSchema,
} from '@shipboard/contracts';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app/build-app.js';
import { readConfig } from '../../src/app/config.js';
import { createDatabase } from '../../src/infrastructure/database/client.js';

function cookieOf(value: string | string[] | undefined): string {
  const parts = Array.isArray(value) ? value : value ? [value] : [];
  return parts.map((part) => part.split(';')[0]).join('; ');
}

describe('board HTTP journey', () => {
  it('registers, creates, lists, edits and authorizes through real sessions', async () => {
    const container = await new PostgreSqlContainer('postgres:18.1').start();
    const database = createDatabase(container.getConnectionUri());
    try {
      await migrate(database.db, {
        migrationsFolder: resolve('src/infrastructure/database/migrations'),
      });
      const app = await buildApp(
        readConfig({
          NODE_ENV: 'test',
          LOG_LEVEL: 'silent',
          DATABASE_URL: container.getConnectionUri(),
          AUTH_SECRET: 'integration-secret-at-least-thirty-two-characters',
          AUTH_BASE_URL: 'http://localhost:3001',
          WEB_ORIGIN: 'http://localhost:3000',
        }),
        undefined,
        database,
      );
      try {
        async function register(email: string) {
          const response = await app.inject({
            method: 'POST',
            url: '/api/auth/sign-up/email',
            headers: { origin: 'http://localhost:3000' },
            payload: { email, password: 'correct-password' },
          });
          expect(response.statusCode, response.body).toBe(200);
          return cookieOf(response.headers['set-cookie']);
        }
        const ownerCookie = await register('board-owner@example.com');
        const otherCookie = await register('board-other@example.com');
        const body = { name: 'Acme', slug: 'acme', description: '' };
        const key = randomUUID();
        const create = () =>
          app.inject({
            method: 'POST',
            url: '/api/v1/boards',
            headers: {
              cookie: ownerCookie,
              origin: 'http://localhost:3000',
              'idempotency-key': key,
            },
            payload: body,
          });
        const created = await create();
        expect(created.statusCode, created.body).toBe(201);
        expect(created.headers.etag).toBe('"1"');
        const board = boardResponseSchema.parse(created.json());
        expect(created.headers.location).toBe(`/api/v1/boards/${board.id}`);
        const replay = await create();
        expect(replay.statusCode, replay.body).toBe(201);
        expect(replay.json()).toEqual(created.json());
        expect(replay.headers.etag).toBe(created.headers.etag);
        const mismatchedReplay = await app.inject({
          method: 'POST',
          url: '/api/v1/boards',
          headers: {
            cookie: ownerCookie,
            origin: 'http://localhost:3000',
            'idempotency-key': key,
          },
          payload: { ...body, name: 'Different' },
        });
        expect(mismatchedReplay.statusCode).toBe(409);
        expect(problemSchema.parse(mismatchedReplay.json()).code).toBe(
          'IDEMPOTENCY_KEY_REUSED',
        );

        const list = await app.inject({
          method: 'GET',
          url: '/api/v1/boards',
          headers: { cookie: ownerCookie },
        });
        expect(list.statusCode, list.body).toBe(200);
        expect(ownedBoardsResponseSchema.parse(list.json()).items).toHaveLength(
          1,
        );
        const stranger = await app.inject({
          method: 'GET',
          url: `/api/v1/boards/${board.id}`,
          headers: { cookie: otherCookie },
        });
        expect(stranger.statusCode).toBe(403);
        expect(problemSchema.parse(stranger.json()).status).toBe(403);
        const forbiddenEdit = await app.inject({
          method: 'PATCH',
          url: `/api/v1/boards/${board.id}`,
          headers: {
            cookie: otherCookie,
            origin: 'http://localhost:3000',
            'if-match': '"1"',
          },
          payload: { name: 'Intrusion' },
        });
        expect(forbiddenEdit.statusCode).toBe(403);
        const foreignOrigin = await app.inject({
          method: 'PATCH',
          url: `/api/v1/boards/${board.id}`,
          headers: {
            cookie: ownerCookie,
            origin: 'https://foreign.example',
            'if-match': '"1"',
          },
          payload: { name: 'Intrusion' },
        });
        expect(foreignOrigin.statusCode).toBe(403);

        const missingMatch = await app.inject({
          method: 'PATCH',
          url: `/api/v1/boards/${board.id}`,
          headers: { cookie: ownerCookie, origin: 'http://localhost:3000' },
          payload: { name: 'Renamed' },
        });
        expect(missingMatch.statusCode).toBe(428);
        const edited = await app.inject({
          method: 'PATCH',
          url: `/api/v1/boards/${board.id}`,
          headers: {
            cookie: ownerCookie,
            origin: 'http://localhost:3000',
            'if-match': '"1"',
          },
          payload: { name: 'Renamed', slug: 'acme-new' },
        });
        expect(edited.statusCode, edited.body).toBe(200);
        expect(edited.headers.etag).toBe('"2"');
        expect(boardResponseSchema.parse(edited.json()).slug).toBe('acme-new');
        const stale = await app.inject({
          method: 'PATCH',
          url: `/api/v1/boards/${board.id}`,
          headers: {
            cookie: ownerCookie,
            origin: 'http://localhost:3000',
            'if-match': '"1"',
          },
          payload: { name: 'Stale' },
        });
        expect(stale.statusCode).toBe(412);
        const anon = await app.inject({
          method: 'GET',
          url: '/api/v1/boards',
        });
        expect(anon.statusCode).toBe(401);
      } finally {
        await app.close();
      }
    } finally {
      await container.stop();
    }
  }, 90_000);
});
