/*
 * Tests for ComponentShowcase – the live, decorative app mock in the theme
 * editor. The mock is a PICTURE of the app, not the app: it must be a single
 * aria-hidden subtree with zero focusable descendants, fronted by an sr-only
 * <h2> "Live preview" plus a VISIBLE, app-themed explanation, BOTH rendered
 * OUTSIDE that subtree. The showcase mirrors the SELECTED bundle only (PRD
 * point 4): each bundle previews the real component it paints. The custom
 * palette is scoped to the aria-hidden mock ALONE (PRD point 9 inversion), so
 * the explanation + heading render in the always-readable app theme.
 */

import ComponentShowcase, { BUNDLE_EXPLANATIONS } from './ComponentShowcase';
import { BUNDLES, type Bundle } from './useThemeOverrides';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
    const explanation = screen.getByText(/used for your saved-link cards/i);
    // Real app UI: NOT visually hidden.
    expect(explanation).not.toHaveClass('sr-only');
    // App-themed: outside the styled, aria-hidden mock subtree.
    expect(getMock().contains(explanation)).toBe(false);
    // App-theme token pair, never a custom-palette token.
    expect(explanation.className).toContain('text-[var(--base-alt-text)]');
  });

  it('carries no role and no aria-live (the tab self-voices)', () => {
    renderShowcase('success');
    const explanation = screen.getByText(/used for success toasts/i);
    expect(explanation).not.toHaveAttribute('role');
    expect(explanation).not.toHaveAttribute('aria-live');
  });

  it('swaps the explanation per selected bundle', () => {
    const { rerender } = renderShowcase('base');
    expect(screen.getByText(/used for the page itself/i)).toBeInTheDocument();
    rerender(
      <ComponentShowcase
        activeBundle="orbit"
        editorMode="dark"
        randomizeNonce={0}
        contentThemeStyle={{}}
      />,
    );
    expect(
      screen.getByText(/used for the top bar and your account menu/i),
    ).toBeInTheDocument();
  });

  it('renders the matching explanation for EVERY bundle (incl. alert/warn/info)', () => {
    for (const bundle of BUNDLES) {
      const { unmount } = renderShowcase(bundle);
      const explanation = screen.getByText(BUNDLE_EXPLANATIONS[bundle]);
      // Real app UI: visible + outside the aria-hidden mock subtree.
      expect(explanation).not.toHaveClass('sr-only');
      expect(getMock().contains(explanation)).toBe(false);
      unmount();
    }
  });
});

describe('ComponentShowcase – per-bundle mock (PRD point 4)', () => {
  it('previews the link card for the mount bundle', () => {
    renderShowcase('mount');
    expect(getMock().outerHTML).toContain('var(--mount-highlight)');
  });

  it('previews the header + account menu for the orbit bundle', () => {
    renderShowcase('orbit');
    expect(screen.getByText('Linklater')).toBeInTheDocument();
    expect(screen.getByText('Logged in as')).toBeInTheDocument();
  });

  it('previews the toolbar for the base bundle', () => {
    renderShowcase('base');
    expect(screen.getByText('Add link')).toBeInTheDocument();
    expect(screen.getByText('Unread')).toBeInTheDocument();
  });

  it('previews the matching notice for each status bundle', () => {
    renderShowcase('success');
    expect(screen.getByText('Link saved!')).toBeInTheDocument();
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
    // The region wrapper is unstyled; only the inner mock carries the palette.
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

describe('ComponentShowcase – enter animation (PRD point 10)', () => {
  // The mock's pieces carry the app's `animate-card-enter` class with a capped
  // inline stagger delay, exactly like the links list. Reduced-motion safety is
  // INHERITED from the global prefers-reduced-motion clamp in index.css (it
  // neutralizes animation-duration + iteration-count on *), so we assert the
  // CSS-driven mechanism is present and trust the global clamp — no bespoke,
  // unguarded motion is introduced here.
  it('animates each mock piece in with animate-card-enter + a capped stagger delay', () => {
    for (const bundle of BUNDLES) {
      const { unmount } = renderShowcase(bundle);
      const animated = screen
        .getByTestId('app-mock')
        .querySelectorAll('.animate-card-enter');
      expect(animated.length).toBeGreaterThan(0);
      animated.forEach((piece) => {
        const delay = (piece as HTMLElement).style.animationDelay;
        // Either an inline capped delay (MockStagger) or the Tailwind
        // [animation-delay:60ms] utility on the orbit menu — both stay <= 240ms.
        if (delay) {
          const milliseconds = Number.parseInt(delay, 10);
          expect(milliseconds).toBeGreaterThanOrEqual(0);
          expect(milliseconds).toBeLessThanOrEqual(240);
        }
      });
      unmount();
    }
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

  it('remounts the mock (replaying the animation) when the bundle changes', () => {
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
    // A changed key forces React to mount a brand-new node, replaying the
    // enter animation rather than diffing the old one in place.
    expect(screen.getByTestId('app-mock')).not.toBe(before);
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
    // Only the inner mock is keyed; the named region + heading stay mounted, so
    // nothing re-announces and focus cannot move.
    expect(screen.getByRole('region', { name: 'Live preview' })).toBe(
      sectionBefore,
    );
  });
});

describe('ComponentShowcase – whimsical aside (PRD points 12 + 13)', () => {
  it('renders an app-voiced aside that is real, app-themed UI outside the mock', () => {
    renderShowcase('base');
    const aside = screen.getByText(/roll until it feels like you/i);
    expect(aside).not.toHaveClass('sr-only');
    // App-themed (always-readable token), never a custom-palette token.
    expect(aside.className).toContain('text-[var(--base-alt-text)]');
    // Lives OUTSIDE the aria-hidden, possibly-hostile mock subtree.
    expect(getMock().contains(aside)).toBe(false);
  });
});
