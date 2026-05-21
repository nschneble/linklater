import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import NavMenuItems from './NavMenuItems';
import type { AppView } from '../../lib/navigation';
import type { Mode } from '../../theme/ThemeContext';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

const defaultProps = {
  mode: 'light' as Mode,
  view: 'links' as AppView,
  onClose: vi.fn(),
  onModeToggle: vi.fn(),
  onViewChange: vi.fn(),
};

function renderNavMenuItems(props: Partial<typeof defaultProps> = {}) {
  return render(<NavMenuItems {...defaultProps} {...props} />);
}

describe('NavMenuItems', () => {
  it('renders all four nav items', () => {
    renderNavMenuItems();
    expect(screen.getByText('Your links')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Theme editor')).toBeInTheDocument();
    expect(screen.getByText(/Switch to (dark|light) mode/)).toBeInTheDocument();
  });

  it('marks Your links as active when view is links', () => {
    renderNavMenuItems({ view: 'links' });
    const button = screen.getByText('Your links').closest('button');
    const icon = button?.querySelector('i');
    expect(icon).toHaveClass('text-[var(--accent)]');
    expect(button).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark Your links as active when view is settings', () => {
    renderNavMenuItems({ view: 'settings' });
    const button = screen.getByText('Your links').closest('button');
    expect(button).not.toHaveAttribute('aria-current');
  });

  it('marks Settings as active when view is settings', () => {
    renderNavMenuItems({ view: 'settings' });
    const button = screen.getByText('Settings').closest('button');
    const icon = button?.querySelector('i');
    expect(icon).toHaveClass('text-[var(--accent)]');
    expect(button).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark Settings as active when view is links', () => {
    renderNavMenuItems({ view: 'links' });
    const button = screen.getByText('Settings').closest('button');
    expect(button).not.toHaveAttribute('aria-current');
  });

  it('marks Theme editor as active when view is theme-editor', () => {
    renderNavMenuItems({ view: 'theme-editor' });
    const button = screen.getByText('Theme editor').closest('button');
    const icon = button?.querySelector('i');
    expect(icon).toHaveClass('text-[var(--accent)]');
    expect(button).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark Theme editor as active when view is links', () => {
    renderNavMenuItems({ view: 'links' });
    const button = screen.getByText('Theme editor').closest('button');
    expect(button).not.toHaveAttribute('aria-current');
  });

  it('shows "Switch to dark mode" label when mode is light', () => {
    renderNavMenuItems({ mode: 'light' });
    expect(screen.getByText('Switch to dark mode')).toBeInTheDocument();
  });

  it('shows "Switch to light mode" label when mode is dark', () => {
    renderNavMenuItems({ mode: 'dark' });
    expect(screen.getByText('Switch to light mode')).toBeInTheDocument();
  });

  it('clicking Your links calls onViewChange with links and then onClose', () => {
    const onViewChange = vi.fn();
    const onClose = vi.fn();
    renderNavMenuItems({ onViewChange, onClose });
    fireEvent.click(screen.getByText('Your links'));
    expect(onViewChange).toHaveBeenCalledWith('links');
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking Settings calls onViewChange with settings and then onClose', () => {
    const onViewChange = vi.fn();
    const onClose = vi.fn();
    renderNavMenuItems({ onViewChange, onClose });
    fireEvent.click(screen.getByText('Settings'));
    expect(onViewChange).toHaveBeenCalledWith('settings');
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking Theme editor calls onViewChange with theme-editor and then onClose', () => {
    const onViewChange = vi.fn();
    const onClose = vi.fn();
    renderNavMenuItems({ onViewChange, onClose });
    fireEvent.click(screen.getByText('Theme editor'));
    expect(onViewChange).toHaveBeenCalledWith('theme-editor');
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the mode toggle calls onModeToggle but not onClose', () => {
    const onModeToggle = vi.fn();
    const onClose = vi.fn();
    renderNavMenuItems({ onModeToggle, onClose });
    fireEvent.click(screen.getByText(/Switch to (dark|light) mode/));
    expect(onModeToggle).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });
});
