import { useRef } from 'react';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACTION_GUARD_INITIAL_FOCUS_ATTRIBUTE,
  actionGuardInitialFocusProps,
  useFocusFirstButton,
} from './useFocusFirstButton';

// safe button (Cancel) carries the marker; focus follows it, not DOM order
function Harness({ isActive }: { isActive: boolean }) {
  const reference = useRef<HTMLDivElement>(null);
  useFocusFirstButton(reference, isActive);
  return (
    <div ref={reference}>
      <button>Yes, delete</button>
      <button {...actionGuardInitialFocusProps}>Cancel</button>
    </div>
  );
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

describe('useFocusFirstButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('focuses the marked button, not the first button in DOM order, when isActive is true', async () => {
    const { getByText } = render(<Harness isActive={true} />);
    await waitForAnimationFrame();
    expect(document.activeElement).toBe(getByText('Cancel'));
    // the first (destructive) button must NOT receive focus
    expect(document.activeElement).not.toBe(getByText('Yes, delete'));
  });

  it('does not focus anything when isActive is false', async () => {
    const previousActive = document.activeElement;
    render(<Harness isActive={false} />);
    await waitForAnimationFrame();
    expect(document.activeElement).toBe(previousActive);
  });

  it('focuses the marked button when isActive flips from false to true', async () => {
    const { rerender, getByText } = render(<Harness isActive={false} />);
    await waitForAnimationFrame();
    expect(document.activeElement).not.toBe(getByText('Cancel'));

    rerender(<Harness isActive={true} />);
    await waitForAnimationFrame();
    expect(document.activeElement).toBe(getByText('Cancel'));
  });

  it('spreads the marker attribute onto the safe button', () => {
    const { getByText } = render(<Harness isActive={false} />);
    expect(
      getByText('Cancel').hasAttribute(ACTION_GUARD_INITIAL_FOCUS_ATTRIBUTE),
    ).toBe(true);
  });

  it('does not throw and warns in dev when no marked button is present', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    function NoMarker({ isActive }: { isActive: boolean }) {
      const reference = useRef<HTMLDivElement>(null);
      useFocusFirstButton(reference, isActive);
      return (
        <div ref={reference}>
          <button>unmarked</button>
        </div>
      );
    }
    expect(() => render(<NoMarker isActive={true} />)).not.toThrow();
    await waitForAnimationFrame();
    expect(warn).toHaveBeenCalledOnce();
  });
});
