/**
 * Tests for ErrorBoundary's resetKey-change recovery branch and for the
 * signal it hands upward.
 *
 * The fallback *render* is already pixel-baselined by the
 * `user-crashes-app-via-failwhale` Tuffgal story and its accessible shape
 * is `ErrorFallbackView.test.tsx`, so what is left here is the stateful
 * `componentDidUpdate` branch (a resetKey change while `hasError` is true
 * must clear the error and re-render the children, while a rerender that
 * leaves resetKey unchanged must keep the fallback) and `onError`.
 *
 * `onError` exists so an ancestor can stop calling the app ready over a
 * crash, and the ancestor holding that region cannot wrap this boundary
 * without remounting it. Both directions are asked: a boundary that never
 * caught anything must stay quiet, or every clean boot reports a crash.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';
import { render, screen } from '@testing-library/react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Child({ crash }: { crash: boolean }) {
  if (crash) {
    throw new Error('boom');
  }
  return <div>recovered content</div>;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // silence expected console.error noise from the error lifecycle hooks
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ErrorBoundary resetKey recovery', () => {
  it('clears the error and re-renders children when resetKey changes', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="a" fallback={<div>fallback shown</div>}>
        <Child crash />
      </ErrorBoundary>,
    );

    expect(screen.getByText('fallback shown')).toBeInTheDocument();

    rerender(
      <ErrorBoundary resetKey="b" fallback={<div>fallback shown</div>}>
        <Child crash={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('recovered content')).toBeInTheDocument();
    expect(screen.queryByText('fallback shown')).not.toBeInTheDocument();
  });

  it('keeps the fallback when a rerender leaves resetKey unchanged', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="a" fallback={<div>fallback shown</div>}>
        <Child crash />
      </ErrorBoundary>,
    );

    expect(screen.getByText('fallback shown')).toBeInTheDocument();

    rerender(
      <ErrorBoundary resetKey="a" fallback={<div>fallback shown</div>}>
        <Child crash={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('fallback shown')).toBeInTheDocument();
    expect(screen.queryByText('recovered content')).not.toBeInTheDocument();
  });
});

describe('ErrorBoundary onError', () => {
  it('tells its caller when a child throws', () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError} fallback={<div>fallback shown</div>}>
        <Child crash />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalled();
  });

  it('stays quiet when nothing throws', () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError} fallback={<div>fallback shown</div>}>
        <Child crash={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('recovered content')).toBeInTheDocument();
    expect(onError).not.toHaveBeenCalled();
  });

  // AppShell mounts one without the prop, and a crash there must not throw
  it('catches just as happily when no caller is listening', () => {
    render(
      <ErrorBoundary fallback={<div>fallback shown</div>}>
        <Child crash />
      </ErrorBoundary>,
    );

    expect(screen.getByText('fallback shown')).toBeInTheDocument();
  });

  it('falls back to the full-page view when no fallback is given', () => {
    render(
      <ErrorBoundary>
        <Child crash />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeInTheDocument();
  });
});
