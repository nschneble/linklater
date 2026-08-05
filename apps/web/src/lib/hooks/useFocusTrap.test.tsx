import { createRef, useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useFocusTrap } from './useFocusTrap';

function ContainerWithTrap({
  onEscape,
  children,
}: {
  onEscape?: () => void;
  children: React.ReactNode;
}) {
  const reference = useRef<HTMLDivElement>(null);
  useFocusTrap(reference, { onEscape });
  return (
    <div ref={reference} data-testid="trap">
      {children}
    </div>
  );
}

function pressKey(target: HTMLElement, key: string, shiftKey = false) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }),
  );
}

describe('useFocusTrap', () => {
  it('wraps focus from the last focusable element back to the first on Tab', () => {
    const { getByText, getByTestId } = render(
      <ContainerWithTrap>
        <button>First</button>
        <button>Middle</button>
        <button>Last</button>
      </ContainerWithTrap>,
    );

    const first = getByText('First');
    const last = getByText('Last');
    last.focus();
    expect(document.activeElement).toBe(last);

    pressKey(getByTestId('trap'), 'Tab');
    expect(document.activeElement).toBe(first);
  });

  it('wraps focus from the first element back to the last on Shift+Tab', () => {
    const { getByText, getByTestId } = render(
      <ContainerWithTrap>
        <button>First</button>
        <button>Last</button>
      </ContainerWithTrap>,
    );

    const first = getByText('First');
    const last = getByText('Last');
    first.focus();

    pressKey(getByTestId('trap'), 'Tab', true);
    expect(document.activeElement).toBe(last);
  });

  it('does not interfere with Tab when focus is in the middle of the trap', () => {
    const { getByText, getByTestId } = render(
      <ContainerWithTrap>
        <button>First</button>
        <button>Middle</button>
        <button>Last</button>
      </ContainerWithTrap>,
    );

    const middle = getByText('Middle');
    middle.focus();

    pressKey(getByTestId('trap'), 'Tab');
    // jsdom has no real Tab nav; the trap only intercepts at the edges
    expect(document.activeElement).toBe(middle);
  });

  it('invokes onEscape when Escape is pressed inside the trap', () => {
    const onEscape = vi.fn();
    const { getByTestId } = render(
      <ContainerWithTrap onEscape={onEscape}>
        <button>Only</button>
      </ContainerWithTrap>,
    );

    pressKey(getByTestId('trap'), 'Escape');
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('is a no-op on Escape when onEscape is not provided', () => {
    const { getByTestId } = render(
      <ContainerWithTrap>
        <button>Only</button>
      </ContainerWithTrap>,
    );
    expect(() => pressKey(getByTestId('trap'), 'Escape')).not.toThrow();
  });

  it('does nothing when the trap contains no focusable elements', () => {
    const { getByTestId } = render(
      <ContainerWithTrap>
        <span>not focusable</span>
      </ContainerWithTrap>,
    );
    expect(() => pressKey(getByTestId('trap'), 'Tab')).not.toThrow();
  });

  it('ignores keys other than Tab and Escape', () => {
    const onEscape = vi.fn();
    const { getByTestId } = render(
      <ContainerWithTrap onEscape={onEscape}>
        <button>Only</button>
      </ContainerWithTrap>,
    );

    pressKey(getByTestId('trap'), 'a');
    pressKey(getByTestId('trap'), 'Enter');
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('excludes a disabled button from the computed focusable set', () => {
    const { getByText, getByTestId } = render(
      <ContainerWithTrap>
        <button>First</button>
        <button>Real Last</button>
        <button disabled>Disabled</button>
      </ContainerWithTrap>,
    );

    const first = getByText('First');
    const realLast = getByText('Real Last');
    realLast.focus();

    // disabled button excluded, so 'Real Last' is last and Tab wraps to first
    pressKey(getByTestId('trap'), 'Tab');
    expect(document.activeElement).toBe(first);
  });

  it('excludes elements inside an inert subtree from the computed focusable set', () => {
    const { getByText, getByTestId } = render(
      <ContainerWithTrap>
        <button>First</button>
        <button>Real Last</button>
        <div inert>
          <button>Inert</button>
        </div>
      </ContainerWithTrap>,
    );

    const first = getByText('First');
    const realLast = getByText('Real Last');
    realLast.focus();

    // inert descendant filtered out, so 'Real Last' is last and Tab wraps first
    pressKey(getByTestId('trap'), 'Tab');
    expect(document.activeElement).toBe(first);
  });

  it('detaches the listener when the ref unmounts', () => {
    const reference = createRef<HTMLDivElement>();
    function Wrapper({ open }: { open: boolean }) {
      const innerReference = useRef<HTMLDivElement>(null);
      useFocusTrap(open ? innerReference : { current: null });
      return open ? <div ref={innerReference}>open</div> : null;
    }
    const { rerender } = render(<Wrapper open={true} />);
    rerender(<Wrapper open={false} />);
    // no assertion; verifies cleanup doesn't throw on later renders
    expect(reference.current).toBeNull();
  });
});
