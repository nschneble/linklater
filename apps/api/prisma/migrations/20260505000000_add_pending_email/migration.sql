ALTER TABLE "User" ADD COLUMN "pendingEmail"               TEXT,
                   ADD COLUMN "pendingEmailToken"          TEXT,
                   ADD COLUMN "pendingEmailTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_pendingEmailToken_key" ON "User"("pendingEmailToken");
