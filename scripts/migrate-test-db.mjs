import { execFileSync } from 'node:child_process';

/**
 * Applies every committed Prisma migration to the testing-ui database
 * before `dev:test` launches the API. Tuffgal's per-run reset only
 * truncates rows, so a migration added since the last `tuffgal:setup`
 * would otherwise leave the test DB on a stale schema and the first
 * authenticated query would fail with a missing-column error.
 *
 * Reuses `resolve-test-db-url.mjs` as the single source of truth for the
 * connection string, then runs `migrate deploy` (not `dev`) so it never
 * prompts or creates new migration files in this non-interactive path.
 */
const testDatabaseUrl = execFileSync(
  'node',
  ['scripts/resolve-test-db-url.mjs'],
  {
    encoding: 'utf8',
  },
).trim();

execFileSync(
  'npx',
  ['prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
  {
    cwd: 'apps/api',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'inherit',
  },
);
