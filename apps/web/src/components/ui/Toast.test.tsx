import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import Toast from './Toast';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Toast', () => {
  it('renders the message', () => {
    render(<Toast message="Link saved!" onDismiss={vi.fn()} />);
    expect(screen.getByText('Link saved!')).toBeInTheDocument();
  });

  it('has role="status" for accessibility', () => {
    render(<Toast message="Link saved!" onDismiss={vi.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows a dismiss button', () => {
    render(<Toast message="Link saved!" onDismiss={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /dismiss/i }),
    ).toBeInTheDocument();
  });

  it('calls onDismiss after clicking the dismiss button and the animation delay', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Link saved!" onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(150));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('auto-dismisses after 3 seconds plus the animation delay', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Link saved!" onDismiss={onDismiss} />);

    act(() => vi.advanceTimersByTime(3000 + 150));

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
