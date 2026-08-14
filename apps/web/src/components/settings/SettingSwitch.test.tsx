/**
 * SettingSwitch is the one shared control behind all three Accessibility
 * settings switches (CVD mode, dyslexic font, keyboard shortcuts).
 *
 * In Windows High Contrast (`forced-colors: active`) the custom bundle colors
 * are replaced by system colors, collapsing the on/off `bg` distinction so
 * only the thumb position survives. To keep a genuine color-changing second
 * cue, the track carries system-color border overrides that key off the
 * `aria-checked` DOM attribute (no JS ternary, per the no-ternary-for-DOM-state
 * convention).
 *
 * jsdom cannot render forced-colors mode, so a className substring check alone
 * would only prove the class string is present, never that Tailwind compiles
 * it to the right rule. A string like `forced-colors:aria-checked:border-[X]`
 * could compile to the wrong attribute selector and the substring check would
 * still pass. So the compilation test below runs the classes the component
 * actually renders through Tailwind and asserts the resulting CSS: both rules
 * land inside the `forced-colors: active` media query, and the checked
 * `Highlight` border carries an extra `[aria-checked="true"]` attribute
 * selector the base `ButtonText` border lacks: the higher specificity that
 * makes the on state win when checked.
 */

import { compileClasses } from '../../../test/tailwind';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  it('renders both forced-colors border classes and reflects state via aria-checked', () => {
    const { rerender } = renderSwitch(false);
    let track = screen.getByRole('switch');
    expect(track.className).toContain('forced-colors:border-[ButtonText]');
    expect(track.className).toContain(
      'forced-colors:aria-checked:border-[Highlight]',
    );
    expect(track).toHaveAttribute('aria-checked', 'false');

    rerender(
      <SettingSwitch
        id="test"
        label="Test switch"
        description="Toggles a test preference"
        checked
        onToggle={vi.fn()}
      />,
    );
    track = screen.getByRole('switch');
    expect(track).toHaveAttribute('aria-checked', 'true');
  });

  it('compiles those classes so the checked Highlight border outranks the base ButtonText border in forced-colors mode', async () => {
    renderSwitch(false);
    const track = screen.getByRole('switch');
    const classes = track.className.split(/\s+/).filter(Boolean);

    const css = await compileClasses(classes);
    const flattened = css.replace(/\s+/g, ' ');

    // both overrides live inside the forced-colors media query
    expect(flattened).toContain('@media (forced-colors: active)');

    // off/base border keys off the class alone: lowest specificity
    expect(flattened).toContain(
      '.forced-colors\\:border-\\[ButtonText\\] { border-color: ButtonText; }',
    );

    // checked border adds aria-checked selector; higher specificity wins
    expect(flattened).toContain(
      '.forced-colors\\:aria-checked\\:border-\\[Highlight\\][aria-checked="true"] { border-color: Highlight; }',
    );
  });
});
