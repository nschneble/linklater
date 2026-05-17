set lock_timeout = '1s';
set statement_timeout = '5s';

-- CreateIndex
CREATE INDEX "Link_userId_archivedAt_idx" ON "Link"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "Link_userId_createdAt_idx" ON "Link"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Link_userId_idx" ON "Link"("userId");
