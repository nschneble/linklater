import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFocusReturn } from './useFocusReturn';

function mountTriggerButton(): HTMLButtonElement {
  const trigger = document.createElement('button');
  trigger.textContent = 'Open';
  document.body.appendChild(trigger);
  trigger.focus();
  return trigger;
}

describe('useFocusReturn', () => {
  it('restores focus to the previously focused element when the open region unmounts', () => {
    const trigger = mountTriggerButton();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = renderHook(() => useFocusReturn(true));
    // the hook only restores; the open region moves focus inward, simulated here
    const innerInput = document.createElement('input');
    document.body.appendChild(innerInput);
    innerInput.focus();
    expect(document.activeElement).toBe(innerInput);

    unmount();
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
    innerInput.remove();
  });

  it('does not capture or restore when isOpen is false', () => {
    const trigger = mountTriggerButton();
    const { unmount } = renderHook(() => useFocusReturn(false));

    const innerInput = document.createElement('input');
    document.body.appendChild(innerInput);
    innerInput.focus();
    expect(document.activeElement).toBe(innerInput);

    unmount();
    // focus stays where it was because the hook never armed
    expect(document.activeElement).toBe(innerInput);

    trigger.remove();
    innerInput.remove();
  });

  it('skips restoration when skipRestore is called before unmount', () => {
    const trigger = mountTriggerButton();
    const { result, unmount } = renderHook(() => useFocusReturn(true));

    const innerInput = document.createElement('input');
    document.body.appendChild(innerInput);
    innerInput.focus();

    result.current.skipRestore();
    unmount();
    // focus stays where the consumer left it, not the captured trigger (nav case)
    expect(document.activeElement).toBe(innerInput);

    trigger.remove();
    innerInput.remove();
  });

  it('captures a fresh trigger when isOpen flips from false to true', () => {
    const triggerA = mountTriggerButton();
    const { rerender, unmount } = renderHook(
      ({ open }) => useFocusReturn(open),
      { initialProps: { open: false } },
    );

    // move focus to a different element while closed
    const triggerB = document.createElement('button');
    document.body.appendChild(triggerB);
    triggerB.focus();
    expect(document.activeElement).toBe(triggerB);

    rerender({ open: true });
    // the region opens; pretend something inside takes focus
    const innerInput = document.createElement('input');
    document.body.appendChild(innerInput);
    innerInput.focus();

    unmount();
    // should restore to triggerB (focused at flip), not triggerA (pre-arm)
    expect(document.activeElement).toBe(triggerB);

    triggerA.remove();
    triggerB.remove();
    innerInput.remove();
  });
});
