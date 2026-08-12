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
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { BOOT_DWELL_MS, BOOT_THRESHOLD_MS } from './lib/hooks/useBootStatus';
import { StrictMode } from 'react';
import { useAuth } from './auth/AuthContext';

vi.mock('./auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('./theme/ThemeContext', () => ({
  useTheme: () => ({}),
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
  unauthenticatedRoutes: () => null,
}));

const BOOT_MESSAGE = 'Defrosting Linklater in the microwave…';

function setLoading(loading: boolean) {
  vi.mocked(useAuth).mockReturnValue({
    loading,
    user: null,
  } as unknown as ReturnType<typeof useAuth>);
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
  setLoading(true);
});

afterEach(() => {
  vi.useRealTimers();
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
    expect(screen.getByTestId('routes')).toBeInTheDocument();
  });
});
