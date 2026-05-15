-- AlterTable
ALTER TABLE "Link" ADD COLUMN     "searchVector" TSVECTOR;

-- CreateIndex
CREATE INDEX "Link_searchVector_idx" ON "Link" USING GIN ("searchVector");

UPDATE "Link" l
SET "searchVector" = to_tsvector('english',
  coalesce(m.title, '') || ' ' ||
  coalesce(m.description, '') || ' ' ||
  coalesce(m."siteName", '') || ' ' ||
  l.url)
FROM "Meta" m
WHERE m."linkId" = l.id;

UPDATE "Link" l
SET "searchVector" = to_tsvector('english', l.url)
WHERE l."searchVector" IS NULL;
