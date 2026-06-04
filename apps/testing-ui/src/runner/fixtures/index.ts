import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { userWithLinks } from './userWithLinks.ts';
import { userWithReadHistory } from './userWithReadHistory.ts';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const TESTING_UI_DIR = join(moduleDir, '..', '..', '..');
const API_DIR = join(TESTING_UI_DIR, '..', 'api');
const API_ENV_PATH = join(API_DIR, '.env');

const TEST_DB_NAME = 'linklater_testing_ui';

export interface FixtureContext {
  client: pg.Client;
}

export type Fixture = (context: FixtureContext) => Promise<void>;

const FIXTURES: Record<string, Fixture> = {
  'user-with-3-links': userWithLinks,
  'user-with-read-history': userWithReadHistory,
};

/**
 * Connects to the test DB, runs the named fixture, disconnects. The function
 * itself owns connection lifecycle so callers do not have to.
 */
export async function applyFixture(name: string): Promise<void> {
  const fixture = FIXTURES[name];
  if (!fixture) {
    const known = listFixtures().join(', ');
    throw new Error(`Unknown fixture: ${name}. Known: ${known}`);
  }
  const url = await readTestDatabaseUrl();
  guardAgainstWrongDatabase(url);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await fixture({ client });
  } finally {
    await client.end();
  }
}

export function listFixtures(): string[] {
  return Object.keys(FIXTURES);
}

// Mirrors the .env-reading logic in testDb.ts. Duplicated rather than imported
// because testDb.ts does not export these helpers and the hard constraints
// forbid editing it.
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
      `Refusing to apply fixture to database "${dbName}" — only "${TEST_DB_NAME}" is allowed. ` +
        `Check that apps/api/.env has not been changed.`,
    );
  }
}
