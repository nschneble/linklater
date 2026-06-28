/*
 * Tests for CopyFromTheme – the "Start from a theme" menu control.
 *
 * Covers the redesigned flow: picking a theme is a one-step ACTION (apply +
 * autosave, no Copy button), the menu is aria-disabled until the custom theme
 * is enabled, the role="group" labelling + describedby hint, the active-row
 * preview hook, and the Undo button (naming + focus-return to the trigger).
 */

import CopyFromTheme from './CopyFromTheme';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

function renderControl(
  props: Partial<Parameters<typeof CopyFromTheme>[0]> = {},
) {
  const onApply = vi.fn();
  const onPreviewTheme = vi.fn();
  const onUndo = vi.fn();
  render(
    <CopyFromTheme
      editingEnabled
      onApply={onApply}
      onPreviewTheme={onPreviewTheme}
      undoThemeLabel={null}
      onUndo={onUndo}
      {...props}
    />,
  );
  return { onApply, onPreviewTheme, onUndo };
}

function getTrigger() {
  return screen.getByRole('button', { name: /start from a theme/i });
}

describe('CopyFromTheme', () => {
  it('groups the menu under a labelled group', () => {
    renderControl();
    // The group is named distinctly from its menu trigger ("Start from a
    // theme") so a screen reader doesn't hear the same phrase twice.
    expect(
      screen.getByRole('group', { name: /copy a palette/i }),
    ).toBeInTheDocument();
  });

  it('applies the picked theme in one step (no Copy button)', () => {
    const { onApply } = renderControl();
    expect(screen.queryByRole('button', { name: /^copy$/i })).toBeNull();
    fireEvent.click(getTrigger());
    const menu = screen.getByRole('menu', { name: /start from a theme/i });
    fireEvent.click(
      within(menu).getByRole('menuitem', { name: /apollo 10½/i }),
    );
    expect(onApply).toHaveBeenCalledWith('apollo-10-1-2', 'Apollo 10½');
  });

  it('excludes the custom theme from the menu', () => {
    renderControl();
    fireEvent.click(getTrigger());
    expect(
      screen.queryByRole('menuitem', { name: /^your custom theme$/i }),
    ).toBeNull();
  });

  it('is aria-disabled and does not open while the custom theme is off', () => {
    const { onApply } = renderControl({ editingEnabled: false });
    const trigger = getTrigger();
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(onApply).not.toHaveBeenCalled();
  });

  it('previews the active row theme and reverts on close', () => {
    const { onPreviewTheme } = renderControl();
    fireEvent.click(getTrigger());
    expect(onPreviewTheme).toHaveBeenLastCalledWith('apollo-10-1-2');
    const menu = screen.getByRole('menu', { name: /start from a theme/i });
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(onPreviewTheme).toHaveBeenLastCalledWith(null);
  });

  it('describes the apply-and-undo behavior when enabled', () => {
    renderControl();
    const describedById = getTrigger().getAttribute('aria-describedby');
    const description = document.getElementById(describedById as string);
    expect(description?.textContent).toMatch(/undo to revert/i);
  });

  it('shows a labelled Undo button only when there is something to undo', () => {
    const { rerender } = renderUndoable(null);
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();
    rerender('Apollo 10½');
    expect(
      screen.getByRole('button', { name: 'Undo copy from Apollo 10½' }),
    ).toBeInTheDocument();
  });

  it('reverts and returns focus to the trigger on Undo', () => {
    const onUndo = vi.fn();
    render(
      <CopyFromTheme
        editingEnabled
        onApply={vi.fn()}
        onPreviewTheme={vi.fn()}
        undoThemeLabel="Apollo 10½"
        onUndo={onUndo}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /undo copy from/i }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(getTrigger()).toHaveFocus();
  });
});

/** Renders the control with a controllable `undoThemeLabel`. */
function renderUndoable(initial: string | null) {
  const view = render(
    <CopyFromTheme
      editingEnabled
      onApply={vi.fn()}
      onPreviewTheme={vi.fn()}
      undoThemeLabel={initial}
      onUndo={vi.fn()}
    />,
  );
  return {
    rerender: (label: string | null) =>
      view.rerender(
        <CopyFromTheme
          editingEnabled
          onApply={vi.fn()}
          onPreviewTheme={vi.fn()}
          undoThemeLabel={label}
          onUndo={vi.fn()}
        />,
      ),
  };
}
