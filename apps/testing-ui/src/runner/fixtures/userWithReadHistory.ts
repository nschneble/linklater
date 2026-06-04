import { TEST_USER } from '../testUser.ts';
import type { Fixture } from './index.ts';

const FIXED_DATE = '2026-01-01T12:00:00.000Z';
const FIXED_READ_DATE = '2026-01-02T12:00:00.000Z';

const LINKS = [
  {
    id: 'fixture-read-0000000000000001',
    metaId: 'fixture-readmeta-000000000001',
    title: 'Test Link 1',
    url: 'https://example.test/read/1',
  },
  {
    id: 'fixture-read-0000000000000002',
    metaId: 'fixture-readmeta-000000000002',
    title: 'Test Link 2',
    url: 'https://example.test/read/2',
  },
  {
    id: 'fixture-read-0000000000000003',
    metaId: 'fixture-readmeta-000000000003',
    title: 'Test Link 3',
    url: 'https://example.test/read/3',
  },
] as const;

/** Same 3 links as user-with-3-links, but each carries a readAt timestamp. */
export const userWithReadHistory: Fixture = async ({ client }) => {
  for (const link of LINKS) {
    try {
      await client.query(
        `
        INSERT INTO "Link" ("id", "url", "userId", "createdAt", "updatedAt", "readAt")
        VALUES ($1, $2, $3, $4, $4, $5)
        ON CONFLICT ("id") DO NOTHING
        `,
        [link.id, link.url, TEST_USER.id, FIXED_DATE, FIXED_READ_DATE],
      );
    } catch (error) {
      throw rewriteMissingUserError(error);
    }
    await client.query(
      `
      INSERT INTO "Meta" ("id", "linkId", "title", "createdAt", "updatedAt", "fetchedAt")
      VALUES ($1, $2, $3, $4, $4, $4)
      ON CONFLICT ("id") DO NOTHING
      `,
      [link.metaId, link.id, link.title, FIXED_DATE],
    );
  }
};

function rewriteMissingUserError(error: unknown): unknown {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === '23503'
  ) {
    return new Error(
      `Fixture failed: test user ${TEST_USER.id} is missing. ` +
        `Run \`npm run test:ui:setup\` to seed the test database first.`,
    );
  }
  return error;
}
