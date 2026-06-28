/*
 * Tests for the custom-theme off-ramp (formerly the master switch). Locks the
 * Option-B contract: it renders the "Back to {theme}" button ONLY while custom
 * is active, names it without "switch"/"toggle", and paints from FIXED escape-
 * hatch colors (never bundle tokens) so it stays legible on a hostile palette.
 */

import CustomThemeOffRamp from './CustomThemeOffRamp';
import { ESCAPE_HATCH_LIGHT } from './escapeHatchStyles';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

describe('CustomThemeOffRamp', () => {
  it('renders no off-ramp button while custom is inactive', () => {
    render(
      <CustomThemeOffRamp
        active={false}
        baseThemeLabel="School of Rock"
        onRevert={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    // The standing description still discloses the go-custom-on-edit flow.
    expect(
      screen.getByText(/editing any color here saves it as your own theme/i),
    ).toBeInTheDocument();
  });

  it('shows a "Back to {theme}" button while custom is active and reverts', () => {
    const onRevert = vi.fn();
    render(
      <CustomThemeOffRamp
        active
        baseThemeLabel="School of Rock"
        onRevert={onRevert}
      />,
    );
    const button = screen.getByRole('button', {
      name: 'Back to School of Rock',
    });
    // The accessible name carries no "switch"/"toggle"/"off" wording (WCAG 2.5.3).
    expect(button).not.toHaveAccessibleName(/switch|toggle|turn off/i);
    fireEvent.click(button);
    expect(onRevert).toHaveBeenCalledTimes(1);
  });

  it('paints the off-ramp from fixed escape-hatch colors, not bundle tokens', () => {
    render(
      <CustomThemeOffRamp
        active
        baseThemeLabel="School of Rock"
        onRevert={vi.fn()}
      />,
    );
    const button = screen.getByRole('button', {
      name: 'Back to School of Rock',
    });
    expect(button.style.backgroundColor).toBe('rgb(250, 250, 250)'); // #fafafa
    expect(button.style.color).toBe('rgb(10, 10, 10)'); // #0a0a0a
    expect(button.style.borderColor).toBe('rgb(64, 64, 64)'); // #404040
    // ...and those are exactly the shared escape-hatch literals.
    expect(ESCAPE_HATCH_LIGHT).toMatchObject({
      backgroundColor: '#fafafa',
      color: '#0a0a0a',
      borderColor: '#404040',
    });
  });
});
