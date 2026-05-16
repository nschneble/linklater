-- squawk-ignore-file
/*
  Warnings:

  - You are about to drop the column `host` on the `Link` table. All the data in the column will be lost.
  - You are about to drop the column `metaDescription` on the `Link` table. All the data in the column will be lost.
  - You are about to drop the column `metaFetchedAt` on the `Link` table. All the data in the column will be lost.
  - You are about to drop the column `metaImage` on the `Link` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Link` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Link` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Link" DROP COLUMN "host",
DROP COLUMN "metaDescription",
DROP COLUMN "metaFetchedAt",
DROP COLUMN "metaImage",
DROP COLUMN "notes",
DROP COLUMN "title";

-- CreateTable
CREATE TABLE "Meta" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "description" TEXT,
    "faviconUrl" TEXT,
    "imageUrl" TEXT,
    "siteName" TEXT,
    "source" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3),

    CONSTRAINT "Meta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Meta_linkId_key" ON "Meta"("linkId");

-- AddForeignKey
ALTER TABLE "Meta" ADD CONSTRAINT "Meta_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;
