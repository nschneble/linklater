// Sync test: keep font-awesome-manifest.json in lock-step with the icons the
// app actually paints. Two directions are enforced:
//
//   1. Every `fa-NAME` token in src/ + index.html that resolves to a real FA
//      icon must be listed in the manifest. Drift means the subset woff2
//      would ship without a glyph the UI tries to render -> tofu box.
//
//   2. Every manifest entry must be referenced somewhere in source. Dead
//      entries bloat the subset for no reason.
//
// Unknown `fa-X` tokens (no matching FA icon at all) surface as a separate
// failure so grep artifacts get flagged for human triage rather than silently
// dropped.
//
// The scan logic itself lives in fa-scan.mjs and is shared with the writer
// (sync-fa-manifest.mjs) and the subsetter (subset-fa-fonts.mjs).

import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NON_ICON_UTILITY_PREFIXES,
  loadCatalogs,
  loadManifest,
  paths,
  scanRegularNames,
  scanSources,
} from './fa-scan.mjs';

const manifest = await loadManifest();
const catalogs = await loadCatalogs();
const hits = await scanSources();
const regularNames = await scanRegularNames();
const allManifestNames = new Set([
  ...manifest.brands,
  ...manifest.regular,
  ...manifest.solid,
]);

describe('font-awesome-manifest.json sync', () => {
  it('every manifest entry is a real Font Awesome Free icon', () => {
    const missingSolid = manifest.solid.filter(
      (name) => !catalogs.solid.has(name),
    );
    const missingBrands = manifest.brands.filter(
      (name) => !catalogs.brands.has(name),
    );
    const missingRegular = manifest.regular.filter(
      (name) => !catalogs.solid.has(name),
    );

    expect(
      { missingSolid, missingBrands, missingRegular },
      'Manifest entries must match a real FA Free icon. Drop unknown entries or ' +
        'fix the name (check FA Free icon catalog).',
    ).toEqual({ missingSolid: [], missingBrands: [], missingRegular: [] });
  });

  it('every fa-* token in src/ + index.html is in the manifest', () => {
    const missing: { token: string; files: string[] }[] = [];

    for (const hit of hits.values()) {
      const name = hit.token.slice('fa-'.length);

      if (NON_ICON_UTILITY_PREFIXES.has(hit.token)) continue;
      if (allManifestNames.has(name)) continue;
      if (!catalogs.solid.has(name) && !catalogs.brands.has(name)) continue;

      missing.push({
        token: hit.token,
        files: [...hit.files].map((file) =>
          file.replace(`${paths.webRoot}/`, ''),
        ),
      });
    }

    expect(
      missing,
      'Each entry below is a real FA icon used in source but absent from ' +
        'scripts/font-awesome-manifest.json. Run `npm run sync-fa` (also ' +
        'chained automatically by `npm run subset-fa`) to update the manifest.',
    ).toEqual([]);
  });

  it('every manifest entry is used somewhere in source', () => {
    const seen = new Set<string>();
    for (const hit of hits.values()) {
      seen.add(hit.token.slice('fa-'.length));
    }

    const unused = [...allManifestNames].filter((name) => !seen.has(name));

    expect(
      unused,
      'Dead manifest entries bloat the subset without rendering anywhere. ' +
        'Run `npm run sync-fa` (also chained automatically by ' +
        '`npm run subset-fa`) to drop them.',
    ).toEqual([]);
  });

  it('every fa-* token resolves to a known utility class or real FA icon', () => {
    const unknown: { token: string; files: string[] }[] = [];

    for (const hit of hits.values()) {
      const name = hit.token.slice('fa-'.length);

      if (NON_ICON_UTILITY_PREFIXES.has(hit.token)) continue;
      if (catalogs.solid.has(name) || catalogs.brands.has(name)) continue;

      unknown.push({
        token: hit.token,
        files: [...hit.files].map((file) =>
          file.replace(`${paths.webRoot}/`, ''),
        ),
      });
    }

    expect(
      unknown,
      'Tokens below match `fa-*` but are neither a known FA utility class nor ' +
        'a real FA Free icon. Likely a grep artifact, truncated string, or ' +
        'typo. Either fix the source or extend NON_ICON_UTILITY_PREFIXES in ' +
        'scripts/fa-scan.mjs.',
    ).toEqual([]);
  });

  it('regular manifest entries and `fa-regular` usages stay in sync', () => {
    const missing = [...regularNames].filter(
      (name) => !manifest.regular.includes(name),
    );
    const unused = manifest.regular.filter((name) => !regularNames.has(name));

    expect(
      { missing, unused },
      'Regular icons are detected from `fa-regular fa-NAME` usage in source. ' +
        'Run `npm run sync-fa` (also chained by `npm run subset-fa`) to bring ' +
        'the manifest "regular" array back in sync.',
    ).toEqual({ missing: [], unused: [] });
  });

  // Catch silent-empty regressions (subset-font failure or wrong source path
  // writes a header-only ~700-900 byte file) and manifest-bloat regressions
  // (someone adds half the catalog). Ceilings give 3-4x headroom over current
  // sizes so adding a single icon doesn't trip the test.
  it('subsetted woff2 files are within expected size range', () => {
    const solidPath = resolve(
      paths.webRoot,
      'public/assets/fontawesome/webfonts/fa-solid-900.woff2',
    );
    const regularPath = resolve(
      paths.webRoot,
      'public/assets/fontawesome/webfonts/fa-regular-400.woff2',
    );
    const brandsPath = resolve(
      paths.webRoot,
      'public/assets/fontawesome/webfonts/fa-brands-400.woff2',
    );
    const solidBytes = statSync(solidPath).size;
    const regularBytes = statSync(regularPath).size;
    const brandsBytes = statSync(brandsPath).size;
    const guidance =
      'If this fails after a manifest change, rerun `npm run subset-fa` and ' +
      'recheck the new sizes. If sizes are way off, the subset script may ' +
      'have silently produced a 0-glyph woff2 (header-only ~700-900 bytes).';

    expect(solidBytes, guidance).toBeGreaterThan(2000);
    expect(solidBytes, guidance).toBeLessThan(25000);
    expect(regularBytes, guidance).toBeGreaterThan(800);
    expect(regularBytes, guidance).toBeLessThan(5000);
    expect(brandsBytes, guidance).toBeGreaterThan(800);
    expect(brandsBytes, guidance).toBeLessThan(5000);
  });
});
