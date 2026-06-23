/*
 * Tests for ThemeSelectMenu – the themed select-only combobox that replaces
 * the editor's native <select>s. Covers the APG combobox contract: roles,
 * open/close, commit-on-click, commit-on-Enter, Escape cancels, arrow nav
 * skipping disabled rows, and typeahead.
 */

import ThemeSelectMenu, { type ThemeSelectOption } from './ThemeSelectMenu';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const OPTIONS: ThemeSelectOption[] = [
  { id: 'apollo', label: 'Apollo' },
  { id: 'boyhood', label: 'Boyhood', disabled: true },
  { id: 'hitman', label: 'Hit Man' },
];

function renderMenu(value = '', extra: Partial<ThemeSelectOption>[] = []) {
  const onSelect = vi.fn();
  const options = extra.length
    ? OPTIONS.map((option, index) => ({ ...option, ...extra[index] }))
    : OPTIONS;
  render(
    <ThemeSelectMenu
      options={options}
      value={value}
      placeholder="Pick one…"
      onSelect={onSelect}
      ariaLabel="Theme"
    />,
  );
  return { onSelect };
}

function getTrigger() {
  return screen.getByRole('combobox', { name: 'Theme' });
}

function openListbox() {
  fireEvent.click(getTrigger());
  return screen.getByRole('listbox', { name: 'Theme' });
}

describe('ThemeSelectMenu', () => {
  it('shows the placeholder and is collapsed initially', () => {
    renderMenu();
    const trigger = getTrigger();
    expect(trigger).toHaveTextContent('Pick one…');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('shows the selected option label on the trigger', () => {
    renderMenu('hitman');
    expect(getTrigger()).toHaveTextContent('Hit Man');
  });

  it('opens on click and marks the selected option', () => {
    renderMenu('hitman');
    const listbox = openListbox();
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(listbox).getByRole('option', { name: 'Hit Man' }),
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('commits a selection on option click and closes', () => {
    const { onSelect } = renderMenu();
    const listbox = openListbox();
    fireEvent.click(within(listbox).getByRole('option', { name: 'Apollo' }));
    expect(onSelect).toHaveBeenCalledWith('apollo');
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not commit a disabled option', () => {
    const { onSelect } = renderMenu();
    const listbox = openListbox();
    const disabled = within(listbox).getByRole('option', { name: 'Boyhood' });
    expect(disabled).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(disabled);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('opens with ArrowDown and commits the active option with Enter', () => {
    const { onSelect } = renderMenu();
    const trigger = getTrigger();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // Active starts on the first enabled option (Apollo); Enter commits it.
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('apollo');
  });

  it('arrow navigation skips the disabled option', () => {
    const { onSelect } = renderMenu();
    const trigger = getTrigger();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // open, active = Apollo
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // skip Boyhood -> Hit Man
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('hitman');
  });

  it('Escape closes without committing', () => {
    const { onSelect } = renderMenu();
    const trigger = getTrigger();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('typeahead jumps to a matching enabled option', () => {
    const { onSelect } = renderMenu();
    const trigger = getTrigger();
    fireEvent.keyDown(trigger, { key: 'h' }); // opens + matches "Hit Man"
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('hitman');
  });
});
