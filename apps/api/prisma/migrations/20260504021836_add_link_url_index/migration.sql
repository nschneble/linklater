set lock_timeout = '1s';
set statement_timeout = '5s';

-- CreateIndex
CREATE INDEX "Link_userId_url_idx" ON "Link"("userId", "url");
