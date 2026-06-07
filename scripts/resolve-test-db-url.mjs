import { readFileSync } from 'node:fs';

/**
 * Resolves the Postgres URL for the testing-ui database
 * (`linklater_testing_ui`). Prefers an explicit `DATABASE_URL` env var
 * (set by CI), falls back to parsing `apps/api/.env` for local dev.
 * Prints the resolved URL to stdout. Exits non-zero with an explanation
 * if neither source is usable so `dev:test` fails loudly instead of
 * launching the API with an empty `DATABASE_URL`.
 */

const TEST_DB_NAME = 'linklater_testing_ui';
const ENV_FILE = 'apps/api/.env';

function rewritePath(raw) {
  const url = new URL(raw);
  url.pathname = `/${TEST_DB_NAME}`;
  return url.toString();
}

function fromEnvVar() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return null;
  try {
    return rewritePath(raw);
  } catch (error) {
    process.stderr.write(
      `Invalid DATABASE_URL env var: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return null;
  }
}

function fromEnvFile() {
  let raw;
  try {
    raw = readFileSync(ENV_FILE, 'utf8');
  } catch {
    return null;
  }
  const match = raw.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/m);
  if (!match) return null;
  try {
    return rewritePath(match[1]);
  } catch {
    return null;
  }
}

const resolved = fromEnvVar() ?? fromEnvFile();
if (!resolved) {
  process.stderr.write(
    `Could not resolve testing-ui database URL: set DATABASE_URL or add DATABASE_URL to ${ENV_FILE}.\n`,
  );
  process.exit(1);
}
process.stdout.write(resolved);
