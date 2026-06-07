import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rm } from 'node:fs/promises';
import * as bcrypt from 'bcryptjs';
import pg from 'pg';
import {
  TEST_DB_NAME,
  guardAgainstWrongDatabase,
  readDatabaseUrl,
  withDatabase,
} from './database-url.ts';

const TUFFGAL_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TUFFGAL_DIR, '..');
const API_ENV_PATH = join(REPO_ROOT, 'apps', 'api', '.env');

const PROTECTED_TABLES = new Set(['_prisma_migrations']);
const AUTH_STATE_DIR = join(TUFFGAL_DIR, '.auth');

// Bcrypt minimum (4 rounds). Test password is a known plaintext seeded
// once per reset; production-grade work factor would only burn CI time.
const BCRYPT_ROUNDS = 4;

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
  const url = await resolveTestUrl();
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
 * leaves the database in the same state, including the searchVector (which
 * is computed inside the INSERT to stay in lockstep with `url` and
 * `Meta.title`).
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
  const url = await resolveTestUrl();
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    try {
      for (const link of links) {
        // Compute searchVector inline + refresh on conflict so the index
        // never gets out of sync with url + title when fixture data is
        // edited between runs (the prior INSERT-then-UPDATE pattern left
        // a stale row when ON CONFLICT skipped the INSERT).
        await client.query(
          `
          INSERT INTO "Link"
            ("id", "url", "userId", "createdAt", "updatedAt", "readAt", "searchVector")
          VALUES
            ($1, $2, $3, $4, $4, $5,
             to_tsvector('english', unaccent(coalesce($6, '') || ' ' || $2)))
          ON CONFLICT ("id") DO UPDATE
            SET "url"          = EXCLUDED."url",
                "userId"       = EXCLUDED."userId",
                "createdAt"    = EXCLUDED."createdAt",
                "updatedAt"    = EXCLUDED."updatedAt",
                "readAt"       = EXCLUDED."readAt",
                "searchVector" = EXCLUDED."searchVector"
          `,
          [link.id, link.url, TEST_USER.id, FIXED_DATE, readAt, link.title],
        );
        await client.query(
          `
          INSERT INTO "Meta"
            ("id", "linkId", "title", "createdAt", "updatedAt", "fetchedAt")
          VALUES ($1, $2, $3, $4, $4, $4)
          ON CONFLICT ("id") DO UPDATE
            SET "linkId"    = EXCLUDED."linkId",
                "title"     = EXCLUDED."title",
                "updatedAt" = EXCLUDED."updatedAt",
                "fetchedAt" = EXCLUDED."fetchedAt"
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

async function resolveTestUrl(): Promise<string> {
  const raw = await readDatabaseUrl(API_ENV_PATH);
  const url = withDatabase(raw, TEST_DB_NAME);
  guardAgainstWrongDatabase(url);
  return url;
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
  // Pin every timestamp to FIXED_DATE so any UI that surfaces User.* fields
  // renders byte-identical across runs; the client-side `frozenTime` only
  // covers Date.now() in the browser, not server-written timestamps.
  await client.query(
    `
    INSERT INTO "User"
      ("id", "email", "passwordHash", "emailVerifiedAt", "welcomedAt", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, $4, $4, $4)
    `,
    [TEST_USER.id, TEST_USER.email, passwordHash, FIXED_DATE],
  );
}
