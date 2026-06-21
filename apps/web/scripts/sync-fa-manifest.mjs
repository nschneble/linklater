// Rewrites font-awesome-manifest.json from a source scan. Three rules:
//
//   1. Every fa-* token that resolves to a real FA icon gets listed.
//   2. Every existing manifest entry not seen in source gets dropped.
//   3. Unknown fa-* tokens (no matching icon in either catalog) abort the
//      sync. These are almost always typos or grep artifacts – silently
//      dropping them would mask real bugs.
//
// Family routing for icons that appear in only one catalog is unambiguous.
// `fa-apple` appears in both solid (the fruit) and brands (the company), so
// the script preserves the family the manifest currently assigns. New
// ambiguous icons abort with a message asking the human to seed the family.
//
// Idempotent: if the produced manifest matches the on-disk one byte-for-byte,
// the file is left untouched and the exit message says "no changes". Lets
// `subset-fa` chain it without dirtying the working tree on every build.

import { readFile, writeFile } from 'node:fs/promises';
import prettier from 'prettier';
import {
  NON_ICON_UTILITY_PREFIXES,
  loadCatalogs,
  loadManifest,
  paths,
  scanSources,
} from './fa-scan.mjs';

/**
 * Build the next manifest from the scan + catalogs + current manifest.
 * Pure function: no IO, fully unit-testable. The caller is responsible for
 * loading inputs and writing outputs.
 *
 * Returns `{ manifest, summary }` on success.
 * Throws on unknown tokens or new ambiguous tokens.
 */
export function computeNextManifest({ hits, catalogs, currentManifest }) {
  const currentFamily = new Map();
  for (const name of currentManifest.solid) currentFamily.set(name, 'solid');
  for (const name of currentManifest.brands) currentFamily.set(name, 'brands');

  const unknown = [];
  const ambiguous = [];
  const next = { brands: new Set(), solid: new Set() };

  for (const hit of hits.values()) {
    if (NON_ICON_UTILITY_PREFIXES.has(hit.token)) continue;

    const name = hit.token.slice('fa-'.length);
    const inSolid = catalogs.solid.has(name);
    const inBrands = catalogs.brands.has(name);

    if (!inSolid && !inBrands) {
      unknown.push({ token: hit.token, files: [...hit.files] });
      continue;
    }

    const existing = currentFamily.get(name);
    let family;
    if (existing) {
      family = existing;
    } else if (inSolid && !inBrands) {
      family = 'solid';
    } else if (inBrands && !inSolid) {
      family = 'brands';
    } else {
      ambiguous.push({ name, files: [...hit.files] });
      continue;
    }

    next[family].add(name);
  }

  if (unknown.length > 0) {
    throw new SyncError('unknown', unknown);
  }
  if (ambiguous.length > 0) {
    throw new SyncError('ambiguous', ambiguous);
  }

  const manifest = {
    brands: [...next.brands].sort(),
    solid: [...next.solid].sort(),
  };

  const removed = {
    brands: currentManifest.brands.filter((name) => !next.brands.has(name)),
    solid: currentManifest.solid.filter((name) => !next.solid.has(name)),
  };
  const added = {
    brands: manifest.brands.filter(
      (name) => !currentManifest.brands.includes(name),
    ),
    solid: manifest.solid.filter(
      (name) => !currentManifest.solid.includes(name),
    ),
  };

  return { manifest, summary: { added, removed } };
}

export class SyncError extends Error {
  constructor(kind, details) {
    super(formatSyncErrorMessage(kind, details));
    this.kind = kind;
    this.details = details;
  }
}

function formatSyncErrorMessage(kind, details) {
  if (kind === 'unknown') {
    const lines = details.map(
      ({ token, files }) =>
        `  ${token}  (${files.length} file${files.length === 1 ? '' : 's'})`,
    );
    return (
      'Unknown fa-* token(s) in source – no matching icon in either catalog. ' +
      'Likely typo, grep artifact, or truncated string. Fix the source, then ' +
      'rerun sync.\n' +
      lines.join('\n')
    );
  }
  if (kind === 'ambiguous') {
    const lines = details.map(({ name }) => `  ${name}`);
    return (
      'New fa-* token(s) exist in both the solid and brands catalogs. The ' +
      'manifest does not yet list them, so the sync script cannot pick a ' +
      'family on your behalf. Seed each name into the desired array of ' +
      'font-awesome-manifest.json by hand, then rerun sync.\n' +
      lines.join('\n')
    );
  }
  return `Unknown sync error: ${kind}`;
}

export function serializeManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

async function formatJson(manifest) {
  return prettier.format(serializeManifest(manifest), {
    filepath: paths.manifestPath,
  });
}

async function main() {
  const [hits, catalogs, currentManifest] = await Promise.all([
    scanSources(),
    loadCatalogs(),
    loadManifest(),
  ]);

  const { manifest, summary } = computeNextManifest({
    hits,
    catalogs,
    currentManifest,
  });

  // Route through prettier so the on-disk file matches the formatter's output
  // even when prettier chooses single-line for short arrays. Without this, the
  // first format pass after a sync would re-diff the file.
  const [serialized, currentBytes] = await Promise.all([
    formatJson(manifest),
    readFile(paths.manifestPath, 'utf8'),
  ]);

  if (serialized === currentBytes) {
    console.log('font-awesome-manifest.json: no changes');
    return;
  }

  await writeFile(paths.manifestPath, serialized);

  const lines = ['font-awesome-manifest.json: updated'];
  for (const family of ['solid', 'brands']) {
    for (const name of summary.added[family]) {
      lines.push(`  + ${family}/${name}`);
    }
    for (const name of summary.removed[family]) {
      lines.push(`  - ${family}/${name}`);
    }
  }
  console.log(lines.join('\n'));
}

// Run as CLI when executed directly, skip when imported by tests.
const invokedAsScript =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('sync-fa-manifest.mjs');

if (invokedAsScript) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
