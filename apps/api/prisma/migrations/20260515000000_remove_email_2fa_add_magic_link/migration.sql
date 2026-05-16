/*
  Removes email 2FA fields and repurposes storage for magic link login tokens.
  Old bcrypt hashes in emailTwoFactorCodeHash are incompatible with the new
  plain-token lookup pattern, so the column is cleared before renaming.
*/

-- AlterTable: clear stale hashes before renaming (bcrypt hashes cannot be used as lookup tokens)
UPDATE "User" SET "emailTwoFactorCodeHash" = NULL, "emailTwoFactorExpiresAt" = NULL;

-- AlterTable: drop the email-2FA-enabled flag
ALTER TABLE "User" DROP COLUMN "emailTwoFactorEnabledAt";

-- AlterTable: rename columns to reflect magic link purpose
ALTER TABLE "User" RENAME COLUMN "emailTwoFactorCodeHash" TO "magicLinkToken";
ALTER TABLE "User" RENAME COLUMN "emailTwoFactorExpiresAt" TO "magicLinkTokenExpiresAt";

-- CreateIndex: unique constraint so tokens can be looked up directly
CREATE UNIQUE INDEX "User_magicLinkToken_key" ON "User"("magicLinkToken");
