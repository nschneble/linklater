set lock_timeout = '1s';
set statement_timeout = '5s';

-- AlterTable: add providerEmail nullable first so backfill can populate it
-- before the NOT NULL constraint lands.
ALTER TABLE "OAuthAccount" ADD COLUMN "providerEmail" TEXT;

-- Backfill: existing OAuthAccount rows pre-date provider-email storage. The
-- previous linking path enforced providerEmail === user.email, so mirroring
-- the linked user's email is a correct historical reconstruction.
UPDATE "OAuthAccount" SET "providerEmail" = "User"."email"
FROM "User" WHERE "OAuthAccount"."userId" = "User"."id";

-- AlterColumn: lock in NOT NULL now that every row has a value.
ALTER TABLE "OAuthAccount" ALTER COLUMN "providerEmail" SET NOT NULL;
