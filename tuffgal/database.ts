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
 * Returns a `createdAt` that is `index` seconds *before* `FIXED_DATE`, so the
 * three fixture links get strictly-decreasing timestamps in slot order (Test
 * Link 1 newest, Test Link 3 oldest). The links list sorts by `createdAt desc`
 * with no secondary key, so identical timestamps left the row order tied and
 * Postgres returned heap order — nondeterministic across resets. That surfaced
 * as an intermittent "changed" on the read-list screenshots (rows swapped
 * between runs, not mid-reflow noise). Distinct timestamps pin the order.
 */
function fixtureCreatedAt(index: number): string {
  const base = new Date(FIXED_DATE).getTime();
  return new Date(base - index * 1000).toISOString();
}

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
  const links = FIXTURE_META.map((entry, index) => ({
    ...entry,
    id: `fixture-link-000000000000000${index + 1}`,
    metaId: `fixture-meta-000000000000000${index + 1}`,
    url: `https://example.test/${index + 1}`,
    createdAt: fixtureCreatedAt(index),
  }));
  await applyLinks(links, null);
}

/**
 * Same 3 links as `userWithLinksFixture` but each carries a `readAt`
 * timestamp. URLs are distinct so the two fixtures can coexist without
 * violating the `Link_userId_url_key` constraint.
 */
export async function userWithReadHistoryFixture(): Promise<void> {
  const links = FIXTURE_META.map((entry, index) => ({
    ...entry,
    id: `fixture-read-000000000000000${index + 1}`,
    metaId: `fixture-readmeta-00000000000${index + 1}`,
    url: `https://example.test/read/${index + 1}`,
    createdAt: fixtureCreatedAt(index),
  }));
  await applyLinks(links, FIXED_READ_DATE);
}

interface FixtureLink {
  id: string;
  metaId: string;
  title: string;
  url: string;
  description: string;
  faviconUrl: string;
  imageUrl: string;
  siteName: string;
  createdAt: string;
}

/**
 * Realistic Meta payload per Test Link slot. Each entry mirrors what a
 * real OpenGraph scrape returns — title, description, siteName, and two
 * inline-SVG data URLs for favicon + hero image. Inline data URLs keep
 * the cards visually deterministic without depending on placeholder
 * image services (network flake) or shipping fixture PNGs. The titles
 * are preserved as "Test Link N" because action selectors elsewhere in
 * the suite resolve cards by that exact role+text.
 */
const FIXTURE_META: ReadonlyArray<{
  title: string;
  description: string;
  siteName: string;
  faviconUrl: string;
  imageUrl: string;
}> = [
  {
    title: 'Test Link 1',
    description:
      'Practical notes on building durable software — concrete examples, minimal jargon, hard-won lessons from teams that ship slowly.',
    siteName: 'Slow Software Weekly',
    faviconUrl: buildFaviconDataUrl('S', '#2563eb'),
    imageUrl: buildImageDataUrl('Slow Software', '#1e3a8a'),
  },
  {
    title: 'Test Link 2',
    description:
      'A long-form essay on the quiet renaissance of typography on the web — how line-height, optical sizing, and tabular numerals reshape reading.',
    siteName: 'Press Daily',
    faviconUrl: buildFaviconDataUrl('P', '#b45309'),
    imageUrl: buildImageDataUrl('Press Daily', '#92400e'),
  },
  {
    title: 'Test Link 3',
    description:
      'Reference docs for the platform’s public APIs, covering authentication, idempotency keys, and the conventions every integrator needs.',
    siteName: 'Docs Reference',
    faviconUrl: buildFaviconDataUrl('D', '#059669'),
    imageUrl: buildImageDataUrl('Docs Reference', '#064e3b'),
  },
];

function buildFaviconDataUrl(letter: string, color: string): string {
  const hex = color.replace('#', '%23');
  return (
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' " +
    `viewBox='0 0 32 32'><rect width='32' height='32' fill='${hex}'/>` +
    `<text x='16' y='22' font-size='18' text-anchor='middle' ` +
    `font-family='sans-serif' fill='white'>${letter}</text></svg>`
  );
}

function buildImageDataUrl(label: string, color: string): string {
  const hex = color.replace('#', '%23');
  return (
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' " +
    `viewBox='0 0 240 126'><rect width='240' height='126' fill='${hex}'/>` +
    `<text x='120' y='72' font-size='22' text-anchor='middle' ` +
    `font-family='sans-serif' fill='white'>${label}</text></svg>`
  );
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
      // Wipe any prior story's links + cascading Meta rows for this user
      // before reapplying. ON CONFLICT on row id keeps a fixture's own
      // rows idempotent across reruns but leaves stale rows written by
      // API-driven stories (save-link, bookmarklet), which then leak
      // into later stories and drift their screenshots.
      await client.query(`DELETE FROM "Link" WHERE "userId" = $1`, [
        TEST_USER.id,
      ]);
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
            ($1, $2, $3, $4, $5, $6,
             to_tsvector('english', unaccent(coalesce($7, '') || ' ' || $2)))
          ON CONFLICT ("id") DO UPDATE
            SET "url"          = EXCLUDED."url",
                "userId"       = EXCLUDED."userId",
                "createdAt"    = EXCLUDED."createdAt",
                "updatedAt"    = EXCLUDED."updatedAt",
                "readAt"       = EXCLUDED."readAt",
                "searchVector" = EXCLUDED."searchVector"
          `,
          [
            link.id,
            link.url,
            TEST_USER.id,
            link.createdAt,
            FIXED_DATE,
            readAt,
            link.title,
          ],
        );
        await client.query(
          `
          INSERT INTO "Meta"
            ("id", "linkId", "title", "description", "faviconUrl",
             "imageUrl", "siteName", "createdAt", "updatedAt", "fetchedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $8)
          ON CONFLICT ("id") DO UPDATE
            SET "linkId"      = EXCLUDED."linkId",
                "title"       = EXCLUDED."title",
                "description" = EXCLUDED."description",
                "faviconUrl"  = EXCLUDED."faviconUrl",
                "imageUrl"    = EXCLUDED."imageUrl",
                "siteName"    = EXCLUDED."siteName",
                "updatedAt"   = EXCLUDED."updatedAt",
                "fetchedAt"   = EXCLUDED."fetchedAt"
          `,
          [
            link.metaId,
            link.id,
            link.title,
            link.description,
            link.faviconUrl,
            link.imageUrl,
            link.siteName,
            FIXED_DATE,
          ],
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
