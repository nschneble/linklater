import { readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as bcrypt from 'bcryptjs';
import pg from 'pg';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const TUFFGAL_DIR = moduleDir;
const REPO_ROOT = join(TUFFGAL_DIR, '..');
const API_ENV_PATH = join(REPO_ROOT, 'apps', 'api', '.env');

const TEST_DB_NAME = 'linklater_testing_ui';
const PROTECTED_TABLES = new Set(['_prisma_migrations']);
const AUTH_STATE_DIR = join(TUFFGAL_DIR, '.auth');
const BCRYPT_ROUNDS = 10;

export const TEST_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'testing-ui@linklater.test',
  password: 'testing-ui-correct-horse',
} as const;

const FIXED_DATE = '2026-01-01T12:00:00.000Z';
const FIXED_READ_DATE = '2026-01-02T12:00:00.000Z';

/**
 * Truncates every public-schema table other than `_prisma_migrations`, then
 * re-inserts the deterministic test user. Wipes the cached storage state so
 * the first story that produces `logged-in` runs through the real login
 * flow against fresh DB rows.
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
 * 3 unread links owned by TEST_USER. Idempotent — re-applying the fixture
 * leaves the database in the same state.
 */
export async function userWithLinksFixture(): Promise<void> {
  const links = [
    { id: 'fixture-link-0000000000000001', metaId: 'fixture-meta-0000000000000001', title: 'Test Link 1', url: 'https://example.test/1' },
    { id: 'fixture-link-0000000000000002', metaId: 'fixture-meta-0000000000000002', title: 'Test Link 2', url: 'https://example.test/2' },
    { id: 'fixture-link-0000000000000003', metaId: 'fixture-meta-0000000000000003', title: 'Test Link 3', url: 'https://example.test/3' },
  ];
  await applyLinks(links, null);
}

/**
 * Same 3 links as `userWithLinksFixture` but each carries a `readAt`
 * timestamp. URLs are distinct so the two fixtures can coexist without
 * violating the `Link_userId_url_key` constraint.
 */
export async function userWithReadHistoryFixture(): Promise<void> {
  const links = [
    { id: 'fixture-read-0000000000000001', metaId: 'fixture-readmeta-000000000001', title: 'Test Link 1', url: 'https://example.test/read/1' },
    { id: 'fixture-read-0000000000000002', metaId: 'fixture-readmeta-000000000002', title: 'Test Link 2', url: 'https://example.test/read/2' },
    { id: 'fixture-read-0000000000000003', metaId: 'fixture-readmeta-000000000003', title: 'Test Link 3', url: 'https://example.test/read/3' },
  ];
  await applyLinks(links, FIXED_READ_DATE);
}

interface FixtureLink {
  id: string;
  metaId: string;
  title: string;
  url: string;
}

async function applyLinks(
  links: FixtureLink[],
  readAt: string | null,
): Promise<void> {
  const url = await readTestDatabaseUrl();
  guardAgainstWrongDatabase(url);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    try {
      for (const link of links) {
        await client.query(
          `
          INSERT INTO "Link" ("id", "url", "userId", "createdAt", "updatedAt", "readAt")
          VALUES ($1, $2, $3, $4, $4, $5)
          ON CONFLICT ("id") DO NOTHING
          `,
          [link.id, link.url, TEST_USER.id, FIXED_DATE, readAt],
        );
        await client.query(
          `
          INSERT INTO "Meta" ("id", "linkId", "title", "createdAt", "updatedAt", "fetchedAt")
          VALUES ($1, $2, $3, $4, $4, $4)
          ON CONFLICT ("id") DO NOTHING
          `,
          [link.metaId, link.id, link.title, FIXED_DATE],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  } finally {
    await client.end();
  }
}

async function readTestDatabaseUrl(): Promise<string> {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = `/${TEST_DB_NAME}`;
    return url.toString();
  }
  const raw = await readFile(API_ENV_PATH, 'utf8').catch(() => {
    throw new Error(
      `DATABASE_URL not set and cannot read API .env at ${API_ENV_PATH}`,
    );
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
      `Refusing to operate on database "${dbName}" — only "${TEST_DB_NAME}" is allowed. ` +
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
  const passwordHash = await bcrypt.hash(TEST_USER.password, BCRYPT_ROUNDS);
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
