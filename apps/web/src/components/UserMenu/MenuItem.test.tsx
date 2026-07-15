import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MenuItem from './MenuItem';

/**
 * Pin the hover class-string contract so a future refactor cannot silently
 * drop the highlight fill or the border-y stroke. WCAG guarantees live at the
 * token layer:
 *
 *   - SC 1.4.11 (3:1 non-text) on the hover indicator is carried by
 *     `--orbit-highlight` vs `--orbit-bg` >= 3:1, enforced for every theme
 *     in `bundles.contrast.test.ts`.
 *   - SC 2.4.7 (focus visible) + SC 1.4.11 on the focus ring are carried by
 *     `--focus-ring` vs `--orbit-bg` >= 3:1, also enforced in
 *     `bundles.contrast.test.ts`. `FOCUS_RING` (lib/styles.ts) is the only
 *     focus-visible styling – no separate fill/inset-ring needed.
 *
 * This test only guards that the bundle-driven hover affordance is wired up
 * on the component, not the contrast math itself.
 */
describe('MenuItem', () => {
  it('applies hover bg + border-y for menu-row state', () => {
    render(<MenuItem icon="fa-bookmark" label="Test" onClick={() => {}} />);
    const button = screen.getByRole('menuitem');
    const className = button.className;
    expect(className).toMatch(/hover:bg-\[var\(--orbit-highlight\)\]\/80/);
    expect(className).toMatch(/border-y/);
    expect(className).toMatch(/border-transparent/);
    expect(className).toMatch(
      /hover:border-\[var\(--orbit-highlight-hover\)\]\/80/,
    );
  });

  /**
   * `MenuItem` is shared by the desktop dropdown and the mobile bottom sheet.
   * The desktop hover-retention hack calls `preventDefault()` on `mousedown`;
   * on mobile engines that suppresses the follow-on synthesized `click`, so a
   * tap never activates `onClick`.
   *
   * jsdom cannot synthesize the real touch -> mouse -> click compat cascade, so
   * these tests assert the GATING LOGIC deterministically: `fireEvent.mouseDown`
   * returns the `dispatchEvent` boolean, which is `false` only when the handler
   * called `preventDefault()`. Touch must NOT preventDefault (click survives);
   * mouse MUST preventDefault (desktop blur-retention survives).
   */
  it('does not preventDefault the mousedown after a touch pointerdown so the tap click fires', () => {
    const onClick = vi.fn();
    render(<MenuItem icon="fa-bookmark" label="Test" onClick={onClick} />);
    const button = screen.getByRole('menuitem');

    fireEvent.pointerDown(button, { pointerType: 'touch' });
    const mouseDownNotCancelled = fireEvent.mouseDown(button);
    fireEvent.click(button);

    // `true` == the mousedown was NOT preventDefaulted, so the real-browser
    // synthesized click would survive on touch. This is the real bug oracle.
    expect(mouseDownNotCancelled).toBe(true);
    // Intent-doc only: jsdom has no touch -> mouse -> click compat cascade, so
    // this passes even on the buggy (always-preventDefault) code. The assertion
    // above is the actual regression oracle.
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('preventDefaults the mousedown after a mouse pointerdown to retain desktop focus', () => {
    const onClick = vi.fn();
    render(<MenuItem icon="fa-bookmark" label="Test" onClick={onClick} />);
    const button = screen.getByRole('menuitem');

    fireEvent.pointerDown(button, { pointerType: 'mouse' });
    const mouseDownNotCancelled = fireEvent.mouseDown(button);

    // `false` == the mousedown WAS preventDefaulted (macOS blur-retention hack).
    expect(mouseDownNotCancelled).toBe(false);
  });

  it('preventDefaults a mousedown with no preceding pointerdown (undefined pointerType is treated as mouse)', () => {
    const onClick = vi.fn();
    render(<MenuItem icon="fa-bookmark" label="Test" onClick={onClick} />);
    const button = screen.getByRole('menuitem');

    // Older engines fire mousedown without a preceding pointerdown, so
    // `lastPointerType` stays `undefined`. That branch must still preventDefault
    // so the desktop blur-retention hack keeps working. This covers the
    // `lastPointerType.current === undefined` arm of the gate.
    const mouseDownNotCancelled = fireEvent.mouseDown(button);

    expect(mouseDownNotCancelled).toBe(false);
  });

  it('activates onClick for the keyboard path with no preceding pointer event', () => {
    const onClick = vi.fn();
    render(<MenuItem icon="fa-bookmark" label="Test" onClick={onClick} />);
    const button = screen.getByRole('menuitem');

    // Native button Enter/Space dispatches a click with no mousedown/pointerdown.
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
