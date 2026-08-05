/*
 * Tests for ComponentShowcase – the live, decorative app mock in the theme
 * editor. The mock is a PICTURE of the app, not the app: it must be a single
 * aria-hidden subtree with zero focusable descendants, fronted by an sr-only
 * <h2> "Live preview" plus a VISIBLE, app-themed explanation, BOTH rendered
 * OUTSIDE that subtree. The showcase renders the WHOLE app frame for every
 * bundle and keeps only the ACTIVE bundle in color — the components painted by
 * the other bundles render grayscale (`data-muted`) so the eye lands on the
 * bundle being edited. The custom palette is scoped to the aria-hidden mock
 * ALONE (PRD point 9 inversion), so the explanation + heading render in the
 * always-readable app theme.
 */

import { BUNDLES, type Bundle } from './useThemeOverrides';
import ComponentShowcase, { BUNDLE_EXPLANATIONS } from './ComponentShowcase';
import { describe, expect, it } from 'vitest';
import { MOCK_GLYPHS, MOCK_STATUS_GLYPHS } from './mockGlyphs';
import { render, screen } from '@testing-library/react';
import type { CSSProperties } from 'react';
import type { Mode } from '../../../theme/constants';

function renderShowcase(
  bundle: Bundle = 'base',
  contentThemeStyle: CSSProperties = {},
) {
  return render(
    <ComponentShowcase
      activeBundle={bundle}
      editorMode="dark"
      randomizeNonce={0}
      contentThemeStyle={contentThemeStyle}
    />,
  );
}

function getMock() {
  return screen.getByTestId('app-mock');
}

function getLivePreviewHeading() {
  return screen.getByRole('heading', { level: 2, name: 'Live preview' });
}

describe('ComponentShowcase – named live-preview region', () => {
  it('is a region named by the sr-only "Live preview" h2', () => {
    renderShowcase();
    const region = screen.getByRole('region', { name: 'Live preview' });
    expect(region).toContainElement(getLivePreviewHeading());
    expect(getLivePreviewHeading()).toHaveClass('sr-only');
  });

  it('renders exactly one heading, and it is sr-only', () => {
    const { container } = renderShowcase();
    expect(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(
      1,
    );
  });
});

describe('ComponentShowcase – the explanation is real app UI', () => {
  it('renders a VISIBLE (not sr-only) explanation OUTSIDE the aria-hidden mock', () => {
    renderShowcase('mount');
    const explanation = screen.getByText(/raised components like cards/i);
    // real app UI: NOT visually hidden
    expect(explanation).not.toHaveClass('sr-only');
    // app-themed: outside the styled, aria-hidden mock subtree
    expect(getMock().contains(explanation)).toBe(false);
    // app-theme token pair, never a custom-palette token
    expect(explanation.className).toContain('text-[var(--base-alt-text)]');
  });

  it('carries no role and no aria-live (the tab self-voices)', () => {
    renderShowcase('success');
    const explanation = screen.getByText(/successful toast notifications/i);
    expect(explanation).not.toHaveAttribute('role');
    expect(explanation).not.toHaveAttribute('aria-live');
  });

  it('swaps the explanation per selected bundle', () => {
    const { rerender } = renderShowcase('base');
    expect(screen.getByText(/page defaults/i)).toBeInTheDocument();
    rerender(
      <ComponentShowcase
        activeBundle="orbit"
        editorMode="dark"
        randomizeNonce={0}
        contentThemeStyle={{}}
      />,
    );
    expect(
      screen.getByText(/page header, user menu, and submenus/i),
    ).toBeInTheDocument();
  });

  it('renders the matching explanation for EVERY bundle (incl. alert/warn/info)', () => {
    for (const bundle of BUNDLES) {
      const { unmount } = renderShowcase(bundle);
      const explanation = screen.getByText(BUNDLE_EXPLANATIONS[bundle]);
      // real app UI: visible + outside the aria-hidden mock subtree
      expect(explanation).not.toHaveClass('sr-only');
      expect(getMock().contains(explanation)).toBe(false);
      unmount();
    }
  });
});

describe('ComponentShowcase – whole-frame preview with grayscale muting', () => {
  it('renders the whole app frame (header + toolbar + link card) for every bundle', () => {
    for (const bundle of BUNDLES) {
      const { unmount } = renderShowcase(bundle);
      expect(screen.getByText(MOCK_GLYPHS.wordmark)).toBeInTheDocument();
      expect(screen.getByText(MOCK_GLYPHS.addLink)).toBeInTheDocument();
      expect(screen.getByText(MOCK_GLYPHS.linkTitle)).toBeInTheDocument();
      unmount();
    }
  });

  it('keeps the component the active bundle paints in color', () => {
    // header paints orbit, so only it stays un-muted on the orbit bundle
    renderShowcase('orbit');
    expect(
      screen.getByText(MOCK_GLYPHS.wordmark).closest('[data-muted]'),
    ).toBeNull();
    expect(
      screen.getByText(MOCK_GLYPHS.addLink).closest('[data-muted]'),
    ).not.toBeNull();
    expect(
      screen.getByText(MOCK_GLYPHS.linkTitle).closest('[data-muted]'),
    ).not.toBeNull();
  });

  it('mutes the components the non-active bundles paint', () => {
    // on the base bundle only the toolbar (base) stays in color
    renderShowcase('base');
    expect(
      screen.getByText(MOCK_GLYPHS.addLink).closest('[data-muted]'),
    ).toBeNull();
    expect(
      screen.getByText(MOCK_GLYPHS.wordmark).closest('[data-muted]'),
    ).not.toBeNull();
    expect(
      screen.getByText(MOCK_GLYPHS.linkTitle).closest('[data-muted]'),
    ).not.toBeNull();
  });

  it('keeps the banner + toast in color only for a status bundle', () => {
    // banner + toast paint the status bundle, so muted unless it's active
    const { unmount } = renderShowcase('success');
    expect(
      screen
        .getByText(MOCK_STATUS_GLYPHS.success.banner)
        .closest('[data-muted]'),
    ).toBeNull();
    expect(
      screen
        .getByText(MOCK_STATUS_GLYPHS.success.toast)
        .closest('[data-muted]'),
    ).toBeNull();
    unmount();

    renderShowcase('base');
    expect(
      screen.getByText(MOCK_STATUS_GLYPHS.base.banner).closest('[data-muted]'),
    ).not.toBeNull();
    expect(
      screen.getByText(MOCK_STATUS_GLYPHS.base.toast).closest('[data-muted]'),
    ).not.toBeNull();
  });
});

// `!` un-mute is load-bearing: `data-muted:` compiles after `group-hover:` at equal specificity
describe('ComponentShowcase – preview hover reveals full color', () => {
  it('marks the aria-hidden mock container as the hover group', () => {
    renderShowcase('base');
    expect(getMock()).toHaveClass('group');
  });

  it('gives each muted wrapper an important group-hover un-mute override', () => {
    renderShowcase('base');
    const mutedWrapper = screen
      .getByText(MOCK_GLYPHS.wordmark)
      .closest('[data-muted]');
    expect(mutedWrapper).toHaveClass('group-hover:grayscale-0!');
    expect(mutedWrapper).toHaveClass('group-hover:opacity-100!');
  });
});

describe('ComponentShowcase – toolbar tab pills mirror the real switcher', () => {
  it('paints the Unread/Read pills in mount-tier tokens, not a one-off', () => {
    // mock mirrors the real base→mount switcher tokens, not a bespoke fill
    renderShowcase('base');
    const selected = screen.getByText(MOCK_GLYPHS.unread);
    expect(selected).toHaveClass('bg-[var(--mount-text)]');
    expect(selected).toHaveClass('text-[var(--mount-bg)]');
    expect(screen.getByText(MOCK_GLYPHS.read)).toHaveClass(
      'text-[var(--mount-alt-text)]',
    );
  });
});

describe('ComponentShowcase – preview-scope inversion (PRD point 9)', () => {
  it('applies contentThemeStyle to the aria-hidden mock container ONLY', () => {
    renderShowcase('mount', {
      '--mount-bg': '#102030',
    } as CSSProperties);
    expect(getMock()).toHaveStyle({ '--mount-bg': '#102030' });
  });

  it('does NOT scope the explanation or heading (they render in app theme)', () => {
    const { container } = renderShowcase('mount', {
      '--mount-bg': '#102030',
    } as CSSProperties);
    const region = container.querySelector('section') as HTMLElement;
    // region wrapper is unstyled; only the inner mock carries the palette
    expect(region.getAttribute('style')).toBeNull();
  });
});

describe('ComponentShowcase – decorative mock contract (per bundle)', () => {
  it('wraps each bundle mock in exactly one aria-hidden container with zero focusable descendants', () => {
    for (const bundle of BUNDLES) {
      const { container, unmount } = renderShowcase(bundle);
      const mock = screen.getByTestId('app-mock');
      expect(mock).toHaveAttribute('aria-hidden', 'true');
      const focusable = mock.querySelectorAll(
        'button, a[href], input, select, textarea, summary, details, [tabindex], [contenteditable]',
      );
      expect(focusable).toHaveLength(0);
      expect(container.innerHTML).not.toContain('tabindex');
      unmount();
    }
  });

  it('uses no interactive or live-region roles inside any bundle mock', () => {
    for (const bundle of BUNDLES) {
      const { unmount } = renderShowcase(bundle);
      const banned = screen
        .getByTestId('app-mock')
        .querySelectorAll(
          '[role="button"], [role="link"], [role="tab"], [role="tablist"], ' +
            '[role="menu"], [role="menuitem"], [role="listbox"], [role="option"], ' +
            '[role="dialog"], [role="alert"], [role="status"], [role="log"], ' +
            '[role="heading"], [aria-live], [aria-atomic], [aria-pressed]',
        );
      expect(banned).toHaveLength(0);
      unmount();
    }
  });

  it('uses no real headings or landmark elements inside any bundle mock', () => {
    for (const bundle of BUNDLES) {
      const { unmount } = renderShowcase(bundle);
      const structural = screen
        .getByTestId('app-mock')
        .querySelectorAll(
          'h1, h2, h3, h4, h5, h6, nav, header, main, footer, aside, section',
        );
      expect(structural).toHaveLength(0);
      unmount();
    }
  });

  it('marks every Font Awesome icon aria-hidden in each bundle mock', () => {
    for (const bundle of BUNDLES) {
      const { unmount } = renderShowcase(bundle);
      const icons = screen
        .getByTestId('app-mock')
        .querySelectorAll('i[class*="fa-"]');
      icons.forEach((icon) => {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      });
      unmount();
    }
  });
});

describe('ComponentShowcase – grayscale muting mechanism', () => {
  // `data-muted` + its Tailwind variant drive the mute, so it can't drift
  it('drives every mute off the data-muted attribute + data-muted:grayscale variant', () => {
    for (const bundle of BUNDLES) {
      const { unmount } = renderShowcase(bundle);
      const muted = screen
        .getByTestId('app-mock')
        .querySelectorAll('[data-muted]');
      // at least one piece is always muted (active bundle paints only a subset)
      expect(muted.length).toBeGreaterThan(0);
      muted.forEach((piece) => {
        expect(piece.className).toContain('data-muted:grayscale');
      });
      unmount();
    }
  });

  it('mutes four of five frame pieces for a surface bundle, three for a status bundle', () => {
    // surface bundles paint one piece (4 muted); status paints two (3 muted)
    const { unmount } = renderShowcase('base');
    expect(
      screen.getByTestId('app-mock').querySelectorAll('[data-muted]'),
    ).toHaveLength(4);
    unmount();

    renderShowcase('success');
    expect(
      screen.getByTestId('app-mock').querySelectorAll('[data-muted]'),
    ).toHaveLength(3);
  });
});

describe('ComponentShowcase – re-stagger key (PRD points 10 + 12)', () => {
  function renderWithKey(
    bundle: Bundle,
    editorMode: Mode,
    randomizeNonce: number,
  ) {
    return render(
      <ComponentShowcase
        activeBundle={bundle}
        editorMode={editorMode}
        randomizeNonce={randomizeNonce}
        contentThemeStyle={{}}
      />,
    );
  }

  it('reuses the mock node when the bundle changes (so the grayscale crossfade can play)', () => {
    const { rerender } = renderWithKey('base', 'dark', 0);
    const before = screen.getByTestId('app-mock');
    rerender(
      <ComponentShowcase
        activeBundle="mount"
        editorMode="dark"
        randomizeNonce={0}
        contentThemeStyle={{}}
      />,
    );
    // bundle isn't keyed, so React reuses the node; the mute flip transitions
    expect(screen.getByTestId('app-mock')).toBe(before);
  });

  it('remounts the mock when the editor mode flips', () => {
    const { rerender } = renderWithKey('mount', 'dark', 0);
    const before = screen.getByTestId('app-mock');
    rerender(
      <ComponentShowcase
        activeBundle="mount"
        editorMode="light"
        randomizeNonce={0}
        contentThemeStyle={{}}
      />,
    );
    expect(screen.getByTestId('app-mock')).not.toBe(before);
  });

  it('remounts the mock when the randomize nonce bumps (re-stagger on Randomize)', () => {
    const { rerender } = renderWithKey('mount', 'dark', 0);
    const before = screen.getByTestId('app-mock');
    rerender(
      <ComponentShowcase
        activeBundle="mount"
        editorMode="dark"
        randomizeNonce={1}
        contentThemeStyle={{}}
      />,
    );
    expect(screen.getByTestId('app-mock')).not.toBe(before);
  });

  it('does NOT remount the section or its sr-only heading on a re-stagger', () => {
    const { rerender } = renderWithKey('mount', 'dark', 0);
    const sectionBefore = screen.getByRole('region', { name: 'Live preview' });
    rerender(
      <ComponentShowcase
        activeBundle="mount"
        editorMode="dark"
        randomizeNonce={1}
        contentThemeStyle={{}}
      />,
    );
    // only the inner mock is keyed, so the region + heading never re-announce
    expect(screen.getByRole('region', { name: 'Live preview' })).toBe(
      sectionBefore,
    );
  });
});

describe('ComponentShowcase – asemic Old Turkic copy (decorative)', () => {
  const allGlyphStrings = [
    ...Object.values(MOCK_GLYPHS),
    ...Object.values(MOCK_STATUS_GLYPHS).flatMap((copy) => [
      copy.banner,
      copy.toast,
    ]),
  ];

  it('builds every stand-in from assigned Old Turkic code points (U+10C00–U+10C48) and spaces', () => {
    for (const glyphString of allGlyphStrings) {
      expect(glyphString.length).toBeGreaterThan(0);
      for (const character of glyphString) {
        if (character === ' ') {
          continue;
        }
        const codePoint = character.codePointAt(0) as number;
        expect(codePoint).toBeGreaterThanOrEqual(0x10c00);
        expect(codePoint).toBeLessThanOrEqual(0x10c48);
      }
    }
  });

  it('leaves NO Latin copy inside the aria-hidden mock for any bundle (a11y Seal 6)', () => {
    for (const bundle of BUNDLES) {
      const { unmount } = renderShowcase(bundle);
      // the mock holds only asemic glyphs + icon-only <i>, never Latin copy
      expect(getMock().textContent ?? '').not.toMatch(/[A-Za-z]/);
      unmount();
    }
  });
});

describe('ComponentShowcase – asemic font scope', () => {
  it('marks the mock container with the scoped asemic font', () => {
    renderShowcase('base');
    expect(getMock()).toHaveClass('app-mock-asemic');
  });

  it('keeps the mock free of disabled-state ARIA (cursor read only, not a control)', () => {
    renderShowcase('base');
    expect(getMock()).not.toHaveAttribute('aria-disabled');
    expect(getMock()).not.toHaveAttribute('disabled');
    expect(getMock()).not.toHaveAttribute('role');
  });

  it('does NOT leak the asemic font onto the heading or explanation', () => {
    const { container } = renderShowcase('mount');
    const section = container.querySelector('section') as HTMLElement;
    expect(section).not.toHaveClass('app-mock-asemic');
    expect(getLivePreviewHeading()).not.toHaveClass('app-mock-asemic');
    expect(screen.getByText(/raised components like cards/i)).not.toHaveClass(
      'app-mock-asemic',
    );
    // the marker exists exactly once, on the mock container itself
    expect(container.querySelectorAll('.app-mock-asemic')).toHaveLength(1);
  });
});
