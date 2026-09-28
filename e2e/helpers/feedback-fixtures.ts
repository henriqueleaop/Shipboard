import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const apiRequire = createRequire(resolve('apps/api/package.json'));
const { Pool } = apiRequire('pg') as {
  Pool: new (options: { connectionString: string; max: number }) => {
    query(sql: string, parameters: unknown[]): Promise<{ rowCount: number }>;
    end(): Promise<void>;
  };
};

export async function seedPaginationIdeas(
  boardId: string,
  description: string,
) {
  const connectionString = process.env.E2E_DATABASE_URL;
  if (!connectionString) throw new Error('Isolated E2E database is required.');
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const inserted = await pool.query(
      `
      INSERT INTO suggestions (id, board_id, author_id, title, description, status, version, created_at, updated_at)
      SELECT gen_random_uuid(), b.id, b.owner_id, 'Additional idea ' || n,
        CASE WHEN n = 20 THEN $2 ELSE 'More feedback for pagination.' END,
        'UNDER_REVIEW', 1, now(), now()
      FROM boards b CROSS JOIN generate_series(0, 20) AS n
      WHERE b.id = $1::uuid AND b.deleted_at IS NULL
    `,
      [boardId, description],
    );
    if (inserted.rowCount !== 21)
      throw new Error('Pagination fixture was not created.');
  } finally {
    await pool.end();
  }
}
