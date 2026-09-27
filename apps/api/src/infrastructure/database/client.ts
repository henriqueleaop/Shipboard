import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export function createDatabase(
  url: string,
  onIdleError: () => void = () => undefined,
) {
  const pool = new Pool({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: 500,
    idleTimeoutMillis: 1_000,
    statement_timeout: 1_000,
    query_timeout: 1_000,
  });
  pool.on('error', onIdleError);
  const db = drizzle({ client: pool });

  return {
    db,
    pool,
    async check(): Promise<void> {
      await db.execute(sql`select 1`);
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
}
