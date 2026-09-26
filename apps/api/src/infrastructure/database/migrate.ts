import { fileURLToPath, pathToFileURL } from 'node:url';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { readConfig } from '../../app/config.js';
import { createDatabase } from './client.js';

function logMigration(event: string, errorCode?: string): void {
  process.stdout.write(
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      level: errorCode ? 'error' : 'info',
      service: 'shipboard-api',
      event,
      ...(errorCode ? { errorCode } : {}),
    })}\n`,
  );
}

export async function runMigrations(): Promise<void> {
  const config = readConfig();
  const database = createDatabase(config.DATABASE_URL);
  logMigration('database.migration_started');
  try {
    await migrate(database.db, {
      migrationsFolder: fileURLToPath(
        new URL('./migrations/', import.meta.url),
      ),
    });
    logMigration('database.migration_completed');
  } catch {
    logMigration('database.migration_failed', 'MIGRATION_FAILED');
    throw new Error('Database migration failed.');
  } finally {
    await database.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runMigrations().catch(() => {
    // Database drivers can embed credentials in error messages. Keep CLI output generic.
    process.stderr.write('Database migration failed.\n');
    process.exitCode = 1;
  });
}
