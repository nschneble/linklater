// subset the vendored Font Awesome webfonts to only the glyphs this app
// actually uses. Inputs are the unsubsetted woff2 files preserved under
// scripts/font-awesome-source/webfonts/. Outputs overwrite the woff2 files
// served by Vite under public/assets/fontawesome/webfonts/.
//
// the manifest itself is rewritten from the source scan by sync-fa-manifest.mjs,
// which is chained ahead of this script via `npm run subset-fa`. To add a new
// icon, just use its class in source - the next subset-fa picks it up.
//
// CSS rule shape lives in fa-scan.mjs (parseCodepoints). Two escape kinds:
// `\HEX` (1-6 hex digits) maps to that unicode codepoint; `\X` for any other
// character X maps to that literal ASCII char. Multiple selectors per rule
// are common (aliases); aliases share a codepoint so the manifest can use
// canonical OR alias names.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCodepoints, paths } from './fa-scan.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import subsetFont from 'subset-font';

const here = dirname(fileURLToPath(import.meta.url));
const sourceDir = resolve(here, 'font-awesome-source/webfonts');
const outputDir = resolve(paths.webRoot, 'public/assets/fontawesome/webfonts');

const families = {
  brands: {
    cssFile: paths.brandsCssPath,
    source: resolve(sourceDir, 'fa-brands-400.woff2'),
    output: resolve(outputDir, 'fa-brands-400.woff2'),
  },
  regular: {
    cssFile: paths.regularCssPath,
    source: resolve(sourceDir, 'fa-regular-400.woff2'),
    output: resolve(outputDir, 'fa-regular-400.woff2'),
  },
  solid: {
    cssFile: paths.solidCssPath,
    source: resolve(sourceDir, 'fa-solid-900.woff2'),
    output: resolve(outputDir, 'fa-solid-900.woff2'),
  },
};

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

  // subset-font keeps the glyphs whose codepoints appear in this text
  const wanted = [...new Set(names.map((name) => codepoints.get(name)))];
  wanted.sort((left, right) => left - right);
  const text = String.fromCodePoint(...wanted);

  const sourceBuffer = await readFile(config.source);
  // byte stability depends on the pinned subset-font version; bump churns CI
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
  const manifest = JSON.parse(await readFile(paths.manifestPath, 'utf8'));

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
