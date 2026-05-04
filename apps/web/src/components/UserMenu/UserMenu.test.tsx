import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { useRef } from 'react';
import { useMenuNavigation } from './useMenuNavigation';

afterEach(() => vi.restoreAllMocks());

function FakeMenu({ onClose }: { onClose: () => void }) {
  const menuReference = useRef<HTMLDivElement>(null);
  useMenuNavigation(menuReference, onClose);

  return (
    <div ref={menuReference} role="menu">
      <button type="button" role="menuitem">
        First
      </button>
      <button type="button" role="menuitem">
        Second
      </button>
      <button type="button" role="menuitem">
        Third
      </button>
    </div>
  );
}

describe('useMenuNavigation', () => {
  it('ArrowDown moves focus to next item', () => {
    render(<FakeMenu onClose={vi.fn()} />);
    const [first, second] = screen.getAllByRole('menuitem');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(second);
  });

  it('ArrowUp moves focus to previous item', () => {
    render(<FakeMenu onClose={vi.fn()} />);
    const [first, second] = screen.getAllByRole('menuitem');
    second.focus();
    fireEvent.keyDown(second, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
  });

  it('ArrowDown on last item wraps to first', () => {
    render(<FakeMenu onClose={vi.fn()} />);
    const items = screen.getAllByRole('menuitem');
    const last = items[items.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('ArrowUp on first item wraps to last', () => {
    render(<FakeMenu onClose={vi.fn()} />);
    const items = screen.getAllByRole('menuitem');
    items[0].focus();
    fireEvent.keyDown(items[0], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    render(<FakeMenu onClose={onClose} />);
    const [first] = screen.getAllByRole('menuitem');
    first.focus();
    fireEvent.keyDown(first, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
