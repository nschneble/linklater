/*
 * Why the busy states withhold the dim rather than soften it.
 *
 * `opacity` composites a control's label AND its fill toward whatever sits
 * behind, so the pair the bundle contract pins is not the pair that renders.
 * `bundles.contrast.test.ts` models every token opaque and cannot see this
 * at all.
 *
 * The measurement below is what decided `lib/styles.ts` `ARIA_DISABLED`:
 * across all shipped cascades no alpha under 1 clears 4.5:1 on every
 * control, so "tune the dim" was never an available fix. A control whose
 * label a user is still waiting on therefore carries no dim, and the ones
 * that keep it are inactive components, which 1.4.3 exempts.
 *
 * Reading the alpha out of the compiled sheet rather than restating it is
 * what makes the second assertion bite: raise the dim toward full opacity
 * and this fails, which is the point at which the withholding needs
 * deciding again rather than inheriting.
 */

import { ARIA_DISABLED } from '../../lib/styles';
import {
  BUNDLES_CSS,
  compositeOverBg,
  contrastRatio,
  describeRatio,
  extractBlock,
  parseColor,
  parseDeclarations,
} from './bundles-color-utils';
import { compileClasses } from '../../../test/tailwind';
import { describe, expect, it } from 'vitest';
import type { Rgb } from './bundles-color-utils';

const AA_NORMAL = 4.5;

/*
 * The primary button on a mount surface: the auth submit, the suggestion
 * callout's add button, the extension authorize button. It is the tightest
 * of the affected pairs and the one the crew measured at 2.64:1.
 */
const LABEL = 'mount-highlight-fg';
const FILL = 'mount-highlight';
const BEHIND = 'mount-bg';

/** Every cascade block that defines its own page background. */
function cascadeSelectors(): string[] {
  const found = new Set<string>();
  for (const [, selector] of BUNDLES_CSS.matchAll(
    /^(:root|\[data-[^{]*?)\s*\{/gm,
  )) {
    found.add(selector.trim());
  }
  return [...found];
}

function readToken(
  declarations: Map<string, string>,
  key: string,
  pageBg: Rgb,
): Rgb | null {
  const value = declarations.get(key);
  if (value === undefined || value.includes('var(')) return null;
  return compositeOverBg(parseColor(value), pageBg);
}

/** The alpha the sheet actually declares for the dim, as a 0-1 fraction. */
async function declaredDimAlpha(): Promise<number> {
  const css = await compileClasses(ARIA_DISABLED.split(' '));
  const match = css.match(/opacity:\s*(\d+)%/);
  if (match === null) throw new Error('ARIA_DISABLED compiled no opacity');
  return Number(match[1]) / 100;
}

function dim(color: Rgb, alpha: number, behind: Rgb): Rgb {
  return [0, 1, 2].map(
    (channel) => color[channel] * alpha + behind[channel] * (1 - alpha),
  ) as unknown as Rgb;
}

interface Measured {
  readonly selector: string;
  readonly atFullOpacity: number;
  readonly atDimAlpha: number;
}

function measure(alpha: number): Measured[] {
  const rows: Measured[] = [];
  for (const selector of cascadeSelectors()) {
    const declarations = parseDeclarations(extractBlock(BUNDLES_CSS, selector));
    const pageBgValue = declarations.get('base-bg');
    if (pageBgValue === undefined) continue;
    const pageBg = readToken(declarations, 'base-bg', [0, 0, 0]);
    if (pageBg === null) continue;

    const label = readToken(declarations, LABEL, pageBg);
    const fill = readToken(declarations, FILL, pageBg);
    const behind = readToken(declarations, BEHIND, pageBg);
    if (label === null || fill === null || behind === null) continue;

    rows.push({
      selector,
      atFullOpacity: contrastRatio(label, fill),
      atDimAlpha: contrastRatio(
        dim(label, alpha, behind),
        dim(fill, alpha, behind),
      ),
    });
  }
  return rows;
}

describe('the dim a busy control withholds', () => {
  it('leaves the primary button clearing 4.5:1 in every cascade', async () => {
    const rows = measure(await declaredDimAlpha());
    expect(rows.length).toBeGreaterThan(20);
    for (const row of rows) {
      expect
        .soft(row.atFullOpacity, `${row.selector} at full opacity`)
        .toBeGreaterThanOrEqual(AA_NORMAL);
    }
  });

  it('would not, at the alpha the compiled sheet declares', async () => {
    const alpha = await declaredDimAlpha();
    const rows = measure(alpha);
    const worst = rows.reduce((low, row) =>
      row.atDimAlpha < low.atDimAlpha ? row : low,
    );
    expect(
      worst.atDimAlpha,
      `${worst.selector} composites to ${describeRatio(worst.atDimAlpha)} at ${alpha}`,
    ).toBeLessThan(AA_NORMAL);
  });
});
