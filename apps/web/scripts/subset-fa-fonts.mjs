// Subset the vendored Font Awesome webfonts to only the glyphs this app
// actually uses. Inputs are the unsubsetted woff2 files preserved under
// scripts/font-awesome-source/webfonts/. Outputs overwrite the woff2 files
// served by Vite under public/assets/fontawesome/webfonts/.
//
// To add a new icon: list it in scripts/font-awesome-manifest.json (in the
// solid or brands array, no `fa-` prefix), then rerun `npm run subset-fa`.
//
// Codepoints are sourced from the vendored FA CSS so the script never drifts
// from the font binaries it subsets. The CSS rules look like:
//
//   .fa-check{--fa:"\f00c"}
//   .fa-rotate-back,.fa-rotate-backward,.fa-rotate-left,.fa-undo-alt{--fa:"\f2ea"}
//   .fa-plus{--fa:"\+"}
//
// Two CSS escape shapes appear: `\HEX` (1-6 hex digits) maps to that unicode
// codepoint; `\X` for any other character X maps to that literal ASCII char.
// Multiple selectors per rule are common (aliases); we register every alias
// against the same codepoint so the manifest can use canonical OR alias names.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');

const manifestPath = resolve(here, 'font-awesome-manifest.json');
const sourceDir = resolve(here, 'font-awesome-source/webfonts');
const outputDir = resolve(webRoot, 'public/assets/fontawesome/webfonts');
const cssDir = resolve(webRoot, 'public/assets/fontawesome/css');

const families = {
  brands: {
    cssFile: resolve(cssDir, 'brands.min.css'),
    source: resolve(sourceDir, 'fa-brands-400.woff2'),
    output: resolve(outputDir, 'fa-brands-400.woff2'),
  },
  solid: {
    // fontawesome.min.css holds the canonical solid icon -> codepoint map.
    // solid.min.css only registers the family + @font-face.
    cssFile: resolve(cssDir, 'fontawesome.min.css'),
    source: resolve(sourceDir, 'fa-solid-900.woff2'),
    output: resolve(outputDir, 'fa-solid-900.woff2'),
  },
};

/**
 * Parse all `.fa-NAME[, .fa-OTHER]*{--fa:"\HEX"}` rules out of an FA CSS file
 * and return a flat `Map<iconName, codepoint>`. Aliases share a codepoint.
 */
async function parseCodepoints(cssFile) {
  const css = await readFile(cssFile, 'utf8');
  // Captures: (1) selector list, (2) hex escape OR (3) literal-char escape.
  const rulePattern =
    /(\.fa-[a-z0-9-]+(?:\s*,\s*\.fa-[a-z0-9-]+)*)\s*\{[^}]*--fa:\s*"\\(?:([0-9a-f]{1,6})|([^0-9a-f]))"/gi;
  const codepoints = new Map();

  for (const match of css.matchAll(rulePattern)) {
    const selectorList = match[1];
    const hex = match[2];
    const literal = match[3];
    let codepoint;
    if (hex) {
      codepoint = parseInt(hex, 16);
    } else {
      codepoint = literal.codePointAt(0);
    }

    for (const selector of selectorList.split(',')) {
      const name = selector.trim().replace(/^\.fa-/, '');
      codepoints.set(name, codepoint);
    }
  }

  return codepoints;
}

async function subsetFamily(family, names) {
  const config = families[family];
  const codepoints = await parseCodepoints(config.cssFile);

  const unknown = names.filter((name) => !codepoints.has(name));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown ${family} icon name(s) in manifest: ${unknown.join(', ')}. ` +
        `Each manifest entry must match a real Font Awesome Free icon.`,
    );
  }

  // subset-font keeps any glyph whose codepoint appears in the `text` arg.
  // String.fromCodePoint handles surrogate pairs for codepoints > 0xFFFF.
  const wanted = [...new Set(names.map((name) => codepoints.get(name)))];
  wanted.sort((left, right) => left - right);
  const text = String.fromCodePoint(...wanted);

  const sourceBuffer = await readFile(config.source);
  // Byte-stable output across runs (verified empirically) depends on the
  // lockfile-pinned `subset-font` version. The package doesn't contract for
  // byte stability across minor versions, so a future bump could re-shuffle
  // harfbuzz tables and produce CI diff noise without any manifest change.
  // If that happens, this is the call to inspect.
  const subsetBuffer = await subsetFont(sourceBuffer, text, {
    targetFormat: 'woff2',
  });

  await writeFile(config.output, subsetBuffer);

  return {
    family,
    glyphCount: wanted.length,
    sourceBytes: sourceBuffer.length,
    outputBytes: subsetBuffer.length,
  };
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  const results = [];
  for (const family of Object.keys(families)) {
    const names = manifest[family];
    if (!Array.isArray(names) || names.length === 0) {
      throw new Error(
        `Manifest is missing the "${family}" array or it is empty. ` +
          `Even one icon is required to produce a non-empty subset.`,
      );
    }
    results.push(await subsetFamily(family, names));
  }

  for (const result of results) {
    const percent = ((result.outputBytes / result.sourceBytes) * 100).toFixed(
      1,
    );
    console.log(
      `${result.family.padEnd(7)} ${String(result.glyphCount).padStart(3)} glyphs  ` +
        `${result.sourceBytes} -> ${result.outputBytes} bytes (${percent}% of source)`,
    );
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
