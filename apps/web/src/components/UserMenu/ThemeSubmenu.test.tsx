import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { THEMES, type BaseTheme } from '../../theme/ThemeContext';
import ThemeSubmenu from './ThemeSubmenu';

afterEach(() => vi.restoreAllMocks());

beforeEach(() => vi.clearAllMocks());

const baseProps = {
  baseTheme: 'scanner-darkly' as BaseTheme,
  previewTheme: null,
  showSubmenu: true,
  submenuOnLeft: false,
  isPointerOver: false,
  onTriggerClick: vi.fn(),
  onKeyboardOpen: vi.fn(),
  onPreviewChange: vi.fn(),
  onSelect: vi.fn(),
};

describe('ThemeSubmenu', () => {
  it('renders all theme options as buttons', () => {
    render(<ThemeSubmenu {...baseProps} />);
    const buttons = screen.getAllByRole('menuitemradio');
    for (const theme of THEMES) {
      expect(
        buttons.some((button) => button.textContent?.includes(theme.label)),
      ).toBe(true);
    }
  });

  it('shows checkmark on the active base theme', () => {
    render(<ThemeSubmenu {...baseProps} />);
    const activeButton = screen
      .getAllByRole('menuitemradio')
      .find((button) => button.textContent?.includes('A Scanner Darkly'));
    expect(activeButton?.querySelector('i.fa-check')).not.toBeNull();
  });

  it('calls onSelect with theme id when a theme button is clicked', () => {
    const onSelect = vi.fn();
    render(<ThemeSubmenu {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Boyhood'));
    expect(onSelect).toHaveBeenCalledWith('boyhood');
  });

  it('highlights the trigger row when isPointerOver is true', () => {
    render(<ThemeSubmenu {...baseProps} isPointerOver={true} />);
    const trigger = screen.getByRole('menuitem');
    expect(trigger.className).toContain('bg-[var(--bg-surface)]');
  });

  it('does not highlight the trigger row when isPointerOver is false', () => {
    render(<ThemeSubmenu {...baseProps} isPointerOver={false} />);
    const trigger = screen.getByRole('menuitem');
    expect(trigger.classList.contains('bg-[var(--bg-surface)]')).toBe(false);
  });

  it('shows "Previewing X" label when previewTheme differs from baseTheme', () => {
    const boyhood = THEMES.find((theme) => theme.id === 'boyhood');
    render(<ThemeSubmenu {...baseProps} previewTheme="boyhood" />);
    expect(screen.getByText(`Previewing ${boyhood?.label}`)).toBeDefined();
  });

  it('shows active theme label when previewTheme matches baseTheme', () => {
    const scannerDarkly = THEMES.find((theme) => theme.id === 'scanner-darkly');
    render(<ThemeSubmenu {...baseProps} previewTheme="scanner-darkly" />);
    expect(screen.getAllByText(scannerDarkly!.label).length).toBeGreaterThan(0);
  });

  it('positions flyout on the right when submenuOnLeft is false', () => {
    const { container } = render(
      <ThemeSubmenu {...baseProps} submenuOnLeft={false} />,
    );
    const flyoutPanel = container.querySelector(
      '.left-\\[calc\\(100\\%-1px\\)\\]',
    );
    expect(flyoutPanel).not.toBeNull();
  });

  it('positions flyout on the left when submenuOnLeft is true', () => {
    const { container } = render(
      <ThemeSubmenu {...baseProps} submenuOnLeft={true} />,
    );
    const flyoutPanel = container.querySelector(
      '.right-\\[calc\\(100\\%-1px\\)\\]',
    );
    expect(flyoutPanel).not.toBeNull();
  });

  it('calls onPreviewChange when a flyout button receives focus', () => {
    const onPreviewChange = vi.fn();
    render(<ThemeSubmenu {...baseProps} onPreviewChange={onPreviewChange} />);
    const boyhoodButton = screen
      .getAllByRole('menuitemradio')
      .find((button) => button.textContent?.includes('Boyhood'));
    fireEvent.focus(boyhoodButton!);
    expect(onPreviewChange).toHaveBeenCalledWith('boyhood');
  });

  it('calls onTriggerClick and onKeyboardOpen when ArrowRight is pressed on a closed submenu', () => {
    const onTriggerClick = vi.fn();
    const onKeyboardOpen = vi.fn();
    render(
      <ThemeSubmenu
        {...baseProps}
        showSubmenu={false}
        onTriggerClick={onTriggerClick}
        onKeyboardOpen={onKeyboardOpen}
      />,
    );
    const trigger = screen.getByRole('menuitem');
    fireEvent.keyDown(trigger, { key: 'ArrowRight' });
    expect(onTriggerClick).toHaveBeenCalledTimes(1);
    expect(onKeyboardOpen).toHaveBeenCalledTimes(1);
  });

  it('calls onTriggerClick and onKeyboardOpen when Enter is pressed on a closed submenu', () => {
    const onTriggerClick = vi.fn();
    const onKeyboardOpen = vi.fn();
    render(
      <ThemeSubmenu
        {...baseProps}
        showSubmenu={false}
        onTriggerClick={onTriggerClick}
        onKeyboardOpen={onKeyboardOpen}
      />,
    );
    const trigger = screen.getByRole('menuitem');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onTriggerClick).toHaveBeenCalledTimes(1);
    expect(onKeyboardOpen).toHaveBeenCalledTimes(1);
  });

  it('marks the active theme button as aria-checked', () => {
    render(<ThemeSubmenu {...baseProps} />);
    const activeButton = screen
      .getAllByRole('menuitemradio')
      .find((button) => button.textContent?.includes('A Scanner Darkly'));
    expect(activeButton?.getAttribute('aria-checked')).toBe('true');
  });

  it('marks inactive theme buttons as not aria-checked', () => {
    render(<ThemeSubmenu {...baseProps} />);
    const inactiveButton = screen
      .getAllByRole('menuitemradio')
      .find((button) => button.textContent?.includes('Boyhood'));
    expect(inactiveButton?.getAttribute('aria-checked')).toBe('false');
  });

  it('calls onTriggerClick and onKeyboardOpen when Space is pressed on a closed submenu', () => {
    const onTriggerClick = vi.fn();
    const onKeyboardOpen = vi.fn();
    render(
      <ThemeSubmenu
        {...baseProps}
        showSubmenu={false}
        onTriggerClick={onTriggerClick}
        onKeyboardOpen={onKeyboardOpen}
      />,
    );
    const trigger = screen.getByRole('menuitem');
    fireEvent.keyDown(trigger, { key: ' ' });
    expect(onTriggerClick).toHaveBeenCalledTimes(1);
    expect(onKeyboardOpen).toHaveBeenCalledTimes(1);
  });

  it('does not call onTriggerClick when ArrowRight is pressed on an already open submenu', () => {
    const onTriggerClick = vi.fn();
    render(
      <ThemeSubmenu
        {...baseProps}
        showSubmenu={true}
        onTriggerClick={onTriggerClick}
      />,
    );
    const trigger = screen.getByRole('menuitem');
    fireEvent.keyDown(trigger, { key: 'ArrowRight' });
    expect(onTriggerClick).not.toHaveBeenCalled();
  });

  it('calls onTriggerBlur when trigger button loses focus to an element outside the flyout', () => {
    const onTriggerBlur = vi.fn();
    render(
      <ThemeSubmenu
        {...baseProps}
        showSubmenu={true}
        onTriggerBlur={onTriggerBlur}
      />,
    );
    const trigger = screen.getByRole('menuitem');
    // blur to document.body (outside flyout)
    fireEvent.blur(trigger, { relatedTarget: document.body });
    expect(onTriggerBlur).toHaveBeenCalledTimes(1);
  });

  it('calls onFlyoutBlur with the related target when focus leaves the flyout panel', () => {
    const onFlyoutBlur = vi.fn();
    const { container } = render(
      <ThemeSubmenu
        {...baseProps}
        showSubmenu={true}
        onFlyoutBlur={onFlyoutBlur}
      />,
    );
    const flyout = container.querySelector('[role="menu"][aria-label="Theme"]');
    fireEvent.blur(flyout!, { relatedTarget: document.body });
    expect(onFlyoutBlur).toHaveBeenCalledWith(document.body);
  });
});
