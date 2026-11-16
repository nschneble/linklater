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

describe('LoadingScreen focus', () => {
  function Harness({ loading }: { loading: boolean }) {
    return (
      <>
        <button type="button">Elsewhere</button>
        {loading && <LoadingScreen statusText="Signing you in…" />}
      </>
    );
  }

  it('leaves focus where it was by default', () => {
    const { rerender } = render(<Harness loading={false} />);
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    elsewhere.focus();
    expect(elsewhere).toHaveFocus();

    rerender(<Harness loading />);

    expect(elsewhere).toHaveFocus();
    expect(screen.getByRole('main').getAttribute('tabindex')).toBeNull();
  });

  it('takes focus on mount when asked, without a name of its own', () => {
    render(<LoadingScreen focusOnMount statusText="Resetting…" />);

    const main = screen.getByRole('main');
    expect(main).toHaveFocus();
    expect(main).not.toHaveAccessibleName();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
