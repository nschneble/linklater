/*
 * Tests for Toast — the fixed-position notification.
 *
 * Three contracts pinned here:
 * 1. Variant drives the bundle paint: success → success-highlight,
 *    error → alert-highlight. The dismiss button's focus-visible ring
 *    flips to the corresponding `--{state}-highlight-fg` (Recovery
 *    Option A: the universal `--focus-ring` fails 3:1 against the
 *    state-highlights on every theme).
 * 2. Variant drives ARIA exposure: success → role="status" /
 *    aria-live="polite", error → role="alert" / aria-live="assertive".
 * 3. Dismiss flow: clicking the close button triggers an exit animation
 *    and fires onDismiss after the 150ms tail.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import Toast from './Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('success variant paints success-highlight / success-highlight-fg', () => {
    render(<Toast message="Saved!" onDismiss={() => {}} />);
    const toast = screen.getByRole('status');
    expect(toast.className).toContain('bg-[var(--success-highlight)]');
    expect(toast.className).toContain('text-[var(--success-highlight-fg)]');
    expect(toast.getAttribute('aria-live')).toBe('polite');
  });

  it('error variant paints alert-highlight / alert-highlight-fg', () => {
    render(
      <Toast message="Something broke" onDismiss={() => {}} variant="error" />,
    );
    const toast = screen.getByRole('alert');
    expect(toast.className).toContain('bg-[var(--alert-highlight)]');
    expect(toast.className).toContain('text-[var(--alert-highlight-fg)]');
    expect(toast.getAttribute('aria-live')).toBe('assertive');
  });

  it('success variant uses fa-circle-check icon', () => {
    const { container } = render(
      <Toast message="x" onDismiss={() => {}} variant="success" />,
    );
    expect(container.querySelector('.fa-circle-check')).toBeTruthy();
    expect(container.querySelector('.fa-circle-exclamation')).toBeNull();
  });

  it('error variant uses fa-circle-exclamation icon', () => {
    const { container } = render(
      <Toast message="x" onDismiss={() => {}} variant="error" />,
    );
    expect(container.querySelector('.fa-circle-exclamation')).toBeTruthy();
    expect(container.querySelector('.fa-circle-check')).toBeNull();
  });

  it('dismiss button focus-ring is success-highlight-fg for success variant (Recovery A)', () => {
    render(<Toast message="x" onDismiss={() => {}} variant="success" />);
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    expect(dismiss.className).toContain(
      'focus-visible:ring-[var(--success-highlight-fg)]',
    );
  });

  it('dismiss button focus-ring is alert-highlight-fg for error variant (Recovery A)', () => {
    render(<Toast message="x" onDismiss={() => {}} variant="error" />);
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    expect(dismiss.className).toContain(
      'focus-visible:ring-[var(--alert-highlight-fg)]',
    );
  });

  it('clicking dismiss triggers the exit animation and fires onDismiss after 150ms', () => {
    const handleDismiss = vi.fn();
    render(<Toast message="x" onDismiss={handleDismiss} />);
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismiss);
    // exit animation kicks in synchronously
    expect(screen.getByRole('status').className).toContain(
      'animate-fade-out-down',
    );
    expect(handleDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after 3000ms total (3000ms + 150ms exit tail)', () => {
    const handleDismiss = vi.fn();
    render(<Toast message="x" onDismiss={handleDismiss} />);
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(handleDismiss).not.toHaveBeenCalled();
    // Crossing the 3000ms boundary fires the auto-dismiss timer, which
    // triggers a React state update (setExiting(true)) — wrap in act().
    act(() => {
      vi.advanceTimersByTime(1);
    });
    // exit animation kicked in but onDismiss not yet
    expect(handleDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders the message text', () => {
    render(<Toast message="Hello world" onDismiss={() => {}} />);
    expect(screen.getByRole('status').textContent).toContain('Hello world');
  });

  it('does not extend auto-dismiss when parent re-renders mid-window', () => {
    const handleDismiss = vi.fn();

    function Wrapper({ tick }: { tick: number }) {
      // new inline arrow each render — mirrors the AuthForm consumer pattern
      // where setForgotPasswordSentJustNow(false) fires 3000ms after success
      // and causes the parent to hand Toast a fresh onDismiss identity
      return (
        <Toast message={`tick ${tick}`} onDismiss={() => handleDismiss(tick)} />
      );
    }

    const { rerender } = render(<Wrapper tick={0} />);

    // mid-window parent re-render with NEW onDismiss identity
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    rerender(<Wrapper tick={1} />);

    // remaining time to hit 5000ms total + 150ms exit animation tick
    act(() => {
      vi.advanceTimersByTime(2000 + 150);
    });

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});
