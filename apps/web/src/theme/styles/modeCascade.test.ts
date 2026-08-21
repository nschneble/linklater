/*
 * Proves a dark token set is APPLIED, not merely written down.
 *
 * Every other suite in this directory reads the stylesheets as text. That
 * establishes what the palettes say; none of it establishes that the
 * attribute the app writes selects them. The two failures look identical
 * from a text scan: a mode that never reaches `<html>` and a cascade whose
 * selector no longer matches both leave every hex exactly where it was.
 *
 * So this one runs the real stylesheet through a real CSS engine. It
 * compiles `index.css` with Tailwind, installs the output in the document,
 * mounts the real `ThemeProvider`, and reads resolved custom properties off
 * `document.documentElement`. Nothing here asserts on CSS source text.
 *
 * The chain under test, end to end:
 *
 *   OS appearance -> useThemeState -> data-mode on <html> -> cascade
 *   -> the values getComputedStyle resolves
 *
 * Two limits of this environment, stated rather than papered over. jsdom does
 * not substitute `var()` into a standard property, so the claim stops at the
 * resolved custom property and does not follow it into a `background-color`.
 * And it ignores rules nested in `@layer`, which is where Tailwind emits its
 * utilities — the theme cascades are unlayered, which is the only reason this
 * works at all.
 *
 * What it deliberately does not pin: the hexes themselves. Expectations are
 * read from the same blocks whose selection is under test, so a palette edit
 * moves both sides together. That is `bundles.contrast.test.ts`'s contract,
 * and a second copy here would only be a second thing to drift.
 */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  BUNDLES_CSS,
  extractBlock,
  parseDeclarations,
} from './bundles-color-utils';
import { compileIndexCss } from '../../../test/tailwind';
import {
  restoreSystemColorScheme,
  stubSystemColorScheme,
} from '../../../test/systemColorScheme';
import { useThemeState } from '../ThemeContext/useThemeState';

// getInitialBaseTheme's fallback, and so what an empty store boots into
const BOOT_THEME = 'scanner-darkly';

const darkPalette = parseDeclarations(
  extractBlock(BUNDLES_CSS, `[data-theme='${BOOT_THEME}'][data-mode='dark']`),
);
const lightPalette = parseDeclarations(
  extractBlock(BUNDLES_CSS, `[data-theme='${BOOT_THEME}'][data-mode='light']`),
);

let stylesheet: HTMLStyleElement;

beforeAll(async () => {
  stylesheet = document.createElement('style');
  stylesheet.textContent = await compileIndexCss([]);
  document.head.appendChild(stylesheet);
});

afterAll(() => {
  stylesheet.remove();
});

afterEach(() => {
  cleanup();
  restoreSystemColorScheme();
  delete document.documentElement.dataset.mode;
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

/** Resolves every token a palette block declares, as the page sees them. */
function paintedValues(palette: Map<string, string>): Map<string, string> {
  const computed = getComputedStyle(document.documentElement);
  const painted = new Map<string, string>();
  for (const token of palette.keys()) {
    painted.set(token, computed.getPropertyValue(`--${token}`).trim());
  }
  return painted;
}

/*
 * Mounts the hook that writes the attributes, which is what `ThemeProvider`
 * is a wrapper around. Not the provider itself: mounted bare it reads no
 * auth, so its branding gate paints the mode-INDEPENDENT logged-out chrome
 * and there is no mode left to observe.
 */
function mountAppAt(systemMode: 'light' | 'dark') {
  const system = stubSystemColorScheme(systemMode);
  renderHook(() => useThemeState());
  return system;
}

describe('the mode the app paints', () => {
  it('resolves the dark palette when the device is dark', () => {
    mountAppAt('dark');

    expect(document.documentElement.dataset.theme).toBe(BOOT_THEME);
    expect(document.documentElement.dataset.mode).toBe('dark');
    expect(paintedValues(darkPalette)).toEqual(darkPalette);
  });

  it('resolves the light palette when the device is light', () => {
    mountAppAt('light');

    expect(document.documentElement.dataset.mode).toBe('light');
    expect(paintedValues(lightPalette)).toEqual(lightPalette);
  });

  /*
   * The pair above would both pass against a stylesheet with one palette in
   * it. This is the assertion that needs two: the tokens the theme gives
   * different values per mode, read twice across a single OS change, have to
   * come back different. Tokens the theme holds constant across modes (this
   * theme keeps --focus-ring) are excluded, since standing still is what
   * they are for.
   */
  it('repaints what the mode changes when the device changes appearance', () => {
    const modeSensitive = [...darkPalette].filter(
      ([token, darkValue]) => lightPalette.get(token) !== darkValue,
    );
    expect(modeSensitive.length).toBeGreaterThan(0);

    const system = mountAppAt('dark');
    const beforeFlip = paintedValues(darkPalette);

    act(() => system.flip('light'));

    const afterFlip = paintedValues(darkPalette);
    expect(document.documentElement.dataset.mode).toBe('light');
    for (const [token] of modeSensitive) {
      expect(afterFlip.get(token), `--${token} did not repaint`).not.toBe(
        beforeFlip.get(token),
      );
    }
  });
});

describe('the synthetic fallback', () => {
  /*
   * The pre-theme paint window: `index.html` has no boot script, so `<body>`
   * is styled from `:root` until React's layout effect writes the
   * attributes. `[data-mode='dark']` is what covers that window in the dark,
   * and it is a single-attribute selector with no theme qualifier, so
   * nothing else in these tests exercises it.
   */
  const fallbackDark = parseDeclarations(
    extractBlock(BUNDLES_CSS, "[data-mode='dark']"),
  );

  it('answers the mode attribute before any theme is set', () => {
    document.documentElement.dataset.mode = 'dark';

    expect(paintedValues(fallbackDark)).toEqual(fallbackDark);
  });

  /*
   * An unseen case, and the one that separates "the selector matches the
   * value" from "the selector matches the attribute". A mode nothing writes
   * has to fall through to `:root`, or the dark block is really a
   * `[data-mode]` block wearing a value.
   */
  it('falls back to :root for a mode it does not recognise', () => {
    const root = parseDeclarations(extractBlock(BUNDLES_CSS, ':root'));
    const overridden = [...fallbackDark].filter(
      ([token, darkValue]) => root.get(token) !== darkValue,
    );
    expect(overridden.length).toBeGreaterThan(0);

    document.documentElement.dataset.mode = 'sepia';
    const painted = paintedValues(fallbackDark);

    for (const [token] of overridden) {
      expect(painted.get(token), `--${token} kept its dark value`).toBe(
        root.get(token),
      );
    }
  });
});
