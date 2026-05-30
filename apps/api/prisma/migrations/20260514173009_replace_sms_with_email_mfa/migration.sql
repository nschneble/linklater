set lock_timeout = '1s';
set statement_timeout = '5s';

/*
  Warnings:

  - You are about to drop the column `phoneNumber` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `smsEnabledAt` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "phoneNumber",
DROP COLUMN "smsEnabledAt",
ADD COLUMN     "emailMultiFactorCodeHash" TEXT,
ADD COLUMN     "emailMultiFactorEnabledAt" TIMESTAMP(3),
ADD COLUMN     "emailMultiFactorExpiresAt" TIMESTAMP(3);
