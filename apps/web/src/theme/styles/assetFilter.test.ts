/*
 * The day-for-night asset filter, exercised rather than read.
 *
 * `--asset-filter` had no coverage of any kind: not the value it resolves to
 * per cascade, not the utility that consumes it, and not the one image the
 * repo hard-excludes from it. All three are here.
 *
 * The values are resolved by a real CSS engine from the real compiled
 * stylesheet, so the interesting claim — that a per-theme override beats the
 * dark default on specificity, which is what lets Nouvelle Vague stay
 * grayscale in the dark — is decided by the cascade rather than by a reader
 * of it.
 *
 * The utility is read out of the parsed stylesheet instead of the resolved
 * style, because Tailwind emits it inside `@layer utilities` and jsdom
 * applies no layered rule. So the chain proven here stops one step short:
 * the token resolves, and the utility declares `filter` from that token, but
 * the `var()` substitution joining them is a browser primitive no assertion
 * in this environment can reach. Nor can the `forced-colors` suppression,
 * which jsdom cannot emulate — it stays unproven, deliberately, rather than
 * standing in a scan that would pass whatever the media feature said.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { compileIndexCss } from '../../../test/tailwind';
import { createElement } from 'react';
import TotpSetupView from '../../components/settings/TotpSetupView';

const DAY_FOR_NIGHT = 'hue-rotate(180deg) invert(1)';
const IDENTITY = 'none';
const GRAYSCALE = 'grayscale(100%)';

let stylesheet: HTMLStyleElement;

beforeAll(async () => {
  stylesheet = document.createElement('style');
  stylesheet.textContent = await compileIndexCss([
    'themed-asset',
    'safe-themed-asset',
  ]);
  document.head.appendChild(stylesheet);
});

afterAll(() => {
  stylesheet.remove();
});

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.mode;
  delete document.documentElement.dataset.theme;
});

interface ResolvedFilters {
  readonly assetFilter: string;
  readonly safeAssetFilter: string;
}

function filtersUnder(theme: string | null, mode: string): ResolvedFilters {
  const root = document.documentElement;
  if (theme === null) {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }
  root.dataset.mode = mode;

  const computed = getComputedStyle(root);
  return {
    assetFilter: computed.getPropertyValue('--asset-filter').trim(),
    safeAssetFilter: computed.getPropertyValue('--safe-asset-filter').trim(),
  };
}

/** The rule the `themed-asset` utility compiles to, as the CSSOM parsed it. */
function utilityRule(name: string): CSSStyleRule {
  const sheet = stylesheet.sheet;
  if (sheet === null) throw new Error('compiled stylesheet did not parse');

  for (const rule of sheet.cssRules) {
    if (!(rule instanceof CSSLayerBlockRule)) continue;
    for (const inner of rule.cssRules) {
      if (inner instanceof CSSStyleRule && inner.selectorText === `.${name}`) {
        return inner;
      }
    }
  }
  throw new Error(`no compiled rule for .${name}`);
}

describe('--asset-filter', () => {
  it('leaves images alone in light mode', () => {
    expect(filtersUnder(null, 'light').assetFilter).toBe(IDENTITY);
  });

  it('turns day for night in dark mode', () => {
    expect(filtersUnder(null, 'dark').assetFilter).toBe(DAY_FOR_NIGHT);
  });

  it('reaches a theme that declares no filter of its own', () => {
    expect(filtersUnder('scanner-darkly', 'dark').assetFilter).toBe(
      DAY_FOR_NIGHT,
    );
  });

  /*
   * Nouvelle Vague is black-and-white by design and declares grayscale in
   * both of its blocks. Dark is the case worth pinning: the theme's
   * two-attribute selector has to outrank the single-attribute
   * `[data-mode='dark']` default, or the day-for-night inversion lands on a
   * monochrome theme.
   */
  it('yields to a theme that declares one, in either mode', () => {
    expect(filtersUnder('nouvelle-vague', 'light').assetFilter).toBe(GRAYSCALE);
    expect(filtersUnder('nouvelle-vague', 'dark').assetFilter).toBe(GRAYSCALE);
  });
});

describe('--safe-asset-filter', () => {
  /*
   * The safe variant carries avatars, which are photographs of people. It
   * takes a theme's deliberate grayscale but never the inversion, which is
   * what makes it safe.
   */
  it('never inverts, in any mode', () => {
    expect(filtersUnder(null, 'light').safeAssetFilter).toBe(IDENTITY);
    expect(filtersUnder(null, 'dark').safeAssetFilter).toBe(IDENTITY);
    expect(filtersUnder('scanner-darkly', 'dark').safeAssetFilter).toBe(
      IDENTITY,
    );
  });

  it('still follows a theme that recolors everything', () => {
    expect(filtersUnder('nouvelle-vague', 'dark').safeAssetFilter).toBe(
      GRAYSCALE,
    );
  });
});

describe('the opt-in utilities', () => {
  it('drive filter from the token, so an image inherits its cascade', () => {
    expect(utilityRule('themed-asset').style.filter).toBe(
      'var(--asset-filter)',
    );
    expect(utilityRule('safe-themed-asset').style.filter).toBe(
      'var(--safe-asset-filter)',
    );
  });
});

describe('the hard exclusions', () => {
  /*
   * The TOTP QR is the only image in the repo under a documented exclusion
   * (secrets render as text here, and there is no captcha). Inverting it
   * flips finder-pattern polarity, which is what a camera reads, so a filter
   * that merely looks wrong elsewhere makes this one unscannable.
   */
  it('leave the TOTP QR opted out', () => {
    const { container } = render(
      createElement(TotpSetupView, {
        qrCodeDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
        secret: 'JBSWY3DPEHPK3PXP',
        code: '',
        codeInputReference: { current: null },
        loading: false,
        error: null,
        onCancel: () => {},
        onCodeChange: () => {},
        onSubmit: () => {},
      }),
    );

    const qrCode = container.querySelector('img');
    expect(qrCode).not.toBeNull();
    // a class-list check, not a substring: safe-themed-asset contains the name
    expect(qrCode?.classList.contains('themed-asset')).toBe(false);
  });
});
