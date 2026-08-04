/*
 * Tests for the shared user-menu nav items: the custom-theme entry
 * reads a static label ("Craft your theme") and routes to the
 * theme-editor view.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import NavMenuItems from './NavMenuItems';

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
