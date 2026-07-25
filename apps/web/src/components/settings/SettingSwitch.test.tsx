/**
 * SettingSwitch is the one shared control behind all three Accessibility
 * settings switches (CVD mode, dyslexic font, keyboard shortcuts).
 *
 * In Windows High Contrast (`forced-colors: active`) the custom bundle colors
 * are replaced by system colors, collapsing the on/off `bg` distinction so
 * only the thumb position survives. To keep a genuine color-changing second
 * cue, the track carries system-color border overrides that key off the
 * `aria-checked` DOM attribute (no JS ternary, per the no-ternary-for-DOM-state
 * convention). jsdom cannot render forced-colors mode, so these tests pin the
 * class/attribute wiring the CSS keys off.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SettingSwitch from './SettingSwitch';

function renderSwitch(checked: boolean) {
  return render(
    <SettingSwitch
      id="test"
      label="Test switch"
      description="Toggles a test preference"
      checked={checked}
      onToggle={vi.fn()}
    />,
  );
}

describe('SettingSwitch forced-colors redundancy', () => {
  it('applies a system-color track border in forced-colors mode', () => {
    renderSwitch(false);

    const track = screen.getByRole('switch');
    expect(track.className).toContain('forced-colors:border-[ButtonText]');
  });

  it('swaps the track border to the Highlight system color when checked, keyed off aria-checked', () => {
    renderSwitch(true);

    const track = screen.getByRole('switch');
    // The color-changing cue is driven by the aria-checked variant, not a JS
    // branch, so the on state gets a distinct system color from the off state.
    expect(track.className).toContain(
      'forced-colors:aria-checked:border-[Highlight]',
    );
    expect(track).toHaveAttribute('aria-checked', 'true');
  });

  it('exposes aria-checked=false in the off state so the variant resolves to the base border', () => {
    renderSwitch(false);

    const track = screen.getByRole('switch');
    expect(track).toHaveAttribute('aria-checked', 'false');
    // Both cues are present as variants; the DOM attribute selects which wins.
    expect(track.className).toContain('forced-colors:border-[ButtonText]');
    expect(track.className).toContain(
      'forced-colors:aria-checked:border-[Highlight]',
    );
  });
});
