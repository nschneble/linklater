import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { useTabNavigation } from './useTabNavigation';

afterEach(() => vi.restoreAllMocks());

function Tablist({
  onFirst,
  onSecond,
}: {
  onFirst: () => void;
  onSecond: () => void;
}) {
  const reference = useRef<HTMLDivElement>(null);
  useTabNavigation(reference);

  return (
    <div ref={reference} role="tablist">
      <button type="button" role="tab" aria-selected={true} onClick={onFirst}>
        First
      </button>
      <button type="button" role="tab" aria-selected={false} onClick={onSecond}>
        Second
      </button>
    </div>
  );
}

function ThreeTablist({
  onFirst,
  onSecond,
  onThird,
}: {
  onFirst: () => void;
  onSecond: () => void;
  onThird: () => void;
}) {
  const reference = useRef<HTMLDivElement>(null);
  useTabNavigation(reference);

  return (
    <div ref={reference} role="tablist">
      <button type="button" role="tab" aria-selected={true} onClick={onFirst}>
        First
      </button>
      <button type="button" role="tab" aria-selected={false} onClick={onSecond}>
        Second
      </button>
      <button type="button" role="tab" aria-selected={false} onClick={onThird}>
        Third
      </button>
    </div>
  );
}

describe('useTabNavigation', () => {
  it('ArrowRight moves focus from first tab to second', () => {
    render(<Tablist onFirst={vi.fn()} onSecond={vi.fn()} />);
    const [first, second] = screen.getAllByRole('tab');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(second);
  });

  it('ArrowRight activates the newly focused tab', () => {
    const onSecond = vi.fn();
    render(<Tablist onFirst={vi.fn()} onSecond={onSecond} />);
    const [first] = screen.getAllByRole('tab');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(onSecond).toHaveBeenCalledOnce();
  });

  it('ArrowLeft moves focus from second tab to first', () => {
    render(<Tablist onFirst={vi.fn()} onSecond={vi.fn()} />);
    const [first, second] = screen.getAllByRole('tab');
    second.focus();
    fireEvent.keyDown(second, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(first);
  });

  it('ArrowLeft activates the newly focused tab', () => {
    const onFirst = vi.fn();
    render(<Tablist onFirst={onFirst} onSecond={vi.fn()} />);
    const [, second] = screen.getAllByRole('tab');
    second.focus();
    fireEvent.keyDown(second, { key: 'ArrowLeft' });
    expect(onFirst).toHaveBeenCalledOnce();
  });

  it('ArrowLeft on first tab wraps to last', () => {
    render(<Tablist onFirst={vi.fn()} onSecond={vi.fn()} />);
    const [first, second] = screen.getAllByRole('tab');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(second);
  });

  it('ArrowRight on last tab wraps to first', () => {
    render(<Tablist onFirst={vi.fn()} onSecond={vi.fn()} />);
    const [first, second] = screen.getAllByRole('tab');
    second.focus();
    fireEvent.keyDown(second, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(first);
  });

  it('Home moves focus to the first tab and activates it', () => {
    const onFirst = vi.fn();
    render(
      <ThreeTablist onFirst={onFirst} onSecond={vi.fn()} onThird={vi.fn()} />,
    );
    const [first, , third] = screen.getAllByRole('tab');
    third.focus();
    fireEvent.keyDown(third, { key: 'Home' });
    expect(document.activeElement).toBe(first);
    expect(onFirst).toHaveBeenCalledOnce();
  });

  it('End moves focus to the last tab and activates it', () => {
    const onThird = vi.fn();
    render(
      <ThreeTablist onFirst={vi.fn()} onSecond={vi.fn()} onThird={onThird} />,
    );
    const [first, , third] = screen.getAllByRole('tab');
    first.focus();
    fireEvent.keyDown(first, { key: 'End' });
    expect(document.activeElement).toBe(third);
    expect(onThird).toHaveBeenCalledOnce();
  });

  it('prevents the default scroll on Home and End', () => {
    render(
      <ThreeTablist onFirst={vi.fn()} onSecond={vi.fn()} onThird={vi.fn()} />,
    );
    const [first] = screen.getAllByRole('tab');
    first.focus();
    const prevented = !fireEvent.keyDown(first, { key: 'End' });
    expect(prevented).toBe(true);
  });
});
