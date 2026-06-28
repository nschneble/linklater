/*
 * Tests for the shared user-menu nav items.
 *
 * Focus: the custom-theme entry's label is keyed on whether a custom palette
 * already exists — "Create your theme" as an enticement when none is set up,
 * "Edit your theme" once the user has authored one. Pinning both labels keeps
 * the enticement→edit shift from silently regressing to a single static string.
 */

import NavMenuItems from './NavMenuItems';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let customTheme: {
  dark: Record<string, string>;
  light: Record<string, string>;
} | null = null;

vi.mock('../../theme/ThemeContext', async (importActual) => {
  const actual =
    await importActual<typeof import('../../theme/ThemeContext')>();
  return { ...actual, useTheme: () => ({ customTheme }) };
});

function renderNav() {
  render(
    <NavMenuItems
      mode="dark"
      view="links"
      onClose={vi.fn()}
      onModeToggle={vi.fn()}
      onViewChange={vi.fn()}
    />,
  );
}

beforeEach(() => {
  customTheme = null;
});

describe('NavMenuItems – custom-theme entry label', () => {
  it('reads "Create your theme" when no custom palette is set up', () => {
    customTheme = null;
    renderNav();

    expect(
      screen.getByRole('menuitem', { name: /create your theme/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: /edit your theme/i }),
    ).toBeNull();
  });

  it('reads "Edit your theme" once a custom palette exists', () => {
    customTheme = { dark: { '--base-bg': '#123456' }, light: {} };
    renderNav();

    expect(
      screen.getByRole('menuitem', { name: /edit your theme/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: /create your theme/i }),
    ).toBeNull();
  });
});
