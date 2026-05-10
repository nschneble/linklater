ALTER TABLE "Link" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

CREATE INDEX IF NOT EXISTS "Link_searchVector_idx"
  ON "Link" USING GIN ("searchVector");

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
