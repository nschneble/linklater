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

import ComponentShowcase from './ComponentShowcase';
import { BUNDLES, type Bundle } from './useThemeOverrides';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CSSProperties } from 'react';

function renderShowcase(
  bundle: Bundle = 'base',
  previewStyle: CSSProperties | null = null,
  contentThemeStyle: CSSProperties = {},
) {
  return render(
    <ComponentShowcase
      activeBundle={bundle}
      previewStyle={previewStyle}
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
        previewStyle={null}
        contentThemeStyle={{}}
      />,
    );
    expect(
      screen.getByText(/used for the top bar and your account menu/i),
    ).toBeInTheDocument();
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
    renderShowcase('mount', null, {
      '--mount-bg': '#102030',
    } as CSSProperties);
    expect(getMock()).toHaveStyle({ '--mount-bg': '#102030' });
  });

  it('prefers previewStyle (copy-menu hover) over contentThemeStyle', () => {
    renderShowcase(
      'mount',
      { '--mount-bg': '#aabbcc' } as CSSProperties,
      { '--mount-bg': '#102030' } as CSSProperties,
    );
    expect(getMock()).toHaveStyle({ '--mount-bg': '#aabbcc' });
  });

  it('does NOT scope the explanation or heading (they render in app theme)', () => {
    const { container } = renderShowcase('mount', null, {
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
