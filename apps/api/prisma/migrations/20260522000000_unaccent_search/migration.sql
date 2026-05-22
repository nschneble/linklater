set lock_timeout = '1s';
set statement_timeout = '5s';

-- Postel's Law: normalize accents so "montréal" matches "montreal" and vice versa.
-- The unaccent extension exposes an unaccent(text) function that strips diacritics
-- using a configurable dictionary. It is applied to both the stored searchVector
-- (below) and to the incoming plainto_tsquery term in LinksService.findAllByText.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Rebuild searchVector for links with metadata, applying unaccent before tsvector
-- conversion so accented characters in title/description/siteName/url all collapse
-- to their ASCII equivalents.
UPDATE "Link" l
SET "searchVector" = to_tsvector('english', unaccent(
  coalesce(m.title, '') || ' ' ||
  coalesce(m.description, '') || ' ' ||
  coalesce(m."siteName", '') || ' ' ||
  l.url))
FROM "Meta" m
WHERE m."linkId" = l.id;

-- Rebuild searchVector for links without metadata (url-only search).
UPDATE "Link" l
SET "searchVector" = to_tsvector('english', unaccent(l.url))
WHERE NOT EXISTS (SELECT 1 FROM "Meta" m WHERE m."linkId" = l.id);
