import { readFile } from 'node:fs/promises';

export const TEST_DB_NAME = 'linklater_testing_ui';

/**
 * Resolves a Postgres connection URL for the testing-ui workflow. Prefers
 * `process.env.DATABASE_URL` (set by CI + by `npm run dev:test`) and falls
 * back to parsing the `DATABASE_URL` line out of the API .env file for the
 * local dev case where the API .env is the source of truth.
 */
export async function readDatabaseUrl(envPath: string): Promise<string> {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const raw = await readFile(envPath, 'utf8').catch(() => {
    throw new Error(
      `DATABASE_URL not set and cannot read API .env at ${envPath}`,
    );
  });
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/);
    if (match) {
      return match[1];
    }
  }
  throw new Error(`DATABASE_URL not found in ${envPath}`);
}

/**
 * Returns the input connection string with its database name swapped to
 * `databaseName`, preserving credentials, host, port, and query params.
 */
export function withDatabase(
  connectionString: string,
  databaseName: string,
): string {
  const url = new URL(connectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

/**
 * Refuses to proceed unless the connection string points at the
 * testing-ui database. Guards against an edit to `.env` accidentally
 * wiring destructive operations to a dev or prod database.
 */
export function guardAgainstWrongDatabase(connectionString: string): void {
  const url = new URL(connectionString);
  const dbName = url.pathname.replace(/^\//, '');
  if (dbName !== TEST_DB_NAME) {
    throw new Error(
      `Refusing to operate on database "${dbName}" — only "${TEST_DB_NAME}" is allowed. ` +
        `Check that apps/api/.env has not been changed.`,
    );
  }
}
