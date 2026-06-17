set lock_timeout = '1s';
set statement_timeout = '5s';

-- Enforces at most one API_DOCS token per user via a partial unique index,
-- mirroring the BOOKMARKLET partial unique index. This both guarantees the
-- "one hidden API-docs token per user" invariant and enables the P2002 race
-- fallback in ApiDocsTokensService.getOrCreate (two tabs minting at once).
--
-- Runs in a separate migration from the ALTER TYPE ... ADD VALUE above so the
-- 'API_DOCS' enum value is already committed before this index references it.
CREATE UNIQUE INDEX "ApiToken_userId_apiDocs_unique"
  ON "ApiToken" ("userId") WHERE "kind" = 'API_DOCS';
