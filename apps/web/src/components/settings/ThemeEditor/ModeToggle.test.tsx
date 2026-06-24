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

function getGroup() {
  return screen.getByRole('group', { name: /color mode/i });
}

describe('ModeToggle', () => {
  it('renders dark + light as aria-pressed toggle buttons reflecting the mode', () => {
    render(<ModeToggle mode="dark" onModeChange={vi.fn()} />);
    const group = getGroup();
    expect(
      within(group).getByRole('button', { name: /dark/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(group).getByRole('button', { name: /light/i }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('commits the chosen mode on click', () => {
    const onModeChange = vi.fn();
    render(<ModeToggle mode="dark" onModeChange={onModeChange} />);
    fireEvent.click(screen.getByRole('button', { name: /light/i }));
    expect(onModeChange).toHaveBeenCalledWith('light');
  });

  it('paints the active label a fixed escape-hatch color, not a theme token', () => {
    render(<ModeToggle mode="light" onModeChange={vi.fn()} />);
    const active = screen.getByRole('button', { name: /light/i });
    // Inline fixed color (hostile palette can't hide the active state).
    expect(active.style.color).toBeTruthy();
    expect(active.style.color).not.toContain('var(');
    // Inactive button leaves color to the (themed) class, no inline override.
    expect(screen.getByRole('button', { name: /dark/i }).style.color).toBe('');
    // Sanity: the fixed pair exists for both modes.
    expect(ESCAPE_HATCH_PILL.light.label).toBeTruthy();
    expect(ESCAPE_HATCH_PILL.dark.label).toBeTruthy();
  });
});
