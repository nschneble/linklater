// the cors package exact-matches a plain string, so a multi-origin value
// has to become an array before it can match per entry. an unset value
// stays open because the bookmarklet posts from any site
export function parseCorsOrigin(raw: string | undefined): string | string[] {
  if (!raw) return '*';

  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) return '*';
  if (origins.length === 1) return origins[0];
  return origins;
}
