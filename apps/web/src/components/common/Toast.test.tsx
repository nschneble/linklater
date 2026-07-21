/*
 * Tests for Toast – the fixed-position notification.
 *
 * The toast is split into two parts: a VISIBLE container (icon + message +
 * dismiss button, no live-region role) that paints synchronously, and a
 * separate sr-only announcement region (role/aria-live per variant) that
 * mounts empty and fills a couple of frames later.
 *
 * Contracts pinned here:
 * 1. Variant drives the bundle paint on the VISIBLE container: success →
 *    success-highlight, error → alert-highlight. The dismiss button's
 *    focus-visible ring flips to the corresponding `--{state}-highlight-fg`
 *    (Recovery Option A: the universal `--focus-ring` fails 3:1 against the
 *    state-highlights on every theme).
 * 2. Variant drives ARIA exposure on the sr-only ANNOUNCE region: success →
 *    role="status" / aria-live="polite", error → role="alert" /
 *    aria-live="assertive".
 * 3. The visible message renders synchronously (no width-jump); the sr-only
 *    announce region mounts empty and gains the text on a later frame.
 * 4. Dismiss flow: clicking the close button triggers an exit animation and
 *    fires onDismiss after the 150ms tail.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import Toast from './Toast';

// The sr-only announce region defers its text by two animation frames
// (SC 4.1.3). Tests drive those frames manually so message assertions are
// deterministic and independent of the real clock.
let pendingFrames: FrameRequestCallback[] = [];

function flushFrames() {
  act(() => {
    const frames = pendingFrames;
    pendingFrames = [];
    for (const frame of frames) frame(0);
  });
}

// The visible container is the parent of the dismiss button; it has no
// live-region role, so we can't query it via getByRole.
function getVisibleContainer() {
  return screen.getByRole('button', { name: 'Dismiss' }).parentElement!;
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pendingFrames = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pendingFrames.push(callback);
      return pendingFrames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('success variant paints success-highlight / success-highlight-fg and announces politely', () => {
    render(<Toast message="Saved!" onDismiss={() => {}} />);
    const visible = getVisibleContainer();
    expect(visible.className).toContain('bg-[var(--success-highlight)]');
    expect(visible.className).toContain('text-[var(--success-highlight-fg)]');
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });

  it('error variant paints alert-highlight / alert-highlight-fg and announces assertively', () => {
    render(
      <Toast message="Something broke" onDismiss={() => {}} variant="error" />,
    );
    const visible = getVisibleContainer();
    expect(visible.className).toContain('bg-[var(--alert-highlight)]');
    expect(visible.className).toContain('text-[var(--alert-highlight-fg)]');
    expect(screen.getByRole('alert').getAttribute('aria-live')).toBe(
      'assertive',
    );
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

  // Windows High Contrast / forced-colors mode overrides the arbitrary bg
  // paint to system Canvas and strips the box-shadow that border-shadow
  // produces. Without a forced-colors-visible border the toast would lose
  // every visible boundary against the page (WCAG 1.4.11 Non-text Contrast).
  // CanvasText is the system foreground token; ButtonText is reserved for
  // the interactive dismiss button's outline.
  it('paints a CanvasText border + text fallback in forced-colors mode', () => {
    render(<Toast message="x" onDismiss={() => {}} />);
    const visible = getVisibleContainer();
    expect(visible.className).toContain('forced-colors:border');
    expect(visible.className).toContain('forced-colors:border-[CanvasText]');
    expect(visible.className).toContain('forced-colors:text-[CanvasText]');
  });

  it('clicking dismiss triggers the exit animation and fires onDismiss after 150ms', () => {
    const handleDismiss = vi.fn();
    render(<Toast message="x" onDismiss={handleDismiss} />);
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismiss);
    // exit animation kicks in synchronously on the visible container
    expect(getVisibleContainer().className).toContain('animate-fade-out-down');
    expect(handleDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after 5000ms total (5000ms + 150ms exit tail)', () => {
    const handleDismiss = vi.fn();
    render(<Toast message="x" onDismiss={handleDismiss} />);
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(handleDismiss).not.toHaveBeenCalled();
    // Crossing the 5000ms boundary fires the auto-dismiss timer, which
    // triggers a React state update (setExiting(true)) – wrap in act().
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

  it('renders the visible message synchronously at mount (no deferred fill)', () => {
    render(<Toast message="Hello world" onDismiss={() => {}} />);
    // No frame flush: the visible text must already be present at first paint
    // so the toast never reflows mid-animation.
    expect(getVisibleContainer().textContent).toContain('Hello world');
  });

  // SC 4.1.3: VoiceOver ignores a live region whose text is present at mount
  // (no change event). The sr-only announce region must mount empty and gain
  // its text on a later frame so the screen reader speaks a genuine change.
  it('mounts the sr-only announce region empty, then fills it on a later frame', () => {
    render(<Toast message="Link saved!" onDismiss={() => {}} />);
    const announce = screen.getByRole('status');
    expect(announce.textContent).not.toContain('Link saved!');
    flushFrames();
    flushFrames();
    expect(announce.textContent).toContain('Link saved!');
  });

  it('marks the announce region aria-atomic so the whole message is announced', () => {
    render(<Toast message="x" onDismiss={() => {}} />);
    expect(screen.getByRole('status').getAttribute('aria-atomic')).toBe('true');
  });

  it('warning variant announces politely (role=status) and paints warn-highlight', () => {
    render(
      <Toast
        message="No link in clipboard"
        onDismiss={() => {}}
        variant="warning"
      />,
    );
    const visible = getVisibleContainer();
    expect(visible.className).toContain('bg-[var(--warn-highlight)]');
    expect(visible.className).toContain('text-[var(--warn-highlight-fg)]');
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });

  it('warning variant uses the fa-triangle-exclamation icon', () => {
    const { container } = render(
      <Toast message="x" onDismiss={() => {}} variant="warning" />,
    );
    expect(container.querySelector('.fa-triangle-exclamation')).toBeTruthy();
    expect(container.querySelector('.fa-circle-exclamation')).toBeNull();
  });

  it('does not extend auto-dismiss when parent re-renders mid-window', () => {
    const handleDismiss = vi.fn();

    function Wrapper({ tick }: { tick: number }) {
      // new inline arrow each render – mirrors the AuthForm consumer pattern
      // where setForgotPasswordSentJustNow(false) fires 5000ms after success
      // and causes the parent to hand Toast a fresh onDismiss identity
      return (
        <Toast message={`tick ${tick}`} onDismiss={() => handleDismiss(tick)} />
      );
    }

    const { rerender } = render(<Wrapper tick={0} />);

    // mid-window parent re-render with NEW onDismiss identity
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    rerender(<Wrapper tick={1} />);

    // remaining time to hit 5000ms total + 150ms exit animation tick
    act(() => {
      vi.advanceTimersByTime(2000 + 150);
    });

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});
