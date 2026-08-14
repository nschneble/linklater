/*
 * Tests for App's boot shape.
 *
 * The polite region that narrates the boot has to be present from the first
 * paint and survive both handovers as the same node. A region that mounts
 * with the interstitial is inconsistently announced, and one that unmounts
 * with it can leave a buffered utterance describing a screen the user can no
 * longer see. Hoisting it above the branch is what makes that structural
 * rather than a matter of timing, so the assertions compare node identity
 * across the transitions rather than merely finding a region each time.
 *
 * Everything below App's own wiring is stubbed at the module boundary,
 * mirroring `AppShell.test.tsx`.
 *
 * The terminal message is asked for here rather than only at the hook,
 * because two of the three things that decide it are only true of a real
 * tree. A crash reaches App as a callback from a boundary it renders, so
 * nothing outside App can hand it that landing. And a notice is consumed
 * by a child's mount effect, which React flushes before App's own, so a
 * peek would answer no on precisely the arrival where the answer is yes.
 * The route stubs stand in for the throwing element and the consuming
 * one; the copy each landing resolves to is pinned at the hook.
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import {
  BOOT_CLEAR_MS,
  BOOT_DWELL_MS,
  BOOT_READY_DELAY_MS,
  BOOT_THRESHOLD_MS,
} from './lib/hooks/useBootStatus';
import { resetNoticeConsumed, setPendingNotice } from './lib/pendingNotice';
import { StrictMode } from 'react';
import { unauthenticatedRoutes } from './routes/Unauthenticated';
import { useAuth } from './auth/AuthContext';
import { usePendingNotice } from './lib/hooks/usePendingNotice';

vi.mock('./auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// the setters only matter once a user arrives, which one landing needs
vi.mock('./theme/ThemeContext', () => ({
  useTheme: () => ({
    applyServerCustomTheme: () => undefined,
    applyServerCustomThemeEnabled: () => undefined,
    applyServerMode: () => undefined,
    applyServerTheme: () => undefined,
  }),
}));

vi.mock('./theme/useServerBooleanPrefSync', () => ({
  useServerBooleanPrefSync: vi.fn(),
}));

vi.mock('react-router', () => ({
  Routes: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="routes">{children}</div>
  ),
}));

vi.mock('./routes/Common', () => ({ commonRoutes: () => null }));
vi.mock('./routes/User', () => ({ userRoutes: () => null }));
vi.mock('./routes/Unauthenticated', () => ({
  unauthenticatedRoutes: vi.fn(() => null),
}));

const BOOT_MESSAGE = 'Defrosting Linklater in the microwave…';

function setLoading(loading: boolean, user: unknown = null) {
  vi.mocked(useAuth).mockReturnValue({
    loading,
    user,
  } as unknown as ReturnType<typeof useAuth>);
}

function Crashing(): never {
  throw new Error('boom');
}

function ConsumesNotice() {
  usePendingNotice();
  return null;
}

/**
 * Puts an element under `Routes`, where the boundary can reach it. The
 * route builders themselves run during App's own render, above the
 * boundary, so a throw from one of those escapes it entirely.
 */
function landOn(element: React.ReactNode) {
  vi.mocked(unauthenticatedRoutes).mockReturnValue(
    element as unknown as ReturnType<typeof unauthenticatedRoutes>,
  );
}

/** A boot slow enough to speak, up to the moment before it does. */
function slowBoot(user: unknown = null) {
  const rendered = render(<App />);

  advance(BOOT_THRESHOLD_MS);
  setLoading(false, user);
  act(() => rendered.rerender(<App />));
  advance(BOOT_DWELL_MS);

  return rendered;
}

function strictApp() {
  return (
    <StrictMode>
      <App />
    </StrictMode>
  );
}

function region(container: HTMLElement) {
  return container.querySelector('[role="status"]');
}

function advance(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  // the real module runs here, and its latch outlives the test that raised it
  resetNoticeConsumed();
  vi.mocked(unauthenticatedRoutes).mockReturnValue(
    null as unknown as ReturnType<typeof unauthenticatedRoutes>,
  );
  setLoading(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('App boot', () => {
  it('mounts the polite region empty before anything else renders', () => {
    const { container } = render(<App />);

    expect(region(container)).not.toBeNull();
    expect(region(container)?.textContent).toBe('');
    expect(region(container)).toHaveAttribute('aria-live', 'polite');
    expect(region(container)).toHaveAttribute('aria-atomic', 'true');
    expect(screen.queryByText(BOOT_MESSAGE)).toBeNull();
    expect(screen.queryByTestId('routes')).toBeNull();
  });

  it('keeps the same region node when the interstitial appears', () => {
    const { container } = render(<App />);
    const before = region(container);

    advance(BOOT_THRESHOLD_MS);

    expect(screen.getByText(BOOT_MESSAGE)).toBeInTheDocument();
    expect(region(container)).toBe(before);
    expect(region(container)?.textContent).toBe('Loading Linklater…');
    expect(screen.queryByTestId('routes')).toBeNull();
  });

  it('shows no routes while loading is still true, however long it runs', () => {
    render(<App />);

    advance(BOOT_THRESHOLD_MS);
    // second advance: an effect-scheduled handover is invisible to one
    advance(BOOT_DWELL_MS + 10_000);

    expect(screen.getByText(BOOT_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByTestId('routes')).toBeNull();
  });

  it('keeps the same region node when the app takes over', () => {
    const { container, rerender } = render(<App />);
    const before = region(container);

    advance(BOOT_THRESHOLD_MS);
    setLoading(false);
    act(() => rerender(<App />));
    advance(BOOT_DWELL_MS);

    expect(screen.getByTestId('routes')).toBeInTheDocument();
    expect(screen.queryByText(BOOT_MESSAGE)).toBeNull();
    expect(region(container)).toBe(before);
  });

  it('says nothing on a fast boot even when effects are double invoked', () => {
    const { container, rerender } = render(strictApp());

    advance(BOOT_THRESHOLD_MS - 100);
    setLoading(false);
    act(() => rerender(strictApp()));
    advance(10_000);

    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(region(container)?.textContent).toBe('');
    // seeing this on a boot this fast is the complaint being answered
    expect(screen.queryByText(BOOT_MESSAGE)).toBeNull();
    expect(screen.getByTestId('routes')).toBeInTheDocument();
  });
});

describe('App boot – what the region says it landed on', () => {
  it('reports the auth state when the boot found nobody signed in', () => {
    const { container } = slowBoot();

    advance(BOOT_READY_DELAY_MS);

    expect(region(container)?.textContent).toBe(
      "Linklater is ready. You're not signed in.",
    );
  });

  it('goes on saying only ready when somebody is signed in', () => {
    const { container } = slowBoot({ theme: 'apollo' });

    advance(BOOT_READY_DELAY_MS);

    expect(region(container)?.textContent).toBe('Linklater is ready.');
  });

  it('does not call the app ready over the error fallback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    landOn(<Crashing />);

    const { container } = slowBoot();
    advance(BOOT_READY_DELAY_MS);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(region(container)?.textContent).toBe('');
  });

  // the child's mount effect empties the store before App's effect runs
  it('stands down when a child consumed the notice on the way in', () => {
    setPendingNotice('session-unavailable');
    landOn(<ConsumesNotice />);

    const { container } = slowBoot();
    advance(BOOT_READY_DELAY_MS);

    expect(region(container)?.textContent).toBe('');
  });

  it('empties the region afterwards on every landing', () => {
    const { container } = slowBoot();

    advance(BOOT_READY_DELAY_MS);
    // second advance: the clear is scheduled by an effect, not by a timer
    advance(BOOT_CLEAR_MS);

    expect(region(container)?.textContent).toBe('');
  });
});
