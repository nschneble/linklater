/*
 * What a switch does while the persist behind it is still in flight.
 *
 * Measured in Chromium: a focused `<button>` that gains the native `disabled`
 * attribute loses focus to `BODY`, so a user who flips the switch from the
 * keyboard is dropped to the top of the document mid-interaction. jsdom
 * implements no such fixup - a focus assertion alone passes against the
 * native attribute too - so what this file pins is the mechanism that makes
 * the browser behaviour unreachable: no native `disabled`, an `aria-disabled`
 * refusal that stays in the tab order, and an activation guard that keeps the
 * double-submit blocked without it.
 *
 * `data-busy` rides along because `lib/styles.ts` `ARIA_DISABLED` withholds
 * its 60% dim on that attribute; `ariaDisabledDim.contrast.test.ts` owns why.
 */

import { compileClasses } from '../../../test/tailwind';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SettingSwitch from './SettingSwitch';

function renderSwitch(busy: boolean, onToggle = vi.fn()) {
  return render(
    <SettingSwitch
      id="test"
      label="Test switch"
      description="Toggles a test preference"
      checked={false}
      busy={busy}
      onToggle={onToggle}
    />,
  );
}

describe('SettingSwitch while busy', () => {
  it('refuses through aria-disabled so the control keeps its focus', () => {
    renderSwitch(true);
    const toggle = screen.getByRole('switch');

    expect(toggle).not.toBeDisabled();
    expect(toggle).toHaveAttribute('aria-disabled', 'true');
    expect(toggle).toHaveAttribute('aria-busy', 'true');

    toggle.focus();
    expect(document.activeElement).toBe(toggle);
  });

  it('ignores activation while the persist is in flight', () => {
    const onToggle = vi.fn();
    renderSwitch(true, onToggle);

    fireEvent.click(screen.getByRole('switch'));

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('accepts activation again once the persist settles', () => {
    const onToggle = vi.fn();
    renderSwitch(false, onToggle);

    fireEvent.click(screen.getByRole('switch'));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('marks the wait so the shared refusal styling reads it as busy', async () => {
    renderSwitch(true);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('data-busy', 'true');

    const css = await compileClasses(
      toggle.className.split(/\s+/).filter(Boolean),
    );

    // the busy cursor is compiled and outranks the idle pointer cursor
    expect(css).toContain('cursor: progress');
    expect(css.indexOf('cursor: progress')).toBeGreaterThan(
      css.indexOf('cursor: pointer'),
    );
  });

  it('carries no styling for a refusal it has no way to be in', async () => {
    renderSwitch(true);
    const css = await compileClasses(
      screen.getByRole('switch').className.split(/\s+/).filter(Boolean),
    );

    expect(css).not.toContain(':not([data-busy])');
  });
});
