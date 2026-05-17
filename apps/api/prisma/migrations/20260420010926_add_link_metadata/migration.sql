set lock_timeout = '1s';
set statement_timeout = '5s';

-- AlterTable
ALTER TABLE "Link" ADD COLUMN     "metaDescription" TEXT,
ADD COLUMN     "metaFetchedAt" TIMESTAMP(3),
ADD COLUMN     "metaImage" TEXT;
