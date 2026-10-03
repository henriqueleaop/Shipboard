import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import {
  boardResponseSchema,
  currentUserSchema,
  myVotesResponseSchema,
  problemSchema,
  publicProfileSchema,
  suggestionListResponseSchema,
  suggestionResponseSchema,
  voteStateResponseSchema,
} from '@shipboard/contracts';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app/build-app.js';
import { readConfig } from '../../src/app/config.js';
import { createDatabase } from '../../src/infrastructure/database/client.js';

const origin = 'http://localhost:3000';

describe('suggestion HTTP journey', () => {
  it('serves an anonymous board and protects submission and owner status changes', async () => {
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
          WEB_ORIGIN: origin,
        }),
        undefined,
        database,
      );
      try {
        async function register(email: string) {
          const response = await app.inject({
            method: 'POST',
            url: '/api/auth/sign-up/email',
            headers: { origin },
            payload: { email, password: 'correct-password' },
          });
          expect(response.statusCode, response.body).toBe(200);
          const cookies = response.headers['set-cookie'];
          return (Array.isArray(cookies) ? cookies : [cookies ?? ''])
            .map((value) => value.split(';')[0])
            .join('; ');
        }
        const owner = await register('suggestion-owner@example.com');
        const other = await register('suggestion-other@example.com');
        await register('visitor-suggestion@example.test');
        const createdBoard = await app.inject({
          method: 'POST',
          url: '/api/v1/boards',
          headers: { origin, cookie: owner },
          payload: { name: 'Roadmap', slug: 'roadmap', description: 'Ideas' },
        });
        expect(createdBoard.statusCode, createdBoard.body).toBe(201);
        const board = boardResponseSchema.parse(createdBoard.json());
        const publicBoard = await app.inject({
          method: 'GET',
          url: '/api/v1/public/boards/roadmap',
        });
        expect(publicBoard.statusCode).toBe(200);
        expect(publicBoard.json()).toMatchObject({
          id: board.id,
          name: board.name,
          slug: board.slug,
          description: board.description,
          githubRepositoryUrl: null,
        });
        expect(publicBoard.json().ownerUsername).toMatch(
          /^member-[a-f0-9]{12}$/,
        );
        expect(publicBoard.body).not.toContain(board.ownerId);
        const ownerIdentity = currentUserSchema.parse(
          (
            await app.inject({
              method: 'GET',
              url: '/api/v1/me',
              headers: { cookie: owner },
            })
          ).json(),
        );
        const canonicalBoard = await app.inject({
          method: 'GET',
          url: `/api/v1/public/boards/${ownerIdentity.username}/${board.slug}`,
        });
        expect(canonicalBoard.statusCode, canonicalBoard.body).toBe(200);
        await Promise.all(
          Array.from({ length: 21 }, (_, index) =>
            database.db.execute(sql`
              INSERT INTO boards (id, owner_id, name, slug, description, visibility, version, created_at, updated_at)
              VALUES (${randomUUID()}::uuid, ${board.ownerId}::uuid,
                ${`Profile board ${index}`}, ${`profile-board-${index}`}, '', 'PUBLIC', 1,
                ${new Date(2026, 8, 1, 12, 0, index)}, ${new Date(2026, 8, 1, 12, 0, index)})
            `),
          ),
        );
        const profile = await app.inject({
          method: 'GET',
          url: `/api/v1/public/profiles/${ownerIdentity.username}`,
        });
        expect(profile.statusCode, profile.body).toBe(200);
        const firstProfilePage = publicProfileSchema.parse(profile.json());
        expect(firstProfilePage).toMatchObject({
          username: ownerIdentity.username,
          githubProfileUrl: null,
        });
        expect(firstProfilePage.boards).toHaveLength(20);
        expect(firstProfilePage.page.nextCursor).toBeTruthy();
        const nextProfile = await app.inject({
          method: 'GET',
          url: `/api/v1/public/profiles/${ownerIdentity.username}?cursor=${firstProfilePage.page.nextCursor}`,
        });
        const nextProfilePage = publicProfileSchema.parse(nextProfile.json());
        expect(nextProfilePage.boards).toHaveLength(2);
        expect(
          new Set(
            [...firstProfilePage.boards, ...nextProfilePage.boards].map(
              (item) => item.slug,
            ),
          ).size,
        ).toBe(22);
        expect(
          (
            await app.inject({
              method: 'GET',
              url: `/api/v1/public/profiles/${ownerIdentity.username}?cursor=invalid`,
            })
          ).statusCode,
        ).toBe(400);
        const privateCreated = await app.inject({
          method: 'POST',
          url: '/api/v1/boards',
          headers: { origin, cookie: owner },
          payload: {
            name: 'Private roadmap',
            slug: 'private-roadmap',
            description: '',
            visibility: 'PRIVATE',
          },
        });
        expect(privateCreated.statusCode, privateCreated.body).toBe(201);
        const anonymousPrivate = await app.inject({
          method: 'GET',
          url: `/api/v1/public/boards/${ownerIdentity.username}/private-roadmap`,
        });
        expect(anonymousPrivate.statusCode).toBe(404);
        const ownerPrivate = await app.inject({
          method: 'GET',
          url: `/api/v1/public/boards/${ownerIdentity.username}/private-roadmap`,
          headers: { cookie: owner },
        });
        expect(ownerPrivate.statusCode, ownerPrivate.body).toBe(200);

        const url = `/api/v1/boards/${board.id}/suggestions`;
        const key = randomUUID();
        const payload = {
          title: 'Improve search',
          description: 'Find ideas quickly.',
        };
        const send = (body = payload, cookie = other) =>
          app.inject({
            method: 'POST',
            url,
            headers: { origin, cookie, 'idempotency-key': key },
            payload: body,
          });
        const created = await send();
        expect(created.statusCode, created.body).toBe(201);
        const suggestion = suggestionResponseSchema.parse(created.json());
        expect(
          (
            await app.inject({
              method: 'GET',
              url: String(created.headers.location),
            })
          ).statusCode,
        ).toBe(200);
        expect(suggestion).toMatchObject({
          boardId: board.id,
          status: 'UNDER_REVIEW',
          voteCount: 0,
          version: 1,
        });
        expect((await send()).json()).toEqual(created.json());
        const mismatch = await send({
          title: 'Another idea',
          description: 'Different request',
        });
        expect(problemSchema.parse(mismatch.json()).code).toBe(
          'IDEMPOTENCY_KEY_REUSED',
        );
        expect(
          (
            await app.inject({
              method: 'POST',
              url,
              headers: { origin },
              payload,
            })
          ).statusCode,
        ).toBe(401);

        const publicList = await app.inject({
          method: 'GET',
          url: '/api/v1/public/boards/roadmap/suggestions',
        });
        expect(publicList.statusCode, publicList.body).toBe(200);
        expect(
          suggestionListResponseSchema.parse(publicList.json()).items,
        ).toHaveLength(1);
        const detail = await app.inject({
          method: 'GET',
          url: `/api/v1/public/boards/roadmap/suggestions/${suggestion.id}`,
        });
        expect(suggestionResponseSchema.parse(detail.json()).id).toBe(
          suggestion.id,
        );
        const voteUrl = `/api/v1/suggestions/${suggestion.id}/vote`;
        const vote = (method: 'GET' | 'PUT' | 'DELETE', cookie = other) =>
          app.inject({ method, url: voteUrl, headers: { cookie, origin } });
        expect(
          voteStateResponseSchema.parse((await vote('GET')).json()).voted,
        ).toBe(false);
        expect(
          voteStateResponseSchema.parse((await vote('PUT')).json()),
        ).toMatchObject({ voted: true, voteCount: 1 });
        expect(
          voteStateResponseSchema.parse((await vote('PUT')).json()).voteCount,
        ).toBe(1);
        expect(
          voteStateResponseSchema.parse((await vote('PUT', owner)).json())
            .voteCount,
        ).toBe(2);
        expect((await vote('DELETE')).statusCode).toBe(204);
        expect(
          voteStateResponseSchema.parse((await vote('GET')).json()),
        ).toMatchObject({ voted: false, voteCount: 1 });
        expect((await vote('DELETE')).statusCode).toBe(204);
        expect(
          voteStateResponseSchema.parse((await vote('PUT')).json()),
        ).toMatchObject({ voted: true, voteCount: 2 });
        const myVotes = await app.inject({
          method: 'GET',
          url: `/api/v1/boards/${board.id}/my-votes?suggestionIds=${suggestion.id}`,
          headers: { cookie: other },
        });
        expect(myVotesResponseSchema.parse(myVotes.json()).items).toEqual([
          { suggestionId: suggestion.id, voted: true },
        ]);
        const ranked = await app.inject({
          method: 'GET',
          url: '/api/v1/public/boards/roadmap/suggestions?sort=most_voted',
        });
        expect(
          suggestionListResponseSchema.parse(ranked.json()).items[0]?.voteCount,
        ).toBe(2);
        expect(
          (await app.inject({ method: 'GET', url, headers: { cookie: other } }))
            .statusCode,
        ).toBe(403);
        expect(
          (await app.inject({ method: 'GET', url, headers: { cookie: owner } }))
            .statusCode,
        ).toBe(200);

        const statusUrl = `${url}/${suggestion.id}/status`;
        const change = (cookie: string, match?: string) =>
          app.inject({
            method: 'PATCH',
            url: statusUrl,
            headers: {
              origin,
              cookie,
              ...(match ? { 'if-match': match } : {}),
            },
            payload: { status: 'PLANNED' },
          });
        expect((await change(other, '"1"')).statusCode).toBe(403);
        expect((await change(owner)).statusCode).toBe(428);
        const changed = await change(owner, '"1"');
        expect(changed.statusCode, changed.body).toBe(200);
        expect(suggestionResponseSchema.parse(changed.json()).status).toBe(
          'PLANNED',
        );
        expect(changed.headers.etag).toBe('"2"');
        const noop = await change(owner, '"2"');
        expect(noop.json()).toEqual(changed.json());
        expect(noop.headers.etag).toBe('"2"');
        const afterStatusReplay = await send();
        expect(afterStatusReplay.json()).toEqual(created.json());
        expect(afterStatusReplay.headers.etag).toBe('"1"');
        expect(afterStatusReplay.headers.location).toBe(
          created.headers.location,
        );
        expect((await change(owner, '"1"')).statusCode).toBe(412);
        const after = await app.inject({
          method: 'GET',
          url: `/api/v1/public/boards/roadmap/suggestions/${suggestion.id}`,
        });
        expect(suggestionResponseSchema.parse(after.json()).status).toBe(
          'PLANNED',
        );
        const extra = await Promise.all(
          Array.from({ length: 21 }, (_, index) =>
            app.inject({
              method: 'POST',
              url,
              headers: {
                origin,
                cookie: other,
                'idempotency-key': randomUUID(),
              },
              payload: {
                title: `Idea number ${index}`,
                description: `Feedback ${index}`,
              },
            }),
          ),
        );
        expect(extra.every((response) => response.statusCode === 201)).toBe(
          true,
        );
        await database.db.execute(sql`
          UPDATE suggestions SET created_at = '2026-09-27T12:00:00.123456Z'::timestamptz
          WHERE board_id = ${board.id}::uuid AND id <> ${suggestion.id}::uuid
        `);
        const firstPage = await app.inject({
          method: 'GET',
          url: '/api/v1/public/boards/roadmap/suggestions',
        });
        const first = suggestionListResponseSchema.parse(firstPage.json());
        expect(first.items).toHaveLength(20);
        expect(first.page.nextCursor).toBeTruthy();
        const nextPage = await app.inject({
          method: 'GET',
          url: `/api/v1/public/boards/roadmap/suggestions?cursor=${first.page.nextCursor}`,
        });
        const next = suggestionListResponseSchema.parse(nextPage.json());
        expect(next.items).toHaveLength(2);
        expect(
          new Set([...first.items, ...next.items].map((item) => item.id)).size,
        ).toBe(22);
        expect(
          (
            await app.inject({
              method: 'GET',
              url: `/api/v1/public/boards/roadmap/suggestions?sort=most_voted&cursor=${first.page.nextCursor}`,
            })
          ).statusCode,
        ).toBe(400);
        const filtered = await app.inject({
          method: 'GET',
          url: '/api/v1/public/boards/roadmap/suggestions?status=PLANNED',
        });
        expect(
          suggestionListResponseSchema.parse(filtered.json()).items,
        ).toHaveLength(1);

        const concurrentId = suggestionResponseSchema.parse(
          extra[0]!.json(),
        ).id;
        const concurrentKey = randomUUID();
        const concurrentCreate = () =>
          app.inject({
            method: 'POST',
            url,
            headers: {
              origin,
              cookie: other,
              'idempotency-key': concurrentKey,
            },
            payload,
          });
        const creationRace = await Promise.all(
          Array.from({ length: 4 }, concurrentCreate),
        );
        expect(
          creationRace.every(
            (response) =>
              response.statusCode === 201 || response.statusCode === 409,
          ),
        ).toBe(true);
        const winner = creationRace.find(
          (response) => response.statusCode === 201,
        )!;
        expect(winner).toBeDefined();
        for (const response of creationRace) {
          if (response.statusCode === 409)
            expect(response.headers['retry-after']).toBe('1');
          else expect(response.json()).toEqual(winner.json());
        }
        expect((await concurrentCreate()).json()).toEqual(winner.json());
        const countBeforeFailure = await database.db.execute(
          sql`SELECT count(*)::integer AS count FROM suggestions`,
        );
        await database.db.execute(
          sql`CREATE FUNCTION fail_feedback_replay() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''disposable replay failure''; END'`,
        );
        await database.db.execute(
          sql`CREATE TRIGGER fail_feedback_replay BEFORE INSERT ON suggestion_idempotency FOR EACH ROW EXECUTE FUNCTION fail_feedback_replay()`,
        );
        const rollbackKey = randomUUID();
        const rollbackCreate = () =>
          app.inject({
            method: 'POST',
            url,
            headers: { origin, cookie: other, 'idempotency-key': rollbackKey },
            payload,
          });
        expect((await rollbackCreate()).statusCode).toBe(500);
        expect(
          (
            await database.db.execute(
              sql`SELECT count(*)::integer AS count FROM suggestions`,
            )
          ).rows,
        ).toEqual(countBeforeFailure.rows);
        await database.db.execute(
          sql`DROP TRIGGER fail_feedback_replay ON suggestion_idempotency`,
        );
        await database.db.execute(sql`DROP FUNCTION fail_feedback_replay()`);
        expect((await rollbackCreate()).statusCode).toBe(201);
        await database.db.execute(
          sql`UPDATE suggestion_idempotency SET expires_at = now() - interval '1 second' WHERE key = ${key}::uuid`,
        );
        const afterExpiry = await send();
        expect(afterExpiry.statusCode).toBe(201);
        expect(suggestionResponseSchema.parse(afterExpiry.json()).id).not.toBe(
          suggestion.id,
        );
        const raced = await Promise.all(
          Array.from({ length: 8 }, () =>
            app.inject({
              method: 'PUT',
              url: `/api/v1/suggestions/${concurrentId}/vote`,
              headers: { cookie: other, origin },
            }),
          ),
        );
        expect(raced.every((response) => response.statusCode === 200)).toBe(
          true,
        );
        const racedState = await app.inject({
          method: 'GET',
          url: `/api/v1/suggestions/${concurrentId}/vote`,
          headers: { cookie: other },
        });
        expect(voteStateResponseSchema.parse(racedState.json()).voteCount).toBe(
          1,
        );

        const mixed = await Promise.all(
          Array.from({ length: 8 }, (_, index) =>
            app.inject({
              method: index % 2 ? 'DELETE' : 'PUT',
              url: `/api/v1/suggestions/${concurrentId}/vote`,
              headers: { cookie: other, origin },
            }),
          ),
        );
        expect(
          mixed.every(
            (response) =>
              response.statusCode === 200 || response.statusCode === 204,
          ),
        ).toBe(true);
        const finalPut = await app.inject({
          method: 'PUT',
          url: `/api/v1/suggestions/${concurrentId}/vote`,
          headers: { cookie: other, origin },
        });
        expect(voteStateResponseSchema.parse(finalPut.json())).toMatchObject({
          voted: true,
          voteCount: 1,
        });
        const persistedVotes = await database.db.execute(sql`
          SELECT id, deleted_at, updated_at FROM votes WHERE suggestion_id = ${concurrentId}::uuid
        `);
        expect(
          persistedVotes.rows.filter((row) => row.deleted_at === null),
        ).toHaveLength(1);
        expect(
          persistedVotes.rows
            .filter((row) => row.deleted_at !== null)
            .every((row) => String(row.deleted_at) === String(row.updated_at)),
        ).toBe(true);
        await database.db.execute(
          sql`UPDATE suggestions SET deleted_at = now(), updated_at = now() WHERE id = ${concurrentId}::uuid`,
        );
        expect(
          (
            await app.inject({
              method: 'PUT',
              url: `/api/v1/suggestions/${concurrentId}/vote`,
              headers: { cookie: other, origin },
            })
          ).statusCode,
        ).toBe(404);
        const activeBatch = await app.inject({
          method: 'GET',
          url: `/api/v1/boards/${board.id}/my-votes?suggestionIds=${concurrentId},${suggestion.id}`,
          headers: { cookie: other },
        });
        expect(myVotesResponseSchema.parse(activeBatch.json()).items).toEqual([
          { suggestionId: suggestion.id, voted: true },
        ]);

        await database.db.execute(
          sql`UPDATE boards SET deleted_at = now(), updated_at = now() WHERE id = ${board.id}::uuid`,
        );
        expect(
          (
            await app.inject({
              method: 'GET',
              url: '/api/v1/public/boards/roadmap',
            })
          ).statusCode,
        ).toBe(404);
        expect(
          (
            await app.inject({
              method: 'GET',
              url: `/api/v1/public/boards/roadmap/suggestions/${suggestion.id}`,
            })
          ).statusCode,
        ).toBe(404);
        expect(
          (
            await app.inject({
              method: 'GET',
              url: `/api/v1/suggestions/${concurrentId}/vote`,
              headers: { cookie: other },
            })
          ).statusCode,
        ).toBe(404);
        expect((await send()).statusCode).toBe(404);
      } finally {
        await app.close();
      }
    } finally {
      await container.stop();
    }
  }, 60_000);
});
