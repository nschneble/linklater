/*
 * Tests for ThemeCopyMenu – the themed menu-button whose rows are ACTIONS
 * (apply a palette), not selectable values. Covers the menu-button contract:
 * roles, open/close, activate-on-click, activate-on-Enter, Escape cancels,
 * arrow nav skipping disabled rows, typeahead, the active-option preview hook,
 * the aria-disabled (but focusable) trigger, and ref forwarding.
 */

import ThemeCopyMenu, { type ThemeMenuOption } from './ThemeCopyMenu';
import { createRef } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const OPTIONS: ThemeMenuOption[] = [
  { id: 'apollo', label: 'Apollo' },
  { id: 'boyhood', label: 'Boyhood', disabled: true },
  { id: 'hitman', label: 'Hit Man' },
];

function renderMenu(props: Partial<Parameters<typeof ThemeCopyMenu>[0]> = {}) {
  const onActivate = vi.fn();
  render(
    <ThemeCopyMenu
      options={OPTIONS}
      label="Start from a theme"
      onActivate={onActivate}
      {...props}
    />,
  );
  return { onActivate };
}

function getTrigger() {
  return screen.getByRole('button', { name: 'Start from a theme' });
}

function getMenu() {
  return screen.getByRole('menu', { name: 'Start from a theme' });
}

function openMenu() {
  fireEvent.click(getTrigger());
  return getMenu();
}

describe('ThemeCopyMenu', () => {
  it('is a menu-button (haspopup=menu), collapsed initially', () => {
    renderMenu();
    const trigger = getTrigger();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders rows as menuitems with no selected state', () => {
    renderMenu();
    const menu = openMenu();
    const apollo = within(menu).getByRole('menuitem', { name: 'Apollo' });
    expect(apollo).toBeInTheDocument();
    expect(apollo).not.toHaveAttribute('aria-selected');
  });

  it('activates a row on click and closes', () => {
    const { onActivate } = renderMenu();
    const menu = openMenu();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Apollo' }));
    expect(onActivate).toHaveBeenCalledWith('apollo');
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not activate a disabled row', () => {
    const { onActivate } = renderMenu();
    const menu = openMenu();
    const disabled = within(menu).getByRole('menuitem', { name: 'Boyhood' });
    expect(disabled).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(disabled);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('opens with ArrowDown and activates the active row with Enter', () => {
    const { onActivate } = renderMenu();
    const trigger = getTrigger();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // Focus has moved into the menu container; navigation keys land there.
    fireEvent.keyDown(getMenu(), { key: 'Enter' });
    expect(onActivate).toHaveBeenCalledWith('apollo');
  });

  it('arrow navigation skips the disabled row', () => {
    const { onActivate } = renderMenu();
    const trigger = getTrigger();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // open, active = Apollo
    const menu = getMenu();
    fireEvent.keyDown(menu, { key: 'ArrowDown' }); // skip Boyhood -> Hit Man
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(onActivate).toHaveBeenCalledWith('hitman');
  });

  it('Escape closes without activating and returns focus to the trigger', () => {
    const { onActivate } = renderMenu();
    const trigger = getTrigger();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(getMenu(), { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('typeahead jumps to a matching enabled row', () => {
    const { onActivate } = renderMenu();
    const trigger = getTrigger();
    fireEvent.keyDown(trigger, { key: 'h' }); // opens + matches "Hit Man"
    fireEvent.keyDown(getMenu(), { key: 'Enter' });
    expect(onActivate).toHaveBeenCalledWith('hitman');
  });

  it('previews the active row and reverts on close', () => {
    const onActivePreview = vi.fn();
    renderMenu({ onActivePreview });
    const trigger = getTrigger();
    fireEvent.click(trigger); // open -> active = Apollo
    expect(onActivePreview).toHaveBeenLastCalledWith('apollo');
    fireEvent.keyDown(getMenu(), { key: 'Escape' });
    expect(onActivePreview).toHaveBeenLastCalledWith(null);
  });

  it('is focusable but inert when disabled (does not open or activate)', () => {
    const { onActivate } = renderMenu({ disabled: true });
    const trigger = getTrigger();
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    // Still in the tab order (no native `disabled`), so it stays discoverable.
    expect(trigger).not.toHaveAttribute('disabled');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('forwards a ref to the trigger button', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <ThemeCopyMenu
        ref={ref}
        options={OPTIONS}
        label="Start from a theme"
        onActivate={vi.fn()}
      />,
    );
    expect(ref.current).toBe(getTrigger());
  });
});
