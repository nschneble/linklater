set lock_timeout = '1s';
set statement_timeout = '5s';

-- Adds a kind discriminator + an optional plaintext secret column to ApiToken
-- so the bookmarklet can use a hidden, never-expiring PAT that is retrievable
-- on every settings load. The `kind` enum starts at USER/BOOKMARKLET; future
-- kinds (EXTENSION, CLI, etc.) can be added without another column.
--
-- `secretValue` is populated ONLY for kind = BOOKMARKLET. Standard user PATs
-- continue to follow the hash-only / shown-once model — `secretValue` stays
-- NULL for them. The partial unique index enforces at most one bookmarklet
-- token per user; the composite (userId, kind) index serves the common
-- lookups in TokensService.findAll and getOrCreateBookmarkletToken.
CREATE TYPE "TokenKind" AS ENUM ('USER', 'BOOKMARKLET');

ALTER TABLE "ApiToken"
  ADD COLUMN "kind" "TokenKind" NOT NULL DEFAULT 'USER',
  ADD COLUMN "secretValue" TEXT;

CREATE UNIQUE INDEX "ApiToken_userId_bookmarklet_unique"
  ON "ApiToken" ("userId") WHERE "kind" = 'BOOKMARKLET';

CREATE INDEX "ApiToken_userId_kind_idx" ON "ApiToken" ("userId", "kind");
