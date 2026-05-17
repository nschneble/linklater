set lock_timeout = '1s';
set statement_timeout = '5s';

-- DropIndex
DROP INDEX "Link_userId_archivedAt_idx";

-- AlterTable
ALTER TABLE "Link" RENAME COLUMN "archivedAt" TO "readAt";

-- CreateIndex
CREATE INDEX "Link_userId_readAt_idx" ON "Link"("userId", "readAt");
