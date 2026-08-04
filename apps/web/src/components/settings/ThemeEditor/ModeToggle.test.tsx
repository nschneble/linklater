/*
 * Tests for ModeToggle, the editor's Light/Dark palette selector. It IS the
 * shared SlidingTabBar (same component as the Unread/Read switcher), so it is a
 * role="tablist" of aria-selected tabs with roving tabindex and arrow-key
 * navigation via useTabNavigation. We assert the tablist semantics, the panel
 * wiring, commit-on-click, and that the keyboard contract matches the links tabs
 * (arrows + Home/End move and select, selection follows focus).
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ModeToggle from './ModeToggle';

const LABELS = { light: 'Light', dark: 'Dark' } as const;

function renderToggle(props: Partial<Parameters<typeof ModeToggle>[0]> = {}) {
  return render(
    <ModeToggle
      mode="dark"
      onModeChange={vi.fn()}
      ariaLabel="Palette to edit"
      labels={LABELS}
      panelId="theme-editor-panel"
      {...props}
    />,
  );
}

function getTablist() {
  return screen.getByRole('tablist', { name: /palette to edit/i });
}

describe('ModeToggle', () => {
  it('renders dark + light as tabs reflecting the mode', () => {
    renderToggle({ mode: 'dark' });
    const tablist = getTablist();
    expect(within(tablist).getByRole('tab', { name: /dark/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      within(tablist).getByRole('tab', { name: /light/i }),
    ).toHaveAttribute('aria-selected', 'false');
  });

  it('uses the visible label as the accessible name (SC 2.5.3, no aria-label)', () => {
    renderToggle({ mode: 'dark' });
    expect(screen.getByRole('tab', { name: 'Light' })).toBeInTheDocument();
  });

  it('points each tab at the editing panel it controls', () => {
    renderToggle({ mode: 'dark', panelId: 'theme-editor-panel' });
    expect(screen.getByRole('tab', { name: /dark/i })).toHaveAttribute(
      'aria-controls',
      'theme-editor-panel',
    );
    expect(screen.getByRole('tab', { name: /light/i })).toHaveAttribute(
      'aria-controls',
      'theme-editor-panel',
    );
  });

  it('makes only the selected tab a tab stop (roving tabindex)', () => {
    renderToggle({ mode: 'dark' });
    expect(screen.getByRole('tab', { name: /dark/i })).toHaveAttribute(
      'tabindex',
      '0',
    );
    expect(screen.getByRole('tab', { name: /light/i })).toHaveAttribute(
      'tabindex',
      '-1',
    );
  });

  it('commits the chosen mode on click', () => {
    const onModeChange = vi.fn();
    renderToggle({ mode: 'dark', onModeChange });
    fireEvent.click(screen.getByRole('tab', { name: /light/i }));
    expect(onModeChange).toHaveBeenCalledWith('light');
  });

  it('ArrowRight moves + selects the other mode (selection follows focus), like the links tabs', () => {
    const onModeChange = vi.fn();
    renderToggle({ mode: 'dark', onModeChange });
    const [lightTab, darkTab] = screen.getAllByRole('tab');
    // focus the active tab like Tab-in does, then drive with the keyboard
    darkTab.focus();
    fireEvent.keyDown(darkTab, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(lightTab);
    expect(onModeChange).toHaveBeenLastCalledWith('light');
  });

  it('ArrowLeft wraps the other way to the same neighbor (two-option list)', () => {
    const onModeChange = vi.fn();
    renderToggle({ mode: 'dark', onModeChange });
    const [lightTab, darkTab] = screen.getAllByRole('tab');
    darkTab.focus();
    fireEvent.keyDown(darkTab, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(lightTab);
    expect(onModeChange).toHaveBeenLastCalledWith('light');
  });

  it('jumps to the ends with Home/End', () => {
    const onModeChange = vi.fn();
    renderToggle({ mode: 'dark', onModeChange });
    const darkTab = screen.getByRole('tab', { name: /dark/i });
    darkTab.focus();
    fireEvent.keyDown(darkTab, { key: 'Home' });
    expect(onModeChange).toHaveBeenLastCalledWith('light');
    fireEvent.keyDown(darkTab, { key: 'End' });
    expect(onModeChange).toHaveBeenLastCalledWith('dark');
  });
});
