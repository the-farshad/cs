/** Postgres connection pool and startup migration runner. */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

/** Shared connection pool. Import this everywhere DB access is needed. */
export const pool = new Pool({ connectionString });

const here = dirname(fileURLToPath(import.meta.url));
// migrations/ sits next to apps/api root: ../migrations from both src/ and dist/.
const migrationsDir = join(here, '..', 'migrations');

/**
 * Run every `migrations/*.sql` file in filename order. Migrations are written to
 * be idempotent (`create ... if not exists`), so running them on every startup
 * is safe.
 */
export async function migrate(): Promise<void> {
  let files: string[];
  try {
    files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort();
  } catch (err) {
    throw new Error(`Could not read migrations dir ${migrationsDir}: ${String(err)}`);
  }

  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    await pool.query(sql);
    console.log(`[migrate] applied ${file}`);
  }
}
