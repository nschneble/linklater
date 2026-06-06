import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import * as bcrypt from 'bcryptjs';
import pg from 'pg';
import { TEST_USER } from './database.ts';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const TUFFGAL_DIR = moduleDir;
const REPO_ROOT = join(TUFFGAL_DIR, '..');
const API_DIR = join(REPO_ROOT, 'apps', 'api');
const API_ENV_PATH = join(API_DIR, '.env');

const TEST_DB_NAME = 'linklater_testing_ui';
const BCRYPT_ROUNDS = 10;

const execFileAsync = promisify(execFile);

/**
 * One-shot bootstrap for the dedicated test database. Idempotent: safe to
 * run repeatedly. Creates `linklater_testing_ui` if missing, runs every
 * committed Prisma migration, and upserts the deterministic test user.
 * Subsequent test runs reset state through the `database.reset` callback
 * declared in `tuffgal.config.ts` — they no longer touch this script.
 */
async function main(): Promise<void> {
  const devUrl = await readDatabaseUrl(API_ENV_PATH);
  const testUrl = withDatabase(devUrl, TEST_DB_NAME);
  await generatePrismaClient();
  await createTestDatabaseIfMissing(devUrl);
  await runMigrations(testUrl);
  await seedTestUser(testUrl);
  process.stdout.write(
    `Test database ready: ${TEST_DB_NAME}\n` +
      `Connection: ${redactPassword(testUrl)}\n` +
      `Seeded user: ${TEST_USER.email}\n` +
      `Next: run \`npm run dev:test\` in another shell, then \`npm run test:ui\`.\n`,
  );
}

async function createTestDatabaseIfMissing(devUrl: string): Promise<void> {
  const adminUrl = withDatabase(devUrl, 'postgres');
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const { rows } = await admin.query<{ exists: boolean }>(
      'SELECT 1 AS exists FROM pg_database WHERE datname = $1',
      [TEST_DB_NAME],
    );
    if (rows.length === 0) {
      // Identifiers cannot be parameterised. Whitelisted constant is safe.
      await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
      process.stdout.write(`Created database ${TEST_DB_NAME}.\n`);
    } else {
      process.stdout.write(`Database ${TEST_DB_NAME} already exists.\n`);
    }
  } finally {
    await admin.end();
  }
}

async function generatePrismaClient(): Promise<void> {
  process.stdout.write('Generating Prisma client…\n');
  await execFileAsync(
    'npx',
    ['prisma', 'generate', '--schema', 'prisma/schema.prisma'],
    { cwd: API_DIR },
  );
  process.stdout.write('Prisma client generated.\n');
}

async function runMigrations(testUrl: string): Promise<void> {
  process.stdout.write('Applying Prisma migrations…\n');
  await execFileAsync(
    'npx',
    ['prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
    {
      cwd: API_DIR,
      env: { ...process.env, DATABASE_URL: testUrl },
    },
  );
  process.stdout.write('Migrations applied.\n');
}

async function seedTestUser(testUrl: string): Promise<void> {
  const passwordHash = await bcrypt.hash(TEST_USER.password, BCRYPT_ROUNDS);
  const now = new Date();
  const client = new pg.Client({ connectionString: testUrl });
  await client.connect();
  try {
    await client.query(
      `
      INSERT INTO "User"
        ("id", "email", "passwordHash", "emailVerifiedAt", "welcomedAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $4, $4)
      ON CONFLICT ("id") DO UPDATE
        SET "passwordHash"    = EXCLUDED."passwordHash",
            "emailVerifiedAt" = EXCLUDED."emailVerifiedAt",
            "welcomedAt"      = EXCLUDED."welcomedAt",
            "updatedAt"       = EXCLUDED."updatedAt"
      `,
      [TEST_USER.id, TEST_USER.email, passwordHash, now],
    );
    process.stdout.write(`Seeded ${TEST_USER.email} (id=${TEST_USER.id}).\n`);
  } finally {
    await client.end();
  }
}

async function readDatabaseUrl(envPath: string): Promise<string> {
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

function withDatabase(connectionString: string, databaseName: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function redactPassword(connectionString: string): string {
  const url = new URL(connectionString);
  if (url.password) {
    url.password = '***';
  }
  return url.toString();
}

main().catch((error) => {
  process.stderr.write(
    `tuffgal setup error: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
