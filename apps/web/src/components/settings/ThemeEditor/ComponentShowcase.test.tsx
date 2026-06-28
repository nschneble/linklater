/*
 * Tests for ComponentShowcase – the live, decorative app mock in the theme
 * editor. The mock is a PICTURE of the app, not the app: it must be a single
 * aria-hidden subtree with zero focusable descendants, paired with one sr-only
 * summary rendered OUTSIDE that subtree. These tests lock that contract plus
 * full coverage of all 52 bundle-slot pairs so the live contrast preview stays
 * complete: a dropped slot would silently blind the user to that contrast pair.
 * (The focus-ring token is the one editable token the mock can't preview — it
 * has no focusable elements by design — and is verified in the Contrast panel.)
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
  ...BASE_AND_MOUNT_ONLY_SLOTS.flatMap((slot) => [
    `var(--base-${slot})`,
    `var(--mount-${slot})`,
  ]),
];

function getMock() {
  return screen.getByTestId('app-mock');
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

  it('renders one sr-only summary OUTSIDE the hidden subtree', () => {
    render(<ComponentShowcase />);
    const summary = screen.getByText(/live visual preview of the app/i);
    expect(summary).toHaveClass('sr-only');
    expect(getMock().contains(summary)).toBe(false);
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

  it('paints every bundle slot so the contrast preview covers all 52 pairs (focus ring excepted — the mock has no focusable elements)', () => {
    render(<ComponentShowcase />);
    const html = getMock().outerHTML;
    for (const token of EXPECTED_TOKENS) {
      expect(html).toContain(token);
    }
  });
});
