set lock_timeout = '1s';
set statement_timeout = '5s';

-- Adds the API_DOCS discriminator to the TokenKind enum so the API docs page
-- can use a hidden, never-expiring, auto-provisioned PAT whose raw value is
-- retrievable on every load (to pre-fill the live "try it out" panel). Like
-- BOOKMARKLET, API_DOCS rows populate `secretValue`; standard USER PATs stay
-- hash-only.
--
-- The enum value is added in its OWN migration, separate from the partial
-- unique index that references it. Postgres forbids using a freshly added enum
-- value within the same transaction ("New enum values must be committed before
-- they can be used"), and Prisma wraps each migration file in one transaction.
-- The index that depends on this value therefore lives in the next migration.
--
-- `AFTER 'BOOKMARKLET'` pins the sort position explicitly (squawk
-- require-enum-value-ordering) — appending after the last existing value
-- matches the schema declaration order USER, BOOKMARKLET, API_DOCS.
ALTER TYPE "TokenKind" ADD VALUE 'API_DOCS' AFTER 'BOOKMARKLET';
