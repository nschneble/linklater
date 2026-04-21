CREATE INDEX "Link_userId_idx"            ON "Link"("userId");
CREATE INDEX "Link_userId_archivedAt_idx" ON "Link"("userId", "archivedAt");
CREATE INDEX "Link_userId_createdAt_idx"  ON "Link"("userId", "createdAt");
