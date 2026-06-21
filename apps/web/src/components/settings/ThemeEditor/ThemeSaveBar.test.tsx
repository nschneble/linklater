/*
 * Tests for ThemeSaveBar – the custom-only Save action.
 *
 * Covers a11y brief B1/B5/B6: Save is present-but-aria-disabled for non-custom
 * themes and no-ops on click; aria-busy reflects the in-flight state; the live
 * failing-contrast count is surfaced; a save-attempt alert fires only on
 * activation.
 */

import ThemeSaveBar from './ThemeSaveBar';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

function renderBar(overrides?: Partial<Parameters<typeof ThemeSaveBar>[0]>) {
  const onSave = vi.fn();
  render(
    <ThemeSaveBar
      isCustom
      isSaving={false}
      failingCount={0}
      onSave={onSave}
      {...overrides}
    />,
  );
  return { onSave };
}

function getSaveButton() {
  return screen.getByRole('button', { name: /sav/i });
}

describe('ThemeSaveBar', () => {
  it('keeps a stable accessible name and fires onSave when custom', () => {
    const { onSave } = renderBar();
    const button = getSaveButton();
    expect(button).toHaveAttribute('aria-disabled', 'false');
    fireEvent.click(button);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('stays present but aria-disabled and no-ops for non-custom themes', () => {
    const { onSave } = renderBar({ isCustom: false });
    const button = getSaveButton();
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('explains availability via aria-describedby when non-custom', () => {
    renderBar({ isCustom: false });
    const button = getSaveButton();
    const describedById = button.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();
    const description = document.getElementById(describedById as string);
    expect(description?.textContent).toMatch(/custom theme only/i);
  });

  it('sets aria-busy and suppresses activation while saving', () => {
    const { onSave } = renderBar({ isSaving: true });
    const button = getSaveButton();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('surfaces the live failing-contrast count when custom', () => {
    renderBar({ failingCount: 3 });
    expect(screen.getByText(/3 contrast pairs failing/i)).toBeInTheDocument();
  });

  it('announces failing pairs in the save-attempt alert on activation', () => {
    renderBar({ failingCount: 2 });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('');
    fireEvent.click(getSaveButton());
    expect(alert).toHaveTextContent(/2 failing contrast pairs/i);
  });
});
