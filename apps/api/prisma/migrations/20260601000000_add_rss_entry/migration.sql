set lock_timeout = '1s';
set statement_timeout = '5s';

-- Caches entries pulled from external RSS/Atom feeds (Aeon, Atlas Obscura,
-- Colossal, Low-Tech Magazine, Nautilus). A pg-boss scheduled job refreshes
-- each source every six hours; the SuggestionsService reads from this table
-- when the Stumble empty state or the unread-list callout needs to show a
-- pick-one-from-a-source suggestion. Wikipedia is not stored here — it has
-- a true random-article API and is fetched on demand.

-- CreateTable: cached feed entries keyed by (sourceKey, url) so the upsert
-- on refresh dedupes by canonical URL within a source.
CREATE TABLE "RssEntry" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "siteName" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RssEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique constraint so refresh upserts dedupe on (source, url).
CREATE UNIQUE INDEX "RssEntry_sourceKey_url_key" ON "RssEntry"("sourceKey", "url");

-- CreateIndex: descending compound index so the "latest N for a source" read
-- in RssFeedService.getLatest is a single index scan, no sort step.
CREATE INDEX "RssEntry_sourceKey_publishedAt_idx" ON "RssEntry"("sourceKey", "publishedAt" DESC);
