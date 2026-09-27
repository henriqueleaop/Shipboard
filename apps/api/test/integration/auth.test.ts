import { resolve } from 'node:path';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { currentUserSchema, problemSchema } from '@shipboard/contracts';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app/build-app.js';
import { readConfig } from '../../src/app/config.js';
import { createDatabase } from '../../src/infrastructure/database/client.js';

function cookieHeader(value: string | string[] | undefined): string {
  const cookies = Array.isArray(value) ? value : value ? [value] : [];
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

describe('PostgreSQL-backed authentication', () => {
  it('registers, persists a session, rejects duplicate email, and revokes logout', async () => {
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
        const email = 'owner@example.com';
        const password = 'correct-password';
        const signedUp = await app.inject({
          method: 'POST',
          url: '/api/auth/sign-up/email',
          headers: { origin: 'http://localhost:3000' },
          payload: { email, password },
        });
        expect(signedUp.statusCode, signedUp.body).toBe(200);
        expect(currentUserSchema.parse(signedUp.json())).toMatchObject({
          email,
        });
        expect(signedUp.body).not.toContain(password);
        const cookie = cookieHeader(signedUp.headers['set-cookie']);
        expect(cookie).not.toBe('');
        const me = await app.inject({
          method: 'GET',
          url: '/api/v1/me',
          headers: { cookie },
        });
        expect(me.statusCode, me.body).toBe(200);
        expect(currentUserSchema.parse(me.json())).toMatchObject({ email });
        const secondDatabase = createDatabase(container.getConnectionUri());
        const secondApp = await buildApp(
          readConfig({
            NODE_ENV: 'test',
            LOG_LEVEL: 'silent',
            DATABASE_URL: container.getConnectionUri(),
            AUTH_SECRET: 'integration-secret-at-least-thirty-two-characters',
            AUTH_BASE_URL: 'http://localhost:3001',
            WEB_ORIGIN: 'http://localhost:3000',
          }),
          undefined,
          secondDatabase,
        );
        try {
          const crossInstance = await secondApp.inject({
            method: 'GET',
            url: '/api/v1/me',
            headers: { cookie },
          });
          expect(crossInstance.statusCode).toBe(200);
          expect(currentUserSchema.parse(crossInstance.json()).email).toBe(
            email,
          );
        } finally {
          await secondApp.close();
        }

        const race = await Promise.all([
          app.inject({
            method: 'POST',
            url: '/api/auth/sign-up/email',
            headers: { origin: 'http://localhost:3000' },
            payload: { email: 'race@example.com', password },
          }),
          app.inject({
            method: 'POST',
            url: '/api/auth/sign-up/email',
            headers: { origin: 'http://localhost:3000' },
            payload: { email: 'race@example.com', password },
          }),
        ]);
        expect(race.map((response) => response.statusCode).sort()).toEqual([
          200, 409,
        ]);

        const duplicate = await app.inject({
          method: 'POST',
          url: '/api/auth/sign-up/email',
          headers: { origin: 'http://localhost:3000' },
          payload: { email, password },
        });
        expect(duplicate.statusCode, duplicate.body).toBe(409);
        expect(problemSchema.parse(duplicate.json()).status).toBe(409);

        const signedOut = await app.inject({
          method: 'POST',
          url: '/api/auth/sign-out',
          headers: { origin: 'http://localhost:3000', cookie },
          payload: {},
        });
        expect(signedOut.statusCode, signedOut.body).toBe(204);
        const revoked = await app.inject({
          method: 'GET',
          url: '/api/v1/me',
          headers: { cookie },
        });
        expect(revoked.statusCode).toBe(401);

        const signedIn = await app.inject({
          method: 'POST',
          url: '/api/auth/sign-in/email',
          headers: { origin: 'http://localhost:3000' },
          payload: { email, password },
        });
        expect(signedIn.statusCode, signedIn.body).toBe(200);
        expect(currentUserSchema.parse(signedIn.json())).toMatchObject({
          email,
        });
        const wrongPassword = await app.inject({
          method: 'POST',
          url: '/api/auth/sign-in/email',
          headers: { origin: 'http://localhost:3000' },
          payload: { email, password: 'incorrect' },
        });
        const unknownEmail = await app.inject({
          method: 'POST',
          url: '/api/auth/sign-in/email',
          headers: { origin: 'http://localhost:3000' },
          payload: { email: 'missing@example.com', password: 'incorrect' },
        });
        expect(wrongPassword.statusCode).toBe(401);
        expect(unknownEmail.statusCode).toBe(401);
        expect(wrongPassword.json().detail).toBe(unknownEmail.json().detail);
        await database.db.execute(
          sql`UPDATE session SET expires_at = now() - interval '1 second'`,
        );
        const expired = await app.inject({
          method: 'GET',
          url: '/api/v1/me',
          headers: { cookie: cookieHeader(signedIn.headers['set-cookie']) },
        });
        expect(expired.statusCode).toBe(401);
      } finally {
        await app.close();
      }
    } finally {
      await container.stop();
    }
  }, 90_000);
});
