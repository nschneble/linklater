// Sync test: keep font-awesome-manifest.json in lock-step with the icons the
// app actually paints. Two directions are enforced:
//
//   1. Every `fa-NAME` token in src/ + index.html that resolves to a real FA
//      icon must be listed in the manifest (either solid or brands array).
//      Drift means the subset woff2 would ship without a glyph the UI tries
//      to render -> tofu box.
//
//   2. Every manifest entry must be referenced somewhere in source. Dead
//      entries bloat the subset for no reason.
//
// Unknown `fa-X` tokens (no matching FA icon at all) surface as a separate
// failure so grep artifacts (`fa-triangle-excl`, hyphenated string fragments,
// etc) get flagged for human triage rather than silently dropped.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const srcRoot = resolve(webRoot, 'src');
const indexHtml = resolve(webRoot, 'index.html');
const manifestPath = resolve(here, 'font-awesome-manifest.json');
const fontawesomeCss = resolve(
  webRoot,
  'public/assets/fontawesome/css/fontawesome.min.css',
);
const brandsCss = resolve(
  webRoot,
  'public/assets/fontawesome/css/brands.min.css',
);

// CSS rule shape: `.fa-name1,.fa-name2{...--fa:"\HEX"...}`. Two escape kinds:
// `\HEX` (1-6 hex digits) and `\X` (any other char, literal). We only need
// to enumerate the *names*; the codepoint itself isn't relevant here.
function parseIconNames(cssFile: string): Set<string> {
  const css = readFileSync(cssFile, 'utf8');
  const pattern =
    /(\.fa-[a-z0-9-]+(?:\s*,\s*\.fa-[a-z0-9-]+)*)\s*\{[^}]*--fa:\s*"\\(?:[0-9a-f]{1,6}|[^0-9a-f])"/gi;
  const names = new Set<string>();

  for (const match of css.matchAll(pattern)) {
    for (const selector of match[1].split(',')) {
      names.add(selector.trim().replace(/^\.fa-/, ''));
    }
  }

  return names;
}

// FA exposes utility classes that share the `fa-` prefix but don't map to a
// glyph (animations, family selectors, layout helpers). Listed here so the
// scanner doesn't flag them as missing icons.
const NON_ICON_UTILITY_PREFIXES = new Set([
  'fa-solid',
  'fa-regular',
  'fa-brands',
  'fa-light',
  'fa-thin',
  'fa-duotone',
  'fa-sharp',
  'fa-classic',
  'fa-spin',
  'fa-spin-pulse',
  'fa-spin-reverse',
  'fa-pulse',
  'fa-beat',
  'fa-bounce',
  'fa-fade',
  'fa-flip',
  'fa-flip-horizontal',
  'fa-flip-vertical',
  'fa-flip-both',
  'fa-shake',
  'fa-fw',
  'fa-pull-left',
  'fa-pull-right',
  'fa-stack',
  'fa-stack-1x',
  'fa-stack-2x',
  'fa-inverse',
  'fa-rotate-by',
  'fa-rotate-90',
  'fa-rotate-180',
  'fa-rotate-270',
  'fa-2xs',
  'fa-xs',
  'fa-sm',
  'fa-lg',
  'fa-xl',
  'fa-2xl',
  'fa-1x',
  'fa-2x',
  'fa-3x',
  'fa-4x',
  'fa-5x',
  'fa-6x',
  'fa-7x',
  'fa-8x',
  'fa-9x',
  'fa-10x',
  'fa-ul',
  'fa-li',
  'fa-border',
  'fa-width-auto',
  'fa-width-fixed',
]);

const SCANNABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.html']);

function walk(dir: string, accumulator: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, accumulator);
    } else {
      const dot = entry.lastIndexOf('.');
      if (dot !== -1 && SCANNABLE_EXTENSIONS.has(entry.slice(dot))) {
        accumulator.push(full);
      }
    }
  }
  return accumulator;
}

// `\b` before `fa-` lets `mfa-error` slip through (the boundary sits between
// `m` and `f`-as-word-start), so we additionally require the previous
// character (if any) NOT be `[a-z]`. This keeps `mfa-error` and other
// concatenations out while still matching `fa-` after whitespace, `"`, `'`,
// `` ` ``, `=`, etc. Case-sensitive: FA icon class names are lowercase, so
// matching `fA-F` (hex character classes in regex literals) would just be
// noise.
const FA_TOKEN_PATTERN = /(?:^|[^a-z])(fa-[a-z][a-z0-9-]*)/g;

// Strip `//`-line and `/* ... */`-block comments before scanning, so narrative
// references like `fa-triangle-excl` (column-aligned doc comment for a real
// icon called `fa-triangle-exclamation`) don't pollute the consumer set.
// String literals containing comment markers are safe here because all .ts/
// .tsx files in this repo use the same lexer Vite does, and no real icon
// markup lives in `// fa-foo` shapes.
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\n)\s*\/\/[^\n]*/g, '$1');
}

interface ScanHit {
  token: string;
  files: Set<string>;
}

function scanSources(): Map<string, ScanHit> {
  const files = walk(srcRoot);
  files.push(indexHtml);

  const hits = new Map<string, ScanHit>();

  for (const file of files) {
    const raw = readFileSync(file, 'utf8');
    // index.html doesn't carry JS/TS comments; stripping is a no-op but
    // harmless. Other .html files (none today) would behave the same way.
    const contents = file.endsWith('.html') ? raw : stripComments(raw);
    for (const match of contents.matchAll(FA_TOKEN_PATTERN)) {
      const token = match[1];
      let hit = hits.get(token);
      if (hit === undefined) {
        hit = { token, files: new Set() };
        hits.set(token, hit);
      }
      hit.files.add(file);
    }
  }

  return hits;
}

interface Manifest {
  brands: string[];
  solid: string[];
}

describe('font-awesome-manifest.json sync', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
  const solidCatalog = parseIconNames(fontawesomeCss);
  const brandsCatalog = parseIconNames(brandsCss);
  const allManifestNames = new Set([...manifest.brands, ...manifest.solid]);
  const hits = scanSources();

  it('every manifest entry is a real Font Awesome Free icon', () => {
    const missingSolid = manifest.solid.filter(
      (name) => !solidCatalog.has(name),
    );
    const missingBrands = manifest.brands.filter(
      (name) => !brandsCatalog.has(name),
    );

    expect(
      { missingSolid, missingBrands },
      'Manifest entries must match a real FA Free icon. Drop unknown entries or ' +
        'fix the name (check FA Free icon catalog).',
    ).toEqual({ missingSolid: [], missingBrands: [] });
  });

  it('every fa-* token in src/ + index.html is in the manifest', () => {
    const missing: { token: string; files: string[] }[] = [];

    for (const hit of hits.values()) {
      const name = hit.token.slice('fa-'.length);

      if (NON_ICON_UTILITY_PREFIXES.has(hit.token)) continue;
      if (allManifestNames.has(name)) continue;
      if (!solidCatalog.has(name) && !brandsCatalog.has(name)) continue;

      missing.push({
        token: hit.token,
        files: [...hit.files].map((file) => file.replace(`${webRoot}/`, '')),
      });
    }

    expect(
      missing,
      'Each entry below is a real FA icon used in source but absent from ' +
        'scripts/font-awesome-manifest.json. Add the name (without the `fa-` ' +
        'prefix) to the solid or brands array, then run ' +
        '`npm run subset-fa` to regenerate the woff2 files.',
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
      'Dead manifest entries bloat the subset without rendering anywhere. Drop ' +
        'these names from scripts/font-awesome-manifest.json (or add the missing ' +
        'consumer) and run `npm run subset-fa`.',
    ).toEqual([]);
  });

  it('every fa-* token resolves to a known utility class or real FA icon', () => {
    const unknown: { token: string; files: string[] }[] = [];

    for (const hit of hits.values()) {
      const name = hit.token.slice('fa-'.length);

      if (NON_ICON_UTILITY_PREFIXES.has(hit.token)) continue;
      if (solidCatalog.has(name) || brandsCatalog.has(name)) continue;

      unknown.push({
        token: hit.token,
        files: [...hit.files].map((file) => file.replace(`${webRoot}/`, '')),
      });
    }

    expect(
      unknown,
      'Tokens below match `fa-*` but are neither a known FA utility class nor a ' +
        'real FA Free icon. Likely a grep artifact, truncated string, or typo. ' +
        'Either fix the source or extend NON_ICON_UTILITY_PREFIXES in this test.',
    ).toEqual([]);
  });
});
