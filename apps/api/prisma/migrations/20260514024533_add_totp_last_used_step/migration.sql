set lock_timeout = '1s';
set statement_timeout = '5s';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "totpLastUsedStep" INTEGER;
