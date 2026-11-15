import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANNOUNCE_DELAY_MS } from '../../lib/liveRegion';
import LoadingScreen from './LoadingScreen';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LoadingScreen', () => {
  it('fills the status region it mounted empty, after the announce delay', () => {
    render(<LoadingScreen statusText="Signing you in…" />);

    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();

    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS - 1);
    });
    expect(status).toBeEmptyDOMElement();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(status).toHaveTextContent('Signing you in…');
    expect(screen.getByRole('status')).toBe(status);
  });

  it('announces nothing and leaves no timer when unmounted before the delay', () => {
    const { unmount } = render(<LoadingScreen statusText="Signing you in…" />);
    const status = screen.getByRole('status');

    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS / 2);
    });
    unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(status).toBeEmptyDOMElement();
  });

  it('is the only status region on the screen', () => {
    render(<LoadingScreen statusText="Signing you in…" />);

    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('places the status region inside the requested theme', () => {
    render(<LoadingScreen statusText="Resetting…" theme="branding" />);

    expect(
      screen.getByRole('status').closest('[data-theme="branding"]'),
    ).not.toBeNull();
  });
});
