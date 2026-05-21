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
    // The hook only manages restoration; the open region itself is responsible
    // for moving focus inward. Simulate that here so we can prove restoration.
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
    // Focus stays where it was because the hook never armed.
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

    // Move focus to a different element while closed.
    const triggerB = document.createElement('button');
    document.body.appendChild(triggerB);
    triggerB.focus();
    expect(document.activeElement).toBe(triggerB);

    rerender({ open: true });
    // The region opens — pretend something inside takes focus.
    const innerInput = document.createElement('input');
    document.body.appendChild(innerInput);
    innerInput.focus();

    unmount();
    // Should restore to triggerB (focused when isOpen flipped to true),
    // not triggerA (focused before the hook armed).
    expect(document.activeElement).toBe(triggerB);

    triggerA.remove();
    triggerB.remove();
    innerInput.remove();
  });
});
