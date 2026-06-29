/*
 * Tests for the shared user-menu nav items.
 *
 * Focus: the custom-theme entry reads a single static label ("Craft your
 * theme") and routes to the theme-editor view. (The label no longer toggles on
 * whether a palette exists — going custom is now an in-editor edit, so the menu
 * entry is a plain, always-present entry point.)
 */

import NavMenuItems from './NavMenuItems';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

function renderNav(onViewChange = vi.fn()) {
  render(
    <NavMenuItems
      mode="dark"
      view="links"
      onClose={vi.fn()}
      onModeToggle={vi.fn()}
      onViewChange={onViewChange}
    />,
  );
}

describe('NavMenuItems – custom-theme entry', () => {
  it('reads the static "Craft your theme" label', () => {
    renderNav();

    expect(
      screen.getByRole('menuitem', { name: /craft your theme/i }),
    ).toBeInTheDocument();
  });

  it('routes to the theme-editor view when clicked', () => {
    const onViewChange = vi.fn();
    renderNav(onViewChange);

    fireEvent.click(
      screen.getByRole('menuitem', { name: /craft your theme/i }),
    );

    expect(onViewChange).toHaveBeenCalledWith('theme-editor');
  });
});
