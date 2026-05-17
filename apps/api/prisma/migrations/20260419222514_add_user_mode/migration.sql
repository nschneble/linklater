set lock_timeout = '1s';
set statement_timeout = '5s';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "theme" SET DEFAULT 'scanner-darkly';
