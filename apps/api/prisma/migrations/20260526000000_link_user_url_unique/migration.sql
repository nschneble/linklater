set lock_timeout = '1s';
set statement_timeout = '5s';

-- LinksService.create did a read-then-write to avoid duplicate (userId, url)
-- rows, but the gap between findFirst and create allowed two concurrent
-- POST /links calls for the same URL to both pass the existence check and
-- both insert. Promote the existing (userId, url) lookup index to a unique
-- constraint so the database rejects the second insert with P2002, and the
-- service can recover by re-fetching the now-existing row.

-- Drop any pre-existing duplicate rows first; without this, the unique
-- index creation below would fail on tables that already have duplicates.
-- Keeps the row with the most recent createdAt per (userId, url); ties
-- are broken by id so the deletion is deterministic.
DELETE FROM "Link" l1
USING "Link" l2
WHERE l1."userId" = l2."userId"
  AND l1.url = l2.url
  AND (l1."createdAt", l1.id) < (l2."createdAt", l2.id);

-- Replace the non-unique lookup index with a unique index covering the
-- same columns. Postgres will use the unique index for the same lookups
-- the dropped index served, so query plans are not regressed.
DROP INDEX "Link_userId_url_idx";
CREATE UNIQUE INDEX "Link_userId_url_key" ON "Link" ("userId", "url");
