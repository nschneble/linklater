import * as bcrypt from 'bcryptjs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(moduleDir, '..');
const API_ENV_PATH = join(ROOT_DIR, '..', 'api', '.env');

const TEST_EMAIL = 'testing-ui@linklater.test';
const TEST_PASSWORD = 'testing-ui-correct-horse';

/**
 * Idempotent seed for the testing-ui test user. Reads `DATABASE_URL` straight
 * from `apps/api/.env` so we share the dev database (the harness runs against
 * `npm run dev`, which uses that same DB). Upserts a user with a known
 * password hash, pre-verified email, and `welcomedAt` set so the UI lands the
 * user on `/unread` rather than the welcome wizard.
 */
async function main(): Promise<void> {
  const databaseUrl = await readDatabaseUrl(API_ENV_PATH);
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const now = new Date();
    const result = await client.query<{ id: string }>(
      `
      INSERT INTO "User" ("id", "email", "passwordHash", "emailVerifiedAt", "welcomedAt", "updatedAt")
      VALUES (gen_random_uuid()::text, $1, $2, $3, $3, $3)
      ON CONFLICT ("email") DO UPDATE
        SET "passwordHash" = EXCLUDED."passwordHash",
            "emailVerifiedAt" = EXCLUDED."emailVerifiedAt",
            "welcomedAt" = EXCLUDED."welcomedAt",
            "updatedAt" = EXCLUDED."updatedAt"
      RETURNING "id"
      `,
      [TEST_EMAIL, passwordHash, now],
    );
    process.stdout.write(
      `Seeded ${TEST_EMAIL} (id=${result.rows[0]?.id ?? 'unknown'})\n`,
    );
    process.stdout.write(
      `Password (for login action JSON): ${TEST_PASSWORD}\n`,
    );
  } finally {
    await client.end();
  }
}

async function readDatabaseUrl(envPath: string): Promise<string> {
  const raw = await readFile(envPath, 'utf8').catch(() => {
    throw new Error(`Cannot read API .env at ${envPath}`);
  });
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/);
    if (match) {
      return match[1];
    }
  }
  throw new Error(`DATABASE_URL not found in ${envPath}`);
}

main().catch((error) => {
  process.stderr.write(
    `seed error: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
