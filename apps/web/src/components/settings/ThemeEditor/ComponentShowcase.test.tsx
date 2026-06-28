/*
 * Tests for ComponentShowcase – the live, decorative app mock in the theme
 * editor. The mock is a PICTURE of the app, not the app: it must be a single
 * aria-hidden subtree with zero focusable descendants, fronted by an sr-only
 * <h2> "Live preview" plus an sr-only orientation summary, BOTH rendered
 * OUTSIDE that subtree. These tests lock that contract plus coverage of all 51
 * bundle-slot pairs so the live contrast preview stays complete: a dropped slot
 * would silently blind the user to that contrast pair.
 *
 * Two editable tokens are excepted from the in-mock coverage because the real
 * app gives them no home the mock can faithfully reproduce: `--focus-ring`
 * (the mock has zero focusable elements by design) and `--mount-input-bg` (the
 * real links view has no mount-surface input field). Both are still checked by
 * the live contrast math, which evaluates every editable token regardless.
 */

import ComponentShowcase from './ComponentShowcase';
import {
  BASE_AND_MOUNT_ONLY_SLOTS,
  BASE_ONLY_SLOTS,
  BUNDLES,
  SLOTS,
} from '../../../theme/customThemeTokens';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const EXPECTED_TOKENS = [
  ...BUNDLES.flatMap((bundle) =>
    SLOTS.map((slot) => `var(--${bundle}-${slot})`),
  ),
  ...BASE_ONLY_SLOTS.map((slot) => `var(--base-${slot})`),
  // `input-bg` exists on base + mount, but only `--base-input-bg` is painted
  // (the toolbar search field). `--mount-input-bg` is intentionally EXCEPTED:
  // the real links view has no mount-surface input, so the only place it could
  // live in the mock was a fabricated "Add a note" field. The live contrast
  // math checks it instead.
  ...BASE_AND_MOUNT_ONLY_SLOTS.map((slot) => `var(--base-${slot})`),
];

function getMock() {
  return screen.getByTestId('app-mock');
}

function getLivePreviewHeading() {
  return screen.getByRole('heading', { level: 2, name: 'Live preview' });
}

describe('ComponentShowcase app mock', () => {
  it('wraps the whole mock in exactly one aria-hidden container', () => {
    const { container } = render(<ComponentShowcase />);
    const hidden = container.querySelectorAll('[aria-hidden="true"]');
    const mockRoots = Array.from(hidden).filter(
      (element) => element.getAttribute('data-testid') === 'app-mock',
    );
    expect(mockRoots).toHaveLength(1);
    expect(getMock()).toHaveAttribute('aria-hidden', 'true');
  });

  it('fronts the mock with an sr-only "Live preview" h2 as the first child, OUTSIDE the hidden subtree', () => {
    const { container } = render(<ComponentShowcase />);
    const heading = getLivePreviewHeading();
    expect(heading).toHaveClass('sr-only');
    // The heading must be AT-perceivable: outside the aria-hidden mock subtree.
    expect(getMock().contains(heading)).toBe(false);
    // It is the FIRST child of the returned fragment.
    expect(container.firstElementChild).toBe(heading);
    // It is the ONLY heading the component renders.
    expect(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(
      1,
    );
  });

  it('renders the sr-only orientation summary right after the heading, OUTSIDE the hidden subtree', () => {
    render(<ComponentShowcase />);
    const summary = screen.getByText(/a visual preview of the app/i);
    expect(summary).toHaveClass('sr-only');
    expect(getMock().contains(summary)).toBe(false);
    expect(getLivePreviewHeading().nextElementSibling).toBe(summary);
  });

  it('has zero focusable descendants (Tab skips the entire mock)', () => {
    render(<ComponentShowcase />);
    const focusable = getMock().querySelectorAll(
      'button, a[href], input, select, textarea, summary, details, [tabindex], [contenteditable]',
    );
    expect(focusable).toHaveLength(0);
  });

  it('contains no tabindex anywhere in the mock', () => {
    const { container } = render(<ComponentShowcase />);
    expect(container.innerHTML).not.toContain('tabindex');
  });

  it('uses no interactive or live-region roles inside the mock', () => {
    render(<ComponentShowcase />);
    const banned = getMock().querySelectorAll(
      '[role="button"], [role="link"], [role="tab"], [role="tablist"], ' +
        '[role="menu"], [role="menuitem"], [role="listbox"], [role="option"], ' +
        '[role="dialog"], [role="alert"], [role="status"], [role="log"], ' +
        '[role="heading"], [aria-live], [aria-atomic], [aria-pressed]',
    );
    expect(banned).toHaveLength(0);
  });

  it('uses no real headings or landmark elements inside the mock', () => {
    render(<ComponentShowcase />);
    const structural = getMock().querySelectorAll(
      'h1, h2, h3, h4, h5, h6, nav, header, main, footer, aside, section',
    );
    expect(structural).toHaveLength(0);
  });

  it('marks every Font Awesome icon aria-hidden', () => {
    render(<ComponentShowcase />);
    const icons = getMock().querySelectorAll('i[class*="fa-"]');
    expect(icons.length).toBeGreaterThan(0);
    icons.forEach((icon) => {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('previews active and inactive tab styles as two static pills', () => {
    render(<ComponentShowcase />);
    expect(screen.getByText('Unread')).toBeInTheDocument();
    expect(screen.getByText('Read')).toBeInTheDocument();
  });

  it('paints every bundle slot so the contrast preview covers all 51 pairs (focus ring + mount input-bg excepted)', () => {
    render(<ComponentShowcase />);
    const html = getMock().outerHTML;
    for (const token of EXPECTED_TOKENS) {
      expect(html).toContain(token);
    }
  });
});
