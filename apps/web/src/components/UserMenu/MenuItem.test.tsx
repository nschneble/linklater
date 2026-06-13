import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import MenuItem from './MenuItem';

/**
 * Pin the hover + focus-visible bg-overlay and inset-ring class-string
 * contract so a future refactor cannot silently drop one variant. The
 * orbit-text alpha overlay + orbit-border inset-ring pair carries the
 * WCAG SC 1.4.11 (3:1) ring-vs-effective-bg requirement for menu rows;
 * the orbit-border palette in before-midnight dark / before-sunset dark /
 * dazed-and-confused light was tuned in Wave 6a specifically against this
 * composited paint. Dropping either the hover or focus-visible side would
 * silently bypass the contract on keyboard or pointer activation.
 */
describe('MenuItem', () => {
  it('applies hover and focus-visible bg overlay + inset-ring for menu-row state', () => {
    render(<MenuItem icon="fa-bookmark" label="Test" onClick={() => {}} />);
    const button = screen.getByRole('menuitem');
    const className = button.className;
    expect(className).toMatch(/hover:bg-\[color-mix/);
    expect(className).toMatch(/focus-visible:bg-\[color-mix/);
    expect(className).toMatch(/hover:inset-ring-1/);
    expect(className).toMatch(/focus-visible:inset-ring-1/);
    expect(className).toMatch(/hover:inset-ring-\[var\(--orbit-border\)\]/);
    expect(className).toMatch(
      /focus-visible:inset-ring-\[var\(--orbit-border\)\]/,
    );
  });
});
