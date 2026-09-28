import { resolve } from 'node:path';
import { Writable } from 'node:stream';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import {
  authProvidersResponseSchema,
  currentUserSchema,
  githubStartResponseSchema,
  problemSchema,
} from '@shipboard/contracts';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../src/app/build-app.js';
import { readConfig } from '../../src/app/config.js';
import { createDatabase } from '../../src/infrastructure/database/client.js';

function cookieHeader(value: string | string[] | undefined): string {
  const cookies = Array.isArray(value) ? value : value ? [value] : [];
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

describe('PostgreSQL-backed authentication', () => {
  it('sanitizes unexpected adapter failures without the provider console fallback', async () => {
    const container = await new PostgreSqlContainer('postgres:18.1').start();
    const database = createDatabase(container.getConnectionUri());
    const logs: string[] = [];
    const logStream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        logs.push(chunk.toString());
        callback();
      },
    });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    let closed = false;
    try {
      await migrate(database.db, {
        migrationsFolder: resolve('src/infrastructure/database/migrations'),
      });
      await database.db.execute(
        sql`CREATE FUNCTION fail_auth_account() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''sensitive-adapter-fixture''; END'`,
      );
      await database.db.execute(
        sql`CREATE TRIGGER fail_auth_account BEFORE INSERT ON account FOR EACH ROW EXECUTE FUNCTION fail_auth_account()`,
      );
      const app = await buildApp(
        readConfig({
          NODE_ENV: 'test',
          LOG_LEVEL: 'info',
          DATABASE_URL: container.getConnectionUri(),
          AUTH_SECRET: 'integration-secret-at-least-thirty-two-characters',
          AUTH_BASE_URL: 'http://localhost:3001',
          WEB_ORIGIN: 'http://localhost:3000',
        }),
        logStream,
        database,
      );
      try {
        const response = await app.inject({
          method: 'POST',
          url: '/api/auth/sign-up/email',
          headers: { origin: 'http://localhost:3000' },
          payload: {
            email: 'fault@example.test',
            password: 'sensitive-password-fixture',
          },
        });
        expect(response.statusCode).toBe(500);
        expect(problemSchema.parse(response.json()).code).toBe(
          'INTERNAL_ERROR',
        );
        expect(response.body).not.toContain('sensitive-');
        expect(logs.join('')).not.toContain('sensitive-');
        expect(logs.join('')).not.toContain('fault@example.test');
        expect(consoleError).not.toHaveBeenCalled();
        expect(
          (await app.inject({ method: 'GET', url: '/api/v1/me' })).statusCode,
        ).toBe(401);
      } finally {
        await app.close();
        closed = true;
      }
    } finally {
      consoleError.mockRestore();
      if (!closed) await database.close();
      await container.stop();
    }
  }, 60_000);

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
        const disabledProvider = await app.inject({
          method: 'GET',
          url: '/api/v1/auth/providers',
        });
        expect(
          authProvidersResponseSchema.parse(disabledProvider.json()).github,
        ).toBe(false);
        const disabledStart = await app.inject({
          method: 'POST',
          url: '/api/auth/sign-in/social',
          headers: { origin: 'http://localhost:3000' },
          payload: { returnTo: '/boards' },
        });
        expect(disabledStart.statusCode).toBe(404);
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

  it('starts GitHub through Better Auth with validated local returns', async () => {
    const container = await new PostgreSqlContainer('postgres:18.1').start();
    const database = createDatabase(container.getConnectionUri());
    const logs: string[] = [];
    const logStream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        logs.push(chunk.toString());
        callback();
      },
    });
    try {
      await migrate(database.db, {
        migrationsFolder: resolve('src/infrastructure/database/migrations'),
      });
      const app = await buildApp(
        readConfig({
          NODE_ENV: 'test',
          LOG_LEVEL: 'info',
          DATABASE_URL: container.getConnectionUri(),
          AUTH_SECRET: 'integration-secret-at-least-thirty-two-characters',
          AUTH_BASE_URL: 'http://localhost:3001',
          WEB_ORIGIN: 'http://localhost:3000',
          GITHUB_CLIENT_ID: 'disposable-test-client',
          GITHUB_CLIENT_SECRET: 'disposable-test-secret',
        }),
        logStream,
        database,
      );
      try {
        const availability = await app.inject({
          method: 'GET',
          url: '/api/v1/auth/providers',
        });
        expect(
          authProvidersResponseSchema.parse(availability.json()).github,
        ).toBe(true);
        const invalid = await app.inject({
          method: 'POST',
          url: '/api/auth/sign-in/social',
          headers: { origin: 'http://localhost:3000' },
          payload: { returnTo: '//untrusted.example' },
        });
        expect(invalid.statusCode).toBe(400);
        const start = await app.inject({
          method: 'POST',
          url: '/api/auth/sign-in/social',
          headers: { origin: 'http://localhost:3000' },
          payload: { returnTo: '/acme?sort=newest' },
        });
        expect(start.statusCode, start.body).toBe(200);
        const authorize = new URL(
          githubStartResponseSchema.parse(start.json()).url,
        );
        expect(authorize.origin).toBe('https://github.com');
        expect(authorize.pathname).toBe('/login/oauth/authorize');
        expect(authorize.searchParams.get('client_id')).toBe(
          'disposable-test-client',
        );
        expect(authorize.searchParams.get('redirect_uri')).toBe(
          'http://localhost:3001/api/auth/callback/github',
        );
        expect(authorize.searchParams.get('state')).toBeTruthy();
        expect(start.headers['set-cookie']).toBeTruthy();
        const missingState = await app.inject({
          method: 'GET',
          url: '/api/auth/callback/github?code=invalid',
        });
        expect(missingState.statusCode).toBe(302);
        expect(missingState.headers.location).toBe(
          'http://localhost:3000/login?error=github',
        );
        const originalFetch = globalThis.fetch;
        let fixtureEmail = 'private@example.test';
        let fixtureGithubId = 4242;
        let usableEmail = true;
        globalThis.fetch = async (input, init) => {
          const url = String(input);
          if (url === 'https://github.com/login/oauth/access_token') {
            expect(init?.method).toBe('POST');
            return new Response(
              JSON.stringify({
                access_token: 'fixture-access-token',
                token_type: 'bearer',
                scope: 'read:user user:email',
              }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            );
          }
          if (url === 'https://api.github.com/user') {
            return new Response(
              JSON.stringify({
                id: fixtureGithubId,
                login: 'fixture-user',
                name: 'Fixture User',
                email: null,
                avatar_url: null,
              }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            );
          }
          if (url === 'https://api.github.com/user/emails') {
            return new Response(
              JSON.stringify(
                usableEmail
                  ? [
                      {
                        email: fixtureEmail,
                        primary: true,
                        verified: true,
                        visibility: null,
                      },
                    ]
                  : [],
              ),
              { status: 200, headers: { 'content-type': 'application/json' } },
            );
          }
          return originalFetch(input, init);
        };
        try {
          const state = authorize.searchParams.get('state');
          const cookies = Array.isArray(start.headers['set-cookie'])
            ? start.headers['set-cookie']
            : [start.headers['set-cookie'] ?? ''];
          const callback = await app.inject({
            method: 'GET',
            url: `/api/auth/callback/github?code=fixture-code&state=${state}`,
            headers: {
              cookie: cookies.map((value) => value.split(';')[0]).join('; '),
            },
          });
          expect(callback.statusCode, callback.body).toBe(302);
          expect(callback.headers.location).toBe(
            'http://localhost:3000/acme?sort=newest',
          );
          const sessionCookies = Array.isArray(callback.headers['set-cookie'])
            ? callback.headers['set-cookie']
            : [callback.headers['set-cookie'] ?? ''];
          const session = sessionCookies
            .map((value) => value.split(';')[0])
            .join('; ');
          const authenticated = await app.inject({
            method: 'GET',
            url: '/api/v1/me',
            headers: { cookie: session },
          });
          const firstUser = currentUserSchema.parse(authenticated.json());
          expect(firstUser.email).toBe('private@example.test');
          const replay = await app.inject({
            method: 'GET',
            url: `/api/auth/callback/github?code=fixture-code&state=${state}`,
            headers: {
              cookie: cookies.map((value) => value.split(';')[0]).join('; '),
            },
          });
          expect(replay.headers.location).toBe(
            'http://localhost:3000/login?error=github',
          );
          const secondStart = await app.inject({
            method: 'POST',
            url: '/api/auth/sign-in/social',
            headers: { origin: 'http://localhost:3000' },
            payload: { returnTo: '/boards' },
          });
          const secondState = new URL(
            githubStartResponseSchema.parse(secondStart.json()).url,
          ).searchParams.get('state');
          const secondCookies = Array.isArray(secondStart.headers['set-cookie'])
            ? secondStart.headers['set-cookie']
            : [secondStart.headers['set-cookie'] ?? ''];
          const secondCallback = await app.inject({
            method: 'GET',
            url: `/api/auth/callback/github?code=fixture-code-2&state=${secondState}`,
            headers: {
              cookie: secondCookies
                .map((value) => value.split(';')[0])
                .join('; '),
            },
          });
          expect(secondCallback.statusCode).toBe(302);
          const secondSessionCookies = Array.isArray(
            secondCallback.headers['set-cookie'],
          )
            ? secondCallback.headers['set-cookie']
            : [secondCallback.headers['set-cookie'] ?? ''];
          const secondSession = secondSessionCookies
            .map((value) => value.split(';')[0])
            .join('; ');
          const repeated = await app.inject({
            method: 'GET',
            url: '/api/v1/me',
            headers: { cookie: secondSession },
          });
          expect(currentUserSchema.parse(repeated.json()).id).toBe(
            firstUser.id,
          );
          const signedOut = await app.inject({
            method: 'POST',
            url: '/api/auth/sign-out',
            headers: { origin: 'http://localhost:3000', cookie: secondSession },
            payload: {},
          });
          expect(signedOut.statusCode).toBe(204);
          expect(
            (
              await app.inject({
                method: 'GET',
                url: '/api/v1/me',
                headers: { cookie: secondSession },
              })
            ).statusCode,
          ).toBe(401);
          fixtureEmail = 'collision@example.test';
          fixtureGithubId = 7777;
          const localAccount = await app.inject({
            method: 'POST',
            url: '/api/auth/sign-up/email',
            headers: { origin: 'http://localhost:3000' },
            payload: { email: fixtureEmail, password: 'correct-password' },
          });
          expect(localAccount.statusCode).toBe(200);
          const collisionStart = await app.inject({
            method: 'POST',
            url: '/api/auth/sign-in/social',
            headers: { origin: 'http://localhost:3000' },
            payload: { returnTo: '/boards' },
          });
          const collisionState = new URL(
            githubStartResponseSchema.parse(collisionStart.json()).url,
          ).searchParams.get('state');
          const collisionCookies = Array.isArray(
            collisionStart.headers['set-cookie'],
          )
            ? collisionStart.headers['set-cookie']
            : [collisionStart.headers['set-cookie'] ?? ''];
          const collision = await app.inject({
            method: 'GET',
            url: `/api/auth/callback/github?code=fixture-collision&state=${collisionState}`,
            headers: {
              cookie: collisionCookies
                .map((value) => value.split(';')[0])
                .join('; '),
            },
          });
          expect(collision.headers.location).toBe(
            'http://localhost:3000/login?error=github',
          );
          expect(
            (await app.inject({ method: 'GET', url: '/api/v1/me' })).statusCode,
          ).toBe(401);
          usableEmail = false;
          fixtureGithubId = 8888;
          const noEmailStart = await app.inject({
            method: 'POST',
            url: '/api/auth/sign-in/social',
            headers: { origin: 'http://localhost:3000' },
            payload: { returnTo: '/boards' },
          });
          const noEmailState = new URL(
            githubStartResponseSchema.parse(noEmailStart.json()).url,
          ).searchParams.get('state');
          const noEmailCallback = await app.inject({
            method: 'GET',
            url: `/api/auth/callback/github?code=fixture-no-email&state=${noEmailState}`,
            headers: {
              cookie: cookieHeader(noEmailStart.headers['set-cookie']),
            },
          });
          expect(noEmailCallback.headers.location).toBe(
            'http://localhost:3000/login?error=github',
          );
          expect(
            cookieHeader(noEmailCallback.headers['set-cookie']),
          ).not.toContain('session_token=');
          const canceledStart = await app.inject({
            method: 'POST',
            url: '/api/auth/sign-in/social',
            headers: { origin: 'http://localhost:3000' },
            payload: { returnTo: '/boards' },
          });
          const canceledState = new URL(
            githubStartResponseSchema.parse(canceledStart.json()).url,
          ).searchParams.get('state');
          const canceled = await app.inject({
            method: 'GET',
            url: `/api/auth/callback/github?error=access_denied&state=${canceledState}`,
            headers: {
              cookie: cookieHeader(canceledStart.headers['set-cookie']),
            },
          });
          expect(canceled.headers.location).toBe(
            'http://localhost:3000/login?error=github',
          );
          expect(cookieHeader(canceled.headers['set-cookie'])).not.toContain(
            'session_token=',
          );
          expect(logs.join('')).not.toContain('fixture-access-token');
          expect(logs.join('')).not.toContain('fixture-code');
          expect(logs.join('')).not.toContain('disposable-test-secret');
          expect(logs.join('')).not.toContain('private@example.test');
        } finally {
          globalThis.fetch = originalFetch;
        }
        const noSession = await app.inject({
          method: 'GET',
          url: '/api/v1/me',
        });
        expect(noSession.statusCode).toBe(401);
      } finally {
        await app.close();
      }
    } finally {
      await container.stop();
    }
  }, 90_000);
});
