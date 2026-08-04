/*
 * Tests for InlineThemeList, the mobile flat theme picker. After the row
 * content was extracted into the shared ThemeRowContent primitive, this locks
 * the host-owned SELECTION semantics that must NOT have moved into the
 * primitive: each row is a menuitemradio, the active theme is aria-checked, the
 * accessible-theme affordance still renders, and clicking selects.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import InlineThemeList from './InlineThemeList';

vi.mock('../../theme/ThemeContext', async (importActual) => {
  const actual =
    await importActual<typeof import('../../theme/ThemeContext')>();
  return {
    ...actual,
    useTheme: () => ({ customTheme: null, customThemeEnabled: false }),
  };
});

describe('InlineThemeList', () => {
  it('renders each theme as a menuitemradio, checking the active one', () => {
    render(<InlineThemeList baseTheme="apollo-10-1-2" onSelect={vi.fn()} />);
    const active = screen.getByRole('menuitemradio', { name: /apollo/i });
    expect(active).toHaveAttribute('aria-checked', 'true');
    const inactive = screen.getByRole('menuitemradio', { name: /boyhood/i });
    expect(inactive).toHaveAttribute('aria-checked', 'false');
  });

  it('keeps the accessible-theme affordance on accessible rows', () => {
    render(<InlineThemeList baseTheme="apollo-10-1-2" onSelect={vi.fn()} />);
    // Apollo is the accessible theme; its sr-only label is on the row
    expect(
      screen.getByRole('menuitemradio', { name: /accessible theme/i }),
    ).toHaveAccessibleName(/apollo/i);
  });

  it('selects a theme on click', () => {
    const onSelect = vi.fn();
    render(<InlineThemeList baseTheme="boyhood" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('menuitemradio', { name: /apollo/i }));
    expect(onSelect).toHaveBeenCalledWith('apollo-10-1-2');
  });
});
