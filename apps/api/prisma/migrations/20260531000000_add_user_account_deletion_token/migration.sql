set lock_timeout = '1s';
set statement_timeout = '5s';

-- Adds a per-user one-time token for confirming account deletion via email.
-- AuthService.deleteAccount stores the SHA-256 hash of a freshly generated
-- raw token here (with a 15-minute expiry) whenever a magic-link-only-no-MFA
-- account requests deletion. The raw token is emailed to the account holder;
-- clicking the link calls AuthService.confirmAccountDeletion which consumes
-- the token via an atomic CAS against this column, then deletes the user row.
-- The column is unique so token lookups go through the unique index, not a
-- table scan.

-- AlterTable: add the token + expiry columns
ALTER TABLE "User" ADD COLUMN "accountDeletionToken" TEXT;
ALTER TABLE "User" ADD COLUMN "accountDeletionTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex: unique constraint so tokens can be looked up directly
CREATE UNIQUE INDEX "User_accountDeletionToken_key" ON "User"("accountDeletionToken");
