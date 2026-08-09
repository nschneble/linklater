// shared Font Awesome scanning + parsing utilities. Two consumers:
//   - sync-fa-manifest.mjs: rewrites font-awesome-manifest.json from source scan
//   - subset-fa-fonts.mjs: needs codepoints, used by font subsetter
//   - font-awesome-manifest.test.ts: assertion-mode sync check (kept as a
//     belt-and-suspenders CI gate against the writer ever regressing)
//
// keeping these in one module makes "what counts as an icon token" a single
// definition. Drift here used to mean a manifest entry that the test accepted
// but the subsetter rejected (or vice versa).

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile, stat } from 'node:fs/promises';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');

export const paths = {
  webRoot,
  srcRoot: resolve(webRoot, 'src'),
  indexHtml: resolve(webRoot, 'index.html'),
  manifestPath: resolve(here, 'font-awesome-manifest.json'),
  brandsCssPath: resolve(
    webRoot,
    'public/assets/fontawesome/css/brands.min.css',
  ),
  regularCssPath: resolve(
    webRoot,
    'public/assets/fontawesome/css/fontawesome.min.css',
  ),
  solidCssPath: resolve(
    webRoot,
    'public/assets/fontawesome/css/fontawesome.min.css',
  ),
};

// FA exposes utility classes that share the `fa-` prefix but don't map to a
// glyph (animations, family selectors, layout helpers).
export const NON_ICON_UTILITY_PREFIXES = new Set([
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

// `\b` before `fa-` lets `mfa-error` slip through (the boundary sits between
// `m` and `f`-as-word-start), so we additionally require the previous
// character (if any) NOT be `[a-z]`. This keeps `mfa-error` and other
// concatenations out while still matching `fa-` after whitespace, `"`, `'`,
// `` ` ``, `=`, etc. Case-sensitive: FA icon class names are lowercase.
const FA_TOKEN_PATTERN = /(?:^|[^a-z])(fa-[a-z][a-z0-9-]*)/g;

const FA_REGULAR_CLUSTER_PATTERN = /\bfa-regular((?:\s+fa-[a-z][a-z0-9-]*)+)/g;

// CSS rule shape: `.fa-name1,.fa-name2{...--fa:"\HEX"...}`. Two escape kinds:
// `\HEX` (1-6 hex digits) and `\X` (any other char, literal).
const CSS_RULE_PATTERN =
  /(\.fa-[a-z0-9-]+(?:\s*,\s*\.fa-[a-z0-9-]+)*)\s*\{[^}]*--fa:\s*"\\(?:([0-9a-f]{1,6})|([^0-9a-f]))"/gi;

export async function parseCodepoints(cssFile) {
  const css = await readFile(cssFile, 'utf8');
  const codepoints = new Map();

  for (const match of css.matchAll(CSS_RULE_PATTERN)) {
    const selectorList = match[1];
    const hex = match[2];
    const literal = match[3];
    const codepoint = hex ? parseInt(hex, 16) : literal.codePointAt(0);

    for (const selector of selectorList.split(',')) {
      const name = selector.trim().replace(/^\.fa-/, '');
      codepoints.set(name, codepoint);
    }
  }

  return codepoints;
}

export async function parseIconNames(cssFile) {
  const codepoints = await parseCodepoints(cssFile);
  return new Set(codepoints.keys());
}

export async function loadCatalogs() {
  const [solid, brands] = await Promise.all([
    parseIconNames(paths.solidCssPath),
    parseIconNames(paths.brandsCssPath),
  ]);
  return { solid, brands };
}

// strip comments before scanning so doc-comment references like
// `fa-triangle-excl` don't pollute the consumer set
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\n)\s*\/\/[^\n]*/g, '$1');
}

async function walk(dir, accumulator = []) {
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry);
    const stats = await stat(full);
    if (stats.isDirectory()) {
      await walk(full, accumulator);
    } else {
      const dot = entry.lastIndexOf('.');
      if (dot !== -1 && SCANNABLE_EXTENSIONS.has(entry.slice(dot))) {
        accumulator.push(full);
      }
    }
  }
  return accumulator;
}

export async function scanSources() {
  const files = await walk(paths.srcRoot);
  files.push(paths.indexHtml);

  const hits = new Map();

  for (const file of files) {
    const fileSource = await readFile(file, 'utf8');
    const contents = file.endsWith('.html')
      ? fileSource
      : stripComments(fileSource);

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

export async function scanRegularNames() {
  const files = await walk(paths.srcRoot);
  files.push(paths.indexHtml);

  const names = new Set();

  for (const file of files) {
    const fileSource = await readFile(file, 'utf8');
    const contents = file.endsWith('.html')
      ? fileSource
      : stripComments(fileSource);

    for (const match of contents.matchAll(FA_REGULAR_CLUSTER_PATTERN)) {
      const trailingTokens = match[1].trim().split(/\s+/);
      const iconToken = trailingTokens.find(
        (token) => !NON_ICON_UTILITY_PREFIXES.has(token),
      );
      if (iconToken !== undefined) {
        names.add(iconToken.slice('fa-'.length));
      }
    }
  }

  return names;
}

export async function loadManifest() {
  const raw = await readFile(paths.manifestPath, 'utf8');
  return JSON.parse(raw);
}
