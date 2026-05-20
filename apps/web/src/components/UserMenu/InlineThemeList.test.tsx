import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import InlineThemeList from './InlineThemeList';
import { THEMES } from '../../theme/ThemeContext';

beforeEach(() => vi.clearAllMocks());

describe('InlineThemeList', () => {
  it('renders one button per theme', () => {
    render(<InlineThemeList baseTheme="scanner-darkly" onSelect={vi.fn()} />);
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(THEMES.length);
  });

  it('calls onSelect with the correct theme id when a theme button is clicked', () => {
    const onSelect = vi.fn();
    render(<InlineThemeList baseTheme="scanner-darkly" onSelect={onSelect} />);
    const secondTheme = THEMES[1];
    fireEvent.click(screen.getByText(secondTheme.label));
    expect(onSelect).toHaveBeenCalledWith(secondTheme.id);
  });

  it('shows a checkmark for the active theme', () => {
    render(<InlineThemeList baseTheme={THEMES[0].id} onSelect={vi.fn()} />);
    const activeButton = screen.getByText(THEMES[0].label).closest('button');
    expect(activeButton?.querySelector('.fa-check')).toBeTruthy();
  });

  it('does not show a checkmark for inactive themes', () => {
    render(<InlineThemeList baseTheme={THEMES[0].id} onSelect={vi.fn()} />);
    const inactiveThemes = THEMES.slice(1);
    for (const theme of inactiveThemes) {
      const button = screen.getByText(theme.label).closest('button');
      expect(button?.querySelector('.fa-check')).toBeNull();
    }
  });

  it('active theme button has aria-checked true', () => {
    render(<InlineThemeList baseTheme={THEMES[0].id} onSelect={vi.fn()} />);
    const activeButton = screen.getByText(THEMES[0].label).closest('button');
    expect(activeButton).toHaveAttribute('aria-checked', 'true');
  });

  it('inactive theme buttons have aria-checked false', () => {
    render(<InlineThemeList baseTheme={THEMES[0].id} onSelect={vi.fn()} />);
    for (const theme of THEMES.slice(1)) {
      const button = screen.getByText(theme.label).closest('button');
      expect(button).toHaveAttribute('aria-checked', 'false');
    }
  });
});
