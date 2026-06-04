import { readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { hashTestUserPassword, TEST_USER } from './testUser.ts';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const TESTING_UI_DIR = join(moduleDir, '..', '..');
const API_DIR = join(TESTING_UI_DIR, '..', 'api');
const API_ENV_PATH = join(API_DIR, '.env');

const TEST_DB_NAME = 'linklater_testing_ui';
const PROTECTED_TABLES = new Set(['_prisma_migrations']);
const AUTH_STATE_DIR = join(TESTING_UI_DIR, '.auth');

/**
 * Resets the test database to its post-seed baseline. Truncates every table
 * other than `_prisma_migrations`, then reinserts the deterministic test user.
 * Designed to run once per `testing-ui run` invocation, before any stories
 * execute, so each invocation starts from a known empty state.
 *
 * Also deletes the cached Playwright storage state so that the first story to
 * use the `login` action runs through the real flow against fresh DB rows.
 */
export async function resetTestDatabase(): Promise<void> {
  const url = await readTestDatabaseUrl();
  guardAgainstWrongDatabase(url);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const tables = await listDataTables(client);
    if (tables.length > 0) {
      const quoted = tables.map((table) => `"${table}"`).join(', ');
      await client.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
    }
    await seedDeterministicUser(client);
  } finally {
    await client.end();
  }
  await rm(AUTH_STATE_DIR, { recursive: true, force: true });
}

/**
 * Reads the API .env once. Swap the database name to the test database so
 * the harness operates on the isolated copy even when the developer's API
 * process is pointed at the shared dev database (we only ask the developer
 * to override the API's env, not their entire shell).
 */
async function readTestDatabaseUrl(): Promise<string> {
  const raw = await readFile(API_ENV_PATH, 'utf8').catch(() => {
    throw new Error(`Cannot read API .env at ${API_ENV_PATH}`);
  });
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/);
    if (match) {
      const url = new URL(match[1]);
      url.pathname = `/${TEST_DB_NAME}`;
      return url.toString();
    }
  }
  throw new Error(`DATABASE_URL not found in ${API_ENV_PATH}`);
}

function guardAgainstWrongDatabase(connectionString: string): void {
  const url = new URL(connectionString);
  const dbName = url.pathname.replace(/^\//, '');
  if (dbName !== TEST_DB_NAME) {
    throw new Error(
      `Refusing to truncate database "${dbName}" — only "${TEST_DB_NAME}" is allowed. ` +
        `Check that apps/api/.env has not been changed.`,
    );
  }
}

async function listDataTables(client: pg.Client): Promise<string[]> {
  const { rows } = await client.query<{ tablename: string }>(
    `
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
    `,
  );
  return rows
    .map((row) => row.tablename)
    .filter((name) => !PROTECTED_TABLES.has(name));
}

async function seedDeterministicUser(client: pg.Client): Promise<void> {
  const passwordHash = await hashTestUserPassword();
  const now = new Date();
  await client.query(
    `
    INSERT INTO "User"
      ("id", "email", "passwordHash", "emailVerifiedAt", "welcomedAt", "updatedAt")
    VALUES ($1, $2, $3, $4, $4, $4)
    `,
    [TEST_USER.id, TEST_USER.email, passwordHash, now],
  );
}
