/*
 * Why the busy states withhold the dim rather than soften it.
 *
 * `opacity` composites a control's label AND its fill toward whatever sits
 * behind, so the pair the bundle contract pins is not the pair that renders.
 * `bundles.contrast.test.ts` models every token opaque and cannot see this
 * at all.
 *
 * The first measurement is what decided `lib/styles.ts` `ARIA_DISABLED`:
 * across all shipped cascades no alpha under 1 clears 4.5:1 on every
 * control, so "tune the dim" was never an available fix. 1.4.3 exempts
 * every control here, none of which is left operable; the dim a waiting
 * control goes without is a house rule above that floor rather than the
 * criterion.
 *
 * The second is not a house rule. `opacity` composites the element's
 * `outline` along with it, so the dim reaches the focus indicator of a
 * control that stays in the tab order — and five on the login form do,
 * deliberately. 2.4.7 wants that indicator visible and grants no
 * inactive-component exception, so a band the bundle contract pins at 3:1
 * arriving at 2.43:1 is worth a condition on the variant.
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
const AA_NON_TEXT = 3;

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

/** Every opacity rule the utility compiles to, selector and 0-1 alpha. */
async function opacityRules(): Promise<[string, number][]> {
  const css = await compileClasses(ARIA_DISABLED.split(' '));
  const rules = [...css.matchAll(/([^{}]+)\{[^{}]*opacity:\s*(\d+)%/g)];
  if (rules.length === 0) throw new Error('ARIA_DISABLED compiled no opacity');
  return rules.map(([, selector, percent]) => [
    selector.trim(),
    Number(percent) / 100,
  ]);
}

/** The alpha the sheet actually declares for the dim, as a 0-1 fraction. */
async function declaredDimAlpha(): Promise<number> {
  const rules = await opacityRules();
  return Math.min(...rules.map(([, alpha]) => alpha));
}

/**
 * The alpha a control the user has FOCUSED renders at. A rule excluding
 * `:focus-visible` does not reach one, so a sheet where every dim excludes
 * it leaves the control at 1 — which is the whole fix, stated as the number
 * the measurement then runs on.
 */
async function focusedAlpha(): Promise<number> {
  const rules = await opacityRules();
  const reaching = rules.filter(
    ([selector]) => !selector.includes(':not(:focus-visible)'),
  );
  if (reaching.length === 0) return 1;
  return Math.min(...reaching.map(([, alpha]) => alpha));
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

/*
 * The surfaces a dimmed-but-focusable control's outline lands on. The band
 * is offset outside the border box, so what sits behind it is the parent's
 * fill: the auth card for the SSO buttons and the forgot-password link,
 * the tab bar's own track for the two tabs.
 */
const RING_SURFACES = ['mount-bg', 'orbit-bg'] as const;

interface MeasuredRing {
  readonly selector: string;
  readonly surface: string;
  readonly ratio: number;
}

function measureFocusRing(alpha: number): MeasuredRing[] {
  const rows: MeasuredRing[] = [];
  for (const selector of cascadeSelectors()) {
    const declarations = parseDeclarations(extractBlock(BUNDLES_CSS, selector));
    const pageBg = readToken(declarations, 'base-bg', [0, 0, 0]);
    if (pageBg === null) continue;

    const ring = readToken(declarations, 'focus-ring', pageBg);
    if (ring === null) continue;

    for (const surface of RING_SURFACES) {
      const behind = readToken(declarations, surface, pageBg);
      if (behind === null) continue;
      rows.push({
        selector,
        surface,
        ratio: contrastRatio(dim(ring, alpha, behind), behind),
      });
    }
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

describe('the focus indicator on a control that refuses', () => {
  it('clears 3:1 on every surface it can land on', async () => {
    const rows = measureFocusRing(await focusedAlpha());
    expect(rows.length).toBeGreaterThan(20);
    for (const row of rows) {
      expect
        .soft(row.ratio, `${row.selector} focus-ring on ${row.surface}`)
        .toBeGreaterThanOrEqual(AA_NON_TEXT);
    }
  });

  it('would not, were the dim to reach it', async () => {
    const rows = measureFocusRing(await declaredDimAlpha());
    const worst = rows.reduce((low, row) =>
      row.ratio < low.ratio ? row : low,
    );
    expect(
      worst.ratio,
      `${worst.selector} on ${worst.surface} composites to ${describeRatio(worst.ratio)}`,
    ).toBeLessThan(AA_NON_TEXT);
  });
});
