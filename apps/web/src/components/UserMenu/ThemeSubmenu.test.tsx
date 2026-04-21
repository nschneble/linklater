import { fireEvent, render, screen } from '@testing-library/react';
import { THEMES, type BaseTheme } from '../../theme/ThemeContext';
import ThemeSubmenu from './ThemeSubmenu';

const baseProps = {
  baseTheme: 'scanner-darkly' as BaseTheme,
  previewTheme: null,
  showSubmenu: true,
  submenuOnLeft: false,
  onFlyoutMouseEnter: () => {},
  onFlyoutMouseLeave: () => {},
  onSelect: () => {},
};

describe('ThemeSubmenu', () => {
  it('renders all theme options as buttons', () => {
    render(<ThemeSubmenu {...baseProps} />);
    const buttons = screen.getAllByRole('button');
    for (const theme of THEMES) {
      expect(
        buttons.some((button) => button.textContent?.includes(theme.label)),
      ).toBe(true);
    }
  });

  it('shows checkmark on the active base theme', () => {
    render(<ThemeSubmenu {...baseProps} />);
    const activeButton = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('A Scanner Darkly'));
    expect(activeButton?.querySelector('i.fa-check')).not.toBeNull();
  });

  it('calls onSelect with theme id when a theme is clicked', () => {
    const onSelect = vi.fn();
    render(<ThemeSubmenu {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Boyhood'));
    expect(onSelect).toHaveBeenCalledWith('boyhood');
  });
});
