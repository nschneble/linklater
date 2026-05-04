import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, afterEach, vi } from 'vitest';
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

describe('useTabNavigation', () => {
  it('ArrowRight moves focus from first tab to second', () => {
    render(<Tablist onFirst={vi.fn()} onSecond={vi.fn()} />);
    const [first, second] = screen.getAllByRole('tab');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(second);
  });

  it('ArrowLeft moves focus from second tab to first', () => {
    render(<Tablist onFirst={vi.fn()} onSecond={vi.fn()} />);
    const [first, second] = screen.getAllByRole('tab');
    second.focus();
    fireEvent.keyDown(second, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(first);
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
});
