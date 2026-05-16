-- squawk-ignore-file
/*
  Warnings:

  - You are about to drop the column `phoneNumber` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `smsEnabledAt` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "phoneNumber",
DROP COLUMN "smsEnabledAt",
ADD COLUMN     "emailTwoFactorCodeHash" TEXT,
ADD COLUMN     "emailTwoFactorEnabledAt" TIMESTAMP(3),
ADD COLUMN     "emailTwoFactorExpiresAt" TIMESTAMP(3);
