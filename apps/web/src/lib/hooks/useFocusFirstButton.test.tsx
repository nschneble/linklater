import { useRef } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFocusFirstButton } from './useFocusFirstButton';

function Harness({ isActive }: { isActive: boolean }) {
  const reference = useRef<HTMLDivElement>(null);
  useFocusFirstButton(reference, isActive);
  return (
    <div ref={reference}>
      <button>First</button>
      <button>Second</button>
    </div>
  );
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

describe('useFocusFirstButton', () => {
  it('focuses the first button inside the ref when isActive is true', async () => {
    const { getByText } = render(<Harness isActive={true} />);
    await waitForAnimationFrame();
    expect(document.activeElement).toBe(getByText('First'));
  });

  it('does not focus anything when isActive is false', async () => {
    const previousActive = document.activeElement;
    render(<Harness isActive={false} />);
    await waitForAnimationFrame();
    expect(document.activeElement).toBe(previousActive);
  });

  it('focuses the first button when isActive flips from false to true', async () => {
    const { rerender, getByText } = render(<Harness isActive={false} />);
    await waitForAnimationFrame();
    expect(document.activeElement).not.toBe(getByText('First'));

    rerender(<Harness isActive={true} />);
    await waitForAnimationFrame();
    expect(document.activeElement).toBe(getByText('First'));
  });

  it('does nothing when the ref contains no button', async () => {
    function NoButton({ isActive }: { isActive: boolean }) {
      const reference = useRef<HTMLDivElement>(null);
      useFocusFirstButton(reference, isActive);
      return (
        <div ref={reference}>
          <span>no button here</span>
        </div>
      );
    }
    expect(() => render(<NoButton isActive={true} />)).not.toThrow();
    await waitForAnimationFrame();
  });
});
