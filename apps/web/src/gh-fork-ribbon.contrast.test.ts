/*
 * Fork-ribbon contrast contract.
 *
 * The landing page's fork ribbon paints a hardcoded pair of hexes, so the
 * bundle contrast suite structurally cannot reach it: that suite reads
 * custom-property declarations out of the theme cascades, and neither
 * ribbon color is a token. The two colors are read here from the
 * stylesheets that ship them, so editing a stylesheet is what moves the
 * number.
 *
 * The label renders at 13px bold. That is not large text under WCAG, so
 * SC 1.4.3 applies at 4.5:1 rather than the 3:1 large-text bar.
 *
 * The flat fill is the least favorable backdrop the label ever gets: the
 * vendor sheet lays a downward black gradient over it, which only darkens
 * it further beneath white.
 *
 * Both colors go through the shared resolver, which refuses a translucent
 * value rather than measuring one nobody can see. A translucent fill
 * would have to be composited over the page gradient behind the ribbon,
 * which is a different measurement than this one.
 *
 * The color helpers come from the bundle suites' shared module. Their
 * block reader does not fit on two counts: it keys on custom properties,
 * and it stops at the first block whose selector list mentions the
 * target. The ribbon's label selector appears first in a shared block
 * that sets geometry and no color, and its fill is decided by a later
 * sheet overriding an earlier one, so the shipped value is the LAST one
 * the cascade assigns, not the first.
 */

import {
  contrastRatio,
  parseColor,
  resolveFg,
} from './theme/styles/bundles-color-utils';
import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const AA_NORMAL = 4.5;

const SOURCE_DIR = dirname(fileURLToPath(import.meta.url));

// the entry sheet imports the vendor one, so its rules land later
const CASCADE = ['gh-fork-ribbon.css', 'index.css'].map((file) =>
  readFileSync(resolve(SOURCE_DIR, file), 'utf8'),
);

const COMMENT = /\/\*[\s\S]*?\*\//g;
const RULE = /([^{}]+)\{([^{}]*)\}/g;

/**
 * Value the shipped cascade leaves `property` at for `selector`.
 *
 * Walks every rule whose selector list names the target exactly and keeps
 * the last assignment, which is what a browser resolves at equal
 * specificity. Comments are stripped first: a colon inside one would
 * otherwise read as a declaration.
 *
 * Throws when nothing matches, so a renamed selector or a deleted
 * declaration fails loudly instead of quietly measuring nothing.
 */
function readShippedValue(selector: string, property: string): string {
  let shipped: string | null = null;

  for (const source of CASCADE) {
    for (const [, selectors, body] of source
      .replace(COMMENT, '')
      .matchAll(RULE)) {
      const applies = selectors
        .split(',')
        .some((candidate) => candidate.trim() === selector);
      if (!applies) {
        continue;
      }

      for (const declaration of body.split(';')) {
        const separator = declaration.indexOf(':');
        if (separator === -1) {
          continue;
        }
        if (declaration.slice(0, separator).trim() !== property) {
          continue;
        }
        shipped = declaration.slice(separator + 1).trim();
      }
    }
  }

  if (shipped === null) {
    throw new Error(
      `No ${property} declared for ${selector} in the shipped cascade`,
    );
  }
  return shipped;
}

describe('fork ribbon contrast', () => {
  it(`label on its fill >= ${AA_NORMAL}:1`, () => {
    const fill = resolveFg(
      parseColor(
        readShippedValue('.github-fork-ribbon:before', 'background-color'),
      ),
    );
    const label = resolveFg(
      parseColor(readShippedValue('.github-fork-ribbon:after', 'color')),
    );
    const ratio = contrastRatio(label, fill);

    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});
