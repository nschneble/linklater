/*
 * Tests for SettingsSectionNav: the mobile-only horizontal chip nav for
 * Settings sections.
 *
 * The active-state expression is the load-bearing piece: `aria-current="page"`
 * lights up the matching button via Tailwind `aria-[current]` variants
 * (bg/text/ring + icon swap). The variant targets are wired onto
 * bundle tokens, so the contract this file proves is:
 *
 *   - the right button gets aria-current="page" when active
 *   - every other button has no aria-current
 *   - the click handler fires with the right hash
 */

import SettingsSectionNav from './SettingsSectionNav';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const SECTIONS = [
  { hash: 'account', label: 'Account', icon: 'fa-user' },
  { hash: 'security', label: 'Security', icon: 'fa-lock' },
  { hash: 'appearance', label: 'Appearance', icon: 'fa-palette' },
];

describe('SettingsSectionNav', () => {
  it("marks the active section with aria-current='page'", () => {
    render(
      <SettingsSectionNav
        sections={SECTIONS}
        activeSection="security"
        onSelectSection={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /security/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('leaves non-active sections without aria-current', () => {
    render(
      <SettingsSectionNav
        sections={SECTIONS}
        activeSection="security"
        onSelectSection={() => {}}
      />,
    );

    expect(
      screen.getByRole('button', { name: /account/i }),
    ).not.toHaveAttribute('aria-current');
    expect(
      screen.getByRole('button', { name: /appearance/i }),
    ).not.toHaveAttribute('aria-current');
  });

  it('calls onSelectSection with the hash when a chip is clicked', () => {
    const handleSelect = vi.fn();
    render(
      <SettingsSectionNav
        sections={SECTIONS}
        activeSection="account"
        onSelectSection={handleSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /appearance/i }));

    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith('appearance');
  });

  it('exposes a compact-nav landmark label that differs from the desktop sidebar', () => {
    render(
      <SettingsSectionNav
        sections={SECTIONS}
        activeSection="account"
        onSelectSection={() => {}}
      />,
    );

    expect(screen.getByRole('navigation')).toHaveAttribute(
      'aria-label',
      'Settings sections (compact)',
    );
  });

  it('moves aria-current when the active section changes', () => {
    const { rerender } = render(
      <SettingsSectionNav
        sections={SECTIONS}
        activeSection="account"
        onSelectSection={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /account/i })).toHaveAttribute(
      'aria-current',
      'page',
    );

    rerender(
      <SettingsSectionNav
        sections={SECTIONS}
        activeSection="appearance"
        onSelectSection={() => {}}
      />,
    );

    expect(
      screen.getByRole('button', { name: /account/i }),
    ).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: /appearance/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
