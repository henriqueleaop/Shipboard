import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, it } from 'vitest';

import {
  liveHealthResponseSchema,
  readyHealthResponseSchema,
  unavailableHealthResponseSchema,
} from '@shipboard/contracts';
import { buildApp } from '../../src/app/build-app.js';
import { readConfig } from '../../src/app/config.js';
import { createDatabase } from '../../src/infrastructure/database/client.js';

const image = 'postgres:18.1';
const migrationSource = resolve('src/infrastructure/database/migrations');

function runCli(databaseUrl: string) {
  return spawnSync(
    process.execPath,
    ['dist/infrastructure/database/migrate.js'],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: 'utf8',
      timeout: 10_000,
    },
  );
}

describe('PostgreSQL 18 and migrations', () => {
  it('queries PostgreSQL and applies the compiled migration CLI once', async () => {
    const container = await new PostgreSqlContainer(image).start();
    const database = createDatabase(container.getConnectionUri());
    try {
      const version = await database.db.execute(sql`SHOW server_version`);
      expect(String(version.rows[0]?.['server_version'])).toMatch(/^18\./);
      await database.check();

      const wrongPassword = new URL(container.getConnectionUri());
      wrongPassword.password = 'incorrect-fixture';
      const unauthorized = createDatabase(wrongPassword.href);
      try {
        await expect(unauthorized.check()).rejects.toThrow();
      } finally {
        await unauthorized.close();
      }

      let activeDatabase = database;
      const app = await buildApp(
        readConfig({
          NODE_ENV: 'test',
          LOG_LEVEL: 'silent',
          DATABASE_URL: container.getConnectionUri(),
        }),
        undefined,
        {
          check: () => activeDatabase.check(),
          close: async () => undefined,
        },
      );
      const unavailable = createDatabase(
        'postgresql://fixture:secret-fixture@127.0.0.1:1/none',
      );
      try {
        const ready = await app.inject('/health/ready');
        expect(ready.statusCode).toBe(200);
        expect(ready.headers['cache-control']).toBe('no-store');
        expect(readyHealthResponseSchema.parse(ready.json())).toEqual({
          status: 'ok',
        });

        activeDatabase = unavailable;
        const down = await app.inject('/health/ready');
        expect(down.statusCode).toBe(503);
        expect(down.headers['content-type']).toContain(
          'application/problem+json',
        );
        expect(
          unavailableHealthResponseSchema.parse(down.json()),
        ).toMatchObject({
          code: 'SERVICE_UNAVAILABLE',
        });
        expect(down.body).not.toContain('secret-fixture');
        expect(
          liveHealthResponseSchema.parse(
            (await app.inject('/health/live')).json(),
          ),
        ).toEqual({ status: 'ok' });

        activeDatabase = database;
        expect((await app.inject('/health/ready')).statusCode).toBe(200);
      } finally {
        await app.close();
        await unavailable.close();
      }

      const before = await database.db.execute(sql`
        SELECT count(*)::integer AS count FROM information_schema.tables
        WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
      `);
      expect(before.rows[0]?.['count']).toBe(0);

      expect(runCli(container.getConnectionUri()).status).toBe(0);
      expect(runCli(container.getConnectionUri()).status).toBe(0);
      const migrations = await database.db.execute(sql`
        SELECT count(*)::integer AS count FROM drizzle.__drizzle_migrations
      `);
      expect(migrations.rows[0]?.['count']).toBe(1);
    } finally {
      await database.close();
      await container.stop();
    }
  }, 60_000);

  it('does not journal a failed SQL migration or expose the database URL', async () => {
    const container = await new PostgreSqlContainer(image).start();
    const database = createDatabase(container.getConnectionUri());
    const fixture = await mkdtemp(join(tmpdir(), 'shipboard-migration-'));
    try {
      await cp(migrationSource, fixture, { recursive: true });
      const baseline = join(fixture, '0000_baseline.sql');
      expect(await readFile(baseline, 'utf8')).toContain('SELECT 1');
      await writeFile(baseline, 'THIS IS INVALID SQL;', 'utf8');
      await expect(
        migrate(database.db, { migrationsFolder: fixture }),
      ).rejects.toThrow();
      const migrations = await database.db.execute(sql`
        SELECT count(*)::integer AS count FROM drizzle.__drizzle_migrations
      `);
      expect(migrations.rows[0]?.['count']).toBe(0);

      const timedOut = await Promise.allSettled(
        Array.from({ length: 8 }, () =>
          database.db.execute(sql`SELECT pg_sleep(5)`),
        ),
      );
      expect(timedOut.every((result) => result.status === 'rejected')).toBe(
        true,
      );
      expect(database.pool.totalCount).toBeLessThanOrEqual(5);

      const invalid = runCli(
        'postgresql://fixture:secret-fixture@127.0.0.1:1/none',
      );
      expect(invalid.status).not.toBe(0);
      expect(invalid.stderr).not.toContain('secret-fixture');
    } finally {
      await database.close();
      await container.stop();
      const temporaryRoot = resolve(tmpdir());
      if (
        resolve(fixture).startsWith(temporaryRoot + '\\') ||
        resolve(fixture).startsWith(temporaryRoot + '/')
      ) {
        await rm(fixture, { recursive: true, force: true });
      }
    }
  }, 60_000);
});
