ALTER TABLE "Link" DROP COLUMN "host",
                   DROP COLUMN "metaDescription",
                   DROP COLUMN "metaFetchedAt",
                   DROP COLUMN "metaImage",
                   DROP COLUMN "notes",
                   DROP COLUMN "title";

CREATE TABLE "Meta" (
    "id"           TEXT NOT NULL,
    "linkId"       TEXT NOT NULL,
    "description"  TEXT,
    "faviconUrl"   TEXT,
    "imageUrl"     TEXT,
    "siteName"     TEXT,
    "source"       TEXT,
    "title"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    "fetchedAt"    TIMESTAMP(3),

    CONSTRAINT "Meta_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Meta_linkId_key" ON "Meta"("linkId");

ALTER TABLE "Meta" ADD CONSTRAINT "Meta_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;
