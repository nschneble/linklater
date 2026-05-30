set lock_timeout = '1s';
set statement_timeout = '5s';

/*
  Removes email MFA fields and repurposes storage for magic link login tokens.
  Old bcrypt hashes in emailMultiFactorCodeHash are incompatible with the new
  plain-token lookup pattern, so the column is cleared before renaming.
*/

-- AlterTable: clear stale hashes before renaming (bcrypt hashes cannot be used as lookup tokens)
UPDATE "User" SET "emailMultiFactorCodeHash" = NULL, "emailMultiFactorExpiresAt" = NULL;

-- AlterTable: drop the email-MFA-enabled flag
ALTER TABLE "User" DROP COLUMN "emailMultiFactorEnabledAt";

-- AlterTable: rename columns to reflect magic link purpose
ALTER TABLE "User" RENAME COLUMN "emailMultiFactorCodeHash" TO "magicLinkToken";
ALTER TABLE "User" RENAME COLUMN "emailMultiFactorExpiresAt" TO "magicLinkTokenExpiresAt";

-- CreateIndex: unique constraint so tokens can be looked up directly
CREATE UNIQUE INDEX "User_magicLinkToken_key" ON "User"("magicLinkToken");
