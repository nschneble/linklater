DROP INDEX "Link_userId_archivedAt_idx";

ALTER TABLE "Link" RENAME COLUMN "archivedAt" TO "readAt";

CREATE INDEX "Link_userId_readAt_idx" ON "Link"("userId", "readAt");
