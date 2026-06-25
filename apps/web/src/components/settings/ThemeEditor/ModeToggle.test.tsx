/*
 * Tests for ModeToggle – the editor's fixed-color dark/light pill. Covers the
 * group + aria-pressed toggle semantics, commit-on-click, and the fixed
 * (non-token) active-label color that keeps the control legible on a hostile
 * custom palette.
 */

import ModeToggle from './ModeToggle';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ESCAPE_HATCH_PILL } from './escapeHatchStyles';

const LABELS = { light: 'Light colors', dark: 'Dark colors' } as const;

function renderToggle(props: Partial<Parameters<typeof ModeToggle>[0]> = {}) {
  return render(
    <ModeToggle
      mode="dark"
      onModeChange={vi.fn()}
      groupLabel="Palette to edit"
      labels={LABELS}
      {...props}
    />,
  );
}

function getGroup() {
  return screen.getByRole('group', { name: /palette to edit/i });
}

describe('ModeToggle', () => {
  it('renders dark + light as aria-pressed toggle buttons reflecting the mode', () => {
    renderToggle({ mode: 'dark' });
    const group = getGroup();
    expect(
      within(group).getByRole('button', { name: /dark colors/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(group).getByRole('button', { name: /light colors/i }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('uses the visible label as the accessible name (SC 2.5.3, no aria-label)', () => {
    renderToggle({ mode: 'dark' });
    // Voice-control: the button is reachable by its visible text.
    expect(
      screen.getByRole('button', { name: 'Light colors' }),
    ).toBeInTheDocument();
  });

  it('commits the chosen mode on click', () => {
    const onModeChange = vi.fn();
    renderToggle({ mode: 'dark', onModeChange });
    fireEvent.click(screen.getByRole('button', { name: /light colors/i }));
    expect(onModeChange).toHaveBeenCalledWith('light');
  });

  it('paints the active label a fixed escape-hatch color, not a theme token', () => {
    renderToggle({ mode: 'light' });
    const active = screen.getByRole('button', { name: /light colors/i });
    // Inline fixed color (hostile palette can't hide the active state).
    expect(active.style.color).toBeTruthy();
    expect(active.style.color).not.toContain('var(');
    // Inactive button leaves color to the (themed) class, no inline override.
    expect(
      screen.getByRole('button', { name: /dark colors/i }).style.color,
    ).toBe('');
    // Sanity: the fixed pair exists for both modes.
    expect(ESCAPE_HATCH_PILL.light.label).toBeTruthy();
    expect(ESCAPE_HATCH_PILL.dark.label).toBeTruthy();
  });
});
