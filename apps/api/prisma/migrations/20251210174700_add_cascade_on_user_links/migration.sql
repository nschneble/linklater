set lock_timeout = '1s';
set statement_timeout = '5s';

-- DropForeignKey
ALTER TABLE "Link" DROP CONSTRAINT "Link_userId_fkey";

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "Link" VALIDATE CONSTRAINT "Link_userId_fkey";
