/**
 * Structural a11y coverage for the landing-page shell. Pins the skip-link
 * token migration (no hardcoded colors/ring) and the Bypass-Blocks pairing:
 * the skip link must point at a `<main>` that is itself focusable so the
 * jump reliably moves keyboard focus into the landmark (WCAG 2.4.1).
 *
 * The three marketing sections are stubbed so the test stays on the shell's
 * skip-link/main contract and away from their router dependencies.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./HeroSection', () => ({
  default: () => <div data-testid="hero-section" />,
}));
vi.mock('./FeaturesSection', () => ({
  default: () => <div data-testid="features-section" />,
}));
vi.mock('./FooterSection', () => ({
  default: () => <div data-testid="footer-section" />,
}));

import LandingPage from './index';

function getSkipLink(): HTMLAnchorElement {
  return screen.getByRole('link', {
    name: 'Skip to main content',
  }) as HTMLAnchorElement;
}

describe('LandingPage skip-link a11y contract', () => {
  it('tokenizes the skip-link colors and focus ring, dropping the hardcoded values', () => {
    render(<LandingPage />);
    const className = getSkipLink().className;

    expect(className).toContain('focus:bg-[var(--base-highlight)]');
    expect(className).toContain('focus:text-[var(--base-highlight-fg)]');
    expect(className).toContain('focus:outline-[var(--focus-ring)]');
    expect(className).toContain('focus:outline-offset-2');

    expect(className).not.toContain('focus:bg-white');
    expect(className).not.toContain('#14103a');
    expect(className).not.toContain('focus:ring-white');
  });

  it('gives <main> a focusable target so the skip link moves focus into it', () => {
    render(<LandingPage />);
    const main = screen.getByRole('main');

    expect(main.getAttribute('id')).toBe('main-content');
    expect(main.getAttribute('tabindex')).toBe('-1');
  });

  it('points the skip link at the <main> landmark', () => {
    render(<LandingPage />);
    const main = screen.getByRole('main');

    expect(getSkipLink().getAttribute('href')).toBe(
      `#${main.getAttribute('id')}`,
    );
  });
});
