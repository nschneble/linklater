import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import {
  THEMES,
  ThemeProvider,
  type BaseTheme,
} from '../../theme/ThemeContext';
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
  onApplyPreview: vi.fn(),
  onSelect: vi.fn(),
};

function renderSubmenu(props: Partial<typeof baseProps> = {}) {
  return render(
    <ThemeProvider>
      <ThemeSubmenu {...baseProps} {...props} />
    </ThemeProvider>,
  );
}

describe('ThemeSubmenu', () => {
  it('renders all theme options as buttons', () => {
    renderSubmenu();
    const buttons = screen.getAllByRole('menuitemradio');
    for (const theme of THEMES) {
      expect(
        buttons.some((button) => button.textContent?.includes(theme.label)),
      ).toBe(true);
    }
  });

  it('shows checkmark on the active base theme', () => {
    renderSubmenu();
    const activeButton = screen
      .getAllByRole('menuitemradio')
      .find((button) => button.textContent?.includes('A Scanner Darkly'));
    expect(activeButton?.querySelector('i.fa-check')).not.toBeNull();
  });

  it('calls onSelect with theme id when a theme button is clicked', () => {
    const onSelect = vi.fn();
    renderSubmenu({ onSelect });
    fireEvent.click(screen.getByText('Boyhood'));
    expect(onSelect).toHaveBeenCalledWith('boyhood');
  });

  it('highlights the trigger row when isPointerOver is true', () => {
    renderSubmenu({ isPointerOver: true });
    const trigger = screen.getByRole('menuitem');
    expect(trigger.className).toContain('bg-[var(--bg-surface)]');
  });

  it('does not highlight the trigger row when isPointerOver is false', () => {
    renderSubmenu({ isPointerOver: false });
    const trigger = screen.getByRole('menuitem');
    expect(trigger.classList.contains('bg-[var(--bg-surface)]')).toBe(false);
  });

  it('shows "Previewing X" label when previewTheme differs from baseTheme', () => {
    const boyhood = THEMES.find((theme) => theme.id === 'boyhood');
    renderSubmenu({ previewTheme: 'boyhood' });
    expect(screen.getByText(`Previewing ${boyhood?.label}`)).toBeDefined();
  });

  it('shows active theme label when previewTheme matches baseTheme', () => {
    const scannerDarkly = THEMES.find((theme) => theme.id === 'scanner-darkly');
    renderSubmenu({ previewTheme: 'scanner-darkly' });
    expect(screen.getAllByText(scannerDarkly!.label).length).toBeGreaterThan(0);
  });

  it('positions flyout on the right when submenuOnLeft is false', () => {
    const { container } = renderSubmenu({ submenuOnLeft: false });
    const flyoutPanel = container.querySelector(
      '.left-\\[calc\\(100\\%-1px\\)\\]',
    );
    expect(flyoutPanel).not.toBeNull();
  });

  it('positions flyout on the left when submenuOnLeft is true', () => {
    const { container } = renderSubmenu({ submenuOnLeft: true });
    const flyoutPanel = container.querySelector(
      '.right-\\[calc\\(100\\%-1px\\)\\]',
    );
    expect(flyoutPanel).not.toBeNull();
  });

  it('calls onApplyPreview when a flyout button receives focus', () => {
    const onApplyPreview = vi.fn();
    renderSubmenu({ onApplyPreview });
    const boyhoodButton = screen
      .getAllByRole('menuitemradio')
      .find((button) => button.textContent?.includes('Boyhood'));
    fireEvent.focus(boyhoodButton!);
    expect(onApplyPreview).toHaveBeenCalledWith('boyhood');
  });

  it('calls onTriggerClick and onKeyboardOpen when ArrowRight is pressed on a closed submenu', () => {
    const onTriggerClick = vi.fn();
    const onKeyboardOpen = vi.fn();
    renderSubmenu({ showSubmenu: false, onTriggerClick, onKeyboardOpen });
    const trigger = screen.getByRole('menuitem');
    fireEvent.keyDown(trigger, { key: 'ArrowRight' });
    expect(onTriggerClick).toHaveBeenCalledTimes(1);
    expect(onKeyboardOpen).toHaveBeenCalledTimes(1);
  });

  it('calls onTriggerClick and onKeyboardOpen when Enter is pressed on a closed submenu', () => {
    const onTriggerClick = vi.fn();
    const onKeyboardOpen = vi.fn();
    renderSubmenu({ showSubmenu: false, onTriggerClick, onKeyboardOpen });
    const trigger = screen.getByRole('menuitem');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onTriggerClick).toHaveBeenCalledTimes(1);
    expect(onKeyboardOpen).toHaveBeenCalledTimes(1);
  });

  it('marks the active theme button as aria-checked', () => {
    renderSubmenu();
    const activeButton = screen
      .getAllByRole('menuitemradio')
      .find((button) => button.textContent?.includes('A Scanner Darkly'));
    expect(activeButton?.getAttribute('aria-checked')).toBe('true');
  });

  it('marks inactive theme buttons as not aria-checked', () => {
    renderSubmenu();
    const inactiveButton = screen
      .getAllByRole('menuitemradio')
      .find((button) => button.textContent?.includes('Boyhood'));
    expect(inactiveButton?.getAttribute('aria-checked')).toBe('false');
  });

  it('calls onTriggerClick and onKeyboardOpen when Space is pressed on a closed submenu', () => {
    const onTriggerClick = vi.fn();
    const onKeyboardOpen = vi.fn();
    renderSubmenu({ showSubmenu: false, onTriggerClick, onKeyboardOpen });
    const trigger = screen.getByRole('menuitem');
    fireEvent.keyDown(trigger, { key: ' ' });
    expect(onTriggerClick).toHaveBeenCalledTimes(1);
    expect(onKeyboardOpen).toHaveBeenCalledTimes(1);
  });

  it('does not call onTriggerClick when ArrowRight is pressed on an already open submenu', () => {
    const onTriggerClick = vi.fn();
    renderSubmenu({ showSubmenu: true, onTriggerClick });
    const trigger = screen.getByRole('menuitem');
    fireEvent.keyDown(trigger, { key: 'ArrowRight' });
    expect(onTriggerClick).not.toHaveBeenCalled();
  });

  it('calls onTriggerBlur when trigger button loses focus to an element outside the flyout', () => {
    const onTriggerBlur = vi.fn();
    renderSubmenu({ showSubmenu: true, onTriggerBlur });
    const trigger = screen.getByRole('menuitem');
    // blur to document.body (outside flyout)
    fireEvent.blur(trigger, { relatedTarget: document.body });
    expect(onTriggerBlur).toHaveBeenCalledTimes(1);
  });

  it('calls onFlyoutBlur with the related target when focus leaves the flyout panel', () => {
    const onFlyoutBlur = vi.fn();
    const { container } = renderSubmenu({ showSubmenu: true, onFlyoutBlur });
    const flyout = container.querySelector('[role="menu"][aria-label="Theme"]');
    fireEvent.blur(flyout!, { relatedTarget: document.body });
    expect(onFlyoutBlur).toHaveBeenCalledWith(document.body);
  });
});
